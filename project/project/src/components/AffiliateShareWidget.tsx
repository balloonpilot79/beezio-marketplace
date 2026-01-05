import React, { useMemo, useState } from 'react';
import { Copy, Facebook, Mail, MessageSquare, Share2, Twitter } from 'lucide-react';
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

  const isAffiliate = Boolean(user && (hasRole('affiliate') || hasRole('admin') || profile?.primary_role === 'affiliate'));

  const canonicalTargetUrl = useMemo(() => {
    const origin = buildOrigin();
    if (props.targetPath && props.targetPath.startsWith('/')) {
      return `${origin}${props.targetPath}`;
    }
    switch (props.type) {
      case 'product':
        return `${origin}/product/${props.targetId}`;
      case 'store':
        return `${origin}/affiliate/${props.targetId}`;
      case 'collection':
        return `${origin}/c/${props.targetId}`;
      case 'fundraiser':
        return `${origin}/fundraiser/${props.targetId}`;
      default:
        return origin;
    }
  }, [props.targetId, props.type]);

  const getTrackedLink = async (channel: ShareChannel): Promise<LinkResponse> => {
    if (!user) throw new Error('Please sign in to share');
    if (!isAffiliate) throw new Error('Become an affiliate to get tracked links');
    const token = session?.access_token;
    if (!token) throw new Error('Missing auth session');

    return await postJson<LinkResponse>(
      '/api/affiliate/link',
      {
        target_type: props.type,
        target_id: props.targetId,
        target_path: props.targetPath ?? null,
        seller_id: props.sellerId ?? null,
        campaign: props.campaign ?? null,
        source: channel,
        title: props.title ?? null,
      },
      { Authorization: `Bearer ${token}` }
    );
  };

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
    setError(null);
    setBusyChannel(channel);
    try {
      if (!isAffiliate) {
        window.location.assign(buildSignupUrl(canonicalTargetUrl));
        return;
      }

      const { trackedUrl } = await getTrackedLink(channel);
      const template = getDefaultTemplate(props.type, channel);
      const message = fillTemplate(template.text, trackedUrl);

      await trackShareClick(channel);

      if (channel === 'copy') {
        await navigator.clipboard.writeText(trackedUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
        return;
      }

      if (channel === 'sms') {
        const body = encodeURIComponent(message);
        window.location.assign(`sms:?&body=${body}`);
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
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${quote}`, '_blank', 'noopener,noreferrer');
        return;
      }

      if (channel === 'x') {
        const text = encodeURIComponent(message);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
        return;
      }

      if (channel === 'whatsapp') {
        const text = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch (e) {
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
        {!isAffiliate && (
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
          disabled={busyChannel !== null}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copied!' : channelLabels.copy}
        </button>
        <button
          type="button"
          onClick={() => doShare('facebook')}
          disabled={busyChannel !== null}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Facebook className="w-4 h-4" />
          {channelLabels.facebook}
        </button>
        <button
          type="button"
          onClick={() => doShare('sms')}
          disabled={busyChannel !== null}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          {channelLabels.sms}
        </button>
        <button
          type="button"
          onClick={() => doShare('email')}
          disabled={busyChannel !== null}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          {channelLabels.email}
        </button>
        <button
          type="button"
          onClick={() => doShare('x')}
          disabled={busyChannel !== null}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Twitter className="w-4 h-4" />
          {channelLabels.x}
        </button>
      </div>

      {error && <div className="mt-2 text-xs text-red-700">{error}</div>}
      {!user && <div className="mt-2 text-xs text-gray-500">Sign in to share with tracked links.</div>}
    </div>
  );
}
