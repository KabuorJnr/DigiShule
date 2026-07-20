import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, LogOut, Loader } from 'lucide-react';
import { fetchTable, upsertRow } from '../lib/api';

export default function EduOneWidget({ user, notify, settings, store }) {
  const _notify = notify || store?.notify || (() => {});
  const _settings = settings || store?.settings || {};

  const [currentTime, setCurrentTime] = useState(new Date());
  const [actionLoading, setActionLoading] = useState(false);
  const [todayLog, setTodayLog] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) { setReady(true); return; }
    fetchTable('staffAttendanceLogs')
      .then(logs => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const myLog = (logs || []).find(l => l.staff_id === user.id && l.date === todayStr);
        if (myLog) setTodayLog(myLog);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [user?.id]);

  const doCheckIn = async (lat, lng) => {
    const nowStr = new Date().toISOString();
    const todayStr = nowStr.slice(0, 10);
    const newLog = {
      id: `att_${Date.now()}`,
      staff_id: user.id,
      date: todayStr,
      check_in_time: nowStr,
      location_lat: lat || null,
      location_lng: lng || null,
      status: 'Present'
    };
    await upsertRow('staffAttendanceLogs', newLog);
    // Update staff table
    try {
      const { data: profs } = await supabase.from('profiles').select('id, teacher_id').eq('id', user.id);
      const staffId = profs?.[0]?.teacher_id || user.id;

      const staffRows = await fetchTable('staff');
      const me = (staffRows || []).find(s => s.id === staffId);
      if (me) {
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await upsertRow('staff', { ...me, status: 'Present', check_in: t });
      }
    } catch (_) {}
    setTodayLog(newLog);
    _notify('Checked in successfully!', 'success');
  };

  const doCheckOut = async (lat, lng) => {
    const nowStr = new Date().toISOString();
    const newLog = { ...todayLog, check_out_time: nowStr, location_lat: lat || todayLog?.location_lat, location_lng: lng || todayLog?.location_lng };
    await upsertRow('staffAttendanceLogs', newLog);
    try {
      const { data: profs } = await supabase.from('profiles').select('id, teacher_id').eq('id', user.id);
      const staffId = profs?.[0]?.teacher_id || user.id;

      const staffRows = await fetchTable('staff');
      const me = (staffRows || []).find(s => s.id === staffId);
      if (me) {
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await upsertRow('staff', { ...me, check_out: t });
      }
    } catch (_) {}
    setTodayLog(newLog);
    _notify('Checked out successfully!', 'success');
  };

  const handleAction = async (actionType) => {
    setActionLoading(true);
    try {
      // Try to get location, but don't block on it
      let lat = null, lng = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (_) {
        // Location unavailable - proceed without it
      }

      // Geofence check: if school coordinates are configured AND we got a location
      if (lat && lng && _settings?.latitude && _settings?.longitude) {
        const R = 6371e3;
        const phi1 = lat * Math.PI / 180, phi2 = _settings.latitude * Math.PI / 180;
        const deltaPhi = (_settings.latitude - lat) * Math.PI / 180;
        const deltaLambda = (_settings.longitude - lng) * Math.PI / 180;
        const a = Math.sin(deltaPhi/2)**2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const radius = _settings.geofenceRadius || 50;
        if (dist > radius) {
          _notify(`You are ${Math.round(dist)}m from school. Must be within ${radius}m.`, 'error');
          setActionLoading(false);
          return;
        }
      }

      if (actionType === 'check_in') {
        await doCheckIn(lat, lng);
      } else {
        await doCheckOut(lat, lng);
      }
    } catch (err) {
      _notify(`Attendance error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const hasCheckedIn = !!todayLog?.check_in_time;
  const hasCheckedOut = !!todayLog?.check_out_time;
  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, padding: '10px 16px',
      background: 'linear-gradient(135deg, #0ea5e9, #065f46)',
      borderRadius: 10, color: 'white', fontSize: 13, flexWrap: 'wrap',
    }}>
      {/* Left: label + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <img 
          src="/eduone-logo.png" 
          alt="EduOne" 
          style={{ height: 38, background: 'white', borderRadius: 6, padding: '4px 6px', objectFit: 'contain' }} 
        />
        <span style={{ opacity: 0.5 }}>|</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{timeStr}</span>
        <span style={{ opacity: 0.7, fontSize: 11 }}>{dateStr}</span>
      </div>

      {/* Center: status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: hasCheckedOut ? '#94a3b8' : hasCheckedIn ? '#4ade80' : '#fbbf24',
        }} />
        <span style={{ fontSize: 12 }}>
          {!ready ? 'Loading...' : hasCheckedOut ? 'Done' : hasCheckedIn ? 'Clocked In' : 'Not Clocked In'}
        </span>
        {hasCheckedIn && (
          <span style={{ fontSize: 11, opacity: 0.75 }}>
            (In: {new Date(todayLog.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {hasCheckedOut && ` · Out: ${new Date(todayLog.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`})
          </span>
        )}
      </div>

      {/* Right: action */}
      <div>
        {!ready ? null : actionLoading ? (
          <Loader className="spin" size={14} />
        ) : !hasCheckedIn ? (
          <button
            onClick={() => handleAction('check_in')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'white', color: '#0ea5e9', border: 'none',
              borderRadius: 6, padding: '5px 12px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <CheckCircle2 size={13} /> Check In
          </button>
        ) : !hasCheckedOut ? (
          <button
            onClick={() => handleAction('check_out')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.15)', color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6, padding: '5px 12px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <LogOut size={13} /> Check Out
          </button>
        ) : (
          <span style={{ fontSize: 11, opacity: 0.7 }}>✓ Complete</span>
        )}
      </div>
    </div>
  );
}



