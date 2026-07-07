import { describe, it, expect, vi } from 'vitest';
import { exportSchemeOfWorkPDF, exportLessonPlanPDF } from '../src/utils/exporters';

// jsPDF might try to access DOM or throw, but typically it runs.
// We just want to ensure our own string interpolation and logic don't throw with empty fields.
// We will mock jsPDF to avoid actual file generation/saving.
vi.mock('jspdf', () => {
  return {
    default: class {
      save = vi.fn();
      text = vi.fn();
      rect = vi.fn();
      setDrawColor = vi.fn();
      setFillColor = vi.fn();
      setTextColor = vi.fn();
      setFontSize = vi.fn();
      setFont = vi.fn();
      line = vi.fn();
      addPage = vi.fn();
      splitTextToSize = vi.fn((text) => [text]);
      internal = {
        getNumberOfPages: vi.fn().mockReturnValue(1),
        pageSize: { getWidth: vi.fn().mockReturnValue(500), getHeight: vi.fn().mockReturnValue(800) }
      };
      setPage = vi.fn();
      lastAutoTable = { finalY: 100 };
    }
  };
});

vi.mock('jspdf-autotable', () => {
  return {
    default: vi.fn() // mock autoTable
  };
});

describe('PDF Exporters', () => {
  it('exportSchemeOfWorkPDF does not throw on completely empty fields', () => {
    expect(() => {
      exportSchemeOfWorkPDF({
        school: {},
        scheme: {}, // completely empty scheme
        rows: [{}]  // row with no fields
      });
    }).not.toThrow();
  });

  it('exportLessonPlanPDF does not throw on completely empty fields', () => {
    expect(() => {
      exportLessonPlanPDF({
        school: {},
        plan: {} // completely empty plan
      });
    }).not.toThrow();
  });

  it('exportLessonPlanPDF does not throw when arrays are missing', () => {
    expect(() => {
      exportLessonPlanPDF({
        school: { name: 'Test School' },
        plan: {
          teacher_name: 'Mr Test',
          core_competencies: undefined,
          values_developed: null
        }
      });
    }).not.toThrow();
  });
});
