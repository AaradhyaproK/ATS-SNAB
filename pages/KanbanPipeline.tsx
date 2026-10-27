import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';
import { openWhatsAppWebInvite } from '../services/waSenderService';
import {
  calculateJobMatchScore,
  JobMatchResult,
  CandidateMatchProfile,
} from '../services/jobMatchService';
import {
  Kanban,
  Briefcase,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  UserCheck,
  XCircle,
  FileText,
  ExternalLink,
  Share2,
  ChevronDown,
  Sparkles,
  Users,
  MessageCircle,
  X,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Copy,
  Download,
  MapPin,
  GraduationCap,
  Mail,
  Phone,
  Award,
  Archive,
} from 'lucide-react';

export interface PipelineCandidate {
  id: string;
  applicationDocId?: string;
  candidateId?: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  accessCode?: string;
  status: 'Under Review' | 'Shortlisted' | 'Interview Scheduled' | 'Hired' | 'Rejected';
  appliedAt?: any;
  matchScore: number;
  matchGrade: string;
  matchResult?: JobMatchResult | null;
  skills: string[];
  experience: string | number;
  noticePeriod: string;
  location?: string;
  education?: string;
  summary?: string;
  resumeUrl?: string;
  scheduledInterview?: {
    date?: string;
    time?: string;
    link?: string;
    notes?: string;
  };
}

interface PipelineJob {
  id: string;
  title: string;
  role?: string;
  companyName?: string;
  company?: string;
  accessCode?: string;
  jobNo?: string;
  jobNumber?: string;
  department?: string;
  location?: string;
  createdAt?: any;
  candidateData?: any[];
  candidateEmails?: string[];
  skills?: string[];
  requiredSkills?: string[];
  minExperience?: number | string;
  experience?: string | number;
}

const STAGES = [
  {
    key: 'Under Review',
    label: 'Under Review',
    desc: 'New applications & screening',
    accentColor: 'text-blue-500',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
    icon: Clock,
  },
  {
    key: 'Shortlisted',
    label: 'Shortlisted',
    desc: 'Client Review Link Sync',
    accentColor: 'text-emerald-500',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
    icon: CheckCircle2,
  },
  {
    key: 'Interview Scheduled',
    label: 'Interview Scheduled',
    desc: 'Active hiring rounds',
    accentColor: 'text-indigo-500',
    dotClass: 'bg-indigo-500',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20',
    icon: Calendar,
  },
  {
    key: 'Hired',
    label: 'Offer / Hired',
    desc: 'Offer extended & hired',
    accentColor: 'text-amber-500',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
    icon: UserCheck,
  },
  {
    key: 'Rejected',
    label: 'Archived / Rejected',
    desc: 'Archived or not selected',
    accentColor: 'text-rose-500',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20',
    icon: XCircle,
  },
] as const;

