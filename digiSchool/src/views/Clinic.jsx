import { useState, useMemo, useEffect, useRef } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { fetchTable, upsertRow } from '../lib/api';
import { Icon } from '../components/icons';
import PrintHeader from '../components/PrintHeader';

const OUTCOME_COLOR = { 'Returned to class': 'green', 'Sent home': 'amber', 'Referred to hospital': 'red' };
const COMMON_COMPLAINTS = [
  'Headache', 'Stomach ache', 'Fever / High temp', 'Nausea / Vomiting',
  'Cut / Wound', 'Asthma / Cough', 'Allergic reaction', 'Dizziness', 'Sprain / Injury'
];
const COMMON_TREATMENTS = [
  'Paracetamol given', 'Rested in clinic', 'Oral rehydration (ORS)',
  'Wound cleaned & dressed', 'Cold compress applied', 'Antacid given', 'Prescribed rest'
];

export default function Clinic({ store, user, params }) {
  const { notify, students: storeStudents } = store;
  const students = storeStudents || [];
  const [visits, setVisits] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  
  // Tab state: default to 'log' so nurses immediately see the Log Visit interface
  const initialTab = params?.tab || (params?.action === 'log_visit' ? 'log' : 'log');
  const [activeTab, setActiveTab] = useState(initialTab);

  const [form, setForm] = useState({
    student: '',
    adm: '',
    student_id: null,
    medicalInfo: '',
    complaint: '',
    treatment: '',
    outcome: 'Returned to class',
    manual: false,
    notifyParent: false,
  });

  const [saving, setSaving] = useState(false);
  const [notifyParentOpen, setNotifyParentOpen] = useState(null);
  const [parentMsg, setParentMsg] = useState('');
  const [pickerQuery, setPickerQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchTable('clinicVisits')
      .then((rows) => { if (active) setVisits(rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))); })
      .catch((e) => notify(`Failed to load clinic visits: ${e.message}`, 'error'));
      
    return () => { active = false; };
  }, [notify]);

  // Sync active tab with incoming params from sidebar navigation or router
  useEffect(() => {
    if (params?.tab) {
      setActiveTab(params.tab);
    } else if (params?.action === 'log_visit' || params?.openLog) {
      setActiveTab('log');
    }
  }, [params?.tab, params?.action, params?.openLog]);

  useEffect(() => {
    if (students.length > 0 && !selectedClass) {
      const classes = [...new Set(students.map(s => s.class || 'Unassigned'))].sort();
      if (classes.length > 0) setSelectedClass(classes[0]);
    }
  }, [students, selectedClass]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const totals = useMemo(() => ({
    total: visits.length,
    today: visits.filter((v) => String(v.date || '').slice(0, 10) === todayStr).length,
    referred: visits.filter((v) => v.outcome === 'Referred to hospital').length,
  }), [visits, todayStr]);

  const todayVisits = useMemo(() => {
    return visits.filter((v) => String(v.date || '').slice(0, 10) === todayStr);
  }, [visits, todayStr]);

  const groupedStudents = useMemo(() => {
    const groups = {};
    students.forEach(s => {
      const c = s.class || 'Unassigned';
      if (!groups[c]) groups[c] = [];
      groups[c].push(s);
    });
    return groups;
  }, [students]);

  const displayedStudents = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return students.filter(s => s.name?.toLowerCase().includes(q) || s.adm?.toLowerCase().includes(q));
    }
    return groupedStudents[selectedClass] || [];
  }, [students, groupedStudents, selectedClass, searchQuery]);

  // Matching students for the visit logger picker
  const pickerStudents = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((s) => s.name?.toLowerCase().includes(q) || String(s.adm || '').toLowerCase().includes(q) || s.class?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [students, pickerQuery]);

  const selectStudentForVisit = (st) => {
    setForm((f) => ({
      ...f,
      student: st.name,
      adm: st.adm || '-',
      student_id: st.id || null,
      medicalInfo: st.medicalInfo || '',
      manual: false,
    }));
    setPickerQuery('');
  };

  const clearPickedStudent = () => {
    setForm((f) => ({
      ...f,
      student: '',
      adm: '',
      student_id: null,
      medicalInfo: '',
      manual: false,
    }));
    setPickerQuery('');
  };

  const openLogForStudent = (st) => {
    selectStudentForVisit(st);
    setActiveTab('log');
    store.navigate?.('clinic', { tab: 'log' });
  };

  const openBlankLog = () => {
    clearPickedStudent();
    setActiveTab('log');
    store.navigate?.('clinic', { tab: 'log' });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    store.navigate?.('clinic', { tab: tabKey });
  };

  const logVisit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.student || !form.complaint.trim()) {
      notify('Student name and complaint are required.', 'error');
      return;
    }

    setSaving(true);
    const newId = (globalThis.crypto?.randomUUID?.() || `c${Date.now()}${Math.random().toString(16).slice(2)}`);
    const visit = {
      id: newId,
      date: todayStr,
      student: form.student.trim(),
      student_id: form.student_id || null,
      adm: form.adm || '-',
      complaint: form.complaint.trim(),
      treatment: form.treatment.trim(),
      outcome: form.outcome,
      created_at: new Date().toISOString(),
    };

    try {
      await upsertRow('clinicVisits', visit);

      // Auto notify parent if requested
      if (form.notifyParent) {
        const payload = {
          id: `msg_${Date.now()}`,
          sender_role: 'nurse',
          sender_name: 'School Clinic',
          recipient_role: 'parent',
          student_id: form.student_id || form.adm,
          subject: `Clinic Visit Notice: ${form.student}`,
          body: `Dear Parent,\nYour child ${form.student} visited the school clinic today for: ${form.complaint}.\nTreatment administered: ${form.treatment || 'Observation & Rest'}.\nOutcome: ${form.outcome}.\nPlease follow up if necessary.`,
          status: 'Unread',
          created_at: new Date().toISOString(),
        };
        await upsertRow('messages', payload).catch(() => {});
        notify('Visit saved and parent notification sent.');
      } else {
        notify(`Clinic visit logged for ${form.student}.`);
      }

      setVisits((vs) => [visit, ...vs]);
      setLogOpen(false);
      // Reset form
      setForm({
        student: '',
        adm: '',
        student_id: null,
        medicalInfo: '',
        complaint: '',
        treatment: '',
        outcome: 'Returned to class',
        manual: false,
        notifyParent: false,
      });
      setPickerQuery('');
    } catch (err) {
      notify(`Could not log visit: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendParentNotice = async () => {
    if (!parentMsg || !notifyParentOpen) return;
    try {
      const payload = {
        id: `msg_${Date.now()}`,
        sender_role: 'nurse',
        sender_name: 'School Clinic',
        recipient_role: 'parent',
        student_id: notifyParentOpen.student_id || notifyParentOpen.adm,
        subject: `Clinic Update: ${notifyParentOpen.student}`,
        body: parentMsg,
        status: 'Unread',
        created_at: new Date().toISOString(),
      };
      await upsertRow('messages', payload);
      notify('Message sent to parent successfully.');
      setNotifyParentOpen(null);
      setParentMsg('');
    } catch (e) {
      notify(`Failed to send message: ${e.message}`, 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-friendly">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          .print-friendly, .print-friendly * { visibility: visible; }
          .print-friendly { position: absolute; left: 0; top: 0; width: 100%; padding: 2cm !important; box-sizing: border-box; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .sidebar, .topbar { display: none !important; }
          .layout { display: block !important; padding: 0 !important; }
          .main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
        .clinic-chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
          cursor: pointer;
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
          transition: all 0.15s ease;
          user-select: none;
        }
        .clinic-chip:hover {
          background: #e2e8f0;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .clinic-chip.active {
          background: #047857;
          color: #ffffff;
          border-color: #047857;
          font-weight: 600;
        }
      `}} />

      <div className="no-print">
        <PageHeader
          title="Clinic & Health"
          subtitle="Student visits, medical records and first-aid logs"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={openBlankLog}>
                <Icon name="plus" size={16} /> Log Visit
              </button>
              <button className="btn" onClick={handlePrint}>
                <Icon name="clipboard" size={16} /> Print Report
              </button>
            </div>
          }
        />

        <div className="stat-tiles">
          <KpiCard iconComponent={<Icon name="clinic" size={24} />} label="Total Visits" value={totals.total} />
          <KpiCard iconComponent={<Icon name="calendar" size={24} />} label="Today" value={totals.today} accent="#0369A1" />
          <KpiCard iconComponent={<Icon name="warning" size={24} />} label="Referrals" value={totals.referred} accent="#EF4444" sub="To hospital" />
          <KpiCard iconComponent={<Icon name="check" size={24} />} label="Supplies Status" value="Adequate" accent="#047857" />
        </div>

        {/* Primary Navigation Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
          <button
            className={`tab ${activeTab === 'log' ? 'active' : ''}`}
            onClick={() => handleTabChange('log')}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <Icon name="plus" size={16} style={{ marginRight: 6 }} /> Log Visit
          </button>
          <button
            className={`tab ${activeTab === 'visits' ? 'active' : ''}`}
            onClick={() => handleTabChange('visits')}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <Icon name="activity" size={16} style={{ marginRight: 6 }} /> Recent Visits ({visits.length})
          </button>
          <button
            className={`tab ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => handleTabChange('directory')}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <Icon name="users" size={16} style={{ marginRight: 6 }} /> Student Directory
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only" style={{ marginBottom: 24 }}>
        <PrintHeader settings={store.settings} />
        <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#000', textTransform: 'uppercase' }}>Clinic & Health Report</h2>
          <div style={{ fontSize: 13, marginTop: 4 }}>Generated on {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* TAB 1: LOG VISIT TAB */}
      {activeTab === 'log' && (
        <div className="grid no-print" style={{ gridTemplateColumns: 'minmax(420px, 1.4fr) minmax(320px, 1fr)', gap: 24, alignItems: 'start' }}>
          {/* Main Log Visit Form */}
          <div className="card card-pad fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="plus" size={18} /> Record Student Clinic Visit
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Select or search a student, enter symptoms &amp; treatment administered.
                </p>
              </div>
              {form.student && (
                <button className="btn btn-sm" onClick={clearPickedStudent}>
                  Clear Selection
                </button>
              )}
            </div>

            <form onSubmit={logVisit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Student Picker Section */}
              <div>
                <label className="field-label" style={{ fontWeight: 600 }}>1. Student</label>

                {form.student && !form.manual ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    padding: '10px 14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 16, background: '#16a34a',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700
                      }}>
                        {form.student[0]}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#14532d', fontSize: 14 }}>{form.student}</div>
                        <div style={{ fontSize: 12, color: '#166534' }}>
                          Adm: {form.adm || '—'} {form.student_id ? '· In Directory' : ''}
                        </div>
                      </div>
                    </div>
                    <button type="button" className="btn btn-sm" onClick={clearPickedStudent}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    {!form.manual ? (
                      <div>
                        <div style={{ position: 'relative' }}>
                          <Icon name="search" size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input
                            ref={searchInputRef}
                            className="input"
                            placeholder={`Search ${students.length} students by name or admission no...`}
                            value={pickerQuery}
                            onChange={(e) => setPickerQuery(e.target.value)}
                            style={{ paddingLeft: 36, width: '100%', margin: 0 }}
                            autoFocus
                          />
                        </div>

                        {/* Search Matches List */}
                        {pickerStudents.length > 0 && (
                          <div style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            marginTop: 6,
                            maxHeight: 220,
                            overflowY: 'auto',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                            background: '#fff'
                          }}>
                            {pickerStudents.map((s) => (
                              <div
                                key={s.id}
                                onClick={() => selectStudentForVisit(s)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderBottom: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div>
                                  <strong style={{ fontSize: 13, color: '#0f172a' }}>{s.name}</strong>
                                  <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                                    {s.adm || '—'} · {s.class || 'Unassigned'}
                                  </span>
                                  {s.medicalInfo && (
                                    <span style={{ fontSize: 11, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                                      ⚠ {s.medicalInfo}
                                    </span>
                                  )}
                                </div>
                                <button type="button" className="btn btn-sm btn-primary" style={{ padding: '3px 8px', fontSize: 12 }}>
                                  Select
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                          Can't find the student?{' '}
                          <button
                            type="button"
                            className="btn-link"
                            style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            onClick={() => setForm((f) => ({ ...f, manual: true, student: pickerQuery }))}
                          >
                            Enter student or visitor manually
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Manual Student / Visitor Entry</span>
                          <button
                            type="button"
                            className="btn-link"
                            style={{ fontSize: 12, color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => setForm((f) => ({ ...f, manual: false }))}
                          >
                            Back to Student Search
                          </button>
                        </div>
                        <div className="grid grid-2" style={{ gap: 12 }}>
                          <div>
                            <label className="field-label" style={{ fontSize: 12 }}>Student Name *</label>
                            <input
                              className="input"
                              placeholder="Full name"
                              value={form.student}
                              onChange={(e) => setForm((f) => ({ ...f, student: e.target.value }))}
                              style={{ margin: 0, width: '100%' }}
                            />
                          </div>
                          <div>
                            <label className="field-label" style={{ fontSize: 12 }}>Admission No. (optional)</label>
                            <input
                              className="input"
                              placeholder="e.g. ADM-102"
                              value={form.adm}
                              onChange={(e) => setForm((f) => ({ ...f, adm: e.target.value }))}
                              style={{ margin: 0, width: '100%' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Medical Information Alert */}
              {form.medicalInfo && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#991b1b', fontWeight: 600, fontSize: 13, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="warning" size={15} /> Known Medical Conditions / Allergies
                  </div>
                  <div style={{ color: '#7f1d1d', fontSize: 13 }}>{form.medicalInfo}</div>
                </div>
              )}

              {/* Complaint / Symptoms */}
              <div>
                <label className="field-label" style={{ fontWeight: 600 }}>
                  2. Complaint / Symptoms *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Severe headache, dizziness and high temperature"
                  value={form.complaint}
                  onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COMMON_COMPLAINTS.map((c) => (
                    <span
                      key={c}
                      className={`clinic-chip ${form.complaint.includes(c) ? 'active' : ''}`}
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          complaint: f.complaint ? `${f.complaint}, ${c}` : c,
                        }));
                      }}
                    >
                      + {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Treatment Given */}
              <div>
                <label className="field-label" style={{ fontWeight: 600 }}>
                  3. Treatment / Action Taken
                </label>
                <input
                  className="input"
                  placeholder="e.g. Paracetamol 500mg given, allowed to rest for 30 minutes"
                  value={form.treatment}
                  onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COMMON_TREATMENTS.map((t) => (
                    <span
                      key={t}
                      className={`clinic-chip ${form.treatment.includes(t) ? 'active' : ''}`}
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          treatment: f.treatment ? `${f.treatment}; ${t}` : t,
                        }));
                      }}
                    >
                      + {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Outcome */}
              <div>
                <label className="field-label" style={{ fontWeight: 600 }}>
                  4. Patient Outcome
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {['Returned to class', 'Sent home', 'Referred to hospital'].map((o) => {
                    const isSelected = form.outcome === o;
                    const borderColor = o === 'Returned to class' ? '#16a34a' : o === 'Sent home' ? '#d97706' : '#dc2626';
                    const bgColor = o === 'Returned to class' ? '#f0fdf4' : o === 'Sent home' ? '#fffbeb' : '#fef2f2';
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, outcome: o }))}
                        className="btn"
                        style={{
                          flex: 1,
                          minWidth: 120,
                          borderRadius: 8,
                          fontWeight: isSelected ? 700 : 500,
                          border: `2px solid ${isSelected ? borderColor : '#e2e8f0'}`,
                          background: isSelected ? bgColor : '#fff',
                          color: isSelected ? borderColor : '#475569',
                        }}
                      >
                        {isSelected && '✓ '} {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notify Parent Checkbox */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={form.notifyParent}
                    onChange={(e) => setForm((f) => ({ ...f, notifyParent: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#047857' }}
                  />
                  <span>Send immediate notification message to parent / guardian upon saving</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !form.student || !form.complaint.trim()}
                  style={{ flex: 1, height: 44, fontWeight: 700, fontSize: 14 }}
                >
                  {saving ? 'Saving Visit…' : '✓ Save Clinic Visit'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={clearPickedStudent}
                  style={{ height: 44 }}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Right Side: Today's Visits Sidebar Card */}
          <div className="card card-pad fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="calendar" size={16} /> Today's Clinic Log
              </h3>
              <span className="badge badge-green" style={{ fontWeight: 700 }}>
                {todayVisits.length} {todayVisits.length === 1 ? 'visit' : 'visits'}
              </span>
            </div>

            {todayVisits.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '36px 16px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px dashed #cbd5e1',
                color: 'var(--muted)',
                fontSize: 13
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏥</div>
                <strong>No clinic visits recorded yet today.</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Record a visit using the form on the left. Saved visits will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto' }}>
                {todayVisits.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div>
                        <strong style={{ fontSize: 13, color: '#0f172a' }}>{v.student}</strong>
                        <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
                          {v.adm && v.adm !== '-' ? `(${v.adm})` : ''}
                        </span>
                      </div>
                      <Badge color={OUTCOME_COLOR[v.outcome] || 'gray'}>{v.outcome}</Badge>
                    </div>

                    <div style={{ fontSize: 12, color: '#334155', marginBottom: 4 }}>
                      <strong>Complaint:</strong> {v.complaint}
                    </div>

                    {v.treatment && (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                        <strong>Action:</strong> {v.treatment}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {v.created_at ? new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </span>
                      <button
                        className="btn btn-sm"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => {
                          setNotifyParentOpen(v);
                          setParentMsg(`Dear Parent,\nYour child ${v.student} visited the clinic today for ${v.complaint}. Outcome: ${v.outcome}.\nPlease follow up if necessary.`);
                        }}
                      >
                        Notify Parent
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RECENT VISITS */}
      {activeTab === 'visits' && (
        <div className="card card-pad fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Recent Visit Logs</h3>
            <button className="btn btn-primary" onClick={openBlankLog}>
              <Icon name="plus" size={16} /> Log New Visit
            </button>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Student</th><th>Adm. No.</th><th>Complaint</th><th>Treatment</th><th>Outcome</th><th className="no-print">Action</th></tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td>{v.date}</td>
                    <td style={{ fontWeight: 600 }}>{v.student}</td>
                    <td className="muted">{v.adm}</td>
                    <td>{v.complaint}</td>
                    <td>{v.treatment}</td>
                    <td><Badge color={OUTCOME_COLOR[v.outcome] || 'gray'}>{v.outcome}</Badge></td>
                    <td className="no-print">
                      <button className="btn btn-sm" onClick={() => {
                        setNotifyParentOpen(v);
                        setParentMsg(`Dear Parent,\nYour child ${v.student} visited the clinic today for ${v.complaint}. Outcome: ${v.outcome}.\nPlease follow up if necessary.`);
                      }}>Notify Parent</button>
                    </td>
                  </tr>
                ))}
                {visits.length === 0 && (
                  <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>No clinic visits logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="grid no-print" style={{ gridTemplateColumns: '220px 1fr', gap: 20 }}>
          <div className="card" style={{ padding: '8px 0', height: 'fit-content' }}>
            <h3 style={{ margin: '8px 16px', fontSize: 14, color: '#64748b' }}>Select Class</h3>
            {Object.keys(groupedStudents).sort().map(cls => (
              <button 
                key={cls} 
                className="btn" 
                style={{ 
                  display: 'flex', width: '100%', justifyContent: 'space-between', 
                  borderRadius: 0, border: 'none', 
                  background: selectedClass === cls ? '#e0f2fe' : 'transparent',
                  color: selectedClass === cls ? '#0369a1' : 'inherit'
                }}
                onClick={() => setSelectedClass(cls)}
              >
                <span>{cls}</span>
                <span className="muted" style={{ fontSize: 12 }}>{groupedStudents[cls].length}</span>
              </button>
            ))}
          </div>

          <div className="card card-pad fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                {searchQuery.trim() ? 'Search Results' : `${selectedClass} - Medical Directory`}
              </h3>
              <div style={{ position: 'relative', width: 250 }}>
                <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input 
                  className="input" 
                  placeholder="Search all students..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 32, margin: 0, width: '100%' }}
                />
              </div>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Admission No.</th>
                    <th>Medical Information / Conditions</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.map(st => (
                    <tr key={st.id} style={{ cursor: 'pointer' }} onClick={() => openLogForStudent(st)} className="hoverable-row">
                      <td style={{ fontWeight: 600 }}>{st.name}</td>
                      <td className="muted">{st.adm}</td>
                      <td>
                        {st.medicalInfo ? (
                          <div style={{ color: '#991b1b', fontSize: 13, background: '#fef2f2', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>
                            {st.medicalInfo}
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: 13 }}>None provided</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLogForStudent(st);
                          }}
                        >
                          + Log Visit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayedStudents.length === 0 && (
                    <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      {searchQuery.trim() ? 'No students match your search.' : 'No students in this class.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Log Visit Modal (if triggered via openBlankLog or legacy) */}
      {logOpen && (
        <Modal title="Log Clinic Visit" onClose={() => setLogOpen(false)} footer={
          <><button className="btn" onClick={() => setLogOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={logVisit}>Save Visit</button></>
        }>
          {form.medicalInfo ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ color: '#991b1b', fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                <Icon name="warning" size={14} style={{ marginRight: 6 }} /> Known Medical Conditions / Allergies
              </div>
              <div style={{ color: '#7f1d1d', fontSize: 14 }}>{form.medicalInfo}</div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>No medical conditions recorded for this student.</div>
            </div>
          )}

          <div className="grid grid-2">
            <div>
              <label className="field-label">Student Name</label>
              <input
                className="input"
                value={form.student}
                placeholder="Student name"
                onChange={(e) => setForm((f) => ({ ...f, student: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Admission No.</label>
              <input
                className="input"
                value={form.adm}
                placeholder="Admission No."
                onChange={(e) => setForm((f) => ({ ...f, adm: e.target.value }))}
              />
            </div>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Complaint / Symptoms</label>
          <input className="input" value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} autoFocus />
          <label className="field-label" style={{ marginTop: 12 }}>Treatment / Action Taken</label>
          <input className="input" value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))} />
          <label className="field-label" style={{ marginTop: 12 }}>Outcome</label>
          <select className="select" value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}>
            <option>Returned to class</option><option>Sent home</option><option>Referred to hospital</option>
          </select>
        </Modal>
      )}

      {/* Notify Parent Modal */}
      {notifyParentOpen && (
        <Modal title={`Message Parent of ${notifyParentOpen.student}`} onClose={() => setNotifyParentOpen(null)} footer={
          <><button className="btn" onClick={() => setNotifyParentOpen(null)}>Cancel</button><button className="btn btn-primary" onClick={sendParentNotice}>Send Message</button></>
        }>
          <label className="field-label">Message Content</label>
          <textarea 
            className="input" 
            rows={5} 
            value={parentMsg} 
            onChange={(e) => setParentMsg(e.target.value)} 
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>This message will appear in the Parent Portal immediately.</div>
        </Modal>
      )}
    </div>
  );
}
