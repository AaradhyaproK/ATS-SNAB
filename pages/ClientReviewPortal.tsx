import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
  updateDoc,
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
  Columns,
  Grid,
  List,
  Clock,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  MessageSquare,
  Shield,
  Lock,
  Globe,
  FileCheck2,
  BadgeCheck,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import HireXLogo, { HireXMark } from '../components/HireXLogo';

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
  clientDecision?: 'interested' | 'hold' | 'reject' | 'pending' | string;
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
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'interested' | 'hold' | 'reject' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'score-desc' | 'exp-desc' | 'name-asc'>('score-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Resume Viewer Modal State
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState<ShortlistedCandidate | null>(null);

  // Compare Matrix Modal State
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Feedback Note Modal State
  const [feedbackCandidate, setFeedbackCandidate] = useState<ShortlistedCandidate | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  // Toast Notification
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

        // 4. Attach REALTIME onSnapshot listener so if recruiter or client changes status, it updates in real time
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

            // Enrich candidates dynamically with resumes and skills if missing
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
    showToast('🔗 Shortlist review link copied to clipboard!');
  };

  // Handle Client Review Decision
  const handleDecisionChange = async (candidate: ShortlistedCandidate, decision: 'interested' | 'hold' | 'reject') => {
    if (!shortlist) return;
    const targetCandKey = candidate.id || candidate.candidateId || candidate.candidateName;

    try {
      const updatedCandidates = shortlist.candidates.map((c) => {
        const cKey = c.id || c.candidateId || c.candidateName;
        if (cKey === targetCandKey) {
          const newDecision = c.clientDecision === decision ? 'pending' : decision;
          return {
            ...c,
            clientDecision: newDecision,
            decidedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      await updateDoc(doc(db, 'clientShortlists', shortlist.id), {
        candidates: updatedCandidates,
        lastClientActivityAt: new Date().toISOString(),
      });

      setShortlist({
        ...shortlist,
        candidates: updatedCandidates,
      });

      const decisionLabels: Record<string, string> = {
        interested: 'Marked as Interested • Interview requested!',
        hold: 'Moved candidate to On Hold',
        reject: 'Marked candidate as Declined',
        pending: 'Decision reset to Pending',
      };
      const activeDecision = updatedCandidates.find(c => (c.id || c.candidateId || c.candidateName) === targetCandKey)?.clientDecision || 'pending';
      showToast(decisionLabels[activeDecision] || 'Decision updated successfully');
    } catch (err) {
      console.error('Error saving client decision:', err);
      showToast('Could not save decision. Please try again.');
    }
  };

  // Handle Save Client Feedback Note
  const handleSaveFeedback = async () => {
    if (!shortlist || !feedbackCandidate) return;
    setSavingFeedback(true);
    const targetCandKey = feedbackCandidate.id || feedbackCandidate.candidateId || feedbackCandidate.candidateName;

    try {
      const updatedCandidates = shortlist.candidates.map((c) => {
        const cKey = c.id || c.candidateId || c.candidateName;
        if (cKey === targetCandKey) {
          return {
            ...c,
            clientFeedback: feedbackInput.trim(),
            feedbackUpdatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      await updateDoc(doc(db, 'clientShortlists', shortlist.id), {
        candidates: updatedCandidates,
        lastClientActivityAt: new Date().toISOString(),
      });

      setShortlist({
        ...shortlist,
        candidates: updatedCandidates,
      });

      showToast('Feedback note saved for your recruitment partner!');
      setFeedbackCandidate(null);
      setFeedbackInput('');
    } catch (err) {
      console.error('Error saving feedback:', err);
      showToast('Could not save feedback note. Please try again.');
    } finally {
      setSavingFeedback(false);
    }
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

    // Decision Filter
    if (decisionFilter !== 'all') {
      list = list.filter((c) => {
        const d = c.clientDecision || 'pending';
        return d === decisionFilter;
      });
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
  }, [shortlist, searchQuery, minScoreFilter, decisionFilter, sortBy]);

  // Metrics calculations
  const totalCount = shortlist?.candidates?.length || 0;
  const avgMatchScore = totalCount > 0
    ? Math.round(shortlist!.candidates.reduce((acc, c) => acc + (c.matchScore || 0), 0) / totalCount)
    : 0;
  const topTierCount = shortlist?.candidates?.filter((c) => (c.matchScore || 0) >= 85).length || 0;
  const interestedCount = shortlist?.candidates?.filter((c) => c.clientDecision === 'interested').length || 0;
  const holdCount = shortlist?.candidates?.filter((c) => c.clientDecision === 'hold').length || 0;

  // WhatsApp discussion URL helper
  const getWhatsAppDiscussionLink = (candidate?: ShortlistedCandidate) => {
    if (!shortlist) return null;
    const phone = (shortlist.recruiterPhone || '').replace(/[^0-9]/g, '');
    if (!phone) return null;

    let text = `Hi ${shortlist.recruiterName || 'Team'},\n\nI am reviewing the candidate shortlist for *${shortlist.jobTitle}* on the hireX Client Review Portal for *${shortlist.clientName}*.`;
    if (candidate) {
      text += `\n\nI would like to discuss candidate *${candidate.candidateName || candidate.maskedName}* (Match Score: ${candidate.matchScore}% - ${candidate.matchGrade}).`;
      if (candidate.clientDecision) {
        text += `\nCurrent Status: *${candidate.clientDecision.toUpperCase()}*`;
      }
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // Render Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] flex flex-col items-center justify-center p-4 text-[#111215] dark:text-[#F8F9F5]">
        <div className="w-16 h-16 rounded-3xl bg-[#D4F82C] text-[#111215] flex items-center justify-center mb-4 shadow-sm">
          <RotateCw className="w-8 h-8 animate-spin text-[#111215]" />
        </div>
        <h3 className="font-bold text-lg text-[#111215] dark:text-[#F8F9F5]">
          Loading Candidate Shortlist...
        </h3>
        <p className="text-xs text-[#575A51] dark:text-neutral-400 mt-1">
          Fetching AI match evaluations and Cloudinary verified candidate profiles
        </p>
      </div>
    );
  }

  // Render Error State
  if (error || !shortlist) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] flex flex-col items-center justify-center p-6 text-center text-[#111215] dark:text-[#F8F9F5]">
        <div className="w-16 h-16 rounded-3xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 border border-red-200 dark:border-red-900/50">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#111215] dark:text-[#F8F9F5]">
          Shortlist Review Link Unavailable
        </h2>
        <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 max-w-md mt-2 leading-relaxed">
          {error || 'This candidate shortlist could not be loaded.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] transition-all"
          >
            Go to hireX Home
          </Link>
          <a
            href="mailto:hello@snab.co.in"
            className="px-5 py-2.5 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#575A51] dark:text-neutral-300 hover:bg-[#F8F9F5] dark:hover:bg-white/10 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215] flex flex-col justify-between transition-colors duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold shadow-2xl shadow-black/25 border border-black/10">
            <CheckCircle2 size={16} className="text-[#8FB305] dark:text-[#111215]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ── Top Header with hireX Logo & Co-Branding (Clean Navbar - No Dot) ── */}
      <header className="sticky top-0 z-40 border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5]/90 dark:bg-[#0D0E11]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Brand Left: hireX Logo + Client badge (NO DOT) */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0 group" title="hireX Talent Platform">
              <HireXLogo className="h-8 sm:h-9 w-auto" isDark={isDark} />
            </Link>

            <div className="h-5 w-px bg-[#E4E7DC] dark:bg-white/10 hidden sm:block shrink-0" />

            {/* Client Badge without any dot */}
            <div className="min-w-0 flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs font-bold text-[#111215] dark:text-[#F8F9F5] shadow-xs">
                <Building2 size={13} className="text-[#8FB305] shrink-0" />
                <span className="truncate max-w-[130px] sm:max-w-[200px]">{shortlist.clientName}</span>
                <span className="text-[#73766C] dark:text-neutral-400 font-normal hidden md:inline">• Client Portal</span>
              </div>

              <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4F82C]/20 text-[#111215] dark:text-[#D4F82C] border border-[#8FB305]/30">
                <ShieldCheck size={11} className="text-[#8FB305]" />
                <span>Verified Shortlist</span>
              </span>
            </div>
          </div>

          {/* Controls Right */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Compare Matrix Button */}
            {totalCount > 1 && (
              <button
                type="button"
                onClick={() => setIsCompareOpen(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#111215] dark:hover:border-white/30 text-[#111215] dark:text-[#F8F9F5] transition-all shadow-xs cursor-pointer"
                title="Compare all candidates side-by-side"
              >
                <Columns size={14} className="text-[#8FB305]" />
                <span>Compare Matrix</span>
              </button>
            )}

            {/* Share Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#111215] dark:hover:border-white/30 text-[#111215] dark:text-[#F8F9F5] transition-all shadow-xs cursor-pointer"
              title="Copy review link"
            >
              <Share2 size={13} />
              <span className="hidden sm:inline">Share Link</span>
            </button>

            {/* WhatsApp Recruiter Quick Connect */}
            {shortlist.recruiterPhone && (
              <a
                href={getWhatsAppDiscussionLink() || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111215] text-[#D4F82C] hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c7eb22] text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <MessageCircle size={14} />
                <span className="hidden sm:inline">Discuss with Recruiter</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Body ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6 flex-1 w-full">
        {/* ── Hero Role Overview Bento Card ── */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 shadow-xs">
          {/* Subtle decorative glow curve */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-[#D4F82C]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30">
                  <Briefcase size={12} className="text-[#8FB305]" />
                  <span>Job Role Shortlist</span>
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC] dark:border-white/10">
                  <Building2 size={12} />
                  <span>{shortlist.clientName}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC] dark:border-white/10">
                  <span>Job ID #{shortlist.jobId?.slice(-6) || 'TALENT'}</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-[#111215] dark:text-[#F8F9F5] tracking-tight leading-tight">
                {shortlist.jobTitle}
              </h1>

              <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-300 leading-relaxed">
                {shortlist.executiveNote ||
                  `Below are the vetted, AI-evaluated candidate profiles submitted by ${shortlist.agencyName} for your team's review. Review candidate match scores, skills breakdowns, and verified resumes.`}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#575A51] dark:text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={14} className="text-[#8FB305]" />
                  <span>Recruiter Lead: <strong className="text-[#111215] dark:text-[#F8F9F5]">{shortlist.recruiterName || 'Lead Consultant'}</strong></span>
                </span>
                {shortlist.recruiterEmail && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-[#73766C]" />
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

            {/* Quick Summary Bento Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-[#F8F9F5] dark:bg-[#101114] p-4 sm:p-5 rounded-3xl border border-[#E4E7DC] dark:border-white/10 shrink-0">
              <div className="text-center px-3 py-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#111215] dark:text-[#F8F9F5] font-mono">
                  {totalCount}
                </div>
                <div className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider mt-0.5">
                  Candidates
                </div>
              </div>
              <div className="text-center px-3 py-1 border-x border-[#E4E7DC] dark:border-white/10">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#111215] dark:text-[#D4F82C] font-mono">
                  {avgMatchScore}%
                </div>
                <div className="text-[10px] font-bold text-[#8FB305] dark:text-[#D4F82C] uppercase tracking-wider mt-0.5">
                  Avg Match
                </div>
              </div>
              <div className="text-center px-3 py-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#111215] dark:text-[#F8F9F5] font-mono">
                  {topTierCount}
                </div>
                <div className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider mt-0.5">
                  Top Fit (85%+)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Interactive Controls, Filters & Search Toolbar ── */}
        <div className="bg-white dark:bg-[#15161A] rounded-3xl border border-[#E4E7DC] dark:border-white/10 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#73766C] dark:text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, core skills, experience, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-11 pr-9 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs font-medium text-[#111215] dark:text-[#F8F9F5] outline-none focus:border-[#111215] dark:focus:border-white/30 transition-all placeholder:text-[#73766C]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73766C] hover:text-[#111215] dark:hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills & Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Score Filter */}
            <div className="flex items-center gap-1 bg-[#F8F9F5] dark:bg-[#101114] p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 text-xs">
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase px-2.5">Score:</span>
              <button
                type="button"
                onClick={() => setMinScoreFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  minScoreFilter === 'all'
                    ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                    : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMinScoreFilter('90')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  minScoreFilter === '90'
                    ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                    : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                }`}
              >
                90%+
              </button>
              <button
                type="button"
                onClick={() => setMinScoreFilter('80')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  minScoreFilter === '80'
                    ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                    : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                }`}
              >
                80%+
              </button>
            </div>

            {/* Decision Filter */}
            <div className="hidden lg:flex items-center gap-1 bg-[#F8F9F5] dark:bg-[#101114] p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setDecisionFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  decisionFilter === 'all'
                    ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#575A51] dark:text-neutral-400'
                }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setDecisionFilter('interested')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  decisionFilter === 'interested'
                    ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#575A51] dark:text-neutral-400'
                }`}
              >
                Interested ({interestedCount})
              </button>
              <button
                type="button"
                onClick={() => setDecisionFilter('hold')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  decisionFilter === 'hold'
                    ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#575A51] dark:text-neutral-400'
                }`}
              >
                Hold ({holdCount})
              </button>
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="h-10 px-4 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs font-bold text-[#111215] dark:text-[#F8F9F5] outline-none focus:border-[#111215] dark:focus:border-white/30 cursor-pointer"
            >
              <option value="score-desc">Sort: Highest Match Score</option>
              <option value="exp-desc">Sort: Most Experience</option>
              <option value="name-asc">Sort: Candidate Name (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#F8F9F5] dark:bg-[#101114] p-1 rounded-full border border-[#E4E7DC] dark:border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-full transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-xs'
                    : 'text-[#73766C] hover:text-[#111215] dark:hover:text-white'
                }`}
                title="Grid Cards View"
              >
                <Grid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-full transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-xs'
                    : 'text-[#73766C] hover:text-[#111215] dark:hover:text-white'
                }`}
                title="Compact Table Matrix View"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Candidate List / Grid ── */}
        {filteredCandidates.length === 0 ? (
          <div className="bg-white dark:bg-[#15161A] rounded-3xl border border-[#E4E7DC] dark:border-white/10 p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#F8F9F5] dark:bg-white/5 text-[#73766C] mx-auto flex items-center justify-center">
              <Search size={22} />
            </div>
            <h3 className="font-extrabold text-lg text-[#111215] dark:text-[#F8F9F5]">
              No candidates match your current filter
            </h3>
            <p className="text-xs text-[#575A51] dark:text-neutral-400 max-w-sm mx-auto">
              Try adjusting your search keywords or resetting your minimum match score filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setMinScoreFilter('all');
                setDecisionFilter('all');
              }}
              className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── BENTO GRID CARD VIEW ── */
          <div className="grid grid-cols-1 gap-6">
            {filteredCandidates.map((candidate, idx) => {
              const score = candidate.matchScore || 85;
              const isHighMatch = score >= 85;
              const decision = candidate.clientDecision || 'pending';

              return (
                <div
                  key={candidate.id || idx}
                  className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] hover:border-[#111215] dark:hover:border-white/30 transition-all p-6 sm:p-8 shadow-xs"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    {/* Left & Middle Column: Candidate Info */}
                    <div className="flex-1 space-y-4">
                      {/* Name & Score Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white flex items-center justify-center font-bold text-sm">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="font-extrabold text-lg sm:text-xl text-[#111215] dark:text-[#F8F9F5]">
                                {candidate.candidateName || candidate.maskedName}
                              </h2>
                              {decision === 'interested' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/40">
                                  <ThumbsUp size={10} />
                                  <span>Interview Requested</span>
                                </span>
                              )}
                              {decision === 'hold' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300">
                                  <Bookmark size={10} />
                                  <span>On Hold</span>
                                </span>
                              )}
                              {decision === 'reject' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300">
                                  <ThumbsDown size={10} />
                                  <span>Declined</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#575A51] dark:text-neutral-400 mt-0.5">
                              {candidate.location || 'Location Confidential'} • Verified Candidate Profile
                            </p>
                          </div>
                        </div>

                        {/* Match Score Radial Display */}
                        <div className="flex items-center gap-2.5 bg-[#F8F9F5] dark:bg-[#101114] px-4 py-2 rounded-2xl border border-[#E4E7DC] dark:border-white/10">
                          <div className="relative w-11 h-11 flex items-center justify-center">
                            <svg className="w-11 h-11 -rotate-90">
                              <circle
                                cx="22"
                                cy="22"
                                r="18"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="none"
                                className="text-[#E4E7DC] dark:text-white/10"
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
                                className={isHighMatch ? 'text-[#8FB305] dark:text-[#D4F82C]' : 'text-slate-700 dark:text-slate-300'}
                              />
                            </svg>
                            <span className="absolute font-extrabold text-xs font-mono text-[#111215] dark:text-[#F8F9F5]">
                              {score}%
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 font-bold text-xs text-[#111215] dark:text-[#F8F9F5]">
                              <Sparkles size={11} className="text-[#8FB305]" />
                              <span>{candidate.matchGrade || 'Great Fit'}</span>
                            </div>
                            <span className="text-[10px] text-[#73766C] dark:text-neutral-400 uppercase font-bold">
                              AI Fit Evaluation
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Key Attributes Bento Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24]/60 border border-[#E4E7DC] dark:border-white/10">
                          <span className="text-[10px] text-[#73766C] dark:text-neutral-400 block font-bold uppercase tracking-wider mb-0.5">
                            Experience
                          </span>
                          <span className="font-bold text-[#111215] dark:text-[#F8F9F5] text-sm block">
                            {candidate.experience || '3+ Years'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24]/60 border border-[#E4E7DC] dark:border-white/10">
                          <span className="text-[10px] text-[#73766C] dark:text-neutral-400 block font-bold uppercase tracking-wider mb-0.5">
                            Notice Period
                          </span>
                          <span className="font-bold text-[#111215] dark:text-[#F8F9F5] text-sm block">
                            {candidate.noticePeriod || '15–30 Days'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24]/60 border border-[#E4E7DC] dark:border-white/10">
                          <span className="text-[10px] text-[#73766C] dark:text-neutral-400 block font-bold uppercase tracking-wider mb-0.5">
                            Location
                          </span>
                          <span className="font-bold text-[#111215] dark:text-[#F8F9F5] text-sm block truncate">
                            {candidate.location || 'Bangalore'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24]/60 border border-[#E4E7DC] dark:border-white/10">
                          <span className="text-[10px] text-[#73766C] dark:text-neutral-400 block font-bold uppercase tracking-wider mb-0.5">
                            Expected CTC
                          </span>
                          <span className="font-bold text-[#111215] dark:text-[#F8F9F5] text-sm block">
                            {candidate.expectedSalary || 'Competitive'}
                          </span>
                        </div>
                      </div>

                      {/* Executive Career Summary */}
                      {candidate.summary && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">
                            Executive Profile Summary
                          </span>
                          <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-300 leading-relaxed bg-[#F8F9F5] dark:bg-[#101114] p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10">
                            {candidate.summary}
                          </p>
                        </div>
                      )}

                      {/* Verified Skills */}
                      {candidate.skills && candidate.skills.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">
                            Demonstrated Core Skills ({candidate.skills.length})
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {candidate.skills.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-3 py-1 rounded-full bg-white dark:bg-white/5 text-xs font-semibold text-[#111215] dark:text-[#F8F9F5] border border-[#E4E7DC] dark:border-white/10"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Existing Client Feedback Note (if left) */}
                      {candidate.clientFeedback && (
                        <div className="p-3 rounded-2xl bg-[#D4F82C]/10 dark:bg-[#D4F82C]/5 border border-[#8FB305]/30 text-xs">
                          <span className="font-bold text-[#111215] dark:text-[#D4F82C] block mb-0.5">
                            📝 Client Review Note:
                          </span>
                          <p className="text-[#575A51] dark:text-neutral-300 italic">
                            "{candidate.clientFeedback}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Actions & Client Decision Center */}
                    <div className="lg:w-72 flex flex-col gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#E4E7DC] dark:border-white/10 lg:pl-6 justify-center">
                      {/* Client Decision Quick Toggles */}
                      <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-[#101114] border border-[#E4E7DC] dark:border-white/10 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 tracking-wider block text-center">
                          Client Decision
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDecisionChange(candidate, 'interested')}
                            className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              decision === 'interested'
                                ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-sm font-extrabold'
                                : 'bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#8FB305]'
                            }`}
                            title="Request interview with this candidate"
                          >
                            <ThumbsUp size={13} />
                            <span>Select</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecisionChange(candidate, 'hold')}
                            className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              decision === 'hold'
                                ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                                : 'bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-amber-400'
                            }`}
                            title="Keep candidate on hold"
                          >
                            <Bookmark size={13} />
                            <span>Hold</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecisionChange(candidate, 'reject')}
                            className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              decision === 'reject'
                                ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                                : 'bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-rose-400'
                            }`}
                            title="Decline this candidate"
                          >
                            <ThumbsDown size={13} />
                            <span>Decline</span>
                          </button>
                        </div>

                        {/* Leave Note Dialog Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setFeedbackCandidate(candidate);
                            setFeedbackInput(candidate.clientFeedback || '');
                          }}
                          className="w-full py-1.5 rounded-xl border border-dashed border-[#E4E7DC] dark:border-white/10 text-[11px] font-semibold text-[#575A51] dark:text-neutral-300 hover:border-[#111215] dark:hover:border-white/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquare size={12} />
                          <span>{candidate.clientFeedback ? 'Edit Note' : 'Add Note for Recruiter'}</span>
                        </button>
                      </div>

                      {/* Primary View Cloudinary Resume */}
                      <button
                        type="button"
                        onClick={() => setPreviewResumeCandidate(candidate)}
                        className="w-full h-11 rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c7eb22] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                      >
                        <FileText size={15} />
                        <span>View Verified Resume</span>
                      </button>

                      {/* Direct Open in New Tab if Resume URL exists */}
                      {candidate.resumeUrl && (
                        <a
                          href={candidate.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-9 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#111215] dark:hover:border-white/30 text-[#111215] dark:text-[#F8F9F5] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={13} />
                          <span>Open Document</span>
                        </a>
                      )}

                      {/* WhatsApp Inquiry for this candidate */}
                      {shortlist.recruiterPhone && (
                        <a
                          href={getWhatsAppDiscussionLink(candidate) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-9 rounded-full border border-[#8FB305]/40 bg-[#D4F82C]/15 dark:bg-[#D4F82C]/10 hover:bg-[#D4F82C]/25 text-[#111215] dark:text-[#D4F82C] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <MessageCircle size={13} className="text-[#8FB305]" />
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
          <div className="bg-white dark:bg-[#15161A] rounded-3xl border border-[#E4E7DC] dark:border-white/10 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9F5] dark:bg-[#101114] text-[#73766C] dark:text-neutral-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#E4E7DC] dark:border-white/10">
                  <tr>
                    <th className="py-4 px-4">#</th>
                    <th className="py-4 px-4">Candidate</th>
                    <th className="py-4 px-4">Match Score</th>
                    <th className="py-4 px-4">Experience</th>
                    <th className="py-4 px-4">Notice Period</th>
                    <th className="py-4 px-4">Location</th>
                    <th className="py-4 px-4">Core Skills</th>
                    <th className="py-4 px-4">Decision</th>
                    <th className="py-4 px-4 text-right">Resume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7DC] dark:divide-white/10">
                  {filteredCandidates.map((candidate, idx) => {
                    const decision = candidate.clientDecision || 'pending';
                    return (
                      <tr key={candidate.id || idx} className="hover:bg-[#F8F9F5]/70 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-[#73766C]">{idx + 1}</td>
                        <td className="py-4 px-4 font-bold text-[#111215] dark:text-[#F8F9F5]">
                          <div>{candidate.candidateName || candidate.maskedName}</div>
                          {candidate.clientFeedback && (
                            <div className="text-[10px] text-[#8FB305] italic truncate max-w-xs">
                              "{candidate.clientFeedback}"
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30">
                            <Sparkles size={11} className="text-[#8FB305]" />
                            <span>{candidate.matchScore}%</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[#575A51] dark:text-neutral-300 font-medium">
                          {candidate.experience || '3+'}
                        </td>
                        <td className="py-4 px-4 text-[#575A51] dark:text-neutral-300 font-medium">
                          {candidate.noticePeriod || 'Immediate'}
                        </td>
                        <td className="py-4 px-4 text-[#575A51] dark:text-neutral-300 font-medium">
                          {candidate.location || 'Bangalore'}
                        </td>
                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {(candidate.skills || []).slice(0, 3).map((s, sIdx) => (
                              <span key={sIdx} className="px-2 py-0.5 rounded-full bg-[#F8F9F5] dark:bg-white/5 text-[10px] border border-[#E4E7DC] dark:border-white/10 font-medium">
                                {s}
                              </span>
                            ))}
                            {(candidate.skills || []).length > 3 && (
                              <span className="text-[10px] text-[#73766C]">+{candidate.skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDecisionChange(candidate, 'interested')}
                              className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                                decision === 'interested'
                                  ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]'
                                  : 'text-[#73766C] hover:bg-slate-100 dark:hover:bg-white/10'
                              }`}
                              title="Interested"
                            >
                              <ThumbsUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecisionChange(candidate, 'hold')}
                              className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                                decision === 'hold'
                                  ? 'bg-amber-600 text-white'
                                  : 'text-[#73766C] hover:bg-slate-100 dark:hover:bg-white/10'
                              }`}
                              title="Hold"
                            >
                              <Bookmark size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecisionChange(candidate, 'reject')}
                              className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                                decision === 'reject'
                                  ? 'bg-rose-600 text-white'
                                  : 'text-[#73766C] hover:bg-slate-100 dark:hover:bg-white/10'
                              }`}
                              title="Decline"
                            >
                              <ThumbsDown size={13} />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setPreviewResumeCandidate(candidate)}
                            className="px-3 py-1.5 rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FileText size={12} />
                            <span>Resume</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── PROPER COMPREHENSIVE LANDING PAGE FOOTER ── */}
      <footer className="w-full mt-20 border-t border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Col 1: Brand & Certification (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <Link to="/" className="inline-block" title="hireX Home">
                <HireXLogo className="h-9 w-auto" isDark={isDark} />
              </Link>
              <p className="text-xs text-[#575A51] dark:text-neutral-400 leading-relaxed max-w-sm">
                Enterprise AI-Powered Talent Screening, Blind Anti-Bias Candidate Shortlists & Executive Hiring Infrastructure.
              </p>

              {/* Compliance Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300">
                  <Building2 size={12} className="text-[#8FB305]" />
                  <span>MCA Registered Entity</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300">
                  <Lock size={12} className="text-[#8FB305]" />
                  <span>SSL 256-Bit Encrypted</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300">
                  <ShieldCheck size={12} className="text-[#8FB305]" />
                  <span>DPDP Act Aligned</span>
                </span>
              </div>
            </div>

            {/* Col 2: Review Shortcuts (3 cols) */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#111215] dark:text-[#F8F9F5]">
                Review Tools
              </h4>
              <ul className="space-y-2 text-xs text-[#575A51] dark:text-neutral-400">
                <li>
                  <button
                    type="button"
                    onClick={() => setIsCompareOpen(true)}
                    className="hover:text-[#111215] dark:hover:text-[#D4F82C] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Columns size={12} />
                    <span>Candidate Comparison Matrix</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="hover:text-[#111215] dark:hover:text-[#D4F82C] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 size={12} />
                    <span>Share Shortlist with Hiring Team</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setMinScoreFilter('90')}
                    className="hover:text-[#111215] dark:hover:text-[#D4F82C] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>View Top Fit (90%+ AI Match)</span>
                  </button>
                </li>
                <li>
                  <Link
                    to="/candidate"
                    className="hover:text-[#111215] dark:hover:text-[#D4F82C] flex items-center gap-1.5 transition-colors"
                  >
                    <User size={12} />
                    <span>Candidate Career Portal</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Legal & Governance (2 cols) */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#111215] dark:text-[#F8F9F5]">
                Governance
              </h4>
              <ul className="space-y-2 text-xs text-[#575A51] dark:text-neutral-400">
                <li className="flex items-center gap-1.5">
                  <FileCheck2 size={12} className="text-[#8FB305]" />
                  <span>Confidentiality NDA</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Shield size={12} className="text-[#8FB305]" />
                  <span>Blind Bias Prevention</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Lock size={12} className="text-[#8FB305]" />
                  <span>PII Data Masking</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Globe size={12} className="text-[#8FB305]" />
                  <span>Audit Logging</span>
                </li>
              </ul>
            </div>

            {/* Col 4: Recruiter Direct Card (3 cols) */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#111215] dark:text-[#F8F9F5]">
                Lead Recruitment Partner
              </h4>
              <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] space-y-3 text-xs">
                <div>
                  <span className="font-extrabold text-[#111215] dark:text-[#F8F9F5] block">
                    {shortlist.recruiterName || 'Talent Acquisition Lead'}
                  </span>
                  <span className="text-[11px] text-[#73766C] dark:text-neutral-400 block truncate">
                    {shortlist.agencyName || 'Agency Partner'}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-[#E4E7DC] dark:border-white/10 text-[11px]">
                  {shortlist.recruiterPhone && (
                    <a
                      href={`tel:${shortlist.recruiterPhone.replace(/\D/g, '')}`}
                      className="flex items-center gap-1.5 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white"
                    >
                      <Phone size={12} className="text-[#8FB305]" />
                      <span>{shortlist.recruiterPhone}</span>
                    </a>
                  )}
                  {shortlist.recruiterEmail && (
                    <a
                      href={`mailto:${shortlist.recruiterEmail}`}
                      className="flex items-center gap-1.5 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white truncate"
                    >
                      <Mail size={12} className="text-[#8FB305]" />
                      <span className="truncate">{shortlist.recruiterEmail}</span>
                    </a>
                  )}
                </div>

                {shortlist.recruiterPhone && (
                  <a
                    href={getWhatsAppDiscussionLink() || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:bg-[#202227] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <MessageCircle size={13} />
                    <span>WhatsApp Connect</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Disclaimer */}
          <div className="mt-12 pt-8 border-t border-[#E4E7DC] dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#73766C] dark:text-neutral-400">
            <p>
              © 2026 InterviewXpert. All rights reserved. Curated for <strong>{shortlist.clientName}</strong>.
            </p>
            <p className="text-[11px] text-center md:text-right max-w-xl">
              Confidential Talent Review Document. Protected under enterprise recruitment Non-Disclosure Agreement.
            </p>
          </div>
        </div>
      </footer>

      {/* ── CLOUDINARY RESUME VIEWER MODAL ── */}
      {previewResumeCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-4xl h-[92vh] rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-4 shrink-0 bg-white dark:bg-[#15161A]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#D4F82C]/20 border border-[#8FB305]/30 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-[#111215] dark:text-[#F8F9F5] truncate">
                      {previewResumeCandidate.candidateName || previewResumeCandidate.maskedName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30 shrink-0">
                      <Sparkles size={11} className="text-[#8FB305]" />
                      <span>{previewResumeCandidate.matchScore}% Match</span>
                    </span>
                  </div>
                  <p className="text-xs text-[#575A51] dark:text-neutral-400 truncate">
                    {shortlist.jobTitle} • {previewResumeCandidate.experience} Experience • Verified Document
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E4E7DC] dark:border-white/10 text-xs font-bold hover:bg-[#F8F9F5] dark:hover:bg-white/10 transition-colors"
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111215] text-[#D4F82C] hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold transition-colors"
                  >
                    <MessageCircle size={13} />
                    <span className="hidden sm:inline">Discuss</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewResumeCandidate(null)}
                  className="p-2 rounded-full border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white hover:bg-[#F8F9F5] dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body - Document Preview */}
            <div className="flex-1 bg-slate-900/60 overflow-hidden relative">
              {previewResumeCandidate.resumeUrl ? (
                <iframe
                  src={
                    previewResumeCandidate.resumeUrl.endsWith('.docx')
                      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewResumeCandidate.resumeUrl)}`
                      : previewResumeCandidate.resumeUrl
                  }
                  title="Candidate Resume"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4 bg-white dark:bg-[#15161A]">
                  <div className="w-16 h-16 rounded-3xl bg-[#D4F82C]/20 border border-[#8FB305]/30 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-[#111215] dark:text-[#F8F9F5]">Executive Profile Overview</h4>
                    <p className="text-xs text-[#575A51] dark:text-neutral-400 max-w-md mt-1">
                      Direct document link is pending sync. Review verified career profile details below:
                    </p>
                  </div>
                  <div className="max-w-xl text-left bg-[#F8F9F5] dark:bg-[#101114] p-5 rounded-3xl border border-[#E4E7DC] dark:border-white/10 space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-[#73766C] dark:text-neutral-400 block uppercase text-[10px]">Career Summary</span>
                      <p className="text-[#111215] dark:text-[#F8F9F5] mt-1 leading-relaxed">
                        {previewResumeCandidate.summary}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-[#73766C] dark:text-neutral-400 block uppercase text-[10px] mb-1">Demonstrated Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {previewResumeCandidate.skills.map((s, idx) => (
                          <span key={idx} className="px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-semibold text-[#111215] dark:text-[#F8F9F5]">
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
            <div className="px-6 py-4 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between text-xs text-[#575A51] dark:text-neutral-400 shrink-0 bg-white dark:bg-[#15161A]">
              <span>Candidate Match: <strong>{previewResumeCandidate.matchScore}% ({previewResumeCandidate.matchGrade})</strong></span>
              <button
                type="button"
                onClick={() => setPreviewResumeCandidate(null)}
                className="px-5 py-2 rounded-full border border-[#E4E7DC] dark:border-white/10 hover:bg-[#F8F9F5] dark:hover:bg-white/10 font-bold text-[#111215] dark:text-[#F8F9F5] transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDE-BY-SIDE CANDIDATE COMPARISON MATRIX MODAL ── */}
      {isCompareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-6xl max-h-[90vh] rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-[#E4E7DC] dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-[#15161A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center">
                  <Columns size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#111215] dark:text-[#F8F9F5]">Candidate Comparison Matrix</h3>
                  <p className="text-xs text-[#575A51] dark:text-neutral-400">
                    Comparing all {totalCount} shortlisted candidates for {shortlist.jobTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="p-2 rounded-full border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white hover:bg-[#F8F9F5] dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto p-6 bg-[#F8F9F5] dark:bg-[#101114]">
              <div className="grid grid-flow-col auto-cols-[300px] sm:auto-cols-[320px] gap-4">
                {shortlist.candidates.map((cand, idx) => (
                  <div
                    key={cand.id || idx}
                    className="p-5 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] space-y-4 shadow-xs"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">Candidate #{idx + 1}</span>
                      <h4 className="font-bold text-base text-[#111215] dark:text-[#F8F9F5] truncate mt-0.5">
                        {cand.candidateName || cand.maskedName}
                      </h4>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30">
                        <Sparkles size={11} className="text-[#8FB305]" />
                        <span>{cand.matchScore}% Match • {cand.matchGrade}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs border-t border-[#E4E7DC] dark:border-white/10 pt-3">
                      <div>
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Experience</span>
                        <p className="font-bold text-[#111215] dark:text-[#F8F9F5]">{cand.experience}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Notice Period</span>
                        <p className="font-bold text-[#111215] dark:text-[#F8F9F5]">{cand.noticePeriod}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Location</span>
                        <p className="font-bold text-[#111215] dark:text-[#F8F9F5]">{cand.location}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Expected CTC</span>
                        <p className="font-bold text-[#111215] dark:text-[#F8F9F5]">{cand.expectedSalary || 'Competitive'}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-[#E4E7DC] dark:border-white/10 pt-3">
                      <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Top Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {(cand.skills || []).slice(0, 6).map((s, sIdx) => (
                          <span key={sIdx} className="px-2.5 py-0.5 rounded-full bg-[#F8F9F5] dark:bg-white/5 text-[10px] border border-[#E4E7DC] dark:border-white/10 font-medium">
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
                        className="w-full py-2.5 rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <FileText size={13} />
                        <span>View Resume</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E4E7DC] dark:border-white/10 flex justify-end shrink-0 bg-white dark:bg-[#15161A]">
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="px-5 py-2.5 rounded-full border border-[#E4E7DC] dark:border-white/10 font-bold text-xs hover:bg-[#F8F9F5] dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CLIENT FEEDBACK / NOTE MODAL ── */}
      {feedbackCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    Client Feedback Note
                  </h3>
                  <p className="text-xs text-[#575A51] dark:text-neutral-400">
                    Candidate: {feedbackCandidate.candidateName || feedbackCandidate.maskedName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackCandidate(null)}
                className="p-2 rounded-full border border-[#E4E7DC] dark:border-white/10 text-[#575A51] hover:text-[#111215] dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider block">
                Feedback for Recruitment Team
              </label>
              <textarea
                rows={4}
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                placeholder="E.g., Great technical match. Please arrange a 30-min interview next Tuesday. Ask about their system design experience..."
                className="w-full p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs text-[#111215] dark:text-[#F8F9F5] outline-none focus:border-[#111215] dark:focus:border-white/30 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFeedbackCandidate(null)}
                className="px-4 py-2 rounded-full border border-[#E4E7DC] dark:border-white/10 text-xs font-bold text-[#575A51] hover:bg-[#F8F9F5] dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingFeedback}
                onClick={handleSaveFeedback}
                className="px-5 py-2 rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {savingFeedback ? 'Saving Note...' : 'Save Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
