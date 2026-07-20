import { useState } from 'react';
import { fmtKES } from '../../data/modules';
import PrintHeader from '../../components/PrintHeader';
import { Icon } from '../../components/icons';
import { useOutletContext } from 'react-router-dom';

export default function StatementsTab() {
  const { students, invoices, payments, store } = useOutletContext();
  const [selectedStudent, setSelectedStudent] = useState('');

  const student = students.find(s => s.id === selectedStudent);
  const myInvoices = invoices.filter(i => i.student_id === selectedStudent);
  const myPayments = payments.filter(p => p.student_id === selectedStudent);
  
  const totalBilled = myInvoices.reduce((acc, i) => acc + Number(i.amount), 0);
  const totalPaid = myPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const balance = totalBilled - totalPaid;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="card card-pad no-print" style={{ marginBottom: 24 }}>
        <div className="section-title">Fee Statements</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Select Student</label>
            <select className="select" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
              <option value="">-- Choose Student --</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no})</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={!selectedStudent} onClick={handlePrint}>
            <Icon name="file" size={16} style={{ marginRight: 6 }} /> Print Statement
          </button>
        </div>
      </div>

      {student && (
        <div className="printable-statement card card-pad" style={{ background: '#fff', color: '#000' }}>
          <PrintHeader settings={store.settings} />
          <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: '#000', textTransform: 'uppercase' }}>Fee Statement</h2>
            <div style={{ fontSize: 13, marginTop: 4 }}>Date: {new Date().toLocaleDateString()}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Student Name</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{student.name}</div>
              <div style={{ fontSize: 14 }}>Adm No: {student.adm_no}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Current Balance</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: balance > 0 ? '#dc2626' : '#16a34a' }}>{fmtKES(balance)}</div>
              {balance > 0 && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Due Immediately</div>}
            </div>
          </div>

          <p style={{ marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            Dear Parent/Guardian,<br/>
            Below is the fee statement for your child <strong>{student.name}</strong>. Please ensure any outstanding balances are cleared promptly to avoid disruption of learning.
          </p>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Invoices / Charges</div>
          <table className="table" style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Date/Ref</th>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Due Date</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {myInvoices.map(i => (
                <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 4px' }}>Term Fee ({i.id})</td>
                  <td style={{ padding: '8px 4px' }}>{i.due_date}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{fmtKES(i.amount)}</td>
                </tr>
              ))}
              {myInvoices.length === 0 && <tr><td colSpan={3} style={{ padding: '8px 4px', textAlign: 'center' }}>No charges recorded</td></tr>}
            </tbody>
          </table>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Payments Received</div>
          <table className="table" style={{ width: '100%', marginBottom: 32, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Method/Ref</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {myPayments.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 4px' }}>{p.date}</td>
                  <td style={{ padding: '8px 4px' }}>{p.method} - {p.ref}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{fmtKES(p.amount)}</td>
                </tr>
              ))}
              {myPayments.length === 0 && <tr><td colSpan={3} style={{ padding: '8px 4px', textAlign: 'center' }}>No payments recorded</td></tr>}
            </tbody>
          </table>

          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: '#666', borderTop: '1px solid #ddd', paddingTop: 16 }}>
            For any queries regarding this statement, please contact the Accounts Office.<br/>
            <strong>Thank you for your prompt payment!</strong>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          .printable-statement, .printable-statement * { visibility: visible; }
          .printable-statement { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 2cm !important; border: none; box-shadow: none; box-sizing: border-box; }
          .no-print { display: none !important; }
          .sidebar, .topbar { display: none !important; }
          .layout { display: block !important; padding: 0 !important; }
          .main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
        }
      `}} />
    </div>
  );
}



