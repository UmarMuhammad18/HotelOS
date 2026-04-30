const STAFF_ROLES = new Set([
  'staff',
  'concierge',
  'food_beverage',
  'food_beverages',
  'housekeeping',
  'maintenance',
  'maintainance',
  'front_office',
  'front_desk',
  'guest_relations',
  'guest_experience',
  'security',
  'manager',
]);

export const normalizeRole = (role) => String(role || '').toLowerCase().trim();

export const isStaffRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return STAFF_ROLES.has(normalizedRole);
};

export const getRouteForRole = (role) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'guest') return '/guest/home';
  if (normalizedRole === 'admin') return '/admin';
  if (isStaffRole(normalizedRole)) return '/dashboard';

  return null;
};
