// Export helpers for CSV, Excel (SheetJS) and PDF (jsPDF + autotable).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { computeStudentReport } from './grading';
import { getSubjectMeta } from '../data/seed';

export function exportNemisCSV(students, filename = 'NEMIS_Export.csv') {
  // NEMIS Standard Format Columns
  const headers = ['UPI_Number', 'Student_Name', 'Birth_Cert_No', 'Gender', 'Grade_Form', 'Parent_Guardian', 'Phone_Contact', 'Status'];
  const rows = students.map(s => [
    s.nemis_upi || s.adm || '', // Use NEMIS UPI if available, fallback to local ADM
    s.name || '',
    s.birth_cert_no || '',
    s.gender || '',
    s.class || '',
    s.guardian_name || '',
    s.guardian_phone || '',
    s.status || 'Active'
  ]);
  
  const csvContent = [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadCSV(filename, rows) {
  // rows: array of arrays (first row = header)
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = cell == null ? '' : String(cell);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(',')
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExcel(filename, sheets) {
  // sheets: [{ name, aoa: array-of-arrays }]
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

function pdfHeader(doc, school, title, subtitle) {
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text(school?.name || 'School', 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (school?.motto) doc.text(school.motto, 40, 56);
  if (school?.address) doc.text(school.address, 40, 70);
  doc.setDrawColor(226, 232, 240);
  doc.line(40, 80, 555, 80);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 40, 102);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 40, 118);
  }
}

export function exportTablePDF({ school, title, subtitle, head, body, filename }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  pdfHeader(doc, school, title, subtitle);
  autoTable(doc, {
    head: [head],
    body,
    startY: 132,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });
  doc.save(filename);
}

// ── Class attendance register / class list, one register per stream ─────────
// Modeled on a standard attendance register: a centred school letterhead
// (from Settings, not a hardcoded institution), a meta strip, then a table of
// # · ADM NO · STUDENT NAME · GENDER, a run of blank dated attendance columns
// and a percentage column. Each stream prints on its own page.
export function exportClassListPDF({ school = {}, term = '', year = '', groups = [], attendanceCols = 8, filename = 'class_lists.pdf' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const INK = [17, 24, 39];      // #111827
  const MUTED = [107, 114, 128]; // #6b7280
  const LINE = [203, 213, 225];  // #cbd5e1

  const validGroups = groups.filter(g => g && Array.isArray(g.students) && g.students.length > 0);
  if (validGroups.length === 0) return;

  const printedOn = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  validGroups.forEach((group, gi) => {
    if (gi > 0) doc.addPage();

    // ── School letterhead (replaces any external institution header) ────────
    const schoolName = (school.name || 'School').trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    doc.text(schoolName.toUpperCase(), pageW / 2, 44, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const contactParts = [school.address, school.phone || school.tel, school.email].filter(Boolean);
    if (contactParts.length) doc.text(contactParts.join('  ·  '), pageW / 2, 58, { align: 'center' });
    if (school.motto) {
      doc.setFont('helvetica', 'italic');
      doc.text(`"${String(school.motto)}"`, pageW / 2, contactParts.length ? 70 : 58, { align: 'center' });
    }

    let y = (school.motto ? 82 : (contactParts.length ? 70 : 58));

    // Divider
    doc.setDrawColor(...INK);
    doc.setLineWidth(1);
    doc.line(40, y, pageW - 40, y);
    y += 20;

    // ── Register title ──────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text('CLASS ATTENDANCE REGISTER', pageW / 2, y, { align: 'center' });
    y += 20;

    // ── Meta strip: class/stream + term on the left, printed-on + total right ─
    const periodLabel = [term, year].filter(Boolean).join(' ');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text('CLASS: ', 40, y);
    const clsLabelW = doc.getTextWidth('CLASS: ');
    doc.setFont('helvetica', 'normal');
    doc.text(String(group.label || '—').toUpperCase(), 40 + clsLabelW, y);
    doc.text(`PRINTED ON: ${printedOn}`, pageW - 40, y, { align: 'right' });

    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('TERM: ', 40, y);
    const termLabelW = doc.getTextWidth('TERM: ');
    doc.setFont('helvetica', 'normal');
    doc.text(periodLabel || '—', 40 + termLabelW, y);
    doc.text(`TOTAL STUDENTS: ${group.students.length}`, pageW - 40, y, { align: 'right' });
    y += 12;

    // ── Register table ──────────────────────────────────────────────────────
    const dateHead = Array.from({ length: attendanceCols }, () => '__/__');
    const head = ['#', 'ADM NO', 'STUDENT NAME', 'SEX', ...dateHead, '%'];

    const body = group.students.map((s, idx) => [
      idx + 1,
      s.adm || s.admission_no || '—',
      (s.name || '—').toUpperCase(),
      (s.gender || '-').charAt(0).toUpperCase(),
      ...Array.from({ length: attendanceCols }, () => ''),
      '',
    ]);

    const dateColStyles = {};
    for (let i = 0; i < attendanceCols; i++) dateColStyles[4 + i] = { cellWidth: 22, halign: 'center' };

    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5, valign: 'middle' },
      headStyles: { fontStyle: 'bold', fillColor: INK, textColor: [255, 255, 255], halign: 'center', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 66 },
        2: { cellWidth: 'auto', fontStyle: 'bold' },
        3: { cellWidth: 26, halign: 'center' },
        ...dateColStyles,
        [4 + attendanceCols]: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: 40, right: 40 },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 2) data.cell.styles.halign = 'left';
        if (data.section === 'head' && data.column.index === 1) data.cell.styles.halign = 'left';
      },
    });

    // ── Signature footer ────────────────────────────────────────────────────
    let fy = doc.lastAutoTable.finalY + 28;
    if (fy > pageH - 60) { doc.addPage(); fy = 60; }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    const colW = (pageW - 80) / 2;
    doc.text('CLASS TEACHER: ______________________________', 40, fy);
    doc.text('SIGN: ____________  DATE: ____________', 40 + colW, fy);

    // ── Page footer ─────────────────────────────────────────────────────────
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, 40, pageH - 22);
    doc.text(`Page ${gi + 1} of ${validGroups.length}`, pageW - 40, pageH - 22, { align: 'right' });
  });

  doc.save(filename);
}

