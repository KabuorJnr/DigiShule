// Export helpers for CSV, Excel (SheetJS) and PDF (jsPDF + autotable).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
    pdfHeader(doc, school, 'STUDENT REPORT CARD', `${school.currentTerm} • ${new Date().getFullYear()}`);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Name: ${stu.name}`, 40, 150);
    doc.text(`Adm No: ${stu.adm}`, 320, 150);
    doc.text(`Class: Grade ${stu.class}`, 40, 168);
    doc.text(`Position: ${stu.position} of ${stu.classSize}`, 320, 168);

    // photo placeholder
    doc.setDrawColor(200);
    doc.rect(470, 130, 85, 95);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('PHOTO', 498, 180);

    const rows = subjects.map((s) => {
      const r = computeStudent(stu, s);
      return [s, r.score, r.grade, r.remark];
    });
    autoTable(doc, {
      head: [['Subject', 'Score (%)', 'Grade', 'Remarks']],
      body: rows,
      startY: 200,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255 },
      margin: { left: 40, right: 40 },
    });

    let y = doc.lastAutoTable.finalY + 24;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Mean Average: ${stu.average}%   Mean Grade: ${stu.grade}`, 40, y);
    y += 18;
    doc.text(`Attendance: ${stu.attendance}%`, 40, y);
    y += 28;
    doc.setTextColor(100);
    doc.text("Principal's Comment: ____________________________________________", 40, y);
    y += 24;
    doc.text("Class Teacher's Comment: _______________________________________", 40, y);
    y += 40;
    doc.text('Principal Signature: ________________', 40, y);
    doc.text('Date: ____________', 360, y);
  });
  doc.save(filename);
}
