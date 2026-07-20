import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PageHeader } from '../components/widgets';
import {
  User, Mail, Phone, Lock, Save, Eye, EyeOff,
  CheckCircle2, AlertCircle, Building2, Tag
} from 'lucide-react';

const ROLE_LABELS = {
  principal: 'Principal / Head Teacher',
  deputy_academic: 'Deputy Principal (Academics)',
  deputy_admin: 'Deputy Principal (Administration)',
  finance: 'Finance Officer',
  registrar: 'Registrar',
  librarian: 'Librarian',
  nurse: 'School Nurse',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent / Guardian',
};

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {Icon && <Icon size={14} color="#64748b" />} {label}
      </label>
      {children}
    </div>
  );
}

export default function MyProfile({ store, user, onUserUpdate }) {
  const { notify } = store;

  // Load any saved overrides from localStorage
  const savedOverrides = (() => {
    try { return JSON.parse(localStorage.getItem('eduone_profile_overrides') || '{}'); } catch { return {}; }
  })();

  const [form, setForm] = useState({
    name:    savedOverrides.name    || user?.name    || '',
    email:   savedOverrides.email   || user?.email   || '',
    phone:   savedOverrides.phone   || user?.phone   || '',
    title:   savedOverrides.title   || user?.dept    || '',
    bio:     savedOverrides.bio     || user?.bio     || '',
    tsc_number: savedOverrides.tsc_number || '',
  });

  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw]     = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving]     = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [pwError, setPwError]   = useState('');
  const [pwOk, setPwOk]         = useState(false);

  const upForm = (patch) => setForm(f => ({ ...f, ...patch }));

  // Load teacher-specific fields if applicable
  const isStaff = ['teacher', 'principal', 'deputy_academic', 'deputy_admin'].includes(user?.role);
  useEffect(() => {
    if (isStaff && store.teachers) {
      const teacherRecord = store.teachers.find(t => t.id === user?.id || t.emp_id === user?.id);
      if (teacherRecord) {
        setForm(f => ({
          ...f,
          tsc_number: f.tsc_number || teacherRecord.tsc_number || '',
          bio: f.bio || teacherRecord.bio || ''
        }));
      }
    }
  }, [store.teachers, user?.id, isStaff]);

  // ── Save profile details ──────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      // 1. Always persist to localStorage
      const overrides = { name: form.name, email: form.email, phone: form.phone, title: form.title, bio: form.bio, tsc_number: form.tsc_number };
      localStorage.setItem('eduone_profile_overrides', JSON.stringify(overrides));

      // Update the demo_user in localStorage too (so sidebar reflects new name)
      const demoUser = JSON.parse(localStorage.getItem('eduone_demo_user') || 'null');
      if (demoUser) {
        demoUser.name = form.name;
        localStorage.setItem('eduone_demo_user', JSON.stringify(demoUser));
      }

      // 2. Try to save to Supabase profiles table
      const { data: { user: supaUser } } = await supabase.auth.getUser();
      if (supaUser) {
        await supabase.from('profiles').upsert({
          id: supaUser.id,
          full_name: form.name,
          username: user?.username,
          role: user?.role,
          dept: form.title,
        }, { onConflict: 'id' });

        // Update email in Supabase Auth if changed
        if (form.email && form.email !== supaUser.email) {
          await supabase.auth.updateUser({ email: form.email });
        }

        // 2b. Sync to teachers table if staff
        if (isStaff) {
          const teacherRecord = store.teachers?.find(t => t.id === user?.id || t.emp_id === user?.id);
          if (teacherRecord) {
            await store.updateTeacher(teacherRecord.id, { tsc_number: form.tsc_number, bio: form.bio, name: form.name });
          }
        }
      }

      // 3. Update app state
      if (onUserUpdate) onUserUpdate({ ...user, name: form.name, dept: form.title });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      notify('Profile saved successfully', 'success', 'My Profile');
    } catch (e) {
      notify('Profile saved locally (Supabase sync failed)', 'warning', 'My Profile');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwError('');
    setPwOk(false);
    if (!pwForm.next) { setPwError('New password is required.'); return; }
    if (pwForm.next.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }

    setPwSaving(true);
    try {
      const { data: { user: supaUser } } = await supabase.auth.getUser();
      if (!supaUser) {
        // Demo mode: just save new password to localStorage for future reference
        const demoUser = JSON.parse(localStorage.getItem('eduone_demo_user') || 'null');
        if (demoUser) {
          demoUser.password = pwForm.next;
          localStorage.setItem('eduone_demo_user', JSON.stringify(demoUser));
        }
        setPwOk(true);
        setPwForm({ current: '', next: '', confirm: '' });
        notify('Password updated (local only - link a Supabase account for full security)', 'info', 'My Profile');
      } else {
        const { error } = await supabase.auth.updateUser({ password: pwForm.next });
        if (error) throw error;
        setPwOk(true);
        setPwForm({ current: '', next: '', confirm: '' });
        notify('Password changed successfully', 'success', 'My Profile');
      }
    } catch (e) {
      setPwError(e.message || 'Password change failed.');
    } finally {
      setPwSaving(false);
    }
  };

  const isDemoMode = !!localStorage.getItem('eduone_demo_user');

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader title="My Profile" subtitle="Manage your personal details and account security" />

      {/* Demo mode notice */}
      {isDemoMode && (
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8,
          padding: '10px 14px', fontSize: 13, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          You are using a <strong>demo account</strong>. Changes save locally and to Supabase if you have linked an account.
        </div>
      )}

      {/* ── Personal Details ── */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={17} color="#0078D4" /> Personal Details
        </div>

        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '12px 16px', background: '#f8fafc', borderRadius: 8 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #0078D4, #0369A1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0
          }}>
            {(form.name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{form.name || 'Your Name'}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>{ROLE_LABELS[user?.role] || user?.role}</div>
            {isDemoMode && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Demo Account</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Full Name *" icon={User}>
              <input className="input" value={form.name} onChange={e => upForm({ name: e.target.value })} placeholder="Your full name" />
            </Field>
          </div>
          <Field label="Email Address" icon={Mail}>
            <input className="input" type="email" value={form.email} onChange={e => upForm({ email: e.target.value })} placeholder="your@email.com" />
          </Field>
          <Field label="Phone Number" icon={Phone}>
            <input className="input" value={form.phone} onChange={e => upForm({ phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
          </Field>
          <Field label="Job Title / Department" icon={Tag}>
            <input className="input" value={form.title} onChange={e => upForm({ title: e.target.value })} placeholder="e.g. Mathematics Teacher" />
          </Field>
          <Field label="Role" icon={Building2}>
            <input className="input" value={ROLE_LABELS[user?.role] || user?.role || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </Field>
          
          {/* Staff Specific Details */}
          {['teacher', 'principal', 'deputy_academic', 'deputy_admin'].includes(user?.role) && (
            <Field label="TSC Number" icon={Tag}>
              <input className="input" value={form.tsc_number} onChange={e => upForm({ tsc_number: e.target.value })} placeholder="Enter your TSC Number" />
            </Field>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Short Bio (optional)" icon={null}>
            <textarea className="input" rows={3} value={form.bio} onChange={e => upForm({ bio: e.target.value })} placeholder="A short description about yourself…" />
          </Field>
        </div>

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, display: 'flex', gap: 6, marginTop: 10 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{error}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" style={{ gap: 6 }} disabled={saving} onClick={handleSave}>
            <Save size={15} /> {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saved && (
            <span style={{ color: '#107C10', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={15} /> Saved!
            </span>
          )}
        </div>
      </div>

      {/* ── Change Password ── */}
      <div className="card card-pad">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={17} color="#0078D4" /> Change Password
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
          {[
            { key: 'next', label: 'New Password' },
            { key: 'confirm', label: 'Confirm New Password' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPw[key] ? 'text' : 'password'}
                  value={pwForm[key]}
                  placeholder=" |  |  |  |  |  |  |  | "
                  onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                >
                  {showPw[key] ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {pwError && (
          <div style={{ color: '#dc2626', fontSize: 13, display: 'flex', gap: 6, marginTop: 10 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{pwError}
          </div>
        )}
        {pwOk && (
          <div style={{ color: '#107C10', fontSize: 13, display: 'flex', gap: 6, marginTop: 10 }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />Password updated successfully.
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" style={{ gap: 6 }} disabled={pwSaving} onClick={handleChangePassword}>
            <Lock size={15} /> {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
        </div>

        {isDemoMode && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
            In demo mode, the new password is saved locally. To enable full Supabase auth, create an account in the Supabase dashboard and link it via Settings.
          </div>
        )}
      </div>
    </div>
  );
}



