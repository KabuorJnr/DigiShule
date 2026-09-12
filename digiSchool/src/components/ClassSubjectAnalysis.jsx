import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import {
  Card, CardHead, CardBody, Grid, MetricCard, SegmentedControl,
  SnButton, SnBadge,
} from './sneat';
import { 
  BarChart3, 
  Layers, 
  CheckSquare, 
  Square, 
  Filter, 
  Award, 
  TrendingUp, 
  BookOpen, 
  Download, 
  Printer, 
  ArrowUpDown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Medal
} from 'lucide-react';
import { 
  percentageToCbcGrade, 
  percentageToCbcPoints, 
  subjectAverage,
  CBC_BOUNDARIES,
  KCSE_BOUNDARIES,
  is844Class,
  getSubjectAbbr
} from '../utils/grading';
import { SUBJECTS, DEPT_COLORS, DEPARTMENTS } from '../data/seed';
import { downloadExcel, exportTablePDF } from '../utils/exporters';

// Subject Department Categorizations for Quick Presets
const SUBJECT_PRESETS = {
  all: { label: 'All Subjects', keys: [] },
  sciences: {
    label: 'Sciences',
    keys: ['Biology', 'Chemistry', 'Physics', 'Integrated Science']
  },
  languages: {
    label: 'Languages',
    keys: ['English', 'Kiswahili', 'Indigenous Language', 'French', 'German']
  },
  mathTech: {
    label: 'Math & Tech',
    keys: ['Mathematics', 'Core Mathematics', 'Computer Studies', 'Pre-Technical Studies']
  },
  humanities: {
    label: 'Humanities',
    keys: ['History', 'Geography', 'Social Studies', 'CRE', 'Religious Education (CRE)', 'IRE']
  },
  appliedArts: {
    label: 'Applied & Arts',
    keys: ['Community Service Learning', 'Creative Arts', 'Creative Arts & Sports', 'Agriculture', 'Agriculture & Nutrition', 'Business Studies']
  }
};

