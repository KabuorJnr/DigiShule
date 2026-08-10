import React from 'react';
import Modal from './Modal';
import { computeStudentReport } from '../utils/grading';
import { exportReportCardsPDF } from '../utils/exporters';
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

  let report = null;
  try {
    report = computeStudentReport({
      student,
      students,
      subjects,
      examTitle,
      termName,
      gradeBoundaries
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

  const handleDownloadPDF = () => {
    exportReportCardsPDF({
      school: schoolSettings,
      gradeBoundaries,
      students: [student],
      subjects,
      examTitle,
      termName,
      filename: `${student.name.replace(/\s+/g, '_')}_Report_Card.pdf`
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Palette — a single quiet ink + muted palette shared with the PDF renderer.
  const INK = '#111827';
  const MUTED = '#6b7280';
  const LINE = '#e5e7eb';
  const SOFT = '#f9fafb';
  const maxPts = is844 ? 12 : 8;

  const contact = [schoolSettings.address, schoolSettings.phone || schoolSettings.tel, schoolSettings.email].filter(Boolean).join('  ·  ');

  return (
    <Modal title="Student Report Card" onClose={onClose} width={840}>
      <div style={{ padding: '4px 16px 20px', background: '#fff', color: INK, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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

        {/* Printable Card Area */}
        <div className="report-card-container" style={{ background: '#fff', color: INK, fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 13 }}>

          {/* School header — nothing hardcoded, motto only if provided */}
          <div style={{ textAlign: 'center', paddingBottom: 12, marginBottom: 16, borderBottom: `1px solid ${LINE}` }}>
            {schoolSettings.name && (
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
                {schoolSettings.name}
              </div>
            )}
            {contact && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{contact}</div>}
            {schoolSettings.motto && <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic', marginTop: 4 }}>{schoolSettings.motto}</div>}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px' }}>
              {is844 ? 'ACADEMIC REPORT' : 'LEARNER ASSESSMENT REPORT'}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
              {report.examTitle} · {report.termName}
            </div>
          </div>

          {/* Student info — clean 4-column strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `1px solid ${LINE}`, borderRadius: 6, background: SOFT, marginBottom: 20 }}>
            {[
              { k: 'Name', v: report.studentName || '—' },
              { k: 'Adm No.', v: String(report.admissionNo || '—') },
              { k: 'Class', v: String(report.className || '—') },
              { k: 'Position', v: report.classPosition ? `${report.classPosition} of ${report.classSize}` : '—' },
            ].map((f, i) => (
              <div key={f.k} style={{ padding: '10px 14px', borderLeft: i === 0 ? 'none' : `1px solid ${LINE}` }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{f.k}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Subject table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${LINE}`, marginBottom: 14 }}>
            <thead>
              <tr style={{ background: INK, color: '#fff' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>{is844 ? 'Subject' : 'Learning Area'}</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, width: 60 }}>Score</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, width: 60 }}>%</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, width: 70 }}>{is844 ? 'Grade' : 'Level'}</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, width: 50 }}>Pts</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {report.subjectRows.map(row => (
                <tr key={row.subject} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{row.subject}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>{row.scoreText || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>{row.percentageText || (row.percentage != null ? `${row.percentage}%` : '—')}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{row.gradeCode || row.gradeFull || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>{row.pts != null ? row.pts : '—'}</td>
                  <td style={{ padding: '7px 10px', color: MUTED, fontSize: 12 }}>{row.remark}</td>
                </tr>
              ))}
              <tr style={{ background: SOFT, borderTop: `1px solid ${LINE}`, fontWeight: 600 }}>
                <td style={{ padding: '9px 10px' }}>TOTAL / MEAN</td>
                <td style={{ padding: '9px 10px' }}></td>
                <td style={{ padding: '9px 10px', textAlign: 'center' }}>{report.meanPercentageText || '—'}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center' }}>{report.meanGradeCode || report.meanGradeFull || '—'}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center' }}>{report.totalPoints}/{report.subjectRows.length * maxPts}</td>
                <td style={{ padding: '9px 10px' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Grading key — one muted line, no rainbow */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Grading Key</div>
            <div style={{ fontSize: 11, color: INK, lineHeight: 1.5 }}>
              {is844
                ? 'A 80–100  ·  A- 75–79  ·  B+ 70–74  ·  B 65–69  ·  B- 60–64  ·  C+ 55–59  ·  C 50–54  ·  C- 45–49  ·  D+ 40–44  ·  D 35–39  ·  D- 30–34  ·  E 0–29'
                : 'EE1 90–100  ·  EE2 75–89  ·  ME1 58–74  ·  ME2 41–57  ·  AE1 31–40  ·  AE2 21–30  ·  BE1 11–20  ·  BE2 0–10'}
            </div>
          </div>

          {/* Comments — blank lines to write on. No fake auto-generated remarks. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 24 }}>Class Teacher's Comment</div>
              <div style={{ fontSize: 12, color: INK }}>Signature: ____________________  Date: ____________</div>
            </div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 24 }}>Principal's Comment</div>
              <div style={{ fontSize: 12, color: INK }}>Signature: ____________________  Date: ____________</div>
            </div>
          </div>

          <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16 }}>Parent / Guardian Comment</div>
            <div style={{ fontSize: 12, color: INK }}>Signature: ____________________  Date: ____________</div>
          </div>

        </div>
      </div>
    </Modal>
  );
}
