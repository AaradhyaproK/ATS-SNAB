import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Star, MessageSquare, Quote, ArrowLeft, Search, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import { ThemeProvider } from '../context/ThemeContext';
import { VERIFIED_CANDIDATE_REVIEWS } from '../data/verifiedReviews';

interface Review {
  id: string;
  name: string;
  review: string;
  rating: number;
  createdAt: any;
  userType?: 'student' | 'candidate' | 'recruiter';
  tag?: string;
  verified?: boolean;
}

const BASE_REVIEWS: Review[] = VERIFIED_CANDIDATE_REVIEWS.map(r => ({
  id: r.id,
  name: r.name,
  review: r.review,
  rating: r.rating,
  createdAt: { toDate: () => new Date('2026-04-15') },
  userType: 'candidate',
  tag: r.tag,
  verified: true,
}));

const StarDisplay: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex gap-1">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        size={14}
        className={i < rating ? 'text-[#D4F82C] fill-[#D4F82C]' : 'text-slate-300 dark:text-white/20'}
      />
    ))}
  </div>
);

const ReviewsPageContent: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>(BASE_REVIEWS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = "Candidate Reviews | InterviewXpert";
    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, 'reviews'),
          where('approved', '==', true),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedReviews = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Review[];
        
        // Merge Firestore reviews with baseline verified reviews, avoiding duplicates
        const merged = [
          ...fetchedReviews,
          ...BASE_REVIEWS.filter(br => !fetchedReviews.some(fr => fr.id === br.id))
        ];
        setReviews(merged);
      } catch (error) {
        console.warn("Using baseline verified reviews due to fetch fallback:", error);
        setReviews(BASE_REVIEWS);
      }
    };

    fetchReviews();
  }, []);

  const filteredReviews = reviews.filter(review => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      review.name.toLowerCase().includes(s) || 
      review.review.toLowerCase().includes(s) ||
      (review.tag && review.tag.toLowerCase().includes(s))
    );
  });

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0F12] text-[#111215] dark:text-white font-sans relative overflow-hidden flex flex-col transition-colors duration-300">
      <Navbar />

      {/* Ambient Radial Lime Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] sm:w-[650px] h-[350px] bg-[#D4F82C]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[#F8F9F5] bg-[linear-gradient(to_right,#e4e7dc_1px,transparent_1px),linear-gradient(to_bottom,#e4e7dc_1px,transparent_1px)] bg-[size:6rem_4rem] dark:bg-[#0D0F12] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] pointer-events-none" />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 relative z-10 pt-28 sm:pt-32 pb-20">
        
        {/* Page Header */}
        <div className="text-center mb-12 sm:mb-14 animate-in fade-in slide-in-from-bottom-5 duration-700">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/80 dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 text-xs font-mono font-bold mb-4 shadow-xs">
            <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse" />
            <span className="text-[#111215] dark:text-white">REAL VERIFIED CANDIDATE REVIEWS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight text-[#111215] dark:text-white transition-colors duration-300">
            Candidate{' '}
            <span className="bg-gradient-to-r from-[#D4F82C] via-lime-200 to-white bg-clip-text text-transparent">
              Wall of Love
            </span>
          </h1>
          <p className="text-[#575A51] dark:text-[#A1A79B] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            See what engineering students and candidates across campus drives say about InterviewXpert's autonomous AI mock interviews, resume probing, and instant evaluation rubrics.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-[#E4E7DC] dark:border-white/10 text-xs sm:text-sm font-bold rounded-full text-[#111215] dark:text-gray-300 bg-white/90 dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/10 shadow-xs transition-all transform hover:-translate-y-0.5 w-full sm:w-auto justify-center cursor-pointer"
            >
              <ArrowLeft size={16} /> Back to Home
            </Link>
            <Link
              to="/submit-review"
              className="inline-flex items-center gap-2 px-7 py-2.5 border border-transparent text-xs sm:text-sm font-black rounded-full text-[#111215] bg-[#D4F82C] hover:bg-[#c2e820] shadow-lg shadow-[#D4F82C]/20 transition-all transform hover:-translate-y-0.5 w-full sm:w-auto justify-center cursor-pointer"
            >
              <MessageSquare size={16} /> Share Your Experience
            </Link>
          </div>
        </div>

        {/* Search & Review Counter Bar (Candidates/Recruiters filter removed) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 text-xs font-mono font-bold text-[#111215] dark:text-neutral-300 shadow-2xs">
            <span className="size-2 rounded-full bg-[#D4F82C]" />
            <span>{filteredReviews.length} VERIFIED REVIEWS</span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C] dark:text-[#A1A79B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate name or keyword..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white/90 dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/10 rounded-full focus:outline-none focus:border-[#D4F82C] focus:ring-2 focus:ring-[#D4F82C]/20 text-[#111215] dark:text-white placeholder:text-[#73766C] dark:placeholder:text-[#A1A79B] transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#D4F82C] border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredReviews.map((review, idx) => (
              <div
                key={review.id}
                className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-[#E4E7DC] dark:border-white/10 rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-[#D4F82C]/5 hover:-translate-y-1.5 hover:border-[#D4F82C]/50 group animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${(idx % 10) * 40}ms` }}
              >
                <div className="flex-1 mb-5 relative">
                  <Quote className="absolute -top-4 -left-3 size-14 text-black/[0.03] dark:text-white/[0.04] transition-colors duration-300 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <StarDisplay rating={review.rating} />
                    {review.tag && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4F82C]/15 text-[#8FB305] dark:text-[#D4F82C] border border-[#D4F82C]/30">
                        {review.tag}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs sm:text-sm text-[#33362E] dark:text-neutral-200 leading-relaxed relative z-10 font-normal">
                    "{review.review}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#E4E7DC] dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-xs shadow-md shrink-0">
                      {review.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-[#111215] dark:text-white flex items-center gap-1.5 truncate">
                        <span>{review.name}</span>
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      </p>
                      <p className="text-[10px] font-mono text-[#73766C] dark:text-[#A1A79B]">
                        Candidate
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredReviews.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="w-16 h-16 bg-white/80 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#E4E7DC] dark:border-white/10">
              <MessageSquare className="w-7 h-7 text-[#73766C] dark:text-[#A1A79B]" />
            </div>
            <h3 className="text-lg font-bold text-[#111215] dark:text-white mb-1.5">
              No matching reviews found
            </h3>
            <p className="text-xs sm:text-sm text-[#73766C] dark:text-[#A1A79B] max-w-md mx-auto">
              Try adjusting your search keyword, or share your own experience!
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

const ReviewsPage: React.FC = () => {
  return (
    <ThemeProvider>
      <ReviewsPageContent />
    </ThemeProvider>
  );
};

export default ReviewsPage;