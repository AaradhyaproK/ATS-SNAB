import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  CheckCircle2,
  Briefcase,
  Building2,
  Sparkles,
  ShieldCheck,
  User,
  ExternalLink,
  FileText,
  RotateCw,
  MessageCircle,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Check,
  Award,
  X,
  Search,
  SlidersHorizontal,
  Download,
  Copy,
  Share2,
  Printer,
  Columns,
  Grid,
  List,
  Eye,
  Clock,
  ArrowUpRight,
  ChevronDown,
  UserCheck,
  Flame,
  Info,
} from 'lucide-react';
import Logo from '../components/Logo';
import DayNightToggle from '../components/DayNightToggle';

interface ShortlistedCandidate {
  id: string;
  applicationDocId?: string;
  candidateId?: string;
  candidateName: string;
  maskedName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  matchScore: number;
  matchGrade: string;
  skills: string[];
  experience: string;
  noticePeriod: string;
  location: string;
  currentSalary?: string;
  expectedSalary?: string;
  summary: string;
  resumeUrl?: string;
  clientDecision?: string;
  clientFeedback?: string;
  decidedAt?: any;
  interviewDetails?: any;
}

interface ClientShortlistData {
  id: string;
  shareId: string;
  clientName: string;
  jobTitle: string;
  jobId: string;
  agencyName: string;
  recruiterUID: string;
  recruiterName: string;
  recruiterPhone?: string;
  recruiterEmail?: string;
  clientContactPerson?: string;
  executiveNote?: string;
  maskingLevel?: string;
  expiresAt?: string;
  createdAt?: any;
  candidates: ShortlistedCandidate[];
}

