import { useState, useEffect } from 'react';
import { PageHeader } from '../components/widgets';
import { SUBJECTS, DEPARTMENTS, DEFAULT_DEPARTMENTS, getDeptColor } from '../data/seed';
import { CBC_BOUNDARIES, KCSE_BOUNDARIES } from '../utils/grading';

const ALL_TABS = ['General', 'Academic', 'Fee Structure', 'Grade Boundaries', 'Notifications', 'Calendar', 'Payment Gateways', 'AI Assistant'];

export default function Settings({ store, user }) {
  const { settings, setSettings, feeStructure, setFeeStructure, gradeBoundaries, setGradeBoundaries, notifToggles, setNotifToggles, notify } = store;
  
  const TABS = user?.role === 'finance' ? ['Fee Structure'] : ALL_TABS;
  const [tab, setTab] = useState(TABS[0]);
  // local copies for editing
  const [form, setForm] = useState({
    ...settings,
    principal: settings.principal || user?.name || ''
  });
  
  // Payment Gateway State
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [gatewayForm, setGatewayForm] = useState({
    shortcode: '',
    passkey: '',
    consumer_key: '',
    consumer_secret: ''
  });

  const [kcbConfigured, setKcbConfigured] = useState(false);
  const [kcbForm, setKcbForm] = useState({
    client_id: '',
    client_secret: '',
    biller_code: ''
  });

  // AI credentials — same pattern as payment gateways. School stores its
  // own Anthropic key server-side; the raw key is never read back to the UI.
  const [aiStatus, setAiStatus] = useState({ configured: false, provider: null, model_override: null, updated_at: null });
  const [aiForm, setAiForm] = useState({ provider: 'openai', api_key: '', model_override: '' });
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    if (tab !== 'AI Assistant' || !store.schoolId) return;
    import('../lib/supabaseClient').then(({ supabase }) => {
      supabase.rpc('school_ai_status').then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          let model = row.model_override || '';
          let baseUrl = '';
          if (row.provider === 'custom' && model.includes('|')) {
            const parts = model.split('|');
            model = parts[0];
            baseUrl = parts.length > 1 ? parts[1] : '';
          }
          setAiStatus({ configured: !!row.configured, provider: row.provider || 'anthropic', model_override: row.model_override || '', updated_at: row.updated_at });
          setAiForm(f => ({ ...f, provider: row.provider || 'openai', model_override: model, base_url: baseUrl }));
        }
      });
    });
  }, [tab, store.schoolId]);

  useEffect(() => {
    // Check if gateway is configured
    if (tab === 'Payment Gateways' && store.schoolId) {
      import('../lib/supabaseClient').then(({ supabase }) => {
        supabase.from('vw_school_payment_status').select('*').eq('school_id', store.schoolId).single()
          .then(({ data }) => {
            if (data) {
              setGatewayConfigured(data.is_configured);
              setGatewayForm(f => ({ ...f, shortcode: data.mpesa_shortcode || '' }));
              setKcbConfigured(!!data.kcb_biller_code);
              setKcbForm(f => ({ ...f, biller_code: data.kcb_biller_code || '' }));
            }
          });
      });
    }
  }, [tab, store.schoolId]);

  const [classList, setClassList] = useState(settings.classes || []);
  const savedClasses = settings.classes || [];
  const levels = savedClasses.length > 0 ? savedClasses.map(c => c.name) : (settings.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']);
  
  const [newClass, setNewClass] = useState('');
  const defaultSubjects = SUBJECTS.map((s) => ({ name: s, dept: DEPARTMENTS[s] }));
  const [subjList, setSubjList] = useState(settings.subjects?.length > 0 ? settings.subjects : defaultSubjects);
  const [newSubj, setNewSubj] = useState('');
  const [newSubjDept, setNewSubjDept] = useState('Sciences');
  const [deptList, setDeptList] = useState(settings.departments?.length > 0 ? settings.departments : DEFAULT_DEPARTMENTS);
  const [blockDepts, setBlockDepts] = useState(settings.block_departments || []);
  const [newDept, setNewDept] = useState('');
  const [fees, setFees] = useState(feeStructure);
  const [bounds, setBounds] = useState(gradeBoundaries);

  // Sync local state when the global settings/store load asynchronously
  useEffect(() => {
    setFees(store.feeStructure || []);
  }, [store.feeStructure]);

  useEffect(() => {
    setBounds(store.gradeBoundaries || []);
  }, [store.gradeBoundaries]);

  useEffect(() => {
    if (settings.classes?.length > 0) setClassList(settings.classes);
  }, [settings.classes]);

  useEffect(() => {
    if (settings.subjects?.length > 0) setSubjList(settings.subjects);
  }, [settings.subjects]);

  useEffect(() => {
    if (settings.departments?.length > 0) setDeptList(settings.departments);
    if (settings.block_departments) setBlockDepts(settings.block_departments);
  }, [settings.departments, settings.block_departments]);

  useEffect(() => {
    setForm(f => ({ ...f, ...settings, principal: settings.principal || f.principal }));
  }, [settings]);

  const upForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  function onLogo(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => upForm({ logo: String(e.target.result) });
    reader.readAsDataURL(file);
  }

  function saveGeneral() {
    setSettings((s) => ({
      ...s,
      name: form.name,
      motto: form.motto,
      address: form.address,
      phone: form.phone,
      email: form.email,
      principal: form.principal,
      logo: form.logo,
      paymentDetails: form.paymentDetails,
      latitude: form.latitude,
      longitude: form.longitude,
      geofenceRadius: form.geofenceRadius || 50
    }));
    notify('School details saved', 'success', 'Settings');
  }
  function saveAcademic() {
    setSettings((s) => ({ ...s, currentTerm: form.currentTerm, termStart: form.termStart, termEnd: form.termEnd, classes: classList, subjects: subjList, departments: deptList, block_departments: blockDepts }));
    notify('Academic settings saved successfully', 'success', 'Settings');
  }
  function saveFees() {
    setFeeStructure(fees);
    notify('Fee structure saved', 'success', 'Settings');
  }
  function saveBounds() {
    setGradeBoundaries(bounds);
    notify('Grade boundaries updated - gradebook recalculated', 'success', 'Settings');
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
            <div><label className="field-label">School Name</label><input className="input" value={form.name} onChange={(e) => upForm({ name: e.target.value })} /></div>
            <div><label className="field-label">Motto</label><input className="input" value={form.motto} onChange={(e) => upForm({ motto: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Address</label><input className="input" value={form.address} onChange={(e) => upForm({ address: e.target.value })} /></div>
            <div><label className="field-label">Phone</label><input className="input" value={form.phone} onChange={(e) => upForm({ phone: e.target.value })} /></div>
            <div><label className="field-label">Email</label><input className="input" value={form.email} onChange={(e) => upForm({ email: e.target.value })} /></div>
            <div><label className="field-label">Principal Name</label><input className="input" value={form.principal} onChange={(e) => upForm({ principal: e.target.value })} /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">School Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="logo-box" style={{ width: 64, height: 64, background: form.logo ? '#fff' : 'var(--accent)' }}>
                {form.logo ? <img src={form.logo} alt="logo" /> : <span>WS</span>}
              </div>
              <input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files[0])} />
            </div>
          </div>

          {/* School Location & Geofencing */}
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>📍 School Location & Geofencing</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 16 }}>
              Set your school's GPS coordinates. Teachers can only check in/out within the geofence radius.
            </p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: '1 1 160px' }}>
                <label className="field-label">Latitude</label>
                <input className="input" type="number" step="any" placeholder="e.g. -1.2921"
                  value={form.latitude || ''} onChange={(e) => upForm({ latitude: parseFloat(e.target.value) || '' })} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label className="field-label">Longitude</label>
                <input className="input" type="number" step="any" placeholder="e.g. 36.8219"
                  value={form.longitude || ''} onChange={(e) => upForm({ longitude: parseFloat(e.target.value) || '' })} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label className="field-label">Radius (m)</label>
                <input className="input" type="number" min="10" max="500" placeholder="50"
                  value={form.geofenceRadius || ''} onChange={(e) => upForm({ geofenceRadius: parseInt(e.target.value) || '' })} />
              </div>
              <button
                className="btn"
                style={{ background: '#0ea5e9', color: 'white', whiteSpace: 'nowrap', height: 38 }}
                onClick={() => {
                  if (!navigator.geolocation) { notify('Geolocation not supported', 'error'); return; }
                  notify('Detecting location...', 'info');
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      upForm({
                        latitude: Math.round(pos.coords.latitude * 1000000) / 1000000,
                        longitude: Math.round(pos.coords.longitude * 1000000) / 1000000
                      });
                      notify(`Location detected: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, 'success');
                    },
                    (err) => notify('Location detection failed. Allow location access in your browser and try again.', 'error'),
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
              >
                📍 Detect My Location
              </button>
            </div>

            {form.latitude && form.longitude ? (
              <div style={{ padding: 12, background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0', fontSize: 13, marginBottom: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: '#065f46' }}>✓ Location set:</strong>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{form.latitude}, {form.longitude}</span>
                  {' · '}Radius: <strong>{form.geofenceRadius || 50}m</strong>
                </div>
                
                {/* Embedded Map */}
                <div style={{ width: '100%', height: '300px', borderRadius: 8, overflow: 'hidden', border: '1px solid #a7f3d0' }}>
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no" 
                    marginHeight="0" 
                    marginWidth="0" 
                    src={`https://maps.google.com/maps?q=${form.latitude},${form.longitude}&z=16&output=embed`}
                    title="School Location Map"
                  ></iframe>
                </div>
                
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${form.latitude},${form.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn btn-sm"
                    style={{ background: 'white', color: '#065f46', border: '1px solid #065f46', display: 'inline-block' }}>
                    Get Directions â†—
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d', fontSize: 13, marginBottom: 12, color: '#92400e' }}>
                âš  No location set - teachers can check in from anywhere. Click "Detect My Location" while at school to enable geofencing.
              </div>
            )}
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
                <select className="select" value={form.currentTerm} onChange={(e) => upForm({ currentTerm: e.target.value })}>
                  {['Term 1', 'Term 2', 'Term 3'].map((t) => <option key={t}>{t}</option>)}
                </select></div>
              <div><label className="field-label">Term Start</label><input className="input" type="date" value={form.termStart} onChange={(e) => upForm({ termStart: e.target.value })} /></div>
              <div><label className="field-label">Term End</label><input className="input" type="date" value={form.termEnd} onChange={(e) => upForm({ termEnd: e.target.value })} /></div>
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Classes & Forms Management</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Form 1', 'Form 2', 'Form 3', 'Form 4'].map(formName => (
                  <button
                    key={formName}
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: 12, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                    onClick={() => {
                      if (classList.some(c => c.name === formName)) {
                        notify(`${formName} is already in class list`, 'info');
                      } else {
                        setClassList(cl => [...cl, { name: formName, capacity: 40, streams: 'East, West, North, South' }]);
                        notify(`Added ${formName} with standard streams`, 'success', 'Classes');
                      }
                    }}
                  >
                    + {formName}
                  </button>
                ))}
                {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(gradeName => (
                  <button
                    key={gradeName}
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: 12, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                    onClick={() => {
                      if (classList.some(c => c.name === gradeName)) {
                        notify(`${gradeName} is already in class list`, 'info');
                      } else {
                        setClassList(cl => [...cl, { name: gradeName, capacity: 40, streams: 'A, B, C' }]);
                        notify(`Added ${gradeName} with standard streams`, 'success', 'Classes');
                      }
                    }}
                  >
                    + {gradeName}
                  </button>
                ))}
              </div>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Class / Form Name</th><th>Streams (comma separated)</th><th>Capacity</th><th></th></tr></thead>
                <tbody>
                  {classList.map((c, i) => (
                    <tr key={i}>
                      <td><strong>{c.name}</strong></td>
                      <td>
                        <input className="input" placeholder="e.g. East, West, North" value={c.streams || ''} style={{ width: 220, height: 32 }}
                          onChange={(e) => setClassList((cl) => cl.map((x, j) => (j === i ? { ...x, streams: e.target.value } : x)))} />
                      </td>
                      <td><input className="input" type="number" value={c.capacity} style={{ width: 90, height: 32 }}
                        onChange={(e) => setClassList((cl) => cl.map((x, j) => (j === i ? { ...x, capacity: Number(e.target.value) } : x)))} /></td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => { setClassList((cl) => cl.filter((_, j) => j !== i)); notify('Class removed', 'success', 'Settings'); }}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <input className="input" placeholder="Custom Class or Form name (e.g. Form 3, Grade 10)" value={newClass} style={{ maxWidth: 320 }} onChange={(e) => setNewClass(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={!newClass} onClick={() => { setClassList((cl) => [...cl, { name: newClass, capacity: 40, streams: 'A, B' }]); setNewClass(''); notify('Class added', 'success', 'Settings'); }}>+ Add Custom Class/Form</button>
            </div>
          </div>

          {/* Departments Section */}
          <div className="card card-pad">
            <h3 className="section-title">Departments</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {deptList.map((d, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: getDeptColor(d) + '18', color: getDeptColor(d),
                  border: `1.5px solid ${getDeptColor(d)}40`
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: getDeptColor(d) }} />
                  {d}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, fontSize: 11, cursor: 'pointer', fontWeight: 500, color: '#475569' }}>
                    <input type="checkbox" checked={blockDepts.includes(d)} onChange={(e) => {
                      if (e.target.checked) setBlockDepts(b => [...b, d]);
                      else setBlockDepts(b => b.filter(x => x !== d));
                    }} /> Block
                  </label>
                  {!DEFAULT_DEPARTMENTS.includes(d) && (
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, padding: 0, lineHeight: 1, marginLeft: 4 }}
                      title="Remove department"
                      onClick={() => { setDeptList(dl => dl.filter((_, j) => j !== i)); setBlockDepts(b => b.filter(x => x !== d)); notify(`Removed department: ${d}`, 'info', 'Settings'); }}>×</button>
                  )}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="New department name (e.g. Technical)" value={newDept} style={{ maxWidth: 260 }}
                onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newDept.trim()) { setDeptList(dl => [...dl, newDept.trim()]); setNewDept(''); notify(`Department "${newDept.trim()}" added`, 'success', 'Settings'); } }} />
              <button className="btn btn-primary btn-sm" disabled={!newDept.trim() || deptList.includes(newDept.trim())}
                onClick={() => { setDeptList(dl => [...dl, newDept.trim()]); setNewDept(''); notify(`Department "${newDept.trim()}" added`, 'success', 'Settings'); }}>+ Add Department</button>
            </div>
          </div>

          {/* Subjects Section */}
          <div className="card card-pad">
            <h3 className="section-title">Subjects</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Subject</th><th>Department</th><th></th></tr></thead>
                <tbody>
                  {deptList.map(dept => {
                    const deptSubjects = subjList.map((s, i) => ({ ...s, _idx: i })).filter(s => s.dept === dept);
                    if (deptSubjects.length === 0) return null;
                    return [
                      <tr key={`hdr-${dept}`}>
                        <td colSpan={3} style={{ background: getDeptColor(dept) + '12', padding: '6px 12px', fontWeight: 700, fontSize: 13, color: getDeptColor(dept), borderLeft: `3px solid ${getDeptColor(dept)}` }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: getDeptColor(dept), marginRight: 8 }} />
                          {dept} ({deptSubjects.length})
                        </td>
                      </tr>,
                      ...deptSubjects.map(s => (
                        <tr key={s._idx}>
                          <td style={{ paddingLeft: 24 }}>{s.name}</td>
                          <td>
                            <select className="select" value={s.dept} style={{ height: 32, width: 150 }}
                              onChange={(e) => setSubjList((sl) => sl.map((x, j) => (j === s._idx ? { ...x, dept: e.target.value } : x)))}>
                              {deptList.map((d) => <option key={d}>{d}</option>)}
                            </select>
                          </td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => { setSubjList((sl) => sl.filter((_, j) => j !== s._idx)); notify('Subject removed', 'success', 'Settings'); }}>Remove</button></td>
                        </tr>
                      ))
                    ];
                  })}
                  {/* Subjects not in any known department */}
                  {subjList.filter(s => !deptList.includes(s.dept)).length > 0 && (
                    <>
                      <tr><td colSpan={3} style={{ background: '#f1f5f9', padding: '6px 12px', fontWeight: 700, fontSize: 13, color: '#64748b', borderLeft: '3px solid #94a3b8' }}>Uncategorized</td></tr>
                      {subjList.map((s, i) => ({ ...s, _idx: i })).filter(s => !deptList.includes(s.dept)).map(s => (
                        <tr key={s._idx}>
                          <td style={{ paddingLeft: 24 }}>{s.name}</td>
                          <td>
                            <select className="select" value={s.dept || ''} style={{ height: 32, width: 150 }}
                              onChange={(e) => setSubjList((sl) => sl.map((x, j) => (j === s._idx ? { ...x, dept: e.target.value } : x)))}>
                              <option value="">-- Select --</option>
                              {deptList.map((d) => <option key={d}>{d}</option>)}
                            </select>
                          </td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => { setSubjList((sl) => sl.filter((_, j) => j !== s._idx)); notify('Subject removed', 'success', 'Settings'); }}>Remove</button></td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="input" placeholder="New subject (e.g. Computer Science)" value={newSubj} style={{ maxWidth: 200 }} onChange={(e) => setNewSubj(e.target.value)} />
              <select className="select" value={newSubjDept} onChange={(e) => setNewSubjDept(e.target.value)}>
                {deptList.map((d) => <option key={d}>{d}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!newSubj} onClick={() => { setSubjList((sl) => [...sl, { name: newSubj, dept: newSubjDept }]); setNewSubj(''); notify('Subject added', 'success', 'Settings'); }}>+ Add Subject</button>
            </div>
          </div>
          
          <button className="btn btn-primary" onClick={saveAcademic} style={{ alignSelf: 'flex-start' }}>Save Academic Settings</button>
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
                    <td>
                      <input className="input" value={f.type} style={{ width: 150, height: 32 }}
                        onChange={(e) => setFees((fs) => fs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} />
                    </td>
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
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <button className="btn btn-sm" onClick={() => setFees(fs => [...fs, { type: 'New Component' }])}>+ Add Fee Component</button>
            <button className="btn btn-primary" onClick={saveFees}>Save Fee Structure</button>
          </div>
          
          <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Payment Instructions</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>These instructions will appear on all fee structures and parent statements.</p>
            <textarea 
              className="input" 
              style={{ width: '100%', minHeight: 100, padding: 12, fontFamily: 'inherit', lineHeight: 1.5 }}
              value={form.paymentDetails || ''} 
              placeholder="e.g. Bank Deposit: KCB Bank, Account: 1122334455&#10;M-Pesa Paybill: 123456"
              onChange={(e) => upForm({ paymentDetails: e.target.value })}
            />
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={saveGeneral}>Save Payment Instructions</button>
          </div>
        </div>
      )}

      {tab === 'Grade Boundaries' && (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 className="section-title" style={{ margin: 0 }}>Grade Boundaries Settings</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Set the minimum percentage threshold (%) for each performance grade.
              </p>
            </div>
            <button 
              className="btn btn-sm"
              onClick={() => {
                const defaultCbc = CBC_BOUNDARIES.map(b => ({ grade: b.grade, min: b.min }));
                setBounds(defaultCbc);
                notify('Reset boundaries to official CBC defaults.', 'info');
              }}
            >
              Reset Official Defaults
            </button>
          </div>

          {/* System Boundary Selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <button
              className={`btn btn-sm ${bounds.some(b => ['EE1', 'ME1', 'AE1', 'BE1'].includes(b.grade)) ? 'btn-primary' : ''}`}
              onClick={() => {
                setBounds(CBC_BOUNDARIES.map(b => ({ grade: b.grade, min: b.min })));
              }}
            >
              CBC Curriculum Scale (Grade 7 - 12)
            </button>
            <button
              className={`btn btn-sm ${bounds.some(b => ['A', 'B+', 'C+'].includes(b.grade)) ? 'btn-primary' : ''}`}
              onClick={() => {
                setBounds(KCSE_BOUNDARIES.map(b => ({ grade: b.grade, min: b.min })));
              }}
            >
              8-4-4 KCSE Scale (Form 1 - 4)
            </button>
          </div>

          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Grade Code</th>
                <th>Performance Level</th>
                <th style={{ textAlign: 'center' }}>Minimum Score (%)</th>
              </tr>
            </thead>
            <tbody>
              {bounds.map((b, i) => {
                const fullMatch = [...CBC_BOUNDARIES, ...KCSE_BOUNDARIES].find(x => x.grade === b.grade);
                return (
                  <tr key={b.grade}>
                    <td><strong style={{ fontSize: 14 }}>{b.grade}</strong></td>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{fullMatch?.label || b.label || b.grade}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          max="100"
                          value={b.min || 0}
                          style={{ width: 90, height: 32, textAlign: 'center', fontWeight: 600 }}
                          onChange={(e) => setBounds((bs) => bs.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={saveBounds}>Save Grade Boundaries</button>
          </div>
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
              value={form.googleCalendarUrl || ''}
              onChange={e => upForm({ googleCalendarUrl: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Calendar Display Name (optional)</label>
            <input
              className="input"
              placeholder="e.g. Starehe Boys School Calendar"
              value={form.googleCalendarName || ''}
              onChange={e => upForm({ googleCalendarName: e.target.value })}
            />
          </div>
          {form.googleCalendarUrl && (
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Preview</label>
              <iframe
                src={form.googleCalendarUrl}
                style={{ border: 'none', width: '100%', height: 300, borderRadius: 8 }}
                title="Calendar Preview"
              />
            </div>
          )}
          <button className="btn btn-primary" onClick={saveGeneral}>Save Calendar Settings</button>
        </div>
      )}
      {tab === 'Payment Gateways' && (
        <div className="card card-pad" style={{ maxWidth: 600 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>M-Pesa Gateway Settings</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 20 }}>
            Configure your school's M-Pesa Till or Paybill credentials. These are stored securely and never exposed back to the UI.
          </p>

          {gatewayConfigured && (
            <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>M-Pesa API is Configured</div>
                <div style={{ fontSize: 12, color: '#047857' }}>Shortcode: {gatewayForm.shortcode}</div>
              </div>
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
            <div>
              <label className="field-label">Shortcode (Paybill/Till)</label>
              <input className="input" placeholder={gatewayConfigured ? gatewayForm.shortcode : 'e.g. 174379'} value={gatewayForm.shortcode} onChange={(e) => setGatewayForm(f => ({ ...f, shortcode: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Passkey</label>
              <input type="password" className="input" placeholder={gatewayConfigured ? '••••••••••••••••' : 'Enter Passkey'} value={gatewayForm.passkey} onChange={(e) => setGatewayForm(f => ({ ...f, passkey: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Consumer Key</label>
              <input type="password" className="input" placeholder={gatewayConfigured ? '••••••••••••••••' : 'Enter Consumer Key'} value={gatewayForm.consumer_key} onChange={(e) => setGatewayForm(f => ({ ...f, consumer_key: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Consumer Secret</label>
              <input type="password" className="input" placeholder={gatewayConfigured ? '••••••••••••••••' : 'Enter Consumer Secret'} value={gatewayForm.consumer_secret} onChange={(e) => setGatewayForm(f => ({ ...f, consumer_secret: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="btn btn-primary" onClick={async () => {
              if (!gatewayForm.shortcode || !gatewayForm.passkey || !gatewayForm.consumer_key || !gatewayForm.consumer_secret) {
                notify('Please fill in all M-Pesa API fields', 'error');
                return;
              }
              try {
                const { supabase } = await import('../lib/supabaseClient');
                const payload = {
                  school_id: store.schoolId,
                  mpesa_shortcode: gatewayForm.shortcode,
                  mpesa_passkey: gatewayForm.passkey,
                  mpesa_consumer_key: gatewayForm.consumer_key,
                  mpesa_consumer_secret: gatewayForm.consumer_secret,
                  updated_at: new Date().toISOString()
                };
                
                const { error } = await supabase.from('school_payment_gateways').upsert(payload, { onConflict: 'school_id' });
                if (error) throw error;
                
                notify('M-Pesa credentials saved securely.', 'success');
                setGatewayConfigured(true);
                setGatewayForm(f => ({ ...f, passkey: '', consumer_key: '', consumer_secret: '' }));
              } catch (e) {
                notify(`Error saving credentials: ${e.message}`, 'error');
              }
            }}>Save Credentials Securely</button>
          </div>
        </div>
      )}

      {tab === 'Payment Gateways' && (
        <div className="card card-pad" style={{ maxWidth: 600, marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>KCB Bank API Settings</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 20 }}>
            Configure your KCB API credentials for automated bank transfer reconciliation. 
            Parents should use the student's Admission Number as the account reference.
          </p>

          {kcbConfigured && (
            <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>KCB API is Configured</div>
                <div style={{ fontSize: 12, color: '#1d4ed8' }}>Biller Code / Account: {kcbForm.biller_code}</div>
              </div>
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
            <div>
              <label className="field-label">KCB Biller Code / Account Number</label>
              <input className="input" placeholder={kcbConfigured ? kcbForm.biller_code : 'e.g. 54321'} value={kcbForm.biller_code} onChange={(e) => setKcbForm(f => ({ ...f, biller_code: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">KCB API Client ID</label>
              <input type="password" className="input" placeholder={kcbConfigured ? '••••••••••••••••' : 'Enter Client ID'} value={kcbForm.client_id} onChange={(e) => setKcbForm(f => ({ ...f, client_id: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">KCB API Client Secret</label>
              <input type="password" className="input" placeholder={kcbConfigured ? '••••••••••••••••' : 'Enter Client Secret'} value={kcbForm.client_secret} onChange={(e) => setKcbForm(f => ({ ...f, client_secret: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="btn" onClick={async () => {
              if (!kcbForm.biller_code || !kcbForm.client_id || !kcbForm.client_secret) {
                notify('Please fill in all KCB API fields', 'error');
                return;
              }
              try {
                const { supabase } = await import('../lib/supabaseClient');
                const payload = {
                  school_id: store.schoolId,
                  kcb_biller_code: kcbForm.biller_code,
                  kcb_client_id: kcbForm.client_id,
                  kcb_client_secret: kcbForm.client_secret,
                  updated_at: new Date().toISOString()
                };
                
                const { error } = await supabase.from('school_payment_gateways').upsert(payload, { onConflict: 'school_id' });
                if (error) throw error;
                
                notify('KCB API credentials saved securely.', 'success');
                setKcbConfigured(true);
                setKcbForm(f => ({ ...f, client_id: '', client_secret: '' }));
              } catch (e) {
                notify(`Error saving KCB credentials: ${e.message}`, 'error');
              }
            }}>Save KCB Credentials</button>
          </div>
        </div>
      )}

      {tab === 'AI Assistant' && (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>AI Provider Credentials</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 20 }}>
            EduOne's AI features (weekly brief, remarks, defaulter copilot) call your school's own AI provider.
            Paste your Anthropic API key once and every AI card across the app starts working. Same secure model as M-Pesa:
            the key is stored server-side and never read back to the browser.
          </p>

          {aiStatus.configured && (
            <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>AI Assistant is Configured</div>
                <div style={{ fontSize: 12, color: '#047857' }}>
                  Provider: {aiStatus.provider || 'anthropic'}
                  {aiStatus.updated_at && ` · Updated ${new Date(aiStatus.updated_at).toLocaleDateString()}`}
                </div>
              </div>
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
            <div>
              <label className="field-label">Provider</label>
              <select
                className="select"
                value={aiForm.provider}
                onChange={(e) => setAiForm(f => ({ ...f, provider: e.target.value }))}
              >
                <option value="openai">OpenAI (GPT)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="gemini">Google Gemini</option>
                <option value="custom">Custom (Groq, OpenRouter, etc)</option>
              </select>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                OpenAI, Anthropic, and Gemini work natively. Choose "Custom" for OpenAI-compatible APIs like Groq.
              </div>
            </div>

            <div>
              <label className="field-label">API Key</label>
              <input
                type="password"
                className="input"
                placeholder={aiStatus.configured ? '••••••••••  (paste a new key to rotate)' : 'Paste API key here...'}
                value={aiForm.api_key}
                onChange={(e) => setAiForm(f => ({ ...f, api_key: e.target.value }))}
                autoComplete="off"
              />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                Get a key at{' '}
                {aiForm.provider === 'openai' ? (
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>platform.openai.com</a>
                ) : aiForm.provider === 'gemini' ? (
                  <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>aistudio.google.com</a>
                ) : aiForm.provider === 'custom' ? (
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>console.groq.com</a>
                ) : (
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>console.anthropic.com</a>
                )}.
              </div>
            </div>

            {aiForm.provider === 'custom' && (
              <div>
                <label className="field-label">Custom Base URL</label>
                <input
                  className="input"
                  placeholder="https://api.groq.com/openai/v1/chat/completions"
                  value={aiForm.base_url || ''}
                  onChange={(e) => setAiForm(f => ({ ...f, base_url: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                  The full endpoint URL for the chat completions API.
                </div>
              </div>
            )}

            <div>
              <label className="field-label">Model Override (optional)</label>
              <input
                className="input"
                placeholder={aiForm.provider === 'openai' ? 'e.g. gpt-4o' : aiForm.provider === 'gemini' ? 'e.g. gemini-1.5-pro' : aiForm.provider === 'custom' ? 'e.g. llama3-8b-8192' : 'e.g. claude-3-5-sonnet'}
                value={aiForm.model_override || ''}
                onChange={(e) => setAiForm(f => ({ ...f, model_override: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                Advanced. Change only if you want higher-quality output, or if your custom provider requires a specific model name.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              disabled={aiSaving || !aiForm.api_key.trim()}
              onClick={async () => {
                if (!aiForm.api_key.trim()) { notify('Paste an API key first', 'warning'); return; }
                setAiSaving(true);
                try {
                  const { supabase } = await import('../lib/supabaseClient');
                  const payload = {
                    school_id: store.schoolId,
                    provider: aiForm.provider || 'openai',
                    api_key: aiForm.api_key.trim(),
                    model_override: (aiForm.provider === 'custom' && aiForm.base_url) 
                      ? `${aiForm.model_override?.trim() || ''}|${aiForm.base_url.trim()}`
                      : (aiForm.model_override?.trim() || null),
                    updated_at: new Date().toISOString(),
                  };
                  const { error } = await supabase.from('school_ai_credentials').upsert(payload, { onConflict: 'school_id' });
                  if (error) throw error;
                  notify('AI credentials saved securely. AI features are now live.', 'success');
                  setAiStatus({ configured: true, provider: payload.provider, model_override: payload.model_override, updated_at: payload.updated_at });
                  setAiForm({ provider: aiForm.provider, api_key: '', model_override: aiForm.model_override, base_url: aiForm.base_url });
                } catch (e) {
                  notify(`Could not save AI key: ${e.message}`, 'error');
                } finally {
                  setAiSaving(false);
                }
              }}
            >
              {aiSaving ? 'Saving…' : (aiStatus.configured ? 'Update Key' : 'Enable AI Assistant')}
            </button>
            {aiStatus.configured && (
              <button
                className="btn"
                onClick={async () => {
                  if (!window.confirm('Disable the AI assistant? This removes the stored key for your school.')) return;
                  try {
                    const { supabase } = await import('../lib/supabaseClient');
                    const { error } = await supabase.from('school_ai_credentials').delete().eq('school_id', store.schoolId);
                    if (error) throw error;
                    setAiStatus({ configured: false, provider: null, model_override: null, updated_at: null });
                    setAiForm({ api_key: '', model_override: '' });
                    notify('AI assistant disabled for your school.', 'info');
                  } catch (e) { notify(`Error: ${e.message}`, 'error'); }
                }}
              >
                Disable
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



