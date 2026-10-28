import React, { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SKILL_OPTIONS } from './Profile';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ExternalLink,
  Sparkles,
  Building2,
  Check,
  FileUp,
  FileText,
  Globe,
  UploadCloud,
  Briefcase,
  MapPin,
  IndianRupee,
  Layers,
  GraduationCap,
  Users,
  Plus,
  Trash2,
  X,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Wand2,
  ArrowRight,
  ShieldCheck,
  Clock,
  ChevronDown,
  Video,
  Mic
} from 'lucide-react';
import { DEFAULT_SCREENING_QUESTIONS, generateScreeningQuestionsFromJd, saveVoiceInterview } from '../services/voiceInterviewService';
import { LocationCityInput } from '../components/LocationCityInput';
import { EDUCATION_QUALIFICATIONS, EDUCATION_SPECIALIZATIONS, EducationQualification } from '../data/allEducationDegrees';
import { resolveStrictListedCity } from '../data/maharashtraCities';
import { detectSectorsFromText, detectDepartmentsFromText } from '../data/jobDomains';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';
import { getRateLimitReachedMessage, isRateLimitReached } from '../services/rateLimitService';
import { getCandidateIdentityKeys, isCandidateIdentityInSet, dedupeCandidatesByIdentity } from '../services/candidateIdentity';

import { sendInterviewInvitations } from '../services/brevoService';
import { sendBulkWhatsAppInvites } from '../services/waSenderService';
import { grokGenerateJson } from '../services/grokService';
import { parseJobDescriptionText, ParsedJdResult, compileCompanyProfile } from '../services/geminiService';
import {
  extractSkillSignals,
  ingestResumeFile,
  saveResumeDumpCandidate,
  scoreCandidateForRole as scoreCandidateForRoleAdvanced,
  type CandidateMatch,
  type ResumeDumpRecord,
} from '../services/resumeService';
import { parseCandidateDocument, parseBulkCandidateTextInput } from '../services/candidateFileParser';
import { logTeamActivity } from '../services/auditService';

// Setup PDF.js worker to enable PDF parsing
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <span className={`block animate-pulse rounded-[4px] bg-white/[0.12] ${className}`} aria-hidden="true" />
);

type ResumeDumpCandidate = ResumeDumpRecord;
type CandidateSuggestion = CandidateMatch;

const splitCommaList = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (!item) return '';
        if (typeof item === 'object') return item.degree || item.title || item.name || '';
        return String(item).trim();
      })
      .filter(Boolean);
  }
  if (typeof val === 'object') {
    return [val.degree || val.title || val.name || ''].filter(Boolean);
  }
  if (typeof val === 'string') return val.split(',').map((item) => item.trim()).filter(Boolean);
  return [String(val).trim()].filter(Boolean);
};

