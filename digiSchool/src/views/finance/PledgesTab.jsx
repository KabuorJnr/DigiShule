import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow, updateRow } from '../../lib/api';
import { HandHeart, Plus, CheckCircle, XCircle, Package, Search } from 'lucide-react';

const STATUS_COLOR = { Pending: 'amber', Fulfilled: 'green', Cancelled: 'gray' };

export default function PledgesTab() {
  const { store, user, students, pledges = [], setPledges, setPayments, addAuditLog } = useOutletContext();
  const notify = store?.notify || (() => {});

  const [modalOpen, setModalOpen] = useState(false);
  const [fulfilling, setFulfilling] = useState(null); // pledge being fulfilled
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [form, setForm] = useState({
    student_id: '', pledged_by: '', kind: 'cash', amount: '', item: '',
    expected_date: '', notes: ''
  });

  const filtered = useMemo(() => {
    let list = [...pledges];
    if (statusFilter !== 'All') list = list.filter(p => p.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.student_name?.toLowerCase().includes(q) ||
        p.pledged_by?.toLowerCase().includes(q) ||
        p.item?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }, [pledges, statusFilter, search]);

  const totals = useMemo(() => {
    const pending = pledges.filter(p => p.status === 'Pending');
    const pendingValue = pending.reduce((s, p) => s + Number(p.amount || 0), 0);
    const fulfilledValue = pledges.filter(p => p.status === 'Fulfilled').reduce((s, p) => s + Number(p.fulfilled_amount || p.amount || 0), 0);
    const inKindPending = pending.filter(p => p.kind === 'in_kind').length;
    return { pendingCount: pending.length, pendingValue, fulfilledValue, inKindPending };
  }, [pledges]);

  const resetForm = () => setForm({ student_id: '', pledged_by: '', kind: 'cash', amount: '', item: '', expected_date: '', notes: '' });

  const handleAdd = async () => {
    if (!form.pledged_by.trim()) { notify('Who is making the pledge?', 'warning'); return; }
    if (form.kind === 'cash' && !form.amount) { notify('Enter the pledged amount.', 'warning'); return; }
    if (form.kind === 'in_kind' && !form.item.trim()) { notify('Describe the in-kind contribution.', 'warning'); return; }

    const student = students.find(s => s.id === form.student_id);
    const pledge = {
      id: `pledge_${Date.now()}`,
      student_id: form.student_id || null,
      student_name: student?.name || null,
      pledged_by: form.pledged_by.trim(),
      kind: form.kind,
      amount: Number(form.amount || 0),
      item: form.kind === 'in_kind' ? form.item.trim() : null,
      pledge_date: new Date().toISOString().slice(0, 10),
      expected_date: form.expected_date || null,
      status: 'Pending',
      fulfilled_amount: 0,
      notes: form.notes || null,
      recorded_by: user?.name || 'Finance',
      created_at: new Date().toISOString()
    };

    setPledges(prev => [pledge, ...prev]);
    try {
      await upsertRow('payment_pledges', pledge);
      notify(`Pledge from ${pledge.pledged_by} recorded.`, 'success');
      addAuditLog?.('Pledge Recorded', `${pledge.kind === 'in_kind' ? 'In-kind' : 'Cash'} pledge by ${pledge.pledged_by}${student ? ` for ${student.name}` : ''}`, pledge.amount);
      setModalOpen(false);
      resetForm();
    } catch (e) {
      setPledges(prev => prev.filter(p => p.id !== pledge.id));
      notify(`Could not save pledge: ${e.message}`, 'error');
    }
  };

  const openFulfil = (pledge) => {
    setFulfilling({ ...pledge, fulfil_amount: pledge.amount, ref: '' });
  };

  const handleFulfil = async () => {
    const pledge = fulfilling;
    const value = Number(pledge.fulfil_amount || pledge.amount || 0);
    const isInKind = pledge.kind === 'in_kind';

    // Fulfilling a pledge posts a real payment to the ledger, so the money (or
    // its in-kind equivalent) actually reflects against the student balance.
    const payment = {
      id: `pay_${Date.now()}`,
      invoice_id: null,
      student_id: pledge.student_id || null,
      amount: value,
      method: isInKind ? 'In-Kind' : 'Pledge Settlement',
      ref: pledge.ref || pledge.id,
      date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    };
    // In-kind columns only when applicable (keeps cash settlements resilient if
    // the in_kind/description migration hasn't run yet).
    if (isInKind) {
      payment.in_kind = true;
      payment.description = pledge.item || null;
    }

    const updatedPledge = { ...pledge, status: 'Fulfilled', fulfilled_amount: value, payment_id: payment.id };
    delete updatedPledge.fulfil_amount;
    delete updatedPledge.ref;

    setPledges(prev => prev.map(p => (p.id === pledge.id ? updatedPledge : p)));
    try {
      if (pledge.student_id) {
        await upsertRow('financePayments', payment);
        if (setPayments) setPayments(prev => [payment, ...prev]);
      }
      await upsertRow('payment_pledges', updatedPledge);
      notify(`Pledge fulfilled${pledge.student_id ? ' and posted to payments' : ''}.`, 'success');
      addAuditLog?.('Pledge Fulfilled', `${isInKind ? 'In-kind' : 'Cash'} pledge by ${pledge.pledged_by} settled`, value);
      setFulfilling(null);
    } catch (e) {
      setPledges(prev => prev.map(p => (p.id === pledge.id ? pledge : p)));
      notify(`Could not fulfil pledge: ${e.message}`, 'error');
    }
  };

  const handleCancel = async (pledge) => {
    if (!window.confirm(`Cancel the pledge from ${pledge.pledged_by}?`)) return;
    const updated = { ...pledge, status: 'Cancelled' };
    setPledges(prev => prev.map(p => (p.id === pledge.id ? updated : p)));
    try {
      await updateRow('payment_pledges', pledge.id, { status: 'Cancelled' });
      notify('Pledge cancelled.', 'info');
    } catch (e) {
      setPledges(prev => prev.map(p => (p.id === pledge.id ? pledge : p)));
      notify(`Could not cancel: ${e.message}`, 'error');
    }
  };

  return (
    <div>
      <div className="stat-tiles" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 12 }}>Pending Pledges</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totals.pendingCount}</div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 12 }}>Pending Value</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>{fmtKES(totals.pendingValue)}</div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 12 }}>Fulfilled Value</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#047857' }}>{fmtKES(totals.fulfilledValue)}</div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 12 }}>In-Kind Pending</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0EA5E9' }}>{totals.inKindPending}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HandHeart size={18} color="#0EA5E9" /> Payment Pledges & In-Kind Contributions
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input className="input" placeholder="Search pledges..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, width: 200 }} />
            </div>
            <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option>All</option><option>Pending</option><option>Fulfilled</option><option>Cancelled</option>
            </select>
            <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }}>
              <Plus size={16} /> Record Pledge
            </button>
          </div>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Pledged By</th><th>Student</th><th>Type</th><th>Value / Item</th>
                <th>Pledged</th><th>Expected</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>No pledges recorded.</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.pledged_by}</td>
                  <td className="muted">{p.student_name || '—'}</td>
                  <td>
                    {p.kind === 'in_kind'
                      ? <Badge color="blue"><Package size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />In-Kind</Badge>
                      : <Badge color="gray">Cash</Badge>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{fmtKES(p.amount)}</div>
                    {p.kind === 'in_kind' && p.item && <div className="muted" style={{ fontSize: 12 }}>{p.item}</div>}
                  </td>
                  <td className="muted">{p.pledge_date}</td>
                  <td className="muted">{p.expected_date || '—'}</td>
                  <td><Badge color={STATUS_COLOR[p.status] || 'gray'}>{p.status}</Badge></td>
                  <td>
                    {p.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" style={{ color: '#047857', borderColor: '#86efac', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => openFulfil(p)}>
                          <CheckCircle size={14} /> Fulfil
                        </button>
                        <button className="btn btn-sm" style={{ color: '#EF4444', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => handleCancel(p)}>
                          <XCircle size={14} /> Cancel
                        </button>
                      </div>
                    )}
                    {p.status === 'Fulfilled' && <span className="muted" style={{ fontSize: 12 }}>Settled {fmtKES(p.fulfilled_amount)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Pledge Modal */}
      {modalOpen && (
        <Modal title="Record a Pledge" onClose={() => setModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd}>Save Pledge</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Pledged By (Parent / Sponsor) *</label>
              <input className="input" placeholder="e.g. Mr. John Otieno" value={form.pledged_by} onChange={e => setForm(f => ({ ...f, pledged_by: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Link to Student (optional)</label>
              <select className="select" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                <option value="">— None / General —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no || s.adm || '—'})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Pledge Type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={`btn btn-sm${form.kind === 'cash' ? ' btn-primary' : ''}`} onClick={() => setForm(f => ({ ...f, kind: 'cash' }))}>Cash</button>
              <button className={`btn btn-sm${form.kind === 'in_kind' ? ' btn-primary' : ''}`} onClick={() => setForm(f => ({ ...f, kind: 'in_kind' }))}>In-Kind</button>
            </div>
          </div>
          {form.kind === 'in_kind' && (
            <div style={{ marginTop: 12 }}>
              <label className="field-label">In-Kind Contribution *</label>
              <input className="input" placeholder="e.g. 20 bags of maize, 50 iron sheets" value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} />
            </div>
          )}
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">{form.kind === 'in_kind' ? 'Assessed Value (KES)' : 'Amount (KES) *'}</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Expected Date</label>
              <input type="date" className="input" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </Modal>
      )}

      {/* Fulfil Pledge Modal */}
      {fulfilling && (
        <Modal title="Fulfil Pledge" onClose={() => setFulfilling(null)} footer={
          <>
            <button className="btn" onClick={() => setFulfilling(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleFulfil}>Confirm Fulfilment</button>
          </>
        }>
          <p style={{ marginTop: 0 }}>
            Recording fulfilment of the {fulfilling.kind === 'in_kind' ? 'in-kind' : 'cash'} pledge from <strong>{fulfilling.pledged_by}</strong>
            {fulfilling.student_name ? <> for <strong>{fulfilling.student_name}</strong></> : ''}.
          </p>
          {fulfilling.kind === 'in_kind' && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 13 }}>
              Item: <strong>{fulfilling.item}</strong>
            </div>
          )}
          <label className="field-label">{fulfilling.kind === 'in_kind' ? 'Assessed Value (KES)' : 'Amount Received (KES)'}</label>
          <input type="number" className="input" value={fulfilling.fulfil_amount} onChange={e => setFulfilling(f => ({ ...f, fulfil_amount: e.target.value }))} />
          <label className="field-label" style={{ marginTop: 12 }}>Reference / Receipt No.</label>
          <input className="input" placeholder="Optional" value={fulfilling.ref} onChange={e => setFulfilling(f => ({ ...f, ref: e.target.value }))} />
          {fulfilling.student_id
            ? <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>This will post a payment to the student's finance ledger.</div>
            : <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>No student linked — this is recorded as a general contribution only.</div>}
        </Modal>
      )}
    </div>
  );
}
