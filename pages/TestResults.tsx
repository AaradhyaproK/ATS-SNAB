import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Code,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  Users,
  X,
  XCircle
} from 'lucide-react';
import { useMessageBox } from '../components/MessageBox';

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

const formatDateTime = (value: TimestampLike): string => {
  const millis = toMillis(value);
  if (!millis) return 'Recently';

  return new Date(millis).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const TestResults: React.FC = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useMessageBox();

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<any>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed' | 'flagged'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      if (!testId) return;

      try {
        const testSnap = await getDoc(doc(db, 'tests', testId));
        if (testSnap.exists()) {
          setTest({ id: testSnap.id, ...testSnap.data() });
        }

        const submissionsQuery = query(
          collection(db, 'testSubmissions'),
          where('testId', '==', testId)
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        const fetchedSubmissions = submissionsSnap.docs
          .map((submissionDoc) => ({
            id: submissionDoc.id,
            ...submissionDoc.data(),
          }))
          .filter((sub: any) => !sub.isDeleted && sub.status !== 'deleted');

        fetchedSubmissions.sort((a: any, b: any) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
        setSubmissions(fetchedSubmissions);
      } catch (error) {
        console.error('Error fetching results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [testId]);

  const passingScore = Number(test?.passingScore ?? 70);
  const title = test?.title || 'Assessment Results';
  const isCoding = test?.type === 'coding';
  const testLink = testId ? `${window.location.origin}/test/${testId}` : '';

  const handleCopyLink = async () => {
    if (!testLink) return;
    try {
      await navigator.clipboard.writeText(testLink);
      setCopiedLink(true);
      showSuccess('Assessment link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showError('Unable to copy link.');
    }
  };

  const overviewStats = useMemo(() => {
    const total = submissions.length;
    const passed = submissions.filter((s) => s.status === 'passed' || Number(s.score) >= passingScore).length;
    const terminated = submissions.filter((s) => s.status === 'terminated').length;
    const failed = submissions.filter((s) => s.status !== 'passed' && Number(s.score) < passingScore && s.status !== 'terminated').length;
    const flagged = submissions.filter(
      (s) =>
        s.status === 'terminated' ||
        (Number(s.tabSwitchCount) || 0) > 0 ||
        (Number(s.copyPasteAttempts) || 0) > 0 ||
        (Number(s.screenshotAttempts) || 0) > 0
    ).length;

    const totalScore = submissions.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
    const averageScore = total > 0 ? Math.round(totalScore / total) : 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const highestScore = total > 0 ? Math.max(...submissions.map((s) => Number(s.score) || 0)) : 0;

    return {
      total,
      passed,
      failed,
      terminated,
      flagged,
      averageScore,
      passRate,
      highestScore,
    };
  }, [submissions, passingScore]);

  const filteredAndSortedSubmissions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return submissions
      .filter((submission) => {
        const matchesSearch =
          !search ||
          `${submission.candidateName || ''} ${submission.candidateEmail || ''}`.toLowerCase().includes(search);

        const isPassed = submission.status === 'passed' || Number(submission.score) >= passingScore;
        const isTerminated = submission.status === 'terminated';
        const hasViolations =
          (Number(submission.tabSwitchCount) || 0) > 0 ||
          (Number(submission.copyPasteAttempts) || 0) > 0 ||
          (Number(submission.screenshotAttempts) || 0) > 0;

        if (statusFilter === 'passed') return matchesSearch && isPassed && !isTerminated;
        if (statusFilter === 'failed') return matchesSearch && !isPassed && !isTerminated;
        if (statusFilter === 'flagged') return matchesSearch && (isTerminated || hasViolations);
        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return (Number(b.score) || 0) - (Number(a.score) || 0);
        if (sortBy === 'name') return String(a.candidateName || '').localeCompare(String(b.candidateName || ''));
        return toMillis(b.submittedAt) - toMillis(a.submittedAt);
      });
  }, [submissions, searchTerm, sortBy, statusFilter, passingScore]);

  const handleDeleteSubmission = async (submission: TestSubmission) => {
    const candidateName = submission.candidateName || submission.candidateEmail || 'this candidate';
    const confirmDelete = window.confirm(
      `Delete previous attempt for ${candidateName}?\n\nThis will remove their test score and allow them to retake the assessment with the same test link.`
    );
    if (!confirmDelete) return;

    try {
      // 1. Attempt permanent deleteDoc
      await deleteDoc(doc(db, 'testSubmissions', submission.id));
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
      if (selectedSubmission?.id === submission.id) {
        setSelectedSubmission(null);
      }
      showSuccess(`Candidate attempt deleted. ${candidateName} can now retake this assessment.`);
    } catch (err: any) {
      console.warn('Direct deleteDoc failed, trying soft-delete fallback:', err);
      // 2. Resilient fallback: If live Firestore security rules haven't synced delete permission,
      // updateDoc with deletion tombstone so retakes immediately unlock without blocking recruiter
      try {
        await updateDoc(doc(db, 'testSubmissions', submission.id), {
          isDeleted: true,
          status: 'deleted',
          score: null,
          deletedAt: new Date().toISOString()
        });
        setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
        if (selectedSubmission?.id === submission.id) {
          setSelectedSubmission(null);
        }
        showSuccess(`Candidate attempt deleted. ${candidateName} can now retake this assessment.`);
      } catch (fallbackErr: any) {
        console.error('Failed to delete submission via fallback:', fallbackErr);
        showError(err?.message || 'Failed to delete candidate submission.');
      }
    }
  };

  const secondaryButtonClass =
    'inline-flex h-9 items-center justify-center rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-3.5 font-bold text-xs text-[#111215] dark:text-white transition-all hover:bg-[#F1F3EB] dark:hover:bg-white/10 cursor-pointer shadow-2xs gap-1.5';
  const primaryButtonClass =
    'inline-flex h-9 items-center justify-center rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] px-4 font-bold text-xs transition-all shadow-md cursor-pointer gap-1.5';

  return (
    <div className="w-full min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
      {/* Top Header */}
      <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#0D0E11] px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => navigate('/recruiter/tests')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:border-[#111215] dark:hover:border-white/30 transition-all shadow-2xs cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Assessments</span>
              </button>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] font-bold text-[#111215] dark:text-[#F8F9F5] shadow-2xs">
                <span className="size-2 rounded-full bg-[#8FB305] dark:bg-[#D4F82C] animate-pulse"></span>
                <span className="font-mono uppercase text-[10px] text-[#73766C] dark:text-neutral-400">
                  {isCoding ? 'CODING EVALUATION' : 'APTITUDE EVALUATION'}
                </span>
                <span className="text-[#E4E7DC] dark:text-white/20">|</span>
                <span>Cohort Outcomes</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-[#F8F9F5] tracking-tight">
                {title}
              </h1>
              {test?.accessCode && (
                <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#73766C] dark:text-neutral-300">
                  #{test.accessCode}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Review candidate score breakdowns, proctoring integrity violations, email delivery status, and submitted answer sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {testId && (
              <button
                type="button"
                onClick={() => navigate(`/recruiter/tests/${testId}/edit`)}
                className={secondaryButtonClass}
                title="Edit assessment questions and scoring"
              >
                <Edit3 size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                <span>Edit Assessment</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className={secondaryButtonClass}
              title="Copy candidate assessment link"
            >
              {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
            </button>

            {testLink && (
              <a
                href={testLink}
                target="_blank"
                rel="noopener noreferrer"
                className={primaryButtonClass}
              >
                <span>Take Test</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* 5 Bento Metric Stat Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Card 1: Total Tested */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">
                Candidates
              </span>
              <div className="size-7 rounded-lg bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#111215] dark:text-white">
                <Users size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-[#111215] dark:text-white">
                {overviewStats.total}
              </p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                Submissions recorded
              </p>
            </div>
          </div>

          {/* Card 2: Passed */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">
                Passed
              </span>
              <div className="size-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {overviewStats.passed}
              </p>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {overviewStats.passRate}% pass rate
              </p>
            </div>
          </div>

          {/* Card 3: Average Score */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">
                Avg Score
              </span>
              <div className="size-7 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <TrendingUp size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
                {overviewStats.averageScore}%
              </p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                Cohort benchmark
              </p>
            </div>
          </div>

          {/* Card 4: Passing Threshold */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">
                Pass Mark
              </span>
              <div className="size-7 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Target size={14} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-[#111215] dark:text-white">
                {passingScore}%
              </p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                {test?.duration || 10}m duration
              </p>
            </div>
          </div>

          {/* Card 5: Integrity Violations */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-4 sm:p-5 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider">
                Integrity Alerts
              </span>
              <div className="size-7 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <ShieldCheck size={14} />
              </div>
            </div>
            <div>
              <p className={`text-2xl sm:text-3xl font-black font-mono ${overviewStats.flagged > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {overviewStats.flagged}
              </p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                {overviewStats.flagged > 0 ? 'Tab switches / alerts' : 'Clean proctoring'}
              </p>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <section className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C]" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search candidate name or email..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C]"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-[#73766C] dark:text-neutral-400 mr-1">Status:</span>
            <div className="flex p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114]">
              {(
                [
                  ['all', `All (${submissions.length})`],
                  ['passed', `Passed (${overviewStats.passed})`],
                  ['failed', `Failed (${overviewStats.failed})`],
                  ['flagged', `Flagged (${overviewStats.flagged})`],
                ] as const
              ).map(([filterKey, filterLabel]) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setStatusFilter(filterKey)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    statusFilter === filterKey
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  {filterLabel}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-xs font-bold text-[#73766C] dark:text-neutral-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-8 px-2.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs font-bold text-[#111215] dark:text-white outline-none cursor-pointer"
              >
                <option value="date">Newest</option>
                <option value="score">Highest Score</option>
                <option value="name">Candidate Name</option>
              </select>
            </div>

            {(searchTerm || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </section>

        {/* Results Table Section */}
        {loading ? (
          <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-8 shadow-xs text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-[#73766C] dark:text-neutral-400">
              Loading test submission outcomes...
            </p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-12 sm:p-16 text-center shadow-xs">
            <div className="size-14 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#8FB305] dark:text-[#D4F82C] mx-auto mb-4 shadow-2xs">
              <Clock size={24} />
            </div>
            <h3 className="text-lg font-black text-[#111215] dark:text-white">No submissions recorded yet</h3>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
              Share the assessment link with candidates or integrate it into an automated job screening pipeline. Outcomes will appear here in real time.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleCopyLink}
                className={primaryButtonClass}
              >
                <Copy size={14} />
                <span>Copy Candidate Test Link</span>
              </button>
            </div>
          </div>
        ) : filteredAndSortedSubmissions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-12 text-center shadow-xs">
            <div className="size-12 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#73766C] mx-auto mb-3">
              <Search size={20} />
            </div>
            <h3 className="text-base font-bold text-[#111215] dark:text-white">No matching candidate submissions</h3>
            <p className="text-xs text-[#73766C] dark:text-neutral-400 max-w-sm mx-auto mt-1">
              Adjust your search keywords or toggle the status filters above.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="mt-4 px-4 py-2 rounded-full bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold cursor-pointer"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                    <th className="py-3 px-4 sm:px-6">Candidate</th>
                    <th className="py-3 px-3 text-center">Score</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Integrity</th>
                    <th className="py-3 px-3 text-center">Email Dispatch</th>
                    <th className="py-3 px-4 text-center">Submitted At</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7DC]/60 dark:divide-white/5">
                  {filteredAndSortedSubmissions.map((submission) => {
                    const score = Number(submission.score) || 0;
                    const isTerminated = submission.status === 'terminated';
                    const isPassed = !isTerminated && (submission.status === 'passed' || score >= passingScore);
                    const tabSwitchCount = Number(submission.tabSwitchCount) || 0;

                    return (
                      <tr
                        key={submission.id}
                        className="hover:bg-[#F8F9F5]/70 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Candidate Info */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-bold text-[#111215] dark:text-white text-xs sm:text-sm truncate max-w-xs">
                            {submission.candidateName || 'Unnamed Candidate'}
                          </div>
                          {submission.candidateEmail && (
                            <div className="text-[11px] text-[#73766C] dark:text-neutral-400 flex items-center gap-1 mt-0.5 truncate max-w-xs">
                              <Mail size={11} className="shrink-0" />
                              <span className="truncate">{submission.candidateEmail}</span>
                            </div>
                          )}
                        </td>

                        {/* Score */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono font-black text-xs shadow-2xs ${
                              isPassed
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                : score >= 40
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                            }`}
                          >
                            <span>{score}%</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {isTerminated ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <AlertTriangle size={12} />
                              <span>Terminated</span>
                            </span>
                          ) : isPassed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs">
                              <CheckCircle2 size={12} />
                              <span>Passed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                              <XCircle size={12} />
                              <span>Failed</span>
                            </span>
                          )}
                        </td>

                        {/* Integrity */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {isTerminated ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <AlertTriangle size={12} />
                              <span>Terminated</span>
                            </span>
                          ) : tabSwitchCount > 0 || (Number(submission.copyPasteAttempts) || 0) > 0 || (Number(submission.screenshotAttempts) || 0) > 0 ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              {tabSwitchCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                                  <AlertTriangle size={11} />
                                  <span>
                                    {tabSwitchCount} switch{tabSwitchCount === 1 ? '' : 'es'}
                                  </span>
                                </span>
                              )}
                              {(Number(submission.copyPasteAttempts) || 0) > 0 && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30">
                                  <Copy size={11} />
                                  <span>
                                    {submission.copyPasteAttempts} copy/paste
                                  </span>
                                </span>
                              )}
                              {(Number(submission.screenshotAttempts) || 0) > 0 && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30">
                                  <Camera size={11} />
                                  <span>
                                    {submission.screenshotAttempts} screenshot(s)
                                  </span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">
                              <ShieldCheck size={12} />
                              <span>Clean</span>
                            </span>
                          )}
                        </td>

                        {/* Email Dispatch */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {submission.emailSent === true ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">
                              <Check size={11} />
                              <span>Sent</span>
                            </span>
                          ) : submission.emailSent === false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30">
                              <X size={11} />
                              <span>Failed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-600 dark:bg-white/5 dark:text-neutral-400 border border-slate-200 dark:border-white/10">
                              <Mail size={11} />
                              <span>Queued</span>
                            </span>
                          )}
                        </td>

                        {/* Submitted At */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap text-[11px] text-[#73766C] dark:text-neutral-400">
                          {formatDateTime(submission.submittedAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {submission.candidateUID && (
                              <button
                                type="button"
                                onClick={() => navigate(`/profile/${submission.candidateUID}`)}
                                className="size-8 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:bg-[#F1F3EB] dark:hover:bg-white/10 transition-all cursor-pointer shadow-2xs"
                                title="View candidate profile"
                              >
                                <User size={13} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedSubmission(submission)}
                              className="px-3 py-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 hover:bg-[#F1F3EB] dark:hover:bg-white/10 text-xs font-bold text-[#111215] dark:text-white transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <FileText size={12} className="text-[#8FB305] dark:text-[#D4F82C]" />
                              <span>Solution</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(submission)}
                              className="size-8 rounded-full border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                              title="Delete candidate attempt (allows retake with same ID)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-4 border-t border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] flex items-center justify-between text-xs text-[#73766C] dark:text-neutral-400">
              <span>Showing {filteredAndSortedSubmissions.length} of {submissions.length} submissions</span>
              <span>Passing benchmark: {passingScore}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Solution Review Modal */}
      {selectedSubmission && test && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setSelectedSubmission(null)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-white shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]">
                    SUBMITTED ANSWERS
                  </span>
                  <span className="text-xs text-[#73766C] dark:text-neutral-400">
                    {formatDateTime(selectedSubmission.submittedAt)}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#111215] dark:text-white">
                  {selectedSubmission.candidateName || 'Candidate Submission'}
                </h3>
                {selectedSubmission.candidateEmail && (
                  <p className="text-xs text-[#73766C] dark:text-neutral-400 mt-0.5">
                    {selectedSubmission.candidateEmail}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block">
                    Final Score
                  </span>
                  <span className="font-mono text-lg font-black text-[#111215] dark:text-[#D4F82C]">
                    {Number(selectedSubmission.score) || 0}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="size-8 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-[#73766C] hover:text-[#111215] dark:hover:text-white transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Questions Sheet Content */}
            <div className="p-5 sm:p-6 max-h-[70vh] overflow-y-auto space-y-4">
              {test.questions?.map((question: any, index: number) => {
                const candidateAnswerIndex = selectedSubmission.answers?.[index];
                const isCorrectAnswer = question.correctIndex !== undefined && candidateAnswerIndex === question.correctIndex;

                return (
                  <div
                    key={index}
                    className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5]/70 dark:bg-white/[0.02] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="size-6 rounded-lg bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white leading-snug">
                          {test.type === 'aptitude' ? question.question : question.title}
                        </h4>
                      </div>

                      {test.type === 'aptitude' && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            isCorrectAnswer
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200'
                          }`}
                        >
                          {isCorrectAnswer ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                    </div>

                    {test.type === 'aptitude' ? (
                      <div className="space-y-1.5 pl-8">
                        {question.options?.map((option: string, optionIndex: number) => {
                          const isCandidateSelected = candidateAnswerIndex === optionIndex;
                          const isCorrectOption = question.correctIndex === optionIndex;

                          let optionStyle =
                            'border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#575A51] dark:text-neutral-300';
                          if (isCorrectOption) {
                            optionStyle =
                              'border-emerald-300 dark:border-emerald-800 bg-[#EAF7E8] dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold';
                          } else if (isCandidateSelected && !isCorrectOption) {
                            optionStyle =
                              'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 font-bold';
                          }

                          return (
                            <div
                              key={optionIndex}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${optionStyle}`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`size-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                                    isCorrectOption
                                      ? 'bg-emerald-600 text-white'
                                      : isCandidateSelected
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-400'
                                  }`}
                                >
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>
                                <span>{option}</span>
                              </div>

                              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                {isCorrectOption && (
                                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    <Check size={12} strokeWidth={2.5} />
                                    <span>Correct Answer</span>
                                  </span>
                                )}
                                {isCandidateSelected && !isCorrectOption && (
                                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                    <X size={12} strokeWidth={2.5} />
                                    <span>Candidate Chose</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="pl-8 space-y-2">
                        <div className="text-[10px] font-bold uppercase text-[#73766C] dark:text-neutral-400">
                          Submitted Code:
                        </div>
                        <pre className="p-3.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-black/40 text-xs font-mono text-[#111215] dark:text-neutral-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {selectedSubmission.answers?.[index] || '// No code submitted'}
                        </pre>
                        {question.testCases && (
                          <div className="p-2.5 rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[11px] font-mono text-[#73766C] dark:text-neutral-400">
                            <span className="font-bold block text-[10px] uppercase mb-0.5">Test Cases:</span>
                            {question.testCases}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className={secondaryButtonClass}
              >
                Close Solution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestResults;
