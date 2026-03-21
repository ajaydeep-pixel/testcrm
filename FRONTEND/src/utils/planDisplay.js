export const getPlanDisplayName = (planOrSlug, fallbackName = '') => {
  const slug = typeof planOrSlug === 'string'
    ? planOrSlug
    : planOrSlug?.slug || planOrSlug?.id || '';
  const rawName = typeof planOrSlug === 'string'
    ? fallbackName || planOrSlug
    : planOrSlug?.name || fallbackName || slug;

  if (slug === 'trial') {
    return 'Trial';
  }

  return rawName || 'Trial';
};
