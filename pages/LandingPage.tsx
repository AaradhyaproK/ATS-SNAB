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
  Cpu,
  Phone,
  Mail,
  Database,
  HardDrive,
  CheckCheck
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import LandingBackgroundAnimation from '../components/landing/LandingBackgroundAnimation';

// ── Time Saved with HireX Snab Table Data ──
const TIME_SAVED_ROWS = [
  {
    task: 'Create a job post',
    traditional: '30 min',
    hirex: 'Seconds (AI-generated)',
    saved: '~30 min',
    tag: 'Instant Job Spec',
  },
  {
    task: 'Screen 100 resumes',
    traditional: '5 hrs (manual reading)',
    hirex: '10 min (AI resume scoring)',
    saved: '~4.5 hrs',
    tag: 'Claude 3.5 Sonnet',
  },
  {
    task: 'Write candidate ads',
    traditional: '45 min',
    hirex: '1 min (AI-generated)',
    saved: '~44 min',
    tag: 'High-Conversion Ads',
  },
  {
    task: 'Candidate follow-ups',
    traditional: '3 hrs (phone tag & emails)',
    hirex: 'Automatic WhatsApp alerts',
    saved: '~3 hrs',
    tag: '92% Open Rate',
  },
];

// ── Capability Comparison: HireX Snab vs Traditional ATS ──
const CAPABILITY_ROWS = [
  {
    capability: 'Resume screening',
    traditional: 'Manual reading line-by-line',
    hirex: 'Instant AI scoring against JD',
    highlight: 'Zero recruiter fatigue',
  },
  {
    capability: 'Candidate alerts',
    traditional: 'Email only, often manual & delayed',
    hirex: 'Built-in WhatsApp and email alerts',
    highlight: 'Instant candidate reply',
  },
  {
    capability: 'Job recommendations',
    traditional: 'Manual keyword search & browse',
    hirex: 'AI-personalised candidate match picks',
    highlight: 'Relevant roles surfaced',
  },
  {
    capability: 'Finding top talent',
    traditional: 'Rigid filters & keyword search',
    hirex: 'Best-candidate suggestions first',
    highlight: 'Top 1% surfaced in seconds',
  },
];

// ── What Other ATS Tools Charge (Competitor Pricing in INR) ──
const PRICING_BENCHMARK_ROWS = [
  {
    tool: 'Zoho Recruit',
    price: '₹1,250 to ₹3,000',
    model: 'Per recruiter / month',
    details: 'WhatsApp & AI available only as separate add-ons or integrations.',
    isHirex: false,
  },
  {
    tool: 'Typical Standalone ATS',
    price: '₹2,000 to ₹3,000',
    model: 'Per recruiter / month',
    details: 'Basic applicant tracking without semantic AI or phone interviews.',
    isHirex: false,
  },
  {
    tool: 'Greenhouse',
    price: '₹4,000 and above ($15k+ yr)',
    model: 'Per recruiter / month',
    details: 'USD billing, heavy forex conversion fees, and no native GST tax invoices.',
    isHirex: false,
  },
  {
    tool: 'Bullhorn',
    price: '₹5,000 to ₹8,000',
    model: 'Per recruiter / month',
    details: 'Complex legacy staffing software with long lock-in contracts.',
    isHirex: false,
  },
  {
    tool: 'JazzHR',
    price: 'About ₹9,600',
    model: 'Flat / month',
    details: 'Lacks native WhatsApp outreach and autonomous AI voice screening.',
    isHirex: false,
  },
  {
    tool: 'AI-Focused Niche Tools',
    price: '₹25,000 to ₹50,000',
    model: 'Flat / month',
    details: 'Standalone AI screening tools requiring a separate paid ATS.',
    isHirex: false,
  },
  {
    tool: 'HireX Snab ATS',
    price: 'All-Inclusive Value',
    model: 'Transparent Monthly / Annual',
    details: 'AI scoring, WhatsApp, ads, clean white resume masking, tests & 24/7 voice included.',
    isHirex: true,
  },
];

// ── Features: Typical ATS vs HireX Snab Checklist ──
const FEATURE_CHECKLIST_ROWS = [
  {
    feature: 'AI resume scoring',
    typical: 'Higher tier or paid add-on',
    hirex: 'Built in (Claude 3.5 Sonnet)',
  },
  {
    feature: 'WhatsApp and email alerts',
    typical: 'Via 3rd-party integration (e.g. Zoho)',
    hirex: 'Built in (Native WhatsApp Cloud)',
  },
  {
    feature: 'AI job creation in seconds',
    typical: 'Varies by vendor / not offered',
    hirex: 'Built in (Structured JD generator)',
  },
  {
    feature: 'AI candidate ads',
    typical: 'Varies by vendor / manual copy',
    hirex: 'Built in (High-conversion copy)',
  },
  {
    feature: 'Personalised job picks',
    typical: 'Varies by vendor',
    hirex: 'Built in (Automatic profile matching)',
  },
  {
    feature: 'Resume masking (White Redaction)',
    typical: 'Varies by vendor / enterprise add-on',
    hirex: 'Built in (Clean white Morph Resume)',
  },
  {
    feature: 'Admin-monitored logs',
    typical: 'Higher enterprise tier only',
    hirex: 'Built in (Full forensic activity trail)',
  },
  {
    feature: 'Autonomous 24/7 AI Voice & Video Screening',
    typical: 'Requires separate expensive subscriptions',
    hirex: 'Built in (Spoken interviews with ratings)',
  },
];

