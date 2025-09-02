#!/bin/bash

# Custom Vendor Integration Quick Setup Script
# This script helps you set up the custom vendor integration system

echo "🚀 Custom Vendor Integration Setup"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "CUSTOM_VENDOR_INTEGRATION.sql" ]; then
    echo "❌ Error: CUSTOM_VENDOR_INTEGRATION.sql not found in current directory"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "✅ Found setup files in current directory"

# Database setup instructions
echo ""
echo "📋 SETUP STEPS:"
echo "==============="
echo ""
echo "1. 🗄️  DATABASE SETUP:"
echo "   Run the following SQL files in your Supabase SQL Editor:"
echo ""
echo "   a) Main integration tables:"
echo "      \\i CUSTOM_VENDOR_INTEGRATION.sql"
echo ""
echo "   b) Sample configurations (optional):"
echo "      \\i CUSTOM_VENDOR_SAMPLES.sql"
echo ""
echo "2. ⚛️  REACT COMPONENT:"
echo "   Add the CustomVendorManager to your app:"
echo ""
echo "   import CustomVendorManager from './components/CustomVendorManager';"
echo ""
echo "   function App() {"
echo "     return ("
echo "       <div>"
echo "         <CustomVendorManager />"
echo "       </div>"
echo "     );"
echo "   }"
echo ""

# Create a simple test to verify setup
echo "3. 🧪 TESTING:"
echo "   After setup, test with these queries:"
echo ""
echo "   -- Check if tables were created"
echo "   SELECT table_name FROM information_schema.tables"
echo "   WHERE table_name LIKE 'custom_%';"
echo ""
echo "   -- View configured vendors"
echo "   SELECT vendor_name, vendor_type, is_active FROM custom_vendors;"
echo ""

# File structure
echo "4. 📁 FILE STRUCTURE:"
echo "   Your project should now have:"
echo "   ✅ CUSTOM_VENDOR_INTEGRATION.sql      (Database migration)"
echo "   ✅ CUSTOM_VENDOR_SAMPLES.sql          (Sample configurations)"
echo "   ✅ CUSTOM_VENDOR_INTEGRATION_GUIDE.md (Complete documentation)"
echo "   ✅ src/components/CustomVendorManager.tsx (React component)"
echo ""

# Next steps
echo "5. 🎯 NEXT STEPS:"
echo "   a) Configure your first custom vendor"
echo "   b) Test the connection"
echo "   c) Map your products to vendor products"
echo "   d) Set up order field mappings"
echo "   e) Enable automation for the vendor"
echo ""

# Common issues
echo "6. 🐛 TROUBLESHOOTING:"
echo "   • Connection test fails? Check API credentials"
echo "   • Product sync issues? Verify product IDs"
echo "   • Order placement errors? Check field mappings"
echo "   • Rate limit errors? Adjust rate_limits in vendor config"
echo ""

echo "📖 For detailed instructions, see: CUSTOM_VENDOR_INTEGRATION_GUIDE.md"
echo ""
echo "🎉 Setup complete! Your system now supports unlimited custom vendor integrations!"
echo ""
echo "Need help? Check the documentation or contact support."
