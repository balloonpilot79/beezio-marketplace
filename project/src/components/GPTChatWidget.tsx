import React, { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { callGPT } from '../lib/gptClient';

const GPTChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user' as const, content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const reply = await callGPT({
        mode: 'support_bot',
        messages: [
          ...messages,
          userMessage,
        ],
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I had an issue: ${err.message || err}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 mb-3 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="font-semibold text-sm">Beezio Support (GPT)</div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-gray-500">Ask about commissions, checkout, or how to add products.</div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block px-3 py-2 rounded-lg ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-3 flex items-center space-x-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
              placeholder="Ask Beezio…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">Chat with Beezio GPT</span>
        </button>
      )}
    </div>
  );
};

export default GPTChatWidget;