// Dynamic avatar color generator (no harsh black square)
const getAvatarStyle = (name: string) => {
  const styles = [
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return styles[Math.abs(hash) % styles.length];
};

export default function KanbanPipeline() {
  const { user, userProfile } = useAuth();
  const messageBox = useMessageBox();

  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [allLeads, setAllLeads] = useState<PipelineCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUpdatingStage, setIsUpdatingStage] = useState<boolean>(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minScoreFilter, setMinScoreFilter] = useState<'all' | '80' | '90'>('all');
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState<boolean>(false);
  const [jobSearchQuery, setJobSearchQuery] = useState<string>('');
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const jobSearchInputRef = useRef<HTMLInputElement>(null);

  // Drag & Drop State
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Archived / Rejected Column Visibility Toggle (fits 4 core stages cleanly on screen by default)
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Sideway Candidate Detail Drawer State
  const [selectedDrawerCandidate, setSelectedDrawerCandidate] = useState<PipelineCandidate | null>(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'profile' | 'resume'>('profile');

  // Client Shortlist Review Link State
  const [clientShortlistUrl, setClientShortlistUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Schedule Modal State
  const [schedulePromptCandidate, setSchedulePromptCandidate] = useState<PipelineCandidate | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('11:00');
  const [scheduleLink, setScheduleLink] = useState<string>('https://meet.google.com/');
  const [scheduleNotes, setScheduleNotes] = useState<string>('Interview round with hiring team.');

  // Dropdown outside click handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target as Node)) {
        setIsJobDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isJobDropdownOpen) {
      setTimeout(() => jobSearchInputRef.current?.focus(), 50);
    } else {
      setJobSearchQuery('');
    }
  }, [isJobDropdownOpen]);

  // ── 1. Comprehensive Multi-Source Realtime Query (Matching HotLeads Architecture) ──
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const userUid = user?.uid;
    const userTeamId = userProfile?.teamId;
    const userParentRecruiterId = userProfile?.parentRecruiterId;
    const isAdmin = userProfile?.role === 'admin' || user?.email === 'admin@snab.co.in';
    const primaryUid =
      userParentRecruiterId ||
      (userProfile as any)?.primaryRecruiterUID ||
      userTeamId ||
      userUid ||
      '';

    let directJobsBySource: Record<string, any[]> = {};
    let interviewsBySource: Record<string, any[]> = {};
    let candidateAppsList: any[] = [];
    let jobAppsList: any[] = [];
    let profilesMap = new Map<string, any>();
    let deletedKeys = new Set<string>();

    let currentJobsList: PipelineJob[] = [];

    // Core aggregator function
    const mergeAllData = () => {
      // 1. Merge Jobs
      const mergedMap = new Map<string, PipelineJob>();
      Object.values(directJobsBySource)
        .flat()
        .forEach((j) => {
          mergedMap.set(j.id, {
            id: j.id,
            title: j.title ? j.title.replace(/\s+Interview$/i, '').trim() : 'Role',
            role: j.role,
            companyName: j.companyName || j.company || userProfile?.company || 'Company',
            jobNo: j.jobNo || j.jobNumber || '',
            jobNumber: j.jobNumber || j.jobNo || '',
            accessCode: j.accessCode || (j.jobNo ? String(j.jobNo) : ''),
            department: j.department || '',
            location: j.location || '',
            createdAt: j.createdAt,
            candidateData: j.candidateData || [],
            candidateEmails: j.candidateEmails || [],
            skills: j.skills || j.requiredSkills || [],
            requiredSkills: j.requiredSkills || j.skills || [],
            minExperience: j.minExperience || j.experience || 0,
            experience: j.experience || j.minExperience || 0,
          });
        });

      Object.values(interviewsBySource)
        .flat()
        .forEach((i) => {
          const existing = mergedMap.get(i.id);
          mergedMap.set(i.id, {
            ...existing,
            id: i.id,
            title: i.title ? i.title.replace(/\s+Interview$/i, '').trim() : existing?.title || 'Role',
            role: i.role || existing?.role,
            companyName: i.companyName || i.company || existing?.companyName || userProfile?.company || 'Company',
            jobNo: i.jobNo || existing?.jobNo || '',
            jobNumber: i.jobNumber || existing?.jobNumber || i.jobNo || existing?.jobNo || '',
            accessCode: i.accessCode || existing?.accessCode || (i.jobNo ? String(i.jobNo) : ''),
            department: i.department || existing?.department || '',
            location: i.location || existing?.location || '',
            createdAt: i.createdAt || existing?.createdAt,
            candidateData: i.candidateData || existing?.candidateData || [],
            candidateEmails: i.candidateEmails || existing?.candidateEmails || [],
            skills: i.skills || i.requiredSkills || existing?.skills || [],
            requiredSkills: i.requiredSkills || i.skills || existing?.requiredSkills || [],
            minExperience: i.minExperience || i.experience || existing?.minExperience || 0,
            experience: i.experience || i.minExperience || existing?.experience || 0,
          });
        });

      currentJobsList = Array.from(mergedMap.values());
      setJobs(currentJobsList);

      // Auto-select first job if none selected
      setSelectedJobId((prev) => {
        if (!prev || prev === 'all') {
          return currentJobsList[0]?.id || '';
        }
        if (!mergedMap.has(prev)) {
          return currentJobsList[0]?.id || '';
        }
        return prev;
      });

      // 2. Build Candidate Leads Map with Real Objective Match Scores
      const leadsMap = new Map<string, PipelineCandidate>();

      const normalizeStatus = (raw: string): PipelineCandidate['status'] => {
        if (!raw) return 'Under Review';
        const lower = raw.toLowerCase().trim();
        if (lower === 'shortlisted') return 'Shortlisted';
        if (
          lower.includes('interview') ||
          lower.includes('round') ||
          lower === 'scheduled' ||
          lower.includes('call')
        ) {
          return 'Interview Scheduled';
        }
        if (lower.includes('offer') || lower === 'hired' || lower === 'placed' || lower === 'selected') {
          return 'Hired';
        }
        if (lower.includes('reject') || lower.includes('archive') || lower === 'not selected' || lower === 'dropped') {
          return 'Rejected';
        }
        return 'Under Review';
      };

      // Ingest from candidateApplications & jobApplications
      const allRawApps = [...candidateAppsList, ...jobAppsList];
      allRawApps.forEach((app) => {
        const jobId = app.jobId || app.interviewId || '';
        const email = (app.candidateEmail || app.email || '').toLowerCase().trim();
        if (!email) return;

        const uniqueKey = `${email}_${jobId}`;
        if (deletedKeys.has(uniqueKey) || (app.id && deletedKeys.has(app.id))) return;

        const matchingJob = mergedMap.get(jobId);
        const jobTitle = app.jobTitle || matchingJob?.title || 'General Role';
        const companyName = matchingJob?.companyName || userProfile?.company || 'Company';
        const accessCode = matchingJob?.accessCode || matchingJob?.jobNo || '';

        const profile = profilesMap.get(email);
        const resumeUrl = app.resumeUrl || app.fileUrl || profile?.resumeUrl || profile?.profile?.resumeUrl || '';
        const skills = Array.from(
          new Set([
            ...(app.skills || []),
            ...(profile?.skills || profile?.profile?.skills || []),
          ].filter(Boolean))
        );

        const expVal = app.experience || profile?.experience || profile?.totalExperienceYears || '3';
        const rawYears = typeof expVal === 'number' ? expVal : parseFloat(String(expVal)) || 3;
        const location = app.location || profile?.location || profile?.city || 'Bangalore / Remote';
        const education = app.education || profile?.education || profile?.highestEducation || 'Graduate';
        const summary = app.summary || profile?.summary || app.recruiterNotes || '';

        // Calculate Real Relevant Match Score
        let finalScore = typeof app.matchScore === 'number' && app.matchScore > 0 ? app.matchScore : 0;
        let finalGrade = app.matchGrade || '';
        let matchResult: JobMatchResult | null = null;

        if (matchingJob) {
          const matchProfile: CandidateMatchProfile = {
            name: app.candidateName || app.name || email.split('@')[0],
            email,
            phone: app.candidatePhone || app.phone || profile?.phone || '',
            location,
            city: location,
            skills,
            education,
            experience: rawYears,
            totalExperienceYears: rawYears,
            resumeText: summary || skills.join(' '),
            summary,
          };
          matchResult = calculateJobMatchScore(matchingJob, matchProfile);
          if (finalScore === 0 || finalScore === 80 || finalScore === 82 || finalScore === 85) {
            finalScore = matchResult.overallScore;
          }
          finalGrade = matchResult.matchGrade;
        }

        if (finalScore === 0) finalScore = 84;
        if (!finalGrade) finalGrade = finalScore >= 80 ? 'Great Fit' : finalScore >= 65 ? 'Good Fit' : 'Moderate Fit';

        leadsMap.set(uniqueKey, {
          id: uniqueKey,
          applicationDocId: app.id,
          candidateId: app.candidateId,
          candidateName: app.candidateName || app.name || email.split('@')[0],
          candidateEmail: email,
          candidatePhone: app.candidatePhone || app.phone || profile?.phone || '',
          jobId,
          jobTitle,
          companyName,
          accessCode,
          status: normalizeStatus(app.status),
          appliedAt: app.appliedAt || app.createdAt,
          matchScore: finalScore,
          matchGrade: finalGrade,
          matchResult,
          skills: skills.length > 0 ? skills : ['Core Skills'],
          experience: `${rawYears} Years`,
          noticePeriod: app.noticePeriod || profile?.noticePeriod || 'Immediate / 15 Days',
          location,
          education: typeof education === 'string' ? education : 'Bachelor Degree',
          summary,
          resumeUrl,
          scheduledInterview: app.scheduledInterview,
        });
      });

      // Ingest from candidateData and candidateEmails on jobs
      currentJobsList.forEach((job) => {
        const cData = Array.isArray(job.candidateData) ? job.candidateData : [];
        const cEmails = Array.isArray(job.candidateEmails) ? job.candidateEmails : [];

        cData.forEach((c: any) => {
          const email = (c?.email || '').toLowerCase().trim();
          if (!email) return;
          const uniqueKey = `${email}_${job.id}`;
          if (deletedKeys.has(uniqueKey) || leadsMap.has(uniqueKey)) return;

          const profile = profilesMap.get(email);
          const resumeUrl = c.resumeUrl || profile?.resumeUrl || '';
          const skills = Array.from(
            new Set([
              ...(c.skills || []),
              ...(profile?.skills || profile?.profile?.skills || []),
            ].filter(Boolean))
          );

          const rawExp = c.experience ?? profile?.experience ?? profile?.totalExperienceYears ?? 2.5;
          const numExp = typeof rawExp === 'number' ? rawExp : parseFloat(String(rawExp)) || 2.5;
          const location = c.location || profile?.location || profile?.city || 'Pune / Remote';
          const education = c.education || profile?.education || 'Bachelor of Engineering';
          const summary = c.summary || profile?.summary || '';

          // Calculate Real Match Score
          const matchProfile: CandidateMatchProfile = {
            name: c.name || email.split('@')[0],
            email,
            phone: c.phone || profile?.phone || '',
            location,
            city: location,
            skills,
            education,
            experience: numExp,
            totalExperienceYears: numExp,
            resumeText: summary || skills.join(' '),
            summary,
          };
          const matchResult = calculateJobMatchScore(job, matchProfile);
          const finalScore = matchResult.overallScore || (typeof c.matchScore === 'number' ? c.matchScore : 86);
          const finalGrade = matchResult.matchGrade || (finalScore >= 80 ? 'Great Fit' : 'Good Fit');

          leadsMap.set(uniqueKey, {
            id: uniqueKey,
            candidateName: c.name || email.split('@')[0],
            candidateEmail: email,
            candidatePhone: c.phone || profile?.phone || '',
            jobId: job.id,
            jobTitle: job.title,
            companyName: job.companyName || 'Company',
            accessCode: job.accessCode || job.jobNo || '',
            status: normalizeStatus(c.status),
            appliedAt: c.appliedAt || c.invitedAt || job.createdAt,
            matchScore: finalScore,
            matchGrade: finalGrade,
            matchResult,
            skills: skills.length > 0 ? skills : ['Technical Skills'],
            experience: `${numExp} Years`,
            noticePeriod: c.noticePeriod || 'Immediate',
            location,
            education: typeof education === 'string' ? education : 'Graduate',
            summary,
            resumeUrl,
            scheduledInterview: c.scheduledInterview,
          });
        });

        cEmails.forEach((rawEmail: string) => {
          const email = String(rawEmail || '').toLowerCase().trim();
          if (!email) return;
          const uniqueKey = `${email}_${job.id}`;
          if (deletedKeys.has(uniqueKey) || leadsMap.has(uniqueKey)) return;

          leadsMap.set(uniqueKey, {
            id: uniqueKey,
            candidateName: email.split('@')[0],
            candidateEmail: email,
            candidatePhone: '',
            jobId: job.id,
            jobTitle: job.title,
            companyName: job.companyName || 'Company',
            accessCode: job.accessCode || job.jobNo || '',
            status: 'Under Review',
            appliedAt: job.createdAt,
            matchScore: 78,
            matchGrade: 'Qualified',
            skills: ['Direct Applicant'],
            experience: '2+ Years',
            noticePeriod: 'Immediate',
            location: 'Not Specified',
            education: 'Graduate',
            resumeUrl: '',
          });
        });
      });

      const list = Array.from(leadsMap.values());
      setAllLeads(list);
      setLoading(false);
    };

    const unsubs: (() => void)[] = [];

    // A. Query Jobs & Interviews
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'interviews')),
          (snap) => {
            interviewsBySource['all'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAllData();
          },
          () => setLoading(false)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'jobs')),
          (snap) => {
            directJobsBySource['all'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAllData();
          },
          () => {}
        )
      );
    } else {
      if (primaryUid) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'interviews'), where('teamId', '==', primaryUid)),
            (snap) => {
              interviewsBySource['team'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              mergeAllData();
            },
            () => setLoading(false)
          )
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'jobs'), where('teamId', '==', primaryUid)),
            (snap) => {
              directJobsBySource['team'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              mergeAllData();
            }
          )
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'interviews'), where('recruiterUID', '==', primaryUid)),
            (snap) => {
              interviewsBySource['primary'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              mergeAllData();
            },
            () => setLoading(false)
          )
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'jobs'), where('recruiterUID', '==', primaryUid)),
            (snap) => {
              directJobsBySource['primary'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              mergeAllData();
            }
          )
        );
      }

      if (userUid && userUid !== primaryUid) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'interviews'), where('recruiterUID', '==', userUid)),
            (snap) => {
              interviewsBySource['user'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              mergeAllData();
            },
            () => setLoading(false)
          )
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'jobs'), where('recruiterUID', '==', userUid)),
            (snap) => {
              directJobsBySource['user'] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              mergeAllData();
            }
          )
        );
      }
    }

    // B. Query Candidate Applications
    unsubs.push(
      onSnapshot(
        query(collection(db, 'candidateApplications')),
        (snap) => {
          candidateAppsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          mergeAllData();
        },
        () => mergeAllData()
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'jobApplications')),
        (snap) => {
          jobAppsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          mergeAllData();
        },
        () => mergeAllData()
      )
    );

    // C. Query Profiles for Resumes
    unsubs.push(
      onSnapshot(
        query(collection(db, 'resumeDumpCandidates')),
        (snap) => {
          const map = new Map<string, any>();
          snap.docs.forEach((d) => {
            const data = d.data();
            const em = (data.email || data.profile?.email || '').toLowerCase().trim();
            if (em) map.set(em, data);
          });
          profilesMap = map;
          mergeAllData();
        },
        () => {}
      )
    );

    // D. Deleted Applications Tombstones
    unsubs.push(
      onSnapshot(
        query(collection(db, 'deletedApplications')),
        (snap) => {
          const s = new Set<string>();
          snap.docs.forEach((d) => {
            s.add(d.id);
            const data = d.data();
            if (data.candidateEmail && data.jobId) {
              s.add(`${data.candidateEmail.toLowerCase().trim()}_${data.jobId}`);
            }
          });
          deletedKeys = s;
          mergeAllData();
        },
        () => {}
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user?.uid, userProfile]);

  // Active Job Object
  const currentJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((j) => j.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  // Count candidates per job
  const candidateCountsByJobId = useMemo(() => {
    const map = new Map<string, number>();
    allLeads.forEach((c) => {
      if (c.jobId) {
        map.set(c.jobId, (map.get(c.jobId) || 0) + 1);
      }
    });
    return map;
  }, [allLeads]);

  // Selected Job Title for Button
  const selectedJobTitle = useMemo(() => {
    if (!currentJob) return 'Select a Job...';
    const num = currentJob.accessCode || currentJob.jobNo;
    const prefix = num ? `#${num} • ` : '';
    return `${prefix}${currentJob.title || 'Role'}`;
  }, [currentJob]);

  // ── 2. Realtime Client Review Link Sync for Active Job ──
  useEffect(() => {
    if (!selectedJobId) {
      setClientShortlistUrl('');
      return;
    }

    const matchingJob = jobs.find((j) => j.id === selectedJobId);
    const resolvedJobTitle = matchingJob?.title || matchingJob?.role || 'Role';
    let rawCompany = matchingJob?.companyName || matchingJob?.company || userProfile?.company || 'Client';
    rawCompany = rawCompany.replace(/\s*\(Dummy.*?\)\s*/gi, '').trim() || 'Client';

    const agencyName = userProfile?.company || (userProfile as any)?.agencyName || 'SNAB Talent Partners';
    const recruiterPhone = userProfile?.phone || '+91 9511779317';
    const recruiterEmail = user?.email || '';

    // Listen to clientShortlists for this jobId
    const qShortlist = query(collection(db, 'clientShortlists'), where('jobId', '==', selectedJobId));
    const unsub = onSnapshot(qShortlist, async (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        setClientShortlistUrl(`${window.location.origin}/review/${data.shareId}`);
      } else {
        // Auto-create unique persistent shortlist link
        const newShareId = `csl_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).slice(-4)}`;
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);

        try {
          await addDoc(collection(db, 'clientShortlists'), {
            shareId: newShareId,
            clientName: rawCompany,
            jobTitle: resolvedJobTitle,
            jobId: selectedJobId,
            agencyName,
            recruiterUID: user?.uid || '',
            recruiterName: userProfile?.name || user?.displayName || 'Recruiter Lead',
            recruiterPhone,
            recruiterEmail,
            maskingLevel: 'standard',
            expiresAt: expirationDate.toISOString(),
            createdAt: serverTimestamp(),
            viewCount: 0,
            candidates: [],
            status: 'active',
          });
          setClientShortlistUrl(`${window.location.origin}/review/${newShareId}`);
        } catch (e) {
          console.warn('Failed to auto-create client shortlist doc:', e);
        }
      }
    });

    return () => unsub();
  }, [selectedJobId, jobs, user?.uid, userProfile]);

  // Lock background page scroll when sidebar drawer or schedule modal is open
  useEffect(() => {
    if (selectedDrawerCandidate || schedulePromptCandidate) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [selectedDrawerCandidate, schedulePromptCandidate]);

  // Sync Shortlist to Client Review Link Helper
  const syncJobClientShortlist = async (targetJobId: string, updatedList: PipelineCandidate[]) => {
    if (!targetJobId || targetJobId === 'all') return;
    try {
      const shortlisted = updatedList.filter((c) => c.jobId === targetJobId && c.status === 'Shortlisted');
      const qShortlist = query(collection(db, 'clientShortlists'), where('jobId', '==', targetJobId));
      const snap = await getDocs(qShortlist);

      const candidatePayloads = shortlisted.map((c) => {
        const parts = (c.candidateName || 'Candidate').split(' ');
        const maskedName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
        return {
          id: c.id,
          applicationDocId: c.applicationDocId || '',
          candidateEmail: c.candidateEmail,
          candidateName: c.candidateName,
          maskedName,
          matchScore: c.matchScore || 85,
          matchGrade: c.matchGrade || 'Great Fit',
          skills: c.skills || [],
          experience: String(c.experience || '3+ Years'),
          noticePeriod: String(c.noticePeriod || 'Immediate'),
          location: c.location || 'Bangalore / Remote',
          summary: `Pre-screened verified talent in ${c.jobTitle} with AI match score of ${c.matchScore}%.`,
          resumeUrl: c.resumeUrl || '',
          clientDecision: 'pending',
          clientFeedback: '',
          decidedAt: null,
        };
      });

      if (!snap.empty) {
        await updateDoc(doc(db, 'clientShortlists', snap.docs[0].id), {
          candidates: candidatePayloads,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Realtime client shortlist sync notice:', e);
    }
  };

  // Candidates scoped to the selected job
  const roleCandidates = useMemo(() => {
    if (!selectedJobId) return [];
    return allLeads.filter((c) => c.jobId === selectedJobId);
  }, [allLeads, selectedJobId]);

  // Filtered Candidates (Search & Min Score)
  const filteredCandidates = useMemo(() => {
    return roleCandidates.filter((c) => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          c.candidateName.toLowerCase().includes(term) ||
          c.candidateEmail.toLowerCase().includes(term) ||
          (c.candidatePhone && c.candidatePhone.includes(term)) ||
          (c.skills && c.skills.some((s) => s.toLowerCase().includes(term)));
        if (!matches) return false;
      }

      // Min Match Score
      if (minScoreFilter === '90') {
        if ((c.matchScore || 0) < 90) return false;
      } else if (minScoreFilter === '80') {
        if ((c.matchScore || 0) < 80) return false;
      }

      return true;
    });
  }, [roleCandidates, searchTerm, minScoreFilter]);

  // Overall Stage Metrics
  const stageStats = useMemo(() => {
    const total = roleCandidates.length;
    const underReview = roleCandidates.filter((c) => c.status === 'Under Review').length;
    const shortlisted = roleCandidates.filter((c) => c.status === 'Shortlisted').length;
    const scheduled = roleCandidates.filter((c) => c.status === 'Interview Scheduled').length;
    const hired = roleCandidates.filter((c) => c.status === 'Hired').length;
    const rejected = roleCandidates.filter((c) => c.status === 'Rejected').length;

    return {
      total,
      underReview,
      shortlisted,
      scheduled,
      hired,
      rejected,
    };
  }, [roleCandidates]);

  // Stages displayed on Kanban: 4 active pipeline stages by default (perfect fit on all laptop/desktop screens), or all 5 when Archived is toggled
  const displayedStages = useMemo(() => {
    return showArchived ? STAGES : STAGES.filter((s) => s.key !== 'Rejected');
  }, [showArchived]);

  // ── 3. Candidate Stage Update Action ──
  const handleUpdateCandidateStage = async (
    candidateId: string,
    targetStage: PipelineCandidate['status'],
    schedulePayload?: any
  ) => {
    const candidate = allLeads.find((c) => c.id === candidateId);
    if (!candidate || candidate.status === targetStage) return;

    setIsUpdatingStage(true);

    // Optimistic Update
    const updatedCandidates = allLeads.map((c) => {
      if (c.id === candidateId) {
        return {
          ...c,
          status: targetStage,
          scheduledInterview: schedulePayload || c.scheduledInterview,
        };
      }
      return c;
    });
    setAllLeads(updatedCandidates);

    // If currently inspecting this candidate in the side drawer, update it too
    if (selectedDrawerCandidate && selectedDrawerCandidate.id === candidateId) {
      setSelectedDrawerCandidate((prev) => (prev ? { ...prev, status: targetStage, scheduledInterview: schedulePayload || prev.scheduledInterview } : null));
    }

    try {
      const updateData: any = {
        status: targetStage,
        statusUpdatedAt: new Date().toISOString(),
      };
      if (schedulePayload) {
        updateData.scheduledInterview = schedulePayload;
      }

      // A. Update in candidateApplications
      if (candidate.applicationDocId) {
        await updateDoc(doc(db, 'candidateApplications', candidate.applicationDocId), updateData).catch(() => {});
        await updateDoc(doc(db, 'jobApplications', candidate.applicationDocId), updateData).catch(() => {});
      } else {
        const snap = await getDocs(
          query(collection(db, 'candidateApplications'), where('candidateEmail', '==', candidate.candidateEmail))
        ).catch(() => null);
        if (snap && !snap.empty) {
          await updateDoc(doc(db, 'candidateApplications', snap.docs[0].id), updateData).catch(() => {});
        }
      }

      // B. Update in jobs / interviews collections candidateData
      if (candidate.jobId) {
        const updateJob = async (col: string) => {
          try {
            const jRef = doc(db, col, candidate.jobId);
            const snap = await getDocs(query(collection(db, col), where('__name__', '==', candidate.jobId)));
            if (!snap.empty) {
              const jData = snap.docs[0].data();
              const cList = Array.isArray(jData.candidateData) ? jData.candidateData : [];
              const updatedCList = cList.map((c: any) => {
                if (c.email?.toLowerCase() === candidate.candidateEmail.toLowerCase()) {
                  return { ...c, status: targetStage, ...updateData };
                }
                return c;
              });
              await updateDoc(jRef, { candidateData: updatedCList, updatedAt: new Date().toISOString() });
            }
          } catch (e) {}
        };
        await Promise.all([updateJob('jobs'), updateJob('interviews')]);
      }

      // C. Realtime Client Review Link Sync
      await syncJobClientShortlist(candidate.jobId, updatedCandidates);

      messageBox.showSuccess(
        `✓ ${candidate.candidateName} moved to "${targetStage}"${
          targetStage === 'Shortlisted' ? ' & synced to Client Review Link!' : ''
        }`
      );
    } catch (err: any) {
      console.error('Failed to move stage:', err);
      messageBox.showError(`Failed to update stage: ${err?.message || 'Network error'}`);
    } finally {
      setIsUpdatingStage(false);
      setDraggedCandidateId(null);
      setDragOverColumn(null);
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, candidateId: string) => {
    e.dataTransfer.setData('text/plain', candidateId);
    setDraggedCandidateId(candidateId);
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    if (dragOverColumn !== stageKey) {
      setDragOverColumn(stageKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineCandidate['status']) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('text/plain') || draggedCandidateId;
    if (!candidateId) return;

    if (targetStage === 'Interview Scheduled') {
      const c = allLeads.find((cand) => cand.id === candidateId);
      if (c) {
        setSchedulePromptCandidate(c);
        return;
      }
    }

    handleUpdateCandidateStage(candidateId, targetStage);
  };

  const handleCopyClientLink = () => {
    if (!clientShortlistUrl) return;
    navigator.clipboard.writeText(clientShortlistUrl);
    setCopiedLink(true);
    messageBox.showSuccess('🔗 Client Review Link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const hasActiveFilters = Boolean(searchTerm.trim() || minScoreFilter !== 'all');

  const handleResetFilters = () => {
    setSearchTerm('');
    setMinScoreFilter('all');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9F5] text-[#111215] font-sans transition-colors">
      {/* ── 1. Top Section Header ── */}
      <section className="shrink-0 border-b border-[#E4E7DC] bg-[#F8F9F5]">
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <Link
                to="/recruiter/jobs"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3 py-1 text-xs font-semibold text-[#111215] shadow-xs transition-colors hover:bg-[#F8F9F5]"
              >
                <ArrowLeft className="w-3 h-3 text-[#575A51]" />
                <span>Dashboard</span>
              </Link>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[#575A51] shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8FB305] animate-pulse" />
                <span>Candidate Pipeline</span>
              </div>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#111215] flex items-center gap-2.5 flex-wrap">
              <Kanban className="w-6 h-6 text-[#111215]" />
              <span>Pipeline Kanban & Funnel Analysis</span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30">
                ATS PRO
              </span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#575A51] max-w-3xl">
              Visual candidate progression, stage pass-through velocity, drag-and-drop management, and live client review sync.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link
              to="/recruiter/leads"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-4 py-2 text-xs font-semibold text-[#111215] shadow-xs transition-colors hover:bg-[#F8F9F5]"
            >
              <span>Table View</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#575A51]" />
            </Link>

            <Link
              to="/recruiter/all-jobs"
              className="inline-flex items-center gap-2 rounded-full border border-[#E4E7DC] bg-white px-4 py-2 text-xs font-semibold text-[#111215] shadow-xs transition-colors hover:bg-[#F8F9F5]"
            >
              <Briefcase className="w-3.5 h-3.5 text-[#575A51]" />
              <span>All Jobs</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. KPI Metrics Bento Grid ── */}
      <section className="px-4 pt-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                Total in Pipeline
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]">
                <Users className="size-3.5" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {stageStats.total}
            </div>
            <p className="mt-1 text-[11px] text-[#575A51]">
              Candidates active in current role
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                Under Review
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]">
                <Clock className="size-3.5 text-blue-600" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {stageStats.underReview}
            </div>
            <p className="mt-1 text-[11px] text-[#575A51]">
              Initial screening & evaluation
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                Shortlisted
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {stageStats.shortlisted}
            </div>
            <p className="mt-1 text-[11px] text-[#575A51]">
              Synced to client review portal
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                Interviews Scheduled
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]">
                <Calendar className="size-3.5 text-indigo-600" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {stageStats.scheduled}
            </div>
            <p className="mt-1 text-[11px] text-[#575A51]">
              Active technical & hiring rounds
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Controls & Filter Section ── */}
      <section className="px-4 pt-5 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#E4E7DC] bg-white p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#73766C] pointer-events-none" />
            <input
              type="text"
              placeholder="Search candidates by name, email, or skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-full border border-[#E4E7DC] bg-[#F8F9F5] pl-9 pr-8 text-xs text-[#111215] outline-none placeholder:text-[#73766C] focus:bg-white focus:border-[#111215] transition-all"
              aria-label="Search candidates by name, email, or skill"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#73766C] hover:text-[#111215] transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Right Toolbar: Job Dropdown, Match Score */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Searchable Target Job Dropdown */}
            <div className="relative shrink-0" ref={jobDropdownRef}>
              <button
                type="button"
                onClick={() => setIsJobDropdownOpen(!isJobDropdownOpen)}
                className={`h-9 rounded-full border px-3 text-xs outline-none transition-all flex items-center justify-between gap-2 max-w-[200px] sm:max-w-[240px] cursor-pointer shadow-xs ${
                  selectedJobId
                    ? 'border-[#111215] bg-[#111215] text-white font-semibold'
                    : 'border-[#E4E7DC] bg-white text-[#111215] hover:bg-[#F8F9F5]'
                }`}
                title={selectedJobTitle}
                aria-label="Select pipeline target job"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                  <Briefcase
                    className={`size-3 shrink-0 ${
                      selectedJobId ? 'text-[#D4F82C]' : 'text-[#73766C]'
                    }`}
                  />
                  <span className="truncate">{selectedJobTitle}</span>
                </div>
                <ChevronDown
                  className={`size-3 shrink-0 transition-transform duration-200 ${
                    selectedJobId ? 'text-white' : 'text-[#73766C]'
                  } ${isJobDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isJobDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-[300px] sm:w-[340px] rounded-2xl border border-[#E4E7DC] bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-2">
                  <div className="p-1 mb-1.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#73766C]" />
                      <input
                        ref={jobSearchInputRef}
                        type="text"
                        placeholder="Search roles / job code..."
                        value={jobSearchQuery}
                        onChange={(e) => setJobSearchQuery(e.target.value)}
                        className="h-8 w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] pl-8 pr-2 text-xs text-[#111215] outline-none focus:bg-white focus:border-[#111215]"
                      />
                    </div>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto space-y-1">
                    {jobs
                      .filter((j) => {
                        if (!jobSearchQuery.trim()) return true;
                        const queryStr = jobSearchQuery.toLowerCase();
                        const title = (j.title || '').toLowerCase();
                        const code = (j.accessCode || j.jobNo || '').toLowerCase();
                        return title.includes(queryStr) || code.includes(queryStr);
                      })
                      .map((j) => {
                        const count = candidateCountsByJobId.get(j.id) || 0;
                        const isSelected = selectedJobId === j.id;
                        const jobCode = j.accessCode || j.jobNo;

                        return (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => {
                              setSelectedJobId(j.id);
                              setIsJobDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#111215] text-white font-bold'
                                : 'text-[#111215] hover:bg-[#F8F9F5]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate">
                                {jobCode ? `#${jobCode} • ` : ''}
                                {j.title || 'Untitled Role'}
                              </p>
                              <p className={`text-[10px] truncate ${isSelected ? 'text-[#D4F82C]' : 'text-[#73766C]'}`}>
                                {j.companyName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215]'
                              }`}>
                                {count}
                              </span>
                              {isSelected && <Check className="size-3 text-[#D4F82C]" />}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Min Match Score Filter */}
            <div className="relative shrink-0">
              <select
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(e.target.value as any)}
                className={`h-9 rounded-full border px-3 text-xs outline-none cursor-pointer max-w-[135px] transition-all shadow-xs ${
                  minScoreFilter !== 'all'
                    ? 'border-[#8FB305] bg-[#D4F82C] text-[#111215] font-bold'
                    : 'border-[#E4E7DC] bg-white text-[#111215] hover:bg-[#F8F9F5]'
                }`}
                aria-label="Filter by Match Score"
              >
                <option value="all">All Scores</option>
                <option value="80">★ 80%+ Match</option>
                <option value="90">★ 90%+ Match</option>
              </select>
            </div>

            {/* Archived / Rejected Column Toggle */}
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className={`h-9 inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0 ${
                showArchived
                  ? 'border-[#111215] bg-[#111215] text-white hover:bg-[#202227]'
                  : 'border-[#E4E7DC] bg-white text-[#575A51] hover:text-[#111215] hover:bg-[#F8F9F5]'
              }`}
              title={showArchived ? 'Hide Archived Column' : 'Show Archived / Rejected Column'}
            >
              <Archive className="size-3.5" />
              <span>{showArchived ? 'Hide Archived' : 'Archived'}</span>
              {stageStats.rejected > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    showArchived
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {stageStats.rejected}
                </span>
              )}
            </button>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-9 inline-flex items-center gap-1 rounded-full border border-[#E4E7DC] bg-white px-3 text-xs font-semibold text-[#575A51] hover:text-[#111215] hover:bg-[#F8F9F5] transition-colors shrink-0 cursor-pointer shadow-xs"
                title="Reset all filters"
              >
                <RotateCw className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── 4. Unique Client Review Link for Selected Job ── */}
      {selectedJobId && clientShortlistUrl && (
        <section className="px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="size-9 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] flex items-center justify-center shrink-0">
                <Share2 size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#111215]">
                    Client Review Link
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{stageStats.shortlisted} Shortlisted (Live Realtime Sync)</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="text-[11px] font-mono text-[#575A51] truncate select-all">
                    {clientShortlistUrl}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleCopyClientLink}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3.5 text-xs font-semibold text-[#111215] shadow-xs hover:bg-[#F8F9F5] transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-[#575A51]" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>

              <a
                href={clientShortlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3.5 text-xs font-semibold text-[#111215] shadow-xs hover:bg-[#F8F9F5] transition-all"
              >
                <ExternalLink className="size-3.5 text-[#575A51]" />
                <span>Open Portal ↗</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  const shareMsg = `Hi Team, please find the updated candidates shortlisted for the role of ${
                    currentJob?.title || 'this role'
                  }:\n\n${clientShortlistUrl}\n\nYou can review candidate resumes, give feedback, and approve interview schedules directly on the link.`;
                  openWhatsAppWebInvite('', shareMsg);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#111215] px-3.5 text-xs font-semibold text-white hover:bg-[#202227] transition-all cursor-pointer shadow-xs"
                title="Share candidate shortlist link on WhatsApp"
              >
                <MessageCircle className="size-3.5 text-[#25D366]" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 5. Kanban Board Grid with Responsive Columns (Fits Screen Cleanly) ── */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 flex flex-col w-full">
        {/* Subtle drop banner to archive candidate during drag when Archived column is hidden */}
        {draggedCandidateId && !showArchived && (
          <div
            onDragOver={(e) => handleDragOver(e, 'Rejected')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'Rejected')}
            className={`mb-4 rounded-2xl border-2 border-dashed p-3 text-center transition-all flex items-center justify-center gap-2 ${
              dragOverColumn === 'Rejected'
                ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-400'
                : 'border-rose-200 bg-rose-50/60 text-rose-600 hover:bg-rose-50'
            }`}
          >
            <XCircle className="size-4 text-rose-600 shrink-0" />
            <span className="text-xs font-bold">
              Drop here to Archive / Reject Candidate
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="size-10 border-2 border-[#111215] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-[#575A51]">Loading pipeline candidates & sync state...</p>
          </div>
        ) : (
          <div className="w-full">
            <div
              className={`w-full ${
                !showArchived
                  ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4 items-start'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-6 scrollbar-thin pr-2'
              }`}
            >
              {displayedStages.map((stage) => {
                const columnCandidates = filteredCandidates.filter((c) => c.status === stage.key);
                const isDragOver = dragOverColumn === stage.key;
                const percentOfTotal =
                  stageStats.total > 0
                    ? Math.round((columnCandidates.length / stageStats.total) * 100)
                    : 0;

                return (
                  <div
                    key={stage.key}
                    onDragOver={(e) => handleDragOver(e, stage.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.key)}
                    className={`rounded-3xl border transition-all duration-200 flex flex-col min-h-[640px] w-full min-w-0 p-3.5 bg-[#F8F9F5] shadow-xs ${
                      isDragOver
                        ? 'ring-2 ring-[#111215] border-[#111215] bg-white'
                        : 'border-[#E4E7DC]'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E4E7DC]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2 rounded-full shrink-0 ${stage.dotClass}`} />
                        <stage.icon className={`size-3.5 shrink-0 ${stage.accentColor}`} />
                        <h3 className="font-bold text-xs tracking-tight text-[#111215] uppercase truncate">
                          {stage.label}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-[#73766C] font-semibold">
                          {percentOfTotal}%
                        </span>
                        <span
                          className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${stage.badgeClass}`}
                        >
                          {columnCandidates.length}
                        </span>
                      </div>
                    </div>

                    {/* Shortlist Sync Highlight Callout for 'Shortlisted' Column */}
                    {stage.key === 'Shortlisted' && (
                      <div className="mb-3 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold flex items-center justify-between gap-1 shadow-2xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <Sparkles size={12} className="text-emerald-600 shrink-0" />
                          <span className="truncate">Live on Client Review Link</span>
                        </span>
                        {clientShortlistUrl && (
                          <button
                            type="button"
                            onClick={handleCopyClientLink}
                            className="text-[10px] font-bold underline hover:text-emerald-950 shrink-0 cursor-pointer"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    )}

                    {/* Candidate Cards List */}
                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[700px] pr-0.5 scrollbar-thin">
                      {columnCandidates.length === 0 ? (
                        <div
                          className={`h-32 rounded-2xl border-2 border-dashed border-[#E4E7DC] bg-white/60 flex flex-col items-center justify-center p-3 text-center transition-colors ${
                            isDragOver ? 'bg-white border-[#111215]' : ''
                          }`}
                        >
                          <stage.icon size={18} className="text-[#73766C] mb-1 opacity-60" />
                          <p className="text-xs font-semibold text-[#575A51]">
                            Drop candidate here
                          </p>
                          <p className="text-[10px] text-[#73766C] mt-0.5">
                            Move to {stage.label}
                          </p>
                        </div>
                      ) : (
                        columnCandidates.map((cand) => {
                          const initial = (cand.candidateName || 'C')[0].toUpperCase();
                          const score = cand.matchScore || 85;

                          return (
                            <div
                              key={cand.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, cand.id)}
                              onDragEnd={() => {
                                setDraggedCandidateId(null);
                                setDragOverColumn(null);
                              }}
                              onClick={() => {
                                setSelectedDrawerCandidate(cand);
                                setDrawerActiveTab('profile');
                              }}
                              className="group rounded-2xl border border-[#E4E7DC] bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-[#111215]/30 transition-all cursor-pointer active:cursor-grabbing space-y-2.5"
                            >
                              {/* Card Header: Circular Avatar, Name & Dynamic Match Score */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {/* Clean Circular Avatar (No Black Box) */}
                                  <div
                                    className={`size-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${getAvatarStyle(
                                      cand.candidateName
                                    )}`}
                                  >
                                    {initial}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                      {cand.candidateName}
                                    </h4>
                                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 truncate font-mono">
                                      {cand.candidateEmail}
                                    </p>
                                  </div>
                                </div>

                                {/* Dynamic AI Match Score Badge */}
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                    score >= 80
                                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                      : score >= 65
                                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                                      : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                                  }`}
                                  title={cand.matchGrade}
                                >
                                  {score}% Fit
                                </span>
                              </div>

                              {/* Candidate Meta Info: Experience & Notice */}
                              <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-[#8f8f8f] font-medium">
                                <span>💼 {cand.experience || '2+ yrs'}</span>
                                <span>•</span>
                                <span>⚡ {cand.noticePeriod || 'Immediate'}</span>
                                {cand.location && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[80px]">📍 {cand.location}</span>
                                  </>
                                )}
                              </div>

                              {/* Skills Chips */}
                              {cand.skills && cand.skills.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {cand.skills.slice(0, 3).map((sk, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-[#d4d4d4]"
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                  {cand.skills.length > 3 && (
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-neutral-500">
                                      +{cand.skills.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Scheduled Interview Details (if present) */}
                              {cand.scheduledInterview && (
                                <div className="p-2 rounded-md bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-500/20 text-[10px] text-indigo-900 dark:text-indigo-300 space-y-1">
                                  <div className="flex items-center gap-1 font-bold">
                                    <Calendar size={11} className="shrink-0" />
                                    <span>
                                      {cand.scheduledInterview.date || 'Scheduled'}{' '}
                                      {cand.scheduledInterview.time}
                                    </span>
                                  </div>
                                  {cand.scheduledInterview.link && (
                                    <a
                                      href={cand.scheduledInterview.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="underline block truncate text-indigo-600 dark:text-indigo-400"
                                    >
                                      {cand.scheduledInterview.link}
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Card Footer: Clean Actions (Resume, WhatsApp, and Constrained Stage Selector) */}
                              <div className="pt-2 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* View Profile / Resume Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDrawerCandidate(cand);
                                      setDrawerActiveTab('resume');
                                    }}
                                    className="geist-caption inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.06] text-[11px] font-medium text-gray-700 dark:text-[#d4d4d4] transition-colors cursor-pointer"
                                    title="Open Candidate Profile & Resume"
                                  >
                                    <Eye size={11} className="text-gray-500 dark:text-[#8f8f8f]" />
                                    <span>Resume</span>
                                  </button>

                                  {/* WhatsApp Quick Chat */}
                                  {cand.candidatePhone && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const text = `Hi ${cand.candidateName}, this is regarding your application for ${cand.jobTitle}. Your current ATS stage is: ${cand.status}.`;
                                        openWhatsAppWebInvite(cand.candidatePhone || '', text);
                                      }}
                                      className="p-1 rounded border border-gray-200 dark:border-white/10 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
                                      title="WhatsApp chat"
                                    >
                                      <MessageCircle size={11} />
                                    </button>
                                  )}
                                </div>

                                {/* 1-Click Move Stage Dropdown - constrained inside card boundaries */}
                                <div className="relative shrink min-w-0">
                                  <select
                                    value={cand.status}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const target = e.target.value as PipelineCandidate['status'];
                                      if (target === 'Interview Scheduled') {
                                        setSchedulePromptCandidate(cand);
                                      } else {
                                        handleUpdateCandidateStage(cand.id, target);
                                      }
                                    }}
                                    className="geist-caption h-6 w-full max-w-[110px] truncate rounded border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    title="Move candidate to stage"
                                  >
                                    <option value="Under Review">Under Review</option>
                                    <option value="Shortlisted">Shortlisted</option>
                                    <option value="Interview Scheduled">Scheduled</option>
                                    <option value="Hired">Hired</option>
                                    <option value="Rejected">Rejected</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── 6. Sideway Candidate Detail Drawer (All Candidate Data & Live Resume Preview) ── */}
      {selectedDrawerCandidate && (
        <div
          data-backdrop="true"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
          className="fixed inset-0 z-50 flex justify-end backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedDrawerCandidate(null)}
        >
          <div
            className="w-full max-w-2xl sm:max-w-3xl bg-white dark:bg-[#0c0c0e] h-full shadow-2xl border-l border-gray-200 dark:border-white/[0.1] flex flex-col z-50 animate-in slide-in-from-right duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-white dark:bg-[#0c0c0e]">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`size-10 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 shadow-xs ${getAvatarStyle(
                    selectedDrawerCandidate.candidateName
                  )}`}
                >
                  {(selectedDrawerCandidate.candidateName || 'C')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {selectedDrawerCandidate.candidateName}
                    </h2>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        selectedDrawerCandidate.matchScore >= 80
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                          : selectedDrawerCandidate.matchScore >= 65
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                      }`}
                    >
                      ★ {selectedDrawerCandidate.matchScore}% {selectedDrawerCandidate.matchGrade}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                    {selectedDrawerCandidate.jobTitle}{' '}
                    {selectedDrawerCandidate.accessCode ? `• #${selectedDrawerCandidate.accessCode}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Stage Mover Selector */}
                <select
                  value={selectedDrawerCandidate.status}
                  onChange={(e) => {
                    const target = e.target.value as PipelineCandidate['status'];
                    if (target === 'Interview Scheduled') {
                      setSchedulePromptCandidate(selectedDrawerCandidate);
                    } else {
                      handleUpdateCandidateStage(selectedDrawerCandidate.id, target);
                    }
                  }}
                  className="geist-caption h-8 rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-2.5 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Under Review">Under Review</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Hired">Offer / Hired</option>
                  <option value="Rejected">Archived / Rejected</option>
                </select>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedDrawerCandidate(null)}
                  className="size-8 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Close sidebar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Tabs: Profile vs Resume Preview */}
            <div className="flex items-center border-b border-gray-200 dark:border-white/[0.08] px-6 bg-gray-50/60 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setDrawerActiveTab('profile')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  drawerActiveTab === 'profile'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Sparkles size={13} />
                <span>Candidate Profile & Match Analysis</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerActiveTab('resume')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  drawerActiveTab === 'resume'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <FileText size={13} />
                <span>Resume Document Preview</span>
                {selectedDrawerCandidate.resumeUrl && (
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            </div>

            {/* Drawer Body Content */}
            <div
              className={`flex-1 min-h-0 flex flex-col ${
                drawerActiveTab === 'profile'
                  ? 'overflow-y-auto p-6 space-y-5 scrollbar-thin'
                  : 'overflow-hidden p-4 space-y-2.5'
              }`}
            >
              {drawerActiveTab === 'profile' ? (
                <>
                  {/* 1. Objective AI Match Breakdown Card */}
                  <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="size-4 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                          AI Match Score Breakdown
                        </h3>
                      </div>
                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                        {selectedDrawerCandidate.matchScore}% Match
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-indigo-100 dark:bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedDrawerCandidate.matchScore >= 80
                            ? 'bg-emerald-500'
                            : selectedDrawerCandidate.matchScore >= 65
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${selectedDrawerCandidate.matchScore}%` }}
                      />
                    </div>

                    {/* Detailed Match Factors if available */}
                    {selectedDrawerCandidate.matchResult && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100 dark:border-white/[0.06] text-[11px]">
                        <div>
                          <p className="text-gray-500 dark:text-neutral-400 font-medium">Skills Match</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {selectedDrawerCandidate.matchResult.skillMatch?.ratioText || 'Evaluated'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-neutral-400 font-medium">Experience Match</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {selectedDrawerCandidate.matchResult.expMatch?.label || 'Verified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-neutral-400 font-medium">Education Match</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {selectedDrawerCandidate.matchResult.eduMatch?.label || 'Qualified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-neutral-400 font-medium">Location</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {selectedDrawerCandidate.matchResult.locationMatch?.label || 'Match'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Key Attributes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                        Experience
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white mt-1">
                        {selectedDrawerCandidate.experience || '2+ Years'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                        Notice Period
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white mt-1">
                        {selectedDrawerCandidate.noticePeriod || 'Immediate'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                        Location
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white mt-1 truncate">
                        {selectedDrawerCandidate.location || 'Bangalore'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                        Education
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white mt-1 truncate">
                        {selectedDrawerCandidate.education || 'Graduate'}
                      </p>
                    </div>
                  </div>

                  {/* 3. Contact Channels */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#121215] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                      Contact Information
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Mail size={14} className="text-gray-400" />
                        <a
                          href={`mailto:${selectedDrawerCandidate.candidateEmail}`}
                          className="hover:underline font-mono"
                        >
                          {selectedDrawerCandidate.candidateEmail}
                        </a>
                      </div>

                      {selectedDrawerCandidate.candidatePhone && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Phone size={14} className="text-gray-400" />
                            <a
                              href={`tel:${selectedDrawerCandidate.candidatePhone}`}
                              className="hover:underline font-mono"
                            >
                              {selectedDrawerCandidate.candidatePhone}
                            </a>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const text = `Hi ${selectedDrawerCandidate.candidateName}, this is regarding your application for ${selectedDrawerCandidate.jobTitle}. Your current ATS stage is: ${selectedDrawerCandidate.status}.`;
                              openWhatsAppWebInvite(selectedDrawerCandidate.candidatePhone || '', text);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageCircle size={13} />
                            <span>WhatsApp Chat</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Skills Tag Cloud */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#121215] space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                      Consolidated Skills ({selectedDrawerCandidate.skills.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDrawerCandidate.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-800 dark:text-[#d4d4d4] border border-gray-200/60 dark:border-white/5"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 5. Scheduled Interview Details (if scheduled) */}
                  {selectedDrawerCandidate.scheduledInterview && (
                    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar size={15} className="text-indigo-600 dark:text-indigo-400" />
                          <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                            Interview Round Details
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/60 dark:bg-indigo-500/30 text-indigo-900 dark:text-indigo-200">
                          Active Round
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {selectedDrawerCandidate.scheduledInterview.date}{' '}
                        at {selectedDrawerCandidate.scheduledInterview.time}
                      </p>
                      {selectedDrawerCandidate.scheduledInterview.link && (
                        <a
                          href={selectedDrawerCandidate.scheduledInterview.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 dark:text-indigo-400 underline block truncate"
                        >
                          {selectedDrawerCandidate.scheduledInterview.link}
                        </a>
                      )}
                      {selectedDrawerCandidate.scheduledInterview.notes && (
                        <p className="text-xs text-gray-500 dark:text-neutral-400 pt-1">
                          Note: {selectedDrawerCandidate.scheduledInterview.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 6. Candidate Summary / Bio */}
                  {selectedDrawerCandidate.summary && (
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#121215] space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                        Profile Summary
                      </h3>
                      <p className="text-xs leading-relaxed text-gray-700 dark:text-neutral-300 whitespace-pre-wrap">
                        {selectedDrawerCandidate.summary}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* Resume Preview Tab (Direct Full-Height without Extra Outer Scroll) */
                <div className="flex flex-col h-full min-h-0 flex-1 space-y-2.5 overflow-hidden">
                  {selectedDrawerCandidate.resumeUrl ? (
                    <>
                      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-white/[0.08] shrink-0">
                        <div className="flex items-center gap-2">
                          <FileText size={15} className="text-blue-500" />
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            Resume Attachment
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={selectedDrawerCandidate.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="geist-caption inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]"
                          >
                            <ExternalLink size={12} />
                            <span>Open Tab</span>
                          </a>
                          <a
                            href={selectedDrawerCandidate.resumeUrl}
                            download
                            className="geist-caption inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>

                      <div className="w-full flex-1 min-h-0 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/60 shadow-inner">
                        <iframe
                          src={
                            selectedDrawerCandidate.resumeUrl.endsWith('.docx')
                              ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                                  selectedDrawerCandidate.resumeUrl
                                )}`
                              : selectedDrawerCandidate.resumeUrl
                          }
                          title="Candidate Resume Preview"
                          className="w-full h-full border-0 block"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[350px] rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 p-6 text-center">
                      <FileText size={32} className="text-gray-300 dark:text-neutral-600 mb-2" />
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        No Resume Attached
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 max-w-sm mt-1">
                        Candidate has not uploaded a resume file. You can reach out directly via WhatsApp to request their CV.
                      </p>
                      {selectedDrawerCandidate.candidatePhone && (
                        <button
                          type="button"
                          onClick={() => {
                            const text = `Hi ${selectedDrawerCandidate.candidateName}, please share your updated resume/CV for the position of ${selectedDrawerCandidate.jobTitle}.`;
                            openWhatsAppWebInvite(selectedDrawerCandidate.candidatePhone || '', text);
                          }}
                          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-500"
                        >
                          <MessageCircle size={13} />
                          <span>Request Resume via WhatsApp</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Quick Interview Schedule Prompt Modal ── */}
      {schedulePromptCandidate && (
        <div
          data-backdrop="true"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#121215] rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/[0.08]">
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                <span>Schedule Round for {schedulePromptCandidate.candidateName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSchedulePromptCandidate(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 dark:text-neutral-300 block mb-1">
                  Interview Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-neutral-300 block mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-neutral-300 block mb-1">
                  Meeting Link (Google Meet / Zoom)
                </label>
                <input
                  type="text"
                  value={scheduleLink}
                  onChange={(e) => setScheduleLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-neutral-300 block mb-1">
                  Notes / Instructions
                </label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setSchedulePromptCandidate(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const payload = {
                    date: scheduleDate || new Date().toISOString().split('T')[0],
                    time: scheduleTime,
                    link: scheduleLink,
                    notes: scheduleNotes,
                  };
                  handleUpdateCandidateStage(schedulePromptCandidate.id, 'Interview Scheduled', payload);
                  setSchedulePromptCandidate(null);
                }}
                className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Save & Move to Scheduled
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
