/**
 * PremiereHostBridge - Universal Host Bridge (Supports both CEP & UXP in Adobe Premiere Pro)
 * Specification: docs/04-PREMIERE-PRO-INTEGRATION.md
 */

import { SequenceManifest, SourceClipManifest } from '../types';
import { TimecodeConverter } from './TimecodeConverter';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';

export class PremiereHostBridge {
  private static instance: PremiereHostBridge;
  private ppro: any = null;
  private csInterface: any = null;
  private isUXP: boolean = false;
  private isCEP: boolean = false;

  private constructor() {
    this.detectHost();
  }

  public static getInstance(): PremiereHostBridge {
    if (!PremiereHostBridge.instance) {
      PremiereHostBridge.instance = new PremiereHostBridge();
    }
    return PremiereHostBridge.instance;
  }

  private cepScriptLoaded: boolean = false;

  private detectHost(): void {
    if (typeof window === 'undefined') return;

    // 1. Detect CEP Environment (Window -> Extensions)
    if ((window as any).__adobe_cep__) {
      this.isCEP = true;
      if ((window as any).CSInterface) {
        this.csInterface = new (window as any).CSInterface();
        this.ensureCEPScriptLoaded();
        try {
          const keyEvents = JSON.stringify([
            // Ctrl/Cmd + V (Paste)
            { keyCode: 86, ctrlKey: true }, { keyCode: 86, metaKey: true },
            // Ctrl/Cmd + C (Copy)
            { keyCode: 67, ctrlKey: true }, { keyCode: 67, metaKey: true },
            // Ctrl/Cmd + A (Select All)
            { keyCode: 65, ctrlKey: true }, { keyCode: 65, metaKey: true },
            // Ctrl/Cmd + X (Cut)
            { keyCode: 88, ctrlKey: true }, { keyCode: 88, metaKey: true },
            // Ctrl/Cmd + Z (Undo)
            { keyCode: 90, ctrlKey: true }, { keyCode: 90, metaKey: true },
            // Standard typing & navigation keys
            { keyCode: 32 }, // Space
            { keyCode: 46 }, // Delete
            { keyCode: 8 },  // Backspace
            { keyCode: 13 }, // Enter
            { keyCode: 27 }, // Escape
            { keyCode: 37 }, // Left Arrow
            { keyCode: 38 }, // Up Arrow
            { keyCode: 39 }, // Right Arrow
            { keyCode: 40 }  // Down Arrow
          ]);
          this.csInterface.registerKeyEventsInterest(keyEvents);
        } catch (e) {}
      }
      return;
    }

    // 2. Detect UXP Environment (Plugins menu)
    try {
      if ((window as any).require) {
        this.ppro = (window as any).require('premierepro');
        this.isUXP = !!this.ppro;
      }
    } catch {
      this.isUXP = false;
    }
  }

  public isRunningInPremiere(): boolean {
    return this.isCEP || this.isUXP;
  }

  public isRunningInCEP(): boolean {
    return this.isCEP;
  }

  /**
   * Opens an external URL in the system default browser (Chrome, Safari, etc.)
   * Works across Adobe CEP, UXP, and standard browser dev environments.
   */
  public openURLInDefaultBrowser(url: string): void {
    if (!url) return;
    try {
      if (this.csInterface && typeof this.csInterface.openURLInDefaultBrowser === 'function') {
        this.csInterface.openURLInDefaultBrowser(url);
        return;
      }
      if ((window as any).cep?.util?.openURLInDefaultBrowser) {
        (window as any).cep.util.openURLInDefaultBrowser(url);
        return;
      }
    } catch (e) {
      console.warn('[PremiereHostBridge] Failed to open URL via CEP:', e);
    }

    // Node.js direct shell fallback
    try {
      const req = (window as any).require;
      if (req) {
        const cp = req('child_process');
        if (cp && typeof cp.exec === 'function') {
          cp.exec(`open "${url.replace(/"/g, '\\"')}"`);
          return;
        }
      }
    } catch (ne) {}

    // Companion daemon native OS opener fallback
    try {
      fetch('http://127.0.0.1:48152/api/v1/system/open-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).catch(() => {});
    } catch (de) {}

    // Browser fallback
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('[PremiereHostBridge] Failed to open URL in browser:', e);
    }
  }

  /**
   * Opens multiple URLs in separate tabs in the system default browser.
   */
  public openMultipleUrls(urls: string[]): void {
    if (!urls || urls.length === 0) return;
    const cleanUrls = urls.filter(u => u && u.trim().length > 0);

    // First try companion daemon multi-open
    try {
      fetch('http://127.0.0.1:48152/api/v1/system/open-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: cleanUrls })
      }).catch(() => {});
    } catch (de) {}

