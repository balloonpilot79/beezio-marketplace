import React, { useState } from 'react';
import { Copy, Check, Sparkles, Heart, ShoppingBag, Star, Zap } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  images: string[];
  commission_rate: number;
}

interface SocialMediaTemplatesProps {
  product: Product;
  affiliateCode?: string;
  onClose?: () => void;
}

interface Template {
  platform: string;
  icon: React.ComponentType<any>;
  color: string;
  templates: {
    name: string;
    text: string;
    hashtags: string[];
  }[];
}

const SocialMediaTemplates: React.FC<SocialMediaTemplatesProps> = ({
  product,
  affiliateCode,
  onClose
}) => {
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Instagram');

  const productUrl = affiliateCode
    ? `${window.location.origin}/product/${product.id}?ref=${affiliateCode}`
    : `${window.location.origin}/product/${product.id}`;

  const commissionText = product.commission_rate > 0
    ? `💰 Earn ${product.commission_rate}% commission! `
    : '';

  const templates: Template[] = [
    {
      platform: 'Instagram',
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      color: 'from-purple-500 via-pink-500 to-orange-500',
      templates: [
        {
          name: 'Product Showcase',
          text: `✨ Just discovered this amazing ${product.title}! Perfect for anyone looking to upgrade their collection. ${commissionText}Link in bio to shop! 🛍️\n\n${product.description?.slice(0, 100)}...`,
          hashtags: ['shopping', 'deals', 'musthave', 'affiliate', 'recommendation']
        },
        {
          name: 'Value Proposition',
          text: `💎 Why I love this ${product.title}:\n\n✅ Premium quality\n✅ Great value at $${product.price}\n✅ Trusted seller\n\n${commissionText}Ready to treat yourself? Link in bio! 🌟`,
          hashtags: ['luxury', 'quality', 'value', 'shopping', 'affiliate']
        },
        {
          name: 'Urgency Post',
          text: `⏰ Limited time offer on this incredible ${product.title}! Don't miss out on this deal at $${product.price}. ${commissionText}Link in bio to grab yours before it's gone! 🚀`,
          hashtags: ['limitedtime', 'deal', 'shopping', 'affiliate', 'flashsale']
        }
      ]
    },
    {
      platform: 'TikTok',
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ),
      color: 'from-black to-gray-800',
      templates: [
        {
          name: 'Unboxing Style',
          text: `POV: You just got this ${product.title} in the mail! 📦✨\n\nUnboxing this amazing product that retails for $${product.price}... worth every penny! ${commissionText}\n\nLink in bio to get yours! 🛍️ #unboxing #shoppinghaul`,
          hashtags: ['unboxing', 'shoppinghaul', 'productreview', 'affiliate', 'musthave']
        },
        {
          name: 'Quick Review',
          text: `Real talk about this ${product.title}... 🤔\n\nPros: Amazing quality, great price!\nCons: None that I can think of! 😍\n\nRating: ⭐⭐⭐⭐⭐\n\n${commissionText}Link in bio if you want one! 💫`,
          hashtags: ['productreview', 'honestreview', 'shopping', 'affiliate', 'recommendation']
        },
        {
          name: 'Lifestyle Integration',
          text: `How this ${product.title} changed my daily routine! 🌅\n\nBefore: Struggling without it\nAfter: Life is so much easier! ✨\n\n${commissionText}Transform your routine too - link in bio! 🚀`,
          hashtags: ['lifestyle', 'transformation', 'dailyroutine', 'affiliate', 'lifehack']
        }
      ]
    },
    {
      platform: 'Twitter',
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
        </svg>
      ),
      color: 'from-blue-400 to-blue-600',
      templates: [
        {
          name: 'Quick Deal',
          text: `🚨 HOT DEAL ALERT! 🚨\n\nGet this ${product.title} for only $${product.price}! ${commissionText}\n\nLink: ${productUrl}\n\n#deal #shopping #affiliate`,
          hashtags: ['deal', 'shopping', 'affiliate', 'bargain', 'musthave']
        },
        {
          name: 'Expert Recommendation',
          text: `As someone who's tried hundreds of products, this ${product.title} is genuinely impressive. Quality, value, and results - it delivers on all fronts. ${commissionText}\n\nWorth every penny! 💯\n\n${productUrl}`,
          hashtags: ['recommendation', 'productreview', 'quality', 'affiliate', 'shopping']
        },
        {
          name: 'Community Question',
          text: `Who else needs this ${product.title} in their life? 🙋‍♀️\n\nI've been using it for weeks and it's been a game-changer! ${commissionText}\n\nLink: ${productUrl}\n\n#shopping #productivity #affiliate`,
          hashtags: ['community', 'shopping', 'productivity', 'affiliate', 'gamechanger']
        }
      ]
    },
    {
      platform: 'Facebook',
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      color: 'from-blue-600 to-blue-800',
      templates: [
        {
          name: 'Storytelling',
          text: `Let me tell you about this ${product.title} that completely exceeded my expectations! 📖✨\n\nI was skeptical at first, but after using it for just a few days, I was blown away by the quality and how well it works. At $${product.price}, it's an absolute steal!\n\n${commissionText}If you're in the market for something like this, I highly recommend checking it out. Link in comments! 👇`,
          hashtags: ['storytime', 'productreview', 'recommendation', 'affiliate', 'shopping']
        },
        {
          name: 'Group Recommendation',
          text: `Sharing this ${product.title} with all my fellow [niche] enthusiasts! 🎯\n\nIf you're serious about [benefit], this is exactly what you need. Premium quality, reliable performance, and excellent value at $${product.price}.\n\n${commissionText}DM me for the link or check my bio! 💪`,
          hashtags: ['community', 'recommendation', 'niche', 'affiliate', 'quality']
        },
        {
          name: 'Personal Experience',
          text: `My honest thoughts on the ${product.title} after a month of use: 🤔\n\nWhat I loved:\n✅ [Positive point 1]\n✅ [Positive point 2]\n✅ [Positive point 3]\n\nWhat could be better:\n⚠️ [Minor criticism if any]\n\nOverall rating: ⭐⭐⭐⭐⭐\n\n${commissionText}Link in bio if you're interested! 🌟`,
          hashtags: ['honestreview', 'productreview', 'experience', 'affiliate', 'rating']
        }
      ]
    }
  ];

  const copyToClipboard = async (text: string, templateName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTemplate(templateName);
      setTimeout(() => setCopiedTemplate(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const selectedTemplateData = templates.find(t => t.platform === selectedPlatform);

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-6 h-6 text-purple-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Social Media Templates</h2>
            <p className="text-sm text-gray-600">Ready-to-use posts for {product.title}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Platform Selection */}
      <div className="p-6 border-b">
        <div className="flex space-x-2 overflow-x-auto">
          {templates.map((template) => (
            <button
              key={template.platform}
              onClick={() => setSelectedPlatform(template.platform)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                selectedPlatform === template.platform
                  ? `bg-gradient-to-r ${template.color} text-white`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <template.icon />
              <span className="font-medium">{template.platform}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div className="p-6 max-h-96 overflow-y-auto">
        <div className="space-y-4">
          {selectedTemplateData?.templates.map((template, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                <button
                  onClick={() => copyToClipboard(template.text, `${selectedPlatform}-${index}`)}
                  className={`flex items-center space-x-1 px-3 py-1 rounded text-sm transition-all ${
                    copiedTemplate === `${selectedPlatform}-${index}`
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copiedTemplate === `${selectedPlatform}-${index}` ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-gray-50 rounded p-3 mb-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{template.text}</p>
              </div>

              <div className="flex flex-wrap gap-1">
                {template.hashtags.map((hashtag, hashtagIndex) => (
                  <span
                    key={hashtagIndex}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                  >
                    #{hashtag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 bg-gray-50 border-t">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <p>💡 <strong>Pro tip:</strong> Customize these templates with your personal touch for better engagement!</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Product: {product.title}</p>
            <p>Price: ${product.price}</p>
            {product.commission_rate > 0 && (
              <p>Commission: {product.commission_rate}%</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialMediaTemplates;