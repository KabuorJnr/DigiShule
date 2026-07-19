import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import '../../App.css';
import { supabase, signOutAll } from '../../lib/supabaseClient';
import SelectProfile from '../SelectProfile';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import * as api from '../../lib/api';
import { setActiveSchoolId } from '../../lib/api';
import { ROLES } from '../../data/users';

import { Icon, NAV_ICON_MAP } from '../../components/icons';
import { ChevronDown, ChevronRight, Bell, PanelLeftClose, PanelLeft, Building2, Landmark, LogOut, Key, Search, Menu } from 'lucide-react';

import { Outlet, useNavigate, useLocation, Navigate, useOutletContext } from 'react-router-dom';
import { createUseStyles } from 'react-jss';
import { tokens } from '../EduOneDashboard/theme';
import Sidebar from '../EduOneDashboard/Sidebar';
import IconRail from '../EduOneDashboard/IconRail';
import TopBar from '../EduOneDashboard/TopBar';

const useStyles = createUseStyles({
  '@global': {
    ':root': {
      '--color-bg': '#EDEDF0',
      '--color-surface': '#ffffff',
      '--color-slate-50': '#f8fafc',
      '--color-slate-100': '#f1f5f9',
      '--color-slate-200': '#e2e8f0',
      '--color-slate-300': '#cbd5e1',
      '--color-slate-400': '#94a3b8',
      '--color-slate-500': '#64748b',
      '--color-slate-600': '#475569',
      '--color-slate-700': '#334155',
      '--color-slate-900': '#0f172a',
    },
    '.dark': {
      '--color-bg': '#09090b',
      '--color-surface': '#18181b',
      '--color-slate-50': '#27272a',
      '--color-slate-100': '#3f3f46',
      '--color-slate-200': '#52525b',
      '--color-slate-300': '#71717a',
      '--color-slate-400': '#a1a1aa',
      '--color-slate-500': '#a1a1aa',
      '--color-slate-600': '#d4d4d8',
      '--color-slate-700': '#e4e4e7',
      '--color-slate-900': '#fafafa',
    }
  },
  layout: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    padding: '1.5rem',
    gap: '0',
    backgroundColor: tokens.colors.bg,
    color: tokens.colors.slate900,
    fontFamily: '"Inter", sans-serif',
    boxSizing: 'border-box'
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden'
  },
  contentScroll: {
    flex: 1,
    overflowY: 'auto',
    borderRadius: tokens.borderRadius['2xl'],
    '&::-webkit-scrollbar': { display: 'none' },
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  }
});


let toastId = 0;

