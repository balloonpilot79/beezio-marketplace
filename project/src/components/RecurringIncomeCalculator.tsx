import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, Users, Target, Zap } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  subscription_price: number;
  commission_rate: number;
  category: string;
}

interface CalculationResult {
  monthly_commission_per_sub: number;
  monthly_recurring_income: number;
  annual_recurring_income: number;
  lifetime_value_per_sub: number;
  total_lifetime_value: number;
  breakeven_months: number;
}

const RecurringIncomeCalculator: React.FC = () => {
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [subscriberCounts, setSubscriberCounts] = useState<{[key: string]: number}>({});
  const [customerLifetime, setCustomerLifetime] = useState(18); // months
  const [results, setResults] = useState<{[key: string]: CalculationResult}>({});

  // Sample subscription products with high commissions
  const availableProducts: Product[] = [
    {
      id: '1',
      title: 'Business Automation Suite Pro',
      subscription_price: 149.99,
      commission_rate: 35,
      category: 'Business Software'
    },
    {
      id: '2', 
      title: 'Digital Marketing Mastery Course',
      subscription_price: 199.99,
      commission_rate: 50,
      category: 'Education'
    },
    {
      id: '3',
      title: 'Premium Fitness & Nutrition Plan',
      subscription_price: 39.99,
      commission_rate: 45,
      category: 'Health & Fitness'
    },
    {
      id: '4',
      title: 'Social Media Management Suite',
      subscription_price: 89.99,
      commission_rate: 35,
      category: 'Marketing Tools'
    },
    {
      id: '5',
      title: 'Advanced Data Analytics Platform',
      subscription_price: 299.99,
      commission_rate: 45,
      category: 'Analytics'
    },
    {
      id: '6',
      title: 'Design Suite Professional',
      subscription_price: 59.99,
      commission_rate: 32,
      category: 'Design Tools'
    }
  ];

  useEffect(() => {
    calculateResults();
  }, [selectedProducts, subscriberCounts, customerLifetime]);

  const calculateResults = () => {
    const newResults: {[key: string]: CalculationResult} = {};

    selectedProducts.forEach(product => {
      const subscriberCount = subscriberCounts[product.id] || 0;
      const monthlyCommissionPerSub = (product.subscription_price * product.commission_rate) / 100;
      const monthlyRecurringIncome = monthlyCommissionPerSub * subscriberCount;
      const annualRecurringIncome = monthlyRecurringIncome * 12;
      const lifetimeValuePerSub = monthlyCommissionPerSub * customerLifetime;
      const totalLifetimeValue = lifetimeValuePerSub * subscriberCount;
      const breakevenMonths = Math.ceil(100 / monthlyCommissionPerSub); // Rough estimate

      newResults[product.id] = {
        monthly_commission_per_sub: monthlyCommissionPerSub,
        monthly_recurring_income: monthlyRecurringIncome,
        annual_recurring_income: annualRecurringIncome,
        lifetime_value_per_sub: lifetimeValuePerSub,
        total_lifetime_value: totalLifetimeValue,
        breakeven_months: breakevenMonths
      };
    });

    setResults(newResults);
  };

  const addProduct = (product: Product) => {
    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product]);
      setSubscriberCounts({...subscriberCounts, [product.id]: 10}); // Default 10 subscribers
    }
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
    const newCounts = {...subscriberCounts};
    delete newCounts[productId];
    setSubscriberCounts(newCounts);
  };

  const updateSubscriberCount = (productId: string, count: number) => {
    setSubscriberCounts({...subscriberCounts, [productId]: Math.max(0, count)});
  };

  // Calculate totals
  const totalMonthlyRecurring = Object.values(results).reduce((sum, result) => sum + result.monthly_recurring_income, 0);
  const totalAnnualRecurring = totalMonthlyRecurring * 12;
  const totalLifetimeValue = Object.values(results).reduce((sum, result) => sum + result.total_lifetime_value, 0);
  const totalSubscribers = Object.values(subscriberCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg p-8 text-white">
        <div className="text-center">
          <Calculator className="mx-auto h-12 w-12 mb-4" />
          <h1 className="text-3xl font-bold mb-2">🧮 Recurring Income Calculator</h1>
          <p className="text-purple-100 text-lg">
            Calculate your potential monthly recurring income from subscription products
          </p>
        </div>
      </div>

      {/* Global Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Average Customer Lifetime (months)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={customerLifetime}
              onChange={(e) => setCustomerLifetime(parseInt(e.target.value) || 18)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">Industry average: 12-24 months</p>
          </div>
        </div>
      </div>

      {/* Available Products */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Subscription Products</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableProducts.map((product) => (
            <div
              key={product.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedProducts.find(p => p.id === product.id)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => selectedProducts.find(p => p.id === product.id) ? removeProduct(product.id) : addProduct(product)}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 text-sm">{product.title}</h4>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {product.commission_rate}%
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-2">{product.category}</div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">${product.subscription_price}/mo</span>
                <span className="text-sm font-medium text-green-600">
                  ${((product.subscription_price * product.commission_rate) / 100).toFixed(2)}/mo commission
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Products Configuration */}
      {selectedProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Product Portfolio</h3>
          <div className="space-y-4">
            {selectedProducts.map((product) => {
              const result = results[product.id];
              const subscriberCount = subscriberCounts[product.id] || 0;
              
              return (
                <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                    <div>
                      <h4 className="font-medium text-gray-900">{product.title}</h4>
                      <div className="text-sm text-gray-600">{product.category}</div>
                      <div className="text-sm text-green-600 font-medium">
                        ${product.subscription_price}/mo • {product.commission_rate}% commission
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subscribers
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={subscriberCount}
                        onChange={(e) => updateSubscriberCount(product.id, parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        ${result?.monthly_recurring_income.toLocaleString() || '0'}
                      </div>
                      <div className="text-sm text-gray-600">Monthly Recurring</div>
                    </div>
                    
                    <div className="text-center">
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Summary */}
      {selectedProducts.length > 0 && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Monthly Recurring</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalMonthlyRecurring.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Annual Projection</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${totalAnnualRecurring.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Subscribers</p>
                  <p className="text-2xl font-bold text-purple-600">{totalSubscribers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Zap className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Lifetime Value</p>
                  <p className="text-2xl font-bold text-amber-600">
                    ${totalLifetimeValue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Income Projection Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">📈 Income Growth Projection</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  ${(totalMonthlyRecurring * 3).toLocaleString()}
                </div>
                <div className="text-sm font-medium text-green-800">3 Months</div>
                <div className="text-xs text-green-600">Quarterly Income</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  ${(totalMonthlyRecurring * 6).toLocaleString()}
                </div>
                <div className="text-sm font-medium text-blue-800">6 Months</div>
                <div className="text-xs text-blue-600">Semi-Annual Income</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  ${totalAnnualRecurring.toLocaleString()}
                </div>
                <div className="text-sm font-medium text-purple-800">12 Months</div>
                <div className="text-xs text-purple-600">Annual Income</div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-xl shadow-lg p-8 text-white text-center">
            <h3 className="text-2xl font-bold mb-4">🚀 Ready to Start Building Recurring Income?</h3>
            <p className="text-green-100 mb-6">
              With just {totalSubscribers} subscribers, you could earn ${totalMonthlyRecurring.toLocaleString()} every month!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Join as Affiliate
              </button>
              <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors">
                View All Products
              </button>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {selectedProducts.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Target className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Products to Calculate Income</h3>
          <p className="text-gray-600 mb-6">
            Choose subscription products above to see your potential recurring income
          </p>
        </div>
      )}
    </div>
  );
};

export default RecurringIncomeCalculator;
