// EduOne — thin client for the data warehouse.
//
// One import for every dashboard that reads warehouse fact tables. The
// `warehouse` Postgres schema is exposed via Supabase's schema selection
// (`.schema('warehouse')`), and the refresh is triggered through a Supabase
// edge function (admin-only, service-role writes).
//
// Everything here fails soft: if the warehouse migration isn't deployed yet,
// callers get back { rows: [], error } — no crashes.

import { supabase } from './supabaseClient';
import { reportError } from './errorReporter';

const w = () => supabase.schema('warehouse');

export async function fetchSchoolDaily(days = 30) {
  try {
    const { data, error } = await supabase.functions.invoke('warehouse-read', {
      body: { target: 'school_daily', days_back: days }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { rows: data?.data || [], error: null };
  } catch (e) {
    reportError(e, 'warehouse.fetchSchoolDaily');
    return { rows: [], error: e.message || String(e) };
  }
}

/**
 * Per-class aggregates for the current year.
 */
export async function fetchClassTerm() {
  try {
    const { data, error } = await supabase.functions.invoke('warehouse-read', {
      body: { target: 'class_term' }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { rows: data?.data || [], error: null };
  } catch (e) {
    reportError(e, 'warehouse.fetchClassTerm');
    return { rows: [], error: e.message || String(e) };
  }
}

/**
 * Per-teacher aggregates for the current year.
 */
export async function fetchTeacherTerm() {
  try {
    const { data, error } = await supabase.functions.invoke('warehouse-read', {
      body: { target: 'teacher_term' }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { rows: data?.data || [], error: null };
  } catch (e) {
    reportError(e, 'warehouse.fetchTeacherTerm');
    return { rows: [], error: e.message || String(e) };
  }
}

/**
 * Latest platform-wide benchmarks — anonymised medians/quartiles across all
 * reporting schools. Any authenticated user may read (no PII).
 */
export async function fetchLatestBenchmarks() {
  try {
    const { data, error } = await supabase.functions.invoke('warehouse-read', {
      body: { target: 'benchmarks_daily' }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { row: (data?.data && data.data[0]) || null, error: null };
  } catch (e) {
    reportError(e, 'warehouse.fetchBenchmarks');
    return { row: null, error: e.message || String(e) };
  }
}

/**
 * Trigger a warehouse refresh for the caller's school. Admin-only server-side.
 * @param {number} daysBack  How many days back to recompute (default 30).
 */
export async function refreshWarehouse(daysBack = 30) {
  try {
    const { data, error } = await supabase.functions.invoke('warehouse-refresh', {
      body: { days_back: daysBack },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { ok: true, ...data };
  } catch (e) {
    reportError(e, 'warehouse.refresh');
    return { ok: false, error: e.message || String(e) };
  }
}
