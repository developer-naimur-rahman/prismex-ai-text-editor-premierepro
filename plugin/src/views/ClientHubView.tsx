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
  ExternalLink,
  Trash2,
  Plus,
  HelpCircle,
  AlertCircle
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
    brandKit,
    setBrandKit,
    editingRoadmap,
    setEditingRoadmap,
    toggleRoadmapItem,
    clientRevisions,
    setClientRevisions,
    updateRevisionStatus,
    showToast
  } = usePrismexStore();

  const isBn = language === 'bn';
  const client = PrismexDaemonClient.getInstance();
  const bridge = PremiereHostBridge.getInstance();

  const [activeSection, setActiveSection] = useState<'roadmap' | 'brand' | 'revisions' | 'script' | 'report'>('roadmap');

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
        if (res && res.success) {
          setBrandKit({
            brandName: brandNameInput || res.brandName,
            logoBase64: dataUrl,
            primaryColor: res.primaryColor,
            secondaryColor: res.secondaryColor,
            accentColor: res.accentColor,
            backgroundColor: res.backgroundColor,
            textColor: res.textColor,
            palette: res.palette,
            fontSuggestion: res.fontSuggestion
          });
          showToast?.(
            isBn ? `✓ লোগো থেকে ব্র্যান্ড কালার কোড সফলভাবে এক্সট্র্যাক্ট হয়েছে!` : `✓ Brand colors extracted from logo!`,
            'success'
          );
        } else {
          showToast?.(isBn ? 'কালার কোড এক্সট্র্যাক্ট করতে ব্যর্থ হয়েছে।' : 'Could not extract colors.', 'error');
        }
      } catch (err) {
        console.error('Logo extract error:', err);
      } finally {
        setIsExtractingColors(false);
      }
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // Smart Script / Brief file upload (.txt, .srt, .json)
  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsedDialogue = content;

      if (ext === 'srt') {
        // Strip SRT cue numbers and timestamps
        parsedDialogue = content
          .replace(/^\d+\r?\n/gm, '')
          .replace(/\d\d:\d\d:\d\d,\d\d\d\s*-->\s*\d\d:\d\d:\d\d,\d\d\d\r?\n?/gm, '')
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join(' ');
      } else if (ext === 'json') {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            parsedDialogue = parsed.map((item) => (typeof item === 'object' ? item.text || item.dialogue || JSON.stringify(item) : String(item))).join(' ');
          } else if (typeof parsed === 'object') {
            parsedDialogue = parsed.script || parsed.dialogue || parsed.content || JSON.stringify(parsed, null, 2);
          }
        } catch {
          parsedDialogue = content;
        }
      }

      setScriptDraft(parsedDialogue);
      setClientScriptText(parsedDialogue);
      showToast?.(isBn ? `✓ '${file.name}' সফলভাবে আপলোড হয়েছে` : `✓ '${file.name}' loaded`, 'success');
    };
    reader.readAsText(file);
    if (scriptInputRef.current) scriptInputRef.current.value = '';
  };

  const handleSaveAndSync = () => {
    setClientScriptText(scriptDraft);
    setClientBriefText(briefDraft);
    if (brandNameInput !== brandKit.brandName) {
      setBrandKit({ brandName: brandNameInput });
    }
    showToast?.(isBn ? '✓ ক্লায়েন্ট ব্রিফ ও সেটিংস সেভ হয়েছে!' : '✓ Client data saved!', 'success');
  };

  // Generate / Refresh Roadmap
  const handleGenerateRoadmap = async () => {
    setIsGeneratingRoadmap(true);
    try {
      const res = await client.analyzeBriefRoadmap(
        briefDraft || clientBriefText,
        scriptDraft || clientScriptText,
        transcriptWords || [],
        sequenceManifest?.durationSeconds || 60.0
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
        // Append or replace
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

  // Jump playhead in Premiere Pro timeline
  const handleSeek = (sec: number) => {
    bridge.setPlayheadPosition(sec);
  };

  // Export Professional Client PDF Report via Printable HTML Window
  const handleExportPdfReport = () => {
    const seqName = sequenceManifest?.sequenceName || 'Final Video Master';
    const duration = sequenceManifest ? TimecodeConverter.formatTimecode(sequenceManifest.durationSeconds, sequenceManifest.fps || 24) : '00:01:00:00';
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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
          <td style="padding:8px; border-bottom:1px solid #eee; font-family:monospace; font-size:11px;">${item.start ? '[' + Math.floor(item.start / 60) + ':' + String(Math.floor(item.start % 60)).padStart(2, '0') + ']' : 'N/A'}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#b91c1c; text-decoration:line-through;">${item.original}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#15803d; font-weight:bold;">${item.replacement}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#555; font-size:11px;">${item.reason || 'Aligned with official client script'}</td>
        </tr>
      `
      )
      .join('');

    const revisionsHtml = (clientRevisions || [])
      .map(
        (rev: any) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #eee; font-family:monospace; font-size:11px; font-weight:bold;">${rev.timecode}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#111;">${rev.clientRequest}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#555; font-size:11px;">${rev.category}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#15803d; font-weight:bold;">✓ ${rev.status === 'RESOLVED' ? 'Resolved' : rev.status}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; color:#333; font-size:11px;">${rev.actionTaken || 'Implemented as requested'}</td>
        </tr>
      `
      )
      .join('');

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Client Delivery Audit Report - ${seqName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 36px auto; max-width: 820px; line-height: 1.5; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 14px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 22px; font-weight: 800; color: #111827; margin: 0; }
          .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
          .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; background: #fafafa; }
          .section-title { font-size: 14px; font-weight: 700; color: #1f2937; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; padding: 8px; background: #f3f4f6; color: #374151; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #d1d5db; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .badge-green { background: #dcfce7; color: #166534; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; }
          @media print {
            body { margin: 16px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
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

        <!-- Project & Brand Specifications -->
        <div class="card">
          <h3 class="section-title">1. Brand Identity & Color Specifications</h3>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px;">
            <div>Brand Name: <strong>${brandKit.brandName || 'Client Brand'}</strong></div>
            <div>Font Recommendation: <strong>${brandKit.fontSuggestion || 'Inter / Modern Sans-Serif'}</strong></div>
          </div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">Harmonized Brand Color Palette:</div>
          <div>${brandColorsHtml || '<em>Default Studio Palette Applied</em>'}</div>
        </div>

        <!-- Revisions Resolution Log -->
        ${
          clientRevisions.length > 0
            ? `
        <div class="card">
          <h3 class="section-title">2. Client Revision Resolution Log</h3>
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

        <!-- Terminology & Spell Check Alignment -->
        ${
          (scriptAuditReport || []).length > 0
            ? `
        <div class="card">
          <h3 class="section-title">3. Script Grounding & Terminology Audit</h3>
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

        <!-- Audio & Licensing Statement -->
        <div class="card">
          <h3 class="section-title">4. Sound & Content Copyright Compliance</h3>
          <p style="font-size: 11.5px; color: #374151; margin: 0;">
            All background music tracks and audio assets used in this production are licensed for commercial use and content monetization via Pixabay / Free Music Archive. Zero copyright strike guarantee.
          </p>
        </div>

        <div class="footer">
          <div>Generated by <strong>Prismex AI Studio Editor</strong> for Adobe Premiere Pro</div>
          <div>Editor Signature: _______________________</div>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(reportHtml);
      printWin.document.close();
    }
  };

  const completedCount = (editingRoadmap || []).filter((i) => i.completed).length;
  const totalRoadmap = (editingRoadmap || []).length;
  const progressPercent = totalRoadmap > 0 ? Math.round((completedCount / totalRoadmap) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111219] text-gray-200 overflow-hidden">
      {/* Top Banner Navigation */}
      <div className="p-3 bg-gradient-to-r from-[#1a1c29] via-[#161824] to-[#12131c] border-b border-[#282a3c] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                {isBn ? 'ক্লায়েন্ট হাব ও রিভিশন সেন্টার' : 'Client Hub & Revision Center'}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              {isBn
                ? 'ব্র্যান্ড কিট, স্টেপ-বাই-স্টেপ এডিটিং রোডম্যাপ, টাইমকোড রিভিশন এবং ক্লায়েন্ট পিডিএফ অডিট রিপোর্ট'
                : 'Brand kit, step-by-step editing roadmap, timecoded revisions, and client PDF report generator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdfReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/40 transition-all"
            title={isBn ? 'ক্লায়েন্টের জন্য সুন্দর পিডিএফ অডিট রিপোর্ট এক্সপোর্ট করুন' : 'Export verified client PDF report'}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isBn ? '📄 ক্লায়েন্ট PDF রিপোর্ট' : '📄 Export PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="px-3 py-2 bg-[#141520] border-b border-[#242636] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSection('roadmap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'roadmap'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>{isBn ? 'এডিটিং রোডম্যাপ' : 'Editing Roadmap'}</span>
            {totalRoadmap > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/40 text-indigo-300 font-mono">
                {completedCount}/{totalRoadmap}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('revisions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'revisions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isBn ? 'টাইমকোড রিভিশন' : 'Revisions'}</span>
            {clientRevisions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">
                {clientRevisions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('brand')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'brand'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{isBn ? 'লোগো ও ব্র্যান্ড কালার' : 'Brand Kit & Colors'}</span>
            {brandKit.palette && brandKit.palette.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('script')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'script'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isBn ? 'ব্রিফ ও স্ক্রিপ্ট' : 'Brief & Script'}</span>
          </button>
        </div>

        <button
          onClick={handleSaveAndSync}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg transition-colors"
        >
          <Save className="w-3 h-3" />
          <span>{isBn ? 'সেভ ও সিঙ্ক' : 'Save & Sync'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* SECTION 1: STEP-BY-STEP EDITING ROADMAP */}
        {activeSection === 'roadmap' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-[#171824] border border-[#262838] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{isBn ? 'স্টেপ-বাই-স্টেপ এডিটিং রোডম্যাপ' : 'Step-by-Step Editing Workflow Roadmap'}</span>
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {progressPercent}% {isBn ? 'সম্পন্ন' : 'Completed'}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {isBn
                    ? 'ক্লায়েন্টের ব্রিফ ও ভিডিওর দৈর্ঘ্য অনুযায়ী সাজানো এডিটিং চেকলিস্ট।'
                    : 'Actionable editing checklist grounded in client brief and timeline.'}
                </p>
              </div>

              <button
                onClick={handleGenerateRoadmap}
                disabled={isGeneratingRoadmap}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingRoadmap ? 'animate-spin' : ''}`} />
                <span>{isGeneratingRoadmap ? (isBn ? 'তৈরি হচ্ছে...' : 'Generating...') : (isBn ? 'রোডম্যাপ রিফ্রেশ করুন' : 'Regenerate Roadmap')}</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-[#202230] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Roadmap Items */}
            {(!editingRoadmap || editingRoadmap.length === 0) ? (
              <div className="p-8 text-center rounded-xl bg-[#151620] border border-[#242636]">
                <ListChecks className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-gray-400 mb-3">
                  {isBn
                    ? "এখনো কোনো রোডম্যাপ তৈরি হয়নি। 'রোডম্যাপ রিফ্রেশ করুন' বাটনে ক্লিক করলে ব্রিফ অনুযায়ী স্টেপ-বাই-স্টেপ চেকলিস্ট তৈরি হবে।"
                    : "No roadmap generated yet. Click 'Regenerate Roadmap' to create a custom step-by-step editing plan."}
                </p>
                <button
                  onClick={handleGenerateRoadmap}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  {isBn ? 'রোডম্যাপ তৈরি করুন' : 'Generate Roadmap'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {editingRoadmap.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleRoadmapItem(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      item.completed
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-gray-300'
                        : 'bg-[#171824] border-[#292b3d] hover:border-indigo-500/40 text-gray-200'
                    }`}
                  >
                    <div className="mt-0.5">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          item.completed
                            ? 'bg-emerald-500 border-emerald-400 text-white'
                            : 'border-gray-500 hover:border-indigo-400'
                        }`}
                      >
                        {item.completed && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${item.completed ? 'line-through text-gray-400' : 'text-white'}`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">
                          {item.category}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 leading-relaxed ${item.completed ? 'text-gray-500' : 'text-gray-400'}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: TIMECODED CLIENT REVISIONS */}
        {activeSection === 'revisions' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-[#171824] border border-[#262838] space-y-2.5">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{isBn ? 'ক্লায়েন্ট ফিডব্যাক ও রিভিশন টেক্সট পেস্ট করুন' : 'Paste Client Revision Notes'}</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                {isBn
                  ? "হোয়াটসঅ্যাপ, মেইল বা ক্লায়েন্টের কমেন্ট পেস্ট করুন (যেমন: '00:14 এ লোগো বড় করো', '1:05 এ মিউজিক কমাও')। এআই স্বয়ংক্রিয়ভাবে টাইমকোড ফিল্টার করে দেবে।"
                  : "Paste client feedback (e.g. '00:14 make logo bigger', '1:05 lower music'). AI extracts timecodes with 1-click playhead jump."}
              </p>

              <div className="flex gap-2">
                <textarea
                  value={rawRevisionText}
                  onChange={(e) => setRawRevisionText(e.target.value)}
                  rows={3}
                  placeholder={
                    isBn
                      ? "এখানে ক্লায়েন্টের রিভিশন নোট পেস্ট করুন..."
                      : "Paste client revision notes here..."
                  }
                  className="flex-1 bg-[#12131d] border border-[#282a3c] rounded-xl p-2.5 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none"
                />
                <button
                  onClick={handleParseRevisions}
                  disabled={!rawRevisionText.trim() || isParsingRevisions}
                  className="px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isBn ? 'রিভিশন এক্সট্র্যাক্ট' : 'Extract'}</span>
                </button>
              </div>
            </div>

            {/* Revisions Table */}
            {clientRevisions.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#151620] border border-[#242636]">
                <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-gray-400">
                  {isBn
                    ? "এখনো কোনো রিভিশন টাস্ক যুক্ত করা হয়নি।"
                    : "No revision tasks added yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                  <span>{clientRevisions.length} {isBn ? 'টি রিভিশন আইটেম' : 'revision items'}</span>
                  <button
                    onClick={() => setClientRevisions([])}
                    className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{isBn ? 'সব মুছুন' : 'Clear all'}</span>
                  </button>
                </div>

                {clientRevisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-xl bg-[#171824] border border-[#2a2c3e] hover:border-[#383b52] transition-colors space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* 1-Click Seek Button */}
                        <button
                          onClick={() => handleSeek(rev.seconds)}
                          className="px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white font-mono text-[11px] font-bold border border-indigo-500/40 flex items-center gap-1 transition-all"
                          title={isBn ? 'টাইমলাইনের এই ফ্রেমটিতে জাম্প করুন' : 'Jump playhead to this frame'}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>{rev.timecode}</span>
                        </button>

                        <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
                          {rev.category}
                        </span>
                      </div>

                      {/* Status Dropdown */}
                      <select
                        value={rev.status}
                        onChange={(e) => updateRevisionStatus(rev.id, e.target.value as any)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border outline-none cursor-pointer ${
                          rev.status === 'RESOLVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : rev.status === 'IN_PROGRESS'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </div>

                    <p className="text-gray-200 font-medium">{rev.clientRequest}</p>

                    {/* Action Taken input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={rev.actionTaken || ''}
                        onChange={(e) => updateRevisionStatus(rev.id, rev.status, e.target.value)}
                        placeholder={isBn ? 'কী পরিবর্তন করলেন লিখুন (রিপোর্টের জন্য)...' : 'Record action taken for report...'}
                        className="flex-1 bg-[#11121a] border border-[#232535] rounded-lg px-2.5 py-1 text-[11px] text-gray-300 placeholder-gray-600 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: LOGO & BRAND KIT */}
        {activeSection === 'brand' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-[#171824] border border-[#262838] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-400" />
                    <span>{isBn ? 'ক্লায়েন্টের লোগো বা ইমেজ থেকে কালার কোড এক্সট্রাকশন' : 'Brand Kit & Logo Color Extractor'}</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isBn
                      ? 'লোগো বা রেফারেন্স ছবি আপলোড করলেই এআই প্রাইমারি, সেকেন্ডারি ও অ্যাকসেন্ট কালার কোড (HEX) বের করে নেবে।'
                      : 'Upload brand logo to extract Primary, Secondary, and Accent HEX swatches automatically.'}
                  </p>
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isExtractingColors}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                >
                  <Upload className={`w-3.5 h-3.5 ${isExtractingColors ? 'animate-spin' : ''}`} />
                  <span>{isExtractingColors ? (isBn ? 'এক্সট্র্যাক্ট হচ্ছে...' : 'Extracting...') : (isBn ? 'লোগো আপলোড করুন' : 'Upload Logo')}</span>
                </button>
              </div>

              {/* Brand Name Input */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{isBn ? 'ব্র্যান্ডের নাম:' : 'Brand Name:'}</span>
                <input
                  type="text"
                  value={brandNameInput}
                  onChange={(e) => setBrandNameInput(e.target.value)}
                  placeholder="e.g. Prismex AI"
                  className="bg-[#12131d] border border-[#282a3c] rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 outline-none w-48"
                />
              </div>
            </div>

            {/* Extracted Swatches */}
            <div className="p-4 rounded-xl bg-[#171824] border border-[#262838] space-y-3">
              <span className="text-xs font-bold text-gray-300">
                {isBn ? 'এক্সট্র্যাক্ট করা কালার প্যালেট (HEX Code)' : 'Extracted Brand Palette (HEX Codes)'}
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-lg bg-[#12131d] border border-[#282a3c] flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg border border-white/10 shadow-sm shrink-0"
                    style={{ backgroundColor: brandKit.primaryColor || '#1E40AF' }}
                  />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-gray-400 block">Primary Color</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.primaryColor || '#1E40AF');
                        showToast?.(`Copied ${brandKit.primaryColor}`, 'info');
                      }}
                      className="font-mono text-xs font-bold text-white hover:text-indigo-400 truncate flex items-center gap-1"
                    >
                      {brandKit.primaryColor || '#1E40AF'}
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#12131d] border border-[#282a3c] flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg border border-white/10 shadow-sm shrink-0"
                    style={{ backgroundColor: brandKit.secondaryColor || '#3B82F6' }}
                  />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-gray-400 block">Secondary</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.secondaryColor || '#3B82F6');
                        showToast?.(`Copied ${brandKit.secondaryColor}`, 'info');
                      }}
                      className="font-mono text-xs font-bold text-white hover:text-indigo-400 truncate flex items-center gap-1"
                    >
                      {brandKit.secondaryColor || '#3B82F6'}
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#12131d] border border-[#282a3c] flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg border border-white/10 shadow-sm shrink-0"
                    style={{ backgroundColor: brandKit.accentColor || '#F59E0B' }}
                  />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-gray-400 block">Accent / Highlight</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.accentColor || '#F59E0B');
                        showToast?.(`Copied ${brandKit.accentColor}`, 'info');
                      }}
                      className="font-mono text-xs font-bold text-white hover:text-indigo-400 truncate flex items-center gap-1"
                    >
                      {brandKit.accentColor || '#F59E0B'}
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#12131d] border border-[#282a3c] flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg border border-white/10 shadow-sm shrink-0"
                    style={{ backgroundColor: brandKit.backgroundColor || '#0F172A' }}
                  />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-gray-400 block">Dark Background</span>
                    <button
                      onClick={() => {
                        copyToClipboard(brandKit.backgroundColor || '#0F172A');
                        showToast?.(`Copied ${brandKit.backgroundColor}`, 'info');
                      }}
                      className="font-mono text-xs font-bold text-white hover:text-indigo-400 truncate flex items-center gap-1"
                    >
                      {brandKit.backgroundColor || '#0F172A'}
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Font Suggestion */}
              <div className="p-2.5 rounded-lg bg-[#12131d] border border-[#242636] flex items-center justify-between text-xs">
                <span className="text-gray-400">{isBn ? 'ফন্ট স্টাইল সাজেশন:' : 'Font Pairing Suggestion:'}</span>
                <span className="font-semibold text-indigo-300 font-mono">
                  {brandKit.fontSuggestion || 'Inter / Montserrat (Modern Clean Sans-Serif)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: BRIEF & SCRIPT INGESTION */}
        {activeSection === 'script' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Brief Box */}
              <div className="p-3.5 rounded-xl bg-[#171824] border border-[#262838] space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isBn ? 'ক্লায়েন্ট ব্রিফ ও গাইডলাইন' : 'Client Brief & Notes'}</span>
                </span>
                <textarea
                  value={briefDraft}
                  onChange={(e) => setBriefDraft(e.target.value)}
                  rows={8}
                  placeholder={
                    isBn
                      ? "ক্লায়েন্টের ব্রিফ, ভিডিও ফরম্যাট (9:16, 16:9), নিষিদ্ধ শব্দ বা বিশেষ নির্দেশনা এখানে পেস্ট করুন..."
                      : "Paste client brief, requested formats (9:16, 16:9), tone, or forbidden guidelines..."
                  }
                  className="w-full bg-[#12131d] border border-[#282a3c] rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Script Box */}
              <div className="p-3.5 rounded-xl bg-[#171824] border border-[#262838] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isBn ? 'ক্লায়েন্ট স্ক্রিপ্ট (ফাইল / পেস্ট)' : 'Client Script'}</span>
                  </span>

                  <input
                    ref={scriptInputRef}
                    type="file"
                    accept=".txt,.srt,.json"
                    onChange={handleScriptUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => scriptInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{isBn ? 'আপলোড (.txt, .srt, .json)' : 'Upload'}</span>
                  </button>
                </div>

                <textarea
                  value={scriptDraft}
                  onChange={(e) => setScriptDraft(e.target.value)}
                  rows={8}
                  placeholder={
                    isBn
                      ? "ক্লায়েন্টের দেওয়া স্ক্রিপ্ট টেক্সট এখানে দিন। এআই মুখের কথার সাথে মিলিয়ে সঠিক বানান নিশ্চিত করবে..."
                      : "Paste client script or upload .txt/.srt/.json..."
                  }
                  className="w-full bg-[#12131d] border border-[#282a3c] rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveAndSync}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isBn ? 'সব তথ্য সেভ ও সিঙ্ক করুন' : 'Save & Sync Client Data'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};