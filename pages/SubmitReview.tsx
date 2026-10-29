import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useMessageBox } from '../components/MessageBox';
import { Star, Send, ArrowLeft, Home, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import { ThemeProvider } from '../context/ThemeContext';

const RATING_LABELS = [
  'Needs Improvement',
  'Fair Experience',
  'Good Platform',
  'Great & Very Helpful',
  'Exceptional (5.0 / 5.0)',
];

const SubmitReviewContent: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const messageBox = useMessageBox();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      messageBox.showError('Please enter a valid email address.');
      return;
    }

    // Indian Phone Number Validation (supports optional +91, followed by 10 digits starting with 6-9)
    const phoneRegex = /^(?:\+91|91)?(?:[\s.-]+)?([6-9]\d{9})$/;
    if (!phoneRegex.test(contact.trim())) {
      messageBox.showError('Please enter a valid 10-digit Indian contact number.');
      return;
    }

    if (rating === 0) {
      messageBox.showError('Please select a star rating.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        name: name.trim(),
        email: email.trim(),
        contact: contact.trim(),
        review: review.trim(),
        rating,
        userType: 'candidate',
        approved: false, // All reviews require manual approval from Firestore
        createdAt: serverTimestamp(),
      });
      messageBox.showSuccess('Thank you! Your verified review has been submitted for approval.');
      navigate('/reviews');
    } catch (error) {
      console.error('Error submitting review:', error);
      messageBox.showError('Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0F12] text-[#111215] dark:text-white font-sans relative overflow-hidden flex flex-col transition-colors duration-300">
      <Navbar />

      {/* Ambient Radial Lime Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] sm:w-[650px] h-[350px] bg-[#D4F82C]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[#F8F9F5] bg-[linear-gradient(to_right,#e4e7dc_1px,transparent_1px),linear-gradient(to_bottom,#e4e7dc_1px,transparent_1px)] bg-[size:6rem_4rem] dark:bg-[#0D0F12] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] pointer-events-none" />

      <main className="flex-1 w-full flex items-center justify-center px-4 sm:px-6 relative z-10 pt-28 sm:pt-32 pb-16">
        <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
          
          {/* Centered Navigation Buttons */}
          <div className="flex flex-row justify-center items-center gap-3 mb-8">
            <Link
              to="/reviews"
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white/90 dark:bg-white/[0.04] backdrop-blur-md border border-[#E4E7DC] dark:border-white/10 text-xs sm:text-sm font-bold text-[#111215] dark:text-gray-300 hover:text-[#8FB305] dark:hover:text-[#D4F82C] hover:border-[#D4F82C]/40 shadow-2xs hover:shadow-md transition-all cursor-pointer"
            >
              <ArrowLeft size={15} /> Back to Reviews
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white/90 dark:bg-white/[0.04] backdrop-blur-md border border-[#E4E7DC] dark:border-white/10 text-xs sm:text-sm font-bold text-[#111215] dark:text-gray-300 hover:text-[#8FB305] dark:hover:text-[#D4F82C] hover:border-[#D4F82C]/40 shadow-2xs hover:shadow-md transition-all cursor-pointer"
            >
              <Home size={15} /> Explore Platform
            </Link>
          </div>

          {/* Form Container Card */}
          <div className="relative bg-white/90 dark:bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-[#E4E7DC] dark:border-white/10 p-7 sm:p-12 shadow-2xl dark:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
            
            {/* Ambient Corner Accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4F82C]/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-8 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 text-xs font-mono font-bold mb-3 shadow-2xs">
                <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse" />
                <span className="text-[#111215] dark:text-white">CANDIDATE FEEDBACK</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-[#111215] dark:text-white tracking-tight">
                Share Your{' '}
                <span className="bg-gradient-to-r from-[#D4F82C] via-lime-200 to-white bg-clip-text text-transparent">
                  Interview Experience
                </span>
              </h1>
              <p className="text-[#575A51] dark:text-[#A1A79B] mt-2 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
                Your feedback helps us refine InterviewXpert's autonomous 2-way AI simulator and helps other candidates prepare with confidence.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold tracking-wider text-[#575A51] dark:text-[#A1A79B] uppercase">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bhavesh Sharma"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 rounded-2xl focus:outline-none focus:border-[#D4F82C] focus:ring-2 focus:ring-[#D4F82C]/20 text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] dark:placeholder:text-[#A1A79B] shadow-2xs transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold tracking-wider text-[#575A51] dark:text-[#A1A79B] uppercase">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. bhavesh@gmail.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 rounded-2xl focus:outline-none focus:border-[#D4F82C] focus:ring-2 focus:ring-[#D4F82C]/20 text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] dark:placeholder:text-[#A1A79B] shadow-2xs transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold tracking-wider text-[#575A51] dark:text-[#A1A79B] uppercase">
                  Contact Number (10-Digit Mobile)
                </label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 rounded-2xl focus:outline-none focus:border-[#D4F82C] focus:ring-2 focus:ring-[#D4F82C]/20 text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] dark:placeholder:text-[#A1A79B] shadow-2xs transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold tracking-wider text-[#575A51] dark:text-[#A1A79B] uppercase">
                  Your Review & Feedback
                </label>
                <textarea
                  placeholder="Share how the AI questions matched your resume, the real-time feedback, or your overall placement prep experience..."
                  required
                  rows={4}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 rounded-2xl focus:outline-none focus:border-[#D4F82C] focus:ring-2 focus:ring-[#D4F82C]/20 text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] dark:placeholder:text-[#A1A79B] shadow-2xs transition-all font-medium resize-y"
                />
              </div>

              {/* Star Rating Section */}
              <div className="text-center space-y-2.5 pt-4 pb-2 border-t border-[#E4E7DC] dark:border-white/10">
                <label className="text-xs font-mono font-bold tracking-widest text-[#575A51] dark:text-[#A1A79B] uppercase block">
                  Rate Your Experience
                </label>
                <div
                  className="flex justify-center items-center gap-2 sm:gap-3"
                  onMouseLeave={() => setHoverRating(0)}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => setRating(star)}
                      className="focus:outline-none transform transition-transform hover:scale-110 active:scale-95 cursor-pointer p-1"
                    >
                      <Star
                        size={36}
                        className={`transition-all duration-200 ${
                          activeRating >= star
                            ? 'text-[#D4F82C] fill-[#D4F82C] scale-110 drop-shadow-[0_0_12px_rgba(212,248,44,0.4)]'
                            : 'text-slate-300 dark:text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {activeRating > 0 && (
                  <p className="text-xs font-mono font-bold text-[#8FB305] dark:text-[#D4F82C]">
                    {RATING_LABELS[activeRating - 1]}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D4F82C] hover:bg-[#c2e820] text-[#111215] font-black text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-xl shadow-[#D4F82C]/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {loading ? (
                    <div className="size-4 border-2 border-[#111215] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={17} className="text-[#111215]" />
                  )}
                  <span>{loading ? 'Submitting...' : 'Post Review Securely'}</span>
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-5 text-[11px] font-mono text-[#575A51] dark:text-[#A1A79B] pt-2">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                  <span>100% Real Verification</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Quality Moderated</span>
                </span>
              </div>

            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

const SubmitReview: React.FC = () => {
  return (
    <ThemeProvider>
      <SubmitReviewContent />
    </ThemeProvider>
  );
};

export default SubmitReview;