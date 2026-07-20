import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/widgets';
import { fetchClassRank, fetchStudentByQuery, fetchTable } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import { Award, AlertTriangle } from 'lucide-react';
import { listFiles } from '../../lib/fileStore';

const TABS = [
  { id: '', label: 'Dashboard', path: '.' },
  { id: 'academics', label: 'Academics', path: 'academics' },
  { id: 'records', label: 'Records', path: 'records' },
  { id: 'resources', label: 'Resources', path: 'resources' },
  { id: 'finance', label: 'Finance', path: 'finance' },
  { id: 'settings', label: 'Settings & More', path: 'settings' }
];

export default function StudentLayout() {
  const { store, user, params } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = store;

  const [me, setMe] = useState(null);
  const [isLoadingMe, setIsLoadingMe] = useState(true);
  const [rank, setRank] = useState(null);
  const [payments, setPayments] = useState([]);
  
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [libraryLoans, setLibraryLoans] = useState([]);

  useEffect(() => {
    if (params?.tab) {
      const targetPath = params.tab === 'student_dashboard' ? '/portal/student' : `/portal/student/${params.tab}`;
      if (location.pathname !== targetPath && location.pathname !== targetPath + '/') {
        navigate(targetPath, { replace: true });
      }
    }
  }, [params?.tab, location.pathname, navigate]);

  const [schoolEvents, setSchoolEvents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [disciplinary, setDisciplinary] = useState([]);

  const [cloudMaterials, setCloudMaterials] = useState([]);
  const [cloudAssignments, setCloudAssignments] = useState([]);

  useEffect(() => {
    let active = true;
    const loadMe = async () => {
      setIsLoadingMe(true);
      const targetId = params?.childId || user?.student_id || user?.studentId || user?.link || user?.id;
      const targetAdm = user?.username;
      
      let res = null;
      if (targetId) res = await fetchStudentByQuery('id', targetId);
      if (!res && targetAdm) res = await fetchStudentByQuery('adm', targetAdm);
      if (!res && targetId) res = await fetchStudentByQuery('adm', targetId);
      
      if (active) {
        if (res) setMe(res);
        setIsLoadingMe(false);
      }
    };
    loadMe();
    return () => { active = false; };
  }, [user, params]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchTable('libraryBooks').catch(() => []), 
      fetchTable('libraryLoans').catch(() => []), 
      fetchTable('schoolEvents').catch(() => []),
      fetchTable('studentAttendance').catch(() => []), 
      fetchTable('assignmentSubmissions').catch(() => []), 
      fetchTable('clinicVisits').catch(() => []),
      fetchTable('disciplinaryRecords').catch(() => []), 
      fetchTable('financePayments').catch(() => [])
    ]).then(([bks, lns, evs, att, subs, health, disc, pays]) => {
      if (!active) return;
      setLibraryBooks(bks || []);
      setLibraryLoans(lns || []);
      setSchoolEvents(evs || []);
      setAttendanceRecords((att || []).filter(a => a.student_id === me?.id || a.adm === me?.adm));
      setSubmissions((subs || []).filter(s => s.student_id === me?.id || s.adm === me?.adm));
      setHealthRecords((health || []).filter(h => h.adm === me?.adm));
      setDisciplinary((disc || []).filter(d => d.adm === me?.adm));
      setPayments((pays || []).filter(p => p.student_id === me?.id || p.adm === me?.adm));
    });
    return () => { active = false; };
  }, [me?.id, me?.adm]);

  useEffect(() => {
    let active = true;
    fetchClassRank().then(r => { if (active) setRank(r); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      listFiles('materials').catch(() => []),
      listFiles('assignments').catch(() => []),
    ]).then(([mats, assigns]) => {
      if (!active) return;
      setCloudMaterials(mats);
      setCloudAssignments(assigns);
    });
    return () => { active = false; };
  }, []);

  if (isLoadingMe) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', marginTop: 40 }}>
        <p className="muted">Loading student profile...</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', marginTop: 40 }}>
        <div style={{ width: 80, height: 80, background: '#f8d7da', color: '#dc3545', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ margin: '0 0 10px' }}>No Student Profile Found</h2>
        <p className="muted" style={{ maxWidth: 400, margin: '0 auto' }}>
          Your account is not linked to any student record, or there are no students registered in the database yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Student Portal" subtitle={`${me.name} Â· ${me.adm} Â· Grade ${me.class}`} />

      {user?.role === 'parent' && (
        <div style={{ background: '#e0e7ff', color: '#3730a3', padding: '12px 16px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#4f46e5', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <strong>Parental Administrative Access Active.</strong> You are viewing {me.name}'s portal with elevated permissions.
          </div>
        </div>
      )}

      {/* Disciplinary Notice */}
      {disciplinary.filter(c => c.status !== 'Resolved').length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', marginTop: 2 }} />
          <div>
            <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>Active Disciplinary Notice</strong>
            <div style={{ fontSize: 14 }}>You have unresolved disciplinary records that require your attention. Please check with the administration.</div>
          </div>
        </div>
      )}

      <Outlet context={{
        store, user, params, me, rank, navigate, notify,
        payments, setPayments, libraryBooks, libraryLoans, schoolEvents,
        attendanceRecords, submissions, healthRecords, disciplinary,
        cloudMaterials, cloudAssignments
      }} />
    </div>
  );
}



