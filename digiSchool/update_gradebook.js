const fs = require('fs');
let code = fs.readFileSync('src/views/Gradebook.jsx', 'utf8');

// Add KpiCard import
code = code.replace(
  /import \{ PageHeader, Badge \} from '\.\.\/components\/widgets';/,
  "import { PageHeader, Badge, KpiCard } from '../components/widgets';"
);

// Update component signature
code = code.replace(
  /export default function Gradebook\(\{ store \}\) \{/,
  "export default function Gradebook({ store, params }) {\n  const activeTab = params?.tab || 'entry';"
);

// Inject tab navigation and start entry
code = code.replace(
  /<div className="card" style=\{\{ overflow: 'hidden', marginBottom: 16 \}\}>/,
  `      {/* Tabs View logic */}
      <div className="tab-container" style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {['entry', 'analysis', 'overview'].map(t => (
          <div key={t} style={{
            padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
            color: activeTab === t ? 'var(--primary)' : 'var(--muted)',
            borderBottom: activeTab === t ? '2px solid var(--primary)' : '2px solid transparent'
          }}>
            {t === 'entry' ? 'Result Entry' : t === 'analysis' ? 'Result Analysis' : 'Overview'}
          </div>
        ))}
      </div>

      {activeTab === 'entry' && (
      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>`
);

// Wrap table end and start Analysis tab
code = code.replace(
  /\{\/\* Performance summary \*\/\}/,
  "      )}\n\n      {/* Performance summary */}\n      {activeTab === 'analysis' && ("
);

// Wrap Analysis end and start Overview tab
code = code.replace(
  /<div className="grid grid-2">\n        <div className="card card-pad">\n          <h3 className="section-title">Top 5 Students<\/h3>/,
  `      )}

      {/* Overview View */}
      {activeTab === 'overview' && (
        <>
          <div className="stat-tiles" style={{ marginBottom: 16 }}>
            <KpiCard icon="users" label="Total Students" value={rows.length} />
            <KpiCard icon="analytics" label="Class Average" value={colAvg ? colAvg.average + "%" : "N/A"} accent="#0369A1" />
            <KpiCard icon="check" label="Highest Score" value={top5[0] ? top5[0].average + "%" : "N/A"} accent="#10B981" />
            <KpiCard icon="warning" label="At-Risk" value={atRisk.length} accent="#EF4444" sub="Below 40%" />
          </div>
          <div className="grid grid-2">
            <div className="card card-pad">
              <h3 className="section-title">Top 5 Students</h3>`
);

// Close Overview tab
code = code.replace(
  /    <\/div>\n  \);\n\}/,
  "        </>\n      )}\n    </div>\n  );\n}"
);

fs.writeFileSync('src/views/Gradebook.jsx', code);
