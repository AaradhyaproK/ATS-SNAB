import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import HireXLogo from '../components/HireXLogo';
import {
  Timer,
  MonitorOff,
  ShieldAlert,
  Copy,
  ArrowRight,
  CheckCircle2,
  User,
  Mail,
  Sparkles,
  Clock,
  Target,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  getRateLimitReachedMessage,
  isRateLimitReached,
  loadCompanyRateLimitStatus,
  RateLimitResource
} from '../services/rateLimitService';

interface TestDetails {
  title: string;
  duration: number;
  recruiterUID?: string;
  type?: string;
  passingScore?: number;
  questionsCount?: number;
}

interface FetchedCandidate {
  name: string;
  email: string;
  phone?: string;
  source?: string;
}

const TestAccess: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user, userProfile } = useAuth();

  const [testDetails, setTestDetails] = useState<TestDetails | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [fetchedCandidate, setFetchedCandidate] = useState<FetchedCandidate | null>(null);
  const [isSearchingProfile, setIsSearchingProfile] = useState(false);
  const [profileSearched, setProfileSearched] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<{
    id: string;
    score: number;
    status: string;
    submittedAt?: any;
  } | null>(null);

  // Initialize with logged in user if available
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
      const displayName = userProfile?.fullname || userProfile?.name || user.displayName || '';
      if (displayName) {
        setName(displayName);
        setFetchedCandidate({ name: displayName, email: user.email, source: 'auth' });
        setProfileSearched(true);
      }
    }
  }, [user, userProfile]);

  // Fetch Test Details
  useEffect(() => {
    const fetchTestDetails = async () => {
      if (!testId) return;
      try {
        const testDoc = await getDoc(doc(db, 'tests', testId));
        if (testDoc.exists()) {
          const testData = testDoc.data() as any;
          setTestDetails({
            title: testData.title || 'Assessment',
            duration: testData.duration || 10,
            recruiterUID: testData.recruiterUID,
            type: testData.type || 'aptitude',
            passingScore: testData.passingScore || 70,
            questionsCount: Array.isArray(testData.questions) ? testData.questions.length : 0,
          });

          const resource: RateLimitResource =
            testData.type === 'coding' ? 'codingAssessments' : 'assessments';
          const rateLimitStatus = await loadCompanyRateLimitStatus();
          if (isRateLimitReached(rateLimitStatus, resource)) {
            setIsRateLimited(true);
            setError(getRateLimitReachedMessage(resource));
          }
        } else {
          setError('Assessment not found or no longer active.');
        }
      } catch (err) {
        console.error('Failed to fetch test details:', err);
        setError('Failed to load assessment details.');
      }
    };
    fetchTestDetails();
  }, [testId]);

  // Search candidate profile across collections
  const searchCandidateProfile = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFetchedCandidate(null);
      setProfileSearched(false);
      return;
    }

    setIsSearchingProfile(true);
    try {
      // 0. Check if candidate has ALREADY completed this test (Single attempt policy)
      if (testId) {
        try {
          const subSnap = await getDocs(
            query(
              collection(db, 'testSubmissions'),
              where('testId', '==', testId),
              where('candidateEmail', '==', cleanEmail)
            )
          );
          const activeDocs = subSnap.docs.filter((d) => {
            const data = d.data();
            return !data.isDeleted && data.status !== 'deleted';
          });
          if (activeDocs.length > 0) {
            const subDoc = activeDocs[0];
            const subData = subDoc.data();
            setExistingSubmission({
              id: subDoc.id,
              score: Number(subData.score) || 0,
              status: subData.status || 'completed',
              submittedAt: subData.submittedAt,
            });
          } else {
            setExistingSubmission(null);
          }
        } catch (subErr) {
          console.warn('Error checking existing submission:', subErr);
          setExistingSubmission(null);
        }
      }

      // 1. resumeDumpCandidates
      const snap1 = await getDocs(
        query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail))
      ).catch(() => null);
      if (snap1 && !snap1.empty) {
        const d = snap1.docs[0].data();
        const candName = d.name || d.fullname || d.candidateName || d.profile?.name || '';
        if (candName) {
          setFetchedCandidate({ name: candName, email: cleanEmail, phone: d.phone, source: 'resumeDumpCandidates' });
          setName(candName);
          setProfileSearched(true);
          setIsSearchingProfile(false);
          return;
        }
      }

      // 2. resumeDumpCandidates by profile.email
      const snap1b = await getDocs(
        query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanEmail))
      ).catch(() => null);
      if (snap1b && !snap1b.empty) {
        const d = snap1b.docs[0].data();
        const candName = d.profile?.name || d.name || d.fullname || '';
        if (candName) {
          setFetchedCandidate({ name: candName, email: cleanEmail, phone: d.profile?.phone || d.phone, source: 'resumeDumpCandidates' });
          setName(candName);
          setProfileSearched(true);
          setIsSearchingProfile(false);
          return;
        }
      }

      // 3. candidates
      const snap2 = await getDocs(
        query(collection(db, 'candidates'), where('email', '==', cleanEmail))
      ).catch(() => null);
      if (snap2 && !snap2.empty) {
        const d = snap2.docs[0].data();
        const candName = d.name || d.fullname || d.candidateName || '';
        if (candName) {
          setFetchedCandidate({ name: candName, email: cleanEmail, phone: d.phone, source: 'candidates' });
          setName(candName);
          setProfileSearched(true);
          setIsSearchingProfile(false);
          return;
        }
      }

      // 4. users
      const snap3 = await getDocs(
        query(collection(db, 'users'), where('email', '==', cleanEmail))
      ).catch(() => null);
      if (snap3 && !snap3.empty) {
        const d = snap3.docs[0].data();
        const candName = d.fullname || d.name || d.displayName || '';
        if (candName) {
          setFetchedCandidate({ name: candName, email: cleanEmail, phone: d.phone, source: 'users' });
          setName(candName);
          setProfileSearched(true);
          setIsSearchingProfile(false);
          return;
        }
      }

      // 5. testSubmissions
      const snap4 = await getDocs(
        query(collection(db, 'testSubmissions'), where('candidateEmail', '==', cleanEmail))
      ).catch(() => null);
      if (snap4 && !snap4.empty) {
        const d = snap4.docs[0].data();
        const candName = d.candidateName || '';
        if (candName) {
          setFetchedCandidate({ name: candName, email: cleanEmail, source: 'testSubmissions' });
          setName(candName);
          setProfileSearched(true);
          setIsSearchingProfile(false);
          return;
        }
      }

      // No profile found in system
      setFetchedCandidate(null);
      setProfileSearched(true);
    } catch (err) {
      console.warn('Error fetching candidate profile:', err);
      setFetchedCandidate(null);
      setProfileSearched(true);
    } finally {
      setIsSearchingProfile(false);
    }
  };

  // Debounced auto-fetch on typing email
  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.includes('@') && cleanEmail.includes('.') && cleanEmail.length >= 6) {
      const timer = setTimeout(() => {
        searchCandidateProfile(cleanEmail);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setFetchedCandidate(null);
      setProfileSearched(false);
    }
  }, [email]);

  const handleStartTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (existingSubmission) {
      setError('You have already submitted this assessment. Multiple attempts are not permitted under proctoring rules.');
      return;
    }

    const candidateName = (name.trim() || fetchedCandidate?.name || cleanEmail.split('@')[0]).trim();
    if (!candidateName) {
      setError('Please provide your full name.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (!testId) {
        throw new Error('Test ID is missing.');
      }

      // Rate limit check
      const rateLimitStatus = await loadCompanyRateLimitStatus();
      const resource: RateLimitResource =
        testDetails?.type === 'coding' ? 'codingAssessments' : 'assessments';
      if (isRateLimitReached(rateLimitStatus, resource)) {
        setIsRateLimited(true);
        setError(getRateLimitReachedMessage(resource));
        return;
      }

      // Save candidate info to sessionStorage so TakeTest starts immediately
      const candidatePayload = {
        name: candidateName,
        email: cleanEmail,
        source: fetchedCandidate?.source || 'direct',
      };
      sessionStorage.setItem('test_candidate_info', JSON.stringify(candidatePayload));

      // Navigate to TakeTest with query parameters
      navigate(
        `/test/start/${testId}?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(candidateName)}`
      );
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred while starting the assessment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isCoding = testDetails?.type === 'coding';

  const rules = [
    {
      icon: Timer,
      title: 'Timed Session',
      desc: `You have ${testDetails?.duration || 10} minutes to complete all questions.`,
    },
    {
      icon: MonitorOff,
      title: 'Fullscreen Active',
      desc: 'Test operates in fullscreen mode to ensure proctoring integrity.',
    },
    {
      icon: ShieldAlert,
      title: 'Zero Tab Switching',
      desc: 'Switching browser tabs or windows is logged and flagged for recruiter review.',
    },
    {
      icon: Copy,
      title: 'Anti-Plagiarism Guard',
      desc: 'Copying, pasting, and inspect shortcuts are strictly monitored.',
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-3 sm:p-5 lg:p-6 bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,248,44,0.06),transparent_40rem)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(212,248,44,0.03),transparent_40rem)]" />

      {/* Top Header Logo Bar */}
      <header className="w-full max-w-xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center justify-between py-2 sm:py-3 mb-2">
        <HireXLogo size="md" variant="full" withLink to="/" isDark={isDark} />
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-white/5 text-[11px] font-bold shadow-2xs">
          <span className="size-1.5 rounded-full bg-[#8FB305] dark:bg-[#D4F82C] animate-pulse" />
          <span>Proctored Screen</span>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="relative w-full max-w-xl lg:max-w-5xl xl:max-w-6xl rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-7 lg:p-8 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Assessment Info & Integrity Rules (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#D4F82C] text-[#111215] shadow-xs">
                <Sparkles size={11} className="fill-[#111215]" />
                <span>{isCoding ? 'CODING CHALLENGE' : 'APTITUDE ASSESSMENT'}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-300">
                <Clock size={11} />
                <span>{testDetails?.duration || 10} Minutes</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-300">
                <Target size={11} />
                <span>{testDetails?.passingScore || 70}% Pass Benchmark</span>
              </span>
              {Boolean(testDetails?.questionsCount) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-300">
                  <HelpCircle size={11} />
                  <span>{testDetails?.questionsCount} Questions</span>
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-white tracking-tight">
                {testDetails?.title || 'Candidate Assessment'}
              </h1>
              <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 mt-1 leading-relaxed">
                Welcome! Enter your email address to sync your profile and begin this evaluation. No access code required.
              </p>
            </div>

            {/* Proctoring & Examination Rules */}
            <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5]/70 dark:bg-white/[0.02] p-3.5 sm:p-4 space-y-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                Assessment Guidelines & Integrity Rules
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2 sm:p-2.5 rounded-xl border border-[#E4E7DC] dark:border-white/5 bg-white dark:bg-[#1D1F24] flex items-start gap-2.5 text-xs shadow-2xs"
                  >
                    <div className="size-6 sm:size-7 rounded-lg bg-[#F8F9F5] dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5 text-[#111215] dark:text-[#D4F82C]">
                      <rule.icon size={13} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-[#111215] dark:text-white text-[11px] leading-tight">
                        {rule.title}
                      </h4>
                      <p className="text-[10px] text-[#73766C] dark:text-neutral-400 mt-0.5 leading-snug">
                        {rule.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Laptop footer strip */}
            <div className="hidden lg:flex items-center gap-3 pt-2 text-[11px] text-[#73766C] dark:text-neutral-400">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                Protected by InterviewXpert AI Proctoring
              </span>
              <span>•</span>
              <span>Encrypted Transport</span>
            </div>
          </div>

          {/* Right Column: Candidate Entry Panel (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5]/50 dark:bg-white/[0.02] p-4 sm:p-5 space-y-4 min-w-0">
            <div className="pb-2 border-b border-[#E4E7DC] dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#111215] dark:text-white block">Candidate Check-in</span>
                <span className="text-[10px] text-[#73766C] dark:text-neutral-400">Enter your email to verify identity</span>
              </div>
              <div className="size-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                1/2
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-3 rounded-2xl border border-red-500/20 bg-red-500/10 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span className="min-w-0 flex-1 leading-snug">{error}</span>
              </div>
            )}

            {/* Candidate Entry Form */}
            {testDetails && !isRateLimited ? (
              <form onSubmit={handleStartTest} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5] flex items-center justify-between">
                    <span>Enter Your Email Address</span>
                    {isSearchingProfile && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="size-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span>Searching...</span>
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C]"
                      size={15}
                    />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#101114] text-xs sm:text-sm font-semibold text-[#111215] dark:text-white placeholder:text-[#73766C] outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C]"
                    />
                  </div>
                </div>

                {/* Profile Found Card */}
                {fetchedCandidate ? (
                  <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800/40 bg-emerald-50/80 dark:bg-emerald-950/20 flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-9 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {(fetchedCandidate.name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-[#111215] dark:text-white truncate">
                            {fetchedCandidate.name}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-600 text-white shadow-2xs shrink-0">
                            <Check size={8} strokeWidth={3} />
                            <span>Verified</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium truncate mt-0.5">
                          Profile matched from talent pool • Ready to start
                        </p>
                      </div>
                    </div>
                  </div>
                ) : profileSearched && email.includes('@') ? (
                  /* New Candidate: Name Input */
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5] flex items-center justify-between">
                      <span>Full Name</span>
                      <span className="text-[10px] text-[#73766C] dark:text-neutral-400">
                        First time candidate
                      </span>
                    </label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C]"
                        size={15}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Enter your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#101114] text-xs sm:text-sm font-semibold text-[#111215] dark:text-white placeholder:text-[#73766C] outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C]"
                      />
                    </div>
                  </div>
                ) : null}

                {/* Previous Submission Warning Card */}
                {existingSubmission ? (
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#111215] dark:text-neutral-200 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                        <AlertCircle size={14} className="shrink-0" />
                        <span className="truncate">Assessment Already Completed</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0">
                        Single Attempt
                      </span>
                    </div>
                    <p className="text-[11px] text-[#575A51] dark:text-neutral-400 leading-snug">
                      You already took this assessment and scored{' '}
                      <strong className="font-mono text-[#111215] dark:text-white font-bold">
                        {existingSubmission.score}%
                      </strong>{' '}
                      ({existingSubmission.status}). Re-attempts are blocked unless your previous attempt is deleted by the recruiter.
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[10px] text-[#73766C] dark:text-neutral-400 border-t border-amber-500/20">
                      <span>Score: <strong className="text-[#111215] dark:text-white font-mono">{existingSubmission.score}%</strong></span>
                      <span className="capitalize font-semibold text-emerald-600 dark:text-emerald-400">Submission Recorded</span>
                    </div>
                  </div>
                ) : null}

                {/* Start Button */}
                {existingSubmission ? (
                  <button
                    type="button"
                    disabled
                    className="w-full h-11 rounded-full font-bold text-xs uppercase tracking-wider bg-[#E4E7DC] dark:bg-white/10 text-[#73766C] dark:text-neutral-400 cursor-not-allowed shadow-none"
                  >
                    Already Submitted ({existingSubmission.score}%) • Blocked
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading || isSearchingProfile || !email.trim()}
                    className="w-full h-11 rounded-full font-bold text-xs sm:text-sm bg-[#111215] text-[#D4F82C] hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
                  >
                    {isLoading ? (
                      <>
                        <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Launching Assessment...</span>
                      </>
                    ) : (
                      <>
                        <span>Start Assessment</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                )}
              </form>
            ) : (
              !error && (
                <div className="py-6 text-center text-xs text-[#73766C] dark:text-neutral-400 space-y-2">
                  <div className="size-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                  <p>Loading assessment details...</p>
                </div>
              )
            )}

            {/* Mobile-only footer */}
            <div className="lg:hidden pt-2 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between text-[10px] text-[#73766C] dark:text-neutral-400">
              <span>Protected by InterviewXpert AI</span>
              <span>Encrypted Transport</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default TestAccess;
