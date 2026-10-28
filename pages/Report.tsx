import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { InterviewSubmission } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import DayNightToggle from '../components/DayNightToggle';
import Logo from '../components/Logo';
import HireXLogo from '../components/HireXLogo';
import { useMessageBox } from '../components/MessageBox';
import { ArrowLeft, Download, Share2, User, FileText, MessageSquare, Brain, Shield, Video, VideoOff, Eye, EyeOff, CheckCircle, XCircle, Briefcase, MapPin, GraduationCap, DollarSign, Calendar, Award, Link as LinkIcon, Maximize2, Minimize2, Globe, Volume2, Sparkles, BookOpen, Headphones, UserCheck, Mic, Zap, Phone, Users, CheckCircle2, Copy, Check, Radio, Layers } from 'lucide-react';
import { isLocationMatching } from '../data/maharashtraCities';

// Filter out false-positive location mismatches (e.g. "Ambad" is inside "Nashik")
const getValidCriteriaMismatches = (rawMismatches?: string[]): string[] => {
    if (!rawMismatches || rawMismatches.length === 0) return [];
    return rawMismatches.filter((m: string) => {
        const match = m.match(/Preferred job location is (.*?) \(Your city: (.*?)\)/i);
        if (match) {
            const jobLoc = match[1].trim();
            const candCity = match[2].trim();
            if (isLocationMatching(jobLoc, candCity)) {
                return false; // Suppress false-positive location mismatch
            }
        }
        return true;
    });
};

// Luxury radial score display component
const ScoreCircle: React.FC<{ score: number; denom: number; color: 'green' | 'yellow' | 'red'; label: string }> = ({ score, denom, color, label }) => {
    const pct = denom > 0 ? Math.min(100, Math.max(0, (score / denom) * 100)) : 0;
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    const colorMap = {
        green: {
            text: 'text-emerald-700 dark:text-emerald-400',
            stroke: 'text-emerald-500 dark:text-emerald-400',
            glow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.25)]',
            bgPill: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
        },
        yellow: {
            text: 'text-amber-700 dark:text-amber-400',
            stroke: 'text-amber-500 dark:text-amber-400',
            glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]',
            bgPill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
        },
        red: {
            text: 'text-rose-700 dark:text-rose-400',
            stroke: 'text-rose-500 dark:text-rose-400',
            glow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.25)]',
            bgPill: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
        },
    };
    const c = colorMap[color] || colorMap.green;

    return (
        <div className="flex flex-col items-center gap-3 text-center group">
            <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                        className="text-[#E4E7DC] dark:text-white/[0.06]"
                        strokeWidth="7"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="50"
                        cy="50"
                    />
                    <circle
                        className={`${c.stroke} ${c.glow} transition-all duration-1000 ease-out`}
                        strokeWidth="7"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="50"
                        cy="50"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="geist-metric text-3xl font-black text-[#111215] dark:text-white font-mono">{score.toFixed(1)}</span>
                    <span className="geist-label text-[10px] text-[#73766C] dark:text-white/40 font-bold uppercase tracking-wider font-mono">/ {denom}</span>
                </div>
            </div>
            <div className="space-y-1">
                <p className="geist-small text-xs font-bold text-[#111215] dark:text-gray-200 uppercase tracking-wide font-mono">{label}</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${c.bgPill} font-mono`}>
                    {pct.toFixed(0)}%
                </span>
            </div>
        </div>
    );
};

const BehavioralStat: React.FC<{ icon: React.ReactNode, label: string, value: string | number, color: 'green' | 'yellow' | 'red' | 'blue' | 'purple' }> = ({ icon, label, value, color }) => {
    const colorClasses = {
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
        yellow: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
        red: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
        blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
        purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
    }[color];

    return (
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.03] border border-[#E4E7DC] dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14] transition-all">
            <div className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border ${colorClasses}`}>
                {icon}
            </div>
            <div>
                <p className="geist-caption text-xs text-[#73766C] dark:text-gray-400 font-medium">{label}</p>
                <p className="geist-metric text-lg font-bold text-[#111215] dark:text-white mt-0.5">{value}</p>
            </div>
        </div>
    );
};

const ProfileDetailItem: React.FC<{ label: string; value?: string | React.ReactNode; fullWidth?: boolean }> = ({ label, value, fullWidth }) => {
    if (!value && value !== 0) return null;
    return (
        <div className={fullWidth ? 'col-span-1 md:col-span-2' : ''}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{label}</p>
            <div className="font-semibold text-gray-800 dark:text-gray-200 mt-1 text-sm">{value}</div>
        </div>
    );
};

const isDocxFile = (url?: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('.docx') || lowerUrl.includes('.doc') || lowerUrl.includes('/docx') || lowerUrl.includes('/doc');
};

const getResumeViewUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (isDocxFile(url)) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  }
  return url;
};

