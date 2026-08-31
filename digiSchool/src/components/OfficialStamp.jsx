import React from 'react';

/**
 * OfficialStamp — the authorising footer for any official school document
 * (newsletters, fee structures, letters, transcripts).
 *
 * It renders the principal's name and rank/title over a signature line and,
 * when the school has uploaded a scanned official stamp in Settings → General,
 * overlays that stamp image. Every field falls back gracefully so a freshly
 * onboarded school that hasn't configured a stamp still gets a clean,
 * signable block instead of hardcoded placeholder text.
 */
export default function OfficialStamp({ settings = {}, align = 'right', label = 'Principal' }) {
  const name = settings.principal || settings.principalName || '';
  const rank = settings.principalRank || '';
  const stamp = settings.stamp || '';

  const justify = align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end';

  return (
    <div style={{ display: 'flex', justifyContent: justify, marginTop: 32 }}>
      <div style={{ position: 'relative', textAlign: 'center', minWidth: 220 }}>
        {/* Scanned official stamp, overlaid so it reads as applied over the sign-off. */}
        {stamp && (
          <img
            src={stamp}
            alt="Official school stamp"
            style={{
              position: 'absolute',
              top: -18,
              left: '50%',
              transform: 'translateX(-30%) rotate(-8deg)',
              maxHeight: 90,
              maxWidth: 150,
              opacity: 0.9,
              pointerEvents: 'none',
            }}
          />
        )}
        <div style={{ borderBottom: '1px solid #000', height: 34 }} />
        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{name || '________________________'}</div>
        {rank && <div style={{ fontSize: 12, color: '#333' }}>{rank}</div>}
        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
          {label}{settings.name ? ` · ${settings.name}` : ''}
        </div>
      </div>
    </div>
  );
}
