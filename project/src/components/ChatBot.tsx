import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, User, Bot } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

// Sample initial messages
const INITIAL_MESSAGES = [
  {
    id: '1',
    text: 'Hi there! 👋 Welcome to Beezio support. How can I help you today?',
    sender: 'bot',
    timestamp: new Date().toISOString(),
  },
];

// Sample FAQ responses
const FAQ_RESPONSES: Record<string, string> = {
  'affiliate': 'As an affiliate, you earn commission on products you promote. You can share your site-wide affiliate link or create product-specific links. When someone makes a purchase using your link, you earn the commission rate set for that product.',
  'seller': "Sellers can list products on our marketplace, set prices, and choose commission rates for affiliates. You will need to connect a Stripe account to receive payments.",
  'commission': 'Commission rates are set by sellers for each product. Affiliates earn this percentage or flat rate on each sale made through their affiliate link.',
  'payment': 'We process payments through Stripe. Sellers receive payments after fees and affiliate commissions are deducted. Affiliates receive commission payouts on a monthly basis.',
  'subscription': 'Subscription products can be weekly or monthly. Affiliates earn recurring commissions for as long as the subscription remains active.',
  'sign up': 'To sign up, click the "Login" button in the header and then choose "Register" in the modal that appears.',
  'qr code': 'QR codes are generated for your store links and affiliate links. You can download these and print them on business cards or marketing materials.',
  'stripe': "You will need to connect your Stripe account to receive payments. Go to your dashboard and click on \"Connect Stripe\" to get started.",
  'help': 'I can help with questions about affiliate marketing, selling products, subscriptions, payments, and using our platform. Just ask away!',
};

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { profile } = useAuth();

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      (messagesEndRef.current as HTMLDivElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // When chat opens, log this in analytics
  useEffect(() => {
    if (isOpen) {
      // Log chat opened in analytics
      const logChatOpened = async () => {
        if (profile) {
          await supabase.from('chat_logs').insert({
            user_id: profile.id,
            event: 'chat_opened',
            metadata: { user_role: profile.role }
          });
        } else {
          await supabase.from('chat_logs').insert({
            event: 'chat_opened',
            metadata: { user_role: 'guest' }
          });
        }
      };
      
      logChatOpened().catch(console.error);
    }
  }, [isOpen, profile]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    // Add user message to chat
    const userMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);
    
    // Simulate typing indicator
    setTimeout(() => processUserMessage(inputMessage), 1000);
  };

  const processUserMessage = async (message: string) => {
    let botResponse = "I'm not sure how to help with that. Would you like to talk to a human agent?";
    
    // Simple keyword matching for FAQ
    const lowerMsg = message.toLowerCase();
    
    for (const [keyword, response] of Object.entries(FAQ_RESPONSES)) {
      if (lowerMsg.includes(keyword.toLowerCase())) {
        botResponse = response;
        break;
      }
    }
    
    // Special cases for user role-specific questions
    if (profile && lowerMsg.includes('my account')) {
      botResponse = `Your account is set up as a ${profile.role}. You can access your ${profile.role} dashboard to manage your activities.`;
    }
    
    // Add bot response to chat
    const botMessage = {
      id: Date.now().toString(),
      text: botResponse,
      sender: 'bot',
      timestamp: new Date().toISOString(),
    };
    
    setIsTyping(false);
    setMessages(prev => [...prev, botMessage]);
    
    // Log this interaction
    if (profile) {
      await supabase.from('chat_logs').insert({
        user_id: profile.id,
        event: 'message_exchange',
        metadata: { 
          user_message: message,
          bot_response: botResponse,
          user_role: profile.role
        }
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center justify-center p-4 rounded-full shadow-lg ${
          isOpen ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
        } transition-colors`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 h-96 bg-white rounded-lg shadow-xl flex flex-col">
          {/* Chat Header */}
          <div className="bg-amber-500 text-white p-4 rounded-t-lg">
            <h3 className="font-bold">Beezio Support</h3>
            <p className="text-xs opacity-80">We typically reply within a few minutes</p>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-amber-500 text-white rounded-tr-none'
                      : 'bg-gray-200 text-gray-800 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center mb-1 space-x-2">
                    {message.sender === 'user' ? (
                      <User size={14} className="text-white" />
                    ) : (
                      <Bot size={14} className="text-gray-800" />
                    )}
                    <span className="text-xs opacity-80">
                      {message.sender === 'user' ? 'You' : 'Support Bot'}
                    </span>
                  </div>
                  <p className="text-sm">{message.text}</p>
                  <span className="text-xs opacity-60 block text-right mt-1">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-800 rounded-lg rounded-tl-none p-3 max-w-[80%]">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t p-3 flex items-center">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="ml-2 bg-amber-500 text-white p-2 rounded-full disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
