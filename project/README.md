# Beezio Marketplace 🐝

A modern multi-role marketplace platform built with React, TypeScript, and Supabase.

## Features

### 🎯 Multi-Role System
- **Buyers**: Browse and purchase products, manage subscriptions, track orders
- **Sellers**: List products, manage inventory, track sales, customize store
- **Affiliates**: Promote products, earn commissions, access marketing tools
- **Fundraisers**: Create campaigns, collect donations, engage supporters

### ⚡ Key Capabilities
- **Role Switching**: Users can have multiple roles and switch between them seamlessly
- **Real-time Dashboard**: Live updates for orders, earnings, and analytics
- **Secure Authentication**: Supabase-powered auth with row-level security
- **Responsive Design**: Works perfectly on desktop and mobile
- **Payment Integration**: Stripe integration for secure transactions

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Build Tool**: Vite
- **Deployment**: Netlify (automatic deployment from GitHub)
- **Payment**: Stripe

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Netlify account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/beezio-marketplace.git
   cd beezio-marketplace
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

### Database Setup

Run the SQL setup script in your Supabase dashboard to create the necessary tables and policies. See `GITHUB-NETLIFY-SETUP.md` for detailed instructions.

## Deployment

This project is configured for automatic deployment with Netlify. Any push to the `main` branch will trigger a new deployment.

### Manual Deployment
```bash
npm run build
# Upload the 'dist' folder to your hosting provider
```

### Beta Testing with Real Products (Stripe in Test Mode)

1. **Disable sample catalog data**
   - Create or update your `.env` file with `VITE_ENABLE_SAMPLE_DATA=false` to switch the storefront over to Supabase-driven products.
2. **Apply the latest Supabase schema**
   - Run `supabase db push` (or execute the SQL migrations in `supabase/`) so the `products` table matches the app expectations.
3. **Load real products**
   - Add items through the Seller dashboard or import them directly in Supabase (ensure `is_active=true` and at least one image URL).
4. **Keep Stripe in test mode**
   - Leave `VITE_STRIPE_PUBLISHABLE_KEY` and server-side Stripe keys pointed at your **test** account.
   - Use Stripe’s universal test card `4242 4242 4242 4242` with any future expiry and a random CVC/ZIP to smoke test checkout.
5. **Verify end-to-end flows**
   - Run `npm run build` followed by a quick smoke test in the deployed preview. Confirm products render, add-to-cart works, and checkout accepts test digits.

When you’re ready for paid beta testers in phase two, swap your Stripe keys to live mode while keeping the real catalog intact.

## Project Structure

```
src/
├── components/          # React components
│   ├── Enhanced*Dashboard.tsx  # Role-specific dashboards
│   ├── UnifiedDashboard.tsx   # Main dashboard wrapper
│   └── ...
├── contexts/           # React contexts
│   ├── AuthContextMultiRole.tsx
│   └── ...
├── pages/             # Page components
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
└── types/             # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is proprietary and confidential.

## Support

For support and questions, please contact [your-email@example.com]

---

Built with ❤️ for the Beezio community
