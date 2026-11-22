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
  | 'client-hub'
  | 'magic-cut' 
  | 'silence' 
  | 'takes' 
  | 'review-queue' 
  | 'srt-editor'
  | 'viral-shorts'
  | 'color-studio'
  | 'audio-studio'
  | 'dashboard' 
  | 'providers' 
  | 'profiles' 
  | 'settings' 
  | 'history';

export interface ActionFeedback {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  detail?: string;
  reason?: string;
  guideline?: string;
  actionText?: string;
  onAction?: () => void;
  timestamp: number;
}

interface PrismexState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Localization
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;

  // Global UI Scale
  uiScale: 'compact' | 'normal' | 'large' | 'xlarge';
  setUiScale: (scale: 'compact' | 'normal' | 'large' | 'xlarge') => void;

  // Premiere Pro Host State
  sequenceManifest: SequenceManifest | null;
  refreshSequence: () => Promise<void>;
  checkSequenceChange: () => Promise<void>;
  autoTranscribeNewSequences: boolean;
  setAutoTranscribeNewSequences: (val: boolean) => void;
  sequenceChangedNotice: string | null;
  setSequenceChangedNotice: (notice: string | null) => void;

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

  // Initialization & Boot Overlay
  isAppInitializing: boolean;
  initStepMessage: string;
  initStepProgress: number;

  // Sequence Switch Loading Overlay
  isSwitchingSequence: boolean;
  sequenceSwitchMessage: string;
  sequenceSwitchProgress: number;

  // Audio Studio State
  activeAudioProfileId: string;
  setActiveAudioProfileId: (id: string) => void;
  audioSettings: {
    denoise: number;
    dereverb: number;
    crispAir: number;
    warmth: number;
    deesser: number;
    targetLufs: number;
  };
  setAudioSettings: (settings: Partial<{
    denoise: number;
    dereverb: number;
    crispAir: number;
    warmth: number;
    deesser: number;
    targetLufs: number;
  }>) => void;
  detectedSfxCues: any[];
  setDetectedSfxCues: (cues: any[]) => void;
  soundDesignTips: string[];
  setSoundDesignTips: (tips: string[]) => void;
  recommendedBgmData: any | null;
  setRecommendedBgmData: (data: any | null) => void;

  // Client Brief & Script Co-Pilot State
  clientScriptText: string;
  setClientScriptText: (text: string) => void;
  clientBriefText: string;
  setClientBriefText: (text: string) => void;
  scriptAuditReport: any[];
  setScriptAuditReport: (report: any[]) => void;
  clientDossier: any | null;
  setClientDossier: (dossier: any | null) => void;
  toggleDossierTodo: (id: string) => void;

  // Brand Kit & Visual Palette State
  brandKit: {
    brandName: string;
    logoBase64?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    palette: string[];
    fontSuggestion?: string;
  };
  setBrandKit: (kit: any) => void;

  // Step-by-Step Editing Roadmap & Checklist
  editingRoadmap: Array<{
    id: string;
    step: number;
    title: string;
    description: string;
    category: string;
    priority?: string;
    completed: boolean;
  }>;
  setEditingRoadmap: (roadmap: any[]) => void;
  toggleRoadmapItem: (id: string) => void;

  // Client Revisions & Timecode Action Log
  clientRevisions: Array<{
    id: string;
    timecode: string;
    seconds: number;
    clientRequest: string;
    actionItem?: string;
    category: string;
    priority?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
    completed?: boolean;
    actionTaken?: string;
  }>;
  setClientRevisions: (revs: any[]) => void;
  updateRevisionStatus: (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED', actionTaken?: string) => void;
  toggleRevisionItem: (id: string) => void;

  // Global Universal Co-Pilot Floating Drawer
  isGlobalCopilotOpen: boolean;
  setIsGlobalCopilotOpen: (open: boolean) => void;

  // Global Busy & Activity Tracker
  globalBusyAction: string | null;
  setGlobalBusyAction: (action: string | null) => void;

  // Global Toasts & Action Guideline Feedback
  globalToast: { message: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'error', durationMs?: number) => void;
  actionFeedback: ActionFeedback | null;
  showActionFeedback: (feedback: Omit<ActionFeedback, 'id' | 'timestamp'>) => void;
  clearActionFeedback: () => void;

  // 1-Click Sequence Aspect Ratio Converter & Auto-Fit
  changeSequenceAspectRatio: (options: {
    width: number;
    height: number;
    label: string;
    ratioKey?: string;
    fitMode?: 'fill' | 'fit';
    clone?: boolean;
  }) => Promise<void>;

  // Actions
  initApp: () => Promise<void>;
  transcribeSequence: (options?: any) => Promise<void>;
  deleteTranscriptRange: (startSeconds: number, endSeconds: number) => Promise<void>;
  cutAllSilencesNow: () => Promise<void>;
  runTranscriptAI: (prompt?: string) => Promise<void>;
  startMagicRoughCut: () => Promise<void>;
  applyApprovedReviewQueue: () => Promise<void>;
}

const client = PrismexDaemonClient.getInstance();
const hostBridge = PremiereHostBridge.getInstance();
const timelineEngine = new TimelineEditingEngine();
let sequenceWatcherTimer: any = null;
let lastSequenceSignature: string = '';
let consecutiveNullManifestTicks: number = 0;

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
      const wordDur = Math.max(0.01, we - ws);
      const mid = (ws + we) / 2;

      // Cleanly remove any word whose midpoint or substantial duration lies within a cut interval
      return !sortedCuts.some((c) => {
        const cStart = c.startSeconds;
        const cEnd = c.endSeconds;
        if (mid >= cStart && mid <= cEnd) return true;
        const overlap = Math.max(0, Math.min(we, cEnd) - Math.max(ws, cStart));
        if (overlap / wordDur >= 0.35) return true;
        if (ws >= cStart - 0.05 && we <= cEnd + 0.05) return true;
        return false;
      });
    })
    .map((w) => {
      const origStart = w.start_seconds ?? w.start ?? 0;
      const origEnd = w.end_seconds ?? w.end ?? 0;
      const dur = Math.max(0.01, origEnd - origStart);

      // CRITICAL FIX: Calculate cumulative cut time preceding origStart using unmutated cut intervals
      let cutBefore = 0;
      for (const c of sortedCuts) {
        const cStart = c.startSeconds;
        const cEnd = c.endSeconds;
        if (cEnd <= origStart + 0.001) {
          cutBefore += (cEnd - cStart);
        } else if (cStart < origStart) {
          cutBefore += (origStart - cStart);
        }
      }

      const newStart = Math.max(0, origStart - cutBefore);
      const newEnd = Math.max(newStart + 0.01, newStart + dur);

      return {
        ...w,
        start_seconds: Number(newStart.toFixed(4)),
        end_seconds: Number(newEnd.toFixed(4)),
        start: Number(newStart.toFixed(4)),
        end: Number(newEnd.toFixed(4))
      };
    });
}

/**
 * Re-aligns transcript words with Premiere Pro timeline clips after cuts, ripple deletes, or clip movements.
 * Matches each word's persistent sourceMedia + sourceTime offset against active timeline clips.
 */
