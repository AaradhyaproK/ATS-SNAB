import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ExternalLink, Sparkles, Building2, Check, X } from 'lucide-react';
import { LocationCityInput } from '../components/LocationCityInput';
import { EDUCATION_QUALIFICATIONS, EDUCATION_SPECIALIZATIONS, EducationQualification } from '../data/allEducationDegrees';
import { resolveStrictListedCity } from '../data/maharashtraCities';
import { parseJobDescriptionText, ParsedJdResult } from '../services/geminiService';
import { extractSkillSignals } from '../services/resumeService';
import { resolveJobOrInterviewDocument } from '../services/jobResolutionService';
import * as pdfjsLib from 'pdfjs-dist';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface EditJobModalProps {
  jobId?: string;
  onClose?: () => void;
}

export interface CandidateContact {
  email: string;
  phone: string;
  name?: string;
}

const splitCommaList = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(item => String(item).trim()).filter(Boolean);
  if (typeof val === 'string') return val.split(',').map((item) => item.trim()).filter(Boolean);
  return [String(val).trim()].filter(Boolean);
};

const formatStringValue = (val: any): string => {
  if (!val) return '';
  if (Array.isArray(val)) return val.map(item => String(item).trim()).filter(Boolean).join(', ');
  if (typeof val === 'string') return val;
  return String(val);
};

