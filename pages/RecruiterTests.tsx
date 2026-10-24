import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Code,
  Copy,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  CheckCircle2,
  TrendingUp,
  Layers,
  Clock,
  Target,
  Share2,
  FileCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import { useMessageBox } from '../components/MessageBox';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';
import { getRateLimitReachedMessage, isRateLimitReached, RateLimitResource } from '../services/rateLimitService';

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

const formatDate = (value: TimestampLike): string => {
  const millis = toMillis(value);
  if (!millis) return 'Recently';
  return new Date(millis).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const getAssessmentLink = (testId: string) => `${window.location.origin}/test/${testId}`;

const getStats = (test: any, submissions: any[]) => {
  const passingScore = Number(test.passingScore ?? 70);
  const totalScore = submissions.reduce((sum, submission) => sum + (Number(submission.score) || 0), 0);

  return {
    submissions: submissions.length,
    averageScore: submissions.length ? Math.round(totalScore / submissions.length) : 0,
    passed: submissions.filter((submission) => submission.status === 'passed' || Number(submission.score) >= passingScore).length,
  };
};

const RecruiterTests: React.FC = () => {
  const { userProfile } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'aptitude' | 'coding'>('All');
  const navigate = useNavigate();
  const { showConfirm, showError, showSuccess } = useMessageBox();
  const { status: rateLimitStatus } = useCompanyRateLimits();
  const assessmentLimitReached = isRateLimitReached(rateLimitStatus, 'assessments');
  const codingLimitReached = isRateLimitReached(rateLimitStatus, 'codingAssessments');

  const guardCreateLink = (event: React.MouseEvent, resource: RateLimitResource) => {
    if (!isRateLimitReached(rateLimitStatus, resource)) return;
    event.preventDefault();
    showError(getRateLimitReachedMessage(resource));
  };

  useEffect(() => {
    const fetchTests = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const primaryUid = userProfile?.parentRecruiterId || (userProfile as any)?.primaryRecruiterUID || userProfile?.teamId || currentUser.uid;
        const isAdmin = (userProfile?.role || '').toLowerCase() === 'admin';

        const docMap = new Map<string, any>();
        if (isAdmin) {
          const snap = await getDocs(collection(db, 'tests'));
          snap.docs.forEach(d => docMap.set(d.id, { id: d.id, ...d.data() }));
        } else {
          const promises = [];
          if (primaryUid) {
            promises.push(getDocs(query(collection(db, 'tests'), where('teamId', '==', primaryUid))));
            promises.push(getDocs(query(collection(db, 'tests'), where('recruiterUID', '==', primaryUid))));
            promises.push(getDocs(query(collection(db, 'tests'), where('parentRecruiterId', '==', primaryUid))));
          }
          if (currentUser.uid && currentUser.uid !== primaryUid) {
            promises.push(getDocs(query(collection(db, 'tests'), where('recruiterUID', '==', currentUser.uid))));
          }
          const results = await Promise.all(promises);
          results.forEach(snap => {
            snap.docs.forEach(d => docMap.set(d.id, { id: d.id, ...d.data() }));
          });
        }

        const fetchedTests = Array.from(docMap.values());
        fetchedTests.sort((a: any, b: any) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setTests(fetchedTests);

        const nextSubmissionsMap: Record<string, any[]> = Object.fromEntries(fetchedTests.map((test: any) => [test.id, []]));
        const idChunks = chunkArray(fetchedTests.map((test: any) => test.id), 10);

        for (const idChunk of idChunks) {
          const submissionsQuery = query(collection(db, 'testSubmissions'), where('testId', 'in', idChunk));
          const submissionsSnap = await getDocs(submissionsQuery);
          submissionsSnap.docs.forEach((submissionDoc) => {
            const submission = { id: submissionDoc.id, ...submissionDoc.data() } as any;
            if (!nextSubmissionsMap[submission.testId]) nextSubmissionsMap[submission.testId] = [];
            nextSubmissionsMap[submission.testId].push(submission);
          });
        }

        setSubmissionsMap(nextSubmissionsMap);
      } catch (error) {
        console.error('Error fetching assessments:', error);
        showError('Unable to load assessments.');
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [showError, userProfile]);

  const handleDelete = async (id: string) => {
    showConfirm('Delete this assessment and remove it from your workspace?', async () => {
      try {
        await deleteDoc(doc(db, 'tests', id));
        setTests((currentTests) => currentTests.filter(test => test.id !== id));
        setSubmissionsMap((currentMap) => {
          const nextMap = { ...currentMap };
          delete nextMap[id];
          return nextMap;
        });
        showSuccess('Assessment deleted successfully.');
      } catch (error) {
        console.error('Error deleting assessment:', error);
        showError('Unable to delete assessment.');
      }
    });
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(successMessage);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      showError('Unable to copy to clipboard.');
    }
  };

  const filteredTests = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return tests.filter((test) => {
      const matchesSearch = !search || `${test.title || ''} ${test.accessCode || ''} ${test.id || ''}`.toLowerCase().includes(search);
      const matchesType = typeFilter === 'All' || test.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [tests, searchQuery, typeFilter]);

  const overviewStats = useMemo(() => {
    const allStats = tests.map((test) => getStats(test, submissionsMap[test.id] || []));
    const totalSubmissions = allStats.reduce((sum, stats) => sum + stats.submissions, 0);
    const totalPassed = allStats.reduce((sum, stats) => sum + stats.passed, 0);

    return {
      coding: tests.filter(test => test.type === 'coding').length,
      aptitude: tests.filter(test => test.type !== 'coding').length,
      submissions: totalSubmissions,
      passed: totalPassed,
      averageScore: allStats.length && allStats.some(stats => stats.submissions > 0)
        ? Math.round(allStats.reduce((sum, stats) => sum + (stats.averageScore * stats.submissions), 0) / Math.max(totalSubmissions, 1))
        : 0,
      passRate: totalSubmissions > 0 ? Math.round((totalPassed / totalSubmissions) * 100) : 0,
    };
  }, [tests, submissionsMap]);

  const secondaryButtonClass = "inline-flex h-10 items-center justify-center rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-4 font-bold text-xs text-[#111215] dark:text-white transition-all hover:bg-[#F1F3EB] dark:hover:bg-white/10 cursor-pointer shadow-2xs gap-2 disabled:cursor-not-allowed disabled:opacity-40";
  const primaryButtonClass = "inline-flex h-10 items-center justify-center rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] px-5 font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 gap-2";

  return (
    <div className="w-full min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
      
      {/* Header */}
      <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#0D0E11] px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                to="/recruiter/jobs"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:border-[#111215] dark:hover:border-white/30 transition-all shadow-2xs"
              >
                <ArrowLeft size={13} />
                <span>Dashboard</span>
              </Link>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] font-bold text-[#111215] dark:text-[#F8F9F5] shadow-2xs">
                <span className="size-2 rounded-full bg-[#8FB305] dark:bg-[#D4F82C] animate-pulse"></span>
                <span className="font-mono uppercase text-[10px] text-[#73766C] dark:text-neutral-400">ASSESSMENT STUDIO</span>
                <span className="text-[#E4E7DC] dark:text-white/20">|</span>
                <span>Screening & Evaluation Hub</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-[#F8F9F5] tracking-tight">
              Assessments
            </h1>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Review candidate assessment performance, generate secure test links, and manage automated screening tests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/recruiter/tests/create?type=aptitude"
              onClick={(event) => guardCreateLink(event, 'assessments')}
              aria-disabled={assessmentLimitReached}
              className={secondaryButtonClass}
            >
              <FileText size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
              <span>+ Aptitude Test</span>
            </Link>
            <Link
              to="/recruiter/tests/create?type=coding"
              onClick={(event) => guardCreateLink(event, 'codingAssessments')}
              aria-disabled={codingLimitReached}
              className={secondaryButtonClass}
            >
              <Code size={14} className="text-blue-500" />
              <span>+ Coding Challenge</span>
            </Link>
            <Link
              to="/recruiter/tests/create"
              onClick={(event) => guardCreateLink(event, 'assessments')}
              aria-disabled={assessmentLimitReached}
              className={primaryButtonClass}
            >
              <Plus size={16} />
              <span>{assessmentLimitReached ? 'Limit Reached' : 'Create Assessment'}</span>
            </Link>
          </div>
        </div>

        {assessmentLimitReached && (
          <div className="max-w-7xl mx-auto mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0" />
            <span>{getRateLimitReachedMessage('assessments')}</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* 6 Bento Metric Stat Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          
          {/* Total */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Total Tests</span>
              <div className="size-7 rounded-lg bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#111215] dark:text-white">
                <Layers size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-[#111215] dark:text-white">{tests.length}</p>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Active in bank</p>
            </div>
          </div>

          {/* Aptitude */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Aptitude</span>
              <div className="size-7 rounded-lg bg-[#F4F9EB] dark:bg-emerald-950/20 border border-[#D2E7B3] dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileText size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-[#111215] dark:text-white">{overviewStats.aptitude}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">MCQ evaluations</p>
            </div>
          </div>

          {/* Coding */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Coding</span>
              <div className="size-7 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Code size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-[#111215] dark:text-white">{overviewStats.coding}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">Coding challenges</p>
            </div>
          </div>

          {/* Submissions */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Submissions</span>
              <div className="size-7 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Users size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-[#111215] dark:text-white">{overviewStats.submissions}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">Candidates tested</p>
            </div>
          </div>

          {/* Passed */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Passed</span>
              <div className="size-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">{overviewStats.passed}</p>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{overviewStats.passRate}% pass rate</p>
            </div>
          </div>

          {/* Avg Score */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">Avg Score</span>
              <div className="size-7 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <TrendingUp size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400">{overviewStats.averageScore}%</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">Overall cohort</p>
            </div>
          </div>

        </section>

        {/* Filter and Search Bar */}
        <section className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C]" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search assessments by title, code or ID..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C]"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-[#73766C] dark:text-neutral-400 mr-1">Format:</span>
            <div className="flex p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114]">
              {(['All', 'aptitude', 'coding'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTypeFilter(filter)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all capitalize cursor-pointer ${
                    typeFilter === filter
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {(searchQuery || typeFilter !== 'All') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setTypeFilter('All'); }}
                className="px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </section>

        {/* Content Section */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 shadow-xs animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-60 rounded-xl bg-gray-200 dark:bg-white/10" />
                  <div className="h-8 w-24 rounded-full bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="h-4 w-96 rounded-lg bg-gray-100 dark:bg-white/5" />
              </div>
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-12 sm:p-16 text-center shadow-xs">
            <div className="size-14 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#8FB305] dark:text-[#D4F82C] mx-auto mb-4 shadow-2xs">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-black text-[#111215] dark:text-white">No assessments created yet</h3>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
              Create an automated aptitude screen or coding challenge to evaluate candidates before moving them into interview rounds.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Link to="/recruiter/tests/create" className={primaryButtonClass}>
                <Plus size={16} />
                <span>Create your first assessment</span>
              </Link>
            </div>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-12 text-center shadow-xs">
            <div className="size-12 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#73766C] mx-auto mb-3">
              <Search size={20} />
            </div>
            <h3 className="text-base font-bold text-[#111215] dark:text-white">No matching assessments</h3>
            <p className="text-xs text-[#73766C] dark:text-neutral-400 max-w-sm mx-auto mt-1">
              Try adjusting your search query or format filter to find what you are looking for.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setTypeFilter('All'); }}
              className="mt-4 px-4 py-2 rounded-full bg-[#111215] text-white text-xs font-bold cursor-pointer"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTests.map((test) => {
              const isCoding = test.type === 'coding';
              const stats = getStats(test, submissionsMap[test.id] || []);
              const testLink = getAssessmentLink(test.id);

              return (
                <article
                  key={test.id}
                  className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-4 hover:border-[#111215]/30 dark:hover:border-white/20"
                >
                  {/* Top Bar: Title, Badges, Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E4E7DC] dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-2xl flex items-center justify-center font-bold shadow-2xs shrink-0 ${
                        isCoding
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40'
                          : 'bg-[#F4F9EB] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-[#D2E7B3] dark:border-emerald-800/40'
                      }`}>
                        {isCoding ? <Code size={18} /> : <FileText size={18} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => navigate(`/recruiter/tests/${test.id}/results`)}
                            className="text-base sm:text-lg font-black text-[#111215] dark:text-white hover:text-emerald-600 dark:hover:text-[#D4F82C] text-left transition-colors cursor-pointer"
                          >
                            {test.title}
                          </button>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isCoding
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          }`}>
                            {isCoding ? 'Coding' : 'Aptitude'}
                          </span>
                        </div>
                        <p className="text-xs text-[#73766C] dark:text-neutral-400 mt-0.5">
                          Created on {formatDate(test.createdAt)} • {test.questions?.length || 0} questions
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/recruiter/tests/${test.id}/results`)}
                        className={secondaryButtonClass}
                      >
                        <BarChart3 size={13} />
                        <span>View Results ({stats.submissions})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(test.id)}
                        className="size-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-all cursor-pointer"
                        title="Delete assessment"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Metrics & Shareable Link Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    
                    {/* Left: Stats Pill Strip (6 cols) */}
                    <div className="md:col-span-6 grid grid-cols-4 gap-2">
                      <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase">Duration</span>
                        <span className="text-xs sm:text-sm font-black font-mono text-[#111215] dark:text-white">{test.duration || 10}m</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase">Pass Score</span>
                        <span className="text-xs sm:text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{test.passingScore || 70}%</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase">Submissions</span>
                        <span className="text-xs sm:text-sm font-black font-mono text-[#111215] dark:text-white">{stats.submissions}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase">Avg Score</span>
                        <span className="text-xs sm:text-sm font-black font-mono text-amber-600 dark:text-amber-400">{stats.averageScore}%</span>
                      </div>
                    </div>

                    {/* Right: Candidate Links & Access Code (6 cols) */}
                    <div className="md:col-span-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* Copy Link Pill */}
                      <div className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                        <div className="flex items-center gap-2 min-w-0 mr-2">
                          <Share2 size={13} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                          <span className="text-xs font-mono text-[#575A51] dark:text-neutral-300 truncate">
                            {testLink}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(testLink, 'Candidate test link copied to clipboard.')}
                            className="p-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-[#E4E7DC] text-[#111215] dark:text-white transition-colors cursor-pointer"
                            title="Copy candidate URL"
                          >
                            <Copy size={13} />
                          </button>
                          <a
                            href={testLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-[#E4E7DC] text-[#111215] dark:text-white transition-colors"
                            title="Preview test in new tab"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </div>

                      {/* Access Code Pill */}
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 shrink-0">
                        <div className="mr-2">
                          <span className="text-[9px] font-bold text-[#73766C] dark:text-neutral-400 uppercase block">Code</span>
                          <span className="text-xs font-mono font-black text-[#111215] dark:text-white">
                            {test.accessCode || 'NONE'}
                          </span>
                        </div>
                        {test.accessCode && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(test.accessCode, 'Access code copied.')}
                            className="p-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-[#E4E7DC] text-[#111215] dark:text-white transition-colors cursor-pointer"
                            title="Copy access code"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};

export default RecruiterTests;
