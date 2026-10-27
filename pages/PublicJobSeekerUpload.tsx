import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, CheckCircle2, Upload, FileText, User, Mail, Phone, MapPin, 
  Briefcase, GraduationCap, ArrowRight, RefreshCw, Plus, X, Tag, IndianRupee, 
  Clock, UserCheck, Search, Filter, Check, ChevronRight, AlertCircle, 
  ExternalLink, Eye, ShieldCheck, SlidersHorizontal, RotateCcw, Edit3, ChevronDown, ChevronUp, Ban, Sun, Moon,
  Layers, Menu, Save, ArrowUpRight
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, arrayUnion, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { LocationCityInput } from '../components/LocationCityInput';
import { EducationInput } from '../components/EducationInput';
import { parseResumeFileLocally, fastParseResumeFileLocally, readResumeText, saveResumeDumpCandidate, EMPLOYMENT_TYPE_OPTIONS, normalizeEmploymentTypes } from '../services/resumeService';
import { EmploymentTypeMultiSelect } from '../components/EmploymentTypeMultiSelect';
import { uploadToCloudinary } from '../services/api';
import { ALL_EDUCATION_DEGREES } from '../data/allEducationDegrees';
import { MAHARASHTRA_CITIES } from '../data/maharashtraCities';
import { ALL_JOB_DOMAINS, detectDomainFromText, detectDomainsFromText, detectSectorsFromText, detectDepartmentsFromText } from '../data/jobDomains';
import { useMessageBox } from '../components/MessageBox';
import { useTheme } from '../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import HireXLogo from '../components/HireXLogo';
import { calculateJobMatchScore, JobMatchResult, CandidateMatchProfile } from '../services/jobMatchService';
import { FormattedJobDescription } from '../utils/jobDescriptionFormatter';
import { splitEducationRequirements, checkSingleRequirementMatch, normalizeEducationToString } from '../utils/educationMatcher';
import { ListenJDButton } from '../components/ListenJDButton';

const matchExtractedLocationToPresentCity = (rawLocation: string): string => {
  if (!rawLocation || typeof rawLocation !== 'string') return '';
  const clean = rawLocation.trim().toLowerCase();
  if (!clean) return '';

  const cityMatch = MAHARASHTRA_CITIES.find(city => {
    const cityLower = city.toLowerCase();
    return clean.includes(cityLower) || cityLower.includes(clean);
  });
  if (cityMatch) return cityMatch;

  if (clean.includes('nasik') || clean.includes('nashik')) return 'Nashik';
  if (clean.includes('mumbai') || clean.includes('bombay')) return 'Mumbai';
  if (clean.includes('pune') || clean.includes('poona')) return 'Pune';
  if (clean.includes('nagpur')) return 'Nagpur';
  if (clean.includes('thane')) return 'Thane';
  if (clean.includes('aurangabad') || clean.includes('sambhajinagar')) return 'Chhatrapati Sambhajinagar (Aurangabad)';
  if (clean.includes('solapur') || clean.includes('sholapur')) return 'Solapur';
  if (clean.includes('kolhapur')) return 'Kolhapur';
  if (clean.includes('amravati')) return 'Amravati';
  if (clean.includes('jalgaon')) return 'Jalgaon';
  if (clean.includes('nanded')) return 'Nanded';
  if (clean.includes('sangli')) return 'Sangli';
  if (clean.includes('latur')) return 'Latur';
  if (clean.includes('dhule')) return 'Dhule';
  if (clean.includes('ahmednagar')) return 'Ahmednagar';
  if (clean.includes('satara')) return 'Satara';

  return '';
};

