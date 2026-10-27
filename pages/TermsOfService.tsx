import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import HireXLogo from '../components/HireXLogo';

export default function TermsOfService() {
  useEffect(() => {
    document.title = "Terms of Service | InterviewXpert";
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
              <FileText className="size-3.5 text-[#8FB305]" />
              <span>TERMS & USER AGREEMENT</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#111215] tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-[#575A51] leading-relaxed">
              These terms govern access to and use of hireX software, APIs, candidate portals, and recruitment services provided by SNAB Innovation LLP.
            </p>
            <div className="text-xs text-[#73766C]">
              Effective Date: January 1, 2026 • Published by SNAB Innovation LLP, Nashik, Maharashtra, India
            </div>
          </div>

          {/* Detailed Policy Sections */}
          <div className="space-y-6 text-xs sm:text-sm text-[#575A51] leading-relaxed bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs">
            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">1. Agreement to Terms</h2>
              <p>
                By creating an account, accessing, or using hireX, you agree to be bound by these Terms of Service and all applicable laws of India. If you do not agree to these terms, you must not use our platform.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">2. Company Information</h2>
              <p>
                hireX is owned and operated by <strong>SNAB Innovation LLP</strong>, an incorporated Indian company with its corporate office located in <strong>Nashik, Maharashtra, India</strong>.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">3. Authorized Use of Platform</h2>
              <p>
                InterviewXpert provides recruitment automation, applicant tracking, candidate scoring, and communication tools. You agree:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>To use the platform solely for lawful recruiting, hiring, and employment purposes.</li>
                <li>Not to upload fraudulent job postings, malicious code, or deceptive candidate profiles.</li>
                <li>Not to scrape, crawl, reverse-engineer, or systematically harvest data from hireX without written authorization.</li>
                <li>To maintain the confidentiality of your account credentials and immediately notify us of any unauthorized access.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">4. Subscription Plans & Billing</h2>
              <p>
                Subscription fees for hireX are billed on a recurring monthly or annual basis as selected during registration. All pricing is transparent with zero hidden fees. Subscriptions can be cancelled at any time through your dashboard before the next billing cycle.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">5. Intellectual Property Rights</h2>
              <p>
                All software, algorithms, designs, trademarks, and documentation related to hireX remain the exclusive intellectual property of SNAB Innovation LLP. All resumes and company candidate databases uploaded by recruiters remain the property of their respective owners.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">6. Limitation of Liability</h2>
              <p>
                InterviewXpert provides AI recommendations, fit scores, and screening transcriptions as decision-support tools. Final hiring, interview, and employment decisions are made entirely by employers. SNAB Innovation LLP shall not be liable for any indirect, incidental, or consequential damages resulting from employment outcomes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">7. Governing Law & Jurisdiction</h2>
              <p>
                These Terms of Service are governed by and construed in accordance with the laws of India. Any disputes arising from or relating to these terms shall be subject to the exclusive jurisdiction of the competent courts in <strong>Nashik, Maharashtra, India</strong>.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">8. Contact Us</h2>
              <p>
                For questions regarding these Terms:
              </p>
              <div className="p-4 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1 text-xs">
                <div className="font-bold text-[#111215]">SNAB Innovation LLP</div>
                <div>Nashik, Maharashtra, India</div>
                <div>Email: <a href="mailto:hello@snab.co.in" className="underline font-bold text-[#111215]">hello@snab.co.in</a></div>
              </div>
            </section>
          </div>

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-[#E4E7DC] bg-[#F8F9F5] py-8 text-center text-xs text-[#73766C]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} SNAB Innovation LLP. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-[#111215]">Privacy Policy</Link>
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