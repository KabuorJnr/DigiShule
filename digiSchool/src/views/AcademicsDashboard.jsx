import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
const TOP_SUBJECTS_DATA = [];
import { Badge, ProgressBar } from '../components/widgets';
import { exportTablePDF, downloadCSV } from '../utils/exporters';
import { Download, FileText } from 'lucide-react';

function Stat({ label, value, color, sub }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a', marginBottom: 2 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function AcademicsDashboard({ store, user }) {
  const { navigate, notify, settings } = store;
  
  const classPerfData = [];
  const classPerfSummary = [];

  const handleExportClassPerf = () => {
    const head = ['Class', 'Students', 'Streams', 'Avg Score (%)', 'Pass Rate (%)', 'Marks Status'];
    const body = classPerfSummary.map(r => [r.class, r.students, r.streams, r.avg, r.passRate, r.marks]);
    exportTablePDF({
      school: settings,
      title: 'Class Performance Summary',
      subtitle: `Term 2 · Academic Year 2026`,
      head, body,
      filename: 'Class_Performance_Summary.pdf'
    });
  };

  const handleExportAnalysis = () => {
    const head = ['Subject', 'Percentage (%)'];
    const body = TOP_SUBJECTS_DATA.map(r => [r.name, r.score]);
    exportTablePDF({
      school: settings,
      title: 'Exam Analysis & Grade Distribution',
      subtitle: 'Top Performing Subjects Overview',
      head, body,
      filename: 'Exam_Analysis.pdf'
    });
  };

  const handleExportPendingMarks = () => {
    const rows = [
      ['Class', 'Subject', 'Teacher', 'Status'],
      ['Grade 7', 'Mathematics', 'Mr. Omondi', 'Pending'],
      ['Grade 8', 'Science', 'Ms. Wanjiku', 'Pending'],
      ['Grade 9', 'History', 'Mr. Kiprop', 'Pending']
    ];
    downloadCSV('Pending_Marks_Report.csv', rows);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Deputy Academics Dashboard</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Academic overview and performance analytics</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('notices')}>Post Notice</button>
      </div>

      <div style={{ background: '#0078D4', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Academic Affairs Office</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Managing exams, curriculum, subjects, and academic performance
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div style={{ marginBottom: 4 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div>Term 2 · Academic Year 2026</div>
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
        <Stat label="Total Students" value="847" sub="Boarding: 620 | Day: 227" color="#0078D4" />
        <Stat label="Teaching Staff" value="42" sub="38 active, 4 on leave" color="#0EA5E9" />
        <Stat label="Classes & Streams" value="4 / 8" sub="Forms 1-4, 2 streams each" color="#107C10" />
        <Stat label="Subjects" value="8" sub="Active subjects" color="#FFB900" />
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 24 }}>
        <Stat label="Total Exams" value="5" sub="5 published" />
        <Stat label="Pending Marks Entry" value="0" sub="All marks entered" color="#107C10" />
        <Stat label="Awaiting Approval" value="2" sub="Results to approve" color="#D13438" />
        <Stat label="Avg Performance" value="66.0%" sub="Overall average score" color="#107C10" />
      </div>

      {/* Quick Actions */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <h3 className="section-title">Quick Actions</h3>
        <div className="grid grid-4" style={{ gap: 10 }}>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('timetable')}>Manage Timetable</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('create_exam')}>Create Exam</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('gradebook')}>Open Gradebook</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('exams')}>Exam Schedules</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('staff')}>Staff Attendance</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('notices')}>Post Notice</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('admissions')}>Student Records</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={handleExportPendingMarks}>
            <FileText size={16} style={{ marginRight: 6 }}/> Pending Marks
          </button>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#0078D4', fontSize: 15, marginBottom: 16 }}>
            Class Performance Overview
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={classPerfData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} tick={{ fontSize: 12 }} tickFormatter={val => `${val}%`} />
              <Tooltip formatter={value => `${value}%`} cursor={{ fill: '#f8fafc' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="average" name="Average Score (%)" fill="#0078D4" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="passRate" name="Pass Rate (%)" fill="#107C10" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ color: '#0078D4', fontSize: 15, margin: 0 }}>
              Top Performing Subjects
            </h3>
            <button className="btn btn-sm" onClick={handleExportAnalysis}>
              <Download size={14} style={{ marginRight: 4 }}/> Exam Analysis
            </button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={TOP_SUBJECTS_DATA} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} tick={{ fontSize: 12 }} tickFormatter={val => `${val}%`} />
              <Tooltip formatter={value => `${value}%`} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="score" name="Percentage (%)" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {TOP_SUBJECTS_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title" style={{ color: '#0078D4', fontSize: 15, margin: 0 }}>
            Class Performance Summary
          </h3>
          <button className="btn btn-sm" onClick={handleExportClassPerf}>
            <Download size={14} style={{ marginRight: 4 }}/> Download Summary
          </button>
        </div>
        <table className="table">
          <thead>
            <tr><th>Class</th><th>Students</th><th>Streams</th><th>Avg Score</th><th>Pass Rate</th><th>Marks</th><th>Performance</th></tr>
          </thead>
          <tbody>
            {classPerfSummary.map(row => (
              <tr key={row.id}>
                <td><strong>{row.class}</strong></td>
                <td>{row.students}</td>
                <td>{row.streams}</td>
                <td>
                  <span style={{ color: row.avg >= 60 ? '#107C10' : row.avg >= 55 ? '#FFB900' : '#D13438', fontWeight: 600 }}>
                    {row.avg}%
                  </span>
                </td>
                <td><Badge color={row.passRate >= 75 ? 'green' : row.passRate >= 50 ? 'amber' : 'red'}>{row.passRate}%</Badge></td>
                <td>{row.marks}</td>
                <td><div style={{ width: 100 }}><ProgressBar value={row.avg} color={row.avg >= 60 ? '#107C10' : row.avg >= 55 ? '#FFB900' : '#D13438'} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
