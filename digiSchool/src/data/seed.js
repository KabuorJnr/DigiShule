export const CLASSES = ['7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B'];

export const getDynamicClasses = (students = []) => {
  const existing = students.map(s => s.class).filter(Boolean);
  return [...new Set(existing)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

export const expandClassesWithStreams = (classes = []) => {
  if (!classes || !classes.length) return [];
  const expanded = [];
  classes.forEach(c => {
    if (typeof c === 'string') {
      if (c.trim()) expanded.push(c.trim());
      return;
    }
    if (!c.streams || !c.streams.trim()) {
      if (c.name) expanded.push(c.name);
    } else {
      const streams = c.streams.split(',').map(s => s.trim()).filter(Boolean);
      if (streams.length === 0 && c.name) expanded.push(c.name);
      else streams.forEach(s => expanded.push(`${c.name} ${s}`));
    }
  });
  return expanded;
};

export const DEPARTMENTS = {
  Mathematics: 'Math',
  English: 'Languages',
  Kiswahili: 'Languages',
  Biology: 'Sciences',
  Chemistry: 'Sciences',
  Physics: 'Sciences',
  History: 'Humanities',
  Geography: 'Humanities',
};

export const SUBJECTS = Object.keys(DEPARTMENTS);

// Default departments that ship with the system.
export const DEFAULT_DEPARTMENTS = ['Sciences', 'Humanities', 'Languages', 'Math'];

export const DEPT_COLORS = {
  Sciences: '#3B82F6',
  Humanities: '#10B981',
  Languages: '#8B5CF6',
  Math: '#F59E0B',
};

// Extra color pool for user-created departments (cycled through).
const EXTRA_DEPT_COLORS = [
  '#EC4899', '#F97316', '#14B8A6', '#6366F1', '#EF4444',
  '#84CC16', '#06B6D4', '#A855F7', '#F43F5E', '#22D3EE',
  '#D946EF', '#0EA5E9',
];

// Get a deterministic color for any department name (including custom ones).
export const getDeptColor = (deptName) => {
  if (DEPT_COLORS[deptName]) return DEPT_COLORS[deptName];
  // Deterministic hash-based color from the extra pool
  let hash = 0;
  for (let i = 0; i < (deptName || '').length; i++) hash = ((hash << 5) - hash + deptName.charCodeAt(i)) | 0;
  return EXTRA_DEPT_COLORS[Math.abs(hash) % EXTRA_DEPT_COLORS.length];
};

// Zeraki-style subject metadata: KNEC-ish code, short initials and a display colour.
export const SUBJECT_META = {
  Mathematics: { code: '121', initials: 'MAT', short: 'Maths', color: '#F59E0B' },
  English:     { code: '101', initials: 'ENG', short: 'Eng',   color: '#8B5CF6' },
  Kiswahili:   { code: '102', initials: 'KIS', short: 'Kisw',  color: '#A855F7' },
  Biology:     { code: '231', initials: 'BIO', short: 'Bio',   color: '#3B82F6' },
  Chemistry:   { code: '233', initials: 'CHE', short: 'Chem',  color: '#0EA5E9' },
  Physics:     { code: '232', initials: 'PHY', short: 'Phys',  color: '#6366F1' },
  History:     { code: '311', initials: 'HIS', short: 'Hist',  color: '#10B981' },
  Geography:   { code: '312', initials: 'GEO', short: 'Geo',   color: '#14B8A6' },
};

// Metadata for any subject, deriving sensible defaults for ones not in SUBJECT_META.
// Accepts an optional schoolSubjects array [{name, dept}] to derive colors from the
// school's custom department assignments instead of the hardcoded DEPARTMENTS map.
export const getSubjectMeta = (name, schoolSubjects) => {
  if (SUBJECT_META[name]) return SUBJECT_META[name];
  // Try to find department from school subjects first, then hardcoded fallback
  let dept = DEPARTMENTS[name];
  if (!dept && Array.isArray(schoolSubjects)) {
    const match = schoolSubjects.find(s => (typeof s === 'string' ? s : s?.name) === name);
    if (match && typeof match !== 'string') dept = match.dept;
  }
  return {
    code: '',
    initials: (name || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '—',
    short: (name || '').length <= 7 ? (name || '—') : `${name.slice(0, 6)}.`,
    color: getDeptColor(dept) || '#64748b',
  };
};
