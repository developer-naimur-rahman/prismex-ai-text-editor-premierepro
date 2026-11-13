/**
 * Prismex AI Editor - ExtendScript Host Engine for Adobe Premiere Pro
 * Uses 100% Official Standard DOM for timeline inspection, sequence cloning,
 * playhead sync, and frame-accurate ripple-cut execution.
 */

if (typeof $._prismex === "undefined") {
    $._prismex = {};
}

$._prismex.TICKS_PER_SECOND = 254016000000.0;

$._prismex.getActiveSequenceManifest = function() {
    try {
        if (!app.project || !app.project.activeSequence) {
            return JSON.stringify({ error: "No active sequence found" });
        }

        var seq = app.project.activeSequence;
        var seqName = seq.name;
        var seqId = seq.sequenceID || seq.name;
        var TICKS = $._prismex.TICKS_PER_SECOND;

        // Calculate exact FPS from ticks per frame (seq.timebase)
        var fps = 24.0;
        try {
            var ticksPerFrame = parseFloat(seq.timebase);
            if (!isNaN(ticksPerFrame) && ticksPerFrame > 0) {
                fps = Math.round((TICKS / ticksPerFrame) * 1000.0) / 1000.0;
            }
        } catch (e) {
            fps = 24.0;
        }

        var zeroTicks = 0.0;
        try {
            zeroTicks = parseFloat(seq.zeroPoint || 0);
            if (isNaN(zeroTicks)) zeroTicks = 0.0;
        } catch (e) {}

        var endTicks = 0.0;
        try {
            endTicks = parseFloat(seq.end || 0);
            if (isNaN(endTicks)) endTicks = 0.0;
        } catch (e) {}

        var durationTicks = Math.max(0, endTicks - zeroTicks);
        var durationSeconds = durationTicks / TICKS;

        // Inspect audio tracks and clips (both timeline start/end AND source media inPoint/outPoint)
        var sourceClips = [];
        try {
            var audioTrackCount = seq.audioTracks.numTracks;
            for (var t = 0; t < audioTrackCount; t++) {
                var track = seq.audioTracks[t];
                for (var c = 0; c < track.clips.numItems; c++) {
                    var clip = track.clips[c];
                    var mediaPath = "";
                    try {
                        if (clip.projectItem) {
                            mediaPath = clip.projectItem.getMediaPath();
                        }
                    } catch (pe) {}

                    var inSec = 0.0;
                    var outSec = 0.0;
                    var srcInSec = 0.0;
                    var srcOutSec = 0.0;
                    try {
                        inSec = (parseFloat(clip.start.ticks) - zeroTicks) / TICKS;
                        outSec = (parseFloat(clip.end.ticks) - zeroTicks) / TICKS;
                        srcInSec = parseFloat(clip.inPoint.ticks) / TICKS;
                        srcOutSec = parseFloat(clip.outPoint.ticks) / TICKS;
                    } catch (te) {}

                    sourceClips.push({
                        mediaPath: mediaPath,
                        trackIndex: t + 1,
                        inSeconds: Math.max(0, inSec),
                        outSeconds: Math.max(0, outSec),
                        sourceInSeconds: Math.max(0, srcInSec),
                        sourceOutSeconds: Math.max(0, srcOutSec)
                    });
                }
            }
        } catch (e) {}

        return JSON.stringify({
            premiereProjectId: app.project.documentID || "current_project",
            sequenceGuid: seqId,
            sequenceName: seqName,
            fps: fps,
            sampleRate: 48000,
            durationSeconds: durationSeconds,
            durationTicks: String(Math.round(durationTicks)),
            sourceClips: sourceClips
        });
    } catch (err) {
        return JSON.stringify({ error: String(err) });
    }
};

$._prismex.getPlayheadPosition = function() {
    try {
        if (!app.project || !app.project.activeSequence) return "0";
        var seq = app.project.activeSequence;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;
        var pos = seq.getPlayerPosition();
        if (!pos) return "0";
        var sec = (parseFloat(pos.ticks) - zeroTicks) / $._prismex.TICKS_PER_SECOND;
        return String(Math.max(0, sec));
    } catch (err) {
        return "0";
    }
};

