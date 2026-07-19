import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow, updateRow } from '../../lib/api';
import { Calendar, Plus, CheckCircle, Clock, AlertTriangle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function PaymentPlansTab() {
  const { students, payments, store } = useOutletContext();
  const notify = store?.notify || (() => {});
  const paymentPlans = store?.paymentPlans || [];
  const setPaymentPlans = store?.setPaymentPlans || (() => {});

  const [modalOpen, setModalOpen] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [form, setForm] = useState({
    student_id: '',
    total_amount: '',
    installment_count: 3,
    start_date: new Date().toISOString().slice(0, 10),
    interval_days: 30
  });

  // Build computed plan data by matching payments
  const enrichedPlans = useMemo(() => {
    return paymentPlans.map(plan => {
      const studentPayments = payments.filter(p => p.student_id === plan.student_id);
      const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const student = students.find(s => s.id === plan.student_id);

      const installments = (plan.installments || []).map(inst => {
        const isPaid = totalPaid >= inst.cumulative_amount;
        const isPartial = !isPaid && totalPaid > (inst.cumulative_amount - inst.amount);
        return { ...inst, isPaid, isPartial };
      });

      const today = new Date().toISOString().slice(0, 10);
      const nextDue = installments.find(i => !i.isPaid);
      const isOverdue = nextDue && nextDue.due_date < today;
      const isCompleted = installments.every(i => i.isPaid);

      return {
        ...plan,
        student,
        totalPaid: Math.min(totalPaid, plan.total_amount),
        installments,
        nextDue,
        isOverdue,
        isCompleted,
        progress: Math.min(100, (totalPaid / plan.total_amount) * 100)
      };
    });
  }, [paymentPlans, payments, students]);

  const handleCreate = async () => {
    if (!form.student_id || !form.total_amount) {
      notify('Student and total amount are required.', 'error');
      return;
    }

    const total = Number(form.total_amount);
    const count = Number(form.installment_count);
    const perInstallment = Math.floor(total / count);
    const remainder = total - (perInstallment * (count - 1));

    const installments = [];
    let cumulative = 0;
    for (let i = 0; i < count; i++) {
      const amount = i === count - 1 ? remainder : perInstallment;
      cumulative += amount;
      const dueDate = new Date(form.start_date);
      dueDate.setDate(dueDate.getDate() + (i * Number(form.interval_days)));
      installments.push({
        number: i + 1,
        amount,
        cumulative_amount: cumulative,
        due_date: dueDate.toISOString().slice(0, 10)
      });
    }

    const plan = {
      id: `plan_${Date.now()}`,
      student_id: form.student_id,
      total_amount: total,
      installments,
      created_at: new Date().toISOString(),
      status: 'Active'
    };

    const updated = [plan, ...paymentPlans];
    setPaymentPlans(updated);
    setModalOpen(false);
    setForm({ student_id: '', total_amount: '', installment_count: 3, start_date: new Date().toISOString().slice(0, 10), interval_days: 30 });
    notify('Payment plan created successfully.', 'success');

    try {
      await upsertRow('payment_plans', plan);
    } catch (e) {
      console.warn('Could not persist plan:', e.message);
    }
  };

  const handleDelete = async (planId) => {
    if (!confirm('Delete this payment plan?')) return;
    const updated = paymentPlans.filter(p => p.id !== planId);
    setPaymentPlans(updated);
    notify('Payment plan deleted.', 'info');
  };

  const getStatusBadge = (plan) => {
    if (plan.isCompleted) return <Badge color="green"><CheckCircle size={12} style={{ marginRight: 4 }} />Completed</Badge>;
    if (plan.isOverdue) return <Badge color="red"><AlertTriangle size={12} style={{ marginRight: 4 }} />Overdue</Badge>;
    return <Badge color="blue"><Clock size={12} style={{ marginRight: 4 }} />On Track</Badge>;
  };

  // Stats
  const activeCount = enrichedPlans.filter(p => !p.isCompleted).length;
  const overdueCount = enrichedPlans.filter(p => p.isOverdue).length;
  const completedCount = enrichedPlans.filter(p => p.isCompleted).length;
  const totalPlanValue = enrichedPlans.reduce((s, p) => s + p.total_amount, 0);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #3B82F6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Plans</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{activeCount}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #EF4444' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overdue</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#EF4444' }}>{overdueCount}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #10B981' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#10B981' }}>{completedCount}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #8B5CF6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Plan Value</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>{fmtKES(totalPlanValue)}</div>
        </div>
      </div>

      {/* Plans Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Payment Plans</div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Create Plan
          </button>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Student</th>
                <th>Total Amount</th>
                <th>Paid So Far</th>
                <th>Progress</th>
                <th>Next Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedPlans.length === 0 && (
                <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                  No payment plans created yet. Click "Create Plan" to get started.
                </td></tr>
              )}
              {enrichedPlans.map(plan => (
                <>
                  <tr key={plan.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                    <td>
                      {expandedPlan === plan.id
                        ? <ChevronDown size={16} className="muted" />
                        : <ChevronRight size={16} className="muted" />
                      }
                    </td>
                    <td style={{ fontWeight: 600 }}>{plan.student?.name || plan.student_id}</td>
                    <td>{fmtKES(plan.total_amount)}</td>
                    <td>{fmtKES(plan.totalPaid)}</td>
                    <td style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${plan.progress}%`,
                            height: '100%',
                            background: plan.isCompleted ? '#10B981' : plan.isOverdue ? '#EF4444' : '#3B82F6',
                            borderRadius: 4,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>{plan.progress.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      {plan.nextDue
                        ? <span style={{ fontSize: 13 }}>{plan.nextDue.due_date} — {fmtKES(plan.nextDue.amount)}</span>
                        : <span className="muted">—</span>
                      }
                    </td>
                    <td>{getStatusBadge(plan)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }} style={{ color: '#EF4444', borderColor: '#fca5a5', padding: '4px 8px' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  {expandedPlan === plan.id && (
                    <tr key={`${plan.id}-detail`}>
                      <td colSpan={8} style={{ padding: '0 16px 16px 48px', background: 'var(--surface)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 12 }}>Installment Schedule</div>
                        <table className="table" style={{ fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Due Date</th>
                              <th>Amount</th>
                              <th>Cumulative</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.installments.map(inst => (
                              <tr key={inst.number}>
                                <td>{inst.number}</td>
                                <td>{inst.due_date}</td>
                                <td>{fmtKES(inst.amount)}</td>
                                <td className="muted">{fmtKES(inst.cumulative_amount)}</td>
                                <td>
                                  {inst.isPaid
                                    ? <Badge color="green">Paid</Badge>
                                    : inst.isPartial
                                      ? <Badge color="amber">Partial</Badge>
                                      : <Badge color="gray">Pending</Badge>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Plan Modal */}
      {modalOpen && (
        <Modal title="Create Payment Plan" onClose={() => setModalOpen(false)} footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate}>Create Plan</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Student *</label>
              <select className="select" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                <option value="">-- Select Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no})</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Total Amount (KES) *</label>
                <input type="number" className="input" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Number of Installments</label>
                <select className="select" value={form.installment_count} onChange={e => setForm(f => ({ ...f, installment_count: e.target.value }))}>
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} installments</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Start Date</label>
                <input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Interval (days)</label>
                <select className="select" value={form.interval_days} onChange={e => setForm(f => ({ ...f, interval_days: e.target.value }))}>
                  <option value={14}>Every 2 weeks</option>
                  <option value={30}>Monthly (30 days)</option>
                  <option value={60}>Every 2 months</option>
                  <option value={90}>Quarterly</option>
                </select>
              </div>
            </div>

            {form.total_amount && (
              <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Preview</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {Number(form.installment_count)} installments of approximately <strong>{fmtKES(Math.floor(Number(form.total_amount) / Number(form.installment_count)))}</strong> each,
                  starting {form.start_date}, every {form.interval_days} days.
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
