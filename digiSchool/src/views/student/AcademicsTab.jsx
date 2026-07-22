import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Badge } from '../../components/widgets';
import { computeRow, gradeFor, is844Class } from '../../utils/grading';
import { SUBJECTS } from '../../data/seed';
import { Send, FileText } from 'lucide-react';
import ReportCardModal from '../../components/ReportCardModal';

export default function AcademicsTab() {
  const { me, rank, store, notify, submissions, cloudAssignments } = useOutletContext();
  const [tab, setTab] = useState('class');
  const [subFilter, setSubFilter] = useState('All');
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const { gradeBoundaries, students } = store;

  const subjects = useMemo(() => {
    if (!me) return [];
    const systemType = is844Class(me.class) ? '844' : 'CBC';
    return SUBJECTS.map(sub => {
      const scores = (me.scores || {})[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const percentage = row.average <= 4 && row.average > 0 ? Math.round(row.average * 25) : row.average;
      const grade = gradeFor(percentage, gradeBoundaries, systemType);
      return { subject: sub, ...row, percentage, grade };
    }).filter(Boolean);
  }, [me, gradeBoundaries]);

  const overallAvg = subjects.length ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1) : 0;

  const classmates = useMemo(() => {
    if (!me || !students) return [];
    return students.filter(s => s.class === me.class).sort((a, b) => a.name.localeCompare(b.name));
  }, [me, students]);

  return (
    <>
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {['class', 'subjects', 'assignments', 'results'].map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'class' ? 'My Class' : t === 'subjects' ? 'My Subjects' : t === 'assignments' ? 'Assignments' : 'Results'}
          </button>
        ))}
      </div>

      {tab === 'class' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Class Information</h3>
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div><span className="muted" style={{ fontSize: 12 }}>Grade / Class</span><div style={{ fontWeight: 600, fontSize: 18 }}>{me.class}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Class Teacher</span><div style={{ fontWeight: 600 }}>{store.teachers?.find(t => t.assignedClass === me.class)?.name || 'Not Assigned'}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Total Students</span><div style={{ fontWeight: 600, fontSize: 18 }}>{classmates.length}</div></div>
            </div>
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Classmates ({classmates.length})</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>#</th><th>Name</th><th>Adm No.</th><th>Gender</th></tr></thead>
                <tbody>
                  {classmates.map((s, i) => (
                    <tr key={s.id} style={s.id === me.id ? { background: '#e8f0fe' } : {}}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: s.id === me.id ? 700 : 400 }}>{s.name} {s.id === me.id && <Badge color="blue">You</Badge>}</td>
                      <td className="muted">{s.adm}</td>
                      <td>{s.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'subjects' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Subject Performance</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjects} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="average" name="Average %" fill="#0078D4" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Subjects & Teachers</h3>
            <table className="table">
              <thead><tr><th>Subject</th><th>Teacher</th><th>CAT 1</th><th>CAT 2</th><th>Midterm</th><th>End-Term</th><th>Avg %</th><th>Grade</th></tr></thead>
              <tbody>
                {subjects.map(r => {
                  const teacher = store.teachers?.find(t => t.subject === r.subject);
                  return (
                    <tr key={r.subject}>
                      <td style={{ fontWeight: 600 }}>{r.subject}</td>
                      <td className="muted">{teacher?.name || '-'}</td>
                      <td>{r.cat1}</td><td>{r.cat2}</td><td>{r.midterm}</td><td>{r.endterm}</td>
                      <td style={{ fontWeight: 700 }}>{r.average}</td>
                      <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'assignments' && (
        <>
          <div className="toolbar">
            <select className="select" style={{ width: 180 }} value={subFilter} onChange={e => setSubFilter(e.target.value)}>
              <option value="All">All Subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cloudAssignments.filter(a => subFilter === 'All' || a.subject === subFilter).map(a => {
              const sub = submissions.find(s => s.assignment_id === a.id);
              const isDue = new Date(a.due_date) < new Date();
              return (
                <div key={a.id} className="card card-pad">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14 }}>{a.title}</h4>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <Badge color="blue">{a.subject}</Badge>
                        <span className="muted" style={{ fontSize: 12 }}>by {a.uploaded_by}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isDue ? '#D13438' : '#107C10' }}>Due: {a.due_date}</div>
                      {sub ? (
                        <Badge color={sub.status === 'Graded' ? 'green' : 'amber'}>{sub.status}</Badge>
                      ) : (
                        <Badge color={isDue ? 'red' : 'gray'}>{isDue ? 'Missing' : 'Pending'}</Badge>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: '10px 0', fontSize: 13, color: '#444', lineHeight: 1.5 }}>{a.description || a.name}</p>
                  
                  {sub ? (
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>Submitted:</strong> {new Date(sub.submitted_at).toLocaleString()}</span>
                        {sub.grade && <span><strong>Grade:</strong> <Badge color="blue">{sub.grade}</Badge></span>}
                      </div>
                      {sub.feedback && <div style={{ marginTop: 8, color: '#475569' }}><strong>Feedback:</strong> {sub.feedback}</div>}
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => notify('Submission upload modal would open here. (Feature coming soon)', 'info')}>
                      <Send size={14} style={{ marginRight: 6 }} /> Mark as Done / Upload
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'results' && (
        <>
          {store.settings?.results_published ? (
            <>
              <div className="card card-pad" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 className="section-title" style={{ margin: 0 }}>Term 2 Results</h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {rank && <span className="muted">Class Position: <strong>{rank.position} / {rank.classSize}</strong></span>}
                    <button className="btn btn-sm btn-primary" onClick={() => setReportModalOpen(true)}>
                      <FileText size={14} style={{ marginRight: 6 }} /> View Report Card
                    </button>
                  </div>
                </div>
                <div className="scroll-x">
                  <table className="table">
                    <thead><tr><th>Subject</th><th>CAT 1 /30</th><th>CAT 2 /30</th><th>Midterm /100</th><th>End-Term /100</th><th>Total</th><th>Avg %</th><th>Grade</th></tr></thead>
                    <tbody>
                      {subjects.map(r => (
                        <tr key={r.subject}>
                          <td style={{ fontWeight: 600 }}>{r.subject}</td>
                          <td>{r.cat1}</td><td>{r.cat2}</td><td>{r.midterm}</td><td>{r.endterm}</td>
                          <td style={{ fontWeight: 700 }}>{r.total}</td>
                          <td style={{ fontWeight: 700 }}>{r.average}</td>
                          <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
                        <td colSpan={6}>Overall Average</td>
                        <td>{overallAvg}%</td>
                        <td><Badge color={Number(overallAvg) >= 70 ? 'green' : Number(overallAvg) >= 50 ? 'amber' : 'red'}>{gradeFor(Number(overallAvg), gradeBoundaries, is844Class(me?.class) ? '844' : 'CBC')}</Badge></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card card-pad">
                <h3 className="section-title">Subject Performance Analysis</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={subjects} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => `${v}%`} />
                    <Bar dataKey="average" fill="#0078D4" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="card card-pad">
              <h3 className="section-title">Term 2 Results</h3>
              <p className="muted">Current term exam results are undergoing review and have not yet been published by the Academic Office.</p>
            </div>
          )}
        </>
      )}

      {reportModalOpen && (
        <ReportCardModal
          student={me}
          students={students || []}
          subjects={SUBJECTS}
          gradeBoundaries={gradeBoundaries}
          examTitle="Term 1 Opening Exam"
          termName="Term 1"
          schoolSettings={store?.settings}
          onClose={() => setReportModalOpen(false)}
        />
      )}
    </>
  );
}



