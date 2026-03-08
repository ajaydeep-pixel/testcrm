import React from 'react';
// Removed MUI Tabs/Tab import

// Placeholder components for each tab
const BillingInfo = () => <div>Update billing information here.</div>;
const BusinessInfo = () => <div>Update business information here.</div>;
const PasswordChange = () => <div>Change password here.</div>;
const SubscriptionDetails = () => <div>View subscription details here.</div>;
const PaymentHistory = () => <div>View payment history and invoices here.</div>;

export default function SettingsMenu() {
  const [selectedTab, setSelectedTab] = React.useState(0);

  const menuOptions = [
    { label: 'Billing Info', component: <BillingInfo /> },
    { label: 'Business Info', component: <BusinessInfo /> },
    { label: 'Password', component: <PasswordChange /> },
    { label: 'Subscription Details', component: <SubscriptionDetails /> },
    { label: 'Payment History & Invoices', component: <PaymentHistory /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
          <div className="flex gap-3 mb-8">
            {menuOptions.map((option, idx) => (
              <button
                key={option.label}
                onClick={() => setSelectedTab(idx)}
                className={`px-5 py-2 rounded-lg border font-semibold transition-colors ${selectedTab === idx ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                style={{ minWidth: 120 }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {menuOptions[selectedTab].component}
          </div>
        </div>
      </main>
    </div>
  );
}
