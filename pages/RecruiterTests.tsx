import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Code,
  Copy,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  CheckCircle2,
  TrendingUp,
  Layers,
  Clock,
  Target,
  Share2,
  FileCheck,
  Check,
  AlertCircle,
  Edit3,
  UserPlus,
  Mail,
  Phone,
  MessageCircle,
  UserCheck,
  X,
  Send,
  UploadCloud,
  CheckCheck,
  FileSpreadsheet,
  Table,
  Clipboard,
  FileUp,
  Loader2
} from 'lucide-react';
import { parseCandidateDocument, parseBulkCandidateTextInput } from '../services/candidateFileParser';
import { useMessageBox } from '../components/MessageBox';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';
import { getRateLimitReachedMessage, isRateLimitReached, RateLimitResource } from '../services/rateLimitService';
import { sendAssessmentEmailInvitations } from '../services/sesService';
import {
  formatPhoneForWhatsApp,
  openWhatsAppWebInvite,
  sendAssessmentWhatsAppInvite
} from '../services/waSenderService';

type TimestampLike =
  | {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
    }
  | Date
  | string
  | null
  | undefined;

const toMillis = (value: TimestampLike): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const formatDate = (value: TimestampLike): string => {
  const millis = toMillis(value);
  if (!millis) return 'Recently';
  return new Date(millis).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const getAssessmentLink = (testId: string) => `${window.location.origin}/test/${testId}`;

const getStats = (test: any, submissions: any[]) => {
  const passingScore = Number(test.passingScore ?? 70);
  const totalScore = submissions.reduce((sum, submission) => sum + (Number(submission.score) || 0), 0);

  return {
    submissions: submissions.length,
    averageScore: submissions.length ? Math.round(totalScore / submissions.length) : 0,
    passed: submissions.filter((submission) => submission.status === 'passed' || Number(submission.score) >= passingScore).length,
  };
};

const getTestSkills = (test: any): string[] => {
  if (Array.isArray(test.skills) && test.skills.length > 0) return test.skills;
  if (typeof test.skills === 'string' && test.skills.trim()) {
    return test.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  
  const tags: string[] = [];
  if (test.type === 'coding') {
    tags.push('Coding Challenge');
    tags.push('Algorithms');
  } else {
    tags.push('Aptitude Screen');
    tags.push('Analytical Logic');
  }

  if (Array.isArray(test.questions)) {
    test.questions.forEach((q: any) => {
      if (q.difficulty && !tags.includes(q.difficulty)) tags.push(q.difficulty);
      if (q.category && !tags.includes(q.category)) tags.push(q.category);
    });
  }
  return tags.slice(0, 4);
};

export const isTestActive = (test: any): boolean => {
  if (test.isActive === false) return false;
  if (typeof test.status === 'string') {
    const s = test.status.toLowerCase().trim();
    if (s === 'inactive' || s === 'deactivated' || s === 'closed' || s === 'paused' || s === 'expired') {
      return false;
    }
  }
  return true;
};

const RecruiterTests: React.FC = () => {
  const { userProfile } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'aptitude' | 'coding'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [togglingTestId, setTogglingTestId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Force light theme on recruiter tests page for consistent clean high-contrast view
    const root = document.documentElement;
    root.classList.remove('dark');
  }, []);
  const { showConfirm, showError, showSuccess } = useMessageBox();
  const { status: rateLimitStatus } = useCompanyRateLimits();
  const assessmentLimitReached = isRateLimitReached(rateLimitStatus, 'assessments');
  const codingLimitReached = isRateLimitReached(rateLimitStatus, 'codingAssessments');

  // Candidate Invitation Modal State
  const [invitingTest, setInvitingTest] = useState<any | null>(null);
  const [inviteMode, setInviteMode] = useState<'ai_suggest' | 'bulk' | 'invited'>('ai_suggest');
  const [inviteEmailsList, setInviteEmailsList] = useState<string[]>([]);
  const [candidateDetailsMap, setCandidateDetailsMap] = useState<Record<string, { name: string; phone: string; experience?: string }>>({});
  const [bulkSubMode, setBulkSubMode] = useState<'form' | 'spreadsheet'>('form');
  const [bulkPasteType, setBulkPasteType] = useState<'email' | 'phone' | 'mixed'>('email');
  const [candidateEmailsInput, setCandidateEmailsInput] = useState('');
  const [singleCandidateName, setSingleCandidateName] = useState('');
  const [singleCandidateEmail, setSingleCandidateEmail] = useState('');
  const [singleCandidatePhone, setSingleCandidatePhone] = useState('');
  const [spreadsheetRows, setSpreadsheetRows] = useState<Array<{ id: string; name: string; email: string; phone: string }>>([
    { id: 'row_1', name: '', email: '', phone: '' },
    { id: 'row_2', name: '', email: '', phone: '' },
    { id: 'row_3', name: '', email: '', phone: '' },
  ]);
  const [isUploadingSpreadsheet, setIsUploadingSpreadsheet] = useState(false);
  const [dumpCandidates, setDumpCandidates] = useState<any[]>([]);
  const [loadingDumpCandidates, setLoadingDumpCandidates] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendEmailChannel, setSendEmailChannel] = useState(true);
  const [sendWhatsAppChannel, setSendWhatsAppChannel] = useState(true);
  const [copiedModalLink, setCopiedModalLink] = useState(false);
  const [remindingEmail, setRemindingEmail] = useState<string | null>(null);

  const guardCreateLink = (event: React.MouseEvent, resource: RateLimitResource) => {
    if (!isRateLimitReached(rateLimitStatus, resource)) return;
    event.preventDefault();
    showError(getRateLimitReachedMessage(resource));
  };

  useEffect(() => {
    const fetchTests = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const primaryUid = userProfile?.parentRecruiterId || (userProfile as any)?.primaryRecruiterUID || userProfile?.teamId || currentUser.uid;
        const isAdmin = (userProfile?.role || '').toLowerCase() === 'admin';

        const docMap = new Map<string, any>();
        if (isAdmin) {
          const snap = await getDocs(collection(db, 'tests'));
          snap.docs.forEach(d => docMap.set(d.id, { id: d.id, ...d.data() }));
        } else {
          const promises = [];
          if (primaryUid) {
            promises.push(getDocs(query(collection(db, 'tests'), where('teamId', '==', primaryUid))));
            promises.push(getDocs(query(collection(db, 'tests'), where('recruiterUID', '==', primaryUid))));
            promises.push(getDocs(query(collection(db, 'tests'), where('parentRecruiterId', '==', primaryUid))));
          }
          if (currentUser.uid && currentUser.uid !== primaryUid) {
            promises.push(getDocs(query(collection(db, 'tests'), where('recruiterUID', '==', currentUser.uid))));
          }
          const results = await Promise.all(promises);
          results.forEach(snap => {
            snap.docs.forEach(d => docMap.set(d.id, { id: d.id, ...d.data() }));
          });
        }

        const fetchedTests = Array.from(docMap.values());
        fetchedTests.sort((a: any, b: any) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setTests(fetchedTests);

        const nextSubmissionsMap: Record<string, any[]> = Object.fromEntries(fetchedTests.map((test: any) => [test.id, []]));
        const idChunks = chunkArray(fetchedTests.map((test: any) => test.id), 10);

        for (const idChunk of idChunks) {
          const submissionsQuery = query(collection(db, 'testSubmissions'), where('testId', 'in', idChunk));
          const submissionsSnap = await getDocs(submissionsQuery);
          submissionsSnap.docs.forEach((submissionDoc) => {
            const submission = { id: submissionDoc.id, ...submissionDoc.data() } as any;
            if (!nextSubmissionsMap[submission.testId]) nextSubmissionsMap[submission.testId] = [];
            nextSubmissionsMap[submission.testId].push(submission);
          });
        }

        setSubmissionsMap(nextSubmissionsMap);
      } catch (error) {
        console.error('Error fetching assessments:', error);
        showError('Unable to load assessments.');
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [showError, userProfile]);

  const handleDelete = async (id: string) => {
    showConfirm('Delete this assessment and remove it from your workspace?', async () => {
      try {
        await deleteDoc(doc(db, 'tests', id));
        setTests((currentTests) => currentTests.filter(test => test.id !== id));
        setSubmissionsMap((currentMap) => {
          const nextMap = { ...currentMap };
          delete nextMap[id];
          return nextMap;
        });
        showSuccess('Assessment deleted successfully.');
      } catch (error) {
        console.error('Error deleting assessment:', error);
        showError('Unable to delete assessment.');
      }
    });
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(successMessage);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      showError('Unable to copy to clipboard.');
    }
  };

  const handleToggleTestStatus = (test: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const currentIsActive = isTestActive(test);
    const newStatus = currentIsActive ? 'Inactive' : 'Active';
    const newIsActive = !currentIsActive;
    const actionVerb = newIsActive ? 'activate' : 'deactivate';
    const actionLabel = newIsActive ? 'activated' : 'deactivated';

    showConfirm(
      `Are you sure you want to ${actionVerb} "${test.title}"? ${
        newIsActive
          ? 'This will make the assessment active and available for candidates to take.'
          : 'This will deactivate the assessment and candidates will no longer be able to access or start it.'
      }`,
      async () => {
        setTogglingTestId(test.id);

        // 1. Optimistic UI update
        setTests((prevTests) =>
          prevTests.map((t) => {
            if (t.id === test.id) {
              return {
                ...t,
                status: newStatus,
                isActive: newIsActive,
              };
            }
            return t;
          })
        );

        try {
          // 2. Sync to Firestore in 'tests' collection
          await updateDoc(doc(db, 'tests', test.id), {
            status: newStatus,
            isActive: newIsActive,
            updatedAt: serverTimestamp(),
          });

          showSuccess(`Assessment "${test.title}" has been successfully ${actionLabel}!`);
        } catch (err: any) {
          console.error('[handleToggleTestStatus] Error toggling status:', err);
          // Revert optimistic update
          setTests((prevTests) =>
            prevTests.map((t) => {
              if (t.id === test.id) {
                return {
                  ...t,
                  status: currentIsActive ? 'Active' : 'Inactive',
                  isActive: currentIsActive,
                };
              }
              return t;
            })
          );
          showError(`Failed to update assessment status: ${err?.message || 'Unknown error'}`);
        } finally {
          setTogglingTestId(null);
        }
      }
    );
  };

  // Fetch candidate dump for AI recommendations when invite modal opens
  useEffect(() => {
    if (!invitingTest) return;
    setLoadingDumpCandidates(true);
    getDocs(query(collection(db, 'resumeDumpCandidates')))
      .then((snap) => {
        const list = snap.docs
          .map((snapshotDoc) => {
            const data = snapshotDoc.data();
            const prof = data.profile && typeof data.profile === 'object' ? data.profile : {};
            const email = (data.email || prof.email || '').toLowerCase().trim();
            const name = data.name || prof.name || 'Candidate';
            const phone = data.phone || prof.phone || '';
            const location = data.location || prof.location || data.city || prof.city || '';
            const skills = Array.isArray(data.skills)
              ? data.skills
              : Array.isArray(prof.skills)
              ? prof.skills
              : [];
            const domain = data.domain || prof.domain || '';
            const currentTitle = data.currentTitle || prof.currentTitle || data.sourceJobTitle || '';
            const experienceYears =
              data.totalExperienceYears ??
              data.experienceYears ??
              prof.totalExperienceYears ??
              prof.experienceYears ??
              0;

            return {
              id: snapshotDoc.id,
              name,
              email,
              phone,
              location,
              skills,
              domain,
              currentTitle,
              experienceYears,
            };
          })
          .filter((c) => Boolean(c.email));
        setDumpCandidates(list);
      })
      .catch((err) => {
        console.warn('Error loading dump candidates for suggestions:', err);
      })
      .finally(() => {
        setLoadingDumpCandidates(false);
      });
  }, [invitingTest]);

  // AI Matching for Test Invitations based on test title and candidate skills/domain
  const suggestedCandidates = useMemo(() => {
    if (!invitingTest || !dumpCandidates.length) return [];
    const alreadyInvited = (invitingTest.candidateEmails || []).map((e: string) => e.toLowerCase().trim());
    const testTitleLower = (invitingTest.title || '').toLowerCase();
    const testKeywords = testTitleLower
      .split(/[\s,/\-_()]+/)
      .map((w: string) => w.trim())
      .filter((w: string) => w.length > 2);

    return dumpCandidates
      .filter((c) => !alreadyInvited.includes(c.email))
      .map((c) => {
        let matchScore = 55;
        const candSkills = c.skills.map((s: string) => s.toLowerCase());
        const candTitle = (c.currentTitle || '').toLowerCase();
        const candDomain = (c.domain || '').toLowerCase();

        testKeywords.forEach((kw: string) => {
          if (candSkills.some((s: string) => s.includes(kw))) matchScore += 18;
          if (candTitle.includes(kw)) matchScore += 22;
          if (candDomain.includes(kw)) matchScore += 12;
        });

        if (
          invitingTest.type === 'coding' &&
          candSkills.some((s: string) =>
            ['javascript', 'typescript', 'react', 'python', 'java', 'c++', 'golang', 'node', 'full stack'].includes(s)
          )
        ) {
          matchScore += 10;
        }

        return { ...c, matchScore: Math.min(99, matchScore) };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [invitingTest, dumpCandidates]);

  const toggleCandidateInInviteList = (
    email: string,
    candMeta?: { name?: string; phone?: string; experience?: string }
  ) => {
    const target = email.toLowerCase().trim();
    if (!target) return;
    setInviteEmailsList((prev) =>
      prev.includes(target) ? prev.filter((e) => e !== target) : [...prev, target]
    );
    if (candMeta) {
      setCandidateDetailsMap((prev) => ({
        ...prev,
        [target]: {
          name: candMeta.name || target.split('@')[0],
          phone: candMeta.phone || '',
          experience: candMeta.experience || '',
        },
      }));
    }
  };

  const handleSelectAllSuggested = () => {
    const slice = suggestedCandidates.slice(0, 20);
    const allSuggestedEmails = slice.map((c) => c.email.toLowerCase().trim());
    setInviteEmailsList((prev) => Array.from(new Set([...prev, ...allSuggestedEmails])));
    setCandidateDetailsMap((prev) => {
      const next = { ...prev };
      slice.forEach((c) => {
        const em = c.email.toLowerCase().trim();
        next[em] = {
          name: c.name || em.split('@')[0],
          phone: c.phone || '',
          experience: c.experienceYears ? `${c.experienceYears}y exp` : '',
        };
      });
      return next;
    });
    showSuccess(`Selected top ${Math.min(20, suggestedCandidates.length)} AI suggested candidates!`);
  };

  const handleClearSelectedInvites = () => {
    setInviteEmailsList([]);
    setCandidateDetailsMap({});
    showSuccess('Cleared selected candidates from invite list.');
  };

  const handleAddSingleCandidate = () => {
    const cleanEmail = singleCandidateEmail.trim().toLowerCase();
    const cleanPhone = singleCandidatePhone.trim();
    const cleanName =
      singleCandidateName.trim() ||
      (cleanEmail ? cleanEmail.split('@')[0] : cleanPhone ? `Candidate ${cleanPhone.slice(-4)}` : 'Candidate');

    if (!cleanEmail && !cleanPhone) {
      showError('Please enter at least an Email address or Mobile phone number.');
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showError('Please enter a valid email address.');
      return;
    }

    const key = cleanEmail || `${cleanPhone.replace(/\D/g, '')}@candidate.whatsapp`;

    if (inviteEmailsList.includes(key)) {
      showError('This candidate is already in the invite list.');
      return;
    }

    setCandidateDetailsMap((prev) => ({
      ...prev,
      [key]: {
        name: cleanName,
        phone: cleanPhone,
        experience: 'Direct Entry',
      },
    }));

    setInviteEmailsList((prev) => [...prev, key]);

    setDumpCandidates((prev) => [
      {
        id: `manual_${Date.now()}`,
        name: cleanName,
        email: key,
        phone: cleanPhone,
        skills: [],
        experienceYears: 0,
      },
      ...prev.filter((c) => c.email.toLowerCase() !== key),
    ]);

    setSingleCandidateName('');
    setSingleCandidateEmail('');
    setSingleCandidatePhone('');
    showSuccess(`Added ${cleanName} (${cleanEmail || cleanPhone}) to invite list!`);
  };

  const handleAddBulkInput = () => {
    const rawText = candidateEmailsInput.trim();
    if (!rawText) {
      showError('Please enter or paste candidate details first.');
      return;
    }

    let added = 0;

    if (bulkPasteType === 'email') {
      const extractedEmails = rawText
        .split(/[\n,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

      if (extractedEmails.length === 0) {
        showError('No valid email addresses found in pasted text.');
        return;
      }

      setInviteEmailsList((prev) => {
        const set = new Set(prev);
        extractedEmails.forEach((em) => {
          if (!set.has(em)) {
            set.add(em);
            added++;
          }
        });
        return Array.from(set);
      });

      setCandidateDetailsMap((prev) => {
        const next = { ...prev };
        extractedEmails.forEach((em) => {
          if (!next[em]) {
            const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === em);
            next[em] = {
              name: dumpMatch?.name || em.split('@')[0],
              phone: dumpMatch?.phone || '',
              experience: dumpMatch?.experienceYears ? `${dumpMatch.experienceYears}y exp` : '',
            };
          }
        });
        return next;
      });

      setCandidateEmailsInput('');
      showSuccess(`Added ${added} candidate email(s) to invite list!`);
    } else if (bulkPasteType === 'phone') {
      const phoneCandidates = rawText
        .split(/[\n,;\r]+/)
        .map((p) => p.trim())
        .filter(Boolean);

      const validPhones: string[] = [];
      phoneCandidates.forEach((line) => {
        const nums = line.split(/[,\s]+/).map((n) => n.trim()).filter((n) => n.replace(/\D/g, '').length >= 10);
        validPhones.push(...nums);
      });

      const uniquePhones = Array.from(new Set(validPhones));
      if (uniquePhones.length === 0) {
        showError('No valid 10+ digit mobile numbers found in pasted text.');
        return;
      }

      uniquePhones.forEach((phone) => {
        const digits = phone.replace(/\D/g, '');
        const key = `${digits}@candidate.whatsapp`;
        if (!inviteEmailsList.includes(key)) {
          setInviteEmailsList((prev) => [...prev, key]);
          added++;
        }
        setCandidateDetailsMap((prev) => ({
          ...prev,
          [key]: {
            name: `Candidate (${phone.slice(-4)})`,
            phone,
            experience: 'Phone Import',
          },
        }));
      });

      setCandidateEmailsInput('');
      showSuccess(`Added ${added} candidate phone number(s) to invite list!`);
    } else {
      // Mixed Name, Email, Phone
      const parsed = parseBulkCandidateTextInput(rawText);
      if (parsed.length === 0) {
        showError('Could not extract candidate contacts. Make sure entries contain an email or mobile phone.');
        return;
      }

      parsed.forEach((c) => {
        const cleanEmail = (c.email || '').trim().toLowerCase();
        const cleanPhone = (c.phone || '').trim();
        const cleanName =
          (c.name || '').trim() ||
          (cleanEmail ? cleanEmail.split('@')[0] : `Candidate ${cleanPhone.slice(-4)}`);
        const key = cleanEmail || `${cleanPhone.replace(/\D/g, '')}@candidate.whatsapp`;

        if (!inviteEmailsList.includes(key)) {
          setInviteEmailsList((prev) => [...prev, key]);
          added++;
        }

        setCandidateDetailsMap((prev) => ({
          ...prev,
          [key]: {
            name: cleanName,
            phone: cleanPhone,
            experience: 'Mixed Paste',
          },
        }));
      });

      setCandidateEmailsInput('');
      showSuccess(`Added ${added} candidate(s) with contact details to invite list!`);
    }
  };

  // Spreadsheet Table Handlers
  const handleAddSpreadsheetRow = () => {
    setSpreadsheetRows((prev) => [
      ...prev,
      { id: `row_${Date.now()}_${Math.random()}`, name: '', email: '', phone: '' },
    ]);
  };

  const handleAdd5SpreadsheetRows = () => {
    setSpreadsheetRows((prev) => [
      ...prev,
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `row_${Date.now()}_${i}_${Math.random()}`,
        name: '',
        email: '',
        phone: '',
      })),
    ]);
  };

  const handleUpdateSpreadsheetRow = (id: string, field: 'name' | 'email' | 'phone', value: string) => {
    setSpreadsheetRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleRemoveSpreadsheetRow = (id: string) => {
    setSpreadsheetRows((prev) =>
      prev.length > 1
        ? prev.filter((r) => r.id !== id)
        : [{ id: 'row_1', name: '', email: '', phone: '' }]
    );
  };

  const handleClearSpreadsheet = () => {
    setSpreadsheetRows([
      { id: 'row_1', name: '', email: '', phone: '' },
      { id: 'row_2', name: '', email: '', phone: '' },
      { id: 'row_3', name: '', email: '', phone: '' },
    ]);
    showSuccess('Cleared spreadsheet table rows.');
  };

  const handleSpreadsheetFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingSpreadsheet(true);
    try {
      const parsed = await parseCandidateDocument(file);
      if (parsed.length === 0) {
        showError('No valid candidate records could be extracted from this file.');
        return;
      }
      const newRows = parsed.map((c, i) => ({
        id: `row_${Date.now()}_${i}`,
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
      }));
      setSpreadsheetRows(newRows);
      showSuccess(`Extracted ${parsed.length} candidate(s) from "${file.name}"!`);
    } catch (err: any) {
      showError(err?.message || 'Failed to read spreadsheet file.');
    } finally {
      setIsUploadingSpreadsheet(false);
      event.target.value = '';
    }
  };

  const handlePasteClipboardToSpreadsheet = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showError('Clipboard is empty. Copy some rows from Excel or Google Sheets first.');
        return;
      }
      const parsed = parseBulkCandidateTextInput(text);
      if (parsed.length === 0) {
        showError('No candidate rows detected in clipboard text.');
        return;
      }
      const newRows = parsed.map((c, i) => ({
        id: `row_${Date.now()}_${i}`,
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
      }));
      setSpreadsheetRows(newRows);
      showSuccess(`Pasted & parsed ${parsed.length} candidate row(s) into spreadsheet table!`);
    } catch (err) {
      showError('Unable to read clipboard. You can paste into the text box instead.');
    }
  };

  const handleImportSpreadsheetRows = () => {
    const validRows = spreadsheetRows.filter(
      (r) => (r.email && r.email.trim()) || (r.phone && r.phone.trim())
    );

    if (validRows.length === 0) {
      showError('Please enter at least one candidate with an Email or Phone number in the table.');
      return;
    }

    let addedCount = 0;
    validRows.forEach((r) => {
      const cleanEmail = (r.email || '').trim().toLowerCase();
      const cleanPhone = (r.phone || '').trim();
      const cleanName =
        (r.name || '').trim() ||
        (cleanEmail ? cleanEmail.split('@')[0] : `Candidate ${cleanPhone.slice(-4)}`);
      const key = cleanEmail || `${cleanPhone.replace(/\D/g, '')}@candidate.whatsapp`;

      if (!inviteEmailsList.includes(key)) {
        setInviteEmailsList((prev) => [...prev, key]);
        addedCount++;
      }

      setCandidateDetailsMap((prev) => ({
        ...prev,
        [key]: {
          name: cleanName,
          phone: cleanPhone,
          experience: 'Spreadsheet Table',
        },
      }));

      setDumpCandidates((prev) => [
        {
          id: `tbl_${Date.now()}_${Math.random()}`,
          name: cleanName,
          email: key,
          phone: cleanPhone,
          skills: [],
          experienceYears: 0,
        },
        ...prev.filter((c) => c.email.toLowerCase() !== key),
      ]);
    });

    showSuccess(`Successfully imported ${addedCount} candidate(s) from spreadsheet table!`);
  };

  const handleSendTestInvites = async () => {
    if (!invitingTest) return;

    const parsedTextareaEmails = candidateEmailsInput
      .split(/[\n,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    const finalEmails = Array.from(new Set([...inviteEmailsList, ...parsedTextareaEmails]));

    if (finalEmails.length === 0) {
      showError('Please select or add at least one candidate email to invite.');
      return;
    }

    if (!sendEmailChannel && !sendWhatsAppChannel) {
      showError('Please select at least one delivery channel (Email or WhatsApp).');
      return;
    }

    setSendingInvites(true);
    const testLink = getAssessmentLink(invitingTest.id);
    const existingCandidateEmails = invitingTest.candidateEmails || [];
    const updatedCandidateEmails = Array.from(new Set([...existingCandidateEmails, ...finalEmails]));

    const candidateDataToAdd = finalEmails.map((email) => {
      const details = candidateDetailsMap[email.toLowerCase()];
      const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === email);
      return {
        email,
        name: details?.name || dumpMatch?.name || email.split('@')[0] || 'Candidate',
        phone: details?.phone || dumpMatch?.phone || '',
        experience: details?.experience || (dumpMatch?.experienceYears ? `${dumpMatch.experienceYears} Years` : 'N/A'),
        invitedAt: new Date().toISOString(),
      };
    });

    try {
      const testRef = doc(db, 'tests', invitingTest.id);
      await updateDoc(testRef, {
        candidateEmails: updatedCandidateEmails,
        candidateData: arrayUnion(...candidateDataToAdd),
        updatedAt: serverTimestamp(),
      });

      // 1. Send Assessment Email Invitations (MCQ Aptitude or Coding Challenge)
      if (sendEmailChannel) {
        await sendAssessmentEmailInvitations(
          candidateDataToAdd,
          invitingTest.title,
          testLink,
          invitingTest.accessCode || '',
          invitingTest.type || 'aptitude',
          {
            duration: invitingTest.duration || 10,
            passingScore: invitingTest.passingScore || 70,
            questionsCount: invitingTest.questions?.length || 0,
          },
          false,
          {
            recruiterName: userProfile?.name || 'InterviewXpert Team',
            recruiterEmail: userProfile?.email || 'info@interviewxpert.in',
            companyName: userProfile?.companyName || 'InterviewXpert',
          }
        );
      }

      // 2. Send Assessment WhatsApp Invitations (MCQ Aptitude or Coding Challenge)
      let waSuccessCount = 0;
      if (sendWhatsAppChannel) {
        for (const cand of candidateDataToAdd) {
          if (cand.phone) {
            const formattedPhone = formatPhoneForWhatsApp(cand.phone);
            if (formattedPhone) {
              try {
                const waRes = await sendAssessmentWhatsAppInvite({
                  phone: formattedPhone,
                  candidateName: cand.name,
                  testTitle: invitingTest.title,
                  testType: invitingTest.type || 'aptitude',
                  testLink,
                  accessCode: invitingTest.accessCode || '',
                  duration: invitingTest.duration || 10,
                  passingScore: invitingTest.passingScore || 70,
                  questionsCount: invitingTest.questions?.length || 0,
                  isReminder: false,
                  recruiterName: userProfile?.name || 'InterviewXpert Team',
                  companyName: userProfile?.companyName || 'InterviewXpert',
                });
                if (waRes.success) waSuccessCount++;
              } catch (waErr) {
                console.warn('Non-blocking WhatsApp send error:', waErr);
              }
            }
          }
        }
      }

      // Update local state for both candidateEmails AND candidateData so lookups immediately succeed
      setTests((prev) =>
        prev.map((t) =>
          t.id === invitingTest.id
            ? {
                ...t,
                candidateEmails: updatedCandidateEmails,
                candidateData: [...(t.candidateData || []), ...candidateDataToAdd],
              }
            : t
        )
      );

      setInvitingTest((prev: any) =>
        prev && prev.id === invitingTest.id
          ? {
              ...prev,
              candidateEmails: updatedCandidateEmails,
              candidateData: [...(prev.candidateData || []), ...candidateDataToAdd],
            }
          : prev
      );

      const channelSummary = [
        sendEmailChannel ? `${finalEmails.length} Email(s)` : '',
        sendWhatsAppChannel ? `${waSuccessCount} WhatsApp` : '',
      ]
        .filter(Boolean)
        .join(' & ');

      showSuccess(`✅ Assessment invitations dispatched via ${channelSummary || 'selected channels'}!`);
      setInvitingTest(null);
      setInviteEmailsList([]);
      setCandidateDetailsMap({});
      setCandidateEmailsInput('');
    } catch (err: any) {
      console.error('Failed to dispatch test invitations:', err);
      showError(err?.message || 'Failed to send assessment invitations.');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleSendSingleReminder = async (email: string) => {
    if (!invitingTest) return;
    setRemindingEmail(email);
    const testLink = getAssessmentLink(invitingTest.id);
    const candDataMatch = (invitingTest.candidateData || []).find((c: any) => (c.email || '').toLowerCase() === email.toLowerCase());
    const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
    const details = candidateDetailsMap[email.toLowerCase()];
    const candName = candDataMatch?.name || details?.name || dumpMatch?.name || email.split('@')[0] || 'Candidate';
    const phone = candDataMatch?.phone || details?.phone || dumpMatch?.phone || '';

    try {
      await sendAssessmentEmailInvitations(
        [{ email, name: candName, phone }],
        invitingTest.title,
        testLink,
        invitingTest.accessCode || '',
        invitingTest.type || 'aptitude',
        {
          duration: invitingTest.duration || 10,
          passingScore: invitingTest.passingScore || 70,
          questionsCount: invitingTest.questions?.length || 0,
        },
        true,
        {
          recruiterName: userProfile?.name || 'InterviewXpert Team',
          recruiterEmail: userProfile?.email || 'info@interviewxpert.in',
          companyName: userProfile?.companyName || 'InterviewXpert',
        }
      );
      showSuccess(`Assessment reminder sent to ${email}!`);
    } catch (err: any) {
      showError(err?.message || 'Failed to send reminder email.');
    } finally {
      setRemindingEmail(null);
    }
  };

  const handleSendWhatsAppReminder = async (email: string) => {
    if (!invitingTest) return;
    const testLink = getAssessmentLink(invitingTest.id);
    const candDataMatch = (invitingTest.candidateData || []).find((c: any) => (c.email || '').toLowerCase() === email.toLowerCase());
    const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
    const details = candidateDetailsMap[email.toLowerCase()];
    const candName = candDataMatch?.name || details?.name || dumpMatch?.name || email.split('@')[0] || 'Candidate';
    const rawPhone = candDataMatch?.phone || details?.phone || dumpMatch?.phone || '';
    const formattedPhone = formatPhoneForWhatsApp(rawPhone);

    if (!formattedPhone) {
      showError(`Mobile number missing for ${email}. Please ensure a valid phone number is registered.`);
      return;
    }

    try {
      await sendAssessmentWhatsAppInvite({
        phone: formattedPhone,
        candidateName: candName,
        testTitle: invitingTest.title,
        testType: invitingTest.type || 'aptitude',
        testLink,
        accessCode: invitingTest.accessCode || '',
        duration: invitingTest.duration || 10,
        passingScore: invitingTest.passingScore || 70,
        questionsCount: invitingTest.questions?.length || 0,
        isReminder: true,
        recruiterName: userProfile?.name || 'InterviewXpert Team',
        companyName: userProfile?.companyName || 'InterviewXpert',
      });
      showSuccess(`WhatsApp assessment reminder sent to ${candName} (${formattedPhone})!`);
    } catch (err: any) {
      showError(err?.message || 'Failed to send WhatsApp reminder.');
    }
  };

  const filteredTests = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return tests.filter((test) => {
      const matchesSearch = !search || `${test.title || ''} ${test.accessCode || ''} ${test.id || ''}`.toLowerCase().includes(search);
      const matchesType = typeFilter === 'All' || test.type === typeFilter;
      const isCurrentActive = isTestActive(test);
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && isCurrentActive) ||
        (statusFilter === 'Inactive' && !isCurrentActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [tests, searchQuery, typeFilter, statusFilter]);

  const overviewStats = useMemo(() => {
    const allStats = tests.map((test) => getStats(test, submissionsMap[test.id] || []));
    const totalSubmissions = allStats.reduce((sum, stats) => sum + stats.submissions, 0);
    const totalPassed = allStats.reduce((sum, stats) => sum + stats.passed, 0);
    const activeTestsCount = tests.filter(isTestActive).length;

    return {
      total: tests.length,
      active: activeTestsCount,
      inactive: tests.length - activeTestsCount,
      coding: tests.filter(test => test.type === 'coding').length,
      aptitude: tests.filter(test => test.type !== 'coding').length,
      submissions: totalSubmissions,
      passed: totalPassed,
      averageScore: allStats.length && allStats.some(stats => stats.submissions > 0)
        ? Math.round(allStats.reduce((sum, stats) => sum + (stats.averageScore * stats.submissions), 0) / Math.max(totalSubmissions, 1))
        : 0,
      passRate: totalSubmissions > 0 ? Math.round((totalPassed / totalSubmissions) * 100) : 0,
    };
  }, [tests, submissionsMap]);

  const secondaryButtonClass = "inline-flex h-9 sm:h-10 items-center justify-center rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-3 sm:px-4 font-bold text-xs text-[#111215] dark:text-white transition-all hover:bg-[#F1F3EB] dark:hover:bg-white/10 cursor-pointer shadow-2xs gap-1.5 sm:gap-2 shrink-0 disabled:cursor-not-allowed disabled:opacity-40";
  const primaryButtonClass = "inline-flex h-9 sm:h-10 items-center justify-center rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] px-4 sm:px-5 font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 gap-1.5 sm:gap-2 shrink-0";

  return (
    <div className="w-full min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
      
      {/* Header */}
      <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#0D0E11] px-4 py-5 sm:py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-2">
              <Link
                to="/recruiter/jobs"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:border-[#111215] dark:hover:border-white/30 transition-all shadow-2xs shrink-0"
              >
                <ArrowLeft size={13} />
                <span>Dashboard</span>
              </Link>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] font-bold text-[#111215] dark:text-[#F8F9F5] shadow-2xs max-w-full">
                <span className="size-2 rounded-full bg-[#8FB305] dark:bg-[#D4F82C] animate-pulse shrink-0"></span>
                <span className="font-mono uppercase text-[10px] text-[#73766C] dark:text-neutral-400 shrink-0">ASSESSMENT STUDIO</span>
                <span className="text-[#E4E7DC] dark:text-white/20">|</span>
                <span className="truncate">Screening & Evaluation Hub</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-[#F8F9F5] tracking-tight">
              Assessments
            </h1>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Review candidate assessment performance, generate secure test links, and manage automated screening tests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            <Link
              to="/recruiter/tests/create?type=aptitude"
              onClick={(event) => guardCreateLink(event, 'assessments')}
              aria-disabled={assessmentLimitReached}
              className={secondaryButtonClass}
            >
              <FileText size={14} className="text-emerald-700 dark:text-emerald-400" />
              <span>+ Aptitude Test</span>
            </Link>
            <Link
              to="/recruiter/tests/create?type=coding"
              onClick={(event) => guardCreateLink(event, 'codingAssessments')}
              aria-disabled={codingLimitReached}
              className={secondaryButtonClass}
            >
              <Code size={14} className="text-blue-500" />
              <span>+ Coding Challenge</span>
            </Link>
            <Link
              to="/recruiter/tests/create"
              onClick={(event) => guardCreateLink(event, 'assessments')}
              aria-disabled={assessmentLimitReached}
              className={primaryButtonClass}
            >
              <Plus size={16} />
              <span>{assessmentLimitReached ? 'Limit Reached' : 'Create Assessment'}</span>
            </Link>
          </div>
        </div>

        {assessmentLimitReached && (
          <div className="max-w-7xl mx-auto mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 sm:p-4 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 flex items-start sm:items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 mt-0.5 sm:mt-0" />
            <span className="min-w-0 flex-1 leading-snug">{getRateLimitReachedMessage('assessments')}</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8 space-y-6">

        {/* 6 Bento Metric Stat Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          
          {/* Total */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Total Tests</span>
              <div className="size-6 sm:size-7 rounded-lg bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#111215] dark:text-white shrink-0">
                <Layers size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.total}</p>
              <p className="text-[10px] font-bold text-[#575A51] dark:text-neutral-400 mt-0.5 truncate">
                {overviewStats.active} active · {overviewStats.inactive} inactive
              </p>
            </div>
          </div>

          {/* Aptitude */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Aptitude</span>
              <div className="size-6 sm:size-7 rounded-lg bg-[#F4F9EB] dark:bg-emerald-950/20 border border-[#D2E7B3] dark:border-emerald-800/40 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
                <FileText size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.aptitude}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">MCQ evaluations</p>
            </div>
          </div>

          {/* Coding */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Coding</span>
              <div className="size-6 sm:size-7 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Code size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.coding}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">Coding challenges</p>
            </div>
          </div>

          {/* Submissions */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Submissions</span>
              <div className="size-6 sm:size-7 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Users size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.submissions}</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">Candidates tested</p>
            </div>
          </div>

          {/* Passed */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Passed</span>
              <div className="size-6 sm:size-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
                <CheckCircle2 size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#111215] dark:text-white truncate">{overviewStats.passed}</p>
              <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 truncate">{overviewStats.passRate}% pass rate</p>
            </div>
          </div>

          {/* Avg Score */}
          <div className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3.5 sm:p-4 xl:p-5 shadow-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-wider truncate">Avg Score</span>
              <div className="size-6 sm:size-7 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <TrendingUp size={13} className="sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 truncate">{overviewStats.averageScore}%</p>
              <p className="text-[10px] font-medium text-[#73766C] dark:text-neutral-400 mt-0.5 truncate">Overall cohort</p>
            </div>
          </div>

        </section>

        {/* Filter and Search Bar */}
        <section className="rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative w-full md:flex-1 md:max-w-md min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C]" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search assessments by title, code or ID..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-white placeholder:text-[#73766C] outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C]"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            {/* Format Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-[#73766C] dark:text-neutral-400 shrink-0">Format:</span>
              <div className="flex p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] shrink-0">
                {(['All', 'aptitude', 'coding'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTypeFilter(filter)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all capitalize cursor-pointer ${
                      typeFilter === filter
                        ? 'bg-white text-[#111215] border border-[#E4E7DC] font-bold shadow-xs'
                        : 'text-[#73766C] hover:text-[#111215] font-medium'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter (Exact All Jobs Style) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-[#73766C] dark:text-neutral-400 shrink-0">Status:</span>
              <div className="flex p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] shrink-0">
                {(['All', 'Active', 'Inactive'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      statusFilter === status
                        ? 'bg-white text-[#111215] border border-[#E4E7DC] font-bold shadow-xs'
                        : 'text-[#73766C] hover:text-[#111215] font-medium'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {(searchQuery || typeFilter !== 'All' || statusFilter !== 'All') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setTypeFilter('All'); setStatusFilter('All'); }}
                className="px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 transition-colors cursor-pointer shrink-0"
              >
                Clear Filters
              </button>
            )}
          </div>
        </section>

        {/* Content Section */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 shadow-xs animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-40 rounded-xl bg-gray-200 dark:bg-white/10" />
                  <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="h-6 w-3/4 rounded-lg bg-gray-200 dark:bg-white/10" />
                <div className="h-4 w-full rounded-md bg-gray-100 dark:bg-white/5" />
                <div className="h-16 rounded-2xl bg-gray-100 dark:bg-white/5" />
              </div>
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-12 sm:p-16 text-center shadow-xs">
            <div className="size-14 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center text-[#111215] mx-auto mb-4 shadow-2xs">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-black text-[#111215] dark:text-white">No assessments created yet</h3>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
              Create an automated aptitude screen or coding challenge to evaluate candidates before moving them into interview rounds.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Link to="/recruiter/tests/create" className={primaryButtonClass}>
                <Plus size={16} />
                <span>Create your first assessment</span>
              </Link>
            </div>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-12 text-center shadow-xs">
            <div className="size-12 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#73766C] mx-auto mb-3">
              <Search size={20} />
            </div>
            <h3 className="text-base font-bold text-[#111215] dark:text-white">No matching assessments</h3>
            <p className="text-xs text-[#73766C] dark:text-neutral-400 max-w-sm mx-auto mt-1">
              Try adjusting your search query or format filter to find what you are looking for.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setTypeFilter('All'); setStatusFilter('All'); }}
              className="mt-4 px-4 py-2 rounded-full bg-[#111215] text-white text-xs font-bold cursor-pointer"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTests.map((test) => {
              const isCoding = test.type === 'coding';
              const isCurrentActive = isTestActive(test);
              const stats = getStats(test, submissionsMap[test.id] || []);
              const testLink = getAssessmentLink(test.id);
              const invitedCount = (test.candidateEmails || []).length;
              const skillsList = getTestSkills(test);

              return (
                <article
                  key={test.id}
                  onClick={() => navigate(`/recruiter/tests/${test.id}/results`)}
                  className={`group rounded-3xl border bg-white dark:bg-[#15161A] p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between cursor-pointer ${
                    !isCurrentActive
                      ? 'border-red-200/80 dark:border-red-900/30 hover:border-red-300'
                      : 'border-[#E4E7DC] dark:border-white/10 hover:border-[#111215]/30 dark:hover:border-white/20'
                  }`}
                >
                  <div>
                    {/* Top Row: Category & Status (Exact All Jobs Style) */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border truncate max-w-[200px] ${
                          isCoding
                            ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            : 'bg-[#F8F9F5] text-[#575A51] dark:bg-white/5 dark:text-neutral-300 border-[#E4E7DC] dark:border-white/10'
                        }`}>
                          {isCoding ? 'Coding Challenge' : 'Aptitude Assessment'}
                        </span>
                        {test.accessCode && (
                          <span className="font-mono text-[#111215] dark:text-white font-bold bg-[#E4E7DC] dark:bg-white/10 border border-[#D5D9CC] dark:border-white/10 px-2.5 py-0.5 rounded-full text-[10px]">
                            #{test.accessCode}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleTestStatus(test, e)}
                          disabled={togglingTestId === test.id}
                          title={isCurrentActive ? "Click to Deactivate assessment" : "Click to Activate assessment"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs transition-all duration-150 cursor-pointer ${
                            !isCurrentActive
                              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                              : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                          } ${togglingTestId === test.id ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          {togglingTestId === test.id ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin text-current" />
                          ) : (
                            <span className={`h-1.5 w-1.5 rounded-full ${isCurrentActive ? 'bg-emerald-600 animate-pulse' : 'bg-red-500'}`} />
                          )}
                          <span>{isCurrentActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Test Title */}
                    <h2
                      style={{ color: '#111215' }}
                      className="text-base sm:text-lg font-bold text-[#111215] dark:text-white group-hover:text-black dark:group-hover:text-white transition-colors truncate"
                      title={test.title}
                    >
                      {test.title}
                    </h2>

                    {/* Metadata Sub-row */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs text-[#575A51] dark:text-neutral-400">
                      <span className="flex items-center gap-1 truncate">
                        <Clock className="w-3 h-3 text-[#73766C] shrink-0" />
                        <span>{test.duration || 10}m duration</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 truncate">
                        <FileText className="w-3 h-3 text-[#73766C] shrink-0" />
                        <span>{test.questions?.length || 0} questions</span>
                      </span>
                      <span>•</span>
                      <span>Created {formatDate(test.createdAt)}</span>
                    </div>

                    {/* Short Description */}
                    <p className="mt-2.5 text-xs text-[#575A51] dark:text-neutral-400 line-clamp-2 leading-relaxed">
                      {test.description || 'Automated screening assessment with anti-cheating browser lock and live proctoring.'}
                    </p>

                    {/* Specifications Grid (Exact All Jobs Style) */}
                    <div className="mt-3.5 pt-3 border-t border-[#E4E7DC] dark:border-white/10 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#575A51] dark:text-neutral-400">
                      <div className="flex items-center gap-1.5 min-w-0" title={`Duration: ${test.duration || 10}m`}>
                        <Clock className="w-3.5 h-3.5 text-[#575A51] dark:text-neutral-400 shrink-0" />
                        <span className="text-[#73766C] shrink-0">Duration:</span>
                        <span className="text-[#111215] dark:text-white font-bold truncate">{test.duration || 10}m</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0" title={`Pass Benchmark: ${test.passingScore || 70}%`}>
                        <Target className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span className="text-[#73766C] shrink-0">Benchmark:</span>
                        <span className="text-[#111215] dark:text-white font-bold truncate">{test.passingScore || 70}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0" title={`${stats.submissions} candidate${stats.submissions === 1 ? '' : 's'} tested`}>
                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-[#73766C] shrink-0">Tested:</span>
                        <span className="text-[#111215] dark:text-white font-bold truncate">{stats.submissions} candidate{stats.submissions === 1 ? '' : 's'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0" title={`${invitedCount} candidate${invitedCount === 1 ? '' : 's'} invited`}>
                        <Send className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="text-[#73766C] shrink-0">Invited:</span>
                        <span className="text-[#111215] dark:text-white font-bold truncate">{invitedCount} candidate{invitedCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    {/* Skills / Topics */}
                    {skillsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {skillsList.map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Actions (Exact All Jobs Row: [Invite], [Responses], [Link], [Edit], [Delete]) */}
                  <div className="mt-4 pt-3.5 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvitingTest(test);
                        setInviteMode('ai_suggest');
                        setInviteEmailsList([]);
                        setCandidateEmailsInput('');
                      }}
                      className="flex-1 min-w-[100px] inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#111215] dark:bg-[#D4F82C] px-3 font-semibold text-white dark:text-[#111215] text-xs transition-colors hover:bg-[#202227] dark:hover:bg-[#c5ea24] shadow-xs cursor-pointer"
                      title="Invite candidate"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-white dark:text-[#111215]" />
                      <span className="truncate">Invite</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/recruiter/tests/${test.id}/results`);
                      }}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-3 font-semibold text-[#111215] dark:text-white text-xs transition-colors hover:bg-[#F8F9F5] dark:hover:bg-white/10 cursor-pointer shadow-2xs"
                      title="See candidate submissions"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#575A51] dark:text-neutral-400" />
                      <span>Responses</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(testLink, 'Assessment link copied to clipboard.');
                      }}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-2.5 font-semibold text-[#111215] dark:text-white text-xs transition-colors hover:bg-[#F8F9F5] dark:hover:bg-white/10 cursor-pointer shadow-2xs"
                      title="Copy assessment link"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#575A51] dark:text-neutral-400" />
                      <span className="hidden sm:inline">Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/recruiter/tests/${test.id}/edit`);
                      }}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-2.5 font-semibold text-[#111215] dark:text-white text-xs transition-colors hover:bg-[#F8F9F5] dark:hover:bg-white/10 cursor-pointer shadow-2xs"
                      title="Edit assessment"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#575A51] dark:text-neutral-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(test.id);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs transition-colors shrink-0 cursor-pointer dark:bg-red-950/40 dark:border-red-800 dark:text-red-400"
                      title="Delete assessment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Invite Candidate Modal ── */}
      {invitingTest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setInvitingTest(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] shadow-2xl flex flex-col overflow-hidden max-h-[92vh] font-sans animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/10 bg-white/95 dark:bg-[#15161A]/95 px-6 py-4.5 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center shadow-xs shrink-0 font-bold">
                  <UserPlus className="w-5 h-5 text-[#111215]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-[#111215] dark:text-white">
                      Invite Candidates to Assessment
                    </h3>
                    <span
                      style={{ color: '#111215' }}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-white text-[#111215] border border-[#E4E7DC] truncate max-w-xs shadow-2xs"
                    >
                      {invitingTest.title}
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                      invitingTest.type === 'coding'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {invitingTest.type === 'coding' ? 'Coding Challenge' : 'Aptitude Test'}
                    </span>
                  </div>
                  <p className="text-xs text-[#575A51] dark:text-neutral-400 font-medium mt-0.5">
                    Send verified test invites with anti-cheating browser lock via Email or WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInvitingTest(null)}
                className="size-9 rounded-full flex items-center justify-center text-[#575A51] hover:text-[#111215] dark:hover:text-white hover:bg-[#E4E7DC]/60 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto [scrollbar-color:#c2c5ba_transparent] [scrollbar-width:thin]">
              {/* Direct Link Preview & Copy Card */}
              <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                    Direct Candidate Test URL
                  </span>
                  <div className="flex items-center gap-3 text-xs text-[#575A51] dark:text-neutral-400">
                    <span>Duration: <strong className="text-[#111215] dark:text-white font-mono">{invitingTest.duration || 10}m</strong></span>
                    <span>•</span>
                    <span>Pass Benchmark: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{invitingTest.passingScore || 70}%</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs font-mono text-[#111215] dark:text-neutral-200 truncate select-all">
                    {getAssessmentLink(invitingTest.id)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getAssessmentLink(invitingTest.id));
                      setCopiedModalLink(true);
                      showSuccess('Assessment link copied to clipboard!');
                      setTimeout(() => setCopiedModalLink(false), 2500);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
                  >
                    {copiedModalLink ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
                    <span>{copiedModalLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={getAssessmentLink(invitingTest.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="size-9 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white transition-colors shrink-0 shadow-2xs"
                    title="Preview assessment taking view"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              {/* Bento Tab Selector */}
              <div className="flex items-center gap-1.5 p-1.5 bg-[#E4E7DC]/60 dark:bg-white/5 rounded-2xl flex-wrap">
                <button
                  type="button"
                  onClick={() => setInviteMode('ai_suggest')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[140px] cursor-pointer ${
                    inviteMode === 'ai_suggest'
                      ? 'bg-white text-[#111215] border border-[#E4E7DC] shadow-xs'
                      : 'text-[#575A51] hover:text-[#111215] hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#111215]" />
                  <span>Suggest AI Candidates</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInviteMode('bulk')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[120px] cursor-pointer ${
                    inviteMode === 'bulk'
                      ? 'bg-white text-[#111215] border border-[#E4E7DC] shadow-xs'
                      : 'text-[#575A51] hover:text-[#111215] hover:bg-white/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-[#111215]" />
                  <span>Add / Bulk Import</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInviteMode('invited')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-w-[130px] cursor-pointer ${
                    inviteMode === 'invited'
                      ? 'bg-white text-[#111215] border border-[#E4E7DC] shadow-xs'
                      : 'text-[#575A51] hover:text-[#111215] hover:bg-white/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#111215]" />
                  <span>Invited Candidates ({(invitingTest.candidateEmails || []).length})</span>
                </button>
              </div>

              {/* TAB 1: AI Suggested Candidates */}
              {inviteMode === 'ai_suggest' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#111215] dark:text-white">
                      Top Recommended Candidates from Talent Pool ({suggestedCandidates.length})
                    </span>
                    {suggestedCandidates.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllSuggested}
                          className="text-[11px] font-bold text-[#111215] dark:text-white hover:underline cursor-pointer"
                        >
                          + Select Top 20 Candidates
                        </button>
                        {inviteEmailsList.length > 0 && (
                          <>
                            <span className="text-[#E4E7DC] dark:text-white/20">|</span>
                            <button
                              type="button"
                              onClick={handleClearSelectedInvites}
                              className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                            >
                              Clear Selection
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {loadingDumpCandidates ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 rounded-2xl bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 animate-pulse" />
                      ))}
                    </div>
                  ) : suggestedCandidates.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-center text-xs text-[#73766C] dark:text-neutral-400 space-y-1">
                      <p className="font-bold text-[#111215] dark:text-white">All relevant candidates are already invited</p>
                      <p>Upload new resumes in Resume Dump or use the "Add / Bulk Import" tab to invite candidates directly.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {suggestedCandidates.slice(0, 30).map((cand) => {
                        const isSelected = inviteEmailsList.includes(cand.email);
                        return (
                          <div
                            key={cand.id}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-[#111215] dark:border-[#D4F82C] bg-white dark:bg-white/10 shadow-xs'
                                : 'border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#111215]/40'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#111215] dark:text-white truncate">
                                  {cand.name}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                                  {cand.matchScore}% Match
                                </span>
                                {cand.experienceYears > 0 && (
                                  <span className="text-[10px] text-[#73766C] dark:text-neutral-400">
                                    • {cand.experienceYears}y exp
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-[#73766C] dark:text-neutral-400 truncate">
                                <span className="truncate">{cand.email}</span>
                                {cand.phone && <span>• {cand.phone}</span>}
                                {cand.location && <span>• {cand.location}</span>}
                              </div>
                              {Array.isArray(cand.skills) && cand.skills.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  {cand.skills.slice(0, 4).map((sk: string, sIdx: number) => (
                                    <span
                                      key={sIdx}
                                      className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#F8F9F5] dark:bg-white/10 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC]/60 dark:border-white/10"
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleCandidateInInviteList(cand.email, { name: cand.name, phone: cand.phone, experience: cand.experienceYears ? `${cand.experienceYears}y exp` : '' })}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                isSelected
                                  ? 'bg-[#111215] text-white shadow-xs'
                                  : 'border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white hover:bg-black/5'
                              }`}
                            >
                              {isSelected ? '✓ Added' : '+ Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Add / Bulk Import */}
              {inviteMode === 'bulk' && (
                <div className="space-y-4">
                  {/* Sub-mode Switcher: Form & Paste vs Spreadsheet Grid */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                    <div className="flex items-center gap-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => setBulkSubMode('form')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          bulkSubMode === 'form'
                            ? 'bg-white dark:bg-[#1A1C20] text-[#111215] dark:text-white shadow-xs border border-[#E4E7DC] dark:border-white/10'
                            : 'text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Quick Form & Bulk Paste</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkSubMode('spreadsheet')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          bulkSubMode === 'spreadsheet'
                            ? 'bg-white dark:bg-[#1A1C20] text-[#111215] dark:text-white shadow-xs border border-[#E4E7DC] dark:border-white/10'
                            : 'text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                        }`}
                      >
                        <Table className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Spreadsheet Table (Excel / CSV Grid)</span>
                      </button>
                    </div>
                  </div>

                  {bulkSubMode === 'form' ? (
                    <>
                      {/* Aligned Single Candidate Input */}
                      <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block">
                            Add Single Candidate Directly
                          </span>
                          <span className="text-[11px] text-[#73766C] dark:text-neutral-400">
                            Provide Email, Mobile Phone, or both
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                          <div>
                            <label className="block text-[11px] font-bold text-[#73766C] dark:text-neutral-400 mb-1">
                              Candidate Name
                            </label>
                            <input
                              type="text"
                              value={singleCandidateName}
                              onChange={(e) => setSingleCandidateName(e.target.value)}
                              placeholder="e.g. Rahul Sharma"
                              className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs text-[#111215] dark:text-white outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[#73766C] dark:text-neutral-400 mb-1">
                              Candidate Email
                            </label>
                            <input
                              type="email"
                              value={singleCandidateEmail}
                              onChange={(e) => setSingleCandidateEmail(e.target.value)}
                              placeholder="e.g. rahul@example.com"
                              className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs text-[#111215] dark:text-white outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[#73766C] dark:text-neutral-400 mb-1">
                              Mobile / WhatsApp
                            </label>
                            <input
                              type="tel"
                              value={singleCandidatePhone}
                              onChange={(e) => setSingleCandidatePhone(e.target.value)}
                              placeholder="e.g. +91 9876543210"
                              className="w-full h-10 px-3.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs text-[#111215] dark:text-white outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-colors"
                            />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={handleAddSingleCandidate}
                              className="w-full h-10 px-4 rounded-xl text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Add Candidate</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Paste Multiple Candidates with Options */}
                      <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <label className="text-[11px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block">
                              Paste Multiple Candidates
                            </label>
                            <span className="text-[11px] text-[#73766C] dark:text-neutral-400">
                              Choose paste format then paste lists separated by commas or lines
                            </span>
                          </div>

                          {/* Mode selector pills */}
                          <div className="inline-flex items-center gap-1 p-1 bg-[#F8F9F5] rounded-xl border border-[#E4E7DC] text-xs">
                            <button
                              type="button"
                              onClick={() => setBulkPasteType('email')}
                              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                bulkPasteType === 'email'
                                  ? 'bg-white text-[#111215] shadow-xs border border-[#E4E7DC]'
                                  : 'text-[#73766C] hover:text-[#111215]'
                              }`}
                            >
                              Emails
                            </button>
                            <button
                              type="button"
                              onClick={() => setBulkPasteType('phone')}
                              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                bulkPasteType === 'phone'
                                  ? 'bg-white text-[#111215] shadow-xs border border-[#E4E7DC]'
                                  : 'text-[#73766C] hover:text-[#111215]'
                              }`}
                            >
                              Phone Numbers
                            </button>
                            <button
                              type="button"
                              onClick={() => setBulkPasteType('mixed')}
                              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                bulkPasteType === 'mixed'
                                  ? 'bg-white text-[#111215] shadow-xs border border-[#E4E7DC]'
                                  : 'text-[#73766C] hover:text-[#111215]'
                              }`}
                            >
                              Mixed (Name, Email, Phone)
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          value={candidateEmailsInput}
                          onChange={(e) => setCandidateEmailsInput(e.target.value)}
                          placeholder={
                            bulkPasteType === 'email'
                              ? 'e.g. dev@example.com, alex@tech.org\npriya@startup.in, rahul@company.com'
                              : bulkPasteType === 'phone'
                              ? 'e.g. +91 9876543210, 9876543211\n+1 415 555 2671, +91-9123456789'
                              : 'e.g. Rahul Sharma, rahul@example.com, +91 9876543210\nPriya, priya@startup.in\n+91 9988776655'
                          }
                          className="w-full p-3 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs font-mono outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] text-[#111215] dark:text-white resize-none"
                        />

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-[#73766C] dark:text-neutral-400">
                            {bulkPasteType === 'email' && 'Extracts all valid email addresses.'}
                            {bulkPasteType === 'phone' && 'Extracts all 10+ digit contact numbers for WhatsApp invite.'}
                            {bulkPasteType === 'mixed' && 'Intelligently parses names, emails, and phone numbers.'}
                          </span>
                          <button
                            type="button"
                            onClick={handleAddBulkInput}
                            disabled={!candidateEmailsInput.trim()}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                          >
                            <span>
                              Extract & Add{' '}
                              {bulkPasteType === 'email'
                                ? 'Emails'
                                : bulkPasteType === 'phone'
                                ? 'Phones'
                                : 'Candidates'}{' '}
                              →
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Sub-mode: Spreadsheet Table */
                    <div className="p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 space-y-3">
                      {/* Toolbar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E4E7DC] dark:border-white/10">
                        <div>
                          <h4 className="text-xs font-bold text-[#111215] dark:text-white flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>Spreadsheet Candidate Grid</span>
                          </h4>
                          <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                            Edit rows inline, paste Excel rows, or upload a .xlsx / .csv file.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-[#111215] dark:text-white cursor-pointer transition-colors shadow-2xs">
                            <FileUp className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isUploadingSpreadsheet ? 'Reading...' : 'Upload File'}</span>
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              onChange={handleSpreadsheetFileUpload}
                              disabled={isUploadingSpreadsheet}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={handlePasteClipboardToSpreadsheet}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-[#111215] dark:text-white cursor-pointer transition-colors shadow-2xs"
                          >
                            <Clipboard className="w-3.5 h-3.5 text-sky-600" />
                            <span>Paste Clipboard</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleAddSpreadsheetRow}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-[#111215] dark:text-white cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Row</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleAdd5SpreadsheetRows}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-[#111215] dark:text-white cursor-pointer transition-colors"
                          >
                            <span>+5 Rows</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleClearSpreadsheet}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Interactive Spreadsheet Table */}
                      <div className="overflow-x-auto rounded-xl border border-[#E4E7DC] dark:border-white/10 max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-[#F8F9F5] dark:bg-[#151619] text-[#73766C] dark:text-neutral-400 text-[11px] uppercase tracking-wider font-bold sticky top-0 z-10 border-b border-[#E4E7DC] dark:border-white/10">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3">Candidate Full Name</th>
                              <th className="py-2.5 px-3">Email Address</th>
                              <th className="py-2.5 px-3">Mobile / WhatsApp</th>
                              <th className="py-2.5 px-3 w-12 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E7DC]/60 dark:divide-white/5 bg-white dark:bg-[#101114]">
                            {spreadsheetRows.map((row, idx) => (
                              <tr key={row.id} className="hover:bg-[#F8F9F5]/70 dark:hover:bg-white/5 transition-colors">
                                <td className="py-2 px-3 text-center text-[#73766C] dark:text-neutral-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={row.name}
                                    onChange={(e) => handleUpdateSpreadsheetRow(row.id, 'name', e.target.value)}
                                    placeholder="Rahul Sharma"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-[#E4E7DC] dark:hover:border-white/20 focus:border-[#111215] dark:focus:border-[#D4F82C] bg-transparent text-xs text-[#111215] dark:text-white outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="email"
                                    value={row.email}
                                    onChange={(e) => handleUpdateSpreadsheetRow(row.id, 'email', e.target.value)}
                                    placeholder="rahul@example.com"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-[#E4E7DC] dark:hover:border-white/20 focus:border-[#111215] dark:focus:border-[#D4F82C] bg-transparent text-xs text-[#111215] dark:text-white outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="tel"
                                    value={row.phone}
                                    onChange={(e) => handleUpdateSpreadsheetRow(row.id, 'phone', e.target.value)}
                                    placeholder="+91 9876543210"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-[#E4E7DC] dark:hover:border-white/20 focus:border-[#111215] dark:focus:border-[#D4F82C] bg-transparent text-xs text-[#111215] dark:text-white outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSpreadsheetRow(row.id)}
                                    className="p-1 rounded-lg text-[#73766C] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                    title="Delete Row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Spreadsheet Import Action Footer */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <span className="text-xs text-[#73766C] dark:text-neutral-400 font-medium">
                          {
                            spreadsheetRows.filter((r) => (r.email && r.email.trim()) || (r.phone && r.phone.trim()))
                              .length
                          }{' '}
                          ready row(s) out of {spreadsheetRows.length} in table
                        </span>

                        <button
                          type="button"
                          onClick={handleImportSpreadsheetRows}
                          disabled={
                            spreadsheetRows.filter((r) => (r.email && r.email.trim()) || (r.phone && r.phone.trim()))
                              .length === 0
                          }
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            + Import & Add{' '}
                            {
                              spreadsheetRows.filter((r) => (r.email && r.email.trim()) || (r.phone && r.phone.trim()))
                                .length
                            }{' '}
                            Candidates from Table
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Currently Selected Candidate Chips with Mobile Phone & Name */}
                  {inviteEmailsList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#111215] dark:text-white flex items-center gap-2 flex-wrap">
                          <span>Candidates Selected for Invitation ({inviteEmailsList.length})</span>
                          {inviteEmailsList.filter((e) => {
                            const details = candidateDetailsMap[e.toLowerCase()];
                            const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === e.toLowerCase());
                            return Boolean(details?.phone || dumpMatch?.phone);
                          }).length > 0 && (
                            <span className="font-mono text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              {
                                inviteEmailsList.filter((e) => {
                                  const details = candidateDetailsMap[e.toLowerCase()];
                                  const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === e.toLowerCase());
                                  return Boolean(details?.phone || dumpMatch?.phone);
                                }).length
                              }{' '}
                              with mobile phone
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSelectedInvites}
                          className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                        {inviteEmailsList.map((em) => {
                          const details = candidateDetailsMap[em.toLowerCase()] || dumpCandidates.find((c) => c.email.toLowerCase() === em.toLowerCase());
                          const name = details?.name || em.split('@')[0];
                          const phone = details?.phone || '';

                          return (
                            <div
                              key={em}
                              className="inline-flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#1A1C20] border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white shadow-2xs min-w-[200px]"
                            >
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 font-bold truncate">
                                  <span className="truncate">{name}</span>
                                  {phone ? (
                                    <span className="font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">
                                      📱 {phone}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-normal shrink-0">
                                      (No phone)
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[11px] text-[#575A51] dark:text-neutral-400 truncate">
                                  {em}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleCandidateInInviteList(em)}
                                className="text-[#73766C] hover:text-rose-500 cursor-pointer shrink-0 p-1 rounded-md hover:bg-black/5"
                                title="Remove candidate"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Already Invited Candidates */}
              {inviteMode === 'invited' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-[#111215] dark:text-white block">
                    Already Invited Candidates ({(invitingTest.candidateEmails || []).length})
                  </span>

                  {(!invitingTest.candidateEmails || invitingTest.candidateEmails.length === 0) ? (
                    <div className="p-8 rounded-2xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-center text-xs text-[#73766C] dark:text-neutral-400">
                      No candidates have been invited to this assessment yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {invitingTest.candidateEmails.map((email: string, idx: number) => {
                        const candDataMatch = (invitingTest.candidateData || []).find((c: any) => (c.email || '').toLowerCase() === email.toLowerCase());
                        const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
                        const details = candidateDetailsMap[email.toLowerCase()];
                        const name = candDataMatch?.name || details?.name || dumpMatch?.name || email.split('@')[0] || 'Candidate';
                        const phone = candDataMatch?.phone || details?.phone || dumpMatch?.phone || '';
                        const isReminding = remindingEmail === email;

                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-[#111215] dark:text-white truncate">{name}</p>
                                {phone && (
                                  <span className="font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                    📱 {phone}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#73766C] dark:text-neutral-400 font-mono truncate">{email}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {phone && (
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppReminder(email)}
                                  className="px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
                                  title={`Send WhatsApp assessment reminder to ${phone}`}
                                >
                                  <MessageCircle size={12} />
                                  <span>WhatsApp</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSendSingleReminder(email)}
                                disabled={isReminding}
                                className="px-2.5 py-1.5 rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#111215] dark:text-white text-[11px] font-bold hover:bg-black/5 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                <Mail size={12} />
                                <span>{isReminding ? 'Sending...' : 'Remind'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Channel Toggles */}
              <div className="p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                  Notification Channels:
                </span>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendEmailChannel}
                      onChange={(e) => setSendEmailChannel(e.target.checked)}
                      className="rounded text-[#111215] accent-[#111215] cursor-pointer"
                    />
                    <span className="text-[#111215] dark:text-white flex items-center gap-1">
                      <Mail size={13} />
                      <span>Email Invitation ({inviteEmailsList.length})</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendWhatsAppChannel}
                      onChange={(e) => setSendWhatsAppChannel(e.target.checked)}
                      className="rounded text-[#111215] accent-[#111215] cursor-pointer"
                    />
                    <span className="text-[#111215] dark:text-white flex items-center gap-1">
                      <MessageCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>
                        WhatsApp Message (
                        {
                          inviteEmailsList.filter((e) => {
                            const details = candidateDetailsMap[e.toLowerCase()];
                            const dumpMatch = dumpCandidates.find((c) => c.email.toLowerCase() === e.toLowerCase());
                            return Boolean(details?.phone || dumpMatch?.phone);
                          }).length
                        }{' '}
                        with phone)
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-[#E4E7DC] dark:border-white/10 bg-white/95 dark:bg-[#15161A]/95 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#575A51] dark:text-neutral-400 font-medium">
                <strong className="text-[#111215] dark:text-white font-mono text-sm">{inviteEmailsList.length}</strong> candidate(s) selected
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInvitingTest(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTestInvites}
                  disabled={sendingInvites || (inviteEmailsList.length === 0 && !candidateEmailsInput.trim())}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#111215] text-white hover:bg-[#202227] transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>{sendingInvites ? 'Dispatching Invites...' : 'Send Invitations'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterTests;
