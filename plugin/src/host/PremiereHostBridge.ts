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
