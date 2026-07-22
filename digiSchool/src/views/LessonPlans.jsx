import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader, Badge } from '../components/widgets';
import { SUBJECTS, expandClassesWithStreams } from '../data/seed';
import { fetchTable, upsertRow } from '../lib/api';
import { Download, Plus, FileText, ArrowLeft, Save } from 'lucide-react';
import { exportLessonPlanPDF } from '../utils/exporters';

const TERMS = ['Term 1 2026', 'Term 2 2026', 'Term 3 2026'];
const CORE_COMPETENCIES = [
  'Communication & Collaboration',
  'Critical Thinking & Problem Solving',
  'Imagination & Creativity',
  'Citizenship',
  'Learning to Learn',
  'Self-efficacy',
  'Digital Literacy'
];

export default function LessonPlans({ store, user, readOnly = false }) {
  const { notify } = store;
  const dynamicClasses = useMemo(() => expandClassesWithStreams(store.settings?.classes || []), [store.settings]);

  const [view, setView] = useState('list'); // 'list' | 'edit'
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({
    class: 'All',
    subject: 'All',
  });

  const [form, setForm] = useState(null);
  const [saveTimeout, setSaveTimeout] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  const loadPlans = useCallback(async () => {
    if (plans.length === 0) setLoading(true);
    try {
      const data = await fetchTable('lesson_plans');
      // If teacher, filter to their own plans (RLS should ideally do this, but just in case)
      let filtered = data;
      if (!readOnly && user?.id) {
        filtered = data.filter(d => d.teacher_id === user.id);
      }
      
      if (filters.class !== 'All') filtered = filtered.filter(p => p.class === filters.class);
      if (filters.subject !== 'All') filtered = filtered.filter(p => p.subject === filters.subject);
      
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPlans(filtered);
    } catch (e) {
      notify(`Failed to load lesson plans: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, notify, readOnly, user?.id]);

  useEffect(() => {
    if (view === 'list') {
      loadPlans();
    }
  }, [view, loadPlans]);

  const handleCreate = () => {
    setForm({
      isDraft: true, // indicates new
      class: dynamicClasses[0] || 'Form 1',
      subject: SUBJECTS[0] || 'Mathematics',
      term: TERMS[0],
      date: new Date().toISOString().split('T')[0],
      time_slot: '08:00 - 08:40',
      strand: '',
      sub_strand: '',
      specific_learning_outcomes: '',
      key_inquiry_questions: '',
      learning_resources: '',
      core_competencies: [],
      values_developed: [],
      pcis: '',
      intro_activities: '',
      development_step1: '',
      development_step2: '',
      development_step3: '',
      extended_activities: '',
      conclusion: '',
      reflection: '',
      status: 'draft'
    });
    setSaveStatus('');
    setView('edit');
  };

  const handleEdit = (plan) => {
    setForm({ ...plan, core_competencies: plan.core_competencies || [], values_developed: plan.values_developed || [] });
    setSaveStatus('');
    setView('edit');
  };

  const fetchSchemeAndPrefill = async () => {
    const weekStr = window.prompt("Enter the Week Number (1-14) to pull from your Scheme of Work:");
    if (!weekStr) return;
    const weekNum = parseInt(weekStr);
    if (isNaN(weekNum)) return notify("Invalid week number", "error");

    try {
      const data = await fetchTable('schemes_of_work');
      const match = data.find(s => 
        s.class === form.class && 
        s.subject === form.subject && 
        s.term === form.term && 
        s.week_number === weekNum &&
        (readOnly || s.teacher_id === user?.id)
      );

      if (match) {
        setForm(prev => ({
          ...prev,
          scheme_of_work_id: match.id,
          strand: match.strand || prev.strand,
          sub_strand: match.sub_strand || prev.sub_strand,
          specific_learning_outcomes: match.specific_learning_outcomes || prev.specific_learning_outcomes,
          key_inquiry_questions: match.key_inquiry_questions || prev.key_inquiry_questions,
          learning_resources: match.learning_resources || prev.learning_resources
        }));
        notify("Prefilled from Scheme of Work", "success");
      } else {
        notify("No Scheme of Work found for that class/subject/term/week", "warning");
      }
    } catch (e) {
      notify("Failed to fetch Scheme of Work", "error");
    }
  };

  const handleFormChange = (field, value) => {
    if (readOnly) return;
    
    setForm(prev => {
      const next = { ...prev, [field]: value };
      
      // trigger debounced save
      if (saveTimeout) clearTimeout(saveTimeout);
      setSaveStatus('Saving...');
      
      const timeout = setTimeout(async () => {
        try {
          const payload = { ...next, teacher_id: user?.id, teacher_name: user?.name };
          if (next.isDraft) delete payload.id;
          const result = await upsertRow('lesson_plans', payload);
          setForm(f => ({ ...f, ...result[0], isDraft: false }));
          setSaveStatus('Saved');
          setTimeout(() => setSaveStatus(''), 2000);
        } catch (e) {
          setSaveStatus('Error saving');
        }
      }, 800);
      setSaveTimeout(timeout);
      
      return next;
    });
  };

  const toggleCompetency = (c) => {
    if (readOnly) return;
    const current = form.core_competencies || [];
    const next = current.includes(c) ? current.filter(x => x !== c) : [...current, c];
    handleFormChange('core_competencies', next);
  };

  const handleExport = (plan) => {
    exportLessonPlanPDF({
      school: store.settings,
      plan: plan,
      filename: `Lesson_Plan_${plan.class}_${plan.date}.pdf`
    });
  };

  if (view === 'edit') {
    return (
      <div className="view-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button className="btn icon-btn" onClick={() => setView('list')}><ArrowLeft size={16} /></button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{readOnly ? 'View Lesson Plan' : 'Edit Lesson Plan'}</h2>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {saveStatus && <span style={{ color: saveStatus === 'Error saving' ? '#f87171' : '#4ade80' }}>{saveStatus}</span>}
              {!saveStatus && !form.isDraft && 'All changes saved automatically'}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {!readOnly && (
            <button className="btn btn-outline" onClick={fetchSchemeAndPrefill}>
              <Download size={16} /> Pull from Scheme of Work
            </button>
          )}
          <button className="btn" onClick={() => handleExport(form)}>
            <Download size={16} /> Export PDF
          </button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>Administrative Details</h3>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Date</label>
                <input type="date" className="input" value={form.date} onChange={e => handleFormChange('date', e.target.value)} disabled={readOnly} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Time Slot</label>
                <input type="text" className="input" value={form.time_slot} onChange={e => handleFormChange('time_slot', e.target.value)} disabled={readOnly} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Class</label>
                <select className="input" value={form.class} onChange={e => handleFormChange('class', e.target.value)} disabled={readOnly}>
                  {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Subject</label>
                <select className="input" value={form.subject} onChange={e => handleFormChange('subject', e.target.value)} disabled={readOnly}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginTop: 8 }}>Curriculum Details</h3>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Strand</label>
              <input type="text" className="input" value={form.strand || ''} onChange={e => handleFormChange('strand', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Sub-Strand</label>
              <input type="text" className="input" value={form.sub_strand || ''} onChange={e => handleFormChange('sub_strand', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Specific Learning Outcomes</label>
              <textarea className="input" style={{ minHeight: 80, resize: 'vertical' }} value={form.specific_learning_outcomes || ''} onChange={e => handleFormChange('specific_learning_outcomes', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Key Inquiry Questions</label>
              <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }} value={form.key_inquiry_questions || ''} onChange={e => handleFormChange('key_inquiry_questions', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Learning Resources</label>
              <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }} value={form.learning_resources || ''} onChange={e => handleFormChange('learning_resources', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Core Competencies</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CORE_COMPETENCIES.map(c => (
                  <button 
                    key={c} 
                    className="badge" 
                    style={{ 
                      background: form.core_competencies?.includes(c) ? '#047857' : 'rgba(255,255,255,0.1)', 
                      cursor: readOnly ? 'default' : 'pointer',
                      border: 'none', color: '#fff'
                    }}
                    onClick={() => toggleCompetency(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>Organisation of Learning</h3>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
              Note: Mainstream PCIs and Values within the development steps below.
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Introduction</label>
              <textarea className="input" style={{ minHeight: 80, resize: 'vertical' }} value={form.intro_activities || ''} onChange={e => handleFormChange('intro_activities', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Development Step 1</label>
              <textarea className="input" style={{ minHeight: 80, resize: 'vertical' }} value={form.development_step1 || ''} onChange={e => handleFormChange('development_step1', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Development Step 2</label>
              <textarea className="input" style={{ minHeight: 80, resize: 'vertical' }} value={form.development_step2 || ''} onChange={e => handleFormChange('development_step2', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Development Step 3</label>
              <textarea className="input" style={{ minHeight: 80, resize: 'vertical' }} value={form.development_step3 || ''} onChange={e => handleFormChange('development_step3', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Extended Activities</label>
              <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }} value={form.extended_activities || ''} onChange={e => handleFormChange('extended_activities', e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Conclusion</label>
              <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }} value={form.conclusion || ''} onChange={e => handleFormChange('conclusion', e.target.value)} disabled={readOnly} />
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginTop: 8 }}>Post-Lesson</h3>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.7 }}>Reflection on the Lesson</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, opacity: 0.7 }}>Status:</label>
                  <select 
                    className="input" 
                    style={{ padding: '2px 8px', fontSize: 11, height: 'auto' }}
                    value={form.status}
                    onChange={e => handleFormChange('status', e.target.value)}
                    disabled={readOnly}
                  >
                    <option value="draft">Draft</option>
                    <option value="taught">Taught</option>
                  </select>
                </div>
              </div>
              <textarea 
                className="input" 
                style={{ minHeight: 80, resize: 'vertical' }} 
                value={form.reflection || ''} 
                onChange={e => handleFormChange('reflection', e.target.value)} 
                placeholder="Filled after the lesson is taught..."
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="view-content">
      <PageHeader 
        title="Lesson Plans" 
        subtitle="Manage your daily CBC lesson plans" 
        actions={!readOnly && <button className="btn" onClick={handleCreate}><Plus size={16}/> New Lesson Plan</button>}
      />

      <div className="card" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Class Filter</label>
          <select className="input" value={filters.class} onChange={e => setFilters(f => ({...f, class: e.target.value}))}>
            <option value="All">All Classes</option>
            {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Subject Filter</label>
          <select className="input" value={filters.subject} onChange={e => setFilters(f => ({...f, subject: e.target.value}))}>
            <option value="All">All Subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>Loading lesson plans...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>No lesson plans found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Strand</th>
                <th>Status</th>
                <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id} onClick={() => handleEdit(p)} style={{ cursor: 'pointer' }}>
                  <td>{p.date}</td>
                  <td><Badge>{p.class}</Badge></td>
                  <td>{p.subject}</td>
                  <td>{p.strand || '-'}</td>
                  <td>
                    <Badge color={p.status === 'taught' ? 'success' : 'warning'}>{p.status}</Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn icon-btn" onClick={(e) => { e.stopPropagation(); handleExport(p); }} title="Export PDF">
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}



