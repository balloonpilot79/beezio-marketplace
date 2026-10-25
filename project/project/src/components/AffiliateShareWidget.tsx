import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Facebook, Mail, MessageSquare, Share2, Twitter } from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import { buildSmsShareHref } from '../utils/referralSharing';
import { reserveShareWindow, navigateShareWindow } from '../utils/shareNavigation';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { fillTemplate, getDefaultTemplate, ShareChannel, ShareTargetType } from '../lib/shareTemplates';

type Props = {
  type: ShareTargetType;
  targetId: string;
  targetPath?: string;
  sellerId?: string;
  campaign?: string;
  title?: string;
  className?: string;
};

type LinkResponse = {
  trackedUrl: string;
  linkCode?: string;
};

const channelLabels: Record<ShareChannel, string> = {
  copy: 'Copy Link',
  facebook: 'Facebook',
  sms: 'SMS',
  email: 'Email',
  x: 'X',
  whatsapp: 'WhatsApp',
};

function buildOrigin(): string {
  return window.location.origin;
}

function buildSignupUrl(returnTo: string): string {
  const base = '/affiliate-signup';
  const redirect = encodeURIComponent(returnTo || '/');
  return `${base}?role=affiliate&redirect=${redirect}`;
}

async function postJson<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const detail = parsed?.error || parsed?.details || text || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return parsed as T;
}

