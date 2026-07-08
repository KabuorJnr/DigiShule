import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, LogOut, Loader } from 'lucide-react';
import { fetchTable, upsertRow } from '../lib/api';

// Calculate distance in meters using Haversine formula
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function EduOneWidget({ user, notify, settings, store }) {
  // Support both direct props and store-based props
  const _notify = notify || store?.notify || (() => {});
  const _settings = settings || store?.settings || {};

  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [todayLog, setTodayLog] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) { setInitialLoading(false); return; }
    const fetchTodayLog = async () => {
      try {
        const logs = await fetchTable('staffAttendanceLogs');
        const todayStr = new Date().toISOString().slice(0, 10);
        const myLog = (logs || []).find(l => l.staff_id === user.id && l.date === todayStr);
        if (myLog) setTodayLog(myLog);
      } catch (err) {
        console.error('Failed to fetch attendance log', err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchTodayLog();
  }, [user?.id]);

  const handleAction = async (actionType) => {
    if (!navigator.geolocation) {
      _notify('Geolocation is not supported by your browser.', 'error');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          if (_settings?.latitude && _settings?.longitude) {
            const distance = getDistanceInMeters(latitude, longitude, _settings.latitude, _settings.longitude);
            if (distance > 50) {
              _notify(`You are ${Math.round(distance)}m away. Must be within 50m.`, 'error');
              setLoading(false);
              return;
            }
          }

          const nowStr = new Date().toISOString();
          const todayStr = nowStr.slice(0, 10);

          let newLog = { ...todayLog };
          
          if (actionType === 'check_in') {
            newLog = {
              id: `att_${Date.now()}`,
              staff_id: user.id,
              date: todayStr,
              check_in_time: nowStr,
              location_lat: latitude,
              location_lng: longitude,
              status: 'Present'
            };
          } else if (actionType === 'check_out') {
            newLog = {
              ...todayLog,
              check_out_time: nowStr,
              location_lat: latitude,
              location_lng: longitude
            };
          }

          await upsertRow('staffAttendanceLogs', newLog);
          
          // Also update the main staff record
          try {
            const staffRows = await fetchTable('staff');
            const me = (staffRows || []).find(s => s.id === user.id);
            if (me) {
              const actionTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              if (actionType === 'check_in') {
                await upsertRow('staff', { ...me, status: 'Present', check_in: actionTime });
              } else {
                await upsertRow('staff', { ...me, check_out: actionTime });
              }
            }
          } catch (e) {
            // silent
          }

          setTodayLog(newLog);
          _notify(`Successfully checked ${actionType === 'check_in' ? 'in' : 'out'}!`, 'success');
        } catch (err) {
          _notify(`Failed to log attendance: ${err.message}`, 'error');
        } finally {
          setLoading(false);
        }
      },
      () => {
        _notify('Please enable Location access to log attendance.', 'error');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const hasCheckedIn = !!todayLog?.check_in_time;
  const hasCheckedOut = !!todayLog?.check_out_time;

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // Compact inline bar
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '10px 16px',
      background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
      borderRadius: 10,
      color: 'white',
      fontSize: 13,
      flexWrap: 'wrap',
    }}>
      {/* Left: icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <Clock size={16} />
        <span style={{ fontWeight: 600 }}>EduOne</span>
        <span style={{ opacity: 0.8, fontSize: 12 }}>|</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{timeStr}</span>
        <span style={{ opacity: 0.7, fontSize: 11 }}>{dateStr}</span>
      </div>

      {/* Center: status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {initialLoading ? (
          <Loader className="spin" size={14} />
        ) : (
          <>
            <span style={{
              display: 'inline-block',
              width: 8, height: 8, borderRadius: '50%',
              background: hasCheckedOut ? '#94a3b8' : hasCheckedIn ? '#4ade80' : '#fbbf24',
            }} />
            <span style={{ fontSize: 12 }}>
              {hasCheckedOut ? 'Done' : hasCheckedIn ? 'Clocked In' : 'Not Clocked In'}
            </span>
            {hasCheckedIn && (
              <span style={{ fontSize: 11, opacity: 0.75 }}>
                (In: {new Date(todayLog.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {hasCheckedOut && ` · Out: ${new Date(todayLog.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`})
              </span>
            )}
          </>
        )}
      </div>

      {/* Right: action button */}
      <div>
        {loading ? (
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
        ) : hasCheckedIn && !hasCheckedOut ? (
          <button
            onClick={() => handleAction('check_out')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
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
