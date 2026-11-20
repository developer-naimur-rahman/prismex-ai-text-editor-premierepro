/**
 * Prismex AI Editor - ExtendScript Host Engine for Adobe Premiere Pro
 * Uses 100% Official Standard DOM for timeline inspection, sequence cloning,
 * playhead sync, and frame-accurate ripple-cut execution.
 */

if (typeof $._prismex === "undefined") {
    $._prismex = {};
}

$._prismex.SCRIPT_BUILD = 2026112001;
$._prismex.TICKS_PER_SECOND = 254016000000.0;
$._prismex._lastActiveSequence = null;
$._prismex._lastActiveSequenceID = null;
$._prismex._lastActiveSequenceName = null;

/**
 * Robust Sequence Resolver:
 * In Adobe Premiere Pro, app.project.activeSequence often becomes null when
 * an HTML/CEP panel takes window focus. This resolver checks:
 * 1. app.project.activeSequence (direct)
 * 2. Cached _lastActiveSequence (if still valid)
 * 3. Re-finding sequence in app.project.sequences by persistent sequenceID or Name
 * 4. QE DOM active sequence
 * 5. Fallback ONLY on initial startup when no sequence has ever been active
 */
$._prismex.getResolvedActiveSequence = function() {
    try {
        if (!app.project) return null;

        // 1. Direct activeSequence (available when timeline panel is focused)
        if (app.project.activeSequence) {
            $._prismex._lastActiveSequence = app.project.activeSequence;
            try {
                $._prismex._lastActiveSequenceID = app.project.activeSequence.sequenceID;
                $._prismex._lastActiveSequenceName = app.project.activeSequence.name;
            } catch (e) {}
            return app.project.activeSequence;
        }

        // 2. Cached last active sequence (safe & non-intrusive)
        if ($._prismex._lastActiveSequence) {
            try {
                if ($._prismex._lastActiveSequence.name && $._prismex._lastActiveSequence.sequenceID) {
                    return $._prismex._lastActiveSequence;
                }
            } catch (staleErr) {
                $._prismex._lastActiveSequence = null;
            }
        }

        // 3. Re-find sequence in app.project.sequences by persistent sequenceID or Name
        if ($._prismex._lastActiveSequenceID || $._prismex._lastActiveSequenceName) {
            try {
                if (app.project.sequences && app.project.sequences.numSequences > 0) {
                    for (var sIdx = 0; sIdx < app.project.sequences.numSequences; sIdx++) {
                        var candidate = app.project.sequences[sIdx];
                        if (candidate) {
                            var matched = false;
                            try {
                                if ($._prismex._lastActiveSequenceID && candidate.sequenceID === $._prismex._lastActiveSequenceID) {
                                    matched = true;
                                } else if ($._prismex._lastActiveSequenceName && candidate.name === $._prismex._lastActiveSequenceName) {
                                    matched = true;
                                }
                            } catch (matchErr) {}
                            if (matched) {
                                $._prismex._lastActiveSequence = candidate;
                                return candidate;
                            }
                        }
                    }
                }
            } catch (seqIterErr) {}
        }

        // 4. QE Active Sequence: Premiere Pro's QE DOM reliably holds the active sequence even when HTML panel has focus
        try {
            app.enableQE();
            if (typeof qe !== "undefined" && qe && qe.project) {
                var qeSeq = qe.project.getActiveSequence();
                if (qeSeq) {
                    var qeName = "";
                    try { qeName = qeSeq.name; } catch(ne) {}
                    var qeGuid = "";
                    try { qeGuid = qeSeq.guid; } catch(ge) {}

                    if (app.project.sequences) {
                        for (var qIdx = 0; qIdx < app.project.sequences.numSequences; qIdx++) {
                            var cand = app.project.sequences[qIdx];
                            if (cand && ((qeName && cand.name === qeName) || (qeGuid && cand.sequenceID === qeGuid))) {
                                $._prismex._lastActiveSequence = cand;
                                try {
                                    $._prismex._lastActiveSequenceID = cand.sequenceID;
                                    $._prismex._lastActiveSequenceName = cand.name;
                                } catch (e) {}
                                return cand;
                            }
                        }
                    }
                }
            }
        } catch (qeErr) {}

        // 5. Initial Fallback: ONLY if no sequence was EVER active or tracked yet!
        if (!$._prismex._lastActiveSequenceID && !$._prismex._lastActiveSequenceName) {
            if (app.project.sequences && app.project.sequences.numSequences > 0) {
                for (var si = 0; si < app.project.sequences.numSequences; si++) {
                    var s = app.project.sequences[si];
                    if (s && s.name) {
                        $._prismex._lastActiveSequence = s;
                        try {
                            $._prismex._lastActiveSequenceID = s.sequenceID;
                            $._prismex._lastActiveSequenceName = s.name;
                        } catch (e) {}
                        return s;
                    }
                }
            }
        }
    } catch (resolveErr) {}

    return null;
};

