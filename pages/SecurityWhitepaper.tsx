import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, Server, Key, CheckCircle2, Building2, Terminal, RefreshCw } from 'lucide-react';
import HireXLogo from '../components/HireXLogo';

export default function SecurityWhitepaper() {
  useEffect(() => {
    document.title = "Security Architecture & Whitepaper | InterviewXpert";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col font-sans selection:bg-[#D4F82C] selection:text-[#111215]">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#F8F9F5]/90 backdrop-blur-md border-b border-[#E4E7DC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <HireXLogo size="md" variant="full" isDark={false} />
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
              <span>ENTERPRISE SECURITY OVERVIEW</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#111215] tracking-tight">
              Security Architecture & Practices
            </h1>
            <p className="text-sm text-[#575A51] leading-relaxed">
              Technical documentation detailing how InterviewXpert protects candidate information, access controls, encrypted transport, and platform resilience.
            </p>
            <div className="text-xs text-[#73766C]">
              Version 2.8 • Published by SNAB Innovation LLP, Nashik, Maharashtra, India
            </div>
          </div>

          {/* Key Security Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E4E7DC] space-y-2">
              <div className="size-8 rounded-xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-bold">
                <Lock className="size-4" />
              </div>
              <h3 className="font-bold text-sm text-[#111215]">256-Bit TLS Encryption</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                All data transmitted between browsers, mobile devices, and server endpoints is encrypted using modern TLS 1.3 / AES-256 protocols.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E4E7DC] space-y-2">
              <div className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-bold">
                <Key className="size-4" />
              </div>
              <h3 className="font-bold text-sm text-[#111215]">Role-Based Access Control</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                Strict granular role separation between Super Admins, Recruiters, External Clients, and Candidates to prevent unauthorized data exposure.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E4E7DC] space-y-2">
              <div className="size-8 rounded-xl bg-[#8FB305] text-white flex items-center justify-center font-bold">
                <Server className="size-4" />
              </div>
              <h3 className="font-bold text-sm text-[#111215]">Cloud Infrastructure</h3>
              <p className="text-xs text-[#575A51] leading-relaxed">
                Hosted on enterprise Google Cloud and AWS datacenters with automated daily backups, multi-zone redundancy, and DDoS mitigation.
              </p>
            </div>
          </div>

          {/* Technical Sections */}
          <div className="space-y-6 text-xs sm:text-sm text-[#575A51] leading-relaxed bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs">
            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">1. Data Encryption Standards</h2>
              <p>
                InterviewXpert implements end-to-end security protections across the entire application lifecycle:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Encryption in Transit:</strong> HTTPS with strict HSTS policies. All HTTP connections are automatically redirected to TLS encrypted channels.</li>
                <li><strong>Encryption at Rest:</strong> Database records and candidate resume PDFs stored in Cloud Storage are encrypted using Google-managed and AWS S3 AES-256 keys.</li>
                <li><strong>WhatsApp API Security:</strong> WhatsApp alerts operate through authenticated socket sessions with Baileys end-to-end encrypted transport.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">2. Client Shortlist Tokenization</h2>
              <p>
                When a recruiter shares candidate shortlists with external hiring managers or clients via the Client Review Portal:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Share URLs are generated using cryptographically random, unguessable 64-bit token hashes.</li>
                <li>Recruiters can revoke, regenerate, or expire links at any time from the ATS dashboard.</li>
                <li>Anti-poaching data masking masks candidate phone numbers and email addresses on public client review views.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">3. Authentication & Account Protection</h2>
              <p>
                User accounts are authenticated through enterprise Firebase Authentication with:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Encrypted session tokens with secure HTTP-only cookie validation.</li>
                <li>Brute-force protection and rate limiting on password reset and login endpoints.</li>
                <li>Separate candidate authentication pathways so job seekers cannot access administrative ATS pipelines.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">4. Compliance & Legal Status</h2>
              <p>
                SNAB Innovation LLP is an incorporated Indian entity registered with the Ministry of Corporate Affairs (MCA). We operate within the legal framework of:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The Information Technology Act, 2000 and Reasonable Security Practices Rules.</li>
                <li>The Digital Personal Data Protection (DPDP) Act, 2023.</li>
                <li>Indian contract laws governing non-disclosure agreements with enterprise clients.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111215]">5. Vulnerability Disclosure & Support</h2>
              <p>
                If you discover a potential vulnerability or have security-related questions, please notify our engineering team:
              </p>
              <div className="p-4 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-1 text-xs">
                <div className="font-bold text-[#111215]">Security & Engineering Team</div>
                <div>SNAB Innovation LLP</div>
                <div>Nashik, Maharashtra, India</div>
                <div>Direct Security Contact: <a href="mailto:security@snab.co.in" className="underline font-bold text-[#111215]">security@snab.co.in</a></div>
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
            <Link to="/terms-of-service" className="hover:text-[#111215]">Terms of Service</Link>
            <span>•</span>
            <Link to="/candidate-data-charter" className="hover:text-[#111215]">Candidate Data Charter</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
