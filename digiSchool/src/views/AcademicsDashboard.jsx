import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import { CLASS_PERFORMANCE_DATA, TOP_SUBJECTS_DATA, CLASS_PERFORMANCE_SUMMARY } from '../data/seed';

function KpiCard({ icon, label, value, sub, valueColor }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: valueColor || '#0f172a', marginBottom: 2 }}>
        {value}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {sub}
      </div>
    </div>
  );
}

export default function AcademicsDashboard({ store, user }) {
  const { navigate } = store;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#e0e7ff', color: '#2563EB', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          📊
        </div>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Deputy Academics Dashboard</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Academic overview and performance analytics</p>
        </div>
      </div>

      <div style={{ background: '#0052cc', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 28, background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}>🎓</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Principal</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
              Role: Deputy Academics | Academic Affairs Office<br />
              Managing exams, curriculum, and academic performance
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div style={{ marginBottom: 4 }}>📅 Sunday, June 14, 2026</div>
          <div>🎓 Term: Term 1</div>
          <div>📝 Exams: 4</div>
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
        <KpiCard label="Total Students" value="61" sub="Boarding: 0 | Day: 61" valueColor="#2563EB" />
        <KpiCard label="Teaching Staff" value="20" sub="Active teachers" valueColor="#0EA5E9" />
        <KpiCard label="Classes & Streams" value="3 / 9" sub="Classes | Streams" valueColor="#10B981" />
        <KpiCard label="Subjects" value="17" sub="Active subjects" valueColor="#F59E0B" />
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 24 }}>
        <KpiCard label="Total Exams" value="5" sub="5 published" />
        <KpiCard label="Pending Marks Entry" value="0" sub="Exams pending marks" valueColor="#F59E0B" />
        <KpiCard label="Awaiting Approval" value="2" sub="Results to approve" valueColor="#EF4444" />
        <KpiCard label="Avg Performance" value="66.0%" sub="Overall average score" valueColor="#10B981" />
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#2563EB', fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📈</span> Class Performance Overview <span style={{ color: '#64748b', fontSize: 13, fontWeight: 400 }}>Average Score vs Pass Rate</span>
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={CLASS_PERFORMANCE_DATA} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
              <Tooltip formatter={(value) => `${value}%`} cursor={{ fill: '#f8fafc' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="average" name="Average Score (%)" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="passRate" name="Pass Rate (%)" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#2563EB', fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏆</span> Top Performing Subjects
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={TOP_SUBJECTS_DATA} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
              <Tooltip formatter={(value) => `${value}%`} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="score" name="Percentage (%)" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {TOP_SUBJECTS_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, fontSize: 13 }}>
            {TOP_SUBJECTS_DATA.map((subject, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#475569' }}>{subject.name}</span>
                <strong style={{ color: '#10B981' }}>{subject.score}%</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title" style={{ color: '#2563EB', fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📚</span> Class Performance Summary
          </h3>
          <button className="btn btn-sm" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
            Detailed Report →
          </button>
        </div>
        
        <table className="table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Students</th>
              <th>Streams</th>
              <th>Avg Score</th>
              <th>Pass Rate</th>
              <th>Marks</th>
              <th>Performance</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {CLASS_PERFORMANCE_SUMMARY.map(row => (
              <tr key={row.id}>
                <td><strong>{row.class}</strong></td>
                <td>{row.students}</td>
                <td>{row.streams}</td>
                <td>
                  <span style={{ color: row.avg >= 60 ? '#10B981' : row.avg >= 55 ? '#F59E0B' : '#EF4444', fontWeight: 600 }}>
                    {row.avg}%
                  </span>
                </td>
                <td>
                  <span style={{ background: row.passRate >= 75 ? '#dcfce7' : row.passRate >= 50 ? '#fef3c7' : '#fee2e2', color: row.passRate >= 75 ? '#166534' : row.passRate >= 50 ? '#92400e' : '#991b1b', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                    {row.passRate}%
                  </span>
                </td>
                <td>{row.marks}</td>
                <td>
                  <div style={{ width: 100, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.avg}%`, background: row.avg >= 60 ? '#10B981' : row.avg >= 55 ? '#F59E0B' : '#EF4444' }}></div>
                  </div>
                </td>
                <td>
                  <button className="btn btn-icon btn-sm" style={{ background: '#2563EB', color: '#fff', width: 28, height: 28, borderRadius: '50%' }}>
                    👁️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
