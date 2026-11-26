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
          'A free Business Account adds a customizable webstore and Seller and Affiliate tools. List your own products as a Seller, then add eligible products from other Beezio sellers as an Affiliate. You can show both in one webstore.',
          'You can also use your Ambassador invite link to bring new shoppers, sellers, and affiliates to Beezio. Each activity has its own way to earn on qualifying transactions.',
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
        instructions: ['Open your invite tools in the Business Center. The Ambassador Print Kit has cards and flyers with your personal seller signup QR code.', ...ambassadorInstructions],
        action: 'Open Ambassador Invite Tools',
        path: '/business/invites',
        image: '08-invites.jpg',
      },
      {
        heading: 'Earn as a Beezio Affiliate',
        instructions: [
          'Open the Marketplace and select Business tools. Choose an eligible product from another seller, review the commission that seller offers, then select Add to Store (shown as Add to My Store in some views).',
          'Open your webstore preview and check that the product appears. On qualifying sales credited to you, you earn the listed affiliate commission. The original seller fulfills those orders.',
        ],
        action: 'Find products to promote',
        path: '/marketplace?view=business',
        image: '06-marketplace.jpg',
      },
      {
        heading: 'Share a product with your tracked affiliate link',
        instructions: [
          'In the Business Center, open Product Links & QR Codes. Search for and select the product you want to promote, then copy your tracked link.',
          'Include that link or its QR code when you share the product, and tell people you may earn a commission if they buy through it.',
        ],
        action: 'Open Product Links & QR Codes',
        path: '/business/promote',
        image: '07-sharing.jpg',
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
        heading: 'Build and share your free custom webstore',
        instructions: [
          'In the Business Center, choose Customize My Store. Enter your store name, choose your store URL, and write a short description of what you offer.',
          'Choose a theme and colors, then add your logo and banner. Save your changes and select View My Store to check how it looks on desktop and mobile.',
          'Check that your own listings and the other sellers’ products you added are visible. Copy your live store link to share the whole shop.',
        ],
        action: 'Customize My Store',
        path: '/store-builder',
        image: '02-store.jpg',
      },
      {
        heading: 'Use all three roles together',
        instructions: [
          'Say you run a horse-themed shop. As a Seller, list your own downloadable horse-care planner and receive your seller earnings when it sells.',
          'As an Affiliate, add an eligible grooming kit from another seller to the same webstore. You earn the seller’s commission on qualifying sales credited to you, and that seller ships the kit.',
          'As an Ambassador, share your personal invite link with a shopper, tack maker, or creator. If they sign up through your link, qualifying purchases or sales can earn you referral rewards.',
          'Use your store link to share the whole shop, your tracked affiliate product link to promote a specific item, and your Ambassador invite link to invite people to join Beezio.',
        ],
        action: 'Open your Business Center',
        path: '/business',
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
