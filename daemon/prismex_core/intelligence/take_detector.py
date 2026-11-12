"""
TakeDetector - Repeated Take & Restart Clustering Engine
Specification: docs/11-REPEATED-TAKE-DETECTION.md

Identifies repeated sentences, false starts, and re-recordings.
Supports Last Take (deterministic), Best Take (fluency scored), and Hybrid modes.
"""

import uuid
from typing import List, Dict, Any, Optional

class TakeDetector:
    @staticmethod
    def calculate_levenshtein_similarity(s1: str, s2: str) -> float:
        """Calculates normalized Levenshtein similarity between two strings [0.0, 1.0]."""
        s1 = s1.lower().strip()
        s2 = s2.lower().strip()
        if s1 == s2:
            return 1.0
        if not s1 or not s2:
            return 0.0

        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]

        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                cost = 0 if s1[i - 1] == s2[j - 1] else 1
                dp[i][j] = min(
                    dp[i - 1][j] + 1,       # deletion
                    dp[i][j - 1] + 1,       # insertion
                    dp[i - 1][j - 1] + cost # substitution
                )

        distance = dp[m][n]
        max_len = max(m, n)
        return 1.0 - (distance / max_len)

    @staticmethod
    def calculate_token_jaccard(s1: str, s2: str) -> float:
        """Calculates token-level Jaccard similarity between two sentences."""
        tokens1 = set(s1.lower().split())
        tokens2 = set(s2.lower().split())
        if not tokens1 or not tokens2:
            return 0.0
        intersection = tokens1.intersection(tokens2)
        union = tokens1.union(tokens2)
        return len(intersection) / len(union)

    @classmethod
    def calculate_combined_similarity(cls, s1: str, s2: str) -> float:
        """Combines Levenshtein string similarity and token Jaccard overlap."""
        lev = cls.calculate_levenshtein_similarity(s1, s2)
        jaccard = cls.calculate_token_jaccard(s1, s2)
        
        # Check for matching initial prefix (common in restarts e.g., "The primary benefit...")
        words1 = s1.lower().split()
        words2 = s2.lower().split()
        prefix_len = 0
        for w1, w2 in zip(words1, words2):
            if w1 == w2:
                prefix_len += 1
            else:
                break
        prefix_bonus = 0.20 if prefix_len >= 3 else 0.0

        return max(lev, jaccard) + prefix_bonus

    @classmethod
    def detect_take_clusters(
        cls,
        sentences: List[Dict[str, Any]],
        take_mode: str = "BEST_TAKE",
        time_horizon_seconds: float = 90.0,
        similarity_threshold: float = 0.55
    ) -> List[Dict[str, Any]]:
        """
        Clusters repeated takes occurring within a sliding time horizon.
        Generates editing suggestions marking rejected takes for excision.
        """
        if not sentences:
            return []

        clusters: List[List[Dict[str, Any]]] = []
        assigned_indices = set()

        # Step 1: Cluster sentences
        for i in range(len(sentences)):
            if i in assigned_indices:
                continue

            current_cluster = [sentences[i]]
            assigned_indices.add(i)

            for j in range(i + 1, len(sentences)):
                if j in assigned_indices:
                    continue

                # Check temporal proximity
                time_delta = sentences[j]["start_seconds"] - sentences[i]["end_seconds"]
                if time_delta > time_horizon_seconds:
                    break

                # Check textual similarity
                sim = cls.calculate_combined_similarity(
                    sentences[i]["sentence"],
                    sentences[j]["sentence"]
                )

                if sim >= similarity_threshold:
                    current_cluster.append(sentences[j])
                    assigned_indices.add(j)

            if len(current_cluster) > 1:
                clusters.append(current_cluster)

        # Step 2: Formulate Cut Suggestions based on configured mode
        suggestions: List[Dict[str, Any]] = []

        for cluster in clusters:
            cluster_id = f"take_grp_{uuid.uuid4().hex[:8]}"
            total_candidates = len(cluster)

            # Score each candidate: fluency heuristic based on duration, word count, absence of disfluencies
            scored_candidates = []
            for idx, candidate in enumerate(cluster):
                words = candidate.get("words", [])
                stutters = sum(1 for w in words if w.get("is_stutter"))
                fillers = sum(1 for w in words if w.get("is_filler"))
                
                # Length and cadence score
                word_count = len(words)
                duration = max(0.1, candidate["end_seconds"] - candidate["start_seconds"])
                wps = word_count / duration # Words per second
                
                # Heuristic fluency score: penalty for stutters/fillers, reward natural pacing (2.0-3.5 wps)
                pace_penalty = abs(wps - 2.8) * 0.5
                fluency_score = 10.0 - (stutters * 3.0) - (fillers * 1.5) - pace_penalty
                fluency_score = max(1.0, min(10.0, fluency_score))

                scored_candidates.append({
                    "candidate_index": idx + 1,
                    "sentence": candidate,
                    "fluency_score": fluency_score
                })

            # Determine best take
            if take_mode == "LAST_TAKE":
                # Deterministic final take
                best_idx = total_candidates
            else:
                # Highest fluency score; tie-breaker goes to later take
                sorted_by_score = sorted(
                    scored_candidates, 
                    key=lambda c: (c["fluency_score"], c["candidate_index"]), 
                    reverse=True
                )
                best_idx = sorted_by_score[0]["candidate_index"]

            # Generate prune suggestions for all non-recommended takes
            for item in scored_candidates:
                c_idx = item["candidate_index"]
                sent = item["sentence"]
                is_recommended = (c_idx == best_idx)

                if not is_recommended:
                    suggestions.append({
                        "id": f"sugg_take_{uuid.uuid4().hex[:8]}",
                        "category": "REPEATED_TAKE",
                        "status": "ACCEPTED" if take_mode != "MANUAL" else "PENDING",
                        "start_seconds": sent["start_seconds"],
                        "end_seconds": sent["end_seconds"],
                        "duration_seconds": round(sent["end_seconds"] - sent["start_seconds"], 3),
                        "confidence": 0.94,
                        "reason": f"Take {c_idx} of {total_candidates} (Replaced by Take {best_idx})",
                        "transcript_snippet": sent["sentence"],
                        "take_details": {
                            "cluster_id": cluster_id,
                            "candidate_index": c_idx,
                            "total_candidates": total_candidates,
                            "is_recommended": False,
                            "fluency_score": item["fluency_score"]
                        }
                    })

        return suggestions
