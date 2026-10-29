import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import HireXLogo, { HireXMark } from '../components/HireXLogo';
import { useMessageBox } from '../components/MessageBox';
import { 
  Briefcase, MapPin, Calendar, Clock, Sparkles, 
  Search, Filter, ChevronRight, ArrowRight, ArrowUpRight, ShieldCheck, 
  GraduationCap, CheckCircle2, User, Eye, X, Send, Copy, Check, MessageSquare, Phone, Mail, Upload,
  Layers, Tag, LayoutDashboard, CheckCheck
} from 'lucide-react';
import { getJobDescriptionSnippet, FormattedJobDescription } from '../utils/jobDescriptionFormatter';
import { splitEducationRequirements } from '../utils/educationMatcher';

export interface ActiveJobItem {
  id: string;
  jobNo?: string;
  title: string;
  company?: string;
  companyName?: string;
  entryBy?: string;
  recruiterName?: string;
  contactPerson?: string;
  description?: string;
  industrySector?: string;
  sector?: string;
  department?: string;
  departments?: string[];
  roleCategory?: string;
  category?: string;
  location?: string;
  city?: string;
  state?: string;
  employmentType?: string;
  jobType?: string;
  salary?: string;
  salaryRange?: string;
  minSalary?: string | number;
  maxSalary?: string | number;
  minExperience?: string | number;
  maxExperience?: string | number;
  experience?: string | number;
  qualification?: string;
  education?: string;
  genderRequirement?: string;
  gender?: string;
  skills?: string[] | string;
  deadline?: any;
  deadlineDate?: any;
  applyDeadline?: any;
  interviewDates?: string;
  accessCode?: string;
  createdBy?: any;
  createdAt?: any;
  isMock?: boolean;
}

