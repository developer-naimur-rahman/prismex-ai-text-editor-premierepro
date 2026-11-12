# 23 — Local Daemon API Reference (REST & WebSocket)

## 1. Gateway Overview

The **Prismex Core Companion Daemon** exposes a local REST and WebSocket server bound strictly to the loopback interface:
- **Base URL**: `http://127.0.0.1:49152`
- **WebSocket URL**: `ws://127.0.0.1:49152/ws/events`
- **Protocol**: HTTP/1.1 and JSON-RPC 2.0 over WebSocket
- **Security**: Cross-Origin Resource Sharing (CORS) restricted to Adobe UXP origins (`plugin://*`).

---

## 2. REST Endpoints Specification

### 2.1 System & Health

#### `GET /health`
Checks daemon health, version, and memory usage.
- **Response `200 OK`**:
```json
{
  "status": "HEALTHY",
  "version": "1.0.0",
  "daemonUptimeSeconds": 3840,
  "memoryUsageMB": 185.4,
  "isAppleSilicon": true,
  "activeModel": null
}
```

---

### 2.2 Sequence & Job Management

#### `POST /api/v1/jobs/magic-rough-cut`
Initiates the 14-stage Magic Rough Cut pipeline.
- **Request Body**:
```json
{
  "premiereProjectId": "proj_a1b2c3d4",
  "sequenceGuid": "f8a9e2bc-3341-4c12-98ab-001122334455",
  "sequenceName": "Episode_14_Raw_Interview",
  "fps": 23.976,
  "sampleRate": 48000,
  "durationSeconds": 1104.5,
  "executionMode": "REVIEW_EDIT", // or "AUTO_EDIT"
  "profileId": "talking-head-v1",
  "sourceClips": [
    {
      "mediaPath": "/Volumes/VideoSSD/Footage/A_Roll_01.MOV",
      "trackIndex": 1,
      "inSeconds": 0.0,
      "outSeconds": 1104.5
    }
  ]
}
```
- **Response `202 Accepted`**:
```json
{
  "jobId": "job_01h9z2x3c4v5",
  "status": "INITIALIZING",
  "estimatedDurationSeconds": 42.0,
  "wsSubscriptionUrl": "ws://127.0.0.1:49152/ws/events?jobId=job_01h9z2x3c4v5"
}
```

#### `GET /api/v1/jobs/{job_id}`
Returns the current execution status and telemetry of an ongoing or completed job.
- **Response `200 OK`**:
```json
{
  "jobId": "job_01h9z2x3c4v5",
  "status": "ANALYZING",
  "currentStage": "REPEATED_TAKE_DETECTION",
  "progressPercent": 78.5,
  "elapsedSeconds": 24.3,
  "residentMemoryMB": 1280.0,
  "error": null
}
```

#### `POST /api/v1/jobs/{job_id}/cancel`
Gracefully halts job execution, clears scratch files, and unloads active models.
- **Response `200 OK`**:
```json
{
  "jobId": "job_01h9z2x3c4v5",
  "status": "CANCELLED"
}
```

---

### 2.3 Review Queue & Cut Decision List

#### `GET /api/v1/review-queue/{job_id}`
Retrieves all generated suggestions for human review.
- **Response `200 OK`**:
```json
{
  "jobId": "job_01h9z2x3c4v5",
  "totalSuggestions": 2,
  "suggestions": [
    {
      "id": "sugg_101",
      "category": "SILENCE",
      "status": "PENDING",
      "startSeconds": 14.20,
      "endSeconds": 16.80,
      "durationSeconds": 2.60,
      "confidence": 0.98,
      "reason": "Dead air pause (-44 dBFS)",
      "transcriptSnippet": "[Silence 2.6s]"
    },
    {
      "id": "sugg_102",
      "category": "REPEATED_TAKE",
      "status": "ACCEPTED",
      "startSeconds": 45.10,
      "endSeconds": 54.30,
      "durationSeconds": 9.20,
      "confidence": 0.94,
      "reason": "Take 1 of 3 (Restarted at 56.10)",
      "transcriptSnippet": "So the first thing we should talk about is...",
      "takeDetails": {
        "clusterId": "take_grp_09",
        "candidateIndex": 1,
        "totalCandidates": 3,
        "isRecommended": false
      }
    }
  ]
}
```

#### `POST /api/v1/review-queue/{job_id}/apply`
Submits final approved review items to generate the execution plan for Premiere Pro.
- **Request Body**:
```json
{
  "approvedSuggestionIds": ["sugg_101", "sugg_102"]
}
```
- **Response `200 OK`**:
```json
{
  "cutPlanId": "plan_998877",
  "totalCuts": 2,
  "cuts": [
    {
      "startSeconds": 14.20,
      "endSeconds": 16.80,
      "startTick": "3607027200000",
      "endTick": "4267468800000"
    },
    {
      "startSeconds": 45.10,
      "endSeconds": 54.30,
      "startTick": "11456121600000",
      "endTick": "13793068800000"
    }
  ]
}
```

---

### 2.4 Credential & Provider Management

#### `POST /api/v1/providers/{provider_id}/key`
Securely saves a provider API key into the macOS Keychain.
- **Request Body**:
```json
{
  "apiKey": "gsk_abcd1234efgh5678"
}
```
- **Response `200 OK`**:
```json
{
  "providerId": "groq-cloud",
  "keyStatus": "CONFIGURED",
  "maskedKey": "gsk_••••••••5678"
}
```

---

## 3. WebSocket Event Streaming (`ws://127.0.0.1:49152/ws/events`)

The daemon pushes real-time telemetry over a persistent WebSocket connection:

### Event: `job.progress`
```json
{
  "jsonrpc": "2.0",
  "method": "job.progress",
  "params": {
    "jobId": "job_01h9z2x3c4v5",
    "stage": "TRANSCRIBING",
    "percentComplete": 45.0,
    "elapsedSeconds": 14.2,
    "message": "Transcribing speech via mlx-whisper (Chunk 2/5)..."
  }
}
```

### Event: `job.completed`
```json
{
  "jsonrpc": "2.0",
  "method": "job.completed",
  "params": {
    "jobId": "job_01h9z2x3c4v5",
    "totalDurationSavedSeconds": 312.4,
    "totalCutsSuggested": 48,
    "outputMode": "REVIEW_QUEUE"
  }
}
```

### Event: `system.memory_warning`
```json
{
  "jsonrpc": "2.0",
  "method": "system.memory_warning",
  "params": {
    "currentUsageMB": 2350,
    "ceilingMB": 2500,
    "actionTaken": "Evicting auxiliary models and clearing GPU cache."
  }
}
```
