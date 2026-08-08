export const CLASSES = ['7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B'];

export const getDynamicClasses = (students = []) => {
  const existing = students.map(s => s.class).filter(Boolean);
  return [...new Set(existing)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

export const expandClassesWithStreams = (classes = []) => {
  if (!classes || !classes.length) return [];
  const expanded = [];
  classes.forEach(c => {
    if (!c.streams || !c.streams.trim()) {
      expanded.push(c.name);
    } else {
      const streams = c.streams.split(',').map(s => s.trim()).filter(Boolean);
      if (streams.length === 0) expanded.push(c.name);
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

export const DEPT_COLORS = {
  Sciences: '#3B82F6',
  Humanities: '#10B981',
  Languages: '#8B5CF6',
  Math: '#F59E0B',
};

// Zeraki-style subject metadata: KNEC-ish code, short initials and a display colour.
export const SUBJECT_META = {
  Mathematics: { code: '121', initials: 'MAT', color: '#F59E0B' },
  English:     { code: '101', initials: 'ENG', color: '#8B5CF6' },
  Kiswahili:   { code: '102', initials: 'KIS', color: '#A855F7' },
  Biology:     { code: '231', initials: 'BIO', color: '#3B82F6' },
  Chemistry:   { code: '233', initials: 'CHE', color: '#0EA5E9' },
  Physics:     { code: '232', initials: 'PHY', color: '#6366F1' },
  History:     { code: '311', initials: 'HIS', color: '#10B981' },
  Geography:   { code: '312', initials: 'GEO', color: '#14B8A6' },
};

// Metadata for any subject, deriving sensible defaults for ones not in SUBJECT_META.
export const getSubjectMeta = (name) => SUBJECT_META[name] || {
  code: '',
  initials: (name || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '—',
  color: DEPT_COLORS[DEPARTMENTS[name]] || '#64748b',
};