export function exportReportCardsPDF({ school = {}, gradeBoundaries = [], students = [], subjects = [], examTitle = 'Term 1 Opening Exam', termName = 'Term 1', filename = 'report_cards.pdf' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const targetStudents = students.length > 0 ? students : [];

  targetStudents.forEach((stu, idx) => {
    if (idx > 0) doc.addPage();

    const r = computeStudentReport({
      student: stu,
      students: targetStudents,
      subjects: subjects,
      examTitle: examTitle,
      termName: termName,
      gradeBoundaries: gradeBoundaries
    });

    if (!r) return;
    renderReportCard(doc, r, school, pageWidth, pageHeight, idx + 1, targetStudents.length);
  });

  doc.save(filename);
}

// Unified, clean single-page report card for both CBC (8-tier) and 8-4-4 (KCSE 12-tier).
// Design: one dark ink palette, no gradients, no fake QR/verification, no hardcoded
// school placeholders. Comments start blank when there is nothing meaningful to say.
function renderReportCard(doc, r, school, pageW, pageH, pageIndex, pageCount) {
  const is844 = r.systemType === '844';
  const INK = [17, 24, 39];      // #111827
  const MUTED = [107, 114, 128]; // #6b7280
  const LINE = [229, 231, 235];  // #e5e7eb
  const SOFT = [249, 250, 251];  // #f9fafb

  // ── School header ────────────────────────────────────────────────────────
  const schoolName = (school.name || '').trim();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  if (schoolName) doc.text(schoolName.toUpperCase(), pageW / 2, 46, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const contactParts = [school.address, school.phone || school.tel, school.email].filter(Boolean);
  if (contactParts.length) doc.text(contactParts.join('  ·  '), pageW / 2, 60, { align: 'center' });
  if (school.motto) {
    doc.setFont('helvetica', 'italic');
    doc.text(String(school.motto), pageW / 2, contactParts.length ? 72 : 60, { align: 'center' });
  }

  let y = (school.motto ? 84 : (contactParts.length ? 72 : 60)) + 8;

  // Thin divider
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.75);
  doc.line(40, y, pageW - 40, y);
  y += 14;

  // ── Document title ───────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(is844 ? 'ACADEMIC REPORT' : 'LEARNER ASSESSMENT REPORT', pageW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${String(r.examTitle)} · ${String(r.termName)}`, pageW / 2, y + 12, { align: 'center' });
  y += 26;

  // ── Student info strip ──────────────────────────────────────────────────
  doc.setDrawColor(...LINE);
  doc.setFillColor(...SOFT);
  doc.roundedRect(40, y, pageW - 80, 44, 4, 4, 'FD');

  const fields = [
    { k: 'Name', v: r.studentName || '' },
    { k: 'Adm No.', v: String(r.admissionNo || '—') },
    { k: 'Class', v: String(r.className || '—') },
    { k: 'Position', v: r.classPosition ? `${r.classPosition} of ${r.classSize}` : '—' },
  ];
  const colW = (pageW - 80) / fields.length;
  fields.forEach((f, i) => {
    const cx = 40 + i * colW + 12;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(f.k.toUpperCase(), cx, y + 14);
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.text(String(f.v), cx, y + 32);
    if (i > 0) {
      doc.setDrawColor(...LINE);
      doc.line(40 + i * colW, y + 6, 40 + i * colW, y + 38);
    }
  });
  y += 56;

  // ── Subject table ────────────────────────────────────────────────────────
  const subjectHead = is844
    ? ['Subject', 'Score', '%', 'Grade', 'Pts', 'Remark']
    : ['Learning Area', 'Score', '%', 'Level', 'Pts', 'Remark'];

  const subjectBody = r.subjectRows.map(s => [
    s.subject,
    s.scoreText || '—',
    s.percentageText || (s.percentage != null ? `${s.percentage}%` : '—'),
    s.gradeCode || s.gradeFull || '—',
    s.pts != null ? String(s.pts) : '—',
    s.remark || '',
  ]);

  const maxPts = is844 ? 12 : 8;
  subjectBody.push([
    { content: 'TOTAL / MEAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: SOFT, textColor: INK } },
    { content: r.meanPercentageText || '—', styles: { fontStyle: 'bold', fillColor: SOFT, textColor: INK, halign: 'center' } },
    { content: r.meanGradeCode || r.meanGradeFull || '—', styles: { fontStyle: 'bold', fillColor: SOFT, textColor: INK, halign: 'center' } },
    { content: `${r.totalPoints}/${r.subjectRows.length * maxPts}`, styles: { fontStyle: 'bold', fillColor: SOFT, textColor: INK, halign: 'center' } },
    { content: '', styles: { fillColor: SOFT } },
  ]);

  autoTable(doc, {
    head: [subjectHead],
    body: subjectBody,
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, textColor: INK, lineColor: LINE, lineWidth: 0.5, valign: 'middle' },
    headStyles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: INK, halign: 'left' },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 55 },
      2: { halign: 'center', cellWidth: 45 },
      3: { halign: 'center', cellWidth: 55, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 40 },
      5: { cellWidth: 'auto' },
    },
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'center';
    },
  });

  y = doc.lastAutoTable.finalY + 14;

  // ── Grade key (single row, muted text) ─────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('GRADING KEY', 40, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK);
  const key = is844
    ? 'A 80–100  ·  A- 75–79  ·  B+ 70–74  ·  B 65–69  ·  B- 60–64  ·  C+ 55–59  ·  C 50–54  ·  C- 45–49  ·  D+ 40–44  ·  D 35–39  ·  D- 30–34  ·  E 0–29'
    : 'EE1 90–100  ·  EE2 75–89  ·  ME1 58–74  ·  ME2 41–57  ·  AE1 31–40  ·  AE2 21–30  ·  BE1 11–20  ·  BE2 0–10';
  doc.text(key, 40, y, { maxWidth: pageW - 80 });
  y += is844 ? 20 : 14;

  // ── Comments (blank lines to write on; no fake auto-remarks) ────────────
  const commentH = 46;
  const half = (pageW - 80) / 2 - 6;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.roundedRect(40, y, half, commentH, 4, 4, 'S');
  doc.roundedRect(40 + half + 12, y, half, commentH, 4, 4, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text("CLASS TEACHER'S COMMENT", 46, y + 12);
  doc.text("PRINCIPAL'S COMMENT", 46 + half + 12, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK);
  doc.text('Signature: ____________________   Date: ____________', 46, y + commentH - 6);
  doc.text('Signature: ____________________   Date: ____________', 46 + half + 12, y + commentH - 6);
  y += commentH + 10;

  // ── Parent / Guardian ───────────────────────────────────────────────────
  doc.roundedRect(40, y, pageW - 80, 34, 4, 4, 'S');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text("PARENT / GUARDIAN COMMENT", 46, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK);
  doc.text('Signature: ____________________   Date: ____________', 46, y + 28);

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, 40, pageH - 22);
  if (pageCount > 1) doc.text(`Page ${pageIndex} of ${pageCount}`, pageW - 40, pageH - 22, { align: 'right' });
}

