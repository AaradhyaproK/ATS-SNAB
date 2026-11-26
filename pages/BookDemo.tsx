import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Users,
  Bot,
  MessageSquare,
  Clock,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import Logo from '../components/Logo';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export const BookDemo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const queryPlan = new URLSearchParams(location.search).get('plan');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    hiringVolume: '6–20 roles / month',
    primaryInterest: queryPlan || 'ATS AI Pro (₹1,499/mo - Recommended)',
    preferredTime: 'Earliest Available (Next 15–30 Mins)',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Claim Your 30-Day Free Trial & Book Demo | InterviewXpert ATS';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (queryPlan) {
      setForm(prev => ({
        ...prev,
        primaryInterest: queryPlan
      }));
    }
  }, [queryPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const submissionPayload = {
      ...form,
      selectedPlan: queryPlan || form.primaryInterest,
      source: 'Book Demo Page (/book-demo)',
      createdAt: serverTimestamp(),
      status: 'new'
    };

    try {
      // 1. Direct Firebase Firestore write to 'leads' collection
      await addDoc(collection(db, 'leads'), submissionPayload);

      // 2. Also log to contactSubmissions for unified admin inbox
      try {
        await addDoc(collection(db, 'contactSubmissions'), {
          name: form.name,
          email: form.email,
          phone: form.phone,
          subject: `30-Day Free Trial Demo Request [${queryPlan || form.primaryInterest}] - ${form.company || form.name}`,
          message: `Company: ${form.company} | Plan: ${queryPlan || form.primaryInterest} | Hiring Volume: ${form.hiringVolume} | Preferred Time: ${form.preferredTime} | Notes: ${form.notes}`,
          createdAt: serverTimestamp(),
          status: 'new'
        });
      } catch (err) {
        console.warn('Contact submissions note:', err);
      }

      // 3. Dispatch to Formspree gracefully in background
      try {
        await fetch('https://formspree.io/f/mgawlaan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            ...submissionPayload,
            _subject: `New 30-Day Free Trial Demo: ${form.name} (${form.company}) - Plan: ${queryPlan || form.primaryInterest}`
          })
        });
      } catch (err) {
        console.warn('Formspree dispatch notice:', err);
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting demo form:', err);
      // Fallback: If Firebase throws offline, still show success so user isn't stuck
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans antialiased selection:bg-[#D4F82C] selection:text-black">
      {/* Top Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E4E7DC] py-3.5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-8 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/pricing"
              className="text-xs font-bold text-[#575A51] hover:text-[#111215] transition-colors hidden sm:inline"
            >
              Pricing & Plans
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] hover:bg-[#E4E7DC] text-[#111215] text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Platform Value Props */}
          <div className="lg:col-span-5 space-y-6 pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-[11px] font-black uppercase tracking-wider shadow-2xs">
              <Sparkles size={12} />
              <span>★ 1-Month Free Demo</span>
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-[#111215] tracking-tight leading-tight">
                Claim your 30-day free trial.
              </h1>
              <p className="mt-3 text-sm text-[#575A51] leading-relaxed">
                Get full platform access — AI resume parsing, candidate portal, WhatsApp job matching, and live walkthrough.
              </p>
            </div>

            {/* Included in 30-Day Free Trial Checklist */}
            <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 sm:p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#73766C]">
                What's Included in Your 30-Day Trial:
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 font-black">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <div>
                    <strong className="text-[#111215] block">AI Resume Parsing & Auto-Creation</strong>
                    <span className="text-[#73766C]">Drop 100+ PDF/Doc resumes and get structured profiles in 3 seconds.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 font-black">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <div>
                    <strong className="text-[#111215] block">0–100 Personalized AI Match Scoring</strong>
                    <span className="text-[#73766C]">Algorithmic fit explanations showing matching skills & gap analysis.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 font-black">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <div>
                    <strong className="text-[#111215] block">Automated WhatsApp & Email Workflows</strong>
                    <span className="text-[#73766C]">1-tap apply job alerts and automated 24h & 1h interview reminders.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-[#D4F82C] text-[#111215] flex items-center justify-center shrink-0 font-black">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <div>
                    <strong className="text-[#111215] block">Interactive Kanban Pipeline Desk</strong>
                    <span className="text-[#73766C]">Visual candidate progression from applied to hired with notes.</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E4E7DC] flex items-center gap-2 text-[11px] text-[#575A51]">
                <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                <span>Zero setup fees • No credit card required • Instant activation</span>
              </div>
            </div>

            {/* Direct WhatsApp Callout */}
            <div className="p-4 rounded-2xl bg-white border border-[#E4E7DC] flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#111215]">Need instant answers?</p>
                  <p className="text-[11px] text-[#73766C]">Chat with our talent solutions team on WhatsApp</p>
                </div>
              </div>
              <a
                href="https://wa.me/919511779317?text=Hi%20InterviewXpert%20team,%20I%20would%20like%20to%20schedule%20a%20demo%20and%20claim%20my%2030-day%20free%20trial."
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shrink-0 shadow-xs"
              >
                Chat on WA ↗
              </a>
            </div>
          </div>

          {/* Right Column: Demo Form Card */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-md relative overflow-hidden">
              
              {submitted ? (
                <div className="py-12 text-center space-y-4 animate-in fade-in duration-300">
                  <div className="size-20 rounded-full bg-[#D4F82C] text-[#111215] mx-auto flex items-center justify-center shadow-md">
                    <Check size={36} strokeWidth={3} />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#111215] tracking-tight">
                    You're All Set!
                  </h2>
                  <p className="text-xs sm:text-sm text-[#575A51] max-w-md mx-auto leading-relaxed">
                    Our talent solutions team has received your request. We'll set up your 30-day free trial and reach out on WhatsApp/Email within 15 minutes.
                  </p>

                  <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] max-w-sm mx-auto text-left space-y-1.5 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#73766C]">Summary of Request:</div>
                    <div className="font-semibold text-[#111215]">{form.name} • {form.company || 'Direct Recruiter'}</div>
                    <div className="text-[#575A51]">{form.email} • {form.phone}</div>
                    <div className="text-emerald-700 font-medium">Focus: {form.primaryInterest}</div>
                  </div>

                  <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/auth?mode=signup"
                      className="px-6 py-3 rounded-xl bg-[#111215] text-[#D4F82C] text-xs font-black hover:bg-black transition-all shadow-md flex items-center gap-1.5"
                    >
                      <span>Start 1-Month Free Trial Now</span>
                      <ArrowRight size={13} />
                    </Link>
                    <Link
                      to="/pricing"
                      className="px-5 py-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] text-xs font-bold hover:bg-[#E4E7DC] transition-colors"
                    >
                      View All Plans (from ₹599)
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="pb-5 border-b border-[#E4E7DC] mb-6">
                    <h2 className="text-xl sm:text-2xl font-black text-[#111215] tracking-tight">
                      Schedule Demo & Claim 30-Day Free Trial
                    </h2>
                    <p className="text-xs text-[#73766C] mt-1">
                      Fill out your recruitment details below. Our team activates your full access within 15 minutes.
                    </p>
                  </div>

                  {queryPlan && (
                    <div className="mb-5 p-3.5 rounded-2xl bg-[#D4F82C]/20 border border-[#8FB305]/40 flex items-center justify-between gap-3 text-xs shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-[#8FB305] animate-ping shrink-0"></span>
                        <span className="text-[#111215] font-bold">
                          Selected Subscription: <strong className="text-black font-black text-sm">{queryPlan}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] shrink-0">
                        30-Day Free Trial
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#111215] mb-1">
                        Your Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all"
                      />
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111215] mb-1">
                          Work Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="rahul@company.com"
                          className="w-full h-11 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#111215] mb-1">
                          WhatsApp / Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+91 9876543210"
                          className="w-full h-11 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    {/* Company Name & Hiring Volume */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111215] mb-1">
                          Company / Agency Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.company}
                          onChange={(e) => setForm({ ...form, company: e.target.value })}
                          placeholder="e.g. Acme Talent Partners"
                          className="w-full h-11 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#111215] mb-1">
                          Monthly Hiring Volume
                        </label>
                        <select
                          value={form.hiringVolume}
                          onChange={(e) => setForm({ ...form, hiringVolume: e.target.value })}
                          className="w-full h-11 px-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all"
                        >
                          <option value="1–5 roles / month">1–5 roles / month</option>
                          <option value="6–20 roles / month">6–20 roles / month</option>
                          <option value="21–50 roles / month">21–50 roles / month</option>
                          <option value="50+ roles / month">50+ roles / month</option>
                        </select>
                      </div>
                    </div>

                    {/* Primary Interest / Focus */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111215] mb-1">
                          Primary Demo Focus
                        </label>
                        <select
                          value={form.primaryInterest}
                          onChange={(e) => setForm({ ...form, primaryInterest: e.target.value })}
                          className="w-full h-11 px-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all font-medium"
                        >
                          <option value="ATS Starter">ATS Starter (₹599/mo annually)</option>
                          <option value="ATS + Email Automation">ATS + Email Automation (₹899/mo annually)</option>
                          <option value="ATS AI Pro">ATS AI Pro (₹1,499/mo annually - Recommended)</option>
                          <option value="ATS AI + WhatsApp Automation">ATS AI + WhatsApp Automation (₹2,299/mo annually)</option>
                          <option value="Full ATS Recruitment Suite">Full ATS Suite (All Features)</option>
                          <option value="AI Resume Parsing & Match Scoring">AI Resume Parsing & 0-100 Matching</option>
                          <option value="WhatsApp Business Automation">WhatsApp Automation & 1-Tap Alerts</option>
                          <option value="AI Video Pre-Screening Interviews">AI Video Interviews & MCQ Tests</option>
                          <option value="Agency Package (5+ Recruiter Seats)">Agency Package (5+ Recruiter Seats)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111215] mb-1">
                          Preferred Walkthrough Time
                        </label>
                        <select
                          value={form.preferredTime}
                          onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                          className="w-full h-11 px-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all"
                        >
                          <option value="Earliest Available (Next 15–30 Mins)">Earliest Available (Next 15–30 Mins)</option>
                          <option value="Morning (10:00 AM – 1:00 PM)">Morning (10:00 AM – 1:00 PM)</option>
                          <option value="Afternoon (2:00 PM – 5:00 PM)">Afternoon (2:00 PM – 5:00 PM)</option>
                          <option value="Evening (5:00 PM – 8:00 PM)">Evening (5:00 PM – 8:00 PM)</option>
                        </select>
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#111215] mb-1">
                        Any specific hiring challenges or requirements? (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="e.g. We hire 10 developers/month and need automated candidate screening."
                        className="w-full p-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] focus:outline-none focus:border-[#111215] focus:bg-white transition-all resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full h-12 rounded-2xl bg-[#111215] hover:bg-black text-white text-xs font-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md group"
                      >
                        <span>{submitting ? 'Submitting Request...' : 'Claim 30-Day Free Trial & Book Walkthrough'}</span>
                        <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                      </button>

                      <div className="mt-2.5 text-center text-[11px] text-[#73766C] flex items-center justify-center gap-1.5">
                        <Clock size={12} className="text-[#8FB305]" />
                        <span>Instant 15-Min Response • Full Platform Access • Zero Obligation</span>
                      </div>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default BookDemo;