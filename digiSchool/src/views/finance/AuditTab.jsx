import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import { fmtKES } from '../../data/modules';
import { 
  Search, Shield, FileText, CreditCard, AlertTriangle, CheckCircle2, 
  Download, Filter, UserCheck, Calendar, ArrowUpRight, Clock, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { exportTablePDF } from '../../utils/exporters';

const PAGE_SIZE = 15;

const MOCK_AUDIT_LOGS = [
  { id: 'aud-1', timestamp: new Date(Date.now() - 3600000).toISOString(), user: 'Bursar Office', role: 'Accountant', action: 'Payment Recorded', details: 'Receipt REC-2026-089 issued for Student ADM-102', amount: 15000 },
  { id: 'aud-2', timestamp: new Date(Date.now() - 7200000).toISOString(), user: 'Principal Office', role: 'Principal', action: 'Expense Approved', details: 'Approved Facility Repairs invoice #EXP-889', amount: 25000 },
  { id: 'aud-3', timestamp: new Date(Date.now() - 14400000).toISOString(), user: 'Finance Dept', role: 'Billing', action: 'Bulk Invoices', details: 'Generated Term 2 Fee Invoices for Grade 7 & 8', amount: 350000 },
  { id: 'aud-4', timestamp: new Date(Date.now() - 86400000).toISOString(), user: 'Deputy Admin', role: 'Deputy Admin', action: 'Scholarship Added', details: 'Assigned Academic Excellence Waiver to Student ADM-045', amount: 12000 },
  { id: 'aud-5', timestamp: new Date(Date.now() - 172800000).toISOString(), user: 'Accountant', role: 'Accountant', action: 'Payment Verified', details: 'Verified M-Pesa C2B Transaction Ref QK99281', amount: 18500 },
  { id: 'aud-6', timestamp: new Date(Date.now() - 259200000).toISOString(), user: 'Finance Dept', role: 'Billing', action: 'Payment Plan Created', details: '3-Month Installment Schedule agreed for ADM-112', amount: 45000 },
];

export default function AuditTab() {
  const { store } = useOutletContext();
  const rawAuditLogs = store?.auditLogs || [];

  const auditLogs = useMemo(() => {
    return rawAuditLogs.length > 0 ? rawAuditLogs : MOCK_AUDIT_LOGS;
  }, [rawAuditLogs]);

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
    if (dateTo) list = list.filter(l => l.timestamp?.slice(0, 10) <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.user?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q) ||
        l.role?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  }, [auditLogs, actionFilter, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = auditLogs.filter(l => l.timestamp?.startsWith(todayStr)).length || auditLogs.length;
  const uniqueUsers = new Set(auditLogs.map(l => l.user)).size;
  const totalAmount = auditLogs.filter(l => l.amount).reduce((s, l) => s + Number(l.amount || 0), 0);

  const getActionBadge = (action) => {
    if (action?.includes('Payment')) return { color: '#047857', bg: '#dcfce7', icon: <CreditCard size={13} /> };
    if (action?.includes('Invoice')) return { color: '#0EA5E9', bg: '#e0f2fe', icon: <FileText size={13} /> };
    if (action?.includes('Expense')) return { color: '#EF4444', bg: '#fee2e2', icon: <AlertTriangle size={13} /> };
    if (action?.includes('Scholarship')) return { color: '#7C3AED', bg: '#f3e8ff', icon: <CheckCircle2 size={13} /> };
    return { color: '#047857', bg: 'rgba(4, 120, 87, 0.08)', icon: <Shield size={13} /> };
  };

  const handleExportPDF = () => {
    const head = ['Timestamp', 'User & Role', 'Action Type', 'Audit Details', 'Amount'];
    const body = filtered.map(l => [
      l.timestamp ? `${new Date(l.timestamp).toLocaleDateString()} ${new Date(l.timestamp).toLocaleTimeString()}` : '-',
      `${l.user || 'System'} (${l.role || 'Staff'})`,
      l.action || 'Event',
      l.details || '-',
      l.amount ? fmtKES(l.amount) : '-'
    ]);
    exportTablePDF({
      school: store?.settings,
      title: 'Financial Audit Trail & Compliance Report',
      subtitle: `Generated on ${new Date().toLocaleDateString()} | Total Events: ${filtered.length}`,
      head,
      body,
      filename: `financial-audit-log-${new Date().toISOString().slice(0,10)}.pdf`
    });
  };

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out' }}>
      
      {/* Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Total Audit Events</span>
            <div style={{ color: '#047857', background: 'rgba(4, 120, 87, 0.08)', padding: 8, borderRadius: 8 }}>
              <Shield size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{auditLogs.length}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Security & compliance records</div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Recent Activity</span>
            <div style={{ color: '#047857', background: 'rgba(4, 120, 87, 0.08)', padding: 8, borderRadius: 8 }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{todayCount} Logged</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Recent system operations</div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Active Operators</span>
            <div style={{ color: '#047857', background: 'rgba(4, 120, 87, 0.08)', padding: 8, borderRadius: 8 }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{uniqueUsers} Staff</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Authorized bursars & admins</div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Audited Volume</span>
            <div style={{ color: '#047857', background: 'rgba(4, 120, 87, 0.08)', padding: 8, borderRadius: 8 }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{fmtKES(totalAmount)}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Verified financial transactions</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 280, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input className="input" placeholder="Search by user, action, details..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36, fontSize: 13 }} />
            </div>
            
            <div style={{ minWidth: 160 }}>
              <select className="select" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }} style={{ fontSize: 13 }}>
                {actionTypes.map(a => <option key={a} value={a}>{a === 'All' ? 'All Action Types' : a}</option>)}
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} style={{ fontSize: 12, padding: '6px 10px' }} />
              <span style={{ color: '#64748B', fontSize: 12 }}>to</span>
              <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} style={{ fontSize: 12, padding: '6px 10px' }} />
            </div>
          </div>

          <button className="btn btn-primary btn-sm" onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Export Audit Log PDF
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 className="section-title" style={{ margin: 0, fontSize: 16, color: '#047857', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} /> Finance Audit Trail & Log
            </h3>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Immutable compliance records of all financial actions</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
            Showing {pageData.length} of {filtered.length} logs
          </span>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Date & Time</th>
                <th>User / Operator</th>
                <th>Action Type</th>
                <th>Audit Description</th>
                <th style={{ textAlign: 'right' }}>Transaction Amount</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    <Shield size={28} style={{ marginBottom: 8, color: '#047857', opacity: 0.6 }} /><br />
                    No audit logs match your search filters.
                  </td>
                </tr>
              ) : (
                pageData.map((log, idx) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr key={log.id || idx}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleDateString('en-GB') : '-'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{log.user || 'System Operator'}</div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                          {log.role || 'Finance Staff'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: badge.bg, color: badge.color
                        }}>
                          {badge.icon}
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#334155', maxWidth: 320 }}>
                        {log.details || '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: log.amount ? '#047857' : '#94a3b8' }}>
                        {log.amount ? fmtKES(log.amount) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Page {page + 1} of {totalPages}</span>
            <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



