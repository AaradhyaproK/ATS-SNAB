import { useEffect } from 'react';

export interface SEOConfig {
  title: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
}

const DEFAULT_TITLE = 'InterviewXpert | #1 AI Applicant Tracking System (ATS) & Autonomous Voice Video Interview Platform';
const DEFAULT_DESC = 'InterviewXpert is the high-velocity AI Applicant Tracking System (ATS) and autonomous video & voice interview platform. Automate candidate screening, AI resume matching, WhatsApp outreach, and structured scoring.';
const DEFAULT_IMAGE = '/logo-theme-lime-squircle.png';

export function setPageSEO(config: SEOConfig) {
  if (typeof document === 'undefined') return;

  // Title
  document.title = config.title || DEFAULT_TITLE;

  // Meta helper
  const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
    let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attrName, attrValue);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  const desc = config.description || DEFAULT_DESC;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('name', 'twitter:description', desc);

  setMetaTag('property', 'og:title', config.title || DEFAULT_TITLE);
  setMetaTag('name', 'twitter:title', config.title || DEFAULT_TITLE);

  if (config.keywords) {
    setMetaTag('name', 'keywords', config.keywords);
  }

  const img = config.ogImage || DEFAULT_IMAGE;
  setMetaTag('property', 'og:image', img);
  setMetaTag('property', 'og:image:secure_url', img);
  setMetaTag('name', 'twitter:image', img);

  if (config.canonical) {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', config.canonical);
  }
}

export function usePageSEO(config: SEOConfig) {
  useEffect(() => {
    setPageSEO(config);
  }, [config.title, config.description, config.keywords, config.canonical, config.ogImage]);
}

export default usePageSEO;
