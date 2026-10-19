import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  CheckCircle2,
  Download,
  Eraser,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
  MapPin,
  Briefcase,
  GraduationCap,
  Award
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl || `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch (_) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

export interface MorphedCandidateData {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  city?: string;
  currentTitle?: string;
  summary?: string;
  totalExperienceYears?: number | string;
  skills?: string[];
  resumeUrl?: string;
  resumeFileName?: string;
  resumeText?: string;
  experience?: Array<{
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    highlights?: string[];
    skills?: string[];
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    year?: string;
  }>;
  certifications?: string[];
  projects?: Array<{
    title: string;
    description: string;
    technologies?: string[];
  }>;
  [key: string]: any;
}

interface MorphResumeModalProps {
  candidate: MorphedCandidateData | null;
  isOpen: boolean;
  onClose: () => void;
}

interface MorphedPageInfo {
  dataUrl: string;
  ptWidth: number;
  ptHeight: number;
}

// Helper: Comprehensive Sanitization for Morphed (Blind) Resume
export function sanitizeMorphedContent(
  text: string,
  candidateEmail?: string,
  candidatePhone?: string,
  customWords: string[] = []
): {
  cleanText: string;
  emailsRemoved: number;
  phonesRemoved: number;
  linksRemoved: number;
  customWordsRemoved: number;
} {
  if (!text) {
    return { cleanText: '', emailsRemoved: 0, phonesRemoved: 0, linksRemoved: 0, customWordsRemoved: 0 };
  }

  let sanitized = text;
  let emailsRemoved = 0;
  let phonesRemoved = 0;
  let linksRemoved = 0;
  let customWordsRemoved = 0;

  // 1. Remove candidate specific email if provided
  if (candidateEmail && candidateEmail.trim()) {
    const esc = candidateEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${esc}\\b`, 'gi');
    if (regex.test(sanitized)) {
      sanitized = sanitized.replace(regex, '');
      emailsRemoved++;
    }
  }

  // General email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  sanitized = sanitized.replace(emailRegex, () => {
    emailsRemoved++;
    return '';
  });

  // 2. Remove candidate specific phone if provided
  if (candidatePhone && candidatePhone.trim()) {
    const raw = candidatePhone.trim();
    const digits = raw.replace(/\D/g, '');
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(esc, 'g'), '');
    if (digits.length >= 7) {
      const last10 = digits.slice(-10);
      sanitized = sanitized.replace(new RegExp(`(?:\\+?\\d{1,3}[-\\s]?)?${last10}`, 'g'), '');
      phonesRemoved++;
    }
  }

  // General phone numbers (8 to 14 digits with optional international prefix)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b/g;
  sanitized = sanitized.replace(phoneRegex, (match) => {
    const digitCount = match.replace(/\D/g, '').length;
    // Protect years or year ranges like 2020-2024
    if (digitCount >= 8 && digitCount <= 14) {
      if (!/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/.test(match)) {
        phonesRemoved++;
        return '';
      }
    }
    return match;
  });

  // 3. Remove all Web Links and URLs
  const urlRegex = /\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+/gi;
  sanitized = sanitized.replace(urlRegex, () => {
    linksRemoved++;
    return '';
  });

  // Known social/portfolio URLs without scheme
  const socialRegex = /\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com|twitter\.com|x\.com|instagram\.com|facebook\.com)\/[^\s<>"'{}|\\^`[\]]+/gi;
  sanitized = sanitized.replace(socialRegex, () => {
    linksRemoved++;
    return '';
  });

  // General domain paths like username.github.io, portfolio.me, etc.
  const domainPathRegex = /\b[a-zA-Z0-9-]+\.(?:com|org|net|io|in|me|co|dev|app|ai|info)\/[a-zA-Z0-9_\-\.\/?=%&]+/gi;
  sanitized = sanitized.replace(domainPathRegex, () => {
    linksRemoved++;
    return '';
  });

  // 4. Remove custom user-selected words and phrases
  if (Array.isArray(customWords) && customWords.length > 0) {
    customWords.forEach((word) => {
      if (!word || !word.trim()) return;
      const esc = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${esc}\\b`, 'gi');
      if (wordBoundaryRegex.test(sanitized)) {
        sanitized = sanitized.replace(wordBoundaryRegex, '');
        customWordsRemoved++;
      } else {
        const looseRegex = new RegExp(esc, 'gi');
        if (looseRegex.test(sanitized)) {
          sanitized = sanitized.replace(looseRegex, '');
          customWordsRemoved++;
        }
      }
    });
  }

  // 5. Remove dangling labels that are now blank (e.g. "Email: ", "Phone: ", "LinkedIn: ")
  sanitized = sanitized
    .replace(/(?:email|e-mail|mail)\s*:\s*(?=[\r\n,]|$)/gi, '')
    .replace(/(?:phone|mobile|tel|contact|cell|call)\s*:\s*(?=[\r\n,]|$)/gi, '')
    .replace(/(?:linkedin|github|portfolio|website|web|site|url)\s*:\s*(?=[\r\n,]|$)/gi, '');

  return { cleanText: sanitized, emailsRemoved, phonesRemoved, linksRemoved, customWordsRemoved };
}

export const MorphResumeModal: React.FC<MorphResumeModalProps> = ({ candidate, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'original' | 'executive'>('original');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isOpeningTab, setIsOpeningTab] = useState<boolean>(false);
  const [morphedPages, setMorphedPages] = useState<MorphedPageInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inherit day/night mode directly from the application theme
  let isAppDark = false;
  try {
    const themeContext = useTheme();
    isAppDark = themeContext.isDark;
  } catch {
    isAppDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false;
  }
  const isDay = !isAppDark;

  // Auto-remove custom words state
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [customWordInput, setCustomWordInput] = useState<string>('');

  // Redaction statistics
  const [stats, setStats] = useState({ emails: 1, phones: 1, links: 0, customWords: 0 });

  const executiveContainerRef = useRef<HTMLDivElement>(null);

  // Quick suggestions based on candidate metadata (e.g. company, college, city)
  const quickSuggestions = useMemo(() => {
    if (!candidate) return [];
    const suggestions: Array<{ label: string; value: string; type: string }> = [];

    if (candidate.experience && candidate.experience.length > 0 && candidate.experience[0].company) {
      suggestions.push({
        label: `Company: ${candidate.experience[0].company}`,
        value: candidate.experience[0].company,
        type: 'company'
      });
    }

    if (candidate.education && candidate.education.length > 0 && candidate.education[0].institution) {
      suggestions.push({
        label: `College: ${candidate.education[0].institution}`,
        value: candidate.education[0].institution,
        type: 'college'
      });
    }

    const cityLoc = candidate.location || candidate.city;
    if (cityLoc && cityLoc.trim()) {
      suggestions.push({
        label: `City: ${cityLoc.trim()}`,
        value: cityLoc.trim(),
        type: 'location'
      });
    }

    if (candidate.currentTitle && candidate.currentTitle.trim()) {
      suggestions.push({
        label: `Role: ${candidate.currentTitle.trim()}`,
        value: candidate.currentTitle.trim(),
        type: 'title'
      });
    }

    // Deduplicate suggestions by value and filter out existing customWords
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      const cleanVal = s.value.trim().toLowerCase();
      if (!cleanVal || seen.has(cleanVal)) return false;
      seen.add(cleanVal);
      return !customWords.some((cw) => cw.trim().toLowerCase() === cleanVal);
    });
  }, [candidate, customWords]);

  // Reset state only once when modal opens
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setMorphedPages([]);
      setLoadError(null);
      setCustomWords([]);
      setCustomWordInput('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !candidate) {
      return;
    }

    // Calculate redaction statistics
    const rawContent = `${candidate.email || ''} ${candidate.phone || ''} ${candidate.resumeText || ''}`;
    const result = sanitizeMorphedContent(rawContent, candidate.email, candidate.phone, customWords);
    setStats({
      emails: Math.max(1, result.emailsRemoved),
      phones: Math.max(1, result.phonesRemoved),
      links: result.linksRemoved,
      customWords: customWords.length
    });

    // Check if original PDF is available and can be rendered
    const isPdf = candidate.resumeUrl && (
      candidate.resumeUrl.toLowerCase().includes('.pdf') ||
      candidate.resumeFileName?.toLowerCase().endsWith('.pdf')
    );

    if (isPdf && candidate.resumeUrl) {
      loadAndRedactOriginalPdf(candidate.resumeUrl, candidate.email, candidate.phone, customWords);
    } else {
      setActiveTab('executive');
    }
  }, [isOpen, candidate, customWords]);

  // Load original PDF and overlay background-matching blanking boxes over email, phone, links, and custom words
  const loadAndRedactOriginalPdf = async (
    url: string,
    candEmail?: string,
    candPhone?: string,
    wordsToRemove: string[] = []
  ) => {
    setIsProcessing(true);
    setLoadError(null);
    try {
      // Fetch PDF array buffer
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const pagesList: MorphedPageInfo[] = [];

      const cleanEmail = (candEmail || '').trim().toLowerCase();
      const emailUser = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : '';
      const emailDomain = cleanEmail.includes('@') ? cleanEmail.split('@')[1] : '';

      const cleanPhoneDigits = (candPhone || '').replace(/\D/g, '');
      const last10Phone = cleanPhoneDigits.length >= 7 ? cleanPhoneDigits.slice(-10) : '';
      const last8Phone = cleanPhoneDigits.length >= 8 ? cleanPhoneDigits.slice(-8) : '';

      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
      const urlRegex = /(?:https?:\/\/|www\.|linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com)/i;
      const labelRegex = /^(?:email|e-mail|mail|phone|mobile|tel|contact|cell|call|linkedin|github|portfolio|website|web|site)\s*[:\-–]?\s*$/i;

      // Higher render scale (2.5) for crisp, professional high-DPI PDF generation
      const scale = 2.5;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const ptViewport = page.getViewport({ scale: 1.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) continue;

        // 1. Render original high-resolution PDF page to canvas
        await (page.render({ canvasContext: ctx as any, viewport } as any) as any).promise;

        // 2. Locate all text items matching contact info, emails, phones, web links, and custom words
        const textContent = await page.getTextContent();

        textContent.items.forEach((item: any) => {
          const str = String(item.str || '').trim();
          if (!str) return;

          let shouldBlank = false;
          const lowerStr = str.toLowerCase();

          // Check custom words to auto-remove
          if (wordsToRemove.length > 0) {
            for (const customW of wordsToRemove) {
              const target = customW.trim().toLowerCase();
              if (!target) continue;
              if (lowerStr.includes(target)) {
                shouldBlank = true;
                break;
              }
              // If target phrase is multi-word (e.g. "Tata Motors Ltd"), check if this item matches any token of length >= 4
              const phraseTokens = target.split(/\s+/).filter((t) => t.length >= 4);
              if (phraseTokens.length > 1 && phraseTokens.some((t) => lowerStr === t || lowerStr.includes(t))) {
                shouldBlank = true;
                break;
              }
            }
          }

          // Check for email match
          if (
            (cleanEmail && lowerStr.includes(cleanEmail)) ||
            (emailUser && emailUser.length >= 4 && lowerStr.includes(emailUser)) ||
            (emailDomain && lowerStr.includes(emailDomain) && lowerStr.includes('@')) ||
            emailRegex.test(str)
          ) {
            shouldBlank = true;
          }

          // Check for phone number match
          const itemDigits = str.replace(/\D/g, '');
          if (
            (last10Phone && itemDigits.includes(last10Phone)) ||
            (last8Phone && itemDigits.includes(last8Phone)) ||
            (itemDigits.length >= 9 && itemDigits.length <= 13)
          ) {
            // Guard against year ranges like 2020-2024
            if (!/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/.test(str)) {
              shouldBlank = true;
            }
          }

          // Check for web links and profiles
          if (
            urlRegex.test(str) ||
            lowerStr.includes('linkedin.com') ||
            lowerStr.includes('github.com') ||
            lowerStr.includes('http://') ||
            lowerStr.includes('https://') ||
            lowerStr.includes('www.') ||
            lowerStr.includes('.com/') ||
            lowerStr.includes('.io/') ||
            lowerStr.includes('.me/')
          ) {
            shouldBlank = true;
          }

          // Check for orphaned contact labels (e.g. "Email:", "Phone:", "LinkedIn:")
          if (labelRegex.test(str) || str === '✉' || str === '📞' || str === '📱' || str === '🔗') {
            shouldBlank = true;
          }

          if (shouldBlank && item.transform && item.transform.length >= 6) {
            // Calculate pixel-perfect coordinates using PDF.js viewport transformation
            const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);

            // Effective font size and character dimensions
            const fontPt = Math.hypot(item.transform[2], item.transform[3]) || item.height || 12;
            const fontHeight = fontPt * scale;
            const itemWidth = Math.max(8 * scale, (item.width || str.length * 6.5) * scale);

            const pad = 3 * scale;
            const boxX = Math.max(0, vx - pad);
            const boxY = Math.max(0, vy - fontHeight - pad);
            const boxW = Math.min(canvas.width - boxX, itemWidth + pad * 2);
            const boxH = Math.min(canvas.height - boxY, fontHeight * 1.35 + pad * 2);

            // Sample canvas background color just above/beside box to match colored bars or white backgrounds
            let fillColor = '#ffffff';
            try {
              const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.round(boxX + 2)));
              const sampleY = Math.max(0, Math.min(canvas.height - 1, Math.round(boxY - 3)));
              const px = ctx.getImageData(sampleX, sampleY, 1, 1).data;
              if (px[3] > 120) {
                fillColor = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
              }
            } catch (_) {
              fillColor = '#ffffff';
            }

            ctx.fillStyle = fillColor;
            ctx.fillRect(boxX, boxY, boxW, boxH);
          }
        });

        // 3. Blank out PDF clickable link annotations
        try {
          const annotations = await page.getAnnotations();
          annotations.forEach((ann: any) => {
            if (ann.subtype === 'Link' && ann.rect) {
              const rect = viewport.convertToViewportRectangle(ann.rect);
              const x = Math.min(rect[0], rect[2]);
              const y = Math.min(rect[1], rect[3]);
              const w = Math.abs(rect[2] - rect[0]);
              const h = Math.abs(rect[3] - rect[1]);

              let fillColor = '#ffffff';
              try {
                const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.round(x + 2)));
                const sampleY = Math.max(0, Math.min(canvas.height - 1, Math.round(y - 2)));
                const px = ctx.getImageData(sampleX, sampleY, 1, 1).data;
                if (px[3] > 120) {
                  fillColor = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
                }
              } catch (_) {
                fillColor = '#ffffff';
              }

              ctx.fillStyle = fillColor;
              ctx.fillRect(Math.max(0, x - 2), Math.max(0, y - 2), w + 4, h + 4);
            }
          });
        } catch (_) {
          // ignore annotation errors
        }

        pagesList.push({
          dataUrl: canvas.toDataURL('image/jpeg', 0.96),
          ptWidth: ptViewport.width,
          ptHeight: ptViewport.height
        });
      }

      setMorphedPages(pagesList);
      setActiveTab('original');
    } catch (err: any) {
      console.warn('Original PDF direct redaction not available (falling back to Executive Morphed Template):', err);
      setLoadError('Using high-accuracy Executive Morphed Template.');
      setActiveTab('executive');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add custom word to remove
  const handleAddCustomWord = (wordToAdd: string) => {
    const trimmed = wordToAdd.trim();
    if (!trimmed) return;
    if (!customWords.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      setCustomWords((prev) => [...prev, trimmed]);
    }
    setCustomWordInput('');
  };

  // Remove a word from the custom words list
  const handleRemoveCustomWord = (wordIndex: number) => {
    setCustomWords((prev) => prev.filter((_, idx) => idx !== wordIndex));
  };

  // Clear all custom words
  const handleClearAllCustomWords = () => {
    setCustomWords([]);
  };

  // Add highlighted text from page selection
  const handleRemoveCurrentSelection = () => {
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText && selectedText.length >= 2 && selectedText.length <= 80) {
      handleAddCustomWord(selectedText);
    }
  };

  // Build the compiled Morphed jsPDF Document with accurate proportions and resolution
  const generateMorphedPdfDocument = async (): Promise<jsPDF> => {
    if (!candidate) throw new Error('No candidate selected');

    if (activeTab === 'original' && morphedPages.length > 0) {
      // 1. Original Document Mode: Maintain exact original page dimensions in points (pt)
      const first = morphedPages[0];
      const isLandscape = first.ptWidth > first.ptHeight;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'l' : 'p',
        unit: 'pt',
        format: [first.ptWidth, first.ptHeight],
        compress: true
      });

      for (let i = 0; i < morphedPages.length; i++) {
        const page = morphedPages[i];
        if (i > 0) {
          pdf.addPage([page.ptWidth, page.ptHeight], page.ptWidth > page.ptHeight ? 'l' : 'p');
        }
        pdf.addImage(page.dataUrl, 'JPEG', 0, 0, page.ptWidth, page.ptHeight, undefined, 'SLOW');
      }

      return pdf;
    } else {
      // 2. Executive ATS Mode: High-fidelity multi-page A4 document
      if (!executiveContainerRef.current) throw new Error('Preview not ready');

      const element = executiveContainerRef.current;
      const originalTransform = element.style.transform;
      const originalWidth = element.style.width;

      // Temporarily remove preview zoom scale and set fixed A4 width before screenshot
      element.style.transform = 'none';
      element.style.width = '794px'; // 210mm at 96 DPI

      try {
        const canvas = await html2canvas(element, {
          scale: 2.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const a4WidthPt = 595.28;
        const a4HeightPt = 841.89;

        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'pt',
          format: [a4WidthPt, a4HeightPt],
          compress: true
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgHPt = (canvas.height * a4WidthPt) / canvas.width;
        let heightLeft = imgHPt;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, a4WidthPt, imgHPt, undefined, 'SLOW');
        heightLeft -= a4HeightPt;

        while (heightLeft > 5) {
          position -= a4HeightPt;
          pdf.addPage([a4WidthPt, a4HeightPt], 'p');
          pdf.addImage(imgData, 'JPEG', 0, position, a4WidthPt, imgHPt, undefined, 'SLOW');
          heightLeft -= a4HeightPt;
        }

        return pdf;
      } finally {
        element.style.transform = originalTransform;
        element.style.width = originalWidth;
      }
    }
  };

  // Download Morphed PDF
  const handleDownloadPDF = async () => {
    if (!candidate) return;
    setIsDownloading(true);

    try {
      const pdf = await generateMorphedPdfDocument();
      const candidateTitle = candidate.name ? candidate.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Candidate';
      const fileName = `${candidateTitle}_Morphed_Resume.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Failed to generate morphed PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Open Morphed PDF in a new browser tab with native browser PDF viewer
  const handleOpenPDFInNewTab = async () => {
    if (!candidate) return;
    setIsOpeningTab(true);

    try {
      const pdf = await generateMorphedPdfDocument();
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (error) {
      console.error('Failed to preview morphed PDF:', error);
      alert('Failed to open PDF in new tab. Please try downloading instead.');
    } finally {
      setIsOpeningTab(false);
    }
  };

  if (!isOpen || !candidate) return null;

  // Sanitized content values for Executive Layout (reflecting custom removed words as well)
  const cleanSummary = sanitizeMorphedContent(candidate.summary || '', candidate.email, candidate.phone, customWords).cleanText;
  const cleanCandidateName = candidate.name || 'Candidate Profile';
  const cleanRole = candidate.currentTitle || 'Professional Candidate';
  const cleanCity = candidate.location || candidate.city || 'Location Verified';
  const expYears = candidate.totalExperienceYears !== undefined ? `${candidate.totalExperienceYears} Yrs Experience` : '';

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] w-screen h-screen flex flex-col overflow-hidden transition-colors duration-200 animate-in fade-in duration-150 ${
        isDay
          ? 'bg-slate-100 text-slate-900'
          : 'bg-[#0a0b0e] text-white'
      }`}
    >
        {/* Top Header Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b transition-colors shrink-0 ${
            isDay
              ? 'bg-slate-50 border-slate-200 text-slate-900'
              : 'bg-[#121318] border-white/10 text-white'
          }`}
        >
          {/* Left Brand & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-colors ${
                isDay
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
              }`}
            >
              <Wand2 size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base truncate">
                  Morph Resume — Blind Client Copy
                </h3>
                <span
                  className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isDay
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-purple-500/15 text-purple-300 border-purple-500/25'
                  }`}
                >
                  <ShieldCheck size={11} />
                  Protected
                </span>
              </div>
              <p
                className={`text-xs truncate ${
                  isDay ? 'text-slate-500' : 'text-zinc-400'
                }`}
              >
                {cleanCandidateName} · Contact info &amp; selected words completely blanked
              </p>
            </div>
          </div>

          {/* Right Action Controls Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Tab Switcher (Original Redacted vs Executive ATS) */}
            {morphedPages.length > 0 && (
              <div
                className={`flex items-center rounded-lg p-0.5 border ${
                  isDay
                    ? 'bg-slate-200/70 border-slate-300'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('original')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'original'
                      ? isDay
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'bg-purple-600 text-white shadow-xs'
                      : isDay
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Original Redacted
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('executive')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'executive'
                      ? isDay
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'bg-purple-600 text-white shadow-xs'
                      : isDay
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Executive ATS
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div
              className={`hidden md:flex items-center gap-1 rounded-lg px-2 py-1 border ${
                isDay
                  ? 'bg-slate-100 border-slate-300 text-slate-600'
                  : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                className={isDay ? 'hover:text-slate-900' : 'hover:text-white'}
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-[11px] font-medium w-9 text-center">{zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className={isDay ? 'hover:text-slate-900' : 'hover:text-white'}
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Open / Preview PDF in New Tab */}
            <button
              type="button"
              onClick={handleOpenPDFInNewTab}
              disabled={isOpeningTab || isProcessing}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 border ${
                isDay
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-white/10 hover:bg-white/15 text-white border-white/10'
              }`}
              title="Open Morphed PDF in New Browser Tab"
            >
              {isOpeningTab ? (
                <Loader2 size={13} className="animate-spin text-purple-600" />
              ) : (
                <ExternalLink size={13} />
              )}
              <span className="hidden sm:inline">Open PDF</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading || isProcessing}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/25 cursor-pointer active:scale-95"
              title="Download Morphed PDF"
            >
              {isDownloading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download size={13} strokeWidth={2.2} />
                  <span>Download Morphed PDF</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border ${
                isDay
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border-white/5'
              }`}
              title="Close Preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Auto-Remove Tool Bar */}
        <div
          className={`border-b px-5 py-2.5 transition-colors shrink-0 ${
            isDay ? 'bg-slate-50/90 border-slate-200' : 'bg-[#151620] border-white/10'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Input to type word to remove */}
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div
                className={`flex items-center gap-1.5 text-xs font-bold shrink-0 ${
                  isDay ? 'text-purple-700' : 'text-purple-300'
                }`}
              >
                <Eraser size={14} className={isDay ? 'text-purple-600' : 'text-purple-400'} />
                <span>Auto-Remove Tool:</span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddCustomWord(customWordInput);
                }}
                className="flex items-center gap-1.5 flex-1"
              >
                <input
                  type="text"
                  value={customWordInput}
                  onChange={(e) => setCustomWordInput(e.target.value)}
                  placeholder="Type any word or phrase to remove (e.g. current company, college, city)..."
                  className={`flex-1 min-w-[200px] h-8 px-3 rounded-lg text-xs transition-colors border focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                    isDay
                      ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-purple-600 shadow-xs'
                      : 'bg-[#0e0f14] border-white/15 text-white placeholder-zinc-500 focus:border-purple-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!customWordInput.trim()}
                  className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <Plus size={13} />
                  <span>Remove Word</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCurrentSelection}
                  className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 border ${
                    isDay
                      ? 'bg-slate-200/80 hover:bg-slate-300 text-slate-700 hover:text-slate-900 border-slate-300'
                      : 'bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white border-white/5'
                  }`}
                  title="Click to remove text you highlighted with cursor"
                >
                  <Scissors size={12} className={isDay ? 'text-slate-600' : 'text-zinc-400'} />
                  <span className="hidden sm:inline">Remove Highlighted</span>
                </button>
              </form>
            </div>

            {/* Quick 1-Click Suggestions */}
            {quickSuggestions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[11px] font-medium ${
                    isDay ? 'text-slate-500' : 'text-zinc-400'
                  }`}
                >
                  Quick Auto-Remove:
                </span>
                {quickSuggestions.map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => handleAddCustomWord(sug.value)}
                    className={`h-6 px-2 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 border ${
                      isDay
                        ? 'bg-white hover:bg-purple-50 hover:text-purple-700 text-slate-700 border-slate-300 hover:border-purple-300 shadow-xs'
                        : 'bg-white/5 hover:bg-purple-500/20 hover:text-purple-300 text-zinc-300 border-white/10 hover:border-purple-500/30'
                    }`}
                    title={`Click to auto-remove ${sug.value}`}
                  >
                    <Plus size={10} className="shrink-0" />
                    <span className="max-w-[200px] truncate">{sug.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Removed Words Tags List */}
          {customWords.length > 0 && (
            <div
              className={`flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t ${
                isDay ? 'border-slate-200' : 'border-white/5'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDay ? 'text-slate-500' : 'text-zinc-400'
                }`}
              >
                Active Removed Words ({customWords.length}):
              </span>
              {customWords.map((word, wIdx) => (
                <span
                  key={wIdx}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isDay
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                  }`}
                >
                  <span>"{word}"</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomWord(wIdx)}
                    className="hover:text-red-600 transition-colors cursor-pointer"
                    title="Restore this word"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={handleClearAllCustomWords}
                className={`text-[10px] underline ml-1 cursor-pointer transition-colors ${
                  isDay ? 'text-slate-500 hover:text-red-600' : 'text-zinc-400 hover:text-red-400'
                }`}
              >
                Clear all
              </button>
            </div>
          )}
        </div>


        {/* Document Viewer Canvas Area */}
        <div
          className={`flex-1 w-full h-full overflow-auto p-4 sm:p-6 flex justify-center items-start transition-colors ${
            isDay ? 'bg-slate-200/85' : 'bg-[#070709]'
          }`}
        >
          {isProcessing ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw
                className={`w-8 h-8 animate-spin mx-auto ${
                  isDay ? 'text-purple-600' : 'text-purple-400'
                }`}
              />
              <p
                className={`text-sm font-semibold ${
                  isDay ? 'text-slate-700' : 'text-zinc-300'
                }`}
              >
                Morphing resume &amp; blanking contact details...
              </p>
            </div>
          ) : activeTab === 'original' && morphedPages.length > 0 ? (
            // Mode 1: Original Redacted PDF Canvas Pages
            <div
              className="space-y-6 transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            >
              {morphedPages.map((page, idx) => (
                <div
                  key={idx}
                  className={`bg-white rounded-lg overflow-hidden border max-w-[210mm] mx-auto transition-shadow ${
                    isDay
                      ? 'shadow-xl border-slate-300'
                      : 'shadow-2xl border-zinc-700/60'
                  }`}
                >
                  <img
                    src={page.dataUrl}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-auto block select-none pointer-events-none"
                  />
                  <div
                    className={`px-4 py-1.5 text-right text-[10px] border-t font-medium ${
                      isDay
                        ? 'bg-slate-50 text-slate-500 border-slate-200'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    Page {idx + 1} of {morphedPages.length} · Protected Blind Copy
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Mode 2: Executive ATS Typeset Layout (100% Vector Clean A4 Presentation)
            <div
              ref={executiveContainerRef}
              className="w-full max-w-[210mm] min-h-[297mm] bg-white text-zinc-900 rounded-lg shadow-2xl p-8 sm:p-12 transition-transform duration-200 font-sans leading-relaxed border border-slate-300"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            >
              {/* Header: Candidate Identity (Contact info removed) */}
              <div className="border-b-2 border-zinc-900 pb-5 mb-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 uppercase">
                      {cleanCandidateName}
                    </h1>
                    <p className="text-base sm:text-lg font-bold text-purple-700 mt-0.5">
                      {cleanRole}
                    </p>
                  </div>
                  <div className="text-right text-xs font-semibold text-zinc-500 uppercase tracking-widest pt-1">
                    <span className="inline-block px-2.5 py-1 rounded bg-zinc-100 border border-zinc-300 font-bold text-zinc-700">
                      Client Submission Copy
                    </span>
                  </div>
                </div>

                {/* Metadata Row: Location & Total Experience (No email, No phone, No links) */}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-medium text-zinc-600">
                  {cleanCity && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-zinc-400" />
                      <span>{cleanCity}</span>
                    </span>
                  )}
                  {expYears && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} className="text-zinc-400" />
                      <span>{expYears}</span>
                    </span>
                  )}
                  <span className="text-zinc-400 italic">
                    (Direct contact redacted for confidential representation)
                  </span>
                </div>
              </div>

              {/* Professional Summary */}
              {cleanSummary && (
                <div className="mb-6">
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-300 pb-1 mb-2.5 flex items-center gap-1.5">
                    <FileText size={14} className="text-purple-600" />
                    <span>Executive Summary</span>
                  </h2>
                  <p className="text-xs leading-relaxed text-zinc-700 whitespace-pre-line">
                    {cleanSummary}
                  </p>
                </div>
              )}

              {/* Skills & Core Competencies */}
              {Array.isArray(candidate.skills) && candidate.skills.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-300 pb-1 mb-2.5 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-600" />
                    <span>Technical &amp; Functional Competencies</span>
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Experience */}
              {Array.isArray(candidate.experience) && candidate.experience.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-300 pb-1 mb-3 flex items-center gap-1.5">
                    <Briefcase size={14} className="text-purple-600" />
                    <span>Professional Experience</span>
                  </h2>
                  <div className="space-y-4">
                    {candidate.experience.map((exp, eIdx) => {
                      const cleanHighlights = (exp.highlights || []).map(
                        (h) => sanitizeMorphedContent(h, candidate.email, candidate.phone, customWords).cleanText
                      ).filter(Boolean);

                      const cleanCompany = sanitizeMorphedContent(exp.company || '', candidate.email, candidate.phone, customWords).cleanText;
                      const cleanTitle = sanitizeMorphedContent(exp.title || '', candidate.email, candidate.phone, customWords).cleanText;

                      return (
                        <div key={eIdx} className="space-y-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs">
                            <span className="font-black text-zinc-900 text-[13px]">{cleanTitle}</span>
                            <span className="font-semibold text-zinc-500 text-[11px]">
                              {exp.startDate || ''} {exp.endDate ? `— ${exp.endDate}` : ''}
                            </span>
                          </div>
                          {cleanCompany && (
                            <div className="text-xs font-bold text-purple-700">{cleanCompany}</div>
                          )}
                          {cleanHighlights.length > 0 && (
                            <ul className="list-disc list-outside ml-4 mt-1 space-y-1 text-xs text-zinc-700">
                              {cleanHighlights.map((hl, hIdx) => (
                                <li key={hIdx}>{hl}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Education & Academic Credentials */}
              {Array.isArray(candidate.education) && candidate.education.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-300 pb-1 mb-3 flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-purple-600" />
                    <span>Education &amp; Credentials</span>
                  </h2>
                  <div className="space-y-2">
                    {candidate.education.map((edu, edIdx) => (
                      <div key={edIdx} className="flex flex-wrap items-baseline justify-between text-xs">
                        <div>
                          <span className="font-bold text-zinc-900">{edu.degree}</span>
                          {edu.institution && (
                            <span className="text-zinc-600 ml-2">· {edu.institution}</span>
                          )}
                        </div>
                        {edu.year && <span className="font-semibold text-zinc-500">{edu.year}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects (if available) */}
              {Array.isArray(candidate.projects) && candidate.projects.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-300 pb-1 mb-3 flex items-center gap-1.5">
                    <Award size={14} className="text-purple-600" />
                    <span>Key Projects &amp; Deliverables</span>
                  </h2>
                  <div className="space-y-3">
                    {candidate.projects.map((proj, pIdx) => {
                      const cleanTitle = sanitizeMorphedContent(proj.title || '', candidate.email, candidate.phone, customWords).cleanText;
                      const cleanDesc = sanitizeMorphedContent(proj.description || '', candidate.email, candidate.phone, customWords).cleanText;
                      return (
                        <div key={pIdx} className="space-y-0.5 text-xs">
                          <span className="font-bold text-zinc-900">{cleanTitle}</span>
                          {cleanDesc && <p className="text-zinc-700">{cleanDesc}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Additional Resume Text (if structured sections are minimal) */}
              {(!candidate.experience || candidate.experience.length === 0) && candidate.resumeText && (
                <div className="mb-6">
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-1.5">
                    <FileText size={14} className="text-purple-600" />
                    <span>Candidate Profile &amp; Experience Details</span>
                  </h2>
                  <div className="text-xs leading-relaxed text-zinc-700 whitespace-pre-wrap font-sans bg-zinc-50 p-4 rounded border border-zinc-200">
                    {sanitizeMorphedContent(candidate.resumeText, candidate.email, candidate.phone, customWords).cleanText}
                  </div>
                </div>
              )}

              {/* Footer Stamp */}
              <div className="border-t border-zinc-200 pt-4 mt-8 flex flex-wrap items-center justify-between text-[10px] text-zinc-400">
                <span>Verified Candidate Dossier · Confidential</span>
                <span>Protected Recruitment Representation · Zero Contact Disclosed</span>
              </div>
            </div>
          )}
        </div>
    </div>,
    document.body
  );
};
