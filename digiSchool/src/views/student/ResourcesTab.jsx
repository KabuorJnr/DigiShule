import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import { Eye, Download, Loader } from 'lucide-react';
import { openFilePDF, downloadFilePDF } from '../../lib/fileStore';
import SchoolCalendar from '../SchoolCalendar';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'];

export default function ResourcesTab() {
  const { me, store, notify, libraryBooks, libraryLoans, cloudMaterials, cloudAssignments, submissions } = useOutletContext();
  const [resTab, setResTab] = useState('library');
  const [actionId, setActionId] = useState(null);

  const { examSchedules } = store;
  const upcomingExams = (examSchedules || []).filter(e => e.sessions?.some(s => s.status === 'Upcoming'));

  const handleCloudOpen = async (f) => {
    setActionId(f.id + '_o');
    try { await openFilePDF(f.storage_path); }
    catch (e) { notify(`Cannot open: ${e.message}`, 'error'); }
    finally { setActionId(null); }
  };

  const handleCloudDownload = async (f) => {
    setActionId(f.id + '_d');
    try { await downloadFilePDF(f.storage_path, f.name); }
    catch (e) { notify(`Cannot download: ${e.message}`, 'error'); }
    finally { setActionId(null); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {['library', 'materials', 'downloads', 'timetable', 'calendar'].map(t => (
          <button key={t} className={`tab${resTab === t ? ' active' : ''}`} onClick={() => setResTab(t)}>
            {t === 'library' ? 'Library' : t === 'materials' ? 'Study Materials' : t === 'downloads' ? 'Revision Downloads' : t === 'timetable' ? 'Timetable' : 'Calendar'}
          </button>
        ))}
      </div>

      {resTab === 'library' && (
        <>
          {libraryLoans.filter(l => l.student_id === me.id).length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h3 className="section-title">My Borrowed Items</h3>
              <div className="scroll-x">
                <table className="table">
                  <thead><tr><th>Item</th><th>Borrowed On</th><th>Due Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {libraryLoans.filter(l => l.student_id === me.id).map(l => (
                      <tr key={l.id} style={l.status === 'Overdue' ? { background: '#fef2f2' } : {}}>
                        <td style={{ fontWeight: 600 }}>{l.book}</td>
                        <td>{l.borrowed}</td>
                        <td>{l.due}</td>
                        <td><Badge color={l.status === 'Overdue' ? 'red' : 'blue'}>{l.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="card card-pad">
            <h3 className="section-title">Library Catalog</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Title</th><th>Author / Brand</th><th>Category</th><th>Available</th><th>Status</th></tr></thead>
                <tbody>
                  {libraryBooks.length > 0 ? libraryBooks.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.title}</td>
                      <td className="muted">{b.author}</td>
                      <td><Badge color="gray">{b.category}</Badge></td>
                      <td>{b.available} / {b.copies}</td>
                      <td><Badge color={b.available > 0 ? 'green' : 'red'}>{b.available > 0 ? 'Available' : 'Out'}</Badge></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>No books in library catalog.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {resTab === 'materials' && (
        <div className="card card-pad">
          <h3 className="section-title">
            Study Materials ({cloudMaterials.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cloudMaterials.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{m.description || m.name}</span>
                    <Badge color="green">New</Badge>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{m.subject} · {m.uploaded_by} · {m.uploaded_at?.slice(0,10)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 11 }}>PDF · Cloud</span>
                  <button className="btn btn-sm btn-primary" disabled={!!actionId} style={{ gap: 4 }} onClick={() => handleCloudOpen(m)}>
                    {actionId === m.id + '_o' ? <Loader size={13} /> : <Eye size={14} />} View
                  </button>
                </div>
              </div>
            ))}
            {cloudMaterials.length === 0 && <div className="muted">No study materials uploaded.</div>}
          </div>
        </div>
      )}

      {resTab === 'downloads' && (
        <div className="card card-pad">
          <h3 className="section-title">Assignments & Revision Downloads</h3>
          {cloudAssignments.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0078D4', marginBottom: 8, letterSpacing: 0.5 }}>TEACHER UPLOADS - CLOUD</div>
              {cloudAssignments.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{d.description || d.name}</span>
                      <Badge color="green">New</Badge>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{d.subject} · Due: {d.due_date || '-'} · by {d.uploaded_by}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" disabled={!!actionId} style={{ gap: 4 }} onClick={() => handleCloudOpen(d)}>
                      {actionId === d.id + '_o' ? <Loader size={13} /> : <Eye size={13} />} View
                    </button>
                    <button className="btn btn-sm" disabled={!!actionId} style={{ gap: 4 }} onClick={() => handleCloudDownload(d)}>
                      {actionId === d.id + '_d' ? <Loader size={13} /> : <Download size={13} />} Download
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ fontWeight: 600, fontSize: 12, color: '#64748b', margin: '16px 0 8px', letterSpacing: 0.5 }}>PAST PAPERS & REVISION</div>
            </>
          )}
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Title</th><th>Subject</th><th>Year</th><th>Type</th><th>Size</th><th></th></tr></thead>
              <tbody>
                {/* Placeholder */}
                <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No past papers available.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resTab === 'timetable' && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Weekly Class Timetable</h3>
            <Badge color="blue">Grade {me.class}</Badge>
          </div>
          <div className="scroll-x">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Time</th>
                  {WEEK_DAYS.map(day => <th key={day} style={{ textAlign: 'center' }}>{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((time, idx) => (
                  <tr key={time}>
                    <td className="muted" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{time}</td>
                    {WEEK_DAYS.map((day, dayIdx) => {
                      const cell = store.timetables?.[me.class]?.grid?.[idx]?.[dayIdx];
                      const subject = cell?.type === 'lesson' ? cell.subject : cell?.label || (idx === 3 ? 'Break' : idx === 6 ? 'Lunch' : '-');
                      const isBreak = cell?.type === 'break' || subject === 'Break' || subject === 'Lunch';
                      return (
                        <td key={day} style={{ textAlign: 'center', padding: isBreak ? 8 : 12 }}>
                          {isBreak ? (
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '4px', fontSize: 12, color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                              {subject}
                            </div>
                          ) : (
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 8, padding: '8px', fontSize: 13, fontWeight: 500 }}>
                              {subject}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resTab === 'calendar' && (
        <SchoolCalendar store={store} user={me} />
      )}
    </>
  );
}