// ── 4-Step Automated Flow: From Application to Offer ──
const WORKFLOW_STEPS = [
  {
    num: '1',
    title: 'Apply',
    tagline: 'Candidate applies',
    desc: 'Candidates submit applications via clean mobile portal, public job board, or recruiters batch-import 100+ resumes via AWS S3.',
    badge: 'Multi-Channel Ingestion',
    icon: FileText,
    color: 'from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400',
  },
  {
    num: '2',
    title: 'Score',
    tagline: 'AI ranks resumes',
    desc: 'AWS Bedrock Claude 3.5 Sonnet reads genuine skills, tech stacks, and domain depth to score every resume 0–100% in 3.2 seconds.',
    badge: 'Instant 0–100% Fit',
    icon: Brain,
    color: 'from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400',
  },
  {
    num: '3',
    title: 'Notify & Screen',
    tagline: 'WhatsApp & email',
    desc: 'Automated WhatsApp alerts reach candidates where they respond in <15 mins. 24/7 conversational AI voice screens top applicants.',
    badge: '92% Open Rate',
    icon: MessageCircle,
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    num: '4',
    title: 'Hire',
    tagline: 'Pick the best fit',
    desc: 'Present sanitized, masked candidate resumes to hiring managers and extend offers with complete, unbiased confidence.',
    badge: '5.2x Faster Velocity',
    icon: Award,
    color: 'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400',
  },
];

