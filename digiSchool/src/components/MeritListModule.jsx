import { useMemo, useState } from 'react';
import { 
  studentOverall, gradeFor, pointsForGrade, subjectAverage, 
  is844Class, calculateStandardDeviation, CBC_SUBJECTS, KCSE_844_SUBJECTS 
} from '../utils/grading';
import { exportTablePDF, downloadExcel } from '../utils/exporters';
import { Badge, ProgressBar } from './widgets';
import { 
  Award, Download, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown, 
  TrendingUp, TrendingDown, Users, CheckCircle2, FileSpreadsheet, FileText,
  Star, ShieldCheck, Info
} from 'lucide-react';

export default function MeritListModule({ 
  students = [], 
  schoolSettings = {}, 
  teachers = [], 
  classes = [], 
  userRole = 'dos', 
  currentStudentId = null,
  notify = console.log 
}) {
  // ── CONTROLS STATE ──
  const [modelMode, setModelMode] = useState('auto'); // 'auto' | 'cbc' | '844'
  const [selectedClass, setSelectedClass] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [passThreshold, setPassThreshold] = useState(50); // Pass mark threshold %
  const [sortField, setSortField] = useState('rank'); // 'rank' | 'name' | 'adm' | 'total' | 'avg' | subjectName
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Extract dynamic class names
  const classOptions = useMemo(() => {
    if (!students || students.length === 0) return classes.map(c => typeof c === 'string' ? c : c.name || '');
    const set = new Set(students.map(s => s.class).filter(Boolean));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [students, classes]);

  // Determine active curriculum model
  const activeCurriculum = useMemo(() => {
    if (modelMode !== 'auto') return modelMode.toUpperCase();
    if (selectedClass !== 'All') {
      return is844Class(selectedClass) ? '844' : 'CBC';
    }
    const sample844 = students.some(s => is844Class(s.class));
    return sample844 ? '844' : 'CBC';
  }, [modelMode, selectedClass, students]);

  // Active subject list based on curriculum model
  const activeSubjects = useMemo(() => {
    return activeCurriculum === '844' ? KCSE_844_SUBJECTS : CBC_SUBJECTS;
  }, [activeCurriculum]);

  // Filter & Evaluate Students
  const evaluatedStudents = useMemo(() => {
    let list = students.filter(s => 
      s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending'
    );

    if (selectedClass !== 'All') {
      list = list.filter(s => s.class === selectedClass);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        (s.name || '').toLowerCase().includes(q) || 
        (s.adm || s.admission_no || '').toLowerCase().includes(q)
      );
    }

    // Evaluate scores for active subjects
    const evaluated = list.map(s => {
      const is844 = activeCurriculum === '844' || is844Class(s.class);
      const overallPct = studentOverall(s, activeSubjects);
      const grade = gradeFor(overallPct, schoolSettings?.gradeBoundaries, is844 ? '844' : 'CBC');
      const pts = pointsForGrade(grade, is844 ? '844' : 'CBC');

      const subjectScores = {};
      let total = 0;
      let countedSubs = 0;

      activeSubjects.forEach(sub => {
        const val = subjectAverage(s.scores?.[sub]);
        subjectScores[sub] = val;
        total += val;
        if (val > 0) countedSubs++;
      });

      const average = activeSubjects.length > 0 ? Math.round((total / activeSubjects.length) * 10) / 10 : 0;
      const isPassed = is844 ? average >= passThreshold : (grade === 'EE' || grade === 'ME' || average >= passThreshold);

      return {
        id: s.id,
        adm: s.adm || s.admission_no || '-',
        name: s.name || 'Unnamed Student',
        class: s.class || '-',
        gender: s.gender || '-',
        scores: subjectScores,
        totalMarks: Math.round(total),
        averagePct: average,
        meanGrade: grade,
        points: pts,
        isPassed,
        raw: s
      };
    });

    // Initial Descending Sort by Total Marks for Rank Assignment
    evaluated.sort((a, b) => b.totalMarks - a.totalMarks);

    // Assign Positions / Ranks
    let currentRank = 1;
    const ranked = evaluated.map((s, idx, arr) => {
      if (idx > 0 && Math.abs(s.totalMarks - arr[idx - 1].totalMarks) < 0.1) {
        return { ...s, rank: arr[idx - 1].rank };
      } else {
        currentRank = idx + 1;
        return { ...s, rank: currentRank };
      }
    });

    // Custom Sorting based on user selection
    if (sortField === 'rank') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.rank - b.rank : b.rank - a.rank);
    } else if (sortField === 'name') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sortField === 'adm') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.adm.localeCompare(b.adm) : b.adm.localeCompare(a.adm));
    } else if (sortField === 'total') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.totalMarks - b.totalMarks : b.totalMarks - a.totalMarks);
    } else if (sortField === 'avg') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.averagePct - b.averagePct : b.averagePct - a.averagePct);
    } else if (activeSubjects.includes(sortField)) {
      ranked.sort((a, b) => {
        const scA = a.scores[sortField] || 0;
        const scB = b.scores[sortField] || 0;
        return sortDirection === 'asc' ? scA - scB : scB - scA;
      });
    }

    return ranked;
  }, [students, selectedClass, searchQuery, activeCurriculum, activeSubjects, passThreshold, schoolSettings, sortField, sortDirection]);

  // Handle Sort Click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'adm' ? 'asc' : 'desc');
    }
  };

  // ── CLASS & SUBJECT ANALYSIS LAYER ──
  const subjectAnalysis = useMemo(() => {
    if (evaluatedStudents.length === 0) return {};

    const analysis = {};
    activeSubjects.forEach(sub => {
      const scores = evaluatedStudents.map(s => s.scores[sub] || 0);
      const sum = scores.reduce((a, b) => a + b, 0);
      const mean = Math.round((sum / (scores.length || 1)) * 10) / 10;
      const sd = calculateStandardDeviation(scores);

      // Top Performer
      let topVal = -1;
      let topStudent = 'None';
      evaluatedStudents.forEach(s => {
        const val = s.scores[sub] || 0;
        if (val > topVal) {
          topVal = val;
          topStudent = `${s.name} (${val})`;
        }
      });

      // Pass Rate in Subject
      const passedCount = scores.filter(sc => sc >= passThreshold).length;
      const passPct = Math.round((passedCount / (scores.length || 1)) * 100);

      analysis[sub] = {
        mean,
        sd,
        topStudent,
        topScore: topVal > 0 ? topVal : 0,
        passPct
      };
    });

    return analysis;
  }, [evaluatedStudents, activeSubjects, passThreshold]);

  // Overall Class Statistics
  const classStats = useMemo(() => {
    if (evaluatedStudents.length === 0) {
      return { total: 0, meanScore: 0, overallGrade: '-', passRate: 0, topSubject: '-', weakSubject: '-' };
    }

    const totalStudents = evaluatedStudents.length;
    const overallMeanSum = evaluatedStudents.reduce((acc, s) => acc + s.averagePct, 0);
    const meanScore = Math.round((overallMeanSum / totalStudents) * 10) / 10;
    const overallGrade = gradeFor(meanScore, schoolSettings?.gradeBoundaries, activeCurriculum);

    const passedStudents = evaluatedStudents.filter(s => s.isPassed).length;
    const passRate = Math.round((passedStudents / totalStudents) * 100);

    // Identify Strongest and Weakest Subjects
    let bestSub = '-';
    let highestMean = -1;
    let worstSub = '-';
    let lowestMean = 999;

    Object.entries(subjectAnalysis).forEach(([sub, data]) => {
      if (data.mean > highestMean) {
        highestMean = data.mean;
        bestSub = sub;
      }
      if (data.mean < lowestMean && data.mean > 0) {
        lowestMean = data.mean;
        worstSub = sub;
      }
    });

    return {
      total: totalStudents,
      meanScore,
      overallGrade,
      passRate,
      passedStudents,
      topSubject: bestSub !== '-' ? `${bestSub} (${highestMean}%)` : '-',
      weakSubject: worstSub !== '-' && worstSub !== bestSub ? `${worstSub} (${lowestMean}%)` : '-'
    };
  }, [evaluatedStudents, schoolSettings, activeCurriculum, subjectAnalysis]);

  // Parent View Filtering
  const displayedStudents = useMemo(() => {
    if (userRole === 'parent' && currentStudentId) {
      return evaluatedStudents.filter(s => String(s.id) === String(currentStudentId));
    }
    return evaluatedStudents;
  }, [evaluatedStudents, userRole, currentStudentId]);

  // ── PDF EXPORT ──
  const handleExportPDF = () => {
    if (evaluatedStudents.length === 0) return notify('No students to export', 'warning');

    const head = [
      ['Rank', 'Adm No', 'Student Name', 'Class', ...activeSubjects, 'Total', 'Avg %', activeCurriculum === '844' ? 'Grade (Pts)' : 'Rating']
    ];

    const body = evaluatedStudents.map(s => [
      `#${s.rank}`,
      s.adm,
      s.name,
      s.class,
      ...activeSubjects.map(sub => s.scores[sub] || '-'),
      s.totalMarks,
      `${s.averagePct.toFixed(1)}%`,
      activeCurriculum === '844' ? `${s.meanGrade} (${s.points}pts)` : s.meanGrade
    ]);

    // Subject Mean Footer Row
    const footerRow = [
      'CLASS MEAN', '-', '-', '-',
      ...activeSubjects.map(sub => subjectAnalysis[sub]?.mean || '-'),
      '-',
      `${classStats.meanScore}%`,
      classStats.overallGrade
    ];
    body.push(footerRow);

    exportTablePDF({
      school: schoolSettings,
      title: `OFFICIAL MERIT LIST — ${activeCurriculum === '844' ? '8-4-4 KCSE MODEL' : 'CBC COMPETENCY RATING'}`,
      subtitle: `Scope: ${selectedClass === 'All' ? 'All Classes & Streams' : selectedClass} | Ranked Students: ${evaluatedStudents.length} | Class Mean: ${classStats.meanScore}% (${classStats.overallGrade})`,
      head,
      body,
      filename: `Merit_List_${activeCurriculum}_${selectedClass.replace(/\s+/g, '_')}.pdf`
    });
    notify(`Merit list exported as PDF (${evaluatedStudents.length} students)`, 'success');
  };

  // ── NEMIS EXCEL EXPORT ──
  const handleExportExcel = () => {
    if (evaluatedStudents.length === 0) return notify('No students to export', 'warning');

    const headers = ['Rank', 'NEMIS_UPI_ADM', 'Student_Name', 'Gender', 'Class_Stream', ...activeSubjects, 'Total_Marks', 'Average_Pct', 'Grade_Rating', 'Points'];
    const rows = [headers];

    evaluatedStudents.forEach(s => {
      const row = [
        s.rank,
        s.adm,
        s.name,
        s.gender,
        s.class,
        ...activeSubjects.map(sub => s.scores[sub] || 0),
        s.totalMarks,
        s.averagePct,
        s.meanGrade,
        s.points
      ];
      rows.push(row);
    });

    // Append Subject Means
    rows.push(['-', 'SUMMARY', 'CLASS MEAN', '-', '-', ...activeSubjects.map(sub => subjectAnalysis[sub]?.mean || 0), '-', classStats.meanScore, classStats.overallGrade, '-']);

    downloadExcel(`NEMIS_Merit_List_${selectedClass.replace(/\s+/g, '_')}.xlsx`, [{ name: 'Merit List', aoa: rows }]);
    notify('Exported NEMIS-compatible Excel sheet', 'success');
  };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, marginBottom: 20 }}>
      {/* ── TOOLBAR & CONTROLS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={20} color="#047857" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Merit List & Student Performance Analysis
            </h2>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#047857', padding: '2px 8px', borderRadius: 4 }}>
              {activeCurriculum === '844' ? '8-4-4 KCSE Model' : 'CBC Competency Rating'}
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
            Multi-curriculum academic ranking, subject mean analysis & standard deviation statistics
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            onClick={handleExportExcel}
            className="btn"
            style={{ height: 34, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileSpreadsheet size={14} color="#047857" /> Export NEMIS Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="btn btn-primary"
            style={{ height: 34, fontSize: 12, background: '#047857', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> Export PDF Report
          </button>
        </div>
      </div>

      {/* ── INTERACTIVE CONTROLS BAR ── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Curriculum Toggle */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Curriculum Model</label>
            <select 
              value={modelMode} 
              onChange={e => setModelMode(e.target.value)}
              style={{ height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12, background: '#ffffff', fontWeight: 600 }}
            >
              <option value="auto">Auto (Class Detect)</option>
              <option value="cbc">CBC Model (Primary & Junior)</option>
              <option value="844">8-4-4 Model (KCSE Forms)</option>
            </select>
          </div>

          {/* Class Stream Filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Class Stream</label>
            <select 
              value={selectedClass} 
              onChange={e => setSelectedClass(e.target.value)}
              style={{ height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12, background: '#ffffff', fontWeight: 600 }}
            >
              {classOptions.map(c => <option key={c} value={c}>{c === 'All' ? 'All Classes & Streams' : `Stream ${c}`}</option>)}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Search Student</label>
            <div style={{ position: 'relative', width: 180 }}>
              <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 8, top: 9 }} />
              <input 
                type="text" 
                placeholder="Search name or adm..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: 26, height: 32, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, background: '#ffffff' }}
              />
            </div>
          </div>

          {/* Pass Threshold Selector */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Pass Threshold %</label>
            <select 
              value={passThreshold} 
              onChange={e => setPassThreshold(Number(e.target.value))}
              style={{ height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12, background: '#ffffff', fontWeight: 600 }}
            >
              <option value={40}>40% (Minimum)</option>
              <option value={50}>50% (Standard Pass)</option>
              <option value={60}>60% (Credit Threshold)</option>
              <option value={70}>70% (Distinction)</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
          Ranked: <strong style={{ color: '#047857' }}>{evaluatedStudents.length}</strong> Students
        </div>
      </div>

      {/* ── OVERALL CLASS SUMMARY STATS CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', padding: 12, borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Class Mean Score</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#047857', marginTop: 2 }}>
            {classStats.meanScore}% <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>({classStats.overallGrade})</span>
          </div>
          <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>Across {activeSubjects.length} active subjects</div>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: 12, borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Pass Rate %</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
            {classStats.passRate}%
          </div>
          <div style={{ fontSize: 11, color: '#1e40af', marginTop: 2 }}>{classStats.passedStudents} of {classStats.total} passed (&ge;{passThreshold}%)</div>
        </div>

        <div style={{ background: '#fdf4ff', border: '1px solid #fae8ff', padding: 12, borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#86198f', textTransform: 'uppercase' }}>Strongest Subject</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#701a75', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {classStats.topSubject}
          </div>
          <div style={{ fontSize: 11, color: '#86198f', marginTop: 2 }}>Highest class average</div>
        </div>

        <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: 12, borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>Subject Needing Focus</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#c2410c', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {classStats.weakSubject}
          </div>
          <div style={{ fontSize: 11, color: '#9a3412', marginTop: 2 }}>Lowest class average</div>
        </div>
      </div>

      {/* ── MAIN MERIT RANKING TABLE ── */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 16 }}>
        <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
              <th onClick={() => handleSort('rank')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Rank {sortField === 'rank' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th onClick={() => handleSort('adm')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Adm No {sortField === 'adm' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th onClick={() => handleSort('name')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Student Name {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Stream
              </th>

              {/* Dynamic Subject Columns */}
              {activeSubjects.map(sub => (
                <th 
                  key={sub} 
                  onClick={() => handleSort(sub)} 
                  style={{ 
                    padding: '10px 8px', 
                    fontSize: 11, 
                    textTransform: 'uppercase', 
                    textAlign: 'center', 
                    cursor: 'pointer', 
                    userSelect: 'none', 
                    whiteSpace: 'nowrap',
                    background: sortField === sub ? '#e2e8f0' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <span>{sub.length > 10 ? `${sub.substring(0, 8)}..` : sub}</span>
                    {sortField === sub && (sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </div>
                </th>
              ))}

              <th onClick={() => handleSort('total')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  Total Marks {sortField === 'total' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th onClick={() => handleSort('avg')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  Mean % {sortField === 'avg' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {activeCurriculum === '844' ? 'KCSE Grade (Pts)' : 'CBC Competency'}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedStudents.map((s) => {
              // Top 3 Accent Styles
              let rowStyle = { borderBottom: '1px solid #e2e8f0' };
              let rankBadge = null;

              if (s.rank === 1) {
                rowStyle.background = '#fffbeb'; // Subtle Gold Accent
                rankBadge = (
                  <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    🥇 #1 Top
                  </span>
                );
              } else if (s.rank === 2) {
                rowStyle.background = '#f8fafc'; // Subtle Silver Accent
                rankBadge = (
                  <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    🥈 #2
                  </span>
                );
              } else if (s.rank === 3) {
                rowStyle.background = '#fff7ed'; // Subtle Bronze Accent
                rankBadge = (
                  <span style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    🥉 #3
                  </span>
                );
              } else {
                rankBadge = <strong style={{ color: '#64748b' }}>#{s.rank}</strong>;
              }

              return (
                <tr key={s.id || s.adm} style={rowStyle}>
                  <td style={{ padding: '10px 12px' }}>{rankBadge}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{s.adm}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{s.class}</td>

                  {/* Subject Scores Cells */}
                  {activeSubjects.map(sub => {
                    const score = s.scores[sub];
                    const isTopInSub = score > 0 && score === subjectAnalysis[sub]?.topScore;
                    return (
                      <td 
                        key={sub} 
                        style={{ 
                          padding: '10px 8px', 
                          textAlign: 'center', 
                          fontWeight: isTopInSub ? 800 : 600,
                          fontSize: 12,
                          background: isTopInSub ? '#dcfce7' : 'transparent',
                          color: isTopInSub ? '#15803d' : score >= passThreshold ? '#0f172a' : '#d13438'
                        }}
                      >
                        {score || '-'}
                      </td>
                    );
                  })}

                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: 13 }}>
                    {s.totalMarks}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                    {s.averagePct.toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {activeCurriculum === '844' ? (
                      <Badge color={s.meanGrade === 'A' || s.meanGrade === 'A-' ? 'green' : s.meanGrade === 'E' || s.meanGrade === 'D-' ? 'red' : 'blue'}>
                        {s.meanGrade} ({s.points}pts)
                      </Badge>
                    ) : (
                      <Badge color={s.meanGrade === 'EE' ? 'green' : s.meanGrade === 'BE' ? 'red' : 'blue'}>
                        {s.meanGrade}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ── FOOTER ROW: PER-SUBJECT CLASS MEANS & TOP PERFORMERS ── */}
          {userRole !== 'parent' && (
            <tfoot>
              {/* Row 1: Subject Means */}
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
                <td colSpan={4} style={{ padding: '10px 12px', color: '#0f172a', fontSize: 12 }}>
                  CLASS SUBJECT MEANS
                </td>
                {activeSubjects.map(sub => (
                  <td key={sub} style={{ padding: '10px 8px', textAlign: 'center', color: '#047857', fontWeight: 800, fontSize: 12 }}>
                    {subjectAnalysis[sub]?.mean || '-'}%
                  </td>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#047857', fontWeight: 800 }}>-</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#047857', fontWeight: 800, fontSize: 13 }}>
                  {classStats.meanScore}%
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#047857' }}>
                  {classStats.overallGrade}
                </td>
              </tr>

              {/* Row 2: Standard Deviation */}
              <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', fontSize: 11 }}>
                <td colSpan={4} style={{ padding: '8px 12px', color: '#475569' }}>
                  Standard Deviation (SD)
                </td>
                {activeSubjects.map(sub => (
                  <td key={sub} style={{ padding: '8px 8px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                    &plusmn;{subjectAnalysis[sub]?.sd || 0}
                  </td>
                ))}
                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                  Statistical Variance
                </td>
              </tr>

              {/* Row 3: Top Performer per Subject */}
              <tr style={{ background: '#f0fdf4', borderTop: '1px solid #dcfce7', fontSize: 11 }}>
                <td colSpan={4} style={{ padding: '8px 12px', color: '#166534', fontWeight: 700 }}>
                  🏆 Subject Champions
                </td>
                {activeSubjects.map(sub => (
                  <td key={sub} style={{ padding: '8px 8px', textAlign: 'center', color: '#15803d', fontWeight: 700 }}>
                    {subjectAnalysis[sub]?.topScore ? `${subjectAnalysis[sub]?.topScore}pts` : '-'}
                  </td>
                ))}
                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', color: '#166534', fontWeight: 700 }}>
                  Highest Column Scorers
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {displayedStudents.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 13 }}>
          No student records found matching the active filters or class selection.
        </div>
      )}

      {/* ── DETAILED PER-SUBJECT ANALYSIS GRID ── */}
      {userRole !== 'parent' && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} color="#047857" /> Per-Subject Performance Matrix & Top Performers
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {activeSubjects.map(sub => {
              const data = subjectAnalysis[sub] || {};
              return (
                <div key={sub} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{sub}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
                      {data.mean}% Mean
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                    <span>Pass Rate: <strong>{data.passPct}%</strong></span>
                    <span>SD: <strong>&plusmn;{data.sd}</strong></span>
                  </div>

                  <ProgressBar value={data.mean} color={data.mean >= 60 ? '#047857' : data.mean >= 45 ? '#d97706' : '#d13438'} />

                  <div style={{ fontSize: 11, color: '#334155', marginTop: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={11} color="#b45309" fill="#fde68a" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      Top: {data.topStudent}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
