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

// Normalise a class label for case/space-insensitive comparison.
const normClassLabel = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Parse a flat class label (e.g. "GRADE 10 A") into a level name + optional
// stream — the inverse of how expandClassesWithStreams joins them with a space.
// A trailing purely-alphabetic token counts as the stream only when an earlier
// token carries a digit (the level number), so "Grade 10 A" -> { name: "Grade
// 10", stream: "A" } while "Grade 10" (no stream) stays whole.
export const parseClassString = (str) => {
  const s = String(str || '').trim().replace(/\s+/g, ' ');
  if (!s) return { name: '', stream: '' };
  const tokens = s.split(' ');
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const rest = tokens.slice(0, -1);
    if (/^[A-Za-z]+$/.test(last) && rest.some((t) => /\d/.test(t))) {
      return { name: rest.join(' '), stream: last };
    }
  }
  return { name: s, stream: '' };
};

// Ensure the admin's [{name, streams}] class list represents every label in
// `usedClasses` (flat strings actually in use — e.g. from student records).
// Non-destructive: only ADDS a missing class or stream, never removes what the
// admin configured. Returns { classes, changed, added } so callers can persist
// only when something actually changed. Used to keep School Settings the single
// source of truth the timetable reads from, across every school.
export const reconcileClassesWithUsed = (settingsClasses = [], usedClasses = []) => {
  const classes = (settingsClasses || []).map((c) =>
    typeof c === 'string' ? { name: c, streams: '' } : { ...c }
  );
  const covered = new Set(expandClassesWithStreams(settingsClasses).map(normClassLabel));
  const added = [];

  usedClasses.forEach((raw) => {
    const label = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!label || covered.has(normClassLabel(label))) return;
    const { name, stream } = parseClassString(label);
    const entry = classes.find((c) => normClassLabel(c.name) === normClassLabel(name));
    if (entry) {
      if (!stream) return; // can't represent a streamless label under a streamed level
      const streams = (entry.streams || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (streams.some((x) => normClassLabel(x) === normClassLabel(stream))) return;
      streams.push(stream);
      entry.streams = streams.join(', ');
    } else {
      classes.push({ name, streams: stream });
    }
    covered.add(normClassLabel(label));
    added.push(label);
  });

  return { classes, changed: added.length > 0, added };
};

export const DEPARTMENTS = {
  // Mathematics
  'Mathematics': 'Math',
  'Core Mathematics': 'Math',

  // Languages
  'English': 'Languages',
  'Kiswahili': 'Languages',
  'Kenya Sign Language (KSL)': 'Languages',
  'French': 'Languages',
  'German': 'Languages',
  'Arabic': 'Languages',

  // Sciences
  'Biology': 'Sciences',
  'Chemistry': 'Sciences',
  'Physics': 'Sciences',
  'Integrated Science': 'Sciences',
  'General Science': 'Sciences',
  'Health Education': 'Sciences',

  // Humanities & Social Sciences
  'History': 'Humanities',
  'History and Government': 'Humanities',
  'Geography': 'Humanities',
  'Christian Religious Education (CRE)': 'Humanities',
  'CRE': 'Humanities',
  'Islamic Religious Education (IRE)': 'Humanities',
  'IRE': 'Humanities',
  'Hindu Religious Education (HRE)': 'Humanities',
  'Social Studies': 'Humanities',

  // Technical, Applied & Business
  'Business Studies': 'Technical',
  'Agriculture': 'Technical',
  'Agriculture & Nutrition': 'Technical',
  'Computer Studies': 'Technical',
  'Pre-Technical Studies': 'Technical',
  'Home Science': 'Technical',

  // Creative Arts & Sports
  'Creative Arts & Sports': 'Creative Arts',
  'Creative Arts': 'Creative Arts',
  'Music': 'Creative Arts',
  'Art & Design': 'Creative Arts',
  'Community Service Learning': 'Humanities',
  'Physical Education': 'Creative Arts'
};

export const SUBJECTS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'Geography',
  'Christian Religious Education (CRE)',
  'Islamic Religious Education (IRE)',
  'Hindu Religious Education (HRE)',
  'Social Studies',
  'Business Studies',
  'Agriculture',
  'Agriculture & Nutrition',
  'Computer Studies',
  'Pre-Technical Studies',
  'Creative Arts & Sports',
  'Creative Arts',
  'Home Science',
  'Music',
  'Art & Design',
  'French',
  'German',
  'Arabic',
  'Community Service Learning',
  'General Science'
];

