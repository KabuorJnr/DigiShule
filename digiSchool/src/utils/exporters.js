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
    const is844 = r.systemType === '844';
    
    if (!is844) {
      renderCBCReportCard(doc, r, school, pageWidth, pageHeight);
      return;
    }
    
    // Outer Premium Border
    doc.setDrawColor(15, 23, 42); // Deep Navy
    doc.setLineWidth(2);
    doc.roundedRect(20, 20, pageWidth - 40, pageHeight - 40, 8, 8, 'S');
    
    // Inner thin border
    doc.setDrawColor(202, 138, 4); // Premium Gold
    doc.setLineWidth(0.5);
    doc.roundedRect(24, 24, pageWidth - 48, pageHeight - 48, 6, 6, 'S');

    let y = 50;

    // Header Title Block
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); 
    doc.text((school.name || "Kinjau Junior Secondary").toUpperCase(), pageWidth / 2, y, { align: 'center' });

    y += 16;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(school.motto || "Excellence in Education", pageWidth / 2, y, { align: 'center' });
    
    y += 8;
    // Gold separator
    doc.setDrawColor(202, 138, 4);
    doc.setLineWidth(1.5);
    doc.line(pageWidth / 2 - 100, y, pageWidth / 2 + 100, y);

    y += 24;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(is844 ? "OFFICIAL ACADEMIC REPORT CARD" : "OFFICIAL ASSESSMENT REPORT", pageWidth / 2, y, { align: 'center' });
    
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(examTitle, pageWidth / 2, y + 10, { align: 'center' });

    y += 30;

    // Student Info Grid Layout (Rounded Bordered Box)
    doc.setDrawColor(202, 138, 4); 
    doc.setLineWidth(1);
    doc.setFillColor(248, 250, 252); 
    doc.roundedRect(40, y, pageWidth - 80, 28, 6, 6, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    let x = 50;
    doc.setFont('helvetica', 'bold');
    doc.text("Name:", x, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(r.studentName.toUpperCase(), x + 35, y + 18);

    x += 160;
    doc.setDrawColor(226, 232, 240);
    doc.line(x - 10, y + 4, x - 10, y + 24); // vertical separator
    doc.setFont('helvetica', 'bold');
    doc.text("Adm No:", x, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(String(r.admissionNo), x + 45, y + 18);

    x += 110;
    doc.line(x - 10, y + 4, x - 10, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.text("Grade:", x, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(String(r.className).toUpperCase(), x + 35, y + 18);

    x += 110;
    doc.line(x - 10, y + 4, x - 10, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.text("Term:", x, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(r.termName, x + 35, y + 18);

    y += 44;

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
      { content: `TOTAL POINTS: ${r.totalPoints} / ${is844 ? r.subjectRows.length * 12 : r.subjectRows.length * 4}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15,23,42] } },
      { content: `AVERAGE (${r.subjectRows.length} ${is844 ? 'subjects' : 'learning areas'}): ${r.meanPercentageText}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15,23,42] } },
      { content: `MEAN GRADE: ${r.meanGradeFull}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [202, 138, 4], textColor: [255,255,255] } }
    ]);

    autoTable(doc, {
      head: [[is844 ? 'SUBJECT' : 'LEARNING AREA', 'SCORE', is844 ? '%' : 'LEVEL', 'PTS', 'REMARK', 'TEACHER']],
      body: tableBody,
      startY: y,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 6,
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.5,
        valign: 'middle'
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [255, 255, 255],
        fillColor: [15, 23, 42] // Deep Navy
      },
      columnStyles: {
        0: { cellWidth: 120, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 45 },
        2: { halign: 'center', cellWidth: 75 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 40, textColor: [202, 138, 4] },
        4: { cellWidth: 130 },
        5: { cellWidth: 105 }
      },
      margin: { left: 40, right: 40 }
    });

    let finalY = doc.lastAutoTable.finalY + 16;

    // Grading Key Footer
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, finalY, pageWidth - 80, 22, 4, 4, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text("KEY:", 45, finalY + 14);
    
    let keyX = 75;
    if (is844) {
      doc.setTextColor(29, 78, 216); doc.text("A=80-100%   A-=75-79%", keyX, finalY + 14); keyX += 110;
      doc.setTextColor(22, 163, 74); doc.text("B+=70-74%   B=65-69%   B-=60-64%   C+=55-59%", keyX, finalY + 14); keyX += 200;
      doc.setTextColor(217, 119, 6); doc.text("C=50-54%   C-=45-49%   D+=40-44%", keyX, finalY + 14); keyX += 150;
      doc.setTextColor(220, 38, 38); doc.text("D=35-39%   D-=30-34%   E=0-29%", keyX, finalY + 14);
    } else {
      doc.setTextColor(29, 78, 216); doc.text("EE1=90-100%   EE2=75-89%", keyX, finalY + 14); keyX += 130;
      doc.setTextColor(22, 163, 74); doc.text("ME1=58-74%   ME2=41-57%", keyX, finalY + 14); keyX += 130;
      doc.setTextColor(217, 119, 6); doc.text("AE1=31-40%   AE2=21-30%", keyX, finalY + 14); keyX += 130;
      doc.setTextColor(220, 38, 38); doc.text("BE1=11-20%   BE2=0-10%", keyX, finalY + 14);
    }

    finalY += 36;

    const meanPct = r.totalMarks / (r.subjectRows.length * 100) * 100;
    let teacherComment = ""; let principalComment = "";
    if (is844) {
      if (meanPct >= 70) { teacherComment = "An excellent performance. Keep up the high standard and maintain focus."; principalComment = "Outstanding result. Continue working hard to achieve even greater success."; }
      else if (meanPct >= 50) { teacherComment = "A good effort, but there is room for improvement in weaker subjects."; principalComment = "Good work. With more dedication, you can achieve a much higher grade."; }
      else { teacherComment = "Below average performance. You need to put in more effort and seek help in challenging areas."; principalComment = "Work harder and stay focused. Close monitoring by teachers and parents is advised."; }
    } else {
      if (meanPct >= 75) { teacherComment = "Exceeding expectations across most learning areas. Keep up the excellent work."; principalComment = "Outstanding performance. Keep maintaining this high level of excellence."; }
      else if (meanPct >= 50) { teacherComment = "Meeting expectations in most areas. Work on the subjects where you are approaching expectation."; principalComment = "Good effort. Aim to exceed expectations in the upcoming assessments."; }
      else { teacherComment = "Needs intensive support and remedial intervention across multiple learning areas. Immediate action is required."; principalComment = "Immediate intervention is required to improve your performance."; }
    }

    // Signatures and Comments Area
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.roundedRect(40, finalY, pageWidth - 80, 45, 4, 4, 'S');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text("Class Teacher's Comment:", 45, finalY + 14);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105);
    doc.text(`${r.studentName} ${teacherComment}`, 45, finalY + 26);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text("Signature: __________________________   Date: __________________________", 45, finalY + 40);

    finalY += 52;

    doc.roundedRect(40, finalY, pageWidth - 80, 45, 4, 4, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text("Principal's Comment:", 45, finalY + 14);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105);
    doc.text(`${r.studentName}, ${principalComment}`, 45, finalY + 26);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text("Signature: __________________________   Date: __________________________", 45, finalY + 40);

    finalY += 52;

    doc.roundedRect(40, finalY, pageWidth - 200, 45, 4, 4, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text("Parent/Guardian Comment:", 45, finalY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text("Signature: __________________________   Date: __________________________", 45, finalY + 32);

    // Official Stamp Box
    doc.setDrawColor(202, 138, 4); // Gold stamp box
    doc.setLineWidth(1);
    doc.roundedRect(pageWidth - 150, finalY, 110, 45, 4, 4, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(202, 138, 4);
    doc.text("OFFICIAL STAMP", pageWidth - 140, finalY + 26);
  });

  doc.save(filename);
}

function renderCBCReportCard(doc, r, school, pageWidth, pageHeight) {
  // 1. Header Block
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(school.name || "Homa Bay School", pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  let headerY = 55;
  if (school.address) { doc.text(`Address: ${school.address}`, pageWidth / 2, headerY, { align: 'center' }); headerY += 12; }
  if (school.phone || school.tel) { doc.text(`Tel: ${school.phone || school.tel || ''}`, pageWidth / 2, headerY, { align: 'center' }); headerY += 12; }
  if (school.email) { doc.text(`Email: ${school.email || ''}`, pageWidth / 2, headerY, { align: 'center' }); headerY += 12; }
  
  // 2. Title Banner
  headerY += 10;
  doc.setFillColor(150, 160, 180);
  doc.rect(20, headerY, pageWidth - 40, 18, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`ACADEMIC REPORT FORM - ${String(r.className).toUpperCase()} - ${String(r.examTitle).toUpperCase()} - (${String(r.termName).toUpperCase()})`, pageWidth / 2, headerY + 12, { align: 'center' });
  
  headerY += 32;
  
  // 3. Student Profile Area
  doc.setFillColor(220, 220, 220);
  doc.rect(20, headerY, 70, 75, 'F'); // Photo placeholder
  
  doc.setTextColor(30, 30, 40);
  doc.setFontSize(14);
  doc.text(r.studentName, 100, headerY + 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`ADMNO: ${r.admissionNo}`, 100, headerY + 30);
  doc.text(`GRADE: ${r.className}`, 100, headerY + 45);
  doc.text(`PATHWAY: STEM`, 100, headerY + 60);

  // 4. Graph Area
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text("Subject Performance - Student vs Class", pageWidth - 200, headerY + 10);
  doc.setDrawColor(200, 200, 200);
  doc.line(pageWidth - 200, headerY + 15, pageWidth - 20, headerY + 15);
  doc.line(pageWidth - 200, headerY + 65, pageWidth - 20, headerY + 65);
  
  const subjects = r.subjectRows;
  if (subjects.length > 0) {
    const xStep = 180 / subjects.length;
    let prevX = null, prevY = null;
    doc.setDrawColor(100, 120, 150);
    doc.setFillColor(100, 120, 150);
    doc.setLineWidth(1);
    subjects.forEach((sub, i) => {
      const sx = pageWidth - 200 + (i * xStep) + (xStep / 2);
      const sy = headerY + 65 - ((sub.percentage / 100) * 50);
      doc.circle(sx, sy, 2, 'F');
      if (prevX !== null) doc.line(prevX, prevY, sx, sy);
      prevX = sx; prevY = sy;
      doc.setFontSize(6);
      doc.text(sub.subject.substring(0, 4).toUpperCase(), sx, headerY + 75, { align: 'center' });
    });
  }
  
  headerY += 95;
  
  // 5. Summary Stats Banner
  doc.setFillColor(235, 240, 245);
  doc.rect(20, headerY, pageWidth - 40, 36, 'F');
  
  const stats = [
    { label: 'Performance Level', val: r.meanGradeCode },
    { label: 'Total Marks', val: `${r.totalMarks}/${subjects.length * 100}` },
    { label: 'Total Points', val: `${r.totalPoints}/${subjects.length * 8}` },
    { label: 'Mean Points', val: `${r.meanPoints}/8` }
  ];
  
  doc.setTextColor(30, 58, 95);
  stats.forEach((st, i) => {
    const cx = 20 + ((pageWidth - 40) / 4) * i + ((pageWidth - 40) / 8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(st.label, cx, headerY + 14, { align: 'center' });
    doc.setFontSize(11);
    doc.text(st.val, cx, headerY + 28, { align: 'center' });
  });
  
  headerY += 46;
  
  // 6. Subjects Table
  const tableBody = subjects.map(s => [
    s.subject,
    `${s.percentage}%`,
    `0 ->`, 
    s.gradeCode,
    s.remark || 'Meets basic standards; keep going.',
    'Subject Teacher' 
  ]);
  
  autoTable(doc, {
    head: [['SUBJECTS', 'MARKS', 'DEV.', 'GRADE', 'COMMENT', 'TEACHER']],
    body: tableBody,
    startY: headerY,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 5, textColor: [30,30,30], lineColor: [200,200,200] },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 45 },
      4: { cellWidth: 170 },
      5: { cellWidth: 95 }
    },
    margin: { left: 20, right: 20 }
  });
  
  let finalY = doc.lastAutoTable.finalY + 10;
  
  // 7. Remarks Section
  doc.setDrawColor(200, 200, 200);
  doc.rect(20, finalY, 250, 60); 
  doc.rect(280, finalY, pageWidth - 300, 60); 
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text("Class Teacher Remarks:", 25, finalY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${r.studentName}, you're meeting the expected standards with\nsolid effort. Continue this positive momentum.`, 25, finalY + 26);
  doc.text("Signature: _______________________", 25, finalY + 52);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("Principal Remarks:", 285, finalY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${r.studentName}, you are performing well and meeting expectations.\nKeep up the good work - you're on track for success!`, 285, finalY + 26);
  doc.text("Signature: _______________________", 285, finalY + 52);
  
  // Official Stamp Mock
  doc.setDrawColor(60, 80, 180);
  doc.setTextColor(60, 80, 180);
  doc.setLineWidth(1);
  doc.rect(380, finalY + 15, 140, 45);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("CHIEF PRINCIPAL", 450, finalY + 27, { align: 'center' });
  doc.setFontSize(7);
  doc.text((school.name || 'HOMA BAY SCHOOL').toUpperCase(), 450, finalY + 39, { align: 'center' });
  doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(), 450, finalY + 49, { align: 'center' });
  
  finalY += 80;
  
  // 8. Grade Descriptors Table
  if (finalY + 80 > pageHeight - 40) {
    doc.addPage();
    finalY = 40;
  }
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text("GRADE DESCRIPTORS", 20, finalY);
  
  autoTable(doc, {
    head: [['Performance Level', 'Exceeding Expectations', 'Meeting Expectations', 'Approaching Expectations', 'Below Expectations']],
    body: [
      ['Actual Performance', 'EE1             EE2', 'ME1             ME2', 'AE1             AE2', 'BE1             BE2'],
      ['Points', '8                  7', '6                  5', '4                  3', '2                  1'],
      ['Range (%)', '90-100       75-89', '58-74          41-57', '31-40          21-30', '11-20          0-10']
    ],
    startY: finalY + 5,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 4, halign: 'center', textColor: [50,50,50], lineColor: [200,200,200] },
    headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 100 } },
    margin: { left: 20, right: 20 }
  });
  
  // 9. Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.text(`Verification Code: ${Math.random().toString(36).substring(2, 8).toUpperCase()}`, 70, pageH - 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`Scan to access your interactive student profile.`, 70, pageH - 20);
  doc.text(`Your username: ${String(r.admissionNo)}@${(school.name || 'school').replace(/\s+/g, '').toLowerCase()}`, 70, pageH - 10);
  
  // QR code mock box
  doc.setDrawColor(150, 150, 150);
  doc.setFillColor(240, 240, 240);
  doc.rect(20, pageH - 35, 30, 30, 'FD');
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
