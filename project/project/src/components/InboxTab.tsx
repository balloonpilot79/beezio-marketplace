import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

const InboxTab: React.FC = () => {
  const { profile, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const isAdmin = profile?.role === 'admin' || profile?.primary_role === 'admin';
  const ownerId = profile?.id || user?.id || '';

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        let query = supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new');
        if (!isAdmin) {
          query = query.eq('owner_id', ownerId);
        }
        const { count, error } = await query;

        let storeUnread = 0;
        try {
          const { data: unreadData, error: unreadError } = await supabase.rpc('get_store_inbox_unread_count');
          if (!unreadError && typeof unreadData === 'number') {
            storeUnread = unreadData;
          }
        } catch {
          storeUnread = 0;
        }

        if (!error && typeof count === 'number') setUnreadCount(count + storeUnread);
      } catch {
        setUnreadCount(0);
      }
    };
    fetchUnread();
  }, [ownerId, isAdmin]);

  return (
    <Link to="/dashboard/inbox" className="block rounded-lg px-3 py-2 text-sm font-medium relative">
      Inbox
      {unreadCount > 0 && (
        <span className="absolute top-1 right-2 bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
          {unreadCount}
        </span>
      )}
    </Link>
  );
};

export default InboxTab;
