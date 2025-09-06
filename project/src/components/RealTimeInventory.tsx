import React, { useState, useEffect } from 'react';
import { 
  Package, AlertTriangle, TrendingUp, TrendingDown, 
  RefreshCw, Bell, Settings, BarChart3, Clock, 
  DollarSign, Target, Truck, CheckCircle, XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface InventoryItem {
  id: string;
  product_id: string;
  product_title: string;
  current_stock: number;
  available_stock: number;
  reserved_stock: number;
  minimum_stock: number;
  warehouse_location: string;
  last_stock_check: string;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  auto_reorder_enabled: boolean;
  next_restock_date?: string;
}

interface StockAlert {
  id: string;
  product_title: string;
  alert_type: string;
  severity: string;
  current_stock: number;
  threshold_stock?: number;
  message: string;
  created_at: string;
  is_resolved: boolean;
}

interface PricingData {
  product_id: string;
  product_title: string;
  current_price: number;
  base_price: number;
  strategy: string;
  last_adjustment: string;
  conversion_rate?: number;
  price_changes_last_30_days: number;
}

const RealTimeInventory: React.FC = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'alerts' | 'pricing' | 'analytics'>('inventory');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [pricing, setPricing] = useState<PricingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Set up real-time subscriptions
      const inventoryChannel = supabase
        .channel('inventory_updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'product_inventory'
        }, handleInventoryUpdate)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'stock_alerts'
        }, handleAlertUpdate)
        .subscribe();

      return () => {
        supabase.removeChannel(inventoryChannel);
      };
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchInventory(),
        fetchAlerts(),
        fetchPricing()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory_analytics')
      .select('*')
      .order('stock_status', { ascending: false })
      .order('available_stock', { ascending: true });

    if (!error && data) {
      setInventory(data);
    }
  };

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select(`
        *,
        products!inner(title)
      `)
      .eq('is_resolved', false)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedAlerts = data.map(alert => ({
        ...alert,
        product_title: alert.products.title
      }));
      setAlerts(formattedAlerts);
    }
  };

  const fetchPricing = async () => {
    const { data, error } = await supabase
      .from('pricing_analytics')
      .select('*')
      .order('price_changes_last_30_days', { ascending: false });

    if (!error && data) {
      setPricing(data);
    }
  };

  const handleInventoryUpdate = (payload: any) => {
    // Refresh inventory data when changes occur
    fetchInventory();
  };

  const handleAlertUpdate = (payload: any) => {
    // Refresh alerts when new ones are created
    fetchAlerts();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const updateStock = async (productId: string, quantityChange: number, movementType: string) => {
    try {
      const { error } = await supabase.rpc('update_product_stock', {
        product_id_param: productId,
        quantity_change: quantityChange,
        movement_type_param: movementType,
        notes_param: `Manual adjustment: ${quantityChange > 0 ? 'Added' : 'Removed'} ${Math.abs(quantityChange)} units`
      });

      if (error) throw error;
      
      // Refresh data
      await fetchInventory();
      await fetchAlerts();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock');
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('stock_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq('id', alertId);

      if (error) throw error;
      
      await fetchAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'text-green-600 bg-green-50 border-green-200';
      case 'low_stock': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'out_of_stock': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!user || (profile?.role !== 'seller' && profile?.role !== 'admin')) {
    return (
      <div className="text-center py-8">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600">Only sellers and administrators can access inventory management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Real-time stock tracking and dynamic pricing</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-yellow-600">
                {inventory.filter(item => item.stock_status === 'low_stock').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">
                {inventory.filter(item => item.stock_status === 'out_of_stock').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold text-orange-600">{alerts.length}</p>
            </div>
            <Bell className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'alerts', label: 'Alerts', icon: Bell },
            { id: 'pricing', label: 'Pricing', icon: DollarSign },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {id === 'alerts' && alerts.length > 0 && (
                <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading inventory data...</p>
        </div>
      ) : (
        <>
          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Levels
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventory.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {item.product_title}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(item.stock_status)}`}>
                            {item.stock_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            <div>Available: <span className="font-medium">{item.available_stock}</span></div>
                            <div>Reserved: <span className="text-gray-600">{item.reserved_stock}</span></div>
                            <div>Total: <span className="text-gray-600">{item.current_stock}</span></div>
                            {item.minimum_stock > 0 && (
                              <div>Min: <span className="text-gray-600">{item.minimum_stock}</span></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.warehouse_location}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(item.last_stock_check).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => updateStock(item.product_id, 10, 'stock_in')}
                              className="text-green-600 hover:text-green-900"
                              title="Add 10 units"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateStock(item.product_id, -10, 'stock_out')}
                              className="text-red-600 hover:text-red-900"
                              title="Remove 10 units"
                            >
                              <TrendingDown className="w-4 h-4" />
                            </button>
                            <button className="text-blue-600 hover:text-blue-900" title="Settings">
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Alerts</h3>
                  <p className="text-gray-600">All your inventory levels are looking good!</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5" />
                          <h4 className="font-medium">{alert.product_title}</h4>
                          <span className="text-xs uppercase font-semibold px-2 py-1 rounded">
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{alert.message}</p>
                        <p className="mt-2 text-xs opacity-75">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="ml-4 px-3 py-1 text-sm bg-white border border-current rounded hover:bg-gray-50"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pricing Tab */}
          {activeTab === 'pricing' && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Base Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Strategy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pricing.map((item) => (
                      <tr key={item.product_id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {item.product_title}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${item.current_price?.toFixed(2) || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ${item.base_price?.toFixed(2) || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-600">
                            {item.strategy || 'static'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            {item.conversion_rate && (
                              <div>CVR: {(item.conversion_rate * 100).toFixed(1)}%</div>
                            )}
                            <div>Changes: {item.price_changes_last_30_days || 0}/30d</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900">
                            <Settings className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Distribution</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">In Stock</span>
                    <span className="text-sm font-medium text-green-600">
                      {inventory.filter(item => item.stock_status === 'in_stock').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Low Stock</span>
                    <span className="text-sm font-medium text-yellow-600">
                      {inventory.filter(item => item.stock_status === 'low_stock').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Out of Stock</span>
                    <span className="text-sm font-medium text-red-600">
                      {inventory.filter(item => item.stock_status === 'out_of_stock').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <div>
                        <div className="text-sm font-medium">Inventory Updated</div>
                        <div className="text-xs text-gray-600">Wireless Headphones - Stock: 45 → 42</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">2 min ago</div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      <div>
                        <div className="text-sm font-medium">Sale Completed</div>
                        <div className="text-xs text-gray-600">Smart Watch Pro - Qty: 2</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">5 min ago</div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                      <div>
                        <div className="text-sm font-medium">Low Stock Alert</div>
                        <div className="text-xs text-gray-600">Gaming Mouse - Only 3 remaining</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">12 min ago</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RealTimeInventory;
