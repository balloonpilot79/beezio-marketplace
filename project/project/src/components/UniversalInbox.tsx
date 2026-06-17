import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import IssueCenterPage from '../pages/IssueCenterPage';

type Conversation = {
  id: string;
  owner_id: string; // auth.users.id
  owner_type: 'seller' | 'affiliate';
  customer_id: string; // auth.users.id
  store_name: string | null;
  created_at: string;
  updated_at: string;
};

type StoreMessage = {
  id: string;
  conversation_id: string;
  sender_id: string; // auth.users.id
  body: string;
  created_at: string;
};

type LegacyStoreMessage = {
  id: string;
  store_owner_id: string;
  store_type: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type SupportThread = {
  id: string;
  customer_id: string; // auth.users.id
  subject: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type SupportMessage = {
  id: string;
  thread_id: string;
  sender_id: string; // auth.users.id
  body: string;
  created_at: string;
};

type Announcement = {
  id: string;
  sender_id: string; // auth.users.id
  title: string;
  body: string;
  created_at: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutHandle: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) window.clearTimeout(timeoutHandle);
  }
};

interface UniversalInboxProps {
  embedded?: boolean;
}

const UniversalInbox: React.FC<UniversalInboxProps> = ({ embedded = false }) => {
  const PLATFORM_SUPPORT_EMAIL = 'mail@beezio.co';
  const { profile, user, hasRole } = useAuth();

  const isDev = Boolean(import.meta.env.DEV);

  const isAdmin = Boolean(
    hasRole?.('admin') || String((profile as any)?.primary_role || (profile as any)?.role || '').toLowerCase() === 'admin'
  );
  const selfUserId = user?.id || '';

  const [tab, setTab] = useState<'store' | 'support' | 'announcements' | 'broadcast' | 'direct' | 'disputes'>('store');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [namesByUserId, setNamesByUserId] = useState<Record<string, string>>({});

  // Store messages
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [participantsByConversation, setParticipantsByConversation] = useState<Record<string, { last_read_at: string | null }>>({});
  const [storeUnreadCount, setStoreUnreadCount] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoreMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [useLegacyStoreMessaging, setUseLegacyStoreMessaging] = useState(false);
  const [legacyMessages, setLegacyMessages] = useState<LegacyStoreMessage[]>([]);

  // Support
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [activeSupportThreadId, setActiveSupportThreadId] = useState<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDraft, setSupportDraft] = useState('');

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementReads, setAnnouncementReads] = useState<Record<string, boolean>>({});
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);

  // Admin composer
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [directEmail, setDirectEmail] = useState('');
  const [directSubject, setDirectSubject] = useState('Message from Beezio');
  const [directBody, setDirectBody] = useState('');

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const otherPartyId = useMemo(() => {
    if (!activeConversation || !selfUserId) return null;
    return activeConversation.owner_id === selfUserId ? activeConversation.customer_id : activeConversation.owner_id;
  }, [activeConversation, selfUserId]);

  const otherPartyName = otherPartyId ? namesByUserId[otherPartyId] || 'User' : 'User';

  const isUnread = (c: Conversation) => {
    const marker = participantsByConversation[c.id]?.last_read_at;
    if (!marker) return true;
    return new Date(c.updated_at).getTime() > new Date(marker).getTime();
  };

  const loadUserNames = async (userIds: string[]) => {
    const unique = Array.from(new Set(userIds)).filter(Boolean);
    if (unique.length === 0) return;
    const { data } = await supabase.from('profiles').select('user_id, full_name').in('user_id', unique);
    const next: Record<string, string> = {};
    for (const p of (data as any[]) || []) {
      if (p?.user_id) next[String(p.user_id)] = String(p.full_name || 'User');
    }
    setNamesByUserId((prev) => ({ ...prev, ...next }));
  };

  const refreshLegacyStoreMessages = async () => {
    if (!profile?.id && !selfUserId) return;
    setLoading(true);
    setError(null);
    try {
      const ownerId = String(profile?.id || selfUserId);
      const { data, error } = await withTimeout(
        supabase
          .from('store_messages')
          .select('id, store_owner_id, store_type, sender_name, sender_email, subject, message, status, created_at, updated_at')
          .eq('store_owner_id', ownerId)
          .order('created_at', { ascending: false }),
        12000,
        'load legacy store messages'
      );
      if (error) throw error;
      const rows = (data as LegacyStoreMessage[]) || [];
      setLegacyMessages(rows);
      setStoreUnreadCount(rows.filter((row) => String(row.status || '').toLowerCase() === 'unread').length);
    } catch (err) {
      console.error('[UniversalInbox] refreshLegacyStoreMessages failed:', err);
      setError('Unable to load store messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshConversations = async () => {
    if (!selfUserId) return;
    if (useLegacyStoreMessaging) {
      await refreshLegacyStoreMessages();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const baseQuery = supabase
        .from('store_conversations')
        .select('id, owner_id, owner_type, customer_id, store_name, created_at, updated_at')
        .order('updated_at', { ascending: false });
      const { data: convoRows, error: convoError } = await withTimeout(
        isAdmin
          ? baseQuery
          : baseQuery.or(`owner_id.eq.${selfUserId},customer_id.eq.${selfUserId}`),
        12000,
        'load conversations'
      );
      if (convoError) {
        const message = String((convoError as any)?.message || '');
        const code = String((convoError as any)?.code || '');
        if (code === '42P01' || /store_conversations/i.test(message)) {
          setUseLegacyStoreMessaging(true);
          await refreshLegacyStoreMessages();
          return;
        }
        throw convoError;
      }

      const convos = (convoRows as Conversation[]) || [];
      setUseLegacyStoreMessaging(false);
      setConversations(convos);
      if (!activeConversationId && convos[0]?.id) setActiveConversationId(convos[0].id);

      const convoIds = convos.map((c) => c.id);
      const { data: partRows } = await withTimeout(
        supabase
          .from('store_conversation_participants')
          .select('conversation_id, last_read_at')
          .eq('user_id', selfUserId)
          .in('conversation_id', convoIds),
        12000,
        'load conversation read markers'
      );
      const byId: Record<string, { last_read_at: string | null }> = {};
      for (const row of (partRows as any[]) || []) {
        byId[String(row.conversation_id)] = { last_read_at: row.last_read_at ? String(row.last_read_at) : null };
      }
      setParticipantsByConversation(byId);
      const unreadCount = convos.filter((c) => {
        const marker = byId[c.id]?.last_read_at;
        if (!marker) return !isAdmin;
        return new Date(c.updated_at).getTime() > new Date(marker).getTime();
      }).length;
      setStoreUnreadCount(unreadCount);

      const userIds: string[] = [];
      for (const c of convos) {
        userIds.push(c.owner_id, c.customer_id);
      }
      await loadUserNames(userIds);
    } catch (err) {
      console.error('[UniversalInbox] refreshConversations failed:', err);
      setError('Unable to load inbox. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    if (useLegacyStoreMessaging) return;
    const { data, error: msgError } = await withTimeout(
      supabase
        .from('store_messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      12000,
      'load store messages'
    );
    if (!msgError) setMessages((data as StoreMessage[]) || []);
    try {
      await supabase.functions.invoke('mark-store-conversation-read', { body: { conversationId } });
      await refreshConversations();
    } catch {
      try {
        await supabase
          .from('store_conversation_participants')
          .upsert(
            {
              conversation_id: conversationId,
              user_id: selfUserId,
              last_read_at: new Date().toISOString(),
            },
            { onConflict: 'conversation_id,user_id' }
          );
      } catch {
        // non-fatal
      }
    }
  };

  const sendStore = async () => {
    if (!activeConversationId) return;
    const body = String(draft || '').trim();
    if (!body) return;
    try {
      const { error: sendError } = await supabase.functions.invoke('send-store-message', {
        body: { conversationId: activeConversationId, body },
      });
      if (sendError) throw sendError;
      setDraft('');
      await loadMessages(activeConversationId);
      await refreshConversations();
    } catch (err) {
      try {
        const { error: insertError } = await supabase
          .from('store_messages')
          .insert({ conversation_id: activeConversationId, sender_id: selfUserId, body });
        if (insertError) throw insertError;
        setDraft('');
        await loadMessages(activeConversationId);
        await refreshConversations();
      } catch {
        setError('Unable to send message. Please try again.');
      }
    }
  };

  const refreshSupportThreads = async () => {
    if (!selfUserId) return;
    setLoading(true);
    setError(null);
    try {
      const baseQuery = supabase
        .from('support_threads')
        .select('id, customer_id, subject, status, created_at, updated_at')
        .order('updated_at', { ascending: false });
      const { data, error } = await withTimeout(
        isAdmin ? baseQuery : baseQuery.eq('customer_id', selfUserId),
        12000,
        'load support threads'
      );
      if (error) throw error;
      const rows = (data as SupportThread[]) || [];
      setSupportThreads(rows);
      if (!activeSupportThreadId && rows[0]?.id) setActiveSupportThreadId(rows[0].id);

      const ids = rows.map((t) => t.customer_id);
      await loadUserNames(ids);
      const threadIds = rows.map((t) => t.id);
      const { data: participantRows } = await withTimeout(
        supabase
          .from('support_thread_participants')
          .select('thread_id, last_read_at')
          .eq('user_id', selfUserId)
          .in('thread_id', threadIds),
        12000,
        'load support read markers'
      );
      const supportMarkers: Record<string, string | null> = {};
      for (const row of (participantRows as any[]) || []) {
        supportMarkers[String(row.thread_id)] = row.last_read_at ? String(row.last_read_at) : null;
      }
      const unreadCount = rows.filter((thread) => {
        const marker = supportMarkers[thread.id];
        if (!marker) return !isAdmin && thread.customer_id === selfUserId;
        return new Date(thread.updated_at).getTime() > new Date(marker).getTime();
      }).length;
      setSupportUnreadCount(unreadCount);
    } catch (err) {
      console.error('[UniversalInbox] refreshSupportThreads failed:', err);
      setError('Unable to load support inbox. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSupportMessages = async (threadId: string) => {
    const { data, error: msgError } = await withTimeout(
      supabase
        .from('support_messages')
        .select('id, thread_id, sender_id, body, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true }),
      12000,
      'load support messages'
    );
    if (!msgError) setSupportMessages((data as SupportMessage[]) || []);
    try {
      await supabase.functions.invoke('mark-support-thread-read', { body: { threadId } });
      await refreshSupportThreads();
    } catch {
      // non-fatal
    }
  };

  const createSupportThread = async () => {
    const subject = String(supportSubject || '').trim();
    const message = String(supportDraft || '').trim();
    if (!message) {
      setError('Please write your message.');
      return;
    }
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-support-thread', {
        body: { subject: subject || null, message },
      });
      if (fnError) throw fnError;
      const threadId = String((data as any)?.thread?.id || '');
      if (!threadId) throw new Error('Failed to create thread');
      setSupportSubject('');
      setSupportDraft('');
      setTab('support');
      await refreshSupportThreads();
      setActiveSupportThreadId(threadId);
    } catch {
      setError('Failed to contact support.');
    }
  };

  const sendSupport = async () => {
    if (!activeSupportThreadId) return;
    const body = String(supportDraft || '').trim();
    if (!body) return;
    try {
      const { error: sendError } = await supabase.functions.invoke('send-support-message', {
        body: { threadId: activeSupportThreadId, body },
      });
      if (sendError) throw sendError;
      setSupportDraft('');
      await loadSupportMessages(activeSupportThreadId);
      await refreshSupportThreads();
    } catch {
      setError('Failed to send support message.');
    }
  };

  const refreshAnnouncements = async () => {
    if (!selfUserId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('admin_announcements')
          .select('id, sender_id, title, body, starts_at, ends_at, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        12000,
        'load announcements'
      );
      if (error) throw error;
      const rows = (data as Announcement[]) || [];
      setAnnouncements(rows);

      const ids = rows.map((r) => String(r.id));
      const { data: reads } = await withTimeout(
        supabase
          .from('admin_announcement_reads')
          .select('announcement_id')
          .eq('user_id', selfUserId)
          .in('announcement_id', ids),
        12000,
        'load announcement reads'
      );
      const readMap: Record<string, boolean> = {};
      for (const r of (reads as any[]) || []) readMap[String(r.announcement_id)] = true;
      setAnnouncementReads(readMap);
      const unreadCount = rows.filter((row) => !readMap[String(row.id)]).length;
      setAnnouncementUnreadCount(unreadCount);
    } catch (err) {
      console.error('[UniversalInbox] refreshAnnouncements failed:', err);
      setError('Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  const markAnnouncementRead = async (announcementId: string) => {
    try {
      await supabase.functions.invoke('mark-announcement-read', { body: { announcementId } });
      setAnnouncementReads((prev) => ({ ...prev, [announcementId]: true }));
    } catch {
      // ignore
    }
  };

  const createBroadcast = async () => {
    if (!isAdmin) return;
    const title = String(broadcastTitle || '').trim();
    const body = String(broadcastBody || '').trim();
    if (!title || !body) {
      setError('Title and message are required.');
      return;
    }
    try {
      const { error: fnError } = await supabase.functions.invoke('admin-create-announcement', { body: { title, body } });
      if (fnError) throw fnError;
      setBroadcastTitle('');
      setBroadcastBody('');
      setTab('announcements');
      await refreshAnnouncements();
    } catch {
      setError('Failed to send announcement.');
    }
  };

  const sendDirect = async () => {
    if (!isAdmin) return;
    const email = String(directEmail || '').trim();
    const subject = String(directSubject || '').trim();
    const body = String(directBody || '').trim();
    if (!email || !body) {
      setError('Recipient email and message are required.');
      return;
    }
    try {
      const { error: fnError } = await supabase.functions.invoke('admin-send-direct-message', { body: { email, subject, body } });
      if (fnError) throw fnError;
      setDirectEmail('');
      setDirectBody('');
      setTab('support');
      await refreshSupportThreads();
    } catch {
      setError('Failed to send direct message.');
    }
  };

  useEffect(() => {
    if (!selfUserId) {
      setLoading(false);
      return;
    }
    if (tab === 'store') void refreshConversations();
    if (tab === 'support') void refreshSupportThreads();
    if (tab === 'announcements') void refreshAnnouncements();
    if (tab === 'broadcast') setLoading(false);
    if (tab === 'direct') setLoading(false);
    if (tab === 'disputes') setLoading(false);
  }, [selfUserId, tab]);

  useEffect(() => {
    if (!selfUserId) return;
    const interval = setInterval(() => {
      void refreshConversations();
      void refreshSupportThreads();
      void refreshAnnouncements();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selfUserId]);

  useEffect(() => {
    if (tab !== 'store') return;
    if (useLegacyStoreMessaging) return;
    if (!activeConversationId) return;
    void loadMessages(activeConversationId);
  }, [activeConversationId, tab, useLegacyStoreMessaging]);

  useEffect(() => {
    if (tab !== 'support') return;
    if (!activeSupportThreadId) return;
    void loadSupportMessages(activeSupportThreadId);
  }, [activeSupportThreadId, tab]);

  const outerClass = embedded ? 'w-full' : 'min-h-screen bg-gray-50';
  const innerClass = embedded ? 'w-full' : 'max-w-6xl mx-auto px-4 py-8';

  return (
    <div className={outerClass}>
      {!embedded && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
            <p className="text-gray-600">
              All communication stays inside Beezio (logged and auditable). Support email: {PLATFORM_SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      )}

      <div className={innerClass}>
        {embedded && (
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Inbox</h2>
            <p className="text-sm text-gray-600">
              Store, support, and platform messages in one place. Support email: {PLATFORM_SUPPORT_EMAIL}.
            </p>
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('store')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
              tab === 'store' ? 'bg-black text-white border-black' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {isAdmin ? 'All Store Conversations' : 'Store Messages'}
            {storeUnreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold px-2">
                {storeUnreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('support')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
              tab === 'support' ? 'bg-black text-white border-black' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Beezio Support
            {supportUnreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold px-2">
                {supportUnreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('announcements')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
              tab === 'announcements'
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Announcements
            {announcementUnreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold px-2">
                {announcementUnreadCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setTab('broadcast')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                  tab === 'broadcast'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Admin Broadcast
              </button>
              <button
                onClick={() => setTab('direct')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                  tab === 'direct' ? 'bg-black text-white border-black' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Admin Direct Message
              </button>
              <button
                onClick={() => setTab('disputes')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                  tab === 'disputes' ? 'bg-black text-white border-black' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Disputes
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">{error}</div>
        ) : tab === 'disputes' ? (
          <IssueCenterPage embedded />
        ) : tab === 'broadcast' ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="text-xl font-bold text-gray-900">Send site-wide announcement</div>
            <div className="text-sm text-gray-600 mt-1">All users will see this in Announcements.</div>
            <div className="mt-4 space-y-3">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Title"
              />
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder="Message"
                rows={6}
              />
              <button onClick={createBroadcast} className="w-full px-4 py-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-800">
                Send announcement
              </button>

              {(isAdmin || isDev) && (
                <Link
                  to="/messaging-smoke"
                  className="ml-auto px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  Smoke Test
                </Link>
              )}
            </div>
          </div>
        ) : tab === 'direct' ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="text-xl font-bold text-gray-900">Send a direct message</div>
            <div className="text-sm text-gray-600 mt-1">Creates a support thread with the user (auditable).</div>
            <div className="mt-4 space-y-3">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={directEmail}
                onChange={(e) => setDirectEmail(e.target.value)}
                placeholder="User email"
              />
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={directSubject}
                onChange={(e) => setDirectSubject(e.target.value)}
                placeholder="Subject"
              />
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={directBody}
                onChange={(e) => setDirectBody(e.target.value)}
                placeholder="Message"
                rows={6}
              />
              <button onClick={sendDirect} className="w-full px-4 py-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-800">
                Send direct message
              </button>
            </div>
          </div>
        ) : tab === 'announcements' ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-900">Announcements</div>
            {announcements.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">No announcements yet.</div>
            ) : (
              <div className="divide-y">
                {announcements.map((a) => {
                  const read = Boolean(announcementReads[a.id]);
                  return (
                    <button key={a.id} onClick={() => markAnnouncementRead(a.id)} className="w-full text-left px-4 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-900">{a.title}</div>
                        {!read && <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">New</span>}
                      </div>
                      <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{a.body}</div>
                      <div className="mt-2 text-xs text-gray-500">{formatDateTime(a.created_at)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === 'support' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-900">
                {isAdmin ? 'All Support Threads' : 'Your Support Threads'}
              </div>
              <div className="divide-y">
                {supportThreads.map((t) => {
                  const active = t.id === activeSupportThreadId;
                  const title = t.subject || 'Support';
                  const subtitle = isAdmin ? `Customer: ${namesByUserId[t.customer_id] || t.customer_id}` : '';
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveSupportThreadId(t.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${active ? 'bg-amber-50' : ''}`}
                    >
                      <div className="font-semibold text-gray-900">{title}</div>
                      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
                      <div className="mt-1 text-xs text-gray-500">{formatDateTime(t.updated_at)}</div>
                    </button>
                  );
                })}
                {supportThreads.length === 0 && (
                  <div className="p-4 text-sm text-gray-600">
                    No support threads yet.
                    {!isAdmin && (
                      <div className="mt-3">
                        <div className="font-semibold text-gray-900">Start a new message</div>
                        <input
                          className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
                          value={supportSubject}
                          onChange={(e) => setSupportSubject(e.target.value)}
                          placeholder="Subject (optional)"
                        />
                        <textarea
                          className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
                          value={supportDraft}
                          onChange={(e) => setSupportDraft(e.target.value)}
                          placeholder="Describe the issue…"
                          rows={4}
                        />
                        <button
                          onClick={createSupportThread}
                          className="mt-2 w-full px-4 py-2 text-sm rounded-lg bg-black text-white font-semibold hover:bg-gray-800"
                        >
                          Send to Support
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="font-semibold text-gray-900">Beezio Support</div>
                <div className="text-xs text-gray-500">Beezio can review the full message history to resolve disputes.</div>
              </div>

              <div className="p-4 h-[420px] overflow-y-auto bg-gray-50">
                {!activeSupportThreadId ? (
                  <div className="text-sm text-gray-600">Select a thread.</div>
                ) : supportMessages.length === 0 ? (
                  <div className="text-sm text-gray-600">No messages yet.</div>
                ) : (
                  <div className="space-y-2">
                    {supportMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.sender_id === selfUserId ? 'ml-auto bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        {m.body}
                        <div className={`mt-1 text-[11px] ${m.sender_id === selfUserId ? 'text-gray-300' : 'text-gray-500'}`}>
                          {formatDateTime(m.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t bg-white flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  value={supportDraft}
                  onChange={(e) => setSupportDraft(e.target.value)}
                  placeholder={activeSupportThreadId ? 'Write a reply...' : 'Select a thread'}
                  disabled={!activeSupportThreadId}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendSupport();
                    }
                  }}
                />
                <button
                  onClick={() => void sendSupport()}
                  disabled={!activeSupportThreadId}
                  className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : tab === 'store' && useLegacyStoreMessaging ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="font-semibold text-gray-900">Store Messages</div>
              <div className="text-xs text-gray-500">Legacy inbox mode. Replies are handled by email.</div>
            </div>
            {legacyMessages.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">No messages yet.</div>
            ) : (
              <div className="divide-y">
                {legacyMessages.map((msg) => (
                  <div key={msg.id} className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-gray-900">{msg.subject || 'Store message'}</div>
                      <span className="text-xs text-gray-500">{formatDateTime(msg.created_at)}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{msg.message}</div>
                    <div className="mt-3 text-xs text-gray-500">
                      From {msg.sender_name || 'Customer'} ({msg.sender_email || 'no email'})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No messages yet</h2>
            <p className="text-gray-600">When customers message a store, conversations will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-900">Conversations</div>
              <div className="divide-y">
                {conversations.map((c) => {
                  const active = c.id === activeConversationId;
                  const otherId = c.owner_id === selfUserId ? c.customer_id : c.owner_id;
                  const title = c.store_name ? `${c.store_name}` : otherId;
                  const subtitle = namesByUserId[otherId] ? `with ${namesByUserId[otherId]}` : '';
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveConversationId(c.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${active ? 'bg-amber-50' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{title}</div>
                          <div className="text-xs text-gray-500">{subtitle}</div>
                        </div>
                        {isUnread(c) && <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">New</span>}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">{formatDateTime(c.updated_at)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="font-semibold text-gray-900">{activeConversation?.store_name || 'Conversation'}</div>
                <div className="text-xs text-gray-500">{otherPartyId ? `Chat with ${otherPartyName}` : ''}</div>
              </div>

              <div className="p-4 h-[420px] overflow-y-auto bg-gray-50">
                {messages.length === 0 ? (
                  <div className="text-sm text-gray-600">No messages yet.</div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.sender_id === selfUserId ? 'ml-auto bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        {m.body}
                        <div className={`mt-1 text-[11px] ${m.sender_id === selfUserId ? 'text-gray-300' : 'text-gray-500'}`}>
                          {formatDateTime(m.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t bg-white flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={activeConversationId ? 'Write a reply...' : 'Select a conversation'}
                  disabled={!activeConversationId}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendStore();
                    }
                  }}
                />
                <button
                  onClick={() => void sendStore()}
                  disabled={!activeConversationId}
                  className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalInbox;
