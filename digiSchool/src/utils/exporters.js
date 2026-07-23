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
    let y = 40;

    // Top Blue Line
    doc.setDrawColor(29, 78, 216); // #1d4ed8
    doc.setLineWidth(6);
    doc.line(40, y, pageWidth - 40, y);
    y += 24;

    // Header Title Block
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); // #1e293b
    doc.text(school.name || "Kinjau Junior Secondary", pageWidth / 2, y, { align: 'center' });

    y += 14;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139); // #64748b
    doc.text(school.motto || "Excellence in Education", pageWidth / 2, y, { align: 'center' });

    y += 18;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 78, 216); // #1d4ed8
    doc.text(is844 ? "SECONDARY SCHOOL ACADEMIC REPORT CARD" : "JUNIOR SECONDARY ASSESSMENT REPORT", pageWidth / 2, y, { align: 'center' });

    y += 20;

    // Student Info Grid Layout (Bordered Box)
    doc.setDrawColor(148, 163, 184); // #94a3b8
    doc.setLineWidth(1);
    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.rect(40, y, pageWidth - 80, 24, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    let x = 45;
    doc.setFont('helvetica', 'bold');
    doc.text("Name:", x, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(r.studentName, x + 35, y + 16);

    x += 160;
    doc.line(x - 10, y, x - 10, y + 24); // vertical separator
    doc.setFont('helvetica', 'bold');
    doc.text("Adm No:", x, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(String(r.admissionNo), x + 45, y + 16);

    x += 120;
    doc.line(x - 10, y, x - 10, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.text("Grade:", x, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(r.className, x + 35, y + 16);

    x += 120;
    doc.line(x - 10, y, x - 10, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.text("Term:", x, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(r.termName, x + 35, y + 16);

    y += 34;

    // Subject Table
    const tableBody = r.subjectRows.map(s => [
      s.subject,
      s.scoreText,
      is844 ? s.percentageText : s.gradeFull,
      String(s.pts),
      s.remark || '',
      ''
    ]);

    // Total / Mean Summary Row
    tableBody.push([
      { content: `Total Points: ${r.totalPoints}/${is844 ? r.subjectRows.length * 12 : r.subjectRows.length * 4}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: `Average (${r.subjectRows.length} ${is844 ? 'subjects' : 'learning areas'}): ${r.meanPercentageText}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: `Mean Grade: ${r.meanGradeFull}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
    ]);

    autoTable(doc, {
      head: [[is844 ? 'Subject' : 'Learning Area', 'Score', is844 ? '%' : 'Level', 'Pts', 'Remark', 'Teacher']],
      body: tableBody,
      startY: y,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 6,
        textColor: [15, 23, 42],
        lineColor: [148, 163, 184],
        lineWidth: 1,
        valign: 'middle'
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [15, 23, 42],
        fillColor: [226, 232, 240] // #e2e8f0
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'center', cellWidth: 70 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 40 },
        4: { cellWidth: 130 },
        5: { cellWidth: 105 }
      },
      margin: { left: 40, right: 40 }
    });

    let finalY = doc.lastAutoTable.finalY;

    // Grading Key Footer
    doc.setDrawColor(148, 163, 184); // #94a3b8
    doc.setLineWidth(1);
    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.rect(40, finalY, pageWidth - 80, 26, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text("KEY:", 45, finalY + 16);
    
    doc.setFontSize(8);
    let keyX = 80;
    if (is844) {
      doc.setTextColor(29, 78, 216); doc.text("A=80-100%   A-=75-79%", keyX, finalY + 16); keyX += 110;
      doc.setTextColor(22, 163, 74); doc.text("B+=70-74%   B=65-69%   B-=60-64%   C+=55-59%", keyX, finalY + 16); keyX += 200;
      doc.setTextColor(217, 119, 6); doc.text("C=50-54%   C-=45-49%   D+=40-44%", keyX, finalY + 16); keyX += 150;
      doc.setTextColor(220, 38, 38); doc.text("D=35-39%   D-=30-34%   E=0-29%", keyX, finalY + 16);
    } else {
      doc.setTextColor(29, 78, 216); doc.text("EE1=90-100%   EE2=75-89%", keyX, finalY + 16); keyX += 130;
      doc.setTextColor(22, 163, 74); doc.text("ME1=58-74%   ME2=41-57%", keyX, finalY + 16); keyX += 130;
      doc.setTextColor(217, 119, 6); doc.text("AE1=31-40%   AE2=21-30%", keyX, finalY + 16); keyX += 130;
      doc.setTextColor(220, 38, 38); doc.text("BE1=11-20%   BE2=0-10%", keyX, finalY + 16);
    }

    finalY += 40;

    // Dynamic comment logic
    const meanPct = r.totalMarks / (r.subjectRows.length * 100) * 100;
    let teacherComment = "";
    let principalComment = "";
    
    if (is844) {
      if (meanPct >= 70) {
        teacherComment = "An excellent performance. Keep up the high standard and maintain focus.";
        principalComment = "Outstanding result. Continue working hard to achieve even greater success.";
      } else if (meanPct >= 50) {
        teacherComment = "A good effort, but there is room for improvement in weaker subjects.";
        principalComment = "Good work. With more dedication, you can achieve a much higher grade.";
      } else {
        teacherComment = "Below average performance. You need to put in more effort and seek help in challenging areas.";
        principalComment = "Work harder and stay focused. Close monitoring by teachers and parents is advised.";
      }
    } else {
      if (meanPct >= 75) {
        teacherComment = "Exceeding expectations across most learning areas. Keep up the excellent work.";
        principalComment = "Outstanding performance. Keep maintaining this high level of excellence.";
      } else if (meanPct >= 50) {
        teacherComment = "Meeting expectations in most areas. Work on the subjects where you are approaching expectation.";
        principalComment = "Good effort. Aim to exceed expectations in the upcoming assessments.";
      } else {
        teacherComment = "Needs intensive support and remedial intervention across multiple learning areas. Immediate action is required.";
        principalComment = "Immediate intervention is required to improve your performance. The school will work closely with you and your parents to provide necessary support.";
      }
    }

    // Teacher Comment Box
    doc.setDrawColor(148, 163, 184); // #94a3b8
    doc.setLineWidth(1);
    doc.setFillColor(255, 255, 255);
    doc.rect(40, finalY, pageWidth - 80, 50);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text("Class Teacher's Comment:", 45, finalY + 14);
    
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(51, 65, 85);
    doc.text(`${r.studentName} ${teacherComment}`, 45, finalY + 28);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text("Name: __________________________   Signature: __________________________   Date: __________________________", 45, finalY + 44);

    finalY += 60;

    // Principal Comment Box
    doc.rect(40, finalY, pageWidth - 80, 50);
    
    doc.setFont('helvetica', 'bold');
    doc.text("Principal's Comment:", 45, finalY + 14);
    
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(51, 65, 85);
    doc.text(`${r.studentName}, ${principalComment}`, 45, finalY + 28);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text("Name: __________________________   Signature: __________________________   Date: __________________________", 45, finalY + 44);

    finalY += 60;

    // Parent Comment & Stamp
    doc.rect(40, finalY, pageWidth - 200, 50);
    doc.setFont('helvetica', 'bold');
    doc.text("Parent/Guardian Comment:", 45, finalY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text("Signature: __________________________   Date: __________________________", 45, finalY + 38);

    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([4, 4], 0);
    doc.rect(pageWidth - 150, finalY, 110, 50);
    doc.setLineDashPattern([], 0); // reset
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(203, 213, 225);
    doc.text("SCHOOL STAMP", pageWidth - 140, finalY + 28);

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
        let firstName = '';
        if (cell.teacher && cell.teacher !== 'TBD' && cell.teacher !== '-') {
          const cleaned = cell.teacher.replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '').trim();
          firstName = cleaned.split(/\s+/)[0] || cell.teacher;
        }
        let txt = sub ? (firstName ? `${sub}\n(${firstName})` : sub) : '-';
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
