import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Star, MessageSquare, Quote, User, Briefcase, ArrowLeft, Search, CheckCircle2 } from 'lucide-react';
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
        size={16}
        className="text-yellow-400 transition-all"
        fill={i < rating ? 'currentColor' : 'none'}
      />
    ))}
  </div>
);

const ReviewsPageContent: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>(BASE_REVIEWS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'candidate' | 'recruiter'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = "User Reviews | InterviewXpert";
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
    const matchesFilter = 
      filter === 'all' 
        ? true 
        : filter === 'candidate' 
          ? review.userType === 'candidate' || review.userType === 'student' 
          : review.userType === filter;

    const s = search.toLowerCase().trim();
    const matchesSearch = 
      !s || 
      review.name.toLowerCase().includes(s) || 
      review.review.toLowerCase().includes(s) ||
      (review.tag && review.tag.toLowerCase().includes(s));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col transition-colors duration-300">
      <Navbar />

      {/* Background Effects - Optimized for larger screens */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem] dark:bg-[#0B0C10] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-100/20 via-transparent to-transparent dark:from-blue-900/10 dark:via-[#0B0C10] dark:to-[#0B0C10] pointer-events-none"></div>
      <div className="hidden lg:block absolute -top-1/4 left-0 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-[150px] pointer-events-none animate-blob"></div>
      <div className="hidden lg:block absolute -bottom-1/4 right-0 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[150px] pointer-events-none animate-blob animation-delay-2000"></div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 relative z-10 pt-32 pb-20">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-5 duration-700">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight text-slate-900 dark:text-white transition-colors duration-300">
            Community <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500">Feedback</span>
          </h1>
          <p className="text-slate-600 dark:text-gray-400 max-w-2xl mx-auto text-lg transition-colors duration-300">
            See what others are saying about their experience with InterviewXpert.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 dark:border-white/10 text-base font-bold rounded-full text-gray-700 dark:text-gray-300 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm transition-all transform hover:-translate-y-0.5 w-full sm:w-auto justify-center">
              <ArrowLeft size={20} /> Back to Home
            </Link>
            <Link to="/submit-review" className="inline-flex items-center gap-2 px-8 py-3 border border-transparent text-base font-bold rounded-full text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-0.5 w-full sm:w-auto justify-center">
              <MessageSquare size={20} /> Leave Your Own Review
            </Link>
          </div>
        </div>

        {/* Filter Buttons & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-white/5 rounded-full border border-gray-200 dark:border-white/10 w-full sm:w-auto">
            <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-bold rounded-full transition-all cursor-pointer ${filter === 'all' ? 'bg-white dark:bg-white/10 text-primary shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}>All Reviews</button>
            <button onClick={() => setFilter('candidate')} className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${filter === 'candidate' ? 'bg-white dark:bg-white/10 text-primary shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}><User size={14}/> Candidates</button>
            <button onClick={() => setFilter('recruiter')} className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${filter === 'recruiter' ? 'bg-white dark:bg-white/10 text-primary shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}><Briefcase size={14}/> Recruiters</button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full focus:outline-hidden focus:border-blue-500 text-slate-800 dark:text-white placeholder:text-gray-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 dark:border-blue-500"></div>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredReviews.map((review, idx) => (
              <div key={review.id} className="bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-2 hover:scale-[1.02] hover:border-blue-400 dark:hover:border-blue-500/50 group animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${(idx % 10) * 50}ms` }}>
                <div className="flex-1 mb-6 relative">
                  <Quote className="absolute -top-5 -left-5 w-16 h-16 text-gray-100 dark:text-white/5 transition-colors duration-300 pointer-events-none" />
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <StarDisplay rating={review.rating} />
                    {review.tag && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 dark:bg-white/10 text-blue-600 dark:text-[#D4F82C] border border-blue-200/50 dark:border-white/10">
                        {review.tag}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-gray-700 dark:text-gray-300 text-base leading-relaxed relative z-10 font-normal">
                    "{review.review}"
                  </p>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0 ${review.userType === 'recruiter' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                    {review.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span>{review.name}</span>
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          review.userType === 'recruiter' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                          {review.userType === 'student' || review.userType === 'candidate' ? 'Candidate' : review.userType ? review.userType.charAt(0).toUpperCase() + review.userType.slice(1) : 'Candidate'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filteredReviews.length === 0 && (
            <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-white/10">
                    <MessageSquare className="w-8 h-8 text-slate-400 dark:text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  No {filter !== 'all' ? filter : ''} reviews found
                </h3>
                <p className="text-slate-500 dark:text-gray-500 max-w-md mx-auto">
                  {filter === 'all' ? "Be the first one to share your thoughts!" : "Looks like no one from this category has left a review yet."}
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