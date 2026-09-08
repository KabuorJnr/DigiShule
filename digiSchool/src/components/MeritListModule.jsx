import { useMemo, useState } from 'react';
import { 
  studentOverall, gradeFor, pointsForGrade, subjectAverage, 
  is844Class, calculateStandardDeviation, CBC_SUBJECTS, KCSE_844_SUBJECTS 
} from '../utils/grading';
import { exportTablePDF, downloadExcel } from '../utils/exporters';
import { poppinsRegular } from '../utils/Poppins-Regular';
import { poppinsBold } from '../utils/Poppins-Bold';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge, ProgressBar } from './widgets';
import { 
  Award, Download, Filter, Search, ArrowUp, ArrowDown, 
  TrendingUp, FileSpreadsheet, CheckCircle2, Lock, Unlock, Edit3, Save,
  CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, BookOpen, ChevronRight,
  Trophy, Medal, Users, Layers
} from 'lucide-react';

export default function MeritListModule({ 
  students = [], 
  schoolSettings = {}, 
  teachers = [], 
  classes = [], 
  userRole = 'dos', 
  currentStudentId = null,
  notify = console.log,
  onUpdateStudentScores = null,
  onUpdateSettings = null,
  onNavigateGradebook = null
}) {
  // ── EXECUTIVE READ & WRITE PERMISSION ──
  const isExecutive = useMemo(() => {
    const role = (userRole || '').toLowerCase();
    return ['dos', 'deputy_academic', 'principal', 'admin', 'super_admin'].includes(role);
  }, [userRole]);

  // ── PUBLICATION & EDITING STATE ──
  const isPublished = !!schoolSettings?.results_published;
  const [publishedInfo, setPublishedInfo] = useState(() => {
    if (schoolSettings?.results_published) {
      return {
        approverRole: 'Director of Studies (DoS)',
        approvedAt: 'Certified Official'
      };
    }
    return null;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedScores, setEditedScores] = useState({}); // { studentId_subject: score }
  const principalSig = schoolSettings?.principal_signature_url || schoolSettings?.signature_url || null;

  // ── CONTROLS STATE ──
  const [modelMode, setModelMode] = useState('auto'); // 'auto' | 'cbc' | '844'
  const [viewScope, setViewScope] = useState('overall'); // 'overall' | 'stream'
  const [selectedClass, setSelectedClass] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [passThreshold, setPassThreshold] = useState(50); // Pass mark threshold %
  const [sortField, setSortField] = useState('rank'); // 'rank' | 'name' | 'adm' | 'total' | 'avg' | subjectName
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Extract dynamic class names
  const classOptions = useMemo(() => {
    if (!students || students.length === 0) {
      const expanded = classes.reduce((acc, c) => {
        if (typeof c === 'string') return [...acc, c];
        if (!c.streams) return [...acc, c.name];
        const streams = c.streams.split(',').map(s => s.trim()).filter(Boolean);
        return [...acc, ...(streams.length ? streams.map(s => `${c.name} ${s}`) : [c.name])];
      }, []);
      return ['All', ...expanded];
    }
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

  // Filter & Evaluate Students with Live Score Overrides
  const allEvaluatedStudents = useMemo(() => {
    let list = students.filter(s => 
      s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending'
    );

    const evaluated = list.map(s => {
      const is844 = activeCurriculum === '844' || is844Class(s.class);
      const effectiveScores = { ...(s.scores || {}) };
      activeSubjects.forEach(sub => {
        const overrideKey = `${s.id}_${sub}`;
        if (editedScores[overrideKey] !== undefined) {
          effectiveScores[sub] = Number(editedScores[overrideKey]) || 0;
        }
      });

      const studentWithEffectiveScores = { ...s, scores: effectiveScores };
      const overallPct = studentOverall(studentWithEffectiveScores, activeSubjects);
      const grade = gradeFor(overallPct, schoolSettings?.gradeBoundaries, is844 ? '844' : 'CBC');
      const pts = pointsForGrade(grade, is844 ? '844' : 'CBC');

      const subjectScoresMap = {};
      let total = 0;

      activeSubjects.forEach(sub => {
        const val = subjectAverage(effectiveScores[sub]);
        subjectScoresMap[sub] = val;
        total += val;
      });

      const average = activeSubjects.length > 0 ? Math.round((total / activeSubjects.length) * 10) / 10 : 0;
      const isPassed = is844 ? average >= passThreshold : (grade === 'EE' || grade === 'ME' || average >= passThreshold);

      return {
        id: s.id,
        adm: s.adm || s.admission_no || '-',
        name: s.name || 'Unnamed Student',
        class: s.class || '-',
        gender: s.gender || '-',
        scores: subjectScoresMap,
        totalMarks: Math.round(total),
        averagePct: average,
        meanGrade: grade,
        points: pts,
        isPassed,
        raw: studentWithEffectiveScores
      };
    });

    evaluated.sort((a, b) => b.totalMarks - a.totalMarks);

    evaluated.forEach((s, idx) => {
      s.overallRank = idx + 1;
      s.rank = idx + 1; // Default
    });

    const streamGroups = {};
    evaluated.forEach(s => {
      const c = s.class || 'Unknown';
      if (!streamGroups[c]) streamGroups[c] = [];
      streamGroups[c].push(s);
    });

    Object.values(streamGroups).forEach(group => {
      group.forEach((s, idx) => {
        s.streamRank = idx + 1;
        s.streamTotal = group.length;
      });
    });

    return evaluated;
  }, [students, activeCurriculum, activeSubjects, passThreshold, schoolSettings, editedScores]);

  const evaluatedStudents = useMemo(() => {
    let list = allEvaluatedStudents;

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

    let ranked = list.map(s => ({
      ...s,
      rank: viewScope === 'stream' ? s.streamRank : s.overallRank
    }));
    
    // Maintain backwards compat with sorting
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
  }, [students, selectedClass, searchQuery, activeCurriculum, activeSubjects, passThreshold, schoolSettings, sortField, sortDirection, editedScores, viewScope]);

  // Handle Score Input Change (Exec Only)
  const handleScoreChange = (studentId, subject, val) => {
    if (!isExecutive) return;
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    setEditedScores(prev => ({
      ...prev,
      [`${studentId}_${subject}`]: num
    }));
  };

  // Save Score Modifications
  const handleSaveAllScores = () => {
    if (onUpdateStudentScores) {
      onUpdateStudentScores(editedScores);
    }
    setIsEditing(false);
    notify('Student scores updated and saved successfully!', 'success');
  };

  // Handle Sort Click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'adm' ? 'asc' : 'desc');
    }
  };

  // Toggle Publication (Executive Only)
  const handleTogglePublication = async () => {
    if (!isExecutive) return;
    const nextState = !isPublished;
    if (nextState) {
      const info = {
        approverRole: userRole === 'dos' ? 'Director of Studies (DoS)' : userRole === 'principal' ? 'Principal' : 'Deputy Academics',
        approvedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
      setPublishedInfo(info);
    } else {
      setPublishedInfo(null);
    }

    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ results_published: nextState });
      } catch (err) {
        console.error('Failed to update publication settings:', err);
      }
    }

    notify(
      nextState
        ? `Official Results APPROVED & PUBLISHED! Principal signature & DoS stamps active on all report forms.`
        : 'Merit list publication returned to DRAFT mode for moderation.',
      nextState ? 'success' : 'info'
    );
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

      let topVal = -1;
      let topStudent = 'None';
      evaluatedStudents.forEach(s => {
        const val = s.scores[sub] || 0;
        if (val > topVal) {
          topVal = val;
          topStudent = `${s.name} (${val})`;
        }
      });

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

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
    doc.addFileToVFS('Poppins-Regular.ttf', poppinsRegular);
    doc.addFileToVFS('Poppins-Bold.ttf', poppinsBold);
    doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
    doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // -- HEADER SECTION --
    doc.setFont('Poppins', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text((schoolSettings?.name || 'DIGISHULE ACADEMY').toUpperCase(), pageWidth / 2, 35, { align: 'center' });
    
    doc.setFontSize(11);
    const subTitle = viewScope === 'stream' && selectedClass !== 'All'
      ? `STREAM MERIT LIST - STREAM ${selectedClass.toUpperCase()} - TERM 2 2026`
      : `OVERALL CLASS MERIT LIST - ALL STREAMS - TERM 2 2026`;
    doc.text(subTitle, pageWidth / 2, 55, { align: 'center' });

    // -- TABLE STRUCTURE --
    const headTop = [
      { content: 'SN', rowSpan: 2, styles: { halign: 'center', valign: 'bottom' } },
      { content: "CANDIDATE'S NUMBER", rowSpan: 2, styles: { halign: 'left', valign: 'bottom' } },
      { content: 'SEX', rowSpan: 2, styles: { halign: 'center', valign: 'bottom' } },
    ];
    activeSubjects.forEach(sub => {
      headTop.push({ content: sub, colSpan: 2, styles: { halign: 'center', valign: 'middle' } });
    });
    headTop.push({ content: 'AVERAGE', colSpan: 2, styles: { halign: 'center', valign: 'middle' } });
    headTop.push({ content: 'AGGT POINTS', rowSpan: 2, styles: { halign: 'center', valign: 'bottom' } });
    headTop.push({ content: 'DIVISION', rowSpan: 2, styles: { halign: 'center', valign: 'bottom' } });
    headTop.push({ content: 'Stream Pos', rowSpan: 2, styles: { halign: 'center', valign: 'bottom' } });
    headTop.push({ content: 'Overall Pos', rowSpan: 2, styles: { halign: 'center', valign: 'bottom' } });

    const headBottom = [];
    activeSubjects.forEach(() => {
      headBottom.push({ content: 'Marks', styles: { halign: 'center' } });
      headBottom.push({ content: 'Grade', styles: { halign: 'center' } });
    });
    headBottom.push({ content: 'Marks', styles: { halign: 'center' } });
    headBottom.push({ content: 'Grade', styles: { halign: 'center' } });

    const body = [];
    
    // Main Student Rows
    evaluatedStudents.forEach((s, idx) => {
      const row = [
        idx + 1,
        s.name.toUpperCase(),
        (s.gender || 'M').charAt(0).toUpperCase()
      ];
      activeSubjects.forEach(sub => {
        const score = s.scores[sub];
        if (score > 0) {
          row.push(score);
          row.push(gradeFor(score, schoolSettings?.gradeBoundaries, is844Class(s.class) ? '844' : 'CBC'));
        } else {
          row.push('-');
          row.push('-');
        }
      });
      row.push(s.averagePct.toFixed(1));
      row.push(s.meanGrade);
      row.push(s.points);
      row.push(s.meanGrade);
      row.push(`${s.streamRank}/${s.streamTotal || evaluatedStudents.length}`);
      row.push(`${s.overallRank}/${allEvaluatedStudents.length}`);
      body.push(row);
    });

    // -- FOOTER STATS --
    const gradeBuckets = [
      { label: 'Grade A', match: (g) => g.startsWith('A') || g === 'EE' },
      { label: 'Grade B', match: (g) => g.startsWith('B') || g === 'ME' },
      { label: 'Grade C', match: (g) => g.startsWith('C') || g === 'AE' },
      { label: 'Grade D', match: (g) => g.startsWith('D') },
      { label: 'Grade F', match: (g) => g.startsWith('E') || g.startsWith('F') || g === 'BE' },
    ];

    const getGradeForStat = (score) => gradeFor(score, schoolSettings?.gradeBoundaries, activeCurriculum);

    gradeBuckets.forEach((bucket, bIdx) => {
      ['F', 'M'].forEach((sex, sexIdx) => {
        const row = [];
        if (sexIdx === 0) {
          row.push({ content: '', rowSpan: 2 });
          row.push({ content: bucket.label, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: [0,0,128] } });
        }
        row.push({ content: sex, styles: { halign: 'center', fontStyle: 'bold' } });

        activeSubjects.forEach(sub => {
          let count = 0;
          evaluatedStudents.forEach(s => {
            if ((s.gender || 'M').charAt(0).toUpperCase() === sex && s.scores[sub] > 0) {
              const g = getGradeForStat(s.scores[sub]);
              if (bucket.match(g)) count++;
            }
          });
          row.push({ content: count < 10 ? `0${count}` : count, colSpan: 2, styles: { halign: 'center' } });
        });

        // Filler for remaining columns
        row.push({ content: sexIdx === 0 ? bucket.label : '', colSpan: 6, rowSpan: sexIdx === 0 ? 2 : 1, styles: { halign: 'center', valign: 'middle' } });
        body.push(row);
      });
    });

    // TOTAL Row
    const totalRow = ['', 'TOTAL', ''];
    activeSubjects.forEach(sub => {
      const sum = evaluatedStudents.reduce((acc, s) => acc + (s.scores[sub] || 0), 0);
      totalRow.push({ content: sum, colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } });
    });
    totalRow.push({ content: 'TOTAL', colSpan: 6, styles: { halign: 'center', fontStyle: 'bold' } });
    body.push(totalRow);

    // High/Low/Range/GPA/Avg/Rank Rows
    const statsRows = [
      { label: 'Highest Score', fn: (sub) => {
          let max = 0; evaluatedStudents.forEach(s => { if(s.scores[sub] > max) max = s.scores[sub]; });
          return max;
      }},
      { label: 'Lowest Score', fn: (sub) => {
          let min = 100; evaluatedStudents.forEach(s => { if(s.scores[sub] > 0 && s.scores[sub] < min) min = s.scores[sub]; });
          return min === 100 ? 0 : min;
      }},
      { label: 'Subject Range', fn: (sub) => {
          let max = 0, min = 100;
          evaluatedStudents.forEach(s => { 
            if(s.scores[sub] > max) max = s.scores[sub]; 
            if(s.scores[sub] > 0 && s.scores[sub] < min) min = s.scores[sub]; 
          });
          return max - (min === 100 ? 0 : min);
      }},
      { label: 'Subject GPA', fn: (sub) => {
          let sum = 0, count = 0;
          evaluatedStudents.forEach(s => { if(s.scores[sub] > 0) { sum += pointsForGrade(getGradeForStat(s.scores[sub]), activeCurriculum); count++; } });
          return count > 0 ? (sum/count).toFixed(3) : '0.000';
      }},
      { label: 'Subject Average', fn: (sub) => {
          let sum = 0, count = 0;
          evaluatedStudents.forEach(s => { if(s.scores[sub] > 0) { sum += s.scores[sub]; count++; } });
          return count > 0 ? Math.round(sum/count) : 0;
      }},
      { label: 'Subject Rank', fn: (sub) => '-' }
    ];

    // Compute ranks for subjects based on average
    const subAverages = activeSubjects.map(sub => {
      let sum = 0, count = 0;
      evaluatedStudents.forEach(s => { if(s.scores[sub] > 0) { sum += s.scores[sub]; count++; } });
      return { sub, avg: count > 0 ? sum/count : 0 };
    }).sort((a, b) => b.avg - a.avg);
    subAverages.forEach((item, idx) => item.rank = idx + 1);

    statsRows.forEach(stat => {
      const row = ['', { content: stat.label, styles: { textColor: [0,0,128], fontStyle: 'italic', textDecoration: 'underline' } }, ''];
      activeSubjects.forEach(sub => {
        if (stat.label === 'Subject Rank') {
          const rank = subAverages.find(x => x.sub === sub)?.rank || '-';
          row.push({ content: `${rank}/${activeSubjects.length}`, colSpan: 2, styles: { halign: 'center' } });
        } else if (stat.label === 'Subject Range' || stat.label === 'Subject GPA') {
          row.push({ content: stat.fn(sub), colSpan: 2, styles: { halign: 'center' } });
        } else {
          const val = stat.fn(sub);
          row.push({ content: val, styles: { halign: 'center' } });
          row.push({ content: getGradeForStat(val), styles: { halign: 'center', fontStyle: 'bold' } });
        }
      });
      row.push({ content: stat.label, colSpan: 6, styles: { halign: 'right' } });
      body.push(row);
    });

    autoTable(doc, {
      head: [headTop, headBottom],
      body,
      startY: 75,
      theme: 'grid',
      styles: { 
        fontSize: 8, 
        cellPadding: 3, 
        font: 'Poppins',
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 1
      },
      headStyles: { 
        fillColor: [255, 255, 224], // Pale yellow background
        textColor: [0, 0, 0], 
        fontStyle: 'bold' 
      },
      bodyStyles: {
        fillColor: [255, 255, 224]
      },
      margin: { left: margin, right: margin, bottom: 20 },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' }, // SN
        1: { cellWidth: 150 }, // Name
        2: { cellWidth: 25, halign: 'center' }, // Sex
      },
      willDrawCell: function(data) {
        // Prepare headers for manual rotation
        if (data.section === 'head') {
          if (data.row.index === 0 && data.column.index >= 3 && data.column.index < 3 + activeSubjects.length * 2) {
             // Subject name vertical
             data.cell.styles.minCellHeight = 80;
          }
          if (data.row.index === 1 && data.cell.raw && (data.cell.raw.content === 'Marks' || data.cell.raw.content === 'Grade')) {
             data.cell.styles.minCellHeight = 50;
          }
        }
      },
      didDrawCell: function(data) {
        // Manually draw vertical text for headers
        if (data.section === 'head') {
          let text = '';
          let isRotated = false;
          
          if (data.row.index === 0 && data.column.index >= 3 && data.column.index < 3 + activeSubjects.length * 2) {
            // It's a subject header
            // autoTable merges colSpan=2 into data.column.index (the first of the two)
            // But we actually passed an object { content: sub }
            if (data.cell.raw && data.cell.raw.content && activeSubjects.includes(data.cell.raw.content)) {
               text = data.cell.raw.content;
               isRotated = true;
            }
          } else if (data.row.index === 0 && data.column.index >= 3 + activeSubjects.length * 2) {
             if (data.cell.raw && typeof data.cell.raw.content === 'string' && ['AVERAGE', 'AGGT POINTS', 'DIVISION', 'Position'].includes(data.cell.raw.content)) {
                 text = data.cell.raw.content;
                 isRotated = true;
             }
          }
          
          if (data.row.index === 1 && data.cell.raw && (data.cell.raw.content === 'Marks' || data.cell.raw.content === 'Grade')) {
             text = data.cell.raw.content;
             isRotated = true;
          }

          if (isRotated && text) {
             // Blank out the default text rendering by filling over it (hacky but works since autoTable already drew it)
             doc.setFillColor(255, 255, 224);
             doc.rect(data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2, 'F');
             
             doc.setTextColor(0);
             doc.setFontSize(9);
             doc.setFont('Poppins', 'bold');
             
             // Rotate text 90 degrees CCW
             doc.text(text, data.cell.x + data.cell.width / 2 + 3, data.cell.y + data.cell.height - 5, { angle: 90 });
          }
        }
      }
    });

    doc.save(`Merit_List_Broadsheet_${selectedClass.replace(/\s+/g, '_')}.pdf`);
    notify(`Broadsheet PDF downloaded for ${evaluatedStudents.length} student(s)`, 'success');
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

    rows.push(['-', 'SUMMARY', 'CLASS MEAN', '-', '-', ...activeSubjects.map(sub => subjectAnalysis[sub]?.mean || 0), '-', classStats.meanScore, classStats.overallGrade, '-']);

    downloadExcel(`NEMIS_Merit_List_${selectedClass.replace(/\s+/g, '_')}.xlsx`, [{ name: 'Merit List', aoa: rows }]);
    notify('Exported NEMIS-compatible Excel sheet', 'success');
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, marginBottom: 20 }}>
      
      {/* ── EXECUTIVE APPROVAL & PUBLICATION BANNER ── */}
      <div 
        style={{ 
          background: isPublished ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${isPublished ? '#bbf7d0' : '#fde68a'}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isPublished ? (
            <ShieldCheck size={22} color="#166534" />
          ) : (
            <AlertTriangle size={22} color="#b45309" />
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: isPublished ? '#166534' : '#b45309', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{isPublished ? 'OFFICIALLY APPROVED & PUBLISHED' : 'DRAFT RESULTS — PENDING EXECUTIVE APPROVAL'}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isPublished ? '#166534' : '#b45309', color: '#ffffff', textTransform: 'uppercase' }}>
                {isPublished ? 'Verified' : 'Unpublished'}
              </span>
              {isPublished && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> {principalSig ? 'Principal Signature Certified & Stamped' : 'Official DoS Stamp Active'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: isPublished ? '#15803d' : '#92400e', marginTop: 2 }}>
              {isPublished ? (
                <>Approved &amp; Published by <strong>{publishedInfo?.approverRole || 'Director of Studies (DoS)'}</strong>. Official report cards with principal signature stamp can now be issued.</>
              ) : (
                <>Requires sign-off from <strong>Director of Studies (DoS)</strong>, <strong>Deputy Academic</strong>, or <strong>Principal</strong> before publishing.</>
              )}
            </div>
          </div>
        </div>

        {/* Executive Action Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onNavigateGradebook && (
            <button 
              onClick={onNavigateGradebook}
              style={{ height: 34, padding: '0 12px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Open Gradebook Central for full mark entry, report form preview & subject analysis"
            >
              <BookOpen size={14} color="#047857" /> Gradebook Central <ChevronRight size={13} />
            </button>
          )}

          {isExecutive ? (
            <>
              {Object.keys(editedScores).length > 0 && (
                <button 
                  onClick={handleSaveAllScores}
                  style={{ height: 34, padding: '0 12px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={14} /> Save Score Changes
                </button>
              )}

              <button 
                onClick={() => setIsEditing(prev => !prev)}
                style={{ height: 34, padding: '0 12px', background: isEditing ? '#f1f5f9' : '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit3 size={14} color="#047857" /> {isEditing ? 'Done Editing' : 'Direct Score Editing'}
              </button>

              <button 
                onClick={handleTogglePublication}
                style={{ 
                  height: 34, 
                  padding: '0 14px', 
                  background: isPublished ? '#dc2626' : '#047857', 
                  color: '#ffffff', 
                  border: 'none', 
                  borderRadius: 6, 
                  fontSize: 12, 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  boxShadow: isPublished ? 'none' : '0 1px 3px rgba(4, 120, 87, 0.4)'
                }}
              >
                {isPublished ? <Unlock size={14} /> : <Lock size={14} />}
                {isPublished ? 'Unpublish / Revoke' : 'Approve & Publish (DoS)'}
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', background: '#ffffff', padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e1' }}>
              Read-Only Access Mode
            </span>
          )}
        </div>
      </div>

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

      {/* ── MERIT LIST SCOPE SWITCH (OVERALL VS STREAM MERIT LIST) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => {
              setViewScope('overall');
              setSelectedClass('All');
            }}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: viewScope === 'overall' ? '#047857' : 'transparent',
              color: viewScope === 'overall' ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={14} /> Overall Class Merit List
          </button>
          <button
            onClick={() => {
              setViewScope('stream');
              if (selectedClass === 'All') {
                const firstStream = classOptions.find(c => c !== 'All') || 'All';
                setSelectedClass(firstStream);
              }
            }}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: viewScope === 'stream' ? '#047857' : 'transparent',
              color: viewScope === 'stream' ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={14} /> Stream Merit List
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={13} color="#047857" />
          <span>
            {viewScope === 'overall' 
              ? `Overall Class Cohort Ranking (${evaluatedStudents.length} Students)` 
              : `Stream Ranking for ${selectedClass === 'All' ? 'All' : selectedClass} (${evaluatedStudents.length} Students)`}
          </span>
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
          Access Level: <strong style={{ color: isExecutive ? '#047857' : '#2563eb' }}>{isExecutive ? 'Read & Write (Executive)' : 'Read-Only'}</strong>
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
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 16 }}>
        <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#f1f5f9' }}>
              <th onClick={() => handleSort('rank')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {viewScope === 'stream' ? 'Str / Ovr Rank' : 'Ovr / Str Rank'} {sortField === 'rank' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th onClick={() => handleSort('adm')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Adm No {sortField === 'adm' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th onClick={() => handleSort('name')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', minWidth: 160, borderBottom: '2px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Student Name {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                Stream
              </th>

              {/* Dynamic Subject Columns */}
              {activeSubjects.map(sub => (
                <th 
                  key={sub} 
                  onClick={() => handleSort(sub)} 
                  style={{ 
                    padding: '10px 8px', 
                    fontSize: 10, 
                    textTransform: 'uppercase', 
                    textAlign: 'center', 
                    cursor: 'pointer', 
                    userSelect: 'none', 
                    whiteSpace: 'nowrap',
                    background: sortField === sub ? '#e2e8f0' : '#f1f5f9',
                    borderBottom: '2px solid #cbd5e1',
                    minWidth: 50
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <span title={sub}>{sub.substring(0, 3)}</span>
                    {sortField === sub && (sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </div>
                </th>
              ))}

              <th onClick={() => handleSort('total')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  Total {sortField === 'total' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th onClick={() => handleSort('avg')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  Mean % {sortField === 'avg' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
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
                rowStyle.background = '#fffbeb';
                rankBadge = (
                  <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Trophy size={11} color="#b45309" /> #1 Top
                  </span>
                );
              } else if (s.rank === 2) {
                rowStyle.background = '#f8fafc';
                rankBadge = (
                  <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Medal size={11} /> #2
                  </span>
                );
              } else if (s.rank === 3) {
                rowStyle.background = '#fff7ed';
                rankBadge = (
                  <span style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Medal size={11} /> #3
                  </span>
                );
              } else {
                rankBadge = <strong style={{ color: '#64748b' }}>#{s.rank}</strong>;
              }

              return (
                <tr key={s.id || s.adm} style={rowStyle}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {rankBadge} 
                    <span style={{ color: '#64748b', fontSize: 10, marginLeft: 6, fontWeight: 600 }}>
                      {viewScope === 'stream' ? `(Ovr #${s.overallRank})` : `(${s.class} #${s.streamRank})`}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{s.adm}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{s.class}</td>

                  {/* Subject Scores Cells (Editable for Executive) */}
                  {activeSubjects.map(sub => {
                    const score = s.scores[sub];
                    const isTopInSub = score > 0 && score === subjectAnalysis[sub]?.topScore;
                    const overrideKey = `${s.id}_${sub}`;
                    const isOverridden = editedScores[overrideKey] !== undefined;

                    return (
                      <td 
                        key={sub} 
                        style={{ 
                          padding: isEditing && isExecutive ? '4px' : '10px 8px', 
                          textAlign: 'center', 
                          fontWeight: isTopInSub ? 800 : 600,
                          fontSize: 12,
                          background: isOverridden ? '#eff6ff' : isTopInSub ? '#dcfce7' : 'transparent',
                          color: isTopInSub ? '#15803d' : score >= passThreshold ? '#0f172a' : '#d13438'
                        }}
                      >
                        {isEditing && isExecutive ? (
                          <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={score || ''} 
                            onChange={e => handleScoreChange(s.id, sub, e.target.value)}
                            style={{ 
                              width: 48, 
                              height: 28, 
                              textAlign: 'center', 
                              borderRadius: 4, 
                              border: isOverridden ? '2px solid #2563eb' : '1px solid #cbd5e1',
                              fontSize: 12,
                              fontWeight: 700,
                              background: '#ffffff'
                            }}
                          />
                        ) : (
                          score || '-'
                        )}
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
                        {s.meanGrade} ({s.points} pts)
                      </Badge>
                    ) : (
                      <Badge color={s.meanGrade?.startsWith('EE') || s.meanGrade?.startsWith('ME') ? 'green' : s.meanGrade?.startsWith('AE') ? 'amber' : 'red'}>
                        {s.meanGrade} ({s.points} pts)
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
            </tfoot>
          )}
        </table>
      </div>

      {displayedStudents.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 13 }}>
          No student records found matching the active filters or class selection.
        </div>
      )}
    </div>
  );
}
