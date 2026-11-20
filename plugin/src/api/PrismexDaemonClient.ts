/**
 * PrismexDaemonClient - Frontend IPC Client for the Local Companion Daemon
 * Specification: docs/03-SYSTEM-ARCHITECTURE.md & docs/23-API-REFERENCE.md
 */

import { 
  SequenceManifest, 
  ExecutionMode, 
  ReviewQueueItem, 
  CutPlan, 
  EditingProfile, 
  ProviderStatusInfo 
} from '../types';

export class PrismexDaemonClient {
  private static instance: PrismexDaemonClient;
  private baseUrl = 'http://127.0.0.1:48152';
  private wsUrl = 'ws://127.0.0.1:48152/ws/events';
  private ws: WebSocket | null = null;
  private eventListeners: Array<(event: any) => void> = [];

  public static getInstance(): PrismexDaemonClient {
    if (!PrismexDaemonClient.instance) {
      PrismexDaemonClient.instance = new PrismexDaemonClient();
    }
    return PrismexDaemonClient.instance;
  }

  /**
   * Health check to detect whether the background companion service is active.
   */
  public async checkHealth(): Promise<{ status: string; memoryUsageMB: number; isAppleSilicon: boolean } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async getProviders(): Promise<ProviderStatusInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/providers`);
      if (res.ok) {
        const data = await res.json();
        return data.providers;
      }
      return [];
    } catch {
      return [];
    }
  }

  public async setProviderKey(providerId: string, apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/providers/${providerId}/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async deleteProviderKey(providerId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/providers/${providerId}/key`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async getProfiles(): Promise<EditingProfile[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/profiles`);
      if (res.ok) {
        const data = await res.json();
        return data.profiles;
      }
      return [];
    } catch {
      return [];
    }
  }

  public async startMagicRoughCut(
    manifest: SequenceManifest, 
    mode: ExecutionMode = 'AUTO_EDIT',
    profileId: string = 'talking-head',
    silenceSettings?: {
      thresholdDbfs: number;
      minDurationMs: number;
      preCutPaddingMs: number;
      postCutPaddingMs: number;
      preserveBreathing: boolean;
    },
    transcribeOptions?: {
      model?: string;
      language?: string;
    }
  ): Promise<{ jobId: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/jobs/magic-rough-cut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premiereProjectId: manifest.premiereProjectId,
          sequenceGuid: manifest.sequenceGuid,
          sequenceName: manifest.sequenceName,
          fps: manifest.fps,
          sampleRate: manifest.sampleRate,
          durationSeconds: manifest.durationSeconds,
          executionMode: mode,
          profileId,
          sourceClips: manifest.sourceClips,
          whisperModel: transcribeOptions?.model || 'base',
          whisperLanguage: transcribeOptions?.language || 'auto',
          ...(silenceSettings ? {
            silenceThresholdDbfs: silenceSettings.thresholdDbfs,
            minSilenceDurationMs: silenceSettings.minDurationMs,
            preCutPaddingMs: silenceSettings.preCutPaddingMs,
            postCutPaddingMs: silenceSettings.postCutPaddingMs,
            preserveBreathing: silenceSettings.preserveBreathing
          } : {})
        })
      });

      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] startMagicRoughCut failed:', err);
      return null;
    }
  }

  public async getJob(jobId: string): Promise<any | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/jobs/${jobId}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async aiAnalyzeTranscript(words: any[], prompt?: string): Promise<{ summary: string; engine: string; wpm?: number; totalWords?: number; fillerCount?: number } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, prompt: prompt || 'Summarize key points and highlight fluff or repeated sections to cut.' })
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] aiAnalyzeTranscript failed:', err);
      return null;
    }
  }

  public async generateSmartSrt(params: {
    words: any[];
    fps: number;
    targetWords: number;
    minWords?: number;
    maxWords?: number;
    targetChars: number;
    maxChars: number;
    flexible: boolean;
    useAi: boolean;
  }): Promise<{ cues: any[]; srt: string; engine: string; fps: number; totalCues: number } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/srt/smart-segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] generateSmartSrt failed:', err);
      return null;
    }
  }

  public async aiSpellCheck(words: any[], language?: string): Promise<{ words: any[]; corrections: number; engine: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/ai-spell-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, language })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] aiSpellCheck failed:', err);
      return null;
    }
  }

  public async aiPolishSentence(words: any[], language?: string): Promise<{ words: any[]; corrections: number; engine: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/ai-polish-sentence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, language })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] aiPolishSentence failed:', err);
      return null;
    }
  }

  public async aiViralShorts(params: {
    words: any[];
    sentences: any[];
    targetCount?: number;
    fps?: number;
  }): Promise<any[] | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/ai-viral-shorts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] aiViralShorts failed:', err);
      return null;
    }
  }

  public async aiMarkers(words: any[]): Promise<{ markers: any[]; total: number } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/ai-markers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] aiMarkers failed:', err);
      return null;
    }
  }

  public async getScriptDirectives(words: any[], sentences: any[], userPrompt?: string): Promise<{ directives: any[]; totalDirectives: number; engine: string; timelineMarkers?: any[] } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/script-directives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, sentences, language: 'bn', userPrompt })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] getScriptDirectives failed:', err);
      return null;
    }
  }

  public async tuneSingleLine(text: string, contextBefore?: string, contextAfter?: string): Promise<any | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/tune-single-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, contextBefore: contextBefore || '', contextAfter: contextAfter || '' })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] tuneSingleLine failed:', err);
      return null;
    }
  }

  public async formatAeTypography(text: string): Promise<{ formattedText: string; lines: string[]; aeSnippet: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/ae-typography`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] formatAeTypography failed:', err);
      return null;
    }
  }

  public async extractTypographyKeywords(sentence: string): Promise<{ original: string; typography: string; keywords: string[] } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transcript/typography-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] extractTypographyKeywords failed:', err);
      return null;
    }
  }

  public async getColorPresets(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/color/presets`);
      if (res.ok) {
        const data = await res.json();
        return data.presets || [];
      }
      return [];
    } catch (err) {
      console.error('[PrismexDaemonClient] getColorPresets failed:', err);
      return [];
    }
  }

  public async gradeFrame(payload: {
    frameBase64?: string;
    framePath?: string;
    referenceBase64?: string;
    stylePreset: string;
    userPrompt?: string;
    intensity: number;
    lockSkinTones: boolean;
    customName?: string;
  }): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/color/grade-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
      const errText = await res.text();
      return { success: false, error: errText };
    } catch (err: any) {
      console.error('[PrismexDaemonClient] gradeFrame failed:', err);
      return { success: false, error: String(err) };
    }
  }

  public async extractFrameFFmpeg(mediaPath: string, seconds: number): Promise<{ success: boolean; frameBase64: string; framePath: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/color/extract-frame-ffmpeg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaPath, seconds })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('[PrismexDaemonClient] extractFrameFFmpeg failed:', err);
      return null;
    }
  }

  public async readImageBase64(filePath: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/color/read-image-base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (res.ok) {
        const data = await res.json();
        return data.base64 || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async generateAiImage(prompt: string, width = 1920, height = 1080, style = 'cinematic'): Promise<{ success: boolean; filePath?: string; base64?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/ai/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width, height, style })
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async getReviewQueue(jobId: string): Promise<ReviewQueueItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/review-queue/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        return data.suggestions.map((s: any) => ({
          id: s.id,
          category: s.category,
          status: s.status,
          startSeconds: s.start_seconds,
          endSeconds: s.end_seconds,
          durationSeconds: s.duration_seconds,
          confidence: s.confidence,
          reason: s.reason,
          transcriptSnippet: s.transcript_snippet,
          takeDetails: s.take_details
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async applyReviewQueue(jobId: string, approvedIds: string[]): Promise<CutPlan | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/review-queue/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedSuggestionIds: approvedIds })
      });
      if (res.ok) {
        const data = await res.json();
        return {
          planId: data.planId,
          jobId: data.jobId,
          sequenceId: data.sequenceId || '',
          totalCuts: data.totalCuts,
          totalTimeSavedSeconds: data.totalTimeSavedSeconds,
          cuts: data.cuts.map((c: any) => ({
            startSeconds: c.start_seconds,
            endSeconds: c.end_seconds,
            startTick: c.start_tick,
            endTick: c.end_tick
          }))
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  public async generateViralShorts(
    words: any[],
    sentences: any[],
    targetCount: number = 5,
    customPrompt?: string,
    fps: number = 24.0
  ): Promise<any[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-viral-shorts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, sentences, targetCount, customPrompt, fps })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return [];
    } catch {
      return [];
    }
  }

  public async refineViralShort(
    short: any,
    instruction: string,
    words: any[],
    fps: number = 24.0
  ): Promise<any | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-viral-shorts/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short, instruction, words, fps })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async translateSentence(text: string, targetLang: string = 'bn'): Promise<string> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/translate-sentence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.translated && data.translated.trim()) {
          return data.translated.trim();
        }
      }
    } catch {}

    // Fallback direct translation
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&q=${encodeURIComponent(text)}`;
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json();
        return (d[0] || []).map((p: any) => p[0]).join('').trim();
      }
    } catch {}

    return '';
  }

  public async searchBrollStock(query: string): Promise<any[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/stock/broll-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return [];
    } catch {
      return [];
    }
  }

  public async parseFeedbackMarkers(feedbackText: string, fps: number = 24.0): Promise<{ success: boolean; count: number; markers: any[] } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/client/parse-feedback-markers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackText, fps })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async downloadAsset(url: string, assetType: string = 'video'): Promise<{ success: boolean; filePath?: string; cached?: boolean; error?: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/stock/download-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, assetType })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async checkForUpdates(): Promise<{
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseDate: string;
    releaseNotes: Array<{ id: string; title: string; description: string; tab: string; badge?: string }>;
    downloadSize: string;
    downloadUrl: string;
  } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/update/check`);
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async downloadAndInstallUpdate(downloadUrl?: string): Promise<{ success: boolean; installedVersion?: string; message?: string; error?: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/update/download-and-install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadUrl })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async restartHostApp(appName: string = 'Adobe Premiere Pro'): Promise<{ success: boolean; message?: string; error?: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/update/restart-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async ensureSfxAssets(): Promise<{ whoosh: string; pop: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/sfx/ensure-assets`, {
        method: 'POST'
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async generateYoutubeChapters(words: any[], sentences: any[], videoTitle?: string): Promise<{ chaptersText: string; chapters: any[] } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-youtube-chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, sentences, videoTitle })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async discoverShortTopics(
    words: any[],
    sentences: any[],
    targetCount: number = 6,
    customPrompt?: string
  ): Promise<any[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-short-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, sentences, targetCount, customPrompt })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return [];
    } catch {
      return [];
    }
  }

  public async getAlternativeHooks(
    short: any,
    words: any[],
    sentences: any[]
  ): Promise<any[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-alternative-hooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short, words, sentences })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return [];
    } catch {
      return [];
    }
  }

  public async getAlternativeCtas(
    short: any,
    words: any[],
    sentences: any[]
  ): Promise<any[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-alternative-ctas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short, words, sentences })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return [];
    } catch {
      return [];
    }
  }

  public async matchClientScript(
    clientScript: string,
    words: any[],
    sentences: any[],
    fps: number = 24.0
  ): Promise<any | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-match-client-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientScript, words, sentences, fps })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async batchScriptToShorts(
    scripts: string,
    words: any[],
    sentences: any[],
    fps: number = 24.0,
    targetCount?: number
  ): Promise<{ success: boolean; count: number; totalParsed: number; shorts: any[] } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/batch-script-to-shorts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scripts, words, sentences, fps, targetCount })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async getProjectCache(projectId: string, sequenceName: string): Promise<any | null> {
    try {
      const p = encodeURIComponent(projectId || 'default_project');
      const s = encodeURIComponent(sequenceName || 'sequence');
      const resp = await fetch(`${this.baseUrl}/api/v1/cache/project?project_id=${p}&sequence_name=${s}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.found && json.data) {
          return json.data;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  public async saveProjectCache(projectId: string, sequenceName: string, data: any): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/cache/project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || 'default_project',
          sequenceName: sequenceName || 'sequence',
          data
        })
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  /**
   * Saves SRT, TXT, and JSON files to project directory via the daemon backend.
   */
  public async saveProjectFiles(
    folderPath: string,
    baseFilename: string,
    srtContent?: string,
    txtContent?: string,
    jsonContent?: string
  ): Promise<{ success: boolean; folder?: string; files?: string[]; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/files/save-project-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folderPath || undefined,
          baseFilename: baseFilename || 'captions',
          srtContent: srtContent || '',
          txtContent: txtContent || '',
          jsonContent: jsonContent || ''
        })
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async exportPdfReport(params: {
    filename: string;
    reportHtml: string;
    folderPath?: string;
    openAfterSave?: boolean;
    revealInFinder?: boolean;
  }): Promise<{ success: boolean; path?: string; folder?: string; isPdf?: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/files/export-pdf-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      return { success: false, error: err.detail || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async revealFile(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/system/reveal-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async restartPremierePro(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/system/restart-premiere`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async startVoiceRecording(): Promise<{ success: boolean; recording?: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/voice/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) return await res.json();
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async stopVoiceRecording(language: string = 'auto'): Promise<{ success: boolean; text?: string; warning?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/voice/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language })
      });
      if (res.ok) return await res.json();
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async enhanceAudio(params: {
    sequenceName: string;
    audioPath?: string;
    sourceClips?: any[];
    durationSeconds?: number;
    profileId: string;
    settings?: any;
  }): Promise<{ success: boolean; outputPath?: string; profileId?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/audio/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      return { success: false, error: err.detail || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async masterBgm(params: {
    bgmPath: string;
    targetVolumeDb?: number;
  }): Promise<{ success: boolean; outputPath?: string; targetVolumeDb?: number; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/audio/master-bgm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      return { success: false, error: err.detail || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async analyzeSoundDesign(params: {
    words: any[];
    sentences: any[];
    genre: string;
  }): Promise<{
    genre: string;
    moodSummary: string;
    soundDesignTips: string[];
    sfxCues: any[];
    engine?: string;
  } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/audio/sound-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async recommendBackgroundMusic(params: {
    words: any[];
    sentences: any[];
    genre: string;
    durationSeconds?: number;
  }): Promise<{
    genre: string;
    moodSummary: string;
    recommendedBpm: string;
    mixingGuide: { targetVolume: string; duckingDepth: string; eqTip: string };
    musicTracks: Array<{
      id: string;
      title: string;
      titleBn: string;
      mood: string;
      moodBn: string;
      tempo: string;
      instruments: string;
      searchQuery: string;
      pixabayUrl: string;
      fmaUrl: string;
      chosicUrl: string;
      bestFor: string;
    }>;
    engine?: string;
  } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/audio/bgm-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async openUrl(url: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/system/open-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      return res.ok;
    } catch {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
        return true;
      }
      return false;
    }
  }

  public async scriptAlignedSpellCheck(
    words: any[],
    clientScript: string,
    clientBrief?: string,
    language?: string
  ): Promise<{ words: any[]; corrections: number; auditReport: any[]; engine: string; summary: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/transcript/ai-script-align`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, clientScript, clientBrief, language })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async generateScriptRoughCut(
    scriptText: string,
    words: any[],
    durationSeconds: number,
    fps: number = 23.976
  ): Promise<{
    success: boolean;
    cuts?: any[];
    punchIns?: any[];
    colorLabels?: any[];
    markers?: any[];
    keptSegmentsCount?: number;
    cutsCount?: number;
    totalCutDuration?: number;
    finalDuration?: number;
    originalDuration?: number;
    summary?: string;
    error?: string;
  }> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/timeline/script-rough-cut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText, words, durationSeconds, fps })
      });
      if (resp.ok) {
        return await resp.json();
      }
      const errData = await resp.json().catch(() => ({}));
      return { success: false, error: errData.detail || 'Script rough cut failed' };
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  public async executeAssistantCommand(
    command: string,
    words: any[],
    srtCues?: any[],
    clientScript?: string,
    clientBrief?: string,
    brandKit?: any,
    sequenceManifest?: any,
    clientRevisions?: any[],
    language?: string
  ): Promise<{
    action: string;
    message: string;
    words?: any[];
    srtCues?: any[];
    corrections?: number;
    auditReport?: any[];
    preset?: string;
    lutFileName?: string;
    basicCorrection?: any;
    musicData?: any;
    clientScript?: string;
    clientBrief?: string;
    clientDossier?: any;
  } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/assistant/execute-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          words,
          srtCues,
          clientScript,
          clientBrief,
          brandKit,
          sequenceManifest,
          clientRevisions,
          language
        })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async extractBrandColors(
    imageData: string,
    brandName?: string
  ): Promise<any | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/client/extract-brand-colors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, brandName })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async analyzeBriefRoadmap(
    clientBrief: string,
    clientScript?: string,
    words: any[] = [],
    durationSeconds: number = 60.0
  ): Promise<any[] | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/client/analyze-brief-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientBrief, clientScript, words, durationSeconds })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async parseRevisions(
    revisionNotes: string,
    durationSeconds: number = 120.0
  ): Promise<any[] | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/client/parse-revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionNotes, durationSeconds })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public async structureClientDossier(
    clientBrief: string,
    clientScript: string,
    brandKit?: any,
    sequenceManifest?: any,
    language: string = 'bn'
  ): Promise<any | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/client/structure-dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientBrief,
          clientScript,
          brandKit,
          sequenceManifest,
          language
        })
      });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  public connectWebSocket(onEvent: (event: any) => void): () => void {
    this.eventListeners.push(onEvent);

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      try {
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            this.eventListeners.forEach(listener => listener(data));
          } catch {}
        };
        this.ws.onclose = () => {
          // Reconnect attempt after 3s
          setTimeout(() => {
            if (this.eventListeners.length > 0) {
              this.connectWebSocket(onEvent);
            }
          }, 3000);
        };
      } catch {}
    }

    // Unsubscribe function
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== onEvent);
      if (this.eventListeners.length === 0 && this.ws) {
        this.ws.close();
        this.ws = null;
      }
    };
  }
}
