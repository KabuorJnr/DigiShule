import React from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';

export default function PrintHeader({ settings = {} }) {

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: 30 }}>
      {/* Watermark spanning the page */}
      <div className="no-print-watermark" style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, 0)', // Vertical alignment depends on container
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}>
        <svg viewBox="0 0 800 800" width="100%" height="100%" style={{ opacity: 0.02, transform: 'rotate(-30deg)' }}>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="140" fontWeight="bold" fill="#000" fontFamily="sans-serif">
            EduOne
          </text>
        </svg>
      </div>

      {/* Letterhead */}
      <div style={{
        textAlign: 'center',
        borderBottom: '3px solid var(--border)',
        paddingBottom: 20,
        position: 'relative',
        zIndex: 1
      }}>
        {settings.logo && (
          <img src={settings.logo} alt="School Logo" style={{ maxHeight: 80, marginBottom: 12, borderRadius: 8 }} />
        )}
        <h1 style={{ margin: '0 0 6px 0', fontSize: 32, fontWeight: 800, textTransform: 'capitalize', letterSpacing: 1.5 }}>
          {settings.name || 'DigiShule Institution'}
        </h1>
        {settings.motto && (
          <p style={{ margin: '0 0 10px 0', fontStyle: 'italic', fontSize: 15, color: '#555' }}>
            "{settings.motto}"
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 13, color: '#222' }}>
          {settings.address && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {settings.address}</span>}
          {settings.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> {settings.phone}</span>}
          {settings.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> {settings.email}</span>}
        </div>
      </div>
    </div>
  );
}
