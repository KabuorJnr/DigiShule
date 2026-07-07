import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, LogOut, Loader } from 'lucide-react';
import { fetchTable, upsertRow } from '../lib/api';

// Calculate distance in meters using Haversine formula
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
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

export default function AttendAIWidget({ user, notify, settings }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [todayLog, setTodayLog] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const fetchTodayLog = async () => {
      try {
        const logs = await fetchTable('staffAttendanceLogs');
        const todayStr = new Date().toISOString().slice(0, 10);
        const myLog = logs.find(l => l.staff_id === user.id && l.date === todayStr);
        if (myLog) setTodayLog(myLog);
      } catch (err) {
        console.error('Failed to fetch attendance log', err);
      }
    };
    fetchTodayLog();
  }, [user?.id]);

  const handleAction = async (actionType) => {
    if (!navigator.geolocation) {
      notify('Geolocation is not supported by your browser.', 'error');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          if (settings?.latitude && settings?.longitude) {
            const distance = getDistanceInMeters(latitude, longitude, settings.latitude, settings.longitude);
            if (distance > 50) {
              notify(`Geofence Error: You are ${Math.round(distance)}m away from the school. You must be within 50m to log attendance.`, 'error');
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
              location_lat: latitude, // Update to checkout location
              location_lng: longitude
            };
          }

          await upsertRow('staffAttendanceLogs', newLog);
          
          // Also try to update the main staff record status (ignore errors if it fails)
          try {
            const staffRows = await fetchTable('staff');
            const me = staffRows.find(s => s.id === user.id);
            if (me) {
              await upsertRow('staff', { ...me, status: 'Present', check_in: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
            }
          } catch (e) {
            // silent ignore
          }

          setTodayLog(newLog);
          notify(`Successfully checked ${actionType === 'check_in' ? 'in' : 'out'}!`, 'success');
        } catch (err) {
          notify(`Failed to log attendance: ${err.message}`, 'error');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        notify('Please enable Location access to log your attendance.', 'error');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const hasCheckedIn = !!todayLog?.check_in_time;
  const hasCheckedOut = !!todayLog?.check_out_time;

  return (
    <div className="card p-6" style={{ background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Clock size={28} />
            AttendAI
          </h2>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>Digital Check-In & Check-Out</p>
        </div>
        <div style={{ textAlign: 'right', minWidth: '200px' }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '1px' }}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, padding: 16, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 12, backdropFilter: 'blur(10px)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Loader className="spin" size={32} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: '50%', 
                background: hasCheckedOut ? 'rgba(255,255,255,0.2)' : hasCheckedIn ? '#10b981' : 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <MapPin size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {hasCheckedOut ? 'Shift Completed' : hasCheckedIn ? 'Currently Clocked In' : 'Not Clocked In'}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  {hasCheckedIn && `In: ${new Date(todayLog.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} `}
                  {hasCheckedOut && `| Out: ${new Date(todayLog.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start', flex: '1 1 200px', maxWidth: '100%' }}>
              {!hasCheckedIn && (
                <button 
                  className="btn" 
                  style={{ background: 'white', color: '#0ea5e9', fontWeight: 600, padding: '10px 24px', flex: '1', minWidth: '150px' }}
                  onClick={() => handleAction('check_in')}
                >
                  <CheckCircle2 size={18} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'text-bottom' }} />
                  Check In Now
                </button>
              )}
              {hasCheckedIn && !hasCheckedOut && (
                <button 
                  className="btn" 
                  style={{ background: 'white', color: '#ef4444', fontWeight: 600, padding: '10px 24px', flex: '1', minWidth: '150px' }}
                  onClick={() => handleAction('check_out')}
                >
                  <LogOut size={18} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'text-bottom' }} />
                  Check Out
                </button>
              )}
              {hasCheckedOut && (
                <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', borderRadius: 8, fontWeight: 500 }}>
                  Have a great day!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
