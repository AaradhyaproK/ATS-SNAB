import React, { useState, useEffect, useMemo } from 'react';
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
  Ban
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

export interface CandidatePortalProps {
  initialTab?: 'login' | 'dashboard';
}

const CANDIDATE_SESSION_KEY = 'snab_candidate_session';

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

  // Active Tab inside Dashboard: 'matches' | 'edit-profile'
  const [activeTab, setActiveTab] = useState<'matches' | 'edit-profile'>('matches');

  // Matched Jobs State
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [searchJobQuery, setSearchJobQuery] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [matchFilter, setMatchFilter] = useState<'EligibleOnly' | 'All' | 'HighMatch' | 'LocalCity'>('EligibleOnly');
  const [selectedJobModal, setSelectedJobModal] = useState<JobMatchResult | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('snab_candidate_applied_jobs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
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
          deadlineDate: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDeadline || data.endDate || data.interviewDates || '',
          isMock: Boolean(data.isMock)
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
          isMock: Boolean(data.isMock)
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
  }, [matchedJobs, searchJobQuery, minScoreFilter, matchFilter, editForm.location, candidate?.location]);

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
    setCandidate(null);
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
  const handleApplyToJob = async (match: JobMatchResult) => {
    const jobId = match.job.id;
    if (appliedJobIds.includes(jobId) || applyingJobId === jobId) return;

    setApplyingJobId(jobId);
    try {
      const candidateEmail = (editForm.email || candidate.email || '').trim().toLowerCase();
      const candidateName = editForm.name || candidate.name || 'Job Seeker';
      const candidatePhone = editForm.phone || candidate.phone || '';

      // 1. Primary: Save to candidateApplications so it appears instantly in Candidate Responses / Hot Leads
      try {
        await addDoc(collection(db, 'candidateApplications'), {
          interviewId: jobId,
          jobId: jobId,
          jobTitle: match.job.title,
          jobAccessCode: match.job.accessCode || match.job.jobNo || '',
          candidateId: candidate.id || '',
          candidateName,
          candidateEmail,
          candidatePhone,
          recruiterUID: match.job.recruiterUID || match.job.createdBy?.uid || '',
          teamId: match.job.teamId || '',
          matchScore: match.overallScore,
          matchGrade: match.matchGrade,
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
        jobTitle: match.job.title,
        jobAccessCode: match.job.accessCode || match.job.jobNo || '',
        candidateId: candidate.id || '',
        candidateName,
        candidateEmail,
        candidatePhone,
        matchScore: match.overallScore,
        matchGrade: match.matchGrade,
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

      const updated = [...appliedJobIds, jobId];
      setAppliedJobIds(updated);
      localStorage.setItem('snab_candidate_applied_jobs', JSON.stringify(updated));

      setApplySuccessMsg(`Successfully applied to ${match.job.title}! The recruitment team has received your application.`);
      setTimeout(() => setApplySuccessMsg(null), 5000);
    } catch (err) {
      console.error('Apply error:', err);
    } finally {
      setApplyingJobId(null);
    }
  };

  // Audio Playback
  const togglePlayAudio = (match: JobMatchResult) => {
    if (playingJobId === match.job.id) {
      stopSpeech();
      setPlayingJobId(null);
      return;
    }

    stopSpeech();
    setPlayingJobId(match.job.id);
    const textToRead = `${match.job.title} at ${match.job.company}. Location: ${match.job.location}. Experience required: ${match.job.experience}. Key skills: ${(match.job.skills || []).slice(0, 5).join(', ')}. ${match.job.description.slice(0, 300)}`;

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
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Hero Candidate Profile Card */}
        <div className={`p-5 sm:p-7 rounded-2xl border relative overflow-hidden transition-all ${
          isDark ? 'bg-gradient-to-br from-[#121218] to-[#0c0c10] border-white/10' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
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

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-3">
              <div className={`p-3 sm:p-4 rounded-xl border text-center min-w-[100px] ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}>
                <span className="block text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {matchedJobs.length}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Matched Jobs
                </span>
              </div>

              <div className={`p-3 sm:p-4 rounded-xl border text-center min-w-[100px] ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}>
                <span className="block text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
                  {matchedJobs.length > 0 ? `${matchedJobs[0].overallScore}%` : '0%'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Top Match
                </span>
              </div>
            </div>
          </div>
        </div>

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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'matches'
                ? isDark
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'bg-emerald-600 text-white shadow-sm'
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

          <button
            type="button"
            onClick={() => setActiveTab('edit-profile')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'edit-profile'
                ? isDark
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'bg-emerald-600 text-white shadow-sm'
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
                  const isApplied = appliedJobIds.includes(job.id);
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
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2">
                        {/* Audio Narration Toggle */}
                        <button
                          type="button"
                          onClick={() => togglePlayAudio(matchItem)}
                          className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isPlaying
                              ? 'bg-purple-600 text-white border-purple-600'
                              : isDark
                              ? 'border-white/10 hover:bg-white/5 text-slate-300'
                              : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                          title={isPlaying ? 'Stop Audio' : 'Listen to Job Narration'}
                        >
                          {isPlaying ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          <span className="hidden sm:inline">{isPlaying ? 'Stop' : 'Audio JD'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {/* View JD Details */}
                          <button
                            type="button"
                            onClick={() => setSelectedJobModal(matchItem)}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                              isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            Details
                          </button>

                          {/* Apply Button */}
                          <button
                            type="button"
                            disabled={isApplied || applyingJobId === job.id}
                            onClick={() => handleApplyToJob(matchItem)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              isApplied
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/25 active:scale-95'
                            }`}
                          >
                            {isApplied ? (
                              <>
                                <CheckCircle2 size={13} />
                                <span>Applied</span>
                              </>
                            ) : applyingJobId === job.id ? (
                              <span>Applying...</span>
                            ) : (
                              <>
                                <span>Apply Now</span>
                                <ArrowRight size={13} />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Edit Profile & Skills */}
        {activeTab === 'edit-profile' && (
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
        )}
      </div>

      {/* Full Job Details Modal */}
      {selectedJobModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedJobModal(null)}
        >
          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 sm:p-7 shadow-2xl relative ${
              isDark ? 'bg-[#121217] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close Button */}
            <button
              onClick={() => setSelectedJobModal(null)}
              className="absolute top-5 right-5 p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Modal Header */}
            <div className="space-y-2 pr-8">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                selectedJobModal.overallScore >= 80
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
              }`}>
                <Sparkles size={11} />
                <span>{selectedJobModal.overallScore}% Match • {selectedJobModal.matchGrade}</span>
              </span>

              <h3 className="text-xl font-black">{selectedJobModal.job.title}</h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedJobModal.job.company} • {selectedJobModal.job.location} • Job Code #{selectedJobModal.job.accessCode}
              </p>
            </div>

            {/* Modal Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5 text-xs">
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Experience</span>
                <span className="font-bold">{selectedJobModal.job.experience}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Salary / CTC</span>
                <span className="font-bold">{selectedJobModal.job.salary}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                <span className="font-bold">{selectedJobModal.job.department}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Type</span>
                <span className="font-bold">{selectedJobModal.job.employmentType}</span>
              </div>
            </div>

            {/* Required Skills */}
            {(() => {
              const rawSkills = selectedJobModal.job.skills;
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
                {selectedJobModal.job.description || 'No detailed description provided.'}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedJobModal(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Close
              </button>

              <button
                type="button"
                disabled={appliedJobIds.includes(selectedJobModal.job.id)}
                onClick={() => {
                  handleApplyToJob(selectedJobModal);
                  setSelectedJobModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer ${
                  appliedJobIds.includes(selectedJobModal.job.id)
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/25 active:scale-95'
                }`}
              >
                {appliedJobIds.includes(selectedJobModal.job.id) ? 'Already Applied' : 'Apply to This Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatePortal;
