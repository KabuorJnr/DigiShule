import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Badge, ProgressBar } from '../components/widgets';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, CheckCircle, Clock, Eye, ShieldCheck, Check, X } from 'lucide-react';
import Modal from '../components/Modal';

function Stat({ label, value, color, sub }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a', marginBottom: 2 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function DosDashboard({ store, user }) {
  const { navigate, notify, settings, teachers = [], examSchedules = [], timetables = {} } = store;
  
  const [approvals, setApprovals] = useState([]);
  const [examPapers, setExamPapers] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [observations, setObservations] = useState([]);
  
  const [loading, setLoading] = useState(false);

  const fetchDosData = async () => {
    setLoading(true);
    try {
      // Fetch approvals
      const { data: appData } = await supabase.from('approval_queue').select('*, profiles:teacher_id(full_name)').eq('school_id', store.schoolId);
      if (appData) setApprovals(appData);

      // Fetch exam papers
      const { data: paperData } = await supabase.from('exam_papers').select('*, profiles:set_by_teacher_id(full_name)').eq('school_id', store.schoolId);
      if (paperData) setExamPapers(paperData);

      // Fetch coverage
      const { data: covData } = await supabase.from('syllabus_coverage_snapshots').select('*, profiles:teacher_id(full_name)').eq('school_id', store.schoolId);
      if (covData) setCoverage(covData);

      // Fetch observations
      const { data: obsData } = await supabase.from('lesson_observations').select('*, profiles:teacher_id(full_name)').eq('school_id', store.schoolId);
      if (obsData) setObservations(obsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (store.schoolId) {
      fetchDosData();
    }
  }, [store.schoolId]);

  // Compute teacher workload from timetables json
  const teacherWorkload = useMemo(() => {
    const counts = {};
    Object.values(timetables).forEach(tt => {
      if (!tt.grid) return;
      tt.grid.forEach(row => {
        row.forEach(cell => {
          if (cell && cell.type === 'lesson' && cell.teacher) {
            counts[cell.teacher] = (counts[cell.teacher] || 0) + 1;
          }
        });
      });
    });
    
    return Object.entries(counts)
      .map(([name, periods]) => ({ name, periods, isOverload: periods > 27 }))
      .sort((a, b) => b.periods - a.periods);
  }, [timetables]);

  const activeTeacherList = teachers.filter(t => t.status !== 'Inactive');
  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length;
  const pendingPapersCount = examPapers.filter(p => p.moderation_status === 'pending').length;
  const pendingReleaseExamsCount = examSchedules.filter(e => e.status === 'Completed' && !e.released).length;

  const handleApprove = async (id, table) => {
    try {
      const { error } = await supabase.from(table).update(
        table === 'approval_queue' 
          ? { status: 'approved', reviewer_id: user.id, reviewed_at: new Date().toISOString() } 
          : { moderation_status: 'approved', moderated_by: user.id }
      ).eq('id', id);
      
      if (error) throw error;
      notify('Approved successfully');
      fetchDosData();
    } catch (err) {
      notify('Failed to approve', 'error');
    }
  };

  const handleExportTermlyReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('DoS Termly Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`School: ${settings?.name || 'School'}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 38);

    doc.setFontSize(14);
    doc.text('Teacher Workload (Overloads)', 14, 50);
    
    const overloadData = teacherWorkload.filter(t => t.isOverload).map(t => [t.name, t.periods]);
    if (overloadData.length > 0) {
      doc.autoTable({
        startY: 55,
        head: [['Teacher', 'Periods/Week']],
        body: overloadData,
      });
    } else {
      doc.setFontSize(10);
      doc.text('No overloaded teachers found.', 14, 58);
    }
    
    let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 60;

    doc.setFontSize(14);
    doc.text('Lesson Observations', 14, finalY + 15);
    const obsList = observations.map(o => [o.observation_date, o.profiles?.full_name || 'Teacher', o.subject, o.follow_up_required ? 'Yes' : 'No']);
    doc.autoTable({
      startY: finalY + 20,
      head: [['Date', 'Teacher', 'Subject', 'Follow-up Req.']],
      body: obsList.length > 0 ? obsList : [['-', '-', '-', '-']],
    });

    doc.save('DoS_Termly_Report.pdf');
    notify('Report exported as PDF');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Director of Studies (DoS) Portal</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Curriculum, moderation, and teacher workload</p>
        </div>
        <button className="btn btn-primary" onClick={handleExportTermlyReport}>
          <Download size={16} style={{ marginRight: 6 }}/> Export Termly Report
        </button>
      </div>

      <div style={{ background: '#0f172a', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Director of Studies Office</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Overseeing curriculum implementation and academic quality
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div style={{ marginBottom: 4 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div>Term 2 · Academic Year 2026</div>
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 24 }}>
        <Stat label="Pending Approvals" value={pendingApprovalsCount} sub="Schemes & Lessons" color={pendingApprovalsCount > 0 ? "#F59E0B" : "#10B981"} />
        <Stat label="Exams to Moderate" value={pendingPapersCount} sub="Pending papers" color={pendingPapersCount > 0 ? "#F59E0B" : "#10B981"} />
        <Stat label="Pending Releases" value={pendingReleaseExamsCount} sub="Exams ready for release" color="#3B82F6" />
        <Stat label="Overloaded Teachers" value={teacherWorkload.filter(t => t.isOverload).length} sub="> 27 periods/week" color="#EF4444" />
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="#3b82f6"/> Scheme & Lesson Approvals
          </h3>
          <div className="list-flex">
            {approvals.filter(a => a.status === 'pending').map(a => (
              <div key={a.id} className="rank-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{a.item_type === 'scheme_of_work' ? 'Scheme of Work' : 'Lesson Plan'}</span>
                  <div className="muted" style={{ fontSize: 12 }}>{a.profiles?.full_name || 'Teacher'}</div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => handleApprove(a.id, 'approval_queue')}>
                  <Check size={14}/> Approve
                </button>
              </div>
            ))}
            {approvals.filter(a => a.status === 'pending').length === 0 && <span className="muted">No pending approvals.</span>}
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#3b82f6"/> Exam Paper Moderation
          </h3>
          <div className="list-flex">
            {examPapers.filter(p => p.moderation_status === 'pending').map(p => (
              <div key={p.id} className="rank-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{p.subject} - {p.class}</span>
                  <div className="muted" style={{ fontSize: 12 }}>Set by: {p.profiles?.full_name || 'Unknown'}</div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => handleApprove(p.id, 'exam_papers')}>
                  <Check size={14}/> Moderate
                </button>
              </div>
            ))}
            {examPapers.filter(p => p.moderation_status === 'pending').length === 0 && <span className="muted">No pending exam papers.</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 15, margin: 0 }}>
              Teacher Workload
            </h3>
          </div>
          <table className="table">
            <thead>
              <tr><th>Teacher</th><th>Periods / Week</th><th>Status</th></tr>
            </thead>
            <tbody>
              {teacherWorkload.slice(0, 8).map((tw, idx) => (
                <tr key={idx} style={{ background: tw.isOverload ? '#fef2f2' : 'inherit' }}>
                  <td><strong>{tw.name}</strong></td>
                  <td>{tw.periods}</td>
                  <td>
                    {tw.isOverload ? <Badge color="red">Overload</Badge> : <Badge color="green">Normal</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 15, margin: 0 }}>
              Syllabus Coverage Tracker
            </h3>
            <button className="btn btn-sm" onClick={fetchDosData}>Refresh Snapshot</button>
          </div>
          <div className="list-flex">
            {coverage.map(c => {
              const pct = Math.round((c.strands_covered / (c.strands_total || 1)) * 100);
              return (
                <div key={c.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <strong>{c.subject} ({c.class})</strong>
                    <span>{pct}%</span>
                  </div>
                  <ProgressBar value={pct} color={pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'} />
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Teacher: {c.profiles?.full_name || 'Unknown'}</div>
                </div>
              );
            })}
            {coverage.length === 0 && <div className="muted" style={{ padding: 12, textAlign: 'center' }}>No coverage snapshots generated yet.</div>}
          </div>
        </div>
      </div>

    </div>
  );
}
