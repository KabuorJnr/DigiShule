import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { fetchTable, upsertRow } from '../lib/api';
import Modal from '../components/Modal';

// Helper to get days in a month
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function SchoolCalendar({ store, user }) {
  const { notify } = store;
  const isAdmin = user?.role === 'principal' || user?.role === 'deputy_admin' || user?.role === 'deputy_academic';
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventForm, setEventForm] = useState({ title: '', description: '' });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await fetchTable('calendarEvents');
      setEvents(data || []);
    } catch (e) {
      notify(`Failed to load calendar events: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  const openAddModal = (dateStr) => {
    setSelectedDate(dateStr);
    setEventForm({ title: '', description: '' });
    setAddModalOpen(true);
  };

  const saveEvent = async () => {
    if (!eventForm.title.trim()) {
      notify('Event title is required', 'error');
      return;
    }
    
    const newEvent = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      date: selectedDate
    };

    try {
      const saved = await upsertRow('calendarEvents', newEvent);
      // Wait, upsertRow returns the saved row if it uses the REST API or we can just reload
      await loadEvents();
      setAddModalOpen(false);
      notify('Event added to calendar', 'success');
    } catch (e) {
      notify(`Could not save event: ${e.message}`, 'error');
    }
  };

  // Calendar Grid Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Create grid cells
  const cells = [];
  
  // Empty cells for days before the 1st
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
  }
  
  // Cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    // Format YYYY-MM-DD
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if it's today
    const isToday = new Date().toDateString() === dateObj.toDateString();
    
    // Find events for this day
    const dayEvents = events.filter(e => e.date === dateStr);
    
    cells.push(
      <div 
        key={day} 
        className={`calendar-cell ${isToday ? 'today' : ''}`}
        onClick={() => isAdmin && openAddModal(dateStr)}
      >
        <div className="cell-header">
          <span className="day-number">{day}</span>
        </div>
        <div className="cell-events">
          {dayEvents.map(ev => (
            <div key={ev.id} className="calendar-event" title={ev.description}>
              {ev.title}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={20} />
          {monthNames[month]} {year}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {loading && <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>Syncing...</span>}
          <button className="btn btn-sm" onClick={goToday}>Today</button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-icon btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <button className="btn btn-icon btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="calendar-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div className="calendar-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f9fa', borderBottom: '1px solid var(--border)' }}>
          {dayNames.map(d => (
            <div key={d} style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}
        </div>
        <div className="calendar-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', background: 'var(--border)', gap: 1 }}>
          {cells}
        </div>
      </div>

      {addModalOpen && (
        <Modal 
          title="Add Calendar Event" 
          onClose={() => setAddModalOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setAddModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEvent}>Save Event</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Date</label>
              <input type="date" className="input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Event Title *</label>
              <input 
                className="input" 
                placeholder="e.g. Science Fair" 
                value={eventForm.title} 
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                autoFocus 
              />
            </div>
            <div>
              <label className="field-label">Description (Optional)</label>
              <textarea 
                className="input" 
                placeholder="Details about the event..." 
                value={eventForm.description} 
                onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        .calendar-cell {
          background: #fff;
          padding: 8px;
          cursor: ${isAdmin ? 'pointer' : 'default'};
          transition: background 0.2s;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .calendar-cell:hover {
          background: #f1f5f9;
        }
        .calendar-cell.empty {
          background: #f8f9fa;
          cursor: default;
        }
        .calendar-cell.empty:hover {
          background: #f8f9fa;
        }
        .calendar-cell.today .day-number {
          background: var(--primary);
          color: #fff;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .cell-header {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 4px;
        }
        .day-number {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
        }
        .cell-events {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
        }
        .cell-events::-webkit-scrollbar {
          width: 4px;
        }
        .cell-events::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 4px;
        }
        .calendar-event {
          font-size: 11px;
          background: #e0f2fe;
          color: #0369a1;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
