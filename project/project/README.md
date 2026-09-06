# Beezio Marketplace 🐝

A modern multi-role marketplace platform built with React, TypeScript, and Supabase.

## Current Production Configuration
- Authentication and database: Supabase
- Payments: PayPal only
- Deployment: Netlify
- Product catalog: manual product entry for launch

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
- **Payment Integration**: PayPal for secure transactions

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Build Tool**: Vite
- **Deployment**: Netlify (automatic deployment from GitHub)
- **Payment**: PayPal

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

## Launch Configuration

1. **Use the rebuilt Supabase project** configured in Netlify environment variables.
2. **Use PayPal only** for checkout and payouts.
3. **Enter launch products manually**; supplier API importing is disabled for launch.
4. **Verify signup, email confirmation, login, role setup, product listing, checkout, and order tracking before beta launch.**

## Project Structure

```
src/
├── components/          # React components
│   ├── Enhanced*Dashboard.tsx  # Role-specific dashboards
│   ├── UnifiedDashboard.tsx   # Main dashboard wrapper
│   └── ...
├── contexts/           # Authentication and application contexts
├── pages/              # Application pages
├── hooks/              # Custom hooks
├── utils/              # Utility functions
└── types/              # Type definitions
```

## License

This project is proprietary and confidential.

---

Built with ❤️ for the Beezio community
