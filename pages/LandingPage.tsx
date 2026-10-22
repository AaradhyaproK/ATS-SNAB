import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
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
  Calendar,
  Menu,
  X,
  Rocket,
  CheckCheck,
  Eye,
  Check,
  Building2,
  Mail,
  Phone,
  Layers,
  Lock,
  ChevronRight,
  ChevronDown,
  Calculator,
  Sliders,
  Copy,
  Share2,
  Percent,
  IndianRupee,
  FileCheck,
  Kanban,
  ExternalLink,
  Award,
  Send,
  Plus,
  Minus,
  Edit3
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useForm, ValidationError } from '@formspree/react';
import { useAuth } from '../context/AuthContext';
import HireXLogo, { HireXMark } from '../components/HireXLogo';

// ── Mockup Candidates for Kanban & Demos ──
const MOCKUP_CANDIDATES = [
  {
    name: 'Aarav Sharma',
    role: 'Lead Full Stack Engineer',
    score: 96,
    skills: 'React, Node.js, TypeScript, AWS',
    experience: '6 Years Exp • Ex-Zomato',
    status: 'Shortlisted',
    stage: 'Shortlisted',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    notice: '15 Days',
    ctc: '₹28 LPA',
  },
  {
    name: 'Priya Nair',
    role: 'Senior Product Designer',
    score: 94,
    skills: 'Figma, Design Systems, Prototyping',
    experience: '5 Years Exp • Ex-Swiggy',
    status: 'Interview',
    stage: 'Interview Scheduled',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    notice: 'Immediate',
    ctc: '₹24 LPA',
  },
  {
    name: 'Rohan Mehta',
    role: 'Backend Systems Architect',
    score: 91,
    skills: 'Go, PostgreSQL, Kubernetes, Redis',
    experience: '7 Years Exp • Ex-Razorpay',
    status: 'Review',
    stage: 'Under Review',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    notice: '30 Days',
    ctc: '₹32 LPA',
  },
  {
    name: 'Sneha Reddy',
    role: 'DevOps & Cloud Engineer',
    score: 87,
    skills: 'AWS, Terraform, Docker, CI/CD',
    experience: '4 Years Exp • Ex-Freshworks',
    status: 'Shortlisted',
    stage: 'Shortlisted',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    notice: '15 Days',
    ctc: '₹22 LPA',
  },
  {
    name: 'Vikram Sen',
    role: 'Principal Architect',
    score: 98,
    skills: 'Microservices, Event-Driven, Java',
    experience: '9 Years Exp • Ex-Flipkart',
    status: 'Hired',
    stage: 'Offer / Hired',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    notice: 'Completed',
    ctc: '₹42 LPA',
  },
];

// ── FAQ Items ──
const FAQ_ITEMS = [
  {
    q: 'What is hireX?',
    a: 'hireX is an intelligent, high-velocity recruitment operating system designed for modern hiring teams and staffing agencies. It combines deep AI resume parsing, candidate scoring, visual Kanban pipelines, automated voice screening, 1-click WhatsApp outreach, and secure live client review links into a single, cohesive workspace.',
  },
  {
    q: 'Can clients review candidates without an account?',
    a: 'Yes, absolutely! With our zero-friction client review links, external clients and hiring managers review curated shortlists, view masked resumes, listen to AI voice screenings, and approve or reject candidates with one tap — zero login or software installation required.',
  },
  {
    q: 'How does AI match scoring work?',
    a: 'Our AI evaluates candidate resumes against the job description across technical skills, years of verified experience, domain competencies, and role-specific requirements to produce an objective 0–100% Fit score with full, transparent match reasoning.',
  },
  {
    q: 'How does direct WhatsApp outreach function?',
    a: 'hireX connects directly with WhatsApp so you can trigger instant candidate outreach, interview invitations, and screening links with 98% open rates compared to 15% for traditional email. Candidates can reply instantly and book time slots on your calendar.',
  },
  {
    q: 'What is included in the 1-month free trial?',
    a: 'You receive full platform access for 30 days — including unlimited resume screening, ATS Kanban boards, WhatsApp outreach, voice screening demo, and live client sharing portals. No credit card is required to get started.',
  },
  {
    q: 'How is candidate data secured and privacy preserved?',
    a: 'hireX provides built-in anti-poaching blind masking to hide candidate contact numbers and personal emails when sharing shortlists with external clients. All data is encrypted in transit and at rest with enterprise-grade security protocols.',
  },
];

