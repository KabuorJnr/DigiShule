import { useState } from 'react';
import { PageHeader } from '../components/widgets';
import { CLASSES, SUBJECTS, DEPARTMENTS } from '../data/seed';

const ALL_TABS = ['General', 'Academic', 'Fee Structure', 'Grade Boundaries', 'Notifications', 'Calendar'];
const DEPT_LIST = ['Sciences', 'Humanities', 'Languages', 'Math'];

export default function Settings({ store, user }) {
  const { settings, setSettings, feeStructure, setFeeStructure, gradeBoundaries, setGradeBoundaries, notifToggles, setNotifToggles, notify } = store;
  
  const TABS = user?.role === 'finance' ? ['Fee Structure'] : ALL_TABS;
  const [tab, setTab] = useState(TABS[0]);
  const levels = settings.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

  // local copies for editing
  const [Grade, setForm] = useState(settings);
  const [classList, setClassList] = useState(CLASSES.map((c) => ({ name: `Grade ${c}`, capacity: 40 })));
  const [newClass, setNewClass] = useState('');
  const [subjList, setSubjList] = useState(SUBJECTS.map((s) => ({ name: s, dept: DEPARTMENTS[s] })));
  const [newSubj, setNewSubj] = useState('');
  const [newSubjDept, setNewSubjDept] = useState('Sciences');
  const [fees, setFees] = useState(feeStructure);
  const [bounds, setBounds] = useState(gradeBoundaries);

  const upForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  function onLogo(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => upForm({ logo: String(e.target.result) });
    reader.readAsDataURL(file);
  }

  function saveGeneral() {
    setSettings(Grade);
    notify('School details saved', 'success', 'Settings');
  }
  function saveAcademic() {
    setSettings((s) => ({ ...s, currentTerm: Grade.currentTerm, termStart: Grade.termStart, termEnd: Grade.termEnd }));
    notify('Academic settings saved', 'success', 'Settings');
  }
  function saveFees() {
    setFeeStructure(fees);
    notify('Fee structure saved', 'success', 'Settings');
  }
  function saveBounds() {
    setGradeBoundaries(bounds);
    notify('Grade boundaries updated — gradebook recalculated', 'success', 'Settings');
  }

  return (
    <div>
      <PageHeader title="School Settings" subtitle="Configure your institution" />

      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'General' && (
        <div className="card card-pad" style={{ maxWidth: 760 }}>
          <div className="grid grid-2" style={{ marginBottom: 16 }}>
            <div><label className="field-label">School Name</label><input className="input" value={Grade.name} onChange={(e) => upForm({ name: e.target.value })} /></div>
            <div><label className="field-label">Motto</label><input className="input" value={Grade.motto} onChange={(e) => upForm({ motto: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Address</label><input className="input" value={Grade.address} onChange={(e) => upForm({ address: e.target.value })} /></div>
            <div><label className="field-label">Phone</label><input className="input" value={Grade.phone} onChange={(e) => upForm({ phone: e.target.value })} /></div>
            <div><label className="field-label">Email</label><input className="input" value={Grade.email} onChange={(e) => upForm({ email: e.target.value })} /></div>
            <div><label className="field-label">Principal Name</label><input className="input" value={Grade.principal} onChange={(e) => upForm({ principal: e.target.value })} /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">School Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="logo-box" style={{ width: 64, height: 64, background: Grade.logo ? '#fff' : 'var(--accent)' }}>
                {Grade.logo ? <img src={Grade.logo} alt="logo" /> : <span>WS</span>}
              </div>
              <input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files[0])} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveGeneral}>Save Changes</button>
        </div>
      )}

      {tab === 'Academic' && (
        <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad">
            <h3 className="section-title">Current Term</h3>
            <div className="grid grid-3">
              <div><label className="field-label">Current Term</label>
                <select className="select" value={Grade.currentTerm} onChange={(e) => upForm({ currentTerm: e.target.value })}>
                  {['Term 1', 'Term 2', 'Term 3'].map((t) => <option key={t}>{t}</option>)}
                </select></div>
              <div><label className="field-label">Term Start</label><input className="input" type="date" value={Grade.termStart} onChange={(e) => upForm({ termStart: e.target.value })} /></div>
              <div><label className="field-label">Term End</label><input className="input" type="date" value={Grade.termEnd} onChange={(e) => upForm({ termEnd: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveAcademic}>Save Term Dates</button>
          </div>

          <div className="card card-pad">
            <h3 className="section-title">Classes</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Class</th><th>Capacity</th><th></th></tr></thead>
                <tbody>
                  {classList.map((c, i) => (
                    <tr key={i}>
                      <td>{c.name}</td>
                      <td><input className="input" type="number" value={c.capacity} style={{ width: 90, height: 32 }}
                        onChange={(e) => setClassList((cl) => cl.map((x, j) => (j === i ? { ...x, capacity: Number(e.target.value) } : x)))} /></td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => { setClassList((cl) => cl.filter((_, j) => j !== i)); notify('Class removed', 'success', 'Settings'); }}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="input" placeholder="New class name (e.g. Grade 7C)" value={newClass} style={{ maxWidth: 260 }} onChange={(e) => setNewClass(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={!newClass} onClick={() => { setClassList((cl) => [...cl, { name: newClass, capacity: 40 }]); setNewClass(''); notify('Class added', 'success', 'Settings'); }}>+ Add Class</button>
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="section-title">Subjects</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Subject</th><th>Department</th><th></th></tr></thead>
                <tbody>
                  {subjList.map((s, i) => (
                    <tr key={i}>
                      <td>{s.name}</td>
                      <td>
                        <select className="select" value={s.dept} style={{ height: 32, width: 150 }}
                          onChange={(e) => setSubjList((sl) => sl.map((x, j) => (j === i ? { ...x, dept: e.target.value } : x)))}>
                          {DEPT_LIST.map((d) => <option key={d}>{d}</option>)}
                        </select>
                      </td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => { setSubjList((sl) => sl.filter((_, j) => j !== i)); notify('Subject removed', 'success', 'Settings'); }}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="input" placeholder="New subject" value={newSubj} style={{ maxWidth: 200 }} onChange={(e) => setNewSubj(e.target.value)} />
              <select className="select" value={newSubjDept} style={{ width: 150 }} onChange={(e) => setNewSubjDept(e.target.value)}>
                {DEPT_LIST.map((d) => <option key={d}>{d}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!newSubj} onClick={() => { setSubjList((sl) => [...sl, { name: newSubj, dept: newSubjDept }]); setNewSubj(''); notify('Subject added', 'success', 'Settings'); }}>+ Add Subject</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'Fee Structure' && (
        <div className="card card-pad" style={{ maxWidth: 760 }}>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Fee Type</th>{levels.map(l => <th key={l}>{l}</th>)}</tr></thead>
              <tbody>
                {fees.map((f, i) => (
                  <tr key={i}>
                    <td>{f.type}</td>
                    {levels.map((l) => (
                      <td key={l}>
                        <input className="input" type="number" value={f[l] || ''} style={{ width: 110, height: 32 }}
                          onChange={(e) => setFees((fs) => fs.map((x, j) => (j === i ? { ...x, [l]: Number(e.target.value) } : x)))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveFees}>Save Fee Structure</button>
        </div>
      )}

      {tab === 'Grade Boundaries' && (
        <div className="card card-pad" style={{ maxWidth: 480 }}>
          <p className="muted" style={{ marginTop: 0 }}>Set the minimum average % for each grade. Changes propagate to the gradebook.</p>
          <table className="table">
            <thead><tr><th>Grade</th><th>Minimum Score (%)</th></tr></thead>
            <tbody>
              {bounds.map((b, i) => (
                <tr key={b.grade}>
                  <td><strong>{b.grade}</strong></td>
                  <td>
                    <input className="input" type="number" min="0" max="100" value={b.min} style={{ width: 110, height: 32 }}
                      onChange={(e) => setBounds((bs) => bs.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveBounds}>Save Grade Boundaries</button>
        </div>
      )}

      {tab === 'Notifications' && (
        <div className="card card-pad" style={{ maxWidth: 560 }}>
          {[
            ['email', 'Email alerts'],
            ['sms', 'SMS alerts'],
            ['attendance', 'Attendance alerts'],
            ['fees', 'Fee reminders'],
            ['exams', 'Exam reminders'],
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <label className="switch">
                <input type="checkbox" checked={notifToggles[key]}
                  onChange={(e) => { setNotifToggles((t) => ({ ...t, [key]: e.target.checked })); notify(`${label} ${e.target.checked ? 'enabled' : 'disabled'}`, 'info', 'Settings'); }} />
                <span className="slider" />
              </label>
            </div>
          ))}
        </div>
      )}

      {tab === 'Calendar' && (
        <div className="card card-pad" style={{ maxWidth: 660 }}>
          <h3 className="section-title">Google Calendar Integration</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Connect your school's public Google Calendar so it appears embedded in the School Calendar view.
            The calendar must be set to <strong>Public</strong> in Google Calendar settings.
          </p>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
            <strong>How to get the embed URL:</strong><br />
            1. Open Google Calendar → select your calendar → <em>Settings</em><br />
            2. Scroll to <em>"Integrate calendar"</em> → copy the <em>"Embed code"</em> src URL<br />
            3. Paste the URL below (it should start with <code>https://calendar.google.com/calendar/embed?...</code>)
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Google Calendar Embed URL</label>
            <input
              className="input"
              placeholder="https://calendar.google.com/calendar/embed?src=..."
              value={Grade.googleCalendarUrl || ''}
              onChange={e => upForm({ googleCalendarUrl: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Calendar Display Name (optional)</label>
            <input
              className="input"
              placeholder="e.g. Starehe Boys School Calendar"
              value={Grade.googleCalendarName || ''}
              onChange={e => upForm({ googleCalendarName: e.target.value })}
            />
          </div>
          {Grade.googleCalendarUrl && (
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Preview</label>
              <iframe
                src={Grade.googleCalendarUrl}
                style={{ border: 'none', width: '100%', height: 300, borderRadius: 8 }}
                title="Calendar Preview"
              />
            </div>
          )}
          <button className="btn btn-primary" onClick={saveGeneral}>Save Calendar Settings</button>
        </div>
      )}
    </div>
  );
}
