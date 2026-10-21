import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  Calculator,
  Sliders,
  Copy,
  Share2,
  Percent,
  IndianRupee,
  FileCheck
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useForm, ValidationError } from '@formspree/react';
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

// ── Head-to-Head Capability Matrix Data ──
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
    traditional: 'Manual keyword search & browse',
    hirex: 'AI-personalised candidate match picks',
  },
  {
    capability: 'Finding top talent',
    traditional: 'Rigid filters & keyword search',
    hirex: 'Best-candidate suggestions first',
  },
];

// ── Market Pricing Benchmark Data (Indicative INR) ──
const PRICING_BENCHMARK_ROWS = [
  {
    tool: 'Zoho Recruit',
    price: '₹1,250 to ₹3,000',
    model: 'Per recruiter / month',
    note: 'WhatsApp & AI require additional tiers or add-ons.',
    isHirex: false,
  },
  {
    tool: 'Typical Standalone ATS',
    price: '₹2,000 to ₹3,000',
    model: 'Per recruiter / month',
    note: 'Basic applicant tracking without semantic scoring.',
    isHirex: false,
  },
  {
    tool: 'Greenhouse',
    price: '₹4,000 and above ($15k+ yr)',
    model: 'Per recruiter / month',
    note: 'USD billing; strict annual minimum commitments.',
    isHirex: false,
  },
  {
    tool: 'Bullhorn',
    price: '₹5,000 to ₹8,000',
    model: 'Per recruiter / month',
    note: 'Complex legacy contracts; setup fees apply.',
    isHirex: false,
  },
  {
    tool: 'JazzHR',
    price: 'About ₹9,600',
    model: 'Flat / month',
    note: 'Lacks native WhatsApp outreach & autonomous voice screen.',
    isHirex: false,
  },
  {
    tool: 'AI-Focused Niche Tools',
    price: '₹25,000 to ₹50,000',
    model: 'Flat / month',
    note: 'Narrow point-solutions with expensive volume caps.',
    isHirex: false,
  },
  {
    tool: 'HireX Snab ATS',
    price: 'All-Inclusive Value',
    model: 'Transparent Monthly / Annual',
    note: 'AI resume scoring, WhatsApp alerts, job ads, white masking, and screening included.',
    isHirex: true,
  },
];

// ── Mockup Candidates Data ──
const MOCKUP_CANDIDATES = [
  {
    name: 'Aarav Sharma',
    role: 'Full Stack Developer',
    score: 96,
    skills: 'React, Node.js, MongoDB',
    status: 'Shortlisted',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Priya Nair',
    role: 'Frontend Developer',
    score: 94,
    skills: 'React, TypeScript, Tailwind',
    status: 'Interview',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Rohan Mehta',
    role: 'Backend Developer',
    score: 91,
    skills: 'Node.js, Python, AWS',
    status: 'Review',
    statusColor: 'bg-amber-50 text-amber-700 border-amber-200',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Sneha Reddy',
    role: 'DevOps Engineer',
    score: 87,
    skills: 'AWS, Docker, Kubernetes',
    status: 'Contacted',
    statusColor: 'bg-purple-50 text-purple-700 border-purple-200',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
  },
];