export default function LandingPage() {
  const { user, userProfile } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Client Presentation Form State
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    hiringVolume: '1–5 roles / month',
  });
  const [submittingLead, setSubmittingLead] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [formspreeState, handleFormspreeSubmit] = useForm('movdbzab');

  // Interactive Pipeline & Client Demo States
  const [demoClientLinkCopied, setDemoClientLinkCopied] = useState<boolean>(false);
  const [demoApprovedCandidates, setDemoApprovedCandidates] = useState<string[]>(['Aarav Sharma']);
  const [demoActiveCandidate, setDemoActiveCandidate] = useState<(typeof MOCKUP_CANDIDATES)[0]>(MOCKUP_CANDIDATES[0]);
  const [demoDrawerOpen, setDemoDrawerOpen] = useState<boolean>(false);
  const [demoDrawerTab, setDemoDrawerTab] = useState<'overview' | 'resume' | 'whatsapp'>('overview');
  const [demoWhatsappSent, setDemoWhatsappSent] = useState<boolean>(false);

  // Cost Estimator State
  const [calcRecruiters, setCalcRecruiters] = useState<number>(3);
  const [calcResumes, setCalcResumes] = useState<number>(500);
  const [calcJobs, setCalcJobs] = useState<number>(10);
  const [calcBilling, setCalcBilling] = useState<'annual' | 'monthly'>('annual');
  const [calcVoiceScreening, setCalcVoiceScreening] = useState<boolean>(false);
  const [copiedQuote, setCopiedQuote] = useState<boolean>(false);

  // Quote Calculation Logic
  const quoteCalculation = useMemo(() => {
    let tierName = 'Starter';
    let basePriceMonthly = 999;
    let includedResumes = 500;

    if (calcRecruiters === 1) {
      tierName = 'Starter';
      basePriceMonthly = 999;
      includedResumes = 500;
    } else if (calcRecruiters <= 5) {
      tierName = 'Growth Agency';
      basePriceMonthly = 2999;
      includedResumes = 3000;
    } else if (calcRecruiters <= 10) {
      tierName = 'Scale Team';
      basePriceMonthly = 4999;
      includedResumes = 7500;
    } else {
      tierName = 'Enterprise Tier';
      basePriceMonthly = 7999;
      includedResumes = 15000;
    }

    const extraResumes = Math.max(0, calcResumes - includedResumes);
    const extraResumePacks = Math.ceil(extraResumes / 500);
    const resumeOverageCost = extraResumePacks * 350;

    const extraJobs = Math.max(0, calcJobs - 5);
    const extraJobCost = extraJobs * 50;

    const voiceCost = calcVoiceScreening ? 1499 : 0;

    let subtotalMonthly = basePriceMonthly + resumeOverageCost + extraJobCost + voiceCost;
    if (calcBilling === 'annual') {
      subtotalMonthly = Math.round(subtotalMonthly * 0.8);
    }

    const calculatedAnnualTotal = subtotalMonthly * 12;
    const gstMonthly = Math.round(subtotalMonthly * 0.18);
    const finalMonthlyWithGst = subtotalMonthly + gstMonthly;

    return {
      tierName,
      basePriceMonthly,
      includedResumes,
      extraResumeCost: resumeOverageCost,
      extraJobCost,
      voiceCost,
      subtotalMonthly,
      calculatedAnnualTotal,
      gstMonthly,
      finalMonthlyWithGst,
      effectiveAnnualSavings: calcBilling === 'annual' ? Math.round(basePriceMonthly * 12 * 0.2) : 0,
    };
  }, [calcRecruiters, calcResumes, calcJobs, calcBilling, calcVoiceScreening]);

  // Auth routing helper
  const dashboardPath = useMemo(() => {
    if (!user) return '/auth';
    const role = userProfile?.role || (user.email === 'admin@snab.co.in' || user.email?.includes('admin') ? 'admin' : 'recruiter');
    if (role === 'superadmin' || role === 'admin') return '/admin';
    if (role === 'recruiter') return '/recruiter/jobs';
    return '/candidate';
  }, [user, userProfile]);

  // Lead form submit handler
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLead(true);
    try {
      await handleFormspreeSubmit(e);
      try {
        await addDoc(collection(db, 'leads'), {
          ...leadForm,
          createdAt: serverTimestamp(),
          source: '1-Month Free Demo Modal',
        });
      } catch (err) {
        console.warn('Firestore lead logging note:', err);
      }
      setLeadSubmitted(true);
    } catch (err) {
      console.error('Error submitting lead form:', err);
    } finally {
      setSubmittingLead(false);
    }
  };

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans selection:bg-[#D4F82C] selection:text-[#111215]">

      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-[#F8F9F5]/90 backdrop-blur-md border-b border-[#E4E7DC] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Product Badge */}
          <div className="flex items-center gap-3">
            <Link to="/" className="group inline-flex items-center">
              <HireXLogo size="md" variant="full" />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-[#E4E7DC] text-[11px] font-medium text-[#73766C]">
              <span>by</span>
              <a
                href="https://snab.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#111215] hover:underline"
              >
                SNAB
              </a>
            </div>
          </div>

          {/* Centered Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-[13px] font-semibold text-[#575A51]">
            <a
              href="#pipeline"
              onClick={(e) => scrollToSection(e, 'pipeline')}
              className="hover:text-[#111215] transition-colors cursor-pointer"
            >
              Pipeline
            </a>
            <a
              href="#resume-matching"
              onClick={(e) => scrollToSection(e, 'resume-matching')}
              className="hover:text-[#111215] transition-colors cursor-pointer"
            >
              AI Matching
            </a>
            <a
              href="#client-portal"
              onClick={(e) => scrollToSection(e, 'client-portal')}
              className="hover:text-[#111215] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Client Portal</span>
              <span className="size-1.5 rounded-full bg-[#8FB305] animate-pulse"></span>
            </a>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, 'workflow')}
              className="hover:text-[#111215] transition-colors cursor-pointer"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="hover:text-[#111215] transition-colors cursor-pointer"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={(e) => scrollToSection(e, 'faq')}
              className="hover:text-[#111215] transition-colors cursor-pointer"
            >
              FAQ
            </a>
            <Link
              to="/active-jobs"
              className="hover:text-[#111215] transition-colors font-medium text-[#73766C]"
            >
              Job Board
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to={dashboardPath}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#111215] px-4 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs"
              >
                <LayoutDashboard className="size-3.5 text-[#D4F82C]" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/auth"
                  className="hidden sm:inline-flex text-xs font-bold text-[#111215] hover:text-[#575A51] transition-colors px-2"
                >
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex h-9.5 items-center gap-2 px-4.5 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
                >
                  <span>Book a Demo</span>
                  <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </button>
              </div>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden size-9 rounded-lg border border-[#E4E7DC] bg-white flex items-center justify-center text-[#111215]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E4E7DC] bg-[#F8F9F5] px-4 py-4 space-y-2">
            <a
              href="#pipeline"
              onClick={(e) => scrollToSection(e, 'pipeline')}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-[#111215] hover:bg-white"
            >
              Pipeline Kanban
            </a>
            <a
              href="#resume-matching"
              onClick={(e) => scrollToSection(e, 'resume-matching')}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-[#111215] hover:bg-white"
            >
              AI Matching
            </a>
            <a
              href="#client-portal"
              onClick={(e) => scrollToSection(e, 'client-portal')}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-[#111215] hover:bg-white"
            >
              Client Review Portal
            </a>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, 'workflow')}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-[#111215] hover:bg-white"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-[#111215] hover:bg-white"
            >
              Pricing Estimator
            </a>
            <a
              href="#faq"
              onClick={(e) => scrollToSection(e, 'faq')}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-[#111215] hover:bg-white"
            >
              FAQ
            </a>
            <Link
              to="/active-jobs"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-[#111215] hover:bg-white"
            >
              Active Job Board
            </Link>
            <div className="pt-2">
              {user ? (
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#111215] text-white text-xs font-bold shadow-xs hover:bg-black transition-all"
                >
                  <LayoutDashboard className="size-3.5 text-[#D4F82C]" />
                  <span>Go to Dashboard</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setBookingModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#111215] text-white text-xs font-bold"
                >
                  <span>Book a Demo</span>
                  <span className="text-[#D4F82C]">↗</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── SECTION 1: DEDICATED FULL FRAME HERO ── */}
      <section className="min-h-[calc(100vh-4.5rem)] flex flex-col justify-between relative border-b border-[#111215]">
        <div className="flex-1 flex items-center max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 w-full py-8 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center w-full">
            
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase text-[#73766C]">
                <span className="size-2 rounded-full bg-[#8FB305]"></span>
                <span>AI-POWERED RECRUITMENT ATS FOR MODERN TEAMS</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-black tracking-tight text-[#111215] leading-[1.05]">
                Less busywork.<br />
                More possibility.
              </h1>

              <p className="text-base sm:text-lg text-[#575A51] max-w-xl leading-relaxed font-normal">
                Hire smarter, faster. The intelligent ATS for lean teams, applicants and hiring managers — a streamlined, transparent process.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex h-12 items-center gap-2.5 px-6 rounded-full bg-[#111215] hover:bg-black text-white text-sm font-bold transition-all shadow-sm cursor-pointer group"
                >
                  <span>Start free trial</span>
                  <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-base">↗</span>
                </button>

                <a
                  href="#pipeline"
                  onClick={(e) => scrollToSection(e, 'pipeline')}
                  className="inline-flex h-12 items-center gap-2 px-5 text-sm font-bold text-[#111215] hover:text-[#575A51] transition-colors cursor-pointer"
                >
                  <span>Watch interactive demo</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="text-xs text-[#73766C] flex items-center gap-2 pt-2">
                <span>⚡ 30-day full access</span>
                <span>•</span>
                <span>Zero credit card required</span>
                <span>•</span>
                <span>Onboard in 5 mins</span>
              </div>
            </div>

            {/* Right Hero Graphic: Radiating 87% Asterisk & Pipeline Metric Card */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-center pt-4 lg:pt-0">
              <div className="relative mb-6">
                {/* Radiating 12-petal Asterisk Badge */}
                <div className="relative size-32 sm:size-40 flex items-center justify-center">
                  <svg viewBox="0 0 200 200" className="size-full animate-[spin_35s_linear_infinite] drop-shadow-xs">
                    {[...Array(12)].map((_, i) => (
                      <rect
                        key={i}
                        x="90"
                        y="14"
                        width="20"
                        height="80"
                        rx="10"
                        fill="#D4F82C"
                        transform={`rotate(${i * 30} 100 100)`}
                      />
                    ))}
                    <circle cx="100" cy="100" r="48" fill="#D4F82C" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                    <span className="text-2xl sm:text-3xl font-black text-[#111215] leading-none tracking-tight">87%</span>
                    <span className="text-[9px] font-bold text-[#111215]/80 uppercase tracking-widest mt-0.5">Match</span>
                  </div>
                </div>
              </div>

              {/* Floating Minimal Pipeline Progression Card */}
              <div className="w-full max-w-sm rounded-2xl border border-[#E4E7DC] bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#111215]">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#111215]"></span>
                    <span>Pipeline progression</span>
                  </div>
                  <Edit3 className="size-3.5 text-[#73766C]" />
                </div>

                {/* 3 Status Blocks */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <div className="text-[10px] text-[#73766C] font-semibold">Applied</div>
                    <div className="text-lg font-black text-[#111215]">12</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#D4F82C] border border-[#BCE41E]">
                    <div className="text-[10px] text-[#111215] font-bold">Shortlisted</div>
                    <div className="text-lg font-black text-[#111215]">5</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC]">
                    <div className="text-[10px] text-[#73766C] font-semibold">Offer</div>
                    <div className="text-lg font-black text-[#111215]">2</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E4E7DC] text-[11px] text-[#73766C] leading-snug">
                  Average time-to-hire reduced from <span className="font-bold text-[#111215]">34 days</span> to <span className="font-bold text-[#111215]">9 days</span>.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Marquee / Feature Ticker Strip (Pinned at End of Frame) ── */}
        <div className="w-full bg-[#111215] text-white py-4 border-t border-[#111215] overflow-hidden whitespace-nowrap shrink-0">
          <div className="flex items-center gap-8 text-xs font-bold tracking-wider uppercase animate-marquee">
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> zero resume clutter</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> instant AI scoring</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> live client sharing link</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> 5-stage kanban tracking</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> 1-click WhatsApp outreach</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> anti-poaching blind mode</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> AI voice screening audio</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> zero resume clutter</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> instant AI scoring</span>
            <span className="flex items-center gap-2"><span className="text-[#D4F82C]">•</span> live client sharing link</span>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: DEDICATED FULL FRAME KANBAN PIPELINE ── */}
      <section id="pipeline" className="min-h-screen flex flex-col justify-between py-12 sm:py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto scroll-mt-18 border-b border-[#E4E7DC]">
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-8">
          <div className="lg:col-span-7">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] mb-2">
              Intuitive Kanban Pipeline
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#111215] tracking-tight">
              Every applicant.<br />
              One clear picture.
            </h2>
          </div>
          <div className="lg:col-span-5 text-sm sm:text-base text-[#575A51] leading-relaxed">
            Stop juggling spreadsheets and email threads. A single unified board that brings clarity to your entire candidate flow from application to hired.
          </div>
        </div>

        {/* Realistic ATS Kanban UI Mockup */}
        <div className="rounded-2xl border border-[#E4E7DC] bg-white shadow-xl overflow-hidden">
          
          {/* Top Window Bar */}
          <div className="bg-[#111215] text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-rose-500"></span>
                <span className="size-3 rounded-full bg-amber-500"></span>
                <span className="size-3 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-xs font-semibold text-slate-300 pl-3 border-l border-white/10">
                hireX Recruitment Operating System
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span className="text-slate-300">Live Recruiter View</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
            {/* Dark Mini-Sidebar */}
            <div className="lg:col-span-2 bg-[#16171B] text-slate-300 p-4 border-r border-[#26282E] hidden lg:flex flex-col justify-between text-xs">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-white font-bold pb-3 border-b border-white/10">
                  <HireXMark size={24} />
                  <span>hireX ATS</span>
                </div>
                <div className="space-y-1">
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white font-semibold flex items-center gap-2">
                    <Briefcase className="size-3.5 text-[#D4F82C]" />
                    <span>Jobs</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white flex items-center gap-2 cursor-pointer">
                    <Users className="size-3.5" />
                    <span>Candidates</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white flex items-center gap-2 cursor-pointer">
                    <Share2 className="size-3.5" />
                    <span>Client Links</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white flex items-center gap-2 cursor-pointer">
                    <Brain className="size-3.5" />
                    <span>Voice Screening</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white flex items-center gap-2 cursor-pointer">
                    <Zap className="size-3.5" />
                    <span>Analytics</span>
                  </div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 text-[11px] text-slate-400">
                SNAB Tech Team
              </div>
            </div>

            {/* Kanban Board Container */}
            <div className="lg:col-span-10 p-5 bg-[#F8F9F5] flex flex-col">
              
              {/* Job Title Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E4E7DC]">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-extrabold text-[#111215]">Product Designer</h3>
                  <span className="px-2 py-0.5 rounded-md bg-[#D4F82C] text-[#111215] text-[10px] font-extrabold uppercase tracking-wider">
                    ACTIVE
                  </span>
                  <span className="text-xs text-[#73766C]">18 Applicants • 3 Shortlisted</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDemoActiveCandidate(MOCKUP_CANDIDATES[0]);
                      setDemoDrawerTab('resume');
                      setDemoDrawerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E4E7DC] text-xs font-semibold text-[#111215] hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    <Eye className="size-3.5 text-[#111215]" />
                    <span>Preview Drawer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111215] text-white text-xs font-bold hover:bg-black cursor-pointer shadow-2xs"
                  >
                    <span>+ Add Candidate</span>
                  </button>
                </div>
              </div>

              {/* 4 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 flex-1">
                
                {/* Column 1: Under Review */}
                <div className="rounded-xl border border-[#E4E7DC] bg-[#F1F2EC]/60 p-3 flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E4E7DC]">
                    <span className="text-xs font-bold text-[#111215]">Under Review</span>
                    <span className="size-5 rounded-full bg-white text-[#111215] text-[10px] font-bold flex items-center justify-center border border-[#E4E7DC]">
                      1
                    </span>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    <div
                      onClick={() => {
                        setDemoActiveCandidate(MOCKUP_CANDIDATES[2]);
                        setDemoDrawerTab('overview');
                        setDemoDrawerOpen(true);
                      }}
                      className="p-3 bg-white rounded-xl border border-[#E4E7DC] hover:border-[#111215] transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#111215] group-hover:text-black">{MOCKUP_CANDIDATES[2].name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                          {MOCKUP_CANDIDATES[2].score}%
                        </span>
                      </div>
                      <div className="text-[11px] text-[#73766C] mb-2">{MOCKUP_CANDIDATES[2].role}</div>
                      <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-2 border-t border-[#F1F2EC]">
                        <span>{MOCKUP_CANDIDATES[2].experience}</span>
                        <span className="font-bold text-[#111215] flex items-center gap-0.5">
                          View <ChevronRight className="size-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Shortlisted (With Lime Highlight) */}
                <div className="rounded-xl border border-[#D4F82C] bg-[#D4F82C]/10 p-3 flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D4F82C]/30">
                    <span className="text-xs font-bold text-[#111215]">Shortlisted</span>
                    <span className="size-5 rounded-full bg-[#D4F82C] text-[#111215] text-[10px] font-black flex items-center justify-center">
                      2
                    </span>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    <div
                      onClick={() => {
                        setDemoActiveCandidate(MOCKUP_CANDIDATES[0]);
                        setDemoDrawerTab('overview');
                        setDemoDrawerOpen(true);
                      }}
                      className="p-3 bg-white rounded-xl border border-[#D4F82C] hover:shadow-sm transition-all cursor-pointer shadow-2xs group ring-1 ring-[#D4F82C]"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[0].name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#D4F82C] text-[#111215]">
                          {MOCKUP_CANDIDATES[0].score}% Fit
                        </span>
                      </div>
                      <div className="text-[11px] text-[#73766C] mb-2">{MOCKUP_CANDIDATES[0].role}</div>
                      <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-2 border-t border-[#F1F2EC]">
                        <span>React, TypeScript</span>
                        <span className="font-bold text-[#111215] flex items-center gap-0.5">
                          Inspect <ChevronRight className="size-3" />
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={() => {
                        setDemoActiveCandidate(MOCKUP_CANDIDATES[3]);
                        setDemoDrawerTab('overview');
                        setDemoDrawerOpen(true);
                      }}
                      className="p-3 bg-white rounded-xl border border-[#E4E7DC] hover:border-[#111215] transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[3].name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                          {MOCKUP_CANDIDATES[3].score}%
                        </span>
                      </div>
                      <div className="text-[11px] text-[#73766C] mb-2">{MOCKUP_CANDIDATES[3].role}</div>
                      <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-2 border-t border-[#F1F2EC]">
                        <span>AWS, DevOps</span>
                        <span className="font-bold text-[#111215] flex items-center gap-0.5">
                          Inspect <ChevronRight className="size-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Interview */}
                <div className="rounded-xl border border-[#E4E7DC] bg-[#F1F2EC]/60 p-3 flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E4E7DC]">
                    <span className="text-xs font-bold text-[#111215]">Interview Scheduled</span>
                    <span className="size-5 rounded-full bg-white text-[#111215] text-[10px] font-bold flex items-center justify-center border border-[#E4E7DC]">
                      1
                    </span>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    <div
                      onClick={() => {
                        setDemoActiveCandidate(MOCKUP_CANDIDATES[1]);
                        setDemoDrawerTab('overview');
                        setDemoDrawerOpen(true);
                      }}
                      className="p-3 bg-white rounded-xl border border-[#E4E7DC] hover:border-[#111215] transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[1].name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                          {MOCKUP_CANDIDATES[1].score}%
                        </span>
                      </div>
                      <div className="text-[11px] text-[#73766C] mb-2">{MOCKUP_CANDIDATES[1].role}</div>
                      <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-2 border-t border-[#F1F2EC]">
                        <span className="text-[#111215] font-semibold">Tomorrow, 3:00 PM</span>
                        <span className="font-bold text-[#111215] flex items-center gap-0.5">
                          View <ChevronRight className="size-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 4: Hired */}
                <div className="rounded-xl border border-[#E4E7DC] bg-[#F1F2EC]/60 p-3 flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E4E7DC]">
                    <span className="text-xs font-bold text-[#111215]">Hired</span>
                    <span className="size-5 rounded-full bg-white text-[#111215] text-[10px] font-bold flex items-center justify-center border border-[#E4E7DC]">
                      1
                    </span>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    <div className="p-3 bg-white rounded-xl border border-[#E4E7DC] shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[4].name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#D4F82C] text-[#111215]">
                          98%
                        </span>
                      </div>
                      <div className="text-[11px] text-[#73766C] mb-2">{MOCKUP_CANDIDATES[4].role}</div>
                      <div className="flex items-center justify-between text-[10px] text-emerald-700 font-bold pt-2 border-t border-[#F1F2EC]">
                        <span className="flex items-center gap-1"><Check className="size-3" /> Offer Accepted</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Subcaption */}
              <div className="mt-4 pt-3 border-t border-[#E4E7DC] flex flex-wrap items-center justify-between text-xs text-[#73766C] gap-2">
                <span>Drag-and-drop candidates, review resumes, and manage interview schedules with zero friction.</span>
                <span className="font-bold text-[#111215]">Click any card to open live drawer ↗</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: AI RESUME EXTRACTION ("Read the person. Not the paperwork.") ── */}
      <section id="resume-matching" className="py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E4E7DC]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-6 space-y-6">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
              AI Resume Extraction & Match
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#111215] tracking-tight leading-[1.1]">
              Read the person.<br />
              Not the paperwork.
            </h2>
            <p className="text-base text-[#575A51] leading-relaxed">
              Our AI extracts actual competencies, verified work experience, and cultural indicators — giving you an actionable profile within 3 seconds of resume upload.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm font-semibold text-[#111215]">
                <div className="size-5 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span>Deep keyword & contextual skill extraction</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-[#111215]">
                <div className="size-5 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span>Objective AI match scoring (0–100%) against Job Description</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-[#111215]">
                <div className="size-5 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span>Clean candidate profile with zero formatting errors or bad PDFs</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-[#111215]">
                <div className="size-5 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span>Native WhatsApp outreach with 98% open rates</span>
              </div>
            </div>
          </div>

          {/* Right Floating Profile Cards Visual */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            
            {/* Background Card */}
            <div className="w-full max-w-md rounded-2xl border border-[#E4E7DC] bg-[#F1F2EC] p-6 shadow-sm rotate-1 translate-y-3 translate-x-3 opacity-90">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E7DC]">
                <div className="text-xs font-bold text-[#73766C]">Extracted Qualifications</div>
                <span className="size-6 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold text-xs">★</span>
              </div>
              <div className="mt-3 space-y-2 text-xs text-[#575A51]">
                <p>• Verified 5+ years building enterprise SaaS platforms</p>
                <p>• Core technologies: React, TypeScript, Node.js, PostgreSQL</p>
                <p>• Fast notice period (15 days), strong communication index</p>
              </div>
            </div>

            {/* Front Card */}
            <div className="absolute w-full max-w-md rounded-2xl border border-[#111215] bg-white p-6 shadow-xl -rotate-1 -translate-y-2 -translate-x-2">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E4E7DC]">
                <div className="flex items-center gap-3">
                  <img
                    src={MOCKUP_CANDIDATES[0].avatar}
                    alt={MOCKUP_CANDIDATES[0].name}
                    className="size-12 rounded-full object-cover border border-[#E4E7DC]"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-[#111215]">{MOCKUP_CANDIDATES[0].name}</h4>
                    <p className="text-xs text-[#73766C]">{MOCKUP_CANDIDATES[0].role}</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-black">
                  96% Fit
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-md bg-[#F8F9F5] text-[#111215] text-[11px] font-semibold border border-[#E4E7DC]">React</span>
                  <span className="px-2.5 py-1 rounded-md bg-[#F8F9F5] text-[#111215] text-[11px] font-semibold border border-[#E4E7DC]">TypeScript</span>
                  <span className="px-2.5 py-1 rounded-md bg-[#F8F9F5] text-[#111215] text-[11px] font-semibold border border-[#E4E7DC]">Node.js</span>
                  <span className="px-2.5 py-1 rounded-md bg-[#F8F9F5] text-[#111215] text-[11px] font-semibold border border-[#E4E7DC]">Cloud Architect</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-xs text-[#575A51] leading-relaxed">
                  "Exceeded all technical benchmarks for full stack architecture. Demonstrated leadership scaling distributed systems."
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-[#73766C]">Notice: <strong className="text-[#111215]">15 Days</strong></span>
                  <span className="text-[#73766C]">Exp: <strong className="text-[#111215]">6 Years</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setDemoActiveCandidate(MOCKUP_CANDIDATES[0]);
                      setDemoDrawerTab('whatsapp');
                      setDemoDrawerOpen(true);
                    }}
                    className="text-xs font-bold text-[#111215] underline cursor-pointer"
                  >
                    Send WhatsApp Invite &rarr;
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── SECTION 4: DARK SECTION ("A shortlist needs context. Not a black box.") ── */}
      <section id="client-portal" className="py-24 px-4 sm:px-8 lg:px-12 bg-[#111215] text-white scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-14">
            <div className="lg:col-span-7">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#D4F82C] mb-2">
                Live Client Collaboration
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.1]">
                A shortlist needs context.<br />
                Not a black box.
              </h2>
            </div>
            <div className="lg:col-span-5 text-sm sm:text-base text-slate-300 leading-relaxed">
              They don't need spreadsheets or 10-page CV PDFs. Give your clients a live, interactive review link they'll actually enjoy using.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Interactive Client Review Portal Mockup */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#16171B] p-6 shadow-2xl space-y-5">
              
              {/* Header Bar with Share Link & Copy */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <div className="text-xs text-slate-400 font-mono">Job: Lead Full Stack Engineer</div>
                  <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                    <span>Acme Corp • Client Shortlist Portal</span>
                    <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse"></span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText('https://hirex.snab.co.in/review/share_lead_arch_9f4k2');
                    setDemoClientLinkCopied(true);
                    setTimeout(() => setDemoClientLinkCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  {demoClientLinkCopied ? (
                    <>
                      <Check className="size-3 text-[#D4F82C]" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copy Client Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Candidate Review Card Inside Portal */}
              <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={MOCKUP_CANDIDATES[0].avatar}
                      alt={MOCKUP_CANDIDATES[0].name}
                      className="size-11 rounded-full object-cover border border-white/20"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{MOCKUP_CANDIDATES[0].name}</span>
                        <span className="px-2 py-0.5 rounded bg-[#D4F82C] text-[#111215] text-[10px] font-black">
                          {MOCKUP_CANDIDATES[0].score}% Match
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{MOCKUP_CANDIDATES[0].role} • Masked ID: SNAB-9421</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (demoApprovedCandidates.includes(MOCKUP_CANDIDATES[0].name)) {
                        setDemoApprovedCandidates(demoApprovedCandidates.filter(n => n !== MOCKUP_CANDIDATES[0].name));
                      } else {
                        setDemoApprovedCandidates([...demoApprovedCandidates, MOCKUP_CANDIDATES[0].name]);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      demoApprovedCandidates.includes(MOCKUP_CANDIDATES[0].name)
                        ? 'bg-[#D4F82C] text-[#111215]'
                        : 'bg-white text-[#111215] hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>{demoApprovedCandidates.includes(MOCKUP_CANDIDATES[0].name) ? 'Interview Approved' : 'Approve Candidate'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px]">Expected Comp:</span>
                    <div className="font-bold text-white">{MOCKUP_CANDIDATES[0].ctc}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Notice Period:</span>
                    <div className="font-bold text-white">{MOCKUP_CANDIDATES[0].notice}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Voice Screening:</span>
                    <div className="font-bold text-[#D4F82C] flex items-center gap-1">
                      <Play className="size-3 fill-current" /> Verified (4m 12s)
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>⚡ Real-time Sync: ATS status updates reflect on this client link immediately.</span>
                <span className="text-[#D4F82C]">Zero client login required</span>
              </div>
            </div>

            {/* Right 3 Feature Pillars */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <div className="size-2 rounded-full bg-[#D4F82C]"></div>
                  <span>Shared with one click</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-4">
                  Generate a beautiful, branded client shortlist URL per job. No logins, no passwords, no attachments.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <div className="size-2 rounded-full bg-[#D4F82C]"></div>
                  <span>Live bidirectional sync</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-4">
                  Moving or updating a candidate in your recruiter ATS updates the client portal instantly. No stale data.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <div className="size-2 rounded-full bg-[#D4F82C]"></div>
                  <span>Keep people in charge</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-4">
                  Clients approve candidates, request interviews, or decline with feedback in 1 tap, cutting hiring cycle by 60%.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-xs font-black transition-all cursor-pointer"
                >
                  <span>Request Client Portal Demo</span>
                  <span>↗</span>
                </button>
              </div>

            </div>

          </div>

          <div className="mt-14 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-4">
            <div>27,000+ SHORTLISTS SHARED ACROSS INDIA</div>
            <div className="text-[#D4F82C]">98.4% CLIENT SATISFACTION RATE</div>
          </div>

        </div>
      </section>

      {/* ── SECTION 5: 4-STEP WORKFLOW ("A simpler rhythm for the whole hiring journey.") ── */}
      <section id="workflow" className="py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto scroll-mt-20">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12">
          <div className="lg:col-span-7">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] mb-2">
              End-to-End Workflow
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#111215] tracking-tight leading-[1.1]">
              A simpler rhythm<br />
              for the whole hiring journey.
            </h2>
          </div>
          <div className="lg:col-span-5 text-sm sm:text-base text-[#575A51] leading-relaxed">
            From job requisition to the signed offer letter, hireX removes the operational drag so your team can focus on people.
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Step 1 */}
          <div className="p-6 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="text-xs font-mono font-bold text-[#73766C] mb-4">01</div>
              <h3 className="text-base font-bold text-[#111215] mb-2">Define the role</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                AI crafts precision job descriptions and sets objective evaluation rubrics in seconds.
              </p>
            </div>
            <div className="pt-4 border-t border-[#F1F2EC] text-[10px] font-bold uppercase tracking-wider text-[#73766C]">
              Requisition
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="text-xs font-mono font-bold text-[#73766C] mb-4">02</div>
              <h3 className="text-base font-bold text-[#111215] mb-2">Bring in candidates</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                Auto-parse incoming CVs from job portals, referrals, and inbound applications with 99% accuracy.
              </p>
            </div>
            <div className="pt-4 border-t border-[#F1F2EC] text-[10px] font-bold uppercase tracking-wider text-[#73766C]">
              Sourcing & Parsing
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="text-xs font-mono font-bold text-[#73766C] mb-4">03</div>
              <h3 className="text-base font-bold text-[#111215] mb-2">Review with context</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                Inspect match breakdowns, listen to voice screenings, and compare top candidates side-by-side.
              </p>
            </div>
            <div className="pt-4 border-t border-[#F1F2EC] text-[10px] font-bold uppercase tracking-wider text-[#73766C]">
              Screening & Scoring
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-6 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="text-xs font-mono font-bold text-[#73766C] mb-4">04</div>
              <h3 className="text-base font-bold text-[#111215] mb-2">Move people forward</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                1-click WhatsApp invites, calendar scheduling, and collaborative client approvals.
              </p>
            </div>
            <div className="pt-4 border-t border-[#F1F2EC] text-[10px] font-bold uppercase tracking-wider text-[#73766C]">
              Interview & Offer
            </div>
          </div>

        </div>

      </section>

      {/* ── SECTION 6: ELECTRIC LIME BANNER STRIP ── */}
      <div
        onClick={() => setBookingModalOpen(true)}
        className="bg-[#D4F82C] text-[#111215] py-4.5 px-4 sm:px-8 cursor-pointer hover:bg-[#c6ec22] transition-colors border-y border-[#BCE41E]"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between font-bold text-xs sm:text-sm">
          <span>Better agreements mean space for better conversations. Explore hireX Pro →</span>
          <span className="hidden sm:inline-block font-black underline">Book 1-Month Free Demo</span>
        </div>
      </div>

      {/* ── SECTION 7: EDITORIAL BENEFITS ("Less admin. More attention.") ── */}
      <section className="py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Block */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-3xl sm:text-5xl font-black text-[#111215] tracking-tight leading-[1.1]">
              Less admin.<br />
              More attention.
            </h2>
            
            <div
              onClick={() => setBookingModalOpen(true)}
              className="inline-flex items-center gap-3 p-2 rounded-full border border-[#E4E7DC] bg-white cursor-pointer hover:border-[#111215] transition-all"
            >
              <div className="size-10 rounded-full bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold">
                →
              </div>
              <span className="text-xs font-bold text-[#111215] pr-4">Give your recruiters 14 hours back every single week.</span>
            </div>
          </div>

          {/* Right 3 Article Rows */}
          <div className="lg:col-span-7 divide-y divide-[#E4E7DC]">
            
            <div className="pb-6">
              <h3 className="text-lg font-bold text-[#111215] mb-2 hover:text-[#575A51] transition-colors cursor-pointer">
                Know what everyone is working on.
              </h3>
              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                Full visibility across team activity, pipeline bottlenecks, and open job requisitions without needing another status meeting.
              </p>
            </div>

            <div className="py-6">
              <h3 className="text-lg font-bold text-[#111215] mb-2 hover:text-[#575A51] transition-colors cursor-pointer">
                Client work that never feels like work.
              </h3>
              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                Automated live share links replace clumsy PDF attachments, email back-and-forth, and lost candidates.
              </p>
            </div>

            <div className="pt-6">
              <h3 className="text-lg font-bold text-[#111215] mb-2 hover:text-[#575A51] transition-colors cursor-pointer">
                Ask better interview questions.
              </h3>
              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                AI generates contextual interview scorecards targeted at candidate skill gaps and job requirements.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── SECTION 8: PRICING ESTIMATOR ── */}
      <section id="pricing" className="py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E4E7DC] scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] mb-2">
            Transparent Pricing
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-[#111215] tracking-tight">
            Calculate your exact monthly plan.
          </h2>
          <p className="mt-3 text-sm text-[#575A51]">
            Scale smoothly with your hiring volume. Free Baileys WhatsApp engine, masked resumes, and zero lock-in contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Calculator Controls */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E7DC] p-6 sm:p-8 space-y-6 shadow-sm">
            
            {/* 1. Recruiters */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-[#111215]">Recruiter & Team Seats</span>
                <span className="px-2 py-0.5 rounded bg-[#F8F9F5] text-[#111215] font-black border border-[#E4E7DC]">
                  {calcRecruiters} {calcRecruiters === 1 ? 'Seat' : 'Seats'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={calcRecruiters}
                onChange={(e) => setCalcRecruiters(parseInt(e.target.value))}
                className="w-full accent-[#111215] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#73766C] mt-1 font-mono">
                <span>1 Seat</span>
                <span>5 Seats</span>
                <span>10 Seats</span>
                <span>20+ Seats</span>
              </div>
            </div>

            {/* 2. Monthly Resumes */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-[#111215]">Resumes Processed / Month</span>
                <span className="px-2 py-0.5 rounded bg-[#D4F82C] text-[#111215] font-black">
                  {calcResumes} Resumes
                </span>
              </div>
              <input
                type="range"
                min={200}
                max={10000}
                step={200}
                value={calcResumes}
                onChange={(e) => setCalcResumes(parseInt(e.target.value))}
                className="w-full accent-[#111215] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#73766C] mt-1 font-mono">
                <span>200</span>
                <span>2,500</span>
                <span>5,000</span>
                <span>10,000+</span>
              </div>
            </div>

            {/* 3. Billing Toggle */}
            <div className="pt-2">
              <div className="text-xs font-bold text-[#111215] mb-2">Billing Frequency</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCalcBilling('annual')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    calcBilling === 'annual'
                      ? 'border-[#111215] bg-[#111215] text-white'
                      : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>Annual Billing</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#D4F82C] text-[#111215]">Save 20%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Discounted yearly rate</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCalcBilling('monthly')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    calcBilling === 'monthly'
                      ? 'border-[#111215] bg-[#111215] text-white'
                      : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]'
                  }`}
                >
                  <div className="text-xs font-bold">Monthly Billing</div>
                  <div className="text-[10px] text-[#73766C] mt-1">Cancel anytime</div>
                </button>
              </div>
            </div>

          </div>

          {/* Right Quote Summary Card */}
          <div className="lg:col-span-5 rounded-2xl border border-[#111215] bg-[#111215] text-white p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#D4F82C] font-bold">Recommended Tier</span>
                <h3 className="text-xl font-black text-white">{quoteCalculation.tierName}</h3>
              </div>
              <HireXMark size={32} />
            </div>

            <div>
              <div className="text-3xl sm:text-4xl font-black text-white">
                ₹{quoteCalculation.subtotalMonthly.toLocaleString('en-IN')}
                <span className="text-xs text-slate-400 font-normal"> / month</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                +18% GST (₹{quoteCalculation.gstMonthly.toLocaleString('en-IN')}) = <strong className="text-white">₹{quoteCalculation.finalMonthlyWithGst.toLocaleString('en-IN')} total</strong>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-[#D4F82C]" />
                <span>Unlimited WhatsApp candidate messaging included</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-[#D4F82C]" />
                <span>Zero-friction client review links with live sync</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-[#D4F82C]" />
                <span>Visual Kanban pipeline & slide-over resume preview</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBookingModalOpen(true)}
              className="w-full py-3.5 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-xs font-black transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <span>Get Started With 1-Month Free Trial</span>
              <span>↗</span>
            </button>
          </div>

        </div>
      </section>

      {/* ── SECTION 9: FAQ ACCORDION ("A little more clarity.") ── */}
      <section id="faq" className="py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E4E7DC] scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Title */}
          <div className="lg:col-span-5 space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
              Frequently Asked Questions
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#111215] tracking-tight leading-[1.1]">
              A little more<br />
              clarity.
            </h2>
            <p className="text-sm text-[#575A51] leading-relaxed">
              Everything you need to know about hireX, setup time, and pricing.
            </p>
          </div>

          {/* Right Accordion */}
          <div className="lg:col-span-7 divide-y divide-[#E4E7DC]">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.q} className="py-5">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between text-left text-base font-bold text-[#111215] hover:text-[#575A51] transition-colors cursor-pointer gap-4"
                  >
                    <span>{item.q}</span>
                    <span className="text-lg text-[#73766C]">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs sm:text-sm text-[#575A51] leading-relaxed pr-6">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── SECTION 10: DARK CTA ("Your next great hire. A clearer way forward.") ── */}
      <section className="py-24 px-4 sm:px-8 lg:px-12 bg-[#111215] text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-12 relative z-10">
          
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.08]">
              Your next great hire.<br />
              A clearer way forward.
            </h2>
            <p className="text-base text-slate-300 max-w-lg leading-relaxed">
              Start your 30-day free trial. No credit card required. Onboard your hiring team in under 5 minutes.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="inline-flex h-12 items-center gap-2.5 px-7 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-sm font-black transition-all cursor-pointer group"
              >
                <span>Start free trial today</span>
                <span className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
              </button>
            </div>
          </div>

          {/* Huge Diagonal Arrow Graphic */}
          <div className="shrink-0 flex items-center justify-center opacity-90">
            <svg viewBox="0 0 160 160" className="size-44 sm:size-64 stroke-[#D4F82C] stroke-[8] fill-none">
              <path d="M40 120 L120 40 M120 40 L60 40 M120 40 L120 100" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

        </div>
      </section>

      {/* ── SECTION 11: SIGNATURE FOOTER WITH GIANT "hireX ↗" ── */}
      <footer className="pt-20 pb-12 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E4E7DC] bg-[#F8F9F5]">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-16">
          <div>
            <div className="mb-3">
              <HireXLogo size="md" variant="full" />
            </div>
            <p className="text-xs text-[#73766C] leading-relaxed">
              The AI-powered recruitment operating system for agile teams and modern staffing agencies.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px]">Product</div>
            <div><a href="#pipeline" onClick={(e) => scrollToSection(e, 'pipeline')} className="text-[#73766C] hover:text-[#111215]">Pipeline Kanban</a></div>
            <div><a href="#client-portal" onClick={(e) => scrollToSection(e, 'client-portal')} className="text-[#73766C] hover:text-[#111215]">Client Portal</a></div>
            <div><a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="text-[#73766C] hover:text-[#111215]">Pricing Estimator</a></div>
            <div><Link to="/active-jobs" className="text-[#73766C] hover:text-[#111215]">Job Board</Link></div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px]">Company</div>
            <div><a href="https://snab.co.in" target="_blank" rel="noopener noreferrer" className="text-[#73766C] hover:text-[#111215]">About SNAB</a></div>
            <div><button type="button" onClick={() => setBookingModalOpen(true)} className="text-[#73766C] hover:text-[#111215]">Book Demo</button></div>
            <div><a href="mailto:hello@snab.co.in" className="text-[#73766C] hover:text-[#111215]">hello@snab.co.in</a></div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px]">Enterprise</div>
            <div className="text-[#73766C]">GST Compliant Invoicing</div>
            <div className="text-[#73766C]">Anti-Poaching Data Masking</div>
            <div className="text-[#73766C]">Baileys WhatsApp Gateway</div>
          </div>
        </div>

        {/* Giant Typographic Wordmark */}
        <div className="py-6 border-t border-[#E4E7DC] select-none overflow-hidden">
          <div className="text-[15vw] font-black tracking-tighter leading-none text-[#111215] flex items-center">
            hireX<span className="text-[#8FB305]">↗</span>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="pt-6 border-t border-[#E4E7DC] flex flex-wrap items-center justify-between text-xs text-[#73766C] gap-3">
          <div>© {new Date().getFullYear()} SNAB Technologies. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>GST Registered</span>
            <span>•</span>
            <span>ISO Compliant Hosting</span>
          </div>
        </div>

      </footer>

      {/* ── Slide-Over Candidate Drawer Modal (Demonstration) ── */}
      {demoDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E4E7DC] animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E4E7DC] flex items-center justify-between bg-[#F8F9F5]">
              <div className="flex items-center gap-3">
                <img
                  src={demoActiveCandidate.avatar}
                  alt={demoActiveCandidate.name}
                  className="size-12 rounded-full object-cover border border-[#E4E7DC]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#111215]">{demoActiveCandidate.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-black">
                      {demoActiveCandidate.score}% Fit
                    </span>
                  </div>
                  <p className="text-xs text-[#73766C]">{demoActiveCandidate.role} • Application ID: SNAB-9421</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDemoDrawerOpen(false)}
                className="size-8 rounded-lg border border-[#E4E7DC] bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 border-b border-[#E4E7DC] flex items-center gap-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDemoDrawerTab('overview')}
                className={`py-3 border-b-2 cursor-pointer transition-colors ${
                  demoDrawerTab === 'overview'
                    ? 'border-[#111215] text-[#111215]'
                    : 'border-transparent text-[#73766C] hover:text-[#111215]'
                }`}
              >
                AI Fit Overview
              </button>
              <button
                type="button"
                onClick={() => setDemoDrawerTab('resume')}
                className={`py-3 border-b-2 cursor-pointer transition-colors ${
                  demoDrawerTab === 'resume'
                    ? 'border-[#111215] text-[#111215]'
                    : 'border-transparent text-[#73766C] hover:text-[#111215]'
                }`}
              >
                Resume Document View
              </button>
              <button
                type="button"
                onClick={() => setDemoDrawerTab('whatsapp')}
                className={`py-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  demoDrawerTab === 'whatsapp'
                    ? 'border-[#111215] text-[#111215] font-black'
                    : 'border-transparent text-[#73766C] hover:text-[#111215]'
                }`}
              >
                <MessageCircle className="size-3.5 text-emerald-600" />
                <span>WhatsApp Outreach</span>
              </button>
            </div>

            {/* Drawer Body Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {demoDrawerTab === 'overview' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#111215]">
                      <Brain className="size-4 text-[#8FB305]" />
                      <span>HireX AI Match Reasoning</span>
                    </div>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidate has strong proficiency in {demoActiveCandidate.skills} with {demoActiveCandidate.experience}. High cultural alignment and short notice period.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-[#111215] uppercase tracking-wider">Scoring Breakdown</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[#73766C] mb-1">
                          <span>Technical Skills Compatibility</span>
                          <span className="font-bold text-[#111215]">{demoActiveCandidate.score}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E4E7DC] overflow-hidden">
                          <div className="h-full bg-[#D4F82C] rounded-full" style={{ width: `${demoActiveCandidate.score}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[#73766C] mb-1">
                          <span>Years of Relevant Industry Experience</span>
                          <span className="font-bold text-[#111215]">92%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E4E7DC] overflow-hidden">
                          <div className="h-full bg-[#111215] rounded-full" style={{ width: '92%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[#73766C] mb-1">
                          <span>Communication & Voice AI Score</span>
                          <span className="font-bold text-[#111215]">89%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E4E7DC] overflow-hidden">
                          <div className="h-full bg-[#D4F82C] rounded-full" style={{ width: '89%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {demoDrawerTab === 'resume' && (
                <div className="p-6 border border-[#E4E7DC] rounded-xl bg-white shadow-2xs font-sans text-xs space-y-4">
                  <div className="border-b border-[#E4E7DC] pb-3 flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-bold text-[#111215]">{demoActiveCandidate.name}</h4>
                      <p className="text-[#73766C]">{demoActiveCandidate.role} • Bengaluru, India</p>
                    </div>
                    <span className="px-2 py-1 rounded bg-[#D4F82C] text-[#111215] font-mono text-[10px] font-bold">
                      VERIFIED RESUME
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-[#111215] text-[11px] uppercase tracking-wider">Professional Summary</div>
                    <p className="text-[#575A51] leading-relaxed">
                      Accomplished engineer with extensive experience building and scaling enterprise web applications. Specialized in TypeScript, modern reactive frontends, and cloud microservices.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-[#111215] text-[11px] uppercase tracking-wider">Experience</div>
                    <div className="text-[#111215] font-bold">Senior Engineer • Apex Global Labs</div>
                    <div className="text-[#73766C] text-[11px]">2022 — Present • Bengaluru, India</div>
                    <p className="text-[#575A51] leading-relaxed pt-1">
                      Architected high-throughput customer dashboards handling over 2M requests/day with sub-100ms response times.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-[#111215] text-[11px] uppercase tracking-wider">Core Skills</div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {demoActiveCandidate.skills.split(', ').map((skill) => (
                        <span key={skill} className="px-2 py-0.5 rounded bg-[#F8F9F5] text-[#111215] text-[10px] font-semibold border border-[#E4E7DC]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {demoDrawerTab === 'whatsapp' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                      <MessageCircle className="size-4 text-emerald-600" />
                      <span>WhatsApp Direct Invitation Template</span>
                    </div>
                    <p className="text-xs text-emerald-950">
                      Pre-formatted message ready to send to <span className="font-bold">{demoActiveCandidate.name}</span>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] space-y-2 font-mono text-xs text-[#111215]">
                    <p>Hi {demoActiveCandidate.name},</p>
                    <p>
                      Great news! The hiring team at SNAB has reviewed your application for the {demoActiveCandidate.role} position and would love to invite you for an interview.
                    </p>
                    <p>Please click here to pick a time slot that works best for you: https://hirex.snab.co.in/schedule/sn-4921</p>
                    <p>Best regards,<br />Talent Acquisition Team</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDemoWhatsappSent(true);
                      setTimeout(() => setDemoWhatsappSent(false), 2500);
                    }}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    {demoWhatsappSent ? (
                      <>
                        <Check className="size-4" />
                        <span>Message Sent via WhatsApp!</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        <span>Send WhatsApp Invite Now</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[#E4E7DC] bg-[#F8F9F5] flex items-center justify-between">
              <span className="text-xs text-[#73766C]">hireX ATS Live Candidate Preview</span>
              <button
                type="button"
                onClick={() => setDemoDrawerOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#111215] text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 1-Month Free Demo Booking Modal ── */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E4E7DC] overflow-hidden">
            
            <button
              type="button"
              onClick={() => setBookingModalOpen(false)}
              className="absolute top-5 right-5 size-8 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <X className="size-4" />
            </button>

            {leadSubmitted ? (
              <div className="py-8 text-center space-y-4">
                <div className="size-16 rounded-full bg-[#D4F82C] text-[#111215] mx-auto flex items-center justify-center">
                  <Check className="size-8 stroke-[3]" />
                </div>
                <h3 className="text-2xl font-black text-[#111215]">You're All Set!</h3>
                <p className="text-xs text-[#575A51] max-w-sm mx-auto">
                  Our talent solutions team has received your request. We'll set up your 1-month free trial and reach out on WhatsApp/Email within 15 minutes.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLeadSubmitted(false);
                    setBookingModalOpen(false);
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#111215] text-white text-xs font-bold"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-[10px] font-black uppercase tracking-wider mb-3">
                  ★ 1-Month Free Demo
                </div>
                <h3 className="text-2xl font-black text-[#111215] tracking-tight">
                  Claim your 30-day free trial.
                </h3>
                <p className="text-xs text-[#73766C] mt-1 mb-6">
                  Get full platform access — AI resume parsing, candidate portal, WhatsApp job matching, and live walkthrough.
                </p>

                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  <input type="hidden" name="_subject" value="New 1-Month Free Demo Inquiry - HireX Snab" />

                  <div>
                    <label className="block text-[11px] font-bold text-[#111215] mb-1">Your Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={leadForm.name}
                      onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#111215] mb-1">Work Email *</label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        placeholder="rahul@company.com"
                        className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#111215] mb-1">WhatsApp / Phone *</label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111215] mb-1">Company / Agency Name</label>
                    <input
                      type="text"
                      name="company"
                      value={leadForm.company}
                      onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                      placeholder="e.g. Acme Talent Partners"
                      className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111215] mb-1">Hiring Volume</label>
                    <select
                      name="hiringVolume"
                      value={leadForm.hiringVolume}
                      onChange={(e) => setLeadForm({ ...leadForm, hiringVolume: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white"
                    >
                      <option value="1–5 roles / month">1–5 roles / month</option>
                      <option value="6–20 roles / month">6–20 roles / month</option>
                      <option value="21–50 roles / month">21–50 roles / month</option>
                      <option value="50+ roles / month">50+ roles / month</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingLead || formspreeState.submitting}
                      className="w-full h-11 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 group"
                    >
                      <span>{submittingLead || formspreeState.submitting ? 'Submitting...' : 'Claim 1-Month Free Demo'}</span>
                      <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                    </button>
                    <div className="mt-2 text-center text-[10px] text-[#73766C]">
                      ⚡ Instant 15-Min Response • No Credit Card • 100% Free Trial
                    </div>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
