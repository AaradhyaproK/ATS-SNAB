import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  Briefcase,
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  DollarSign,
  Clock,
  ArrowLeft,
  ArrowRight,
  Layers,
  FolderPlus,
  RefreshCw,
  X,
  Copy,
  Check,
  Building,
  Award,
  Ban
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';
import {
  parseResumeFileLocally,
  fastParseResumeFileLocally,
  deterministicParse,
  readResumeText,
  ingestResumeFile,
  saveResumeDumpCandidate,
  findExistingCandidateByContact,
  ExistingCandidateMatch,
  ParsedResumeProfile
} from '../services/resumeService';
import { uploadToCloudinary } from '../services/api';
import { LocationCityInput } from '../components/LocationCityInput';
import { EducationInput } from '../components/EducationInput';

type TabMode = 'upload' | 'manual' | 'bulk';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Any'];
const EMPLOYMENT_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const NOTICE_PERIOD_OPTIONS = [
  'Immediate',
  '15 Days',
  '30 Days',
  '45 Days',
  '60 Days',
  '90 Days',
  'Serving Notice',
  'More than 90 Days'
];

interface BulkFileItem {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'parsing' | 'saving' | 'done' | 'error';
  progressMsg?: string;
  candidateName?: string;
  error?: string;
}

export const AddCandidate: React.FC = () => {
  const { user, userProfile } = useAuth();
  const messageBox = useMessageBox();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabMode>('upload');

  // Single File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [parsedCandidate, setParsedCandidate] = useState<ParsedResumeProfile | null>(null);
  const [uploadedResumeUrl, setUploadedResumeUrl] = useState<string>('');
  const [rawResumeText, setRawResumeText] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [existingCandidateAlert, setExistingCandidateAlert] = useState<ExistingCandidateMatch | null>(null);

  // Manual Candidate Form State
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: 'Male',
    currentTitle: '',
    totalExperienceYears: '',
    experienceMonths: '0',
    location: '',
    state: 'Maharashtra',
    department: 'Production / Manufacturing',
    sector: 'Manufacturing / Engineering',
    employmentType: 'Full-time',
    skills: '',
    educationDegree: '',
    educationInstitution: '',
    educationYear: '',
    noticePeriod: 'Immediate',
    currentSalary: '',
    expectedSalary: '',
    summary: '',
    notes: ''
  });
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [isManualSaving, setIsManualSaving] = useState(false);

  // Bulk Upload State
  const [bulkQueue, setBulkQueue] = useState<BulkFileItem[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  // Success summary banner
  const [lastSavedCandidate, setLastSavedCandidate] = useState<{
    name: string;
    email: string;
    id?: string;
  } | null>(null);

  // Copied link state
  const [copiedUploadPortalLink, setCopiedUploadPortalLink] = useState(false);

  const recruiterUid = user?.uid || 'admin_user';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Single File Upload & Ingestion
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSingleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setProcessStep('Reading & extracting resume instantly...');
    setParsedCandidate(null);
    setUploadedResumeUrl('');
    setExistingCandidateAlert(null);

    try {
      // 1. FAST LOCAL EXTRACTION (< 150ms): Read text and parse deterministically
      const resumeText = await readResumeText(file, file.name);
      if (!resumeText) {
        throw new Error('No readable text was found in this resume.');
      }

      const textToAnalyze = additionalNotes.trim()
        ? `${resumeText}\n\n[Additional Candidate Details & Recruiter Notes]:\n${additionalNotes.trim()}`
        : resumeText;

      const profile = deterministicParse(textToAnalyze, file.name);
      if (additionalNotes.trim()) {
        profile.additionalText = additionalNotes.trim();
      }

      const initialEdu = profile.highestEducation || (Array.isArray(profile.education) && profile.education[0]?.degree) || '';

      // Immediately populate form state so the recruiter sees extracted details in ~150ms!
      setParsedCandidate({
        ...profile,
        gender: 'Any', // Set manually by recruiter
        totalExperienceYears: '' as any, // Entered manually by recruiter
        location: '', // Selected manually by recruiter
        city: '', // Selected manually by recruiter
        highestEducation: initialEdu
      });
      setRawResumeText(resumeText);
      setIsProcessing(false);
      setProcessStep('⚡ Extracted instantly! Review details and click Save to upload document.');

      // 2. Run Duplicate Check non-blockingly (asynchronously)
      const candEmail = (profile.email || '').trim().toLowerCase();
      const candPhone = (profile.phone || '').trim();

      if (candEmail || candPhone) {
        findExistingCandidateByContact(candEmail, candPhone)
          .then((duplicateMatch) => {
            if (duplicateMatch) {
              setExistingCandidateAlert(duplicateMatch);
            }
          })
          .catch((e) => console.warn('Duplicate check error:', e));
      }

      // 3. In the background, run fast enricher (existing dump lookup or smart skill enrichment)
      fastParseResumeFileLocally(file, {}, additionalNotes)
        .then((fastResult) => {
          if (!fastResult?.profile) return;
          const enriched = fastResult.profile;
          setParsedCandidate((prev) => {
            if (!prev) return prev;
            const currentSkills = new Set((prev.skills || []).map((s) => s.toLowerCase()));
            const addedSkills = (enriched.skills || []).filter((s) => !currentSkills.has(s.toLowerCase()));
            const newEdu =
              prev.highestEducation ||
              enriched.highestEducation ||
              (Array.isArray(enriched.education) && enriched.education[0]?.degree) ||
              '';

            return {
              ...prev,
              name: prev.name || enriched.name,
              email: prev.email || enriched.email,
              phone: prev.phone || enriched.phone,
              currentTitle: prev.currentTitle || enriched.currentTitle,
              highestEducation: newEdu,
              summary: prev.summary || enriched.summary,
              skills: addedSkills.length > 0 ? [...(prev.skills || []), ...addedSkills] : prev.skills,
              experience: (prev.experience && prev.experience.length > 0) ? prev.experience : enriched.experience,
              education: (prev.education && prev.education.length > 0) ? prev.education : enriched.education
            };
          });
        })
        .catch((e) => {
          console.warn('Background enrichment skipped:', e);
        });

    } catch (err: any) {
      console.error('Resume parsing failed:', err);
      messageBox.showError(`Parsing failed: ${err.message || 'Could not parse document'}`);
      setIsProcessing(false);
    }
  };

  const handleSaveParsedCandidate = async () => {
    if (!parsedCandidate) return;
    if (!parsedCandidate.name?.trim()) {
      messageBox.showError('Please enter candidate name before saving.');
      return;
    }

    setIsProcessing(true);

    try {
      let finalResumeUrl = uploadedResumeUrl;

      // Upload to Cloudinary ONLY when clicking Save
      if (!finalResumeUrl && selectedFile) {
        setProcessStep('Uploading resume document to secure Cloudinary storage...');
        finalResumeUrl = await uploadToCloudinary(selectedFile, 'auto');
        setUploadedResumeUrl(finalResumeUrl);
      }

      setProcessStep('Saving to candidate database...');
      const savedCandidateId = await saveResumeDumpCandidate({
        recruiterUID: recruiterUid,
        teamId: (userProfile as any)?.teamId || undefined,
        createdBy: user ? {
          uid: user.uid,
          name: userProfile?.fullname || user.displayName || 'Recruiter',
          email: user.email || '',
          role: userProfile?.role || 'recruiter'
        } : undefined,
        profile: {
          ...parsedCandidate,
          gender: parsedCandidate.gender || 'Any',
          totalExperienceYears:
            typeof parsedCandidate.totalExperienceYears === 'number'
              ? parsedCandidate.totalExperienceYears
              : parseFloat(parsedCandidate.totalExperienceYears as any) || 0,
          location: parsedCandidate.location || parsedCandidate.city || '',
          city: parsedCandidate.location || parsedCandidate.city || '',
          departments: parsedCandidate.department ? [parsedCandidate.department] : [],
          sectors: parsedCandidate.sector ? [parsedCandidate.sector] : []
        },
        resumeText: rawResumeText,
        resumeUrl: finalResumeUrl,
        fileName: selectedFile?.name || 'resume.pdf',
        mimeType: selectedFile?.type,
        fileSize: selectedFile?.size,
        additionalText: additionalNotes,
        source: 'resume_dump'
      });

      setLastSavedCandidate({
        name: parsedCandidate.name || 'Candidate',
        email: parsedCandidate.email || '',
        id: typeof savedCandidateId === 'string' ? savedCandidateId : undefined
      });

      messageBox.showSuccess(`Candidate "${parsedCandidate.name}" saved successfully to resume pool!`);
      // Reset upload pane
      setSelectedFile(null);
      setParsedCandidate(null);
      setUploadedResumeUrl('');
      setRawResumeText('');
      setAdditionalNotes('');
    } catch (err: any) {
      console.error('Error saving candidate:', err);
      messageBox.showError(`Failed to save candidate: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Manual Candidate Form Submission
  // ─────────────────────────────────────────────────────────────────────────────
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.name.trim()) {
      messageBox.showError('Candidate Full Name is required.');
      return;
    }

    setIsManualSaving(true);
    try {
      let resumeUrl = '';
      let resumeText = manualForm.summary || manualForm.notes || '';
      let fileName = '';
      let fileSize = 0;
      let mimeType = '';

      if (manualFile) {
        const uploadResult = await ingestResumeFile(manualFile, {}, '', manualForm.notes);
        resumeUrl = uploadResult.resumeUrl;
        resumeText = uploadResult.resumeText || resumeText;
        fileName = manualFile.name;
        fileSize = manualFile.size;
        mimeType = manualFile.type;
      }

      const skillsArray = manualForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const expYearsNum = parseFloat(manualForm.totalExperienceYears) || 0;
      const expMonthsNum = parseInt(manualForm.experienceMonths, 10) || 0;
      const combinedExp = expYearsNum + (expMonthsNum / 12);

      const profilePayload: ParsedResumeProfile = {
        name: manualForm.name.trim(),
        email: manualForm.email.trim(),
        phone: manualForm.phone.trim(),
        gender: manualForm.gender,
        currentTitle: manualForm.currentTitle.trim(),
        totalExperienceYears: Number(combinedExp.toFixed(1)),
        experienceYears: expYearsNum,
        experienceMonths: expMonthsNum,
        location: manualForm.location.trim(),
        city: manualForm.location.trim(),
        state: manualForm.state.trim(),
        department: manualForm.department,
        departments: [manualForm.department],
        sector: manualForm.sector,
        sectors: [manualForm.sector],
        employmentType: manualForm.employmentType,
        skills: skillsArray,
        summary: manualForm.summary.trim(),
        highestEducation: manualForm.educationDegree.trim(),
        education: manualForm.educationDegree.trim()
          ? [
              {
                degree: manualForm.educationDegree.trim(),
                institution: manualForm.educationInstitution.trim(),
                year: manualForm.educationYear.trim()
              }
            ]
          : [],
        experience: [],
        certifications: [],
        languages: [],
        keywords: skillsArray,
        linkedinUrl: '',
        portfolioUrl: '',
        currentSalary: manualForm.currentSalary.trim(),
        expectedSalary: manualForm.expectedSalary.trim(),
        noticePeriod: manualForm.noticePeriod.trim(),
        parsingMethod: 'deterministic',
        parserVersion: 1
      };

      const savedCandidateId = await saveResumeDumpCandidate({
        recruiterUID: recruiterUid,
        teamId: (userProfile as any)?.teamId || undefined,
        createdBy: user ? {
          uid: user.uid,
          name: userProfile?.fullname || user.displayName || 'Recruiter',
          email: user.email || '',
          role: userProfile?.role || 'recruiter'
        } : undefined,
        profile: profilePayload,
        resumeText,
        resumeUrl,
        fileName: fileName || 'manual_profile.txt',
        mimeType: mimeType || 'text/plain',
        fileSize: fileSize || 0,
        additionalText: manualForm.notes.trim(),
        source: 'resume_dump'
      });

      setLastSavedCandidate({
        name: manualForm.name,
        email: manualForm.email,
        id: typeof savedCandidateId === 'string' ? savedCandidateId : undefined
      });

      messageBox.showSuccess(`Candidate "${manualForm.name}" registered successfully!`);

      // Reset form
      setManualForm({
        name: '',
        email: '',
        phone: '',
        gender: 'Male',
        currentTitle: '',
        totalExperienceYears: '',
        experienceMonths: '0',
        location: '',
        state: 'Maharashtra',
        department: 'Production / Manufacturing',
        sector: 'Manufacturing / Engineering',
        employmentType: 'Full-time',
        skills: '',
        educationDegree: '',
        educationInstitution: '',
        educationYear: '',
        noticePeriod: 'Immediate',
        currentSalary: '',
        expectedSalary: '',
        summary: '',
        notes: ''
      });
      setManualFile(null);
    } catch (err: any) {
      console.error('Manual candidate registration error:', err);
      messageBox.showError(`Registration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsManualSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Bulk Upload Queue Handler
  // ─────────────────────────────────────────────────────────────────────────────
  const handleBulkFilesAdded = (files: FileList) => {
    const newItems: BulkFileItem[] = Array.from(files).map((f) => ({
      file: f,
      id: `${f.name}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'pending'
    }));
    setBulkQueue((prev) => [...prev, ...newItems]);
  };

  const processBulkQueue = async () => {
    if (bulkQueue.length === 0 || isBulkProcessing) return;
    setIsBulkProcessing(true);

    let successCount = 0;
    const items = [...bulkQueue];

    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'done') continue;

      items[i].status = 'uploading';
      items[i].progressMsg = 'Uploading & parsing...';
      setBulkQueue([...items]);

      try {
        const result = await ingestResumeFile(items[i].file, {}, '', '');
        items[i].candidateName = result.profile.name || 'Candidate';
        items[i].status = 'saving';
        items[i].progressMsg = 'Saving to database...';
        setBulkQueue([...items]);

        await saveResumeDumpCandidate({
          recruiterUID: recruiterUid,
          teamId: (userProfile as any)?.teamId || undefined,
          createdBy: user ? {
            uid: user.uid,
            name: userProfile?.fullname || user.displayName || 'Recruiter',
            email: user.email || '',
            role: userProfile?.role || 'recruiter'
          } : undefined,
          profile: result.profile,
          resumeText: result.resumeText,
          resumeUrl: result.resumeUrl,
          fileName: items[i].file.name,
          mimeType: items[i].file.type,
          fileSize: items[i].file.size,
          source: 'resume_dump'
        });

        items[i].status = 'done';
        items[i].progressMsg = 'Successfully added!';
        successCount++;
        setBulkQueue([...items]);
      } catch (err: any) {
        items[i].status = 'error';
        items[i].error = err.message || 'Failed';
        setBulkQueue([...items]);
      }
    }

    setIsBulkProcessing(false);
    messageBox.showSuccess(`Batch processing completed! ${successCount} candidates ingested.`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#000] text-white font-sans">
      {/* ── 1. Top Header Section (Matches RecruiterAllJobs / All Jobs style) ── */}
      <section className="shrink-0 border-b border-white/[0.11] bg-[#000]">
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-7 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link
              to="/recruiter/jobs"
              className="geist-caption inline-flex h-8 items-center gap-2 rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 font-medium text-[#d4d4d4] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <h1 className="geist-page-title mt-2 text-white">Add Candidate & Resume</h1>
            <p className="geist-small mt-1 text-[#8f8f8f]">
              Register candidate profiles with standardized city, education, department, and experience selectors for automated job matching.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/#/upload-resume`);
                setCopiedUploadPortalLink(true);
                setTimeout(() => setCopiedUploadPortalLink(false), 2500);
              }}
              className="geist-caption inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 font-medium text-[#d4d4d4] transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
              title="Copy candidate public upload link"
            >
              {copiedUploadPortalLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUploadPortalLink ? 'Link Copied!' : 'Copy Portal Link'}</span>
            </button>

            <Link
              to="/recruiter/resume-dump"
              className="geist-caption inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 font-medium text-[#d4d4d4] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <FileText className="w-3.5 h-3.5 text-[#9ca3af]" />
              <span>Resume Dump</span>
            </Link>

            <Link
              to="/recruiter/all-jobs"
              className="geist-caption inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-white bg-white px-3 font-semibold text-black transition-colors hover:bg-[#eaeaea]"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>All Jobs</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Mode Selector Toolbar Strip ── */}
      <section className="shrink-0 border-b border-white/[0.11] px-4 py-3 sm:px-6 lg:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[6px] border border-white/[0.11] bg-white/[0.03] p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`geist-caption inline-flex h-7 items-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-white/[0.12] text-white font-semibold'
                    : 'text-[#6b7280] hover:text-[#d4d4d4]'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Resume (AI Parse)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`geist-caption inline-flex h-7 items-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors cursor-pointer ${
                  activeTab === 'manual'
                    ? 'bg-white/[0.12] text-white font-semibold'
                    : 'text-[#6b7280] hover:text-[#d4d4d4]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Manual Candidate Entry</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bulk')}
                className={`geist-caption inline-flex h-7 items-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors cursor-pointer ${
                  activeTab === 'bulk'
                    ? 'bg-white/[0.12] text-white font-semibold'
                    : 'text-[#6b7280] hover:text-[#d4d4d4]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bulk Upload ({bulkQueue.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#8f8f8f]">
            <span className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 border border-white/[0.08] bg-white/[0.02]">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Standardized selectors enabled for City, Education, Department & Gender matching</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── 3. Main Body Workspace ── */}
      <main className="flex-1 p-4 sm:p-6 lg:p-7 space-y-6">
        {/* Success Banner */}
        {lastSavedCandidate && (
          <div className="rounded-[8px] border border-emerald-500/30 bg-[#071a12] p-4 text-[#83d0a3] flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="geist-caption text-xs sm:text-sm">
                <strong className="text-white font-semibold">{lastSavedCandidate.name}</strong> added to the hiring database!
                {lastSavedCandidate.email && (
                  <span className="opacity-80 ml-1.5 text-xs">({lastSavedCandidate.email})</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/recruiter/resume-dump"
                className="geist-caption inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-white underline underline-offset-4"
              >
                <span>Open in Resume Dump</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <button
                type="button"
                onClick={() => setLastSavedCandidate(null)}
                className="text-emerald-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: Smart Resume Upload & Parsing                                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload Zone */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-[8px] border border-white/[0.11] bg-white/[0.02] p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="geist-small inline-flex items-center gap-1.5 rounded-[4px] bg-white/[0.04] border border-white/[0.08] px-2.5 py-0.5 text-xs text-[#d4d4d4]">
                    Single Document
                  </span>
                  <span className="geist-small inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-0.5 font-mono text-xs border border-[#0e2f22] bg-[#071a12] text-[#83d0a3]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#50e3c2] animate-pulse" />
                    AI Ready
                  </span>
                </div>

                <h2 className="geist-section-title text-base font-semibold text-white mt-1">
                  Upload Resume Document
                </h2>
                <p className="geist-small text-xs text-[#8f8f8f] mt-1 mb-4 leading-relaxed">
                  Supports PDF, DOCX, DOC, or TXT. AI will automatically extract details and upload to secure Cloudinary storage.
                </p>

                {/* Drop Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleSingleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-[8px] p-8 text-center cursor-pointer transition-all ${
                    isProcessing
                      ? 'border-blue-400 bg-blue-500/5 cursor-wait'
                      : 'border-white/[0.15] hover:border-white/[0.35] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleSingleFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center py-5 space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                      <p className="geist-caption text-xs font-medium text-blue-400">{processStep}</p>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                      <FileText className="w-10 h-10 text-blue-400" />
                      <p className="geist-caption text-sm font-semibold text-white truncate max-w-[260px]">
                        {selectedFile.name}
                      </p>
                      <p className="geist-small text-xs text-[#8f8f8f]">
                        {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to replace file
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white mb-1">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="geist-caption text-sm font-medium text-white">Click or drag resume here</p>
                      <p className="geist-small text-xs text-[#8f8f8f]">PDF, DOCX, DOC, or TXT (Max 15MB)</p>
                    </div>
                  )}
                </div>

                {/* Optional Recruiter Notes */}
                <div className="mt-4">
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1.5 font-semibold">
                    Optional Recruiter Notes / Initial Comments
                  </label>
                  <textarea
                    rows={3}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="E.g., Referred by John, immediate joiner, target salary 12 LPA..."
                    className="geist-caption w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] p-2.5 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Extracted Profile Review Panel */}
            <div className="lg:col-span-7">
              <div className="rounded-[8px] border border-white/[0.11] bg-white/[0.02] p-5 sm:p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h2 className="geist-section-title text-base font-semibold text-white">
                        Extracted Candidate Profile
                      </h2>
                    </div>
                    {parsedCandidate && (
                      <span className="geist-small inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-0.5 font-mono text-xs border border-[#0e2f22] bg-[#071a12] text-[#83d0a3]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#50e3c2]" />
                        Ready to Save
                      </span>
                    )}
                  </div>

                  {!parsedCandidate ? (
                    <div className="py-20 text-center text-[#8f8f8f]">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#6b7280]">
                        <FileText className="w-7 h-7" />
                      </div>
                      <p className="geist-caption text-sm font-medium text-white">
                        Upload a resume to automatically extract candidate details
                      </p>
                      <p className="geist-small text-xs mt-1 text-[#6b7280] max-w-sm mx-auto">
                        AI will automatically extract candidate name, contact info, location, education, and technical skills from the uploaded resume.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 geist-caption">
                      {/* Name */}
                      <div>
                        <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={parsedCandidate.name || ''}
                          onChange={(e) => setParsedCandidate({ ...parsedCandidate, name: e.target.value })}
                          className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                        />
                      </div>

                      {/* Email & Phone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={parsedCandidate.email || ''}
                            onChange={(e) => setParsedCandidate({ ...parsedCandidate, email: e.target.value })}
                            className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                          />
                        </div>
                        <div>
                          <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={parsedCandidate.phone || ''}
                            onChange={(e) => setParsedCandidate({ ...parsedCandidate, phone: e.target.value })}
                            className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                          />
                        </div>
                      </div>

                      {/* Gender & Total Experience (Manual Input) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold flex items-center justify-between">
                            <span>Gender (for Requirement Matching)</span>
                            <span className="text-[10px] text-amber-400 font-normal lowercase tracking-normal">manual input</span>
                          </label>
                          <select
                            value={parsedCandidate.gender || 'Any'}
                            onChange={(e) => setParsedCandidate({ ...parsedCandidate, gender: e.target.value })}
                            className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white outline-none focus:border-white/[0.28] focus:bg-white/[0.05] cursor-pointer"
                          >
                            {GENDER_OPTIONS.map((g) => (
                              <option key={g} value={g} className="bg-[#111] text-white">
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold flex items-center justify-between">
                            <span>Total Experience (Years)</span>
                            <span className="text-[10px] text-amber-400 font-normal lowercase tracking-normal">manual input</span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={
                              parsedCandidate.totalExperienceYears !== undefined &&
                              parsedCandidate.totalExperienceYears !== null &&
                              parsedCandidate.totalExperienceYears !== ('' as any)
                                ? parsedCandidate.totalExperienceYears
                                : ''
                            }
                            onChange={(e) =>
                              setParsedCandidate({
                                ...parsedCandidate,
                                totalExperienceYears: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0
                              })
                            }
                            placeholder="Enter total experience (e.g. 2.5)"
                            className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                          />
                        </div>
                      </div>

                      {/* Location (LocationCityInput - Manual Selection) */}
                      <div>
                        <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold flex items-center justify-between">
                          <span>City / Location (Matches Strict Location)</span>
                          <span className="text-[10px] text-amber-400 font-normal lowercase tracking-normal">manual input</span>
                        </label>
                        <LocationCityInput
                          value={parsedCandidate.location || parsedCandidate.city || ''}
                          onChange={(val) =>
                            setParsedCandidate({
                              ...parsedCandidate,
                              location: val,
                              city: val
                            })
                          }
                          placeholder="Search and select candidate city (e.g. Nashik, Pune, Mumbai...)"
                          className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                        />
                      </div>

                      {/* Highest Education Degree (EducationInput) */}
                      <div>
                        <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                          Highest Education (Matches Job Degree)
                        </label>
                        <EducationInput
                          value={
                            parsedCandidate.highestEducation ||
                            (Array.isArray(parsedCandidate.education) && parsedCandidate.education[0]?.degree) ||
                            ''
                          }
                          onChange={(val) =>
                            setParsedCandidate({
                              ...parsedCandidate,
                              highestEducation: val,
                              education: [
                                {
                                  degree: val,
                                  institution: parsedCandidate.education?.[0]?.institution || '',
                                  year: parsedCandidate.education?.[0]?.year || ''
                                }
                              ]
                            })
                          }
                          className="w-full"
                          selectClassName="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-2.5 text-xs text-white outline-none focus:border-white/[0.28] focus:bg-white/[0.05] cursor-pointer"
                        />
                      </div>

                      {/* Skills */}
                      <div>
                        <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                          Key Skills (Comma separated)
                        </label>
                        <input
                          type="text"
                          value={(parsedCandidate.skills || []).join(', ')}
                          onChange={(e) =>
                            setParsedCandidate({
                              ...parsedCandidate,
                              skills: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                            })
                          }
                          className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                        />
                      </div>

                      {/* Summary */}
                      <div>
                        <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                          Summary / Highlights
                        </label>
                        <textarea
                          rows={3}
                          value={parsedCandidate.summary || ''}
                          onChange={(e) => setParsedCandidate({ ...parsedCandidate, summary: e.target.value })}
                          className="geist-caption w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] p-2.5 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                        />
                      </div>

                      {selectedFile && (
                        <div className="p-3 rounded-[6px] border border-white/[0.08] bg-white/[0.03] flex items-center justify-between">
                          <span className="geist-small text-xs text-[#8f8f8f] flex items-center gap-1.5">
                            {uploadedResumeUrl ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Uploaded to Cloudinary</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span>
                                  Document attached: <strong className="text-white">{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(0)} KB) — <span className="text-amber-400/90 font-medium">uploads to Cloudinary on Save</span>
                                </span>
                              </>
                            )}
                          </span>
                          {uploadedResumeUrl && (
                            <a
                              href={uploadedResumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="geist-caption text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <span>View Cloud Document</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {parsedCandidate && (
                  <div className="pt-4 border-t border-white/[0.08] mt-4 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setParsedCandidate(null);
                        setSelectedFile(null);
                      }}
                      className="geist-caption inline-flex h-9 items-center justify-center rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-4 font-medium text-[#d4d4d4] text-xs transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleSaveParsedCandidate}
                      className="geist-caption inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-white bg-white px-5 font-semibold text-black text-xs transition-colors hover:bg-[#eaeaea] shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Save Candidate to Database</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: Manual Candidate Entry Form                                  */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'manual' && (
          <form
            onSubmit={handleManualSubmit}
            className="rounded-[8px] border border-white/[0.11] bg-white/[0.02] p-5 sm:p-7 shadow-sm space-y-6 max-w-5xl"
          >
            <div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-white" />
                <h2 className="geist-section-title text-base font-semibold text-white">
                  Register Candidate Profile Manually
                </h2>
              </div>
              <p className="geist-small text-xs text-[#8f8f8f] mt-0.5">
                Fill in candidate details with matching selectors (City, Education, Department, Gender, Experience, Employment Type) so they automatically match job openings.
              </p>
            </div>

            {/* Section 1: Basic Identity */}
            <div className="space-y-3 pt-1 border-t border-white/[0.08]">
              <p className="geist-label uppercase text-[11px] text-[#6b7280] font-semibold tracking-wider pt-2">
                1. Personal Details & Identity
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Priya Sharma"
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="candidate@example.com"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Gender (Matching Requirement)
                  </label>
                  <select
                    value={manualForm.gender}
                    onChange={(e) => setManualForm({ ...manualForm, gender: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white outline-none focus:border-white/[0.28] focus:bg-white/[0.05] cursor-pointer"
                  >
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g} className="bg-[#111] text-white">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Professional Profile & Selectors */}
            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              <p className="geist-label uppercase text-[11px] text-[#6b7280] font-semibold tracking-wider">
                2. Professional Role, Department & Location (Key Matching Criteria)
              </p>
              <div className="grid grid-cols-1 gap-3.5">
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Current Designation / Role
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., Senior Frontend Engineer"
                    value={manualForm.currentTitle}
                    onChange={(e) => setManualForm({ ...manualForm, currentTitle: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
              </div>

              {/* LocationCityInput & Employment Type & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="lg:col-span-2">
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    City / Location (Typo-Tolerant Auto-Match)
                  </label>
                  <LocationCityInput
                    value={manualForm.location}
                    onChange={(val) => setManualForm({ ...manualForm, location: val })}
                    selectedState={manualForm.state}
                    onStateChange={(st) => setManualForm((prev) => ({ ...prev, state: st }))}
                    placeholder="Search city (e.g. Nashik, Ambad, Pune, Mumbai, Bangalore...)"
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>

                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Employment Type
                  </label>
                  <select
                    value={manualForm.employmentType}
                    onChange={(e) => setManualForm({ ...manualForm, employmentType: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white outline-none focus:border-white/[0.28] focus:bg-white/[0.05] cursor-pointer"
                  >
                    {EMPLOYMENT_TYPE_OPTIONS.map((et) => (
                      <option key={et} value={et} className="bg-[#111] text-white">
                        {et}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Total Experience
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Years"
                      value={manualForm.totalExperienceYears}
                      onChange={(e) => setManualForm({ ...manualForm, totalExperienceYears: e.target.value })}
                      className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-2 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                    />
                    <select
                      value={manualForm.experienceMonths}
                      onChange={(e) => setManualForm({ ...manualForm, experienceMonths: e.target.value })}
                      className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-1 text-xs text-white outline-none focus:border-white/[0.28] focus:bg-white/[0.05] cursor-pointer"
                    >
                      {[...Array(12).keys()].map((m) => (
                        <option key={m} value={m} className="bg-[#111] text-white">
                          {m} Mos
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notice Period & CTC */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Notice Period
                  </label>
                  <select
                    value={manualForm.noticePeriod}
                    onChange={(e) => setManualForm({ ...manualForm, noticePeriod: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white outline-none focus:border-white/[0.28] focus:bg-white/[0.05] cursor-pointer"
                  >
                    {NOTICE_PERIOD_OPTIONS.map((np) => (
                      <option key={np} value={np} className="bg-[#111] text-white">
                        {np}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Current CTC / Salary
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., 6 LPA or ₹50,000 / month"
                    value={manualForm.currentSalary}
                    onChange={(e) => setManualForm({ ...manualForm, currentSalary: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Expected CTC / Salary
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., 9 LPA or ₹75,000 / month"
                    value={manualForm.expectedSalary}
                    onChange={(e) => setManualForm({ ...manualForm, expectedSalary: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Skills, Education & Resume File */}
            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              <p className="geist-label uppercase text-[11px] text-[#6b7280] font-semibold tracking-wider">
                3. Education, Skills & Document Attachment
              </p>

              {/* EducationInput Component */}
              <div>
                <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                  Highest Education Qualification & Specialization (Matches Job Education)
                </label>
                <EducationInput
                  value={manualForm.educationDegree}
                  onChange={(val) => setManualForm({ ...manualForm, educationDegree: val })}
                  className="w-full"
                  selectClassName="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-2.5 text-xs text-white outline-none focus:border-white/[0.28] focus:bg-white/[0.05] cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    University / College / Institute
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., Savitribai Phule Pune University"
                    value={manualForm.educationInstitution}
                    onChange={(e) => setManualForm({ ...manualForm, educationInstitution: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
                <div>
                  <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                    Year of Completion
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., 2023"
                    value={manualForm.educationYear}
                    onChange={(e) => setManualForm({ ...manualForm, educationYear: e.target.value })}
                    className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1 font-semibold">
                  Key Technical & Professional Skills * (Matches Job Skills)
                </label>
                <input
                  type="text"
                  placeholder="React, TypeScript, Node.js, AWS, Tailwind CSS (comma separated)"
                  value={manualForm.skills}
                  onChange={(e) => setManualForm({ ...manualForm, skills: e.target.value })}
                  className="geist-caption h-9 w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                />
              </div>

              {/* Resume File Upload */}
              <div>
                <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1.5 font-semibold">
                  Attach Resume Document (Optional)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={manualFileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setManualFile(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => manualFileInputRef.current?.click()}
                    className="geist-caption inline-flex h-8 items-center gap-2 rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs font-medium text-[#d4d4d4] transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{manualFile ? 'Change File' : 'Choose Document'}</span>
                  </button>
                  {manualFile && (
                    <span className="geist-caption text-xs text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        {manualFile.name} ({(manualFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="geist-label text-xs uppercase text-[#8f8f8f] block mb-1.5 font-semibold">
                  Recruiter Remarks / Candidate Summary
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of background, interview feedback, or initial notes..."
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="geist-caption w-full rounded-[6px] border border-white/[0.11] bg-white/[0.03] p-2.5 text-xs text-white placeholder:text-[#6b7280] focus:border-white/[0.28] focus:bg-white/[0.05] outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isManualSaving}
                className="geist-caption inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-white bg-white px-5 font-semibold text-black text-xs transition-colors hover:bg-[#eaeaea] shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isManualSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Create Candidate Profile</span>
              </button>
            </div>
          </form>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 3: Bulk Resumes Batch Ingestion                                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'bulk' && (
          <div className="space-y-6">
            <div className="rounded-[8px] border border-white/[0.11] bg-white/[0.02] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-white" />
                    <h2 className="geist-section-title text-base font-semibold text-white">
                      Bulk Resumes Batch Ingestion
                    </h2>
                  </div>
                  <p className="geist-small text-xs text-[#8f8f8f] mt-0.5">
                    Drop multiple resumes. Each file will be parsed via AI and saved to your candidate pool sequentially.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={bulkInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleBulkFilesAdded(e.target.files);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => bulkInputRef.current?.click()}
                    className="geist-caption inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-white/[0.11] bg-white/[0.03] px-3 text-xs font-medium text-[#d4d4d4] transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Resumes</span>
                  </button>

                  {bulkQueue.length > 0 && (
                    <button
                      type="button"
                      disabled={isBulkProcessing}
                      onClick={processBulkQueue}
                      className="geist-caption inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-white bg-white px-4 font-semibold text-black text-xs transition-colors hover:bg-[#eaeaea] shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isBulkProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FolderPlus className="w-3.5 h-3.5" />
                      )}
                      <span>
                        Start Batch Ingestion ({bulkQueue.filter((b) => b.status === 'pending').length})
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bulk Queue Table / Drop area */}
              {bulkQueue.length === 0 ? (
                <div
                  onClick={() => bulkInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files) handleBulkFilesAdded(e.dataTransfer.files);
                  }}
                  className="border-2 border-dashed border-white/[0.15] hover:border-white/[0.35] bg-white/[0.02] hover:bg-white/[0.04] rounded-[8px] p-12 text-center cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white mx-auto mb-2">
                    <Layers className="w-6 h-6" />
                  </div>
                  <p className="geist-caption text-sm font-medium text-white">Click or drag multiple resumes here</p>
                  <p className="geist-small text-xs text-[#8f8f8f] mt-1">Select 5, 10, or 50 resumes at once</p>
                </div>
              ) : (
                <div className="rounded-[8px] border border-white/[0.11] overflow-hidden">
                  <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.08]">
                    {bulkQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 sm:px-4 flex items-center justify-between text-xs gap-3 bg-white/[0.01]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[#6b7280] font-mono w-5">{idx + 1}.</span>
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="geist-caption font-medium text-white truncate max-w-xs">
                              {item.file.name}
                            </p>
                            <p className="geist-small text-[10px] text-[#6b7280]">
                              {(item.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {item.candidateName && (
                            <span className="hidden sm:inline-block font-semibold text-white">
                              {item.candidateName}
                            </span>
                          )}

                          <span
                            className={`geist-small inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-0.5 font-mono text-[11px] ${
                              item.status === 'done'
                                ? 'border border-[#0e2f22] bg-[#071a12] text-[#83d0a3]'
                                : item.status === 'error'
                                ? 'border border-[#3f1d1d] bg-[#180707] text-[#ff8f8f]'
                                : item.status === 'uploading' || item.status === 'saving'
                                ? 'border border-blue-500/30 bg-blue-500/10 text-blue-400'
                                : 'border border-white/[0.08] bg-white/[0.04] text-[#8f8f8f]'
                            }`}
                          >
                            {item.status === 'done' && <span className="h-1.5 w-1.5 rounded-full bg-[#50e3c2]" />}
                            {item.status === 'uploading' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                            <span>{item.progressMsg || item.status}</span>
                          </span>

                          {item.status === 'pending' && !isBulkProcessing && (
                            <button
                              type="button"
                              onClick={() => setBulkQueue((prev) => prev.filter((b) => b.id !== item.id))}
                              className="text-[#8f8f8f] hover:text-red-400 p-1 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Existing Candidate Duplicate Alert Popup Modal ── */}
      {existingCandidateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-xl border border-amber-500/40 bg-[#0d0d0d] p-6 shadow-2xl">
            {/* Close icon button */}
            <button
              type="button"
              onClick={() => setExistingCandidateAlert(null)}
              className="absolute top-4 right-4 text-[#8f8f8f] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon + Title */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="geist-page-title text-base text-white">
                  Candidate Already Exists in Database!
                </h3>
                <p className="geist-small text-xs text-[#8f8f8f] mt-0.5">
                  A candidate record with matching contact details was found in your resume pool.
                </p>
              </div>
            </div>

            {/* Match Type Badge */}
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  {existingCandidateAlert.matchType === 'both'
                    ? 'Duplicate found: Matching both Email Address & Contact Phone'
                    : existingCandidateAlert.matchType === 'email'
                    ? `Duplicate found: Matching Email (${existingCandidateAlert.matchedEmail})`
                    : `Duplicate found: Matching Contact Phone (${existingCandidateAlert.matchedPhone})`}
                </span>
              </div>
            </div>

            {/* Ban Status Alert if Candidate is Banned */}
            {(existingCandidateAlert.candidate.isBlocked || existingCandidateAlert.candidate.isBanned) && (
              <div className="mb-4 p-3 rounded-[6px] border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>Candidate is BANNED:</strong> This candidate's email and phone number are permanently banned on this software. They will NOT receive any job recommendations or interview invites until unbanned.
                </span>
              </div>
            )}

            {/* Existing Candidate Details Card */}
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.03] p-4 space-y-2.5 mb-5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-[#8f8f8f] font-medium">Full Name</span>
                <span className="text-white font-semibold text-sm">{existingCandidateAlert.candidate.name || 'Candidate'}</span>
              </div>

              {existingCandidateAlert.candidate.email && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8f8f]">Registered Email</span>
                  <span className="text-[#d4d4d4] font-mono">{existingCandidateAlert.candidate.email}</span>
                </div>
              )}

              {existingCandidateAlert.candidate.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8f8f]">Contact Phone</span>
                  <span className="text-[#d4d4d4] font-mono">{existingCandidateAlert.candidate.phone}</span>
                </div>
              )}

              {existingCandidateAlert.candidate.location && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8f8f]">City / Location</span>
                  <span className="text-[#d4d4d4]">{existingCandidateAlert.candidate.location}</span>
                </div>
              )}

              {existingCandidateAlert.candidate.currentTitle && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8f8f]">Current Role / Title</span>
                  <span className="text-[#d4d4d4]">{existingCandidateAlert.candidate.currentTitle}</span>
                </div>
              )}

              {existingCandidateAlert.candidate.resumeUrl && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[#8f8f8f]">Attached Resume</span>
                  <a
                    href={existingCandidateAlert.candidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                  >
                    <span>View Existing Document</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setExistingCandidateAlert(null);
                  setSelectedFile(null);
                  setParsedCandidate(null);
                }}
                className="w-full sm:w-auto geist-caption h-9 px-3.5 rounded-[6px] border border-white/[0.11] bg-white/[0.03] text-xs font-medium text-[#d4d4d4] hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer"
              >
                Discard Upload
              </button>

              <a
                href={`/#/recruiter/resume-dump?search=${encodeURIComponent(existingCandidateAlert.candidate.email || existingCandidateAlert.candidate.phone || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto geist-caption h-9 px-3.5 rounded-[6px] border border-white/[0.18] bg-white/[0.08] text-xs font-medium text-white hover:bg-white/[0.14] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>View in Resume Dump</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => setExistingCandidateAlert(null)}
                className="w-full sm:w-auto geist-caption h-9 px-4 rounded-[6px] bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Continue & Review</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCandidate;
