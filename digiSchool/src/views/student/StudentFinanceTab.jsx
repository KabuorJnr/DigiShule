import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge, KpiCard, ProgressBar } from '../../components/widgets';
import { Calendar, CheckCircle2, DollarSign, AlertTriangle } from 'lucide-react';
import Modal from '../../components/Modal';
import { printReceipt } from '../../lib/printReceipt';

export default function StudentFinanceTab() {
  const { me, payments, store, setPayments, notify } = useOutletContext();
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ reference: '', method: 'M-Pesa', amount: '' });

  const { feeStructure } = store;

  const levels = store.settings?.classes?.length > 0 
    ? store.settings.classes.map(c => c.name) 
    : (store.settings?.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
  const myLevel = levels.find(l => me.cls?.startsWith(l)) || me.cls || levels[0];

  const termFees = feeStructure?.reduce((s, f) => s + (Number(f[myLevel]) || 0), 0) || 0;
  const totalPaid = payments.reduce((acc, p) => p.status !== 'Verification Pending' && p.status !== 'Pending' ? acc + Number(p.amount) : acc, 0);
  const outstanding = termFees - totalPaid;
  const dueDate = '2026-07-05';

  const feeAccount = {
    totalBilled: termFees,
    totalPaid,
    outstanding,
    payments,
    structure: feeStructure || [],
    dueDate,
    myLevel
  };

  const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');

  const [phone, setPhone] = useState(store?.settings?.phone || '');

  const handlePay = async () => {
    const ref = payForm.reference?.trim();
    const amt = Number(payForm.amount);
    
    if (payForm.method === 'M-Pesa STK Push') {
      if (!phone) { notify('Enter a valid phone number', 'warning'); return; }
      if (!amt || amt <= 0) { notify('Enter a valid amount', 'warning'); return; }
      
      try {
        const { supabase } = await import('../../lib/supabaseClient');
        const { data, error } = await supabase.functions.invoke('mpesa-stk', {
          body: { phone, amount: amt, invoiceId: null, studentId: me?.id || null }
        });
        
        if (error) {
          // Parse the Edge Function error body for a more descriptive message
          const msg = data?.error || error.message || 'Unknown error';
          if (msg.includes('not configured') || msg.includes('payment gateway')) {
            throw new Error('M-Pesa gateway not configured. Please contact the school Bursar to set up payment credentials.');
          }
          throw new Error(msg);
        }
        
        setPayModal(false);
        setPayForm({ reference: '', method: 'M-Pesa STK Push', amount: '' });
        notify('Check your phone for the M-Pesa PIN prompt. The system will update automatically.', 'success', 'Payment Initiated');
      } catch (e) {
        const errMsg = e.message || String(e);
        if (errMsg.includes('non-2xx') || errMsg.includes('FunctionsHttpError')) {
          notify('M-Pesa is not available right now. Please use a manual payment method (M-Pesa code, Bank) instead, or contact your Bursar.', 'error', 'Payment');
        } else {
          notify(`Payment error: ${errMsg}`, 'error', 'Payment');
        }
      }
      return;
    }

    if (!ref) { notify('Enter a valid reference code', 'warning'); return; }
    if (!amt || amt <= 0) { notify('Enter a valid amount', 'warning'); return; }
    
    try {
      const { upsertRow } = await import('../../lib/api');
      
      const newPayment = { 
        id: `pay_${Date.now()}`, 
        date: new Date().toISOString().slice(0, 10), 
        method: payForm.method, 
        ref: ref.toUpperCase(), 
        amount: amt, 
        status: 'Verification Pending',
        student_id: me.id,
        adm: me.adm,
        created_at: new Date().toISOString()
      };
      
      await upsertRow('financePayments', newPayment);
      setPayments(prev => [newPayment, ...prev]);
      setPayModal(false);
      setPayForm({ reference: '', method: 'M-Pesa STK Push', amount: '' });
      notify(`Payment of KES ${amt} submitted for verification`, 'success', 'Payment');
    } catch (e) {
      notify(`Payment error: ${e.message}`, 'error', 'Payment');
    }
  };

  return (
    <>
      <div className="stat-tiles">
        <KpiCard iconComponent={<DollarSign size={20} />} label="Total Billed" value={fmtKES(feeAccount.totalBilled)} />
        <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Total Paid" value={fmtKES(feeAccount.totalPaid)} accent="#107C10" />
        <KpiCard iconComponent={<AlertTriangle size={20} />} label="Outstanding" value={fmtKES(feeAccount.outstanding)} accent="#D13438" />
        <KpiCard iconComponent={<Calendar size={20} />} label="Due Date" value={feeAccount.dueDate} accent="#FFB900" />
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Payment Progress</h3>
          <span style={{ fontWeight: 700, color: '#107C10' }}>{((feeAccount.totalPaid / feeAccount.totalBilled) * 100 || 0).toFixed(0)}% Paid</span>
        </div>
        <ProgressBar value={feeAccount.totalBilled > 0 ? Math.min(100, (feeAccount.totalPaid / feeAccount.totalBilled) * 100) : 0} color="#107C10" />
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setPayModal(true)}>Make Payment</button>
      </div>

      <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
        <div className="card card-pad">
          <h3 className="section-title">Fee Structure - Term 2</h3>
          <table className="table">
            <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {feeAccount.structure.map((s, i) => (
                <tr key={i}><td>{s.type || s.item}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(s[feeAccount.myLevel])}</td></tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
                <td>Total</td><td style={{ textAlign: 'right' }}>{fmtKES(feeAccount.totalBilled)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Payment History</h3>
          <table className="table">
            <thead><tr><th>Date</th><th>Method</th><th>Ref</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
            <tbody>
              {feeAccount.payments.map(p => (
                <tr key={p.id}>
                  <td className="muted">{p.date}</td>
                  <td><Badge color={p.method === 'M-Pesa' ? 'green' : 'blue'}>{p.method}</Badge></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.ref}</td>
                  <td>
                    <Badge color={p.status === 'Verification Pending' || p.status === 'Pending' ? 'yellow' : 'green'}>
                      {p.status || 'Verified'}
                    </Badge>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(p.amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {p.status === 'Verified' && (
                      <button className="btn btn-sm" onClick={() => printReceipt(p, me, store.settings)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '4px 10px', fontSize: 12 }}>
                        🖨️ Print Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {feeAccount.payments.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>No payments recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {payModal && (
        <Modal title="Make a Payment" onClose={() => setPayModal(false)} footer={
          <button className="btn btn-primary" onClick={handlePay}>Submit Payment</button>
        }>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16, fontSize: 14, lineHeight: 1.5, color: '#334155', border: '1px solid #cbd5e1' }}>
            <strong style={{ display: 'block', marginBottom: 8, color: '#0f172a' }}>Direct M-Pesa Payment</strong>
            By selecting <strong>M-Pesa STK Push</strong>, you will receive a prompt on your phone to enter your M-Pesa PIN. The payment will be automatically verified and credited to your account.
          </div>
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label className="field-label">Payment Method</label>
              <select className="select" value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                <option>M-Pesa STK Push</option>
                <option>Manual M-Pesa Entry</option>
                <option>Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="field-label">Amount (KES)</label>
              <input className="input" type="number" placeholder="e.g. 5000" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
          </div>
          
          {payForm.method === 'M-Pesa STK Push' ? (
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">M-Pesa Phone Number</label>
              <input className="input" placeholder="e.g. 07XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>The phone number that will receive the PIN prompt.</div>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Transaction Reference Code</label>
              <input className="input" placeholder="e.g. QKZ1B2C3D4" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Enter the reference code you received after making the payment manually.</div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
