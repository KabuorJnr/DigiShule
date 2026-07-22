import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Badge } from '../components/widgets';

import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';
import { getActiveSchoolId } from '../lib/api';
import { Bell, Plus, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { Icon } from '../components/icons';
import { exportTablePDF } from '../utils/exporters';
const ROLE_COLOR = {
  'Deputy Academics': 'blue', 'Deputy Admin': 'green',
  'Finance': 'amber', 'Principal': 'red', 'Staff': 'gray',
};

const CAN_POST = ['principal', 'deputy_academic', 'deputy_admin', 'finance', 'registrar'];

const AUDIENCE_OPTS = [
  { value: 'all', label: 'Everyone' },
  { value: 'students', label: 'Students Only' },
  { value: 'parents', label: 'Parents Only' },
  { value: 'teachers', label: 'Teachers Only' },
  { value: 'staff', label: 'Staff Only' },
  { value: 'specific', label: 'Specific User' },
];

const audienceMap = {
  principal: 'all', deputy_academic: 'all', deputy_admin: 'all', finance: 'all',
  teacher: 'teachers', student: 'students', parent: 'parents',
  nurse: 'staff', librarian: 'staff', registrar: 'staff',
};

export default function Notices({ store, user }) {
  const { notify, feeStructure, settings } = store;
  
  const downloadFeeStructure = () => {
    if (!feeStructure || feeStructure.length === 0) return;
    const head = ['Fee Component', 'Grade 7 (KES)', 'Grade 8 (KES)', 'Grade 9 (KES)', 'Grade 10 (KES)'];
    const body = feeStructure.map(f => [
      f.component,
      f.f1.toLocaleString(),
      f.f2.toLocaleString(),
      f.f3.toLocaleString(),
      f.f4.toLocaleString()
    ]);
    const totalRow = [
      'TOTAL TERM FEES',
      feeStructure.reduce((s, f) => s + (f.f1 || 0), 0).toLocaleString(),
      feeStructure.reduce((s, f) => s + (f.f2 || 0), 0).toLocaleString(),
      feeStructure.reduce((s, f) => s + (f.f3 || 0), 0).toLocaleString(),
      feeStructure.reduce((s, f) => s + (f.f4 || 0), 0).toLocaleString(),
    ];
    body.push(totalRow);

    exportTablePDF({
      school: settings,
      title: 'OFFICIAL FEE STRUCTURE',
      subtitle: `Academic Year: ${new Date().getFullYear()}`,
      head,
      body,
      filename: `Fee_Structure_${new Date().getFullYear()}.pdf`
    });
  };
  const [dbNotices, setDbNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPost, setShowPost] = useState(false);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', specificUser: '', sendSms: false });
  const [expanded, setExpanded] = useState(null);
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [recipientUsers, setRecipientUsers] = useState([]);

  const canPost = user && CAN_POST.includes(user.role);
  const myAudience = audienceMap[user?.role] || 'all';

  // ── Load notices: Supabase first, fall back to seed ──────────
  const loadNotices = useCallback(async () => {
    if (dbNotices.length === 0) setLoading(true);
    try {
      const schoolId = getActiveSchoolId();
      if (!schoolId) { setDbNotices([]); setLoading(false); return; }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDbNotices(data && data.length > 0 ? data : []);
    } catch {
      setDbNotices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecipientUsers = useCallback(async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, name, role, email');
      if (data) setRecipientUsers(data);
    } catch {}
  }, []);

  useEffect(() => { loadNotices(); loadRecipientUsers(); }, [loadNotices, loadRecipientUsers]);

  // Merge seed + db; filter by audience
  const seedNotices = [];
  const allNotices = [
    ...dbNotices.map(n => ({
      id: n.id, title: n.title || n.message, body: n.body || n.message,
      postedBy: n.posted_by || 'Admin', role: n.role || 'Staff',
      date: (n.created_at || '').slice(0, 10),
      audience: n.audience ? (Array.isArray(n.audience) ? n.audience : [n.audience]) : ['all'],
      source: 'db',
    })),
    ...seedNotices,
  ];

  const visible = allNotices.filter(n => {
    const aud = n.audience;
    const isGlobalViewer = ['principal', 'deputy_admin', 'deputy_academic'].includes(user?.role);
    const isSender = n.postedBy === user?.name;
    const matchUser = isGlobalViewer || isSender || aud.includes('all') || aud.includes(myAudience) || aud.includes(user?.username) || aud.includes(user?.email) || aud.includes(user?.id);
    
    // For the filter tabs
    const matchFilter = audienceFilter === 'all' || aud.includes(audienceFilter) || aud.includes('all');
    return matchUser && matchFilter;
  });

  // ── Post notice ───────────────────────────────────────────────
  const handlePost = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      notify('Title and body are required', 'warning'); return;
    }
    setPosting(true);
    const schoolId = getActiveSchoolId();
    if (!schoolId) {
      notify('No active school selected', 'error');
      setPosting(false);
      return;
    }
    try {
      const row = {
        title: form.title,
        message: form.body,
        body: form.body,
        posted_by: user?.name || 'Staff',
        role: user?.dept || user?.role || 'Staff',
        audience: form.audience === 'all' ? ['all'] : form.audience === 'specific' && form.specificUser ? [form.specificUser] : [form.audience],
        read: false,
        school_id: schoolId,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('notifications').insert(row);
      if (error) throw error;
      await loadNotices();
      setShowPost(false);
      setForm({ title: '', body: '', audience: 'all', specificUser: '', sendSms: false });
      notify('Notice posted successfully', 'success', 'Notices');
      
      // SMS Logic
      if (form.sendSms) {
        notify('Preparing SMS broadcast...', 'info');
        let phones = [];
        if (form.audience === 'parents' || form.audience === 'all') {
          const { data: stds } = await supabase.from('students').select('guardian_phone').eq('school_id', schoolId);
          if (stds) phones.push(...stds.map(s => s.guardian_phone));
        }
        if (form.audience === 'teachers' || form.audience === 'all') {
          const { data: tchrs } = await supabase.from('teachers').select('phone').eq('school_id', schoolId);
          if (tchrs) phones.push(...tchrs.map(t => t.phone));
        }
        if (form.audience === 'staff' || form.audience === 'all') {
          const { data: stf } = await supabase.from('staff').select('phone').eq('school_id', schoolId);
          if (stf) phones.push(...stf.map(s => s.phone));
        }
        
        phones = [...new Set(phones.filter(Boolean))];

        if (phones.length > 0) {
          try {
            const { data, error } = await supabase.functions.invoke('send-sms', {
              body: { recipients: phones, message: form.body }
            });
            if (error || data?.error) throw new Error(error?.message || data?.error);
            notify(`SMS sent to ${phones.length} recipients`, 'success', 'SMS');
          } catch (err) {
            console.error('SMS Error:', err);
            notify('Failed to send SMS: ' + err.message, 'error', 'SMS');
          }
        } else {
          notify('No valid phone numbers found for this audience', 'warning', 'SMS');
        }
      }
    } catch (e) {
      console.error('Notice Post Error:', e);
      // Fallback to local if Supabase fails
      setDbNotices(prev => [{
        id: `local_${Date.now()}`, title: form.title, body: form.body,
        posted_by: user?.name, role: user?.dept || 'Staff',
        audience: form.audience === 'specific' ? [form.specificUser] : [form.audience], created_at: new Date().toISOString(),
      }, ...prev]);
      setShowPost(false);
      setForm({ title: '', body: '', audience: 'all', specificUser: '', sendSms: false });
      notify(`Notice failed to sync: ${e.message || JSON.stringify(e)} (Saved locally)`, 'error', 'Notices');
    } finally { setPosting(false); }
  };

  return (
    <div>
      <PageHeader
        title="Notices & Announcements"
        subtitle={`${visible.length} notice${visible.length !== 1 ? 's' : ''} visible to you`}
        actions={canPost && (
          <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setShowPost(true)}>
            <Plus size={15} /> Post Notice
          </button>
        )}
      />

      {/* Audience filter */}
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <Bell size={16} color="#94a3b8" />
        {AUDIENCE_OPTS.map(o => (
          <button
            key={o.value}
            className={`btn btn-sm${audienceFilter === o.value ? ' btn-primary' : ''}`}
            onClick={() => setAudienceFilter(o.value)}
          >
            {o.label}
          </button>
        ))}
        {loading && <Loader size={14} style={{ opacity: 0.5, marginLeft: 4 }} />}
      </div>

      {/* Notice list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.length === 0 && !loading && (
          <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
            <Bell size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
            <p className="muted">No notices to display.</p>
          </div>
        )}
        {visible.map(n => (
          <div
            key={n.id}
            className="card card-pad"
            style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onClick={() => setExpanded(expanded === n.id ? null : n.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{n.title}</h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 12 }}>By {n.postedBy}</span>
                  <Badge color={ROLE_COLOR[n.role] || 'gray'}>{n.role}</Badge>
                  <span className="muted" style={{ fontSize: 12 }}>{n.date}</span>
                  {n.source === 'db' && <Badge color="green">Live</Badge>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                {n.audience.map(a => (
                  <Badge key={a} color="gray">{a === 'all' ? 'Everyone' : a}</Badge>
                ))}
                {expanded === n.id ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
              </div>
            </div>
            {expanded === n.id && (
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                fontSize: 14, lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap',
              }}>
                {n.body.replace('[ATTACHMENT:FEE_STRUCTURE]', '')}
                {n.body.includes('[ATTACHMENT:FEE_STRUCTURE]') && (
                  <div style={{ marginTop: 16 }}>
                    <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); downloadFeeStructure(); }}>
                      <Icon name="download" size={16} style={{ marginRight: 6 }} /> Download Fee Structure PDF
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Post Notice Modal */}
      {showPost && (
        <Modal
          title="Post a Notice"
          onClose={() => !posting && setShowPost(false)}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={posting} onClick={() => setShowPost(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={posting} style={{ gap: 6 }} onClick={handlePost}>
                {posting ? <><Loader size={14} /> Posting…</> : <><Bell size={14} /> Publish Notice</>}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Title *</label>
              <input className="input" placeholder="Notice title…" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Body *</label>
              <textarea className="input" rows={6} placeholder="Write the notice content…" value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Audience</label>
              <select className="select" value={form.audience} onChange={e => setForm(p => ({ ...p, audience: e.target.value, specificUser: '' }))}>
                {AUDIENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {form.audience === 'specific' && (
              <div>
                <label className="field-label">Select Recipient</label>
                <select className="select" value={form.specificUser || ''} onChange={e => setForm(p => ({ ...p, specificUser: e.target.value }))}>
                  <option value="">-- Choose User --</option>
                  {recipientUsers.filter(u => u.id !== user?.id && u.email !== user?.email).map(u => (
                    <option key={u.id} value={u.id || u.email}>{u.name || u.email} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500, color: '#1e293b' }}>
                <input 
                  type="checkbox" 
                  checked={form.sendSms} 
                  onChange={e => setForm(p => ({ ...p, sendSms: e.target.checked }))} 
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                Also send via SMS to registered phone numbers
              </label>
              {form.sendSms && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginLeft: 24 }}>
                  Uses Africa's Talking API. Ensure phone numbers are correctly formatted.
                </div>
              )}
            </div>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 10, fontSize: 12, color: '#0369a1' }}>
              This notice will be saved to Supabase and visible to all users of this school.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



