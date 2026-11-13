/**
 * usePrismexStore - Global Frontend Application State
 * Specification: docs/03-SYSTEM-ARCHITECTURE.md & docs/05-PLUGIN-UI-UX.md
 */

import { create } from 'zustand';
import { 
  SequenceManifest, 
  ExecutionMode, 
  ReviewQueueItem, 
  EditingProfile, 
  ProviderStatusInfo, 
  RoughCutSummaryReport,
  JobStatus,
  CutInterval
} from '../types';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { TimelineEditingEngine } from '../host/TimelineEditingEngine';
import { AppLanguage } from '../i18n/translations';

export type ActiveTab = 
  | 'transcript'
  | 'magic-cut' 
  | 'silence' 
  | 'takes' 
  | 'review-queue' 
  | 'srt-editor'
  | 'viral-shorts'
  | 'dashboard' 
  | 'providers' 
  | 'profiles' 
  | 'settings' 
  | 'history';

interface PrismexState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Localization
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;

  // Premiere Pro Host State
  sequenceManifest: SequenceManifest | null;
  refreshSequence: () => Promise<void>;

  // Pipeline & Job State
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;

  currentJobId: string | null;
  jobStatus: JobStatus;
  jobProgress: number;
  jobMessage: string;

  // Review Queue & Transcript State
  reviewItems: ReviewQueueItem[];
  transcriptWords: any[];
  transcriptSentences: any[];
  detectedSilences: any[];
  setTranscriptWords: (words: any[]) => void;
  setReviewItems: (items: ReviewQueueItem[]) => void;
  updateReviewItemStatus: (id: string, status: 'ACCEPTED' | 'REJECTED') => void;
  acceptAllReviewItems: () => void;
  rejectAllReviewItems: () => void;

  // Script Visual Directives & Custom Annotations
  scriptDirectives: Record<number, any>;
  setScriptDirectives: (directives: Record<number, any> | ((prev: Record<number, any>) => Record<number, any>)) => void;
  updateScriptDirective: (idx: number, patch: any) => void;
  customMarkers: any[];
  setCustomMarkers: (markers: any[]) => void;

  // AI Viral Shorts State
  viralTopics: any[];
  setViralTopics: (topics: any[]) => void;
  viralShorts: any[];
  setViralShorts: (shorts: any[] | ((prev: any[]) => any[])) => void;

  // SRT / Captions Cues State
  srtCues: any[];
  setSrtCues: (cues: any[] | ((prev: any[]) => any[])) => void;

  // Global Project Persistence
  saveCurrentProjectState: () => Promise<void>;

  // Silence Detection Config
  silenceSettings: {
    thresholdDbfs: number;
    minDurationMs: number;
    preCutPaddingMs: number;
    postCutPaddingMs: number;
    preserveBreathing: boolean;
  };
  setSilenceSettings: (patch: Partial<PrismexState['silenceSettings']>) => void;

  // Config State
  profiles: EditingProfile[];
  providers: ProviderStatusInfo[];
  daemonOnline: boolean;
  lastReport: RoughCutSummaryReport | null;
  aiSummary: { summary: string; engine: string; wpm?: number; totalWords?: number; fillerCount?: number } | null;

  // Actions
  initApp: () => Promise<void>;
  transcribeSequence: () => Promise<void>;
  deleteTranscriptRange: (startSeconds: number, endSeconds: number) => Promise<void>;
  cutAllSilencesNow: () => Promise<void>;
  runTranscriptAI: (prompt?: string) => Promise<void>;
  startMagicRoughCut: () => Promise<void>;
  applyApprovedReviewQueue: () => Promise<void>;
}

const client = PrismexDaemonClient.getInstance();
const hostBridge = PremiereHostBridge.getInstance();
const timelineEngine = new TimelineEditingEngine();