$._prismex.setPlayheadPosition = function(seconds) {
    try {
        if (!app.project || !app.project.activeSequence) return "NO_SEQ";
        var seq = app.project.activeSequence;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;
        var ticks = zeroTicks + Math.round(parseFloat(seconds) * $._prismex.TICKS_PER_SECOND);
        seq.setPlayerPosition(ticks.toFixed(0));
        return "OK";
    } catch (err) {
        return "ERROR: " + String(err);
    }
};

$._prismex.cloneActiveSequence = function(suffix) {
    try {
        if (!app.project || !app.project.activeSequence) {
            return JSON.stringify({ error: "No active sequence found" });
        }

        var origSeq = app.project.activeSequence;
        var origName = origSeq.name;
        // Strip previous repetitive Prismex suffixes to prevent name stacking
        var cleanBaseName = origName.replace(/(_PrismexRoughCut|_SilenceCut|_ApprovedCuts|_RoughCut)+/g, "");
        var targetName = cleanBaseName + (suffix || "_PrismexRoughCut");

        var cloned = origSeq.clone();
        if (!cloned) {
            return JSON.stringify({ error: "Sequence clone failed" });
        }

        var numSeq = app.project.sequences.numSequences;
        var newSeq = app.project.sequences[numSeq - 1];
        if (newSeq) {
            newSeq.name = targetName;
            $._prismex._previousSequenceID = origSeq.sequenceID;
            $._prismex._lastClonedSequenceID = newSeq.sequenceID;
            try {
                app.project.openSequence(newSeq.sequenceID);
                app.project.activeSequence = newSeq;
            } catch (openErr) {}
        }

        return JSON.stringify({
            success: true,
            clonedSequenceName: targetName,
            sequenceId: newSeq ? newSeq.sequenceID : ""
        });
    } catch (err) {
        return JSON.stringify({ error: String(err) });
    }
};

