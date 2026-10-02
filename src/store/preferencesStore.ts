import { create } from "zustand";
import type { UserPreferences } from "@/types";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";

/**
 * Theme is owned by `useUiStore`, not here: it is applied by a pre-paint script
 * in index.html, so keeping a second copy would let the two drift.
 */
const DEFAULTS: UserPreferences = {
  language: "en",
  density: "comfortable",
  reduceMotion: false,
  showConfidence: true,
  showExplanations: true,
  showSentenceScores: false,
  notifications: {
    productUpdates: true,
    usageAlerts: true,
    weeklySummary: false,
  },
  privacy: {
    storeDocuments: true,
    improveModels: false,
  },
};

interface PreferencesState extends UserPreferences {
  update: (patch: Partial<UserPreferences>) => void;
  updateNotifications: (patch: Partial<UserPreferences["notifications"]>) => void;
  updatePrivacy: (patch: Partial<UserPreferences["privacy"]>) => void;
  reset: () => void;
}

function snapshot(state: PreferencesState): UserPreferences {
  return {
    language: state.language,
    density: state.density,
    reduceMotion: state.reduceMotion,
    showConfidence: state.showConfidence,
    showExplanations: state.showExplanations,
    showSentenceScores: state.showSentenceScores,
    notifications: { ...state.notifications },
    privacy: { ...state.privacy },
  };
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...readJson<UserPreferences>(STORAGE_KEYS.preferences, DEFAULTS),

  update: (patch) => {
    set(patch);
    writeJson(STORAGE_KEYS.preferences, snapshot(get()));
  },

  updateNotifications: (patch) => {
    set({ notifications: { ...get().notifications, ...patch } });
    writeJson(STORAGE_KEYS.preferences, snapshot(get()));
  },

  updatePrivacy: (patch) => {
    set({ privacy: { ...get().privacy, ...patch } });
    writeJson(STORAGE_KEYS.preferences, snapshot(get()));
  },

  reset: () => {
    set({ ...DEFAULTS });
    writeJson(STORAGE_KEYS.preferences, snapshot(get()));
  },
}));
