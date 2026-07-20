import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { ShieldCheck, Mail, Database, Loader2 } from 'lucide-react';

export default function RegistrationLoadingModal({ step }) {
  // steps: 'provisioning' -> 'password' -> 'email' -> 'done'
  const steps = [
    { id: 'provisioning', label: 'Provisioning Account...', icon: Database },
    { id: 'password', label: 'Generating Secure Password...', icon: ShieldCheck },
    { id: 'email', label: 'Dispatching Onboarding Email...', icon: Mail },
  ];

  const currentIdx = steps.findIndex(s => s.id === step) !== -1 ? steps.findIndex(s => s.id === step) : 3;

  return (
    <Modal title="Processing Registration" hideClose>
      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {step !== 'done' ? (
          <div style={{ marginBottom: 24, animation: 'spin 2s linear infinite' }}>
            <Loader2 size={48} color="#047857" />
          </div>
        ) : (
          <div style={{ marginBottom: 24, color: '#047857' }}>
            <ShieldCheck size={48} />
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 300 }}>
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === currentIdx;
            const isPast = idx < currentIdx;
            
            return (
              <div key={s.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                marginBottom: 16,
                color: isPast ? '#047857' : isActive ? '#0e141e' : '#94a3b8',
                opacity: isPast || isActive ? 1 : 0.5,
                transition: 'all 0.3s ease'
              }}>
                <Icon size={20} />
                <span style={{ fontSize: 15, fontWeight: isActive ? 600 : 500 }}>
                  {s.label}
                </span>
                {isActive && (
                  <Loader2 size={14} color="#047857" style={{ animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />
                )}
              </div>
            );
          })}
        </div>

        {step === 'done' && (
          <div style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: '#047857' }}>
            Registration Complete!
          </div>
        )}
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    </Modal>
  );
}



