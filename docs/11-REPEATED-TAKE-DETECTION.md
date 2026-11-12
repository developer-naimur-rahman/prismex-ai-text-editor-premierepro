# 11 — Repeated Take Detection & Best-Take Selection

## 1. Problem Definition: The Video Restart Phenomenon

During solo video production (YouTube, tutorials, corporate presentations, courses), speakers frequently stumble, stop mid-sentence, pause for a breath, and re-record the line:

> *"So the primary benefit of our architecture is... wait, sorry. Let me do that again. [Pause]*  
> *The primary benefit of our architecture is that it scales to ten thousand users... [Pause]*  
> *The primary benefit of our architecture is that it effortlessly scales to ten thousand concurrent users."*

In manual editing, finding these restarts, comparing deliveries, and excising the botched attempts consumes hours.

Prismex AI Editor automatically clusters these restart sequences into structured **Take Groups** and determines which take to retain.

---

## 2. Clustering & Linguistic Matching Algorithm

To identify that two distant spoken segments represent the same intended line, Prismex combines three similarity tiers:

```
[ Transcript Sentences Stream ]
               │
               ├───> 1. Lexical Token Overlap (Jaccard / ROUGE-1)
               │      Fast filter: Do sentences share > 50% key nouns/verbs?
               │
               ├───> 2. Sequence Edit Distance (Normalized Levenshtein)
               │      String-level alignment: Distance < 0.35 threshold.
               │
               └───> 3. Semantic Embedding Similarity (all-MiniLM-L6-v2 / Cosine)
                      Captures paraphrased restarts: Cosine similarity > 0.82.
                               │
                               ▼
               [ Take Group Cluster Formed ]
               - Candidate Take 1 (01:14 - 01:22)
               - Candidate Take 2 (01:24 - 01:31)
               - Candidate Take 3 (01:33 - 01:42)
```

### Proximity Horizon:
Take restarts typically occur within close proximity. Prismex restricts automatic take cluster evaluation to a sliding **90-second horizon**. Utterances separated by more than 90 seconds are assumed to be intentional recurring themes rather than restarts (unless manually flagged).

---

## 3. The Three Operating Modes (+ Hybrid Mode)

### Mode 1: Last Take Mode (100% Deterministic & Offline)
- **Philosophy**: Standard creator convention is to keep repeating a line until getting it right, then moving on. Therefore, the **chronologically final take** in a cluster is almost always the intended delivery.
- **AI Dependency**: **Zero AI tokens required**. Operates 100% locally via simple timeline timestamp ordering.
- **Action**: Marks Takes 1 through $N-1$ for deletion; retains Take $N$.

### Mode 2: Best Take Mode (AI-Assisted Quality Evaluation)
- **Philosophy**: Speakers occasionally deliver a brilliant second take, attempt a third take that sounds rushed or fatigued, and mistakenly move on.
- **Evaluation Dimensions**:
  1. **Fluency & Stutter Score**: Evaluates absence of speech hesitations, false starts, and repeated words.
  2. **Completeness & Grammar**: Verifies that the sentence reached terminal closure without trailing off.
  3. **Vocal Energy & Clarity**: Evaluates acoustic waveform dynamics (audio RMS consistency, pitch variance, articulation rate).
- **Engine**: Groq Llama 3.3 70B, Google Gemini Flash, or local MiniLM evaluation.

### Mode 3: Manual Selection Mode
- **Philosophy**: Complete editorial autonomy.
- **Action**: The system detects the cluster and displays all take variations in the Review Queue. The user auditions each take and clicks their preferred selection.

### Mode 4: Hybrid Mode (Default Production Setting)
- Pre-selects the **Last Take** as the default baseline.
- Runs an asynchronous, non-blocking AI evaluation on earlier candidates.
- If an earlier take scores significantly higher in fluency (+25% score differential) than the last take, Prismex flags the suggestion with an amber badge: *"Take 2 scored higher clarity than Take 3 (Last Take). Click to compare."*

---

## 4. LLM Prompt Architecture for Best-Take Evaluation

When Best-Take AI evaluation is triggered, the router submits a structured JSON prompt:

```json
{
  "system": "You are a professional video editor evaluating candidate takes of an identical spoken sentence. Evaluate each take on: 1) Fluency (absence of stutters/hesitations), 2) Articulation completeness, 3) Pacing and delivery. Return only a valid JSON response.",
  "prompt": {
    "takeClusterId": "take_grp_992",
    "candidates": [
      {
        "takeIndex": 1,
        "transcript": "So the primary benefit of our architecture is... wait, sorry. Let me do that again.",
        "durationSeconds": 4.8,
        "detectedStutters": 1,
        "isCutOff": true
      },
      {
        "takeIndex": 2,
        "transcript": "The primary benefit of our architecture is that it scales to ten thousand users.",
        "durationSeconds": 5.2,
        "detectedStutters": 0,
        "isCutOff": false
      },
      {
        "takeIndex": 3,
        "transcript": "The primary benefit of our architecture is that it effortlessly scales to ten thousand concurrent users.",
        "durationSeconds": 6.1,
        "detectedStutters": 0,
        "isCutOff": false
      }
    ]
  }
}
```

### Expected Structured Output:
```json
{
  "recommendedTakeIndex": 3,
  "confidence": 0.94,
  "reasoning": "Take 3 has complete articulation, more descriptive vocabulary ('effortlessly', 'concurrent'), and zero speech false starts.",
  "scores": {
    "take1": 2.1,
    "take2": 8.0,
    "take3": 9.4
  }
}
```

---

## 5. Timeline Cut Execution for Repeated Takes

When a take candidate is rejected for pruning:
1. The start boundary is aligned to the word onset of the first token in the rejected take (with pre-roll padding).
2. The end boundary is aligned to the word offset of the final token in the rejected take (with post-roll padding) OR extended to bridge into the subsequent silence gap.
3. The resulting range is submitted to the **Cut Decision Harmonizer** to ensure it cleanly merges with any adjacent silence removal cuts.
