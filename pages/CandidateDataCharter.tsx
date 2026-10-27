import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, Eye, Trash2, CheckCircle2, Building2, Mail, Phone } from 'lucide-react';
import HireXLogo from '../components/HireXLogo';

export default function CandidateDataCharter() {
  useEffect(() => {
    document.title = "Candidate Data Charter | InterviewXpert";
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
              <ShieldCheck className="size-3.5 text-[#8FB305]" />
              <span>CANDIDATE PRIVACY & TRUST PLEDGE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#111215] tracking-tight">
              Candidate Data Charter
            </h1>
            <p className="text-sm text-[#575A51] leading-relaxed">
              Our solemn commitment to every applicant, professional, and job seeker on how your personal data, resumes, contact details, and evaluations are safeguarded.
            </p>
            <div className="text-xs text-[#73766C]">
              Effective Date: January 1, 2026 • Published by SNAB Technologies Private Limited, Nashik, Maharashtra, India
            </div>
          </div>

          {/* Core Principles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E4E7DC] space-y-2">
              <div className="size-8 rounded-xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold">
                <Lock className="size-4" />
              </div>
              <h3 className="font-bold text-sm text-[#111215]">Zero Data Selling</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                We never monetize, broker, or sell candidate resumes, contact information, or profiles to third-party ad networks or brokers.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E4E7DC] space-y-2">
              <div className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold">
                <Eye className="size-4" />
              </div>
              <h3 className="font-bold text-sm text-[#111215]">Anti-Poaching Blind Masking</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                When recruiters share shortlists with external clients, candidate phone numbers and email addresses can be automatically masked to prevent unauthorized contact.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E4E7DC] space-y-2">
              <div className="size-8 rounded-xl bg-[#8FB305] text-white flex items-center justify-center font-bold">
                <Trash2 className="size-4" />
              </div>
              <h3 className="font-bold text-sm text-[#111215]">Right to Erasure & Deletion</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                You retain full rights to request complete deletion of your resume, application history, and voice evaluations from our database at any time.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E4E7DC] space-y-2">
              <div className="size-8 rounded-xl bg-white border border-[#E4E7DC] text-[#111215] flex items-center justify-center font-bold">
                <Building2 className="size-4 text-[#8FB305]" />
              </div>
              <h3 className="font-bold text-sm text-[#111215]">Legally Registered Accountability</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                Operated by SNAB Technologies Private Limited, an Indian registered private limited company governed under the laws of India and the DPDP Act, 2023.
              </p>
            </div>
          </div>

          {/* Detailed Policy Sections */}
          <div className="space-y-6 text-xs sm:text-sm text-[#575A51] leading-relaxed bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs">
            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">1. Data Collected from Candidates</h2>
              <p>
                When you apply for a job or register on the InterviewXpert platform, we collect:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Basic identity details: Full Name, Email Address, Contact Number.</li>
                <li>Professional credentials: Resume/CV document, LinkedIn profile link, portfolio links.</li>
                <li>Work profile: Work experience, education history, current CTC, expected compensation, and notice period.</li>
                <li>Interview responses: Automated voice or video responses provided during pre-screening rounds (only when voluntarily submitted).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">2. Purpose of Processing</h2>
              <p>
                Your candidate data is strictly processed to:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Match your skills against active job openings created by employers and recruiting agencies.</li>
                <li>Facilitate direct communication regarding interview dates, status updates, and offer negotiations via email and WhatsApp.</li>
                <li>Enable the hiring manager of the specific job opening you applied for to review your qualifications.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">3. Anti-Poaching and Privacy Redaction</h2>
              <p>
                To protect job seekers from spam and predatory poaching, InterviewXpert provides employers and agencies with PII-masking tools. During initial client reviews, your personal phone numbers and direct email addresses can remain hidden until formal interview confirmation.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">4. Candidate Rights & Data Control</h2>
              <p>
                Under the Digital Personal Data Protection (DPDP) Act of India, you hold the following rights:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Right to Access:</strong> Review all resumes and interview records stored under your profile.</li>
                <li><strong>Right to Correction:</strong> Update outdated skills, education, contact numbers, or resume documents.</li>
                <li><strong>Right to Erasure:</strong> Request permanent removal of your resume and application trail. Simply email <a href="mailto:privacy@snab.co.in" className="text-[#111215] font-bold underline">privacy@snab.co.in</a> or use the Candidate Portal.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">5. Contact Our Privacy Office</h2>
              <p>
                For any inquiries regarding candidate data handling or to submit an erasure request:
              </p>
              <div className="p-4 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1 text-xs">
                <div className="font-bold text-[#111215]">Data Protection Officer (DPO)</div>
                <div>SNAB Technologies Private Limited</div>
                <div>Nashik, Maharashtra, India</div>
                <div>Email: <a href="mailto:privacy@snab.co.in" className="underline font-bold text-[#111215]">privacy@snab.co.in</a> / <a href="mailto:hello@snab.co.in" className="underline font-bold text-[#111215]">hello@snab.co.in</a></div>
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
            <Link to="/privacy-policy" className="hover:text-[#111215]">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms-of-service" className="hover:text-[#111215]">Terms of Service</Link>
            <span>•</span>
            <Link to="/security-whitepaper" className="hover:text-[#111215]">Security Whitepaper</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
