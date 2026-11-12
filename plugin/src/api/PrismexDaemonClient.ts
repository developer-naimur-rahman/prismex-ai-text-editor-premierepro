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
  private baseUrl = 'http://127.0.0.1:49152';
  private wsUrl = 'ws://127.0.0.1:49152/ws/events';
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
