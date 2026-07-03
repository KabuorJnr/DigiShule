import { create } from 'zustand';

const useUIStore = create((set) => ({
  // Global App State
  toasts: [],
  notifications: [],
  notifOpen: false,
  collapsed: false,
  
  // Modals & Overlays
  showLogin: false,
  showSignup: false,
  showParentSignup: false,
  showApplication: false,
  changePasswordOpen: false,

  // Domain & Auth
  currentUser: null,
  activeRoleOverride: null,
  availableProfiles: [],
  settings: {},
  schoolId: localStorage.getItem('eduone_school_id') || null,

  // Actions
  notify: (msg, type = 'success') => set((state) => {
    const id = Date.now();
    return {
      toasts: [...state.toasts, { id, msg, type }]
    };
  }),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  setCurrentUser: (user) => set({ currentUser: user }),
  setActiveRoleOverride: (role) => set({ activeRoleOverride: role }),
  setAvailableProfiles: (profiles) => set({ availableProfiles: profiles }),
  setSettings: (settings) => set({ settings }),
  setSchoolId: (id) => {
    if (id) {
      localStorage.setItem('eduone_school_id', id);
    } else {
      localStorage.removeItem('eduone_school_id');
    }
    set({ schoolId: id });
  },

  setCollapsed: (collapsed) => set({ collapsed }),
  setNotifOpen: (open) => set({ notifOpen: open }),
  setNotifications: (notifications) => set({ notifications }),
  
  setShowLogin: (show) => set({ showLogin: show }),
  setShowSignup: (show) => set({ showSignup: show }),
  setShowParentSignup: (show) => set({ showParentSignup: show }),
  setShowApplication: (show) => set({ showApplication: show }),
  setChangePasswordOpen: (open) => set({ changePasswordOpen: open }),

  // For migrating existing legacy store props:
  // Components expect `store` to have everything, so we'll 
  // expose a way to inject legacy data temporarily.
  legacyData: {},
  setLegacyData: (data) => set((state) => ({ 
    legacyData: { ...state.legacyData, ...data } 
  })),
}));

export default useUIStore;
