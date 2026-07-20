import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import { fmtKES } from '../../data/modules';
import { Search, Shield, FileText, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';

const PAGE_SIZE = 25;
const ACTION_COLORS = {
  'Payment Recorded': '#047857',
  'Invoice Generated': '#047857',
  'Bulk Invoices': '#047857',
  'Expense Submitted': '#F59E0B',
  'Expense Approved': '#047857',
  'Expense Rejected': '#EF4444',
  'Budget Modified': '#047857',
  'Scholarship Added': '#EC4899',
  'Payment Plan Created': '#047857',
  'Payment Verified': '#047857'
};

export default function AuditTab() {
  const { store } = useOutletContext();
  const auditLogs = store?.auditLogs || [];

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  // Get unique action types
  const actionTypes = useMemo(() => {
    const types = new Set(auditLogs.map(l => l.action));
    return ['All', ...Array.from(types).sort()];
  }, [auditLogs]);

  // Filter
  const filtered = useMemo(() => {
    let list = [...auditLogs];
    if (actionFilter !== 'All') list = list.filter(l => l.action === actionFilter);
    if (dateFrom) list = list.filter(l => l.timestamp >= dateFrom);
    if (dateTo) list = list.filter(l => l.timestamp.slice(0, 10) <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.user?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  }, [auditLogs, actionFilter, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = auditLogs.filter(l => l.timestamp?.startsWith(todayStr)).length;
  const uniqueUsers = new Set(auditLogs.map(l => l.user)).size;
  const totalAmount = auditLogs.filter(l => l.amount).reduce((s, l) => s + Number(l.amount || 0), 0);

  const getActionIcon = (action) => {
    if (action.includes('Payment')) return <CreditCard size={14} />;
    if (action.includes('Invoice')) return <FileText size={14} />;
    if (action.includes('Expense')) return <AlertTriangle size={14} />;
    return <Shield size={14} />;
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #047857' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Events</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{auditLogs.length}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #047857' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Activity</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{todayCount}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #047857' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unique Users</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{uniqueUsers}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #F59E0B' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Amount Logged</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>{fmtKES(totalAmount)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="field-label">Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" placeholder="Search by user, action, details..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <div>
            <label className="field-label">Action Type</label>
            <select className="select" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }}>
              {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">From</label>
            <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} />
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} /> Finance Audit Trail
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {filtered.length} events {search || actionFilter !== 'All' || dateFrom || dateTo ? '(filtered)' : ''}
          </div>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                  <Shield size={24} style={{ marginBottom: 8, opacity: 0.5 }} /><br />
                  {auditLogs.length === 0
                    ? 'No audit events recorded yet. Actions will be logged automatically as you use the finance module.'
                    : 'No events match your filters.'}
                </td></tr>
              )}
              {pageData.map((log, idx) => (
                <tr key={log.id || idx}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    <div>{log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'â€”'}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{log.user || 'System'}</td>
                  <td>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: `${ACTION_COLORS[log.action] || '#64748B'}15`,
                      color: ACTION_COLORS[log.action] || '#64748B'
                    }}>
                      {getActionIcon(log.action)}
                      {log.action}
                    </div>
                  </td>
                  <td style={{ maxWidth: 300, fontSize: 13, color: 'var(--text-muted)' }}>{log.details}</td>
                  <td style={{ textAlign: 'right', fontWeight: log.amount ? 600 : 400 }}>
                    {log.amount ? fmtKES(log.amount) : 'â€”'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>â† Previous</button>
            <span className="muted" style={{ fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
            <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next â†’</button>
          </div>
        )}
      </div>
    </div>
  );
}



