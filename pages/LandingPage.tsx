import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronUp,
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
  Edit3,
  TrendingUp,
  MessageSquare,
  User,
  HelpCircle,
  BadgeCheck
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useForm, ValidationError } from '@formspree/react';
import { useAuth } from '../context/AuthContext';
import HireXLogo, { HireXMark } from '../components/HireXLogo';

// ── Smooth Organic Continuous Bezier Paths for On-Page Journey Flow ──
// Each section k starts at the exact X coordinate and vertical tangent where section k-1 ended!
// 0: (180,0) -> (880,900)   [Hero Overview]
// 1: (880,0) -> (360,900)   [Pipeline Kanban]
// 2: (360,0) -> (1120,900)  [AI Matching]
// 3: (1120,0) -> (280,900)  [Client Portal]
// 4: (280,0) -> (440,900)   [Productivity]
// 5: (440,0) -> (1080,900)  [Pricing]
// 6: (1080,0) -> (520,900)  [FAQ]
// 7: (520,0) -> (720,640)   [CTA finish]
const SECTION_CURVE_PATHS = [
  // 01: Hero (gentle rounded S-curve looping down behind title, exiting vertically at 880,900)
  "M 180,0 C 180,120 360,200 560,180 C 780,150 920,80 1140,120 C 1340,160 1400,380 1320,540 C 1240,700 1040,680 940,740 C 880,780 880,840 880,900",
  // 02: Pipeline (enters vertically at 880,0, sweeps around Kanban columns, exiting vertically at 360,900)
  "M 880,0 C 880,120 1120,200 1260,300 C 1400,420 1340,620 1140,620 C 900,620 780,420 580,480 C 380,540 220,680 180,760 C 140,840 360,820 360,900",
  // 03: AI Matching (enters vertically at 360,0, weaves through qualification pills & comparison, exiting vertically at 1120,900)
  "M 360,0 C 360,100 180,240 200,380 C 220,540 520,520 740,460 C 980,400 1260,300 1340,460 C 1400,620 1280,760 1180,820 C 1140,840 1120,860 1120,900",
  // 04: Client Portal (enters vertically at 1120,0, flows through dark review card & actions, exiting vertically at 280,900)
  "M 1120,0 C 1120,120 1300,240 1320,400 C 1340,560 1160,640 920,600 C 680,560 480,440 320,520 C 160,600 120,740 180,800 C 220,850 280,840 280,900",
  // 05: Productivity (enters vertically at 280,0, loops around 14h badge & savings cards, exiting vertically at 440,900)
  "M 280,0 C 280,120 180,260 220,380 C 260,520 480,440 700,460 C 940,480 1180,380 1260,540 C 1340,700 1220,820 1040,850 C 760,880 440,820 440,900",
  // 06: Pricing (enters vertically at 440,0, winds around team slider & calculator cards, exiting vertically at 1080,900)
  "M 440,0 C 440,120 220,240 160,380 C 100,520 220,660 460,620 C 700,580 920,440 1140,480 C 1340,520 1360,720 1240,820 C 1160,880 1080,840 1080,900",
  // 07: FAQ (enters vertically at 1080,0, gracefully arches behind questions, exiting vertically at 520,900)
  "M 1080,0 C 1080,120 1280,260 1240,420 C 1200,580 980,520 740,540 C 500,560 300,440 180,560 C 60,680 120,820 320,850 C 440,870 520,840 520,900",
  // 08: Start Trial (enters vertically at 520,0, swirls into dark CTA hero, terminating right at trial CTA)
  "M 520,0 C 520,120 320,260 280,420 C 240,580 440,700 660,680 C 880,660 1160,540 1220,380 C 1280,220 1080,160 900,240 C 720,320 680,520 720,640",
];

const SECTION_JUNCTION_COORDS = [
  { start: { x: 180, y: 0 }, end: { x: 880, y: 900 } },
  { start: { x: 880, y: 0 }, end: { x: 360, y: 900 } },
  { start: { x: 360, y: 0 }, end: { x: 1120, y: 900 } },
  { start: { x: 1120, y: 0 }, end: { x: 280, y: 900 } },
  { start: { x: 280, y: 0 }, end: { x: 440, y: 900 } },
  { start: { x: 440, y: 0 }, end: { x: 1080, y: 900 } },
  { start: { x: 1080, y: 0 }, end: { x: 520, y: 900 } },
  { start: { x: 520, y: 0 }, end: { x: 720, y: 640 } },
];

