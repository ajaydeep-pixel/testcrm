import React from 'react';
import { getPlanDisplayName } from '../utils/planDisplay';

export default function RateLimitWidget({ data = {} }) {
  const tenantPlan = data?.tenant?.plan || null;
  const planSlug = data?.tenant?.planSlug || tenantPlan?.slug || 'trial';
  const planName = getPlanDisplayName(tenantPlan, planSlug);
  const planStatus = tenantPlan?.status || null;
  const rateLimit = data?.rateLimit || {};
  const current = Number(rateLimit.current || 0);
  const limit = Number(rateLimit.limit || 0);
  const percentUsed = Number.isFinite(rateLimit.percentUsed)
    ? rateLimit.percentUsed
    : (limit > 0 ? Math.round((current / limit) * 100) : 0);

  const getStatusColor = () => {
    if (percentUsed > 90) return 'bg-red-50 border-red-400';
    if (percentUsed > 70) return 'bg-yellow-50 border-yellow-400';
    return 'bg-green-50 border-green-400';
  };

  const getProgressColor = () => {
    if (percentUsed > 90) return 'bg-red-500';
    if (percentUsed > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${getStatusColor()}`}>
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Plan & Rate Limit</h3>
          <p className="mt-2 text-2xl font-bold text-gray-900 capitalize">{planName}</p>
          {planStatus && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              {planStatus}
            </p>
          )}
        </div>
        <span className="text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-1 rounded">
          {percentUsed.toFixed(0)}% Used
        </span>
      </div>

      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${getProgressColor()}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {percentUsed > 90 && (
        <p className="mt-3 text-xs text-red-600 font-medium">
          You are using {percentUsed.toFixed(0)}% of your rate limit
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Requests this window: {current} / {limit || 'unlimited'}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Window: {rateLimit.window || 0} seconds
      </p>
    </div>
  );
}
