import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { Monitor, Car, Building, Plus } from 'lucide-react';

export default function AssetTab() {
  const { store, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});

  const assets = store?.assets || [];
  const setAssets = store?.setAssets || (() => {});

  const [modalOpen, setModalOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: '', category: 'Electronics', value: '', condition: 'Good', location: '', purchase_date: '' });
  
  const totalValue = assets.reduce((sum, a) => sum + Number(a.value || 0), 0);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const newAsset = {
        id: `AST_${Date.now()}`,
        name: assetForm.name,
        category: assetForm.category,
        value: Number(assetForm.value),
        condition: assetForm.condition,
        location: assetForm.location,
        purchase_date: assetForm.purchase_date || new Date().toISOString().slice(0, 10),
        status: 'Active'
      };

      await upsertRow('fixed_assets', newAsset);
      setAssets([newAsset, ...assets]);
      notify('Asset Registered Successfully', 'success');
      addAuditLog('Asset Registered', `Registered new asset: ${newAsset.name}`, newAsset.value);
      setModalOpen(false);
      setAssetForm({ name: '', category: 'Electronics', value: '', condition: 'Good', location: '', purchase_date: '' });
    } catch(err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Assets</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>{assets.length}</div>
        </div>
        <div className="card card-pad">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Asset Value</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: '#3B82F6' }}>{fmtKES(totalValue)}</div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#F3F4F6', padding: 8, borderRadius: 8 }}><Car size={20} color="#4B5563" /></div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Vehicles</div>
            <div style={{ fontWeight: 'bold' }}>{assets.filter(a => a.category === 'Vehicles').length}</div>
          </div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#F3F4F6', padding: 8, borderRadius: 8 }}><Monitor size={20} color="#4B5563" /></div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Electronics</div>
            <div style={{ fontWeight: 'bold' }}>{assets.filter(a => a.category === 'Electronics').length}</div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Fixed Asset Register</div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Register Asset
          </button>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Location</th>
                <th>Purchase Date</th>
                <th style={{ textAlign: 'right' }}>Current Value</th>
                <th>Condition</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No assets registered yet.</td></tr>
              )}
              {assets.map(asset => (
                <tr key={asset.id}>
                  <td className="muted" style={{ fontSize: 12 }}>{asset.id}</td>
                  <td style={{ fontWeight: 600 }}>{asset.name}</td>
                  <td>{asset.category}</td>
                  <td>{asset.location}</td>
                  <td>{asset.purchase_date}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(asset.value)}</td>
                  <td>
                    <Badge color={asset.condition === 'Excellent' || asset.condition === 'Good' ? 'green' : 'amber'}>
                      {asset.condition}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <Modal title="Register New Asset" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Asset Name</label>
              <input className="input" required value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} placeholder="e.g. School Bus (KCG 123X)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="field-label">Category</label>
                <select className="input" value={assetForm.category} onChange={e => setAssetForm({...assetForm, category: e.target.value})}>
                  <option value="Electronics">Electronics</option>
                  <option value="Vehicles">Vehicles</option>
                  <option value="Buildings">Buildings</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Equipment">Equipment</option>
                </select>
              </div>
              <div>
                <label className="field-label">Value (KES)</label>
                <input type="number" required className="input" value={assetForm.value} onChange={e => setAssetForm({...assetForm, value: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label className="field-label">Condition</label>
                <select className="input" value={assetForm.condition} onChange={e => setAssetForm({...assetForm, condition: e.target.value})}>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="field-label">Location / Department</label>
                <input className="input" required value={assetForm.location} onChange={e => setAssetForm({...assetForm, location: e.target.value})} placeholder="e.g. Transport Yard" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Register Asset</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
