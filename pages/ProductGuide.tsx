import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  Users,
  Briefcase,
  Video,
  Brain,
  Code2,
  Send,
  MessageSquare,
  ShieldCheck,
  FileText,
  Search,
  ExternalLink,
  Layers,
  ChevronRight,
  Eye,
  Sliders,
  Award,
  Terminal,
  Clock,
  HelpCircle,
  Copy,
  Check,
  Share2,
  Workflow,
  AlertTriangle,
  UploadCloud,
  FileUp,
  Key,
  Server,
  Zap,
  Globe,
  Radio,
  Flame,
  CheckCheck,
  Phone,
  Mail,
  ChevronDown,
  Kanban,
  TrendingUp,
  Star,
  LayoutDashboard,
  Menu,
  X,
  Building2,
  User,
  MessageCircle
} from 'lucide-react';
import HireXLogo from '../components/HireXLogo';
import { useAuth } from '../context/AuthContext';

interface Chapter {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  badge: string;
  icon: React.ElementType;
  description: string;
}

const CHAPTERS: Chapter[] = [
  {
    id: 'auth',
    number: '01',
    title: 'Authentication, Access & Team Hierarchy',
    shortTitle: 'Login & Teams',
    badge: 'Security',
    icon: Lock,
    description: 'Single sign-on, email authentication, organization owners, secondary recruiters, and audit-logged role routing.',
  },
  {
    id: 'dashboard',
    number: '02',
    title: 'Recruiter Workspace & Dashboard Analytics',
    shortTitle: 'Workspace',
    badge: 'Operations',
    icon: Briefcase,
    description: 'Navigating active requisitions, live candidate completion counters, rate-limit credits, and notification alerts.',
  },
  {
    id: 'job-creation',
    number: '03',
    title: 'Job Creation & Deep AI Job Description Parsing',
    shortTitle: 'Job Builder',
    badge: 'Core Engine',
    icon: Sparkles,
    description: 'Ingesting JDs from PDF, Word, or URLs with automated skill extraction, degree mapping, and strict criteria toggles.',
  },
  {
    id: 'evaluation-suite',
    number: '04',
    title: 'Configuring the 3-in-1 Evaluation Suite',
    shortTitle: 'Evaluation Rounds',
    badge: 'Modular Rounds',
    icon: Layers,
    description: 'In-depth setup for Autonomous AI Video/Voice interviews, Domain MCQ assessments, and Live Cloud Coding IDE rounds.',
  },
  {
    id: 'sourcing-invites',
    number: '05',
    title: 'Candidate Sourcing & Multi-Channel Outreach',
    shortTitle: 'Sourcing & Invites',
    badge: 'Automation',
    icon: Send,
    description: 'Bulk CSV imports, automated WhatsApp dispatch via Baileys, transactional Brevo emails, and public career board links.',
  },
  {
    id: 'resume-dump',
    number: '06',
    title: 'High-Volume Resume Dump & Match Scoring',
    shortTitle: 'Resume Dump',
    badge: 'AI Screening',
    icon: UploadCloud,
    description: 'Parsing up to 500 resumes in seconds, extracting candidate skill signals, and computing 0–100% role alignment scores.',
  },
  {
    id: 'candidate-experience',
    number: '07',
    title: 'Candidate Experience & Anti-Cheat Proctoring',
    shortTitle: 'Candidate Room',
    badge: 'WebRTC Live',
    icon: Video,
    description: 'Zero-install browser interview room, hardware diagnostic tests, 2-way spoken probing, and anti-cheat telemetry.',
  },
  {
    id: 'automated-scoring',
    number: '08',
    title: 'Automated Scoring & Candidate Dossiers',
    shortTitle: 'AI Scorecards',
    badge: 'AWS Bedrock',
    icon: Award,
    description: 'Evidence-based qualitative scorecards, radial gauges, synchronized transcripts, unedited HD video, and PDF downloads.',
  },
  {
    id: 'recruiter-review',
    number: '09',
    title: 'Recruiter Review, SME Overrides & Kanban Pipeline',
    shortTitle: 'SME Review & Pipeline',
    badge: 'Human Oversight',
    icon: Sliders,
    description: 'Reviewing dossiers, manual SME score adjustments, note-taking, and drag-and-drop pipeline progression.',
  },
  {
    id: 'client-portals',
    number: '10',
    title: 'Client Review Portals & Anti-Poaching Masking',
    shortTitle: 'Client Portals',
    badge: 'Enterprise Share',
    icon: ShieldCheck,
    description: 'Generating secure, tokenized shortlist links with automatic PII blind-masking to prevent candidate poaching.',
  },
  {
    id: 'security-compliance',
    number: '11',
    title: 'Enterprise Security, DPDP Act & Data Sovereignty',
    shortTitle: 'Security & DPDP',
    badge: 'Compliance',
    icon: Key,
    description: 'AWS Bedrock ap-south-1 Mumbai data residency, zero-retention AI model training, AES-256 encryption, and GDPR compliance.',
  },
  {
    id: 'route-directory',
    number: '12',
    title: 'Platform Route & URL Quick Reference',
    shortTitle: 'Route Directory',
    badge: 'Reference',
    icon: Terminal,
    description: 'Complete cheat sheet of all public, candidate, recruiter, and administration routes across InterviewXpert.',
  },
];

