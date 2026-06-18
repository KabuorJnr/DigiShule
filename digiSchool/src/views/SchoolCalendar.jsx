import { useState } from 'react';
import { UPCOMING_EVENTS } from '../data/seed';
import { Badge } from '../components/widgets';
import { Calendar, ExternalLink, Plus } from 'lucide-react';
import Modal from '../components/Modal';

const TYPE_COLOR = { academic: 'blue', exam: 'red', event: 'green', holiday: 'amber', meeting: 'purple' };
const TYPE_BG   = { academic: '#e8f0fe', exam: '#fee2e2', event: '#dcfce7', holiday: '#fef3c7', meeting: '#f3e8ff' };
const TYPE_TEXT = { academic: '#0078D4', exam: '#D13438', event: '#107C10', holiday: '#92400e', meeting: '#7C3AED' };

function makeGoogleCalLink({ title, desc, date, location }) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  return `${base}&text=${encodeURIComponent(title)}&details=${encodeURIComponent(desc || '')}&location=${encodeURIComponent(location || '')}`;
}

export default function SchoolCalendar({ store, user }) {
  const { settings, notify } = store;
  const calendarUrl = settings?.googleCalendarUrl || '';
  const location = settings?.name || 'School';

  const [localEvents, setLocalEvents] = useState(UPCOMING_EVENTS);
  const [addModal, setAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', desc: '', date: '', type: 'academic' });

  const canAdd = user && ['principal', 'deputy_academic', 'deputy_admin'].includes(user.role);

  const handleAdd = () => {
    if (!newEvent.title.trim() || !newEvent.date.trim()) { notify('Title and date are required', 'warning'); return; }
    const ev = { id: `ev${Date.now()}`, ...newEvent };
    setLocalEvents(prev => [...prev, ev].sort((a, b) => a.date.localeCompare(b.date)));
    setAddModal(false);
    setNewEvent({ title: '', desc: '', date: '', type: 'academic' });
    notify('Event added to calendar', 'success', 'Calendar');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={22} /> School Calendar</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Academic events, exams, and term dates</p>
        </div>
        {canAdd && <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setAddModal(true)}><Plus size={16} /> Add Event</button>}
      </div>

      {/* Google Calendar Embed */}
      {calendarUrl ? (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Live Google Calendar</h3>
            <a href={calendarUrl} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ gap: 4 }}>
              <ExternalLink size={14} /> Open in Google
            </a>
          </div>
          <iframe
            src={calendarUrl}
            style={{ border: 'none', width: '100%', height: 500, borderRadius: 8 }}
            title="School Google Calendar"
          />
        </div>
      ) : (
        <div className="card card-pad" style={{ marginBottom: 20, border: '2px dashed var(--border)', textAlign: 'center', padding: 32 }}>
          <Calendar size={40} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No Google Calendar connected</p>
          <p className="muted" style={{ margin: '4px 0 12px', fontSize: 13 }}>
            Admins can connect the school's public Google Calendar in Settings → Calendar.
          </p>
          {canAdd && (
            <button className="btn btn-sm" onClick={() => store.navigate('settings')}>Go to Settings →</button>
          )}
        </div>
      )}

      {/* Local Events List */}
      <div className="card card-pad">
        <h3 className="section-title">Upcoming School Events</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {localEvents.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 10, background: TYPE_BG[e.type] || '#f0f9ff', color: TYPE_TEXT[e.type] || '#0078D4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: 12 }}>
                <div style={{ fontSize: 15 }}>{e.date?.split(' ')?.[1] || '—'}</div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.8 }}>{e.date?.split(' ')?.[0] || ''}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{e.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge color={TYPE_COLOR[e.type] || 'gray'}>{e.type}</Badge>
                <a
                  href={makeGoogleCalLink({ title: e.title, desc: e.desc, date: e.date, location })}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                  style={{ gap: 4, textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  title="Add to Google Calendar"
                >
                  <ExternalLink size={13} /> Add to Calendar
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Event Modal */}
      {addModal && (
        <Modal title="Add School Event" onClose={() => setAddModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd}>Add Event</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Event Title *</label>
              <input className="input" placeholder="e.g. Sports Day" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Description</label>
              <textarea className="input" rows={3} value={newEvent.desc} onChange={e => setNewEvent(p => ({ ...p, desc: e.target.value }))} />
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Date *</label>
                <input type="date" className="input" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Type</label>
                <select className="select" value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}>
                  <option value="academic">Academic</option>
                  <option value="exam">Exam</option>
                  <option value="event">Event</option>
                  <option value="holiday">Holiday</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
