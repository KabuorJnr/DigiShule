import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Shield, Building2, Users, DollarSign, Activity, AlertTriangle, Key } from 'lucide-react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';

export default function DeveloperPortal({ store }) {
  const { notify } = store;
  
  const [schools, setSchools] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);



  const loadPlatformData = async () => {
    setLoading(true);
    try {
      // Bypass API wrapper and fetch raw data from all tenants
      const [schRes, profRes, stuRes, payRes] = await Promise.all([
        supabase.from('schools').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, school_id, role'),
        supabase.from('students').select('id, school_id'),
        supabase.from('finance_payments').select('amount, school_id')
      ]);

      if (schRes.error) throw schRes.error;
      
      setSchools(schRes.data || []);
      setProfiles(profRes.data || []);
      setStudents(stuRes.data || []);
      setPayments(payRes.data || []);
      
    } catch (err) {
      notify(`Failed to load platform data: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const toggleSchoolSuspension = async (school) => {
    const isSuspended = school.settings?.suspended === true;
    const action = isSuspended ? 'reactivate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} ${school.name}?`)) return;

    try {
      const updatedSettings = { ...school.settings, suspended: !isSuspended };
      const { error } = await supabase.from('schools').update({ settings: updatedSettings }).eq('id', school.id);
      if (error) throw error;
      
      notify(`School ${action}d successfully.`, 'success');
      loadPlatformData();
    } catch (err) {
      notify(`Failed to ${action} school: ${err.message}`, 'error');
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading SaaS Architecture Data...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      <PageHeader 
        title="Developer God Mode" 
        subtitle="SaaS Platform Overview & Tenant Management" 
      />

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KpiCard 
          icon={<Building2 size={24} style={{ color: '#0ea5e9' }} />}
          title="Total Schools"
          value={schools.length}
          trend="+ Active Tenants"
        />
        <KpiCard 
          icon={<Users size={24} style={{ color: '#10b981' }} />}
          title="Total Students"
          value={students.length}
          trend="Platform Wide"
        />
        <KpiCard 
          icon={<Activity size={24} style={{ color: '#8b5cf6' }} />}
          title="Total Users"
          value={profiles.length}
          trend="Staff & Parents"
        />
        <KpiCard 
          icon={<DollarSign size={24} style={{ color: '#f59e0b' }} />}
          title="Platform Volume"
          value={`KES ${totalRevenue.toLocaleString()}`}
          trend="Processed Fees"
        />
      </div>

      <div className="card card-pad">
        <h3 className="section-title">Tenant Directory</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>School Name</th>
                <th>Domain ID</th>
                <th>Created Date</th>
                <th>Users</th>
                <th>Students</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(school => {
                const sUsers = profiles.filter(p => p.school_id === school.id).length;
                const sStudents = students.filter(s => s.school_id === school.id).length;
                const isSuspended = school.settings?.suspended === true;

                return (
                  <tr key={school.id}>
                    <td style={{ fontWeight: 600 }}>{school.name}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{school.id.substring(0, 8)}...</td>
                    <td>{new Date(school.created_at).toLocaleDateString()}</td>
                    <td>{sUsers}</td>
                    <td>{sStudents}</td>
                    <td>
                      <Badge color={isSuspended ? 'red' : 'green'}>
                        {isSuspended ? 'Suspended' : 'Active'}
                      </Badge>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm" 
                        style={{ color: isSuspended ? '#10b981' : '#ef4444', borderColor: isSuspended ? '#10b981' : '#ef4444' }}
                        onClick={() => toggleSchoolSuspension(school)}
                      >
                        {isSuspended ? 'Reactivate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {schools.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>No schools found in database.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ marginTop: 40, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>
        <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        <strong>Warning:</strong> You are bypassing Row Level Security. Actions taken here immediately affect production tenants.
      </div>
    </div>
  );
}
