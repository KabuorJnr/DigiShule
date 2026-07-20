import React from 'react';
import { Building2, UserCircle2, ArrowRight } from 'lucide-react';
import { ROLES } from '../data/users';

export default function SelectProfile({ profiles, onSelect, onLogout }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px', width: '100%', maxWidth: 500, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ background: '#e0f2fe', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCircle2 size={32} color="#0284c7" />
            </div>
          </div>
          <h2 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Select Your Profile</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>You are linked to multiple accounts. Please select which context you'd like to access right now.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {profiles.map(profile => {
            const roleDetails = ROLES[profile.role] || { label: profile.role };
            return (
              <button 
                key={profile.profileId || profile.schoolId} 
                onClick={() => onSelect(profile)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '16px 20px', 
                  background: '#fff', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                className="profile-select-btn"
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#047857'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59,130,246,0.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, marginRight: 16 }}>
                  <Building2 size={20} color="#475569" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 15, marginBottom: 2 }}>{profile.schoolName}</div>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#047857' }}></span>
                    {roleDetails.label}
                  </div>
                </div>
                <ArrowRight size={18} color="#94a3b8" />
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 30, textAlign: 'center' }}>
          <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}>
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}