const normalizeSearchText = (value: string) => (
  value
    .toLowerCase()
    .replace(/\.js\b/g, 'js')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const uniqueByNormalized = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeSearchText(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const textContainsSkill = (text: string, skill: string) => {
  const normalizedText = ` ${normalizeSearchText(text)} `;
  const normalizedSkill = ` ${normalizeSearchText(skill)} `;
  return normalizedSkill.trim().length > 1 && normalizedText.includes(normalizedSkill);
};

export const isStandardFieldKey = (key: string): boolean => {
  const k = key.trim().toLowerCase();
  return (
    k === 'company name' ||
    k === 'company' ||
    k === 'client' ||
    k === 'client name' ||
    k === 'employer' ||
    k === 'organization' ||
    k === 'job no' ||
    k === 'job number' ||
    k === 'job code' ||
    k === 'req id' ||
    k === 'requisition' ||
    k === 'job title' ||
    k === 'title' ||
    k === 'role' ||
    k === 'designation' ||
    k === 'vacancy name' ||
    k === 'salary' ||
    k === 'salary range' ||
    k === 'ctc' ||
    k === 'compensation' ||
    k === 'experience' ||
    k === 'min experience' ||
    k === 'max experience' ||
    k === 'exp' ||
    k === 'location' ||
    k === 'city' ||
    k === 'job location' ||
    k === 'gender' ||
    k === 'gender requirement' ||
    k === 'qualification' ||
    k === 'qualifications' ||
    k === 'education' ||
    k === 'employment type' ||
    k === 'job type' ||
    k === 'description' ||
    k === 'job description' ||
    k === 'industry' ||
    k === 'sector' ||
    k === 'department'
  );
};

const fetchTextFromUrl = async (targetUrl: string): Promise<string> => {
  let cleanUrl = targetUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  let htmlText = '';

  try {
    const res = await fetch(cleanUrl);
    if (res.ok) {
      htmlText = await res.text();
    }
  } catch (err) {
    console.warn("Direct fetch failed (likely CORS), attempting proxy fetch...", err);
  }

  if (!htmlText) {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`
    ];

    for (const proxyUrl of proxies) {
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) {
          htmlText = await res.text();
          if (htmlText.length > 50) break;
        }
      } catch (proxyErr) {
        console.warn(`Proxy ${proxyUrl} failed:`, proxyErr);
      }
    }
  }

  if (!htmlText) {
    throw new Error("Unable to fetch webpage content directly due to browser CORS or security rules.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  const elementsToRemove = doc.querySelectorAll('script, style, noscript, iframe, svg, header, footer, nav');
  elementsToRemove.forEach((el) => el.remove());

  const rawText = doc.body?.textContent || doc.textContent || '';
  return rawText.replace(/\s+/g, ' ').trim();
};

export const CreateInterviewSkeleton = () => (
  <div className="-mx-4 -my-8 min-h-[calc(100dvh-3.5rem)] bg-[#000] text-white sm:-mx-6 lg:-mx-8">
    <header className="border-b border-white/[0.11]">
      <div className="px-4 py-5 sm:px-6 lg:px-7">
        <SkeletonBlock className="h-4 w-32 bg-white/[0.08]" />
        <SkeletonBlock className="mt-2 h-8 w-56" />
        <SkeletonBlock className="mt-2 h-4 w-[32rem] max-w-full bg-white/[0.08]" />
      </div>
    </header>

    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.42fr)_1px_minmax(0,1fr)]">
      <aside className="border-b border-white/[0.11] bg-[#020202] px-4 py-5 sm:px-6 lg:min-h-[calc(100dvh-8.5rem)] lg:border-b-0 lg:px-7">
        <SkeletonBlock className="h-4 w-20 bg-white/[0.08]" />
        <SkeletonBlock className="mt-2 h-6 w-64 max-w-full" />
        <SkeletonBlock className="mt-2 h-4 w-full bg-white/[0.08]" />
        <SkeletonBlock className="mt-1.5 h-4 w-4/5 bg-white/[0.08]" />
        <div className="mt-5 min-h-28 rounded-[6px] border border-dashed border-white/[0.18] bg-white/[0.025] px-4 py-4">
          <SkeletonBlock className="h-4 w-44" />
          <SkeletonBlock className="mt-2 h-3 w-64 max-w-full bg-white/[0.08]" />
          <SkeletonBlock className="mt-2 h-3 w-36 bg-white/[0.08]" />
        </div>
        <div className="mt-7 border-t border-white/[0.11] pt-5">
          <SkeletonBlock className="h-4 w-16 bg-white/[0.08]" />
          <div className="mt-3 divide-y divide-white/[0.11] border border-white/[0.11]">
            {[0, 1, 2].map((item) => (
              <div key={item} className="px-3 py-3">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="mt-2 h-3 w-44 bg-white/[0.08]" />
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="hidden bg-white/[0.11] lg:block" />

      <div className="min-w-0">
        {[0, 1, 2].map((section) => (
          <section key={section} className="border-b border-white/[0.11] px-4 py-5 sm:px-6 lg:px-7">
            <SkeletonBlock className="h-4 w-20 bg-white/[0.08]" />
            <SkeletonBlock className="mt-2 h-6 w-40" />
            <SkeletonBlock className="mt-2 h-4 w-[28rem] max-w-full bg-white/[0.08]" />
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <SkeletonBlock className="h-3 w-28 bg-white/[0.08]" />
                <SkeletonBlock className="mt-2 h-9 w-full" />
              </div>
              <div>
                <SkeletonBlock className="h-3 w-32 bg-white/[0.08]" />
                <SkeletonBlock className="mt-2 h-9 w-full" />
              </div>
              <div className="xl:col-span-2">
                <SkeletonBlock className="h-3 w-24 bg-white/[0.08]" />
                <SkeletonBlock className="mt-2 h-28 w-full" />
              </div>
            </div>
          </section>
        ))}
        <div className="sticky bottom-0 border-t border-white/[0.11] bg-[#000]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SkeletonBlock className="h-3 w-64 max-w-full bg-white/[0.08]" />
            <SkeletonBlock className="h-10 w-64 bg-white/[0.9]" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CreateInterview: React.FC = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { status: rateLimitStatus, loading: rateLimitLoading, refresh: refreshRateLimit } = useCompanyRateLimits();
  const interviewLimitReached = isRateLimitReached(rateLimitStatus, 'interviews');
  const [loading, setLoading] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [candidateEmails, setCandidateEmails] = useState<string[]>([]);
  const [candidateDataList, setCandidateDataList] = useState<{ email: string; phone: string; name?: string }[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentPhone, setCurrentPhone] = useState('');
  const [resumeDumpCandidates, setResumeDumpCandidates] = useState<ResumeDumpCandidate[]>([]);
  const [shortlistedCandidateIdentityKeys, setShortlistedCandidateIdentityKeys] = useState<Set<string>>(() => new Set());
  const [uploadedResumeCandidateIds, setUploadedResumeCandidateIds] = useState<string[]>([]);
  const [loadingResumeDumpCandidates, setLoadingResumeDumpCandidates] = useState(false);
  const [loadingShortlistedCandidates, setLoadingShortlistedCandidates] = useState(false);
  const [shortlistedCandidatesError, setShortlistedCandidatesError] = useState(false);
  const DEFAULT_FIRST_QUESTION = "Please tell us about your work experience. For each company, tell us your job title, what work you did every day, and your main responsibilities.";

  const [parsingJd, setParsingJd] = useState(false);
  const [jdImportMode, setJdImportMode] = useState<'upload' | 'paste' | 'url'>('upload');
  const [pastedJdText, setPastedJdText] = useState('');
  const [jdUrlInput, setJdUrlInput] = useState('');
  const [parsingResumes, setParsingResumes] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [manualQuestions, setManualQuestions] = useState<string[]>([DEFAULT_FIRST_QUESTION]);
  const [currentManualQuestion, setCurrentManualQuestion] = useState('');
  const [interviewMode, setInterviewMode] = useState<'video' | 'voice'>('video');
  const [voiceQuestions, setVoiceQuestions] = useState<string[]>(() => DEFAULT_SCREENING_QUESTIONS.map((q) => q.question));
  const [generatingVoiceQuestions, setGeneratingVoiceQuestions] = useState(false);
  interface CustomField { id: number; key: string; value: string; }
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [tempCustomField, setTempCustomField] = useState({ key: '', value: '' });

  const getDefaultDeadlineDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  };

  const [eduInput, setEduInput] = useState('');
  const [selectedQualForEdu, setSelectedQualForEdu] = useState<string>('Graduate');

  const [formData, setFormData] = useState({
    jobNo: '',
    title: '',
    companyName: '',
    description: '',
    department: '',
    employmentType: 'Full-time',
    minExperience: 0,
    maxExperience: 0,
    experience: 0,
    skills: '',
    education: '',
    location: '',
    city: '',
    companyDetails: '',
    jobLink: '',
    salaryRange: '',
    genderRequirement: 'Any',
    strictGenderMatch: false,
    strictLocationMatch: false,
    strictEducationMatch: false,
    strictExperienceMatch: false,
    deadline: getDefaultDeadlineDate(),
    numQuestions: 5,
    difficulty: 'Easy',
    strictness: 'Low',
  });

  const aiRecommendedSkills = useMemo(() => {
    const jobText = `${formData.title} ${formData.department} ${formData.description} ${formData.skills}`.toLowerCase();
    const detected = extractSkillSignals(jobText);

    const currentList = formData.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const combined = Array.from(new Set([...currentList, ...detected]));

    if (skillSearch.trim()) {
      const q = skillSearch.trim().toLowerCase();
      return combined.filter((s) => s.toLowerCase().includes(q));
    }

    return combined;
  }, [formData.title, formData.department, formData.description, formData.skills, skillSearch]);

  useEffect(() => {
    if (!user) {
      setResumeDumpCandidates([]);
      setLoadingResumeDumpCandidates(false);
      return;
    }

    setLoadingResumeDumpCandidates(true);
    const primaryUid = userProfile?.parentRecruiterId || (userProfile as any)?.primaryRecruiterUID || userProfile?.teamId || user.uid;
    const dumpBySource: Record<string, any[]> = {};
    const unsubs: (() => void)[] = [];

    const mapDocs = () => {
      const combined = new Map<string, any>();
      Object.values(dumpBySource).flat().forEach(d => combined.set(d.id, d));
      const list = Array.from(combined.values());
      setResumeDumpCandidates(dedupeCandidatesByIdentity(list, (candidate) => {
        const stamp = candidate.updatedAt || candidate.createdAt;
        if (stamp && typeof stamp === 'object' && 'toMillis' in stamp && typeof (stamp as { toMillis?: unknown }).toMillis === 'function') {
          return (stamp as { toMillis: () => number }).toMillis();
        }
        return 0;
      }));
      setLoadingResumeDumpCandidates(false);
    };

    const mapCandidateDoc = (candidateDoc: any) => {
      const data = candidateDoc.data();
      return {
        id: candidateDoc.id,
        recruiterUID: typeof data.recruiterUID === 'string' ? data.recruiterUID : user.uid,
        name: typeof data.name === 'string' ? data.name : '',
        email: typeof data.email === 'string' ? data.email : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        location: typeof data.location === 'string' ? data.location : '',
        currentTitle: typeof data.currentTitle === 'string' ? data.currentTitle : '',
        summary: typeof data.summary === 'string' ? data.summary : '',
        totalExperienceYears: typeof data.totalExperienceYears === 'number' ? data.totalExperienceYears : 0,
        skills: Array.isArray(data.skills) ? data.skills.filter((skill: unknown): skill is string => typeof skill === 'string' && skill.trim().length > 0) : [],
        experience: Array.isArray(data.experience) ? data.experience : [],
        education: Array.isArray(data.education) ? data.education : [],
        certifications: Array.isArray(data.certifications) ? data.certifications : [],
        languages: Array.isArray(data.languages) ? data.languages : [],
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
        linkedinUrl: typeof data.linkedinUrl === 'string' ? data.linkedinUrl : '',
        portfolioUrl: typeof data.portfolioUrl === 'string' ? data.portfolioUrl : '',
        parsingMethod: data.parsingMethod === 'hybrid' ? 'hybrid' : 'deterministic',
        parserVersion: typeof data.parserVersion === 'number' ? data.parserVersion : 1,
        resumeUrl: typeof data.resumeUrl === 'string' ? data.resumeUrl : '',
        resumeFileName: typeof data.resumeFileName === 'string' ? data.resumeFileName : '',
        resumeText: typeof data.resumeText === 'string' ? data.resumeText : '',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    };

    if (primaryUid) {
      unsubs.push(onSnapshot(query(collection(db, 'resumeDumpCandidates'), where('teamId', '==', primaryUid)), (snap) => {
        dumpBySource['team'] = snap.docs.map(mapCandidateDoc);
        mapDocs();
      }, () => setLoadingResumeDumpCandidates(false)));

      unsubs.push(onSnapshot(query(collection(db, 'resumeDumpCandidates'), where('recruiterUID', '==', primaryUid)), (snap) => {
        dumpBySource['primary'] = snap.docs.map(mapCandidateDoc);
        mapDocs();
      }, () => setLoadingResumeDumpCandidates(false)));
    }

    if (user.uid && user.uid !== primaryUid) {
      unsubs.push(onSnapshot(query(collection(db, 'resumeDumpCandidates'), where('recruiterUID', '==', user.uid)), (snap) => {
        dumpBySource['user'] = snap.docs.map(mapCandidateDoc);
        mapDocs();
      }, () => setLoadingResumeDumpCandidates(false)));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, userProfile]);

  useEffect(() => {
    if (!user) {
      setShortlistedCandidateIdentityKeys(new Set());
      setLoadingShortlistedCandidates(false);
      setShortlistedCandidatesError(false);
      return;
    }

    setLoadingShortlistedCandidates(true);
    setShortlistedCandidatesError(false);
    const primaryUid = userProfile?.parentRecruiterId || (userProfile as any)?.primaryRecruiterUID || userProfile?.teamId || user.uid;
    const shortlistedBySource: Record<string, any[]> = {};
    const unsubsShort: (() => void)[] = [];

    const syncShort = () => {
      const identityKeys = new Set<string>();
      Object.values(shortlistedBySource).flat().forEach((candidateInfo) => {
        getCandidateIdentityKeys(candidateInfo).forEach((key) => identityKeys.add(key));
      });
      setShortlistedCandidateIdentityKeys(identityKeys);
      setLoadingShortlistedCandidates(false);
    };

    if (primaryUid) {
      unsubsShort.push(onSnapshot(query(
        collectionGroup(db, 'attempts'),
        where('recruiterUID', '==', primaryUid),
        where('status', '==', 'Shortlist')
      ), (snap) => {
        shortlistedBySource['primary'] = snap.docs.map(d => d.data().candidateInfo);
        syncShort();
      }, (error) => {
        console.error('Failed to load primary shortlisted candidates:', error);
        setShortlistedCandidatesError(true);
        setLoadingShortlistedCandidates(false);
      }));
    }

    if (user.uid && user.uid !== primaryUid) {
      unsubsShort.push(onSnapshot(query(
        collectionGroup(db, 'attempts'),
        where('recruiterUID', '==', user.uid),
        where('status', '==', 'Shortlist')
      ), (snap) => {
        shortlistedBySource['user'] = snap.docs.map(d => d.data().candidateInfo);
        syncShort();
      }, (error) => {
        console.error('Failed to load user shortlisted candidates:', error);
        setShortlistedCandidatesError(true);
        setLoadingShortlistedCandidates(false);
      }));
    }

    return () => {
      unsubsShort.forEach((u) => u());
    };
  }, [user, userProfile]);

  const requiredSkillSignals = useMemo(() => {
    const explicitSkills = splitCommaList(formData.skills);
    const roleText = `${formData.title} ${formData.description} ${formData.skills}`;
    const detectedSkills = SKILL_OPTIONS.filter((skill) => textContainsSkill(roleText, skill));
    return uniqueByNormalized([...explicitSkills, ...detectedSkills, ...extractSkillSignals(roleText)]);
  }, [formData.description, formData.skills, formData.title]);

  const suggestedCandidates = useMemo(() => (
    shortlistedCandidatesError
      ? []
      : resumeDumpCandidates
      .filter((candidate) => !candidate.isHired && !candidate.doNotSuggest && !candidate.isBlocked && !candidate.isBanned)
      .filter((candidate) => !isCandidateIdentityInSet(candidate, shortlistedCandidateIdentityKeys))
      .map((candidate) => scoreCandidateForRoleAdvanced(candidate, {
        title: formData.title,
        description: formData.description,
        requiredSkills: requiredSkillSignals,
        minExperience: formData.minExperience,
        maxExperience: formData.maxExperience,
      }))
      .filter((candidate): candidate is CandidateSuggestion => Boolean(candidate))
      .sort((a, b) => b.matchScore - a.matchScore || b.matchedSkills.length - a.matchedSkills.length)
      .slice(0, 6)
  ), [formData.description, formData.maxExperience, formData.minExperience, formData.title, requiredSkillSignals, resumeDumpCandidates, shortlistedCandidateIdentityKeys, shortlistedCandidatesError]);

  const excludedShortlistedCandidateCount = useMemo(() => (
    resumeDumpCandidates.filter((candidate) => isCandidateIdentityInSet(candidate, shortlistedCandidateIdentityKeys)).length
  ), [resumeDumpCandidates, shortlistedCandidateIdentityKeys]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const val = type === 'checkbox' ? target.checked : value;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: ['experience', 'minExperience', 'maxExperience', 'numQuestions'].includes(name) ? Number(value) : val
      };
      if (name === 'minExperience') {
        updated.experience = Number(value);
      }
      return updated;
    });
  };

  const toggleSkill = (skill: string) => {
    const currentSkills = splitCommaList(formData.skills);

    let newSkills;
    if (currentSkills.includes(skill)) {
      newSkills = currentSkills.filter(s => s !== skill);
    } else {
      newSkills = [...currentSkills, skill];
    }
    setFormData({ ...formData, skills: newSkills.join(', ') });
  };

  const toggleEducation = (edu: string) => {
    const currentEducations = splitCommaList(formData.education);

    let newEducations;
    if (currentEducations.includes(edu)) {
      newEducations = currentEducations.filter(e => e !== edu);
    } else {
      newEducations = [...currentEducations, edu];
    }
    setFormData({ ...formData, education: newEducations.join(', ') });
  };

  const handleAddManualQuestion = () => {
    if (currentManualQuestion.trim()) {
      setManualQuestions([...manualQuestions, currentManualQuestion.trim()]);
      setCurrentManualQuestion('');
    }
  };

  const handleRemoveManualQuestion = (index: number) => {
    setManualQuestions(manualQuestions.filter((_, i) => i !== index));
  };

  const handleAddCustomField = () => {
    const k = tempCustomField.key.trim().toLowerCase();
    if (k === 'company name' || k === 'company' || k === 'client' || k === 'client name' || k === 'employer' || k === 'organization') {
      setFormData(prev => ({ ...prev, companyName: tempCustomField.value.trim() }));
      setTempCustomField({ key: '', value: '' });
      return;
    }
    if (tempCustomField.key.trim() && tempCustomField.value.trim()) {
      setCustomFields([...customFields, { ...tempCustomField, id: Date.now() }]);
      setTempCustomField({ key: '', value: '' });
    }
  };

  const handleRemoveCustomField = (id: number) => {
    setCustomFields(customFields.filter(field => field.id !== id));
  };

  const addCandidateEntry = (emailInput: string = '', phoneInput: string = '', nameInput: string = '') => {
    const email = emailInput.trim().toLowerCase();
    const phone = phoneInput.trim();

    if (!email && !phone) {
      alert('Please enter at least a Candidate Email address or a WhatsApp Phone number.');
      return;
    }

    setCandidateDataList((prev) => {
      const existingIndex = prev.findIndex(
        (c) => (email && c.email.toLowerCase() === email) || (phone && c.phone === phone)
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          email: email || updated[existingIndex].email,
          phone: phone || updated[existingIndex].phone,
          name: nameInput || updated[existingIndex].name
        };
        return updated;
      }

      return [...prev, { email, phone, name: nameInput }];
    });

    if (email) {
      setCandidateEmails((prev) => {
        if (prev.some((e) => e.toLowerCase() === email)) return prev;
        return [...prev, email];
      });
    }
  };

  const handleAddCandidate = () => {
    if (currentEmail || currentPhone) {
      addCandidateEntry(currentEmail, currentPhone);
      setCurrentEmail('');
      setCurrentPhone('');
    }
  };

  const handleRemoveCandidate = (indexToRemove: number) => {
    const candidate = candidateDataList[indexToRemove];
    if (candidate) {
      if (candidate.email) {
        setCandidateEmails((prev) => prev.filter((e) => e.toLowerCase() !== candidate.email.toLowerCase()));
      }
      setCandidateDataList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    }
  };

  const handleApplyParsedJdData = (parsed: ParsedJdResult) => {
    let extractedCompanyInfo = parsed.companyProfile || '';
    let extractedCompanyName = (parsed as any).companyName || (parsed as any).company || '';
    let extractedJobNo = parsed.jobNo || '';
    const remainingCustomFields: { key: string; value: string }[] = [];

    const companyProfileKeys = [
      'company profile', 'company overview', 'company detail', 'about company',
      'establishment year', 'established', 'est year', 'est. year',
      'type of company', 'company type', 'number of people working', 'employee count',
      'employees', 'headcount', 'number of offices/factories', 'no. of offices/factories',
      'number of offices', 'number of factories', 'factories', 'office locations',
      'factory locations', 'turnover', 'annual turnover', 'company product / service',
      'company product', 'company service', 'product / service'
    ];

    if (parsed.customFields && Array.isArray(parsed.customFields)) {
      parsed.customFields.forEach(cf => {
        const keyLower = cf.key.trim().toLowerCase();
        if (
          keyLower === 'company name' ||
          keyLower === 'company' ||
          keyLower === 'client name' ||
          keyLower === 'client' ||
          keyLower === 'employer' ||
          keyLower === 'organization'
        ) {
          if (!extractedCompanyName) extractedCompanyName = cf.value.trim();
        } else if (
          keyLower.includes('job no') ||
          keyLower.includes('job number') ||
          keyLower.includes('job code') ||
          keyLower.includes('req id') ||
          keyLower.includes('requisition')
        ) {
          if (!extractedJobNo) extractedJobNo = cf.value.trim();
        } else if (companyProfileKeys.some(k => keyLower.includes(k))) {
          // Handled by compileCompanyProfile
        } else if (isStandardFieldKey(keyLower)) {
          // Do not add recognized standard fields into custom fields
        } else {
          remainingCustomFields.push(cf);
        }
      });
    }

    const compiledProfile = compileCompanyProfile(parsed, parsed.customFields || []);

    const fullJdText = `${parsed.title || ''} ${parsed.description || ''} ${parsed.skills || ''} ${parsed.qualification || ''} ${parsed.location || ''} ${parsed.gender || ''}`.toLowerCase();
    const hasMandatoryKeyword = /\b(mandatory|compulsory|must have|strictly|strict|non-negotiable|only|required)\b/i.test(fullJdText);

    const autoStrictGender = parsed.strictGenderMatch ?? (
      (parsed.gender && !['any', 'no preference', 'both', 'all'].includes(parsed.gender.toLowerCase())) &&
      (hasMandatoryKeyword || /\b(male only|female only|male candidate|female candidate|gender.*mandatory)\b/i.test(fullJdText))
    );

    const autoStrictLocation = parsed.strictLocationMatch ?? (
      Boolean(parsed.location || parsed.city) &&
      (hasMandatoryKeyword || /\b(local candidates? only|location.*mandatory|based in.*only|must be from)\b/i.test(fullJdText))
    );

    const autoStrictEdu = parsed.strictEducationMatch ?? (
      Boolean(parsed.qualification || parsed.education) &&
      (hasMandatoryKeyword || /\b(education.*mandatory|qualification.*mandatory|degree required)\b/i.test(fullJdText))
    );

    const autoStrictExp = parsed.strictExperienceMatch ?? (
      (Number(parsed.minExperience) > 0 || Number(parsed.maxExperience) > 0) &&
      (hasMandatoryKeyword || /\b(experience.*mandatory|exp.*mandatory|min.*yrs required)\b/i.test(fullJdText))
    );

    const rawLocCandidate = `${parsed.location || ''} ${parsed.city || ''} ${parsed.state || ''} ${fullJdText}`;
    const resolvedStrictCity = resolveStrictListedCity(rawLocCandidate);

    const jdTextToScan = `${parsed.title || ''} ${parsed.description || ''} ${parsed.skills || ''} ${fullJdText}`;
    const autoSecs = detectSectorsFromText(jdTextToScan);
    const autoDepts = detectDepartmentsFromText(jdTextToScan);

    setFormData(prev => ({
      ...prev,
      jobNo: extractedJobNo || prev.jobNo || '',
      title: parsed.title || parsed.vacancyName || parsed.designation || prev.title,
      companyName: extractedCompanyName || prev.companyName || '',
      description: parsed.description || prev.description,
      sector: autoSecs[0] || (parsed as any).sector || (prev as any).sector || '',
      department: autoDepts[0] || parsed.department || parsed.industry || parsed.roleCategory || prev.department,
      employmentType: parsed.employmentType ? (
        parsed.employmentType.toLowerCase().includes('part') ? 'Part-time' :
        parsed.employmentType.toLowerCase().includes('contract') ? 'Contract' :
        parsed.employmentType.toLowerCase().includes('intern') ? 'Internship' : 'Full-time'
      ) : (prev.employmentType || 'Full-time'),
      minExperience: parsed.minExperience !== undefined ? Number(parsed.minExperience) : prev.minExperience,
      maxExperience: parsed.maxExperience !== undefined ? Number(parsed.maxExperience) : prev.maxExperience,
      experience: parsed.minExperience !== undefined ? Number(parsed.minExperience) : prev.experience,
      skills: parsed.skills || (parsed.technicalSkills && parsed.softSkills ? `${parsed.technicalSkills}, ${parsed.softSkills}` : prev.skills),
      // Minimum education level is strictly selected manually by selectors only (do not auto-fill from JD)
      education: prev.education,
      salaryRange: parsed.salaryRange || (parsed.minSalary && parsed.maxSalary ? `${parsed.minSalary} - ${parsed.maxSalary}` : (prev as any).salaryRange || ''),
      location: resolvedStrictCity || prev.location || '',
      city: resolvedStrictCity || prev.city || '',
      companyDetails: compiledProfile || extractedCompanyInfo || prev.companyDetails || '',
      genderRequirement: parsed.gender || (prev as any).genderRequirement || 'Any',
      strictGenderMatch: false,
      strictLocationMatch: false,
      strictEducationMatch: false,
      strictExperienceMatch: false,
    }));

    if (remainingCustomFields.length > 0) {
      const newFields = remainingCustomFields.map((cf, idx) => ({
        id: Date.now() + idx,
        key: cf.key.trim(),
        value: cf.value.trim()
      }));

      setCustomFields(prev => {
        const existingKeys = new Set(prev.map(f => f.key.toLowerCase()));
        const filteredNew = newFields.filter(f => !existingKeys.has(f.key.toLowerCase()));
        return [...prev, ...filteredNew];
      });
    }
  };

  const handleFetchAndParseJdFromUrl = async () => {
    let targetUrl = jdUrlInput.trim();
    if (!targetUrl) {
      alert('Please enter or paste a Job Description web link (URL) first.');
      return;
    }

    setParsingJd(true);
    try {
      const fetchedText = await fetchTextFromUrl(targetUrl);
      if (!fetchedText || fetchedText.length < 30) {
        throw new Error("Could not extract readable text content from the URL webpage.");
      }

      const fullUrl = targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl;
      setFormData(prev => ({ ...prev, jobLink: prev.jobLink || fullUrl }));

      const parsedData = await parseJobDescriptionText(fetchedText);
      handleApplyParsedJdData(parsedData);
      alert('✅ Job description webpage fetched & parsed! All standard details & dynamic fields auto-filled.');
    } catch (error: any) {
      console.error('Error fetching/parsing JD from URL:', error);
      alert(`❌ Could not fetch JD from URL: ${error.message || 'CORS or website restriction'}. You can paste the JD text directly in the "Paste Text" tab.`);
    } finally {
      setParsingJd(false);
    }
  };

  const handleParsePastedJDText = async () => {
    if (!pastedJdText.trim()) {
      alert('Please paste some Job Description text first.');
      return;
    }

    setParsingJd(true);
    try {
      const parsedData = await parseJobDescriptionText(pastedJdText.trim());
      handleApplyParsedJdData(parsedData);
      alert('✅ Job description parsed! All standard details & dynamic custom fields auto-filled.');
    } catch (error: any) {
      console.error('Error parsing pasted JD:', error);
      alert(`❌ Failed to parse pasted JD text: ${error.message || 'AI parsing error'}`);
    } finally {
      setParsingJd(false);
    }
  };

  const handleJDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingJd(true);
    let text = '';
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map((item: any) => item.str).join(' ');
        }
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        alert('Unsupported file type. Please upload a PDF or TXT file.');
        setParsingJd(false);
        return;
      }

      if (!text.trim()) {
        alert('Could not extract text from the document.');
        setParsingJd(false);
        return;
      }

      const parsedData = await parseJobDescriptionText(text);
      handleApplyParsedJdData(parsedData);
      alert('✅ Job description document parsed! All standard details & dynamic custom fields auto-filled.');
    } catch (error) {
      console.error('Error parsing JD:', error);
      alert('❌ Failed to parse job description document. Please fill the form manually.');
    } finally {
      setParsingJd(false);
      e.target.value = '';
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!user || files.length === 0) return;

    setParsingResumes(true);
    let spreadsheetCandidates: { email: string; phone: string; name?: string }[] = [];

    const results = await Promise.all(files.map(async (file) => {
      try {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
          const parsed = await parseCandidateDocument(file);
          parsed.forEach(c => {
            if (c.email || c.phone) {
              spreadsheetCandidates.push({
                email: c.email.toLowerCase(),
                phone: c.phone || 'N/A',
                name: c.name
              });
            }
          });
          return { candidateId: '', email: '', phone: '', name: '', fileName: file.name, ok: true };
        }

        const ingested = await ingestResumeFile(file);
        const candidateId = await saveResumeDumpCandidate({
          recruiterUID: user.uid,
          profile: ingested.profile,
          resumeText: ingested.resumeText,
          resumeUrl: ingested.resumeUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          source: 'interview_creation',
          sourceJobTitle: formData.title,
        });
        return { 
          candidateId, 
          email: ingested.profile.email, 
          phone: ingested.profile.phone || '', 
          name: ingested.profile.name || '', 
          fileName: file.name, 
          ok: true 
        };
      } catch (error) {
        console.error(`Error ingesting ${file.name}:`, error);
        return { candidateId: '', email: '', phone: '', name: '', fileName: file.name, ok: false };
      }
    }));

    const newEmailsFound = uniqueByNormalized([
      ...results.map((result) => result.email).filter(Boolean),
      ...spreadsheetCandidates.map((c) => c.email).filter(Boolean)
    ]);
    const savedCandidateIds = results.map((result) => result.candidateId).filter(Boolean);
    setUploadedResumeCandidateIds((current) => Array.from(new Set([...current, ...savedCandidateIds])));
    const filesProcessed = results.filter((result) => result.ok).length;
    const filesWithErrors = results.length - filesProcessed;

    // Collect candidate metadata (email, phone, name)
    const validCandidates = [
      ...results.filter((r) => r.ok && r.email).map((r) => ({
        email: r.email,
        phone: r.phone,
        name: r.name,
      })),
      ...spreadsheetCandidates
    ];

    if (validCandidates.length > 0) {
      setCandidateDataList((prev) => {
        const map = new Map(prev.map((c) => [c.email.toLowerCase(), c]));
        validCandidates.forEach((c) => map.set(c.email.toLowerCase(), c));
        return Array.from(map.values());
      });
    }

    if (newEmailsFound.length > 0) {
      setCandidateEmails((prev) => {
        const existingEmails = new Set(prev.map((email) => email.toLowerCase()));
        const uniqueNewEmails = newEmailsFound.filter((email) => !existingEmails.has(email.toLowerCase()));
        return [...prev, ...uniqueNewEmails];
      });
    }
    alert(`Saved ${filesProcessed} resume${filesProcessed === 1 ? '' : 's'} to Resume Dump and added ${newEmailsFound.length} new email${newEmailsFound.length === 1 ? '' : 's'} to invitations.${filesWithErrors > 0 ? ` ${filesWithErrors} file(s) could not be processed.` : ''}`);
    setParsingResumes(false);
    e.target.value = ''; // Reset file input to allow re-uploading the same file
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const latestRateLimit = await refreshRateLimit();
    if (!latestRateLimit) {
      alert('Unable to verify the company interview limit. Please try again.');
      return;
    }
    if (isRateLimitReached(latestRateLimit, 'interviews')) {
      alert(getRateLimitReachedMessage('interviews'));
      return;
    }

    if (formData.maxExperience < formData.minExperience) {
      alert("❌ Maximum experience cannot be less than minimum experience.");
      return;
    }

    const cleanVoiceQuestions = voiceQuestions.map((q) => q.trim()).filter(Boolean);
    if (!cleanVoiceQuestions.length) {
      alert("❌ Add at least one interview question or click 'Generate from JD'.");
      return;
    }

    setLoading(true);

    try {
      // 1. Generate Job ID, Link, and Access Code locally
      const newRand = Math.random().toString(36).substring(2, 15);
      const newInterviewLink = `${window.location.origin}/interview/video/${newRand}`;
      const newAccessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 2. Save to Firestore
      const teamId = userProfile?.teamId || userProfile?.parentRecruiterId || user.uid;
      const creatorInfo = {
        uid: user.uid,
        name: userProfile?.name || user.email || 'Recruiter',
        email: user.email || '',
        role: userProfile?.role || 'recruiter',
        designation: userProfile?.designation || 'Recruiter'
      };

      const expFormatted = (formData.maxExperience > formData.minExperience) 
        ? `${formData.minExperience} - ${formData.maxExperience} Years` 
        : (formData.minExperience > 0 ? `${formData.minExperience} Years` : '0 - 2 Years');

      await setDoc(doc(db, 'interviews', newRand), {
        ...formData,
        companyName: formData.companyName || '',
        company: formData.companyName || '',
        status: (formData as any).status || 'Active',
        isActive: true,
        experience: expFormatted,
        manualQuestions,
        customFields,
        candidateEmails,
        candidateData: candidateDataList,
        interviewLink: newInterviewLink,
        accessCode: newAccessCode,
        recruiterUID: user.uid,
        teamId,
        createdBy: creatorInfo,
        createdAt: serverTimestamp(),
        isMock: false,
        interviewMode: 'video',
        isAiVideoInterview: true,
      });

      // Unified AI interview questions (saved for conversational AI interviewer and assessment)
      await saveVoiceInterview({
        id: newRand,
        jobId: newRand,
        interviewId: newRand,
        title: formData.title,
        jobTitle: formData.title,
        jobDescription: formData.description,
        companyName: formData.companyName || '',
        location: formData.location || formData.city || '',
        recruiterUID: user.uid,
        teamId,
        questions: cleanVoiceQuestions.map((question, i) => ({ id: `q_${i}`, question, category: 'skills' })),
        status: 'active',
        createdAt: serverTimestamp(),
      });

      // Also mirror to jobs collection for ATS consistency
      await setDoc(doc(db, 'jobs', newRand), {
        ...formData,
        id: newRand,
        jobId: newRand,
        companyName: formData.companyName || '',
        company: formData.companyName || '',
        status: (formData as any).status || 'Active',
        isActive: true,
        experience: expFormatted,
        qualifications: formData.education || '',
        education: formData.education || '',
        customFields,
        interviewLink: newInterviewLink,
        accessCode: newAccessCode,
        recruiterUID: user.uid,
        teamId,
        createdBy: creatorInfo,
        createdAt: serverTimestamp(),
        interviewMode,
      }, { merge: true });

      // Log audit trail event
      logTeamActivity(
        teamId,
        'interview_created',
        `Created job/interview "${formData.title}" (ID: ${newRand})`,
        creatorInfo
      );

      if (uploadedResumeCandidateIds.length > 0) {
        try {
          await Promise.all(uploadedResumeCandidateIds.map((candidateId) => setDoc(
            doc(db, 'resumeDumpCandidates', candidateId),
            {
              sourceInterviewId: newRand,
              sourceJobTitle: formData.title,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )));
        } catch (resumeLinkError) {
          console.error('Interview created, but one or more Resume Dump source links could not be updated:', resumeLinkError);
        }
      }

      // 3. Send invitation emails via Brevo if candidate emails are present
      let emailCount = 0;
      if (candidateEmails.length > 0) {
        setSendingEmails(true);
        try {
          const candidatePayload = candidateDataList.length > 0 ? candidateDataList : candidateEmails;
          const result = await sendInterviewInvitations(
            candidatePayload,
            formData.title,
            newInterviewLink,
            newAccessCode,
            false,
            {
              gender: (formData as any).gender || (formData as any).genderRequirement,
              location: (formData as any).location,
              education: (formData as any).education || (formData as any).qualification,
              qualification: (formData as any).qualification || (formData as any).education,
              experience: ((formData as any).maxExperience > (formData as any).minExperience)
                ? `${(formData as any).minExperience} - ${(formData as any).maxExperience} Years`
                : ((formData as any).experience || (formData as any).experienceRequired),
              minExperience: (formData as any).minExperience,
              maxExperience: (formData as any).maxExperience,
              salary: (formData as any).salary || (formData as any).salaryRange,
              salaryRange: (formData as any).salaryRange || (formData as any).salary,
              deadline: (formData as any).deadline || (formData as any).interviewDeadline || '',
              employmentType: (formData as any).employmentType,
              customFields,
              recruiterName: userProfile?.name || creatorInfo.name || (user as any)?.displayName || 'Recruiter',
              recruiterPhone: (userProfile as any)?.phone || (userProfile as any)?.phoneNumber || (userProfile as any)?.contactNumber || (user as any)?.phoneNumber || ''
            }
          );

          if (result.success) {
            emailCount = result.totalEmails;
            console.log(`[Resend/Brevo] Successfully sent ${result.totalEmails} invitation email(s)!`);
          } else {
            console.warn(`[Resend/Brevo] Partial failure sending emails: ${result.error}`);
          }
        } catch (err: any) {
          console.error('[Resend/Brevo] Email sending error:', err);
        } finally {
          setSendingEmails(false);
        }
      }

      // 4. Send WhatsApp invitations via WhatsApp API if candidates have phone numbers
      let waCount = 0;
      const candidatesWithPhones = candidateDataList.filter((c) => c.phone && c.phone.trim() && c.phone !== 'N/A');
      if (candidatesWithPhones.length > 0) {
        try {
          console.log(`[WhatsApp API] Sending WhatsApp invitations to ${candidatesWithPhones.length} candidate(s)...`);
          const waResult = await sendBulkWhatsAppInvites(
            candidatesWithPhones,
            formData.title,
            newInterviewLink,
            newAccessCode,
            false,
            undefined,
            {
              gender: (formData as any).gender || (formData as any).genderRequirement,
              location: (formData as any).location,
              education: (formData as any).education || (formData as any).qualification,
              qualification: (formData as any).qualification || (formData as any).education,
              experience: ((formData as any).maxExperience > (formData as any).minExperience)
                ? `${(formData as any).minExperience} - ${(formData as any).maxExperience} Years`
                : ((formData as any).experience || (formData as any).experienceRequired),
              minExperience: (formData as any).minExperience,
              maxExperience: (formData as any).maxExperience,
              salary: (formData as any).salary || (formData as any).salaryRange,
              salaryRange: (formData as any).salaryRange || (formData as any).salary,
              deadline: (formData as any).deadline || (formData as any).interviewDeadline || '',
              employmentType: (formData as any).employmentType,
              customFields,
              recruiterName: userProfile?.name || creatorInfo.name || (user as any)?.displayName || 'Recruiter',
              recruiterPhone: (userProfile as any)?.phone || (userProfile as any)?.phoneNumber || (userProfile as any)?.contactNumber || (user as any)?.phoneNumber || '',
              whatsappSessionId: userProfile?.whatsappSessionId || '',
              whatsappSessionPasscode: userProfile?.whatsappSessionPasscode || ''
            }
          );
          if (waResult.success) {
            waCount = waResult.totalSent;
            console.log(`[WhatsApp API] Successfully sent ${waResult.totalSent} WhatsApp message(s)!`);
          } else {
            console.warn(`[WhatsApp API] Failed to send some WhatsApp messages:`, waResult.errors);
          }
        } catch (waErr: any) {
          console.error('[WhatsApp API] WhatsApp invite error:', waErr);
        }
      }

      const statusMsg = `✅ Interview created! Invitations sent: ${emailCount > 0 ? `${emailCount} Email(s)` : ''}${emailCount > 0 && waCount > 0 ? ' & ' : ''}${waCount > 0 ? `${waCount} WhatsApp Mobile invite(s)` : ''}${emailCount === 0 && waCount === 0 ? 'No immediate invites sent' : ''}.`;
      
      if (emailCount > 0 || waCount > 0) {
        const candidateSummary = candidateDataList.map(c => c.phone && c.phone !== 'N/A' ? `${c.email} (${c.phone})` : c.email).join(', ');
        logTeamActivity(
          teamId,
          'candidate_invited',
          `Invited candidate(s) [${candidateSummary}] for job "${formData.title}"`,
          creatorInfo
        );
      }

      alert(statusMsg);
      
      navigate('/recruiter/interviews');
    } catch (err) {
      console.error(err);
      alert("❌ Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full h-11 px-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-[#F8F9F5] placeholder:text-[#73766C] dark:placeholder:text-neutral-500 outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] disabled:cursor-not-allowed disabled:opacity-50";
  const textareaClass = "w-full min-h-[110px] p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-[#F8F9F5] placeholder:text-[#73766C] dark:placeholder:text-neutral-500 outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] leading-relaxed resize-y";
  const selectClass = `${inputClass} cursor-pointer`;
  const labelClass = "text-xs font-bold text-[#111215] dark:text-[#F8F9F5] mb-1.5 block flex items-center gap-1.5";
  const secondaryButtonClass = "inline-flex h-11 items-center justify-center rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-5 font-bold text-xs text-[#111215] dark:text-white transition-all hover:bg-[#F1F3EB] dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-2xs";
  const primaryButtonClass = "inline-flex h-12 items-center justify-center rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] px-8 font-black text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="w-full min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215]">

      {/* Header Banner */}
      <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#0D0E11] px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] font-bold text-[#111215] dark:text-[#F8F9F5] shadow-2xs mb-2">
              <span className="size-2 rounded-full bg-[#8FB305] dark:bg-[#D4F82C] animate-pulse"></span>
              <span className="font-mono uppercase text-[10px] text-[#73766C] dark:text-neutral-400">RECRUITER WORKSPACE</span>
              <span className="text-[#E4E7DC] dark:text-white/20">|</span>
              <span>Job Setup & Publishing</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-[#F8F9F5] tracking-tight">
              Create Job Opening
            </h1>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Post a new job opening, define role requirements, auto-extract capabilities with AI, and prepare candidate invitations.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 shadow-2xs">
              <Sparkles size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
              <span>AI Extraction Enabled</span>
            </span>
          </div>
        </div>

        {interviewLimitReached && (
          <div className="max-w-7xl mx-auto mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0" />
            <span>{getRateLimitReachedMessage('interviews')}</span>
          </div>
        )}
      </header>

      {/* Main 2-Column Bento Workspace */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: AI Source & Extraction Assistant (5 cols) */}
          <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
            <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-5">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-black shadow-2xs">
                    <Wand2 size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#111215] dark:text-[#F8F9F5]">AI JD Ingestion</h2>
                    <p className="text-[11px] text-[#73766C] dark:text-neutral-400">Auto-fill role details from any source</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#F1F3EB] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[10px] font-mono font-bold text-[#8FB305] dark:text-[#D4F82C]">
                  Smart Parse
                </span>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114]">
                <button
                  type="button"
                  onClick={() => setJdImportMode('upload')}
                  className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    jdImportMode === 'upload'
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  <FileUp size={13} />
                  <span>File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJdImportMode('paste')}
                  className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    jdImportMode === 'paste'
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  <FileText size={13} />
                  <span>Paste Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJdImportMode('url')}
                  className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    jdImportMode === 'url'
                      ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                      : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  <Globe size={13} />
                  <span>Web Link</span>
                </button>
              </div>

              {/* Mode: Upload */}
              {jdImportMode === 'upload' ? (
                <>
                  <label
                    htmlFor="jd-upload"
                    className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                      parsingJd
                        ? 'border-[#8FB305] bg-[#D4F82C]/5 cursor-not-allowed'
                        : 'border-[#E4E7DC] dark:border-white/15 bg-[#F8F9F5] dark:bg-white/5 hover:border-[#111215] dark:hover:border-[#D4F82C] hover:bg-white dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    {parsingJd ? (
                      <div className="flex flex-col items-center gap-2" role="status">
                        <div className="size-8 rounded-full border-2 border-[#111215] dark:border-[#D4F82C] border-t-transparent animate-spin" />
                        <span className="text-xs font-bold text-[#111215] dark:text-white">Parsing Job Description...</span>
                        <span className="text-[11px] text-[#73766C] dark:text-neutral-400">Extracting requirements & custom fields</span>
                      </div>
                    ) : (
                      <>
                        <div className="size-11 rounded-2xl bg-white dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center mb-2 shadow-2xs">
                          <UploadCloud size={22} className="text-[#8FB305] dark:text-[#D4F82C]" />
                        </div>
                        <span className="text-xs font-bold text-[#111215] dark:text-white">Upload JD File (.pdf, .txt)</span>
                        <span className="text-[11px] text-[#73766C] dark:text-neutral-400 mt-0.5">Drag & drop or browse document</span>
                      </>
                    )}
                  </label>
                  <input id="jd-upload" type="file" accept=".pdf,.txt" className="hidden" onChange={handleJDUpload} disabled={parsingJd} />
                </>
              ) : jdImportMode === 'paste' ? (
                <div className="space-y-3">
                  <textarea
                    rows={7}
                    value={pastedJdText}
                    onChange={(e) => setPastedJdText(e.target.value)}
                    placeholder="Paste complete Job Description text here (e.g. Production Engineer, Location: Ambad, Experience: 1-2 yrs, Facilities, Salary, etc.)..."
                    className={textareaClass}
                  />
                  <button
                    type="button"
                    onClick={handleParsePastedJDText}
                    disabled={parsingJd || !pastedJdText.trim()}
                    className="w-full h-11 rounded-full bg-[#111215] hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {parsingJd ? (
                      <>
                        <div className="size-4 rounded-full border-2 border-white dark:border-[#111215] border-t-transparent animate-spin" />
                        <span>Parsing & Auto-Filling JD...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-[#D4F82C] dark:text-[#111215]" />
                        <span>Auto-Fill Details with AI</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="url"
                    value={jdUrlInput}
                    onChange={(e) => setJdUrlInput(e.target.value)}
                    placeholder="Paste Job URL (e.g. https://company.com/job/101)..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleFetchAndParseJdFromUrl}
                    disabled={parsingJd || !jdUrlInput.trim()}
                    className="w-full h-11 rounded-full bg-[#111215] hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {parsingJd ? (
                      <>
                        <div className="size-4 rounded-full border-2 border-white dark:border-[#111215] border-t-transparent animate-spin" />
                        <span>Fetching Webpage & Parsing...</span>
                      </>
                    ) : (
                      <>
                        <Globe size={14} className="text-[#D4F82C] dark:text-[#111215]" />
                        <span>Fetch & Auto-Fill from URL</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Stepper Pipeline Overview */}
              <div className="pt-4 border-t border-[#E4E7DC] dark:border-white/10 space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                  Job Creation Pipeline
                </div>
                <div className="space-y-2">
                  {[
                    { step: '01', title: 'Role Brief', desc: 'Title, compensation, location & description' },
                    { step: '02', title: 'Skills Taxonomy', desc: 'Required tech stack & AI recommended capabilities' },
                    { step: '03', title: 'Custom Fields', desc: 'Perks, shifts, bond terms & client specifications' },
                  ].map((item) => (
                    <div key={item.step} className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-start gap-3">
                      <span className="font-mono text-xs font-black text-[#8FB305] dark:text-[#D4F82C] px-2 py-0.5 rounded-lg bg-white dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10">
                        {item.step}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">{item.title}</div>
                        <div className="text-[11px] text-[#73766C] dark:text-neutral-400">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </aside>

          {/* Right Column: Main Form (7 cols) */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">

            {/* Section 1: Role Brief Bento Card */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    01
                  </span>
                  <div>
                    <h2 className="text-base font-black text-[#111215] dark:text-[#F8F9F5]">Role Brief & Details</h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">Specify core role responsibilities and criteria</p>
                  </div>
                </div>
                <Briefcase size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                
                {/* Job Number / Code */}
                <div>
                  <label className={labelClass}>
                    <span>Job Code / Number</span>
                    <span className="text-[10px] text-[#73766C] font-normal">(Optional)</span>
                  </label>
                  <input
                    name="jobNo"
                    type="text"
                    className={inputClass}
                    value={formData.jobNo}
                    onChange={handleFormChange}
                    placeholder="e.g. REQ-901 / JOB-1042"
                  />
                </div>

                {/* Job Title */}
                <div>
                  <label className={labelClass}>
                    <span>Job Title / Role</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="title"
                    type="text"
                    required
                    className={inputClass}
                    value={formData.title}
                    onChange={handleFormChange}
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>

                {/* Company Name */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <Building2 size={13} className="text-[#8FB305]" />
                    <span>Company / Client Name</span>
                  </label>
                  <input
                    name="companyName"
                    type="text"
                    className={inputClass}
                    value={formData.companyName}
                    onChange={handleFormChange}
                    placeholder="e.g. Acme Technologies / Mukta Group"
                  />
                </div>

                {/* Job Description */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Job Description & Scope</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={5}
                    className={textareaClass}
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder="Describe key responsibilities, day-to-day requirements, and deliverables..."
                  />
                </div>

                {/* Company Details */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Company Background & Overview</span>
                    <span className="text-[10px] text-[#73766C] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    name="companyDetails"
                    rows={3}
                    className={textareaClass}
                    value={formData.companyDetails}
                    onChange={handleFormChange}
                    placeholder="Enter company profile, background, or recruiter overview..."
                  />
                </div>

                {/* External Job Link */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <ExternalLink size={13} className="text-[#8FB305]" />
                    <span>External Job / Career Link</span>
                    <span className="text-[10px] text-[#73766C] font-normal">(Optional)</span>
                  </label>
                  <input
                    name="jobLink"
                    type="url"
                    className={inputClass}
                    value={formData.jobLink}
                    onChange={handleFormChange}
                    placeholder="e.g. https://careers.company.com/job/101"
                  />
                </div>

                {/* Employment Type */}
                <div>
                  <label className={labelClass}>
                    <span>Employment Type</span>
                  </label>
                  <select
                    name="employmentType"
                    required
                    className={selectClass}
                    value={formData.employmentType}
                    onChange={handleFormChange}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                {/* Experience Range */}
                <div>
                  <label className={labelClass}>
                    <Clock size={13} className="text-[#8FB305]" />
                    <span>Experience Range (Years)</span>
                  </label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input
                      name="minExperience"
                      type="number"
                      min="0"
                      required
                      placeholder="Min"
                      className={inputClass}
                      value={formData.minExperience}
                      onChange={handleFormChange}
                    />
                    <span className="text-xs font-bold text-[#73766C] px-1">to</span>
                    <input
                      name="maxExperience"
                      type="number"
                      min="0"
                      required
                      placeholder="Max"
                      className={inputClass}
                      value={formData.maxExperience}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                {/* Location / City */}
                <div>
                  <label className={labelClass}>
                    <MapPin size={13} className="text-[#8FB305]" />
                    <span>Job City / Location</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <LocationCityInput
                    value={formData.city || formData.location}
                    onChange={(val) => setFormData({ ...formData, city: val, location: val })}
                    placeholder="Search city (e.g. Nashik, Pune, Mumbai)..."
                    className={inputClass}
                  />
                </div>

                {/* Salary / Compensation */}
                <div>
                  <label className={labelClass}>
                    <IndianRupee size={13} className="text-[#8FB305]" />
                    <span>Compensation / CTC</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="salaryRange"
                    type="text"
                    required
                    className={inputClass}
                    value={formData.salaryRange}
                    onChange={handleFormChange}
                    placeholder="e.g. ₹20,000 - ₹25,000 / mo or 5 - 8 LPA"
                  />
                </div>

                {/* Gender Requirement */}
                <div>
                  <label className={labelClass}>
                    <Users size={13} className="text-[#8FB305]" />
                    <span>Gender Preference</span>
                  </label>
                  <select
                    name="genderRequirement"
                    className={selectClass}
                    value={formData.genderRequirement}
                    onChange={handleFormChange}
                  >
                    <option value="Any">Any Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                {/* Education Qualification */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <GraduationCap size={13} className="text-[#8FB305]" />
                    <span>Minimum Education Criteria</span>
                  </label>
                  
                  {/* Selected Qualifications Chips */}
                  <div className="min-h-12 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] p-2.5 mb-3 flex flex-wrap gap-2">
                    {splitCommaList(formData.education).length > 0 ? (
                      splitCommaList(formData.education).map((edu) => (
                        <span
                          key={edu}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#F8F9F5] shadow-2xs"
                        >
                          <span>{edu}</span>
                          <button
                            type="button"
                            onClick={() => toggleEducation(edu)}
                            className="size-4 rounded-full flex items-center justify-center text-[#73766C] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#73766C] dark:text-neutral-500 italic p-1">
                        No education requirements selected yet
                      </span>
                    )}
                  </div>

                  {/* 2-Step Degree Picker */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 mb-1 block">
                        Step 1: Category
                      </label>
                      <select
                        className={selectClass}
                        value={selectedQualForEdu}
                        onChange={(e) => setSelectedQualForEdu(e.target.value)}
                      >
                        <option value="">-- Select Qualification Category --</option>
                        {EDUCATION_QUALIFICATIONS.map((qual) => (
                          <option key={qual} value={qual}>{qual}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 mb-1 block">
                        Step 2: Degree / Stream
                      </label>
                      <select
                        className={`${selectClass} ${!selectedQualForEdu ? 'opacity-50 cursor-not-allowed' : ''}`}
                        value=""
                        disabled={!selectedQualForEdu}
                        onChange={(e) => {
                          if (e.target.value) {
                            toggleEducation(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">
                          {selectedQualForEdu ? `-- Select ${selectedQualForEdu} Stream --` : '-- Choose Category First --'}
                        </option>
                        {selectedQualForEdu && (
                          <option value={`Any ${selectedQualForEdu}`}>Any {selectedQualForEdu} (All)</option>
                        )}
                        {(selectedQualForEdu && EDUCATION_SPECIALIZATIONS[selectedQualForEdu as EducationQualification]
                          ? EDUCATION_SPECIALIZATIONS[selectedQualForEdu as EducationQualification]
                          : []
                        ).map((spec) => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* Section 2: Skills Taxonomy Bento Card */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    02
                  </span>
                  <div>
                    <h2 className="text-base font-black text-[#111215] dark:text-[#F8F9F5]">Required Capabilities & Skills</h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">Core technologies, proficiencies & AI recommendations</p>
                  </div>
                </div>
                <Layers size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
              </div>

              {/* Active Selected Skills */}
              <div className="min-h-14 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] p-3 flex flex-wrap gap-2">
                {splitCommaList(formData.skills).length > 0 ? (
                  splitCommaList(formData.skills).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-2xs"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className="size-4 rounded-full flex items-center justify-center text-white/70 dark:text-black/70 hover:text-white dark:hover:text-black transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#73766C] dark:text-neutral-500 italic p-1">
                    No required skills selected yet. Add custom skills or pick from AI recommendations below.
                  </span>
                )}
              </div>

              {/* Search or Add Custom Skill Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Type a skill and press Enter or click Add (e.g. React, Python, AutoCAD)..."
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (skillSearch.trim()) {
                        toggleSkill(skillSearch.trim());
                        setSkillSearch('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (skillSearch.trim()) {
                      toggleSkill(skillSearch.trim());
                      setSkillSearch('');
                    }
                  }}
                  className={secondaryButtonClass}
                >
                  <Plus size={13} className="mr-1" />
                  <span>Add Skill</span>
                </button>
              </div>

              {/* AI Recommended Skills Container */}
              <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-[#8FB305] dark:text-[#D4F82C] animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#111215] dark:text-[#F8F9F5]">
                      AI Recommended Contextual Skills ({aiRecommendedSkills.length})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#73766C] dark:text-neutral-400">
                    Click to Toggle
                  </span>
                </div>
                
                <p className="text-[11px] text-[#575A51] dark:text-neutral-400 leading-relaxed">
                  Auto-recommended based on your job title, industry sector, and job description text.
                </p>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {aiRecommendedSkills.map((skill) => {
                    const isSelected = splitCommaList(formData.skills).includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4F82C] text-[#111215] border border-[#8FB305] font-black shadow-2xs'
                            : 'bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#111215] dark:hover:border-white/30 hover:bg-[#F1F3EB]'
                        }`}
                      >
                        <span>{skill}</span>
                        <span>{isSelected ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                  {aiRecommendedSkills.length === 0 && (
                    <span className="text-xs text-[#73766C] dark:text-neutral-500 italic">
                      Paste or upload a Job Description to trigger AI skill recommendations, or add custom skills manually.
                    </span>
                  )}
                </div>
              </div>

            </section>

            {/* Section 3: Custom Fields & Perks Bento Card */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    03
                  </span>
                  <div>
                    <h2 className="text-base font-black text-[#111215] dark:text-[#F8F9F5]">Custom Fields & Perks</h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">Attach perks, work hours, bond terms, or client specifications</p>
                  </div>
                </div>
                <Plus size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
              </div>

              {/* Add Custom Field Inputs */}
              <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2.5">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Field name (e.g. Perks, Shift)"
                    value={tempCustomField.key}
                    onChange={(e) => setTempCustomField({ ...tempCustomField, key: e.target.value })}
                  />
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Value (e.g. Cab facility, Day shift, 1 Year bond)"
                    value={tempCustomField.value}
                    onChange={(e) => setTempCustomField({ ...tempCustomField, value: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className={secondaryButtonClass}
                  >
                    <span>Add</span>
                  </button>
                </div>

                {/* List of Custom Fields */}
                {customFields.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {customFields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10"
                      >
                        <div className="text-xs truncate">
                          <span className="font-bold text-[#111215] dark:text-white mr-1.5">{field.key}:</span>
                          <span className="text-[#575A51] dark:text-neutral-300">{field.value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(field.id)}
                          className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </section>

            {/* Interview Format: video (existing flow) or real-time AI voice interview */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    04
                  </span>
                  <div>
                    <h2 className="text-base font-black text-[#111215] dark:text-[#F8F9F5]">Interview Format</h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">How candidates are screened for this job</p>
                  </div>
                </div>
                <Mic size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
              </div>

              <div className="rounded-2xl border border-[#111215] dark:border-[#D4F82C] bg-[#F8F9F5] dark:bg-[#101114] p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#111215] dark:text-white flex items-center gap-2">
                      <span>Unified AI Interview (Video & Voice)</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#111215] text-[#D4F82C]">Platform Standard</span>
                    </div>
                    <div className="text-xs text-[#73766C] dark:text-neutral-400 mt-0.5">
                      Autonomous live conversational AI assessment with continuous HD camera recording, two-way speech, and full executive report dossier.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className={labelClass}>Questions the AI interviewer asks, in order</label>
                    <button
                      type="button"
                      disabled={generatingVoiceQuestions || !formData.description.trim()}
                      onClick={async () => {
                        setGeneratingVoiceQuestions(true);
                        try {
                          const qs = await generateScreeningQuestionsFromJd(formData.title, formData.description, formData.location || formData.city);
                          if (qs.length) setVoiceQuestions(qs.map((q) => q.question));
                        } catch (err) {
                          console.error('Voice question generation failed:', err);
                        } finally {
                          setGeneratingVoiceQuestions(false);
                        }
                      }}
                      className={secondaryButtonClass}
                    >
                      <Wand2 size={14} className="mr-1.5" />
                      {generatingVoiceQuestions ? 'Generating…' : 'Generate from JD'}
                    </button>
                  </div>
                  {voiceQuestions.map((q, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        className={inputClass}
                        value={q}
                        onChange={(e) => setVoiceQuestions(voiceQuestions.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                      <button type="button" onClick={() => setVoiceQuestions(voiceQuestions.filter((_, j) => j !== i))} className="p-2 text-red-600 dark:text-red-400 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setVoiceQuestions([...voiceQuestions, ''])} className={secondaryButtonClass}>
                    <Plus size={14} className="mr-1.5" /> Add question
                  </button>
                  <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                    About 1.5 minutes per question (5–15 minute call). The interviewer may ask one short follow-up per answer.
                  </p>
                </div>
            </section>

            {/* Sticky Submission Bar */}
            <div className="sticky bottom-6 z-20 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white/95 dark:bg-[#15161A]/95 p-5 backdrop-blur-md shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">Ready to Publish</div>
                  <div className="text-[11px] text-[#73766C] dark:text-neutral-400">
                    Access codes, AI screening criteria & public job listing generated immediately.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || rateLimitLoading || interviewLimitReached}
                className={primaryButtonClass}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="size-4 rounded-full border-2 border-white dark:border-[#111215] border-t-transparent animate-spin" />
                    <span>Publishing Job Opening...</span>
                  </span>
                ) : interviewLimitReached ? (
                  'Job Limit Reached'
                ) : (
                  <span className="flex items-center gap-2">
                    <span>Create Job Opening</span>
                    <ArrowRight size={16} />
                  </span>
                )}
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
};

export default CreateInterview;
