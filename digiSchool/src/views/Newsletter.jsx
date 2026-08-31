import { useState, useEffect } from 'react';
import { PageHeader } from '../components/widgets';
import { Icon } from '../components/icons';
import PrintHeader from '../components/PrintHeader';
import OfficialStamp from '../components/OfficialStamp';
import { fetchTable, upsertRow, getActiveSchoolId } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { Plus, Trash2, Printer, Send, Save, FileText } from 'lucide-react';

const ROLE_LABEL = {
  deputy_admin: 'Deputy Principal (Administration)',
  deputy_academic: 'Deputy Principal (Academics)',
  dos: 'Director of Studies',
  dean: 'Dean of Students',
  principal: 'Principal',
};

const blankSection = () => ({ id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, heading: '', body: '' });

export default function Newsletter({ store, user }) {
  const notify = store?.notify || (() => {});
  const settings = store?.settings || {};

  const [title, setTitle] = useState('School Newsletter');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [intro, setIntro] = useState('');
  const [sections, setSections] = useState([{ ...blankSection(), heading: 'Highlights', body: '' }]);
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [past, setPast] = useState([]);

  useEffect(() => {
    fetchTable('newsletters')
      .then((rows) => setPast((rows || []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))))
      .catch(() => setPast([]));
  }, []);

  const authorRole = ROLE_LABEL[user?.role] || 'Administration';

  const updateSection = (id, patch) => setSections((s) => s.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)));
  const addSection = () => setSections((s) => [...s, blankSection()]);
  const removeSection = (id) => setSections((s) => (s.length > 1 ? s.filter((sec) => sec.id !== id) : s));

  const buildRecord = (status) => ({
    id: currentId || `nl_${Date.now()}`,
    title: title.trim() || 'School Newsletter',
    issue_date: issueDate,
    intro,
    sections: sections.map(({ heading, body }) => ({ heading, body })),
    status,
    author: user?.name || 'Administration',
    author_role: authorRole,
    published_at: status === 'Published' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  });

  const handleSave = async (status = 'Draft') => {
    if (!title.trim()) { notify('Give the newsletter a title.', 'warning'); return; }
    setSaving(true);
    const record = buildRecord(status);
    try {
      await upsertRow('newsletters', record);
      setCurrentId(record.id);
      setPast((prev) => [record, ...prev.filter((p) => p.id !== record.id)]);
      notify(status === 'Published' ? 'Newsletter published.' : 'Newsletter saved as draft.', 'success');
      return true;
    } catch (e) {
      notify(`Could not save newsletter: ${e.message}`, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const saved = await handleSave('Published');
    if (!saved) return;
    // Surface the issue to parents (and everyone) via the notifications feed.
    try {
      await supabase.from('notifications').insert({
        id: `nl_notif_${Date.now()}`,
        title: `Newsletter: ${title.trim()}`,
        message: intro?.slice(0, 240) || `A new school newsletter has been published.`,
        body: intro || `A new school newsletter (${title.trim()}) has been published by the ${authorRole}.`,
        posted_by: user?.name || authorRole,
        role: user?.role || 'admin',
        audience: ['parents'],
        school_id: getActiveSchoolId(),
        read: false,
        created_at: new Date().toISOString(),
      });
      notify('Parents notified in their portal.', 'success');
    } catch (e) {
      notify(`Published, but parent notification failed: ${e.message}`, 'warning');
    }
  };

  const loadPast = (nl) => {
    setCurrentId(nl.id);
    setTitle(nl.title || '');
    setIssueDate(nl.issue_date || new Date().toISOString().slice(0, 10));
    setIntro(nl.intro || '');
    const secs = Array.isArray(nl.sections) && nl.sections.length > 0
      ? nl.sections.map((s) => ({ ...blankSection(), ...s }))
      : [blankSection()];
    setSections(secs);
    notify(`Loaded "${nl.title}".`, 'info');
  };

  const newDraft = () => {
    setCurrentId(null);
    setTitle('School Newsletter');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setIntro('');
    setSections([{ ...blankSection(), heading: 'Highlights', body: '' }]);
  };

  return (
    <div className="print-friendly">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden; }
          .newsletter-doc, .newsletter-doc * { visibility: visible; }
          .newsletter-doc { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="no-print">
        <PageHeader
          title="Newsletter Generator"
          subtitle="Compose, publish and print official school newsletters"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={newDraft}><FileText size={16} /> New</button>
              <button className="btn" onClick={() => handleSave('Draft')} disabled={saving}><Save size={16} /> Save Draft</button>
              <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print / PDF</button>
              <button className="btn btn-primary" onClick={handlePublish} disabled={saving}><Send size={16} /> Publish to Parents</button>
            </div>
          }
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── Composer ── */}
        <div className="card card-pad no-print" style={{ height: 'fit-content' }}>
          <div className="section-title" style={{ marginTop: 0 }}>Compose</div>
          <label className="field-label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="field-label" style={{ marginTop: 12 }}>Issue Date</label>
          <input type="date" className="input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <label className="field-label" style={{ marginTop: 12 }}>Introduction / Editorial</label>
          <textarea className="input" rows={4} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="A message from the office..." style={{ resize: 'vertical' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
            <div className="section-title" style={{ margin: 0, fontSize: 14 }}>Sections</div>
            <button className="btn btn-sm" onClick={addSection}><Plus size={14} /> Add</button>
          </div>
          {sections.map((sec, i) => (
            <div key={sec.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" placeholder={`Section ${i + 1} heading`} value={sec.heading} onChange={(e) => updateSection(sec.id, { heading: e.target.value })} />
                <button className="btn btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => removeSection(sec.id)}><Trash2 size={14} /></button>
              </div>
              <textarea className="input" rows={3} placeholder="Section content..." value={sec.body} onChange={(e) => updateSection(sec.id, { body: e.target.value })} style={{ marginTop: 8, resize: 'vertical' }} />
            </div>
          ))}

          {past.length > 0 && (
            <>
              <div className="section-title" style={{ fontSize: 14, marginTop: 16 }}>Past Issues</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {past.map((nl) => (
                  <button key={nl.id} className="btn btn-sm" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 6 }} onClick={() => loadPast(nl)}>
                    <span style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nl.title}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{nl.status}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Live preview / print target ── */}
        <NewsletterDoc settings={settings} title={title} issueDate={issueDate} intro={intro} sections={sections} authorRole={authorRole} authorName={user?.name} />
      </div>
    </div>
  );
}

function NewsletterDoc({ settings, title, issueDate, intro, sections, authorRole, authorName }) {
  return (
    <div className="card newsletter-doc" style={{ background: '#fff', color: '#111', padding: '32px 40px', borderRadius: 8, maxWidth: 860 }}>
      <PrintHeader settings={settings} />
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26, textTransform: 'uppercase', letterSpacing: 1 }}>{title || 'School Newsletter'}</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {new Date(issueDate).toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {intro && (
        <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: 20 }}>{intro}</p>
      )}

      {sections.filter((s) => s.heading || s.body).map((sec, i) => (
        <div key={sec.id || i} style={{ marginBottom: 18 }}>
          {sec.heading && (
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>{sec.heading}</h3>
          )}
          {sec.body && <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{sec.body}</div>}
        </div>
      ))}

      <div style={{ marginTop: 28, fontSize: 13, color: '#334155' }}>
        Issued by <strong>{authorName || authorRole}</strong>{authorName ? `, ${authorRole}` : ''}.
      </div>

      {/* Official stamp appears on every official document (Task requirement). */}
      <OfficialStamp settings={settings} align="right" label={authorRole} />
    </div>
  );
}
