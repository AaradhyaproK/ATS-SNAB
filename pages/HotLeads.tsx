import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';
import { useTheme } from '../context/ThemeContext';
import {
  Search,
  Mail,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
  Send,
  User,
  Phone,
  Briefcase,
  CheckSquare,
  Square,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Copy,
  Check,
  ChevronDown,
  X,
  Trash2,
  FileText,
  Eye,
  Calendar,
  GraduationCap,
  MapPin,
  DollarSign,
  Tag,
  ShieldCheck,
  Sparkles,
  Award,
  Bell,
  BellOff,
} from 'lucide-react';
import {
  fetchWhatsAppStatus,
  getStoredSessionId,
  getStoredPasscode,
} from '../services/waSenderService';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';
import { isJobStatusActive } from '../services/jobResolutionService';
import { RecruiterInterviewsSkeleton } from './RecruiterInterviews';
import {
  sendAtsCandidateStatusEmail,
  sendAtsCandidateStatusWhatsApp,
} from '../services/atsNotificationService';

export const ATS_PIPELINE_STAGES = [
  { key: 'Under Review', label: 'Under Review', color: 'border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  { key: 'Shortlisted', label: 'Shortlisted', color: 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  { key: 'Interview Scheduled', label: 'Interview Scheduled', color: 'border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' },
  { key: 'Technical Round', label: 'Technical Round', color: 'border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  { key: 'HR Round', label: 'HR Round', color: 'border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400' },
  { key: 'Offer Extended', label: 'Offer Extended', color: 'border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { key: 'Hired', label: 'Hired', color: 'border-green-600/30 bg-green-50 dark:bg-green-600/10 text-green-700 dark:text-green-400' },
  { key: 'Rejected', label: 'Rejected', color: 'border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
  { key: 'On Hold', label: 'On Hold', color: 'border-gray-400/30 bg-gray-50 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300' },
];

export interface HotLeadItem {
  id: string;
  applicationDocId?: string;
  candidateId?: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  accessCode: string;
  interviewLink: string;
  deadline: string;
  isJobActive?: boolean;
  appliedAt: any;
  status: string;
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
  matchGrade?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  source?: string;
  candidateDetails?: {
    experience?: string | number;
    education?: any;
    skills?: string[];
    location?: string;
    preferredLocations?: string[];
    currentSalary?: string;
    expectedSalary?: string;
    noticePeriod?: string;
    summary?: string;
    resumeUrl?: string;
    resumeFileName?: string;
    extractedText?: string;
  };
}

export default function HotLeads() {
  const { user, userProfile } = useAuth();
  const { isDark } = useTheme();
  const messageBox = useMessageBox();

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [leads, setLeads] = useState<HotLeadItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'under_review' | 'shortlisted' | 'scheduled' | 'hired' | 'rejected'>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const jobSearchInputRef = useRef<HTMLInputElement>(null);

  // Candidate Details & Resume Modal
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<HotLeadItem | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'resume' | 'profile'>('resume');
  const [isLoadingCandidateProfile, setIsLoadingCandidateProfile] = useState(false);
  const [newStatusSelection, setNewStatusSelection] = useState<string>('Shortlisted');
  const [notifyCandidateEmail, setNotifyCandidateEmail] = useState<boolean>(true);
  const [notifyCandidateWhatsApp, setNotifyCandidateWhatsApp] = useState<boolean>(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [scheduleContactPerson, setScheduleContactPerson] = useState<string>('');
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('11:00');
  const [scheduleMode, setScheduleMode] = useState<string>('Google Meet');
  const [scheduleLocation, setScheduleLocation] = useState<string>('');
  const [scheduleLink, setScheduleLink] = useState<string>('');
  const [scheduleNotes, setScheduleNotes] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Status Change Confirmation Popup
  const [statusChangePrompt, setStatusChangePrompt] = useState<{
    lead: HotLeadItem;
    targetStatus: string;
    previousStatus: string;
  } | null>(null);
  const [notifyMode, setNotifyMode] = useState<'both' | 'whatsapp' | 'email' | 'none'>('both');
  const [statusPromptNotes, setStatusPromptNotes] = useState<string>('');
  const [statusPromptDate, setStatusPromptDate] = useState<string>('');
  const [statusPromptTime, setStatusPromptTime] = useState<string>('11:00');
  const [statusPromptMode, setStatusPromptMode] = useState<string>('Google Meet');
  const [statusPromptLink, setStatusPromptLink] = useState<string>('');

  const userUid = user?.uid;
  const userTeamId = userProfile?.teamId;
  const userParentRecruiterId = userProfile?.parentRecruiterId;
  const isAdmin = userProfile?.role === 'admin';

  // Deleted Leads Tracking
  const [deletedLeadKeys, setDeletedLeadKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`ix_deleted_leads_${user?.uid || 'default'}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const deletedLeadKeysRef = useRef(deletedLeadKeys);
  deletedLeadKeysRef.current = deletedLeadKeys;

  const saveDeletedKeys = (newKeys: Set<string>) => {
    setDeletedLeadKeys(newKeys);
    deletedLeadKeysRef.current = newKeys;
    try {
      localStorage.setItem(`ix_deleted_leads_${user?.uid || 'default'}`, JSON.stringify(Array.from(newKeys)));
    } catch (e) {
      console.warn('Failed to save deleted leads to localStorage:', e);
    }
  };

  const [isDeletingLeads, setIsDeletingLeads] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  // ── 1. Fetch Recruiter Jobs & Candidate Applications ──
  useEffect(() => {
    if (!userUid) return;
    setLoading(true);

    const primaryUid = userParentRecruiterId || (userProfile as any)?.primaryRecruiterUID || userTeamId || userUid || '';

    let jobsList: any[] = [];
    let applicationsList: any[] = [];

    const mergeAllData = () => {
      const jobMap = new Map<string, any>();
      jobsList.forEach((j) => jobMap.set(j.id, j));

      const leadsMap = new Map<string, HotLeadItem>();

      // 1. Ingest all from candidateApplications collection
      applicationsList.forEach((app) => {
        const jobId = app.interviewId || app.jobId;
        const job = jobMap.get(jobId);
        const email = (app.candidateEmail || app.email || '').toLowerCase().trim();
        if (!email) return;

        const uniqueKey = `${email}_${jobId}`;
        const deadline = job?.deadline || job?.deadlineDate || '';
        const appStatus = app.status || 'Under Review';

        leadsMap.set(uniqueKey, {
          id: uniqueKey,
          applicationDocId: app.id,
          candidateId: app.candidateId,
          candidateName: app.candidateName || app.name || email.split('@')[0],
          candidateEmail: email,
          candidatePhone: app.candidatePhone || app.phone || '',
          jobId: jobId || '',
          jobTitle: app.jobTitle || job?.title || 'General Role',
          companyName: job?.companyName || job?.company || userProfile?.company || 'Company',
          accessCode: job?.accessCode || job?.jobNo || '',
          interviewLink: (job?.interviewLink && !job.interviewLink.includes('/#/interview/'))
            ? job.interviewLink
            : `${window.location.origin}/#/candidate?job=${jobId}`,
          deadline,
          isJobActive: job ? isJobStatusActive(job) : true,
          appliedAt: app.appliedAt || app.createdAt,
          status: appStatus,
          statusUpdatedAt: app.statusUpdatedAt,
          scheduledInterview: app.scheduledInterview,
          recruiterNotes: app.recruiterNotes,
          matchScore: app.matchScore,
          matchGrade: app.matchGrade,
          resumeUrl: app.resumeUrl || '',
          source: app.source || 'Candidate Application',
        });
      });

      // 2. Ingest from candidateData and candidateEmails on jobs
      jobsList.forEach((job) => {
        const deadline = job.deadline || job.deadlineDate || '';
        const candidateDataArr = Array.isArray(job.candidateData) ? job.candidateData : [];
        const candidateEmailsArr = Array.isArray(job.candidateEmails) ? job.candidateEmails : [];

        // Check candidateData
        candidateDataArr.forEach((c: any) => {
          const email = (c?.email || '').toLowerCase().trim();
          if (!email) return;
          const uniqueKey = `${email}_${job.id}`;
          if (!leadsMap.has(uniqueKey)) {
            leadsMap.set(uniqueKey, {
              id: uniqueKey,
              candidateName: c.name || email.split('@')[0],
              candidateEmail: email,
              candidatePhone: c.phone || '',
              jobId: job.id,
              jobTitle: job.title || 'Role',
              companyName: job.companyName || job.company || userProfile?.company || 'Company',
              accessCode: job.accessCode || job.jobNo || '',
              interviewLink: (job.interviewLink && !job.interviewLink.includes('/#/interview/'))
                ? job.interviewLink
                : `${window.location.origin}/#/candidate?job=${job.id}`,
              deadline,
              isJobActive: isJobStatusActive(job),
              appliedAt: c.appliedAt || c.invitedAt || job.createdAt,
              status: c.status || 'Under Review',
              statusUpdatedAt: c.statusUpdatedAt,
              scheduledInterview: c.scheduledInterview,
              recruiterNotes: c.recruiterNotes,
              matchScore: c.matchScore,
              resumeUrl: c.resumeUrl || '',
              source: c.source || 'Invited Candidate',
            });
          }
        });

        // Check raw candidateEmails
        candidateEmailsArr.forEach((emailRaw: string) => {
          const email = String(emailRaw || '').toLowerCase().trim();
          if (!email) return;
          const uniqueKey = `${email}_${job.id}`;
          if (!leadsMap.has(uniqueKey)) {
            leadsMap.set(uniqueKey, {
              id: uniqueKey,
              candidateName: email.split('@')[0],
              candidateEmail: email,
              candidatePhone: '',
              jobId: job.id,
              jobTitle: job.title || 'Role',
              companyName: job.companyName || job.company || userProfile?.company || 'Company',
              accessCode: job.accessCode || job.jobNo || '',
              interviewLink: (job.interviewLink && !job.interviewLink.includes('/#/interview/'))
                ? job.interviewLink
                : `${window.location.origin}/#/candidate?job=${job.id}`,
              deadline,
              isJobActive: isJobStatusActive(job),
              appliedAt: job.createdAt,
              status: 'Under Review',
              source: 'Direct Lead',
            });
          }
        });
      });

      const list = Array.from(leadsMap.values());
      const validLeads = list.filter((lead) => !deletedLeadKeysRef.current.has(lead.id));
      validLeads.sort((a, b) => {
        const timeA = a.appliedAt?.toMillis
          ? a.appliedAt.toMillis()
          : new Date(a.appliedAt || 0).getTime();
        const timeB = b.appliedAt?.toMillis
          ? b.appliedAt.toMillis()
          : new Date(b.appliedAt || 0).getTime();
        return timeB - timeA;
      });

      setLeads(validLeads);
      setLoading(false);
    };

    // A. Query Recruiter Jobs
    const directJobsBySource: Record<string, any[]> = {};
    const interviewsBySource: Record<string, any[]> = {};

    const updateMergedJobs = () => {
      const mergedMap = new Map<string, any>();
      Object.values(directJobsBySource).flat().forEach((j) => mergedMap.set(j.id, j));
      Object.values(interviewsBySource).flat().forEach((i) => {
        const existing = mergedMap.get(i.id);
        mergedMap.set(i.id, {
          ...existing,
          ...i,
          jobNo: i.jobNo || existing?.jobNo || '',
          jobNumber: i.jobNumber || existing?.jobNumber || i.jobNo || existing?.jobNo || '',
          accessCode: i.accessCode || existing?.accessCode || (i.jobNo ? String(i.jobNo) : ''),
          title: i.title ? i.title.replace(/\s+Interview$/i, '').trim() : existing?.title || 'Untitled Role',
        });
      });
      jobsList = Array.from(mergedMap.values());
      setJobs(jobsList);
      mergeAllData();
    };

    const unsubsJobsList: (() => void)[] = [];

    if (isAdmin) {
      const unsubJobs = onSnapshot(
        query(collection(db, 'interviews')),
        (snap) => {
          interviewsBySource['all'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        },
        () => setLoading(false)
      );
      unsubsJobsList.push(unsubJobs);

      const unsubDirectJobs = onSnapshot(
        query(collection(db, 'jobs')),
        (snap) => {
          directJobsBySource['all'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        },
        () => {}
      );
      unsubsJobsList.push(unsubDirectJobs);
    } else {
      if (primaryUid) {
        const uTeamInt = onSnapshot(query(collection(db, 'interviews'), where('teamId', '==', primaryUid)), (snap) => {
          interviewsBySource['team'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        }, () => setLoading(false));
        unsubsJobsList.push(uTeamInt);

        const uTeamJobs = onSnapshot(query(collection(db, 'jobs'), where('teamId', '==', primaryUid)), (snap) => {
          directJobsBySource['team'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        });
        unsubsJobsList.push(uTeamJobs);

        const uPrimInt = onSnapshot(query(collection(db, 'interviews'), where('recruiterUID', '==', primaryUid)), (snap) => {
          interviewsBySource['primary'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        }, () => setLoading(false));
        unsubsJobsList.push(uPrimInt);

        const uPrimJobs = onSnapshot(query(collection(db, 'jobs'), where('recruiterUID', '==', primaryUid)), (snap) => {
          directJobsBySource['primary'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        });
        unsubsJobsList.push(uPrimJobs);
      }

      if (userUid && userUid !== primaryUid) {
        const uUserInt = onSnapshot(query(collection(db, 'interviews'), where('recruiterUID', '==', userUid)), (snap) => {
          interviewsBySource['user'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        }, () => setLoading(false));
        unsubsJobsList.push(uUserInt);

        const uUserJobs = onSnapshot(query(collection(db, 'jobs'), where('recruiterUID', '==', userUid)), (snap) => {
          directJobsBySource['user'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          updateMergedJobs();
        });
        unsubsJobsList.push(uUserJobs);
      }
    }

    // B. Query Candidate Applications
    let candidateAppsList: any[] = [];
    let jobAppsList: any[] = [];

    const updateMergedApplications = () => {
      const combinedMap = new Map<string, any>();
      candidateAppsList.forEach((a) => combinedMap.set(a.id, a));
      jobAppsList.forEach((a) => {
        if (!combinedMap.has(a.id)) {
          combinedMap.set(a.id, a);
        }
      });
      applicationsList = Array.from(combinedMap.values());
      mergeAllData();
    };

    const appsQ = query(collection(db, 'candidateApplications'));
    const unsubApps = onSnapshot(
      appsQ,
      (snap) => {
        candidateAppsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateMergedApplications();
      },
      () => updateMergedApplications()
    );

    const jobAppsQ = query(collection(db, 'jobApplications'));
    const unsubJobApps = onSnapshot(
      jobAppsQ,
      (snap) => {
        jobAppsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateMergedApplications();
      },
      () => updateMergedApplications()
    );

    return () => {
      unsubsJobsList.forEach((u) => u());
      unsubApps();
      unsubJobApps();
    };
  }, [userUid, userTeamId, userParentRecruiterId, isAdmin, (userProfile as any)?.primaryRecruiterUID]);

  // ── Open Candidate Modal and fetch full resume ──
  const handleOpenCandidateModal = async (lead: HotLeadItem) => {
    setSelectedCandidateDetail(lead);
    setNewStatusSelection(lead.status || 'Shortlisted');
    setRecruiterNotesInput(lead.recruiterNotes || '');
    const defaultRecruiter = userProfile?.name || userProfile?.fullname || (user as any)?.displayName || '';
    if (lead.scheduledInterview) {
      setScheduleContactPerson(lead.scheduledInterview.contactPerson || defaultRecruiter);
      setScheduleDate(lead.scheduledInterview.date || '');
      setScheduleTime(lead.scheduledInterview.time || '11:00');
      setScheduleMode(lead.scheduledInterview.mode || 'Google Meet');
      setScheduleLocation(lead.scheduledInterview.location || '');
      setScheduleLink(lead.scheduledInterview.link || '');
      setScheduleNotes(lead.scheduledInterview.notes || '');
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduleContactPerson(defaultRecruiter);
      setScheduleDate(tomorrow.toISOString().split('T')[0]);
      setScheduleTime('11:00');
      setScheduleMode('Google Meet');
      setScheduleLocation('');
      setScheduleLink('');
      setScheduleNotes('');
    }

    setIsLoadingCandidateProfile(true);

    try {
      let candidateProfile: any = null;

      // 1. Try querying resumeDumpCandidates by email
      const cleanEmail = lead.candidateEmail.toLowerCase().trim();
      const qCand = query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail));
      const snap = await getDocs(qCand).catch(() => null);

      if (snap && !snap.empty) {
        candidateProfile = { id: snap.docs[0].id, ...snap.docs[0].data() };
      } else {
        const qCand2 = query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanEmail));
        const snap2 = await getDocs(qCand2).catch(() => null);
        if (snap2 && !snap2.empty) {
          candidateProfile = { id: snap2.docs[0].id, ...snap2.docs[0].data() };
        } else {
          const qLegacy = query(collection(db, 'resumeDump'), where('email', '==', cleanEmail));
          const snapLegacy = await getDocs(qLegacy).catch(() => null);
          if (snapLegacy && !snapLegacy.empty) {
            candidateProfile = { id: snapLegacy.docs[0].id, ...snapLegacy.docs[0].data() };
          }
        }
      }

      if (candidateProfile) {
        const prof = candidateProfile.profile || {};
        const mergedDetails = {
          experience: candidateProfile.experience || prof.experience || candidateProfile.totalExperienceYears || prof.totalExperienceYears || 'N/A',
          education: candidateProfile.education || prof.education || candidateProfile.highestEducation || prof.highestEducation || 'N/A',
          skills: candidateProfile.skills || prof.skills || [],
          location: candidateProfile.location || prof.location || candidateProfile.city || 'N/A',
          preferredLocations: candidateProfile.preferredLocations || prof.preferredLocations || [],
          currentSalary: candidateProfile.currentSalary || prof.currentSalary || 'N/A',
          expectedSalary: candidateProfile.expectedSalary || prof.expectedSalary || 'N/A',
          noticePeriod: candidateProfile.noticePeriod || prof.noticePeriod || 'Immediate',
          summary: candidateProfile.summary || prof.summary || '',
          resumeUrl: candidateProfile.resumeUrl || prof.resumeUrl || candidateProfile.fileUrl || lead.resumeUrl || '',
          resumeFileName: candidateProfile.resumeFileName || prof.resumeFileName || `${lead.candidateName}_Resume.pdf`,
          extractedText: candidateProfile.extractedText || prof.extractedText || candidateProfile.resumeText || '',
        };

        setSelectedCandidateDetail((prev) =>
          prev && prev.id === lead.id
            ? { ...prev, resumeUrl: mergedDetails.resumeUrl || prev.resumeUrl, candidateDetails: mergedDetails }
            : prev
        );
      }
    } catch (err) {
      console.warn('Error fetching candidate full profile:', err);
    } finally {
      setIsLoadingCandidateProfile(false);
    }
  };

  // ── WhatsApp Notification Checkmark Handler ──
  const handleToggleWhatsAppNotify = async (checked: boolean) => {
    setNotifyCandidateWhatsApp(checked);
    if (checked) {
      try {
        const activeSessionId = getStoredSessionId((userProfile as any)?.whatsappSessionId);
        const activePasscode = getStoredPasscode((userProfile as any)?.whatsappSessionPasscode);
        const res = await fetchWhatsAppStatus(activeSessionId, activePasscode);
        const isConnected =
          res.status === 'connected' ||
          res.status === 'CONNECTED' ||
          res.status === 'AUTHENTICATED' ||
          res.status === 'READY' ||
          !!res.userInfo;

        if (!isConnected) {
          // If not connected, directly show QR to link WhatsApp!
          setIsWhatsAppModalOpen(true);
          messageBox.show({
            title: 'WhatsApp Disconnected',
            message: 'Scan the QR code with WhatsApp on your phone (Linked Devices) to connect and send candidate notifications.',
            type: 'info',
          });
        }
      } catch (err) {
        setIsWhatsAppModalOpen(true);
      }
    }
  };

  // ── Update Candidate Status and Dispatch Email & WhatsApp Notifications ──
  const handleUpdateStatus = async (
    lead: HotLeadItem,
    targetStatus: string,
    options?: {
      notifyByEmail?: boolean;
      notifyByWhatsApp?: boolean;
      scheduleDetails?: {
        contactPerson?: string;
        date?: string;
        time?: string;
        mode?: string;
        location?: string;
        link?: string;
        notes?: string;
      };
      recruiterNotes?: string;
    }
  ) => {
    setIsUpdatingStatus(true);
    try {
      const notifyEmail = options?.notifyByEmail ?? notifyCandidateEmail;
      const notifyWhatsApp = options?.notifyByWhatsApp ?? notifyCandidateWhatsApp;
      const updateData: any = {
        status: targetStatus,
        statusUpdatedAt: new Date().toISOString(),
      };
      if (options?.scheduleDetails) {
        updateData.scheduledInterview = options.scheduleDetails;
      }
      if (options?.recruiterNotes !== undefined) {
        updateData.recruiterNotes = options.recruiterNotes;
      }

      // 1. Update in candidateApplications collection
      if (lead.applicationDocId) {
        await updateDoc(doc(db, 'candidateApplications', lead.applicationDocId), updateData).catch(() => {});
      } else {
        const snap = await getDocs(
          query(
            collection(db, 'candidateApplications'),
            where('candidateEmail', '==', lead.candidateEmail)
          )
        ).catch(() => null);
        if (snap && !snap.empty) {
          const matchDoc = snap.docs.find(d => {
            const data = d.data();
            return data.jobId === lead.jobId || data.interviewId === lead.jobId;
          }) || snap.docs[0];
          await updateDoc(doc(db, 'candidateApplications', matchDoc.id), updateData).catch(() => {});
        }
      }

      // 2. Update candidateData in jobs & interviews collections
      if (lead.jobId) {
        const updateJobCandidateStatus = async (collName: string) => {
          try {
            const jDoc = await getDoc(doc(db, collName, lead.jobId));
            if (jDoc.exists()) {
              const data = jDoc.data();
              const cData = data.candidateData || [];
              const updatedCData = cData.map((c: any) => {
                if (c.email && c.email.toLowerCase() === lead.candidateEmail.toLowerCase()) {
                  return { ...c, status: targetStatus, ...updateData };
                }
                return c;
              });
              await updateDoc(doc(db, collName, lead.jobId), {
                candidateData: updatedCData,
                updatedAt: new Date().toISOString(),
              });
            }
          } catch (e) {
            console.warn(`[updateJobCandidateStatus] ${collName} update notice:`, e);
          }
        };
        await Promise.all([
          updateJobCandidateStatus('jobs'),
          updateJobCandidateStatus('interviews'),
        ]);
      }

      // 3. Dispatch Email Notification via SES if checkmark is active
      let emailDispatched = false;
      if (notifyEmail && lead.candidateEmail && lead.candidateEmail.includes('@')) {
        const emailRes = await sendAtsCandidateStatusEmail({
          candidateEmail: lead.candidateEmail,
          candidateName: lead.candidateName,
          jobTitle: lead.jobTitle,
          companyName: lead.companyName || userProfile?.company || 'SNAB hireX',
          newStatus: targetStatus,
          scheduleDetails: options?.scheduleDetails,
          recruiterNotes: options?.recruiterNotes,
          recruiterName: userProfile?.name || userProfile?.fullname || (user as any)?.displayName || 'Recruiter',
          recruiterPhone: userProfile?.phone || '',
          recruiterEmail: userProfile?.email || user?.email,
          candidatePortalLink: `${window.location.origin}/#/candidate?job=${lead.jobId}`,
        });
        emailDispatched = emailRes.success;
      }

      // 4. Dispatch WhatsApp Notification if checkmark is active
      let waDispatched = false;
      if (notifyWhatsApp) {
        const candPhone = lead.candidatePhone || lead.candidateDetails?.phone || '';
        if (!candPhone) {
          messageBox.show({
            title: 'Phone Number Missing',
            message: `Candidate ${lead.candidateName} does not have a phone number on file to receive WhatsApp notifications.`,
            type: 'warning',
          });
        } else {
          try {
            const activeSessionId = getStoredSessionId((userProfile as any)?.whatsappSessionId);
            const activePasscode = getStoredPasscode((userProfile as any)?.whatsappSessionPasscode);
            const statusRes = await fetchWhatsAppStatus(activeSessionId, activePasscode);
            const isConnected =
              statusRes.status === 'connected' ||
              statusRes.status === 'CONNECTED' ||
              statusRes.status === 'AUTHENTICATED' ||
              statusRes.status === 'READY' ||
              !!statusRes.userInfo;

            if (!isConnected) {
              // Not connected: directly show QR to link WhatsApp!
              setIsWhatsAppModalOpen(true);
              messageBox.show({
                title: 'WhatsApp Disconnected',
                message: 'WhatsApp is not connected. Scan the QR code with WhatsApp to connect and send status notifications.',
                type: 'warning',
              });
            } else {
              const waRes = await sendAtsCandidateStatusWhatsApp({
                candidatePhone: candPhone,
                candidateName: lead.candidateName,
                jobTitle: lead.jobTitle,
                companyName: lead.companyName || userProfile?.company || 'SNAB hireX',
                newStatus: targetStatus,
                scheduleDetails: options?.scheduleDetails,
                recruiterNotes: options?.recruiterNotes,
                recruiterName: userProfile?.name || userProfile?.fullname || (user as any)?.displayName || 'Recruiter',
                candidatePortalLink: `${window.location.origin}/#/candidate?job=${lead.jobId}`,
                sessionId: activeSessionId,
                passcode: activePasscode,
              });
              waDispatched = waRes.success;
            }
          } catch (waErr: any) {
            console.error('Error dispatching WhatsApp status update:', waErr);
            setIsWhatsAppModalOpen(true);
          }
        }
      }

      // 4. Update local state immediately
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                status: targetStatus,
                statusUpdatedAt: updateData.statusUpdatedAt,
                scheduledInterview: options?.scheduleDetails || l.scheduledInterview,
                recruiterNotes: options?.recruiterNotes !== undefined ? options.recruiterNotes : l.recruiterNotes,
              }
            : l
        )
      );

      if (selectedCandidateDetail && selectedCandidateDetail.id === lead.id) {
        setSelectedCandidateDetail((prev) =>
          prev
            ? {
                ...prev,
                status: targetStatus,
                statusUpdatedAt: updateData.statusUpdatedAt,
                scheduledInterview: options?.scheduleDetails || prev.scheduledInterview,
                recruiterNotes: options?.recruiterNotes !== undefined ? options.recruiterNotes : prev.recruiterNotes,
              }
            : null
        );
      }

      const notificationParts = [];
      if (emailDispatched) notificationParts.push('Email sent');
      if (waDispatched) notificationParts.push('WhatsApp sent');
      const notificationSummary = notificationParts.length > 0 ? ` (${notificationParts.join(', ')})` : '';

      messageBox.showSuccess(
        `✅ Application status for ${lead.candidateName} moved to "${targetStatus}"!${notificationSummary}`
      );
    } catch (err: any) {
      console.error('Failed to update candidate status:', err);
      messageBox.showError(`Failed to update status: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ── Confirm Status Change from Quick Prompt Modal ──
  const handleConfirmStatusChange = async (overrideMode?: 'both' | 'whatsapp' | 'email' | 'none') => {
    if (!statusChangePrompt) return;
    const { lead, targetStatus } = statusChangePrompt;
    const modeToUse = overrideMode || notifyMode;

    const notifyByWhatsApp = modeToUse === 'both' || modeToUse === 'whatsapp';
    const notifyByEmail = modeToUse === 'both' || modeToUse === 'email';

    let schedulePayload = undefined;
    if (targetStatus === 'Interview Scheduled') {
      schedulePayload = {
        date: statusPromptDate,
        time: statusPromptTime,
        mode: statusPromptMode,
        link: statusPromptLink,
        notes: statusPromptNotes,
      };
    }

    const promptLead = statusChangePrompt.lead;
    const promptNotes = statusPromptNotes;
    setStatusChangePrompt(null);

    await handleUpdateStatus(promptLead, targetStatus, {
      notifyByEmail,
      notifyByWhatsApp,
      scheduleDetails: schedulePayload,
      recruiterNotes: promptNotes.trim() ? promptNotes.trim() : undefined,
    });
  };

  // ── Filtered Leads ──
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Tab filter
      if (activeTab === 'under_review' && (lead.status && lead.status !== 'Under Review' && lead.status !== 'New')) return false;
      if (activeTab === 'shortlisted' && lead.status !== 'Shortlisted') return false;
      if (activeTab === 'scheduled' && lead.status !== 'Interview Scheduled' && !lead.status?.includes('Round')) return false;
      if (activeTab === 'hired' && lead.status !== 'Hired' && lead.status !== 'Offer Extended') return false;
      if (activeTab === 'rejected' && lead.status !== 'Rejected' && lead.status !== 'On Hold') return false;

      // Stage filter
      if (stageFilter !== 'all' && lead.status !== stageFilter) return false;

      // Job filter
      if (selectedJobId !== 'all' && lead.jobId !== selectedJobId) return false;

      // Search term
      if (searchTerm.trim()) {
        const queryLower = searchTerm.toLowerCase();
        const cleanNum = queryLower.replace(/^[#\s]+/, '').trim();
        const matchesName = lead.candidateName.toLowerCase().includes(queryLower);
        const matchesEmail = lead.candidateEmail.toLowerCase().includes(queryLower);
        const matchesPhone = lead.candidatePhone.toLowerCase().includes(queryLower);
        const matchesJob = lead.jobTitle.toLowerCase().includes(queryLower);
        const job = jobs.find((j) => j.id === lead.jobId);
        const jobNo = String(job?.jobNo || job?.jobNumber || lead.accessCode || '').toLowerCase();
        const matchesJobNo = Boolean(
          cleanNum && (
            jobNo.includes(cleanNum) ||
            lead.jobId.toLowerCase().includes(cleanNum) ||
            (lead.accessCode && lead.accessCode.toLowerCase().includes(cleanNum))
          )
        );
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesJob && !matchesJobNo) return false;
      }

      return true;
    });
  }, [leads, activeTab, stageFilter, selectedJobId, searchTerm, jobs]);

  // ── KPI Metrics ──
  const stats = useMemo(() => {
    const total = leads.length;
    const underReview = leads.filter((l) => !l.status || l.status === 'Under Review' || l.status === 'New').length;
    const shortlisted = leads.filter((l) => l.status === 'Shortlisted').length;
    const scheduled = leads.filter((l) => l.status === 'Interview Scheduled' || l.status?.includes('Round')).length;
    const hired = leads.filter((l) => l.status === 'Hired' || l.status === 'Offer Extended').length;

    return { total, underReview, shortlisted, scheduled, hired };
  }, [leads]);

  // Click outside & Escape key handler for job dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setIsJobDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsJobDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectedJobTitle = useMemo(() => {
    if (selectedJobId === 'all') return 'All Jobs';
    const found = jobs.find((j) => j.id === selectedJobId);
    if (!found) return 'All Jobs';
    const jobNum = found.jobNo || found.jobNumber || found.accessCode;
    const prefix = jobNum ? `#${jobNum} • ` : '';
    return `${prefix}${found.title || 'Untitled Role'}`;
  }, [selectedJobId, jobs]);

  // ── Selection Handlers ──
  const handleToggleSelectAll = () => {
    if (filteredLeads.length === 0) return;
    const allFilteredIds = filteredLeads.map((l) => l.id);
    const areAllSelected = allFilteredIds.every((id) => selectedLeadIds.includes(id));
    if (areAllSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // ── Send WhatsApp Reminder ──
  const handleSendWhatsAppReminder = async (lead: HotLeadItem) => {
    if (!lead.candidatePhone) {
      messageBox.showError(`Phone number missing for candidate ${lead.candidateName}.`);
      return;
    }

    setSendingReminderId(`wa_${lead.id}`);
    try {
      const res = await sendInterviewWhatsAppInvite({
        phone: lead.candidatePhone,
        candidateName: lead.candidateName,
        jobTitle: lead.jobTitle,
        interviewLink: lead.interviewLink,
        accessCode: lead.accessCode,
        isReminder: true,
        options: {
          deadline: lead.deadline,
          recruiterName: userProfile?.name || userProfile?.fullname || 'Recruiter',
          recruiterPhone: userProfile?.phone || '',
          recruiterUid: userUid,
        },
      });

      if (res.success) {
        messageBox.showSuccess(`WhatsApp reminder sent to ${lead.candidateName}!`);
      } else {
        const text = buildWhatsAppInviteText({
          candidateName: lead.candidateName,
          jobTitle: lead.jobTitle,
          interviewLink: lead.interviewLink,
          accessCode: lead.accessCode,
          isReminder: true,
          options: { deadline: lead.deadline },
        });
        openWhatsAppWebInvite(lead.candidatePhone, text);
        messageBox.showInfo(`Opening WhatsApp Web chat for ${lead.candidateName}...`);
      }
    } catch (err: any) {
      console.error('WhatsApp reminder error:', err);
      const text = buildWhatsAppInviteText({
        candidateName: lead.candidateName,
        jobTitle: lead.jobTitle,
        interviewLink: lead.interviewLink,
        accessCode: lead.accessCode,
        isReminder: true,
        options: { deadline: lead.deadline },
      });
      openWhatsAppWebInvite(lead.candidatePhone, text);
      messageBox.showInfo(`Opening WhatsApp Web chat for ${lead.candidateName}...`);
    } finally {
      setSendingReminderId(null);
    }
  };

  // ── Send Email Reminder ──
  const handleSendEmailReminder = async (lead: HotLeadItem) => {
    setSendingReminderId(`email_${lead.id}`);
    try {
      const job = jobs.find((j) => j.id === lead.jobId);
      const result = await sendInterviewInvitations(
        [{ email: lead.candidateEmail, name: lead.candidateName }],
        lead.jobTitle,
        lead.interviewLink,
        lead.accessCode,
        true,
        {
          location: (job as any)?.location,
          qualification: (job as any)?.qualifications || (job as any)?.education,
          experience: (job as any)?.experience,
          salary: (job as any)?.salary || (job as any)?.salaryRange,
          deadline: lead.deadline,
          recruiterName: userProfile?.name || userProfile?.fullname || 'Recruiter',
          recruiterPhone: userProfile?.phone || '',
          recruiterEmail: userProfile?.email || user?.email,
          recruiterUid: userUid,
        }
      );

      if (result.success) {
        messageBox.showSuccess(`Email reminder sent to ${lead.candidateName}!`);
      } else {
        messageBox.showError(`Failed to send email: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Email reminder error:', err);
      messageBox.showError(`Failed to send email: ${err?.message || 'Unknown error'}`);
    } finally {
      setSendingReminderId(null);
    }
  };

  // ── Delete Leads ──
  const executeDeleteLeads = async (leadsToDelete: HotLeadItem[]) => {
    setIsDeletingLeads(true);
    try {
      const newKeys = new Set(deletedLeadKeysRef.current);
      leadsToDelete.forEach((l) => newKeys.add(l.id));
      saveDeletedKeys(newKeys);

      setLeads((prev) => prev.filter((l) => !leadsToDelete.some((del) => del.id === l.id)));
      setSelectedLeadIds((prev) => prev.filter((id) => !leadsToDelete.some((del) => del.id === id)));

      const deletePromises: Promise<any>[] = [];

      for (const lead of leadsToDelete) {
        if (lead.applicationDocId) {
          deletePromises.push(
            deleteDoc(doc(db, 'candidateApplications', lead.applicationDocId)).catch(() => {})
          );
        }
      }

      await Promise.all(deletePromises);
      messageBox.showSuccess(
        leadsToDelete.length === 1
          ? `Lead for "${leadsToDelete[0].candidateName || leadsToDelete[0].candidateEmail}" deleted successfully!`
          : `Successfully deleted ${leadsToDelete.length} leads!`
      );
    } catch (err: any) {
      console.error('[executeDeleteLeads] Error:', err);
      messageBox.showError(`Failed to delete lead: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsDeletingLeads(false);
      setDeletingLeadId(null);
    }
  };

  const handleDeleteSingleLead = (lead: HotLeadItem) => {
    setDeletingLeadId(lead.id);
    messageBox.showConfirm(
      `Are you sure you want to delete lead "${lead.candidateName || lead.candidateEmail}"?`,
      () => executeDeleteLeads([lead]),
      () => setDeletingLeadId(null)
    );
  };

  const formatDate = (val: any) => {
    if (!val) return '—';
    try {
      const date = val?.toDate ? val.toDate() : val instanceof Date ? val : new Date(val);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  if (loading) {
    return <RecruiterInterviewsSkeleton />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-[#000] text-gray-900 dark:text-white font-sans pt-1 sm:pt-1.5 transition-colors">
      {/* ── 1. Top Section Header ── */}
      <section className="shrink-0 border-b border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000] transition-colors">
        <div className="flex flex-col gap-2.5 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-7 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/recruiter/jobs"
                className="geist-caption inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-white/[0.04] px-2.5 text-xs font-medium text-gray-800 dark:text-[#d4d4d4] shadow-xs dark:shadow-none transition-all hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:border-gray-400 dark:hover:border-white/[0.25] hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-3 h-3 text-gray-500 dark:text-[#8f8f8f]" />
                <span>Dashboard</span>
              </Link>
              <span className="geist-label uppercase text-gray-500 dark:text-[#6b7280] text-[10px] tracking-wider font-semibold">Candidate Pipeline</span>
            </div>
            <h1 className="geist-page-title mt-1 text-gray-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-500" />
              <span>Candidate Responses & Applications</span>
            </h1>
            <p className="geist-small mt-0.5 text-gray-600 dark:text-[#8f8f8f] max-w-3xl text-xs">
              Manage candidate applications, review resumes, progress ATS pipeline stages, and dispatch candidate email notifications.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <Link
              to="/recruiter/all-jobs"
              className="geist-caption inline-flex h-8 items-center gap-2 rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-white/[0.04] px-3.5 text-xs font-medium text-gray-800 dark:text-[#d4d4d4] shadow-xs dark:shadow-none transition-all hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:border-gray-400 dark:hover:border-white/[0.25] hover:text-gray-900 dark:hover:text-white"
            >
              <Briefcase className="w-3.5 h-3.5 text-gray-600 dark:text-[#a3a3a3]" />
              <span>All Jobs</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. KPI Metrics Bar ── */}
      <section className="border-b border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000] transition-colors">
        <div className="grid grid-cols-2 divide-y divide-gray-200 dark:divide-white/[0.11] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="px-4 py-3.5 sm:px-6 lg:px-7">
            <p className="geist-label uppercase text-[10px] text-gray-500 dark:text-[#8f8f8f] font-semibold tracking-wider flex items-center gap-1.5">
              <User className="size-3 text-gray-400 dark:text-[#8f8f8f]" />
              <span>Total Applications</span>
            </p>
            <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold">{stats.total}</div>
            <p className="geist-small mt-0.5 text-[11px] text-gray-500 dark:text-[#6b7280]">All candidate responses received</p>
          </div>

          <div className="px-4 py-3.5 sm:px-6 lg:px-7">
            <p className="geist-label uppercase text-[10px] text-blue-600 dark:text-blue-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Clock className="size-3 text-blue-600 dark:text-blue-400" />
              <span>Under Review</span>
            </p>
            <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold">{stats.underReview}</div>
            <p className="geist-small mt-0.5 text-[11px] text-gray-500 dark:text-[#6b7280]">New applications awaiting decision</p>
          </div>

          <div className="px-4 py-3.5 sm:px-6 lg:px-7">
            <p className="geist-label uppercase text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>Shortlisted</span>
            </p>
            <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold">{stats.shortlisted}</div>
            <p className="geist-small mt-0.5 text-[11px] text-gray-500 dark:text-[#6b7280]">Candidates selected for interviews</p>
          </div>

          <div className="px-4 py-3.5 sm:px-6 lg:px-7">
            <p className="geist-label uppercase text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Calendar className="size-3 text-indigo-600 dark:text-indigo-400" />
              <span>Interviews Scheduled</span>
            </p>
            <div className="geist-page-title mt-1 text-gray-900 dark:text-white font-bold">{stats.scheduled}</div>
            <p className="geist-small mt-0.5 text-[11px] text-gray-500 dark:text-[#6b7280]">Scheduled & active interview rounds</p>
          </div>
        </div>
      </section>

      {/* ── 3. Controls & Filter Section ── */}
      <section className="border-b border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000] px-4 py-3 sm:px-6 lg:px-7 transition-colors">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Segmented Filter Pills */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-[6px] border border-gray-200 dark:border-white/[0.16] bg-gray-100 dark:bg-white/[0.04] p-0.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`geist-caption inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-white text-gray-900 dark:text-black font-semibold shadow-sm'
                  : 'text-gray-600 dark:text-[#d4d4d4] hover:bg-gray-200/60 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>All Applications</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'all' ? 'bg-gray-200 dark:bg-black/15 text-gray-800 dark:text-black' : 'bg-gray-200/60 dark:bg-white/10 text-gray-600 dark:text-[#8f8f8f]'}`}>
                {stats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('under_review')}
              className={`geist-caption inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors ${
                activeTab === 'under_review'
                  ? 'bg-white dark:bg-white text-gray-900 dark:text-black font-semibold shadow-sm'
                  : 'text-gray-600 dark:text-[#d4d4d4] hover:bg-gray-200/60 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Under Review</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'under_review' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-gray-200/60 dark:bg-white/10 text-gray-600 dark:text-[#8f8f8f]'}`}>
                {stats.underReview}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('shortlisted')}
              className={`geist-caption inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors ${
                activeTab === 'shortlisted'
                  ? 'bg-white dark:bg-white text-gray-900 dark:text-black font-semibold shadow-sm'
                  : 'text-gray-600 dark:text-[#d4d4d4] hover:bg-gray-200/60 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Shortlisted</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'shortlisted' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-gray-200/60 dark:bg-white/10 text-gray-600 dark:text-[#8f8f8f]'}`}>
                {stats.shortlisted}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scheduled')}
              className={`geist-caption inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors ${
                activeTab === 'scheduled'
                  ? 'bg-white dark:bg-white text-gray-900 dark:text-black font-semibold shadow-sm'
                  : 'text-gray-600 dark:text-[#d4d4d4] hover:bg-gray-200/60 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Interviews Scheduled</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'scheduled' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-gray-200/60 dark:bg-white/10 text-gray-600 dark:text-[#8f8f8f]'}`}>
                {stats.scheduled}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hired')}
              className={`geist-caption inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-3 font-medium transition-colors ${
                activeTab === 'hired'
                  ? 'bg-white dark:bg-white text-gray-900 dark:text-black font-semibold shadow-sm'
                  : 'text-gray-600 dark:text-[#d4d4d4] hover:bg-gray-200/60 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-green-500" />
              <span>Hired</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'hired' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-gray-200/60 dark:bg-white/10 text-gray-600 dark:text-[#8f8f8f]'}`}>
                {stats.hired}
              </span>
            </button>
          </div>

          {/* Search & Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative w-full sm:w-[220px] lg:w-[260px]">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 dark:text-[#8f8f8f]" strokeWidth={1.8} />
              <input
                type="text"
                placeholder="Search candidate, job #, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="geist-caption h-9 w-full rounded-[6px] border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] pl-9 pr-3 text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-[#6b7280] focus:border-blue-500 dark:focus:border-white/[0.24] transition-colors"
              />
            </div>

            {/* Searchable Job Filter Dropdown */}
            <div className="relative" ref={jobDropdownRef}>
              <button
                type="button"
                onClick={() => setIsJobDropdownOpen(!isJobDropdownOpen)}
                className={`geist-caption h-9 rounded-[6px] border px-2.5 text-xs outline-none transition-colors flex items-center justify-between gap-2 min-w-[170px] max-w-[240px] sm:max-w-[280px] cursor-pointer ${
                  selectedJobId !== 'all'
                    ? 'border-emerald-500/50 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium'
                    : 'border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] text-gray-700 dark:text-white hover:border-gray-300 dark:hover:border-white/[0.24]'
                }`}
                title={selectedJobTitle}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                  <Briefcase className={`size-3 shrink-0 ${selectedJobId !== 'all' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-[#8f8f8f]'}`} />
                  <span className="truncate">{selectedJobTitle}</span>
                </div>
                <ChevronDown className={`size-3 text-gray-400 dark:text-[#8f8f8f] transition-transform duration-200 ${isJobDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isJobDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-50 w-[300px] sm:w-[340px] rounded-[8px] border border-gray-200 dark:border-white/[0.15] bg-white dark:bg-[#0d0d10] shadow-xl dark:shadow-2xl backdrop-blur-xl overflow-hidden">
                  <div className="p-2 border-b border-gray-100 dark:border-white/[0.08]">
                    <input
                      ref={jobSearchInputRef}
                      type="text"
                      placeholder="Filter jobs..."
                      value={jobSearchQuery}
                      onChange={(e) => setJobSearchQuery(e.target.value)}
                      className="h-8 w-full rounded-[5px] border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-black/60 px-2.5 text-xs text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                  <div className="max-h-[220px] overflow-y-auto p-1 divide-y divide-gray-100 dark:divide-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => { setSelectedJobId('all'); setIsJobDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded flex items-center justify-between"
                    >
                      <span>All Jobs</span>
                      {selectedJobId === 'all' && <Check className="size-3 text-emerald-500" />}
                    </button>
                    {jobs
                      .filter(j => !jobSearchQuery.trim() || (j.title || '').toLowerCase().includes(jobSearchQuery.toLowerCase()))
                      .map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => { setSelectedJobId(j.id); setIsJobDropdownOpen(false); }}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded flex items-center justify-between"
                        >
                          <span className="truncate">{j.title || 'Untitled Role'}</span>
                          {selectedJobId === j.id && <Check className="size-3 text-emerald-500" />}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stage Filter Dropdown */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="geist-caption h-9 rounded-[6px] border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] px-2.5 text-xs text-gray-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-white/[0.24] cursor-pointer max-w-[170px]"
            >
              <option value="all">All ATS Stages</option>
              {ATS_PIPELINE_STAGES.map((st) => (
                <option key={st.key} value={st.key}>{st.label}</option>
              ))}
            </select>

            {/* Bulk Actions */}
            {selectedLeadIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const selectedLeads = leads.filter((l) => selectedLeadIds.includes(l.id));
                    executeDeleteLeads(selectedLeads);
                  }}
                  disabled={isDeletingLeads}
                  className="geist-caption inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-red-500/40 bg-red-500/10 px-3 font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedLeadIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLeadIds([])}
                  className="geist-caption inline-flex h-9 items-center justify-center px-2 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Deselect
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 4. Main Applications Table ── */}
      <div className="px-4 py-5 sm:px-6 lg:px-7">
        <div className="rounded-[8px] border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000] overflow-hidden shadow-sm dark:shadow-none transition-colors">
          {filteredLeads.length === 0 ? (
            <div className="py-16 text-center">
              <div className="size-12 rounded-full border border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center mx-auto mb-3 text-emerald-500">
                <User className="w-6 h-6" />
              </div>
              <h3 className="geist-subheading text-gray-900 dark:text-white">No candidate applications found</h3>
              <p className="geist-small mt-1 text-gray-500 dark:text-[#8f8f8f] max-w-sm mx-auto">
                {searchTerm || selectedJobId !== 'all' || stageFilter !== 'all'
                  ? 'No applicants match the selected filters. Try clearing your search or filter options.'
                  : 'When candidates apply for your posted jobs, their full profile and resume will automatically appear here!'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-[#050505]">
                    <th className="geist-label w-10 px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-gray-400 dark:text-[#8f8f8f] hover:text-gray-700 dark:hover:text-white transition-colors"
                      >
                        {filteredLeads.length > 0 && filteredLeads.every((l) => selectedLeadIds.includes(l.id)) ? (
                          <CheckSquare className="size-3.5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                      </button>
                    </th>
                    <th className="geist-label whitespace-nowrap px-4 py-2.5 uppercase text-[10px] tracking-wider font-semibold text-gray-500 dark:text-[#8f8f8f]">
                      Candidate Profile
                    </th>
                    <th className="geist-label whitespace-nowrap px-4 py-2.5 uppercase text-[10px] tracking-wider font-semibold text-gray-500 dark:text-[#8f8f8f]">
                      Applied Role
                    </th>
                    <th className="geist-label whitespace-nowrap px-4 py-2.5 uppercase text-[10px] tracking-wider font-semibold text-gray-500 dark:text-[#8f8f8f]">
                      Application Details
                    </th>
                    <th className="geist-label whitespace-nowrap px-4 py-2.5 uppercase text-[10px] tracking-wider font-semibold text-gray-500 dark:text-[#8f8f8f]">
                      ATS Stage & Status
                    </th>
                    <th className="geist-label whitespace-nowrap px-4 py-2.5 text-right uppercase text-[10px] tracking-wider font-semibold text-gray-500 dark:text-[#8f8f8f] min-w-[190px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.07]">
                  {filteredLeads.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    const job = jobs.find((j) => j.id === lead.jobId);
                    const jobNum = job?.jobNo || job?.jobNumber || lead.accessCode;
                    const stageConfig = ATS_PIPELINE_STAGES.find((s) => s.key === lead.status) || ATS_PIPELINE_STAGES[0];

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors duration-150 ${
                          isSelected ? 'bg-gray-100/70 dark:bg-white/[0.04]' : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectLead(lead.id)}
                            className="text-gray-400 dark:text-[#8f8f8f] hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="size-3.5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Square className="size-3.5" />
                            )}
                          </button>
                        </td>

                        {/* Candidate Details */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="size-9 shrink-0 rounded-full border border-gray-200 dark:border-white/[0.12] bg-emerald-50 dark:bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                              {lead.candidateName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => handleOpenCandidateModal(lead)}
                                className="geist-caption text-xs font-bold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left flex items-center gap-1.5 group cursor-pointer"
                              >
                                <span className="group-hover:underline underline-offset-2">{lead.candidateName}</span>
                                <Eye className="size-3 opacity-0 group-hover:opacity-100 text-emerald-500 transition-opacity" />
                              </button>
                              <div className="geist-small text-[11px] text-gray-500 dark:text-[#8f8f8f] truncate font-mono mt-0.5">
                                <a href={`mailto:${lead.candidateEmail}`} className="hover:underline">{lead.candidateEmail}</a>
                              </div>
                              {lead.candidatePhone && (
                                <div className="geist-small text-[10px] text-gray-400 dark:text-[#6b7280] font-mono flex items-center gap-1 mt-0.5">
                                  <Phone className="size-2.5 text-gray-400 dark:text-[#8f8f8f]" />
                                  <a href={`tel:${lead.candidatePhone}`} className="hover:underline">{lead.candidatePhone}</a>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Applied Job Role */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <div className="geist-caption text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[240px] flex items-center gap-1.5">
                              {jobNum && (
                                <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/[0.08] shrink-0">
                                  #{jobNum}
                                </span>
                              )}
                              <span className="truncate">{lead.jobTitle}</span>
                            </div>
                            <div className="geist-small text-[11px] text-gray-500 dark:text-[#8f8f8f] truncate max-w-[240px]">
                              {lead.companyName}
                            </div>
                            {lead.accessCode && (
                              <div className="geist-small text-[10px] text-gray-400 dark:text-[#6b7280] font-mono">
                                Job Code: <span className="text-gray-600 dark:text-[#d4d4d4] font-medium">{lead.accessCode}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Application Details */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <div className="geist-small text-[11px] text-gray-500 dark:text-[#8f8f8f]">
                              Applied: <span className="text-gray-900 dark:text-white font-medium">{formatDate(lead.appliedAt)}</span>
                            </div>
                            {lead.matchScore !== undefined && lead.matchScore > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <Sparkles size={10} />
                                  <span>{lead.matchScore}% Match</span>
                                </span>
                                {lead.matchGrade && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                    Grade {lead.matchGrade}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* ATS Stage & Status with Quick Selector */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <select
                              value={lead.status || 'Under Review'}
                              onChange={(e) => {
                                const chosen = e.target.value;
                                if (chosen === (lead.status || 'Under Review')) return;

                                // Open notification prompt modal
                                setStatusChangePrompt({
                                  lead,
                                  targetStatus: chosen,
                                  previousStatus: lead.status || 'Under Review',
                                });
                                setNotifyMode(lead.candidatePhone ? 'both' : 'email');
                                setStatusPromptNotes('');
                                if (chosen === 'Interview Scheduled') {
                                  const today = new Date().toISOString().split('T')[0];
                                  setStatusPromptDate(today);
                                  setStatusPromptTime('11:00');
                                  setStatusPromptMode('Google Meet');
                                  setStatusPromptLink(lead.interviewLink || '');
                                }
                              }}
                              className={`geist-caption text-xs font-bold rounded-[6px] border px-2.5 py-1 outline-none cursor-pointer transition-colors ${stageConfig.color}`}
                            >
                              {ATS_PIPELINE_STAGES.map((st) => (
                                <option key={st.key} value={st.key} className="bg-white dark:bg-[#111] text-gray-900 dark:text-white font-medium">
                                  {st.label}
                                </option>
                              ))}
                            </select>

                            {lead.scheduledInterview?.date && (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                                <Calendar size={11} />
                                <span>{lead.scheduledInterview.date} {lead.scheduledInterview.time}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap min-w-[190px]">
                          <div className="flex items-center justify-end gap-2">
                            {/* View Details & Resume Modal Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenCandidateModal(lead)}
                              className="geist-caption inline-flex h-7 items-center justify-center gap-1.5 rounded-[5px] border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors cursor-pointer shrink-0"
                              title="View full candidate details, ATS status & resume"
                            >
                              <FileText className="size-3" />
                              <span>View Details & Resume</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleLead(lead)}
                              disabled={isDeletingLeads && deletingLeadId === lead.id}
                              title={`Delete application for ${lead.candidateName}`}
                              className="geist-caption inline-flex h-7 items-center justify-center rounded-[5px] border border-red-500/30 bg-red-50 dark:bg-red-500/10 px-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                            >
                              {isDeletingLeads && deletingLeadId === lead.id ? (
                                <RotateCw className="size-3 animate-spin" />
                              ) : (
                                <Trash2 className="size-3" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Full Candidate Details & Resume Modal ── */}
      {selectedCandidateDetail && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col rounded-2xl border border-gray-200 dark:border-white/[0.14] bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-white/[0.11] bg-gray-50/80 dark:bg-[#111114]">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-base shadow-md shadow-emerald-500/20">
                  {selectedCandidateDetail.candidateName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{selectedCandidateDetail.candidateName}</span>
                    {selectedCandidateDetail.matchScore !== undefined && selectedCandidateDetail.matchScore > 0 && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {selectedCandidateDetail.matchScore}% Match
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Mail size={12} />
                      <a href={`mailto:${selectedCandidateDetail.candidateEmail}`} className="hover:underline">{selectedCandidateDetail.candidateEmail}</a>
                    </span>
                    {selectedCandidateDetail.candidatePhone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone size={12} />
                        <a href={`tel:${selectedCandidateDetail.candidatePhone}`} className="hover:underline">{selectedCandidateDetail.candidatePhone}</a>
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                      <Briefcase size={12} />
                      <span>{selectedCandidateDetail.jobTitle}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedCandidateDetail(null)}
                className="size-8 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                title="Close Modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* ATS Status Changer Banner */}
            <div className="px-5 py-4 bg-gray-100/80 dark:bg-[#151518] border-b border-gray-200 dark:border-white/[0.08]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    ATS Stage:
                  </span>
                  <select
                    value={newStatusSelection}
                    onChange={(e) => setNewStatusSelection(e.target.value)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/[0.15] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    {ATS_PIPELINE_STAGES.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                {newStatusSelection !== 'Interview Scheduled' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notifyCandidateEmail}
                        onChange={(e) => setNotifyCandidateEmail(e.target.checked)}
                        className="rounded border-gray-300 dark:border-white/20 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1">
                        <Mail className="size-3 text-blue-500" />
                        <span>Email</span>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notifyCandidateWhatsApp}
                        onChange={(e) => handleToggleWhatsAppNotify(e.target.checked)}
                        className="rounded border-gray-300 dark:border-white/20 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-3 text-emerald-500" />
                        <span>WhatsApp</span>
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateStatus(selectedCandidateDetail, newStatusSelection, {
                          notifyByEmail: false,
                          notifyByWhatsApp: false,
                          recruiterNotes: recruiterNotesInput,
                        });
                      }}
                      disabled={isUpdatingStatus}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                      title="Update status silently without notifying candidate"
                    >
                      <BellOff size={13} />
                      <span>No Notify</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateStatus(selectedCandidateDetail, newStatusSelection, {
                          notifyByEmail: notifyCandidateEmail,
                          notifyByWhatsApp: notifyCandidateWhatsApp,
                          recruiterNotes: recruiterNotesInput,
                        });
                      }}
                      disabled={isUpdatingStatus}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isUpdatingStatus ? <RotateCw size={13} className="animate-spin" /> : <Check size={13} />}
                      <span>Update & Notify</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Extra Schedule Fields if "Interview Scheduled" is selected */}
              {newStatusSelection === 'Interview Scheduled' && (
                <div className="mt-3.5 pt-3.5 border-t border-gray-200 dark:border-white/[0.08] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Calendar size={14} />
                      <span>Interview Schedule Details</span>
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Fields will be saved and sent to candidate via email notification
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Contact Person Name */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Contact Person Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sarah Jenkins (Lead Recruiter)"
                        value={scheduleContactPerson}
                        onChange={(e) => setScheduleContactPerson(e.target.value)}
                        className="w-full text-xs h-8 px-2.5 rounded-md border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Interview Date */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Interview Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full text-xs h-8 px-2.5 rounded-md border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Interview Location */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Interview Location / Venue <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Office 4th Floor, Tech Park / Remote"
                        value={scheduleLocation}
                        onChange={(e) => setScheduleLocation(e.target.value)}
                        className="w-full text-xs h-8 px-2.5 rounded-md border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Interview Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full text-xs h-8 px-2.5 rounded-md border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Mode */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Interview Mode
                      </label>
                      <select
                        value={scheduleMode}
                        onChange={(e) => setScheduleMode(e.target.value)}
                        className="w-full text-xs h-8 px-2 rounded-md border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        <option value="Google Meet">Google Meet</option>
                        <option value="Zoom Meeting">Zoom Meeting</option>
                        <option value="Phone Interview">Phone Interview</option>
                        <option value="In-person Office">In-person Office</option>
                      </select>
                    </div>

                    {/* Meeting Link */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Meeting Link (if online)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. https://meet.google.com/xyz"
                        value={scheduleLink}
                        onChange={(e) => setScheduleLink(e.target.value)}
                        className="w-full text-xs h-8 px-2.5 rounded-md border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Notes / Instructions */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Instructions / Notes for Candidate (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Please join 5 minutes early with your ID and portfolio ready"
                      value={scheduleNotes}
                      onChange={(e) => setScheduleNotes(e.target.value)}
                      className="w-full text-xs h-8 px-2.5 rounded-md border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#09090b] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Schedule Action Button Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={notifyCandidateEmail}
                          onChange={(e) => setNotifyCandidateEmail(e.target.checked)}
                          className="rounded border-gray-300 dark:border-white/20 text-indigo-600 focus:ring-indigo-500 size-4 cursor-pointer"
                        />
                        <span className="flex items-center gap-1">
                          <Mail className="size-3 text-blue-500" />
                          <span>Email Notification</span>
                        </span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={notifyCandidateWhatsApp}
                          onChange={(e) => handleToggleWhatsAppNotify(e.target.checked)}
                          className="rounded border-gray-300 dark:border-white/20 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                        />
                        <span className="flex items-center gap-1">
                          <MessageCircle className="size-3 text-emerald-500" />
                          <span>WhatsApp Notification</span>
                        </span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const schedulePayload = {
                          contactPerson: scheduleContactPerson,
                          date: scheduleDate,
                          time: scheduleTime,
                          mode: scheduleMode,
                          location: scheduleLocation,
                          link: scheduleLink,
                          notes: scheduleNotes,
                        };

                        handleUpdateStatus(selectedCandidateDetail, 'Interview Scheduled', {
                          notifyByEmail: notifyCandidateEmail,
                          notifyByWhatsApp: notifyCandidateWhatsApp,
                          scheduleDetails: schedulePayload,
                          recruiterNotes: recruiterNotesInput,
                        });
                      }}
                      disabled={isUpdatingStatus}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isUpdatingStatus ? <RotateCw size={13} className="animate-spin" /> : <Calendar size={13} />}
                      <span>Schedule Interview & Save</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Tabs Header */}
            <div className="flex items-center justify-between px-5 border-b border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0c0c0e]">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('resume')}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeModalTab === 'resume'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <FileText size={14} />
                  <span>Resume Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('profile')}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeModalTab === 'profile'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <User size={14} />
                  <span>ATS Profile & Details</span>
                </button>
              </div>

              {selectedCandidateDetail.resumeUrl && (
                <a
                  href={selectedCandidateDetail.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                >
                  <ExternalLink size={12} />
                  <span>Open in New Tab</span>
                </a>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 dark:bg-[#08080a]">
              {isLoadingCandidateProfile ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <RotateCw className="size-6 animate-spin text-emerald-500" />
                  <span className="text-xs">Loading candidate profile & resume...</span>
                </div>
              ) : activeModalTab === 'resume' ? (
                <div className="w-full h-full min-h-[460px] flex flex-col rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#000] overflow-hidden">
                  {selectedCandidateDetail.resumeUrl ? (
                    <iframe
                      src={
                        selectedCandidateDetail.resumeUrl.endsWith('.docx')
                          ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(selectedCandidateDetail.resumeUrl)}`
                          : selectedCandidateDetail.resumeUrl
                      }
                      className="w-full h-[520px] border-0"
                      title="Candidate Resume"
                    />
                  ) : (
                    <div className="p-8 text-center my-auto">
                      <FileText className="size-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        Resume document file not uploaded
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
                        Candidate applied with profile credentials. Check the ATS Profile tab to review education, experience, and skill details.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Profile Tab */
                <div className="space-y-5">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114]">
                      <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                        <Briefcase size={12} /> Total Experience
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {String(selectedCandidateDetail.candidateDetails?.experience || '0')} Years
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114]">
                      <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                        <GraduationCap size={12} /> Education / Degree
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                        {typeof selectedCandidateDetail.candidateDetails?.education === 'string'
                          ? selectedCandidateDetail.candidateDetails.education
                          : Array.isArray(selectedCandidateDetail.candidateDetails?.education)
                          ? selectedCandidateDetail.candidateDetails.education[0]?.degree || 'Graduate'
                          : 'Graduate'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114]">
                      <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                        <MapPin size={12} /> Present City
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                        {selectedCandidateDetail.candidateDetails?.location || 'Not Specified'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114]">
                      <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                        <Clock size={12} /> Notice Period
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedCandidateDetail.candidateDetails?.noticePeriod || 'Immediate'}
                      </span>
                    </div>
                  </div>

                  {/* Skills Cloud */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114]">
                    <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                      <Tag size={13} />
                      <span>Candidate Skills</span>
                    </h4>
                    {selectedCandidateDetail.candidateDetails?.skills && selectedCandidateDetail.candidateDetails.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCandidateDetail.candidateDetails.skills.map((skill: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-white/[0.07] text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-white/[0.08]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No specific skills listed</span>
                    )}
                  </div>

                  {/* Candidate Summary */}
                  {selectedCandidateDetail.candidateDetails?.summary && (
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114]">
                      <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                        Professional Summary
                      </h4>
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                        {selectedCandidateDetail.candidateDetails.summary}
                      </p>
                    </div>
                  )}

                  {/* Recruiter Notes / Instructions */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111114]">
                    <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                      Recruiter Private Notes
                    </h4>
                    <textarea
                      rows={3}
                      value={recruiterNotesInput}
                      onChange={(e) => setRecruiterNotesInput(e.target.value)}
                      placeholder="Add recruiter feedback, interview evaluations, or next step notes..."
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-white/[0.1] bg-gray-50 dark:bg-[#070709] text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-[#111114]">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Application received on {formatDate(selectedCandidateDetail.appliedAt)}
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateDetail(null)}
                className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-white/[0.05] text-xs font-bold hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp QR Connect Modal */}
      <WhatsAppConnectModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />

      {/* ── Status Change Notification Prompt Modal ── */}
      {statusChangePrompt && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setStatusChangePrompt(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-white/[0.14] bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/[0.1] bg-gray-50/80 dark:bg-[#111114]">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Send size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    Update Candidate Status
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Choose whether to notify via WhatsApp, Email, or update silently
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusChangePrompt(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {/* Candidate & Stage Change Summary Card */}
              <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-full bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                      {statusChangePrompt.lead.candidateName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {statusChangePrompt.lead.candidateName}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {statusChangePrompt.lead.jobTitle} • {statusChangePrompt.lead.companyName}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 text-right">
                    {statusChangePrompt.lead.candidatePhone || 'No Phone'}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-200 dark:border-white/[0.06]">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-[5px] border ${
                    ATS_PIPELINE_STAGES.find((s) => s.key === statusChangePrompt.previousStatus)?.color || 'border-gray-500/30'
                  }`}>
                    {statusChangePrompt.previousStatus}
                  </span>
                  <ArrowRight size={13} className="text-gray-400" />
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-[5px] border ${
                    ATS_PIPELINE_STAGES.find((s) => s.key === statusChangePrompt.targetStatus)?.color || 'border-emerald-500/30'
                  }`}>
                    {statusChangePrompt.targetStatus}
                  </span>
                </div>
              </div>

              {/* Interview Details if "Interview Scheduled" is chosen */}
              {statusChangePrompt.targetStatus === 'Interview Scheduled' && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <Calendar size={14} />
                    <span>Interview Schedule Details</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={statusPromptDate}
                        onChange={(e) => setStatusPromptDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#111] text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={statusPromptTime}
                        onChange={(e) => setStatusPromptTime(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#111] text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                      Meeting Link / Location
                    </label>
                    <input
                      type="text"
                      value={statusPromptLink}
                      onChange={(e) => setStatusPromptLink(e.target.value)}
                      placeholder="https://meet.google.com/... or office location"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#111] text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Notification Channel Selection Cards */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2">
                  Select Notification Option
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {/* 1. WhatsApp & Email (Both) */}
                  <div
                    onClick={() => setNotifyMode('both')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      notifyMode === 'both'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                        : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] bg-gray-50/50 dark:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        notifyMode === 'both' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-500'
                      }`}>
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            WhatsApp & Email
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            Both Channels
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Dispatches WhatsApp template to phone and branded ATS status email
                        </p>
                      </div>
                    </div>
                    <div className={`size-4 rounded-full border flex items-center justify-center ${
                      notifyMode === 'both' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-400 dark:border-white/30'
                    }`}>
                      {notifyMode === 'both' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </div>

                  {/* 2. WhatsApp Only */}
                  <div
                    onClick={() => setNotifyMode('whatsapp')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      notifyMode === 'whatsapp'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                        : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] bg-gray-50/50 dark:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        notifyMode === 'whatsapp' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-500'
                      }`}>
                        <MessageCircle size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          WhatsApp Message Only
                        </span>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                          {statusChangePrompt.lead.candidatePhone || 'No phone number available'}
                        </p>
                      </div>
                    </div>
                    <div className={`size-4 rounded-full border flex items-center justify-center ${
                      notifyMode === 'whatsapp' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-400 dark:border-white/30'
                    }`}>
                      {notifyMode === 'whatsapp' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </div>

                  {/* 3. Email Only */}
                  <div
                    onClick={() => setNotifyMode('email')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      notifyMode === 'email'
                        ? 'border-blue-500 bg-blue-500/10 shadow-sm'
                        : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] bg-gray-50/50 dark:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        notifyMode === 'email' ? 'bg-blue-500 text-white' : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        <Mail size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Email Notification Only
                        </span>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                          {statusChangePrompt.lead.candidateEmail}
                        </p>
                      </div>
                    </div>
                    <div className={`size-4 rounded-full border flex items-center justify-center ${
                      notifyMode === 'email' ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-400 dark:border-white/30'
                    }`}>
                      {notifyMode === 'email' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </div>

                  {/* 4. No Notify (Update Silently) */}
                  <div
                    onClick={() => setNotifyMode('none')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      notifyMode === 'none'
                        ? 'border-gray-400 dark:border-white/40 bg-gray-200/50 dark:bg-white/[0.07] shadow-sm'
                        : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] bg-gray-50/50 dark:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        notifyMode === 'none' ? 'bg-gray-700 dark:bg-white/20 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'
                      }`}>
                        <BellOff size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          No Notification (Update Silently)
                        </span>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Update ATS pipeline stage in database without sending any notifications
                        </p>
                      </div>
                    </div>
                    <div className={`size-4 rounded-full border flex items-center justify-center ${
                      notifyMode === 'none' ? 'border-gray-600 dark:border-white bg-gray-700 dark:bg-white text-white dark:text-black' : 'border-gray-400 dark:border-white/30'
                    }`}>
                      {notifyMode === 'none' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Recruiter Notes */}
              {notifyMode !== 'none' && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                    Add Personal Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={statusPromptNotes}
                    onChange={(e) => setStatusPromptNotes(e.target.value)}
                    placeholder="e.g. Please bring an updated copy of your portfolio..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-[#111] text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-200 dark:border-white/[0.1] bg-gray-50/80 dark:bg-[#111114]">
              <button
                type="button"
                onClick={() => setStatusChangePrompt(null)}
                className="px-3.5 py-2 rounded-lg border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-white/[0.05] text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {notifyMode !== 'none' && (
                  <button
                    type="button"
                    onClick={() => handleConfirmStatusChange('none')}
                    disabled={isUpdatingStatus}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-white/[0.12] text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                  >
                    <BellOff size={13} />
                    <span>No Notify</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleConfirmStatusChange()}
                  disabled={isUpdatingStatus}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                    notifyMode === 'none'
                      ? 'bg-slate-800 dark:bg-white/20 hover:bg-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  }`}
                >
                  {isUpdatingStatus ? (
                    <RotateCw size={13} className="animate-spin" />
                  ) : notifyMode === 'none' ? (
                    <Check size={13} />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>
                    {notifyMode === 'none'
                      ? 'Update Status (No Notify)'
                      : notifyMode === 'both'
                      ? 'Notify (WhatsApp & Email)'
                      : notifyMode === 'whatsapp'
                      ? 'Notify via WhatsApp'
                      : 'Notify via Email'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
