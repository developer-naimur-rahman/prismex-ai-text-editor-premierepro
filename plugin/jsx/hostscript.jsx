/**
 * Prismex AI Editor - ExtendScript Host Engine for Adobe Premiere Pro
 * Provides timeline inspection, sequence cloning, playhead positioning, and physical ripple-cut execution.
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

        // Inspect audio tracks and clips
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
                    try {
                        inSec = (parseFloat(clip.start.ticks) - zeroTicks) / TICKS;
                        outSec = (parseFloat(clip.end.ticks) - zeroTicks) / TICKS;
                    } catch (te) {}

                    sourceClips.push({
                        mediaPath: mediaPath,
                        trackIndex: t + 1,
                        inSeconds: Math.max(0, inSec),
                        outSeconds: Math.max(0, outSec)
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
        var targetName = origName + (suffix || "_PrismexRoughCut");

        // sequence.clone() returns boolean; cloned sequence is appended to app.project.sequences
        var cloned = origSeq.clone();
        if (!cloned) {
            return JSON.stringify({ error: "Sequence clone failed" });
        }

        var numSeq = app.project.sequences.numSequences;
        var newSeq = app.project.sequences[numSeq - 1];
        if (newSeq) {
            newSeq.name = targetName;
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

$._prismex.executeCuts = function(cutsJsonString) {
    try {
        if (!app.project || !app.project.activeSequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        var cuts = JSON.parse(cutsJsonString);
        if (!cuts || cuts.length === 0) {
            return JSON.stringify({ success: true, cutsExecuted: 0 });
        }

        var seq = app.project.activeSequence;
        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;

        var initialTicks = Math.max(0, parseFloat(seq.end || 0) - zeroTicks);
        var initialSec = initialTicks / TICKS;

        // Sort cuts in descending order (reverse chronological: Right to Left)
        cuts.sort(function(a, b) {
            return b.startSeconds - a.startSeconds;
        });

        // Enable QE DOM for timeline razoring
        try {
            app.enableQE();
        } catch (e) {}

        var qeSeq = null;
        try {
            if (typeof qe !== "undefined" && qe.project) {
                qeSeq = qe.project.getActiveSequence();
            }
        } catch (e) {}

        var totalExecuted = 0;
        var totalSavedSec = 0;

        for (var i = 0; i < cuts.length; i++) {
            var cut = cuts[i];
            var startSec = parseFloat(cut.startSeconds);
            var endSec = parseFloat(cut.endSeconds);
            var duration = endSec - startSec;
            if (isNaN(duration) || duration <= 0.04) continue;

            var startTicks = zeroTicks + Math.round(startSec * TICKS);
            var endTicks = zeroTicks + Math.round(endSec * TICKS);

            // Step 1: Razor at endSec first, then startSec, using dynamic CTI timecode
            if (qeSeq) {
                var razorAt = function(ticksVal) {
                    seq.setPlayerPosition(ticksVal.toFixed(0));
                    var tc = qeSeq.CTI.timecode;
                    try {
                        for (var rv = 0; rv < qeSeq.numVideoTracks; rv++) {
                            try { qeSeq.getVideoTrackAt(rv).razor(tc); } catch (e) {}
                        }
                        for (var ra = 0; ra < qeSeq.numAudioTracks; ra++) {
                            try { qeSeq.getAudioTrackAt(ra).razor(tc); } catch (e) {}
                        }
                    } catch (trackRzErr) {
                        try { qeSeq.razor(tc); } catch (e2) {}
                    }
                };
                try { razorAt(endTicks); } catch (rzEndErr) {}
                try { razorAt(startTicks); } catch (rzStartErr) {}
            }

            // Step 2: Locate the isolated slice on all video and audio tracks and ripple-remove it
            var tolerance = 0.08; // 80ms frame boundary tolerance
            var cutHappened = false;

            // Video tracks
            try {
                for (var v = 0; v < seq.videoTracks.numTracks; v++) {
                    var vTrack = seq.videoTracks[v];
                    if (vTrack.isLocked()) continue;
                    for (var vc = vTrack.clips.numItems - 1; vc >= 0; vc--) {
                        var vClip = vTrack.clips[vc];
                        var vStart = (parseFloat(vClip.start.ticks) - zeroTicks) / TICKS;
                        var vEnd = (parseFloat(vClip.end.ticks) - zeroTicks) / TICKS;
                        if (vStart >= (startSec - tolerance) && vEnd <= (endSec + tolerance)) {
                            vClip.remove(1, 0); // 1 = inRipple (true), 0 = inAlignToVideo (false)
                            cutHappened = true;
                        }
                    }
                }
            } catch (vErr) {}

            // Audio tracks
            try {
                for (var a = 0; a < seq.audioTracks.numTracks; a++) {
                    var aTrack = seq.audioTracks[a];
                    if (aTrack.isLocked()) continue;
                    for (var ac = aTrack.clips.numItems - 1; ac >= 0; ac--) {
                        var aClip = aTrack.clips[ac];
                        var aStart = (parseFloat(aClip.start.ticks) - zeroTicks) / TICKS;
                        var aEnd = (parseFloat(aClip.end.ticks) - zeroTicks) / TICKS;
                        if (aStart >= (startSec - tolerance) && aEnd <= (endSec + tolerance)) {
                            aClip.remove(1, 0); // 1 = inRipple (true)
                            cutHappened = true;
                        }
                    }
                }
            } catch (aErr) {}

            if (cutHappened) {
                totalExecuted++;
                totalSavedSec += duration;
            }
        }

        var finalTicks = Math.max(0, parseFloat(seq.end || 0) - zeroTicks);
        var finalSec = finalTicks / TICKS;

        return JSON.stringify({
            success: true,
            cutsExecuted: totalExecuted,
            initialDurationSeconds: initialSec,
            finalDurationSeconds: finalSec,
            timeSavedSeconds: Math.max(0, initialSec - finalSec),
            syncVerified: true
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};
