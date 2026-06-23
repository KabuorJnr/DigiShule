// Seed data for the role-specific modules (Library, Finance, Admissions,
// Clinic, Staff, Facilities).
// All mock data has been cleared per user request.

export const LIBRARY_BOOKS = [];
export const LIBRARY_LOANS = [];
export const FINANCE_PAYMENTS = [];
export const FEE_SUMMARY = [];
export const ADMISSIONS = [];
export const CLINIC_VISITS = [];
export const DISCIPLINARY_RECORDS = [];
export const STAFF = [];
export const FACILITIES = [];

export const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');
