import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import './App.css';
import { supabase, signOutAll } from './lib/supabaseClient';
import * as api from './lib/api';
import { setActiveSchoolId } from './lib/api';
import { ROLES } from './data/users';

import { Icon, NAV_ICON_MAP } from './components/icons';
import { ChevronDown, ChevronRight, Bell, PanelLeftClose, PanelLeft, Building2, Landmark, LogOut, Key } from 'lucide-react';

import LandingPage from './views/LandingPage';
import Login from './views/Login';
import PublicApplication from './views/PublicApplication';
import SignupWizard from './views/SignupWizard';
import ParentSignupWizard from './views/ParentSignupWizard';
import SetupWizard from './views/SetupWizard';
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
import TeacherResources from './views/TeacherResources';
import ClassTeachers from './views/ClassTeachers';
import StudentPortal from './views/StudentPortal';
import ParentPortal from './views/ParentPortal';
import CreateExam from './views/CreateExam';
import AcademicsDashboard from './views/AcademicsDashboard';
import AdminDashboard from './views/AdminDashboard';
import Notices from './views/Notices';
import SchoolCalendar from './views/SchoolCalendar';
import Registrar from './views/Registrar';
import DeveloperPortal from './views/DeveloperPortal';
import ChangePasswordModal from './components/ChangePasswordModal';
import SelectProfile from './views/SelectProfile';

const VIEW_MAP = {
  developer_portal: DeveloperPortal,
  overview: Overview,
  timetable: Timetable,
  exams: ExamSchedules,
  create_exam: CreateExam,
  academics_dashboard: AcademicsDashboard,
  admin_dashboard: AdminDashboard,
  gradebook: Gradebook,
  settings: Settings,
  library: Library,
  finance: Finance,
  finance_dashboard: Finance,
  admissions: Admissions,
  clinic: Clinic,
  staff: StaffAttendance,
  facilities: Facilities,
  teacher: TeacherPortal,
  student: StudentPortal,
  parent: ParentPortal,
  class_teachers: ClassTeachers,
  notices: Notices,
  school_calendar: SchoolCalendar,
  teacher_resources: TeacherResources,
  registrar: Registrar,
  select_profile: SelectProfile,
};

