import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Bug,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  Brain,
  Building2,
  ExternalLink,
  ChevronRight,
  Activity,
  Award,
} from 'lucide-react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import HireXLogo, { HireXMark } from '../components/HireXLogo';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'signup' | 'reset';

const AuthPage: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);
  const [showVerifyErrorPopup, setShowVerifyErrorPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [experience, setExperience] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!authLoading && user) {
      const role =
        userProfile?.role ||
        (user.email === 'admin@snab.co.in' || user.email?.includes('admin')
          ? 'admin'
          : 'recruiter');
      if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/recruiter/jobs', { replace: true });
      }
    }
  }, [user, userProfile, authLoading, navigate]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both your email and password.');
      setLoading(false);
      return;
    }

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);

      let userData: any = {};
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        userData = userDoc.data() || {};
      } catch (docErr) {
        console.warn('Could not fetch user document from Firestore:', docErr);
      }

      const isAdminEmail = cleanEmail === 'admin@snab.co.in' || cleanEmail.includes('admin');
      const userRole = userData.role || (isAdminEmail ? 'admin' : 'recruiter');

      if (userRole !== 'admin') {
        if (!userCredential.user.emailVerified && !userData.adminVerified) {
          await signOut(auth);
          setShowVerifyErrorPopup(true);
          return;
        }
      }

      if (userRole !== 'recruiter' && userRole !== 'admin') {
        await signOut(auth);
        setError(
          'This InterviewXpert portal is only for recruiters and admins. Candidates should use the interview or assessment link sent to them.'
        );
        return;
      }

      if (userRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/recruiter/jobs');
      }
    } catch (err: any) {
      console.error('Firebase Auth Login Error:', err);
      const code = err.code || '';
      const rawMsg = err.message || '';

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        rawMsg.includes('INVALID_LOGIN_CREDENTIALS') ||
        rawMsg.includes('EMAIL_NOT_FOUND') ||
        rawMsg.includes('INVALID_PASSWORD')
      ) {
        setError('Invalid email or password. Please verify your credentials or ensure this account was registered in Firebase Auth.');
      } else if (code === 'auth/invalid-email' || rawMsg.includes('INVALID_EMAIL')) {
        setError('Invalid email address format. Please check for accidental trailing spaces or typos.');
      } else if (code === 'auth/user-disabled' || rawMsg.includes('USER_DISABLED')) {
        setError('This account has been disabled. Please contact your system administrator.');
      } else if (code === 'auth/too-many-requests' || rawMsg.includes('TOO_MANY_ATTEMPTS')) {
        setError('Too many failed login attempts. Access has been temporarily restricted for security. Please wait a few minutes or reset your password.');
      } else if (code === 'auth/unauthorized-domain' || rawMsg.includes('unauthorized-domain')) {
        setError('This production domain is not authorized in Firebase. Please add this domain under Firebase Console > Authentication > Settings > Authorized Domains.');
      } else if (code === 'auth/operation-not-allowed' || rawMsg.includes('OPERATION_NOT_ALLOWED')) {
        setError('Email/Password provider is disabled in Firebase Console. Please enable it under Authentication > Sign-in method.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network connection failed. Please check your internet connection.');
      } else {
        setError(`Login failed: ${rawMsg.replace(/^Firebase:\s*/, '')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const googleUser = userCredential.user;
      const cleanEmail = (googleUser.email || '').trim().toLowerCase();

      let userData: any = {};
      try {
        const userDoc = await getDoc(doc(db, 'users', googleUser.uid));
        userData = userDoc.data() || {};
      } catch (docErr) {
        console.warn('Could not fetch user document from Firestore:', docErr);
      }

      const isAdminEmail = cleanEmail === 'admin@snab.co.in' || cleanEmail.includes('admin');
      const userRole = userData.role || (isAdminEmail ? 'admin' : 'recruiter');

      // If user document doesn't exist yet, initialize it as recruiter or admin
      if (!userData.role) {
        await setDoc(
          doc(db, 'users', googleUser.uid),
          {
            email: cleanEmail,
            displayName: googleUser.displayName || cleanEmail.split('@')[0],
            photoURL: googleUser.photoURL || '',
            role: userRole,
            adminVerified: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((err) => console.warn('Could not save user profile:', err));
      }

      // Check role permissions
      if (userRole !== 'recruiter' && userRole !== 'admin') {
        await signOut(auth);
        setError('This portal is strictly for recruiters and admins. Candidates should use the candidate portal.');
        setLoading(false);
        return;
      }

      // Route accordingly
      if (userRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/recruiter/jobs');
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      const code = err.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in Firebase Console. Please enable Google under Authentication > Sign-in method.');
      } else {
        setError(`Google sign-in failed: ${err.message?.replace(/^Firebase:\s*/, '') || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullname.trim();

    if (!cleanEmail || !cleanName) {
      setError('Please provide your name and email address.');
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'recruiterRequests'), {
        email: cleanEmail,
        fullname: cleanName,
        experience: Number(experience),
        role: 'recruiter',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setMessage('Request sent! An admin will review your recruiter access request and create your account once approved.');
      setMode('login');
    } catch (err: any) {
      setError(`Request failed: ${err.message?.replace(/^Firebase:\s*/, '')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address to reset password.');
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setMessage('Password reset email sent! Check your inbox and your spam/junk folder.');
      setMode('login');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('No account found with this email address.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(`Reset failed: ${err.message?.replace(/^Firebase:\s*/, '')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col justify-between selection:bg-[#D4F82C] selection:text-[#111215] relative overflow-hidden transition-colors duration-300 font-sans">
      {/* ── Background Organic Glow Curve (Landing Page Signature) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 opacity-40 dark:opacity-20">
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="authCurveGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4F82C" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#8FB305" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#D4F82C" stopOpacity="0.3" />
            </linearGradient>
            <filter id="authBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="35" result="blur" />
            </filter>
          </defs>
          <path
            d="M 120,0 C 260,200 480,180 720,340 C 960,500 1200,420 1380,720"
            stroke="url(#authCurveGlow)"
            strokeWidth="48"
            strokeLinecap="round"
            filter="url(#authBlur)"
          />
          <path
            d="M 120,0 C 260,200 480,180 720,340 C 960,500 1200,420 1380,720"
            stroke="#D4F82C"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8 12"
            opacity="0.45"
          />
        </svg>
      </div>

      {/* ── Top Header Navigation ── */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <HireXLogo size="md" withLink to="/" isDark={isDark} />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E4E7DC]/60 dark:bg-white/10 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC] dark:border-white/10 backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-[#8FB305] animate-pulse"></span>
            Recruiter & Admin Gateway
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-[#E4E7DC] dark:border-white/10 transition-all shadow-xs backdrop-blur-xs"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Back to</span> Home
          </Link>
        </div>
      </header>

      {/* ── Main Dual-Stage Container ── */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 my-auto flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ══════════════════════════════════════════════
              LEFT SIDE: "Never-Seen-Before" Recruiter Console
             ══════════════════════════════════════════════ */}
          <div className="hidden lg:flex lg:col-span-7 flex-col gap-6 pr-4">
            
            {/* Editorial Eyebrow & Headline */}
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D4F82C] text-[#111215] shadow-xs mb-4">
                <Sparkles size={14} className="fill-[#111215]" />
                Next-Gen Talent Intelligence
              </div>
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-[#111215] dark:text-white leading-[1.12]">
                Hire top 1% talent with <span className="underline decoration-[#D4F82C] decoration-4 underline-offset-4">autonomous AI</span>.
              </h1>
              <p className="mt-3.5 text-base text-[#575A51] dark:text-neutral-400 max-w-xl leading-relaxed">
                Log in to calibrate job pipelines, conduct live AI voice interviews, score engineering benchmarks, and export shortlisted portfolios in seconds.
              </p>
            </div>

            {/* Interactive Bento Showcase Card: AI Candidate Evaluation Radar */}
            <div className="relative rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white/85 dark:bg-[#15161A]/85 p-6 shadow-xl backdrop-blur-md overflow-hidden group hover:border-[#111215]/30 dark:hover:border-white/20 transition-all">
              {/* Subtle Ambient Radial Glow */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#D4F82C]/20 rounded-full blur-3xl pointer-events-none"></div>

              {/* Top Bar of Preview Card */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold text-sm shadow-xs">
                    <Brain size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                        Live Match Simulation
                      </span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FB305] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8FB305]"></span>
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#111215] dark:text-white">
                      Staff Distributed Systems Engineer
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-black shadow-xs">
                  <Zap size={13} className="fill-[#111215]" />
                  98% FIT SCORE
                </div>
              </div>

              {/* Candidate Mini Profile Inside Bento */}
              <div className="mt-4 flex items-start justify-between bg-[#F8F9F5] dark:bg-[#1D1F24] p-4 rounded-2xl border border-[#E4E7DC]/60 dark:border-white/5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#111215] to-[#34373F] text-white flex items-center justify-center font-bold text-sm border-2 border-white dark:border-[#15161A] shadow-xs">
                    AS
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#111215] dark:text-white flex items-center gap-1.5">
                      Aarav Sharma
                      <CheckCircle2 size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    </h4>
                    <p className="text-xs text-[#575A51] dark:text-neutral-400">
                      Ex-Stripe • 8 yrs • Distributed Pipelines & Rust
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E4E7DC] dark:bg-white/10 text-[#111215] dark:text-white">
                  Stage 3 / Client Ready
                </span>
              </div>

              {/* Evaluation Criteria Checklist */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                  <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                  <span className="truncate font-medium">AWS & Kubernetes Mastery</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                  <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                  <span className="truncate font-medium">Top 2% System Design</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                  <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                  <span className="truncate font-medium">AI Live Voice Verified</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-[#E4E7DC]/60 dark:border-white/5 text-[#575A51] dark:text-neutral-300">
                  <Check size={14} className="text-[#8FB305] shrink-0 font-bold" />
                  <span className="truncate font-medium">Notice: Immediate (15 Days)</span>
                </div>
              </div>
            </div>

            {/* Recruiter Stats Triplet Pills */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#15161A]/70 border border-[#E4E7DC] dark:border-white/10 shadow-xs backdrop-blur-xs">
                <div className="text-xl xl:text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                  14.2<span className="text-[#8FB305] dark:text-[#D4F82C]">h</span>
                </div>
                <p className="text-[11px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                  Saved / Pipeline / Week
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#15161A]/70 border border-[#E4E7DC] dark:border-white/10 shadow-xs backdrop-blur-xs">
                <div className="text-xl xl:text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                  3.8<span className="text-[#8FB305] dark:text-[#D4F82C]">x</span>
                </div>
                <p className="text-[11px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                  Faster Shortlist Turnaround
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#15161A]/70 border border-[#E4E7DC] dark:border-white/10 shadow-xs backdrop-blur-xs">
                <div className="text-xl xl:text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                  99.4<span className="text-[#8FB305] dark:text-[#D4F82C]">%</span>
                </div>
                <p className="text-[11px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5">
                  Interview Integrity Rate
                </p>
              </div>
            </div>

            {/* Security Guarantee Pill */}
            <div className="flex items-center gap-2.5 text-xs text-[#73766C] dark:text-neutral-400">
              <ShieldCheck size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
              <span>SOC2 Type II • End-to-end encrypted session • Powered by SNAB Innovations</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              RIGHT SIDE: Floating Bento Auth Gateway
             ══════════════════════════════════════════════ */}
          <div className="lg:col-span-5 w-full">
            <div className="relative rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
              
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-24 bg-[#D4F82C] rounded-b-full"></div>

              {/* Card Header & Mode Switcher */}
              <div className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#73766C] dark:text-neutral-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4F82C]"></span>
                    Portal Access
                  </span>
                  
                  {mode !== 'reset' && (
                    <div className="flex items-center p-1 rounded-full bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                          mode === 'login'
                            ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                            : 'text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                          mode === 'signup'
                            ? 'bg-[#111215] text-white dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                            : 'text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                        }`}
                      >
                        Request
                      </button>
                    </div>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111215] dark:text-white">
                  {mode === 'login' && 'Welcome back'}
                  {mode === 'signup' && 'Request Recruiter Access'}
                  {mode === 'reset' && 'Reset your password'}
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#575A51] dark:text-neutral-400">
                  {mode === 'login' && 'Enter your credentials to access candidate pipelines & analytics.'}
                  {mode === 'signup' && 'Submit your details for verification and workspace allocation.'}
                  {mode === 'reset' && 'Enter your verified email to receive a secure recovery link.'}
                </p>
              </div>

              {/* Feedback Alerts */}
              {(error || message) && (
                <div
                  className={`mb-5 p-3.5 rounded-2xl text-xs sm:text-sm flex items-start gap-2.5 transition-all ${
                    error
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/50'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                  }`}
                  role="status"
                >
                  {error ? (
                    <AlertCircle size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  )}
                  <span className="leading-snug">{error || message}</span>
                </div>
              )}

              {/* ── Forms ── */}
              {mode === 'reset' ? (
                /* Reset Password Form */
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="reset-email" className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                      Work Email
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                        <Mail size={17} />
                      </span>
                      <input
                        id="reset-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="recruiter@company.com"
                        autoComplete="email"
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-full bg-[#111215] hover:bg-[#202227] text-white dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] dark:text-[#111215] font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
                  >
                    <span>{loading ? 'Sending link…' : 'Send Recovery Link'}</span>
                    {!loading && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full py-2 text-xs font-bold text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </form>
              ) : (
                /* Login & Recruiter Request Forms */
                <>
                  {mode === 'login' && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full h-11 sm:h-12 rounded-2xl bg-white dark:bg-[#1D1F24] hover:bg-[#F0F2EB] dark:hover:bg-[#252830] text-[#111215] dark:text-white border border-[#E4E7DC] dark:border-white/10 font-bold text-sm shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-3 group cursor-pointer disabled:opacity-50"
                      >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Sign in with Google</span>
                      </button>

                      <div className="relative my-4 flex items-center justify-center">
                        <div className="border-t border-[#E4E7DC] dark:border-white/10 w-full" />
                        <span className="bg-white dark:bg-[#15161A] px-3 text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 absolute">
                          or sign in with email
                        </span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
                  
                  {/* Additional Signup Fields */}
                  {mode === 'signup' && (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="full-name" className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                          Full Name
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                            <UserRound size={17} />
                          </span>
                          <input
                            id="full-name"
                            type="text"
                            required
                            value={fullname}
                            onChange={(e) => setFullname(e.target.value)}
                            placeholder="e.g. Maya Patel"
                            autoComplete="name"
                            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="experience" className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                          Recruiting Experience (Years)
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                            <BriefcaseBusiness size={17} />
                          </span>
                          <input
                            id="experience"
                            type="number"
                            min="0"
                            required
                            value={String(experience)}
                            onChange={(e) => setExperience(Number(e.target.value))}
                            placeholder="Years of experience"
                            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                      Work Email
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                        <Mail size={17} />
                      </span>
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="recruiter@company.com"
                        autoComplete="email"
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Field (Login Mode Only) */}
                  {mode === 'login' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="password" className="block text-xs font-bold text-[#111215] dark:text-neutral-200 uppercase tracking-wider">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => switchMode('reset')}
                          className="text-xs font-semibold text-[#8FB305] dark:text-[#D4F82C] hover:underline cursor-pointer"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-[#73766C] dark:text-neutral-500 pointer-events-none">
                          <LockKeyhole size={17} />
                        </span>
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          autoComplete="current-password"
                          minLength={6}
                          className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8F9F5] dark:bg-[#1D1F24] border border-[#E4E7DC] dark:border-white/10 text-sm text-[#111215] dark:text-white placeholder-[#73766C]/60 dark:placeholder-neutral-500 focus:outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white p-1 transition-colors cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Remember Me Option (Login Mode) */}
                  {mode === 'login' && (
                    <div className="flex items-center justify-between pt-1">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <span
                          className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                            rememberMe
                              ? 'bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215]'
                              : 'border border-[#E4E7DC] dark:border-white/20 bg-[#F8F9F5] dark:bg-[#1D1F24]'
                          }`}
                        >
                          {rememberMe && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="text-xs font-medium text-[#575A51] dark:text-neutral-300">
                          Remember this device for 30 days
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 sm:h-12 rounded-full bg-[#111215] hover:bg-[#202227] text-white dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] dark:text-[#111215] font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 mt-2"
                  >
                    <span>
                      {loading
                        ? mode === 'login'
                          ? 'Authenticating…'
                          : 'Submitting request…'
                        : mode === 'login'
                        ? 'Sign In to Workspace'
                        : 'Submit Recruiter Request'}
                    </span>
                    {!loading && <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />}
                  </button>

                  {/* Mode Switch Helper */}
                  <div className="pt-2 text-center text-xs text-[#73766C] dark:text-neutral-400">
                    {mode === 'login' ? (
                      <>
                        Need a recruiter or enterprise seat?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('signup')}
                          className="font-bold text-[#111215] dark:text-white hover:underline cursor-pointer ml-1"
                        >
                          Request Access
                        </button>
                      </>
                    ) : (
                      <>
                        Already registered with InterviewXpert?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('login')}
                          className="font-bold text-[#111215] dark:text-white hover:underline cursor-pointer ml-1"
                        >
                          Sign In Instead
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </>
            )}

              {/* ── Candidate Onboarding & Portal Bridge ── */}
              <div className="mt-6 pt-5 border-t border-[#E4E7DC] dark:border-white/10 space-y-2">
                <Link
                  to="/upload-resume"
                  className="group flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#D4F82C]/15 hover:bg-[#D4F82C]/25 dark:bg-[#D4F82C]/10 dark:hover:bg-[#D4F82C]/20 border border-[#8FB305]/40 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>New here? Upload Resume</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#111215] text-[#D4F82C]">
                          Instant Register
                        </span>
                      </div>
                      <p className="text-[11px] text-[#575A51] dark:text-neutral-300 mt-0.5">
                        Parse skills and get matched to high-paying jobs
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-[#111215] dark:text-[#D4F82C] group-hover:translate-x-1 transition-all shrink-0"
                  />
                </Link>

                <Link
                  to="/candidate/login"
                  className="group flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#F8F9F5] hover:bg-[#F0F2EB] dark:bg-[#1D1F24] dark:hover:bg-[#24272E] border border-[#E4E7DC] dark:border-white/10 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold shrink-0">
                      <UserRound size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-1">
                        Registered Candidate Login
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#E4E7DC] dark:bg-white/10 text-[#575A51] dark:text-neutral-300">
                          Candidates
                        </span>
                      </div>
                      <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                        Take interviews, assessments & view status
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-[#73766C] dark:text-neutral-400 group-hover:translate-x-1 group-hover:text-[#111215] dark:group-hover:text-white transition-all shrink-0"
                  />
                </Link>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 border-t border-[#E4E7DC]/60 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#73766C] dark:text-neutral-400">
        <div className="flex items-center gap-4">
          <Link to="/contact" className="hover:text-[#111215] dark:hover:text-white flex items-center gap-1 transition-colors">
            <Mail size={13} /> Support
          </Link>
          <Link to="/report-bug" className="hover:text-[#111215] dark:hover:text-white flex items-center gap-1 transition-colors">
            <Bug size={13} /> Report Issue
          </Link>
          <a
            href="https://snab.co.in"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#111215] dark:hover:text-white transition-colors"
          >
            SNAB Innovations
          </a>
        </div>
        <p>© {new Date().getFullYear()} InterviewXpert. All rights reserved.</p>
      </footer>

      {/* ── Modals for Verification Notices ── */}
      {showVerifyPopup && (
        <AuthModal
          tone="success"
          title="Account Created"
          description="We sent a verification link to your email. Check your inbox and spam folder, verify your address, and then sign in."
          primaryLabel="Got it, thanks"
          onClose={() => setShowVerifyPopup(false)}
        />
      )}

      {showVerifyErrorPopup && (
        <AuthModal
          tone="error"
          title="Email Not Verified"
          description="Please verify your email address before signing in. Check your inbox and spam folder, or contact support for manual activation."
          primaryLabel="Contact Support"
          primaryTo="/contact"
          onClose={() => setShowVerifyErrorPopup(false)}
        />
      )}
    </div>
  );
};

interface AuthModalProps {
  tone: 'success' | 'error';
  title: string;
  description: string;
  primaryLabel: string;
  primaryTo?: string;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  tone,
  title,
  description,
  primaryLabel,
  primaryTo,
  onClose,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
    aria-labelledby="auth-modal-title"
  >
    <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 p-6 sm:p-7 shadow-2xl text-center">
      <div
        className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
          tone === 'success'
            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
        }`}
      >
        {tone === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
      </div>
      <h3 id="auth-modal-title" className="text-xl font-bold text-[#111215] dark:text-white">
        {title}
      </h3>
      <p className="mt-2 text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 leading-relaxed">
        {description}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {primaryTo ? (
          <Link
            to={primaryTo}
            className="w-full h-11 rounded-full bg-[#111215] hover:bg-[#202227] text-white dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] dark:text-[#111215] font-bold text-sm flex items-center justify-center transition-all cursor-pointer"
          >
            {primaryLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-full bg-[#111215] hover:bg-[#202227] text-white dark:bg-[#D4F82C] dark:hover:bg-[#C2E820] dark:text-[#111215] font-bold text-sm flex items-center justify-center transition-all cursor-pointer"
          >
            {primaryLabel}
          </button>
        )}
        {primaryTo && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  </div>
);

export default AuthPage;
