import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Global Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      'nav.products': 'Products',
      'nav.affiliates': 'Affiliates',
      'nav.cart': 'Cart',
      'nav.signin': 'Sign In',
      'nav.signup': 'Sign Up',
      'nav.dashboard': 'Dashboard',
      'nav.profile': 'Profile',
      'nav.signout': 'Sign Out',
      'nav.help': 'Help',
      'nav.fundraisers': 'Fundraisers',
      'nav.sellers': 'For Sellers',
      'nav.how_it_works': 'How It Works',
      
      // Homepage
      'home.title': 'Empowering Global Commerce',
      'home.subtitle': 'The Future of International Affiliate Marketing',
      'home.featured': 'Featured Products',
      'home.cta.title': 'Ready to Join the Global Beezio Community?',
      'home.cta.description': 'Whether you\'re a seller or affiliate, there\'s a place for you here.',
      'home.cta.start_selling': 'Start Selling',
      
      // Authentication
      'auth.signin': 'Sign In',
      'auth.signup': 'Create Account',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.fullname': 'Full Name',
      'auth.phone': 'Phone (Optional)',
      'auth.city': 'City (Optional)',
      'auth.state': 'State (Optional)',
      'auth.zipcode': 'ZIP Code (Optional)',
      'auth.country': 'Country',
      'auth.role': 'Account Type',
      'auth.role.buyer': 'Buyer',
      'auth.role.seller': 'Seller',
      'auth.role.affiliate': 'Affiliate',
      'auth.password_min': 'Password must be at least 6 characters',
      'auth.no_account': 'Don\'t have an account?',
      'auth.have_account': 'Already have an account?',
      'auth.creating': 'Creating Account...',
      'auth.signing_in': 'Signing In...',
      'auth.success_signin': 'Successfully signed in!',
      'auth.success_signup': 'Account created successfully!',
      
      // Common
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.edit': 'Edit',
      'common.delete': 'Delete',
      'common.view_all': 'View All',
      'common.search': 'Search products, charity drives, local businesses...',
      'common.no_results': 'No results found',
      'common.currency': 'Currency',
      'common.language': 'Language'
    }
  }
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    interpolation: {
      escapeValue: false,
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })
  .catch((error) => {
    console.error('i18n initialization failed:', error);
  });

export default i18n;
