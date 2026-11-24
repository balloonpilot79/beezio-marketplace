export const SIGNUP_GUIDE_LAUNCHED_AT = Date.parse('2026-11-24T21:14:00Z');
export const WELCOME_SUPPORT = 'support@beezio.co';

export type SignupGuideAudience = 'business' | 'shopper';

type WelcomeStep = {
  heading: string;
  instructions: string[];
  action: string;
  path: string;
  image?: string;
};

const ambassadorInstructions = [
  'Copy your personal invite link and share it with shoppers, sellers, or affiliates. They choose the account type they want when they join through your link.',
  'Earn referral rewards when people you referred make qualifying purchases or sales. You can refer people without carrying inventory or opening a store. Check your referral activity in your account.',
  'Let people know you may earn rewards when you share an invite link.',
];

const shop: WelcomeStep = {
  heading: 'Shop the Beezio Marketplace',
  instructions: [
    'Search by product name or browse by category. Open a listing to check what is included, the price, and any shipping or download details.',
    'Add items to your cart and check out through Beezio.',
  ],
  action: 'Browse the Marketplace',
  path: '/marketplace',
};

const orders: WelcomeStep = {
  heading: 'Manage your purchases',
  instructions: [
    'Open Orders in your account to find purchase details, shipping updates when available, and links to eligible digital downloads after payment is verified.',
    'For help with an order, send Beezio Support your order number and a description of the issue.',
  ],
  action: 'Open Orders',
  path: '/account?tab=orders',
};

export const signupWelcomeGuides: Record<SignupGuideAudience, {
  subject: string;
  intro: string;
  dashboard: string;
  steps: WelcomeStep[];
}> = {
  shopper: {
    subject: 'Welcome to Beezio | Your Shopper Account guide',
    intro: 'Use your free Shopper Account to shop Beezio, manage your purchases, and invite people through the Ambassador Program.',
    dashboard: '/account',
    steps: [
      {
        heading: 'Earn as a Beezio Ambassador',
        instructions: ['Open Refer & Earn in your account.', ...ambassadorInstructions],
        action: 'Open Refer & Earn',
        path: '/account?tab=ambassador',
      },
      shop,
      orders,
      {
        heading: 'Want to sell or promote products?',
        instructions: [
          'A free Business Account adds Seller and Affiliate tools. Sellers list their own products. Affiliates promote eligible products from other Beezio sellers and can earn a commission on sales credited to them.',
        ],
        action: 'Explore the Affiliate Program',
        path: '/affiliates',
      },
    ],
  },
  business: {
    subject: 'Welcome to Beezio | Your Business Account guide',
    intro: 'Your free Business Account includes Seller, Affiliate, and Ambassador tools. You can use all three from the same account and shop the Marketplace too.',
    dashboard: '/business',
    steps: [
      {
        heading: 'Earn as a Beezio Ambassador',
        instructions: ['Open your invite tools in the Business Center.', ...ambassadorInstructions],
        action: 'Open Ambassador Invite Tools',
        path: '/business/invites',
        image: '08-invites.jpg',
      },
      {
        heading: 'Earn as a Beezio Affiliate',
        instructions: [
          'In the Marketplace, switch to Business tools. Find an eligible product, review the commission set by its seller, and choose Add to My Store when available.',
          'Open the promotion tools, select a product, and copy its tracked link. Include the link alongside any graphics or QR codes you share, and disclose that you may earn a commission.',
          'You earn the listed commission on qualifying sales credited to you. The original seller handles fulfillment.',
        ],
        action: 'Find products to promote',
        path: '/marketplace?view=business',
        image: '06-marketplace.jpg',
      },
      {
        heading: 'Sell your own products',
        instructions: [
          'In the Business Center, select Add product. Choose Physical Product or Digital Download, then enter a title, description, category, images, and the amount you want to receive.',
          'Set inventory, shipping, and variants for physical items as applicable. For a digital product, upload the file buyers receive once payment is verified.',
          'To let affiliates promote your listing, enable affiliate promotion and enter the flat commission you want to offer per item. Review the customer price, then save your product.',
        ],
        action: 'Add a product',
        path: '/business/products/add',
        image: '03-listing.jpg',
      },
      {
        heading: 'Set up and share your free storefront',
        instructions: [
          'Choose Customize My Store to set your store name, add a logo or banner, and choose your colors. Save and preview your storefront before sharing its link.',
          'You can display your own listings and eligible products you promote in the same storefront.',
        ],
        action: 'Customize My Store',
        path: '/store-builder',
        image: '02-store.jpg',
      },
      {
        heading: 'Manage orders, earnings, and payouts',
        instructions: [
          'Use Orders in the Business Center to manage your own sales. For physical items, fulfill the order and add tracking when available.',
          'Open Financials to see credited earnings, pending amounts, and payout requirements for your business activity.',
        ],
        action: 'Open Financials',
        path: '/business?tab=financials',
        image: '09-save.jpg',
      },
      shop,
      orders,
    ],
  },
};
