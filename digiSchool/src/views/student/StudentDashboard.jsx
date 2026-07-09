import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { BarChart3, Trophy, Wallet, ClipboardList, Calendar, Mail, Award } from 'lucide-react';
import { KpiCard, ProgressBar } from '../../components/widgets';
import { computeRow, gradeFor } from '../../utils/grading';
import { SUBJECTS } from '../../data/seed';
import Modal from '../../components/Modal';

export default function StudentDashboard() {
  const { me, rank, payments, store, navigate, notify } = useOutletContext();
  const [msgModal, setMsgModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ subject: '', body: '' });

  const { gradeBoundaries, feeStructure, notifications } = store;

  const subjects = useMemo(() => {
    if (!me) return [];
    return SUBJECTS.map(sub => {
      const scores = (me.scores || {})[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { subject: sub, ...row, grade };
    }).filter(Boolean);
  }, [me, gradeBoundaries]);

  const overallAvg = subjects.length ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1) : 0;

  const trendData = useMemo(() => [
    { term: 'Term 1', avg: 0 },
    { term: 'Term 2', avg: Number(overallAvg) || 0 }
  ], [overallAvg]);

  const termFees = feeStructure?.reduce((s, f) => s + (f.f1 || 0), 0) || 0;
  const totalPaid = payments.reduce((acc, p) => p.status !== 'Verification Pending' && p.status !== 'Pending' ? acc + Number(p.amount) : acc, 0);
  const outstanding = Math.max(0, termFees - totalPaid);

  const feeAccount = {
    totalBilled: termFees,
    totalPaid,
    outstanding,
  };

  const handleMsg = () => {
    if (!msgForm.subject.trim() || !msgForm.body.trim()) { notify('Fill all fields', 'warning'); return; }
    setMsgModal(false);
    setMsgForm({ subject: '', body: '' });
    notify('Message sent to school administration', 'success', 'Messages');
  };

  const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');

  return (
    <>
      <div className="stat-tiles">
        <KpiCard iconComponent={<BarChart3 size={20} />} label="Overall Average" value={`${overallAvg}%`} accent="#0078D4" />
        <KpiCard iconComponent={<Trophy size={20} />} label="Class Position" value={rank ? `${rank.position} / ${rank.classSize}` : '—'} />
        <KpiCard iconComponent={<Award size={20} />} label="Behavior Score" value="0 pts" accent="#9CA3AF" sub="N/A" />
        <KpiCard iconComponent={<Wallet size={20} />} label="Fee Balance" value={fmtKES(feeAccount.outstanding)} accent={feeAccount.outstanding > 0 ? '#D13438' : '#107C10'}>
          <div style={{ marginTop: 6 }}><ProgressBar value={feeAccount.totalBilled > 0 ? Math.min(100, (feeAccount.totalPaid / feeAccount.totalBilled) * 100) : 0} color="#107C10" /></div>
        </KpiCard>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Quick Actions</h3>
        <div className="grid grid-4" style={{ gap: 10 }}>
          <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => navigate('student/academics')}><BarChart3 size={16} /> View Assessment</button>
          <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => navigate('student/academics')}><ClipboardList size={16} /> View Assignments</button>
          <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => navigate('student/resources')}><Calendar size={16} /> Weekly Timetable</button>
          <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setMsgModal(true)}><Mail size={16} /> Message School</button>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
        <div className="card card-pad">
          <h3 className="section-title">Performance Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="term" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Average %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Recent Notices</h3>
          {(notifications || []).filter(n => (n.audience || []).includes('all') || (n.audience || []).includes('students')).slice(0, 3).map(n => (
            <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{(n.created_at || '').slice(0, 10)} — {n.posted_by}</div>
            </div>
          ))}
          {(notifications || []).length === 0 && <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No recent notices.</div>}
        </div>
      </div>

      {msgModal && (
        <Modal title="Message Administration" onClose={() => setMsgModal(false)} footer={
          <button className="btn btn-primary" onClick={handleMsg}><Mail size={16} style={{ marginRight: 6 }} /> Send Message</button>
        }>
          <div style={{ marginBottom: 12 }}>
            <label className="field-label">Subject</label>
            <input className="input" value={msgForm.subject} onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })} placeholder="e.g. Bus transport inquiry" />
          </div>
          <div>
            <label className="field-label">Message</label>
            <textarea className="input" style={{ height: 120 }} value={msgForm.body} onChange={e => setMsgForm({ ...msgForm, body: e.target.value })} placeholder="Type your message here..." />
          </div>
        </Modal>
      )}
    </>
  );
}
