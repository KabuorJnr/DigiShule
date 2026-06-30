export const CLASSES = ['7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B'];

export const getDynamicClasses = (students = []) => {
  const existing = students.map(s => s.class).filter(Boolean);
  return [...new Set(existing)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