export default function AffiliateShareWidget(props: Props) {
  const { user, session, profile, hasRole } = useAuth();
  const [copied, setCopied] = useState(false);
  const [busyChannel, setBusyChannel] = useState<ShareChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparedLink, setPreparedLink] = useState<{ key: string; url: string } | null>(null);
  const [retry, setRetry] = useState(0);

  const isPromoter = Boolean(
    user && (
      hasRole('affiliate') ||
      hasRole('seller') ||
      hasRole('admin') ||
      profile?.primary_role === 'affiliate' ||
      profile?.primary_role === 'seller'
    )
  );

  const canonicalTargetUrl = useMemo(() => {
    const origin = buildOrigin();
    if (props.targetPath && props.targetPath.startsWith('/')) {
      return `${origin}${props.targetPath}`;
    }
    switch (props.type) {
      case 'product':
        return `${origin}/product/${props.targetId}`;
      case 'store':
        return `${origin}/store/${props.targetId}`;
      case 'collection':
        return `${origin}/c/${props.targetId}`;
      default:
        return origin;
    }
  }, [props.targetId, props.type, props.targetPath]);

  const linkKey = JSON.stringify([user?.id, session?.access_token, props.type, props.targetId, props.targetPath, props.sellerId, props.campaign, props.title]);
  const linkReady = !isPromoter || preparedLink?.key === linkKey;

  // Prepare attribution before the click so SMS, mail and clipboard actions retain
  // the browser's user gesture. Never silently replace a failed partner link.
  useEffect(() => {
    if (!isPromoter) return;
    let active = true;
    setError(null);
    postJson<LinkResponse>('/api/affiliate/link', {
      target_type: props.type,
      target_id: props.targetId,
      target_path: props.targetPath ?? null,
      seller_id: props.sellerId ?? null,
      campaign: props.campaign ?? null,
      source: 'copy',
      title: props.title ?? null,
    }, { Authorization: `Bearer ${session?.access_token || ''}` }).then(response => {
      if (!response?.trackedUrl) throw new Error('Missing affiliate link');
      if (active) setPreparedLink({ key: linkKey, url: response.trackedUrl });
    }).catch(() => {
      if (active) setError('Could not create your affiliate link. Please try again.');
    });
    return () => { active = false; };
  }, [isPromoter, linkKey, retry]);

  const trackShareClick = async (channel: ShareChannel) => {
    try {
      const token = session?.access_token;
      if (!token) return;
      await postJson(
        '/api/analytics/share_click',
        {
          affiliate_id: profile?.id || null,
          target_type: props.type,
          target_id: props.targetId,
          channel,
          campaign: props.campaign ?? null,
          ts: new Date().toISOString(),
        },
        { Authorization: `Bearer ${token}` }
      );
    } catch {
      // best-effort
    }
  };

  const doShare = async (channel: ShareChannel) => {
    if (!linkReady) return;
    setError(null);
    setBusyChannel(channel);
    const popupChannels = new Set<ShareChannel>(['facebook', 'x', 'whatsapp']);
    const popup = popupChannels.has(channel)
      ? reserveShareWindow()
      : null;
    try {
      let trackedUrl = canonicalTargetUrl;
      if (isPromoter) {
        if (!linkReady || !preparedLink) throw new Error('Your affiliate link is not ready. Please try again.');
        const url = new URL(preparedLink.url);
        url.searchParams.set('utm_source', channel);
        trackedUrl = url.href;
      }
      const template = getDefaultTemplate(props.type, channel);
      const message = fillTemplate(template.text, trackedUrl);

      void trackShareClick(channel);

      if (channel === 'copy') {
        if (!await copyTextToClipboard(trackedUrl)) throw new Error('Could not copy the link. Please try again.');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
        return;
      }

      if (channel === 'sms') {
        window.location.assign(buildSmsShareHref(message, ''));
        return;
      }

      if (channel === 'email') {
        const subject = encodeURIComponent(props.title || 'Beezio');
        const body = encodeURIComponent(message);
        window.location.assign(`mailto:?subject=${subject}&body=${body}`);
        return;
      }

      if (channel === 'facebook') {
        const u = encodeURIComponent(trackedUrl);
        const quote = encodeURIComponent(message.replace(trackedUrl, '').trim());
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${quote}`;
        navigateShareWindow(shareUrl, popup);
        return;
      }

      if (channel === 'x') {
        const text = encodeURIComponent(message);
        const shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
        navigateShareWindow(shareUrl, popup);
        return;
      }

      if (channel === 'whatsapp') {
        const text = encodeURIComponent(message);
        const shareUrl = `https://wa.me/?text=${text}`;
        navigateShareWindow(shareUrl, popup);
        return;
      }
    } catch (e) {
      if (popup && !popup.closed) popup.close();
      setError(e instanceof Error ? e.message : 'Failed to share');
    } finally {
      setBusyChannel(null);
    }
  };

  return (
    <div className={props.className || ''}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Share2 className="w-4 h-4 text-gray-700" />
          Share
        </div>
        {!isPromoter && (
          <a
            href={buildSignupUrl(canonicalTargetUrl)}
            className="text-xs text-amber-700 hover:text-amber-800 font-semibold"
          >
            Earn by sharing this
          </a>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => doShare('copy')}
          disabled={busyChannel !== null || !linkReady}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copied!' : channelLabels.copy}
        </button>
        <button
          type="button"
          onClick={() => doShare('facebook')}
          disabled={busyChannel !== null || !linkReady}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Facebook className="w-4 h-4" />
          {channelLabels.facebook}
        </button>
        <button
          type="button"
          onClick={() => doShare('sms')}
          disabled={busyChannel !== null || !linkReady}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          {channelLabels.sms}
        </button>
        <button
          type="button"
          onClick={() => doShare('email')}
          disabled={busyChannel !== null || !linkReady}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          {channelLabels.email}
        </button>
        <button
          type="button"
          onClick={() => doShare('x')}
          disabled={busyChannel !== null || !linkReady}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Twitter className="w-4 h-4" />
          {channelLabels.x}
        </button>
      </div>

      {!linkReady && !error && <div role="status" className="mt-2 text-xs text-gray-500">Preparing your affiliate link…</div>}
      {error && <div role="alert" className="mt-2 text-xs text-red-700">{error}</div>}
      {!linkReady && error && <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 text-sm underline">Retry affiliate link</button>}
      {!user && <div className="mt-2 text-xs text-gray-500">Sign in as a seller or affiliate to share with tracked links.</div>}
    </div>
  );
}
