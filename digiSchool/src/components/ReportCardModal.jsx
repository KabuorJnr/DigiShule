import React from 'react';
import Modal from './Modal';
import { computeStudentReport, CBC_BOUNDARIES, KCSE_BOUNDARIES, is844Class } from '../utils/grading';
import ReportCardSheet from './ReportCardSheet';
import { ensureReportFontsLoaded } from '../utils/fonts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Printer, Download, Award } from 'lucide-react';

export default function ReportCardModal({
  student,
  students = [],
  subjects = [],
  gradeBoundaries = [],
  examTitle = 'Term 1 Opening Exam',
  termName = 'Term 1',
  schoolSettings = {},
  onClose
}) {
  if (!student) return null;

  // Force correct boundaries based on student's curriculum type
  const studentIs844 = is844Class(student.class);
  const effectiveBoundaries = studentIs844 ? KCSE_BOUNDARIES : CBC_BOUNDARIES;

  let report = null;
  try {
    report = computeStudentReport({
      student,
      students,
      subjects,
      examTitle,
      termName,
      gradeBoundaries: effectiveBoundaries
    });
  } catch (err) {
    console.error("Error computing report card:", err);
  }

  if (!report) {
    return (
      <Modal title="Student Report Card" onClose={onClose} width={600}>
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Report Card Unavailable</h3>
          <p className="muted" style={{ fontSize: 14 }}>The academic report card for <strong>{student.name || 'this student'}</strong> could not be generated. Please ensure subject marks are published by the Academic Office.</p>
        </div>
      </Modal>
    );
  }

  const is844 = report.systemType === '844';

  const handleDownloadPDF = async () => {
    const el = document.getElementById('report-card-capture-area');
    if (!el) return;
    // Wait for Poppins so the PDF captures the same font the card is designed in.
    await ensureReportFontsLoaded();
    // High scale keeps text crisp; explicit white background avoids grey fringes.
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight
    });
    const imgData = canvas.toDataURL('image/png');

    // A4 dimensions in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Fit the card to a single A4 page, preserving aspect ratio: an exact-A4
    // card fills the sheet edge-to-edge; a slightly taller one (many subjects)
    // scales down to fit rather than clipping the footer.
    let drawW = pdfWidth;
    let drawH = (canvas.height * pdfWidth) / canvas.width;
    if (drawH > pdfHeight) {
      drawH = pdfHeight;
      drawW = (canvas.width * pdfHeight) / canvas.height;
    }
    const offsetX = (pdfWidth - drawW) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, 0, drawW, drawH, undefined, 'FAST');
    pdf.save(`${report.studentName.replace(/\s+/g, '_')}_Report.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const INK = '#111827';
  const MUTED = '#6b7280';

  return (
    <Modal title="Student Report Card" onClose={onClose} width={840}>
      <div style={{ padding: '4px 16px 20px', background: '#eef2f6', color: INK, fontFamily: '"Poppins", sans-serif' }}>
        {/* Action Toolbar */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
            <Award size={14} strokeWidth={1.75} /> {is844 ? '8-4-4 · KCSE' : 'CBC · 8-tier'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePrint}
              style={{ height: 34, padding: '0 14px', borderRadius: 6, background: '#fff', border: `1px solid #d1d5db`, fontSize: 13, fontWeight: 500, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Printer size={14} strokeWidth={1.75} /> Print
            </button>
            <button
              onClick={handleDownloadPDF}
              style={{ height: 34, padding: '0 14px', borderRadius: 6, background: INK, border: `1px solid ${INK}`, fontSize: 13, fontWeight: 500, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Download size={14} strokeWidth={1.75} /> Download PDF
            </button>
          </div>
        </div>

        <div style={{ padding: 24, background: '#f8fafc', maxHeight: '75vh', overflowY: 'auto' }}>
        
        {/* Printable Card Area - strictly A4 proportions (794x1123 px at 96 DPI) */}
        <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
          <ReportCardSheet report={report} student={student} schoolSettings={schoolSettings} />
        </div>
      </div>
      </div>
    </Modal>
  );
}
