import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { exportTablePDF } from '../../utils/exporters';
import { 
  AlertTriangle, Send, Search, Filter, Users, ChevronDown, ChevronUp, 
  Download, CreditCard, Clock, AlertCircle, ShieldAlert, ChevronLeft, ChevronRight 
} from 'lucide-react';

const PAGE_SIZE = 15;

export default function DefaultersTab() {
  const { invoices, payments, students, store } = useOutletContext();
  const notify = store?.notify || (() => {});
  const schoolName = store?.settings?.name || 'Our School';

  const [classFilter, setClassFilter] = useState('All');
  const [minBalance, setMinBalance] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('balance');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  // Bulk notification state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(
    'Dear Parent/Guardian,\n\nThis is a reminder that {student_name} has an outstanding fee balance of {balance}.\n\nPlease make arrangements to clear this balance at your earliest convenience.\n\nThank you,\n{school_name}'
  );

  const classOptions = useMemo(() => {
    const classes = new Set(students.map(s => s.class));
    return ['All', ...Array.from(classes).filter(Boolean).sort()];
  }, [students]);

  // Build defaulter list
  const defaulters = useMemo(() => {
    const studentMap = {};
    const termFee = Number(store?.settings?.term_fee || store?.settings?.termFee || 25000);

    students.forEach(s => {
      if (s.status === 'Inactive' || s.status === 'Graduated') return;
      
      const billed = Number(s.fee_billed || s.total_billed || termFee);
      const paid = Number(s.fee_paid || s.total_paid || 0);
      const initialBal = Number(s.fee_balance !== undefined ? s.fee_balance : (s.balance !== undefined ? s.balance : (billed - paid)));

      studentMap[s.id] = {
        ...s,
        totalBilled: billed,
        totalPaid: paid,
        balance: initialBal,
        oldestDueDate: s.oldestDueDate || '2026-05-01',
        daysOverdue: 0,
        invoiceBilled: 0
      };
    });

    // Accumulate from actual invoices if present
    invoices.forEach(i => {
      if (studentMap[i.student_id]) {
        if (i.status === 'Draft' || i.status === 'Canceled') return;
        studentMap[i.student_id].invoiceBilled += Number(i.amount || 0);
        const dueDate = i.due_date || i.created_at?.slice(0, 10);
        if (dueDate && i.status !== 'Paid') {
          if (!studentMap[i.student_id].oldestDueDate || dueDate < studentMap[i.student_id].oldestDueDate) {
            studentMap[i.student_id].oldestDueDate = dueDate;
          }
        }
      }
    });

    // Accumulate from actual payments if present
    payments.forEach(p => {
      if (studentMap[p.student_id]) {
        studentMap[p.student_id].totalPaid += Number(p.amount || 0);
      }
    });

    const today = new Date();
    return Object.values(studentMap)
      .map(s => {
        if (s.invoiceBilled > 0) {
          s.totalBilled = s.invoiceBilled;
        }
        s.balance = Math.max(0, s.totalBilled - s.totalPaid);
        if (s.oldestDueDate) {
          const due = new Date(s.oldestDueDate);
          s.daysOverdue = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
        } else {
          s.daysOverdue = 45;
        }
        return s;
      })
      .filter(s => s.balance > 0);
  }, [students, invoices, payments, store?.settings]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = [...defaulters];
    if (classFilter !== 'All') list = list.filter(s => s.class === classFilter);
    if (minBalance) list = list.filter(s => s.balance >= Number(minBalance));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.adm_no?.toLowerCase().includes(q) ||
        s.class?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [defaulters, classFilter, minBalance, search, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalOutstanding = filtered.reduce((s, d) => s + d.balance, 0);

  const getAgingBadge = (days) => {
    if (days >= 90) return { label: `Critical (${days}d)`, color: '#EF4444', bg: '#fee2e2' };
    if (days >= 30) return { label: `Overdue (${days}d)`, color: '#D97706', bg: '#fef3c7' };
    return { label: `Pending (${days}d)`, color: '#047857', bg: 'rgba(4, 120, 87, 0.1)' };
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const sendReminder = async (student) => {
    const message = messageTemplate
      .replace(/{student_name}/g, student.name)
      .replace(/{balance}/g, fmtKES(student.balance))
      .replace(/{school_name}/g, schoolName);

    const notif = {
      id: `notif_reminder_${Date.now()}_${student.id}`,
      title: 'Fee Balance Reminder',
      message,
      body: message,
      posted_by: 'Finance Department',
      role: 'Billing',
      audience: [student.id],
      read: false,
      created_at: new Date().toISOString()
    };

    try {
      await upsertRow('notifications', notif);
      notify(`Reminder sent to ${student.name}'s parent.`, 'success');
    } catch (e) {
      notify(`Failed to send: ${e.message}`, 'error');
    }
  };

  const handleBulkSend = async () => {
    const count = filtered.length;
    if (count === 0) { notify('No defaulters to notify.', 'warning'); return; }

    setBulkModalOpen(false);
    notify(`Sending reminders to ${count} parents...`, 'info');

    let sent = 0;
    for (const student of filtered) {
      const message = messageTemplate
        .replace(/{student_name}/g, student.name)
        .replace(/{balance}/g, fmtKES(student.balance))
        .replace(/{school_name}/g, schoolName);

      try {
        await upsertRow('notifications', {
          id: `notif_reminder_${Date.now()}_${student.id}`,
          title: 'Fee Balance Reminder',
          message,
          body: message,
          posted_by: 'Finance Department',
          role: 'Billing',
          audience: [student.id],
          read: false,
          created_at: new Date().toISOString()
        });
        sent++;
      } catch (e) {
        console.warn(`Failed for ${student.name}:`, e.message);
      }
    }
    notify(`Reminders sent to ${sent}/${count} parents.`, 'success');
  };

  const handleExportPDF = () => {
    const head = ['Student', 'Adm No', 'Class', 'Total Billed', 'Amount Paid', 'Outstanding Balance', 'Aging Status'];
    const body = filtered.map(d => [
      d.name,
      d.adm_no || '-',
      d.class || '-',
      fmtKES(d.totalBilled),
      fmtKES(d.totalPaid),
      fmtKES(d.balance),
      getAgingBadge(d.daysOverdue).label
    ]);
    exportTablePDF({
      school: store?.settings,
      title: 'Fee Defaulters & Outstanding Balances Summary',
      subtitle: `Generated on ${new Date().toLocaleDateString()} | Total Defaulters: ${filtered.length} | Total Outstanding: ${fmtKES(totalOutstanding)}`,
      head,
      body,
      filename: `fee-defaulters-${new Date().toISOString().slice(0,10)}.pdf`
    });
  };

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out' }}>
      
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Total Defaulters</span>
            <div style={{ color: '#EF4444', background: '#fee2e2', padding: 8, borderRadius: 8 }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{filtered.length} Students</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Enrolled active fee balance</div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Total Outstanding</span>
            <div style={{ color: '#D97706', background: '#fef3c7', padding: 8, borderRadius: 8 }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444', marginTop: 4 }}>{fmtKES(totalOutstanding)}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Total pending fee arrears</div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Critical Arrears (90+d)</span>
            <div style={{ color: '#EF4444', background: '#fee2e2', padding: 8, borderRadius: 8 }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#EF4444', marginTop: 4 }}>
            {filtered.filter(d => d.daysOverdue >= 90).length}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>High collection priority</div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Average Outstanding</span>
            <div style={{ color: '#047857', background: 'rgba(4, 120, 87, 0.08)', padding: 8, borderRadius: 8 }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
            {fmtKES(filtered.length > 0 ? totalOutstanding / filtered.length : 0)}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Per defaulting student account</div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 280, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input className="input" placeholder="Search by name or adm no..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36, fontSize: 13 }} />
            </div>

            <div style={{ minWidth: 140 }}>
              <select className="select" value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(0); }} style={{ fontSize: 13 }}>
                {classOptions.map(c => <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>)}
              </select>
            </div>

            <div style={{ minWidth: 130 }}>
              <input className="input" type="number" placeholder="Min KES (e.g. 5000)" value={minBalance} onChange={e => { setMinBalance(e.target.value); setPage(0); }} style={{ fontSize: 12 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm" onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Export Defaulters PDF
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setBulkModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={14} /> Notify All Defaulters ({filtered.length})
            </button>
          </div>
        </div>
      </div>

      {/* Defaulters Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 className="section-title" style={{ margin: 0, fontSize: 16, color: '#047857', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} /> Student Fee Defaulters Registry
            </h3>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Manage fee balances and send parent SMS reminders</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Showing {pageData.length} of {filtered.length} defaulters</span>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>Student Name <SortIcon col="name" /></th>
                <th>ADM NO</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('class')}>Class <SortIcon col="class" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalBilled')}>Total Billed <SortIcon col="totalBilled" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalPaid')}>Amount Paid <SortIcon col="totalPaid" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('balance')}>Outstanding Balance <SortIcon col="balance" /></th>
                <th style={{ textAlign: 'center' }}>Payment Progress</th>
                <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('daysOverdue')}>Aging Status <SortIcon col="daysOverdue" /></th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    <AlertTriangle size={28} style={{ marginBottom: 8, color: '#047857', opacity: 0.6 }} /><br />
                    No defaulters found matching your filters.
                  </td>
                </tr>
              ) : (
                pageData.map(d => {
                  const aging = getAgingBadge(d.daysOverdue);
                  const pctPaid = d.totalBilled > 0 ? Math.round((d.totalPaid / d.totalBilled) * 100) : 0;
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: '50%', background: 'rgba(4, 120, 87, 0.1)', 
                            color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 
                          }}>
                            {d.name ? d.name.slice(0, 2).toUpperCase() : 'ST'}
                          </div>
                          <span>{d.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{d.adm_no || d.adm || '-'}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, color: '#334155' }}>
                          {d.class || '-'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{fmtKES(d.totalBilled)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13, color: '#047857', fontWeight: 600 }}>{fmtKES(d.totalPaid)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#EF4444', fontSize: 13 }}>{fmtKES(d.balance)}</td>
                      
                      <td style={{ textAlign: 'center', minWidth: 120 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>{pctPaid}% Paid</div>
                        <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pctPaid)}%`, height: '100%', background: '#047857', borderRadius: 4 }} />
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          background: aging.bg, color: aging.color
                        }}>
                          {aging.label}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => sendReminder(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px' }}>
                          <Send size={12} /> Remind
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* Bulk Notification Modal */}
      {bulkModalOpen && (
        <Modal title="Send Bulk Fee Reminders" onClose={() => setBulkModalOpen(false)} wide footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setBulkModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBulkSend} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={16} /> Send to {filtered.length} Parents
            </button>
          </div>
        }>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.2)', marginBottom: 16 }}>
              <AlertTriangle size={18} style={{ color: '#D97706' }} />
              <span style={{ fontSize: 13 }}>This will dispatch fee notifications to <strong>{filtered.length} parents</strong> of defaulting students.</span>
            </div>

            <label className="field-label">Message Template</label>
            <textarea
              className="input"
              rows={6}
              value={messageTemplate}
              onChange={e => setMessageTemplate(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Available placeholders: <code>{'{student_name}'}</code>, <code>{'{balance}'}</code>, <code>{'{school_name}'}</code>
            </div>
          </div>

          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#0F172A' }}>Preview (first student):</div>
            {filtered.length > 0 && (
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155' }}>
                {messageTemplate
                  .replace(/{student_name}/g, filtered[0].name)
                  .replace(/{balance}/g, fmtKES(filtered[0].balance))
                  .replace(/{school_name}/g, schoolName)}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
