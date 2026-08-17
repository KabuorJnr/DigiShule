// -----------------------------------------------------------------------------
// Super-admin data layer — backed by the Supabase `school_onboarding` table.
//
// Every school the platform tracks lives in one row: pending sign-ups, approved
// (active) schools, and rejected ones. Revenue is derived from the plan price;
// a real payments ledger is a later phase. See supabase/platform_schools.sql.
// -----------------------------------------------------------------------------

import { supabase } from './supabaseClient';

const TABLE = 'school_onboarding';

export const PLANS = {
  starter: { id: 'starter', name: 'Starter', price: 3000, color: '#64748b' },
  standard: { id: 'standard', name: 'Standard', price: 6500, color: '#2563eb' },
  premium: { id: 'premium', name: 'Premium', price: 12000, color: '#7c3aed' },
};

export const planPrice = (p) => PLANS[p]?.price || 0;
export const planName = (p) => PLANS[p]?.name || p;

const mapRow = (r) => ({
  id: r.id,
  name: r.name,
  principal: r.principal || '—',
  email: r.email || '',
  phone: r.phone || '',
  county: r.county || '—',
  plan: r.plan || 'standard',
  students: r.students || 0,
  status: r.status || 'pending',
  joinedAt: r.activated_at || r.created_at,
  lastActivity: r.last_activity || r.created_at,
});

const monthsActive = (joinedAt) =>
  Math.max(1, Math.round((Date.now() - new Date(joinedAt).getTime()) / (30 * 86400000)));

export function collectedFor(school) {
  return school.status === 'active' ? monthsActive(school.joinedAt) * planPrice(school.plan) : 0;
}

// Called by the signup flow instead of taking payment.
export async function addOnboardingRequest({ name, principal, email, phone, plan, students, county }) {
  const { error } = await supabase.from(TABLE).insert({
    name,
    principal: principal || null,
    email: email || null,
    phone: phone || null,
    county: county || null,
    plan: plan || 'standard',
    students: Number(students) || 0,
    status: 'pending',
  });
  if (error) throw error;
}

export async function fetchSchools() {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function approveSchool(id) {
  const now = new Date().toISOString();
  const { error } = await supabase.from(TABLE).update({ status: 'active', activated_at: now, last_activity: now }).eq('id', id);
  if (error) throw error;
}

export async function rejectSchool(id) {
  const { error } = await supabase.from(TABLE).update({ status: 'rejected' }).eq('id', id);
  if (error) throw error;
}

export function computeMetrics(schools) {
  const active = schools.filter((s) => s.status === 'active');
  const pending = schools.filter((s) => s.status === 'pending');

  const byPlan = {};
  Object.keys(PLANS).forEach((k) => { byPlan[k] = { count: 0, mrr: 0, collected: 0 }; });
  let mrr = 0, collected = 0, students = 0;
  active.forEach((s) => {
    const price = planPrice(s.plan);
    if (byPlan[s.plan]) {
      byPlan[s.plan].count += 1;
      byPlan[s.plan].mrr += price;
      byPlan[s.plan].collected += collectedFor(s);
    }
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

export async function getMetrics() {
  return computeMetrics(await fetchSchools());
}