const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <span className={`block animate-pulse rounded-[4px] bg-white/[0.12] ${className}`} aria-hidden="true" />
);

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
    console.warn('Direct fetch failed, attempting proxy...', err);
  }

  if (!htmlText) {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`,
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
    throw new Error('Unable to fetch webpage content directly due to browser CORS or security rules.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const elementsToRemove = doc.querySelectorAll('script, style, noscript, iframe, svg, header, footer, nav');
  elementsToRemove.forEach((el) => el.remove());
  const rawText = doc.body?.textContent || doc.textContent || '';
  return rawText.replace(/\s+/g, ' ').trim();
};

export const EditJob: React.FC<EditJobModalProps> = ({ jobId: propJobId, onClose }) => {
  const params = useParams<{ jobId: string }>();
  const activeJobId = propJobId || params.jobId || '';
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  interface CustomField { id: number; key: string; value: string; }
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [accessCode, setAccessCode] = useState('');
  const [tempCustomField, setTempCustomField] = useState({ key: '', value: '' });

  // Candidates contacts state
  const [candidateEmails, setCandidateEmails] = useState<string[]>([]);
  const [candidateDataList, setCandidateDataList] = useState<CandidateContact[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentPhone, setCurrentPhone] = useState('');

  // AI JD Auto-Fill state
  const [parsingJd, setParsingJd] = useState(false);
  const [jdImportMode, setJdImportMode] = useState<'upload' | 'paste' | 'url'>('upload');
  const [pastedJdText, setPastedJdText] = useState('');
  const [jdUrlInput, setJdUrlInput] = useState('');

  const [eduInput, setEduInput] = useState('');
  const [selectedQualForEdu, setSelectedQualForEdu] = useState<string>('Graduate');
  const [skillSearch, setSkillSearch] = useState('');

  const [targetDocId, setTargetDocId] = useState<string>(activeJobId);
  const [targetCollection, setTargetCollection] = useState<'jobs' | 'interviews'>('jobs');

  const [formData, setFormData] = useState({
    jobNo: '',
    title: '',
    companyName: '',
    companyDetails: '',
    jobLink: '',
    industryName: '',
    roleName: '',
    qualifications: '',
    deadline: '',
    description: '',
    permission: 'anyone',
    skills: '',
    category: '',
    numQuestions: 5,
    employmentType: 'Full-time',
    minExperience: 0,
    maxExperience: 0,
    experience: 0,
    difficulty: 'Easy',
    location: '',
    city: '',
    salaryRange: '',
    genderRequirement: 'Any',
    strictGenderMatch: false,
    strictLocationMatch: false,
    strictEducationMatch: false,
    strictExperienceMatch: false,
    strictness: 'Low',
    entryBy: '',
    status: 'Active',
  });

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  const handleApplyParsedJdData = (parsed: ParsedJdResult) => {
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

    const rawLocCandidate = `${(parsed as any).location || ''} ${(parsed as any).city || ''} ${(parsed as any).state || ''} ${fullJdText}`;
    const resolvedStrictCity = resolveStrictListedCity(rawLocCandidate);

    let extractedCompanyName = parsed.companyName || (parsed as any).company || '';
    const cleanNewFields: { id: number; key: string; value: string }[] = [];

    if (parsed.customFields && Array.isArray(parsed.customFields)) {
      parsed.customFields.forEach((cf, idx) => {
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
        } else if (isStandardFieldKey(keyLower)) {
          // Do not add recognized standard fields into custom fields
        } else {
          cleanNewFields.push({
            id: Date.now() + idx,
            key: cf.key.trim(),
            value: cf.value.trim(),
          });
        }
      });
    }

    setFormData((prev) => ({
      ...prev,
      title: parsed.title || parsed.vacancyName || parsed.designation || prev.title,
      companyName: extractedCompanyName || prev.companyName || '',
      description: parsed.description || prev.description,
      category: parsed.department || parsed.industry || parsed.roleCategory || prev.category,
      employmentType: parsed.employmentType || prev.employmentType,
      minExperience: parsed.minExperience !== undefined ? Number(parsed.minExperience) : prev.minExperience,
      maxExperience: parsed.maxExperience !== undefined ? Number(parsed.maxExperience) : prev.maxExperience,
      experience: parsed.minExperience !== undefined ? Number(parsed.minExperience) : prev.experience,
      skills: formatStringValue(parsed.skills || (parsed.technicalSkills && parsed.softSkills ? `${parsed.technicalSkills}, ${parsed.softSkills}` : prev.skills)),
      // Minimum education level is strictly selected manually by selectors only (do not auto-fill from JD)
      qualifications: prev.qualifications,
      location: resolvedStrictCity || prev.location || '',
      city: resolvedStrictCity || prev.city || '',
      salaryRange: (parsed as any).salaryRange || (parsed as any).salary || prev.salaryRange,
      genderRequirement: (parsed as any).genderRequirement || (parsed as any).gender || prev.genderRequirement,
      strictGenderMatch: false,
      strictLocationMatch: false,
      strictEducationMatch: false,
      strictExperienceMatch: false,
    }));

    if (cleanNewFields.length > 0) {
      setCustomFields((prev) => {
        const existingKeys = new Set(prev.map((f) => f.key.toLowerCase()));
        const filteredNew = cleanNewFields.filter((f) => !existingKeys.has(f.key.toLowerCase()));
        return [...prev, ...filteredNew];
      });
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
      alert('✅ Job description parsed! All details & dynamic custom fields updated.');
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
      alert('✅ Job description document parsed! All details & dynamic custom fields updated.');
    } catch (error) {
      console.error('Error parsing JD:', error);
      alert('❌ Failed to parse job description document.');
    } finally {
      setParsingJd(false);
      e.target.value = '';
    }
  };

  const handleFetchAndParseJdFromUrl = async () => {
    if (!jdUrlInput.trim()) {
      alert('Please enter a valid URL.');
      return;
    }

    setParsingJd(true);
    try {
      const extractedHtmlText = await fetchTextFromUrl(jdUrlInput.trim());
      if (!extractedHtmlText || extractedHtmlText.length < 50) {
        throw new Error('Unable to extract meaningful text from the provided webpage.');
      }
      const parsedData = await parseJobDescriptionText(extractedHtmlText.slice(0, 15000));
      handleApplyParsedJdData(parsedData);
      alert('✅ Webpage content fetched & parsed! All details updated.');
    } catch (error: any) {
      console.error('Error fetching/parsing JD from URL:', error);
      alert(`❌ Failed to fetch and parse URL: ${error.message || 'Network error'}`);
    } finally {
      setParsingJd(false);
    }
  };

  useEffect(() => {
    const fetchJob = async () => {
      try {
        if (!activeJobId || !user) return;

        const resolved = await resolveJobOrInterviewDocument(activeJobId);

        if (resolved && resolved.data) {
          const sourceData = resolved.data;
          setTargetDocId(resolved.id);
          setTargetCollection(resolved.collectionName);

          const userTeamId = userProfile?.teamId || userProfile?.parentRecruiterId || (userProfile as any)?.primaryRecruiterUID;
          const roleLower = (userProfile?.role || '').toLowerCase();
          const isRecruiterRole = roleLower === 'recruiter' || roleLower === 'primary' || roleLower === 'subrecruiter' || roleLower === 'admin' || roleLower === 'owner';
          const isOwner = isRecruiterRole || sourceData.recruiterUID === user.uid || (userProfile && (userTeamId === sourceData.teamId || sourceData.recruiterUID === userTeamId));
          if (!isOwner) {
            alert('You do not have permission to edit this item.');
            handleClose();
            return;
          }

          setAccessCode(sourceData.accessCode || '');

          let deadlineStr = '';
          const deadlineSource = sourceData.deadlineDate || sourceData.applyDeadline || sourceData.deadline || sourceData.interviewDeadline;
          if (deadlineSource) {
            if (deadlineSource.toDate) {
              deadlineStr = deadlineSource.toDate().toISOString().split('T')[0];
            } else if (typeof deadlineSource === 'string') {
              deadlineStr = deadlineSource;
            }
          }

          const loadedCategory =
            sourceData.category ||
            sourceData.department ||
            sourceData.roleCategory ||
            sourceData.jobCategory ||
            sourceData.industry ||
            '';

          const loadedCustomFields = sourceData.customFields || [];
          const uploadedByCf = loadedCustomFields.find((cf: any) => {
            const k = String(cf?.key || '').toLowerCase();
            return k.includes('uploaded by') || k.includes('entry by') || k.includes('entered by');
          })?.value;

          const resolvedEntryBy = (
            sourceData.entryBy ||
            sourceData.entry_by ||
            sourceData.uploadedBy ||
            sourceData.uploaded_by ||
            sourceData.recruiterName ||
            sourceData.contactPerson ||
            (typeof sourceData.createdBy === 'string' ? sourceData.createdBy : sourceData.createdBy?.name) ||
            uploadedByCf ||
            ''
          );

          let loadedCompanyName = sourceData.companyName || sourceData.company || '';
          const rawLoadedCustomFields = sourceData.customFields || [];
          const cleanLoadedCustomFields = rawLoadedCustomFields.filter((cf: any) => {
            const k = String(cf?.key || '').trim().toLowerCase();
            if (
              k === 'company name' ||
              k === 'company' ||
              k === 'client name' ||
              k === 'client' ||
              k === 'employer' ||
              k === 'organization'
            ) {
              if (!loadedCompanyName && cf.value) loadedCompanyName = String(cf.value).trim();
              return false;
            }
            return !isStandardFieldKey(k);
          });

          setFormData({
            jobNo: sourceData.jobNo ? String(sourceData.jobNo) : (sourceData.accessCode || ''),
            title: sourceData.title?.replace(' Interview', '') || '',
            companyName: loadedCompanyName,
            companyDetails: sourceData.companyDetails || '',
            jobLink: sourceData.jobLink || sourceData.externalUrl || '',
            industryName: sourceData.industryName || sourceData.sector || '',
            roleName: sourceData.roleName || sourceData.roleCategory || '',
            qualifications: formatStringValue(sourceData.qualifications || sourceData.education || sourceData.qualification || ''),
            deadline: deadlineStr,
            description: sourceData.description || '',
            permission: sourceData.interviewPermission || sourceData.permission || 'anyone',
            skills: formatStringValue(sourceData.skills),
            category: loadedCategory,
            numQuestions: sourceData.numQuestions || 5,
            employmentType: sourceData.employmentType || 'Full-time',
            minExperience: sourceData.minExperience ?? sourceData.experience ?? 0,
            maxExperience: sourceData.maxExperience ?? sourceData.experience ?? 0,
            experience: sourceData.experience ?? 0,
            difficulty: sourceData.difficulty || 'Easy',
            location: formatStringValue(sourceData.location || ''),
            city: formatStringValue(sourceData.city || sourceData.location || ''),
            salaryRange: formatStringValue(sourceData.salaryRange || sourceData.salary || ''),
            genderRequirement: sourceData.genderRequirement || sourceData.gender || 'Any',
            strictGenderMatch: sourceData.strictGenderMatch ?? false,
            strictLocationMatch: sourceData.strictLocationMatch ?? false,
            strictEducationMatch: sourceData.strictEducationMatch ?? false,
            strictExperienceMatch: sourceData.strictExperienceMatch ?? false,
            strictness: sourceData.strictness || 'Low',
            entryBy: resolvedEntryBy,
            status: sourceData.status || 'Active',
          });

          setCustomFields(cleanLoadedCustomFields);

          // Parse candidates
          const emails = sourceData.candidateEmails || [];
          setCandidateEmails(emails);

          const candDataRaw = sourceData.candidateData || sourceData.candidateDataList || [];
          if (Array.isArray(candDataRaw) && candDataRaw.length > 0) {
            setCandidateDataList(candDataRaw);
          } else if (emails.length > 0) {
            setCandidateDataList(emails.map((e: string) => ({ email: e, phone: '' })));
          }
        } else {
          alert('Job or Interview not found.');
          handleClose();
        }
      } catch (err) {
        console.error('Error fetching job:', err);
        alert('Error loading job details');
        handleClose();
      } finally {
        if (activeJobId && user) setLoading(false);
      }
    };

    fetchJob();
  }, [activeJobId, user]);

  const aiRecommendedSkills = useMemo(() => {
    const jobText = `${formData.title} ${formData.category} ${formData.description} ${formData.skills}`.toLowerCase();
    const detected = extractSkillSignals(jobText);
    const currentList = splitCommaList(formData.skills);
    const combined = Array.from(new Set([...currentList, ...detected]));

    if (skillSearch.trim()) {
      const q = skillSearch.trim().toLowerCase();
      return combined.filter((s) => s.toLowerCase().includes(q));
    }
    return combined;
  }, [formData.title, formData.category, formData.description, formData.skills, skillSearch]);

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
    setCustomFields(customFields.filter((field) => field.id !== id));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const val = type === 'checkbox' ? target.checked : value;
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: ['experience', 'minExperience', 'maxExperience', 'numQuestions'].includes(name) ? Number(value) : val,
      };
      if (name === 'minExperience') {
        updated.experience = Number(value);
      }
      return updated;
    });
  };

  const handleAddCandidate = () => {
    const trimmedEmail = currentEmail.trim();
    const trimmedPhone = currentPhone.trim();

    if (!trimmedEmail && !trimmedPhone) return;

    const newContact: CandidateContact = {
      email: trimmedEmail,
      phone: trimmedPhone,
    };

    if (trimmedEmail && !candidateEmails.includes(trimmedEmail)) {
      setCandidateEmails((prev) => [...prev, trimmedEmail]);
    }

    setCandidateDataList((prev) => {
      const exists = prev.some((c) => (trimmedEmail && c.email === trimmedEmail) || (trimmedPhone && c.phone === trimmedPhone));
      if (!exists) {
        return [...prev, newContact];
      }
      return prev;
    });

    setCurrentEmail('');
    setCurrentPhone('');
  };

  const handleRemoveCandidate = (index: number) => {
    const target = candidateDataList[index];
    if (!target) return;

    setCandidateDataList((prev) => prev.filter((_, i) => i !== index));
    if (target.email) {
      setCandidateEmails((prev) => prev.filter((e) => e !== target.email));
    }
  };

  const toggleSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;

    const currentSkills = splitCommaList(formData.skills);
    let newSkills: string[];
    if (currentSkills.includes(trimmed)) {
      newSkills = currentSkills.filter((s) => s !== trimmed);
    } else {
      newSkills = [...currentSkills, trimmed];
    }
    setFormData({ ...formData, skills: newSkills.join(', ') });
  };

  const toggleEducation = (edu: string) => {
    const currentEducations = splitCommaList(formData.qualifications);
    let newEducations: string[];
    if (currentEducations.includes(edu)) {
      newEducations = currentEducations.filter((e) => e !== edu);
    } else {
      newEducations = [...currentEducations, edu];
    }
    setFormData({ ...formData, qualifications: newEducations.join(', ') });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeJobId) return;

    if (Number(formData.maxExperience) < Number(formData.minExperience)) {
      alert('❌ Maximum experience cannot be less than minimum experience.');
      return;
    }

    setSaving(true);

    try {
      const deadlineDate = formData.deadline ? new Date(formData.deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const jobDocRef = doc(db, 'jobs', targetDocId);
      const interviewDocRef = doc(db, 'interviews', targetDocId);

      const allEmails = Array.from(new Set([
        ...candidateEmails,
        ...candidateDataList.map((c) => c.email).filter(Boolean),
      ]));

      const minExp = Number(formData.minExperience) || 0;
      const maxExp = Number(formData.maxExperience) || 0;
      const expString = maxExp > minExp ? `${minExp} - ${maxExp} Years` : (minExp > 0 ? `${minExp} Years` : '0 - 2 Years');

      const resolvedJobNo = formData.jobNo ? String(formData.jobNo).trim() : (accessCode || targetDocId);
      const resolvedAccessCode = resolvedJobNo;

      const jobPayload = {
        jobNo: resolvedJobNo,
        accessCode: resolvedAccessCode,
        title: formData.title,
        companyName: formData.companyName,
        company: formData.companyName,
        companyDetails: formData.companyDetails,
        jobLink: formData.jobLink,
        industryName: formData.industryName,
        sector: formData.industryName,
        roleName: formData.roleName,
        roleCategory: formData.roleName || formData.category,
        qualifications: formData.qualifications,
        education: formData.qualifications,
        description: formData.description,
        interviewPermission: formData.permission,
        permission: formData.permission,
        skills: formData.skills,
        numQuestions: Number(formData.numQuestions),
        customFields,
        category: formData.category,
        department: formData.category,
        jobCategory: formData.category,
        employmentType: formData.employmentType,
        minExperience: minExp,
        maxExperience: maxExp,
        experience: expString,
        location: formData.location,
        city: formData.city || formData.location,
        salaryRange: formData.salaryRange,
        salary: formData.salaryRange,
        genderRequirement: formData.genderRequirement,
        gender: formData.genderRequirement,
        strictGenderMatch: formData.strictGenderMatch,
        strictLocationMatch: formData.strictLocationMatch,
        strictEducationMatch: formData.strictEducationMatch,
        strictExperienceMatch: formData.strictExperienceMatch,
        strictness: formData.strictness,
        entryBy: formData.entryBy,
        status: formData.status,
        applyDeadline: Timestamp.fromDate(deadlineDate),
        difficulty: formData.difficulty,
        candidateEmails: allEmails,
        candidateData: candidateDataList,
        candidateDataList: candidateDataList,
        updatedAt: serverTimestamp(),
      };

      const interviewPayload = {
        jobNo: resolvedJobNo,
        accessCode: resolvedAccessCode,
        title: `${formData.title} Interview`,
        companyName: formData.companyName,
        company: formData.companyName,
        companyDetails: formData.companyDetails,
        jobLink: formData.jobLink,
        industryName: formData.industryName,
        sector: formData.industryName,
        roleName: formData.roleName,
        roleCategory: formData.roleName || formData.category,
        description: formData.description,
        category: formData.category,
        department: formData.category,
        jobCategory: formData.category,
        employmentType: formData.employmentType,
        minExperience: minExp,
        maxExperience: maxExp,
        experience: expString,
        skills: formData.skills,
        education: formData.qualifications,
        qualification: formData.qualifications,
        location: formData.location,
        city: formData.city || formData.location,
        salaryRange: formData.salaryRange,
        salary: formData.salaryRange,
        genderRequirement: formData.genderRequirement,
        gender: formData.genderRequirement,
        strictGenderMatch: formData.strictGenderMatch,
        strictLocationMatch: formData.strictLocationMatch,
        strictEducationMatch: formData.strictEducationMatch,
        strictExperienceMatch: formData.strictExperienceMatch,
        strictness: formData.strictness,
        entryBy: formData.entryBy,
        status: formData.status,
        deadline: formData.deadline,
        numQuestions: Number(formData.numQuestions),
        customFields,
        difficulty: formData.difficulty,
        candidateEmails: allEmails,
        candidateData: candidateDataList,
        candidateDataList: candidateDataList,
        updatedAt: serverTimestamp(),
      };

      await setDoc(jobDocRef, jobPayload, { merge: true });
      await updateDoc(interviewDocRef, interviewPayload).catch(async () => {
        await setDoc(interviewDocRef, interviewPayload, { merge: true });
      });

      handleClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update job');
    } finally {
      setSaving(false);
    }
  };

  // Design Tokens identical to CreateInterview.tsx
  const labelClass = 'geist-label mb-1.5 block text-gray-700 dark:text-[#a1a1aa]';
  const inputClass = 'geist-caption h-9 w-full rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#050505] px-3 text-gray-900 dark:text-white outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#6b7280] focus:border-indigo-500 dark:focus:border-white/[0.28] disabled:cursor-not-allowed disabled:opacity-50';
  const textareaClass = 'geist-caption min-h-[132px] w-full resize-y rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#050505] px-3 py-2.5 text-gray-900 dark:text-white outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#6b7280] focus:border-indigo-500 dark:focus:border-white/[0.28]';
  const selectClass = 'geist-caption h-9 w-full rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#050505] px-3 text-gray-900 dark:text-white outline-none transition-colors focus:border-indigo-500 dark:focus:border-white/[0.28]';
  const primaryButtonClass = 'geist-caption inline-flex h-10 items-center justify-center rounded-[6px] bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 shadow-md dark:shadow-none cursor-pointer';
  const secondaryButtonClass = 'geist-caption inline-flex h-9 shrink-0 items-center justify-center rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-white/[0.03] px-3.5 font-semibold text-gray-800 dark:text-[#d4d4d4] transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 shadow-sm dark:shadow-none cursor-pointer';
  const panelHeaderClass = 'geist-label uppercase text-gray-500 dark:text-[#6b7280]';
  const panelTitleClass = 'geist-section-title mt-1 text-gray-900 dark:text-white';
  const helperTextClass = 'geist-small mt-1 max-w-2xl text-gray-600 dark:text-[#8f8f8f]';

  const isModal = Boolean(onClose);

  const innerContent = (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] bg-white dark:bg-[#000] text-gray-900 dark:text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-white/[0.11] bg-white dark:bg-[#000]">
        <div className="px-4 py-5 sm:px-6 lg:px-7 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="geist-label uppercase text-gray-500 dark:text-[#6b7280]">Job setup</p>
              {formData.jobNo && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10">
                  #{formData.jobNo}
                </span>
              )}
            </div>
            <h1 className="geist-page-title mt-2 text-gray-900 dark:text-white">Edit Job</h1>
            <p className="geist-small mt-1 max-w-2xl text-gray-600 dark:text-[#8f8f8f]">
              Update job opening details, role specifications, candidate matching criteria, and invites from one focused workspace.
            </p>
          </div>
          {isModal && (
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.42fr)_1px_minmax(0,1fr)] gap-8">
            <div className="space-y-4">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-8 w-48" />
              <SkeletonBlock className="h-28 w-full" />
            </div>
            <div className="hidden bg-gray-200 dark:bg-white/[0.11] lg:block" />
            <div className="space-y-4">
              <SkeletonBlock className="h-6 w-40" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-32 w-full" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.42fr)_1px_minmax(0,1fr)] flex-1">
          {/* Aside Column */}
          <aside className="border-b border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-[#020202] px-4 py-5 sm:px-6 lg:border-b-0 lg:px-7">
            <div className="lg:sticky lg:top-[5.25rem] space-y-4">
              <div>
                <p className={panelHeaderClass}>Source</p>
                <h2 className={panelTitleClass}>Update from a job description</h2>
                <p className={helperTextClass}>
                  Upload a PDF/TXT, paste raw JD text, or fetch from URL to auto-fill details & update dynamic fields.
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
                    htmlFor="edit-jd-upload"
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
                  <input id="edit-jd-upload" type="file" accept=".pdf,.txt" className="hidden" onChange={handleJDUpload} disabled={parsingJd} />
                </>
              ) : jdImportMode === 'paste' ? (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={pastedJdText}
                    onChange={(e) => setPastedJdText(e.target.value)}
                    placeholder="Paste complete Job Description text here..."
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

              {/* Status & Meta Info */}
              <div className="mt-7 border-t border-gray-200 dark:border-white/[0.11] pt-5">
                <p className={panelHeaderClass}>Status & Meta</p>
                <div className="mt-3 divide-y divide-gray-200 dark:divide-white/[0.11] border border-gray-200 dark:border-white/[0.11] rounded-[6px] bg-white dark:bg-transparent">
                  <div className="px-3 py-3">
                    <p className="geist-caption font-medium text-gray-900 dark:text-white">Job Status</p>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleFormChange}
                      className={`${selectClass} mt-1`}
                    >
                      <option value="Active">Active (Visible)</option>
                      <option value="Inactive">Inactive (Hidden / Expired)</option>
                    </select>
                  </div>
                  <div className="px-3 py-3">
                    <p className="geist-caption font-medium text-gray-900 dark:text-white">Job Number / Access Code</p>
                    <p className="geist-small mt-0.5 text-gray-500 dark:text-[#8f8f8f] font-mono">
                      {formData.jobNo || accessCode || targetDocId}
                    </p>
                  </div>
                  <div className="px-3 py-3">
                    <p className="geist-caption font-medium text-gray-900 dark:text-white">Entered By</p>
                    <input
                      name="entryBy"
                      type="text"
                      className={`${inputClass} mt-1`}
                      value={formData.entryBy}
                      onChange={handleFormChange}
                      placeholder="e.g. Rohini Chaure"
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="hidden bg-gray-200 dark:bg-white/[0.11] lg:block" />

          {/* Main Form Column */}
          <form onSubmit={handleSubmit} className="min-w-0 bg-white dark:bg-[#000] flex flex-col justify-between">
            <div>
              {/* Section 1: Brief - Role details */}
              <section className="border-b border-gray-200 dark:border-white/[0.11] px-4 py-5 sm:px-6 lg:px-7">
                <p className={panelHeaderClass}>Brief</p>
                <h2 className={panelTitleClass}>Role details</h2>
                <p className={helperTextClass}>Keep the requirements specific so candidate matching and applications stay relevant.</p>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div>
                    <label className={labelClass}>Job Number / Code (Optional)</label>
                    <input
                      name="jobNo"
                      type="text"
                      className={inputClass}
                      value={formData.jobNo}
                      onChange={handleFormChange}
                      placeholder="e.g. Job No: 1042 or REQ-901"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Job title / role <span className="text-red-500 dark:text-red-400">*</span></label>
                    <input
                      name="title"
                      type="text"
                      required
                      className={inputClass}
                      value={formData.title}
                      onChange={handleFormChange}
                      placeholder="Senior Frontend Engineer"
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <label className={labelClass}>Job description <span className="text-red-500 dark:text-red-400">*</span></label>
                    <textarea
                      name="description"
                      required
                      rows={5}
                      className={textareaClass}
                      value={formData.description}
                      onChange={handleFormChange}
                      placeholder="Describe the role, responsibilities, and what you are looking for."
                    />
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

                  <div>
                    <label className={labelClass}>Industry Sector</label>
                    <input
                      name="industryName"
                      type="text"
                      className={inputClass}
                      value={formData.industryName}
                      onChange={handleFormChange}
                      placeholder="e.g. IT Services / Manufacturing"
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <label className={labelClass}>Company Details & Overview (Optional)</label>
                    <textarea
                      name="companyDetails"
                      rows={3}
                      className={textareaClass}
                      value={formData.companyDetails}
                      onChange={handleFormChange}
                      placeholder="Enter company profile, background, product overview, or recruiter company details..."
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <label className={labelClass}>Job Link / External URL</label>
                    <input
                      name="jobLink"
                      type="url"
                      className={inputClass}
                      value={formData.jobLink}
                      onChange={handleFormChange}
                      placeholder="e.g. https://careers.company.com/job-101"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Employment type</label>
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
                      <option value="Freelance">Freelance</option>
                      <option value="Remote">Remote</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Required experience</label>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
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
                      <span className="geist-small text-gray-500 dark:text-[#6b7280]">to</span>
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
                    <input
                      name="salaryRange"
                      type="text"
                      required
                      className={inputClass}
                      value={formData.salaryRange}
                      onChange={handleFormChange}
                      placeholder="e.g. 20,000 - 22,000 / per month or 4 - 6 LPA"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Gender requirement</label>
                    <select
                      name="genderRequirement"
                      className={selectClass}
                      value={formData.genderRequirement}
                      onChange={handleFormChange}
                    >
                      <option value="Any">Any</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {/* Education level */}
                  <div className="xl:col-span-2">
                    <label className={labelClass}>Minimum education level</label>
                    <div className="min-h-10 rounded-[6px] border border-gray-300 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.025] p-2">
                      <div className="flex flex-wrap gap-2">
                        {splitCommaList(formData.qualifications).length > 0 ? splitCommaList(formData.qualifications).map((edu) => (
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
                          {EDUCATION_QUALIFICATIONS.map((qual) => (
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
                              e.target.value = '';
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
                          ).map((spec) => (
                            <option key={spec} value={spec}>{spec}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Skills - Required capabilities */}
              <section className="border-b border-gray-200 dark:border-white/[0.11] px-4 py-5 sm:px-6 lg:px-7">
                <p className={panelHeaderClass}>Skills</p>
                <h2 className={panelTitleClass}>Required capabilities</h2>
                <p className={helperTextClass}>Select existing skills or add a custom requirement.</p>

                <div className="mt-5 min-h-10 rounded-[6px] border border-gray-300 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.025] p-2">
                  <div className="flex flex-wrap gap-2">
                    {splitCommaList(formData.skills).length > 0 ? splitCommaList(formData.skills).map((skill) => (
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
                  </div>
                </div>
              </section>

              {/* Section 3: Additional Info - Custom fields */}
              <section className="border-b border-gray-200 dark:border-white/[0.11] px-4 py-5 sm:px-6 lg:px-7">
                <p className={panelHeaderClass}>Additional Info</p>
                <h2 className={panelTitleClass}>Custom fields</h2>
                <p className={helperTextClass}>Attach optional custom fields to this job post (e.g. Perks, Working Hours, Client Code).</p>

                <div className="mt-4 rounded-[6px] border border-gray-200 dark:border-white/[0.11] bg-gray-50 dark:bg-white/[0.025] p-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="Field name, e.g. Perks"
                      value={tempCustomField.key}
                      onChange={(e) => setTempCustomField({ ...tempCustomField, key: e.target.value })}
                    />
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="Field value, e.g. Day Shift, Cab facility"
                      value={tempCustomField.value}
                      onChange={(e) => setTempCustomField({ ...tempCustomField, value: e.target.value })}
                    />
                    <button type="button" onClick={handleAddCustomField} className={secondaryButtonClass}>
                      Add
                    </button>
                  </div>

                  {customFields.length > 0 && (
                    <div className="mt-3 divide-y divide-gray-200 dark:divide-white/[0.11] border border-gray-200 dark:border-white/[0.11] rounded-[6px] bg-white dark:bg-[#050505]">
                      {customFields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between p-2.5 text-xs">
                          <p className="geist-caption min-w-0 truncate text-gray-800 dark:text-[#d4d4d4]">
                            <span className="font-medium text-gray-900 dark:text-white">{field.key}:</span> {field.value}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(field.id)}
                            className="geist-small shrink-0 text-red-500 dark:text-[#8f8f8f] transition-colors hover:text-red-700 dark:hover:text-white font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="sticky bottom-0 border-t border-gray-200 dark:border-white/[0.11] bg-white/95 dark:bg-[#000]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-7 shadow-lg dark:shadow-none z-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="geist-small text-gray-500 dark:text-[#8f8f8f]">
                  Job updates sync across active listings, ATS matching, and candidate pipelines.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={primaryButtonClass}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Saving Changes...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Save & Update Job Details</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md overflow-y-auto">
        <div className="min-h-full max-w-7xl mx-auto my-0 sm:my-6 rounded-none sm:rounded-[10px] border-0 sm:border border-gray-200 dark:border-white/[0.13] shadow-2xl overflow-hidden bg-white dark:bg-[#000]">
          {innerContent}
        </div>
      </div>,
      document.body
    );
  }

  return innerContent;
};

export default EditJob;
