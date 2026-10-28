import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  User,
  Briefcase,
  GraduationCap,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Edit3,
  BarChart3,
  Code,
  Target,
  Trophy,
  Save,
  Plus,
  X,
  FileText,
  Volume2,
  VolumeX,
  ExternalLink,
  Search,
  Filter,
  Check,
  Building2,
  ShieldCheck,
  UploadCloud,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Tag,
  Ban,
  Calendar,
  Download,
  Copy,
  Layers,
  Award,
  FileCheck,
  Share2,
  RefreshCw,
  Send,
  XCircle,
  UserCheck,
  MessageCircle,
  ArrowLeft,
  Bug,
  LockKeyhole,
  UserRound,
  Zap,
  Brain,
  Video,
  Mic,
  Sun,
  Moon,
  Info
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  arrayUnion
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import HireXLogo, { HireXMark } from '../components/HireXLogo';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../services/firebase';
import { calculateJobMatchScore, JobMatchResult, CandidateMatchProfile } from '../services/jobMatchService';
import { speak, stopSpeech } from '../lib/tts';
import { uploadToS3 } from '../services/s3Service';

export interface CandidatePortalProps {
  initialTab?: 'login' | 'dashboard';
}

const CANDIDATE_SESSION_KEY = 'snab_candidate_session';

