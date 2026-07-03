import { Icon } from '../../components/icons';
import PrintHeader from '../../components/PrintHeader';
import { fmtKES } from '../../data/modules';
import { getActiveSchoolId } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import { useOutletContext } from 'react-router-dom';

export default function FeeStructureTab() {
  const { store, user } = useOutletContext();
  const { notify } = store;
  const feeStructure = store.feeStructure || [];

  const handlePrint = () => {
    window.print();
  };

  const handleSendToParents = async () => {
    try {
      const row = {
        title: 'Fee Structure - Current Term',
        message: 'The official fee structure for this term is now available.',
        body: 'Dear Parents,\n\nPlease find attached the official fee structure for the current term. You can download the PDF by clicking the button below.\n\n[ATTACHMENT:FEE_STRUCTURE]',
        posted_by: user?.name || 'Administration',
        role: user?.dept || user?.role || 'Finance',
        audience: ['parents'],
        school_id: getActiveSchoolId(),
        created_at: new Date().toISOString()
      };
      
      await supabase.from('notifications').insert(row);
      notify('Fee structure sent to Parents Portal successfully!', 'success');
    } catch (e) {
      notify(`Failed to send notification: ${e.message}`, 'error');
    }
  };

  return (
    <div>
      <div className="card card-pad no-print" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title" style={{ margin: 0 }}>School Fee Structure</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleSendToParents}>
              <Icon name="message" size={16} style={{ marginRight: 6 }} /> Send to Parents
            </button>
            <button className="btn" onClick={handlePrint}>
              <Icon name="print" size={16} style={{ marginRight: 6 }} /> Print / Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="printable-fee-structure card card-pad" style={{ background: '#fff', color: '#000' }}>
        <PrintHeader settings={store.settings} />
        <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#000', textTransform: 'uppercase' }}>Official Fee Structure</h2>
          <div style={{ fontSize: 13, marginTop: 4 }}>Academic Year: {new Date().getFullYear()}</div>
        </div>

        {(() => {
          const classList = store.settings?.classes || [];
          const levels = classList.length > 0 ? classList.map(c => c.name) : (store.settings?.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
          return (
            <table className="table" style={{ width: '100%', marginBottom: 32, borderCollapse: 'collapse' }}>
          <thead>
            <tr className="print-border-heavy">
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>Fee Component</th>
              {levels.map(l => <th key={l} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>{l} (KES)</th>)}
            </tr>
          </thead>
          <tbody>
            {feeStructure.map((item, idx) => (
              <tr key={idx} className="print-border-light">
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.component || item.type}</td>
                {levels.map(l => (
                  <td key={l} style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtKES(item[l])}</td>
                ))}
              </tr>
            ))}
            <tr className="print-border-heavy print-bg-light" style={{ backgroundColor: 'var(--surface)' }}>
              <td style={{ padding: '16px 16px', fontWeight: 800, color: 'var(--text)' }}>TOTAL Term Fees</td>
              {levels.map(l => (
                <td key={l} style={{ padding: '16px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary-700)', fontSize: '15px' }}>
                  {fmtKES(feeStructure.reduce((s, f) => s + (f[l] || 0), 0))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        );
        })()}

        <div style={{ marginTop: 24, padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="file" size={16} /> Payment Methods
          </h4>
          {store.settings?.paymentDetails ? (
            <div style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {store.settings.paymentDetails}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 14, fontStyle: 'italic' }}>
              No payment instructions configured. Please set them in School Settings.
            </p>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .print-border-heavy { border-bottom: 2px solid var(--border); }
        .print-border-light { border-bottom: 1px solid var(--border-light); }
        .print-bg-light { background-color: var(--surface); }
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          .printable-fee-structure, .printable-fee-structure * { visibility: visible; }
          .printable-fee-structure { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 2cm !important; border: none; box-shadow: none; box-sizing: border-box; }
          .no-print { display: none !important; }
          .no-print-watermark { display: none !important; }
          .sidebar, .topbar { display: none !important; }
          .layout { display: block !important; padding: 0 !important; }
          .main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          
          /* Enforce black borders and clean backgrounds for print */
          .print-border-heavy { border-bottom: 2px solid #000 !important; }
          .print-border-light { border-bottom: 1px solid #000 !important; }
          .print-bg-light { background-color: transparent !important; }
          .table th, .table td { color: #000 !important; }
        }
      `}} />
    </div>
  );
}
