import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import {
  Check,
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Building2,
  Users,
  Mail,
  MessageSquare,
  Bot,
  FileText,
  ChevronDown,
  ChevronUp,
  Star,
  CheckCircle2,
  PhoneCall,
  Gift
} from 'lucide-react';

export const Pricing: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<string>('ATS AI Pro');

  useEffect(() => {
    document.title = "Simple, Transparent Pricing | InterviewXpert ATS";
    window.scrollTo(0, 0);
  }, []);

  const plans = [
    {
      id: 'starter',
      name: 'ATS Starter',
      badge: 'Core ATS',
      monthlyPrice: 799,
      annualPrice: 599,
      annualBilledTotal: 7188,
      savingsPct: 25,
      description: 'For individual recruiters, small recruitment agencies, startups, and businesses looking for a core recruitment management system.',
      highlight: false,
      ctaText: 'Start 1-Month Free Trial',
      ctaVariant: 'outline',
      featureGroups: [
        {
          title: 'Job Management',
          items: [
            'Create, edit, publish & manage job openings',
            'Full job details: requirements, experience, location & salary',
            'Track job status: open, closed, on hold',
            'Centralized multi-job management dashboard'
          ]
        },
        {
          title: 'Candidate Management',
          items: [
            'Upload candidate resumes in standard formats',
            'Store candidate information & contact details',
            'Centralized candidate database & searchable talent pool',
            'Search & filter candidates using basic criteria',
            'Organize candidates by recruitment stages'
          ]
        },
        {
          title: 'Recruitment Pipeline & Resume',
          items: [
            'Visual Kanban stages (Applied, Screening, Interview, Selection, Rejection)',
            'Move candidates seamlessly between stages',
            'Maintain candidate history & interviewer notes',
            'Resume cloud storage, preview & PDF download'
          ]
        },
        {
          title: 'Basic Notifications',
          items: [
            'Standard system notifications',
            'Basic email alerts for recruitment activities',
            'Interview scheduling & candidate status updates'
          ]
        }
      ],
      features: [
        'Centralized Job Openings Management (Open, Closed, On Hold)',
        'Full JD Details: Requirements, Experience, Location & Salary',
        'Centralized Candidate Database & Resume Storage',
        'Visual Kanban Pipeline (Applied → Screening → Interview → Selection → Rejection)',
        'Resume Preview & PDF Download with Job Association',
        'Candidate Notes, Activity Log & Application History',
        'Basic Keyword, Qualification & Experience Filtering',
        'Standard Email Notifications & Interview Schedule Alerts'
      ],
      notIncluded: [
        'Automated Candidate Email Sequences & Triggers',
        'Rule-Based Skill & Keyword Candidate Matching',
        'AI Resume Parsing (Auto-Profile Creation)',
        'AI Job Creation from text or PDF JDs',
        'AI Resume-to-Job Match Scoring (0-100)',
        'AI Candidate Recommendations from Database',
        'WhatsApp Business Automation'
      ]
    },
    {
      id: 'email',
      name: 'ATS + Email Automation',
      badge: 'Automated Outreach',
      monthlyPrice: 1199,
      annualPrice: 899,
      annualBilledTotal: 10788,
      savingsPct: 25,
      description: 'For recruitment agencies and HR teams that want to automate candidate communication without using advanced AI features.',
      highlight: false,
      ctaText: 'Start 1-Month Free Trial',
      ctaVariant: 'outline',
      featureGroups: [
        {
          title: 'Includes Everything in ATS Starter, plus:',
          items: [
            'All Job & Candidate Management features',
            'Full visual Kanban pipeline & resume database'
          ]
        },
        {
          title: 'Email Automation Suite',
          items: [
            'Automated candidate notification emails when new job is published',
            'Targeted job alerts to relevant matching candidates',
            'Automated interview invitation, confirmation & reminder emails',
            'Candidate application status notifications (shortlist, review, offer)',
            'Rejection & selection emails with custom branding',
            'Automated multi-step candidate follow-up sequences',
            'Personalized email templates using candidate, job & company variables'
          ]
        },
        {
          title: 'Rule-Based Candidate Matching',
          items: [
            'Match candidates against job requirements using predefined skills & keywords',
            'Filter by experience, location, qualifications, and notice period',
            'Automatically identify candidates who meet specified criteria',
            'Auto-trigger email notifications to all eligible candidates'
          ]
        },
        {
          title: 'Email Workflow Automation',
          items: [
            'Automated pipeline: Job Created → Identify Matching Candidates → Automated Email → Track Opens/Status → Recruiter Follow-up'
          ]
        }
      ],
      features: [
        'Everything in ATS Starter',
        'Automated Candidate Notifications on New Job Creation',
        'Automated Matching Job Alerts to Eligible Candidates',
        'Interview Invitation, Confirmation & 24h Reminder Emails',
        'Application Status Emails (Shortlist, Offer, Selection, Rejection)',
        'Automated Multi-Step Candidate Follow-Up Sequences',
        'Personalized Dynamic Templates (Candidate Name, Title, Company)',
        'Rule-Based Skill, Keyword & Experience Matching Filters',
        'Recruiter Email Workflow Automation & Response Tracking'
      ],
      notIncluded: [
        'AI Resume Parsing & Auto-Profile Creation',
        'AI Job Creation from Text or PDF',
        'Personalized 0-100 AI Match Score & Explanations',
        'AI Candidate Recommendations from Database',
        'WhatsApp Business Integration'
      ]
    },
    {
      id: 'ai-pro',
      name: 'ATS AI Pro',
      badge: '⭐️ Primary AI Plan • Recommended',
      monthlyPrice: 1999,
      annualPrice: 1499,
      annualBilledTotal: 17988,
      savingsPct: 25,
      description: 'Our primary AI subscription plan. Precision resume-to-job matching, automated parsing, JD generation, and candidate recommendations.',
      highlight: true,
      ctaText: 'Start 1-Month Free Trial',
      ctaVariant: 'primary',
      featureGroups: [
        {
          title: 'Includes Everything in ATS Starter + Email Auto, plus:',
          items: [
            'All core ATS and automated email workflow capabilities'
          ]
        },
        {
          title: 'AI Resume Parsing & Candidate Creation',
          items: [
            'Upload resumes in supported formats, including PDF & DOCX',
            'Automatically extract candidate name, email, phone, education, skills, work experience',
            'Automatically create structured candidate profiles (0 manual data entry)',
            'Instantly associate parsed resumes with existing or new jobs'
          ]
        },
        {
          title: 'AI Job Creation (Text & PDF)',
          items: [
            'Job creation from normal text: AI extracts title, skills, experience, qualifications & responsibilities',
            'Job creation from PDF: upload a PDF JD -> AI converts content into structured job opening ready to publish'
          ]
        },
        {
          title: 'AI Resume-to-Job Matching & Scoring',
          items: [
            'Personalized 0 to 100 candidate match score against specific job description',
            'Evaluates technical skills, experience fit, and qualifications',
            'Identifies matching skills and missing requirements',
            'Provides transparent match explanations for recruiters',
            'Ranks candidates according to relevance to the opening'
          ]
        },
        {
          title: 'AI Recommendations & Automated Outreach',
          items: [
            'Automatically recommend suitable candidates from existing database for new jobs',
            'Generate candidate shortlists without reading every resume',
            'Automated AI outreach: JD analyzed → AI matches → scores calculated → automated email with 1-click apply links'
          ]
        },
        {
          title: 'Monthly AI Usage Allowance Included',
          items: [
            '100 AI Job Creations / month',
            '1,000 AI Resume Parses / month',
            '1,000 AI Resume-to-Job Match Scores / month',
            '500 AI Candidate Recommendation Runs / month'
          ]
        }
      ],
      features: [
        'Everything in ATS + Email Automation',
        'AI Resume Parsing (PDF & DOCX to structured candidate profiles)',
        '1-Click AI Candidate Creation (Zero manual data entry)',
        'AI Job Creation from Normal Text Description or PDF JD',
        'Personalized 0-100 AI Match Score per Job (Skill & Gap Analysis)',
        'Match Explanations with Missing Requirements & Experience Fit',
        'AI Candidate Recommendations from Existing Talent Pool',
        'Automated AI Candidate Outreach with 1-Click Apply Links',
        'Algorithmic Candidate Ranking by Relevance',
        'Monthly AI Usage Allowance Included:',
        '• 100 AI Job Creations / month',
        '• 1,000 AI Resume Parses / month',
        '• 1,000 AI Match Scores / month',
        '• 500 Candidate Recommendation Runs / month'
      ],
      notIncluded: [
        'WhatsApp Business Integration (Available as ₹499/mo Add-On)'
      ]
    },
    {
      id: 'whatsapp',
      name: 'ATS AI + WhatsApp Automation',
      badge: '⚡ Maximum Velocity & Turnaround',
      monthlyPrice: 2999,
      annualPrice: 2299,
      annualBilledTotal: 27588,
      savingsPct: 23,
      description: 'For high-volume recruitment agencies, staffing companies, and businesses requiring fastest candidate communication.',
      highlight: false,
      ctaText: 'Start 1-Month Free Trial',
      ctaVariant: 'outline',
      featureGroups: [
        {
          title: 'Includes Everything in ATS AI Pro, plus:',
          items: [
            'All AI resume parsing, scoring, JD generation & recommendations'
          ]
        },
        {
          title: 'WhatsApp Business API Integration',
          items: [
            'Connect recruitment workflow with official WhatsApp Business API',
            'Send automated candidate notifications directly to WhatsApp',
            'Approved Meta WhatsApp message templates with interactive quick-reply buttons',
            'Personalize messages using candidate & job variables',
            'Live delivery, read status, and candidate response tracking'
          ]
        },
        {
          title: 'Automated WhatsApp Job Alerts',
          items: [
            'New job created → AI matches candidates → score calculated → automated WhatsApp alerts sent',
            'Candidates tap 1-click apply / express interest instantly',
            'Recruiters review interested candidates in real time'
          ]
        },
        {
          title: 'WhatsApp Interview Automation',
          items: [
            'Automated WhatsApp interview invitations',
            'Instant interview confirmation messages',
            'Automated 24-hour and 1-hour interview reminders',
            'Interview rescheduling alerts & status notifications',
            'Candidate follow-up and engagement messages'
          ]
        },
        {
          title: 'Multi-Channel Candidate Communication',
          items: [
            'Synchronized dual-channel communication (Email + WhatsApp)',
            'Smart fallback: Auto-email if candidate does not open WhatsApp message',
            'Unified multi-channel timeline per candidate'
          ]
        },
        {
          title: 'Expanded Monthly Allowances Included',
          items: [
            '150 AI Job Creations / month',
            '2,500 AI Resume Parses / month',
            '2,500 AI Match Scores / month',
            '1,000 AI Recommendation Runs / month',
            'Full WhatsApp Business Automation workflows & trigger engine'
          ]
        }
      ],
      features: [
        'Everything in ATS AI Pro',
        'Official WhatsApp Business API Automation Integration',
        'Automated WhatsApp Job Alerts with 1-Tap Candidate Apply',
        'Automated WhatsApp Interview Invitations & Confirmations',
        'Automated 24h & 1h WhatsApp Interview Reminders',
        'Interview Rescheduling Alerts & Status Updates on WhatsApp',
        'Synchronized Multi-Channel (Email + WhatsApp) Candidate Workflows',
        'Smart Fallback: Auto-Email if WhatsApp Message Unopened',
        'Approved Meta Templates with Rich Media & Quick-Action Buttons',
        'Live Delivery, Read Status & Candidate Response Tracking',
        'Expanded Usage: 2,500 Parses & Scores, 150 Jobs / month',
        'Priority Technical & Template Approval Support'
      ],
      notIncluded: []
    }
  ];

  const faqs = [
    {
      q: 'How does the 1-Month Free Trial work?',
      a: 'All plans include a full 1-Month Free Trial with zero credit card required. You get complete access to create jobs, manage candidates, and test automated workflows. If you choose an annual plan, your subscription also includes an extra month free along with a 25% discount!'
    },
    {
      q: 'Can I start with ATS Starter and upgrade later?',
      a: 'Absolutely! Our pricing is designed to grow with your business. You can start on ATS Starter or ATS + Email Automation, and seamlessly upgrade to ATS AI Pro or WhatsApp Automation at any time with pro-rated billing.'
    },
    {
      q: 'How does annual billing provide 25% savings?',
      a: 'Annual plans are billed upfront for 12 months. For instance, ATS Starter is ₹799/month on monthly billing, but only ₹599/month (₹7,188/year) on annual billing — saving you ₹2,400 annually per recruiter seat.'
    },
    {
      q: 'Are WhatsApp messaging charges included?',
      a: 'The ATS AI + WhatsApp Automation plan covers all workflow automation, triggers, and templates. Third-party WhatsApp Business API charges (Meta conversation charges) are billed separately or covered through your connected WhatsApp Business account, ensuring 100% transparency with zero hidden markups.'
    },
    {
      q: 'Can I purchase WhatsApp as an add-on for ATS AI Pro?',
      a: 'Yes! If you are on the ATS AI Pro plan (₹1,499/mo), you can add WhatsApp Business Automation as an add-on for just ₹499 per recruiter per month without upgrading your entire subscription.'
    },
    {
      q: 'How do AI Voice Interviews & Technical Assessments work?',
      a: 'AI Voice Webcam Interviews, coding tests, and MCQ technical assessments are offered as modular pay-per-candidate credits. This keeps our base ATS subscription ultra-affordable while allowing you to purchase interview evaluation credits only when you need them.'
    },
    {
      q: 'Do you offer special pricing for agencies and enterprise teams?',
      a: 'Yes! For recruitment agencies and larger corporate HR teams with 5+ recruiter seats, our Agency Package starts at ₹7,999/month for up to 5 seats on annual billing, with shared candidate pools, client review portals, priority onboarding, and custom workflows.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans antialiased selection:bg-[#D4F82C] selection:text-black">
      <Navbar />

      {/* Hero Header */}
      <section className="pt-28 sm:pt-36 pb-8 sm:pb-12 px-4 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E4E7DC] text-[11px] font-mono font-bold text-[#575A51] mb-3 shadow-2xs">
          <span className="size-2 rounded-full bg-[#8FB305] animate-pulse" />
          <span>TRANSPARENT RECRUITMENT PRICING</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#111215] tracking-tight">
          Simple, transparent pricing.<br className="hidden sm:inline" /> Zero hidden fees.
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[#575A51] max-w-2xl mx-auto">
          Tailored for Indian recruitment agencies, startups, and enterprise talent teams. Start with a solid ATS foundation and scale with AI and WhatsApp automation.
        </p>

        {/* Monthly vs Annual Toggle */}
        <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-white border border-[#E4E7DC] shadow-sm">
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
              billingCycle === 'annual'
                ? 'bg-[#111215] text-white shadow-sm'
                : 'text-[#73766C] hover:text-[#111215]'
            }`}
          >
            <span>Annual Billing</span>
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-[#111215] text-white shadow-sm'
                : 'text-[#73766C] hover:text-[#111215]'
            }`}
          >
            <span>Monthly Billing</span>
          </button>
        </div>
      </section>

      {/* 4 Core Pricing Cards Grid */}
      <section className="py-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan) => {
            const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-200 ${
                  plan.highlight
                    ? 'bg-[#111215] text-white border-2 border-[#D4F82C] shadow-2xl scale-[1.02] z-10'
                    : 'bg-white text-[#111215] border border-[#E4E7DC] shadow-sm hover:border-[#111215]/30'
                }`}
              >
                {/* Popular Pill */}
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>Recommended</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      plan.highlight
                        ? 'bg-white/10 text-[#D4F82C]'
                        : 'bg-[#F8F9F5] text-[#575A51] border border-[#E4E7DC]'
                    }`}>
                      {plan.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-black tracking-tight">{plan.name}</h3>
                  <p className={`text-xs mt-1.5 min-h-[40px] leading-relaxed ${
                    plan.highlight ? 'text-slate-300' : 'text-[#73766C]'
                  }`}>
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mt-5 pb-5 border-b border-gray-200/60 dark:border-white/10">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight">₹{price.toLocaleString('en-IN')}</span>
                      <span className={`text-xs font-semibold ${plan.highlight ? 'text-slate-400' : 'text-[#73766C]'}`}>
                        / seat / month
                      </span>
                    </div>

                    <div className="mt-1.5 text-[11px] font-medium flex items-center justify-between">
                      {billingCycle === 'annual' ? (
                        <>
                          <span className={plan.highlight ? 'text-[#D4F82C]' : 'text-emerald-700'}>
                            ₹{plan.annualBilledTotal.toLocaleString('en-IN')} billed annually
                          </span>
                          <span className="font-bold text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                            Save 25%
                          </span>
                        </>
                      ) : (
                        <span className={plan.highlight ? 'text-slate-400' : 'text-[#73766C]'}>
                          Billed monthly • Cancel anytime
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="mt-5 space-y-2.5">
                    <div className={`text-[11px] font-bold uppercase tracking-wider ${
                      plan.highlight ? 'text-slate-400' : 'text-[#73766C]'
                    }`}>
                      Features Included:
                    </div>
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs leading-snug">
                        <Check size={14} className={`shrink-0 mt-0.5 ${
                          plan.highlight ? 'text-[#D4F82C]' : 'text-emerald-600'
                        }`} />
                        <span className={plan.highlight ? 'text-slate-200' : 'text-slate-800 font-medium'}>
                          {feat}
                        </span>
                      </div>
                    ))}

                    {plan.notIncluded.length > 0 && (
                      <div className="pt-2 space-y-1.5 opacity-60">
                        {plan.notIncluded.map((notFeat, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-gray-400">
                            <X size={12} className="shrink-0 mt-0.5 text-gray-400" />
                            <span>{notFeat}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sticky Card CTA Footer */}
                <div className={`sticky bottom-0 z-20 mt-8 pt-3.5 pb-2.5 -mx-6 px-6 rounded-b-3xl transition-colors ${
                  plan.highlight
                    ? 'bg-[#111215]/95 backdrop-blur-md border-t border-white/10 shadow-lg'
                    : 'bg-white/95 backdrop-blur-md border-t border-[#E4E7DC] shadow-sm'
                }`}>
                  <Link
                    to={`/book-demo?plan=${encodeURIComponent(plan.name)}`}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                      plan.highlight
                        ? 'bg-[#D4F82C] text-[#111215] hover:bg-lime-400 shadow-md hover:scale-[1.01]'
                        : 'bg-[#111215] text-white hover:bg-black shadow-xs hover:scale-[1.01]'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight size={13} />
                  </Link>
                  <p className={`text-[10px] text-center mt-1.5 font-medium ${
                    plan.highlight ? 'text-slate-400' : 'text-[#73766C]'
                  }`}>
                    1 Month Free Trial • No Credit Card Required
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add-Ons & Modular Services Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#73766C] px-2.5 py-0.5 rounded bg-white border border-[#E4E7DC]">
            FLEXIBLE ADD-ONS & USAGE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111215] tracking-tight mt-2">
            Modular add-ons when you need them.
          </h2>
          <p className="text-xs sm:text-sm text-[#575A51] mt-1">
            Keep your base ATS cost ultra-affordable, and pay only for high-speed WhatsApp triggers or on-demand AI Video Interviews.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add-on 1: WhatsApp Automation Add-On */}
          <div className="bg-white rounded-2xl border border-[#E4E7DC] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F8F9F5] text-[#575A51] border border-[#E4E7DC]">
                  For ATS AI Pro
                </span>
              </div>
              <h3 className="text-base font-bold text-[#111215]">WhatsApp Automation Add-On</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black">₹499</span>
                <span className="text-xs text-[#73766C]">/ recruiter / month</span>
              </div>
              <p className="text-xs text-[#575A51] mt-2 leading-relaxed">
                Add WhatsApp candidate communication to ATS AI Pro without upgrading to the highest plan. Includes job alert triggers, interview invites & reminders.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#E4E7DC] text-[11px] text-[#73766C]">
              *Meta & WhatsApp provider charges billed separately as per actual usage.
            </div>
          </div>

          {/* Add-on 2: AI Voice Interviews & Assessments */}
          <div className="bg-white rounded-2xl border border-[#E4E7DC] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F8F9F5] text-[#575A51] border border-[#E4E7DC]">
                  Pay-As-You-Go
                </span>
              </div>
              <h3 className="text-base font-bold text-[#111215]">AI Video Interviews & Tests</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black">₹129 - ₹149</span>
                <span className="text-xs text-[#73766C]">/ evaluated candidate</span>
              </div>
              <p className="text-xs text-[#575A51] mt-2 leading-relaxed">
                Automated webcam & speech evaluation, anti-cheat tracking, and technical MCQs/coding rounds. Available as credit packs on any ATS plan.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#E4E7DC] text-[11px] text-[#73766C]">
              Zero monthly commitments — purchase evaluation credits only when hiring.
            </div>
          </div>

          {/* Add-on 3: High Volume AI Credit Packs */}
          <div className="bg-white rounded-2xl border border-[#E4E7DC] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <Zap size={18} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F8F9F5] text-[#575A51] border border-[#E4E7DC]">
                  High Volume
                </span>
              </div>
              <h3 className="text-base font-bold text-[#111215]">AI Parsing & Scoring Packs</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black">Custom Packs</span>
                <span className="text-xs text-[#73766C]">from ₹999</span>
              </div>
              <p className="text-xs text-[#575A51] mt-2 leading-relaxed">
                Exceeded your monthly 1,000 resume parsing or scoring allowance? Top up with instant credit packs that never expire.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#E4E7DC] text-[11px] text-[#73766C]">
              Includes bulk resume dump parsing and instant scoring triggers.
            </div>
          </div>
        </div>
      </section>

      {/* Agency & Enterprise Package Banner */}
      <section className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl border border-[#111215] bg-[#111215] text-white p-6 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4F82C]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#D4F82C] text-xs font-bold">
                <Building2 size={14} />
                <span>AGENCY & ENTERPRISE TALENT TEAMS</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Manage multiple recruiters, shared candidate pools, and client portals.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                For staffing agencies and corporate HR departments. Includes 5 recruiter seats on annual billing, multi-user permissions, co-branded client review links, SLA support, and dedicated onboarding.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#D4F82C] shrink-0" />
                  <span>5 Recruiter Seats Included</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#D4F82C] shrink-0" />
                  <span>Client Review Portal with Live Sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#D4F82C] shrink-0" />
                  <span>Shared Resume Database & Central Search</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#D4F82C] shrink-0" />
                  <span>Dedicated Onboarding & Priority SLA</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-between text-center space-y-4">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Starting at only</span>
                <div className="text-3xl sm:text-4xl font-black text-white mt-1">₹7,999<span className="text-xs text-slate-400 font-normal"> / month</span></div>
                <p className="text-[11px] text-[#D4F82C] font-semibold mt-1">For up to 5 recruiter seats (Annual billing)</p>
              </div>

              <div className="space-y-2">
                <Link
                  to="/book-demo"
                  className="w-full py-3 px-4 rounded-xl bg-[#D4F82C] text-[#111215] text-xs font-black hover:bg-lime-400 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <PhoneCall size={14} />
                  <span>Talk to Enterprise Sales & Book Demo</span>
                </Link>
                <p className="text-[10px] text-slate-400">Custom plans available for 10–50+ seats</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix Table */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#73766C] px-2.5 py-0.5 rounded bg-white border border-[#E4E7DC]">
            DETAILED BREAKDOWN
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111215] tracking-tight mt-2">
            Compare plans feature by feature.
          </h2>
          <p className="text-xs sm:text-sm text-[#575A51] mt-1">
            Find the right level of automation for your hiring velocity.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#E4E7DC] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E4E7DC] text-xs">
              <thead className="bg-[#F8F9F5]">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-[#111215] uppercase tracking-wider text-[11px] w-2/5">
                    Feature Category
                  </th>
                  <th className="px-4 py-4 text-center font-bold text-[#111215] text-[11px]">
                    ATS Starter<br /><span className="text-[10px] font-normal text-[#73766C]">₹599/mo</span>
                  </th>
                  <th className="px-4 py-4 text-center font-bold text-[#111215] text-[11px]">
                    ATS + Email<br /><span className="text-[10px] font-normal text-[#73766C]">₹899/mo</span>
                  </th>
                  <th className="px-4 py-4 text-center font-bold text-[#111215] bg-[#D4F82C]/15 border-x border-[#D4F82C]/30 text-[11px]">
                    ATS AI Pro<br /><span className="text-[10px] font-bold text-[#111215]">₹1,499/mo (Rec.)</span>
                  </th>
                  <th className="px-4 py-4 text-center font-bold text-[#111215] text-[11px]">
                    ATS AI + WhatsApp<br /><span className="text-[10px] font-normal text-[#73766C]">₹2,299/mo</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7DC]">
                {/* Group 1: Core ATS */}
                <tr className="bg-gray-50/50 font-bold text-[11px] text-[#575A51]">
                  <td colSpan={5} className="px-6 py-2 uppercase tracking-wider">
                    Core Applicant Tracking System (ATS)
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Job Creation & Centralized Management</td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Resume Upload & Central Database</td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Visual Kanban Pipeline Stages</td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Candidate Search & Multi-Filter</td>
                  <td className="px-4 py-3 text-center">Basic</td>
                  <td className="px-4 py-3 text-center">Advanced</td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold">AI Semantic</td>
                  <td className="px-4 py-3 text-center font-bold">AI Semantic</td>
                </tr>

                {/* Group 2: Email Automation */}
                <tr className="bg-gray-50/50 font-bold text-[11px] text-[#575A51]">
                  <td colSpan={5} className="px-6 py-2 uppercase tracking-wider">
                    Email Automation & Notifications
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Standard System Notifications</td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Automated Matching Job Alerts to Candidates</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Interview Invites, Reminders & Status Updates</td>
                  <td className="px-4 py-3 text-center">Manual</td>
                  <td className="px-4 py-3 text-center">Automated</td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold">Automated</td>
                  <td className="px-4 py-3 text-center font-bold">Automated</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Personalized Dynamic Email Templates</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>

                {/* Group 3: AI Capabilities */}
                <tr className="bg-gray-50/50 font-bold text-[11px] text-[#575A51]">
                  <td colSpan={5} className="px-6 py-2 uppercase tracking-wider">
                    AI Recruitment Automation & Intelligence
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">AI Resume Parsing (PDF/Doc to Candidate Profile)</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">AI Job Description Creation from Text or PDF</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Personalized 0-100 AI Match Score & Explanations</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center">Rule-Based</td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 font-bold text-emerald-700">Deep AI Match</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-700">Deep AI Match</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">AI Candidate Recommendations from Existing Pool</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Automated AI Candidate Outreach with 1-Click Apply</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>

                {/* Group 4: WhatsApp Automation */}
                <tr className="bg-gray-50/50 font-bold text-[11px] text-[#575A51]">
                  <td colSpan={5} className="px-6 py-2 uppercase tracking-wider">
                    WhatsApp Business Automation
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">WhatsApp Job Alerts with 1-Click Apply</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 text-[#575A51]">₹499/mo Add-On</td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">WhatsApp Interview Invites & Status Updates</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 text-[#575A51]">₹499/mo Add-On</td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-800">Synchronized Multi-Channel (Email + WhatsApp)</td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center bg-[#D4F82C]/5 border-x border-[#D4F82C]/20 text-gray-400"><X size={13} className="mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Check size={14} className="text-emerald-600 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#73766C] px-2.5 py-0.5 rounded bg-white border border-[#E4E7DC]">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111215] tracking-tight mt-2">
            Everything you need to know about pricing.
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#E4E7DC] overflow-hidden transition-all shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-[#111215] cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <div className="h-6 w-6 rounded-full bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center shrink-0 text-[#73766C]">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-xs text-[#575A51] leading-relaxed border-t border-gray-100">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Sticky Action Banner */}
      <section className="py-12 px-4 bg-white border-t border-[#E4E7DC] text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            <Sparkles size={13} className="text-emerald-600" />
            <span>Ready to transform your recruitment pipeline?</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-[#111215] tracking-tight">
            Start hiring faster with 1 Month Free.
          </h2>
          <p className="text-xs sm:text-sm text-[#575A51] max-w-xl mx-auto">
            Zero setup fees. Zero credit card needed. Full access to job distribution, automated screening, and AI match scoring.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/book-demo"
              className="px-6 py-3 rounded-xl bg-[#111215] text-[#D4F82C] text-xs sm:text-sm font-black hover:bg-black transition-all shadow-md flex items-center gap-2"
            >
              <span>Get Started Free for 1 Month</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              to="/book-demo"
              className="px-6 py-3 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] text-xs sm:text-sm font-bold hover:bg-[#E4E7DC] transition-colors"
            >
              Request Custom Demo & 30-Day Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-t border-[#E4E7DC] text-xs text-[#73766C]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span>© {new Date().getFullYear()} InterviewXpert • SNAB Innovation LLP. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-semibold text-[#575A51]">
            <Link to="/" className="hover:text-[#111215] transition-colors">Home</Link>
            <span>•</span>
            <Link to="/active-jobs" className="hover:text-[#111215] transition-colors">Job Board</Link>
            <span>•</span>
            <Link to="/pricing" className="text-[#111215] font-bold">Pricing</Link>
            <span>•</span>
            <Link to="/privacy-policy" className="hover:text-[#111215] transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms-of-service" className="hover:text-[#111215] transition-colors">Terms of Service</Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-[#111215] transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
