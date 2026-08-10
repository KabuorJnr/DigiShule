import { PageHeader } from '../components/widgets';
import { ExternalLink, ShieldCheck, Info } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Appraisal (TPAD)
//
// EduOne does NOT re-implement the appraisal rubric. Teacher Performance
// Appraisal & Development is an official Teachers Service Commission tool
// (TPAD 2). Keeping a parallel scoring system inside a school ERP invites
// drift: if TSC updates the standards, our local copy silently disagrees
// with the official record. This view is a launcher instead — it explains
// what TPAD is, then sends the teacher / appraiser to the real portal.
//
// The URL is settings-configurable so admins can update it if TSC moves it.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TPAD_URL = 'https://tpad2.tsc.go.ke';

export default function Appraisal({ store, user }) {
  const tpadUrl = (store?.settings?.tpad_url && String(store.settings.tpad_url).trim()) || DEFAULT_TPAD_URL;
  const isTeacher = user?.role === 'teacher';

  const openTpad = () => {
    // Open in a new tab so the school session isn't disturbed.
    window.open(tpadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <PageHeader
        title="Teacher Appraisal (TPAD)"
        subtitle="Open the official TSC Teacher Performance Appraisal & Development portal"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 720px)', gap: 16 }}>

        {/* Primary card */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} color="#111827" strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Official TPAD 2 Portal</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Teachers Service Commission · tpad2.tsc.go.ke</div>
            </div>
          </div>

          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.55, margin: '10px 0 18px' }}>
            {isTeacher
              ? 'Your appraisal is recorded on the official TSC TPAD system. Sign in with your TSC number to view your appraisal cycle, upload evidence, and sign off on ratings.'
              : 'Teacher appraisals in Kenya are conducted on the official TSC TPAD system. This link opens the portal in a new tab so you can appraise your staff there — EduOne intentionally does not keep a parallel scoring copy.'}
          </p>

          <button
            onClick={openTpad}
            style={{
              height: 42, padding: '0 18px', borderRadius: 8,
              background: '#111827', border: '1px solid #111827',
              color: '#ffffff', fontSize: 14, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            }}
          >
            <ExternalLink size={16} strokeWidth={1.75} /> Open TPAD portal
          </button>

          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 14 }}>
            You&#39;ll need your <strong style={{ color: '#111827' }}>TSC number</strong> and the password you set on the TSC portal.
          </div>
        </div>

        {/* Helpful notes card */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Info size={16} color="#6b7280" strokeWidth={1.75} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
              <div style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Why not appraise inside EduOne?</div>
              TPAD is a statutory instrument. Any parallel rubric outside TSC drifts
              out of sync when standards are updated and creates conflicting records
              at inspection. EduOne keeps the source of truth on the TSC portal and
              simply gives you a one-click entry point next to the rest of your
              teaching-staff tools.
            </div>
          </div>
        </div>

        {store?.settings?.tpad_url && store.settings.tpad_url !== DEFAULT_TPAD_URL && (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            Using custom TPAD URL from school settings: {store.settings.tpad_url}
          </div>
        )}
      </div>
    </div>
  );
}
