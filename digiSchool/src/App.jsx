import { useState, useCallback, useMemo } from 'react';
import './App.css';
import {
  buildStudents,
  buildExamSchedules,
  DEFAULT_SETTINGS,
  DEFAULT_GRADE_BOUNDARIES,
  DEFAULT_FEE_STRUCTURE,
  DEFAULT_NOTIF_TOGGLES,
  DEFAULT_VENUES,
  SEED_NOTIFICATIONS,
  TEACHERS,
} from './data/seed';
import { ROLES } from './data/users';
import Login from './views/Login';
import Overview from './views/Overview';
import Timetable from './views/Timetable';
import ExamSchedules from './views/ExamSchedules';
import Gradebook from './views/Gradebook';
import Settings from './views/Settings';
import Library from './views/Library';
import Finance from './views/Finance';
import Admissions from './views/Admissions';
import Clinic from './views/Clinic';
import StaffAttendance from './views/StaffAttendance';
import Facilities from './views/Facilities';
import TeacherPortal from './views/TeacherPortal';
import StudentPortal from './views/StudentPortal';
import ParentPortal from './views/ParentPortal';

const VIEW_MAP = {
  overview: Overview,
  timetable: Timetable,
  exams: ExamSchedules,
  gradebook: Gradebook,
  settings: Settings,
  library: Library,
  finance: Finance,
  admissions: Admissions,
  clinic: Clinic,
  staff: StaffAttendance,
  facilities: Facilities,
  teacher: TeacherPortal,
  student: StudentPortal,
  parent: ParentPortal,
};

let toastId = 0;

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState(null); // set on login
  const [collapsed, setCollapsed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(SEED_NOTIFICATIONS);

  // Domain state
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [students, setStudents] = useState(() => buildStudents());
  const [teachers, setTeachers] = useState(TEACHERS);
  const [examSchedules, setExamSchedules] = useState(() => buildExamSchedules());
  const [venues, setVenues] = useState(DEFAULT_VENUES);
  const [gradeBoundaries, setGradeBoundaries] = useState(DEFAULT_GRADE_BOUNDARIES);
  const [feeStructure, setFeeStructure] = useState(DEFAULT_FEE_STRUCTURE);
  const [notifToggles, setNotifToggles] = useState(DEFAULT_NOTIF_TOGGLES);
  const [timetables, setTimetables] = useState({});

  const notify = useCallback((message, type = 'success', title) => {
    const id = ++toastId;
    const defaultTitles = { success: 'Success', error: 'Error', info: 'Notice', warning: 'Warning' };
    setToasts((t) => [...t, { id, message, type, title: title || defaultTitles[type] }]);
    setTimeout(() => { setToasts((t) => t.filter((x) => x.id !== id)); }, 3000);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const markRead = (id) => setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllRead = () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));

  const store = useMemo(
    () => ({
      settings, setSettings,
      students, setStudents,
      teachers, setTeachers,
      examSchedules, setExamSchedules,
      venues, setVenues,
      gradeBoundaries, setGradeBoundaries,
      feeStructure, setFeeStructure,
      notifToggles, setNotifToggles,
      timetables, setTimetables,
      notify,
      navigate: setView,
    }),
    [settings, students, teachers, examSchedules, venues, gradeBoundaries, feeStructure, notifToggles, timetables, notify]
  );

  // ---- Auth handlers ----
  const handleLogin = (user) => {
    setCurrentUser(user);
    const role = ROLES[user.role];
    setView(role?.home || 'overview');
    notify(`Welcome, ${user.name}`, 'success', 'Signed In');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView(null);
    notify('You have been logged out.', 'info', 'Logout');
  };

  // ---- If not logged in, show Login ----
  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} />
        {/* Toasts render even on login page */}
        <div className="toast-wrap">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              <span style={{ fontSize: 16 }}>
                {t.type === 'success' ? '✅' : t.type === 'error' ? '⛔' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <div>
                <div className="toast-title">{t.title}</div>
                <div className="toast-msg">{t.message}</div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ---- Logged-in shell ----
  const role = ROLES[currentUser.role] || ROLES.principal;
  const nav = role.nav;
  const activeView = view || role.home;

  // Resolve component
  const ViewComponent = VIEW_MAP[activeView];

  // Initials for avatar
  const initials = currentUser.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="logo-box">
            {settings.logo ? <img src={settings.logo} alt="logo" /> : <span>WS</span>}
          </div>
          {!collapsed && (
            <div className="brand-text">
              <strong>DigiShule</strong>
              <span className="muted">{role.portal}</span>
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item${activeView === item.id ? ' active' : ''}`}
              onClick={() => setView(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '»' : '« Collapse'}
        </button>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{settings.name}</div>
          <div className="topbar-actions">
            <button className="bell" onClick={() => setNotifOpen(true)} aria-label="Notifications">
              🔔{unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
            </button>
            <div className="avatar" title={currentUser.name}>{initials}</div>
            <div className="user-meta">
              <span className="principal-name">{currentUser.name}</span>
              <span className="user-role">{role.label}</span>
            </div>
            <button className="btn btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <main className="content">
          {ViewComponent ? <ViewComponent store={store} user={currentUser} /> : <p>View not found.</p>}
        </main>
      </div>

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span style={{ fontSize: 16 }}>
              {t.type === 'success' ? '✅' : t.type === 'error' ? '⛔' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div>
              <div className="toast-title">{t.title}</div>
              <div className="toast-msg">{t.message}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Notifications panel */}
      {notifOpen && (
        <>
          <div className="modal-overlay" style={{ background: 'rgba(15,23,42,0.3)' }} onMouseDown={() => setNotifOpen(false)} />
          <div className="notif-panel">
            <div className="modal-header">
              <h3>Notifications {unreadCount > 0 && <span className="badge badge-red">{unreadCount} new</span>}</h3>
              <button className="btn btn-icon btn-sm" onClick={() => setNotifOpen(false)}>✕</button>
            </div>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <button className="btn btn-sm" onClick={markAllRead} disabled={unreadCount === 0}>Mark all as read</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.map((n) => (
                <div key={n.id} className="notif-item" style={{ background: n.read ? '#fff' : '#f0f6ff' }} onClick={() => markRead(n.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{n.title}</strong>
                    {!n.read && <span className="dot" />}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{n.body}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{n.time}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
