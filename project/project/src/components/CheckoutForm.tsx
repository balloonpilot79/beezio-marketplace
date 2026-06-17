import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { TAX_RATE } from '../lib/pricing';
import { clearReferralData, getReferralAttribution } from '../utils/referralTracking';
import { resolveCheckoutAttribution } from '../utils/checkoutAttribution';
import { CheckoutShippingOption, ShippingQuoteItem, getCheckoutShippingQuote } from '../services/shippingService';
import { roundUpToTwoDecimals } from '../utils/pricing';

interface CheckoutFormProps {
  amount: number;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): boolean => UUID_REGEX.test(String(value || '').trim());

const normalizeToken = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');

const requireSignedInBuyer = (userId: string | null | undefined) => {
  if (String(userId || '').trim()) return;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
  }

  throw new Error('You must sign in before checkout so your order, receipt, and buyer dashboard stay linked.');
};

const CheckoutForm: React.FC<CheckoutFormProps> = ({ onSuccess, onError }) => {
  const paymentsEnabled = String((import.meta as any)?.env?.VITE_PAYMENTS_ENABLED || 'true').toLowerCase() === 'true';
  const paypalClientId = String((import.meta as any)?.env?.VITE_PAYPAL_CLIENT_ID || '').trim();
  const paymentProvider = String((import.meta as any)?.env?.VITE_PAYMENT_PROVIDER || 'paypal').trim().toLowerCase();
  const showPayPalDiagnostics =
    Boolean((import.meta as any)?.env?.DEV) ||
    String((import.meta as any)?.env?.VITE_SHOW_PAYPAL_DIAGNOSTICS || '').toLowerCase() === 'true';
  const [resolvedPayPalClientId, setResolvedPayPalClientId] = useState<string>(paypalClientId);
  const [paypalEnv, setPaypalEnv] = useState<'sandbox' | 'live'>('sandbox');
  const [paypalClientToken, setPaypalClientToken] = useState<string>('');
  const [paypalConfigError, setPaypalConfigError] = useState<string | null>(null);
  const [paypalStatusChecked, setPaypalStatusChecked] = useState<boolean>(Boolean(paypalClientId));
  const [paypalStatusLoading, setPaypalStatusLoading] = useState(false);
  const { items, shippingOption, setShippingOption, clearCart } = useCart();
  const { user, profile } = useAuth();
  const [, setProcessing] = useState(false);
  const [cardPaymentProcessing, setCardPaymentProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paypalReady, setPaypalReady] = useState(false);
  const [cardFieldsEligible, setCardFieldsEligible] = useState(false);
  const [cardFieldsReady, setCardFieldsReady] = useState(false);
  const [cardFieldsStatus, setCardFieldsStatus] = useState<string | null>(null);
  const [paypalDiagnostics, setPaypalDiagnostics] = useState<{
    sdkLoaded: boolean;
    hasButtons: boolean;
    hasCardFields: boolean;
    cardFieldsEligible: boolean | null;
    cardFieldsRenderState: 'idle' | 'sdk-missing' | 'ineligible' | 'rendering' | 'ready' | 'render-failed';
    sdkUrl: string | null;
    clientIdSuffix: string | null;
    detail: string | null;
  }>({
    sdkLoaded: false,
    hasButtons: false,
    hasCardFields: false,
    cardFieldsEligible: null,
    cardFieldsRenderState: 'idle',
    sdkUrl: null,
    clientIdSuffix: null,
    detail: null,
  });
  const paypalSdkInstanceRef = useRef<any | null>(null);
  const paypalButtonsCleanupRef = useRef<(() => void) | null>(null);
  const paypalCardFieldsRef = useRef<any | null>(null);
  const paypalContainerTopRef = useRef<HTMLDivElement | null>(null);
  const paypalCardNumberRef = useRef<HTMLDivElement | null>(null);
  const paypalCardExpiryRef = useRef<HTMLDivElement | null>(null);
  const paypalCardCvvRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  const setPayPalDiagnosticsState = (update: Partial<typeof paypalDiagnostics>) => {
    setPaypalDiagnostics((current) => {
      const next = { ...current, ...update };
      console.info('[Beezio PayPal Diagnostics]', next);
      return next;
    });
  };

  // Resolve PayPal client id at runtime to avoid mismatch between client build env and server env.
  useEffect(() => {
    if (!paymentsEnabled) return;
    if (paymentProvider !== 'paypal') return;

    if (paypalClientId) setResolvedPayPalClientId(paypalClientId);

    let cancelled = false;
    (async () => {
      setPaypalStatusLoading(true);
      setPaypalStatusChecked(false);
      try {
        let lastError = 'Unable to check PayPal configuration.';
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const res = await fetch('/api/paypal/status', { method: 'GET' });
            const data = await res.json().catch(() => ({}));
            const publicClientId = String((data as any)?.publicClientId || '').trim();
            const envRaw = String((data as any)?.env || '').trim().toLowerCase();
            setPaypalEnv(envRaw === 'live' ? 'live' : 'sandbox');
            if (cancelled) return;

            if (!res.ok) {
              lastError = 'PayPal status check failed.';
              throw new Error(lastError);
            }

            if (publicClientId) {
              setResolvedPayPalClientId(publicClientId);
              setPaypalConfigError(null);
              setPaypalStatusChecked(true);
              setPaypalStatusLoading(false);
              return;
            }

            if (paypalClientId) {
              setResolvedPayPalClientId(paypalClientId);
              setPaypalConfigError(null);
              setPaypalStatusChecked(true);
              setPaypalStatusLoading(false);
              return;
            }

            const configured = Boolean((data as any)?.configured?.clientId && (data as any)?.configured?.clientSecret);
            setResolvedPayPalClientId('');
            setPaypalConfigError(
              configured ? 'PayPal client id is missing.' : 'PayPal checkout is not configured yet.'
            );
            setPaypalStatusChecked(true);
            setPaypalStatusLoading(false);
            return;
          } catch {
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
              continue;
            }
          }
        }
        if (!cancelled) {
          setResolvedPayPalClientId(paypalClientId || '');
          setPaypalConfigError(lastError);
        }
      } finally {
        if (!cancelled) {
          setPaypalStatusChecked(true);
          setPaypalStatusLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentsEnabled, paymentProvider, paypalClientId]);

  const [availableShippingOptions, setAvailableShippingOptions] = useState<CheckoutShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [requiresQuotedShipping, setRequiresQuotedShipping] = useState(false);

  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });
  const [useDifferentShippingAddress, setUseDifferentShippingAddress] = useState(false);
  const [shippingDetails, setShippingDetails] = useState({
    name: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });
  const billingDetailsRef = useRef(billingDetails);
  const shippingDetailsRef = useRef(shippingDetails);
  const useDifferentShippingAddressRef = useRef(useDifferentShippingAddress);
  const itemsRef = useRef(items);
  const shippingOptionRef = useRef(shippingOption);
  const requiresQuotedShippingRef = useRef(requiresQuotedShipping);
  const userRef = useRef(user);
  const hasDigitalItemsRef = useRef(false);
  const payPalListingSubtotalRef = useRef(0);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const normalizeCountryCode = (value: string) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return 'US';
    if (normalized === 'UNITED STATES' || normalized === 'USA') return 'US';
    if (normalized === 'CANADA') return 'CA';
    return normalized;
  };

  const getProfileCityState = () => {
    const profileCity = String((profile as any)?.city || '').trim();
    const profileState = String((profile as any)?.state || '').trim();
    if (profileCity || profileState) {
      return { city: profileCity, state: profileState };
    }

    const fallbackLocation = String((profile as any)?.location || '').trim();
    if (!fallbackLocation.includes(',')) {
      return { city: '', state: '' };
    }

    const [city, ...stateParts] = fallbackLocation.split(',');
    return {
      city: String(city || '').trim(),
      state: stateParts.join(',').trim(),
    };
  };

  const validateBillingDetails = () => {
    const currentBillingDetails = billingDetailsRef.current;
    const requiredFields: Array<{ value: string; message: string }> = [
      { value: currentBillingDetails.name, message: 'Enter your full name before using PayPal.' },
      { value: currentBillingDetails.email, message: 'Enter your email address before using PayPal.' },
      { value: currentBillingDetails.address.line1, message: 'Enter your shipping street address before using PayPal.' },
      { value: currentBillingDetails.address.city, message: 'Enter your shipping city before using PayPal.' },
      { value: currentBillingDetails.address.state, message: 'Enter your shipping state before using PayPal.' },
      { value: currentBillingDetails.address.postal_code, message: 'Enter your shipping ZIP or postal code before using PayPal.' },
      { value: currentBillingDetails.address.country, message: 'Select your shipping country before using PayPal.' },
    ];

    const firstMissing = requiredFields.find((field) => !String(field.value || '').trim());
    if (firstMissing) {
      if (formRef.current && typeof formRef.current.reportValidity === 'function') {
        formRef.current.reportValidity();
      }
      throw new Error(firstMissing.message);
    }
  };

  const payPalListingSubtotal = useMemo(() => {
    const subtotal = items.reduce((acc, it) => {
      const qty = Math.max(1, Math.floor(Number(it.quantity || 0)));
      const buyerUnitPrice = Math.max(0, Number(it.price || 0));
      return acc + buyerUnitPrice * qty;
    }, 0);
    return roundUpToTwoDecimals(subtotal);
  }, [items]);
  const hasDigitalItems = useMemo(() => items.some((item) => item.isDigital), [items]);
  const paypalCurrency = useMemo(() => {
    const firstItemCurrency = String(items[0]?.currency || 'USD').trim().toUpperCase();
    return firstItemCurrency || 'USD';
  }, [items]);

  const hasFreeOnlyShipping = useMemo(
    () => items.length > 0 && !requiresQuotedShipping && !shippingLoading && !shippingError,
    [items.length, requiresQuotedShipping, shippingError, shippingLoading]
  );

  useEffect(() => {
    billingDetailsRef.current = billingDetails;
  }, [billingDetails]);

  useEffect(() => {
    shippingDetailsRef.current = shippingDetails;
  }, [shippingDetails]);

  useEffect(() => {
    useDifferentShippingAddressRef.current = useDifferentShippingAddress;
  }, [useDifferentShippingAddress]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    shippingOptionRef.current = shippingOption;
  }, [shippingOption]);

  useEffect(() => {
    requiresQuotedShippingRef.current = requiresQuotedShipping;
  }, [requiresQuotedShipping]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    hasDigitalItemsRef.current = hasDigitalItems;
  }, [hasDigitalItems]);

  useEffect(() => {
    payPalListingSubtotalRef.current = payPalListingSubtotal;
  }, [payPalListingSubtotal]);

  useEffect(() => {
    if (!paymentsEnabled) return;
    if (paymentProvider !== 'paypal') return;
    if (!resolvedPayPalClientId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/paypal/client-token', { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(String((data as any)?.error || 'Failed to fetch PayPal client token'));
        }
        const token = String((data as any)?.clientToken || '').trim();
        if (!token) throw new Error('PayPal client token was empty');
        setPaypalClientToken(token);
        setPayPalDiagnosticsState({
          clientIdSuffix: resolvedPayPalClientId ? resolvedPayPalClientId.slice(-6) : null,
          detail: 'Fetched PayPal browser-safe client token.',
        });
      } catch (err) {
        setPaypalClientToken('');
        setPayPalDiagnosticsState({
          detail: err instanceof Error ? err.message : 'Failed to fetch PayPal client token.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentsEnabled, paymentProvider, resolvedPayPalClientId]);

  useEffect(() => {
    if (!paymentsEnabled) return;
    if (paymentProvider !== 'paypal') return;
    if (!resolvedPayPalClientId) return;
    if (!paypalClientToken) return;

    const w = window as any;
    const paypalDomain = paypalEnv === 'live' ? 'www.paypal.com' : 'www.sandbox.paypal.com';
    const sdkUrl = `https://${paypalDomain}/web-sdk/v6/core`;
    const scriptId = `paypal-web-sdk-v6-core-${paypalEnv}`;
    const existingById = document.getElementById(scriptId) as HTMLScriptElement | null;
    const legacyScript = document.getElementById('paypal-js-sdk');
    if (legacyScript?.parentNode) {
      legacyScript.parentNode.removeChild(legacyScript);
    }

    setPayPalDiagnosticsState({
      sdkLoaded: Boolean(w.paypal?.createInstance),
      hasButtons: false,
      hasCardFields: false,
      cardFieldsEligible: null,
      sdkUrl,
      clientIdSuffix: resolvedPayPalClientId ? resolvedPayPalClientId.slice(-6) : null,
      detail: 'Loading PayPal Web SDK v6 core script.',
    });
    setPaypalReady(false);
    paypalSdkInstanceRef.current = null;

    let cancelled = false;
    let onLoad: (() => void) | null = null;
    let onError: (() => void) | null = null;

    const initialize = async () => {
      try {
        const paypalGlobal = (window as any).paypal;
        if (!paypalGlobal?.createInstance) {
          throw new Error('PayPal Web SDK v6 loaded but createInstance was unavailable.');
        }
        const sdkInstance = await paypalGlobal.createInstance({
          clientToken: paypalClientToken,
          components: ['paypal-payments', 'card-fields'],
          pageType: 'checkout',
        });
        if (cancelled) return;
        paypalSdkInstanceRef.current = sdkInstance;

        const paymentMethods = await sdkInstance.findEligibleMethods({
          currencyCode: paypalCurrency,
        });
        if (cancelled) return;
        const hasButtons =
          Boolean(paymentMethods?.isEligible?.('paypal')) ||
          Boolean(paymentMethods?.isEligible?.('paylater')) ||
          Boolean(paymentMethods?.isEligible?.('credit'));
        const hasCardFields = Boolean(paymentMethods?.isEligible?.('advanced_cards'));

        setPaypalReady(true);
        setCardFieldsEligible(hasCardFields);
        if (!hasCardFields) {
          setCardFieldsStatus('Guest card checkout is not enabled on this PayPal merchant account yet.');
        }
        setPayPalDiagnosticsState({
          sdkLoaded: true,
          hasButtons,
          hasCardFields,
          cardFieldsEligible: hasCardFields,
          cardFieldsRenderState: hasCardFields ? 'rendering' : 'ineligible',
          detail: 'PayPal Web SDK v6 instance initialized.',
        });
      } catch (err) {
        if (cancelled) return;
        paypalSdkInstanceRef.current = null;
        setPaypalReady(false);
        setCardFieldsEligible(false);
        setPayPalDiagnosticsState({
          sdkLoaded: Boolean((window as any).paypal?.createInstance),
          hasButtons: false,
          hasCardFields: false,
          cardFieldsEligible: null,
          cardFieldsRenderState: 'sdk-missing',
          detail: err instanceof Error ? err.message : 'Failed to initialize PayPal Web SDK v6.',
        });
      }
    };

    if (existingById) {
      if (w.paypal?.createInstance) {
        void initialize();
      } else {
        onLoad = () => {
          void initialize();
        };
        onError = () => {
          setPaypalReady(false);
          setPayPalDiagnosticsState({
            sdkLoaded: false,
            hasButtons: false,
            hasCardFields: false,
            cardFieldsEligible: null,
            cardFieldsRenderState: 'sdk-missing',
            detail: 'PayPal Web SDK v6 core failed to load.',
          });
        };
        existingById.addEventListener('load', onLoad);
        existingById.addEventListener('error', onError);
      }
      return () => {
        cancelled = true;
        if (onLoad) existingById.removeEventListener('load', onLoad);
        if (onError) existingById.removeEventListener('error', onError);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => {
      void initialize();
    };
    script.onerror = () => {
      setPaypalReady(false);
      setPayPalDiagnosticsState({
        sdkLoaded: false,
        hasButtons: false,
        hasCardFields: false,
        cardFieldsEligible: null,
        cardFieldsRenderState: 'sdk-missing',
        detail: `PayPal Web SDK v6 failed to load from ${paypalDomain}.`,
      });
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [paymentsEnabled, paymentProvider, paypalClientToken, paypalCurrency, paypalEnv, resolvedPayPalClientId]);

  useEffect(() => {
    const { city, state } = getProfileCityState();
    const profileName =
      String((profile as any)?.full_name || '').trim() ||
      String((user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || '').trim();
    const profileCountry = normalizeCountryCode(String((profile as any)?.country || '').trim() || 'US');
    const profileZip = String((profile as any)?.zip_code || '').trim();

    setBillingDetails((prev) => ({
      ...prev,
      name: prev.name || profileName,
      email: prev.email || user?.email || '',
      address: {
        ...prev.address,
        city: prev.address.city || city,
        state: prev.address.state || state,
        postal_code: prev.address.postal_code || profileZip,
        country:
          prev.address.country && (prev.address.country !== 'US' || profileCountry === 'US')
            ? prev.address.country
            : profileCountry,
      },
    }));
    setShippingDetails((prev) => ({
      ...prev,
      name: prev.name || profileName,
      address: {
        ...prev.address,
        city: prev.address.city || city,
        state: prev.address.state || state,
        postal_code: prev.address.postal_code || profileZip,
        country:
          prev.address.country && (prev.address.country !== 'US' || profileCountry === 'US')
            ? prev.address.country
            : profileCountry,
      },
    }));
  }, [profile, user?.email, user?.user_metadata]);

  const shippingQuoteItems = React.useMemo<ShippingQuoteItem[]>(
    () =>
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.variantId,
      })),
    [items]
  );

  const handleShippingSelection = (option: CheckoutShippingOption) => {
    const destinationAddress = useDifferentShippingAddress ? shippingDetails.address : billingDetails.address;
    setShippingError(null);
    setShippingOption({
      id: option.id,
      name: option.methodName,
      cost: Number(option.cost),
      methodCode: option.methodCode,
      destinationCountry: destinationAddress.country,
    });
  };

  useEffect(() => {
    let isCancelled = false;
    const timer = window.setTimeout(async () => {
      setShippingLoading(true);
      setShippingError(null);
      try {
        const quote = await getCheckoutShippingQuote({
          items: shippingQuoteItems,
        });
        const options = quote.options;
        const hasQuotedShipping = quote.mappedProductIds.length > 0;

        if (isCancelled) return;

        setRequiresQuotedShipping(hasQuotedShipping);
        if (!hasQuotedShipping) {
          setAvailableShippingOptions([]);
          setShippingOption(null);
          setShippingError(null);
          return;
        }

        setAvailableShippingOptions(options);
        if (!options.length) {
          setShippingOption(null);
          setShippingError('Shipping options are unavailable for that address right now.');
          return;
        }

        const existing = options.find((opt) => opt.id === shippingOption?.id);
        if (existing) {
          handleShippingSelection(existing);
          return;
        }

        if (options.length === 1) {
          handleShippingSelection(options[0]);
        } else {
          setShippingOption(null);
          setShippingError('Please select a shipping method to continue.');
        }
      } catch (err) {
        console.error('Shipping options lookup failed:', err);
        setShippingError(err instanceof Error ? err.message : 'Unable to load seller shipping right now.');
      } finally {
        if (!isCancelled) {
          setShippingLoading(false);
        }
      }
    }, 600);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    items.length,
    shippingQuoteItems,
    shippingOption?.id,
    setShippingOption,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (paymentsEnabled && paymentProvider === 'paypal') {
      const message = 'Use the PayPal buttons below to complete checkout.';
      setError(message);
      onErrorRef.current(message);
      return;
    }

    if (!paymentsEnabled) {
      const message = 'Payments are temporarily unavailable. You can review totals and shipping, but checkout is paused.';
      setError(message);
      onErrorRef.current(message);
      return;
    }
  };

  const createPayPalOrder = async () => {
    setProcessing(true);
    setError(null);
    try {
      const payload = await buildOrderPayload();

      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = String((data as any)?.code || '').trim();
        if (code === 'PAYMENTS_PAUSED') {
          throw new Error('Payments are temporarily unavailable. Please check back soon.');
        }
        const baseMessage = String((data as any)?.error || 'Checkout creation failed').trim();
        const details = String((data as any)?.details || '').trim();
        throw new Error(details ? `${baseMessage}: ${details}` : baseMessage);
      }

      const orderID = String((data as any)?.orderID || '').trim();
      if (!orderID) throw new Error('Checkout creation failed: missing PayPal order id');
      return orderID;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setError(message);
      onErrorRef.current(message);
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const createPayPalOrderForSession = async () => {
    const orderId = await createPayPalOrder();
    return { orderId };
  };

  const capturePayPalOrder = async (approvedOrderId: string) => {
    setProcessing(true);
    try {
      if (!approvedOrderId) throw new Error('Missing PayPal order id');

      const captureRes = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: approvedOrderId }),
      });
      const captureData = await captureRes.json().catch(() => ({}));
      if (!captureRes.ok) {
        throw new Error(String((captureData as any)?.error || 'PayPal capture failed'));
      }

      const beezioOrderId = String((captureData as any)?.order_id || '').trim();
      clearReferralData();
      clearCart();
      onSuccessRef.current(beezioOrderId || 'paid');
      window.location.href = beezioOrderId ? `/order-confirmation?order=${encodeURIComponent(beezioOrderId)}` : '/';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PayPal checkout failed';
      setError(message);
      onErrorRef.current(message);
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const resolveCanonicalCheckoutItems = async (currentItems: typeof items) => {
    const unresolvedItems = currentItems.filter((item) => !isUuid(item.productId));
    const variantTokens = Array.from(
      new Set(
        currentItems
          .map((item) => String(item.variantId || '').trim())
          .filter(Boolean)
      )
    );
    if (!unresolvedItems.length && !variantTokens.some((variantId) => !isUuid(variantId))) return currentItems;

    const byVariantProductId = new Map<string, string>();
    const variantUuidIds = Array.from(
      new Set(variantTokens.filter((variantId) => isUuid(variantId)))
    );

    if (variantUuidIds.length) {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id,product_id')
        .in('id', variantUuidIds);

      for (const variant of (variants as Array<{ id?: string | null; product_id?: string | null }> | null) || []) {
        const variantId = String(variant?.id || '').trim();
        const productId = String(variant?.product_id || '').trim();
        if (variantId && isUuid(productId)) byVariantProductId.set(variantId, productId);
      }
    }

    const unresolvedTokens = Array.from(
      new Set(
        unresolvedItems
          .filter((item) => {
            const variantId = String(item.variantId || '').trim();
            return !variantId || !byVariantProductId.has(variantId);
          })
          .map((item) => normalizeToken(item.productId))
          .filter(Boolean)
      )
    );

    const byExternalProductId = new Map<string, string>();
    if (unresolvedTokens.length) {
      const { data: products } = await supabase
        .from('products')
        .select('id,external_id')
        .in('external_id', unresolvedTokens);

      for (const product of (products as Array<{ id?: string | null; external_id?: string | null }> | null) || []) {
        const canonicalId = String(product?.id || '').trim();
        const externalId = normalizeToken(product?.external_id);
        if (externalId && isUuid(canonicalId)) byExternalProductId.set(externalId, canonicalId);
      }
    }

    const canonicalProductIds = Array.from(
      new Set(
        currentItems
          .map((item) => {
            if (isUuid(item.productId)) return String(item.productId).trim();
            const variantId = String(item.variantId || '').trim();
            return byVariantProductId.get(variantId) || byExternalProductId.get(normalizeToken(item.productId)) || '';
          })
          .filter((productId) => isUuid(productId))
      )
    );

    const variantTokenToCanonicalId = new Map<string, string>();
    const unresolvedVariantTokens = Array.from(new Set(variantTokens.filter((variantId) => !isUuid(variantId))));
    if (unresolvedVariantTokens.length && canonicalProductIds.length) {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id,product_id,external_variant_id,cj_variant_id,cj_vid,sku,variant_display_sku,searchable_codes')
        .in('product_id', canonicalProductIds);

      for (const variant of (variants as Array<Record<string, unknown>> | null) || []) {
        const canonicalVariantId = String(variant?.id || '').trim();
        if (!isUuid(canonicalVariantId)) continue;
        const candidateTokens = new Set<string>();
        for (const rawCandidate of [
          variant?.external_variant_id,
          variant?.cj_variant_id,
          variant?.cj_vid,
          variant?.sku,
          variant?.variant_display_sku,
        ]) {
          const token = normalizeToken(rawCandidate);
          if (token) candidateTokens.add(token);
        }
        const searchableCodes = Array.isArray(variant?.searchable_codes) ? variant.searchable_codes : [];
        for (const code of searchableCodes) {
          const token = normalizeToken(code);
          if (token) candidateTokens.add(token);
        }
        for (const token of candidateTokens) {
          if (unresolvedVariantTokens.includes(token)) {
            variantTokenToCanonicalId.set(token, canonicalVariantId);
          }
        }
      }
    }

    return currentItems.map((item) => {
      const variantId = String(item.variantId || '').trim();
      const canonicalFromVariant = variantId ? byVariantProductId.get(variantId) : null;
      const canonicalFromExternal = byExternalProductId.get(normalizeToken(item.productId));
      const canonicalProductId = canonicalFromVariant || canonicalFromExternal;
      const canonicalVariantId = isUuid(variantId) ? variantId : (variantTokenToCanonicalId.get(normalizeToken(variantId)) || null);
      return {
        ...item,
        productId: canonicalProductId || item.productId,
        variantId: canonicalVariantId || undefined,
      };
    });
  };

  const buildOrderPayload = async () => {
    const currentItems = itemsRef.current;
    const normalizedItems = await resolveCanonicalCheckoutItems(currentItems);
    const invalidProductReference = normalizedItems.find((item) => !isUuid(item.productId));
    if (invalidProductReference) {
      throw new Error('Your cart contains an outdated product reference. Remove that item and add it again.');
    }
    const currentShippingOption = shippingOptionRef.current;
    const currentRequiresQuotedShipping = requiresQuotedShippingRef.current;
    const currentUser = userRef.current;
    const currentBillingDetails = billingDetailsRef.current;
    const currentShippingDetails = shippingDetailsRef.current;
    const currentUseDifferentShippingAddress = useDifferentShippingAddressRef.current;
    const currentHasDigitalItems = hasDigitalItemsRef.current;
    const currentPayPalListingSubtotal = payPalListingSubtotalRef.current;
    requireSignedInBuyer(currentUser?.id);

    if (!currentItems.length) throw new Error('Your cart is empty.');
    if (currentHasDigitalItems && !currentUser?.id) {
      throw new Error('You must sign in to purchase digital products so delivery stays secure.');
    }

    const sellerId = String(currentItems[0]?.sellerId || '').trim();
    if (!sellerId) throw new Error('Missing seller_id for this cart.');
    if (currentItems.some((it) => String(it.sellerId || '').trim() !== sellerId)) {
      throw new Error('Your cart contains items from multiple sellers. Please checkout one seller at a time.');
    }

    if (currentRequiresQuotedShipping && !currentShippingOption) {
      throw new Error('Please select a shipping option before completing checkout.');
    }

    validateBillingDetails();

    const selectedShippingDetails = currentUseDifferentShippingAddress ? currentShippingDetails : currentBillingDetails;
    const selectedShippingAddress = selectedShippingDetails.address;
    const selectedShippingName = String(selectedShippingDetails.name || currentBillingDetails.name || '').trim();
    if (currentUseDifferentShippingAddress) {
      const shippingRequiredFields: Array<{ value: string; message: string }> = [
        { value: selectedShippingName, message: 'Enter the ship-to full name before using PayPal.' },
        { value: selectedShippingAddress.line1, message: 'Enter the ship-to street address before using PayPal.' },
        { value: selectedShippingAddress.city, message: 'Enter the ship-to city before using PayPal.' },
        { value: selectedShippingAddress.state, message: 'Enter the ship-to state before using PayPal.' },
        { value: selectedShippingAddress.postal_code, message: 'Enter the ship-to ZIP or postal code before using PayPal.' },
        { value: selectedShippingAddress.country, message: 'Select the ship-to country before using PayPal.' },
      ];
      const firstMissing = shippingRequiredFields.find((field) => !String(field.value || '').trim());
      if (firstMissing) {
        if (formRef.current && typeof formRef.current.reportValidity === 'function') {
          formRef.current.reportValidity();
        }
        throw new Error(firstMissing.message);
      }
    }

    const itemsSubtotal = currentPayPalListingSubtotal;
    const quotedShippingCost = currentRequiresQuotedShipping ? Number(currentShippingOption?.cost || 0) : 0;
    const shippingTotal = Math.round((quotedShippingCost + Number.EPSILON) * 100) / 100;
    const taxAmount = Math.round((itemsSubtotal * TAX_RATE + Number.EPSILON) * 100) / 100;

    const attribution = getReferralAttribution();
    const { affiliate_id, storefront_id, orderSource } = resolveCheckoutAttribution({
      referralAffiliateId: attribution.type === 'affiliate' ? attribution.id : null,
      storeScope: localStorage.getItem('beezio-store-scope'),
      cartAffiliateIds: normalizedItems.map((item) => item.affiliateId ?? null),
    });

    const nameParts = selectedShippingName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

    const shipping_info = {
      firstName,
      lastName,
      address: selectedShippingAddress.line1,
      address2: selectedShippingAddress.line2 || '',
      city: selectedShippingAddress.city,
      state: selectedShippingAddress.state,
      zip: selectedShippingAddress.postal_code,
      country: selectedShippingAddress.country,
      phone: '',
      email: currentBillingDetails.email || currentUser?.email || '',
      name: selectedShippingName,
    };

    const shipping_option = currentShippingOption
      ? {
          id: currentShippingOption.id,
          name: currentShippingOption.name,
          cost: Number(currentShippingOption.cost || 0),
          method_code: currentShippingOption.methodCode || '',
          destination_country: currentShippingOption.destinationCountry || selectedShippingAddress.country,
        }
      : null;

    const origin = window.location.origin;
    const success_url = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/checkout/cancel`;

    const requestedBuyerId = String((profile as any)?.id || currentUser?.id || '').trim() || null;
    const effectiveBuyerId = requestedBuyerId && requestedBuyerId === sellerId ? null : requestedBuyerId;

    return {
      cart: {
        line_items: normalizedItems.map((it) => ({
          product_id: it.productId,
          variant_id: it.variantId ?? null,
          qty: it.quantity,
          unit_price: it.sellerAsk ?? it.price,
        })),
        shipping_amount: shippingTotal,
        tax_amount: taxAmount,
        currency: (normalizedItems[0]?.currency || 'USD') as string,
      },
      context: {
        seller_id: sellerId,
        buyer_id: effectiveBuyerId,
        storefront_id,
        store_id: storefront_id,
        affiliate_id,
        referrer_id: null,
        source: orderSource,
        campaign: null,
      },
      customer: {
        email: currentBillingDetails.email || currentUser?.email || '',
        name: currentBillingDetails.name || '',
      },
      shipping_info,
      shipping_option,
      success_url,
      cancel_url,
    };
  };

  useEffect(() => {
    if (!paymentsEnabled) return;
    if (paymentProvider !== 'paypal') return;
    if (!resolvedPayPalClientId) return;
    if (!paypalReady) return;
    if (!paypalSdkInstanceRef.current) return;

    const containers = [paypalContainerTopRef.current].filter(Boolean) as HTMLDivElement[];
    if (!containers.length) return;

    paypalButtonsCleanupRef.current?.();
    paypalButtonsCleanupRef.current = null;

    let cancelled = false;
    let cleanupFns: Array<() => void> = [];

    const setupButtons = async () => {
      try {
        const sdkInstance = paypalSdkInstanceRef.current;
        if (!sdkInstance) return;

        const paymentMethods = await sdkInstance.findEligibleMethods({
          currencyCode: paypalCurrency,
        });
        if (cancelled) return;

        const sessionOptions = {
          onApprove: async (data: any) => {
            const approvedOrderId = String(data?.orderId || '').trim();
            await capturePayPalOrder(approvedOrderId);
          },
          onCancel: () => {
            setProcessing(false);
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            const message = err instanceof Error ? err.message : 'PayPal checkout failed';
            setError(message);
            onErrorRef.current(message);
          },
        };

        for (const container of containers) {
          container.innerHTML = '';
          if (!paymentMethods?.isEligible?.('paypal')) continue;

          const paypalButton = document.createElement('paypal-button');
          paypalButton.setAttribute('type', 'pay');
          container.appendChild(paypalButton);

          const paypalPaymentSession = sdkInstance.createPayPalOneTimePaymentSession(sessionOptions);
          const onClick = async () => {
            try {
              setError(null);
              validateBillingDetails();
              const createOrderPromise = createPayPalOrderForSession();
              await paypalPaymentSession.start({ presentationMode: 'auto' }, createOrderPromise);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'PayPal checkout failed';
              setError(message);
              onErrorRef.current(message);
            }
          };
          paypalButton.addEventListener('click', onClick);
          cleanupFns.push(() => paypalButton.removeEventListener('click', onClick));
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to initialize PayPal buttons';
        setError(message);
        onErrorRef.current(message);
      }
    };

    void setupButtons();
    paypalButtonsCleanupRef.current = () => {
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
    };

    return () => {
      cancelled = true;
      paypalButtonsCleanupRef.current?.();
      paypalButtonsCleanupRef.current = null;
    };
  }, [paymentProvider, paymentsEnabled, paypalCurrency, paypalReady, resolvedPayPalClientId]);

  useEffect(() => {
    if (!paymentsEnabled) return;
    if (paymentProvider !== 'paypal') return;
    if (!resolvedPayPalClientId) return;
    if (!paypalReady) return;
    if (!paypalSdkInstanceRef.current) return;
    if (!paypalCardNumberRef.current || !paypalCardExpiryRef.current || !paypalCardCvvRef.current) return;

    const closeExisting = () => {
      try {
        paypalCardFieldsRef.current?.close?.();
        paypalCardFieldsRef.current?.destroy?.();
      } catch {
        // ignore
      }
      paypalCardFieldsRef.current = null;
      if (paypalCardNumberRef.current) paypalCardNumberRef.current.innerHTML = '';
      if (paypalCardExpiryRef.current) paypalCardExpiryRef.current.innerHTML = '';
      if (paypalCardCvvRef.current) paypalCardCvvRef.current.innerHTML = '';
    };

    closeExisting();
    setCardFieldsReady(false);
    let cancelled = false;
    (async () => {
      try {
        const sdkInstance = paypalSdkInstanceRef.current;
        if (!sdkInstance) return;
        const paymentMethods = await sdkInstance.findEligibleMethods({
          currencyCode: paypalCurrency,
        });
        if (cancelled) return;

        const eligible = Boolean(paymentMethods?.isEligible?.('advanced_cards'));
        setPayPalDiagnosticsState({
          sdkLoaded: true,
          hasButtons: Boolean(paymentMethods?.isEligible?.('paypal')),
          hasCardFields: eligible,
          cardFieldsEligible: eligible,
          cardFieldsRenderState: eligible ? 'rendering' : 'ineligible',
          detail: eligible
            ? 'PayPal v6 advanced cards are eligible. Rendering card fields.'
            : 'PayPal v6 advanced cards are not eligible for this account/session.',
        });

        if (!eligible) {
          setCardFieldsEligible(false);
          setCardFieldsStatus('Guest card checkout is not enabled on this PayPal merchant account yet.');
          return;
        }

        const cardFieldsSession = sdkInstance.createCardFieldsOneTimePaymentSession();
        const numberField = cardFieldsSession.createCardFieldsComponent({
          type: 'number',
          placeholder: 'Card Number',
        });
        const expiryField = cardFieldsSession.createCardFieldsComponent({
          type: 'expiry',
          placeholder: 'MM/YY',
        });
        const cvvField = cardFieldsSession.createCardFieldsComponent({
          type: 'cvv',
          placeholder: 'CVV',
        });

        paypalCardNumberRef.current?.appendChild(numberField);
        paypalCardExpiryRef.current?.appendChild(expiryField);
        paypalCardCvvRef.current?.appendChild(cvvField);

        paypalCardFieldsRef.current = cardFieldsSession;
        setCardFieldsEligible(true);
        setCardFieldsStatus(null);
        setCardFieldsReady(true);
        setPayPalDiagnosticsState({
          cardFieldsEligible: true,
          cardFieldsRenderState: 'ready',
          detail: 'PayPal v6 card fields rendered successfully.',
        });
      } catch (err) {
        if (cancelled) return;
        console.error('PayPal card fields render failed:', err);
        setCardFieldsReady(false);
        setCardFieldsEligible(false);
        setCardFieldsStatus('Card checkout could not be loaded. If this merchant account is approved for PayPal card fields, refresh and try again.');
        setPayPalDiagnosticsState({
          cardFieldsEligible: true,
          cardFieldsRenderState: 'render-failed',
          detail: err instanceof Error ? err.message : 'PayPal card fields render failed.',
        });
      }
    })();

    return () => {
      cancelled = true;
      closeExisting();
      setCardFieldsReady(false);
    };
  }, [paymentProvider, paymentsEnabled, paypalCurrency, paypalReady, resolvedPayPalClientId]);

  const handleCardPayment = async () => {
    if (cardPaymentProcessing) return;
    try {
      setError(null);
      setCardFieldsStatus(null);
      validateBillingDetails();

      const currentCardFields = paypalCardFieldsRef.current;
      if (!currentCardFields || !cardFieldsEligible) {
        throw new Error('Card checkout is not available for this PayPal account yet.');
      }

      setCardPaymentProcessing(true);
      setCardFieldsStatus('Processing card payment...');
      setProcessing(true);
      const orderId = await createPayPalOrder();
      setCardFieldsStatus('Submitting card details securely...');
      const { data, state } = await currentCardFields.submit(orderId, {
        billingAddress: {
          addressLine1: billingDetails.address.line1,
          addressLine2: billingDetails.address.line2 || undefined,
          adminArea2: billingDetails.address.city,
          adminArea1: billingDetails.address.state,
          postalCode: billingDetails.address.postal_code,
          countryCode: billingDetails.address.country,
        },
      });
      if (state === 'succeeded') {
        setCardFieldsStatus('Finalizing payment...');
        const approvedOrderId = String((data as any)?.orderId || orderId || '').trim();
        await capturePayPalOrder(approvedOrderId);
        return;
      }
      if (state === 'canceled') {
        throw new Error('Card checkout was canceled.');
      }
      throw new Error(String((data as any)?.message || 'Card checkout failed'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Card checkout failed';
      setError(message);
      setCardFieldsStatus(message);
      onErrorRef.current(message);
      setProcessing(false);
      setCardPaymentProcessing(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setBillingDetails((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setBillingDetails((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleShippingInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setShippingDetails((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setShippingDetails((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <style>
        {`
          #paypal-card-number-field,
          #paypal-card-expiry-field,
          #paypal-card-cvv-field {
            position: relative;
            overflow: hidden;
          }

          #paypal-card-number-field {
            height: 56px;
            min-height: 56px;
            max-height: 56px;
          }

          #paypal-card-expiry-field,
          #paypal-card-cvv-field {
            height: 52px;
            min-height: 52px;
            max-height: 52px;
          }

          #paypal-card-number-field > *,
          #paypal-card-expiry-field > *,
          #paypal-card-cvv-field > * {
            display: block;
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            max-height: 100% !important;
          }

          #paypal-card-number-field iframe,
          #paypal-card-expiry-field iframe,
          #paypal-card-cvv-field iframe {
            display: block;
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            max-height: 100% !important;
          }
        `}
      </style>

      {!paymentsEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold">Payments are temporarily unavailable.</div>
          <div className="mt-1 opacity-90">You can still review totals and shipping, but checkout is paused.</div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

      {paymentsEnabled && paymentProvider === 'paypal' && !resolvedPayPalClientId && paypalStatusChecked && !paypalStatusLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold">PayPal checkout is not ready yet.</div>
          <div className="mt-1 opacity-90">
            {paypalConfigError || 'Missing PayPal configuration. Add the Beezio PayPal credentials and try again.'}
          </div>
        </div>
      )}
      {paymentsEnabled && paymentProvider === 'paypal' && !resolvedPayPalClientId && !paypalStatusChecked && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Checking PayPal configuration...
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-base font-semibold text-gray-900">1. Contact And Shipping</div>
            <div className="mt-0.5 text-sm text-gray-600">
              Enter the basics first so payment and review stay easy to find.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={billingDetails.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                autoComplete="name"
                name="name"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={billingDetails.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                autoComplete="email"
                name="email"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4">
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Address Line 1</label>
              <input
                type="text"
                value={billingDetails.address.line1}
                onChange={(e) => handleInputChange('address.line1', e.target.value)}
                autoComplete="address-line1"
                name="address-line1"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Address Line 2</label>
              <input
                type="text"
                value={billingDetails.address.line2}
                onChange={(e) => handleInputChange('address.line2', e.target.value)}
                autoComplete="address-line2"
                name="address-line2"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                value={billingDetails.address.city}
                onChange={(e) => handleInputChange('address.city', e.target.value)}
                autoComplete="address-level2"
                name="address-level2"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
              <input
                type="text"
                value={billingDetails.address.state}
                onChange={(e) => handleInputChange('address.state', e.target.value)}
                autoComplete="address-level1"
                name="address-level1"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ZIP / Postal Code</label>
              <input
                type="text"
                value={billingDetails.address.postal_code}
                onChange={(e) => handleInputChange('address.postal_code', e.target.value)}
                autoComplete="postal-code"
                name="postal-code"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Country</label>
              <select
                value={billingDetails.address.country}
                onChange={(e) => handleInputChange('address.country', e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              >
                <option value="US">US</option>
                <option value="CA">Canada</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {paymentProvider === 'paypal' && resolvedPayPalClientId && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">2. Payment Method</div>
                <div className="mt-0.5 text-sm text-gray-600">
                  Choose PayPal or pay with a card. This section is kept compact on purpose.
                </div>
              </div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">Secure checkout</div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-2.5">
              <div className="text-sm font-semibold text-gray-900">PayPal</div>
              <div className="mt-1 text-xs text-gray-700">
                Sign in with PayPal or use guest card checkout below.
              </div>
              <div className="mt-3" ref={paypalContainerTopRef}>
                {!paypalReady && (
                  <div className="text-sm text-gray-600">Loading PayPal...</div>
                )}
              </div>
              {cardFieldsStatus && (
                <div className="mt-3 rounded-md border border-amber-300 bg-white p-2.5 text-sm text-amber-900">
                  {cardFieldsStatus}
                </div>
              )}
              {showPayPalDiagnostics && (
                <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  <div className="font-semibold text-slate-900">PayPal diagnostics</div>
                  <div className="mt-2">Client ID suffix: {paypalDiagnostics.clientIdSuffix || 'unknown'}</div>
                  <div>SDK loaded: {paypalDiagnostics.sdkLoaded ? 'yes' : 'no'}</div>
                  <div>Buttons available: {paypalDiagnostics.hasButtons ? 'yes' : 'no'}</div>
                  <div>CardFields available: {paypalDiagnostics.hasCardFields ? 'yes' : 'no'}</div>
                  <div>CardFields eligible: {paypalDiagnostics.cardFieldsEligible === null ? 'unknown' : paypalDiagnostics.cardFieldsEligible ? 'yes' : 'no'}</div>
                  <div>CardFields render state: {paypalDiagnostics.cardFieldsRenderState}</div>
                  {paypalDiagnostics.detail && <div className="mt-1">Detail: {paypalDiagnostics.detail}</div>}
                </div>
              )}
            </div>

            <div className={`rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 ${cardFieldsEligible ? '' : 'hidden'}`} aria-hidden={cardFieldsEligible ? 'false' : 'true'}>
              <div className="text-sm font-semibold text-gray-900">Pay with card</div>
              <div className="mt-1 text-xs text-gray-600">
                Card details are processed securely by PayPal.
              </div>
              <div className="mt-2.5 space-y-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Card number</label>
                  <div ref={paypalCardNumberRef} id="paypal-card-number-field" className="rounded-md border border-gray-300 bg-white px-3 py-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Expiration</label>
                    <div ref={paypalCardExpiryRef} id="paypal-card-expiry-field" className="rounded-md border border-gray-300 bg-white px-3 py-2" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Security code</label>
                    <div ref={paypalCardCvvRef} id="paypal-card-cvv-field" className="rounded-md border border-gray-300 bg-white px-3 py-2" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCardPayment}
                  disabled={!cardFieldsReady || cardPaymentProcessing}
                  className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cardPaymentProcessing ? 'Processing payment...' : cardFieldsReady ? 'Pay with card' : 'Loading card fields...'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-2.5">
        <label className="flex items-center gap-3 text-sm font-medium text-gray-900">
          <input
            type="checkbox"
            checked={useDifferentShippingAddress}
            onChange={(e) => setUseDifferentShippingAddress(e.target.checked)}
            className="h-4 w-4"
          />
          Ship to a different address
        </label>

        {useDifferentShippingAddress && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ship To Name</label>
              <input
                type="text"
                value={shippingDetails.name}
                onChange={(e) => handleShippingInputChange('name', e.target.value)}
                autoComplete="shipping name"
                name="shipping-name"
                required={useDifferentShippingAddress}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Ship To Address Line 1</label>
                <input
                  type="text"
                  value={shippingDetails.address.line1}
                  onChange={(e) => handleShippingInputChange('address.line1', e.target.value)}
                  autoComplete="shipping address-line1"
                  name="shipping-address-line1"
                  required={useDifferentShippingAddress}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Ship To Address Line 2</label>
                <input
                  type="text"
                  value={shippingDetails.address.line2}
                  onChange={(e) => handleShippingInputChange('address.line2', e.target.value)}
                  autoComplete="shipping address-line2"
                  name="shipping-address-line2"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ship To City</label>
                <input
                  type="text"
                  value={shippingDetails.address.city}
                  onChange={(e) => handleShippingInputChange('address.city', e.target.value)}
                  autoComplete="shipping address-level2"
                  name="shipping-address-level2"
                  required={useDifferentShippingAddress}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ship To State</label>
                <input
                  type="text"
                  value={shippingDetails.address.state}
                  onChange={(e) => handleShippingInputChange('address.state', e.target.value)}
                  autoComplete="shipping address-level1"
                  name="shipping-address-level1"
                  required={useDifferentShippingAddress}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ship To ZIP / Postal Code</label>
                <input
                  type="text"
                  value={shippingDetails.address.postal_code}
                  onChange={(e) => handleShippingInputChange('address.postal_code', e.target.value)}
                  autoComplete="shipping postal-code"
                  name="shipping-postal-code"
                  required={useDifferentShippingAddress}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ship To Country</label>
                <select
                  value={shippingDetails.address.country}
                  onChange={(e) => handleShippingInputChange('address.country', e.target.value)}
                  required={useDifferentShippingAddress}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5"
                >
                  <option value="US">US</option>
                  <option value="CA">Canada</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-sm font-medium text-gray-900">Shipping Calculator</div>
          <div className="mt-0.5 text-xs text-gray-600">
            Shipping is set by the seller for this order before payment is completed.
          </div>
        </div>
        {shippingLoading && <div className="text-sm text-gray-600">Loading seller shipping...</div>}
        {shippingError && <div className="text-sm text-amber-700">{shippingError}</div>}

        {availableShippingOptions.length > 0 && (
          <div className="space-y-2">
            {availableShippingOptions.map((opt) => {
              const selected = opt.id === shippingOption?.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleShippingSelection(opt)}
                  className={`w-full rounded-md border p-3 text-left ${
                    selected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{opt.methodName}</div>
                    <div className="text-gray-900">${Number(opt.cost).toFixed(2)}</div>
                  </div>
                  {opt.minDays != null && opt.maxDays != null && (
                    <div className="text-xs text-gray-600 mt-1">
                      {opt.minDays}–{opt.maxDays} days
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {!shippingLoading && availableShippingOptions.length === 0 && hasFreeOnlyShipping && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Free shipping is included for this order.
          </div>
        )}
        {!shippingLoading && availableShippingOptions.length === 0 && !shippingError && !hasFreeOnlyShipping && (
          <div className="text-sm text-gray-600">
            Shipping will appear here once the seller shipping setup is loaded.
          </div>
        )}
      </div>

    </form>
  );
};

export default CheckoutForm;
