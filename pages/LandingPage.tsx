import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Briefcase,
  Play,
  LayoutDashboard,
  Sun,
  Moon,
  Calendar,
  Menu,
  X,
  Phone,
  Mail,
  Building2,
  Lock,
  Eye,
  Rocket,
  CheckCheck,
  ExternalLink,
  Bot
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

// ── Time Saved Table Data ──
const TIME_SAVED_ROWS = [
  {
    task: 'Create a job post',
    traditional: '30 min',
    hirex: 'Seconds (AI-generated)',
    saved: '~30 min',
  },
  {
    task: 'Screen 100 resumes',
    traditional: '5 hrs',
    hirex: '10 min (AI scoring)',
    saved: '~4.5 hrs',
  },
  {
    task: 'Write candidate ads',
    traditional: '45 min',
    hirex: '1 min (AI-generated)',
    saved: '~44 min',
  },
  {
    task: 'Candidate follow-ups',
    traditional: '3 hrs',
    hirex: 'Automatic WhatsApp alerts',
    saved: '~3 hrs',
  },
];

// ── Capability Matrix Data ──
const CAPABILITY_ROWS = [
  {
    capability: 'Resume screening',
    traditional: 'Manual reading line-by-line',
    hirex: 'Instant AI scoring against JD',
  },
  {
    capability: 'Candidate alerts',
    traditional: 'Email only, often delayed',
    hirex: 'Built-in WhatsApp and email alerts',
  },
  {
    capability: 'Job recommendations',
    traditional: 'Keyword search & browse',
    hirex: 'AI-personalised candidate match picks',
  },
  {
    capability: 'Finding top talent',
    traditional: 'Rigid filters & keyword search',
    hirex: 'Top 1% surfaced in seconds',
  },
];

// ── Mockup Candidates Data ──
const MOCKUP_CANDIDATES = [
  {
    name: 'Aarav Sharma',
    role: 'Full Stack Developer',
    score: 98,
    skills: 'React, Node.js, MongoDB',
    status: 'Shortlisted',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Priya Nair',
    role: 'Frontend Developer',
    score: 94,
    skills: 'React, TypeScript, Tailwind',
    status: 'Interview',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Rohan Mehta',
    role: 'Backend Developer',
    score: 91,
    skills: 'Node.js, Python, AWS',
    status: 'Review',
    statusColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Sneha Reddy',
    role: 'DevOps Engineer',
    score: 87,
    skills: 'AWS, Docker, Kubernetes',
    status: 'Contacted',
    statusColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
  },
];

