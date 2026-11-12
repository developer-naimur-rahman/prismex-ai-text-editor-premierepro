# 04 — Premiere Pro Integration Specification (UXP DOM)

## 1. Adobe Extensibility Architecture Overview

Adobe Premiere Pro's extensibility architecture has transitioned from CEP (Common Extensibility Platform) / ExtendScript to **UXP (Unified Extensibility Platform)**. 

Prismex AI Editor is built strictly on **UXP for Premiere Pro**, targeting **Premiere Pro v24.0+ and v25.0+** running natively on Apple Silicon (ARM64).

### Architectural Differences: UXP vs. Legacy CEP
| Dimension | Legacy CEP / ExtendScript | Modern UXP (Prismex) |
|---|---|---|
| **JavaScript Engine** | Legacy Chromium Embedded Framework (CEF) + separate 32/64-bit ExtendScript engine | Unified V8 Engine with modern ES2022+ and async/await |
| **DOM Access** | Synchronous, blocking `.jsx` script evaluation via `CSInterface.evalScript()` | Asynchronous, native C++ bindings via `require("premierepro")` |
| **Execution Safety** | Fragile QE DOM prone to crashes during playback | Managed transaction actions (`SequenceEditor`) with validation |
| **Manifest Spec** | `CSXS/manifest.xml` | `manifest.json` (Manifest Version 5) |
| **Packaging** | `.zxp` zip archive (ZXPSignCmd) | `.ccx` container signed for Adobe Creative Cloud Desktop |

---

## 2. Plugin Manifest Configuration (`manifest.json`)

Prismex AI Editor requires specific permissions for network loopback communication and host DOM access:

```json
{
  "manifestVersion": 5,
  "id": "com.prismex.editor",
  "name": "Prismex AI Editor",
  "version": "1.0.0",
  "main": "index.html",
  "host": {
    "app": "premierepro",
    "minVersion": "24.0.0"
  },
  "entrypoints": [
    {
      "type": "panel",
      "id": "com.prismex.editor.panel",
      "label": "Prismex AI Editor",
      "minimumSize": { "width": 380, "height": 550 },
      "preferredDockedSize": { "width": 420, "height": 800 }
    }
  ],
  "requiredPermissions": {
    "network": {
      "domains": [
        "http://127.0.0.1:49152",
        "ws://127.0.0.1:49152",
        "http://localhost:49152",
        "ws://localhost:49152"
      ]
    },
    "localFileSystem": "request",
    "allowExecution": true
  },
  "icons": [
    { "value": "assets/icons/icon-light.png", "size": 32 },
    { "value": "assets/icons/icon-dark.png", "size": 32 }
  ]
}
```

---

## 3. Premiere Pro UXP DOM Access & Code Patterns

### 3.1 Initializing the Host DOM
All interaction with the Premiere Pro host begins by requiring the `premierepro` module:

```typescript
// src/services/PremiereHostBridge.ts
import * as ppro from "premierepro";

export class PremiereHostBridge {
  private static instance: PremiereHostBridge;

  public static getInstance(): PremiereHostBridge {
    if (!PremiereHostBridge.instance) {
      PremiereHostBridge.instance = new PremiereHostBridge();
    }
    return PremiereHostBridge.instance;
  }

  public async getActiveProject(): Promise<ppro.Project | null> {
    const project = await ppro.Project.getActiveProject();
    return project || null;
  }

  public async getActiveSequence(): Promise<ppro.Sequence | null> {
    const project = await this.getActiveProject();
    if (!project) return null;
    return await project.getActiveSequence();
  }
}
```

### 3.2 Time Representation via `TickTime`
Premiere Pro represents all timeline coordinates using `TickTime`. Adobe defines **1 second as exactly 254,016,000,000 ticks**.

```typescript
// Utility for exact second-to-tick conversion
export class TimecodeConverter {
  public static readonly TICKS_PER_SECOND = 254016000000n; // BigInt precision

  public static secondsToTicks(seconds: number): ppro.TickTime {
    const ticksBigInt = BigInt(Math.round(seconds * Number(this.TICKS_PER_SECOND)));
    return ppro.TickTime.createWithTicks(ticksBigInt.toString());
  }

  public static ticksToSeconds(tickTime: ppro.TickTime): number {
    const ticks = BigInt(tickTime.getTicks());
    return Number(ticks) / Number(this.TICKS_PER_SECOND);
  }
}
```

### 3.3 Sequence Duplication (Non-Destructive Core)
To ensure that original sequences are never modified, Prismex clones the active sequence before applying edits:

