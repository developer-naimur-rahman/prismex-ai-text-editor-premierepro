export type AppLanguage = 'en' | 'bn';

export const translations = {
  en: {
    // Tabs
    tabTranscript: 'Text Panel',
    tabDashboard: 'Dashboard',
    tabMagicCut: 'Magic Cut',
    tabReviewQueue: 'Review Queue',
    tabTakes: 'Takes',
    tabSilence: 'Silence',
    tabProviders: 'AI & API',
    tabProfiles: 'Profiles',
    tabSettings: 'Settings',
    tabHistory: 'History',

    // Status
    engineReady: 'Engine Ready',
    engineOffline: 'Daemon Offline',
    refresh: 'Refresh',

    // Text Panel
    textPanelTitle: 'Text Panel — Speech to Text',
    textPanelSubtitle: 'First transcribe your sequence audio, then edit text, run AI, export SRT/TXT, or Auto Cut.',
    activeSequence: 'ACTIVE SEQUENCE',
    noSequence: 'No sequence open in Premiere Pro',
    step1Transcribe: 'Step 1: Transcribe Sequence',
    step1Desc: 'Generates word-level transcript locally via Apple Silicon MLX-Whisper, plus detects silences, fillers & repeated takes.',
    transcribeBtn: 'Transcribe Sequence (Speech-to-Text)',
    transcribingBtn: 'Transcribing Sequence...',
    orJump: 'OR JUMP DIRECTLY TO OTHER OPTIONS',
    oneClickAutoCut: '1-Click Magic Auto Cut',
    silenceCut: 'Silence Cut',
    reTranscribe: 'Re-Transcribe',
    aiAssistant: 'AI Assistant',
    autoCut: 'Auto Cut',
    review: 'Review',
    exportLabel: 'Export:',
    cutSilences: 'Cut Silence(s)',
    searchPlaceholder: 'Search transcript...',
    fillers: 'Fillers',
    pauses: 'Pauses',
    deleteFromTimeline: 'Delete from Timeline',
    clear: 'Clear',
    askAiPlaceholder: 'Ask AI about this transcript (e.g., summarize, find fluff)...',
    askAiBtn: 'Ask AI',
    thinking: 'Thinking...',
    setupAiKey: 'Setup AI API Key',

    // Review Queue
    reviewQueueTitle: 'Review Queue',
    approveAll: 'Approve All',
    rejectAll: 'Reject All',
    approveCut: 'Approve Cut',
    keepInVideo: 'Keep in Video',
    seek: 'Seek',
    applyApproved: 'Apply {n} Approved Cuts to Timeline',
    applyingCuts: 'Applying Cuts to Timeline...',

    // Silence
    silenceTitle: 'Silence & Pause Detection',
    scanSilences: 'Scan Silences',
    cutSilencesNow: 'Cut {n} Silence(s) Now',
    scanAndCutSilences: 'Scan & Cut Silences',

    // Settings
    settingsTitle: 'System & Engine Settings',
    appLanguage: 'App Language / অ্যাপের ভাষা',
    appLanguageDesc: 'Switch interface language between English and Bangla (বাংলা).',
    aiApiKeys: 'AI Providers & API Keys',
    aiApiKeysDesc: 'Configure Google Gemini, Groq, OpenRouter, or Hugging Face free-tier API keys.',
    openAiProviders: 'Configure AI API Keys',
    freeOnlyGuard: 'Free-Only Protection Guard',
    freeOnlyDesc: 'Strictly blocks paid endpoints without explicit user consent.',
    nonDestructive: 'Non-Destructive Cloning',
    nonDestructiveDesc: 'Always clone sequence before executing timeline cuts.',
    hardwareAccel: 'Apple Silicon Hardware Acceleration',
    hardwareAccelDesc: 'Use MLX Metal GPU & Neural Engine with dynamic unloading.'
  },
  bn: {
    // Tabs
    tabTranscript: 'টেক্সট প্যানেল',
    tabDashboard: 'ড্যাশবোর্ড',
    tabMagicCut: 'ম্যাজিক কাট',
    tabReviewQueue: 'রিভিউ কিউ',
    tabTakes: 'টেকস',
    tabSilence: 'সাইলেন্স',
    tabProviders: 'AI ও API',
    tabProfiles: 'প্রোফাইল',
    tabSettings: 'সেটিংস',
    tabHistory: 'হিস্ট্রি',

    // Status
    engineReady: 'ইঞ্জিন চালু আছে',
    engineOffline: 'ইঞ্জিন অফলাইন',
    refresh: 'রিফ্রেশ',

    // Text Panel
    textPanelTitle: 'টেক্সট প্যানেল — স্পিচ টু টেক্সট',
    textPanelSubtitle: 'প্রথমে সিকোয়েন্স ট্রান্সক্রাইব করুন, তারপর টেক্সট এডিট, AI সামারি, SRT/TXT এক্সপোর্ট বা অটো কাট করুন।',
    activeSequence: 'বর্তমান সিকোয়েন্স',
    noSequence: 'Premiere Pro-তে কোনো সিকোয়েন্স ওপেন নেই',
    step1Transcribe: 'ধাপ ১: সিকোয়েন্স ট্রান্সক্রাইব করুন',
    step1Desc: 'Apple Silicon MLX-Whisper দিয়ে ওয়ার্ড-লেভেল ট্রান্সক্রিপ্ট তৈরি করে এবং সাইলেন্স, ফিলার ও রিপিটেড টেক শনাক্ত করে।',
    transcribeBtn: 'সিকোয়েন্স ট্রান্সক্রাইব করুন (Speech-to-Text)',
    transcribingBtn: 'ট্রান্সক্রাইব হচ্ছে...',
    orJump: 'অথবা সরাসরি অন্য অপশনে যান',
    oneClickAutoCut: '১-ক্লিক ম্যাজিক অটো কাট',
    silenceCut: 'সাইলেন্স কাট',
    reTranscribe: 'আবার ট্রান্সক্রাইব',
    aiAssistant: 'AI অ্যাসিস্ট্যান্ট',
    autoCut: 'অটো কাট',
    review: 'রিভিউ',
    exportLabel: 'এক্সপোর্ট:',
    cutSilences: 'সাইলেন্স কাটুন',
    searchPlaceholder: 'ট্রান্সক্রিপ্ট খুঁজুন...',
    fillers: 'ফিলার',
    pauses: 'বিরতি/পজ',
    deleteFromTimeline: 'টাইমলাইন থেকে ডিলিট করুন',
    clear: 'বাতিল',
    askAiPlaceholder: 'ট্রান্সক্রিপ্ট সম্পর্কে AI-কে জিজ্ঞাসা করুন (যেমন: সামারি, অপ্রয়োজনীয় অংশ)...',
    askAiBtn: 'AI-কে বলুন',
    thinking: 'AI ভাবছে...',
    setupAiKey: 'AI API Key সেট করুন',

    // Review Queue
    reviewQueueTitle: 'রিভিউ কিউ',
    approveAll: 'সব অ্যাপ্রুভ করুন',
    rejectAll: 'সব বাতিল করুন',
    approveCut: 'কাট অ্যাপ্রুভ করুন',
    keepInVideo: 'ভিডিওতে রাখুন',
    seek: 'সেখানে যান',
    applyApproved: 'টাইমলাইনে {n} টি অ্যাপ্রুভড কাট প্রয়োগ করুন',
    applyingCuts: 'টাইমলাইনে কাট হচ্ছে...',

    // Silence
    silenceTitle: 'সাইলেন্স ও পজ ডিটেকশন',
    scanSilences: 'সাইলেন্স স্ক্যান করুন',
    cutSilencesNow: '{n} টি সাইলেন্স এখনই কাটুন',
    scanAndCutSilences: 'স্ক্যান ও সাইলেন্স কাটুন',

    // Settings
    settingsTitle: 'সিস্টেম ও ইঞ্জিন সেটিংস',
    appLanguage: 'অ্যাপের ভাষা / App Language',
    appLanguageDesc: 'অ্যাপের ভাষা ইংরেজি অথবা বাংলায় পরিবর্তন করুন।',
    aiApiKeys: 'AI প্রোভাইডার ও API Key',
    aiApiKeysDesc: 'Google Gemini, Groq, OpenRouter বা Hugging Face API Key সেট করুন।',
    openAiProviders: 'AI API Key সেটআপ করুন',
    freeOnlyGuard: 'ফ্রি-অনলি প্রোটেকশন গার্ড',
    freeOnlyDesc: 'অনুমতি ছাড়া কোনো পেইড AI সার্ভিস ব্যবহার হতে দেবে না।',
    nonDestructive: 'নন-ডেস্ট্রাক্টিভ ক্লোনিং',
    nonDestructiveDesc: 'কাট করার আগে মূল সিকোয়েন্সের একটি কপি তৈরি করে নেবে।',
    hardwareAccel: 'Apple Silicon হার্ডওয়্যার অ্যাক্সেলারেশন',
    hardwareAccelDesc: 'MLX Metal GPU ও Neural Engine ব্যবহার করে দ্রুত প্রসেস করবে।'
  }
} as const;
