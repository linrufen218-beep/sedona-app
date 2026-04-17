
export type WantType = 'approval' | 'control' | 'security';

export interface ReleaseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'daily' | 'area' | 'focused' | 'custom';
  content: string;
  analysis?: {
    // New simplified keys
    list?: {
      s: string;
      w: string[];
      a?: string;
    }[];
    ana?: string;
    sum?: string;
    // Old keys (backward compatibility)
    sentences?: {
      text: string;
      wants: WantType[];
    }[];
    deepAnalysis?: string;
    supplement?: string;
  };
  feelings?: string;
  timestamp: number;
}

export interface StuckSentence {
  id: string;
  text: string;
  wants: string[];
  analysis?: string;
  source: string;
  timestamp: number;
}

export interface HarvestRecord {
  id: string;
  date: string;
  content: string;
  category?: string;
  timestamp: number;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  selectedModel: 'pro' | 'mini' | 'deepseek' | 'lite';
}

export const STORAGE_KEYS = {
  HISTORY: 'sedona_history',
  SETTINGS: 'sedona_settings',
  HARVESTS: 'sedona_harvests',
  STUCK: 'sedona_stuck',
  DAILY_STATE: 'sedona_daily_state',
  AREA_STATE: 'sedona_area_state',
  FOCUSED_STATE: 'sedona_focused_state',
  CUSTOM_STATE: 'sedona_custom_state',
};

export function getComponentState(key: string): any {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export function saveComponentState(key: string, state: any) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function getHistory(): ReleaseRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
  return data ? JSON.parse(data) : [];
}

export function saveRecord(record: ReleaseRecord) {
  const history = getHistory();
  history.unshift(record);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export function getHarvests(): HarvestRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.HARVESTS);
  return data ? JSON.parse(data) : [];
}

export function saveHarvest(harvest: HarvestRecord) {
  const harvests = getHarvests();
  harvests.unshift(harvest);
  localStorage.setItem(STORAGE_KEYS.HARVESTS, JSON.stringify(harvests));
}

export function getSettings(): AppSettings {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return data ? JSON.parse(data) : { 
    theme: 'light',
    selectedModel: 'mini'
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function getStuckSentences(): StuckSentence[] {
  const data = localStorage.getItem(STORAGE_KEYS.STUCK);
  return data ? JSON.parse(data) : [];
}

export function saveStuckSentences(sentences: StuckSentence[]) {
  localStorage.setItem(STORAGE_KEYS.STUCK, JSON.stringify(sentences));
}

export function addStuckSentence(sentence: Omit<StuckSentence, 'id' | 'timestamp'>) {
  const stuck = getStuckSentences();
  stuck.unshift({
    ...sentence,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  });
  saveStuckSentences(stuck);
}

export function removeStuckSentence(id: string) {
  const stuck = getStuckSentences();
  const filtered = stuck.filter(s => s.id !== id);
  saveStuckSentences(filtered);
}
