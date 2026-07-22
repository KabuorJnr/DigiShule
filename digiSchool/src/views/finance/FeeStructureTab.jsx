import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { fmtKES } from '../../data/modules';
import { getActiveSchoolId, saveConfig } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../../components/Modal';
import { Printer, Send, Plus, Trash2, Edit2, Download, Building2, CheckCircle2 } from 'lucide-react';
import { exportTablePDF } from '../../utils/exporters';

const DEFAULT_VOTE_HEADS = [
  { id: 'vh-1', name: 'TUITION', term1: 12500, term2: 12500, term3: 11049 },
  { id: 'vh-2', name: 'P.E / OPERATIONS', term1: 4293, term2: 4293, term3: 4293 },
  { id: 'vh-3', name: 'EWC (ELECTRICITY & WATER)', term1: 1315, term2: 1315, term3: 1315 },
  { id: 'vh-4', name: 'L.T. & T (TRAVEL & TRANSPORT)', term1: 1315, term2: 1315, term3: 1315 },
  { id: 'vh-5', name: 'RMI (REPAIRS & MAINTENANCE)', term1: 1106, term2: 1106, term3: 977 },
  { id: 'vh-6', name: 'ACTIVITY FEE', term1: 1800, term2: 1500, term3: 1214 },
  { id: 'vh-7', name: 'ATTACHMENT & DUAL TRAINING', term1: 600, term2: 900, term3: 500 },
  { id: 'vh-8', name: 'EXAMINATION & ASSESSMENT', term1: 2000, term2: 1500, term3: 1500 },
];

