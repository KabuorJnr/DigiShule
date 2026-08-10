import React, { useMemo } from 'react';
import { studentOverall } from '../utils/grading';
import { SUBJECTS } from '../data/seed';
import { BarChart2 } from 'lucide-react';

export default function StreamPerformanceGraph({ students = [] }) {
  const streamData = useMemo(() => {
    const classGroups = {};
    students.forEach(s => {
      if (!s.class) return;
      if (!classGroups[s.class]) {
        classGroups[s.class] = { name: s.class, totalScore: 0, count: 0 };
      }
      const score = studentOverall(s, SUBJECTS);
      classGroups[s.class].totalScore += score;
      classGroups[s.class].count += 1;
    });

    const data = Object.values(classGroups).map(g => ({
      name: g.name,
      avg: g.count > 0 ? (g.totalScore / g.count) : 0,
      count: g.count
    }));
    
    // Sort by class name for logical progression, or by avg for a leaderboard
    data.sort((a, b) => b.avg - a.avg);
    return data;
  }, [students]);
  
  if (streamData.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: 13 }}>No stream data available</div>
      </div>
    );
  }

  // To make the graph look good, we normalize heights relative to the max average
  const maxAvg = Math.max(1, ...streamData.map(d => d.avg));
  const maxDisplay = Math.ceil(maxAvg / 10) * 10; // Round up to nearest 10

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', minHeight: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart2 size={16} color="#111827" strokeWidth={1.75} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Stream vs Stream Performance</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Average percentage score by class / stream</div>
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 12, paddingTop: 20, position: 'relative', minHeight: 180 }}>
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
          // Normalize height to the display max (usually 100 or slightly above the highest score)
          const heightPct = (d.avg / Math.max(maxDisplay, 100)) * 100;
          return (
            <div key={d.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                {d.avg.toFixed(1)}%
              </div>
              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: 48, 
                  height: `${heightPct}%`, 
                  background: i === 0 ? '#047857' : (i < 3 ? '#10b981' : '#3b82f6'), 
                  borderRadius: '4px 4px 0 0',
                  opacity: 0.9,
                  transition: 'height 0.5s ease-out'
                }} 
              />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', marginTop: 10, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', padding: '0 4px' }} title={d.name}>
                {d.name.replace('Grade ', 'G').replace('Form ', 'F')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
