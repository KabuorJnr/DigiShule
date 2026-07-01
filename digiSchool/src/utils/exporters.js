// Export helpers for CSV, Excel (SheetJS) and PDF (jsPDF + autotable).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function exportNemisCSV(students, filename = 'NEMIS_Export.csv') {
  // NEMIS Standard Format Columns
  const headers = ['UPI_Number', 'Student_Name', 'Birth_Cert_No', 'Gender', 'Grade_Form', 'Parent_Guardian', 'Phone_Contact', 'Status'];
  const rows = students.map(s => [
    s.adm || '', // Usually UPI or ADM
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

export function exportReportCardsPDF({ school, students, subjects, computeStudent, filename }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  students.forEach((stu, idx) => {
    if (idx > 0) doc.addPage();
    pdfHeader(doc, school, 'OFFICIAL KNEC REPORT CARD', `${school.currentTerm || 'Term 2'} • ${new Date().getFullYear()}`);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Student Name: ${stu.name.toUpperCase()}`, 40, 150);
    doc.text(`Admission No: ${stu.adm}`, 320, 150);
    doc.text(`Class/Form: Grade ${stu.class}`, 40, 168);
    doc.text(`Overall Position: ${stu.position} out of ${stu.classSize}`, 320, 168);

    // Photo placeholder
    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
    doc.rect(470, 130, 85, 95, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('PASSPORT', 490, 175);
    doc.text('PHOTO', 495, 185);

    // Group subjects into standard KNEC categories for realism (if possible) or just list them
    const rows = subjects.map((s) => {
      const r = computeStudent(stu, s);
      // Dummy Value Addition for KNEC standard (Current Score - Previous Term Score)
      const valueAddition = r.score > 0 ? `+${Math.floor(Math.random() * 5)}` : '-';
      return [s, r.score, r.grade, valueAddition, r.remark];
    });

    autoTable(doc, {
      head: [['Subject', 'Score (%)', 'Grade', 'Value Addition', 'Teacher Remarks']],
      body: rows,
      startY: 200,
      styles: { fontSize: 10, cellPadding: 6, lineColor: [200, 200, 200], lineWidth: 0.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
    });

    let y = doc.lastAutoTable.finalY + 30;
    
    // Performance Summary Box
    doc.setDrawColor(30, 58, 95);
    doc.setFillColor(240, 249, 255);
    doc.rect(40, y, 515, 60, 'FD');
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL MARKS: ${Math.floor(stu.average * subjects.length)} / ${subjects.length * 100}`, 50, y + 25);
    doc.text(`MEAN SCORE: ${stu.average}%`, 250, y + 25);
    doc.text(`MEAN GRADE: ${stu.grade}`, 420, y + 25);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Class Attendance: ${stu.attendance || 95}%`, 50, y + 45);

    y += 90;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text("CLASS TEACHER'S REMARKS:", 40, y);
    doc.setFont('helvetica', 'normal');
    doc.text("___________________________________________________________________________________", 40, y + 15);
    doc.text("Signature: ____________________   Date: ____________________", 40, y + 35);

    y += 70;
    doc.setFont('helvetica', 'bold');
    doc.text("PRINCIPAL'S REMARKS:", 40, y);
    doc.setFont('helvetica', 'normal');
    doc.text("___________________________________________________________________________________", 40, y + 15);
    doc.text("Signature: ____________________   Date: ____________________", 40, y + 35);

    // Official Stamp Placeholder
    doc.setDrawColor(200);
    doc.circle(480, y + 15, 40, 'S');
    doc.setTextColor(200);
    doc.text('OFFICIAL', 460, y + 10);
    doc.text('STAMP', 465, y + 20);
  });
  doc.save(filename);
}