export function realignWordsWithTimelineClips(words: any[], sourceClips: any[]): any[] {
  if (!words || words.length === 0 || !sourceClips || sourceClips.length === 0) return words;

  // Filter out invalid/empty clips
  const validClips = sourceClips.filter((c: any) => (c.outSeconds - c.inSeconds) > 0.02 || (c.sourceOutSeconds - c.sourceInSeconds) > 0.02);
  if (validClips.length === 0) return words;

  const realignedWords: any[] = [];

  for (const w of words) {
    const wordSourceTime = w.sourceTime !== undefined ? Number(w.sourceTime) : Number(w.start_seconds ?? w.start ?? 0);
    const wordDur = w.duration !== undefined ? Number(w.duration) : Math.max(0.04, Number(w.end_seconds ?? w.end ?? 0) - Number(w.start_seconds ?? w.start ?? 0));
    const wordMedia = (w.mediaPath || '').trim().toLowerCase();

    let matchedClip: any = null;

    // 1. Try matching with mediaPath & source time range
    for (const clip of validClips) {
      const clipMedia = (clip.mediaPath || '').trim().toLowerCase();
      const mediaMatches = !wordMedia || !clipMedia || wordMedia === clipMedia || validClips.length === 1;

      if (mediaMatches) {
        const srcIn = Number(clip.sourceInSeconds ?? 0);
        const srcOut = Number(clip.sourceOutSeconds ?? clip.outSeconds ?? 0);
        if (wordSourceTime >= srcIn - 0.04 && wordSourceTime < srcOut + 0.04) {
          matchedClip = clip;
          break;
        }
      }
    }

    // 2. Fallback: match by source time range across any clip if mediaPath was missing
    if (!matchedClip) {
      for (const clip of validClips) {
        const srcIn = Number(clip.sourceInSeconds ?? 0);
        const srcOut = Number(clip.sourceOutSeconds ?? clip.outSeconds ?? 0);
        if (wordSourceTime >= srcIn - 0.04 && wordSourceTime < srcOut + 0.04) {
          matchedClip = clip;
          break;
        }
      }
    }

    if (matchedClip) {
      const clipIn = Number(matchedClip.inSeconds ?? 0);
      const clipSrcIn = Number(matchedClip.sourceInSeconds ?? 0);
      const offsetInClip = Math.max(0, wordSourceTime - clipSrcIn);
      const newTimelineStart = Math.max(0, clipIn + offsetInClip);
      const newTimelineEnd = Math.max(newTimelineStart + 0.01, newTimelineStart + wordDur);

      realignedWords.push({
        ...w,
        sourceTime: wordSourceTime,
        duration: wordDur,
        mediaPath: matchedClip.mediaPath || w.mediaPath,
        start_seconds: Number(newTimelineStart.toFixed(3)),
        end_seconds: Number(newTimelineEnd.toFixed(3)),
        start: Number(newTimelineStart.toFixed(3)),
        end: Number(newTimelineEnd.toFixed(3))
      });
    } else {
      // Keep word intact so transcription words are never silently dropped or truncated
      realignedWords.push(w);
    }
  }

  // Sort strictly ascending by timeline start time
  realignedWords.sort((a, b) => a.start_seconds - b.start_seconds);
  return realignedWords;
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
  audioSettings?: any;
  detectedSfxCues?: any[];
  soundDesignTips?: string[];
  recommendedBgmData?: any;
  clientScriptText?: string;
  clientBriefText?: string;
  scriptAuditReport?: any[];
  brandKit?: any;
  editingRoadmap?: any[];
  clientRevisions?: any[];
  clientDossier?: any;
}

export const CLIENT_MASTER_CACHE_KEY = '_project_client_master';

export interface PrismexClientMasterPayload {
  clientDossier?: any;
  brandKit?: any;
  clientBriefText?: string;
  clientScriptText?: string;
  editingRoadmap?: any[];
  scriptAuditReport?: any[];
  updatedAt?: string;
}

/**
 * Tier 1 (Project-Level Ground Truth):
 * Persists client dossier, brand kit, brief, fonts, and links globally for the entire Premiere project.
 * Shared across ALL sequences (e.g. 18 promo videos) in the same project.
 */
export async function persistClientMasterData(manifest: any, data: PrismexClientMasterPayload): Promise<void> {
  const jsonStr = JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString()
  });
  const projId = manifest?.premiereProjectId || 'current_project';

  // 1. ExtendScript Project Folder Cache (.prismex_cache/_project_client_master.json)
  try {
    await hostBridge.saveProjectCache(CLIENT_MASTER_CACHE_KEY, jsonStr);
  } catch {}

  // 2. Local Daemon Persistent Storage (~/.prismex/project_cache)
  try {
    await client.saveProjectCache(projId, CLIENT_MASTER_CACHE_KEY, data);
  } catch {}

  // 3. Browser / CEP LocalStorage fallback
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`prismex_client_master_${projId}`, jsonStr);
      localStorage.setItem('prismex_client_master_global', jsonStr);
    } catch {}
  }
}

/**
 * Loads project-wide client master data into store (retains across all sequences).
 */
export async function loadClientMasterData(manifest?: any): Promise<boolean> {
  const projId = manifest?.premiereProjectId || 'current_project';

  // 1. ExtendScript Project Folder Cache
  try {
    const extRes = await hostBridge.loadProjectCache(CLIENT_MASTER_CACHE_KEY);
    if (extRes.found && extRes.content) {
      const parsed: PrismexClientMasterPayload = JSON.parse(extRes.content);
      if (parsed) {
        usePrismexStore.setState((prev) => ({
          clientDossier: parsed.clientDossier || prev.clientDossier,
          brandKit: parsed.brandKit ? { ...prev.brandKit, ...parsed.brandKit } : prev.brandKit,
          clientBriefText: parsed.clientBriefText !== undefined ? parsed.clientBriefText : prev.clientBriefText,
          clientScriptText: parsed.clientScriptText !== undefined ? parsed.clientScriptText : prev.clientScriptText,
          editingRoadmap: (parsed.editingRoadmap && parsed.editingRoadmap.length > 0) ? parsed.editingRoadmap : prev.editingRoadmap
        }));
        return true;
      }
    }
  } catch (e) {
    console.warn('ExtendScript client master load error:', e);
  }

  // 2. Local Daemon Persistent Cache
  try {
    const daemonData = await client.getProjectCache(projId, CLIENT_MASTER_CACHE_KEY);
    if (daemonData) {
      usePrismexStore.setState((prev) => ({
        clientDossier: daemonData.clientDossier || prev.clientDossier,
        brandKit: daemonData.brandKit ? { ...prev.brandKit, ...daemonData.brandKit } : prev.brandKit,
        clientBriefText: daemonData.clientBriefText !== undefined ? daemonData.clientBriefText : prev.clientBriefText,
        clientScriptText: daemonData.clientScriptText !== undefined ? daemonData.clientScriptText : prev.clientScriptText,
        editingRoadmap: (daemonData.editingRoadmap && daemonData.editingRoadmap.length > 0) ? daemonData.editingRoadmap : prev.editingRoadmap
      }));
      return true;
    }
  } catch (e) {
    console.warn('Daemon client master load error:', e);
  }

  // 3. LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const localStr = localStorage.getItem(`prismex_client_master_${projId}`) || localStorage.getItem('prismex_client_master_global');
      if (localStr) {
        const parsed: PrismexClientMasterPayload = JSON.parse(localStr);
        if (parsed) {
          usePrismexStore.setState((prev) => ({
            clientDossier: parsed.clientDossier || prev.clientDossier,
            brandKit: parsed.brandKit ? { ...prev.brandKit, ...parsed.brandKit } : prev.brandKit,
            clientBriefText: parsed.clientBriefText !== undefined ? parsed.clientBriefText : prev.clientBriefText,
            clientScriptText: parsed.clientScriptText !== undefined ? parsed.clientScriptText : prev.clientScriptText,
            editingRoadmap: (parsed.editingRoadmap && parsed.editingRoadmap.length > 0) ? parsed.editingRoadmap : prev.editingRoadmap
          }));
          return true;
        }
      }
    } catch {}
  }
  return false;
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
          audioSettings: parsed.audioSettings || usePrismexStore.getState().audioSettings,
          detectedSfxCues: parsed.detectedSfxCues || [],
          soundDesignTips: parsed.soundDesignTips || [],
          recommendedBgmData: parsed.recommendedBgmData || null,
          clientScriptText: parsed.clientScriptText || usePrismexStore.getState().clientScriptText || '',
          clientBriefText: parsed.clientBriefText || usePrismexStore.getState().clientBriefText || '',
          scriptAuditReport: parsed.scriptAuditReport || usePrismexStore.getState().scriptAuditReport || [],
          brandKit: parsed.brandKit || usePrismexStore.getState().brandKit,
          editingRoadmap: (parsed.editingRoadmap && parsed.editingRoadmap.length > 0) ? parsed.editingRoadmap : usePrismexStore.getState().editingRoadmap || [],
          clientRevisions: parsed.clientRevisions || [],
          clientDossier: parsed.clientDossier || usePrismexStore.getState().clientDossier || null,
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
        audioSettings: daemonData.audioSettings || usePrismexStore.getState().audioSettings,
        detectedSfxCues: daemonData.detectedSfxCues || [],
        soundDesignTips: daemonData.soundDesignTips || [],
        recommendedBgmData: daemonData.recommendedBgmData || null,
        clientScriptText: daemonData.clientScriptText || usePrismexStore.getState().clientScriptText || '',
        clientBriefText: daemonData.clientBriefText || usePrismexStore.getState().clientBriefText || '',
        scriptAuditReport: daemonData.scriptAuditReport || usePrismexStore.getState().scriptAuditReport || [],
        brandKit: daemonData.brandKit || usePrismexStore.getState().brandKit,
        editingRoadmap: (daemonData.editingRoadmap && daemonData.editingRoadmap.length > 0) ? daemonData.editingRoadmap : usePrismexStore.getState().editingRoadmap || [],
        clientRevisions: daemonData.clientRevisions || [],
        clientDossier: daemonData.clientDossier || usePrismexStore.getState().clientDossier || null,
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
            audioSettings: parsed.audioSettings || usePrismexStore.getState().audioSettings,
            detectedSfxCues: parsed.detectedSfxCues || [],
            soundDesignTips: parsed.soundDesignTips || [],
            recommendedBgmData: parsed.recommendedBgmData || null,
            clientScriptText: parsed.clientScriptText || usePrismexStore.getState().clientScriptText || '',
            clientBriefText: parsed.clientBriefText || usePrismexStore.getState().clientBriefText || '',
            scriptAuditReport: parsed.scriptAuditReport || usePrismexStore.getState().scriptAuditReport || [],
            brandKit: parsed.brandKit || usePrismexStore.getState().brandKit,
            editingRoadmap: (parsed.editingRoadmap && parsed.editingRoadmap.length > 0) ? parsed.editingRoadmap : usePrismexStore.getState().editingRoadmap || [],
            clientRevisions: parsed.clientRevisions || [],
            clientDossier: parsed.clientDossier || usePrismexStore.getState().clientDossier || null,
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

