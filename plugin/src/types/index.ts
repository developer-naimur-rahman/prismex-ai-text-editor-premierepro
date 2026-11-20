/**
 * Prismex AI Editor - Complete Domain Type Definitions
 * Aligned with Architecture Specifications (docs/16-DATA-MODEL.md & docs/23-API-REFERENCE.md)
 */

export type ExecutionMode = 'TRANSCRIBE_ONLY' | 'AUTO_EDIT' | 'REVIEW_EDIT';

export type SuggestionCategory = 'SILENCE' | 'FILLER_WORD' | 'STUTTER' | 'REPEATED_TAKE' | 'SENTENCE_CUT';

export type ReviewStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';

export type JobStatus = 'INITIALIZING' | 'EXTRACTING' | 'TRANSCRIBING' | 'ANALYZING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';

export interface SourceClipManifest {
  mediaPath: string;
  trackIndex: number;
  inSeconds: number;
  outSeconds: number;
}

export interface SequenceManifest {
  premiereProjectId: string;
  projectPath?: string;
  sequenceGuid: string;
  sequenceName: string;
  cleanSequenceName?: string;
  fps: number;
  sampleRate: number;
  durationSeconds: number;
  durationTicks: string;
  sourceClips: SourceClipManifest[];
}

export interface TranscriptWord {
  id: string;
  word: string;
  startSeconds: number;
  endSeconds: number;
  confidence: number;
  speakerTag?: string;
  isFiller: boolean;
  isStutter: boolean;
  takeGroupId?: string;
}

export interface TranscriptSentence {
  id: string;
  sentence: string;
  startSeconds: number;
  endSeconds: number;
  words: TranscriptWord[];
}

export interface TranscriptParagraph {
  id: string;
  sentences: TranscriptSentence[];
  startSeconds: number;
  endSeconds: number;
  speakerTag?: string;
}

export interface CompleteTranscript {
  id: string;
  sequenceId: string;
  language: string;
  engineUsed: string;
  totalDurationSeconds: number;
  wordsCount: number;
  paragraphs: TranscriptParagraph[];
}

export interface TakeDetails {
  clusterId: string;
  candidateIndex: number;
  totalCandidates: number;
  isRecommended: boolean;
  fluencyScore?: number;
  matched_take?: any;
  matchedTake?: any;
  all_takes?: any[];
  allTakes?: any[];
}

export interface ReviewQueueItem {
  id: string;
  category: SuggestionCategory;
  status: ReviewStatus;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  confidence: number;
  reason: string;
  transcriptSnippet: string;
  takeDetails?: TakeDetails;
  audioPeakDbfs?: number;
}

export interface CutInterval {
  startSeconds: number;
  endSeconds: number;
  startTick: string;
  endTick: string;
}

export interface CutPlan {
  planId: string;
  jobId: string;
  sequenceId: string;
  totalCuts: number;
  totalTimeSavedSeconds: number;
  cuts: CutInterval[];
}

export interface EditingProfile {
  id: string;
  name: string;
  isBuiltIn: boolean;
  silenceThresholdDbfs: number;
  minSilenceDurationMs: number;
  preCutPaddingMs: number;
  postCutPaddingMs: number;
  removeFillers: boolean;
  removeStutters: boolean;
  takeMode: 'LAST_TAKE' | 'BEST_TAKE' | 'MANUAL';
}

export interface ProviderStatusInfo {
  providerId: string;
  name: string;
  modelId: string;
  isLocal: boolean;
  isFreeTier: boolean;
  isConfigured: boolean;
  maskedKey?: string;
  health: 'HEALTHY' | 'ERROR' | 'RATE_LIMITED' | 'UNCONFIGURED' | 'QUOTA_EXHAUSTED' | 'INVALID_KEY' | 'NOT_CONFIGURED';
  requestsToday: number;
  maxRpm: number;
  quotaExhausted?: boolean;
  needsKeyChange?: boolean;
  statusMessage?: string;
}

export interface RoughCutSummaryReport {
  jobId: string;
  originalSequenceName: string;
  clonedSequenceName: string;
  originalDurationSeconds: number;
  roughCutDurationSeconds: number;
  timeSavedSeconds: number;
  percentSaved: number;
  totalCutsApplied: number;
  silencesRemovedCount: number;
  takesPrunedCount: number;
  fillersRemovedCount: number;
  engineUsed: string;
  syncVerified: boolean;
  timestamp: string;
}
