import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Interview } from '../types';
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  ClipboardList,
  ListChecks,
  Video,
  Clock,
  Users,
  Activity,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';
import { getRateLimitReachedMessage, isRateLimitReached, RateLimitResource } from '../services/rateLimitService';
import { useMessageBox } from '../components/MessageBox';
import { RecruiterTeamPanel } from '../components/RecruiterTeamPanel';
import { StackedTileChart } from '../components/StackedTileChart';
import { isJobStatusActive, fetchJobFetchedApiJobs } from '../services/jobResolutionService';

type TimestampLike =
  | {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
    }
  | Date
  | string
  | null
  | undefined;

interface RecruiterJobRecord {
  id: string;
  title?: string;
  companyName?: string;
  location?: string;
  category?: string;
  employmentType?: string;
  status?: string;
  isActive?: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  postedAt?: TimestampLike;
  applyDeadline?: TimestampLike;
  recruiterUID?: string;
  candidateEmails?: string[];
}

interface RecruiterInterviewRecord extends Partial<Interview> {
  id: string;
  recruiterUID?: string;
  title?: string;
  description?: string;
  department?: string;
  employmentType?: string;
  status?: string;
  isActive?: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  deadline?: TimestampLike;
  candidateEmails?: string[];
  isMock?: boolean;
}

interface RecruiterTestRecord {
  id: string;
  title?: string;
  createdAt?: TimestampLike;
  questions?: unknown[];
}

interface InterviewAttemptRecord {
  id: string;
  interviewId?: string;
  submittedAt?: TimestampLike;
}

interface DashboardRoleEntry {
  id: string;
  title: string;
  location: string;
  companyName?: string;
  category?: string;
  employmentType?: string;
  status?: string;
  isActive?: boolean;
  createdAt?: TimestampLike;
  deadline?: TimestampLike;
  sourceLabel: 'Job Post' | 'Interview' | 'Synced';
  hasJobDoc: boolean;
  hasInterviewDoc: boolean;
  candidateEmails: string[];
}

