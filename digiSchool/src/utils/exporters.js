// Export helpers for CSV, Excel (SheetJS) and PDF (jsPDF + autotable).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { computeStudentReport } from './grading';

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

export function exportReportCardsPDF({ school = {}, gradeBoundaries = [], students = [], subjects = [], examTitle = 'Term 1 Opening Exam', termName = 'Term 1', filename = 'report_cards.pdf' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  
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
    
    const is844 = r.systemType === '844';
    let y = 50;

    // Header Title Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(is844 ? "SECONDARY SCHOOL ACADEMIC REPORT CARD (8-4-4)" : "STUDENT REPORT CARD (CBC)", pageWidth / 2, y, { align: 'center' });

    y += 22;
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(r.examTitle || "Term 1 Opening Exam", pageWidth / 2, y, { align: 'center' });

    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(r.termName || "Term 1", pageWidth / 2, y, { align: 'center' });

    y += 20;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.75);
    doc.line(40, y, pageWidth - 40, y);

    y += 25;

    // Student Info Grid Layout
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);

    const col1 = 40;
    const col2 = 175;
    const col3 = 295;
    const col4 = 425;

    doc.text("STUDENT", col1, y);
    doc.text("ADMISSION NO.", col2, y);
    doc.text("CLASS", col3, y);
    doc.text("STREAM POSITION", col4, y);

    y += 14;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    doc.text(r.studentName, col1, y);
    doc.text(String(r.admissionNo), col2, y);
    doc.text(r.className, col3, y);
    doc.text(r.streamPosition, col4, y);

    y += 25;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);

    doc.text("OVERALL POSITION", col1, y);
    doc.text("MEAN GRADE", col2, y);
    doc.text("TOTAL POINTS", col3, y);

    y += 14;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    doc.text(r.overallPosition, col1, y);
    doc.text(r.meanGradeCode, col2, y);
    doc.text(r.totalPointsText, col3, y);

    y += 30;

    // Subject Table
    const tableBody = r.subjectRows.map(s => [
      s.subject,
      s.scoreText,
      s.percentageText,
      s.gradeFull,
      String(s.pts),
      s.remark || '',
      s.position
    ]);

    // Total / Mean Summary Row
    tableBody.push([
      'Mean / Total',
      String(r.totalMarks),
      r.meanPercentageText,
      r.meanGradeFull,
      String(r.totalPoints),
      is844 ? 'Overall Performance' : 'Mean CBC Performance',
      ''
    ]);

    autoTable(doc, {
      head: [['Subject', 'Score', '%', 'Grade', is844 ? 'Pts (1-12)' : 'Pts', 'Remark', 'Position']],
      body: tableBody,
      startY: y,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 6,
        textColor: [15, 23, 42],
        lineColor: [240, 240, 240],
        lineWidth: 0.5,
        valign: 'middle'
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [15, 23, 42],
        fillColor: [255, 255, 255],
        lineWidth: { bottom: 1 },
        lineColor: [200, 200, 200]
      },
      columnStyles: {
        0: { cellWidth: 120, fontStyle: 'normal' },
        1: { halign: 'center', cellWidth: 55 },
        2: { halign: 'center', cellWidth: 45 },
        3: { cellWidth: 80, fontStyle: 'bold' },
        4: { halign: 'center', cellWidth: 55 },
        5: { cellWidth: 100 },
        6: { halign: 'center', cellWidth: 60 }
      },
      didParseCell: function(data) {
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.lineWidth = { top: 1, bottom: 1 };
          data.cell.styles.lineColor = [200, 200, 200];
        }
      },
      margin: { left: 40, right: 40 }
    });

    let finalY = doc.lastAutoTable.finalY + 24;

    // Grading Key Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(is844 ? "8-4-4 KCSE GRADING KEY" : "GRADING KEY", 40, finalY);

    finalY += 12;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    if (is844) {
      doc.text("A (80–100% | 12pts)   A- (75–79% | 11pts)   B+ (70–74% | 10pts)   B (65–69% | 9pts)   B- (60–64% | 8pts)   C+ (55–59% | 7pts)", 40, finalY);
      finalY += 12;
      doc.text("C (50–54% | 6pts)     C- (45–49% | 5pts)     D+ (40–44% | 4pts)   D (35–39% | 3pts)   D- (30–34% | 2pts)   E (0–29% | 1pt)", 40, finalY);
    } else {
      doc.text("Exceeding Expectation (80–100%)    Meeting Expectation (50–79%)    Approaching Expectation (30–49%)", 40, finalY);
      finalY += 12;
      doc.text("Below Expectation (0–29%)", 40, finalY);
    }
  });

  doc.save(filename);
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

