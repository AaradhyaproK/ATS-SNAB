import React, { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SKILL_OPTIONS } from './Profile';
import * as pdfjsLib from 'pdfjs-dist';
import { ExternalLink, Sparkles, Building2, Check } from 'lucide-react';
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
  if (Array.isArray(val)) return val.map(item => String(item).trim()).filter(Boolean);
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
    let extractedCompanyName = parsed.companyName || (parsed as any).company || '';
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

    setLoading(true);

    try {
      // 1. Generate Job ID, Link, and Access Code locally
      const newRand = Math.random().toString(36).substring(2, 15);
      const newInterviewLink = `${window.location.origin}/candidate?job=${newRand}`;
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

  const inputClass = "geist-caption h-9 w-full rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#050505] px-3 text-gray-900 dark:text-white outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#6b7280] focus:border-indigo-500 dark:focus:border-white/[0.28] disabled:cursor-not-allowed disabled:opacity-50";
  const textareaClass = "geist-caption min-h-[132px] w-full resize-y rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#050505] px-3 py-2.5 text-gray-900 dark:text-white outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#6b7280] focus:border-indigo-500 dark:focus:border-white/[0.28]";
  const selectClass = `${inputClass} appearance-none`;
  const labelClass = "geist-label mb-1.5 block text-gray-700 dark:text-[#a1a1aa]";
  const secondaryButtonClass = "geist-caption inline-flex h-9 shrink-0 items-center justify-center rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-white/[0.03] px-3.5 font-semibold text-gray-800 dark:text-[#d4d4d4] transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 shadow-sm dark:shadow-none cursor-pointer";
  const primaryButtonClass = "geist-caption inline-flex h-10 items-center justify-center rounded-[6px] bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 shadow-md dark:shadow-none cursor-pointer";
  const panelHeaderClass = "geist-label uppercase text-gray-500 dark:text-[#6b7280]";
  const panelTitleClass = "geist-section-title mt-1 text-gray-900 dark:text-white";
  const helperTextClass = "geist-small mt-1 max-w-2xl text-gray-600 dark:text-[#8f8f8f]";

  return (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] bg-white dark:bg-[#000] text-gray-900 dark:text-white">

      <header className="border-b border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000]">
        <div className="px-4 py-5 sm:px-6 lg:px-7">
          <p className="geist-label uppercase text-gray-500 dark:text-[#6b7280]">Job setup</p>
          <h1 className="geist-page-title mt-2 text-gray-900 dark:text-white">Create Job</h1>
          <p className="geist-small mt-1 max-w-2xl text-gray-600 dark:text-[#8f8f8f]">
            Post a new job opening, define role requirements, and prepare candidate invitations from one focused ATS workspace.
          </p>
        </div>
        {interviewLimitReached && (
          <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 sm:px-6 lg:px-7">
            {getRateLimitReachedMessage('interviews')}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.42fr)_1px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-[#020202] px-4 py-5 sm:px-6 lg:border-b-0 lg:px-7">
          <div className="lg:sticky lg:top-[5.25rem] space-y-4">
            <div>
              <p className={panelHeaderClass}>Source</p>
              <h2 className={panelTitleClass}>Start from a job description</h2>
              <p className={helperTextClass}>
                Upload a PDF/TXT or paste raw JD text below to auto-fill details & create dynamic custom fields.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-[6px] border border-gray-200 dark:border-white/[0.11] bg-gray-100/80 dark:bg-white/[0.03] p-1 shadow-inner dark:shadow-none">
              <button
                type="button"
                onClick={() => setJdImportMode('upload')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-[4px] transition-all flex items-center justify-center gap-1 cursor-pointer ${jdImportMode === 'upload' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'text-gray-600 dark:text-[#8f8f8f] hover:text-gray-900 dark:hover:text-white'}`}
              >
                <i className="fas fa-file-pdf"></i> Upload File
              </button>
              <button
                type="button"
                onClick={() => setJdImportMode('paste')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-[4px] transition-all flex items-center justify-center gap-1 cursor-pointer ${jdImportMode === 'paste' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'text-gray-600 dark:text-[#8f8f8f] hover:text-gray-900 dark:hover:text-white'}`}
              >
                <i className="fas fa-paste"></i> Paste Text
              </button>
              <button
                type="button"
                onClick={() => setJdImportMode('url')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-[4px] transition-all flex items-center justify-center gap-1 cursor-pointer ${jdImportMode === 'url' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'text-gray-600 dark:text-[#8f8f8f] hover:text-gray-900 dark:hover:text-white'}`}
              >
                <i className="fas fa-link"></i> Web Link
              </button>
            </div>

            {jdImportMode === 'upload' ? (
              <>
                <label
                  htmlFor="jd-upload"
                  className={`geist-caption flex min-h-28 cursor-pointer flex-col justify-center rounded-[6px] border border-dashed bg-white dark:bg-white/[0.025] px-4 py-4 text-gray-800 dark:text-[#d4d4d4] transition-colors hover:border-gray-400 dark:hover:border-white/[0.3] ${parsingJd ? 'cursor-not-allowed border-gray-300 dark:border-white/[0.12]' : 'border-gray-300 dark:border-white/[0.18]'}`}
                >
                  {parsingJd ? (
                    <span className="flex flex-col gap-2" role="status" aria-label="Parsing job description">
                      <SkeletonBlock className="h-4 w-44" />
                      <SkeletonBlock className="h-3 w-64 max-w-full bg-gray-200 dark:bg-white/[0.08]" />
                      <SkeletonBlock className="h-3 w-36 bg-gray-200 dark:bg-white/[0.08]" />
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <i className="fas fa-file-upload text-black dark:text-white"></i> Upload job description file
                      </span>
                      <span className="geist-small mt-1 text-gray-500 dark:text-[#8f8f8f]">PDF or TXT document with job requirements.</span>
                    </>
                  )}
                </label>
                <input id="jd-upload" type="file" accept=".pdf,.txt" className="hidden" onChange={handleJDUpload} disabled={parsingJd} />
              </>
            ) : jdImportMode === 'paste' ? (
              <div className="space-y-3">
                <textarea
                  rows={8}
                  value={pastedJdText}
                  onChange={(e) => setPastedJdText(e.target.value)}
                  placeholder="Paste complete Job Description text here (e.g. 23632 | Production Engineer, Location: Ambad, Experience: 1-2 yrs, Facilities, Bond, Salary, etc.)..."
                  className="w-full rounded-[6px] border border-gray-300 dark:border-white/[0.18] bg-white dark:bg-white/[0.03] p-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-indigo-500 dark:focus:border-white leading-relaxed resize-none font-sans"
                />
                <button
                  type="button"
                  onClick={handleParsePastedJDText}
                  disabled={parsingJd || !pastedJdText.trim()}
                  className="w-full h-9 rounded-[6px] bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {parsingJd ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Parsing & Auto-Filling JD...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-wand-magic-sparkles"></i> Auto-Fill JD Details & Custom Fields
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
                  className="w-full rounded-[6px] border border-gray-300 dark:border-white/[0.18] bg-white dark:bg-white/[0.03] p-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-indigo-500 dark:focus:border-white font-sans"
                />
                <button
                  type="button"
                  onClick={handleFetchAndParseJdFromUrl}
                  disabled={parsingJd || !jdUrlInput.trim()}
                  className="w-full h-9 rounded-[6px] bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {parsingJd ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Fetching Webpage & Parsing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-globe"></i> Fetch & Auto-Fill JD from URL
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="mt-7 border-t border-gray-200 dark:border-white/[0.11] pt-5">
              <p className={panelHeaderClass}>Flow</p>
              <div className="mt-3 divide-y divide-gray-200 dark:divide-white/[0.11] border border-gray-200 dark:border-white/[0.11] rounded-[6px] bg-white dark:bg-transparent">
                {[
                  ['Brief', 'Role details and requirements'],
                  ['Skills', 'Capabilities and requirements'],
                  ['Additional', 'Dynamic custom fields and perks'],
                ].map(([title, copy]) => (
                  <div key={title} className="px-3 py-3">
                    <p className="geist-caption font-medium text-gray-900 dark:text-white">{title}</p>
                    <p className="geist-small mt-0.5 text-gray-500 dark:text-[#8f8f8f]">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="hidden bg-gray-200 dark:bg-white/[0.11] lg:block" />

        <form onSubmit={handleSubmit} className="min-w-0 bg-white dark:bg-[#000]">
          <section className="border-b border-gray-200 dark:border-white/[0.11] px-4 py-5 sm:px-6 lg:px-7">
            <p className={panelHeaderClass}>Brief</p>
            <h2 className={panelTitleClass}>Role details</h2>
            <p className={helperTextClass}>Keep the requirements specific so the generated interview stays relevant.</p>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <label className={labelClass}>Job Number / Code (Optional)</label>
                <input
                  name="jobNo"
                  type="text"
                  className={inputClass}
                  value={formData.jobNo}
                  onChange={handleFormChange}
                  placeholder="e.g. Job No: 1042 or REQ-901 (Auto-filled by AI if in JD)"
                />
              </div>

              <div>
                <label className={labelClass}>Job title / role <span className="text-red-500 dark:text-red-400">*</span></label>
                <input name="title" type="text" required className={inputClass} value={formData.title} onChange={handleFormChange} placeholder="Senior Frontend Engineer" />
              </div>

              <div>
                <label className={labelClass}>Company Name</label>
                <input
                  name="companyName"
                  type="text"
                  className={inputClass}
                  value={formData.companyName}
                  onChange={handleFormChange}
                  placeholder="e.g. Mukta Group / TechCorp"
                />
              </div>

              <div className="xl:col-span-2">
                <label className={labelClass}>Job description</label>
                <textarea name="description" required rows={5} className={textareaClass} value={formData.description} onChange={handleFormChange} placeholder="Describe the role, responsibilities, and what you are looking for." />
              </div>

              <div className="xl:col-span-2">
                <label className={labelClass}>Company Details & Overview (Optional)</label>
                <textarea name="companyDetails" rows={3} className={textareaClass} value={formData.companyDetails} onChange={handleFormChange} placeholder="Enter company profile, background, product overview, or recruiter company details..." />
              </div>

              <div className="xl:col-span-2">
                <label className={labelClass}>Job Link / External URL (Added by Job Creator)</label>
                <input
                  name="jobLink"
                  type="url"
                  className={inputClass}
                  value={formData.jobLink}
                  onChange={handleFormChange}
                  placeholder="e.g. https://careers.company.com/job-101 (Added manually by job creator, not AI)"
                />
              </div>

              <div>
                <label className={labelClass}>Employment type</label>
                <select name="employmentType" required className={selectClass} value={formData.employmentType} onChange={handleFormChange}>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Required experience</label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <input name="minExperience" type="number" min="0" required placeholder="Min" className={inputClass} value={formData.minExperience} onChange={handleFormChange} />
                  <span className="geist-small text-gray-500 dark:text-[#6b7280]">to</span>
                  <input name="maxExperience" type="number" min="0" required placeholder="Max" className={inputClass} value={formData.maxExperience} onChange={handleFormChange} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Job City / Location <span className="text-red-500 dark:text-red-400">*</span></label>
                <LocationCityInput
                  value={formData.city || formData.location}
                  onChange={(val) => setFormData({ ...formData, city: val, location: val })}
                  placeholder="Search city (e.g. Ambad, Nashik / Pune / Mumbai)..."
                  className={inputClass}
                />
              </div>


              <div>
                <label className={labelClass}>Salary / Compensation <span className="text-red-500 dark:text-red-400">*</span></label>
                <input name="salaryRange" type="text" required className={inputClass} value={formData.salaryRange} onChange={handleFormChange} placeholder="e.g. 20,000 - 22,000 / per month or 4 - 6 LPA" />
              </div>

              <div>
                <label className={labelClass}>Gender requirement</label>
                <select name="genderRequirement" className={selectClass} value={formData.genderRequirement} onChange={handleFormChange}>
                  <option value="Any">Any</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="xl:col-span-2">
                <label className={labelClass}>Minimum education level</label>
                <div className="min-h-10 rounded-[6px] border border-gray-300 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.025] p-2">
                  <div className="flex flex-wrap gap-2">
                    {splitCommaList(formData.education).length > 0 ? splitCommaList(formData.education).map(edu => (
                      <span key={edu} className="geist-small inline-flex h-7 items-center gap-2 rounded-[6px] border border-gray-300 dark:border-white/[0.11] bg-white dark:bg-white/[0.05] px-2.5 text-gray-900 dark:text-[#d4d4d4] font-medium shadow-sm dark:shadow-none">
                        {edu}
                        <button type="button" onClick={() => toggleEducation(edu)} className="text-gray-400 dark:text-[#8f8f8f] transition-colors hover:text-red-500 dark:hover:text-white">&times;</button>
                      </span>
                    )) : <span className="geist-caption text-gray-400 dark:text-[#6b7280]">No education level selected</span>}
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {/* 1. Select Qualification Category */}
                  <div>
                    <label className="geist-caption mb-1 block text-gray-500 dark:text-[#8f8f8f]">1. Qualification Category</label>
                    <select
                      className={selectClass}
                      value={selectedQualForEdu}
                      onChange={(e) => setSelectedQualForEdu(e.target.value)}
                    >
                      <option value="">-- Select Qualification Category --</option>
                      {EDUCATION_QUALIFICATIONS.map(qual => (
                        <option key={qual} value={qual}>{qual}</option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Select Specialization based on Qualification */}
                  <div>
                    <label className="geist-caption mb-1 block text-gray-500 dark:text-[#8f8f8f]">2. Degree / Specialization</label>
                    <select
                      className={`${selectClass} ${!selectedQualForEdu ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                        {selectedQualForEdu ? `-- Select ${selectedQualForEdu} Degree --` : '-- Choose Category First --'}
                      </option>
                      {selectedQualForEdu && (
                        <option value={`Any ${selectedQualForEdu}`}>Any {selectedQualForEdu} (All)</option>
                      )}
                      {(selectedQualForEdu && EDUCATION_SPECIALIZATIONS[selectedQualForEdu as EducationQualification]
                        ? EDUCATION_SPECIALIZATIONS[selectedQualForEdu as EducationQualification]
                        : []
                      ).map(spec => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-gray-200 dark:border-white/[0.11] px-4 py-5 sm:px-6 lg:px-7">
            <p className={panelHeaderClass}>Skills</p>
            <h2 className={panelTitleClass}>Required capabilities</h2>
            <p className={helperTextClass}>Select existing skills or add a custom requirement.</p>

            <div className="mt-5 min-h-10 rounded-[6px] border border-gray-300 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.025] p-2">
              <div className="flex flex-wrap gap-2">
                {splitCommaList(formData.skills).length > 0 ? splitCommaList(formData.skills).map(skill => (
                  <span key={skill} className="geist-small inline-flex h-7 items-center gap-2 rounded-[6px] border border-purple-200 dark:border-white/[0.11] bg-purple-50 dark:bg-white/[0.05] px-2.5 text-purple-700 dark:text-[#d4d4d4] font-medium">
                    {skill}
                    <button type="button" onClick={() => toggleSkill(skill)} className="text-purple-400 dark:text-[#8f8f8f] transition-colors hover:text-red-500 dark:hover:text-white">&times;</button>
                  </span>
                )) : <span className="geist-caption text-gray-400 dark:text-[#6b7280]">No skills selected</span>}
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                className={inputClass}
                placeholder="Search or add custom skill"
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                onKeyDown={e => {
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
                Add
              </button>
            </div>

            <div className="mt-3 rounded-[6px] border border-purple-200 dark:border-white/[0.11] bg-purple-50/50 dark:bg-[#08080c] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                <span className="geist-caption text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  AI Recommended Contextual Skills ({aiRecommendedSkills.length})
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                Contextually recommended skills based on your job title & description. Click to toggle.
              </p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                {aiRecommendedSkills.map((skill) => {
                  const isSelected = splitCommaList(formData.skills).includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`geist-small inline-flex h-7 items-center rounded-[6px] border px-2.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-purple-400 bg-purple-600 dark:bg-white text-white dark:text-black font-bold shadow-sm'
                          : 'border-gray-300 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-800 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-white/10'
                      }`}
                    >
                      {skill} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
                {aiRecommendedSkills.length === 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                    Paste or upload a Job Description to auto-recommend skills, or add custom skills above.
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="border-b border-gray-200 dark:border-white/[0.11] px-4 py-5 sm:px-6 lg:px-7">
            <p className={panelHeaderClass}>Additional Info</p>
            <h2 className={panelTitleClass}>Custom fields</h2>
            <p className={helperTextClass}>Attach optional custom fields to this job post (e.g. Perks, Working Hours, Client Code).</p>

            <div className="mt-4 rounded-[6px] border border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.025] p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <input type="text" className={inputClass} placeholder="Field name, e.g. Perks" value={tempCustomField.key} onChange={e => setTempCustomField({ ...tempCustomField, key: e.target.value })} />
                <input type="text" className={inputClass} placeholder="Field value, e.g. Flexible shifts, Cab facility" value={tempCustomField.value} onChange={e => setTempCustomField({ ...tempCustomField, value: e.target.value })} />
                <button type="button" onClick={handleAddCustomField} className={secondaryButtonClass}>Add</button>
              </div>

              {customFields.length > 0 && (
                <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {customFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#050505] px-3 py-2.5">
                      <p className="geist-caption min-w-0 truncate text-gray-800 dark:text-[#d4d4d4]"><span className="font-medium text-gray-900 dark:text-white">{field.key}:</span> {field.value}</p>
                      <button type="button" onClick={() => handleRemoveCustomField(field.id)} className="geist-small shrink-0 text-red-500 dark:text-[#8f8f8f] transition-colors hover:text-red-700 dark:hover:text-white font-semibold">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="sticky bottom-0 border-t border-gray-200 dark:border-white/[0.11] bg-white/95 dark:bg-[#000]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-7 shadow-lg dark:shadow-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="geist-small text-gray-500 dark:text-[#8f8f8f]">Access codes and listings are generated upon submission.</p>
              <button type="submit" disabled={loading || rateLimitLoading || interviewLimitReached} className={primaryButtonClass}>
                {loading ? (
                  <span className="flex w-44 max-w-full flex-col items-center gap-1.5" role="status" aria-label="Saving job">
                    <SkeletonBlock className="h-3.5 w-32 bg-gray-300 dark:bg-black/[0.18]" />
                    <SkeletonBlock className="h-2.5 w-20 bg-gray-200 dark:bg-black/[0.12]" />
                  </span>
                ) : interviewLimitReached ? 'Job limit reached' : 'Create Job Opening'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInterview;
