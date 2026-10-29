import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Star, 
  Quote, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  MessageSquare, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { VERIFIED_CANDIDATE_REVIEWS } from '../../data/verifiedReviews';
import { Marquee } from './Marquee';

interface CandidateWallOfLoveProps {
  className?: string;
}

export const CandidateWallOfLove: React.FC<CandidateWallOfLoveProps> = ({ className = '' }) => {
  // Split reviews into two tracks for the dual-speed marquee
  const trackOne = useMemo(() => VERIFIED_CANDIDATE_REVIEWS.slice(0, 10), []);
  const trackTwo = useMemo(() => VERIFIED_CANDIDATE_REVIEWS.slice(10), []);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Ambient Radial Lime Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] sm:w-[650px] h-[350px] bg-[#D4F82C]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-neutral-300 text-xs font-mono font-bold mb-4 shadow-xs">
            <span className="size-2 rounded-full bg-[#D4F82C] animate-pulse" />
            <span className="text-white">REAL VERIFIED CANDIDATE REVIEWS</span>
          </div>

          <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Loved by Candidates.<br />
            <span className="bg-gradient-to-r from-[#D4F82C] via-lime-200 to-white bg-clip-text text-transparent">
              Proven in Real Interviews.
            </span>
          </h2>

          <p className="mt-4 text-xs sm:text-base text-[#A1A79B] leading-relaxed">
            See what real engineering students and candidates across tech campuses say about InterviewXpert's autonomous 2-way AI interviews, dynamic resume probing, and instant evaluation rubrics.
          </p>

          {/* Social Proof Stats Banner */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={13} className="fill-current text-[#D4F82C]" />
                ))}
              </div>
              <p className="text-lg font-black text-white">4.8 / 5.0</p>
              <p className="text-[10px] uppercase font-bold text-[#A1A79B] tracking-wider">Average Rating</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
              <div className="flex items-center justify-center text-[#D4F82C] mb-1">
                <ShieldCheck size={16} />
              </div>
              <p className="text-lg font-black text-white">100% Real</p>
              <p className="text-[10px] uppercase font-bold text-[#A1A79B] tracking-wider">Verified Candidate Reviews</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
              <div className="flex items-center justify-center text-[#D4F82C] mb-1">
                <Sparkles size={16} />
              </div>
              <p className="text-lg font-black text-white">100%</p>
              <p className="text-[10px] uppercase font-bold text-[#A1A79B] tracking-wider">Resume-Aligned</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
              <div className="flex items-center justify-center text-[#D4F82C] mb-1">
                <TrendingUp size={16} />
              </div>
              <p className="text-lg font-black text-white">0s Delay</p>
              <p className="text-[10px] uppercase font-bold text-[#A1A79B] tracking-wider">Practice 24/7 Anytime</p>
            </div>
          </div>
        </div>

        {/* ── Spotlight Top 3 Highlight Cards ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#D4F82C]" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Featured Highlights from Candidates
              </h3>
            </div>
            <Link
              to="/reviews"
              className="text-xs font-bold text-[#D4F82C] hover:underline inline-flex items-center gap-1"
            >
              <span>View All on Reviews Hub</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Bhavesh - HireVue comparison */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-[#D4F82C]/30 hover:border-[#D4F82C]/60 transition-all shadow-xl hover:-translate-y-1 relative group flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D4F82C]/15 border border-[#D4F82C]/30 text-[10px] font-mono font-bold text-[#D4F82C]">
                    HireVue Alternative
                  </span>
                  <div className="flex items-center gap-0.5 text-[#D4F82C]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className="fill-current" />
                    ))}
                  </div>
                </div>

                <Quote size={24} className="text-[#D4F82C]/40 mb-2" />
                <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                  "Great innovative idea, better than hirevue , we can practice any time and multiple times , love this feature."
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white text-sm shadow-md">
                    B
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1">
                      Bhavesh
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    </p>
                    <p className="text-[10px] text-[#A1A79B]">Candidate</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>
            </div>

            {/* Card 2: Bhakti Kulkarni - Resume & expertise alignment */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/15 hover:border-[#D4F82C]/50 transition-all shadow-xl hover:-translate-y-1 relative group flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-mono font-bold text-purple-300">
                    Resume Rubrics
                  </span>
                  <div className="flex items-center gap-0.5 text-[#D4F82C]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className="fill-current" />
                    ))}
                  </div>
                </div>

                <Quote size={24} className="text-purple-400/40 mb-2" />
                <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                  "Overall, I had a great interview experience. The questions were highly professional, perfectly aligned with the expertise outlined in my resume, and accurately matched my current level of experience."
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-tr from-violet-500 to-purple-700 flex items-center justify-center font-black text-white text-xs shadow-md">
                    BK
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1">
                      Bhakti Kulkarni
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    </p>
                    <p className="text-[10px] text-[#A1A79B]">Candidate</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>
            </div>

            {/* Card 3: Yash Jondhale - Placements */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/15 hover:border-[#D4F82C]/50 transition-all shadow-xl hover:-translate-y-1 relative group flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-[10px] font-mono font-bold text-rose-300">
                    Campus Placements
                  </span>
                  <div className="flex items-center gap-0.5 text-[#D4F82C]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className="fill-current" />
                    ))}
                  </div>
                </div>

                <Quote size={24} className="text-rose-400/40 mb-2" />
                <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                  "InterviewXpert is a game-changer! The resources helped me build the confidence I needed to tackle tough technical rounds. Highly recommended for any student looking to ace their placements."
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center font-black text-white text-xs shadow-md">
                    YJ
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1">
                      Yash Jondhale
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    </p>
                    <p className="text-[10px] text-[#A1A79B]">Candidate</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Dual Auto-Scrolling Marquee Track ── */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.015] p-3 sm:p-6 backdrop-blur-xl">
          {/* Subtle Side Fade Overlays */}
          <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-28 bg-gradient-to-r from-[#0D0F12] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-28 bg-gradient-to-l from-[#0D0F12] to-transparent z-10 pointer-events-none" />

          {/* Marquee Header */}
          <div className="flex items-center justify-between px-2 sm:px-4 pb-3 mb-2 border-b border-white/5 text-[11px] text-[#A1A79B] font-mono">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE CANDIDATE FEEDBACK STREAM (PAUSE ON HOVER)</span>
            </span>
            <span className="hidden sm:inline">100% CANDIDATE VERIFIED & RECOMMENDED</span>
          </div>

          {/* Track 1: Leftward */}
          <Marquee pauseOnHover className="[--duration:48s] py-1">
            {trackOne.map((rev) => (
              <div
                key={rev.id}
                className="w-[280px] sm:w-[330px] shrink-0 p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#D4F82C]/40 transition-all flex flex-col justify-between mx-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-[#D4F82C]">
                      {rev.tag}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} size={11} className="fill-current text-[#D4F82C]" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-200 line-clamp-3 leading-relaxed">
                    "{rev.review}"
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <div className={`size-6 rounded-full bg-gradient-to-tr ${rev.avatarGradient} flex items-center justify-center font-bold text-white text-[10px]`}>
                      {rev.initials}
                    </div>
                    <span className="font-bold text-white truncate max-w-[140px]">{rev.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Verified
                  </span>
                </div>
              </div>
            ))}
          </Marquee>

          {/* Track 2: Rightward (reverse) */}
          <Marquee reverse pauseOnHover className="[--duration:48s] py-1 mt-2">
            {trackTwo.map((rev) => (
              <div
                key={rev.id}
                className="w-[280px] sm:w-[330px] shrink-0 p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#D4F82C]/40 transition-all flex flex-col justify-between mx-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-[#D4F82C]">
                      {rev.tag}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} size={11} className="fill-current text-[#D4F82C]" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-200 line-clamp-3 leading-relaxed">
                    "{rev.review}"
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <div className={`size-6 rounded-full bg-gradient-to-tr ${rev.avatarGradient} flex items-center justify-center font-bold text-white text-[10px]`}>
                      {rev.initials}
                    </div>
                    <span className="font-bold text-white truncate max-w-[140px]">{rev.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Verified
                  </span>
                </div>
              </div>
            ))}
          </Marquee>
        </div>

        {/* Clean Bottom Navigation Strip */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
          <Link
            to="/reviews"
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold transition-all border border-white/15 inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <MessageSquare size={14} className="text-[#D4F82C]" />
            <span>Explore All Candidate Feedback on Reviews Hub</span>
            <ArrowRight size={12} />
          </Link>
          <Link
            to="/submit-review"
            className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-semibold transition-all border border-white/10 cursor-pointer"
          >
            Share Your Interview Feedback
          </Link>
        </div>

      </div>
    </div>
  );
};

export default CandidateWallOfLove;
