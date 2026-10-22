import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  CheckCircle2,
  Calendar,
  XCircle,
  Clock,
  Briefcase,
  Building2,
  Sparkles,
  ShieldCheck,
  User,
  ExternalLink,
  ChevronRight,
  FileText,
  RotateCw,
  Send,
  MessageCircle,
  ThumbsUp,
  PauseCircle,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Check,
  HelpCircle,
  Award,
  X
} from 'lucide-react';
import { sendWhatsAppMessage } from '../services/waSenderService';

interface ShortlistedCandidate {
  id: string;
  applicationDocId?: string;
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
  clientDecision?: 'pending' | 'approved' | 'hold' | 'rejected';
  clientFeedback?: string;
  decidedAt?: any;
  interviewDetails?: {
    roundName?: string;
    preferredDate?: string;
    preferredTime?: string;
    mode?: string;
    notes?: string;
  } | null;
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
  status?: string;
}

export default function ClientReviewPortal() {
  const { shareId } = useParams<{ shareId: string }>();

  const [loading, setLoading] = useState(true);
  const [shortlist, setShortlist] = useState<ClientShortlistData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Decision Modal States
  const [approvingCandidate, setApprovingCandidate] = useState<ShortlistedCandidate | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('11:00');
  const [preferredMode, setPreferredMode] = useState('Google Meet');
  const [interviewRound, setInterviewRound] = useState('Round 1 (Technical Screening)');
  const [clientInterviewNotes, setClientInterviewNotes] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Reject Modal States
  const [rejectingCandidate, setRejectingCandidate] = useState<ShortlistedCandidate | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Core skill mismatch');
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Resume Modal State
  const [viewingResumeCandidate, setViewingResumeCandidate] = useState<ShortlistedCandidate | null>(null);

  // Success Notification Banner
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) {
      setError('Shortlist share identifier is missing.');
      setLoading(false);
      return;
    }

    const fetchShortlist = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'clientShortlists'), where('shareId', '==', shareId));
        const snap = await getDocs(q);

        if (snap.empty) {
          setError('This client review link does not exist or has expired.');
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data() as any;

        // Check expiration
        if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
          setError('This candidate shortlist link has expired. Please contact your recruitment partner for an updated link.');
          setLoading(false);
          return;
        }

        setShortlist({
          id: docSnap.id,
          ...data,
          candidates: Array.isArray(data.candidates) ? data.candidates : [],
        });
      } catch (err: any) {
        console.error('Error fetching shortlist:', err);
        setError('Failed to load candidate shortlist. Please try refreshing.');
      } finally {
        setLoading(false);
      }
    };

    fetchShortlist();
  }, [shareId]);

  // Handle Approve for Interview
  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortlist || !approvingCandidate) return;

    setIsSubmittingDecision(true);
    try {
      const updatedCandidates = shortlist.candidates.map((c) => {
        if (c.id === approvingCandidate.id) {
          return {
            ...c,
            clientDecision: 'approved' as const,
            clientFeedback: clientInterviewNotes.trim(),
            decidedAt: new Date().toISOString(),
            interviewDetails: {
              roundName: interviewRound,
              preferredDate,
              preferredTime,
              mode: preferredMode,
              notes: clientInterviewNotes.trim(),
            },
          };
        }
        return c;
      });

      // 1. Update Shortlist Document
      const shortlistRef = doc(db, 'clientShortlists', shortlist.id);
      await updateDoc(shortlistRef, {
        candidates: updatedCandidates,
      });

      // 2. Update Candidate Application status in ATS to 'Interview Scheduled'
      if (approvingCandidate.applicationDocId) {
        try {
          await updateDoc(doc(db, 'candidateApplications', approvingCandidate.applicationDocId), {
            status: 'Interview Scheduled',
            clientApproved: true,
            clientName: shortlist.clientName,
            statusUpdatedAt: serverTimestamp(),
            scheduledInterview: {
              contactPerson: shortlist.clientContactPerson || shortlist.clientName,
              date: preferredDate,
              time: preferredTime,
              mode: preferredMode,
              notes: clientInterviewNotes.trim() || `Approved for ${interviewRound} by ${shortlist.clientName}`,
            },
          });
        } catch (e) {
          console.warn('Update candidateApplications fallback:', e);
        }
      }

      // 3. Create In-App Notification for Agency Recruiter
      if (shortlist.recruiterUID) {
        await addDoc(collection(db, 'notifications'), {
          userId: shortlist.recruiterUID,
          type: 'client_approved_candidate',
          title: `⚡ ${shortlist.clientName} approved ${approvingCandidate.candidateName || approvingCandidate.maskedName}!`,
          message: `${shortlist.clientName} just approved ${approvingCandidate.candidateName || approvingCandidate.maskedName} for ${interviewRound} (${shortlist.jobTitle}). Click here to view details and send calendar invite.`,
          link: `/recruiter/hot-leads?selectedJob=${shortlist.jobId}`,
          read: false,
          createdAt: serverTimestamp(),
        }).catch((err) => console.warn('Notification save warning:', err));
      }

      // 4. Send Instant WhatsApp Notification to Recruiter Phone if available
      if (shortlist.recruiterPhone) {
        const waMsg = `⚡ *Candidate Approved by Client!*
        
*Client:* ${shortlist.clientName}
*Role:* ${shortlist.jobTitle}
*Candidate:* ${approvingCandidate.candidateName || approvingCandidate.maskedName} (${approvingCandidate.matchScore}% Match)
*Round:* ${interviewRound}
${preferredDate ? `*Preferred Date:* ${preferredDate} at ${preferredTime}\n*Mode:* ${preferredMode}` : ''}
${clientInterviewNotes ? `*Client Note:* "${clientInterviewNotes}"` : ''}

👉 *Open Candidate Responses in HireX:*
${window.location.origin}/recruiter/hot-leads`;

        sendWhatsAppMessage({
          to: shortlist.recruiterPhone,
          message: waMsg,
        }).catch((e) => console.warn('Recruiter WhatsApp alert dispatch:', e));
      }

      setShortlist({ ...shortlist, candidates: updatedCandidates });
      setSuccessToast(`🎉 ${approvingCandidate.maskedName} approved for ${interviewRound}! Recruiter notified.`);
      setTimeout(() => setSuccessToast(null), 5000);
      setApprovingCandidate(null);
    } catch (err: any) {
      console.error('Error approving candidate:', err);
      alert(`Failed to save decision: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Handle Put On Hold
  const handlePutOnHold = async (candidate: ShortlistedCandidate) => {
    if (!shortlist) return;
    setIsSubmittingDecision(true);
    try {
      const updatedCandidates = shortlist.candidates.map((c) => {
        if (c.id === candidate.id) {
          return {
            ...c,
            clientDecision: 'hold' as const,
            clientFeedback: 'Placed on review hold by client',
            decidedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      await updateDoc(doc(db, 'clientShortlists', shortlist.id), {
        candidates: updatedCandidates,
      });

      if (candidate.applicationDocId) {
        await updateDoc(doc(db, 'candidateApplications', candidate.applicationDocId), {
          status: 'On Hold',
          statusUpdatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      setShortlist({ ...shortlist, candidates: updatedCandidates });
      setSuccessToast(`Candidate ${candidate.maskedName} marked as On Hold.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Handle Reject Candidate
  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortlist || !rejectingCandidate) return;

    setIsSubmittingDecision(true);
    try {
      const fullFeedback = rejectionNotes.trim()
        ? `${rejectionReason}: ${rejectionNotes.trim()}`
        : rejectionReason;

      const updatedCandidates = shortlist.candidates.map((c) => {
        if (c.id === rejectingCandidate.id) {
          return {
            ...c,
            clientDecision: 'rejected' as const,
            clientFeedback: fullFeedback,
            decidedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      await updateDoc(doc(db, 'clientShortlists', shortlist.id), {
        candidates: updatedCandidates,
      });

      if (rejectingCandidate.applicationDocId) {
        await updateDoc(doc(db, 'candidateApplications', rejectingCandidate.applicationDocId), {
          status: 'Rejected',
          clientFeedback: fullFeedback,
          statusUpdatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      setShortlist({ ...shortlist, candidates: updatedCandidates });
      setSuccessToast(`Feedback recorded for ${rejectingCandidate.maskedName}.`);
      setTimeout(() => setSuccessToast(null), 4000);
      setRejectingCandidate(null);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070709] flex flex-col items-center justify-center p-4">
        <RotateCw className="size-8 text-emerald-500 animate-spin mb-3" />
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
          Loading Candidate Shortlist...
        </h3>
        <p className="text-xs text-slate-400 mt-1">Preparing verified masked profiles</p>
      </div>
    );
  }

  if (error || !shortlist) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070709] flex flex-col items-center justify-center p-6 text-center">
        <div className="size-14 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Shortlist Link Unavailable
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-2">
          {error || 'The requested shortlist could not be loaded.'}
        </p>
        <div className="mt-6">
          <a
            href="mailto:hello@snab.co.in"
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            Need help? Contact hello@snab.co.in
          </a>
        </div>
      </div>
    );
  }

  // Decision stats
  const totalCount = shortlist.candidates.length;
  const approvedCount = shortlist.candidates.filter((c) => c.clientDecision === 'approved').length;
  const holdCount = shortlist.candidates.filter((c) => c.clientDecision === 'hold').length;
  const rejectedCount = shortlist.candidates.filter((c) => c.clientDecision === 'rejected').length;
  const pendingCount = shortlist.candidates.filter(
    (c) => !c.clientDecision || c.clientDecision === 'pending'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#08080a] text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Success Notification Banner */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-xl shadow-emerald-600/30">
            <CheckCircle2 size={16} />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-white/[0.08] bg-white/80 dark:bg-[#0c0c0e]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-500/20">
              {shortlist.agencyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {shortlist.agencyName}
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  Client Review Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Curated exclusively for <span className="font-bold text-slate-700 dark:text-slate-200">{shortlist.clientName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {shortlist.recruiterPhone && (
              <a
                href={`https://wa.me/${shortlist.recruiterPhone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold hover:bg-emerald-100 transition-colors shadow-2xs"
              >
                <MessageCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">WhatsApp Agency</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero Banner Card */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white via-emerald-50/20 to-white dark:from-[#0e0e12] dark:via-[#0c0c0e] dark:to-[#0e0e12] border border-slate-200 dark:border-white/[0.08] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 mb-3 border border-emerald-200 dark:border-emerald-500/30">
                <Briefcase size={13} />
                <span>Candidate Shortlist</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {shortlist.jobTitle}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {shortlist.executiveNote ||
                  `Review pre-screened, skill-verified candidate profiles below. Use the 1-click buttons to approve for interview rounds or place on hold.`}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 bg-white dark:bg-black/40 p-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] shrink-0">
              <div className="text-center px-3 py-1.5">
                <div className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {totalCount}
                </div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total
                </div>
              </div>
              <div className="text-center px-3 py-1.5 border-x border-slate-100 dark:border-white/[0.08]">
                <div className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {approvedCount}
                </div>
                <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Approved
                </div>
              </div>
              <div className="text-center px-3 py-1.5">
                <div className="text-lg sm:text-xl font-extrabold text-amber-500 font-mono">
                  {pendingCount}
                </div>
                <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Pending
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Candidates for Review</span>
            <span className="text-xs font-normal text-slate-400">({shortlist.candidates.length} Profiles)</span>
          </h2>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Blind & Confidential Profiles</span>
          </span>
        </div>

        {/* Candidate Cards Grid */}
        <div className="space-y-4">
          {shortlist.candidates.map((candidate, idx) => {
            const isApproved = candidate.clientDecision === 'approved';
            const isHold = candidate.clientDecision === 'hold';
            const isRejected = candidate.clientDecision === 'rejected';

            return (
              <div
                key={candidate.id || idx}
                className={`rounded-2xl border transition-all p-5 sm:p-6 ${
                  isApproved
                    ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-500/[0.04] shadow-sm'
                    : isHold
                    ? 'border-amber-500/40 bg-amber-50/20 dark:bg-amber-500/[0.04]'
                    : isRejected
                    ? 'border-red-500/20 bg-red-50/10 dark:bg-red-500/[0.02] opacity-75'
                    : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0c0c0e] hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Left Column: Candidate Info */}
                  <div className="flex-1 space-y-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="size-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </div>

                      <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                        {candidate.maskedName}
                      </h3>

                      {/* AI Match Score Badge */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        <Sparkles size={11} />
                        <span>{candidate.matchScore}% Match • {candidate.matchGrade}</span>
                      </span>

                      {/* Status Badges */}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                          <CheckCircle2 size={12} />
                          <span>Interview Scheduled</span>
                        </span>
                      )}
                      {isHold && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                          <Clock size={12} />
                          <span>On Hold</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-600 border border-red-500/30">
                          <XCircle size={12} />
                          <span>Concluded</span>
                        </span>
                      )}
                    </div>

                    {/* Key Attributes Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Experience</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{candidate.experience || '3+ Years'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Notice Period</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{candidate.noticePeriod || '15–30 Days'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Location</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{candidate.location || 'Bangalore'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Expected CTC</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{candidate.expectedSalary || 'As per norms'}</span>
                      </div>
                    </div>

                    {/* Executive Summary */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {candidate.summary}
                    </p>

                    {/* Skills Tags */}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {candidate.skills.slice(0, 8).map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.06]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Interview Confirmed Notice if approved */}
                    {isApproved && candidate.interviewDetails && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <Calendar size={13} />
                          <span>Interview Requested: {candidate.interviewDetails.roundName || 'Round 1'}</span>
                        </div>
                        {candidate.interviewDetails.preferredDate && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            Requested for: {candidate.interviewDetails.preferredDate} at {candidate.interviewDetails.preferredTime} ({candidate.interviewDetails.mode})
                          </div>
                        )}
                        {candidate.interviewDetails.notes && (
                          <div className="text-[11px] italic text-emerald-700/80 dark:text-emerald-300/80">
                            Note: "{candidate.interviewDetails.notes}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rejection Feedback Note if rejected */}
                    {isRejected && candidate.clientFeedback && (
                      <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300">
                        <span className="font-bold">Feedback:</span> {candidate.clientFeedback}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Decision Actions */}
                  <div className="lg:w-60 flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-white/[0.06] lg:pl-5">
                    {/* View Resume Button */}
                    <button
                      type="button"
                      onClick={() => setViewingResumeCandidate(candidate)}
                      className="w-full h-9 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.1] text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileText size={13} className="text-purple-500" />
                      <span>View Profile / Resume</span>
                    </button>

                    {/* Decision Button 1: Schedule Interview */}
                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() => {
                        setApprovingCandidate(candidate);
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setPreferredDate(tomorrow.toISOString().split('T')[0]);
                        setPreferredTime('11:00');
                        setPreferredMode('Google Meet');
                        setInterviewRound('Round 1 (Technical Screening)');
                        setClientInterviewNotes('');
                      }}
                      className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                        isApproved
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 hover:scale-[1.01]'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      <span>{isApproved ? 'Update Interview Details' : 'Schedule Interview'}</span>
                    </button>

                    {/* Decision Button 2: Hold */}
                    <button
                      type="button"
                      disabled={isSubmittingDecision || isHold}
                      onClick={() => handlePutOnHold(candidate)}
                      className={`w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isHold
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                          : 'border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300'
                      }`}
                    >
                      <PauseCircle size={13} />
                      <span>{isHold ? 'Currently On Hold' : 'Put on Hold'}</span>
                    </button>

                    {/* Decision Button 3: Reject */}
                    {!isRejected && (
                      <button
                        type="button"
                        disabled={isSubmittingDecision}
                        onClick={() => {
                          setRejectingCandidate(candidate);
                          setRejectionReason('Core skill mismatch');
                          setRejectionNotes('');
                        }}
                        className="w-full h-8 text-[11px] font-semibold text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle size={12} />
                        <span>Pass / Conclude</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── APPROVE FOR INTERVIEW MODAL ── */}
      {approvingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Schedule Interview Round
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Candidate: <span className="font-bold">{approvingCandidate.maskedName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingCandidate(null)}
                className="size-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmApproval} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Interview Round
                </label>
                <select
                  value={interviewRound}
                  onChange={(e) => setInterviewRound(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#111114] text-xs font-medium outline-none focus:border-emerald-500"
                >
                  <option value="Round 1 (Technical Screening)">Round 1 (Technical Screening)</option>
                  <option value="Hiring Manager Interview">Hiring Manager Interview</option>
                  <option value="Live Coding / Technical Round">Live Coding / Technical Round</option>
                  <option value="Leadership / Culture Fit Round">Leadership / Culture Fit Round</option>
                  <option value="Final HR Round">Final HR Round</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    required
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Interview Meeting Mode
                </label>
                <select
                  value={preferredMode}
                  onChange={(e) => setPreferredMode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#111114] text-xs font-medium outline-none focus:border-emerald-500"
                >
                  <option value="Google Meet">Google Meet</option>
                  <option value="Zoom Meeting">Zoom Meeting</option>
                  <option value="Microsoft Teams">Microsoft Teams</option>
                  <option value="In-Person Office">In-Person Office</option>
                  <option value="Telephonic Round">Telephonic Round</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Instructions for Agency (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please ask candidate to prepare for system design questions..."
                  value={clientInterviewNotes}
                  onChange={(e) => setClientInterviewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setApprovingCandidate(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDecision}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDecision ? <RotateCw size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Confirm & Alert Recruiter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REJECTION / PASS MODAL ── */}
      {rejectingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.08]">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Pass on {rejectingCandidate.maskedName}
              </h3>
              <button
                type="button"
                onClick={() => setRejectingCandidate(null)}
                className="size-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmRejection} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Reason
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#111114] text-xs font-medium outline-none focus:border-red-500"
                >
                  <option value="Core skill mismatch">Core skill mismatch</option>
                  <option value="Experience gap">Experience gap</option>
                  <option value="Notice period too long">Notice period too long</option>
                  <option value="Compensation expectation too high">Compensation expectation too high</option>
                  <option value="Location / hybrid constraint">Location / hybrid constraint</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Specific Feedback for Recruiter (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Needs deeper hands-on TypeScript knowledge..."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#111114] text-xs outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setRejectingCandidate(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDecision}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50"
                >
                  <span>Submit Feedback</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESUME / MASKED PROFILE VIEW MODAL ── */}
      {viewingResumeCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Confidential Masked Profile
                </h3>
                <p className="text-xs text-slate-400">
                  {viewingResumeCandidate.maskedName} • {shortlist.jobTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingResumeCandidate(null)}
                className="size-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-1 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Executive Career Summary
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                  {viewingResumeCandidate.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Verified Experience</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{viewingResumeCandidate.experience}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 block font-semibold">Notice Availability</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{viewingResumeCandidate.noticePeriod}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-2">
                  Demonstrated Skills & Proficiencies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {viewingResumeCandidate.skills.map((skill, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {viewingResumeCandidate.resumeUrl && (
                <div className="pt-2">
                  <a
                    href={viewingResumeCandidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20 font-bold hover:bg-purple-100 transition-colors"
                  >
                    <ExternalLink size={13} />
                    <span>Open Uploaded Resume Document</span>
                  </a>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex justify-end">
              <button
                type="button"
                onClick={() => setViewingResumeCandidate(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.08] text-xs font-bold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
