import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, onSnapshot, where, doc, updateDoc, deleteDoc, arrayUnion, getDocs } from 'firebase/firestore';

import { db } from '../services/firebase';

import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useMessageBox } from '../components/MessageBox';
import { sendInterviewInvitations } from '../services/brevoService';
import { parseCandidateDocument, parseBulkCandidateTextInput } from '../services/candidateFileParser';
import { ingestResumeFile, saveResumeDumpCandidate, checkMandatoryCriteriaMatch, EMPLOYMENT_TYPE_OPTIONS, normalizeEmploymentTypes } from '../services/resumeService';
import { EmploymentTypeMultiSelect } from '../components/EmploymentTypeMultiSelect';
import { sendInterviewWhatsAppInvite, formatPhoneForWhatsApp, buildWhatsAppInviteText, openWhatsAppWebInvite, sendBulkWhatsAppInvites } from '../services/waSenderService';
import EditJobModal from './EditJob';
import { normalizeJobData, fetchJobFetchedApiJobs, isJobStatusActive } from '../services/jobResolutionService';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';
import { useBackgroundSend } from '../context/BackgroundSendContext';
import { LocationCityInput } from '../components/LocationCityInput';
import { EducationInput } from '../components/EducationInput';
import { getJobDescriptionSnippet, FormattedJobDescription } from '../utils/jobDescriptionFormatter';
import {
  Briefcase,
  Search,
  Filter,
  UserPlus,
  Edit,
  Eye,
  X,
  Calendar,
  MapPin,
  Building,
  Copy,
  Check,
  Mail,
  Plus,
  Users,
  CheckCircle2,
  Trash2,
  Layers,
  FileText,
  DollarSign,
  Award,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Phone,
  MessageSquare,
  Clock,
  Send,
  Bell,
  User,
  Power,
  PowerOff,
  Loader2,
  Video
} from 'lucide-react';



export interface AllJobItem {
  id: string;
  title: string;
  companyName?: string;
  location?: string;
  category?: string;
  department?: string;
  employmentType?: string;
  description?: string;
  skills?: string[] | string;
  qualifications?: string;
  education?: string;
  minExperience?: number | string;
  maxExperience?: number | string;
  experience?: number | string;
  minSalary?: number | string;
  maxSalary?: number | string;
  salary?: string;
  salaryRange?: string;
  accessCode?: string;
  interviewLink?: string;
  candidateEmails?: string[];
  createdAt?: any;
  updatedAt?: any;
  deadline?: any;
  applyDeadline?: any;
  customFields?: { id?: number; key: string; value: string }[];
  genderRequirement?: string;
  strictness?: string;
  difficulty?: string;
  permission?: string;
  numQuestions?: number;
  manualQuestions?: string[];
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterUID?: string;
  jobNo?: string;
  candidateData?: any[];
  hasJobDoc?: boolean;
  hasInterviewDoc?: boolean;
  isAiVideoInterview?: boolean;
}

const parseDeadlineMillis = (deadline: any): number => {
  if (!deadline) return 0;
  if (deadline instanceof Date) return deadline.getTime();
  if (typeof deadline === 'string') {
    const dateMatch = deadline.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
    }
    const parsed = Date.parse(deadline);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof deadline?.toMillis === 'function') return deadline.toMillis();
  if (typeof deadline?.toDate === 'function') return deadline.toDate().getTime();
  if (typeof deadline?.seconds === 'number') return deadline.seconds * 1000;
  return 0;
};

const formatDate = (dateVal: any) => {
  const millis = parseDeadlineMillis(dateVal);
  if (!millis) return 'Open Application';
  return new Date(millis).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatSkillsList = (skillsRaw: string[] | string | undefined): string[] => {
  if (!skillsRaw) return [];
  if (Array.isArray(skillsRaw)) return skillsRaw.map(s => s.trim()).filter(Boolean);
  return skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
};

const formatExperienceDisplay = (exp: any): string => {
  if (exp === undefined || exp === null || exp === '') return 'Not specified';
  const str = String(exp).trim();
  if (/yrs?|years?/i.test(str)) {
    return str;
  }
  return `${str} yrs`;
};

const safeStringEdu = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) {
    return val
      .map((item: any) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        return item.degree || item.title || item.name || '';
      })
      .filter(Boolean)
      .join(', ');
  }
  if (typeof val === 'object') {
    return val.degree || val.title || val.name || '';
  }
  return String(val).trim();
};

import { calculateJobMatchScore, CandidateMatchProfile } from '../services/jobMatchService';

function getAISuggestedCandidatesForJob(job: any, candidates: any[], alreadyInvitedEmails: string[]) {
  if (!job || !candidates || candidates.length === 0) return [];

  const normalizedInvited = (alreadyInvitedEmails || []).map(e => e.toLowerCase().trim());

  return candidates
    .filter(c => {
      // Never recommend hired, blocked, or banned candidates
      if (c.isHired || c.doNotSuggest || c.isBlocked || c.isBanned) {
        return false;
      }
      const email = (c.email || '').toLowerCase().trim();
      const phone = (c.phone || '').trim();
      const pseudoEmail = phone ? `${phone.replace(/[^0-9]/g, '')}@whatsapp.local` : '';
      if ((email && normalizedInvited.includes(email)) || (pseudoEmail && normalizedInvited.includes(pseudoEmail))) {
        return false;
      }
      return true;
    })
    .map(candidate => {
      let candEdu = '';
      if (Array.isArray(candidate.education) && candidate.education.length > 0) {
        candEdu = candidate.education.map((e: any) => typeof e === 'string' ? e : e?.degree || e?.title || '').filter(Boolean).join(', ');
      }
      if (!candEdu) {
        candEdu = safeStringEdu(candidate.highestEducation || candidate.qualification || candidate.degree || candidate.education || '');
      }

      let candExp = 0;
      if (candidate.totalExperienceYears !== undefined && candidate.totalExperienceYears !== null && !isNaN(Number(candidate.totalExperienceYears))) {
        candExp = Number(candidate.totalExperienceYears);
      } else if (candidate.experienceYears !== undefined && candidate.experienceYears !== null && !isNaN(Number(candidate.experienceYears))) {
        candExp = Number(candidate.experienceYears);
      } else if (Array.isArray(candidate.experience)) {
        candExp = candidate.experience.length;
      }

      const candDomains = Array.isArray(candidate.domains) && candidate.domains.length > 0
        ? candidate.domains
        : (candidate.domain ? [candidate.domain] : []);
      const candSectors = Array.isArray(candidate.sectors) && candidate.sectors.length > 0
        ? candidate.sectors
        : (candidate.sector ? [candidate.sector] : []);
      const candDepts = Array.isArray(candidate.departments) && candidate.departments.length > 0
        ? candidate.departments
        : (candidate.department ? [candidate.department] : []);

      const candidateProfile: CandidateMatchProfile = {
        name: candidate.name || 'Candidate',
        email: candidate.email || '',
        phone: candidate.phone || '',
        location: candidate.location || candidate.city || '',
        gender: candidate.gender || candidate.genderRequirement || '',
        experience: String(candExp),
        totalExperienceYears: candExp,
        education: candEdu,
        highestEducation: candEdu,
        skills: Array.isArray(candidate.skills) ? candidate.skills : (candidate.skills ? String(candidate.skills).split(',').map((s: string) => s.trim()) : []),
        domains: candDomains,
        domain: candidate.domain || candDomains.join(', '),
        sectors: candSectors,
        sector: candidate.sector || candSectors[0] || '',
        departments: candDepts,
        department: candidate.department || candDepts[0] || '',
        preferredDomains: candDomains,
        preferredLocations: candidate.location ? [candidate.location] : []
      };

    const parseExpMinMax = (data: any) => {
      let minExperience: number | undefined = undefined;
      let maxExperience: number | undefined = undefined;
      let experience = '';

      if (data.minExperience !== undefined && data.minExperience !== null && !isNaN(Number(data.minExperience))) {
        minExperience = Number(data.minExperience);
      }
      if (data.maxExperience !== undefined && data.maxExperience !== null && !isNaN(Number(data.maxExperience))) {
        maxExperience = Number(data.maxExperience);
      }

      const expStr = typeof data.experience === 'string' ? data.experience : (typeof data.experienceYears === 'string' ? data.experienceYears : '');
      if (expStr) {
        experience = expStr;
        const matches = expStr.match(/(\d+)(?:\s*-\s*(\d+))?/);
        if (matches) {
          if (minExperience === undefined) minExperience = parseInt(matches[1], 10);
          if (maxExperience === undefined && matches[2]) maxExperience = parseInt(matches[2], 10);
        }
      }

      return { minExperience: minExperience ?? 0, maxExperience, experience: experience || `${minExperience ?? 0} Yrs` };
    };

    const parsedExp = parseExpMinMax(job);
    const normalizedJob = {
      ...job,
      minExperience: parsedExp.minExperience,
      maxExperience: parsedExp.maxExperience,
      experience: parsedExp.experience,
      qualification: job.qualification || job.education || job.qualifications || 'Diploma / Graduate',
      education: job.education || job.qualification || job.qualifications || 'Diploma / Graduate',
      genderRequirement: job.genderRequirement || job.gender || job.genderPreference || 'Any',
      gender: job.gender || job.genderRequirement || 'Any',
      department: job.department || job.roleCategory || job.category || 'General',
      departments: job.departments || [job.department || job.roleCategory || job.category || 'General'],
      location: job.location || (job.city && job.state ? `${job.city}, ${job.state}` : job.city || 'Nashik, Maharashtra'),
      city: job.city || job.location || 'Nashik',
    };

    const matchResult = calculateJobMatchScore(normalizedJob, candidateProfile);

    // Exact matching criteria as AI Job Recommendations on Public Upload & Resume Dump:
    // eduMatch.isMatch && expMatch.isMatch && genderMatch.isMatch && overallScore > 0
    if (!matchResult.eduMatch.isMatch || !matchResult.expMatch.isMatch || !matchResult.genderMatch.isMatch || matchResult.overallScore <= 0) {
      return null;
    }

    return {
      id: candidate.id,
      name: candidate.name || 'Candidate',
      email: candidate.email || (candidate.phone ? `${candidate.phone.replace(/[^0-9]/g, '')}@whatsapp.local` : ''),
      phone: candidate.phone || 'N/A',
      experience: candExp > 0 ? `${candExp} yrs` : 'Fresher',
      skills: candidate.skills || [],
      matchScore: matchResult.overallScore,
      matchGrade: matchResult.matchGrade,
      matchResult
    };
  })
  .filter((c): c is NonNullable<typeof c> => c !== null)
  .sort((a, b) => b.matchScore - a.matchScore);
}