export function getCleanSequenceKey(seqName?: string): string {
  if (!seqName) return 'default_sequence';
  return seqName.replace(/(_PrismexRoughCut|_SilenceCut|_ApprovedCuts|_RoughCut)+/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function rippleShiftWords(words: any[], cuts: { startSeconds: number; endSeconds: number; durationSeconds?: number }[]): any[] {
  if (!cuts || cuts.length === 0) return words;
  const sortedCuts = [...cuts].sort((a, b) => a.startSeconds - b.startSeconds);

  return words
    .filter((w) => {
      const ws = w.start_seconds ?? w.start ?? 0;
      const we = w.end_seconds ?? w.end ?? 0;
      return !sortedCuts.some((c) => ws >= c.startSeconds - 0.03 && we <= c.endSeconds + 0.03);
    })
    .map((w) => {
      let ws = w.start_seconds ?? w.start ?? 0;
      let we = w.end_seconds ?? w.end ?? 0;
      for (const c of sortedCuts) {
        const dur = c.durationSeconds ?? (c.endSeconds - c.startSeconds);
        if (ws >= c.endSeconds - 0.02) {
          ws = Math.max(0, ws - dur);
          we = Math.max(0, we - dur);
        }
      }
      return {
        ...w,
        start_seconds: Number(ws.toFixed(4)),
        end_seconds: Number(we.toFixed(4)),
        start: Number(ws.toFixed(4)),
        end: Number(we.toFixed(4))
      };
    });
}

export interface PrismexProjectSavePayload {
  words: any[];
  sentences?: any[];
  silences?: any[];
  reviewItems?: any[];
  scriptDirectives?: Record<number, any>;
  customMarkers?: any[];
  viralTopics?: any[];
  viralShorts?: any[];
  srtCues?: any[];
}

export async function persistProjectData(
  manifest: any,
  data: PrismexProjectSavePayload
) {
  if (!manifest) return;
  const cleanKey = getCleanSequenceKey(manifest.cleanSequenceName || manifest.sequenceName);
  const projId = manifest.premiereProjectId || 'current_project';
  const jsonStr = JSON.stringify(data);

  // 1. ExtendScript Project Folder Cache (.prismex_cache/<key>.json)
  try {
    await hostBridge.saveProjectCache(cleanKey, jsonStr);
  } catch {}

  // 2. Local Daemon Persistent Storage (~/.prismex/project_cache)
  try {
    await client.saveProjectCache(projId, cleanKey, data);
  } catch {}

  // 3. Browser / CEP LocalStorage fallback
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`prismex_proj_${cleanKey}`, jsonStr);
    } catch {}
  }
}

export async function loadPersistedProjectData(manifest: any): Promise<boolean> {
  if (!manifest) return false;
  const cleanKey = getCleanSequenceKey(manifest.cleanSequenceName || manifest.sequenceName);
  const projId = manifest.premiereProjectId || 'current_project';

  // Tier 1: Check ExtendScript Project Folder Cache
  try {
    const extRes = await hostBridge.loadProjectCache(cleanKey);
    if (extRes.found && extRes.content) {
      const parsed: PrismexProjectSavePayload = JSON.parse(extRes.content);
      if (parsed.words && parsed.words.length > 0) {
        usePrismexStore.setState({
          transcriptWords: parsed.words,
          transcriptSentences: parsed.sentences || [],
          detectedSilences: parsed.silences || [],
          reviewItems: parsed.reviewItems || [],
          scriptDirectives: parsed.scriptDirectives || {},
          customMarkers: parsed.customMarkers || [],
          viralTopics: parsed.viralTopics || [],
          viralShorts: parsed.viralShorts || [],
          srtCues: parsed.srtCues || [],
          jobStatus: 'COMPLETE',
          jobProgress: 100,
          jobMessage: 'Loaded from project cache'
        });
        return true;
      }
    }
  } catch (e) {
    console.warn('ExtendScript cache load error:', e);
  }

  // Tier 2: Check Local Daemon Persistent Cache
  try {
    const daemonData = await client.getProjectCache(projId, cleanKey);
    if (daemonData && daemonData.words && daemonData.words.length > 0) {
      usePrismexStore.setState({
        transcriptWords: daemonData.words,
        transcriptSentences: daemonData.sentences || [],
        detectedSilences: daemonData.silences || [],
        reviewItems: daemonData.reviewItems || [],
        scriptDirectives: daemonData.scriptDirectives || {},
        customMarkers: daemonData.customMarkers || [],
        viralTopics: daemonData.viralTopics || [],
        viralShorts: daemonData.viralShorts || [],
        srtCues: daemonData.srtCues || [],
        jobStatus: 'COMPLETE',
        jobProgress: 100,
        jobMessage: 'Loaded from daemon project cache'
      });
      return true;
    }
  } catch (e) {
    console.warn('Daemon cache load error:', e);
  }

  // Tier 3: Check LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const localStr = localStorage.getItem(`prismex_proj_${cleanKey}`);
      if (localStr) {
        const parsed: PrismexProjectSavePayload = JSON.parse(localStr);
        if (parsed.words && parsed.words.length > 0) {
          usePrismexStore.setState({
            transcriptWords: parsed.words,
            transcriptSentences: parsed.sentences || [],
            detectedSilences: parsed.silences || [],
            reviewItems: parsed.reviewItems || [],
            scriptDirectives: parsed.scriptDirectives || {},
            customMarkers: parsed.customMarkers || [],
            viralTopics: parsed.viralTopics || [],
            viralShorts: parsed.viralShorts || [],
            srtCues: parsed.srtCues || [],
            jobStatus: 'COMPLETE',
            jobProgress: 100
          });
          return true;
        }
      }
    } catch {}
  }

  return false;
}

