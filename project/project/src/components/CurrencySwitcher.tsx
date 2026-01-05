import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, ChevronDown } from 'lucide-react';

// Currency options for global commerce
const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
];

interface CurrencySwitcherProps {
  className?: string;
  onCurrencyChange?: (currency: string) => void;
}

const CurrencySwitcher: React.FC<CurrencySwitcherProps> = ({ 
  className = '', 
  onCurrencyChange 
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState(() => {
    return localStorage.getItem('preferred-currency') || 'USD';
  });

  const selectedCurrency = currencies.find(curr => curr.code === currentCurrency) || currencies[0];

  const handleCurrencyChange = (currencyCode: string) => {
    setCurrentCurrency(currencyCode);
    setIsOpen(false);
    
    // Store preference
    localStorage.setItem('preferred-currency', currencyCode);
    
    // Notify parent component
    if (onCurrencyChange) {
      onCurrencyChange(currencyCode);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 text-white"
      >
        <DollarSign className="w-4 h-4" />
        <span className="hidden sm:block text-sm font-medium">
          {selectedCurrency.flag} {selectedCurrency.code}
        </span>
        <span className="sm:hidden text-sm font-medium">
          {selectedCurrency.symbol}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 z-40 sm:hidden" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 max-h-80 overflow-y-auto">
            <div className="px-4 py-2 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">{t('settings.currency')}</h3>
            </div>
            
            {currencies.map((currency) => (
              <button
                key={currency.code}
                onClick={() => handleCurrencyChange(currency.code)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-3 ${
                  selectedCurrency.code === currency.code 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-gray-700'
                }`}
              >
                <span className="text-lg">{currency.flag}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{currency.code}</span>
                    <span className="text-gray-500">{currency.symbol}</span>
                  </div>
                  <div className="text-sm text-gray-500">{currency.name}</div>
                </div>
                {selectedCurrency.code === currency.code && (
                  <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                )}
              </button>
            ))}
            
            {/* Exchange rate info */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-600">
                💱 Live exchange rates updated hourly
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CurrencySwitcher;
