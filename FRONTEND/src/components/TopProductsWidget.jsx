import React from 'react';

export default function TopProductsWidget({ products = [] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Sales</h3>
      {products.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          <p className="text-sm">No sales data yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product, idx) => (
            <div key={product._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded transition">
              <div className="flex items-center">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                  {idx + 1}
                </span>
                <div className="ml-3">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{product.unitsSold || 0} sold</p>
                <p className="text-xs text-gray-500">${(product.revenue || 0).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
