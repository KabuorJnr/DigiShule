import React from 'react';
import { reportError } from '../lib/errorReporter';

// Last-line-of-defence UI. Any uncaught render error in the tree lands here
// so the user sees a real recovery affordance instead of a blank white page.
// Every catch is reported so we know it happened.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, 'react.render', { componentStack: info?.componentStack });
  }

  reset = () => this.setState({ error: null });

  reload = () => { window.location.reload(); };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          maxWidth: 520, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
          padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>
            Something broke
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 600, color: '#111827' }}>
            The page couldn&apos;t render.
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
            An unexpected error happened. Your work up to this point is safe on the server.
            Try reloading, or head back to the dashboard.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={this.reload}
              style={{ height: 36, padding: '0 16px', borderRadius: 6, background: '#111827', color: '#fff', border: '1px solid #111827', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Reload page
            </button>
            <button onClick={() => { this.reset(); window.location.href = '/portal/overview'; }}
              style={{ height: 36, padding: '0 16px', borderRadius: 6, background: '#fff', color: '#111827', border: '1px solid #d1d5db', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Go to dashboard
            </button>
            <button onClick={() => {
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch (e) {
                console.error(e);
              }
              window.location.href = '/login';
            }}
              style={{ height: 36, padding: '0 14px', borderRadius: 6, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Sign Out & Reset Session
            </button>
          </div>

          <details style={{ marginTop: 16, fontSize: 12, color: '#475569', background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Technical error details (Click to expand)</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const txt = String(this.state.error?.stack || this.state.error?.message || this.state.error);
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(txt);
                    alert('Error details copied to clipboard');
                  }
                }}
                style={{ padding: '2px 8px', fontSize: 11, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', color: '#334155' }}
              >
                Copy error
              </button>
            </summary>
            <pre style={{ marginTop: 8, padding: 10, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, overflowX: 'auto', fontSize: 11, lineHeight: 1.5, color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
