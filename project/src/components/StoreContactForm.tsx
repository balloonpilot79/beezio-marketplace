import React, { useState } from 'react';
import { Send, Mail, User, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StoreContactFormProps {
  storeOwnerId: string;
  storeName: string;
  storeType: 'seller' | 'affiliate' | 'fundraiser';
  theme?: string;
}

const StoreContactForm: React.FC<StoreContactFormProps> = ({
  storeOwnerId,
  storeName,
  storeType,
  theme = 'modern'
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // Save message to database
      const { error: dbError } = await supabase
        .from('store_messages')
        .insert({
          store_owner_id: storeOwnerId,
          store_type: storeType,
          sender_name: formData.name,
          sender_email: formData.email,
          subject: formData.subject,
          message: formData.message,
          status: 'unread',
          created_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      // Optionally send email notification (if you have an edge function for this)
      try {
        await fetch('/.netlify/functions/contact-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: storeOwnerId,
            from: formData.email,
            subject: `${storeName} Contact: ${formData.subject}`,
            message: formData.message,
            senderName: formData.name
          })
        });
      } catch (emailError) {
        console.warn('Email notification failed:', emailError);
        // Don't fail the entire submission if email fails
      }

      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      console.error('Error submitting contact form:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const themeClasses = {
    modern: {
      container: 'bg-white shadow-xl rounded-2xl',
      input: 'border-gray-300 focus:border-amber-500 focus:ring-amber-500',
      button: 'bg-amber-500 hover:bg-amber-600 text-white',
      text: 'text-gray-700'
    },
    elegant: {
      container: 'bg-gray-50 shadow-lg rounded-lg border border-gray-200',
      input: 'border-gray-200 focus:border-purple-400 focus:ring-purple-400',
      button: 'bg-purple-600 hover:bg-purple-700 text-white',
      text: 'text-gray-600'
    },
    vibrant: {
      container: 'bg-gradient-to-br from-orange-50 to-pink-50 shadow-xl rounded-2xl',
      input: 'border-orange-300 focus:border-orange-500 focus:ring-orange-500',
      button: 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white',
      text: 'text-gray-700'
    },
    minimalist: {
      container: 'bg-white shadow-md rounded-lg border border-gray-100',
      input: 'border-gray-200 focus:border-gray-900 focus:ring-gray-900',
      button: 'bg-gray-900 hover:bg-gray-800 text-white',
      text: 'text-gray-600'
    }
  };

  const selectedTheme = themeClasses[theme as keyof typeof themeClasses] || themeClasses.modern;

  return (
    <div className={`p-8 ${selectedTheme.container}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact {storeName}</h2>
        <p className={`${selectedTheme.text}`}>
          Have a question about our products or services? Send us a message and we'll get back to you soon.
        </p>
      </div>

      {status === 'success' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-900">Message sent successfully!</p>
            <p className="text-sm text-green-700">We'll respond to your inquiry as soon as possible.</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Failed to send message</p>
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${selectedTheme.input}`}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${selectedTheme.input}`}
                placeholder="john@example.com"
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            Subject *
          </label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              id="subject"
              required
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${selectedTheme.input}`}
              placeholder="Product inquiry, shipping question, etc."
            />
          </div>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message *
          </label>
          <textarea
            id="message"
            required
            value={formData.message}
            onChange={(e) => handleChange('message', e.target.value)}
            rows={6}
            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none ${selectedTheme.input}`}
            placeholder="Tell us more about your inquiry..."
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${selectedTheme.button} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Send Message
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          By submitting this form, you agree to our privacy policy and terms of service.
        </p>
      </form>
    </div>
  );
};

export default StoreContactForm;
