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
