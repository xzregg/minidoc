import { create } from 'zustand';

interface DialogState {
  searchOpen: boolean;
  settingsOpen: boolean;
  exportOpen: boolean;
  welcomeOpen: boolean;

  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;

  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;

  openExport: () => void;
  closeExport: () => void;
  toggleExport: () => void;

  openWelcome: () => void;
  closeWelcome: () => void;
  initWelcome: () => void;

  closeAllDialogs: () => void;
}

// 检查是否首次启动
const checkFirstTime = () => {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem('hasSeenWelcome');
};

export const useUIStore = create<DialogState>((set) => ({
  searchOpen: false,
  settingsOpen: false,
  exportOpen: false,
  welcomeOpen: checkFirstTime(),

  openSearch: () => set({ searchOpen: true, settingsOpen: false, exportOpen: false, welcomeOpen: false }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () => set((state) => ({
    searchOpen: !state.searchOpen,
    settingsOpen: false,
    exportOpen: false,
    welcomeOpen: false
  })),

  openSettings: () => set({ settingsOpen: true, searchOpen: false, exportOpen: false, welcomeOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((state) => ({
    settingsOpen: !state.settingsOpen,
    searchOpen: false,
    exportOpen: false,
    welcomeOpen: false
  })),

  openExport: () => set({ exportOpen: true, searchOpen: false, settingsOpen: false, welcomeOpen: false }),
  closeExport: () => set({ exportOpen: false }),
  toggleExport: () => set((state) => ({
    exportOpen: !state.exportOpen,
    searchOpen: false,
    settingsOpen: false,
    welcomeOpen: false
  })),

  openWelcome: () => set({ welcomeOpen: true }),
  closeWelcome: () => set({ welcomeOpen: false }),
  initWelcome: () => {
    if (checkFirstTime()) {
      set({ welcomeOpen: true });
    }
  },

  closeAllDialogs: () => set({ searchOpen: false, settingsOpen: false, exportOpen: false, welcomeOpen: false }),
}));
