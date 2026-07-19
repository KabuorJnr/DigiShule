import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { Users, FileText, CheckCircle, Clock, Play } from 'lucide-react';

export default function PayrollTab() {
  const { store, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});
  
  const payrolls = store?.payrolls || [];
  const payrollEntries = store?.payrollEntries || [];
  const staff = store?.staff || [];
  const setPayrolls = store?.setPayrolls || (() => {});
  const setPayrollEntries = store?.setPayrollEntries || (() => {});

  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [runningPayroll, setRunningPayroll] = useState(false);

  const pendingPayroll = payrolls.find(p => p.status === 'Pending');

  const handleRunPayroll = async () => {
    if (!staff.length) {
      notify('No staff available to run payroll.', 'error');
      return;
    }
    
    setRunningPayroll(true);
    try {
      const monthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
      
      // Check if this month already exists
      if (payrolls.some(p => p.month === monthStr)) {
        notify(`Payroll for ${monthStr} already exists!`, 'warning');
        setRunningPayroll(false);
        return;
      }

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      const entries = staff.map(s => {
        let category = 'Support Staff'; // Default for basic labourers
        if (['teacher', 'head_teacher', 'deputy_academics'].includes(s.role)) category = 'Teaching';
        if (['admin', 'superadmin', 'bursar', 'registrar', 'deputy_admin'].includes(s.role)) category = 'Admin';
        
        let baseSalary = 20000;
        if (category === 'Teaching') baseSalary = 40000;
        if (category === 'Admin') baseSalary = 50000;

        // Arbitrary deduction logic (e.g. 10% tax/NSSF/NHIF)
        const deductions = baseSalary * 0.10;
        const netPay = baseSalary - deductions;

        totalGross += baseSalary;
        totalDeductions += deductions;
        totalNet += netPay;

        return {
          id: `pre_${Date.now()}_${s.id}`,
          staff_name: s.name,
          role: s.role,
          category,
          base_salary: baseSalary,
          allowances: 0,
          deductions,
          net_pay: netPay,
          school_id: s.school_id
        };
      });

      const newPayroll = {
        id: `pr_${Date.now()}`,
        month: monthStr,
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        status: 'Pending',
        staff_count: staff.length,
        generated_by: user?.name || 'System',
        school_id: staff[0]?.school_id
      };

      // Assign PR ID to entries
      entries.forEach(e => e.payroll_id = newPayroll.id);

      // Save to Supabase
      await upsertRow('payrolls', newPayroll);
      for (const entry of entries) {
        await upsertRow('payroll_entries', entry);
      }

      setPayrolls([newPayroll, ...payrolls]);
      setPayrollEntries([...entries, ...payrollEntries]);
      notify(`Payroll for ${monthStr} generated.`, 'success');
      addAuditLog('Payroll Generated', `System generated payroll for ${monthStr}`, totalGross);
    } catch (e) {
      notify(`Failed to generate payroll: ${e.message}`, 'error');
    }
    setRunningPayroll(false);
  };

  const handleApprove = async (id) => {
    if (!confirm('Are you sure you want to approve this payroll for payment?')) return;
    try {
      const pr = payrolls.find(p => p.id === id);
      const updatedPr = { ...pr, status: 'Approved', approved_by: user?.name };
      await upsertRow('payrolls', updatedPr);
      
      const updated = payrolls.map(p => p.id === id ? updatedPr : p);
      setPayrolls(updated);
      notify(`Payroll for ${pr.month} approved.`, 'success');
      addAuditLog('Payroll Approved', `Approved payroll for ${pr.month}`, pr.total_gross);
    } catch(e) {
      notify(e.message, 'error');
    }
  };

  const handlePay = async (id) => {
    if (!confirm('Mark this payroll as paid?')) return;
    try {
      const pr = payrolls.find(p => p.id === id);
      const updatedPr = { ...pr, status: 'Paid', paid_by: user?.name };
      await upsertRow('payrolls', updatedPr);
      
      const updated = payrolls.map(p => p.id === id ? updatedPr : p);
      setPayrolls(updated);
      notify(`Payroll for ${pr.month} marked as Paid.`, 'success');
      addAuditLog('Payroll Paid', `Disbursed payroll for ${pr.month}`, pr.total_net);
    } catch(e) {
      notify(e.message, 'error');
    }
  };

  const detailsList = useMemo(() => {
    if (!selectedPayroll) return [];
    return payrollEntries.filter(e => e.payroll_id === selectedPayroll.id);
  }, [selectedPayroll, payrollEntries]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #3B82F6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Month Gross</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{fmtKES(payrolls[0]?.total_gross || 0)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #10B981' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Net Payout</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#10B981' }}>{fmtKES(payrolls[0]?.total_net || 0)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #F59E0B' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Staff on Payroll</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{payrolls[0]?.staff_count || 0}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #8B5CF6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
          <div style={{ marginTop: 8 }}>
            <Badge color={pendingPayroll ? 'amber' : 'green'}>
              {pendingPayroll ? 'Pending Approval' : 'Up to Date'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Payroll Runs</div>
          <button className="btn btn-primary" onClick={handleRunPayroll} disabled={runningPayroll} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Play size={16} /> {runningPayroll ? 'Generating...' : 'Run Payroll'}
          </button>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Staff Count</th>
                <th style={{ textAlign: 'right' }}>Gross Pay</th>
                <th style={{ textAlign: 'right' }}>Deductions</th>
                <th style={{ textAlign: 'right' }}>Net Pay</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No payroll runs yet.</td></tr>
              )}
              {payrolls.map(pr => (
                <tr key={pr.id}>
                  <td style={{ fontWeight: 600 }}>{pr.month}</td>
                  <td>{pr.staff_count}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(pr.total_gross)}</td>
                  <td style={{ textAlign: 'right', color: '#EF4444' }}>{fmtKES(pr.total_deductions)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmtKES(pr.total_net)}</td>
                  <td>
                    <Badge color={pr.status === 'Paid' ? 'green' : pr.status === 'Approved' ? 'blue' : 'amber'}>
                      {pr.status}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {pr.status === 'Pending' && user?.role === 'finance' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleApprove(pr.id)}>Approve</button>
                      )}
                      {pr.status === 'Approved' && user?.role === 'finance' && (
                        <button className="btn btn-sm" style={{ background: '#10B981', color: 'white', borderColor: '#10B981' }} onClick={() => handlePay(pr.id)}>Mark Paid</button>
                      )}
                      <button className="btn btn-sm" onClick={() => setSelectedPayroll(pr)}>View Details</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayroll && (
        <Modal title={`Payroll Details - ${selectedPayroll.month}`} onClose={() => setSelectedPayroll(null)} wide footer={
          <button className="btn" onClick={() => setSelectedPayroll(null)}>Close</button>
        }>
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', gap: 32, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
              <div>Total Gross: <strong style={{ fontSize: 16 }}>{fmtKES(selectedPayroll.total_gross)}</strong></div>
              <div>Total Deductions: <strong style={{ fontSize: 16, color: '#EF4444' }}>{fmtKES(selectedPayroll.total_deductions)}</strong></div>
              <div>Total Net: <strong style={{ fontSize: 16, color: '#10B981' }}>{fmtKES(selectedPayroll.total_net)}</strong></div>
            </div>
            
            <div className="section-title">Staff Breakdown</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Base Salary</th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {detailsList.map(entry => (
                  <tr key={entry.id}>
                    <td>{entry.staff_name}</td>
                    <td><Badge color={entry.category === 'Teaching' ? 'blue' : entry.category === 'Admin' ? 'purple' : 'gray'}>{entry.category}</Badge></td>
                    <td style={{ textAlign: 'right' }}>{fmtKES(entry.base_salary)}</td>
                    <td style={{ textAlign: 'right', color: '#EF4444' }}>{fmtKES(entry.deductions)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(entry.net_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