// Default departments that ship with the system.
export const DEFAULT_DEPARTMENTS = ['Sciences', 'Humanities', 'Languages', 'Math', 'Technical', 'Creative Arts'];

export const DEPT_COLORS = {
  Sciences: '#3B82F6',
  Humanities: '#10B981',
  Languages: '#8B5CF6',
  Math: '#F59E0B',
  Technical: '#06B6D4',
  'Creative Arts': '#EC4899',
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
  'Mathematics': { code: '121', initials: 'MAT', short: 'Maths', color: '#F59E0B' },
  'Core Mathematics': { code: '121', initials: 'MAT', short: 'Maths', color: '#F59E0B' },
  'English':     { code: '101', initials: 'ENG', short: 'Eng',   color: '#8B5CF6' },
  'Kiswahili':   { code: '102', initials: 'KIS', short: 'Kisw',  color: '#A855F7' },
  'Biology':     { code: '231', initials: 'BIO', short: 'Bio',   color: '#3B82F6' },
  'Chemistry':   { code: '233', initials: 'CHE', short: 'Chem',  color: '#0EA5E9' },
  'Physics':     { code: '232', initials: 'PHY', short: 'Phys',  color: '#6366F1' },
  'Integrated Science': { code: '234', initials: 'ISC', short: 'Int.Sci', color: '#0EA5E9' },
  'General Science': { code: '235', initials: 'GSC', short: 'Gen.Sci', color: '#3B82F6' },
  'Health Education': { code: '236', initials: 'HED', short: 'Health', color: '#10B981' },
  'History':     { code: '311', initials: 'HIS', short: 'Hist',  color: '#10B981' },
  'History and Government': { code: '311', initials: 'HIS', short: 'Hist', color: '#10B981' },
  'Geography':   { code: '312', initials: 'GEO', short: 'Geo',   color: '#14B8A6' },
  'Christian Religious Education (CRE)': { code: '313', initials: 'CRE', short: 'CRE', color: '#F59E0B' },
  'CRE':         { code: '313', initials: 'CRE', short: 'CRE',   color: '#F59E0B' },
  'Islamic Religious Education (IRE)': { code: '314', initials: 'IRE', short: 'IRE', color: '#10B981' },
  'IRE':         { code: '314', initials: 'IRE', short: 'IRE',   color: '#10B981' },
  'Hindu Religious Education (HRE)': { code: '315', initials: 'HRE', short: 'HRE', color: '#EC4899' },
  'Social Studies': { code: '316', initials: 'SST', short: 'Soc.St', color: '#10B981' },
  'Business Studies': { code: '565', initials: 'BST', short: 'B.Stud', color: '#6366F1' },
  'Agriculture': { code: '443', initials: 'AGR', short: 'Agric', color: '#84CC16' },
  'Agriculture & Nutrition': { code: '443', initials: 'AGR', short: 'Agric', color: '#84CC16' },
  'Computer Studies': { code: '451', initials: 'CS', short: 'Comp', color: '#06B6D4' },
  'Pre-Technical Studies': { code: '452', initials: 'PTS', short: 'Pre-Tech', color: '#06B6D4' },
  'Home Science': { code: '441', initials: 'HSC', short: 'H.Sci', color: '#F43F5E' },
  'Creative Arts & Sports': { code: '601', initials: 'CAS', short: 'Arts', color: '#EC4899' },
  'Creative Arts': { code: '602', initials: 'ART', short: 'Art', color: '#EC4899' },
  'Music':       { code: '511', initials: 'MUS', short: 'Music', color: '#D946EF' },
  'Art & Design': { code: '512', initials: 'ART', short: 'Art', color: '#EC4899' },
  'French':      { code: '501', initials: 'FRE', short: 'French', color: '#3B82F6' },
  'German':      { code: '502', initials: 'GER', short: 'German', color: '#F97316' },
  'Arabic':      { code: '503', initials: 'ARA', short: 'Arabic', color: '#14B8A6' },
  'Kenya Sign Language (KSL)': { code: '504', initials: 'KSL', short: 'KSL', color: '#8B5CF6' },
  'Community Service Learning': { code: '701', initials: 'CSL', short: 'CSL', color: '#8B5CF6' },
  'Physical Education': { code: '702', initials: 'PE', short: 'PE', color: '#10B981' }
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
