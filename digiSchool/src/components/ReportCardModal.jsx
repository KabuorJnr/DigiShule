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

  return (
    <Modal title="Student Report Card" onClose={onClose} width={840}>
      <div style={{ padding: '8px 16px 24px 16px', background: '#fff', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Action Toolbar */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: is844 ? '#eff6ff' : '#f0fdf4', color: is844 ? '#1d4ed8' : '#15803d', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            <Award size={14} /> {is844 ? 'SYSTEM: 8-4-4 KCSE SYSTEM (FORM 3/4)' : 'SYSTEM: CBC CURRICULUM'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Printer size={16} /> Print
            </button>
            <button className="btn btn-primary" onClick={handleDownloadPDF} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={16} /> Download PDF
            </button>
          </div>
        </div>

        {/* Printable Card Area */}
        <div className="report-card-container" style={{ background: '#fff', padding: '32px 40px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              {is844 ? 'SECONDARY SCHOOL ACADEMIC REPORT CARD (8-4-4)' : 'STUDENT REPORT CARD (CBC)'}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              {report.examTitle}
            </h1>
            <div style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>
              {report.termName}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0 24px 0' }} />

          {/* Student Info Block */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 12px', marginBottom: 24, fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                STUDENT
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                {report.studentName}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                ADMISSION NO.
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                {report.admissionNo}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                CLASS
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                {report.className}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                STREAM POSITION
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                {report.streamPosition}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                OVERALL POSITION
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                {report.overallPosition}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                MEAN GRADE
              </div>
              <div style={{ fontWeight: 700, color: is844 ? '#1d4ed8' : '#0f172a', fontSize: 15 }}>
                {report.meanGradeCode}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                TOTAL POINTS
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                {report.totalPointsText}
              </div>
            </div>
          </div>

          {/* Subject Table */}
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #0f172a' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a' }}>Subject</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>Score</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>%</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a' }}>Grade</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>{is844 ? 'Pts (1-12)' : 'Pts'}</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a' }}>Remark</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>Position</th>
                </tr>
              </thead>
              <tbody>
                {report.subjectRows.map((row) => (
                  <tr key={row.subject} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px', color: '#1e293b' }}>{row.subject}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#1e293b' }}>{row.scoreText}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#1e293b' }}>{row.percentageText}</td>
                    <td style={{ padding: '10px 8px', color: '#1e293b', fontWeight: 600 }}>{row.gradeFull}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#1e293b' }}>{row.pts}</td>
                    <td style={{ padding: '10px 8px', color: '#64748b', fontSize: 12 }}>{row.remark}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#1e293b' }}>{row.position}</td>
                  </tr>
                ))}
                {/* Mean / Total Row */}
                <tr style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 700 }}>
                  <td style={{ padding: '12px 8px', color: '#0f172a' }}>Mean / Total</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0f172a' }}>{report.totalMarks}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0f172a' }}>{report.meanPercentageText}</td>
                  <td style={{ padding: '12px 8px', color: is844 ? '#1d4ed8' : '#0f172a' }}>{report.meanGradeFull}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0f172a' }}>{report.totalPoints}</td>
                  <td style={{ padding: '12px 8px', color: '#64748b', fontSize: 12 }}>{is844 ? 'Overall Performance' : 'Mean CBC Performance'}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: '#0f172a' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Grading Key Footer */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              {is844 ? '8-4-4 KCSE GRADING KEY' : 'GRADING KEY'}
            </div>
            {is844 ? (
              <div style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span><strong>A</strong> (80–100% | 12pts)</span>
                  <span><strong>A-</strong> (75–79% | 11pts)</span>
                  <span><strong>B+</strong> (70–74% | 10pts)</span>
                  <span><strong>B</strong> (65–69% | 9pts)</span>
                  <span><strong>B-</strong> (60–64% | 8pts)</span>
                  <span><strong>C+</strong> (55–59% | 7pts)</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span><strong>C</strong> (50–54% | 6pts)</span>
                  <span><strong>C-</strong> (45–49% | 5pts)</span>
                  <span><strong>D+</strong> (40–44% | 4pts)</span>
                  <span><strong>D</strong> (35–39% | 3pts)</span>
                  <span><strong>D-</strong> (30–34% | 2pts)</span>
                  <span><strong>E</strong> (0–29% | 1pt)</span>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: '#334155', fontWeight: 500, display: 'flex', gap: '28px', flexWrap: 'wrap', marginBottom: 4 }}>
                  <span>Exceeding Expectation (80–100%)</span>
                  <span>Meeting Expectation (50–79%)</span>
                  <span>Approaching Expectation (30–49%)</span>
                </div>
                <div style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>
                  <span>Below Expectation (0–29%)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
