import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

import Clinic from '../src/views/Clinic';
import PortalLayout from '../src/views/layouts/PortalLayout';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { ROLES } from '../src/data/users';

let mockProfile = { id: 'u1', name: 'Test User', role: 'principal' };

vi.mock('../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        cb('SIGNED_IN', { user: { id: 'u1', user_metadata: {} } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
  signOutAll: vi.fn(),
}));

vi.mock('../src/lib/api', () => ({
  fetchTable: vi.fn().mockResolvedValue([
    { id: 'v1', student: 'Jane Student', adm: 'ADM-1', date: '2026-09-08', outcome: 'Returned to class' },
    null
  ]),
  upsertRow: vi.fn().mockResolvedValue({}),
  fetchProfiles: vi.fn(() => Promise.resolve([mockProfile])),
  setActiveSchoolId: vi.fn(),
  syncOfflineMutations: vi.fn().mockResolvedValue(),
  fetchConfig: vi.fn().mockResolvedValue({ settings: { name: 'EduOne High' } }),
  fetchAllStudentsUnpaginated: vi.fn().mockResolvedValue([]),
  fetchTeachers: vi.fn().mockResolvedValue([]),
}));

const mockStore = {
  notify: vi.fn(),
  students: [
    { id: '1', name: 'John Doe', adm: '1001', class: 'Form 1A', medicalInfo: 'Asthma' },
    null
  ],
  settings: { name: 'Utawala Senior School' },
  removeToast: vi.fn(),
};

describe('Portal & Clinic rendering with edge cases', () => {
  it('renders Clinic view without crashing even with null items in students and visits', () => {
    const { container } = render(
      <MemoryRouter>
        <Clinic store={mockStore} user={{ id: 'n1', name: null, role: 'clinic' }} params={{}} />
      </MemoryRouter>
    );
    expect(container).toBeTruthy();
  });

  it('renders Clinic with empty store defensively without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Clinic store={{}} user={{}} params={{}} />
      </MemoryRouter>
    );
    expect(container).toBeTruthy();
  });

  it('renders ErrorBoundary and exposes technical error details and reset buttons', () => {
    const CrashingComponent = () => {
      throw new Error('Test portal crash');
    };

    render(
      <ErrorBoundary>
        <CrashingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something broke/i)).toBeTruthy();
    expect(screen.getByText(/The page couldn't render/i)).toBeTruthy();
    expect(screen.getByText(/Sign Out & Reset Session/i)).toBeTruthy();
    expect(screen.getByText(/Technical error details/i)).toBeTruthy();
  });

  const allRoleKeys = Object.keys(ROLES);
  allRoleKeys.forEach((roleKey) => {
    it(`renders PortalLayout cleanly for role: ${roleKey} even with null name`, async () => {
      cleanup();
      mockProfile = { id: `u_${roleKey}`, name: null, role: roleKey, username: `user_${roleKey}` };
      const home = ROLES[roleKey]?.home || 'overview';
      const { container } = render(
        <MemoryRouter initialEntries={[`/portal/${home}`]}>
          <PortalLayout />
        </MemoryRouter>
      );
      expect(container).toBeTruthy();
    });
  });
});
