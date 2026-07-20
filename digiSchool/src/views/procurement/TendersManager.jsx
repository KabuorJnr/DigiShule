import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createUseStyles } from 'react-jss';
import Modal from '../../components/Modal';
import { upsertRow } from '../../lib/api';
import { FileText, Plus, Send } from 'lucide-react';

const useStyles = createUseStyles({
  veribidContainer: { fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif', color: '#1a1a2e' },
  card: { background: '#fff', borderRadius: '10px', border: '1px solid #e0e4ea', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  cardHeader: { padding: '0.8rem 1.1rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#1a1a2e', margin: 0 },
  btnPrimary: { background: '#006233', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' } },
  btnGhost: { background: 'transparent', color: '#006233', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.32rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #ddd', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { background: '#f0faf4' } },
  dataTable: { width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', '& thead': { background: '#fafbfc', borderBottom: '2px solid #e0e4ea' }, '& th': { padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }, '& td': { padding: '0.6rem 0.8rem', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }, '& tbody tr:hover': { background: '#f8fdf9' } },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' },
  badgeOpen: { background: '#cce5ff', color: '#004085' },
  badgeClosed: { background: '#e2e3e5', color: '#383d41' },
});

export default function TendersManager() {
  const classes = useStyles();
  const { tenders, setTenders, addAuditLog, user } = useOutletContext();
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [newTender, setNewTender] = useState({ title: '', description: '', deadline: '', status: 'Open', published: false });

  const handleCreateTender = () => {
    if(!newTender.title || !newTender.deadline) return;
    const tnd = {
      ...newTender,
      id: `tnd_${Date.now()}`,
      created_at: new Date().toISOString()
    };
    
    setTenders(prev => [tnd, ...prev]);
    upsertRow('tenders', tnd).catch(() => {});
    addAuditLog('Created Tender', `Tender: ${tnd.title}`);
    setNewTender({ title: '', description: '', deadline: '', status: 'Open', published: false });
    setShowTenderModal(false);
  };

  const publishTender = (id) => {
    setTenders(prev => prev.map(t => t.id === id ? { ...t, published: true } : t));
    const t = tenders.find(x => x.id === id);
    if(t) {
      upsertRow('tenders', { ...t, published: true }).catch(() => {});
      addAuditLog('Published Tender', `Tender: ${t.title}`);
    }
  };

  return (
    <div className={classes.veribidContainer}>
      <div className={classes.card}>
        <div className={classes.cardHeader}>
          <h3 className={classes.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} color="#006233" /> Active Tenders & Bids</h3>
          <button className={classes.btnPrimary} onClick={() => setShowTenderModal(true)}><Plus size={16} /> New Tender</button>
        </div>
        <div style={{ padding: '0' }}>
          <table className={classes.dataTable}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Public Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenders.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                  <td style={{ color: '#666', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</td>
                  <td>{t.deadline}</td>
                  <td><span className={`${classes.badge} ${t.status === 'Open' ? classes.badgeOpen : classes.badgeClosed}`}>{t.status}</span></td>
                  <td>
                    {t.published ? (
                      <span style={{ color: '#006233', fontWeight: 600, fontSize: '0.75rem' }}>PUBLISHED</span>
                    ) : (
                      <span style={{ color: '#888', fontSize: '0.75rem' }}>Internal Only</span>
                    )}
                  </td>
                  <td>
                    {!t.published && (
                      <button className={classes.btnGhost} onClick={() => publishTender(t.id)}>
                        <Send size={14} /> Publish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tenders.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No active tenders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showTenderModal && (
        <Modal title="Draft New Tender" onClose={() => setShowTenderModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label>Tender Title</label>
              <input type="text" value={newTender.title} onChange={e => setNewTender({...newTender, title: e.target.value})} className="input" placeholder="e.g. Supply of Laboratory Equipment" />
            </div>
            <div>
              <label>Description & Requirements</label>
              <textarea value={newTender.description} onChange={e => setNewTender({...newTender, description: e.target.value})} className="input" rows="3"></textarea>
            </div>
            <div>
              <label>Submission Deadline</label>
              <input type="date" value={newTender.deadline} onChange={e => setNewTender({...newTender, deadline: e.target.value})} className="input" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleCreateTender}>Save Draft</button>
              <button className="btn btn-ghost" onClick={() => setShowTenderModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



