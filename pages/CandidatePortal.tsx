import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
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
  MessageCircle
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  arrayUnion
} from 'firebase/firestore';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import DayNightToggle from '../components/DayNightToggle';
import { useTheme } from '../context/ThemeContext';
import { db } from '../services/firebase';
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
  const { isDark } = useTheme();
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

  const [emailInput, setEmailInput] = useState('');
  const [phonePasswordInput, setPhonePasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab inside Dashboard: 'matches' | 'applied' | 'resume' | 'edit-profile'
  const [activeTab, setActiveTab] = useState<'matches' | 'applied' | 'resume' | 'edit-profile'>('matches');

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

  // Fetch all active jobs from Firestore interviews & jobs collections (same source as upload resume)
  useEffect(() => {
    setJobsLoading(true);
    let activeInterviewsList: any[] = [];
    let activeJobsList: any[] = [];

    const mergeJobs = () => {
      const allRaw = [...activeInterviewsList, ...activeJobsList];
      const seenIds = new Set<string>();
      const combined: any[] = [];

      for (const item of allRaw) {
        if (!item || !item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        const statusLower = String(item.status || '').trim().toLowerCase();
        if (['inactive', 'expired', 'closed', 'disabled', 'deactivated', 'draft'].includes(statusLower)) {
          continue;
        }
        if (item.isMock) continue;

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

    const candEdu = editForm.highestEducation || candidate.highestEducation || candidate.education || (prof.education && Array.isArray(prof.education) ? prof.education[0]?.degree : prof.education) || 'Graduate';

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

    const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const params = new URLSearchParams(location.search || hashPart || window.location.search);
    const targetJobId = params.get('job') || params.get('jobId');
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

  // Filtered Matches based on search, score, and segmented tabs
  const filteredMatches = useMemo(() => {
    let list = matchedJobs;

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

    return list;
  }, [matchedJobs, matchFilter, editForm.location, candidate?.location, searchJobQuery]);

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

  // If NOT logged in -> Render Dedicated Candidate Login Screen
  if (!candidate) {
    return (
      <div className={`min-h-screen flex flex-col justify-between transition-colors ${
        isDark ? 'bg-[#060608] text-white' : 'bg-slate-50 text-slate-900'
      }`}>
        {/* Navigation Bar */}
        <header className={`border-b px-6 py-4 flex items-center justify-between transition-colors ${
          isDark ? 'border-white/10 bg-[#0a0a0c]/80 backdrop-blur-md' : 'border-slate-200 bg-white/80 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-auto" isDark={isDark} />
            <span className="hidden sm:inline-block text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Candidate Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DayNightToggle />
            <Link
              to="/auth"
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                isDark ? 'border-white/15 bg-white/5 hover:bg-white/10 text-slate-300' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
            >
              <span>Recruiter Portal</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </header>

        {/* Login Main Container */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
          <div className={`w-full max-w-md rounded-2xl border p-6 sm:p-8 shadow-2xl transition-all ${
            isDark ? 'bg-[#111115] border-white/10 shadow-black/80' : 'bg-white border-slate-200/90 shadow-slate-200/60'
          }`}>
            {/* Header Badge & Title */}
            <div className="text-center space-y-2 mb-7">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 mb-1">
                <Sparkles size={22} strokeWidth={2.2} />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Candidate Login</h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Sign in with your registered <strong>Email</strong> and <strong>Phone Number</strong> (as password) to access your matched jobs and ATS profile.
              </p>
            </div>

            {(() => {
              const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
              const urlParams = new URLSearchParams(location.search || hashPart || window.location.search);
              const targetJobId = urlParams.get('job') || urlParams.get('jobId');
              if (!targetJobId) return null;
              return (
                <div className="mb-5 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5 leading-relaxed">
                  <Sparkles size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                  <div className="flex-1">
                    <span className="font-bold block">Applying for Job #{targetJobId}</span>
                    <span>Sign in with your Email & Phone Number (as password) to submit your 1-click application.</span>
                    <div className="mt-2">
                      <Link
                        to={`/upload-resume`}
                        className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <span>New here? Upload Resume to register & apply</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Error Banner */}
            {authError && (
              <div className="mb-5 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 leading-relaxed">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{authError}</span>
                  {authError.includes('upload your resume') && (
                    <div className="mt-2">
                      <Link
                        to="/upload-resume"
                        className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <span>Upload Resume Now</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Field */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. yourname@example.com"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium border transition-all outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                      isDark
                        ? 'bg-black/40 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
                    }`}
                  />
                </div>
              </div>

              {/* Password (Phone Number) Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-bold uppercase tracking-wider ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Password (Phone Number)
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Registered Mobile No.
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={phonePasswordInput}
                    onChange={(e) => setPhonePasswordInput(e.target.value)}
                    placeholder="Enter registered phone number"
                    className={`w-full pl-10 pr-11 py-2.5 rounded-xl text-sm font-medium border transition-all outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                      isDark
                        ? 'bg-black/40 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                  <span>Use the phone number you provided on your resume.</span>
                </p>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-emerald-500"
                  />
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Stay signed in
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Candidate Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Footer Navigation */}
            <div className={`mt-6 pt-5 border-t text-center space-y-3 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Haven't registered or uploaded your resume yet?{' '}
                <Link
                  to="/upload-resume"
                  className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Upload Resume →
                </Link>
              </p>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Are you an Employer or HR?{' '}
                <Link to="/auth" className="hover:underline font-medium text-slate-400 hover:text-white">
                  Recruiter Sign In
                </Link>
              </p>
            </div>
          </div>
        </main>

        {/* Simple Footer */}
        <footer className={`border-t py-4 text-center text-xs ${
          isDark ? 'border-white/5 text-slate-500' : 'border-slate-200 text-slate-400'
        }`}>
          © {new Date().getFullYear()} SNAB hireX • Candidate Portal
        </footer>
      </div>
    );
  }

  // ==========================================
  // LOGGED IN: Candidate Dashboard View
  // ==========================================
  return (
    <div className={`min-h-screen flex flex-col transition-colors ${
      isDark ? 'bg-[#08080a] text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Header Bar */}
      <header className={`sticky top-0 z-40 border-b px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors ${
        isDark ? 'border-white/10 bg-[#0d0d11]/90 backdrop-blur-md' : 'border-slate-200 bg-white/90 backdrop-blur-md'
      }`}>
        {/* Brand & Badge */}
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-auto" isDark={isDark} />
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Candidate Portal</span>
          </div>
        </div>

        {/* User Chip & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold leading-tight truncate max-w-[180px]">
              {editForm.name || candidate.name || 'Candidate'}
            </span>
            <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
              {editForm.email || candidate.email}
            </span>
          </div>

          <DayNightToggle />

          <button
            type="button"
            onClick={handleLogout}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDark
                ? 'border-white/10 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 text-slate-300'
                : 'border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700'
            }`}
            title="Log out of candidate account"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-28 sm:pb-12 space-y-6">
        {/* Clean Welcome Header - ONLY on Home (Matched roles) tab */}
        {activeTab === 'matches' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Welcome, {editForm.name || candidate.name || 'Candidate'} 👋
              </h1>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Explore your personalized AI-matched job opportunities.
              </p>
            </div>
          </div>
        )}

        {/* Quick App-like Metric Cards Grid - ONLY shown on Home (Matched roles) tab */}
        {activeTab === 'matches' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
            {/* Card 1: Matched Jobs */}
            <button
              type="button"
              onClick={() => setActiveTab('matches')}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                activeTab === 'matches'
                  ? isDark ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30' : 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500/20'
                  : isDark ? 'bg-[#101014] border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles size={14} className="sm:hidden" />
                  <Sparkles size={16} className="hidden sm:block" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  AI Match
                </span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {matchedJobs.length}
              </div>
              <div className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                Matched Roles
              </div>
              <div className="hidden sm:block text-[10px] text-slate-400 mt-0.5 truncate">
                {matchedJobs.length > 0 ? `${matchedJobs[0].overallScore}% top fit score` : 'Open roles matching criteria'}
              </div>
            </button>

            {/* Card 2: Applied Jobs */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('applied');
                setAppliedStageFilter('all');
              }}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                activeTab === 'applied' && appliedStageFilter === 'all'
                  ? isDark ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30' : 'bg-blue-50 border-blue-300 ring-1 ring-blue-500/20'
                  : isDark ? 'bg-[#101014] border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Briefcase size={14} className="sm:hidden" />
                  <Briefcase size={16} className="hidden sm:block" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                  Track
                </span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {myApplicationsList.length}
              </div>
              <div className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                My Applications
              </div>
              <div className="hidden sm:block text-[10px] text-slate-400 mt-0.5 truncate">
                {underReviewCount > 0 ? `${underReviewCount} under review` : 'Total submitted jobs'}
              </div>
            </button>

            {/* Card 3: Shortlisted & Interviews */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('applied');
                setAppliedStageFilter('shortlisted');
              }}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                activeTab === 'applied' && appliedStageFilter === 'shortlisted'
                  ? isDark ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/30' : 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500/20'
                  : isDark ? 'bg-[#101014] border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Calendar size={14} className="sm:hidden" />
                  <Calendar size={16} className="hidden sm:block" />
                </div>
                {shortlistedCount > 0 && (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Active
                  </span>
                )}
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {shortlistedCount}
              </div>
              <div className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                Shortlisted
              </div>
              <div className="hidden sm:block text-[10px] text-slate-400 mt-0.5 truncate">
                {shortlistedCount > 0 ? 'Upcoming interview rounds' : 'No active rounds'}
              </div>
            </button>

            {/* Card 4: Resume */}
            <button
              type="button"
              onClick={() => setActiveTab('resume')}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                activeTab === 'resume'
                  ? isDark ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30' : 'bg-purple-50 border-purple-300 ring-1 ring-purple-500/20'
                  : isDark ? 'bg-[#101014] border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileText size={14} className="sm:hidden" />
                  <FileText size={16} className="hidden sm:block" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                  CV
                </span>
              </div>
              <div className="text-xs sm:text-base font-black text-slate-900 dark:text-white leading-tight truncate">
                {candidate?.resumeUrl ? 'Attached' : 'Upload CV'}
              </div>
              <div className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                Resume CV
              </div>
              <div className="hidden sm:block text-[10px] text-slate-400 mt-0.5 truncate">
                {candidate?.resumeFileName || 'View, preview & replace'}
              </div>
            </button>
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

        {/* Navigation Tabs (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-1 overflow-x-auto">
          {/* Tab 1: Matched Jobs */}
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'matches'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>Matched Jobs</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'matches'
                ? 'bg-white/20 text-white'
                : isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {matchedJobs.length}
            </span>
          </button>

          {/* Tab 2: My Applications */}
          <button
            type="button"
            onClick={() => setActiveTab('applied')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'applied'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Briefcase size={14} />
            <span>My Applications</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'applied'
                ? 'bg-white/20 text-white'
                : isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {myApplicationsList.length}
            </span>
            {shortlistedCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" title="Active interview rounds!" />
            )}
          </button>

          {/* Tab 3: My Resume */}
          <button
            type="button"
            onClick={() => setActiveTab('resume')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'resume'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <FileText size={14} />
            <span>My Resume</span>
          </button>

          {/* Tab 4: Edit Profile & Skills */}
          <button
            type="button"
            onClick={() => setActiveTab('edit-profile')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'edit-profile'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Edit3 size={14} />
            <span>Edit Profile & Skills</span>
          </button>
        </div>

        {/* TAB 1: Matched Jobs */}
        {activeTab === 'matches' && (
          <div className="space-y-6">
            {/* Search and Filters Bar with Segmented Tabs matching Upload Resume */}
            <div className={`p-3.5 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
              isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200'
            }`}>
              {/* Segmented Filter Tabs matching upload resume */}
              <div className={`flex items-center gap-1 p-1 rounded-xl shadow-xs border overflow-x-auto ${
                isDark ? 'bg-[#0f0f10] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setMatchFilter('EligibleOnly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer ${
                    matchFilter === 'EligibleOnly'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 font-semibold'
                  }`}
                >
                  Eligible
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFilter('HighMatch')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer ${
                    matchFilter === 'HighMatch'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 font-semibold'
                  }`}
                >
                  High Match (&ge; 60%)
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFilter('LocalCity')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer inline-flex items-center gap-1 ${
                    matchFilter === 'LocalCity'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 font-semibold'
                  }`}
                >
                  <MapPin size={12} />
                  <span>{editForm.location || candidate?.location || 'Nashik'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFilter('All')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer ${
                    matchFilter === 'All'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 font-semibold'
                  }`}
                >
                  All ({matchedJobs.length})
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                {/* Search input */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchJobQuery}
                    onChange={(e) => setSearchJobQuery(e.target.value)}
                    placeholder="Filter by title, company, skill..."
                    className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none ${
                      isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                {/* Match Score Filter */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Filter size={13} className="text-slate-400 shrink-0" />
                  <select
                    value={minScoreFilter}
                    onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none font-semibold cursor-pointer ${
                      isDark ? 'bg-[#151518] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`}
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

                  const isApplied = appliedJobIds.includes(job.id) ||
                    (job.jobNo && appliedJobIds.includes(job.jobNo)) ||
                    (job.accessCode && appliedJobIds.includes(job.accessCode)) ||
                    Boolean(appliedApplications[job.id]) ||
                    Boolean(job.jobNo && appliedApplications[job.jobNo]) ||
                    Boolean(job.accessCode && appliedApplications[job.accessCode]) ||
                    Boolean(candInJobData) ||
                    candInJobEmails;

                  const applicationInfo = appliedApplications[job.id] ||
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
                      className={`rounded-2xl border p-5 flex flex-col justify-between transition-all hover:shadow-lg ${
                        isDark
                          ? 'bg-[#101014] border-white/10 hover:border-emerald-500/40'
                          : 'bg-white border-slate-200 hover:border-emerald-500/40 shadow-xs'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            matchItem.overallScore >= 80
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : matchItem.overallScore >= 60
                              ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          }`}>
                            <Sparkles size={11} />
                            <span>{matchItem.overallScore}% Match • {matchItem.matchGrade}</span>
                          </span>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10 text-slate-500">
                            #{job.accessCode}
                          </span>
                        </div>

                        {/* Title & Company */}
                        <div>
                          <h4 className="text-base sm:text-lg font-black tracking-tight hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                            {job.title}
                          </h4>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Building2 size={13} className="text-slate-400" />
                            <span>{job.company}</span>
                            <span>•</span>
                            <span>{job.department}</span>
                          </p>
                        </div>

                        {/* Details Pills: Location, Exp, Salary */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                            isDark ? 'bg-white/[0.02] border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <MapPin size={12} className="text-emerald-500 shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>

                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                            isDark ? 'bg-white/[0.02] border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <Briefcase size={12} className="text-emerald-500 shrink-0" />
                            <span className="truncate">{job.experience}</span>
                          </div>

                          <div className={`p-2 rounded-xl border col-span-2 sm:col-span-1 flex items-center gap-1.5 ${
                            isDark ? 'bg-white/[0.02] border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <Clock size={12} className="text-emerald-500 shrink-0" />
                            <span className="truncate">{job.salary}</span>
                          </div>
                        </div>

                        {/* Matched Skills */}
                        {matchItem.skillMatch?.matchedSkills?.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                              Matching Skills ({matchItem.skillMatch.matchedSkills.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {matchItem.skillMatch.matchedSkills.map((sk: string) => (
                                <span
                                  key={sk}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                >
                                  <Check size={10} strokeWidth={3} />
                                  <span>{sk}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Application Status Banner (if candidate already applied) */}
                        {isApplied && (
                          <div className={`mt-3 p-3 rounded-xl border ${
                            applicationInfo?.status === 'Interview Scheduled'
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40 text-slate-800 dark:text-slate-200'
                              : applicationInfo?.status === 'Shortlisted'
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-slate-800 dark:text-slate-200'
                              : applicationInfo?.status === 'Hired'
                              ? 'bg-green-50/80 dark:bg-green-950/20 border-green-200 dark:border-green-800/40 text-slate-800 dark:text-slate-200'
                              : applicationInfo?.status === 'Offer Extended'
                              ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-slate-800 dark:text-slate-200'
                              : applicationInfo?.status === 'Rejected'
                              ? 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-slate-800 dark:text-slate-200'
                              : 'bg-blue-50/80 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40 text-slate-800 dark:text-slate-200'
                          }`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Application Status:
                                </span>
                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs ${
                                  applicationInfo?.status === 'Interview Scheduled'
                                    ? 'bg-indigo-600 text-white'
                                    : applicationInfo?.status === 'Shortlisted'
                                    ? 'bg-emerald-600 text-white'
                                    : applicationInfo?.status === 'Hired'
                                    ? 'bg-green-600 text-white'
                                    : applicationInfo?.status === 'Offer Extended'
                                    ? 'bg-amber-600 text-white'
                                    : applicationInfo?.status === 'Rejected'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}>
                                  {applicationInfo?.status === 'pending' || applicationInfo?.status === 'interested'
                                    ? 'Applied • Under Review'
                                    : (applicationInfo?.status || 'Applied • Under Review')}
                                </span>
                              </div>

                              {applicationInfo?.appliedAt && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Applied {formatDisplayDate(applicationInfo.appliedAt)}
                                </span>
                              )}
                            </div>

                            {/* Confirmed Interview Details (if Interview Scheduled) */}
                            {applicationInfo?.status === 'Interview Scheduled' && applicationInfo.scheduledInterview && (
                              <div className="mt-2.5 pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40 space-y-1.5 text-xs">
                                <div className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                  <Calendar size={13} />
                                  <span>Confirmed Interview Session</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                                  {applicationInfo.scheduledInterview.date && (
                                    <div>🗓 <strong>Date:</strong> {applicationInfo.scheduledInterview.date} {applicationInfo.scheduledInterview.time}</div>
                                  )}
                                  {applicationInfo.scheduledInterview.contactPerson && (
                                    <div>👤 <strong>Contact:</strong> {applicationInfo.scheduledInterview.contactPerson}</div>
                                  )}
                                  {applicationInfo.scheduledInterview.mode && (
                                    <div>💼 <strong>Mode:</strong> {applicationInfo.scheduledInterview.mode}</div>
                                  )}
                                  {applicationInfo.scheduledInterview.location && (
                                    <div>📍 <strong>Venue:</strong> {applicationInfo.scheduledInterview.location}</div>
                                  )}
                                </div>
                                {applicationInfo.scheduledInterview.link && (() => {
                                  const raw = String(applicationInfo.scheduledInterview.link).trim();
                                  const cleanDigits = raw.replace(/\D/g, '');
                                  const isPhone = cleanDigits.length >= 7 && cleanDigits.length <= 15 && !raw.includes('http') && !raw.includes('.com') && !raw.includes('/') && !raw.includes('meet');
                                  const isWeb = raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('meet.google') || raw.includes('zoom.us') || raw.includes('teams.microsoft') || raw.includes('.com') || raw.includes('.in');
                                  const targetUrl = isWeb ? (raw.startsWith('http') ? raw : `https://${raw}`) : '';
                                  const waDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

                                  return (
                                    <div className="p-2.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/40 bg-white/70 dark:bg-black/20 space-y-1.5 text-xs">
                                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                          {isPhone ? <Phone size={12} className="text-emerald-500" /> : <ExternalLink size={12} className="text-indigo-500" />}
                                          <span>{isPhone ? 'Contact Phone Number:' : isWeb ? 'Meeting Link:' : 'Details:'}</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyInterviewLink(raw)}
                                          className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer text-[10px]"
                                        >
                                          {copiedLink === raw ? <Check size={11} /> : <Copy size={11} />}
                                          <span>{copiedLink === raw ? 'Copied' : 'Copy'}</span>
                                        </button>
                                      </div>
                                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 break-all select-all">
                                        {raw}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        {isPhone && (
                                          <>
                                            <a
                                              href={`tel:${cleanDigits}`}
                                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1"
                                            >
                                              <Phone size={11} />
                                              <span>Call</span>
                                            </a>
                                            <a
                                              href={`https://wa.me/${waDigits}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-green-600 hover:bg-green-500 flex items-center gap-1"
                                            >
                                              <MessageCircle size={11} />
                                              <span>WhatsApp</span>
                                            </a>
                                          </>
                                        )}
                                        {isWeb && (
                                          <a
                                            href={targetUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1"
                                          >
                                            <ExternalLink size={11} />
                                            <span>Join Call</span>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {applicationInfo.scheduledInterview.notes && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    📝 <em>{applicationInfo.scheduledInterview.notes}</em>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Recruiter feedback notes if available */}
                            {applicationInfo?.recruiterNotes && (
                              <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 italic border-l-2 border-emerald-500 pl-2">
                                💬 Recruiter note: "{applicationInfo.recruiterNotes}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2">
                        {/* View JD Details */}
                        <button
                          type="button"
                          onClick={() => handleOpenJobModal(matchItem)}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                            isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {/* Apply / Status Button */}
                          {isApplied ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 size={13} />
                              <span>
                                {applicationInfo?.status === 'pending' || applicationInfo?.status === 'interested'
                                  ? 'Applied • Under Review'
                                  : (applicationInfo?.status || 'Applied')}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={applyingJobId === job.id}
                              onClick={() => handleApplyToJob(matchItem)}
                              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/25 active:scale-95"
                            >
                              {applyingJobId === job.id ? (
                                <span>Applying...</span>
                              ) : (
                                <>
                                  <span>Apply Now</span>
                                  <ArrowRight size={13} />
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
            <div className={`p-4 sm:p-5 rounded-2xl border ${
              isDark ? 'bg-[#101014] border-white/10' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>My Applications & Status Tracker</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {myApplicationsList.length} Total
                    </span>
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Real-time status updates from recruiters, shortlist alerts, and scheduled interview rounds.
                  </p>
                </div>

                {shortlistedCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold animate-pulse">
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
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Applications ({myApplicationsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('shortlisted')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    appliedStageFilter === 'shortlisted'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : isDark ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <Award size={13} />
                  <span>Shortlisted & Rounds ({shortlistedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('under-review')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'under-review'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Under Review ({underReviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('selected')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'selected'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Selected / Offer ({selectedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedStageFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    appliedStageFilter === 'rejected'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
              <div className="space-y-4">
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
                      className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                        isShortlisted
                          ? isDark ? 'bg-gradient-to-br from-[#12141c] to-[#0e1017] border-amber-500/40 shadow-lg shadow-amber-500/5' : 'bg-gradient-to-br from-amber-50/50 to-white border-amber-300 shadow-sm'
                          : isSelected
                          ? isDark ? 'bg-[#101814] border-emerald-500/40 shadow-lg' : 'bg-emerald-50/40 border-emerald-300 shadow-sm'
                          : isDark ? 'bg-[#101014] border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base sm:text-lg font-black tracking-tight">
                              {job.title}
                            </h4>
                            {job.jobNo && (
                              <span className="text-[10px] font-mono text-slate-400 border border-slate-300 dark:border-white/10 px-1.5 py-0.5 rounded-md">
                                #{job.jobNo}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            {job.department && (
                              <span className="flex items-center gap-1">
                                <Building2 size={12} />
                                <span>{job.department}</span>
                              </span>
                            )}
                            {job.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                <span>{job.location}</span>
                              </span>
                            )}
                            {job.jobType && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                                {job.jobType}
                              </span>
                            )}
                            {appInfo.appliedAt && (
                              <span className="text-[11px] text-slate-500">
                                Applied: {new Date(appInfo.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {matchItem && (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Sparkles size={12} />
                              <span>{matchItem.score}% Match</span>
                            </span>
                          )}

                          <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-xs'
                              : isShortlisted
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-xs animate-pulse'
                              : isRejected
                              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          }`}>
                            {isSelected ? (
                              <Award size={13} />
                            ) : isShortlisted ? (
                              <CheckCircle2 size={13} />
                            ) : isRejected ? (
                              <XCircle size={13} />
                            ) : (
                              <Clock size={13} />
                            )}
                            <span>{appInfo.status || 'Under Review'}</span>
                          </span>
                        </div>
                      </div>

                      {/* 4-Step Pipeline Visual Tracker */}
                      <div className="py-5">
                        <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                          Application Journey Tracker
                        </div>

                        {isRejected ? (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2.5">
                            <XCircle size={16} className="shrink-0" />
                            <span>This application was not selected to proceed further. Your profile remains active for other exciting matching opportunities!</span>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Track line */}
                            <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-white/10 -z-0" />
                            <div
                              className="absolute top-4 left-6 h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
                              style={{
                                width: step >= 5 ? '92%' : step >= 3 ? '66%' : step >= 2 ? '33%' : '0%'
                              }}
                            />

                            <div className="grid grid-cols-4 gap-2 relative z-10 text-center">
                              {/* Step 1: Applied */}
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 1
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/30 ring-4 ring-emerald-500/15'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                }`}>
                                  <Check size={14} />
                                </div>
                                <span className={`text-[11px] font-bold mt-2 leading-tight ${
                                  step >= 1 ? 'text-emerald-500' : 'text-slate-400'
                                }`}>
                                  1. Applied
                                </span>
                                <span className="text-[9px] text-slate-400 hidden sm:inline">Resume Submitted</span>
                              </div>

                              {/* Step 2: Under Review */}
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 2
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/30 ring-4 ring-emerald-500/15'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                }`}>
                                  {step > 2 ? <Check size={14} /> : <Eye size={13} />}
                                </div>
                                <span className={`text-[11px] font-bold mt-2 leading-tight ${
                                  step >= 2 ? 'text-emerald-500' : 'text-slate-400'
                                }`}>
                                  2. In Review
                                </span>
                                <span className="text-[9px] text-slate-400 hidden sm:inline">Recruiter Screening</span>
                              </div>

                              {/* Step 3: Shortlisted / Interview */}
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 3
                                    ? isShortlisted
                                      ? 'bg-amber-500 text-white shadow-amber-500/30 ring-4 ring-amber-500/20 animate-bounce'
                                      : 'bg-emerald-500 text-white'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                }`}>
                                  {step >= 4 ? <Check size={14} /> : <Award size={13} />}
                                </div>
                                <span className={`text-[11px] font-bold mt-2 leading-tight ${
                                  step >= 3 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'
                                }`}>
                                  3. Shortlisted
                                </span>
                                <span className="text-[9px] text-slate-400 hidden sm:inline">Rounds / Interview</span>
                              </div>

                              {/* Step 4: Decision */}
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                  step >= 5
                                    ? 'bg-emerald-600 text-white shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                }`}>
                                  <Sparkles size={13} />
                                </div>
                                <span className={`text-[11px] font-bold mt-2 leading-tight ${
                                  step >= 5 ? 'text-emerald-500 font-extrabold' : 'text-slate-400'
                                }`}>
                                  4. Offer / Hired
                                </span>
                                <span className="text-[9px] text-slate-400 hidden sm:inline">Final Decision</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scheduled Interview Action Box (if applicable) */}
                      {scheduled && (
                        <div className="mt-2 mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="text-amber-500" size={18} />
                              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                📅 Interview Scheduled — {scheduled.round || 'Candidate Interview'}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              Confirmed Session
                            </span>
                          </div>

                          {/* Key Session Details Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            {scheduled.date && (
                              <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Date</span>
                                <span className="font-bold">{scheduled.date}</span>
                              </div>
                            )}
                            {scheduled.time && (
                              <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Time</span>
                                <span className="font-bold">{scheduled.time}</span>
                              </div>
                            )}
                            {(scheduled.contactPerson || scheduled.interviewer) && (
                              <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Contact Person</span>
                                <span className="font-bold truncate block">{scheduled.contactPerson || scheduled.interviewer}</span>
                              </div>
                            )}
                            {scheduled.mode && (
                              <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Interview Mode</span>
                                <span className="font-bold">{scheduled.mode}</span>
                              </div>
                            )}
                          </div>

                          {/* Venue Location if specified */}
                          {scheduled.location && (
                            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs flex items-center gap-2">
                              <MapPin size={14} className="text-amber-500 shrink-0" />
                              <div>
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Venue / Location</span>
                                <span className="font-bold">{scheduled.location}</span>
                              </div>
                            </div>
                          )}

                          {/* Recruiter Notes / Instructions if specified */}
                          {scheduled.notes && (
                            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs">
                              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Instructions & Notes</span>
                              <p className="italic text-slate-700 dark:text-slate-300">{scheduled.notes}</p>
                            </div>
                          )}

                          {/* Contact & Meeting Details (Smartly detects Phone vs Web Video URL) */}
                          {scheduled.link && (() => {
                            const raw = String(scheduled.link).trim();
                            const cleanDigits = raw.replace(/\D/g, '');
                            const isPhoneNumber = cleanDigits.length >= 7 && cleanDigits.length <= 15 && !raw.includes('http') && !raw.includes('.com') && !raw.includes('/') && !raw.includes('meet');
                            const isWebUrl = raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('meet.google') || raw.includes('zoom.us') || raw.includes('teams.microsoft') || raw.includes('.com') || raw.includes('.in');
                            const fullUrl = isWebUrl ? (raw.startsWith('http') ? raw : `https://${raw}`) : '';
                            const waDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

                            return (
                              <div className="mt-2 p-3.5 rounded-xl border border-amber-500/30 bg-white/80 dark:bg-black/30 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                    {isPhoneNumber ? <Phone size={13} /> : <ExternalLink size={13} />}
                                    <span>{isPhoneNumber ? 'Interviewer Phone / Direct Contact' : isWebUrl ? 'Meeting URL / Platform' : 'Meeting Details'}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyInterviewLink(raw)}
                                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    {copiedLink === raw ? <Check size={12} /> : <Copy size={12} />}
                                    <span>{copiedLink === raw ? 'Copied!' : 'Copy Info'}</span>
                                  </button>
                                </div>

                                {/* Raw detail value displayed prominently */}
                                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all flex items-center justify-between gap-2">
                                  <span className="font-bold">{raw}</span>
                                </div>

                                {/* Smart Action Buttons */}
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  {isPhoneNumber && (
                                    <>
                                      <a
                                        href={`tel:${cleanDigits}`}
                                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                      >
                                        <Phone size={13} />
                                        <span>Call {cleanDigits}</span>
                                      </a>
                                      <a
                                        href={`https://wa.me/${waDigits}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-green-600 hover:bg-green-500 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                      >
                                        <MessageCircle size={13} />
                                        <span>WhatsApp Interviewer</span>
                                      </a>
                                    </>
                                  )}

                                  {isWebUrl && (
                                    <a
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                    >
                                      <ExternalLink size={14} />
                                      <span>Join Video Call</span>
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleCopyInterviewLink(raw)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                      copiedLink === raw
                                        ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                                        : 'border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                                    }`}
                                  >
                                    {copiedLink === raw ? <Check size={13} /> : <Copy size={13} />}
                                    <span>{copiedLink === raw ? 'Copied to Clipboard!' : 'Copy'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Recruiter Feedback notes (if any) */}
                      {appInfo.recruiterNotes && (
                        <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 mb-3 border border-slate-200 dark:border-white/10">
                          <span className="font-bold text-slate-800 dark:text-white block mb-0.5">Recruiter Note:</span>
                          <p>{appInfo.recruiterNotes}</p>
                        </div>
                      )}

                      {/* Bottom Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
                        <button
                          type="button"
                          onClick={() => handleOpenJobModal(matchItem || job)}
                          className={`px-3.5 py-1.5 rounded-xl font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Eye size={13} />
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
                              className={`px-3.5 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <FileText size={13} />
                              <span>View Applied Resume</span>
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

        {/* TAB 3: My Resume & Document Management */}
        {activeTab === 'resume' && (
          <div className="space-y-6">
            {/* Resume Hero & Quick Actions */}
            <div className={`p-5 sm:p-7 rounded-2xl border transition-all ${
              isDark ? 'bg-[#101014] border-white/10' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <FileText size={28} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black tracking-tight">Active Candidate Resume</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {candidate?.resumeUrl ? 'Document Connected' : 'No Resume'}
                      </span>
                    </div>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {candidate?.resumeOriginalName || 'Candidate_Resume.pdf'} • Used for AI match parsing, recruiter review, and live applications.
                    </p>
                    {candidate?.resumeUpdatedAt && (
                      <span className="text-[10px] text-slate-500 block">
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
                        className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                          isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Eye size={14} />
                        <span>Fullscreen Preview</span>
                      </button>

                      <a
                        href={candidate.resumeUrl}
                        download={candidate.resumeOriginalName || `${candidate.name || 'Candidate'}_Resume.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Download size={14} />
                        <span>Download Resume</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Upload or Replace Resume Zone */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10">
                <label className={`relative block border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  isUploadingResume
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : isDark
                    ? 'border-white/15 hover:border-emerald-500/40 hover:bg-white/5'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30'
                }`}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    disabled={isUploadingResume}
                    onChange={handleUploadNewResume}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      {isUploadingResume ? (
                        <RefreshCw size={24} className="animate-spin text-emerald-500" />
                      ) : (
                        <UploadCloud size={24} />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {isUploadingResume ? 'Uploading resume to secure S3 storage...' : 'Click to Upload or Replace Resume'}
                      </span>
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Supports PDF, DOC, DOCX up to 15MB. Updating automatically syncs with all active job applications.
                      </p>
                    </div>
                  </div>
                </label>

                {resumeUploadSuccess && (
                  <div className="mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{resumeUploadSuccess}</span>
                  </div>
                )}

                {resumeUploadError && (
                  <div className="mt-3 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{resumeUploadError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Embedded Interactive Document Viewer */}
            <div className={`p-4 sm:p-6 rounded-2xl border ${
              isDark ? 'bg-[#101014] border-white/10' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-emerald-500" />
                  <h4 className="text-sm font-bold">Interactive Resume Document Preview</h4>
                </div>
                {candidate?.resumeUrl && (
                  <a
                    href={candidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {candidate?.resumeUrl ? (
                <div className="w-full h-[650px] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-900/40 relative">
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
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 mx-auto flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
            <div className={`p-5 sm:p-7 rounded-2xl border relative overflow-hidden transition-all ${
              isDark ? 'bg-gradient-to-br from-[#121218] to-[#0c0c10] border-white/10' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-sm'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                      {editForm.name || candidate.name || 'Candidate Profile'}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Active Job Seeker
                    </span>
                  </div>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {editForm.currentTitle || 'Professional'} • {editForm.totalExperienceYears ? `${editForm.totalExperienceYears} Yrs Experience` : 'Fresh Graduate'} • 📍 {editForm.location || 'Maharashtra, India'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                      <Mail size={12} className="text-slate-400" />
                      <span>{editForm.email || candidate.email}</span>
                    </span>
                    <span className="text-slate-400 select-none">•</span>
                    <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                      <Phone size={12} className="text-slate-400" />
                      <span>{editForm.phone || candidate.phone || 'Phone not set'}</span>
                    </span>
                    {candidate.resumeFileName && (
                      <>
                        <span className="text-slate-400 select-none">•</span>
                        <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold text-[11px]">
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs'
                    }`}
                  >
                    <FileText size={14} className="text-purple-500" />
                    <span>View Resume</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Edit Candidate Profile & Skills Form */}
            <div className={`p-5 sm:p-8 rounded-2xl border transition-all ${
              isDark ? 'bg-[#101014] border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-black tracking-tight">Edit Candidate Profile & Skills</h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Update your contact info, role headline, skills, and experience. Job matching automatically updates in real time!
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {profileErrorMsg && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              {/* Section 1: Personal & Contact */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                  <User size={14} />
                  <span>Personal & Contact Info</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Name */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Phone (Password reminder) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Phone Number *
                      </label>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                        🔑 Login Password
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Current Location / City
                    </label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      placeholder="e.g. Nashik, Pune, Mumbai"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Preferred Locations */}
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Preferred Job Locations (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editForm.preferredLocations}
                      onChange={(e) => setEditForm({ ...editForm, preferredLocations: e.target.value })}
                      placeholder="e.g. Nashik, Pune, Remote, Mumbai"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Professional & Experience */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                  <Briefcase size={14} />
                  <span>Role & Experience Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Headline / Current Title */}
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Current Job Title / Professional Headline
                    </label>
                    <input
                      type="text"
                      value={editForm.currentTitle}
                      onChange={(e) => setEditForm({ ...editForm, currentTitle: e.target.value })}
                      placeholder="e.g. Full Stack Developer, Computer Engineering Graduate"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Total Experience Years */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Total Experience (Years)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.totalExperienceYears}
                      onChange={(e) => setEditForm({ ...editForm, totalExperienceYears: e.target.value })}
                      placeholder="0 for Fresher"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Notice Period */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Notice Period
                    </label>
                    <select
                      value={editForm.noticePeriod}
                      onChange={(e) => setEditForm({ ...editForm, noticePeriod: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                        isDark ? 'bg-[#151518] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
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
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Current CTC / Salary
                    </label>
                    <input
                      type="text"
                      value={editForm.currentSalary}
                      onChange={(e) => setEditForm({ ...editForm, currentSalary: e.target.value })}
                      placeholder="e.g. ₹3.5 LPA or ₹25,000 / month"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Expected CTC */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Expected CTC / Salary
                    </label>
                    <input
                      type="text"
                      value={editForm.expectedSalary}
                      onChange={(e) => setEditForm({ ...editForm, expectedSalary: e.target.value })}
                      placeholder="e.g. ₹5 LPA or ₹40,000 / month"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Key Skills (Interactive Tag Editor) */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Tag size={14} />
                    <span>Key Skills ({editForm.skills.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
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
                    className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none ${
                      isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>

                {/* Existing Skills Tags Container */}
                <div className={`p-4 rounded-xl border min-h-[90px] flex flex-wrap items-center gap-2 ${
                  isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  {editForm.skills.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No skills listed yet. Add your key skills above.</span>
                  ) : (
                    editForm.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 group"
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
              <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                  <GraduationCap size={14} />
                  <span>Education Qualification</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Highest Degree / Diploma
                    </label>
                    <input
                      type="text"
                      value={editForm.highestEducation}
                      onChange={(e) => setEditForm({ ...editForm, highestEducation: e.target.value })}
                      placeholder="e.g. BE Computers, B.Sc, Diploma IT"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      College / University
                    </label>
                    <input
                      type="text"
                      value={editForm.institution}
                      onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                      placeholder="e.g. Savitribai Phule Pune University"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Passing Year
                    </label>
                    <input
                      type="text"
                      value={editForm.graduationYear}
                      onChange={(e) => setEditForm({ ...editForm, graduationYear: e.target.value })}
                      placeholder="e.g. 2024"
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Professional Summary */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Professional Summary / Bio
                </label>
                <textarea
                  rows={3}
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                  placeholder="Briefly describe your career objectives, main technical strengths, and preferred roles..."
                  className={`w-full p-3 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
      </div>

      {/* Full Job Details Modal */}
      {selectedJobModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-hidden animate-in fade-in"
          onClick={() => {
            setSelectedJobModal(null);
            hasDismissedJobModalRef.current = true;
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`relative flex flex-col w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-2xl border shadow-2xl overflow-hidden my-auto ${
              isDark ? 'bg-[#121217] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
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
                  <div className={`flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b shrink-0 ${
                    isDark ? 'border-white/10 bg-[#121217]' : 'border-slate-200 bg-white'
                  }`}>
                    <div className="space-y-1.5 pr-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                        overallScore >= 80
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                      }`}>
                        <Sparkles size={11} />
                        <span>{overallScore}% Match • {matchGrade}</span>
                      </span>

                      <h3 className="text-lg sm:text-xl font-black leading-snug">{modalJob.title || 'Job Opening'}</h3>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {modalJob.company || 'Company'} • {modalJob.location || 'Location'} • Job Code #{modalJob.accessCode || modalJob.jobNo || 'N/A'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobModal(null);
                        hasDismissedJobModalRef.current = true;
                      }}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                        isDark ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      aria-label="Close modal"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Scrollable Body Wrapper */}
                  <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 overscroll-contain">

                  {/* Modal Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5 text-xs">
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Experience</span>
                      <span className="font-bold">{modalJob.experience || 'Not Specified'}</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Salary / CTC</span>
                      <span className="font-bold">{modalJob.salary || 'Competitive'}</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                      <span className="font-bold">{modalJob.department || 'General'}</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Type</span>
                      <span className="font-bold">{modalJob.employmentType || modalJob.jobType || 'Full-time'}</span>
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
                      <div className="space-y-1.5 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Required Skills</span>
                        <div className="flex flex-wrap gap-1.5">
                          {modalSkills.map((s: string) => {
                            const isMatched = Array.isArray(selectedJobModal.skillMatch?.matchedSkills) && selectedJobModal.skillMatch.matchedSkills.includes(s);
                            return (
                              <span
                                key={s}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 ${
                                  isMatched
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold'
                                    : isDark
                                    ? 'bg-white/5 border-white/10 text-slate-400'
                                    : 'bg-slate-100 border-slate-200 text-slate-600'
                                }`}
                              >
                                {isMatched && <Check size={12} strokeWidth={3} />}
                                <span>{s}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Full Description */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Job Description</span>
                    <div className={`p-4 rounded-xl border text-xs leading-relaxed max-h-56 overflow-y-auto whitespace-pre-line ${
                      isDark ? 'bg-black/30 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      {modalJob.description || 'No detailed description provided.'}
                    </div>
                  </div>

                  {/* Confirmed Interview or Application Status in Modal */}
                  {isModalApplied && (
                    <div className="mt-4 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Current Status:</span>
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                            {modalStatus === 'pending' || modalStatus === 'interested' ? 'Applied • Under Review' : modalStatus}
                          </span>
                        </div>
                        {modalAppInfo?.appliedAt && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Applied {formatDisplayDate(modalAppInfo.appliedAt)}
                          </span>
                        )}
                      </div>

                      {modalAppInfo?.scheduledInterview && (
                        <div className="mt-3 pt-2.5 border-t border-emerald-500/20 text-xs space-y-1.5">
                          <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <Calendar size={13} />
                            <span>Confirmed Interview Session</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
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
                              <div className="mt-2 p-3 rounded-xl border border-emerald-500/30 bg-white/70 dark:bg-black/30 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                    {isPhone ? <Phone size={13} /> : <ExternalLink size={13} />}
                                    <span>{isPhone ? 'Interviewer Phone / Direct Contact' : isWeb ? 'Meeting Link / Platform' : 'Meeting Details'}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyInterviewLink(raw)}
                                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer text-[11px]"
                                  >
                                    {copiedLink === raw ? <Check size={12} /> : <Copy size={12} />}
                                    <span>{copiedLink === raw ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                                <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 break-all select-all p-2 rounded-lg bg-black/5 dark:bg-white/5">
                                  {raw}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  {isPhone && (
                                    <>
                                      <a
                                        href={`tel:${cleanDigits}`}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1 shadow-xs"
                                      >
                                        <Phone size={12} />
                                        <span>Call {cleanDigits}</span>
                                      </a>
                                      <a
                                        href={`https://wa.me/${waDigits}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-500 flex items-center gap-1 shadow-xs"
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
                                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1 shadow-xs"
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
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                              📝 {modalAppInfo.scheduledInterview.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  </div>

                  {/* Sticky Fixed Bottom Actions Footer */}
                  <div className={`px-5 sm:px-6 py-3.5 border-t shrink-0 flex flex-wrap items-center justify-between gap-3 ${
                    isDark ? 'border-white/10 bg-[#0e0e13]' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isModalApplied ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">Status:</span>
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                            {modalStatus === 'pending' || modalStatus === 'interested' ? 'Applied • Under Review' : modalStatus}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
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
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Close
                      </button>

                      <button
                        type="button"
                        disabled={isModalApplied}
                        onClick={() => {
                          handleApplyToJob(selectedJobModal);
                          setSelectedJobModal(null);
                          hasDismissedJobModalRef.current = true;
                        }}
                        className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all ${
                          isModalApplied
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/25 active:scale-95 cursor-pointer'
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
      <nav aria-label="Candidate Navigation" className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c0c10]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 px-3 py-2 flex items-center justify-around shadow-2xl safe-area-inset-bottom">
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
    </div>
  );
};

export default CandidatePortal;
