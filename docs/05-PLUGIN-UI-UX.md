# 05 — Plugin UI & UX Specification

## 1. Design Philosophy & Adobe Spectrum Compliance

Prismex AI Editor adheres strictly to **Adobe Spectrum Design System** guidelines. As an embedded panel inside Adobe Premiere Pro, the UI must look and feel like an authentic, native Premiere tool—not a foreign web application.

### Key UX Principles:
1. **Host Theme Harmony**: Seamlessly inherits Premiere Pro's 4 host color themes (Darkest, Dark, Medium Light, Light) via CSS custom variables (`--spectrum-global-color-gray-*`).
2. **High Information Density**: Dockable panels in video workflows are frequently resized into narrow columns (380px–450px). Information density must be compact and legible.
3. **Keyboard-First Video Editing**: Video editors rely heavily on standard keyboard conventions (`J-K-L`, `Space`, `Cmd+Z`). All core review actions must be keyboard-operable.
4. **Instant Visual Feedback**: Continuous progress bars, estimated time remaining, audio level meters, and waveform cut indicators prevent anxiety during batch processing.

---

## 2. Navigation Architecture & View Hierarchy

The panel features a persistent compact top navigation bar with tab navigation, an active sequence status indicator, and quick-access settings:

```
+--------------------------------------------------------------------------------+
| [Prismex Logo] Active Seq: Interview_01_CamA [1080p24]       [● Online] [⚙]    |
+--------------------------------------------------------------------------------+
| [Dashboard] [✨ Magic Cut] [Transcript] [Review Queue (14)] [Takes] [Providers] |
+--------------------------------------------------------------------------------+
|                                                                                |
|                               VIEWPORT CONTAINER                               |
|                                                                                |
+--------------------------------------------------------------------------------+
| Footer Status: Local MLX Engine Ready | RAM: 1.1 GB / 2.5 GB   [Preset: Talking Head] |
+--------------------------------------------------------------------------------+
```

---

## 3. Specifications for the 10 Main Panel Views

### View 1: Dashboard
- **Purpose**: At-a-glance sequence health, quick statistics, and recent rough cuts.
- **Components**:
  - Sequence Overview card (Duration, Audio Channels, Spoken Word Count, Words/Minute).
  - Quick Action card: Prominent "Magic Rough Cut" button with mode toggle.
  - Signal Breakdown mini-chart (Estimated Silence: 24%, Fillers: 42 tokens, Repeated Takes: 6 clusters).
  - Recent Edits list (A/B comparison button to switch between Original and Rough Cut).

### View 2: Magic Rough Cut (Primary Action View)
- **Wireframe Layout**:
```
+--------------------------------------------------------------------------------+
| MAGIC ROUGH CUT                                                                |
+--------------------------------------------------------------------------------+
| Selected Sequence: "Episode_42_Interview" (Duration: 18:24)                   |
|                                                                                |
| Execution Mode:                                                                |
|   (●) Mode A: Magic Auto Edit     [Directly apply cuts to cloned sequence]     |
|   ( ) Mode B: Magic Review Edit   [Populate Review Queue for human audit]      |
|                                                                                |
| Active Profile: [ Talking Head v1.2 ▼ ]  [Customize Rules]                     |
| Included Fixes:                                                                |
|   [x] Remove Silence (> 500ms)          [x] Excise Fillers ("um", "uh")        |
|   [x] Prune Repeated Takes (Keep Best)  [x] Remove Stutters                    |
|                                                                                |
| Engine Priority: [●] Local-First (MLX)   [ ] Fast Cloud (Groq Free Tier)       |
|                                                                                |
| +----------------------------------------------------------------------------+ |
| |                    [  ✨ GENERATE MAGIC ROUGH CUT  ]                       | |
| +----------------------------------------------------------------------------+ |
|                                                                                |
| [Status: Idle | Estimated duration: 35s | Target duration: ~11:30]             |
+--------------------------------------------------------------------------------+
```

### View 3: Transcript Editor (Text-Based Timeline Editing)
- **Purpose**: Word-for-word verbatim transcript synchronized with the Premiere Pro playhead.
- **Interactions**:
  - **Single Click Word**: Moves Premiere Pro CTI (`TickTime`) to the exact audio onset of that word.
  - **Double Click Word**: Opens inline word correction input.
  - **Highlight & Backspace / Delete**: Displays action pill: `[ Delete from Timeline (Ripple) ]`.
  - **Color-Coded Highlights**:
    - Light Red background: Silence / Dead air pause.
    - Yellow background: Detected filler word.
    - Purple background: Pruned repeated take.
    - Green underline: Active playing word (dynamic karaoke follow-along).

