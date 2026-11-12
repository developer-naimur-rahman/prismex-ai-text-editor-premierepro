# 12 — Filler Word & Stutter Detection Specification

## 1. Classification & Problem Statement

Spoken English and conversational dialogue are saturated with disfluencies:
1. **Unfilled Pauses**: Silent hesitations (handled in `docs/10-SILENCE-DETECTION.md`).
2. **Filled Pauses (Vocalic Fillers)**: Involuntary vocalizations (*"um"*, *"uh"*, *"er"*, *"ah"*, *"mm"*).
3. **Discourse Markers (Lexical Fillers)**: Words used to hold the conversational floor (*"like"*, *"you know"*, *"so"*, *"actually"*, *"I mean"*).
4. **Phonemic Stutters & False Starts**: Broken syllables (*"w-w-what"*, *"th-this"*) and abrupt acoustic cutoffs.
5. **Accidental Word Duplications**: Cognitive slip restarts (*"We need to to verify the results"*).

Excising these disfluencies tightens video pacing, enhances perceived speaker authority, and saves viewer time.

---

## 2. The Core Safety Invariant: Semantic Preservation

> [!CAUTION]
> **Never remove a word if doing so alters the grammatical validity or propositional meaning of the sentence.**

### The "Like" & "So" Ambiguity Challenge:
- *Sentence A (Filler)*: "We were, **like**, waiting for forty minutes." -> Safely removable: "We were waiting for forty minutes."
- *Sentence B (Verb)*: "I **like** clean architecture and fast video rendering." -> **Removal is catastrophic**: *"I clean architecture and fast video rendering."*
- *Sentence C (Conjunction)*: "**So** we deployed the patch." -> Preserves logical causal link.
- *Sentence D (Filler)*: "**So**, um, anyway, yeah..." -> Removable leading filler.

Prismex AI Editor enforces **Contextual Semantic Classification** to ensure zero grammatical corruption.

---

## 3. Multi-Tiered Detection Architecture

```
[ Transcript Tokens Stream ]
             │
             ├───> Tier 1: Deterministic Vocalic Filter
             │      Instant match: "um", "uh", "er", "ah".
             │      Classification: 100% confidence filler.
             │
             ├───> Tier 2: Token N-Gram Duplication Matcher
             │      Sliding window regex: Detects (Token_i == Token_{i+1}).
             │      Classification: Accidental repetition.
             │
             ├───> Tier 3: Part-of-Speech & Contextual Heuristic
             │      SpaCy / Rule tagger: Flags "like" only when acting as
             │      an interjection (UH), never as verb (VBP) or preposition (IN).
             │
             └───> Tier 4: Context LLM Disambiguation (Optional Cloud/Local)
                    Resolves ambiguous multi-word fillers ("you know", "I mean").
```

---

## 4. Multi-Lingual & Custom Filler Dictionaries

Users can customize filler dictionaries per editing profile:

```json
{
  "language": "en-US",
  "deterministicVocalics": ["um", "uh", "er", "ah", "erm", "hmm"],
  "contextualFillers": [
    {
      "phrase": "like",
      "allowedPosTags": ["UH"],
      "forbiddenPosTags": ["VB", "VBP", "VBZ", "IN"]
    },
    {
      "phrase": "you know",
      "contextRequirement": "clause_boundary_or_interjection"
    },
    {
      "phrase": "I mean",
      "contextRequirement": "clause_boundary"
    },
    {
      "phrase": "kind of",
      "allowedPosTags": ["RB"]
    }
  ],
  "userCustomDisfluencies": ["basically", "literally", "sort of"]
}
```

---

## 5. Stutter & Broken Syllable Detection

Phonemic stutters present distinct acoustic and textual signatures:
1. **Acoustic Glottal Stop**: Speech abruptly terminates mid-phoneme, accompanied by a sudden drop in energy (<10ms).
2. **Text Token Repetition**: Whisper frequently decodes stutters with hyphens or repeated initial letters (*"b-but"*, *"re-really"*).
3. **Execution Rule**:
   - The engine identifies the stuttered token boundary.
   - The cut start is aligned with the onset of the initial stuttered syllable.
   - The cut end is aligned with the onset of the successful fluent syllable.
   - The stuttered false start is excised cleanly, leaving only the fluent word.

---

## 6. Review Queue Presentation & Batch Approvals

In **Magic Review Edit** mode, fillers are grouped for rapid one-click auditing:

```
+--------------------------------------------------------------------------------+
| FILLER & STUTTER SUMMARY (42 detected)                 [Select All] [Reject All]
+--------------------------------------------------------------------------------+
| [✓] 28 Vocalic Fillers ("um", "uh")                -> [ 1-Click Approve All 28 ] |
| [✓]  8 Duplicated Words ("the the", "to to")       -> [ 1-Click Approve All  8 ] |
| [?]  6 Contextual Fillers ("like", "you know")     -> [ Requires Quick Review ] |
+--------------------------------------------------------------------------------+
```

Editors can approve all 28 obvious *"um"* and *"uh"* sounds in a single keystroke, while quickly skimming the 6 ambiguous contextual items.
