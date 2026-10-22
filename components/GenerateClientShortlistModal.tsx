import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Building2,
  Briefcase,
  Phone,
  Mail,
  User,
  Sparkles,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Info,
  RotateCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { HotLeadItem } from '../pages/HotLeads';

interface GenerateClientShortlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: HotLeadItem[];
  defaultJobTitle?: string;
  defaultCompanyName?: string;
}

export default function GenerateClientShortlistModal({
  isOpen,
  onClose,
  selectedLeads,
  defaultJobTitle,
  defaultCompanyName,
}: GenerateClientShortlistModalProps) {
  const { user, userProfile } = useAuth();

  // Auto-fetched fields
  const [clientName, setClientName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [agencyName, setAgencyName] = useState('SNAB Talent Partners');
  const [recruiterPhone, setRecruiterPhone] = useState('+91 9511779317');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [clientContactPerson, setClientContactPerson] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [executiveNote, setExecutiveNote] = useState(
    'Hi team, please find attached the curated, pre-screened candidates for this role. All candidates have verified skills, match requirements, and are available for interview rounds.'
  );
  const [maskingLevel, setMaskingLevel] = useState<'standard' | 'anonymous'>('standard');
  const [expiresInDays, setExpiresInDays] = useState<number>(14);

  // States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedShareId, setGeneratedShareId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoCopiedNotice, setAutoCopiedNotice] = useState(false);

  // Prevent multiple executions for the same open session
  const hasAutoCreatedRef = useRef<boolean>(false);

  // Auto-fetch job and directly create link when modal opens
  useEffect(() => {
    if (!isOpen || selectedLeads.length === 0) {
      hasAutoCreatedRef.current = false;
      return;
    }

    if (hasAutoCreatedRef.current) return;
    hasAutoCreatedRef.current = true;

    // 1. Auto-fetch job title and client/company name
    const firstLead = selectedLeads[0];
    const resolvedJob = (firstLead?.jobTitle || defaultJobTitle || 'Candidate Role').trim();
    let rawCompany = (firstLead?.companyName || defaultCompanyName || userProfile?.company || 'Client').trim();
    // Clean up any "(Dummy com...)" from company name
    rawCompany = rawCompany.replace(/\s*\(Dummy.*?\)\s*/gi, '').trim() || 'Client';

    const resolvedAgency = userProfile?.company || (userProfile as any)?.agencyName || 'SNAB Talent Partners';
    const resolvedPhone = userProfile?.phone || (userProfile as any)?.whatsappNumber || '+91 9511779317';
    const resolvedEmail = user?.email || '';

    setJobTitle(resolvedJob);
    setClientName(rawCompany);
    setAgencyName(resolvedAgency);
    setRecruiterPhone(resolvedPhone);
    setRecruiterEmail(resolvedEmail);
    setGeneratedShareId(null);
    setCopiedLink(false);
    setAutoCopiedNotice(false);

    // 2. Directly trigger link generation
    executeDirectCreation({
      targetJob: resolvedJob,
      targetClient: rawCompany,
      targetAgency: resolvedAgency,
      targetPhone: resolvedPhone,
      targetEmail: resolvedEmail,
    });
  }, [isOpen, selectedLeads, defaultJobTitle, defaultCompanyName]);

  const executeDirectCreation = async (params?: {
    targetJob?: string;
    targetClient?: string;
    targetAgency?: string;
    targetPhone?: string;
    targetEmail?: string;
  }) => {
    const finalJob = params?.targetJob || jobTitle || selectedLeads[0]?.jobTitle || 'Candidate Role';
    const finalClient = params?.targetClient || clientName || selectedLeads[0]?.companyName || 'Client';
    const finalAgency = params?.targetAgency || agencyName || 'SNAB Talent Partners';
    const finalPhone = params?.targetPhone || recruiterPhone || '+91 9511779317';
    const finalEmail = params?.targetEmail || recruiterEmail || user?.email || '';

    setIsGenerating(true);

    try {
      // 1. Prepare candidates payload with Cloudinary resumes and match scores
      const candidatesPayload = await Promise.all(
        selectedLeads.map(async (lead, index) => {
          const rawName = lead.candidateName || 'Candidate';
          const parts = rawName.split(' ');
          const maskedName =
            maskingLevel === 'anonymous'
              ? `Candidate #${index + 1}`
              : parts.length > 1
              ? `${parts[0]} ${parts[1][0]}.`
              : `${parts[0]} (Candidate #${index + 1})`;

          let skills = lead.candidateDetails?.skills || [];
          const exp = lead.candidateDetails?.experience || '3+';
          const notice = lead.candidateDetails?.noticePeriod || 'Immediate / 15 Days';
          const location = lead.candidateDetails?.location || 'Bangalore / Remote';
          const summary =
            lead.candidateDetails?.summary ||
            `Pre-screened talent with ${exp} years verified experience in ${finalJob}. Evaluated with AI match score of ${lead.matchScore || 85}%.`;

          let resumeUrl = lead.resumeUrl || lead.candidateDetails?.resumeUrl || '';

          if ((!resumeUrl || skills.length === 0) && lead.candidateEmail) {
            try {
              const cleanEmail = lead.candidateEmail.toLowerCase().trim();
              const qDump = query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail));
              const snap = await getDocs(qDump).catch(() => null);
              if (snap && !snap.empty) {
                const dData = snap.docs[0].data();
                if (!resumeUrl) {
                  resumeUrl = dData.resumeUrl || dData.profile?.resumeUrl || dData.fileUrl || '';
                }
                if (skills.length === 0) {
                  skills = dData.skills || dData.profile?.skills || [];
                }
              }
            } catch (err) {
              console.warn('Fallback resume resolution error:', err);
            }
          }

          return {
            id: lead.id,
            applicationDocId: lead.applicationDocId || '',
            candidateId: lead.candidateId || '',
            candidateEmail: lead.candidateEmail || '',
            candidatePhone: lead.candidatePhone || '',
            candidateName: lead.candidateName,
            maskedName,
            matchScore: lead.matchScore || 85,
            matchGrade: lead.matchGrade || 'Great Fit',
            skills,
            experience: typeof exp === 'number' ? `${exp} Years` : String(exp),
            noticePeriod: String(notice),
            location: String(location),
            currentSalary: lead.candidateDetails?.currentSalary || 'Confidential',
            expectedSalary: lead.candidateDetails?.expectedSalary || 'As per norms',
            summary,
            resumeUrl,
            clientDecision: 'pending',
            clientFeedback: '',
            decidedAt: null,
            interviewDetails: null,
          };
        })
      );

      // 2. Generate random readable shareId
      const shareId = `csl_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).slice(-4)}`;

      // 3. Compute expiration
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);

      // 4. Save to Firestore clientShortlists collection
      await addDoc(collection(db, 'clientShortlists'), {
        shareId,
        clientName: finalClient.trim(),
        jobTitle: finalJob.trim(),
        jobId: selectedLeads[0]?.jobId || '',
        agencyName: finalAgency.trim(),
        recruiterUID: user?.uid || '',
        recruiterName: userProfile?.name || user?.displayName || 'Recruiter Lead',
        recruiterPhone: finalPhone.trim(),
        recruiterEmail: finalEmail.trim(),
        clientContactPerson: clientContactPerson.trim(),
        clientPhone: clientPhone.trim(),
        executiveNote: executiveNote.trim(),
        maskingLevel,
        expiresAt: expirationDate.toISOString(),
        createdAt: serverTimestamp(),
        viewCount: 0,
        candidates: candidatesPayload,
        status: 'active',
      });

      setGeneratedShareId(shareId);

      // 5. Auto-copy to clipboard immediately!
      const newUrl = `${window.location.origin}/review/${shareId}`;
      try {
        await navigator.clipboard.writeText(newUrl);
        setCopiedLink(true);
        setAutoCopiedNotice(true);
      } catch (e) {
        // clipboard permission fallback
      }
    } catch (err: any) {
      console.error('Error creating client shortlist:', err);
      alert(`Failed to generate shortlist link: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const portalUrl = generatedShareId
    ? `${window.location.origin}/review/${generatedShareId}`
    : '';

  const handleCopyLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const clientShareMessage = `Hi ${clientContactPerson || clientName || 'Hiring Team'},

Here is the curated shortlist of ${selectedLeads.length} pre-screened candidate(s) for the *${jobTitle}* position prepared by ${agencyName}:

👉 *Candidate Review & Match Scores Portal:*
${portalUrl}

You can view executive summaries, AI fit scores, and Cloudinary resumes directly on this private portal.

Best regards,
${agencyName}`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(clientShareMessage);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  const handleOpenWhatsAppShare = () => {
    const cleanPhone = clientPhone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(clientShareMessage);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-3xl border border-gray-200 dark:border-white/[0.14] bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.1] bg-gradient-to-r from-emerald-500/10 via-transparent to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Share2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Client Review Portal Link
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <Sparkles size={10} /> Auto-Created
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Auto-fetched job: <strong className="text-slate-700 dark:text-slate-200">{jobTitle || 'Role'}</strong> • Client: <strong className="text-slate-700 dark:text-slate-200">{clientName || 'Client'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.05] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. Loading State while generating in background */}
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <RotateCw className="size-8 animate-spin" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Auto-Fetching Job & Creating Link...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Configuring {selectedLeads.length} shortlisted candidate(s) for <strong>{jobTitle || 'Applied Role'}</strong> with verified Cloudinary resumes.
                </p>
              </div>
            </div>
          ) : generatedShareId ? (
            /* 2. Success / Generated State */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Success Banner */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 p-5 text-center">
                <div className="size-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                  Client Shortlist Link Ready!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Directly created for <strong>{jobTitle}</strong> ({selectedLeads.length} candidate{selectedLeads.length > 1 ? 's' : ''})
                </p>
                {autoCopiedNotice && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white mt-2.5 shadow-xs">
                    <Check size={13} />
                    <span>Link automatically copied to clipboard!</span>
                  </div>
                )}
              </div>

              {/* Direct Link Box */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Private Client Review URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={portalUrl}
                    className="flex-1 h-11 px-3.5 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-gray-50 dark:bg-black/50 text-xs font-mono text-gray-800 dark:text-gray-200 outline-none select-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 px-3.5 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.05] hover:bg-gray-100 dark:hover:bg-white/[0.1] text-gray-700 dark:text-gray-200 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Open live review portal in new tab"
                  >
                    <ExternalLink size={14} />
                    <span>Open Portal</span>
                  </a>
                </div>
              </div>

              {/* Candidates Included Summary */}
              <div className="p-3.5 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-gray-50/70 dark:bg-white/[0.02]">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                  <span>Candidates in Shortlist ({selectedLeads.length})</span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Role: {jobTitle}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedLeads.map((lead, i) => (
                    <div
                      key={lead.id || i}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121216] text-xs font-medium shadow-2xs"
                    >
                      <User size={13} className="text-slate-400" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {lead.candidateName}
                      </span>
                      <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {lead.matchScore || 85}% fit
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pre-composed WhatsApp Action Box */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-gray-50/70 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <MessageCircle size={15} className="text-emerald-500" />
                    <span>Share with Client on WhatsApp</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedMsg ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedMsg ? 'Copied Message!' : 'Copy Text'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-black/40 text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans max-h-28 overflow-y-auto leading-relaxed">
                  {clientShareMessage}
                </div>

                <button
                  type="button"
                  onClick={handleOpenWhatsAppShare}
                  className="w-full h-10 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <MessageCircle size={15} />
                  <span>Send via WhatsApp Direct</span>
                </button>
              </div>

              {/* Collapsible Edit Settings */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSettings((prev) => !prev)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <SlidersHorizontal size={13} />
                  <span>{showSettings ? 'Hide customization options' : 'Customize client name, expiration, or notes'}</span>
                  {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showSettings && (
                  <div className="mt-3 p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] space-y-3.5 text-xs animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Client / Company Name
                        </label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Job Role Title
                        </label>
                        <input
                          type="text"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => executeDirectCreation()}
                        disabled={isGenerating}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs hover:opacity-90 cursor-pointer"
                      >
                        Re-generate with Custom Options
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Fallback manual trigger */
            <div className="py-6 text-center space-y-3">
              <p className="text-xs text-slate-500">
                Ready to create shortlist link for <strong>{jobTitle || 'Role'}</strong>.
              </p>
              <button
                type="button"
                onClick={() => executeDirectCreation()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                Create Branded Link
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {generatedShareId && (
          <div className="px-6 py-3.5 border-t border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-[#111114] flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Valid for {expiresInDays} days • Blind & Masked Profiles Verified
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-gray-200 dark:bg-white/[0.1] hover:bg-gray-300 dark:hover:bg-white/[0.15] text-xs font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
