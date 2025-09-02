#!/bin/bash

# Beezio Marketplace - Quick Deployment Script
echo "🚀 Deploying Beezio Marketplace..."

# Check if build passes
echo "📦 Testing production build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors before deploying."
    exit 1
fi

echo "✅ Build successful!"

# Check environment variables
echo "🔍 Checking environment variables..."

if [ -z "$VITE_SUPABASE_URL" ]; then
    echo "⚠️  Warning: VITE_SUPABASE_URL not set"
fi

if [ -z "$VITE_STRIPE_PUBLISHABLE_KEY" ]; then
    echo "⚠️  Warning: VITE_STRIPE_PUBLISHABLE_KEY not set"
fi

echo "📋 Deployment Checklist:"
echo "  1. Environment variables configured?"
echo "  2. Database tables created in Supabase?"
echo "  3. Stripe webhook endpoints configured?"
echo "  4. Edge functions deployed?"
echo ""
echo "🎯 Next Steps:"
echo "  1. Deploy to Netlify: Connect repo and deploy"
echo "  2. Add environment variables in Netlify dashboard"
echo "  3. Test with real users and payments"
echo ""
echo "🎉 Ready for production deployment!"