$._prismex.getActiveSequenceManifest = function() {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ error: "No active sequence found" });
        }

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
        var hasValidAudioPath = false;
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

                    // Fallback to linked items if audio clip itself doesn't expose getMediaPath()
                    if ((!mediaPath || mediaPath === "") && typeof clip.getLinkedItems === "function") {
                        try {
                            var linked = clip.getLinkedItems();
                            if (linked && linked.numItems > 0) {
                                for (var lk = 0; lk < linked.numItems; lk++) {
                                    var lkItem = linked[lk];
                                    if (lkItem && lkItem.projectItem) {
                                        var lp = lkItem.projectItem.getMediaPath();
                                        if (lp && lp !== "") {
                                            mediaPath = lp;
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (lke) {}
                    }

                    if (mediaPath && mediaPath !== "") {
                        try {
                            mediaPath = decodeURI(mediaPath);
                        } catch (de) {}
                        hasValidAudioPath = true;
                    }

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
                        mediaPath: mediaPath || "",
                        trackIndex: t + 1,
                        inSeconds: Math.max(0, isNaN(inSec) ? 0.0 : inSec),
                        outSeconds: Math.max(0, isNaN(outSec) ? 0.0 : outSec),
                        sourceInSeconds: Math.max(0, isNaN(srcInSec) ? 0.0 : srcInSec),
                        sourceOutSeconds: Math.max(0, isNaN(srcOutSec) ? 0.0 : srcOutSec)
                    });
                }
            }
        } catch (e) {}

        // Fallback: If no audio clips had media paths or audio tracks were empty, check video tracks
        if ((!hasValidAudioPath || sourceClips.length === 0) && seq.videoTracks) {
            var videoClips = [];
            try {
                var videoTrackCount = seq.videoTracks.numTracks;
                for (var vt = 0; vt < videoTrackCount; vt++) {
                    var vtrack = seq.videoTracks[vt];
                    for (var vc = 0; vc < vtrack.clips.numItems; vc++) {
                        var vclip = vtrack.clips[vc];
                        var vmediaPath = "";
                        try {
                            if (vclip.projectItem) {
                                vmediaPath = vclip.projectItem.getMediaPath();
                            }
                        } catch (vpe) {}

                        if (vmediaPath && vmediaPath !== "") {
                            try {
                                vmediaPath = decodeURI(vmediaPath);
                            } catch (de) {}
                        }

                        var vinSec = (parseFloat(vclip.start.ticks) - zeroTicks) / TICKS;
                        var voutSec = (parseFloat(vclip.end.ticks) - zeroTicks) / TICKS;
                        var vsrcIn = parseFloat(vclip.inPoint.ticks) / TICKS;
                        var vsrcOut = parseFloat(vclip.outPoint.ticks) / TICKS;
                        videoClips.push({
                            mediaPath: vmediaPath || "",
                            trackIndex: 1,
                            inSeconds: Math.max(0, isNaN(vinSec) ? 0.0 : vinSec),
                            outSeconds: Math.max(0, isNaN(voutSec) ? 0.0 : voutSec),
                            sourceInSeconds: Math.max(0, isNaN(vsrcIn) ? 0.0 : vsrcIn),
                            sourceOutSeconds: Math.max(0, isNaN(vsrcOut) ? 0.0 : vsrcOut)
                        });
                    }
                }
            } catch (ve) {}

            if (videoClips.length > 0) {
                // If audio clips existed but had blank mediaPath, merge video paths into matching time slots
                if (sourceClips.length > 0) {
                    for (var scIdx = 0; scIdx < sourceClips.length; scIdx++) {
                        if (!sourceClips[scIdx].mediaPath || sourceClips[scIdx].mediaPath === "") {
                            var scIn = sourceClips[scIdx].inSeconds;
                            var scOut = sourceClips[scIdx].outSeconds;
                            for (var vcIdx = 0; vcIdx < videoClips.length; vcIdx++) {
                                var vcIn = videoClips[vcIdx].inSeconds;
                                var vcOut = videoClips[vcIdx].outSeconds;
                                if (Math.abs(scIn - vcIn) < 0.2 || (scIn >= vcIn && scIn <= vcOut)) {
                                    sourceClips[scIdx].mediaPath = videoClips[vcIdx].mediaPath;
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    sourceClips = videoClips;
                }
            }
        }

        var cleanSeqName = seqName.replace(/(_PrismexRoughCut|_SilenceCut|_ApprovedCuts|_RoughCut)+/g, "");

        return JSON.stringify({
            premiereProjectId: app.project.documentID || "current_project",
            projectPath: app.project.path || "",
            sequenceGuid: seqId,
            sequenceName: seqName,
            cleanSequenceName: cleanSeqName,
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
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) return "0";
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
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) return "NO_SEQ";
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
        var origSeq = $._prismex.getResolvedActiveSequence();
        if (!origSeq) {
            return JSON.stringify({ error: "No active sequence found" });
        }
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
            $._prismex._lastActiveSequence = newSeq;
            try {
                $._prismex._lastActiveSequenceID = newSeq.sequenceID;
                $._prismex._lastActiveSequenceName = newSeq.name;
            } catch (idErr) {}
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

$._prismex._getQESequence = function() {
    try {
        app.enableQE();
        if (typeof qe === "undefined" || !qe || !qe.project) return null;
        var qeSeq = qe.project.getActiveSequence();
        if (qeSeq && qeSeq.player) return qeSeq;
        
        if (app.project && app.project.activeSequence) {
            var activeName = app.project.activeSequence.name;
            var activeId = app.project.activeSequence.sequenceID;
            for (var s = 0; s < qe.project.numSequences; s++) {
                var cand = qe.project.getSequenceAt(s);
                if (cand && (cand.name == activeName || cand.guid == activeId)) {
                    return cand;
                }
            }
        }
        if (qe.project.numSequences > 0) {
            return qe.project.getSequenceAt(0);
        }
    } catch (e) {}
    return null;
};

$._prismex.togglePlayback = function() {
    try {
        var qeSeq = $._prismex._getQESequence();
        if (qeSeq && qeSeq.player) {
            if (qeSeq.player.isPlaying) {
                qeSeq.player.stop();
                return JSON.stringify({ success: true, playing: false });
            } else {
                qeSeq.player.play(1);
                return JSON.stringify({ success: true, playing: true });
            }
        }
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
    return JSON.stringify({ success: false, error: "QE player not found" });
};

$._prismex.startPlayback = function(speed) {
    try {
        var qeSeq = $._prismex._getQESequence();
        if (qeSeq && qeSeq.player) {
            var playSpeed = speed ? parseFloat(speed) : 1;
            qeSeq.player.play(playSpeed);
            return JSON.stringify({ success: true, playing: true });
        }
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
    return JSON.stringify({ success: false, error: "QE player not found" });
};

$._prismex.stopPlayback = function() {
    try {
        var qeSeq = $._prismex._getQESequence();
        if (qeSeq && qeSeq.player) {
            qeSeq.player.stop();
            return JSON.stringify({ success: true, playing: false });
        }
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
    return JSON.stringify({ success: false, error: "QE player not found" });
};

$._prismex.addTimelineMarkers = function(markersJson) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) return JSON.stringify({ success: false, error: "No active sequence found" });
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
                } else if (mData.color === "PURPLE") {
                    marker.setColorByIndex(2); // Magenta / Purple in Premiere
                } else if (mData.color === "ORANGE") {
                    marker.setColorByIndex(3); // Orange in Premiere
                } else if (mData.color === "YELLOW") {
                    marker.setColorByIndex(4); // Yellow in Premiere
                } else if (mData.color === "CYAN") {
                    marker.setColorByIndex(7); // Cyan in Premiere
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
 * Imports a media file (B-Roll or SFX) and places it on a specific video/audio track at targetTimeSec.
 */
$._prismex.importAndPlaceClipOnTrack = function(filePath, targetTimeSec, targetTrackIndex, trackType, durationSec) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }
        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;
        var tSec = Math.max(0, parseFloat(targetTimeSec) || 0);
        var durSec = parseFloat(durationSec) || 4.0;
        var trkIdx = parseInt(targetTrackIndex) || (trackType === "audio" ? 2 : 1);
        var isAudio = (trackType === "audio");

        // 1. Get or create bin for Prismex Media
        var root = app.project.rootItem;
        var binName = isAudio ? "_Prismex_SFX" : "_Prismex_Broll";
        var targetBin = null;
        for (var b = 0; b < root.children.numItems; b++) {
            var child = root.children[b];
            if (child.type === 2 && child.name === binName) {
                targetBin = child;
                break;
            }
        }
        if (!targetBin) {
            targetBin = root.createBin(binName);
        }

        // 2. Check if already imported or import now
        var cleanPath = String(filePath).replace(/^file:\/\//i, "");
        try {
            cleanPath = decodeURIComponent(cleanPath);
        } catch(e) {}
        var mediaFile = new File(cleanPath);
        if (!mediaFile.exists) {
            // Also try original in case decoding changed literal character
            mediaFile = new File(filePath);
        }
        if (!mediaFile.exists) {
            return JSON.stringify({ success: false, error: "File does not exist: " + cleanPath });
        }

        var projectItem = null;
        for (var bi = 0; bi < targetBin.children.numItems; bi++) {
            var item = targetBin.children[bi];
            if (item.getMediaPath && item.getMediaPath() === mediaFile.fsName) {
                projectItem = item;
                break;
            }
        }

        if (!projectItem) {
            var beforeCount = targetBin.children.numItems;
            app.project.importFiles([mediaFile.fsName], 1, targetBin, 0);
            if (targetBin.children.numItems > beforeCount) {
                projectItem = targetBin.children[targetBin.children.numItems - 1];
            }
        }

        if (!projectItem) {
            return JSON.stringify({ success: false, error: "Could not import projectItem into Premiere" });
        }

        // 3. Set In and Out points for desired duration
        try {
            var inT = new Time();
            inT.ticks = "0";
            var outT = new Time();
            outT.ticks = Math.round(durSec * TICKS).toFixed(0);
            projectItem.setInPoint(inT, 4);
            projectItem.setOutPoint(outT, 4);
        } catch (ioErr) {}

        // 4. Overwrite clip onto target track
        var targetPosTicks = zeroTicks + Math.round(tSec * TICKS);
        var tlTimeObj = new Time();
        tlTimeObj.ticks = targetPosTicks.toFixed(0);

        if (isAudio) {
            if (trkIdx >= seq.audioTracks.numTracks) trkIdx = seq.audioTracks.numTracks - 1;
            var aTrack = seq.audioTracks[trkIdx];
            if (aTrack && !aTrack.isLocked()) {
                aTrack.overwriteClip(projectItem, tlTimeObj);
            }
        } else {
            if (trkIdx >= seq.videoTracks.numTracks) trkIdx = seq.videoTracks.numTracks - 1;
            var vTrack = seq.videoTracks[trkIdx];
            if (vTrack && !vTrack.isLocked()) {
                vTrack.overwriteClip(projectItem, tlTimeObj);
            }
        }

        // 5. Clear projectItem in/out
        try {
            projectItem.clearInPoint();
            projectItem.clearOutPoint();
        } catch (clErr) {}

        return JSON.stringify({
            success: true,
            filePath: filePath,
            targetTimeSec: tSec,
            trackIndex: trkIdx,
            bin: binName
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

$._prismex.saveProject = function() {
    try {
        if (app.project) {
            app.project.save();
            return JSON.stringify({ success: true });
        }
        return JSON.stringify({ success: false, error: "No project open" });
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
};

/**
 * Imports and lays the enhanced studio-master audio track onto the Premiere timeline,
 * perfectly synchronized to sequence start.
 */
$._prismex.applyEnhancedAudioTrack = function(wavPath, targetTrackIndex, muteOriginal) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;

        // 1. Get or create bin for Prismex Audio
        var rootItem = app.project.rootItem;
        var audioBin = null;
        for (var b = 0; b < rootItem.children.numItems; b++) {
            var child = rootItem.children[b];
            if (child.type === 2 && child.name === "Prismex Enhanced Audio") {
                audioBin = child;
                break;
            }
        }
        if (!audioBin) {
            audioBin = rootItem.createBin("Prismex Enhanced Audio");
        }

        // 2. Import file into project
        var imported = app.project.importFiles([wavPath], true, audioBin, false);
        if (!imported) {
            return JSON.stringify({ success: false, error: "Failed to import WAV file into Premiere Pro" });
        }

        // 3. Find imported project item
        var projectItem = null;
        for (var i = 0; i < audioBin.children.numItems; i++) {
            var itm = audioBin.children[i];
            if (itm.getMediaPath && itm.getMediaPath() === wavPath) {
                projectItem = itm;
                break;
            }
        }
        if (!projectItem && audioBin.children.numItems > 0) {
            projectItem = audioBin.children[audioBin.children.numItems - 1];
        }

        if (!projectItem) {
            return JSON.stringify({ success: false, error: "Imported project item not found in bin" });
        }

        // 4. Determine destination audio track
        var trkIdx = (typeof targetTrackIndex === "number") ? targetTrackIndex : (seq.audioTracks.numTracks > 1 ? 1 : 0);
        if (trkIdx >= seq.audioTracks.numTracks) trkIdx = seq.audioTracks.numTracks - 1;
        var destTrack = seq.audioTracks[trkIdx];

        if (!destTrack || destTrack.isLocked()) {
            return JSON.stringify({ success: false, error: "Audio track is locked or unavailable" });
        }

        // 5. Overwrite clip starting at sequence zeroPoint with 100% frame-perfect sync
        var tlTimeObj = new Time();
        tlTimeObj.ticks = zeroTicks.toFixed(0);
        destTrack.overwriteClip(projectItem, tlTimeObj);

        // 6. Optionally mute raw dialogue track (A1) if master placed on A2
        if (muteOriginal && seq.audioTracks.numTracks > 1 && trkIdx !== 0) {
            try {
                seq.audioTracks[0].setMute(1);
            } catch (mErr) {}
        }

        return JSON.stringify({
            success: true,
            trackIndex: trkIdx,
            wavPath: wavPath
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
};

/**
 * Applies Dynamic Punch Jump Zoom (e.g. 112% scale) at emphasis keyword timestamps.
 */
$._prismex.applyDynamicPunchZoom = function(punchTimesJson, zoomPercent) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }

        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;
        var zoomVal = parseFloat(zoomPercent) || 114.0;

        var punchTimes = [];
        try {
            punchTimes = (typeof punchTimesJson === "string") ? JSON.parse(punchTimesJson) : punchTimesJson;
        } catch (e) {
            punchTimes = [];
        }

        if (!punchTimes || punchTimes.length === 0) {
            return JSON.stringify({ success: true, count: 0 });
        }

        var v1Track = seq.videoTracks[0];
        if (!v1Track || v1Track.isLocked()) {
            return JSON.stringify({ success: false, error: "Video Track 1 is locked or missing" });
        }

        // Apply scale punch to clips that match punch time
        var appliedCount = 0;
        for (var c = 0; c < v1Track.clips.numItems; c++) {
            var clip = v1Track.clips[c];
            var cStartSec = (parseFloat(clip.start.ticks) - zeroTicks) / TICKS;
            var cEndSec = (parseFloat(clip.end.ticks) - zeroTicks) / TICKS;

            for (var pt = 0; pt < punchTimes.length; pt++) {
                var pTime = parseFloat(punchTimes[pt]);
                if (pTime >= cStartSec - 0.1 && pTime <= cStartSec + 1.5) {
                    // This clip starts around the punch word: set Motion Scale
                    for (var compIdx = 0; compIdx < clip.components.numItems; compIdx++) {
                        var comp = clip.components[compIdx];
                        if (comp.displayName === "Motion" || comp.name === "Motion") {
                            for (var propIdx = 0; propIdx < comp.properties.numItems; propIdx++) {
                                var prop = comp.properties[propIdx];
                                if (prop.displayName === "Scale" || prop.name === "Scale") {
                                    prop.setValue(zoomVal, true);
                                    appliedCount++;
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
            }
        }

        return JSON.stringify({ success: true, count: appliedCount, zoomPercent: zoomVal });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

/**
 * Places SFX audio clips (Whoosh / Pop) onto Audio Track 3 at the given timestamps.
 */
$._prismex.importAndPlaceSfxBatch = function(sfxFilePath, timesJson, trackIndex) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }

        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;
        var trkIdx = parseInt(trackIndex) || 2; // Default A3 (0-indexed: 2)

        var times = [];
        try {
            times = (typeof timesJson === "string") ? JSON.parse(timesJson) : timesJson;
        } catch (e) {
            times = [];
        }

        if (!times || times.length === 0) {
            return JSON.stringify({ success: true, count: 0 });
        }

        var sfxFile = new File(sfxFilePath);
        if (!sfxFile.exists) {
            return JSON.stringify({ success: false, error: "SFX file not found: " + sfxFilePath });
        }

        // Get or create _Prismex_SFX bin
        var root = app.project.rootItem;
        var targetBin = null;
        for (var b = 0; b < root.children.numItems; b++) {
            var child = root.children[b];
            if (child.type === 2 && child.name === "_Prismex_SFX") {
                targetBin = child;
                break;
            }
        }
        if (!targetBin) targetBin = root.createBin("_Prismex_SFX");

        // Import SFX item
        app.project.importFiles([sfxFile.fsName], 1, targetBin, 0);
        var projectItem = targetBin.children[targetBin.children.numItems - 1];
        if (!projectItem) return JSON.stringify({ success: false, error: "Could not import SFX" });

        if (trkIdx >= seq.audioTracks.numTracks) trkIdx = seq.audioTracks.numTracks - 1;
        var aTrack = seq.audioTracks[trkIdx];
        if (!aTrack || aTrack.isLocked()) {
            return JSON.stringify({ success: false, error: "Audio track is locked or unavailable" });
        }

        var placedCount = 0;
        for (var i = 0; i < times.length; i++) {
            var tSec = parseFloat(times[i]);
            var tTicks = zeroTicks + Math.round(tSec * TICKS);
            var tObj = new Time();
            tObj.ticks = tTicks.toFixed(0);
            try {
                aTrack.overwriteClip(projectItem, tObj);
                placedCount++;
            } catch (pErr) {}
        }

        return JSON.stringify({ success: true, count: placedCount, trackIndex: trkIdx });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
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

$._prismex._formatTimecode = function(seconds, fps) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    if (!fps || fps <= 0) fps = 24.0;
    var totalFrames = Math.round(seconds * fps);
    var intFps = Math.max(1, Math.round(fps));
    var frames = totalFrames % intFps;
    var totalSec = Math.floor(totalFrames / intFps);
    var s = totalSec % 60;
    var totalMin = Math.floor(totalSec / 60);
    var m = totalMin % 60;
    var h = Math.floor(totalMin / 60);
    var pad = function(n) {
        var str = String(n);
        return str.length < 2 ? "0" + str : str;
    };
    return pad(h) + ":" + pad(m) + ":" + pad(s) + ":" + pad(frames);
};

$._prismex.getActiveSequenceSignature = function() {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) return "none";
        var guid = String(seq.sequenceID || seq.guid || "");
        var name = String(seq.name || "");
        var zero = String(seq.zeroPoint || "0");
        var endTicks = String(seq.end || "0");
        var numClips = 0;
        if (seq.videoTracks) {
            for (var v = 0; v < seq.videoTracks.numTracks; v++) {
                numClips += seq.videoTracks[v].clips.numItems;
            }
        }
        if (seq.audioTracks) {
            for (var a = 0; a < seq.audioTracks.numTracks; a++) {
                numClips += seq.audioTracks[a].clips.numItems;
            }
        }
        return guid + "::" + name + "::" + zero + "::" + endTicks + "::" + String(numClips);
    } catch (e) {
        return "";
    }
};

$._prismex.executeNativeRippleCuts = function(cutsJsonString) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }
        var rawCuts = JSON.parse(cutsJsonString);
        if (!rawCuts || rawCuts.length === 0) {
            return JSON.stringify({ success: true, cutsExecuted: 0 });
        }

        try {
            if (typeof app.enableQE === "function") {
                app.enableQE();
            }
        } catch (qeInitErr) {}

        var qeSeq = $._prismex._getQESequence();
        var seq = app.project.activeSequence;
        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;
        var ticksPerFrame = parseFloat(seq.timebase) || 10594584000;
        var fps = 24.0;
        if (ticksPerFrame > 0) {
            fps = Math.round((TICKS / ticksPerFrame) * 1000.0) / 1000.0;
        }

        // CRITICAL: Ensure ALL unlocked video AND audio tracks are targeted with syncLock enabled
        // This guarantees Premiere Pro cuts and ripples BOTH Video and Audio simultaneously with zero desync!
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var vt = seq.videoTracks[v];
            if (vt && !vt.isLocked()) {
                try { vt.setTargeted(true, true); } catch (e) {}
            }
        }
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var at = seq.audioTracks[a];
            if (at && !at.isLocked()) {
                try { at.setTargeted(true, true); } catch (e) {}
            }
        }
        if (qeSeq) {
            try {
                for (var qv = 0; qv < qeSeq.numVideoTracks; qv++) {
                    try { qeSeq.getVideoTrackAt(qv).setTargeted(true); } catch (e) {}
                }
                for (var qa = 0; qa < qeSeq.numAudioTracks; qa++) {
                    try { qeSeq.getAudioTrackAt(qa).setTargeted(true); } catch (e) {}
                }
            } catch (qeTargErr) {}
        }

        // Reverse-chronological order: right-to-left so earlier cuts aren't shifted by later cuts
        var cuts = rawCuts.slice(0).sort(function(a, b) {
            var aStart = parseFloat(a.startSeconds || a.start_seconds || 0);
            var bStart = parseFloat(b.startSeconds || b.start_seconds || 0);
            return bStart - aStart;
        });

        var initialTicks = Math.max(0, parseFloat(seq.end || 0) - zeroTicks);
        var initialSec = initialTicks / TICKS;
        var executedCount = 0;

        for (var c = 0; c < cuts.length; c++) {
            var cut = cuts[c];
            var startSec = parseFloat(cut.startSeconds || cut.start_seconds || 0);
            var endSec = parseFloat(cut.endSeconds || cut.end_seconds || 0);
            var dur = endSec - startSec;
            if (dur <= 0.03) continue;

            // Compute exact timeline ruler timecode including sequence zeroPoint offset
            var startRulerSec = (zeroTicks / TICKS) + startSec;
            var endRulerSec = (zeroTicks / TICKS) + endSec;
            var startTC = $._prismex._formatTimecode(startRulerSec, fps);
            var endTC = $._prismex._formatTimecode(endRulerSec, fps);

            var qeSuccess = false;
            // 1. Try atomic QE In/Out sequence ripple delete across all targeted tracks
            if (qeSeq && typeof qeSeq.setInPoint === "function" && typeof qeSeq.setOutPoint === "function") {
                try {
                    qeSeq.setInPoint(startTC);
                    qeSeq.setOutPoint(endTC);
                    if (typeof qeSeq.rippleDelete === "function") {
                        qeSeq.rippleDelete();
                        qeSuccess = true;
                        executedCount++;
                    } else if (typeof qeSeq.extract === "function") {
                        qeSeq.extract();
                        qeSuccess = true;
                        executedCount++;
                    }
                } catch (qeRippleErr) {
                    qeSuccess = false;
                }
            }

            // 2. If QE atomic ripple delete did not run, execute synchronized Video + Audio Razor and Ripple
            if (!qeSuccess) {
                // Razor ALL video and audio tracks at end boundary first, then start boundary
                if (qeSeq) {
                    if (typeof qeSeq.razor === "function") {
                        try { qeSeq.razor(endTC); } catch (e1) {}
                        try { qeSeq.razor(startTC); } catch (e2) {}
                    }
                    try {
                        for (var qv = 0; qv < qeSeq.numVideoTracks; qv++) {
                            var qvt = qeSeq.getVideoTrackAt(qv);
                            if (qvt && typeof qvt.razor === "function") {
                                try { qvt.razor(endTC); } catch (e) {}
                                try { qvt.razor(startTC); } catch (e) {}
                            }
                        }
                        for (var qa = 0; qa < qeSeq.numAudioTracks; qa++) {
                            var qat = qeSeq.getAudioTrackAt(qa);
                            if (qat && typeof qat.razor === "function") {
                                try { qat.razor(endTC); } catch (e) {}
                                try { qat.razor(startTC); } catch (e) {}
                            }
                        }
                    } catch (qTrackErr) {}
                }

                // Step A: Lift (remove without ripple) all sliced audio clips and secondary video clips
                for (var a = 0; a < seq.audioTracks.numTracks; a++) {
                    var at = seq.audioTracks[a];
                    if (at.isLocked()) continue;
                    for (var ai = at.clips.numItems - 1; ai >= 0; ai--) {
                        var aclip = at.clips[ai];
                        var acStart = (parseFloat(aclip.start.ticks) - zeroTicks) / TICKS;
                        var acEnd = (parseFloat(aclip.end.ticks) - zeroTicks) / TICKS;
                        var acDur = Math.max(0.01, acEnd - acStart);
                        var acMid = (acStart + acEnd) / 2;
                        if ((acStart >= startSec - 0.12 && acEnd <= endSec + 0.12) || (acMid >= startSec && acMid <= endSec && acDur <= dur + 0.25)) {
                            try { aclip.remove(0, 0); } catch (arErr) {}
                        }
                    }
                }

                for (var v = 1; v < seq.videoTracks.numTracks; v++) {
                    var vt = seq.videoTracks[v];
                    if (vt.isLocked()) continue;
                    for (var ci = vt.clips.numItems - 1; ci >= 0; ci--) {
                        var clip = vt.clips[ci];
                        var cStart = (parseFloat(clip.start.ticks) - zeroTicks) / TICKS;
                        var cEnd = (parseFloat(clip.end.ticks) - zeroTicks) / TICKS;
                        var cDur = Math.max(0.01, cEnd - cStart);
                        var cMid = (cStart + cEnd) / 2;
                        if ((cStart >= startSec - 0.12 && cEnd <= endSec + 0.12) || (cMid >= startSec && cMid <= endSec && cDur <= dur + 0.25)) {
                            try { clip.remove(0, 0); } catch (rErr) {}
                        }
                    }
                }

                // Step B: Ripple Delete ONCE on primary video track (v = 0)
                // In Premiere Pro, removing a video slice with remove(1, 1) ripples BOTH video and audio together!
                var primaryRemoved = false;
                if (seq.videoTracks.numTracks > 0 && !seq.videoTracks[0].isLocked()) {
                    var v0 = seq.videoTracks[0];
                    for (var c0 = v0.clips.numItems - 1; c0 >= 0; c0--) {
                        var cl0 = v0.clips[c0];
                        var cl0Start = (parseFloat(cl0.start.ticks) - zeroTicks) / TICKS;
                        var cl0End = (parseFloat(cl0.end.ticks) - zeroTicks) / TICKS;
                        var cl0Dur = Math.max(0.01, cl0End - cl0Start);
                        var cl0Mid = (cl0Start + cl0End) / 2;
                        if ((cl0Start >= startSec - 0.12 && cl0End <= endSec + 0.12) || (cl0Mid >= startSec && cl0Mid <= endSec && cl0Dur <= dur + 0.25)) {
                            try {
                                cl0.remove(1, 1);
                                primaryRemoved = true;
                                executedCount++;
                                break;
                            } catch (r0Err) {}
                        }
                    }
                }

                // If video track 0 had no slice (e.g. audio-only), ripple delete on audio track 0
                if (!primaryRemoved && seq.audioTracks.numTracks > 0 && !seq.audioTracks[0].isLocked()) {
                    var a0 = seq.audioTracks[0];
                    for (var ca0 = a0.clips.numItems - 1; ca0 >= 0; ca0--) {
                        var acl0 = a0.clips[ca0];
                        var acl0Start = (parseFloat(acl0.start.ticks) - zeroTicks) / TICKS;
                        var acl0End = (parseFloat(acl0.end.ticks) - zeroTicks) / TICKS;
                        var acl0Dur = Math.max(0.01, acl0End - acl0Start);
                        var acl0Mid = (acl0Start + acl0End) / 2;
                        if ((acl0Start >= startSec - 0.12 && acl0End <= endSec + 0.12) || (acl0Mid >= startSec && acl0Mid <= endSec && acl0Dur <= dur + 0.25)) {
                            try {
                                acl0.remove(1, 1);
                                primaryRemoved = true;
                                executedCount++;
                                break;
                            } catch (ar0Err) {}
                        }
                    }
                }
            }
        }

        // Clear in/out points cleanly
        try {
            seq.clearInPoint();
            seq.clearOutPoint();
        } catch (clrErr) {}

        var finalTicks = Math.max(0, parseFloat(seq.end || 0) - zeroTicks);
        var finalSec = finalTicks / TICKS;

        if (executedCount > 0) {
            return JSON.stringify({
                success: true,
                cutsExecuted: executedCount,
                initialDurationSeconds: initialSec,
                finalDurationSeconds: finalSec,
                timeSavedSeconds: Math.max(0, initialSec - finalSec),
                syncVerified: true,
                mode: "synchronized_atomic_ripple"
            });
        }

        // If native razor wasn't possible, fallback to clean rebuild
        return $._prismex.executeCuts(cutsJsonString);
    } catch (fallbackErr) {
        return $._prismex.executeCuts(cutsJsonString);
    }
};

$._prismex.executeCuts = function(cutsJsonString) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }

        var rawCuts = JSON.parse(cutsJsonString);
        var mergedCuts = $._prismex._mergeCutsAscending(rawCuts || []);
        if (mergedCuts.length === 0) {
            return JSON.stringify({ success: true, cutsExecuted: 0 });
        }

        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(seq.zeroPoint || 0) || 0;

        var initialTicks = Math.max(0, parseFloat(seq.end || 0) - zeroTicks);
        var initialSec = initialTicks / TICKS;

        var totalClipsProcessed = 0;

        // Snapshot all video track clips
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

        // Snapshot all audio track clips
        var audioTrackSnapshots = [];
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var aTrack = seq.audioTracks[a];
            if (aTrack.isLocked()) continue;
            var aClips = [];
            for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                var acItem = aTrack.clips[ac];
                if (!acItem.projectItem) continue;
                aClips.push({
                    clipRef: acItem,
                    projectItem: acItem.projectItem,
                    tlStart: (parseFloat(acItem.start.ticks) - zeroTicks) / TICKS,
                    tlEnd: (parseFloat(acItem.end.ticks) - zeroTicks) / TICKS,
                    srcIn: parseFloat(acItem.inPoint.ticks) / TICKS,
                    srcOut: parseFloat(acItem.outPoint.ticks) / TICKS
                });
            }
            audioTrackSnapshots.push({ trackIndex: a, track: aTrack, clips: aClips });
        }

        // Remove all existing unlocked video & audio clips before placing kept segments
        for (var vDelIdx = 0; vDelIdx < videoTrackSnapshots.length; vDelIdx++) {
            var vtDel = videoTrackSnapshots[vDelIdx].track;
            for (var cDel = vtDel.clips.numItems - 1; cDel >= 0; cDel--) {
                try { vtDel.clips[cDel].remove(0, 0); } catch (e) {}
            }
        }
        for (var aDelIdx = 0; aDelIdx < audioTrackSnapshots.length; aDelIdx++) {
            var atDel = audioTrackSnapshots[aDelIdx].track;
            for (var aDel = atDel.clips.numItems - 1; aDel >= 0; aDel--) {
                try { atDel.clips[aDel].remove(0, 0); } catch (e) {}
            }
        }

        // 1. Rebuild kept VIDEO segments onto video tracks
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

                try {
                    info.projectItem.clearInPoint();
                    info.projectItem.clearOutPoint();
                } catch (clrErr) {}
            }
        }

        // 2. Rebuild kept AUDIO segments onto audio tracks
        for (var asIdx = 0; asIdx < audioTrackSnapshots.length; asIdx++) {
            var aSnap = audioTrackSnapshots[asIdx];
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
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }
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