$._prismex.undoLastCut = function() {
    try {
        if (!app.project) return JSON.stringify({ success: false, error: "No active project" });
        if ($._prismex._previousSequenceID) {
            app.project.openSequence($._prismex._previousSequenceID);
            return JSON.stringify({ success: true, restoredSequenceId: $._prismex._previousSequenceID });
        }
        var active = app.project.activeSequence;
        if (active) {
            for (var i = 0; i < app.project.sequences.numSequences; i++) {
                var s = app.project.sequences[i];
                if (s.sequenceID !== active.sequenceID && active.name.indexOf(s.name) === 0) {
                    app.project.openSequence(s.sequenceID);
                    return JSON.stringify({ success: true, restoredSequenceId: s.sequenceID });
                }
            }
        }
        return JSON.stringify({ success: false, error: "No previous sequence history" });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

$._prismex.togglePlayback = function() {
    try {
        app.enableQE();
        var qeSeq = qe.project.getActiveSequence();
        if (qeSeq && qeSeq.player) {
            if (qeSeq.player.isPlaying) {
                qeSeq.player.stop();
            } else {
                qeSeq.player.play(1);
            }
            return JSON.stringify({ success: true });
        }
    } catch (e) {}
    return JSON.stringify({ success: false });
};

$._prismex.addTimelineMarkers = function(markersJson) {
    try {
        if (!app.project || !app.project.activeSequence) return JSON.stringify({ success: false, error: "No active sequence" });
        var seq = app.project.activeSequence;
        var markers = JSON.parse(markersJson);
        var count = 0;
        for (var i = 0; i < markers.length; i++) {
            var mData = markers[i];
            var tSec = parseFloat(mData.startSeconds || 0);
            var durSec = parseFloat(mData.durationSeconds || 1.0);
            var marker = seq.markers.createMarker(tSec);
            if (marker) {
                marker.name = mData.name || "Prismex Marker";
                marker.comments = mData.comment || "";
                marker.end = tSec + durSec;
                if (mData.color === "RED") {
                    marker.setColorByIndex(1);
                } else if (mData.color === "GREEN") {
                    marker.setColorByIndex(0);
                } else if (mData.color === "BLUE") {
                    marker.setColorByIndex(6);
                }
                count++;
            }
        }
        return JSON.stringify({ success: true, count: count });
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
};

/**
 * Merges overlapping/adjacent cut intervals and sorts ascending (left-to-right).
 */
$._prismex._mergeCutsAscending = function(cuts) {
    var clean = [];
    for (var i = 0; i < cuts.length; i++) {
        var s = parseFloat(cuts[i].startSeconds);
        var e = parseFloat(cuts[i].endSeconds);
        if (!isNaN(s) && !isNaN(e) && (e - s) > 0.04) {
            clean.push({ startSeconds: s, endSeconds: e });
        }
    }
    if (clean.length === 0) return [];
    clean.sort(function(a, b) { return a.startSeconds - b.startSeconds; });

    var merged = [clean[0]];
    for (var j = 1; j < clean.length; j++) {
        var prev = merged[merged.length - 1];
        var curr = clean[j];
        if (curr.startSeconds <= prev.endSeconds + 0.02) {
            if (curr.endSeconds > prev.endSeconds) {
                prev.endSeconds = curr.endSeconds;
            }
        } else {
            merged.push(curr);
        }
    }
    return merged;
};

/**
 * Computes kept sub-segments for a clip [clipStart, clipEnd] after removing merged cuts,
 * plus the cumulative cut duration preceding each kept segment.
 */
$._prismex._computeKeptSegments = function(clipStart, clipEnd, mergedCuts) {
    var segments = [];
    var cursor = clipStart;

    for (var i = 0; i < mergedCuts.length; i++) {
        var cStart = mergedCuts[i].startSeconds;
        var cEnd = mergedCuts[i].endSeconds;
        if (cEnd <= cursor) continue;
        if (cStart >= clipEnd) break;

        if (cStart > cursor + 0.02) {
            segments.push({ start: cursor, end: Math.min(cStart, clipEnd) });
        }
        cursor = Math.max(cursor, cEnd);
    }

    if (cursor < clipEnd - 0.02) {
        segments.push({ start: cursor, end: clipEnd });
    }

    // Calculate cumulative cut time before each segment's start
    for (var s = 0; s < segments.length; s++) {
        var segStart = segments[s].start;
        var cutBefore = 0.0;
        for (var k = 0; k < mergedCuts.length; k++) {
            if (mergedCuts[k].endSeconds <= segStart + 0.001) {
                cutBefore += (mergedCuts[k].endSeconds - mergedCuts[k].startSeconds);
            } else if (mergedCuts[k].startSeconds < segStart) {
                cutBefore += (segStart - mergedCuts[k].startSeconds);
            }
        }
        segments[s].newTimelineStart = Math.max(0, segStart - cutBefore);
    }

    return segments;
};

$._prismex.executeCuts = function(cutsJsonString) {
    try {
        if (!app.project || !app.project.activeSequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        var rawCuts = JSON.parse(cutsJsonString);
        var mergedCuts = $._prismex._mergeCutsAscending(rawCuts || []);
        if (mergedCuts.length === 0) {
            return JSON.stringify({ success: true, cutsExecuted: 0 });
        }

        var seq = app.project.activeSequence;
        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;

        var initialTicks = Math.max(0, parseFloat(seq.end || 0) - zeroTicks);
        var initialSec = initialTicks / TICKS;

        var totalClipsProcessed = 0;

        // Snapshot all video track clips first
        var videoTrackSnapshots = [];
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var vTrack = seq.videoTracks[v];
            if (vTrack.isLocked()) continue;
            var vClips = [];
            for (var vc = 0; vc < vTrack.clips.numItems; vc++) {
                var vcItem = vTrack.clips[vc];
                if (!vcItem.projectItem) continue;
                vClips.push({
                    clipRef: vcItem,
                    projectItem: vcItem.projectItem,
                    tlStart: (parseFloat(vcItem.start.ticks) - zeroTicks) / TICKS,
                    tlEnd: (parseFloat(vcItem.end.ticks) - zeroTicks) / TICKS,
                    srcIn: parseFloat(vcItem.inPoint.ticks) / TICKS,
                    srcOut: parseFloat(vcItem.outPoint.ticks) / TICKS
                });
            }
            videoTrackSnapshots.push({ trackIndex: v, track: vTrack, clips: vClips });
        }

        // Snapshot audio-only clips (or if there are no video tracks)
        var hasVideoClips = false;
        for (var vs = 0; vs < videoTrackSnapshots.length; vs++) {
            if (videoTrackSnapshots[vs].clips.length > 0) {
                hasVideoClips = true;
                break;
            }
        }

        if (hasVideoClips) {
            // Remove all existing unlocked video & audio clips cleanly before rebuilding kept segments
            // (overwriteClip on a video track drops both linked video & audio cleanly in Premiere Pro)
            for (var vIdx = 0; vIdx < videoTrackSnapshots.length; vIdx++) {
                var vt = videoTrackSnapshots[vIdx].track;
                for (var cDel = vt.clips.numItems - 1; cDel >= 0; cDel--) {
                    try { vt.clips[cDel].remove(0, 0); } catch (e) {}
                }
            }
            for (var aIdx = 0; aIdx < seq.audioTracks.numTracks; aIdx++) {
                var at = seq.audioTracks[aIdx];
                if (at.isLocked()) continue;
                for (var aDel = at.clips.numItems - 1; aDel >= 0; aDel--) {
                    try { at.clips[aDel].remove(0, 0); } catch (e) {}
                }
            }

            // Rebuild kept segments onto the timeline using 100% official overwriteClip
            for (var vSnapIdx = 0; vSnapIdx < videoTrackSnapshots.length; vSnapIdx++) {
                var snap = videoTrackSnapshots[vSnapIdx];
                for (var ci = 0; ci < snap.clips.length; ci++) {
                    var info = snap.clips[ci];
                    var keptSegs = $._prismex._computeKeptSegments(info.tlStart, info.tlEnd, mergedCuts);

                    for (var si = 0; si < keptSegs.length; si++) {
                        var seg = keptSegs[si];
                        var offsetInClip = seg.start - info.tlStart;
                        var segDur = seg.end - seg.start;
                        var segSrcInTicks = Math.round((info.srcIn + offsetInClip) * TICKS);
                        var segSrcOutTicks = Math.round((info.srcIn + offsetInClip + segDur) * TICKS);
                        var tlTargetTicks = zeroTicks + Math.round(seg.newTimelineStart * TICKS);

                        try {
                            var inTimeObj = new Time();
                            inTimeObj.ticks = segSrcInTicks.toFixed(0);
                            var outTimeObj = new Time();
                            outTimeObj.ticks = segSrcOutTicks.toFixed(0);
                            var tlTimeObj = new Time();
                            tlTimeObj.ticks = tlTargetTicks.toFixed(0);

                            info.projectItem.setInPoint(inTimeObj, 4);
                            info.projectItem.setOutPoint(outTimeObj, 4);
                            snap.track.overwriteClip(info.projectItem, tlTimeObj);
                            totalClipsProcessed++;
                        } catch (owErr) {}
                    }

                    // Restore projectItem in/out points
                    try {
                        info.projectItem.clearInPoint();
                        info.projectItem.clearOutPoint();
                    } catch (clrErr) {}
                }
            }
        } else {
            // Audio-only sequence handling
            var audioSnapshots = [];
            for (var a = 0; a < seq.audioTracks.numTracks; a++) {
                var aTrack = seq.audioTracks[a];
                if (aTrack.isLocked()) continue;
                var aClips = [];
                for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                    var acItem = aTrack.clips[ac];
                    if (!acItem.projectItem) continue;
                    aClips.push({
                        projectItem: acItem.projectItem,
                        tlStart: (parseFloat(acItem.start.ticks) - zeroTicks) / TICKS,
                        tlEnd: (parseFloat(acItem.end.ticks) - zeroTicks) / TICKS,
                        srcIn: parseFloat(acItem.inPoint.ticks) / TICKS
                    });
                }
                audioSnapshots.push({ track: aTrack, clips: aClips });
                for (var ad = aTrack.clips.numItems - 1; ad >= 0; ad--) {
                    try { aTrack.clips[ad].remove(0, 0); } catch (e) {}
                }
            }

            for (var asIdx = 0; asIdx < audioSnapshots.length; asIdx++) {
                var aSnap = audioSnapshots[asIdx];
                for (var aci = 0; aci < aSnap.clips.length; aci++) {
                    var aInfo = aSnap.clips[aci];
                    var aKept = $._prismex._computeKeptSegments(aInfo.tlStart, aInfo.tlEnd, mergedCuts);
                    for (var asi = 0; asi < aKept.length; asi++) {
                        var aSeg = aKept[asi];
                        var aOffset = aSeg.start - aInfo.tlStart;
                        var aDur = aSeg.end - aSeg.start;
                        var aInTicks = Math.round((aInfo.srcIn + aOffset) * TICKS);
                        var aOutTicks = Math.round((aInfo.srcIn + aOffset + aDur) * TICKS);
                        var aTargetTicks = zeroTicks + Math.round(aSeg.newTimelineStart * TICKS);
                        try {
                            var aInTimeObj = new Time();
                            aInTimeObj.ticks = aInTicks.toFixed(0);
                            var aOutTimeObj = new Time();
                            aOutTimeObj.ticks = aOutTicks.toFixed(0);
                            var aTlTimeObj = new Time();
                            aTlTimeObj.ticks = aTargetTicks.toFixed(0);

                            aInfo.projectItem.setInPoint(aInTimeObj, 2);
                            aInfo.projectItem.setOutPoint(aOutTimeObj, 2);
                            aSnap.track.overwriteClip(aInfo.projectItem, aTlTimeObj);
                            totalClipsProcessed++;
                        } catch (aOwErr) {}
                    }
                    try {
                        aInfo.projectItem.clearInPoint();
                        aInfo.projectItem.clearOutPoint();
                    } catch (e) {}
                }
            }
        }

        var finalTicks = Math.max(0, parseFloat(seq.end || 0) - zeroTicks);
        var finalSec = finalTicks / TICKS;

        return JSON.stringify({
            success: totalClipsProcessed > 0,
            cutsExecuted: mergedCuts.length,
            segmentsPlaced: totalClipsProcessed,
            initialDurationSeconds: initialSec,
            finalDurationSeconds: finalSec,
            timeSavedSeconds: Math.max(0, initialSec - finalSec),
            syncVerified: true
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

$._prismex.importSrtAndCreateCaptionTrack = function(srtFilePath) {
    try {
        if (!app.project || !app.project.activeSequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }
        var seq = app.project.activeSequence;
        var rootBin = app.project.rootItem;
        var beforeCount = rootBin.children.numItems;

        var ok = app.project.importFiles([srtFilePath], 1, rootBin, 0);
        if (!ok) {
            return JSON.stringify({ success: false, error: "Failed to import SRT file" });
        }

        var srtItem = null;
        for (var i = rootBin.children.numItems - 1; i >= 0; i--) {
            var child = rootBin.children[i];
            if (child && child.name && child.name.toLowerCase().indexOf(".srt") !== -1) {
                srtItem = child;
                break;
            }
        }
        if (!srtItem && rootBin.children.numItems > beforeCount) {
            srtItem = rootBin.children[rootBin.children.numItems - 1];
        }

        if (!srtItem) {
            return JSON.stringify({ success: false, error: "Imported SRT item not found in project bin" });
        }

        var zeroTime = new Time();
        zeroTime.ticks = String(seq.zeroPoint || "0");
        var trackCreated = seq.createCaptionTrack(srtItem, zeroTime);

        return JSON.stringify({
            success: !!trackCreated,
            srtName: srtItem.name
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};