export default function LandingPage() {
  const { user, userProfile } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

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

  // Cost Estimator State
  const [pricingTab, setPricingTab] = useState<'estimator' | 'benchmark'>('estimator');
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
      tierName = 'Enterprise Pro';
      basePriceMonthly = 7999;
      includedResumes = 20000;
    }

    // Extra resumes block (₹499 per 500 resumes beyond tier included)
    const extraResumes = Math.max(0, calcResumes - includedResumes);
    const extraResumeBlocks = Math.ceil(extraResumes / 500);
    const extraResumeCostMonthly = extraResumeBlocks * 499;

    // Optional Voice screening add-on
    const voiceCostMonthly = calcVoiceScreening ? 999 : 0;

    const monthlyGross = basePriceMonthly + extraResumeCostMonthly + voiceCostMonthly;
    const isAnnual = calcBilling === 'annual';
    const effectiveMonthly = isAnnual ? Math.round(monthlyGross * 0.8) : monthlyGross;
    const billedAmount = isAnnual ? effectiveMonthly * 12 : monthlyGross;
    const gstAmount = Math.round(billedAmount * 0.18);
    const grandTotal = billedAmount + gstAmount;

    // Legacy ATS equivalent cost (~₹3,500/seat/mo + ₹1,500 WhatsApp SMS fees)
    const competitorMonthly = calcRecruiters * 3500 + 1500;
    const competitorTotal = isAnnual ? competitorMonthly * 12 : competitorMonthly;
    const savingsAmount = Math.max(0, competitorTotal - billedAmount);
    const savingsPercent = Math.round((savingsAmount / competitorTotal) * 100);

    return {
      tierName,
      basePriceMonthly,
      includedResumes,
      extraResumes,
      extraResumeCostMonthly,
      voiceCostMonthly,
      monthlyGross,
      effectiveMonthly,
      billedAmount,
      gstAmount,
      grandTotal,
      competitorTotal,
      savingsAmount,
      savingsPercent,
      isAnnual,
    };
  }, [calcRecruiters, calcResumes, calcBilling, calcVoiceScreening]);

  const handleCopyQuote = () => {
    const quoteText = `=========================================
HIREX SNAB ATS - OFFICIAL COMMERCIAL QUOTE
Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
Valid For: 30 Days | Quote ID: SNAB-QT-2026-${Math.floor(1000 + Math.random() * 9000)}
Website: https://snab.co.in | Contact: hello@snab.co.in
=========================================

CLIENT CONFIGURATION:
• Recruiting Team: ${calcRecruiters} seat(s)
• Active Monthly Resumes: ${calcResumes.toLocaleString('en-IN')} resumes
• Active Jobs / Mo: ${calcJobs} active openings
• AI Automated Voice Screening: ${calcVoiceScreening ? 'Included (+₹999/mo)' : 'Not selected'}
• WhatsApp Alerts: UNLIMITED / ₹0 Extra (Native Baileys Engine)

COMMERCIAL BREAKDOWN (${quoteCalculation.isAnnual ? 'Annual Billing (20% OFF)' : 'Monthly Billing'}):
• Recommended Tier: [${quoteCalculation.tierName}]
• Base Subscription: ₹${quoteCalculation.basePriceMonthly.toLocaleString('en-IN')}/mo
${quoteCalculation.extraResumes > 0 ? `• Extra Resume Pack: ₹${quoteCalculation.extraResumeCostMonthly.toLocaleString('en-IN')}/mo\n` : ''}${quoteCalculation.voiceCostMonthly > 0 ? `• AI Voice Screening: ₹${quoteCalculation.voiceCostMonthly.toLocaleString('en-IN')}/mo\n` : ''}• Effective Monthly Rate: ₹${quoteCalculation.effectiveMonthly.toLocaleString('en-IN')}/mo
• Net Subscription (${quoteCalculation.isAnnual ? '12 Months' : '1 Month'}): ₹${quoteCalculation.billedAmount.toLocaleString('en-IN')}
• GST (18%): ₹${quoteCalculation.gstAmount.toLocaleString('en-IN')}
-----------------------------------------
TOTAL INVESTMENT: ₹${quoteCalculation.grandTotal.toLocaleString('en-IN')} (incl. 18% GST)
-----------------------------------------
ESTIMATED SAVINGS VS LEGACY ATS:
• Legacy ATS Equivalent: ₹${quoteCalculation.competitorTotal.toLocaleString('en-IN')}
• Net Savings: ₹${quoteCalculation.savingsAmount.toLocaleString('en-IN')} (${quoteCalculation.savingsPercent}% lower)

To lock in this quotation, schedule a live walkthrough or reach our team at +91 9511779317.`;

    navigator.clipboard.writeText(quoteText);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 3000);
  };

  const whatsappQuoteUrl = useMemo(() => {
    const text = encodeURIComponent(
      `Hi HireX Team, I generated an instant quotation on your platform:
• Seats: ${calcRecruiters}
• Resumes: ${calcResumes}/mo
• Plan: ${quoteCalculation.tierName} (${calcBilling === 'annual' ? 'Annual (20% OFF)' : 'Monthly'})
• Total: ₹${quoteCalculation.grandTotal.toLocaleString('en-IN')} (incl GST)
I want to lock in this price and schedule a live demo.`
    );
    return `https://wa.me/919511779317?text=${text}`;
  }, [calcRecruiters, calcResumes, calcBilling, quoteCalculation]);

  const handleBookFromQuote = () => {
    setLeadForm(prev => ({
      ...prev,
      hiringVolume: `${calcRecruiters} recruiters • ${calcResumes} resumes/mo (${quoteCalculation.tierName} ${calcBilling})`,
    }));
    setBookingModalOpen(true);
  };

  const dashboardPath = userProfile?.role === 'admin' ? '/admin' : '/recruiter/jobs';

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileMenuOpen(false);
  };

  const handleLeadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.phone) return;

    setSubmittingLead(true);
    try {
      // 1. Submit through official @formspree/react handler
      await handleFormspreeSubmit(e);

      // 2. Persist to Firestore as reliable backup
      await addDoc(collection(db, 'clientPresentations'), {
        ...leadForm,
        offer: '1 Month Free Demo',
        createdAt: serverTimestamp(),
        source: 'Landing Page 1 Month Free Demo Inquiry',
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
    <div className="min-h-screen bg-[#FFFFFF] text-[#17213F] font-sans selection:bg-[#E9E7FF] selection:text-[#5145FF] antialiased">
      
      {/* ── 1. Compact White Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E5EAF5] px-4 sm:px-8 lg:px-12 transition-all">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo Lockup & Product of SNAB */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <Logo className="h-8 w-auto object-contain" isDark={false} />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-[#E5EAF5] text-[11px] text-[#7D89A5]">
              <span>A Product of</span>
              <a
                href="https://snab.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#101B3B] hover:text-[#5145FF] hover:underline"
              >
                SNAB
              </a>
            </div>
          </div>

          {/* Centered Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-[13px] font-semibold text-[#566481]">
            <a
              href="#why-hirex"
              onClick={(e) => scrollToSection(e, 'why-hirex')}
              className="hover:text-[#5145FF] transition-colors cursor-pointer"
            >
              Why HireX
            </a>
            <a
              href="#pipeline"
              onClick={(e) => scrollToSection(e, 'pipeline')}
              className="hover:text-[#5145FF] transition-colors cursor-pointer"
            >
              How It Works
            </a>
            <a
              href="#time-saved"
              onClick={(e) => scrollToSection(e, 'time-saved')}
              className="hover:text-[#5145FF] transition-colors cursor-pointer"
            >
              Time Saved
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="hover:text-[#5145FF] transition-colors cursor-pointer"
            >
              Pricing
            </a>
            <a
              href="#comparison"
              onClick={(e) => scrollToSection(e, 'comparison')}
              className="hover:text-[#5145FF] transition-colors cursor-pointer"
            >
              Comparison
            </a>
            <Link
              to="/active-jobs"
              className="hover:text-[#5145FF] transition-colors"
            >
              Job Board
            </Link>
          </nav>

          {/* Right Action Buttons & Contact */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="mailto:hello@snab.co.in"
              className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-[#566481] hover:text-[#5145FF] transition-colors"
            >
              <Mail className="size-3.5 text-[#5145FF]" />
              <span>hello@snab.co.in</span>
            </a>

            {user ? (
              <Link
                to={dashboardPath}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#101B3B] px-4 text-xs font-semibold text-white hover:bg-[#1e2a4f] transition-all shadow-xs"
              >
                <LayoutDashboard className="size-3.5" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="hidden sm:inline-flex h-9 items-center gap-1.5 px-4 rounded-full bg-gradient-to-r from-[#5145FF] to-[#6366F1] text-white hover:opacity-95 text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles className="size-3 text-amber-300" />
                  <span>1-Month Free Demo</span>
                </button>
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center px-4 rounded-full bg-[#101B3B] text-xs font-semibold text-white hover:bg-[#1a2b5e] transition-all shadow-xs"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden size-9 rounded-lg border border-[#E5EAF5] bg-[#F8F9FF] flex items-center justify-center text-[#17213F]"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E5EAF5] py-4 px-3 space-y-1.5 bg-white">
            <a
              href="#why-hirex"
              onClick={(e) => scrollToSection(e, 'why-hirex')}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-[#17213F] hover:bg-[#F8F9FF]"
            >
              Why HireX
            </a>
            <a
              href="#pipeline"
              onClick={(e) => scrollToSection(e, 'pipeline')}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-[#17213F] hover:bg-[#F8F9FF]"
            >
              How It Works
            </a>
            <a
              href="#time-saved"
              onClick={(e) => scrollToSection(e, 'time-saved')}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-[#17213F] hover:bg-[#F8F9FF]"
            >
              Time Saved
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-[#17213F] hover:bg-[#F8F9FF]"
            >
              Pricing
            </a>
            <a
              href="#comparison"
              onClick={(e) => scrollToSection(e, 'comparison')}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-[#17213F] hover:bg-[#F8F9FF]"
            >
              Comparison
            </a>
            <Link
              to="/active-jobs"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-[#17213F] hover:bg-[#F8F9FF]"
            >
              Job Board
            </Link>
            <div className="pt-2 border-t border-[#E5EAF5]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setBookingModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#5145FF] to-[#6366F1] shadow-xs"
              >
                <Sparkles className="size-3.5 text-amber-300" />
                <span>Claim 1-Month Free Demo</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section: Left Text + Right Floating ATS Mockup ── */}
      <section className="relative pt-12 pb-16 lg:pt-16 lg:pb-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto overflow-hidden">
        
        {/* Ambient atmospheric lavender-blue glow behind dashboard */}
        <div className="absolute top-1/4 right-8 -z-10 w-[580px] h-[580px] bg-gradient-to-br from-[#F1EFFF] via-[#E9E7FF]/60 to-[#EAF2FF]/40 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* Left Column (approx 44%) */}
          <div className="lg:col-span-5 text-left">
            
            {/* Lavender Pill Tag with 1-Month Free Demo announcement */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F1EFFF] text-[#5145FF] text-[11px] font-bold mb-4 border border-[#E5EAF5] shadow-2xs">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>🎉 Limited Offer: 1-Month Free Demo • Full Platform Access</span>
            </div>

            {/* Main Hero Heading (Wraps into three lines at 1024px) */}
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#101B3B] leading-[1.12]">
              The{' '}
              <span className="bg-gradient-to-r from-[#6655FF] to-[#4659FF] bg-clip-text text-transparent">
                AI-Powered ATS
              </span>{' '}
              That Does the Busywork for Your Recruiters
            </h1>

            {/* Supporting Headline */}
            <h2 className="mt-4 text-base sm:text-lg font-bold text-[#17213F]">
              Hire smarter. Hire faster.
            </h2>

            {/* Description */}
            <p className="mt-3 text-xs sm:text-[13.5px] text-[#566481] leading-relaxed max-w-lg">
              The AI-powered ATS that does the heavy lifting for your recruiters. Score resumes instantly, create jobs and ads in seconds, and reach candidates where they reply fastest with built-in WhatsApp.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5145FF] hover:bg-[#4135E8] text-white px-5 text-xs font-bold transition-all shadow-md shadow-[#5145FF]/20 hover:scale-[1.01] cursor-pointer"
              >
                <span>Start 1-Month Free Demo</span>
                <ArrowRight className="size-4" />
              </button>
              <Link
                to="/auth"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5DCED] bg-white text-[#17213F] hover:bg-[#F8F9FF] px-5 text-xs font-bold transition-all shadow-2xs"
              >
                <Play className="size-3.5 fill-[#5145FF] text-[#5145FF]" />
                <span>Explore Live Platform</span>
              </Link>
            </div>

            {/* 1 Month Free Demo Trust Guarantee */}
            <div className="mt-3.5 flex flex-wrap items-center gap-3 text-[11px] text-[#566481]">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <CheckCircle2 className="size-3.5 text-emerald-600" /> 1 Month Free Demo
              </span>
              <span className="text-[#D5DCED]">•</span>
              <span>Zero Credit Card Required</span>
              <span className="text-[#D5DCED]">•</span>
              <span>Full AI & WhatsApp Access</span>
            </div>

            {/* Product of SNAB & Contact Badge */}
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[#7D89A5]">
              <div className="flex items-center gap-1.5 font-medium">
                <Building2 className="size-3.5 text-[#5145FF]" />
                <span>A Product of <a href="https://snab.co.in" target="_blank" rel="noopener noreferrer" className="font-bold text-[#101B3B] hover:text-[#5145FF] hover:underline">SNAB</a> (<a href="https://snab.co.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#5145FF] hover:underline">snab.co.in</a>)</span>
              </div>
              <span className="text-[#D5DCED]">•</span>
              <a href="mailto:hello@snab.co.in" className="flex items-center gap-1.5 font-medium text-[#566481] hover:text-[#5145FF] transition-colors">
                <Mail className="size-3.5 text-[#5145FF]" />
                <span>hello@snab.co.in</span>
              </a>
            </div>
          </div>

          {/* Right Column — Product Showcase Dashboard (approx 56%) */}
          <div className="lg:col-span-7 relative">
            
            {/* Main Rounded Desktop Dashboard Window */}
            <div className="relative rounded-2xl bg-white border border-[#E5EAF5] shadow-xl shadow-[#101B3B]/05 overflow-hidden">
              
              {/* Top Window Bar with Search & Profile */}
              <div className="h-11 px-4 border-b border-[#E5EAF5] bg-[#F8F9FF] flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-[#F05B68]" />
                  <div className="size-2.5 rounded-full bg-[#F6A623]" />
                  <div className="size-2.5 rounded-full bg-[#10B981]" />
                </div>
                <div className="w-64 h-6.5 rounded-md bg-white border border-[#E5EAF5] px-2.5 flex items-center gap-2 text-[11px] text-[#7D89A5]">
                  <span>🔍 Search candidates, jobs...</span>
                </div>
                <div className="size-6 rounded-full bg-[#E5EAF5] flex items-center justify-center text-[10px] font-bold text-[#566481]">
                  HR
                </div>
              </div>

              {/* Workspace Body: Deep Navy Sidebar + White Workspace */}
              <div className="flex min-h-[350px]">
                
                {/* Deep Navy Vertical Sidebar */}
                <div className="w-36 border-r border-[#1e2a4f] bg-[#101B3B] text-slate-300 p-3 flex flex-col justify-between hidden sm:flex">
                  <div className="space-y-4">
                    <div className="font-extrabold text-[12px] text-white flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#5145FF]" />
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
                      <div className="px-2 py-1.5 rounded-md hover:bg-white/5 text-slate-400 flex items-center gap-2">
                        <Sparkles className="size-3" /> Analytics
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">v2.4 Production</div>
                </div>

                {/* Main White Candidate Ranking Workspace */}
                <div className="flex-1 p-4 bg-white overflow-x-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-bold text-[#101B3B]">Top Candidates</h3>
                      <p className="text-[10px] text-[#7D89A5]">Ranked by Claude 3.5 Sonnet fit score</p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#5145FF] bg-[#F1EFFF] px-2 py-0.5 rounded-full border border-[#E9E7FF]">
                      4 Filtered
                    </span>
                  </div>

                  {/* Candidate Table */}
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-[#E5EAF5] text-[10px] text-[#7D89A5] uppercase tracking-wider">
                        <th className="pb-2 font-medium">Candidate</th>
                        <th className="pb-2 font-medium">Match</th>
                        <th className="pb-2 font-medium hidden md:table-cell">Skills</th>
                        <th className="pb-2 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5EAF5]/60">
                      {MOCKUP_CANDIDATES.map((cand, idx) => (
                        <tr key={idx} className="hover:bg-[#F8F9FF] transition-colors">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <img
                                src={cand.avatar}
                                alt={cand.name}
                                className="size-6 rounded-full object-cover border border-[#E5EAF5]"
                              />
                              <div>
                                <div className="font-semibold text-[#17213F]">{cand.name}</div>
                                <div className="text-[9px] text-[#7D89A5]">{cand.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <span className="font-bold text-[#10B981]">
                              {cand.score}%
                            </span>
                          </td>
                          <td className="py-2.5 text-[#566481] text-[10px] hidden md:table-cell">
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

            {/* ── Floating Card 1: Circular AI Resume Score (Bottom Left) ── */}
            <div className="absolute -bottom-6 -left-3 sm:left-4 bg-white border border-[#E5EAF5] rounded-2xl p-3 shadow-xl shadow-[#101B3B]/08 flex items-center gap-3 z-20">
              <div className="relative size-12 flex items-center justify-center">
                <svg className="size-12 -rotate-90">
                  <circle cx="24" cy="24" r="20" className="stroke-[#E5EAF5]" strokeWidth="4" fill="transparent" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    className="stroke-[#5145FF]"
                    strokeWidth="4"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 * (1 - 0.98)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-[11px] font-black text-[#101B3B]">98%</span>
              </div>
              <div>
                <div className="text-[10px] text-[#7D89A5] font-medium">AI Resume Score</div>
                <div className="text-xs font-bold text-[#101B3B]">Deep Match Analysis</div>
              </div>
            </div>

            {/* ── Floating Card 2: WhatsApp Notification (Top Right) ── */}
            <div className="absolute -top-6 -right-2 sm:-right-4 bg-white border border-[#E5EAF5] rounded-2xl p-3 shadow-xl shadow-[#101B3B]/08 max-w-[215px] z-20">
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-[#10B981]">
                <span className="size-2 rounded-full bg-[#10B981] animate-pulse" />
                <span>WhatsApp Outreach</span>
              </div>
              <p className="text-[10.5px] text-[#17213F] leading-snug">
                "Hi! You're a great fit for the Frontend Developer role at SNAB. Can we schedule a quick chat?"
              </p>
              <div className="mt-1 flex items-center justify-between text-[9px] text-[#7D89A5]">
                <span>10:24 AM</span>
                <CheckCheck className="size-3 text-[#4285FF]" />
              </div>
            </div>

            {/* ── Floating Card 3: Job Post in 3 Seconds (Bottom Right) ── */}
            <div className="absolute -bottom-7 right-4 hidden sm:flex items-center gap-2 bg-gradient-to-r from-[#F6A623] to-[#FF8C00] text-white rounded-xl px-3.5 py-2 shadow-lg shadow-[#F6A623]/25 text-xs font-bold z-20">
              <Zap className="size-4 fill-white" />
              <div>
                <div className="text-[9px] uppercase tracking-wider text-amber-100 font-medium">Generated</div>
                <div>Job Post Created in 3s</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Four Metrics Horizontal Strip ── */}
        <div className="mt-16 pt-8 border-t border-[#E5EAF5]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            
            {/* Metric 1 */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-[#E5EAF5] shadow-2xs">
              <div className="size-10 rounded-lg bg-[#F1EFFF] flex items-center justify-center text-[#5145FF] shrink-0">
                <FileText className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-[#101B3B]">20,000+</div>
                <div className="text-[11px] text-[#566481]">Resumes Stored</div>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-[#E5EAF5] shadow-2xs">
              <div className="size-10 rounded-lg bg-[#EAF2FF] flex items-center justify-center text-[#4285FF] shrink-0">
                <Zap className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-[#101B3B]">25 GB</div>
                <div className="text-[11px] text-[#566481]">Storage, Extendable</div>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-[#E5EAF5] shadow-2xs">
              <div className="size-10 rounded-lg bg-[#EAFBF4] flex items-center justify-center text-[#10B981] shrink-0">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-[#101B3B]">92%+</div>
                <div className="text-[11px] text-[#566481]">WhatsApp Open Rate</div>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-[#E5EAF5] shadow-2xs">
              <div className="size-10 rounded-lg bg-[#F1EFFF] flex items-center justify-center text-[#5145FF] shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-[#101B3B]">1-Click</div>
                <div className="text-[11px] text-[#566481]">White Resume Mask</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. Section: WHY RECRUITERS SWITCH ── */}
      <section id="why-hirex" className="py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E5EAF5]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Section Left Title */}
          <div className="lg:col-span-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5145FF]">
              Why Recruiters Switch
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#101B3B] leading-tight">
              Traditional ATS Creates Work.{' '}
              <span className="text-[#5145FF]">HireX Snab</span> Does It.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#566481] leading-relaxed max-w-md">
              See why legacy recruiting software slows hiring teams down, and how HireX Snab automates the repetitive busywork.
            </p>
          </div>

          {/* Section Right 2 Comparison Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Card 1: Traditional ATS tools create work (Pale Rose) */}
            <div className="rounded-2xl p-5 bg-[#FFF2F3] border border-[#FED7DA] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded-lg bg-rose-100 flex items-center justify-center text-[#F05B68]">
                      <FileText className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-[#101B3B]">Traditional ATS tools</h3>
                      <div className="text-[10px] text-[#566481]">create work</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-[#F05B68] bg-rose-100/70 px-2 py-0.5 rounded-full">
                    Legacy Flow
                  </span>
                </div>
                <p className="text-[10px] text-[#7D89A5] mb-4">Manual, slow, and fragmented</p>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <XCircle className="size-4 text-[#F05B68] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#17213F]">Manual screening</div>
                      <div className="text-[11px] text-[#566481]">5+ hours lost per opening</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <XCircle className="size-4 text-[#F05B68] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#17213F]">Slow follow-ups</div>
                      <div className="text-[11px] text-[#566481]">Days or weeks of waiting</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <XCircle className="size-4 text-[#F05B68] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#17213F]">Missed talent</div>
                      <div className="text-[11px] text-[#566481]">Good fits get buried in the pile</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: HireX Snab ATS (Pale Mint) */}
            <div className="rounded-2xl p-5 bg-[#EAFBF4] border border-[#C6F6D5] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded-lg bg-emerald-100 flex items-center justify-center text-[#10B981]">
                      <Rocket className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-[#101B3B]">HireX Snab ATS</h3>
                      <div className="text-[10px] text-[#10B981]">AI does the heavy lifting</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    Automated
                  </span>
                </div>
                <p className="text-[10px] text-[#7D89A5] mb-4">Autonomous intelligence</p>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-[#10B981] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#17213F]">Automated AI resume scoring</div>
                      <div className="text-[11px] text-[#566481]">Deep Claude 3.5 Sonnet analysis</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-[#10B981] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#17213F]">Best-candidate suggestions</div>
                      <div className="text-[11px] text-[#566481]">Top matches surface first</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-[#10B981] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#17213F]">Personalised job picks</div>
                      <div className="text-[11px] text-[#566481]">80% less irrelevant applications</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. Section: END-TO-END HIRING PIPELINE ── */}
      <section id="pipeline" className="py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E5EAF5]">
        
        {/* Header */}
        <div className="text-left mb-10 max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5145FF]">
            End-To-End Pipeline
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#101B3B]">
            From Application to Offer, Automated
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#566481]">
            Four seamless stages that cut average time-to-hire from 38 days to under 7 days.
          </p>
        </div>

        {/* 4 Connected Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1 — Blue */}
          <div className="rounded-2xl p-5 bg-[#F4F8FE] border border-[#D5E6FB] relative flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-[#4285FF] text-white font-bold text-xs flex items-center justify-center">1</span>
                <span className="size-7 rounded-lg bg-blue-100 flex items-center justify-center text-[#4285FF]">
                  <FileText className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-[#101B3B]">Multi-Channel Ingestion</h3>
              <div className="text-[10px] font-semibold text-[#4285FF] mb-2">Apply</div>
              <p className="text-[11px] text-[#566481] leading-relaxed">
                Candidates apply via mobile portal, public job board, or recruiters batch-import 100+ resumes via AWS S3.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-blue-100 text-[9px] font-bold text-[#4285FF]">
              Step 1 of 4
            </div>
          </div>

          {/* Card 2 — Lavender */}
          <div className="rounded-2xl p-5 bg-[#F9F5FF] border border-[#E9DDFE] relative flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-[#5145FF] text-white font-bold text-xs flex items-center justify-center">2</span>
                <span className="size-7 rounded-lg bg-purple-100 flex items-center justify-center text-[#5145FF]">
                  <Brain className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-[#101B3B]">Instant 0–100% Fit</h3>
              <div className="text-[10px] font-semibold text-[#5145FF] mb-2">Score</div>
              <p className="text-[11px] text-[#566481] leading-relaxed">
                AWS Bedrock Claude 3.5 Sonnet ranks every resume against the job description in seconds.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-purple-100 text-[9px] font-bold text-[#5145FF]">
              Step 2 of 4
            </div>
          </div>

          {/* Card 3 — Mint */}
          <div className="rounded-2xl p-5 bg-[#EAFBF4] border border-[#C6F6D5] relative flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-[#10B981] text-white font-bold text-xs flex items-center justify-center">3</span>
                <span className="size-7 rounded-lg bg-emerald-100 flex items-center justify-center text-[#10B981]">
                  <MessageCircle className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-[#101B3B]">92% Open Rate</h3>
              <div className="text-[10px] font-semibold text-[#10B981] mb-2">Notify & Screen</div>
              <p className="text-[11px] text-[#566481] leading-relaxed">
                WhatsApp and email alerts, with conversational AI screening for applicants.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-emerald-100 text-[9px] font-bold text-[#10B981]">
              Step 3 of 4
            </div>
          </div>

          {/* Card 4 — Amber */}
          <div className="rounded-2xl p-5 bg-[#FFFAF4] border border-[#FED7AA] relative flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="size-6 rounded-full bg-[#F6A623] text-white font-bold text-xs flex items-center justify-center">4</span>
                <span className="size-7 rounded-lg bg-amber-100 flex items-center justify-center text-[#F6A623]">
                  <Users className="size-4" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-[#101B3B]">5.2x Faster Velocity</h3>
              <div className="text-[10px] font-semibold text-[#F6A623] mb-2">Hire</div>
              <p className="text-[11px] text-[#566481] leading-relaxed">
                Masked resumes, confident decisions, and efficient offer workflows.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-amber-100 text-[9px] font-bold text-[#F6A623]">
              Step 4 of 4
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. Section: CORE PLATFORM PILLARS ── */}
      <section className="py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E5EAF5]">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Title */}
          <div className="lg:col-span-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5145FF]">
              Core Platform Pillars
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#101B3B] leading-tight">
              Built-In AI, Built-In WhatsApp, Built-In Privacy
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#566481] leading-relaxed max-w-md">
              Everything your talent acquisition team needs included natively — no external subscriptions, no Zapier integrations.
            </p>
          </div>

          {/* Right 3 Pillars Grid with Micro-UI Previews */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Pillar 1 — Creation Engine */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5EAF5] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="size-8 rounded-lg bg-[#F1EFFF] flex items-center justify-center text-[#5145FF] mb-3">
                  <Sparkles className="size-4" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#5145FF]">
                  Creation Engine
                </div>
                <h3 className="text-xs font-bold text-[#101B3B] mt-1 mb-2">
                  AI creates jobs and ads in seconds
                </h3>
                <p className="text-[11px] text-[#566481] mb-3">
                  AI creates structured job posts and candidate advertisements.
                </p>

                {/* Compact UI Preview Card */}
                <div className="p-2.5 rounded-xl bg-[#F8F9FF] border border-[#E5EAF5] mb-3 text-[10px] space-y-1.5">
                  <div className="text-[9px] font-medium text-[#7D89A5]">Job Title</div>
                  <div className="h-5 px-2 rounded bg-white border border-[#E5EAF5] flex items-center text-slate-800">
                    Senior React Lead
                  </div>
                  <div className="h-5 px-2 rounded bg-[#5145FF] text-white font-bold flex items-center justify-center text-[9px]">
                    ✨ Generate Spec
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#566481]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#5145FF]" />
                    <span>AI job creation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#5145FF]" />
                    <span>AI candidate ads</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 2 — Candidate Outreach */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5EAF5] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="size-8 rounded-lg bg-[#EAFBF4] flex items-center justify-center text-[#10B981] mb-3">
                  <MessageCircle className="size-4" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#10B981]">
                  Candidate Outreach
                </div>
                <h3 className="text-xs font-bold text-[#101B3B] mt-1 mb-2">
                  Built-in WhatsApp and email alerts
                </h3>
                <p className="text-[11px] text-[#566481] mb-3">
                  Reach candidates through built-in outreach workflows.
                </p>

                {/* WhatsApp Chat Preview Card */}
                <div className="p-2.5 rounded-xl bg-[#EAFBF4] border border-[#C6F6D5] mb-3 text-[10px] space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-[#10B981] font-bold">
                    <span>SNAB HR</span>
                    <span>10:30 AM</span>
                  </div>
                  <p className="text-[9.5px] text-[#17213F] leading-tight">
                    Interview round 1 scheduled for tomorrow at 3 PM.
                  </p>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#566481]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#10B981]" />
                    <span>WhatsApp integration</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#10B981]" />
                    <span>Automatic stage updates</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#10B981]" />
                    <span>No third-party tools</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 3 — Security & Bias Control */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5EAF5] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="size-8 rounded-lg bg-[#EAF2FF] flex items-center justify-center text-[#4285FF] mb-3">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#4285FF]">
                  Security & Bias Control
                </div>
                <h3 className="text-xs font-bold text-[#101B3B] mt-1 mb-2">
                  Privacy and control built in
                </h3>
                <p className="text-[11px] text-[#566481] mb-3">
                  Protect candidate information with clear access controls.
                </p>

                {/* Masking Pill Preview */}
                <div className="p-2.5 rounded-xl bg-[#F8F9FF] border border-[#E5EAF5] mb-3 text-[10px] flex items-center justify-between">
                  <span className="text-[#566481]">Phone / Email</span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-400">
                    ████████
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#566481]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#4285FF]" />
                    <span>Resume masking (Clean White)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#4285FF]" />
                    <span>Individual role-based logins</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#4285FF]" />
                    <span>Admin-monitored logs</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 7. Section: TIME SAVED WITH HIREX SNAB + ROI CARD + PHOTO ── */}
      <section id="time-saved" className="py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E5EAF5]">
        
        {/* Header */}
        <div className="text-left mb-8 max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5145FF]">
            Hours Returned to Your Recruiters
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#101B3B]">
            Time Saved with HireX Snab
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#566481]">
            Estimates per hiring round, based on typical manual recruiter effort.
          </p>
        </div>

        {/* Content: Left Table + Right ROI & Photo Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Time Saved Table */}
          <div className="lg:col-span-7 overflow-x-auto">
            <div className="rounded-2xl border border-[#E5EAF5] bg-white shadow-2xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5EAF5] bg-[#F8F9FF] text-[10px] text-[#7D89A5] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Task</th>
                    <th className="py-3 px-4 font-semibold">Traditional ATS</th>
                    <th className="py-3 px-4 font-semibold text-[#5145FF]">HireX Snab</th>
                    <th className="py-3 px-4 font-semibold text-[#10B981] text-right">Time Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF5]/60">
                  {TIME_SAVED_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#F8F9FF] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#101B3B]">{row.task}</td>
                      <td className="py-3.5 px-4 text-[#566481]">{row.traditional}</td>
                      <td className="py-3.5 px-4 font-semibold text-[#5145FF]">{row.hirex}</td>
                      <td className="py-3.5 px-4 font-bold text-[#10B981] text-right">{row.saved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: ROI Metrics + Recruiter Photo */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl p-5 bg-[#F8F9FF] border border-[#E5EAF5] shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center gap-5">
              
              {/* ROI Numbers */}
              <div className="space-y-3.5 flex-1 w-full">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#F1EFFF] flex items-center justify-center text-[#5145FF]">
                    <Briefcase className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-[#101B3B]">6</div>
                    <div className="text-[10px] text-[#7D89A5]">Monthly Open Roles</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#EAF2FF] flex items-center justify-center text-[#4285FF]">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-[#101B3B]">200</div>
                    <div className="text-[10px] text-[#7D89A5]">Applicants Per Opening</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#F1EFFF] flex items-center justify-center text-[#5145FF]">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-[#101B3B]">420 hrs</div>
                    <div className="text-[10px] text-[#7D89A5]">Hours Saved / Mo</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#EAFBF4] flex items-center justify-center text-[#10B981]">
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <div className="text-base font-black text-[#10B981]">₹2.73 Lakhs</div>
                    <div className="text-[10px] text-[#7D89A5]">Cost Saved Monthly</div>
                  </div>
                </div>

                <div className="text-[9px] text-[#7D89A5] italic pt-1">
                  Illustrative estimate
                </div>
              </div>

              {/* Photo with Handwritten-Style Annotation */}
              <div className="relative w-full sm:w-48 shrink-0">
                <div className="absolute -top-3 left-2 z-10 font-serif italic text-xs font-bold text-[#5145FF] bg-white px-2.5 py-0.5 rounded-full shadow-xs border border-[#E5EAF5]">
                  More time for what matters
                </div>
                <img
                  src="/recruiter_hero.jpg"
                  alt="Professional recruiter working on laptop"
                  className="w-full h-44 object-cover rounded-xl border border-[#E5EAF5] shadow-xs"
                />
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 8. Section: HEAD-TO-HEAD CAPABILITIES ── */}
      <section id="comparison" className="py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E5EAF5]">
        
        {/* Header */}
        <div className="text-left mb-8 max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5145FF]">
            Head-To-Head Capabilities
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#101B3B]">
            HireX Snab vs Traditional ATS
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#566481]">
            Direct side-by-side capability evaluation for talent teams and enterprise leadership.
          </p>
        </div>

        {/* 3-Column Comparison Table */}
        <div className="rounded-2xl border border-[#E5EAF5] bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5EAF5] bg-[#F8F9FF] text-[10px] text-[#7D89A5] uppercase tracking-wider">
                <th className="py-3.5 px-5 font-semibold w-1/4">Capability</th>
                <th className="py-3.5 px-5 font-semibold w-3/8">Traditional ATS</th>
                <th className="py-3.5 px-5 font-semibold text-[#5145FF] w-3/8 bg-[#F1EFFF]/50">HireX Snab ATS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF5]/60">
              {CAPABILITY_ROWS.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#F8F9FF] transition-colors">
                  <td className="py-3.5 px-5 font-bold text-[#101B3B]">{row.capability}</td>
                  <td className="py-3.5 px-5 text-[#566481]">{row.traditional}</td>
                  <td className="py-3.5 px-5 font-semibold text-[#5145FF] bg-[#F1EFFF]/30">{row.hirex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 9. Section: INTERACTIVE COST ESTIMATOR & MARKET BENCHMARK (Pricing) ── */}
      <section id="pricing" className="py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E5EAF5]">
        
        {/* Header & View Switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5145FF] flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              Transparent Pricing & Quotation Engine
            </span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#101B3B]">
              Calculate Your Cost & Get an Instant Quote
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#7D89A5]">
              Configure your team size and monthly hiring volume. Receive an itemized, executive-ready commercial quotation with direct legacy ATS cost comparisons.
            </p>
          </div>

          {/* Dual Tabs */}
          <div className="inline-flex p-1 bg-[#F1EFFF] rounded-xl border border-[#E5EAF5] self-start md:self-auto shadow-2xs">
            <button
              onClick={() => setPricingTab('estimator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                pricingTab === 'estimator'
                  ? 'bg-white text-[#5145FF] shadow-2xs'
                  : 'text-[#566481] hover:text-[#101B3B]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Interactive Cost Estimator
            </button>
            <button
              onClick={() => setPricingTab('benchmark')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                pricingTab === 'benchmark'
                  ? 'bg-white text-[#5145FF] shadow-2xs'
                  : 'text-[#566481] hover:text-[#101B3B]'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              Market Benchmark Table
            </button>
          </div>
        </div>

        {pricingTab === 'estimator' ? (
          /* ── Interactive Cost Estimator & Quote View ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Input Controls Card (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5EAF5] p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5EAF5]/80 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#F1EFFF] text-[#5145FF] flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#101B3B]">Hiring Volume & Team Usage</h3>
                    <p className="text-[11px] text-[#7D89A5]">Adjust sliders to simulate your agency or company recruitment scale</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCalcRecruiters(3);
                    setCalcResumes(500);
                    setCalcJobs(10);
                    setCalcBilling('annual');
                    setCalcVoiceScreening(false);
                  }}
                  className="text-[11px] font-semibold text-[#5145FF] hover:underline"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="space-y-6">
                {/* 1. Recruiter Seats */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-[#101B3B] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#5145FF]" />
                      Recruiter & Hiring Manager Seats
                    </span>
                    <span className="text-sm font-bold text-[#5145FF] bg-[#F1EFFF] px-2.5 py-0.5 rounded-md border border-[#E9E7FF]">
                      {calcRecruiters} {calcRecruiters === 1 ? 'Recruiter' : 'Recruiters'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={calcRecruiters}
                    onChange={(e) => setCalcRecruiters(parseInt(e.target.value))}
                    className="w-full accent-[#5145FF] cursor-pointer"
                  />
                  <div className="flex items-center justify-between mt-2 text-[10px] text-[#7D89A5]">
                    <span>1 Solo Recruiter</span>
                    <span>5 Agency Seats</span>
                    <span>10 Team</span>
                    <span>20+ Enterprise</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {[1, 3, 5, 8, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCalcRecruiters(num)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${
                          calcRecruiters === num
                            ? 'bg-[#5145FF] text-white'
                            : 'bg-[#F8F9FF] text-[#566481] hover:bg-[#F1EFFF]'
                        }`}
                      >
                        {num} {num === 1 ? 'Seat' : 'Seats'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Monthly Resumes */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-[#101B3B] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#5145FF]" />
                      Candidate Resumes Screened / Month
                    </span>
                    <span className="text-sm font-bold text-[#5145FF] bg-[#F1EFFF] px-2.5 py-0.5 rounded-md border border-[#E9E7FF]">
                      {calcResumes.toLocaleString('en-IN')} Resumes
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={10000}
                    step={100}
                    value={calcResumes}
                    onChange={(e) => setCalcResumes(parseInt(e.target.value))}
                    className="w-full accent-[#5145FF] cursor-pointer"
                  />
                  <div className="flex items-center justify-between mt-2 text-[10px] text-[#7D89A5]">
                    <span>100 / mo</span>
                    <span>2,500 / mo</span>
                    <span>5,000 / mo</span>
                    <span>10,000+ / mo</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {[250, 500, 1500, 3000, 5000].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCalcResumes(num)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${
                          calcResumes === num
                            ? 'bg-[#5145FF] text-white'
                            : 'bg-[#F8F9FF] text-[#566481] hover:bg-[#F1EFFF]'
                        }`}
                      >
                        {num.toLocaleString('en-IN')} / mo
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Active Job Openings */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-[#101B3B] flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#5145FF]" />
                      Active Job Openings Handled Concurrently
                    </span>
                    <span className="text-sm font-bold text-[#5145FF] bg-[#F1EFFF] px-2.5 py-0.5 rounded-md border border-[#E9E7FF]">
                      {calcJobs} Active Roles
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    step={1}
                    value={calcJobs}
                    onChange={(e) => setCalcJobs(parseInt(e.target.value))}
                    className="w-full accent-[#5145FF] cursor-pointer"
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px] text-[#7D89A5]">
                    <span>1 Role</span>
                    <span>15 Roles</span>
                    <span>30 Roles</span>
                    <span>50+ Roles (Unlimited)</span>
                  </div>
                </div>

                {/* 4. Billing Cycle Selection */}
                <div className="pt-2">
                  <div className="text-xs font-semibold text-[#101B3B] mb-2">Billing Frequency & Contract</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCalcBilling('annual')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        calcBilling === 'annual'
                          ? 'border-[#5145FF] bg-[#F1EFFF]/50 ring-1 ring-[#5145FF]'
                          : 'border-[#E5EAF5] bg-white hover:bg-[#F8F9FF]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#101B3B]">Annual Billing</span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Save 20%
                        </span>
                      </div>
                      <p className="text-[10px] text-[#566481] mt-1">Priority dedicated onboarding & locked commercial rate</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcBilling('monthly')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        calcBilling === 'monthly'
                          ? 'border-[#5145FF] bg-[#F1EFFF]/50 ring-1 ring-[#5145FF]'
                          : 'border-[#E5EAF5] bg-white hover:bg-[#F8F9FF]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#101B3B]">Monthly Billing</span>
                        <span className="text-[9px] font-bold text-[#7D89A5]">Flexible</span>
                      </div>
                      <p className="text-[10px] text-[#566481] mt-1">Pay-as-you-go, cancel or upgrade anytime</p>
                    </button>
                  </div>
                </div>

                {/* 5. Included & Add-on Services */}
                <div className="pt-2 border-t border-[#E5EAF5]/80 space-y-2.5">
                  <div className="text-xs font-semibold text-[#101B3B]">Included & Optional Capabilities</div>
                  
                  {/* WhatsApp Built-in (Always Free) */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Native WhatsApp Alerts (Baileys Engine)
                        </div>
                        <p className="text-[10px] text-emerald-800">Unlimited candidate WhatsApp alerts without 3rd party SMS or Meta markup fees.</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                      ₹0 / Included
                    </span>
                  </div>

                  {/* Voice Screening Add-on */}
                  <label className="flex items-center justify-between p-3 rounded-xl border border-[#E5EAF5] hover:bg-[#F8F9FF] cursor-pointer transition-all">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={calcVoiceScreening}
                        onChange={(e) => setCalcVoiceScreening(e.target.checked)}
                        className="w-4 h-4 rounded text-[#5145FF] focus:ring-[#5145FF] accent-[#5145FF]"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#101B3B] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#5145FF]" />
                          Automated AI Voice Screening Assistant
                        </div>
                        <p className="text-[10px] text-[#566481]">Conducts automatic audio candidate pre-interviews with instant transcripts.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#5145FF] shrink-0">
                      +₹999 / mo
                    </span>
                  </label>
                </div>

              </div>
            </div>

            {/* Right: Instant Commercial Quotation Document (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              
              <div className="bg-white rounded-2xl border-2 border-[#5145FF]/30 p-6 sm:p-7 shadow-xl shadow-[#5145FF]/05 relative overflow-hidden">
                {/* Official Stamp Watermark Accent */}
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-[#5145FF]/05 rounded-full pointer-events-none" />

                {/* Quotation Top Badge */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#E5EAF5]">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#5145FF] bg-[#F1EFFF] px-2 py-0.5 rounded">
                      Commercial Quotation
                    </span>
                    <h3 className="mt-1 text-sm font-extrabold text-[#101B3B]">HireX Snab ATS Proposal</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-[#7D89A5]">Valid for 30 Days</span>
                    <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Verified Price
                    </div>
                  </div>
                </div>

                {/* Recommended Tier & Price Hero */}
                <div className="my-4 p-4 rounded-xl bg-gradient-to-br from-[#F1EFFF] to-[#F8F9FF] border border-[#E9E7FF]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#5145FF]">Recommended Plan</span>
                      <h4 className="text-base font-extrabold text-[#101B3B]">{quoteCalculation.tierName}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-[#5145FF] tracking-tight">
                        ₹{quoteCalculation.effectiveMonthly.toLocaleString('en-IN')}
                        <span className="text-xs font-semibold text-[#566481]">/mo</span>
                      </div>
                      <span className="text-[10px] text-[#7D89A5]">
                        {quoteCalculation.isAnnual ? 'Billed annually with 20% discount' : 'Billed monthly'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Line Item Breakdown */}
                <div className="space-y-2 py-2 text-xs border-b border-[#E5EAF5]">
                  <div className="flex justify-between text-[#566481]">
                    <span>Recruiting Seats ({calcRecruiters} seat{calcRecruiters > 1 ? 's' : ''})</span>
                    <span className="font-semibold text-[#101B3B]">₹{quoteCalculation.basePriceMonthly.toLocaleString('en-IN')}/mo</span>
                  </div>
                  <div className="flex justify-between text-[#566481]">
                    <span>Monthly Resumes ({calcResumes.toLocaleString('en-IN')}/mo)</span>
                    <span className="font-semibold text-[#101B3B]">
                      {quoteCalculation.extraResumes > 0 ? `+₹${quoteCalculation.extraResumeCostMonthly.toLocaleString('en-IN')}/mo` : 'Included'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#566481]">
                    <span>Concurrent Active Jobs ({calcJobs} roles)</span>
                    <span className="font-semibold text-emerald-600">Unlimited / Free</span>
                  </div>
                  <div className="flex justify-between text-[#566481]">
                    <span>WhatsApp Candidate Automation</span>
                    <span className="font-semibold text-emerald-600">₹0 (Included)</span>
                  </div>
                  {calcVoiceScreening && (
                    <div className="flex justify-between text-[#566481]">
                      <span>AI Voice Screening Assistant</span>
                      <span className="font-semibold text-[#101B3B]">+₹999/mo</span>
                    </div>
                  )}
                  {quoteCalculation.isAnnual && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Annual Commitment Discount (20% OFF)</span>
                      <span>-₹{(Math.round(quoteCalculation.monthlyGross * 0.2)).toLocaleString('en-IN')}/mo</span>
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="pt-3 pb-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#566481]">
                    <span>Net Subscription ({quoteCalculation.isAnnual ? '12 Months' : '1 Month'})</span>
                    <span className="font-bold text-[#101B3B]">₹{quoteCalculation.billedAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-[#7D89A5] text-[11px]">
                    <span>GST (18% for tax credit)</span>
                    <span>₹{quoteCalculation.gstAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-[#101B3B] pt-2 border-t border-[#E5EAF5]">
                    <span>Total Investment:</span>
                    <span className="text-[#5145FF] text-base font-black">
                      ₹{quoteCalculation.grandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Legacy ATS Comparison Box */}
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 mb-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950">Legacy ATS (Zoho/Greenhouse):</span>
                    <span className="text-[#7D89A5] line-through font-semibold">
                      ₹{quoteCalculation.competitorTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="font-extrabold text-emerald-800 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5" /> Direct Estimated Savings:
                    </span>
                    <span className="font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                      Save ₹{quoteCalculation.savingsAmount.toLocaleString('en-IN')} ({quoteCalculation.savingsPercent}%)
                    </span>
                  </div>
                </div>

                {/* Quotation Action Buttons */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleBookFromQuote}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#5145FF] text-white font-bold text-xs shadow-md shadow-[#5145FF]/20 hover:bg-[#4336eb] active:scale-[0.99] transition-all"
                  >
                    <span>Lock in This Quote & Start 1-Month Free Demo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyQuote}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#E5EAF5] bg-[#F8F9FF] text-[#101B3B] text-[11px] font-bold hover:bg-[#F1EFFF] transition-all"
                    >
                      {copiedQuote ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied Quote!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#5145FF]" />
                          <span>Copy Quotation</span>
                        </>
                      )}
                    </button>

                    <a
                      href={whatsappQuoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-[11px] font-bold hover:bg-emerald-100 transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Send to WhatsApp</span>
                    </a>
                  </div>
                </div>

                <p className="text-[10px] text-center text-[#7D89A5] mt-3">
                  Includes 1-Month Free Demo with full AI features. No credit card required.
                </p>

              </div>

            </div>

          </div>
        ) : (
          /* ── Pricing Comparison Table View ── */
          <div className="rounded-2xl border border-[#E5EAF5] bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5EAF5] bg-[#F8F9FF] text-[10px] text-[#7D89A5] uppercase tracking-wider">
                  <th className="py-3.5 px-5 font-semibold">ATS Tool</th>
                  <th className="py-3.5 px-5 font-semibold">Indicative Price (INR)</th>
                  <th className="py-3.5 px-5 font-semibold">Pricing Model</th>
                  <th className="py-3.5 px-5 font-semibold">Market Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF5]/60">
                {PRICING_BENCHMARK_ROWS.map((row, idx) => (
                  <tr
                    key={idx}
                    className={
                      row.isHirex
                        ? 'bg-[#F1EFFF]/60 font-medium'
                        : 'hover:bg-[#F8F9FF] transition-colors'
                    }
                  >
                    <td className="py-3.5 px-5 font-bold text-[#101B3B]">
                      <div className="flex items-center gap-2">
                        <span>{row.tool}</span>
                        {row.isHirex && (
                          <span className="text-[9px] font-bold text-[#5145FF] bg-white px-2 py-0.5 rounded-full border border-[#E9E7FF] shadow-2xs">
                            Recommended
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`py-3.5 px-5 ${row.isHirex ? 'font-bold text-[#5145FF]' : 'text-[#17213F]'}`}>
                      {row.price}
                    </td>
                    <td className="py-3.5 px-5 text-[#566481]">
                      {row.model}
                    </td>
                    <td className="py-3.5 px-5 text-[11px] text-[#7D89A5]">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 10. Section: FINAL CONVERSION CTA ── */}
      <section className="py-16 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#E5EAF5]">
        <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-[#F1EFFF] via-[#F8F9FF] to-white border border-[#E5EAF5] shadow-lg shadow-[#5145FF]/05 relative overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-8">
              <div className="size-11 rounded-2xl bg-white border border-[#E5EAF5] flex items-center justify-center text-[#5145FF] mb-4 shadow-2xs">
                <Rocket className="size-6" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101B3B]">
                Ready to Transform Your Hiring? Start with 1 Month 100% Free.
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-[#566481] leading-relaxed max-w-xl">
                Claim your 1-month free demo and see HireX Snab in action — real resume parsing, candidate portal, WhatsApp job matching, and live AI screening with zero initial cost.
              </p>

              {/* Action Buttons */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5145FF] hover:bg-[#4135E8] text-white px-6 text-xs font-bold transition-all shadow-md shadow-[#5145FF]/20 hover:scale-[1.01] cursor-pointer"
                >
                  <span>Claim 1-Month Free Demo & Walkthrough</span>
                  <ArrowRight className="size-4" />
                </button>
                <Link
                  to="/auth"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5DCED] bg-white text-[#17213F] hover:bg-[#F8F9FF] px-6 text-xs font-bold transition-all shadow-2xs"
                >
                  <span>Explore Live Platform</span>
                </Link>
              </div>

              {/* Supporting Details */}
              <div className="mt-6 flex flex-wrap items-center gap-5 text-[11px] text-[#7D89A5]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-[#5145FF]" />
                  <span>1-Month Free Demo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-[#10B981]" />
                  <span>Zero Credit Card Required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-[#4285FF]" />
                  <span>Full AI & WhatsApp Access</span>
                </div>
              </div>
            </div>

            {/* Right Quick Form / Direct Booking Trigger */}
            <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-[#E5EAF5] shadow-xs">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold mb-2 border border-emerald-200">
                🎁 1-Month Free Access
              </div>
              <div className="text-xs font-bold text-[#101B3B] mb-1">
                Activate 1-Month Free Demo
              </div>
              <p className="text-[11px] text-[#7D89A5] mb-4">
                Fill details for instant 1-month demo setup and tailored walkthrough.
              </p>
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="w-full h-10 rounded-xl bg-[#101B3B] hover:bg-[#1e2a4f] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <Calendar className="size-3.5" />
                <span>Claim Free Demo Now</span>
              </button>
              <div className="mt-3 text-center">
                <span className="text-[10px] text-[#7D89A5]">⚡ 15-Min Response Guarantee</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 11. Compact Dark Navy Footer ── */}
      <footer className="bg-[#101B3B] text-white border-t border-slate-800 py-12 px-4 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Left Brand Lockup */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#5145FF]" />
                <span className="font-extrabold text-base tracking-tight text-white">
                  SNAB hireX
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                HireX Snab ATS — The AI-powered ATS that does the busywork for your recruiters. A flagship product of{' '}
                <a href="https://snab.co.in" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#818CF8] font-semibold underline underline-offset-2">
                  SNAB (snab.co.in)
                </a>.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <a href="mailto:hello@snab.co.in" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
                  <Mail className="size-3.5 text-[#818CF8]" />
                  <span>hello@snab.co.in</span>
                </a>
                <span className="text-slate-600">•</span>
                <a href="https://wa.me/919511779317" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
                  <Phone className="size-3.5 text-emerald-400" />
                  <span>+91 9511779317</span>
                </a>
              </div>
              <div className="pt-2 flex items-center gap-3 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">
                  GST Invoicing
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">
                  Clean White Masking
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">
                  Admin Forensic Logs
                </span>
              </div>
            </div>

            {/* Useful Links */}
            <div className="md:col-span-4 grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="font-bold text-white text-[11px] uppercase tracking-wider">Product</div>
                <div>
                  <a href="#why-hirex" onClick={(e) => scrollToSection(e, 'why-hirex')} className="text-slate-400 hover:text-white transition-colors">
                    Why HireX
                  </a>
                </div>
                <div>
                  <a href="#pipeline" onClick={(e) => scrollToSection(e, 'pipeline')} className="text-slate-400 hover:text-white transition-colors">
                    Hiring Pipeline
                  </a>
                </div>
                <div>
                  <a href="#comparison" onClick={(e) => scrollToSection(e, 'comparison')} className="text-slate-400 hover:text-white transition-colors">
                    Capabilities
                  </a>
                </div>
                <div>
                  <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="text-slate-400 hover:text-white transition-colors">
                    Market Pricing
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-white text-[11px] uppercase tracking-wider">Access</div>
                <div>
                  <Link to="/active-jobs" className="text-slate-400 hover:text-white transition-colors">
                    Public Job Board
                  </Link>
                </div>
                <div>
                  <button type="button" onClick={() => setBookingModalOpen(true)} className="text-slate-400 hover:text-white transition-colors text-left">
                    Client Presentation
                  </button>
                </div>
                <div>
                  <Link to="/auth" className="text-slate-400 hover:text-white transition-colors">
                    Recruiter Login
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Live Link / SNAB Info */}
            <div className="md:col-span-3 space-y-2 text-right md:text-right">
              <div className="font-bold text-white text-[11px] uppercase tracking-wider">A Product of SNAB</div>
              <div>
                <a
                  href="https://snab.co.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#818CF8] hover:text-white hover:underline"
                >
                  <span>snab.co.in</span>
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-slate-300">
                Inquiries:{' '}
                <a href="mailto:hello@snab.co.in" className="text-white hover:underline font-medium">
                  hello@snab.co.in
                </a>
              </p>
              <p className="text-[10px] text-slate-500">
                Enterprise Recruitment Infrastructure
              </p>
            </div>

          </div>

          {/* Bottom Copyright Strip */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
            <div>
              © 2026 SNAB Technologies Private Limited. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setBookingModalOpen(true)} className="hover:text-white transition-colors">
                Book Walkthrough
              </button>
              <a href="https://wa.me/919511779317" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Support WhatsApp
              </a>
            </div>
          </div>

        </div>
      </footer>

      {/* ── 12. Client Presentation Booking Modal (Integrated with Firestore) ── */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl border border-[#E5EAF5] shadow-2xl p-6 sm:p-8">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setBookingModalOpen(false)}
              className="absolute top-4 right-4 size-8 rounded-full bg-[#F8F9FF] border border-[#E5EAF5] flex items-center justify-center text-[#7D89A5] hover:text-[#17213F]"
            >
              <X className="size-4" />
            </button>

            {formspreeState.succeeded || leadSubmitted ? (
              <div className="text-center py-6">
                <div className="size-12 rounded-full bg-[#EAFBF4] text-[#10B981] flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="size-7" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold mb-2 border border-emerald-200">
                  🎁 1-Month Free Demo Reserved
                </div>
                <h3 className="text-lg font-bold text-[#101B3B]">Demo Request & Inquiry Received!</h3>
                <p className="mt-2 text-xs text-[#566481]">
                  Our talent solutions lead will reach out within 15 minutes to activate your 1-month free demo and schedule your live walkthrough.
                </p>
                <div className="mt-6">
                  <a
                    href="https://wa.me/919511779317?text=Hi%2C%20I%20have%20submitted%20inquiry%20for%201-Month%20Free%20Demo%20on%20HireX%20Snab"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold transition-all shadow-md"
                  >
                    <MessageCircle className="size-4" />
                    <span>Chat on WhatsApp Directly</span>
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[#5145FF] text-xs font-bold">
                    <Calendar className="size-4" />
                    <span>Client Presentation & Walkthrough</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700 font-extrabold text-[10px]">
                    🎁 1-Month Free Demo
                  </span>
                </div>
                <h3 className="text-xl font-black text-[#101B3B]">
                  Claim Your 1-Month Free Demo
                </h3>
                <p className="mt-1 text-xs text-[#7D89A5] mb-6">
                  Get full 30-day platform access — AI resume parsing, candidate portal, WhatsApp job matching, and live walkthrough. Zero credit card required.
                </p>

                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  {/* Hidden context fields for Formspree */}
                  <input type="hidden" name="_subject" value="New 1-Month Free Demo Inquiry - HireX Snab" />
                  <input type="hidden" name="offer" value="1-Month Free Demo" />
                  <input type="hidden" name="inquiryType" value="1 Month Free Demo & Walkthrough" />

                  <div>
                    <label className="block text-[11px] font-bold text-[#17213F] mb-1">Contact Name *</label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      required
                      value={leadForm.name}
                      onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full h-10 px-3.5 rounded-xl border border-[#D5DCED] bg-[#F8F9FF] text-xs text-[#17213F] focus:outline-none focus:border-[#5145FF] focus:bg-white"
                    />
                    <ValidationError prefix="Name" field="name" errors={formspreeState.errors} className="text-red-500 text-[10px] mt-1" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#17213F] mb-1">Work Email *</label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        required
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        placeholder="rahul@company.com"
                        className="w-full h-10 px-3.5 rounded-xl border border-[#D5DCED] bg-[#F8F9FF] text-xs text-[#17213F] focus:outline-none focus:border-[#5145FF] focus:bg-white"
                      />
                      <ValidationError prefix="Email" field="email" errors={formspreeState.errors} className="text-red-500 text-[10px] mt-1" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#17213F] mb-1">Phone / WhatsApp *</label>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        required
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full h-10 px-3.5 rounded-xl border border-[#D5DCED] bg-[#F8F9FF] text-xs text-[#17213F] focus:outline-none focus:border-[#5145FF] focus:bg-white"
                      />
                      <ValidationError prefix="Phone" field="phone" errors={formspreeState.errors} className="text-red-500 text-[10px] mt-1" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#17213F] mb-1">Company / Agency Name</label>
                    <input
                      type="text"
                      name="company"
                      id="company"
                      value={leadForm.company}
                      onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                      placeholder="e.g. Acme Talent Partners"
                      className="w-full h-10 px-3.5 rounded-xl border border-[#D5DCED] bg-[#F8F9FF] text-xs text-[#17213F] focus:outline-none focus:border-[#5145FF] focus:bg-white"
                    />
                    <ValidationError prefix="Company" field="company" errors={formspreeState.errors} className="text-red-500 text-[10px] mt-1" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#17213F] mb-1">Monthly Hiring Volume</label>
                    <select
                      name="hiringVolume"
                      id="hiringVolume"
                      value={leadForm.hiringVolume}
                      onChange={(e) => setLeadForm({ ...leadForm, hiringVolume: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-[#D5DCED] bg-[#F8F9FF] text-xs text-[#17213F] focus:outline-none focus:border-[#5145FF] focus:bg-white"
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
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-[#5145FF] to-[#3B82F6] hover:from-[#4135E8] hover:to-[#2563EB] text-white text-xs font-bold transition-all shadow-md shadow-[#5145FF]/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>{submittingLead || formspreeState.submitting ? 'Submitting to Formspree...' : 'Claim 1-Month Free Demo & Walkthrough'}</span>
                      <ArrowRight className="size-4" />
                    </button>
                    <div className="mt-2 text-center text-[10px] text-[#7D89A5]">
                      ⚡ Instant 15-Min Response • No Credit Card • 1 Month Free Demo
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