const toMillis = (value: TimestampLike): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const formatDate = (value: TimestampLike, options?: Intl.DateTimeFormatOptions): string => {
  const millis = toMillis(value);
  if (!millis) return 'N/A';
  return new Date(millis).toLocaleDateString('en-GB', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const normalizeInterviewTitle = (title?: string) => {
  if (!title) return 'Untitled Role';
  return title.replace(/\s+Interview$/i, '').trim() || 'Untitled Role';
};

const getLocalDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SkeletonBlock = ({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`animate-pulse rounded-xl bg-[#E4E7DC]/70 ${className}`} {...props} />
);

export const RecruiterDashboardSkeleton = () => (
  <div className="w-full min-h-screen bg-[#F8F9F5] p-4 sm:p-6 lg:p-8 space-y-6">
    {/* Header Skeleton */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E4E7DC] pb-6">
      <div>
        <SkeletonBlock className="h-5 w-40 rounded-full" />
        <SkeletonBlock className="mt-3 h-8 w-72" />
        <SkeletonBlock className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-2">
        <SkeletonBlock className="h-9 w-28 rounded-full" />
        <SkeletonBlock className="h-9 w-36 rounded-full" />
      </div>
    </div>

    {/* Metric Cards Skeleton */}
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-[#E4E7DC] bg-white p-5 space-y-3">
          <div className="flex justify-between items-center">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-7 w-7 rounded-lg" />
          </div>
          <SkeletonBlock className="h-7 w-12" />
          <SkeletonBlock className="h-4 w-20 rounded-full" />
        </div>
      ))}
    </div>

    {/* Middle Section Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      <div className="lg:col-span-8 rounded-3xl border border-[#E4E7DC] bg-white p-6 space-y-4">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
      </div>
      <div className="lg:col-span-4 rounded-3xl border border-[#E4E7DC] bg-white p-6 space-y-4">
        <SkeletonBlock className="h-5 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>

    {/* Table Skeleton */}
    <div className="rounded-3xl border border-[#E4E7DC] bg-white p-6 space-y-4">
      <SkeletonBlock className="h-6 w-44" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

const RecruiterDashboard: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { status: rateLimitStatus } = useCompanyRateLimits();
  const messageBox = useMessageBox();
  const [jobDocs, setJobDocs] = useState<RecruiterJobRecord[]>([]);
  const [interviews, setInterviews] = useState<RecruiterInterviewRecord[]>([]);
  const [tests, setTests] = useState<RecruiterTestRecord[]>([]);
  const [attempts, setAttempts] = useState<InterviewAttemptRecord[]>([]);
  const [apiJobs, setApiJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [tileTimeRange, setTileTimeRange] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  useEffect(() => {
    if (!user) {
      setJobDocs([]);
      setInterviews([]);
      setApiJobs([]);
      setTests([]);
      setAttempts([]);
      setLoadingJobs(false);
      setLoadingInterviews(false);
      setLoadingTests(false);
      setLoadingAttempts(false);
      return;
    }

    setLoadingJobs(true);
    setLoadingInterviews(true);
    setLoadingTests(true);

    const userUid = user?.uid;
    const primaryUid = userProfile?.parentRecruiterId || (userProfile as any)?.primaryRecruiterUID || userProfile?.teamId || userUid || '';
    const isAdmin = (userProfile?.role || '').toLowerCase() === 'admin';

    fetchJobFetchedApiJobs(primaryUid || userUid || 'pbbMTYxPDaf7jhc9uPEZ34CcWfz2')
      .then((jobs) => setApiJobs(jobs || []))
      .catch((err) => console.warn('Failed to fetch jobs from JobFetched API:', err));

    const jobDocsBySource: Record<string, RecruiterJobRecord[]> = {};
    const interviewDocsBySource: Record<string, RecruiterInterviewRecord[]> = {};
    const testDocsBySource: Record<string, RecruiterTestRecord[]> = {};
    const unsubs: (() => void)[] = [];

    const syncJobs = () => {
      const map = new Map<string, RecruiterJobRecord>();
      Object.values(jobDocsBySource).flat().forEach((d) => map.set(d.id, d));
      setJobDocs(Array.from(map.values()));
      setLoadingJobs(false);
    };

    const syncInterviews = () => {
      const map = new Map<string, RecruiterInterviewRecord>();
      Object.values(interviewDocsBySource).flat().forEach((d) => map.set(d.id, d));
      const records = Array.from(map.values()).filter((record) => record.isMock !== true);
      setInterviews(records);
      setLoadingInterviews(false);
    };

    const syncTests = () => {
      const map = new Map<string, RecruiterTestRecord>();
      Object.values(testDocsBySource).flat().forEach((d) => map.set(d.id, d));
      setTests(Array.from(map.values()));
      setLoadingTests(false);
    };

    if (isAdmin) {
      const unsubJobs = onSnapshot(query(collection(db, 'jobs')), (snap) => {
        jobDocsBySource['all'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterJobRecord));
        syncJobs();
      }, (err) => {
        console.error('Error fetching admin jobs:', err);
        setLoadingJobs(false);
      });
      unsubs.push(unsubJobs);

      const unsubInterviews = onSnapshot(query(collection(db, 'interviews')), (snap) => {
        interviewDocsBySource['all'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterInterviewRecord));
        syncInterviews();
      }, (err) => {
        console.error('Error fetching admin interviews:', err);
        setLoadingInterviews(false);
      });
      unsubs.push(unsubInterviews);

      const unsubTests = onSnapshot(query(collection(db, 'tests')), (snap) => {
        testDocsBySource['all'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterTestRecord));
        syncTests();
      }, (err) => {
        console.error('Error fetching admin tests:', err);
        setLoadingTests(false);
      });
      unsubs.push(unsubTests);
    } else {
      if (primaryUid) {
        // Team queries
        const unsubTeamJobs = onSnapshot(query(collection(db, 'jobs'), where('teamId', '==', primaryUid)), (snap) => {
          jobDocsBySource['team'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterJobRecord));
          syncJobs();
        }, () => setLoadingJobs(false));
        unsubs.push(unsubTeamJobs);

        const unsubTeamInterviews = onSnapshot(query(collection(db, 'interviews'), where('teamId', '==', primaryUid)), (snap) => {
          interviewDocsBySource['team'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterInterviewRecord));
          syncInterviews();
        }, () => setLoadingInterviews(false));
        unsubs.push(unsubTeamInterviews);

        const unsubTeamTests = onSnapshot(query(collection(db, 'tests'), where('teamId', '==', primaryUid)), (snap) => {
          testDocsBySource['team'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterTestRecord));
          syncTests();
        }, () => setLoadingTests(false));
        unsubs.push(unsubTeamTests);

        // Primary recruiter queries (direct)
        const unsubPrimaryJobs = onSnapshot(query(collection(db, 'jobs'), where('recruiterUID', '==', primaryUid)), (snap) => {
          jobDocsBySource['primary'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterJobRecord));
          syncJobs();
        }, () => setLoadingJobs(false));
        unsubs.push(unsubPrimaryJobs);

        const unsubPrimaryInterviews = onSnapshot(query(collection(db, 'interviews'), where('recruiterUID', '==', primaryUid)), (snap) => {
          interviewDocsBySource['primary'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterInterviewRecord));
          syncInterviews();
        }, () => setLoadingInterviews(false));
        unsubs.push(unsubPrimaryInterviews);

        const unsubPrimaryTests = onSnapshot(query(collection(db, 'tests'), where('recruiterUID', '==', primaryUid)), (snap) => {
          testDocsBySource['primary'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterTestRecord));
          syncTests();
        }, () => setLoadingTests(false));
        unsubs.push(unsubPrimaryTests);

        // Parent recruiter queries
        const unsubParentJobs = onSnapshot(query(collection(db, 'jobs'), where('parentRecruiterId', '==', primaryUid)), (snap) => {
          jobDocsBySource['parent'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterJobRecord));
          syncJobs();
        }, () => {});
        unsubs.push(unsubParentJobs);

        const unsubParentInterviews = onSnapshot(query(collection(db, 'interviews'), where('parentRecruiterId', '==', primaryUid)), (snap) => {
          interviewDocsBySource['parent'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterInterviewRecord));
          syncInterviews();
        }, () => {});
        unsubs.push(unsubParentInterviews);
      }

      // If sub-recruiter (userUid !== primaryUid)
      if (userUid && userUid !== primaryUid) {
        const unsubUserJobs = onSnapshot(query(collection(db, 'jobs'), where('recruiterUID', '==', userUid)), (snap) => {
          jobDocsBySource['user'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterJobRecord));
          syncJobs();
        }, () => setLoadingJobs(false));
        unsubs.push(unsubUserJobs);

        const unsubUserInterviews = onSnapshot(query(collection(db, 'interviews'), where('recruiterUID', '==', userUid)), (snap) => {
          interviewDocsBySource['user'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterInterviewRecord));
          syncInterviews();
        }, () => setLoadingInterviews(false));
        unsubs.push(unsubUserInterviews);

        const unsubUserTests = onSnapshot(query(collection(db, 'tests'), where('recruiterUID', '==', userUid)), (snap) => {
          testDocsBySource['user'] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterTestRecord));
          syncTests();
        }, () => setLoadingTests(false));
        unsubs.push(unsubUserTests);
      }
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [user, userProfile]);

  useEffect(() => {
    if (!user) {
      setAttempts([]);
      setLoadingAttempts(false);
      return;
    }

    const interviewIds = interviews.map((interview) => interview.id);
    if (interviewIds.length === 0) {
      setAttempts([]);
      setLoadingAttempts(false);
      return;
    }

    setLoadingAttempts(true);

    const attemptsByInterview = new Map<string, InterviewAttemptRecord[]>();
    const initializedInterviews = new Set<string>();

    const syncAttemptState = () => {
      const mergedAttempts = Array.from(attemptsByInterview.values())
        .flat()
        .sort((left, right) => toMillis(right.submittedAt) - toMillis(left.submittedAt));
      setAttempts(mergedAttempts);
    };

    const unsubscribers = interviewIds.map((interviewId) => {
      const attemptsQuery = collection(db, 'interviews', interviewId, 'attempts');
      return onSnapshot(
        attemptsQuery,
        (snapshot) => {
          attemptsByInterview.set(
            interviewId,
            snapshot.docs.map((snapshotDoc) => ({
              id: snapshotDoc.id,
              ...snapshotDoc.data(),
            } as InterviewAttemptRecord))
          );
          syncAttemptState();

          if (!initializedInterviews.has(interviewId)) {
            initializedInterviews.add(interviewId);
            if (initializedInterviews.size === interviewIds.length) {
              setLoadingAttempts(false);
            }
          }
        },
        (error) => {
          console.error('Error fetching interview attempts:', error);
          attemptsByInterview.set(interviewId, []);
          syncAttemptState();

          if (!initializedInterviews.has(interviewId)) {
            initializedInterviews.add(interviewId);
            if (initializedInterviews.size === interviewIds.length) {
              setLoadingAttempts(false);
            }
          }
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [interviews, user]);

  const dashboardRoles = useMemo<DashboardRoleEntry[]>(() => {
    const roleMap = new Map<string, DashboardRoleEntry>();

    jobDocs.forEach((job) => {
      roleMap.set(job.id, {
        id: job.id,
        title: job.title || 'Untitled Role',
        location: job.location || 'Remote',
        companyName: job.companyName,
        category: job.category,
        employmentType: job.employmentType,
        status: job.status,
        isActive: job.isActive,
        createdAt: job.createdAt || job.postedAt || job.updatedAt,
        deadline: job.applyDeadline,
        sourceLabel: 'Job Post',
        hasJobDoc: true,
        hasInterviewDoc: false,
        candidateEmails: [],
      });
    });

    interviews.forEach((interview) => {
      const existingEntry = roleMap.get(interview.id);
      const interviewEntry: DashboardRoleEntry = {
        id: interview.id,
        title: normalizeInterviewTitle(interview.title),
        location: existingEntry?.location || 'Remote',
        companyName: existingEntry?.companyName,
        category: interview.department || existingEntry?.category,
        employmentType: interview.employmentType || existingEntry?.employmentType,
        status: interview.status || existingEntry?.status,
        isActive: interview.isActive ?? existingEntry?.isActive,
        createdAt: existingEntry?.createdAt || interview.createdAt || interview.updatedAt,
        deadline: existingEntry?.deadline || interview.deadline,
        sourceLabel: existingEntry ? 'Synced' : 'Interview',
        hasJobDoc: existingEntry?.hasJobDoc || false,
        hasInterviewDoc: true,
        candidateEmails: interview.candidateEmails || existingEntry?.candidateEmails || [],
      };

      if (existingEntry) {
        roleMap.set(interview.id, {
          ...existingEntry,
          ...interviewEntry,
          title: existingEntry.title || interviewEntry.title,
          location: existingEntry.location || interviewEntry.location,
          status: interview.status || existingEntry.status,
          isActive: interview.isActive ?? existingEntry.isActive,
          sourceLabel: 'Synced',
          hasJobDoc: true,
          hasInterviewDoc: true,
          candidateEmails: interviewEntry.candidateEmails,
        });
      } else {
        roleMap.set(interview.id, interviewEntry);
      }
    });

    apiJobs.forEach((job: any) => {
      if (!roleMap.has(job.id)) {
        roleMap.set(job.id, {
          id: job.id,
          title: job.title || 'Untitled Role',
          location: job.location || job.city || 'Remote',
          companyName: job.companyName || job.company,
          category: job.department || job.category || 'General',
          employmentType: job.employmentType || 'Full-time',
          status: job.status || 'Active',
          isActive: job.isActive,
          createdAt: job.createdAt,
          deadline: job.deadline || job.applyDeadline,
          sourceLabel: 'Synced',
          hasJobDoc: false,
          hasInterviewDoc: true,
          candidateEmails: job.candidateEmails || [],
        });
      }
    });

    return Array.from(roleMap.values()).sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt));
  }, [interviews, jobDocs, apiJobs]);

  const totalInvitedCandidates = useMemo(() => {
    return dashboardRoles.reduce((acc, r) => acc + (r.candidateEmails?.length || 0), 0);
  }, [dashboardRoles]);

  const attemptsByInterview = useMemo(() => {
    return attempts.reduce((accumulator, attempt) => {
      if (!attempt.interviewId) return accumulator;
      accumulator.set(attempt.interviewId, (accumulator.get(attempt.interviewId) || 0) + 1);
      return accumulator;
    }, new Map<string, number>());
  }, [attempts]);

  const pendingReviewCount = useMemo(() => {
    return interviews.reduce((total, interview) => {
      const invitedCount = interview.candidateEmails?.length || 0;
      const submittedCount = attemptsByInterview.get(interview.id) || 0;
      return total + Math.max(invitedCount - submittedCount, 0);
    }, 0);
  }, [attemptsByInterview, interviews]);

  const activityData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const dayKey = getLocalDayKey(day);

      return {
        dayKey,
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        roles: 0,
        assessments: 0,
        responses: 0,
      };
    });

    const bucketMap = new Map(buckets.map((bucket) => [bucket.dayKey, bucket]));

    const incrementBucket = (
      value: TimestampLike,
      key: 'roles' | 'assessments' | 'responses'
    ) => {
      const millis = toMillis(value);
      if (!millis) return;

      const bucketDate = new Date(millis);
      bucketDate.setHours(0, 0, 0, 0);
      const dayKey = getLocalDayKey(bucketDate);
      const bucket = bucketMap.get(dayKey);
      if (bucket) bucket[key] += 1;
    };

    dashboardRoles.forEach((role) => incrementBucket(role.createdAt, 'roles'));
    tests.forEach((test) => incrementBucket(test.createdAt, 'assessments'));
    attempts.forEach((attempt) => incrementBucket(attempt.submittedAt, 'responses'));

    return buckets;
  }, [attempts, dashboardRoles, tests]);

  const hasActivity = activityData.some(
    (bucket) => bucket.roles > 0 || bucket.assessments > 0 || bucket.responses > 0
  );

  // Tile chart data computation
  const tileChartData = useMemo(() => {
    const now = new Date();

    const getDayKey = (date: Date) => {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getMonthKey = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

    const getYearKey = (date: Date) => `${date.getFullYear()}`;

    const grouped: Record<string, { jobs: number; interviews: number; responses: number }> = {};

    if (tileTimeRange === 'weekly') {
      const buckets: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const dayKey = getDayKey(day);
        if (!buckets.includes(dayKey)) {
          buckets.push(dayKey);
          grouped[dayKey] = { jobs: 0, interviews: 0, responses: 0 };
        }
      }

      dashboardRoles.forEach((role) => {
        const millis = toMillis(role.createdAt);
        if (!millis) return;
        const date = new Date(millis);
        date.setHours(0, 0, 0, 0);
        const dayKey = getDayKey(date);
        if (grouped[dayKey]) grouped[dayKey].jobs += 1;
      });

      interviews.forEach((interview) => {
        const millis = toMillis(interview.createdAt);
        if (!millis) return;
        const date = new Date(millis);
        date.setHours(0, 0, 0, 0);
        const dayKey = getDayKey(date);
        if (grouped[dayKey]) grouped[dayKey].interviews += 1;
      });

      attempts.forEach((attempt) => {
        const millis = toMillis(attempt.submittedAt);
        if (!millis) return;
        const date = new Date(millis);
        date.setHours(0, 0, 0, 0);
        const dayKey = getDayKey(date);
        if (grouped[dayKey]) grouped[dayKey].responses += 1;
      });

      return buckets.map((b) => ({
        label: new Date(b + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        jobs: grouped[b]?.jobs || 0,
        interviews: grouped[b]?.interviews || 0,
        responses: grouped[b]?.responses || 0,
      }));
    }

    if (tileTimeRange === 'monthly') {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      months.forEach((m) => {
        grouped[m] = { jobs: 0, interviews: 0, responses: 0 };
      });

      const currentYear = now.getFullYear();

      dashboardRoles.forEach((role) => {
        const millis = toMillis(role.createdAt);
        if (!millis) return;
        const date = new Date(millis);
        if (date.getFullYear() !== currentYear) return;
        const monthKey = getMonthKey(date);
        if (grouped[monthKey]) grouped[monthKey].jobs += 1;
      });

      interviews.forEach((interview) => {
        const millis = toMillis(interview.createdAt);
        if (!millis) return;
        const date = new Date(millis);
        if (date.getFullYear() !== currentYear) return;
        const monthKey = getMonthKey(date);
        if (grouped[monthKey]) grouped[monthKey].interviews += 1;
      });

      attempts.forEach((attempt) => {
        const millis = toMillis(attempt.submittedAt);
        if (!millis) return;
        const date = new Date(millis);
        if (date.getFullYear() !== currentYear) return;
        const monthKey = getMonthKey(date);
        if (grouped[monthKey]) grouped[monthKey].responses += 1;
      });

      return months.map((m) => ({
        label: m,
        jobs: grouped[m]?.jobs || 0,
        interviews: grouped[m]?.interviews || 0,
        responses: grouped[m]?.responses || 0,
      }));
    }

    // Yearly
    const years: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const year = now.getFullYear() - i;
      years.push(String(year));
      grouped[String(year)] = { jobs: 0, interviews: 0, responses: 0 };
    }

    dashboardRoles.forEach((role) => {
      const millis = toMillis(role.createdAt);
      if (!millis) return;
      const date = new Date(millis);
      const yearKey = getYearKey(date);
      if (grouped[yearKey]) grouped[yearKey].jobs += 1;
    });

    interviews.forEach((interview) => {
      const millis = toMillis(interview.createdAt);
      if (!millis) return;
      const date = new Date(millis);
      const yearKey = getYearKey(date);
      if (grouped[yearKey]) grouped[yearKey].interviews += 1;
    });

    attempts.forEach((attempt) => {
      const millis = toMillis(attempt.submittedAt);
      if (!millis) return;
      const date = new Date(millis);
      const yearKey = getYearKey(date);
      if (grouped[yearKey]) grouped[yearKey].responses += 1;
    });

    return years.map((y) => ({
      label: y,
      jobs: grouped[y]?.jobs || 0,
      interviews: grouped[y]?.interviews || 0,
      responses: grouped[y]?.responses || 0,
    }));
  }, [attempts, dashboardRoles, interviews, tileTimeRange]);

  const loading = loadingJobs || loadingInterviews || loadingTests || loadingAttempts;

  const getRoleStatus = (role: DashboardRoleEntry) => {
    const isJobActive = isJobStatusActive(role);
    if (!isJobActive) {
      return {
        label: 'Expired',
        className:
          'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20',
      };
    }

    return {
      label: 'Active',
      className:
        'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20',
    };
  };

  const activeJobPosts = dashboardRoles.filter((role) => getRoleStatus(role).label === 'Active');
  const visibleJobPosts = activeJobPosts.slice(0, 4);

  const recruiterName =
    userProfile?.fullname ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'there';

  const quickActions = [
    {
      label: 'Create Job',
      description: 'Questions and invites.',
      href: '/recruiter/interview/create',
      icon: Video,
      resource: 'interviews' as RateLimitResource,
    },
    {
      label: 'Create Assessment',
      description: 'Screening test setup.',
      href: '/recruiter/tests/create?type=aptitude',
      icon: ClipboardList,
      resource: 'assessments' as RateLimitResource,
    },
    {
      label: 'Manage Interviews',
      description: 'Workflows and reports.',
      href: '/recruiter/interviews',
      icon: ListChecks,
      resource: null,
    },
  ];

  if (loading) {
    return <RecruiterDashboardSkeleton />;
  }

  return (
    <div className="w-full min-h-screen bg-[#F8F9F5] text-[#111215] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Editorial Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E4E7DC] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E7DC] bg-white px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[#575A51] shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8FB305] animate-pulse" />
            01 • RECRUITER DESK • OVERVIEW
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#111215]">
            Welcome back, {recruiterName}
          </h1>
          <p className="mt-1 text-sm text-[#575A51]">
            Track candidate pipeline flow, interview schedules, and active job requisitions in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/recruiter/interview/create"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#111215] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#202227]"
          >
            <Plus size={14} className="text-[#D4F82C]" />
            <span>Create Job</span>
          </Link>
          <Link
            to="/recruiter/tests/create?type=aptitude"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-4 py-2.5 text-xs font-semibold text-[#111215] shadow-xs transition-colors hover:bg-[#F8F9F5]"
          >
            <span>Create Assessment</span>
            <ArrowUpRight size={14} className="text-[#73766C]" />
          </Link>
        </div>
      </section>

      {/* 5 High-Impact Metric Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: All Job Postings */}
        <Link
          to="/recruiter/all-jobs"
          className="group relative flex flex-col justify-between rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
              All Job Postings
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
              <BriefcaseBusiness size={13} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {dashboardRoles.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#D4F82C] px-2.5 py-0.5 text-[11px] font-bold text-[#111215]">
              <span className="h-1 w-1 rounded-full bg-[#8FB305]" />
              {activeJobPosts.length} active
            </span>
          </div>
        </Link>

        {/* Card 2: Responses */}
        <Link
          to="/recruiter/hot-leads"
          className="group relative flex flex-col justify-between rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
              Responses
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
              <TrendingUp size={13} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {attempts.length}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E7DC] bg-[#F8F9F5] px-2.5 py-0.5 text-[11px] font-medium text-[#575A51]">
              {attempts.length === 1 ? '1 report' : `${attempts.length} reports`}
            </span>
          </div>
        </Link>

        {/* Card 3: Pending Review */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
              Pending
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#FEF3C7] bg-[#FFFBEB] text-[#D97706]">
              <Clock size={13} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {pendingReviewCount}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400E]">
              awaiting review
            </span>
          </div>
        </div>

        {/* Card 4: Assessments */}
        <Link
          to="/recruiter/tests"
          className="group relative flex flex-col justify-between rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
              Assessments
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
              <ClipboardList size={13} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {tests.length}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E7DC] bg-[#F8F9F5] px-2.5 py-0.5 text-[11px] font-medium text-[#575A51]">
              screening tests
            </span>
          </div>
        </Link>

        {/* Card 5: Candidates */}
        <Link
          to="/recruiter/hot-leads"
          className="group relative flex flex-col justify-between rounded-2xl border border-[#E4E7DC] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#111215]/30 hover:shadow-md col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
              Candidates
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] transition-colors group-hover:bg-[#111215] group-hover:text-[#D4F82C]">
              <Users size={13} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111215]">
              {totalInvitedCandidates}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#C7D2FE] bg-[#E0E7FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#3730A3]">
              invited
            </span>
          </div>
        </Link>
      </section>

      {/* Analytics Chart + Quick Action Bento Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left: Chart Container */}
        <div className="lg:col-span-8 rounded-3xl border border-[#E4E7DC] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#8FB305]" />
                <h3 className="text-base font-bold tracking-tight text-[#111215]">
                  Pipeline Activity
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-[#575A51]">
                Real-time volume breakdown across jobs, video interviews, and candidate responses.
              </p>
            </div>
          </div>

          <div className="min-h-[260px] flex-1 w-full">
            {hasActivity ? (
              <StackedTileChart
                data={tileChartData}
                timeRange={tileTimeRange}
                onTimeRangeChange={setTileTimeRange}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#73766C]">
                  <Activity size={20} />
                </div>
                <p className="text-sm font-semibold text-[#111215]">No live activity yet</p>
                <p className="mt-1 max-w-sm text-xs text-[#575A51]">
                  New recruiter activity will appear here automatically as jobs are published, assessments completed, and candidates respond.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions Card */}
        <div className="lg:col-span-4 rounded-3xl border border-[#E4E7DC] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold tracking-tight text-[#111215]">
                  Quick Actions
                </h3>
                <p className="mt-0.5 text-xs text-[#575A51]">
                  Start a new recruitment workflow in one tap.
                </p>
              </div>
              <div className="h-2 w-2 rounded-full bg-[#D4F82C]" />
            </div>

            <div className="mt-5 space-y-3">
              {quickActions.map((action, index) => {
                const ActionIcon = action.icon;
                const limitReached = action.resource ? isRateLimitReached(rateLimitStatus, action.resource) : false;

                const iconStyles =
                  index === 0
                    ? 'border-[#111215] bg-[#111215] text-[#D4F82C]'
                    : index === 1
                      ? 'border-[#E4E7DC] bg-[#F8F9F5] text-[#8FB305]'
                      : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]';

                return (
                  <Link
                    key={action.label}
                    to={action.href}
                    onClick={(event) => {
                      if (!limitReached || !action.resource) return;
                      event.preventDefault();
                      messageBox.showWarning(getRateLimitReachedMessage(action.resource));
                    }}
                    aria-disabled={limitReached}
                    className={`group flex items-center gap-3.5 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5]/50 p-3.5 text-left transition-all hover:border-[#111215] hover:bg-white hover:shadow-sm ${
                      limitReached ? 'cursor-not-allowed opacity-55' : ''
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconStyles}`}>
                      <ActionIcon size={16} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-[#111215]">
                        {action.label}
                      </span>
                      <span className={`block text-[11px] ${limitReached ? 'text-red-500 font-semibold' : 'text-[#73766C]'}`}>
                        {limitReached ? 'Rate limit reached.' : action.description}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 text-[#73766C] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#111215]"
                      strokeWidth={2}
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] p-3.5 text-center">
            <span className="text-[11px] font-medium text-[#575A51]">
              Need help streamlining hiring? Check our{' '}
              <Link to="/active-jobs" className="font-bold text-[#111215] underline hover:text-[#8FB305]">
                Public Jobs Board
              </Link>
            </span>
          </div>
        </div>
      </section>

      {/* Existing Job Posts Table Card */}
      <section className="rounded-3xl border border-[#E4E7DC] bg-white overflow-hidden shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-[#E4E7DC]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-[#111215]">
                Existing Job Posts
              </h2>
              <span className="inline-flex items-center rounded-full bg-[#F8F9F5] border border-[#E4E7DC] px-2.5 py-0.5 text-[11px] font-semibold text-[#575A51]">
                {visibleJobPosts.length} shown
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#575A51]">
              Interview-created roles and synced job posts appear here automatically.
            </p>
          </div>

          <Link
            to="/recruiter/all-jobs"
            className="text-xs font-semibold text-[#111215] hover:text-[#8FB305] inline-flex items-center gap-1 transition-colors self-start sm:self-center"
          >
            <span>View All Jobs</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {visibleJobPosts.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#73766C]">
              <BriefcaseBusiness size={18} />
            </div>
            <p className="text-sm font-semibold text-[#111215]">
              No active recruiter-owned roles are live yet
            </p>
            <p className="mt-1 text-xs text-[#73766C]">
              Create an interview role or import openings to start receiving candidates.
            </p>
            <div className="mt-4">
              <Link
                to="/recruiter/interview/create"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#111215] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#202227]"
              >
                <Plus size={13} className="text-[#D4F82C]" />
                <span>Create First Role</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E4E7DC]">
              <thead className="bg-[#F8F9F5]">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                    Job Title
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                    Posted Date
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#73766C]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7DC] bg-white">
                {visibleJobPosts.map((role) => {
                  const roleStatus = getRoleStatus(role);
                  const isActive = roleStatus.label === 'Active';

                  return (
                    <tr key={role.id} className="group hover:bg-[#F8F9F5]/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-sm text-[#111215] group-hover:text-[#8FB305] transition-colors">
                          {role.title}
                        </div>
                        <div className="mt-0.5 text-xs text-[#73766C]">
                          {role.category || role.companyName || role.location || 'General'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center rounded-full border border-[#E4E7DC] bg-[#F8F9F5] px-2.5 py-0.5 text-[11px] font-semibold text-[#575A51]">
                          {role.sourceLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-[#73766C]">
                        {formatDate(role.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            isActive
                              ? 'bg-[#D4F82C] text-[#111215]'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? 'bg-[#8FB305]' : 'bg-red-500'
                            }`}
                          />
                          {roleStatus.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <Link
                          to={role.hasInterviewDoc ? `/recruiter/interviews` : `/recruiter/all-jobs`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#111215] hover:text-[#8FB305] transition-colors"
                        >
                          <span>Manage</span>
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recruiter Team & Audit Logs Section */}
      <div className="rounded-3xl border border-[#E4E7DC] bg-white overflow-hidden shadow-xs">
        <RecruiterTeamPanel />
      </div>

    </div>
  );
};

export default RecruiterDashboard;