export function exportSchemeOfWorkPDF({ school, scheme, rows, filename }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  pdfHeader(doc, school, 'SCHEME OF WORK', `Class: ${scheme.class} | Subject: ${scheme.subject} | Term: ${scheme.term}`);
  
  autoTable(doc, {
    head: [['Week', 'Strand', 'Sub-Strand', 'Specific Learning Outcomes', 'Key Inquiry Questions', 'Learning Resources', 'Assessment Method', 'Remarks']],
    body: rows.map(r => [
      r.week_number || '',
      r.strand || '',
      r.sub_strand || '',
      r.specific_learning_outcomes || '',
      r.key_inquiry_questions || '',
      r.learning_resources || '',
      r.assessment_method || '',
      r.remarks || ''
    ]),
    startY: 132,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 70 },
      2: { cellWidth: 80 },
      3: { cellWidth: 150 },
      4: { cellWidth: 100 },
      5: { cellWidth: 100 },
      6: { cellWidth: 80 },
      7: { cellWidth: 100 }
    }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' });
  }

  doc.save(filename || 'Scheme_Of_Work.pdf');
}

export function exportLessonPlanPDF({ school, plan, filename }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  pdfHeader(doc, school, 'LESSON PLAN', '');

  let y = 132;
  const addLine = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(label, 40, y);
    doc.setFont('helvetica', 'normal');
    const textLines = doc.splitTextToSize(value || 'N/A', 400);
    doc.text(textLines, 160, y);
    y += (textLines.length * 14) + 6;
  };

  const addSection = (title, text) => {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text(title, 40, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    
    if (!text) {
      doc.text('N/A', 40, y);
      y += 20;
    } else {
      const textLines = doc.splitTextToSize(String(text), 515);
      doc.text(textLines, 40, y);
      y += (textLines.length * 14) + 10;
    }
  };

  // Admin details
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  
  doc.rect(40, y - 15, 515, 60);
  doc.text(`Teacher: ${plan.teacher_name || ''}`, 50, y);
  doc.text(`Date: ${plan.date || ''}`, 250, y);
  doc.text(`Time: ${plan.time_slot || ''}`, 400, y);
  y += 20;
  doc.text(`Class: ${plan.class || ''}`, 50, y);
  doc.text(`Subject: ${plan.subject || ''}`, 250, y);
  doc.text(`Term: ${plan.term || ''}`, 400, y);
  y += 40;

  addSection('Strand', plan.strand);
  addSection('Sub-Strand', plan.sub_strand);
  addSection('Specific Learning Outcomes', plan.specific_learning_outcomes);
  addSection('Key Inquiry Questions', plan.key_inquiry_questions);
  addSection('Learning Resources', plan.learning_resources);
  
  const comp = plan.core_competencies?.length ? plan.core_competencies.join(', ') : '';
  const vals = plan.values_developed?.length ? plan.values_developed.join(', ') : '';
  
  addSection('Core Competencies', comp);
  addSection('Values Developed', vals);
  addSection('PCIs (Pertinent & Contemporary Issues)', plan.pcis);

  addSection('Introduction', plan.intro_activities);
  addSection('Lesson Development: Step 1', plan.development_step1);
  addSection('Lesson Development: Step 2', plan.development_step2);
  addSection('Lesson Development: Step 3', plan.development_step3);
  addSection('Extended Activities', plan.extended_activities);
  addSection('Conclusion', plan.conclusion);
  addSection('Reflection on the Lesson', plan.reflection);

  doc.save(filename || 'Lesson_Plan.pdf');
}