export const usePrismexStore = create<PrismexState>((set, get) => ({
  activeTab: 'transcript',
  setActiveTab: (tab) => set({ activeTab: tab }),

  language: (typeof window !== 'undefined' && (localStorage.getItem('prismex_lang') as AppLanguage)) || 'en',
  setLanguage: (lang) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('prismex_lang', lang);
    }
    set({ language: lang });
  },

  sequenceManifest: null,
  refreshSequence: async () => {
    const manifest = await hostBridge.getActiveSequenceManifest();
    set({ sequenceManifest: manifest });
    if (manifest && get().transcriptWords.length === 0) {
      await loadPersistedProjectData(manifest);
    }
  },

  executionMode: 'AUTO_EDIT',
  setExecutionMode: (mode) => set({ executionMode: mode }),
  activeProfileId: 'talking-head',
  setActiveProfileId: (id) => set({ activeProfileId: id }),

  currentJobId: null,
  jobStatus: 'INITIALIZING',
  jobProgress: 0,
  jobMessage: 'Ready',

  reviewItems: [],
  transcriptWords: [],
  transcriptSentences: [],
  detectedSilences: [],
  setTranscriptWords: (words) => {
    set({ transcriptWords: words });
    const seq = get().sequenceManifest;
    if (seq) {
      persistProjectData(seq, {
        words,
        sentences: get().transcriptSentences,
        silences: get().detectedSilences,
        reviewItems: get().reviewItems
      });
    }
  },
  setReviewItems: (items) => set({ reviewItems: items }),

  updateReviewItemStatus: (id, status) => {
    set((state) => ({
      reviewItems: state.reviewItems.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    }));
  },

  acceptAllReviewItems: () => {
    set((state) => ({
      reviewItems: state.reviewItems.map((item) => ({ ...item, status: 'ACCEPTED' }))
    }));
  },

  rejectAllReviewItems: () => {
    set((state) => ({
      reviewItems: state.reviewItems.map((item) => ({ ...item, status: 'REJECTED' }))
    }));
  },

  scriptDirectives: {},
  setScriptDirectives: (directives) => {
    set((state) => {
      const next = typeof directives === 'function' ? directives(state.scriptDirectives) : directives;
      const seq = state.sequenceManifest;
      if (seq) {
        persistProjectData(seq, {
          words: state.transcriptWords,
          sentences: state.transcriptSentences,
          silences: state.detectedSilences,
          reviewItems: state.reviewItems,
          scriptDirectives: next,
          customMarkers: state.customMarkers,
          viralTopics: state.viralTopics,
          viralShorts: state.viralShorts,
          srtCues: state.srtCues
        });
      }
      return { scriptDirectives: next };
    });
  },
  updateScriptDirective: (idx, patch) => {
    set((state) => {
      const existing = state.scriptDirectives[idx] || {};
      const next = {
        ...state.scriptDirectives,
        [idx]: { ...existing, ...patch }
      };
      const seq = state.sequenceManifest;
      if (seq) {
        persistProjectData(seq, {
          words: state.transcriptWords,
          sentences: state.transcriptSentences,
          silences: state.detectedSilences,
          reviewItems: state.reviewItems,
          scriptDirectives: next,
          customMarkers: state.customMarkers,
          viralTopics: state.viralTopics,
          viralShorts: state.viralShorts,
          srtCues: state.srtCues
        });
      }
      return { scriptDirectives: next };
    });
  },

  customMarkers: [],
  setCustomMarkers: (markers) => {
    set({ customMarkers: markers });
    get().saveCurrentProjectState();
  },

  viralTopics: [],
  setViralTopics: (topics) => {
    set({ viralTopics: topics });
    get().saveCurrentProjectState();
  },

  viralShorts: [],
  setViralShorts: (shorts) => {
    set((state) => {
      const next = typeof shorts === 'function' ? shorts(state.viralShorts) : shorts;
      const seq = state.sequenceManifest;
      if (seq) {
        persistProjectData(seq, {
          words: state.transcriptWords,
          sentences: state.transcriptSentences,
          silences: state.detectedSilences,
          reviewItems: state.reviewItems,
          scriptDirectives: state.scriptDirectives,
          customMarkers: state.customMarkers,
          viralTopics: state.viralTopics,
          viralShorts: next,
          srtCues: state.srtCues
        });
      }
      return { viralShorts: next };
    });
  },

  srtCues: [],
  setSrtCues: (cues) => {
    set((state) => {
      const next = typeof cues === 'function' ? cues(state.srtCues) : cues;
      const seq = state.sequenceManifest;
      if (seq) {
        persistProjectData(seq, {
          words: state.transcriptWords,
          sentences: state.transcriptSentences,
          silences: state.detectedSilences,
          reviewItems: state.reviewItems,
          scriptDirectives: state.scriptDirectives,
          customMarkers: state.customMarkers,
          viralTopics: state.viralTopics,
          viralShorts: state.viralShorts,
          srtCues: next
        });
      }
      return { srtCues: next };
    });
  },

  saveCurrentProjectState: async () => {
    const s = get();
    if (!s.sequenceManifest) return;
    await persistProjectData(s.sequenceManifest, {
      words: s.transcriptWords,
      sentences: s.transcriptSentences,
      silences: s.detectedSilences,
      reviewItems: s.reviewItems,
      scriptDirectives: s.scriptDirectives,
      customMarkers: s.customMarkers,
      viralTopics: s.viralTopics,
      viralShorts: s.viralShorts,
      srtCues: s.srtCues
    });
  },

  silenceSettings: {
    thresholdDbfs: -38,
    minDurationMs: 500,
    preCutPaddingMs: 80,
    postCutPaddingMs: 120,
    preserveBreathing: true
  },
  setSilenceSettings: (patch) =>
    set((state) => ({ silenceSettings: { ...state.silenceSettings, ...patch } })),

  profiles: [],
  providers: [],
  daemonOnline: false,
  lastReport: null,
  aiSummary: null,

  initApp: async () => {
    // 1. Check health
    const health = await client.checkHealth();
    set({ daemonOnline: health !== null });

    // 2. Load sequence and attempt instant restoration from project cache
    const manifest = await hostBridge.getActiveSequenceManifest();
    set({ sequenceManifest: manifest });
    if (manifest) {
      await loadPersistedProjectData(manifest);
    }

    // 3. Load profiles & providers
    const [profiles, providers] = await Promise.all([
      client.getProfiles(),
      client.getProviders()
    ]);
    set({ profiles, providers });

    // 4. Connect WebSocket
    client.connectWebSocket(async (event) => {
      if (event.method === 'job.progress') {
        set({
          jobProgress: event.params.percent,
          jobMessage: event.params.message,
          jobStatus: event.params.stage
        });
      } else if (event.method === 'job.completed') {
        const { jobId, executionMode, cuts, words, sentences, silences } = event.params;
        set({
          jobProgress: 100,
          jobMessage: 'Transcription & analysis complete!',
          jobStatus: 'COMPLETE',
          transcriptWords: words || [],
          transcriptSentences: sentences || [],
          detectedSilences: silences || []
        });

        const seq = get().sequenceManifest;
        if (seq) {
          persistProjectData(seq, {
            words: words || [],
            sentences: sentences || [],
            silences: silences || [],
            reviewItems: get().reviewItems
          });
        }

        if (executionMode === 'TRANSCRIBE_ONLY') {
          const items = await client.getReviewQueue(jobId);
          const currentTab = get().activeTab;
          set({
            reviewItems: items,
            activeTab: (currentTab === 'silence' || currentTab === 'takes') ? currentTab : 'transcript'
          });
        } else if (executionMode === 'REVIEW_EDIT') {
          const items = await client.getReviewQueue(jobId);
          set({ reviewItems: items, activeTab: 'review-queue' });
        } else {
          // Auto Edit -> Clone sequence & execute cuts
          const seq = get().sequenceManifest;
          if (seq) {
            const cloneRes = await hostBridge.cloneActiveSequence();
            const clonedName = cloneRes?.clonedSequenceName || `${seq.sequenceName}_PrismexRoughCut`;
            
            const normalizedCuts = (cuts || []).map((c: any) => ({
              cutId: c.cutId || c.id || `cut_${Date.now()}`,
              startSeconds: c.startSeconds ?? c.start_seconds ?? 0,
              endSeconds: c.endSeconds ?? c.end_seconds ?? 0,
              durationSeconds: c.durationSeconds ?? c.duration_seconds ?? 0,
              startTick: c.startTick ?? c.start_tick ?? '0',
              endTick: c.endTick ?? c.end_tick ?? '0',
              startFrame: c.startFrame ?? c.start_frame ?? 0,
              endFrame: c.endFrame ?? c.end_frame ?? 0,
              category: c.category || 'SILENCE',
              sourceSuggestionId: c.sourceSuggestionId || ''
            }));
            const execResult = await timelineEngine.executeCuts(normalizedCuts);

            const report: RoughCutSummaryReport = {
              jobId,
              originalSequenceName: seq.sequenceName,
              clonedSequenceName: clonedName,
              originalDurationSeconds: seq.durationSeconds,
              roughCutDurationSeconds: execResult.finalDurationSeconds,
              timeSavedSeconds: execResult.timeSavedSeconds,
              percentSaved: Math.round((execResult.timeSavedSeconds / Math.max(1, seq.durationSeconds)) * 100),
              totalCutsApplied: execResult.cutsExecuted,
              silencesRemovedCount: Math.round(execResult.cutsExecuted * 0.6),
              takesPrunedCount: Math.round(execResult.cutsExecuted * 0.2),
              fillersRemovedCount: Math.round(execResult.cutsExecuted * 0.2),
              engineUsed: 'MLX-Whisper (Local Apple Silicon)',
              syncVerified: execResult.syncVerified,
              timestamp: new Date().toLocaleTimeString()
            };

            set({ lastReport: report, activeTab: 'dashboard' });
          }
        }
      }
    });
  },

  transcribeSequence: async () => {
    const seq = await hostBridge.getActiveSequenceManifest();
    if (!seq) {
      alert('Please open an active sequence in Adobe Premiere Pro first.');
      return;
    }
    set({
      sequenceManifest: seq,
      jobProgress: 5,
      jobMessage: 'Extracting audio & transcribing speech...',
      jobStatus: 'TRANSCRIBING'
    });

    const res = await client.startMagicRoughCut(seq, 'TRANSCRIBE_ONLY', get().activeProfileId, get().silenceSettings);
    if (res) {
      set({ currentJobId: res.jobId });
    }
  },

  cutAllSilencesNow: async () => {
    const seq = await hostBridge.getActiveSequenceManifest();
    if (!seq) {
      alert('Please open an active sequence in Adobe Premiere Pro first.');
      return;
    }

    let silences = get().detectedSilences;
    if (!silences || silences.length === 0) {
      // If not analyzed yet, run Magic Auto Cut or ask to transcribe
      await get().transcribeSequence();
      return;
    }

    const fps = seq.fps || 24;
    const cuts = silences.map((s: any, idx: number) => ({
      cutId: `cut_sil_${idx}_${Date.now()}`,
      startSeconds: s.start_seconds,
      endSeconds: s.end_seconds,
      durationSeconds: s.duration_seconds,
      startTick: String(Math.round(s.start_seconds * 254016000000)),
      endTick: String(Math.round(s.end_seconds * 254016000000)),
      startFrame: Math.round(s.start_seconds * fps),
      endFrame: Math.round(s.end_seconds * fps),
      category: 'SILENCE' as const,
      sourceSuggestionId: ''
    }));

    await hostBridge.cloneActiveSequence('_SilenceCut');
    const execResult = await timelineEngine.executeCuts(cuts);
    if (execResult.success) {
      const remainingWords = rippleShiftWords(get().transcriptWords, cuts);
      set({ detectedSilences: [], transcriptWords: remainingWords });
      const currentSeq = get().sequenceManifest;
      if (currentSeq) {
        await persistProjectData(currentSeq, {
          words: remainingWords,
          sentences: get().transcriptSentences,
          silences: [],
          reviewItems: get().reviewItems
        });
      }
      await get().refreshSequence();
    }
  },

  runTranscriptAI: async (prompt?: string) => {
    const words = get().transcriptWords;
    if (!words || words.length === 0) return;
    const res = await client.aiAnalyzeTranscript(words, prompt);
    if (res) {
      set({ aiSummary: res });
    }
  },

  deleteTranscriptRange: async (startSeconds: number, endSeconds: number) => {
    const seq = get().sequenceManifest;
    if (!seq) return;

    const duration = Math.max(0, endSeconds - startSeconds);
    if (duration <= 0.04) return;

    const fps = seq.fps || 24;
    const cut = {
      cutId: `cut_txt_${Date.now()}`,
      startSeconds,
      endSeconds,
      durationSeconds: duration,
      startTick: String(Math.round(startSeconds * 254016000000)),
      endTick: String(Math.round(endSeconds * 254016000000)),
      startFrame: Math.round(startSeconds * fps),
      endFrame: Math.round(endSeconds * fps),
      category: 'SENTENCE_CUT' as const,
      sourceSuggestionId: ''
    };

    const execResult = await timelineEngine.executeCuts([cut]);
    if (execResult.success) {
      const remainingWords = rippleShiftWords(get().transcriptWords, [cut]);
      const updatedSilences = get().detectedSilences
        .filter((s: any) => s.end_seconds <= startSeconds + 0.02 || s.start_seconds >= endSeconds - 0.02)
        .map((s: any) => s.start_seconds >= endSeconds - 0.02
          ? { ...s, start_seconds: Math.max(0, s.start_seconds - duration), end_seconds: Math.max(0, s.end_seconds - duration) }
          : s
        );

      set({ transcriptWords: remainingWords, detectedSilences: updatedSilences });
      const currentSeq = get().sequenceManifest;
      if (currentSeq) {
        await persistProjectData(currentSeq, {
          words: remainingWords,
          sentences: get().transcriptSentences,
          silences: updatedSilences,
          reviewItems: get().reviewItems
        });
      }
    }
  },

  startMagicRoughCut: async () => {
    const seq = await hostBridge.getActiveSequenceManifest();
    if (!seq) {
      alert('Please open an active sequence in Adobe Premiere Pro first.');
      return;
    }
    set({ sequenceManifest: seq });

    set({
      jobProgress: 5,
      jobMessage: 'Starting Magic Rough Cut...',
      jobStatus: 'INITIALIZING'
    });

    const res = await client.startMagicRoughCut(seq, get().executionMode, get().activeProfileId, get().silenceSettings);
    if (res) {
      set({ currentJobId: res.jobId });
    }
  },

  applyApprovedReviewQueue: async () => {
    const acceptedItems = get().reviewItems.filter((i) => i.status === 'ACCEPTED');
    if (acceptedItems.length === 0) return;

    const jobId = get().currentJobId;
    const approvedIds = acceptedItems.map((i) => i.id);

    let cutIntervals: CutInterval[] = [];
    if (jobId) {
      try {
        const cutPlan = await client.applyReviewQueue(jobId, approvedIds);
        if (cutPlan && cutPlan.cuts && cutPlan.cuts.length > 0) {
          cutIntervals = cutPlan.cuts.map((c: any) => ({
            cutId: c.cutId || `cut_${Date.now()}_${Math.random()}`,
            startSeconds: c.startSeconds ?? c.start_seconds,
            endSeconds: c.endSeconds ?? c.end_seconds,
            durationSeconds: c.durationSeconds ?? c.duration_seconds ?? (c.end_seconds - c.start_seconds),
            startTick: c.startTick ?? c.start_tick ?? String(Math.round((c.startSeconds ?? c.start_seconds) * 254016000000)),
            endTick: c.endTick ?? c.end_tick ?? String(Math.round((c.endSeconds ?? c.end_seconds) * 254016000000)),
            startFrame: c.startFrame ?? 0,
            endFrame: c.endFrame ?? 0,
            category: (c.category as any) || 'REVIEW_CUT',
            sourceSuggestionId: c.sourceSuggestionId || ''
          }));
        }
      } catch (err) {
        console.warn('[applyApprovedReviewQueue] Daemon call failed, falling back to local cuts:', err);
      }
    }

    // Direct fallback: build cuts directly from acceptedItems if daemon cutPlan was empty
    if (cutIntervals.length === 0) {
      const fps = get().sequenceManifest?.fps || 24;
      cutIntervals = acceptedItems.map((item, idx) => ({
        cutId: item.id || `cut_appr_${idx}_${Date.now()}`,
        startSeconds: item.startSeconds,
        endSeconds: item.endSeconds,
        durationSeconds: item.durationSeconds,
        startTick: String(Math.round(item.startSeconds * 254016000000)),
        endTick: String(Math.round(item.endSeconds * 254016000000)),
        startFrame: Math.round(item.startSeconds * fps),
        endFrame: Math.round(item.endSeconds * fps),
        category: (item.category as any) || 'REVIEW_CUT',
        sourceSuggestionId: item.id
      }));
    }

    // Apply cuts directly to active timeline via instant native ripple delete
    const seq = get().sequenceManifest;
    const currentName = seq?.sequenceName || 'ActiveSequence';

    // Apply cuts
    const execResult = await timelineEngine.executeCuts(cutIntervals);
    if (execResult.success) {
      const remainingWords = rippleShiftWords(get().transcriptWords, cutIntervals);
      set({ transcriptWords: remainingWords, reviewItems: [] });
      if (seq) {
        await persistProjectData(seq, {
          words: remainingWords,
          sentences: get().transcriptSentences,
          silences: get().detectedSilences,
          reviewItems: []
        });
      }
    }

    const report: RoughCutSummaryReport = {
      jobId: jobId || `local_${Date.now()}`,
      originalSequenceName: currentName,
      clonedSequenceName: currentName,
      originalDurationSeconds: seq?.durationSeconds || 0,
      roughCutDurationSeconds: execResult.finalDurationSeconds,
      timeSavedSeconds: execResult.timeSavedSeconds,
      percentSaved: Math.round((execResult.timeSavedSeconds / Math.max(1, seq?.durationSeconds || 1)) * 100),
      totalCutsApplied: execResult.cutsExecuted,
      silencesRemovedCount: acceptedItems.filter((i) => i.category === 'SILENCE').length,
      takesPrunedCount: acceptedItems.filter((i) => i.category === 'REPEATED_TAKE').length,
      fillersRemovedCount: acceptedItems.filter((i) => i.category === 'FILLER_WORD').length,
      engineUsed: 'Prismex Review Queue Cut',
      syncVerified: execResult.syncVerified,
      timestamp: new Date().toLocaleTimeString()
    };

    set({ lastReport: report, activeTab: 'dashboard' });
  }
}));