export default function ClassSubjectAnalysis({
  students = [],
  gradeBoundaries = [],
  schoolSettings = {},
  onSelectClass = null
}) {
  // Collect all unique subjects available from both seed and active student scores
  const allSubjects = useMemo(() => {
    const set = new Set(SUBJECTS);
    ['Core Mathematics', 'Computer Studies', 'Community Service Learning', 'Integrated Science', 'Social Studies', 'CRE', 'Agriculture', 'Pre-Technical Studies'].forEach(s => set.add(s));
    students.forEach(s => {
      if (s.scores) {
        Object.keys(s.scores).forEach(k => {
          if (k && k.trim()) set.add(k.trim());
        });
      }
    });
    return Array.from(set);
  }, [students]);

  // Selected subjects state: defaults to all subjects
  const [selectedSubjects, setSelectedSubjects] = useState(() => {
    // Start with core CBC subjects that exist
    return allSubjects.slice(0, 8);
  });

  // Class grouping mode: 'stream' (e.g. 10A, 10B) vs 'level' (Grade 10, Grade 9)
  const [groupMode, setGroupMode] = useState('stream');
  
  // Sort order for classes: 'mean_desc', 'mean_asc', 'name'
  const [sortBy, setSortBy] = useState('mean_desc');

  // Search filter for subjects
  const [subjectSearch, setSubjectSearch] = useState('');

  // Toggle single subject
  const toggleSubject = (sub) => {
    setSelectedSubjects(prev => {
      if (prev.includes(sub)) {
        if (prev.length <= 1) return prev; // Keep at least one subject
        return prev.filter(s => s !== sub);
      } else {
        return [...prev, sub];
      }
    });
  };

  // Apply a subject preset
  const applyPreset = (presetKey) => {
    if (presetKey === 'all') {
      setSelectedSubjects(allSubjects);
      return;
    }
    const preset = SUBJECT_PRESETS[presetKey];
    if (preset) {
      const matching = allSubjects.filter(sub => 
        preset.keys.some(k => k.toLowerCase() === sub.toLowerCase())
      );
      if (matching.length > 0) {
        setSelectedSubjects(matching);
      }
    }
  };

  const selectAll = () => setSelectedSubjects(allSubjects);
  const clearSelection = () => {
    if (allSubjects.length > 0) setSelectedSubjects([allSubjects[0]]);
  };

  // Group students per class / stream and compute metrics for the SELECTED SUBJECTS
  const classAnalysisData = useMemo(() => {
    if (!students || students.length === 0) return [];

    const groups = {};

    students.forEach(s => {
      if (!s.class) return;
      
      let key = s.class;
      if (groupMode === 'level') {
        // e.g. "Grade 10 Green" -> "Grade 10", "7A" -> "Grade 7"
        const match = s.class.match(/(\d+)/);
        key = match ? `Grade ${match[1]}` : s.class;
      }

      if (!groups[key]) {
        groups[key] = {
          name: key,
          studentCount: 0,
          students: [],
          subjectScores: {} // { [subject]: { total: 0, count: 0 } }
        };
        selectedSubjects.forEach(sub => {
          groups[key].subjectScores[sub] = { total: 0, count: 0 };
        });
      }

      groups[key].studentCount += 1;
      groups[key].students.push(s);

      // Accumulate scores for selected subjects
      selectedSubjects.forEach(sub => {
        const sc = s.scores?.[sub];
        if (sc !== undefined && sc !== null && sc !== 'X') {
          const val = subjectAverage(sc);
          if (val > 0) {
            groups[key].subjectScores[sub].total += val;
            groups[key].subjectScores[sub].count += 1;
          }
        }
      });
    });

    // Compute averages, points, and grade distribution per class
    const result = Object.values(groups).map(g => {
      let overallSum = 0;
      let overallCount = 0;
      const subjectAverages = {};

      selectedSubjects.forEach(sub => {
        const item = g.subjectScores[sub];
        const subAvg = item && item.count > 0 ? Math.round((item.total / item.count) * 10) / 10 : 0;
        subjectAverages[sub] = subAvg;
        if (subAvg > 0) {
          overallSum += subAvg;
          overallCount += 1;
        }
      });

      const classMean = overallCount > 0 ? Math.round((overallSum / overallCount) * 10) / 10 : 0;
      const cbcPoints = percentageToCbcPoints(classMean, 'CBC', gradeBoundaries);
      const perfLevel = percentageToCbcGrade(classMean, gradeBoundaries);

      // Best and lowest subject in this class
      const gradedSubs = Object.entries(subjectAverages).filter(([_, v]) => v > 0);
      gradedSubs.sort((a, b) => b[1] - a[1]);
      const topSub = gradedSubs[0] ? { name: gradedSubs[0][0], avg: gradedSubs[0][1] } : null;
      const lowestSub = gradedSubs.length > 1 ? { name: gradedSubs[gradedSubs.length - 1][0], avg: gradedSubs[gradedSubs.length - 1][1] } : null;

      // Student competency breakdown inside this class
      const dist = { EE: 0, ME: 0, AE: 0, BE: 0 };
      g.students.forEach(st => {
        // compute student's mean in selected subjects
        const stVals = selectedSubjects
          .map(sb => subjectAverage(st.scores?.[sb]))
          .filter(v => v > 0);
        if (stVals.length > 0) {
          const stMean = stVals.reduce((a, b) => a + b, 0) / stVals.length;
          const stGrade = percentageToCbcGrade(Math.round(stMean), gradeBoundaries);
          if (stGrade.startsWith('EE')) dist.EE += 1;
          else if (stGrade.startsWith('ME')) dist.ME += 1;
          else if (stGrade.startsWith('AE')) dist.AE += 1;
          else dist.BE += 1;
        }
      });

      return {
        name: g.name,
        studentCount: g.studentCount,
        classMean,
        cbcPoints,
        perfLevel,
        subjectAverages,
        topSub,
        lowestSub,
        dist
      };
    });

    // Sort classes
    if (sortBy === 'mean_desc') {
      result.sort((a, b) => b.classMean - a.classMean);
    } else if (sortBy === 'mean_asc') {
      result.sort((a, b) => a.classMean - b.classMean);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }

    return result;
  }, [students, selectedSubjects, groupMode, sortBy, gradeBoundaries]);

  // Overall School Metrics for Selected Subjects
  const overallMetrics = useMemo(() => {
    if (classAnalysisData.length === 0) {
      return { mean: 0, points: 0, topClass: null, gap: 0, subjectMeans: {} };
    }

    const totalStudents = classAnalysisData.reduce((a, b) => a + b.studentCount, 0);
    const validClasses = classAnalysisData.filter(c => c.classMean > 0);
    
    if (validClasses.length === 0) {
      return { mean: 0, points: 0, topClass: null, gap: 0, subjectMeans: {} };
    }

    const mean = Math.round((validClasses.reduce((a, b) => a + (b.classMean * b.studentCount), 0) / Math.max(1, totalStudents)) * 10) / 10;
    const points = percentageToCbcPoints(mean, 'CBC', gradeBoundaries);
    
    const sortedByMean = [...validClasses].sort((a, b) => b.classMean - a.classMean);
    const topClass = sortedByMean[0];
    const lowestClass = sortedByMean[sortedByMean.length - 1];
    const gap = topClass && lowestClass ? Math.round((topClass.classMean - lowestClass.classMean) * 10) / 10 : 0;

    // Per-subject schoolwide means
    const subjectMeans = {};
    selectedSubjects.forEach(sub => {
      let subTotal = 0;
      let subCount = 0;
      validClasses.forEach(c => {
        const val = c.subjectAverages[sub] || 0;
        if (val > 0) {
          subTotal += val * c.studentCount;
          subCount += c.studentCount;
        }
      });
      subjectMeans[sub] = subCount > 0 ? Math.round((subTotal / subCount) * 10) / 10 : 0;
    });

    return { mean, points, topClass, gap, subjectMeans, totalStudents };
  }, [classAnalysisData, selectedSubjects, gradeBoundaries]);

  // Filter subjects in selection list by search
  const filteredAvailableSubjects = useMemo(() => {
    if (!subjectSearch) return allSubjects;
    return allSubjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase()));
  }, [allSubjects, subjectSearch]);

  // Export handlers
  const handleExportPDF = () => {
    const isWide = selectedSubjects.length > 7;
    const head = [
      '# Rank',
      'Class / Stream',
      'Students',
      ...selectedSubjects.map(s => getSubjectAbbr(s)),
      'Mean Score (%)',
      'CBC Points',
      'Performance Level',
      'Top Performing Subject'
    ];
    const body = classAnalysisData.map((c, i) => {
      const subVals = selectedSubjects.map(s => c.subjectAverages[s] ? `${c.subjectAverages[s]}%` : '-');
      return [
        i + 1,
        c.name,
        c.studentCount,
        ...subVals,
        `${c.classMean}%`,
        `${c.cbcPoints} pts`,
        c.perfLevel,
        c.topSub ? `${c.topSub.name} (${c.topSub.avg}%)` : '-'
      ];
    });

    const foot = [
      '',
      'COHORT SUMMARY',
      overallMetrics.totalStudents || '-',
      ...selectedSubjects.map(s => `${overallMetrics.subjectMeans[s] || 0}%`),
      `${overallMetrics.mean}%`,
      `${overallMetrics.points} pts`,
      percentageToCbcGrade(overallMetrics.mean, gradeBoundaries),
      overallMetrics.topClass ? `${overallMetrics.topClass.name} (Top Class)` : '-'
    ];

    exportTablePDF({
      school: schoolSettings,
      title: `Class Performance Analysis - Selected Subjects (${selectedSubjects.length})`,
      subtitle: `Overall Cohort Mean: ${overallMetrics.mean}% · Cohort Size: ${overallMetrics.totalStudents || 0} Students · Curriculum Subjects: ${selectedSubjects.join(', ')}`,
      head,
      body,
      foot,
      filename: `class-subject-performance-analysis.pdf`,
      orientation: 'landscape',
      format: isWide ? 'a3' : 'a4'
    });
  };

  const handleExportExcel = () => {
    const aoa = [
      ['Class Performance Analysis by Subject'],
      ['Selected Subjects', selectedSubjects.join(', ')],
      ['# Rank', 'Class / Stream', 'Students', 'Mean Score (%)', 'CBC Points', 'Performance Level', 'Top Subject', ...selectedSubjects]
    ];
    classAnalysisData.forEach((c, i) => {
      const subVals = selectedSubjects.map(s => c.subjectAverages[s] ? `${c.subjectAverages[s]}%` : '-');
      aoa.push([
        i + 1,
        c.name,
        c.studentCount,
        `${c.classMean}%`,
        `${c.cbcPoints} pts`,
        c.perfLevel,
        c.topSub ? `${c.topSub.name} (${c.topSub.avg}%)` : '-',
        ...subVals
      ]);
    });
    downloadExcel(`class-subject-analysis.xlsx`, [{ name: 'Class Analysis', aoa }]);
  };

  // Color helper for performance
  const getPerfColor = (pct) => {
    if (pct >= 75) return '#047857'; // EE
    if (pct >= 58) return '#0284c7'; // ME1
    if (pct >= 41) return '#d97706'; // ME2 / AE
    return '#dc2626'; // BE
  };

  return (
    <div className="sneat" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-gap)', background: 'transparent' }}>

      {/* ── 1. HEADER & GLOBAL CONTROLS ── */}
      <Card>
        <CardHead
          title="Class performance by subject"
          subtitle="Group by class or stream, and choose which subjects to analyse"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <SegmentedControl
                value={groupMode}
                onChange={setGroupMode}
                options={[
                  { id: 'stream', label: 'By stream' },
                  { id: 'level', label: 'By grade level' },
                ]}
              />
              <select
                className="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ height: 34, fontSize: 13, padding: '0 10px' }}
              >
                <option value="mean_desc">Highest mean</option>
                <option value="mean_asc">Lowest mean</option>
                <option value="name">Class name</option>
              </select>
              <SnButton variant="ghost" onClick={handleExportExcel}><Download size={14} /> Excel</SnButton>
              <SnButton variant="outline" onClick={handleExportPDF}><Printer size={14} /> PDF</SnButton>
            </div>
          }
        />
        <CardBody>

        {/* ── 2. SUBJECT SELECTION BAR ("One can choose the subjects to analyze") ── */}
        <div style={{ 
          marginTop: 16, 
          paddingTop: 16, 
          borderTop: '1px solid #e2e8f0' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                Select Subjects to Analyze:
              </span>
              <span style={{ 
                fontSize: 11, 
                fontWeight: 700, 
                background: '#e0f2fe', 
                color: '#0369a1', 
                padding: '2px 8px', 
                borderRadius: 12 
              }}>
                {selectedSubjects.length} of {allSubjects.length} Selected
              </span>
            </div>

            {/* Quick Department Presets & Search */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Filter subjects..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  style={{
                    height: 26,
                    fontSize: 11,
                    padding: '0 8px',
                    borderRadius: 14,
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    width: 120
                  }}
                />
              </div>
              <button 
                className="btn btn-sm" 
                onClick={selectAll}
                style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
              >
                Select All
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => applyPreset('sciences')}
                style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
              >
                Sciences
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => applyPreset('languages')}
                style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
              >
                Languages
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => applyPreset('mathTech')}
                style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
              >
                Math & Tech
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => applyPreset('humanities')}
                style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
              >
                Humanities
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => applyPreset('appliedArts')}
                style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
              >
                Applied/Arts
              </button>
              <button 
                className="btn btn-sm" 
                onClick={clearSelection}
                style={{ fontSize: 11, padding: '2px 8px', height: 26, color: '#94a3b8' }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Interactive Subject Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {filteredAvailableSubjects.map(sub => {
              const isSelected = selectedSubjects.includes(sub);
              const deptColor = DEPT_COLORS[DEPARTMENTS[sub]] || '#0284c7';
              return (
                <button
                  key={sub}
                  onClick={() => toggleSubject(sub)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : '#f8fafc',
                    color: isSelected ? '#1d4ed8' : '#64748b',
                    border: isSelected ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Click to ${isSelected ? 'remove' : 'include'} ${sub} in class analysis`}
                >
                  <span style={{ 
                    width: 7, 
                    height: 7, 
                    borderRadius: '50%', 
                    background: isSelected ? deptColor : '#cbd5e1' 
                  }} />
                  <span>{sub}</span>
                  {isSelected && <CheckCircle2 size={12} color="#2563eb" />}
                </button>
              );
            })}
          </div>
        </div>
        </CardBody>
      </Card>

      {/* ── 3. TOP KPI CARDS FOR SELECTED SUBJECTS ── */}
      <Grid cols={4}>
        <MetricCard
          label="Top class / stream"
          value={overallMetrics.topClass ? overallMetrics.topClass.name : '—'}
          icon={<Award />}
          tone="success"
          foot={overallMetrics.topClass
            ? `${overallMetrics.topClass.classMean}% · ${overallMetrics.topClass.perfLevel}`
            : 'No data'}
        />
        <MetricCard
          label="Selected subjects mean"
          value={`${overallMetrics.mean}%`}
          icon={<TrendingUp />}
          tone="primary"
          foot={`${overallMetrics.points} CBC points · ${percentageToCbcGrade(overallMetrics.mean, gradeBoundaries)}`}
          progress={{ value: overallMetrics.mean, max: 100 }}
        />
        <MetricCard
          label="Performance spread"
          value={`${overallMetrics.gap}%`}
          icon={<BarChart3 />}
          tone={overallMetrics.gap > 20 ? 'danger' : overallMetrics.gap > 10 ? 'warning' : 'success'}
          foot="Gap between top and lowest class"
        />
        <MetricCard
          label="Cohort evaluated"
          value={overallMetrics.totalStudents || 0}
          icon={<BookOpen />}
          tone="info"
          foot={`Across ${classAnalysisData.length} class${classAnalysisData.length === 1 ? '' : 'es'}`}
        />
      </Grid>

      {/* ── 4. CLASS COMPARISON VISUAL CHARTS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        {/* Chart 1: Mean Percentage per Class */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                Class vs Class Mean ({selectedSubjects.length} Subjects)
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Weighted average percentage score in selected subjects
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#047857' }}><span style={{ width: 8, height: 8, background: '#047857', borderRadius: 2 }}></span> EE (&gt;=75%)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#0284c7' }}><span style={{ width: 8, height: 8, background: '#0284c7', borderRadius: 2 }}></span> ME (58-74%)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#d97706' }}><span style={{ width: 8, height: 8, background: '#d97706', borderRadius: 2 }}></span> AE (31-57%)</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={classAnalysisData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} angle={-15} textAnchor="end" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
              <Tooltip 
                formatter={(val, name, item) => [`${val}% (${item.payload.cbcPoints} pts · ${item.payload.perfLevel})`, 'Mean Score']}
                labelFormatter={(label) => `Class: ${label}`}
              />
              <Bar dataKey="classMean" radius={[4, 4, 0, 0]}>
                {classAnalysisData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getPerfColor(entry.classMean)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Selected Subject Comparison Across All Classes */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                Subject Performance Benchmark
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Mean performance for each selected subject across all classes
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart 
              data={selectedSubjects.map(sub => ({
                subject: sub.length > 12 ? sub.substring(0, 11) + '…' : sub,
                fullName: sub,
                mean: overallMetrics.subjectMeans[sub] || 0
              })).sort((a, b) => b.mean - a.mean)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="subject" width={95} tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
              <Tooltip formatter={(val) => [`${val}%`, 'Cohort Mean']} />
              <Bar dataKey="mean" fill="#1e3a8a" radius={[0, 4, 4, 0]} barSize={16}>
                {selectedSubjects.map((s, idx) => (
                  <Cell key={`cell-${idx}`} fill={DEPT_COLORS[DEPARTMENTS[s]] || '#1e3a8a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 5. DETAILED CLASS COMPARISON TABLE ── */}
      <Card>
        <CardHead
          title="Class leaderboard & breakdown"
          subtitle={`Evaluating ${selectedSubjects.length} subject${selectedSubjects.length === 1 ? '' : 's'}`}
          action={<SnBadge tone="primary">School mean {overallMetrics.mean}%</SnBadge>}
        />

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: 60, textAlign: 'center' }}># Rank</th>
                <th>Class / Stream</th>
                <th style={{ textAlign: 'center' }}>Students</th>
                <th style={{ textAlign: 'center' }}>Mean Score (%)</th>
                <th style={{ textAlign: 'center' }}>CBC Points</th>
                <th style={{ textAlign: 'center' }}>Performance Level</th>
                <th>Top Performing Subject</th>
                <th>Selected Subjects Breakdown</th>
                <th style={{ width: 100, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {classAnalysisData.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: i === 0 ? '#d97706' : '#64748b' }}>
                    {i === 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#d97706' }}>
                        <Trophy size={13} /> 1
                      </span>
                    ) : i === 1 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#64748b' }}>
                        <Medal size={13} /> 2
                      </span>
                    ) : i === 2 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#b45309' }}>
                        <Medal size={13} /> 3
                      </span>
                    ) : (
                      i + 1
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>
                    {c.name}
                  </td>
                  <td style={{ textAlign: 'center', color: '#64748b' }}>
                    {c.studentCount}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: getPerfColor(c.classMean) }}>
                        {c.classMean}%
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 12, 
                      background: '#eff6ff', 
                      color: '#1d4ed8' 
                    }}>
                      {c.cbcPoints} pts
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 4, 
                      fontSize: 11,
                      background: c.perfLevel.startsWith('EE') ? '#ecfdf5' : (c.perfLevel.startsWith('ME') ? '#eff6ff' : (c.perfLevel.startsWith('AE') ? '#fffbeb' : '#fef2f2')),
                      color: c.perfLevel.startsWith('EE') ? '#047857' : (c.perfLevel.startsWith('ME') ? '#1d4ed8' : (c.perfLevel.startsWith('AE') ? '#b45309' : '#b91c1c')),
                      border: `1px solid ${c.perfLevel.startsWith('EE') ? '#a7f3d0' : (c.perfLevel.startsWith('ME') ? '#bfdbfe' : (c.perfLevel.startsWith('AE') ? '#fde68a' : '#fecaca'))}`
                    }}>
                      {c.perfLevel}
                    </span>
                  </td>
                  <td>
                    {c.topSub ? (
                      <span style={{ color: '#047857', fontWeight: 600 }}>
                        {c.topSub.name}: <strong>{c.topSub.avg}%</strong>
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 280 }}>
                      {selectedSubjects.slice(0, 4).map(sub => {
                        const val = c.subjectAverages[sub] || 0;
                        return (
                          <span 
                            key={sub} 
                            style={{ 
                              fontSize: 10, 
                              padding: '1px 5px', 
                              borderRadius: 3, 
                              background: '#f1f5f9', 
                              color: '#334155' 
                            }}
                            title={`${sub}: ${val}%`}
                          >
                            {getSubjectAbbr(sub)}: <strong>{val > 0 ? `${val}%` : '-'}</strong>
                          </span>
                        );
                      })}
                      {selectedSubjects.length > 4 && (
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                          +{selectedSubjects.length - 4} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {onSelectClass && (
                      <button
                        className="btn btn-sm"
                        onClick={() => onSelectClass(c.name)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          borderColor: '#bfdbfe',
                          borderRadius: 6,
                          fontWeight: 600
                        }}
                        title={`Open Gradebook Grid for ${c.name}`}
                      >
                        Open Grid →
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {/* School Overall Summary Row */}
              <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                <td style={{ textAlign: 'center' }}>—</td>
                <td>School Cohort Total / Average</td>
                <td style={{ textAlign: 'center' }}>{overallMetrics.totalStudents}</td>
                <td style={{ textAlign: 'center', color: '#0284c7' }}>{overallMetrics.mean}%</td>
                <td style={{ textAlign: 'center' }}>{overallMetrics.points} pts</td>
                <td style={{ textAlign: 'center' }}>{percentageToCbcGrade(overallMetrics.mean, gradeBoundaries)}</td>
                <td colSpan={3}>
                  Across all {selectedSubjects.length} selected subjects
                </td>
              </tr>

              {classAnalysisData.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                    No student marks available for analysis in the selected subjects.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
