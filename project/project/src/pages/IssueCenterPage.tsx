import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { apiPost } from '../utils/netlifyApi';

type DisputeStatus = 'open' | 'investigating' | 'awaiting_response' | 'resolved' | 'closed';

interface Dispute {
  id: string;
  order_id: string | null;
  dispute_type: string;
  description: string;
  status: DisputeStatus;
  filed_by: string;
  filed_against: string;
  refund_amount?: number | null;
  resolution?: string | null;
  resolution_type?: string | null;
  created_at: string;
  updated_at: string;
}

interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  message: string;
  is_admin_message: boolean | null;
  created_at: string;
}

interface ProfileLite {
  id: string | null;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  primary_role: string | null;
}

const disputeTypes = [
  { value: 'refund_request', label: 'Refund request' },
  { value: 'product_not_received', label: 'Product not received' },
  { value: 'product_damaged', label: 'Product damaged' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'seller_unresponsive', label: 'Seller unresponsive' },
  { value: 'other', label: 'Other' },
];

interface IssueCenterPageProps {
  embedded?: boolean;
  initialSellerId?: string | null;
  initialOrderId?: string | null;
  initialSummary?: string | null;
  isAdminOverride?: boolean;
}

const IssueCenterPage: React.FC<IssueCenterPageProps> = ({
  embedded = false,
  initialSellerId = null,
  initialOrderId = null,
  initialSummary = null,
  isAdminOverride = false,
}) => {
  const { user, profile } = useAuth();
  const isAdmin = Boolean(isAdminOverride || profile?.role === 'admin' || profile?.primary_role === 'admin');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [sendBody, setSendBody] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'creating' | 'error' | 'success'>('idle');
  const [createError, setCreateError] = useState<string | null>(null);
  const [sellerInput, setSellerInput] = useState('');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [summaryInput, setSummaryInput] = useState('');
  const [detailsInput, setDetailsInput] = useState('');
  const [disputeType, setDisputeType] = useState(disputeTypes[0].value);

  const [adminStatus, setAdminStatus] = useState<DisputeStatus>('open');
  const [adminResolutionType, setAdminResolutionType] = useState<string>('');
  const [adminResolution, setAdminResolution] = useState<string>('');
  const [adminRefundAmount, setAdminRefundAmount] = useState<string>('');
  const [refundIntentId, setRefundIntentId] = useState<string>('');
  const [refundStatus, setRefundStatus] = useState<string | null>(null);

  const selectedDispute = useMemo(
    () => disputes.find((d) => d.id === selectedId) || null,
    [disputes, selectedId]
  );
  const orderLinkedIssue = Boolean(initialOrderId && initialSellerId);
  const currentActorIds = useMemo(
    () =>
      Array.from(
        new Set([
          String(user?.id || '').trim(),
          String(profile?.id || '').trim(),
          String((profile as any)?.user_id || '').trim(),
        ].filter(Boolean))
      ),
    [profile, user?.id]
  );

  useEffect(() => {
    if (user?.id) {
      void loadDisputes();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedId) {
      void loadThread(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedDispute) return;
    setAdminStatus(selectedDispute.status);
    setAdminResolutionType(selectedDispute.resolution_type || '');
    setAdminResolution(selectedDispute.resolution || '');
    setAdminRefundAmount(
      typeof selectedDispute.refund_amount === 'number' ? String(selectedDispute.refund_amount) : ''
    );
    setRefundIntentId(selectedDispute.order_id || '');
  }, [selectedDispute]);

  useEffect(() => {
    if (initialSellerId && !sellerInput) setSellerInput(initialSellerId);
    if (initialOrderId && !orderIdInput) setOrderIdInput(initialOrderId);
    if (initialSummary && !summaryInput) setSummaryInput(initialSummary);
  }, [initialSellerId, initialOrderId, initialSummary, orderIdInput, sellerInput, summaryInput]);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('disputes')
        .select(
          'id, order_id, dispute_type, description, status, filed_by, filed_against, refund_amount, resolution, resolution_type, created_at, updated_at'
        )
        .order('updated_at', { ascending: false })
        .limit(50);

      if (!isAdmin && currentActorIds.length) {
        const filters = currentActorIds.flatMap((actorId) => [`filed_by.eq.${actorId}`, `filed_against.eq.${actorId}`]);
        query = query.or(filters.join(','));
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as Dispute[]) : [];
      setDisputes(rows);
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id);
      }
      const userIds = rows.flatMap((d) => [d.filed_by, d.filed_against]);
      await loadProfiles(userIds);
    } catch (err) {
      console.error('Failed to load disputes', err);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (disputeId: string) => {
    setThreadLoading(true);
    try {
      const { data, error } = await supabase
        .from('dispute_messages')
        .select('id, dispute_id, sender_id, message, is_admin_message, created_at')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as DisputeMessage[]) : [];
      setMessages(rows);
      const userIds = rows.map((m) => m.sender_id);
      await loadProfiles(userIds);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setThreadLoading(false);
    }
  };

  const loadProfiles = async (userIds: string[]) => {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, role, primary_role')
      .in('user_id', uniqueIds);
    if (data && Array.isArray(data)) {
      const map: Record<string, ProfileLite> = {};
      data.forEach((row: ProfileLite) => {
        if (row.user_id) map[row.user_id] = row;
        if (row.id) map[row.id] = row;
      });
      setProfiles((prev) => ({ ...prev, ...map }));
    }
  };

  const formatUser = (userId: string, isAdminMessage?: boolean | null) => {
    if (isAdminMessage) return 'Beezio Support';
    const p = profiles[userId];
    const name = p?.full_name || p?.email || userId.slice(0, 8);
    const role = p?.primary_role || p?.role;
    if (role && role !== 'admin') return `${name} (${role})`;
    if (role === 'admin') return 'Beezio Support';
    return name;
  };

  const selectedFiledByLabel = selectedDispute ? formatUser(selectedDispute.filed_by) : '-';
  const selectedFiledAgainstLabel = selectedDispute ? formatUser(selectedDispute.filed_against) : '-';

  const resolveSellerId = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.includes('@')) {
      const { data } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', trimmed)
        .maybeSingle();
      return data?.user_id ? String(data.user_id) : null;
    }

    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`id.eq.${trimmed},user_id.eq.${trimmed}`)
      .maybeSingle();
    return data?.user_id ? String(data.user_id) : trimmed;
  };

  const createDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setCreateStatus('creating');
    setCreateError(null);
    try {
      const description = summaryInput.trim();
      const details = detailsInput.trim();
      if (!description) {
        setCreateStatus('error');
        setCreateError('Please enter a summary of the issue.');
        return;
      }

      const resolvedSellerId = await resolveSellerId(sellerInput);
      if (!resolvedSellerId) {
        setCreateStatus('error');
        setCreateError('Please provide a valid seller email or user ID.');
        return;
      }

      const data = await apiPost<{ dispute?: Dispute }>('/.netlify/functions/create-dispute-thread', null, {
          sellerId: resolvedSellerId,
          disputeType,
          description,
          message: details || description,
          orderId: orderIdInput.trim() || null,
      });
      const newDispute = data?.dispute;
      setCreateStatus('success');
      setSellerInput('');
      setOrderIdInput('');
      setSummaryInput('');
      setDetailsInput('');
      if (newDispute?.id) {
        setSelectedId(newDispute.id);
      }
      await loadDisputes();
    } catch (err) {
      console.error(err);
      setCreateStatus('error');
      setCreateError('Unable to open the issue. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!selectedDispute) return;
    const body = sendBody.trim();
    if (!body) return;
    setSendStatus('sending');
    try {
      await apiPost('/.netlify/functions/send-dispute-message', null, { disputeId: selectedDispute.id, body });
      setSendBody('');
      await loadThread(selectedDispute.id);
      await loadDisputes();
      setSendStatus('idle');
    } catch (err) {
      console.error(err);
      setSendStatus('error');
    }
  };

  const updateDispute = async () => {
    if (!selectedDispute || !isAdmin) return;
    setRefundStatus(null);
    try {
      const refundAmount = adminRefundAmount ? Number(adminRefundAmount) : null;
      await apiPost('/.netlify/functions/resolve-dispute', null, {
        disputeId: selectedDispute.id,
        status: adminStatus,
        resolutionType: adminResolutionType || null,
        resolution: adminResolution || null,
        refundAmount: Number.isFinite(refundAmount as number) ? refundAmount : null,
      });

      await loadDisputes();
    } catch (err) {
      console.error(err);
      setRefundStatus('Failed to update dispute.');
    }
  };

  const issueRefund = async () => {
    if (!isAdmin) return;
    const referenceId = refundIntentId.trim();
    const refundAmount = Number(adminRefundAmount || 0);
    if (!referenceId) {
      setRefundStatus('Add a PayPal payment reference, capture ID, or order ID to refund.');
      return;
    }
    try {
      setRefundStatus('Processing refund...');
      const data = await apiPost<{ ok?: boolean; action?: string; refundId?: string }>(
        '/.netlify/functions/refund-payment-intent',
        null,
        {
          referenceId,
          amount: Number.isFinite(refundAmount) && refundAmount > 0 ? refundAmount : undefined,
          reason: adminResolution || 'refund',
        }
      );
      const result = data;
      if (result?.ok) {
        setRefundStatus(`Refund ${result.action || 'processed'}${result.refundId ? ` (${result.refundId})` : ''}.`);
      } else {
        setRefundStatus('Refund request submitted.');
      }
      await loadDisputes();
    } catch (err) {
      console.error(err);
      setRefundStatus('Refund failed. Check the PayPal capture, payment reference, or order ID.');
    }
  };

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white border rounded-xl p-8 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Beezio Support & Disputes</h1>
          <p className="text-gray-600 mb-4">Sign in to open order issues, request refunds, and message Beezio support.</p>
          <a
            href="/auth/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const outerClass = embedded ? 'w-full' : 'min-h-screen bg-gray-50';
  const innerClass = embedded ? 'w-full' : 'max-w-7xl mx-auto px-4 py-8';

  return (
    <div className={outerClass}>
      <div className={innerClass}>
        <div className={embedded ? 'mb-4' : 'mb-6'}>
          {embedded ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900">Beezio Support & Disputes</h2>
              <p className="text-sm text-gray-600 mt-1">
                Support cases are shared with the seller tied to the order and monitored by Beezio so platform staff can step in when needed.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900">Beezio Support & Disputes</h1>
              <p className="text-gray-600 mt-1">
                Open a support case for order issues, refunds, replacements, and dispute review. The correct seller and Beezio support both receive the case.
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Open a seller + Beezio support case</h2>
              <p className="mb-4 text-sm text-gray-600">
                The complaint goes to the seller tied to the product or order, and Beezio monitors the thread. If the case is tied to an order, related payouts are held while it is open.
              </p>
              <form className="space-y-4" onSubmit={createDispute}>
                {orderLinkedIssue ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    This case is linked to the selected order. The seller for that order and Beezio support will both be attached automatically.
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seller email or user ID
                    </label>
                    <input
                      type="text"
                      value={sellerInput}
                      onChange={(e) => setSellerInput(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
                      placeholder="seller@shop.com or user UUID"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order ID
                  </label>
                  <input
                    type="text"
                    value={orderIdInput}
                    onChange={(e) => setOrderIdInput(e.target.value)}
                    readOnly={orderLinkedIssue}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800 read-only:bg-gray-50"
                    placeholder="Order ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue type</label>
                  <select
                    value={disputeType}
                    onChange={(e) => setDisputeType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
                  >
                    {disputeTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
                  <input
                    type="text"
                    value={summaryInput}
                    onChange={(e) => setSummaryInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
                    placeholder="Short summary of the issue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                  <textarea
                    value={detailsInput}
                    onChange={(e) => setDetailsInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
                    rows={4}
                    placeholder="Add what happened, what you expected, and whether you want a refund, replacement, or other help."
                  />
                </div>
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {createError}
                  </div>
                )}
                {createStatus === 'success' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    Issue opened. The seller and Beezio can now reply in the thread on the right.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={createStatus === 'creating'}
                  className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
                >
                  {createStatus === 'creating' ? 'Opening...' : 'Send to seller and Beezio'}
                </button>
              </form>
            </div>

            <div className="bg-white border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Issue threads</h2>
                <button
                  className="text-xs text-gray-600 hover:text-gray-900"
                  onClick={() => loadDisputes()}
                >
                  Refresh
                </button>
              </div>
              {loading ? (
                <div className="text-sm text-gray-600">Loading threads...</div>
              ) : disputes.length === 0 ? (
                <div className="text-sm text-gray-600">No issues yet.</div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((dispute) => (
                    <button
                      key={dispute.id}
                      onClick={() => setSelectedId(dispute.id)}
                      className={`w-full text-left border rounded-lg px-3 py-3 text-sm transition ${
                        selectedId === dispute.id
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">
                          {dispute.dispute_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500">{dispute.status}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Buyer/support requester: {formatUser(dispute.filed_by)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Seller/respondent: {formatUser(dispute.filed_against)} • {new Date(dispute.updated_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">{dispute.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border rounded-xl p-5 flex flex-col min-h-[520px]">
              {!selectedDispute ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  Select a thread to view the conversation.
                </div>
              ) : (
                <>
                  <div className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {selectedDispute.dispute_type.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Status: {selectedDispute.status} • Opened {new Date(selectedDispute.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => selectedDispute && loadThread(selectedDispute.id)}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Refresh thread
                      </button>
                    </div>
                    {selectedDispute.order_id && (
                      <p className="text-xs text-gray-500 mt-2">Order/payment ID: {selectedDispute.order_id}</p>
                    )}
                    <div className="mt-2 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="font-semibold text-slate-900">Filed by</div>
                        <div className="mt-1">{selectedFiledByLabel}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="font-semibold text-slate-900">Filed against</div>
                        <div className="mt-1">{selectedFiledAgainstLabel}</div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mt-2">{selectedDispute.description}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto py-4 space-y-3">
                    {threadLoading ? (
                      <div className="text-sm text-gray-600">Loading messages...</div>
                    ) : messages.length === 0 ? (
                      <div className="text-sm text-gray-600">No messages yet.</div>
                    ) : (
                      messages.map((msg) => {
                        const isMine =
                          msg.sender_id === user?.id || msg.sender_id === profile?.id || msg.sender_id === (profile as any)?.user_id;
                        return (
                          <div
                            key={msg.id}
                            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                              isMine ? 'ml-auto bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <div className="text-xs mb-1 opacity-70">
                              {formatUser(msg.sender_id, msg.is_admin_message)}
                            </div>
                            <div className="whitespace-pre-wrap">{msg.message}</div>
                            <div className="mt-1 text-[11px] opacity-70">
                              {new Date(msg.created_at).toLocaleString()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex gap-2">
                      <input
                        value={sendBody}
                        onChange={(e) => setSendBody(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Write a message..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                      />
                      <button
                        onClick={() => sendMessage()}
                        disabled={sendStatus === 'sending'}
                        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {sendStatus === 'sending' ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                    {sendStatus === 'error' && (
                      <div className="mt-2 text-xs text-red-600">
                        Message failed. Please try again.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {isAdmin && selectedDispute && (
              <div className="bg-white border rounded-xl p-5 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin actions</h3>
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Internal note: Beezio monitors every seller dispute here, can step into the thread, hold payouts, and manually issue refunds when needed.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={adminStatus}
                      onChange={(e) => setAdminStatus(e.target.value as DisputeStatus)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="awaiting_response">Awaiting response</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resolution type</label>
                    <select
                      value={adminResolutionType}
                      onChange={(e) => setAdminResolutionType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select</option>
                      <option value="refund_full">Refund full</option>
                      <option value="refund_partial">Refund partial</option>
                      <option value="replacement">Replacement</option>
                      <option value="no_action">No action</option>
                      <option value="seller_favor">Seller favor</option>
                      <option value="buyer_favor">Buyer favor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Refund amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={adminRefundAmount}
                      onChange={(e) => setAdminRefundAmount(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PayPal reference or order ID</label>
                    <input
                      type="text"
                      value={refundIntentId}
                      onChange={(e) => setRefundIntentId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Capture ID, provider payment reference, or order ID"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resolution notes</label>
                    <textarea
                      value={adminResolution}
                      onChange={(e) => setAdminResolution(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Internal notes or summary of resolution."
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={() => updateDispute()}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
                  >
                    Update dispute
                  </button>
                  <button
                    onClick={() => issueRefund()}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold"
                  >
                    Issue refund
                  </button>
                </div>
                {refundStatus && <div className="mt-3 text-sm text-gray-600">{refundStatus}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueCenterPage;
