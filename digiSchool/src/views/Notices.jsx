import { useState } from 'react';
import { PageHeader, Badge } from '../components/widgets';
import { NOTICES as SEED_NOTICES } from '../data/seed';
import Modal from '../components/Modal';

const ROLE_COLOR = {
  'Deputy Academics': 'blue',
  'Deputy Admin': 'green',
  'Finance': 'amber',
  'Principal': 'red',
};

const CAN_POST = ['principal', 'deputy_academic', 'deputy_admin', 'finance'];

export default function Notices({ store, user }) {
  const { notify } = store;
  const [notices, setNotices] = useState(SEED_NOTICES);
  const [showPost, setShowPost] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  const [expanded, setExpanded] = useState(null);

  const canPost = user && CAN_POST.includes(user.role);

  const userRole = user?.role || '';
  const audienceMap = {
    principal: 'all', deputy_academic: 'all', deputy_admin: 'all', finance: 'all',
    teacher: 'teachers', student: 'students', parent: 'parents', nurse: 'staff',
    librarian: 'staff', registrar: 'staff',
  };
  const myAudience = audienceMap[userRole] || 'all';
  const visible = notices.filter(n =>
    n.audience.includes('all') || n.audience.includes(myAudience)
  );

  const handlePost = () => {
    if (!form.title.trim() || !form.body.trim()) {
      notify('Title and body are required', 'warning');
      return;
    }
    const newNotice = {
      id: `n${Date.now()}`,
      title: form.title,
      body: form.body,
      postedBy: user.name,
      role: user.dept || 'Staff',
      date: new Date().toISOString().slice(0, 10),
      audience: form.audience === 'all' ? ['all'] : [form.audience],
    };
    setNotices(prev => [newNotice, ...prev]);
    setShowPost(false);
    setForm({ title: '', body: '', audience: 'all' });
    notify('Notice posted successfully', 'success', 'Notices');
  };

  return (
    <div>
      <PageHeader
        title="Notices & Announcements"
        subtitle={`${visible.length} notice${visible.length !== 1 ? 's' : ''} visible to you`}
        actions={canPost && (
          <button className="btn btn-primary" onClick={() => setShowPost(true)}>+ Post Notice</button>
        )}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.map(n => (
          <div key={n.id} className="card card-pad" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === n.id ? null : n.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 15 }}>{n.title}</h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <span className="muted" style={{ fontSize: 12 }}>By {n.postedBy}</span>
                  <Badge color={ROLE_COLOR[n.role] || 'gray'}>{n.role}</Badge>
                  <span className="muted" style={{ fontSize: 12 }}>{n.date}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {n.audience.map(a => (
                  <Badge key={a} color="gray">{a === 'all' ? 'Everyone' : a}</Badge>
                ))}
              </div>
            </div>
            {expanded === n.id && (
              <div style={{ marginTop: 12, padding: '12px 0', borderTop: '1px solid var(--border)', fontSize: 14, lineHeight: 1.6, color: '#334155' }}>
                {n.body}
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <p className="muted">No notices to display.</p>
          </div>
        )}
      </div>

      {showPost && (
        <Modal title="Post a Notice" onClose={() => setShowPost(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowPost(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePost}>Publish Notice</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Title *</label>
              <input className="input" placeholder="Notice title..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Body *</label>
              <textarea className="input" rows={5} placeholder="Write the notice content..." value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Audience</label>
              <select className="select" value={form.audience} onChange={e => setForm(p => ({ ...p, audience: e.target.value }))}>
                <option value="all">Everyone</option>
                <option value="students">Students Only</option>
                <option value="parents">Parents Only</option>
                <option value="teachers">Teachers Only</option>
                <option value="staff">Staff Only</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
