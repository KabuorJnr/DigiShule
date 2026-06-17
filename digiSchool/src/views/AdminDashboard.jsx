import { useState, useEffect } from 'react';
import { Badge } from '../components/widgets';
import { STAFF, FACILITIES, DISCIPLINARY_RECORDS } from '../data/modules';
import { LEAVE_REQUESTS } from '../data/seed';

function Stat({ label, value, color, sub }) {
  return (
    <div className="card card-pad">
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a', marginBottom: 2 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboard({ store }) {
  const { navigate, notify } = store;

  const presentStaff = STAFF.filter(s => s.status === 'Present').length;
  const onLeaveStaff = STAFF.filter(s => s.status === 'On Leave').length;
  const operationalFac = FACILITIES.filter(f => f.status === 'Operational').length;
  const pendingLeave = LEAVE_REQUESTS.filter(l => l.status === 'Pending').length;
  const openDiscipline = DISCIPLINARY_RECORDS.filter(d => d.status === 'Open').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#d1fae5', color: '#0f766e', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏛️</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Deputy Admin Dashboard</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Administration overview and management</p>
        </div>
      </div>

      <div style={{ background: '#0f766e', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 28, background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}>🏛️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Administration Office</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
              Role: Deputy Administration | Student Affairs & Facilities<br />
              Managing discipline, boarding, facilities, and staff welfare
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div style={{ marginBottom: 4 }}>📅 {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div>🏫 Term: Term 2</div>
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
        <Stat label="Total Staff" value={STAFF.length} sub={`${presentStaff} present today`} color="#0f766e" />
        <Stat label="Leave Requests" value={pendingLeave} sub="Pending approval" color="#F59E0B" />
        <Stat label="Discipline Cases" value={openDiscipline} sub="Open cases" color="#EF4444" />
        <Stat label="Facilities" value={`${operationalFac}/${FACILITIES.length}`} sub="Operational" color="#10B981" />
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        {/* Student Affairs */}
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#0f766e', display: 'flex', alignItems: 'center', gap: 8 }}>
            🎓 Student Affairs
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('admissions')}>
              👥 All Students
            </button>
            <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('admissions')}>
              🏠 Boarding Management
            </button>
            <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('admissions')}>
              ⚖️ Discipline Records
              {openDiscipline > 0 && <Badge color="red" style={{ marginLeft: 'auto' }}>{openDiscipline} open</Badge>}
            </button>
          </div>
        </div>

        {/* Facilities */}
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#0f766e', display: 'flex', alignItems: 'center', gap: 8 }}>
            🏛️ Facilities Overview
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FACILITIES.slice(0, 5).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{f.type} • Capacity: {f.capacity}</div>
                </div>
                <Badge color={f.status === 'Operational' ? 'green' : 'amber'}>{f.status}</Badge>
              </div>
            ))}
            <button className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => navigate('facilities')}>
              View All Facilities →
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        {/* Recent Discipline */}
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#0f766e' }}>📋 Recent Discipline Cases</h3>
          {DISCIPLINARY_RECORDS.slice(0, 4).map(d => (
            <div key={d.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.student} — {d.category}</div>
                <div className="muted" style={{ fontSize: 12 }}>{d.description}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{d.date} • {d.class}</div>
              </div>
              <Badge color={d.status === 'Open' ? 'red' : 'green'}>{d.status}</Badge>
            </div>
          ))}
        </div>

        {/* Leave Requests */}
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#0f766e' }}>📋 Pending Leave Requests</h3>
          {LEAVE_REQUESTS.filter(l => l.status === 'Pending').map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{l.staff} — {l.type} Leave</div>
                <div className="muted" style={{ fontSize: 12 }}>{l.start} to {l.end} ({l.days} day{l.days > 1 ? 's' : ''})</div>
                <div className="muted" style={{ fontSize: 11 }}>{l.reason}</div>
              </div>
              <Badge color="amber">Pending</Badge>
            </div>
          ))}
          {LEAVE_REQUESTS.filter(l => l.status === 'Pending').length === 0 && (
            <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No pending requests</p>
          )}
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('staff')}>
            Manage Leave →
          </button>
        </div>
      </div>

      {/* Quick Access */}
      <div className="card card-pad">
        <h3 className="section-title" style={{ color: '#0f766e' }}>⚡ Quick Access</h3>
        <div className="grid grid-4" style={{ gap: 12 }}>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('staff')}>👥 Staff Attendance</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('facilities')}>🏛️ Facilities</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('admissions')}>🎓 Student Records</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('settings')}>⚙️ Settings</button>
        </div>
      </div>
    </div>
  );
}
