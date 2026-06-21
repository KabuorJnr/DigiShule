import { useState } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import { Icon } from '../components/icons';

export default function CreateExam({ store }) {
  const { navigate, notify } = store;
  const [scope, setScope] = useState('school');
  const [publish, setPublish] = useState(false);

  const handleCreate = () => {
    notify('Exam created successfully', 'success', 'Create Exam');
    navigate('exams');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#e0e7ff', color: '#0052cc', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          <Icon name="plus" size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, color: '#0052cc', fontSize: 22 }}>Create Exam</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Create a new exam for students</p>
        </div>
      </div>

      <div style={{ background: '#0052cc', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 28, background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}><Icon name="graduation-cap" size={24} color="#fff" /></span>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Principal</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
              Role: Deputy Academics | Exam Management<br />
              Create and manage school examinations
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div style={{ marginBottom: 4 }}><Icon name="calendar" size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Monday, June 15, 2026</div>
          <div><Icon name="graduation-cap" size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Term: Term 1</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, borderBottom: '1px solid #eef2f7', paddingBottom: 12 }}>
        <button className="btn btn-sm" style={{ background: 'transparent', color: '#64748b', boxShadow: 'none' }} onClick={() => navigate('exams')}>
          ← Back to Exams
        </button>
        <button className="btn btn-sm" style={{ background: '#eef2f7', color: '#0f172a', border: 'none' }}>
          📅 Exam Calendar
        </button>
        <button className="btn btn-sm" style={{ background: 'transparent', color: '#64748b', boxShadow: 'none' }}>
          📈 Exam Reports
        </button>
      </div>

      <div className="grid grid-2" style={{ gap: 32, marginTop: 24, gridTemplateColumns: '2fr 1fr' }}>
        
        {/* Left Column - Grade */}
        <div>
          <h3 style={{ color: '#0052cc', marginTop: 0, marginBottom: 16, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span><Icon name="plus" size={16} /></span> Exam Details
          </h3>
          
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div>
              <label className="field-label">Exam Name *</label>
              <input className="input" placeholder="e.g., End of Term 1 Examination" />
            </div>
            <div>
              <label className="field-label">Exam Code *</label>
              <input className="input" placeholder="e.g., ET1-2024" />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Unique identifier for this exam</div>
            </div>
            
            <div>
              <label className="field-label">Academic Term *</label>
              <select className="select">
                <option>Select Term</option>
                <option>Term 1</option>
                <option>Term 2</option>
                <option>Term 3</option>
              </select>
            </div>
            <div>
              <label className="field-label">Exam Type *</label>
              <select className="select">
                <option>Select Exam Type</option>
                <option>End-Term</option>
                <option>Mid-Term</option>
                <option>CAT</option>
                <option>Mock</option>
              </select>
            </div>
            
            <div>
              <label className="field-label">Start Date *</label>
              <input type="date" className="input" defaultValue="2026-06-14" />
            </div>
            <div>
              <label className="field-label">End Date</label>
              <input type="date" className="input" />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Optional - for multi-day exams</div>
            </div>
            
            <div>
              <label className="field-label">Weighting (%)</label>
              <input type="number" className="input" placeholder="100.00" />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Contribution to final grade</div>
            </div>
          </div>
          
          <div style={{ marginTop: 16 }}>
            <label className="field-label">Description</label>
            <textarea className="input" rows={3} placeholder="Optional exam description..."></textarea>
          </div>

          <h3 style={{ color: '#0052cc', marginTop: 32, marginBottom: 16, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="clock" size={16} /> Exam Scope
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', border: scope === 'school' ? '1px solid #0052cc' : '1px solid #eef2f7', background: scope === 'school' ? '#f8fafc' : '#fff' }}>
              <input type="radio" name="scope" value="school" checked={scope === 'school'} onChange={() => setScope('school')} style={{ width: 18, height: 18, accentColor: '#0052cc' }} />
              <div>
                <strong style={{ color: scope === 'school' ? '#0052cc' : '#0f172a' }}><Icon name="facilities" size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> School Wide</strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>This exam will be created for all classes and subjects in the school</div>
              </div>
            </label>
            
            <label className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', border: scope === 'class' ? '1px solid #0052cc' : '1px solid #eef2f7', background: scope === 'class' ? '#f8fafc' : '#fff' }}>
              <input type="radio" name="scope" value="class" checked={scope === 'class'} onChange={() => setScope('class')} style={{ width: 18, height: 18, accentColor: '#0052cc' }} />
              <div>
                <strong style={{ color: scope === 'class' ? '#0052cc' : '#0f172a' }}><Icon name="users" size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Specific Class</strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Create this exam for a specific class only</div>
              </div>
            </label>
            
            <label className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', border: scope === 'subjects' ? '1px solid #0052cc' : '1px solid #eef2f7', background: scope === 'subjects' ? '#f8fafc' : '#fff' }}>
              <input type="radio" name="scope" value="subjects" checked={scope === 'subjects'} onChange={() => setScope('subjects')} style={{ width: 18, height: 18, accentColor: '#0052cc' }} />
              <div>
                <strong style={{ color: scope === 'subjects' ? '#0052cc' : '#0f172a' }}><Icon name="library" size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Specific Subjects</strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Create this exam for specific subjects across all classes</div>
              </div>
            </label>
          </div>

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="publish" checked={publish} onChange={(e) => setPublish(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0052cc' }} />
            <label htmlFor="publish" style={{ fontSize: 14 }}>Publish this exam immediately</label>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4, marginLeft: 24 }}>
            Published exams are visible to teachers for marks entry
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" style={{ background: '#0052cc', border: 'none', padding: '10px 20px', color: '#fff' }} onClick={handleCreate}>
              <Icon name="lock" size={16} style={{ marginRight: 6 }} /> Create Exam
            </button>
            <button className="btn" style={{ padding: '10px 20px' }} onClick={() => navigate('exams')}>
              Cancel
            </button>
          </div>
          
          <div className="card card-pad" style={{ marginTop: 32, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
            <div style={{ fontSize: 20 }}><Icon name="info" size={20} /></div>
            <div style={{ fontSize: 13, color: '#475569' }}>
              <strong style={{ color: '#0f172a' }}>Exam Creation Tips:</strong>
              <ul style={{ paddingLeft: 20, margin: '8px 0 0 0' }}>
                <li style={{ marginBottom: 4 }}>Published exams are immediately visible to teachers</li>
                <li style={{ marginBottom: 4 }}>Draft exams can be saved and published later</li>
                <li>Exam scope determines which teachers can access the exam</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar helpers */}
        <div>
          <h4 style={{ color: '#0052cc', marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            👁 Exam Preview
          </h4>
          <div className="card card-pad" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: 13, textAlign: 'center', padding: '30px 20px' }}>
            Select exam options to see preview...
          </div>

          <h4 style={{ color: '#0052cc', marginTop: 32, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚡ Quick Actions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn" style={{ justifyContent: 'flex-start', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => navigate('exams')}>
              🗂 Manage Exams
            </button>
          </div>

          <div className="card card-pad" style={{ marginTop: 32, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#0052cc', display: 'flex', alignItems: 'center', gap: 6 }}>
              💡 Exam Scope Help
            </h4>
            
            <strong style={{ fontSize: 13, color: '#0f172a' }}>Scope Options:</strong>
            <ul style={{ fontSize: 13, paddingLeft: 20, color: '#475569', marginTop: 8, marginBottom: 16 }}>
              <li style={{ marginBottom: 4 }}><strong>School Wide:</strong> All classes and subjects</li>
              <li style={{ marginBottom: 4 }}><strong>Specific Class:</strong> One class (optionally specific stream)</li>
              <li><strong>Specific Subjects:</strong> Selected subjects across all classes</li>
            </ul>
            
            <strong style={{ fontSize: 13, color: '#0f172a' }}>Teacher Access:</strong>
            <ul style={{ fontSize: 13, paddingLeft: 20, color: '#475569', marginTop: 8, marginBottom: 0 }}>
              <li style={{ marginBottom: 4 }}>Teachers only see exams for their assigned subjects</li>
              <li>Class teachers can enter marks for their class subjects</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
