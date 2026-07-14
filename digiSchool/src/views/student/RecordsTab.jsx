import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge, KpiCard, ProgressBar } from '../../components/widgets';
import { Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function RecordsTab() {
  const { attendanceRecords, healthRecords, me } = useOutletContext();
  const [tab, setTab] = useState('attendance');

  const attLog = useMemo(() => {
    return attendanceRecords.map(a => {
      const d = new Date(a.date);
      const day = d.toLocaleDateString('en-US', { weekday: 'long' });
      return { ...a, day };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendanceRecords]);

  const attTotals = useMemo(() => ({
    total: attLog.length,
    present: attLog.filter(a => a.status === 'Present').length,
    absent: attLog.filter(a => a.status === 'Absent').length,
    late: attLog.filter(a => a.status === 'Late').length,
  }), [attLog]);
  const attPct = attTotals.total ? ((attTotals.present + attTotals.late) / attTotals.total * 100).toFixed(1) : 0;

  return (
    <>
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {['attendance', 'health'].map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'attendance' ? 'Attendance' : 'Health & Clinic'}
          </button>
        ))}
      </div>

      {tab === 'attendance' && (
        <>
          <div className="stat-tiles">
            <KpiCard iconComponent={<Calendar size={20} />} label="Total Days" value={attTotals.total} />
            <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Present" value={attTotals.present} accent="#107C10" />
            <KpiCard iconComponent={<Clock size={20} />} label="Late" value={attTotals.late} accent="#FFB900" />
            <KpiCard iconComponent={<XCircle size={20} />} label="Absent" value={attTotals.absent} accent="#D13438" />
          </div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Attendance Rate</h3>
              <span style={{ fontSize: 24, fontWeight: 700, color: attPct >= 90 ? '#107C10' : attPct >= 75 ? '#FFB900' : '#D13438' }}>{attPct}%</span>
            </div>
            <ProgressBar value={Number(attPct)} color={attPct >= 90 ? '#107C10' : attPct >= 75 ? '#FFB900' : '#D13438'} />
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Daily Attendance Log</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Date</th><th>Day</th><th>Status</th></tr></thead>
                <tbody>
                  {attLog.slice().reverse().map(a => (
                    <tr key={a.id}>
                      <td className="muted">{a.date}</td>
                      <td>{a.day}</td>
                      <td><Badge color={a.status === 'Present' ? 'green' : a.status === 'Late' ? 'amber' : 'red'}>{a.status}</Badge></td>
                    </tr>
                  ))}
                  {attLog.length === 0 && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>No attendance records found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'health' && (
        <div className="card card-pad fade-in">
          <h3 className="section-title">Health & Clinic Records</h3>
          
          {me?.medicalInfo && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>Medical Information / Known Conditions</div>
              <div style={{ color: '#7f1d1d', whiteSpace: 'pre-wrap', fontSize: 14 }}>{me.medicalInfo}</div>
            </div>
          )}

          {healthRecords.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, background: '#e0e7ff', color: '#4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: '0 0 8px' }}>No Medical Records Found</h4>
              <p className="muted" style={{ maxWidth: 300, margin: '0 auto' }}>You have no clinic visits or health incidents recorded on file.</p>
            </div>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Date</th><th>Complaint</th><th>Treatment</th><th>Notes</th></tr></thead>
                <tbody>
                  {healthRecords.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.date}</td>
                      <td>{v.complaint}</td>
                      <td>{v.treatment}</td>
                      <td className="muted">{v.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
