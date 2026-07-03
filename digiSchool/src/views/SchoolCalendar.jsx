import { Calendar, ExternalLink } from 'lucide-react';

export default function SchoolCalendar({ store, user }) {
  const { settings } = store;
  const calendarUrl = settings?.googleCalendarUrl || '';
  
  // No longer fetching broken localEvents table. Only relying on Google Calendar as requested.

  return (
    <div className="card card-pad" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>School Calendar</h2>
        {calendarUrl && (
          <a href={calendarUrl} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ gap: 4 }}>
            <ExternalLink size={14} /> Open in Google Calendar
          </a>
        )}
      </div>

      {calendarUrl ? (
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          <iframe 
            src={calendarUrl} 
            style={{ border: 0, width: '100%', height: '100%' }} 
            frameBorder="0" 
            scrolling="no"
            title="School Calendar"
          ></iframe>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', borderRadius: 8 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <h3 style={{ marginBottom: 8 }}>No Calendar Configured</h3>
          <p className="muted" style={{ maxWidth: 400, textAlign: 'center', marginBottom: 24 }}>
            The school administrator needs to integrate a Google Calendar in the Settings panel for it to appear here.
          </p>
          {user && ['principal', 'deputy_admin'].includes(user.role) && (
            <button className="btn btn-primary" onClick={() => store.navigate('settings')}>
              Go to Settings
            </button>
          )}
        </div>
      )}
    </div>
  );
}