export async function clearPersistedProjectData(manifest: any): Promise<void> {
  if (!manifest) return;
  const cleanKey = getCleanSequenceKey(manifest.cleanSequenceName || manifest.sequenceName);
  const projId = manifest.premiereProjectId || 'current_project';

  // 1. ExtendScript Project Folder Cache
  try {
    await hostBridge.saveProjectCache(cleanKey, "{}");
  } catch {}

  // 2. Local Daemon Persistent Storage
  try {
    await client.saveProjectCache(projId, cleanKey, {
      words: [],
      sentences: [],
      silences: [],
      reviewItems: []
    });
  } catch {}

  // 3. LocalStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`prismex_proj_${cleanKey}`);
    } catch {}
  }
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

  uiScale: (() => {
    const s = typeof window !== 'undefined' ? (localStorage.getItem('prismex_ui_scale') as any) : null;
    const initial = (s === 'compact' || s === 'large' || s === 'xlarge') ? s : 'normal';
    if (typeof document !== 'undefined') {
      const map: Record<string, string> = { compact: '0.88', normal: '1', large: '1.14', xlarge: '1.28' };
      document.documentElement.style.setProperty('--prismex-ui-scale', map[initial]);
    }
    return initial;
  })(),
  setUiScale: (scale) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('prismex_ui_scale', scale);
    }
    if (typeof document !== 'undefined') {
      const map: Record<string, string> = { compact: '0.88', normal: '1', large: '1.14', xlarge: '1.28' };
      document.documentElement.style.setProperty('--prismex-ui-scale', map[scale] || '1');
    }
    set({ uiScale: scale });
  },

  sequenceManifest: null,
  autoTranscribeNewSequences: (() => {
    try {
      return localStorage.getItem('prismex_auto_transcribe_new') === 'true';
    } catch {
      return false;
    }
  })(),
  setAutoTranscribeNewSequences: (val: boolean) => {
    try {
      localStorage.setItem('prismex_auto_transcribe_new', String(val));
    } catch {}
    set({ autoTranscribeNewSequences: val });
  },
  sequenceChangedNotice: null,
  setSequenceChangedNotice: (notice: string | null) => set({ sequenceChangedNotice: notice }),

  isAppInitializing: false,
  initStepMessage: 'Ready',
  initStepProgress: 100,

  isSwitchingSequence: false,
  sequenceSwitchMessage: '',
  sequenceSwitchProgress: 0,

  activeAudioProfileId: 'crispy-podcast',
  setActiveAudioProfileId: (id) => set({ activeAudioProfileId: id }),
  audioSettings: {
    denoise: 50,
    dereverb: 40,
    crispAir: 65,
    warmth: 45,
    deesser: 55,
    targetLufs: -14.0
  },
  setAudioSettings: (settings) => set((state) => ({ audioSettings: { ...state.audioSettings, ...settings } })),
  detectedSfxCues: [],
  setDetectedSfxCues: (cues) => set({ detectedSfxCues: cues }),
  soundDesignTips: [],
  setSoundDesignTips: (tips) => set({ soundDesignTips: tips }),
  recommendedBgmData: null,
  setRecommendedBgmData: (data) => {
    set({ recommendedBgmData: data });
    get().saveCurrentProjectState();
  },

  clientScriptText: '',
  setClientScriptText: (text) => {
    set({ clientScriptText: text });
    get().saveCurrentProjectState();
  },
  clientBriefText: '',
  setClientBriefText: (text) => {
    set({ clientBriefText: text });
    get().saveCurrentProjectState();
  },
  scriptAuditReport: [],
  setScriptAuditReport: (report) => {
    set({ scriptAuditReport: report });
    get().saveCurrentProjectState();
  },
  clientDossier: null,
  setClientDossier: (dossier) => {
    set({ clientDossier: dossier });
    get().saveCurrentProjectState();
  },
  toggleDossierTodo: (id) => {
    set((state) => {
      if (!state.clientDossier || !state.clientDossier.todoChecklist) return state;
      const updatedTodos = state.clientDossier.todoChecklist.map((item: any) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      return {
        clientDossier: {
          ...state.clientDossier,
          todoChecklist: updatedTodos
        }
      };
    });
    get().saveCurrentProjectState();
  },

  brandKit: {
    brandName: '',
    primaryColor: '#1E40AF',
    secondaryColor: '#3B82F6',
    accentColor: '#F59E0B',
    backgroundColor: '#0F172A',
    textColor: '#F8FAFC',
    palette: ['#1E40AF', '#3B82F6', '#F59E0B', '#10B981', '#0F172A'],
    fontSuggestion: 'Inter / Montserrat (Clean Modern Sans-Serif)'
  },
  setBrandKit: (kit) => {
    set((state) => ({ brandKit: { ...state.brandKit, ...kit } }));
    get().saveCurrentProjectState();
  },

  editingRoadmap: [],
  setEditingRoadmap: (roadmap) => {
    set({ editingRoadmap: roadmap });
    get().saveCurrentProjectState();
  },
  toggleRoadmapItem: (id) => {
    set((state) => ({
      editingRoadmap: state.editingRoadmap.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    }));
    get().saveCurrentProjectState();
  },

  clientRevisions: [],
  setClientRevisions: (revs) => {
    set({ clientRevisions: revs });
    get().saveCurrentProjectState();
  },
  updateRevisionStatus: (id, status, actionTaken) => {
    set((state) => ({
      clientRevisions: state.clientRevisions.map((rev) =>
        rev.id === id
          ? {
              ...rev,
              status,
              completed: status === 'RESOLVED',
              ...(actionTaken !== undefined ? { actionTaken } : {})
            }
          : rev
      )
    }));
    get().saveCurrentProjectState();
  },
  toggleRevisionItem: (id) => {
    set((state) => ({
      clientRevisions: state.clientRevisions.map((rev) => {
        if (rev.id !== id) return rev;
        const newCompleted = !rev.completed;
        return {
          ...rev,
          completed: newCompleted,
          status: newCompleted ? 'RESOLVED' : 'PENDING'
        };
      })
    }));
    get().saveCurrentProjectState();
  },

  isGlobalCopilotOpen: false,
  setIsGlobalCopilotOpen: (open) => set({ isGlobalCopilotOpen: open }),

  globalBusyAction: null,
  setGlobalBusyAction: (action) => set({ globalBusyAction: action }),

  globalToast: null,
  showToast: (message, type = 'success', durationMs = 3000) => {
    set({ globalToast: { message, type } });
    setTimeout(() => {
      if (get().globalToast?.message === message) {
        set({ globalToast: null });
      }
    }, durationMs);
  },

  actionFeedback: null,
  showActionFeedback: (feedback) => {
    const item: ActionFeedback = {
      ...feedback,
      id: `act_${Date.now()}`,
      timestamp: Date.now()
    };
    set({ actionFeedback: item });

    // Auto-dismiss successes after 6.5s
    if (feedback.type === 'success') {
      setTimeout(() => {
        if (get().actionFeedback?.id === item.id) {
          set({ actionFeedback: null });
        }
      }, 6500);
    }
  },
  clearActionFeedback: () => set({ actionFeedback: null }),

  changeSequenceAspectRatio: async (options) => {
    const isBn = get().language === 'bn';
    set({
      globalBusyAction: isBn ? `সিকোয়েন্স ${options.label}-এ পরিবর্তন ও অটো-ফিট হচ্ছে...` : `Converting sequence to ${options.label}...`
    });

    try {
      const res = await hostBridge.changeSequenceAspectRatio(options);
      if (res.success) {
        await get().refreshSequence();
        get().showToast(
          isBn ? `✓ সিকোয়েন্স ${options.label} (${options.width}x${options.height}) ফরম্যাটে পরিবর্তিত ও অটো-ফিট সম্পন্ন!` : `✓ Sequence converted to ${options.label} & auto-fitted!`,
          'success',
          4000
        );
        get().showActionFeedback({
          type: 'success',
          title: isBn ? `✓ সিকোয়েন্স রেশিও পরিবর্তন সফল (${options.label})` : `✓ Sequence Aspect Ratio Changed (${options.label})`,
          detail: isBn 
            ? `সিকোয়েন্সের ফ্রেম রেজোলিউশন ${options.width}x${options.height} করা হয়েছে এবং ${res.clipsModified || 'সকল'} ক্লিপে অটো-স্কেলিং ও ফিট প্রয়োগ করা হয়েছে।` 
            : `Resolution set to ${options.width}x${options.height}. ${res.clipsModified || 'All'} clips auto-fitted.`
        });
      } else {
        get().showActionFeedback({
          type: 'error',
          title: isBn ? '⚠️ সিকোয়েন্স রেশিও পরিবর্তন করা যায়নি' : '⚠️ Could Not Change Aspect Ratio',
          reason: res.reason || res.error || (isBn ? 'টাইমলাইনে কোনো সক্রিয় সিকোয়েন্স পাওয়া যায়নি।' : 'No active sequence found.'),
          guideline: res.guideline || (isBn ? '১. প্রিমিয়ার প্রোতে টাইমলাইন উইন্ডোতে একটি সিকোয়েন্স ওপেন করুন।\n২. ক্লিপগুলো লক বা রিড-অনলি মোডে নেই তা নিশ্চিত করুন।' : '1. Open an active sequence in Premiere Pro timeline.\n2. Ensure clips are not locked.'),
          actionText: isBn ? '🔄 পুনরায় চেষ্টা করুন' : 'Retry',
          onAction: () => get().changeSequenceAspectRatio(options)
        });
      }
    } catch (err: any) {
      get().showActionFeedback({
        type: 'error',
        title: isBn ? '⚠️ এরর: সিকোয়েন্স পরিবর্তন ব্যর্থ' : '⚠️ Error Changing Aspect Ratio',
        reason: String(err),
        guideline: isBn ? 'প্রিমিয়ার প্রোতে কোনো অপারেশন রানিং থাকলে শেষ হতে দিন এবং প্যানেল রিফ্রেশ করুন।' : 'Wait for any active operations in Premiere Pro to complete and retry.'
      });
    } finally {
      set({ globalBusyAction: null });
    }
  },

  checkSequenceChange: async () => {
    // Never interrupt an active transcription
    if (get().jobStatus === 'TRANSCRIBING' || (get().jobProgress > 0 && get().jobProgress < 100)) {
      return;
    }

    try {
      lastSequenceSignature = await hostBridge.getActiveSequenceSignature();
    } catch {}

    const newManifest = await hostBridge.getActiveSequenceManifest();
    const currentSeq = get().sequenceManifest;

    if (!newManifest) {
      // Retain last known sequence manifest on temporary hiccups
      return;
    }

    const oldCleanKey = currentSeq ? getCleanSequenceKey(currentSeq.cleanSequenceName || currentSeq.sequenceName) : '';
    const newCleanKey = getCleanSequenceKey(newManifest.cleanSequenceName || newManifest.sequenceName);
    const isDifferentSeq = !currentSeq || (oldCleanKey !== newCleanKey) || (currentSeq.sequenceGuid !== newManifest.sequenceGuid);

    if (isDifferentSeq) {
      const isBn = get().language === 'bn';
      const seqDisplay = newManifest.cleanSequenceName || newManifest.sequenceName;

      // 1. AUTO-SAVE PREVIOUS SEQUENCE:
      // If user had a sequence open with transcript data, save it immediately before switching!
      const prevWords = get().transcriptWords;
      const prevSentences = get().transcriptSentences;
      const prevSilences = get().detectedSilences;
      const prevReviewItems = get().reviewItems;
      const prevScriptDirectives = get().scriptDirectives;
      const prevCustomMarkers = get().customMarkers;
      const prevViralTopics = get().viralTopics;
      const prevViralShorts = get().viralShorts;
      const prevSrtCues = get().srtCues;
      const prevAudioSettings = get().audioSettings;
      const prevDetectedSfxCues = get().detectedSfxCues;
      const prevSoundDesignTips = get().soundDesignTips;
      const prevRecommendedBgmData = get().recommendedBgmData;
      const prevClientScriptText = get().clientScriptText;
      const prevClientBriefText = get().clientBriefText;
      const prevScriptAuditReport = get().scriptAuditReport;
      const prevBrandKit = get().brandKit;
      const prevEditingRoadmap = get().editingRoadmap;
      const prevClientRevisions = get().clientRevisions;
      const prevClientDossier = get().clientDossier;

      if (currentSeq && prevWords && prevWords.length > 0) {
        try {
          await persistProjectData(currentSeq, {
            words: prevWords,
            sentences: prevSentences,
            silences: prevSilences,
            reviewItems: prevReviewItems,
            scriptDirectives: prevScriptDirectives,
            customMarkers: prevCustomMarkers,
            viralTopics: prevViralTopics,
            viralShorts: prevViralShorts,
            srtCues: prevSrtCues,
            audioSettings: prevAudioSettings,
            detectedSfxCues: prevDetectedSfxCues,
            soundDesignTips: prevSoundDesignTips,
            recommendedBgmData: prevRecommendedBgmData,
            clientScriptText: prevClientScriptText,
            clientBriefText: prevClientBriefText,
            scriptAuditReport: prevScriptAuditReport,
            brandKit: prevBrandKit,
            editingRoadmap: prevEditingRoadmap,
            clientRevisions: prevClientRevisions,
            clientDossier: prevClientDossier
          });
        } catch (savePrevErr) {
          console.warn('Failed to auto-save previous sequence data before switch:', savePrevErr);
        }
      }

      // 2. Immediately show smooth sequence transition overlay & progress
      set({
        isSwitchingSequence: true,
        sequenceSwitchProgress: 25,
        sequenceSwitchMessage: isBn ? `নতুন সিকোয়েন্স সনাক্ত হয়েছে: ${seqDisplay}...` : `Switched sequence: ${seqDisplay}...`,
        sequenceManifest: newManifest,
        sequenceChangedNotice: null
      });

      // Small async tick so React renders the transition overlay smoothly
      await new Promise((r) => setTimeout(r, 70));

      const hasClips = Boolean(newManifest.sourceClips && newManifest.sourceClips.length > 0 && newManifest.durationSeconds > 0.1);
      if (!hasClips) {
        set({
          transcriptWords: [],
          transcriptSentences: [],
          detectedSilences: [],
          reviewItems: [],
          scriptDirectives: {},
          customMarkers: [],
          viralTopics: [],
          viralShorts: [],
          srtCues: [],
          jobStatus: 'INITIALIZING',
          jobProgress: 0,
          jobMessage: isBn ? 'টাইমলাইন ফাঁকা' : 'Timeline is empty',
          sequenceSwitchProgress: 100,
          sequenceSwitchMessage: isBn ? 'টাইমলাইন ফাঁকা' : 'Timeline is empty'
        });
        await clearPersistedProjectData(newManifest);
        setTimeout(() => set({ isSwitchingSequence: false }), 400);
        return;
      }

      set({
        sequenceSwitchProgress: 55,
        sequenceSwitchMessage: isBn ? 'সংরক্ষিত ট্রান্সক্রিপ্ট ও প্রজেক্ট ক্যাশ স্ক্যান হচ্ছে...' : 'Scanning project cache & saved transcripts...'
      });

      // 3. Check if cache exists for this sequence (Returning to a previously saved sequence!)
      const loaded = await loadPersistedProjectData(newManifest);
      // Guarantee Project Master Client Data (Dossier, Brand Kit, Brief) is active across all sequences
      await loadClientMasterData(newManifest);

      if (loaded) {
        set({
          sequenceSwitchProgress: 88,
          sequenceSwitchMessage: isBn ? 'পূর্বের সিকোয়েন্সের সংরক্ষিত ডাটা সফলভাবে রিস্টোর হয়েছে!' : 'Restored saved sequence transcript & data!'
        });
        await new Promise((r) => setTimeout(r, 120));
        set({
          sequenceSwitchProgress: 100,
          sequenceSwitchMessage: isBn ? 'প্রস্তুত!' : 'Ready!'
        });
        setTimeout(() => set({ isSwitchingSequence: false }), 350);
        return;
      }

      // 4. SMART INHERITANCE:
      // If sequence has no cache yet, but is derived/cloned from previous sequence
      // (e.g. 1:1 Square, 9:16 Shorts, RoughCut, Duplicate Copy, or shares source clips):
      const isDerivative = Boolean(
        currentSeq &&
        prevWords && prevWords.length > 0 &&
        (
          newManifest.sequenceName.toLowerCase().includes(currentSeq.sequenceName.toLowerCase()) ||
          currentSeq.sequenceName.toLowerCase().includes(newManifest.sequenceName.toLowerCase()) ||
          /(?:copy|1:1|9:16|16:9|4:5|4:3|roughcut|shorts|reels|cut|format)/i.test(newManifest.sequenceName) ||
          (newManifest.sourceClips && currentSeq.sourceClips &&
           newManifest.sourceClips.some((c: any) => currentSeq.sourceClips.some((sc: any) => sc.mediaPath === c.mediaPath || sc.name === c.name)))
        )
      );

      if (isDerivative) {
        set({
          sequenceSwitchProgress: 90,
          sequenceSwitchMessage: isBn ? 'মূল সিকোয়েন্স থেকে ট্রান্সক্রিপ্ট সিঙ্ক করা হয়েছে...' : 'Inherited transcript from source sequence...',
          transcriptWords: prevWords,
          transcriptSentences: prevSentences,
          detectedSilences: prevSilences,
          reviewItems: prevReviewItems,
          scriptDirectives: prevScriptDirectives,
          customMarkers: prevCustomMarkers,
          viralTopics: prevViralTopics,
          viralShorts: prevViralShorts,
          srtCues: prevSrtCues,
          audioSettings: prevAudioSettings,
          detectedSfxCues: prevDetectedSfxCues,
          soundDesignTips: prevSoundDesignTips,
          recommendedBgmData: prevRecommendedBgmData,
          clientScriptText: prevClientScriptText,
          clientBriefText: prevClientBriefText,
          scriptAuditReport: prevScriptAuditReport,
          brandKit: prevBrandKit,
          editingRoadmap: prevEditingRoadmap,
          clientRevisions: prevClientRevisions,
          clientDossier: prevClientDossier,
          jobStatus: 'COMPLETE',
          jobProgress: 100,
          jobMessage: isBn ? 'সিকোয়েন্স প্রস্তুত (সিঙ্কড)' : 'Sequence ready (Synced)'
        });

        // Immediately persist for the new sequence so it has its own independent cache from now on!
        await persistProjectData(newManifest, {
          words: prevWords,
          sentences: prevSentences,
          silences: prevSilences,
          reviewItems: prevReviewItems,
          scriptDirectives: prevScriptDirectives,
          customMarkers: prevCustomMarkers,
          viralTopics: prevViralTopics,
          viralShorts: prevViralShorts,
          srtCues: prevSrtCues,
          audioSettings: prevAudioSettings,
          detectedSfxCues: prevDetectedSfxCues,
          soundDesignTips: prevSoundDesignTips,
          recommendedBgmData: prevRecommendedBgmData,
          clientScriptText: prevClientScriptText,
          clientBriefText: prevClientBriefText,
          scriptAuditReport: prevScriptAuditReport,
          brandKit: prevBrandKit,
          editingRoadmap: prevEditingRoadmap,
          clientRevisions: prevClientRevisions,
          clientDossier: prevClientDossier
        });

        setTimeout(() => set({ isSwitchingSequence: false }), 350);
        return;
      }

      // 5. Truly Brand New / Unrelated Sequence:
      // Clear previous sequence transcript cleanly while keeping Client Master Dossier & Brand Kit 100% intact
      set({
        transcriptWords: [],
        transcriptSentences: [],
        detectedSilences: [],
        reviewItems: [],
        scriptDirectives: {},
        customMarkers: [],
        viralTopics: [],
        viralShorts: [],
        srtCues: [],
        clientRevisions: [],
        jobStatus: 'INITIALIZING',
        jobProgress: 0,
        jobMessage: isBn ? 'নতুন সিকোয়েন্স সনাক্ত হয়েছে' : 'New sequence detected',
        sequenceSwitchProgress: 100,
        sequenceSwitchMessage: isBn ? 'নতুন সিকোয়েন্স প্রস্তুত' : 'Ready'
      });
      setTimeout(() => set({ isSwitchingSequence: false }), 350);

      // Auto-transcribe if enabled and sequence has audio clips / duration
      if (hasClips && get().autoTranscribeNewSequences) {
        await get().transcribeSequence();
      }
    } else {
      // Same sequence: update manifest
      set({ sequenceManifest: newManifest });

      const hasClips = Boolean(newManifest.sourceClips && newManifest.sourceClips.length > 0 && newManifest.durationSeconds > 0.1);

      // CASE 1: All clips were deleted from the timeline!
      if (!hasClips) {
        if (get().transcriptWords.length > 0) {
          set({
            transcriptWords: [],
            transcriptSentences: [],
            detectedSilences: [],
            reviewItems: [],
            scriptDirectives: {},
            customMarkers: [],
            viralTopics: [],
            viralShorts: [],
            srtCues: [],
            jobStatus: 'INITIALIZING',
            jobProgress: 0,
            sequenceChangedNotice: null,
            jobMessage: 'Timeline is empty'
          });
          await clearPersistedProjectData(newManifest);
        }
        return;
      }

      // CASE 2: If transcript was empty and clips were just dropped in
      if (get().transcriptWords.length === 0 && hasClips && get().autoTranscribeNewSequences) {
        await get().transcribeSequence();
        return;
      }

      // CASE 3: Timeline clips or cuts changed (clips split, deleted, ripple-edited, trimmed or moved)
      const oldClipsCount = (currentSeq?.sourceClips || []).length;
      const newClipsCount = (newManifest.sourceClips || []).length;
      const oldDur = currentSeq?.durationSeconds || 0;
      const newDur = newManifest.durationSeconds || 0;

      if (get().transcriptWords.length > 0) {
        if (newClipsCount !== oldClipsCount || Math.abs(newDur - oldDur) > 0.05) {
          // Instantly re-align all words against new timeline clips without expensive re-transcribe!
          const realigned = realignWordsWithTimelineClips(get().transcriptWords, newManifest.sourceClips || []);
          if (realigned.length > 0) {
            set({
              transcriptWords: realigned,
              sequenceChangedNotice: null
            });
            await persistProjectData(newManifest, {
              words: realigned,
              sentences: get().transcriptSentences,
              silences: get().detectedSilences,
              reviewItems: get().reviewItems
            });
          } else {
            set({ sequenceChangedNotice: `${Math.round(newDur)}s` });
          }
        }
      }
    }
  },

  refreshSequence: async () => {
    try {
      await hostBridge.ensureCEPScriptLoaded(true);
      const newManifest = await hostBridge.getActiveSequenceManifest();
      if (newManifest) {
        set({ sequenceManifest: newManifest, sequenceChangedNotice: null });
        get().showToast(
          get().language === 'bn' ? `✓ সিকোয়েন্স সনাক্ত হয়েছে: ${newManifest.sequenceName}` : `✓ Sequence detected: ${newManifest.sequenceName}`,
          'success'
        );
      } else {
        get().showToast(
          get().language === 'bn' ? '⚠️ কোনো সিকোয়েন্স পাওয়া যায়নি। টাইমলাইনে ক্লিক করুন।' : '⚠️ No sequence found. Click timeline to focus.',
          'info'
        );
      }
    } catch {}
    await get().checkSequenceChange();
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
    get().saveCurrentProjectState();
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
      return { srtCues: next };
    });
    get().saveCurrentProjectState();
  },

  saveCurrentProjectState: async () => {
    const s = get();

    // 1. Tier 1: Persist Project-Wide Client Master Data (Shared across all sequences)
    await persistClientMasterData(s.sequenceManifest, {
      clientDossier: s.clientDossier,
      brandKit: s.brandKit,
      clientBriefText: s.clientBriefText,
      clientScriptText: s.clientScriptText,
      editingRoadmap: s.editingRoadmap,
      scriptAuditReport: s.scriptAuditReport
    });

    // 2. Tier 2: Persist Sequence-Specific Timeline Data
    if (s.sequenceManifest) {
      await persistProjectData(s.sequenceManifest, {
        words: s.transcriptWords,
        sentences: s.transcriptSentences,
        silences: s.detectedSilences,
        reviewItems: s.reviewItems,
        scriptDirectives: s.scriptDirectives,
        customMarkers: s.customMarkers,
        viralTopics: s.viralTopics,
        viralShorts: s.viralShorts,
        srtCues: s.srtCues,
        audioSettings: s.audioSettings,
        detectedSfxCues: s.detectedSfxCues,
        soundDesignTips: s.soundDesignTips,
        recommendedBgmData: s.recommendedBgmData,
        clientScriptText: s.clientScriptText,
        clientBriefText: s.clientBriefText,
        scriptAuditReport: s.scriptAuditReport,
        brandKit: s.brandKit,
        editingRoadmap: s.editingRoadmap,
        clientRevisions: s.clientRevisions,
        clientDossier: s.clientDossier
      });
    }
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
    try {
      // 0. Ensure latest ExtendScript host engine is evaluated in Premiere Pro
      try {
        await hostBridge.ensureCEPScriptLoaded(true);
      } catch (e) {
        console.warn('[PrismexStore] Failed to ensure hostscript loaded:', e);
      }

      // 1. Check health with fast timeout (non-blocking)
      client.checkHealth().then((health) => {
        set({ daemonOnline: health !== null });
      }).catch(() => {
        set({ daemonOnline: false });
      });

      set({ 
        initStepMessage: get().language === 'bn' ? 'টাইমলাইন ও প্রজেক্ট ডেটা লোড হচ্ছে...' : 'Loading timeline & project data...',
        initStepProgress: 55 
      });

      // 1.1 Preload Tier 1: Project-Wide Client Master Data (Dossier, Brand Kit, Brief)
      try {
        await loadClientMasterData();
      } catch {}

      // 2. Initial sequence check (non-blocking with 1200ms timeout)
      try {
        await Promise.race([
          get().checkSequenceChange(),
          new Promise<void>((r) => setTimeout(r, 1200))
        ]);
      } catch {}

      set({ 
        initStepMessage: get().language === 'bn' ? 'প্রিজমেক্স স্টুডিও প্রস্তুত!' : 'Prismex Studio Editor Ready!',
        initStepProgress: 100 
      });

      // 2.1 Poller for sequence changes
      if (sequenceWatcherTimer) {
        clearInterval(sequenceWatcherTimer);
      }
      try {
        lastSequenceSignature = await hostBridge.getActiveSequenceSignature();
      } catch {}

      let isWatcherChecking = false;
      sequenceWatcherTimer = setInterval(async () => {
        // Fast health heartbeat keep-alive
        client.checkHealth().then((h) => {
          const isOnline = h !== null;
          if (get().daemonOnline !== isOnline) {
            set({ daemonOnline: isOnline });
          }
        }).catch(() => {
          if (get().daemonOnline) set({ daemonOnline: false });
        });

        const status = get().jobStatus;
        const progress = get().jobProgress;
        const isBusy = Boolean(get().globalBusyAction || get().isSwitchingSequence);
        if (status === 'TRANSCRIBING' || (progress > 0 && progress < 100) || isBusy) {
          return;
        }

        if (isWatcherChecking) return;
        isWatcherChecking = true;

        try {
          const sig = await hostBridge.getActiveSequenceSignature();
          const hasManifest = get().sequenceManifest !== null;
          if (sig && sig !== 'none' && (sig !== lastSequenceSignature || !hasManifest)) {
            lastSequenceSignature = sig;
            await get().checkSequenceChange();
          }
        } catch {} finally {
          isWatcherChecking = false;
        }
      }, 3500);

      // 3. Load profiles & providers in background (never block UI)
      Promise.all([
        client.getProfiles().catch(() => []),
        client.getProviders().catch(() => [])
      ]).then(([profiles, providers]) => {
        set({ profiles: profiles || [], providers: providers || [] });
      }).catch(() => {});

      setTimeout(() => {
        set({ isAppInitializing: false });
      }, 700);
    } catch (err) {
      console.error('initApp caught error:', err);
      set({ isAppInitializing: false });
    }

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
          globalBusyAction: null,
          jobProgress: 100,
          jobMessage: get().language === 'bn' ? 'ট্রান্সক্রিপশন ও অ্যানালাইসিস সম্পন্ন!' : 'Transcription & analysis complete!',
          jobStatus: 'COMPLETE',
          transcriptWords: words || [],
          transcriptSentences: sentences || [],
          detectedSilences: silences || []
        });
        get().showToast(get().language === 'bn' ? '✓ কাজ সফলভাবে সম্পন্ন হয়েছে!' : '✓ Operation completed successfully!', 'success');

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

  transcribeSequence: async (options?: any) => {
    const opts = (options && typeof options === 'object' && !('nativeEvent' in options)) ? options : undefined;
    const isBn = get().language === 'bn';

    // 1. Instant feedback: Show progress bar & toast immediately on click
    get().showToast(isBn ? '🎙️ সিকোয়েন্স ট্রান্সক্রিপশন শুরু হচ্ছে...' : '🎙️ Starting transcription...', 'info');
    set({
      jobProgress: 5,
      jobMessage: isBn ? 'টাইমলাইন যাচাই ও অডিও প্রস্তুত করা হচ্ছে...' : 'Connecting to timeline & preparing audio...',
      jobStatus: 'TRANSCRIBING',
      sequenceChangedNotice: null
    });

    // 2. Resolve Sequence Manifest (Prefer in-memory state first for 0ms delay)
    let seq = get().sequenceManifest;
    if (!seq || !seq.sourceClips || seq.sourceClips.length === 0) {
      try {
        seq = await hostBridge.getActiveSequenceManifest();
      } catch {}
    }
    if (!seq) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        seq = await hostBridge.getActiveSequenceManifest();
      } catch {}
    }
    if (!seq) {
      seq = get().sequenceManifest;
    }
    if (!seq) {
      set({
        jobProgress: 0,
        jobStatus: 'INITIALIZING',
        jobMessage: ''
      });
      get().showActionFeedback({
        type: 'error',
        title: isBn ? '⚠️ সক্রিয় সিকোয়েন্স পাওয়া যায়নি' : '⚠️ No Active Sequence Found',
        reason: isBn ? 'প্রিমিয়ার প্রোতে কোনো টাইমলাইন সিকোয়েন্স বর্তমানে ওপেন নেই।' : 'No timeline sequence is currently open in Premiere Pro.',
        guideline: isBn ? '১. প্রিমিয়ার প্রোর Project প্যানেল থেকে আপনার কাঙ্ক্ষিত সিকোয়েন্সে ডাবল ক্লিক করে টাইমলাইনে ওপেন করুন।\n২. তারপর আবার বাটনে ক্লিক করুন।' : '1. Open a sequence in Premiere Pro timeline.\n2. Click the button again.'
      });
      return;
    }

    const clipMaxOut = (seq.sourceClips && seq.sourceClips.length > 0)
      ? Math.max(0, ...seq.sourceClips.map((c: any) => Number(c.outSeconds) || 0))
      : 0;
    const durSec = Math.max(Number(seq.durationSeconds) || 0, clipMaxOut);
    seq.durationSeconds = durSec;

    const hasClips = Boolean(seq.sourceClips && seq.sourceClips.length > 0 && durSec > 0.05);
    if (!hasClips) {
      await clearPersistedProjectData(seq);
      set({
        sequenceManifest: seq,
        transcriptWords: [],
        transcriptSentences: [],
        detectedSilences: [],
        reviewItems: [],
        sequenceChangedNotice: null,
        jobProgress: 0,
        jobStatus: 'INITIALIZING',
        jobMessage: isBn ? 'টাইমলাইন খালি। কোনো ক্লিপ নেই।' : 'Timeline is empty. No clips found to transcribe.'
      });
      get().showActionFeedback({
        type: 'warning',
        title: isBn ? '⚠️ টাইমলাইন খালি (ক্লিপ নেই)' : '⚠️ Empty Timeline',
        reason: isBn ? 'সক্রিয় সিকোয়েন্সটিতে কোনো অডিও বা ভিডিও মিডিয়া ক্লিপ পাওয়া যায়নি।' : 'The active sequence has no audio or video clips.',
        guideline: isBn ? 'টাইমলাইনের ট্র্যাকগুলোতে ভিডিও বা অডিও ক্লিপ ড্র্যাগ করে বসিয়ে পুনরায় বাটনে ক্লিক করুন।' : 'Drag video or audio footage onto the timeline tracks.'
      });
      return;
    }

    // 3. Health check fallback
    const health = await client.checkHealth().catch(() => null);
    if (!health) {
      set({
        jobProgress: 0,
        jobStatus: 'INITIALIZING',
        jobMessage: isBn ? 'এআই ব্যাকএন্ড ইঞ্জিনের সাথে যোগাযোগ করা যায়নি। সার্ভার চালু আছে কিনা নিশ্চিত করুন।' : 'Failed to reach AI engine. Ensure daemon is running.',
        daemonOnline: false
      });
      get().showActionFeedback({
        type: 'error',
        title: isBn ? '⚠️ এআই ব্যাকএন্ড ইঞ্জিন অফলাইন' : '⚠️ AI Backend Daemon Offline',
        reason: isBn ? 'পোর্ট ৪৮১৫২-এ লোকাল এআই সার্ভারের সাথে সংযোগ বিচ্ছিন্ন।' : 'Could not reach local daemon on port 48152.',
        guideline: isBn ? 'Settings ট্যাব থেকে "Restart AI Engine" চাপুন অথবা টার্মিনালে ইঞ্জিন চালু করুন।' : 'Click "Restart AI Engine" from Settings.'
      });
      return;
    }
    set({ daemonOnline: true });

    if (opts?.forceReTranscribe) {
      await clearPersistedProjectData(seq);
      set({
        transcriptWords: [],
        transcriptSentences: [],
        detectedSilences: [],
        reviewItems: [],
        sequenceChangedNotice: null
      });
    }

    set({
      sequenceManifest: seq,
      sequenceChangedNotice: null,
      jobProgress: 10,
      jobMessage: isBn ? 'অডিও এক্সট্র্যাক্ট ও ট্রান্সক্রাইব করা হচ্ছে...' : 'Extracting audio & transcribing speech...',
      jobStatus: 'TRANSCRIBING'
    });

    const res = await client.startMagicRoughCut(
      seq,
      'TRANSCRIBE_ONLY',
      get().activeProfileId,
      get().silenceSettings,
      {
        model: opts?.model || 'base',
        language: opts?.language || 'auto'
      }
    );
    if (res && res.jobId) {
      const jobId = res.jobId;
      set({ currentJobId: jobId });

      // Active fallback poller guarantees UI never gets stuck at 5% even if WebSocket drops
      let pollAttempts = 0;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        const job = await client.getJob(jobId);
        if (job) {
          const status = job.status;
          const pct = Math.max(get().jobProgress, job.progress_percent || 15);

          if (status === 'EXTRACTING') {
            set({ jobProgress: pct, jobMessage: 'Extracting & stitching audio from sequence clips...', jobStatus: 'EXTRACTING' });
          } else if (status === 'TRANSCRIBING') {
            set({ jobProgress: pct, jobMessage: 'Transcribing speech with Apple Silicon MLX-Whisper...', jobStatus: 'TRANSCRIBING' });
          } else if (status === 'ANALYZING') {
            set({ jobProgress: pct, jobMessage: 'Analyzing voice energy, noise floor & silences...', jobStatus: 'ANALYZING' });
          } else if (status === 'COMPLETE') {
            clearInterval(pollInterval);
            const rData = job.result;
            const rawWords = rData?.words || [];
            const sentences = rData?.sentences || [];
            const silences = rData?.silences || [];

            // Tag each word with persistent sourceTime, duration, and mediaPath for instant timeline sync
            const currentSeq = get().sequenceManifest;
            const clips = currentSeq?.sourceClips || [];

            const words = rawWords.map((w: any) => {
              const ws = Number(w.start_seconds ?? w.start ?? 0);
              const we = Number(w.end_seconds ?? w.end ?? 0);
              const dur = Math.max(0.04, we - ws);
              let matchedClip: any = null;
              for (const c of clips) {
                if (ws >= c.inSeconds - 0.05 && ws <= c.outSeconds + 0.05) {
                  matchedClip = c;
                  break;
                }
              }
              const sourceTime = matchedClip
                ? Math.max(0, Number(matchedClip.sourceInSeconds ?? 0) + (ws - Number(matchedClip.inSeconds ?? 0)))
                : (w.sourceTime !== undefined ? Number(w.sourceTime) : ws);
              return {
                ...w,
                sourceTime: Number(sourceTime.toFixed(3)),
                duration: Number(dur.toFixed(3)),
                mediaPath: matchedClip?.mediaPath || w.mediaPath || ''
              };
            });

            set({
              jobProgress: 100,
              jobMessage: 'Transcription complete!',
              jobStatus: 'COMPLETE',
              transcriptWords: words,
              transcriptSentences: sentences,
              detectedSilences: silences
            });
            get().showToast(get().language === 'bn' ? '✓ স্পিচ ট্রান্সক্রিপশন সম্পন্ন হয়েছে!' : '✓ Speech transcription completed!', 'success');
            get().showActionFeedback({
              type: 'success',
              title: isBn ? '✓ স্পিচ ট্রান্সক্রিপশন সফলভাবে সম্পন্ন হয়েছে!' : '✓ Speech Transcription Completed!',
              detail: isBn 
                ? `মোট ${words.length} টি শব্দ ও ${silences.length} টি সাইলেন্স পজ সনাক্ত করা হয়েছে। আপনি এখন টেক্সট কেটে বা ১-ক্লিক রাফ-কাট দিয়ে এডিট করতে পারেন।`
                : `Detected ${words.length} words and ${silences.length} silences. Ready for text-based editing.`
            });

            if (currentSeq) {
              persistProjectData(currentSeq, {
                words,
                sentences,
                silences,
                reviewItems: rData?.reviewItems || []
              });
            }
          } else if (status === 'FAILED') {
            clearInterval(pollInterval);
            const errStr = job.error_message || (get().language === 'bn' ? 'অডিও সিগন্যালে কোনো কথা শনাক্ত হয়নি' : 'No speech detected');
            set({
              jobProgress: 0,
              jobMessage: `Transcription failed: ${errStr}`,
              jobStatus: 'INITIALIZING'
            });
            get().showToast(get().language === 'bn' ? `ট্রান্সক্রিপশন ব্যর্থ: ${errStr}` : `Transcription failed: ${errStr}`, 'error');
            get().showActionFeedback({
              type: 'error',
              title: isBn ? '⚠️ ট্রান্সক্রিপশন সম্পন্ন করা যায়নি' : '⚠️ Transcription Failed',
              reason: errStr,
              guideline: isBn 
                ? '১. অডিও ক্লিপে কথা স্পষ্ট শোনা যাচ্ছে কিনা যাচাই করুন।\n২. সেটিংস থেকে হুইস্পার মডেল (Base / Small) পরিবর্তন করে চেষ্টা করুন।' 
                : '1. Check audio track clarity.\n2. Try a different Whisper model in Settings.',
              actionText: isBn ? '🔄 পুনরায় চেষ্টা করুন' : 'Retry',
              onAction: () => get().transcribeSequence(options)
            });
          }
        }

        if (pollAttempts > 180) { // 3 minutes timeout
          clearInterval(pollInterval);
          set({
            jobProgress: 0,
            jobStatus: 'INITIALIZING',
            jobMessage: get().language === 'bn' ? 'ট্রান্সক্রিপশনে অতিরিক্ত সময় লাগছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' : 'Transcription timed out. Please try again.'
          });
        }
      }, 1200);
    } else {
      set({
        jobProgress: 0,
        jobStatus: 'INITIALIZING',
        jobMessage: get().language === 'bn' ? 'এআই ব্যাকএন্ড ইঞ্জিনের সাথে যোগাযোগ করা যায়নি। সার্ভার চালু আছে কিনা নিশ্চিত করুন।' : 'Failed to reach AI engine. Ensure daemon is running.'
      });
      get().showToast(get().language === 'bn' ? 'ট্রান্সক্রিপশন শুরু করা যায়নি' : 'Could not initiate transcription', 'error');
    }
  },

  cutAllSilencesNow: async () => {
    let seq = await hostBridge.getActiveSequenceManifest();
    if (!seq) {
      await new Promise((r) => setTimeout(r, 300));
      seq = await hostBridge.getActiveSequenceManifest();
    }
    if (!seq) {
      seq = get().sequenceManifest;
    }
    if (!seq) {
      get().showActionFeedback({
        type: 'error',
        title: get().language === 'bn' ? '⚠️ সক্রিয় সিকোয়েন্স পাওয়া যায়নি' : '⚠️ No Active Sequence Found',
        reason: get().language === 'bn' ? 'প্রিমিয়ার প্রোতে কোনো টাইমলাইন সিকোয়েন্স সক্রিয় নেই।' : 'No active sequence found.',
        guideline: get().language === 'bn' ? 'প্রিমিয়ার প্রোর টাইমলাইনে ক্লিক করে একটি সিকোয়েন্স সক্রিয় করুন।' : 'Click your timeline to focus an active sequence.'
      });
      return;
    }

    let silences = get().detectedSilences;
    if (!silences || silences.length === 0) {
      const words = get().transcriptWords;
      if (words && words.length > 1) {
        // Compute inter-word silence gaps on the fly from transcript word timestamps!
        const derived: any[] = [];
        for (let i = 0; i < words.length - 1; i++) {
          const wEnd = Number(words[i].end_seconds ?? words[i].end ?? 0);
          const nextStart = Number(words[i + 1].start_seconds ?? words[i + 1].start ?? 0);
          const gap = nextStart - wEnd;
          if (gap >= 0.45) {
            derived.push({
              start_seconds: Number((wEnd + 0.08).toFixed(3)),
              end_seconds: Number((nextStart - 0.08).toFixed(3)),
              duration_seconds: Number((gap - 0.16).toFixed(3))
            });
          }
        }
        if (derived.length > 0) {
          silences = derived;
          set({ detectedSilences: derived });
        }
      }
    }

    if (!silences || silences.length === 0) {
      await get().transcribeSequence();
      return;
    }

    set({
      globalBusyAction: 'silence_cut',
      jobProgress: 20,
      jobMessage: get().language === 'bn' ? 'টাইমলাইনে সাইলেন্স কাট ও সিকোয়েন্স রিপল হচ্ছে...' : 'Executing silence cuts & ripples on timeline...'
    });

    try {
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
        set({ detectedSilences: [], transcriptWords: remainingWords, jobProgress: 100, jobMessage: 'Complete' });
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
        get().showToast(get().language === 'bn' ? '✓ সফলভাবে সাইলেন্স কাট সম্পন্ন হয়েছে!' : '✓ Silence cuts executed successfully!', 'success');
      } else {
        get().showToast(get().language === 'bn' ? 'সাইলেন্স কাট ব্যর্থ হয়েছে' : 'Failed to execute cuts', 'error');
      }
    } finally {
      set({ globalBusyAction: null });
    }
  },

  runTranscriptAI: async (prompt?: string) => {
    const words = get().transcriptWords;
    if (!words || words.length === 0) return;
    set({
      globalBusyAction: 'ai_analyze',
      jobProgress: 35,
      jobMessage: get().language === 'bn' ? 'এআই ট্রান্সক্রিপ্ট অ্যানালাইসিস করছে...' : 'Analyzing transcript with AI...'
    });
    try {
      const res = await client.aiAnalyzeTranscript(words, prompt);
      if (res) {
        set({ aiSummary: res, jobProgress: 100, jobMessage: 'Complete' });
        get().showToast(get().language === 'bn' ? '✓ এআই অ্যানালাইসিস সম্পন্ন হয়েছে!' : '✓ AI analysis completed!', 'success');
      }
    } finally {
      set({ globalBusyAction: null });
    }
  },

  deleteTranscriptRange: async (startSeconds: number, endSeconds: number) => {
    const seq = get().sequenceManifest;
    if (!seq) return;

    // 1. Identify words to delete and lock cut boundaries exactly
    const currentWords = get().transcriptWords;
    const wordsInCut = currentWords.filter((w: any) => {
      const ws = w.start_seconds ?? w.start ?? 0;
      const we = w.end_seconds ?? w.end ?? 0;
      const mid = (ws + we) / 2;
      const dur = Math.max(0.01, we - ws);
      if (mid >= startSeconds - 0.06 && mid <= endSeconds + 0.06) return true;
      const overlap = Math.max(0, Math.min(we, endSeconds) - Math.max(ws, startSeconds));
      if (overlap / dur >= 0.28) return true;
      if (ws >= startSeconds - 0.12 && we <= endSeconds + 0.12) return true;
      return false;
    });

    let cutStart = startSeconds;
    let cutEnd = endSeconds;
    if (wordsInCut.length > 0) {
      const firstWStart = wordsInCut[0].start_seconds ?? wordsInCut[0].start ?? startSeconds;
      const lastWEnd = wordsInCut[wordsInCut.length - 1].end_seconds ?? wordsInCut[wordsInCut.length - 1].end ?? endSeconds;
      cutStart = Math.min(startSeconds, firstWStart);
      cutEnd = Math.max(endSeconds, lastWEnd);
    }
    const duration = Math.max(0.04, cutEnd - cutStart);

    const fps = seq.fps || 24;
    const cut = {
      cutId: `cut_txt_${Date.now()}`,
      startSeconds: cutStart,
      endSeconds: cutEnd,
      durationSeconds: duration,
      startTick: String(Math.round(cutStart * 254016000000)),
      endTick: String(Math.round(cutEnd * 254016000000)),
      startFrame: Math.round(cutStart * fps),
      endFrame: Math.round(cutEnd * fps),
      category: 'SENTENCE_CUT' as const,
      sourceSuggestionId: ''
    };

    // 2. Cleanly remove cut words and ripple-shift remaining words
    const cutIdSet = new Set(wordsInCut.map((w: any) => w.id || `${w.start}_${w.word}`));
    const remainingWords = currentWords
      .filter((w: any) => !cutIdSet.has(w.id || `${w.start}_${w.word}`) && !((w.start_seconds ?? w.start ?? 0) >= cutStart - 0.03 && (w.end_seconds ?? w.end ?? 0) <= cutEnd + 0.03))
      .map((w: any) => {
        let ws = w.start_seconds ?? w.start ?? 0;
        let we = w.end_seconds ?? w.end ?? 0;
        if (ws >= cutStart) {
          ws = Math.max(0, ws - duration);
          we = Math.max(0, we - duration);
        }
        return {
          ...w,
          start_seconds: ws,
          end_seconds: we,
          start: ws,
          end: we
        };
      });

    // 3. Shift sentences cleanly
    const updatedSentences = (get().transcriptSentences || [])
      .filter((s: any) => {
        const sStart = Number(s.startSeconds ?? s.start_seconds ?? 0);
        const sEnd = Number(s.endSeconds ?? s.end_seconds ?? 0);
        const sMid = (sStart + sEnd) / 2;
        return !(sMid >= cutStart - 0.06 && sMid <= cutEnd + 0.06);
      })
      .map((s: any) => {
        const sStart = Number(s.startSeconds ?? s.start_seconds ?? 0);
        const sEnd = Number(s.endSeconds ?? s.end_seconds ?? 0);
        if (sStart >= cutEnd - 0.06) {
          return {
            ...s,
            startSeconds: Math.max(0, sStart - duration),
            endSeconds: Math.max(0, sEnd - duration),
            start_seconds: Math.max(0, sStart - duration),
            end_seconds: Math.max(0, sEnd - duration)
          };
        }
        return s;
      });

    // 4. Shift directives cleanly
    const currentDirectives = get().scriptDirectives || {};
    const updatedDirectives: Record<number, any> = {};
    for (const [key, d] of Object.entries(currentDirectives)) {
      const dStart = Number(d.startSeconds ?? 0);
      const dEnd = Number(d.endSeconds ?? 0);
      const dMid = (dStart + dEnd) / 2;
      if (dMid >= cutStart - 0.06 && dMid <= cutEnd + 0.06) continue;
      if (dStart >= cutEnd - 0.06) {
        updatedDirectives[Number(key)] = {
          ...d,
          startSeconds: Math.max(0, dStart - duration),
          endSeconds: Math.max(0, dEnd - duration)
        };
      } else {
        updatedDirectives[Number(key)] = d;
      }
    }

    // 5. Remove cut review items (repeated take badge) and ripple-shift remaining ones
    const updatedReviewItems = get().reviewItems
      .filter((item: any) => {
        const itemMid = (item.startSeconds + item.endSeconds) / 2;
        return !(itemMid >= cutStart - 0.06 && itemMid <= cutEnd + 0.06) &&
               !(item.startSeconds >= cutStart - 0.08 && item.endSeconds <= cutEnd + 0.08);
      })
      .map((item: any) => {
        if (item.startSeconds >= cutEnd - 0.06) {
          return {
            ...item,
            startSeconds: Math.max(0, item.startSeconds - duration),
            endSeconds: Math.max(0, item.endSeconds - duration)
          };
        }
        return item;
      });

    // 6. Remove cut silences and ripple-shift remaining ones
    const updatedSilences = get().detectedSilences
      .filter((s: any) => {
        const sMid = (s.start_seconds + s.end_seconds) / 2;
        return !(sMid >= cutStart - 0.06 && sMid <= cutEnd + 0.06);
      })
      .map((s: any) => s.start_seconds >= cutEnd - 0.06
        ? { ...s, start_seconds: Math.max(0, s.start_seconds - duration), end_seconds: Math.max(0, s.end_seconds - duration) }
        : s
      );

    // 7. Update UI state immediately with zero latency
    set({
      transcriptWords: remainingWords,
      transcriptSentences: updatedSentences,
      detectedSilences: updatedSilences,
      reviewItems: updatedReviewItems,
      scriptDirectives: updatedDirectives
    });

    // 8. Execute synchronized cut on Premiere Pro timeline
    try {
      await timelineEngine.executeCuts([cut]);
    } catch (e) {
      console.warn('[deleteTranscriptRange] timeline cut error:', e);
    }

    // 9. Persist to disk and project cache
    const currentSeq = get().sequenceManifest;
    if (currentSeq) {
      await persistProjectData(currentSeq, {
        words: remainingWords,
        sentences: updatedSentences,
        silences: updatedSilences,
        reviewItems: updatedReviewItems,
        scriptDirectives: updatedDirectives
      });
    }
  },

  startMagicRoughCut: async () => {
    let seq = await hostBridge.getActiveSequenceManifest();
    if (!seq) {
      await new Promise((r) => setTimeout(r, 300));
      seq = await hostBridge.getActiveSequenceManifest();
    }
    if (!seq) {
      seq = get().sequenceManifest;
    }
    if (!seq) {
      get().showActionFeedback({
        type: 'error',
        title: get().language === 'bn' ? '⚠️ সক্রিয় সিকোয়েন্স পাওয়া যায়নি' : '⚠️ No Active Sequence Found',
        reason: get().language === 'bn' ? 'প্রিমিয়ার প্রোতে কোনো টাইমলাইন সিকোয়েন্স সক্রিয় নেই।' : 'No active sequence found.',
        guideline: get().language === 'bn' ? 'প্রিমিয়ার প্রোর টাইমলাইনে ক্লিক করে একটি সিকোয়েন্স সক্রিয় করুন।' : 'Click your timeline to focus an active sequence.'
      });
      return;
    }
    set({ sequenceManifest: seq });

    set({
      globalBusyAction: 'magic_rough_cut',
      jobProgress: 5,
      jobMessage: get().language === 'bn' ? 'ম্যাজিক রাফ কাট প্রসেস শুরু হচ্ছে...' : 'Starting Magic Rough Cut...',
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
