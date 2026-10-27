import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Building2, Mail, Lock } from 'lucide-react';
import HireXLogo from '../components/HireXLogo';

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy Policy | InterviewXpert";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col font-sans selection:bg-[#D4F82C] selection:text-[#111215]">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#F8F9F5]/90 backdrop-blur-md border-b border-[#E4E7DC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <HireXLogo size="md" variant="full" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#111215] px-4 py-2 rounded-full border border-[#E4E7DC] bg-white hover:bg-[#F1F3EB] transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        <div className="space-y-8">
          
          {/* Hero Title */}
          <div className="space-y-3 pb-6 border-b border-[#E4E7DC]">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[11px] font-mono font-bold text-[#111215]">
              <Lock className="size-3.5 text-[#8FB305]" />
              <span>LEGAL & COMPLIANCE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#111215] tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-[#575A51] leading-relaxed">
              This Privacy Policy explains how SNAB Technologies Private Limited collects, uses, shares, and protects personal information through hireX.
            </p>
            <div className="text-xs text-[#73766C]">
              Last Updated: January 2026 • Published by SNAB Technologies Private Limited, Nashik, Maharashtra, India
            </div>
          </div>

          {/* Detailed Policy Sections */}
          <div className="space-y-6 text-xs sm:text-sm text-[#575A51] leading-relaxed bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs">
            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">1. Introduction & Company Identity</h2>
              <p>
                SNAB Technologies Private Limited ("SNAB", "hireX", "we", "our", or "us") is an Indian registered company having its registered office in <strong>Nashik, Maharashtra, India</strong>. We provide an AI-powered recruitment operating system (hireX) for hiring teams, recruiters, and candidates.
              </p>
              <p>
                We are committed to handling all personal and professional data ethically, transparently, and in strict alignment with the Information Technology Act, 2000 and the Digital Personal Data Protection (DPDP) Act, 2023.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">2. Information We Collect</h2>
              <p>Depending on whether you are a recruiter, employer, or candidate, we collect:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account Information:</strong> Name, business email, organization name, billing details, and login credentials.</li>
                <li><strong>Candidate Information:</strong> Resumes, CVs, employment background, educational qualifications, telephone numbers, and email addresses.</li>
                <li><strong>Interview & Evaluation Data:</strong> Automated audio screening transcripts, skill ratings, match scores, and hiring manager notes.</li>
                <li><strong>Technical Usage Data:</strong> IP addresses, browser types, device information, and interaction logs with client review portals.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">3. How We Use Information</h2>
              <p>We process collected data solely for legitimate business purposes:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>To extract skills and evaluate candidate fit against job requirements.</li>
                <li>To enable recruiters to track applicants through visual Kanban pipelines.</li>
                <li>To facilitate instant candidate messaging via email and WhatsApp.</li>
                <li>To provide secure, tokenized review portals for client hiring managers.</li>
                <li>To maintain platform security, detect fraud, and comply with statutory legal requirements.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">4. Zero-Sale of Data Commitment</h2>
              <p>
                <strong>We do not sell, rent, or trade your personal data.</strong> Candidate resumes and recruiter databases remain strictly proprietary to their respective accounts. We do not provide candidate lists to third-party advertisers, lead generators, or data brokers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">5. Data Security & Retention</h2>
              <p>
                We use industry-standard technical measures including 256-bit TLS encryption in transit and AES-256 storage encryption at rest. Data is retained only for as long as necessary to fulfill recruitment services or as required by Indian legal standards.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">6. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Access the personal information we hold about you.</li>
                <li>Request rectification of inaccurate or outdated information.</li>
                <li>Request deletion or erasure of your resume and applicant profile.</li>
                <li>Opt out of marketing communications and automated notifications.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">7. Contact & Grievance Redressal</h2>
              <p>
                For questions, concerns, or grievance redressal regarding this Privacy Policy:
              </p>
              <div className="p-4 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1 text-xs">
                <div className="font-bold text-[#111215]">SNAB Technologies Private Limited</div>
                <div>Headquarters: Nashik, Maharashtra, India</div>
                <div>Email: <a href="mailto:hello@snab.co.in" className="underline font-bold text-[#111215]">hello@snab.co.in</a> / <a href="mailto:privacy@snab.co.in" className="underline font-bold text-[#111215]">privacy@snab.co.in</a></div>
              </div>
            </section>
          </div>

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-[#E4E7DC] bg-[#F8F9F5] py-8 text-center text-xs text-[#73766C]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} SNAB Technologies Private Limited. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link to="/terms-of-service" className="hover:text-[#111215]">Terms of Service</Link>
            <span>•</span>
            <Link to="/candidate-data-charter" className="hover:text-[#111215]">Candidate Data Charter</Link>
            <span>•</span>
            <Link to="/security-whitepaper" className="hover:text-[#111215]">Security Whitepaper</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}