export default function LandingPage() {
  const { isDark, toggleTheme } = useTheme();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  // Client Presentation Form State
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    hiringVolume: '1-5 roles / month',
  });
  const [submittingLead, setSubmittingLead] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const dashboardPath = userProfile?.role === 'admin' ? '/admin' : '/recruiter/jobs';

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileMenuOpen(false);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.phone) return;

    setSubmittingLead(true);
    try {
      await addDoc(collection(db, 'clientPresentations'), {
        ...leadForm,
        createdAt: serverTimestamp(),
        source: 'Landing Page Client Presentation',
        status: 'new',
      });
      setLeadSubmitted(true);
    } catch (err) {
      console.error('Error booking presentation:', err);
      setLeadSubmitted(true);
    } finally {
      setSubmittingLead(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-[#07090e] text-slate-900 dark:text-[#ededed] font-sans selection:bg-indigo-500/20 selection:text-indigo-700 dark:selection:text-indigo-300 transition-colors duration-200">
      
      {/* ── 1. Top Navbar (Identical to Reference Image) ── */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#07090e]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08] px-4 sm:px-6 lg:px-12 transition-colors">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <Logo className="h-8 w-auto object-contain" isDark={isDark} />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#pitch"
              onClick={(e) => scrollToSection(e, 'pitch')}
              className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              Why HireX
            </a>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, 'workflow')}
              className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              How It Works
            </a>
            <a
              href="#time-saved"
              onClick={(e) => scrollToSection(e, 'time-saved')}
              className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              Time Saved
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              Pricing
            </a>
            <a
              href="#comparison"
              onClick={(e) => scrollToSection(e, 'comparison')}
              className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              Comparison
            </a>
            <Link
              to="/active-jobs"
              className="hover:text-indigo-600 dark:hover:text-white transition-colors"
            >
              Job Board
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="size-8.5 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-white/[0.04] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-700" />}
            </button>

            {user ? (
              <Link
                to={dashboardPath}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-900 dark:bg-white px-4 text-xs font-semibold text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs"
              >
                <LayoutDashboard className="size-3.5" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="hidden sm:inline-flex h-9 items-center px-4 rounded-full border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-500/10 hover:bg-indigo-100/70 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                >
                  Book Presentation
                </button>
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center px-4 rounded-full bg-[#0b101b] dark:bg-white text-xs font-semibold text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden size-9 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-white/[0.04] flex items-center justify-center text-slate-700 dark:text-slate-300"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-white/[0.08] py-4 px-3 space-y-2 bg-white/95 dark:bg-[#07090e]/95 backdrop-blur-md">
            <a
              href="#pitch"
              onClick={(e) => scrollToSection(e, 'pitch')}
              className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Why HireX
            </a>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, 'workflow')}
              className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              How It Works
            </a>
            <a
              href="#time-saved"
              onClick={(e) => scrollToSection(e, 'time-saved')}
              className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Time Saved
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Pricing
            </a>
            <a
              href="#comparison"
              onClick={(e) => scrollToSection(e, 'comparison')}
              className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Comparison
            </a>
            <Link
              to="/active-jobs"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Job Board
            </Link>
            <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setBookingModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 border border-indigo-200 dark:border-indigo-500/30"
              >
                Book Presentation
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section: Left Text + Right Floating ATS Mockup ── */}
      <section className="relative pt-12 pb-16 lg:pt-16 lg:pb-24 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto overflow-hidden">
        
        {/* Soft background glow */}
        <div className="absolute top-1/4 right-10 -z-10 w-[550px] h-[550px] bg-gradient-to-br from-indigo-200/40 via-purple-100/30 to-blue-200/20 dark:from-indigo-900/20 dark:via-purple-900/10 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Column */}
          <div className="lg:col-span-5 text-left">
            
            {/* Tag Pill */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-5 border border-indigo-100 dark:border-indigo-800/60 shadow-xs">
              HireX Snab ATS
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              The{' '}
              <span className="text-[#4338ca] dark:text-[#818cf8]">AI-Powered ATS</span>{' '}
              That Does the Busywork for Your Recruiters
            </h1>

            {/* Sub-headline */}
            <h2 className="mt-4 text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
              Hire smarter. Hire faster.
            </h2>

            {/* Paragraph */}
            <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
              The AI-powered ATS that does the heavy lifting for your recruiters. Score resumes instantly, create jobs and ads in seconds, and reach candidates where they reply fastest with built-in WhatsApp.
            </p>

            {/* CTA Buttons */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4338ca] hover:bg-[#3730a3] text-white px-5 text-xs font-bold transition-all shadow-md shadow-indigo-600/20 hover:scale-[1.01] cursor-pointer"
              >
                <span>Book Client Presentation</span>
                <ArrowRight className="size-4" />
              </button>
              <Link
                to="/active-jobs"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.04] text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/[0.08] px-5 text-xs font-bold transition-all shadow-xs"
              >
                <Play className="size-3.5 fill-current text-slate-500 dark:text-slate-300" />
                <span>Explore Live Platform</span>
              </Link>
            </div>

            {/* Live Domain Info */}
            <div className="mt-6 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>See it live:</span>
              <a
                href="https://hirex-snab.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
              >
                hirex-snab.vercel.app
              </a>
            </div>
          </div>

          {/* Right Hero Column: Pixel-Accurate ATS UI Mockup Card with Floating Elements */}
          <div className="lg:col-span-7 relative">
            
            {/* The Main Laptop/Browser UI Container */}
            <div className="relative rounded-2xl bg-white dark:bg-[#0e1320] border border-slate-200/90 dark:border-white/10 shadow-2xl shadow-indigo-500/10 overflow-hidden">
              
              {/* Window Header / Search */}
              <div className="h-11 px-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#121829] flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-rose-400" />
                  <div className="size-2.5 rounded-full bg-amber-400" />
                  <div className="size-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="w-64 h-6.5 rounded-md bg-white dark:bg-[#1a2236] border border-slate-200 dark:border-white/[0.08] px-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>🔍 Search candidates, jobs...</span>
                </div>
                <div className="size-6 rounded-full bg-slate-200 dark:bg-white/10" />
              </div>

              {/* Window Body: Sidebar + Candidates Table */}
              <div className="flex min-h-[350px]">
                
                {/* Mini Sidebar */}
                <div className="w-36 border-r border-slate-200 dark:border-white/[0.08] bg-[#0d1322] text-slate-300 p-3 flex flex-col justify-between hidden sm:flex">
                  <div className="space-y-4">
                    <div className="font-extrabold text-[12px] text-white flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-indigo-500" />
                      SNAB hireX
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="px-2 py-1.5 rounded-md bg-white/10 text-white font-semibold flex items-center gap-2">
                        <LayoutDashboard className="size-3" /> Dashboard
                      </div>
                      <div className="px-2 py-1.5 rounded-md hover:bg-white/5 text-slate-400 flex items-center gap-2">
                        <Briefcase className="size-3" /> Jobs
                      </div>
                      <div className="px-2 py-1.5 rounded-md hover:bg-white/5 text-slate-400 flex items-center gap-2">
                        <Users className="size-3" /> Candidates
                      </div>
                      <div className="px-2 py-1.5 rounded-md hover:bg-white/5 text-slate-400 flex items-center gap-2">
                        <MessageCircle className="size-3" /> Messages
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500">v2.4 Production</div>
                </div>

                {/* Candidate List Content Area */}
                <div className="flex-1 p-4 bg-white dark:bg-[#0e1320] overflow-x-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">Top Candidates</h3>
                      <p className="text-[10px] text-slate-500">Ranked by Claude 3.5 Sonnet fit score</p>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                      4 Filtered
                    </span>
                  </div>

                  {/* Table */}
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/[0.06] text-[10px] text-slate-400 uppercase">
                        <th className="pb-2 font-medium">Candidate</th>
                        <th className="pb-2 font-medium">Match</th>
                        <th className="pb-2 font-medium hidden md:table-cell">Skills</th>
                        <th className="pb-2 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {MOCKUP_CANDIDATES.map((cand, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <img
                                src={cand.avatar}
                                alt={cand.name}
                                className="size-6 rounded-full object-cover border border-slate-200 dark:border-white/10"
                              />
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">{cand.name}</div>
                                <div className="text-[9px] text-slate-400">{cand.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {cand.score}%
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400 text-[10px] hidden md:table-cell">
                            {cand.skills}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${cand.statusColor}`}>
                              {cand.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Floating Badge 1: Radial AI Resume Score (Bottom Left) ── */}
            <div className="absolute -bottom-6 -left-4 sm:left-4 bg-white dark:bg-[#151c2e] border border-slate-200 dark:border-white/15 rounded-2xl p-3 shadow-xl flex items-center gap-3 backdrop-blur-md">
              <div className="relative size-12 flex items-center justify-center">
                <svg className="size-12 -rotate-90">
                  <circle cx="24" cy="24" r="20" className="stroke-slate-100 dark:stroke-white/10" strokeWidth="4" fill="transparent" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    className="stroke-indigo-600 dark:stroke-indigo-400"
                    strokeWidth="4"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 * (1 - 0.98)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-[11px] font-black text-slate-900 dark:text-white">98%</span>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">AI Resume Score</div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Deep Match Analysis</div>
              </div>
            </div>

            {/* ── Floating Badge 2: WhatsApp Chat Bubble (Top Right) ── */}
            <div className="absolute -top-6 -right-2 sm:-right-4 bg-white dark:bg-[#151c2e] border border-slate-200 dark:border-white/15 rounded-2xl p-3 shadow-xl max-w-[210px] backdrop-blur-md">
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>WhatsApp Outreach</span>
              </div>
              <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-snug">
                "Hi! You're a great fit for the Frontend role at SNAB. Can we schedule a chat?"
              </p>
              <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
                <span>10:24 AM</span>
                <CheckCheck className="size-3 text-sky-500" />
              </div>
            </div>

            {/* ── Floating Badge 3: Job Post in 3 Seconds (Bottom Right) ── */}
            <div className="absolute -bottom-8 right-6 hidden sm:flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl px-3.5 py-2 shadow-lg shadow-orange-500/20 text-xs font-bold">
              <Zap className="size-4 fill-white" />
              <div>
                <div className="text-[9px] uppercase tracking-wider text-amber-100 font-medium">Generated</div>
                <div>Job Post Created in 3s</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Four Metrics Horizontal Bar (Identical to Reference Image) ── */}
        <div className="mt-16 pt-8 border-t border-slate-200/80 dark:border-white/[0.08]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            
            {/* Metric 1 */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] shadow-xs">
              <div className="size-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileText className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">20,000+</div>
                <div className="text-[11px] text-slate-500">Resumes Stored</div>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] shadow-xs">
              <div className="size-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Zap className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">25 GB</div>
                <div className="text-[11px] text-slate-500">Storage, Extendable</div>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] shadow-xs">
              <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">92%+</div>
                <div className="text-[11px] text-slate-500">WhatsApp Open Rate</div>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] shadow-xs">
              <div className="size-10 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">1-Click</div>
                <div className="text-[11px] text-slate-500">White Resume Mask</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Section: WHY RECRUITERS SWITCH ── */}
      <section id="pitch" className="py-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-white/[0.08]">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Section Left Title */}
          <div className="lg:col-span-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Why Recruiters Switch
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
              Traditional ATS Creates Work.{' '}
              <span className="text-[#4338ca] dark:text-[#818cf8]">HireX Snab</span> Does It.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
              See why legacy recruiting software slows hiring teams down, and how HireX Snab automates the repetitive busywork.
            </p>
          </div>

          {/* Section Right 2 Comparison Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Card 1: Traditional ATS tools create work (Red Theme) */}
            <div className="rounded-2xl p-5 bg-[#fff8f8] dark:bg-[#180e12] border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <FileText className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Traditional ATS tools</h3>
                    <div className="text-[10px] text-slate-500">create work</div>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
                  Legacy Flow
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4">Manual, slow, and fragmented</p>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <XCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Manual screening</div>
                    <div className="text-[11px] text-slate-500">5+ hours lost per opening</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <XCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Slow follow-ups</div>
                    <div className="text-[11px] text-slate-500">Days or weeks of waiting</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <XCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Missed talent</div>
                    <div className="text-[11px] text-slate-500">Good fits get buried in the pile</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: HireX Snab ATS (Green/Cyan Theme) */}
            <div className="rounded-2xl p-5 bg-[#f4fbf7] dark:bg-[#0c1815] border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Rocket className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">HireX Snab ATS</h3>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">AI does the heavy lifting</div>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  Automated
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4">Autonomous intelligence</p>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Automated AI resume scoring</div>
                    <div className="text-[11px] text-slate-500">Deep Claude 3.5 Sonnet analysis</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Best-candidate suggestions</div>
                    <div className="text-[11px] text-slate-500">Top matches surface first</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Personalised job picks</div>
                    <div className="text-[11px] text-slate-500">80% less irrelevant applications</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. Section: END-TO-END PIPELINE (4 Step Flow) ── */}
      <section id="workflow" className="py-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-white/[0.08]">
        
        {/* Header */}
        <div className="text-left mb-10 max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            End-To-End Pipeline
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            From Application to Offer, Automated
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Four seamless stages that cut average time-to-hire from 38 days to under 7 days.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Step 1 */}
          <div className="rounded-2xl p-5 bg-[#f4f8fe] dark:bg-[#0c1424] border border-blue-200/80 dark:border-blue-900/40 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                <span className="size-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <FileText className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Multi-Channel Ingestion</h3>
              <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-2">Apply</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Candidates apply via mobile portal, job board or bulk-import via AWS S3.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-blue-100 dark:border-blue-900/40 text-[9px] font-bold text-blue-700 dark:text-blue-400">
              Step 1 of 4
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl p-5 bg-[#f9f5ff] dark:bg-[#150e24] border border-purple-200/80 dark:border-purple-900/40 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                <span className="size-7 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300">
                  <Brain className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Instant 0–100% Fit Score</h3>
              <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mb-2">Score</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                AWS Bedrock Claude 3.5 Sonnet ranks every resume in 3.2 seconds.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-purple-100 dark:border-purple-900/40 text-[9px] font-bold text-purple-700 dark:text-purple-400">
              Step 2 of 4
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl p-5 bg-[#f4fbf7] dark:bg-[#0c1815] border border-emerald-200/80 dark:border-emerald-900/40 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">3</span>
                <span className="size-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                  <MessageCircle className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">92% Open Rate</h3>
              <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Notify & Screen</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                WhatsApp & email alerts in &lt;15 mins. 24/7 AI voice screens top applicants.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
              Step 3 of 4
            </div>
          </div>

          {/* Step 4 */}
          <div className="rounded-2xl p-5 bg-[#fffaf4] dark:bg-[#1a1309] border border-amber-200/80 dark:border-amber-900/40 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">4</span>
                <span className="size-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-300">
                  <Users className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">5.2x Faster Velocity</h3>
              <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-2">Hire</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Masked resumes, unbiased confidence, extend offers.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-amber-100 dark:border-amber-900/40 text-[9px] font-bold text-amber-700 dark:text-amber-400">
              Step 4 of 4
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. Section: CORE PLATFORM PILLARS ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-white/[0.08]">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Title */}
          <div className="lg:col-span-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Core Platform Pillars
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
              Built-In AI, Built-In WhatsApp, Built-In Privacy
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
              Everything your talent acquisition team needs included natively — no external subscriptions, no Zapier integrations.
            </p>
          </div>

          {/* Right 3 Pillars Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Pillar 1 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
              <div className="size-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3">
                <Sparkles className="size-4" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Creation Engine
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-1 mb-3">
                AI creates jobs and ads in seconds.
              </h3>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-indigo-500" />
                  <span>AI job creation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-indigo-500" />
                  <span>AI candidate ads</span>
                </div>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
              <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <MessageCircle className="size-4" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Candidate Outreach
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-1 mb-3">
                Built-in WhatsApp and email alerts.
              </h3>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>92%+ open rates</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Automatic updates</span>
                </div>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
              <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                <ShieldCheck className="size-4" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Security & Bias Control
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-1 mb-3">
                Privacy and control built in.
              </h3>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-blue-500" />
                  <span>Resume masking (white)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-blue-500" />
                  <span>Role-based logins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-blue-500" />
                  <span>Admin-monitored logs</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 7. Section: TIME SAVED WITH HIREX SNAB + ROI CARD + PHOTO ── */}
      <section id="time-saved" className="py-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-white/[0.08]">
        
        {/* Header */}
        <div className="text-left mb-8 max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Hours Returned to Your Recruiters
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Time Saved with HireX Snab
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Estimates per hiring round, based on typical manual recruiter effort.
          </p>
        </div>

        {/* Content: Left Table + Right ROI & Photo Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Time Saved Table */}
          <div className="lg:col-span-7 overflow-x-auto">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Task</th>
                    <th className="py-3 px-4 font-semibold">Traditional ATS</th>
                    <th className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">HireX Snab</th>
                    <th className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 text-right">Time Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {TIME_SAVED_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{row.task}</td>
                      <td className="py-3.5 px-4 text-slate-500">{row.traditional}</td>
                      <td className="py-3.5 px-4 font-semibold text-indigo-600 dark:text-indigo-400">{row.hirex}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 text-right">{row.saved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: ROI Metrics + Recruiter Photo (Exact match to Reference Image) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl p-5 bg-[#f4f7fc] dark:bg-[#0d1424] border border-slate-200/90 dark:border-white/10 shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center gap-5">
              
              {/* ROI Numbers */}
              <div className="space-y-3.5 flex-1 w-full">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                    <Briefcase className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-900 dark:text-white">6</div>
                    <div className="text-[10px] text-slate-500">Monthly Open Roles</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-900 dark:text-white">200</div>
                    <div className="text-[10px] text-slate-500">Applicants Per Opening</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-900 dark:text-white">420 hrs</div>
                    <div className="text-[10px] text-slate-500">Hours Saved / Mo</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400">₹2.73 Lakhs</div>
                    <div className="text-[10px] text-slate-500">Cost Saved Monthly</div>
                  </div>
                </div>
              </div>

              {/* Photo with Handwritten Tag */}
              <div className="relative w-full sm:w-48 shrink-0">
                <div className="absolute -top-3 left-2 z-10 font-serif italic text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded-full shadow-xs">
                  More time for what matters
                </div>
                <img
                  src="/recruiter_hero.jpg"
                  alt="Recruiter working efficiently"
                  className="w-full h-44 object-cover rounded-xl border border-slate-200 dark:border-white/10 shadow-sm"
                />
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 8. Section: HEAD-TO-HEAD CAPABILITIES & CTA BANNER ── */}
      <section id="comparison" className="py-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-white/[0.08]">
        
        {/* Header */}
        <div className="text-left mb-8 max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Head-To-Head Capabilities
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            HireX Snab vs Traditional ATS
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Direct side-by-side capability evaluation for talent teams and enterprise leadership.
          </p>
        </div>

        {/* Grid: Left Matrix Table + Right CTA Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Capability Matrix */}
          <div className="lg:col-span-7 overflow-x-auto">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Capability</th>
                    <th className="py-3 px-4 font-semibold">Traditional ATS</th>
                    <th className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">HireX Snab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {CAPABILITY_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{row.capability}</td>
                      <td className="py-3.5 px-4 text-slate-500">{row.traditional}</td>
                      <td className="py-3.5 px-4 font-semibold text-indigo-600 dark:text-indigo-400">{row.hirex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: CTA Card */}
          <div id="pricing" className="lg:col-span-5">
            <div className="rounded-2xl p-6 bg-[#f5f8ff] dark:bg-[#0c1428] border border-indigo-200/80 dark:border-indigo-900/40 shadow-lg relative">
              
              <div className="size-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                <Rocket className="size-5" />
              </div>

              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Ready to Transform Your Hiring?
              </h3>
              
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Book a live demo and see HireX Snab in action — real resume parsing, AI candidate ads, WhatsApp automation, and confidential resume masking.
              </p>

              {/* Action Buttons */}
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4338ca] hover:bg-[#3730a3] text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <span>Schedule a Client Presentation</span>
                  <ArrowRight className="size-3.5" />
                </button>
                <Link
                  to="/active-jobs"
                  className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.04] text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-bold transition-all"
                >
                  <span>Explore Live Platform</span>
                </Link>
              </div>

              {/* Sub-Badges */}
              <div className="mt-5 pt-4 border-t border-indigo-100 dark:border-indigo-950/80 flex flex-wrap items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-indigo-600" />
                  <span>Zero commitment • Free sandbox</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-emerald-600" />
                  <span>Google Meet or WhatsApp</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 9. Footer (Exact Match to Reference Image Dark Bar) ── */}
      <footer className="bg-[#0b101b] text-white border-t border-slate-800 py-6 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          
          {/* Logo on Left */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-indigo-500" />
              SNAB hireX
            </span>
          </div>

          {/* Center Summary */}
          <div className="text-slate-400 text-center text-[11px]">
            HireX Snab ATS — The AI-powered ATS that does the busywork for your recruiters. Less admin. Better hires.
          </div>

          {/* Right Live Link */}
          <div className="shrink-0">
            <a
              href="https://hirex-snab.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:underline"
            >
              <span>Live at hirex-snab.vercel.app</span>
              <ArrowRight className="size-3" />
            </a>
          </div>

        </div>
      </footer>

      {/* ── 10. Client Presentation Booking Modal ── */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0e1320] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-8">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setBookingModalOpen(false)}
              className="absolute top-4 right-4 size-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="size-4" />
            </button>

            {leadSubmitted ? (
              <div className="text-center py-6">
                <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="size-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Presentation Request Received!</h3>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Our talent solutions lead will reach out to schedule your personalized live demo on Google Meet or WhatsApp.
                </p>
                <div className="mt-6">
                  <a
                    href="https://wa.me/919511779317?text=Hi%2C%20I%20would%20like%20to%20schedule%20a%20HireX%20Snab%20Client%20Presentation"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md"
                  >
                    <MessageCircle className="size-4" />
                    <span>Chat on WhatsApp Directly</span>
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-1">
                  <Calendar className="size-4" />
                  <span>Client Presentation & Walkthrough</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Schedule a Dedicated Demo
                </h3>
                <p className="mt-1 text-xs text-slate-500 mb-6">
                  Experience real AI resume parsing, candidate ads, and confidential resume masking.
                </p>

                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Name *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.name}
                      onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Work Email *</label>
                      <input
                        type="email"
                        required
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        placeholder="rahul@company.com"
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Phone / WhatsApp *</label>
                      <input
                        type="tel"
                        required
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Company / Agency Name</label>
                    <input
                      type="text"
                      value={leadForm.company}
                      onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                      placeholder="e.g. Acme Talent Partners"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Monthly Hiring Volume</label>
                    <select
                      value={leadForm.hiringVolume}
                      onChange={(e) => setLeadForm({ ...leadForm, hiringVolume: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="1-5 roles / month">1 - 5 roles / month (Growing Team)</option>
                      <option value="5-20 roles / month">5 - 20 roles / month (Active Hiring)</option>
                      <option value="20+ roles / month">20+ roles / month (Staffing Agency / Enterprise)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLead}
                    className="w-full h-11 mt-2 rounded-xl bg-[#4338ca] hover:bg-[#3730a3] text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {submittingLead ? 'Submitting...' : 'Request Presentation & Live Demo'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
