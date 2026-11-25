import { useEffect } from 'react';

export type CustomerReviewOrder = {
  order_id: string;
  email: string;
  delivery_country: string;
  estimated_delivery_date: string;
};

type SurveyApi = {
  load(name: 'surveyoptin', onLoad: () => void): void;
  surveyoptin: { render(order: CustomerReviewOrder & { merchant_id: number }): void };
};

const renderedOrders = new Set<string>();
let surveyApi: Promise<SurveyApi> | undefined;

function loadSurveyApi(): Promise<SurveyApi> {
  surveyApi ??= new Promise<SurveyApi>((resolve, reject) => {
    const browser = window as Window & { gapi?: SurveyApi; loadBeezioCustomerReview?: () => void };
    const script = document.createElement('script');
    const fail = () => {
      delete browser.loadBeezioCustomerReview;
      script.remove();
      reject(new Error('Google Customer Reviews is unavailable'));
    };

    browser.loadBeezioCustomerReview = () => {
      delete browser.loadBeezioCustomerReview;
      const api = browser.gapi;
      if (api?.load) api.load('surveyoptin', () => resolve(api));
      else fail();
    };
    script.src = 'https://apis.google.com/js/platform.js?onload=loadBeezioCustomerReview';
    script.async = true;
    script.onerror = fail;
    document.body.append(script);
  }).catch((error) => {
    surveyApi = undefined;
    throw error;
  });
  return surveyApi;
}

export default function GoogleCustomerReview({ order }: { order: CustomerReviewOrder }) {
  useEffect(() => {
    if (window.location.origin !== 'https://beezio.co' || renderedOrders.has(order.order_id)) return;

    const key = `beezio-customer-review:${order.order_id}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch { /* The in-memory guard also works when browser storage is restricted. */ }

    let cancelled = false;
    loadSurveyApi().then((api) => {
      if (cancelled || renderedOrders.has(order.order_id)) return;
      api.surveyoptin.render({ merchant_id: 5910935708, ...order });
      renderedOrders.add(order.order_id);
      try { sessionStorage.setItem(key, '1'); } catch { /* Browser storage is optional. */ }
    }).catch(() => { /* Survey availability does not affect order confirmation. */ });
    return () => { cancelled = true; };
  }, [order]);

  return null;
}