    // Also trigger sequential opener for maximum cross-platform compatibility
    cleanUrls.forEach((u, i) => {
      setTimeout(() => {
        this.openURLInDefaultBrowser(u);
      }, i * 160);
    });
  }

  public static readonly CURRENT_SCRIPT_BUILD = '2026112204';

  private isScriptLoading: boolean = false;
  private evalQueue: Array<{ script: string; timeoutMs: number; resolve: (val: string) => void }> = [];
  private isEvalRunning: boolean = false;

  private processEvalQueue(): void {
    if (this.isEvalRunning || this.evalQueue.length === 0) return;
    const task = this.evalQueue.shift();
    if (!task) return;

    this.isEvalRunning = true;
    let completed = false;

    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        this.isEvalRunning = false;
        task.resolve('');
        this.processEvalQueue();
      }
    }, task.timeoutMs);

    try {
      this.csInterface.evalScript(task.script, (result: string) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          this.isEvalRunning = false;
          task.resolve(result || '');
          this.processEvalQueue();
        }
      });
    } catch (err) {
      if (!completed) {
        completed = true;
        clearTimeout(timer);
        this.isEvalRunning = false;
        task.resolve('');
        this.processEvalQueue();
      }
    }
  }

  public async ensureCEPScriptLoaded(force: boolean = false): Promise<boolean> {
    if (!this.csInterface) return false;
    if (this.cepScriptLoaded && !force) return true;
    if (this.isScriptLoading) return false;

    this.isScriptLoading = true;
    try {
      const extPath = this.csInterface.getSystemPath('extension');
      if (!extPath) return false;
      const cleanPath = extPath.replace(/\\/g, '/');

      // Check whether current running ExtendScript has the latest build
      if (!force) {
        const checkRes = await this.evalScript(
          'Boolean(typeof $._prismex !== "undefined" && $._prismex.SCRIPT_BUILD === 2026112204 && typeof $._prismex.changeSequenceAspectRatio === "function")',
          3000
        );
        if (checkRes === 'true') {
          this.cepScriptLoaded = true;
          return true;
        }
      }

      // Always reload latest hostscript.jsx file from extension directory into Premiere Pro's ExtendScript engine
      const loadScript = `(function() {
        try {
          var f = new File("${cleanPath}/jsx/hostscript.jsx");
          if (f.exists) {
            $.evalFile(f);
            return String($._prismex ? $._prismex.SCRIPT_BUILD : "LOADED_NO_BUILD");
          }
          return "FILE_NOT_FOUND";
        } catch(e) {
          return "EVAL_ERR: " + String(e);
        }
      })()`;
      const loadRes = await this.evalScript(loadScript, 10000);
      console.log('[PremiereHostBridge] Evaluated hostscript.jsx into ExtendScript:', loadRes);
      this.cepScriptLoaded = loadRes !== 'FILE_NOT_FOUND' && !loadRes.startsWith('EVAL_ERR');
      return this.cepScriptLoaded;
    } catch (e) {
      console.error('[PremiereHostBridge] Failed to load hostscript.jsx:', e);
      return false;
    } finally {
      this.isScriptLoading = false;
    }
  }

  public evalScript(script: string, timeoutMs: number = 15000): Promise<string> {
    return new Promise((resolve) => {
      if (!this.csInterface) {
        resolve('');
        return;
      }
      this.evalQueue.push({ script, timeoutMs, resolve });
      this.processEvalQueue();
    });
  }

  /**
   * Safe JSON evaluation helper with serialized queue, customizable timeout, and retry on error.
   */
  public async safeEvalJson<T = any>(
    script: string,
    fallbackErrorMsg: string = 'No response from Premiere Pro',
    timeoutMs: number = 15000
  ): Promise<T> {
    let res = await this.evalScript(script, timeoutMs);

    // If result is empty or EvalScript error, attempt to reload hostscript.jsx once and retry
    if (!res || res.indexOf('EvalScript error') !== -1) {
      console.warn('[PremiereHostBridge] Script call returned error or empty, verifying host engine...', res);
      const reloaded = await this.ensureCEPScriptLoaded(true);
      if (reloaded) {
        res = await this.evalScript(script, timeoutMs);
      }
    }

    if (!res || res.indexOf('EvalScript error') !== -1) {
      return {
        success: false,
        error: fallbackErrorMsg,
        reason: 'প্রিমিয়ার প্রো স্ক্রিপ্ট থেকে সঠিক সাড়া পাওয়া যায়নি।',
        guideline: 'প্রিমিয়ার প্রোর টাইমলাইনে আপনার সিকোয়েন্সটি সক্রিয় রাখুন এবং ক্লিপ আনলক রাখুন।'
      } as unknown as T;
    }

    try {
      return JSON.parse(res);
    } catch (parseErr) {
      console.error('[PremiereHostBridge] JSON parse failed on:', res, parseErr);
      return {
        success: false,
        error: String(parseErr),
        rawResponse: res,
        reason: 'প্রিমিয়ার প্রোর স্ক্রিপ্ট ডেটা পার্স করতে সমস্যা হয়েছে।',
        guideline: 'টাইমলাইন সিকোয়েন্স আনলক রাখুন।'
      } as unknown as T;
    }
  }

  /**
   * Ultra-fast (<2ms) check of the active sequence identity to detect timeline sequence switches immediately.
   */
  public async getActiveSequenceSignature(): Promise<string> {
    if (this.isCEP) {
      try {
        const res = await this.evalScript("$._prismex ? $._prismex.getActiveSequenceSignature() : ''", 2500);
        return typeof res === "string" ? res.trim() : "";
      } catch {
        return "";
      }
    }
    return "";
  }

  /**
   * Retrieves active sequence metadata, audio tracks, and clip media paths.
   */
  public async getActiveSequenceManifest(): Promise<SequenceManifest | null> {
    // A. CEP Path
    if (this.isCEP) {
      try {
        const data = await this.safeEvalJson<any>("$._prismex.getActiveSequenceManifest()");
        if (data && !data.error && data.sequenceName) {
          return data as SequenceManifest;
        }
      } catch (e) {}
      return null;
    }

    // B. UXP Path
    if (this.isUXP) {
      try {
        const project = await this.ppro.Project.getActiveProject();
        if (!project) return null;

        const sequence = await project.getActiveSequence();
        if (!sequence) return null;

        const sequenceName = await sequence.getName();
        const sequenceGuid = (await sequence.getGuid?.()) || `seq_${Date.now()}`;
        const fps = (await sequence.getFrameRate?.()) || 23.976;
        const durationTicksObj = await sequence.getDuration();
        const durationTicks = durationTicksObj ? durationTicksObj.getTicks() : "0";
        const durationSeconds = TimecodeConverter.ticksToSeconds(durationTicks);

        const audioTracks = await sequence.getAudioTracks();
        const sourceClips: SourceClipManifest[] = [];

        for (let tIdx = 0; tIdx < audioTracks.length; tIdx++) {
          const track = audioTracks[tIdx];
          const trackItems = await track.getTrackItems();
          
          for (const item of trackItems) {
            const projectItem = await item.getProjectItem?.();
            const mediaPath = (await projectItem?.getMediaPath?.()) || (projectItem?.mediaPath) || '';
            const inTicks = await item.getInPoint();
            const outTicks = await item.getOutPoint();
            
            sourceClips.push({
              mediaPath,
              trackIndex: tIdx + 1,
              inSeconds: TimecodeConverter.ticksToSeconds(inTicks?.getTicks?.() || "0"),
              outSeconds: TimecodeConverter.ticksToSeconds(outTicks?.getTicks?.() || "0")
            });
          }
        }

        return {
          premiereProjectId: (await project.getGuid?.()) || 'local_project',
          sequenceGuid,
          sequenceName,
          fps,
          sampleRate: 48000,
          durationSeconds,
          durationTicks,
          sourceClips
        };
      } catch (err) {
        console.error('[PremiereHostBridge] UXP read error:', err);
      }
    }

    // C. Standalone Browser / Mock Fallback
    return this.getMockSequenceManifest();
  }

  /**
   * Clones the active sequence non-destructively.
   */
  public async cloneActiveSequence(suffix: string = "_PrismexRoughCut"): Promise<{ clonedSequenceName: string } | null> {
    if (this.isCEP) {
      try {
        const data = await this.safeEvalJson<any>(`$._prismex.cloneActiveSequence("${suffix}")`);
        if (data && !data.error) {
          return data;
        }
      } catch (e) {}
      return null;
    }

    if (this.isUXP) {
      try {
        const project = await this.ppro.Project.getActiveProject();
        const sequence = await project.getActiveSequence();
        if (!sequence) throw new Error("No active sequence");

        const origName = await sequence.getName();
        const targetName = `${origName}${suffix}`;
        const cloneAction = await sequence.createCloneAction();
        await project.executeActions([cloneAction]);

        const sequences = await project.getSequences();
        const cloned = sequences.find((s: any) => s.name === `${origName} Copy` || s.name === targetName);
        if (cloned) {
          await cloned.setName(targetName);
          await project.openSequence(cloned);
          return { clonedSequenceName: targetName };
        }
        return { clonedSequenceName: targetName };
      } catch (err) {
        console.error('[PremiereHostBridge] UXP clone error:', err);
      }
    }

    return { clonedSequenceName: `Demo_Interview${suffix}` };
  }

  /**
   * Gets the current timeline CTI playhead position in seconds.
   */
  public async getPlayheadPosition(): Promise<number> {
    if (this.isCEP) {
      await this.ensureCEPScriptLoaded();
      const res = await this.evalScript('$._prismex.getPlayheadPosition()');
      const val = parseFloat(res);
      return isNaN(val) ? 0 : val;
    }
    return 0;
  }

  /**
   * Sets the timeline CTI playhead position to a given second timestamp.
   */
  public async setPlayheadPosition(seconds: number): Promise<void> {
    if (this.isCEP) {
      await this.ensureCEPScriptLoaded();
      await this.evalScript(`$._prismex.setPlayheadPosition(${Number(seconds) || 0})`);
      return;
    }

    if (this.isUXP) {
      try {
        const project = await this.ppro.Project.getActiveProject();
        const sequence = await project?.getActiveSequence();
        if (!sequence) return;

        const ticksString = TimecodeConverter.secondsToTicks(seconds);
        const tickTimeObj = await this.ppro.TickTime.createWithTicks(ticksString);
        await sequence.setPlayerPosition(tickTimeObj);
      } catch (err) {
        console.error('[PremiereHostBridge] UXP playhead seek error:', err);
      }
    }
  }

  /**
   * Undoes the last timeline cut by reverting to the previous un-cut sequence.
   */
  public async undoLastCut(): Promise<{ success: boolean; error?: string }> {
    if (!this.isCEP) {
      return { success: true };
    }
    try {
      return await this.safeEvalJson('$._prismex.undoLastCut()');
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Toggles playback on the active Premiere Pro sequence player.
   */
  public async togglePlayback(): Promise<boolean> {
    if (!this.isCEP) return false;
    try {
      const res = await this.evalScript('$._prismex.togglePlayback()');
      const data = JSON.parse(res);
      return !!data.success;
    } catch {
      return false;
    }
  }

  /**
   * Starts playback on the active Premiere Pro sequence player.
   */
  public async startPlayback(speed: number = 1): Promise<boolean> {
    if (!this.isCEP) return false;
    try {
      const res = await this.evalScript(`$._prismex.startPlayback(${speed})`);
      const data = JSON.parse(res);
      return !!data.success;
    } catch {
      return false;
    }
  }

  /**
   * Stops playback on the active Premiere Pro sequence player.
   */
  public async stopPlayback(): Promise<boolean> {
    if (!this.isCEP) return false;
    try {
      const res = await this.evalScript('$._prismex.stopPlayback()');
      const data = JSON.parse(res);
      return !!data.success;
    } catch {
      return false;
    }
  }

  /**
   * Adds colored markers to the Premiere Pro timeline for emphasis words (RED),
   * B-Roll opportunities (GREEN), and icons/graphics (BLUE).
   */
  public async addTimelineMarkers(markers: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!this.isCEP) {
      return { success: true, count: markers.length };
    }
    try {
      return await this.safeEvalJson(`$._prismex.addTimelineMarkers('${JSON.stringify(markers)}')`);
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Imports the enhanced studio audio master WAV into Premiere Pro and places it onto the timeline.
   */
  public async applyEnhancedAudioTrack(
    wavPath: string,
    targetTrackIndex: number = 1,
    muteOriginal: boolean = true
  ): Promise<{ success: boolean; trackIndex?: number; error?: string }> {
    if (!this.isCEP) {
      return { success: true, trackIndex: targetTrackIndex };
    }
    try {
      const safePath = wavPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return await this.safeEvalJson(`$._prismex.applyEnhancedAudioTrack('${safePath}', ${targetTrackIndex}, ${muteOriginal})`);
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Applies Lumetri Color Effect directly to active clip or all clips on timeline.
   */
  public async applyLumetriColorToActiveClip(
    lutFilePath: string,
    lutName: string = "Studio Grade",
    basicCorrection: any = {},
    applyToAll: boolean = false
  ): Promise<{ success: boolean; processedCount?: number; lutName?: string; appliedTo?: string; error?: string }> {
    if (!this.isCEP) {
      return { success: true, processedCount: 1, lutName };
    }
    try {
      const safeLut = (lutFilePath || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const safeName = (lutName || '').replace(/'/g, "\\'");
      const safeParams = JSON.stringify(basicCorrection || {});
      return await this.safeEvalJson(
        `$._prismex.applyLumetriColorToActiveClip('${safeLut}', '${safeName}', '${safeParams}', ${applyToAll})`
      );
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Imports a media file (B-Roll or SFX) and places it onto a specific track in Premiere Pro at targetTimeSec.
   */
  public async importAndPlaceClipOnTrack(
    filePath: string,
    targetTimeSec: number,
    targetTrackIndex: number = 1,
    trackType: 'video' | 'audio' = 'video',
    durationSec: number = 4.0
  ): Promise<{ success: boolean; bin?: string; error?: string }> {
    if (!this.isCEP) {
      return { success: true, bin: '_Prismex_Broll' };
    }
    try {
      const safePath = filePath.replace(/\\/g, '/');
      return await this.safeEvalJson(
        `$._prismex.importAndPlaceClipOnTrack("${safePath}", ${targetTimeSec}, ${targetTrackIndex}, "${trackType}", ${durationSec})`
      );
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Applies Dynamic Punch Zoom (114% scale) at emphasis keyword timestamps on Video Track 1.
   */
  public async applyDynamicPunchZoom(
    punchTimes: number[],
    zoomPercent: number = 114.0
  ): Promise<{ success: boolean; count?: number; zoomPercent?: number; error?: string }> {
    if (!this.isCEP) {
      return { success: true, count: punchTimes.length, zoomPercent };
    }
    try {
      return await this.safeEvalJson(
        `$._prismex.applyDynamicPunchZoom('${JSON.stringify(punchTimes)}', ${zoomPercent})`
      );
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Imports and places Whoosh / Pop SFX onto Audio Track 3 at all marker timestamps.
   */
  public async importAndPlaceSfxBatch(
    sfxFilePath: string,
    times: number[],
    trackIndex: number = 2
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!this.isCEP) {
      return { success: true, count: times.length };
    }
    try {
      const safePath = sfxFilePath.replace(/\\/g, '/');
      return await this.safeEvalJson(
        `$._prismex.importAndPlaceSfxBatch("${safePath}", '${JSON.stringify(times)}', ${trackIndex})`
      );
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Opens a URL in the user's default system browser (Chrome/Safari).
   */
  public openExternalUrl(url: string): void {
    this.openURLInDefaultBrowser(url);
  }

  /**
   * Gets the active project's parent directory, or defaults to ~/Documents/PrismexExports.
   */
  public async getProjectFolderPath(): Promise<string> {
    if (this.isCEP) {
      try {
        await this.ensureCEPScriptLoaded();
        const res = await this.evalScript('$._prismex.getProjectFolderPath()');
        if (res && res !== 'EvalScript error.' && res !== 'undefined' && res.trim() !== '') {
          return res.trim();
        }
      } catch (e) {}
    }
    return '';
  }

  /**
   * Automatically saves all 3 files (SRT, TXT, JSON) directly into the Premiere Pro project directory.
   * Employs a robust 4-tier persistence waterfall: Node.js fs -> CEP fs -> Local Daemon API -> Browser Blob.
   */
  public async saveAllProjectFiles(
    baseFilename: string,
    srtContent: string,
    txtContent: string,
    jsonContent: string
  ): Promise<{ success: boolean; folder?: string; files?: string[]; error?: string }> {
    const safeBase = (baseFilename || 'captions').replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_');
    let folder = await this.getProjectFolderPath();

    // TIER 1: Node.js fs inside CEP Panel (Instant direct disk write with zero size/character limits)
    try {
      const req = (window as any).require;
      if (req) {
        const fs = req('fs');
        const path = req('path');
        if (fs && path) {
          if (!folder || folder === '/tmp') {
            const home = (window as any).process?.env?.HOME || '/tmp';
            folder = path.join(home, 'Documents', 'PrismexExports');
          }
          if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
          }

          const srtPath = path.join(folder, `${safeBase}.srt`);
          const txtPath = path.join(folder, `${safeBase}.txt`);
          const jsonPath = path.join(folder, `${safeBase}.json`);

          if (srtContent) fs.writeFileSync(srtPath, srtContent, 'utf8');
          if (txtContent) fs.writeFileSync(txtPath, txtContent, 'utf8');
          if (jsonContent) fs.writeFileSync(jsonPath, jsonContent, 'utf8');

          return {
            success: true,
            folder,
            files: [srtPath, txtPath, jsonPath]
          };
        }
      }
    } catch (nodeErr) {
      console.warn('[PremiereHostBridge] Tier 1 Node.js fs failed, falling back:', nodeErr);
    }

    // TIER 2: Adobe CEP Built-in Filesystem (window.cep.fs)
    try {
      const cepFs = (window as any).cep?.fs;
      if (cepFs && cepFs.writeFile) {
        if (!folder || folder === '/tmp') folder = '/tmp/PrismexExports';
        try { cepFs.makedir(folder); } catch (e) {}

        const srtPath = `${folder}/${safeBase}.srt`;
        const txtPath = `${folder}/${safeBase}.txt`;
        const jsonPath = `${folder}/${safeBase}.json`;
        const utf8 = (window as any).cep?.encoding?.UTF8 || 1;

        let anySaved = false;
        if (srtContent) {
          const res = cepFs.writeFile(srtPath, srtContent, utf8);
          if (res && res.err === 0) anySaved = true;
        }
        if (txtContent) {
          const res = cepFs.writeFile(txtPath, txtContent, utf8);
          if (res && res.err === 0) anySaved = true;
        }
        if (jsonContent) {
          const res = cepFs.writeFile(jsonPath, jsonContent, utf8);
          if (res && res.err === 0) anySaved = true;
        }

        if (anySaved) {
          return {
            success: true,
            folder,
            files: [srtPath, txtPath, jsonPath]
          };
        }
      }
    } catch (cepErr) {
      console.warn('[PremiereHostBridge] Tier 2 CEP fs failed, falling back:', cepErr);
    }

    // TIER 3: Local Companion Daemon (Python FastApi on 127.0.0.1:49152)
    try {
      const client = PrismexDaemonClient.getInstance();
      const daemonRes = await client.saveProjectFiles(folder, safeBase, srtContent, txtContent, jsonContent);
      if (daemonRes && daemonRes.success) {
        return daemonRes;
      }
    } catch (daemonErr) {
      console.warn('[PremiereHostBridge] Tier 3 Local Daemon failed, falling back:', daemonErr);
    }

    // TIER 4: Browser Blob Fallback
    try {
      const triggerDownload = (filename: string, content: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      const savedNames: string[] = [];
      if (srtContent) {
        triggerDownload(`${safeBase}.srt`, srtContent);
        savedNames.push(`${safeBase}.srt`);
      }
      if (txtContent) {
        triggerDownload(`${safeBase}.txt`, txtContent);
        savedNames.push(`${safeBase}.txt`);
      }
      if (jsonContent) {
        triggerDownload(`${safeBase}.json`, jsonContent);
        savedNames.push(`${safeBase}.json`);
      }

      return {
        success: savedNames.length > 0,
        folder: 'Downloads',
        files: savedNames
      };
    } catch (browserErr: any) {
      return { success: false, error: String(browserErr) };
    }
  }

  /**
   * Saves a text/JSON/SRT file reliably inside Adobe CEP (native macOS Save dialog) or browser.
   */
  public async saveFileWithDialog(
    defaultFilename: string,
    content: string,
    extensions: string[] = ['txt']
  ): Promise<{ saved: boolean; path?: string; error?: string }> {
    const cepFs = (window as any)?.cep?.fs;
    if (this.isCEP && cepFs?.showSaveDialogEx && cepFs?.writeFile) {
      try {
        const dialogRes = cepFs.showSaveDialogEx('Export File', '', extensions, defaultFilename);
        if (dialogRes && dialogRes.err === 0 && dialogRes.data) {
          const utf8 = (window as any)?.cep?.encoding?.UTF8 || 1;
          const writeRes = cepFs.writeFile(dialogRes.data, content, utf8);
          if (writeRes && writeRes.err === 0) {
            return { saved: true, path: dialogRes.data };
          }
          // Try Node.js fs fallback if cepFs returned non-zero
          try {
            const req = (window as any).require;
            if (req) {
              const fs = req('fs');
              if (fs) {
                fs.writeFileSync(dialogRes.data, content, 'utf8');
                return { saved: true, path: dialogRes.data };
              }
            }
          } catch (ne) {}
          return { saved: false, error: `Write error: ${writeRes?.err}` };
        }
        return { saved: false };
      } catch (e: any) {
        return { saved: false, error: String(e) };
      }
    }

    // Node.js direct fallback
    try {
      const req = (window as any).require;
      if (req) {
        const fs = req('fs');
        const path = req('path');
        if (fs && path) {
          const exportDir = path.join(process.env.HOME || '/tmp', 'Documents', 'PrismexExports');
          if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
          const filePath = path.join(exportDir, defaultFilename);
          fs.writeFileSync(filePath, content, 'utf8');
          return { saved: true, path: filePath };
        }
      }
    } catch (ne) {}

    // Tier 3: Local Companion Daemon (Python FastAPI fallback with full OS disk permissions)
    try {
      const client = PrismexDaemonClient.getInstance();
      const ext = (extensions[0] || 'txt').toLowerCase();
      const daemonRes = await client.saveProjectFiles(
        '',
        defaultFilename.replace(/\.[^.]+$/, ''),
        ext === 'srt' ? content : undefined,
        ext === 'txt' ? content : undefined,
        ext === 'json' ? content : undefined
      );
      if (daemonRes && daemonRes.success && daemonRes.files && daemonRes.files.length > 0) {
        return { saved: true, path: daemonRes.files[0] };
      }
    } catch (daemonErr) {
      console.warn('[PremiereHostBridge] Daemon fallback failed:', daemonErr);
    }

    // Browser / Fallback
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { saved: true, path: defaultFilename };
    } catch (e: any) {
      return { saved: false, error: String(e) };
    }
  }

  /**
   * Imports an SRT file and creates a native Premiere Pro Caption Track on the active sequence,
   * populating Premiere Pro's built-in Text Panel (Captions tab) immediately.
   */
  public async sendSrtToPremiereCaptionTrack(
    filename: string,
    srtContent: string
  ): Promise<{ success: boolean; srtName?: string; error?: string }> {
    if (!this.isCEP) {
      return { success: false, error: 'Only available inside Adobe Premiere Pro' };
    }

    try {
      await this.ensureCEPScriptLoaded();
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const tmpPath = `/tmp/${safeName}`;

      const cepFs = (window as any)?.cep?.fs;
      if (cepFs?.writeFile) {
        const writeRes = cepFs.writeFile(tmpPath, srtContent);
        if (!writeRes || writeRes.err !== 0) {
          return { success: false, error: `Failed to write temp SRT: ${writeRes?.err}` };
        }
      } else if ((window as any).require) {
        const fs = (window as any).require('fs');
        fs.writeFileSync(tmpPath, srtContent, 'utf8');
      } else {
        return { success: false, error: 'Filesystem bridge unavailable' };
      }

      const res = await this.evalScript(
        `$._prismex.importSrtAndCreateCaptionTrack("${tmpPath.replace(/"/g, '\\"')}")`
      );
      return JSON.parse(res || '{"success":false}');
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Saves project transcript & metadata cache file directly into project directory.
   */
  public async saveProjectCache(cacheKey: string, jsonString: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!this.isCEP) {
      return { success: true };
    }
    try {
      await this.ensureCEPScriptLoaded();
      const escapedJson = JSON.stringify(jsonString);
      const res = await this.evalScript(`$._prismex.saveProjectCache("${cacheKey}", ${escapedJson})`);
      return JSON.parse(res || '{"success":false}');
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  public async saveProject(): Promise<{ success: boolean; error?: string }> {
    if (!this.isCEP) {
      return { success: true };
    }
    try {
      return await this.safeEvalJson(`$._prismex.saveProject()`);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Loads project transcript & metadata cache file directly from project directory.
   */
  public async loadProjectCache(cacheKey: string): Promise<{ found: boolean; content?: string; error?: string }> {
    if (!this.isCEP) {
      return { found: false };
    }
    try {
      return await this.safeEvalJson(`$._prismex.loadProjectCache("${cacheKey}")`);
    } catch (err: any) {
      return { found: false, error: String(err) };
    }
  }

  /**
   * Clones active sequence, converts to 9:16 vertical (1080x1920), organizes in bin,
   * stitches multi-part segments (Hook -> Body -> CTA) contiguously, and adds markers.
   */
  public async createMultiSegmentVerticalShortSequence(
    title: string,
    segments: Array<{ role: string; startSeconds: number; endSeconds: number }>,
    markers?: any[]
  ): Promise<{ success: boolean; sequenceName?: string; bin?: string; durationSeconds?: number; segmentCount?: number; error?: string }> {
    if (!this.isCEP) {
      return { success: true, sequenceName: `${title}_9x16`, bin: '_Prismex_Viral_Shorts', durationSeconds: 45, segmentCount: segments.length };
    }
    try {
      const safeTitle = (title || 'Short').replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_');
      const segmentsJson = JSON.stringify(segments);
      const markersJson = markers ? JSON.stringify(markers) : '[]';
      const escapedSegments = JSON.stringify(segmentsJson);
      const escapedMarkers = JSON.stringify(markersJson);
      return await this.safeEvalJson(
        `$._prismex.createMultiSegmentVerticalShortSequence("${safeTitle}", ${escapedSegments}, ${escapedMarkers})`
      );
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Clones active sequence, converts to 9:16 vertical (1080x1920), moves to bin,
   * trims to short duration, and places AI timeline markers.
   */
  public async createVerticalShortSequence(
    title: string,
    startSeconds: number,
    endSeconds: number,
    markers?: any[]
  ): Promise<{ success: boolean; sequenceName?: string; bin?: string; error?: string }> {
    if (!this.isCEP) {
      return { success: true, sequenceName: `${title}_9x16`, bin: '_Prismex_Viral_Shorts' };
    }
    try {
      const safeTitle = (title || 'Short').replace(/[^a-zA-Z0-9_-]/g, '_');
      const markersJson = markers ? JSON.stringify(markers).replace(/"/g, '\\"') : '""';
      return await this.safeEvalJson(
        `$._prismex.createVerticalShortSequence("${safeTitle}", ${startSeconds}, ${endSeconds}, "${markersJson}")`
      );
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  public async getActiveClipAtPlayhead(): Promise<any> {
    if (!this.isCEP) {
      return { success: true, timelineSeconds: 12.5, clipName: "MockClip_01.mp4", mediaPath: "" };
    }
    try {
      return await this.safeEvalJson(`$._prismex.getActiveClipAtPlayhead()`);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  public async exportFrameAtPlayhead(outputPath: string): Promise<any> {
    if (!this.isCEP) {
      return { success: true, domExported: false, outputPath, mock: true };
    }
    try {
      const escapedPath = outputPath.replace(/\\/g, '/');
      return await this.safeEvalJson(`$._prismex.exportFrameAtPlayhead("${escapedPath}")`);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  public async revealFileInOS(filePath: string): Promise<any> {
    if (!this.isCEP) {
      return { success: true };
    }
    try {
      const escapedPath = filePath.replace(/\\/g, '/');
      return await this.safeEvalJson(`$._prismex.revealFileInOS("${escapedPath}")`);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * 1-Click Non-Destructive Script Rough-Cut Sequence Creator
   * Clones active sequence into `[SeqName]_AI_Script_RoughCut`, executes frame-accurate ripple cuts,
   * alternates A/B punch-in scale (100% vs 112%), colors acts (Hook=Orange, Body=Teal, CTA=Green),
   * and places chapter & B-Roll cue markers.
   */
  async createScriptRoughCutSequence(payload: {
    cuts: any[];
    punchIns?: any[];
    colorLabels?: any[];
    markers?: any[];
  }): Promise<{
    success: boolean;
    sequenceName?: string;
    sequenceId?: string;
    executedCuts?: number;
    punchesApplied?: number;
    colorsApplied?: number;
    markersPlaced?: number;
    error?: string;
  }> {
    try {
      const payloadStr = JSON.stringify(payload);
      const escapedPayload = payloadStr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return await this.safeEvalJson(
        `$._prismex.createScriptRoughCutSequence("${escapedPayload}")`,
        "প্রিমিয়ার প্রো থেকে রাফ-কাট তৈরির রেসপন্স আসেনি। টাইমলাইনে সিকোয়েন্স ওপেন আছে কিনা নিশ্চিত করুন।",
        180000 // 3 minutes timeout for heavy sequence cloning, cuts & markers
      );
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Pre-AE Safety Duplication
   * Duplicates the active clip at playhead from Track V1 to Track V2,
   * labeling Track V1 as a safety backup so "Replace with After Effects Composition" never destroys raw media.
   */
  async preAeSafetyDuplicate(): Promise<{ success: boolean; message?: string; clipName?: string; error?: string }> {
    try {
      return await this.safeEvalJson(`$._prismex.preAeSafetyDuplicate()`);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Smart Eyeline & Rule-of-Thirds Punch-In
   * Applies 112% scale to active clip at playhead.
   */
  async applySmartEyelinePunch(scalePercent: number = 112.0): Promise<{ success: boolean; message?: string; clipName?: string; scale?: number; error?: string }> {
    try {
      return await this.safeEvalJson(`$._prismex.applySmartEyelinePunch(${scalePercent})`);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * 1-Click Sequence Aspect Ratio Converter with Auto-Fit
   * Changes sequence dimensions to 1:1, 9:16, 4:5, 16:9, etc. and auto-scales clips.
   */
  async changeSequenceAspectRatio(options: {
    width: number;
    height: number;
    label: string;
    ratioKey?: string;
    fitMode?: 'fill' | 'fit';
    clone?: boolean;
  }): Promise<{
    success: boolean;
    sequenceName?: string;
    width?: number;
    height?: number;
    ratio?: string;
    clipsModified?: number;
    message?: string;
    error?: string;
    reason?: string;
    guideline?: string;
  }> {
    try {
      const escapedJson = JSON.stringify(options).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return await this.safeEvalJson(
        `$._prismex.changeSequenceAspectRatio("${escapedJson}")`,
        'Could not change sequence aspect ratio',
        60000 // 60s timeout for cloning sequence + scaling all clips
      );
    } catch (err: any) {
      return {
        success: false,
        error: String(err),
        reason: 'ExtendScript যোগাযোগে ত্রুটি ঘটেছে।',
        guideline: 'প্রিমিয়ার প্রো রিফ্রেশ করুন এবং পুনরায় চেষ্টা করুন।'
      };
    }
  }

  private getMockSequenceManifest(): SequenceManifest {
    return {
      premiereProjectId: "mock_project_001",
      sequenceGuid: "mock_seq_guid_12345",
      sequenceName: "Episode_42_Interview_CamA",
      fps: 23.976,
      sampleRate: 48000,
      durationSeconds: 742.5,
      durationTicks: TimecodeConverter.secondsToTicks(742.5),
      sourceClips: [
        {
          mediaPath: "/Volumes/Footage/Ep42/A_Roll_01.MOV",
          trackIndex: 1,
          inSeconds: 0.0,
          outSeconds: 742.5
        }
      ]
    };
  }
}