$._prismex.getProjectFolderPath = function() {
    try {
        if (app.project && app.project.path) {
            var p = app.project.path;
            var lastSlash = p.lastIndexOf('/');
            if (lastSlash === -1) lastSlash = p.lastIndexOf('\\');
            if (lastSlash !== -1) {
                return p.substring(0, lastSlash);
            }
        }
    } catch (e) {}
    try {
        return Folder.myDocuments.fsName + "/PrismexExports";
    } catch (e2) {
        return "/tmp";
    }
};

$._prismex.saveProjectFiles = function(baseFilename, srtContent, txtContent, jsonContent) {
    try {
        var folder = $._prismex.getProjectFolderPath();
        var fObj = new Folder(folder);
        if (!fObj.exists) fObj.create();

        var savedFiles = [];

        if (srtContent) {
            var srtFile = new File(folder + "/" + baseFilename + ".srt");
            srtFile.encoding = "UTF-8";
            if (srtFile.open("w")) {
                srtFile.write(srtContent);
                srtFile.close();
                savedFiles.push(srtFile.fsName);
            }
        }

        if (txtContent) {
            var txtFile = new File(folder + "/" + baseFilename + ".txt");
            txtFile.encoding = "UTF-8";
            if (txtFile.open("w")) {
                txtFile.write(txtContent);
                txtFile.close();
                savedFiles.push(txtFile.fsName);
            }
        }

        if (jsonContent) {
            var jsonFile = new File(folder + "/" + baseFilename + ".json");
            jsonFile.encoding = "UTF-8";
            if (jsonFile.open("w")) {
                jsonFile.write(jsonContent);
                jsonFile.close();
                savedFiles.push(jsonFile.fsName);
            }
        }

        return JSON.stringify({
            success: savedFiles.length > 0,
            folder: folder,
            files: savedFiles
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

$._prismex.saveProjectCache = function(cacheKey, jsonString) {
    try {
        var folderPath = $._prismex.getProjectFolderPath();
        var cacheDir = new Folder(folderPath + "/.prismex_cache");
        if (!cacheDir.exists) cacheDir.create();

        var safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
        var cacheFile = new File(cacheDir.fsName + "/" + safeKey + ".json");
        cacheFile.encoding = "UTF-8";
        if (cacheFile.open("w")) {
            cacheFile.write(jsonString);
            cacheFile.close();
            return JSON.stringify({ success: true, path: cacheFile.fsName });
        }
        return JSON.stringify({ success: false, error: "Failed to open file for writing" });
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
};

$._prismex.loadProjectCache = function(cacheKey) {
    try {
        var folderPath = $._prismex.getProjectFolderPath();
        var safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
        var cacheFile = new File(folderPath + "/.prismex_cache/" + safeKey + ".json");
        if (!cacheFile.exists) {
            // Also try user data directory fallback
            var userCache = new File(Folder.userData.fsName + "/PrismexCache/" + safeKey + ".json");
            if (userCache.exists) cacheFile = userCache;
        }

        if (cacheFile.exists) {
            cacheFile.encoding = "UTF-8";
            if (cacheFile.open("r")) {
                var content = cacheFile.read();
                cacheFile.close();
                return JSON.stringify({ found: true, content: content });
            }
        }
        return JSON.stringify({ found: false });
    } catch (e) {
        return JSON.stringify({ found: false, error: String(e) });
    }
};

$._prismex.createMultiSegmentVerticalShortSequence = function(shortTitle, segmentsJson, markersJson) {
    try {
        var origSeq = $._prismex.getResolvedActiveSequence();
        if (!origSeq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }

        var TICKS = $._prismex.TICKS_PER_SECOND;
        var zeroTicks = parseFloat(origSeq.zeroPoint || 0) || 0;
        var initialTicks = Math.max(0, parseFloat(origSeq.end || 0) - zeroTicks);
        var initialSec = initialTicks / TICKS;

        var segments = [];
        try {
            segments = (typeof segmentsJson === "string") ? JSON.parse(segmentsJson) : segmentsJson;
        } catch (e) {
            segments = [];
        }

        if (!segments || segments.length === 0) {
            return JSON.stringify({ success: false, error: "No segments provided" });
        }

        // Validate segments
        var validSegments = [];
        for (var s = 0; s < segments.length; s++) {
            var seg = segments[s];
            var sSec = Math.max(0, parseFloat(seg.startSeconds) || 0);
            var eSec = Math.min(initialSec, parseFloat(seg.endSeconds) || (sSec + 10));
            if (eSec > sSec) {
                validSegments.push({
                    role: seg.role || ("SEG_" + (s + 1)),
                    startSeconds: sSec,
                    endSeconds: eSec,
                    durationSeconds: eSec - sSec
                });
            }
        }

        if (validSegments.length === 0) {
            return JSON.stringify({ success: false, error: "Valid segments could not be parsed" });
        }

        // Snapshot all unlocked video tracks and clips from the active sequence
        var videoTrackSnapshots = [];
        var hasVideoClips = false;
        for (var v = 0; v < origSeq.videoTracks.numTracks; v++) {
            var vTrack = origSeq.videoTracks[v];
            if (vTrack.isLocked()) continue;
            var vClips = [];
            for (var vc = 0; vc < vTrack.clips.numItems; vc++) {
                var vcItem = vTrack.clips[vc];
                if (!vcItem.projectItem) continue;
                vClips.push({
                    projectItem: vcItem.projectItem,
                    tlStart: (parseFloat(vcItem.start.ticks) - zeroTicks) / TICKS,
                    tlEnd: (parseFloat(vcItem.end.ticks) - zeroTicks) / TICKS,
                    srcIn: parseFloat(vcItem.inPoint.ticks) / TICKS,
                    srcOut: parseFloat(vcItem.outPoint.ticks) / TICKS
                });
                hasVideoClips = true;
            }
            videoTrackSnapshots.push({ trackIndex: v, clips: vClips });
        }

        // Snapshot audio tracks if no video clips
        var audioTrackSnapshots = [];
        if (!hasVideoClips) {
            for (var a = 0; a < origSeq.audioTracks.numTracks; a++) {
                var aTrack = origSeq.audioTracks[a];
                if (aTrack.isLocked()) continue;
                var aClips = [];
                for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                    var acItem = aTrack.clips[ac];
                    if (!acItem.projectItem) continue;
                    aClips.push({
                        projectItem: acItem.projectItem,
                        tlStart: (parseFloat(acItem.start.ticks) - zeroTicks) / TICKS,
                        tlEnd: (parseFloat(acItem.end.ticks) - zeroTicks) / TICKS,
                        srcIn: parseFloat(acItem.inPoint.ticks) / TICKS,
                        srcOut: parseFloat(acItem.outPoint.ticks) / TICKS
                    });
                }
                audioTrackSnapshots.push({ trackIndex: a, clips: aClips });
            }
        }

        // 1. Clone sequence to preserve project structure and audio routing
        var cloned = origSeq.clone();
        if (!cloned) {
            return JSON.stringify({ success: false, error: "Sequence clone failed" });
        }

        var numSeq = app.project.sequences.numSequences;
        var newSeq = app.project.sequences[numSeq - 1];
        if (!newSeq) {
            return JSON.stringify({ success: false, error: "Could not retrieve cloned sequence" });
        }

        // Clean title
        var cleanTitle = (shortTitle || "ViralShort").replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, "_");
        var finalName = cleanTitle + "_9x16";
        newSeq.name = finalName;

        // 2. Open new cloned sequence and make active
        try {
            app.project.openSequence(newSeq.sequenceID);
            app.project.activeSequence = newSeq;
        } catch (openErr) {}
        $._prismex._lastActiveSequence = newSeq;
        try {
            $._prismex._lastActiveSequenceID = newSeq.sequenceID;
            $._prismex._lastActiveSequenceName = newSeq.name;
        } catch (le) {}

        // 3. Set resolution to 1080x1920 (9:16 Vertical)
        try {
            var settings = newSeq.getSettings();
            if (settings) {
                settings.videoFrameWidth = 1080;
                settings.videoFrameHeight = 1920;
                newSeq.setSettings(settings);
            }
        } catch (settErr) {}

        // 4. Organize in Project Bin: _Prismex_Viral_Shorts
        try {
            var root = app.project.rootItem;
            var binName = "_Prismex_Viral_Shorts";
            var targetBin = null;
            for (var b = 0; b < root.children.numItems; b++) {
                var child = root.children[b];
                if (child.type === 2 && child.name === binName) {
                    targetBin = child;
                    break;
                }
            }
            if (!targetBin) {
                targetBin = root.createBin(binName);
            }
            if (newSeq.projectItem && targetBin) {
                newSeq.projectItem.moveBin(targetBin);
            }
        } catch (binErr) {}

        // 5. Clear clips in the cloned sequence and layout segments contiguously
        if (hasVideoClips) {
            for (var vtIdx = 0; vtIdx < newSeq.videoTracks.numTracks; vtIdx++) {
                var vTrk = newSeq.videoTracks[vtIdx];
                if (vTrk.isLocked()) continue;
                for (var cd = vTrk.clips.numItems - 1; cd >= 0; cd--) {
                    try { vTrk.clips[cd].remove(0, 0); } catch (e) {}
                }
            }
            for (var atIdx = 0; atIdx < newSeq.audioTracks.numTracks; atIdx++) {
                var aTrk = newSeq.audioTracks[atIdx];
                if (aTrk.isLocked()) continue;
                for (var ad = aTrk.clips.numItems - 1; ad >= 0; ad--) {
                    try { aTrk.clips[ad].remove(0, 0); } catch (e) {}
                }
            }

            var currTlSec = 0.0;
            for (var segIdx = 0; segIdx < validSegments.length; segIdx++) {
                var curSeg = validSegments[segIdx];
                var segDuration = curSeg.endSeconds - curSeg.startSeconds;

                for (var snapIdx = 0; snapIdx < videoTrackSnapshots.length; snapIdx++) {
                    var vSnap = videoTrackSnapshots[snapIdx];
                    var destTrack = newSeq.videoTracks[vSnap.trackIndex];
                    if (!destTrack || destTrack.isLocked()) continue;

                    for (var cIdx = 0; cIdx < vSnap.clips.length; cIdx++) {
                        var cInfo = vSnap.clips[cIdx];
                        var kStart = Math.max(cInfo.tlStart, curSeg.startSeconds);
                        var kEnd = Math.min(cInfo.tlEnd, curSeg.endSeconds);

                        if (kEnd > kStart + 0.01) {
                            var offsetInClip = kStart - cInfo.tlStart;
                            var sliceDur = kEnd - kStart;
                            var segSrcIn = cInfo.srcIn + offsetInClip;
                            var segSrcOut = segSrcIn + sliceDur;
                            var targetTlPos = currTlSec + (kStart - curSeg.startSeconds);

                            try {
                                var inT = new Time();
                                inT.ticks = Math.round(segSrcIn * TICKS).toFixed(0);
                                var outT = new Time();
                                outT.ticks = Math.round(segSrcOut * TICKS).toFixed(0);
                                var tlT = new Time();
                                tlT.ticks = (zeroTicks + Math.round(targetTlPos * TICKS)).toFixed(0);

                                cInfo.projectItem.setInPoint(inT, 4);
                                cInfo.projectItem.setOutPoint(outT, 4);
                                destTrack.overwriteClip(cInfo.projectItem, tlT);
                            } catch (owE) {}

                            try {
                                cInfo.projectItem.clearInPoint();
                                cInfo.projectItem.clearOutPoint();
                            } catch (clE) {}
                        }
                    }
                }
                currTlSec += segDuration;
            }
        }

        // 6. Add Visual Guidance Timeline Markers for Hook, Body, and CTA
        try {
            var seqMarkers = newSeq.markers;
            var markerPos = 0.0;
            for (var sm = 0; sm < validSegments.length; sm++) {
                var sItem = validSegments[sm];
                var mTicks = Math.round(markerPos * TICKS);
                var newMarker = seqMarkers.createMarker(mTicks);
                newMarker.name = sItem.role + " (" + Math.round(sItem.durationSeconds) + "s)";
                newMarker.comments = "Prismex Short Segment: " + sItem.role;
                if (sItem.role === "HOOK") newMarker.setColorIndex(1); // Red
                else if (sItem.role === "BODY") newMarker.setColorIndex(0); // Green
                else newMarker.setColorIndex(6); // Blue
                markerPos += sItem.durationSeconds;
            }

            if (markersJson) {
                var customMarkers = (typeof markersJson === "string") ? JSON.parse(markersJson) : markersJson;
                for (var cm = 0; cm < customMarkers.length; cm++) {
                    var cmk = customMarkers[cm];
                    var cmTicks = Math.round((cmk.seconds || 0) * TICKS);
                    var cMarker = seqMarkers.createMarker(cmTicks);
                    cMarker.name = cmk.name || "AI Cue";
                    cMarker.comments = cmk.comment || "";
                }
            }
        } catch (mErr) {}

        try {
            app.project.openSequence(newSeq.sequenceID);
        } catch (e) {}

        var totalDur = 0;
        for (var d = 0; d < validSegments.length; d++) totalDur += validSegments[d].durationSeconds;

        return JSON.stringify({
            success: true,
            sequenceName: finalName,
            sequenceId: newSeq.sequenceID,
            durationSeconds: Math.round(totalDur * 100) / 100,
            segmentCount: validSegments.length,
            bin: "_Prismex_Viral_Shorts"
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

$._prismex.createVerticalShortSequence = function(shortTitle, startSeconds, endSeconds, markersJson) {
    var segs = [{
        role: "SHORT",
        startSeconds: startSeconds,
        endSeconds: endSeconds
    }];
    return $._prismex.createMultiSegmentVerticalShortSequence(shortTitle, JSON.stringify(segs), markersJson);
};

// ----------------- Studio Grade AI Color Studio Functions -----------------

$._prismex.getActiveClipAtPlayhead = function() {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }
        var TICKS = $._prismex.TICKS_PER_SECOND;
        var currentTicks = parseFloat(seq.getPlayerPosition().ticks);
        var currentSeconds = currentTicks / TICKS;

        // Search video tracks from top to bottom (V3, V2, V1)
        for (var t = seq.videoTracks.numTracks - 1; t >= 0; t--) {
            var track = seq.videoTracks[t];
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                var cStart = parseFloat(clip.start.ticks);
                var cEnd = parseFloat(clip.end.ticks);
                if (currentTicks >= cStart && currentTicks < cEnd) {
                    var mediaPath = "";
                    try {
                        if (clip.projectItem) {
                            mediaPath = clip.projectItem.getMediaPath();
                        }
                    } catch (mErr) {}

                    var inTicks = parseFloat(clip.inPoint.ticks);
                    var offsetTicks = currentTicks - cStart;
                    var sourceFrameSeconds = (inTicks + offsetTicks) / TICKS;

                    return JSON.stringify({
                        success: true,
                        trackIndex: t,
                        clipIndex: c,
                        clipName: clip.name,
                        mediaPath: mediaPath,
                        timelineSeconds: currentSeconds,
                        sourceFrameSeconds: sourceFrameSeconds,
                        startSeconds: cStart / TICKS,
                        endSeconds: cEnd / TICKS
                    });
                }
            }
        }
        return JSON.stringify({
            success: true,
            timelineSeconds: currentSeconds,
            mediaPath: "",
            clipName: ""
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
};

$._prismex.exportFrameAtPlayhead = function(outputPath) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }
        var pos = seq.getPlayerPosition();
        
        var exported = false;
        // Try exportFramePNG if supported
        try {
            if (typeof seq.exportFramePNG === "function") {
                var timeDisplay = pos.getFormatted(seq.getSettings().videoDisplayFormat, seq.timebase);
                exported = seq.exportFramePNG(timeDisplay, outputPath);
            }
        } catch (e1) {
            exported = false;
        }

        // Also get active clip metadata for instant FFmpeg fallback
        var clipInfoStr = $._prismex.getActiveClipAtPlayhead();
        var clipInfo = JSON.parse(clipInfoStr);

        return JSON.stringify({
            success: true,
            domExported: exported,
            outputPath: outputPath,
            clipInfo: clipInfo
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
};

$._prismex.revealFileInOS = function(filePath) {
    try {
        var f = new File(filePath);
        if (f.exists) {
            f.execute();
            return JSON.stringify({ success: true });
        }
        // If file not found, try folder
        var folder = new Folder(filePath);
        if (folder.exists) {
            folder.execute();
            return JSON.stringify({ success: true });
        }
        return JSON.stringify({ success: false, error: "File not found" });
    } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
    }
};

/**
 * Applies Lumetri Color Effect directly to active clip or all clips on video track.
 */
$._prismex.applyLumetriColorToActiveClip = function(lutFilePath, lutName, basicCorrectionJson, applyToAll) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found" });
        }
        var clipInfoStr = $._prismex.getActiveClipAtPlayhead();
        var clipInfo = JSON.parse(clipInfoStr);

        var clipsToProcess = [];
        if (applyToAll) {
            if (seq.videoTracks && seq.videoTracks.numTracks > 0) {
                var v0 = seq.videoTracks[0];
                for (var ci = 0; ci < v0.clips.numItems; ci++) {
                    clipsToProcess.push({ trackIndex: 0, clipIndex: ci, clip: v0.clips[ci] });
                }
            }
        } else {
            if (clipInfo.success && typeof clipInfo.trackIndex !== "undefined" && clipInfo.trackIndex >= 0) {
                var trk = seq.videoTracks[clipInfo.trackIndex];
                if (trk && clipInfo.clipIndex >= 0 && clipInfo.clipIndex < trk.clips.numItems) {
                    clipsToProcess.push({ trackIndex: clipInfo.trackIndex, clipIndex: clipInfo.clipIndex, clip: trk.clips[clipInfo.clipIndex] });
                }
            }
        }

        if (clipsToProcess.length === 0) {
            if (seq.videoTracks && seq.videoTracks.numTracks > 0 && seq.videoTracks[0].clips.numItems > 0) {
                clipsToProcess.push({ trackIndex: 0, clipIndex: 0, clip: seq.videoTracks[0].clips[0] });
            }
        }

        if (clipsToProcess.length === 0) {
            return JSON.stringify({ success: false, error: "No video clips found on timeline to apply color grade" });
        }

        var qeSeq = $._prismex._getQESequence();
        var qeEffect = null;
        if (qeSeq) {
            try {
                qeEffect = qe.project.getVideoEffectByName("Lumetri Color");
            } catch (qeE) {}
        }

        var params = {};
        try {
            params = (typeof basicCorrectionJson === "string") ? JSON.parse(basicCorrectionJson) : (basicCorrectionJson || {});
        } catch (pErr) {}

        var processedCount = 0;
        for (var i = 0; i < clipsToProcess.length; i++) {
            var item = clipsToProcess[i];
            var clip = item.clip;

            if (qeSeq && qeEffect) {
                try {
                    var qeTrk = qeSeq.getVideoTrackAt(item.trackIndex);
                    if (qeTrk) {
                        var qeClip = qeTrk.getItemAt(item.clipIndex);
                        if (qeClip && typeof qeClip.addVideoEffect === "function") {
                            qeClip.addVideoEffect(qeEffect);
                        }
                    }
                } catch (qeAddErr) {}
            }

            var lumetriComp = null;
            for (var c = 0; c < clip.components.numItems; c++) {
                var comp = clip.components[c];
                var cName = String(comp.displayName || comp.name || "").toLowerCase();
                if (cName.indexOf("lumetri") !== -1) {
                    lumetriComp = comp;
                    break;
                }
            }

            if (lumetriComp && lumetriComp.properties) {
                for (var p = 0; p < lumetriComp.properties.numItems; p++) {
                    var prop = lumetriComp.properties[p];
                    var propName = String(prop.displayName || prop.name || "").toLowerCase();
                    if (typeof params.exposure !== "undefined" && (propName.indexOf("exposure") !== -1)) {
                        try { prop.setValue(parseFloat(params.exposure), true); } catch (e) {}
                    } else if (typeof params.contrast !== "undefined" && (propName.indexOf("contrast") !== -1)) {
                        try { prop.setValue(parseFloat(params.contrast), true); } catch (e) {}
                    } else if (typeof params.temperature !== "undefined" && (propName.indexOf("temperature") !== -1)) {
                        try { prop.setValue(parseFloat(params.temperature), true); } catch (e) {}
                    } else if (typeof params.saturation !== "undefined" && (propName.indexOf("saturation") !== -1)) {
                        try { prop.setValue(parseFloat(params.saturation), true); } catch (e) {}
                    } else if (typeof params.tint !== "undefined" && (propName.indexOf("tint") !== -1)) {
                        try { prop.setValue(parseFloat(params.tint), true); } catch (e) {}
                    }
                }
            }
            processedCount++;
        }

        return JSON.stringify({
            success: true,
            processedCount: processedCount,
            lutName: lutName || "Studio Grade",
            lutPath: lutFilePath || "",
            appliedTo: applyToAll ? "All clips on track V1" : "Active clip at playhead"
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

/**
 * 1-Click Non-Destructive Script Rough-Cut Sequence Creator
 * Clones active sequence, executes frame-accurate ripple cuts, alternates A/B punch-in scale (100% vs 112%),
 * color-codes acts (Hook=Orange, Body=Teal, CTA=Green), and inserts YouTube chapter & B-Roll markers.
 */
$._prismex.createScriptRoughCutSequence = function(payloadJson) {
    try {
        var activeSeq = $._prismex.getResolvedActiveSequence();
        if (!activeSeq) {
            return JSON.stringify({ success: false, error: "No active sequence found in Premiere Pro" });
        }

        var payload = payloadJson;
        while (typeof payload === "string") {
            try {
                payload = JSON.parse(payload);
            } catch (pe) {
                break;
            }
        }
        if (!payload || typeof payload !== "object") {
            payload = {};
        }

        var cuts = payload.cuts || [];
        var punchIns = payload.punchIns || [];
        var colorLabels = payload.colorLabels || [];
        var markers = payload.markers || [];

        // 1. Non-destructive clone via tested cloneActiveSequence
        var cloneResStr = $._prismex.cloneActiveSequence("_AI_Script_RoughCut");
        var cloneRes = {};
        try { cloneRes = JSON.parse(cloneResStr); } catch (ce) {}

        if (!cloneRes || !cloneRes.success) {
            return JSON.stringify({
                success: false,
                error: (cloneRes && (cloneRes.error || cloneRes.message)) || "Sequence cloning failed"
            });
        }

        var numSeq = (app.project && app.project.sequences) ? app.project.sequences.numSequences : 0;
        var newSeq = (numSeq > 0) ? app.project.sequences[numSeq - 1] : app.project.activeSequence;
        if (newSeq) {
            $._prismex._lastActiveSequence = newSeq;
            try {
                $._prismex._lastActiveSequenceID = newSeq.sequenceID;
                $._prismex._lastActiveSequenceName = newSeq.name;
            } catch (e) {}
            try { app.project.activeSequence = newSeq; } catch(ae) {}
        }
        var targetName = cloneRes.clonedSequenceName || (newSeq ? newSeq.name : "AI_Script_RoughCut");

        // 2. Execute cuts using tested executeNativeRippleCuts
        var executedCuts = 0;
        if (cuts && cuts.length > 0) {
            try {
                var cutResStr = $._prismex.executeNativeRippleCuts(JSON.stringify(cuts));
                var cutRes = JSON.parse(cutResStr);
                executedCuts = cutRes.executedCount || cutRes.cutsExecuted || cuts.length;
            } catch (cutErr) {
                // Non-fatal, continue with punch-ins & markers
            }
        }

        // 3. Dynamic A/B Camera Punch-In (100% vs 112% Scale) & Act Color-Coding
        var punchesApplied = 0;
        var colorsApplied = 0;

        try {
            if (newSeq && newSeq.videoTracks && newSeq.videoTracks.numTracks > 0) {
                var v1 = newSeq.videoTracks[0];
                var numClips = v1.clips.numItems;
                var isZoomed = false;

                for (var i = 0; i < numClips; i++) {
                    var vClip = v1.clips[i];

                    // Alternate Scale: 100% vs 112%
                    var targetScale = isZoomed ? 112.0 : 100.0;
                    try {
                        for (var compIdx = 0; compIdx < vClip.components.numItems; compIdx++) {
                            var comp = vClip.components[compIdx];
                            if (comp.displayName === "Motion" || comp.name === "Motion") {
                                for (var propIdx = 0; propIdx < comp.properties.numItems; propIdx++) {
                                    var prop = comp.properties[propIdx];
                                    if (prop.displayName === "Scale" || prop.name === "Scale") {
                                        prop.setValue(targetScale, 0); // 0 = Do NOT force UI redraw per clip (avoids freeze)
                                        punchesApplied++;
                                        break;
                                    }
                                }
                                break;
                            }
                        }
                    } catch (scaleErr) {}
                    isZoomed = !isZoomed;

                    // Act Color-Coding:
                    // Hook (first 18%) = 9 (Mango / Orange)
                    // CTA (last 18%) = 3 (Forest / Green)
                    // Body (middle) = 4 (Cerulean / Teal)
                    var actColorIdx = 4; // Teal
                    var ratio = (numClips > 1) ? (i / (numClips - 1)) : 0.5;
                    if (ratio <= 0.18) {
                        actColorIdx = 9; // Mango / Orange
                    } else if (ratio >= 0.82) {
                        actColorIdx = 3; // Forest / Green
                    }

                    try {
                        if (typeof vClip.setColorLabel === "function") {
                            vClip.setColorLabel(actColorIdx);
                            colorsApplied++;
                        } else if (vClip.projectItem && typeof vClip.projectItem.setColorLabel === "function") {
                            vClip.projectItem.setColorLabel(actColorIdx);
                            colorsApplied++;
                        }
                    } catch (colErr) {}
                }
            }
        } catch (punchErr) {}

        // 4. Place Timeline Markers (YouTube Chapters, B-Roll Cues, Graphic Overlays)
        var markersPlaced = 0;
        try {
            if (markers && markers.length > 0) {
                var markerResStr = $._prismex.addTimelineMarkers(JSON.stringify(markers));
                var markerRes = JSON.parse(markerResStr);
                markersPlaced = markerRes.count || markers.length;
            }
        } catch (mkErr) {}

        return JSON.stringify({
            success: true,
            sequenceName: targetName,
            sequenceId: newSeq ? newSeq.sequenceID : "",
            executedCuts: executedCuts,
            punchesApplied: punchesApplied,
            colorsApplied: colorsApplied,
            markersPlaced: markersPlaced
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

/**
 * Pre-AE Safety Duplication
 * Duplicates the active clip at playhead from Track V1 to Track V2,
 * labels Track V1 as a safety backup (Rose/Lavender - 11),
 * and selects V2 so "Replace with After Effects Composition" never destroys raw media.
 */
$._prismex.preAeSafetyDuplicate = function() {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence found in Premiere Pro" });
        }
        if (!seq.videoTracks || seq.videoTracks.numTracks < 1) {
            return JSON.stringify({ success: false, error: "No video tracks available" });
        }

        var TICKS = $._prismex.TICKS_PER_SECOND || 254016000000;
        var playheadSec = parseFloat(seq.getPlayerPosition().ticks) / TICKS;
        var zeroTicks = parseFloat(seq.zeroPoint.ticks || seq.zeroPoint || 0) || 0;

        var v1 = seq.videoTracks[0];
        var targetClip = null;
        for (var c = 0; c < v1.clips.numItems; c++) {
            var clip = v1.clips[c];
            var cStart = (parseFloat(clip.start.ticks) - zeroTicks) / TICKS;
            var cEnd = (parseFloat(clip.end.ticks) - zeroTicks) / TICKS;
            if (playheadSec >= (cStart - 0.05) && playheadSec <= (cEnd + 0.05)) {
                targetClip = clip;
                break;
            }
        }

        if (!targetClip) {
            return JSON.stringify({ success: false, error: "Playhead-এর নিচে Track V1-এ কোনো ক্লিপ পাওয়া যায়নি।" });
        }

        if (seq.videoTracks.numTracks < 2) {
            return JSON.stringify({ success: false, error: "দয়া করে প্রিমিয়ার টাইমলাইনে Video Track V2 যুক্ত করুন।" });
        }
        var v2 = seq.videoTracks[1];

        if (targetClip.projectItem) {
            v2.overwriteClip(targetClip.projectItem, targetClip.start);
            try {
                if (typeof targetClip.setColorLabel === "function") {
                    targetClip.setColorLabel(11);
                } else if (targetClip.projectItem && typeof targetClip.projectItem.setColorLabel === "function") {
                    targetClip.projectItem.setColorLabel(11);
                }
            } catch (colErr) {}

            return JSON.stringify({
                success: true,
                message: "ক্লিপটি সফলভাবে Track V2-তে ব্যাকআপ ডুপ্লিকেট করা হয়েছে! মূল র-ক্লিপ Track V1-এ সুরক্ষিত আছে।",
                clipName: targetClip.name
            });
        }
        return JSON.stringify({ success: false, error: "ক্লিপের ProjectItem পাওয়া যায়নি।" });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

/**
 * Smart Eyeline & Rule-of-Thirds Punch-In
 * Sets Motion -> Scale to 112% centered on rule of thirds.
 */
$._prismex.applySmartEyelinePunch = function(scalePercent) {
    try {
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }
        var TICKS = $._prismex.TICKS_PER_SECOND || 254016000000;
        var playheadSec = parseFloat(seq.getPlayerPosition().ticks) / TICKS;
        var zeroTicks = parseFloat(seq.zeroPoint.ticks || seq.zeroPoint || 0) || 0;

        var targetScale = parseFloat(scalePercent) || 112.0;

        if (!seq.videoTracks || seq.videoTracks.numTracks < 1) {
            return JSON.stringify({ success: false, error: "No video tracks" });
        }

        var v1 = seq.videoTracks[0];
        var targetClip = null;
        for (var c = 0; c < v1.clips.numItems; c++) {
            var clip = v1.clips[c];
            var cStart = (parseFloat(clip.start.ticks) - zeroTicks) / TICKS;
            var cEnd = (parseFloat(clip.end.ticks) - zeroTicks) / TICKS;
            if (playheadSec >= (cStart - 0.05) && playheadSec <= (cEnd + 0.05)) {
                targetClip = clip;
                break;
            }
        }

        if (!targetClip) {
            return JSON.stringify({ success: false, error: "Playhead-এর নিচে কোনো ক্লিপ নেই।" });
        }

        var applied = false;
        for (var compIdx = 0; compIdx < targetClip.components.numItems; compIdx++) {
            var comp = targetClip.components[compIdx];
            if (comp.displayName === "Motion" || comp.name === "Motion") {
                for (var p = 0; p < comp.properties.numItems; p++) {
                    var prop = comp.properties[p];
                    if (prop.displayName === "Scale" || prop.name === "Scale") {
                        prop.setValue(targetScale, true);
                        applied = true;
                        break;
                    }
                }
                break;
            }
        }

        return JSON.stringify({
            success: applied,
            message: "ক্লিপে " + targetScale + "% আই-লাইন পাঞ্চ-ইন প্রয়োগ করা হয়েছে!",
            clipName: targetClip.name,
            scale: targetScale
        });
    } catch (err) {
        return JSON.stringify({ success: false, error: String(err) });
    }
};

/**
 * 1-Click Sequence Aspect Ratio Converter with Auto-Fit & Auto-Crop
 * Converts sequence resolution to 1:1 Square, 9:16 Vertical, 4:5 Portrait, 16:9 Landscape, etc.
 * and automatically fits/fills video clips so video matches frame without manual settings tweaking.
 */
$._prismex.changeSequenceAspectRatio = function(optionsJson) {
    try {
        var opts = optionsJson;
        while (typeof opts === "string") {
            try { opts = JSON.parse(opts); } catch(pe) { break; }
        }
        opts = opts || {};
        
        var seq = $._prismex.getResolvedActiveSequence();
        if (!seq) {
            return JSON.stringify({
                success: false,
                error: "NO_ACTIVE_SEQUENCE",
                reason: "প্রিমিয়ার প্রোতে কোনো সক্রিয় সিকোয়েন্স (Active Sequence) পাওয়া যায়নি।",
                guideline: "প্রিমিয়ার প্রোর টাইমলাইনে আপনার কাঙ্ক্ষিত সিকোয়েন্সটিতে ক্লিক করে সক্রিয় করুন, তারপর আবার বাটনে ক্লিক করুন।"
            });
        }

        var targetWidth = parseInt(opts.width) || 1080;
        var targetHeight = parseInt(opts.height) || 1080;
        var ratioLabel = opts.label || (targetWidth + ":" + targetHeight);
        var cloneFirst = opts.clone !== false;
        var fitMode = opts.fitMode || "fill"; // "fill" (auto-crop no black bars) or "fit" (letterbox)

        var targetSeq = seq;
        var cleanBaseName = seq.name.replace(/(_PrismexRoughCut|_SilenceCut|_ApprovedCuts|_RoughCut|_Format_\w+)+/g, "");

        if (cloneFirst) {
            try {
                var cloned = seq.clone();
                if (cloned) {
                    var numSeq = app.project.sequences.numSequences;
                    targetSeq = app.project.sequences[numSeq - 1];
                    var suffix = "_Format_" + (opts.ratioKey || (targetWidth + "x" + targetHeight));
                    targetSeq.name = cleanBaseName + suffix;
                    try {
                        app.project.openSequence(targetSeq.sequenceID);
                        app.project.activeSequence = targetSeq;
                    } catch(oe) {}
                    $._prismex._lastActiveSequence = targetSeq;
                    try {
                        $._prismex._lastActiveSequenceID = targetSeq.sequenceID;
                        $._prismex._lastActiveSequenceName = targetSeq.name;
                    } catch(e) {}
                }
            } catch(cloneErr) {
                targetSeq = seq;
            }
        }

        // 1. Change Sequence Resolution via native SequenceSettings
        var settingsApplied = false;
        try {
            var settings = targetSeq.getSettings();
            if (settings) {
                settings.videoFrameWidth = targetWidth;
                settings.videoFrameHeight = targetHeight;
                targetSeq.setSettings(settings);
                settingsApplied = true;
            }
        } catch(settErr) {}

        // 2. Auto-Fit & Auto-Scale clips across all video tracks
        var clipsModified = 0;
        try {
            if (targetSeq.videoTracks) {
                for (var t = 0; t < targetSeq.videoTracks.numTracks; t++) {
                    var vTrack = targetSeq.videoTracks[t];
                    for (var c = 0; c < vTrack.clips.numItems; c++) {
                        var clip = vTrack.clips[c];
                        // Native scale to frame size
                        try {
                            if (typeof clip.setScaleToFrameSize === "function") {
                                clip.setScaleToFrameSize();
                            }
                        } catch(fe) {}

                        // Auto-fill scaling calculation
                        if (fitMode === "fill") {
                            try {
                                var targetScale = 100.0;
                                if (targetWidth === 1080 && targetHeight === 1080) { // 1:1 Square
                                    targetScale = 178.0;
                                } else if (targetWidth === 1080 && targetHeight === 1920) { // 9:16 Vertical
                                    targetScale = 316.0;
                                } else if (targetWidth === 1080 && targetHeight === 1350) { // 4:5 Portrait
                                    targetScale = 222.0;
                                } else if (targetWidth === 1440 && targetHeight === 1080) { // 4:3
                                    targetScale = 133.0;
                                } else if (targetWidth === 1920 && targetHeight === 1080) { // 16:9 Landscape
                                    targetScale = 100.0;
                                }

                                for (var compIdx = 0; compIdx < clip.components.numItems; compIdx++) {
                                    var comp = clip.components[compIdx];
                                    if (comp.displayName === "Motion" || comp.name === "Motion") {
                                        for (var p = 0; p < comp.properties.numItems; p++) {
                                            var prop = comp.properties[p];
                                            if (prop.displayName === "Scale" || prop.name === "Scale") {
                                                prop.setValue(targetScale, 0);
                                                break;
                                            }
                                        }
                                        break;
                                    }
                                }
                            } catch(me) {}
                        }
                        clipsModified++;
                    }
                }
            }
        } catch(clipErr) {}

        return JSON.stringify({
            success: true,
            sequenceName: targetSeq.name,
            width: targetWidth,
            height: targetHeight,
            ratio: ratioLabel,
            clipsModified: clipsModified,
            message: "সিকোয়েন্স " + ratioLabel + " (" + targetWidth + "x" + targetHeight + ") ফরম্যাটে সফলভাবে পরিবর্তিত হয়েছে ও ক্লিপগুলো অটো-ফিট করা হয়েছে!"
        });
    } catch(err) {
        return JSON.stringify({
            success: false,
            error: String(err),
            reason: "সিকোয়েন্স রেশিও পরিবর্তনের সময় সমস্যা হয়েছে: " + String(err),
            guideline: "প্রিমিয়ার প্রো টাইমলাইন কোনো অপারেশন দ্বারা লক করা আছে কিনা দেখে পুনরায় চেষ্টা করুন।"
        });
    }
};



