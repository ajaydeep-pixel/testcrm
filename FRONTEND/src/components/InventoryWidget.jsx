import React from 'react';

export default function InventoryWidget({ lowStockItems = [] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Alerts</h3>
      {lowStockItems.length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          <p className="text-sm">✓ All items well stocked</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lowStockItems.slice(0, 5).map((item) => (
            <div key={item._id} className="flex items-center justify-between p-3 bg-orange-50 rounded border-l-4 border-orange-400">
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">SKU: {item.sku}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-orange-600">{item.stock} units</p>
                <p className="text-xs text-gray-500">Min: {item.reorderLevel}</p>
              </div>
            </div>
          ))}
          {lowStockItems.length > 5 && (
            <p className="text-sm text-gray-500 text-center mt-2">
              +{lowStockItems.length - 5} more items
            </p>
          )}
        </div>
      )}
    </div>
  );
}
