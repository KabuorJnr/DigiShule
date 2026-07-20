import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader, Badge } from '../components/widgets';
import { SUBJECTS, expandClassesWithStreams } from '../data/seed';
import { fetchTable, upsertRow } from '../lib/api';
import { Download, Plus, Save } from 'lucide-react';
import { exportSchemeOfWorkPDF } from '../utils/exporters';

const TERMS = ['Term 1 2026', 'Term 2 2026', 'Term 3 2026'];

export default function SchemeOfWork({ store, user, readOnly = false }) {
  const { notify } = store;
  const dynamicClasses = useMemo(() => expandClassesWithStreams(store.settings?.classes || []), [store.settings]);

  const [filters, setFilters] = useState({
    class: dynamicClasses[0] || 'Form 1',
    subject: SUBJECTS[0] || 'Mathematics',
    term: TERMS[0],
    teacher_id: user?.id || '' // Used for HOD filtering maybe, but defaults to current
  });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState({});

  const loadSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTable('schemes_of_work');
      // If HOD is viewing, they could see all. For now we filter based on selection.
      let filtered = data.filter(r => 
        r.class === filters.class &&
        r.subject === filters.subject &&
        r.term === filters.term
      );
      
      if (!readOnly && user?.id) {
        filtered = filtered.filter(r => r.teacher_id === user.id);
      }
      // Sort by week
      filtered.sort((a, b) => a.week_number - b.week_number);
      if (filtered.length === 0 && !readOnly) {
        // Pre-fill 14 weeks if empty
        filtered = Array.from({ length: 14 }).map((_, i) => ({
          id: `draft_${Date.now()}_${i}`,
          isDraft: true, // indicates not saved to DB yet
          week_number: i + 1,
          strand: '',
          sub_strand: '',
          specific_learning_outcomes: '',
          key_inquiry_questions: '',
          learning_resources: '',
          assessment_method: '',
          remarks: ''
        }));
      }
      setRows(filtered);
    } catch (e) {
      notify(`Failed to load schemes: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, notify, readOnly]);

  useEffect(() => { loadSchemes(); }, [loadSchemes]);

  // Autosave function (debounced)
  const [saveTimeouts, setSaveTimeouts] = useState({});

  const handleChange = (id, field, value) => {
    if (readOnly) return;
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

    // Clear previous timeout
    if (saveTimeouts[id]) clearTimeout(saveTimeouts[id]);

    setSavingStatus(prev => ({ ...prev, [id]: 'Saving...' }));

    const timeout = setTimeout(async () => {
      const rowToSave = rows.find(r => r.id === id) || {};
      const updatedRow = { ...rowToSave, [field]: value };
      
      try {
        const payload = {
          teacher_id: user?.id,
          teacher_name: user?.name,
          class: filters.class,
          subject: filters.subject,
          term: filters.term,
          week_number: updatedRow.week_number,
          strand: updatedRow.strand,
          sub_strand: updatedRow.sub_strand,
          specific_learning_outcomes: updatedRow.specific_learning_outcomes,
          key_inquiry_questions: updatedRow.key_inquiry_questions,
          learning_resources: updatedRow.learning_resources,
          assessment_method: updatedRow.assessment_method,
          remarks: updatedRow.remarks
        };

        if (!updatedRow.isDraft) {
          payload.id = updatedRow.id;
        }

        const result = await upsertRow('schemes_of_work', payload);
        
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...result[0], isDraft: false } : r));
        setSavingStatus(prev => ({ ...prev, [id]: 'Saved' }));
        setTimeout(() => setSavingStatus(p => ({ ...p, [id]: null })), 2000);
      } catch (e) {
        setSavingStatus(prev => ({ ...prev, [id]: 'Error' }));
        notify(`Failed to save week ${updatedRow.week_number}`, 'error');
      }
    }, 800);

    setSaveTimeouts(prev => ({ ...prev, [id]: timeout }));
  };

  const handleExport = () => {
    exportSchemeOfWorkPDF({
      school: store.settings,
      scheme: filters,
      rows: rows,
      filename: `Scheme_Of_Work_${filters.class}_${filters.subject}_${filters.term}.pdf`
    });
  };

  return (
    <div className="view-content">
      <PageHeader 
        title="Scheme of Work Builder" 
        subtitle="Manage your termly schemes according to CBC guidelines" 
      />

      <div className="card" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Class</label>
          <select className="input" value={filters.class} onChange={e => setFilters(f => ({...f, class: e.target.value}))}>
            {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Subject</label>
          <select className="input" value={filters.subject} onChange={e => setFilters(f => ({...f, subject: e.target.value}))}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Term</label>
          <select className="input" value={filters.term} onChange={e => setFilters(f => ({...f, term: e.target.value}))}>
            {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={handleExport} style={{ alignSelf: 'flex-end' }}>
          <Download size={16} /> Export PDF
        </button>
      </div>

      <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>Loading schemes...</div>
        ) : (
          <table className="data-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Week</th>
                <th style={{ width: 120 }}>Strand</th>
                <th style={{ width: 140 }}>Sub-Strand</th>
                <th>Specific Learning Outcomes</th>
                <th>Key Inquiry Questions</th>
                <th>Learning Resources</th>
                <th style={{ width: 120 }}>Assessment</th>
                <th style={{ width: 120 }}>Remarks</th>
                {!readOnly && <th style={{ width: 80 }}>Status</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id}>
                  <td>
                    <input 
                      type="number" 
                      className="input" 
                      value={r.week_number} 
                      onChange={e => handleChange(r.id, 'week_number', parseInt(e.target.value))}
                      style={{ width: '100%', padding: 4 }}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="input" 
                      value={r.strand || ''} 
                      onChange={e => handleChange(r.id, 'strand', e.target.value)}
                      style={{ width: '100%', padding: 4, minHeight: 60, resize: 'vertical' }}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="input" 
                      value={r.sub_strand || ''} 
                      onChange={e => handleChange(r.id, 'sub_strand', e.target.value)}
                      style={{ width: '100%', padding: 4, minHeight: 60, resize: 'vertical' }}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="input" 
                      value={r.specific_learning_outcomes || ''} 
                      onChange={e => handleChange(r.id, 'specific_learning_outcomes', e.target.value)}
                      style={{ width: '100%', padding: 4, minHeight: 60, resize: 'vertical' }}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="input" 
                      value={r.key_inquiry_questions || ''} 
                      onChange={e => handleChange(r.id, 'key_inquiry_questions', e.target.value)}
                      style={{ width: '100%', padding: 4, minHeight: 60, resize: 'vertical' }}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="input" 
                      value={r.learning_resources || ''} 
                      onChange={e => handleChange(r.id, 'learning_resources', e.target.value)}
                      style={{ width: '100%', padding: 4, minHeight: 60, resize: 'vertical' }}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="input" 
                      value={r.assessment_method || ''} 
                      onChange={e => handleChange(r.id, 'assessment_method', e.target.value)}
                      style={{ width: '100%', padding: 4, minHeight: 60, resize: 'vertical' }}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="input" 
                      value={r.remarks || ''} 
                      onChange={e => handleChange(r.id, 'remarks', e.target.value)}
                      style={{ width: '100%', padding: 4, minHeight: 60, resize: 'vertical' }}
                      disabled={readOnly}
                    />
                  </td>
                  {!readOnly && (
                    <td style={{ fontSize: 11, color: savingStatus[r.id] === 'Error' ? '#f87171' : savingStatus[r.id] === 'Saved' ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
                      {savingStatus[r.id] || (r.isDraft ? 'Draft' : 'Synced')}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}



