import React from 'react';

export default function QuickActionsWidget() {
  const actions = [
    { label: 'New Sale', icon: '🧾', href: '/sales' },
    { label: 'Add Stock', icon: '📦', href: '/inventory' },
    { label: 'Add Product', icon: '➕', href: '/products' },
    { label: 'View Reports', icon: '📊', href: '/reports' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="flex items-center p-3 rounded hover:bg-blue-50 transition text-gray-700 hover:text-blue-600"
          >
            <span className="text-2xl mr-3">{action.icon}</span>
            <span className="font-medium">{action.label}</span>
            <span className="ml-auto text-gray-400">→</span>
          </a>
        ))}
      </div>
    </div>
  );
}