const formatDisplayDate = (d: any) => {
  if (!d) return '';
  try {
    const dateObj = d?.toDate ? d.toDate() : new Date(d);
    return dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

export interface CandidateApplicationInfo {
  jobId: string;
  status: string;
  appliedAt?: any;
  statusUpdatedAt?: any;
  scheduledInterview?: {
    contactPerson?: string;
    date?: string;
    time?: string;
    mode?: string;
    location?: string;
    link?: string;
    notes?: string;
  };
  recruiterNotes?: string;
  matchScore?: number;
}

export const CandidatePortal: React.FC<CandidatePortalProps> = ({ initialTab }) => {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication State
  const [candidate, setCandidate] = useState<any>(() => {
    try {
      const stored = localStorage.getItem(CANDIDATE_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [emailInput, setEmailInput] = useState(() => {
    try {
      const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const params = new URLSearchParams(window.location.search || hashPart);
      return params.get('email') || '';
    } catch {
      return '';
    }
  });
  const [phonePasswordInput, setPhonePasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Express Job Invite / Auto-Fetch / 1-Tap Apply State ──
  const [autofetchLoading, setAutofetchLoading] = useState(false);
  const [autofetchedCandidate, setAutofetchedCandidate] = useState<any | null>(null);
  const [autofetchError, setAutofetchError] = useState<string | null>(null);
  const [autofetchNotFound, setAutofetchNotFound] = useState(false);
  const [targetJobData, setTargetJobData] = useState<any | null>(null);
  const targetJobId = useMemo(() => {
    try {
      const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const params = new URLSearchParams(location.search || hashPart || window.location.search);
      return params.get('job') || params.get('jobId') || '';
    } catch {
      return '';
    }
  }, [location.search]);
  const [targetJobLoading, setTargetJobLoading] = useState(false);
  const [showTargetJdModal, setShowTargetJdModal] = useState(false);
  const [isJdExpanded, setIsJdExpanded] = useState(false);
  const [isOneTapApplying, setIsOneTapApplying] = useState(false);
  const [oneTapApplySuccess, setOneTapApplySuccess] = useState<any | null>(null);
  const [targetJobAlreadyApplied, setTargetJobAlreadyApplied] = useState<CandidateApplicationInfo | null>(null);
  const [useLegacyLogin, setUseLegacyLogin] = useState(false);

  // Quick candidate profile fields in case candidate email has no prior resume
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickResumeFile, setQuickResumeFile] = useState<File | null>(null);
  const [isUploadingQuickResume, setIsUploadingQuickResume] = useState(false);

  // Active Tab inside Dashboard: 'dashboard' | 'matches' | 'applied' | 'assessments' | 'assessment-results' | 'resume' | 'edit-profile'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'matches' | 'applied' | 'assessments' | 'assessment-results' | 'resume' | 'edit-profile'>('dashboard');

  // Assessments & Assessment Results State
  const [candidateAssessments, setCandidateAssessments] = useState<any[]>([]);
  const [candidateSubmissions, setCandidateSubmissions] = useState<any[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [selectedScorecardSubmission, setSelectedScorecardSubmission] = useState<any>(null);
  const [assessmentFilter, setAssessmentFilter] = useState<'all' | 'aptitude' | 'coding'>('all');
  const [resultsFilter, setResultsFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [assessmentSearchQuery, setAssessmentSearchQuery] = useState('');

  // Stage filter inside 'applied' tab: 'all' | 'shortlisted' | 'under-review' | 'selected' | 'rejected'
  const [appliedStageFilter, setAppliedStageFilter] = useState<'all' | 'shortlisted' | 'under-review' | 'selected' | 'rejected'>('all');

  // Resume state
  const [previewResumeModalUrl, setPreviewResumeModalUrl] = useState<string | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [resumeUploadSuccess, setResumeUploadSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Matched Jobs State
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [searchJobQuery, setSearchJobQuery] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [matchFilter, setMatchFilter] = useState<'EligibleOnly' | 'All' | 'HighMatch' | 'LocalCity'>('EligibleOnly');
  const [selectedJobModal, setSelectedJobModal] = useState<JobMatchResult | null>(null);
  const hasDismissedJobModalRef = useRef(false);

  const [appliedJobIds, setAppliedJobIds] = useState<string[]>(() => {
    try {
      // Clean up legacy global applied storage key that leaked across different accounts
      localStorage.removeItem('snab_candidate_applied_jobs');
      const storedCandidate = localStorage.getItem(CANDIDATE_SESSION_KEY);
      const parsedCandidate = storedCandidate ? JSON.parse(storedCandidate) : null;
      const candEmail = (parsedCandidate?.email || parsedCandidate?.profile?.email || '').trim().toLowerCase();
      if (!candEmail) return [];
      const stored = localStorage.getItem(`snab_candidate_applied_jobs_${candEmail}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [appliedApplications, setAppliedApplications] = useState<Record<string, CandidateApplicationInfo>>({});
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  // Audio JD state
  const [playingJobId, setPlayingJobId] = useState<string | null>(null);

  // Profile Edit State
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    currentTitle: '',
    totalExperienceYears: '',
    skills: [] as string[],
    highestEducation: '',
    institution: '',
    graduationYear: '',
    location: '',
    preferredLocations: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: 'Immediate',
    summary: '',
    employmentTypes: [] as string[]
  });
  const [newSkillInput, setNewSkillInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Auto-redirect to Video Interview if mode=video or video=true is in URL
  useEffect(() => {
    try {
      const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const params = new URLSearchParams(window.location.search || hashPart);
      const isVideoMode = params.get('mode') === 'video' || params.get('video') === 'true' || params.get('video') === '1';
      const jobId = params.get('job') || params.get('jobId');
      if (isVideoMode && jobId) {
        const queryStr = window.location.search || (hashPart ? `?${hashPart}` : '');
        navigate(`/interview/video/${jobId}${queryStr}`, { replace: true });
      }
    } catch (e) {
      console.warn('Video mode check error', e);
    }
  }, [navigate]);

  // ── 1. Target Job Resolution for Job Invites ──
  useEffect(() => {
    const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const params = new URLSearchParams(location.search || hashPart || window.location.search);
    const resolvedTargetJobId = params.get('job') || params.get('jobId');
    if (!resolvedTargetJobId) {
      setTargetJobData(null);
      return;
    }

    const found = allJobs.find(j => j.id === resolvedTargetJobId || j.jobNo === resolvedTargetJobId || j.accessCode === resolvedTargetJobId);
    if (found) {
      setTargetJobData(found);
      return;
    }

    let isSubscribed = true;
    const fetchDirect = async () => {
      setTargetJobLoading(true);
      try {
        let snap: any = await getDoc(doc(db, 'interviews', resolvedTargetJobId));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'jobs', resolvedTargetJobId));
        }

        // Secondary fallback: query by accessCode or jobNo if resolvedTargetJobId was an access code
        if (!snap.exists()) {
          const cleanCode = resolvedTargetJobId.trim().toUpperCase();
          const cleanJobNo = resolvedTargetJobId.trim();

          const qIntAccess = query(collection(db, 'interviews'), where('accessCode', '==', cleanCode));
          let qSnap = await getDocs(qIntAccess).catch(() => null);

          if (!qSnap || qSnap.empty) {
            const qIntJobNo = query(collection(db, 'interviews'), where('jobNo', '==', cleanJobNo));
            qSnap = await getDocs(qIntJobNo).catch(() => null);
          }
          if (!qSnap || qSnap.empty) {
            const qJobsAccess = query(collection(db, 'jobs'), where('accessCode', '==', cleanCode));
            qSnap = await getDocs(qJobsAccess).catch(() => null);
          }
          if (!qSnap || qSnap.empty) {
            const qJobsJobNo = query(collection(db, 'jobs'), where('jobNo', '==', cleanJobNo));
            qSnap = await getDocs(qJobsJobNo).catch(() => null);
          }
          if (qSnap && !qSnap.empty) {
            snap = qSnap.docs[0];
          }
        }

        if (snap && snap.exists() && isSubscribed) {
          const d = snap.data();
          const parsedSkills = Array.isArray(d.skills)
            ? d.skills
            : (typeof d.skills === 'string'
              ? d.skills.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
              : []);

          const parsedSalary = d.salary || d.salaryRange ||
            (d.minSalary && d.maxSalary ? `₹${d.minSalary} - ₹${d.maxSalary}` : '') ||
            (d.minSalary ? `₹${d.minSalary}+` : '') ||
            'Competitive CTC';

          const parsedExp = d.experience ||
            (d.minExperience !== undefined && d.maxExperience !== undefined && (d.minExperience > 0 || d.maxExperience > 0)
              ? `${d.minExperience} - ${d.maxExperience} yrs`
              : (d.minExperience ? `${d.minExperience}+ yrs` : 'Fresher / Any Experience'));

          setTargetJobData({
            id: snap.id,
            title: d.title || 'Job Opening',
            company: d.company || d.companyName || 'Hiring Partner',
            location: d.location || (d.city && d.state ? `${d.city}, ${d.state}` : d.city || 'Remote / Hybrid'),
            city: d.city || d.location || 'Remote',
            state: d.state || '',
            experience: parsedExp,
            minExperience: d.minExperience,
            maxExperience: d.maxExperience,
            salary: parsedSalary,
            minSalary: d.minSalary,
            maxSalary: d.maxSalary,
            employmentType: d.employmentType || d.jobType || 'Full-Time',
            skills: parsedSkills,
            description: d.description || d.jobDescription || '',
            jobDescription: d.description || d.jobDescription || '',
            responsibilities: d.responsibilities || '',
            requirements: d.requirements || '',
            qualification: d.qualification || d.education || d.qualifications || 'Graduate / Relevant Degree',
            education: d.education || d.qualification || '',
            department: d.department || d.roleCategory || 'General',
            accessCode: d.accessCode || d.jobNo || snap.id.slice(0, 6).toUpperCase(),
            jobNo: d.jobNo || '',
            recruiterName: d.recruiterName || d.entryBy || 'Recruiting Desk',
            recruiterUID: d.recruiterUID || d.createdBy?.uid || '',
            teamId: d.teamId || '',
            interviewMode: d.interviewMode,
            interviewLink: d.interviewLink,
            deadline: d.deadlineDate || d.deadline || d.applyDeadline || '',
          });
        }
      } catch (err) {
        console.warn('Direct job fetch error:', err);
      } finally {
        if (isSubscribed) setTargetJobLoading(false);
      }
    };
    fetchDirect();
    return () => { isSubscribed = false; };
  }, [allJobs, location.search]);

  // ── 2. Auto-fetch Candidate Profile from Talent Vault ──
  useEffect(() => {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.') || cleanEmail.length < 5) {
      setAutofetchedCandidate(null);
      setAutofetchNotFound(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setAutofetchLoading(true);
      setAutofetchError(null);
      setAutofetchNotFound(false);

      try {
        let matchedCandidate: any = null;
        let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail))).catch(() => null);
        if (!snap || snap.empty) {
          snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanEmail))).catch(() => null);
        }
        if (!snap || snap.empty) {
          snap = await getDocs(query(collection(db, 'resumeDump'), where('email', '==', cleanEmail))).catch(() => null);
        }

        if (snap && !snap.empty) {
          let latestDocSnap = snap.docs[0];
          let latestTime = 0;
          for (const docSnap of snap.docs) {
            const d = docSnap.data();
            const t = d.updatedAt?.toMillis?.() || d.createdAt?.toMillis?.() || (d.updatedAt ? new Date(d.updatedAt).getTime() : 0) || 0;
            if (t >= latestTime) {
              latestTime = t;
              latestDocSnap = docSnap;
            }
          }
          const raw = latestDocSnap.data();
          matchedCandidate = {
            id: latestDocSnap.id,
            ...(raw.profile || {}),
            ...raw,
          };
        }

        // Query candidateApplications if not found
        if (!matchedCandidate) {
          const appSnap = await getDocs(query(collection(db, 'candidateApplications'), where('candidateEmail', '==', cleanEmail))).catch(() => null);
          if (appSnap && !appSnap.empty) {
            let latestDocSnap = appSnap.docs[0];
            let latestTime = 0;
            for (const docSnap of appSnap.docs) {
              const d = docSnap.data();
              const t = d.appliedAt?.toMillis?.() || d.createdAt?.toMillis?.() || 0;
              if (t >= latestTime) {
                latestTime = t;
                latestDocSnap = docSnap;
              }
            }
            const raw = latestDocSnap.data();
            matchedCandidate = {
              id: latestDocSnap.id,
              name: raw.candidateName,
              email: raw.candidateEmail,
              phone: raw.candidatePhone,
              resumeUrl: raw.resumeUrl || '',
              skills: raw.skills || [],
              highestEducation: raw.education || '',
              totalExperienceYears: raw.experience || 0,
              currentTitle: raw.currentTitle || raw.jobTitle || '',
            };
          }
        }

        // Query users collection if not found
        if (!matchedCandidate) {
          const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail))).catch(() => null);
          if (userSnap && !userSnap.empty) {
            const uDoc = userSnap.docs[0].data();
            matchedCandidate = {
              id: userSnap.docs[0].id,
              name: uDoc.displayName || uDoc.name || cleanEmail.split('@')[0],
              email: cleanEmail,
              phone: uDoc.phone || uDoc.phoneNumber || '',
              resumeUrl: uDoc.resumeUrl || '',
              skills: uDoc.skills || [],
            };
          }
        }

        if (!isMounted) return;

        if (matchedCandidate) {
          const prof = (matchedCandidate.profile && typeof matchedCandidate.profile === 'object') ? matchedCandidate.profile : {};
          const candidateProf = {
            id: matchedCandidate.id || 'cand_' + Date.now(),
            name: matchedCandidate.name || matchedCandidate.fullName || matchedCandidate.candidateName || prof.name || cleanEmail.split('@')[0],
            email: cleanEmail,
            phone: matchedCandidate.phone || matchedCandidate.candidatePhone || matchedCandidate.phoneNumber || prof.phone || '',
            resumeUrl: matchedCandidate.resumeUrl || matchedCandidate.cvUrl || matchedCandidate.fileUrl || prof.resumeUrl || '',
            resumeName: matchedCandidate.fileName || matchedCandidate.resumeName || (matchedCandidate.resumeUrl ? 'Verified_Resume.pdf' : ''),
            skills: Array.isArray(matchedCandidate.skills) ? matchedCandidate.skills : (Array.isArray(prof.skills) ? prof.skills : []),
            totalExperienceYears: matchedCandidate.totalExperienceYears || matchedCandidate.experienceYears || matchedCandidate.experience || prof.totalExperienceYears || 0,
            highestEducation: matchedCandidate.highestEducation || matchedCandidate.education || prof.highestEducation || '',
            currentTitle: matchedCandidate.currentTitle || matchedCandidate.role || matchedCandidate.jobTitle || prof.currentTitle || '',
            location: matchedCandidate.location || matchedCandidate.city || prof.location || '',
            summary: matchedCandidate.summary || prof.summary || '',
          };
          setAutofetchedCandidate(candidateProf);
          setQuickName(candidateProf.name);
          setQuickPhone(candidateProf.phone);

          // Check if already applied to the target job
          const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
          const params = new URLSearchParams(location.search || hashPart || window.location.search);
          const currentJobId = params.get('job') || params.get('jobId');

          if (currentJobId) {
            const existingAppSnap = await getDocs(
              query(collection(db, 'candidateApplications'), where('candidateEmail', '==', cleanEmail), where('jobId', '==', currentJobId))
            ).catch(() => null);
            if (existingAppSnap && !existingAppSnap.empty && isMounted) {
              const appData = existingAppSnap.docs[0].data();
              setTargetJobAlreadyApplied({
                jobId: currentJobId,
                status: appData.status || 'Under Review',
                appliedAt: appData.appliedAt,
                matchScore: appData.matchScore,
              });
            } else if (isMounted) {
              setTargetJobAlreadyApplied(null);
            }
          }
        } else {
          setAutofetchedCandidate(null);
          setAutofetchNotFound(true);
        }
      } catch (err: any) {
        console.warn('Auto-fetch lookup error:', err);
        if (isMounted) setAutofetchError('Could not verify profile from talent vault.');
      } finally {
        if (isMounted) setAutofetchLoading(false);
      }
    }, 280);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [emailInput, location.search]);

  // ── 3. Quick Resume File Upload for New Candidates ──
  const handleQuickResumeUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingQuickResume(true);
    setAutofetchError(null);
    try {
      const uploadRes = await uploadToS3(file, 'candidate_resumes');
      if (uploadRes && uploadRes.url) {
        setQuickResumeFile(file);
        setAutofetchedCandidate((prev: any) => ({
          ...(prev || {}),
          resumeUrl: uploadRes.url,
          resumeName: file.name,
        }));
      }
    } catch (err: any) {
      console.warn('Resume upload error:', err);
      setAutofetchError('Resume upload failed. You can proceed without resume or try again.');
    } finally {
      setIsUploadingQuickResume(false);
    }
  };

  // ── 4. One-Tap Application Submission ──
  const executeOneTapApply = async () => {
    const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const params = new URLSearchParams(location.search || hashPart || window.location.search);
    const currentJobId = params.get('job') || params.get('jobId') || targetJobData?.id;

    if (!currentJobId) {
      setAutofetchError('No target job specified to apply.');
      return;
    }

    const resolvedJob = targetJobData || { id: currentJobId, title: 'Job Opening' };
    const cleanEmail = (emailInput || autofetchedCandidate?.email || '').trim().toLowerCase();
    const cleanName = (quickName || autofetchedCandidate?.name || cleanEmail.split('@')[0] || 'Job Seeker').trim();
    const cleanPhone = (quickPhone || autofetchedCandidate?.phone || '').trim();
    let resumeUrl = autofetchedCandidate?.resumeUrl || '';

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAutofetchError('Please enter a valid email address.');
      return;
    }

    setIsOneTapApplying(true);
    setAutofetchError(null);

    try {
      // If user uploaded a new quick resume file
      if (quickResumeFile && !resumeUrl) {
        try {
          const uploadRes = await uploadToS3(quickResumeFile, 'candidate_resumes');
          if (uploadRes && uploadRes.url) {
            resumeUrl = uploadRes.url;
          }
        } catch (e) {
          console.warn('Quick resume upload failed, proceeding anyway:', e);
        }
      }

      // Calculate Match Score
      let overallScore = 88;
      let matchGrade = 'Recommended';
      if (autofetchedCandidate) {
        const prof: CandidateMatchProfile = {
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          currentTitle: autofetchedCandidate.currentTitle || '',
          skills: autofetchedCandidate.skills || [],
          experience: Number(autofetchedCandidate.totalExperienceYears) || 0,
          education: autofetchedCandidate.highestEducation || '',
          location: autofetchedCandidate.location || '',
          preferredLocations: [],
          summary: autofetchedCandidate.summary || '',
          employmentTypes: [],
        };
        const mRes = calculateJobMatchScore(resolvedJob, prof);
        if (mRes && typeof mRes.overallScore === 'number') {
          overallScore = mRes.overallScore;
          matchGrade = mRes.matchGrade;
        }
      }

      // 1. Add to candidateApplications
      const newAppRef = await addDoc(collection(db, 'candidateApplications'), {
        interviewId: currentJobId,
        jobId: currentJobId,
        jobTitle: resolvedJob.title || 'Job Opening',
        jobAccessCode: resolvedJob.accessCode || resolvedJob.jobNo || '',
        candidateId: autofetchedCandidate?.id || 'cand_' + Date.now(),
        candidateName: cleanName,
        candidateEmail: cleanEmail,
        candidatePhone: cleanPhone,
        resumeUrl,
        recruiterUID: resolvedJob.recruiterUID || '',
        teamId: resolvedJob.teamId || '',
        matchScore: overallScore,
        matchGrade,
        status: 'Under Review',
        appliedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        source: 'Recruiter Job Invite (1-Tap Apply)',
      });

      // 2. Add to jobApplications
      await addDoc(collection(db, 'jobApplications'), {
        jobId: currentJobId,
        interviewId: currentJobId,
        jobTitle: resolvedJob.title || 'Job Opening',
        jobAccessCode: resolvedJob.accessCode || resolvedJob.jobNo || '',
        candidateId: autofetchedCandidate?.id || '',
        candidateName: cleanName,
        candidateEmail: cleanEmail,
        candidatePhone: cleanPhone,
        resumeUrl,
        matchScore: overallScore,
        matchGrade,
        status: 'Under Review',
        appliedAt: serverTimestamp(),
        source: '1-Tap Apply',
      }).catch((e) => console.warn('jobApplications write note:', e));

      // 3. Update interviews candidateData
      try {
        const intRef = doc(db, 'interviews', currentJobId);
        await updateDoc(intRef, {
          candidateEmails: arrayUnion(cleanEmail),
          candidateData: arrayUnion({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            resumeUrl,
            appliedAt: new Date().toISOString(),
            status: 'interested',
            source: 'one_tap_apply',
          }),
        });
      } catch {
        // Not in interviews collection
      }

      // 4. Save Candidate Session & Authenticate Seamlessly
      const activeCandidateSession = {
        id: autofetchedCandidate?.id || newAppRef.id,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        resumeUrl,
        skills: autofetchedCandidate?.skills || [],
        totalExperienceYears: autofetchedCandidate?.totalExperienceYears || 0,
        highestEducation: autofetchedCandidate?.highestEducation || '',
        currentTitle: autofetchedCandidate?.currentTitle || '',
      };

      localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(activeCandidateSession));
      localStorage.setItem(`snab_candidate_applied_jobs_${cleanEmail}`, JSON.stringify([currentJobId]));

      setOneTapApplySuccess({
        jobTitle: resolvedJob.title || 'Job Opening',
        jobId: currentJobId,
        company: resolvedJob.company || 'Hiring Partner',
        matchScore: overallScore,
        candidateName: cleanName,
        candidateEmail: cleanEmail,
        hasInterview: Boolean(resolvedJob.accessCode || resolvedJob.interviewLink || resolvedJob.interviewMode),
      });

      setCandidate(activeCandidateSession);
      setAppliedJobIds((prev) => Array.from(new Set([...prev, currentJobId])));
      setAppliedApplications((prev) => ({
        ...prev,
        [currentJobId]: {
          jobId: currentJobId,
          status: 'Under Review',
          appliedAt: new Date().toISOString(),
          matchScore: overallScore,
        },
      }));
    } catch (err: any) {
      console.error('One-tap apply execution error:', err);
      setAutofetchError(err?.message || 'Failed to submit 1-tap application. Please try again.');
    } finally {
      setIsOneTapApplying(false);
    }
  };

  // Live Sync Candidate Profile from Firestore whenever candidate is logged in
  useEffect(() => {
    const candEmail = (candidate?.email || candidate?.profile?.email || '').trim().toLowerCase();
    if (!candEmail) return;

    let isMounted = true;
    const syncProfile = async () => {
      try {
        let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', candEmail))).catch(() => null);
        if (!snap || snap.empty) {
          snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', candEmail))).catch(() => null);
        }
        if (snap && !snap.empty && isMounted) {
          let latestDocSnap = snap.docs[0];
          let latestTime = 0;
          for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const t = data.updatedAt?.toMillis?.() || data.createdAt?.toMillis?.() || (data.updatedAt ? new Date(data.updatedAt).getTime() : 0) || 0;
            if (t >= latestTime) {
              latestTime = t;
              latestDocSnap = docSnap;
            }
          }
          const raw = latestDocSnap.data();
          const updatedCandidate = { id: latestDocSnap.id, ...(raw.profile || {}), ...raw };
          setCandidate((prev: any) => {
            const merged = { ...prev, ...updatedCandidate };
            try {
              localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      } catch (err) {
        console.warn('Candidate profile sync warning:', err);
      }
    };

    syncProfile();
    return () => { isMounted = false; };
  }, [candidate?.email]);

  // Populate Edit Form whenever candidate state changes
  useEffect(() => {
    if (candidate) {
      const prof = (candidate.profile && typeof candidate.profile === 'object') ? candidate.profile : {};
      const eduArr = Array.isArray(candidate.education) ? candidate.education : (Array.isArray(prof.education) ? prof.education : []);
      const firstEdu = eduArr.length > 0 ? eduArr[0] : null;

      const rawSkills = Array.isArray(candidate.skills)
        ? candidate.skills
        : Array.isArray(prof.skills)
        ? prof.skills
        : typeof candidate.skills === 'string'
        ? candidate.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      const rawExp = candidate.totalExperienceYears ?? candidate.experienceYears ?? candidate.experience ?? prof.totalExperienceYears ?? prof.experienceYears ?? prof.experience ?? '';

      setEditForm({
        name: candidate.name || prof.name || '',
        email: candidate.email || prof.email || '',
        phone: candidate.phone || prof.phone || '',
        currentTitle: candidate.currentTitle || prof.currentTitle || candidate.title || '',
        totalExperienceYears: rawExp !== undefined && rawExp !== null && rawExp !== '' ? String(rawExp) : '',
        skills: rawSkills,
        highestEducation: candidate.highestEducation || prof.highestEducation || firstEdu?.degree || (typeof candidate.education === 'string' ? candidate.education : ''),
        institution: firstEdu?.institution || firstEdu?.college || candidate.institution || '',
        graduationYear: firstEdu?.year || firstEdu?.gradYear || candidate.graduationYear || '',
        location: candidate.location || prof.location || candidate.city || '',
        preferredLocations: Array.isArray(candidate.preferredLocations)
          ? candidate.preferredLocations.join(', ')
          : candidate.preferredLocations || '',
        currentSalary: candidate.currentSalary || prof.currentSalary || '',
        expectedSalary: candidate.expectedSalary || prof.expectedSalary || '',
        noticePeriod: candidate.noticePeriod || prof.noticePeriod || 'Immediate',
        summary: candidate.summary || candidate.additionalText || prof.summary || '',
        employmentTypes: Array.isArray(candidate.employmentTypes)
          ? candidate.employmentTypes
          : (candidate.employmentType ? [candidate.employmentType] : ['Full-Time'])
      });
    }
  }, [candidate]);

  // Fetch actual applied jobs & status from Firestore for THIS specific logged-in candidate
  useEffect(() => {
    const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();
    if (!candEmail) {
      setAppliedJobIds([]);
      setAppliedApplications({});
      return;
    }

    let isMounted = true;

    const fetchAppliedJobs = async () => {
      try {
        const appliedSet = new Set<string>();
        const appMap: Record<string, CandidateApplicationInfo> = {};

        // 1. Query candidateApplications collection by candidateEmail
        const q1 = query(
          collection(db, 'candidateApplications'),
          where('candidateEmail', '==', candEmail)
        );
        const snap1 = await getDocs(q1).catch(() => null);
        if (snap1 && !snap1.empty) {
          snap1.docs.forEach(docSnap => {
            const data = docSnap.data();
            const jId = data.jobId || data.interviewId;
            if (jId) {
              appliedSet.add(jId);
              appMap[jId] = {
                jobId: jId,
                status: data.status || 'Under Review',
                appliedAt: data.appliedAt || data.createdAt,
                statusUpdatedAt: data.statusUpdatedAt,
                scheduledInterview: data.scheduledInterview,
                recruiterNotes: data.recruiterNotes,
                matchScore: data.matchScore,
              };
            }
          });
        }

        // 2. Query candidateApplications collection by email (fallback)
        const q1b = query(
          collection(db, 'candidateApplications'),
          where('email', '==', candEmail)
        );
        const snap1b = await getDocs(q1b).catch(() => null);
        if (snap1b && !snap1b.empty) {
          snap1b.docs.forEach(docSnap => {
            const data = docSnap.data();
            const jId = data.jobId || data.interviewId;
            if (jId) {
              appliedSet.add(jId);
              if (!appMap[jId] || data.status) {
                appMap[jId] = {
                  jobId: jId,
                  status: data.status || appMap[jId]?.status || 'Under Review',
                  appliedAt: data.appliedAt || data.createdAt || appMap[jId]?.appliedAt,
                  statusUpdatedAt: data.statusUpdatedAt || appMap[jId]?.statusUpdatedAt,
                  scheduledInterview: data.scheduledInterview || appMap[jId]?.scheduledInterview,
                  recruiterNotes: data.recruiterNotes || appMap[jId]?.recruiterNotes,
                  matchScore: data.matchScore || appMap[jId]?.matchScore,
                };
              }
            }
          });
        }

        // 3. Query jobApplications collection
        const q2 = query(
          collection(db, 'jobApplications'),
          where('candidateEmail', '==', candEmail)
        );
        const snap2 = await getDocs(q2).catch(() => null);
        if (snap2 && !snap2.empty) {
          snap2.docs.forEach(docSnap => {
            const data = docSnap.data();
            const jId = data.jobId || data.interviewId;
            if (jId) {
              appliedSet.add(jId);
              if (!appMap[jId]) {
                appMap[jId] = {
                  jobId: jId,
                  status: data.status || 'Under Review',
                  appliedAt: data.appliedAt,
                };
              }
            }
          });
        }

        // 4. Scan allJobs in state: candidateData and candidateEmails
        const candPhoneNorm = (candidate?.phone || candidate?.profile?.phone || editForm.phone || '').replace(/\D/g, '');

        const isCandMatch = (c: any) => {
          if (!c) return false;
          const cEmail = (c.email || '').toLowerCase().trim();
          if (candEmail && cEmail && cEmail === candEmail) return true;
          const cPhone = String(c.phone || '').replace(/\D/g, '');
          if (candPhoneNorm && cPhone && (cPhone === candPhoneNorm || cPhone.endsWith(candPhoneNorm) || candPhoneNorm.endsWith(cPhone))) return true;
          return false;
        };

        allJobs.forEach((job) => {
          if (!job) return;
          const candidateDataArr = Array.isArray(job.candidateData) ? job.candidateData : [];
          const candidateEmailsArr = Array.isArray(job.candidateEmails) ? job.candidateEmails : [];

          const matchCandidate = candidateDataArr.find(isCandMatch);

          if (matchCandidate) {
            appliedSet.add(job.id);
            if (job.jobNo) appliedSet.add(job.jobNo);
            if (job.accessCode) appliedSet.add(job.accessCode);

            const existing = appMap[job.id] || (job.jobNo && appMap[job.jobNo]) || (job.accessCode && appMap[job.accessCode]);
            const appInfo = {
              jobId: job.id,
              status: matchCandidate.status || existing?.status || 'Under Review',
              appliedAt: matchCandidate.appliedAt || existing?.appliedAt,
              statusUpdatedAt: matchCandidate.statusUpdatedAt || existing?.statusUpdatedAt,
              scheduledInterview: matchCandidate.scheduledInterview || existing?.scheduledInterview,
              recruiterNotes: matchCandidate.recruiterNotes || existing?.recruiterNotes,
              matchScore: matchCandidate.matchScore || existing?.matchScore,
            };
            appMap[job.id] = appInfo;
            if (job.jobNo) appMap[job.jobNo] = appInfo;
            if (job.accessCode) appMap[job.accessCode] = appInfo;
          } else if (candidateEmailsArr.some((e: any) => String(e).toLowerCase().trim() === candEmail)) {
            appliedSet.add(job.id);
            if (job.jobNo) appliedSet.add(job.jobNo);
            if (job.accessCode) appliedSet.add(job.accessCode);
            if (!appMap[job.id]) {
              const defaultInfo = {
                jobId: job.id,
                status: 'Under Review',
              };
              appMap[job.id] = defaultInfo;
              if (job.jobNo) appMap[job.jobNo] = defaultInfo;
              if (job.accessCode) appMap[job.accessCode] = defaultInfo;
            }
          }
        });

        if (isMounted) {
          const appliedArr = Array.from(appliedSet);
          setAppliedJobIds(appliedArr);
          setAppliedApplications(appMap);
          localStorage.setItem(`snab_candidate_applied_jobs_${candEmail}`, JSON.stringify(appliedArr));
        }
      } catch (err) {
        console.warn('Error fetching candidate applied jobs:', err);
      }
    };

    fetchAppliedJobs();

    return () => {
      isMounted = false;
    };
  }, [candidate?.email, candidate?.profile?.email, editForm.email, allJobs]);

  // Fetch available tests/assessments and candidate's past test submissions
  useEffect(() => {
    let isMounted = true;
    const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();

    const fetchAssessmentsAndResults = async () => {
      setAssessmentsLoading(true);
      try {
        // 1. Fetch available tests from tests collection
        const testsSnap = await getDocs(collection(db, 'tests')).catch(() => null);
        const testsList: any[] = [];
        if (testsSnap && !testsSnap.empty) {
          testsSnap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const statusLower = String(data.status || '').trim().toLowerCase();
            if (statusLower !== 'inactive' && statusLower !== 'archived') {
              testsList.push({
                id: docSnap.id,
                ...data,
                passingScore: Number(data.passingScore ?? 70),
                duration: Number(data.duration ?? 30),
                questionsCount: Array.isArray(data.questions) ? data.questions.length : 0,
              });
            }
          });
        }

        // 2. Fetch candidate test submissions from testSubmissions collection
        const subsList: any[] = [];
        if (candEmail) {
          const q1 = query(collection(db, 'testSubmissions'), where('candidateEmail', '==', candEmail));
          const q2 = query(collection(db, 'testSubmissions'), where('email', '==', candEmail));
          const [snap1, snap2] = await Promise.all([
            getDocs(q1).catch(() => null),
            getDocs(q2).catch(() => null),
          ]);

          const seenIds = new Set<string>();
          const allDocs = [...(snap1?.docs || []), ...(snap2?.docs || [])];

          for (const d of allDocs) {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              const data = d.data();
              if (data.isDeleted || data.status === 'deleted') continue;
              const matchedTest = testsList.find(t => t.id === data.testId);
              subsList.push({
                id: d.id,
                ...data,
                testTitle: data.testTitle || matchedTest?.title || 'Skill Assessment',
                passingScore: Number(data.passingScore || matchedTest?.passingScore || 70),
                type: data.type || matchedTest?.type || 'aptitude',
                testQuestions: matchedTest?.questions || data.questions || [],
              });
            }
          }

          subsList.sort((a, b) => {
            const tA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : (a.submittedAt ? new Date(a.submittedAt).getTime() : 0);
            const tB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : (b.submittedAt ? new Date(b.submittedAt).getTime() : 0);
            return tB - tA;
          });
        }

        if (isMounted) {
          setCandidateAssessments(testsList);
          setCandidateSubmissions(subsList);
        }
      } catch (err) {
        console.warn('Error fetching candidate assessments & results:', err);
      } finally {
        if (isMounted) setAssessmentsLoading(false);
      }
    };

    fetchAssessmentsAndResults();
    return () => {
      isMounted = false;
    };
  }, [candidate?.email, candidate?.profile?.email, editForm.email]);

  // Fetch all active jobs from Firestore interviews & jobs collections (same source as upload resume)
  useEffect(() => {
    setJobsLoading(true);
    let activeInterviewsList: any[] = [];
    let activeJobsList: any[] = [];

    const mergeJobs = () => {
      const allRaw = [...activeInterviewsList, ...activeJobsList];
      const seenCodes = new Set<string>();
      const seenIds = new Set<string>();
      const seenSigs = new Set<string>();
      const combined: any[] = [];

      for (const item of allRaw) {
        if (!item || !item.id) continue;
        if (item.isMock) continue;

        const statusLower = String(item.status || '').trim().toLowerCase();
        if (['inactive', 'expired', 'closed', 'disabled', 'deactivated', 'draft'].includes(statusLower)) {
          continue;
        }

        const idClean = (item.id || '').trim();
        const codeClean = (item.accessCode || item.jobNo || '').trim().toUpperCase();
        const titleClean = (item.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const locationClean = (item.location || item.city || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const recruiterClean = (item.recruiterName || item.entryBy || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const deptClean = (item.department || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const compositeSig = (titleClean && locationClean) ? `${titleClean}__${locationClean}__${deptClean || recruiterClean}` : '';

        const isDuplicate =
          (codeClean && seenCodes.has(codeClean)) ||
          (idClean && seenIds.has(idClean)) ||
          (compositeSig && seenSigs.has(compositeSig));

        if (isDuplicate) {
          const existingIdx = combined.findIndex(j => 
            (codeClean && (j.accessCode || j.jobNo || '').trim().toUpperCase() === codeClean) ||
            (idClean && j.id === idClean) ||
            (compositeSig && (j.title || '').trim().toLowerCase().replace(/\s+/g, ' ') === titleClean && (j.location || j.city || '').trim().toLowerCase().replace(/\s+/g, ' ') === locationClean)
          );
          if (existingIdx >= 0) {
            const existing = combined[existingIdx];
            combined[existingIdx] = {
              ...item,
              ...existing,
              description: existing.description || item.description,
              skills: (existing.skills && existing.skills.length > 0) ? existing.skills : item.skills,
              qualification: existing.qualification || item.qualification,
              education: existing.education || item.education,
              experience: existing.experience || item.experience,
              accessCode: existing.accessCode || item.accessCode || codeClean,
            };
          }
          continue;
        }

        if (codeClean) seenCodes.add(codeClean);
        if (idClean) seenIds.add(idClean);
        if (compositeSig) seenSigs.add(compositeSig);

        combined.push(item);
      }

      setAllJobs(combined);
      setJobsLoading(false);

      // Immediately sync candidate application status from combined jobs
      const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();
      if (candEmail) {
        setAppliedApplications((prevMap) => {
          const nextMap = { ...prevMap };
          const newlyApplied: string[] = [];

          combined.forEach((job) => {
            const candidateDataArr = Array.isArray(job.candidateData) ? job.candidateData : [];
            const candidateEmailsArr = Array.isArray(job.candidateEmails) ? job.candidateEmails : [];

            const matchCand = candidateDataArr.find((c: any) =>
              (c?.email || '').toLowerCase().trim() === candEmail
            );

            if (matchCand) {
              newlyApplied.push(job.id);
              nextMap[job.id] = {
                jobId: job.id,
                status: matchCand.status || nextMap[job.id]?.status || 'Under Review',
                appliedAt: matchCand.appliedAt || nextMap[job.id]?.appliedAt,
                statusUpdatedAt: matchCand.statusUpdatedAt || nextMap[job.id]?.statusUpdatedAt,
                scheduledInterview: matchCand.scheduledInterview || nextMap[job.id]?.scheduledInterview,
                recruiterNotes: matchCand.recruiterNotes || nextMap[job.id]?.recruiterNotes,
                matchScore: matchCand.matchScore || nextMap[job.id]?.matchScore,
              };
            } else if (candidateEmailsArr.some((e: any) => String(e).toLowerCase().trim() === candEmail)) {
              newlyApplied.push(job.id);
              if (!nextMap[job.id]) {
                nextMap[job.id] = {
                  jobId: job.id,
                  status: 'Under Review',
                };
              }
            }
          });

          if (newlyApplied.length > 0) {
            setAppliedJobIds((prevIds) => Array.from(new Set([...prevIds, ...newlyApplied])));
          }

          return nextMap;
        });
      }
    };

    const parseExpMinMax = (data: any) => {
      let min = 0;
      let max = 0;
      if (data.minExperience !== undefined && data.minExperience !== null && !isNaN(Number(data.minExperience))) {
        min = Math.max(0, Number(data.minExperience));
      }
      if (data.maxExperience !== undefined && data.maxExperience !== null && !isNaN(Number(data.maxExperience))) {
        max = Math.max(0, Number(data.maxExperience));
      }
      const rawStr = String(data.experience || data.minExperience || '').trim();
      if (min === 0 && rawStr) {
        const rangeMatch = rawStr.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
        if (rangeMatch) {
          min = parseFloat(rangeMatch[1]) || 0;
          max = parseFloat(rangeMatch[2]) || 0;
        } else {
          const singleMatch = rawStr.match(/(\d+(?:\.\d+)?)/);
          if (singleMatch && !/fresher|0\s*yr/i.test(rawStr)) {
            min = parseFloat(singleMatch[1]) || 0;
          }
        }
      }
      return {
        minExperience: min,
        maxExperience: max,
        experience: rawStr || (min > 0 ? (max > min ? `${min} - ${max} Yrs` : `${min}+ Yrs`) : 'Fresher / Any Experience')
      };
    };

    const unsubInterviews = onSnapshot(query(collection(db, 'interviews')), (snapshot) => {
      activeInterviewsList = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const jobNo = data.jobNo ? String(data.jobNo).trim() : '';
        const accessCode = jobNo || data.accessCode || docSnap.id.slice(0, 6).toUpperCase();
        const resolvedEntryBy = (
          data.entryBy ||
          data.entry_by ||
          data.uploadedBy ||
          data.uploaded_by ||
          data.contactPerson ||
          data.contactPersonName ||
          (typeof data.createdBy === 'string' ? data.createdBy : data.createdBy?.name) ||
          data.recruiterName ||
          'Recruiter'
        ).toString().trim();
        const parsedExp = parseExpMinMax(data);

        return {
          id: docSnap.id,
          jobNo,
          accessCode,
          title: data.title || 'Untitled Job Role',
          interviewMode: data.interviewMode,
          company: data.company || data.companyName || 'Hiring Partner',
          recruiterName: resolvedEntryBy,
          entryBy: resolvedEntryBy,
          description: data.description || data.jobDescription || '',
          department: data.department || data.roleCategory || data.category || 'General',
          departments: data.departments || [data.department || data.roleCategory || data.category || 'General'],
          roleCategory: data.roleCategory || data.roleName || '',
          location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : data.city || 'Nashik, Maharashtra'),
          city: data.city || data.location || 'Nashik',
          genderRequirement: data.genderRequirement || data.gender || data.genderPreference || 'Any',
          gender: data.gender || data.genderRequirement || 'Any',
          employmentType: data.employmentType || data.jobType || 'Full-Time',
          salary: data.salary || data.salaryRange || (data.minSalary && data.maxSalary ? `₹${data.minSalary} - ₹${data.maxSalary} / month` : 'Competitive CTC'),
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          minExperience: parsedExp.minExperience,
          maxExperience: parsedExp.maxExperience,
          experience: parsedExp.experience,
          qualification: data.qualification || data.education || data.qualifications || 'Diploma / Graduate',
          education: data.education || data.qualification || data.qualifications || 'Diploma / Graduate',
          skills: Array.isArray(data.skills)
            ? data.skills
            : typeof data.skills === 'string'
            ? data.skills.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
            : [],
          status: data.status || 'Active',
          deadline: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDeadline || data.endDate || data.interviewDates || '',
          isMock: Boolean(data.isMock),
          candidateData: data.candidateData || [],
          candidateEmails: data.candidateEmails || []
        };
      });
      mergeJobs();
    }, (error) => {
      console.warn('Interviews collection fetch note:', error);
      setJobsLoading(false);
    });

    const unsubJobs = onSnapshot(query(collection(db, 'jobs')), (snapshot) => {
      activeJobsList = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const jobNo = data.jobNo ? String(data.jobNo).trim() : '';
        const accessCode = jobNo || data.accessCode || docSnap.id.slice(0, 6).toUpperCase();
        const resolvedEntryBy = (
          data.entryBy ||
          data.entry_by ||
          data.uploadedBy ||
          data.uploaded_by ||
          data.contactPerson ||
          data.contactPersonName ||
          (typeof data.createdBy === 'string' ? data.createdBy : data.createdBy?.name) ||
          data.recruiterName ||
          'Recruiter'
        ).toString().trim();
        const parsedExp = parseExpMinMax(data);

        return {
          id: docSnap.id,
          jobNo,
          accessCode,
          title: data.title || 'Job Opening',
          interviewMode: data.interviewMode,
          company: data.company || data.companyName || 'Hiring Partner',
          recruiterName: resolvedEntryBy,
          entryBy: resolvedEntryBy,
          description: data.description || data.jobDescription || '',
          department: data.department || data.roleCategory || data.category || 'General',
          departments: data.departments || [data.department || data.roleCategory || data.category || 'General'],
          roleCategory: data.roleCategory || data.roleName || '',
          location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : data.city || 'Nashik, Maharashtra'),
          city: data.city || data.location || 'Nashik',
          genderRequirement: data.genderRequirement || data.gender || data.genderPreference || 'Any',
          gender: data.gender || data.genderRequirement || 'Any',
          employmentType: data.employmentType || data.jobType || 'Full-Time',
          salary: data.salary || data.salaryRange || (data.minSalary && data.maxSalary ? `₹${data.minSalary} - ₹${data.maxSalary}` : 'Competitive CTC'),
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          minExperience: parsedExp.minExperience,
          maxExperience: parsedExp.maxExperience,
          experience: parsedExp.experience,
          qualification: data.qualification || data.education || data.qualifications || 'Diploma / Graduate',
          education: data.education || data.qualification || data.qualifications || 'Diploma / Graduate',
          skills: Array.isArray(data.skills)
            ? data.skills
            : typeof data.skills === 'string'
            ? data.skills.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
            : [],
          status: data.status || 'Active',
          deadline: data.deadlineDate || data.deadline || '',
          isMock: Boolean(data.isMock),
          candidateData: data.candidateData || [],
          candidateEmails: data.candidateEmails || []
        };
      });
      mergeJobs();
    }, (err) => {
      console.warn('Jobs fetch error:', err);
    });

    return () => {
      unsubInterviews();
      unsubJobs();
    };
  }, []);

  // Compute Job Matches for Logged In Candidate using same logic as upload resume
  const matchedJobs: JobMatchResult[] = useMemo(() => {
    if (!candidate || allJobs.length === 0) return [];

    const prof = (candidate.profile && typeof candidate.profile === 'object') ? candidate.profile : {};
    const candExp = Number(editForm.totalExperienceYears) || Number(candidate.totalExperienceYears) || Number(candidate.experienceYears) || Number(candidate.experience) || Number(prof.totalExperienceYears) || Number(prof.experienceYears) || Number(prof.experience) || 0;

    const rawCandEdu = editForm.highestEducation || candidate.highestEducation || candidate.education || (prof.education && Array.isArray(prof.education) ? prof.education[0]?.degree : prof.education) || 'Graduate';
    const candEdu = typeof rawCandEdu === 'string' ? rawCandEdu : (rawCandEdu?.degree || rawCandEdu?.title || (Array.isArray(rawCandEdu) && rawCandEdu[0]?.degree) || 'Graduate');

    const candSkills = editForm.skills && editForm.skills.length > 0
      ? editForm.skills
      : (Array.isArray(candidate.skills) ? candidate.skills : (Array.isArray(prof.skills) ? prof.skills : []));

    const candDomains: string[] = Array.isArray(candidate.domains)
      ? candidate.domains
      : (candidate.domain ? candidate.domain.split(', ').filter(Boolean) : (Array.isArray(prof.domains) ? prof.domains : []));

    const isCandBlocked = Boolean(candidate.isBlocked || prof.isBlocked || candidate.isBanned || prof.isBanned);
    if (isCandBlocked) return [];

    const candidateProfile: CandidateMatchProfile = {
      name: editForm.name || candidate.name || prof.name || 'Job Seeker',
      email: editForm.email || candidate.email || prof.email || '',
      phone: editForm.phone || candidate.phone || prof.phone || '',
      gender: candidate.gender || prof.gender || 'Any',
      maritalStatus: candidate.maritalStatus || prof.maritalStatus || '',
      location: editForm.location || candidate.location || prof.location || 'Nashik',
      city: editForm.location || candidate.location || prof.location || 'Nashik',
      currentTitle: editForm.currentTitle || candidate.currentTitle || prof.currentTitle || '',
      totalExperienceYears: candExp,
      experience: candExp,
      highestEducation: candEdu,
      education: candEdu,
      skills: candSkills,
      domain: candDomains.join(', '),
      domains: candDomains,
      preferredDomains: candDomains,
      preferredLocations: editForm.preferredLocations ? editForm.preferredLocations.split(',').map((s: string) => s.trim()) : [],
      resumeText: candidate.resumeText || prof.resumeText || candidate.additionalText || '',
      summary: editForm.summary || candidate.summary || prof.summary || '',
      isBlocked: isCandBlocked,
      isBanned: isCandBlocked
    };

    const results = allJobs.map(job => calculateJobMatchScore(job, candidateProfile));

    // STRICT ELIGIBILITY: Filter out any job where candidate criteria is unmet (education qualification mismatch, experience mismatch, gender mismatch, etc.)
    const eligibleResults = results.filter(r => r.eduMatch.isMatch && r.expMatch.isMatch && r.genderMatch.isMatch && r.overallScore > 0);

    // Sort by match score descending
    eligibleResults.sort((a, b) => b.overallScore - a.overallScore);
    return eligibleResults;
  }, [candidate, allJobs, editForm]);

  // Auto-open target job modal if ?job= or ?jobId= is in URL query parameters (only on initial authorized load)
  useEffect(() => {
    if (!allJobs.length) return;
    if (hasDismissedJobModalRef.current) return;
    if (!candidate) return;

    if (!targetJobId) return;

    if (selectedJobModal?.job?.id === targetJobId) return;

    const targetJob = allJobs.find(j => j.id === targetJobId || j.jobNo === targetJobId || j.accessCode === targetJobId);
    if (!targetJob) return;

    const existingMatch = matchedJobs.find(m => m.job.id === targetJob.id);
    if (existingMatch) {
      setSelectedJobModal(existingMatch);
    } else {
      const prof: CandidateMatchProfile = {
        name: editForm.name || candidate?.name || 'Job Seeker',
        email: editForm.email || candidate?.email || '',
        phone: editForm.phone || candidate?.phone || '',
        currentTitle: editForm.currentTitle || candidate?.currentTitle || '',
        skills: editForm.skills || candidate?.skills || [],
        experience: Number(editForm.totalExperienceYears) || Number(candidate?.totalExperienceYears) || 0,
        education: editForm.highestEducation || candidate?.highestEducation || '',
        location: editForm.location || candidate?.location || '',
        preferredLocations: editForm.preferredLocations ? editForm.preferredLocations.split(',') : (candidate?.preferredLocations || []),
        summary: editForm.summary || candidate?.summary || '',
        employmentTypes: editForm.employmentTypes || candidate?.employmentTypes || []
      };
      const result = calculateJobMatchScore(targetJob, prof);
      setSelectedJobModal(result);
    }
  }, [allJobs]);

  // Keep selectedJobModal in sync with latest allJobs candidateData/status
  useEffect(() => {
    if (!selectedJobModal || !allJobs.length) return;
    const currentId = selectedJobModal.job?.id || (selectedJobModal as any).id;
    const currentJobNo = selectedJobModal.job?.jobNo || (selectedJobModal as any).jobNo;
    const currentAccessCode = selectedJobModal.job?.accessCode || (selectedJobModal as any).accessCode;
    const fresh = allJobs.find(j =>
      (currentId && j.id === currentId) ||
      (currentJobNo && j.jobNo === currentJobNo) ||
      (currentAccessCode && j.accessCode === currentAccessCode)
    );
    const activeJob = selectedJobModal.job || selectedJobModal;
    if (fresh && fresh !== activeJob) {
      setSelectedJobModal(prev => prev ? (prev.job ? { ...prev, job: fresh } : { ...prev, ...fresh, job: fresh }) : null);
    }
  }, [allJobs]);

  // Full list of applications for the logged-in candidate with real-time status & interview data
  const myApplicationsList = useMemo(() => {
    const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();
    const candPhoneNorm = (candidate?.phone || candidate?.profile?.phone || editForm.phone || '').replace(/\D/g, '');

    const isCandMatch = (c: any) => {
      if (!c) return false;
      const cEmail = (c.email || '').toLowerCase().trim();
      if (candEmail && cEmail && cEmail === candEmail) return true;
      const cPhone = String(c.phone || '').replace(/\D/g, '');
      if (candPhoneNorm && cPhone && (cPhone === candPhoneNorm || cPhone.endsWith(candPhoneNorm) || candPhoneNorm.endsWith(cPhone))) return true;
      return false;
    };

    const map = new Map<string, { job: any; appInfo: CandidateApplicationInfo; matchItem?: JobMatchResult }>();

    allJobs.forEach((job) => {
      if (!job) return;
      const candidateDataArr = Array.isArray(job.candidateData) ? job.candidateData : [];
      const candidateEmailsArr = Array.isArray(job.candidateEmails) ? job.candidateEmails : [];

      const matchCand = candidateDataArr.find(isCandMatch);
      const isEmailInJob = candidateEmailsArr.some((e: any) => candEmail && String(e).toLowerCase().trim() === candEmail);

      const isMarkedApplied = appliedJobIds.includes(job.id) ||
        (job.jobNo && appliedJobIds.includes(job.jobNo)) ||
        (job.accessCode && appliedJobIds.includes(job.accessCode)) ||
        Boolean(appliedApplications[job.id]) ||
        Boolean(job.jobNo && appliedApplications[job.jobNo]) ||
        Boolean(job.accessCode && appliedApplications[job.accessCode]);

      if (matchCand || isEmailInJob || isMarkedApplied) {
        const storedAppInfo = appliedApplications[job.id] ||
          (job.jobNo && appliedApplications[job.jobNo]) ||
          (job.accessCode && appliedApplications[job.accessCode]);

        const appInfo: CandidateApplicationInfo = {
          jobId: job.id,
          status: matchCand?.status || storedAppInfo?.status || (isMarkedApplied || isEmailInJob ? 'Under Review' : 'Applied'),
          appliedAt: matchCand?.appliedAt || storedAppInfo?.appliedAt,
          statusUpdatedAt: matchCand?.statusUpdatedAt || storedAppInfo?.statusUpdatedAt,
          scheduledInterview: matchCand?.scheduledInterview || storedAppInfo?.scheduledInterview,
          recruiterNotes: matchCand?.recruiterNotes || storedAppInfo?.recruiterNotes,
          matchScore: matchCand?.matchScore || storedAppInfo?.matchScore,
        };

        const matchItem = matchedJobs.find(m => m.job.id === job.id);
        map.set(job.id, { job, appInfo, matchItem });
      }
    });

    return Array.from(map.values());
  }, [allJobs, appliedJobIds, appliedApplications, candidate, editForm, matchedJobs]);

  // Reusable helper to check if candidate has applied to a specific job
  const isJobApplied = useCallback((job: any): boolean => {
    if (!job) return false;
    const jId = job.id;
    const jNo = job.jobNo;
    const jAccess = job.accessCode;

    if (jId && appliedJobIds.includes(jId)) return true;
    if (jNo && appliedJobIds.includes(jNo)) return true;
    if (jAccess && appliedJobIds.includes(jAccess)) return true;

    if (jId && appliedApplications[jId]) return true;
    if (jNo && appliedApplications[jNo]) return true;
    if (jAccess && appliedApplications[jAccess]) return true;

    const inAppsList = myApplicationsList.some(item => {
      const aj = item.job;
      return (jId && aj?.id === jId) || (jNo && aj?.jobNo === jNo) || (jAccess && aj?.accessCode === jAccess);
    });
    if (inAppsList) return true;

    const liveJob = allJobs.find(j => (jId && j.id === jId) || (jNo && j.jobNo === jNo) || (jAccess && j.accessCode === jAccess)) || job;
    const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();
    const candPhoneNorm = (candidate?.phone || candidate?.profile?.phone || editForm.phone || '').replace(/\D/g, '');

    const isCandMatch = (c: any) => {
      if (!c) return false;
      const cEmail = (c.email || '').toLowerCase().trim();
      if (candEmail && cEmail && cEmail === candEmail) return true;
      const cPhone = String(c.phone || '').replace(/\D/g, '');
      if (candPhoneNorm && cPhone && (cPhone === candPhoneNorm || cPhone.endsWith(candPhoneNorm) || candPhoneNorm.endsWith(cPhone))) return true;
      return false;
    };

    const candInJobData = (Array.isArray(liveJob.candidateData) ? liveJob.candidateData.find(isCandMatch) : null) ||
      (Array.isArray(job.candidateData) ? job.candidateData.find(isCandMatch) : null);
    if (candInJobData) return true;

    const candInJobEmails = (Array.isArray(liveJob.candidateEmails) && liveJob.candidateEmails.some((e: any) => candEmail && String(e).toLowerCase().trim() === candEmail)) ||
      (Array.isArray(job.candidateEmails) && job.candidateEmails.some((e: any) => candEmail && String(e).toLowerCase().trim() === candEmail));

    return Boolean(candInJobEmails);
  }, [appliedJobIds, appliedApplications, myApplicationsList, allJobs, candidate, editForm]);

  // Filtered Matches based on search, score, and segmented tabs — Unapplied Jobs Ranked First!
  const filteredMatches = useMemo(() => {
    let list = [...matchedJobs];

    if (matchFilter === 'HighMatch') {
      const high = list.filter(r => r.overallScore >= 60);
      list = high.length > 0 ? high : list;
    } else if (matchFilter === 'LocalCity') {
      const candCity = (editForm.location || candidate?.location || '').toLowerCase().trim();
      if (candCity) {
        const local = list.filter(r =>
          r.locationMatch.isMatch ||
          (r.job.location && r.job.location.toLowerCase().includes(candCity)) ||
          (r.job.city && r.job.city.toLowerCase().includes(candCity))
        );
        list = local.length > 0 ? local : list;
      }
    }

    if (minScoreFilter > 0) {
      list = list.filter(m => m.overallScore >= minScoreFilter);
    }

    if (searchJobQuery.trim()) {
      const q = searchJobQuery.toLowerCase().trim();
      list = list.filter(m => {
        const matchTitle = (m.job.title || '').toLowerCase().includes(q);
        const matchCompany = (m.job.company || '').toLowerCase().includes(q);
        const matchLocation = (m.job.location || '').toLowerCase().includes(q);
        const matchDept = (m.job.department || '').toLowerCase().includes(q);
        const matchSkill = (m.job.skills || []).some((s: string) => s.toLowerCase().includes(q));
        return matchTitle || matchCompany || matchLocation || matchDept || matchSkill;
      });
    }

    // Sort: NOT APPLIED jobs first, then by match score descending
    list.sort((a, b) => {
      const aApplied = isJobApplied(a.job);
      const bApplied = isJobApplied(b.job);
      if (aApplied !== bApplied) {
        return aApplied ? 1 : -1; // unapplied (false) comes first
      }
      return b.overallScore - a.overallScore;
    });

    return list;
  }, [matchedJobs, matchFilter, editForm.location, candidate?.location, searchJobQuery, minScoreFilter, isJobApplied]);

  const shortlistedCount = useMemo(() => {
    return myApplicationsList.filter(item => {
      const s = (item.appInfo.status || '').toLowerCase();
      return s.includes('shortlist') || s.includes('interview') || s.includes('round') || s.includes('scheduled');
    }).length;
  }, [myApplicationsList]);

  const underReviewCount = useMemo(() => {
    return myApplicationsList.filter(item => {
      const s = (item.appInfo.status || '').toLowerCase();
      return s === 'under review' || s === 'applied' || s === 'pending' || s === 'interested';
    }).length;
  }, [myApplicationsList]);

  const selectedCount = useMemo(() => {
    return myApplicationsList.filter(item => {
      const s = (item.appInfo.status || '').toLowerCase();
      return s.includes('hired') || s.includes('offer') || s.includes('selected');
    }).length;
  }, [myApplicationsList]);

  const filteredApplications = useMemo(() => {
    if (appliedStageFilter === 'all') return myApplicationsList;
    return myApplicationsList.filter(item => {
      const s = (item.appInfo.status || '').toLowerCase();
      if (appliedStageFilter === 'under-review') {
        return s === 'under review' || s === 'applied' || s === 'pending' || s === 'interested';
      }
      if (appliedStageFilter === 'shortlisted') {
        return s.includes('shortlist') || s.includes('interview') || s.includes('round') || s.includes('scheduled');
      }
      if (appliedStageFilter === 'selected') {
        return s.includes('hired') || s.includes('offer') || s.includes('selected') || s.includes('accept');
      }
      if (appliedStageFilter === 'rejected') {
        return s.includes('reject') || s.includes('decline');
      }
      return true;
    });
  }, [myApplicationsList, appliedStageFilter]);

  const getStageStep = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('hired') || s.includes('offer') || s.includes('selected')) return 5;
    if (s.includes('interview') || s.includes('round') || s.includes('scheduled')) return 4;
    if (s.includes('shortlist')) return 3;
    if (s.includes('review') || s === 'pending' || s === 'interested') return 2;
    if (s.includes('reject')) return -1;
    return 1;
  };

  const handleUploadNewResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setResumeUploadError('File size exceeds the 15MB limit.');
      return;
    }

    try {
      setIsUploadingResume(true);
      setResumeUploadError(null);
      setResumeUploadSuccess(null);

      const uploadedUrl = await uploadToS3(file, 'raw', `candidate_resume_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
      
      const candDocId = candidate?.id;
      const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();

      // Update Firestore resumeDumpCandidates
      if (candDocId) {
        await updateDoc(doc(db, 'resumeDumpCandidates', candDocId), {
          resumeUrl: uploadedUrl,
          resumeFileName: file.name,
          resumeSize: file.size,
          resumeMimeType: file.type || 'application/pdf',
          updatedAt: serverTimestamp()
        }).catch(() => null);
      } else if (candEmail) {
        const snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', candEmail))).catch(() => null);
        if (snap && !snap.empty) {
          await updateDoc(doc(db, 'resumeDumpCandidates', snap.docs[0].id), {
            resumeUrl: uploadedUrl,
            resumeFileName: file.name,
            resumeSize: file.size,
            resumeMimeType: file.type || 'application/pdf',
            updatedAt: serverTimestamp()
          }).catch(() => null);
        }
      }

      const updatedCand = {
        ...candidate,
        resumeUrl: uploadedUrl,
        resumeFileName: file.name,
        resumeSize: file.size,
        resumeMimeType: file.type || 'application/pdf'
      };
      setCandidate(updatedCand);
      try {
        localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(updatedCand));
      } catch {}

      setResumeUploadSuccess(`Resume "${file.name}" uploaded and attached successfully!`);
      setTimeout(() => setResumeUploadSuccess(null), 5000);
    } catch (err: any) {
      console.error('Resume upload error:', err);
      setResumeUploadError(err.message || 'Failed to upload resume. Please try again.');
    } finally {
      setIsUploadingResume(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleCopyInterviewLink = (link: string) => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleOpenJobModal = (jobOrMatch: any) => {
    if (!jobOrMatch) return;
    if (jobOrMatch.job) {
      setSelectedJobModal(jobOrMatch);
    } else {
      const match = matchedJobs.find(m => m.job.id === jobOrMatch.id);
      if (match) {
        setSelectedJobModal(match);
      } else {
        const prof: CandidateMatchProfile = {
          name: editForm.name || candidate?.name || 'Job Seeker',
          email: editForm.email || candidate?.email || '',
          phone: editForm.phone || candidate?.phone || '',
          currentTitle: editForm.currentTitle || candidate?.currentTitle || '',
          skills: editForm.skills || candidate?.skills || [],
          experience: Number(editForm.totalExperienceYears) || Number(candidate?.totalExperienceYears) || 0,
          education: editForm.highestEducation || candidate?.highestEducation || '',
          location: editForm.location || candidate?.location || '',
          preferredLocations: editForm.preferredLocations ? editForm.preferredLocations.split(',') : (candidate?.preferredLocations || []),
          summary: editForm.summary || candidate?.summary || '',
          employmentTypes: editForm.employmentTypes || candidate?.employmentTypes || []
        };
        const result = calculateJobMatchScore(jobOrMatch, prof);
        setSelectedJobModal(result);
      }
    }
  };

  // Authentication Handler: Email + Phone Number as Password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanEnteredDigits = phonePasswordInput.replace(/\D/g, '');

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('Please enter a valid email address.');
      setAuthLoading(false);
      return;
    }

    if (!cleanEnteredDigits || cleanEnteredDigits.length < 6) {
      setAuthError('Please enter your valid phone number as your password.');
      setAuthLoading(false);
      return;
    }

    try {
      // 1. Query Firestore resumeDumpCandidates by email
      let matchedDoc: any = null;
      let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail))).catch(() => null);

      if (!snap || snap.empty) {
        snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanEmail))).catch(() => null);
      }

      // Check legacy resumeDump if not in primary
      if (!snap || snap.empty) {
        snap = await getDocs(query(collection(db, 'resumeDump'), where('email', '==', cleanEmail))).catch(() => null);
      }

      if (snap && !snap.empty) {
        let latestDocSnap = snap.docs[0];
        let latestTime = 0;
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          const t = d.updatedAt?.toMillis?.() || d.createdAt?.toMillis?.() || (d.updatedAt ? new Date(d.updatedAt).getTime() : 0) || 0;
          if (t >= latestTime) {
            latestTime = t;
            latestDocSnap = docSnap;
          }
        }
        const rawData = latestDocSnap.data();
        matchedDoc = { id: latestDocSnap.id, ...(rawData.profile || {}), ...rawData };
      }

      // Fallback: If not found by exact email equality, search candidates table
      if (!matchedDoc) {
        const snapAll = await getDocs(query(collection(db, 'resumeDumpCandidates'))).catch(() => null);
        if (snapAll && !snapAll.empty) {
          let latestTime = 0;
          for (const d of snapAll.docs) {
            const data = d.data();
            const prof = (data.profile && typeof data.profile === 'object') ? data.profile : {};
            const candEmail = String(data.email || prof.email || '').toLowerCase().trim();
            if (candEmail === cleanEmail) {
              const t = data.updatedAt?.toMillis?.() || data.createdAt?.toMillis?.() || (data.updatedAt ? new Date(data.updatedAt).getTime() : 0) || 0;
              if (t >= latestTime) {
                latestTime = t;
                matchedDoc = { id: d.id, ...prof, ...data };
              }
            }
          }
        }
      }

      if (!matchedDoc) {
        setAuthError(
          `No candidate record found for "${cleanEmail}". If you haven't uploaded your resume yet, please upload your resume first to activate your profile.`
        );
        setAuthLoading(false);
        return;
      }

      // Check if blocked / banned
      if (matchedDoc.isBlocked || matchedDoc.isBanned) {
        setAuthError('This candidate account has been suspended or blocked from job matching. Please contact support.');
        setAuthLoading(false);
        return;
      }

      // Verify Password (Phone Number match)
      const storedPhoneRaw = String(matchedDoc.phone || matchedDoc.profile?.phone || matchedDoc.phoneNumber || '');
      const storedDigits = storedPhoneRaw.replace(/\D/g, '');

      // Compare digits resiliently:
      const isPhoneMatch =
        (storedDigits && storedDigits === cleanEnteredDigits) ||
        (storedDigits.length >= 10 && cleanEnteredDigits.length >= 10 && storedDigits.slice(-10) === cleanEnteredDigits.slice(-10)) ||
        (storedDigits && storedDigits.endsWith(cleanEnteredDigits)) ||
        (cleanEnteredDigits && cleanEnteredDigits.endsWith(storedDigits));

      if (!isPhoneMatch) {
        setAuthError(
          'Incorrect password (phone number). Please enter the registered phone number associated with your resume.'
        );
        setAuthLoading(false);
        return;
      }

      // Login Successful!
      setCandidate(matchedDoc);
      if (rememberMe) {
        localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(matchedDoc));
      }
      setSelectedJobModal(null);
      hasDismissedJobModalRef.current = true;
      if (window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setAuthLoading(false);
    } catch (err: any) {
      console.error('Candidate login error:', err);
      setAuthError('An unexpected error occurred while logging in. Please try again.');
      setAuthLoading(false);
    }
  };

  // Google Sign-In Handler for Candidates
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const cleanEmail = (googleUser.email || '').trim().toLowerCase();

      if (!cleanEmail) {
        setAuthError('No email associated with this Google account.');
        setAuthLoading(false);
        return;
      }

      // Check if candidate profile exists in Firestore
      let matchedDoc: any = null;
      let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail))).catch(() => null);

      if (!snap || snap.empty) {
        snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanEmail))).catch(() => null);
      }

      if (!snap || snap.empty) {
        snap = await getDocs(query(collection(db, 'resumeDump'), where('email', '==', cleanEmail))).catch(() => null);
      }

      if (snap && !snap.empty) {
        let latestDocSnap = snap.docs[0];
        let latestTime = 0;
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          const t = d.updatedAt?.toMillis?.() || d.createdAt?.toMillis?.() || (d.updatedAt ? new Date(d.updatedAt).getTime() : 0) || 0;
          if (t >= latestTime) {
            latestTime = t;
            latestDocSnap = docSnap;
          }
        }
        const rawData = latestDocSnap.data();
        matchedDoc = { id: latestDocSnap.id, ...(rawData.profile || {}), ...rawData };
      }

      // If existing candidate record found
      if (matchedDoc) {
        if (matchedDoc.isBlocked || matchedDoc.isBanned) {
          setAuthError('This candidate account has been suspended or blocked. Please contact support.');
          setAuthLoading(false);
          return;
        }

        setCandidate(matchedDoc);
        if (rememberMe) {
          localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(matchedDoc));
        }
        setSelectedJobModal(null);
        hasDismissedJobModalRef.current = true;
        setAuthLoading(false);
        return;
      }

      // New Candidate with Google Auth -> Create profile immediately so they can access portal!
      const newCandidateData = {
        name: googleUser.displayName || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: googleUser.phoneNumber || '',
        photoURL: googleUser.photoURL || '',
        source: 'google_signin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'resumeDumpCandidates'), newCandidateData);
      const newCand = { id: docRef.id, ...newCandidateData };
      setCandidate(newCand);
      if (rememberMe) {
        localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(newCand));
      }
      setSelectedJobModal(null);
      hasDismissedJobModalRef.current = true;
      setAuthLoading(false);
    } catch (err: any) {
      console.error('Candidate Google Sign-in error:', err);
      const code = err.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed popup
        setAuthLoading(false);
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        setAuthError('This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).');
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError('Google Sign-In is not enabled in Firebase Console. Please enable Google under Authentication > Sign-in method.');
      } else {
        setAuthError(`Google sign-in failed: ${err.message || 'Please try again.'}`);
      }
      setAuthLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem(CANDIDATE_SESSION_KEY);
    localStorage.removeItem('snab_candidate_applied_jobs');
    const candEmail = (candidate?.email || candidate?.profile?.email || '').trim().toLowerCase();
    if (candEmail) {
      localStorage.removeItem(`snab_candidate_applied_jobs_${candEmail}`);
    }
    setCandidate(null);
    setAppliedJobIds([]);
    setAppliedApplications({});
    stopSpeech();
    setPlayingJobId(null);
  };

  // Add Skill in Edit Form
  const handleAddSkill = () => {
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    if (editForm.skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setProfileErrorMsg(`"${trimmed}" is already in your skills list.`);
      return;
    }
    setEditForm(prev => ({ ...prev, skills: [...prev.skills, trimmed] }));
    setNewSkillInput('');
    setProfileErrorMsg(null);
  };

  // Remove Skill in Edit Form
  const handleRemoveSkill = (skillToRemove: string) => {
    setEditForm(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skillToRemove)
    }));
  };

  // Save Candidate Profile Changes to Firestore
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate?.id) return;

    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      const expNumber = Number(editForm.totalExperienceYears) || 0;
      const prefLocArr = editForm.preferredLocations
        ? editForm.preferredLocations.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const updatePayload: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        currentTitle: editForm.currentTitle.trim(),
        totalExperienceYears: expNumber,
        experience: expNumber,
        skills: editForm.skills,
        highestEducation: editForm.highestEducation.trim(),
        education: [
          {
            degree: editForm.highestEducation.trim(),
            institution: editForm.institution.trim(),
            year: editForm.graduationYear.trim()
          }
        ],
        location: editForm.location.trim(),
        preferredLocations: prefLocArr,
        currentSalary: editForm.currentSalary.trim(),
        expectedSalary: editForm.expectedSalary.trim(),
        noticePeriod: editForm.noticePeriod.trim(),
        summary: editForm.summary.trim(),
        employmentTypes: editForm.employmentTypes,
        updatedAt: serverTimestamp()
      };

      // Update in Firestore
      await updateDoc(doc(db, 'resumeDumpCandidates', candidate.id), updatePayload);

      // Update local candidate state & session
      const updatedCandidate = { ...candidate, ...updatePayload };
      setCandidate(updatedCandidate);
      localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(updatedCandidate));

      setProfileSuccessMsg('Profile updated successfully! Your matched jobs have been refreshed.');
      setTimeout(() => setProfileSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to update candidate profile:', err);
      setProfileErrorMsg('Failed to save profile changes. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Apply to Job
  const handleApplyToJob = async (matchOrJob: any) => {
    if (!matchOrJob) return;
    const targetJob: any = matchOrJob.job || matchOrJob;
    const jobId = targetJob.id;
    if (!jobId || appliedJobIds.includes(jobId) || applyingJobId === jobId) return;

    setApplyingJobId(jobId);
    try {
      const candidateEmail = (editForm.email || candidate?.email || '').trim().toLowerCase();
      const candidateName = editForm.name || candidate?.name || 'Job Seeker';
      const candidatePhone = editForm.phone || candidate?.phone || '';

      const overallScore = matchOrJob.overallScore ?? 80;
      const matchGrade = matchOrJob.matchGrade || 'Recommended';
      const jobTitle = targetJob.title || 'Job Opening';

      // 1. Primary: Save to candidateApplications so it appears instantly in Candidate Responses / Hot Leads
      try {
        await addDoc(collection(db, 'candidateApplications'), {
          interviewId: jobId,
          jobId: jobId,
          jobTitle,
          jobAccessCode: targetJob.accessCode || targetJob.jobNo || '',
          candidateId: candidate?.id || '',
          candidateName,
          candidateEmail,
          candidatePhone,
          recruiterUID: targetJob.recruiterUID || targetJob.createdBy?.uid || '',
          teamId: targetJob.teamId || '',
          matchScore: overallScore,
          matchGrade,
          status: 'pending',
          appliedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          source: 'Candidate Portal Application'
        });
      } catch (appErr) {
        console.warn('candidateApplications save error:', appErr);
      }

      // 2. Secondary: Save to jobApplications for general tracking
      await addDoc(collection(db, 'jobApplications'), {
        jobId,
        interviewId: jobId,
        jobTitle,
        jobAccessCode: targetJob.accessCode || targetJob.jobNo || '',
        candidateId: candidate?.id || '',
        candidateName,
        candidateEmail,
        candidatePhone,
        matchScore: overallScore,
        matchGrade,
        status: 'Applied',
        appliedAt: serverTimestamp()
      }).catch((err) => console.warn('Note: application collection save:', err));

      // 3. Register into interviews collection so recruiters see candidate in interview details
      try {
        const intRef = doc(db, 'interviews', jobId);
        await updateDoc(intRef, {
          candidateEmails: arrayUnion(candidateEmail),
          candidateData: arrayUnion({
            name: candidateName,
            email: candidateEmail,
            phone: candidatePhone,
            appliedAt: new Date().toISOString(),
            status: 'interested',
            source: 'candidate_portal'
          })
        });
      } catch {
        // Not all jobs are in interviews collection, ignore
      }

      const updated = Array.from(new Set([...appliedJobIds, jobId]));
      setAppliedJobIds(updated);
      setAppliedApplications((prev) => ({
        ...prev,
        [jobId]: {
          jobId,
          status: 'Under Review',
          appliedAt: new Date().toISOString(),
          matchScore: overallScore,
        }
      }));
      const cleanEmail = candidateEmail.trim().toLowerCase();
      if (cleanEmail) {
        localStorage.setItem(`snab_candidate_applied_jobs_${cleanEmail}`, JSON.stringify(updated));
      }

      setApplySuccessMsg(`Successfully applied to ${jobTitle}! The recruitment team has received your application.`);
      setTimeout(() => setApplySuccessMsg(null), 5000);
    } catch (err) {
      console.error('Apply error:', err);
    } finally {
      setApplyingJobId(null);
    }
  };

  // Audio Playback
  const togglePlayAudio = (matchOrJob: any) => {
    if (!matchOrJob) return;
    const targetJob: any = matchOrJob.job || matchOrJob;
    const jobId = targetJob.id;
    if (!jobId) return;

    if (playingJobId === jobId) {
      stopSpeech();
      setPlayingJobId(null);
      return;
    }

    stopSpeech();
    setPlayingJobId(jobId);
    const textToRead = `${targetJob.title || 'Job Opening'} at ${targetJob.company || 'Company'}. Location: ${targetJob.location || 'Location'}. Experience required: ${targetJob.experience || 'Not specified'}. Key skills: ${(targetJob.skills || []).slice(0, 5).join(', ')}. ${(targetJob.description || '').slice(0, 300)}`;

    speak(textToRead, {
      onEnd: () => setPlayingJobId(null),
      onError: () => setPlayingJobId(null)
    });
  };

  // ── Assessment Scorecard & Solution Modal ──
  const renderScorecardModal = () => {
    if (!selectedScorecardSubmission) return null;

    const score = Number(selectedScorecardSubmission.score) || 0;
    const passingScore = Number(selectedScorecardSubmission.passingScore) || 70;
    const isPassed = selectedScorecardSubmission.status === 'passed' || score >= passingScore;
    const tabSwitches = Number(selectedScorecardSubmission.tabSwitchCount) || 0;

    return (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in"
        onClick={() => setSelectedScorecardSubmission(null)}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="relative flex flex-col w-full max-w-3xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-3.5rem)] rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  selectedScorecardSubmission.type === 'coding'
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'bg-[#D4F82C] text-[#111215]'
                }`}>
                  {selectedScorecardSubmission.type === 'coding' ? 'Coding Assessment' : 'Aptitude Assessment'}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  isPassed
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {isPassed ? '✓ Passed Benchmark' : 'Needs Improvement'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#111215] dark:text-white">
                {selectedScorecardSubmission.testTitle}
              </h2>
              <p className="text-xs text-[#575A51] dark:text-neutral-400 mt-0.5">
                Evaluated for {candidateDisplayName} • Submitted{' '}
                {selectedScorecardSubmission.submittedAt?.toDate
                  ? selectedScorecardSubmission.submittedAt.toDate().toLocaleString()
                  : 'Recently'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedScorecardSubmission(null)}
              className="size-8 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Performance KPI banner */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400">Score</span>
                <p className={`text-2xl font-black mt-0.5 ${isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {score}%
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400">Pass Benchmark</span>
                <p className="text-2xl font-black text-[#111215] dark:text-white mt-0.5">
                  {passingScore}%
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400">Proctoring</span>
                <p className="text-xs font-bold text-[#111215] dark:text-white mt-2">
                  {tabSwitches > 0 ? `⚠️ ${tabSwitches} switch(es)` : '🛡️ 100% Clean'}
                </p>
              </div>
            </div>

            {/* Evaluator feedback */}
            {selectedScorecardSubmission.feedback && (
              <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} />
                  <span>Automated Evaluator Feedback</span>
                </h4>
                <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                  {selectedScorecardSubmission.feedback}
                </p>
              </div>
            )}

            {/* Questions list */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                Question & Answer Breakdown
              </h4>

              {Array.isArray(selectedScorecardSubmission.testQuestions) && selectedScorecardSubmission.testQuestions.length > 0 ? (
                selectedScorecardSubmission.testQuestions.map((q: any, qIdx: number) => {
                  const userAns = selectedScorecardSubmission.answers?.[qIdx];
                  return (
                    <div key={qIdx} className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#FAFAF8] dark:bg-white/[0.02] space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400">
                          Q{qIdx + 1}.
                        </span>
                        <h5 className="flex-1 text-xs font-bold text-[#111215] dark:text-white">
                          {selectedScorecardSubmission.type === 'aptitude' ? q.question : q.title}
                        </h5>
                      </div>

                      {selectedScorecardSubmission.type === 'aptitude' && Array.isArray(q.options) ? (
                        <div className="space-y-1.5 pl-4">
                          {q.options.map((opt: string, optIdx: number) => {
                            const isSelected = userAns === optIdx;
                            const isCorrect = q.correctIndex === optIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                                  isCorrect
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold'
                                    : isSelected && !isCorrect
                                    ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200'
                                    : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300'
                                }`}
                              >
                                <span>{opt}</span>
                                {isCorrect && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                                    ✓ Correct
                                  </span>
                                )}
                                {isSelected && !isCorrect && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-900">
                                    ✗ Your Answer
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-black text-white font-mono text-xs overflow-x-auto">
                          <pre className="text-neutral-300">
                            {selectedScorecardSubmission.answers?.[qIdx] || '// No code submitted for this problem'}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-[#E4E7DC] dark:border-white/10 text-center text-xs text-[#73766C] dark:text-neutral-400">
                  Full test score recorded: {score}%. Detailed solution logs are retained by the evaluation team.
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-[#E4E7DC] dark:border-white/10 flex justify-end bg-[#F8F9F5] dark:bg-[#1D1F24]">
            <button
              type="button"
              onClick={() => setSelectedScorecardSubmission(null)}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215] cursor-pointer hover:opacity-90 transition-opacity"
            >
              Close Scorecard
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Dedicated Full Job Description (JD) Modal ──
  const renderTargetJdModal = () => {
    if (!showTargetJdModal || !targetJobData) return null;

    const isAlreadyApplied = appliedJobIds.includes(targetJobData.id) ||
      (targetJobData.jobNo && appliedJobIds.includes(targetJobData.jobNo)) ||
      (targetJobData.accessCode && appliedJobIds.includes(targetJobData.accessCode)) ||
      Boolean(targetJobAlreadyApplied);

    return (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md overflow-hidden animate-in fade-in"
        onClick={() => setShowTargetJdModal(false)}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="relative flex flex-col w-full max-w-3xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-3.5rem)] rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-3 px-5 sm:px-7 py-4 sm:py-5 border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]/70 shrink-0">
            <div className="space-y-1 pr-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#D4F82C] text-[#111215] shadow-2xs">
                  <Zap size={13} className="fill-[#111215]" />
                  <span>Verified Role Invitation • #{targetJobData.accessCode || targetJobId}</span>
                </span>

                <button
                  type="button"
                  onClick={() => togglePlayAudio(targetJobData)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    playingJobId === targetJobData.id
                      ? 'bg-[#111215] text-[#D4F82C] border-[#111215] dark:bg-[#D4F82C] dark:text-[#111215]'
                      : 'bg-white dark:bg-white/10 text-[#111215] dark:text-white border-[#E4E7DC] dark:border-white/10 hover:bg-[#D4F82C] dark:hover:bg-[#D4F82C] hover:text-[#111215]'
                  }`}
                  title="Listen to AI Audio Job Description"
                >
                  {playingJobId === targetJobData.id ? (
                    <>
                      <VolumeX size={13} className="text-red-500 animate-pulse" />
                      <span>Stop Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                      <span>Audio JD</span>
                    </>
                  )}
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-[#111215] dark:text-white truncate mt-1">
                {targetJobData.title || 'Open Position'}
              </h2>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#575A51] dark:text-neutral-400">
                <Building2 size={14} className="shrink-0 text-[#8FB305] dark:text-[#D4F82C]" />
                <span className="truncate">{targetJobData.company || 'Hiring Partner'}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Verified Role
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTargetJdModal(false)}
              className="p-2 rounded-full text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white hover:bg-[#E4E7DC]/60 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-6">
            {/* Core Specifications 3x2 Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-1">
                  Location
                </span>
                <div className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5 truncate">
                  <MapPin size={14} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                  <span className="truncate">{targetJobData.location || 'Remote / Hybrid'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-1">
                  Experience Required
                </span>
                <div className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5 truncate">
                  <Clock size={14} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                  <span className="truncate">{targetJobData.experience || 'Any Experience'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-1">
                  Salary / Compensation
                </span>
                <div className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5 truncate">
                  <TrendingUp size={14} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                  <span className="truncate">{targetJobData.salary || 'Competitive CTC'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-1">
                  Employment Type
                </span>
                <div className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5 truncate">
                  <Briefcase size={14} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                  <span className="truncate">{targetJobData.employmentType || 'Full-Time'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-1">
                  Education / Qualification
                </span>
                <div className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5 truncate">
                  <GraduationCap size={14} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                  <span className="truncate">{targetJobData.qualification || targetJobData.education || 'Graduate / Relevant Degree'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-1">
                  Department
                </span>
                <div className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5 truncate">
                  <Layers size={14} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                  <span className="truncate">{targetJobData.department || 'General'}</span>
                </div>
              </div>
            </div>

            {/* Required Core Skills */}
            {targetJobData.skills && targetJobData.skills.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                  <span>Key Skills & Technical Requirements</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {targetJobData.skills.map((skill: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F8F9F5] dark:bg-[#1D1F24] text-[#111215] dark:text-white border border-[#E4E7DC] dark:border-white/10"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Complete Job Description */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 flex items-center gap-1.5">
                <FileText size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                <span>Complete Job Description & Deliverables</span>
              </h3>
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5 text-xs sm:text-sm leading-relaxed text-[#111215] dark:text-neutral-200 whitespace-pre-line font-normal selection:bg-[#D4F82C] selection:text-[#111215]">
                {targetJobData.description || targetJobData.jobDescription || 'No detailed text description provided for this opening. Please refer to role specifications above.'}
              </div>
            </div>

            {/* Key Responsibilities if specified */}
            {targetJobData.responsibilities && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                  Key Responsibilities
                </h3>
                <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/80 dark:border-white/5 text-xs sm:text-sm leading-relaxed text-[#111215] dark:text-neutral-200 whitespace-pre-line">
                  {targetJobData.responsibilities}
                </div>
              </div>
            )}

            {/* Recruiter / Desk Verified Stamp */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#73766C] dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
                <span>Posted by {targetJobData.recruiterName || 'Verified Recruiting Desk'}</span>
              </div>
              {targetJobData.deadline && (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Deadline: {targetJobData.deadline}
                </span>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:px-7 border-t border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]/70 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowTargetJdModal(false)}
              className="px-4 py-2.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-xs font-bold text-[#575A51] dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Close
            </button>

            {candidate ? (
              <button
                type="button"
                onClick={() => {
                  setShowTargetJdModal(false);
                  handleApplyToJob(targetJobData);
                }}
                disabled={isAlreadyApplied}
                className="px-6 py-2.5 rounded-xl bg-[#D4F82C] hover:bg-[#C2E820] text-[#111215] font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAlreadyApplied ? (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-800" />
                    <span>Already Applied</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} className="fill-[#111215]" />
                    <span>1-Tap Apply to Role</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowTargetJdModal(false);
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="px-6 py-2.5 rounded-xl bg-[#D4F82C] hover:bg-[#C2E820] text-[#111215] font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Zap size={14} className="fill-[#111215]" />
                <span>Apply for this Job</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Reusable Resume Preview Modal ──
  const renderResumePreviewModal = () => {
    if (!previewResumeModalUrl) return null;

    const candName = candidate?.resumeOriginalName || autofetchedCandidate?.resumeName || 'Candidate Resume Preview';

    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
        <div className={`relative w-full max-w-5xl h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border ${
          isDark ? 'bg-[#121218] border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-emerald-500" />
              <span className="text-sm font-bold truncate max-w-xs sm:max-w-md">
                {candName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewResumeModalUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                  isDark ? 'border-white/10 hover:bg-white/5 text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Download File"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewResumeModalUrl(null)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-black hover:bg-slate-100'
                }`}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 w-full bg-slate-900/60 relative">
            <iframe
              src={
                previewResumeModalUrl.toLowerCase().includes('.doc')
                  ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewResumeModalUrl)}`
                  : previewResumeModalUrl
              }
              className="w-full h-full border-0"
              title="Resume Fullscreen Viewer"
            />
          </div>
        </div>
      </div>
    );
  };

  // If NOT logged in -> Render Dedicated Candidate Login Screen
  if (!candidate) {
    const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const urlParams = new URLSearchParams(location.search || hashPart || window.location.search);

    return (
      <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col justify-between selection:bg-[#D4F82C] selection:text-[#111215] relative overflow-hidden transition-colors duration-300 font-sans">
        {/* ── Background Organic Glow Curve (Landing Page Signature) ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 opacity-40 dark:opacity-20">
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="candCurveGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D4F82C" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#8FB305" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#D4F82C" stopOpacity="0.3" />
              </linearGradient>
              <filter id="candBlur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="35" result="blur" />
              </filter>
            </defs>
            <path
              d="M 120,0 C 260,200 480,180 720,340 C 960,500 1200,420 1380,720"
              stroke="url(#candCurveGlow)"
              strokeWidth="48"
              strokeLinecap="round"
              filter="url(#candBlur)"
            />
            <path
              d="M 120,0 C 260,200 480,180 720,340 C 960,500 1200,420 1380,720"
              stroke="#D4F82C"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 12"
              opacity="0.45"
            />
          </svg>
        </div>

        {/* ── Top Header Navigation ── */}
        <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <HireXLogo size="md" withLink to="/" isDark={isDark} />
            <div className="hidden sm:block h-5 w-px bg-[#E4E7DC] dark:bg-white/10" />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E4E7DC]/50 dark:bg-white/5 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC] dark:border-white/10 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-[#8FB305] animate-pulse"></span>
              <span>Candidate Career Portal</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-[#575A51] dark:text-neutral-300 transition-all shadow-2xs cursor-pointer"
              title={isDark ? "Switch to Day Mode" : "Switch to Night Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={15} className="text-[#D4F82C]" /> : <Moon size={15} className="text-[#111215]" />}
            </button>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-[#E4E7DC] dark:border-white/10 transition-all shadow-2xs backdrop-blur-sm"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Back to</span> Home
            </Link>

            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#111215] dark:text-white bg-[#E4E7DC]/70 dark:bg-white/10 hover:bg-[#D4F82C] dark:hover:bg-[#D4F82C] hover:text-[#111215] dark:hover:text-[#111215] border border-[#E4E7DC] dark:border-white/10 transition-all shadow-2xs backdrop-blur-sm"
            >
              <span>Recruiter Desk</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </header>

        {/* ── Main Dual-Stage Container ── */}
        <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 my-auto flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* ══════════════════════════════════════════════
                LEFT SIDE: Targeted Job Dossier OR Launchpad
               ══════════════════════════════════════════════ */}
            <div className="hidden lg:flex lg:col-span-7 flex-col gap-6 pr-4">
              {targetJobId ? (
                /* ── TARGETED JOB INVITE DOSSIER ── */
                <>
                  <div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D4F82C] text-[#111215] shadow-xs mb-3">
                      <Zap size={14} className="fill-[#111215]" />
                      Direct Job Invite • 1-Tap Application
                    </div>
                    <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-[#111215] dark:text-white leading-[1.18]">
                      Apply for <span className="underline decoration-[#D4F82C] decoration-4 underline-offset-4">{targetJobData?.title || 'Job Opening'}</span>
                    </h1>
                    <p className="mt-2 text-sm text-[#575A51] dark:text-neutral-400 leading-relaxed max-w-xl">
                      You were invited by <strong>{targetJobData?.company || 'our hiring partner'}</strong>. Enter your email on the right to auto-fetch your verified ATS profile and apply with a single tap.
                    </p>
                  </div>

                  {/* Target Job Detail Card */}
                  <div className="relative rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white/90 dark:bg-[#15161A]/90 p-6 shadow-xl backdrop-blur-md overflow-hidden group">
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#D4F82C]/15 rounded-full blur-3xl pointer-events-none"></div>

                    {/* Top company bar */}
                    <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold text-sm shadow-xs">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                              {targetJobData?.company || 'Hiring Partner'}
                            </span>
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FB305] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8FB305]"></span>
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[#111215] dark:text-white">
                            {targetJobData?.title || 'Open Position'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {targetJobData && (
                          <button
                            type="button"
                            onClick={() => togglePlayAudio(targetJobData)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#E4E7DC]/70 dark:bg-white/10 text-[#111215] dark:text-white hover:bg-[#D4F82C] dark:hover:bg-[#D4F82C] hover:text-[#111215] dark:hover:text-[#111215] transition-all cursor-pointer shadow-2xs"
                            title="Listen to AI Audio Job Description"
                          >
                            {playingJobId === targetJobData.id ? (
                              <>
                                <VolumeX size={13} className="text-red-500 animate-pulse" />
                                <span>Stop Audio</span>
                              </>
                            ) : (
                              <>
                                <Volume2 size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                                <span>Audio JD</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowTargetJdModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-white dark:text-[#111215] hover:opacity-90 transition-all cursor-pointer shadow-2xs"
                          title="View Complete Job Description"
                        >
                          <FileText size={13} />
                          <span>View Full JD ↗</span>
                        </button>
                      </div>
                    </div>

                    {/* Requirement Badges Grid */}
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Location</span>
                        <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1 truncate">
                          <MapPin size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                          <span className="truncate">{targetJobData?.location || 'Remote'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Experience</span>
                        <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1 truncate">
                          <Clock size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                          <span className="truncate">{targetJobData?.experience || 'Any'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Salary</span>
                        <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1 truncate">
                          <TrendingUp size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                          <span className="truncate">{targetJobData?.salary || 'Competitive'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Type</span>
                        <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1 truncate">
                          <Briefcase size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                          <span className="truncate">{targetJobData?.employmentType || 'Full-Time'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Extra Badges if present */}
                    {(targetJobData?.qualification || targetJobData?.department) && (
                      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                        {targetJobData?.qualification && (
                          <div className="p-2 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Education</span>
                            <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1 truncate">
                              <GraduationCap size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                              <span className="truncate">{targetJobData.qualification}</span>
                            </div>
                          </div>
                        )}
                        {targetJobData?.department && (
                          <div className="p-2 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Department</span>
                            <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1 truncate">
                              <Layers size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                              <span className="truncate">{targetJobData.department}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Key Skills */}
                    {targetJobData?.skills && targetJobData.skills.length > 0 && (
                      <div className="mt-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block mb-2">Key Skills Looked For:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {targetJobData.skills.slice(0, 8).map((sk: string, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E4E7DC]/60 dark:bg-white/10 text-[#111215] dark:text-white border border-[#E4E7DC] dark:border-white/10">
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Complete Job Description (JD) Section */}
                    {targetJobData?.description && (
                      <div className="mt-4 pt-3.5 border-t border-[#E4E7DC]/60 dark:border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 flex items-center gap-1.5">
                            <FileText size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                            Job Description & Requirements
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowTargetJdModal(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8FB305] dark:text-[#D4F82C] hover:underline cursor-pointer"
                          >
                            <span>Open Full Modal</span>
                            <ExternalLink size={11} />
                          </button>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5">
                          <p className={`text-xs text-[#575A51] dark:text-neutral-300 leading-relaxed whitespace-pre-line ${!isJdExpanded ? 'line-clamp-4' : ''}`}>
                            {targetJobData.description}
                          </p>
                          {targetJobData.description.length > 220 && (
                            <button
                              type="button"
                              onClick={() => setIsJdExpanded(!isJdExpanded)}
                              className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#111215] dark:text-white hover:text-[#8FB305] dark:hover:text-[#D4F82C] transition-colors cursor-pointer"
                            >
                              <span>{isJdExpanded ? 'Show Less' : 'Read Full Description'}</span>
                              {isJdExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Security Seal */}
                  <div className="flex items-center gap-2.5 text-xs text-[#73766C] dark:text-neutral-400">
                    <ShieldCheck size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    <span>Verified Job Invite #{targetJobData?.accessCode || targetJobId} • 1-Tap application dispatched instantly to recruiter.</span>
                  </div>
                </>
              ) : (
                /* ── STANDARD MARKETING LAUNCHPAD (when no job is specified) ── */
                <>
                  <div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D4F82C] text-[#111215] shadow-xs mb-4">
                      <Sparkles size={14} className="fill-[#111215]" />
                      Career Launchpad • AI-Powered
                    </div>
                    <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-[#111215] dark:text-white leading-[1.12]">
                      Fast-track your dream role with <span className="underline decoration-[#D4F82C] decoration-4 underline-offset-4">intelligent matching</span>.
                    </h1>
                    <p className="mt-3.5 text-base text-[#575A51] dark:text-neutral-400 max-w-xl leading-relaxed">
                      Log in to track your hiring stages, take autonomous AI voice interviews, view skill match scores, and 1-click apply to top companies.
                    </p>
                  </div>

                  {/* Bento Feature Card: AI Talent Match Simulation */}
                  <div className="relative rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white/85 dark:bg-[#15161A]/85 p-6 shadow-xl backdrop-blur-md overflow-hidden group hover:border-[#111215]/30 dark:hover:border-white/20 transition-all">
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#D4F82C]/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold text-sm shadow-xs">
                          <Brain size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                              Automated Candidate Radar
                            </span>
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FB305] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8FB305]"></span>
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[#111215] dark:text-white">
                            Senior Cloud & Distributed Systems Engineer
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-black shadow-xs">
                        <Zap size={13} className="fill-[#111215]" />
                        96% MATCH
                      </div>
                    </div>

                    <div className="mt-4 flex items-start justify-between bg-[#F8F9F5] dark:bg-[#1D1F24] p-4 rounded-2xl border border-[#E4E7DC]/60 dark:border-white/5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#111215] to-[#34373F] text-white flex items-center justify-center font-bold text-sm border-2 border-white dark:border-[#15161A] shadow-xs">
                          <UserRound size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5">
                            Your Verified ATS Profile
                            <CheckCircle2 size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                          </h4>
                          <p className="text-xs text-[#575A51] dark:text-neutral-400">
                            Resume parsed • Ready for 1-click hiring pipeline
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E4E7DC] dark:bg-white/10 text-[#111215] dark:text-white">
                        Direct Invite Ready
                      </span>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                        <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                        <span className="truncate font-medium">Real-Time Application Tracking</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                        <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                        <span className="truncate font-medium">Audio AI Job Summaries</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                        <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                        <span className="truncate font-medium">Instant 1-Click Applications</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                        <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                        <span className="truncate font-medium">Verified Direct Recruiter Access</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#15161A]/70 border border-[#E4E7DC] dark:border-white/10 shadow-xs backdrop-blur-xs">
                      <div className="text-xl xl:text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                        1<span className="text-[#8FB305] dark:text-[#D4F82C]">-Click</span>
                      </div>
                      <p className="text-[11px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                        Fast Application Sync
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#15161A]/70 border border-[#E4E7DC] dark:border-white/10 shadow-xs backdrop-blur-xs">
                      <div className="text-xl xl:text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                        &lt; 24<span className="text-[#8FB305] dark:text-[#D4F82C]">h</span>
                      </div>
                      <p className="text-[11px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                        Review Turnaround
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#15161A]/70 border border-[#E4E7DC] dark:border-white/10 shadow-xs backdrop-blur-xs">
                      <div className="text-xl xl:text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                        100<span className="text-[#8FB305] dark:text-[#D4F82C]">%</span>
                      </div>
                      <p className="text-[11px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                        Free for Candidates
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#73766C] dark:text-neutral-400">
                    <ShieldCheck size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    <span>Protected Candidate Vault • Zero unsolicited spam • Powered by SNAB Innovations</span>
                  </div>
                </>
              )}
            </div>

            {/* ══════════════════════════════════════════════
                RIGHT SIDE: Express 1-Tap Apply OR Auth Card
               ══════════════════════════════════════════════ */}
            <div className="lg:col-span-5 w-full space-y-4">
              {/* Mobile/Tablet Target Job Card (Visible on screens < lg) */}
              {targetJobId && targetJobData && (
                <div className="lg:hidden p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 shadow-xl space-y-3 relative overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#D4F82C] text-[#111215] mb-1.5 shadow-2xs">
                        <Zap size={11} className="fill-[#111215]" />
                        <span>Role Invitation #{targetJobData.accessCode || targetJobId}</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-[#111215] dark:text-white leading-snug truncate">
                        {targetJobData.title}
                      </h2>
                      <p className="text-xs text-[#73766C] dark:text-neutral-400 mt-0.5 flex items-center gap-1.5 truncate">
                        <Building2 size={13} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                        <span className="truncate">{targetJobData.company}</span>
                        <span>•</span>
                        <span className="truncate">{targetJobData.location}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => togglePlayAudio(targetJobData)}
                        className="p-2 rounded-full bg-[#E4E7DC]/60 dark:bg-white/10 text-[#111215] dark:text-white hover:bg-[#D4F82C] transition-all cursor-pointer shadow-2xs"
                        title="Listen to AI Audio JD"
                      >
                        {playingJobId === targetJobData.id ? (
                          <VolumeX size={14} className="text-red-500 animate-pulse" />
                        ) : (
                          <Volume2 size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTargetJdModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <FileText size={12} />
                        <span>View Full JD</span>
                      </button>
                    </div>
                  </div>

                  {/* Badges 2x2 */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5 truncate">
                      <span className="text-[9px] font-bold uppercase text-[#73766C] dark:text-neutral-400 block">Experience</span>
                      <span className="font-bold text-[#111215] dark:text-white truncate block">{targetJobData.experience || 'Any'}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5 truncate">
                      <span className="text-[9px] font-bold uppercase text-[#73766C] dark:text-neutral-400 block">Salary / CTC</span>
                      <span className="font-bold text-[#111215] dark:text-white truncate block">{targetJobData.salary || 'Competitive'}</span>
                    </div>
                  </div>

                  {/* JD Excerpt with Expand or Modal */}
                  {targetJobData.description && (
                    <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC]/60 dark:border-white/5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 flex items-center gap-1">
                          <FileText size={11} className="text-[#8FB305] dark:text-[#D4F82C]" />
                          Job Description (JD)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTargetJdModal(true)}
                          className="text-[10px] font-bold text-[#8FB305] dark:text-[#D4F82C] hover:underline cursor-pointer"
                        >
                          Open Full Modal ↗
                        </button>
                      </div>
                      <p className={`text-xs text-[#575A51] dark:text-neutral-300 leading-relaxed whitespace-pre-line ${!isJdExpanded ? 'line-clamp-3' : ''}`}>
                        {targetJobData.description}
                      </p>
                      {targetJobData.description.length > 160 && (
                        <button
                          type="button"
                          onClick={() => setIsJdExpanded(!isJdExpanded)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#111215] dark:text-white hover:underline cursor-pointer"
                        >
                          <span>{isJdExpanded ? 'Show Less' : 'Read More'}</span>
                          {isJdExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="relative rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
                
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-24 bg-[#D4F82C] rounded-b-full"></div>

                {/* ─────────────────────────────────────────────────────────────
                    STATE A: SUCCESS CELEBRATION (After 1-Tap Apply clicked)
                   ───────────────────────────────────────────────────────────── */}
                {oneTapApplySuccess ? (
                  <div className="py-2 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold shadow-lg animate-bounce">
                      <CheckCircle2 size={36} strokeWidth={2.5} />
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#8FB305] dark:text-[#D4F82C] px-3 py-1 rounded-full bg-[#D4F82C]/15 border border-[#8FB305]/30 mb-2">
                        <Sparkles size={13} />
                        1-Tap Apply Confirmed!
                      </span>
                      <h2 className="text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                        Application Submitted! 🎉
                      </h2>
                      <p className="mt-1.5 text-xs text-[#575A51] dark:text-neutral-300 leading-relaxed">
                        Hi <strong>{oneTapApplySuccess.candidateName}</strong>, your application for <strong>{oneTapApplySuccess.jobTitle}</strong> at <strong>{oneTapApplySuccess.company}</strong> has been registered directly with the recruitment desk.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 flex items-center justify-between text-xs">
                      <span className="text-[#575A51] dark:text-neutral-400 font-medium">Status</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                        Under Review
                      </span>
                    </div>

                    <div className="space-y-2 pt-2">
                      {oneTapApplySuccess.hasInterview && (
                        <button
                          type="button"
                          onClick={() => navigate(`/interview/video/${oneTapApplySuccess.jobId}`)}
                          className="w-full h-11 sm:h-12 rounded-2xl bg-[#D4F82C] hover:bg-[#C2E820] text-[#111215] font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles size={16} />
                          <span>Start Autonomous AI Assessment</span>
                          <ArrowRight size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          // Already authenticated in state/localStorage, refresh into dashboard view
                          window.location.href = '/candidate';
                        }}
                        className="w-full h-11 rounded-2xl bg-[#111215] hover:bg-[#202227] dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-[#111215] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Go to My Candidate Portal</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ) : targetJobId && !useLegacyLogin ? (
                  /* ─────────────────────────────────────────────────────────────
                      STATE B: EXPRESS 1-TAP APPLY FLOW (When targetJobId present)
                     ───────────────────────────────────────────────────────────── */
                  <div>
                    {/* Header */}
                    <div className="mb-5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#73766C] dark:text-neutral-400 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4F82C]"></span>
                        Fast-Track Application
                      </span>
                      <h2 className="text-2xl font-black tracking-tight text-[#111215] dark:text-white">
                        1-Tap Job Application
                      </h2>
                      <p className="mt-1 text-xs text-[#575A51] dark:text-neutral-400">
                        Enter your email below. We'll automatically fetch your profile from our talent vault for instant 1-tap apply.
                      </p>
                    </div>

                    {/* Target Role Chip inside the Form */}
                    <div className="mb-4 p-3 rounded-2xl bg-[#D4F82C]/15 dark:bg-[#D4F82C]/10 border border-[#8FB305]/30 dark:border-[#D4F82C]/20 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center shrink-0 shadow-2xs">
                          <Briefcase size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8FB305] dark:text-[#D4F82C] truncate">
                            Target Opening
                          </div>
                          <div className="text-xs font-bold text-[#111215] dark:text-white truncate">
                            {targetJobData?.title || 'Open Position'} • {targetJobData?.company || 'Hiring Partner'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTargetJdModal(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white dark:bg-[#1D1F24] text-[#111215] dark:text-white hover:bg-[#D4F82C] dark:hover:bg-[#D4F82C] hover:text-[#111215] dark:hover:text-[#111215] border border-[#E4E7DC] dark:border-white/10 transition-all shrink-0 cursor-pointer shadow-2xs"
                        title="View Full Job Description"
                      >
                        <FileText size={12} />
                        <span>View Full JD</span>
                      </button>
                    </div>

                    {/* Email Input Field with Live Auto-Fetch Indicator */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                          Candidate Email Address
                        </label>
                        {autofetchLoading && (
                          <span className="text-[11px] font-bold text-[#8FB305] dark:text-[#D4F82C] flex items-center gap-1">
                            <RefreshCw size={11} className="animate-spin" />
                            Fetching profile…
                          </span>
                        )}
                        {!autofetchLoading && autofetchedCandidate && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-[#D4F82C] flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Profile Verified
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                          <Mail size={17} />
                        </span>
                        <input
                          type="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="e.g. candidate@example.com"
                          className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all font-medium"
                        />
                      </div>
                    </div>

                    {/* Auth/Validation Error banner */}
                    {autofetchError && (
                      <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0 text-red-600" />
                        <span>{autofetchError}</span>
                      </div>
                    )}

                    {/* ── Sub-Scenario 1: Autofetched Profile Found! ── */}
                    {autofetchedCandidate ? (
                      <div className="space-y-3.5">
                        {/* Auto-Fetched Candidate Profile Card */}
                        <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold text-xs shadow-xs">
                                {autofetchedCandidate.name?.slice(0, 2).toUpperCase() || 'CV'}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1.5">
                                  {autofetchedCandidate.name}
                                  <CheckCircle2 size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                                </h4>
                                <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                                  {autofetchedCandidate.phone || autofetchedCandidate.email}
                                </p>
                              </div>
                            </div>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4F82C] text-[#111215]">
                              Vault Profile
                            </span>
                          </div>

                          {/* Attached Resume */}
                          {autofetchedCandidate.resumeUrl ? (
                            <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15161A] border border-[#E4E7DC]/60 dark:border-white/5 text-xs">
                              <span className="flex items-center gap-1.5 font-medium text-[#111215] dark:text-neutral-200 truncate">
                                <FileText size={14} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                                <span className="truncate">{autofetchedCandidate.resumeName || 'Verified_Resume.pdf'}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setPreviewResumeModalUrl(autofetchedCandidate.resumeUrl)}
                                className="text-[11px] font-bold text-[#8FB305] dark:text-[#D4F82C] hover:underline shrink-0 ml-2 cursor-pointer"
                              >
                                View Resume
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#73766C] dark:text-neutral-400">
                              Resume profile verified and linked.
                            </div>
                          )}

                          {/* Matching Skills */}
                          {autofetchedCandidate.skills && autofetchedCandidate.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {autofetchedCandidate.skills.slice(0, 5).map((sk: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-[#15161A] text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC]/60 dark:border-white/5">
                                  {sk}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* If Already Applied to this Target Job */}
                        {targetJobAlreadyApplied ? (
                          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                            <div className="flex items-center gap-2 font-bold">
                              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                              <span>You have already applied for this role!</span>
                            </div>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                              Application Status: <strong>{targetJobAlreadyApplied.status || 'Under Review'}</strong>
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const activeSession = {
                                  id: autofetchedCandidate.id,
                                  name: autofetchedCandidate.name,
                                  email: autofetchedCandidate.email,
                                  phone: autofetchedCandidate.phone,
                                  resumeUrl: autofetchedCandidate.resumeUrl,
                                  skills: autofetchedCandidate.skills,
                                };
                                localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(activeSession));
                                setCandidate(activeSession);
                              }}
                              className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>Enter Candidate Portal Dashboard</span>
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        ) : (
                          /* ONE-TAP APPLY BUTTON */
                          <button
                            type="button"
                            disabled={isOneTapApplying}
                            onClick={executeOneTapApply}
                            className="w-full h-12 rounded-2xl bg-[#D4F82C] hover:bg-[#C2E820] text-[#111215] font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isOneTapApplying ? (
                              <>
                                <RefreshCw size={16} className="animate-spin" />
                                <span>Submitting 1-Tap Application…</span>
                              </>
                            ) : (
                              <>
                                <Zap size={16} className="fill-[#111215]" />
                                <span>Confirm & 1-Tap Apply</span>
                                <ArrowRight size={16} />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : autofetchNotFound && emailInput && emailInput.includes('@') ? (
                      /* ── Sub-Scenario 2: Email not found in vault -> Quick Register ── */
                      <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#111215] dark:text-white">
                          <Sparkles size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                          <span>Quick 10-Second 1-Tap Registration</span>
                        </div>
                        <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                          We didn't find a prior resume for this email. Enter your details to complete your 1-tap application:
                        </p>

                        <div className="space-y-2">
                          <input
                            type="text"
                            required
                            value={quickName}
                            onChange={(e) => setQuickName(e.target.value)}
                            placeholder="Your Full Name"
                            className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 text-xs text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C]"
                          />
                          <input
                            type="tel"
                            required
                            value={quickPhone}
                            onChange={(e) => setQuickPhone(e.target.value)}
                            placeholder="Your Mobile Phone Number"
                            className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 text-xs text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C]"
                          />

                          {/* Quick Resume Upload Drop */}
                          <label className="flex items-center justify-between p-2.5 rounded-xl border border-dashed border-[#E4E7DC] dark:border-white/20 hover:border-[#111215] dark:hover:border-[#D4F82C] bg-white dark:bg-[#15161A] cursor-pointer transition-all text-xs">
                            <span className="flex items-center gap-2 text-[#575A51] dark:text-neutral-300 truncate">
                              <UploadCloud size={15} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                              <span className="truncate">
                                {isUploadingQuickResume ? 'Uploading resume…' : quickResumeFile ? quickResumeFile.name : 'Attach Resume (PDF / Word)'}
                              </span>
                            </span>
                            <span className="text-[11px] font-bold text-[#8FB305] dark:text-[#D4F82C] shrink-0">
                              Browse
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleQuickResumeUpload(f);
                              }}
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          disabled={isOneTapApplying || isUploadingQuickResume || !quickName}
                          onClick={executeOneTapApply}
                          className="w-full h-11 rounded-2xl bg-[#D4F82C] hover:bg-[#C2E820] text-[#111215] font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                        >
                          <Zap size={14} className="fill-[#111215]" />
                          <span>Submit 1-Tap Application</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      /* ── Sub-Scenario 3: Initial Empty State ── */
                      <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-center space-y-2">
                        <div className="w-10 h-10 mx-auto rounded-2xl bg-white dark:bg-[#15161A] text-[#8FB305] dark:text-[#D4F82C] flex items-center justify-center font-bold">
                          <Sparkles size={20} />
                        </div>
                        <p className="text-xs font-bold text-[#111215] dark:text-white">
                          Type your email to unlock 1-Tap Apply
                        </p>
                        <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                          Your resume, contact details, and skill match will be automatically verified from our talent vault.
                        </p>
                      </div>
                    )}

                    {/* Switch to standard login fallback */}
                    <div className="mt-5 pt-3.5 border-t border-[#E4E7DC] dark:border-white/10 text-center">
                      <button
                        type="button"
                        onClick={() => setUseLegacyLogin(true)}
                        className="text-xs font-semibold text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white transition-colors cursor-pointer"
                      >
                        Prefer password or Google sign-in? Switch to Standard Login →
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ─────────────────────────────────────────────────────────────
                      STATE C: STANDARD CREDENTIALS LOGIN (Fallback or no targetJob)
                     ───────────────────────────────────────────────────────────── */
                  <div>
                    {targetJobId && (
                      <button
                        type="button"
                        onClick={() => setUseLegacyLogin(false)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8FB305] dark:text-[#D4F82C] mb-4 hover:underline cursor-pointer"
                      >
                        <ArrowLeft size={13} />
                        <span>Back to Express 1-Tap Apply</span>
                      </button>
                    )}

                    {/* Card Header */}
                    <div className="mb-6">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#73766C] dark:text-neutral-400 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4F82C]"></span>
                        Candidate Portal
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111215] dark:text-white">
                        Candidate Login
                      </h2>
                      <p className="mt-1.5 text-xs sm:text-sm text-[#575A51] dark:text-neutral-400">
                        Sign in with your registered <strong>Email</strong> and <strong>Phone Number</strong> (as password).
                      </p>
                    </div>

                    {/* Auth Error Banner */}
                    {authError && (
                      <div className="mb-4 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 text-xs flex items-start gap-2.5 leading-relaxed">
                        <AlertCircle size={17} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                        <div className="flex-1">
                          <span>{authError}</span>
                          {authError.includes('upload your resume') && (
                            <div className="mt-2">
                              <Link
                                to="/upload-resume"
                                className="inline-flex items-center gap-1 font-bold text-[#111215] dark:text-white underline hover:no-underline"
                              >
                                <span>Upload Resume to create account</span>
                                <ArrowRight size={12} />
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Continue with Google ── */}
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={authLoading}
                        className="w-full h-11 sm:h-12 rounded-2xl bg-white dark:bg-[#1D1F24] hover:bg-[#F0F2EB] dark:hover:bg-[#252830] text-[#111215] dark:text-white border border-[#E4E7DC] dark:border-white/10 font-bold text-sm shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-3 group cursor-pointer disabled:opacity-50"
                      >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </button>

                      <div className="relative my-4 flex items-center justify-center">
                        <div className="border-t border-[#E4E7DC] dark:border-white/10 w-full" />
                        <span className="bg-white dark:bg-[#15161A] px-3 text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 absolute">
                          or sign in with credentials
                        </span>
                      </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                      {/* Email Field */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                          Email Address
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                            <Mail size={17} />
                          </span>
                          <input
                            type="email"
                            required
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="e.g. candidate@example.com"
                            autoComplete="email"
                            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all"
                          />
                        </div>
                      </div>

                      {/* Password (Phone Number) Field */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                            Password (Phone Number)
                          </label>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E4E7DC] dark:bg-white/10 text-[#575A51] dark:text-neutral-300">
                            Registered Mobile No.
                          </span>
                        </div>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                            <LockKeyhole size={17} />
                          </span>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={phonePasswordInput}
                            onChange={(e) => setPhonePasswordInput(e.target.value)}
                            placeholder="Enter registered mobile number"
                            autoComplete="current-password"
                            className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((p) => !p)}
                            className="absolute right-3 text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white p-1 transition-colors cursor-pointer"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="text-[11px] text-[#73766C] dark:text-neutral-400 mt-1 flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                          <span>Use the phone number listed on your submitted resume.</span>
                        </p>
                      </div>

                      {/* Remember Me */}
                      <div className="flex items-center justify-between pt-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="sr-only"
                          />
                          <span
                            className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                              rememberMe
                                ? 'bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215]'
                                : 'border border-[#E4E7DC] dark:border-white/20 bg-[#F8F9F5] dark:bg-[#1D1F24]'
                            }`}
                          >
                            {rememberMe && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="text-xs font-medium text-[#575A51] dark:text-neutral-300">
                            Stay signed in on this device
                          </span>
                        </label>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full h-11 sm:h-12 rounded-full bg-[#111215] hover:bg-[#202227] text-white dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] dark:text-[#111215] font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 mt-2"
                      >
                        <span>{authLoading ? 'Verifying profile…' : 'Sign In to Candidate Dashboard'}</span>
                        {!authLoading && <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />}
                      </button>
                    </form>

                    {/* ── New Candidate Upload Resume Bridge ── */}
                    <div className="mt-5 pt-4 border-t border-[#E4E7DC] dark:border-white/10">
                      <Link
                        to="/upload-resume"
                        className="group flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#F8F9F5] hover:bg-[#F0F2EB] dark:bg-[#1D1F24] dark:hover:bg-[#24272E] border border-[#E4E7DC] dark:border-white/10 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold shrink-0">
                            <UploadCloud size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1">
                              New here? Upload Resume
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#E4E7DC] dark:bg-white/10 text-[#575A51] dark:text-neutral-300">
                                Instant Register
                              </span>
                            </div>
                            <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                              Parse skills and get matched to high-paying jobs
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-[#73766C] dark:text-neutral-400 group-hover:translate-x-1 group-hover:text-[#111215] dark:group-hover:text-white transition-all shrink-0"
                        />
                      </Link>

                      <div className="mt-3 text-center text-xs text-[#73766C] dark:text-neutral-400">
                        Are you a Recruiter or Employer?{' '}
                        <Link to="/auth" className="font-bold text-[#111215] dark:text-white hover:underline cursor-pointer ml-1">
                          Recruiter Sign In →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        </main>

        {/* ── Footer ── */}
        <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 border-t border-[#E4E7DC]/60 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#73766C] dark:text-neutral-400">
          <div className="flex items-center gap-4">
            <Link to="/contact" className="hover:text-[#111215] dark:hover:text-white flex items-center gap-1 transition-colors">
              <Mail size={13} /> Support
            </Link>
            <Link to="/report-bug" className="hover:text-[#111215] dark:hover:text-white flex items-center gap-1 transition-colors">
              <Bug size={13} /> Report Issue
            </Link>
            <a
              href="https://snab.co.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#111215] dark:hover:text-white transition-colors"
            >
              SNAB Innovations
            </a>
          </div>
          <p>© {new Date().getFullYear()} InterviewXpert • Candidate Portal. All rights reserved.</p>
        </footer>

        {renderTargetJdModal()}
        {renderResumePreviewModal()}
      </div>
    );
  }

  // ==========================================
  // LOGGED IN: Candidate Dashboard View
  // ==========================================
  const candidateDisplayName = editForm.name || candidate?.name || 'Candidate';
  const candidateDisplayEmail = editForm.email || candidate?.email || '';
  const candidateDisplayPhone = editForm.phone || candidate?.phone || '';

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col font-sans selection:bg-[#D4F82C] selection:text-[#111215] transition-colors duration-300 relative">
      {/* ── Top Header Bar (Normal Light/Dark Unified ATS Header) ── */}
      <header className="sticky top-0 z-40 border-b border-[#E4E7DC] dark:border-white/10 bg-white/95 dark:bg-[#15161A]/95 text-[#111215] dark:text-[#F8F9F5] backdrop-blur-xl h-14 transition-colors">
        <div className="w-full h-full px-3 sm:px-4 lg:px-6 flex items-center justify-between relative">
          {/* Logo & Section Tag */}
          <div className="flex items-center gap-3">
            <HireXLogo size="md" withLink to="/" isDark={isDark} />
            <div className="h-5 w-px bg-[#E4E7DC] dark:bg-white/10 hidden sm:block" />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#E4E7DC]/60 dark:bg-white/10 text-[#111215] dark:text-neutral-200 border border-[#E4E7DC] dark:border-white/10">
              <span className="size-1.5 rounded-full bg-[#8FB305] animate-pulse" />
              Candidate Workspace
            </span>
          </div>

          {/* Centered Breadcrumb / Active Section Indicator */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white text-[11px] font-bold shadow-2xs">
              <span className="size-1.5 rounded-full bg-[#8FB305] animate-pulse" />
              <span>
                {activeTab === 'dashboard'
                  ? 'Dashboard Overview'
                  : activeTab === 'applied'
                  ? (appliedStageFilter === 'shortlisted' ? 'Interview Rounds' : 'Applications Pipeline')
                  : activeTab === 'assessments'
                  ? 'Skill Assessments'
                  : activeTab === 'assessment-results'
                  ? 'Assessment Results & Scorecards'
                  : activeTab === 'matches'
                  ? 'Matched Opportunities'
                  : activeTab === 'resume'
                  ? 'My Resume & CV'
                  : 'Profile & Skills'}
              </span>
            </span>
          </div>

          {/* Right Actions: Theme Switcher & Profile with Rounded Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Day / Night Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="size-8 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 hover:bg-[#F8F9F5] dark:hover:bg-white/10 text-[#575A51] dark:text-neutral-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
            </button>

            {/* Profile with Rounded Avatar & Interactive Popover */}
            <div className="relative group/avatar">
              <div className="flex items-center gap-2.5 cursor-pointer border-l border-[#E4E7DC] dark:border-white/10 pl-3 py-1">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold leading-none text-[#111215] dark:text-white truncate max-w-[140px]">
                    {candidateDisplayName}
                  </p>
                  <p className="text-[10px] text-[#73766C] dark:text-neutral-400 uppercase tracking-wider mt-0.5">
                    Candidate
                  </p>
                </div>

                {/* Rounded Avatar Circle */}
                <div className="relative">
                  <div className="size-8 sm:size-9 rounded-full ring-2 ring-[#D4F82C] p-0.5 bg-[#111] flex items-center justify-center overflow-hidden shadow-xs transition-transform group-hover/avatar:scale-105">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(candidateDisplayName)}&background=111215&color=D4F82C&bold=true`}
                      alt={candidateDisplayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-[#8FB305] ring-2 ring-white dark:ring-[#15161A]" />
                </div>
                <ChevronDown size={13} className="text-[#73766C] group-hover/avatar:text-[#111215] dark:group-hover/avatar:text-white transition-transform group-hover/avatar:rotate-180" />
              </div>

              {/* Hover Dropdown Menu */}
              <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#15161A] text-[#111215] dark:text-white rounded-2xl shadow-2xl border border-[#E4E7DC] dark:border-white/10 opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all duration-200 z-50 p-3.5 space-y-3">
                {/* Candidate Info Header */}
                <div className="p-3 rounded-xl bg-[#F8F9F5] dark:bg-[#1F232B] border border-[#E4E7DC] dark:border-white/10 flex items-center gap-3">
                  <div className="size-10 rounded-full ring-2 ring-[#D4F82C] p-0.5 bg-[#111215] shrink-0">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(candidateDisplayName)}&background=111215&color=D4F82C&bold=true`}
                      alt={candidateDisplayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-black truncate">{candidateDisplayName}</p>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-[#D4F82C] text-[#111215]">
                        Candidate
                      </span>
                    </div>
                    <p className="text-[11px] text-[#73766C] dark:text-neutral-400 truncate">{candidateDisplayEmail}</p>
                    {candidateDisplayPhone && (
                      <p className="text-[10px] text-[#73766C] dark:text-neutral-500 truncate">{candidateDisplayPhone}</p>
                    )}
                  </div>
                </div>

                {/* Resume Status & Change Action */}
                <div className="p-3 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#FAFAF8] dark:bg-[#18191E] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold truncate max-w-[190px]">
                      <FileText size={14} className="text-[#8FB305] shrink-0" />
                      <span className="truncate">
                        {candidate?.resumeFileName || (candidate?.resumeUrl ? 'Attached Resume.pdf' : 'No Resume Attached')}
                      </span>
                    </div>
                    {candidate?.resumeUrl && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                        ✓ Active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('resume');
                        if (candidate?.resumeUrl) setPreviewResumeModalUrl(candidate.resumeUrl);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215] dark:hover:border-[#D4F82C] text-[#111215] dark:text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>View CV</span>
                    </button>

                    <label className="px-2.5 py-1.5 rounded-lg text-[11px] font-black bg-[#111215] text-[#D4F82C] hover:bg-black transition-all flex items-center justify-center gap-1 cursor-pointer">
                      <UploadCloud size={12} />
                      <span>{isUploadingResume ? 'Saving…' : 'Change CV'}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        disabled={isUploadingResume}
                        onChange={handleUploadNewResume}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Navigation Shortcuts */}
                <div className="space-y-1 pt-1 border-t border-[#E4E7DC] dark:border-white/10 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'dashboard'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'hover:bg-[#F8F9F5] dark:hover:bg-white/5 text-[#575A51] dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutDashboard size={14} />
                      <span>Dashboard Overview</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('matches')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'matches'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'hover:bg-[#F8F9F5] dark:hover:bg-white/5 text-[#575A51] dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={14} />
                      <span>Matched Roles</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                      {matchedJobs.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('applied')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'applied'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'hover:bg-[#F8F9F5] dark:hover:bg-white/5 text-[#575A51] dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase size={14} />
                      <span>My Applications</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                      {myApplicationsList.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('assessments')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'assessments'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'hover:bg-[#F8F9F5] dark:hover:bg-white/5 text-[#575A51] dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FileCheck size={14} />
                      <span>Skill Assessments</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('assessment-results')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'assessment-results'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'hover:bg-[#F8F9F5] dark:hover:bg-white/5 text-[#575A51] dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Award size={14} />
                      <span>Assessment Results</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('resume')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'resume'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'hover:bg-[#F8F9F5] dark:hover:bg-white/5 text-[#575A51] dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={14} />
                      <span>My Resume CV</span>
                    </span>
                    <span className="text-[10px] text-[#8FB305] font-bold">
                      {candidate?.resumeUrl ? 'Active' : 'Missing'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('edit-profile')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'edit-profile'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'hover:bg-[#F8F9F5] dark:hover:bg-white/5 text-[#575A51] dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Edit3 size={14} />
                      <span>Edit Profile</span>
                    </span>
                    <ChevronRight size={13} className="text-[#73766C]" />
                  </button>
                </div>

                {/* Popover Footer: Sign Out */}
                <div className="pt-2 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-[#73766C] dark:text-neutral-400 font-medium">Candidate Session</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ATS Workspace Body Row (Natural Viewport Sticky Sidebar) ── */}
      <div className="flex w-full flex-1">
        {/* ── Left Fixed Sticky Sidebar (Identical to Recruiter DashboardSidebar) ── */}
        <aside className="sticky top-14 hidden md:flex h-[calc(100vh-3.5rem)] shrink-0 w-[205px] flex-col justify-between border-r border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-2.5 pt-3.5 font-sans z-30 select-none">
          <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
              Candidate Desk
            </span>

            {/* Item 0: Dashboard */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <LayoutDashboard
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'dashboard'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">Dashboard</span>
            </button>

            {/* Item 1: Matched Jobs (Directly after Dashboard) */}
            <button
              type="button"
              onClick={() => setActiveTab('matches')}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'matches'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <Sparkles
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'matches'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">Matched Jobs</span>
            </button>

            {/* Item 2: Applications */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('applied');
                setAppliedStageFilter('all');
              }}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'applied' && appliedStageFilter === 'all'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <Briefcase
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'applied' && appliedStageFilter === 'all'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">Applications</span>
            </button>

            {/* Item 3: Shortlisted Rounds */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('applied');
                setAppliedStageFilter('shortlisted');
              }}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'applied' && appliedStageFilter === 'shortlisted'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <Calendar
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'applied' && appliedStageFilter === 'shortlisted'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">Shortlisted</span>
            </button>

            {/* Item 4: Assessments */}
            <button
              type="button"
              onClick={() => setActiveTab('assessments')}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'assessments'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <FileCheck
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'assessments'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">Assessments</span>
            </button>

            {/* Item 5: Assessment Results */}
            <button
              type="button"
              onClick={() => setActiveTab('assessment-results')}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'assessment-results'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <Award
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'assessment-results'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">Assessment Results</span>
            </button>

            {/* Item 4: My Resume */}
            <button
              type="button"
              onClick={() => setActiveTab('resume')}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'resume'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <FileText
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'resume'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">My Resume</span>
            </button>

            {/* Item 5: Edit Profile & Skills */}
            <button
              type="button"
              onClick={() => setActiveTab('edit-profile')}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer ${
                activeTab === 'edit-profile'
                  ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] font-bold shadow-xs'
                  : 'text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium'
              }`}
            >
              <UserCheck
                className={`size-4 shrink-0 transition-colors ${
                  activeTab === 'edit-profile'
                    ? 'text-[#D4F82C] dark:text-[#111215]'
                    : 'text-[#73766C] group-hover:text-[#111215] dark:group-hover:text-white'
                }`}
                strokeWidth={1.8}
              />
              <span className="text-xs truncate">Profile & Skills</span>
            </button>
          </div>

          {/* Bottom Section: 1-Click Change Resume & Sign Out */}
          <div className="space-y-1 pt-2 border-t border-[#E4E7DC] dark:border-white/10 shrink-0">
            <label className="group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-all text-[#575A51] dark:text-neutral-400 hover:bg-[#F8F9F5] dark:hover:bg-white/5 hover:text-[#111215] dark:hover:text-white font-medium cursor-pointer">
              <UploadCloud size={14} className="text-[#8FB305] shrink-0" />
              <span className="text-xs truncate">{isUploadingResume ? 'Saving…' : 'Change Resume'}</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                disabled={isUploadingResume}
                onChange={handleUploadNewResume}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleLogout}
              className="group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-all text-[#73766C] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 font-medium cursor-pointer text-xs"
            >
              <LogOut size={14} className="shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ── Main Content Column (Natural Page Scrolling without Trapped Containers) ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="w-full bg-[#F8F9F5] dark:bg-[#0D0E11] p-4 sm:p-6 lg:p-8 space-y-6 flex-grow">
          {/* ── Direct Job Invitation Dossier Banner (When URL has ?job=...) ── */}
          {targetJobId && targetJobData && (
            <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-[#D4F82C]/20 via-white to-white dark:from-[#D4F82C]/10 dark:via-[#15161A] dark:to-[#15161A] border-2 border-[#D4F82C] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4F82C]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#D4F82C] text-[#111215] shadow-xs">
                      <Zap size={13} className="fill-[#111215]" />
                      <span>Target Role Invitation • #{targetJobData.accessCode || targetJobId}</span>
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E4E7DC] dark:bg-white/10 text-[#575A51] dark:text-neutral-300">
                      {targetJobData.employmentType || 'Full-Time'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#111215] dark:text-white truncate">
                    {targetJobData.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#575A51] dark:text-neutral-300 font-medium">
                    <span className="flex items-center gap-1">
                      <Building2 size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                      <strong>{targetJobData.company}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                      {targetJobData.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                      {targetJobData.experience}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                      {targetJobData.salary}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePlayAudio(targetJobData)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E4E7DC]/60 dark:bg-white/10 text-[#111215] dark:text-white hover:bg-[#D4F82C] hover:text-[#111215] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Listen to AI Audio JD"
                  >
                    {playingJobId === targetJobData.id ? (
                      <VolumeX size={14} className="text-red-500 animate-pulse" />
                    ) : (
                      <Volume2 size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    )}
                    <span>Audio JD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTargetJdModal(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white hover:bg-[#F8F9F5] dark:hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileText size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    <span>View Full JD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyToJob(targetJobData)}
                    disabled={appliedJobIds.includes(targetJobData.id)}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-[#D4F82C] hover:bg-[#C2E820] text-[#111215] transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {appliedJobIds.includes(targetJobData.id) ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-800" />
                        <span>Applied</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} className="fill-[#111215]" />
                        <span>1-Tap Apply</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Global Notifications */}
          {applySuccessMsg && (
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>{applySuccessMsg}</span>
              </div>
              <button onClick={() => setApplySuccessMsg(null)} className="cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {profileSuccessMsg && (
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
              <button onClick={() => setProfileSuccessMsg(null)} className="cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

        {/* ── TAB 0: DASHBOARD (Metrics + Quick Action Hub - ONLY on Dashboard) ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* ── ATS Editorial Header ── */}
            <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E4E7DC] dark:border-white/10 pb-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[#575A51] dark:text-neutral-400 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8FB305] animate-pulse" />
                  01 • CANDIDATE DESK • DASHBOARD
                </div>
                <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#111215] dark:text-white">
                  Welcome back, {candidateDisplayName}
                </h1>
                <p className="mt-1 text-sm text-[#575A51] dark:text-neutral-400">
                  Track your job applications, scheduled AI interview rounds, and personalized matches in real time.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#111215] dark:bg-[#D4F82C] px-4 py-2.5 text-xs font-semibold text-white dark:text-[#111215] shadow-xs transition-colors hover:bg-[#202227] cursor-pointer"
                >
                  <Sparkles size={14} className="text-[#D4F82C] dark:text-[#111215]" />
                  <span>Explore Matches</span>
                </button>
                <label className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-xs font-semibold text-[#111215] dark:text-white shadow-xs transition-colors hover:bg-[#F8F9F5] dark:hover:bg-white/10 cursor-pointer">
                  <UploadCloud size={14} className="text-[#8FB305]" />
                  <span>{isUploadingResume ? 'Uploading…' : 'Upload CV'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    disabled={isUploadingResume}
                    onChange={handleUploadNewResume}
                    className="hidden"
                  />
                </label>
              </div>
            </section>

            {/* ── 4 High-Impact ATS Metric Cards (ONLY inside Dashboard Tab) ── */}
            <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Card 1: All Applications */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('applied');
                  setAppliedStageFilter('all');
                }}
                className="group relative flex flex-col justify-between rounded-2xl border bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 cursor-pointer text-left border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30 dark:hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                    All Applications
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/10 text-[#111215] dark:text-white transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
                    <Briefcase size={13} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215] dark:text-white">
                    {myApplicationsList.length}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D4F82C] px-2.5 py-0.5 text-[11px] font-bold text-[#111215]">
                    <span className="h-1 w-1 rounded-full bg-[#8FB305]" />
                    {underReviewCount} active
                  </span>
                </div>
              </button>

              {/* Card 2: Interview Rounds */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('applied');
                  setAppliedStageFilter('shortlisted');
                }}
                className="group relative flex flex-col justify-between rounded-2xl border bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 cursor-pointer text-left border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30 dark:hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                    Interview Rounds
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/10 text-[#111215] dark:text-white transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
                    <Calendar size={13} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215] dark:text-white">
                    {shortlistedCount}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D4F82C] px-2.5 py-0.5 text-[11px] font-bold text-[#111215]">
                    <span className="h-1 w-1 rounded-full bg-[#8FB305] animate-pulse" />
                    Scheduled
                  </span>
                </div>
              </button>

              {/* Card 3: Matched Roles */}
              <button
                type="button"
                onClick={() => setActiveTab('matches')}
                className="group relative flex flex-col justify-between rounded-2xl border bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 cursor-pointer text-left border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30 dark:hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                    Matched Roles
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/10 text-[#111215] dark:text-white transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
                    <Sparkles size={13} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215] dark:text-white">
                    {matchedJobs.length}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E4E7DC] dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-[#111215] dark:text-white">
                    {matchedJobs.length > 0 ? `${matchedJobs[0].overallScore}% fit` : 'Open'}
                  </span>
                </div>
              </button>

              {/* Card 4: Resume Status */}
              <button
                type="button"
                onClick={() => setActiveTab('resume')}
                className="group relative flex flex-col justify-between rounded-2xl border bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 cursor-pointer text-left border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30 dark:hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                    Resume Status
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/10 text-[#111215] dark:text-white transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
                    <FileText size={13} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215] dark:text-white">
                    {candidate?.resumeUrl ? 'Verified' : 'Missing'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    candidate?.resumeUrl
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {candidate?.resumeUrl ? '✓ Attached' : 'Upload CV'}
                  </span>
                </div>
              </button>
            </section>

            {/* Scheduled Interviews Spotlight */}
            {shortlistedCount > 0 && (
              <div className="rounded-3xl border-2 border-[#D4F82C] bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-md relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#D4F82C] text-[#111215] mb-2 shadow-xs">
                      <Calendar size={13} />
                      <span>Active Interview Round Confirmed</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#111215] dark:text-white">
                      You have {shortlistedCount} scheduled interview session{shortlistedCount > 1 ? 's' : ''}!
                    </h3>
                    <p className="text-xs text-[#575A51] dark:text-neutral-400 mt-0.5">
                      Review your interview timings, preparation guidelines, and direct video room link.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('applied');
                      setAppliedStageFilter('shortlisted');
                    }}
                    className="px-4 py-2.5 rounded-full bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215] text-xs font-bold shadow-xs hover:opacity-90 transition-all shrink-0 cursor-pointer"
                  >
                    View Scheduled Interviews →
                  </button>
                </div>
              </div>
            )}

            {/* Top Matched Jobs Preview */}
            {matchedJobs.length > 0 && (
              <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#111215] dark:text-white">
                      Top AI Matched Opportunities
                    </h3>
                    <p className="text-xs text-[#575A51] dark:text-neutral-400">
                      Roles ranked highest against your resume skills and experience.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('matches')}
                    className="text-xs font-bold text-[#111215] dark:text-[#D4F82C] hover:underline cursor-pointer"
                  >
                    View All ({filteredMatches.length}) →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
                  {filteredMatches.slice(0, 3).map((matchItem) => {
                    const job = matchItem.job;
                    const rawTitle = (job?.title || job?.jobTitle || job?.role || '').trim();
                    const jobTitle = (rawTitle && rawTitle !== '.') ? rawTitle : (job?.roleCategory || job?.department ? `${job?.department || job?.roleCategory} Role` : 'Job Opportunity');
                    const rawCompany = (job?.company || job?.companyName || '').trim();
                    const jobCompany = (rawCompany && rawCompany !== '.') ? rawCompany : 'Hiring Partner';
                    const rawLoc = (job?.location || job?.city || '').trim();
                    const jobLocation = (rawLoc && rawLoc !== '.') ? rawLoc : 'Nashik';
                    const jobSalary = job?.salary || 'Competitive';
                    const jobType = job?.jobType || job?.employmentType || 'Full-Time';

                    return (
                      <div
                        key={job?.id || matchItem.overallScore}
                        onClick={() => {
                          setSelectedJobModal(matchItem);
                          hasDismissedJobModalRef.current = true;
                        }}
                        className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30 dark:hover:border-white/20 bg-[#F8F9F5] dark:bg-white/5 transition-all cursor-pointer group flex flex-col justify-between h-full"
                      >
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#D4F82C] text-[#111215]">
                                {matchItem.overallScore}% Fit
                              </span>
                              <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-medium">
                                {jobType}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-[#111215] dark:text-white group-hover:text-[#8FB305] dark:group-hover:text-[#D4F82C] transition-colors truncate">
                              {jobTitle}
                            </h4>
                            <p className="text-xs text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">
                              {jobCompany} • {jobLocation}
                            </p>
                          </div>
                        </div>
                        <div className="mt-auto pt-3 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#111215] dark:text-white">
                            {jobSalary}
                          </span>
                          <span className="font-bold text-[#8FB305] dark:text-[#D4F82C] group-hover:translate-x-0.5 transition-transform">
                            View Details →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Applications Tracker Preview */}
            {myApplicationsList.length > 0 && (
              <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#111215] dark:text-white">
                      Recent Applications Tracker
                    </h3>
                    <p className="text-xs text-[#575A51] dark:text-neutral-400">
                      Real-time status updates from recruiters.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('applied');
                      setAppliedStageFilter('all');
                    }}
                    className="text-xs font-bold text-[#111215] dark:text-[#D4F82C] hover:underline cursor-pointer"
                  >
                    View Full Pipeline ({myApplicationsList.length}) →
                  </button>
                </div>

                <div className="space-y-2">
                  {myApplicationsList.slice(0, 3).map((item) => {
                    const { job, appInfo } = item;
                    const rawTitle = (job?.title || job?.jobTitle || appInfo?.jobTitle || '').trim();
                    const jobTitle = (rawTitle && rawTitle !== '.') ? rawTitle : 'Job Application';
                    const rawCompany = (job?.company || job?.companyName || '').trim();
                    const jobCompany = (rawCompany && rawCompany !== '.') ? rawCompany : 'Hiring Partner';
                    const status = appInfo?.status || 'Under Review';
                    const appliedDateStr = appInfo?.appliedAt
                      ? new Date(appInfo.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Recently';

                    const isScheduled = status.toLowerCase().includes('interview') || status.toLowerCase().includes('shortlist');
                    const isSelected = status.toLowerCase().includes('hired') || status.toLowerCase().includes('offer') || status.toLowerCase().includes('selected');

                    return (
                      <div
                        key={job?.id || item.job?.id || status}
                        onClick={() => {
                          setActiveTab('applied');
                          setAppliedStageFilter('all');
                        }}
                        className="p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-colors"
                      >
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white truncate">
                            {jobTitle}
                          </h4>
                          <p className="text-[11px] text-[#73766C] dark:text-neutral-400 truncate mt-0.5">
                            {jobCompany} • Applied {appliedDateStr}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 shadow-2xs ${
                          isScheduled
                            ? 'bg-[#D4F82C] text-[#111215] border border-[#8FB305]/40 animate-pulse'
                            : isSelected
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-[#E4E7DC] dark:bg-white/10 text-[#111215] dark:text-white'
                        }`}>
                          {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Matched Jobs */}
        {activeTab === 'matches' && (
          <div className="space-y-6">
            {/* Search and Filters Bar with Segmented Tabs matching Upload Resume */}
            <div className="p-3 sm:p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Segmented Filter Tabs matching landing page */}
              <div className="flex items-center gap-1 p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setMatchFilter('EligibleOnly')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    matchFilter === 'EligibleOnly'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  Eligible
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFilter('HighMatch')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    matchFilter === 'HighMatch'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  High Match (&ge; 60%)
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFilter('LocalCity')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                    matchFilter === 'LocalCity'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  <MapPin size={12} />
                  <span>{editForm.location || candidate?.location || 'Nashik'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFilter('All')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    matchFilter === 'All'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  All ({matchedJobs.length})
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                {/* Search input */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C] dark:text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchJobQuery}
                    onChange={(e) => setSearchJobQuery(e.target.value)}
                    placeholder="Filter by title, company, skill..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-full bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                  />
                </div>

                {/* Match Score Filter */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Filter size={13} className="text-[#73766C] dark:text-neutral-400 shrink-0" />
                  <select
                    value={minScoreFilter}
                    onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                    className="px-3 py-2 text-xs rounded-full bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white font-bold outline-none cursor-pointer transition-all"
                  >
                    <option value={0}>All Scores</option>
                    <option value={50}>50% & Above</option>
                    <option value={70}>70% & Above</option>
                    <option value={85}>85% & Above (High Fit)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Jobs List Grid */}
            {jobsLoading ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold">Matching jobs against your profile...</p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className={`py-16 px-4 text-center rounded-2xl border space-y-3 ${
                isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200'
              }`}>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                  <Briefcase size={22} />
                </div>
                <h3 className="text-base font-bold">No Matching Jobs Found</h3>
                <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  We couldn't find active jobs matching your current criteria or search filter. Try adding more skills in the "Edit Profile" tab or lowering the minimum match filter.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit-profile')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Update Profile & Skills</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
                {filteredMatches.map((matchItem) => {
                  const job = matchItem.job;
                  const liveJob = allJobs.find(j => j.id === job.id || (job.jobNo && j.jobNo === job.jobNo) || (job.accessCode && j.accessCode === job.accessCode)) || job;
                  const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();
                  const candPhoneNorm = (candidate?.phone || candidate?.profile?.phone || editForm.phone || '').replace(/\D/g, '');

                  const isCandMatch = (c: any) => {
                    if (!c) return false;
                    const cEmail = (c.email || '').toLowerCase().trim();
                    if (candEmail && cEmail && cEmail === candEmail) return true;
                    const cPhone = String(c.phone || '').replace(/\D/g, '');
                    if (candPhoneNorm && cPhone && (cPhone === candPhoneNorm || cPhone.endsWith(candPhoneNorm) || candPhoneNorm.endsWith(cPhone))) return true;
                    return false;
                  };

                  const candInJobData = (Array.isArray(liveJob.candidateData) ? liveJob.candidateData.find(isCandMatch) : null) ||
                    (Array.isArray(job.candidateData) ? job.candidateData.find(isCandMatch) : null);

                  const candInJobEmails = (Array.isArray(liveJob.candidateEmails) && liveJob.candidateEmails.some((e: any) => candEmail && String(e).toLowerCase().trim() === candEmail)) ||
                    (Array.isArray(job.candidateEmails) && job.candidateEmails.some((e: any) => candEmail && String(e).toLowerCase().trim() === candEmail));

                  const matchAppItem = myApplicationsList.find(a =>
                    (job.id && a.job?.id === job.id) ||
                    (job.jobNo && a.job?.jobNo === job.jobNo) ||
                    (job.accessCode && a.job?.accessCode === job.accessCode)
                  );
                  const isApplied = isJobApplied(job) || Boolean(matchAppItem);

                  const applicationInfo = matchAppItem?.appInfo || appliedApplications[job.id] ||
                    (job.jobNo && appliedApplications[job.jobNo]) ||
                    (job.accessCode && appliedApplications[job.accessCode]) ||
                    (candInJobData ? {
                      jobId: job.id,
                      status: candInJobData.status || 'Under Review',
                      appliedAt: candInJobData.appliedAt,
                      statusUpdatedAt: candInJobData.statusUpdatedAt,
                      scheduledInterview: candInJobData.scheduledInterview,
                      recruiterNotes: candInJobData.recruiterNotes,
                      matchScore: candInJobData.matchScore,
                    } : (candInJobEmails ? { jobId: job.id, status: 'Under Review' } : undefined));

                  const isPlaying = playingJobId === job.id;

                  return (
                    <div
                      key={job.id}
                      className="rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-md hover:border-[#111215]/30 dark:hover:border-white/20 shadow-xs group h-full"
                    >
                      {/* Top Badges */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black shadow-xs ${
                            matchItem.overallScore >= 80
                              ? 'bg-[#D4F82C] text-[#111215]'
                              : matchItem.overallScore >= 60
                              ? 'bg-[#8FB305]/20 text-[#8FB305] dark:text-[#D4F82C] border border-[#8FB305]/30'
                              : 'bg-[#E4E7DC] dark:bg-white/10 text-[#575A51] dark:text-neutral-300'
                          }`}>
                            <Sparkles size={11} className={matchItem.overallScore >= 80 ? 'fill-[#111215]' : ''} />
                            <span>{matchItem.overallScore}% • {matchItem.matchGrade}</span>
                          </span>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[#E4E7DC] dark:border-white/10 text-[#73766C] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-[#1D1F24]">
                            #{job.accessCode}
                          </span>
                        </div>

                        {/* Title & Company */}
                        <div>
                          <h4 className="text-sm sm:text-base font-black tracking-tight text-[#111215] dark:text-white hover:text-[#8FB305] dark:hover:text-[#D4F82C] transition-colors line-clamp-1">
                            {job.title}
                          </h4>
                          <p className="text-xs font-semibold text-[#575A51] dark:text-neutral-400 flex items-center gap-1.5 mt-0.5 truncate">
                            <Building2 size={12} className="text-[#73766C] dark:text-neutral-500 shrink-0" />
                            <span className="truncate">{job.company}</span>
                            <span>•</span>
                            <span className="truncate">{job.department}</span>
                          </p>
                        </div>

                        {/* Details Pills: Location, Exp, Salary */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                          <div className="p-2 rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] flex items-center gap-1.5 text-[#575A51] dark:text-neutral-300 font-medium">
                            <MapPin size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>

                          <div className="p-2 rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] flex items-center gap-1.5 text-[#575A51] dark:text-neutral-300 font-medium">
                            <Briefcase size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                            <span className="truncate">{job.experience}</span>
                          </div>

                          <div className="p-2 rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] col-span-2 sm:col-span-1 flex items-center gap-1.5 text-[#575A51] dark:text-neutral-300 font-medium">
                            <Clock size={12} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                            <span className="truncate">{job.salary}</span>
                          </div>
                        </div>

                        {/* Matched Skills */}
                        {matchItem.skillMatch?.matchedSkills?.length > 0 && (
                          <div className="space-y-1 pt-0.5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[#73766C] dark:text-neutral-400 block">
                              Matching Skills ({matchItem.skillMatch.matchedSkills.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {matchItem.skillMatch.matchedSkills.slice(0, 4).map((sk: string) => (
                                <span
                                  key={sk}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4E7DC]/60 dark:bg-white/10 text-[#111215] dark:text-[#D4F82C] border border-[#E4E7DC] dark:border-white/10"
                                >
                                  <Check size={10} strokeWidth={2.5} className="text-[#8FB305] dark:text-[#D4F82C]" />
                                  <span>{sk}</span>
                                </span>
                              ))}
                              {matchItem.skillMatch.matchedSkills.length > 4 && (
                                <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 px-1.5 py-0.5">
                                  +{matchItem.skillMatch.matchedSkills.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Application Status Banner (if candidate already applied) OR Open Status Pill */}
                        {isApplied ? (
                          <div className="mt-2.5 p-2.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                                Status:
                              </span>
                              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]">
                                {applicationInfo?.status === 'pending' || applicationInfo?.status === 'interested'
                                  ? 'Applied'
                                  : (applicationInfo?.status || 'Applied')}
                              </span>
                            </div>

                            {/* Confirmed Interview Details (if Interview Scheduled) */}
                            {applicationInfo?.status === 'Interview Scheduled' && applicationInfo.scheduledInterview && (
                              <div className="mt-2 pt-1.5 border-t border-[#E4E7DC] dark:border-white/10 text-[11px] space-y-1">
                                <div className="font-bold text-[#111215] dark:text-white flex items-center gap-1">
                                  <Calendar size={12} className="text-[#8FB305] dark:text-[#D4F82C]" />
                                  <span>Interview Scheduled</span>
                                </div>
                                <div className="text-[10px] text-[#575A51] dark:text-neutral-300">
                                  🗓 {applicationInfo.scheduledInterview.date} {applicationInfo.scheduledInterview.time}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2.5 p-2.5 rounded-xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5]/60 dark:bg-white/[0.02]">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                                Opportunity:
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                                Open for Applications
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-[#73766C] dark:text-neutral-400 flex items-center gap-1">
                              <Sparkles size={11} className="text-[#8FB305] dark:text-[#D4F82C]" />
                              <span>Fast-track 1-click ATS application</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-auto pt-3 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-2">
                        {/* View JD Details */}
                        <button
                          type="button"
                          onClick={() => handleOpenJobModal(matchItem)}
                          className="px-3 py-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-xs font-bold text-[#111215] dark:text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye size={12} />
                          <span>View Details</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          {/* Apply / Status Button */}
                          {isApplied ? (
                            <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-[#8FB305]/40 bg-[#D4F82C]/15 text-[#111215] dark:text-[#D4F82C]">
                              <CheckCircle2 size={12} />
                              <span className="truncate max-w-[110px]">
                                {applicationInfo?.status === 'pending' || applicationInfo?.status === 'interested'
                                  ? 'Under Review'
                                  : (applicationInfo?.status || 'Applied')}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={applyingJobId === job.id}
                              onClick={() => handleApplyToJob(matchItem)}
                              className="px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-[#111215] hover:bg-[#202227] text-white dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] dark:text-[#111215] shadow-xs active:scale-95 disabled:opacity-50"
                            >
                              {applyingJobId === job.id ? (
                                <span>Applying...</span>
                              ) : (
                                <>
                                  <span>Apply Now</span>
                                  <ArrowRight size={12} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: My Applications & Pipeline Tracking */}
        {activeTab === 'applied' && (
          <div className="space-y-6">
            {/* Header & Stage Filter Chips */}
            <div className="p-5 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-[#111215] dark:text-white flex items-center gap-2">
                    <span>My Applications & Status Tracker</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-[#D4F82C] text-[#111215] shadow-xs">
                      {myApplicationsList.length} Total
                    </span>
                  </h3>
                  <p className="text-xs mt-0.5 text-[#575A51] dark:text-neutral-400">
                    Real-time status updates from recruiters, shortlist alerts, and scheduled interview rounds.
                  </p>
                </div>

                {shortlistedCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4F82C]/25 border border-[#8FB305]/40 text-[#111215] dark:text-[#D4F82C] text-xs font-black shadow-xs animate-pulse">
                    <Award size={15} />
                    <span>{shortlistedCount} Actionable Shortlist / Interview{shortlistedCount > 1 ? 's' : ''}!</span>
                  </div>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('all')}
                  className={`px-4 py-1.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'all'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30'
                  }`}
                >
                  All Applications ({myApplicationsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('shortlisted')}
                  className={`px-4 py-1.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    appliedStageFilter === 'shortlisted'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30'
                  }`}
                >
                  <Award size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                  <span>Shortlisted & Rounds ({shortlistedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('under-review')}
                  className={`px-4 py-1.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'under-review'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30'
                  }`}
                >
                  Under Review ({underReviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('selected')}
                  className={`px-4 py-1.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'selected'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30'
                  }`}
                >
                  Selected / Offer ({selectedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('rejected')}
                  className={`px-4 py-1.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'rejected'
                      ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30'
                  }`}
                >
                  Archived / Declined
                </button>
              </div>
            </div>

            {/* Applications List */}
            {filteredApplications.length === 0 ? (
              <div className={`p-10 rounded-2xl border text-center space-y-4 ${
                isDark ? 'bg-[#101014] border-white/10' : 'bg-white border-slate-200'
              }`}>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                  <Briefcase size={28} />
                </div>
                <div>
                  <h4 className="text-base font-bold">No applications found in this stage</h4>
                  <p className={`text-xs mt-1 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {appliedStageFilter === 'all'
                      ? "You haven't applied to any roles yet. Explore your AI match recommendations and apply with a single tap!"
                      : `You currently have no applications matching the "${appliedStageFilter}" filter.`}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedStageFilter('all');
                      setActiveTab('matches');
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 inline-flex items-center gap-2"
                  >
                    <Sparkles size={14} />
                    <span>Explore Matched Roles ({matchedJobs.length})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 items-stretch">
                {filteredApplications.map((item) => {
                  const { job, appInfo, matchItem } = item;
                  const step = getStageStep(appInfo.status);
                  const isShortlisted = step === 3 || step === 4;
                  const isSelected = step === 5;
                  const isRejected = step === -1;
                  const scheduled = appInfo.scheduledInterview;

                  return (
                    <div
                      key={job.id}
                      className="rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between h-full"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#E4E7DC] dark:border-white/10 pb-3.5">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm sm:text-base font-black tracking-tight text-[#111215] dark:text-white">
                              {job.title}
                            </h4>
                            {job.jobNo && (
                              <span className="text-[10px] font-mono text-[#73766C] dark:text-neutral-400 border border-[#E4E7DC] dark:border-white/10 px-2 py-0.5 rounded-full bg-[#F8F9F5] dark:bg-[#1D1F24]">
                                #{job.jobNo}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#575A51] dark:text-neutral-400">
                            {job.department && (
                              <span className="flex items-center gap-1">
                                <Building2 size={11} className="text-[#73766C] dark:text-neutral-500" />
                                <span>{job.department}</span>
                              </span>
                            )}
                            {job.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-[#8FB305] dark:text-[#D4F82C]" />
                                <span>{job.location}</span>
                              </span>
                            )}
                            {job.jobType && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4E7DC]/60 dark:bg-white/10 text-[#111215] dark:text-white">
                                {job.jobType}
                              </span>
                            )}
                            {appInfo.appliedAt && (
                              <span className="text-[10px] text-[#73766C] dark:text-neutral-400">
                                Applied: {new Date(appInfo.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                          {((matchItem && matchItem.overallScore !== undefined) || appInfo.matchScore !== undefined) && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#D4F82C] text-[#111215] shadow-xs flex items-center gap-1">
                              <Sparkles size={11} className="fill-[#111215]" />
                              <span>{matchItem?.overallScore ?? appInfo.matchScore}% Match</span>
                            </span>
                          )}

                          <span className={`px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                            isSelected
                              ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]'
                              : isShortlisted
                              ? 'bg-[#D4F82C] text-[#111215] border border-[#8FB305]/40 animate-pulse'
                              : isRejected
                              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                              : 'bg-[#111215] text-white dark:bg-white/10 dark:text-white'
                          }`}>
                            {isSelected ? (
                              <Award size={12} />
                            ) : isShortlisted ? (
                              <CheckCircle2 size={12} />
                            ) : isRejected ? (
                              <XCircle size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            <span>{appInfo.status || 'Under Review'}</span>
                          </span>
                        </div>
                      </div>

                      {/* 4-Step Pipeline Visual Tracker */}
                      <div className="py-3.5">
                        <div className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 mb-2 uppercase tracking-wider">
                          Application Journey Tracker
                        </div>

                        {isRejected ? (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                            <XCircle size={14} className="shrink-0" />
                            <span>This application was not selected to proceed further. Your profile remains active for other matching opportunities!</span>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Track line */}
                            <div className="absolute top-3.5 left-5 right-5 h-0.5 bg-[#E4E7DC] dark:bg-white/10 -z-0" />
                            <div
                              className="absolute top-3.5 left-5 h-0.5 bg-[#111215] dark:bg-[#D4F82C] transition-all duration-500 -z-0"
                              style={{
                                width: step >= 5 ? '90%' : step >= 3 ? '66%' : step >= 2 ? '33%' : '0%'
                              }}
                            />

                            <div className="grid grid-cols-4 gap-1.5 relative z-10 text-center">
                              {/* Step 1: Applied */}
                              <div className="flex flex-col items-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 1
                                    ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] ring-3 ring-[#D4F82C]/30'
                                    : 'bg-[#E4E7DC] dark:bg-white/10 text-[#73766C]'
                                }`}>
                                  <Check size={12} />
                                </div>
                                <span className={`text-[10px] font-bold mt-1.5 leading-tight ${
                                  step >= 1 ? 'text-[#111215] dark:text-white' : 'text-[#73766C] dark:text-neutral-400'
                                }`}>
                                  1. Applied
                                </span>
                                <span className="text-[8px] text-[#73766C] dark:text-neutral-400 hidden sm:inline">Submitted</span>
                              </div>

                              {/* Step 2: Under Review */}
                              <div className="flex flex-col items-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 2
                                    ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] ring-3 ring-[#D4F82C]/30'
                                    : 'bg-[#E4E7DC] dark:bg-white/10 text-[#73766C]'
                                }`}>
                                  {step > 2 ? <Check size={12} /> : <Eye size={11} />}
                                </div>
                                <span className={`text-[10px] font-bold mt-1.5 leading-tight ${
                                  step >= 2 ? 'text-[#111215] dark:text-white' : 'text-[#73766C] dark:text-neutral-400'
                                }`}>
                                  2. In Review
                                </span>
                                <span className="text-[8px] text-[#73766C] dark:text-neutral-400 hidden sm:inline">Screening</span>
                              </div>

                              {/* Step 3: Shortlisted / Interview */}
                              <div className="flex flex-col items-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 3
                                    ? isShortlisted
                                      ? 'bg-[#D4F82C] text-[#111215] ring-3 ring-[#8FB305]/40 animate-bounce'
                                      : 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                                    : 'bg-[#E4E7DC] dark:bg-white/10 text-[#73766C]'
                                }`}>
                                  {step >= 4 ? <Check size={12} /> : <Award size={11} />}
                                </div>
                                <span className={`text-[10px] font-bold mt-1.5 leading-tight ${
                                  step >= 3 ? 'text-[#111215] dark:text-white font-black' : 'text-[#73766C] dark:text-neutral-400'
                                }`}>
                                  3. Shortlist
                                </span>
                                <span className="text-[8px] text-[#73766C] dark:text-neutral-400 hidden sm:inline">Interview</span>
                              </div>

                              {/* Step 4: Decision */}
                              <div className="flex flex-col items-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 5
                                    ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] ring-3 ring-[#D4F82C]/30'
                                    : 'bg-[#E4E7DC] dark:bg-white/10 text-[#73766C]'
                                }`}>
                                  <Sparkles size={11} />
                                </div>
                                <span className={`text-[10px] font-bold mt-1.5 leading-tight ${
                                  step >= 5 ? 'text-[#111215] dark:text-white font-extrabold' : 'text-[#73766C] dark:text-neutral-400'
                                }`}>
                                  4. Decision
                                </span>
                                <span className="text-[8px] text-[#73766C] dark:text-neutral-400 hidden sm:inline">Offer</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Middle Content Box: Scheduled Interview OR Active Pipeline Progress Box */}
                      {scheduled ? (
                        <div className="mt-2 mb-3 p-3 sm:p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2.5 flex-1 flex flex-col justify-between">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="text-amber-500" size={15} />
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  📅 Interview Scheduled — {scheduled.round || 'Candidate Interview'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                Confirmed Session
                              </span>
                            </div>

                            {/* Key Session Details Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {scheduled.date && (
                                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Date</span>
                                  <span className="font-bold">{scheduled.date}</span>
                                </div>
                              )}
                              {scheduled.time && (
                                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Time</span>
                                  <span className="font-bold">{scheduled.time}</span>
                                </div>
                              )}
                              {(scheduled.contactPerson || scheduled.interviewer) && (
                                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Contact Person</span>
                                  <span className="font-bold truncate block">{scheduled.contactPerson || scheduled.interviewer}</span>
                                </div>
                              )}
                              {scheduled.mode && (
                                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Interview Mode</span>
                                  <span className="font-bold">{scheduled.mode}</span>
                                </div>
                              )}
                            </div>

                            {/* Venue Location if specified */}
                            {scheduled.location && (
                              <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs flex items-center gap-2">
                                <MapPin size={13} className="text-amber-500 shrink-0" />
                                <div>
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Venue / Location</span>
                                  <span className="font-bold">{scheduled.location}</span>
                                </div>
                              </div>
                            )}

                            {/* Recruiter Notes / Instructions if specified */}
                            {scheduled.notes && (
                              <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Instructions & Notes</span>
                                <p className="italic text-slate-700 dark:text-slate-300 text-[11px]">{scheduled.notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Contact & Meeting Details (Smartly detects Phone vs Web Video URL) */}
                          {scheduled.link && (() => {
                            const raw = String(scheduled.link).trim();
                            const cleanDigits = raw.replace(/\D/g, '');
                            const isPhoneNumber = cleanDigits.length >= 7 && cleanDigits.length <= 15 && !raw.includes('http') && !raw.includes('.com') && !raw.includes('/') && !raw.includes('meet');
                            const isWebUrl = raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('meet.google') || raw.includes('zoom.us') || raw.includes('teams.microsoft') || raw.includes('.com') || raw.includes('.in');
                            const fullUrl = isWebUrl ? (raw.startsWith('http') ? raw : `https://${raw}`) : '';
                            const waDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

                            return (
                              <div className="mt-1.5 p-2.5 sm:p-3 rounded-xl border border-amber-500/30 bg-white/80 dark:bg-black/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                    {isPhoneNumber ? <Phone size={12} /> : <ExternalLink size={12} />}
                                    <span>{isPhoneNumber ? 'Interviewer Contact' : isWebUrl ? 'Meeting URL / Platform' : 'Meeting Details'}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyInterviewLink(raw)}
                                    className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    {copiedLink === raw ? <Check size={11} /> : <Copy size={11} />}
                                    <span>{copiedLink === raw ? 'Copied!' : 'Copy'}</span>
                                  </button>
                                </div>

                                {/* Raw detail value displayed prominently */}
                                <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all select-all flex items-center justify-between gap-2">
                                  <span className="font-bold">{raw}</span>
                                </div>

                                {/* Smart Action Buttons */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {isPhoneNumber && (
                                    <>
                                      <a
                                        href={`tel:${cleanDigits}`}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                      >
                                        <Phone size={12} />
                                        <span>Call</span>
                                      </a>
                                      <a
                                        href={`https://wa.me/${waDigits}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-500 shadow-sm flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                      >
                                        <MessageCircle size={12} />
                                        <span>WhatsApp</span>
                                      </a>
                                    </>
                                  )}

                                  {isWebUrl && (
                                    <a
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                    >
                                      <ExternalLink size={13} />
                                      <span>Join Video Call</span>
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleCopyInterviewLink(raw)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                      copiedLink === raw
                                        ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                                        : 'border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                                    }`}
                                  >
                                    {copiedLink === raw ? <Check size={12} /> : <Copy size={12} />}
                                    <span>{copiedLink === raw ? 'Copied' : 'Copy Info'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : !isRejected ? (
                        <div className="mt-2 mb-3 p-3 sm:p-3.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#FAFAF8] dark:bg-white/[0.03] space-y-2.5 flex-1 flex flex-col justify-between">
                          <div className="space-y-2.5">
                            {/* Stage Header */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-1.5">
                                {step >= 3 ? (
                                  <Sparkles className="text-[#8FB305] dark:text-[#D4F82C]" size={15} />
                                ) : step >= 2 ? (
                                  <Eye className="text-sky-500 dark:text-sky-400" size={15} />
                                ) : (
                                  <Clock className="text-[#8FB305] dark:text-[#D4F82C]" size={15} />
                                )}
                                <span className="text-[11px] font-black uppercase tracking-wider text-[#111215] dark:text-white">
                                  {step >= 5
                                    ? '🎉 Final Selection • Offer Processing'
                                    : step >= 3
                                    ? 'Shortlist Confirmed • Interview Slot Allocation'
                                    : step >= 2
                                    ? 'Under Active Review • Recruiter Screening'
                                    : 'Application Submitted • Queue Active'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E4E7DC]/60 dark:bg-white/10 text-[#575A51] dark:text-neutral-300">
                                Stage {step >= 5 ? '4 of 4' : step >= 3 ? '3 of 4' : step >= 2 ? '2 of 4' : '1 of 4'}
                              </span>
                            </div>

                            {/* Stage Milestone Details Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Current Stage</span>
                                <span className="font-bold text-[#111215] dark:text-white truncate block">
                                  {appInfo.status || 'Under Review'}
                                </span>
                              </div>
                              <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Next Milestone</span>
                                <span className="font-bold text-[#111215] dark:text-white truncate block">
                                  {step >= 5 ? 'Offer Letter Release' : step >= 3 ? 'Interview Slot Booking' : step >= 2 ? 'Shortlist Evaluation' : 'Initial Profile Check'}
                                </span>
                              </div>
                            </div>

                            {/* Recruiter Notes / Guidance */}
                            <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs">
                              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">
                                {appInfo.recruiterNotes ? 'Recruiter Note' : 'Hiring Team Status'}
                              </span>
                              <p className="italic text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                                {appInfo.recruiterNotes
                                  ? appInfo.recruiterNotes
                                  : step >= 3
                                  ? 'Your profile has passed initial screening and is shortlisted. The recruitment coordinator is setting up your interview slot and meeting coordinates.'
                                  : step >= 2
                                  ? 'The hiring team is currently evaluating your resume and skills against role requirements. Real-time updates will appear here automatically.'
                                  : 'Your application has been received and logged into the ATS applicant pool. Automatic skills verification is active.'}
                              </p>
                            </div>
                          </div>

                          {/* Real-time sync & turnaround badge */}
                          <div className="p-2.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-black/30 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 font-bold text-[#111215] dark:text-white">
                              <CheckCircle2 size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                              <span>ATS Status: Live</span>
                            </div>
                            <span className="text-[10px] font-semibold text-[#73766C] dark:text-neutral-400">
                              Turnaround: ~1–3 business days
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 mb-3 p-3 sm:p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-xs flex-1 flex flex-col justify-between space-y-2.5">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-black uppercase text-[11px]">
                                <XCircle size={15} />
                                <span>Application Concluded</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                Archived
                              </span>
                            </div>
                            <p className="text-[11px] text-[#73766C] dark:text-neutral-400 leading-relaxed">
                              This opening was closed for new candidate evaluations. Your verified resume and assessment scores remain stored in our talent database for instant matching on newly opened roles.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('matches')}
                            className="w-full py-2 rounded-lg font-bold text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles size={12} />
                            <span>Explore Similar Matched Opportunities</span>
                          </button>
                        </div>
                      )}

                      {/* Recruiter Feedback notes (if outside scheduled) */}
                      {appInfo.recruiterNotes && scheduled && (
                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 mb-2.5 border border-slate-200 dark:border-white/10">
                          <span className="font-bold text-slate-800 dark:text-white block mb-0.5">Recruiter Note:</span>
                          <p className="text-[11px]">{appInfo.recruiterNotes}</p>
                        </div>
                      )}

                      {/* Bottom Action Buttons */}
                      <div className="mt-auto pt-3 border-t border-[#E4E7DC] dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleOpenJobModal(matchItem || job)}
                          className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Eye size={12} />
                          <span>View Full Job Spec</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {(candidate.resumeUrl || appInfo.recruiterNotes) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (candidate.resumeUrl) {
                                  setPreviewResumeModalUrl(candidate.resumeUrl);
                                } else {
                                  setActiveTab('resume');
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <FileText size={12} />
                              <span>View Resume</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Skill Assessments & Challenges ── */}
        {activeTab === 'assessments' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header with Search and Filter bar */}
            <div className="p-5 sm:p-6 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[#575A51] dark:text-neutral-400 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8FB305] animate-pulse" />
                    03 • CANDIDATE DESK • ASSESSMENTS
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111215] dark:text-white">
                    Skill Assessments & Challenges
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-[#575A51] dark:text-neutral-400">
                    Take verified assessments to evaluate your technical competencies, logic, and coding skills.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('assessment-results')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 px-4 py-2 text-xs font-bold text-[#111215] dark:text-white hover:bg-[#E4E7DC]/60 transition-colors cursor-pointer"
                  >
                    <Award size={14} className="text-[#8FB305]" />
                    <span>View My Results ({candidateSubmissions.length})</span>
                  </button>
                </div>
              </div>

              {/* Filters and Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setAssessmentFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      assessmentFilter === 'all'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                    }`}
                  >
                    All ({candidateAssessments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentFilter('coding')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      assessmentFilter === 'coding'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                    }`}
                  >
                    Coding ({candidateAssessments.filter(t => t.type === 'coding').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentFilter('aptitude')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      assessmentFilter === 'aptitude'
                        ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215]'
                        : 'bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                    }`}
                  >
                    Aptitude & Logic ({candidateAssessments.filter(t => t.type !== 'coding').length})
                  </button>
                </div>

                <div className="relative min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#73766C]" />
                  <input
                    type="text"
                    value={assessmentSearchQuery}
                    onChange={(e) => setAssessmentSearchQuery(e.target.value)}
                    placeholder="Search assessments..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#111215] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#111215] dark:focus:ring-[#D4F82C]"
                  />
                </div>
              </div>
            </div>

            {/* Assessments List / Cards */}
            {assessmentsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 p-5 animate-pulse" />
                ))}
              </div>
            ) : candidateAssessments.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] space-y-3">
                <div className="size-12 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 flex items-center justify-center mx-auto text-[#73766C]">
                  <FileCheck size={24} />
                </div>
                <h3 className="text-base font-bold text-[#111215] dark:text-white">No Assessments Available</h3>
                <p className="text-xs text-[#575A51] dark:text-neutral-400 max-w-md mx-auto">
                  There are no active assessments published right now. When recruiters post evaluations for your profile, they will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidateAssessments
                  .filter((test) => {
                    if (assessmentFilter === 'coding' && test.type !== 'coding') return false;
                    if (assessmentFilter === 'aptitude' && test.type === 'coding') return false;
                    if (assessmentSearchQuery) {
                      const q = assessmentSearchQuery.toLowerCase();
                      const matchTitle = String(test.title || '').toLowerCase().includes(q);
                      const matchDesc = String(test.description || '').toLowerCase().includes(q);
                      const matchCode = String(test.accessCode || '').toLowerCase().includes(q);
                      return matchTitle || matchDesc || matchCode;
                    }
                    return true;
                  })
                  .map((test) => {
                    const submission = candidateSubmissions.find((s) => s.testId === test.id);
                    const isCompleted = !!submission;
                    const isPassed = submission && (submission.status === 'passed' || Number(submission.score) >= test.passingScore);

                    return (
                      <div
                        key={test.id}
                        className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 shadow-xs flex flex-col justify-between hover:border-[#111215]/30 dark:hover:border-white/20 transition-all group"
                      >
                        <div className="space-y-3">
                          {/* Type & ID Row */}
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              test.type === 'coding'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                                : 'bg-[#D4F82C] text-[#111215]'
                            }`}>
                              {test.type === 'coding' ? 'Coding Challenge' : 'Aptitude Test'}
                            </span>
                            <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400">
                              #{test.accessCode || test.id.slice(0, 6)}
                            </span>
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h3 className="text-base font-bold text-[#111215] dark:text-white group-hover:text-[#8FB305] dark:group-hover:text-[#D4F82C] transition-colors line-clamp-1">
                              {test.title}
                            </h3>
                            <p className="mt-1 text-xs text-[#575A51] dark:text-neutral-400 line-clamp-2">
                              {test.description || 'Comprehensive evaluation to validate domain knowledge and problem-solving skills.'}
                            </p>
                          </div>

                          {/* Meta Tags */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E4E7DC]/60 dark:border-white/5 text-[11px] text-[#73766C] dark:text-neutral-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-[#8FB305]" />
                              <span>{test.duration} mins</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <FileText size={12} className="text-[#8FB305]" />
                              <span>{test.questionsCount} Questions</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Target size={12} className="text-[#8FB305]" />
                              <span>{test.passingScore}% Pass</span>
                            </span>
                          </div>
                        </div>

                        {/* CTA Footer */}
                        <div className="mt-5 pt-3 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-2">
                          {isCompleted ? (
                            <>
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                isPassed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}>
                                {isPassed ? '✓ Passed' : 'Attempted'} ({submission.score}%)
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedScorecardSubmission(submission)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#111215] text-[#D4F82C] hover:bg-black transition-all cursor-pointer shadow-xs"
                              >
                                Scorecard →
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] font-medium text-[#73766C] dark:text-neutral-400">
                                Ready to take
                              </span>
                              <a
                                href={`/test/${test.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215] hover:opacity-90 transition-all cursor-pointer shadow-xs"
                              >
                                <span>Start Test</span>
                                <ExternalLink size={12} />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Assessment Results & Scorecards ── */}
        {activeTab === 'assessment-results' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Overall KPI Summary */}
            <div className="p-5 sm:p-6 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[#575A51] dark:text-neutral-400 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8FB305] animate-pulse" />
                    04 • CANDIDATE DESK • RESULTS
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111215] dark:text-white">
                    My Assessment Results & Scorecards
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-[#575A51] dark:text-neutral-400">
                    Review your completed assessment scores, integrity audits, and automated evaluation reports.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('assessments')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#111215] dark:bg-[#D4F82C] px-4 py-2 text-xs font-bold text-white dark:text-[#111215] hover:opacity-90 transition-all cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <FileCheck size={14} />
                  <span>Take More Assessments</span>
                </button>
              </div>

              {/* KPI Summary Cards */}
              {candidateSubmissions.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E4E7DC] dark:border-white/10">
                  <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">Completed</span>
                    <p className="text-2xl font-extrabold text-[#111215] dark:text-white mt-1">{candidateSubmissions.length}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">Passed</span>
                    <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                      {candidateSubmissions.filter(s => s.status === 'passed' || Number(s.score) >= (Number(s.passingScore) || 70)).length}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">Avg Score</span>
                    <p className="text-2xl font-extrabold text-[#111215] dark:text-white mt-1">
                      {Math.round(candidateSubmissions.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / candidateSubmissions.length)}%
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">Integrity</span>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-2">
                      🛡️ {candidateSubmissions.filter(s => !s.tabSwitchCount || Number(s.tabSwitchCount) === 0).length}/{candidateSubmissions.length} Clean
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Submissions List */}
            {assessmentsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 p-5 animate-pulse" />
                ))}
              </div>
            ) : candidateSubmissions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] space-y-4">
                <div className="size-12 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 flex items-center justify-center mx-auto text-[#73766C]">
                  <Award size={24} />
                </div>
                <h3 className="text-base font-bold text-[#111215] dark:text-white">No Assessment Results Recorded</h3>
                <p className="text-xs text-[#575A51] dark:text-neutral-400 max-w-md mx-auto">
                  You haven't completed any assessments yet. Choose from our catalog of skill challenges to get evaluated and earn verified recruiter scorecards.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('assessments')}
                  className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <FileCheck size={14} />
                  <span>Browse Available Assessments</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {candidateSubmissions.map((submission) => {
                  const score = Number(submission.score) || 0;
                  const passingScore = Number(submission.passingScore) || 70;
                  const isPassed = submission.status === 'passed' || score >= passingScore;
                  const tabSwitches = Number(submission.tabSwitchCount) || 0;

                  return (
                    <div
                      key={submission.id}
                      className="p-5 sm:p-6 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs hover:border-[#111215]/30 dark:hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            submission.type === 'coding'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'bg-[#D4F82C] text-[#111215]'
                          }`}>
                            {submission.type === 'coding' ? 'Coding Challenge' : 'Aptitude Test'}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {isPassed ? '✓ Passed' : 'Needs Improvement'}
                          </span>
                          <span className="text-[10px] text-[#73766C] dark:text-neutral-400">
                            {tabSwitches === 0 ? '🛡️ Clean Audit' : `⚠️ ${tabSwitches} Tab Switch(es)`}
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-[#111215] dark:text-white truncate">
                          {submission.testTitle}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#73766C] dark:text-neutral-400">
                          <span>
                            Submitted: {submission.submittedAt?.toDate ? submission.submittedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                          </span>
                          <span>•</span>
                          <span>Pass Benchmark: {passingScore}%</span>
                        </div>

                        {submission.feedback && (
                          <p className="text-xs text-[#575A51] dark:text-neutral-300 bg-[#F8F9F5] dark:bg-white/5 p-2.5 rounded-xl border border-[#E4E7DC]/60 dark:border-white/5 line-clamp-2">
                            "{submission.feedback}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between md:flex-col md:items-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#E4E7DC] dark:border-white/10">
                        <div className="text-left md:text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block">
                            Final Score
                          </span>
                          <span className={`text-2xl sm:text-3xl font-black ${
                            score >= passingScore ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {score}%
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedScorecardSubmission(submission)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <FileText size={13} />
                          <span>View Scorecard</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {activeTab === 'resume' && (
          <div className="space-y-6">
            {/* Resume Hero & Quick Actions */}
            <div className="p-6 sm:p-8 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 font-bold shadow-xs">
                    <FileText size={26} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black tracking-tight text-[#111215] dark:text-white">Active Candidate Resume</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#D4F82C] text-[#111215] shadow-xs">
                        {candidate?.resumeUrl ? 'Document Connected' : 'No Resume'}
                      </span>
                    </div>
                    <p className="text-xs text-[#575A51] dark:text-neutral-400">
                      {candidate?.resumeOriginalName || 'Candidate_Resume.pdf'} • Used for AI match parsing, recruiter review, and live applications.
                    </p>
                    {candidate?.resumeUpdatedAt && (
                      <span className="text-[10px] text-[#73766C] dark:text-neutral-500 block">
                        Last updated: {new Date(candidate.resumeUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {candidate?.resumeUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewResumeModalUrl(candidate.resumeUrl)}
                        className="px-4 py-2 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-[#111215] dark:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Eye size={14} />
                        <span>Fullscreen Preview</span>
                      </button>

                      <a
                        href={candidate.resumeUrl}
                        download={candidate.resumeOriginalName || `${candidate.name || 'Candidate'}_Resume.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2 rounded-full text-xs font-bold text-white dark:text-[#111215] bg-[#111215] hover:bg-[#202227] dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Download size={14} />
                        <span>Download Resume</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Upload or Replace Resume Zone */}
              <div className="mt-6 pt-6 border-t border-[#E4E7DC] dark:border-white/10">
                <label className={`relative block border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer ${
                  isUploadingResume
                    ? 'border-[#8FB305] bg-[#D4F82C]/10'
                    : 'border-[#E4E7DC] dark:border-white/15 hover:border-[#111215] dark:hover:border-[#D4F82C] bg-[#F8F9F5] dark:bg-[#1D1F24]'
                }`}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    disabled={isUploadingResume}
                    onChange={handleUploadNewResume}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold shadow-xs">
                      {isUploadingResume ? (
                        <RefreshCw size={24} className="animate-spin text-[#111215]" />
                      ) : (
                        <UploadCloud size={24} />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#111215] dark:text-white">
                        {isUploadingResume ? 'Uploading resume to secure S3 storage...' : 'Click to Upload or Replace Resume'}
                      </span>
                      <p className="text-[11px] mt-0.5 text-[#73766C] dark:text-neutral-400">
                        Supports PDF, DOC, DOCX up to 15MB. Updating automatically syncs with all active job applications.
                      </p>
                    </div>
                  </div>
                </label>

                {resumeUploadSuccess && (
                  <div className="mt-3 p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{resumeUploadSuccess}</span>
                  </div>
                )}

                {resumeUploadError && (
                  <div className="mt-3 p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{resumeUploadError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Embedded Interactive Document Viewer */}
            <div className="p-5 sm:p-7 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#111215] text-[#D4F82C] dark:bg-white/10 dark:text-[#D4F82C] flex items-center justify-center font-bold">
                    <FileText size={16} />
                  </div>
                  <h4 className="text-sm font-black text-[#111215] dark:text-white">Interactive Resume Document Preview</h4>
                </div>
                {candidate?.resumeUrl && (
                  <a
                    href={candidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#111215] dark:text-white hover:underline flex items-center gap-1"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {candidate?.resumeUrl ? (
                <div className="w-full h-[650px] rounded-2xl overflow-hidden border border-[#E4E7DC] dark:border-white/10 bg-slate-900/40 relative">
                  <iframe
                    src={
                      candidate.resumeUrl.toLowerCase().includes('.doc')
                        ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(candidate.resumeUrl)}`
                        : candidate.resumeUrl
                    }
                    className="w-full h-full border-0"
                    title="Candidate Resume"
                  />
                </div>
              ) : (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 text-[#73766C] mx-auto flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <p className="text-xs text-[#73766C] dark:text-neutral-400">
                    No resume document uploaded yet. Upload a PDF or Word document above to enable preview!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Edit Profile & Skills */}
        {activeTab === 'edit-profile' && (
          <div className="space-y-6">
            {/* Full Profile Overview Card */}
            <div className="p-6 sm:p-8 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#111215] dark:text-white">
                      {editForm.name || candidate.name || 'Candidate Profile'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#D4F82C] text-[#111215] shadow-xs">
                      Active Job Seeker
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400">
                    {editForm.currentTitle || 'Professional'} • {editForm.totalExperienceYears ? `${editForm.totalExperienceYears} Yrs Experience` : 'Fresh Graduate'} • 📍 {editForm.location || 'Maharashtra, India'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="inline-flex items-center gap-1 text-[#73766C] dark:text-neutral-400 font-medium">
                      <Mail size={12} className="text-[#8FB305] dark:text-[#D4F82C]" />
                      <span>{editForm.email || candidate.email}</span>
                    </span>
                    <span className="text-[#E4E7DC] select-none">•</span>
                    <span className="inline-flex items-center gap-1 text-[#73766C] dark:text-neutral-400 font-medium">
                      <Phone size={12} className="text-[#8FB305] dark:text-[#D4F82C]" />
                      <span>{editForm.phone || candidate.phone || 'Phone not set'}</span>
                    </span>
                    {candidate.resumeFileName && (
                      <>
                        <span className="text-[#E4E7DC] select-none">•</span>
                        <span className="inline-flex items-center gap-1 text-[#111215] dark:text-[#D4F82C] font-semibold text-[11px]">
                          <FileText size={12} />
                          <span className="truncate max-w-[160px]">{candidate.resumeFileName}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('resume')}
                    className="px-4 py-2 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-[#111215] dark:text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    <span>View Resume</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Edit Candidate Profile & Skills Form */}
            <div className="p-6 sm:p-8 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/10 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-[#111215] dark:text-white">Edit Candidate Profile & Skills</h3>
                  <p className="text-xs mt-0.5 text-[#575A51] dark:text-neutral-400">
                    Update your contact info, role headline, skills, and experience. Job matching automatically updates in real time!
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                {profileErrorMsg && (
                  <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{profileErrorMsg}</span>
                  </div>
                )}

                {/* Section 1: Personal & Contact */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#111215] dark:text-[#D4F82C] mb-3 flex items-center gap-1.5">
                    <User size={14} />
                    <span>Personal & Contact Info</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    {/* Phone (Password reminder) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#111215] dark:text-neutral-200">
                          Phone Number *
                        </label>
                        <span className="text-[10px] text-[#8FB305] dark:text-[#D4F82C] font-bold">
                          🔑 Login Password
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Current Location / City
                      </label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        placeholder="e.g. Nashik, Pune, Mumbai"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    {/* Preferred Locations */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Preferred Job Locations (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editForm.preferredLocations}
                        onChange={(e) => setEditForm({ ...editForm, preferredLocations: e.target.value })}
                        placeholder="e.g. Nashik, Pune, Remote, Mumbai"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Professional & Experience */}
                <div className="pt-4 border-t border-[#E4E7DC] dark:border-white/10">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#111215] dark:text-[#D4F82C] mb-3 flex items-center gap-1.5">
                    <Briefcase size={14} />
                    <span>Role & Experience Details</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Headline / Current Title */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Current Job Title / Professional Headline
                      </label>
                      <input
                        type="text"
                        value={editForm.currentTitle}
                        onChange={(e) => setEditForm({ ...editForm, currentTitle: e.target.value })}
                        placeholder="e.g. Full Stack Developer, Computer Engineering Graduate"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    {/* Total Experience Years */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Total Experience (Years)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={editForm.totalExperienceYears}
                        onChange={(e) => setEditForm({ ...editForm, totalExperienceYears: e.target.value })}
                        placeholder="0 for Fresher"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    {/* Notice Period */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Notice Period
                      </label>
                      <select
                        value={editForm.noticePeriod}
                        onChange={(e) => setEditForm({ ...editForm, noticePeriod: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white font-bold outline-none cursor-pointer transition-all"
                      >
                        <option value="Immediate">Immediate Joiner</option>
                        <option value="15 Days">15 Days</option>
                        <option value="30 Days">30 Days (1 Month)</option>
                        <option value="60 Days">60 Days (2 Months)</option>
                        <option value="90 Days">90 Days (3 Months)</option>
                      </select>
                    </div>

                    {/* Current CTC */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Current CTC / Salary
                      </label>
                      <input
                        type="text"
                        value={editForm.currentSalary}
                        onChange={(e) => setEditForm({ ...editForm, currentSalary: e.target.value })}
                        placeholder="e.g. ₹3.5 LPA or ₹25,000 / month"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    {/* Expected CTC */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Expected CTC / Salary
                      </label>
                      <input
                        type="text"
                        value={editForm.expectedSalary}
                        onChange={(e) => setEditForm({ ...editForm, expectedSalary: e.target.value })}
                        placeholder="e.g. ₹5 LPA or ₹40,000 / month"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Key Skills (Interactive Tag Editor) */}
                <div className="pt-4 border-t border-[#E4E7DC] dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#111215] dark:text-[#D4F82C] flex items-center gap-1.5">
                      <Tag size={14} />
                      <span>Key Skills ({editForm.skills.length})</span>
                    </h4>
                    <span className="text-[11px] text-[#73766C] dark:text-neutral-400">
                      Press Enter or click "Add" to add a skill
                    </span>
                  </div>

                  {/* Add Skill Input Bar */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      placeholder="Type skill name (e.g. React, Python, SQL, Excel, UI/UX)..."
                      className="flex-1 px-4 py-2.5 text-xs rounded-full bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-5 py-2.5 rounded-full text-xs font-bold text-white dark:text-[#111215] bg-[#111215] hover:bg-[#202227] dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Existing Skills Tags Container */}
                  <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] min-h-[90px] flex flex-wrap items-center gap-2">
                    {editForm.skills.length === 0 ? (
                      <span className="text-xs text-[#73766C] dark:text-neutral-400 italic">No skills listed yet. Add your key skills above.</span>
                    ) : (
                      editForm.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E4E7DC]/70 dark:bg-white/10 text-[#111215] dark:text-white border border-[#E4E7DC] dark:border-white/10 group shadow-2xs"
                        >
                          <span>{skill}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            className="hover:text-rose-500 cursor-pointer transition-colors"
                            title={`Remove ${skill}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 4: Education */}
                <div className="pt-4 border-t border-[#E4E7DC] dark:border-white/10">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#111215] dark:text-[#D4F82C] mb-3 flex items-center gap-1.5">
                    <GraduationCap size={14} />
                    <span>Education Qualification</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Highest Degree / Diploma
                      </label>
                      <input
                        type="text"
                        value={editForm.highestEducation}
                        onChange={(e) => setEditForm({ ...editForm, highestEducation: e.target.value })}
                        placeholder="e.g. BE Computers, B.Sc, Diploma IT"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        College / University
                      </label>
                      <input
                        type="text"
                        value={editForm.institution}
                        onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                        placeholder="e.g. Savitribai Phule Pune University"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#111215] dark:text-neutral-200">
                        Passing Year
                      </label>
                      <input
                        type="text"
                        value={editForm.graduationYear}
                        onChange={(e) => setEditForm({ ...editForm, graduationYear: e.target.value })}
                        placeholder="e.g. 2024"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Professional Summary */}
                <div className="pt-4 border-t border-[#E4E7DC] dark:border-white/10">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#111215] dark:text-neutral-200">
                    Professional Summary / Bio
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.summary}
                    onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                    placeholder="Briefly describe your career objectives, main technical strengths, and preferred roles..."
                    className="w-full p-3.5 text-xs rounded-2xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white placeholder-[#73766C]/60 focus:bg-white dark:focus:bg-[#15161A] focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-5 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('matches')}
                    className="px-5 py-2.5 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-white/5 text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white transition-all cursor-pointer shadow-xs"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-6 py-2.5 rounded-full text-xs font-black text-white dark:text-[#111215] bg-[#111215] hover:bg-[#202227] dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSavingProfile ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}
        </main>
      </div>
    </div>

      {/* Full Job Details Modal */}
      {/* Full Job Details Modal */}
      {selectedJobModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md overflow-hidden animate-in fade-in"
          onClick={() => {
            setSelectedJobModal(null);
            hasDismissedJobModalRef.current = true;
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex flex-col w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            {(() => {
              const modalJob: any = (selectedJobModal as any).job || selectedJobModal;
              const overallScore = selectedJobModal.overallScore ?? 85;
              const matchGrade = selectedJobModal.matchGrade || 'Strong Recommendation';
              const liveJob = allJobs.find(j =>
                (modalJob.id && j.id === modalJob.id) ||
                (modalJob.jobNo && j.jobNo === modalJob.jobNo) ||
                (modalJob.accessCode && j.accessCode === modalJob.accessCode)
              ) || modalJob;

              const candEmail = (candidate?.email || candidate?.profile?.email || editForm.email || '').trim().toLowerCase();
              const candPhoneNorm = (candidate?.phone || candidate?.profile?.phone || editForm.phone || '').replace(/\D/g, '');

              const isCandMatch = (c: any) => {
                if (!c) return false;
                const cEmail = (c.email || '').toLowerCase().trim();
                if (candEmail && cEmail && cEmail === candEmail) return true;
                const cPhone = String(c.phone || '').replace(/\D/g, '');
                if (candPhoneNorm && cPhone && (cPhone === candPhoneNorm || cPhone.endsWith(candPhoneNorm) || candPhoneNorm.endsWith(cPhone))) return true;
                return false;
              };

              const candInJobData = (Array.isArray(liveJob.candidateData) ? liveJob.candidateData.find(isCandMatch) : null) ||
                (Array.isArray(modalJob.candidateData) ? modalJob.candidateData.find(isCandMatch) : null);

              const candInJobEmails = (Array.isArray(liveJob.candidateEmails) && liveJob.candidateEmails.some((e: any) => candEmail && String(e).toLowerCase().trim() === candEmail)) ||
                (Array.isArray(modalJob.candidateEmails) && modalJob.candidateEmails.some((e: any) => candEmail && String(e).toLowerCase().trim() === candEmail));

              const isModalApplied = appliedJobIds.includes(modalJob.id) ||
                (modalJob.jobNo && appliedJobIds.includes(modalJob.jobNo)) ||
                (modalJob.accessCode && appliedJobIds.includes(modalJob.accessCode)) ||
                Boolean(appliedApplications[modalJob.id]) ||
                Boolean(modalJob.jobNo && appliedApplications[modalJob.jobNo]) ||
                Boolean(modalJob.accessCode && appliedApplications[modalJob.accessCode]) ||
                Boolean(candInJobData) ||
                candInJobEmails;

              const modalAppInfo = appliedApplications[modalJob.id] ||
                (modalJob.jobNo && appliedApplications[modalJob.jobNo]) ||
                (modalJob.accessCode && appliedApplications[modalJob.accessCode]) ||
                (candInJobData ? {
                  jobId: modalJob.id,
                  status: candInJobData.status || 'Under Review',
                  appliedAt: candInJobData.appliedAt,
                  statusUpdatedAt: candInJobData.statusUpdatedAt,
                  scheduledInterview: candInJobData.scheduledInterview,
                  recruiterNotes: candInJobData.recruiterNotes,
                  matchScore: candInJobData.matchScore,
                } : (candInJobEmails ? { jobId: modalJob.id, status: 'Under Review' } : undefined));

              const modalStatus = modalAppInfo?.status || (isModalApplied ? 'Under Review' : '');

              return (
                <>
                  <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shrink-0">
                    <div className="space-y-1.5 pr-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30">
                          <Sparkles size={12} className="text-[#8FB305]" />
                          <span>{overallScore}% Match • {matchGrade}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => togglePlayAudio(modalJob)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                            playingJobId === modalJob.id
                              ? 'bg-[#111215] text-[#D4F82C] border-[#111215] dark:bg-[#D4F82C] dark:text-[#111215]'
                              : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#111215] dark:hover:border-white/30'
                          }`}
                          title="Listen to job summary"
                        >
                          {playingJobId === modalJob.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                          <span>{playingJobId === modalJob.id ? 'Listening...' : 'Listen to Role'}</span>
                        </button>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111215] dark:text-[#F8F9F5] leading-snug pt-1">
                        {modalJob.title || 'Job Opening'}
                      </h3>
                      <p className="text-xs font-medium text-[#575A51] dark:text-neutral-400">
                        {modalJob.company || 'Company'} • {modalJob.location || 'Location'} • Job Code #{modalJob.accessCode || modalJob.jobNo || 'N/A'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobModal(null);
                        hasDismissedJobModalRef.current = true;
                      }}
                      className="p-2.5 rounded-full border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white hover:bg-[#F8F9F5] dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                      aria-label="Close modal"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Scrollable Body Wrapper */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 overscroll-contain">
                    {/* Modal Info Bento Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-3 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]/60">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Experience</span>
                        <span className="font-bold text-sm text-[#111215] dark:text-[#F8F9F5] truncate block">{modalJob.experience || 'Not Specified'}</span>
                      </div>
                      <div className="p-3 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]/60">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Salary / CTC</span>
                        <span className="font-bold text-sm text-[#111215] dark:text-[#F8F9F5] truncate block">{modalJob.salary || 'Competitive'}</span>
                      </div>
                      <div className="p-3 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]/60">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Department</span>
                        <span className="font-bold text-sm text-[#111215] dark:text-[#F8F9F5] truncate block">{modalJob.department || 'General'}</span>
                      </div>
                      <div className="p-3 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]/60">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#73766C] dark:text-neutral-400 block mb-0.5">Type</span>
                        <span className="font-bold text-sm text-[#111215] dark:text-[#F8F9F5] truncate block">{modalJob.employmentType || modalJob.jobType || 'Full-time'}</span>
                      </div>
                    </div>

                    {/* Required Skills */}
                    {(() => {
                      const rawSkills = modalJob.skills;
                      const modalSkills = Array.isArray(rawSkills)
                        ? rawSkills
                        : typeof rawSkills === 'string'
                        ? rawSkills.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
                        : [];

                      if (modalSkills.length === 0) return null;

                      return (
                        <div className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#575A51] dark:text-neutral-400 block">Required Skills</span>
                          <div className="flex flex-wrap gap-2">
                            {modalSkills.map((s: string) => {
                              const isMatched = Array.isArray(selectedJobModal.skillMatch?.matchedSkills) && selectedJobModal.skillMatch.matchedSkills.includes(s);
                              return (
                                <span
                                  key={s}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
                                    isMatched
                                      ? 'bg-[#D4F82C]/25 text-[#111215] dark:text-[#D4F82C] border-[#8FB305]/40 font-bold'
                                      : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300'
                                  }`}
                                >
                                  {isMatched && <Check size={12} strokeWidth={3} className="text-[#8FB305]" />}
                                  <span>{s}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Full Description */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#575A51] dark:text-neutral-400 block">Job Description</span>
                      <div className="p-4 sm:p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 text-xs sm:text-sm leading-relaxed max-h-60 overflow-y-auto whitespace-pre-line bg-[#F8F9F5] dark:bg-[#101114] text-[#111215] dark:text-[#E4E7DC]">
                        {modalJob.description || 'No detailed description provided.'}
                      </div>
                    </div>

                    {/* Confirmed Interview or Application Status in Modal */}
                    {isModalApplied && (
                      <div className="mt-4 p-4 rounded-2xl border border-[#8FB305]/40 bg-[#D4F82C]/10 dark:bg-[#D4F82C]/5 text-[#111215] dark:text-[#F8F9F5]">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-[#8FB305] shrink-0" />
                            <span className="text-xs font-bold text-[#575A51] dark:text-neutral-400">Application Status:</span>
                            <span className="text-xs font-black px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]">
                              {modalStatus === 'pending' || modalStatus === 'interested' ? 'Applied • Under Review' : modalStatus}
                            </span>
                          </div>
                          {modalAppInfo?.appliedAt && (
                            <span className="text-[11px] text-[#73766C] dark:text-neutral-400 font-mono">
                              Applied {formatDisplayDate(modalAppInfo.appliedAt)}
                            </span>
                          )}
                        </div>

                        {modalAppInfo?.scheduledInterview && (
                          <div className="mt-3 pt-3 border-t border-[#8FB305]/20 text-xs space-y-2">
                            <div className="font-bold text-[#111215] dark:text-[#F8F9F5] flex items-center gap-1.5">
                              <Calendar size={14} className="text-[#8FB305]" />
                              <span>Confirmed Interview Session</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#575A51] dark:text-neutral-300">
                              {modalAppInfo.scheduledInterview.date && (
                                <div>🗓 <strong>Date:</strong> {modalAppInfo.scheduledInterview.date} {modalAppInfo.scheduledInterview.time}</div>
                              )}
                              {modalAppInfo.scheduledInterview.contactPerson && (
                                <div>👤 <strong>Contact:</strong> {modalAppInfo.scheduledInterview.contactPerson}</div>
                              )}
                              {modalAppInfo.scheduledInterview.mode && (
                                <div>💼 <strong>Mode:</strong> {modalAppInfo.scheduledInterview.mode}</div>
                              )}
                              {modalAppInfo.scheduledInterview.location && (
                                <div>📍 <strong>Venue:</strong> {modalAppInfo.scheduledInterview.location}</div>
                              )}
                            </div>
                            {modalAppInfo.scheduledInterview.link && (() => {
                              const raw = String(modalAppInfo.scheduledInterview.link).trim();
                              const cleanDigits = raw.replace(/\D/g, '');
                              const isPhone = cleanDigits.length >= 7 && cleanDigits.length <= 15 && !raw.includes('http') && !raw.includes('.com') && !raw.includes('/') && !raw.includes('meet');
                              const isWeb = raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('meet.google') || raw.includes('zoom.us') || raw.includes('teams.microsoft') || raw.includes('.com') || raw.includes('.in');
                              const targetUrl = isWeb ? (raw.startsWith('http') ? raw : `https://${raw}`) : '';
                              const waDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

                              return (
                                <div className="mt-2.5 p-3.5 rounded-2xl border border-[#8FB305]/30 bg-white/90 dark:bg-black/40 space-y-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[#111215] dark:text-[#D4F82C] flex items-center gap-1.5">
                                      {isPhone ? <Phone size={13} /> : <ExternalLink size={13} />}
                                      <span>{isPhone ? 'Interviewer Phone / Direct Contact' : isWeb ? 'Meeting Link / Platform' : 'Meeting Details'}</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyInterviewLink(raw)}
                                      className="text-[#8FB305] dark:text-[#D4F82C] hover:underline flex items-center gap-1 font-semibold cursor-pointer text-xs"
                                    >
                                      {copiedLink === raw ? <Check size={12} /> : <Copy size={12} />}
                                      <span>{copiedLink === raw ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>
                                  <div className="font-mono text-xs font-bold text-[#111215] dark:text-[#F8F9F5] break-all select-all p-2 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                                    {raw}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {isPhone && (
                                      <>
                                        <a
                                          href={`tel:${cleanDigits}`}
                                          className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111215] hover:bg-[#202227] flex items-center gap-1.5 shadow-sm"
                                        >
                                          <Phone size={12} />
                                          <span>Call {cleanDigits}</span>
                                        </a>
                                        <a
                                          href={`https://wa.me/${waDigits}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba5a] flex items-center gap-1.5 shadow-sm"
                                        >
                                          <MessageCircle size={12} />
                                          <span>WhatsApp</span>
                                        </a>
                                      </>
                                    )}
                                    {isWeb && (
                                      <a
                                        href={targetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 rounded-full text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] flex items-center gap-1.5 shadow-sm"
                                      >
                                        <ExternalLink size={12} />
                                        <span>Join Meeting</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            {modalAppInfo.scheduledInterview.notes && (
                              <div className="text-xs text-[#73766C] dark:text-neutral-400 italic pt-1">
                                📝 {modalAppInfo.scheduledInterview.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sticky Fixed Bottom Actions Footer */}
                  <div className="px-6 py-4 border-t border-[#E4E7DC] dark:border-white/10 shrink-0 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#15161A]">
                    <div className="flex items-center gap-2">
                      {isModalApplied ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#575A51] dark:text-neutral-400">Status:</span>
                          <span className="text-xs font-black px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]">
                            {modalStatus === 'pending' || modalStatus === 'interested' ? 'Applied • Under Review' : modalStatus}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#575A51] dark:text-neutral-400">
                          Submit your 1-click application now.
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobModal(null);
                          hasDismissedJobModalRef.current = true;
                        }}
                        className="px-5 py-2.5 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:bg-[#F8F9F5] dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        Close
                      </button>

                      {(modalJob.isAiVideoInterview || liveJob.isAiVideoInterview || modalJob.interviewMode || liveJob.interviewMode || modalJob.accessCode || liveJob.accessCode || modalJob.interviewLink || liveJob.interviewLink) && (
                        <button
                          type="button"
                          onClick={() => {
                            const candEmailParam = candEmail ? `?email=${encodeURIComponent(candEmail)}&name=${encodeURIComponent(editForm.name || candidate?.name || '')}` : '';
                            navigate(`/interview/video/${modalJob.id}${candEmailParam}`);
                          }}
                          className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#D4F82C] text-[#111215] hover:bg-[#c7eb22] flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Sparkles size={13} />
                          <span>Start AI Interview</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isModalApplied}
                        onClick={() => {
                          handleApplyToJob(selectedJobModal);
                          setSelectedJobModal(null);
                          hasDismissedJobModalRef.current = true;
                        }}
                        className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                          isModalApplied
                            ? 'bg-[#D4F82C]/20 text-[#111215] dark:text-[#D4F82C] border border-[#8FB305]/30 cursor-default'
                            : 'bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c7eb22] active:scale-95 cursor-pointer'
                        }`}
                      >
                        {isModalApplied
                          ? `Already Applied (${modalStatus === 'pending' || modalStatus === 'interested' ? 'Under Review' : modalStatus})`
                          : 'Apply to This Job'}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Fullscreen Resume Modal */}
      {previewResumeModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className={`relative w-full max-w-5xl h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border ${
            isDark ? 'bg-[#121218] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-500" />
                <span className="text-sm font-bold truncate max-w-xs sm:max-w-md">
                  {candidate?.resumeOriginalName || 'Candidate Resume Preview'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewResumeModalUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                    isDark ? 'border-white/10 hover:bg-white/5 text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                  title="Download File"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewResumeModalUrl(null)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-black hover:bg-slate-100'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 w-full bg-slate-900/60 relative">
              <iframe
                src={
                  previewResumeModalUrl.toLowerCase().includes('.doc')
                    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewResumeModalUrl)}`
                    : previewResumeModalUrl
                }
                className="w-full h-full border-0"
                title="Resume Fullscreen Viewer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Native App-like Mobile Bottom Navigation Bar */}
      <nav aria-label="Candidate Navigation" className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c0c10]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl safe-area-inset-bottom">
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'dashboard'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] mt-0.5 tracking-tight">Dashboard</span>
        </button>

        {/* Matches */}
        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'matches'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <div className="relative">
            <Sparkles size={20} />
            {matchedJobs.length > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 text-[9px] font-black rounded-full bg-emerald-500 text-white min-w-[15px] text-center">
                {matchedJobs.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Matches</span>
        </button>

        {/* Applied */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('applied');
            setAppliedStageFilter('all');
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'applied'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <div className="relative">
            <Send size={20} />
            {myApplicationsList.length > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 text-[9px] font-black rounded-full bg-blue-500 text-white min-w-[15px] text-center">
                {myApplicationsList.length}
              </span>
            )}
            {shortlistedCount > 0 && (
              <span className="absolute -bottom-0.5 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-black animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Applied</span>
        </button>

        {/* Assessments */}
        <button
          type="button"
          onClick={() => setActiveTab('assessments')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'assessments' || activeTab === 'assessment-results'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <FileCheck size={20} />
          <span className="text-[10px] mt-0.5 tracking-tight">Tests</span>
        </button>

        {/* Resume */}
        <button
          type="button"
          onClick={() => setActiveTab('resume')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'resume'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <div className="relative">
            <FileText size={20} />
            {candidate?.resumeUrl && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Resume</span>
        </button>

        {/* Edit Profile */}
        <button
          type="button"
          onClick={() => setActiveTab('edit-profile')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'edit-profile'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <UserCheck size={20} />
          <span className="text-[10px] mt-0.5 tracking-tight">Profile</span>
        </button>
      </nav>

      {renderTargetJdModal()}
      {renderScorecardModal()}
    </div>
  );
};

export default CandidatePortal;