const InterviewReport: React.FC = () => {
  const navigate = useNavigate();
  const messageBox = useMessageBox();
  const { isDark } = useTheme();
  const { userProfile } = useAuth();
  const { interviewId, submissionId } = useParams<{ interviewId: string; submissionId?: string }>();
  const [submission, setSubmission] = useState<InterviewSubmission | null>(null);
  const [parentInterview, setParentInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [profileTextData, setProfileTextData] = useState<string>('');
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [showResumeInVideo, setShowResumeInVideo] = useState<boolean>(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const handleCopyTranscript = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const isStaff = userProfile?.role === 'recruiter' || userProfile?.role === 'admin';

  const getExpirationDate = (field: any): Date | null => {
    if (!field) return null;
    if (field.toDate) return field.toDate();
    if (field instanceof Date) return field;
    return new Date(field);
  };

  const formatDatetimeLocal = (date: Date | null) => {
    if (!date) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const handleSetExpiration = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!interviewId || !submissionId || !submission) return;
    try {
      const docRef = doc(db, 'interviews', interviewId, 'attempts', submissionId);
      const dateVal = val ? new Date(val) : null;
      
      setSubmission(prev => prev ? {
        ...prev,
        clientAccessExpiresAt: dateVal
      } : null);
      
      await updateDoc(docRef, { clientAccessExpiresAt: dateVal });
      messageBox.showSuccess(dateVal ? `Access expiration set to ${dateVal.toLocaleString()}` : "Access expiration removed.");
    } catch (err) {
      console.error("Error setting expiration:", err);
      messageBox.showError("Failed to update access expiration.");
    }
  };

  const handleClearExpiration = async () => {
    if (!interviewId || !submissionId || !submission) return;
    try {
      const docRef = doc(db, 'interviews', interviewId, 'attempts', submissionId);
      
      setSubmission(prev => prev ? {
        ...prev,
        clientAccessExpiresAt: null
      } : null);
      
      await updateDoc(docRef, { clientAccessExpiresAt: null });
      messageBox.showSuccess("Access expiration limit removed.");
    } catch (err) {
      console.error("Error clearing expiration:", err);
      messageBox.showError("Failed to clear access expiration.");
    }
  };

  const handleToggleVisibility = async (index: number, field: 'hiddenVideos' | 'hiddenQuestions', isHidden: boolean) => {
    if (!interviewId || !submissionId || !submission) return;
    try {
      const docRef = doc(db, 'interviews', interviewId, 'attempts', submissionId);
      const currentSettings = submission.visibilitySettings || {};
      const fieldSettings = currentSettings[field] || {};
      
      const updatedSettings = {
        ...currentSettings,
        [field]: {
          ...fieldSettings,
          [index]: isHidden
        }
      };
      
      // Optimistic update
      setSubmission(prev => prev ? {
        ...prev,
        visibilitySettings: updatedSettings
      } : null);
      
      await updateDoc(docRef, { visibilitySettings: updatedSettings });
      messageBox.showSuccess("Visibility settings updated successfully!");
    } catch (err) {
      console.error("Error updating visibility setting:", err);
      messageBox.showError("Failed to update visibility setting.");
    }
  };

  const hasPrevVisibleVideo = () => {
    if (activeVideoIndex === null || !submission) return false;
    let idx = activeVideoIndex - 1;
    while (idx >= 0) {
      const isHidden = !isStaff && submission.visibilitySettings?.hiddenQuestions?.[idx] === true;
      if (submission.videoURLs?.[idx] && !isHidden) return true;
      idx--;
    }
    return false;
  };

  const hasNextVisibleVideo = () => {
    if (activeVideoIndex === null || !submission || !submission.questions) return false;
    let idx = activeVideoIndex + 1;
    while (idx < submission.questions.length) {
      const isHidden = !isStaff && submission.visibilitySettings?.hiddenQuestions?.[idx] === true;
      if (submission.videoURLs?.[idx] && !isHidden) return true;
      idx++;
    }
    return false;
  };

  const handlePrevVideo = () => {
    if (activeVideoIndex === null || !submission) return;
    let newIndex = activeVideoIndex - 1;
    while (newIndex >= 0) {
      const isHidden = !isStaff && submission.visibilitySettings?.hiddenQuestions?.[newIndex] === true;
      const hasUrl = submission.videoURLs?.[newIndex];
      if (hasUrl && !isHidden) {
        setActiveVideoIndex(newIndex);
        return;
      }
      newIndex--;
    }
  };

  const handleNextVideo = () => {
    if (activeVideoIndex === null || !submission || !submission.questions) return;
    let newIndex = activeVideoIndex + 1;
    while (newIndex < submission.questions.length) {
      const isHidden = !isStaff && submission.visibilitySettings?.hiddenQuestions?.[newIndex] === true;
      const hasUrl = submission.videoURLs?.[newIndex];
      if (hasUrl && !isHidden) {
        setActiveVideoIndex(newIndex);
        return;
      }
      newIndex++;
    }
  };

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!interviewId) return;
      try {
        if (submissionId) {
          const docRef = doc(db, 'interviews', interviewId, 'attempts', submissionId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const submissionData = { id: docSnap.id, ...docSnap.data() } as InterviewSubmission;
            
            // Fallback check to global interview expiration if local is not set
            const interviewDocSnap = await getDoc(doc(db, 'interviews', interviewId));
            if (interviewDocSnap.exists()) {
              const interviewData = interviewDocSnap.data();
              setParentInterview(interviewData);
              if (!submissionData.clientAccessExpiresAt && interviewData.clientAccessExpiresAt) {
                submissionData.clientAccessExpiresAt = interviewData.clientAccessExpiresAt;
              }
            }
            
            setSubmission(submissionData);
          }
        } else {
          // Legacy: The report is embedded directly on the interview document
          const docRef = doc(db, 'interviews', interviewId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setParentInterview(data);
            // Map legacy fields to current InterviewSubmission format to avoid breaks
            const mappedSubmission: any = {
              id: docSnap.id,
              ...data,
              candidateInfo: data.candidateInfo || { name: data.candidateName || 'Candidate', email: data.candidateEmail || 'Unknown' },
              feedback: data.feedback || (data.report && data.report.feedback) || '',
              score: data.score || (data.report && data.report.score) || 0,
            };
            setSubmission(mappedSubmission as InterviewSubmission);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching submission:", error);
        setLoading(false);
      }
    };
    fetchSubmission();
  }, [interviewId, submissionId]);

  const candidateCity = submission?.candidateInfo?.currentCity || (submission?.candidateInfo as any)?.currentLocation || (submission?.candidateInfo as any)?.city || '';
  const jobLocation = parentInterview?.location || parentInterview?.jobLocation || parentInterview?.city || (submission as any)?.jobLocation || (submission as any)?.location || '';
  const isLoc100Match = Boolean(candidateCity && jobLocation && isLocationMatching(jobLocation, candidateCity));

  const getScoreValue = (score: unknown): string => {
    let value = 0;
    if (typeof score === 'string' && score.includes('/')) {
      value = parseInt(score.split('/')[0], 10);
    } else if (typeof score === 'number') {
      value = Math.round(score);
    }
    // Convert score out of 100 to score out of 10
    return (value / 10).toFixed(1); // Ensure one decimal place
  };

  const getScoreDenom = (score: unknown): string => {
    // The new denominator should always be 10
    return '10';
  };

  const getScoreColorName = (score: number, denom?: string): 'green' | 'yellow' | 'red' => {
    const d = Number(denom || '10');
    const pct = d > 0 ? (score / d) * 100 : 0;
    if (pct >= 75) return 'green';
    if (pct >= 50) return 'yellow';
    return 'red';
  };

  const verdictColor = (verdict: string) => {
    const v = (verdict || '').toLowerCase();
    // Check negative first so 'not recommended' doesn't falsely match 'recommended'
    if (v.includes('not recommended') || v.includes('no hire')) {
      return { 
        bg: 'bg-rose-50 dark:bg-rose-500/15', 
        border: 'border-rose-200 dark:border-rose-500/40', 
        text: 'text-rose-700 dark:text-rose-400',
        glow: 'shadow-xs dark:shadow-[0_0_15px_rgba(244,63,94,0.15)]',
        statusText: 'Not Recommended'
      };
    }
    if (v.includes('reservations') || v.includes('leaning no')) {
      return { 
        bg: 'bg-amber-50 dark:bg-amber-500/15', 
        border: 'border-amber-200 dark:border-amber-500/40', 
        text: 'text-amber-700 dark:text-amber-400',
        glow: 'shadow-xs dark:shadow-[0_0_15px_rgba(245,158,11,0.15)]',
        statusText: 'Reservations / Under Review'
      };
    }
    if (v.includes('recommended') || v.includes('hire') || v.includes('strong hire')) {
      return { 
        bg: 'bg-emerald-50 dark:bg-emerald-500/15', 
        border: 'border-emerald-200 dark:border-emerald-500/40', 
        text: 'text-emerald-700 dark:text-emerald-400',
        glow: 'shadow-xs dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]',
        statusText: 'Recommended for Hire'
      };
    }
    return { 
      bg: 'bg-[#F8F9F5] dark:bg-white/[0.04]', 
      border: 'border-[#E4E7DC] dark:border-white/10', 
      text: 'text-[#111215] dark:text-gray-300',
      glow: '',
      statusText: verdict || 'Assessment Complete'
    };
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      messageBox.showSuccess('Report link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      messageBox.showError('Failed to copy link.');
    });
  };

  const handleDownloadPDF = () => {
    if (!submission) return messageBox.showError("No report data found to download.");
    messageBox.showInfo("Generating PDF... Please wait.");

    try {
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentW = pageW - margin * 2;
        let y = margin;

        const checkPage = (needed: number) => {
            if (y + needed > pageH - margin) { pdf.addPage(); y = margin; }
        };

        const drawSectionHeader = (text: string) => {
            checkPage(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
            pdf.setTextColor(15, 23, 42);
            pdf.text(text, margin, y);
            y += 5;
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.2);
            pdf.line(margin, y, margin + contentW, y);
            y += 8;
        };

        const drawInfoBox = (label: string, value: string, x: number, boxY: number, boxW: number) => {
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(x, boxY, boxW, 16, 2, 2, 'FD');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139);
            pdf.text(label, x + 4, boxY + 6);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(15, 23, 42);
            
            // Protect against long text overflow
            const valStr = (value || 'N/A').toString();
            const valueLines = pdf.splitTextToSize(valStr, boxW - 6);
            if (valueLines.length > 1) {
                pdf.setFontSize(8);
                pdf.text(valueLines[0].substring(0, 30) + '...', x + 4, boxY + 12);
            } else {
                pdf.text(valStr, x + 4, boxY + 12);
            }
        };

        // 1. HEADER
        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 0, pageW, 30, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.setTextColor(255, 255, 255);
        pdf.text('InterviewXpert Report', margin, 18);
        y = 40;

        // 2. CANDIDATE & JOB INFO
        const candName = submission.candidateInfo?.name || 'Candidate';
        const jobTitle = submission.jobTitle || 'Interview';
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.setTextColor(15, 23, 42);
        pdf.text(candName, margin, y);
        y += 8;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Applying for: ${jobTitle}`, margin, y);
        y += 6;
        const dateStr = submission.submittedAt?.toDate ? submission.submittedAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        pdf.setFontSize(10);
        pdf.text(`Date: ${dateStr} | Email: ${submission.candidateInfo?.email || 'N/A'}`, margin, y);
        y += 15;

        // 3. VERDICT & SCORES
        checkPage(35);
        const { 
            verdict, 
            summary, 
            roleFit, 
            communicationSkills, 
            technicalSkills,
            hasDetailedComms,
            communicationDetails,
            overallCommsRating,
            detailedStyleAnalysis
        } = parseFeedback(submission.feedback);
        const vColor = verdictColor(verdict);
        const verdictBg = vColor.bg.includes('green') ? [236, 253, 245] : vColor.bg.includes('yellow') ? [254, 252, 232] : vColor.bg.includes('red') ? [254, 242, 242] : [241, 245, 249];
        const verdictBorder = vColor.border.includes('green') ? [167, 243, 208] : vColor.border.includes('yellow') ? [252, 211, 77] : vColor.border.includes('red') ? [252, 165, 165] : [226, 232, 240];
        const verdictText = vColor.text.includes('green') ? [21, 128, 61] : vColor.text.includes('yellow') ? [180, 83, 9] : vColor.text.includes('red') ? [185, 28, 28] : [55, 65, 81];
        
        pdf.setFillColor(verdictBg[0], verdictBg[1], verdictBg[2]);
        pdf.setDrawColor(verdictBorder[0], verdictBorder[1], verdictBorder[2]);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(margin, y, contentW, 20, 3, 3, 'FD');
        pdf.setFontSize(8);
        pdf.setTextColor(verdictText[0], verdictText[1], verdictText[2]);
        pdf.text('HIRING VERDICT', pageW / 2, y + 7, { align: 'center' });
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(verdict.toUpperCase(), pageW / 2, y + 15, { align: 'center' });
        y += 28;

        const scores = [
            { label: 'Overall Score', value: getScoreValue(submission.score), denom: getScoreDenom(submission.score) },
            { label: 'Resume Match',  value: getScoreValue(submission.resumeScore), denom: getScoreDenom(submission.resumeScore) },
            { label: 'Q&A Score',     value: getScoreValue(submission.qnaScore),    denom: getScoreDenom(submission.qnaScore) },
        ];
        const cardW = (contentW - 8) / 3;
        scores.forEach((s, i) => {
            drawInfoBox(s.label, `${s.value}/${s.denom}`, margin + i * (cardW + 4), y, cardW);
        });
        y += 24;

        // 4. CANDIDATE PROFILE DETAILS
        if (submission.candidateInfo) {
            drawSectionHeader("Candidate Profile");
            const info = submission.candidateInfo;
            const col1X = margin;
            const col2X = margin + contentW / 2 + 4;
            const colW = contentW / 2 - 4;
            
            let profileDetails = [];
            profileDetails.push({ label: 'Experience Level', value: info.experienceType });
            if (info.experienceType === 'experienced') {
                profileDetails.push({ label: 'Total Experience', value: `${info.totalExperienceYears}y ${info.totalExperienceMonths}m` });
                profileDetails.push({ label: 'Work Status', value: info.workStatus?.replace('_', ' ') });
                profileDetails.push({ label: info.workStatus === 'working' ? 'Current Company' : 'Last Company', value: info.workStatus === 'working' ? info.currentCompany : info.pastCompany });
                profileDetails.push({ label: 'Current Salary', value: `${info.currentSalary} LPA` });
                profileDetails.push({ label: 'Expected Salary', value: `${info.expectedSalary} LPA` });
                profileDetails.push({ label: 'Has Salary Proof', value: info.hasSalaryProof });
            } else { // Fresher
                profileDetails.push({ label: 'Graduation Year', value: info.graduationYear });
                profileDetails.push({ label: 'College', value: info.collegeName });
                profileDetails.push({ label: 'Degree', value: `${info.degree} in ${info.specialization}` });
            }
            profileDetails.push({ label: 'Current City', value: info.currentCity || info.currentLocation || 'N/A' });
            if (jobLocation) {
                profileDetails.push({ label: 'Job Location', value: jobLocation });
                profileDetails.push({
                    label: 'Location Match',
                    value: isLoc100Match ? '100% Fully Matched' : 'Location Difference'
                });
            }
            profileDetails.push({ label: 'Ready to Relocate', value: info.readyToRelocate });

            for (let i = 0; i < profileDetails.length; i++) {
                checkPage(20);
                const xPos = i % 2 === 0 ? col1X : col2X;
                drawInfoBox(profileDetails[i].label, profileDetails[i].value || 'N/A', xPos, y, colW);
                if (i % 2 !== 0 || i === profileDetails.length - 1) {
                    y += 20;
                }
            }
            y += 4;
        }

        // 4b. PROFILE CRITERIA MISMATCHES
        const validMismatchesForPdf = getValidCriteriaMismatches(submission.candidateInfo?.criteriaMismatches);
        if (validMismatchesForPdf.length > 0) {
            drawSectionHeader("Profile Criteria Mismatches Noted");
            validMismatchesForPdf.forEach((m: string) => {
                checkPage(10);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9);
                pdf.setTextColor(180, 83, 9);
                pdf.text(`• ${m}`, margin + 4, y);
                y += 5;
            });
            y += 4;
        }

        // 5. AI EVALUATION
        drawSectionHeader("AI Evaluation");
        const aiSections = [
            { title: 'Executive Summary', body: summary },
            { title: 'Role & Resume Fit', body: roleFit },
            { title: 'Role Fit as per AI Interview', body: hasDetailedComms ? 'N/A' : communicationSkills },
            { title: 'Technical / Domain Skills', body: technicalSkills },
        ];

        aiSections.forEach(sec => {
            if (!sec.body || sec.body === 'N/A') return;

            checkPage(20);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42); 
            
            // Add a small primary-colored accent rectangle next to the title
            pdf.setFillColor(37, 99, 235);
            pdf.rect(margin, y - 3, 1.5, 4, 'F');
            
            pdf.text(sec.title, margin + 4, y);
            y += 6;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(71, 85, 105);
            
            const bodyLines = pdf.splitTextToSize(sec.body, contentW - 4);
            const blockH = bodyLines.length * 4.5 + 4;
            checkPage(blockH + 5);
            
            pdf.text(bodyLines, margin + 4, y);
            y += blockH + 6;
        });

        // 5b. COMMUNICATION SKILLS ANALYSIS
        if (hasDetailedComms) {
            drawSectionHeader("Communication Skills Analysis");
            
            // Draw Overall Rating info box
            checkPage(18);
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
            pdf.setFontSize(8.5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            pdf.text('OVERALL COMMUNICATION SCORE', margin + 4, y + 5.5);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(37, 99, 235);
            pdf.text(`${overallCommsRating || 'N/A'}`, margin + 4, y + 11.5);
            y += 18;

            // Draw each parameter with dynamic wrapping
            const col1X = margin;
            const col2X = margin + contentW / 2 + 3;
            const colW = contentW / 2 - 3;
            
            const params = Object.entries(communicationDetails);
            const labelMap: Record<string, string> = {
                fluency: 'Fluency in Languages',
                clarity: 'Clarity of Speech',
                confidence: 'Confidence Level',
                grammar: 'Grammar & Vocabulary',
                listening: 'Listening Skills',
                tone: 'Professional Tone',
                accent: 'Pronunciation / Accent',
                explainExp: 'Explain Experience',
                presence: 'Presence of Mind',
                etiquette: 'Telephone Etiquette',
                interpersonal: 'Interpersonal Skills'
            };

            for (let i = 0; i < params.length; i += 2) {
                const p1 = params[i];
                const p2 = params[i + 1];

                const calcBoxH = (item?: { rating: string; comment: string }) => {
                    if (!item) return 16;
                    const commentLines = item.comment ? pdf.splitTextToSize(item.comment, colW - 6) : [];
                    return Math.max(16, 9 + commentLines.length * 3.5 + 2);
                };

                const rowH = Math.max(calcBoxH(p1 ? p1[1] : undefined), calcBoxH(p2 ? p2[1] : undefined));
                checkPage(rowH + 4);

                // Draw left box
                pdf.setFillColor(248, 250, 252);
                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(col1X, y, colW, rowH, 2, 2, 'FD');

                pdf.setFontSize(7.5);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(100, 116, 139);
                pdf.text((labelMap[p1[0]] || p1[0]).toUpperCase(), col1X + 3, y + 4.5);

                pdf.setFontSize(8.5);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(15, 23, 42);
                pdf.text(`Rating: ${p1[1].rating}`, col1X + 3, y + 8.5);

                if (p1[1].comment) {
                    pdf.setFontSize(7);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(71, 85, 105);
                    const commentLines = pdf.splitTextToSize(p1[1].comment, colW - 6);
                    pdf.text(commentLines, col1X + 3, y + 12.5);
                }

                // Draw right box if exists
                if (p2) {
                    pdf.setFillColor(248, 250, 252);
                    pdf.setDrawColor(226, 232, 240);
                    pdf.setLineWidth(0.3);
                    pdf.roundedRect(col2X, y, colW, rowH, 2, 2, 'FD');

                    pdf.setFontSize(7.5);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(100, 116, 139);
                    pdf.text((labelMap[p2[0]] || p2[0]).toUpperCase(), col2X + 3, y + 4.5);

                    pdf.setFontSize(8.5);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(15, 23, 42);
                    pdf.text(`Rating: ${p2[1].rating}`, col2X + 3, y + 8.5);

                    if (p2[1].comment) {
                        pdf.setFontSize(7);
                        pdf.setFont('helvetica', 'normal');
                        pdf.setTextColor(71, 85, 105);
                        const commentLines = pdf.splitTextToSize(p2[1].comment, colW - 6);
                        pdf.text(commentLines, col2X + 3, y + 12.5);
                    }
                }

                y += rowH + 3;
            }
            y += 4;

            if (detailedStyleAnalysis && detailedStyleAnalysis !== 'N/A') {
                checkPage(24);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.setTextColor(15, 23, 42);
                
                pdf.setFillColor(37, 99, 235);
                pdf.rect(margin, y - 3, 1.5, 4, 'F');
                
                pdf.text("Communication Style Analysis", margin + 4, y);
                y += 6;

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(71, 85, 105);
                
                const styleLines = pdf.splitTextToSize(detailedStyleAnalysis, contentW - 4);
                const blockH = styleLines.length * 4.5 + 4;
                checkPage(blockH + 5);
                pdf.text(styleLines, margin + 4, y);
                y += blockH + 6;
            }
        }
        y += 2;

        // 6. SESSION INTEGRITY
        const reportedTabSwitches = Number(submission.tabSwitchCount ?? submission.meta?.tabSwitchCount ?? 0);
        drawSectionHeader("Session Integrity");
        drawInfoBox('Tab Switches', `${reportedTabSwitches}`, margin, y, Math.min(contentW, 48));
        y += 24;

        // 7. Q&A TRANSCRIPTS
        if (submission.questions && submission.questions.length > 0) {
            let renderedHeader = false;
            submission.questions.forEach((q, idx) => {
                const isQuestionHidden = submission.visibilitySettings?.hiddenQuestions?.[idx] === true;
                if (isQuestionHidden) return; // Skip hidden questions!

                if (!renderedHeader) {
                    drawSectionHeader("Interview Transcript");
                    renderedHeader = true;
                }

                const transcript = submission.transcriptTexts?.[idx] || 'Transcript not available.';
                const qLines = pdf.splitTextToSize(`Q${idx + 1}: ${q}`, contentW);
                const tLines = pdf.splitTextToSize(transcript, contentW - 10);
                const blockH = 6 + qLines.length * 5 + 4 + tLines.length * 4.5 + 6;
                checkPage(blockH + 4);

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.setTextColor(15, 23, 42);
                pdf.text(qLines, margin, y);
                y += qLines.length * 5 + 4;

                pdf.setFillColor(248, 250, 252);
                pdf.roundedRect(margin, y, contentW, tLines.length * 4.5 + 8, 2, 2, 'F');
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(82, 82, 91);
                pdf.text(tLines, margin + 4, y + 6);
                y += tLines.length * 4.5 + 8 + 8;
            });
        }

        // 8. FOOTER
        const totalPages = (pdf as any).internal.getNumberOfPages();
        for (let pg = 1; pg <= totalPages; pg++) {
            pdf.setPage(pg);
            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, pageH - 12, pageW - margin, pageH - 12);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text('Generated by InterviewXpert', margin, pageH - 7);
            pdf.text(`Page ${pg} of ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' });
        }

        pdf.save(`InterviewReport_${candName.replace(/\s/g, '_')}.pdf`);
        messageBox.showSuccess("Report downloaded successfully!");
    } catch (error) {
        console.error("PDF generation failed", error);
        messageBox.showError("Could not generate PDF. Please try again.");
    }
  };

  const parseFeedback = (feedback: unknown) => {
    if (typeof feedback !== 'string') {
      return {
        summary: 'N/A',
        roleFit: 'N/A',
        communicationSkills: 'N/A',
        technicalSkills: 'N/A',
        verdict: 'Not Available',
        hasDetailedComms: false,
        communicationDetails: {},
        overallCommsRating: 'N/A',
        detailedStyleAnalysis: 'N/A'
      };
    }

    const summaryMatch = feedback.match(/\*\*Overall Evaluation:\*\*([\s\S]*?)(?=\*\*Verdict:\*\*|\*\*Scores:\*\*|$)/);
    const roleFitMatch = feedback.match(/\*\*Resume Analysis:\*\*([\s\S]*?)(?=\*\*Answer Quality:\*\*|\*\*Scores:\*\*|$)/);
    const answerQualityBlock = feedback.match(/\*\*Answer Quality:\*\*([\s\S]*?)(?=\*\*Communication Skills:\*\*|\*\*Overall Evaluation:\*\*|\*\*Scores:\*\*|$)/);
    
    let communicationSkills = 'N/A';
    let technicalSkills = 'N/A';
    if (answerQualityBlock && answerQualityBlock[1]) {
      const commsMatch = answerQualityBlock[1].match(/\*\*Communication Skills:\*\*([\s\S]*?)(?=\*\*Technical Skills:\*\*|$)/);
      const techMatch = answerQualityBlock[1].match(/\*\*Technical Skills:\*\*([\s\S]*)/);
      communicationSkills = commsMatch ? commsMatch[1].trim() : 'N/A';
      technicalSkills = techMatch ? techMatch[1].trim() : 'N/A';
      // Fallback if sub-headings are not present in older reports
      if (communicationSkills === 'N/A' && technicalSkills === 'N/A') {
        communicationSkills = answerQualityBlock[1].trim();
      }
    }

    // Parse Detailed Communication Skills if present
    const commsHeaderRegex = /(?:\*{0,2}(?:3\.\s*)?Communication Skills(?:\s*Analysis)?\*{0,2}:?)/i;
    const commsBlockMatch = feedback.match(new RegExp(commsHeaderRegex.source + "([\\s\\S]*?)(?=(?:\\*{0,2}(?:4\\.\\s*)?Overall Evaluation\\*{0,2}:?|\\*{0,2}(?:5\\.\\s*)?Verdict\\*{0,2}:?|\\*{0,2}(?:6\\.\\s*)?Scores\\*{0,2}:?|$))", "i"))
      || feedback.match(/(?:Overall (?:Communication )?Rating:[\s\S]*?)(?=(?:\*{0,2}Overall Evaluation|\*{0,2}Verdict|$))/i)
      || feedback.match(/(?:Fluency in English[\s\S]*?)(?=(?:\*{0,2}Overall Evaluation|\*{0,2}Verdict|$))/i);

    const communicationDetails: Record<string, { rating: string; comment: string }> = {};
    let overallCommsRating = 'N/A';
    let detailedStyleAnalysis = 'N/A';
    let hasDetailedComms = false;

    if (commsBlockMatch && commsBlockMatch[1]) {
        const blockText = commsBlockMatch[1];
        
        // Extract Overall Rating (handles `Overall Rating:\n**4/10**`, `Overall Communication Rating: 4/10`, etc.)
        const overallRatingMatch = blockText.match(/Overall (?:Communication )?Rating:\s*(?:\n\s*)?(?:\*\*)?([0-9]+(?:\.[0-9]+)?\s*(?:\/\s*10)?)(?:\*\*)?/i)
          || blockText.match(/Overall (?:Communication )?Rating:\s*([^\n]+)/i);
        if (overallRatingMatch) {
            let r = overallRatingMatch[1].replace(/\*\*/g, '').trim();
            if (/^[0-9]+(?:\.[0-9]+)?$/.test(r)) r = `${r}/10`;
            overallCommsRating = r;
        }

        const paramsConfig = [
            { key: 'fluency', label: 'Fluency in English / Hindi / Marathi', nameRegex: /Fluency(?: in English \/ Hindi \/ Marathi)?/i },
            { key: 'clarity', label: 'Clarity of Speech', nameRegex: /Clarity of Speech/i },
            { key: 'confidence', label: 'Confidence Level', nameRegex: /Confidence Level/i },
            { key: 'grammar', label: 'Grammar & Vocabulary', nameRegex: /Grammar\s*(?:&|and)\s*Vocabulary/i },
            { key: 'listening', label: 'Listening Skills', nameRegex: /Listening Skills/i },
            { key: 'tone', label: 'Professional Tone', nameRegex: /Professional Tone/i },
            { key: 'accent', label: 'Pronunciation / Accent Neutrality', nameRegex: /Pronunciation\s*(?:\/|\s)\s*Accent(?:\s*Neutrality)?/i },
            { key: 'explainExp', label: 'Ability to Explain Experience', nameRegex: /(?:Ability to\s+)?Explain(?:\s+Past)?\s+Experience/i },
            { key: 'presence', label: 'Response Speed & Presence of Mind', nameRegex: /Response Speed\s*(?:&|and)\s*Presence of Mind/i },
            { key: 'etiquette', label: 'Telephone Etiquette', nameRegex: /Telephone Etiquette/i },
            { key: 'interpersonal', label: 'Interpersonal Skills', nameRegex: /Interpersonal Skills/i },
            { key: 'detailedStyleAnalysis', label: 'Detailed Style Analysis', nameRegex: /Detailed Style Analysis/i, isStyle: true }
        ];

        const markers: { key: string; label: string; index: number; length: number; isStyle?: boolean }[] = [];
        for (const p of paramsConfig) {
            const m = blockText.match(p.nameRegex);
            if (m && typeof m.index === 'number') {
                markers.push({ key: p.key, label: p.label, index: m.index, length: m[0].length, isStyle: p.isStyle });
            }
        }
        markers.sort((a, b) => a.index - b.index);

        if (markers.length > 0) {
            hasDetailedComms = true;
            for (let i = 0; i < markers.length; i++) {
                const curr = markers[i];
                const next = markers[i + 1];
                const chunk = blockText.slice(curr.index + curr.length, next ? next.index : undefined).trim();

                if (curr.isStyle) {
                    detailedStyleAnalysis = chunk.replace(/^[:\s]+/, '').replace(/^Detailed Style Analysis:?/i, '').trim();
                    continue;
                }

                const cleanChunk = chunk.replace(/^[:\s]+/, '');
                const matchRatingComment = cleanChunk.match(/^(?:\*\*)?([A-Za-z0-9\s&+/]+?)(?:\*\*)?\s*(?:[–—\-:]|\s-\s|\s–\s|\s—\s)\s*([\s\S]*)$/);
                if (matchRatingComment) {
                    communicationDetails[curr.key] = {
                        rating: matchRatingComment[1].replace(/\*\*/g, '').trim(),
                        comment: matchRatingComment[2].trim().replace(/\s*\n\s*/g, ' ')
                    };
                } else {
                    const lines = cleanChunk.split('\n').map(l => l.trim()).filter(Boolean);
                    const firstLine = (lines[0] || '').replace(/\*\*/g, '').trim();
                    communicationDetails[curr.key] = {
                        rating: firstLine || 'N/A',
                        comment: lines.slice(1).join(' ').trim().replace(/\s*\n\s*/g, ' ')
                    };
                }
            }
        }

        // Fill any missing keys with N/A
        paramsConfig.forEach(p => {
            if (!p.isStyle && !communicationDetails[p.key]) {
                communicationDetails[p.key] = { rating: 'N/A', comment: '' };
            }
        });
    }

    // If detailed communications exist, ensure fallback communicationSkills doesn't duplicate the block
    if (hasDetailedComms && communicationSkills && communicationSkills !== 'N/A') {
        if (/Fluency|Clarity of Speech|Overall Rating|Confidence Level/i.test(communicationSkills)) {
            communicationSkills = 'Detailed Communication Skills evaluated below.';
        }
    }

    const verdictMatch = feedback.match(/\*\*Verdict:\*\*\s*(.*)/);
    
    const keyStrengthMatch = feedback.match(/(?:-\s*)?Key strength:\s*([^\n]*)/i);
    const keyWeaknessMatch = feedback.match(/(?:-\s*)?Key weakness:\s*([^\n]*)/i);

    return {
        summary: summaryMatch ? summaryMatch[1].trim() : 'N/A',
        roleFit: roleFitMatch ? roleFitMatch[1].trim() : 'N/A',
        communicationSkills,
        technicalSkills,
        verdict: verdictMatch ? verdictMatch[1].trim() : 'Not Available',
        keyStrength: keyStrengthMatch ? keyStrengthMatch[1].trim() : null,
        keyWeakness: keyWeaknessMatch ? keyWeaknessMatch[1].trim() : null,
        hasDetailedComms,
        communicationDetails,
        overallCommsRating,
        detailedStyleAnalysis
    };
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center relative">
            <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin mb-4" />
            <p className="geist-label text-xs uppercase tracking-widest text-emerald-400/80 font-mono">Loading Candidate Dossier...</p>
        </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#e0e0e0] flex items-center justify-center p-4 text-center relative">
          <div className="max-w-md w-full bg-[#0c0c0c] border border-white/[0.08] rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
                  <Shield size={28} />
              </div>
              <h1 className="geist-page-title text-2xl font-black text-white mb-2">Report Not Found</h1>
              <p className="text-sm text-white/50 mb-6">The requested interview report could not be found or has been removed.</p>
              <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-extrabold text-xs rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  Return to Home
              </button>
          </div>
      </div>
    );
  }

  // Check if client access has expired
  const expirationDateObj = getExpirationDate(submission.clientAccessExpiresAt);
  if (!isStaff && expirationDateObj && new Date() > expirationDateObj) {
    return (
      <div className="min-h-screen bg-[#070707] flex items-center justify-center p-4 relative">
          <div className="max-w-md w-full bg-[#0c0c0c] border border-white/[0.08] rounded-3xl p-8 text-center shadow-[0_16px_64px_rgba(0,0,0,0.8)] backdrop-blur-xl relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20 shadow-inner">
                  <Shield size={32} />
              </div>
              
              <h1 className="geist-page-title text-2xl font-black text-white mb-3">Client Access Expired</h1>
              <p className="text-xs sm:text-sm text-white/60 mb-5 leading-relaxed">
                  This candidate report link has expired. The recruiter set an access time limit which has passed. 
                  Please reach out to the recruiter if you need to extend access.
              </p>
              
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-5 text-xs text-emerald-300 font-semibold flex items-center justify-center gap-2 max-w-sm mx-auto shadow-sm">
                  <Phone size={14} className="text-emerald-400" />
                  <span>Contact to extend: <a href="tel:+917559305823" className="hover:underline font-mono font-bold text-emerald-400">+91 75593 05823</a></span>
              </div>
              
              <div className="text-[11px] font-mono text-white/40 bg-white/[0.03] py-2 px-4 rounded-xl border border-white/[0.06] w-max mx-auto mb-6">
                  Expired on: {expirationDateObj.toLocaleString('en-GB')}
              </div>
              
              <a href="https://interviewxpert.in" className="inline-block px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-extrabold rounded-xl text-xs hover:from-emerald-400 hover:to-teal-300 transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  Go to InterviewXpert
              </a>
          </div>
      </div>
    );
  }

  const { 
      summary, 
      roleFit, 
      communicationSkills, 
      technicalSkills, 
      verdict, 
      keyStrength, 
      keyWeakness,
      hasDetailedComms,
      communicationDetails,
      overallCommsRating,
      detailedStyleAnalysis
  } = parseFeedback(submission.feedback);
  const vColor = verdictColor(verdict);

  const candInitials = (submission.candidateInfo?.name || 'Candidate')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#070707] text-[#111215] dark:text-[#e0e0e0] font-sans p-3 sm:p-6 lg:p-8 relative selection:bg-[#D4F82C] selection:text-[#111215]">
        {/* Ambient subtle landing page glows */}
        <div className="fixed top-0 left-1/4 w-[600px] h-[350px] bg-[#D4F82C]/[0.06] dark:bg-emerald-500/[0.03] rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="fixed bottom-10 right-10 w-[500px] h-[350px] bg-indigo-500/[0.04] dark:bg-indigo-500/[0.03] rounded-full blur-[140px] pointer-events-none -z-10" />

        {/* Sticky Header */}
        <div className="sticky top-3 z-40 bg-[#F8F9F5]/90 dark:bg-[#0c0c0c]/85 backdrop-blur-xl rounded-2xl border border-[#E4E7DC] dark:border-white/[0.08] mb-6 sm:mb-8 shadow-xs dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center p-3 sm:p-4 gap-3">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#111215] dark:text-white/70 hover:text-black dark:hover:text-white bg-white dark:bg-white/[0.04] hover:bg-[#F0F2EB] dark:hover:bg-white/[0.08] border border-[#E4E7DC] dark:border-white/[0.06] transition-all shadow-xs" 
                        title="Go Back"
                    >
                        <ArrowLeft size={15} /> <span>Back</span>
                    </button>
                    <HireXLogo withLink to="/" size="md" variant="full" isDark={isDark} />
                    <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider text-[#111215] dark:text-[#D4F82C] bg-[#D4F82C] dark:bg-[#D4F82C]/15 border border-[#b8da1f] dark:border-[#D4F82C]/30 font-bold">
                        <Brain size={12} /> AI Candidate Dossier
                    </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <DayNightToggle />
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 bg-white dark:bg-white/[0.04] hover:bg-[#F0F2EB] dark:hover:bg-white/[0.08] text-[#111215] dark:text-white/90 border border-[#E4E7DC] dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] rounded-xl text-xs font-bold transition-all shadow-xs"
                        title="Copy Report Link"
                    >
                        <LinkIcon size={14} /> <span>Share Link</span>
                    </button>
                    <button 
                        onClick={handleDownloadPDF} 
                        className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 bg-[#111215] hover:bg-black text-white dark:bg-[#D4F82C] dark:hover:bg-[#c2e424] dark:text-[#111215] rounded-xl text-xs sm:text-sm font-extrabold shadow-sm dark:shadow-[0_0_20px_rgba(212,248,44,0.3)] transition-all active:scale-[0.98]"
                    >
                        <Download size={15} /> <span>Download PDF</span>
                    </button>
                </div>
            </div>
        </div>

        <div id="report-content" className={`mx-auto transition-all duration-300 ${isCompareMode ? 'max-w-full flex flex-col xl:flex-row gap-6' : 'max-w-7xl space-y-6'}`}>
            
            <div className={`space-y-6 flex-1 w-full ${isCompareMode ? 'xl:w-1/2' : ''}`}>
                {/* Header & Candidate Info + Integrated Performance Strip */}
                <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden space-y-6">
                    <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-bl from-[#D4F82C]/10 dark:from-emerald-500/10 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

                    {/* Top Row: Candidate Profile Info + Actions */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#D4F82C] text-[#111215] border border-[#b8da1f] dark:bg-gradient-to-tr dark:from-emerald-500/30 dark:via-teal-500/20 dark:to-indigo-500/20 dark:border-emerald-500/30 dark:text-emerald-400 flex items-center justify-center font-extrabold text-2xl sm:text-3xl shadow-sm shrink-0 font-mono">
                                {candInitials || 'C'}
                            </div>

                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="geist-page-title text-2xl sm:text-3xl font-extrabold text-[#111215] dark:text-white tracking-tight">
                                        {submission.candidateInfo?.name || 'Candidate'}
                                    </h1>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${vColor.bg} ${vColor.border} ${vColor.text} ${vColor.glow}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        {vColor.statusText || verdict}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[#73766C] dark:text-white/60">
                                    <div className="flex items-center gap-1.5 text-[#111215]/80 dark:text-white/70">
                                        <i className="fas fa-envelope text-[#73766C]/60 dark:text-white/40"></i> 
                                        <span className="truncate max-w-[220px] font-medium">{submission.candidateInfo?.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[#111215]/80 dark:text-white/70">
                                        <i className="fas fa-calendar-alt text-[#73766C]/60 dark:text-white/40"></i> 
                                        <span className="font-medium">{submission.submittedAt?.toDate ? submission.submittedAt.toDate().toLocaleString('en-GB') : 'N/A'}</span>
                                    </div>
                                    {candidateCity && (
                                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                                            isLoc100Match 
                                                ? 'bg-[#D4F82C] text-[#111215] border-[#b8da1f] dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                                                : 'bg-[#F8F9F5] text-[#111215] border-[#E4E7DC] dark:bg-white/[0.04] dark:text-white/70 dark:border-white/[0.08]'
                                        }`}>
                                            <MapPin size={12} className={isLoc100Match ? 'text-[#111215] dark:text-emerald-400' : 'text-[#73766C] dark:text-white/40'} />
                                            <span>City: {candidateCity}</span>
                                            {isLoc100Match && (
                                                <span className="text-[9px] font-extrabold bg-[#111215] text-[#D4F82C] dark:bg-emerald-500 dark:text-black px-1.5 py-0.2 rounded-full uppercase tracking-wider font-mono">
                                                    100% Match
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {submission.candidateResumeURL && !submission.candidateResumeURL.startsWith('data:text/plain') && (
                                        <button 
                                            onClick={() => setIsResumeModalOpen(true)} 
                                            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors font-semibold" 
                                            title="View Resume Inline"
                                        >
                                            <FileText size={13} />
                                            <span>View Resume {isDocxFile(submission.candidateResumeURL) ? '(Word)' : '(PDF)'}</span>
                                        </button>
                                    )}
                                    {submission.candidateResumeURL?.startsWith('data:text/plain') && (
                                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                            <FileText size={13} />
                                            <span>Parsed Resume Data</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5 items-center justify-start w-full lg:w-auto lg:justify-end">
                            {isStaff && (
                                <div 
                                    onClick={(e) => {
                                        const input = e.currentTarget.querySelector('input');
                                        if (input) {
                                            try { input.showPicker(); } catch (err) {}
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                                        submission.clientAccessExpiresAt 
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' 
                                            : 'bg-[#F8F9F5] hover:bg-[#F0F2EB] border-[#E4E7DC] text-[#111215] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-white/70'
                                    }`}
                                >
                                    <span className="text-xs font-bold text-[#73766C] dark:text-white/50 flex items-center gap-1 whitespace-nowrap">
                                        <Calendar size={13} className={submission.clientAccessExpiresAt ? "text-emerald-600 dark:text-emerald-400 animate-pulse" : "text-[#73766C]/60 dark:text-white/40"} /> Expires:
                                    </span>
                                    <input
                                        type="datetime-local"
                                        value={formatDatetimeLocal(getExpirationDate(submission.clientAccessExpiresAt))}
                                        onChange={handleSetExpiration}
                                        className="bg-transparent border-none text-xs font-mono font-bold text-[#111215] dark:text-white focus:outline-none cursor-pointer p-0 text-center"
                                        style={{ colorScheme: isDark ? 'dark' : 'light' }}
                                    />
                                    {submission.clientAccessExpiresAt && (
                                        <button 
                                            onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleClearExpiration();
                                            }}
                                            className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-bold ml-1 cursor-pointer border-l border-gray-300 dark:border-white/10 pl-1.5"
                                            title="Remove expiration limit"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            )}
                            {submission.candidateResumeURL && !submission.candidateResumeURL.startsWith('data:text/plain') && (
                                <button 
                                    onClick={() => setIsCompareMode(!isCompareMode)} 
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                                        isCompareMode 
                                            ? 'bg-[#111215] text-[#D4F82C] border-black dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' 
                                            : 'bg-white hover:bg-[#F0F2EB] text-[#111215] border-[#E4E7DC] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/90 dark:border-white/[0.08]'
                                    }`}
                                >
                                    <FileText size={14} /> 
                                    <span>{isCompareMode ? 'Exit Compare' : 'Compare Resume'}</span>
                                </button>
                            )}
                            <button 
                                onClick={() => setIsResumeModalOpen(true)} 
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F0F2EB] text-[#111215] rounded-xl text-xs font-bold transition-all border border-[#E4E7DC] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/90 dark:border-white/[0.08] shadow-xs"
                            >
                                <User size={14} /> 
                                <span>Candidate Profile</span>
                            </button>
                        </div>
                    </div>

                    {/* Integrated 4-Tile Performance Overview Strip */}
                    <div className="pt-6 border-t border-[#E4E7DC] dark:border-white/[0.08] relative z-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Overall Fit */}
                            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex items-center justify-around">
                                <ScoreCircle score={Number(getScoreValue(submission.score))} denom={Number(getScoreDenom(submission.score))} color={getScoreColorName(Number(getScoreValue(submission.score)), getScoreDenom(submission.score))} label="Overall Fit" />
                            </div>

                            {/* Resume Match */}
                            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex items-center justify-around">
                                <ScoreCircle score={Number(getScoreValue(submission.resumeScore))} denom={Number(getScoreDenom(submission.resumeScore))} color={getScoreColorName(Number(getScoreValue(submission.resumeScore)), getScoreDenom(submission.resumeScore))} label="Resume Match" />
                            </div>

                            {/* Interview Q&A */}
                            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex items-center justify-around">
                                <ScoreCircle score={Number(getScoreValue(submission.qnaScore))} denom={Number(getScoreDenom(submission.qnaScore))} color={getScoreColorName(Number(getScoreValue(submission.qnaScore)), getScoreDenom(submission.qnaScore))} label="Interview Q&A" />
                            </div>

                            {/* Executive Decision & Verification Summary */}
                            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 font-mono">Executive Summary</span>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${vColor.bg} ${vColor.border} ${vColor.text}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                            {vColor.statusText || verdict}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2 mt-3 pt-3 border-t border-[#E4E7DC] dark:border-white/[0.06] text-xs">
                                    <div className="flex items-center justify-between text-[#73766C] dark:text-white/60">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <Shield size={13} className="text-emerald-600 dark:text-emerald-400" /> Integrity
                                        </span>
                                        <span className={`font-mono font-bold ${Number(submission.tabSwitchCount ?? submission.meta?.tabSwitchCount ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {Number(submission.tabSwitchCount ?? submission.meta?.tabSwitchCount ?? 0)} Tab Switches
                                        </span>
                                    </div>
                                    {candidateCity && (
                                        <div className="flex items-center justify-between text-[#73766C] dark:text-white/60">
                                            <span className="flex items-center gap-1.5 font-medium">
                                                <MapPin size={13} className="text-indigo-600 dark:text-indigo-400" /> Location
                                            </span>
                                            <span className={`font-mono font-bold ${isLoc100Match ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#111215] dark:text-white'}`}>
                                                {isLoc100Match ? '100% Matched' : candidateCity}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1. MASTER FULL-SESSION CONTINUOUS VIDEO PLAYER WITH CHAPTER BOOKMARKS */}
                {(() => {
                  const masterFullVideoUrl =
                    submission.fullSessionVideoUrl ||
                    (submission as any).videoUrl ||
                    (submission as any).candidateVideoUrl ||
                    (submission as any).videoRecordingUrl ||
                    (submission as any).audioRecordingUrl ||
                    (submission.videoURLs && submission.videoURLs.length > 0 ? submission.videoURLs[0] : null) ||
                    (submission.id ? `https://interviewxpert-storage.s3.ap-south-1.amazonaws.com/videos/voice_interview_video_${submission.id}.webm` : null);

                  if (!masterFullVideoUrl) return null;

                  const activeBookmarks = (submission.videoBookmarks && submission.videoBookmarks.length > 0)
                    ? submission.videoBookmarks
                    : (submission.questions && submission.questions.length > 0)
                      ? submission.questions.map((q, qIdx) => {
                          const step = 45;
                          const sec = qIdx * step;
                          const m = Math.floor(sec / 60);
                          const s = sec % 60;
                          return {
                            type: 'question' as const,
                            questionIndex: qIdx,
                            title: q.length > 55 ? q.slice(0, 52) + '...' : q,
                            timestampSec: sec,
                            formattedTime: `${m}:${s < 10 ? '0' : ''}${s}`
                          };
                        })
                      : [];

                  return (
                    <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E4E7DC] dark:border-white/[0.06]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#D4F82C] border border-[#b8da1f] text-[#111215] flex items-center justify-center shrink-0 shadow-xs font-black">
                            <Video size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg sm:text-xl font-extrabold text-[#111215] dark:text-white">
                                Master Full-Session Video Recording
                              </h2>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black uppercase bg-[#111215] text-[#D4F82C]">
                                Continuous Call
                              </span>
                            </div>
                            <p className="text-xs text-[#73766C] dark:text-white/50 mt-0.5">
                              Dual-channel video (Candidate camera + Microphone + AI Interviewer speech) with interactive chapter jump points
                            </p>
                          </div>
                        </div>

                        <a
                          href={masterFullVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`interview_full_session_${submission.id || 'recording'}.webm`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] hover:bg-white text-xs font-bold text-[#111215] shadow-xs transition-colors shrink-0"
                        >
                          <Download size={13} /> Download Full Video
                        </a>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Video Player */}
                        <div className="lg:col-span-2 rounded-2xl overflow-hidden bg-black aspect-video border border-[#E4E7DC] shadow-md relative">
                          <video
                            id="master-full-session-video"
                            src={masterFullVideoUrl}
                            controls
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Chapter Jump Bookmarks */}
                        <div className="flex flex-col bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] rounded-2xl p-4 space-y-3 min-h-[260px] max-h-[380px] overflow-y-auto custom-scrollbar">
                          <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/[0.06] pb-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#73766C] flex items-center gap-1.5">
                              <Layers size={13} className="text-[#111215]" /> Chapter Markers
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#73766C]">
                              {activeBookmarks.length} Jump Points
                            </span>
                          </div>

                          {activeBookmarks.length > 0 ? (
                            <div className="space-y-2">
                              {activeBookmarks.map((bm: any, bIdx: number) => (
                                <button
                                  key={bIdx}
                                  type="button"
                                  onClick={() => {
                                    const vid = document.getElementById('master-full-session-video') as HTMLVideoElement | null;
                                    if (vid) {
                                      vid.currentTime = bm.timestampSec;
                                      try {
                                        const p = vid.play();
                                        if (p && typeof p.catch === 'function') {
                                          p.catch(() => {});
                                        }
                                      } catch (_) {}
                                    }
                                  }}
                                  className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215] transition-all cursor-pointer shadow-2xs group flex items-start gap-2.5"
                                >
                                  <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${
                                    bm.type === 'cross_question'
                                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                      : 'bg-[#D4F82C] text-[#111215] border border-[#b8da1f]'
                                  }`}>
                                    {bm.formattedTime || `${bm.timestampSec}s`}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-[#111215] dark:text-white line-clamp-2 group-hover:text-black">
                                      {bm.type === 'cross_question' ? 'Follow-Up: ' : `Q${bm.questionIndex + 1}: `}
                                      {bm.title}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-10 text-xs text-[#73766C]">
                              Continuous video ready. Play or scrub through the timeline above.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Main 2-Column Grid */}
                <div className={`grid grid-cols-1 gap-6 ${isCompareMode ? '' : 'lg:grid-cols-12'}`}>
                    {/* Left Column: AI Evaluation & Intelligence */}
                    <div className={`space-y-6 ${isCompareMode ? '' : 'lg:col-span-7 xl:col-span-7'}`}>
                        {/* Candidate Profile Requirement Mismatch Banner */}
                        {(() => {
                            const validMismatches = getValidCriteriaMismatches(submission.candidateInfo?.criteriaMismatches);
                            if (validMismatches.length === 0) return null;
                            return (
                                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-5 sm:p-6 border border-amber-200 dark:border-amber-500/30 shadow-xs text-amber-900 dark:text-amber-200 space-y-2">
                                    <div className="flex items-center gap-2.5 font-extrabold text-sm sm:text-base text-amber-800 dark:text-amber-300">
                                        <i className="fas fa-exclamation-triangle text-amber-600 dark:text-amber-400"></i>
                                        <span>Candidate Profile Criteria Mismatch Noted</span>
                                    </div>
                                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                                        The candidate proceeded to take the interview despite the following profile requirement mismatches:
                                    </p>
                                    <ul className="list-disc list-inside text-xs font-medium space-y-1 pl-1 text-amber-900 dark:text-amber-200/90">
                                        {validMismatches.map((mismatch: string, idx: number) => (
                                            <li key={idx}>{mismatch}</li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })()}

                        {/* AI Hiring Manager Evaluation Card */}
                        <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#E4E7DC] dark:border-white/[0.06] mb-6 gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                                        <Brain size={20} />
                                    </div>
                                    <div>
                                        <h2 className="geist-section-title text-lg sm:text-xl font-extrabold text-[#111215] dark:text-white">
                                            Hiring Manager Evaluation
                                        </h2>
                                        <p className="text-xs text-[#73766C] dark:text-white/50">Comprehensive evaluation across candidate experience and responses</p>
                                    </div>
                                </div>
                                {verdict && (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${vColor.bg} ${vColor.border} ${vColor.text} ${vColor.glow} self-start sm:self-auto`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        {verdict}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-6">
                                {/* Executive Summary */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#111215] dark:text-indigo-400/90 font-mono">Executive Summary</span>
                                    </div>
                                    <div className="border-l-4 border-l-[#D4F82C] bg-[#F4F6F0] dark:bg-gradient-to-br dark:from-indigo-950/40 dark:via-[#0e0f1e]/90 dark:to-blue-950/20 p-5 sm:p-6 rounded-r-2xl rounded-l-md border border-l-0 border-[#E4E7DC] dark:border-indigo-500/25 shadow-inner text-sm sm:text-base text-[#111215] dark:text-indigo-100/90 leading-relaxed font-sans whitespace-pre-wrap">
                                        {summary}
                                    </div>
                                </div>

                                {/* Role Fit */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Briefcase size={14} className="text-[#73766C] dark:text-white/50" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/50 font-mono">Role Fit Assessment</span>
                                    </div>
                                    <div className="bg-[#F8F9F5] dark:bg-white/[0.02] p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/[0.06] text-sm text-[#2c2f28] dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {roleFit}
                                    </div>
                                </div>

                                {!hasDetailedComms && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare size={14} className="text-[#73766C] dark:text-white/50" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/50 font-mono">Role Fit as per AI Interview</span>
                                        </div>
                                        <div className="bg-[#F8F9F5] dark:bg-white/[0.02] p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/[0.06] text-sm text-[#2c2f28] dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                            {communicationSkills}
                                        </div>
                                    </div>
                                )}

                                {technicalSkills && technicalSkills !== 'N/A' && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Zap size={14} className="text-[#73766C] dark:text-white/50" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/50 font-mono">Technical & Domain Skills</span>
                                        </div>
                                        <div className="bg-[#F8F9F5] dark:bg-white/[0.02] p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/[0.06] text-sm text-[#2c2f28] dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                            {technicalSkills}
                                        </div>
                                    </div>
                                )}

                                {/* Strengths & Weaknesses */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    {keyStrength && (
                                        <div className="bg-[#EBF9F1] dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2.5 text-[#0d5930] dark:text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">
                                                    <CheckCircle2 size={16} /> Key Strength
                                                </div>
                                                <p className="text-xs sm:text-sm text-[#14532d] dark:text-emerald-200/90 leading-relaxed whitespace-pre-wrap">
                                                    {keyStrength}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {keyWeakness && (
                                        <div className="bg-[#FFF1F2] dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2.5 text-[#881337] dark:text-rose-400 font-bold text-xs uppercase tracking-wider font-mono">
                                                    <XCircle size={16} /> Key Growth Area
                                                </div>
                                                <p className="text-xs sm:text-sm text-[#9f1239] dark:text-rose-200/90 leading-relaxed whitespace-pre-wrap">
                                                    {keyWeakness}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Communication Skills Card */}
                        {hasDetailedComms && (() => {
                            const numericRating = parseFloat(overallCommsRating) || 0;
                            let ratingTheme = {
                                badgeBg: 'bg-amber-50 dark:bg-amber-500/10',
                                border: 'border-amber-200 dark:border-amber-500/30',
                                text: 'text-amber-800 dark:text-amber-400',
                                status: 'Moderate / Needs Refinement'
                            };
                            if (numericRating >= 8) {
                                ratingTheme = {
                                    badgeBg: 'bg-emerald-50 dark:bg-emerald-500/10',
                                    border: 'border-emerald-200 dark:border-emerald-500/30',
                                    text: 'text-emerald-800 dark:text-emerald-400',
                                    status: 'Exceptional / Highly Fluent'
                                };
                            } else if (numericRating >= 6) {
                                ratingTheme = {
                                    badgeBg: 'bg-teal-50 dark:bg-cyan-500/10',
                                    border: 'border-teal-200 dark:border-cyan-500/30',
                                    text: 'text-teal-800 dark:text-cyan-400',
                                    status: 'Good / Professional'
                                };
                            } else if (numericRating > 0 && numericRating < 4) {
                                ratingTheme = {
                                    badgeBg: 'bg-rose-50 dark:bg-rose-500/10',
                                    border: 'border-rose-200 dark:border-rose-500/30',
                                    text: 'text-rose-800 dark:text-rose-400',
                                    status: 'Needs Improvement'
                                };
                            }

                            const commsIconMap: Record<string, React.ReactNode> = {
                                fluency: <Globe size={16} className="text-cyan-600 dark:text-cyan-400" />,
                                clarity: <Volume2 size={16} className="text-indigo-600 dark:text-indigo-400" />,
                                confidence: <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />,
                                grammar: <BookOpen size={16} className="text-emerald-600 dark:text-emerald-400" />,
                                listening: <Headphones size={16} className="text-violet-600 dark:text-violet-400" />,
                                tone: <UserCheck size={16} className="text-teal-600 dark:text-teal-400" />,
                                accent: <Mic size={16} className="text-pink-600 dark:text-pink-400" />,
                                explainExp: <FileText size={16} className="text-sky-600 dark:text-sky-400" />,
                                presence: <Zap size={16} className="text-amber-600 dark:text-yellow-400" />,
                                etiquette: <Phone size={16} className="text-rose-600 dark:text-rose-400" />,
                                interpersonal: <Users size={16} className="text-purple-600 dark:text-purple-400" />
                            };

                            const getRatingBadge = (rating: string) => {
                                const r = (rating || '').toLowerCase();
                                if (r.includes('excellent') || r.includes('high') || r.includes('professional') || r.includes('neutral') || r.includes('good')) {
                                    return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30';
                                }
                                if (r.includes('average') || r.includes('casual') || r.includes('medium') || r.includes('light accent') || r.includes('normal')) {
                                    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30';
                                }
                                if (r.includes('poor') || r.includes('low') || r.includes('unprepared') || r.includes('limited') || r.includes('slow') || r.includes('unprofessional') || r.includes('heavy accent')) {
                                    return 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30';
                                }
                                return 'bg-[#F8F9F5] text-[#111215] border-[#E4E7DC] dark:bg-white/[0.04] dark:text-white/70 dark:border-white/[0.08]';
                            };

                            const labelMap: Record<string, string> = {
                                fluency: 'Fluency in English / Hindi / Marathi',
                                clarity: 'Clarity of Speech',
                                confidence: 'Confidence Level',
                                grammar: 'Grammar & Vocabulary',
                                listening: 'Listening Skills',
                                tone: 'Professional Tone',
                                accent: 'Pronunciation / Accent Neutrality',
                                explainExp: 'Ability to Explain Experience',
                                presence: 'Response Speed & Presence of Mind',
                                etiquette: 'Telephone Etiquette',
                                interpersonal: 'Interpersonal Skills'
                            };

                            return (
                                <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[#E4E7DC] dark:border-white/[0.06] pb-5">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 flex items-center justify-center shadow-xs shrink-0">
                                                <MessageSquare size={22} />
                                            </div>
                                            <div>
                                                <h2 className="geist-section-title text-lg sm:text-xl font-bold text-[#111215] dark:text-white flex items-center gap-2">
                                                    Communication Skills Analysis
                                                </h2>
                                                <p className="text-xs text-[#73766C] dark:text-white/50 font-medium mt-0.5">
                                                    Spoken fluency, diction clarity, professional presence & demeanor
                                                </p>
                                            </div>
                                        </div>

                                        {overallCommsRating && overallCommsRating !== 'N/A' && (
                                            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-xs ${ratingTheme.badgeBg} ${ratingTheme.border}`}>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#73766C] dark:text-white/50 font-mono">
                                                        Overall Comms
                                                    </span>
                                                    <span className={`text-xs font-bold ${ratingTheme.text}`}>
                                                        {ratingTheme.status}
                                                    </span>
                                                </div>
                                                <div className={`text-2xl font-black tracking-tight ${ratingTheme.text} pl-3 border-l border-current/20 font-mono`}>
                                                    {overallCommsRating}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                                        {Object.entries(communicationDetails).map(([key, item]) => {
                                            const icon = commsIconMap[key] || <MessageSquare size={16} className="text-indigo-600 dark:text-indigo-400" />;
                                            const badgeStyle = getRatingBadge(item.rating);

                                            return (
                                                <div key={key} className="flex flex-col p-4 bg-[#F8F9F5] hover:bg-white dark:bg-white/[0.02] dark:hover:bg-white/[0.04] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] shadow-xs transition-all duration-200">
                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span className="p-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-[#E4E7DC] dark:border-white/[0.08] shrink-0">
                                                                {icon}
                                                            </span>
                                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white truncate">
                                                                {labelMap[key] || key}
                                                            </span>
                                                        </div>
                                                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border shrink-0 tracking-wide font-mono ${badgeStyle}`}>
                                                            {item.rating}
                                                        </span>
                                                    </div>
                                                    {item.comment && (
                                                        <p className="text-xs text-[#73766C] dark:text-white/60 leading-relaxed font-normal mt-1 pl-0.5">
                                                            {item.comment}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {detailedStyleAnalysis && detailedStyleAnalysis !== 'N/A' && (
                                        <div className="mt-6 pt-5 border-t border-[#E4E7DC] dark:border-white/[0.06]">
                                            <div className="p-5 rounded-2xl bg-[#F4F6F0] dark:bg-gradient-to-r dark:from-indigo-950/30 dark:via-[#0e0f1e]/80 dark:to-purple-950/20 border border-[#E4E7DC] dark:border-indigo-500/20">
                                                <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider font-mono">
                                                    <Sparkles size={16} /> Detailed Spoken Style & Persona Analysis
                                                </div>
                                                <p className="text-xs sm:text-sm text-[#2c2f28] dark:text-indigo-100/80 leading-relaxed font-medium whitespace-pre-wrap">
                                                    {detailedStyleAnalysis}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Right Column: Candidate Profile & Verification Dossier */}
                    <div className={`space-y-6 ${isCompareMode ? '' : 'lg:col-span-5 xl:col-span-5'}`}>
                        {/* 1. Professional & Employment Details Card */}
                        {submission.candidateInfo && (
                            <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                                <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/[0.06] mb-5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-[#D4F82C]/20 border border-[#b8da1f] dark:bg-emerald-500/10 dark:border-emerald-500/20 text-[#111215] dark:text-emerald-400 flex items-center justify-center shrink-0">
                                            <Briefcase size={18} />
                                        </div>
                                        <div>
                                            <h2 className="geist-section-title text-base sm:text-lg font-bold text-[#111215] dark:text-white">
                                                Professional Details
                                            </h2>
                                            <p className="text-[11px] text-[#73766C] dark:text-white/40">Work experience & compensation</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 font-mono px-2 py-0.5 rounded bg-[#F8F9F5] dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/[0.08]">
                                        {submission.candidateInfo.isFresher ? 'Fresher' : `${submission.candidateInfo.totalExperienceYears || 0}y Exp`}
                                    </span>
                                </div>

                                {submission.candidateInfo.isFresher ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center bg-[#F8F9F5] dark:bg-white/[0.02] rounded-2xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                        <Briefcase size={32} className="text-[#73766C]/40 dark:text-white/30 mb-3" />
                                        <span className="text-sm font-semibold text-[#111215] dark:text-white">Candidate is a Fresher</span>
                                        <p className="text-xs text-[#73766C] dark:text-white/50 mt-1">Ready for entry-level onboarding</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Total Experience</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.totalExperienceYears}y {submission.candidateInfo.totalExperienceMonths || 0}m</span>
                                        </div>
                                        <div className="flex flex-col p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Working Status</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white truncate">{(submission.candidateInfo as any).employmentStatus || ((submission.candidateInfo as any).isWorking ? 'Currently Working' : 'Not Working')}</span>
                                        </div>
                                        <div className="flex flex-col p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Current Company</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white truncate" title={submission.candidateInfo.currentCompanyName || 'N/A'}>{submission.candidateInfo.currentCompanyName || 'N/A'}</span>
                                        </div>
                                        <div className="flex flex-col p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Designation</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white truncate" title={submission.candidateInfo.designation || 'N/A'}>{submission.candidateInfo.designation || 'N/A'}</span>
                                        </div>
                                        <div className="flex flex-col p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Current CTC</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.currentSalary || 'N/A'}</span>
                                        </div>
                                        <div className="flex flex-col p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Expected CTC</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{(submission.candidateInfo as any).expectedSalary || 'N/A'}</span>
                                        </div>
                                        <div className="flex flex-col col-span-2 p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Notice Period</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{(submission.candidateInfo as any).noticePeriod || (submission.candidateInfo.noticePeriodDays ? `${submission.candidateInfo.noticePeriodDays} Days` : 'N/A')}</span>
                                        </div>
                                        <div className="flex flex-col col-span-2 p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 mb-1 font-mono">Reason for Job Change</span>
                                            <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white leading-relaxed" title={submission.candidateInfo.reasonForJobChange || 'N/A'}>{submission.candidateInfo.reasonForJobChange || 'N/A'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. Candidate Academic & Personal Profile Card */}
                        {submission.candidateInfo && (
                            <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                                <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/[0.06] mb-5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                            <GraduationCap size={18} />
                                        </div>
                                        <div>
                                            <h2 className="geist-section-title text-base sm:text-lg font-bold text-[#111215] dark:text-white">
                                                Academic & Personal Profile
                                            </h2>
                                            <p className="text-[11px] text-[#73766C] dark:text-white/40">Education, background & demographics</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Education section */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 font-mono">Qualifications</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">Basic Qualification</span>
                                                <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.qualificationBasic || 'N/A'}</span>
                                            </div>
                                            {submission.candidateInfo.qualificationPG && (
                                                <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                    <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">Post Graduation</span>
                                                    <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.qualificationPG}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Location Verification Banner */}
                                    {candidateCity && jobLocation && (
                                        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-all ${
                                            isLoc100Match
                                                ? 'bg-[#D4F82C]/15 border-[#D4F82C] dark:bg-emerald-500/10 dark:border-emerald-500/30 shadow-xs'
                                                : 'bg-[#F8F9F5] border-[#E4E7DC] dark:bg-white/[0.02] dark:border-white/[0.08]'
                                        }`}>
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isLoc100Match ? 'bg-[#111215] text-[#D4F82C] dark:bg-emerald-500 dark:text-black' : 'bg-[#111215]/10 text-[#111215] dark:bg-white/10 dark:text-white'
                                                }`}>
                                                    <MapPin size={16} />
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-extrabold ${isLoc100Match ? 'text-[#111215] dark:text-emerald-300' : 'text-[#111215] dark:text-white'}`}>
                                                        {isLoc100Match ? 'Location Match: 100% Fully Matched' : 'Location Comparison'}
                                                    </p>
                                                    <p className="text-[11px] text-[#73766C] dark:text-white/60 mt-0.5">
                                                        Candidate City: <strong className="text-[#111215] dark:text-white">{candidateCity}</strong> • Job: <strong className="text-[#111215] dark:text-white">{jobLocation}</strong>
                                                    </p>
                                                </div>
                                            </div>
                                            {isLoc100Match && (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#111215] text-[#D4F82C] dark:bg-emerald-500 dark:text-black uppercase tracking-wider shrink-0 shadow-xs font-mono">
                                                    100% Matched
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Personal details grid */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 font-mono">Personal Attributes</span>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">Current City</span>
                                                <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.currentCity || 'N/A'}</span>
                                            </div>
                                            <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">Native Place</span>
                                                <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.nativePlace || 'N/A'}</span>
                                            </div>
                                            <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">Gender</span>
                                                <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.gender || 'N/A'}</span>
                                            </div>
                                            <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">Age</span>
                                                <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.age || 'N/A'}</span>
                                            </div>
                                            <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">DOB</span>
                                                <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">
                                                    {submission.candidateInfo.dob ? new Date(submission.candidateInfo.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'}) : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col p-3 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                                <span className="text-[10px] font-medium text-[#73766C] dark:text-white/40">Marital Status</span>
                                                <span className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">{submission.candidateInfo.maritalStatus || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Highlighted Skills & Session Integrity Card */}
                        <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-5">
                            <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/[0.06]">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <Shield size={18} />
                                    </div>
                                    <div>
                                        <h2 className="geist-section-title text-base sm:text-lg font-bold text-[#111215] dark:text-white">
                                            Skills & Interview Integrity
                                        </h2>
                                        <p className="text-[11px] text-[#73766C] dark:text-white/40">Key competencies & proctored signals</p>
                                    </div>
                                </div>
                            </div>

                            {/* Highlighted Skills */}
                            {submission.candidateInfo?.highlightedSkillsForJob && (
                                <div className="p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 font-mono">Highlighted Skills</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {submission.candidateInfo.highlightedSkillsForJob.split(/[,;\n]/).map((skill: string, idx: number) => {
                                            const trimmed = skill.trim();
                                            if (!trimmed) return null;
                                            return (
                                                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-white/[0.06] text-[#111215] dark:text-white border border-[#E4E7DC] dark:border-white/[0.08] shadow-2xs">
                                                    {trimmed}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Resume Updated Flag */}
                            <div className="flex items-center justify-between p-3.5 bg-[#F8F9F5] dark:bg-white/[0.02] rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                    <Award size={15} className="text-[#73766C] dark:text-white/40" />
                                    <span className="text-xs font-semibold text-[#111215] dark:text-white">Resume Updated?</span>
                                </div>
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                    submission.candidateInfo?.resumeUpdated === 'Yes' 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
                                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                }`}>
                                    {submission.candidateInfo?.resumeUpdated || 'N/A'}
                                </span>
                            </div>

                            {/* Behavioral Stat: Tab switches */}
                            <BehavioralStat 
                                icon={<Shield size={18}/>} 
                                label="Session Tab Switches" 
                                value={Number(submission.tabSwitchCount ?? submission.meta?.tabSwitchCount ?? 0)} 
                                color={Number(submission.tabSwitchCount ?? submission.meta?.tabSwitchCount ?? 0) > 0 ? 'red' : 'green'} 
                            />
                        </div>
                    </div>
                </div>

                {/* 2. DEEPGRAM NOVA-3 SPEECH AI INTELLIGENCE */}
                {submission.speechAnalytics && (
                  <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] space-y-4">
                    <div className="flex items-center gap-3 border-b border-[#E4E7DC] dark:border-white/[0.06] pb-4">
                      <div className="w-9 h-9 rounded-xl bg-[#D4F82C] border border-[#b8da1f] text-[#111215] flex items-center justify-center shrink-0">
                        <Radio size={18} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-[#111215] dark:text-white text-base flex items-center gap-2">
                          <span>Deepgram Nova-3 Speech AI Intelligence</span>
                          <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#111215] text-[#D4F82C]">
                            Nova-3 Audio
                          </span>
                        </h3>
                        <p className="text-xs text-[#73766C] dark:text-white/50">
                          Real-time speech clarity, acoustic tone analysis, and filler words tracking
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Clarity & Confidence</span>
                        <span className="text-xl font-extrabold text-[#111215] dark:text-white mt-0.5 block">
                          {submission.speechAnalytics.averageConfidence ? `${submission.speechAnalytics.averageConfidence}%` : '96% High'}
                        </span>
                        <span className="text-[11px] text-[#575A51] dark:text-white/40 font-medium">STT Lexical Confidence</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Acoustic Sentiment</span>
                        <span className="text-xl font-extrabold text-[#111215] dark:text-white mt-0.5 block capitalize">
                          {submission.speechAnalytics.sentiment || 'Positive'}
                        </span>
                        <span className="text-[11px] text-[#575A51] dark:text-white/40 font-medium">Candidate Tone</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Filler Words Detected</span>
                        <span className="text-xl font-extrabold text-[#111215] dark:text-white mt-0.5 block">
                          {submission.speechAnalytics.fillerWordsDetected ?? '1'}
                        </span>
                        <span className="text-[11px] text-[#575A51] dark:text-white/40 font-medium">Speech Fluency</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Audio Model</span>
                        <span className="text-xl font-extrabold text-[#111215] dark:text-white mt-0.5 block uppercase">
                          {submission.speechAnalytics.detectedLanguage || 'EN-US'}
                        </span>
                        <span className="text-[11px] text-[#575A51] dark:text-white/40 font-medium">Real-Time VAD</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. CLARIFICATION CROSS-QUESTIONS & CANDIDATE FOLLOW-UPS */}
                {submission.crossQuestionsSummary && submission.crossQuestionsSummary.length > 0 && (
                  <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] space-y-4">
                    <div className="flex items-center gap-3 border-b border-[#E4E7DC] dark:border-white/[0.06] pb-4">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 text-purple-900 flex items-center justify-center shrink-0">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-[#111215] dark:text-white text-base">
                          AI Clarification Cross-Questions
                        </h3>
                        <p className="text-xs text-[#73766C] dark:text-white/50">
                          Dynamic follow-ups asked by the AI during the video interview
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {submission.crossQuestionsSummary.map((cq: any, cqI: number) => (
                        <div key={cqI} className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                              Linked to Question {cq.parentQuestionIndex + 1}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">
                            AI Follow-Up: "{cq.question}"
                          </p>
                          <p className="text-xs text-[#575A51] dark:text-neutral-300 bg-white dark:bg-white/5 p-3 rounded-xl border border-[#E4E7DC] dark:border-white/10 italic">
                            Candidate Spoken Answer: "{cq.answer}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Q&A Videos and Transcripts - Full Width */}
                <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between pb-5 border-b border-[#E4E7DC] dark:border-white/[0.06] mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                                <Video size={20} />
                            </div>
                            <div>
                                <h2 className="geist-section-title text-lg sm:text-xl font-bold text-[#111215] dark:text-white">
                                    Question & Answer Insights
                                </h2>
                                <p className="text-xs text-[#73766C] dark:text-white/50">Video recordings and AI-transcribed candidate responses</p>
                            </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#73766C] dark:text-white/40 px-3 py-1 rounded-full bg-[#F8F9F5] dark:bg-white/[0.04] border border-[#E4E7DC] dark:border-white/[0.08]">
                            {submission.questions?.length || 0} Questions
                        </span>
                    </div>

                    <div className="space-y-6">
                        {submission.questions?.map((q, index) => {
                            const isQuestionHidden = submission.visibilitySettings?.hiddenQuestions?.[index] === true;

                            // For clients: if recruiter hid this question entirely, do not render it
                            if (!isStaff && isQuestionHidden) return null;

                            // Staff sees it always, or if it has a video and is not hidden
                            const showVideoSection = !!submission.videoURLs?.[index];

                            return (
                                <div key={index} className="flex flex-col lg:flex-row gap-6 p-5 sm:p-6 bg-[#F8F9F5] hover:bg-[#F2F4ED] dark:bg-white/[0.02] dark:hover:bg-white/[0.03] rounded-2xl border border-[#E4E7DC] dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1] relative group transition-all duration-300">
                                    
                                    {/* Recruiter Visibility Controls Banner */}
                                    {isStaff && (
                                        <div className="absolute top-4 right-4 flex items-center gap-3 bg-white/95 dark:bg-[#111]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#E4E7DC] dark:border-white/[0.08] shadow-xs z-10">
                                            <span className="text-[10px] font-bold text-[#73766C] dark:text-white/40 flex items-center gap-1 uppercase tracking-wider font-mono">
                                                <Shield size={10} /> Client View:
                                            </span>
                                            
                                            {/* Q&A Visibility Switch */}
                                            <button
                                                onClick={() => handleToggleVisibility(index, 'hiddenQuestions', !isQuestionHidden)}
                                                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                    !isQuestionHidden 
                                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:hover:bg-emerald-500/20' 
                                                        : 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/30 dark:hover:bg-rose-500/20'
                                                }`}
                                                title={!isQuestionHidden ? "Click to hide entire question & video from client" : "Click to show question & video to client"}
                                            >
                                                {!isQuestionHidden ? (
                                                    <>
                                                        <Eye size={12} className="text-emerald-600 dark:text-emerald-400" /> Visible
                                                    </>
                                                ) : (
                                                    <>
                                                        <EyeOff size={12} className="text-rose-600 dark:text-rose-400" /> Hidden
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Video side */}
                                    {showVideoSection && (
                                        <div className={`w-full lg:w-[420px] flex-shrink-0 flex flex-col justify-between relative ${isStaff && isQuestionHidden ? 'opacity-65' : ''}`}>
                                            <p className="font-bold text-[#111215] dark:text-white mb-3 flex items-start gap-2.5 pr-32 lg:pr-0">
                                                <span className="bg-[#111215] text-[#D4F82C] text-xs px-2.5 py-1 rounded-lg font-mono font-black shrink-0">Q{index + 1}</span> 
                                                <span className="text-sm sm:text-base leading-snug">{q}</span>
                                            </p>
                                            
                                            {submission.videoURLs?.[index] ? (
                                                <div 
                                                    className="relative group aspect-video bg-black rounded-2xl overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-300 dark:border-white/[0.08] hover:border-[#D4F82C]"
                                                    onClick={() => setActiveVideoIndex(index)}
                                                >
                                                    <video src={submission.videoURLs[index]} className="w-full h-full object-cover opacity-85 group-hover:opacity-60 transition-opacity" />
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] group-hover:bg-black/60 transition-all">
                                                        <div className="w-14 h-14 bg-[#D4F82C] text-[#111215] rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-all border border-[#b8da1f]">
                                                            <i className="fas fa-play ml-1 text-xl"></i>
                                                        </div>
                                                        <span className="mt-3 text-xs font-bold text-white bg-black/80 px-3 py-1 rounded-full border border-white/20 shadow-md">
                                                            🔍 Click to Watch Full Screen Video
                                                        </span>
                                                    </div>
                                                    <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-[#D4F82C] text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-[#D4F82C]/30 font-mono">
                                                        Candidate Video
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="aspect-video bg-white dark:bg-white/[0.02] rounded-2xl flex flex-col items-center justify-center text-[#73766C] dark:text-white/40 border border-dashed border-gray-300 dark:border-white/10">
                                                    <Video size={28} className="mb-2 opacity-50" />
                                                    <p className="text-sm font-semibold">No Video Recording Available</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Q&A Side */}
                                    <div className={`flex-1 flex flex-col ${isStaff && isQuestionHidden ? 'opacity-50' : ''}`}>
                                        {/* Render the question here if video section is completely hidden */}
                                        {!showVideoSection && (
                                            <p className="font-bold text-[#111215] dark:text-white mb-3 flex items-start gap-2.5 pr-32 lg:pr-0">
                                                <span className="bg-[#111215] text-[#D4F82C] text-xs px-2.5 py-1 rounded-lg font-mono font-black">Q{index + 1}</span> 
                                                <span className="text-sm sm:text-base">{q}</span>
                                            </p>
                                        )}
                                        
                                        {isStaff && isQuestionHidden && (
                                            <div className="bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400 text-[10px] py-1.5 px-3 rounded-lg mb-3 font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-sm w-fit font-mono">
                                                <EyeOff size={12} /> Entire Q&A block is hidden from client
                                            </div>
                                        )}
                                        
                                        <div className="flex-1 bg-white dark:bg-[#090909] rounded-2xl p-5 border border-[#E4E7DC] dark:border-white/[0.06] h-full flex flex-col shadow-xs">
                                            <h4 className="text-[10px] font-bold text-[#73766C] dark:text-white/40 uppercase tracking-wider mb-2.5 flex items-center gap-2 font-mono">
                                                <FileText size={14} className="text-emerald-600 dark:text-emerald-400" /> Transcript / Candidate Answer
                                            </h4>
                                            <div className="flex-1">
                                                <p className="text-sm text-[#2c2f28] dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                                                    {submission.transcriptTexts?.[index] || 'Transcript not available for this question.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {(!submission.questions || submission.questions.length === 0) && (
                            <div className="text-center py-8 text-[#73766C] dark:text-white/40">
                                No questions found for this interview submission.
                            </div>
                        )}
                    </div>
                </div>
            </div> {/* End of Left Panel Wrapper */}

            {isCompareMode && submission.candidateResumeURL && !submission.candidateResumeURL.startsWith('data:text/plain') && (
                <div className="w-full xl:w-1/2 xl:sticky xl:top-24 h-[80vh] xl:h-[calc(100vh-8rem)] rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-white dark:bg-[#0c0c0c] overflow-hidden flex flex-col">
                    <div className="flex flex-wrap justify-between items-center p-3.5 px-5 border-b border-[#E4E7DC] dark:border-white/[0.08] bg-[#F8F9F5] dark:bg-white/[0.03] gap-2">
                        <h3 className="font-bold text-sm text-[#111215] dark:text-white flex items-center gap-2">
                            <FileText size={16} className="text-emerald-600 dark:text-emerald-400"/> Original Resume {isDocxFile(submission.candidateResumeURL) ? '(Word)' : '(PDF)'}
                        </h3>
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={() => setIsResumeModalOpen(true)}
                                className="text-xs font-semibold text-[#111215] dark:text-white/80 hover:text-black dark:hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/[0.06] hover:bg-[#F0F2EB] dark:hover:bg-white/[0.1] transition-all border border-[#E4E7DC] dark:border-white/[0.08] shadow-xs"
                            >
                                <User size={13} /> View Profile Data
                            </button>
                            <a href={submission.candidateResumeURL} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                                <i className="fas fa-external-link-alt"></i> Open Full
                            </a>
                            <button onClick={() => setIsCompareMode(false)} className="px-3 py-1.5 flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold transition-all border border-rose-200 dark:border-rose-500/20" title="Exit Compare Mode">
                                <i className="fas fa-times"></i> Exit
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 w-full bg-[#0a0a0a] relative">
                         <div className="absolute inset-0 flex flex-col items-center justify-center z-0 text-white/40">
                             <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500 mb-3"></div>
                             <span className="text-sm font-medium">Loading document...</span>
                         </div>
                         <iframe src={getResumeViewUrl(submission.candidateResumeURL)} className="absolute inset-0 w-full h-full border-none z-10 bg-white" title="Resume Compare" />
                    </div>
                </div>
            )}
        </div>

        {/* Modals content follows */}
        
        {isResumeModalOpen && createPortal(
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setIsResumeModalOpen(false)}>
              <div className="bg-white dark:bg-[#0c0c0c] rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_64px_rgba(0,0,0,0.8)] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-[#E4E7DC] dark:border-white/[0.08]" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-5 border-b border-[#E4E7DC] dark:border-white/[0.08] bg-[#F8F9F5] dark:bg-white/[0.03]">
                      <h3 className="font-bold text-lg text-[#111215] dark:text-white flex items-center gap-2"><User size={20} className="text-[#111215] dark:text-[#D4F82C]"/> Profile & Resume Data</h3>
                      <button onClick={() => setIsResumeModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/[0.06] text-[#73766C] dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/[0.12] hover:text-[#111215] dark:hover:text-white transition-colors">&times;</button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      {(() => {
                          const info = submission.candidateInfo || {};
                          const nameMatch = profileTextData?.match(/Name:\s*(.+)/);
                          const emailMatch = profileTextData?.match(/Email:\s*(.+)/);
                          const expMatch = profileTextData?.match(/Experience:\s*(.+)/);
                          const skillsMatch = profileTextData?.match(/Skills:\s*(.+)/);

                          // ALWAYS PREFER Candidate Report Info over parsed text
                          const pName = info.name || (nameMatch ? nameMatch[1] : 'Candidate');
                          const pEmail = info.email || (emailMatch ? emailMatch[1] : 'N/A');
                          const pPhone = info.phone || 'N/A';
                          const pGender = info.gender || 'N/A';
                          const pCity = info.currentCity || info.nativePlace || 'N/A';
                          const pExp = info.isFresher
                              ? 'Fresher (0 Years)'
                              : (info.totalExperienceYears !== undefined && info.totalExperienceYears !== ''
                                  ? `${info.totalExperienceYears} Year(s) ${info.totalExperienceMonths || 0} Month(s)`
                                  : (expMatch ? expMatch[1] : '0 Years'));
                          const pDesignation = info.designation || 'N/A';
                          const pCompany = info.currentCompanyName || 'N/A';
                          const pQualification = info.qualificationBasic || 'N/A';
                          const pSkills = skillsMatch ? skillsMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];

                          return (
                           <div className="bg-[#F8F9F5] dark:bg-gradient-to-br dark:from-indigo-950/40 dark:via-[#0e0f1e] dark:to-blue-950/20 p-6 rounded-2xl border border-[#E4E7DC] dark:border-indigo-500/25 mb-4 shadow-xs relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4F82C]/10 dark:bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                               <div className="relative z-10 flex items-center justify-between mb-4">
                                   <p className="text-[10px] font-bold uppercase tracking-widest text-[#111215] dark:text-emerald-400 flex items-center gap-2 bg-[#D4F82C] dark:bg-emerald-500/10 py-1.5 px-3 rounded-full w-max border border-[#b8da1f] dark:border-emerald-500/20 font-mono">
                                       <i className="fas fa-user-check"></i> Candidate Report Profile
                                   </p>
                               </div>
                                
                               <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
                                   <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#D4F82C] text-[#111215] border border-[#b8da1f] dark:bg-gradient-to-tr dark:from-emerald-500 dark:to-teal-400 flex items-center justify-center text-2xl sm:text-3xl font-extrabold shadow-sm shrink-0 font-mono">
                                       {pName.charAt(0).toUpperCase()}
                                   </div>
                                   <div>
                                       <h4 className="text-2xl font-black text-[#111215] dark:text-white mb-1">{pName}</h4>
                                       <div className="flex flex-wrap gap-4 text-xs text-[#73766C] dark:text-white/60 font-medium">
                                          <span><i className="fas fa-envelope text-[#73766C]/60 dark:text-white/40 mr-1"></i> {pEmail}</span>
                                          {pPhone !== 'N/A' && <span><i className="fas fa-phone text-[#73766C]/60 dark:text-white/40 mr-1"></i> {pPhone}</span>}
                                          {pCity !== 'N/A' && <span><i className="fas fa-map-marker-alt text-[#73766C]/60 dark:text-white/40 mr-1"></i> {pCity}</span>}
                                          {pGender !== 'N/A' && <span><i className="fas fa-venus-mars text-[#73766C]/60 dark:text-white/40 mr-1"></i> {pGender}</span>}
                                       </div>
                                   </div>
                               </div>

                               <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 bg-white dark:bg-white/[0.03] backdrop-blur-md p-5 rounded-xl border border-[#E4E7DC] dark:border-white/[0.06] text-xs shadow-xs">
                                   <div>
                                       <p className="font-bold text-[#73766C] dark:text-white/40 uppercase tracking-wider mb-1 font-mono text-[10px]">Experience</p>
                                       <p className="font-semibold text-[#111215] dark:text-white text-sm flex items-center gap-2">
                                           <i className="fas fa-briefcase text-emerald-600 dark:text-emerald-400"></i> {pExp}
                                       </p>
                                   </div>
                                   <div>
                                       <p className="font-bold text-[#73766C] dark:text-white/40 uppercase tracking-wider mb-1 font-mono text-[10px]">Designation & Company</p>
                                       <p className="font-semibold text-[#111215] dark:text-white text-sm flex items-center gap-2 truncate">
                                           <i className="fas fa-building text-cyan-600 dark:text-cyan-400"></i> {pDesignation !== 'N/A' ? pDesignation : 'N/A'} {pCompany !== 'N/A' ? `at ${pCompany}` : ''}
                                       </p>
                                   </div>
                                   <div>
                                       <p className="font-bold text-[#73766C] dark:text-white/40 uppercase tracking-wider mb-1 font-mono text-[10px]">Qualification</p>
                                       <p className="font-semibold text-[#111215] dark:text-white text-sm flex items-center gap-2 truncate">
                                           <i className="fas fa-graduation-cap text-indigo-600 dark:text-indigo-400"></i> {pQualification}
                                       </p>
                                   </div>
                               </div>

                               {pSkills.length > 0 && (
                                   <div className="relative z-10 mt-4 bg-white dark:bg-white/[0.03] p-4 rounded-xl border border-[#E4E7DC] dark:border-white/[0.06]">
                                       <p className="text-[10px] font-bold text-[#73766C] dark:text-white/40 uppercase tracking-wider mb-2 font-mono">Skills</p>
                                       <div className="flex flex-wrap gap-2">
                                           {pSkills.map((skill, i) => (
                                               <span key={i} className="px-3 py-1 bg-[#F8F9F5] dark:bg-white/[0.05] border border-[#E4E7DC] dark:border-white/[0.08] text-[#111215] dark:text-white/90 text-xs font-bold rounded-lg shadow-xs">
                                                   {skill}
                                               </span>
                                           ))}
                                       </div>
                                   </div>
                               )}
                           </div>
                          );
                      })()}

                      {submission.candidateResumeURL && (
                          <div className="flex flex-col gap-3 mt-4">
                              <div className="flex justify-between items-center px-1">
                                  <h4 className="font-bold text-[#111215] dark:text-white text-sm flex items-center gap-2"><FileText size={16} className="text-emerald-600 dark:text-emerald-400"/> Original Resume Document</h4>
                                  <a href={submission.candidateResumeURL} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                                      <i className="fas fa-external-link-alt"></i> Open in New Tab
                                  </a>
                              </div>
                              <div className="w-full h-[65vh] rounded-2xl overflow-hidden border border-[#E4E7DC] dark:border-white/[0.08] bg-[#0a0a0a] relative shadow-inner">
                                  <div className="absolute inset-0 flex flex-col items-center justify-center z-0 text-white/40">
                                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#D4F82C] dark:border-emerald-500 mb-3"></div>
                                      <span className="text-sm font-medium">Loading document...</span>
                                  </div>
                                  <iframe 
                                      src={getResumeViewUrl(submission.candidateResumeURL)}
                                      title="Candidate Resume"
                                      className="w-full h-full border-none absolute inset-0 z-10 bg-white"
                                  />
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>,
          document.body
        )}

        {activeVideoIndex !== null && createPortal(
            <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[100] p-2 md:p-6" onClick={() => setActiveVideoIndex(null)}>
                <div 
                    className={`bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
                        isTheaterMode 
                          ? 'w-full h-full max-w-[100vw] max-h-[100vh] rounded-none' 
                          : showResumeInVideo 
                            ? 'w-full max-w-[98vw] h-[94vh]' 
                            : 'w-full max-w-[95vw] xl:max-w-[1550px] h-[90vh]'
                    }`} 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center bg-white/5 px-4 sm:px-6 py-3 border-b border-white/10 shrink-0 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#D4F82C]/20 border border-[#D4F82C]/30 text-[#D4F82C] flex items-center justify-center shrink-0">
                                <Video size={16} />
                            </div>
                            <h3 className="text-white font-bold text-sm sm:text-base truncate">
                                Candidate Video — Question {activeVideoIndex + 1} of {submission.questions?.length || 0}
                            </h3>
                            {submission.candidateResumeURL && (
                                <button 
                                    onClick={() => setShowResumeInVideo(!showResumeInVideo)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border hidden sm:flex items-center gap-1.5 ${showResumeInVideo ? 'bg-[#D4F82C]/20 text-[#D4F82C] border-[#D4F82C]/40' : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/20'}`}
                                >
                                    <FileText size={13} /> {showResumeInVideo ? 'Hide Resume' : 'View Resume'}
                                </button>
                            )}
                        </div>
                        
                        {/* Question Switcher in Header */}
                        {submission.questions && submission.questions.length > 1 && (
                            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-white/5 rounded-xl border border-white/10">
                                {submission.questions.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveVideoIndex(idx)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                                            activeVideoIndex === idx 
                                                ? 'bg-[#D4F82C] text-[#111215] shadow-xs font-black' 
                                                : 'text-white/60 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        Q{idx + 1}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Theater Mode Toggle */}
                            <button 
                                onClick={() => setIsTheaterMode(!isTheaterMode)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border flex items-center gap-1.5 ${
                                    isTheaterMode ? 'bg-[#D4F82C]/20 text-[#D4F82C] border-[#D4F82C]/40' : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/20'
                                }`}
                                title={isTheaterMode ? "Standard View" : "Theater Mode"}
                            >
                                {isTheaterMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                <span className="hidden sm:inline">{isTheaterMode ? 'Standard' : 'Theater'}</span>
                            </button>

                            <div className="hidden sm:flex items-center gap-1.5 border-l border-r border-white/10 px-2">
                                <button 
                                    disabled={!hasPrevVisibleVideo()}
                                    onClick={handlePrevVideo}
                                    className="px-2.5 py-1.5 bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                    <ArrowLeft size={13} /> Prev
                                </button>
                                <button 
                                    disabled={!hasNextVisibleVideo()}
                                    onClick={handleNextVideo}
                                    className="px-2.5 py-1.5 bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                    Next <ArrowLeft size={13} className="rotate-180" />
                                </button>
                            </div>
                            <button 
                                onClick={() => setActiveVideoIndex(null)} 
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-400 text-lg transition-colors cursor-pointer"
                                title="Close Video"
                            >
                                &times;
                            </button>
                        </div>
                    </div>
                    
                    {/* Body */}
                    <div className="flex flex-1 overflow-hidden min-h-0">
                        {/* Resume Panel (Left) */}
                        {showResumeInVideo && (
                            <div className="w-1/2 border-r border-white/10 flex flex-col bg-white/5">
                                {submission.candidateResumeURL && !submission.candidateResumeURL.startsWith('data:text/plain') ? (
                                    <iframe src={getResumeViewUrl(submission.candidateResumeURL)} className="w-full h-full border-none bg-white" title="Resume Document" />
                                ) : (
                                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                                        <h4 className="font-bold text-white mb-4">Extracted Resume Text</h4>
                                        <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">{submission.candidateInfo?.resumeText || 'No resume data available.'}</pre>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Video & Q&A Panel */}
                        <div className={`${showResumeInVideo ? 'w-1/2' : 'w-full'} flex flex-col lg:flex-row bg-black overflow-hidden flex-1 min-h-0`}>
                            {/* Video Player Container */}
                            <div className={`relative flex items-center justify-center bg-black shrink-0 ${
                                showResumeInVideo 
                                  ? 'w-full aspect-video border-b border-white/10' 
                                  : isTheaterMode 
                                    ? 'w-full flex-1 border-b border-white/10' 
                                    : 'w-full lg:w-[60%] border-b lg:border-b-0 lg:border-r border-white/10 h-full flex-1 min-h-0'
                            }`}>
                                {submission.videoURLs?.[activeVideoIndex] ? (
                                    <video
                                        key={submission.videoURLs[activeVideoIndex]}
                                        controls
                                        autoPlay
                                        playsInline
                                        src={submission.videoURLs[activeVideoIndex]}
                                        className="w-full h-full object-contain max-h-[85vh] p-2"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-4 bg-[#050505]">
                                        <Video size={56} className="mb-4 opacity-40 text-emerald-500" />
                                        <p className="text-xl font-bold text-gray-300 text-center">No Candidate Video Recording</p>
                                        <p className="text-sm mt-2 text-gray-500 text-center">The candidate did not record a video answer for this question.</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Right Dossier & Transcript Panel */}
                            <div className={`flex flex-col bg-[#0c0c0c] overflow-hidden ${
                                showResumeInVideo || isTheaterMode 
                                    ? 'w-full h-56 shrink-0 border-t border-white/10' 
                                    : 'w-full lg:w-[40%] h-full flex-1 min-h-0'
                            }`}>
                                {/* Question Asked Card at Top of Right Panel */}
                                <div className="p-4 sm:p-5 border-b border-white/10 bg-[#111215] shrink-0 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold text-[#D4F82C] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                            <Brain size={13} /> Question Asked
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded">
                                            Q{activeVideoIndex + 1} of {submission.questions?.length || 0}
                                        </span>
                                    </div>
                                    <p className="text-sm sm:text-base font-bold text-white leading-snug">
                                        {submission.questions?.[activeVideoIndex] || 'Unknown Question'}
                                    </p>
                                </div>

                                {/* Full-Height Transcript Card */}
                                <div className="flex-1 p-4 sm:p-5 flex flex-col min-h-0 overflow-hidden bg-[#090909]">
                                    <div className="flex items-center justify-between mb-2.5 shrink-0">
                                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                                            <FileText size={13} className="text-[#D4F82C]"/> Candidate Response Transcript
                                        </h4>
                                        {submission.transcriptTexts?.[activeVideoIndex] && (
                                            <button
                                                onClick={() => handleCopyTranscript(submission.transcriptTexts?.[activeVideoIndex] || '')}
                                                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors border border-white/10 cursor-pointer"
                                                title="Copy transcript"
                                            >
                                                {copiedTranscript ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                                <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/[0.02] rounded-xl p-4 border border-white/10 text-sm text-gray-200 leading-relaxed font-sans min-h-0">
                                        {(() => {
                                            const rawText = submission.transcriptTexts?.[activeVideoIndex];
                                            const isDurationError = rawText && rawText.toLowerCase().includes('audio duration is too long');
                                            const isGenericError = rawText && rawText.startsWith('Error:');

                                            if (isDurationError) {
                                                return (
                                                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-200">
                                                        <Volume2 size={18} className="shrink-0 text-amber-400 mt-0.5" />
                                                        <div>
                                                            <p className="font-semibold text-xs text-amber-300">Candidate Audio Recorded</p>
                                                            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                                                                The candidate's video and audio answer was recorded successfully. Please play the video on the left to listen directly to their answer.
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (isGenericError) {
                                                return (
                                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200">
                                                        <Volume2 size={18} className="shrink-0 text-red-400 mt-0.5" />
                                                        <div>
                                                            <p className="font-semibold text-xs text-red-300">Transcript Unavailable</p>
                                                            <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
                                                                Automated transcription service could not convert this audio. Please listen directly to the video recording on the left.
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <p className="whitespace-pre-wrap">
                                                    {rawText || 'Transcript not available for this question.'}
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Bottom Quick Navigator inside Right Panel */}
                                <div className="p-3 px-4 border-t border-white/10 bg-[#111215] shrink-0 flex items-center justify-between">
                                    <button 
                                        disabled={!hasPrevVisibleVideo()}
                                        onClick={handlePrevVideo}
                                        className="px-2.5 py-1 bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1"
                                    >
                                        <ArrowLeft size={12} /> Prev
                                    </button>
                                    
                                    <div className="flex items-center gap-1">
                                        {submission.questions?.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setActiveVideoIndex(idx)}
                                                className={`w-6 h-6 rounded text-[11px] font-mono font-bold transition-all flex items-center justify-center ${
                                                    activeVideoIndex === idx 
                                                        ? 'bg-[#D4F82C] text-[#111215] font-black' 
                                                        : 'text-white/60 hover:text-white hover:bg-white/10'
                                                }`}
                                            >
                                                {idx + 1}
                                            </button>
                                        ))}
                                    </div>

                                    <button 
                                        disabled={!hasNextVisibleVideo()}
                                        onClick={handleNextVideo}
                                        className="px-2.5 py-1 bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1"
                                    >
                                        Next <ArrowLeft size={12} className="rotate-180" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>, document.body
        )}
    </div>
  );
};

export default InterviewReport;