const OrganicSectionCurve: React.FC<{
  index: number;
  progress: number;
  isDark?: boolean;
}> = ({ index, progress, isDark = false }) => {
  const pathD = SECTION_CURVE_PATHS[index] || SECTION_CURVE_PATHS[0];
  const clampedProgress = Math.max(0, Math.min(1, progress));
  // Standardized SVG pathLength (100) ensures 100% exact draw progress
  const currentOffset = 100 * (1 - clampedProgress);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`limeFlow-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4F82C" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#A4D804" stopOpacity="1" />
            <stop offset="100%" stopColor="#D4F82C" stopOpacity="0.5" />
          </linearGradient>
          <filter id={`neonGlow-${index}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Faint base guide path across the canvas */}
        <path
          d={pathD}
          stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(17,18,21,0.05)"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dynamic animated glow path that connects to previous section and draws as you scroll */}
        <path
          d={pathD}
          pathLength={100}
          stroke={`url(#limeFlow-${index})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="100"
          strokeDashoffset={currentOffset}
          filter={`url(#neonGlow-${index})`}
          className="transition-all duration-75 ease-out"
        />
      </svg>
    </div>
  );
};

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

  // Why Recruiters Switch & ROI State
  const [activeComparisonTab, setActiveComparisonTab] = useState<'matrix' | 'roi' | 'pipeline' | 'pillars'>('matrix');
  const [roiRoles, setRoiRoles] = useState<number>(6);
  const [roiApplicants, setRoiApplicants] = useState<number>(200);
  const [specGenerated, setSpecGenerated] = useState<boolean>(false);

  const roiCalculations = useMemo(() => {
    // 70 hours saved per opening on average (screening, followups, ads, JDs)
    const hoursSaved = Math.round(roiRoles * 70 * (roiApplicants / 200));
    // Based on typical recruiter cost per hour ~₹650
    const costSaved = Math.round(hoursSaved * 650);
    const costSavedLakhs = (costSaved / 100000).toFixed(2);
    return {
      hoursSaved,
      costSaved,
      costSavedLakhs,
    };
  }, [roiRoles, roiApplicants]);

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

  // ── Real-time Dynamic Scroll Progress for On-Page Animated Curves ──
  const [sectionProgresses, setSectionProgresses] = useState<number[]>(() => {
    const init = new Array(8).fill(0);
    init[0] = 0.35; // Initial graceful crest on page 1
    return init;
  });

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const vh = window.innerHeight;
          const scrollY = window.scrollY;
          const headerHeight = 72;

          const ids = [
            'overview',
            'pipeline',
            'resume-matching',
            'client-portal',
            'productivity',
            'pricing',
            'faq',
            'start-trial',
          ];

          // Center of the visible viewing area in document space
          const viewCenter = scrollY + headerHeight + (vh - headerHeight) * 0.45;

          const sectionElements = ids.map((id) => document.getElementById(id));
          const sectionTops: number[] = [];
          const sectionHeights: number[] = [];

          for (let i = 0; i < ids.length; i++) {
            const el = sectionElements[i];
            if (el) {
              const rect = el.getBoundingClientRect();
              sectionTops.push(rect.top + scrollY);
              sectionHeights.push(rect.height || vh);
            } else {
              sectionTops.push(i * vh);
              sectionHeights.push(vh);
            }
          }

          // Compute continuous global progress T (from 0.35 to 9)
          let currentT = 0.35;

          if (scrollY <= 10) {
            currentT = 0.35;
          } else {
            let activeIdx = 0;
            for (let i = 0; i < ids.length; i++) {
              const top = sectionTops[i];
              const bottom = top + sectionHeights[i];
              if (viewCenter >= top && (i === ids.length - 1 || viewCenter < sectionTops[i + 1])) {
                activeIdx = i;
                break;
              }
              if (viewCenter >= bottom && i === ids.length - 1) {
                activeIdx = ids.length - 1;
              }
            }

            if (activeIdx === 0) {
              const nextTop = sectionTops[1] || (sectionTops[0] + sectionHeights[0]);
              const fraction = Math.max(0, Math.min(1, scrollY / (nextTop - headerHeight - 100)));
              currentT = 0.35 + (1 - 0.35) * fraction;
            } else {
              const top = sectionTops[activeIdx];
              const nextTop = sectionTops[activeIdx + 1] || (top + sectionHeights[activeIdx]);
              const range = Math.max(100, nextTop - top);
              const fraction = Math.max(0, Math.min(1, (viewCenter - top) / range));
              currentT = activeIdx + fraction;
            }
          }

          // Strictly chained progression: zero gaps, no premature drawing, 100% continuous stream
          const newProgresses = ids.map((_, i) => {
            if (currentT >= i + 1) return 1;
            if (currentT <= i) return 0;
            return Math.max(0, Math.min(1, currentT - i));
          });

          setSectionProgresses(newProgresses);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const jumpToStage = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    jumpToStage(id);
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans selection:bg-[#D4F82C] selection:text-[#111215]">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-[100] bg-[#F8F9F5]/90 backdrop-blur-md border-b border-[#E4E7DC] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Product Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link to="/" className="group inline-flex items-center" title="hireX - AI Recruitment Platform">
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

          {/* Centered Desktop Navigation Links */}
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
              href="#productivity"
              onClick={(e) => scrollToSection(e, 'productivity')}
              className="hover:text-[#111215] transition-colors cursor-pointer"
            >
              Why Switch
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
          <div className="flex items-center gap-2 sm:gap-3">
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
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex h-9 sm:h-9.5 items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4.5 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
                >
                  <span>Book Demo</span>
                  <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </button>
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
          <div className="lg:hidden border-t border-[#E4E7DC] bg-[#F8F9F5]/98 backdrop-blur-xl px-4 py-5 space-y-5 animate-in slide-in-from-top-3 duration-200 shadow-2xl max-h-[calc(100vh-4.5rem)] overflow-y-auto">
            {/* Quick Portals Strip */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#73766C] px-1 block">
                Direct Portal Access
              </span>
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
                  <div className="text-[10px] text-[#73766C]">1-click matches & CV</div>
                </Link>

                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-3 rounded-2xl bg-white border border-[#E4E7DC] text-[#111215] hover:border-[#111215] transition-all flex flex-col justify-between shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <Briefcase className="size-4 text-[#111215]" />
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#111215] text-white">Recruiters</span>
                  </div>
                  <div className="mt-2 font-bold text-xs">ATS Sign In</div>
                  <div className="text-[10px] text-[#73766C]">Pipelines & Kanban</div>
                </Link>
              </div>
            </div>

            {/* Jump Navigation Links */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#73766C] px-1 block">
                Explore Platform
              </span>
              <div className="bg-white rounded-2xl border border-[#E4E7DC] divide-y divide-[#E4E7DC] overflow-hidden">
                <a
                  href="#pipeline"
                  onClick={(e) => {
                    scrollToSection(e, 'pipeline');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Kanban className="size-3.5 text-[#8FB305]" />
                    <span>01 • Visual Pipeline Kanban</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#resume-matching"
                  onClick={(e) => {
                    scrollToSection(e, 'resume-matching');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Brain className="size-3.5 text-[#8FB305]" />
                    <span>02 • AI Resume Match Scoring</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#client-portal"
                  onClick={(e) => {
                    scrollToSection(e, 'client-portal');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Share2 className="size-3.5 text-[#8FB305]" />
                    <span>03 • Live Client Review Portal</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#productivity"
                  onClick={(e) => {
                    scrollToSection(e, 'productivity');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className="size-3.5 text-[#8FB305]" />
                    <span>04 • Why Switch & ROI Estimator</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#pricing"
                  onClick={(e) => {
                    scrollToSection(e, 'pricing');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <IndianRupee className="size-3.5 text-[#8FB305]" />
                    <span>05 • Transparent Team Pricing</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#faq"
                  onClick={(e) => {
                    scrollToSection(e, 'faq');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="size-3.5 text-[#8FB305]" />
                    <span>06 • Frequently Asked Questions</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <Link
                  to="/active-jobs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Rocket className="size-3.5 text-[#8FB305]" />
                    <span>Public Job Board</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </Link>
              </div>
            </div>

            {/* Mobile Actions Drawer Bottom */}
            <div className="space-y-2 pt-1">
              {user ? (
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#111215] text-white text-xs font-bold shadow-xs hover:bg-black transition-all"
                >
                  <LayoutDashboard className="size-3.5 text-[#D4F82C]" />
                  <span>Go to Recruiter Dashboard</span>
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setBookingModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#111215] text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    <span>Start 30-Day Free Trial</span>
                    <span className="text-[#D4F82C]">↗</span>
                  </button>

                  <a
                    href="https://wa.me/919876543210?text=Hi%20hireX%20team,%20I%20would%20like%20a%20demo%20of%20the%20platform."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Chat on WhatsApp</span>
                  </a>
                </>
              )}
            </div>

            {/* Direct Contact strip */}
            <div className="pt-2 border-t border-[#E4E7DC] flex items-center justify-between text-[11px] text-[#73766C]">
              <span>Need help? <a href="mailto:hello@snab.co.in" className="font-bold text-[#111215] underline">hello@snab.co.in</a></span>
              <span>v2.8 Production</span>
            </div>
          </div>
        )}
      </header>

      {/* ── SECTION 1: DEDICATED FULL FRAME HERO CARD ── */}
      <section id="overview" className="relative z-10 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] overflow-x-clip scroll-mt-18 py-10 sm:py-16">
        <OrganicSectionCurve index={0} progress={sectionProgresses[0]} />
        <div className="flex-1 flex items-center max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 w-full py-6 sm:py-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center w-full">
            
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-8">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[#73766C]">
                  <span className="size-2 rounded-full bg-[#8FB305]"></span>
                  <span>AI-POWERED RECRUITMENT ATS FOR MODERN TEAMS</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215]">
                  <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
                  <span>01 • REQUISITION</span>
                </div>
              </div>

              <h1 className="text-3xl xs:text-4xl sm:text-6xl lg:text-[72px] font-black tracking-tight text-[#111215] leading-[1.08] sm:leading-[1.05]">
                Less busywork.<br />
                More possibility.
              </h1>

              <p className="text-sm sm:text-lg text-[#575A51] max-w-xl leading-relaxed font-normal">
                Hire smarter, faster. The intelligent ATS for lean teams, applicants and hiring managers — a streamlined, transparent process.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1 sm:pt-2">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 px-6 rounded-full bg-[#111215] hover:bg-black text-white text-sm font-bold transition-all shadow-sm cursor-pointer group"
                >
                  <span>Start free trial</span>
                  <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </button>

                <a
                  href="#pipeline"
                  onClick={(e) => scrollToSection(e, 'pipeline')}
                  className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 px-5 text-sm font-bold text-[#111215] hover:text-[#575A51] transition-colors cursor-pointer"
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

      </section>

      {/* ── SECTION 2: DEDICATED FULL FRAME KANBAN PIPELINE CARD ── */}
      <section id="pipeline" className="relative z-20 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={1} progress={sectionProgresses[1]} />
        <div className="flex-1 flex flex-col justify-center py-4 sm:py-6 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-end mb-4">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                  Intuitive Kanban Pipeline
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215]">
                  <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
                  <span>02 • PIPELINE</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-[#111215] tracking-tight">
                Every applicant.<br />
                One clear picture.
              </h2>
            </div>
            <div className="lg:col-span-5 text-xs sm:text-sm text-[#575A51] leading-relaxed">
              Stop juggling spreadsheets and email threads. A single unified board that brings clarity to your entire candidate flow from application to hired.
            </div>
          </div>

          {/* Realistic ATS Kanban UI Mockup */}
          <div className="rounded-2xl border border-[#E4E7DC] bg-white shadow-xl overflow-hidden">
            
            {/* Top Window Bar */}
            <div className="bg-[#111215] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-rose-500"></span>
                  <span className="size-2.5 rounded-full bg-amber-500"></span>
                  <span className="size-2.5 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-xs font-semibold text-slate-300 pl-3 border-l border-white/10 truncate max-w-[170px] sm:max-w-none">
                  hireX Recruitment OS
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse"></span>
                <span className="text-slate-300 hidden sm:inline">Live Recruiter View</span>
                <span className="text-slate-300 sm:hidden">Live</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Dark Mini-Sidebar */}
              <div className="lg:col-span-2 bg-[#16171B] text-slate-300 p-3.5 border-r border-[#26282E] hidden lg:flex flex-col justify-between text-xs">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold pb-2.5 border-b border-white/10">
                    <HireXMark size={22} />
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
                <div className="p-2 rounded-lg bg-white/5 text-[10px] text-slate-400">
                  SNAB Tech Team
                </div>
              </div>

              {/* Kanban Board Container */}
              <div className="lg:col-span-10 p-3 sm:p-4 bg-[#F8F9F5] flex flex-col">
                
                {/* Job Title Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#E4E7DC]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-[#111215]">Product Designer</h3>
                    <span className="px-2 py-0.5 rounded-md bg-[#D4F82C] text-[#111215] text-[10px] font-extrabold uppercase tracking-wider">
                      ACTIVE
                    </span>
                    <span className="text-[11px] text-[#73766C]">18 Applicants • 3 Shortlisted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDemoActiveCandidate(MOCKUP_CANDIDATES[0]);
                        setDemoDrawerTab('resume');
                        setDemoDrawerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-xs font-semibold text-[#111215] hover:bg-slate-50 cursor-pointer shadow-2xs"
                    >
                      <Eye className="size-3 text-[#111215]" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111215] text-white text-xs font-bold hover:bg-black cursor-pointer shadow-2xs"
                    >
                      <span>+ Candidate</span>
                    </button>
                  </div>
                </div>

                {/* Mobile horizontal swipe hint */}
                <div className="sm:hidden flex items-center justify-between text-[11px] text-[#73766C] pb-2 font-medium">
                  <span>Swipe to explore stages</span>
                  <span className="font-bold text-[#111215]">→</span>
                </div>

                {/* 4 Columns (Horizontal swipe on mobile, grid on desktop) */}
                <div className="flex overflow-x-auto pb-3 sm:pb-0 gap-3 snap-x sm:grid sm:grid-cols-2 xl:grid-cols-4 sm:overflow-visible">
                  
                  {/* Column 1: Under Review */}
                  <div className="min-w-[260px] sm:min-w-0 snap-start rounded-xl border border-[#E4E7DC] bg-[#F1F2EC]/60 p-2.5 flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#E4E7DC]">
                      <span className="text-xs font-bold text-[#111215]">Under Review</span>
                      <span className="size-4.5 rounded-full bg-white text-[#111215] text-[10px] font-bold flex items-center justify-center border border-[#E4E7DC]">
                        1
                      </span>
                    </div>
                    <div className="space-y-2 flex-1">
                      <div
                        onClick={() => {
                          setDemoActiveCandidate(MOCKUP_CANDIDATES[2]);
                          setDemoDrawerTab('overview');
                          setDemoDrawerOpen(true);
                        }}
                        className="p-2.5 bg-white rounded-xl border border-[#E4E7DC] hover:border-[#111215] transition-all cursor-pointer shadow-2xs group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#111215] group-hover:text-black">{MOCKUP_CANDIDATES[2].name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                            {MOCKUP_CANDIDATES[2].score}%
                          </span>
                        </div>
                        <div className="text-[10px] text-[#73766C] mb-1.5">{MOCKUP_CANDIDATES[2].role}</div>
                        <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-1.5 border-t border-[#F1F2EC]">
                          <span>{MOCKUP_CANDIDATES[2].experience}</span>
                          <span className="font-bold text-[#111215] flex items-center gap-0.5">
                            View <ChevronRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Shortlisted (With Lime Highlight) */}
                  <div className="min-w-[260px] sm:min-w-0 snap-start rounded-xl border border-[#D4F82C] bg-[#D4F82C]/10 p-2.5 flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#D4F82C]/30">
                      <span className="text-xs font-bold text-[#111215]">Shortlisted</span>
                      <span className="size-4.5 rounded-full bg-[#D4F82C] text-[#111215] text-[10px] font-black flex items-center justify-center">
                        2
                      </span>
                    </div>
                    <div className="space-y-2 flex-1">
                      <div
                        onClick={() => {
                          setDemoActiveCandidate(MOCKUP_CANDIDATES[0]);
                          setDemoDrawerTab('overview');
                          setDemoDrawerOpen(true);
                        }}
                        className="p-2.5 bg-white rounded-xl border border-[#D4F82C] hover:shadow-sm transition-all cursor-pointer shadow-2xs group ring-1 ring-[#D4F82C]"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[0].name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#D4F82C] text-[#111215]">
                            {MOCKUP_CANDIDATES[0].score}% Fit
                          </span>
                        </div>
                        <div className="text-[10px] text-[#73766C] mb-1.5">{MOCKUP_CANDIDATES[0].role}</div>
                        <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-1.5 border-t border-[#F1F2EC]">
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
                        className="p-2.5 bg-white rounded-xl border border-[#E4E7DC] hover:border-[#111215] transition-all cursor-pointer shadow-2xs group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[3].name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                            {MOCKUP_CANDIDATES[3].score}%
                          </span>
                        </div>
                        <div className="text-[10px] text-[#73766C] mb-1.5">{MOCKUP_CANDIDATES[3].role}</div>
                        <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-1.5 border-t border-[#F1F2EC]">
                          <span>AWS, DevOps</span>
                          <span className="font-bold text-[#111215] flex items-center gap-0.5">
                            Inspect <ChevronRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Interview */}
                  <div className="min-w-[260px] sm:min-w-0 snap-start rounded-xl border border-[#E4E7DC] bg-[#F1F2EC]/60 p-2.5 flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#E4E7DC]">
                      <span className="text-xs font-bold text-[#111215]">Interview Scheduled</span>
                      <span className="size-4.5 rounded-full bg-white text-[#111215] text-[10px] font-bold flex items-center justify-center border border-[#E4E7DC]">
                        1
                      </span>
                    </div>
                    <div className="space-y-2 flex-1">
                      <div
                        onClick={() => {
                          setDemoActiveCandidate(MOCKUP_CANDIDATES[1]);
                          setDemoDrawerTab('overview');
                          setDemoDrawerOpen(true);
                        }}
                        className="p-2.5 bg-white rounded-xl border border-[#E4E7DC] hover:border-[#111215] transition-all cursor-pointer shadow-2xs group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[1].name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                            {MOCKUP_CANDIDATES[1].score}%
                          </span>
                        </div>
                        <div className="text-[10px] text-[#73766C] mb-1.5">{MOCKUP_CANDIDATES[1].role}</div>
                        <div className="flex items-center justify-between text-[10px] text-[#73766C] pt-1.5 border-t border-[#F1F2EC]">
                          <span className="text-[#111215] font-semibold">Tomorrow, 3 PM</span>
                          <span className="font-bold text-[#111215] flex items-center gap-0.5">
                            View <ChevronRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Hired */}
                  <div className="min-w-[260px] sm:min-w-0 snap-start rounded-xl border border-[#E4E7DC] bg-[#F1F2EC]/60 p-2.5 flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#E4E7DC]">
                      <span className="text-xs font-bold text-[#111215]">Hired</span>
                      <span className="size-4.5 rounded-full bg-white text-[#111215] text-[10px] font-bold flex items-center justify-center border border-[#E4E7DC]">
                        1
                      </span>
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="p-2.5 bg-white rounded-xl border border-[#E4E7DC] shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#111215]">{MOCKUP_CANDIDATES[4].name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#D4F82C] text-[#111215]">
                            98%
                          </span>
                        </div>
                        <div className="text-[10px] text-[#73766C] mb-1.5">{MOCKUP_CANDIDATES[4].role}</div>
                        <div className="flex items-center justify-between text-[10px] text-emerald-700 font-bold pt-1.5 border-t border-[#F1F2EC]">
                          <span className="flex items-center gap-1"><Check className="size-3" /> Offer Accepted</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Subcaption */}
                <div className="mt-2.5 pt-2 border-t border-[#E4E7DC] flex flex-wrap items-center justify-between text-xs text-[#73766C] gap-2 shrink-0">
                  <span>Drag-and-drop candidates, review resumes, and manage interview schedules with zero friction.</span>
                  <span className="font-bold text-[#111215]">Click any card to open live drawer ↗</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── SECTION 3: AI RESUME EXTRACTION CARD ── */}
      <section id="resume-matching" className="relative z-30 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={2} progress={sectionProgresses[2]} />
        <div className="flex-1 flex flex-col justify-center py-4 sm:py-6 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
            
            {/* Left Text */}
            <div className="lg:col-span-6 space-y-5 sm:space-y-6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                  AI Resume Extraction & Match
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215]">
                  <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
                  <span>03 • EXTRACTION</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-5xl font-black text-[#111215] tracking-tight leading-[1.1]">
                Read the person.<br />
                Not the paperwork.
              </h2>
              <p className="text-sm sm:text-base text-[#575A51] leading-relaxed">
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
        </div>

      </section>

      {/* ── SECTION 4: DARK CLIENT PORTAL CARD ── */}
      <section id="client-portal" className="relative z-40 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#111215] text-white scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={3} progress={sectionProgresses[3]} isDark={true} />
        <div className="flex-1 flex flex-col justify-center py-4 sm:py-6 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-4 sm:mb-6">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4F82C]">
                  Live Client Collaboration
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 shadow-2xs text-[10px] font-mono font-bold text-white">
                  <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
                  <span>04 • CLIENT PORTAL</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-[1.1]">
                A shortlist needs context.<br />
                Not a black box.
              </h2>
            </div>
            <div className="lg:col-span-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              They don't need spreadsheets or 10-page CV PDFs. Give your clients a live, interactive review link they'll actually enjoy using.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            
            {/* Interactive Client Review Portal Mockup */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#16171B] p-4 sm:p-5 shadow-2xl space-y-3 sm:space-y-4">
              
              {/* Header Bar with Share Link & Copy */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
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
              <div className="p-3.5 sm:p-4 rounded-xl border border-white/10 bg-white/5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={MOCKUP_CANDIDATES[0].avatar}
                      alt={MOCKUP_CANDIDATES[0].name}
                      className="size-10 rounded-full object-cover border border-white/20"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{MOCKUP_CANDIDATES[0].name}</span>
                        <span className="px-2 py-0.5 rounded bg-[#D4F82C] text-[#111215] text-[10px] font-black">
                          {MOCKUP_CANDIDATES[0].score}% Match
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{MOCKUP_CANDIDATES[0].role} • Masked ID: SNAB-9421</p>
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
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            <div className="lg:col-span-5 space-y-4">
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <div className="size-2 rounded-full bg-[#D4F82C]"></div>
                  <span>Shared with one click</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-4">
                  Generate a beautiful, branded client shortlist URL per job. No logins, no passwords, no attachments.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <div className="size-2 rounded-full bg-[#D4F82C]"></div>
                  <span>Live bidirectional sync</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-4">
                  Moving or updating a candidate in your recruiter ATS updates the client portal instantly. No stale data.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <div className="size-2 rounded-full bg-[#D4F82C]"></div>
                  <span>Keep people in charge</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-4">
                  Clients approve candidates, request interviews, or decline with feedback in 1 tap, cutting hiring cycle by 60%.
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-xs font-black transition-all cursor-pointer"
                >
                  <span>Request Client Portal Demo</span>
                  <span>↗</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ── SECTION 5: WHY RECRUITERS SWITCH (HEAD-TO-HEAD COMPARISON & ROI) ── */}
      <section id="productivity" className="relative z-50 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={4} progress={sectionProgresses[4]} />
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10 space-y-8 sm:space-y-10">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215]">
              <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span>05 • WHY RECRUITERS SWITCH</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#111215] tracking-tight leading-[1.08]">
              Traditional ATS Creates Work.<br />
              <span className="text-[#8FB305]">HireX Snab Does It.</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#575A51] max-w-2xl mx-auto leading-relaxed">
              See why legacy recruiting software slows hiring teams down, and how HireX Snab automates the repetitive busywork from requisition to signed offer.
            </p>
          </div>

          {/* Top Side-by-Side Dual Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Left Card: Traditional ATS (Legacy Flow) */}
            <div className="rounded-2xl border border-rose-200/80 bg-white/90 p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-500">
                    Legacy Flow
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#111215]">Traditional ATS tools</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                  Creates work
                </span>
              </div>
              <div className="text-xs text-[#73766C] font-medium">
                Manual, slow, and fragmented operations that exhaust recruiters.
              </div>
              <div className="space-y-2.5 pt-1">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                  <div className="size-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</div>
                  <div>
                    <div className="text-xs font-bold text-[#111215]">Manual screening</div>
                    <div className="text-[11px] text-[#575A51]">5+ hours lost per opening reading PDFs line by line</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                  <div className="size-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</div>
                  <div>
                    <div className="text-xs font-bold text-[#111215]">Slow follow-ups</div>
                    <div className="text-[11px] text-[#575A51]">Days or weeks of waiting on email replies and clunky forms</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                  <div className="size-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</div>
                  <div>
                    <div className="text-xs font-bold text-[#111215]">Missed talent</div>
                    <div className="text-[11px] text-[#575A51]">Good fits get buried in the pile due to rigid keyword filters</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: HireX Snab ATS (Autonomous Intelligence) */}
            <div className="rounded-2xl border border-[#111215] bg-[#111215] text-white p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 size-32 bg-[#D4F82C]/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4F82C]">
                    Autonomous Intelligence
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">HireX Snab ATS</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-[10px] font-black tracking-wide">
                  AI does heavy lifting
                </span>
              </div>
              <div className="text-xs text-slate-300 font-medium relative z-10">
                Autonomous AI pipelines that eliminate repetitive recruiter tasks.
              </div>
              <div className="space-y-2.5 pt-1 relative z-10">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4F82C]/50 transition-colors">
                  <div className="size-5 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">✓</div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Automated AI resume scoring</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-[#D4F82C] font-mono">Claude 3.5 Sonnet</span>
                    </div>
                    <div className="text-[11px] text-slate-300">Deep evaluation across skills, relevance, and role rubrics in seconds</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4F82C]/50 transition-colors">
                  <div className="size-5 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">✓</div>
                  <div>
                    <div className="text-xs font-bold text-white">Best-candidate suggestions</div>
                    <div className="text-[11px] text-slate-300">Top matches surface first with clear contextual fit explanations</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4F82C]/50 transition-colors">
                  <div className="size-5 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">✓</div>
                  <div>
                    <div className="text-xs font-bold text-white">Personalised job picks</div>
                    <div className="text-[11px] text-slate-300">80% less irrelevant applications with intelligent candidate routing</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Interactive Navigation Tabs */}
          <div className="space-y-6">
            <div className="flex overflow-x-auto pb-1.5 scrollbar-none sm:justify-center gap-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E4E7DC] max-w-3xl mx-auto shadow-2xs whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveComparisonTab('matrix')}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeComparisonTab === 'matrix'
                    ? 'bg-[#111215] text-white shadow-xs'
                    : 'text-[#575A51] hover:text-[#111215]'
                }`}
              >
                Head-To-Head Matrix
              </button>
              <button
                type="button"
                onClick={() => setActiveComparisonTab('roi')}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeComparisonTab === 'roi'
                    ? 'bg-[#111215] text-white shadow-xs'
                    : 'text-[#575A51] hover:text-[#111215]'
                }`}
              >
                Hours Returned & ROI
              </button>
              <button
                type="button"
                onClick={() => setActiveComparisonTab('pipeline')}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeComparisonTab === 'pipeline'
                    ? 'bg-[#111215] text-white shadow-xs'
                    : 'text-[#575A51] hover:text-[#111215]'
                }`}
              >
                4-Stage Pipeline
              </button>
              <button
                type="button"
                onClick={() => setActiveComparisonTab('pillars')}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeComparisonTab === 'pillars'
                    ? 'bg-[#111215] text-white shadow-xs'
                    : 'text-[#575A51] hover:text-[#111215]'
                }`}
              >
                Core Pillars
              </button>
            </div>

            {/* TAB 1: HEAD-TO-HEAD CAPABILITIES */}
            {activeComparisonTab === 'matrix' && (
              <div className="rounded-2xl border border-[#E4E7DC] bg-white shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="p-4 sm:p-5 bg-[#F8F9F5] border-b border-[#E4E7DC] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111215]">Head-To-Head Capabilities</h3>
                    <p className="text-xs text-[#575A51]">Direct side-by-side capability evaluation for talent teams and enterprise leadership.</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#111215] text-[#D4F82C] text-[10px] font-mono font-bold">
                    Autonomous vs Legacy
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E4E7DC] bg-white">
                        <th className="py-3 px-4 font-bold text-[#73766C] uppercase tracking-wider text-[10px] w-1/4">Capability</th>
                        <th className="py-3 px-4 font-bold text-rose-600 uppercase tracking-wider text-[10px] w-3/8">Traditional ATS</th>
                        <th className="py-3 px-4 font-bold text-[#111215] uppercase tracking-wider text-[10px] w-3/8 bg-[#F8F9F5]">HireX Snab ATS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E7DC]">
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#111215]">Resume screening</td>
                        <td className="py-3 px-4 text-[#73766C]">
                          <div className="flex items-center gap-2">
                            <span className="text-rose-500 font-bold">✕</span>
                            <span>Manual reading line-by-line (5+ hrs per job)</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#111215] bg-[#F8F9F5]">
                          <div className="flex items-center gap-2">
                            <Check className="size-3.5 text-[#8FB305] shrink-0" />
                            <span>Instant AI scoring against JD with fit breakdown</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#111215]">Candidate alerts</td>
                        <td className="py-3 px-4 text-[#73766C]">
                          <div className="flex items-center gap-2">
                            <span className="text-rose-500 font-bold">✕</span>
                            <span>Email only, often delayed with 15% open rates</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#111215] bg-[#F8F9F5]">
                          <div className="flex items-center gap-2">
                            <Check className="size-3.5 text-[#8FB305] shrink-0" />
                            <span>Built-in WhatsApp & email alerts with 92% open rate</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#111215]">Job recommendations</td>
                        <td className="py-3 px-4 text-[#73766C]">
                          <div className="flex items-center gap-2">
                            <span className="text-rose-500 font-bold">✕</span>
                            <span>Manual keyword search & endless browsing</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#111215] bg-[#F8F9F5]">
                          <div className="flex items-center gap-2">
                            <Check className="size-3.5 text-[#8FB305] shrink-0" />
                            <span>AI-personalised candidate match picks across talent pool</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#111215]">Finding top talent</td>
                        <td className="py-3 px-4 text-[#73766C]">
                          <div className="flex items-center gap-2">
                            <span className="text-rose-500 font-bold">✕</span>
                            <span>Rigid Boolean filters & missed spelling variations</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#111215] bg-[#F8F9F5]">
                          <div className="flex items-center gap-2">
                            <Check className="size-3.5 text-[#8FB305] shrink-0" />
                            <span>Best-candidate suggestions surfaced first objectively</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#111215]">Client collaboration</td>
                        <td className="py-3 px-4 text-[#73766C]">
                          <div className="flex items-center gap-2">
                            <span className="text-rose-500 font-bold">✕</span>
                            <span>Messy PDF attachments, lost feedback, login barriers</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#111215] bg-[#F8F9F5]">
                          <div className="flex items-center gap-2">
                            <Check className="size-3.5 text-[#8FB305] shrink-0" />
                            <span>Zero-login live share links with anti-poaching masking</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: HOURS RETURNED & ROI CALCULATOR */}
            {activeComparisonTab === 'roi' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start animate-in fade-in duration-300">
                {/* Left Task Breakdown */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E7DC] p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E4E7DC]">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111215]">Time Saved with HireX Snab</h3>
                      <p className="text-xs text-[#575A51]">Estimates per hiring round, based on typical manual recruiter effort.</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                      Per Opening
                    </span>
                  </div>
                  
                  <div className="divide-y divide-[#E4E7DC]">
                    <div className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#111215]">Create a job post</div>
                        <div className="text-[11px] text-[#73766C]">Traditional: 30 min → HireX: Seconds</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-[#F1F3EB] text-[#111215] font-black font-mono">
                        ~30 min saved
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#111215]">Screen 100 resumes</div>
                        <div className="text-[11px] text-[#73766C]">Traditional: 5 hrs → HireX: 10 min AI scoring</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-[#D4F82C] text-[#111215] font-black font-mono">
                        ~4.5 hrs saved
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#111215]">Write candidate ads</div>
                        <div className="text-[11px] text-[#73766C]">Traditional: 45 min → HireX: 1 min AI ads</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-[#F1F3EB] text-[#111215] font-black font-mono">
                        ~44 min saved
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#111215]">Candidate follow-ups</div>
                        <div className="text-[11px] text-[#73766C]">Traditional: 3 hrs → HireX: Auto WhatsApp alerts</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-[#D4F82C] text-[#111215] font-black font-mono">
                        ~3 hrs saved
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-xs text-[#575A51] flex items-center justify-between">
                    <span>⚡ Typical reduction per role:</span>
                    <strong className="text-[#111215] font-bold">~70 hours reclaimed per active requisition</strong>
                  </div>
                </div>

                {/* Right Interactive Calculator */}
                <div className="lg:col-span-5 bg-[#111215] text-white rounded-2xl border border-[#111215] p-5 sm:p-6 space-y-5 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4F82C]">Interactive ROI</span>
                      <h4 className="text-base font-black text-white">Hours Returned Calculator</h4>
                    </div>
                    <HireXMark size={24} />
                  </div>

                  {/* Sliders */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-300">Monthly Open Roles</span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono">{roiRoles} Roles</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={roiRoles}
                        onChange={(e) => setRoiRoles(parseInt(e.target.value))}
                        className="w-full accent-[#D4F82C] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-300">Applicants Per Opening</span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-[#D4F82C] font-mono">{roiApplicants} Resumes</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={500}
                        step={25}
                        value={roiApplicants}
                        onChange={(e) => setRoiApplicants(parseInt(e.target.value))}
                        className="w-full accent-[#D4F82C] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Calculated Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400 font-medium">Hours Saved / Mo</div>
                      <div className="text-2xl sm:text-3xl font-black text-[#D4F82C] tracking-tight mt-0.5">
                        {roiCalculations.hoursSaved} hrs
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">~14 hrs / recruiter / wk</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400 font-medium">Cost Saved Monthly</div>
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                        ₹{roiCalculations.costSavedLakhs}L
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-1">Direct operational value</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBookingModalOpen(true)}
                    className="w-full py-3 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-xs font-black transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>Claim Your 1-Month Free Trial</span>
                    <span>↗</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: END-TO-END 4-STAGE PIPELINE */}
            {activeComparisonTab === 'pipeline' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E4E7DC] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111215]">End-To-End Automated Pipeline</h3>
                    <p className="text-xs text-[#575A51]">From application to offer letter, cutting average time-to-hire from 38 days to under 7 days.</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-[10px] font-black">
                    5.2x Faster Velocity
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Step 1 */}
                  <div className="p-5 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-[#73766C]">Step 1 of 4</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">Apply</span>
                      </div>
                      <h4 className="text-base font-bold text-[#111215] mb-2">Multi-Channel Ingestion</h4>
                      <p className="text-xs text-[#575A51] leading-relaxed">
                        Candidates apply via mobile portal, public job board, or recruiters batch-import 100+ resumes via AWS S3.
                      </p>
                    </div>
                    <div className="pt-3 mt-4 border-t border-[#F1F2EC] text-[10px] font-mono text-[#73766C]">
                      Zero resume drop-off
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-5 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-[#73766C]">Step 2 of 4</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#D4F82C] text-[#111215]">Score</span>
                      </div>
                      <h4 className="text-base font-bold text-[#111215] mb-2">Instant 0–100% Fit</h4>
                      <p className="text-xs text-[#575A51] leading-relaxed">
                        AWS Bedrock Claude 3.5 Sonnet ranks every resume against the job description in seconds with transparent reasoning.
                      </p>
                    </div>
                    <div className="pt-3 mt-4 border-t border-[#F1F2EC] text-[10px] font-mono text-[#73766C]">
                      Deep skill benchmarking
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-5 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-[#73766C]">Step 3 of 4</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">Notify & Screen</span>
                      </div>
                      <h4 className="text-base font-bold text-[#111215] mb-2">92% Open Rate</h4>
                      <p className="text-xs text-[#575A51] leading-relaxed">
                        WhatsApp and email alerts, with conversational AI screening and automated calendar scheduling for applicants.
                      </p>
                    </div>
                    <div className="pt-3 mt-4 border-t border-[#F1F2EC] text-[10px] font-mono text-[#73766C]">
                      Sub-minute candidate replies
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="p-5 rounded-2xl border border-[#E4E7DC] bg-white shadow-2xs hover:border-[#111215] transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-[#73766C]">Step 4 of 4</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#111215] text-[#D4F82C]">Hire</span>
                      </div>
                      <h4 className="text-base font-bold text-[#111215] mb-2">5.2x Faster Velocity</h4>
                      <p className="text-xs text-[#575A51] leading-relaxed">
                        Masked resumes, confident decisions, and efficient offer workflows that close candidates before competitors can reply.
                      </p>
                    </div>
                    <div className="pt-3 mt-4 border-t border-[#F1F2EC] text-[10px] font-mono text-[#73766C]">
                      38 days → under 7 days
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CORE PLATFORM PILLARS */}
            {activeComparisonTab === 'pillars' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in duration-300">
                {/* Pillar 1: Creation Engine */}
                <div className="rounded-2xl border border-[#E4E7DC] bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C]">Creation Engine</span>
                      <h4 className="text-sm sm:text-base font-bold text-[#111215]">AI creates jobs and ads in seconds</h4>
                    </div>
                  </div>
                  <p className="text-xs text-[#575A51] leading-relaxed">
                    AI creates structured job posts, candidate advertisements, and evaluation rubrics from simple prompts.
                  </p>
                  
                  {/* Interactive Spec Generator Widget */}
                  <div className="p-3.5 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#111215]">Job Title:</span>
                      <span className="px-2 py-0.5 rounded bg-white text-[#111215] font-mono text-[11px] border border-[#E4E7DC]">
                        Senior React Lead
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSpecGenerated(!specGenerated)}
                      className="w-full py-2 rounded-lg bg-[#111215] text-white hover:bg-black text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Sparkles className="size-3 text-[#D4F82C]" />
                      <span>{specGenerated ? 'Spec Generated ✓' : '✨ Generate Spec'}</span>
                    </button>
                    {specGenerated && (
                      <div className="text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded-md border border-emerald-200">
                        ✓ 8 skills extracted, rubric configured, WhatsApp ad copied!
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-[#73766C] flex items-center gap-1.5 pt-1">
                    <Check className="size-3 text-[#8FB305]" />
                    <span>AI job creation • AI candidate ads</span>
                  </div>
                </div>

                {/* Pillar 2: Candidate Outreach */}
                <div className="rounded-2xl border border-[#E4E7DC] bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold">
                      <MessageSquare className="size-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C]">Candidate Outreach</span>
                      <h4 className="text-sm sm:text-base font-bold text-[#111215]">Built-in WhatsApp & email alerts</h4>
                    </div>
                  </div>
                  <p className="text-xs text-[#575A51] leading-relaxed">
                    Reach candidates instantly through native Baileys WhatsApp integration without Zapier or third-party add-ons.
                  </p>
                  
                  {/* WhatsApp Message Preview Bubble */}
                  <div className="p-3.5 rounded-xl bg-[#075E54]/10 border border-[#25D366]/20 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#075E54] flex items-center gap-1">
                        <span className="size-2 rounded-full bg-[#25D366]"></span>
                        SNAB HR
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">10:30 AM</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#25D366]/30 text-xs text-[#111215] shadow-2xs">
                      "Interview round 1 scheduled for tomorrow at 3 PM. Tap link to confirm."
                    </div>
                    <div className="text-right text-[10px] text-[#075E54] font-bold">
                      ✓✓ Delivered
                    </div>
                  </div>
                  <div className="text-[11px] text-[#73766C] flex items-center gap-1.5 pt-1">
                    <Check className="size-3 text-[#8FB305]" />
                    <span>WhatsApp integration • Stage updates • No third-party tools</span>
                  </div>
                </div>

                {/* Pillar 3: Security & Bias Control */}
                <div className="rounded-2xl border border-[#E4E7DC] bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C]">Security & Bias Control</span>
                      <h4 className="text-sm sm:text-base font-bold text-[#111215]">Privacy and control built in</h4>
                    </div>
                  </div>
                  <p className="text-xs text-[#575A51] leading-relaxed">
                    Protect candidate information and prevent client poaching with automated redaction and role-based access.
                  </p>
                  
                  {/* Clean White Masking Preview */}
                  <div className="p-3.5 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#73766C]">Phone / Email:</span>
                      <span className="px-2 py-0.5 rounded bg-[#111215] text-[#D4F82C] font-mono text-[10px] font-bold">
                        ████████
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#E4E7DC] text-[11px] text-[#575A51] flex items-center justify-between">
                      <span>Resume Masking</span>
                      <span className="text-emerald-700 font-bold">Clean White Active</span>
                    </div>
                    <div className="text-[10px] text-[#73766C]">
                      Individual role-based logins • Admin-monitored logs
                    </div>
                  </div>
                  <div className="text-[11px] text-[#73766C] flex items-center gap-1.5 pt-1">
                    <Check className="size-3 text-[#8FB305]" />
                    <span>Anti-poaching masking • Role logins • Audited logs</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── SECTION 6: PRICING ESTIMATOR CARD ── */}
      <section id="pricing" className="relative z-60 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={5} progress={sectionProgresses[5]} />
        <div className="flex-1 flex flex-col justify-center py-6 sm:py-8 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215] mb-2">
              <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span>06 • PRICING</span>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] mb-1">
              Transparent Pricing
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-[#111215] tracking-tight">
              Calculate your exact monthly plan.
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#575A51]">
              Scale smoothly with your hiring volume. Free Baileys WhatsApp engine, masked resumes, and zero lock-in contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            
            {/* Left Calculator Controls */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E7DC] p-4 sm:p-5 space-y-4 shadow-sm">
              
              {/* 1. Recruiters */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
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
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
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
              <div className="pt-0.5">
                <div className="text-xs font-bold text-[#111215] mb-1.5">Billing Frequency</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCalcBilling('annual')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      calcBilling === 'annual'
                        ? 'border-[#111215] bg-[#111215] text-white'
                        : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Annual Billing</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#D4F82C] text-[#111215]">Save 20%</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Discounted yearly rate</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcBilling('monthly')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      calcBilling === 'monthly'
                        ? 'border-[#111215] bg-[#111215] text-white'
                        : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]'
                    }`}
                  >
                    <div className="text-xs font-bold">Monthly Billing</div>
                    <div className="text-[10px] text-[#73766C] mt-0.5">Cancel anytime</div>
                  </button>
                </div>
              </div>

            </div>

            {/* Right Quote Summary Card */}
            <div className="lg:col-span-5 rounded-2xl border border-[#111215] bg-[#111215] text-white p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#D4F82C] font-bold">Recommended Tier</span>
                  <h3 className="text-lg sm:text-xl font-black text-white">{quoteCalculation.tierName}</h3>
                </div>
                <HireXMark size={28} />
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  ₹{quoteCalculation.subtotalMonthly.toLocaleString('en-IN')}
                  <span className="text-xs text-slate-400 font-normal"> / month</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  <span>Transparent flat pricing • Zero hidden charges</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-white/10">
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
                className="w-full py-3 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-xs font-black transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                <span>Get Started With 1-Month Free Trial</span>
                <span>↗</span>
              </button>
            </div>

          </div>
        </div>

      </section>

      {/* ── SECTION 7: FAQ ACCORDION CARD ("A little more clarity.") ── */}
      <section id="faq" className="relative z-70 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={6} progress={sectionProgresses[6]} />
        <div className="flex-1 flex flex-col justify-center py-6 sm:py-8 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-start">
            
            {/* Left Title */}
            <div className="lg:col-span-5 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215]">
                <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
                <span>07 • FAQ</span>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                Frequently Asked Questions
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-[#111215] tracking-tight leading-[1.1]">
                A little more<br />
                clarity.
              </h2>
              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed">
                Everything you need to know about hireX, setup time, and pricing.
              </p>
            </div>

            {/* Right Accordion */}
            <div className="lg:col-span-7 divide-y divide-[#E4E7DC]">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={item.q} className="py-3">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-bold text-[#111215] hover:text-[#575A51] transition-colors cursor-pointer gap-4"
                    >
                      <span>{item.q}</span>
                      <span className="text-base text-[#73766C]">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-xs text-[#575A51] leading-relaxed pr-6">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </section>

      {/* ── SECTION 8: DARK CTA CARD ("Your next great hire. A clearer way forward.") ── */}
      <section id="start-trial" className="relative z-80 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#111215] text-white scroll-mt-18 transition-all duration-300 overflow-x-clip py-12 sm:py-16">
        <OrganicSectionCurve index={7} progress={sectionProgresses[7]} isDark={true} />
        <div className="flex-1 flex items-center py-8 sm:py-12 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 sm:gap-12 w-full">
            
            <div className="space-y-4 sm:space-y-6 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 shadow-2xs text-[10px] font-mono font-bold text-white">
                <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
                <span>08 • GET STARTED</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.08]">
                Your next great hire.<br />
                A clearer way forward.
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed">
                Start your 30-day free trial. No credit card required. Onboard your hiring team in under 5 minutes.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex h-11 sm:h-12 items-center gap-2.5 px-6 sm:px-7 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-xs sm:text-sm font-black transition-all cursor-pointer group shadow-lg"
                >
                  <span>Start free trial today</span>
                  <span className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </button>
              </div>
            </div>

            {/* Huge Diagonal Arrow Graphic */}
            <div className="shrink-0 flex items-center justify-center opacity-90">
              <svg viewBox="0 0 160 160" className="size-32 sm:size-48 stroke-[#D4F82C] stroke-[8] fill-none">
                <path d="M40 120 L120 40 M120 40 L60 40 M120 40 L120 100" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

          </div>
        </div>

      </section>

      {/* ── SECTION 10: BESTEST SIGNATURE FOOTER WITH GIANT "hireX ↗" ── */}
      <footer className="relative z-[95] w-full bg-[#F8F9F5] border-t border-[#E4E7DC] text-[#111215] overflow-hidden">
        {/* Subtle Ambient Organic Lime Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-64 bg-[#D4F82C]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-14 sm:pt-16 pb-12 relative z-10">
          
          {/* Main 5-Column Navigation & Trust Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 sm:gap-10 pb-12 sm:pb-16 border-b border-[#E4E7DC]">
            
            {/* Col 1: Brand & Enterprise Trust Architecture (2 cols on large) */}
            <div className="sm:col-span-2 lg:col-span-2 space-y-4">
              <div className="mb-2">
                <Link to="/" className="inline-block" title="hireX Home">
                  <HireXLogo size="md" variant="full" />
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
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
                <li><a href="#pipeline" onClick={(e) => scrollToSection(e, 'pipeline')} className="hover:text-[#111215] transition-colors">Visual Kanban Pipeline</a></li>
                <li><a href="#resume-matching" onClick={(e) => scrollToSection(e, 'resume-matching')} className="hover:text-[#111215] transition-colors">AI Resume Match Scoring</a></li>
                <li><a href="#client-portal" onClick={(e) => scrollToSection(e, 'client-portal')} className="hover:text-[#111215] transition-colors">Client Shortlist Portal</a></li>
                <li><a href="#productivity" onClick={(e) => scrollToSection(e, 'productivity')} className="hover:text-[#111215] transition-colors">Automated WhatsApp Outreach</a></li>
                <li><a href="#productivity" onClick={(e) => scrollToSection(e, 'productivity')} className="hover:text-[#111215] transition-colors">AI Voice Phone Screening</a></li>
                <li><a href="#productivity" onClick={(e) => scrollToSection(e, 'productivity')} className="hover:text-[#111215] transition-colors">Anti-Poaching Data Masking</a></li>
                <li><a href="#productivity" onClick={(e) => scrollToSection(e, 'productivity')} className="hover:text-[#111215] transition-colors">AI Job Spec & Ads Creator</a></li>
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
                <li><Link to="/auth" className="hover:text-[#111215] transition-colors font-medium">Recruiter & ATS Login</Link></li>
                <li><a href="#client-portal" onClick={(e) => scrollToSection(e, 'client-portal')} className="hover:text-[#111215] transition-colors">Client Review Gateway</a></li>
                <li><Link to="/active-jobs" className="hover:text-[#111215] transition-colors">Public Job Board</Link></li>
                <li><button type="button" onClick={() => setBookingModalOpen(true)} className="hover:text-[#111215] transition-colors text-left font-bold text-[#111215]">Schedule 1-on-1 Demo ↗</button></li>
                <li><button type="button" onClick={() => setBookingModalOpen(true)} className="hover:text-[#111215] transition-colors text-left text-emerald-700 font-bold">Start 30-Day Free Trial</button></li>
              </ul>
            </div>

            {/* Col 4: Solutions & Staffing Models */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Briefcase size={13} className="text-[#8FB305]" />
                <span>Solutions</span>
              </div>
              <ul className="space-y-2 text-[#73766C]">
                <li><a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="hover:text-[#111215] transition-colors">For Recruitment Agencies</a></li>
                <li><a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="hover:text-[#111215] transition-colors">For In-House Talent Teams</a></li>
                <li><a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="hover:text-[#111215] transition-colors">For Fast-Growing Startups</a></li>
                <li><a href="#productivity" onClick={(e) => scrollToSection(e, 'productivity')} className="hover:text-[#111215] transition-colors">Hours Returned Calculator</a></li>
                <li><a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="hover:text-[#111215] transition-colors">Pricing & ROI Estimator</a></li>
                <li><a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="hover:text-[#111215] transition-colors">Frequently Asked Questions</a></li>
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
                  <a href="mailto:hello@snab.co.in" className="hover:text-[#111215] transition-colors flex items-center gap-1.5 font-medium text-[#111215]">
                    <Mail size={12} className="text-[#8FB305]" />
                    <span>hello@snab.co.in</span>
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="hover:text-[#111215] transition-colors flex items-center gap-1.5 text-emerald-700 font-bold">
                    <MessageCircle size={12} />
                    <span>WhatsApp Business</span>
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
                  SNAB Technologies Pvt. Ltd.
                </div>
                <div className="text-[11px] text-[#575A51] leading-snug">
                  Nashik, Maharashtra, India
                </div>
              </div>
            </div>

          </div>

          {/* Giant Typographic Wordmark with hover glow */}
          <div className="py-6 sm:py-8 border-b border-[#E4E7DC] select-none overflow-hidden">
            <div className="text-[12vw] sm:text-[14vw] font-black tracking-tighter leading-none text-[#111215] flex items-center justify-between group cursor-default">
              <span>hireX</span>
              <span className="text-[#8FB305] group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform duration-300">↗</span>
            </div>
          </div>

          {/* Copyright & Legal Compliance Bar */}
          <div className="pt-6 sm:pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-[#73766C] gap-4">
            <div className="flex flex-wrap items-center gap-2 text-center md:text-left">
              <span>© {new Date().getFullYear()} SNAB Technologies Private Limited. All rights reserved.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
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

      {/* ── Slide-Over Candidate Drawer Modal (Demonstration) ── */}
      {demoDrawerOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
