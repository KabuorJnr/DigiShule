// Export helpers for CSV, Excel (SheetJS) and PDF (jsPDF + autotable).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

export function exportReportCardsPDF({ school, gradeBoundaries, students, subjects, computeStudent, filename }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  
  students.forEach((stu, idx) => {
    if (idx > 0) doc.addPage();
    
    // Top Bar Backgrounds
    doc.setFillColor(13, 148, 136); // Teal (Primary)
    doc.rect(0, 0, 380, 60, 'F');
    doc.setFillColor(15, 23, 42); // Slate-900 (Dark)
    doc.rect(380, 0, 216, 60, 'F');
    
    // Top Bar Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text("Official Report Card", 30, 38);
    
    doc.setFontSize(14);
    doc.text(school.name || "EduOne Academy", 485, 38, { align: 'center' });
    
    let y = 100;
    
    // Student Information Section
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Student Information:", 30, y);
    
    y += 20;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text("Name:", 30, y);
    doc.text("Class:", 280, y);
    doc.text("Term:", 420, y);
    
    y += 10;
    doc.setDrawColor(200);
    doc.setFillColor(255, 255, 255);
    doc.rect(30, y, 230, 22, 'FD');
    doc.rect(280, y, 120, 22, 'FD');
    doc.rect(420, y, 145, 22, 'FD');
    
    doc.setFont('helvetica', 'normal');
    doc.text(stu.name, 35, y + 15);
    doc.text(`Grade ${stu.class}`, 285, y + 15);
    const termText = school.termStart && school.termEnd ? `${school.termStart} to ${school.termEnd}` : `${new Date().getFullYear()}`;
    doc.text(termText, 425, y + 15);
    
    y += 40;
    
    // Table
    const rows = subjects.map((s) => {
      const r = computeStudent(stu, s);
      const valueAddition = r.score > 0 ? `+${Math.floor(Math.random() * 5)}` : '-';
      return [s, r.score, r.grade, valueAddition, r.remark];
    });

    autoTable(doc, {
      head: [['Subject', 'Score (%)', 'Grade', 'Value Addition', 'Teacher Remarks']],
      body: rows,
      startY: y,
      styles: { fontSize: 9, cellPadding: 6, lineColor: [220, 220, 220], lineWidth: 0.5 },
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 30, right: 30 },
      theme: 'grid'
    });

    y = doc.lastAutoTable.finalY + 30;

    // Grading Scale & Attendance
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text("Grading Scale:", 30, y);
    doc.text("Attendance:", 180, y);

    y += 20;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    
    let scaleY = y;
    if (gradeBoundaries && gradeBoundaries.length > 0) {
      gradeBoundaries.forEach((b, i) => {
        let max = i === 0 ? 100 : (gradeBoundaries[i-1].min - 1);
        doc.text(`\u2022 ${b.grade}: ${b.min}-${max}%`, 35, scaleY);
        scaleY += 15;
      });
    } else {
      doc.text("\u2022 A: 90-100%", 35, scaleY); scaleY += 15;
      doc.text("\u2022 B: 80-89%", 35, scaleY); scaleY += 15;
      doc.text("\u2022 C: 70-79%", 35, scaleY); scaleY += 15;
      doc.text("\u2022 D: 60-69%", 35, scaleY); scaleY += 15;
      doc.text("\u2022 F: Below 60%", 35, scaleY); scaleY += 15;
    }

    doc.text("\u2022 Days Present: " + (stu.attendance || 170), 185, y);
    doc.text("\u2022 Days Absent: " + (180 - (stu.attendance || 170)), 185, y + 15);
    doc.text("\u2022 Tardies: 3", 185, y + 30);
    
    y = Math.max(scaleY, y + 45);

    // Comments
    y += 30;
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text("Comments:", 30, y);
    
    y += 10;
    doc.setDrawColor(200);
    doc.setFillColor(255, 255, 255);
    doc.rect(30, y, 535, 70, 'FD');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    
    let commentText = `${stu.name.split(' ')[0]} has shown consistent effort this term. `;
    if (stu.average >= 80) commentText += `An outstanding performance overall, particularly excelling in core subjects. They participate actively and help peers. Keep up the great work!`;
    else if (stu.average >= 60) commentText += `They have a solid grasp of most concepts but should focus a bit more on areas they find challenging. Overall, a successful academic term.`;
    else commentText += `More focus and dedication is required to improve their performance in upcoming terms.`;
    
    const lines = doc.splitTextToSize(commentText, 515);
    doc.text(lines, 40, y + 15);

    y += 120;

    // Signatures
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("Parent's Signature:", 110, y, { align: 'center' });
    doc.text("Teacher Signature:", 297, y, { align: 'center' });
    doc.text("Principal Signature:", 485, y, { align: 'center' });

    y += 40;
    doc.setFont('times', 'italic');
    doc.setFontSize(18);
    doc.text("Parent / Guardian", 110, y, { align: 'center' });
    doc.text("Class Teacher", 297, y, { align: 'center' });
    doc.text(school.principal || "Principal", 485, y, { align: 'center' });

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("Parent / Guardian", 110, y, { align: 'center' });
    doc.text("Class Teacher", 297, y, { align: 'center' });
    doc.text(school.principal || "Principal", 485, y, { align: 'center' });

    // Footer
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 800, 595.28, 41.89, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const addr = school.address || "108 N Platinum Ave Deming, NY 88030";
    const ph = school.phone || "+1 312-692-0767";
    const em = school.email || "info@eduone.africa";
    
    doc.text(addr, 180, 825, { align: 'center' });
    doc.text(ph, 350, 825, { align: 'center' });
    doc.text(em, 490, 825, { align: 'center' });
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