// aSc-Timetables-style landscape sheet: centered "{school} Timetable {term}" title,
// a big class/teacher label, header with period numbers + times, vertical spanning
// break columns, short subject names centred with the teacher code bottom-right.
export function exportTimetableLandscapePDF({
  title, schoolName, classLabel, grid, days, filename, slots,
  variant = 'class', teacherAbbrOf, generatedLabel = 'EduOne Timetables',
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const isTeacher = variant === 'teacher';

  // Column descriptors (one per timeslot): teaching flag, period number, label, times.
  const cols = (slots && slots.length ? slots : grid.map((_, i) => ({ teaching: true, period: i + 1, label: String(i + 1), start: '', end: '' })))
    .slice(0, grid.length);

  // ---- Page headings -------------------------------------------------------
  doc.setTextColor(0);
  if (schoolName) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(schoolName, 40, 22); }
  if (title) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(title, pageW / 2, 22, { align: 'center' }); }
  if (classLabel) { doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.text(classLabel, pageW / 2, 48, { align: 'center' }); }

  const tableTop = 58;

  // ---- Build the table (content mostly drawn in didDrawCell for full control) ----
  const head = ['', ...cols.map(() => '')];
  const body = [];
  for (let d = 0; d < days.length; d++) {
    const dayShort = days[d].slice(0, 2);
    const row = [{ content: dayShort, styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 15 } }];
    for (let p = 0; p < grid.length; p++) {
      const cell = grid[p][d];
      const slot = cols[p] || { teaching: cell.type !== 'break' };
      if (!slot.teaching || cell.type === 'break') {
        if (d === 0) row.push({ content: '', rowSpan: days.length, styles: { halign: 'center', valign: 'middle' } });
      } else if (cell.type === 'lesson') {
        const meta = cell.subject ? getSubjectMeta(cell.subject) : null;
        const main = isTeacher
          ? (cell.cls ? String(cell.cls).replace(/\s+/g, '') : (meta ? meta.short : ''))
          : (meta ? meta.short : (cell.subject || ''));
        row.push({ content: main, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 11 } });
      } else {
        row.push({ content: '' });
      }
    }
    body.push(row);
  }

  // ---- Sizing: fill the page height on a single page; narrow break columns --
  const colCount = grid.length + 1;
  const cellPad = colCount >= 12 ? 3 : colCount >= 10 ? 4 : 5;
  const marginBottom = 30; // leaves room for the footer line
  const headerH = 38; // taller header so period # and time don't overlap
  const availH = pageH - tableTop - marginBottom;
  const bodyMinH = Math.max(28, Math.floor((availH - headerH) / days.length));

  const columnStyles = { 0: { cellWidth: 38, fontStyle: 'bold' } };
  cols.forEach((s, i) => { if (!s.teaching) columnStyles[i + 1] = { cellWidth: 22 }; });

  autoTable(doc, {
    head: [head],
    body,
    startY: tableTop,
    theme: 'grid',
    tableWidth: pageW - 80,
    styles: { fontSize: 11, cellPadding: cellPad, lineColor: [0, 0, 0], lineWidth: 0.75, textColor: [0, 0, 0], halign: 'center', valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [255, 255, 255], minCellHeight: headerH, lineWidth: 0.75, lineColor: [0, 0, 0] },
    bodyStyles: { fillColor: [255, 255, 255], minCellHeight: bodyMinH },
    columnStyles,
    margin: { left: 40, right: 40, top: tableTop, bottom: marginBottom },
    rowPageBreak: 'avoid',
    didDrawCell: (data) => {
      const ci = data.column.index;
      const ti = ci - 1;
      const cx = data.cell.x + data.cell.width / 2;

      // Header: period number on top, bold time range below (no overlap).
      if (data.section === 'head') {
        if (ci === 0) return;
        const slot = cols[ti];
        if (!slot) return;
        doc.setTextColor(0);
        // Overpaint the whole header cell white so nothing autoTable drew earlier bleeds through.
        doc.setFillColor(255, 255, 255);
        doc.rect(data.cell.x + 0.4, data.cell.y + 0.4, data.cell.width - 0.8, data.cell.height - 0.8, 'F');
        doc.setFont('helvetica', 'bold');
        if (slot.teaching) {
          // Period number, bold, top-aligned.
          doc.setFontSize(11);
          doc.text(String(slot.period), cx, data.cell.y + 14, { align: 'center' });
          // Bold time range, bottom-aligned — clear space between them, no overlap.
          if (slot.start) {
            doc.setFontSize(6.8); doc.setTextColor(60);
            doc.text(`${slot.start} - ${slot.end}`, cx, data.cell.y + data.cell.height - 7, { align: 'center' });
            doc.setTextColor(0);
          }
        } else {
          // Narrow break/lunch column: small bold label, centered.
          doc.setFontSize(6.5);
          doc.text(String(slot.label), cx, data.cell.y + data.cell.height / 2 + 2, { align: 'center' });
        }
        return;
      }
      if (data.section !== 'body' || ci === 0) return;

      const slot = cols[ti];
      const gcell = grid[ti] && grid[ti][data.row.index];

      // Break / lunch: big vertical rotated label in the spanning cell.
      if (slot && !slot.teaching) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
        doc.text(String(slot.label), cx + 4, data.cell.y + data.cell.height / 2, { align: 'center', angle: 90 });
        return;
      }

      // Lesson corner tag: teacher code (class view) or subject short name (teacher view).
      if (gcell && gcell.type === 'lesson') {
        const corner = isTeacher
          ? getSubjectMeta(gcell.subject).short
          : (teacherAbbrOf ? teacherAbbrOf(gcell.teacher) : '');
        if (!corner) return;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(70);
        doc.text(corner, data.cell.x + data.cell.width - 3, data.cell.y + data.cell.height - 3, { align: 'right' });
        doc.setTextColor(0);
      }
    },
  });

  // ---- Footer --------------------------------------------------------------
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(70);
  doc.text(`Timetable generated: ${new Date().toLocaleDateString('en-GB')}`, 40, pageH - 14);
  doc.text(generatedLabel, pageW - 40, pageH - 14, { align: 'right' });
  doc.setTextColor(0);

  doc.save(filename);
}