export default function ProductGuide() {
  const [activeChapter, setActiveChapter] = useState('auth');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, userProfile } = useAuth();

  const dashboardPath = userProfile?.role === 'superadmin' 
    ? '/admin' 
    : userProfile?.role === 'candidate' 
      ? '/candidate' 
      : '/recruiter/jobs';

  useEffect(() => {
    document.title = "Complete Platform Guide & Standard Operating Procedure | InterviewXpert";
    window.scrollTo(0, 0);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return CHAPTERS;
    const q = searchQuery.toLowerCase();
    return CHAPTERS.filter(c => 
      c.title.toLowerCase().includes(q) || 
      c.description.toLowerCase().includes(q) ||
      c.badge.toLowerCase().includes(q) ||
      c.shortTitle.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col font-sans selection:bg-[#D4F82C] selection:text-[#111215]">
      
      {/* ── Fixed Floating Top Navigation Bar (Identical to Landing Page) ── */}
      <header className="sticky top-0 z-[100] bg-[#F8F9F5]/90 backdrop-blur-md border-b border-[#E4E7DC] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Product Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="group inline-flex items-center shrink-0" title="InterviewXpert - AI Recruitment Platform">
              <HireXLogo size="md" variant="full" isDark={false} />
            </Link>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111215]/5 border border-[#E4E7DC] text-[10px] font-medium text-[#73766C] shrink-0">
              <span>by</span>
              <a
                href="https://snab.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#111215] hover:text-[#8FB305] transition-colors"
              >
                SNAB
              </a>
            </div>
          </div>

          {/* Centered Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-3.5 xl:gap-6 text-xs xl:text-[13px] font-semibold text-[#575A51] shrink-0">
            <a
              href="/#services"
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Services
            </a>
            <a
              href="/#process"
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Process
            </a>
            <a
              href="/#ai-interview"
              className="inline-flex items-center gap-1.5 hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>AI Interview</span>
              <span className="size-1.5 rounded-full bg-[#8FB305] animate-pulse" />
            </a>

            {/* Platform Dropdown */}
            <div className="relative group py-2 shrink-0">
              <a
                href="/#pipeline"
                className="inline-flex items-center gap-1 hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Platform</span>
                <ChevronDown className="size-3 text-[#73766C] group-hover:rotate-180 transition-transform duration-200" />
              </a>

              {/* Dropdown Menu */}
              <div className="invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 absolute top-full left-1/2 -translate-x-1/2 pt-2 w-72 pointer-events-none group-hover:pointer-events-auto z-50">
                <div className="bg-white rounded-2xl border border-[#E4E7DC] p-2 shadow-xl ring-1 ring-black/5 divide-y divide-[#F1F3EB]">
                  <a
                    href="/#pipeline"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F8F9F5] transition-colors group/item"
                  >
                    <div className="size-8 rounded-lg bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center shrink-0 group-hover/item:border-[#111215] transition-colors">
                      <Kanban className="size-4 text-[#8FB305]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111215] whitespace-nowrap">Visual Pipeline</div>
                      <div className="text-[11px] text-[#73766C] font-normal leading-tight">Drag-and-drop Kanban ATS stages</div>
                    </div>
                  </a>

                  <a
                    href="/#client-portal"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F8F9F5] transition-colors group/item"
                  >
                    <div className="size-8 rounded-lg bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center shrink-0 group-hover/item:border-[#111215] transition-colors">
                      <Share2 className="size-4 text-[#8FB305]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111215] whitespace-nowrap">Client Portal</div>
                      <div className="text-[11px] text-[#73766C] font-normal leading-tight">Shareable candidate review links</div>
                    </div>
                  </a>

                  <a
                    href="/#productivity"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F8F9F5] transition-colors group/item"
                  >
                    <div className="size-8 rounded-lg bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center shrink-0 group-hover/item:border-[#111215] transition-colors">
                      <TrendingUp className="size-4 text-[#8FB305]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111215] whitespace-nowrap">Why Switch</div>
                      <div className="text-[11px] text-[#73766C] font-normal leading-tight">80% faster hiring ROI breakdown</div>
                    </div>
                  </a>

                  <Link
                    to="/reviews"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F8F9F5] transition-colors group/item"
                  >
                    <div className="size-8 rounded-lg bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center shrink-0 group-hover/item:border-[#111215] transition-colors">
                      <Star className="size-4 text-[#8FB305]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111215] whitespace-nowrap">Candidate Reviews</div>
                      <div className="text-[11px] text-[#73766C] font-normal leading-tight">Real verified candidate feedback</div>
                    </div>
                  </Link>

                  <Link
                    to="/guide"
                    className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8F9F5] border-l-2 border-[#8FB305] transition-colors group/item"
                  >
                    <div className="size-8 rounded-lg bg-white border border-[#E4E7DC] flex items-center justify-center shrink-0 group-hover/item:border-[#111215] transition-colors">
                      <BookOpen className="size-4 text-[#8FB305]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111215] whitespace-nowrap">Platform Guide & SOP</div>
                      <div className="text-[11px] text-[#73766C] font-normal leading-tight">12 comprehensive operations chapters</div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            <a
              href="/#comparison"
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Compare
            </a>
            <a
              href="/#pricing"
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
            <a
              href="/#faq"
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
            <Link
              to="/active-jobs"
              className="hover:text-[#111215] transition-colors font-medium text-[#73766C] whitespace-nowrap shrink-0"
            >
              Job Board
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user ? (
              <Link
                to={dashboardPath}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#111215] px-4 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs"
              >
                <LayoutDashboard className="size-3.5 text-[#D4F82C]" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to="/auth"
                  className="hidden sm:inline-flex text-xs font-bold text-[#111215] hover:text-[#575A51] transition-colors px-2 py-1"
                >
                  Sign In
                </Link>
                <a
                  href="https://wa.me/919511779317?text=Hi%20InterviewXpert%20team,%20I%20would%20like%20to%20know%20more%20about%20the%20platform%20and%20request%20a%20demo."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 sm:h-9.5 items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4.5 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
                >
                  <span>Book Demo</span>
                  <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </a>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden size-9 rounded-full border border-[#E4E7DC] bg-white flex items-center justify-center text-[#111215] hover:bg-[#F8F9F5] transition-colors cursor-pointer shrink-0 shadow-2xs"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </button>
          </div>
        </div>

        {/* ── State-of-the-Art Mobile Navigation Sheet ── */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E4E7DC] bg-[#F8F9F5]/98 backdrop-blur-xl px-4 py-5 space-y-4 animate-in slide-in-from-top-3 duration-200 shadow-2xl max-h-[calc(100vh-4.5rem)] overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/candidate"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-2xl bg-white border border-[#E4E7DC] text-[#111215] hover:border-[#111215] transition-all flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <User className="size-4 text-[#8FB305]" />
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#D4F82C] text-[#111215]">Job Seekers</span>
                </div>
                <div className="mt-2 font-bold text-xs">Candidate Portal</div>
              </Link>
              <Link
                to="/recruiter/jobs"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-2xl bg-white border border-[#E4E7DC] text-[#111215] hover:border-[#111215] transition-all flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <Briefcase className="size-4 text-[#8FB305]" />
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#111215] text-[#D4F82C]">Recruiters</span>
                </div>
                <div className="mt-2 font-bold text-xs">Recruiter ATS</div>
              </Link>
            </div>

            <div className="space-y-1 pt-2 border-t border-[#E4E7DC] text-xs font-semibold text-[#575A51]">
              <a href="/#services" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg hover:bg-white hover:text-[#111215]">Services</a>
              <a href="/#process" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg hover:bg-white hover:text-[#111215]">Process</a>
              <a href="/#ai-interview" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg hover:bg-white hover:text-[#111215]">AI Interview</a>
              <a href="/#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg hover:bg-white hover:text-[#111215]">Pricing</a>
              <a href="/#faq" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg hover:bg-white hover:text-[#111215]">FAQ</a>
              <Link to="/active-jobs" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg hover:bg-white hover:text-[#111215]">Job Board</Link>
              <Link to="/reviews" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg hover:bg-white hover:text-[#111215]">Candidate Reviews</Link>
              <Link to="/guide" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 rounded-lg bg-[#D4F82C]/20 text-[#111215] font-bold">Platform Guide & SOP</Link>
            </div>

            <div className="pt-2 border-t border-[#E4E7DC] flex flex-col gap-2">
              <a
                href="tel:+919511779317"
                className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-white border border-[#E4E7DC] font-bold text-xs text-[#111215]"
              >
                <Phone className="size-3.5 text-[#8FB305]" />
                <span>Call +91 95117 79317</span>
              </a>
              <a
                href="mailto:hello@snab.co.in"
                className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-white border border-[#E4E7DC] font-bold text-xs text-[#111215]"
              >
                <Mail className="size-3.5 text-[#8FB305]" />
                <span>hello@snab.co.in</span>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── Mobile Floating Sticky Chapter Quick-Selector (< lg) ── */}
      <div className="lg:hidden sticky top-18 z-40 bg-[#F8F9F5]/95 backdrop-blur-md border-b border-[#E4E7DC] py-2 px-3 sm:px-4 shadow-xs">
        <div className="flex items-center gap-2">
          {/* Chapter Quick Jump Select Dropdown */}
          <div className="relative flex-1 min-w-0">
            <select
              value={activeChapter}
              onChange={(e) => {
                setActiveChapter(e.target.value);
                const el = document.getElementById(e.target.value);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="w-full text-xs font-bold bg-white border border-[#E4E7DC] rounded-xl px-3 py-2 text-[#111215] focus:outline-none focus:border-black appearance-none truncate pr-8 cursor-pointer shadow-2xs"
            >
              {filteredChapters.map((chap) => (
                <option key={chap.id} value={chap.id}>
                  {chap.number} • {chap.shortTitle}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#73766C] pointer-events-none" />
          </div>

          {/* Quick Call Action Button */}
          <a
            href="tel:+919511779317"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E4E7DC] text-[11px] font-bold text-[#111215] shrink-0 shadow-2xs active:scale-95 transition-transform"
            title="Direct Technical Support"
          >
            <Phone className="size-3 text-[#8FB305]" />
            <span>Call</span>
          </a>
        </div>

        {/* Horizontal Swipeable Chapter Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 pb-0.5 -mx-1 px-1 overscroll-x-contain">
          {filteredChapters.map((chap) => {
            const isActive = activeChapter === chap.id;
            return (
              <button
                key={chap.id}
                type="button"
                onClick={() => {
                  setActiveChapter(chap.id);
                  const el = document.getElementById(chap.id);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-[#111215] text-[#D4F82C] shadow-2xs'
                    : 'bg-white border border-[#E4E7DC] text-[#575A51] hover:text-[#111215]'
                }`}
              >
                {chap.number} {chap.shortTitle}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Hero Banner ── */}
      <section className="bg-gradient-to-b from-white to-[#F8F9F5] border-b border-[#E4E7DC] py-8 sm:py-14 px-3.5 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[10px] sm:text-xs font-mono font-bold text-[#111215] shadow-2xs max-w-full truncate">
            <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse shrink-0" />
            <span className="truncate">INTERVIEWXPERT COMPLETE OPERATING GUIDE & SOP</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#111215] tracking-tight leading-snug sm:leading-tight">
            How to Master InterviewXpert <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#8FB305] via-emerald-600 to-[#111215] bg-clip-text text-transparent">
              From Job Requisition to Final Hired.
            </span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-[#575A51] max-w-3xl mx-auto leading-relaxed px-1">
            Detailed technical documentation explaining every single feature: authentication, multi-round assessment configuration, bulk resume parsing, WebRTC video interview proctoring, AWS Bedrock rubric evaluation, and anti-poaching client shortlists.
          </p>

          {/* Quick Search */}
          <div className="pt-2 sm:pt-4 max-w-md mx-auto space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#73766C]" />
              <input
                type="text"
                placeholder="Search features (coding, whatsapp, overrides)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-full bg-white border border-[#E4E7DC] text-xs sm:text-sm text-[#111215] placeholder:text-[#73766C] focus:outline-none focus:border-[#111215] shadow-sm transition-all"
              />
            </div>

            {/* Direct Support & Calibration Hotlines */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 text-xs">
              <span className="text-[#73766C] font-mono text-[10px] sm:text-[11px]">Direct Support:</span>
              <a
                href="tel:+919511779317"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E4E7DC] hover:border-black text-[#111215] font-bold text-[10px] sm:text-[11px] transition-all shadow-2xs hover:bg-[#FAFBF7] active:scale-95"
              >
                <Phone className="size-3 text-[#8FB305]" />
                <span>Call: +91 95117 79317</span>
              </a>
              <a
                href="mailto:hello@snab.co.in"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E4E7DC] hover:border-black text-[#111215] font-bold text-[10px] sm:text-[11px] transition-all shadow-2xs hover:bg-[#FAFBF7] active:scale-95"
              >
                <Mail className="size-3 text-[#8FB305]" />
                <span>Mail: hello@snab.co.in</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Two-Column Documentation Layout ── */}
      <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* ── Sticky Chapter Navigation Sidebar (Desktop Only) ── */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-3">
            <div className="bg-white rounded-3xl border border-[#E4E7DC] p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E4E7DC]">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#73766C]">
                  Chapters ({filteredChapters.length})
                </span>
                <span className="text-[10px] font-mono text-[#8FB305] bg-[#D4F82C]/20 px-2 py-0.5 rounded-full font-bold">
                  SOP Index
                </span>
              </div>

              <nav className="space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                {filteredChapters.map((chap) => {
                  const Icon = chap.icon;
                  const isActive = activeChapter === chap.id;
                  return (
                    <button
                      key={chap.id}
                      type="button"
                      onClick={() => {
                        setActiveChapter(chap.id);
                        const el = document.getElementById(chap.id);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer ${
                        isActive
                          ? 'bg-[#111215] text-white shadow-sm'
                          : 'hover:bg-[#F8F9F5] text-[#575A51]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs font-bold ${
                          isActive ? 'bg-[#D4F82C] text-[#111215]' : 'bg-[#F8F9F5] border border-[#E4E7DC] text-[#73766C]'
                        }`}>
                          {chap.number}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-[#111215]'}`}>
                            {chap.shortTitle}
                          </p>
                          <span className={`text-[10px] font-mono block ${isActive ? 'text-neutral-400' : 'text-[#73766C]'}`}>
                            {chap.badge}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`size-3.5 shrink-0 transition-transform ${
                        isActive ? 'text-[#D4F82C] translate-x-0.5' : 'text-neutral-400 group-hover:text-black'
                      }`} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Support Callout */}
            <div className="p-4 rounded-2xl bg-[#FAFBF7] border border-[#E4E7DC] text-xs space-y-3">
              <div className="flex items-center gap-2 text-[#111215] font-bold">
                <HelpCircle className="size-4 text-[#8FB305]" />
                <span>Need Custom Role Calibration?</span>
              </div>
              <p className="text-[11px] text-[#575A51] leading-relaxed">
                Our solutions engineering team can calibrate your proprietary CRM / tech rubrics, set up custom question banks, and onboard your hiring managers.
              </p>
              
              <div className="space-y-1.5 pt-1">
                <a
                  href="tel:+919511779317"
                  className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#E4E7DC] hover:border-black text-[#111215] font-bold text-[11px] transition-all shadow-2xs group"
                >
                  <Phone className="size-3.5 text-[#8FB305] group-hover:scale-110 transition-transform" />
                  <span>Call: +91 95117 79317</span>
                </a>
                <a
                  href="mailto:hello@snab.co.in"
                  className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#E4E7DC] hover:border-black text-[#111215] font-bold text-[11px] transition-all shadow-2xs group"
                >
                  <Mail className="size-3.5 text-[#8FB305] group-hover:scale-110 transition-transform" />
                  <span>Mail: hello@snab.co.in</span>
                </a>
              </div>
            </div>
          </aside>

          {/* ── Main Step-by-Step Documentation Content ── */}
          <main className="lg:col-span-8 w-full min-w-0 space-y-8 sm:space-y-12">
            
            {/* ── CHAPTER 01: AUTHENTICATION ── */}
            <section id="auth" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">01</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Access & Credentials</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Authentication, Access & Team Hierarchy</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold self-start sm:self-auto shrink-0">
                  Live at /auth
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                InterviewXpert protects all hiring pipelines with zero-trust role-based access control (RBAC). The application automatically redirects users based on their authenticated credential tier.
              </p>

              {/* Step cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111215]">1. Recruiter / HR Signup</span>
                    <Lock className="size-3.5 text-[#8FB305]" />
                  </div>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Navigate to <code className="bg-white px-1.5 py-0.5 rounded border border-[#E4E7DC]">/auth</code>. Select <strong>Sign Up</strong>, choose <strong>Recruiter</strong>, enter your company name, designation, and work email. Recruiter accounts have full permissions to post jobs, configure tests, invite candidates, and inspect dossiers.
                  </p>
                </div>

                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111215]">2. Google Single Sign-On (SSO)</span>
                    <Sparkles className="size-3.5 text-[#8FB305]" />
                  </div>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Click <strong>"Continue with Google"</strong> for instant SSO. If your enterprise uses Google Workspace, accounts automatically inherit organizational security policies without requiring password maintenance.
                  </p>
                </div>
              </div>

              {/* Team Hierarchy Explanation */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FAFBF7] border border-[#E4E7DC] space-y-2">
                <h4 className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                  <Users className="size-3.5 text-[#8FB305]" />
                  <span>Team Hierarchy & Secondary Recruiters (RecruiterTeamPanel)</span>
                </h4>
                <p className="text-[11px] text-[#575A51] leading-relaxed">
                  The primary organization owner can invite unlimited secondary recruiters and hiring managers. Secondary recruiters can access shared company requisitions, review candidate dossiers, and conduct SME overrides, while organization settings remain governed by the account owner.
                </p>
              </div>

              {/* Auto Routing Table */}
              <div className="overflow-x-auto rounded-2xl border border-[#E4E7DC] -mx-1 sm:mx-0 overscroll-x-contain">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead className="bg-[#FAFBF7] border-b border-[#E4E7DC] font-mono text-[11px] text-[#73766C]">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">User Role</th>
                      <th className="py-2.5 px-4 font-bold">Default Landing Path</th>
                      <th className="py-2.5 px-4 font-bold">Granted Capabilities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7DC]">
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-[#111215]">Recruiter</td>
                      <td className="py-2.5 px-4 font-mono text-[#8FB305]">/recruiter/jobs</td>
                      <td className="py-2.5 px-4 text-[#575A51]">Create jobs, invite candidates, evaluate dossiers, manage pipeline.</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-[#111215]">Admin / Superadmin</td>
                      <td className="py-2.5 px-4 font-mono text-[#8FB305]">/admin</td>
                      <td className="py-2.5 px-4 text-[#575A51]">Full platform oversight, cloud storage monitoring, rate-limit policies.</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-[#111215]">Candidate</td>
                      <td className="py-2.5 px-4 font-mono text-[#8FB305]">/candidate</td>
                      <td className="py-2.5 px-4 text-[#575A51]">View assigned interviews, launch practice simulators, track applications.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                <span className="text-[11px] font-mono text-[#73766C]">Route: /auth or /login</span>
                <Link to="/auth" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111215] hover:underline">
                  <span>Open Authentication Screen</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            </section>

            {/* ── CHAPTER 02: RECRUITER WORKSPACE ── */}
            <section id="dashboard" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">02</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Workspace Operations</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Recruiter Workspace & Dashboard Analytics</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono font-bold self-start sm:self-auto shrink-0">
                  /recruiter/jobs
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                The central control room provides instant visibility into all active hiring funnels. From this view, recruiters can launch new roles, monitor candidate response completion rates, manage team permissions, and check rate-limit credits.
              </p>

              {/* Navigation highlights */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#73766C]">Core Dashboard Controls:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <p className="text-xs font-bold text-[#111215] mb-1">Active Requisitions</p>
                    <p className="text-[11px] text-[#575A51]">Cards showcasing live openings, candidate counts, and direct interview links.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <p className="text-xs font-bold text-[#111215] mb-1">Team Access Panel</p>
                    <p className="text-[11px] text-[#575A51]">Invite co-recruiters and technical hiring managers with zero per-seat charges.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <p className="text-xs font-bold text-[#111215] mb-1">Live Notifications</p>
                    <p className="text-[11px] text-[#575A51]">Instant desktop audio/visual alerts as soon as a candidate finishes an interview.</p>
                  </div>
                </div>
              </div>

              {/* Credit & Rate Limits info */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FAFBF7] border border-[#E4E7DC] space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold text-[#111215]">
                  <span className="flex items-center gap-1.5">
                    <Zap className="size-3.5 text-[#8FB305]" />
                    <span>Company Rate Limits & Volume Credits</span>
                  </span>
                  <span className="font-mono text-[10px] text-[#8FB305] bg-[#D4F82C]/20 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto">
                    Automated Metering
                  </span>
                </div>
                <p className="text-[11px] text-[#575A51] leading-relaxed">
                  The dashboard displays your active interview quota and credit utilization in real time. If a monthly limit is approached, the system warns recruiters gracefully without interrupting active candidate interviews in progress.
                </p>
              </div>
            </section>

            {/* ── CHAPTER 03: JOB CREATION & AI JD PARSER ── */}
            <section id="job-creation" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">03</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Requisition Builder</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Job Creation & Deep AI Job Description Parsing</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D4F82C]/30 text-[#111215] border border-[#D4F82C] text-[10px] font-mono font-bold self-start sm:self-auto shrink-0">
                  /recruiter/interview/create
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                Rather than manually typing out job specs, InterviewXpert's generative JD-parser extracts requirements in seconds and configures automated screening questions.
              </p>

              {/* 3 Intake modes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl border border-[#E4E7DC] bg-[#FAFBF7]">
                  <span className="size-6 rounded-lg bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold flex items-center justify-center mb-2">A</span>
                  <h4 className="text-xs font-bold text-[#111215]">PDF / Word Upload</h4>
                  <p className="text-[11px] text-[#575A51] mt-1">Upload existing client `.pdf` or `.docx` job description files directly. The client-side parser uses PDF.js to preserve formatting.</p>
                </div>

                <div className="p-4 rounded-2xl border border-[#E4E7DC] bg-[#FAFBF7]">
                  <span className="size-6 rounded-lg bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold flex items-center justify-center mb-2">B</span>
                  <h4 className="text-xs font-bold text-[#111215]">Direct Text Paste</h4>
                  <p className="text-[11px] text-[#575A51] mt-1">Paste plain-text JD specs directly into the browser editor with zero loss of semantic context.</p>
                </div>

                <div className="p-4 rounded-2xl border border-[#E4E7DC] bg-[#FAFBF7]">
                  <span className="size-6 rounded-lg bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold flex items-center justify-center mb-2">C</span>
                  <h4 className="text-xs font-bold text-[#111215]">Job URL Ingestion</h4>
                  <p className="text-[11px] text-[#575A51] mt-1">Provide a public job board URL; the parser scrapes HTML, removes scripts/styles, and extracts core criteria.</p>
                </div>
              </div>

              {/* Full Field Breakdown */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#73766C]">Extracted & Configurable Form Fields:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <span className="font-bold text-[#111215]">Experience Bounds:</span>
                    <p className="text-[11px] text-[#575A51] mt-0.5">Separate sliders for <code className="font-mono">minExperience</code> and <code className="font-mono">maxExperience</code> (e.g. 3 to 7 years).</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <span className="font-bold text-[#111215]">Skills Extraction:</span>
                    <p className="text-[11px] text-[#575A51] mt-0.5">AI suggests contextual skill chips (e.g. React, Salesforce Flow, Apex) with 1-click addition.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <span className="font-bold text-[#111215]">Education Qualifications:</span>
                    <p className="text-[11px] text-[#575A51] mt-0.5">Degrees from allEducationDegrees (Graduate, Post-Graduate, Doctorate, Diploma) & specializations.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <span className="font-bold text-[#111215]">City & Location Resolution:</span>
                    <p className="text-[11px] text-[#575A51] mt-0.5">Strict autocomplete matching across Maharashtra and all major Indian tech hubs.</p>
                  </div>
                </div>
              </div>

              {/* Strict Filters Callout */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs space-y-1.5">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-amber-600" />
                  <span>Configuring Strict Hard-Matching Filters</span>
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Toggle <strong>Strict Location Match</strong>, <strong>Strict Degree Match</strong>, or <strong>Strict Experience Range</strong> to automatically disqualify candidates who do not meet non-negotiable requirements before they consume interview credits.
                </p>
              </div>
            </section>

            {/* ── CHAPTER 04: THE 3-IN-1 EVALUATION SUITE ── */}
            <section id="evaluation-suite" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">04</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Multi-Round Architecture</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Configuring the 3-in-1 Evaluation Suite</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-mono font-bold self-start sm:self-auto shrink-0">
                  Modular Rounds
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                InterviewXpert allows you to assemble an evaluation pipeline combining up to three complementary rounds. Candidates can take any combination, or all three in sequence:
              </p>

              {/* 3 Rounds in Detail */}
              <div className="space-y-3.5 sm:space-y-4">
                
                {/* Round 1 */}
                <div className="p-3.5 sm:p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2.5 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#111215] text-[#D4F82C] shrink-0">
                        <Video className="size-4" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-[#111215]">Round 1: Autonomous AI Video/Voice Interview (Core)</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#8FB305] self-start sm:self-auto shrink-0">₹149 → ₹129 / int</span>
                  </div>
                  <p className="text-xs text-[#575A51] leading-relaxed">
                    The candidate enters a virtual room with our conversational AI interviewer. The engine asks dynamic spoken questions, listens to spoken replies in real time, and conducts contextual cross-probing.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] pt-1">
                    <div className="p-2.5 bg-white rounded-xl border border-[#E4E7DC]">
                      <span className="font-bold text-[#111215] block">Adaptive Probing</span>
                      <span className="text-[#575A51] text-[10px]">Follows candidate answers dynamically instead of reading static lists.</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-[#E4E7DC]">
                      <span className="font-bold text-[#111215] block">Resume Probing</span>
                      <span className="text-[#575A51] text-[10px]">Cross-questions specific company projects listed on their uploaded CV.</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-[#E4E7DC]">
                      <span className="font-bold text-[#111215] block">Strictness Controls</span>
                      <span className="text-[#575A51] text-[10px]">Configurable Low, Medium, or High evaluation strictness levels.</span>
                    </div>
                  </div>
                </div>

                {/* Round 2 */}
                <div className="p-3.5 sm:p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2.5 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#111215] text-[#D4F82C] shrink-0">
                        <Brain className="size-4" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-[#111215]">Round 2: Domain MCQ & Aptitude Quiz (Add-on)</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#8FB305] self-start sm:self-auto shrink-0">+₹29 → +₹19 / cand</span>
                  </div>
                  <p className="text-xs text-[#575A51] leading-relaxed">
                    Configured via <code className="bg-white px-1.5 py-0.5 rounded border border-[#E4E7DC]">/recruiter/tests/create?type=aptitude</code>. Generates timed multiple-choice questions covering cognitive reasoning, CRM architecture, or domain-specific protocols with automated proctoring.
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-[#E4E7DC] text-[11px] space-y-1">
                    <span className="font-bold text-[#111215]">Automated Next-Round Chaining:</span>
                    <p className="text-[#575A51]">
                      Set a passing score (e.g. 70%). Candidates who pass the MCQ quiz can be automatically redirected to launch the AI Video Interview immediately without recruiter intervention.
                    </p>
                  </div>
                </div>

                {/* Round 3 */}
                <div className="p-3.5 sm:p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2.5 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#111215] text-[#D4F82C] shrink-0">
                        <Code2 className="size-4" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-[#111215]">Round 3: Live Cloud Coding IDE (Add-on)</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#8FB305] self-start sm:self-auto shrink-0">+₹49 → +₹39 / cand</span>
                  </div>
                  <p className="text-xs text-[#575A51] leading-relaxed">
                    Configured via <code className="bg-white px-1.5 py-0.5 rounded border border-[#E4E7DC]">/recruiter/tests/create?type=coding</code>. Candidates write live code inside an embedded Monaco IDE across 40+ languages (Python, JavaScript, SQL, Java, C++). Compiles and runs against custom unit test cases in isolated cloud sandboxes.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                    <div className="p-2.5 bg-white rounded-xl border border-[#E4E7DC]">
                      <span className="font-bold text-[#111215] block">Visible vs Hidden Test Cases</span>
                      <span className="text-[#575A51] text-[10px]">Sample test cases guide the candidate, while hidden test cases detect edge-case logic errors.</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-[#E4E7DC]">
                      <span className="font-bold text-[#111215] block">Sandbox Compiler Execution</span>
                      <span className="text-[#575A51] text-[10px]">Strict memory and execution timeout limits prevent infinite loops and malicious scripts.</span>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* ── CHAPTER 05: SOURCING & INVITING ── */}
            <section id="sourcing-invites" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">05</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Outbound Automation</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Candidate Sourcing & Multi-Channel Outreach</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold self-start sm:self-auto shrink-0">
                  Email + WhatsApp
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                Reaching candidates through their preferred channels ensures <strong>85%+ interview completion rates within 24 hours</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#111215]">
                    <MessageSquare className="size-4 text-emerald-600" />
                    <span>Automated WhatsApp Dispatch</span>
                  </div>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Interviews dispatch instant WhatsApp notifications with candidate name, company branding, and personalized 1-click interview launch links directly to their mobile devices via automated Baileys socket sessions.
                  </p>
                </div>

                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#111215]">
                    <Send className="size-4 text-blue-600" />
                    <span>Transactional Brevo Email</span>
                  </div>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Formal enterprise invitations with calendar .ics files, technical requirements, and expiry deadlines sent through high-deliverability dedicated SMTP servers.
                  </p>
                </div>
              </div>

              {/* Public Career Board info */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FAFBF7] border border-[#E4E7DC] space-y-1.5">
                <span className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                  <Globe className="size-3.5 text-[#8FB305]" />
                  <span>Public Career Board & Shareable Job Links (/jobs)</span>
                </span>
                <p className="text-[11px] text-[#575A51] leading-relaxed">
                  Every published requisition generates a public URL (<code className="font-mono bg-white px-1 rounded border border-[#E4E7DC]">/voice/:jobId</code> or <code className="font-mono bg-white px-1 rounded border border-[#E4E7DC]">/jobs</code>). Share this on LinkedIn, college placement WhatsApp groups, or your website. Inbound applicants can upload their resume and take the test immediately.
                </p>
              </div>
            </section>

            {/* ── CHAPTER 06: RESUME DUMP ── */}
            <section id="resume-dump" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">06</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Batch Ingestion</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">High-Volume Resume Dump & Match Scoring</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold self-start sm:self-auto shrink-0">
                  /recruiter/resume-dump
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                When recruiters receive hundreds of unorganized resumes from campus recruitment drives or agency submissions, the **Resume Dump** tool eliminates manual reading.
              </p>

              <div className="space-y-3">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2">
                  <h4 className="text-xs font-bold text-[#111215]">How the Bulk Parser Works:</h4>
                  <ol className="list-decimal pl-5 text-[11px] text-[#575A51] space-y-1.5">
                    <li>Drop up to **500 PDF or DOCX resumes** into the dropzone.</li>
                    <li>The parser runs client-side text extraction using `pdfjs-dist` and `mammoth`.</li>
                    <li>Skill signals, education history, and experience years are indexed.</li>
                    <li>The algorithm compares each profile against your target job requisition, calculating an **Alignment Score (0–100%)**.</li>
                    <li>Sort by highest match, filter out candidates below your cutoff, and click **"Send Bulk Invites"** to trigger WhatsApp and Email links in one click.</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* ── CHAPTER 07: CANDIDATE INTERVIEW EXPERIENCE ── */}
            <section id="candidate-experience" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">07</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Candidate Room</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Candidate Experience & Anti-Cheat Proctoring</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-mono font-bold self-start sm:self-auto shrink-0">
                  Zero Install
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                Candidates open their interview link directly in Chrome, Safari, Edge, or Firefox without downloading third-party software or browser extensions.
              </p>

              {/* Step progression */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] flex items-start gap-3">
                  <span className="size-6 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <h4 className="text-xs font-bold text-[#111215]">Hardware Diagnostics & Privacy Consent</h4>
                    <p className="text-[11px] text-[#575A51] mt-0.5">Camera and microphone sanity checks with visual volume level meters. Candidate accepts the transparent evaluation terms.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] flex items-start gap-3">
                  <span className="size-6 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <h4 className="text-xs font-bold text-[#111215]">Conversational 2-Way Spoken Interrogation</h4>
                    <p className="text-[11px] text-[#575A51] mt-0.5">The AI speaks technical questions naturally. Audio waveforms confirm real-time speech detection, while live transcripts record the conversation.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] flex items-start gap-3">
                  <span className="size-6 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <h4 className="text-xs font-bold text-[#111215]">Non-Invasive Anti-Cheat Telemetry</h4>
                    <p className="text-[11px] text-[#575A51] mt-0.5">Monitors tab switching, multiple faces in view, and audio latency anomalies without installing invasive desktop rootkits.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── CHAPTER 08: AUTOMATED EVALUATION & DOSSIERS ── */}
            <section id="automated-scoring" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">08</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Intelligence Dossier</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Automated Scoring & Candidate Dossiers</h2>
                  </div>
                </div>
                <span className="self-start sm:self-auto shrink-0 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                  Generated in 60s
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                As soon as the interview concludes, our private AWS Bedrock pipeline analyzes the session against your custom rubrics, generating a comprehensive dossier.
              </p>

              {/* Dossier Anatomy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215]">Radial Score Gauges</span>
                  <p className="text-[11px] text-[#575A51]">Scores for Overall Fit, Technical Depth, Problem Solving, and Communication Clarity.</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215]">Evidence-Based Rationale</span>
                  <p className="text-[11px] text-[#575A51]">Detailed explanations citing exact conversation excerpts explaining why each score was assigned.</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215]">Synchronized Transcript</span>
                  <p className="text-[11px] text-[#575A51]">Complete word-for-word conversation transcript with keyword search filtering.</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215]">Unedited HD Video Playback</span>
                  <p className="text-[11px] text-[#575A51]">Full session video and audio replay with question-by-question timeline markers.</p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="https://www.interviewxpert.in/report/an6z8aq1wme/vresp_1793198102129_6eb6d7d4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-bold shadow-xs hover:bg-black transition-all"
                >
                  <Eye className="size-3.5" />
                  <span>Inspect Real Live Candidate Report</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </section>

            {/* ── CHAPTER 09: RECRUITER REVIEW & SME OVERRIDE ── */}
            <section id="recruiter-review" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">09</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Pipeline & Governance</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Recruiter Review, SME Overrides & Kanban Pipeline</h2>
                  </div>
                </div>
                <span className="self-start sm:self-auto shrink-0 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono font-bold">
                  /recruiter/pipeline
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                InterviewXpert is designed around <strong>Human-in-the-Loop oversight</strong>. AI scores provide intelligent recommendations, but your internal SMEs and Hiring Managers retain final decision-making power.
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2">
                  <h4 className="text-xs font-bold text-[#111215]">How to Perform an SME Score Override:</h4>
                  <ol className="list-decimal pl-5 text-[11px] text-[#575A51] space-y-1">
                    <li>Open the candidate evaluation report.</li>
                    <li>Locate the <strong>SME Score Override</strong> slider.</li>
                    <li>Adjust the numerical score (e.g. modify from 70% to 85%).</li>
                    <li>Enter internal rationale in the reviewer notes box.</li>
                    <li>Click <strong>"Save SME Override"</strong>. An audit log permanently records the adjustment.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAFBF7] border border-[#E4E7DC] space-y-1.5">
                  <h4 className="text-xs font-bold text-[#111215]">Kanban Pipeline Stages (/recruiter/pipeline):</h4>
                  <p className="text-[11px] text-[#575A51]">
                    Drag candidate tiles across stages: <em>Applied → AI Interview Complete → Shortlisted → Client Review → Offer Extended</em>.
                  </p>
                </div>
              </div>
            </section>

            {/* ── CHAPTER 10: CLIENT PORTALS & ANTI-POACHING ── */}
            <section id="client-portals" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">10</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Shortlist Presentation</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Client Review Portals & Anti-Poaching Masking</h2>
                  </div>
                </div>
                <span className="self-start sm:self-auto shrink-0 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                  Anti-Poaching Protection
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                Agency recruiters and enterprise talent teams frequently need to share candidate shortlists with external clients, hiring managers, or department heads without exposing candidate contact info.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                    <Lock className="size-3.5 text-[#8FB305]" />
                    <span>Automatic PII Blind Masking</span>
                  </span>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Personal emails, phone numbers, and current compensation are automatically redacted. Clients see skills, scores, and unedited interview videos, but cannot bypass you to poach candidates.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                    <Clock className="size-3.5 text-[#8FB305]" />
                    <span>Tokenized Expiry Controls</span>
                  </span>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Set links to expire after 7, 14, or 30 days. External reviewers can leave thumbs-up/down feedback and schedule human final rounds with 1 click.
                  </p>
                </div>
              </div>
            </section>

            {/* ── CHAPTER 11: SECURITY & DPDP COMPLIANCE ── */}
            <section id="security-compliance" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">11</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Enterprise Governance</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Enterprise Security, DPDP Act & Data Sovereignty</h2>
                  </div>
                </div>
                <span className="self-start sm:self-auto shrink-0 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono font-bold">
                  AWS ap-south-1
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                InterviewXpert is engineered to satisfy the strictest compliance standards for Indian enterprise BFSI, IT Services, and global MNC recruitment operations.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                    <Server className="size-3.5 text-[#8FB305]" />
                    <span>India Data Residency (ap-south-1 Mumbai)</span>
                  </span>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    All AI inference and database operations are executed inside AWS Mumbai datacenters. Candidate data never leaves Indian national boundaries.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-[#8FB305]" />
                    <span>Zero Model Training Guarantee</span>
                  </span>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Under enterprise AWS Bedrock agreements, candidate audio, resumes, and evaluation transcripts are contractually prohibited from being used to train public LLMs.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                    <Lock className="size-3.5 text-[#8FB305]" />
                    <span>End-to-End Encryption</span>
                  </span>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    AES-256 encryption at rest for all database documents, resumes, and video files; TLS 1.3 encryption in transit for all APIs and WebRTC streams.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1.5">
                  <span className="text-xs font-bold text-[#111215] flex items-center gap-1.5">
                    <FileText className="size-3.5 text-[#8FB305]" />
                    <span>DPDP Act 2023 & GDPR Compliance</span>
                  </span>
                  <p className="text-[11px] text-[#575A51] leading-relaxed">
                    Explicit consent receipts logged prior to camera/mic activation, automated retention policies, and full Right to Erasure data purging.
                  </p>
                </div>
              </div>
            </section>

            {/* ── CHAPTER 12: ROUTE DIRECTORY ── */}
            <section id="route-directory" className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4E7DC] p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] font-mono text-xs font-black flex items-center justify-center shrink-0">12</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#73766C]">Navigation Directory</span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#111215] leading-snug">Platform Route & URL Quick Reference</h2>
                  </div>
                </div>
                <span className="self-start sm:self-auto shrink-0 px-2.5 py-0.5 rounded-full bg-neutral-100 text-[#111215] border border-[#E4E7DC] text-[10px] font-mono font-bold">
                  Cheat Sheet
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#E4E7DC] -mx-1 sm:mx-0 overscroll-x-contain">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead className="bg-[#FAFBF7] border-b border-[#E4E7DC] font-mono text-[11px] text-[#73766C]">
                    <tr>
                      <th className="py-2.5 px-3 sm:px-4 font-bold">Destination</th>
                      <th className="py-2.5 px-3 sm:px-4 font-bold">Route Path</th>
                      <th className="py-2.5 px-3 sm:px-4 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7DC] font-mono text-[11px]">
                    {[
                      { name: 'Authentication Login', path: '/auth', target: '/auth', desc: 'Login & Team Access' },
                      { name: 'Recruiter Jobs Workspace', path: '/recruiter/jobs', target: '/recruiter/jobs', desc: 'Main Requisitions Dashboard' },
                      { name: 'Job & AI Interview Creator', path: '/recruiter/interview/create', target: '/recruiter/interview/create', desc: 'Create Requisition & AI Rounds' },
                      { name: 'MCQ & Coding Test Builder', path: '/recruiter/tests/create', target: '/recruiter/tests/create', desc: 'Create MCQ & Code Assessment' },
                      { name: 'Kanban Candidate Pipeline', path: '/recruiter/pipeline', target: '/recruiter/pipeline', desc: 'Interactive Pipeline Board' },
                      { name: 'Bulk Resume Dump Parser', path: '/recruiter/resume-dump', target: '/recruiter/resume-dump', desc: 'Ingest & Match Resumes' },
                      { name: 'Candidate Invites Log', path: '/recruiter/invites', target: '/recruiter/invites', desc: 'Track WhatsApp & Emails' },
                      { name: 'Hot Leads Tracker', path: '/recruiter/hot-leads', target: '/recruiter/hot-leads', desc: 'High-Intent Applicants' },
                      { name: 'Candidate Career Portal', path: '/candidate', target: '/candidate', desc: 'Candidate Hub & Profile' },
                      { name: 'Public Job Career Board', path: '/jobs', target: '/jobs', desc: 'Public Job Listings' },
                      { name: 'Candidate Onboard (Resume Intake)', path: '/upload-resume', target: '/upload-resume', desc: 'Candidate Onboarding & Fast-Track Match' },
                      { name: 'Live Candidate Interview Room', path: '/interview/:id', target: '/interview/demo', desc: 'Candidate Test Room' },
                      { name: 'Verified Candidate Reviews', path: '/reviews', target: '/reviews', desc: 'Candidate Wall of Love' },
                      { name: 'Candidate Review Form', path: '/submit-review', target: '/submit-review', desc: 'Submit Feedback' },
                      { name: 'Platform Guide & SOP', path: '/guide', target: '/guide', desc: 'Complete Manual' },
                      { name: 'Admin Control Center', path: '/admin', target: '/admin', desc: 'System Administration' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-[#FAFBF7] transition-colors">
                        <td className="py-2.5 px-3 sm:px-4 font-bold text-[#111215] font-sans">
                          <div className="flex flex-col">
                            <span>{row.name}</span>
                            <span className="text-[10px] text-[#73766C] font-normal">{row.desc}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 font-mono font-bold">
                          <Link
                            to={row.target}
                            className="inline-flex items-center gap-1.5 text-[#8FB305] hover:text-[#729104] hover:underline font-bold transition-colors group"
                            title={`Directly open ${row.path}`}
                          >
                            <span>{row.path}</span>
                            <ExternalLink className="size-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 sm:px-4">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={row.target}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded bg-[#111215] text-[#D4F82C] hover:bg-black transition-all shadow-2xs whitespace-nowrap active:scale-95"
                            >
                              <span>Direct Go</span>
                              <ArrowRight className="size-2.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleCopy(row.path, row.path)}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-white border border-[#E4E7DC] hover:border-black text-[#575A51] cursor-pointer whitespace-nowrap active:scale-95"
                            >
                              {copiedKey === row.path ? (
                                <>
                                  <Check className="size-2.5 text-emerald-600" />
                                  <span className="text-emerald-700 font-bold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-2.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Enterprise Support & Calibration Assistance Banner ── */}
            <section className="bg-gradient-to-r from-[#111215] via-[#1a1c22] to-[#111215] rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white border border-white/10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
              <div className="space-y-1.5 text-center md:text-left">
                <span className="text-[10px] font-mono font-bold text-[#D4F82C] uppercase tracking-wider">Direct Engineering & SME Support</span>
                <h3 className="text-lg sm:text-2xl font-black">Need Assisted Setup or Enterprise Rubric Calibration?</h3>
                <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
                  Our solutions and evaluation team is available to assist you with onboarding, custom ATS webhook integrations, question bank authoring, or dedicated role configuration.
                </p>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 shrink-0">
                <a
                  href="tel:+919511779317"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-black hover:bg-[#c2e820] shadow-md transition-all active:scale-95"
                >
                  <Phone className="size-3.5 text-[#111215]" />
                  <span>Call +91 95117 79317</span>
                </a>
                <a
                  href="mailto:hello@snab.co.in"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all active:scale-95"
                >
                  <Mail className="size-3.5 text-[#D4F82C]" />
                  <span>hello@snab.co.in</span>
                </a>
              </div>
            </section>

          </main>
        </div>
      </div>

      {/* ── Signature Landing Page Mega Footer ── */}
      <footer className="relative z-[95] w-full bg-[#F8F9F5] border-t border-[#E4E7DC] text-[#111215] overflow-hidden mt-16">
        {/* Subtle Ambient Organic Lime Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-64 bg-[#D4F82C]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-14 sm:pt-16 pb-12 relative z-10">
          
          {/* Main 5-Column Navigation & Trust Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 sm:gap-10 pb-12 sm:pb-16 border-b border-[#E4E7DC]">
            
            {/* Col 1: Brand & Enterprise Trust Architecture (2 cols on large) */}
            <div className="sm:col-span-2 lg:col-span-2 space-y-4">
              <div className="mb-2">
                <Link to="/" className="inline-block" title="InterviewXpert Home">
                  <HireXLogo size="md" variant="full" isDark={false} />
                </Link>
              </div>
              <p className="text-xs text-[#575A51] leading-relaxed max-w-sm">
                The modern AI recruitment operating system. Replacing repetitive busywork with intelligent candidate matching, anti-poaching client shortlists, and automated WhatsApp outreach.
              </p>

              {/* Legally Verified Compliance Badges */}
              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C]">
                  Trust & Regulatory Governance
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-[#E4E7DC] text-[#111215] shadow-2xs hover:border-[#8FB305] transition-colors">
                    <Building2 size={13} className="text-[#8FB305]" />
                    <span>MCA Registered Entity</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-[#E4E7DC] text-[#111215] shadow-2xs hover:border-[#8FB305] transition-colors">
                    <ShieldCheck size={13} className="text-[#8FB305]" />
                    <span>DPDP Act 2023 Aligned</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-[#E4E7DC] text-[#111215] shadow-2xs hover:border-[#8FB305] transition-colors">
                    <Lock size={13} className="text-[#8FB305]" />
                    <span>TLS 256-Bit Encrypted</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-[#E4E7DC] text-[#111215] shadow-2xs hover:border-[#8FB305] transition-colors">
                    <Eye size={13} className="text-[#8FB305]" />
                    <span>Anti-Poaching Data Masking</span>
                  </span>
                </div>
              </div>

              {/* Real-time System Status Pill */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E4E7DC] text-[11px] font-bold text-[#111215] shadow-2xs">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>All Platform Systems Operational</span>
                  <span className="text-[#73766C] font-normal">• 99.98% Uptime</span>
                </div>
              </div>
            </div>

            {/* Col 2: Product & AI Modules */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Kanban size={13} className="text-[#8FB305]" />
                <span>Product</span>
              </div>
              <ul className="space-y-2 text-[#73766C]">
                <li><a href="/#pipeline" className="hover:text-[#111215] transition-colors">Visual Kanban Pipeline</a></li>
                <li><a href="/#resume-matching" className="hover:text-[#111215] transition-colors">AI Resume Match Scoring</a></li>
                <li><a href="/#client-portal" className="hover:text-[#111215] transition-colors">Client Shortlist Portal</a></li>
                <li><a href="/#productivity" className="hover:text-[#111215] transition-colors">Automated WhatsApp Outreach</a></li>
                <li><a href="/#productivity" className="hover:text-[#111215] transition-colors">AI Voice Phone Screening</a></li>
                <li><a href="/#productivity" className="hover:text-[#111215] transition-colors">Anti-Poaching Data Masking</a></li>
                <li><a href="/#productivity" className="hover:text-[#111215] transition-colors">AI Job Spec & Ads Creator</a></li>
              </ul>
            </div>

            {/* Col 3: Direct Portals & Gateways */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <User size={13} className="text-[#8FB305]" />
                <span>Portals</span>
              </div>
              <ul className="space-y-2 text-[#73766C]">
                <li><Link to="/candidate" className="hover:text-[#111215] transition-colors font-medium text-[#111215] flex items-center gap-1"><span>Candidate Career Portal</span><span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#D4F82C] text-[#111215] font-bold">New</span></Link></li>
                <li><a href="/#reviews" className="hover:text-[#111215] transition-colors font-medium">Candidate Wall of Love</a></li>
                <li><Link to="/reviews" className="hover:text-[#111215] transition-colors font-medium">Verified Reviews Hub</Link></li>
                <li><Link to="/auth" className="hover:text-[#111215] transition-colors font-medium">Recruiter & ATS Login</Link></li>
                <li><a href="/#client-portal" className="hover:text-[#111215] transition-colors">Client Review Gateway</a></li>
                <li><Link to="/active-jobs" className="hover:text-[#111215] transition-colors">Public Job Board</Link></li>
                <li><Link to="/guide" className="hover:text-[#111215] transition-colors font-bold text-[#8FB305]">Platform Guide & SOP</Link></li>
                <li><a href="https://wa.me/919511779317?text=Hi%20InterviewXpert%20team,%20I%20would%20like%20to%20know%20more%20about%20the%20platform%20and%20request%20a%20demo." target="_blank" rel="noopener noreferrer" className="hover:text-[#111215] transition-colors text-emerald-700 font-bold">Start 30-Day Free Trial ↗</a></li>
              </ul>
            </div>

            {/* Col 4: Solutions & Staffing Models */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Briefcase size={13} className="text-[#8FB305]" />
                <span>Solutions</span>
              </div>
              <ul className="space-y-2 text-[#73766C]">
                <li><a href="/#pricing" className="hover:text-[#111215] transition-colors">For Recruitment Agencies</a></li>
                <li><a href="/#pricing" className="hover:text-[#111215] transition-colors">For In-House Talent Teams</a></li>
                <li><a href="/#pricing" className="hover:text-[#111215] transition-colors">For Fast-Growing Startups</a></li>
                <li><a href="/#productivity" className="hover:text-[#111215] transition-colors">Hours Returned Calculator</a></li>
                <li><a href="/#pricing" className="hover:text-[#111215] transition-colors">Pricing & ROI Estimator</a></li>
                <li><a href="/#faq" className="hover:text-[#111215] transition-colors">Frequently Asked Questions</a></li>
              </ul>
            </div>

            {/* Col 5: Governance & Direct Contact */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Building2 size={13} className="text-[#8FB305]" />
                <span>Contact & Trust</span>
              </div>
              <ul className="space-y-2 text-[#73766C]">
                <li>
                  <a href="tel:+919511779317" className="hover:text-[#111215] transition-colors flex items-center gap-1.5 font-bold text-[#111215]">
                    <Phone size={12} className="text-[#8FB305]" />
                    <span>Call: +91 95117 79317</span>
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@snab.co.in" className="hover:text-[#111215] transition-colors flex items-center gap-1.5 font-medium text-[#111215]">
                    <Mail size={12} className="text-[#8FB305]" />
                    <span>hello@snab.co.in</span>
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/919511779317?text=Hi%20InterviewXpert%20team,%20I%20would%20like%20to%20know%20more%20about%20the%20platform%20and%20request%20a%20demo." target="_blank" rel="noopener noreferrer" className="hover:text-[#111215] transition-colors flex items-center gap-1.5 text-emerald-700 font-bold">
                    <MessageCircle size={12} />
                    <span>WhatsApp (+91 95117 79317)</span>
                  </a>
                </li>
                <li>
                  <a href="https://snab.co.in" target="_blank" rel="noopener noreferrer" className="hover:text-[#111215] transition-colors">
                    About SNAB Technologies
                  </a>
                </li>
              </ul>

              {/* Headquarters Bento Chip */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E4E7DC] space-y-1 shadow-2xs mt-3">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C]">
                  Corporate Office
                </div>
                <div className="font-bold text-xs text-[#111215]">
                  SNAB Innovation LLP
                </div>
                <div className="text-[11px] text-[#575A51] leading-snug">
                  Nashik, Maharashtra, India
                </div>
              </div>
            </div>

          </div>

          {/* Giant Typographic Wordmark with hover glow */}
          <div className="py-6 sm:py-8 border-b border-[#E4E7DC] select-none overflow-hidden">
            <div className="text-[clamp(1.75rem,7vw,6.8rem)] font-black tracking-tight leading-none text-[#111215] flex items-center justify-between group cursor-default w-full">
              <span className="whitespace-nowrap">InterviewXpert</span>
              <span className="text-[#8FB305] ml-2 sm:ml-4 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-300">↗</span>
            </div>
          </div>

          {/* Copyright & Legal Compliance Bar */}
          <div className="pt-6 sm:pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-[#73766C] gap-4">
            <div className="flex flex-wrap items-center gap-2 text-center md:text-left">
              <span>© {new Date().getFullYear()} SNAB Innovation LLP. All rights reserved.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
              <Link to="/guide" className="px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] border border-[#111215] hover:bg-black transition-all shadow-2xs font-bold">
                Platform Guide & SOP
              </Link>
              <Link to="/privacy-policy" className="px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[#575A51] hover:text-[#111215] hover:border-[#111215] transition-all shadow-2xs">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[#575A51] hover:text-[#111215] hover:border-[#111215] transition-all shadow-2xs">
                Terms of Service
              </Link>
              <Link to="/candidate-data-charter" className="px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[#575A51] hover:text-[#111215] hover:border-[#111215] transition-all shadow-2xs">
                Candidate Data Charter
              </Link>
              <Link to="/security-whitepaper" className="px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[#575A51] hover:text-[#111215] hover:border-[#111215] transition-all shadow-2xs">
                Security Whitepaper
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Mobile Floating Back-to-Top Button ── */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-5 right-4 sm:right-6 z-40 size-10 sm:size-11 rounded-full bg-[#111215] text-[#D4F82C] border border-white/20 shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        aria-label="Back to top"
        title="Scroll to top"
      >
        <span className="text-sm sm:text-base font-black group-hover:-translate-y-0.5 transition-transform">↑</span>
      </button>

    </div>
  );
}
