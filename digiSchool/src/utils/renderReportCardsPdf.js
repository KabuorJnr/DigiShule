import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { computeStudentReport } from './grading';
import { ensureReportFontsLoaded } from './fonts';
import ReportCardSheet from '../components/ReportCardSheet';

// Renders one or many report cards to a multi-page A4 PDF by mounting the exact
// same <ReportCardSheet> the on-screen modal uses into an off-screen container
// and capturing it with html2canvas. This guarantees the bulk export is
// pixel-identical to the single-card download — including the verifiable QR —
// across every portal that triggers it.
export async function renderReportCardsPdf({
  school = {},
  gradeBoundaries = [],
  students = [],
  subjects = [],
  examTitle = 'Term 1 Opening Exam',
  termName = 'Term 1',
  filename = 'report_cards.pdf',
}) {
  const targetStudents = Array.isArray(students) ? students.filter(Boolean) : [];
  if (targetStudents.length === 0) return;

  // Off-screen host: kept in layout (not display:none) so html2canvas can
  // measure and paint it, but pushed far off-screen so users never see it.
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#ffffff';
  host.style.zIndex = '-1';
  document.body.appendChild(host);
  const root = createRoot(host);

  const renderSheet = (report, student) => new Promise((resolve) => {
    root.render(
      React.createElement(ReportCardSheet, {
        report,
        student,
        schoolSettings: school,
        captureId: 'bulk-report-card-capture',
      })
    );
    // Two frames lets React commit and the browser paint (SVG/QR included)
    // before we snapshot.
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    // Load Poppins once up front so every captured page uses the design font.
    await ensureReportFontsLoaded();

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    let pageAdded = false;
    for (const stu of targetStudents) {
      const report = computeStudentReport({
        student: stu,
        students: targetStudents,
        subjects,
        examTitle,
        termName,
        gradeBoundaries,
      });
      if (!report) continue;

      await renderSheet(report, stu);
      const el = host.querySelector('#bulk-report-card-capture');
      if (!el) continue;

      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const imgData = canvas.toDataURL('image/png');

      if (pageAdded) pdf.addPage();
      // Fit each card to a single A4 page, preserving aspect ratio: exact-A4
      // fills edge-to-edge; a taller card scales down instead of clipping.
      let drawW = pdfWidth;
      let drawH = (canvas.height * pdfWidth) / canvas.width;
      if (drawH > pdfHeight) {
        drawH = pdfHeight;
        drawW = (canvas.width * pdfHeight) / canvas.height;
      }
      const offsetX = (pdfWidth - drawW) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, 0, drawW, drawH, undefined, 'FAST');
      pageAdded = true;
    }

    if (!pageAdded) return;
    pdf.save(filename);
  } catch (err) {
    // Most call sites fire-and-forget this promise, so swallow the rejection
    // here (rather than letting it surface as an unhandled rejection) and let
    // the user know the export did not complete.
    console.error('Report card PDF generation failed:', err);
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Could not generate the report card PDF. Please try again.');
    }
  } finally {
    // Defer unmount so React can finish any pending work before teardown.
    setTimeout(() => {
      try { root.unmount(); } catch { /* already torn down */ }
      if (host.parentNode) host.parentNode.removeChild(host);
    }, 0);
  }
}
