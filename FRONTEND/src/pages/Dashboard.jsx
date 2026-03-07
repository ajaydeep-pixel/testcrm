import React, { useState, useEffect } from 'react';
import { usageAPI, salesAPI, inventoryAPI } from '../services/api';
import SalesWidget from '../components/SalesWidget';
import InventoryWidget from '../components/InventoryWidget';
import RateLimitWidget from '../components/RateLimitWidget';
import TopProductsWidget from '../components/TopProductsWidget';
import QuickActionsWidget from '../components/QuickActionsWidget';
import { format } from 'date-fns';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [todaysSales, setTodaysSales] = useState(0);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [usage, sales, inventory, products] = await Promise.all([
        usageAPI.getDashboard().catch(() => ({ data: null })),
        salesAPI.getTodaysSales().catch(() => ({ data: { total: 0 } })),
        inventoryAPI.getLowStockItems(10).catch(() => ({ data: [] })),
        salesAPI.getTopProducts(5).catch(() => ({ data: [] })),
      ]);

      setDashboardData(usage.data);
      setTodaysSales(sales.data?.total || 0);
      setLowStockItems(inventory.data || []);
      setTopProducts(products.data || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="text-sm text-gray-500">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Top Row: Sales & Usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SalesWidget todaysSales={todaysSales} />
          <RateLimitWidget data={dashboardData} />
          <QuickActionsWidget />
        </div>

        {/* Middle Row: Inventory & Top Products */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <InventoryWidget lowStockItems={lowStockItems} />
          <TopProductsWidget products={topProducts} />
        </div>

        {/* Bottom: Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {dashboardData?.usage?.apiCallsThisMonth || 0}
              </div>
              <div className="text-sm text-gray-600">API Calls</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {dashboardData?.usage?.invoiceCount || 0}
              </div>
              <div className="text-sm text-gray-600">Invoices</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {lowStockItems.length}
              </div>
              <div className="text-sm text-gray-600">Low Stock Items</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <div className="text-2xl font-bold text-orange-600">
                {dashboardData?.usage?.percentUsed || 0}%
              </div>
              <div className="text-sm text-gray-600">Usage</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
