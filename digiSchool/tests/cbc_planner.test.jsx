import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import SchemeOfWork from '../src/views/SchemeOfWork';
import LessonPlans from '../src/views/LessonPlans';

// Mock API and exporters
vi.mock('../src/lib/api', () => ({
  fetchTable: vi.fn().mockResolvedValue([]),
  upsertRow: vi.fn().mockImplementation((table, payload) => Promise.resolve([{ ...payload, id: payload.id || 'new_id' }]))
}));

vi.mock('../src/utils/exporters', () => ({
  exportSchemeOfWorkPDF: vi.fn(),
  exportLessonPlanPDF: vi.fn()
}));

const mockStore = {
  notify: vi.fn(),
  settings: { classes: ['Form 1'] }
};

describe('CBC Scheme of Work & Lesson Plan Builder', () => {
  it('renders SchemeOfWork empty state and allows adding rows', async () => {
    const { container } = render(<SchemeOfWork store={mockStore} user={{ id: '123', name: 'Test' }} />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Scheme of Work Builder')).toBeTruthy();
    });
    
    // Since mock fetchTable returns [], it should prefill 14 weeks
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(14);
  });

  it('renders LessonPlans in list view, then can switch to edit', async () => {
    render(<LessonPlans store={mockStore} user={{ id: '123', name: 'Test' }} />);
    
    await waitFor(() => {
      expect(screen.getByText('Lesson Plans')).toBeTruthy();
    });
    
    // Click New Lesson Plan
    const newBtn = screen.getByText(/New Lesson Plan/i);
    fireEvent.click(newBtn);
    
    // Should now show edit view
    expect(screen.getByText('Administrative Details')).toBeTruthy();
  });

  it('debounces autosave in SchemeOfWork', async () => {
    const { container } = render(<SchemeOfWork store={mockStore} user={{ id: '123', name: 'Test' }} />);
    
    await waitFor(() => {
      expect(container.querySelectorAll('input[type="number"]').length).toBe(14);
    });

    const strandTextarea = container.querySelectorAll('textarea')[0];
    
    // Type rapidly
    fireEvent.change(strandTextarea, { target: { value: 'A' } });
    fireEvent.change(strandTextarea, { target: { value: 'AB' } });
    fireEvent.change(strandTextarea, { target: { value: 'ABC' } });

    expect(screen.getAllByText('Saving...').length).toBeGreaterThan(0);
    
    const api = await import('../src/lib/api');
    
    await waitFor(() => {
      expect(api.upsertRow).toHaveBeenCalledWith('schemes_of_work', expect.objectContaining({
        strand: 'ABC'
      }));
    }, { timeout: 2000 });
  });
});