const parseDeadlineMillis = (deadline: any): number => {
  if (!deadline) return 0;
  if (deadline instanceof Date) return deadline.getTime();
  if (typeof deadline === 'number') return deadline;
  if (typeof deadline?.toMillis === 'function') return deadline.toMillis();
  if (typeof deadline?.toDate === 'function') return deadline.toDate().getTime();
  if (typeof deadline?.seconds === 'number') return deadline.seconds * 1000;
  if (typeof deadline === 'string') {
    const trimmed = deadline.trim();
    if (!trimmed || ['open', 'open application', 'anytime', 'no deadline', 'within 48 hours', 'unspecified'].includes(trimmed.toLowerCase())) {
      return 0;
    }
    const isoDateMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoDateMatch) {
      const [, y, m, d] = isoDateMatch;
      return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
    }
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const formatDeadlineDate = (deadline: any): string => {
  const millis = parseDeadlineMillis(deadline);
  if (!millis) return 'Open Application';
  const date = new Date(millis);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ActiveJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const messageBox = useMessageBox();

  const [jobs, setJobs] = useState<ActiveJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [selectedExperience, setSelectedExperience] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedGender, setSelectedGender] = useState<string>('All');
  const [selectedJobModal, setSelectedJobModal] = useState<ActiveJobItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [showContactModal, setShowContactModal] = useState(false);
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenContactModal = () => {
    setContactForm({
      name: '',
      email: '',
      phone: '',
      subject: 'General Job & Recruitment Inquiry',
      message: ''
    });
    setShowContactModal(true);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      messageBox.showError('Please fill in your Name, Email, and Message.');
      return;
    }

    setSubmittingContact(true);
    try {
      await addDoc(collection(db, 'contactSubmissions'), {
        ...contactForm,
        createdAt: serverTimestamp(),
        status: 'new'
      });
      messageBox.showSuccess('Your message has been sent successfully! Our team will get back to you soon.');
      setShowContactModal(false);
      setContactForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      console.error('Failed to submit contact message:', err);
      messageBox.showError('Failed to send message. Please try again.');
    } finally {
      setSubmittingContact(false);
    }
  };

  useEffect(() => {
    let interviewsList: ActiveJobItem[] = [];
    let jobsList: ActiveJobItem[] = [];

    const mergeAndSetJobs = () => {
      const allRaw = [...interviewsList, ...jobsList];
      const seenCodes = new Set<string>();
      const seenIds = new Set<string>();
      const seenSigs = new Set<string>();
      const deduplicated: ActiveJobItem[] = [];

      for (const job of allRaw) {
        if (!job) continue;
        if (job.isMock) continue;

        const statusLower = String((job as any).status || '').trim().toLowerCase();
        if (['inactive', 'expired', 'closed', 'disabled', 'deactivated', 'draft'].includes(statusLower)) {
          continue;
        }

        const idClean = (job.id || '').trim();
        const codeClean = (job.accessCode || job.jobNo || '').trim().toUpperCase();
        const titleClean = (job.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const locationClean = (job.location || job.city || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const recruiterClean = (job.entryBy || job.recruiterName || job.contactPerson || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const deptClean = (job.department || '').trim().toLowerCase().replace(/\s+/g, ' ');
        
        // Composite signature: title + location + (dept or recruiter)
        const compositeSig = (titleClean && locationClean) ? `${titleClean}__${locationClean}__${deptClean || recruiterClean}` : '';

        // Check if this job has already been registered
        const isDuplicate =
          (codeClean && seenCodes.has(codeClean)) ||
          (idClean && seenIds.has(idClean)) ||
          (compositeSig && seenSigs.has(compositeSig));

        if (isDuplicate) {
          // If already in list, merge any richer non-empty details into the existing entry
          const existingIdx = deduplicated.findIndex(j => 
            (codeClean && (j.accessCode || j.jobNo || '').trim().toUpperCase() === codeClean) ||
            (idClean && j.id === idClean) ||
            (compositeSig && (j.title || '').trim().toLowerCase().replace(/\s+/g, ' ') === titleClean && (j.location || j.city || '').trim().toLowerCase().replace(/\s+/g, ' ') === locationClean)
          );
          if (existingIdx >= 0) {
            const existing = deduplicated[existingIdx];
            deduplicated[existingIdx] = {
              ...job,
              ...existing,
              description: existing.description || job.description,
              skills: (existing.skills && existing.skills.length > 0) ? existing.skills : job.skills,
              qualification: existing.qualification || job.qualification,
              education: existing.education || job.education,
              experience: existing.experience || job.experience,
              accessCode: existing.accessCode || job.accessCode || codeClean,
            };
          }
          continue;
        }

        if (codeClean) seenCodes.add(codeClean);
        if (idClean) seenIds.add(idClean);
        if (compositeSig) seenSigs.add(compositeSig);

        deduplicated.push(job);
      }

      setJobs(deduplicated);
      setLoading(false);
    };

    const qInterviews = query(collection(db, 'interviews'));
    const unsubInterviews = onSnapshot(qInterviews, (snapshot) => {
      interviewsList = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const jobNo = data.jobNo ? String(data.jobNo).trim() : '';
        const accessCode = jobNo || data.accessCode || docSnap.id.slice(0, 6).toUpperCase();
        const resolvedEntryBy = (
          data.entryBy ||
          data.entry_by ||
          data.uploadedBy ||
          data.uploaded_by ||
          data.contactPerson ||
          data.contactPersonName ||
          (typeof data.createdBy === 'string' ? data.createdBy : data.createdBy?.name) ||
          data.recruiterName ||
          'Recruiter'
        ).toString().trim();

        return {
          id: docSnap.id,
          jobNo,
          title: data.title || 'Untitled Role',
          entryBy: resolvedEntryBy,
          recruiterName: resolvedEntryBy,
          contactPerson: resolvedEntryBy,
          description: data.description || data.jobDescription || '',
          industrySector: data.industrySector || data.sector || data.industryName || data.industry || 'General Industry',
          sector: data.sector || data.industrySector || data.industryName || 'General Industry',
          department: data.department || data.roleCategory || data.category || 'General',
          departments: data.departments || [data.department || data.roleCategory || data.category || 'General'],
          roleCategory: data.roleCategory || data.category || data.department || 'General',
          location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : data.city || data.state || 'Nashik, Maharashtra'),
          city: data.city || data.location || 'Nashik',
          genderRequirement: data.genderRequirement || data.gender || data.genderPreference || 'Any',
          gender: data.gender || data.genderRequirement || 'Any',
          employmentType: data.employmentType || data.jobType || 'Full-Time',
          salary: data.salary || data.salaryRange || '',
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          minExperience: data.minExperience,
          maxExperience: data.maxExperience,
          experience: data.experience || (data.minExperience ? `${data.minExperience || 0} - ${data.maxExperience || 2} Years` : 'Freshers & Experienced'),
          qualification: data.qualification || data.education || data.qualifications || 'Diploma / Graduate',
          education: data.education || data.qualification || data.qualifications || 'Diploma / Graduate',
          skills: data.skills || [],
          deadline: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDates || data.interviewDeadline || data.endDate || '',
          deadlineDate: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDates || data.interviewDeadline || data.endDate || '',
          accessCode,
          status: data.status || 'Active',
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          isMock: Boolean(data.isMock),
        };
      });
      mergeAndSetJobs();
    }, (error) => {
      console.error('Error fetching active jobs:', error);
      setLoading(false);
    });

    const qJobs = query(collection(db, 'jobs'));
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      jobsList = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const jobNo = data.jobNo ? String(data.jobNo).trim() : '';
        const accessCode = jobNo || data.accessCode || docSnap.id.slice(0, 6).toUpperCase();
        const resolvedEntryBy = (
          data.entryBy ||
          data.entry_by ||
          data.uploadedBy ||
          data.uploaded_by ||
          data.contactPerson ||
          data.contactPersonName ||
          (typeof data.createdBy === 'string' ? data.createdBy : data.createdBy?.name) ||
          data.recruiterName ||
          'Recruiter'
        ).toString().trim();

        return {
          id: docSnap.id,
          jobNo,
          title: data.title || 'Untitled Role',
          entryBy: resolvedEntryBy,
          recruiterName: resolvedEntryBy,
          contactPerson: resolvedEntryBy,
          description: data.description || data.jobDescription || '',
          industrySector: data.industrySector || data.sector || data.industryName || data.industry || 'General Industry',
          sector: data.sector || data.industrySector || data.industryName || 'General Industry',
          department: data.department || data.roleCategory || data.category || 'General',
          departments: data.departments || [data.department || data.roleCategory || data.category || 'General'],
          roleCategory: data.roleCategory || data.category || data.department || 'General',
          location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : data.city || data.state || 'Nashik, Maharashtra'),
          city: data.city || data.location || 'Nashik',
          genderRequirement: data.genderRequirement || data.gender || data.genderPreference || 'Any',
          gender: data.gender || data.genderRequirement || 'Any',
          employmentType: data.employmentType || data.jobType || 'Full-Time',
          salary: data.salary || data.salaryRange || '',
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          minExperience: data.minExperience,
          maxExperience: data.maxExperience,
          experience: data.experience || (data.minExperience ? `${data.minExperience || 0} - ${data.maxExperience || 2} Years` : 'Freshers & Experienced'),
          qualification: data.qualification || data.education || data.qualifications || 'Diploma / Graduate',
          education: data.education || data.qualification || data.qualifications || 'Diploma / Graduate',
          skills: data.skills || [],
          deadline: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDates || data.interviewDeadline || data.endDate || '',
          deadlineDate: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDates || data.interviewDeadline || data.endDate || '',
          accessCode,
          status: data.status || 'Active',
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          isMock: Boolean(data.isMock),
        };
      });
      mergeAndSetJobs();
    }, (error) => {
      console.warn('Jobs collection fetch note in ActiveJobs:', error);
    });

    return () => {
      unsubInterviews();
      unsubJobs();
    };
  }, []);

  const sectorsList = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.industrySector && j.industrySector.trim()) set.add(j.industrySector.trim());
      else if (j.sector && j.sector.trim()) set.add(j.sector.trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [jobs]);

  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.department && j.department.trim()) set.add(j.department.trim());
      if (j.roleCategory && j.roleCategory.trim()) set.add(j.roleCategory.trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [jobs]);

  const locationsList = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.city && j.city.trim()) {
        set.add(j.city.trim());
      } else if (j.location && j.location.trim()) {
        const parts = j.location.split(',');
        const primary = parts[0]?.trim();
        if (primary) set.add(primary);
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [jobs]);

  const experienceOptions = [
    'All',
    'Fresher / 0 - 1 Yr',
    '1 - 3 Yrs',
    '3 - 5 Yrs',
    '5+ Yrs'
  ];

  const genderOptions = [
    'All',
    'Female Only',
    'Male Only',
    'Open / Any'
  ];

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, '');
      const rawJobNo = String(job.jobNo || '').toLowerCase().trim();
      const rawCode = String(job.accessCode || '').toLowerCase().trim();
      const rawId = String(job.id || '').toLowerCase().trim();

      const matchesJobNo = (rawJobNo && (rawJobNo.includes(q) || (qDigits && rawJobNo.includes(qDigits)))) ||
        (rawCode && (rawCode.includes(q) || (qDigits && rawCode.includes(qDigits)))) ||
        rawId.includes(q);

      const matchesSearch = !q || 
        matchesJobNo ||
        job.title.toLowerCase().includes(q) ||
        (job.location && job.location.toLowerCase().includes(q)) ||
        (job.city && job.city.toLowerCase().includes(q)) ||
        (job.description && job.description.toLowerCase().includes(q)) ||
        (job.department && job.department.toLowerCase().includes(q)) ||
        (job.industrySector && job.industrySector.toLowerCase().includes(q)) ||
        (typeof job.skills === 'string' && job.skills.toLowerCase().includes(q)) ||
        (Array.isArray(job.skills) && job.skills.some((s) => s.toLowerCase().includes(q)));

      const jobSec = (job.industrySector || job.sector || '').toLowerCase();
      const matchesSector = selectedSector === 'All' || jobSec.includes(selectedSector.toLowerCase());

      const jobDept = (job.department || job.roleCategory || '').toLowerCase();
      const matchesDept = selectedDepartment === 'All' || jobDept.includes(selectedDepartment.toLowerCase());

      const jobLoc = `${job.location || ''} ${job.city || ''}`.toLowerCase();
      const matchesLocation = selectedLocation === 'All' || jobLoc.includes(selectedLocation.toLowerCase());

      let matchesExperience = true;
      if (selectedExperience !== 'All') {
        const expStr = String(job.experience || '').toLowerCase();
        const minExp = Number(job.minExperience || 0);
        const maxExp = Number(job.maxExperience || 0);

        if (selectedExperience === 'Fresher / 0 - 1 Yr') {
          matchesExperience = expStr.includes('fresh') || expStr.includes('0') || minExp === 0 || maxExp <= 1;
        } else if (selectedExperience === '1 - 3 Yrs') {
          matchesExperience = expStr.includes('1') || expStr.includes('2') || expStr.includes('3') || (minExp >= 1 && minExp <= 3);
        } else if (selectedExperience === '3 - 5 Yrs') {
          matchesExperience = expStr.includes('3') || expStr.includes('4') || expStr.includes('5') || (minExp >= 3 && minExp <= 5);
        } else if (selectedExperience === '5+ Yrs') {
          matchesExperience = minExp >= 5 || maxExp >= 5 || expStr.includes('5+') || expStr.includes('6') || expStr.includes('7') || expStr.includes('8') || expStr.includes('10');
        }
      }

      let matchesGender = true;
      if (selectedGender !== 'All') {
        const gStr = (job.genderRequirement || job.gender || '').toLowerCase();
        if (selectedGender === 'Female Only') {
          matchesGender = gStr.includes('female');
        } else if (selectedGender === 'Male Only') {
          matchesGender = gStr.includes('male') && !gStr.includes('female');
        } else if (selectedGender === 'Open / Any') {
          matchesGender = gStr.includes('any') || gStr.includes('open') || gStr === '' || (!gStr.includes('female') && !gStr.includes('male'));
        }
      }

      return matchesSearch && matchesSector && matchesDept && matchesLocation && matchesExperience && matchesGender;
    });
  }, [jobs, searchQuery, selectedSector, selectedDepartment, selectedLocation, selectedExperience, selectedGender]);

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans selection:bg-[#D4F82C] selection:text-[#111215]">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-[100] bg-[#F8F9F5]/90 backdrop-blur-md border-b border-[#E4E7DC] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Product Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="group inline-flex items-center shrink-0">
              <HireXLogo size="md" variant="full" isDark={false} />
            </Link>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111215]/5 border border-[#E4E7DC] text-[10px] font-medium text-[#73766C] shrink-0">
              <span>by</span>
              <a
                href="https://snab.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#111215] hover:text-[#8FB305] transition-colors"
              >
                SNAB
              </a>
            </div>
          </div>

          {/* Centered Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs xl:text-[13px] font-semibold text-[#575A51] shrink-0">
            <Link to="/#pipeline" className="hover:text-[#111215] transition-colors whitespace-nowrap shrink-0">
              Pipeline
            </Link>
            <Link to="/#resume-matching" className="hover:text-[#111215] transition-colors whitespace-nowrap shrink-0">
              AI Matching
            </Link>
            <Link to="/#client-portal" className="hover:text-[#111215] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <span>Client Portal</span>
              <span className="size-1.5 rounded-full bg-[#8FB305] animate-pulse"></span>
            </Link>
            <Link to="/#pricing" className="hover:text-[#111215] transition-colors whitespace-nowrap shrink-0">
              Pricing
            </Link>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111215] text-white text-xs font-bold shadow-2xs whitespace-nowrap shrink-0">
              <span className="size-1.5 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span>Active Roles ({jobs.length})</span>
            </span>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenContactModal}
              className="hidden sm:inline-flex h-9.5 items-center gap-2 px-4 rounded-full border border-[#E4E7DC] bg-white hover:bg-slate-50 text-[#111215] text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <MessageSquare size={13} className="text-[#8FB305]" />
              <span>Contact</span>
            </button>
            <Link
              to="/upload-resume"
              className="inline-flex h-9.5 items-center gap-2 px-4 sm:px-5 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
            >
              <Upload size={13} className="text-[#D4F82C]" />
              <span className="hidden xs:inline">Upload Resume</span>
              <span className="xs:hidden">Upload CV</span>
              <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section with Editorial Aesthetics ── */}
      <section className="relative pt-12 sm:pt-16 pb-10 sm:pb-14 px-4 sm:px-8 border-b border-[#E4E7DC] overflow-hidden">
        {/* Subtle ambient light gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-72 bg-radial from-[#D4F82C]/10 via-transparent to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E4E7DC] text-[#111215] text-[11px] sm:text-xs font-bold shadow-2xs">
            <span className="size-2 rounded-full bg-[#8FB305] animate-pulse" />
            <span>01 • VERIFIED POSITIONS • {jobs.length} ACTIVE MANDATES</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#111215] leading-[1.1]">
            Explore Active Roles &amp; AI Interviews
          </h1>

          <p className="max-w-2xl mx-auto text-xs sm:text-sm md:text-base text-[#575A51] leading-relaxed">
            Browse verified job postings across industry sectors. Filter by Department, Location, Experience, and Gender Requirements — or upload your CV for instant Claude 3.5 Sonnet matching.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/upload-resume"
              className="inline-flex h-11 items-center gap-2.5 px-6 rounded-full bg-[#111215] hover:bg-black text-white text-xs sm:text-sm font-bold transition-all shadow-md group cursor-pointer"
            >
              <Upload size={14} className="text-[#D4F82C]" />
              <span>Upload Resume for Direct Match</span>
              <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
            </Link>
            <button
              type="button"
              onClick={handleOpenContactModal}
              className="inline-flex h-11 items-center gap-2 px-5 rounded-full bg-white hover:bg-slate-50 border border-[#E4E7DC] text-[#111215] text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer"
            >
              <MessageSquare size={14} className="text-[#8FB305]" />
              <span>Contact Recruiting Desk</span>
            </button>
          </div>

          {/* Search & Filter Bar Container */}
          <div className="max-w-5xl mx-auto mt-8 p-4 sm:p-6 rounded-3xl bg-white border border-[#E4E7DC] shadow-sm space-y-3.5 text-left">
            {/* Search Input */}
            <div className="relative w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8FB305]" />
              <input
                type="text"
                placeholder="Search job title, access code, sector, city, or required skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-10 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-xs sm:text-sm font-semibold text-[#111215] placeholder-[#73766C] outline-none focus:bg-white focus:border-[#111215] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73766C] hover:text-[#111215] p-1 cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* 5 Filter Selects */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 w-full">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#73766C] mb-1">Sector</label>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[11px] sm:text-xs font-semibold text-[#111215] outline-none cursor-pointer hover:border-[#111215] focus:bg-white focus:border-[#111215] transition-colors truncate"
                  title="Filter by Industry Sector"
                >
                  <option value="All">All Sectors ({sectorsList.length - 1})</option>
                  {sectorsList.filter(s => s !== 'All').map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#73766C] mb-1">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[11px] sm:text-xs font-semibold text-[#111215] outline-none cursor-pointer hover:border-[#111215] focus:bg-white focus:border-[#111215] transition-colors truncate"
                  title="Filter by Functional Department"
                >
                  <option value="All">All Depts ({departmentsList.length - 1})</option>
                  {departmentsList.filter(d => d !== 'All').map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#73766C] mb-1">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[11px] sm:text-xs font-semibold text-[#111215] outline-none cursor-pointer hover:border-[#111215] focus:bg-white focus:border-[#111215] transition-colors truncate"
                  title="Filter by City / Location"
                >
                  <option value="All">All Cities ({locationsList.length - 1})</option>
                  {locationsList.filter(loc => loc !== 'All').map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#73766C] mb-1">Experience</label>
                <select
                  value={selectedExperience}
                  onChange={(e) => setSelectedExperience(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[11px] sm:text-xs font-semibold text-[#111215] outline-none cursor-pointer hover:border-[#111215] focus:bg-white focus:border-[#111215] transition-colors truncate"
                  title="Filter by Experience"
                >
                  <option value="All">All Experience</option>
                  {experienceOptions.filter(e => e !== 'All').map(exp => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#73766C] mb-1">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[11px] sm:text-xs font-semibold text-[#111215] outline-none cursor-pointer hover:border-[#111215] focus:bg-white focus:border-[#111215] transition-colors truncate"
                  title="Filter by Gender Requirement"
                >
                  <option value="All">All Genders</option>
                  {genderOptions.filter(g => g !== 'All').map(gen => (
                    <option key={gen} value={gen}>{gen}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Counter and Reset */}
            <div className="flex items-center justify-between pt-2 text-[11px] text-[#73766C] border-t border-[#E4E7DC]">
              <span>
                Showing <strong className="text-[#111215] font-black">{filteredJobs.length}</strong> matching positions
              </span>
              {(selectedSector !== 'All' || selectedDepartment !== 'All' || selectedLocation !== 'All' || selectedExperience !== 'All' || selectedGender !== 'All' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSector('All');
                    setSelectedDepartment('All');
                    setSelectedLocation('All');
                    setSelectedExperience('All');
                    setSelectedGender('All');
                    setSearchQuery('');
                  }}
                  className="text-[#111215] hover:text-[#8FB305] font-bold underline cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Active Filters Bar ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8">
        {(selectedSector !== 'All' || selectedDepartment !== 'All' || selectedLocation !== 'All' || selectedExperience !== 'All' || selectedGender !== 'All' || searchQuery) && (
          <div className="flex items-center gap-2 flex-wrap mb-6 p-3 rounded-2xl border border-[#E4E7DC] bg-white text-xs shadow-2xs">
            <span className="font-extrabold text-[#111215] text-[11px]">Active Filters:</span>
            {selectedSector !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215] font-bold text-[11px]">
                <span>Sector: {selectedSector}</span>
                <button onClick={() => setSelectedSector('All')} className="text-[#73766C] hover:text-[#111215] cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {selectedDepartment !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215] font-bold text-[11px]">
                <span>Dept: {selectedDepartment}</span>
                <button onClick={() => setSelectedDepartment('All')} className="text-[#73766C] hover:text-[#111215] cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {selectedLocation !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215] font-bold text-[11px]">
                <span>City: {selectedLocation}</span>
                <button onClick={() => setSelectedLocation('All')} className="text-[#73766C] hover:text-[#111215] cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {selectedExperience !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215] font-bold text-[11px]">
                <span>Exp: {selectedExperience}</span>
                <button onClick={() => setSelectedExperience('All')} className="text-[#73766C] hover:text-[#111215] cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {selectedGender !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215] font-bold text-[11px]">
                <span>Gender: {selectedGender}</span>
                <button onClick={() => setSelectedGender('All')} className="text-[#73766C] hover:text-[#111215] cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215] font-bold text-[11px]">
                <span>Search: "{searchQuery}"</span>
                <button onClick={() => setSearchQuery('')} className="text-[#73766C] hover:text-[#111215] cursor-pointer"><X size={11} /></button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedSector('All');
                setSelectedDepartment('All');
                setSelectedLocation('All');
                setSelectedExperience('All');
                setSelectedGender('All');
                setSearchQuery('');
              }}
              className="ml-auto text-[11px] font-bold text-[#8FB305] hover:text-[#111215] underline cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}
      </section>

      {/* ── Job Cards Grid ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 rounded-2xl bg-white border border-[#E4E7DC] p-6 space-y-4 animate-pulse">
                <div className="h-5 rounded-md bg-[#F8F9F5] w-2/3" />
                <div className="h-4 rounded-md bg-[#F8F9F5] w-1/3" />
                <div className="h-16 rounded-xl bg-[#F8F9F5] w-full" />
                <div className="h-8 rounded-full bg-[#F8F9F5] w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-[#E4E7DC] bg-white p-8 space-y-4 max-w-lg mx-auto shadow-sm">
            <div className="size-14 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-[#8FB305] flex items-center justify-center mx-auto">
              <Briefcase size={26} />
            </div>
            <h3 className="text-lg font-bold text-[#111215]">No active job openings found</h3>
            <p className="text-xs text-[#73766C] max-w-sm mx-auto leading-relaxed">
              There are currently no open positions matching your search or active filters. Try adjusting your search query or reset the filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedSector('All');
                setSelectedDepartment('All');
                setSelectedLocation('All');
                setSelectedExperience('All');
                setSelectedGender('All');
              }}
              className="px-5 py-2.5 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => {
              const skillsList = Array.isArray(job.skills) 
                ? job.skills 
                : typeof job.skills === 'string' 
                ? job.skills.split(',').map(s => s.trim()).filter(Boolean) 
                : [];

              const educationOptions = splitEducationRequirements(job.qualification || job.education || 'Diploma / Graduate');

              return (
                <div
                  key={job.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[#E4E7DC] bg-white hover:border-[#111215] p-5 sm:p-6 transition-all duration-300 shadow-2xs hover:shadow-xl hover:-translate-y-0.5 overflow-hidden"
                >
                  <div className="space-y-3.5 relative z-10">
                    {/* Header Row: Job No, Sector, Access Code */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {job.jobNo && (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215]">
                            Job: {job.jobNo}
                          </span>
                        )}
                        <span 
                          className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-[#F8F9F5] border border-[#E4E7DC] text-[#575A51] truncate max-w-[150px]"
                          title={job.industrySector || job.sector || 'General Sector'}
                        >
                          <Layers size={10} className="inline mr-1 text-[#8FB305] shrink-0" />
                          {job.industrySector || job.sector || 'General Sector'}
                        </span>
                      </div>

                      {job.accessCode && (
                        <div 
                          onClick={(e) => handleCopyCode(e, job.accessCode!)}
                          className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-md bg-[#111215] text-[#D4F82C] hover:bg-black border border-[#111215] flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-2xs shrink-0"
                          title="Click to copy Job Access Code"
                        >
                          <span>Code: {job.accessCode}</span>
                          {copiedCode === job.accessCode ? (
                            <Check size={11} className="text-[#D4F82C]" />
                          ) : (
                            <Copy size={10} className="text-[#D4F82C]/70" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Role Title & Recruiter */}
                    <div>
                      <h2 className="text-[16px] sm:text-[17px] font-bold text-[#111215] group-hover:text-[#8FB305] transition-colors leading-snug line-clamp-1">
                        {job.title}
                      </h2>

                      <div className="flex items-center gap-1.5 text-[11px] font-medium mt-1 text-[#73766C] flex-wrap">
                        <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                          <User className="size-3 text-[#73766C] shrink-0" />
                          <span className="truncate">Posted by: <strong className="text-[#111215] font-semibold">{job.entryBy || job.recruiterName || 'Recruiter'}</strong></span>
                        </span>
                        <span className="select-none">•</span>
                        <span className="text-[#575A51] font-semibold inline-flex items-center gap-1 truncate max-w-[150px]">
                          <Briefcase className="size-3 text-[#8FB305] shrink-0" />
                          <span className="truncate">{job.department || 'Accounts / Finance'}</span>
                        </span>
                      </div>
                    </div>

                    {/* 3-Column Metadata Spec Box */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <div className="p-2.5 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[10px] flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-[#8FB305] shrink-0" />
                        <div className="truncate min-w-0">
                          <span className="text-[9px] text-[#73766C] block font-bold uppercase tracking-wider leading-none">Location</span>
                          <span className="truncate block font-bold text-[#111215] leading-tight mt-0.5">{job.location || 'Nashik, MH'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[10px] flex items-center gap-1.5">
                        <Briefcase className="size-3.5 text-[#8FB305] shrink-0" />
                        <div className="truncate min-w-0">
                          <span className="text-[9px] text-[#73766C] block font-bold uppercase tracking-wider leading-none">Experience</span>
                          <span className="truncate block font-bold text-[#111215] leading-tight mt-0.5">{job.experience || '2 - 3 Yrs'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[10px] flex items-center gap-1.5">
                        <User className="size-3.5 text-[#8FB305] shrink-0" />
                        <div className="truncate min-w-0">
                          <span className="text-[9px] text-[#73766C] block font-bold uppercase tracking-wider leading-none">Gender</span>
                          <span className="truncate block font-bold text-[#111215] leading-tight mt-0.5">
                            {job.genderRequirement && job.genderRequirement !== 'Any' ? job.genderRequirement : (job.gender && job.gender !== 'Any' ? job.gender : 'Open / Any')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Accepted Degrees */}
                    <div className="p-2.5 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-[10px] space-y-1.5">
                      <div className="flex items-center gap-1 text-[#73766C] font-bold text-[9.5px] uppercase tracking-wider">
                        <GraduationCap className="size-3 text-[#8FB305] shrink-0" />
                        <span>Accepted Degrees / Trades:</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {educationOptions.slice(0, 3).map((option, idx) => (
                          <span key={option + idx} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-[#E4E7DC] text-[#111215] inline-flex items-center">
                            <span className="truncate max-w-[150px]">{option}</span>
                          </span>
                        ))}
                        {educationOptions.length > 3 && (
                          <span className="text-[9.5px] font-semibold text-[#73766C]">
                            +{educationOptions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description Snippet */}
                    {job.description && (
                      <p className="text-[11px] line-clamp-2 leading-relaxed text-[#575A51]">
                        {getJobDescriptionSnippet(job.description, 120)}
                      </p>
                    )}

                    {/* Skills Tags */}
                    {skillsList.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {skillsList.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md text-[9.5px] font-medium bg-[#F8F9F5] border border-[#E4E7DC] text-[#575A51]">
                            {skill}
                          </span>
                        ))}
                        {skillsList.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium text-[#73766C]">
                            +{skillsList.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Status & Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-3.5 mt-4 border-t border-[#E4E7DC] relative z-10">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#575A51]">
                      <span className="size-2 rounded-full bg-[#8FB305] animate-pulse shrink-0" />
                      <span className="font-bold text-[#111215]">Actively Hiring</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedJobModal(job)}
                        className="px-3 py-1.5 rounded-full border border-[#E4E7DC] bg-white hover:bg-[#F8F9F5] text-[#111215] text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/candidate?job=${job.id}`)}
                        className="px-4 py-1.5 rounded-full bg-[#111215] hover:bg-black text-white text-[11px] font-black transition-all shadow-2xs flex items-center gap-1.5 group/btn cursor-pointer"
                      >
                        <span>Apply</span>
                        <span className="text-[#D4F82C] group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform">↗</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Job Details Modal ── */}
      {selectedJobModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden animate-in fade-in duration-200"
          onClick={() => setSelectedJobModal(null)}
        >
          <div 
            className="relative flex flex-col max-w-2xl w-full max-h-[calc(100dvh-2rem)] rounded-3xl bg-white border border-[#E4E7DC] shadow-2xl overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#E4E7DC] p-5 sm:p-6 bg-[#F8F9F5] shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {selectedJobModal.jobNo && (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider bg-white border border-[#E4E7DC] text-[#111215]">
                      Job No: {selectedJobModal.jobNo}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide bg-white border border-[#E4E7DC] text-[#575A51]">
                    {selectedJobModal.industrySector || selectedJobModal.sector || 'General Sector'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111215] tracking-tight">{selectedJobModal.title}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#73766C] mt-1">
                  <span>Posted by: <strong className="text-[#111215]">{selectedJobModal.entryBy || selectedJobModal.recruiterName || 'Recruiter'}</strong></span>
                  <span>•</span>
                  <span className="text-[#575A51] font-semibold">{selectedJobModal.department || 'General'}</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedJobModal(null)} 
                className="size-8 rounded-lg border border-[#E4E7DC] bg-white hover:bg-slate-100 flex items-center justify-center text-[#111215] transition-colors cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 overscroll-contain">
              {/* Access Code Banner */}
              {selectedJobModal.accessCode && (
                <div className="p-4.5 rounded-2xl bg-[#111215] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[#73766C]">
                      Candidate Interview Access Code
                    </span>
                    <span className="font-mono text-xl sm:text-2xl font-black text-[#D4F82C] tracking-widest block mt-0.5">
                      {selectedJobModal.accessCode}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleCopyCode(e, selectedJobModal.accessCode!)}
                    className="px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-[#111215] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                  >
                    {copiedCode === selectedJobModal.accessCode ? (
                      <>
                        <Check size={14} className="text-[#8FB305]" />
                        <span>Copied Code!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 3-Column Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-[#73766C]">Location</span>
                  <span className="font-bold text-[#111215] block mt-0.5 truncate">{selectedJobModal.location || 'Nashik, Maharashtra'}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-[#73766C]">Experience</span>
                  <span className="font-bold text-[#111215] block mt-0.5 truncate">{selectedJobModal.experience || '2 - 3 Yrs'}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-[#73766C]">Gender Req.</span>
                  <span className="font-bold text-[#111215] block mt-0.5 truncate">{selectedJobModal.genderRequirement || selectedJobModal.gender || 'Open / Any'}</span>
                </div>
              </div>

              {/* Education */}
              <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-[#73766C] font-bold uppercase tracking-wider text-[11px]">
                  <GraduationCap className="size-4 text-[#8FB305] shrink-0" />
                  <span>Accepted Qualifications / Trades:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {splitEducationRequirements(selectedJobModal.qualification || selectedJobModal.education || 'Any Qualification').map((opt, i) => (
                    <span key={opt + i} className="px-3 py-1 rounded-full text-xs font-bold bg-white border border-[#E4E7DC] text-[#111215]">
                      {opt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Job Description */}
              {selectedJobModal.description && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#73766C]">Job Description &amp; Scope</h3>
                  <div className="text-xs leading-relaxed p-4 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] max-h-60 overflow-y-auto text-[#111215]">
                    <FormattedJobDescription description={selectedJobModal.description} className="max-w-full text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-t border-[#E4E7DC] bg-[#F8F9F5] shrink-0">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#8FB305] animate-pulse" />
                <span className="text-xs font-bold text-[#111215]">Active Mandate — Open for Applications</span>
              </div>

              <button
                type="button"
                onClick={() => { setSelectedJobModal(null); navigate(`/candidate?job=${selectedJobModal.id}`); }}
                className="px-6 py-2.5 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer group"
              >
                <span>Apply in Candidate Portal</span>
                <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contact Support Modal ── */}
      {showContactModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
          onClick={() => setShowContactModal(false)}
        >
          <div 
            className="max-w-lg w-full rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-8 shadow-2xl space-y-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E4E7DC] pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center text-[#8FB305]">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#111215]">
                    Contact Recruiting Desk
                  </h3>
                  <p className="text-xs text-[#73766C]">
                    Submit your query or employer partnership request
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowContactModal(false)} 
                className="size-8 rounded-lg border border-[#E4E7DC] bg-white hover:bg-slate-100 flex items-center justify-center text-[#111215] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleContactSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#111215] mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] outline-none focus:bg-white focus:border-[#111215] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#111215] mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] outline-none focus:bg-white focus:border-[#111215] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#111215] mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] outline-none focus:bg-white focus:border-[#111215] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#111215] mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Inquiry Subject"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] outline-none focus:bg-white focus:border-[#111215] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#111215] mb-1">
                  Message / Inquiry <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write your message or inquiry here..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full p-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] outline-none resize-none focus:bg-white focus:border-[#111215] transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 rounded-full border border-[#E4E7DC] text-xs font-bold text-[#73766C] hover:text-[#111215] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingContact}
                  className="px-6 py-2.5 rounded-full bg-[#111215] hover:bg-black text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 group"
                >
                  {submittingContact ? (
                    <span>Sending...</span>
                  ) : (
                    <>
                      <span>Send Message</span>
                      <span className="text-[#D4F82C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Signature hireX Footer ── */}
      <footer className="relative z-[95] w-full bg-[#F8F9F5] border-t border-[#E4E7DC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-12 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12">
            <div>
              <div className="mb-3">
                <HireXLogo size="md" variant="full" isDark={false} />
              </div>
              <p className="text-xs text-[#73766C] leading-relaxed">
                The AI-powered recruitment operating system for agile hiring teams and modern staffing agencies.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px]">Product</div>
              <div><Link to="/#pipeline" className="text-[#73766C] hover:text-[#111215]">Pipeline Kanban</Link></div>
              <div><Link to="/#client-portal" className="text-[#73766C] hover:text-[#111215]">Client Portal</Link></div>
              <div><Link to="/#pricing" className="text-[#73766C] hover:text-[#111215]">Pricing Estimator</Link></div>
              <div><Link to="/active-jobs" className="text-[#111215] font-bold">Active Job Board</Link></div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px]">Company</div>
              <div><a href="https://snab.co.in" target="_blank" rel="noopener noreferrer" className="text-[#73766C] hover:text-[#111215]">About SNAB</a></div>
              <div><button type="button" onClick={handleOpenContactModal} className="text-[#73766C] hover:text-[#111215] cursor-pointer">Contact Desk</button></div>
              <div><a href="mailto:hello@snab.co.in" className="text-[#73766C] hover:text-[#111215]">hello@snab.co.in</a></div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-[#111215] uppercase tracking-wider text-[11px]">Enterprise</div>
              <div className="text-[#73766C]">GST Compliant Invoicing</div>
              <div className="text-[#73766C]">Anti-Poaching Data Masking</div>
              <div className="text-[#73766C]">Baileys WhatsApp Gateway</div>
            </div>
          </div>

          {/* Giant Typographic Wordmark */}
          <div className="py-4 border-t border-[#E4E7DC] select-none overflow-hidden">
            <div className="text-[14vw] font-black tracking-tighter leading-none text-[#111215] flex items-center">
              hireX<span className="text-[#8FB305]">↗</span>
            </div>
          </div>

          {/* Copyright Bar */}
          <div className="pt-4 border-t border-[#E4E7DC] flex flex-wrap items-center justify-between text-xs text-[#73766C] gap-3">
            <div>© {new Date().getFullYear()} SNAB Technologies. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <span>GST Registered</span>
              <span>•</span>
              <span>ISO Compliant Hosting</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ActiveJobsPage;
