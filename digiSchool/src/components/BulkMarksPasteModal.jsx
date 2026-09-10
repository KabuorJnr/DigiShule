import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Check, Clipboard, AlertCircle, FileSpreadsheet, Sparkles, CheckCircle2 } from 'lucide-react';
import { gradeFor, pointsForGrade, is844Class } from '../utils/grading';

export default function BulkMarksPasteModal({
  isOpen,
  onClose,
  students = [],
  subject = '',
  className = '',
  assessmentField = 'a1',
  assessmentLabel = 'Assessment 1',
  outOf = 100,
  gradeBoundaries = [],
  onApplyMarks
}) {
  const [rawText, setRawText] = useState('');
  const [inputScale, setInputScale] = useState('raw'); // 'raw' (out of max) | 'pct' (already 0-100%)

  const max = Math.max(1, Number(outOf) || 100);

  // Parse pasted lines: handles newlines, tabs, commas
  const parsedLines = useMemo(() => {
    if (!rawText.trim()) return [];
    const lines = rawText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return lines.map(line => {
      // If line contains multiple columns (e.g. copied multiple columns from Excel), take the last numeric column or first column
      const tokens = line.split(/[\t,;]+/).map(t => t.trim()).filter(Boolean);
      // Look for a token that looks like a mark or 'X'
      let markToken = tokens[tokens.length - 1] || line;
      // If the last token is not a mark, look for any token that is a number or X
      for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i].toUpperCase();
        if (t === 'X' || !isNaN(parseFloat(t))) {
          markToken = tokens[i];
          break;
        }
      }

      const clean = markToken.replace('%', '').trim().toUpperCase();
      if (clean === 'X' || clean === 'ABS' || clean === 'ABSENT') {
        return { raw: markToken, val: 'X', isAbsent: true, valid: true };
      }

      const num = parseFloat(clean);
      if (!isNaN(num) && num >= 0) {
        let pct = num;
        if (inputScale === 'raw') {
          pct = Math.round((num / max) * 100);
        } else {
          pct = Math.round(num);
        }
        pct = Math.max(0, Math.min(100, pct));
        return { raw: markToken, val: pct, isAbsent: false, valid: true };
      }

      return { raw: markToken, val: null, isAbsent: false, valid: false };
    });
  }, [rawText, inputScale, max]);

  // Preview matches between students and parsed marks
  const previewRows = useMemo(() => {
    return students.map((s, index) => {
      const parsed = parsedLines[index];
      const systemType = is844Class(s.class) ? '844' : 'CBC';
      if (!parsed || !parsed.valid) {
        return {
          student: s,
          hasMark: false,
          mark: null,
          raw: parsed ? parsed.raw : '—',
          grade: '—',
          points: '—',
          isAbsent: false
        };
      }
      if (parsed.isAbsent) {
        return {
          student: s,
          hasMark: true,
          mark: 'X',
          raw: parsed.raw,
          grade: 'X',
          points: 0,
          isAbsent: true
        };
      }
      const grade = gradeFor(parsed.val, gradeBoundaries, systemType);
      const points = pointsForGrade(grade, systemType);
      return {
        student: s,
        hasMark: true,
        mark: parsed.val,
        raw: parsed.raw,
        grade,
        points,
        isAbsent: false
      };
    });
  }, [students, parsedLines, gradeBoundaries]);

  const validCount = previewRows.filter(r => r.hasMark).length;

  const handleApply = () => {
    if (validCount === 0) return;
    const marksMap = {};
    previewRows.forEach(r => {
      if (r.hasMark) {
        marksMap[r.student.id] = r.mark;
      }
    });
    onApplyMarks(marksMap);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={`Bulk Paste Marks — ${subject} (${className || 'Class'})`}
      onClose={onClose}
      wide
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {validCount > 0 ? (
              <span style={{ color: '#047857', fontWeight: 600 }}>
                ✓ Ready to apply {validCount} mark{validCount === 1 ? '' : 's'} to {students.length} students
              </span>
            ) : (
              <span>Paste scores in the box above to preview</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={validCount === 0}
              onClick={handleApply}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: validCount > 0 ? '#047857' : undefined,
                color: '#ffffff',
                fontWeight: 700
              }}
            >
              <CheckCircle2 size={16} />
              Apply {validCount} Marks to Class List
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: "'Poppins', sans-serif" }}>
        {/* Info Banner */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          padding: '12px 14px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start'
        }}>
          <FileSpreadsheet size={22} color="#047857" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
            <strong>How it works:</strong> Copy a single column of marks from Excel, Google Sheets, or a document and paste it below.
            Marks will be applied down the class list in exact student order. Enter <strong>X</strong> for absent learners.
          </div>
        </div>

        {/* Configuration Row */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Target Exam Slot:</span>{' '}
            <span style={{ fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6 }}>
              {assessmentLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Score Type:</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontWeight: inputScale === 'raw' ? 700 : 400 }}>
              <input
                type="radio"
                name="inputScale"
                checked={inputScale === 'raw'}
                onChange={() => setInputScale('raw')}
              />
              Raw score (out of {max})
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontWeight: inputScale === 'pct' ? 700 : 400 }}>
              <input
                type="radio"
                name="inputScale"
                checked={inputScale === 'pct'}
                onChange={() => setInputScale('pct')}
              />
              Percentage (0 - 100%)
            </label>
          </div>
        </div>

        {/* Textarea Input */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Paste Marks Column Here:
          </label>
          <textarea
            className="input"
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`78\n85\n62\nX\n55\n...`}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.4,
              padding: '10px 12px',
              borderRadius: 8,
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5, color: '#64748b' }}>
            <span>Lines detected: {parsedLines.length}</span>
            <span>Total class students: {students.length}</span>
          </div>
        </div>

        {/* Live Mapping Preview */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Live Preview Mapping ({validCount} of {students.length} matched)
          </div>
          <div style={{
            maxHeight: 240,
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: 8
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 11 }}>
                  <th style={{ padding: '6px 10px', width: 40, textAlign: 'center' }}>#</th>
                  <th style={{ padding: '6px 10px' }}>Student Name</th>
                  <th style={{ padding: '6px 10px', width: 100 }}>Adm No.</th>
                  <th style={{ padding: '6px 10px', width: 90, textAlign: 'center' }}>Pasted</th>
                  <th style={{ padding: '6px 10px', width: 100, textAlign: 'center' }}>Applied %</th>
                  <th style={{ padding: '6px 10px', width: 90, textAlign: 'center' }}>Grade / Pts</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr
                    key={r.student.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: r.hasMark ? (r.isAbsent ? '#fff5f5' : '#f0fdf4') : (i % 2 === 0 ? '#ffffff' : '#fafafa')
                    }}
                  >
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0f172a' }}>{r.student.name}</td>
                    <td style={{ padding: '6px 10px', color: '#64748b' }}>{r.student.adm || '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#334155' }}>
                      {r.hasMark ? r.raw : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>
                      {r.hasMark ? (
                        r.isAbsent ? (
                          <span style={{ color: '#dc2626', fontWeight: 800 }}>X (Abs)</span>
                        ) : (
                          <span style={{ color: '#047857' }}>{r.mark}%</span>
                        )
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unchanged</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      {r.hasMark && !r.isAbsent ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#e0f2fe',
                          color: '#0369a1'
                        }}>
                          {r.grade} ({r.points} pts)
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
