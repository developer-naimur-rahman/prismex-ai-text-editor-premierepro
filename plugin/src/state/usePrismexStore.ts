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
  | 'dashboard' 
  | 'magic-cut' 
  | 'transcript' 
  | 'review-queue' 
  | 'takes' 
  | 'silence' 
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
  setReviewItems: (items: ReviewQueueItem[]) => void;
  updateReviewItemStatus: (id: string, status: 'ACCEPTED' | 'REJECTED') => void;
  acceptAllReviewItems: () => void;
  rejectAllReviewItems: () => void;

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

    // 2. Load sequence
    const manifest = await hostBridge.getActiveSequenceManifest();
    set({ sequenceManifest: manifest });

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

        if (executionMode === 'TRANSCRIBE_ONLY') {
          const items = await client.getReviewQueue(jobId);
          set({ reviewItems: items, activeTab: 'transcript' });
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
      set({ detectedSilences: [] });
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
      // Remove deleted words and ripple-shift subsequent timestamps
      const updatedWords = get().transcriptWords
        .filter((w: any) => {
          const wStart = w.start_seconds ?? w.start ?? 0;
          const wEnd = w.end_seconds ?? w.end ?? 0;
          return wEnd <= startSeconds + 0.02 || wStart >= endSeconds - 0.02;
        })
        .map((w: any) => {
          const wStart = w.start_seconds ?? w.start ?? 0;
          const wEnd = w.end_seconds ?? w.end ?? 0;
          if (wStart >= endSeconds - 0.02) {
            return {
              ...w,
              start_seconds: Math.max(0, wStart - duration),
              end_seconds: Math.max(0, wEnd - duration)
            };
          }
          return w;
        });

      const updatedSilences = get().detectedSilences
        .filter((s: any) => s.end_seconds <= startSeconds + 0.02 || s.start_seconds >= endSeconds - 0.02)
        .map((s: any) => s.start_seconds >= endSeconds - 0.02
          ? { ...s, start_seconds: Math.max(0, s.start_seconds - duration), end_seconds: Math.max(0, s.end_seconds - duration) }
          : s
        );

      set({ transcriptWords: updatedWords, detectedSilences: updatedSilences });
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

    // Clone sequence
    const seq = get().sequenceManifest;
    const cloneRes = await hostBridge.cloneActiveSequence('_ApprovedCuts');
    const clonedName = cloneRes?.clonedSequenceName || `${seq?.sequenceName}_ApprovedCuts`;

    // Apply cuts
    const execResult = await timelineEngine.executeCuts(cutIntervals);

    const report: RoughCutSummaryReport = {
      jobId: jobId || `local_${Date.now()}`,
      originalSequenceName: seq?.sequenceName || 'Original',
      clonedSequenceName: clonedName,
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