export function exportTimetableLandscapePDF({ title, grid, days, filename, times }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  
  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  // Underline
  const textWidth = doc.getTextWidth(title);
  const x = (doc.internal.pageSize.getWidth() - textWidth) / 2;
  doc.text(title, x, 40);
  doc.setLineWidth(1.5);
  doc.line(x, 43, x + textWidth, 43);

  // Use dynamic times if provided, otherwise fallback
  const fallbackTimes = [
    '8:00-\n8:40', '8:40-\n9:20', '9:20-\n9:30', '9:30-\n10:10', 
    '10:10-\n10:50', '10:50-\n11:20', '11:20-\n12:00', '12:00-\n12:40', 
    '12:40-\n2:00', '2:00-\n2:40', '2:40-\n3:20', '3:20-\n4:00'
  ];
  const activeTimes = times || fallbackTimes;

  const head = ['DAY', ...activeTimes.slice(0, grid.length)];
  const body = [];

  for (let d = 0; d < days.length; d++) {
    const row = [{ content: days[d].toUpperCase(), styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } }];
    for (let p = 0; p < grid.length; p++) {
      const cell = grid[p][d];
      if (cell.type === 'break') {
        if (d === 0) {
          let bLabel = cell.label.toUpperCase();
          // Ensure break labels have a space so they wrap correctly vertically
          if (!bLabel.includes(' ')) {
            if (p === 2) bLabel = 'SHORT BREAK';
            else if (p === 5) bLabel = 'LONG BREAK';
            else if (p === 8) bLabel = 'LUNCH BREAK';
          }
          const wrapped = bLabel.split(' ').join('\n');
          row.push({ 
            content: wrapped, 
            rowSpan: days.length, 
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 13, minCellWidth: 30 } 
          });
        }
      } else if (cell.type === 'lesson') {
        let sub = cell.subject || '';
        let abbr = '';
        if (cell.teacher && cell.teacher !== 'TBD') {
          abbr = cell.teacher.split(' ').map(n => n[0]).join('.').toUpperCase();
        }
        let txt = sub ? (abbr ? `${sub}\n(${abbr})` : sub) : '-';
        row.push({ 
          content: txt, 
          styles: { halign: 'center', valign: 'middle', fontStyle: 'italic', fontSize: 10 } 
        });
      } else {
        row.push({ 
          content: '-', 
          styles: { halign: 'center', valign: 'middle' } 
        });
      }
    }
    body.push(row);
  }

  autoTable(doc, {
    head: [head],
    body: body,
    startY: 60,
    theme: 'grid',
    styles: { 
      fontSize: 10, 
      cellPadding: 8, 
      lineColor: [0, 0, 0], 
      lineWidth: 1,
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255], 
      textColor: [0, 0, 0], 
      fontStyle: 'bold', 
      halign: 'center', 
      valign: 'middle',
      lineWidth: 1,
      lineColor: [0, 0, 0]
    },
    bodyStyles: {
      fillColor: [255, 255, 255]
    },
    margin: { left: 40, right: 40 }
  });

  const finalY = doc.lastAutoTable.finalY + 40;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('PREPARED BY ..............................................................', 40, finalY);
  
  const rightText = 'SCHOOL STAMP ..............................................................';
  const rightWidth = doc.getTextWidth(rightText);
  doc.text(rightText, doc.internal.pageSize.getWidth() - 40 - rightWidth, finalY);

  doc.save(filename);
}
