import React, { useMemo, useState } from 'react';
import { studentOverall, subjectAverage } from '../utils/grading';
import { SUBJECTS } from '../data/seed';
import { BarChart2, Filter } from 'lucide-react';

export default function StreamPerformanceGraph({ students = [] }) {
  const [subjectFilter, setSubjectFilter] = useState('All');

  // Discover all unique subjects in data
  const availableSubjects = useMemo(() => {
    const set = new Set(SUBJECTS);
    students.forEach(s => {
      if (s.scores) {
        Object.keys(s.scores).forEach(k => {
          if (k && k.trim()) set.add(k.trim());
        });
      }
    });
    return Array.from(set);
  }, [students]);

  const streamData = useMemo(() => {
    const classGroups = {};
    students.forEach(s => {
      if (!s.class) return;
      if (!classGroups[s.class]) {
        classGroups[s.class] = { name: s.class, totalScore: 0, count: 0 };
      }

      let score = 0;
      if (subjectFilter === 'All') {
        score = studentOverall(s, availableSubjects);
      } else {
        const sc = s.scores?.[subjectFilter];
        score = subjectAverage(sc);
      }

      if (score > 0) {
        classGroups[s.class].totalScore += score;
        classGroups[s.class].count += 1;
      }
    });

    const data = Object.values(classGroups).map(g => ({
      name: g.name,
      avg: g.count > 0 ? (g.totalScore / g.count) : 0,
      count: g.count
    }));
    
    data.sort((a, b) => b.avg - a.avg);
    return data;
  }, [students, subjectFilter, availableSubjects]);
  
  if (streamData.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: 13 }}>No stream data available</div>
      </div>
    );
  }

  const maxAvg = Math.max(1, ...streamData.map(d => d.avg));
  const maxDisplay = Math.ceil(maxAvg / 10) * 10;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', minHeight: 290 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={16} color="#111827" strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Class vs Class Performance</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {subjectFilter === 'All' ? 'Overall average percentage by class / stream' : `Mean performance for ${subjectFilter}`}
            </div>
          </div>
        </div>

        {/* Subject Filter Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} color="#6b7280" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Subject:</span>
          <select 
            className="select"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            style={{ height: 28, fontSize: 12, padding: '0 8px', fontWeight: 600, color: '#0369a1', borderColor: '#cbd5e1' }}
          >
            <option value="All">All Subjects (Overall)</option>
            {availableSubjects.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 12, paddingTop: 16, position: 'relative', minHeight: 180 }}>
        {/* Y-axis guidelines */}
        {[0, 25, 50, 75, 100].map(val => {
          if (val > maxDisplay && val !== 100) return null;
          const bottomPct = (val / Math.max(maxDisplay, 100)) * 100;
          return (
            <div key={val} style={{ position: 'absolute', bottom: `${bottomPct}%`, left: 0, right: 0, borderTop: '1px dashed #e5e7eb', zIndex: 0 }}>
               {val > 0 && <span style={{ position: 'absolute', left: 0, top: -14, fontSize: 10, color: '#9ca3af' }}>{val}%</span>}
            </div>
          );
        })}
        
        {streamData.map((d, i) => {
          const heightPct = (d.avg / Math.max(maxDisplay, 100)) * 100;
          return (
            <div key={d.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: d.avg >= 75 ? '#047857' : (d.avg >= 58 ? '#0369a1' : '#4b5563'), marginBottom: 6 }}>
                {d.avg.toFixed(1)}%
              </div>
              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: 48, 
                  height: `${heightPct}%`, 
                  background: d.avg >= 75 ? '#047857' : (d.avg >= 58 ? '#0284c7' : (d.avg >= 40 ? '#d97706' : '#dc2626')), 
                  borderRadius: '4px 4px 0 0',
                  opacity: 0.9,
                  transition: 'height 0.4s ease-out'
                }} 
              />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', marginTop: 8, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', padding: '0 4px' }} title={d.name}>
                {d.name.replace('Grade ', 'G').replace('Form ', 'F')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
