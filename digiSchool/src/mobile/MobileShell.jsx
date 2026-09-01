import { useState, useMemo, useCallback } from 'react';
import {
  Bell, X, ChevronLeft, LogOut, KeyRound, ChevronRight,
} from 'lucide-react';
import MobileHome from './MobileHome';
import { SCREENS, tabsForRole, homeRoleFor } from './screens/registry';
import './mobile.css';

const ADMIN_ROLES = ['principal', 'deputy_academic', 'deputy_admin', 'dos', 'registrar', 'admin', 'finance', 'accountant', 'bursar', 'clinic', 'nurse', 'librarian', 'support', 'procurement'];

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'EO';
}

function visibleNotifs(notifications, user) {
  if (!user) return [];
  return (notifications || []).filter((n) => {
    const aud = n.audience || [];
    if (aud.includes('all')) return true;
    if (aud.includes(user.role)) return true;
    if (aud.includes(user.id)) return true;
    if (aud.includes('admins') && ADMIN_ROLES.includes(user.role)) return true;
    if (user.role === 'parent' && aud.includes('parents')) return true;
    return false;
  });
}
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60); if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// The phone shell: an in-app screen stack (no router) with a top bar and a
// role-aware bottom nav. Every screen is a native mobile component.
export default function MobileShell({ store, user, onLogout, onChangePassword, loading }) {
  const role = user?.role || 'parent';
  const homeRole = homeRoleFor(role);
  const tabs = tabsForRole(role);

  const [stack, setStack] = useState([{ name: 'home' }]);
  const [notifOpen, setNotifOpen] = useState(false);
  const current = stack[stack.length - 1];

  const open = useCallback((name, params = {}) => {
    setNotifOpen(false);
    setStack((s) => [...s, { name, params }]);
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const setRoot = useCallback((name) => { setNotifOpen(false); setStack([{ name }]); }, []);

  const notifs = useMemo(() => visibleNotifs(store.notifications, user), [store.notifications, user]);
  const unread = notifs.filter((n) => !n.read).length;

  const rootName = stack[0].name;
  const isHome = current.name === 'home';
  const isAccount = current.name === 'account';
  const canBack = stack.length > 1;

  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  const screenDef = SCREENS[current.name];
  const ScreenComp = screenDef?.Component;

  return (
    <div className="eo-m">
      <div className="eo-app">
        <div className="eo-scroll">
          {/* Header: avatar bar on home, back+title elsewhere */}
          {isHome ? (
            <div className="eo-top">
              <div className="eo-avatar">{initials(user?.name)}</div>
              <div className="eo-who">
                <div className="eo-hi">{greeting}</div>
                <div className="eo-nm">{user?.name || 'Welcome'}</div>
              </div>
              <button className="eo-bell" onClick={() => setNotifOpen((o) => !o)} aria-label="Notifications">
                <Bell />
                {unread > 0 && <span className="eo-bdot">{unread > 9 ? '9+' : unread}</span>}
              </button>
            </div>
          ) : (
            <div className="eo-schead">
              {canBack && <button className="eo-back" onClick={back} aria-label="Back"><ChevronLeft /></button>}
              <div style={{ flex: 1 }}>
                <h2>{isAccount ? 'Account' : (screenDef?.title || '')}</h2>
              </div>
              {!canBack && (
                <button className="eo-bell" onClick={() => setNotifOpen((o) => !o)} aria-label="Notifications">
                  <Bell />
                  {unread > 0 && <span className="eo-bdot">{unread > 9 ? '9+' : unread}</span>}
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="eo-empty"><p>Loading your EduOne data…</p></div>
          ) : isHome ? (
            <MobileHome role={homeRole} store={store} user={user} open={open} />
          ) : isAccount ? (
            <AccountPanel user={user} store={store} onLogout={onLogout} onChangePassword={onChangePassword} />
          ) : ScreenComp ? (
            <ScreenComp store={store} user={user} open={open} back={back} params={current.params} />
          ) : (
            <div className="eo-empty"><p>Screen not found.</p></div>
          )}
        </div>

        <nav className="eo-tabbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = rootName === t.key || (t.key === 'home' && rootName === 'home');
            return (
              <button key={t.key} className={`eo-tab${active ? ' eo-active' : ''}`} onClick={() => setRoot(t.key)}>
                {active && <span className="eo-ind" />}
                <Icon /><span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {notifOpen && (
        <div className="eo-np">
          <h6>Notifications <button className="eo-link" onClick={() => setNotifOpen(false)} aria-label="Close"><X size={18} /></button></h6>
          <div className="eo-np-list">
            {notifs.length === 0 && <div className="eo-ni-empty">You&apos;re all caught up.</div>}
            {notifs.slice(0, 30).map((n) => (
              <div className="eo-ni" key={n.id}>
                <b>{n.title}</b>
                <span>{(n.body || n.message || '').slice(0, 120)}{n.posted_by ? ` · ${n.posted_by}` : ''} · {timeAgo(n.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountPanel({ user, store, onLogout, onChangePassword }) {
  const settings = store.settings || {};
  return (
    <>
      <div className="eo-stat-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="eo-avatar" style={{ width: 56, height: 56, borderRadius: 18, fontSize: 20 }}>{initials(user?.name)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--eo-ink)' }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--eo-muted)', textTransform: 'capitalize' }}>{(user?.role || '').replace(/_/g, ' ')}{settings.name ? ` · ${settings.name}` : ''}</div>
        </div>
      </div>
      <div className="eo-list-card">
        {onChangePassword && (
          <button className="eo-li" onClick={onChangePassword}>
            <span className="eo-lic" style={{ background: 'var(--eo-blue-50)', color: 'var(--eo-blue)' }}><KeyRound /></span>
            <div className="eo-lt"><b>Change password</b><span>Update your login credentials</span></div>
            <span className="eo-rt"><ChevronRight size={18} /></span>
          </button>
        )}
        <button className="eo-li" onClick={onLogout}>
          <span className="eo-lic" style={{ background: 'var(--eo-bad-100)', color: 'var(--eo-bad)' }}><LogOut /></span>
          <div className="eo-lt"><b>Sign out</b><span>Log out of EduOne</span></div>
          <span className="eo-rt"><ChevronRight size={18} /></span>
        </button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <img src="/eduone-logo.png" alt="EduOne" style={{ height: 26, opacity: 0.5 }} />
      </div>
    </>
  );
}
