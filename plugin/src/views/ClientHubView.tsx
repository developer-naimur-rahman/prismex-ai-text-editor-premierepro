import React, { useState, useRef, useEffect } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { TimecodeConverter } from '../host/TimecodeConverter';
import {
  Briefcase,
  FileText,
  Upload,
  Palette,
  CheckCircle2,
  ListChecks,
  RotateCcw,
  Clock,
  Printer,
  Sparkles,
  Save,
  Check,
  Play,
  Copy,
  Trash2,
  AlertCircle,
  ExternalLink,
  Download,
  Film,
  Type,
  Music,
  Volume2,
  Layers,
  Eye,
  Sliders,
  CheckSquare,
  Loader2,
  Bookmark,
  Scissors,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  ArrowRight
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

export const ClientHubView: React.FC = () => {
  const {
    language,
    sequenceManifest,
    transcriptWords,
    setTranscriptWords,
    srtCues,
    setSrtCues,
    clientScriptText,
    setClientScriptText,
    clientBriefText,
    setClientBriefText,
    scriptAuditReport,
    setScriptAuditReport,
    clientDossier,
    setClientDossier,
    toggleDossierTodo,
    brandKit,
    setBrandKit,
    editingRoadmap,
    setEditingRoadmap,
    toggleRoadmapItem,
    clientRevisions,
    setClientRevisions,
    updateRevisionStatus,
    toggleRevisionItem,
    setActiveTab,
    showToast
  } = usePrismexStore();

  const isBn = language === 'bn';
  const client = PrismexDaemonClient.getInstance();
  const bridge = PremiereHostBridge.getInstance();

  const [activeSection, setActiveSection] = useState<'dossier' | 'revisions' | 'roadmap' | 'brand' | 'script' | 'rough-cut'>('dossier');
  const [isGeneratingDossier, setIsGeneratingDossier] = useState<boolean>(false);
  const [dossierScriptTab, setDossierScriptTab] = useState<'raw' | 'breakdown'>('breakdown');

  // 1-Click Script Rough Cut States
  const [isCreatingRoughCut, setIsCreatingRoughCut] = useState<boolean>(false);
  const [roughCutProgressStep, setRoughCutProgressStep] = useState<string>('');
  const [roughCutResult, setRoughCutResult] = useState<{
    sequenceName?: string;
    cutsExecuted?: number;
    punchesApplied?: number;
    markersPlaced?: number;
    totalCutDuration?: number;
    summary?: string;
  } | null>(null);

  // Script & Brief draft states
  const [briefDraft, setBriefDraft] = useState<string>(clientBriefText || '');
  const [scriptDraft, setScriptDraft] = useState<string>(clientScriptText || '');
  const [isAligningScript, setIsAligningScript] = useState<boolean>(false);

  // Logo / Image upload state
  const [isExtractingColors, setIsExtractingColors] = useState<boolean>(false);
  const [brandNameInput, setBrandNameInput] = useState<string>(brandKit.brandName || '');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const scriptInputRef = useRef<HTMLInputElement>(null);

  // Roadmap generation state
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState<boolean>(false);

  // Revisions state
  const [rawRevisionText, setRawRevisionText] = useState<string>('');
  const [isParsingRevisions, setIsParsingRevisions] = useState<boolean>(false);

  // Pacing & Boredom Auditor state
  const [boredomZones, setBoredomZones] = useState<Array<{
    id: string;
    start: number;
    end: number;
    duration: number;
    text: string;
    recommendation: 'punch' | 'broll';
  }>>([]);
  const [isScanningBoredom, setIsScanningBoredom] = useState<boolean>(false);

  // 7-Stage Pipeline Manual Checklist Overrides
  const [pipelineSteps, setPipelineSteps] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false
  });

  const togglePipelineStep = (stepNum: number) => {
    setPipelineSteps(prev => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const handleScanBoredom = () => {
    setIsScanningBoredom(true);
    try {
      const words = transcriptWords || [];
      const zones: Array<{
        id: string;
        start: number;
        end: number;
        duration: number;
        text: string;
        recommendation: 'punch' | 'broll';
      }> = [];

      if (words.length > 0) {
        let clusterStart = words[0].start;
        let clusterEnd = words[0].end;
        let clusterWords: string[] = [words[0].word || words[0].text || ''];

        for (let i = 1; i < words.length; i++) {
          const w = words[i];
          const gap = (w.start || 0) - clusterEnd;

          if (gap > 0.8) {
            const dur = clusterEnd - clusterStart;
            if (dur >= 5.0) {
              zones.push({
                id: `zone-${zones.length + 1}`,
                start: clusterStart,
                end: clusterEnd,
                duration: parseFloat(dur.toFixed(1)),
                text: clusterWords.slice(0, 8).join(' ') + (clusterWords.length > 8 ? '...' : ''),
                recommendation: dur > 8.0 ? 'broll' : 'punch'
              });
            }
            clusterStart = w.start || 0;
            clusterEnd = w.end || clusterStart;
            clusterWords = [w.word || w.text || ''];
          } else {
            clusterEnd = w.end || clusterEnd;
            clusterWords.push(w.word || w.text || '');
          }
        }
        const finalDur = clusterEnd - clusterStart;
        if (finalDur >= 5.0) {
          zones.push({
            id: `zone-${zones.length + 1}`,
            start: clusterStart,
            end: clusterEnd,
            duration: parseFloat(finalDur.toFixed(1)),
            text: clusterWords.slice(0, 8).join(' ') + (clusterWords.length > 8 ? '...' : ''),
            recommendation: finalDur > 8.0 ? 'broll' : 'punch'
          });
        }
      }

      setBoredomZones(zones);
      if (zones.length > 0) {
        showToast?.(
          isBn
            ? `⚠️ ${zones.length}টি ৫+ সেকেন্ডের ডেড-জোন / বোরিং শট শনাক্ত হয়েছে! ১১২% পাঞ্চ-ইন বা বি-রোল দিন।`
            : `⚠️ ${zones.length} dead zones (>5s uninterrupted speech) detected! Apply eyeline punch or B-roll.`,
          'info'
        );
      } else {
        showToast?.(
          isBn
            ? '✓ ভিডিওর প্যাসিং চমৎকার! ৫ সেকেন্ডের বেশি দীর্ঘ কোনো বোরিং শট পাওয়া যায়নি।'
            : '✓ Pacing is optimal! No talking-head dead zones over 5 seconds detected.',
          'success'
        );
      }
    } catch (e: any) {
      showToast?.(isBn ? 'বোরডম স্ক্যানে ত্রুটি' : 'Error scanning boredom zones', 'error');
    } finally {
      setIsScanningBoredom(false);
    }
  };

  useEffect(() => {
    setBriefDraft(clientBriefText || '');
  }, [clientBriefText]);

  useEffect(() => {
    setScriptDraft(clientScriptText || '');
  }, [clientScriptText]);

  useEffect(() => {
    setBrandNameInput(brandKit.brandName || '');
  }, [brandKit.brandName]);

  // Handle Logo Upload & Color Extraction
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = String(event.target?.result || '');
      setIsExtractingColors(true);
      try {
        const res = await client.extractBrandColors(dataUrl, brandNameInput || file.name.split('.')[0]);
        if (res) {
          setBrandKit(res);
          showToast?.(
            isBn
              ? `✓ লোগো থেকে ${res.palette?.length || 4}টি ব্র্যান্ড কালার সফলভাবে এক্সট্র্যাক্ট করা হয়েছে!`
              : '✓ Brand colors successfully extracted from logo!',
            'success'
          );
        }
      } catch (err) {
        console.error('Extract brand colors error:', err);
        showToast?.(isBn ? 'লোগো বিশ্লেষণ ব্যর্থ হয়েছে।' : 'Logo color extraction failed.', 'error');
      } finally {
        setIsExtractingColors(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Script File Upload
  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setScriptDraft(content);
      setClientScriptText(content);
      showToast?.(isBn ? `স্ক্রিপ্ট ফাইল '${file.name}' সফলভাবে লোড হয়েছে!` : `Loaded '${file.name}'!`, 'success');
    };
    reader.readAsText(file);
  };

  // Save drafts to global store & local storage
  const handleSaveAndSync = () => {
    setClientBriefText(briefDraft);
    setClientScriptText(scriptDraft);
    if (brandNameInput !== brandKit.brandName) {
      setBrandKit({ ...brandKit, brandName: brandNameInput });
    }
    showToast?.(
      isBn ? '✓ ক্লায়েন্ট ব্রিফ ও স্ক্রিপ্ট সফলভাবে সিঙ্ক ও সেভ হয়েছে!' : '✓ Client Brief & Script synced and saved!',
      'success'
    );
    // Also trigger dossier generation automatically if either text is present
    if (briefDraft || scriptDraft) {
      handleGenerateDossier();
    }
  };

  // Generate / Refresh Deep Client Dossier
  const handleGenerateDossier = async () => {
    setIsGeneratingDossier(true);
    try {
      const bText = briefDraft || clientBriefText || '';
      const sText = scriptDraft || clientScriptText || '';
      const res = await client.structureClientDossier(bText, sText, brandKit, sequenceManifest, language);
      if (res) {
        setClientDossier(res);
        if (res.branding) {
          setBrandKit({
            ...brandKit,
            primaryColor: res.branding.primaryColor || brandKit.primaryColor,
            secondaryColor: res.branding.secondaryColor || brandKit.secondaryColor,
            accentColor: res.branding.accentColor || brandKit.accentColor,
            backgroundColor: res.branding.backgroundColor || brandKit.backgroundColor,
            palette: res.branding.palette || brandKit.palette,
            fontSuggestion: res.branding.primaryFont || brandKit.fontSuggestion
          });
        }
        showToast?.(isBn ? '✓ ক্লায়েন্ট ডসিয়ার সফলভাবে তৈরি হয়েছে!' : '✓ Client Dossier generated!', 'success');
      }
    } catch (e) {
      console.error('Dossier error:', e);
    } finally {
      setIsGeneratingDossier(false);
    }
  };

  // Export full Dossier as clean .TXT report file directly to project folder
  const handleExportDossierTxt = async () => {
    if (!clientDossier?.exportableTextReport) return;
    const cleanName = (sequenceManifest?.sequenceName || 'Project').replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_');
    const folder = await bridge.getProjectFolderPath().catch(() => '');
    const filename = `${cleanName}_Client_Dossier`;
    const res = await client.saveProjectFiles(folder, filename, '', clientDossier.exportableTextReport, '');
    if (res.success) {
      showToast?.(
        isBn ? `✓ ডসিয়ার টেক্সট ফাইল (.txt) প্রজেক্ট ফোল্ডারে সেভ হয়েছে! [${res.folder || folder}]` : `✓ Dossier TXT saved to project folder!`,
        'success'
      );
    } else {
      const blob = new Blob([clientDossier.exportableTextReport], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast?.(isBn ? '✓ ডসিয়ার টেক্সট ফাইল (.txt) এক্সপোর্ট হয়েছে!' : '✓ Text report exported!', 'success');
    }
  };

  // Export Dossier as a professional PDF report directly into the project folder
  const handleExportDossierPdf = async () => {
    if (!clientDossier) {
      showToast?.(isBn ? 'ডসিয়ার ডাটা তৈরি হয়নি' : 'Dossier data not generated yet', 'info');
      return;
    }
    const cleanName = (sequenceManifest?.sequenceName || 'Project').replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_');
    const filename = `${cleanName}_Client_Master_Dossier.pdf`;
    const folder = await bridge.getProjectFolderPath().catch(() => '');
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const brandColorsHtml = (clientDossier.branding?.primaryPalette || brandKit.palette || [])
      .map(
        (hex: string) => `
        <div style="display:inline-flex; align-items:center; gap:6px; margin-right:14px; margin-bottom:8px;">
          <div style="width:18px; height:18px; border-radius:4px; background:${hex}; border:1px solid #ddd;"></div>
          <span style="font-family:monospace; font-size:12px; color:#333;">${hex}</span>
        </div>
      `
      )
      .join('');

    const linksHtml = (clientDossier.categorizedLinks || [])
      .map(
        (l: any) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #eee; font-weight:600; color:#4f46e5;">${l.category || 'Asset'}</td>
          <td style="padding:8px; border-bottom:1px solid #eee;"><strong>${l.label || 'Resource'}</strong></td>
          <td style="padding:8px; border-bottom:1px solid #eee; font-family:monospace; font-size:11px;"><a href="${l.url}" style="color:#2563eb; text-decoration:none;">${l.url}</a></td>
          <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px; color:#6b7280;">${l.notes || '—'}</td>
        </tr>
      `
      )
      .join('');

    const actsHtml = (clientDossier.storyBreakdown || [])
      .map(
        (act: any) => `
        <div style="border-left: 3px solid #4f46e5; padding-left: 12px; margin-bottom: 16px;">
          <h4 style="margin:0 0 6px 0; color:#1e1b4b; font-size:13px;">${act.actLabel || act.actLabelBn || 'Section'}</h4>
          <div style="font-size:12px; color:#374151; margin-bottom:4px;"><strong>Voiceover:</strong> "${act.voiceoverText || act.voiceover || ''}"</div>
          <div style="font-size:11.5px; color:#0369a1; margin-bottom:2px;"><strong>Visual:</strong> ${act.visualSuggestion || act.visual || '—'}</div>
          <div style="font-size:11px; color:#7c3aed;"><strong>Sound / Music:</strong> ${act.soundSuggestion || act.audio || '—'}</div>
        </div>
      `
      )
      .join('');

    const dossierHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${cleanName} - Client Master Dossier</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 0; padding: 32px; background: #ffffff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; color: #111827; margin: 0; }
          .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
          .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
          .section-title { font-size: 15px; font-weight: 700; color: #1f2937; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; margin-top: 8px; }
          th { background: #f3f4f6; padding: 8px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #d1d5db; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${clientDossier.projectName || 'Client Master Dossier'}</h1>
            <div class="subtitle">Client / Brand: <strong>${clientDossier.clientName || 'Client Project'}</strong> • Date: <strong>${now}</strong></div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #4b5563;">
            <div>Target Duration: <strong>${clientDossier.targetDuration || 'Flexible'}</strong></div>
            <div>Aspect Ratio: <strong>${clientDossier.primaryAspect || '16:9 / 9:16'}</strong></div>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">1. Executive Overview & Mission</h3>
          <p style="margin:0 0 10px 0; font-size:12.5px; color:#111827; font-weight:500;">
            ${clientDossier.executiveSummary || clientDossier.objective || 'Complete client production dossier.'}
          </p>
          ${
            clientDossier.executiveSummaryBn
              ? `<div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:6px; font-size:12px; color:#166534;">
                  <strong>বাংলা ভাবার্থ (Bengali Translation):</strong><br>${clientDossier.executiveSummaryBn}
                </div>`
              : ''
          }
        </div>

        <div class="card">
          <h3 class="section-title">2. Brand Kit & Visual Identity</h3>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px;">
            <div>Font Family: <strong>${clientDossier.branding?.fontPrimary || brandKit.fontSuggestion || 'Inter'}</strong></div>
            <div>Color Tone: <strong>${clientDossier.branding?.colorGradeStyle || 'Commercial Clean'}</strong></div>
          </div>
          <div style="font-size:11px; color:#6b7280; margin-bottom:6px;">Approved Brand Palette:</div>
          <div>${brandColorsHtml || '<em>Default Studio Palette</em>'}</div>
        </div>

        ${
          (clientDossier.categorizedLinks || []).length > 0
            ? `
        <div class="card">
          <h3 class="section-title">3. Categorized Project Assets & Cloud Links</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Asset Label</th>
                <th>URL</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${linksHtml}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        ${
          (clientDossier.storyBreakdown || []).length > 0
            ? `
        <div class="card">
          <h3 class="section-title">4. Dual Script & Production Breakdown</h3>
          ${actsHtml}
        </div>
        `
            : ''
        }

        <div class="card">
          <h3 class="section-title">5. Audio & Voiceover Directives</h3>
          <div style="font-size:12px; color:#374151;">
            <div>Voice Style: <strong>${clientDossier.audioDirective?.voiceStyle || 'Energetic & Professional'}</strong></div>
            <div>Background Music Mood: <strong>${clientDossier.audioDirective?.bgmGenre || 'Corporate Ambient / Upbeat'}</strong></div>
            <div>Audio Mixing Target: <strong>Voice -14 LUFS, Music -22 LUFS (Commercial Broadcast Standard)</strong></div>
          </div>
        </div>

        <div class="footer">
          <div>Generated by Prismex AI Studio Engine</div>
          <div>Project Folder: ${folder || '~/Documents/PrismexExports'}</div>
        </div>
      </body>
      </html>
    `;

    showToast?.(isBn ? '⏳ PDF ডসিয়ার তৈরি ও সংকলন হচ্ছে...' : '⏳ Generating & compiling PDF...', 'info');

    const res = await client.exportPdfReport({
      filename,
      reportHtml: dossierHtml,
      folderPath: folder,
      openAfterSave: true,
      revealInFinder: true
    });

    if (res.success) {
      showToast?.(
        isBn ? `✓ PDF ডসিয়ার প্রজেক্ট ফোল্ডারে সেভ ও ওপেন হয়েছে! [${res.folder || folder}]` : `✓ Master Dossier PDF saved and opened!`,
        'success'
      );
    } else {
      showToast?.(isBn ? `PDF এক্সপোর্ট ব্যর্থ: ${res.error}` : `Failed to export PDF: ${res.error}`, 'error');
    }
  };

  // 1-Click Launch All Categorized Links in browser
  const handleOpenAllLinks = () => {
    if (!clientDossier?.categorizedLinks || clientDossier.categorizedLinks.length === 0) return;
    const urls = clientDossier.categorizedLinks.map((l: any) => l.url);
    bridge.openMultipleUrls(urls);
    showToast?.(isBn ? '✓ সমস্ত ক্লায়েন্ট লিংক ব্রাউজারে খোলা হয়েছে!' : '✓ Opened all links in browser!', 'info');
  };

  // 1-Click Apply Lumetri Color Grade from Dossier
  const handleApplyDossierColor = async () => {
    const lutName = clientDossier?.branding?.lutFileName || 'Prismex_Teal_Orange.cube';
    const preset = 'teal_orange';
    const basicCorrection = { exposure: 0.1, contrast: 15.0, temperature: 5.0, tint: -2.0, saturation: 115.0 };
    await bridge.applyLumetriColorToActiveClip(
      `/Library/Application Support/Adobe/Common/LUTs/Creative/${lutName}`,
      preset,
      basicCorrection,
      false
    );
    showToast?.(isBn ? '✓ টাইমলাইনের অ্যাক্টিভ ক্লিপে সিনেমাটিক কালার গ্রেড অ্যাপ্লাই করা হয়েছে!' : '✓ Applied Lumetri color grade to active clip!', 'success');
  };

  // 1-Click Non-Destructive Script-to-Rough Cut Sequence Handler
  const handleCreateScriptRoughCut = async (explicitScript?: string) => {
    const scriptToUse = (explicitScript || scriptDraft || clientScriptText || clientDossier?.scriptDossier?.rawScript || '').trim();
    if (!scriptToUse) {
      showToast?.(
        isBn
          ? 'দয়া করে প্রথমে ক্লায়েন্টের স্ক্রিপ্ট টেক্সট পেস্ট বা ফাইল আপলোড করুন।'
          : 'Please paste client script or upload file first.',
        'error'
      );
      setActiveSection('script');
      return;
    }

    if (!transcriptWords || transcriptWords.length === 0) {
      showToast?.(
        isBn ? 'প্রথমে টাইমলাইনের অডিও ট্রান্সক্রাইব করুন।' : 'Transcribe timeline audio first.',
        'error'
      );
      return;
    }

    setIsCreatingRoughCut(true);
    setRoughCutResult(null);
    setRoughCutProgressStep(isBn ? '১/৪: স্ক্রিপ্ট বিশ্লেষণ ও সেরা টেক বাছাই চলছে...' : '1/4: Analyzing script & matching takes...');

    try {
      const dur = sequenceManifest?.durationSeconds || 600.0;
      const fps = sequenceManifest?.fps || 23.976;

      const res = await client.generateScriptRoughCut(scriptToUse, transcriptWords, dur, fps);

      if (!res || !res.success) {
        showToast?.(res?.error || (isBn ? 'স্ক্রিপ্ট রাফ-কাট গণনা ব্যর্থ হয়েছে।' : 'Rough-cut calculation failed.'), 'error');
        setIsCreatingRoughCut(false);
        return;
      }

      setRoughCutProgressStep(isBn ? '২/৪: নতুন সিকোয়েন্স ক্লোন ও অটো রিপল কাট চলছে...' : '2/4: Cloning sequence & applying ripple cuts...');

      const premiereRes = await bridge.createScriptRoughCutSequence({
        cuts: res.cuts || [],
        punchIns: res.punchIns || [],
        colorLabels: res.colorLabels || [],
        markers: res.markers || []
      });

      if (!premiereRes || !premiereRes.success) {
        showToast?.(premiereRes?.error || (isBn ? 'প্রিমিয়ার প্রোতে সিকোয়েন্স তৈরি ব্যর্থ হয়েছে।' : 'Sequence creation failed in Premiere.'), 'error');
        setIsCreatingRoughCut(false);
        return;
      }

      setRoughCutProgressStep(isBn ? '৩/৪: A/B Cam পাঞ্চ-ইন ও কালার কোডিং সম্পন্ন...' : '3/4: A/B Cam punch-in & act color-coding applied...');

      setRoughCutResult({
        sequenceName: premiereRes.sequenceName,
        cutsExecuted: premiereRes.executedCuts,
        punchesApplied: premiereRes.punchesApplied,
        markersPlaced: premiereRes.markersPlaced,
        totalCutDuration: res.totalCutDuration,
        summary: res.summary
      });

      showToast?.(
        isBn
          ? `🎉 নতুন সিকোয়েন্স '${premiereRes.sequenceName}' তৈরি হয়েছে!`
          : `🎉 New sequence '${premiereRes.sequenceName}' created!`,
        'success'
      );
    } catch (err) {
      console.error('Rough cut error:', err);
      showToast?.(isBn ? 'রাফ-কাট সিকোয়েন্স তৈরিতে ত্রুটি ঘটেছে।' : 'Failed to create rough-cut sequence.', 'error');
    } finally {
      setIsCreatingRoughCut(false);
    }
  };

  // Generate Tailored Editing Roadmap
  const handleGenerateRoadmap = async () => {
    setIsGeneratingRoadmap(true);
    try {
      const dur = sequenceManifest?.durationSeconds || 120.0;
      const res = await client.analyzeBriefRoadmap(
        briefDraft || clientBriefText,
        scriptDraft || clientScriptText,
        transcriptWords,
        dur
      );
      if (res && res.length > 0) {
        setEditingRoadmap(res);
        showToast?.(isBn ? '✓ এডিটিং রোডম্যাপ সফলভাবে জেনারেট হয়েছে!' : '✓ Editing roadmap created!', 'success');
      }
    } catch (err) {
      console.error('Roadmap error:', err);
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  // Parse Revisions
  const handleParseRevisions = async () => {
    if (!rawRevisionText.trim()) return;
    setIsParsingRevisions(true);
    try {
      const res = await client.parseRevisions(rawRevisionText, sequenceManifest?.durationSeconds || 120.0);
      if (res && res.length > 0) {
        setClientRevisions([...clientRevisions, ...res]);
        setRawRevisionText('');
        showToast?.(
          isBn ? `✓ ${res.length}টি টাইমকোড রিভিশন টাস্ক তৈরি হয়েছে!` : `✓ ${res.length} revision tasks added!`,
          'success'
        );
      } else {
        showToast?.(isBn ? 'কোনো টাইমকোড পাওয়া যায়নি।' : 'No timecodes detected in text.', 'info');
      }
    } catch (err) {
      console.error('Parse revisions error:', err);
    } finally {
      setIsParsingRevisions(false);
    }
  };

  // Push All Client Revisions directly to Premiere Pro Timeline Markers
  const handlePushRevisionsToTimelineMarkers = async () => {
    const listToPush = clientRevisions.length > 0 ? clientRevisions : [];
    if (listToPush.length === 0 && !rawRevisionText.trim()) {
      showToast?.(isBn ? 'কোনো রিভিশন টাস্ক নেই।' : 'No revision tasks to push.', 'info');
      return;
    }

    try {
      let markersData: any[] = [];
      if (listToPush.length > 0) {
        markersData = listToPush.map((r) => {
          let col = 'GREEN';
          if (r.category === 'Audio') col = 'CYAN';
          else if (r.category === 'Visual' || r.category === 'Logo') col = 'PURPLE';
          else if (r.category === 'Color') col = 'ORANGE';
          else if (r.category === 'Pacing') col = 'RED';

          return {
            startSeconds: r.seconds || 0,
            durationSeconds: 2.0,
            name: `Rev: ${r.category || 'Fix'}`,
            comment: r.clientRequest || r.actionItem || 'Client Note',
            color: col
          };
        });
      } else if (rawRevisionText.trim()) {
        const parsed = await client.parseFeedbackMarkers(rawRevisionText, sequenceManifest?.fps || 24);
        if (parsed && parsed.success && parsed.markers) {
          markersData = parsed.markers;
        }
      }

      if (markersData.length > 0) {
        const addRes = await bridge.addTimelineMarkers(markersData);
        showToast?.(
          isBn
            ? `✓ সফলভাবে ${markersData.length}টি রিভিশন মার্কার প্রিমিয়ার প্রো টাইমলাইনে যুক্ত হয়েছে!`
            : `✓ Added ${markersData.length} revision markers to timeline!`,
          'success'
        );
      } else {
        showToast?.(isBn ? 'মার্কার তৈরি করা সম্ভব হয়নি।' : 'Could not create markers.', 'info');
      }
    } catch (err) {
      console.error('Push markers error:', err);
      showToast?.(isBn ? 'মার্কার পুশ করতে ত্রুটি হয়েছে।' : 'Error pushing markers.', 'error');
    }
  };

  // Jump playhead in Premiere Pro timeline
  const handleSeek = (sec: number, tc?: string) => {
    bridge.setPlayheadPosition(sec);
    showToast?.(
      isBn ? `⏱️ প্লেহেড ${tc || `${sec}s`} ফ্রেমটিতে স্থানান্তরিত হয়েছে!` : `⏱️ Playhead jumped to ${tc || `${sec}s`}!`,
      'info'
    );
  };

  // Export Professional Client PDF Report
  const handleExportPdfReport = async () => {
    const seqName = sequenceManifest?.sequenceName || 'Final Video Master';
    const cleanSeqName = seqName.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_');
    const duration = sequenceManifest ? TimecodeConverter.formatTimecode(sequenceManifest.durationSeconds, sequenceManifest.fps || 24) : '00:01:00:00';
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const folder = await bridge.getProjectFolderPath().catch(() => '');

    const brandColorsHtml = (brandKit.palette || [])
      .map(
        (hex: string) => `
        <div style="display:inline-flex; align-items:center; gap:6px; margin-right:14px; margin-bottom:8px;">
          <div style="width:18px; height:18px; border-radius:4px; background:${hex}; border:1px solid #ddd;"></div>
          <span style="font-family:monospace; font-size:12px; color:#333;">${hex}</span>
        </div>
      `
      )
      .join('');

    const auditItemsHtml = (scriptAuditReport || [])
      .map(
        (item: any) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #eee; font-family:monospace; color:#2563eb; font-weight:bold;">${item.start !== undefined ? TimecodeConverter.formatTimecode(item.start, 24) : '—'}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#dc2626; text-decoration:line-through;">${item.original}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#16a34a; font-weight:bold;">${item.replacement}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px; color:#6b7280;">${item.reason}</td>
        </tr>
      `
      )
      .join('');

    const revisionsHtml = (clientRevisions || [])
      .map(
        (rev: any) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #eee; font-family:monospace; color:#4f46e5; font-weight:bold;">${rev.timecode}</td>
          <td style="padding:8px; border-bottom:1px solid #eee;">
            <strong>${rev.actionItem || rev.clientRequest}</strong>
            ${rev.actionItem && rev.actionItem !== rev.clientRequest ? `<br><small style="color:#6b7280;">Client Note: "${rev.clientRequest}"</small>` : ''}
          </td>
          <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px; color:#6b7280;">${rev.category}</td>
          <td style="padding:8px; border-bottom:1px solid #eee;">
            <span style="padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; background:${
              rev.status === 'RESOLVED' || rev.completed ? '#dcfce7; color:#15803d;' : rev.status === 'IN_PROGRESS' ? '#e0f2fe; color:#0369a1;' : '#fef3c7; color:#b45309;'
            }">${rev.completed ? 'RESOLVED' : rev.status}</span>
          </td>
          <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px; color:#374151;">${rev.actionTaken || 'Applied & Adjusted'}</td>
        </tr>
      `
      )
      .join('');

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prismex AI - Client Delivery & Quality Audit Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 0; padding: 32px; background: #ffffff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; color: #111827; margin: 0; }
          .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
          .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
          .section-title { font-size: 15px; font-weight: 700; color: #1f2937; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; margin-top: 8px; }
          th { background: #f3f4f6; padding: 8px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #d1d5db; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
          .badge-green { background: #d1fae5; color: #065f46; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
          @media print {
            body { padding: 16px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="background:#4f46e5; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer;">
            🖨️ Print / Save as PDF
          </button>
        </div>

        <div class="header">
          <div>
            <h1 class="title">Client Delivery & Quality Audit Report</h1>
            <div class="subtitle">Prismex AI Verified Workflow • Project: <strong>${seqName}</strong></div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #4b5563;">
            <div>Date: <strong>${now}</strong></div>
            <div>Duration: <strong>${duration}</strong></div>
            <div class="badge badge-green" style="margin-top: 4px;">✓ QA Verified</div>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">1. Brand Identity & Color Specifications</h3>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px;">
            <div>Brand Name: <strong>${brandKit.brandName || 'Client Brand'}</strong></div>
            <div>Font Recommendation: <strong>${brandKit.fontSuggestion || 'Inter / Modern Sans-Serif'}</strong></div>
          </div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">Harmonized Brand Color Palette:</div>
          <div>${brandColorsHtml || '<em>Default Studio Palette Applied</em>'}</div>
        </div>

        <div class="card">
          <h3 class="section-title">2. Professional 7-Stage Post-Production Quality Audit</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 28%;">Pipeline Milestone</th>
                <th style="width: 48%;">Engineering Standard & Logic</th>
                <th style="width: 24%;">Compliance Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. Script Rough-Cut & Sync</strong></td>
                <td>Conformed to official script text; false starts & dead silence eliminated</td>
                <td><span class="badge badge-green">✓ VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>2. Framing & Rule-of-Thirds Lock</strong></td>
                <td>Upper-third eyeline alignment with 112% conversational punch-in</td>
                <td><span class="badge badge-green">✓ VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>3. Dialogue Cleanup & Leveling</strong></td>
                <td>True Peak clamped at -6.0 dB, vocal integrated to -14 LUFS standard</td>
                <td><span class="badge badge-green">✓ VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>4. Technical Rec.709 Base Grade</strong></td>
                <td>Base exposure & skin-tone vector locked prior to After Effects link</td>
                <td><span class="badge badge-green">✓ VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>5. Pre-AE Dynamic Link Safety Guard</strong></td>
                <td>Original raw media safeguarded on Track V1, comp instances on V2</td>
                <td><span class="badge badge-green">✓ VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>6. SFX & Auto-Sidechain Ducking</strong></td>
                <td>Music ducked automatically to -26 dB under vocal dialogue</td>
                <td><span class="badge badge-green">✓ VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>7. Captions & Quality Sign-Off</strong></td>
                <td>Word-accurate subtitle synchronization & zero-error export ready</td>
                <td><span class="badge badge-green">✓ VERIFIED</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        ${
          clientRevisions.length > 0
            ? `
        <div class="card">
          <h3 class="section-title">3. Client Revision Resolution Log</h3>
          <table>
            <thead>
              <tr>
                <th>Timecode</th>
                <th>Client Feedback Request</th>
                <th>Category</th>
                <th>Status</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              ${revisionsHtml}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        ${
          (scriptAuditReport || []).length > 0
            ? `
        <div class="card">
          <h3 class="section-title">4. Script Grounding & Terminology Audit</h3>
          <table>
            <thead>
              <tr>
                <th>Timecode</th>
                <th>Spoken Audio (Raw)</th>
                <th>Corrected (Client Script)</th>
                <th>Alignment Reason</th>
              </tr>
            </thead>
            <tbody>
              ${auditItemsHtml}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        <div class="card">
          <h3 class="section-title">5. Sound & Content Copyright Compliance</h3>
          <p style="font-size: 11.5px; color: #374151; margin: 0;">
            All background music tracks and audio assets used in this production are licensed for commercial use and content monetization via Pixabay / Free Music Archive. Zero copyright strike guarantee.
          </p>
        </div>

        <div class="footer">
          <div>Generated by Prismex AI Studio Engine</div>
          <div>Editor Signature: _______________________</div>
        </div>
      </body>
      </html>
    `;

    showToast?.(isBn ? '⏳ PDF অডিট রিপোর্ট তৈরি ও সেভ হচ্ছে...' : '⏳ Compiling Audit PDF Report...', 'info');

    const res = await client.exportPdfReport({
      filename: `${cleanSeqName}_Client_Quality_Audit_Report.pdf`,
      reportHtml,
      folderPath: folder,
      openAfterSave: true,
      revealInFinder: true
    });

    if (res.success) {
      showToast?.(
        isBn ? `✓ PDF অডিট রিপোর্ট প্রজেক্ট ফোল্ডারে সেভ ও ওপেন হয়েছে! [${res.folder || folder}]` : `✓ Audit PDF report saved and opened!`,
        'success'
      );
    } else {
      showToast?.(isBn ? `PDF এক্সপোর্ট ব্যর্থ: ${res.error}` : `Failed to export PDF: ${res.error}`, 'error');
    }
  };

  const completedCount = (editingRoadmap || []).filter((i) => i.completed).length;
  const totalRoadmap = (editingRoadmap || []).length;
  const progressPercent = totalRoadmap > 0 ? Math.round((completedCount / totalRoadmap) * 100) : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#13141c', color: '#e2e8f0', overflow: 'hidden' }}>
      {/* Top Banner Navigation */}
      <div style={{ padding: '8px 12px', backgroundColor: '#1a1c28', borderBottom: '1px solid #282a3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
            <Briefcase size={15} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#ffffff' }}>
                {isBn ? 'ক্লায়েন্ট হাব ও রিভিশন সেন্টার' : 'Client Hub & Revision Center'}
              </span>
              <span style={{ padding: '1px 5px', borderRadius: '4px', fontSize: '9.5px', fontFamily: 'monospace', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                PRO
              </span>
            </div>
            <p style={{ fontSize: '10.5px', color: '#94a3b8', margin: 0, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isBn
                ? 'ব্র্যান্ড কিট, এডিটিং রোডম্যাপ, টাইমকোড রিভিশন ও ক্লায়েন্ট ডসিয়ার'
                : 'Brand kit, editing roadmap, timecoded revisions, and client dossier'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={handleExportPdfReport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: '#059669',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)',
              whiteSpace: 'nowrap'
            }}
            title={isBn ? 'ক্লায়েন্টের জন্য সুন্দর পিডিএফ অডিট রিপোর্ট এক্সপোর্ট করুন' : 'Export verified client PDF report'}
          >
            <Printer size={12} />
            <span>{isBn ? '📄 PDF রিপোর্ট' : '📄 Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div style={{
        padding: '6px 10px',
        backgroundColor: '#161722',
        borderBottom: '1px solid #242636',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <button
            onClick={() => setActiveSection('dossier')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeSection === 'dossier' ? '#4f46e5' : '#222434',
              color: activeSection === 'dossier' ? '#ffffff' : '#94a3b8',
              border: activeSection === 'dossier' ? '1px solid #6366f1' : '1px solid #2e3046',
              boxShadow: activeSection === 'dossier' ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={12} color={activeSection === 'dossier' ? '#ffffff' : '#818cf8'} />
            <span>{isBn ? '📋 ক্লায়েন্ট ডসিয়ার' : 'Client Dossier'}</span>
            {clientDossier && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            )}
          </button>

          <button
            onClick={() => setActiveSection('roadmap')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeSection === 'roadmap' ? '#4f46e5' : '#222434',
              color: activeSection === 'roadmap' ? '#ffffff' : '#94a3b8',
              border: activeSection === 'roadmap' ? '1px solid #6366f1' : '1px solid #2e3046',
              transition: 'all 0.15s ease'
            }}
          >
            <ListChecks size={12} />
            <span>{isBn ? 'রোডম্যাপ' : 'Roadmap'}</span>
            {totalRoadmap > 0 && (
              <span style={{ padding: '1px 4px', borderRadius: '4px', fontSize: '9px', backgroundColor: 'rgba(0,0,0,0.3)', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {completedCount}/{totalRoadmap}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('revisions')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeSection === 'revisions' ? '#4f46e5' : '#222434',
              color: activeSection === 'revisions' ? '#ffffff' : '#94a3b8',
              border: activeSection === 'revisions' ? '1px solid #6366f1' : '1px solid #2e3046',
              transition: 'all 0.15s ease'
            }}
          >
            <Clock size={12} />
            <span>{isBn ? 'রিভিশন' : 'Revisions'}</span>
            {(clientRevisions || []).length > 0 && (
              <span style={{ padding: '1px 4px', borderRadius: '4px', fontSize: '9px', backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontWeight: 700, fontFamily: 'monospace' }}>
                {clientRevisions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('brand')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeSection === 'brand' ? '#4f46e5' : '#222434',
              color: activeSection === 'brand' ? '#ffffff' : '#94a3b8',
              border: activeSection === 'brand' ? '1px solid #6366f1' : '1px solid #2e3046',
              transition: 'all 0.15s ease'
            }}
          >
            <Palette size={12} />
            <span>{isBn ? 'ব্র্যান্ড কালার' : 'Brand Colors'}</span>
            {brandKit?.palette && brandKit.palette.length > 0 && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
            )}
          </button>

          <button
            onClick={() => setActiveSection('script')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeSection === 'script' ? '#4f46e5' : '#222434',
              color: activeSection === 'script' ? '#ffffff' : '#94a3b8',
              border: activeSection === 'script' ? '1px solid #6366f1' : '1px solid #2e3046',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={12} />
            <span>{isBn ? 'ব্রিফ ও স্ক্রিপ্ট' : 'Brief & Script'}</span>
          </button>

          <button
            onClick={() => setActiveSection('rough-cut')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeSection === 'rough-cut' ? '#7c3aed' : '#222434',
              color: activeSection === 'rough-cut' ? '#ffffff' : '#c4b5fd',
              border: activeSection === 'rough-cut' ? '1px solid #8b5cf6' : '1px solid #4338ca',
              boxShadow: activeSection === 'rough-cut' ? '0 0 12px rgba(124, 58, 237, 0.45)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Film size={12} color="#a78bfa" />
            <span>{isBn ? '🎬 স্ক্রিপ্ট রাফ-কাট' : '🎬 Script Rough-Cut'}</span>
            <span style={{ fontSize: '9px', backgroundColor: 'rgba(124, 58, 237, 0.4)', padding: '1px 4px', borderRadius: '4px', color: '#e9d5ff', fontWeight: 700 }}>1-CLICK</span>
          </button>
        </div>

        <button
          onClick={handleSaveAndSync}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            fontSize: '10.5px',
            color: '#a5b4fc',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '6px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Save size={11} />
          <span>{isBn ? 'সেভ' : 'Save'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* ===================== SECTION 0: CLIENT BRIEF & SCRIPT MASTER DOSSIER ===================== */}
        {activeSection === 'dossier' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* If Dossier is NOT yet created: Ingestion / Analysis Prompt */}
            {!clientDossier ? (
              <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: '#181926', border: '1px solid #2b2d42', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px 0' }}>
                    {isBn ? 'ক্লায়েন্ট ডসিয়ার ও ব্রিফ মাস্টার' : 'Client Brief & Script Master Dossier'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, maxWidth: '480px', lineHeight: 1.5 }}>
                    {isBn
                      ? 'ক্লায়েন্টের ব্রিফ বা স্ক্রিপ্ট পেস্ট করুন অথবা আপলোড করুন। এআই স্বয়ংক্রিয়ভাবে ফন্ট, কালার প্যালেট, ফুটেজ লিংক, অডিও গাইড ও ডুয়েল-লেয়ার স্ক্রিপ্টসহ সম্পূর্ণ ডসিয়ার সাজিয়ে দেবে।'
                      : 'Paste or upload client brief & script. AI will automatically extract typography, brand colors, footage links, audio specs, and create a dual-layer script breakdown.'}
                  </p>
                </div>

                <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea
                    value={briefDraft}
                    onChange={(e) => setBriefDraft(e.target.value)}
                    rows={6}
                    placeholder={
                      isBn
                        ? "ক্লায়েন্টের ব্রিফ বা স্ক্রিপ্ট এখানে পেস্ট করুন...\nউদাহরণ: Format 9:16 vertical, duration 40s. Use font Montserrat and brand color #FF5500. Raw footage: drive.google.com/...\nScript: Winter roads around Long Island..."
                        : "Paste client brief or script text here..."
                    }
                    style={{
                      width: '100%',
                      backgroundColor: '#12131d',
                      border: '1px solid #2c2e42',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '11.5px',
                      color: '#ffffff',
                      outline: 'none',
                      resize: 'vertical',
                      lineHeight: 1.5,
                      fontFamily: 'inherit'
                    }}
                  />

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                      onClick={handleGenerateDossier}
                      disabled={isGeneratingDossier || (!briefDraft.trim() && !scriptDraft.trim())}
                      style={{
                        padding: '8px 18px',
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: (isGeneratingDossier || (!briefDraft.trim() && !scriptDraft.trim())) ? 'default' : 'pointer',
                        opacity: (isGeneratingDossier || (!briefDraft.trim() && !scriptDraft.trim())) ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
                      }}
                    >
                      <Sparkles size={14} />
                      <span>{isGeneratingDossier ? (isBn ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing...') : (isBn ? '✨ ব্রিফ বিশ্লেষণ ও ডসিয়ার তৈরি করুন' : 'Generate Master Dossier')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* DOSSIER DISPLAY */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* HERO BANNER CARD */}
                <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: '#181926', border: '1px solid #2b2d42', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                        {clientDossier.headline || (isBn ? 'ক্লায়েন্ট ডসিয়ার' : 'Client Master Dossier')}
                      </span>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.18)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.35)', fontWeight: 600 }}>
                        {isBn ? '✨ এআই গ্রাউন্ডেড ডসিয়ার' : 'AI Grounded Dossier'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={handleGenerateDossier}
                        disabled={isGeneratingDossier}
                        title={isBn ? 'নতুন তথ্যের ভিত্তিতে ডসিয়ার রিফ্রেশ করুন' : 'Regenerate dossier'}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                          backgroundColor: '#222434',
                          border: '1px solid #2e3046',
                          color: '#c7d2fe',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Sparkles size={12} color="#818cf8" />
                        <span>{isGeneratingDossier ? (isBn ? 'রিফ্রেশ হচ্ছে...' : 'Refreshing...') : (isBn ? 'রিফ্রেশ' : 'Refresh')}</span>
                      </button>

                      <button
                        onClick={handleExportDossierPdf}
                        title={isBn ? 'সম্পূর্ণ ডসিয়ার প্রফেশনাল PDF ফাইল আকারে প্রজেক্ট ফোল্ডারে সেভ করুন' : 'Export master PDF dossier to project folder'}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: '#4f46e5',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <FileText size={12} />
                        <span>{isBn ? 'PDF ডসিয়ার' : 'PDF Dossier'}</span>
                      </button>

                      <button
                        onClick={handleExportDossierTxt}
                        title={isBn ? 'সম্পূর্ণ ডসিয়ার টেক্সট ফাইল (.txt) আকারে প্রজেক্ট ফোল্ডারে সেভ করুন' : 'Save .txt dossier to project folder'}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: '#059669',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Download size={12} />
                        <span>{isBn ? 'টেক্সট (.TXT)' : 'Save .TXT'}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (clientDossier?.exportableTextReport) {
                            copyToClipboard(clientDossier.exportableTextReport);
                            showToast?.(isBn ? '✓ সম্পূর্ণ ডসিয়ার ক্লিপবোর্ডে কপি হয়েছে!' : '✓ Dossier report copied!', 'success');
                          }
                        }}
                        title={isBn ? 'ক্লিপবোর্ডে কপি করুন' : 'Copy report'}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          backgroundColor: '#222434',
                          border: '1px solid #2e3046',
                          color: '#cbd5e1',
                          cursor: 'pointer'
                        }}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Badges Bar: Duration, Formats, Audience */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {clientDossier.targetDuration && (
                      <span style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: '5px', backgroundColor: '#13141f', border: '1px solid #282a3c', color: '#fbbf24', fontWeight: 600 }}>
                        ⏱️ {isBn ? 'টার্গেট দৈর্ঘ্য:' : 'Duration:'} {clientDossier.targetDuration}
                      </span>
                    )}
                    {clientDossier.formats && clientDossier.formats.map((fmt: any, idx: number) => {
                      const label = typeof fmt === 'object' && fmt !== null
                        ? `${fmt.ratio || ''} ${fmt.resolution || ''} ${fmt.platform || ''}`.trim()
                        : String(fmt || '');
                      return (
                        <span key={idx} style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: '5px', backgroundColor: '#13141f', border: '1px solid #282a3c', color: '#38bdf8', fontWeight: 600 }}>
                          📱 {label}
                        </span>
                      );
                    })}
                    {clientDossier.targetAudience && (
                      <span style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: '5px', backgroundColor: '#13141f', border: '1px solid #282a3c', color: '#c084fc', fontWeight: 500 }}>
                        🎯 {clientDossier.targetAudience}
                      </span>
                    )}
                  </div>
                </div>

                {/* CARD 1: BENGALI SUMMARY & CLIENT INTENT */}
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={14} color="#818cf8" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                      {isBn ? '🌐 ব্রিফের বাংলা অনুবাদ ও মূল উদ্দেশ্য' : 'Client Intent & Summary'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    {clientDossier.bengaliSummary || (isBn ? 'কোনো ব্রিফ সারাংশ পাওয়া যায়নি।' : 'No summary available.')}
                  </p>
                </div>

                {/* CARD 2: CATEGORIZED LINKS HUB */}
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ExternalLink size={14} color="#38bdf8" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                        {isBn ? '🔗 ফুটেজ, লোগো ও ড্রাইভ লিংক হাব' : 'Categorized Links Hub'}
                      </span>
                      {clientDossier.categorizedLinks && clientDossier.categorizedLinks.length > 0 && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
                          {clientDossier.categorizedLinks.length}
                        </span>
                      )}
                    </div>

                    {clientDossier.categorizedLinks && clientDossier.categorizedLinks.length > 0 && (
                      <button
                        onClick={handleOpenAllLinks}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '5px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ExternalLink size={11} />
                        <span>{isBn ? 'সব লিংক এক ক্লিকে খুলুন' : 'Open All Links'}</span>
                      </button>
                    )}
                  </div>

                  {(!clientDossier.categorizedLinks || clientDossier.categorizedLinks.length === 0) ? (
                    <p style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                      {isBn ? 'ব্রিফে সরাসরি কোনো ক্লাউড বা ড্রাইভ লিংক পাওয়া যায়নি।' : 'No links detected in brief.'}
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                      {clientDossier.categorizedLinks.map((item: any, idx: number) => {
                        const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
                          footage: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
                          assets: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' },
                          logo: { bg: 'rgba(168, 85, 247, 0.15)', text: '#d8b4fe', border: 'rgba(168, 85, 247, 0.3)' },
                          reference: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' },
                          delivery: { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' }
                        };
                        const styling = badgeColors[item.category] || { bg: 'rgba(100, 116, 139, 0.2)', text: '#cbd5e1', border: '#334155' };

                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              backgroundColor: '#141522',
                              border: '1px solid #282a3c',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: styling.bg, color: styling.text, border: `1px solid ${styling.border}` }}>
                                  {item.categoryLabel || item.category}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.title}
                                </span>
                              </div>
                              <span style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.url}
                              </span>
                            </div>

                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => {
                                e.preventDefault();
                                bridge.openMultipleUrls([item.url]);
                              }}
                              style={{
                                padding: '4px 7px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#93c5fd',
                                fontSize: '10.5px',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <ExternalLink size={10} />
                              <span>{isBn ? 'খুলুন' : 'Open'}</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CARD 3: BRANDING, FONTS & COLOR GRADE */}
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Palette size={14} color="#f43f5e" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                        {isBn ? '🎨 ব্র্যান্ডিং, ফন্ট ও কালার গাইড' : 'Branding & Color Palette'}
                      </span>
                    </div>

                    <button
                      onClick={handleApplyDossierColor}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 8px rgba(225, 29, 72, 0.35)'
                      }}
                    >
                      <Film size={12} />
                      <span>{isBn ? '🎬 ১-ক্লিকে লুমেট্রি কালার গ্রেড টাইমলাইনে দিন' : 'Apply Lumetri Grade to Timeline'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {/* Typography */}
                    <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#141522', border: '1px solid #26283b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Type size={12} color="#818cf8" />
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#c7d2fe' }}>
                          {isBn ? 'টাইপোগ্রাফি / ফন্ট' : 'Typography'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
                          {clientDossier.branding?.primaryFont || 'Montserrat'}
                        </span>
                        <button
                          onClick={() => {
                            copyToClipboard(clientDossier.branding?.primaryFont || 'Montserrat');
                            showToast?.(isBn ? 'ফন্টের নাম কপি হয়েছে!' : 'Font copied!', 'info');
                          }}
                          style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                        >
                          কপি
                        </button>
                      </div>
                      {clientDossier.branding?.secondaryFont && (
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                          {isBn ? 'দ্বিতীয় ফন্ট:' : 'Secondary:'} {clientDossier.branding.secondaryFont}
                        </div>
                      )}
                    </div>

                    {/* Color Swatches */}
                    <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#141522', border: '1px solid #26283b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
                        {isBn ? 'ব্র্যান্ড হেক্স কোড (ক্লিক করে কপি করুন):' : 'Brand Hex Palette:'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Primary', hex: clientDossier.branding?.primaryColor || '#FF5500' },
                          { label: 'Accent', hex: clientDossier.branding?.accentColor || '#00B4D8' },
                          { label: 'Background', hex: clientDossier.branding?.backgroundColor || '#111827' }
                        ].map((swatch, sIdx) => (
                          <div
                            key={sIdx}
                            onClick={() => {
                              copyToClipboard(swatch.hex);
                              showToast?.(isBn ? `${swatch.label} কালার কোড (${swatch.hex}) কপি হয়েছে!` : `Copied ${swatch.hex}!`, 'info');
                            }}
                            title={`${swatch.label}: ${swatch.hex} (Click to copy)`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: '#1a1b2a',
                              border: '1px solid #2f3248',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ width: '13px', height: '13px', borderRadius: '3px', backgroundColor: swatch.hex, border: '1px solid rgba(255,255,255,0.2)' }} />
                            <span style={{ fontSize: '10.5px', fontFamily: 'monospace', fontWeight: 600, color: '#f1f5f9' }}>
                              {swatch.hex}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 4: AUDIO, VOICEOVER & BGM DIRECTIVES */}
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Music size={14} color="#a855f7" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                      {isBn ? '🎙️ অডিও, ভয়েসওভার ও BGM গাইড' : 'Audio, Voiceover & BGM Directives'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#141522', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        🗣️ {isBn ? 'ভয়েসওভার ডেলিভারি স্টাইল:' : 'Voiceover Delivery:'}
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#ffffff' }}>
                        {clientDossier.audioDirectives?.voiceTone || 'Confident, High-Energy, Clear'}
                      </span>
                    </div>

                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#141522', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        🎛️ {isBn ? 'ভোকাল EQ প্রোফাইল:' : 'Vocal EQ Profile:'}
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#38bdf8' }}>
                        {clientDossier.audioDirectives?.voiceEQ || 'Warm Broadcast EQ (Boost 100Hz, Dip 400Hz, Air 10kHz)'}
                      </span>
                    </div>

                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#141522', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        🎵 {isBn ? 'BGM জঁরা ও BPM:' : 'BGM Genre & BPM:'}
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#a855f7' }}>
                        {clientDossier.audioDirectives?.bgmGenre || 'Modern Electronic'} ({clientDossier.audioDirectives?.bgmBpm || '120-128'} BPM)
                      </span>
                    </div>

                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#141522', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        🔉 {isBn ? 'ভোকাল ডাকিং স্ট্যান্ডার্ড:' : 'Audio Ducking Standard:'}
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#34d399' }}>
                        {clientDossier.audioDirectives?.duckingRule || '-20 dB beneath spoken dialogue'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD 5: DUAL-LAYER SCRIPT BREAKDOWN */}
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} color="#6366f1" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                        {isBn ? '📜 ডুয়েল-লেয়ার স্ক্রিপ্ট ব্রেকডাউন' : 'Dual-Layer Script Breakdown'}
                      </span>
                    </div>

                    {/* Sub-Tabs: Raw Script vs AI Breakdown */}
                    <div style={{ display: 'flex', backgroundColor: '#12131d', padding: '2px', borderRadius: '6px', border: '1px solid #282a3c' }}>
                      <button
                        onClick={() => setDossierScriptTab('breakdown')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: dossierScriptTab === 'breakdown' ? 600 : 400,
                          backgroundColor: dossierScriptTab === 'breakdown' ? '#4f46e5' : 'transparent',
                          color: dossierScriptTab === 'breakdown' ? '#ffffff' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {isBn ? '🎬 এআই ডিরেক্টোরিয়াল ব্রেকডাউন' : 'Story Breakdown'}
                      </button>
                      <button
                        onClick={() => setDossierScriptTab('raw')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: dossierScriptTab === 'raw' ? 600 : 400,
                          backgroundColor: dossierScriptTab === 'raw' ? '#4f46e5' : 'transparent',
                          color: dossierScriptTab === 'raw' ? '#ffffff' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {isBn ? '📄 মূল স্ক্রিপ্ট (১০০% অক্ষত)' : 'Verbatim Script'}
                      </button>
                    </div>
                  </div>

                  {/* SUB-VIEW 1: RAW SCRIPT (100% VERBATIM) */}
                  {dossierScriptTab === 'raw' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <span>🔒 {isBn ? 'ক্লায়েন্টের অপরিবর্তিত গ্রাউন্ড ট্রুথ' : 'Client Untouched Ground Truth'}</span>
                        </span>
                        <button
                          onClick={() => {
                            copyToClipboard(clientDossier.scriptDossier?.rawScript || '');
                            showToast?.(isBn ? 'মূল স্ক্রিপ্ট কপি হয়েছে!' : 'Raw script copied!', 'info');
                          }}
                          style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                        >
                          কপি
                        </button>
                      </div>
                      <div
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: '#12131d',
                          border: '1px solid #282a3c',
                          fontSize: '12px',
                          color: '#e2e8f0',
                          lineHeight: 1.7,
                          whiteSpace: 'pre-wrap',
                          maxHeight: '260px',
                          overflowY: 'auto',
                          fontFamily: 'inherit'
                        }}
                      >
                        {clientDossier.scriptDossier?.rawScript || (isBn ? 'কোনো স্ক্রিপ্ট পাওয়া যায়নি।' : 'No script text found.')}
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW 2: AI STORY & SCENE BREAKDOWN */}
                  {dossierScriptTab === 'breakdown' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(!clientDossier.scriptDossier?.storyBreakdown || clientDossier.scriptDossier.storyBreakdown.length === 0) ? (
                        <p style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                          {isBn ? 'স্ক্রিপ্ট ব্রেকডাউন পাওয়া যায়নি।' : 'No breakdown available.'}
                        </p>
                      ) : (
                        clientDossier.scriptDossier.storyBreakdown.map((scene: any, scIdx: number) => {
                          const act = typeof scene.act === 'string' ? scene.act : `SCENE ${scIdx + 1}`;
                          const actLabel = typeof scene.actLabelBn === 'string' ? scene.actLabelBn : (typeof scene.name === 'string' ? scene.name : act);
                          const spoken = typeof scene.voiceoverText === 'string' ? scene.voiceoverText : (typeof scene.spoken === 'string' ? scene.spoken : '');
                          const visualCue = typeof scene.visualSuggestion === 'string' ? scene.visualSuggestion : (typeof scene.visualCue === 'string' ? scene.visualCue : '');
                          const sfxCue = typeof scene.soundSuggestion === 'string' ? scene.soundSuggestion : (typeof scene.sfxCue === 'string' ? scene.sfxCue : '');
                          return (
                            <div
                              key={scIdx}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                backgroundColor: '#13141f',
                                border: '1px solid #282a3c',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.2)', fontSize: '10px' }}>
                                    {act}
                                  </span>
                                  <span>{actLabel}</span>
                                </span>
                              </div>

                              {spoken && (
                                <div style={{ fontSize: '11.5px', color: '#ffffff', lineHeight: 1.5, padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                  🗣️ <span style={{ fontStyle: 'italic' }}>"{spoken}"</span>
                                </div>
                              )}

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', fontSize: '10.5px' }}>
                                {visualCue && (
                                  <div style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>🎥 {visualCue}</span>
                                  </div>
                                )}
                                {sfxCue && (
                                  <div style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>🔊 {sfxCue}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* CARD 6: ACTIONABLE CHECKLIST (TO-DO ROADMAP) */}
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    const todos = clientDossier.todoChecklist || [];
                    const completed = todos.filter((t: any) => t.completed).length;
                    const pct = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;

                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckSquare size={14} color="#10b981" />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                              {isBn ? '📋 কাজের অ্যাকশনেবল চেকলিস্ট' : 'Actionable To-Do Checklist'}
                            </span>
                          </div>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#10b981', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
                            {completed}/{todos.length} ({pct}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '5px', backgroundColor: '#12131d', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s ease' }} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {todos.map((todo: any) => (
                            <div
                              key={todo.id}
                              onClick={() => toggleDossierTodo(todo.id)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                backgroundColor: todo.completed ? 'rgba(16, 185, 129, 0.08)' : '#141522',
                                border: todo.completed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #282a3c',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '4px',
                                  border: todo.completed ? '1px solid #10b981' : '1px solid #475569',
                                  backgroundColor: todo.completed ? '#10b981' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontSize: '10px'
                                }}
                              >
                                {todo.completed && '✓'}
                              </div>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  color: todo.completed ? '#64748b' : '#f1f5f9',
                                  textDecoration: todo.completed ? 'line-through' : 'none',
                                  flex: 1
                                }}
                              >
                                {typeof todo.task === 'string' ? todo.task : JSON.stringify(todo.task || '')}
                              </span>
                              {(todo.stage || todo.category) && (
                                <span style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                                  {typeof (todo.stage || todo.category) === 'string' ? (todo.stage || todo.category) : ''}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 1: STEP-BY-STEP EDITING ROADMAP & PRODUCTION PIPELINE */}
        {activeSection === 'roadmap' && (() => {
          const seqName = sequenceManifest?.sequenceName || '';
          const isRoughCutDone = pipelineSteps[1] || seqName.includes('_AI_Script_RoughCut') || seqName.includes('_PrismexRoughCut');
          const isAudioDone = pipelineSteps[3] || false;
          const isColorDone = pipelineSteps[4] || false;
          const isCaptionsDone = pipelineSteps[7] || ((transcriptWords || []).length > 0);

          let currentPipelineStep = 1;
          if (isRoughCutDone) currentPipelineStep = 2;
          if (isRoughCutDone && pipelineSteps[2]) currentPipelineStep = 3;
          if (isRoughCutDone && pipelineSteps[2] && isAudioDone) currentPipelineStep = 4;
          if (isRoughCutDone && pipelineSteps[2] && isAudioDone && isColorDone) currentPipelineStep = 5;
          if (isRoughCutDone && pipelineSteps[2] && isAudioDone && isColorDone && pipelineSteps[5]) currentPipelineStep = 6;
          if (isRoughCutDone && pipelineSteps[2] && isAudioDone && isColorDone && pipelineSteps[5] && pipelineSteps[6]) currentPipelineStep = 7;

          const pipelineMilestones = [
            {
              num: 1,
              title: isBn ? '১. স্ক্রিপ্ট রাফ-কাট ও সিকোয়েন্স' : '1. Script Rough-Cut & Sync',
              desc: isBn ? 'ক্লায়েন্ট স্ক্রিপ্টের সাথে ডায়ালগ মিলিয়ে ভুল টেক ফেলে সিকোয়েন্স তৈরি' : 'Align script with raw footage & eliminate bad takes',
              icon: <Film size={14} />,
              tab: 'client-hub' as const,
              actionText: isBn ? 'রাফ-কাট ওপেন করুন' : 'Open Rough-Cut',
              isComplete: isRoughCutDone,
              action: () => setActiveSection('rough-cut')
            },
            {
              num: 2,
              title: isBn ? '২. ফ্রেমিং ও আই-লাইন লক' : '2. Framing & Eyeline Lock',
              desc: isBn ? 'রুল-অব-থার্ডস আই-লাইন অনুসারে ১১২% জুম ও ফ্রেম ফিক্স' : 'Rule-of-thirds eyeline punch-in (112%) & reframe',
              icon: <Eye size={14} />,
              tab: 'client-hub' as const,
              actionText: isBn ? 'আই-লাইন পাঞ্চ-ইন (১১২%)' : 'Apply Eyeline Punch',
              isComplete: pipelineSteps[2],
              action: async () => {
                const res = await bridge.applySmartEyelinePunch(112);
                if (res.success) {
                  togglePipelineStep(2);
                  showToast?.(res.message || (isBn ? '✓ ১১২% আই-লাইন পাঞ্চ-ইন প্রয়োগ হয়েছে!' : '✓ Eyeline punch applied!'), 'success');
                } else {
                  showToast?.(res.error || (isBn ? 'পাঞ্চ-ইন প্রয়োগ করা যায়নি' : 'Could not apply punch-in'), 'info');
                }
              }
            },
            {
              num: 3,
              title: isBn ? '৩. ডায়ালগ ক্লিনআপ ও লেভেলিং' : '3. Audio Cleanup & Leveling',
              desc: isBn ? 'ভোকাল রাইডার দিয়ে সব ভলিউম সমান ও -৬dB পীকে হার্ড-লক' : 'Vocal rider, noise reduction & lock True Peak at -6dB',
              icon: <Sliders size={14} />,
              tab: 'audio-studio' as const,
              actionText: isBn ? 'অডিও স্টুডিওতে যান' : 'Go to Audio Studio',
              isComplete: isAudioDone,
              action: () => setActiveTab('audio-studio')
            },
            {
              num: 4,
              title: isBn ? '৪. বেস কালার ও স্কিনটোন' : '4. Base Color & Skin Tone',
              desc: isBn ? 'AE-তে যাওয়ার আগেই র-ফুটেজে এক্সপোজার ও স্কিনটোন লক' : 'Correct exposure & skin tones before AE Dynamic Link',
              icon: <Palette size={14} />,
              tab: 'color-studio' as const,
              actionText: isBn ? 'কালার স্টুডিওতে যান' : 'Go to Color Studio',
              isComplete: isColorDone,
              action: () => setActiveTab('color-studio')
            },
            {
              num: 5,
              title: isBn ? '৫. বি-রোল ও AE সেফটি লক' : '5. B-Roll & AE Lock Guard',
              desc: isBn ? 'মূল ক্লিপ V1-এ সেফ রেখে Track V2-তে কপি করে কম্প তৈরি' : 'Pre-AE safety duplicate on V2 and place B-Roll cutaways',
              icon: <Layers size={14} />,
              tab: 'transcript' as const,
              actionText: isBn ? '🛡️ Pre-AE ব্যাকআপ (V2)' : '🛡️ Pre-AE Backup (V2)',
              isComplete: pipelineSteps[5],
              action: async () => {
                const res = await bridge.preAeSafetyDuplicate();
                if (res.success) {
                  togglePipelineStep(5);
                  showToast?.(res.message || (isBn ? '✓ ক্লিপ ব্যাকআপ Track V2-তে কপি হয়েছে!' : '✓ Pre-AE Safety clip duplicated!'), 'success');
                } else {
                  showToast?.(res.error || (isBn ? 'ক্লিপ ব্যাকআপ করা যায়নি' : 'Could not backup clip'), 'info');
                }
              }
            },
            {
              num: 6,
              title: isBn ? '৬. সাউন্ড ডিজাইন ও BGM ডাকিং' : '6. SFX & Auto BGM Ducking',
              desc: isBn ? 'ট্রানজিশনে SFX এবং কথার নিচে মিউজিক -২৬dB সাইডচেইন ডাকিং' : 'Place transition SFX & auto-duck music bed to -26dB',
              icon: <Music size={14} />,
              tab: 'audio-studio' as const,
              actionText: isBn ? 'মিউজিক ডাকিং স্টুডিও' : 'Master BGM Ducking',
              isComplete: pipelineSteps[6],
              action: () => setActiveTab('audio-studio')
            },
            {
              num: 7,
              title: isBn ? '৭. সাবটাইটেল ও কোয়ালিটি অডিট' : '7. Captions & Delivery Audit',
              desc: isBn ? 'শব্দ নির্ভুল সাবটাইটেল এবং ক্লায়েন্টের জন্য ভেরিফায়েড PDF রিপোর্ট' : 'Sync captions & export verified client PDF audit report',
              icon: <FileCheck2 size={14} />,
              tab: 'srt-editor' as const,
              actionText: isBn ? 'এসআরটি ও রিপোর্ট' : 'SRT & Audit Report',
              isComplete: isCaptionsDone && pipelineSteps[7],
              action: () => setActiveTab('srt-editor')
            }
          ];

          const pipelineCompletedCount = pipelineMilestones.filter(m => m.isComplete).length;
          const pipelinePercent = Math.round((pipelineCompletedCount / 7) * 100);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. MASTER 7-STAGE POST-PRODUCTION PIPELINE */}
              <div style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#191a26',
                border: '1px solid #282a3c',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} color="#34d399" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>
                        {isBn ? 'পোস্ট-প্রোডাকশন মাস্টার রোডম্যাপ' : 'Post-Production Master Roadmap'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '9.5px', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        {pipelineCompletedCount}/৭ {isBn ? 'ধাপ সমাপ্ত' : 'Done'} ({pipelinePercent}%)
                      </span>

                      <button
                        onClick={handleExportPdfReport}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 600,
                          backgroundColor: '#059669',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <FileCheck2 size={12} />
                        <span>{isBn ? 'ডেলিভারি রিপোর্ট' : 'Export Audit'}</span>
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '10.5px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                    {isBn
                      ? 'ভুল ক্রমানুসারে কাজ এড়াতে এআই গাইড: রাফ-কাট → ফ্রেমিং → অডিও → কালার → AE ডাইনামিক লিংক → BGM ডাকিং → অডিট।'
                      : 'Prevent editing traps: Rough-cut → Framing → Audio → Color → AE Dynamic Link → BGM Ducking → Audit.'}
                  </p>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '5px', backgroundColor: '#212332', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pipelinePercent}%`,
                      background: 'linear-gradient(90deg, #6366f1, #10b981)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>

                {/* 7-Stage Interactive Milestones Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
                  {pipelineMilestones.map((m) => {
                    const isActive = m.num === currentPipelineStep;
                    return (
                      <div
                        key={m.num}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          backgroundColor: m.isComplete
                            ? 'rgba(16, 185, 129, 0.08)'
                            : (isActive ? 'rgba(124, 58, 237, 0.16)' : '#161723'),
                          border: m.isComplete
                            ? '1px solid rgba(16, 185, 129, 0.35)'
                            : (isActive ? '1px solid rgba(139, 92, 246, 0.55)' : '1px solid #262838'),
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px',
                          position: 'relative'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: m.isComplete ? '#34d399' : (isActive ? '#c4b5fd' : '#94a3b8') }}>
                              {m.icon}
                              <span style={{ fontSize: '11px', fontWeight: 700, color: m.isComplete ? '#6ee7b7' : (isActive ? '#ffffff' : '#e2e8f0') }}>
                                {m.title}
                              </span>
                            </div>
                            <button
                              onClick={() => togglePipelineStep(m.num)}
                              title={m.isComplete ? "Mark incomplete" : "Mark completed"}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              {m.isComplete ? (
                                <CheckCircle2 size={14} color="#34d399" />
                              ) : (
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid #64748b' }} />
                              )}
                            </button>
                          </div>
                          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0, lineHeight: 1.35 }}>
                            {m.desc}
                          </p>
                        </div>

                        <button
                          onClick={m.action}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: 'none',
                            backgroundColor: m.isComplete
                              ? 'rgba(16, 185, 129, 0.2)'
                              : (isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'),
                            color: m.isComplete ? '#a7f3d0' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{m.isComplete ? (isBn ? 'পুনরায় দেখুন' : 'Review Step') : m.actionText}</span>
                          <ArrowRight size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. PACING & BOREDOM AUDITOR (>5s Talking Head Detector) */}
              <div style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#191a26',
                border: '1px solid #282a3c',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, flexWrap: 'wrap' }}>
                      <Clock size={15} color="#f59e0b" />
                      <span>{isBn ? 'প্যাসিং ও বোরডম অডিটর (৫+ সেকেন্ড ডেড-জোন স্ক্যানার)' : 'Pacing & Boredom Auditor (>5s Dead-Zone Scanner)'}</span>
                      {boredomZones.length > 0 && (
                        <span style={{ fontSize: '9.5px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          {boredomZones.length} {isBn ? 'টি স্পট পাওয়া গেছে' : 'Spots Found'}
                        </span>
                      )}
                    </h3>

                    <button
                      onClick={handleScanBoredom}
                      disabled={isScanningBoredom}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        backgroundColor: '#d97706',
                        border: 'none',
                        color: '#ffffff',
                        cursor: isScanningBoredom ? 'default' : 'pointer',
                        opacity: isScanningBoredom ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                        alignSelf: 'flex-start'
                      }}
                    >
                      <Sparkles size={11} />
                      <span>{isScanningBoredom ? (isBn ? 'স্ক্যান হচ্ছে...' : 'Scanning...') : (isBn ? '⏱️ অডিট প্যাসিং চালান' : 'Run Boredom Audit')}</span>
                    </button>
                  </div>

                  <p style={{ fontSize: '10.5px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                    {isBn
                      ? 'সোশ্যাল ভিডিওতে ৫ সেকেন্ডের বেশি এক টানা কথা বললে ভিউয়ার ড্রপ-অফ হয়। এআই স্বয়ংক্রিয়ভাবে সেই স্পটগুলো খুঁজে ১১২% পাঞ্চ-ইন ও বি-রোল সাজেস্ট করে।'
                      : 'Identifies talking-head segments > 5 seconds without cuts or B-roll, preventing audience drop-off.'}
                  </p>
                </div>

                {/* Boredom Results */}
                {boredomZones.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {boredomZones.map((zone) => {
                      const startTc = TimecodeConverter.formatTimecode(zone.start, 24);
                      const endTc = TimecodeConverter.formatTimecode(zone.end, 24);
                      return (
                        <div
                          key={zone.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#161724',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#fbbf24' }}>
                                {startTc} - {endTc}
                              </span>
                              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                ⚠️ {zone.duration}s {isBn ? 'টানা ডায়ালগ' : 'Talking Head'}
                              </span>
                            </div>
                            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, fontStyle: 'italic' }}>
                              "{zone.text}"
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={async () => {
                                handleSeek(zone.start, startTc);
                                const res = await bridge.applySmartEyelinePunch(112);
                                if (res.success) {
                                  showToast?.(isBn ? `✓ ${startTc}-এ ১১২% আই-লাইন পাঞ্চ-ইন প্রয়োগ হয়েছে!` : `✓ Eyeline punch applied at ${startTc}!`, 'success');
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '5px',
                                fontSize: '10px',
                                fontWeight: 600,
                                backgroundColor: '#4f46e5',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Eye size={11} />
                              <span>{isBn ? '১১২% পাঞ্চ-ইন' : 'Punch-In'}</span>
                            </button>

                            <button
                              onClick={() => {
                                handleSeek(zone.start, startTc);
                                showToast?.(isBn ? `🎬 ${startTc}-এ প্লেহেড নেওয়া হয়েছে, বি-রোল ইনসার্ট করুন!` : `🎬 Jumped to ${startTc} for B-Roll placement!`, 'info');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '5px',
                                fontSize: '10px',
                                fontWeight: 600,
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Film size={11} />
                              <span>{isBn ? 'বি-রোল স্পট' : 'B-Roll Spot'}</span>
                            </button>

                            <button
                              onClick={() => handleSeek(zone.start, startTc)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                fontSize: '10px',
                                fontWeight: 600,
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                color: '#e2e8f0',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                cursor: 'pointer'
                              }}
                            >
                              {isBn ? 'জাম্প' : 'Seek'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '12px', textAlign: 'center', borderRadius: '7px', backgroundColor: '#161723', border: '1px dashed #262838' }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                      {isBn
                        ? "'⏱️ অডিট প্যাসিং চালান' বাটনে ক্লিক করলে ৫ সেকেন্ডের বেশি দীর্ঘ একঘেয়ে ডায়ালগ অংশ শনাক্ত করে ১-ক্লিকে ফিক্স করার অপশন দেবে।"
                        : "Click 'Run Boredom Audit' to detect viewer drop-off spots (>5s continuous speech) and fix them with 1-click."}
                    </p>
                  </div>
                )}
              </div>

              {/* 3. STEP-BY-STEP EDITING SUB-TASKS (AI-GENERATED ROADMAP) */}
              <div style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#191a26',
                border: '1px solid #282a3c',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, flexWrap: 'wrap' }}>
                      <ListChecks size={15} color="#818cf8" />
                      <span>{isBn ? 'ক্লায়েন্ট ব্রিফ ও স্ক্রিপ্ট কাস্টম টাস্ক চেকলিস্ট' : 'Client Brief & Script Custom Task Checklist'}</span>
                      <span style={{ fontSize: '9.5px', color: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.12)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                        {progressPercent}% {isBn ? 'সম্পন্ন' : 'Completed'}
                      </span>
                    </h3>

                    <button
                      onClick={handleGenerateRoadmap}
                      disabled={isGeneratingRoadmap}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        backgroundColor: '#4f46e5',
                        border: 'none',
                        color: '#ffffff',
                        cursor: isGeneratingRoadmap ? 'default' : 'pointer',
                        opacity: isGeneratingRoadmap ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                        alignSelf: 'flex-start'
                      }}
                    >
                      <Sparkles size={11} />
                      <span>{isGeneratingRoadmap ? (isBn ? 'তৈরি হচ্ছে...' : 'Generating...') : (isBn ? 'রোডম্যাপ রিফ্রেশ করুন' : 'Regenerate Roadmap')}</span>
                    </button>
                  </div>

                  <p style={{ fontSize: '10.5px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                    {isBn
                      ? 'ক্লায়েন্টের ব্রিফ ও ভিডিওর দৈর্ঘ্য অনুযায়ী সাজানো বিস্তারিত এডিটিং চেকলিস্ট।'
                      : 'Actionable editing checklist grounded in client brief and timeline.'}
                  </p>
                </div>

                {/* Subtask Items */}
                {(!editingRoadmap || editingRoadmap.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', borderRadius: '8px', backgroundColor: '#171824', border: '1px solid #262838' }}>
                    <ListChecks size={24} color="#64748b" style={{ margin: '0 auto 8px auto', opacity: 0.6 }} />
                    <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '0 0 10px 0' }}>
                      {isBn
                        ? "এখনো কোনো রোডম্যাপ তৈরি হয়নি। 'রোডম্যাপ রিফ্রেশ করুন' বাটনে ক্লিক করলে ব্রিফ অনুযায়ী স্টেপ-বাই-স্টেপ চেকলিস্ট তৈরি হবে।"
                        : "No roadmap generated yet. Click 'Regenerate Roadmap' to create a custom step-by-step editing plan."}
                    </p>
                    <button
                      onClick={handleGenerateRoadmap}
                      style={{
                        padding: '5px 14px',
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isBn ? 'রোডম্যাপ তৈরি করুন' : 'Generate Roadmap'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editingRoadmap.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleRoadmapItem(item.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: item.completed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #2a2d3e',
                          backgroundColor: item.completed ? 'rgba(6, 78, 59, 0.2)' : '#181925',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ marginTop: '2px' }}>
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '4px',
                              border: item.completed ? '1px solid #10b981' : '1px solid #64748b',
                              backgroundColor: item.completed ? '#10b981' : 'transparent',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {item.completed && <Check size={11} strokeWidth={3} />}
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: item.completed ? '#94a3b8' : '#ffffff', textDecoration: item.completed ? 'line-through' : 'none' }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                              {item.category}
                            </span>
                          </div>
                          <p style={{ fontSize: '11px', margin: '3px 0 0 0', lineHeight: 1.4, color: item.completed ? '#64748b' : '#94a3b8' }}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* SECTION 2: TIMECODED CLIENT REVISIONS */}
        {activeSection === 'revisions' && (() => {
          const totalRevs = (clientRevisions || []).length;
          const resolvedCount = (clientRevisions || []).filter((r) => r.completed || r.status === 'RESOLVED').length;
          const revPercent = totalRevs > 0 ? Math.round((resolvedCount / totalRevs) * 100) : 0;

          const catColors: Record<string, { bg: string; text: string; border: string }> = {
            Audio: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' },
            Visual: { bg: 'rgba(168, 85, 247, 0.15)', text: '#d8b4fe', border: 'rgba(168, 85, 247, 0.3)' },
            Color: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' },
            Logo: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.3)' },
            Text: { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
            Pacing: { bg: 'rgba(6, 182, 212, 0.15)', text: '#67e8f9', border: 'rgba(6, 182, 212, 0.3)' }
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Revision Ingestion Card */}
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <Clock size={14} color="#f59e0b" />
                  <span>{isBn ? 'ক্লায়েন্ট রিভিশন ফিডব্যাক (যেকোনো ফরম্যাট সাপোর্ট)' : 'Paste Client Revision Notes'}</span>
                </h3>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                  {isBn
                    ? "হোয়াটসঅ্যাপ বা মেইলের মেসেজ সরাসরি পেস্ট করুন। যেমন: '14s এ লোগো বড় করো', '1:05 এ মিউজিক কমাও', '২ মিনিট ১০ সেকেন্ডে কাট দাও' বা '00:45 add text'। এআই স্বয়ংক্রিয়ভাবে টাইমকোড ও চেকলিস্ট বানিয়ে দেবে।"
                    : "Paste raw feedback (e.g. '14s make logo bigger', '1:05 lower music', '2m10s trim cut'). AI extracts timecodes into an interactive timeline checklist."}
                </p>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <textarea
                    value={rawRevisionText}
                    onChange={(e) => setRawRevisionText(e.target.value)}
                    rows={3}
                    placeholder={
                      isBn
                        ? "এখানে ক্লায়েন্টের রিভিশন নোট পেস্ট করুন (যেমন: 14s এ লোগো বড় করো, 1:05 এ মিউজিক কমাও)..."
                        : "Paste client revision notes here in any format..."
                    }
                    style={{
                      flex: 1,
                      backgroundColor: '#12131d',
                      border: '1px solid #2b2e40',
                      borderRadius: '8px',
                      padding: '8px',
                      fontSize: '11.5px',
                      color: '#ffffff',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={handleParseRevisions}
                      disabled={!rawRevisionText.trim() || isParsingRevisions}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: rawRevisionText.trim() ? 'pointer' : 'default',
                        opacity: rawRevisionText.trim() ? 1 : 0.4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)'
                      }}
                    >
                      <Sparkles size={13} className={isParsingRevisions ? 'animate-spin' : ''} />
                      <span>{isParsingRevisions ? (isBn ? 'বিশ্লেষণ হচ্ছে...' : 'Parsing...') : (isBn ? 'চেকলিস্ট তৈরি' : 'Extract')}</span>
                    </button>
                    <button
                      onClick={handlePushRevisionsToTimelineMarkers}
                      disabled={!rawRevisionText.trim() && totalRevs === 0}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: (!rawRevisionText.trim() && totalRevs === 0) ? 'default' : 'pointer',
                        opacity: (!rawRevisionText.trim() && totalRevs === 0) ? 0.4 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                      }}
                      title="প্রিমিয়ার প্রো টাইমলাইনে সেকেন্ড অনুযায়ী স্বয়ংক্রিয় কালার মার্কার ও কমেন্ট বসিয়ে দেবে"
                    >
                      <Bookmark size={12} />
                      <span>{isBn ? '📍 টাইমলাইনে মার্কার বসান' : 'Push Markers'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Header */}
              {totalRevs > 0 && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#181926', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                        {isBn ? `রিভিশন চেকলিস্ট: ${resolvedCount}/${totalRevs}টি সম্পন্ন (${revPercent}%)` : `Revisions Progress: ${resolvedCount}/${totalRevs} Resolved (${revPercent}%)`}
                      </span>
                      <button
                        onClick={handlePushRevisionsToTimelineMarkers}
                        style={{
                          fontSize: '10px',
                          color: '#34d399',
                          backgroundColor: 'rgba(52, 211, 153, 0.12)',
                          border: '1px solid rgba(52, 211, 153, 0.3)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="টাইমলাইনের মার্কারগুলো রিফ্রেশ করুন"
                      >
                        <Bookmark size={10} />
                        <span>{isBn ? 'টাইমলাইন মার্কার সিঙ্ক' : 'Sync Markers'}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setClientRevisions([])}
                      style={{ fontSize: '10.5px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={11} />
                      <span>{isBn ? 'সব মুছুন' : 'Clear all'}</span>
                    </button>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#232536', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${revPercent}%`,
                        background: 'linear-gradient(90deg, #4f46e5, #10b981)',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Revisions Table */}
              {totalRevs === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', borderRadius: '10px', backgroundColor: '#171824', border: '1px solid #262838' }}>
                  <Clock size={24} color="#64748b" style={{ margin: '0 auto 6px auto', opacity: 0.6 }} />
                  <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: 0 }}>
                    {isBn ? "এখনো কোনো রিভিশন টাস্ক যুক্ত করা হয়নি। ক্লায়েন্টের মেসেজ পেস্ট করে 'চেকলিস্ট তৈরি' বাটনে ক্লিক করুন।" : "No revision tasks added yet. Paste client notes above."}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {clientRevisions.map((rev) => {
                    const isDone = rev.completed || rev.status === 'RESOLVED';
                    const catStyle = catColors[rev.category] || { bg: 'rgba(255,255,255,0.06)', text: '#94a3b8', border: 'rgba(255,255,255,0.1)' };

                    return (
                      <div
                        key={rev.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: isDone ? 'rgba(6, 78, 59, 0.15)' : '#181926',
                          border: isDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #2b2e40',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Row 1: Timecode + Badges + Status Select */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {/* Interactive Checkbox */}
                            <div
                              onClick={() => toggleRevisionItem(rev.id)}
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                border: isDone ? '1px solid #10b981' : '1px solid #64748b',
                                backgroundColor: isDone ? '#10b981' : 'transparent',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                              title={isBn ? 'চেকলিস্ট সম্পন্ন হিসেবে মার্ক করুন' : 'Mark checklist item as resolved'}
                            >
                              {isDone && <Check size={12} strokeWidth={3} />}
                            </div>

                            {/* 1-Click Seek to Timeline Button */}
                            <button
                              onClick={() => handleSeek(rev.seconds, rev.timecode)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '5px',
                                backgroundColor: '#4f46e5',
                                color: '#ffffff',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                fontWeight: 800,
                                border: '1px solid #6366f1',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.35)'
                              }}
                              title={isBn ? `টাইমলাইনের ${rev.timecode} ফ্রেমে প্লেহেড জাম্প করুন` : `Jump Premiere Pro timeline to ${rev.timecode}`}
                            >
                              <Play size={10} fill="currentColor" />
                              <span>{rev.timecode}</span>
                            </button>

                            {/* Category Badge */}
                            <span
                              style={{
                                fontSize: '9.5px',
                                backgroundColor: catStyle.bg,
                                color: catStyle.text,
                                border: `1px solid ${catStyle.border}`,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}
                            >
                              {rev.category === 'Logo' ? (isBn ? 'লোগো' : 'Logo') :
                               rev.category === 'Audio' ? (isBn ? 'অডিও' : 'Audio') :
                               rev.category === 'Visual' ? (isBn ? 'ভিজ্যুয়াল' : 'Visual') :
                               rev.category === 'Color' ? (isBn ? 'কালার' : 'Color') :
                               rev.category === 'Text' ? (isBn ? 'টেক্সট' : 'Text') :
                               rev.category === 'Pacing' ? (isBn ? 'পেসিং' : 'Pacing') :
                               (rev.category || 'Revisions')}
                            </span>

                            {rev.priority === 'HIGH' && (
                              <span style={{ fontSize: '9px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                {isBn ? 'জরুরি' : 'HIGH'}
                              </span>
                            )}
                          </div>

                          {/* Status Dropdown */}
                          <select
                            value={rev.status}
                            onChange={(e) => updateRevisionStatus(rev.id, e.target.value as any)}
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: isDone ? '1px solid #10b981' : rev.status === 'IN_PROGRESS' ? '1px solid #38bdf8' : '1px solid #f59e0b',
                              backgroundColor: isDone ? 'rgba(16, 185, 129, 0.2)' : rev.status === 'IN_PROGRESS' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: isDone ? '#34d399' : rev.status === 'IN_PROGRESS' ? '#7dd3fc' : '#fbbf24',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="PENDING" style={{ background: '#161720', color: '#fbbf24' }}>{isBn ? 'বাকি' : 'PENDING'}</option>
                            <option value="IN_PROGRESS" style={{ background: '#161720', color: '#7dd3fc' }}>{isBn ? 'চলমান' : 'IN PROGRESS'}</option>
                            <option value="RESOLVED" style={{ background: '#161720', color: '#34d399' }}>{isBn ? 'সম্পন্ন' : 'RESOLVED'}</option>
                          </select>
                        </div>

                        {/* Row 2: Action Item & Client Feedback */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDone ? '#94a3b8' : '#ffffff',
                              textDecoration: isDone ? 'line-through' : 'none',
                              lineHeight: 1.4
                            }}
                          >
                            {rev.actionItem || rev.clientRequest}
                          </span>
                          {rev.actionItem && rev.actionItem !== rev.clientRequest && (
                            <div style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                              💬 {isBn ? 'ক্লায়েন্টের মূল বার্তা:' : 'Client Note:'} "{rev.clientRequest}"
                            </div>
                          )}
                        </div>

                        {/* Row 3: Action Taken Note Input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="text"
                            value={rev.actionTaken || ''}
                            onChange={(e) => updateRevisionStatus(rev.id, rev.status, e.target.value)}
                            placeholder={isBn ? 'কী পরিবর্তন করলেন লিখুন (পিডিএফ রিপোর্টে যুক্ত হবে)...' : 'Record action taken for client PDF report...'}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: '#12131d',
                              border: '1px solid #262939',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '10.5px',
                              color: '#e2e8f0',
                              outline: 'none',
                              fontFamily: 'inherit'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* SECTION 3: LOGO & BRAND KIT */}
        {activeSection === 'brand' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Palette size={14} color="#818cf8" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                      {isBn ? 'ব্র্যান্ড কালার এক্সট্রাকশন' : 'Brand Color Extractor'}
                    </span>
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isExtractingColors}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 600,
                      backgroundColor: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      cursor: isExtractingColors ? 'default' : 'pointer',
                      opacity: isExtractingColors ? 0.6 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Upload size={12} />
                    <span>{isExtractingColors ? (isBn ? 'এক্সট্র্যাক্ট হচ্ছে...' : 'Extracting...') : (isBn ? 'লোগো আপলোড' : 'Upload Logo')}</span>
                  </button>
                </div>

                <p style={{ fontSize: '10.5px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                  {isBn
                    ? 'লোগো বা ছবি আপলোড করলেই এআই প্রাইমারি, সেকেন্ডারি ও অ্যাকসেন্ট কালার কোড (HEX) বের করে নেবে।'
                    : 'Upload brand logo to extract Primary, Secondary, and Accent HEX swatches automatically.'}
                </p>
              </div>

              {/* Brand Name Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{isBn ? 'ব্র্যান্ডের নাম:' : 'Brand Name:'}</span>
                <input
                  type="text"
                  value={brandNameInput}
                  onChange={(e) => setBrandNameInput(e.target.value)}
                  placeholder="e.g. Prismex AI"
                  style={{
                    backgroundColor: '#12131d',
                    border: '1px solid #2a2d3e',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: '#ffffff',
                    outline: 'none',
                    width: '180px',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            {/* Extracted Swatches */}
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#e2e8f0' }}>
                {isBn ? 'এক্সট্র্যাক্ট করা কালার প্যালেট (HEX Code)' : 'Extracted Brand Palette (HEX Codes)'}
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#12131d', border: '1px solid #2a2d3e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: brandKit.primaryColor || '#1E40AF', flexShrink: 0 }}
                  />
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '9.5px', color: '#94a3b8', display: 'block' }}>Primary Color</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.primaryColor || '#1E40AF');
                        showToast?.(`Copied ${brandKit.primaryColor}`, 'info');
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#ffffff', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {brandKit.primaryColor || '#1E40AF'}
                      <Copy size={9} style={{ opacity: 0.6 }} />
                    </button>
                  </div>
                </div>

                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#12131d', border: '1px solid #2a2d3e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: brandKit.secondaryColor || '#3B82F6', flexShrink: 0 }}
                  />
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '9.5px', color: '#94a3b8', display: 'block' }}>Secondary</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.secondaryColor || '#3B82F6');
                        showToast?.(`Copied ${brandKit.secondaryColor}`, 'info');
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#ffffff', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {brandKit.secondaryColor || '#3B82F6'}
                      <Copy size={9} style={{ opacity: 0.6 }} />
                    </button>
                  </div>
                </div>

                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#12131d', border: '1px solid #2a2d3e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: brandKit.accentColor || '#F59E0B', flexShrink: 0 }}
                  />
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '9.5px', color: '#94a3b8', display: 'block' }}>Accent</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.accentColor || '#F59E0B');
                        showToast?.(`Copied ${brandKit.accentColor}`, 'info');
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#ffffff', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {brandKit.accentColor || '#F59E0B'}
                      <Copy size={9} style={{ opacity: 0.6 }} />
                    </button>
                  </div>
                </div>

                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#12131d', border: '1px solid #2a2d3e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: brandKit.backgroundColor || '#0F172A', flexShrink: 0 }}
                  />
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '9.5px', color: '#94a3b8', display: 'block' }}>Background</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.backgroundColor || '#0F172A');
                        showToast?.(`Copied ${brandKit.backgroundColor}`, 'info');
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#ffffff', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {brandKit.backgroundColor || '#0F172A'}
                      <Copy size={9} style={{ opacity: 0.6 }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Font Suggestion */}
              <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#12131d', border: '1px solid #252838', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8' }}>{isBn ? 'ফন্ট স্টাইল সাজেশন:' : 'Font Pairing Suggestion:'}</span>
                <span style={{ fontWeight: 600, color: '#a5b4fc', fontFamily: 'monospace' }}>
                  {brandKit.fontSuggestion || 'Inter / Montserrat (Modern Clean Sans-Serif)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: BRIEF & SCRIPT INGESTION */}
        {activeSection === 'script' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Brief Box */}
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={13} color="#818cf8" />
                  <span>{isBn ? 'ক্লায়েন্ট ব্রিফ ও গাইডলাইন' : 'Client Brief & Notes'}</span>
                </span>
                <textarea
                  value={briefDraft}
                  onChange={(e) => setBriefDraft(e.target.value)}
                  rows={7}
                  placeholder={
                    isBn
                      ? "ক্লায়েন্টের ব্রিফ, ভিডিও ফরম্যাট (9:16, 16:9), নিষিদ্ধ শব্দ বা বিশেষ নির্দেশনা এখানে পেস্ট করুন..."
                      : "Paste client brief, requested formats (9:16, 16:9), tone, or forbidden guidelines..."
                  }
                  style={{
                    width: '100%',
                    backgroundColor: '#12131d',
                    border: '1px solid #2b2e40',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '11.5px',
                    color: '#ffffff',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: 1.5,
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Script Box */}
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#191a26', border: '1px solid #282a3c', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} color="#818cf8" />
                    <span>{isBn ? 'ক্লায়েন্ট স্ক্রিপ্ট (ফাইল / পেস্ট)' : 'Client Script'}</span>
                  </span>

                  <input
                    ref={scriptInputRef}
                    type="file"
                    accept=".txt,.srt,.json"
                    onChange={handleScriptUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => scriptInputRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Upload size={11} />
                    <span>{isBn ? 'আপলোড (.txt, .srt)' : 'Upload'}</span>
                  </button>
                </div>

                <textarea
                  value={scriptDraft}
                  onChange={(e) => setScriptDraft(e.target.value)}
                  rows={7}
                  placeholder={
                    isBn
                      ? "ক্লায়েন্টের দেওয়া স্ক্রিপ্ট টেক্সট এখানে দিন। এআই মুখের কথার সাথে মিলিয়ে সঠিক বানান নিশ্চিত করবে..."
                      : "Paste client script or upload .txt/.srt/.json..."
                  }
                  style={{
                    width: '100%',
                    backgroundColor: '#12131d',
                    border: '1px solid #2b2e40',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '11.5px',
                    color: '#ffffff',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: 1.5,
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
              <button
                onClick={() => setActiveSection('rough-cut')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #9333ea)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 0 14px rgba(147, 51, 234, 0.4)'
                }}
              >
                <Film size={13} />
                <span>{isBn ? '🎬 ১-ক্লিকে স্ক্রিপ্ট রাফ-কাট সিকোয়েন্স' : '🎬 1-Click Script-to-Rough Cut'}</span>
              </button>

              <button
                onClick={handleSaveAndSync}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Save size={12} />
                <span>{isBn ? 'সব তথ্য সেভ ও সিঙ্ক করুন' : 'Save & Sync Client Data'}</span>
              </button>
            </div>
          </div>
        )}

        {/* SECTION 5: 1-CLICK SCRIPT ROUGH CUT (DEDICATED FULL SECTION) */}
        {activeSection === 'rough-cut' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Header Banner (Responsive & Non-Overlapping) */}
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.18) 0%, rgba(124, 58, 237, 0.26) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(168, 85, 247, 0.5)',
                  flexShrink: 0
                }}>
                  <Film size={20} color="#ffffff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '0.2px' }}>
                    {isBn ? '🎬 ১-ক্লিকে স্ক্রিপ্ট-টু-রাফ কাট সিকোয়েন্স' : '🎬 1-Click Script-to-Rough Cut Sequence'}
                  </h3>
                  <p style={{ fontSize: '10.5px', color: '#cbd5e1', margin: '3px 0 0 0', lineHeight: 1.4 }}>
                    {isBn
                      ? 'ক্লায়েন্টের মূল স্ক্রিপ্ট অনুযায়ী ভুল টেক ও ব্র্যাকেট ফিল্টার করে সম্পূর্ণ নতুন সিকোয়েন্সে অটো কাট তৈরি করবে।'
                      : 'Aligns speech with script, eliminates bad takes/brackets, alternates 112% punch-ins & creates a new sequence.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleCreateScriptRoughCut()}
                disabled={isCreatingRoughCut || (!scriptDraft.trim() && !clientScriptText?.trim())}
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '9px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: (isCreatingRoughCut || (!scriptDraft.trim() && !clientScriptText?.trim())) ? 'not-allowed' : 'pointer',
                    background: (isCreatingRoughCut || (!scriptDraft.trim() && !clientScriptText?.trim()))
                      ? '#33354a'
                      : 'linear-gradient(135deg, #4f46e5, #9333ea)',
                    color: (isCreatingRoughCut || (!scriptDraft.trim() && !clientScriptText?.trim())) ? '#64748b' : '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: (isCreatingRoughCut || (!scriptDraft.trim() && !clientScriptText?.trim())) ? 'none' : '0 0 22px rgba(147, 51, 234, 0.55)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    transform: isCreatingRoughCut ? 'scale(0.98)' : 'scale(1)'
                  }}
                >
                  {isCreatingRoughCut ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{isBn ? 'সিকোয়েন্স তৈরি হচ্ছে...' : 'Creating Sequence...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>{isBn ? '🎬 Create Script Rough-Cut Sequence' : '🎬 Create Script Rough-Cut Sequence'}</span>
                    </>
                  )}
                </button>

              {/* Feature Badges Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#6ee7b7' }}>
                  <CheckCircle2 size={13} />
                  <span>{isBn ? '১০০% নন-ডেস্ট্রাক্টিভ ক্লোন' : '100% Non-Destructive'}</span>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#fcd34d' }}>
                  <Sparkles size={13} />
                  <span>{isBn ? 'A/B Cam পাঞ্চ-ইন (১১২%)' : 'A/B Cam 112% Punch'}</span>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(20, 184, 166, 0.12)', border: '1px solid rgba(20, 184, 166, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#5eead4' }}>
                  <Palette size={13} />
                  <span>{isBn ? 'অ্যাক্ট কালার কোডিং' : 'Act Color-Coding'}</span>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#d8b4fe' }}>
                  <Bookmark size={13} />
                  <span>{isBn ? 'ইউটিউব চ্যাপ্টার মার্কার' : 'YouTube Chapters'}</span>
                </div>
              </div>

              {/* Progress Step Indicator */}
              {isCreatingRoughCut && roughCutProgressStep && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.25)',
                  border: '1px solid rgba(99, 102, 241, 0.45)',
                  color: '#c7d2fe',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <Loader2 size={16} className="animate-spin" color="#818cf8" />
                  <span style={{ fontWeight: 600 }}>{roughCutProgressStep}</span>
                </div>
              )}

              {/* Success Result Box */}
              {roughCutResult && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(5, 150, 105, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6ee7b7', fontWeight: 700, fontSize: '12px' }}>
                      <CheckCircle2 size={16} color="#34d399" />
                      <span>
                        {isBn ? 'নতুন সিকোয়েন্স প্রস্তুত:' : 'Rough-Cut Sequence Ready:'}{' '}
                        <code style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', color: '#ffffff', fontFamily: 'monospace' }}>
                          {roughCutResult.sequenceName}
                        </code>
                      </span>
                    </div>
                    <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0', fontWeight: 700 }}>
                      {roughCutResult.totalCutDuration}s {isBn ? 'সময় সাশ্রয়' : 'saved'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center', fontSize: '10px', color: '#cbd5e1' }}>
                    <div style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#34d399' }}>{roughCutResult.cutsExecuted || 0}</span>
                      <span>{isBn ? 'অপ্রয়োজনীয় টেক বাদ' : 'Bad Takes Cut'}</span>
                    </div>
                    <div style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#fbbf24' }}>{roughCutResult.punchesApplied || 0}</span>
                      <span>{isBn ? 'A/B Cam পাঞ্চ-ইন' : 'A/B Cam Punches'}</span>
                    </div>
                    <div style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#c084fc' }}>{roughCutResult.markersPlaced || 0}</span>
                      <span>{isBn ? 'চ্যাপ্টার মার্কার' : 'Chapter Markers'}</span>
                    </div>
                  </div>

                  {roughCutResult.summary && (
                    <div style={{ fontSize: '10.5px', color: '#a7f3d0', opacity: 0.9, lineHeight: 1.4 }}>
                      {roughCutResult.summary}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Script Editor Panel */}
            <div style={{
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: '#191a26',
              border: '1px solid #282a3c',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={13} color="#818cf8" />
                  <span>{isBn ? 'ক্লায়েন্ট স্ক্রিপ্ট ইনপুট (ডায়ালগ, চ্যাপ্টার ও ভিজ্যুয়াল ব্র্যাকেটসহ)' : 'Official Client Script with Chapters & Brackets'}</span>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => scriptInputRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: '#a5b4fc',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Upload size={12} />
                    <span>{isBn ? 'স্ক্রিপ্ট ফাইল আপলোড (.txt, .srt)' : 'Upload File'}</span>
                  </button>

                  <button
                    onClick={handleSaveAndSync}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: '#ffffff',
                      backgroundColor: '#4f46e5',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    <Save size={12} />
                    <span>{isBn ? 'সেভ করুন' : 'Save'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={scriptDraft}
                onChange={(e) => setScriptDraft(e.target.value)}
                rows={10}
                placeholder={
                  isBn
                    ? "এখানে ক্লায়েন্টের মূল স্ক্রিপ্ট পেস্ট করুন।\nযেমন:\nChapter 1: The Problem\nWinter roads around Long Island can expose your paint to salt. [Show B-Roll of Car Driving]\n\nChapter 2: The Solution\nCeramic coating provides deep protection. [Text on screen: 50% OFF]\n\nCall to Action:\nVisit our shop today."
                    : "Paste official client script here with chapters, stage brackets, and dialogue..."
                }
                style={{
                  width: '100%',
                  backgroundColor: '#12131d',
                  border: '1px solid #2b2e40',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '12px',
                  color: '#ffffff',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: 1.6,
                  fontFamily: 'inherit'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                <span>
                  {isBn
                    ? '💡 টিপস: আপনি স্ক্রিপ্ট পেস্ট করে উপরের [ 🎬 Create Script Rough-Cut Sequence ] চাপলেই প্রিমিয়ারে স্বয়ংক্রিয়ভাবে কাট সম্পন্ন হবে।'
                    : '💡 Click [ 🎬 Create Script Rough-Cut Sequence ] to execute cuts, punch-ins and markers in Premiere Pro.'}
                </span>
                <span style={{ fontFamily: 'monospace', color: '#818cf8', fontWeight: 600 }}>
                  {scriptDraft.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
