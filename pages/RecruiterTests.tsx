import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
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
  AlertCircle,
  Edit3,
  UserPlus,
  Mail,
  Phone,
  MessageCircle,
  UserCheck,
  X,
  Send,
  UploadCloud,
  CheckCheck
} from 'lucide-react';
import { useMessageBox } from '../components/MessageBox';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';
import { getRateLimitReachedMessage, isRateLimitReached, RateLimitResource } from '../services/rateLimitService';
import { sendInterviewInvitations } from '../services/sesService';
import {
  formatPhoneForWhatsApp,
  openWhatsAppWebInvite,
  sendInterviewWhatsAppInvite
} from '../services/waSenderService';

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

  // Candidate Invitation Modal State
  const [invitingTest, setInvitingTest] = useState<any | null>(null);
  const [inviteMode, setInviteMode] = useState<'ai_suggest' | 'bulk' | 'invited'>('ai_suggest');
  const [inviteEmailsList, setInviteEmailsList] = useState<string[]>([]);
  const [candidateEmailsInput, setCandidateEmailsInput] = useState('');
  const [singleCandidateName, setSingleCandidateName] = useState('');
  const [singleCandidateEmail, setSingleCandidateEmail] = useState('');
  const [singleCandidatePhone, setSingleCandidatePhone] = useState('');
  const [dumpCandidates, setDumpCandidates] = useState<any[]>([]);
  const [loadingDumpCandidates, setLoadingDumpCandidates] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendEmailChannel, setSendEmailChannel] = useState(true);
  const [sendWhatsAppChannel, setSendWhatsAppChannel] = useState(false);
  const [copiedModalLink, setCopiedModalLink] = useState(false);
  const [remindingEmail, setRemindingEmail] = useState<string | null>(null);

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

  // Fetch candidate dump for AI recommendations when invite modal opens
  useEffect(() => {
    if (!invitingTest) return;
    setLoadingDumpCandidates(true);
    getDocs(query(collection(db, 'resumeDumpCandidates')))
      .then((snap) => {
        const list = snap.docs
          .map((snapshotDoc) => {
            const data = snapshotDoc.data();
            const prof = data.profile && typeof data.profile === 'object' ? data.profile : {};
            const email = (data.email || prof.email || '').toLowerCase().trim();
            const name = data.name || prof.name || 'Candidate';
            const phone = data.phone || prof.phone || '';
            const location = data.location || prof.location || data.city || prof.city || '';
            const skills = Array.isArray(data.skills)
              ? data.skills
              : Array.isArray(prof.skills)
              ? prof.skills
              : [];
            const domain = data.domain || prof.domain || '';
            const currentTitle = data.currentTitle || prof.currentTitle || data.sourceJobTitle || '';
            const experienceYears =
              data.totalExperienceYears ??
              data.experienceYears ??
              prof.totalExperienceYears ??
              prof.experienceYears ??
              0;

            return {
              id: snapshotDoc.id,
              name,
              email,
              phone,
              location,
              skills,
              domain,
              currentTitle,
              experienceYears,
            };
          })
          .filter((c) => Boolean(c.email));
        setDumpCandidates(list);
      })
      .catch((err) => {
        console.warn('Error loading dump candidates for suggestions:', err);
      })
      .finally(() => {
        setLoadingDumpCandidates(false);
      });
  }, [invitingTest]);

  // AI Matching for Test Invitations based on test title and candidate skills/domain
  const suggestedCandidates = useMemo(() => {
    if (!invitingTest || !dumpCandidates.length) return [];
    const alreadyInvited = (invitingTest.candidateEmails || []).map((e: string) => e.toLowerCase().trim());
    const testTitleLower = (invitingTest.title || '').toLowerCase();
    const testKeywords = testTitleLower
      .split(/[\s,/\-_()]+/)
      .map((w: string) => w.trim())
      .filter((w: string) => w.length > 2);

    return dumpCandidates
      .filter((c) => !alreadyInvited.includes(c.email))
      .map((c) => {
        let matchScore = 55;
        const candSkills = c.skills.map((s: string) => s.toLowerCase());
        const candTitle = (c.currentTitle || '').toLowerCase();
        const candDomain = (c.domain || '').toLowerCase();

        testKeywords.forEach((kw: string) => {
          if (candSkills.some((s: string) => s.includes(kw))) matchScore += 18;
          if (candTitle.includes(kw)) matchScore += 22;
          if (candDomain.includes(kw)) matchScore += 12;
        });

        if (
          invitingTest.type === 'coding' &&
          candSkills.some((s: string) =>
            ['javascript', 'typescript', 'react', 'python', 'java', 'c++', 'golang', 'node', 'full stack'].includes(s)
          )
        ) {
          matchScore += 10;
        }

        return { ...c, matchScore: Math.min(99, matchScore) };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [invitingTest, dumpCandidates]);

  const toggleCandidateInInviteList = (email: string) => {
    const target = email.toLowerCase().trim();
    if (!target) return;
    setInviteEmailsList((prev) =>
      prev.includes(target) ? prev.filter((e) => e !== target) : [...prev, target]
    );
  };

  const handleSelectAllSuggested = () => {
    const allSuggestedEmails = suggestedCandidates.slice(0, 20).map((c) => c.email);
    setInviteEmailsList((prev) => Array.from(new Set([...prev, ...allSuggestedEmails])));
    showSuccess(`Selected top ${Math.min(20, suggestedCandidates.length)} AI suggested candidates!`);
  };

  const handleClearSelectedInvites = () => {
    setInviteEmailsList([]);
    showSuccess('Cleared selected candidates from invite list.');
  };

  const handleAddSingleCandidate = () => {
    const email = singleCandidateEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    if (inviteEmailsList.includes(email)) {
      showError('This candidate is already in the invite list.');
      return;
    }
    setInviteEmailsList((prev) => [...prev, email]);
    if (singleCandidateName || singleCandidatePhone) {
      setDumpCandidates((prev) => [
        {
          id: `manual_${Date.now()}`,
          name: singleCandidateName.trim() || email.split('@')[0],
          email,
          phone: singleCandidatePhone.trim(),
          skills: [],
          experienceYears: 0,
        },
        ...prev,
      ]);
    }
    setSingleCandidateName('');
    setSingleCandidateEmail('');
    setSingleCandidatePhone('');
    showSuccess(`Added ${email} to invite list!`);
  };

  const handleAddBulkEmailsFromText = () => {
    const extracted = candidateEmailsInput
      .split(/[\n,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (extracted.length === 0) {
      showError('No valid email addresses found in pasted text.');
      return;
    }

    let added = 0;
    setInviteEmailsList((prev) => {
      const set = new Set(prev);
      extracted.forEach((em) => {
        if (!set.has(em)) {
          set.add(em);
          added++;
        }
      });
      return Array.from(set);
    });

    setCandidateEmailsInput('');
    showSuccess(`Added ${added} new candidate email(s) to invite list!`);
  };

  const handleSendTestInvites = async () => {
    if (!invitingTest) return;

    const parsedTextareaEmails = candidateEmailsInput
      .split(/[\n,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    const finalEmails = Array.from(new Set([...inviteEmailsList, ...parsedTextareaEmails]));

    if (finalEmails.length === 0) {
      showError('Please select or add at least one candidate email to invite.');
      return;
    }

    if (!sendEmailChannel && !sendWhatsAppChannel) {
      showError('Please select at least one delivery channel (Email or WhatsApp).');
      return;
    }

    setSendingInvites(true);
    const testLink = getAssessmentLink(invitingTest.id);
    const existingCandidateEmails = invitingTest.candidateEmails || [];
    const updatedCandidateEmails = Array.from(new Set([...existingCandidateEmails, ...finalEmails]));

    const candidateDataToAdd = finalEmails.map((email) => {
      const match = dumpCandidates.find((c) => c.email.toLowerCase() === email);
      return {
        email,
        name: match?.name || email.split('@')[0] || 'Candidate',
        phone: match?.phone || '',
        experience: match?.experienceYears ? `${match.experienceYears} Years` : 'N/A',
        invitedAt: new Date().toISOString(),
      };
    });

    try {
      const testRef = doc(db, 'tests', invitingTest.id);
      await updateDoc(testRef, {
        candidateEmails: updatedCandidateEmails,
        candidateData: arrayUnion(...candidateDataToAdd),
        updatedAt: serverTimestamp(),
      });

      if (sendEmailChannel) {
        await sendInterviewInvitations(
          candidateDataToAdd,
          invitingTest.title,
          testLink,
          invitingTest.accessCode || '',
          false,
          {
            recruiterName: userProfile?.name || 'InterviewXpert Team',
            recruiterEmail: userProfile?.email || 'info@interviewxpert.in',
            recruiterUid: userProfile?.uid,
          }
        );
      }

      if (sendWhatsAppChannel) {
        for (const cand of candidateDataToAdd) {
          if (cand.phone) {
            const formattedPhone = formatPhoneForWhatsApp(cand.phone);
            try {
              await sendInterviewWhatsAppInvite({
                phone: formattedPhone,
                candidateName: cand.name,
                jobTitle: invitingTest.title,
                interviewLink: testLink,
                accessCode: invitingTest.accessCode || '',
                isReminder: false,
              });
            } catch {
              // Non-blocking fallback
            }
          }
        }
      }

      setTests((prev) =>
        prev.map((t) =>
          t.id === invitingTest.id ? { ...t, candidateEmails: updatedCandidateEmails } : t
        )
      );

      showSuccess(`✅ Invitations dispatched to ${finalEmails.length} candidate(s)!`);
      setInvitingTest(null);
      setInviteEmailsList([]);
      setCandidateEmailsInput('');
    } catch (err: any) {
      console.error('Failed to dispatch test invitations:', err);
      showError(err?.message || 'Failed to send assessment invitations.');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleSendSingleReminder = async (email: string) => {
    if (!invitingTest) return;
    setRemindingEmail(email);
    const testLink = getAssessmentLink(invitingTest.id);
    const match = dumpCandidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
    const candName = match?.name || email.split('@')[0] || 'Candidate';

    try {
      await sendInterviewInvitations(
        [{ email, name: candName, phone: match?.phone || '' }],
        invitingTest.title,
        testLink,
        invitingTest.accessCode || '',
        true,
        {
          recruiterName: userProfile?.name || 'InterviewXpert Team',
          recruiterEmail: userProfile?.email || 'info@interviewxpert.in',
        }
      );
      showSuccess(`Assessment reminder sent to ${email}!`);
    } catch (err: any) {
      showError(err?.message || 'Failed to send reminder email.');
    } finally {
      setRemindingEmail(null);
    }
  };

  const handleSendWhatsAppReminder = (email: string) => {
    if (!invitingTest) return;
    const testLink = getAssessmentLink(invitingTest.id);
    const match = dumpCandidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
    const candName = match?.name || email.split('@')[0] || 'Candidate';
    const rawPhone = match?.phone || '';
    const formattedPhone = formatPhoneForWhatsApp(rawPhone);

    if (!formattedPhone) {
      showError(`Mobile number missing for ${email}. Please ensure a valid phone number is registered.`);
      return;
    }

    const text = `Hi ${candName}! Reminder for your assessment invite for ${invitingTest.title} on InterviewXpert ATS.\n\nStart your test here: ${testLink}\n\nPassing benchmark: ${invitingTest.passingScore || 70}%.`;
    openWhatsAppWebInvite(formattedPhone, text);
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

  const secondaryButtonClass = "inline-flex h-9 sm:h-10 items-center justify-center rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-3 sm:px-4 font-bold text-xs text-[#111215] dark:text-white transition-all hover:bg-[#F1F3EB] dark:hover:bg-white/10 cursor-pointer shadow-2xs gap-1.5 sm:gap-2 shrink-0 disabled:cursor-not-allowed disabled:opacity-40";
  const primaryButtonClass = "inline-flex h-9 sm:h-10 items-center justify-center rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] px-4 sm:px-5 font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 gap-1.5 sm:gap-2 shrink-0";

  return (
    <div className="w-full min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
      
      {/* Header */}
      <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#0D0E11] px-4 py-5 sm:py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-2">
              <Link
                to="/recruiter/jobs"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:border-[#111215] dark:hover:border-white/30 transition-all shadow-2xs shrink-0"
              >
                <ArrowLeft size={13} />
                <span>Dashboard</span>
              </Link>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] font-bold text-[#111215] dark:text-[#F8F9F5] shadow-2xs max-w-full">
                <span className="size-2 rounded-full bg-[#8FB305] dark:bg-[#D4F82C] animate-pulse shrink-0"></span>
                <span className="font-mono uppercase text-[10px] text-[#73766C] dark:text-neutral-400 shrink-0">ASSESSMENT STUDIO</span>
                <span className="text-[#E4E7DC] dark:text-white/20">|</span>
                <span className="truncate">Screening & Evaluation Hub</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-[#F8F9F5] tracking-tight">
              Assessments
            </h1>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Review candidate assessment performance, generate secure test links, and manage automated screening tests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
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
          <div className="max-w-7xl mx-auto mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 sm:p-4 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 flex items-start sm:items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 mt-0.5 sm:mt-0" />
            <span className="min-w-0 flex-1 leading-snug">{getRateLimitReachedMessage('assessments')}</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8 space-y-6">

        {/* 6 Bento Metric Stat Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          
          {/* Total */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Total Tests</span>
              <div className="size-6 sm:size-7 rounded-lg bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#111215] dark:text-white shrink-0">
                <Layers size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{tests.length}</p>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">Active in bank</p>
            </div>
          </div>

          {/* Aptitude */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Aptitude</span>
              <div className="size-6 sm:size-7 rounded-lg bg-[#F4F9EB] dark:bg-emerald-950/20 border border-[#D2E7B3] dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <FileText size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.aptitude}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">MCQ evaluations</p>
            </div>
          </div>

          {/* Coding */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Coding</span>
              <div className="size-6 sm:size-7 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Code size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.coding}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">Coding challenges</p>
            </div>
          </div>

          {/* Submissions */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Submissions</span>
              <div className="size-6 sm:size-7 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Users size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.submissions}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">Candidates tested</p>
            </div>
          </div>

          {/* Passed */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Passed</span>
              <div className="size-6 sm:size-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">{overviewStats.passed}</p>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">{overviewStats.passRate}% pass rate</p>
            </div>
          </div>

          {/* Avg Score */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Avg Score</span>
              <div className="size-6 sm:size-7 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <TrendingUp size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 truncate">{overviewStats.averageScore}%</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">Overall cohort</p>
            </div>
          </div>

        </section>

        {/* Filter and Search Bar */}
        <section className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative w-full md:flex-1 md:max-w-md min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C]" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search assessments by title, code or ID..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C]"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2 shrink-0">
            <span className="text-xs font-bold text-[#73766C] dark:text-neutral-400 mr-1 shrink-0">Format:</span>
            <div className="flex p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] shrink-0">
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
                className="px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 transition-colors cursor-pointer shrink-0"
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
              const invitedCount = (test.candidateEmails || []).length;

              return (
                <article
                  key={test.id}
                  className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-4 hover:border-[#111215]/30 dark:hover:border-white/20 min-w-0"
                >
                  {/* Top Bar: Title, Badges, Quick Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E7DC] dark:border-white/10">
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className={`size-11 rounded-2xl flex items-center justify-center font-bold shadow-2xs shrink-0 ${
                        isCoding
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40'
                          : 'bg-[#F4F9EB] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-[#D2E7B3] dark:border-emerald-800/40'
                      }`}>
                        {isCoding ? <Code size={20} /> : <FileText size={20} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => navigate(`/recruiter/tests/${test.id}/results`)}
                            className="text-base sm:text-lg font-black text-[#111215] dark:text-white hover:text-emerald-600 dark:hover:text-[#D4F82C] text-left transition-colors cursor-pointer truncate max-w-full"
                            title={test.title}
                          >
                            {test.title}
                          </button>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                            isCoding
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          }`}>
                            {isCoding ? 'Coding Challenge' : 'Aptitude Assessment'}
                          </span>
                        </div>
                        <p className="text-xs text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">
                          Created on {formatDate(test.createdAt)} • {test.questions?.length || 0} questions • {test.duration || 10}m duration
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/recruiter/tests/${test.id}/edit`)}
                        className={secondaryButtonClass}
                        title="Edit Assessment"
                      >
                        <Edit3 size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(test.id)}
                        className="size-9 sm:size-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-all cursor-pointer shrink-0"
                        title="Delete assessment"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Bento Info Box (Clean metrics strip) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                      <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase tracking-wider">Duration</span>
                      <span className="text-sm sm:text-base font-black font-mono text-[#111215] dark:text-white block mt-0.5">{test.duration || 10}m</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                      <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase tracking-wider">Pass Benchmark</span>
                      <span className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">{test.passingScore || 70}%</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                      <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase tracking-wider">Submissions</span>
                      <span className="text-sm sm:text-base font-black font-mono text-[#111215] dark:text-white block mt-0.5">{stats.submissions}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center">
                      <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase tracking-wider">Avg Score</span>
                      <span className="text-sm sm:text-base font-black font-mono text-amber-600 dark:text-amber-400 block mt-0.5">{stats.averageScore}%</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-center col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 block uppercase tracking-wider">Invited</span>
                      <span className="text-sm sm:text-base font-black font-mono text-blue-600 dark:text-blue-400 block mt-0.5">
                        {invitedCount} candidate{invitedCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Row (NO raw url bar, NO code box) */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E4E7DC]/60 dark:border-white/5">
                    {/* Left Quick Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(testLink, 'Candidate assessment link copied to clipboard.')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-xs font-bold text-[#111215] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shadow-2xs"
                        title="Copy candidate assessment URL"
                      >
                        <Copy size={13} />
                        <span>Copy Link</span>
                      </button>

                      <a
                        href={testLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-xs font-bold text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-2xs"
                        title="Preview test taking experience"
                      >
                        <ExternalLink size={13} />
                        <span>Preview Test</span>
                      </a>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center gap-2 self-stretch sm:self-auto">
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
                        onClick={() => {
                          setInvitingTest(test);
                          setInviteMode('ai_suggest');
                          setInviteEmailsList([]);
                          setCandidateEmailsInput('');
                        }}
                        className="inline-flex h-9 sm:h-10 items-center justify-center rounded-full bg-[#111215] text-[#D4F82C] hover:bg-black dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] px-5 font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer gap-2 shrink-0 active:scale-95"
                      >
                        <UserPlus size={15} />
                        <span>Invite Candidates</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Invite Candidate Modal ── */}
      {invitingTest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setInvitingTest(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl flex flex-col overflow-hidden max-h-[92vh] font-sans animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/10 bg-white/95 dark:bg-[#15161A]/95 px-6 py-4.5 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center shadow-xs shrink-0 font-bold">
                  <UserPlus className="w-5 h-5 text-[#111215]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-[#111215] dark:text-white">
                      Invite Candidates to Assessment
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#111215]/5 dark:bg-white/10 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC] dark:border-white/10 truncate max-w-xs">
                      {invitingTest.title}
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                      invitingTest.type === 'coding'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {invitingTest.type === 'coding' ? 'Coding Challenge' : 'Aptitude Test'}
                    </span>
                  </div>
                  <p className="text-xs text-[#575A51] dark:text-neutral-400 font-medium mt-0.5">
                    Send verified test invites with anti-cheating browser lock via Email or WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInvitingTest(null)}
                className="size-9 rounded-full flex items-center justify-center text-[#575A51] hover:text-[#111215] dark:hover:text-white hover:bg-[#E4E7DC]/60 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto [scrollbar-color:#c2c5ba_transparent] [scrollbar-width:thin]">
              {/* Direct Link Preview & Copy Card */}
              <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                    Direct Candidate Test URL
                  </span>
                  <div className="flex items-center gap-3 text-xs text-[#575A51] dark:text-neutral-400">
                    <span>Duration: <strong className="text-[#111215] dark:text-white font-mono">{invitingTest.duration || 10}m</strong></span>
                    <span>•</span>
                    <span>Pass Benchmark: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{invitingTest.passingScore || 70}%</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs font-mono text-[#111215] dark:text-neutral-200 truncate select-all">
                    {getAssessmentLink(invitingTest.id)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getAssessmentLink(invitingTest.id));
                      setCopiedModalLink(true);
                      showSuccess('Assessment link copied to clipboard!');
                      setTimeout(() => setCopiedModalLink(false), 2500);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
                  >
                    {copiedModalLink ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
                    <span>{copiedModalLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={getAssessmentLink(invitingTest.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="size-9 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white transition-colors shrink-0 shadow-2xs"
                    title="Preview assessment taking view"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              {/* Bento Tab Selector */}
              <div className="flex items-center gap-1.5 p-1.5 bg-[#E4E7DC]/60 dark:bg-white/5 rounded-2xl flex-wrap">
                <button
                  type="button"
                  onClick={() => setInviteMode('ai_suggest')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[140px] cursor-pointer ${
                    inviteMode === 'ai_suggest'
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Suggest AI Candidates</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInviteMode('bulk')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[120px] cursor-pointer ${
                    inviteMode === 'bulk'
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Add / Bulk Import</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInviteMode('invited')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[130px] cursor-pointer ${
                    inviteMode === 'invited'
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Invited Candidates ({(invitingTest.candidateEmails || []).length})</span>
                </button>
              </div>

              {/* TAB 1: AI Suggested Candidates */}
              {inviteMode === 'ai_suggest' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#111215] dark:text-white">
                      Top Recommended Candidates from Talent Pool ({suggestedCandidates.length})
                    </span>
                    {suggestedCandidates.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllSuggested}
                          className="text-[11px] font-bold text-[#8FB305] dark:text-[#D4F82C] hover:underline cursor-pointer"
                        >
                          + Select Top 20 Candidates
                        </button>
                        {inviteEmailsList.length > 0 && (
                          <>
                            <span className="text-[#E4E7DC] dark:text-white/20">|</span>
                            <button
                              type="button"
                              onClick={handleClearSelectedInvites}
                              className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                            >
                              Clear Selection
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {loadingDumpCandidates ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 rounded-2xl bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 animate-pulse" />
                      ))}
                    </div>
                  ) : suggestedCandidates.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-center text-xs text-[#73766C] dark:text-neutral-400 space-y-1">
                      <p className="font-bold text-[#111215] dark:text-white">All relevant candidates are already invited</p>
                      <p>Upload new resumes in Resume Dump or use the "Add / Bulk Import" tab to invite candidates directly.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {suggestedCandidates.slice(0, 30).map((cand) => {
                        const isSelected = inviteEmailsList.includes(cand.email);
                        return (
                          <div
                            key={cand.id}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-[#111215] dark:border-[#D4F82C] bg-white dark:bg-white/10 shadow-xs'
                                : 'border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#111215]/40'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#111215] dark:text-white truncate">
                                  {cand.name}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                                  {cand.matchScore}% Match
                                </span>
                                {cand.experienceYears > 0 && (
                                  <span className="text-[10px] text-[#73766C] dark:text-neutral-400">
                                    • {cand.experienceYears}y exp
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-[#73766C] dark:text-neutral-400 truncate">
                                <span className="truncate">{cand.email}</span>
                                {cand.phone && <span>• {cand.phone}</span>}
                                {cand.location && <span>• {cand.location}</span>}
                              </div>
                              {Array.isArray(cand.skills) && cand.skills.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  {cand.skills.slice(0, 4).map((sk: string, sIdx: number) => (
                                    <span
                                      key={sIdx}
                                      className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#F8F9F5] dark:bg-white/10 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC]/60 dark:border-white/10"
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleCandidateInInviteList(cand.email)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                isSelected
                                  ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                                  : 'border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white hover:bg-black/5'
                              }`}
                            >
                              {isSelected ? '✓ Added' : '+ Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Add / Bulk Import */}
              {inviteMode === 'bulk' && (
                <div className="space-y-4">
                  {/* Single Candidate Input */}
                  <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block">
                      Add Single Candidate Directly
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={singleCandidateName}
                        onChange={(e) => setSingleCandidateName(e.target.value)}
                        placeholder="Candidate Name"
                        className="px-3 py-2 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs outline-none focus:border-[#111215] dark:focus:border-[#D4F82C]"
                      />
                      <input
                        type="email"
                        value={singleCandidateEmail}
                        onChange={(e) => setSingleCandidateEmail(e.target.value)}
                        placeholder="Candidate Email *"
                        className="px-3 py-2 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs outline-none focus:border-[#111215] dark:focus:border-[#D4F82C]"
                      />
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={singleCandidatePhone}
                          onChange={(e) => setSingleCandidatePhone(e.target.value)}
                          placeholder="Phone (Optional)"
                          className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs outline-none focus:border-[#111215] dark:focus:border-[#D4F82C]"
                        />
                        <button
                          type="button"
                          onClick={handleAddSingleCandidate}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:opacity-90 cursor-pointer shadow-xs shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Paste Multiple Emails */}
                  <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block">
                        Paste Multiple Emails (Comma or Newline separated)
                      </label>
                      {candidateEmailsInput.trim() && (
                        <button
                          type="button"
                          onClick={handleAddBulkEmailsFromText}
                          className="text-xs font-bold text-[#8FB305] dark:text-[#D4F82C] hover:underline cursor-pointer"
                        >
                          Extract & Add Emails →
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={candidateEmailsInput}
                      onChange={(e) => setCandidateEmailsInput(e.target.value)}
                      placeholder="e.g. dev@example.com, alex@tech.org, priya@startup.in"
                      className="w-full p-3 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs font-mono outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] resize-none"
                    />
                  </div>

                  {/* Currently Selected Candidate Emails Chips */}
                  {inviteEmailsList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#111215] dark:text-white">
                          Candidates Selected for Invitation ({inviteEmailsList.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSelectedInvites}
                          className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                        {inviteEmailsList.map((em) => (
                          <span
                            key={em}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-[#F8F9F5] dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white"
                          >
                            <span>{em}</span>
                            <button
                              type="button"
                              onClick={() => toggleCandidateInInviteList(em)}
                              className="hover:text-rose-500 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Already Invited Candidates */}
              {inviteMode === 'invited' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-[#111215] dark:text-white block">
                    Already Invited Candidates ({(invitingTest.candidateEmails || []).length})
                  </span>

                  {(!invitingTest.candidateEmails || invitingTest.candidateEmails.length === 0) ? (
                    <div className="p-8 rounded-2xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-center text-xs text-[#73766C] dark:text-neutral-400">
                      No candidates have been invited to this assessment yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {invitingTest.candidateEmails.map((email: string, idx: number) => {
                        const match = dumpCandidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
                        const name = match?.name || email.split('@')[0] || 'Candidate';
                        const isReminding = remindingEmail === email;

                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[#111215] dark:text-white truncate">{name}</p>
                              <p className="text-[11px] text-[#73766C] dark:text-neutral-400 font-mono truncate">{email}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {match?.phone && (
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppReminder(email)}
                                  className="px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
                                  title="Send WhatsApp reminder"
                                >
                                  <MessageCircle size={12} />
                                  <span>WhatsApp</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSendSingleReminder(email)}
                                disabled={isReminding}
                                className="px-2.5 py-1.5 rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#111215] dark:text-white text-[11px] font-bold hover:bg-black/5 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                <Mail size={12} />
                                <span>{isReminding ? 'Sending...' : 'Remind'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Channel Toggles */}
              <div className="p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                  Notification Channels:
                </span>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendEmailChannel}
                      onChange={(e) => setSendEmailChannel(e.target.checked)}
                      className="rounded text-[#111215] dark:text-[#D4F82C] accent-[#111215] cursor-pointer"
                    />
                    <span className="text-[#111215] dark:text-white flex items-center gap-1">
                      <Mail size={13} />
                      <span>Email Invitation</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendWhatsAppChannel}
                      onChange={(e) => setSendWhatsAppChannel(e.target.checked)}
                      className="rounded text-[#111215] dark:text-[#D4F82C] accent-[#111215] cursor-pointer"
                    />
                    <span className="text-[#111215] dark:text-white flex items-center gap-1">
                      <MessageCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>WhatsApp Message</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-[#E4E7DC] dark:border-white/10 bg-white/95 dark:bg-[#15161A]/95 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#575A51] dark:text-neutral-400 font-medium">
                <strong className="text-[#111215] dark:text-white font-mono text-sm">{inviteEmailsList.length}</strong> candidate(s) selected
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInvitingTest(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTestInvites}
                  disabled={sendingInvites || (inviteEmailsList.length === 0 && !candidateEmailsInput.trim())}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>{sendingInvites ? 'Dispatching Invites...' : 'Send Invitations'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterTests;
