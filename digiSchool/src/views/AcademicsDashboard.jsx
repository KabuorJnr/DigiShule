import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
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
  const { navigate, notify, settings, teachers = [], examSchedules = [] } = store;
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState({ top_subjects: [] });
  const [awaitingApprovalCount, setAwaitingApprovalCount] = useState(0);
  
  useEffect(() => {
    import('../lib/api').then(({ fetchStudents, fetchAcademicAnalytics }) => {
      fetchStudents(0, 1000).then(r => setStudents(r.data || [])).catch(() => {});
      fetchAcademicAnalytics().then(r => setAnalytics(r || { top_subjects: [] })).catch(() => {});
    });

    const fetchApprovals = async () => {
      try {
        const { count: approvalCount } = await supabase.from('approval_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('school_id', store.schoolId);
          
        const { count: paperCount } = await supabase.from('exam_papers')
          .select('*', { count: 'exact', head: true })
          .eq('moderation_status', 'pending')
          .eq('school_id', store.schoolId);
          
        setAwaitingApprovalCount((approvalCount || 0) + (paperCount || 0));
      } catch (err) {
        console.error(err);
      }
    };
    if (store.schoolId) fetchApprovals();
  }, [store.schoolId]);
  
  const classesCount = settings.levels?.length || 0;
  const activeTeacherList = teachers.filter(t => t.status !== 'Inactive');
  const activeTeachers = activeTeacherList.filter(t => t.status === 'Active').length;
  
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
    const body = analytics.top_subjects.map(r => [r.name, r.score]);
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
      ['Class', 'Subject', 'Teacher', 'Status']
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
        <Stat label="Total Students" value={students.length} sub="Enrolled" color="#0078D4" />
        <Stat label="Teaching Staff" value={activeTeacherList.length} sub={`${activeTeachers} active`} color="#0EA5E9" />
        <Stat label="Classes & Streams" value={`${classesCount} / ${classesCount * 2}`} sub="Levels / Streams" color="#107C10" />
        <Stat label="Subjects" value="8" sub="Active subjects" color="#FFB900" />
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 24 }}>
        <Stat label="Total Exams" value={examSchedules.length} sub={`${examSchedules.length} published`} />
        <Stat label="Pending Marks Entry" value="0" sub="All marks entered" color="#107C10" />
        <Stat label="Awaiting Approval" value={awaitingApprovalCount} sub="Results & plans to approve" color="#D13438" />
        <Stat label="Avg Performance" value="0.0%" sub="Overall average score" color="#107C10" />
      </div>

      {/* Quick Actions */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <h3 className="section-title">Quick Actions</h3>
        <div className="grid grid-4" style={{ gap: 10 }}>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('timetable')}>Manage Timetable</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('gradebook')}>Open Gradebook</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('exams')}>Exam Schedules</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('registrar')}>Class Lists</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('staff_attendance')}>Staff Attendance</button>
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
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.top_subjects} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {analytics.top_subjects.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#047857' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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