```typescript
export async function duplicateActiveSequence(
  sequence: ppro.Sequence, 
  suffix: string = "_PrismexRoughCut"
): Promise<ppro.Sequence> {
  const originalName = await sequence.getName();
  const targetName = `${originalName}${suffix}`;
  
  // Create sequence clone action
  const cloneAction = await sequence.createCloneAction();
  const project = await ppro.Project.getActiveProject();
  
  // Execute sequence action
  await project.executeActions([cloneAction]);
  
  // Locate and rename the cloned sequence
  const sequences = await project.getSequences();
  const clonedSeq = sequences.find(s => s.name === `${originalName} Copy` || s.name === targetName);
  
  if (clonedSeq) {
    await clonedSeq.setName(targetName);
    return clonedSeq;
  }
  throw new Error("Failed to clone sequence: Cloned sequence not found in project.");
}
```

### 3.4 Timeline Navigation (Playhead Scrubbing)
When a user clicks any word in the transcript editor, the timeline playhead jumps to that exact audio onset:

```typescript
export async function seekPlayheadToSeconds(sequence: ppro.Sequence, seconds: number): Promise<void> {
  const targetTick = TimecodeConverter.secondsToTicks(seconds);
  await sequence.setPlayerPosition(targetTick);
}
```

### 3.5 Timeline Editing via `SequenceEditor`
Modifications to track items (clips) are applied via `SequenceEditor`:

```typescript
export async function applyRippleDeletes(
  sequence: ppro.Sequence, 
  cutIntervals: Array<{ startSeconds: number; endSeconds: number }>
): Promise<void> {
  const editor = await ppro.SequenceEditor.getEditor(sequence);
  
  // Sort cuts in REVERSE order (right-to-left) to keep earlier timestamps valid
  const sortedCuts = [...cutIntervals].sort((a, b) => b.startSeconds - a.startSeconds);

  for (const cut of sortedCuts) {
    const startTick = TimecodeConverter.secondsToTicks(cut.startSeconds);
    const endTick = TimecodeConverter.secondsToTicks(cut.endSeconds);
    
    // Select items in range across targeted tracks
    const selection = await sequence.getItemsInRange(startTick, endTick);
    
    if (selection && (await selection.getCount()) > 0) {
      // createRemoveItemsAction(selection, ripple=true, mediaType=ALL, shiftOverlapping=true)
      const removeAction = await editor.createRemoveItemsAction(
        selection,
        true, // ripple
        ppro.Constants.MediaType.ALL,
        true  // shiftOverlapping
      );
      await editor.executeActions([removeAction]);
    }
  }
}
```

---

## 4. Audio Extraction Workflow

Direct source file audio extraction via FFmpeg is significantly faster than exporting through Adobe Media Encoder.

```
+-------------------------------------------------------------------------------+
|                       Sequence Audio Discovery Pipeline                       |
+-------------------------------------------------------------------------------+
                                        │
                                        ▼
             Query sequence tracks: `await sequence.getAudioTracks()`
                                        │
                                        ▼
         For each track item: Retrieve source path via `item.getMediaPath()`
                                        │
                                        ▼
             Check: Are clips contiguous on audio track 1 (Dialogue)?
                                        │
                    ┌───────────────────┴───────────────────┐
                    │ YES                                   │ NO (Complex Mix / Nested)
                    ▼                                       ▼
        [Fast-Path: FFmpeg ARM64]              [Fallback: Premiere Mixdown]
  Extract audio chunks directly from     Queue background sequence mixdown via
   source video/audio files with           `app.encoder.encodeSequence(...)`
    sample-accurate `-ss` and `-to`         using 16kHz Mono 16-bit WAV preset
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                         [High-Fidelity 16kHz Mono WAV]
                         Processed by Silero VAD & MLX
```

---

## 5. macOS Packaging and Installation

1. **UXP Panel Bundle**:
   - Packaged as `com.prismex.editor.ccx`.
   - Built via `yarn build` (Vite) and packaged with Adobe's `uxp-package` tool.
   - User installation: Double-click `.ccx` file to install directly via Adobe Creative Cloud Desktop, or placed in `~/Library/Application Support/Adobe/UXP/Extensions/`.
2. **Companion Daemon Bundle**:
   - Packaged as a notarized macOS application bundle: `PrismexCore.app`.
   - Placed in `/Applications/PrismexCore.app` or `~/Library/Application Support/Prismex/bin/`.
   - A universal launchd agent (`~/Library/LaunchAgents/com.prismex.daemon.plist`) ensures the daemon starts automatically when the user logs in.
