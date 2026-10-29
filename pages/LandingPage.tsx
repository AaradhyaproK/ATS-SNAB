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
  BadgeCheck,
  Video,
  Mic,
  Bot,
  Activity,
  Volume2,
  GraduationCap,
  Code2,
  SlidersHorizontal,
  Target
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
// 5: (440,0) -> (440,900)   [AI Interview]
// 6: (440,0) -> (1080,900)  [Pricing]
// 7: (1080,0) -> (520,900)  [FAQ]
// ── Smooth Organic Continuous Bezier Paths for On-Page Journey Flow ──
// Each section k starts at the exact X coordinate and vertical tangent where section k-1 ended!
// 00: (180,0) -> (880,900)   [Hero Overview]
// 01: (880,0) -> (420,900)   [Services Suite]
// 02: (420,0) -> (880,900)   [Process Workflows]
// 03: (880,0) -> (360,900)   [Pipeline Kanban]
// 04: (360,0) -> (1120,900)  [AI Matching]
// 05: (1120,0) -> (280,900)  [Client Portal]
// 06: (280,0) -> (440,900)   [Productivity]
// 07: (440,0) -> (440,900)   [AI Interview]
// 08: (440,0) -> (440,900)   [Comparison Matrix]
// 09: (440,0) -> (1080,900)  [Pricing Estimator]
// 10: (1080,0) -> (520,900)  [FAQ Accordion]
// 11: (520,0) -> (720,640)   [Start Trial Finish]
const SECTION_CURVE_PATHS = [
  // 00: Overview (Hero - gentle rounded S-curve looping down behind title, exiting vertically at 880,900)
  "M 180,0 C 180,120 360,200 560,180 C 780,150 920,80 1140,120 C 1340,160 1400,380 1320,540 C 1240,700 1040,680 940,740 C 880,780 880,840 880,900",
  // 01: Services Suite (enters vertically at 880,0, sweeps around Bento service cards, exiting vertically at 420,900)
  "M 880,0 C 880,140 1060,240 1180,340 C 1320,460 1280,640 1080,660 C 880,680 720,500 540,560 C 380,620 280,740 320,820 C 360,860 420,840 420,900",
  // 02: Process Workflows (enters vertically at 420,0, weaves across step workflow tabs, exiting vertically at 880,900)
  "M 420,0 C 420,120 260,220 220,360 C 180,500 340,600 560,580 C 800,560 1100,420 1240,540 C 1380,660 1300,800 1120,840 C 980,870 880,840 880,900",
  // 03: Pipeline (enters vertically at 880,0, sweeps around Kanban columns, exiting vertically at 360,900)
  "M 880,0 C 880,120 1120,200 1260,300 C 1400,420 1340,620 1140,620 C 900,620 780,420 580,480 C 380,540 220,680 180,760 C 140,840 360,820 360,900",
  // 04: AI Matching (enters vertically at 360,0, weaves through qualification pills & comparison, exiting vertically at 1120,900)
  "M 360,0 C 360,100 180,240 200,380 C 220,540 520,520 740,460 C 980,400 1260,300 1340,460 C 1400,620 1280,760 1180,820 C 1140,840 1120,860 1120,900",
  // 05: Client Portal (enters vertically at 1120,0, flows through dark review card & actions, exiting vertically at 280,900)
  "M 1120,0 C 1120,120 1300,240 1320,400 C 1340,560 1160,640 920,600 C 680,560 480,440 320,520 C 160,600 120,740 180,800 C 220,850 280,840 280,900",
  // 06: Productivity (enters vertically at 280,0, loops around 14h badge & savings cards, exiting vertically at 440,900)
  "M 280,0 C 280,120 180,260 220,380 C 260,520 480,440 700,460 C 940,480 1180,380 1260,540 C 1340,700 1220,820 1040,850 C 760,880 440,820 440,900",
  // 07: AI Interview (enters vertically at 440,0, sweeps through simulator console, exiting vertically at 440,900)
  "M 440,0 C 440,120 720,180 960,260 C 1220,360 1340,540 1240,680 C 1140,800 880,780 680,820 C 520,850 440,840 440,900",
  // 08: Comparison (enters vertically at 440,0, arches around competitor matrix table, exiting vertically at 440,900)
  "M 440,0 C 440,120 240,240 180,380 C 120,520 260,640 480,600 C 720,560 980,440 1180,500 C 1360,560 1340,740 1180,820 C 1040,880 440,830 440,900",
  // 09: Pricing (enters vertically at 440,0, winds around team slider & calculator cards, exiting vertically at 1080,900)
  "M 440,0 C 440,120 220,240 160,380 C 100,520 220,660 460,620 C 700,580 920,440 1140,480 C 1340,520 1360,720 1240,820 C 1160,880 1080,840 1080,900",
  // 10: FAQ (enters vertically at 1080,0, gracefully arches behind questions, exiting vertically at 520,900)
  "M 1080,0 C 1080,120 1280,260 1240,420 C 1200,580 980,520 740,540 C 500,560 300,440 180,560 C 60,680 120,820 320,850 C 440,870 520,840 520,900",
  // 11: Start Trial (enters vertically at 520,0, swirls into dark CTA hero, terminating right at trial CTA)
  "M 520,0 C 520,120 320,260 280,420 C 240,580 440,700 660,680 C 880,660 1160,540 1220,380 C 1280,220 1080,160 900,240 C 720,320 680,520 720,640",
];

const SECTION_JUNCTION_COORDS = [
  { start: { x: 180, y: 0 }, end: { x: 880, y: 900 } },  // 00: Overview (Hero)
  { start: { x: 880, y: 0 }, end: { x: 420, y: 900 } },  // 01: Services Suite
  { start: { x: 420, y: 0 }, end: { x: 880, y: 900 } },  // 02: Process Workflows
  { start: { x: 880, y: 0 }, end: { x: 360, y: 900 } },  // 03: Pipeline Kanban
  { start: { x: 360, y: 0 }, end: { x: 1120, y: 900 } }, // 04: AI Matching
  { start: { x: 1120, y: 0 }, end: { x: 280, y: 900 } }, // 05: Client Portal
  { start: { x: 280, y: 0 }, end: { x: 440, y: 900 } },  // 06: Productivity
  { start: { x: 440, y: 0 }, end: { x: 440, y: 900 } },  // 07: AI Interview
  { start: { x: 440, y: 0 }, end: { x: 440, y: 900 } },  // 08: Comparison Matrix
  { start: { x: 440, y: 0 }, end: { x: 1080, y: 900 } }, // 09: Pricing
  { start: { x: 1080, y: 0 }, end: { x: 520, y: 900 } }, // 10: FAQ
  { start: { x: 520, y: 0 }, end: { x: 720, y: 640 } },  // 11: Start Trial CTA
];

