import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import './App.css';
import { supabase } from './lib/supabaseClient';
import * as api from './lib/api';
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
import CreateExam from './views/CreateExam';

const VIEW_MAP = {
  overview: Overview,
  timetable: Timetable,
  exams: ExamSchedules,
  create_exam: CreateExam,
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
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState(null); // set on login
  const [dataLoading, setDataLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Domain state (loaded from Supabase after sign-in)
  const [settings, setSettings] = useState({});
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [examSchedules, setExamSchedules] = useState([]);
  const [venues, setVenues] = useState([]);
  const [gradeBoundaries, setGradeBoundaries] = useState([]);
  const [feeStructure, setFeeStructure] = useState([]);
  const [notifToggles, setNotifToggles] = useState({});
  const [timetables, setTimetables] = useState({});

  // Refs mirror the latest state so wrapped setters can compute the next value
  // outside React's updater and persist it without double-firing under StrictMode.
  const settingsRef = useRef(settings);
  const feeRef = useRef(feeStructure);
  const boundsRef = useRef(gradeBoundaries);
  const togglesRef = useRef(notifToggles);
  const venuesRef = useRef(venues);
  const studentsRef = useRef(students);
  const examsRef = useRef(examSchedules);
  const timetablesRef = useRef(timetables);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { feeRef.current = feeStructure; }, [feeStructure]);
  useEffect(() => { boundsRef.current = gradeBoundaries; }, [gradeBoundaries]);
  useEffect(() => { togglesRef.current = notifToggles; }, [notifToggles]);
  useEffect(() => { venuesRef.current = venues; }, [venues]);
  useEffect(() => { studentsRef.current = students; }, [students]);
  useEffect(() => { examsRef.current = examSchedules; }, [examSchedules]);
  useEffect(() => { timetablesRef.current = timetables; }, [timetables]);

  const notify = useCallback((message, type = 'success', title) => {
    const id = ++toastId;
    const defaultTitles = { success: 'Success', error: 'Error', info: 'Notice', warning: 'Warning' };
    setToasts((t) => [...t, { id, message, type, title: title || defaultTitles[type] }]);
    setTimeout(() => { setToasts((t) => t.filter((x) => x.id !== id)); }, 3000);
  }, []);

  const onSaveError = useCallback((e) => notify(`Save failed: ${e.message || e}`, 'error'), [notify]);

  // Resolve an updater (value or function) against the latest ref value.
  const resolve = (updater, current) => (typeof updater === 'function' ? updater(current) : updater);

  // ---- Persisted store setters ----
  const setSettingsP = useCallback((u) => {
    const next = resolve(u, settingsRef.current); settingsRef.current = next; setSettings(next);
    api.saveConfig({ settings: next }).catch(onSaveError);
  }, [onSaveError]);
  const setFeeP = useCallback((u) => {
    const next = resolve(u, feeRef.current); feeRef.current = next; setFeeStructure(next);
    api.saveConfig({ feeStructure: next }).catch(onSaveError);
  }, [onSaveError]);
  const setBoundsP = useCallback((u) => {
    const next = resolve(u, boundsRef.current); boundsRef.current = next; setGradeBoundaries(next);
    api.saveConfig({ gradeBoundaries: next }).catch(onSaveError);
  }, [onSaveError]);
  const setTogglesP = useCallback((u) => {
    const next = resolve(u, togglesRef.current); togglesRef.current = next; setNotifToggles(next);
    api.saveConfig({ notifToggles: next }).catch(onSaveError);
  }, [onSaveError]);
  const setVenuesP = useCallback((u) => {
    const next = resolve(u, venuesRef.current); venuesRef.current = next; setVenues(next);
    api.saveConfig({ venues: next }).catch(onSaveError);
  }, [onSaveError]);
  const setExamsP = useCallback((u) => {
    const next = resolve(u, examsRef.current); examsRef.current = next; setExamSchedules(next);
    api.replaceAllExams(next).catch(onSaveError);
  }, [onSaveError]);
  const setTimetablesP = useCallback((u) => {
    const next = resolve(u, timetablesRef.current); timetablesRef.current = next; setTimetables(next);
    api.saveTimetables(next, settingsRef.current.currentTerm).catch(onSaveError);
  }, [onSaveError]);
  // Single-student persistence (gradebook edits one row at a time).
  const updateStudent = useCallback((student) => {
    setStudents((prev) => prev.map((s) => (s.id === student.id ? student : s)));
    api.upsertStudent(student).catch(onSaveError);
  }, [onSaveError]);

  const markRead = (id) => {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.setNotificationRead(id, true).catch(onSaveError);
  };
  const markAllRead = () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    api.markAllNotificationsRead().catch(onSaveError);
  };
  const unreadCount = notifications.filter((n) => !n.read).length;

  const store = useMemo(
    () => ({
      settings, setSettings: setSettingsP,
      students, setStudents, updateStudent,
      teachers, setTeachers,
      examSchedules, setExamSchedules: setExamsP,
      venues, setVenues: setVenuesP,
      gradeBoundaries, setGradeBoundaries: setBoundsP,
      feeStructure, setFeeStructure: setFeeP,
      notifToggles, setNotifToggles: setTogglesP,
      timetables, setTimetables: setTimetablesP,
      notify,
      navigate: setView,
    }),
    [settings, students, teachers, examSchedules, venues, gradeBoundaries, feeStructure, notifToggles, timetables, notify,
      setSettingsP, setExamsP, setVenuesP, setBoundsP, setFeeP, setTogglesP, setTimetablesP, updateStudent]
  );

  // ---- Load all domain data after a user is known ----
  const loadAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [cfg, st, tch, ex, tt, notifs] = await Promise.all([
        api.fetchConfig(),
        api.fetchStudents(),
        api.fetchTeachers(),
        api.fetchExamSchedules(),
        api.fetchTimetables(),
        api.fetchTable('notifications'),
      ]);
      setSettings(cfg.settings); setGradeBoundaries(cfg.gradeBoundaries);
      setFeeStructure(cfg.feeStructure); setNotifToggles(cfg.notifToggles);
      setVenues(cfg.venues);
      setStudents(st); setTeachers(tch); setExamSchedules(ex); setTimetables(tt);
      setNotifications(notifs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
    } catch (e) {
      notify(`Failed to load data: ${e.message || e}`, 'error');
    } finally {
      setDataLoading(false);
    }
  }, [notify]);

  const loadUser = useCallback(async (userId, greet) => {
    try {
      const profile = await api.fetchProfile(userId);
      setCurrentUser(profile);
      setView(ROLES[profile.role]?.home || 'overview');
      if (greet) notify(`Welcome, ${profile.name}`, 'success', 'Signed In');
      await loadAllData();
    } catch (e) {
      notify(`Could not load your account: ${e.message || e}`, 'error');
      await supabase.auth.signOut();
    } finally {
      setAuthChecked(true);
    }
  }, [loadAllData, notify]);

  // ---- Auth bootstrap ----
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session?.user) {
        loadUser(session.user.id, event === 'SIGNED_IN');
      } else {
        setCurrentUser(null);
        setView(null);
        setAuthChecked(true);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    notify('You have been logged out.', 'info', 'Logout');
  };

  // ---- Splash while we check the session ----
  if (!authChecked) {
    return (
      <div className="layout" style={{ placeItems: 'center', display: 'grid', minHeight: '100vh' }}>
        <div className="muted">Loading EduOne…</div>
      </div>
    );
  }

  // ---- If not logged in, show Login ----
  if (!currentUser) {
    return (
      <>
        <Login />
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
            {settings.logo ? <img src={settings.logo} alt="logo" /> : <img src="/logo.png" alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
          </div>
          {!collapsed && (
            <div className="brand-text">
              <strong>EduOne</strong>
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
          {dataLoading ? (
            <p className="muted">Loading…</p>
          ) : ViewComponent ? (
            <ViewComponent store={store} user={currentUser} />
          ) : (
            <p>View not found.</p>
          )}
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
