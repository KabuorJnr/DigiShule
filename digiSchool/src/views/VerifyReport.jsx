import React, { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { decodePayload, verifyPayload } from '../utils/reportVerification';

// Public, auth-free page that a report-card QR code (or manual code entry)
// resolves to. It recomputes the fingerprint from the data embedded in the
// link and confirms it matches the printed code — proving the card was not
// altered after it was issued.
export default function VerifyReport() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const result = useMemo(() => {
    const d = params.get('d');
    const c = params.get('c');
    if (!d) return { status: 'missing' };
    const payload = decodePayload(d);
    if (!payload) return { status: 'unreadable' };
    const { valid, code } = verifyPayload(payload, c);
    return { status: valid ? 'valid' : 'invalid', payload, code, providedCode: c };
  }, [params]);

  const GREEN = '#16a34a';
  const RED = '#dc2626';
  const AMBER = '#d97706';
  const INK = '#111827';
  const MUTED = '#6b7280';

  const badge = {
    valid: { color: GREEN, bg: '#f0fdf4', border: '#bbf7d0', title: 'Authentic Document', sub: 'This report card matches its verification code and has not been altered.' },
    invalid: { color: RED, bg: '#fef2f2', border: '#fecaca', title: 'Verification Failed', sub: 'The details do not match the verification code. This document may have been altered or is not genuine.' },
    unreadable: { color: RED, bg: '#fef2f2', border: '#fecaca', title: 'Unreadable Code', sub: 'The verification link is malformed and could not be read.' },
    missing: { color: AMBER, bg: '#fffbeb', border: '#fde68a', title: 'No Document to Verify', sub: 'Open this page by scanning the QR code on a DigiSchool report card.' },
  }[result.status];

  const p = result.payload;
  const rows = p ? [
    ['Student', p.nm],
    ['Admission No.', p.ad],
    ['Class', p.cl],
    ['Examination', p.ex],
    ['Term', p.tm],
    ['Year', p.yr],
    ['Total Marks', p.mk],
    ['Total Points', p.tp],
    ...(p.sc ? [['School', p.sc]] : []),
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', fontFamily: '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif', color: INK }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e3a8a' }}>DigiSchool</div>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer' }}>← Home</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          <div style={{ background: badge.bg, borderBottom: `1px solid ${badge.border}`, padding: '24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', border: `2px solid ${badge.color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke={badge.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {result.status === 'valid'
                  ? <path d="M20 6L9 17l-5-5" />
                  : (result.status === 'missing'
                    ? <><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></>
                    : <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6" /><path d="M9 9l6 6" /></>)}
              </svg>
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: badge.color }}>{badge.title}</div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 1.5, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>{badge.sub}</div>
          </div>

          {p && (
            <div style={{ padding: '8px 24px 20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <tbody>
                  {rows.map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: MUTED, fontWeight: 500, width: 140 }}>{k}</td>
                      <td style={{ padding: '10px 0', fontWeight: 600, textAlign: 'right' }}>{v || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {Array.isArray(p.su) && p.su.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: 6 }}>Subjects</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #e2e8f0' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e2e8f0' }}>Subject</th>
                        <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', width: 70 }}>Marks</th>
                        <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', width: 70 }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.su.map((s, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px' }}>{s.s}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{s.m}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{s.g || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: MUTED }}>
                <span>Verification Code</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1, color: INK }}>{result.code}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 16, lineHeight: 1.6 }}>
          Verification is computed from the document's own data. It confirms the card has not been
          edited since issue; it does not replace confirmation with the issuing school.
        </div>
      </div>
    </div>
  );
}
