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

  // Dynamic comment logic
  const meanPct = report.totalMarks / (report.subjectRows.length * 100) * 100;
  let teacherComment = "";
  let principalComment = "";
  
  if (is844) {
    if (meanPct >= 70) {
      teacherComment = "An excellent performance. Keep up the high standard and maintain focus.";
      principalComment = "Outstanding result. Continue working hard to achieve even greater success.";
    } else if (meanPct >= 50) {
      teacherComment = "A good effort, but there is room for improvement in weaker subjects.";
      principalComment = "Good work. With more dedication, you can achieve a much higher grade.";
    } else {
      teacherComment = "Below average performance. You need to put in more effort and seek help in challenging areas.";
      principalComment = "Work harder and stay focused. Close monitoring by teachers and parents is advised.";
    }
  } else {
    if (meanPct >= 75) {
      teacherComment = "Exceeding expectations across most learning areas. Keep up the excellent work.";
      principalComment = "Outstanding performance. Keep maintaining this high level of excellence.";
    } else if (meanPct >= 50) {
      teacherComment = "Meeting expectations in most areas. Work on the subjects where you are approaching expectation.";
      principalComment = "Good effort. Aim to exceed expectations in the upcoming assessments.";
    } else {
      teacherComment = "Needs intensive support and remedial intervention across multiple learning areas. Immediate action is required.";
      principalComment = "Immediate intervention is required to improve your performance. The school will work closely with you and your parents to provide necessary support.";
    }
  }

  return (
    <Modal title="Student Report Card" onClose={onClose} width={840}>
      <div style={{ padding: '8px 16px 24px 16px', background: '#fff', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Action Toolbar */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: is844 ? '#eff6ff' : '#f0fdf4', color: is844 ? '#1d4ed8' : '#15803d', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            <Award size={14} /> {is844 ? 'SYSTEM: 8-4-4 KCSE FORMAT' : 'SYSTEM: CBC CURRICULUM FORMAT'}
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
        <div className="report-card-container" style={{ background: '#fff', padding: '0 0 20px 0', fontFamily: 'Arial, sans-serif', color: '#000' }}>
          
          <div style={{ borderTop: '6px solid #1d4ed8', paddingTop: 20, textAlign: 'center', marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 'bold', margin: '0 0 4px 0', color: '#1e293b' }}>
              {schoolSettings.name || 'Kinjau Junior Secondary'}
            </h1>
            <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', marginBottom: 12 }}>
              {schoolSettings.motto || 'Excellence in Education'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase' }}>
              {is844 ? 'SECONDARY SCHOOL ACADEMIC REPORT CARD' : 'JUNIOR SECONDARY ASSESSMENT REPORT'}
            </div>
          </div>

          <div style={{ border: '1px solid #94a3b8', display: 'flex', flexWrap: 'wrap', fontSize: 13, background: '#f8fafc', marginBottom: 16 }}>
            <div style={{ padding: '8px 12px', borderRight: '1px solid #94a3b8', flex: 1.5, minWidth: 200 }}><strong>Name:</strong> {report.studentName}</div>
            <div style={{ padding: '8px 12px', borderRight: '1px solid #94a3b8', flex: 1, minWidth: 150 }}><strong>Adm No:</strong> {report.admissionNo}</div>
            <div style={{ padding: '8px 12px', borderRight: '1px solid #94a3b8', flex: 1, minWidth: 150 }}><strong>Grade:</strong> {report.className}</div>
            <div style={{ padding: '8px 12px', flex: 1, minWidth: 150 }}><strong>Term:</strong> {report.termName}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8' }}>
                <th style={{ padding: '8px', borderRight: '1px solid #94a3b8', textAlign: 'left', fontWeight: 'bold' }}>{is844 ? 'Subject' : 'Learning Area'}</th>
                <th style={{ padding: '8px', borderRight: '1px solid #94a3b8', textAlign: 'center', fontWeight: 'bold', width: 60 }}>Score</th>
                <th style={{ padding: '8px', borderRight: '1px solid #94a3b8', textAlign: 'center', fontWeight: 'bold', width: 80 }}>{is844 ? '%' : 'Level'}</th>
                <th style={{ padding: '8px', borderRight: '1px solid #94a3b8', textAlign: 'center', fontWeight: 'bold', width: 60 }}>Pts</th>
                <th style={{ padding: '8px', borderRight: '1px solid #94a3b8', textAlign: 'left', fontWeight: 'bold' }}>Remarks</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', width: 120 }}>Teacher</th>
              </tr>
            </thead>
            <tbody>
              {report.subjectRows.map(row => (
                <tr key={row.subject} style={{ borderBottom: '1px solid #94a3b8' }}>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #94a3b8' }}>{row.subject}</td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #94a3b8', textAlign: 'center' }}>{row.scoreText}</td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #94a3b8', textAlign: 'center' }}>{is844 ? row.percentageText : row.gradeFull}</td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #94a3b8', textAlign: 'center', fontWeight: 'bold', color: '#0f172a' }}>{row.pts}</td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #94a3b8', fontSize: 12 }}>{row.remark}</td>
                  <td style={{ padding: '6px 8px', fontSize: 12 }}></td>
                </tr>
              ))}
              <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid #94a3b8' }}>
                  Total Points: <span style={{ color: '#1d4ed8' }}>{report.totalPoints}/{is844 ? report.subjectRows.length * 12 : report.subjectRows.length * 4}</span>
                </td>
                <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid #94a3b8' }}>
                  Average ({report.subjectRows.length} {is844 ? 'subjects' : 'learning areas'}): {report.meanPercentageText}
                </td>
                <td colSpan={2} style={{ padding: '8px' }}>
                  Mean Grade: <span style={{ color: '#dc2626' }}>{report.meanGradeFull}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ border: '1px solid #94a3b8', borderTop: 'none', display: 'flex', alignItems: 'center', fontSize: 11, background: '#f8fafc', marginBottom: 16 }}>
            <div style={{ padding: '6px 12px', fontWeight: 'bold', borderRight: '1px solid #94a3b8' }}>KEY:</div>
            <div style={{ padding: '6px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px 16px', flex: 1 }}>
              {is844 ? (
                <>
                  <span style={{ color: '#1d4ed8' }}>A=80-100%</span>
                  <span style={{ color: '#1d4ed8' }}>A-=75-79%</span>
                  <span style={{ color: '#16a34a' }}>B+=70-74%</span>
                  <span style={{ color: '#16a34a' }}>B=65-69%</span>
                  <span style={{ color: '#16a34a' }}>B-=60-64%</span>
                  <span style={{ color: '#16a34a' }}>C+=55-59%</span>
                  <span style={{ color: '#d97706' }}>C=50-54%</span>
                  <span style={{ color: '#d97706' }}>C-=45-49%</span>
                  <span style={{ color: '#d97706' }}>D+=40-44%</span>
                  <span style={{ color: '#dc2626' }}>D=35-39%</span>
                  <span style={{ color: '#dc2626' }}>D-=30-34%</span>
                  <span style={{ color: '#dc2626' }}>E=0-29%</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#1d4ed8' }}>EE1=90-100%</span>
                  <span style={{ color: '#1d4ed8' }}>EE2=75-89%</span>
                  <span style={{ color: '#16a34a' }}>ME1=58-74%</span>
                  <span style={{ color: '#16a34a' }}>ME2=41-57%</span>
                  <span style={{ color: '#d97706' }}>AE1=31-40%</span>
                  <span style={{ color: '#d97706' }}>AE2=21-30%</span>
                  <span style={{ color: '#dc2626' }}>BE1=11-20%</span>
                  <span style={{ color: '#dc2626' }}>BE2=0-10%</span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ border: '1px solid #94a3b8', padding: '12px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Class Teacher's Comment:</div>
              <div style={{ fontStyle: 'italic', color: '#334155', marginBottom: 16 }}>
                {report.studentName} {teacherComment}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>Name: _______________________________</div>
                <div>Signature: _______________________________</div>
                <div>Date: _______________________________</div>
              </div>
            </div>

            <div style={{ border: '1px solid #94a3b8', padding: '12px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Principal's Comment:</div>
              <div style={{ fontStyle: 'italic', color: '#334155', marginBottom: 16 }}>
                {report.studentName}, {principalComment}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>Name: _______________________________</div>
                <div>Signature: _______________________________</div>
                <div>Date: _______________________________</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ border: '1px solid #94a3b8', padding: '12px', flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Parent/Guardian Comment:</div>
                <div style={{ display: 'flex', gap: '40px' }}>
                  <div>Signature: _______________________________</div>
                  <div>Date: _______________________________</div>
                </div>
              </div>
              <div style={{ width: 150, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }}>
                SCHOOL STAMP
              </div>
            </div>
          </div>

        </div>
      </div>
    </Modal>
  );
}
