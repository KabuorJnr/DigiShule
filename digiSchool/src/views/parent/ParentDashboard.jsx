import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User, BookOpen, Clock, AlertTriangle, ShieldCheck, FileText, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Icon } from '../../components/icons';

export default function ParentDashboard() {
  const { user: currentUser } = useOutletContext();
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkAdm, setLinkAdm] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    async function fetchChild() {
      if (!currentUser?.student_id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', currentUser.student_id)
          .maybeSingle();
        
        if (!error && data) {
          setChild(data);
        }
      } catch (err) {
        console.error("Error fetching child:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchChild();
  }, [currentUser]);

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading child data...</div>;
  }



  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!linkAdm.trim()) return;
    setLinking(true);
    setLinkError('');
    try {
      // 1. Lookup student
      const { data, error } = await supabase.rpc('lookup_student_for_signup', {
        p_school_id: currentUser.school_id,
        p_adm: linkAdm.trim()
      });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Student not found with that admission number.');
      
      const student = data[0];
      
      // 2. Link parent profile
      const { error: updateErr } = await supabase.from('profiles').update({
        student_id: student.id
      }).eq('id', currentUser.id);
      
      if (updateErr) throw updateErr;
      
      window.location.reload();
    } catch (err) {
      setLinkError(err.message);
      setLinking(false);
    }
  };

  if (!child) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <ShieldCheck size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
        <h2>Welcome to the Parent Portal</h2>
        <p className="muted" style={{ marginBottom: 30 }}>Your account is not currently linked to a specific student profile. Please enter your child's Admission Number below to link your account.</p>
        
        <form onSubmit={handleLinkStudent} style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Admission Number</label>
            <input 
              type="text" 
              value={linkAdm}
              onChange={(e) => setLinkAdm(e.target.value)}
              placeholder="e.g. ADM/2023/001"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}
              required
            />
          </div>
          {linkError && (
            <div style={{ padding: '10px', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
              {linkError}
            </div>
          )}
          <button 
            type="submit" 
            disabled={linking || !linkAdm.trim()}
            style={{ width: '100%', padding: '10px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: linking ? 'not-allowed' : 'pointer', opacity: linking ? 0.7 : 1 }}
          >
            {linking ? 'Linking Account...' : 'Link Child Profile'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
            Overview for {child.name}
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
            Grade: {child.grade || 'N/A'} • Admission: {child.admission_number || 'Pending'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <button 
          onClick={() => window.location.href = '/portal/student'}
          style={{
            background: '#0f172a',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BookOpen size={18} />
          Access Student Portal
        </button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="#64748b" /> Recent Notices
          </h3>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', fontSize: '14px', color: '#475569' }}>
            You will see official school notices, fee reminders, and event announcements here.
          </div>
        </div>
      </div>
    </div>
  );
}
