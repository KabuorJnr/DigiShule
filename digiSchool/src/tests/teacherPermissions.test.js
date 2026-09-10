import { describe, it, expect } from 'vitest';
import {
  normalizeClass,
  normalizeSubject,
  matchesClass,
  isSubjectMatch,
  resolveSubjectName,
  getTeacherAssignments,
  getTeacherAssignedSubjects,
  getTeacherAssignedClassesForSubject,
  canTeacherEnterMarksForSubjectAndClass
} from '../utils/teacherPermissions';

describe('teacherPermissions utility', () => {
  const mockSubjects = [
    { id: 'subj_mathematics', name: 'Mathematics' },
    { id: 'subj_physics', name: 'Physics' },
    { id: 'subj_english', name: 'English' },
    { id: 'subj_chemistry', name: 'Chemistry' }
  ];

  const mockAssignments = [
    {
      id: 'sa_1',
      teacher_id: 't_john',
      class_name: 'Grade 7',
      stream_name: 'East',
      subject_id: 'subj_mathematics',
      status: 'assigned'
    },
    {
      id: 'sa_2',
      teacher_id: 't_john',
      class_name: 'Grade 7',
      stream_name: 'West',
      subject_id: 'subj_mathematics',
      status: 'assigned'
    },
    {
      id: 'sa_3',
      teacher_id: 't_john',
      class_name: 'Grade 8',
      stream_name: 'North',
      subject_id: 'subj_physics',
      status: 'assigned'
    },
    {
      id: 'sa_4',
      teacher_id: 't_mary',
      class_name: 'Grade 7',
      stream_name: 'East',
      subject_id: 'subj_english',
      status: 'assigned'
    }
  ];

  const teacherJohn = {
    id: 't_john',
    name: 'John Doe',
    role: 'teacher'
  };

  const userJohn = {
    id: 'usr_john',
    teacher_id: 't_john',
    name: 'John Doe',
    role: 'teacher'
  };

  describe('class and subject matching', () => {
    it('matches exact and normalized class names', () => {
      expect(matchesClass('Grade 7 East', 'grade 7  east')).toBe(true);
      expect(matchesClass('7A', 'Grade 7A')).toBe(true);
      expect(matchesClass('Grade 7 East', 'Grade 7 West')).toBe(false);
      expect(matchesClass('Grade 7', 'Grade 7 East')).toBe(true);
    });

    it('matches subjects with case-insensitivity and aliases', () => {
      expect(isSubjectMatch('Mathematics', 'mathematics')).toBe(true);
      expect(isSubjectMatch('Maths', 'Mathematics')).toBe(true);
      expect(isSubjectMatch('Core Mathematics', 'Math')).toBe(true);
      expect(isSubjectMatch('English', 'Kiswahili')).toBe(false);
    });

    it('resolves subject names accurately', () => {
      expect(resolveSubjectName({ subject_id: 'subj_mathematics' }, mockSubjects)).toBe('Mathematics');
      expect(resolveSubjectName({ subject_name: 'Biology' }, mockSubjects)).toBe('Biology');
      expect(resolveSubjectName({ subject_id: 'subj_social_studies' }, [])).toBe('Social Studies');
    });
  });

  describe('getTeacherAssignments', () => {
    it('extracts table assignments correctly for a teacher', () => {
      const pairs = getTeacherAssignments({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects
      });

      expect(pairs.length).toBe(3);
      expect(pairs).toContainEqual(expect.objectContaining({ subject: 'Mathematics', className: 'Grade 7 East' }));
      expect(pairs).toContainEqual(expect.objectContaining({ subject: 'Mathematics', className: 'Grade 7 West' }));
      expect(pairs).toContainEqual(expect.objectContaining({ subject: 'Physics', className: 'Grade 8 North' }));
      // Should not contain Mary's English
      expect(pairs).not.toContainEqual(expect.objectContaining({ subject: 'English' }));
    });

    it('falls back to profile when no table assignments exist', () => {
      const teacherWithProfile = {
        id: 't_alice',
        subject: 'Chemistry',
        assignedClass: 'Form 3 North, Form 3 South'
      };
      const userAlice = {
        id: 'usr_alice',
        teacher_id: 't_alice',
        role: 'teacher'
      };

      const pairs = getTeacherAssignments({
        user: userAlice,
        teacherProfile: teacherWithProfile,
        subjectAssignments: [],
        subjects: mockSubjects
      });

      expect(pairs.length).toBe(2);
      expect(pairs).toContainEqual(expect.objectContaining({ subject: 'Chemistry', className: 'Form 3 North' }));
      expect(pairs).toContainEqual(expect.objectContaining({ subject: 'Chemistry', className: 'Form 3 South' }));
    });
  });

  describe('getTeacherAssignedSubjects and getTeacherAssignedClassesForSubject', () => {
    it('returns unique subjects for teacher', () => {
      const subs = getTeacherAssignedSubjects({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects
      });
      expect(subs).toEqual(['Mathematics', 'Physics']);
    });

    it('returns only classes where teacher teaches that specific subject', () => {
      const mathClasses = getTeacherAssignedClassesForSubject({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects,
        subject: 'Mathematics'
      });
      expect(mathClasses).toEqual(['Grade 7 East', 'Grade 7 West']);

      const physicsClasses = getTeacherAssignedClassesForSubject({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects,
        subject: 'Physics'
      });
      expect(physicsClasses).toEqual(['Grade 8 North']);
    });
  });

  describe('canTeacherEnterMarksForSubjectAndClass', () => {
    it('ALLOWS mark entry for assigned subject in assigned class', () => {
      const res = canTeacherEnterMarksForSubjectAndClass({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects,
        subject: 'Mathematics',
        studentClass: 'Grade 7 East'
      });
      expect(res.allowed).toBe(true);
    });

    it('BLOCKS mark entry for assigned subject in UNASSIGNED class', () => {
      const res = canTeacherEnterMarksForSubjectAndClass({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects,
        subject: 'Mathematics',
        studentClass: 'Grade 8 North' // John only teaches Physics in Grade 8 North!
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('unassigned_class');
      expect(res.message).toContain('Access Restricted');
    });

    it('BLOCKS mark entry for UNASSIGNED subject in assigned class', () => {
      const res = canTeacherEnterMarksForSubjectAndClass({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects,
        subject: 'English', // Mary teaches English in Grade 7 East, not John!
        studentClass: 'Grade 7 East'
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('unassigned_subject');
      expect(res.message).toContain('In Grade 7 East, you only teach [Mathematics]');
    });

    it('BLOCKS mark entry if teacher has neither subject nor class assigned', () => {
      const res = canTeacherEnterMarksForSubjectAndClass({
        user: userJohn,
        teacherProfile: teacherJohn,
        subjectAssignments: mockAssignments,
        subjects: mockSubjects,
        subject: 'Biology',
        studentClass: 'Grade 9 South'
      });
      expect(res.allowed).toBe(false);
    });

    it('BLOCKS teacher if they have no assignments at all', () => {
      const res = canTeacherEnterMarksForSubjectAndClass({
        user: { id: 'usr_nobody', role: 'teacher' },
        teacherProfile: { id: 't_nobody' },
        subjectAssignments: [],
        subjects: mockSubjects,
        subject: 'Mathematics',
        studentClass: 'Grade 7 East'
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('no_assignments');
    });

    it('ALLOWS executive roles override (admin, dos, deputy_academic, super_admin)', () => {
      const dosUser = { id: 'usr_dos', role: 'dos' };
      const res = canTeacherEnterMarksForSubjectAndClass({
        user: dosUser,
        teacherProfile: {},
        subjectAssignments: mockAssignments,
        subjects: mockSubjects,
        subject: 'English',
        studentClass: 'Grade 7 East'
      });
      expect(res.allowed).toBe(true);
      expect(res.reason).toBe('executive_override');
    });
  });
});
