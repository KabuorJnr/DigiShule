/**
 * DigiShule Teacher Permission & Subject-Class Assignment Engine
 * 
 * Strictly enforces that teachers can ONLY enter, modify, or paste marks
 * for subjects they teach in their assigned classes.
 */

// Normalize a class label for comparison
export function normalizeClass(str) {
  return String(str || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Normalize a subject name for comparison
export function normalizeSubject(str) {
  return String(str || '')
    .trim()
    .toLowerCase();
}

/**
 * Compare two class names:
 * E.g. "Grade 7 East" and "Grade 7 East" -> true
 * If an assignment is for "Grade 7" (no stream specified), it covers all streams of Grade 7.
 * If an assignment is for "Grade 7 East", it does NOT match "Grade 7 West".
 */
export function matchesClass(assignmentClass, targetClass) {
  const normAssign = normalizeClass(assignmentClass);
  const normTarget = normalizeClass(targetClass);

  if (!normAssign || !normTarget) return false;
  if (normAssign === normTarget) return true;

  // Short codes like "7a" vs "grade 7a" or "7 a"
  const cleanAssign = normAssign.replace(/\b(grade|form|class|std|standard)\b/g, '').replace(/\s+/g, '').trim();
  const cleanTarget = normTarget.replace(/\b(grade|form|class|std|standard)\b/g, '').replace(/\s+/g, '').trim();
  if (cleanAssign && cleanAssign === cleanTarget) return true;

  // Level-only assignment matching stream:
  // If assignment has no stream token (e.g. "grade 7" or "form 1")
  // and target is "grade 7 east", check if target starts with assignment
  const assignWords = normAssign.split(' ');
  const targetWords = normTarget.split(' ');

  // If assignment specifies level only (e.g. "Grade 7") and target is "Grade 7 East"
  if (assignWords.length === 1 && targetWords.length > 1) {
    if (normTarget.startsWith(normAssign)) return true;
  }
  if (normAssign.startsWith('grade ') || normAssign.startsWith('form ')) {
    if (assignWords.length === 2 && targetWords.length > 2 && normTarget.startsWith(normAssign)) {
      return true;
    }
  }

  return false;
}

/**
 * Compare two subject names with case-insensitivity and alias support
 */
export function isSubjectMatch(subA, subB) {
  const normA = normalizeSubject(subA);
  const normB = normalizeSubject(subB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Math aliases
  const isMathA = normA === 'math' || normA === 'maths' || normA === 'mathematics' || normA === 'core mathematics';
  const isMathB = normB === 'math' || normB === 'maths' || normB === 'mathematics' || normB === 'core mathematics';
  if (isMathA && isMathB) return true;

  // Kiswahili aliases
  const isKiswA = normA === 'kiswahili' || normA === 'kisw';
  const isKiswB = normB === 'kiswahili' || normB === 'kisw';
  if (isKiswA && isKiswB) return true;

  // English aliases
  const isEngA = normA === 'english' || normA === 'eng';
  const isEngB = normB === 'english' || normB === 'eng';
  if (isEngA && isEngB) return true;

  // Chemistry aliases
  const isChemA = normA === 'chem' || normA === 'chemistry';
  const isChemB = normB === 'chem' || normB === 'chemistry';
  if (isChemA && isChemB) return true;

  // Physics aliases
  const isPhysA = normA === 'phys' || normA === 'physics';
  const isPhysB = normB === 'phys' || normB === 'physics';
  if (isPhysA && isPhysB) return true;

  // Biology aliases
  const isBioA = normA === 'bio' || normA === 'biology';
  const isBioB = normB === 'bio' || normB === 'biology';
  if (isBioA && isBioB) return true;

  return false;
}

/**
 * Resolve subject name from an assignment row
 */
export function resolveSubjectName(assignment, subjectsList = []) {
  if (!assignment) return '';
  if (assignment.subject_name) return assignment.subject_name;
  if (assignment.subject) return assignment.subject;

  if (assignment.subject_id) {
    const found = (subjectsList || []).find(s => s.id === assignment.subject_id);
    if (found?.name) return found.name;

    // e.g. "subj_mathematics" -> "Mathematics"
    if (String(assignment.subject_id).startsWith('subj_')) {
      const clean = String(assignment.subject_id).replace(/^subj_/, '').replace(/_/g, ' ');
      return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return assignment.subject_id;
  }

  return '';
}

/**
 * Extract all assigned (subject, class) pairs for a teacher
 */
export function getTeacherAssignments({
  user,
  teacherProfile,
  subjectAssignments = [],
  subjects = []
}) {
  const teacherId = teacherProfile?.id || user?.teacher_id || user?.id;
  const teacherEmpId = teacherProfile?.emp_id || user?.emp_id;
  const teacherName = (teacherProfile?.name || teacherProfile?.full_name || user?.name || '').trim().toLowerCase();

  const pairs = [];
  const seen = new Set();

  const addPair = (subject, className, source = 'assignment') => {
    if (!subject || !className) return;
    const cleanSub = String(subject).trim();
    const cleanCls = String(className).trim();
    const key = `${normalizeSubject(cleanSub)}:::${normalizeClass(cleanCls)}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({
        subject: cleanSub,
        className: cleanCls,
        source
      });
    }
  };

  // 1. Check subjectAssignments table rows
  if (Array.isArray(subjectAssignments) && subjectAssignments.length > 0) {
    const myAssignments = subjectAssignments.filter(a => {
      // Must be assigned
      if (a.status && a.status !== 'assigned') return false;

      // ID matching
      if (teacherId && (a.teacher_id === teacherId || String(a.teacher_id) === String(teacherId))) return true;
      if (user?.id && (a.teacher_id === user.id || String(a.teacher_id) === String(user.id))) return true;
      if (user?.teacher_id && (a.teacher_id === user.teacher_id || String(a.teacher_id) === String(user.teacher_id))) return true;
      if (teacherEmpId && (a.teacher_id === teacherEmpId || String(a.teacher_id) === String(teacherEmpId))) return true;

      // Name matching
      if (teacherName && a.teacher_name && a.teacher_name.toLowerCase().trim() === teacherName) return true;

      return false;
    });

    myAssignments.forEach(a => {
      const subj = resolveSubjectName(a, subjects);
      const cls = a.stream_name ? `${a.class_name} ${a.stream_name}` : a.class_name;
      if (subj && cls) {
        addPair(subj, cls, 'table_assignment');
      }
    });
  }

  // 2. Direct teacher profile fallback (if no table assignments exist for this teacher)
  if (pairs.length === 0) {
    const rawSubjects = [];
    if (teacherProfile?.subject) rawSubjects.push(teacherProfile.subject);
    if (teacherProfile?.dept) rawSubjects.push(teacherProfile.dept);
    if (user?.subject) rawSubjects.push(user.subject);
    if (user?.dept) rawSubjects.push(user.dept);
    if (Array.isArray(teacherProfile?.subjects)) rawSubjects.push(...teacherProfile.subjects);
    else if (typeof teacherProfile?.subjects === 'string') rawSubjects.push(...teacherProfile.subjects.split(','));

    const rawClasses = [];
    if (teacherProfile?.assignedClass) rawClasses.push(teacherProfile.assignedClass);
    if (teacherProfile?.assigned_class) rawClasses.push(teacherProfile.assigned_class);
    if (teacherProfile?.class) rawClasses.push(teacherProfile.class);
    if (user?.assignedClass) rawClasses.push(user.assignedClass);
    if (user?.assigned_class) rawClasses.push(user.assigned_class);
    if (user?.class) rawClasses.push(user.class);
    if (Array.isArray(teacherProfile?.classes)) rawClasses.push(...teacherProfile.classes);
    else if (typeof teacherProfile?.classes === 'string') rawClasses.push(...teacherProfile.classes.split(','));

    const uniqueSubjects = [...new Set(rawSubjects.map(s => String(s || '').trim()).filter(Boolean))];
    const uniqueClasses = [...new Set(rawClasses.flatMap(c => String(c || '').split(',')).map(c => c.trim()).filter(Boolean))];

    uniqueSubjects.forEach(s => {
      uniqueClasses.forEach(c => {
        addPair(s, c, 'profile_config');
      });
    });
  }

  return pairs;
}

/**
 * Get all distinct subjects a teacher is assigned to teach
 */
export function getTeacherAssignedSubjects({
  user,
  teacherProfile,
  subjectAssignments = [],
  subjects = []
}) {
  const assignments = getTeacherAssignments({ user, teacherProfile, subjectAssignments, subjects });
  const unique = [];
  const seen = new Set();
  assignments.forEach(a => {
    const norm = normalizeSubject(a.subject);
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(a.subject);
    }
  });
  return unique;
}

/**
 * Get all classes a teacher is assigned to teach for a specific subject
 */
export function getTeacherAssignedClassesForSubject({
  user,
  teacherProfile,
  subjectAssignments = [],
  subjects = [],
  subject
}) {
  if (!subject) return [];
  const assignments = getTeacherAssignments({ user, teacherProfile, subjectAssignments, subjects });
  const matching = assignments.filter(a => isSubjectMatch(a.subject, subject));
  const unique = [];
  const seen = new Set();
  matching.forEach(a => {
    const norm = normalizeClass(a.className);
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(a.className);
    }
  });
  return unique;
}

/**
 * Core Permission Check:
 * Can this teacher enter marks for this subject in this student's class?
 */
export function canTeacherEnterMarksForSubjectAndClass({
  user,
  teacherProfile,
  subjectAssignments = [],
  subjects = [],
  subject,
  studentClass,
  bypassRoles = ['admin', 'dos', 'deputy_academic', 'super_admin']
}) {
  // 1. Administrative Executive Override (only when acting in executive role, not regular teacher role)
  if (user?.role && bypassRoles.includes(user.role.toLowerCase()) && user.role.toLowerCase() !== 'teacher') {
    return { allowed: true, reason: 'executive_override' };
  }

  if (!subject || !studentClass) {
    return {
      allowed: false,
      reason: 'missing_parameters',
      message: 'Subject and Class must be specified to verify permission.'
    };
  }

  // 2. Fetch the teacher's exact assigned pairs
  const assignments = getTeacherAssignments({ user, teacherProfile, subjectAssignments, subjects });

  if (assignments.length === 0) {
    return {
      allowed: false,
      reason: 'no_assignments',
      message: 'You have no active subject-class assignments. Contact your administrator.'
    };
  }

  // 3. Check for matching assignment pair
  const isMatch = assignments.some(a => 
    isSubjectMatch(a.subject, subject) && matchesClass(a.className, studentClass)
  );

  if (isMatch) {
    return { allowed: true };
  }

  // 4. Generate helpful diagnostic feedback
  const teachesSubjectElsewhere = assignments.some(a => isSubjectMatch(a.subject, subject));
  const teachesClassOtherSubject = assignments.some(a => matchesClass(a.className, studentClass));

  if (teachesSubjectElsewhere) {
    const assignedClassesForSub = assignments.filter(a => isSubjectMatch(a.subject, subject)).map(a => a.className);
    return {
      allowed: false,
      reason: 'unassigned_class',
      message: `Access Restricted: You are assigned to teach ${subject} in [${assignedClassesForSub.join(', ')}], not in ${studentClass}.`
    };
  }

  if (teachesClassOtherSubject) {
    const otherSubjectsInClass = assignments.filter(a => matchesClass(a.className, studentClass)).map(a => a.subject);
    return {
      allowed: false,
      reason: 'unassigned_subject',
      message: `Access Restricted: In ${studentClass}, you only teach [${otherSubjectsInClass.join(', ')}]. You cannot enter marks for ${subject}.`
    };
  }

  return {
    allowed: false,
    reason: 'unassigned_pair',
    message: `Access Restricted: You are not assigned to teach ${subject} in ${studentClass}.`
  };
}
