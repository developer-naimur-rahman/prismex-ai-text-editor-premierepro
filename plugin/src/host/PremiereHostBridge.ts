/**
 * PremiereHostBridge - Universal Host Bridge (Supports both CEP & UXP in Adobe Premiere Pro)
 * Specification: docs/04-PREMIERE-PRO-INTEGRATION.md
 */

import { SequenceManifest, SourceClipManifest } from '../types';
import { TimecodeConverter } from './TimecodeConverter';

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

  private async ensureCEPScriptLoaded(): Promise<void> {
    if (!this.csInterface || this.cepScriptLoaded) return;
    try {
      const extPath = this.csInterface.getSystemPath('extension');
      if (extPath) {
        const cleanPath = extPath.replace(/\\/g, '/');
        await this.evalScript(`if (typeof $._prismex === "undefined") { $.evalFile("${cleanPath}/jsx/hostscript.jsx"); }`);
        this.cepScriptLoaded = true;
      }
    } catch (e) {
      console.error('[PremiereHostBridge] Failed to load hostscript.jsx:', e);
    }
  }

  public evalScript(script: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.csInterface) {
        resolve('');
        return;
      }
      this.csInterface.evalScript(script, (result: string) => {
        resolve(result || '');
      });
    });
  }

  /**
   * Retrieves active sequence metadata, audio tracks, and clip media paths.
   */
  public async getActiveSequenceManifest(): Promise<SequenceManifest | null> {
    // A. CEP Path
    if (this.isCEP) {
      await this.ensureCEPScriptLoaded();
      const res = await this.evalScript("$._prismex.getActiveSequenceManifest()");
      try {
        const data = JSON.parse(res);
        if (data && !data.error) {
          return data;
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
      await this.ensureCEPScriptLoaded();
      const res = await this.evalScript(`$._prismex.cloneActiveSequence("${suffix}")`);
      try {
        const data = JSON.parse(res);
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
      const res = await this.evalScript('$._prismex.undoLastCut()');
      return JSON.parse(res);
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
   * Adds colored markers to the Premiere Pro timeline for emphasis words (RED),
   * B-Roll opportunities (GREEN), and icons/graphics (BLUE).
   */
  public async addTimelineMarkers(markers: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!this.isCEP) {
      return { success: true, count: markers.length };
    }
    try {
      const res = await this.evalScript(`$._prismex.addTimelineMarkers('${JSON.stringify(markers)}')`);
      return JSON.parse(res);
    } catch (e: any) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Opens a URL in the user's default system browser (Chrome/Safari).
   */
  public openExternalUrl(url: string): void {
    if (this.isCEP && this.csInterface?.openURLInDefaultBrowser) {
      this.csInterface.openURLInDefaultBrowser(url);
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Automatically saves all 3 files (SRT, TXT, JSON) directly into the Premiere Pro project directory.
   */
  public async saveAllProjectFiles(
    baseFilename: string,
    srtContent: string,
    txtContent: string,
    jsonContent: string
  ): Promise<{ success: boolean; folder?: string; files?: string[]; error?: string }> {
    if (this.isCEP) {
      try {
        const escapedBase = baseFilename.replace(/[^a-zA-Z0-9_-]/g, '_');
        const escapedSrt = encodeURIComponent(srtContent || '');
        const escapedTxt = encodeURIComponent(txtContent || '');
        const escapedJson = encodeURIComponent(jsonContent || '');

        const res = await this.evalScript(
          `$._prismex.saveProjectFiles('${escapedBase}', decodeURIComponent('${escapedSrt}'), decodeURIComponent('${escapedTxt}'), decodeURIComponent('${escapedJson}'))`
        );
        return JSON.parse(res);
      } catch (e: any) {
        return { success: false, error: String(e) };
      }
    }
    return { success: true, folder: 'Browser', files: [`${baseFilename}.srt`, `${baseFilename}.txt`, `${baseFilename}.json`] };
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
          const writeRes = cepFs.writeFile(dialogRes.data, content);
          if (writeRes && writeRes.err === 0) {
            return { saved: true, path: dialogRes.data };
          }
          return { saved: false, error: `Write error: ${writeRes?.err}` };
        }
        return { saved: false };
      } catch (e: any) {
        return { saved: false, error: String(e) };
      }
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