export default function ClientReviewPortal() {
  const { shareId } = useParams<{ shareId: string }>();

  const [loading, setLoading] = useState(true);
  const [shortlist, setShortlist] = useState<ClientShortlistData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState<'all' | '90' | '80' | '75'>('all');
  const [sortBy, setSortBy] = useState<'score-desc' | 'exp-desc' | 'name-asc'>('score-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Resume Viewer Modal State
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState<ShortlistedCandidate | null>(null);

  // Compare Matrix Modal State
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!shareId) {
      setError('Shortlist review link is invalid or missing.');
      setLoading(false);
      return;
    }

    let unsubscribeSnapshot: (() => void) | null = null;

    const setupRealtimeShortlist = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Try finding by shareId
        let q = query(collection(db, 'clientShortlists'), where('shareId', '==', shareId));
        let snap = await getDocs(q);

        // 2. If not found, try finding by jobId
        if (snap.empty) {
          q = query(collection(db, 'clientShortlists'), where('jobId', '==', shareId));
          snap = await getDocs(q);
        }

        // 3. If still not found, check if shareId is a job accessCode
        if (snap.empty) {
          const qJob = query(collection(db, 'jobs'), where('accessCode', '==', shareId));
          const snapJob = await getDocs(qJob);
          if (!snapJob.empty) {
            const matchedJobId = snapJob.docs[0].id;
            q = query(collection(db, 'clientShortlists'), where('jobId', '==', matchedJobId));
            snap = await getDocs(q);
          }
        }

        if (snap.empty) {
          setError('This candidate shortlist review link does not exist or has expired.');
          setLoading(false);
          return;
        }

        const targetDocId = snap.docs[0].id;

        // 4. Attach REALTIME onSnapshot listener so if recruiter changes status or removes a candidate,
        // it updates on the client portal in real time without refreshing!
        unsubscribeSnapshot = onSnapshot(
          doc(db, 'clientShortlists', targetDocId),
          async (docSnapshot) => {
            if (!docSnapshot.exists()) {
              setError('This candidate shortlist review link is no longer available.');
              setLoading(false);
              return;
            }

            const data = docSnapshot.data() as any;

            // Check expiration if set
            if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
              setError('This candidate shortlist review link has expired. Please contact your recruitment partner for an updated link.');
              setLoading(false);
              return;
            }

            const rawCandidates: ShortlistedCandidate[] = Array.isArray(data.candidates) ? data.candidates : [];

            // Enrich candidates dynamically with Cloudinary resumes and skills if missing
            const enrichedCandidates = await Promise.all(
              rawCandidates.map(async (cand) => {
                let resumeUrl = cand.resumeUrl || '';
                let skills = cand.skills && cand.skills.length > 0 ? cand.skills : [];

                if ((!resumeUrl || skills.length === 0) && cand.candidateEmail) {
                  try {
                    const cleanEmail = cand.candidateEmail.toLowerCase().trim();
                    const qDump = query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail));
                    const dumpSnap = await getDocs(qDump).catch(() => null);

                    if (dumpSnap && !dumpSnap.empty) {
                      const dumpData = dumpSnap.docs[0].data();
                      if (!resumeUrl) {
                        resumeUrl = dumpData.resumeUrl || dumpData.profile?.resumeUrl || dumpData.fileUrl || '';
                      }
                      if (skills.length === 0) {
                        skills = dumpData.skills || dumpData.profile?.skills || [];
                      }
                    }
                  } catch (e) {
                    console.warn('Fallback resume lookup error:', e);
                  }
                }

                return {
                  ...cand,
                  resumeUrl,
                  skills,
                };
              })
            );

            setShortlist({
              id: docSnapshot.id,
              ...data,
              candidates: enrichedCandidates,
            });
            setLoading(false);
          },
          (err) => {
            console.error('Realtime shortlist listener error:', err);
            setError('Failed to load candidate shortlist in real-time. Please check your connection.');
            setLoading(false);
          }
        );
      } catch (err: any) {
        console.error('Error finding shortlist:', err);
        setError('Failed to load candidate shortlist. Please check your internet connection.');
        setLoading(false);
      }
    };

    setupRealtimeShortlist();

    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [shareId]);

  // Copy Portal Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('🔗 Shortlist link copied to clipboard!');
  };

  // Filtered & Sorted Candidates
  const filteredCandidates = useMemo(() => {
    if (!shortlist) return [];
    let list = [...shortlist.candidates];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => {
        const nameMatch = (c.candidateName || c.maskedName || '').toLowerCase().includes(q);
        const skillMatch = (c.skills || []).some((s) => s.toLowerCase().includes(q));
        const locMatch = (c.location || '').toLowerCase().includes(q);
        const expMatch = (c.experience || '').toLowerCase().includes(q);
        return nameMatch || skillMatch || locMatch || expMatch;
      });
    }

    // Min Score Filter
    if (minScoreFilter !== 'all') {
      const minScore = Number(minScoreFilter);
      list = list.filter((c) => (c.matchScore || 0) >= minScore);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'score-desc') {
        return (b.matchScore || 0) - (a.matchScore || 0);
      }
      if (sortBy === 'exp-desc') {
        const getNum = (str: string) => {
          const match = (str || '').match(/\d+(\.\d+)?/);
          return match ? parseFloat(match[0]) : 0;
        };
        return getNum(b.experience) - getNum(a.experience);
      }
      if (sortBy === 'name-asc') {
        return (a.candidateName || a.maskedName || '').localeCompare(b.candidateName || b.maskedName || '');
      }
      return 0;
    });

    return list;
  }, [shortlist, searchQuery, minScoreFilter, sortBy]);

  // Metrics calculations
  const totalCount = shortlist?.candidates?.length || 0;
  const avgMatchScore = totalCount > 0
    ? Math.round(shortlist!.candidates.reduce((acc, c) => acc + (c.matchScore || 0), 0) / totalCount)
    : 0;
  const topTierCount = shortlist?.candidates?.filter((c) => (c.matchScore || 0) >= 85).length || 0;

  // Render Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070709] flex flex-col items-center justify-center p-4">
        <div className="size-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
          <RotateCw className="size-8 animate-spin" />
        </div>
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
          Loading Candidate Shortlist...
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Fetching AI match evaluations and Cloudinary verified profiles
        </p>
      </div>
    );
  }

  // Render Error State
  if (error || !shortlist) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070709] flex flex-col items-center justify-center p-6 text-center">
        <div className="size-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Shortlist Review Link Unavailable
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          {error || 'This candidate shortlist could not be loaded.'}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-black hover:opacity-90"
          >
            Go to hireX Home
          </Link>
          <a
            href="mailto:hello@snab.co.in"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  // WhatsApp discussion URL helper
  const getWhatsAppDiscussionLink = (candidate?: ShortlistedCandidate) => {
    const phone = (shortlist.recruiterPhone || '').replace(/[^0-9]/g, '');
    if (!phone) return null;

    let text = `Hi ${shortlist.recruiterName || 'Team'},\n\nI am reviewing the shortlisted candidates for *${shortlist.jobTitle}* on the hireX Client Review Portal for *${shortlist.clientName}*.`;
    if (candidate) {
      text += `\n\nI would like to discuss candidate *${candidate.candidateName || candidate.maskedName}* (Match Score: ${candidate.matchScore}% - ${candidate.matchGrade}).`;
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#08080a] text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold shadow-2xl shadow-black/30">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ── Top Header with hireX Logo & Co-Branding ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/[0.08] bg-white/85 dark:bg-[#0c0c0e]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Brand Left: hireX Logo + Agency badge */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0" title="hireX Talent Platform">
              <Logo className="h-8 sm:h-9 w-auto object-contain" />
            </Link>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block shrink-0" />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {shortlist.clientName}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <ShieldCheck size={11} />
                  <span>Verified Shortlist</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Curated by <span className="font-semibold text-slate-700 dark:text-slate-300">{shortlist.agencyName || 'Recruitment Partner'}</span>
              </p>
            </div>
          </div>

          {/* Controls Right */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Compare Button */}
            {totalCount > 1 && (
              <button
                type="button"
                onClick={() => setIsCompareOpen(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Compare all candidates side-by-side"
              >
                <Columns size={14} className="text-emerald-500" />
                <span>Compare Matrix</span>
              </button>
            )}

            {/* Share Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Copy review link"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* WhatsApp Recruiter Quick Connect */}
            {shortlist.recruiterPhone && (
              <a
                href={getWhatsAppDiscussionLink() || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <MessageCircle size={14} />
                <span className="hidden sm:inline">Discuss with Recruiter</span>
              </a>
            )}

            {/* Theme Toggle */}
            <div className="scale-85 sm:scale-90 origin-right">
              <DayNightToggle />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Body ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ── Hero Role Overview Card ── */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white via-emerald-50/25 to-white dark:from-[#0e0e13] dark:via-[#0c0c10] dark:to-[#0e0e13] border border-slate-200 dark:border-white/[0.08] shadow-sm">
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  <Briefcase size={12} />
                  <span>Job Role Shortlist</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                  <Building2 size={11} />
                  <span>{shortlist.clientName}</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {shortlist.jobTitle}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {shortlist.executiveNote ||
                  `Below are the vetted, AI-evaluated candidate profiles submitted by ${shortlist.agencyName} for your team's review. Review candidate match scores, skills breakdowns, and Cloudinary-stored original resumes.`}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={14} className="text-emerald-500" />
                  <span>Recruiter Lead: <strong>{shortlist.recruiterName || 'Lead Consultant'}</strong></span>
                </span>
                {shortlist.recruiterEmail && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" />
                    <span>{shortlist.recruiterEmail}</span>
                  </span>
                )}
                {shortlist.expiresAt && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-500" />
                    <span>Valid until: {new Date(shortlist.expiresAt).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Summary Badges */}
            <div className="grid grid-cols-3 gap-3 bg-white/80 dark:bg-black/40 p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] shrink-0 backdrop-blur-xs">
              <div className="text-center px-3 py-1">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                  {totalCount}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Candidates
                </div>
              </div>
              <div className="text-center px-3 py-1 border-x border-slate-100 dark:border-white/[0.08]">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {avgMatchScore}%
                </div>
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-0.5">
                  Avg Match
                </div>
              </div>
              <div className="text-center px-3 py-1">
                <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
                  {topTierCount}
                </div>
                <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mt-0.5">
                  Top Tier (85%+)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Interactive Controls & Search Bar ── */}
        <div className="bg-white dark:bg-[#0c0c0e] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, skills, experience, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-xs font-medium outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Score Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl text-xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase px-2">Score:</span>
              <button
                type="button"
                onClick={() => setMinScoreFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  minScoreFilter === 'all'
                    ? 'bg-white dark:bg-[#1a1a20] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMinScoreFilter('90')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  minScoreFilter === '90'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                90%+
              </button>
              <button
                type="button"
                onClick={() => setMinScoreFilter('80')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  minScoreFilter === '80'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                80%+
              </button>
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-xs font-medium outline-none focus:border-emerald-500"
            >
              <option value="score-desc">Sort: Highest Match Score</option>
              <option value="exp-desc">Sort: Most Experience</option>
              <option value="name-asc">Sort: Name (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-[#1a1a20] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Grid Cards View"
              >
                <Grid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#1a1a20] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Matrix Table View"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Candidate List / Grid ── */}
        {filteredCandidates.length === 0 ? (
          <div className="bg-white dark:bg-[#0c0c0e] rounded-3xl border border-slate-200 dark:border-white/[0.08] p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 mx-auto flex items-center justify-center">
              <Search size={20} />
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              No candidates match your current filter
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search keywords or resetting your minimum match score filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setMinScoreFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── GRID CARD VIEW ── */
          <div className="grid grid-cols-1 gap-5">
            {filteredCandidates.map((candidate, idx) => {
              const score = candidate.matchScore || 85;
              const isHighMatch = score >= 85;

              return (
                <div
                  key={candidate.id || idx}
                  className="rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0c0c0e] hover:border-slate-300 dark:hover:border-white/20 transition-all p-6 sm:p-7 shadow-xs hover:shadow-md"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    {/* Left & Middle Column: Candidate Info */}
                    <div className="flex-1 space-y-4">
                      {/* Name & Score Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 text-slate-700 dark:text-slate-200 flex items-center justify-center font-extrabold text-sm border border-slate-200 dark:border-white/10">
                            {idx + 1}
                          </div>
                          <div>
                            <h2 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white">
                              {candidate.candidateName || candidate.maskedName}
                            </h2>
                            <p className="text-xs text-slate-400">
                              {candidate.location || 'Location Confidential'} • Verified Candidate
                            </p>
                          </div>
                        </div>

                        {/* Match Score Radial Display */}
                        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-white/[0.03] px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-white/10">
                          <div className="relative size-11 flex items-center justify-center">
                            <svg className="size-11 -rotate-90">
                              <circle
                                cx="22"
                                cy="22"
                                r="18"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="none"
                                className="text-slate-200 dark:text-white/10"
                              />
                              <circle
                                cx="22"
                                cy="22"
                                r="18"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="none"
                                strokeDasharray={113}
                                strokeDashoffset={113 - (113 * score) / 100}
                                strokeLinecap="round"
                                className={isHighMatch ? 'text-emerald-500' : 'text-purple-500'}
                              />
                            </svg>
                            <span className="absolute font-black text-xs font-mono">
                              {score}%
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 font-black text-xs text-slate-900 dark:text-white">
                              <Sparkles size={11} className={isHighMatch ? 'text-emerald-500' : 'text-purple-500'} />
                              <span>{candidate.matchGrade || 'Great Fit'}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              AI Fit Evaluation
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Key Attributes Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                            Experience
                          </span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                            {candidate.experience || '3+ Years'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                            Notice Period
                          </span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                            {candidate.noticePeriod || '15–30 Days'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                            Location
                          </span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block truncate">
                            {candidate.location || 'Bangalore'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                            Expected CTC
                          </span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                            {candidate.expectedSalary || 'As per norms'}
                          </span>
                        </div>
                      </div>

                      {/* Executive Career Summary */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Executive Profile Summary
                        </span>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {candidate.summary}
                        </p>
                      </div>

                      {/* Verified Skills */}
                      {candidate.skills && candidate.skills.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Demonstrated Core Skills ({candidate.skills.length})
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {candidate.skills.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-[11px] font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/[0.07]"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Cloudinary Resume & Action Center */}
                    <div className="lg:w-64 flex flex-col gap-2.5 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-white/[0.06] lg:pl-6 justify-center">
                      <div className="text-center p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] mb-1">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mb-0.5">
                          <Sparkles size={13} />
                          <span>Candidate #{idx + 1}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {candidate.resumeUrl ? 'Cloudinary Verified Resume Ready' : 'Profile Document Available'}
                        </p>
                      </div>

                      {/* 1-Click Primary View Cloudinary Resume */}
                      <button
                        type="button"
                        onClick={() => setPreviewResumeCandidate(candidate)}
                        className="w-full h-11 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.01] cursor-pointer"
                      >
                        <FileText size={15} />
                        <span>View Cloudinary Resume</span>
                      </button>

                      {/* Direct Open in New Tab if Resume URL exists */}
                      {candidate.resumeUrl && (
                        <a
                          href={candidate.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={13} />
                          <span>Open Document Link</span>
                        </a>
                      )}

                      {/* WhatsApp Inquiry for this candidate */}
                      {shortlist.recruiterPhone && (
                        <a
                          href={getWhatsAppDiscussionLink(candidate) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-9 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <MessageCircle size={13} className="text-emerald-600" />
                          <span>Discuss Candidate</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── COMPACT MATRIX / TABLE VIEW ── */
          <div className="bg-white dark:bg-[#0c0c0e] rounded-3xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-white/[0.06]">
                  <tr>
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">Candidate</th>
                    <th className="py-3.5 px-4">Match Score</th>
                    <th className="py-3.5 px-4">Experience</th>
                    <th className="py-3.5 px-4">Notice Period</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Core Skills</th>
                    <th className="py-3.5 px-4 text-right">Cloudinary Resume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {filteredCandidates.map((candidate, idx) => (
                    <tr key={candidate.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-4 px-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                        {candidate.candidateName || candidate.maskedName}
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <Sparkles size={11} />
                          <span>{candidate.matchScore}%</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {candidate.experience || '3+'}
                      </td>
                      <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {candidate.noticePeriod || 'Immediate'}
                      </td>
                      <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {candidate.location || 'Bangalore'}
                      </td>
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(candidate.skills || []).slice(0, 4).map((s, sIdx) => (
                            <span key={sIdx} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-[10px]">
                              {s}
                            </span>
                          ))}
                          {(candidate.skills || []).length > 4 && (
                            <span className="text-[10px] text-slate-400">+{candidate.skills.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewResumeCandidate(candidate)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FileText size={12} />
                          <span>View Resume</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 mt-12 border-t border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Logo className="h-6 w-auto object-contain" />
          <span>• Executive Candidate Review Portal</span>
        </div>
        <p>
          Curated by <strong>{shortlist.agencyName}</strong> for <strong>{shortlist.clientName}</strong>
        </p>
      </footer>

      {/* ── CLOUDINARY RESUME VIEWER MODAL ── */}
      {previewResumeCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-4xl h-[92vh] rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d0d11] text-slate-900 dark:text-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between gap-4 shrink-0 bg-slate-50/70 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                      {previewResumeCandidate.candidateName || previewResumeCandidate.maskedName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <Sparkles size={11} />
                      <span>{previewResumeCandidate.matchScore}% Match</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {shortlist.jobTitle} • {previewResumeCandidate.experience} Experience • Cloudinary Verified Document
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {previewResumeCandidate.resumeUrl && (
                  <a
                    href={previewResumeCandidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                    title="Open document in original tab"
                  >
                    <ExternalLink size={13} />
                    <span className="hidden sm:inline">Open Tab</span>
                  </a>
                )}
                {shortlist.recruiterPhone && (
                  <a
                    href={getWhatsAppDiscussionLink(previewResumeCandidate) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                  >
                    <MessageCircle size={13} />
                    <span className="hidden sm:inline">Discuss</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewResumeCandidate(null)}
                  className="size-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body - Cloudinary Document Preview */}
            <div className="flex-1 bg-slate-100 dark:bg-black/50 overflow-hidden relative">
              {previewResumeCandidate.resumeUrl ? (
                <iframe
                  src={
                    previewResumeCandidate.resumeUrl.endsWith('.docx')
                      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewResumeCandidate.resumeUrl)}`
                      : previewResumeCandidate.resumeUrl
                  }
                  title="Candidate Cloudinary Resume"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="size-16 rounded-3xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base">Executive Profile Overview</h4>
                    <p className="text-xs text-slate-400 max-w-md mt-1">
                      Direct Cloudinary document link is pending sync. Review verified career profile details below:
                    </p>
                  </div>
                  <div className="max-w-xl text-left bg-white dark:bg-[#111115] p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Career Summary</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                        {previewResumeCandidate.summary}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 block uppercase text-[10px] mb-1">Demonstrated Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {previewResumeCandidate.skills.map((s, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 font-semibold text-[11px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between text-xs text-slate-400 shrink-0 bg-white dark:bg-[#0d0d11]">
              <span>Candidate Match: {previewResumeCandidate.matchScore}% ({previewResumeCandidate.matchGrade})</span>
              <button
                type="button"
                onClick={() => setPreviewResumeCandidate(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 font-bold text-slate-700 dark:text-slate-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDE-BY-SIDE CANDIDATE COMPARISON MATRIX MODAL ── */}
      {isCompareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-6xl max-h-[90vh] rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Columns size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Candidate Comparison Matrix</h3>
                  <p className="text-xs text-slate-400">
                    Comparing all {totalCount} candidates for {shortlist.jobTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="size-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
              <div className="grid grid-flow-col auto-cols-[300px] gap-4">
                {shortlist.candidates.map((cand, idx) => (
                  <div
                    key={cand.id || idx}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] space-y-4"
                  >
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">Candidate #{idx + 1}</span>
                      <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                        {cand.candidateName || cand.maskedName}
                      </h4>
                      <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        <Sparkles size={11} />
                        <span>{cand.matchScore}% Match • {cand.matchGrade}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs border-t border-slate-200 dark:border-white/10 pt-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Experience</span>
                        <p className="font-bold">{cand.experience}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Notice Period</span>
                        <p className="font-bold">{cand.noticePeriod}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
                        <p className="font-bold">{cand.location}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Expected CTC</span>
                        <p className="font-bold">{cand.expectedSalary}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-200 dark:border-white/10 pt-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Top Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {(cand.skills || []).slice(0, 6).map((s, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 rounded-md bg-white dark:bg-white/5 text-[10px] border border-slate-200 dark:border-white/10">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCompareOpen(false);
                          setPreviewResumeCandidate(cand);
                        }}
                        className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileText size={13} />
                        <span>View Cloudinary Resume</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-white/[0.08] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 font-bold text-xs"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