export default function FeeStructureTab() {
  const { store, user } = useOutletContext();
  const { notify } = store;
  
  const rawFeeStructure = store.feeStructure || [];
  
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [finYear, setFinYear] = useState('2025/2026');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [voteHeads, setVoteHeads] = useState(() => {
    if (rawFeeStructure.length > 0 && rawFeeStructure[0].term1 !== undefined) {
      return rawFeeStructure;
    }
    return DEFAULT_VOTE_HEADS;
  });

  const [newHead, setNewHead] = useState({ name: '', term1: '', term2: '', term3: '' });

  const totals = useMemo(() => {
    let t1 = 0, t2 = 0, t3 = 0;
    voteHeads.forEach(v => {
      t1 += Number(v.term1 || 0);
      t2 += Number(v.term2 || 0);
      t3 += Number(v.term3 || 0);
    });
    return { t1, t2, t3, total: t1 + t2 + t3 };
  }, [voteHeads]);

  const handlePrint = () => {
    window.print();
  };

  const handleSendToParents = async () => {
    try {
      const row = {
        title: `Official Fee Structure FY ${finYear}`,
        message: `The official fee structure for Financial Year ${finYear} is now published. Total Term 1: ${fmtKES(totals.t1)}, Term 2: ${fmtKES(totals.t2)}, Term 3: ${fmtKES(totals.t3)}.`,
        body: `Dear Parent/Guardian,\n\nPlease find the official fee breakdown for FY ${finYear}.\n\nTotal Term 1: ${fmtKES(totals.t1)}\nTotal Term 2: ${fmtKES(totals.t2)}\nTotal Term 3: ${fmtKES(totals.t3)}\nGrand Total: ${fmtKES(totals.total)}\n\nPlease ensure fees are paid via official bank accounts.`,
        posted_by: user?.name || 'Bursar Office',
        role: 'Finance',
        audience: ['parents'],
        school_id: getActiveSchoolId(),
        created_at: new Date().toISOString()
      };
      
      await supabase.from('notifications').insert(row);
      notify('Fee structure published to Parents Portal successfully!', 'success');
    } catch (e) {
      notify(`Failed to publish: ${e.message}`, 'error');
    }
  };

  const handleSaveVoteHeads = async () => {
    try {
      await saveConfig({ feeStructure: voteHeads });
      if (store.setFeeStructure) store.setFeeStructure(voteHeads);
      notify('Fee structure vote heads updated successfully.', 'success');
      setEditModalOpen(false);
    } catch (e) {
      notify(`Failed to save: ${e.message}`, 'error');
    }
  };

  const handleAddVoteHead = () => {
    if (!newHead.name.trim()) { notify('Please enter a vote head name', 'warning'); return; }
    const head = {
      id: `vh_${Date.now()}`,
      name: newHead.name.toUpperCase(),
      term1: Number(newHead.term1 || 0),
      term2: Number(newHead.term2 || 0),
      term3: Number(newHead.term3 || 0)
    };
    setVoteHeads(prev => [...prev, head]);
    setNewHead({ name: '', term1: '', term2: '', term3: '' });
  };

  const handleDeleteHead = (id) => {
    setVoteHeads(prev => prev.filter(h => h.id !== id));
  };

  const school = store?.settings || {};

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out' }}>
      
      {/* Control Bar (Hidden during Printing) */}
      <div className="card card-pad no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={20} /> Official Institution Fee Structure
            </h3>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
              Generate, print, and publish official termly vote-head fee breakdowns
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="select" value={finYear} onChange={e => setFinYear(e.target.value)} style={{ fontSize: 13, fontWeight: 600 }}>
              <option value="2025/2026">Financial Year 2025/2026</option>
              <option value="2026/2027">Financial Year 2026/2027</option>
            </select>

            <button className="btn btn-sm" onClick={() => setEditModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit2 size={14} /> Edit Vote Heads
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleSendToParents} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={14} /> Publish to Parents
            </button>
            <button className="btn btn-sm" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0F172A', color: '#fff', border: 'none' }}>
              <Printer size={14} /> Print / PDF Document
            </button>
          </div>
        </div>
      </div>

      {/* ── Official Document Render Frame (Matches Official Reference Image Exactly) ── */}
      <div className="printable-document-container card" style={{ 
        background: '#ffffff', 
        color: '#000000', 
        padding: '40px 48px', 
        borderRadius: 8, 
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        border: '1px solid #cbd5e1',
        maxWidth: 900,
        margin: '0 auto'
      }}>
        
        {/* Header Header: Ministry & School Crest Logos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          {/* Left Emblem: Republic of Kenya Coat of Arms SVG */}
          <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 100 100" width="72" height="72">
              <path d="M50 5 L85 25 L85 65 L50 95 L15 65 L15 25 Z" fill="none" stroke="#000" strokeWidth="2.5"/>
              <circle cx="50" cy="40" r="18" fill="none" stroke="#000" strokeWidth="2"/>
              <path d="M50 25 L50 55 M35 40 L65 40" stroke="#000" strokeWidth="2"/>
              <text x="50" y="82" textAnchor="middle" fontSize="9" fontWeight="bold" fontFamily="serif">KENYA</text>
            </svg>
          </div>

          {/* Center Institution Title */}
          <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#000' }}>
              Ministry of Education
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 4 }}>
              State Department for Technical, Vocational Education and Training
            </div>
            <h2 style={{ margin: '4px 0', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#000', fontFamily: 'Times New Roman, serif' }}>
              {school.name || 'Butere Technical Training Institute'}
            </h2>
            <div style={{ fontSize: 11, color: '#222', lineHeight: 1.4 }}>
              {school.address || 'P.O. Box 108-50101, Butere | Mobile: 0727402370 / 0790849063'}
            </div>
            <div style={{ fontSize: 11, color: '#222' }}>
              Email: {school.email || 'buteretti@gmail.com'} | Website: {school.website || 'www.buteretti.ac.ke'}
            </div>
          </div>

          {/* Right School Badge Crest */}
          <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {school.logo ? (
              <img src={school.logo} alt="School Crest" style={{ maxHeight: 72, maxWidth: 72, objectFit: 'contain' }} />
            ) : (
              <svg viewBox="0 0 100 100" width="70" height="70">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#047857" strokeWidth="3"/>
                <circle cx="50" cy="50" r="34" fill="none" stroke="#000" strokeWidth="1"/>
                <text x="50" y="54" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#047857" fontFamily="serif">LOGO</text>
              </svg>
            )}
          </div>
        </div>

        {/* Decorative Divider Line */}
        <div style={{ borderBottom: '2px solid #000', width: '100%', marginBottom: 20 }} />

        {/* Document Title Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: 15, 
            fontWeight: 900, 
            textTransform: 'uppercase', 
            letterSpacing: 0.8,
            fontFamily: 'Times New Roman, serif',
            textDecoration: 'underline'
          }}>
            FEES STRUCTURE FOR THE FINANCIAL YEAR {finYear}
          </h3>
        </div>

        {/* ── Vote Head Breakdown Grid Table (Solid 1px Black Border Grid) ── */}
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          marginBottom: 24, 
          fontFamily: 'Times New Roman, serif',
          fontSize: 12
        }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ border: '1px solid #000', padding: '8px 12px', textAlign: 'left', fontWeight: 900, fontSize: 12 }}>VOTE HEAD</th>
              <th style={{ border: '1px solid #000', padding: '8px 12px', textAlign: 'right', fontWeight: 900, fontSize: 12 }}>TERM 1</th>
              <th style={{ border: '1px solid #000', padding: '8px 12px', textAlign: 'right', fontWeight: 900, fontSize: 12 }}>TERM 2</th>
              <th style={{ border: '1px solid #000', padding: '8px 12px', textAlign: 'right', fontWeight: 900, fontSize: 12 }}>TERM 3</th>
              <th style={{ border: '1px solid #000', padding: '8px 12px', textAlign: 'right', fontWeight: 900, fontSize: 12 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {voteHeads.map((item, idx) => {
              const rowTotal = Number(item.term1 || 0) + Number(item.term2 || 0) + Number(item.term3 || 0);
              return (
                <tr key={item.id || idx}>
                  <td style={{ border: '1px solid #000', padding: '7px 12px', fontWeight: 700 }}>{item.name}</td>
                  <td style={{ border: '1px solid #000', padding: '7px 12px', textAlign: 'right' }}>{Number(item.term1 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ border: '1px solid #000', padding: '7px 12px', textAlign: 'right' }}>{Number(item.term2 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ border: '1px solid #000', padding: '7px 12px', textAlign: 'right' }}>{Number(item.term3 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ border: '1px solid #000', padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
            <tr style={{ background: '#f1f5f9' }}>
              <td style={{ border: '2px solid #000', padding: '10px 12px', fontWeight: 900, fontSize: 13 }}>TOTALS</td>
              <td style={{ border: '2px solid #000', padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: 13 }}>{totals.t1.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={{ border: '2px solid #000', padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: 13 }}>{totals.t2.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={{ border: '2px solid #000', padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: 13 }}>{totals.t3.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={{ border: '2px solid #000', padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#000' }}>{totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Official Notes Section ── */}
        <div style={{ fontFamily: 'Times New Roman, serif', fontSize: 11, lineHeight: 1.5, marginBottom: 28, color: '#111' }}>
          <div style={{ fontWeight: 900, textDecoration: 'underline', marginBottom: 4 }}>NOTES</div>
          <p style={{ margin: '0 0 8px 0', textIndent: 16 }}>
            Following your placement in this institution, you are eligible for government scholarship/bursary allocations to assist with your education expenses. 
            The application should be made early well in advance prior to admission. In case the government scholarship/loan does not cover the entire cost of your programme, 
            the deficit will be met by your parent/guardian.
          </p>

          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>All students are advised to clear term fee balances before proceeding to the next academic term.</li>
            <li style={{ marginBottom: 4 }}>Accommodation fee (for boarders only) is <strong>KES 5,000.00</strong> per term. Internal accommodation is available on a first-come basis.</li>
            <li style={{ marginBottom: 4 }}>Students are expected to purchase their own personal learning materials/stationery.</li>
            <li style={{ marginBottom: 4 }}>All new students will pay a Registration fee of <strong>KES 500.00</strong> and <strong>KES 2,500.00</strong> for ICT/Placement fees.</li>
            <li style={{ marginBottom: 4 }}>All new trainees will pay <strong>KES 500.00</strong> for Student Identity Card.</li>
            <li style={{ marginBottom: 4 }}>
              All monies should be paid directly into official institution accounts:
              <div style={{ fontWeight: 700, marginTop: 2, paddingLeft: 12 }}>
                Bank: KCB Bank Ltd | Account Name: {school.name || 'DigiShule Technical Institute'} Main Acc<br />
                Account No: 1209428430 | M-PESA PAYBILL: 522533 | Account: [ADM NO + Trainee Name]
              </div>
            </li>
          </ol>
        </div>

        {/* ── Authorization & Official Stamp Box Footer ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: 30 }}>
          <div style={{ textAlign: 'center' }}>
            {/* Signature SVG */}
            <div style={{ height: 40, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <svg width="140" height="36" viewBox="0 0 140 36">
                <path d="M10 25 C30 5, 45 35, 60 15 C75 35, 90 5, 110 20 C125 30, 135 10, 138 18" stroke="#1d4ed8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>

            {/* Official Stamp Box */}
            <div style={{ 
              border: '2px dashed #1d4ed8', 
              borderRadius: 6, 
              padding: '8px 16px', 
              color: '#1d4ed8', 
              fontFamily: 'Courier New, monospace', 
              fontSize: 10, 
              fontWeight: 900,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              transform: 'rotate(-2deg)'
            }}>
              <div>★ PRINCIPAL / BURSAR ★</div>
              <div>{school.name || 'BUTERE TECHNICAL INSTITUTE'}</div>
              <div>P.O. BOX 108 - 50101</div>
              <div>OFFICIAL STAMP</div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Edit Vote Heads Modal ── */}
      {editModalOpen && (
        <Modal title="Edit Fee Structure Vote Heads" onClose={() => setEditModalOpen(false)} wide footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setEditModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveVoteHeads} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} /> Save Changes
            </button>
          </div>
        }>
          <div style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>Add New Vote Head</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
              <input className="input" placeholder="Vote Head Name (e.g. Activity Fee)" value={newHead.name} onChange={e => setNewHead({ ...newHead, name: e.target.value })} />
              <input className="input" type="number" placeholder="Term 1 (KES)" value={newHead.term1} onChange={e => setNewHead({ ...newHead, term1: e.target.value })} />
              <input className="input" type="number" placeholder="Term 2 (KES)" value={newHead.term2} onChange={e => setNewHead({ ...newHead, term2: e.target.value })} />
              <input className="input" type="number" placeholder="Term 3 (KES)" value={newHead.term3} onChange={e => setNewHead({ ...newHead, term3: e.target.value })} />
              <button className="btn btn-primary" onClick={handleAddVoteHead} style={{ padding: '8px 16px' }}>
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          <div className="scroll-x" style={{ maxHeight: 350 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Vote Head Name</th>
                  <th style={{ textAlign: 'right' }}>Term 1 (KES)</th>
                  <th style={{ textAlign: 'right' }}>Term 2 (KES)</th>
                  <th style={{ textAlign: 'right' }}>Term 3 (KES)</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {voteHeads.map((vh, idx) => (
                  <tr key={vh.id || idx}>
                    <td>
                      <input className="input" value={vh.name} onChange={e => {
                        const val = e.target.value;
                        setVoteHeads(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                      }} style={{ fontWeight: 600 }} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input className="input" type="number" value={vh.term1} onChange={e => {
                        const val = Number(e.target.value || 0);
                        setVoteHeads(prev => prev.map((item, i) => i === idx ? { ...item, term1: val } : item));
                      }} style={{ textAlign: 'right', width: 100 }} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input className="input" type="number" value={vh.term2} onChange={e => {
                        const val = Number(e.target.value || 0);
                        setVoteHeads(prev => prev.map((item, i) => i === idx ? { ...item, term2: val } : item));
                      }} style={{ textAlign: 'right', width: 100 }} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input className="input" type="number" value={vh.term3} onChange={e => {
                        const val = Number(e.target.value || 0);
                        setVoteHeads(prev => prev.map((item, i) => i === idx ? { ...item, term3: val } : item));
                      }} style={{ textAlign: 'right', width: 100 }} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteHead(vh.id)} style={{ padding: '6px 10px' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Print CSS Rules */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          .printable-document-container, .printable-document-container * { visibility: visible; }
          .printable-document-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  );
}