const OrganicSectionCurve: React.FC<{
  index: number;
  progress?: number;
  isDark?: boolean;
}> = ({ index, progress, isDark = false }) => {
  const pathD = SECTION_CURVE_PATHS[index] || SECTION_CURVE_PATHS[0];
  const initialOffset = progress !== undefined ? 100 * (1 - Math.max(0, Math.min(1, progress))) : (index === 0 ? 65 : 100);

  return (
    <div className="hidden md:block absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
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
          id={`organic-curve-path-${index}`}
          d={pathD}
          pathLength={100}
          stroke={`url(#limeFlow-${index})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="100"
          strokeDashoffset={initialOffset}
          filter={`url(#neonGlow-${index})`}
          className="transition-[stroke-dashoffset] duration-75 ease-out will-change-[stroke-dashoffset]"
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
    q: 'What is InterviewXpert?',
    a: 'InterviewXpert is an intelligent, high-velocity recruitment operating system designed for modern hiring teams and staffing agencies. It combines deep AI resume parsing, candidate scoring, visual Kanban pipelines, automated voice screening, 1-click WhatsApp outreach, and secure live client review links into a single, cohesive workspace.',
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
    a: 'InterviewXpert connects directly with WhatsApp so you can trigger instant candidate outreach, interview invitations, and screening links with 98% open rates compared to 15% for traditional email. Candidates can reply instantly and book time slots on your calendar.',
  },
  {
    q: 'What is included in the 1-month free trial?',
    a: 'You receive full platform access for 30 days — including unlimited resume screening, ATS Kanban boards, WhatsApp outreach, voice screening demo, and live client sharing portals. No credit card is required to get started.',
  },
  {
    q: 'How does the AI Video Interview work and what does it cost?',
    a: 'Our autonomous AI interviewer conducts live, interactive spoken video interviews with candidates 24/7. It asks dynamic technical cross-questions, records full-length HD video with live word-for-word transcripts, enforces anti-cheat verification, and automatically generates personalized evaluation reports with executive scorecards. Pricing is fully dynamic: starting at ₹149 per interview for low volume, scaling down to ₹129 per interview for volume screening (1,000+ candidates), with modular add-ons for MCQ aptitude and cloud coding rounds — saving you over 80% compared to manual recruiter phone interviews.',
  },
  {
    q: 'How is candidate data secured and privacy preserved?',
    a: 'InterviewXpert provides built-in anti-poaching blind masking to hide candidate contact numbers and personal emails when sharing shortlists with external clients. All data is encrypted in transit and at rest with enterprise-grade security protocols.',
  },
];

export default function LandingPage() {
  const { user, userProfile } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVideoModalOpen(false);
      }
    };
    if (videoModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [videoModalOpen]);

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

  // Process Workflows Tab State ('interview' | 'coding' | 'mock')
  const [activeProcessTab, setActiveProcessTab] = useState<'interview' | 'coding' | 'mock'>('interview');

  // Dynamic AI Interview Pricing Calculator State (₹149 down to ₹129 / interview + Modular Rounds)
  const [pricingTab, setPricingTab] = useState<'ai-interviews' | 'subscription'>('ai-interviews');
  const [calcAiInterviews, setCalcAiInterviews] = useState<number>(50);

  // Modular Evaluation Round Checkmarks
  const [includeVoiceRound, setIncludeVoiceRound] = useState<boolean>(true);
  const [includeMcqRound, setIncludeMcqRound] = useState<boolean>(false);
  const [includeCodingRound, setIncludeCodingRound] = useState<boolean>(false);

  const aiInterviewCalc = useMemo(() => {
    const count = Math.max(1, calcAiInterviews);

    // Dynamic tiered pricing:
    // 1. AI Voice & Video Interview Round: ₹149 scaling down to ₹129 for 1,000+ volume
    let voiceRate = 149;
    if (count >= 1000) voiceRate = 129;
    else if (count >= 500) voiceRate = 134;
    else if (count >= 200) voiceRate = 139;
    else if (count >= 50) voiceRate = 144;
    else voiceRate = 149;

    // 2. MCQ / Aptitude Round Add-on: +₹29 scaling down to +₹19 for volume
    let mcqRate = 29;
    if (count >= 1000) mcqRate = 19;
    else if (count >= 500) mcqRate = 22;
    else if (count >= 200) mcqRate = 25;
    else mcqRate = 29;

    // 3. Cloud IDE Coding Challenge Add-on: +₹49 scaling down to +₹39 for volume
    let codingRate = 49;
    if (count >= 1000) codingRate = 39;
    else if (count >= 500) codingRate = 42;
    else if (count >= 200) codingRate = 45;
    else codingRate = 49;

    // Guarantee at least one round is active
    const activeVoice = includeVoiceRound || (!includeMcqRound && !includeCodingRound);
    const activeMcq = includeMcqRound;
    const activeCoding = includeCodingRound;

    const ratePerInterview =
      (activeVoice ? voiceRate : 0) +
      (activeMcq ? mcqRate : 0) +
      (activeCoding ? codingRate : 0);

    const baseRatePerInterview =
      (activeVoice ? 149 : 0) +
      (activeMcq ? 29 : 0) +
      (activeCoding ? 49 : 0);

    const totalCost = count * ratePerInterview;
    const baseTotalCost = count * baseRatePerInterview;
    const volumeDiscount = Math.max(0, baseTotalCost - totalCost);
    const manualScreeningCost = count * 750;
    const recruiterHoursSaved = Math.round(count * 0.75);
    const savingsAmount = Math.max(0, manualScreeningCost - totalCost);
    const savingsPercent = Math.round((savingsAmount / manualScreeningCost) * 100);

    const getRateForCount = (c: number) => {
      let v = 149;
      if (c >= 1000) v = 129;
      else if (c >= 500) v = 134;
      else if (c >= 200) v = 139;
      else if (c >= 50) v = 144;

      let m = 29;
      if (c >= 1000) m = 19;
      else if (c >= 500) m = 22;
      else if (c >= 200) m = 25;

      let cd = 49;
      if (c >= 1000) cd = 39;
      else if (c >= 500) cd = 42;
      else if (c >= 200) cd = 45;

      return (activeVoice ? v : 0) + (activeMcq ? m : 0) + (activeCoding ? cd : 0);
    };

    return {
      count,
      ratePerInterview,
      baseRatePerInterview,
      voiceRate,
      mcqRate,
      codingRate,
      activeVoice,
      activeMcq,
      activeCoding,
      totalCost,
      baseCostAt149: baseTotalCost,
      volumeDiscount,
      manualScreeningCost,
      recruiterHoursSaved,
      savingsAmount,
      savingsPercent,
      getRateForCount,
    };
  }, [calcAiInterviews, includeVoiceRound, includeMcqRound, includeCodingRound]);

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

  useEffect(() => {
    document.title = 'InterviewXpert | #1 AI Applicant Tracking System (ATS) & Autonomous Voice Video Interview Platform';
  }, []);

  // ── High-Performance Dynamic Scroll Tracking ──
  // - On Mobile (< 768px): Curves are hidden and scroll execution is completely bypassed for 120 FPS native scrolling.
  // - On Desktop (>= 768px): SVG strokeDashoffsets are updated directly via DOM without triggering React re-renders.
  useEffect(() => {
    // If mobile, bypass scroll listeners completely
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return;
    }

    const ids = [
      'overview',
      'services',
      'process',
      'pipeline',
      'resume-matching',
      'client-portal',
      'productivity',
      'ai-interview',
      'comparison',
      'pricing',
      'faq',
      'start-trial',
    ];

    let cachedTops: number[] = [];
    let cachedHeights: number[] = [];
    let ticking = false;

    const measureBounds = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      cachedTops = [];
      cachedHeights = [];
      for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById(ids[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          cachedTops.push(rect.top + scrollY);
          cachedHeights.push(rect.height || vh);
        } else {
          cachedTops.push(i * vh);
          cachedHeights.push(vh);
        }
      }
    };

    measureBounds();

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.innerWidth < 768) {
            ticking = false;
            return;
          }

          const vh = window.innerHeight;
          const scrollY = window.scrollY;
          const headerHeight = 72;
          const viewCenter = scrollY + headerHeight + (vh - headerHeight) * 0.45;

          if (cachedTops.length === 0) {
            measureBounds();
          }

          let currentT = 0.35;
          if (scrollY <= 10) {
            currentT = 0.35;
          } else {
            let activeIdx = 0;
            for (let i = 0; i < ids.length; i++) {
              const top = cachedTops[i];
              const bottom = top + cachedHeights[i];
              if (viewCenter >= top && (i === ids.length - 1 || viewCenter < cachedTops[i + 1])) {
                activeIdx = i;
                break;
              }
              if (viewCenter >= bottom && i === ids.length - 1) {
                activeIdx = ids.length - 1;
              }
            }

            if (activeIdx === 0) {
              const nextTop = cachedTops[1] || (cachedTops[0] + cachedHeights[0]);
              const fraction = Math.max(0, Math.min(1, scrollY / (nextTop - headerHeight - 100)));
              currentT = 0.35 + (1 - 0.35) * fraction;
            } else {
              const top = cachedTops[activeIdx];
              const nextTop = cachedTops[activeIdx + 1] || (top + cachedHeights[activeIdx]);
              const range = Math.max(100, nextTop - top);
              const fraction = Math.max(0, Math.min(1, (viewCenter - top) / range));
              currentT = activeIdx + fraction;
            }
          }

          // Directly update SVG path strokeDashoffset via DOM without triggering React re-renders!
          for (let i = 0; i < ids.length; i++) {
            let prog = 0;
            if (currentT >= i + 1) prog = 1;
            else if (currentT <= i) prog = 0;
            else prog = Math.max(0, Math.min(1, currentT - i));

            const pathEl = document.getElementById(`organic-curve-path-${i}`);
            if (pathEl) {
              const offset = (100 * (1 - prog)).toFixed(1);
              if (pathEl.getAttribute('data-offset') !== offset) {
                pathEl.setAttribute('data-offset', offset);
                pathEl.style.strokeDashoffset = offset;
              }
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const handleResize = () => {
      measureBounds();
      handleScroll();
    };
    window.addEventListener('resize', handleResize, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
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
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans selection:bg-[#D4F82C] selection:text-[#111215] mobile-touch-smooth overflow-x-clip">
      {/* ── Top Navigation Bar ── */}
      {/* ── Fixed Floating Top Navigation Bar ── */}
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
              href="#services"
              onClick={(e) => scrollToSection(e, 'services')}
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Services
            </a>
            <a
              href="#process"
              onClick={(e) => scrollToSection(e, 'process')}
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Process
            </a>
            <a
              href="#ai-interview"
              onClick={(e) => scrollToSection(e, 'ai-interview')}
              className="inline-flex items-center gap-1.5 hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>AI Interview</span>
              <span className="size-1.5 rounded-full bg-[#8FB305] animate-pulse" />
            </a>

            {/* Platform Dropdown */}
            <div className="relative group py-2 shrink-0">
              <a
                href="#pipeline"
                onClick={(e) => scrollToSection(e, 'pipeline')}
                className="inline-flex items-center gap-1 hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Platform</span>
                <ChevronDown className="size-3 text-[#73766C] group-hover:rotate-180 transition-transform duration-200" />
              </a>

              {/* Dropdown Menu */}
              <div className="invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 absolute top-full left-1/2 -translate-x-1/2 pt-2 w-72 pointer-events-none group-hover:pointer-events-auto z-50">
                <div className="bg-white rounded-2xl border border-[#E4E7DC] p-2 shadow-xl ring-1 ring-black/5 divide-y divide-[#F1F3EB]">
                  <a
                    href="#pipeline"
                    onClick={(e) => scrollToSection(e, 'pipeline')}
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
                    href="#client-portal"
                    onClick={(e) => scrollToSection(e, 'client-portal')}
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
                    href="#productivity"
                    onClick={(e) => scrollToSection(e, 'productivity')}
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
                </div>
              </div>
            </div>

            <a
              href="#comparison"
              onClick={(e) => scrollToSection(e, 'comparison')}
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Compare
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="hover:text-[#111215] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={(e) => scrollToSection(e, 'faq')}
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
                  href="#services"
                  onClick={(e) => {
                    scrollToSection(e, 'services');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-[#8FB305]" />
                    <span>00 • AI Services Suite</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#process"
                  onClick={(e) => {
                    scrollToSection(e, 'process');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Activity className="size-3.5 text-[#8FB305]" />
                    <span>01 • Process Workflows (AI, Code, Mock)</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

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
                    <span>02 • Visual Pipeline Kanban</span>
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
                    <span>03 • AI Resume Match Scoring</span>
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
                    <span>04 • Live Client Review Portal</span>
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
                    <span>05 • Why Switch & ROI Estimator</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#ai-interview"
                  onClick={(e) => {
                    scrollToSection(e, 'ai-interview');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Video className="size-3.5 text-[#8FB305]" />
                    <span>06 • AI Video & Voice Interview</span>
                  </span>
                  <ChevronRight className="size-3.5 text-[#73766C]" />
                </a>

                <a
                  href="#comparison"
                  onClick={(e) => {
                    scrollToSection(e, 'comparison');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-[#111215] hover:bg-[#F8F9F5] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="size-3.5 text-[#8FB305]" />
                    <span>07 • Competitor Comparison Matrix</span>
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
                    <span>08 • Transparent Team Pricing</span>
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
                    <span>09 • Frequently Asked Questions</span>
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
                    href="https://wa.me/919511779317?text=Hi%20InterviewXpert%20team,%20I%20would%20like%20a%20demo%20of%20the%20platform."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Chat on WhatsApp (+91 95117 79317)</span>
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
        <OrganicSectionCurve index={0} />
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
                Autonomous AI Interviews.<br />
                <span className="text-[#8FB305]">High-Velocity ATS.</span>
              </h1>

              <p className="text-sm sm:text-lg text-[#575A51] max-w-xl leading-relaxed font-normal">
                InterviewXpert is the all-in-one AI Applicant Tracking System for modern recruiters. Automate 2-way voice &amp; video screening, parse resumes instantly, and shortlist top talent 10x faster.
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

                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2.5 px-6 rounded-full border border-[#E4E7DC] hover:border-[#111215] bg-white hover:bg-[#F8F9F5] text-sm font-bold text-[#111215] transition-all shadow-xs cursor-pointer group"
                >
                  <span className="size-6 rounded-full bg-[#111215] text-[#D4F82C] flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                    <Play className="size-3 fill-current ml-0.5" />
                  </span>
                  <span>Watch interactive demo</span>
                  <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full bg-[#D4F82C] text-[#111215]">30s</span>
                </button>
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

      {/* ── SECTION: COMPREHENSIVE AI TALENT SERVICES & CAPABILITIES SUITE ── */}
      <section id="services" className="smooth-scroll-section relative z-15 min-h-[auto] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-20 py-14 sm:py-24 border-b border-[#E4E7DC] overflow-x-clip">
        <OrganicSectionCurve index={1} />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 w-full relative z-10">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[#111215] text-[10px] font-mono font-bold uppercase tracking-wider mb-3 shadow-2xs">
              <span className="size-2 rounded-full bg-[#D4F82C]"></span>
              <span>END-TO-END AUTONOMOUS TALENT ARCHITECTURE</span>
            </div>
            <h2 className="text-2xl sm:text-5xl font-black text-[#111215] tracking-tight leading-tight">
              Six Comprehensive Services.<br />
              One Autonomous Recruitment Engine.
            </h2>
            <p className="mt-3 text-xs sm:text-base text-[#575A51] leading-relaxed">
              Whether you are an enterprise staffing agency placing hundreds of engineers, a high-growth startup screening 500+ applicants overnight, or a job seeker preparing for your dream engineering role — InterviewXpert delivers specialized, AI-powered solutions across the entire hiring lifecycle.
            </p>
          </div>

          {/* 6 Core Services Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Service 1: Autonomous AI Video & Voice Interviewing */}
            <div className="rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-7 shadow-xs hover:border-[#111215] transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Video size={22} />
                  </div>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                    24/7 Screening
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#111215] mb-2">
                  Autonomous AI Technical & Spoken Interviewing
                </h3>
                <p className="text-xs text-[#575A51] leading-relaxed mb-5">
                  Eliminate 100+ hours of manual first-round recruiter phone calls. Conversational AI agent Alex conducts live, bidirectional spoken interviews with sub-300ms latency, asking dynamic technical follow-ups based on candidate logic.
                </p>

                <div className="space-y-2 pt-4 border-t border-[#E4E7DC] text-xs text-[#111215]">
                  {[
                    'Natural speech-to-speech with sub-300ms conversational latency',
                    'Dynamic context-aware follow-up cross-questioning',
                    'Searchable live word-for-word transcripts with timestamps',
                    'Dual video/audio anti-cheat proctoring & tab-switch logs',
                    '60-second multi-dimensional evaluation report & hire score',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#8FB305] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#E4E7DC] flex items-center justify-between">
                <Link
                  to="/interview/demo"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111215] hover:text-[#8FB305] transition-colors"
                >
                  <span>Experience Live Interview</span>
                  <ArrowRight size={13} />
                </Link>
                <span className="text-[10px] font-mono text-[#73766C]">Instant AI Dossier</span>
              </div>
            </div>

            {/* Service 2: AI Mock Interview & Candidate Preparation Hub */}
            <div className="rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-7 shadow-xs hover:border-[#111215] transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <GraduationCap size={22} />
                  </div>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C]">
                    Job Seekers & Students
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#111215] mb-2">
                  AI Mock Interview & Candidate Career Hub
                </h3>
                <p className="text-xs text-[#575A51] leading-relaxed mb-5">
                  A high-impact simulation suite designed for candidates, universities, and bootcamps. Practice real-world technical and behavioral rounds with realistic voice agents and receive instant diagnostic feedback before actual job interviews.
                </p>

                <div className="space-y-2 pt-4 border-t border-[#E4E7DC] text-xs text-[#111215]">
                  {[
                    'Specialized tracks: Frontend, Backend, Fullstack, AI/ML & System Design',
                    'Real-time speaking pace (WPM), pause intervals & filler word tracking',
                    'AI STAR method behavioral response coaching & rewrites',
                    'Architectural model answer breakdowns with code optimizations',
                    'Verified digital assessment scorecards ready for LinkedIn sharing',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#8FB305] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#E4E7DC] flex items-center justify-between">
                <Link
                  to="/candidate"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111215] hover:text-[#8FB305] transition-colors"
                >
                  <span>Launch Candidate Hub</span>
                  <ArrowRight size={13} />
                </Link>
                <span className="text-[10px] font-mono text-[#73766C]">Instant Feedback</span>
              </div>
            </div>

            {/* Service 3: AI Assessments & Coding Engine with Syllabus Upload */}
            <div className="rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-7 shadow-xs hover:border-[#111215] transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Code2 size={22} />
                  </div>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Syllabus Upload Grounded
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#111215] mb-2">
                  AI Technical Assessments & Cloud IDE Engine
                </h3>
                <p className="text-xs text-[#575A51] leading-relaxed mb-5">
                  Generate aptitude and coding challenges strictly formulated around your internal curriculum. Attach any syllabus or training PDF, and the AI guarantees zero off-topic questions with built-in multi-language code execution.
                </p>

                <div className="space-y-2 pt-4 border-t border-[#E4E7DC] text-xs text-[#111215]">
                  {[
                    '1-Click PDF Syllabus / Curriculum ingestion for strict question grounding',
                    'In-browser IDE supporting 15+ languages (Python, TS, Java, C++, Go)',
                    'Automated algorithmic time & space complexity verification O(n)',
                    'Fullscreen enforcement, copy-paste block & developer tool lockout',
                    'Mix Aptitude, DSA problem solving, bugfix, and low-level system design',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#8FB305] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#E4E7DC] flex items-center justify-between">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111215] hover:text-[#8FB305] transition-colors"
                >
                  <span>Create Assessment</span>
                  <ArrowRight size={13} />
                </Link>
                <span className="text-[10px] font-mono text-[#73766C]">Multi-Lang IDE</span>
              </div>
            </div>

            {/* Service 4: Interactive Client Review & Shortlist Portal */}
            <div className="rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-7 shadow-xs hover:border-[#111215] transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Share2 size={22} />
                  </div>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                    Zero Login Needed
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#111215] mb-2">
                  Interactive Client Review & Shortlist Portal
                </h3>
                <p className="text-xs text-[#575A51] leading-relaxed mb-5">
                  Stop emailing plain PDF resumes that get ignored. Provide external clients and enterprise hiring managers with sleek, interactive candidate dossiers featuring audio answer clips, proctoring scorecards, and 1-click approvals.
                </p>

                <div className="space-y-2 pt-4 border-t border-[#E4E7DC] text-xs text-[#111215]">
                  {[
                    'Embedded spoken audio answer playback — hear candidate voice in 10s',
                    'Complete dossier overview: technical scores, anti-cheat confidence & CV',
                    '1-click hiring manager actions: "Approve & Advance" or "Decline" with notes',
                    'Two-way real-time status synchronization to recruiter ATS Kanban board',
                    'Anti-poaching blind masking protects recruiter candidate contact ownership',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#8FB305] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#E4E7DC] flex items-center justify-between">
                <a
                  href="#client-portal"
                  onClick={(e) => scrollToSection(e, 'client-portal')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111215] hover:text-[#8FB305] transition-colors cursor-pointer"
                >
                  <span>Explore Client Portal Demo</span>
                  <ArrowRight size={13} />
                </a>
                <span className="text-[10px] font-mono text-[#73766C]">Audio Playback</span>
              </div>
            </div>

            {/* Service 5: Smart Resume Matching & Semantic Talent Search */}
            <div className="rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-7 shadow-xs hover:border-[#111215] transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Brain size={22} />
                  </div>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-[#F8F9F5] text-[#111215] border border-[#E4E7DC]">
                    Semantic Vector Match
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#111215] mb-2">
                  Smart Resume Matching & Semantic Talent Search
                </h3>
                <p className="text-xs text-[#575A51] leading-relaxed mb-5">
                  High-speed resume ingestion for PDF, DOCX, and TXT files. Contextual semantic matching extracts skills, career trajectories, and calculates a 0–100% precision fit score against your custom job description in seconds.
                </p>

                <div className="space-y-2 pt-4 border-t border-[#E4E7DC] text-xs text-[#111215]">
                  {[
                    'Instant multi-format parsing for PDF, DOCX & TXT with zero data loss',
                    'Contextual understanding of equivalent tech stacks (FastAPI vs Express)',
                    'Unbiased 0–100% candidate fit ranking against open requisitions',
                    'Natural language candidate rediscovery across legacy talent pools',
                    'Slide-over PDF resume previewer with highlighted skill match badges',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#8FB305] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#E4E7DC] flex items-center justify-between">
                <a
                  href="#resume-matching"
                  onClick={(e) => scrollToSection(e, 'resume-matching')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111215] hover:text-[#8FB305] transition-colors cursor-pointer"
                >
                  <span>View Resume Matcher</span>
                  <ArrowRight size={13} />
                </a>
                <span className="text-[10px] font-mono text-[#73766C]">0-100% Scoring</span>
              </div>
            </div>

            {/* Service 6: Automated WhatsApp Candidate Engagement & Outreach */}
            <div className="rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-7 shadow-xs hover:border-[#111215] transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <MessageCircle size={22} />
                  </div>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    82%+ Open Rate
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#111215] mb-2">
                  Automated WhatsApp & Multi-Channel Outreach
                </h3>
                <p className="text-xs text-[#575A51] leading-relaxed mb-5">
                  Reach candidates where they actually open messages. Trigger 1-click WhatsApp invitations, scheduled reminder sequences, and status updates directly from your Kanban pipeline with 4x higher completion rates than cold emails.
                </p>

                <div className="space-y-2 pt-4 border-t border-[#E4E7DC] text-xs text-[#111215]">
                  {[
                    'Native WhatsApp Business API integration for instant candidate outreach',
                    'Automated 1-click interview invitation links sent straight to WhatsApp',
                    'Smart reminder sequences (2hr / 30m) to minimize interview no-shows',
                    'High-deliverability AWS SES email workflows as automated redundancy',
                    'Two-way sync: candidate confirmation updates ATS Kanban cards instantly',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#8FB305] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#E4E7DC] flex items-center justify-between">
                <a
                  href="https://wa.me/919511779317?text=Hi%20InterviewXpert%20team,%20I%20would%20like%20to%20know%20more%20about%20the%20platform%20and%20request%20a%20demo."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  <MessageCircle size={13} />
                  <span>Connect on WhatsApp</span>
                </a>
                <span className="text-[10px] font-mono text-[#73766C]">+91 95117 79317</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── SECTION: STEP-BY-STEP PROCESS WORKFLOWS (AI INTERVIEW • CODING TEST • MOCK TEST) ── */}
      <section id="process" className="smooth-scroll-section relative z-18 min-h-[auto] flex flex-col justify-center bg-[#F1F3EB] scroll-mt-20 py-14 sm:py-24 border-b border-[#E4E7DC] overflow-x-clip">
        <OrganicSectionCurve index={2} />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 w-full relative z-10">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[#111215] text-[10px] font-mono font-bold uppercase tracking-wider mb-3 shadow-2xs">
              <span className="size-2 rounded-full bg-[#8FB305]"></span>
              <span>STEP-BY-STEP EXECUTION PLAYBOOK</span>
            </div>
            <h2 className="text-2xl sm:text-5xl font-black text-[#111215] tracking-tight leading-tight">
              How It Works: Clear, Autonomous Workflows
            </h2>
            <p className="mt-3 text-xs sm:text-base text-[#575A51] leading-relaxed">
              Explore the exact step-by-step lifecycle for our primary engines: autonomous AI interviews for recruiters, syllabus-grounded coding assessments, and self-serve mock test coaching for candidates.
            </p>

            {/* Interactive Process Switcher Tabs */}
            <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-white border border-[#E4E7DC] shadow-sm max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveProcessTab('interview')}
                className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeProcessTab === 'interview'
                    ? 'bg-[#111215] text-[#D4F82C] shadow-md'
                    : 'text-[#575A51] hover:text-[#111215] hover:bg-[#F8F9F5]'
                }`}
              >
                <Video size={14} className={activeProcessTab === 'interview' ? 'text-[#D4F82C]' : 'text-[#73766C]'} />
                <span>AI Video Interview Process</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProcessTab('coding')}
                className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeProcessTab === 'coding'
                    ? 'bg-[#111215] text-[#D4F82C] shadow-md'
                    : 'text-[#575A51] hover:text-[#111215] hover:bg-[#F8F9F5]'
                }`}
              >
                <Code2 size={14} className={activeProcessTab === 'coding' ? 'text-[#D4F82C]' : 'text-[#73766C]'} />
                <span>Coding Assessment Process</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProcessTab('mock')}
                className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeProcessTab === 'mock'
                    ? 'bg-[#111215] text-[#D4F82C] shadow-md'
                    : 'text-[#575A51] hover:text-[#111215] hover:bg-[#F8F9F5]'
                }`}
              >
                <GraduationCap size={14} className={activeProcessTab === 'mock' ? 'text-[#D4F82C]' : 'text-[#73766C]'} />
                <span>Mock Interview & Prep Process</span>
              </button>
            </div>
          </div>

          {/* TAB 1: AI VIDEO INTERVIEW PROCESS */}
          {activeProcessTab === 'interview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E4E7DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#8FB305] tracking-wider">
                    Recruiter-to-Candidate Pipeline
                  </span>
                  <h3 className="text-base font-black text-[#111215]">
                    5-Stage Autonomous Spoken Video Screening Flow
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold">
                    Total Time: &lt; 20 Mins / Candidate
                  </span>
                </div>
              </div>

              {/* 5 Process Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Step 1 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        01
                      </span>
                      <Bot size={18} className="text-[#8FB305]" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Configure Requisition & Questions
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Recruiter inputs job title, seniority, tech stack, or attaches a curriculum/JD PDF. AI formulates custom architecture & scenario questions in 60s.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Setup: 90 Seconds
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        02
                      </span>
                      <Send size={18} className="text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Automated WhatsApp & Email Invite
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidates receive personalized WhatsApp invites with dynamic session links, calendar sync, and automated reminder sequences 2 hours before the cutoff.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    82%+ Open Rate
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        03
                      </span>
                      <Mic size={18} className="text-blue-600" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      24/7 Spoken Session with Alex
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidate joins via browser anytime. Conversational AI agent Alex speaks naturally with sub-300ms latency. Fullscreen & tab proctoring active throughout.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Zero Recruiter Effort
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        04
                      </span>
                      <Brain size={18} className="text-purple-600" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Contextual Dynamic Cross-Questioning
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Alex listens to candidate explanations and poses spontaneous follow-up questions probing edge cases and architectural logic. Live transcript indexed with timestamps.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Anti-Cheat Immunity
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#D4F82C] text-[#111215] text-xs font-mono font-black flex items-center justify-center">
                        05
                      </span>
                      <Share2 size={18} className="text-[#8FB305]" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      60s Dossier & 1-Click Client Portal
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      System generates multi-factor evaluation dossier in 60s. Recruiter shares zero-login client link with audio answer clips and 1-click hiring manager approvals.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Auto-Graded Report
                  </div>
                </div>

              </div>

              {/* Action Callout */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs text-[#575A51]">
                  Want to see this live from a candidate's perspective?
                </span>
                <Link
                  to="/interview/demo"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-bold hover:bg-black transition-all shadow-xs"
                >
                  <Play size={12} className="fill-current" />
                  <span>Launch 2-Minute Candidate Test Drive</span>
                </Link>
              </div>
            </div>
          )}

          {/* TAB 2: CODING ASSESSMENT PROCESS */}
          {activeProcessTab === 'coding' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E4E7DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#8FB305] tracking-wider">
                    Technical Assessment Engine
                  </span>
                  <h3 className="text-base font-black text-[#111215]">
                    5-Stage Algorithmic & Cloud IDE Evaluation Flow
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold">
                    15+ Languages • Cloud Compiler
                  </span>
                </div>
              </div>

              {/* 5 Process Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Step 1 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        01
                      </span>
                      <FileText size={18} className="text-[#8FB305]" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Syllabus & PDF Curriculum Ingestion
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Recruiter selects programming language and attaches a course syllabus or technical specification PDF. AI guarantees challenges are strictly formulated from that material.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Zero Generic Trivia
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        02
                      </span>
                      <Lock size={18} className="text-rose-600" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Proctored Browser IDE Lockdown
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidate launches the IDE under strict proctoring: fullscreen enforcement, clipboard paste disablement, browser window blur logging, and devtools block.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Anti-Cheat Enforcement
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        03
                      </span>
                      <Code2 size={18} className="text-blue-600" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Live Compilation & Test Execution
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidate writes code and executes tests against sample and hidden test suites. Real-time compiler outputs stdout, memory consumption, and runtime metrics.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Sub-Second Compilation
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        04
                      </span>
                      <Zap size={18} className="text-amber-500" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Complexity & Cleanliness Analysis
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Engine analyzes Time Complexity O(n) and Space Complexity, identifying brute-force solutions, memory leaks, and adherence to clean coding principles.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Algorithmic Efficiency
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#D4F82C] text-[#111215] text-xs font-mono font-black flex items-center justify-center">
                        05
                      </span>
                      <Kanban size={18} className="text-[#8FB305]" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Automated Grading & Kanban Update
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Upon submission, test scores, code diffs, and execution logs immediately sync to the ATS Kanban pipeline, auto-advancing qualifying engineers to the voice round.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    100% Automated Scoring
                  </div>
                </div>

              </div>

              {/* Action Callout */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs text-[#575A51]">
                  Need custom assessments generated from your internal engineering syllabus?
                </span>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-bold hover:bg-black transition-all shadow-xs"
                >
                  <span>Build Assessment with Syllabus Upload</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}

          {/* TAB 3: MOCK TEST & CANDIDATE PREPARATION PROCESS */}
          {activeProcessTab === 'mock' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E4E7DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#8FB305] tracking-wider">
                    Candidate & Student Career Hub
                  </span>
                  <h3 className="text-base font-black text-[#111215]">
                    5-Stage Interactive Mock Interview & Diagnostic Coaching Flow
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-mono font-bold">
                    For Job Seekers & Bootcamps
                  </span>
                </div>
              </div>

              {/* 5 Process Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Step 1 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        01
                      </span>
                      <Target size={18} className="text-[#8FB305]" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Select Career Track & Seniority
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidate selects target discipline: Frontend, Backend, Fullstack, AI/ML, System Design, or HR Behavioral. Optionally pastes target job description.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Tailored Simulation
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        02
                      </span>
                      <Volume2 size={18} className="text-blue-600" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Live Spoken Voice Dialogue
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidate answers spoken questions naturally into their mic in a stress-free environment. AI prompts real-world scenarios and dynamic cross-questions.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Zero-Pressure Rehearsal
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        03
                      </span>
                      <Sliders size={18} className="text-purple-600" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Speech Analytics & Pacing Analysis
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      System measures speaking rate in WPM (Words/Min), pause intervals, and counts verbal filler words ("um", "like", "you know") to optimize vocal delivery.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Quantified Fluency
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-mono font-black flex items-center justify-center">
                        04
                      </span>
                      <Sparkles size={18} className="text-amber-500" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      AI STAR Method Model Rewrites
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      AI breaks down candidate answers and provides step-by-step model rewrites using the STAR method (Situation, Task, Action, Result) with code optimization tips.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Actionable Coaching
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] hover:border-[#111215] transition-all flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="size-8 rounded-xl bg-[#D4F82C] text-[#111215] text-xs font-mono font-black flex items-center justify-center">
                        05
                      </span>
                      <Award size={18} className="text-[#8FB305]" />
                    </div>
                    <h4 className="text-sm font-black text-[#111215] mb-1.5">
                      Verified LinkedIn Skill Badge
                    </h4>
                    <p className="text-xs text-[#575A51] leading-relaxed">
                      Candidate receives an interactive diagnostic performance radar and a verified digital skill badge ready to share on LinkedIn to attract hiring recruiters.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E7DC] text-[10px] font-mono text-[#73766C]">
                    Shareable Credential
                  </div>
                </div>

              </div>

              {/* Action Callout */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs text-[#575A51]">
                  Are you a student or developer looking to sharpen your technical interview skills?
                </span>
                <Link
                  to="/candidate"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-bold hover:bg-black transition-all shadow-xs"
                >
                  <GraduationCap size={14} />
                  <span>Start Free Mock Interview Session</span>
                </Link>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ── SECTION 2: DEDICATED FULL FRAME KANBAN PIPELINE CARD ── */}
      <section id="pipeline" className="smooth-scroll-section relative z-20 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={3} />
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
                  InterviewXpert Recruitment OS
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
                    <span>InterviewXpert ATS</span>
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
      <section id="resume-matching" className="smooth-scroll-section relative z-30 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={4} />
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
                      loading="lazy"
                      decoding="async"
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
      <section id="client-portal" className="smooth-scroll-section relative z-40 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#111215] text-white scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={5} isDark={true} />
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
                      loading="lazy"
                      decoding="async"
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
      <section id="productivity" className="smooth-scroll-section relative z-50 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={6} />
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10 space-y-8 sm:space-y-10">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215]">
              <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span>05 • WHY RECRUITERS SWITCH</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#111215] tracking-tight leading-[1.08]">
              Traditional ATS Creates Work.<br />
              <span className="text-[#8FB305]">InterviewXpert Does It.</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#575A51] max-w-2xl mx-auto leading-relaxed">
              See why legacy recruiting software slows hiring teams down, and how InterviewXpert automates the repetitive busywork from requisition to signed offer.
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

            {/* Right Card: InterviewXpert ATS (Autonomous Intelligence) */}
            <div className="rounded-2xl border border-[#111215] bg-[#111215] text-white p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 size-32 bg-[#D4F82C]/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4F82C]">
                    Autonomous Intelligence
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">InterviewXpert ATS</h3>
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
                        <th className="py-3 px-4 font-bold text-[#111215] uppercase tracking-wider text-[10px] w-3/8 bg-[#F8F9F5]">InterviewXpert ATS</th>
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
                      <h3 className="text-sm sm:text-base font-bold text-[#111215]">Time Saved with InterviewXpert</h3>
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
                        <div className="text-[11px] text-[#73766C]">Traditional: 30 min → InterviewXpert: Seconds</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-[#F1F3EB] text-[#111215] font-black font-mono">
                        ~30 min saved
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#111215]">Screen 100 resumes</div>
                        <div className="text-[11px] text-[#73766C]">Traditional: 5 hrs → InterviewXpert: 10 min AI scoring</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-[#D4F82C] text-[#111215] font-black font-mono">
                        ~4.5 hrs saved
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#111215]">Write candidate ads</div>
                        <div className="text-[11px] text-[#73766C]">Traditional: 45 min → InterviewXpert: 1 min AI ads</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-[#F1F3EB] text-[#111215] font-black font-mono">
                        ~44 min saved
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#111215]">Candidate follow-ups</div>
                        <div className="text-[11px] text-[#73766C]">Traditional: 3 hrs → InterviewXpert: Auto WhatsApp alerts</div>
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

      {/* ── SECTION: AI VIDEO & VOICE INTERVIEW SHOWCASE ── */}
      <section id="ai-interview" className="smooth-scroll-section relative z-55 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#0B0D0F] text-white scroll-mt-18 transition-all duration-300 overflow-x-clip py-14 sm:py-20 border-y border-white/10">
        <OrganicSectionCurve index={7} isDark={true} />
        <div className="flex-1 flex flex-col justify-center py-6 sm:py-10 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-[#D4F82C] text-[10px] font-mono font-bold uppercase tracking-wider mb-3 shadow-xs">
              <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span>24/7 AUTONOMOUS INTERVIEWS • CLIENT-READY EVALUATIONS</span>
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-[#8F9489] mb-2">
              Autonomous Video & Spoken Screening
            </div>
            <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Real Spoken Technical Interviews. Conducted Intelligently 24/7.
            </h2>
            <p className="mt-3 text-xs sm:text-base text-[#A1A79B] leading-relaxed">
              Screen hundreds of applicants simultaneously without burning senior engineering or recruiter bandwidth.
              Receive deep personalised evaluation reports, word-for-word live transcripts, permanent HD video recordings, and verified anti-cheat evidence — delivering instant hiring intelligence with zero recruiter fatigue.
            </p>
          </div>

          {/* Interactive Live Interview Simulator Mockup */}
          <div className="mb-14 rounded-3xl border border-white/15 bg-white/[0.02] p-4 sm:p-7 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="size-3 rounded-full bg-rose-500 animate-ping"></div>
                <span className="text-xs font-mono font-bold text-white tracking-wide">LIVE INTERVIEW SESSION SIMULATOR</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  Real-Time Spoken Dialogue • 100% Anti-Cheat Verified
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/interview/demo"
                  className="px-3.5 py-1.5 rounded-full bg-[#D4F82C] hover:bg-[#c2e424] text-[#111215] text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Play size={12} className="fill-current" />
                  <span>Launch Live Candidate Demo</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left: Candidate Video Feed & Real-time Speech Captions */}
              <div className="lg:col-span-7 rounded-2xl bg-[#111215] border border-white/10 p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between text-xs mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                      <span>LIVE REC 1080p HD</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                      <ShieldCheck size={11} />
                      <span>FULLSCREEN PROCTOR & TAB-MONITOR ON</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#A1A79B]">QUESTION 1 OF 5 • 01:42</span>
                </div>

                {/* Candidate Video Simulation */}
                <div className="relative aspect-video rounded-xl bg-neutral-900 border border-white/5 overflow-hidden flex items-center justify-center mb-4">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
                    alt="Candidate video screening"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover opacity-85"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none"></div>
                  
                  {/* Focus tracking reticle */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-emerald-400 border border-white/10">
                    <Activity size={11} className="text-emerald-400 animate-pulse" />
                    <span>Candidate Eye-Contact: 98% Verified</span>
                  </div>

                  {/* Question Overlay Banner */}
                  <div className="absolute bottom-3 inset-x-3 p-3 rounded-lg bg-black/80 backdrop-blur-md border border-white/15">
                    <p className="text-[10px] font-bold uppercase text-[#D4F82C] mb-0.5">Current Core Question</p>
                    <p className="text-xs sm:text-sm font-semibold text-white leading-snug">
                      "How do you design a resilient caching layer to mitigate cache stampedes during flash sales?"
                    </p>
                  </div>
                </div>

                {/* Live Candidate Speech Caption Box */}
                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 uppercase">
                      <span className="size-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>Real-Time Searchable Transcript (Live Audio Feed)</span>
                    </span>
                    <span className="text-[10px] text-[#A1A79B] font-mono">128 WPM</span>
                  </div>
                  <p className="text-xs font-medium text-neutral-200 italic leading-relaxed">
                    "We implement a Redis cluster with probabilistic early expiration and mutex locks to ensure only one worker thread recalculates hot cache entries while secondary requests receive stale-while-revalidate data..."
                  </p>
                </div>
              </div>

              {/* Right: AI Interviewer "Alex" Reactive Console */}
              <div className="lg:col-span-5 rounded-2xl bg-[#14171B] border border-white/10 p-5 flex flex-col justify-between">
                <div>
                  {/* Alex Header Card */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 mb-4">
                    <div className="relative size-12 rounded-full bg-gradient-to-tr from-[#D4F82C]/30 via-emerald-500/20 to-blue-500/30 flex items-center justify-center border border-[#D4F82C]/40">
                      <Bot size={22} className="text-[#D4F82C]" />
                      <span className="absolute inset-0 rounded-full border border-[#D4F82C]/50 animate-ping opacity-40"></span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white">Alex</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#D4F82C] text-[#111215] text-[9px] font-black uppercase">Autonomous Lead</span>
                      </div>
                      <p className="text-[11px] text-[#A1A79B]">Principal Technical Interviewer • Active</p>
                    </div>
                  </div>

                  {/* AI Compliment Banner */}
                  <div className="mb-3 p-3 rounded-xl bg-[#D4F82C]/10 border border-[#D4F82C]/30 text-white flex items-center gap-2 animate-fade-in shadow-xs">
                    <Sparkles size={16} className="text-[#D4F82C] shrink-0" />
                    <span className="text-xs font-bold text-[#D4F82C]">
                      Alex: "Spot on! That's a very clean architectural solution for cache stampedes."
                    </span>
                  </div>

                  {/* Dynamic Cross-Question Card */}
                  <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 text-amber-200">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1">
                      <Zap size={12} className="text-amber-400" />
                      <span>Contextual Technical Follow-up (Dynamic Cross-Question)</span>
                    </div>
                    <p className="text-xs font-semibold text-white leading-relaxed">
                      "What happens if your primary Redis node undergoes replica lag or network partition during peak traffic?"
                    </p>
                  </div>

                  {/* Real-Time Speech Analytics Bar */}
                  <div className="grid grid-cols-2 gap-2 text-center mb-4">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-bold text-[#A1A79B]">Words Spoken</p>
                      <p className="text-base font-black text-white">142</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-bold text-[#A1A79B]">Speaking Pace</p>
                      <p className="text-base font-black text-emerald-400">128 <span className="text-[10px] font-normal">WPM</span></p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-bold text-[#A1A79B]">Fluency Score</p>
                      <p className="text-base font-black text-[#D4F82C]">96%</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-bold text-[#A1A79B]">Anti-Cheat Status</p>
                      <p className="text-base font-black text-emerald-400">100% Clean</p>
                    </div>
                  </div>
                </div>

                {/* Scorecard Preview Callout */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-[#A1A79B] flex items-center justify-between">
                  <span>Personalised Evaluation Report & Evidence Dossier Generated on Finish</span>
                  <span className="font-bold text-white flex items-center gap-1">
                    Auto-Graded <CheckCircle2 size={13} className="text-emerald-400" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 6 Core Client Advantages Grid (Promotional & Benefit-Driven) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            
            {/* Advantage 1: Personalised Reports */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#D4F82C]/50 transition-all hover:bg-white/[0.05] group">
              <div className="size-10 rounded-xl bg-[#D4F82C]/10 border border-[#D4F82C]/20 flex items-center justify-center text-[#D4F82C] mb-4 group-hover:scale-110 transition-transform">
                <FileCheck size={20} />
              </div>
              <h3 className="text-base font-black text-white mb-1.5">Personalised Evaluation Reports</h3>
              <p className="text-xs text-[#A1A79B] leading-relaxed">
                Comprehensive candidate dossier generated within 60 seconds. Includes technical depth scores, communication ratings, core competency rubrics, and hire recommendations ready to present directly to clients.
              </p>
            </div>

            {/* Advantage 2: Real-Time Transcripts */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#D4F82C]/50 transition-all hover:bg-white/[0.05] group">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <FileText size={20} />
              </div>
              <h3 className="text-base font-black text-white mb-1.5">Real-Time Searchable Transcripts</h3>
              <p className="text-xs text-[#A1A79B] leading-relaxed">
                Word-for-word transcript generated live as the candidate answers. Fully searchable and timestamped — review an entire 15-minute technical discussion in 60 seconds without scrubbing through video.
              </p>
            </div>

            {/* Advantage 3: Permanent Video Storing */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#D4F82C]/50 transition-all hover:bg-white/[0.05] group">
              <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                <Video size={20} />
              </div>
              <h3 className="text-base font-black text-white mb-1.5">Permanent HD Video & Audio Storage</h3>
              <p className="text-xs text-[#A1A79B] leading-relaxed">
                Every interview is recorded in 1080p HD video and clear studio audio, securely stored in the cloud forever. Re-watch critical answers, share full recordings with hiring managers, and build an on-demand talent archive.
              </p>
            </div>

            {/* Advantage 4: Complete Anti-Cheat Evidence */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#D4F82C]/50 transition-all hover:bg-white/[0.05] group">
              <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-black text-white mb-1.5">Complete Evidence & Audit Logs</h3>
              <p className="text-xs text-[#A1A79B] leading-relaxed">
                Full integrity logs maintain indisputable evidence: tab-switch detection, browser window minimize events, multiple face warnings, and background speech anomalies — ensuring 100% genuine candidate submissions.
              </p>
            </div>

            {/* Advantage 5: Automated Messages */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#D4F82C]/50 transition-all hover:bg-white/[0.05] group">
              <div className="size-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-base font-black text-white mb-1.5">Automated WhatsApp & Email Messaging</h3>
              <p className="text-xs text-[#A1A79B] leading-relaxed">
                Zero manual coordination. Candidates automatically receive personalized WhatsApp & email interview invites with 1-click test links, automated calendar reminders, and instant completion updates sent to hiring teams.
              </p>
            </div>

            {/* Advantage 6: Dynamic Cross-Questioning */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#D4F82C]/50 transition-all hover:bg-white/[0.05] group">
              <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                <Brain size={20} />
              </div>
              <h3 className="text-base font-black text-white mb-1.5">Active Listening & Cross-Questioning</h3>
              <p className="text-xs text-[#A1A79B] leading-relaxed">
                Alex actively listens, comprehends candidate explanations, and poses sharp contextual follow-up questions in real time — probing architectural choices, edge cases, and verifying hands-on authenticity.
              </p>
            </div>

          </div>

          {/* Detailed AI Interview Technical Capabilities & Architecture Table */}
          <div id="interview-matrix" className="mb-14 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-8 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#D4F82C]/10 border border-[#D4F82C]/20 text-[#D4F82C] text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
                  <Activity size={12} className="text-[#D4F82C]" />
                  <span>DEEP ARCHITECTURE & CAPABILITIES MATRIX</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  AI Interview Engine Detailed Technical Specifications
                </h3>
                <p className="text-xs text-[#A1A79B] mt-1">
                  How our neural audio, contextual reasoning, and proctoring pipelines outperform traditional phone screens.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono font-bold text-neutral-300">
                  10 Enterprise Pillars
                </span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[#A1A79B]">
                    <th className="py-3 px-4 font-bold text-white">Dimension / Pipeline</th>
                    <th className="py-3 px-4 font-bold text-white">InterviewXpert Architecture</th>
                    <th className="py-3 px-4 font-bold text-[#D4F82C]">Benchmark / Spec</th>
                    <th className="py-3 px-4 font-bold text-white">Recruiter & Quality Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-neutral-200">
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Mic size={14} className="text-[#D4F82C] shrink-0" />
                      <span>Speech-to-Speech Real-time Latency</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Sub-300ms bidirectional edge voice processing with neural acoustic streaming.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#D4F82C]">
                      &lt; 300ms Turnaround
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Eliminates awkward robotic pauses; creates a natural, human-like technical dialogue.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Brain size={14} className="text-emerald-400 shrink-0" />
                      <span>Dynamic Contextual Cross-Questioning</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Multi-turn conversational memory analyzes candidate claims and probes technical reasoning.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      Multi-Turn Context
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Probes real architecture choices; completely defeats memorized or AI-prompted cheat sheets.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <FileText size={14} className="text-blue-400 shrink-0" />
                      <span>Custom Syllabus & JD PDF Grounding</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Vectorized PDF/DOCX ingestion with strict bounding rules to prevent off-topic questions.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      1-Click Syllabus PDF
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Formulates questions strictly tailored to your engineering stack or curriculum.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <ShieldCheck size={14} className="text-purple-400 shrink-0" />
                      <span>Anti-Cheat & Tab-Switch Proctoring</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Dual-stream video/audio proctoring, browser blur tracking, eye-tracking & multi-face alerts.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                      99.8% Integrity Log
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Provides indisputable evidence of candidate authenticity; prevents proxy test takers.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <FileCheck size={14} className="text-amber-400 shrink-0" />
                      <span>Word-for-Word Live Transcripts</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Live streaming speech-to-text with word-level timestamps and searchable keyword anchors.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                      100% Searchable
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Review a 20-minute technical interview in 45 seconds by jumping straight to key questions.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Volume2 size={14} className="text-[#D4F82C] shrink-0" />
                      <span>Speech Analytics & Fluency Metrics</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Acoustic feature extraction measuring speaking rate (WPM), hesitation, and filler word frequency.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#D4F82C]">
                      Pace & Fluency Radar
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Delivers objective communication metrics without subjective recruiter bias.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Video size={14} className="text-emerald-400 shrink-0" />
                      <span>Permanent HD Video & Audio Cloud Storage</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Secure cloud storage with encrypted permanent links for video and audio playback.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      1080p HD Studio Audio
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Share verified authentic video answers directly with hiring managers across the globe.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Sparkles size={14} className="text-rose-400 shrink-0" />
                      <span>Automated Candidate Evaluation Dossier</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Multi-dimensional rubric scoring technical depth, problem-solving, and hire recommendation.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                      Generated in &lt; 60s
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Screen hundreds of applicants in minutes instead of weeks of manual calendar calls.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <MessageCircle size={14} className="text-emerald-400 shrink-0" />
                      <span>Native WhatsApp Candidate Workflows</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      WhatsApp Business API integration for automatic test links, reminders, and notifications.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      82%+ Response Rate
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      4x higher candidate completion rate compared to traditional cold email reminders.
                    </td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Share2 size={14} className="text-blue-400 shrink-0" />
                      <span>1-Click Interactive Client Review Links</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A79B]">
                      Zero-login branded dossier links with audio answer playback and 1-click client decisioning.
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      Instant Client Sync
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      Staffing agencies win more client placements by presenting interactive proof over raw CVs.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Client Demo & Walkthrough Action Bar */}
          <div className="rounded-2xl bg-gradient-to-r from-white/[0.05] via-white/[0.02] to-white/[0.05] border border-white/10 p-6 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-[#D4F82C]/15 border border-[#D4F82C]/30 text-[#D4F82C] flex items-center justify-center shrink-0">
                <Sparkles size={22} className="text-[#D4F82C]" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Experience Autonomous Screening For Your Team</h4>
                <p className="text-xs text-[#A1A79B]">
                  Take the live candidate test drive in 2 minutes, or schedule a tailored enterprise walkthrough with our team.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-2 cursor-pointer shadow-sm group"
              >
                <Play size={12} className="fill-current text-[#D4F82C] group-hover:scale-110 transition-transform" />
                <span>Watch 30s Video Demo</span>
              </button>
              <Link
                to="/interview/demo"
                className="px-5 py-2.5 rounded-full bg-[#D4F82C] hover:bg-[#c2e424] text-[#111215] text-xs font-black transition-all shadow-sm flex items-center gap-1.5"
              >
                <Play size={12} className="fill-current" />
                <span>Experience AI Interview Live</span>
              </Link>
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 cursor-pointer"
              >
                Book Client Walkthrough
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ── SECTION: COMPETITOR CAPABILITIES & PRICING COMPARISON ── */}
      <section id="comparison" className="smooth-scroll-section relative z-58 min-h-[auto] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-20 py-14 sm:py-24 border-b border-[#E4E7DC] overflow-x-clip">
        <OrganicSectionCurve index={8} />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 w-full relative z-10">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[#111215] text-[10px] font-mono font-bold uppercase tracking-wider mb-3 shadow-2xs">
              <SlidersHorizontal size={12} className="text-[#8FB305]" />
              <span>MARKET BENCHMARK & REAL INR COST TRANSPARENCY</span>
            </div>
            <h2 className="text-2xl sm:text-5xl font-black text-[#111215] tracking-tight leading-tight">
              How InterviewXpert Compares to Legacy Platforms
            </h2>
            <p className="mt-3 text-xs sm:text-base text-[#575A51] leading-relaxed">
              Why high-velocity engineering startups, mid-market enterprises, and boutique recruitment agencies are replacing ₹20+ Lakh/year rigid legacy contracts with InterviewXpert's custom-tailored autonomous conversational architecture.
            </p>
          </div>

          {/* Comparison Table Container */}
          <div className="rounded-3xl border border-[#E4E7DC] bg-white shadow-md overflow-hidden mb-10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                <thead>
                  <tr className="border-b border-[#E4E7DC] bg-[#FAFAF8]">
                    <th className="py-4 px-4 sm:px-5 font-bold text-[#111215] w-[24%] text-xs uppercase font-mono tracking-wider">
                      Enterprise Capabilities & Pricing (INR)
                    </th>
                    {/* InterviewXpert Column Highlight */}
                    <th className="py-4 px-4 sm:px-5 font-black text-[#111215] bg-[#D4F82C]/15 border-x border-[#D4F82C]/30 w-[24%]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="size-2 rounded-full bg-[#8FB305] animate-pulse"></span>
                        <span className="text-sm font-black text-[#111215]">InterviewXpert</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#575A51] uppercase">
                        Autonomous AI Recruiter
                      </span>
                    </th>
                    <th className="py-4 px-4 font-bold text-[#111215] w-[13%]">
                      <div className="text-xs font-black">Mercer Mettl / BarRaiser</div>
                      <span className="text-[10px] font-mono text-[#73766C]">Legacy Indian ATS</span>
                    </th>
                    <th className="py-4 px-4 font-bold text-[#111215] w-[13%]">
                      <div className="text-xs font-black">HireVue</div>
                      <span className="text-[10px] font-mono text-[#73766C]">1-Way Video Soft</span>
                    </th>
                    <th className="py-4 px-4 font-bold text-[#111215] w-[13%]">
                      <div className="text-xs font-black">HackerRank</div>
                      <span className="text-[10px] font-mono text-[#73766C]">Code Tests Only</span>
                    </th>
                    <th className="py-4 px-4 font-bold text-[#111215] w-[13%]">
                      <div className="text-xs font-black">In-House Manual HR</div>
                      <span className="text-[10px] font-mono text-[#73766C]">Phone/Video Screens</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E4E7DC] text-[#111215]">
                  
                  {/* Row 1: Autonomous Spoken AI */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Mic size={14} className="text-[#8FB305] shrink-0" />
                        <span>Autonomous 2-Way Spoken Voice AI</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Yes • Sub-300ms Conversational Voice Q&A</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Static test banks or manual panels)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (1-Way recorded video to camera)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Code/text testing only, zero voice)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Yes, but manual (45m+ recruiter screen)</span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 2: Custom Design According to Company Need */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors bg-[#FAFBF7]">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Sliders size={14} className="text-[#8FB305] shrink-0" />
                        <span>Custom Design According to Company Need</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/10 border-x border-[#D4F82C]/30 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                        <span>100% Tailored • Custom AI Personas, JD Rubrics & PDF Syllabus Grounding</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Partial (Generic question banks; custom rubrics require costly PS)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>Low (Rigid standard templates)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>Low (Standard LeetCode algorithmic test banks)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Unstructured (Ad-hoc recruiter questions without standardization)</span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 3: Connect with Companies' Legacy Platforms */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors bg-[#FAFBF7]">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[#8FB305] shrink-0" />
                        <span>Connect with Companies' Legacy Platforms</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/10 border-x border-[#D4F82C]/30 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                        <span>Universal Legacy Connect • Workday, SAP, Greenhouse, Darwinbox & Zoho Sync</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Complex (Heavy IT integration & ₹50k–₹1.5L setup fees)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Enterprise Only (Locked behind top-tier contracts)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Limited (Export API on high enterprise tiers)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>Manual (Recruiter manually types notes into ATS spreadsheet)</span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 4: Dynamic Cross-Questioning */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Brain size={14} className="text-[#8FB305] shrink-0" />
                        <span>Dynamic Contextual Cross-Questioning</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Yes • Probes candidate logic, architecture & edge cases</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Scripted static prompts)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Static one-way prompt cards)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Rigid unit test cases only)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Yes (Subjective human probing)</span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 5: Multi-Round Unified Evaluation */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Kanban size={14} className="text-[#8FB305] shrink-0" />
                        <span>Multi-Round Unified Evaluation (Voice + MCQ + Coding)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>All-in-One Suite • Voice Interview + MCQ + Monaco IDE in 1 link</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Fragmented (Separate modules & multiple links)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>Video Only (Requires 3rd-party tool for coding)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Code & MCQ Only (Zero spoken voice evaluation)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Fragmented (3 separate rounds across 2–3 weeks)</span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 6: Anti-Cheat & Proctoring */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-[#8FB305] shrink-0" />
                        <span>Multi-Signal Anti-Cheat & Tab-Switch Audit Logs</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Yes • Full screen lock, tab-switch audit logs & face detection</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span className="text-emerald-700">Available (Charges extra for live proctoring)</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span className="text-amber-700">Basic (Manual post-video review)</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span className="text-amber-700">Basic (Window blur & code similarity)</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span className="text-amber-700">Manual (Recruiter eyeball observation)</span>
                    </td>
                  </tr>

                  {/* Row 7: Native WhatsApp Integration */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <MessageCircle size={14} className="text-[#8FB305] shrink-0" />
                        <span>Native WhatsApp Candidate Workflows</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Yes • Automated WhatsApp invites & 2-hr reminder sequences</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Email only • High drop-off)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Formal email notifications only)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Email only)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>Manual (Recruiter texts from personal phone)</span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 8: 1-Click Interactive Client Review Link */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Share2 size={14} className="text-[#8FB305] shrink-0" />
                        <span>1-Click Interactive Client Review Dossier</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-[#111215]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Yes • Audio answer clips, live transcripts & 1-click approvals</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span className="text-amber-700">Static PDF report (No audio snippets)</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle size={14} className="shrink-0" />
                        <span>No (Requires enterprise platform login)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span className="text-amber-700">Test score page only</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span className="text-rose-600">Messy email chains with subjective notes</span>
                    </td>
                  </tr>

                  {/* Row 9: Evaluation Turnaround */}
                  <tr className="hover:bg-[#F8F9F5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-bold text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-[#8FB305] shrink-0" />
                        <span>Evaluation Turnaround Time</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-[#111215]">
                      <span className="px-2 py-0.5 rounded bg-[#D4F82C] text-[#111215] font-black text-[11px]">
                        ⚡ Under 60 Seconds
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span>24 to 48 Hours for interview reviews</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span>2 to 5 Days (Recruiters must watch videos)</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span>Instant code score (Requires human follow-up)</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#73766C]">
                      <span>3 to 7 Days across panel calendars</span>
                    </td>
                  </tr>

                  {/* Row 10: Real Unit Pricing in INR */}
                  <tr className="bg-[#FAFBF7]">
                    <td className="py-4 px-4 sm:px-5 font-black text-[#111215]">
                      <div className="flex items-center gap-2">
                        <IndianRupee size={14} className="text-[#8FB305] shrink-0" />
                        <span>Actual Unit Pricing (All in INR ₹)</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5 bg-[#D4F82C]/10 border-x border-[#D4F82C]/30 font-black text-[#111215]">
                      <div className="text-xs font-black text-[#111215]">
                        From ₹129 / Candidate
                      </div>
                      <div className="text-[10px] text-[#575A51] font-medium mt-0.5 leading-snug">
                        Dynamic volume: ₹149 down to ₹129 INR. Modular add-ons: MCQ (+₹29/₹19), Coding (+₹49/₹39). Pay strictly per completed assessment.
                      </div>
                    </td>
                    <td className="py-4 px-4 text-rose-700 font-bold">
                      <div className="text-xs">₹650 – ₹1,500+ / Candidate</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">₹2.5L – ₹8.0L+ annual base + setup</div>
                    </td>
                    <td className="py-4 px-4 text-rose-700 font-bold">
                      <div className="text-xs">₹3,500 – ₹7,000+ / Interview</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">Converted from $25k–$45k USD annual plan</div>
                    </td>
                    <td className="py-4 px-4 text-rose-700 font-bold">
                      <div className="text-xs">₹450 – ₹800+ / Code Test</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">High overages above strict quota caps</div>
                    </td>
                    <td className="py-4 px-4 text-rose-700 font-bold">
                      <div className="text-xs">₹650 – ₹850+ / Interview</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">In recruiter hours (~₹650/hr x 1.25 hrs)</div>
                    </td>
                  </tr>

                  {/* Row 11: Annual Contract Commitment & Lock-in */}
                  <tr className="bg-[#FAFBF7]">
                    <td className="py-4 px-4 sm:px-5 font-black text-[#111215]">
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-[#8FB305] shrink-0" />
                        <span>Contract Terms & Annual Lock-in</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5 bg-[#D4F82C]/10 border-x border-[#D4F82C]/30 font-black text-[#111215]">
                      <div className="text-xs font-black text-emerald-800">
                        Zero Annual Lock-In • 1-Month Free Trial
                      </div>
                      <div className="text-[10px] text-[#575A51] font-medium mt-0.5">
                        Pay as you go. Evaluation credits never expire.
                      </div>
                    </td>
                    <td className="py-4 px-4 text-rose-700 font-bold">
                      <div className="text-xs">₹2,50,000 – ₹8,00,000+ / Year</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">Rigid 1-year enterprise contract</div>
                    </td>
                    <td className="py-4 px-4 text-rose-700 font-bold">
                      <div className="text-xs">₹20,50,000 – ₹37,50,000+ / Year</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">Strict 1-year or 3-year enterprise lock-in</div>
                    </td>
                    <td className="py-4 px-4 text-rose-700 font-bold">
                      <div className="text-xs">₹3,00,000 – ₹8,30,000+ / Year</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">Annual subscription with user seat caps</div>
                    </td>
                    <td className="py-4 px-4 text-[#73766C] font-bold">
                      <div className="text-xs">Fixed Monthly Salaries</div>
                      <div className="text-[10px] text-[#73766C] font-normal mt-0.5">High fixed overhead regardless of hiring volume</div>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Value Comparison Banner */}
          <div className="rounded-3xl bg-[#111215] text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5 text-center sm:text-left">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#D4F82C]">
                100% Custom Tailored • Legacy ATS Connectivity • Actual INR Transparency
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Why Pay ₹20,00,000+ For Rigid Legacy Tools That Still Require Manual Reviews?
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                InterviewXpert is custom-designed for your company's exact competencies, seamlessly integrates with your existing legacy ATS (Workday, SAP, Greenhouse, Darwinbox, Zoho Recruit), and delivers completed candidate dossiers in 60 seconds — with dynamic rates scaling from ₹149 down to ₹129 per interview in INR.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <a
                href="#pricing"
                onClick={(e) => scrollToSection(e, 'pricing')}
                className="w-full sm:w-auto px-5 py-3 rounded-full bg-[#D4F82C] hover:bg-[#c2e424] text-[#111215] text-xs font-black transition-all shadow-md text-center cursor-pointer"
              >
                Calculate Team Pricing Below ↓
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ── SECTION 6: PRICING ESTIMATOR CARD ── */}
      <section id="pricing" className="smooth-scroll-section relative z-60 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-24 transition-all duration-300 overflow-x-clip pt-16 sm:pt-24 pb-12 sm:pb-20">
        <OrganicSectionCurve index={9} />
        <div className="flex-1 flex flex-col justify-center py-6 sm:py-8 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full relative z-10">
          
          {/* Pricing Header */}
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/90 border border-[#E4E7DC] shadow-2xs text-[10px] font-mono font-bold text-[#111215] mb-2">
              <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span>06 • TRANSPARENT PRICING</span>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] mb-1">
              Flexible Plans & Pay-Per-Interview
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-[#111215] tracking-tight">
              Simple, transparent pricing. Zero hidden fees.
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#575A51]">
              Choose between on-demand AI Video Interviews or full-featured recruitment platform subscriptions.
            </p>

            {/* Pricing Model Tab Switcher */}
            <div className="inline-flex p-1.5 rounded-2xl bg-white border border-[#E4E7DC] shadow-sm mt-5">
              <button
                type="button"
                onClick={() => setPricingTab('ai-interviews')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  pricingTab === 'ai-interviews'
                    ? 'bg-[#111215] text-[#D4F82C] shadow-sm'
                    : 'text-[#73766C] hover:text-[#111215]'
                }`}
              >
                <Video size={14} className={pricingTab === 'ai-interviews' ? 'text-[#D4F82C]' : 'text-neutral-400'} />
                <span>AI Interview & Assessment</span>
                <span className="px-1.5 py-0.2 rounded bg-[#D4F82C] text-[#111215] text-[9px] font-black uppercase">From ₹129</span>
              </button>

              <button
                type="button"
                onClick={() => setPricingTab('subscription')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  pricingTab === 'subscription'
                    ? 'bg-[#111215] text-white shadow-sm'
                    : 'text-[#73766C] hover:text-[#111215]'
                }`}
              >
                <Users size={14} className={pricingTab === 'subscription' ? 'text-white' : 'text-neutral-400'} />
                <span>Recruiter Platform Seats</span>
              </button>
            </div>
          </div>

          {/* TAB 1: AI VIDEO INTERVIEWS (DYNAMIC ₹149 TO ₹129 / INTERVIEW + MODULAR ROUNDS) */}
          {pricingTab === 'ai-interviews' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
              
              {/* Left: AI Interview Volume Calculator */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-7 space-y-6 shadow-sm">
                
                {/* Header with Title & Rate Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#E4E7DC]">
                  <div>
                    <h3 className="text-lg font-black text-[#111215] tracking-tight">Estimate Your Evaluation Rounds & Candidate Volume</h3>
                    <p className="text-xs text-[#73766C] mt-0.5">Dynamic volume rates: ₹149 down to ₹129 for AI Video, plus modular add-ons for MCQ & Coding rounds.</p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {aiInterviewCalc.baseRatePerInterview > aiInterviewCalc.ratePerInterview && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Save ₹{aiInterviewCalc.baseRatePerInterview - aiInterviewCalc.ratePerInterview} / candidate</span>
                      </span>
                    )}
                    <div className="px-3.5 py-1.5 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-black shadow-xs flex items-baseline gap-1">
                      <span>₹{aiInterviewCalc.ratePerInterview}</span>
                      <span className="text-[10px] font-medium text-neutral-300">/ candidate</span>
                    </div>
                  </div>
                </div>

                {/* Step 1: Select Assessment Rounds (Modular Checkmarks) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#73766C] uppercase tracking-wider">
                      1. Select Evaluation Rounds
                    </span>
                    <span className="text-[10px] text-[#8FB305] font-black bg-[#D4F82C]/20 px-2 py-0.5 rounded-full">
                      Mix & Match Any Rounds
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Round 1: AI Video Interview (Base: ₹149 down to ₹129) */}
                    <div
                      onClick={() => {
                        // Keep at least one round active
                        if (includeVoiceRound && !includeMcqRound && !includeCodingRound) {
                          return;
                        }
                        setIncludeVoiceRound(!includeVoiceRound);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        includeVoiceRound
                          ? 'border-[#111215] bg-[#FAFBF7] ring-1 ring-black/10 shadow-xs'
                          : 'border-[#E4E7DC] bg-white opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`p-1.5 rounded-lg ${includeVoiceRound ? 'bg-[#111215] text-[#D4F82C]' : 'bg-neutral-100 text-neutral-400'}`}>
                              <Video size={14} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#575A51]">Core</span>
                          </div>
                          <div
                            className={`size-5 rounded-md flex items-center justify-center transition-colors ${
                              includeVoiceRound ? 'bg-[#111215] text-[#D4F82C]' : 'border-2 border-[#C8CCC0] bg-white'
                            }`}
                          >
                            {includeVoiceRound && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                        <h4 className="text-xs font-black text-[#111215]">AI Video Interview</h4>
                        <p className="text-[10px] text-[#73766C] mt-0.5 leading-snug">
                          Autonomous spoken voice Q&A, real-time proctoring & scorecard
                        </p>
                      </div>
                      <div className="pt-2 mt-2 border-t border-[#E4E7DC] flex items-baseline justify-between">
                        <span className="text-[10px] text-[#73766C]">Per candidate:</span>
                        <span className="text-xs font-black text-[#111215]">
                          ₹{aiInterviewCalc.voiceRate}
                          <span className="text-[9px] font-normal text-[#73766C]"> / int</span>
                        </span>
                      </div>
                    </div>

                    {/* Round 2: MCQ Aptitude Round (+₹29 down to +₹19) */}
                    <div
                      onClick={() => {
                        if (!includeVoiceRound && includeMcqRound && !includeCodingRound) {
                          return;
                        }
                        setIncludeMcqRound(!includeMcqRound);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        includeMcqRound
                          ? 'border-[#111215] bg-[#FAFBF7] ring-1 ring-black/10 shadow-xs'
                          : 'border-[#E4E7DC] bg-white opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`p-1.5 rounded-lg ${includeMcqRound ? 'bg-[#111215] text-[#D4F82C]' : 'bg-neutral-100 text-neutral-400'}`}>
                              <Brain size={14} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#575A51]">Add-on</span>
                          </div>
                          <div
                            className={`size-5 rounded-md flex items-center justify-center transition-colors ${
                              includeMcqRound ? 'bg-[#111215] text-[#D4F82C]' : 'border-2 border-[#C8CCC0] bg-white'
                            }`}
                          >
                            {includeMcqRound && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                        <h4 className="text-xs font-black text-[#111215]">MCQ & Aptitude Round</h4>
                        <p className="text-[10px] text-[#73766C] mt-0.5 leading-snug">
                          Adaptive cognitive & domain quiz banks, anti-cheat & instant grading
                        </p>
                      </div>
                      <div className="pt-2 mt-2 border-t border-[#E4E7DC] flex items-baseline justify-between">
                        <span className="text-[10px] text-[#73766C]">Add-on rate:</span>
                        <span className="text-xs font-black text-[#111215]">
                          +₹{aiInterviewCalc.mcqRate}
                          <span className="text-[9px] font-normal text-[#73766C]"> / cand</span>
                        </span>
                      </div>
                    </div>

                    {/* Round 3: Live Cloud Coding IDE (+₹49 down to +₹39) */}
                    <div
                      onClick={() => {
                        if (!includeVoiceRound && !includeMcqRound && includeCodingRound) {
                          return;
                        }
                        setIncludeCodingRound(!includeCodingRound);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        includeCodingRound
                          ? 'border-[#111215] bg-[#FAFBF7] ring-1 ring-black/10 shadow-xs'
                          : 'border-[#E4E7DC] bg-white opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`p-1.5 rounded-lg ${includeCodingRound ? 'bg-[#111215] text-[#D4F82C]' : 'bg-neutral-100 text-neutral-400'}`}>
                              <Code2 size={14} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#575A51]">Add-on</span>
                          </div>
                          <div
                            className={`size-5 rounded-md flex items-center justify-center transition-colors ${
                              includeCodingRound ? 'bg-[#111215] text-[#D4F82C]' : 'border-2 border-[#C8CCC0] bg-white'
                            }`}
                          >
                            {includeCodingRound && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                        <h4 className="text-xs font-black text-[#111215]">Cloud Coding Round</h4>
                        <p className="text-[10px] text-[#73766C] mt-0.5 leading-snug">
                          Live Monaco IDE, 40+ language runtimes & automated unit test suites
                        </p>
                      </div>
                      <div className="pt-2 mt-2 border-t border-[#E4E7DC] flex items-baseline justify-between">
                        <span className="text-[10px] text-[#73766C]">Add-on rate:</span>
                        <span className="text-xs font-black text-[#111215]">
                          +₹{aiInterviewCalc.codingRate}
                          <span className="text-[9px] font-normal text-[#73766C]"> / cand</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Interview Volume Slider & Custom Number Stepper */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#111215]">2. Planned Candidate Volume</span>
                    
                    {/* Stepper / Input Control */}
                    <div className="flex items-center gap-1.5 bg-[#F8F9F5] p-1 rounded-xl border border-[#E4E7DC] shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setCalcAiInterviews(Math.max(10, calcAiInterviews - 10))}
                        className="size-7 rounded-lg bg-white border border-[#E4E7DC] hover:border-black/30 text-[#111215] font-black flex items-center justify-center transition-colors cursor-pointer text-sm"
                        title="Decrease by 10 candidates"
                      >
                        –
                      </button>
                      <div className="flex items-center px-1">
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          value={calcAiInterviews}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setCalcAiInterviews(isNaN(val) ? 1 : Math.max(1, Math.min(5000, val)));
                          }}
                          className="w-14 bg-transparent text-center font-mono text-xs font-bold text-[#111215] outline-none"
                        />
                        <span className="text-[11px] font-semibold text-[#73766C]">candidates</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCalcAiInterviews(Math.min(5000, calcAiInterviews + 10))}
                        className="size-7 rounded-lg bg-white border border-[#E4E7DC] hover:border-black/30 text-[#111215] font-black flex items-center justify-center transition-colors cursor-pointer text-sm"
                        title="Increase by 10 candidates"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Filled Dynamic Range Slider */}
                  <div className="relative pt-2 pb-1">
                    <input
                      type="range"
                      min={10}
                      max={1000}
                      step={10}
                      value={Math.min(1000, calcAiInterviews)}
                      onChange={(e) => setCalcAiInterviews(parseInt(e.target.value))}
                      style={{
                        background: `linear-gradient(to right, #111215 ${Math.min(100, Math.max(0, ((calcAiInterviews - 10) / (1000 - 10)) * 100))}%, #E4E7DC ${Math.min(100, Math.max(0, ((calcAiInterviews - 10) / (1000 - 10)) * 100))}%)`
                      }}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#111215]"
                    />
                  </div>

                  {/* Interactive Milestone Ticks */}
                  <div className="grid grid-cols-5 text-center gap-1 pt-0.5">
                    {[
                      { count: 10, rate: `₹${aiInterviewCalc.getRateForCount(10)}` },
                      { count: 50, rate: `₹${aiInterviewCalc.getRateForCount(50)}` },
                      { count: 200, rate: `₹${aiInterviewCalc.getRateForCount(200)}` },
                      { count: 500, rate: `₹${aiInterviewCalc.getRateForCount(500)}` },
                      { count: 1000, rate: `₹${aiInterviewCalc.getRateForCount(1000)}` },
                    ].map(tick => {
                      const isActive = calcAiInterviews === tick.count;
                      return (
                        <button
                          key={tick.count}
                          type="button"
                          onClick={() => setCalcAiInterviews(tick.count)}
                          className={`py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#111215] text-[#D4F82C] font-black shadow-xs'
                              : 'text-[#73766C] hover:text-[#111215] hover:bg-slate-100'
                          }`}
                        >
                          <span className="block font-bold">{tick.count >= 1000 ? '1,000+' : tick.count}</span>
                          <span className="text-[9px] opacity-80">({tick.rate})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Preset Packs */}
                <div>
                  <span className="text-[11px] font-bold text-[#73766C] uppercase tracking-wider block mb-2.5">3. Popular Volume Packs</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      {
                        count: 10,
                        label: 'Starter Pack',
                        rate: `₹${aiInterviewCalc.getRateForCount(10)} / cand`,
                        price: `₹${(10 * aiInterviewCalc.getRateForCount(10)).toLocaleString('en-IN')} INR`,
                        badge: 'Base Tier',
                      },
                      {
                        count: 50,
                        label: 'Growth Pack',
                        rate: `₹${aiInterviewCalc.getRateForCount(50)} / cand`,
                        price: `₹${(50 * aiInterviewCalc.getRateForCount(50)).toLocaleString('en-IN')} INR`,
                        badge: `Save ₹${(50 * (aiInterviewCalc.baseRatePerInterview - aiInterviewCalc.getRateForCount(50))).toLocaleString('en-IN')}`,
                      },
                      {
                        count: 200,
                        label: 'Scale Pack',
                        rate: `₹${aiInterviewCalc.getRateForCount(200)} / cand`,
                        price: `₹${(200 * aiInterviewCalc.getRateForCount(200)).toLocaleString('en-IN')} INR`,
                        badge: `Save ₹${(200 * (aiInterviewCalc.baseRatePerInterview - aiInterviewCalc.getRateForCount(200))).toLocaleString('en-IN')}`,
                      },
                      {
                        count: 1000,
                        label: 'Enterprise',
                        rate: `₹${aiInterviewCalc.getRateForCount(1000)} / cand`,
                        price: `₹${(1000 * aiInterviewCalc.getRateForCount(1000)).toLocaleString('en-IN')} INR`,
                        badge: `Save ₹${(1000 * (aiInterviewCalc.baseRatePerInterview - aiInterviewCalc.getRateForCount(1000))).toLocaleString('en-IN')}`,
                      },
                    ].map(pack => {
                      const isSelected = calcAiInterviews === pack.count;
                      return (
                        <button
                          key={pack.count}
                          type="button"
                          onClick={() => setCalcAiInterviews(pack.count)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#111215] bg-[#111215] text-white shadow-md ring-1 ring-black'
                              : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] hover:bg-white hover:border-black/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[11px] font-bold tracking-tight">{pack.label}</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                              isSelected ? 'bg-[#D4F82C] text-[#111215]' : 'bg-[#E4E7DC] text-[#575A51]'
                            }`}>
                              {pack.badge}
                            </span>
                          </div>
                          <p className={`text-sm font-black ${isSelected ? 'text-[#D4F82C]' : 'text-neutral-900'}`}>{pack.price}</p>
                          <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-neutral-300' : 'text-[#73766C]'}`}>
                            {pack.count >= 1000 ? '1,000' : pack.count} candidates • {pack.rate}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Direct ROI Comparison */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#73766C]">Manual Recruiter Screening (~₹750 / interview):</span>
                    <span className="line-through text-rose-600 font-bold">₹{aiInterviewCalc.manualScreeningCost.toLocaleString('en-IN')} INR</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#73766C]">InterviewXpert Autonomous AI Evaluation:</span>
                    <span className="text-[#111215] font-black text-sm">₹{aiInterviewCalc.totalCost.toLocaleString('en-IN')} INR</span>
                  </div>
                  <div className="pt-2.5 border-t border-[#E4E7DC] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-800 font-black">
                      <Zap size={14} className="fill-emerald-600 text-emerald-600" />
                      <span>Net Savings ({aiInterviewCalc.savingsPercent}%):</span>
                    </span>
                    <span className="text-emerald-800 font-black">
                      Save ₹{aiInterviewCalc.savingsAmount.toLocaleString('en-IN')} INR & {aiInterviewCalc.recruiterHoursSaved} Recruiter Hours!
                    </span>
                  </div>
                </div>

              </div>

              {/* Right: AI Interview Plan Details Card */}
              <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-gradient-to-b from-[#181B22] to-[#0E1015] text-white p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
                {/* Subtle Ambient Accent Glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#D4F82C]/10 rounded-full blur-2xl pointer-events-none -mr-16 -mt-16" />

                <div className="flex items-center justify-between pb-3.5 border-b border-white/10 relative z-10">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#D4F82C] font-black">Dynamic Pay-Per-Candidate</span>
                    <h3 className="text-xl font-black text-white tracking-tight">AI Evaluation Suite</h3>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-[#D4F82C] text-[#111215] text-xs font-black shadow-xs">
                    ₹{aiInterviewCalc.ratePerInterview} INR / candidate
                  </div>
                </div>

                {/* Selected Rounds Active Badges */}
                <div className="relative z-10 flex flex-wrap gap-1.5">
                  {aiInterviewCalc.activeVoice && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-white">
                      <Video size={12} className="text-[#D4F82C]" />
                      <span>AI Video (₹{aiInterviewCalc.voiceRate})</span>
                    </span>
                  )}
                  {aiInterviewCalc.activeMcq && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-white">
                      <Brain size={12} className="text-[#D4F82C]" />
                      <span>MCQ Aptitude (+₹{aiInterviewCalc.mcqRate})</span>
                    </span>
                  )}
                  {aiInterviewCalc.activeCoding && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-white">
                      <Code2 size={12} className="text-[#D4F82C]" />
                      <span>Cloud IDE (+₹{aiInterviewCalc.codingRate})</span>
                    </span>
                  )}
                </div>

                <div className="relative z-10 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      ₹{aiInterviewCalc.totalCost.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-neutral-400 font-normal">for {aiInterviewCalc.count} candidates</span>
                  </div>
                  <div className="text-xs text-[#D4F82C] font-semibold flex items-center gap-1.5 pt-0.5">
                    <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse" />
                    <span>Pay strictly per completed assessment • Credits never expire</span>
                  </div>
                  {aiInterviewCalc.volumeDiscount > 0 ? (
                    <div className="text-[11px] text-emerald-400 font-semibold pt-1">
                      Volume discount unlocked: Saved ₹{aiInterviewCalc.volumeDiscount.toLocaleString('en-IN')} vs base tier!
                    </div>
                  ) : (
                    <div className="text-[11px] text-neutral-400 font-normal pt-1">
                      Base rate applied (₹{aiInterviewCalc.baseRatePerInterview} / candidate). Scale up to 1,000+ candidates for maximum discount!
                    </div>
                  )}
                  {calcAiInterviews >= 1000 && (
                    <div className="text-[11px] text-[#D4F82C] font-bold">
                      ★ Max Volume Tier Active (₹{aiInterviewCalc.ratePerInterview} / candidate)
                    </div>
                  )}
                </div>

                {/* What's Included */}
                <div className="space-y-2.5 text-xs text-neutral-300 pt-3.5 border-t border-white/10 relative z-10">
                  {[
                    aiInterviewCalc.activeVoice ? 'Autonomous spoken conversational video interview with dynamic cross-questioning' : null,
                    aiInterviewCalc.activeVoice ? 'Real-time searchable word-for-word live transcripts & 1080p cloud recordings' : null,
                    aiInterviewCalc.activeMcq ? 'Curated MCQ aptitude test bank with negative marking & domain breakdown' : null,
                    aiInterviewCalc.activeCoding ? 'Monaco Cloud IDE with 40+ language runtimes & automated unit tests' : null,
                    'Personalised candidate evaluation reports & executive scorecards',
                    'Multi-signal anti-cheat proctoring & tab-switch audit logs',
                    'Automated candidate invites via WhatsApp & email with reminder triggers',
                    'Instant 1-click shareable client dossier link (zero login required)',
                  ].filter(Boolean).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-[#D4F82C] shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3.5 border-t border-white/10 space-y-2.5 relative z-10">
                  <button
                    type="button"
                    onClick={() => setBookingModalOpen(true)}
                    className="w-full py-3.5 rounded-full bg-[#D4F82C] hover:bg-[#bde023] text-[#111215] text-xs font-black transition-all cursor-pointer shadow-md shadow-[#D4F82C]/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span>Get Started • Buy Evaluation Credits</span>
                    <ArrowRight size={14} />
                  </button>

                  <Link
                    to="/interview/demo"
                    className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all text-center block"
                  >
                    Try Live Interactive Demo First
                  </Link>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: RECRUITER TEAM PLATFORM SUBSCRIPTIONS */}
          {pricingTab === 'subscription' && (
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
          )}

        </div>

      </section>

      {/* ── SECTION 7: FAQ ACCORDION CARD ("A little more clarity.") ── */}
      <section id="faq" className="smooth-scroll-section relative z-70 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#F8F9F5] scroll-mt-18 transition-all duration-300 overflow-x-clip py-10 sm:py-16">
        <OrganicSectionCurve index={10} />
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
                Everything you need to know about InterviewXpert, setup time, and pricing.
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
      <section id="start-trial" className="smooth-scroll-section relative z-80 min-h-[auto] sm:min-h-[calc(100vh-4.5rem)] flex flex-col justify-center bg-[#111215] text-white scroll-mt-18 transition-all duration-300 overflow-x-clip py-12 sm:py-16">
        <OrganicSectionCurve index={11} isDark={true} />
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
                  <a href="https://wa.me/919511779317?text=Hi%20InterviewXpert%20team,%20I%20would%20like%20to%20know%20more%20about%20the%20platform%20and%20request%20a%20demo." target="_blank" rel="noopener noreferrer" className="hover:text-[#111215] transition-colors flex items-center gap-1.5 text-emerald-700 font-bold">
                    <MessageCircle size={12} />
                    <span>WhatsApp Business (+91 95117 79317)</span>
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

          {/* Giant Typographic Wordmark with hover glow (responsive clamped to fit without truncation) */}
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
                  loading="lazy"
                  decoding="async"
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
                      <span>InterviewXpert AI Match Reasoning</span>
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
              <span className="text-xs text-[#73766C]">InterviewXpert ATS Live Candidate Preview</span>
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
                  <input type="hidden" name="_subject" value="New 1-Month Free Demo Inquiry - InterviewXpert" />

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

      {/* ── Best-in-Class Cinematic Demo Video Modal ── */}
      {videoModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setVideoModalOpen(false);
          }}
          className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="InterviewXpert Platform Demo Video"
        >
          {/* Ambient Lime Glow Aura */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[650px] h-[350px] bg-[#D4F82C]/15 rounded-full blur-[140px] pointer-events-none" />

          <div
            className="relative w-full max-w-4xl bg-[#0D0E12] rounded-2xl sm:rounded-3xl border border-[#D4F82C]/40 shadow-[0_0_80px_rgba(212,248,44,0.18),0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Control Bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 bg-[#14151B] border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex size-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F82C] opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-[#D4F82C]"></span>
                </span>
                <span className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
                  InterviewXpert <span className="text-[#D4F82C]">Platform Demo</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-neutral-300">
                  4K • 60 FPS
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(false)}
                  className="size-8 sm:size-8.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close Video (Esc)"
                  aria-label="Close modal"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Video Iframe Container (16:9 ratio with YouTube embed) */}
            <div className="relative w-full aspect-video bg-black overflow-hidden">
              <iframe
                src="https://www.youtube.com/embed/oEm2TFwcBas?autoplay=1&rel=0&modestbranding=1&playsinline=1"
                title="InterviewXpert Autonomous AI Recruiter Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            {/* Modal Bottom Interactive Action Strip */}
            <div className="p-4 sm:p-5 bg-[#14151B] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-center sm:text-left">
                <p className="font-bold text-white text-xs sm:text-sm">
                  Ready to automate your engineering screening?
                </p>
                <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                  Full access included: AI Question Gen, Voice Interviewer, Anti-Cheat & Candidate Dossiers.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setVideoModalOpen(false);
                    setBookingModalOpen(true);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold transition-all border border-white/15 text-xs text-center cursor-pointer"
                >
                  Schedule 1-on-1 Demo
                </button>
                <Link
                  to="/auth"
                  onClick={() => setVideoModalOpen(false)}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-[#D4F82C] hover:bg-[#c2e424] text-[#111215] font-black transition-all shadow-md text-xs text-center flex items-center justify-center gap-1.5"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