// Bulk export all classes in one multi-page PDF
export function exportAllTimetablesPDF({
  schoolName, timetables, days, filename, slots, teacherAbbrOf, generatedLabel = 'EduOne Timetables'
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const classes = Object.keys(timetables);
  
  if (classes.length === 0) return;

  classes.forEach((cls, idx) => {
    if (idx > 0) doc.addPage();
    const tt = timetables[cls];
    if (!tt || !tt.grid) return;
    const grid = tt.grid;
    
    const cols = (slots && slots.length ? slots : grid.map((_, i) => ({ teaching: true, period: i + 1, label: String(i + 1), start: '', end: '' }))).slice(0, grid.length);
    
    doc.setTextColor(0);
    if (schoolName) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(schoolName, 40, 22); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(`${schoolName ? schoolName + ' ' : ''}Class Timetable`, pageW / 2, 22, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.text(cls, pageW / 2, 48, { align: 'center' });

    const tableTop = 58;
    const head = ['', ...cols.map(() => '')];
    const body = [];
    for (let d = 0; d < days.length; d++) {
      const dayShort = days[d].slice(0, 2);
      const row = [{ content: dayShort, styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 15 } }];
      for (let p = 0; p < grid.length; p++) {
        const cell = grid[p][d];
        const slot = cols[p] || { teaching: cell.type !== 'break' };
        if (!slot.teaching || cell.type === 'break') {
          if (d === 0) row.push({ content: '', rowSpan: days.length, styles: { halign: 'center', valign: 'middle' } });
        } else if (cell.type === 'lesson') {
          const meta = cell.subject ? getSubjectMeta(cell.subject) : null;
          const main = meta ? meta.short : (cell.subject || '');
          row.push({ content: main, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 11 } });
        } else {
          row.push({ content: '' });
        }
      }
      body.push(row);
    }

    const colCount = grid.length + 1;
    const cellPad = colCount >= 12 ? 3 : colCount >= 10 ? 4 : 5;
    const marginBottom = 30;
    const headerH = 38;
    const availH = pageH - tableTop - marginBottom;
    const bodyMinH = Math.max(28, Math.floor((availH - headerH) / days.length));

    const columnStyles = { 0: { cellWidth: 38, fontStyle: 'bold' } };
    cols.forEach((s, i) => { if (!s.teaching) columnStyles[i + 1] = { cellWidth: 22 }; });

    autoTable(doc, {
      head: [head],
      body,
      startY: tableTop,
      theme: 'grid',
      tableWidth: pageW - 80,
      styles: { fontSize: 11, cellPadding: cellPad, lineColor: [0, 0, 0], lineWidth: 0.75, textColor: [0, 0, 0], halign: 'center', valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [255, 255, 255], minCellHeight: headerH, lineWidth: 0.75, lineColor: [0, 0, 0] },
      bodyStyles: { fillColor: [255, 255, 255], minCellHeight: bodyMinH },
      columnStyles,
      margin: { left: 40, right: 40, top: tableTop, bottom: marginBottom },
      rowPageBreak: 'avoid',
      didDrawCell: (data) => {
        const ci = data.column.index;
        const ti = ci - 1;
        const cx = data.cell.x + data.cell.width / 2;

        if (data.section === 'head') {
          if (ci === 0) return;
          const slot = cols[ti];
          if (!slot) return;
          doc.setTextColor(0);
          doc.setFillColor(255, 255, 255);
          doc.rect(data.cell.x + 0.4, data.cell.y + 0.4, data.cell.width - 0.8, data.cell.height - 0.8, 'F');
          doc.setFont('helvetica', 'bold');
          if (slot.teaching) {
            doc.setFontSize(11);
            doc.text(String(slot.period), cx, data.cell.y + 14, { align: 'center' });
            if (slot.start) {
              doc.setFontSize(6.8); doc.setTextColor(60);
              doc.text(`${slot.start} - ${slot.end}`, cx, data.cell.y + data.cell.height - 7, { align: 'center' });
              doc.setTextColor(0);
            }
          } else {
            doc.setFontSize(6.5);
            doc.text(String(slot.label), cx, data.cell.y + data.cell.height / 2 + 2, { align: 'center' });
          }
          return;
        }
        if (data.section !== 'body' || ci === 0) return;

        const slot = cols[ti];
        const gcell = grid[ti] && grid[ti][data.row.index];

        if (slot && !slot.teaching) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
          doc.text(String(slot.label), cx + 4, data.cell.y + data.cell.height / 2, { align: 'center', angle: 90 });
          return;
        }

        if (gcell && gcell.type === 'lesson') {
          const corner = teacherAbbrOf ? teacherAbbrOf(gcell.teacher) : '';
          if (!corner) return;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(70);
          doc.text(corner, data.cell.x + data.cell.width - 3, data.cell.y + data.cell.height - 3, { align: 'right' });
          doc.setTextColor(0);
        }
      },
    });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(70);
    doc.text(`Timetable generated: ${new Date().toLocaleDateString('en-GB')}`, 40, pageH - 14);
    doc.text(generatedLabel, pageW - 40, pageH - 14, { align: 'right' });
    doc.setTextColor(0);
  });

  doc.save(filename);
}
