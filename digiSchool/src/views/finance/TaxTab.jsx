import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import { fmtKES } from '../../data/modules';
import { FileWarning, CheckCircle } from 'lucide-react';

export default function TaxTab() {
  const { store } = useOutletContext();
  const notify = store?.notify || (() => {});

  const [taxes, setTaxes] = useState([
    { id: 'tax_001', period: '2026-07', type: 'PAYE', amount: 245000, deadline: '2026-08-09', status: 'Pending', kra_receipt: null },
    { id: 'tax_002', period: '2026-07', type: 'NSSF', amount: 35000, deadline: '2026-08-09', status: 'Pending', kra_receipt: null },
    { id: 'tax_003', period: '2026-07', type: 'NHIF', amount: 42000, deadline: '2026-08-09', status: 'Pending', kra_receipt: null },
    { id: 'tax_004', period: '2026-06', type: 'PAYE', amount: 245000, deadline: '2026-07-09', status: 'Filed', kra_receipt: 'KRA_12345678' },
    { id: 'tax_005', period: '2026-06', type: 'NSSF', amount: 35000, deadline: '2026-07-09', status: 'Filed', kra_receipt: 'NSSF_876543' },
  ]);

  const pendingAmount = taxes.filter(t => t.status === 'Pending').reduce((s, t) => s + t.amount, 0);

  const handleMarkFiled = (id) => {
    const receipt = prompt('Enter KRA/Statutory Receipt Number:');
    if (!receipt) return;
    setTaxes(prev => prev.map(t => t.id === id ? { ...t, status: 'Filed', kra_receipt: receipt } : t));
    notify('Tax filing updated successfully', 'success');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad" style={{ borderLeft: '4px solid #EF4444' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Tax Liability</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#EF4444' }}>{fmtKES(pendingAmount)}</div>
        </div>
        <div className="card card-pad" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Approaching Deadlines</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{taxes.filter(t => t.status === 'Pending').length}</div>
        </div>
        <div className="card card-pad" style={{ borderLeft: '4px solid #047857' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Compliance Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <CheckCircle size={28} color="#047857" />
            <span style={{ fontSize: 18, fontWeight: 'bold', color: '#047857' }}>Good</span>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="section-title">Tax & Statutory Deductions Timeline</div>
        
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Type</th>
              <th>Deadline</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th>Receipt / Cert</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {taxes.sort((a, b) => b.period.localeCompare(a.period)).map(tax => (
              <tr key={tax.id}>
                <td style={{ fontWeight: 600 }}>{tax.period}</td>
                <td>{tax.type}</td>
                <td style={{ color: tax.status === 'Pending' ? '#EF4444' : 'inherit' }}>{tax.deadline}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(tax.amount)}</td>
                <td>
                  <Badge color={tax.status === 'Filed' ? 'green' : 'red'}>{tax.status}</Badge>
                </td>
                <td className="muted" style={{ fontFamily: 'monospace' }}>{tax.kra_receipt || '-'}</td>
                <td>
                  {tax.status === 'Pending' ? (
                    <button className="btn btn-sm btn-primary" onClick={() => handleMarkFiled(tax.id)}>Mark as Filed</button>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>✓ Complete</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



