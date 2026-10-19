import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Brain,
  MessageCircle,
  FileText,
  Users,
  Zap,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Award,
  Layers,
  Lock,
  Mic,
  Eye,
  EyeOff,
  Briefcase,
  Play,
  RotateCw,
  Search,
  Sliders,
  IndianRupee,
  HeartHandshake,
  LayoutDashboard,
  Sun,
  Moon,
  Star,
  Activity,
  Check,
  Send,
  Building2,
  HelpCircle,
  FileCheck,
  Globe,
  Bell,
  CheckSquare,
  Square,
  BadgeCheck,
  Calendar,
  Share2,
  Menu,
  X,
  Volume2,
  Cpu
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import LandingBackgroundAnimation from '../components/landing/LandingBackgroundAnimation';

// ── Head-to-Head Comparison: Traditional Legacy ATS vs hireX by SNAB ──
const COMPARISON_ROWS = [
  {
    feature: 'Annual Cost & Billing Currency',
    traditional: '₹12,00,000 – ₹28,00,000 / year ($15k–$35k USD). Heavy forex conversion fees, USD invoicing, and no native GST invoice.',
    hirex: 'Native Indian Rupee (₹) pricing. Transparent plans starting at ₹1,999/mo, 100% GST compliant invoicing with instant UPI / NetBanking.',
    advantage: 'Up to 85% cost reduction • Native INR & GST',
  },
  {
    feature: 'Candidate Outreach & Open Rate',
    traditional: 'Email-only automated drip campaigns. In India, candidates rarely check personal emails (10%–14% response rate).',
    hirex: 'Integrated WhatsApp Cloud Automation + Email. Dispatches 1-click test links & invites directly on WhatsApp (92%+ open rate).',
    advantage: '8x higher candidate response in India',
  },
  {
    feature: 'High-Volume Resume Screening',
    traditional: 'Keyword-based filters that reject qualified candidates over minor formatting; 18–25 hours wasted manually reading CVs.',
    hirex: 'AWS Bedrock Claude 3.5 Sonnet semantic intelligence. Evaluates true tech skills, projects, and domain fit in < 3 seconds.',
    advantage: '3.2 sec/resume • 98.4% screening accuracy',
  },
  {
    feature: 'First-Round Phone Screening',
    traditional: 'Manual 30-min recruiter phone calls. Constant calendar rescheduling, candidate no-shows, and recruiter burnout.',
    hirex: '24/7 Autonomous AI Voice Interviewer conducts conversational phone & browser screens with adaptive follow-up questions.',
    advantage: 'Zero recruiter hours spent on level-1 screens',
  },
  {
    feature: 'Notice Period & Ghosting Protection',
    traditional: 'Zero engagement during 60–90 day Indian notice periods; over 40% of shortlisted candidates drop out before joining.',
    hirex: 'Automated WhatsApp touchpoints, milestone check-ins, and proactive status updates keep Indian candidates warm and engaged.',
    advantage: 'Cuts offer dropouts by over 60%',
  },
  {
    feature: 'Diversity & Blind Hiring (Unconscious Bias)',
    traditional: 'No built-in redaction; recruiters see names, colleges, gender, and photos, triggering subconscious bias.',
    hirex: '1-Click Resume Masking (Morph Resume) redacts all PII (names, contact, gender, photo) for 100% merit-based objective shortlisting.',
    advantage: '100% objective merit-first evaluation',
  },
  {
    feature: 'Technical & Skill Assessments',
    traditional: 'Requires separate expensive 3rd-party subscriptions (HackerRank, Mercer Mettl) with fragmented logins.',
    hirex: 'Native proctored coding assessments, customized MCQs, and automated scoring directly inside your candidate pipeline.',
    advantage: 'All-in-one unified dashboard',
  },
  {
    feature: 'Time-to-Hire in India',
    traditional: '35 to 48 days average from job opening to accepted offer letter.',
    hirex: '4 to 7 days average time-to-hire with autonomous resume-to-interview pipeline.',
    advantage: '5.2x faster hiring velocity',
  },
];

