import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { AlertTriangle, Send, Search, Filter, Users, ChevronDown, ChevronUp } from 'lucide-react';

const PAGE_SIZE = 25;

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
    students.forEach(s => {
      if (s.status === 'Inactive' || s.status === 'Graduated') return;
      studentMap[s.id] = {
        ...s,
        totalBilled: 0,
        totalPaid: 0,
        balance: 0,
        oldestDueDate: null,
        daysOverdue: 0
      };
    });

    invoices.forEach(i => {
      if (studentMap[i.student_id]) {
        if (i.status === 'Draft' || i.status === 'Canceled') return;
        studentMap[i.student_id].totalBilled += Number(i.amount);
        const dueDate = i.due_date || i.created_at?.slice(0, 10);
        if (dueDate && i.status !== 'Paid') {
          if (!studentMap[i.student_id].oldestDueDate || dueDate < studentMap[i.student_id].oldestDueDate) {
            studentMap[i.student_id].oldestDueDate = dueDate;
          }
        }
      }
    });

    payments.forEach(p => {
      if (studentMap[p.student_id]) {
        studentMap[p.student_id].totalPaid += Number(p.amount);
      }
    });

    const today = new Date();
    return Object.values(studentMap)
      .map(s => {
        s.balance = s.totalBilled - s.totalPaid;
        if (s.oldestDueDate) {
          const due = new Date(s.oldestDueDate);
          s.daysOverdue = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
        }
        return s;
      })
      .filter(s => s.balance > 0);
  }, [students, invoices, payments]);

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

  const getAgingColor = (days) => {
    if (days >= 90) return '#EF4444';
    if (days >= 30) return '#F59E0B';
    return '#047857';
  };

  const getAgingLabel = (days) => {
    if (days >= 90) return 'Critical';
    if (days >= 60) return 'Overdue';
    if (days >= 30) return 'Warning';
    return 'Current';
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

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #EF4444' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Defaulters</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{filtered.length}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #F59E0B' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8, color: '#EF4444' }}>{fmtKES(totalOutstanding)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #047857' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Critical (90+ days)</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#EF4444' }}>{filtered.filter(d => d.daysOverdue >= 90).length}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #047857' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Balance</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>{fmtKES(filtered.length > 0 ? totalOutstanding / filtered.length : 0)}</div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="field-label">Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" placeholder="Search by name or adm no..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <div>
            <label className="field-label">Class</label>
            <select className="select" value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(0); }}>
              {classOptions.map(c => <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Min Balance (KES)</label>
            <input className="input" type="number" placeholder="e.g. 5000" value={minBalance} onChange={e => { setMinBalance(e.target.value); setPage(0); }} style={{ width: 140 }} />
          </div>
          <button className="btn btn-primary" onClick={() => setBulkModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Send size={16} /> Notify All Defaulters ({filtered.length})
          </button>
        </div>
      </div>

      {/* Defaulters Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Fee Defaulters</div>
          <div className="muted" style={{ fontSize: 13 }}>Showing {pageData.length} of {filtered.length}</div>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>Student <SortIcon col="name" /></th>
                <th>Adm No</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('class')}>Class <SortIcon col="class" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalBilled')}>Billed <SortIcon col="totalBilled" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalPaid')}>Paid <SortIcon col="totalPaid" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('balance')}>Balance <SortIcon col="balance" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('daysOverdue')}>Status <SortIcon col="daysOverdue" /></th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 && (
                <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                  <AlertTriangle size={24} style={{ marginBottom: 8, opacity: 0.5 }} /><br />No defaulters found matching your filters.
                </td></tr>
              )}
              {pageData.map(d => (
                <tr key={d.id} style={{ borderLeft: `3px solid ${getAgingColor(d.daysOverdue)}` }}>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td className="muted">{d.adm_no}</td>
                  <td>{d.class}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(d.totalBilled)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(d.totalPaid)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>{fmtKES(d.balance)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <Badge color={d.daysOverdue >= 90 ? 'red' : d.daysOverdue >= 30 ? 'amber' : 'green'}>
                      {getAgingLabel(d.daysOverdue)} {d.daysOverdue > 0 ? `(${d.daysOverdue}d)` : ''}
                    </Badge>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => sendReminder(d)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <Send size={12} /> Remind
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>â† Previous</button>
            <span className="muted" style={{ fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
            <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next \u2192</button>
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
              <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: 13 }}>This will send a notification to <strong>{filtered.length} parents</strong> of students with outstanding balances.</span>
            </div>

            <label className="field-label">Message Template</label>
            <textarea
              className="input"
              rows={8}
              value={messageTemplate}
              onChange={e => setMessageTemplate(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Available placeholders: <code>{'{student_name}'}</code>, <code>{'{balance}'}</code>, <code>{'{school_name}'}</code>
            </div>
          </div>

          <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Preview (first student):</div>
            {filtered.length > 0 && (
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                {messageTemplate
                  .replace(/{student_name}/g, filtered[0].name)
                  .replace(/{balance}/g, fmtKES(filtered[0].balance))
                  .replace(/{school_name}/g, schoolName)
                }
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}