const RecruiterAllJobs: React.FC = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const messageBox = useMessageBox();
  const { startBackgroundSend } = useBackgroundSend();

  const [jobs, setJobs] = useState<AllJobItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expired'>('All');

  // Modals
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [invitingJob, setInvitingJob] = useState<AllJobItem | null>(null);
  const [togglingJobId, setTogglingJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Invite candidate state
  const [inviteMode, setInviteMode] = useState<'bulk' | 'invited' | 'ai_suggest'>('ai_suggest');
  const [candidateEmailsInput, setCandidateEmailsInput] = useState('');
  const [inviteEmailsList, setInviteEmailsList] = useState<string[]>([]);
  const [parsedCandidates, setParsedCandidates] = useState<{ email: string; phone: string; name?: string; experience?: string }[]>([]);
  const [currentSingleName, setCurrentSingleName] = useState('');
  const [currentSingleEmail, setCurrentSingleEmail] = useState('');
  const [currentSinglePhone, setCurrentSinglePhone] = useState('');
  const [currentSingleExp, setCurrentSingleExp] = useState('');
  const [currentSingleLocation, setCurrentSingleLocation] = useState('');
  const [currentSingleEducation, setCurrentSingleEducation] = useState('B.Tech / B.E. (Bachelor of Engineering / Technology)');
  const [currentSingleEmploymentTypes, setCurrentSingleEmploymentTypes] = useState<string[]>(['Full-time — Work from Office / On-site']);

  // AI Candidate Suggestions State
  const [dumpCandidates, setDumpCandidates] = useState<any[]>([]);
  const [loadingDumpCandidates, setLoadingDumpCandidates] = useState(false);


  const [sendingInvites, setSendingInvites] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [parsingDoc, setParsingDoc] = useState(false);

  // Edit Candidate State inside Invite Modal
  const [editingCandidateEmail, setEditingCandidateEmail] = useState<string | null>(null);
  const [editedNameValue, setEditedNameValue] = useState('');
  const [editedEmailValue, setEditedEmailValue] = useState('');
  const [editedPhoneValue, setEditedPhoneValue] = useState('');
  const [savingCandidateEdit, setSavingCandidateEdit] = useState(false);

  // AI Single Candidate Resume Upload State
  const [selectedResumeFile, setSelectedResumeFile] = useState<File | null>(null);
  const [resumeExtraText, setResumeExtraText] = useState('');
  const [analyzingResumeAI, setAnalyzingResumeAI] = useState(false);

  // Delivery Channels State
  const [sendEmailChannel, setSendEmailChannel] = useState<boolean>(true);
  const [sendWhatsAppChannel, setSendWhatsAppChannel] = useState<boolean>(true);
  const [waMinDelay, setWaMinDelay] = useState<number | string>(15);
  const [waMaxDelay, setWaMaxDelay] = useState<number | string>(25);
  const [waDelayUnit, setWaDelayUnit] = useState<'sec' | 'min'>('sec');
  const [sendingProgressMsg, setSendingProgressMsg] = useState('');

  // Reminder States
  const [remindingCandidateEmail, setRemindingCandidateEmail] = useState<string | null>(null);
  const [remindingWhatsAppEmail, setRemindingWhatsAppEmail] = useState<string | null>(null);

  // Roster Bulk Reminder States
  const [bulkSendingRoster, setBulkSendingRoster] = useState(false);
  const [showRosterWaDelayModal, setShowRosterWaDelayModal] = useState(false);
  const [rosterWaTarget, setRosterWaTarget] = useState<'whatsapp' | 'both'>('whatsapp');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Always enforce Day Mode for the Recruiter section
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      // restore dark mode if system/user preferences were dark when leaving
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        root.classList.add('dark');
      }
    };
  }, []);

  // AI Video Interview state - persist user choice across sessions and jobs
  const [isAiVideoInterview, setIsAiVideoInterview] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('recruiter_pref_ai_video');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (invitingJob) {
      let isChecked = true;
      try {
        const jobStored = localStorage.getItem(`job_ai_video_${invitingJob.id}`);
        if (jobStored !== null) {
          isChecked = jobStored === 'true';
        } else if ((invitingJob as any).isAiVideoInterview !== undefined) {
          isChecked = Boolean((invitingJob as any).isAiVideoInterview);
        } else {
          const globalPref = localStorage.getItem('recruiter_pref_ai_video');
          isChecked = globalPref !== null ? globalPref === 'true' : true;
        }
      } catch {
        isChecked = true;
      }
      setIsAiVideoInterview(isChecked);
      setInviteMode(isChecked ? 'ai_suggest' : 'bulk');
    }
  }, [invitingJob]);

  const handleToggleAiVideo = (checked: boolean) => {
    setIsAiVideoInterview(checked);
    try {
      localStorage.setItem('recruiter_pref_ai_video', String(checked));
      if (invitingJob?.id) {
        localStorage.setItem(`job_ai_video_${invitingJob.id}`, String(checked));
        updateDoc(doc(db, 'interviews', invitingJob.id), { isAiVideoInterview: checked }).catch(() => {});
      }
    } catch (err) {
      console.warn('Could not persist ai video interview preference:', err);
    }
    if (checked) {
      setInviteMode('ai_suggest');
    }
  };

  const handleToggleSuggestedCandidate = (cand: any) => {
    const targetEmail = (cand.email || '').trim().toLowerCase();
    if (!targetEmail) return;
    const isAdded = inviteEmailsList.some(e => e.toLowerCase() === targetEmail);
    if (isAdded) {
      setInviteEmailsList(prev => prev.filter(e => e.toLowerCase() !== targetEmail));
      setParsedCandidates(prev => prev.filter(c => c.email.toLowerCase() !== targetEmail));
    } else {
      setInviteEmailsList(prev => [...prev, targetEmail]);
      setParsedCandidates(prev => [
        ...prev.filter(c => c.email.toLowerCase() !== targetEmail),
        {
          email: targetEmail,
          phone: cand.phone || 'N/A',
          name: cand.name || targetEmail.split('@')[0],
          experience: cand.experience,
          matchScore: `${cand.matchScore}%`
        }
      ]);
    }
  };

  const handleSelectAllSuggestedCandidates = () => {
    if (!aiSuggestedCandidates || aiSuggestedCandidates.length === 0) return;
    const allEmailsToAdd: string[] = [];
    const allParsedToAdd: any[] = [];
    aiSuggestedCandidates.forEach(cand => {
      const emailNorm = (cand.email || '').trim().toLowerCase();
      if (emailNorm) {
        allEmailsToAdd.push(emailNorm);
        allParsedToAdd.push({
          email: emailNorm,
          phone: cand.phone || 'N/A',
          name: cand.name || emailNorm.split('@')[0],
          experience: cand.experience,
          matchScore: `${cand.matchScore}%`
        });
      }
    });
    setInviteEmailsList(prev => Array.from(new Set([...prev, ...allEmailsToAdd])));
    setParsedCandidates(prev => {
      const existing = prev.filter(p => !allEmailsToAdd.some(e => e.toLowerCase() === p.email.toLowerCase()));
      return [...existing, ...allParsedToAdd];
    });
    messageBox.showSuccess(`Selected all ${allEmailsToAdd.length} AI suggested candidate(s) from Resume Dump!`);
  };

  const handleClearSuggestedCandidates = () => {
    const suggestedEmails = aiSuggestedCandidates.map(c => c.email?.trim().toLowerCase()).filter(Boolean);
    setInviteEmailsList(prev => prev.filter(e => !suggestedEmails.includes(e.toLowerCase())));
    setParsedCandidates(prev => prev.filter(c => !suggestedEmails.includes(c.email.toLowerCase())));
    messageBox.showInfo("Cleared AI suggested candidates from invite list.");
  };

  const handleEditCandidate = async (oldEmail: string, newEmail: string, newPhone: string, newName?: string) => {
    if (!invitingJob || !user) return;
    const targetEmail = (newEmail || oldEmail).trim().toLowerCase();
    const targetPhone = (newPhone || '').trim();
    const targetName = (newName !== undefined ? newName : '').trim();

    if (!targetEmail) {
      messageBox.showError("Candidate email address cannot be empty.");
      return;
    }

    setSavingCandidateEdit(true);
    try {
      const currentEmails = invitingJob.candidateEmails || [];
      const updatedEmails = currentEmails.map((e: string) =>
        e.toLowerCase() === oldEmail.toLowerCase() ? targetEmail : e
      );

      const currentCandData = (invitingJob as any).candidateData || [];
      const index = currentCandData.findIndex(
        (c: any) => c.email && c.email.toLowerCase() === oldEmail.toLowerCase()
      );

      let updatedCandData = [...currentCandData];
      if (index > -1) {
        updatedCandData[index] = {
          ...updatedCandData[index],
          email: targetEmail,
          name: targetName || updatedCandData[index].name || targetEmail.split('@')[0] || 'Candidate',
          phone: targetPhone || 'N/A'
        };
      } else {
        updatedCandData.push({
          email: targetEmail,
          phone: targetPhone || 'N/A',
          name: targetName || targetEmail.split('@')[0] || 'Candidate'
        });
      }

      const updatePayload = {
        candidateEmails: updatedEmails,
        candidateData: updatedCandData,
        updatedAt: new Date()
      };

      await Promise.all([
        updateDoc(doc(db, 'interviews', invitingJob.id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'jobs', invitingJob.id), updatePayload).catch(() => {})
      ]);

      setInvitingJob(prev => prev ? {
        ...prev,
        candidateEmails: updatedEmails,
        candidateData: updatedCandData
      } as any : null);

      messageBox.showSuccess(`✅ Candidate contact details updated successfully!`);
      setEditingCandidateEmail(null);
      setEditedEmailValue('');
      setEditedPhoneValue('');
    } catch (err: any) {
      console.error("Error updating candidate:", err);
      messageBox.showError("Failed to update candidate contact details.");
    } finally {
      setSavingCandidateEdit(false);
    }
  };


  const handleSendEmailReminder = async (candidateEmail: string) => {
    if (!invitingJob) return;
    const isVideo = isAiVideoInterview || Boolean((invitingJob as any).isAiVideoInterview);
    const targetLink = isVideo
      ? `${window.location.origin}/interview/video/${invitingJob.id}`
      : ((invitingJob.interviewLink && !invitingJob.interviewLink.includes('/interview/'))
          ? invitingJob.interviewLink
          : `${window.location.origin}/candidate?job=${invitingJob.id}`);
    
    setRemindingCandidateEmail(candidateEmail);
    try {
      const candData = (invitingJob as any).candidateData || [];
      const match = candData.find((c: any) => c.email && c.email.toLowerCase() === candidateEmail.toLowerCase());
      const res = await sendInterviewInvitations(
        [{ email: candidateEmail, name: match?.name || '' }],
        invitingJob.title,
        targetLink,
        invitingJob.accessCode || '',
        true, // isReminder = true
        {
          location: invitingJob.location,
          qualification: invitingJob.qualifications || invitingJob.education,
          experience: ((invitingJob as any).maxExperience > (invitingJob as any).minExperience)
            ? `${(invitingJob as any).minExperience} - ${(invitingJob as any).maxExperience} Years`
            : invitingJob.experience,
          minExperience: (invitingJob as any).minExperience,
          maxExperience: (invitingJob as any).maxExperience,
          gender: (invitingJob as any).gender || (invitingJob as any).genderRequirement,
          salary: invitingJob.salary || invitingJob.salaryRange,
          salaryRange: invitingJob.salaryRange || invitingJob.salary,
          deadline: invitingJob.deadline || (invitingJob as any).interviewDeadline || (invitingJob as any).applyDeadline || (invitingJob as any).endDate || (invitingJob as any).interviewDates || '',
          employmentType: (invitingJob as any).employmentType,
          customFields: (invitingJob as any).customFields,
          recruiterName: userProfile?.name || userProfile?.fullname || userProfile?.displayName || (user as any)?.displayName || 'Hiring Team',
          recruiterPhone: userProfile?.phone || userProfile?.phoneNumber || userProfile?.contactNumber || (user as any)?.phoneNumber || '9762588623 / 8484888632'
        }
      );

      if (res.success) {
        messageBox.showSuccess(`✅ Email reminder sent to ${candidateEmail}!`);
      } else {
        messageBox.showError(`Failed to send email reminder: ${res.error}`);
      }
    } catch (err) {
      console.error("Email reminder error", err);
      messageBox.showError("Failed to send email reminder.");
    } finally {
      setRemindingCandidateEmail(null);
    }
  };

  const handleSendWhatsAppReminder = async (candidateEmail: string, candidatePhone?: string) => {
    if (!invitingJob) return;

    const candData = ((invitingJob as any).candidateData || []).find(
      (c: any) => c.email && c.email.toLowerCase() === candidateEmail.toLowerCase()
    );
    const rawPhone = candidatePhone || candData?.phone || parsedCandidates.find(c => c.email.toLowerCase() === candidateEmail.toLowerCase())?.phone || '';
    const formattedPhone = formatPhoneForWhatsApp(rawPhone);

    const recruiterName = userProfile?.name || userProfile?.displayName || userProfile?.fullName || (user as any)?.displayName || user?.email?.split('@')[0] || 'Recruiter';
    const recruiterPhone = userProfile?.phone || userProfile?.phoneNumber || userProfile?.contactNumber || userProfile?.mobile || userProfile?.mobileNumber || userProfile?.whatsappPhone || (user as any)?.phoneNumber || '';

    const inviteOptions = {
      location: invitingJob.location,
      qualification: invitingJob.qualifications || invitingJob.education,
      experience: invitingJob.experience,
      salary: invitingJob.salary || invitingJob.salaryRange,
      recruiterName,
      recruiterPhone,
      whatsappSessionId: userProfile?.whatsappSessionId || '',
      whatsappSessionPasscode: userProfile?.whatsappSessionPasscode || ''
    };

    const targetCandidateName = candData?.name && candData.name.trim() !== '' ? candData.name.trim() : (candidateEmail.split('@')[0] || 'Candidate');

    const isVideo = isAiVideoInterview || Boolean((invitingJob as any).isAiVideoInterview);
    let targetLink = isVideo
      ? `${window.location.origin}/interview/video/${invitingJob.id}`
      : ((invitingJob.interviewLink && !invitingJob.interviewLink.includes('/interview/'))
          ? invitingJob.interviewLink
          : `${window.location.origin}/candidate?job=${invitingJob.id}`);

    if (candidateEmail && !targetLink.includes('email=')) {
      const sep = targetLink.includes('?') ? '&' : '?';
      targetLink = `${targetLink}${sep}email=${encodeURIComponent(candidateEmail)}&name=${encodeURIComponent(targetCandidateName)}`;
    }

    const messageText = buildWhatsAppInviteText({
      candidateName: targetCandidateName,
      jobTitle: invitingJob.title,
      interviewLink: targetLink,
      accessCode: invitingJob.accessCode || '',
      isReminder: true,
      options: inviteOptions
    });

    if (!formattedPhone) {
      messageBox.showError(`Phone number missing for ${candidateEmail}. Please enter mobile number to send WhatsApp reminder.`);
      return;
    }

    setRemindingWhatsAppEmail(candidateEmail);
    try {
      const res = await sendInterviewWhatsAppInvite({
        phone: formattedPhone,
        candidateName: targetCandidateName,
        jobTitle: invitingJob.title,
        interviewLink: targetLink,
        accessCode: invitingJob.accessCode || '',
        isReminder: true,
        options: inviteOptions
      });


      if (res.success) {
        messageBox.showSuccess(`✅ WhatsApp reminder sent to ${formattedPhone}!`);
      } else {
        messageBox.showInfo(`Opening WhatsApp Web for ${formattedPhone}...`);
        openWhatsAppWebInvite(formattedPhone, messageText);
      }
    } catch (err) {
      console.error("WhatsApp reminder error", err);
      openWhatsAppWebInvite(formattedPhone, messageText);
    } finally {
      setRemindingWhatsAppEmail(null);
    }
  };
  const handleSendRosterBulkEmailReminders = async () => {
    if (!invitingJob || !invitingJob.candidateEmails || invitingJob.candidateEmails.length === 0) return;
    const isVideo = isAiVideoInterview || Boolean((invitingJob as any).isAiVideoInterview);
    const targetLink = isVideo
      ? `${window.location.origin}/interview/video/${invitingJob.id}`
      : ((invitingJob.interviewLink && !invitingJob.interviewLink.includes('/interview/'))
          ? invitingJob.interviewLink
          : `${window.location.origin}/candidate?job=${invitingJob.id}`);
    const candidatesPayload = invitingJob.candidateEmails.map((email: string) => ({ email }));

    startBackgroundSend({
      candidates: candidatesPayload,
      jobTitle: invitingJob.title,
      interviewLink: targetLink,
      accessCode: invitingJob.accessCode || '',
      isReminder: true,
      sendEmailChannel: true,
      sendWhatsAppChannel: false,
      options: {
        location: invitingJob.location,
        qualification: invitingJob.qualifications || invitingJob.education,
        experience: ((invitingJob as any).maxExperience > (invitingJob as any).minExperience)
          ? `${(invitingJob as any).minExperience} - ${(invitingJob as any).maxExperience} Years`
          : invitingJob.experience,
        minExperience: (invitingJob as any).minExperience,
        maxExperience: (invitingJob as any).maxExperience,
        gender: (invitingJob as any).gender || (invitingJob as any).genderRequirement,
        salary: invitingJob.salary || invitingJob.salaryRange,
        salaryRange: invitingJob.salaryRange || invitingJob.salary,
        deadline: invitingJob.deadline || (invitingJob as any).interviewDeadline || (invitingJob as any).applyDeadline || (invitingJob as any).endDate || (invitingJob as any).interviewDates || '',
        recruiterName: userProfile?.name || userProfile?.fullname || userProfile?.displayName || (user as any)?.displayName || 'Hiring Team',
        recruiterPhone: userProfile?.phone || userProfile?.phoneNumber || userProfile?.contactNumber || (user as any)?.phoneNumber || ''
      }
    });

    messageBox.showSuccess(`🚀 Background Email reminders started for ${candidatesPayload.length} candidate(s)! You can freely navigate to any page.`);
  };

  const executeSendRosterBulkWhatsAppReminders = async (minDelay = 15, maxDelay = 25, delayUnit: 'sec' | 'min' = 'sec') => {
    if (!invitingJob || !invitingJob.candidateEmails || invitingJob.candidateEmails.length === 0) return;

    const candData = (invitingJob as any).candidateData || [];
    const candidatesWithPhones = invitingJob.candidateEmails.map((email: string) => {
      const match = candData.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
      return { email, phone: match?.phone, name: match?.name || email.split('@')[0] };
    }).filter((c: any) => c.phone && c.phone !== 'N/A');

    if (candidatesWithPhones.length === 0) {
      messageBox.showInfo("No candidate phone numbers found in roster for WhatsApp reminders.");
      return;
    }

    const isVideo = isAiVideoInterview || Boolean((invitingJob as any).isAiVideoInterview);
    const targetLink = isVideo
      ? `${window.location.origin}/interview/video/${invitingJob.id}`
      : ((invitingJob.interviewLink && !invitingJob.interviewLink.includes('/interview/'))
          ? invitingJob.interviewLink
          : `${window.location.origin}/candidate?job=${invitingJob.id}`);

    startBackgroundSend({
      candidates: candidatesWithPhones,
      jobTitle: invitingJob.title,
      interviewLink: targetLink,
      accessCode: invitingJob.accessCode || '',
      isReminder: true,
      sendEmailChannel: false,
      sendWhatsAppChannel: true,
      waMinDelay: Number(minDelay) || 15,
      waMaxDelay: Number(maxDelay) || 25,
      waDelayUnit: delayUnit,
      options: {
        location: invitingJob.location,
        qualification: invitingJob.qualifications || invitingJob.education,
        experience: invitingJob.experience,
        salary: invitingJob.salary || invitingJob.salaryRange,
        deadline: invitingJob.deadline || (invitingJob as any).interviewDeadline || (invitingJob as any).applyDeadline || (invitingJob as any).endDate || (invitingJob as any).interviewDates || '',
        recruiterName: userProfile?.name || userProfile?.displayName || userProfile?.fullName || 'Recruiter',
        recruiterPhone: userProfile?.phone || userProfile?.phoneNumber || userProfile?.contactNumber || '',
        whatsappSessionId: userProfile?.whatsappSessionId,
        whatsappSessionPasscode: userProfile?.whatsappSessionPasscode
      }
    });

    messageBox.showSuccess(`🚀 Background WhatsApp reminders started for ${candidatesWithPhones.length} candidate(s)! You can freely navigate to any page.`);
  };

  const executeSendRosterBulkBothReminders = async (minDelay = 15, maxDelay = 25, delayUnit: 'sec' | 'min' = 'sec') => {
    if (!invitingJob || !invitingJob.candidateEmails || invitingJob.candidateEmails.length === 0) return;
    const candData = (invitingJob as any).candidateData || [];
    const candidatesPayload = invitingJob.candidateEmails.map((email: string) => {
      const match = candData.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
      return { email, phone: match?.phone, name: match?.name || email.split('@')[0] };
    });

    const isVideo = isAiVideoInterview || Boolean((invitingJob as any).isAiVideoInterview);
    const targetLink = isVideo
      ? `${window.location.origin}/interview/video/${invitingJob.id}`
      : ((invitingJob.interviewLink && !invitingJob.interviewLink.includes('/interview/'))
          ? invitingJob.interviewLink
          : `${window.location.origin}/candidate?job=${invitingJob.id}`);

    startBackgroundSend({
      candidates: candidatesPayload,
      jobTitle: invitingJob.title,
      interviewLink: targetLink,
      accessCode: invitingJob.accessCode || '',
      isReminder: true,
      sendEmailChannel: true,
      sendWhatsAppChannel: true,
      waMinDelay: Number(minDelay) || 15,
      waMaxDelay: Number(maxDelay) || 25,
      waDelayUnit: delayUnit,
      options: {
        location: invitingJob.location,
        qualification: invitingJob.qualifications || invitingJob.education,
        experience: invitingJob.experience,
        salary: invitingJob.salary || invitingJob.salaryRange,
        deadline: invitingJob.deadline || (invitingJob as any).interviewDeadline || (invitingJob as any).applyDeadline || (invitingJob as any).endDate || (invitingJob as any).interviewDates || '',
        recruiterName: userProfile?.name || userProfile?.displayName || userProfile?.fullName || 'Recruiter',
        recruiterPhone: userProfile?.phone || userProfile?.phoneNumber || userProfile?.contactNumber || '',
        whatsappSessionId: userProfile?.whatsappSessionId,
        whatsappSessionPasscode: userProfile?.whatsappSessionPasscode
      }
    });

    messageBox.showSuccess(`🚀 Background reminders (Email + WhatsApp) started for ${candidatesPayload.length} candidate(s)! You can freely navigate to any page.`);
  };


  useEffect(() => {
    if (!invitingJob || !user) return;
    setLoadingDumpCandidates(true);
    const q = query(collection(db, 'resumeDumpCandidates'));

    getDocs(q).then((snap) => {
      const list = snap.docs.map(snapshotDoc => {
        const data = snapshotDoc.data();
        const prof = (data.profile && typeof data.profile === 'object') ? data.profile : {};
        const name = data.name || prof.name || '';
        const email = data.email || prof.email || '';
        const phone = data.phone || prof.phone || '';
        const location = data.location || data.city || prof.location || prof.city || '';
        const gender = data.gender || prof.gender || '';
        const totalExperienceYears = data.totalExperienceYears !== undefined && data.totalExperienceYears !== null
          ? data.totalExperienceYears
          : (prof.totalExperienceYears !== undefined && prof.totalExperienceYears !== null
            ? prof.totalExperienceYears
            : (data.experienceYears ?? prof.experienceYears ?? 0));
        const skills = Array.isArray(data.skills) && data.skills.length > 0
          ? data.skills
          : (Array.isArray(prof.skills) ? prof.skills : []);
        const education = Array.isArray(data.education) && data.education.length > 0
          ? data.education
          : (Array.isArray(prof.education) ? prof.education : (data.education ? [{ degree: String(data.education) }] : (prof.education ? [{ degree: String(prof.education) }] : [])));
        const domains = Array.isArray(data.domains) && data.domains.length > 0
          ? data.domains
          : (Array.isArray(prof.domains) ? prof.domains : (data.domain ? [data.domain] : (prof.domain ? [prof.domain] : [])));
        const sectors = Array.isArray(data.sectors) && data.sectors.length > 0
          ? data.sectors
          : (Array.isArray(prof.sectors) ? prof.sectors : (data.sector ? [data.sector] : (prof.sector ? [prof.sector] : [])));
        const departments = Array.isArray(data.departments) && data.departments.length > 0
          ? data.departments
          : (Array.isArray(prof.departments) ? prof.departments : (data.department ? [data.department] : (prof.department ? [prof.department] : [])));

        return {
          ...prof,
          ...data,
          id: snapshotDoc.id,
          name,
          email,
          phone,
          location,
          city: location,
          gender,
          totalExperienceYears,
          experienceYears: totalExperienceYears,
          skills,
          education,
          domains,
          domain: data.domain || prof.domain || domains.join(', '),
          sectors,
          sector: data.sector || prof.sector || sectors[0] || '',
          departments,
          department: data.department || prof.department || departments[0] || '',
          resumeUrl: data.resumeUrl || prof.resumeUrl || '',
          resumeFileName: data.resumeFileName || prof.resumeFileName || data.fileName || 'resume',
          resumeText: data.resumeText || prof.resumeText || '',
          summary: data.summary || prof.summary || '',
          currentTitle: data.currentTitle || prof.currentTitle || data.sourceJobTitle || '',
        };
      });
      setDumpCandidates(list);
    }).catch((err) => {
      console.error("Error fetching dump candidates for suggestions:", err);
    }).finally(() => {
      setLoadingDumpCandidates(false);
    });
  }, [invitingJob, user, userProfile]);

  const aiSuggestedCandidates = useMemo(() => {
    if (!invitingJob) return [];
    const alreadyInvited = invitingJob.candidateEmails || [];
    return getAISuggestedCandidatesForJob(invitingJob, dumpCandidates, alreadyInvited);
  }, [invitingJob, dumpCandidates]);

  const userUid = user?.uid;
  const userRole = userProfile?.role;
  const userTeamId = userProfile?.teamId;
  const userParentRecruiterId = userProfile?.parentRecruiterId;
  const userPrimaryRecruiterUID = (userProfile as any)?.primaryRecruiterUID;
  const primaryUid = userParentRecruiterId || userPrimaryRecruiterUID || userTeamId || userUid || '';

  useEffect(() => {
    if (!userUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const isAdmin = userRole === 'admin';

    let fetchedTeamJobs: any[] = [];
    let fetchedPrimaryJobs: any[] = [];
    let fetchedUserJobs: any[] = [];
    let fetchedParentJobs: any[] = [];

    let fetchedTeamInterviews: any[] = [];
    let fetchedPrimaryInterviews: any[] = [];
    let fetchedUserInterviews: any[] = [];
    let fetchedParentInterviews: any[] = [];

    let fetchedApiJobs: any[] = [];
    let hasReceivedFirestoreData = false;

    const mergeAndSetJobs = () => {
      const jobMap = new Map<string, AllJobItem>();

      const rawJobsMap = new Map<string, any>();
      fetchedTeamJobs.forEach((d) => rawJobsMap.set(d.id, d));
      fetchedPrimaryJobs.forEach((d) => rawJobsMap.set(d.id, d));
      fetchedUserJobs.forEach((d) => rawJobsMap.set(d.id, d));
      fetchedParentJobs.forEach((d) => rawJobsMap.set(d.id, d));
      const jobsList = Array.from(rawJobsMap.values());

      const rawInterviewsMap = new Map<string, any>();
      fetchedTeamInterviews.forEach((d) => rawInterviewsMap.set(d.id, d));
      fetchedPrimaryInterviews.forEach((d) => rawInterviewsMap.set(d.id, d));
      fetchedUserInterviews.forEach((d) => rawInterviewsMap.set(d.id, d));
      fetchedParentInterviews.forEach((d) => rawInterviewsMap.set(d.id, d));
      const interviewsList = Array.from(rawInterviewsMap.values());

      jobsList.forEach((j) => {
        const norm = normalizeJobData(j.id, j, 'jobs') || j;
        jobMap.set(j.id, {
          id: j.id,
          title: norm.title || 'Untitled Role',
          companyName: norm.companyName || norm.company || userProfile?.company || '',
          company: norm.company || norm.companyName || userProfile?.company || '',
          location: norm.location || 'Remote',
          city: norm.city || '',
          industryName: norm.industryName || '',
          sector: norm.sector || '',
          roleName: norm.roleName || '',
          category: norm.category || 'General',
          department: norm.department || 'General',
          employmentType: norm.employmentType || 'Full-time',
          description: norm.description || '',
          skills: norm.skills || [],
          qualifications: norm.qualifications || '',
          education: norm.education || '',
          minExperience: norm.minExperience ?? 0,
          maxExperience: norm.maxExperience ?? 0,
          experience: norm.experience || '0 - 2 Years',
          salary: norm.salary || '',
          salaryRange: norm.salaryRange || '',
          accessCode: norm.accessCode || (norm.jobNo ? String(norm.jobNo) : ''),
          jobNo: norm.jobNo ? String(norm.jobNo) : '',
          interviewLink: (norm.interviewLink && !norm.interviewLink.includes('/interview/'))
            ? norm.interviewLink
            : `${window.location.origin}/candidate?job=${j.id}`,
          candidateEmails: j.candidateEmails || [],
          candidateData: j.candidateData || [],
          createdAt: j.createdAt || j.postedAt || j.updatedAt,
          deadline: j.deadlineDate || j.applyDeadline || j.deadline,
          deadlineDate: j.deadlineDate || j.applyDeadline || j.deadline,
          customFields: j.customFields || [],
          genderRequirement: norm.genderRequirement || 'Any',
          strictness: j.strictness || 'Low',
          difficulty: j.difficulty || 'Easy',
          permission: j.interviewPermission || j.permission || 'anyone',
          numQuestions: j.numQuestions || 5,
          manualQuestions: j.manualQuestions || [],
          recruiterName: norm.recruiterName || j.recruiterName || '',
          recruiterEmail: j.recruiterEmail || '',
          recruiterUID: norm.recruiterUID || j.recruiterUID,
          entryBy: norm.entryBy || j.entryBy || '',
          status: norm.status || 'Active',
          hasJobDoc: true,
          hasInterviewDoc: false,
        });
      });

      interviewsList.forEach((i) => {
        const existing = jobMap.get(i.id);
        const title = i.title ? i.title.replace(/\s+Interview$/i, '').trim() : 'Untitled Role';
        jobMap.set(i.id, {
          id: i.id,
          title: title || existing?.title || 'Untitled Role',
          companyName: i.companyName || i.company || existing?.companyName || existing?.company || userProfile?.company || '',
          location: i.location || i.city || existing?.location || 'Remote',
          category: i.department || existing?.category || 'General',
          department: i.department || existing?.department,
          employmentType: i.employmentType || existing?.employmentType || 'Full-time',
          description: i.description || existing?.description || '',
          skills: i.skills || existing?.skills || [],
          qualifications: safeStringEdu(i.education || existing?.qualifications || ''),
          education: safeStringEdu(i.education || existing?.education || ''),
          minExperience: i.minExperience ?? existing?.minExperience ?? 0,
          maxExperience: i.maxExperience ?? existing?.maxExperience ?? 0,
          experience: i.experience ?? existing?.experience ?? 0,
          salary: i.salaryRange || i.salary || existing?.salary || '',
          salaryRange: i.salaryRange || i.salary || existing?.salaryRange || '',
          accessCode: i.accessCode || existing?.accessCode || (i.jobNo ? String(i.jobNo) : ''),
          jobNo: i.jobNo ? String(i.jobNo) : (existing?.jobNo || ''),
          interviewLink: (i.interviewLink && !i.interviewLink.includes('/interview/'))
            ? i.interviewLink
            : (existing?.interviewLink && !existing.interviewLink.includes('/interview/'))
              ? existing.interviewLink
              : `${window.location.origin}/candidate?job=${i.id}`,
          candidateEmails: i.candidateEmails || existing?.candidateEmails || [],
          candidateData: i.candidateData || existing?.candidateData || [],

          createdAt: existing?.createdAt || i.createdAt || i.updatedAt,
          deadline: existing?.deadlineDate || existing?.deadline || i.deadlineDate || i.deadline || i.applyDeadline,
          deadlineDate: existing?.deadlineDate || existing?.deadline || i.deadlineDate || i.deadline || i.applyDeadline,
          customFields: i.customFields || existing?.customFields || [],
          genderRequirement: i.genderRequirement || i.gender || existing?.genderRequirement || 'Any',
          strictness: i.strictness || existing?.strictness || 'Low',
          difficulty: i.difficulty || existing?.difficulty || 'Easy',
          permission: i.interviewPermission || i.permission || existing?.permission || 'anyone',
          numQuestions: i.numQuestions || existing?.numQuestions || 5,
          manualQuestions: i.manualQuestions || existing?.manualQuestions || [],
          recruiterName: i.recruiterName || existing?.recruiterName || '',
          recruiterEmail: i.recruiterEmail || existing?.recruiterEmail || '',
          recruiterUID: i.recruiterUID || existing?.recruiterUID,
          status: i.status || existing?.status || 'Active',
          hasJobDoc: existing?.hasJobDoc || false,
          hasInterviewDoc: true,
        });
      });

      fetchedApiJobs.forEach((i: any) => {
        const existing = jobMap.get(i.id);
        jobMap.set(i.id, {
          id: i.id,
          accessCode: i.accessCode || i.jobNo || existing?.accessCode || i.id.slice(0, 6).toUpperCase(),
          jobNo: i.jobNo || existing?.jobNo,
          title: i.title || existing?.title || 'Untitled Role',
          department: i.department || i.roleCategory || i.category || existing?.department || 'General',
          category: i.category || i.department || i.roleCategory || existing?.category || 'General',
          description: i.description || existing?.description || '',
          experience: i.experience || existing?.experience || 'Freshers & Experienced',
          minExperience: i.minExperience ?? existing?.minExperience ?? 0,
          maxExperience: i.maxExperience ?? existing?.maxExperience ?? 0,
          qualifications: safeStringEdu(i.qualifications || i.education || existing?.qualifications || ''),
          skills: Array.isArray(i.skills) ? i.skills : (i.skills ? String(i.skills).split(',').map((s: string) => s.trim()) : existing?.skills || []),
          salary: i.salaryRange || i.salary || existing?.salary || 'Competitive Salary',
          employmentType: i.employmentType || existing?.employmentType || 'Full-time',
          location: i.location || existing?.location || 'Nashik, Maharashtra',
          city: i.city || existing?.city || 'Nashik',
          companyName: i.companyName || i.company || existing?.companyName || existing?.company || 'Company',
          createdAt: i.createdAt || existing?.createdAt,
          deadline: existing?.deadline || existing?.deadlineDate || i.deadline || i.deadlineDate || i.applyDeadline || '',
          deadlineDate: existing?.deadlineDate || existing?.deadline || i.deadlineDate || i.deadline || i.applyDeadline || '',
          applyDeadline: existing?.applyDeadline || existing?.deadline || i.applyDeadline || i.deadline || '',
          status: i.status || existing?.status || 'Active',
          customFields: i.customFields || existing?.customFields || [],
          genderRequirement: i.genderRequirement || i.gender || existing?.genderRequirement || 'Any',
          strictness: i.strictness || existing?.strictness || 'Low',
          difficulty: i.difficulty || existing?.difficulty || 'Easy',
          permission: i.interviewPermission || i.permission || existing?.permission || 'anyone',
          numQuestions: i.numQuestions || existing?.numQuestions || 5,
          manualQuestions: i.manualQuestions || existing?.manualQuestions || [],
          recruiterName: i.recruiterName || existing?.recruiterName || '',
          recruiterEmail: i.recruiterEmail || existing?.recruiterEmail || '',
          recruiterUID: i.recruiterUID || existing?.recruiterUID || 'pbbMTYxPDaf7jhc9uPEZ34CcWfz2',
          hasJobDoc: existing?.hasJobDoc || false,
          hasInterviewDoc: true,
        });
      });

      const mergedList = Array.from(jobMap.values()).sort((a, b) => {
        const timeA = parseDeadlineMillis(a.createdAt);
        const timeB = parseDeadlineMillis(b.createdAt);
        return timeB - timeA;
      });

      setJobs(mergedList);
      setLoading(false);
    };

    fetchJobFetchedApiJobs(primaryUid || userUid || 'pbbMTYxPDaf7jhc9uPEZ34CcWfz2').then((apiJobs) => {
      fetchedApiJobs = apiJobs;
      if (hasReceivedFirestoreData || apiJobs.length > 0) {
        mergeAndSetJobs();
      }
    }).catch((err) => {
      console.warn("Failed to fetch jobs from JobFetched REST API:", err);
    });

    const unsubs: (() => void)[] = [];

    if (isAdmin) {
      const unsubJobs = onSnapshot(query(collection(db, 'jobs')), (snap) => {
        hasReceivedFirestoreData = true;
        fetchedPrimaryJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeAndSetJobs();
      }, (err) => {
        console.error("Error fetching jobs", err);
        setLoading(false);
      });
      unsubs.push(unsubJobs);

      const unsubInterviews = onSnapshot(query(collection(db, 'interviews')), (snap) => {
        hasReceivedFirestoreData = true;
        fetchedPrimaryInterviews = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d: any) => d.isMock !== true);
        mergeAndSetJobs();
      }, (err) => {
        console.error("Error fetching interviews", err);
        setLoading(false);
      });
      unsubs.push(unsubInterviews);
    } else {
      if (primaryUid) {
        // 1. Team jobs (teamId == primaryUid)
        const unsubTeamJobs = onSnapshot(query(collection(db, 'jobs'), where('teamId', '==', primaryUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedTeamJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          mergeAndSetJobs();
        }, (err) => {
          console.error("Error fetching team jobs", err);
        });
        unsubs.push(unsubTeamJobs);

        // 2. Primary recruiter's direct jobs (recruiterUID == primaryUid)
        const unsubPrimaryJobs = onSnapshot(query(collection(db, 'jobs'), where('recruiterUID', '==', primaryUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedPrimaryJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          mergeAndSetJobs();
        }, (err) => {
          console.error("Error fetching primary jobs", err);
        });
        unsubs.push(unsubPrimaryJobs);

        // 3. Parent recruiter jobs (parentRecruiterId == primaryUid)
        const unsubParentJobs = onSnapshot(query(collection(db, 'jobs'), where('parentRecruiterId', '==', primaryUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedParentJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          mergeAndSetJobs();
        }, () => {});
        unsubs.push(unsubParentJobs);

        // 4. Team interviews (teamId == primaryUid)
        const unsubTeamInterviews = onSnapshot(query(collection(db, 'interviews'), where('teamId', '==', primaryUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedTeamInterviews = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.isMock !== true);
          mergeAndSetJobs();
        }, (err) => {
          console.error("Error fetching team interviews", err);
        });
        unsubs.push(unsubTeamInterviews);

        // 5. Primary recruiter's direct interviews (recruiterUID == primaryUid)
        const unsubPrimaryInterviews = onSnapshot(query(collection(db, 'interviews'), where('recruiterUID', '==', primaryUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedPrimaryInterviews = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.isMock !== true);
          mergeAndSetJobs();
        }, (err) => {
          console.error("Error fetching primary interviews", err);
        });
        unsubs.push(unsubPrimaryInterviews);

        // 6. Parent recruiter interviews (parentRecruiterId == primaryUid)
        const unsubParentInterviews = onSnapshot(query(collection(db, 'interviews'), where('parentRecruiterId', '==', primaryUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedParentInterviews = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.isMock !== true);
          mergeAndSetJobs();
        }, () => {});
        unsubs.push(unsubParentInterviews);
      }

      // If sub-recruiter (userUid !== primaryUid), also listen to jobs and interviews created by this sub-recruiter
      if (userUid && userUid !== primaryUid) {
        const unsubUserJobs = onSnapshot(query(collection(db, 'jobs'), where('recruiterUID', '==', userUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedUserJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          mergeAndSetJobs();
        }, (err) => {
          console.error("Error fetching user jobs", err);
        });
        unsubs.push(unsubUserJobs);

        const unsubUserInterviews = onSnapshot(query(collection(db, 'interviews'), where('recruiterUID', '==', userUid)), (snap) => {
          hasReceivedFirestoreData = true;
          fetchedUserInterviews = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.isMock !== true);
          mergeAndSetJobs();
        }, (err) => {
          console.error("Error fetching user interviews", err);
        });
        unsubs.push(unsubUserInterviews);
      }
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [userUid, userRole, userTeamId, userParentRecruiterId, userPrimaryRecruiterUID]);

  // Real-time tracking of candidate applications count per job
  const [appliedCountMap, setAppliedCountMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let applicationsDocs: any[] = [];
    let responsesDocs: any[] = [];

    const recomputeAppliedMap = () => {
      const map: Record<string, Set<string>> = {};

      const addCandidateToJob = (key: string | undefined | null, candidateIdentifier: string) => {
        if (!key || !candidateIdentifier) return;
        const normalizedKey = String(key).trim();
        if (!map[normalizedKey]) {
          map[normalizedKey] = new Set<string>();
        }
        map[normalizedKey].add(candidateIdentifier);
      };

      // 1. Ingest applications from candidateApplications collection
      applicationsDocs.forEach((app) => {
        const candidateId = (app.candidateEmail || app.email || app.candidatePhone || app.phone || app.id || '').toLowerCase().trim();
        if (!candidateId) return;

        if (app.interviewId) addCandidateToJob(app.interviewId, candidateId);
        if (app.jobId) addCandidateToJob(app.jobId, candidateId);
        if (app.accessCode) addCandidateToJob(app.accessCode, candidateId);
        if (app.jobNo) addCandidateToJob(String(app.jobNo), candidateId);
      });

      // 2. Ingest responses from candidateResponses collection
      responsesDocs.forEach((resp) => {
        const candidateId = (resp.candidateEmail || resp.email || resp.candidatePhone || resp.phone || resp.id || '').toLowerCase().trim();
        if (!candidateId) return;

        if (resp.interviewId) addCandidateToJob(resp.interviewId, candidateId);
        if (resp.jobId) addCandidateToJob(resp.jobId, candidateId);
        if (resp.accessCode) addCandidateToJob(resp.accessCode, candidateId);
        if (resp.jobNo) addCandidateToJob(String(resp.jobNo), candidateId);
      });

      const resultMap: Record<string, number> = {};
      Object.keys(map).forEach((k) => {
        resultMap[k] = map[k].size;
      });
      setAppliedCountMap(resultMap);
    };

    const appsQ = query(collection(db, 'candidateApplications'));
    const unsubApps = onSnapshot(appsQ, (snap) => {
      applicationsDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeAppliedMap();
    }, (err) => {
      console.warn('candidateApplications count listener error:', err);
    });

    const respQ = query(collection(db, 'candidateResponses'));
    const unsubResp = onSnapshot(respQ, (snap) => {
      responsesDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeAppliedMap();
    }, (err) => {
      console.warn('candidateResponses count listener error:', err);
    });

    return () => {
      unsubApps();
      unsubResp();
    };
  }, []);

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => {
      if (j.category) set.add(j.category);
      if (j.department) set.add(j.department);
    });
    return ['All', ...Array.from(set)];
  }, [jobs]);

  const employmentTypesList = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => {
      if (j.employmentType) set.add(j.employmentType);
    });
    return ['All', ...Array.from(set)];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const now = Date.now();
    return jobs.filter(job => {
      const search = searchQuery.toLowerCase().trim();
      const skillsStr = formatSkillsList(job.skills).join(' ').toLowerCase();
      const rawJobNo = String(job.jobNo || '').toLowerCase().trim();
      const rawAccessCode = String(job.accessCode || '').toLowerCase().trim();
      const rawId = String(job.id || '').toLowerCase().trim();
      const searchDigits = search.replace(/\D/g, '');

      const matchesJobNo = (rawJobNo && (rawJobNo.includes(search) || (searchDigits && rawJobNo.includes(searchDigits)))) ||
        (rawAccessCode && (rawAccessCode.includes(search) || (searchDigits && rawAccessCode.includes(searchDigits)))) ||
        rawId.includes(search);

      const matchesSearch = !search ||
        matchesJobNo ||
        job.title.toLowerCase().includes(search) ||
        (job.companyName && job.companyName.toLowerCase().includes(search)) ||
        (job.description && job.description.toLowerCase().includes(search)) ||
        (job.location && job.location.toLowerCase().includes(search)) ||
        (job.category && job.category.toLowerCase().includes(search)) ||
        (job.department && job.department.toLowerCase().includes(search)) ||
        (job.roleCategory && job.roleCategory.toLowerCase().includes(search)) ||
        (job.industry && job.industry.toLowerCase().includes(search)) ||
        (job.sector && job.sector.toLowerCase().includes(search)) ||
        skillsStr.includes(search);

      const matchesCategory = selectedCategory === 'All' ||
        job.category === selectedCategory ||
        job.department === selectedCategory;

      const matchesType = selectedEmploymentType === 'All' ||
        job.employmentType === selectedEmploymentType;

      const isJobActive = isJobStatusActive(job);
      const isExpired = !isJobActive;
      const matchesStatus = statusFilter === 'All' ||
        (statusFilter === 'Active' && isJobActive) ||
        (statusFilter === 'Expired' && isExpired);

      return matchesSearch && matchesCategory && matchesType && matchesStatus;
    });
  }, [jobs, searchQuery, selectedCategory, selectedEmploymentType, statusFilter]);

  const getAppliedCount = (job: AllJobItem): number => {
    const keys = [
      job.id,
      job.accessCode,
      job.jobNo ? String(job.jobNo) : null
    ].filter(Boolean) as string[];

    let maxFromMap = 0;
    for (const k of keys) {
      if (appliedCountMap[k] && appliedCountMap[k] > maxFromMap) {
        maxFromMap = appliedCountMap[k];
      }
    }

    const candData = Array.isArray((job as any).candidateData) ? (job as any).candidateData : [];
    const candDataApplied = candData.filter((c: any) =>
      c && (c.appliedAt || c.status === 'applied' || c.status === 'interested' || c.isApplicant || c.source?.includes('apply'))
    ).length;

    const directCount = Number(
      (job as any).appliedCount ||
      (job as any).applicationsCount ||
      (job as any).totalApplications ||
      (job as any).applicantsCount ||
      (Array.isArray((job as any).candidateApplications) ? (job as any).candidateApplications.length : 0) ||
      0
    );

    return Math.max(maxFromMap, candDataApplied, directCount);
  };

  const totalAppliedCount = useMemo(() => {
    return jobs.reduce((acc, j) => acc + getAppliedCount(j), 0);
  }, [jobs, appliedCountMap]);

  const canUserDeleteJob = (): boolean => {
    if (!user) return false;
    const role = (userProfile?.role || '').toLowerCase();
    if (role === 'guest') return false;
    return true;
  };

  const handleDeleteJob = (jobId: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canUserDeleteJob()) {
      messageBox.showError("You do not have permission to delete jobs.");
      return;
    }

    messageBox.showConfirm(
      `Are you sure you want to delete "${title}"? This will permanently remove the job and its interview configurations.`,
      async () => {
        setDeletingJobId(jobId);
        try {
          const targetJob = jobs.find(j => j.id === jobId);
          const codeToDelete = targetJob?.accessCode || targetJob?.jobNo || '';

          // Optimistic local state update
          setJobs(prev => prev.filter(j => j.id !== jobId));

          // 1. Delete by doc ID from both 'jobs' and 'interviews'
          await Promise.all([
            deleteDoc(doc(db, 'jobs', jobId)).catch(() => {}),
            deleteDoc(doc(db, 'interviews', jobId)).catch(() => {})
          ]);

          // 2. Cleanup matching docs by jobNo / accessCode across 'jobs' and 'interviews'
          if (codeToDelete) {
            try {
              const [jobsSnap, interviewsSnap] = await Promise.all([
                getDocs(query(collection(db, 'jobs'), where('jobNo', '==', codeToDelete))),
                getDocs(query(collection(db, 'interviews'), where('accessCode', '==', codeToDelete)))
              ]);
              await Promise.all([
                ...jobsSnap.docs.map(d => deleteDoc(doc(db, 'jobs', d.id)).catch(() => {})),
                ...interviewsSnap.docs.map(d => deleteDoc(doc(db, 'interviews', d.id)).catch(() => {}))
              ]);
            } catch (e) {
              console.warn("Secondary cleanup by code warning:", e);
            }
          }

          // 3. Sync delete with REST API
          try {
            await fetch(`/api/jobs?id=${encodeURIComponent(jobId)}`, {
              method: 'DELETE'
            });
          } catch (apiErr) {
            console.warn("API delete note:", apiErr);
          }

          messageBox.showSuccess(`Job "${title}" deleted successfully.`);
        } catch (err) {
          console.error("Failed to delete job", err);
          messageBox.showError("Failed to delete job. Please try again.");
        } finally {
          setDeletingJobId(null);
        }
      }
    );
  };

  const handleToggleJobStatus = (job: AllJobItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const currentIsActive = isJobStatusActive(job);
    const newStatus = currentIsActive ? 'Inactive' : 'Active';
    const newIsActive = !currentIsActive;
    const actionVerb = newIsActive ? 'activate' : 'deactivate';
    const actionLabel = newIsActive ? 'activated' : 'deactivated';

    messageBox.showConfirm(
      `Are you sure you want to ${actionVerb} "${job.title}"? ${
        newIsActive
          ? 'This will make the job active and visible for candidates to take interviews.'
          : 'This will deactivate the job and candidates will no longer be able to access interviews.'
      }`,
      async () => {
        setTogglingJobId(job.id);

        // 1. Optimistic UI update
        setJobs(prevJobs =>
          prevJobs.map(j => {
            if (j.id === job.id || (job.jobNo && j.jobNo === job.jobNo)) {
              return {
                ...j,
                status: newStatus,
                isActive: newIsActive
              };
            }
            return j;
          })
        );

        try {
          // 2. Sync to Firestore in both collections ('jobs' and 'interviews')
          const updateData = {
            status: newStatus,
            isActive: newIsActive,
            updatedAt: new Date().toISOString()
          };

          await Promise.all([
            updateDoc(doc(db, 'jobs', job.id), updateData).catch(() => {}),
            updateDoc(doc(db, 'interviews', job.id), updateData).catch(() => {})
          ]);

          const searchCode = job.jobNo || job.accessCode;
          if (searchCode && searchCode !== job.id) {
            try {
              const [jobsSnap, interviewsSnap] = await Promise.all([
                getDocs(query(collection(db, 'jobs'), where('jobNo', '==', searchCode))).catch(() => null),
                getDocs(query(collection(db, 'interviews'), where('accessCode', '==', searchCode))).catch(() => null)
              ]);
              const updatePromises: Promise<any>[] = [];
              if (jobsSnap) {
                jobsSnap.docs.forEach(d => {
                  if (d.id !== job.id) updatePromises.push(updateDoc(d.ref, updateData).catch(() => {}));
                });
              }
              if (interviewsSnap) {
                interviewsSnap.docs.forEach(d => {
                  if (d.id !== job.id) updatePromises.push(updateDoc(d.ref, updateData).catch(() => {}));
                });
              }
              if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
              }
            } catch (subErr) {
              console.warn('[handleToggleJobStatus] Secondary sync warning:', subErr);
            }
          }

          // 3. Make sure it also syncs with the API endpoint (/api/jobs)
          try {
            await fetch('/api/jobs', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: job.id,
                jobNo: job.jobNo || job.id,
                status: newStatus,
                isActive: newIsActive,
                action: newIsActive ? 'activate' : 'deactivate'
              })
            });
          } catch (apiErr) {
            console.warn('[handleToggleJobStatus] API sync note:', apiErr);
          }

          messageBox.showSuccess(`Job "${job.title}" has been successfully ${actionLabel}!`);
        } catch (err: any) {
          console.error('[handleToggleJobStatus] Error toggling status:', err);
          // Revert optimistic update
          setJobs(prevJobs =>
            prevJobs.map(j => {
              if (j.id === job.id || (job.jobNo && j.jobNo === job.jobNo)) {
                return {
                  ...j,
                  status: currentIsActive ? 'Active' : 'Inactive',
                  isActive: currentIsActive
                };
              }
              return j;
            })
          );
          messageBox.showError(`Failed to update job status: ${err?.message || 'Unknown error'}`);
        } finally {
          setTogglingJobId(null);
        }
      }
    );
  };

  const handleAddCandidate = () => {
    const trimmedName = currentSingleName.trim();
    const trimmedEmail = currentSingleEmail.trim().toLowerCase();
    const trimmedPhone = currentSinglePhone.trim();
    const expText = currentSingleExp.trim() ? `${currentSingleExp.trim()} yrs` : 'N/A';
    const locText = currentSingleLocation.trim() || 'N/A';

    if (!trimmedEmail && !trimmedPhone) {
      messageBox.showError("Please enter an email address or WhatsApp phone number.");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      messageBox.showError("Please enter a valid email address.");
      return;
    }

    const targetEmail = trimmedEmail || `${trimmedPhone.replace(/[^0-9]/g, '')}@whatsapp.local`;
    const candidateDisplayName = trimmedName || (trimmedEmail ? trimmedEmail.split('@')[0] : 'Candidate');

    if (!inviteEmailsList.includes(targetEmail)) {
      setInviteEmailsList(prev => [...prev, targetEmail]);
    }

    setParsedCandidates(prev => [
      ...prev.filter(c => c.email.toLowerCase() !== targetEmail.toLowerCase()),
      { email: targetEmail, phone: trimmedPhone || 'N/A', name: candidateDisplayName, experience: expText, location: locText }
    ]);

    setCurrentSingleName('');
    setCurrentSingleEmail('');
    setCurrentSinglePhone('');
    setCurrentSingleExp('');
    setCurrentSingleLocation('');
  };

  const handleRemoveEmail = (email: string) => {
    setInviteEmailsList(prev => prev.filter(e => e !== email));
  };


  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setParsingDoc(true);
    try {
      const extractedEmails: string[] = [];
      const newParsed: { email: string; phone: string; name?: string; experience?: string }[] = [];
      for (const f of Array.from(files)) {
        const file = f as File;
        const candidates = await parseCandidateDocument(file);
        candidates.forEach(c => {
          const email = (c.email || '').toLowerCase().trim();
          const phone = (c.phone || '').trim();
          const name = c.name || 'Candidate';
          const targetEmail = email || (phone ? `${phone.replace(/[^0-9]/g, '')}@whatsapp.local` : '');
          if (targetEmail) {
            if (!extractedEmails.includes(targetEmail)) {
              extractedEmails.push(targetEmail);
            }
            newParsed.push({ email: targetEmail, phone: phone || 'N/A', name, experience: 'N/A' });
          }
        });
      }
      if (extractedEmails.length > 0) {
        setInviteEmailsList(prev => Array.from(new Set([...prev, ...extractedEmails])));
        setParsedCandidates(prev => [...prev, ...newParsed]);
        messageBox.showSuccess(`Extracted ${extractedEmails.length} candidate contact(s) from uploaded document(s).`);
      } else {
        messageBox.showInfo("No valid candidate contacts found in the document.");
      }
    } catch (err) {
      console.error("Document parse error", err);
      messageBox.showError("Failed to parse candidate document.");
    } finally {
      setParsingDoc(false);
      e.target.value = '';
    }
  };

  // AI Resume Analysis + Extra Text + Save to Resume Dump Handler
  const handleAnalyzeAndSaveResumeCandidate = async () => {
    if (!selectedResumeFile || !user) {
      messageBox.showError("Please select a candidate resume file first.");
      return;
    }
    if (!invitingJob) return;

    if (!currentSingleLocation.trim()) {
      messageBox.showError("Candidate Location / City is mandatory for proper filtering. Please enter or select a city.");
      return;
    }

    if (!currentSingleExp.trim()) {
      messageBox.showError("Candidate Experience in Years is mandatory for proper filtering. Please enter experience.");
      return;
    }

    if (!currentSingleEducation.trim()) {
      messageBox.showError("Highest Education Qualification is mandatory for proper filtering. Please select candidate education.");
      return;
    }

    const parsedExpNum = parseFloat(currentSingleExp.trim());
    if (isNaN(parsedExpNum)) {
      messageBox.showError("Please enter a valid numeric experience in years (e.g. 1.5 or 3).");
      return;
    }

    setAnalyzingResumeAI(true);
    try {
      // 1. Parse resume file + analyze with AI
      const { profile, resumeText, resumeUrl } = await ingestResumeFile(
        selectedResumeFile,
        {},
        '',
        resumeExtraText
      );

      // Mandatory overrides for location and experience
      profile.location = currentSingleLocation.trim();
      profile.totalExperienceYears = parsedExpNum;
      profile.employmentTypes = currentSingleEmploymentTypes;
      profile.employmentType = currentSingleEmploymentTypes.join(', ');
      if (currentSingleEducation.trim()) {
        const selectedDegree = currentSingleEducation.trim();
        const existingEdu = profile.education || [];
        profile.education = [
          { degree: selectedDegree, institution: 'Verified Qualification', year: '' },
          ...existingEdu.filter(e => e.degree.toLowerCase() !== selectedDegree.toLowerCase())
        ];
      }

      // 2. Save full candidate record into Resume Dump
      await saveResumeDumpCandidate({
        recruiterUID: user.uid,
        teamId: userProfile?.teamId || userProfile?.parentRecruiterId || user.uid,
        createdBy: {
          uid: user.uid,
          name: userProfile?.name || user?.displayName || 'Recruiter',
          email: user.email || '',
          role: userProfile?.role || 'recruiter',
        },
        profile,
        resumeText,
        resumeUrl,
        fileName: selectedResumeFile.name,
        mimeType: selectedResumeFile.type,
        fileSize: selectedResumeFile.size,
        additionalText: resumeExtraText.trim(),
        source: 'interview_creation',
        sourceInterviewId: invitingJob.id,
        sourceJobTitle: invitingJob.title,
      });

      // 3. Extract candidate contact email & phone and store in roster
      const candidateEmail = (profile.email || '').toLowerCase().trim();
      const candidatePhone = (profile.phone || '').trim();
      const candidateName = profile.name || 'Candidate';
      const candExpText = profile.totalExperienceYears !== undefined && profile.totalExperienceYears !== null
        ? `${profile.totalExperienceYears} yrs`
        : 'N/A';
      const targetEmail = candidateEmail || (candidatePhone ? `${candidatePhone.replace(/[^0-9]/g, '')}@whatsapp.local` : '');

      if (targetEmail) {
        if (!inviteEmailsList.includes(targetEmail)) {
          setInviteEmailsList(prev => [...prev, targetEmail]);
        }
        setParsedCandidates(prev => [
          ...prev.filter(c => c.email.toLowerCase() !== targetEmail.toLowerCase()),
          { email: targetEmail, phone: candidatePhone || 'N/A', name: candidateName, experience: candExpText }
        ]);

        messageBox.showSuccess(
          `✅ Candidate "${candidateName}" (${candExpText} Exp) analyzed using AI, saved to Resume Dump, and added to invite list!`
        );
      } else {
        messageBox.showSuccess(
          `✅ Candidate "${candidateName}" analyzed using AI and saved to Resume Dump!`
        );
      }

      // Reset file picker, extra text, experience & location inputs
      setSelectedResumeFile(null);
      setResumeExtraText('');
      setCurrentSingleExp('');
      setCurrentSingleLocation('');
      setCurrentSingleEmploymentTypes(['Full-time — Work from Office / On-site']);
    } catch (err: any) {
      console.error("Error analyzing candidate resume:", err);
      messageBox.showError(`AI extraction failed: ${err.message || 'Failed to analyze candidate resume.'}`);
    } finally {
      setAnalyzingResumeAI(false);
    }
  };

  const handleDeleteCandidateInvitation = async (emailToDelete: string) => {
    if (!invitingJob) return;

    const candData = ((invitingJob as any).candidateData || []).find(
      (c: any) => c.email && c.email.toLowerCase() === emailToDelete.toLowerCase()
    );
    const candidateDisplayName = candData?.name && candData.name.trim() !== '' ? candData.name : emailToDelete;

    if (!window.confirm(`Are you sure you want to delete the invitation for "${candidateDisplayName}"? This candidate will be permanently removed from the roster.`)) {
      return;
    }

    try {
      const updatedCandidateEmails = (invitingJob.candidateEmails || []).filter(
        (e) => e.toLowerCase() !== emailToDelete.toLowerCase()
      );
      const updatedCandidateData = ((invitingJob as any).candidateData || []).filter(
        (c: any) => !c.email || c.email.toLowerCase() !== emailToDelete.toLowerCase()
      );

      const updatePayload = {
        candidateEmails: updatedCandidateEmails,
        candidateData: updatedCandidateData,
        updatedAt: new Date()
      };

      await Promise.all([
        updateDoc(doc(db, 'interviews', invitingJob.id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'jobs', invitingJob.id), updatePayload).catch(() => {})
      ]);

      setInvitingJob(prev => prev ? {
        ...prev,
        candidateEmails: updatedCandidateEmails,
        candidateData: updatedCandidateData
      } as any : null);

      messageBox.showSuccess(`Deleted invitation for ${candidateDisplayName}!`);
    } catch (error) {
      console.error('Delete candidate invitation error:', error);
      messageBox.showError('Failed to delete candidate invitation.');
    }
  };

  const handleSendInvites = async (isReminder = false) => {
    if (!invitingJob) return;

    if (!sendEmailChannel && !sendWhatsAppChannel) {
      messageBox.showError("Please select at least one delivery channel (Email or WhatsApp).");
      return;
    }

    const parsedInputCandidates = parseBulkCandidateTextInput(candidateEmailsInput);
    const extraInputEmails = parsedInputCandidates.map(c => c.email.toLowerCase()).filter(Boolean);

    const finalEmails = Array.from(new Set([...inviteEmailsList, ...extraInputEmails]));

    setSendingInvites(true);
    setSendingProgressMsg(`Preparing candidate ${isReminder ? 'reminders' : 'invitations'}...`);

    try {
      if (finalEmails.length > 0) {
        const existingCandidateEmails = invitingJob.candidateEmails || [];
        const updatedCandidateEmails = Array.from(new Set([...existingCandidateEmails, ...finalEmails]));

        const candidateDataToAdd = finalEmails.map(email => {
          const parsed = parsedCandidates.find(c => c.email.toLowerCase() === email.toLowerCase()) ||
                         parsedInputCandidates.find(c => c.email.toLowerCase() === email.toLowerCase());
          return {
            email: email.toLowerCase(),
            name: parsed?.name || email.split('@')[0] || 'Candidate',
            phone: parsed?.phone || 'N/A',
            experience: (parsed as any)?.experience || 'N/A'
          };
        });

        const updatePayload = {
          isAiVideoInterview,
          candidateEmails: updatedCandidateEmails,
          candidateData: arrayUnion(...candidateDataToAdd),
          updatedAt: new Date()
        };

        await Promise.all([
          updateDoc(doc(db, 'interviews', invitingJob.id), updatePayload).catch(() => {}),
          updateDoc(doc(db, 'jobs', invitingJob.id), updatePayload).catch(() => {})
        ]);
      } else {
        const updatePayload = {
          isAiVideoInterview,
          updatedAt: new Date()
        };
        await Promise.all([
          updateDoc(doc(db, 'interviews', invitingJob.id), updatePayload).catch(() => {}),
          updateDoc(doc(db, 'jobs', invitingJob.id), updatePayload).catch(() => {})
        ]);
      }

      const targetLink = isAiVideoInterview
        ? `${window.location.origin}/interview/video/${invitingJob.id}`
        : ((invitingJob.interviewLink && !invitingJob.interviewLink.includes('/interview/'))
            ? invitingJob.interviewLink
            : `${window.location.origin}/candidate?job=${invitingJob.id}`);

      let candidatesPayload = finalEmails.map(email => {
        const parsed = parsedCandidates.find(c => c.email.toLowerCase() === email.toLowerCase()) ||
                       parsedInputCandidates.find(c => c.email.toLowerCase() === email.toLowerCase());
        return {
          email: email.toLowerCase(),
          name: parsed?.name || email.split('@')[0] || 'Candidate',
          phone: parsed?.phone || 'N/A'
        };
      });

      // Failsafe: If no new emails were typed, send to existing candidates in roster
      if (candidatesPayload.length === 0) {
        const existingCandData = (invitingJob as any).candidateData || [];
        const existingEmails = invitingJob.candidateEmails || [];
        if (existingCandData.length > 0) {
          candidatesPayload = existingCandData.map((c: any) => ({
            email: c.email,
            phone: c.phone,
            name: c.name || c.email?.split('@')[0] || 'Candidate'
          }));
        } else if (existingEmails.length > 0) {
          candidatesPayload = existingEmails.map((e: string) => ({
            email: e,
            phone: 'N/A',
            name: e.split('@')[0] || 'Candidate'
          }));
        }
      }

      if (candidatesPayload.length === 0) {
        messageBox.showError("No candidate emails found. Please enter or upload at least one candidate email.");
        return;
      }

      startBackgroundSend({
        candidates: candidatesPayload,
        jobTitle: invitingJob.title,
        interviewLink: targetLink,
        accessCode: invitingJob.accessCode || '',
        isReminder,
        sendEmailChannel,
        sendWhatsAppChannel,
        options: {
          location: invitingJob.location,
          qualification: invitingJob.qualifications || invitingJob.education,
          experience: ((invitingJob as any).maxExperience > (invitingJob as any).minExperience)
            ? `${(invitingJob as any).minExperience} - ${(invitingJob as any).maxExperience} Years`
            : invitingJob.experience,
          minExperience: (invitingJob as any).minExperience,
          maxExperience: (invitingJob as any).maxExperience,
          gender: (invitingJob as any).gender || (invitingJob as any).genderRequirement,
          salary: invitingJob.salary || invitingJob.salaryRange,
          salaryRange: invitingJob.salaryRange || invitingJob.salary,
          deadline: invitingJob.deadline || (invitingJob as any).interviewDeadline || (invitingJob as any).applyDeadline || (invitingJob as any).endDate || (invitingJob as any).interviewDates || '',
          employmentType: (invitingJob as any).employmentType,
          customFields: (invitingJob as any).customFields,
          recruiterName: userProfile?.name || userProfile?.fullname || userProfile?.displayName || user?.displayName || 'Hiring Team',
          recruiterPhone: userProfile?.phone || userProfile?.phoneNumber || userProfile?.contactNumber || user?.phoneNumber || '9762588623 / 8484888632',
          recruiterEmail: userProfile?.email || user?.email || '',
          whatsappSessionId: userProfile?.whatsappSessionId || '',
          whatsappSessionPasscode: userProfile?.whatsappSessionPasscode || ''
        },
        waMinDelay: typeof waMinDelay === 'number' ? waMinDelay : (parseInt(waMinDelay) || 15),
        waMaxDelay: typeof waMaxDelay === 'number' ? waMaxDelay : (parseInt(waMaxDelay) || 25),
        waDelayUnit
      });

      messageBox.showSuccess(`🚀 Background ${isReminder ? 'reminders' : 'sending'} started for ${candidatesPayload.length} candidate(s)! You can freely navigate to any page.`);

      setInvitingJob(null);
      setInviteEmailsList([]);
      setParsedCandidates([]);
      setCandidateEmailsInput('');
      setCurrentSingleEmail('');
    } catch (err) {
      console.error("Invite send error", err);
      messageBox.showError("Failed to send invitations. Please try again.");
    } finally {
      setSendingInvites(false);
      setSendingProgressMsg('');
    }
  };

  const handleCopyLink = (link: string) => {

    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9F5] text-[#111215] font-sans">
      {/* Top Header Section */}
      <section className="shrink-0 border-b border-[#E4E7DC] bg-white">
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D4F82C]/30 text-[#4D6500] text-[11px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8FB305] animate-pulse" />
                03 • Job Management
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/recruiter/jobs"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3 text-xs font-semibold text-[#111215] transition-colors hover:bg-[#F8F9F5] shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#575A51]" />
                <span>Dashboard</span>
              </Link>
              <h1 className="text-xl sm:text-2xl font-black text-[#111215] tracking-tight">All Job Postings</h1>
            </div>
            <p className="mt-1 text-xs text-[#575A51]">
              Manage and view all job openings, invite candidates, view detailed descriptions, and edit roles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/recruiter/interview/create"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#111215] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#202227] shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4F82C]" />
              <span>Create Job</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 5 High-Contrast Bento Stat Cards */}
      <section className="grid shrink-0 grid-cols-2 gap-3.5 sm:gap-4 px-4 pt-5 sm:px-6 lg:px-8 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Total Jobs</p>
          <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-[#111215]">{jobs.length}</p>
        </div>
        <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Active Jobs</p>
          <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-emerald-600">
            {jobs.filter(j => isJobStatusActive(j)).length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Applied Candidates</p>
          <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-[#111215]">
            {totalAppliedCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Invited Candidates</p>
          <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-[#111215]">
            {jobs.reduce((acc, j) => acc + (j.candidateEmails?.length || 0), 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Departments</p>
          <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-[#111215]">
            {categoriesList.length > 1 ? categoriesList.length - 1 : 0}
          </p>
        </div>
      </section>

      {/* Search & Filter Toolbar in Bento Card */}
      <section className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#E4E7DC] bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative w-full sm:w-auto sm:min-w-[260px] xl:max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#73766C] w-3.5 h-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jobs by Job No, title, skills, location..."
                  className="h-9 w-full rounded-full border border-[#E4E7DC] bg-[#F8F9F5] pl-9 pr-8 text-xs text-[#111215] outline-none transition-colors placeholder:text-[#73766C] focus:border-[#111215] focus:bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#73766C] hover:text-[#111215] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex rounded-full border border-[#E4E7DC] bg-[#F8F9F5] p-1">
                {(['All', 'Active', 'Expired'] as const).map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer ${
                      statusFilter === status
                        ? 'bg-[#111215] text-white shadow-xs'
                        : 'text-[#575A51] hover:text-[#111215]'
                    }`}
                  >
                    {status === 'Expired' ? 'Inactive' : status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C]">Dept</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] px-3 text-xs text-[#111215] font-medium outline-none transition-colors focus:border-[#111215] focus:bg-white cursor-pointer"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'All Departments' : cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C]">Type</span>
                <select
                  value={selectedEmploymentType}
                  onChange={(e) => setSelectedEmploymentType(e.target.value)}
                  className="h-8 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] px-3 text-xs text-[#111215] font-medium outline-none transition-colors focus:border-[#111215] focus:bg-white cursor-pointer"
                >
                  {employmentTypesList.map(type => (
                    <option key={type} value={type}>{type === 'All' ? 'All Job Types' : type}</option>
                  ))}
                </select>
              </div>

              {(searchQuery || statusFilter !== 'All' || selectedCategory !== 'All' || selectedEmploymentType !== 'All') && (
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('All'); setSelectedCategory('All'); setSelectedEmploymentType('All'); }}
                  className="inline-flex h-8 items-center justify-center rounded-full border border-[#E4E7DC] bg-white px-3 text-xs font-semibold text-[#111215] transition-colors hover:bg-[#F8F9F5] cursor-pointer shadow-2xs"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Jobs Listing Content */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-64 rounded-3xl border border-[#E4E7DC] bg-white p-5 animate-pulse flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="h-4 w-24 bg-[#F8F9F5] rounded-full mb-3" />
                  <div className="h-6 w-3/4 bg-[#F8F9F5] rounded-lg mb-2" />
                  <div className="h-3 w-1/2 bg-[#F8F9F5] rounded-full mb-4" />
                  <div className="h-12 w-full bg-[#F8F9F5] rounded-xl" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 flex-1 bg-[#F8F9F5] rounded-full" />
                  <div className="h-9 flex-1 bg-[#F8F9F5] rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex min-h-[340px] items-center justify-center rounded-3xl border border-dashed border-[#E4E7DC] bg-white p-12 text-center shadow-xs">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#575A51]">
                <Briefcase className="w-6 h-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#111215]">No jobs found matching your filters.</p>
              <p className="mt-1 text-xs text-[#73766C]">Try modifying your search query or reset the filters.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('All'); setSelectedCategory('All'); setSelectedEmploymentType('All'); }}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-[#E4E7DC] bg-white px-4 text-xs font-semibold text-[#111215] transition-colors hover:bg-[#F8F9F5] cursor-pointer shadow-2xs"
                >
                  Clear Filters
                </button>
                <Link
                  to="/recruiter/interview/create"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#111215] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#202227] shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4F82C]" />
                  <span>Create Job</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredJobs.map((job) => {
              const skillsList = formatSkillsList(job.skills);
              const isJobActive = isJobStatusActive(job);
              const isExpired = !isJobActive;
              const invitedCount = job.candidateEmails?.length || 0;
              const appliedCount = getAppliedCount(job);

              return (
                <article
                  key={job.id}
                  onClick={() => navigate(`/recruiter/interview/${job.id}/overview`)}
                  className="group rounded-3xl border border-[#E4E7DC] bg-white p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[#111215]/30 hover:shadow-lg flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Top Row: Category & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-semibold text-[#575A51] bg-[#F8F9F5] border border-[#E4E7DC] px-2.5 py-0.5 rounded-full truncate max-w-[65%]">
                        {job.category || job.department || 'General'}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleToggleJobStatus(job, e)}
                          disabled={togglingJobId === job.id}
                          title={isJobActive ? "Click to Deactivate job" : "Click to Activate job"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs transition-all duration-150 cursor-pointer ${
                            isExpired
                              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          } ${togglingJobId === job.id ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          {togglingJobId === job.id ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin text-current" />
                          ) : (
                            <span className={`h-1.5 w-1.5 rounded-full ${isJobActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                          )}
                          <span>{isJobActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Job Title & Company */}
                    <h2
                      className="text-base sm:text-lg font-bold text-[#111215] group-hover:text-black transition-colors truncate"
                      title={job.title}
                    >
                      {job.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs text-[#575A51]">
                      {job.jobNo && (
                        <span className="font-mono text-[#111215] font-bold bg-[#D4F82C] px-2 py-0.5 rounded-full text-[10px]">
                          #{job.jobNo}
                        </span>
                      )}
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-[#73766C] shrink-0" />
                        <span className="truncate">{job.location || 'Remote'}</span>
                      </span>
                      {job.employmentType && (
                        <span className="shrink-0">• {job.employmentType}</span>
                      )}
                    </div>

                    {/* Short Description */}
                    <p className="mt-2.5 text-xs text-[#575A51] line-clamp-2 leading-relaxed">
                      {getJobDescriptionSnippet(job.description, 160)}
                    </p>

                    {/* Specifications Grid */}
                    <div className="mt-3.5 pt-3 border-t border-[#E4E7DC] grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#575A51]">
                      <div className="flex items-center gap-1.5 min-w-0" title={`Experience: ${formatExperienceDisplay(job.experience)}`}>
                        <span className="text-[#73766C] shrink-0">Exp:</span>
                        <span className="text-[#111215] font-semibold truncate">{formatExperienceDisplay(job.experience)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0" title={`Salary: ${job.salary || job.salaryRange || 'Not specified'}`}>
                        <span className="text-[#73766C] shrink-0">Salary:</span>
                        <span className="text-[#111215] font-semibold truncate">{job.salary || job.salaryRange || 'Not specified'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0" title={`${appliedCount} candidate${appliedCount === 1 ? '' : 's'} applied`}>
                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-[#73766C] shrink-0">Applied:</span>
                        <span className="text-[#111215] font-semibold truncate">{appliedCount} candidate{appliedCount === 1 ? '' : 's'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0" title={`${invitedCount} candidate${invitedCount === 1 ? '' : 's'} invited`}>
                        <Send className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="text-[#73766C] shrink-0">Invited:</span>
                        <span className="text-[#111215] font-semibold truncate">{invitedCount} candidate{invitedCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    {/* Skills */}
                    {skillsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {skillsList.slice(0, 3).map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215] font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {skillsList.length > 3 && (
                          <span className="text-[11px] text-[#73766C] self-center font-medium">
                            +{skillsList.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3.5 border-t border-[#E4E7DC] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvitingJob(job);
                      }}
                      className="flex-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#111215] px-3 font-semibold text-white text-xs transition-colors hover:bg-[#202227] shadow-xs cursor-pointer"
                      title="Invite candidate"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[#D4F82C]" />
                      <span className="truncate">Invite</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/recruiter/interview/${job.id}/responses`);
                      }}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3 font-semibold text-[#111215] text-xs transition-colors hover:bg-[#F8F9F5] cursor-pointer shadow-2xs"
                      title="See candidate responses"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#575A51]" />
                      <span>Responses</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingJobId(job.id);
                      }}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3 font-semibold text-[#111215] text-xs transition-colors hover:bg-[#F8F9F5] cursor-pointer shadow-2xs"
                      title="Edit job"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#575A51]" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteJob(job.id, job.title, e)}
                      disabled={deletingJobId === job.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                      title="Delete job"
                    >
                      {deletingJobId === job.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Job Modal */}
      {editingJobId && (
        <EditJobModal
          jobId={editingJobId}
          onClose={() => setEditingJobId(null)}
        />
      )}



      {/* Invite Candidate Modal - Permanent Day Mode Bento Theme */}
      {invitingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-3xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] shadow-2xl flex flex-col overflow-hidden max-h-[92vh] font-sans">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E4E7DC] bg-white/90 px-6 py-4.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center shadow-sm shrink-0">
                  <UserPlus className="w-5 h-5 text-[#111215]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-[#111215]">
                      Invite Candidate to Job
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#111215]/5 text-[#575A51] border border-[#E4E7DC]">
                      {invitingJob.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#575A51] font-medium mt-0.5">
                    Send AI video pre-screening or standard ATS application invites with instant profile verification.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInvitingJob(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#575A51] hover:text-[#111215] hover:bg-[#E4E7DC]/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto [scrollbar-color:#c2c5ba_transparent] [scrollbar-width:thin]">
              {/* AI Video Pre-Screening Interview Checkmark / Toggle Bento Card */}
              <div className={`p-5 rounded-2xl border transition-all duration-200 ${
                isAiVideoInterview
                  ? 'border-2 border-[#D4F82C] bg-white shadow-lg shadow-[#D4F82C]/10 ring-2 ring-[#D4F82C]/30'
                  : 'border border-[#E4E7DC] bg-white'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <label className="flex items-start gap-3.5 cursor-pointer select-none flex-1">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={isAiVideoInterview}
                        onChange={(e) => handleToggleAiVideo(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-[#E4E7DC] text-[#111215] focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer accent-[#D4F82C]"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-black text-sm text-[#111215] flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                            isAiVideoInterview
                              ? 'bg-[#D4F82C] text-[#111215]'
                              : 'bg-[#111215]/5 text-[#575A51]'
                          }`}>
                            <Video className="w-4 h-4" />
                          </div>
                          <span>AI-Based Video Pre-Screening Interview</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase ${
                          isAiVideoInterview
                            ? 'bg-[#D4F82C] text-[#111215] shadow-xs'
                            : 'bg-[#111215]/5 text-[#73766C]'
                        }`}>
                          {isAiVideoInterview ? '⚡ AI Video Link Active' : 'Normal ATS Application'}
                        </span>
                      </div>
                      <p className="text-xs text-[#575A51] leading-relaxed font-medium">
                        {isAiVideoInterview
                          ? 'AI Video screening enabled. Candidates receive direct openable video interview links with auto-loaded profiles, webcam recording, and automated evaluation. Best-fit candidates from Resume Dump are suggested below.'
                          : 'Tick this checkmark to enable direct AI Video Pre-Screening interviews and automatically suggest best-fit candidates from Resume Dump. When unticked, standard ATS candidate portal links are sent.'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Direct Link Preview & Copy */}
                <div className="mt-4 pt-3.5 border-t border-[#E4E7DC] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] shrink-0">
                      {isAiVideoInterview ? 'Direct Video Link:' : 'Standard ATS Link:'}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#111215] truncate bg-[#F8F9F5] px-3 py-1.5 rounded-xl border border-[#E4E7DC] select-all">
                      {isAiVideoInterview
                        ? `${window.location.origin}/interview/video/${invitingJob.id}`
                        : `${window.location.origin}/candidate?job=${invitingJob.id}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const link = isAiVideoInterview
                        ? `${window.location.origin}/interview/video/${invitingJob.id}`
                        : `${window.location.origin}/candidate?job=${invitingJob.id}`;
                      handleCopyLink(link);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111215] text-white hover:bg-[#202227] text-xs font-bold shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4F82C]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bento Tab Selector */}
              <div className="flex items-center gap-1.5 p-1.5 bg-[#E4E7DC]/70 rounded-2xl flex-wrap">
                <button
                  type="button"
                  onClick={() => setInviteMode('ai_suggest')}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 min-w-[140px] cursor-pointer ${
                    inviteMode === 'ai_suggest'
                      ? 'bg-[#D4F82C] text-[#111215] shadow-sm ring-2 ring-[#D4F82C]/30'
                      : 'text-[#575A51] hover:text-[#111215] hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#111215]" />
                  <span>Suggest AI Candidates</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInviteMode('bulk')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[110px] cursor-pointer ${
                    inviteMode === 'bulk'
                      ? 'bg-[#111215] text-white shadow-sm'
                      : 'text-[#575A51] hover:text-[#111215] hover:bg-white/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Bulk Import</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInviteMode('invited')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[130px] cursor-pointer ${
                    inviteMode === 'invited'
                      ? 'bg-[#111215] text-white shadow-sm'
                      : 'text-[#575A51] hover:text-[#111215] hover:bg-white/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Invited Candidates ({(invitingJob.candidateEmails || []).length})</span>
                </button>
              </div>

              {inviteMode === 'bulk' && (
                <>
                  {/* Bulk Candidate Document Upload (Excel, CSV, Multiple Resumes) */}
                  <div className="p-6 bg-white border-2 border-dashed border-[#E4E7DC] rounded-2xl text-center space-y-3 shadow-sm">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#D4F82C] text-[#111215] mx-auto shadow-sm">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-black text-[#111215] block">Bulk Import Candidate Files</span>
                    <p className="text-xs text-[#575A51] max-w-sm mx-auto leading-relaxed">
                      Upload Excel (.xlsx, .xls), CSV, or multiple PDF/DOCX/TXT resumes. Auto-extracts Name, Phone Number, and Email Address.
                    </p>
                    <label className="inline-flex h-10 items-center justify-center gap-2 px-6 rounded-full bg-[#111215] text-white font-bold text-xs hover:bg-[#202227] transition-all cursor-pointer shadow-sm active:scale-95">
                      <span>{parsingDoc ? 'Parsing Document...' : 'Select File(s) (Excel / CSV / Resumes)'}</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.csv,.xlsx,.xls,.txt,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,text/csv"
                        onChange={handleDocumentUpload}
                        className="hidden"
                        disabled={parsingDoc}
                      />
                    </label>
                  </div>

                  {/* Bulk Paste Multiple Emails */}
                  <div className="p-5 bg-white border border-[#E4E7DC] rounded-2xl space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase font-bold text-[#73766C] block">
                        Paste Multiple Emails
                      </label>
                      {candidateEmailsInput.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            const extracted = candidateEmailsInput
                              .split(/[\n,;\s]+/)
                              .map(e => e.trim().toLowerCase())
                              .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
                            if (extracted.length === 0) {
                              messageBox.showError('No valid email addresses found in pasted text.');
                              return;
                            }
                            let added = 0;
                            extracted.forEach(email => {
                              if (!inviteEmailsList.includes(email)) {
                                setInviteEmailsList(prev => [...prev, email]);
                                added++;
                              }
                            });
                            setCandidateEmailsInput('');
                            messageBox.showSuccess(`Added ${added} candidate email(s) to invite list!`);
                          }}
                          className="text-xs text-[#4D6500] hover:underline font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Pasted Emails</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Enter or paste multiple candidate emails separated by comma or newline (e.g. alex@example.com, sara@company.org)..."
                      value={candidateEmailsInput}
                      onChange={(e) => setCandidateEmailsInput(e.target.value)}
                      className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] p-3 text-xs text-[#111215] outline-none focus:ring-2 focus:ring-[#8FB305] placeholder:text-[#8f8f8f]"
                    />
                  </div>

                  {/* Add Candidate Manually */}
                  <div className="p-5 bg-white border border-[#E4E7DC] rounded-2xl space-y-3 shadow-sm">
                    <label className="text-[11px] uppercase font-bold text-[#73766C] block">
                      Add Candidate Manually (Email & WhatsApp Contact)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        placeholder="Candidate Name (e.g. Rahul Sharma)"
                        value={currentSingleName}
                        onChange={(e) => setCurrentSingleName(e.target.value)}
                        className="flex-1 h-10 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3.5 text-xs text-[#111215] outline-none focus:ring-2 focus:ring-[#8FB305] placeholder:text-[#8f8f8f]"
                      />
                      <input
                        type="email"
                        placeholder="Candidate email (e.g. candidate@example.com)"
                        value={currentSingleEmail}
                        onChange={(e) => setCurrentSingleEmail(e.target.value)}
                        className="flex-1 h-10 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3.5 text-xs text-[#111215] outline-none focus:ring-2 focus:ring-[#8FB305] placeholder:text-[#8f8f8f]"
                      />
                      <input
                        type="tel"
                        placeholder="WhatsApp Phone (+91...)"
                        value={currentSinglePhone}
                        onChange={(e) => setCurrentSinglePhone(e.target.value)}
                        className="w-full sm:w-1/4 h-10 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3.5 text-xs text-[#111215] outline-none focus:ring-2 focus:ring-[#8FB305] placeholder:text-[#8f8f8f]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCandidate}
                        className="h-10 px-5 bg-[#111215] text-white hover:bg-[#202227] rounded-full font-bold text-xs transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
                      >
                        + Add Candidate
                      </button>
                    </div>
                  </div>
                </>
              )}

              {inviteMode === 'invited' && (
                <div className="p-5 bg-white border border-[#E4E7DC] rounded-2xl space-y-3.5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E4E7DC] pb-3">
                    <span className="text-xs font-black text-[#111215] uppercase tracking-wide">
                      Invited Candidates Roster ({(invitingJob.candidateEmails || []).length})
                    </span>

                    {Boolean((invitingJob.candidateEmails || []).length > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSendRosterBulkEmailReminders}
                          disabled={bulkSendingRoster}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors cursor-pointer"
                          title="Send bulk Email reminders to all candidates"
                        >
                          <Mail className="w-3.5 h-3.5 text-blue-600" />
                          <span>Email Reminders</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRosterWaTarget('whatsapp');
                            setShowRosterWaDelayModal(true);
                          }}
                          disabled={bulkSendingRoster}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 transition-colors cursor-pointer"
                          title="Configure delay & send bulk WhatsApp reminders"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp Reminders</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRosterWaTarget('both');
                            setShowRosterWaDelayModal(true);
                          }}
                          disabled={bulkSendingRoster}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition-colors cursor-pointer"
                          title="Configure delay & send BOTH Email + WhatsApp reminders"
                        >
                          <Send className="w-3.5 h-3.5 text-amber-600" />
                          <span>Both (Mail + WhatsApp)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {(!invitingJob.candidateEmails || invitingJob.candidateEmails.length === 0) ? (
                    <div className="p-8 text-center text-[#73766C] font-medium text-xs">
                      No candidates invited yet for this job.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {invitingJob.candidateEmails.map((email: string) => {
                        const isEditing = editingCandidateEmail === email;
                        const candData = ((invitingJob as any).candidateData || []).find(
                          (c: any) => c.email && c.email.toLowerCase() === email.toLowerCase()
                        );
                        const candPhone = candData?.phone && candData.phone !== 'N/A' ? candData.phone : '';
                        const isEmailSending = remindingCandidateEmail === email;
                        const isWASending = remindingWhatsAppEmail === email;

                        return (
                          <div key={email} className="bg-[#F8F9F5] border border-[#E4E7DC] rounded-2xl p-3.5 shadow-xs space-y-2">
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="text-xs text-[#4D6500] font-bold">Editing Candidate Details:</div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="text"
                                    value={editedNameValue}
                                    onChange={(e) => setEditedNameValue(e.target.value)}
                                    placeholder="Candidate Full Name"
                                    className="w-full sm:w-1/3 h-9 rounded-xl border border-[#E4E7DC] bg-white px-3 text-xs text-[#111215] outline-none"
                                    autoFocus
                                  />
                                  <input
                                    type="email"
                                    value={editedEmailValue}
                                    onChange={(e) => setEditedEmailValue(e.target.value)}
                                    placeholder="Candidate Email"
                                    className="flex-1 h-9 rounded-xl border border-[#E4E7DC] bg-white px-3 text-xs text-[#111215] outline-none"
                                  />
                                  <input
                                    type="tel"
                                    value={editedPhoneValue}
                                    onChange={(e) => setEditedPhoneValue(e.target.value)}
                                    placeholder="WhatsApp Phone (+91...)"
                                    className="w-full sm:w-1/3 h-9 rounded-xl border border-[#E4E7DC] bg-white px-3 text-xs text-[#111215] outline-none"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCandidateEmail(null);
                                      setEditedNameValue('');
                                      setEditedEmailValue('');
                                      setEditedPhoneValue('');
                                    }}
                                    disabled={savingCandidateEdit}
                                    className="h-8 px-4 rounded-full border border-[#E4E7DC] text-xs font-semibold text-[#575A51]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEditCandidate(email, editedEmailValue, editedPhoneValue, editedNameValue)}
                                    disabled={savingCandidateEdit}
                                    className="h-8 px-4 rounded-full bg-[#111215] text-white font-bold text-xs"
                                  >
                                    {savingCandidateEdit ? 'Saving...' : 'Save Changes'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#111215] truncate text-xs" title={candData?.name || email}>
                                      {candData?.name && candData.name.trim() !== '' ? candData.name : email}
                                    </span>
                                    {candData?.name && candData.name.trim() !== '' && (
                                      <span className="text-[11px] text-[#73766C] truncate font-mono">({email})</span>
                                    )}
                                  </div>
                                  {candPhone ? (
                                    <span className="text-[11px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5 font-bold">
                                      <Phone className="w-2.5 h-2.5" />
                                      {candPhone}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[#8f8f8f] italic">No WhatsApp phone attached</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCandidateEmail(email);
                                      setEditedNameValue(candData?.name || email.split('@')[0] || '');
                                      setEditedEmailValue(email);
                                      setEditedPhoneValue(candPhone);
                                    }}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[#E4E7DC] bg-white text-[#575A51] hover:text-black transition-colors cursor-pointer"
                                    title="Edit Candidate Contact Details"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSendEmailReminder(email)}
                                    disabled={isEmailSending}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-blue-500/30 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50 cursor-pointer"
                                    title="Mail Reminder"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSendWhatsAppReminder(email, candPhone)}
                                    disabled={isWASending}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
                                    title="WhatsApp Reminder"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCandidateInvitation(email)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-red-500/30 bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                                    title="Delete Invitation"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* AI Candidate Suggestions Tab Panel */}
              {inviteMode === 'ai_suggest' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between p-4 bg-white border border-[#E4E7DC] rounded-2xl flex-wrap gap-3 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2 text-[#111215] font-black text-sm">
                        <Sparkles className="w-4 h-4 text-[#8FB305]" />
                        <span>AI Candidate Recommendations ({aiSuggestedCandidates.length})</span>
                      </div>
                      <p className="text-xs text-[#575A51] mt-0.5 font-medium">
                        {isAiVideoInterview
                          ? 'Showing top matches from Resume Dump ready for AI Video Pre-Screening interview.'
                          : 'Best matched candidates from your candidate pool based on skills & job requirements.'}
                      </p>
                    </div>

                    {aiSuggestedCandidates.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSelectAllSuggestedCandidates}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D4F82C] text-[#111215] font-black text-xs hover:bg-[#c7eb22] transition-all shadow-sm shrink-0 cursor-pointer active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Select All ({aiSuggestedCandidates.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const top5 = aiSuggestedCandidates.slice(0, 5);
                            let addedCount = 0;
                            top5.forEach(cand => {
                              const targetEmail = cand.email;
                              if (targetEmail) {
                                if (!inviteEmailsList.includes(targetEmail)) {
                                  setInviteEmailsList(prev => [...prev, targetEmail]);
                                  addedCount++;
                                }
                                setParsedCandidates(prev => [
                                  ...prev.filter(c => c.email.toLowerCase() !== targetEmail.toLowerCase()),
                                  { email: targetEmail, phone: cand.phone || 'N/A', name: cand.name, experience: cand.experience, matchScore: `${cand.matchScore}%` }
                                ]);
                              }
                            });
                            messageBox.showSuccess(`Added top ${addedCount > 0 ? addedCount : Math.min(5, aiSuggestedCandidates.length)} AI candidate matches to invite list!`);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111215] text-white font-bold text-xs hover:bg-[#202227] transition-all shrink-0 cursor-pointer active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#D4F82C]" />
                          <span>+ Top 5</span>
                        </button>

                        {inviteEmailsList.some(email => aiSuggestedCandidates.some(c => c.email?.toLowerCase() === email.toLowerCase())) && (
                          <button
                            type="button"
                            onClick={handleClearSuggestedCandidates}
                            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold text-xs hover:bg-red-100 transition-all shrink-0 cursor-pointer active:scale-95"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Clear</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {loadingDumpCandidates ? (
                    <div className="py-12 text-center text-[#73766C]">
                      <Sparkles className="w-6 h-6 animate-spin mx-auto text-[#8FB305] mb-2" />
                      <p className="text-xs font-bold">Analyzing candidate profiles against job requirements...</p>
                    </div>
                  ) : aiSuggestedCandidates.length === 0 ? (
                    <div className="p-8 text-center border border-[#E4E7DC] rounded-2xl bg-white">
                      <Users className="w-10 h-10 text-[#73766C] mx-auto mb-2" />
                      <p className="text-sm font-bold text-[#111215]">No new candidate recommendations found</p>
                      <p className="text-xs text-[#73766C] mt-1 max-w-sm mx-auto">
                        All stored candidate profiles are already invited, or upload more resumes to generate matches.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 [scrollbar-color:#c2c5ba_transparent] [scrollbar-width:thin]">
                      {aiSuggestedCandidates.map((cand) => {
                        const isAdded = inviteEmailsList.some(e => e.toLowerCase() === cand.email?.toLowerCase());
                        return (
                          <div
                            key={cand.id}
                            onClick={() => handleToggleSuggestedCandidate(cand)}
                            className={`flex items-start justify-between gap-3.5 p-4 rounded-2xl transition-all cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-50/70 border-2 border-emerald-500/50 shadow-sm'
                                : 'bg-white border border-[#E4E7DC] hover:border-[#8FB305]/50'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {/* Checkbox */}
                              <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isAdded}
                                  onChange={() => handleToggleSuggestedCandidate(cand)}
                                  className="w-4.5 h-4.5 rounded-md border-[#E4E7DC] text-[#111215] focus:ring-0 cursor-pointer accent-[#D4F82C]"
                                />
                              </div>

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-[#111215] text-xs sm:text-sm truncate">{cand.name}</span>
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-black text-[10px] ${
                                    cand.matchScore >= 75
                                      ? 'border border-amber-300 bg-amber-100 text-amber-900'
                                      : cand.matchScore >= 50
                                      ? 'border border-blue-300 bg-blue-100 text-blue-900'
                                      : 'border border-[#E4E7DC] bg-[#F8F9F5] text-[#575A51]'
                                  }`}>
                                    {cand.matchScore >= 75 ? '🔥' : '⚡'} {cand.matchScore}% Match
                                  </span>
                                  {cand.experience && cand.experience !== 'N/A' && (
                                    <span className="text-[10px] text-[#575A51] bg-[#F8F9F5] border border-[#E4E7DC] px-2 py-0.5 rounded-full font-bold">
                                      {cand.experience}
                                    </span>
                                  )}
                                  {isAdded && (
                                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Selected
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-[#73766C] truncate font-mono">
                                  {cand.email} {cand.phone && cand.phone !== 'N/A' ? `· ${cand.phone}` : ''}
                                </div>

                                {cand.skills && cand.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {cand.skills.slice(0, 4).map((s: string) => (
                                      <span key={s} className="text-[10px] font-medium text-[#111215] bg-[#F8F9F5] border border-[#E4E7DC] px-2 py-0.5 rounded-md">
                                        {s}
                                      </span>
                                    ))}
                                    {cand.skills.length > 4 && (
                                      <span className="text-[10px] font-bold text-[#73766C] px-1 py-0.5">
                                        +{cand.skills.length - 4} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSuggestedCandidate(cand);
                              }}
                              className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer shadow-xs active:scale-95 ${
                                isAdded
                                  ? 'border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-[#111215] text-white hover:bg-[#202227]'
                              }`}
                            >
                              {isAdded ? '✓ Selected' : '+ Select'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Channels Bento Card */}
              <div className="p-5 bg-white border border-[#E4E7DC] rounded-2xl space-y-3 shadow-sm">
                <span className="text-[11px] uppercase font-bold text-[#73766C] block tracking-wider">
                  INVITATION DELIVERY CHANNELS:
                </span>
                <div className="flex items-center gap-5 flex-wrap text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-[#111215] font-bold">
                    <input
                      type="checkbox"
                      checked={sendEmailChannel}
                      onChange={(e) => setSendEmailChannel(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <span>Send Email Invitations</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-[#111215] font-bold">
                    <input
                      type="checkbox"
                      checked={sendWhatsAppChannel}
                      onChange={(e) => setSendWhatsAppChannel(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <span>Send WhatsApp Invitations</span>
                  </label>
                </div>

                {sendWhatsAppChannel && (
                  <div className="mt-3 pt-3 border-t border-[#E4E7DC] grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <label className="text-[11px] font-bold text-[#73766C] block mb-1">Min Delay</label>
                      <input
                        type="number"
                        min="1"
                        max="360"
                        value={waMinDelay}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWaMinDelay(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                        }}
                        placeholder="15"
                        className="w-full h-9 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3 text-xs text-[#111215] outline-none focus:ring-2 focus:ring-[#8FB305] cursor-text font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#73766C] block mb-1">Max Delay</label>
                      <input
                        type="number"
                        min="1"
                        max="360"
                        value={waMaxDelay}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWaMaxDelay(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                        }}
                        placeholder="25"
                        className="w-full h-9 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3 text-xs text-[#111215] outline-none focus:ring-2 focus:ring-[#8FB305] cursor-text font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#73766C] block mb-1">Delay Unit</label>
                      <select
                        value={waDelayUnit}
                        onChange={(e) => setWaDelayUnit(e.target.value as 'sec' | 'min')}
                        className="w-full h-9 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3 text-xs text-[#111215] outline-none focus:ring-2 focus:ring-[#8FB305] cursor-pointer font-medium"
                      >
                        <option value="sec">Seconds (sec)</option>
                        <option value="min">Minutes (min)</option>
                      </select>
                    </div>
                    <p className="sm:col-span-3 text-[11px] text-emerald-800 font-medium">
                      * Each WhatsApp message will pause for a random delay between {waMinDelay || 15} - {waMaxDelay || 25} {waDelayUnit} to protect your WhatsApp number from spam blocking.
                    </p>
                  </div>
                )}
              </div>

              {sendingProgressMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2.5 animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>{sendingProgressMsg}</span>
                </div>
              )}

              {/* Selected Candidates Roster */}
              {inviteEmailsList.length > 0 && (
                <div className="p-4 bg-white border border-[#E4E7DC] rounded-2xl space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-[#73766C] block tracking-wider">
                      Selected Candidates ({inviteEmailsList.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteEmailsList([]);
                        setParsedCandidates([]);
                        setCandidateEmailsInput('');
                        messageBox.showInfo('Cleared all candidate entries.');
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove All ({inviteEmailsList.length})</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2.5 bg-[#F8F9F5] border border-[#E4E7DC] rounded-xl">
                    {inviteEmailsList.map(email => {
                      const parsed = parsedCandidates.find(c => c.email.toLowerCase() === email.toLowerCase());
                      const phone = parsed?.phone && parsed.phone !== 'N/A' ? parsed.phone : '';
                      const candName = parsed?.name && parsed.name !== 'Candidate'
                        ? parsed.name
                        : (email.includes('@') && !email.endsWith('@whatsapp.local')
                            ? email.split('@')[0].split(/[._-]/).map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join(' ')
                            : 'Candidate');

                      return (
                        <span
                          key={email}
                          className="inline-flex flex-col items-start gap-1 px-3 py-2 rounded-xl bg-white border border-[#E4E7DC] text-[#111215] min-w-[180px] shadow-xs"
                        >
                          <div className="flex items-center gap-1.5 w-full justify-between">
                            <span className="font-bold text-xs flex items-center gap-1.5 truncate">
                              <User className="w-3 h-3 text-[#4D6500] shrink-0" />
                              {candName}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(email)}
                              className="text-[#73766C] hover:text-red-600 ml-1 cursor-pointer font-bold text-base"
                              title="Remove candidate"
                            >
                              &times;
                            </button>
                          </div>
                          {!email.endsWith('@whatsapp.local') && (
                            <span className="text-[10px] text-[#73766C] font-mono truncate max-w-[200px]">{email}</span>
                          )}
                          {phone && (
                            <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 font-bold">
                              <Phone className="w-2.5 h-2.5" />
                              {phone}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#E4E7DC] bg-white/90 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#73766C]">Access Code:</span>
                <code className="text-xs font-mono font-black text-[#111215] bg-[#F8F9F5] px-2.5 py-1 rounded-lg border border-[#E4E7DC]">
                  {invitingJob.accessCode || 'N/A'}
                </code>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setInvitingJob(null)}
                  className="h-10 px-5 border border-[#E4E7DC] text-[#575A51] hover:text-[#111215] rounded-full font-bold text-xs hover:bg-[#E4E7DC]/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleSendInvites(true)}
                  disabled={sendingInvites}
                  className="inline-flex h-10 items-center gap-1.5 px-4 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-full font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{sendingInvites ? 'Sending...' : 'Send Bulk Reminders'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendInvites(false)}
                  disabled={sendingInvites}
                  className={`inline-flex h-10 items-center gap-2 px-6 rounded-full font-black text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer shadow-lg active:scale-95 ${
                    isAiVideoInterview
                      ? 'bg-[#D4F82C] text-[#111215] hover:bg-[#c7eb22] shadow-[#D4F82C]/25 ring-2 ring-[#D4F82C]/30'
                      : 'bg-[#111215] text-white hover:bg-[#202227] shadow-black/20'
                  }`}
                >
                  {isAiVideoInterview ? (
                    <>
                      <Video className="w-4 h-4" />
                      <span>{sendingInvites ? 'Sending...' : 'Send Video Interview Invites'}</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>{sendingInvites ? 'Sending...' : 'Send ATS Invitations'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRosterWaDelayModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 text-white shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-400">
                    <i className="fab fa-whatsapp text-lg"></i>
                  </div>
                  <div>
                    <h3 className="geist-caption font-bold text-base text-white">WhatsApp Anti-Spam Delay Settings</h3>
                    <p className="geist-small text-xs text-[#8f8f8f]">Set min/max delay between candidate reminders</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRosterWaDelayModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[#8f8f8f] block mb-1 font-medium">Min Delay</label>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={waMinDelay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWaMinDelay(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                    }}
                    placeholder="15"
                    className="w-full h-9 rounded-[6px] border border-white/15 bg-white/[0.04] px-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8f8f8f] block mb-1 font-medium">Max Delay</label>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={waMaxDelay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWaMaxDelay(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                    }}
                    placeholder="25"
                    className="w-full h-9 rounded-[6px] border border-white/15 bg-white/[0.04] px-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8f8f8f] block mb-1 font-medium">Delay Unit</label>
                  <select
                    value={waDelayUnit}
                    onChange={(e) => setWaDelayUnit(e.target.value as 'sec' | 'min')}
                    className="w-full h-9 rounded-[6px] border border-white/15 bg-[#121212] px-2 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="sec">Seconds (sec)</option>
                    <option value="min">Minutes (min)</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-emerald-400 italic">
                * Each WhatsApp message will pause for a random delay between {waMinDelay || 15} - {waMaxDelay || 25} {waDelayUnit} to protect your WhatsApp number from spam blocking.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRosterWaDelayModal(false)}
                  className="geist-caption h-9 px-4 rounded-[6px] border border-white/15 bg-white/[0.04] text-xs font-medium text-[#d4d4d4] hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRosterWaDelayModal(false);
                    if (rosterWaTarget === 'whatsapp') {
                      executeSendRosterBulkWhatsAppReminders(Number(waMinDelay) || 15, Number(waMaxDelay) || 25, waDelayUnit);
                    } else {
                      executeSendRosterBulkBothReminders(Number(waMinDelay) || 15, Number(waMaxDelay) || 25, waDelayUnit);
                    }
                  }}
                  className="geist-caption h-9 px-4 rounded-[6px] border border-emerald-500 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm flex items-center gap-1.5"
                >
                  <i className="fab fa-whatsapp"></i>
                  <span>Send Reminders Now</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <WhatsAppConnectModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
    </div>
  );
};

export default RecruiterAllJobs;