### View 4: Review Queue
- **Purpose**: Centralized human-in-the-loop inspection of all proposed timeline edits.
- **Card Anatomy**:
```
+--------------------------------------------------------------------------------+
| REVIEW QUEUE (38 Suggestions)           [Accept All] [Reject All] [Apply (34)] |
+--------------------------------------------------------------------------------+
| Filter: [All Categories ▼] [Sort: Timeline Order ▼]                            |
|                                                                                |
| [#12] REPEATED TAKE  |  Time: 04:12.40 - 04:22.15 (Duration: 9.75s)            |
| "So the next thing we need to consider is the revenue model..."                |
| Take 2 of 3  |  Confidence: 94%  |  AI Reason: "Take 3 has better cadence & no stutters"|
| [ ▶ Play Clip ]  [ ◀ Take 1 ]  [ Take 2 (Selected) ]  [ Take 3 ]                |
| Actions:  [ ✓ Accept ]  [ ✗ Reject ]  [ ✎ Trim Bounds ]                        |
|--------------------------------------------------------------------------------|
| [#13] SILENCE REMOVAL  |  Time: 04:28.10 - 04:31.90 (Duration: 3.80s)          |
| [Audio Waveform Graphic: Dead air pause, -42 dBFS]                             |
| Actions:  [ ✓ Accept ]  [ ✗ Reject ]                                           |
+--------------------------------------------------------------------------------+
```

### View 5: Silence Detection
- **Controls**:
  - Detection Threshold slider: `-60 dBFS` to `-20 dBFS` (default: `-38 dBFS`).
  - Min Silence Duration: `200 ms` to `2000 ms` (default: `500 ms`).
  - Pre-Cut Padding: `0 ms` to `300 ms` (default: `80 ms`).
  - Post-Cut Padding: `0 ms` to `300 ms` (default: `120 ms`).
  - Interactive Audio Waveform with scrubbable cut markers.

### View 6: Repeated Takes
- **Purpose**: Dedicated workspace to compare side-by-side takes.
- **Components**:
  - List of detected Take Groups with similarity scores (e.g., 96% lexical match).
  - Mode Switcher: Last Take vs. Best Take (AI) vs. Manual.
  - Audio A/B audition player for rapid comparison.

### View 7: AI Provider Manager
- **Components**:
  - Provider list (Google Gemini, Groq, Cerebras, OpenRouter, Local MLX).
  - Status indicators (Connected, Error, Quota Warning, Free Tier Active).
  - Secure API Key input modal (keys masked with `••••••••`).
  - **Free-Only Guard Switch**: Persistent lock icon showing `Strict Free Mode (Active)`.

### View 8: Editing Profiles
- **Profiles**:
  - `Talking Head`: Tight silence removal (400ms), aggressive filler deletion, best take selection.
  - `Podcast`: Natural breathing preservation (700ms silence), cautious filler removal.
  - `Real Estate / Walkthrough`: Extended pauses preserved (1200ms), aggressive take culling.
  - `Aggressive Cut / TikTok`: Hyper-fast pacing (250ms silence), all fillers excised.
  - `Custom Profile`: User-saved presets.

### View 9: Settings
- **Options**:
  - Local Engine settings (Whisper model selection: `turbo` vs `small.en`, thread count).
  - Audio extraction strategy (FFmpeg Fast-Path vs Premiere Mixdown).
  - Cache management: `Clear Audio Cache (Currently: 340 MB)`.
  - Non-destructive naming template (Default: `{OriginalName}_PrismexRoughCut`).

### View 10: Processing History & Reports
- **Components**:
  - Chronological list of generated rough cuts.
  - Rough Cut Summary Report exportable as PDF/Markdown.
  - Revert / Undo timeline action button.

---

## 4. Keyboard Shortcuts Specification

| Keybinding | Scope | Function |
|---|---|---|
| `Space` | Global Panel | Toggle audio/video playback in Premiere Pro |
| `J` / `K` / `L` | Global Panel | Shuttle backward / pause / shuttle forward |
| `Y` or `A` | Review Queue | Accept highlighted suggestion |
| `N` or `R` | Review Queue | Reject highlighted suggestion |
| `Down Arrow` / `Up Arrow` | Review Queue | Move to next / previous suggestion card |
| `P` | Review Queue | Audition (preview play) selected cut segment |
| `Cmd + Enter` | Review Queue | Apply all approved edits to timeline |
| `Cmd + Z` | Host / Panel | Undo last timeline batch operation |
| `Esc` | Modal Views | Dismiss modal or cancel preview |

---

## 5. UI State Management & Error UX

- **Empty State**: Displays an illustrated Premiere timeline icon with message: *"No Active Sequence Found. Open a sequence in your Premiere project to begin."*
- **Processing State**: Modal backdrop with multi-stage radial progress ring, showing current subsystem (e.g., *"Step 2 of 4: Transcribing audio via MLX (45%)..."*).
- **Network Disconnect Banner**: Persistent amber pill: *"Cloud providers unreachable. Operating in Local-Only Mode."*
- **Quota Exceeded Alert**: Clean modal explaining provider limits with one-click fallback: *"Groq rate limit reached (20 RPM). Switch to local MLX-Whisper to continue without delay."*
