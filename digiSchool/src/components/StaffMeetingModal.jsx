/**
 * StaffMeetingModal — schedule a staff meeting and alert every teacher.
 *
 * WHO CAN SEND: principal, deputy_academic and deputy_admin only. The guard is
 * here AND at the call site (the quick action is hidden for other roles), so a
 * teacher who somehow reaches this component still cannot post.
 *
 * HOW TEACHERS GET IT: a row in `notifications` with audience ['teachers'],
 * which is the bucket Notices.jsx maps the teacher role onto — so it lands in
 * every teacher's notices without any new plumbing. The meeting is also
 * written to `calendar_events` so it shows on the school calendar.
 */

import { useState } from 'react';
import Modal from './Modal';
import { upsertRow } from '../lib/api';
import { CalendarDays, Users, AlertTriangle } from 'lucide-react';

/** Roles allowed to call a staff meeting. */
export const MEETING_SENDER_ROLES = ['principal', 'deputy_academic', 'deputy_admin'];

export function canCallStaffMeeting(role) {
  return MEETING_SENDER_ROLES.includes(String(role || '').toLowerCase());
}

const AUDIENCES = [
  { id: 'teachers', label: 'All teaching staff' },
  { id: 'staff', label: 'All non-teaching staff' },
  { id: 'all', label: 'Everyone on staff' },
];

export default function StaffMeetingModal({ user, settings, notify, onClose, onScheduled }) {
  const senderRole = String(user?.role || '').toLowerCase();
  const allowed = canCallStaffMeeting(senderRole);

  const [form, setForm] = useState({
    title: 'Staff Meeting',
    date: '',
    time: '',
    venue: 'Staffroom',
    audience: 'teachers',
    agenda: '',
  });
  const [saving, setSaving] = useState(false);

  const up = (patch) => setForm((f) => ({ ...f, ...patch }));

  const roleLabel = senderRole === 'principal'
    ? 'Principal'
    : senderRole === 'deputy_academic'
      ? 'Deputy Principal (Academics)'
      : senderRole === 'deputy_admin'
        ? 'Deputy Principal (Administration)'
        : user?.role || 'Administration';

  const submit = async () => {
    if (!allowed) return notify('Only the principal or a deputy can call a staff meeting.', 'error');
    if (!form.date || !form.time) return notify('Please set a date and time.', 'warning');
    if (!form.title.trim()) return notify('Please give the meeting a title.', 'warning');

    setSaving(true);
    const when = `${form.date}T${form.time}:00`;
    const pretty = new Date(when).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
    const id = `staffmeet_${Date.now()}`;

    try {
      // The alert teachers actually see.
      await upsertRow('notifications', {
        id,
        title: `${form.title} — ${pretty}`,
        message: `${roleLabel} has called a staff meeting: ${pretty}, ${form.venue}.`,
        body:
          `${roleLabel} has called a staff meeting.\n\n` +
          `When: ${pretty}\nVenue: ${form.venue}\n\n` +
          (form.agenda.trim() ? `Agenda:\n${form.agenda.trim()}` : 'No agenda circulated.'),
        posted_by: user?.name || roleLabel,
        role: senderRole,
        audience: [form.audience],
        read: false,
        created_at: new Date().toISOString(),
      });

      // Best-effort calendar entry — the alert is the important part.
      try {
        await upsertRow('calendarEvents', {
          id: `${id}_cal`,
          title: form.title,
          date: form.date,
          time: form.time,
          type: 'Staff Meeting',
          venue: form.venue,
          desc: form.agenda?.slice(0, 240) || `Called by ${roleLabel}`,
        });
      } catch { /* calendar is optional */ }

      notify(
        `Staff meeting scheduled — ${AUDIENCES.find((a) => a.id === form.audience)?.label.toLowerCase()} alerted.`,
        'success',
        'Staff Meeting'
      );
      onScheduled?.({ id, ...form, when });
      onClose();
    } catch (e) {
      notify(`Could not schedule the meeting: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <Modal title="Schedule Staff Meeting" onClose={onClose}
        footer={<button className="btn" onClick={onClose}>Close</button>}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="#DC2626" />
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Not available for your role</p>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Staff meetings can only be called by the principal or a deputy principal.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Schedule Staff Meeting"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Sending…' : 'Schedule & alert staff'}
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginTop: 0, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Users size={15} /> Sending as <strong style={{ color: '#32475C' }}>{roleLabel}</strong>.
        Everyone in the chosen audience gets an alert immediately.
      </p>

      <div className="grid grid-2" style={{ gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Meeting title</label>
          <input className="input" value={form.title} onChange={(e) => up({ title: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Date</label>
          <input className="input" type="date" value={form.date} onChange={(e) => up({ date: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Time</label>
          <input className="input" type="time" value={form.time} onChange={(e) => up({ time: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Venue</label>
          <input className="input" value={form.venue} onChange={(e) => up({ venue: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Audience</label>
          <select className="select" value={form.audience} onChange={(e) => up({ audience: e.target.value })}>
            {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Agenda (optional)</label>
          <textarea
            className="input"
            rows={4}
            placeholder={'1. Exam preparations\n2. Term 2 results review'}
            value={form.agenda}
            onChange={(e) => up({ agenda: e.target.value })}
          />
        </div>
      </div>

      <div style={{
        marginTop: 14, padding: '10px 12px', borderRadius: 8,
        background: 'rgba(4,120,87,0.08)', fontSize: 12, color: '#32475C',
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <CalendarDays size={15} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span>
          {settings?.name || 'The school'} calendar will show this meeting, and the alert
          appears in each recipient's notices.
        </span>
      </div>
    </Modal>
  );
}