export default function PublicJobSeekerUpload() {
  const messageBox = useMessageBox();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    document.title = "Upload Resume | InterviewXpert - AI Recruitment Platform";
    const setMetaTag = (attr: string, value: string, content: string) => {
      let element = document.querySelector(`meta[${attr}='${value}']`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, value);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMetaTag('property', 'og:image', '/assets/logo-cropped-day.png');
    setMetaTag('property', 'og:image:secure_url', '/assets/logo-cropped-day.png');
    setMetaTag('property', 'og:url', '/upload-resume');
    setMetaTag('name', 'twitter:image', '/assets/logo-cropped-day.png');
  }, []);

  // Mobile Navbar Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form State
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [candidateGender, setCandidateGender] = useState('');
  const [candidateMaritalStatus, setCandidateMaritalStatus] = useState('');
  const [candidateLocation, setCandidateLocation] = useState('');
  const [candidateState, setCandidateState] = useState('Maharashtra');
  const [candidateSectors, setCandidateSectors] = useState<string[]>([]);
  const [candidateDepartments, setCandidateDepartments] = useState<string[]>([]);
  const [candidateDomains, setCandidateDomains] = useState<string[]>([]);
  const [candidateDomain, setCandidateDomain] = useState('');
  const [candidateExp, setCandidateExp] = useState('');

  const toggleSector = (sectorName: string) => {
    setCandidateSectors(prev => {
      let updated: string[];
      if (prev.some(s => s.toLowerCase() === sectorName.toLowerCase())) {
        updated = prev.filter(s => s.toLowerCase() !== sectorName.toLowerCase());
      } else {
        if (prev.length >= 5) {
          messageBox.showError("You can select a maximum of 5 Target Industry Sectors.");
          return prev;
        }
        updated = [...prev, sectorName];
      }
      const combined = Array.from(new Set([...updated, ...candidateDepartments]));
      setCandidateDomains(combined);
      setCandidateDomain(combined.join(', '));
      return updated;
    });
  };

  const toggleDepartment = (deptName: string) => {
    setCandidateDepartments(prev => {
      let updated: string[];
      if (prev.some(d => d.toLowerCase() === deptName.toLowerCase())) {
        updated = prev.filter(d => d.toLowerCase() !== deptName.toLowerCase());
      } else {
        if (prev.length >= 5) {
          messageBox.showError("You can select a maximum of 5 Functional Departments.");
          return prev;
        }
        updated = [...prev, deptName];
      }
      const combined = Array.from(new Set([...candidateSectors, ...updated]));
      setCandidateDomains(combined);
      setCandidateDomain(combined.join(', '));
      return updated;
    });
  };

  const toggleDomain = (domainName: string) => {
    setCandidateDomains(prev => {
      let updated: string[];
      if (prev.includes(domainName)) {
        updated = prev.filter(d => d !== domainName);
      } else {
        updated = [...prev, domainName];
      }
      setCandidateDomain(updated.join(', '));
      return updated;
    });
  };
  const [candidateEducation, setCandidateEducation] = useState('');
  const [candidateEmploymentStatus, setCandidateEmploymentStatus] = useState('Working');
  const [candidateEmploymentTypes, setCandidateEmploymentTypes] = useState<string[]>(['Full-time — Work from Office / On-site']);
  const candidateEmploymentType = candidateEmploymentTypes.join(', ');
  const [candidateNoticePeriodVal, setCandidateNoticePeriodVal] = useState('30');
  const [candidateNoticePeriodUnit, setCandidateNoticePeriodUnit] = useState<'Days' | 'Months'>('Days');

  // Salary State with Period (Per Month / Per Year) and Type (In-Hand / CTC)
  const [candidateCurrentSalaryVal, setCandidateCurrentSalaryVal] = useState('');
  const [candidateCurrentSalaryPeriod, setCandidateCurrentSalaryPeriod] = useState<'Per Month' | 'Per Year'>('Per Year');
  const [candidateCurrentSalaryType, setCandidateCurrentSalaryType] = useState<'In-Hand' | 'CTC'>('In-Hand');

  const [candidateExpectedSalaryVal, setCandidateExpectedSalaryVal] = useState('');
  const [candidateExpectedSalaryPeriod, setCandidateExpectedSalaryPeriod] = useState<'Per Month' | 'Per Year'>('Per Year');
  const [candidateExpectedSalaryType, setCandidateExpectedSalaryType] = useState<'In-Hand' | 'CTC'>('In-Hand');

  const getFormattedCurrentSalary = () => {
    const v = candidateCurrentSalaryVal.trim();
    if (!v) return '';
    if (v === '0' || v.toLowerCase() === 'fresher') return 'Fresher (0)';
    return `${v} / ${candidateCurrentSalaryPeriod} (${candidateCurrentSalaryType})`;
  };

  const getFormattedExpectedSalary = () => {
    const v = candidateExpectedSalaryVal.trim();
    if (!v) return '';
    return `${v} / ${candidateExpectedSalaryPeriod} (${candidateExpectedSalaryType})`;
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extraBioText, setExtraBioText] = useState('');

  // Email Autocheck State for existing candidates
  const [existingEmailCandidate, setExistingEmailCandidate] = useState<any | null>(null);
  const [isCheckingEmailBlur, setIsCheckingEmailBlur] = useState(false);

  // Skills Auto-Fetch & Editing State
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [parsedProfileData, setParsedProfileData] = useState<{ profile: any; resumeText: string } | null>(null);

  // Email Lookup State for Existing Submitted Candidates
  const [showEmailLookup, setShowEmailLookup] = useState(false);
  const [lookupEmailInput, setLookupEmailInput] = useState('');
  const [isSearchingEmail, setIsSearchingEmail] = useState(false);

  // Processing & Success State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [submittedCandidateData, setSubmittedCandidateData] = useState<CandidateMatchProfile | null>(null);
  const [originalCandidateData, setOriginalCandidateData] = useState<CandidateMatchProfile | null>(null);

  const isCandidateBanned = Boolean(
    submittedCandidateData?.isBlocked ||
    submittedCandidateData?.isBanned ||
    submittedCandidateData?.status === 'blocked'
  );

  // Criteria Editor Toggle on Results View
  const [showCriteriaEditor, setShowCriteriaEditor] = useState(false);
  const [resultSkillInput, setResultSkillInput] = useState('');

  // Active Jobs & Matching State
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJobForModal, setSelectedJobForModal] = useState<JobMatchResult | null>(null);
  const [matchFilter, setMatchFilter] = useState<'EligibleOnly' | 'All' | 'HighMatch' | 'LocalCity'>('EligibleOnly');

  // Candidate Application Modal & State
  const [applyingJobModal, setApplyingJobModal] = useState<JobMatchResult | null>(null);
  const [applyName, setApplyName] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);

  // Auto-Restore Draft Form State & Submitted Match Results on Page Refresh
  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem('snab_hirex_candidate_draft_form') || sessionStorage.getItem('dsource_candidate_draft_form');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.name) setCandidateName(parsed.name);
        if (parsed.email) setCandidateEmail(parsed.email);
        if (parsed.phone) setCandidatePhone(parsed.phone);
        if (parsed.gender) setCandidateGender(parsed.gender);
        if (parsed.location) setCandidateLocation(parsed.location);
        if (Array.isArray(parsed.domains)) {
          setCandidateDomains(parsed.domains);
          setCandidateDomain(parsed.domains.join(', '));
        } else if (parsed.domain) {
          const doms = parsed.domain.split(', ').filter(Boolean);
          setCandidateDomains(doms);
          setCandidateDomain(parsed.domain);
        }
        if (parsed.exp) setCandidateExp(parsed.exp);
        if (parsed.education) setCandidateEducation(parsed.education);
        if (parsed.status) setCandidateEmploymentStatus(parsed.status);
        if (parsed.noticeVal) setCandidateNoticePeriodVal(parsed.noticeVal);
        if (parsed.noticeUnit) setCandidateNoticePeriodUnit(parsed.noticeUnit);
        if (parsed.currentSalaryVal) setCandidateCurrentSalaryVal(parsed.currentSalaryVal);
        else if (parsed.currentSalary) setCandidateCurrentSalaryVal(parsed.currentSalary);
        if (parsed.currentSalaryPeriod) setCandidateCurrentSalaryPeriod(parsed.currentSalaryPeriod);
        if (parsed.currentSalaryType) setCandidateCurrentSalaryType(parsed.currentSalaryType);

        if (parsed.expectedSalaryVal) setCandidateExpectedSalaryVal(parsed.expectedSalaryVal);
        else if (parsed.expectedSalary) setCandidateExpectedSalaryVal(parsed.expectedSalary);
        if (parsed.expectedSalaryPeriod) setCandidateExpectedSalaryPeriod(parsed.expectedSalaryPeriod);
        if (parsed.expectedSalaryType) setCandidateExpectedSalaryType(parsed.expectedSalaryType);

        if (Array.isArray(parsed.skills) && parsed.skills.length > 0) setExtractedSkills(parsed.skills);
        if (parsed.extraBioText) setExtraBioText(parsed.extraBioText);
      }

      const savedSubmitted = sessionStorage.getItem('snab_hirex_candidate_submitted_data') || sessionStorage.getItem('dsource_candidate_submitted_data');
      if (savedSubmitted) {
        const parsedSubmitted = JSON.parse(savedSubmitted);
        if (parsedSubmitted && (parsedSubmitted.email || parsedSubmitted.name)) {
          setSubmittedCandidateData(parsedSubmitted);
          setOriginalCandidateData(parsedSubmitted);
          if (Array.isArray(parsedSubmitted.domains)) {
            setCandidateDomains(parsedSubmitted.domains);
            setCandidateDomain(parsedSubmitted.domains.join(', '));
          } else if (parsedSubmitted.domain) {
            setCandidateDomains(parsedSubmitted.domain.split(', ').filter(Boolean));
            setCandidateDomain(parsedSubmitted.domain);
          }
          setIsSubmittedSuccess(true);
        }
      }
    } catch (err) {
      console.warn("Auto restore candidate draft error:", err);
    }
  }, []);

  // Persist Form Draft Inputs on Every Field Update
  useEffect(() => {
    try {
      if (candidateName || candidateEmail || candidatePhone || selectedFile) {
        const draft = {
          name: candidateName,
          email: candidateEmail,
          phone: candidatePhone,
          gender: candidateGender,
          location: candidateLocation,
          domains: candidateDomains,
          domain: candidateDomains.join(', '),
          exp: candidateExp,
          education: candidateEducation,
          status: candidateEmploymentStatus,
          noticeVal: candidateNoticePeriodVal,
          noticeUnit: candidateNoticePeriodUnit,
          currentSalaryVal: candidateCurrentSalaryVal,
          currentSalaryPeriod: candidateCurrentSalaryPeriod,
          currentSalaryType: candidateCurrentSalaryType,
          currentSalary: getFormattedCurrentSalary(),
          expectedSalaryVal: candidateExpectedSalaryVal,
          expectedSalaryPeriod: candidateExpectedSalaryPeriod,
          expectedSalaryType: candidateExpectedSalaryType,
          expectedSalary: getFormattedExpectedSalary(),
          skills: extractedSkills,
          extraBioText: extraBioText,
        };
        sessionStorage.setItem('snab_hirex_candidate_draft_form', JSON.stringify(draft));
      }
    } catch (err) {
      console.warn("Save candidate draft error:", err);
    }
  }, [
    candidateName, candidateEmail, candidatePhone, candidateGender, candidateLocation, candidateDomains,
    candidateExp, candidateEducation, candidateEmploymentStatus, candidateNoticePeriodVal,
    candidateNoticePeriodUnit, candidateCurrentSalaryVal, candidateCurrentSalaryPeriod, candidateCurrentSalaryType,
    candidateExpectedSalaryVal, candidateExpectedSalaryPeriod, candidateExpectedSalaryType, extractedSkills, extraBioText
  ]);

  // Persist Matched Candidate Results State on Form Submission
  useEffect(() => {
    if (submittedCandidateData) {
      try {
        sessionStorage.setItem('snab_hirex_candidate_submitted_data', JSON.stringify(submittedCandidateData));
      } catch (err) {
        console.warn("Save submitted data error:", err);
      }
    }
  }, [submittedCandidateData]);

  const handleOpenApplyModal = (matchResult: JobMatchResult) => {
    setApplyingJobModal(matchResult);
    setApplyName(submittedCandidateData?.name || candidateName || '');
    setApplyEmail(submittedCandidateData?.email || candidateEmail || '');
    setApplyPhone(submittedCandidateData?.phone || candidatePhone || '');
  };

  const handleConfirmApplicationAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJobModal) return;

    const name = applyName.trim();
    const email = applyEmail.trim().toLowerCase();
    const phone = applyPhone.trim();

    if (!name) {
      messageBox.showError("Please enter your Full Name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      messageBox.showError("Please enter a valid Email Address.");
      return;
    }
    if (!phone) {
      messageBox.showError("Please enter your Mobile / WhatsApp Phone Number.");
      return;
    }

    setIsSubmittingApplication(true);
    const job = applyingJobModal.job;

    try {
      // 1. Record candidate application in Firestore interviews collection
      const intRef = doc(db, 'interviews', job.id);
      await updateDoc(intRef, {
        candidateEmails: arrayUnion(email),
        candidateData: arrayUnion({
          name,
          email,
          phone,
          appliedAt: new Date().toISOString(),
          status: 'interested',
          source: 'public_job_match'
        })
      });

      // 2. Add application document to candidateApplications collection
      try {
        await addDoc(collection(db, 'candidateApplications'), {
          interviewId: job.id,
          jobTitle: job.title || '',
          candidateName: name,
          candidateEmail: email,
          candidatePhone: phone,
          recruiterUID: job.recruiterUID || job.createdBy?.uid || '',
          status: 'pending',
          appliedAt: serverTimestamp(),
          source: 'public_job_match'
        });
      } catch (appErr) {
        console.warn("candidateApplications save fallback:", appErr);
      }

      sessionStorage.setItem(`direct_bypass_${job.id}`, 'true');
      const codeParam = job.accessCode ? `?code=${encodeURIComponent(job.accessCode)}&direct=true` : '?direct=true';
      messageBox.showSuccess(`Application registered for ${job.title}! Opening your interview directly...`);
      setApplyingJobModal(null);
      navigate(`/interview/${job.id}${codeParam}`);
    } catch (err: any) {
      console.error("Application Submit Error:", err);
      sessionStorage.setItem(`direct_bypass_${job.id}`, 'true');
      const codeParam = job.accessCode ? `?code=${encodeURIComponent(job.accessCode)}&direct=true` : '?direct=true';
      navigate(`/interview/${job.id}${codeParam}`);
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  // Check email on blur/typing to automatically inform candidate if they already submitted
  const handleCheckEmailExists = async (emailVal: string) => {
    const cleanEmail = emailVal.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setExistingEmailCandidate(null);
      return;
    }

    setIsCheckingEmailBlur(true);
    try {
      const q = query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const found = snap.docs[0].data();
        setExistingEmailCandidate({ id: snap.docs[0].id, ...(found.profile || {}), ...found });
      } else {
        const q2 = query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanEmail));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          const found2 = snap2.docs[0].data();
          setExistingEmailCandidate({ id: snap2.docs[0].id, ...(found2.profile || {}), ...found2 });
        } else {
          setExistingEmailCandidate(null);
        }
      }
    } catch (err) {
      console.warn("Email exists check warning:", err);
    } finally {
      setIsCheckingEmailBlur(false);
    }
  };

  // Load existing profile from email match
  const handleLoadExistingProfile = (candData: any) => {
    const prof = (candData.profile && typeof candData.profile === 'object') ? candData.profile : {};

    const name = candData.name || prof.name || candidateName || 'Job Seeker';
    const email = candData.email || prof.email || candidateEmail.trim().toLowerCase();
    const phone = candData.phone || prof.phone || candidatePhone || '';
    const gender = candData.gender || prof.gender || candidateGender || 'Any';
    const location = candData.location || prof.location || candidateLocation || 'Nashik';
    const rawExp = candData.experienceYears ?? candData.totalExperienceYears ?? candData.experience ?? prof.totalExperienceYears ?? (Number(candidateExp) || 0);
    const expNum = Number(rawExp) || 0;
    const rawEdu = candData.highestEducation ?? candData.education ?? (prof.education && Array.isArray(prof.education) ? prof.education[0]?.degree : prof.education) ?? candidateEducation ?? 'Graduate';
    const educationStr = normalizeEducationToString(rawEdu) || 'Graduate';
    const employmentStatus = candData.employmentStatus || candidateEmploymentStatus || 'Working';
    const noticePeriod = candData.noticePeriod || `${candidateNoticePeriodVal} ${candidateNoticePeriodUnit}`;

    const currentSal = candData.currentSalary || prof.currentSalary || getFormattedCurrentSalary() || 'As per Industry';
    const expectedSal = candData.expectedSalary || prof.expectedSalary || getFormattedExpectedSalary() || 'As per Industry';

    const skills = Array.isArray(candData.skills) ? candData.skills : (Array.isArray(prof.skills) ? prof.skills : (extractedSkills || []));
    const resumeText = candData.resumeText || candData.additionalText || prof.resumeText || '';
    const resumeUrl = candData.resumeUrl || prof.resumeUrl || '';

    const existingDoms: string[] = Array.isArray(candData.domains)
      ? candData.domains
      : (candData.domain ? candData.domain.split(', ').filter(Boolean) : (candidateDomains.length > 0 ? candidateDomains : detectDomainsFromText(resumeText || candData.title || '')));

    // Also populate state so candidate form is consistent
    if (name) setCandidateName(name);
    if (email) setCandidateEmail(email);
    if (phone) setCandidatePhone(phone);
    if (gender && gender !== 'Any') setCandidateGender(gender);
    if (location) setCandidateLocation(location);
    if (expNum !== undefined) setCandidateExp(String(expNum));
    if (educationStr) setCandidateEducation(educationStr);
    if (employmentStatus) setCandidateEmploymentStatus(employmentStatus);
    const parsedEmp = normalizeEmploymentTypes({ ...prof, ...candData });
    if (parsedEmp.length > 0) setCandidateEmploymentTypes(parsedEmp);
    if (Array.isArray(skills) && skills.length > 0) setExtractedSkills(skills);
    if (candData.currentSalaryVal) setCandidateCurrentSalaryVal(candData.currentSalaryVal);
    if (candData.expectedSalaryVal) setCandidateExpectedSalaryVal(candData.expectedSalaryVal);

    if (existingDoms.length > 0) {
      setCandidateDomains(existingDoms);
      setCandidateDomain(existingDoms.join(', '));
    }

    const isCandBlocked = Boolean(candData.isBlocked || prof.isBlocked || candData.isBanned || prof.isBanned);
    const profileObj: CandidateMatchProfile = {
      name,
      email,
      phone,
      gender,
      location,
      domain: existingDoms.join(', '),
      domains: existingDoms,
      experience: expNum,
      totalExperienceYears: expNum,
      education: educationStr,
      highestEducation: educationStr,
      employmentStatus,
      noticePeriod,
      currentSalary: currentSal,
      expectedSalary: expectedSal,
      skills,
      resumeText,
      resumeUrl,
      isBlocked: isCandBlocked,
      isBanned: isCandBlocked
    };

    setSubmittedCandidateData(profileObj);
    setOriginalCandidateData({ ...profileObj });
    setIsSubmittedSuccess(true);
    setShowEmailLookup(false);
    setExistingEmailCandidate(null);
    if (isCandBlocked) {
      messageBox.showError(`Notice: Account for "${profileObj.name}" (${profileObj.email || profileObj.phone}) is restricted. This profile is banned from receiving job recommendations until unbanned.`);
    } else {
      messageBox.showSuccess(`Welcome back, ${profileObj.name}! Your existing profile has been loaded and matched with active job openings.`);
    }
  };

  // Fetch active jobs from Firestore interviews and jobs collection
  useEffect(() => {
    let activeInterviewsList: any[] = [];
    let activeJobsList: any[] = [];

    const mergeJobs = () => {
      const allRaw = [...activeInterviewsList, ...activeJobsList];
      const seenIds = new Set<string>();
      const combined: any[] = [];

      for (const item of allRaw) {
        if (!item || !item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        const statusLower = String(item.status || '').trim().toLowerCase();
        if (['inactive', 'expired', 'closed', 'disabled', 'deactivated', 'draft'].includes(statusLower)) {
          continue;
        }
        if (item.isMock) continue;

        combined.push(item);
      }

      setActiveJobs(combined);
      setJobsLoading(false);
    };

    const qInterviews = query(collection(db, 'interviews'));
    const parseExpMinMax = (data: any) => {
      let min = 0;
      let max = 0;
      if (data.minExperience !== undefined && data.minExperience !== null && !isNaN(Number(data.minExperience))) {
        min = Math.max(0, Number(data.minExperience));
      }
      if (data.maxExperience !== undefined && data.maxExperience !== null && !isNaN(Number(data.maxExperience))) {
        max = Math.max(0, Number(data.maxExperience));
      }
      const rawStr = String(data.experience || data.minExperience || '').trim();
      if (min === 0 && rawStr) {
        const rangeMatch = rawStr.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
        if (rangeMatch) {
          min = parseFloat(rangeMatch[1]) || 0;
          max = parseFloat(rangeMatch[2]) || 0;
        } else {
          const singleMatch = rawStr.match(/(\d+(?:\.\d+)?)/);
          if (singleMatch && !/fresher|0\s*yr/i.test(rawStr)) {
            min = parseFloat(singleMatch[1]) || 0;
          }
        }
      }
      return { minExperience: min, maxExperience: max, experience: rawStr || (min > 0 ? (max > min ? `${min} - ${max} Yrs` : `${min}+ Yrs`) : 'Fresher / Any Experience') };
    };

    const unsubInterviews = onSnapshot(qInterviews, (snapshot) => {
      activeInterviewsList = snapshot.docs.map((doc) => {
        const data = doc.data();
        const jobNo = data.jobNo ? String(data.jobNo).trim() : '';
        const accessCode = jobNo || data.accessCode || doc.id.slice(0, 6).toUpperCase();
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
        const parsedExp = parseExpMinMax(data);

        return {
          id: doc.id,
          jobNo,
          title: data.title || 'Untitled Job Role',
          company: data.company || data.companyName || 'Hiring Partner',
          recruiterName: resolvedEntryBy,
          entryBy: resolvedEntryBy,
          description: data.description || data.jobDescription || '',
          industrySector: data.industrySector || data.sector || data.industryName || data.industry || '',
          sector: data.sector || data.industrySector || data.industryName || '',
          department: data.department || data.roleCategory || data.category || 'General',
          departments: data.departments || [data.department || data.roleCategory || data.category || 'General'],
          roleCategory: data.roleCategory || data.roleName || '',
          location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : data.city || 'Nashik, Maharashtra'),
          city: data.city || data.location || 'Nashik',
          genderRequirement: data.genderRequirement || data.gender || data.genderPreference || 'Any',
          gender: data.gender || data.genderRequirement || 'Any',
          employmentType: data.employmentType || data.jobType || 'Full-Time',
          salary: data.salary || data.salaryRange || (data.minSalary && data.maxSalary ? `₹${data.minSalary} - ₹${data.maxSalary} / month` : 'Competitive CTC'),
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          minExperience: parsedExp.minExperience,
          maxExperience: parsedExp.maxExperience,
          experience: parsedExp.experience,
          qualification: data.qualification || data.education || data.qualifications || 'Diploma / Graduate',
          education: data.education || data.qualification || data.qualifications || 'Diploma / Graduate',
          skills: data.skills || [],
          accessCode,
          status: data.status || 'Active',
          deadline: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDeadline || data.endDate || data.interviewDates || '',
          deadlineDate: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDeadline || data.endDate || data.interviewDates || '',
          isMock: Boolean(data.isMock)
        };
      });
      mergeJobs();
    }, (error) => {
      console.error('Error fetching interviews for matching:', error);
      setJobsLoading(false);
    });

    const qJobs = query(collection(db, 'jobs'));
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      activeJobsList = snapshot.docs.map((doc) => {
        const data = doc.data();
        const jobNo = data.jobNo ? String(data.jobNo).trim() : '';
        const accessCode = jobNo || data.accessCode || doc.id.slice(0, 6).toUpperCase();
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
        const parsedExp = parseExpMinMax(data);

        return {
          id: doc.id,
          jobNo,
          title: data.title || 'Untitled Job Role',
          company: data.company || data.companyName || 'Hiring Partner',
          recruiterName: resolvedEntryBy,
          entryBy: resolvedEntryBy,
          description: data.description || data.jobDescription || '',
          industrySector: data.industrySector || data.sector || data.industryName || data.industry || '',
          sector: data.sector || data.industrySector || data.industryName || '',
          department: data.department || data.roleCategory || data.category || 'General',
          departments: data.departments || [data.department || data.roleCategory || data.category || 'General'],
          roleCategory: data.roleCategory || data.roleName || '',
          location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : data.city || 'Nashik, Maharashtra'),
          city: data.city || data.location || 'Nashik',
          genderRequirement: data.genderRequirement || data.gender || data.genderPreference || 'Any',
          gender: data.gender || data.genderRequirement || 'Any',
          employmentType: data.employmentType || data.jobType || 'Full-Time',
          salary: data.salary || data.salaryRange || (data.minSalary && data.maxSalary ? `₹${data.minSalary} - ₹${data.maxSalary} / month` : 'Competitive CTC'),
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          minExperience: parsedExp.minExperience,
          maxExperience: parsedExp.maxExperience,
          experience: parsedExp.experience,
          qualification: data.qualification || data.education || data.qualifications || 'Diploma / Graduate',
          education: data.education || data.qualification || data.qualifications || 'Diploma / Graduate',
          skills: data.skills || [],
          accessCode,
          status: data.status || 'Active',
          deadline: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDeadline || data.endDate || data.interviewDates || '',
          deadlineDate: data.deadlineDate || data.deadline || data.applyDeadline || data.interviewDeadline || data.endDate || data.interviewDates || '',
          isMock: Boolean(data.isMock)
        };
      });
      mergeJobs();
    }, (error) => {
      console.warn('Jobs collection fetch note:', error);
    });

    return () => {
      unsubInterviews();
      unsubJobs();
    };
  }, []);

  // Compute matched jobs dynamically whenever submittedCandidateData changes
  const matchedJobsList: JobMatchResult[] = useMemo(() => {
    if (!submittedCandidateData || activeJobs.length === 0 || isCandidateBanned) return [];
    
    const results = activeJobs.map(job => calculateJobMatchScore(job, submittedCandidateData));
    
    // STRICT ELIGIBILITY: Filter out any job where candidate criteria is unmet (education qualification/specialization mismatch, experience mismatch, gender mismatch, etc.)
    const eligibleResults = results.filter(r => r.eduMatch.isMatch && r.expMatch.isMatch && r.genderMatch.isMatch && r.overallScore > 0);

    eligibleResults.sort((a, b) => b.overallScore - a.overallScore);

    if (matchFilter === 'EligibleOnly') {
      return eligibleResults;
    }
    if (matchFilter === 'HighMatch') {
      const high = eligibleResults.filter(r => r.overallScore >= 60);
      return high.length > 0 ? high : eligibleResults;
    }
    if (matchFilter === 'LocalCity' && submittedCandidateData.location) {
      const candCity = submittedCandidateData.location.toLowerCase();
      const local = eligibleResults.filter(r => 
        r.locationMatch.isMatch || 
        (r.job.location && r.job.location.toLowerCase().includes(candCity)) ||
        (r.job.city && r.job.city.toLowerCase().includes(candCity))
      );
      return local.length > 0 ? local : eligibleResults;
    }

    return eligibleResults;
  }, [submittedCandidateData, activeJobs, matchFilter]);

  // Combine domains: Domains present in active posted jobs appear FIRST, remaining domains follow afterwards
  const availableDomainsList = useMemo(() => {
    // 1. Find all active job departments/categories & matched domain names from active posted jobs
    const activeDeptsSet = new Set<string>();
    activeJobs.forEach(job => {
      const dept = (job.department || job.category || job.roleCategory || '').trim();
      if (dept && dept.toLowerCase() !== 'general') {
        activeDeptsSet.add(dept.toLowerCase());
      }
      if (job.title) {
        ALL_JOB_DOMAINS.forEach(d => {
          if (d.keywords.some(k => job.title.toLowerCase().includes(k))) {
            activeDeptsSet.add(d.name.toLowerCase());
          }
        });
      }
    });

    const activeDomainObjs: JobDomain[] = [];
    const addedSet = new Set<string>();

    // Add standard domains that have active posted jobs FIRST
    ALL_JOB_DOMAINS.forEach(d => {
      const nameLower = d.name.toLowerCase();
      const isPresentInJobs = activeDeptsSet.has(nameLower) || d.keywords.some(k => activeDeptsSet.has(k));
      if (isPresentInJobs) {
        activeDomainObjs.push(d);
        addedSet.add(nameLower);
      }
    });

    // Add any custom job departments present in active jobs that are not in standard domains
    activeJobs.forEach(job => {
      const dept = (job.department || job.category || job.roleCategory || '').trim();
      if (dept && dept.toLowerCase() !== 'general' && !addedSet.has(dept.toLowerCase())) {
        addedSet.add(dept.toLowerCase());
        activeDomainObjs.push({
          id: dept.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: dept,
          category: 'Active Job Roles',
          keywords: [dept.toLowerCase()]
        });
      }
    });

    // Add remaining standard domains AFTERWARDS
    const remainingDomainObjs: JobDomain[] = [];
    ALL_JOB_DOMAINS.forEach(d => {
      if (!addedSet.has(d.name.toLowerCase())) {
        remainingDomainObjs.push(d);
      }
    });

    return [...activeDomainObjs, ...remainingDomainObjs];
  }, [activeJobs]);

  const [isSavingCriteria, setIsSavingCriteria] = useState(false);

  const handleSaveUpdatedCriteriaToResumeDump = async () => {
    if (!submittedCandidateData) return;
    setIsSavingCriteria(true);
    try {
      const activeDoms = submittedCandidateData.domains || candidateDomains;
      const targetDomainStr = activeDoms.join(', ');

      const updatedProfile = {
        name: submittedCandidateData.name || candidateName || 'Job Seeker',
        email: (submittedCandidateData.email || candidateEmail).trim().toLowerCase(),
        phone: submittedCandidateData.phone || candidatePhone,
        gender: submittedCandidateData.gender || candidateGender,
        location: submittedCandidateData.location || candidateLocation,
        domains: activeDoms,
        preferredDomains: activeDoms,
        domain: targetDomainStr,
        experienceYears: submittedCandidateData.experience || 0,
        totalExperienceYears: submittedCandidateData.experience || 0,
        experience: submittedCandidateData.experience || 0,
        highestEducation: submittedCandidateData.education || submittedCandidateData.highestEducation || 'Graduate',
        education: [
          { degree: submittedCandidateData.education || submittedCandidateData.highestEducation || 'Graduate', institution: 'Candidate Specified', year: '' }
        ],
        skills: submittedCandidateData.skills || extractedSkills || [],
        employmentStatus: submittedCandidateData.employmentStatus || 'Working',
        employmentType: candidateEmploymentType,
        employmentTypes: candidateEmploymentTypes,
        noticePeriod: submittedCandidateData.noticePeriod || '30 Days',
        currentSalary: submittedCandidateData.currentSalary || 'As per industry',
        expectedSalary: submittedCandidateData.expectedSalary || 'As per industry',
        isPublicUpload: true,
        isPublicCandidate: true,
        isGlobalPublicCandidate: true,
      };

      await saveResumeDumpCandidate({
        recruiterUID: 'PUBLIC_JOB_SEEKER_POOL',
        teamId: 'TALENT_ROSTER',
        createdBy: {
          uid: 'PUBLIC_CANDIDATE',
          name: updatedProfile.name,
          email: updatedProfile.email,
          role: 'job_seeker'
        },
        profile: updatedProfile,
        resumeText: submittedCandidateData.resumeText || extraBioText || '',
        resumeUrl: submittedCandidateData.resumeUrl || 'https://via.placeholder.com/150',
        fileName: submittedCandidateData.fileName || 'resume.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        additionalText: extraBioText.trim(),
        source: 'public_job_seeker_upload'
      });

      // Update sessionStorage so state persists on page refresh
      sessionStorage.setItem('snab_hirex_candidate_submitted_data', JSON.stringify(submittedCandidateData));

      messageBox.showSuccess(`Updated domains (${targetDomainStr || 'Selected'}) & criteria saved to your profile and resume dump!`);
    } catch (err: any) {
      console.error("Save updated criteria error:", err);
      messageBox.showError("Failed to save updated criteria. Please try again.");
    } finally {
      setIsSavingCriteria(false);
    }
  };

  // Dynamic Live Criteria Updates
  const handleUpdateCandidateCriteria = (field: string, value: any) => {
    setSubmittedCandidateData(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };

      if (field === 'experience') {
        const numVal = parseFloat(value) || 0;
        updated.experience = numVal;
        updated.experienceYears = numVal;
        updated.totalExperienceYears = numVal;
      }
      if (field === 'education') {
        updated.highestEducation = value;
      }
      if (field === 'domains' || field === 'domain') {
        if (Array.isArray(value)) {
          updated.domains = value;
          updated.preferredDomains = value;
          updated.domain = value.join(', ');
        } else if (typeof value === 'string') {
          const list = value.split(', ').filter(Boolean);
          updated.domains = list;
          updated.preferredDomains = list;
          updated.domain = value;
        }
      }

      return updated;
    });
  };

  const handleAddSkillToResults = () => {
    const trimmed = resultSkillInput.trim();
    if (!trimmed || !submittedCandidateData) return;
    const currentSkills = submittedCandidateData.skills || [];
    if (currentSkills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      messageBox.showError(`"${trimmed}" is already added.`);
      return;
    }
    handleUpdateCandidateCriteria('skills', [...currentSkills, trimmed]);
    setResultSkillInput('');
    messageBox.showSuccess(`Added "${trimmed}" to skill criteria.`);
  };

  const handleRemoveSkillFromResults = (skillToRemove: string) => {
    if (!submittedCandidateData) return;
    const currentSkills = submittedCandidateData.skills || [];
    handleUpdateCandidateCriteria('skills', currentSkills.filter(s => s !== skillToRemove));
  };

  const handleResetToOriginalCriteria = () => {
    if (originalCandidateData) {
      setSubmittedCandidateData({ ...originalCandidateData });
      messageBox.showSuccess("Reset criteria to original resume profile.");
    }
  };

  // Handle file selection & fast local text analysis with email-first lookup
  const handleFileSelection = async (file: File) => {
    setSelectedFile(file);
    setIsParsingResume(true);
    try {
      // 1. Fast read raw text from resume (< 100ms)
      const rawResumeText = await readResumeText(file, file.name);
      if (!rawResumeText) throw new Error('No readable text was found in this resume.');

      // 2. Extract email immediately via regex to perform instant returning candidate check
      const rawEmailMatch = rawResumeText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      const cleanExtractedEmail = rawEmailMatch ? rawEmailMatch[1].trim().toLowerCase() : '';

      // 3. If email is already present in database (resume dump), load existing profile!
      if (cleanExtractedEmail) {
        try {
          let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanExtractedEmail), limit(1)));
          if (snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanExtractedEmail), limit(1)));
          }
          if (snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDump'), where('email', '==', cleanExtractedEmail), limit(1)));
          }
          if (!snap.empty) {
            const docData: any = snap.docs[0].data();
            const matchedCand: any = { id: snap.docs[0].id, ...(docData.profile || {}), ...docData };
            setCandidateEmail(cleanExtractedEmail);
            handleLoadExistingProfile(matchedCand);
            messageBox.showSuccess(`Welcome back, ${matchedCand.name || 'Job Seeker'}! We found your existing profile in database. Showing your best matched job openings.`);
            setIsParsingResume(false);
            return;
          }
        } catch (lookupErr) {
          console.warn("Fast email registration check error:", lookupErr);
        }
      }

      // 4. For new candidates, ONLY fetch skills from resume (nothing else fetched from resume)
      const ingested = await fastParseResumeFileLocally(file, {}, extraBioText);
      setParsedProfileData(ingested);

      if (ingested.profile) {
        // Only fetch skills from the resume as requested
        if (Array.isArray(ingested.profile.skills) && ingested.profile.skills.length > 0) {
          setExtractedSkills(ingested.profile.skills);
          messageBox.showSuccess(`Resume attached! Skills auto-detected from resume. Please fill in your personal details below.`);
        } else {
          messageBox.showSuccess("Resume attached. Please fill in your details below.");
        }
      }
    } catch (err: any) {
      console.error("Resume Local Parsing Error:", err);
      messageBox.showInfo("Resume attached. Please fill in your details below.");
    } finally {
      setIsParsingResume(false);
    }
  };

  // Handle Returning Candidate Profile Lookup by Email, Name, or Phone
  const handleLookupEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = lookupEmailInput.trim().toLowerCase();
    if (!cleanInput) {
      messageBox.showError("Please enter your name, email address, or phone number.");
      return;
    }

    setIsSearchingEmail(true);
    try {
      let matchedCand: any = null;

      // 1. Direct query if valid email format
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanInput)) {
        let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanInput)));
        if (snap.empty) {
          snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanInput)));
        }
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();
          matchedCand = { id: d.id, ...(data.profile || {}), ...data };
        }
      }

      // 2. Search across name, phone, or email substring
      if (!matchedCand) {
        const snapAll = await getDocs(query(collection(db, 'resumeDumpCandidates')));
        const cleanDigits = cleanInput.replace(/\D/g, '');

        for (const docSnap of snapAll.docs) {
          const data = docSnap.data();
          const prof = (data.profile && typeof data.profile === 'object') ? data.profile : {};
          const candEmail = String(data.email || prof.email || '').toLowerCase().trim();
          const candName = String(data.name || prof.name || '').toLowerCase().trim();
          const candPhone = String(data.phone || prof.phone || '').replace(/\D/g, '');

          if (candEmail === cleanInput || candEmail.includes(cleanInput)) {
            matchedCand = { id: docSnap.id, ...prof, ...data };
            break;
          }
          if (candName && (candName === cleanInput || candName.includes(cleanInput) || cleanInput.includes(candName))) {
            matchedCand = { id: docSnap.id, ...prof, ...data };
            break;
          }
          if (cleanDigits && cleanDigits.length >= 6 && candPhone.includes(cleanDigits)) {
            matchedCand = { id: docSnap.id, ...prof, ...data };
            break;
          }
        }
      }

      if (!matchedCand) {
        messageBox.showError(`No registered resume profile found for "${lookupEmailInput}". Please submit your resume below to get instant job recommendations.`);
        setIsSearchingEmail(false);
        return;
      }

      setShowEmailLookup(false);
      handleLoadExistingProfile(matchedCand);
    } catch (err: any) {
      console.error("Profile Lookup Error:", err);
      messageBox.showError("Failed to lookup profile. Please try again or fill out the form below.");
    } finally {
      setIsSearchingEmail(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    if (extractedSkills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      messageBox.showError(`"${trimmed}" is already added.`);
      return;
    }
    setExtractedSkills(prev => [...prev, trimmed]);
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setExtractedSkills(prev => prev.filter(s => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!candidateName.trim()) {
      messageBox.showError("Please enter your Full Name.");
      return;
    }
    const cleanSubmitEmail = candidateEmail.trim().toLowerCase();
    if (!cleanSubmitEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanSubmitEmail)) {
      messageBox.showError("Please enter a valid Email Address.");
      return;
    }

    // Check if candidate email is ALREADY REGISTERED - do not duplicate, show matched jobs directly!
    try {
      let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', cleanSubmitEmail)));
      if (snap.empty) {
        snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', cleanSubmitEmail)));
      }
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        const matchedCand: any = { id: d.id, ...(data.profile || {}), ...data };
        messageBox.showSuccess(`Welcome back, ${matchedCand.name || 'Job Seeker'}! We found your existing profile registered under ${cleanSubmitEmail}. Showing your best matched job openings.`);
        handleLoadExistingProfile(matchedCand);
        return;
      }
    } catch (lookupErr) {
      console.warn("Submit auto email lookup warning:", lookupErr);
    }

    if (!candidatePhone.trim()) {
      messageBox.showError("Please enter your Phone / WhatsApp Contact Number.");
      return;
    }
    if (!candidateGender.trim()) {
      messageBox.showError("Please select your Gender.");
      return;
    }
    if (!candidateLocation.trim()) {
      messageBox.showError("Please select or type your Location / Target City.");
      return;
    }
    if (!candidateExp.trim()) {
      messageBox.showError("Please enter your Experience in Years (Enter 0 if you are a Fresher).");
      return;
    }
    if (!candidateEducation.trim()) {
      messageBox.showError("Please select your Highest Education Qualification.");
      return;
    }
    if (!candidateEmploymentStatus.trim()) {
      messageBox.showError("Please select your Current Working / Employment Status.");
      return;
    }
    if (!candidateNoticePeriodVal.trim()) {
      messageBox.showError("Please enter your Notice Period.");
      return;
    }
    if (!candidateCurrentSalaryVal.trim()) {
      messageBox.showError("Please enter your Current Salary (Enter 0 if you are a Fresher).");
      return;
    }
    if (!candidateExpectedSalaryVal.trim()) {
      messageBox.showError("Please enter your Expected Salary.");
      return;
    }
    if (!selectedFile && !existingEmailCandidate) {
      messageBox.showError("Please attach your Resume file (PDF, DOCX, TXT).");
      return;
    }

    setIsSubmitting(true);
    try {
      let resumeUrl = existingEmailCandidate?.resumeUrl || '';
      if (selectedFile) {
        try {
          resumeUrl = await uploadToCloudinary(selectedFile);
        } catch (uploadErr) {
          console.warn("Cloudinary upload fallback to blob URL:", uploadErr);
          resumeUrl = URL.createObjectURL(selectedFile);
        }
      }

      const finalProfile = parsedProfileData?.profile ? { ...parsedProfileData.profile } : {};
      const finalResumeText = parsedProfileData?.resumeText || extraBioText || '';

      const targetDomainsList = candidateDomains.length > 0
        ? candidateDomains
        : detectDomainsFromText(`${candidateName} ${extractedSkills.join(' ')} ${finalResumeText}`);
      const targetDomainStr = targetDomainsList.join(', ');

      finalProfile.name = candidateName.trim();
      finalProfile.email = candidateEmail.trim().toLowerCase();
      finalProfile.phone = candidatePhone.trim();
      finalProfile.gender = candidateGender;
      finalProfile.maritalStatus = candidateMaritalStatus;
      finalProfile.location = candidateLocation.trim();
      finalProfile.domain = targetDomainStr;
      finalProfile.domains = targetDomainsList;
      finalProfile.preferredDomains = targetDomainsList;
      finalProfile.skills = extractedSkills;

      const expNum = parseFloat(candidateExp) || 0;
      finalProfile.experienceYears = expNum;
      finalProfile.totalExperienceYears = expNum;
      finalProfile.experience = expNum;

      finalProfile.employmentStatus = candidateEmploymentStatus;
      finalProfile.isWorking = candidateEmploymentStatus === 'Working' || candidateEmploymentStatus === 'Currently Working';
      finalProfile.noticePeriodVal = candidateNoticePeriodVal.trim();
      finalProfile.noticePeriodUnit = candidateNoticePeriodUnit;
      finalProfile.noticePeriod = `${candidateNoticePeriodVal.trim()} ${candidateNoticePeriodUnit}`;
      finalProfile.noticePeriodDays = candidateNoticePeriodUnit === 'Months'
        ? String(Math.round((parseFloat(candidateNoticePeriodVal) || 0) * 30))
        : candidateNoticePeriodVal.trim();

      const formattedCurrentSalary = getFormattedCurrentSalary();
      const formattedExpectedSalary = getFormattedExpectedSalary();
      finalProfile.currentSalary = formattedCurrentSalary;
      finalProfile.expectedSalary = formattedExpectedSalary;
      finalProfile.currentSalaryVal = candidateCurrentSalaryVal.trim();
      finalProfile.currentSalaryPeriod = candidateCurrentSalaryPeriod;
      finalProfile.currentSalaryType = candidateCurrentSalaryType;
      finalProfile.expectedSalaryVal = candidateExpectedSalaryVal.trim();
      finalProfile.expectedSalaryPeriod = candidateExpectedSalaryPeriod;
      finalProfile.expectedSalaryType = candidateExpectedSalaryType;
      finalProfile.employmentType = candidateEmploymentType;
      finalProfile.employmentTypes = candidateEmploymentTypes;

      const selectedDegree = candidateEducation.trim();
      const existingEdu = finalProfile.education || [];
      finalProfile.education = [
        { degree: selectedDegree, institution: 'Candidate Specified Qualification', year: '' },
        ...existingEdu.filter((e: any) => e.degree?.toLowerCase() !== selectedDegree.toLowerCase())
      ];

      finalProfile.isPublicUpload = true;
      finalProfile.isPublicCandidate = true;
      finalProfile.isGlobalPublicCandidate = true;

      await saveResumeDumpCandidate({
        recruiterUID: 'PUBLIC_JOB_SEEKER_POOL',
        teamId: 'TALENT_ROSTER',
        createdBy: {
          uid: 'PUBLIC_CANDIDATE',
          name: candidateName.trim(),
          email: candidateEmail.trim().toLowerCase(),
          role: 'job_seeker'
        },
        profile: finalProfile,
        resumeText: finalResumeText,
        resumeUrl: resumeUrl || 'https://via.placeholder.com/150',
        fileName: selectedFile ? selectedFile.name : (existingEmailCandidate?.fileName || 'resume.pdf'),
        mimeType: selectedFile ? selectedFile.type : 'application/pdf',
        fileSize: selectedFile ? selectedFile.size : 1024,
        additionalText: extraBioText.trim(),
        source: 'public_job_seeker_upload'
      });

      const formattedStatus = candidateEmploymentStatus === 'Working' ? 'Currently Working' : candidateEmploymentStatus;

      const profileMatchCandidate: CandidateMatchProfile = {
        name: candidateName.trim(),
        email: candidateEmail.trim().toLowerCase(),
        phone: candidatePhone.trim(),
        gender: candidateGender,
        maritalStatus: candidateMaritalStatus,
        location: candidateLocation.trim(),
        domain: targetDomainStr,
        domains: targetDomainsList,
        preferredDomains: targetDomainsList,
        experience: expNum,
        totalExperienceYears: expNum,
        education: selectedDegree,
        highestEducation: selectedDegree,
        employmentStatus: formattedStatus,
        employmentType: candidateEmploymentType,
        employmentTypes: candidateEmploymentTypes,
        noticePeriod: `${candidateNoticePeriodVal.trim()} ${candidateNoticePeriodUnit}`,
        currentSalary: formattedCurrentSalary,
        expectedSalary: formattedExpectedSalary,
        fileName: selectedFile ? selectedFile.name : (existingEmailCandidate?.fileName || 'resume.pdf'),
        skills: extractedSkills,
        resumeText: finalResumeText,
        resumeUrl
      };

      setSubmittedCandidateData(profileMatchCandidate);
      setOriginalCandidateData({ ...profileMatchCandidate });
      setIsSubmittedSuccess(true);
      messageBox.showSuccess("Your profile has been saved & matched with current job openings!");
    } catch (err: any) {
      console.error("Public Job Seeker Resume Upload Error:", err);
      messageBox.showError(err.message || "Failed to upload resume. Please check connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCandidateName('');
    setCandidateEmail('');
    setCandidatePhone('');
    setCandidateGender('');
    setCandidateMaritalStatus('');
    setCandidateLocation('');
    setCandidateExp('');
    setCandidateEducation('');
    setCandidateEmploymentStatus('Working');
    setCandidateEmploymentTypes(['Full-time — Work from Office / On-site']);
    setCandidateNoticePeriodVal('30');
    setCandidateNoticePeriodUnit('Days');
    setCandidateCurrentSalaryVal('');
    setCandidateCurrentSalaryPeriod('LPA');
    setCandidateCurrentSalaryType('CTC');
    setCandidateExpectedSalaryVal('');
    setCandidateExpectedSalaryPeriod('LPA');
    setCandidateExpectedSalaryType('CTC');
    setSelectedFile(null);
    setExtraBioText('');
    setExtractedSkills([]);
    setNewSkillInput('');
    setParsedProfileData(null);
    setIsSubmittedSuccess(false);
    setSubmittedCandidateData(null);
    setOriginalCandidateData(null);
    setExistingEmailCandidate(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans selection:bg-[#D4F82C] selection:text-[#111215] flex flex-col justify-between">
      {/* Sleek Responsive Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#E4E7DC] bg-[#F8F9F5]/95 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center group">
              <HireXLogo size="md" variant="full" />
            </Link>
            <div className="hidden sm:block border-l border-[#E4E7DC] pl-3">
              <span className="text-[11px] font-mono text-[#8FB305] font-bold block uppercase tracking-wider">Candidate Match Portal</span>
            </div>
          </div>

          {/* Desktop Right Nav Items */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowEmailLookup(!showEmailLookup)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#111215] shadow-xs hover:bg-[#F8F9F5] transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#73766C]" />
              <span>Lookup Profile</span>
            </button>

            <Link
              to="/candidate/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7DC] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#111215] shadow-xs hover:bg-[#F8F9F5] transition-colors"
            >
              <User className="w-3.5 h-3.5 text-[#73766C]" />
              <span>Candidate Login</span>
            </Link>

            <Link
              to="/active-jobs"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#111215] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#202227] transition-colors"
            >
              <span>View Openings</span>
              <span className="text-[#D4F82C]">↗</span>
            </Link>
          </div>

          {/* Mobile Right Controls: Hamburger Menu */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full border border-[#E4E7DC] bg-white text-[#111215]"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Collapsible Navigation Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E4E7DC] bg-white px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => {
                setShowEmailLookup(!showEmailLookup);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between text-xs font-semibold px-4 py-2.5 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#73766C]" />
                <span>Already Submitted Resume? (Lookup Profile)</span>
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <Link
              to="/candidate/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-between text-xs font-semibold px-4 py-2.5 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215]"
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#73766C]" />
                <span>Candidate Login</span>
              </span>
              <ChevronRight className="w-4 h-4" />
            </Link>

            <Link
              to="/active-jobs"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-between text-xs font-semibold px-4 py-2.5 rounded-2xl bg-[#111215] text-white"
            >
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#D4F82C]" />
                <span>Browse All Active Job Openings</span>
              </span>
              <span className="text-[#D4F82C]">↗</span>
            </Link>
          </div>
        )}
      </header>

      {/* Main Single-Page Responsive Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full flex-1">

        {/* Existing Submitted Candidate Email Lookup Modal Popup */}
        {showEmailLookup && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="border border-[#E4E7DC] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 relative bg-white text-[#111215]">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-[#E4E7DC] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center shrink-0 shadow-xs">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-[#111215]">
                      Find Submitted Profile
                    </h3>
                    <p className="text-xs text-[#575A51]">
                      Retrieve your saved candidate details and job recommendations.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEmailLookup(false)}
                  className="text-[#73766C] hover:text-[#111215] p-2 rounded-full hover:bg-[#F8F9F5] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body & Form */}
              <form onSubmit={handleLookupEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#111215]">
                    Registered Name, Email Address, or Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#73766C]" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={lookupEmailInput}
                      onChange={(e) => setLookupEmailInput(e.target.value)}
                      placeholder="e.g. Chinmay Upasani or yourname@gmail.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] placeholder-[#73766C] outline-none focus:border-[#111215] focus:bg-white font-medium transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-[#73766C] mt-1.5">
                    Enter the name, email address, or phone number you previously used to upload your resume.
                  </p>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E4E7DC]">
                  <button
                    type="button"
                    onClick={() => setShowEmailLookup(false)}
                    className="px-4 py-2.5 rounded-full font-semibold text-xs border border-[#E4E7DC] bg-white text-[#575A51] hover:bg-[#F8F9F5] hover:text-[#111215] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSearchingEmail || !lookupEmailInput.trim()}
                    className="px-5 py-2.5 rounded-full bg-[#111215] hover:bg-[#202227] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSearchingEmail ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Find My Profile</span>
                        <span className="text-[#D4F82C]">↗</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {!isSubmittedSuccess ? (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header Title */}
            <div className="text-center space-y-3 pt-2 sm:pt-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E7DC] bg-white px-3.5 py-1 text-xs font-semibold tracking-wider uppercase text-[#575A51] shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8FB305] animate-pulse" />
                <span>AI CANDIDATE MATCH • FAST-TRACK PROFILE</span>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#111215] leading-[1.08]">
                Upload Resume. <br className="hidden sm:inline" />
                <span className="italic font-serif font-normal text-[#575A51]">Instant Matches.</span> Zero Friction.
              </h1>
              <p className="text-xs sm:text-base max-w-2xl mx-auto text-[#575A51] leading-relaxed">
                Our AI resume parser extracts your skills, experience, location, and qualification fit, pre-fills your profile, and matches you against live hiring requisitions.
              </p>
            </div>

            {/* Existing Email Live Alert Banner inside Form */}
            {existingEmailCandidate && (
              <div className="p-4 sm:p-5 rounded-3xl bg-[#111215] text-white border border-[#E4E7DC] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#D4F82C]/20 text-[#D4F82C] flex items-center justify-center shrink-0 border border-[#D4F82C]/30">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-white block">Registered Candidate Profile Found</span>
                    <span className="text-xs text-[#E4E7DC]/80 block">
                      Welcome back, <strong>{existingEmailCandidate.name || existingEmailCandidate.email}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleLoadExistingProfile(existingEmailCandidate)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#D4F82C] hover:bg-[#c2e424] text-[#111215] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Profile & Show Matched Jobs</span>
                  <span>↗</span>
                </button>
              </div>
            )}

            {/* SINGLE-PAGE ALL-IN-ONE RESPONSIVE FORM */}
            <form
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-6"
            >
              {/* CARD BLOCK 1: RESUME FILE UPLOAD & SKILLS EXTRACTION */}
              <div className="rounded-3xl p-5 sm:p-7 border border-[#E4E7DC] bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E4E7DC] pb-3">
                  <label className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-[#111215]">
                    <Upload className="w-4 h-4 text-[#8FB305]" />
                    <span>1. Resume File & AI Skills Extraction <span className="text-rose-500">*</span></span>
                  </label>
                  {isParsingResume && (
                    <span className="text-xs text-[#8FB305] font-semibold flex items-center gap-1.5 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>AI Parsing...</span>
                    </span>
                  )}
                </div>

                <div
                  className={`relative flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer text-center ${
                    selectedFile
                      ? 'border-[#8FB305] bg-[#D4F82C]/10'
                      : 'border-[#E4E7DC] hover:border-[#111215] bg-[#F8F9F5] hover:bg-white'
                  }`}
                  onClick={() => document.getElementById('public-resume-input')?.click()}
                >
                  <input
                    id="public-resume-input"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelection(file);
                    }}
                  />
                  <div className="h-12 w-12 rounded-full flex items-center justify-center mb-2 bg-white text-[#111215] border border-[#E4E7DC] shadow-2xs">
                    {isParsingResume ? <RefreshCw className="w-5 h-5 animate-spin text-[#8FB305]" /> : <Upload className="w-5 h-5" />}
                  </div>

                  {selectedFile ? (
                    <div className="space-y-1">
                      <span className="font-bold text-xs sm:text-sm text-[#111215] block">
                        ✓ File Attached: {selectedFile.name}
                      </span>
                      <span className="text-xs text-[#73766C] block">
                        Size: {(selectedFile.size / 1024).toFixed(1)} KB (Skills auto-parsed below)
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="font-bold text-xs sm:text-sm text-[#111215] block">
                        Click or tap to upload resume file (PDF, DOCX, TXT)
                      </span>
                      <span className="text-xs text-[#73766C] block">
                        Auto-extracts skills, location, experience & qualification fit!
                      </span>
                    </div>
                  )}
                </div>

                {/* Auto-Fetched Skills Tags Roster */}
                {(extractedSkills.length > 0 || selectedFile) && (
                  <div className="p-4 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#8FB305]" />
                        <span className="font-bold text-xs uppercase tracking-wider text-[#111215]">
                          Extracted Technical Skills ({extractedSkills.length})
                        </span>
                      </div>
                      <span className="text-[11px] text-[#73766C]">
                        * Auto-extracted from your resume. Add or remove skills below.
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {extractedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-[#E4E7DC] bg-white text-[#111215] shadow-2xs"
                        >
                          <span>{skill}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            className="hover:text-rose-600 transition-colors ml-0.5 p-0.5 cursor-pointer text-[#73766C]"
                            title="Remove Skill"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newSkillInput}
                        onChange={(e) => setNewSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSkill();
                          }
                        }}
                        placeholder="Add key skill (e.g. React, Java, AutoCAD)..."
                        className="flex-1 px-3.5 py-2 rounded-full text-xs outline-none focus:border-[#111215] border border-[#E4E7DC] bg-white text-[#111215] placeholder-[#73766C]"
                      />
                      <button
                        type="button"
                        onClick={handleAddSkill}
                        className="px-4 py-2 rounded-full bg-[#111215] hover:bg-[#202227] text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD BLOCK 2: PERSONAL INFORMATION & CONTACT */}
              <div className="rounded-3xl p-5 sm:p-7 border border-[#E4E7DC] bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E4E7DC] pb-3 font-bold text-xs sm:text-sm uppercase tracking-wider text-[#111215]">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#8FB305]" />
                    <span>2. Personal Details & Contact</span>
                  </div>
                  <span className="text-[11px] text-rose-500 font-semibold">* Mandatory</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                      <input
                        type="text"
                        required
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white transition-all placeholder-[#73766C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                      <input
                        type="email"
                        required
                        value={candidateEmail}
                        onChange={(e) => {
                          setCandidateEmail(e.target.value);
                          handleCheckEmailExists(e.target.value);
                        }}
                        onBlur={(e) => handleCheckEmailExists(e.target.value)}
                        placeholder="e.g. rahul.sharma@example.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white transition-all placeholder-[#73766C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      WhatsApp Phone <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                      <input
                        type="tel"
                        required
                        value={candidatePhone}
                        onChange={(e) => setCandidatePhone(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white transition-all placeholder-[#73766C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['Male', 'Female', 'Other'].map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setCandidateGender(g)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            candidateGender === g
                              ? 'bg-[#111215] text-white border-[#111215] shadow-2xs'
                              : 'bg-[#F8F9F5] text-[#575A51] border-[#E4E7DC] hover:border-[#111215] hover:text-[#111215]'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Marital Status
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Single / Unmarried', 'Married'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCandidateMaritalStatus(m)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            candidateMaritalStatus === m
                              ? 'bg-[#111215] text-white border-[#111215] shadow-2xs'
                              : 'bg-[#F8F9F5] text-[#575A51] border-[#E4E7DC] hover:border-[#111215] hover:text-[#111215]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD BLOCK 3: TARGET LOCATION, EXPERIENCE & QUALIFICATION */}
              <div className="rounded-3xl p-5 sm:p-7 border border-[#E4E7DC] bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E4E7DC] pb-3 font-bold text-xs sm:text-sm uppercase tracking-wider text-[#111215]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#8FB305]" />
                    <span>3. Target Location & Qualification</span>
                  </div>
                  <span className="text-[11px] text-rose-500 font-semibold">* Mandatory</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Location / Target City <span className="text-rose-500">*</span>
                    </label>
                    <LocationCityInput
                      value={candidateLocation}
                      onChange={setCandidateLocation}
                      selectedState={candidateState}
                      onStateChange={setCandidateState}
                      placeholder="Search city (e.g. Nashik, Pune, Mumbai)..."
                      className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] p-2.5 text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white placeholder-[#73766C]"
                    />

                    {/* Quick Fast Feed City Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {['Nashik', 'Pune', 'Mumbai', 'Thane', 'Nagpur', 'Chhatrapati Sambhajinagar'].map(city => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setCandidateLocation(city);
                            setCandidateState('Maharashtra');
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                            candidateLocation.toLowerCase().includes(city.toLowerCase())
                              ? 'bg-[#111215] text-white border-[#111215] shadow-2xs'
                              : 'bg-white border-[#E4E7DC] text-[#575A51] hover:border-[#111215] hover:text-[#111215]'
                          }`}
                        >
                          <MapPin className="w-3 h-3 text-[#8FB305]" />
                          <span>{city}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Experience (Years) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="60"
                        required
                        value={candidateExp}
                        onChange={(e) => setCandidateExp(e.target.value)}
                        placeholder="e.g. 0 (Fresher) or 2.5 Yrs"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white transition-all placeholder-[#73766C]"
                      />
                    </div>
                    {/* Quick Experience Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {['0', '1', '2', '3', '5'].map(yr => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setCandidateExp(yr)}
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                            candidateExp === yr
                              ? 'bg-[#111215] text-white border-[#111215] shadow-2xs'
                              : 'bg-white border-[#E4E7DC] text-[#575A51] hover:border-[#111215] hover:text-[#111215]'
                          }`}
                        >
                          {yr === '0' ? 'Fresher' : `${yr} Yr`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Highest Education Qualification <span className="text-rose-500">*</span>
                    </label>
                    <EducationInput
                      value={candidateEducation}
                      onChange={setCandidateEducation}
                      placeholder="Select degree (B.Tech, Diploma, BCA)..."
                      className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] p-2.5 text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white placeholder-[#73766C]"
                    />
                  </div>
                </div>
              </div>

              {/* CARD BLOCK 4: EMPLOYMENT STATUS, NOTICE PERIOD & SALARY */}
              <div className="rounded-3xl p-5 sm:p-7 border border-[#E4E7DC] bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E4E7DC] pb-3 font-bold text-xs sm:text-sm uppercase tracking-wider text-[#111215]">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#8FB305]" />
                    <span>4. Employment Status, Notice Period & Salary</span>
                  </div>
                  <span className="text-[11px] text-rose-500 font-semibold">* Mandatory</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {/* 1. Working Status */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Working Status <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={candidateEmploymentStatus}
                      onChange={(e) => setCandidateEmploymentStatus(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white font-semibold cursor-pointer"
                    >
                      <option value="Working">Currently Working (Employed)</option>
                      <option value="Not Working">Not Working (Unemployed)</option>
                      <option value="Serving Notice">Serving Notice Period</option>
                    </select>
                  </div>

                  {/* 2. Notice Period */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Notice Period <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Clock className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                        <input
                          type="number"
                          min="0"
                          max="365"
                          required
                          value={candidateNoticePeriodVal}
                          onChange={(e) => setCandidateNoticePeriodVal(e.target.value)}
                          placeholder="30"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white placeholder-[#73766C]"
                        />
                      </div>
                      <select
                        value={candidateNoticePeriodUnit}
                        onChange={(e) => setCandidateNoticePeriodUnit(e.target.value as 'Days' | 'Months')}
                        className="px-3.5 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-bold text-[#111215] outline-none cursor-pointer"
                      >
                        <option value="Days">Days</option>
                        <option value="Months">Months</option>
                      </select>
                    </div>
                  </div>

                  {/* 3. Current Salary */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51]">
                        Current Salary <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-[#73766C]">(0 if Fresher)</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <IndianRupee className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                        <input
                          type="text"
                          required
                          value={candidateCurrentSalaryVal}
                          onChange={(e) => setCandidateCurrentSalaryVal(e.target.value)}
                          placeholder="e.g. 4.5 or 35,000"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white transition-all placeholder-[#73766C]"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={candidateCurrentSalaryPeriod}
                          onChange={(e) => setCandidateCurrentSalaryPeriod(e.target.value as any)}
                          className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-bold text-[#111215] outline-none cursor-pointer"
                          title="Salary Period"
                        >
                          <option value="Per Month">Per Month</option>
                          <option value="Per Year">Per Year</option>
                        </select>
                        <select
                          value={candidateCurrentSalaryType}
                          onChange={(e) => setCandidateCurrentSalaryType(e.target.value as any)}
                          className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-bold text-[#111215] outline-none cursor-pointer"
                          title="Salary Structure"
                        >
                          <option value="In-Hand">In-Hand</option>
                          <option value="CTC">CTC</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 4. Expected Salary */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51]">
                        Expected Salary <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-[#73766C]">Target Range</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <IndianRupee className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                        <input
                          type="text"
                          required
                          value={candidateExpectedSalaryVal}
                          onChange={(e) => setCandidateExpectedSalaryVal(e.target.value)}
                          placeholder="e.g. 6.5 or 50,000"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white transition-all placeholder-[#73766C]"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={candidateExpectedSalaryPeriod}
                          onChange={(e) => setCandidateExpectedSalaryPeriod(e.target.value as any)}
                          className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-bold text-[#111215] outline-none cursor-pointer"
                          title="Salary Period"
                        >
                          <option value="Per Month">Per Month</option>
                          <option value="Per Year">Per Year</option>
                        </select>
                        <select
                          value={candidateExpectedSalaryType}
                          onChange={(e) => setCandidateExpectedSalaryType(e.target.value as any)}
                          className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-bold text-[#111215] outline-none cursor-pointer"
                          title="Salary Structure"
                        >
                          <option value="In-Hand">In-Hand</option>
                          <option value="CTC">CTC</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 5. Employment Type Preferences */}
                  <div className="pt-0.5 md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1.5">
                      Employment Type Preferences <span className="text-rose-500">*</span>
                    </label>
                    <EmploymentTypeMultiSelect
                      values={candidateEmploymentTypes}
                      onChange={setCandidateEmploymentTypes}
                      variant="dropdown"
                    />
                  </div>
                </div>
              </div>

              {/* CARD BLOCK 5: NOTES & PREFERRED DOMAIN ROLES */}
              <div className="rounded-3xl p-5 sm:p-7 border border-[#E4E7DC] bg-white shadow-2xs space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51]">
                  5. Preferred Domain Roles & Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={extraBioText}
                  onChange={(e) => setExtraBioText(e.target.value)}
                  placeholder="Mention preferred job roles, expected CTC, or work availability..."
                  className="w-full p-3.5 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs sm:text-sm text-[#111215] outline-none focus:border-[#111215] focus:bg-white transition-all placeholder-[#73766C]"
                />
              </div>

              {/* Single Primary Action Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isParsingResume}
                className="w-full py-4 px-6 rounded-full bg-[#111215] hover:bg-[#202227] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Processing Profile & Matching Active Jobs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#D4F82C]" />
                    <span>Submit Resume & Get Matched Jobs</span>
                    <span className="text-[#D4F82C]">↗</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Post-Submission / Email Lookup Results View */
          <div className="space-y-6 sm:space-y-8 animate-in zoom-in-95 duration-300">
            {/* Compact Profile Matched Bar */}
            <div className="border border-[#E4E7DC] rounded-3xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 bg-white">
              <div className="flex items-center gap-3 truncate">
                <div className="h-10 w-10 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center shrink-0 font-bold text-sm shadow-2xs">
                  {submittedCandidateData?.name ? submittedCandidateData.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="truncate text-xs space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#8FB305]">
                      Profile Matched:
                    </span>
                    <span className="font-bold text-sm text-[#111215]">
                      {submittedCandidateData?.name}
                    </span>
                  </div>
                  <div className="text-[11px] flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#575A51]">
                      <MapPin className="w-3 h-3 text-[#8FB305]" />
                      <span>{submittedCandidateData?.location || 'Nashik'}</span>
                    </span>
                    <span className="text-[#E4E7DC]">•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#575A51]">
                      <Briefcase className="w-3 h-3 text-[#8FB305]" />
                      <span>{submittedCandidateData?.experience || 0} Yrs Exp</span>
                    </span>
                    <span className="text-[#E4E7DC]">•</span>
                    <span className="inline-flex items-center gap-1 font-bold text-[#111215]">
                      <GraduationCap className="w-3 h-3 text-[#8FB305]" />
                      <span>{submittedCandidateData?.highestEducation || 'Graduate'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowCriteriaEditor(true)}
                  className="px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 bg-[#111215] hover:bg-[#202227] text-white shadow-2xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#D4F82C]" />
                  <span>Edit Criteria</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 rounded-full font-bold text-xs border border-[#E4E7DC] bg-[#F8F9F5] hover:bg-white text-[#575A51] hover:text-[#111215] transition-all cursor-pointer"
                >
                  Change Resume
                </button>
              </div>
            </div>

            {/* Live Preferences Customizer Modal Popup */}
            {showCriteriaEditor && submittedCandidateData && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
                <div className="border border-[#E4E7DC] rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-xl space-y-5 relative max-h-[92vh] overflow-y-auto bg-white text-[#111215]">
                  {/* Modal Header */}
                  <div className="flex items-start justify-between border-b border-[#E4E7DC] pb-4 relative">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-[#D4F82C]/20 border border-[#8FB305]/30 text-[#111215] flex items-center justify-center shrink-0">
                        <SlidersHorizontal className="w-5 h-5 text-[#8FB305]" />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#111215]">
                          Customize Match Criteria Live
                        </h3>
                        <p className="text-xs text-[#73766C]">
                          Edit your target sectors, departments, location, experience, gender, and education to refresh matched jobs.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCriteriaEditor(false)}
                      className="text-[#73766C] hover:text-[#111215] p-2 rounded-xl hover:bg-[#F8F9F5] transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Location Selector */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#575A51] mb-1">
                        Target City / Location
                      </label>
                      <LocationCityInput
                        value={submittedCandidateData.location || ''}
                        onChange={(val) => handleUpdateCandidateCriteria('location', val)}
                        placeholder="e.g. Nashik, Pune, Mumbai..."
                        className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] p-2.5 text-xs text-[#111215] outline-none focus:border-[#111215] focus:bg-white font-semibold"
                      />
                    </div>

                    {/* Experience Selector */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#575A51] mb-1">
                        Experience (Years)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="60"
                        value={submittedCandidateData.experience || 0}
                        onChange={(e) => handleUpdateCandidateCriteria('experience', parseFloat(e.target.value) || 0)}
                        className="w-full p-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-semibold text-[#111215] outline-none focus:border-[#111215] focus:bg-white"
                      />
                    </div>

                    {/* Gender Selector */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#575A51] mb-1">
                        Gender
                      </label>
                      <select
                        value={submittedCandidateData.gender || 'Any'}
                        onChange={(e) => handleUpdateCandidateCriteria('gender', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-semibold text-[#111215] outline-none focus:border-[#111215] focus:bg-white cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Any">Prefer Not To Say / Any</option>
                      </select>
                    </div>

                    {/* Highest Qualification */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#575A51] mb-1">
                        Highest Education
                      </label>
                      <EducationInput
                        value={submittedCandidateData.highestEducation || submittedCandidateData.education || ''}
                        onChange={(val) => handleUpdateCandidateCriteria('education', val)}
                        placeholder="Select degree..."
                        className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] p-2.5 text-xs text-[#111215] outline-none focus:border-[#111215] focus:bg-white font-semibold"
                      />
                    </div>
                  </div>

                  {/* Quick City Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Nashik', 'Pune', 'Mumbai', 'Thane', 'Nagpur', 'Chhatrapati Sambhajinagar', 'Remote'].map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => handleUpdateCandidateCriteria('location', city)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                          (submittedCandidateData.location || '').toLowerCase().includes(city.toLowerCase())
                            ? 'bg-[#111215] text-white border-[#111215]'
                            : 'bg-[#F8F9F5] text-[#575A51] border-[#E4E7DC] hover:border-[#111215] hover:text-[#111215]'
                        }`}
                      >
                        <MapPin className="w-3 h-3 text-[#8FB305]" />
                        <span>{city}</span>
                      </button>
                    ))}
                  </div>

                  {/* Add Custom Skill Filter */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[#E4E7DC]">
                    <input
                      type="text"
                      value={resultSkillInput}
                      onChange={(e) => setResultSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkillToResults();
                        }
                      }}
                      placeholder="Add target skill (e.g. AutoCAD, Python, Java, Tally)..."
                      className="flex-1 px-3.5 py-2 rounded-full text-xs outline-none focus:border-[#111215] border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] placeholder-[#73766C]"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkillToResults}
                      className="px-4 py-2 rounded-full bg-[#111215] hover:bg-[#202227] text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Modal Action Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E4E7DC]">
                    <button
                      type="button"
                      disabled={isSavingCriteria}
                      onClick={handleSaveUpdatedCriteriaToResumeDump}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-[#F8F9F5] hover:bg-white text-[#575A51] hover:text-[#111215] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 border border-[#E4E7DC]"
                    >
                      {isSavingCriteria ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to Resume Dump...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save to Resume Dump</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCriteriaEditor(false)}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#111215] hover:bg-[#202227] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                    >
                      <span>Done & View Matches</span>
                      <span className="text-[#D4F82C]">↗</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recommended Jobs Header & Filter Tabs */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border shadow-2xs ${
                    isCandidateBanned
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-white border-[#E4E7DC] text-[#575A51]'
                  }`}>
                    {isCandidateBanned ? (
                      <>
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        <span>Access Restricted</span>
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#8FB305] animate-pulse" />
                        <span>AI MATCHED REQUISITIONS</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111215] flex items-center gap-2">
                    <span>{isCandidateBanned ? 'Account Banned' : 'Top Matched Openings'}</span>
                    {!isCandidateBanned && (
                      <span className="text-base font-normal text-[#73766C]">({matchedJobsList.length})</span>
                    )}
                  </h3>
                </div>

                {/* Segmented Filter Tabs */}
                {!isCandidateBanned && (
                  <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] shadow-2xs overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setMatchFilter('EligibleOnly')}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        matchFilter === 'EligibleOnly' 
                          ? 'bg-[#111215] text-white shadow-2xs' 
                          : 'text-[#575A51] hover:text-[#111215]'
                      }`}
                    >
                      Eligible
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFilter('HighMatch')}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        matchFilter === 'HighMatch' 
                          ? 'bg-[#111215] text-white shadow-2xs' 
                          : 'text-[#575A51] hover:text-[#111215]'
                      }`}
                    >
                      High Match (&ge; 75%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFilter('LocalCity')}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                        matchFilter === 'LocalCity' 
                          ? 'bg-[#111215] text-white shadow-2xs' 
                          : 'text-[#575A51] hover:text-[#111215]'
                      }`}
                    >
                      <MapPin className="w-3 h-3 text-[#8FB305]" />
                      <span>{submittedCandidateData?.location || 'Location'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFilter('All')}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        matchFilter === 'All' 
                          ? 'bg-[#111215] text-white shadow-2xs' 
                          : 'text-[#575A51] hover:text-[#111215]'
                      }`}
                    >
                      All ({matchedJobsList.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Jobs List Grid */}
            {jobsLoading ? (
              <div className="py-16 text-center space-y-3 rounded-3xl border border-[#E4E7DC] bg-white shadow-2xs">
                <RefreshCw className="w-7 h-7 animate-spin text-[#8FB305] mx-auto" />
                <p className="text-sm font-semibold text-[#575A51]">Scoring active job requisitions against your profile...</p>
              </div>
            ) : isCandidateBanned ? (
              <div className="py-12 px-6 text-center space-y-4 rounded-3xl border border-rose-200 bg-white shadow-2xs text-[#111215]">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-2xs">
                  <Ban className="w-8 h-8" strokeWidth={2.2} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl sm:text-2xl font-bold text-rose-600 tracking-tight">
                    Candidate Profile Suspended
                  </h4>
                  <p className="text-xs sm:text-sm text-[#575A51] max-w-md mx-auto leading-relaxed">
                    Your candidate profile, email, and contact number are restricted from submitting applications on this portal.
                  </p>
                </div>
              </div>
            ) : matchedJobsList.length === 0 ? (
              <div className="py-12 text-center space-y-3 rounded-3xl border border-[#E4E7DC] bg-white shadow-2xs px-4">
                <AlertCircle className="w-8 h-8 text-[#73766C] mx-auto" />
                <h4 className="text-base font-bold text-[#111215]">No Job Matches Found for this Filter</h4>
                <p className="text-xs text-[#73766C] max-w-xs mx-auto">
                  Switch filter to "All" or edit your preferences to view more openings.
                </p>
                <button
                  type="button"
                  onClick={() => setMatchFilter('All')}
                  className="px-5 py-2 rounded-full bg-[#111215] hover:bg-[#202227] text-white text-xs font-bold cursor-pointer transition-all"
                >
                  View All Openings
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {matchedJobsList.map((matchItem) => {
                  const { job, overallScore, matchGrade, skillMatch, locationMatch, genderMatch, expMatch, eduMatch, failReasons } = matchItem;
                  const isDisqualified = !expMatch.isMatch || !genderMatch.isMatch || overallScore === 0;

                  return (
                    <div
                      key={job.id}
                      className={`group relative flex flex-col justify-between rounded-3xl border border-[#E4E7DC] bg-white p-5 sm:p-7 transition-all duration-300 hover:border-[#111215] shadow-2xs ${
                        isDisqualified ? 'opacity-85' : ''
                      }`}
                    >
                      <div className="space-y-4">
                        {/* Top Header Badge Row */}
                        <div className="flex items-start justify-between gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-2xs flex items-center gap-1.5 ${
                            isDisqualified 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                              : 'bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30'
                          }`}>
                            {isDisqualified ? <Ban className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5 text-[#8FB305]" />}
                            <span>{overallScore}% Match • {matchGrade}</span>
                          </span>

                          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] text-[#575A51]">
                            Code: {job.accessCode}
                          </span>
                        </div>

                        {/* Title & Recruiter / Department */}
                        <div>
                          <h4 className="text-lg sm:text-xl font-bold tracking-tight line-clamp-1 text-[#111215] group-hover:text-[#8FB305] transition-colors">
                            {job.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs font-medium text-[#575A51] mt-1">
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-[#73766C]" />
                              <span>{job.entryBy || job.recruiterName || 'Recruiter'}</span>
                            </span>
                            <span className="text-[#E4E7DC] select-none">•</span>
                            <span className="font-semibold text-[#111215] inline-flex items-center gap-1">
                              <Briefcase className="w-3.5 h-3.5 text-[#8FB305]" />
                              <span>{job.department}</span>
                            </span>
                          </div>
                        </div>

                        {/* 3-Column Attribute Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                          {/* Location Badge */}
                          <div className={`p-2.5 rounded-2xl border text-[11px] flex items-center gap-2 ${
                            locationMatch.isMatch 
                              ? 'bg-[#F8F9F5] border-[#E4E7DC] text-[#111215] font-semibold'
                              : 'bg-amber-50 border-amber-200 text-amber-900 font-semibold'
                          }`}>
                            <MapPin className="w-3.5 h-3.5 text-[#8FB305] shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>

                          {/* Experience Badge */}
                          <div className={`p-2.5 rounded-2xl border text-[11px] flex items-center gap-2 ${
                            expMatch.isMatch 
                              ? 'bg-[#F8F9F5] border-[#E4E7DC] text-[#111215] font-semibold'
                              : 'bg-rose-50 border-rose-200 text-rose-800 font-semibold'
                          }`}>
                            {expMatch.isMatch ? (
                              <Briefcase className="w-3.5 h-3.5 text-[#8FB305] shrink-0" />
                            ) : (
                              <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            )}
                            <span className="truncate">
                              {expMatch.isMatch ? `Req: ${expMatch.requiredExp}` : `Min ${expMatch.requiredExp} Req`}
                            </span>
                          </div>

                          {/* Gender Badge */}
                          <div className={`p-2.5 rounded-2xl border text-[11px] flex items-center gap-2 ${
                            genderMatch.isMatch 
                              ? 'bg-[#F8F9F5] border-[#E4E7DC] text-[#111215] font-semibold'
                              : 'bg-rose-50 border-rose-200 text-rose-800 font-semibold'
                          }`}>
                            <User className="w-3.5 h-3.5 text-[#8FB305] shrink-0" />
                            <span className="truncate font-semibold">
                              {genderMatch.requiredGender === 'Any' ? 'Gender: Any' : `${genderMatch.requiredGender}`}
                            </span>
                          </div>
                        </div>

                        {/* Education Qualification */}
                        <div className="p-3 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-[11px] space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 text-[#73766C] font-bold text-[10px] uppercase tracking-wider">
                              <GraduationCap className="w-3.5 h-3.5 text-[#8FB305] shrink-0" />
                              <span>Required Qualification</span>
                            </div>
                            {eduMatch.isMatch ? (
                              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full border border-[#8FB305]/30 bg-[#D4F82C]/30 text-[#111215] shrink-0 inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Fit</span>
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 shrink-0">
                                Mismatch
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {(eduMatch.allOptions && eduMatch.allOptions.length > 0
                              ? eduMatch.allOptions
                              : splitEducationRequirements(job.qualification || job.education || 'Any Qualification')
                            ).map((option, idx, arr) => {
                              const isOptionMatched = eduMatch.matchedOptions?.includes(option) ||
                                (submittedCandidateData?.highestEducation && checkSingleRequirementMatch(submittedCandidateData.highestEducation, option));
                              
                              return (
                                <React.Fragment key={option + idx}>
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all inline-flex items-center gap-1 ${
                                    isOptionMatched
                                      ? 'bg-white border-[#8FB305] text-[#111215] font-bold shadow-2xs'
                                      : 'bg-white border-[#E4E7DC] text-[#73766C]'
                                  }`}>
                                    {isOptionMatched && <Check className="w-3 h-3 text-[#8FB305] stroke-[3]" />}
                                    <span>{option}</span>
                                  </span>
                                  {idx < arr.length - 1 && (
                                    <span className="text-[11px] font-bold text-[#E4E7DC] select-none px-0.5">
                                      •
                                    </span>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {/* Skills Display */}
                        {skillMatch.matchedSkills.length > 0 ? (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#575A51] uppercase tracking-wider">
                              <Tag className="w-3 h-3 text-[#8FB305]" />
                              <span>Matched Skills</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {skillMatch.matchedSkills.map(s => (
                                <span key={s} className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#8FB305]/30 bg-[#D4F82C]/20 text-[#111215] flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5 stroke-[3] text-[#8FB305]" />
                                  <span>{s}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : skillMatch.missingSkills.length > 0 && (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#73766C] uppercase tracking-wider">
                              <Tag className="w-3 h-3 text-[#73766C]" />
                              <span>Key Job Skills</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {skillMatch.missingSkills.slice(0, 3).map(s => (
                                <span key={s} className="px-2.5 py-0.5 rounded-full text-[10px] border border-[#E4E7DC] bg-[#F8F9F5] text-[#575A51] font-medium">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fail Reasons if strict criteria fail */}
                        {failReasons.length > 0 && (
                          <div className={`p-2.5 rounded-2xl border text-[11px] space-y-0.5 ${
                            isDisqualified 
                              ? 'bg-rose-50 border-rose-200 text-rose-900' 
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}>
                            <span className="font-semibold block flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{isDisqualificationReason(failReasons[0]) ? 'Reason: ' : 'Note: '} {failReasons[0]}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Footer */}
                      <div className="pt-4 border-t border-[#E4E7DC] flex items-center justify-between gap-2.5 mt-4">
                        <button
                          type="button"
                          onClick={() => setSelectedJobForModal(matchItem)}
                          className="flex-1 py-2.5 px-4 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] hover:bg-white"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#73766C]" />
                          <span>View Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenApplyModal(matchItem)}
                          disabled={isDisqualified}
                          className={`flex-1 py-2.5 px-4 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isDisqualified 
                              ? 'bg-[#F8F9F5] text-[#73766C] cursor-not-allowed border border-[#E4E7DC]' 
                              : 'bg-[#111215] hover:bg-[#202227] text-white shadow-sm'
                          }`}
                        >
                          <span>{isDisqualified ? 'Criteria Unmet' : 'Apply & Start'}</span>
                          {!isDisqualified && <span className="text-[#D4F82C]">↗</span>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Dialog for View Job Details */}
      {selectedJobForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="border border-[#E4E7DC] rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-xl space-y-5 relative max-h-[90vh] overflow-y-auto bg-white text-[#111215]">
            <button
              onClick={() => setSelectedJobForModal(null)}
              className="absolute right-4 top-4 text-[#73766C] hover:text-[#111215] p-2 rounded-xl hover:bg-[#F8F9F5] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Top Match Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30">
                  {selectedJobForModal.overallScore}% Match • {selectedJobForModal.matchGrade}
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] text-[#575A51]">
                  Code: {selectedJobForModal.job.accessCode}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#111215]">
                {selectedJobForModal.job.title}
              </h3>
              <p className="text-xs text-[#73766C] font-semibold">
                Posted by: {selectedJobForModal.job.recruiterName} • {selectedJobForModal.job.department}
              </p>
            </div>

            {/* Breakdown Highlights */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl text-xs border border-[#E4E7DC] bg-[#F8F9F5]">
              <div>
                <span className="text-[#73766C] block text-[11px]">Location</span>
                <strong className="block truncate text-[#111215]">{selectedJobForModal.job.location}</strong>
              </div>
              <div>
                <span className="text-[#73766C] block text-[11px]">Experience</span>
                <strong className="block truncate text-[#111215]">{selectedJobForModal.expMatch.requiredExp}</strong>
              </div>
              <div>
                <span className="text-[#73766C] block text-[11px]">Gender Req.</span>
                <strong className="block truncate text-[#111215]">{selectedJobForModal.genderMatch.requiredGender}</strong>
              </div>
            </div>

            {/* Strict Disqualification Warning */}
            {(!selectedJobForModal.expMatch.isMatch || !selectedJobForModal.genderMatch.isMatch) && (
              <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50 text-xs font-semibold space-y-1 text-rose-900">
                <div className="font-bold text-rose-700 flex items-center gap-1">
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>Not Recommended due to Criteria Mismatch</span>
                </div>
                <p className="text-[11px] text-rose-800">
                  {!selectedJobForModal.expMatch.isMatch && (
                    <span>Requires minimum <strong>{selectedJobForModal.expMatch.requiredExp}</strong> experience (Your experience is <strong>{selectedJobForModal.expMatch.candidateExp} Yrs</strong>). </span>
                  )}
                  {!selectedJobForModal.genderMatch.isMatch && (
                    <span>Requires <strong>{selectedJobForModal.genderMatch.requiredGender}</strong> (Candidate gender is <strong>{selectedJobForModal.genderMatch.candidateGender}</strong>).</span>
                  )}
                </p>
              </div>
            )}

            {/* Full Job Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#73766C]">Job Description & Responsibilities</h4>
                <ListenJDButton
                  title={selectedJobForModal.job.title}
                  description={selectedJobForModal.job.description || ''}
                  size="sm"
                />
              </div>
              <div className="p-4 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] max-h-56 overflow-y-auto text-xs text-[#575A51]">
                <FormattedJobDescription
                  description={selectedJobForModal.job.description}
                  className="max-w-full text-xs"
                />
              </div>
            </div>

            {/* Education & Qualification */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#73766C]">Qualification & Education Requirements</h4>
              <div className="p-3.5 rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#73766C] font-bold uppercase tracking-wider">Accepted Degrees / Trades:</span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    selectedJobForModal.eduMatch.isMatch
                      ? 'bg-[#D4F82C]/30 border-[#8FB305]/30 text-[#111215]'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {selectedJobForModal.eduMatch.isMatch ? '✓ Qualification Fits' : 'Mismatch'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(selectedJobForModal.eduMatch.allOptions && selectedJobForModal.eduMatch.allOptions.length > 0
                    ? selectedJobForModal.eduMatch.allOptions
                    : splitEducationRequirements(selectedJobForModal.job.qualification || selectedJobForModal.job.education || 'Any Qualification')
                  ).map((option, idx, arr) => {
                    const isOptionMatched = selectedJobForModal.eduMatch.matchedOptions?.includes(option) ||
                      (submittedCandidateData?.highestEducation && checkSingleRequirementMatch(submittedCandidateData.highestEducation, option));

                    return (
                      <React.Fragment key={option + idx}>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all inline-flex items-center gap-1 ${
                          isOptionMatched
                            ? 'bg-white border-[#8FB305] text-[#111215] font-bold shadow-2xs'
                            : 'bg-white border-[#E4E7DC] text-[#73766C]'
                        }`}>
                          {isOptionMatched && <Check className="w-3.5 h-3.5 text-[#8FB305] stroke-[3]" />}
                          <span>{option}</span>
                        </span>
                        {idx < arr.length - 1 && (
                          <span className="text-xs font-bold text-[#E4E7DC] select-none px-0.5">
                            •
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E4E7DC]">
              <button
                onClick={() => setSelectedJobForModal(null)}
                className="px-5 py-2.5 rounded-full border border-[#E4E7DC] font-bold text-xs text-[#575A51] hover:text-[#111215] bg-[#F8F9F5] hover:bg-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const match = selectedJobForModal;
                  setSelectedJobForModal(null);
                  handleOpenApplyModal(match);
                }}
                disabled={!selectedJobForModal.expMatch.isMatch || !selectedJobForModal.genderMatch.isMatch}
                className={`px-6 py-2.5 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  (!selectedJobForModal.expMatch.isMatch || !selectedJobForModal.genderMatch.isMatch)
                    ? 'bg-[#F8F9F5] text-[#73766C] cursor-not-allowed border border-[#E4E7DC]'
                    : 'bg-[#111215] hover:bg-[#202227] text-white shadow-sm'
                }`}
              >
                <span>{(!selectedJobForModal.expMatch.isMatch || !selectedJobForModal.genderMatch.isMatch) ? 'Criteria Unmet' : 'Apply & Start Interview'}</span>
                {(selectedJobForModal.expMatch.isMatch && selectedJobForModal.genderMatch.isMatch) && <span className="text-[#D4F82C]">↗</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply & Start Pre-Interview Confirmation Modal */}
      {applyingJobModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="border border-[#E4E7DC] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl space-y-5 relative bg-white text-[#111215]">
            <button
              onClick={() => setApplyingJobModal(null)}
              className="absolute right-4 top-4 text-[#73766C] hover:text-[#111215] p-2 rounded-xl hover:bg-[#F8F9F5] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F82C]/30 text-[#111215] text-[10px] font-bold uppercase tracking-wider border border-[#8FB305]/30">
                <Sparkles className="w-3.5 h-3.5 text-[#8FB305]" />
                <span>Job Application & Interview Entry</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#111215]">
                Apply for {applyingJobModal.job.title}
              </h3>
              <p className="text-xs text-[#73766C]">
                Confirm your details to register your application interest with the recruiter before starting your interview.
              </p>
            </div>

            <form onSubmit={handleConfirmApplicationAndStart} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                  <input
                    type="text"
                    required
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    placeholder="Enter your full name..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-semibold text-[#111215] outline-none focus:border-[#111215] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                  <input
                    type="email"
                    required
                    value={applyEmail}
                    onChange={(e) => setApplyEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-semibold text-[#111215] outline-none focus:border-[#111215] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#575A51] mb-1">
                  Mobile / WhatsApp Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-[#73766C]" />
                  <input
                    type="tel"
                    required
                    value={applyPhone}
                    onChange={(e) => setApplyPhone(e.target.value)}
                    placeholder="Enter mobile number..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs font-semibold text-[#111215] outline-none focus:border-[#111215] focus:bg-white"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-[11px] text-[#575A51] space-y-1">
                <span className="font-bold text-[#111215] block">✓ Direct Recruiter Notification</span>
                <p className="text-[10px] text-[#73766C]">
                  Your application will be marked in the hiring manager's portal.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyingJobModal(null)}
                  className="flex-1 py-2.5 rounded-full border border-[#E4E7DC] text-xs font-bold text-[#575A51] hover:text-[#111215] bg-[#F8F9F5] hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApplication}
                  className="flex-1 py-2.5 rounded-full bg-[#111215] hover:bg-[#202227] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingApplication ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Start</span>
                      <span className="text-[#D4F82C]">↗</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Signature hireX Footer ── */}
      <footer className="relative z-[95] w-full bg-[#F8F9F5] border-t border-[#E4E7DC] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-12 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12">
            <div>
              <div className="mb-3">
                <HireXLogo size="md" variant="full" />
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
              <div><Link to="/active-jobs" className="text-[#73766C] hover:text-[#111215]">Careers Desk</Link></div>
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
              InterviewXpert<span className="text-[#8FB305]">↗</span>
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
}

const isDisqualificationReason = (reason: string): boolean => {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return lower.includes('requires female') || lower.includes('requires male') || lower.includes('minimum') || lower.includes('disqualif');
};
