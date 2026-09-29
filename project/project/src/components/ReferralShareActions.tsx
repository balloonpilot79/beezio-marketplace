import React, { useMemo, useState } from 'react';
import { MessageCircle, Smartphone } from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  buildReferralInviteMessage,
  buildSmsShareHref,
  MESSENGER_COMPOSE_URL,
} from '../utils/referralSharing';

type Props = {
  referralUrl: string;
  message?: string;
  className?: string;
};

export default function ReferralShareActions({
  referralUrl,
  message = 'Join Beezio through my invite to start selling or sharing products.',
  className = '',
}: Props) {
  const [messengerCopied, setMessengerCopied] = useState(false);
  const inviteMessage = useMemo(
    () => buildReferralInviteMessage(message, referralUrl),
    [message, referralUrl]
  );

  const shareBySms = () => {
    if (!referralUrl) return;
    window.location.assign(buildSmsShareHref(message, referralUrl));
  };

  const shareByMessenger = async () => {
    if (!referralUrl) return;

    const messengerWindow = window.open(MESSENGER_COMPOSE_URL, '_blank');
    if (messengerWindow) messengerWindow.opener = null;

    const copied = await copyTextToClipboard(inviteMessage);
    if (copied) {
      setMessengerCopied(true);
      window.setTimeout(() => setMessengerCopied(false), 2200);
    }

    if (!messengerWindow) window.location.assign(MESSENGER_COMPOSE_URL);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={shareBySms}
        disabled={!referralUrl}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Smartphone className="h-4 w-4" />
        Text invite
      </button>
      <button
        type="button"
        onClick={shareByMessenger}
        disabled={!referralUrl}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageCircle className="h-4 w-4" />
        {messengerCopied ? 'Invite copied' : 'Messenger'}
      </button>
    </div>
  );
}
