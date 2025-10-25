import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle, Users, Briefcase, Megaphone, HelpCircle } from 'lucide-react';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    department: 'support'
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Form submitted:', formData);
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const contactInfo = [
    {
      department: 'Support',
      email: 'support@beezio.co',
      description: 'Get help with your account, technical issues, or general questions about using Beezio.',
      icon: HelpCircle,
      color: 'blue'
    },
    {
      department: 'Sales',
      email: 'sales@beezio.co',
      description: 'Interested in enterprise solutions, custom integrations, or bulk licensing? Our sales team can help.',
      icon: Briefcase,
      color: 'green'
    },
    {
      department: 'Affiliates',
      email: 'affiliates@beezio.co',
      description: 'Questions about affiliate programs, commission structures, or partnership opportunities.',
      icon: Users,
      color: 'purple'
    },
    {
      department: 'Press & Media',
      email: 'press@beezio.co',
      description: 'Media inquiries, press releases, company information, and interview requests.',
      icon: Megaphone,
      color: 'orange'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      orange: 'bg-orange-100 text-orange-600 border-orange-200'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getIconColorClasses = (color: string) => {
    const colors = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600',
      orange: 'text-orange-600'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto">
              We're here to help you succeed. Whether you're a seller, affiliate, or buyer, 
              our team is ready to support your journey.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
          
          {/* Contact Information */}
          <div className="lg:col-span-2">
            <div className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8">Get in Touch</h2>
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                {contactInfo.map((contact, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                      <div className={`p-3 rounded-lg flex-shrink-0 ${contact.color === 'blue' ? 'bg-blue-100' : contact.color === 'green' ? 'bg-green-100' : contact.color === 'purple' ? 'bg-purple-100' : 'bg-orange-100'}`}>
                        <contact.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${getIconColorClasses(contact.color)}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{contact.department}</h3>
                        <p className="text-gray-600 text-xs sm:text-sm mb-3">{contact.description}</p>
                        <a 
                          href={`mailto:${contact.email}`}
                          className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium border transition-colors hover:opacity-80 ${getColorClasses(contact.color)}`}
                        >
                          <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="break-all">{contact.email}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Send us a Message</h3>
              
              {isSubmitted && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-800">Thank you! Your message has been sent. We'll get back to you soon.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="support">Support</option>
                    <option value="sales">Sales</option>
                    <option value="affiliates">Affiliates</option>
                    <option value="press">Press & Media</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Brief description of your inquiry"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    value={formData.message}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Please provide as much detail as possible..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitted}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitted ? 'Message Sent!' : 'Send Message'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Company Information Sidebar */}
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-900 font-medium">Headquarters</p>
                    <p className="text-gray-600 text-sm">United States</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-900 font-medium">Business Hours</p>
                    <p className="text-gray-600 text-sm">Mon - Fri: 9:00 AM - 6:00 PM EST</p>
                    <p className="text-gray-600 text-sm">Sat - Sun: Emergency support only</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-900 font-medium">General Inquiries</p>
                    <p className="text-gray-600 text-sm">info@beezio.co</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Need Immediate Help?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Check out our comprehensive help center with guides, tutorials, and FAQs.
              </p>
              <a 
                href="/help" 
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Visit Help Center
              </a>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Response Times</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Support inquiries:</span>
                  <span className="text-gray-900 font-medium">24-48 hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sales inquiries:</span>
                  <span className="text-gray-900 font-medium">Same day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Press inquiries:</span>
                  <span className="text-gray-900 font-medium">24 hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Partnership inquiries:</span>
                  <span className="text-gray-900 font-medium">2-3 business days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
