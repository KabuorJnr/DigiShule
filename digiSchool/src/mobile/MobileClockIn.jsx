import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, LogOut, MapPin, Loader } from 'lucide-react';
import { fetchTable, upsertRow } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { getCurrentPosition, distanceMeters } from './geo';

// Staff clock-in / clock-out card for the mobile home. Writes to
// staff_attendance_logs (same shape as the desktop widget) and enforces the
// school geofence from Settings → School Location (settings.latitude/longitude/
// geofenceRadius). Device GPS comes from the Capacitor Geolocation plugin.
export default function MobileClockIn({ user, store }) {
  const settings = store?.settings || {};
  const notify = store?.notify || (() => {});
  const [now, setNow] = useState(new Date());
  const [todayLog, setTodayLog] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user?.id) { setReady(true); return; }
    let active = true;
    fetchTable('staffAttendanceLogs')
      .then((logs) => {
        if (!active) return;
        const todayStr = new Date().toISOString().slice(0, 10);
        const mine = (logs || []).find((l) => l.staff_id === user.id && l.date === todayStr);
        if (mine) setTodayLog(mine);
      })
      .catch(() => {})
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [user?.id]);

  const syncStaffRow = async (patch) => {
    try {
      const { data: profs } = await supabase.from('profiles').select('id, teacher_id').eq('id', user.id);
      const staffId = profs?.[0]?.teacher_id || user.id;
      const staffRows = await fetchTable('staff');
      const me = (staffRows || []).find((s) => s.id === staffId);
      if (me) await upsertRow('staff', { ...me, ...patch });
    } catch { /* best-effort roster sync */ }
  };

  const act = async (type) => {
    setBusy(true);
    try {
      // Resolve device location.
      let lat = null, lng = null, locErr = null;
      try { const p = await getCurrentPosition(); lat = p.lat; lng = p.lng; }
      catch (e) { locErr = e; }

      // Geofence: only enforce when the school has configured coordinates.
      const geofenced = settings?.latitude && settings?.longitude;
      if (geofenced) {
        if (lat == null || lng == null) {
          notify(`Turn on location to clock ${type === 'check_in' ? 'in' : 'out'} — ${locErr?.message || 'location unavailable'}.`, 'error', 'Attendance');
          setBusy(false);
          return;
        }
        const dist = distanceMeters(lat, lng, settings.latitude, settings.longitude);
        const radius = settings.geofenceRadius || 50;
        if (dist > radius) {
          notify(`You're ${Math.round(dist)}m from school — must be within ${radius}m to clock ${type === 'check_in' ? 'in' : 'out'}.`, 'error', 'Attendance');
          setBusy(false);
          return;
        }
      }

      const nowStr = new Date().toISOString();
      const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (type === 'check_in') {
        const log = {
          id: `att_${Date.now()}`, staff_id: user.id, date: nowStr.slice(0, 10),
          check_in_time: nowStr, location_lat: lat, location_lng: lng, status: 'Present',
        };
        await upsertRow('staffAttendanceLogs', log);
        await syncStaffRow({ status: 'Present', check_in: timeLabel });
        setTodayLog(log);
        notify('Checked in successfully.', 'success', 'Attendance');
      } else {
        const log = { ...todayLog, check_out_time: nowStr, location_lat: lat ?? todayLog?.location_lat, location_lng: lng ?? todayLog?.location_lng };
        await upsertRow('staffAttendanceLogs', log);
        await syncStaffRow({ check_out: timeLabel });
        setTodayLog(log);
        notify('Checked out successfully.', 'success', 'Attendance');
      }
    } catch (e) {
      notify(`Attendance error: ${e.message}`, 'error', 'Attendance');
    } finally {
      setBusy(false);
    }
  };

  const hasIn = !!todayLog?.check_in_time;
  const hasOut = !!todayLog?.check_out_time;
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const stateLabel = !ready ? 'Loading…' : hasOut ? 'Shift complete' : hasIn ? 'Clocked in' : 'Not clocked in';
  const dotColor = hasOut ? '#94a3b8' : hasIn ? '#4ade80' : '#fbbf24';

  return (
    <div className="eom-clock">
      <div className="eom-clock-top">
        <span className="eom-clock-ico"><Clock /></span>
        <div className="eom-clock-time">
          <div className="eom-num">{timeStr}</div>
          <span>{dateStr}</span>
        </div>
        {settings?.latitude ? <span className="eom-clock-geo"><MapPin size={12} /> Geofenced</span> : null}
      </div>
      <div className="eom-clock-row">
        <div className="eom-clock-state">
          <span className="eom-clock-dot" style={{ background: dotColor }} />
          {stateLabel}
          {hasIn && <span className="eom-clock-sub">In {new Date(todayLog.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{hasOut && ` · Out ${new Date(todayLog.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span>}
        </div>
        {ready && !hasOut && (
          <button className={`eom-clock-btn${hasIn ? ' eom-out' : ''}`} onClick={() => act(hasIn ? 'check_out' : 'check_in')} disabled={busy}>
            {busy ? <Loader size={15} className="eom-spin-ico" /> : hasIn ? <><LogOut size={15} /> Check out</> : <><CheckCircle2 size={15} /> Check in</>}
          </button>
        )}
        {ready && hasOut && <span className="eom-clock-done">✓ Done</span>}
      </div>
    </div>
  );
}