// ── Interactive Visual Feature Showcase Tabs ──
const SHOWCASE_TABS = [
  {
    id: 'voice',
    label: 'AI Voice Screening',
    icon: Mic,
    title: 'Autonomous AI Voice & Conversational Phone Interviews',
    subtitle: 'Human-like conversational interviewer that screens applicants 24/7 with zero recruiter scheduling overhead.',
    image: '/assets/landing/ai-voice-interview.jpg',
    tag: '9.4/10 Proficiency Rating',
    metrics: [
      { label: 'Screening Time', val: 'Instant 24/7' },
      { label: 'Transcription', val: 'Word-for-Word' },
      { label: 'Evaluation', val: 'Automated 1-10' },
    ],
    highlights: [
      'Asks contextual follow-up questions when candidates give brief answers',
      'Evaluates technical depth, problem-solving, and communication clarity',
      'Provides full audio recording and transcript in recruiter dashboard',
    ],
  },
  {
    id: 'resume',
    label: 'Resume Intelligence',
    icon: Brain,
    title: 'AWS Bedrock Claude 3.5 Sonnet CV Analysis in 3 Seconds',
    subtitle: 'Evaluates real hands-on engineering experience and tech stacks beyond superficial keyword matching.',
    image: '/assets/landing/ai-resume-intelligence.jpg',
    tag: 'Claude 3.5 Sonnet Engine',
    metrics: [
      { label: 'Parse Speed', val: '3.2 Seconds' },
      { label: 'Accuracy', val: '98.4% Match' },
      { label: 'Batch Upload', val: '100+ Resumes' },
    ],
    highlights: [
      'Extracts tech stack, years of experience, and project impact automatically',
      'Generates 0–100% fit score with clear skill strength and gap breakdown',
      'High-speed Resume Dump ingests hundreds of files via secure AWS S3 URLs',
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Automation',
    icon: MessageCircle,
    title: 'Instant WhatsApp Candidate Outreach & Engagement',
    subtitle: 'Connect with Indian candidates where they actually respond. Send 1-click test links and reminders straight to WhatsApp.',
    image: '/assets/landing/whatsapp-automation.jpg',
    tag: '92% Open Rate in India',
    metrics: [
      { label: 'Response Time', val: '< 15 Mins' },
      { label: 'Open Rate', val: '92.4%' },
      { label: 'Drop-off', val: 'Reduced 75%' },
    ],
    highlights: [
      '1-Click QR connection directly from your recruiter dashboard',
      'Automated personalized interview links with zero login friction',
      'Proactive deadline reminders that stop candidate ghosting in India',
    ],
  },
];

// ── 6 Core Platform Features ──
const CORE_FEATURES = [
  {
    id: 'ai-voice-interview',
    icon: Mic,
    badge: '24/7 Screening',
    title: 'Autonomous AI Voice Interviews',
    description: 'Human-like conversational screening rounds that evaluate technical depth, problem-solving, and communication clarity with zero recruiter scheduling overhead.',
    points: [
      'Adaptive probing follow-up questions',
      'Instant word-for-word audio transcript',
      'Objective 1–10 scoring & competency breakdown',
    ],
  },
  {
    id: 'resume-intelligence',
    icon: Brain,
    badge: 'Claude 3.5 Sonnet',
    title: 'Deep Semantic Resume Intelligence',
    description: 'Evaluate candidates on genuine engineering experience, stack depth, and actual achievements in under 3.2 seconds—far beyond naive keyword matching.',
    points: [
      'Semantic CV parsing in 3.2 seconds',
      'Instant 0–100% role compatibility match',
      'Actionable strengths & skill gap analysis',
    ],
  },
  {
    id: 'whatsapp-automation',
    icon: MessageCircle,
    badge: '92% Open Rate',
    title: 'Automated WhatsApp Pipelines',
    description: 'Reach Indian candidates where they actually respond. Send 1-click test links, automated updates, and proactive reminders directly over WhatsApp.',
    points: [
      '1-click QR connection from recruiter dashboard',
      'Direct WhatsApp test invites & test links',
      'Reduces candidate ghosting & notice-period dropouts',
    ],
  },
  {
    id: 'morph-resume',
    icon: EyeOff,
    badge: 'Blind Hiring',
    title: 'Morph Resume (PII Masking)',
    description: 'Eliminate unconscious bias by redacting candidate names, contact details, photos, and demographic markers with 1 click for pure merit-first screening.',
    points: [
      '1-click automatic PII & contact redaction',
      '100% merit-based objective shortlisting',
      'Export shareable anonymized candidate profiles',
    ],
  },
  {
    id: 'bulk-resume-dump',
    icon: Zap,
    badge: 'High Volume',
    title: 'Bulk S3 Resume Ingestion',
    description: 'Ingest dozens or hundreds of candidate resumes at once via secure AWS S3 storage with automatic text extraction, deduplication, and parsing.',
    points: [
      'Batch upload 100+ PDFs/DOCX simultaneously',
      'Automated candidate profile extraction',
      'Instant multi-role match score evaluation',
    ],
  },
  {
    id: 'proctored-assessments',
    icon: ShieldCheck,
    badge: 'Proctored Suite',
    title: 'Native Assessments & Coding Tests',
    description: 'Run proctored coding assessments, customized technical MCQs, and anti-cheating monitoring seamlessly inside your hiring pipeline.',
    points: [
      'Custom role-based MCQs & code evaluations',
      'Anti-cheating tab-switch detection & logs',
      'Unified candidate scorecard and analytics',
    ],
  },
];

// ── FAQs ──
const FAQS = [
  {
    q: 'How does hireX by SNAB work specifically for the Indian hiring market?',
    a: 'hireX was built specifically to solve the unique challenges of Indian recruitment: massive application volumes (often 500+ CVs per open role), low email open rates, and long notice period dropouts. By pairing AWS Bedrock Claude 3.5 resume intelligence with direct WhatsApp automation and 24/7 AI voice screening, Indian recruiters can filter thousands of applicants into a qualified shortlist in hours instead of weeks.',
  },
  {
    q: 'Why is WhatsApp automation so important for hiring in India?',
    a: 'In India, working professionals and freshers rarely monitor personal email during working hours, and emails often end up in the Promotions tab. WhatsApp messages boast an open rate of over 92% in India, with most candidates responding within 15 minutes. hireX sends automated interview links, reminders, and status updates via WhatsApp, cutting response delays to virtually zero.',
  },
  {
    q: 'Are payments and invoicing in Indian Rupees (₹) with GST?',
    a: 'Yes! Unlike legacy US-based ATS software that charges in USD with credit-card foreign transaction fees and reverse-charge taxes, hireX offers 100% native Indian Rupee (₹) pricing with GST-compliant B2B tax invoices, supporting UPI, NetBanking, NEFT/RTGS, and Indian corporate cards.',
  },
  {
    q: 'How does the Autonomous AI Voice Interviewer work?',
    a: 'When an applicant applies or is shortlisted, hireX can automatically send them a personalized voice interview link. The candidate completes a conversational, spoken interview on their phone or laptop. The AI asks role-specific technical and behavioral questions, dynamically asks follow-up questions to probe deeper, and generates a word-for-word transcript with an objective rating out of 10 for your review.',
  },
  {
    q: 'What is Resume Masking (Morph Resume) and how does it help?',
    a: 'Morph Resume allows you to anonymize candidate resumes with 1 click. It redacts candidate names, gender, phone numbers, email addresses, and photos, allowing your hiring managers to evaluate talent strictly on technical competency, work experience, and achievements rather than pedigree or demographics.',
  },
  {
    q: 'Can I upload our existing database of resumes in bulk?',
    a: 'Absolutely. Using our Resume Dump feature, you can drag and drop dozens or hundreds of PDF and DOCX files at once. hireX securely uploads them to AWS S3, extracts structured profile details, and automatically evaluates them against all your active job postings.',
  },
];

export const LandingPage: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  // Mobile Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Showcase Tab
  const [activeTab, setActiveTab] = useState<'voice' | 'resume' | 'whatsapp'>('voice');

  // ROI Calculator State in INR
  const [openRoles, setOpenRoles] = useState<number>(6);
  const [applicantsPerRole, setApplicantsPerRole] = useState<number>(200);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Calculated ROI Metrics in INR (₹)
  const totalApplicants = openRoles * applicantsPerRole;
  const hoursSaved = Math.round(totalApplicants * 0.35); // ~21 mins per candidate
  const hourlyRateINR = 650; // Average Indian blended recruiter cost per hour (₹650/hr)
  const costSavedINR = hoursSaved * hourlyRateINR;
  const daysToHire = Math.max(4, Math.round(38 - openRoles * 1.4));

  // Format currency in Indian Lakhs/Thousands
  const formattedSavedINR = useMemo(() => {
    if (costSavedINR >= 100000) {
      return `₹${(costSavedINR / 100000).toFixed(2)} Lakhs`;
    }
    return `₹${costSavedINR.toLocaleString('en-IN')}`;
  }, [costSavedINR]);

  const dashboardPath = userProfile?.role === 'admin' ? '/admin' : '/recruiter/jobs';
  const currentTab = SHOWCASE_TABS.find((t) => t.id === activeTab) || SHOWCASE_TABS[0];

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#000000] text-gray-900 dark:text-[#ededed] font-sans selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300 transition-colors duration-200">
      
      {/* ── World-Class Dynamic Background Animation ── */}
      <LandingBackgroundAnimation isDark={isDark} />

      {/* ── 1. Top Navbar (Clean, High-End SaaS Header) ── */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md border-b border-gray-200/90 dark:border-white/[0.09] px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <Logo className="h-8 w-auto object-contain" isDark={isDark} />
          </Link>

          {/* Clean Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-[#a1a1aa]">
            <a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Features
            </a>
            <a href="#showcase" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              AI Capabilities
            </a>
            <a href="#demo" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Platform Demo
            </a>
            <a href="#comparison" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              hireX vs ATS
            </a>
            <a href="#calculator" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              ROI Calculator
            </a>
            <a href="#faq" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              FAQ
            </a>
            <Link to="/active-jobs" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Job Board
            </Link>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="size-8.5 rounded-lg border border-gray-200 dark:border-white/[0.12] bg-gray-50/80 dark:bg-white/[0.04] flex items-center justify-center text-gray-700 dark:text-[#d4d4d4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-gray-700" />}
            </button>

            {user ? (
              <Link
                to={dashboardPath}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-gray-900 dark:bg-white px-4 text-xs font-semibold text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-xs"
              >
                <LayoutDashboard className="size-3.5" />
                <span>Go to Dashboard</span>
              </Link>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-medium text-gray-700 dark:text-[#d4d4d4] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white px-4 text-xs font-semibold text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-xs"
                >
                  <span>Start Free</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden size-9 rounded-lg border border-gray-200 dark:border-white/[0.12] bg-gray-50 dark:bg-white/[0.04] flex items-center justify-center text-gray-700 dark:text-[#d4d4d4]"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-white/[0.08] py-4 px-3 space-y-1.5 bg-white dark:bg-[#000000]">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Features
            </a>
            <a
              href="#showcase"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              AI Capabilities
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Platform Demo
            </a>
            <a
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Comparison
            </a>
            <a
              href="#calculator"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              ROI Calculator
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              FAQ
            </a>
            <Link
              to="/active-jobs"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Job Board
            </Link>
            {!user && (
              <div className="pt-3 border-t border-gray-200 dark:border-white/10 flex flex-col gap-2">
                <Link
                  to="/auth"
                  className="w-full text-center py-2 text-xs font-medium text-gray-700 dark:text-[#d4d4d4] hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-md"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth"
                  className="w-full text-center py-2.5 text-xs font-semibold text-white dark:text-black bg-gray-900 dark:bg-white rounded-md shadow-xs"
                >
                  Start Free
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative z-10 pt-16 pb-16 sm:pt-24 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          
          {/* Subtle Announcement Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-medium mb-6">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI-Powered Autonomous ATS & Recruitment Engine</span>
            <span className="text-gray-300 dark:text-white/20">•</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">hireX by SNAB</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.12]">
            Hire the Top 1% Talent with{' '}
            <span className="text-blue-600 dark:text-blue-400">
              Autonomous AI & WhatsApp Automation.
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-base text-gray-600 dark:text-[#8f8f8f] max-w-2xl mx-auto leading-relaxed">
            Engineered for high-volume recruitment. Screen 500+ resumes in seconds with AWS Bedrock Claude 3.5, conduct 24/7 AI voice phone interviews, and engage candidates directly on WhatsApp with 92% open rates.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 dark:bg-white px-7 text-xs font-semibold text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-sm hover:scale-[1.01]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <a
              href="#showcase"
              className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-white/15 bg-white dark:bg-white/[0.04] px-6 text-xs font-semibold text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all"
            >
              <Play className="size-3 text-blue-600 dark:text-blue-400" />
              <span>Explore AI Visual Showcase</span>
            </a>
          </div>

        </div>

        {/* ── 3. Visual AI Feature Showcase (High-Tech Generated Graphics) ── */}
        <div id="showcase" className="mt-14 relative rounded-2xl border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#07070a] shadow-xl overflow-hidden transition-colors">
          
          {/* Segmented Showcase Navigation Tabs */}
          <div className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50/70 dark:bg-white/[0.02] p-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
            {SHOWCASE_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-xs border border-gray-200/80 dark:border-white/10'
                      : 'text-gray-500 hover:text-gray-900 dark:text-[#8f8f8f] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <TabIcon className={`size-3.5 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Feature Showcase View */}
          <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Content Breakdown */}
            <div className="lg:col-span-5 space-y-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Sparkles className="size-3" />
                {currentTab.tag}
              </span>

              <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-snug">
                {currentTab.title}
              </h3>

              <p className="text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f] leading-relaxed">
                {currentTab.subtitle}
              </p>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {currentTab.metrics.map((m, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-gray-200/80 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] text-center">
                    <span className="text-[10px] uppercase font-mono text-gray-400 dark:text-[#666] block">{m.label}</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-0.5 block">{m.val}</span>
                  </div>
                ))}
              </div>

              {/* Bullet Points */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                {currentTab.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#a1a1aa]">
                    <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Generated Image Graphic Showcase */}
            <div className="lg:col-span-7">
              <div className="relative rounded-xl overflow-hidden border border-gray-200/80 dark:border-white/10 shadow-2xl group">
                <img
                  src={currentTab.image}
                  alt={currentTab.title}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white/90 font-mono">
                  <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live System Visualizer
                  </span>
                  <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-[11px]">
                    AWS Bedrock Engine
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* ── 4. Interactive Live Recruiter Dashboard Replica ── */}
        <div id="demo" className="mt-14 rounded-xl border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000000] shadow-xl overflow-hidden transition-colors">
          
          {/* Top Window Bar */}
          <div className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.02] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-red-400" />
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span className="size-2.5 rounded-full bg-green-400" />
              <span className="ml-2 font-mono text-[11px] text-gray-500 dark:text-[#8f8f8f] font-semibold uppercase tracking-wider">
                RECRUITER DASHBOARD • hireX by SNAB
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp Connected • Active</span>
            </div>
          </div>

          {/* Dashboard Canvas */}
          <div className="p-4 sm:p-6 lg:p-7">
            
            {/* Header Greeting */}
            <div className="mb-6">
              <p className="geist-label uppercase text-[10px] text-gray-500 dark:text-[#8f8f8f] font-semibold tracking-wider font-mono">
                RECRUITER OVERVIEW
              </p>
              <h2 className="geist-page-title mt-0.5 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Welcome back, snab
              </h2>
            </div>

            {/* Segmented 5-KPI Metric Bar */}
            <div className="grid grid-cols-2 divide-y divide-gray-200 dark:divide-white/[0.11] sm:grid-cols-5 sm:divide-y-0 sm:divide-x border border-gray-200 dark:border-white/[0.11] rounded-lg bg-white dark:bg-[#050505] overflow-hidden mb-6">
              
              <div className="p-3.5">
                <p className="geist-label uppercase text-[10px] text-gray-500 dark:text-[#8f8f8f] font-semibold tracking-wider font-mono">
                  All Job Postings
                </p>
                <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold text-xl">1</div>
                <p className="geist-small mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">1 active</p>
              </div>

              <div className="p-3.5">
                <p className="geist-label uppercase text-[10px] text-gray-500 dark:text-[#8f8f8f] font-semibold tracking-wider font-mono">
                  Responses
                </p>
                <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold text-xl">14</div>
                <p className="geist-small mt-0.5 text-gray-500 dark:text-[#8f8f8f]">14 reports</p>
              </div>

              <div className="p-3.5">
                <p className="geist-label uppercase text-[10px] text-gray-500 dark:text-[#8f8f8f] font-semibold tracking-wider font-mono">
                  Pending
                </p>
                <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold text-xl">2</div>
                <p className="geist-small mt-0.5 text-gray-500 dark:text-[#8f8f8f]">awaiting review</p>
              </div>

              <div className="p-3.5">
                <p className="geist-label uppercase text-[10px] text-gray-500 dark:text-[#8f8f8f] font-semibold tracking-wider font-mono">
                  Assessments
                </p>
                <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold text-xl">3</div>
                <p className="geist-small mt-0.5 text-gray-500 dark:text-[#8f8f8f]">screening tests</p>
              </div>

              <div className="p-3.5">
                <p className="geist-label uppercase text-[10px] text-gray-500 dark:text-[#8f8f8f] font-semibold tracking-wider font-mono">
                  Candidates
                </p>
                <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold text-xl">28</div>
                <p className="geist-small mt-0.5 text-gray-500 dark:text-[#8f8f8f]">28 invited</p>
              </div>

            </div>

            {/* Quick Actions Row & Activity Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              
              {/* Left 2 Cols: Pipeline Activity Simulation */}
              <div className="lg:col-span-2 p-5 rounded-lg border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                      Candidate Hiring Pipeline
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-[#8f8f8f]">
                      Real-time candidate stages with Claude 3.5 Sonnet fit scoring
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 rounded-md bg-gray-100 dark:bg-white/[0.04] text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-white dark:bg-white/10 text-gray-900 dark:text-white font-semibold shadow-xs">
                      Weekly
                    </span>
                    <span className="px-2 py-0.5 text-gray-500">Monthly</span>
                  </div>
                </div>

                {/* Candidate Pipeline Rows */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                        AP
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">Aarav Patel</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                            95% Fit
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-[#8f8f8f]">
                          Senior React & Node Engineer • Bengaluru, KA • ₹28 LPA Current
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
                        Voice Screen 9.4/10
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black">
                        Shortlisted
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#08080a] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                        PS
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">Pooja Sharma [Blind Masked]</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300">
                            91% Fit
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-[#8f8f8f]">
                          Lead DevOps & Cloud • Pune, MH • PII Redacted for Bias-Free Review
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <MessageCircle className="size-2.5" />
                        WhatsApp Invite Sent
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                  Quick Actions
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-[#8f8f8f] -mt-2 mb-3">
                  Start a new hiring workflow from one place.
                </p>

                <div className="p-3.5 rounded-lg border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] hover:border-gray-300 dark:hover:border-white/20 transition-colors flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded bg-gray-900 dark:bg-white text-white dark:text-black flex items-center justify-center">
                      <Briefcase className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">Create Job</h4>
                      <p className="text-[10px] text-gray-500 dark:text-[#8f8f8f]">Questions and invites.</p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-gray-400" />
                </div>

                <div className="p-3.5 rounded-lg border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] hover:border-gray-300 dark:hover:border-white/20 transition-colors flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                      <FileCheck className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">Create Assessment</h4>
                      <p className="text-[10px] text-gray-500 dark:text-[#8f8f8f]">Screening test setup.</p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-gray-400" />
                </div>

                <div className="p-3.5 rounded-lg border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] hover:border-gray-300 dark:hover:border-white/20 transition-colors flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">Manage Interviews</h4>
                      <p className="text-[10px] text-gray-500 dark:text-[#8f8f8f]">Workflows and reports.</p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-gray-400" />
                </div>

              </div>

            </div>

            {/* Existing Job Posts Table */}
            <div className="border border-gray-200 dark:border-white/[0.11] rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.11] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Existing Job Posts</h4>
                  <p className="text-[10px] text-gray-500 dark:text-[#8f8f8f]">Interview-created roles and synced job posts appear automatically.</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04]">
                  Active in India
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000] text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">JOB TITLE</th>
                      <th className="py-2.5 px-4 font-semibold">SOURCE</th>
                      <th className="py-2.5 px-4 font-semibold">POSTED DATE</th>
                      <th className="py-2.5 px-4 font-semibold">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    <tr>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">Senior Frontend Engineer</div>
                        <div className="text-[11px] text-gray-500 dark:text-[#8f8f8f]">Bengaluru, India • Design / Engineering / R&D</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-medium">
                          Interview
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-[#8f8f8f] font-mono text-[11px]">
                        17 Oct 2026
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold">
                          Active
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. Side-by-Side Comparison: Traditional ATS vs hireX by SNAB ── */}
      <section id="comparison" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <p className="geist-label uppercase text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold tracking-widest mb-1">
            INDIA MARKET BENCHMARK
          </p>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Legacy ATS vs. hireX by SNAB
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f]">
            Why Indian talent leaders at startups and enterprises are moving away from foreign legacy tools to hireX.
          </p>
        </div>

        <div className="border border-gray-200 dark:border-white/[0.11] rounded-xl bg-white dark:bg-[#050505] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-1/4">
                    Capability
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider w-3/8 bg-red-500/[0.02]">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="size-3.5" />
                      <span>Traditional ATS (Greenhouse, Lever, etc.)</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider w-3/8 bg-emerald-500/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" />
                      <span>hireX by SNAB</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-gray-900 dark:text-white align-top">
                      {row.feature}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-gray-600 dark:text-[#8f8f8f] align-top bg-red-500/[0.01]">
                      {row.traditional}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 align-top bg-emerald-500/[0.02]">
                      <div className="text-gray-900 dark:text-white font-medium">
                        {row.hirex}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                        {row.advantage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 6. Interactive ROI & Savings Calculator in Indian Rupees (₹) ── */}
      <section id="calculator" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="border border-gray-200 dark:border-white/[0.11] rounded-2xl bg-white dark:bg-[#050505] p-6 sm:p-10 shadow-sm">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="geist-label uppercase text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold tracking-widest mb-1">
              INDIAN RUPEE ROI ENGINE
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              Calculate Monthly Savings in Indian Rupees (₹)
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f]">
              See how much your Indian recruiting team saves in overhead, agency commission, and recruiter hours.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            {/* Controls */}
            <div className="space-y-6 p-5 rounded-xl border border-gray-200 dark:border-white/[0.11] bg-gray-50/60 dark:bg-white/[0.02]">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                  <span>MONTHLY OPEN ROLES IN INDIA</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{openRoles} Roles</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={openRoles}
                  onChange={(e) => setOpenRoles(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-gray-200 dark:bg-white/10 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
                  <span>1 Role</span>
                  <span>12 Roles</span>
                  <span>25 Roles</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                  <span>INDIAN APPLICANTS PER ROLE (LinkedIn, Naukri, Portal)</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{applicantsPerRole} Applicants</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="600"
                  step="25"
                  value={applicantsPerRole}
                  onChange={(e) => setApplicantsPerRole(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer h-2 bg-gray-200 dark:bg-white/10 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
                  <span>50 Applicants</span>
                  <span>300 Applicants</span>
                  <span>600 Applicants</span>
                </div>
              </div>

              <div className="p-3 rounded-md bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 text-[11px] text-gray-500 dark:text-[#8f8f8f] flex items-center gap-2">
                <IndianRupee className="size-4 text-emerald-600 shrink-0" />
                <span>Calculated at ₹650/hour blended Indian talent acquisition cost + agency fee mitigation.</span>
              </div>
            </div>

            {/* Calculations in ₹ */}
            <div className="grid grid-cols-2 gap-4">
              
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/[0.06] text-center">
                <span className="text-[10px] uppercase font-mono text-emerald-700 dark:text-emerald-300 font-bold tracking-wider">
                  Recruiter Hours Saved / Mo
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {hoursSaved} hrs
                </div>
                <p className="text-[10px] text-gray-500 dark:text-[#8f8f8f] mt-1">
                  Freeing up ~{Math.round(hoursSaved / 40)} full-time recruiters
                </p>
              </div>

              <div className="p-5 rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/[0.06] text-center">
                <span className="text-[10px] uppercase font-mono text-blue-700 dark:text-blue-300 font-bold tracking-wider">
                  Cost Saved Monthly (₹)
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 font-mono">
                  {formattedSavedINR}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-[#8f8f8f] mt-1">
                  Saved in agency fees & overtime
                </p>
              </div>

              <div className="col-span-2 p-4 rounded-xl border border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.02] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono text-gray-500 dark:text-[#8f8f8f] font-semibold">
                    Time-to-Hire in India
                  </span>
                  <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                    Reduced from <span className="line-through text-red-500">38 Days</span> to <span className="text-emerald-600 dark:text-emerald-400 font-mono font-extrabold">{daysToHire} Days</span>
                  </div>
                </div>
                <Link
                  to="/auth"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 dark:bg-emerald-500 px-3.5 text-xs font-semibold text-white dark:text-black hover:bg-emerald-700 dark:hover:bg-emerald-400 transition-all shrink-0"
                >
                  <span>Start Free</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── 7. Full Feature Suite Grid ── */}
      <section id="features" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <p className="geist-label uppercase text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold tracking-widest mb-1">
            BUILT FOR INDIAN VELOCITY
          </p>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Comprehensive Platform Features
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f]">
            Every capability designed to help Indian talent acquisition teams hire top-tier talent with speed, fairness, and precision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CORE_FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.id}
                className="p-5 rounded-xl border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] hover:border-gray-300 dark:hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="size-9 rounded-md bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white flex items-center justify-center">
                      <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-[#d4d4d4] border border-gray-200 dark:border-white/10">
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-[#8f8f8f] leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.06] space-y-1">
                  {feat.points.map((pt, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-[#d4d4d4]">
                      <Check className="size-3 text-emerald-500 shrink-0" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 8. FAQ Section ── */}
      <section id="faq" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center mb-10">
          <p className="geist-label uppercase text-[10px] font-mono text-gray-500 font-bold tracking-widest mb-1">
            COMMON QUESTIONS
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f]">
            Got questions about hiring in India with hireX? We have answers.
          </p>
        </div>

        <div className="space-y-2.5">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="border border-gray-200 dark:border-white/[0.11] rounded-lg bg-white dark:bg-[#050505] overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`size-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                    openFaq === idx ? 'rotate-180 text-emerald-500' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-gray-600 dark:text-[#8f8f8f] leading-relaxed border-t border-gray-100 dark:border-white/[0.05] pt-2.5">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 9. Bottom CTA Banner (In Platform Theme) ── */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="border border-gray-200 dark:border-white/[0.11] rounded-2xl bg-white dark:bg-[#050505] p-8 sm:p-12 text-center shadow-sm">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 mb-3">
            <Sparkles className="size-3" />
            START HIRING TODAY
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            Accelerate Your Recruitment Velocity with hireX
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f] max-w-xl mx-auto leading-relaxed">
            Join forward-thinking Indian recruiters cutting screening time by 80% while providing an exceptional candidate experience.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs mx-auto">
            <Link
              to="/auth"
              className="w-full sm:w-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-gray-900 dark:bg-white px-5 text-xs font-semibold text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-xs"
            >
              <span>Get Started Free</span>
              <ArrowRight className="size-3" />
            </Link>
            <Link
              to="/active-jobs"
              className="w-full sm:w-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gray-200 dark:border-white/10 px-4 text-xs font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-all"
            >
              <Briefcase className="size-3" />
              <span>Public Job Board</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 10. Footer (Platform Theme) ── */}
      <footer className="relative z-10 border-t border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000000] py-10 px-4 sm:px-6 lg:px-8 text-xs text-gray-500 dark:text-[#8f8f8f] transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
          
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-2.5">
              <Logo className="h-7 w-auto object-contain" isDark={isDark} />
            </Link>
            <p className="text-xs text-gray-500 dark:text-[#8f8f8f] max-w-sm leading-relaxed">
              SNAB hireX is an intelligent applicant tracking system (ATS) and autonomous recruitment platform tailored for the Indian hiring ecosystem. Powered by AWS Bedrock, Claude 3.5 Sonnet, and WhatsApp Cloud automation.
            </p>
            <p className="mt-3 text-[11px] font-mono text-gray-400">
              © {new Date().getFullYear()} SNAB Technologies Private Limited. All rights reserved.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-[10px] font-mono mb-2.5">Platform</h4>
            <ul className="space-y-1.5 text-xs">
              <li><a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">AI Features</a></li>
              <li><a href="#showcase" className="hover:text-gray-900 dark:hover:text-white transition-colors">Visual Showcase</a></li>
              <li><a href="#demo" className="hover:text-gray-900 dark:hover:text-white transition-colors">Recruiter Demo</a></li>
              <li><a href="#comparison" className="hover:text-gray-900 dark:hover:text-white transition-colors">Traditional ATS vs hireX</a></li>
              <li><a href="#calculator" className="hover:text-gray-900 dark:hover:text-white transition-colors">ROI Calculator (₹)</a></li>
              <li><Link to="/active-jobs" className="hover:text-gray-900 dark:hover:text-white transition-colors">Indian Job Openings</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-[10px] font-mono mb-2.5">Resources</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/blogs" className="hover:text-gray-900 dark:hover:text-white transition-colors">Recruiting Blogs</Link></li>
              <li><Link to="/career-hub" className="hover:text-gray-900 dark:hover:text-white transition-colors">Career Hub</Link></li>
              <li><Link to="/job-seeker-upload" className="hover:text-gray-900 dark:hover:text-white transition-colors">Upload Resume (India)</Link></li>
              <li><Link to="/status" className="hover:text-gray-900 dark:hover:text-white transition-colors">System Status</Link></li>
              <li><Link to="/contact" className="hover:text-gray-900 dark:hover:text-white transition-colors">Contact Support</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-[10px] font-mono mb-2.5">Trust & India Compliance</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/privacy-policy" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms of Service</Link></li>
              <li><span className="text-emerald-600 dark:text-emerald-400 font-mono">100% GST Invoicing</span></li>
              <li><span className="text-blue-600 dark:text-blue-400 font-mono">AWS Mumbai Region</span></li>
              <li><span className="text-gray-600 dark:text-gray-400 font-mono">UPI / NetBanking Ready</span></li>
            </ul>
          </div>

        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
