import React from 'react';
import Modal from './Modal';
import { computeStudentReport } from '../utils/grading';
import { QRCodeSVG } from 'qrcode.react';
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

  const handleDownloadPDF = async () => {
    const el = document.getElementById('report-card-capture-area');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(`${report.studentName}_Report.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const INK = '#111827';
  const MUTED = '#6b7280';
  const maxPts = is844 ? 12 : 8;

  const classStr = (report.className || '').toLowerCase();
  const isSenior = classStr.includes('10') || classStr.includes('11') || classStr.includes('12') || classStr.includes('form');
  const pathway = isSenior ? (student.pathway || 'STEM') : null;
  
  const subjectsGraphData = report.subjectRows.map(row => {
    const classAvg = 65; 
    return { name: row.subject.substring(0, 3).toUpperCase(), score: row.score, classAvg };
  });

  return (
    <Modal title="Student Report Card" onClose={onClose} width={840}>
      <div style={{ padding: '4px 16px 20px', background: '#eef2f6', color: INK, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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
        
        {/* Printable Card Area */}
        <div id="report-card-capture-area" style={{ background: '#fff', maxWidth: 800, margin: '0 auto', color: INK, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: 12, border: '1px solid #ccc', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 24px', borderBottom: '3px solid #2563eb', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 24, top: 16 }}>
              {schoolSettings.logo ? (
                <img src={schoolSettings.logo} alt="Logo" style={{ width: 80, height: 80, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 80, height: 80, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>Logo</span>
                </div>
              )}
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 6 }}>
                {schoolSettings.name || 'DigiSchool Institution'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                Address: {schoolSettings.address || 'P.O. Box 00-00000'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                Tel: {schoolSettings.phone || schoolSettings.tel || '0700000000'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Email: {schoolSettings.email || 'info@school.com'}
              </div>
            </div>
          </div>

          {/* Title Ribbon */}
          <div style={{ background: '#2563eb', color: '#fff', textAlign: 'center', padding: '8px', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ACADEMIC REPORT FORM - {report.className} - {report.examTitle.toUpperCase()} - ({new Date().getFullYear()} {report.termName.toUpperCase()})
          </div>

          <div style={{ padding: '24px 24px 0 24px' }}>
            {/* Student Info & Graph */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 100, height: 110, background: '#cbd5e1', borderRadius: 4, overflow: 'hidden', border: '1px solid #94a3b8' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1" style={{ width: '100%', height: '100%', padding: 10 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a', marginBottom: 8 }}>{report.studentName}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>ADMNO: {report.admissionNo}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>GRADE: {report.className}</div>
                  {pathway && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>PATHWAY: {pathway}</div>
                  )}
                </div>
              </div>
              
              {/* Graph Area */}
              <div style={{ width: 320, paddingLeft: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subject Performance - Student vs Class</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, background: '#22c55e' }}></span> Student</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, background: '#cbd5e1' }}></span> Class</span>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 80, borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0' }}>
                  <svg viewBox={`0 0 ${subjectsGraphData.length * 40} 100`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Class Average Line (Gray) */}
                    <polyline 
                      fill="none" 
                      stroke="#cbd5e1" 
                      strokeWidth="2" 
                      points={subjectsGraphData.map((d, i) => `${i * 40 + 20},${100 - d.classAvg}`).join(' ')} 
                    />
                    {/* Student Score Line (Green) */}
                    <polyline 
                      fill="none" 
                      stroke="#22c55e" 
                      strokeWidth="2" 
                      points={subjectsGraphData.map((d, i) => `${i * 40 + 20},${100 - d.score}`).join(' ')} 
                    />
                    {subjectsGraphData.map((d, i) => (
                      <circle key={i} cx={i * 40 + 20} cy={100 - d.score} r="3" fill="#166534" />
                    ))}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, width: '100%', paddingLeft: 4 }}>
                    {subjectsGraphData.map((d, i) => (
                      <div key={i} style={{ fontSize: 9, color: '#64748b' }}>{d.name}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'flex', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', marginBottom: 20, justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Performance Level</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{report.meanGradeCode || report.meanGradeFull || '—'}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Total Marks</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                  {report.totalMarks}/{report.subjectRows.length * 100}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Total Points</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                  {report.totalPoints}/{report.subjectRows.length * maxPts}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Mean Points</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                  {report.meanPoints}/{maxPts}
                </div>
              </div>
            </div>

            {/* Subject table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid #cbd5e1`, marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 12, borderRight: '1px solid #e2e8f0' }}>SUBJECTS</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 12, width: 80, borderRight: '1px solid #e2e8f0' }}>MARKS</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 12, width: 60, borderRight: '1px solid #e2e8f0' }}>DEV</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 12, width: 70, borderRight: '1px solid #e2e8f0' }}>GRADE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 12, borderRight: '1px solid #e2e8f0' }}>COMMENT</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 12, width: 140 }}>TEACHER</th>
                </tr>
              </thead>
              <tbody>
                {report.subjectRows.map(row => {
                  const dev = (row.score || 0) - 65; // Mock dev logic for now, using 65 as baseline
                  const devColor = dev > 0 ? '#16a34a' : (dev < 0 ? '#dc2626' : '#475569');
                  const devSymbol = dev > 0 ? '↑' : (dev < 0 ? '↓' : '-');
                  return (
                    <tr key={row.subject} style={{ borderBottom: `1px solid #e2e8f0` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>{row.subject}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>{row.scoreText || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: devColor, fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                        {dev > 0 ? `+${dev}` : dev} {dev !== 0 && devSymbol}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>{row.gradeCode || row.gradeFull || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, borderRight: '1px solid #e2e8f0' }}>{row.remark}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{/* Teacher name placeholder for now */ 'Academic Dept'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Remarks Section */}
            <div style={{ display: 'flex', border: '1px solid #94a3b8', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ flex: 1, padding: 16, borderRight: '1px solid #94a3b8' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Class Teacher Remarks:</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, minHeight: 60 }}>
                  {report.studentName.split(' ')[0]}, you're meeting the expected standards with solid effort. Continue this positive momentum, and you'll continue to excel.
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Signature:</span>
                  <div style={{ width: 140, borderBottom: '1px solid #334155', position: 'relative' }}>
                    <svg viewBox="0 0 100 30" style={{ position: 'absolute', bottom: 0, left: 10, width: 80, height: 30 }} preserveAspectRatio="none">
                      <path d="M10,25 C30,10 50,30 80,5" stroke="#1e3a8a" strokeWidth="2" fill="none"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, padding: 16, position: 'relative' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Chief Principal Remarks: {schoolSettings.principal || ''}</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, minHeight: 60 }}>
                  {report.studentName.split(' ')[0]}, you are performing well and meeting expectations. Your progress is steady, and with continued focus and dedication, you will continue to grow. Keep up the good work.
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Signature:</span>
                  <div style={{ width: 140, borderBottom: '1px solid #334155', position: 'relative' }}>
                    <svg viewBox="0 0 100 30" style={{ position: 'absolute', bottom: 0, left: 10, width: 80, height: 30 }} preserveAspectRatio="none">
                      <path d="M5,20 Q40,5 60,25 T95,10" stroke="#1e3a8a" strokeWidth="2" fill="none"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Descriptors Table */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, textTransform: 'uppercase' }}>Grade Descriptors</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid #94a3b8`, fontSize: 11, textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '6px', borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8', textAlign: 'left', width: 140 }}>Performance Level</th>
                    <th colSpan={2} style={{ padding: '6px', borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }}>Exceeding Expectations</th>
                    <th colSpan={2} style={{ padding: '6px', borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }}>Meeting Expectations</th>
                    <th colSpan={2} style={{ padding: '6px', borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }}>Approaching Expectations</th>
                    <th colSpan={2} style={{ padding: '6px', borderBottom: '1px solid #94a3b8' }}>Below Expectations</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #94a3b8', textAlign: 'left' }}>Actual Performance</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>EE1</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>EE2</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>ME1</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>ME2</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>AE1</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>AE2</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>BE1</td>
                    <td style={{ padding: '6px' }}>BE2</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #94a3b8', textAlign: 'left' }}>Points</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>8</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>7</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>6</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>5</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>4</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>3</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>2</td>
                    <td style={{ padding: '6px' }}>1</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #94a3b8', textAlign: 'left' }}>Range (%)</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>90-100</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>75-89</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>58-74</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>41-57</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>31-40</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>21-30</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #94a3b8' }}>11-20</td>
                    <td style={{ padding: '6px' }}>0-10</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer QR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
              <div style={{ width: 64, height: 64, background: '#fff', border: '1px solid #cbd5e1', padding: 4, flexShrink: 0 }}>
                <QRCodeSVG value={`https://digishule.com/verify?id=${report.id || report.admissionNo}&term=Term2`} size={54} level="M" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Verification Code: {report.admissionNo?.substring(0,6) || 'P6AK6F'}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Scan to verify the authenticity of this document via DigiSchool.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </Modal>
  );
}
