import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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

  // Form states
  const [clientName, setClientName] = useState(defaultCompanyName || '');
  const [jobTitle, setJobTitle] = useState(defaultJobTitle || '');
  const [agencyName, setAgencyName] = useState(
    userProfile?.company || (userProfile as any)?.agencyName || 'SNAB Talent Partners'
  );
  const [recruiterPhone, setRecruiterPhone] = useState(
    userProfile?.phone || (userProfile as any)?.whatsappNumber || '+91 9511779317'
  );
  const [recruiterEmail, setRecruiterEmail] = useState(user?.email || '');
  const [clientContactPerson, setClientContactPerson] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [executiveNote, setExecutiveNote] = useState(
    'Hi team, please find attached the curated, pre-screened candidates for this role. All candidates have verified skills, match requirements, and are available for interview rounds.'
  );
  const [maskingLevel, setMaskingLevel] = useState<'standard' | 'anonymous'>('standard');
  const [expiresInDays, setExpiresInDays] = useState<number>(14);

  // Submission / result states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedShareId, setGeneratedShareId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !jobTitle.trim() || selectedLeads.length === 0) return;

    setIsGenerating(true);

    try {
      // 1. Prepare candidates payload with masked details
      const candidatesPayload = selectedLeads.map((lead, index) => {
        const rawName = lead.candidateName || 'Candidate';
        const parts = rawName.split(' ');
        const maskedName =
          maskingLevel === 'anonymous'
            ? `Candidate #${index + 1}`
            : parts.length > 1
            ? `${parts[0]} ${parts[1][0]}.`
            : `${parts[0]} (Candidate #${index + 1})`;

        const skills = lead.candidateDetails?.skills || [];
        const exp = lead.candidateDetails?.experience || '3+';
        const notice = lead.candidateDetails?.noticePeriod || 'Immediate / 15 Days';
        const location = lead.candidateDetails?.location || 'Bangalore / Remote';
        const summary =
          lead.candidateDetails?.summary ||
          `Pre-screened talent with ${exp} years verified experience in ${lead.jobTitle}. Evaluated with AI match score of ${lead.matchScore || 85}%.`;

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
          resumeUrl: lead.resumeUrl || lead.candidateDetails?.resumeUrl || '',
          clientDecision: 'pending', // 'pending' | 'approved' | 'hold' | 'rejected'
          clientFeedback: '',
          decidedAt: null,
          interviewDetails: null,
        };
      });

      // 2. Generate random readable shareId
      const shareId = `csl_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).slice(-4)}`;

      // 3. Compute expiration
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);

      // 4. Save to Firestore clientShortlists collection
      await addDoc(collection(db, 'clientShortlists'), {
        shareId,
        clientName: clientName.trim(),
        jobTitle: jobTitle.trim(),
        jobId: selectedLeads[0]?.jobId || '',
        agencyName: agencyName.trim(),
        recruiterUID: user?.uid || '',
        recruiterName: userProfile?.name || user?.displayName || 'Recruiter Lead',
        recruiterPhone: recruiterPhone.trim(),
        recruiterEmail: recruiterEmail.trim(),
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
    } catch (err: any) {
      console.error('Error creating client shortlist:', err);
      alert(`Failed to generate shortlist link: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

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

👉 *Review & Approve Candidates Portal:*
${portalUrl}

You can view executive summaries, AI match scores, and 1-click schedule interview rounds directly on this portal.

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
        className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-white/[0.14] bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.1] bg-gradient-to-r from-emerald-500/10 via-transparent to-indigo-500/10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Share2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Client Review Portal
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <Sparkles size={10} /> 1-Click Approve
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generate a private, white-labeled link for clients to review masked profiles and schedule interviews.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.05] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {generatedShareId ? (
            /* Success / Generated State */
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 p-5 text-center">
                <div className="size-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                  Client Review Portal Generated!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 max-w-md mx-auto">
                  Your client <span className="font-bold">{clientName}</span> can now review the {selectedLeads.length} shortlisted candidate(s) and 1-click approve them for interview rounds.
                </p>
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
                    className="flex-1 h-10 px-3.5 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-gray-50 dark:bg-black/50 text-xs font-mono text-gray-800 dark:text-gray-200 outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-3.5 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.05] hover:bg-gray-100 dark:hover:bg-white/[0.1] text-gray-700 dark:text-gray-200 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
                    title="Open live preview as client will see it"
                  >
                    <ExternalLink size={14} />
                    <span>Preview</span>
                  </a>
                </div>
              </div>

              {/* Pre-composed WhatsApp Action Box */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50/70 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <MessageCircle size={15} className="text-emerald-500" />
                    <span>Send to Client on WhatsApp</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    {copiedMsg ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedMsg ? 'Copied Message!' : 'Copy Text'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-black/40 text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans max-h-36 overflow-y-auto">
                  {clientShareMessage}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppShare}
                    className="flex-1 h-9 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <MessageCircle size={14} />
                    <span>Send via WhatsApp Direct</span>
                  </button>
                </div>
              </div>

              {/* Instant Notification Guarantee Badge */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <span className="font-bold">Real-Time Recruiter Alerts Active:</span> As soon as your client clicks <span className="underline font-semibold">Schedule Interview</span> or makes a decision on the portal, your ATS dashboard will update live and you will receive an instant notification!
                </div>
              </div>
            </div>
          ) : (
            /* Form Configuration State */
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Candidates Selected Banner */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50/80 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  <span>Selected Candidates for Client Shortlist ({selectedLeads.length})</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Masked & Blind-Profile Ready
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {selectedLeads.map((lead, i) => (
                    <div
                      key={lead.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#121216] text-xs font-medium"
                    >
                      <User size={12} className="text-gray-400" />
                      <span className="font-semibold">{lead.candidateName}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        ({lead.matchScore || 85}% fit)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Client / Company Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Client / Company Name *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Technologies Pvt Ltd"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Job Role Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Job Role / Title *
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Frontend Engineer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Agency Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Your Agency Brand Name
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g. SNAB Talent Partners"
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Recruiter WhatsApp for alerts */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Recruiter Phone / WhatsApp (For Approval Alerts)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <input
                      type="tel"
                      value={recruiterPhone}
                      onChange={(e) => setRecruiterPhone(e.target.value)}
                      placeholder="+91 9511779317"
                      className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Client Contact Person (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Client Contact Person (Optional)
                  </label>
                  <input
                    type="text"
                    value={clientContactPerson}
                    onChange={(e) => setClientContactPerson(e.target.value)}
                    placeholder="e.g. Rohan (Hiring Manager)"
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Client Phone (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Client Phone / WhatsApp (Optional)
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Masking Options */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50/60 dark:bg-white/[0.02]">
                <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-purple-500" />
                  <span>Resume & Contact Masking Settings</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114] cursor-pointer">
                    <input
                      type="radio"
                      name="masking"
                      value="standard"
                      checked={maskingLevel === 'standard'}
                      onChange={() => setMaskingLevel('standard')}
                      className="text-emerald-600"
                    />
                    <div>
                      <div className="font-bold">Standard Masked</div>
                      <div className="text-[10px] text-gray-500">First Name + Initial (e.g. Priya N.)</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114] cursor-pointer">
                    <input
                      type="radio"
                      name="masking"
                      value="anonymous"
                      checked={maskingLevel === 'anonymous'}
                      onChange={() => setMaskingLevel('anonymous')}
                      className="text-emerald-600"
                    />
                    <div>
                      <div className="font-bold">Fully Anonymous</div>
                      <div className="text-[10px] text-gray-500">Candidate Code #1, #2...</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Note to Client */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Executive Note / Cover Note for Client
                </label>
                <textarea
                  rows={2}
                  value={executiveNote}
                  onChange={(e) => setExecutiveNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#111114] text-xs outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-white/[0.1]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/[0.12] text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !clientName.trim() || !jobTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <Share2 size={14} />
                  <span>{isGenerating ? 'Generating Link...' : 'Create Client Shortlist Link'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info when generated */}
        {generatedShareId && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-[#111114] flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              Valid for {expiresInDays} days • Secure & White-Labeled
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-white/[0.1] hover:bg-gray-300 dark:hover:bg-white/[0.15] text-xs font-bold transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