export default function PortalLayout() {
  const classes = useStyles();
  const navigateRouter = useNavigate();
  const location = useLocation();
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedNav, setExpandedNav] = useState({});
  const [toasts, setToasts] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [officeVisitWarning, setOfficeVisitWarning] = useState(null);
  const [activeRoleOverride, setActiveRoleOverride] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [staffRecord, setStaffRecord] = useState(null);
  const [activationPinInput, setActivationPinInput] = useState('');
  const [activationError, setActivationError] = useState('');
  const [activating, setActivating] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef(null);

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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { students: [], staff: [], notices: [] };
    const q = searchQuery.toLowerCase();
    return {
      students: students.filter(s => s?.name?.toLowerCase().includes(q) || s?.adm?.toLowerCase().includes(q) || String(s?.adm || '').toLowerCase().includes(q)).slice(0, 5),
      staff: teachers.filter(t => t?.name?.toLowerCase().includes(q) || t?.id?.toLowerCase().includes(q) || t?.dept?.toLowerCase().includes(q)).slice(0, 5)
    };
  }, [searchQuery, students, teachers]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      subjectAssignments, setSubjectAssignments,
      notify,
      navigate: (v, p = {}) => { 
        setViewParams(p); 
        setView(v); 
        // For nested layout routes with known sub-routes, navigate directly
        const nestedSubRoutes = {
          teacher: ['classes', 'attendance', 'gradebook'],
          student: ['academics', 'records', 'resources', 'finance', 'settings'],
          staff: ['leave', 'classes', 'recruitment'],
          finance: ['billing', 'payments', 'statements', 'fee_structure', 'expenses', 'reports']
        };
        const validSubs = nestedSubRoutes[v];
        if (p.tab && validSubs && validSubs.includes(p.tab)) {
          navigateRouter(`/portal/${v}/${p.tab}`);
        } else {
          navigateRouter(`/portal/${v}`);
        }
      },
      removeToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    }),
    [settings, schoolId, students, teachers, examSchedules, venues, gradeBoundaries, feeStructure, notifToggles, timetables, notifications, notify,
      setSettingsP, setExamsP, setVenuesP, setBoundsP, setFeeP, setTogglesP, setTimetablesP, updateStudent, updateTeacher, addTeacher, navigateRouter]
  );

  // ---- Load all domain data after a user is known ----
  const loadAllData = useCallback(async (background = false) => {
    if (!background) setDataLoading(true);
    try {
      const [cfg, ex, tt, notifs, st, tch, assigns] = await Promise.allSettled([
        api.fetchConfig(),
        api.fetchExamSchedules(),
        api.fetchTimetables(),
        api.fetchTable('notifications'),
        api.fetchAllStudentsUnpaginated(),
        api.fetchTeachers(),
        api.fetchTable('subjectAssignments')
      ]);
      // Apply results only if they resolved successfully
      if (cfg.status === 'fulfilled') {
        setSettings(cfg.value.settings);
        setGradeBoundaries(cfg.value.gradeBoundaries);
        setFeeStructure(cfg.value.feeStructure);
        setNotifToggles(cfg.value.notifToggles);
        setVenues(cfg.value.venues);
      }
      if (ex.status === 'fulfilled') setExamSchedules(ex.value || []);
      if (tt.status === 'fulfilled') setTimetables(tt.value || []);
      if (st.status === 'fulfilled') setStudents(st.value || []);
      if (tch.status === 'fulfilled') setTeachers(tch.value || []);
      
      const subjectAssignments = assigns?.status === 'fulfilled' ? (assigns.value || []) : [];
      if (notifs.status === 'fulfilled') {
        setNotifications((notifs.value || []).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
      }
    } catch (e) {
      // Only show error for truly unexpected failures
      console.error('[loadAllData] Unexpected error:', e);
    } finally {
      if (!background) setDataLoading(false);
    }
  }, []);

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
      
      // Fetch staff record if applicable
      const profile = profiles[0];
      if (profile.role !== 'parent' && profile.role !== 'student') {
        const { data: staffData } = await supabase.from('staff').select('*').eq('id', profile.id).maybeSingle();
        if (staffData) setStaffRecord(staffData);
      }

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
    navigateRouter('/login', { replace: true });
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

  if (view === 'select_profile') {
    return <SelectProfile profiles={availableProfiles} onSelect={(p) => handleSelectProfile(p, true)} onLogout={handleLogout} />;
  }

  if (!currentUser) {
    navigateRouter('/login', { replace: true });
    return null;
  }

  // ---- Staff Activation Interception ----
  if (staffRecord && staffRecord.status === 'Pending') {
    const handleActivate = async () => {
      if (activationPinInput.trim() !== staffRecord.pin) {
        setActivationError('Invalid Activation PIN');
        return;
      }
      setActivating(true);
      try {
        const updatedStaff = { ...staffRecord, status: 'Active', pin: null };
        await api.upsertRow('staff', updatedStaff);
        setStaffRecord(updatedStaff);
        
        // If they are a teacher, update the teachers table too
        if (staffRecord.role === 'teacher' || staffRecord.role === 'class teacher') {
          const teacherMatch = teachers.find(t => t.id === staffRecord.id);
          if (teacherMatch) {
             await api.updateTeacher(staffRecord.id, { status: 'Active' });
             updateTeacher(staffRecord.id, { status: 'Active' });
          }
        }
        
        notify('Account activated successfully! Welcome to the portal.', 'success');
      } catch (err) {
        setActivationError('Failed to activate: ' + err.message);
      } finally {
        setActivating(false);
      }
    };

    return (
      <div className="layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
        <div className="card card-pad" style={{ maxWidth: 400, width: '100%', textAlign: 'center', borderTop: '4px solid #10B981', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginBottom: 8, color: '#0f172a' }}>Account Activation</h2>
          <p className="muted" style={{ marginBottom: 24, fontSize: 14 }}>
            Welcome! Please enter the 6-digit Activation PIN sent to your email to commission your account.
          </p>
          <input 
            type="text" 
            className="input" 
            placeholder="Enter PIN" 
            value={activationPinInput} 
            onChange={e => { setActivationPinInput(e.target.value); setActivationError(''); }}
            style={{ textAlign: 'center', letterSpacing: 8, fontSize: 24, marginBottom: 16, fontWeight: 'bold' }}
            maxLength={6}
          />
          {activationError && (
            <div style={{ color: '#ef4444', marginBottom: 16, fontSize: 13, background: '#fef2f2', padding: '8px', borderRadius: 4 }}>
              {activationError}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12, padding: '12px' }} onClick={handleActivate} disabled={activating}>
            {activating ? 'Activating...' : 'Activate Account'}
          </button>
          <button className="btn" style={{ width: '100%', padding: '10px' }} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // ---- Logged-in shell ----
  const role = ROLES[activeRoleOverride || currentUser.role] || ROLES.principal;
  const nav = role.nav;
  // Extract current view from pathname
  const currentPath = location.pathname;
  let computedActiveView = view || role.home;
  
  if (currentPath.startsWith('/portal/')) {
    const pathParts = currentPath.split('/');
    if (pathParts.length >= 3 && pathParts[2] !== 'legacy') {
       computedActiveView = pathParts[2];
    } else if (pathParts.length >= 4 && pathParts[2] === 'legacy') {
       computedActiveView = pathParts[3];
    }
  }

  const activeView = computedActiveView;

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
    return true;
  };

  return (
    <div className={classes.layout}>
      <IconRail 
        nav={nav} 
        isNavActive={isNavActive} 
        store={store} 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
      />
      <Sidebar 
        nav={nav} 
        isNavActive={isNavActive} 
        expandedNav={expandedNav} 
        toggleNav={toggleNav} 
        currentUser={currentUser} 
        role={role} 
        settings={settings}
        handleLogout={handleLogout}
        store={store}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        setChangePasswordOpen={setChangePasswordOpen}
      />

      {mobileMenuOpen && (
        <div className="mobile-overlay hide-desktop" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div className={classes.mainContent}>
        <TopBar 
           settings={settings}
           currentUser={currentUser}
           unreadCount={unreadCount}
           setNotifOpen={setNotifOpen}
           searchQuery={searchQuery}
           setSearchQuery={setSearchQuery}
           showSearchResults={showSearchResults}
           setShowSearchResults={setShowSearchResults}
           searchResults={searchResults}
           searchInputRef={searchInputRef}
           store={store}
           activeRoleOverride={activeRoleOverride}
           setActiveRoleOverride={setActiveRoleOverride}
           setView={setView}
           setViewParams={setViewParams}
           navigateRouter={navigateRouter}
           notify={notify}
           setMobileMenuOpen={setMobileMenuOpen}
           mobileMenuOpen={mobileMenuOpen}
        />
        <main className={classes.contentScroll}>
          {dataLoading ? (
            <p className="muted" style={{ padding: '2rem' }}>Loading…</p>
          ) : (
            <Outlet context={{ store, user: currentUser, params: viewParams }} />
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
                  navigateRouter('/portal/academics_dashboard');
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
                  navigateRouter('/portal/admin_dashboard');
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

export function PortalIndex() {
  const { user } = useOutletContext();
  if (!user) return null;
  const role = ROLES[user.role] || ROLES.principal;
  return <Navigate to={`/portal/${role.home || 'overview'}`} replace />;
}
