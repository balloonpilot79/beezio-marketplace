import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface ChatLog {
  id: string;
  user_id: string;
  event: string;
  metadata: any;
  created_at: string;
  user?: {
    email: string;
    role: string;
  };
}

const ChatSupportDashboard: React.FC = () => {
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();
  
  useEffect(() => {
    if (profile?.role !== 'admin') return;
    
    const fetchChatLogs = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('chat_logs')
          .select(`
            *,
            profiles:user_id (
              email,
              role
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100);
          
        if (error) throw error;
        setChatLogs(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(`Failed to load chat logs: ${errorMessage}`);
        console.error('Error fetching chat logs:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchChatLogs();
    
    // Set up real-time subscription for new chat logs
    const subscription = supabase
      .channel('chat_logs_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_logs' 
      }, (payload) => {
        setChatLogs(prevLogs => [payload.new as ChatLog, ...prevLogs]);
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);
  
  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          Access denied. This page is only available to administrators.
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Chat Support Dashboard</h1>
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 p-4 rounded mb-4 h-24"></div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Chat Support Dashboard</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Chat Support Dashboard</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="text-blue-800 font-semibold">Total Conversations</h3>
            <p className="text-3xl font-bold">
              {chatLogs.filter(log => log.event === 'chat_opened').length}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <h3 className="text-green-800 font-semibold">Total Messages</h3>
            <p className="text-3xl font-bold">
              {chatLogs.filter(log => log.event === 'message_exchange').length}
            </p>
          </div>
          <div className="bg-amber-50 p-4 rounded">
            <h3 className="text-amber-800 font-semibold">Active Today</h3>
            <p className="text-3xl font-bold">
              {chatLogs.filter(log => {
                const today = new Date().toISOString().split('T')[0];
                const logDate = new Date(log.created_at).toISOString().split('T')[0];
                return logDate === today;
              }).length}
            </p>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold mb-4">Recent Chat Activity</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">Time</th>
                <th className="py-3 px-6 text-left">User</th>
                <th className="py-3 px-6 text-left">Event</th>
                <th className="py-3 px-6 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm">
              {chatLogs.map(log => (
                <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-6 text-left whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-6 text-left">
                    {log.user?.email || 'Guest'}
                    {log.user?.role && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        {log.user.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-left">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      log.event === 'chat_opened' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {log.event === 'chat_opened' ? 'Started Chat' : 'Message Exchange'}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-left">
                    {log.event === 'message_exchange' && log.metadata ? (
                      <div>
                        <div className="text-xs text-gray-500">User said:</div>
                        <div className="font-medium mb-1">{log.metadata.user_message}</div>
                        <div className="text-xs text-gray-500">Bot responded:</div>
                        <div>{log.metadata.bot_response}</div>
                      </div>
                    ) : (
                      <div>
                        {log.metadata?.user_role ? `User role: ${log.metadata.user_role}` : '-'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChatSupportDashboard;
