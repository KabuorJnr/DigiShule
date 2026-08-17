// -----------------------------------------------------------------------------
// Super-admin data layer (client-side prototype).
//
// Stores onboarded schools and pending onboarding requests in localStorage so
// the super-admin portal is fully functional offline with no backend. Promote
// to Supabase later by swapping these read/write helpers for table queries and
// gating access on a real `super_admin` role instead of the demo credentials.
// -----------------------------------------------------------------------------

const KEY = 'eduone_admin_store_v1';

export const PLANS = {
  starter: { id: 'starter', name: 'Starter', price: 3000, color: '#64748b' },
  standard: { id: 'standard', name: 'Standard', price: 6500, color: '#2563eb' },
  premium: { id: 'premium', name: 'Premium', price: 12000, color: '#7c3aed' },
};

export const planPrice = (p) => PLANS[p]?.price || 0;
export const planName = (p) => PLANS[p]?.name || p;
const uid = () => Math.random().toString(36).slice(2, 9);
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

function seed() {
  return {
    schools: [
      { id: uid(), name: 'Greenhill Academy', principal: 'J. Otieno', email: 'admin@greenhill.ac.ke', phone: '+254712000001', plan: 'premium', students: 812, status: 'active', county: 'Nairobi', joinedAt: daysAgo(240), lastActivity: daysAgo(0) },
      { id: uid(), name: 'Riverside High', principal: 'M. Wanjiru', email: 'admin@riverside.sc.ke', phone: '+254712000002', plan: 'standard', students: 540, status: 'active', county: 'Nakuru', joinedAt: daysAgo(180), lastActivity: daysAgo(1) },
      { id: uid(), name: 'St. Mary’s Girls', principal: 'A. Njoroge', email: 'admin@stmarys.ac.ke', phone: '+254712000003', plan: 'standard', students: 610, status: 'active', county: 'Kisumu', joinedAt: daysAgo(150), lastActivity: daysAgo(0) },
      { id: uid(), name: 'Sunrise Junior', principal: 'P. Kamau', email: 'admin@sunrise.ac.ke', phone: '+254712000004', plan: 'starter', students: 220, status: 'active', county: 'Mombasa', joinedAt: daysAgo(95), lastActivity: daysAgo(2) },
      { id: uid(), name: 'Highview School', principal: 'L. Achieng', email: 'admin@highview.ac.ke', phone: '+254712000005', plan: 'premium', students: 1050, status: 'active', county: 'Eldoret', joinedAt: daysAgo(300), lastActivity: daysAgo(0) },
      { id: uid(), name: 'Bright Future Academy', principal: 'D. Mutua', email: 'admin@brightfuture.ac.ke', phone: '+254712000006', plan: 'starter', students: 180, status: 'active', county: 'Machakos', joinedAt: daysAgo(60), lastActivity: daysAgo(3) },
      { id: uid(), name: 'Victory Springs School', principal: 'R. Cherono', email: 'admin@victorysprings.ac.ke', phone: '+254712000007', plan: 'standard', students: 430, status: 'pending', county: 'Kericho', joinedAt: daysAgo(1), lastActivity: daysAgo(1) },
      { id: uid(), name: 'Nova Learning Centre', principal: 'S. Barasa', email: 'admin@novalearning.ac.ke', phone: '+254712000008', plan: 'premium', students: 760, status: 'pending', county: 'Kakamega', joinedAt: daysAgo(0), lastActivity: daysAgo(0) },
    ],
  };
}

export function getStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through to seed */ }
  const fresh = seed();
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

function save(store) {
  localStorage.setItem(KEY, JSON.stringify(store));
  return store;
}

export function listSchools(status) {
  const { schools } = getStore();
  return status ? schools.filter((s) => s.status === status) : schools;
}

// Called by the signup flow instead of taking payment.
export function addOnboardingRequest({ name, principal, email, phone, plan, students, county }) {
  const store = getStore();
  store.schools.unshift({
    id: uid(), name, principal, email, phone,
    plan: plan || 'standard', students: Number(students) || 0,
    status: 'pending', county: county || '—',
    joinedAt: new Date().toISOString(), lastActivity: new Date().toISOString(),
  });
  return save(store).schools[0];
}

export function approveSchool(id) {
  const store = getStore();
  const s = store.schools.find((x) => x.id === id);
  if (s) { s.status = 'active'; s.joinedAt = new Date().toISOString(); s.lastActivity = new Date().toISOString(); }
  return save(store);
}

export function rejectSchool(id) {
  const store = getStore();
  const s = store.schools.find((x) => x.id === id);
  if (s) s.status = 'rejected';
  return save(store);
}

const monthsActive = (joinedAt) => Math.max(1, Math.round((Date.now() - new Date(joinedAt).getTime()) / (30 * 86400000)));

export function collectedFor(school) {
  return school.status === 'active' ? monthsActive(school.joinedAt) * planPrice(school.plan) : 0;
}

export function getMetrics() {
  const { schools } = getStore();
  const active = schools.filter((s) => s.status === 'active');
  const pending = schools.filter((s) => s.status === 'pending');

  const byPlan = {};
  Object.keys(PLANS).forEach((k) => { byPlan[k] = { count: 0, mrr: 0, collected: 0 }; });
  let mrr = 0, collected = 0, students = 0;
  active.forEach((s) => {
    const price = planPrice(s.plan);
    byPlan[s.plan].count += 1;
    byPlan[s.plan].mrr += price;
    byPlan[s.plan].collected += collectedFor(s);
    mrr += price;
    collected += collectedFor(s);
    students += s.students || 0;
  });

  return {
    totalActive: active.length,
    pendingCount: pending.length,
    totalStudents: students,
    mrr,
    collected,
    arr: mrr * 12,
    byPlan,
    schools,
    active,
    pending,
  };
}
