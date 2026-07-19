import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { Monitor, Car, Building } from 'lucide-react';

export default function AssetTab() {
  const { store } = useOutletContext();
  const notify = store?.notify || (() => {});

  const [assets, setAssets] = useState([
    { id: 'AST-001', name: 'School Bus (KCG 123X)', category: 'Vehicles', value: 4500000, condition: 'Good', location: 'Transport Yard', purchased: '2023-01-15' },
    { id: 'AST-002', name: 'Computer Lab PCs (x30)', category: 'Electronics', value: 1200000, condition: 'Excellent', location: 'Lab 1', purchased: '2025-05-10' },
    { id: 'AST-003', name: 'Admin Block Printers (x2)', category: 'Electronics', value: 150000, condition: 'Requires Maintenance', location: 'Admin Block', purchased: '2022-11-20' },
    { id: 'AST-004', name: 'Science Lab Equipment', category: 'Equipment', value: 800000, condition: 'Good', location: 'Science Block', purchased: '2024-03-05' },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  
  const totalValue = assets.reduce((sum, a) => sum + a.value, 0);

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
          <button className="btn btn-primary" onClick={() => notify('Add Asset feature would open here')}>Register Asset</button>
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
              {assets.map(asset => (
                <tr key={asset.id}>
                  <td className="muted" style={{ fontSize: 12 }}>{asset.id}</td>
                  <td style={{ fontWeight: 600 }}>{asset.name}</td>
                  <td>{asset.category}</td>
                  <td>{asset.location}</td>
                  <td>{asset.purchased}</td>
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
    </div>
  );
}