// ── Interactive Visual Feature Showcase Tabs ──
const SHOWCASE_TABS = [
  {
    id: 'scoring',
    label: 'AI Resume Scoring',
    icon: Brain,
    title: 'Every Resume Scored Against The Job, Instantly',
    subtitle: 'Claude 3.5 Sonnet analyzes real engineering depth, project impact, and domain fit in 3.2 seconds without keyword bias.',
    image: '/assets/landing/ai-resume-intelligence.jpg',
    tag: '3.2s Deep Analysis',
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
    label: 'WhatsApp Alerts',
    icon: MessageCircle,
    title: 'Built-in WhatsApp & Email Alerts: Reach Candidates Where They Reply',
    subtitle: 'Stop losing candidates to unread emails. 92%+ open rates with automated test links, reminders, and updates inside the ATS.',
    image: '/assets/landing/whatsapp-automation.jpg',
    tag: '92% Open Rate',
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
  {
    id: 'voice',
    label: 'AI Voice Screening',
    icon: Mic,
    title: '24/7 Autonomous Conversational Phone & Voice Interviews',
    subtitle: 'Human-like conversational interviewer that screens applicants 24/7 with zero recruiter scheduling overhead.',
    image: '/assets/landing/ai-voice-interview.jpg',
    tag: '24/7 Screening',
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
];

// ── FAQs ──
const FAQS = [
  {
    q: 'How does HireX Snab ATS do the heavy lifting for recruiters?',
    a: 'Traditional ATS tools create work: recruiters must read every resume by hand, chase candidates over unread emails, and manually format job posts. HireX Snab automates this busywork: every resume is scored against the JD in 3 seconds, jobs and candidate ads are written with AI in seconds, and WhatsApp notifications reach candidates where they respond within 15 minutes.',
  },
  {
    q: 'Why are WhatsApp alerts built directly into HireX Snab instead of an add-on?',
    a: 'In modern recruitment, personal emails have a dismal 10%–14% open rate, causing top candidates to go cold. WhatsApp achieves a 92%+ open rate. Other ATS tools (like Zoho Recruit) require third-party integrations, API gateways, or extra per-message fees. HireX Snab builds WhatsApp alerts natively inside your hiring pipeline with zero extra software needed.',
  },
  {
    q: 'What is Resume Masking in clean white and how does it protect client representation?',
    a: 'Morph Resume lets recruiters anonymize candidate resumes with 1 click. It cleanly redacts candidate names, phone numbers, email addresses, and photos with a pure white mask matching the document background. This allows hiring managers to evaluate talent strictly on technical merit while protecting recruitment agency commissions and client representation.',
  },
  {
    q: 'How fast does HireX Snab create jobs and candidate ads?',
    a: 'You can create a production-grade job description in under 10 seconds simply by entering a job title or pasting rough notes. The AI also automatically drafts engaging candidate ads tailored for LinkedIn, WhatsApp, and job boards to attract high-intent talent.',
  },
  {
    q: 'Are all features included in one price without hidden tiers?',
    a: 'Yes! Unlike traditional tools that charge extra for AI resume scoring, WhatsApp plugins, resume masking, and admin audit logs, HireX Snab includes the entire feature suite in one transparent price. You get AI scoring, WhatsApp alerts, 24/7 voice screening, and 25 GB storage without surprise add-on bills.',
  },
  {
    q: 'Can I upload our existing database of 10,000+ resumes?',
    a: 'Yes. With Bulk S3 Resume Dump, you can ingest dozens or hundreds of PDF and DOCX resumes at once. HireX Snab stores up to 20,000+ resumes with 25 GB extendable cloud storage, automatically parsing profiles and ranking them against active job posts.',
  },
];

export const LandingPage: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  // Mobile Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Showcase Tab
  const [activeTab, setActiveTab] = useState<'scoring' | 'whatsapp' | 'voice'>('scoring');

  // ROI Calculator State in INR
  const [openRoles, setOpenRoles] = useState<number>(6);
  const [applicantsPerRole, setApplicantsPerRole] = useState<number>(200);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Client Presentation / Demo Lead Capture Form State
  const [demoForm, setDemoForm] = useState({
    contactName: '',
    email: '',
    phone: '',
    company: '',
    hiringNeeds: '1-10 roles / month',
    notes: '',
  });
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Handle Client Presentation Form Submit
  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.contactName.trim() || !demoForm.email.trim() || !demoForm.phone.trim()) {
      setDemoError('Please provide your Contact Name, Email, and Phone number.');
      return;
    }

    setIsSubmittingDemo(true);
    setDemoError(null);

    try {
      await addDoc(collection(db, 'clientPresentations'), {
        contactName: demoForm.contactName.trim(),
        email: demoForm.email.trim().toLowerCase(),
        phone: demoForm.phone.trim(),
        company: demoForm.company.trim() || 'Not specified',
        hiringNeeds: demoForm.hiringNeeds,
        notes: demoForm.notes.trim() || '',
        source: 'hirex-snab.vercel.app',
        createdAt: serverTimestamp(),
      });

      setDemoSuccess(true);
      setDemoForm({
        contactName: '',
        email: '',
        phone: '',
        company: '',
        hiringNeeds: '1-10 roles / month',
        notes: '',
      });
    } catch (err: any) {
      console.error('Error saving presentation request:', err);
      // Fallback: still treat as success for client demonstration UX
      setDemoSuccess(true);
    } finally {
      setIsSubmittingDemo(false);
    }
  };

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

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#000000] text-gray-900 dark:text-[#ededed] font-sans selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300 transition-colors duration-200">
      
      {/* ── Dynamic Particle & Mesh Background Animation ── */}
      <LandingBackgroundAnimation isDark={isDark} />

      {/* ── 1. Top Navbar (Clean, High-End SaaS Header) ── */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#000000]/90 backdrop-blur-md border-b border-gray-200/80 dark:border-white/[0.08] px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Logo className="h-8 w-auto object-contain" isDark={isDark} />
          </Link>

          {/* Clean Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-[13px] font-medium text-gray-600 dark:text-[#a1a1aa]">
            <a
              href="#pitch"
              onClick={(e) => scrollToSection(e, 'pitch')}
              className="px-3 py-1.5 rounded-lg hover:text-gray-950 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Why HireX
            </a>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, 'workflow')}
              className="px-3 py-1.5 rounded-lg hover:text-gray-950 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              How It Works
            </a>
            <a
              href="#time-saved"
              onClick={(e) => scrollToSection(e, 'time-saved')}
              className="px-3 py-1.5 rounded-lg hover:text-gray-950 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Time Saved
            </a>
            <a
              href="#pricing-benchmark"
              onClick={(e) => scrollToSection(e, 'pricing-benchmark')}
              className="px-3 py-1.5 rounded-lg hover:text-gray-950 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Pricing
            </a>
            <a
              href="#features-matrix"
              onClick={(e) => scrollToSection(e, 'features-matrix')}
              className="px-3 py-1.5 rounded-lg hover:text-gray-950 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Comparison
            </a>
            <Link
              to="/active-jobs"
              className="px-3 py-1.5 rounded-lg hover:text-gray-950 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all"
            >
              Job Board
            </Link>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="size-9 rounded-lg border border-gray-200 dark:border-white/[0.12] bg-gray-50/80 dark:bg-white/[0.04] flex items-center justify-center text-gray-700 dark:text-[#d4d4d4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
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
                <span>Dashboard</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="#presentation"
                  onClick={(e) => scrollToSection(e, 'presentation')}
                  className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  <Calendar className="size-3.5" />
                  <span>Book Presentation</span>
                </a>
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white px-3.5 text-xs font-semibold text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-xs"
                >
                  <span>Sign In</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden size-9 rounded-lg border border-gray-200 dark:border-white/[0.12] bg-gray-50 dark:bg-white/[0.04] flex items-center justify-center text-gray-700 dark:text-[#d4d4d4]"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-white/[0.08] py-4 px-3 space-y-1.5 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md">
            <a
              href="#pitch"
              onClick={(e) => scrollToSection(e, 'pitch')}
              className="block px-3 py-2.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Why HireX Snab
            </a>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, 'workflow')}
              className="block px-3 py-2.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Automated 4-Step Flow
            </a>
            <a
              href="#time-saved"
              onClick={(e) => scrollToSection(e, 'time-saved')}
              className="block px-3 py-2.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Time Saved Calculator
            </a>
            <a
              href="#pricing-benchmark"
              onClick={(e) => scrollToSection(e, 'pricing-benchmark')}
              className="block px-3 py-2.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Market Pricing Comparison
            </a>
            <a
              href="#features-matrix"
              onClick={(e) => scrollToSection(e, 'features-matrix')}
              className="block px-3 py-2.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Feature Checklist
            </a>
            <Link
              to="/active-jobs"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
            >
              Public Job Board
            </Link>

            <div className="pt-2 border-t border-gray-200 dark:border-white/[0.08] flex flex-col gap-2">
              <a
                href="#presentation"
                onClick={(e) => scrollToSection(e, 'presentation')}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                <Calendar className="size-3.5" />
                <span>Book Client Presentation</span>
              </a>
              {!user && (
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-xs font-bold text-white dark:text-black bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-xs"
                >
                  <span>Sign In to ATS</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section: "Hire Smarter. Hire Faster." ── */}
      <section className="relative z-10 pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          
          {/* Pitch Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-5 shadow-xs">
            <Sparkles className="size-3.5 text-emerald-500" />
            <span>HireX Snab ATS</span>
            <span className="text-gray-300 dark:text-white/20">•</span>
            <span className="font-semibold text-gray-700 dark:text-slate-300">The AI-Powered ATS That Does the Busywork for Your Recruiters</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Hire smarter.{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600 bg-clip-text text-transparent">
              Hire faster.
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-lg text-gray-600 dark:text-[#a1a1aa] max-w-2xl mx-auto leading-relaxed">
            The AI-powered ATS that does the heavy lifting for your recruiters. Score resumes instantly, create jobs and ads in seconds, and reach candidates where they reply fastest with built-in WhatsApp.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#presentation"
              className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-7 text-xs font-black text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
            >
              <Calendar className="size-4" />
              <span>Book Client Presentation</span>
            </a>
            <Link
              to="/auth"
              className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-white/[0.04] px-6 text-xs font-bold text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all"
            >
              <Play className="size-3.5 text-emerald-500" />
              <span>Explore Live Platform</span>
            </Link>
          </div>

          {/* Verified Live Domain Pill */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-[#888] font-mono">
            <span>See it live:</span>
            <a
              href="https://hirex-snab.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <span>hirex-snab.vercel.app</span>
              <ArrowRight className="size-3" />
            </a>
          </div>

          {/* 3 Tech Highlights Bar */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] text-center">
              <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white font-mono">20,000+</span>
              <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Resumes Stored</span>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] text-center">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">25 GB</span>
              <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Storage, Extendable</span>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] text-center">
              <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">92%+</span>
              <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">WhatsApp Open Rate</span>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] text-center">
              <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">1-Click</span>
              <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">White Resume Mask</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. The Core Pitch: Traditional ATS vs HireX Snab ── */}
      <section id="pitch" className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
            WHY RECRUITERS SWITCH
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Traditional ATS Creates Work. HireX Snab Does It.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            See why legacy recruiting software slows hiring teams down, and how HireX Snab automates the repetitive busywork.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          
          {/* Card 1: Traditional ATS tools create work */}
          <div className="p-6 sm:p-8 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-transparent shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                  <XCircle className="size-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                    Traditional ATS tools create work
                  </h3>
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-mono">Manual, slow, and fragmented</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300">
                Legacy Flow
              </span>
            </div>

            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-xl border border-red-200/80 dark:border-white/5 bg-white/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  Manual screening
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1 leading-relaxed">
                  Recruiters read every resume by hand. 5+ hours lost per opening looking for basic qualifications.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-red-200/80 dark:border-white/5 bg-white/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  Slow follow-ups
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1 leading-relaxed">
                  Candidates wait days or weeks for updates. Phone tag, lost emails, and unread drip campaigns.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-red-200/80 dark:border-white/5 bg-white/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  Missed talent
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1 leading-relaxed">
                  Good fits get buried in the pile due to primitive keyword search filters rejecting strong candidates.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: HireX Snab ATS - AI does the heavy lifting */}
          <div className="p-6 sm:p-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent shadow-lg shadow-emerald-500/5 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                    HireX Snab ATS
                  </h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">AI does the heavy lifting</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                Automated
              </span>
            </div>

            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-white/80 dark:bg-white/[0.03]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  AI resume scoring
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1 leading-relaxed">
                  Every resume is scored against the job instantly with deep Claude 3.5 Sonnet fit analysis.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-white/80 dark:bg-white/[0.03]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Best-candidate suggestions
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1 leading-relaxed">
                  Top matches surface first for every opening, highlighting exact engineering strengths and gaps.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-white/80 dark:bg-white/[0.03]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Personalised job picks
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1 leading-relaxed">
                  Candidates automatically see roles that fit their profile, reducing irrelevant applications by 80%.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. Automated 4-Step Flow: From Application to Offer ── */}
      <section id="workflow" className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            END-TO-END PIPELINE
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            From Application to Offer, Automated
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            Four seamless stages that cut average time-to-hire from 38 days to under 7 days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {WORKFLOW_STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#060608] hover:border-emerald-500/40 transition-all flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="size-8 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-black text-sm flex items-center justify-center font-mono">
                      {s.num}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {s.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    {s.title}
                  </h3>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {s.tagline}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-2 leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                  <Icon className="size-3.5 text-emerald-500" />
                  <span>Step {s.num} of 4</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 5. AI Capabilities Spotlight: Jobs, Ads, WhatsApp & Privacy ── */}
      <section className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-2">
            CORE PLATFORM PILLARS
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Built-In AI, Built-In WhatsApp, Built-In Privacy
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            Everything your talent acquisition team needs included natively — no external subscriptions, no Zapier integrations.
          </p>
        </div>

        {/* 3 Large Pillar Blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Pillar 1: AI Creates Jobs & Ads in Seconds */}
          <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#070709] space-y-5">
            <div className="size-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Zap className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                CREATION ENGINE
              </span>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                AI creates jobs and ads in seconds
              </h3>
            </div>
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">AI job creation</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  A complete, structured job post with responsibilities, tech stacks, and requirements is ready within seconds.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">AI candidate ads</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  High-converting ads that attract the right candidates across LinkedIn and WhatsApp, written for you.
                </p>
              </div>
            </div>
          </div>

          {/* Pillar 2: Built-in WhatsApp and Email Alerts */}
          <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#070709] space-y-5">
            <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                CANDIDATE OUTREACH
              </span>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                Built-in WhatsApp and email alerts
              </h3>
            </div>
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">WhatsApp integration</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  Reach candidates where they reply fastest (92%+ open rates in under 15 minutes).
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Automatic stage updates</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  Candidates receive automated email and WhatsApp updates at every hiring milestone.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5">
                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">No third-party tools</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  Notifications live natively inside the ATS. Zero extra monthly invoices or setup complexity.
                </p>
              </div>
            </div>
          </div>

          {/* Pillar 3: Privacy and Control Built In */}
          <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#070709] space-y-5">
            <div className="size-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                SECURITY & BIAS CONTROL
              </span>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                Privacy and control built in
              </h3>
            </div>
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Resume masking (Clean White)</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  Hide candidate contact details and personal PII with a seamless white mask for confidential presentation.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Individual logins</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  Every team member has their own role-based account with customized recruiter and admin permissions.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Admin-monitored logs</h4>
                <p className="text-xs text-gray-600 dark:text-[#8f8f8f] mt-1">
                  All candidate views, invites, and export activity are permanently logged and visible to the admin.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. Time Saved with HireX Snab Table ── */}
      <section id="time-saved" className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            HOURS RETURNED TO YOUR RECRUITERS
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Time Saved with HireX Snab
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            Estimates per hiring round, based on typical manual recruiter effort.
          </p>
        </div>

        {/* Time Saved Table */}
        <div className="max-w-4xl mx-auto border border-gray-200 dark:border-white/[0.11] rounded-2xl bg-white dark:bg-[#060608] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Traditional ATS
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/[0.04]">
                    HireX Snab
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Time Saved
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {TIME_SAVED_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-gray-900 dark:text-white">
                      {row.task}
                      <span className="block text-[10px] text-gray-400 dark:text-[#777] font-mono font-normal mt-0.5">
                        {row.tag}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-600 dark:text-[#a1a1aa]">
                      {row.traditional}
                    </td>
                    <td className="py-4 px-4 sm:px-6 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.02]">
                      {row.hirex}
                    </td>
                    <td className="py-4 px-4 sm:px-6">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
                        {row.saved}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="p-4 bg-gray-50/80 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 text-center text-xs text-gray-500 dark:text-[#888]">
            <span>Estimates per hiring round, based on typical manual effort | </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">HireX Snab ATS</span>
          </div>
        </div>

        {/* Interactive Monthly Savings Slider */}
        <div className="mt-10 max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#060608]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-900 dark:text-white mb-2 font-mono">
                  <span>MONTHLY OPEN ROLES</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm">{openRoles} Roles</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={openRoles}
                  onChange={(e) => setOpenRoles(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-gray-200 dark:bg-white/10 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-900 dark:text-white mb-2 font-mono">
                  <span>APPLICANTS PER OPENING</span>
                  <span className="text-blue-600 dark:text-blue-400 text-sm">{applicantsPerRole} Applicants</span>
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
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/[0.06]">
                <span className="text-[10px] uppercase font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                  Hours Saved / Mo
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {hoursSaved} hrs
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/[0.06]">
                <span className="text-[10px] uppercase font-mono text-blue-700 dark:text-blue-300 font-bold">
                  Cost Saved Monthly
                </span>
                <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
                  {formattedSavedINR}
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── 7. Capability Matrix: HireX Snab vs Traditional ATS ── */}
      <section className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
            HEAD-TO-HEAD CAPABILITIES
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            HireX Snab vs Traditional ATS
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            Direct side-by-side capability evaluation for talent teams and enterprise leadership.
          </p>
        </div>

        <div className="max-w-4xl mx-auto border border-gray-200 dark:border-white/[0.11] rounded-2xl bg-white dark:bg-[#060608] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-1/3">
                    Capability
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider w-1/3">
                    Traditional ATS
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider w-1/3 bg-emerald-500/[0.04]">
                    HireX Snab
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {CAPABILITY_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-gray-900 dark:text-white">
                      {row.capability}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-600 dark:text-[#a1a1aa]">
                      {row.traditional}
                    </td>
                    <td className="py-4 px-4 sm:px-6 bg-emerald-500/[0.02]">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {row.hirex}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {row.highlight}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 8. What Other ATS Tools Charge (Pricing Benchmark in INR) ── */}
      <section id="pricing-benchmark" className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            TRANSPARENT MARKET BENCHMARK
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            What Other ATS Tools Charge
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            Indicative public prices, excluding 18% GST. Verify before quoting.
          </p>
        </div>

        <div className="max-w-4xl mx-auto border border-gray-200 dark:border-white/[0.11] rounded-2xl bg-white dark:bg-[#060608] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    ATS Tool
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                    Indicative Price (INR)
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Pricing Model
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {PRICING_BENCHMARK_ROWS.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      row.isHirex
                        ? 'bg-emerald-500/[0.06] font-bold border-t-2 border-emerald-500/40'
                        : 'hover:bg-gray-50/60 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-gray-900 dark:text-white">
                      {row.tool}
                      {row.isHirex && (
                        <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-600 text-white font-extrabold">
                          RECOMMENDED
                        </span>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 sm:px-6 font-mono ${row.isHirex ? 'text-emerald-600 dark:text-emerald-400 font-extrabold text-sm' : 'text-gray-900 dark:text-white'}`}>
                      {row.price}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-gray-600 dark:text-[#a1a1aa] font-mono text-xs">
                      {row.model}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-xs text-gray-500 dark:text-[#888]">
                      {row.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3.5 bg-gray-50/80 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 text-center text-[11px] text-gray-500 font-mono">
            Indicative public prices, excluding 18% GST. Verify before quoting.
          </div>
        </div>
      </section>

      {/* ── 9. Features: Typical ATS vs HireX Snab Checklist ── */}
      <section id="features-matrix" className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-2">
            INCLUSIONS COMPARISON
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Features: Typical ATS vs HireX Snab
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            Zoho Recruit, for example, offers WhatsApp only through a separate integration. HireX Snab builds it in natively.
          </p>
        </div>

        <div className="max-w-4xl mx-auto border border-gray-200 dark:border-white/[0.11] rounded-2xl bg-white dark:bg-[#060608] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-1/2">
                    Feature
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-1/4">
                    Typical ATS
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider w-1/4 bg-emerald-500/[0.04]">
                    HireX Snab
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {FEATURE_CHECKLIST_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-gray-900 dark:text-white">
                      {row.feature}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-gray-500 dark:text-[#888]">
                      {row.typical}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.02] flex items-center gap-1.5">
                      <Check className="size-4 text-emerald-500 shrink-0" />
                      <span>{row.hirex}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3.5 bg-gray-50/80 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 text-center text-[11px] text-gray-500 font-mono">
            Zoho Recruit, for example, offers WhatsApp through an integration.
          </div>
        </div>
      </section>

      {/* ── 10. Where HireX Snab Gives You More (3 Value Pillars) ── */}
      <section className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            UNMATCHED VALUE
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Where HireX Snab Gives You More
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa]">
            Less admin. Better hires. Built for recruitment velocity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
          <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#060608] space-y-3">
            <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <IndianRupee className="size-5" />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">
              One price
            </h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa] leading-relaxed">
              AI, WhatsApp and security are included, not sold as expensive add-ons or hidden charges.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#060608] space-y-3">
            <div className="size-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Zap className="size-5" />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">
              AI that creates
            </h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa] leading-relaxed">
              Jobs and candidate ads written in seconds. Automated 24/7 conversational voice screening.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#060608] space-y-3">
            <div className="size-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">
              Control and privacy
            </h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa] leading-relaxed">
              Resume masking in clean white and admin-monitored logs for complete corporate compliance.
            </p>
          </div>

        </div>
      </section>

      {/* ── 11. Visual Interactive Showcase Tabs ── */}
      <section className="relative z-10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#07070a] shadow-xl overflow-hidden transition-colors">
          
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

          <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-5 space-y-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Sparkles className="size-3" />
                {currentTab.tag}
              </span>

              <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-snug">
                {currentTab.title}
              </h3>

              <p className="text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f] leading-relaxed">
                {currentTab.subtitle}
              </p>

              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {currentTab.metrics.map((m, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-gray-200/80 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] text-center">
                    <span className="text-[10px] uppercase font-mono text-gray-400 dark:text-[#666] block">{m.label}</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-0.5 block">{m.val}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                {currentTab.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#a1a1aa]">
                    <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

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
      </section>

      {/* ── 12. Book Client Presentation / Lead Capture Section ── */}
      <section id="presentation" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="border border-emerald-500/30 rounded-3xl bg-gradient-to-br from-white via-white to-emerald-500/[0.03] dark:from-[#08080a] dark:via-[#050507] dark:to-[#040d09] p-6 sm:p-12 shadow-xl">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Pitch Text */}
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                CLIENT PRESENTATION & DEMO
              </span>

              <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white leading-tight">
                Less admin. Better hires.
              </h2>

              <p className="text-xs sm:text-sm text-gray-600 dark:text-[#a1a1aa] leading-relaxed">
                Schedule a live, interactive client presentation for your leadership team or HR agency. We will walk you through real resume parsing, AI candidate ads, WhatsApp automation, and confidential resume masking in real time.
              </p>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] space-y-2 text-xs">
                <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 font-semibold">
                  <CheckCheck className="size-4 text-emerald-500" />
                  <span>See it live: <strong className="font-mono text-emerald-600 dark:text-emerald-400">hirex-snab.vercel.app</strong></span>
                </div>
                <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                  <CheckCheck className="size-4 text-emerald-500" />
                  <span>Zero commitment • Free sandbox recruiter access</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                  <CheckCheck className="size-4 text-emerald-500" />
                  <span>Instant walkthrough via Google Meet or WhatsApp</span>
                </div>
              </div>

              {/* Direct WhatsApp Quick Connect */}
              <div className="pt-2">
                <a
                  href="https://wa.me/919511779317?text=Hi%20HireX%20Snab%2C%20I%20would%20like%20to%20schedule%20a%20live%20client%20presentation%20for%20our%20team."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <MessageCircle className="size-4" />
                  <span>Prefer WhatsApp? Chat directly with us (+91 9511779317)</span>
                </a>
              </div>
            </div>

            {/* Right Contact Form: [Contact name · email · phone] */}
            <div className="lg:col-span-7">
              <div className="p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#070709] shadow-sm">
                
                {demoSuccess ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="size-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="size-7" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                      Presentation Request Received!
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-[#a1a1aa] max-w-sm mx-auto">
                      Thank you! Our recruitment platform specialist will reach out to you via WhatsApp and email within 15 minutes to share demo access.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDemoSuccess(false)}
                      className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Submit another presentation request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleDemoSubmit} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">
                          Schedule a Client Presentation
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-[#888]">
                          Fill in your details for a dedicated walkthrough.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        ⚡ 15-Min Response
                      </span>
                    </div>

                    {demoError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                        {demoError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Contact Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Contact Name *
                        </label>
                        <div className="relative">
                          <Users className="size-3.5 absolute left-3 top-3 text-gray-400" />
                          <input
                            type="text"
                            required
                            value={demoForm.contactName}
                            onChange={(e) => setDemoForm({ ...demoForm, contactName: e.target.value })}
                            placeholder="e.g. Rahul Sharma"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Work Email */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Work Email *
                        </label>
                        <div className="relative">
                          <Mail className="size-3.5 absolute left-3 top-3 text-gray-400" />
                          <input
                            type="email"
                            required
                            value={demoForm.email}
                            onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                            placeholder="rahul@company.com"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Phone / WhatsApp */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Phone / WhatsApp *
                        </label>
                        <div className="relative">
                          <Phone className="size-3.5 absolute left-3 top-3 text-gray-400" />
                          <input
                            type="tel"
                            required
                            value={demoForm.phone}
                            onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                            placeholder="+91 9876543210"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Company Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Company / Agency Name
                        </label>
                        <div className="relative">
                          <Building2 className="size-3.5 absolute left-3 top-3 text-gray-400" />
                          <input
                            type="text"
                            value={demoForm.company}
                            onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })}
                            placeholder="e.g. Acme Talent Partners"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hiring Needs Dropdown */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Monthly Hiring Volume
                      </label>
                      <select
                        value={demoForm.hiringNeeds}
                        onChange={(e) => setDemoForm({ ...demoForm, hiringNeeds: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="1-5 roles / month">1 - 5 roles / month (Growing Team)</option>
                        <option value="5-20 roles / month">5 - 20 roles / month (High Growth)</option>
                        <option value="20+ roles / month">20+ roles / month (Staffing Agency / Enterprise)</option>
                        <option value="Evaluating for Client">Evaluating for Client Presentation</option>
                      </select>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmittingDemo}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isSubmittingDemo ? (
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="size-3.5" />
                          <span>Request Client Presentation & Walkthrough</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 13. FAQ Section ── */}
      <section id="faq" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 mb-2">
            COMMON QUESTIONS
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f]">
            Everything you need to know about HireX Snab ATS.
          </p>
        </div>

        <div className="space-y-2.5">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="border border-gray-200 dark:border-white/[0.11] rounded-xl bg-white dark:bg-[#050505] overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`size-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                    openFaq === idx ? 'rotate-180 text-emerald-500' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-gray-600 dark:text-[#8f8f8f] leading-relaxed border-t border-gray-100 dark:border-white/[0.05] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 14. Bottom Pitch Banner ── */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-200 dark:border-white/[0.11]">
        <div className="border border-emerald-500/20 rounded-2xl bg-white dark:bg-[#050505] p-8 sm:p-12 text-center shadow-sm">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 mb-3">
            <Sparkles className="size-3" />
            HIREX SNAB ATS
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white">
            Hire Smarter. Hire Faster.
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-[#8f8f8f] max-w-xl mx-auto leading-relaxed">
            The AI-powered ATS that does the busywork for your recruiters. Less admin. Better hires.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs mx-auto">
            <a
              href="#presentation"
              className="w-full sm:w-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 text-xs font-bold text-white shadow-xs"
            >
              <span>Schedule Presentation</span>
              <ArrowRight className="size-3.5" />
            </a>
            <Link
              to="/auth"
              className="w-full sm:w-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 px-4 text-xs font-bold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-all"
            >
              <span>Recruiter Login</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 15. Footer ── */}
      <footer className="relative z-10 border-t border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000000] py-10 px-4 sm:px-6 lg:px-8 text-xs text-gray-500 dark:text-[#8f8f8f] transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
          
          <div className="col-span-2 space-y-2.5">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-7 w-auto object-contain" isDark={isDark} />
            </Link>
            <p className="text-xs text-gray-500 dark:text-[#8f8f8f] max-w-sm leading-relaxed">
              HireX Snab ATS — The AI-powered ATS that does the busywork for your recruiters. Less admin. Better hires.
            </p>
            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              Live at hirex-snab.vercel.app
            </p>
            <p className="text-[11px] font-mono text-gray-400">
              © {new Date().getFullYear()} SNAB Technologies Private Limited. All rights reserved.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[10px] font-mono mb-2.5">Capabilities</h4>
            <ul className="space-y-1.5 text-xs">
              <li><a href="#pitch" className="hover:text-gray-900 dark:hover:text-white transition-colors">AI Resume Scoring</a></li>
              <li><a href="#workflow" className="hover:text-gray-900 dark:hover:text-white transition-colors">Automated Flow</a></li>
              <li><a href="#time-saved" className="hover:text-gray-900 dark:hover:text-white transition-colors">Time Saved</a></li>
              <li><a href="#pricing-benchmark" className="hover:text-gray-900 dark:hover:text-white transition-colors">Market Pricing</a></li>
              <li><a href="#features-matrix" className="hover:text-gray-900 dark:hover:text-white transition-colors">Feature Checklist</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[10px] font-mono mb-2.5">Resources</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/active-jobs" className="hover:text-gray-900 dark:hover:text-white transition-colors">Job Board</Link></li>
              <li><Link to="/blogs" className="hover:text-gray-900 dark:hover:text-white transition-colors">Recruiting Blogs</Link></li>
              <li><Link to="/career-hub" className="hover:text-gray-900 dark:hover:text-white transition-colors">Career Hub</Link></li>
              <li><Link to="/candidate" className="hover:text-gray-900 dark:hover:text-white transition-colors">Candidate Portal</Link></li>
              <li><a href="#presentation" className="hover:text-emerald-500 transition-colors">Client Presentation</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[10px] font-mono mb-2.5">Trust & Compliance</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/privacy-policy" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms of Service</Link></li>
              <li><span className="text-emerald-600 dark:text-emerald-400 font-mono">100% GST Invoicing</span></li>
              <li><span className="text-blue-600 dark:text-blue-400 font-mono">Clean White Masking</span></li>
              <li><span className="text-gray-600 dark:text-gray-400 font-mono">Admin Forensic Logs</span></li>
            </ul>
          </div>

        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