let toastId = 0;

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showParentSignup, setShowParentSignup] = useState(false);
  const [showApplication, setShowApplication] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [view, setView] = useState(null); // set on login
  const [viewParams, setViewParams] = useState({}); // Stores tab, action, filters from sidebar
  const [dataLoading, setDataLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedNav, setExpandedNav] = useState({});
  const [toasts, setToasts] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [officeVisitWarning, setOfficeVisitWarning] = useState(null);
  const [activeRoleOverride, setActiveRoleOverride] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Domain state (loaded from Supabase after sign-in)
  const [settings, setSettings] = useState({});
  const [schoolId, setSchoolId] = useState(() => localStorage.getItem('eduone_school_id') || null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [examSchedules, setExamSchedules] = useState([]);
  const [venues, setVenues] = useState([]);
  const [gradeBoundaries, setGradeBoundaries] = useState([]);
  const [feeStructure, setFeeStructure] = useState([]);
  const [notifToggles, setNotifToggles] = useState({});
  const [timetables, setTimetables] = useState({});

  const [needsSetup, setNeedsSetup] = useState(() => !localStorage.getItem('eduone_school_config'));

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

  const updateTeacher = useCallback((id, patch) => {
    setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    api.updateTeacher(id, patch).catch(onSaveError);
  }, [onSaveError]);

  const addTeacher = useCallback((teacher) => {
    setTeachers((prev) => [...prev, teacher]);
    api.upsertTeacher(teacher).catch(onSaveError);
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
      schoolId,
      students, setStudents, updateStudent,
      teachers, setTeachers, updateTeacher, addTeacher,
      examSchedules, setExamSchedules: setExamsP,
      venues, setVenues: setVenuesP,
      gradeBoundaries, setGradeBoundaries: setBoundsP,
      feeStructure, setFeeStructure: setFeeP,
      notifToggles, setNotifToggles: setTogglesP,
      timetables, setTimetables: setTimetablesP,
      notifications, setNotifications,
      notify,
      navigate: (v, p = {}) => { setViewParams(p); setView(v); },
      removeToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    }),
    [settings, schoolId, students, teachers, examSchedules, venues, gradeBoundaries, feeStructure, notifToggles, timetables, notifications, notify,
      setSettingsP, setExamsP, setVenuesP, setBoundsP, setFeeP, setTogglesP, setTimetablesP, updateStudent, updateTeacher, addTeacher]
  );

  // ---- Load all domain data after a user is known ----
  const loadAllData = useCallback(async (background = false) => {
    if (!background) setDataLoading(true);
    try {
      // ── Real mode: fetch from Supabase ──
      const [cfg, ex, tt, notifs, st, tch] = await Promise.all([
        api.fetchConfig(),
        api.fetchExamSchedules(),
        api.fetchTimetables(),
        api.fetchTable('notifications'),
        api.fetchAllStudentsUnpaginated(),
        api.fetchTeachers()
      ]);
      setSettings(cfg.settings); setGradeBoundaries(cfg.gradeBoundaries);
      setFeeStructure(cfg.feeStructure); setNotifToggles(cfg.notifToggles);
      setVenues(cfg.venues);
      setExamSchedules(ex); setTimetables(tt);
      setStudents(st || []);
      setTeachers(tch || []);
      setNotifications((notifs || []).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
    } catch (e) {
      notify(`Failed to load data: ${e.message || e}`, 'error');
    } finally {
      if (!background) setDataLoading(false);
    }
  }, [notify]);

  const handleSelectProfile = useCallback(async (profile, greet = true) => {
    const sid = profile.school_id || profile.schoolId || localStorage.getItem('eduone_school_id');
    if (sid) {
      setActiveSchoolId(sid);
      setSchoolId(sid);
      localStorage.setItem('eduone_school_id', sid);
    }
    setCurrentUser(profile);
    setView(ROLES[profile.role]?.home || 'overview');
    if (greet) notify(`Welcome, ${profile.name}`, 'success', 'Signed In');
    await loadAllData();
  }, [loadAllData, notify]);

  const loadUser = useCallback(async (userId, greet) => {
    try {
      const profiles = await api.fetchProfiles(userId);
      if (!profiles || profiles.length === 0) throw new Error("No profile");
      
      if (profiles.length === 1) {
        await handleSelectProfile(profiles[0], greet);
      } else {
        setAvailableProfiles(profiles);
        setView('select_profile');
      }
    } catch {
      // No profile row — silently sign out and show login.
      await supabase.auth.signOut();
    } finally {
      setAuthChecked(true);
    }
  }, [handleSelectProfile]);

  // ---- Auth bootstrap ----
  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (session?.user) {
        loadUser(session.user.id, event === 'SIGNED_IN');
      } else {
        setCurrentUser(null);
        setView('login');
        setAuthChecked(true);
      }
    });

    const handleOnline = () => {
      api.syncOfflineMutations().then(() => {
        console.log('[OfflineSync] Connection restored. Offline mutations synced successfully.');
      }).catch(console.error);
    };
    window.addEventListener('online', handleOnline);

    const handleKeyDown = (e) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const pwd = window.prompt('Developer Mode Authentication:\nEnter Master Password:');
        if (pwd === 'eduone@admin!') {
          setView('developer_portal');
        } else if (pwd !== null) {
          alert('Access Denied: Incorrect Master Password');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loadUser]);

  // ---- Global Realtime Sync ----
  useEffect(() => {
    if (!currentUser) return;
    
    const channel = supabase.channel('global-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        // Refetch all core data when a change occurs to keep state perfectly in sync
        loadAllData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, loadAllData]);

  const handleLogout = async () => {
    await signOutAll();
    setCurrentUser(null);
    setActiveRoleOverride(null);
    setView('login');
    notify('You have been logged out.', 'info', 'Logout');
  };

  // ---- Splash while we check the session ----
  if (!authChecked) {
    return (
      <div className="layout" style={{ placeItems: 'center', display: 'grid', minHeight: '100vh', background: '#0a0a0a', color: '#10B981' }}>
        <div className="muted" style={{ fontFamily: 'monospace' }}>[SYS] Booting EduOne...</div>
      </div>
    );
  }

  if (!currentUser) {
    if (showApplication) {
      return <PublicApplication onBack={() => setShowApplication(false)} />;
    }
    if (showSignup) {
      return <SignupWizard onComplete={() => setShowSignup(false)} onCancel={() => setShowSignup(false)} />;
    }
    if (showParentSignup) {
      return <ParentSignupWizard onComplete={() => setShowParentSignup(false)} onCancel={() => setShowParentSignup(false)} />;
    }
    return (
      <>
        {!showLogin ? (
          <LandingPage 
            onGetStarted={() => setShowLogin(true)} 
            onApply={() => setShowApplication(true)} 
            onSignUp={() => setShowSignup(true)}
          />
        ) : (
          <Login onSignUp={() => setShowParentSignup(true)} />
        )}
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
  const role = ROLES[activeRoleOverride || currentUser.role] || ROLES.principal;
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

  const toggleNav = (id) => setExpandedNav(prev => ({ ...prev, [id]: !prev[id] }));

  const isNavActive = (navItem) => {
    if (activeView !== navItem.view) return false;
    if (navItem.tab && viewParams.tab !== navItem.tab) return false;
    if (navItem.action && viewParams.action !== navItem.action) return false;
    if (navItem.filter && viewParams.filter !== navItem.filter) return false;
    return true;
  };

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
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
              <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, background: '#000000' }}>{initials}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>Logged in as</span>
                <strong style={{ fontSize: 14 }}>{role.label}</strong>
              </div>
            </div>
          )}
          {nav.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: section.section === 'CORE' ? 8 : 16 }}>
              {!collapsed && section.section !== 'CORE' && (
                <div style={{ padding: '0 20px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  {section.section}
                </div>
              )}
              {section.items.map((item) => {
                const hasSub = item.sub && item.sub.length > 0;
                const isExpanded = expandedNav[item.id];
                return (
                  <div key={item.id}>
                    <button
                      className={`nav-item${isNavActive(item) ? ' active' : ''}`}
                      onClick={() => {
                        if (hasSub) toggleNav(item.id);
                        else if (item.action === 'logout') handleLogout();
                        else if (item.action === 'notif') setNotifOpen(true);
                        else if (item.action === 'visit_academics') setOfficeVisitWarning('academics');
                        else if (item.action === 'visit_admin') setOfficeVisitWarning('admin');
                        else if (item.view) {
                          setView(item.view);
                          setViewParams({ tab: item.tab, action: item.action, filter: item.filter });
                        }
                      }}
                      title={item.label}
                    >
                      <span className="nav-icon"><Icon name={NAV_ICON_MAP[item.icon] || item.icon} size={16} fallback={item.icon} /></span>
                      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
                      {!collapsed && hasSub && (isExpanded ? <ChevronDown size={14} style={{ opacity: 0.5 }} /> : <ChevronRight size={14} style={{ opacity: 0.5 }} />)}
                    </button>
                    {!collapsed && hasSub && isExpanded && (
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '4px 0', borderLeft: '2px solid rgba(255,255,255,0.1)', marginLeft: 30, marginTop: 2, marginBottom: 4 }}>
                        {item.sub.map(subItem => (
                          <button
                            key={subItem.id}
                            className={`nav-item${isNavActive(subItem) ? ' active' : ''}`}
                            style={{ padding: '6px 20px 6px 16px', minHeight: 32, fontSize: 13, opacity: isNavActive(subItem) ? 1 : 0.7 }}
                            onClick={() => {
                              if (subItem.action === 'visit_academics') setOfficeVisitWarning('academics');
                              else if (subItem.action === 'visit_admin') setOfficeVisitWarning('admin');
                              else if (subItem.view) {
                                setView(subItem.view);
                                setViewParams({ tab: subItem.tab, action: subItem.action, filter: subItem.filter });
                              }
                            }}
                          >
                            {subItem.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? <PanelLeft size={16} /> : <><PanelLeftClose size={16} /> Collapse</>}
        </button>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{settings.name}</div>
          <div className="topbar-actions">
            {activeRoleOverride && (
              <button 
                className="btn btn-primary" 
                style={{ background: '#D13438', borderColor: '#D13438', marginRight: 16, height: 32, fontSize: 13 }}
                onClick={() => {
                  setActiveRoleOverride(null);
                  setView(ROLES[currentUser.role].home || 'overview');
                  setViewParams({});
                  notify('Returned to Principal Office', 'info', 'Office Visit');
                }}
              >
                Return to Principal Office
              </button>
            )}
            <button className="bell" onClick={() => setNotifOpen(true)} aria-label="Notifications">
              <Bell size={18} />{unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
            </button>
            <div className="avatar" title={currentUser.name}>{initials}</div>
            <div className="user-meta" style={{ marginRight: '16px' }}>
              <span className="principal-name">{currentUser.name}</span>
              <span className="user-role">{role.label}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setChangePasswordOpen(true)} title="Change Password">
                <Key size={14} /> <span className="hide-mobile">Password</span>
              </button>
              <button className="btn btn-sm btn-ghost" onClick={handleLogout} title="Logout" style={{ color: 'var(--danger)' }}>
                <LogOut size={14} /> <span className="hide-mobile">Logout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="content">
          {dataLoading ? (
            <p className="muted">Loading…</p>
          ) : view === 'select_profile' ? (
            <SelectProfile profiles={availableProfiles} onSelect={(p) => handleSelectProfile(p, true)} onLogout={handleLogout} />
          ) : ViewComponent ? (
            <ViewComponent store={store} user={currentUser} params={viewParams} />
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
              {t.type === 'success' ? <Icon name="check" size={16} /> : 
               t.type === 'error' ? <Icon name="close" size={16} /> : 
               t.type === 'warning' ? <Icon name="warning" size={16} /> : 
               <Icon name="info" size={16} />}
            </span>
            <div style={{ flex: 1 }}>
              {t.title && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t.title}</div>}
              <div style={{ fontSize: 13, opacity: 0.9 }}>{t.message}</div>
            </div>
            <button className="btn" style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.7, padding: 4 }} onClick={() => store.removeToast(t.id)}>
              <Icon name="close" size={16} />
            </button>
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

      {/* Office Visit Warning Modal - Academics */}
      {officeVisitWarning === 'academics' && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 450, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#9333ea', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 600 }}>
                <Building2 size={20} /> Deputy Academics Office
              </div>
              <button className="btn btn-icon" style={{ color: '#fff' }} onClick={() => setOfficeVisitWarning(null)}>✕</button>
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Building2 size={40} style={{ color: '#9333ea' }} /></div>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#334155' }}>
                You are about to visit the Deputy Academics Office. This will open the Academics dashboard where you can manage exams, subjects, and academic performance.
              </p>
              <div style={{ background: '#e0f2fe', color: '#0369a1', padding: 12, borderRadius: 6, fontSize: 13, textAlign: 'left', display: 'flex', gap: 8, marginBottom: 24 }}>
                <div style={{ fontWeight: 700 }}>i</div>
                <div><strong>Note:</strong> You can always return to your Principal Dashboard using the sidebar after visiting the office.</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn" onClick={() => setOfficeVisitWarning(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ background: '#000000', borderColor: '#000000' }} onClick={() => {
                  setOfficeVisitWarning(null);
                  setActiveRoleOverride('deputy_academic');
                  setView('academics_dashboard');
                  notify('Entered Deputy Academics Office', 'success', 'Office Visit');
                }}>Continue to Office</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Office Visit Warning Modal - Admin */}
      {officeVisitWarning === 'admin' && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 450, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#0f766e', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 600 }}>
                <Landmark size={20} /> Deputy Administration Office
              </div>
              <button className="btn btn-icon" style={{ color: '#fff' }} onClick={() => setOfficeVisitWarning(null)}>✕</button>
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Landmark size={40} style={{ color: '#0f766e' }} /></div>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#334155' }}>
                You are about to visit the Deputy Administration Office. This will open the Admin dashboard where you can manage student affairs, facilities, and staff welfare.
              </p>
              <div style={{ background: '#d1fae5', color: '#065f46', padding: 12, borderRadius: 6, fontSize: 13, textAlign: 'left', display: 'flex', gap: 8, marginBottom: 24 }}>
                <div style={{ fontWeight: 700 }}>i</div>
                <div><strong>Note:</strong> You can always return to your Principal Dashboard using the sidebar after visiting the office.</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn" onClick={() => setOfficeVisitWarning(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ background: '#0f766e', borderColor: '#0f766e' }} onClick={() => {
                  setOfficeVisitWarning(null);
                  setActiveRoleOverride('deputy_admin');
                  setView('admin_dashboard');
                  notify('Entered Deputy Administration Office', 'success', 'Office Visit');
                }}>Continue to Office</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {changePasswordOpen && (
        <ChangePasswordModal 
          onClose={() => setChangePasswordOpen(false)} 
          notify={notify} 
        />
      )}
    </div>
  );
}
