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
