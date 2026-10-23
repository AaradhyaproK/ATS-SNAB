import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { db, firebaseConfig } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from './MessageBox';
import { subscribeTeamAuditLogs, logTeamActivity } from '../services/auditService';
import { AuditLog, UserProfile } from '../types';
import { Users, UserPlus, Shield, Activity, Clock, CheckCircle2, AlertCircle, X, Sparkles, Briefcase, Mail, Phone, Key } from 'lucide-react';

export const RecruiterTeamPanel: React.FC = () => {
  const { user, userProfile } = useAuth();
  const messageBox = useMessageBox();

  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('Sub-Recruiter');
  const [subWaSessionId, setSubWaSessionId] = useState('');
  const [subWaPasscode, setSubWaPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const primaryUid = userProfile?.parentRecruiterId || userProfile?.teamId || user?.uid || '';
  const isPrimary = !userProfile?.parentRecruiterId && !(userProfile as any)?.isSubRecruiter && userProfile?.role !== 'sub_recruiter';

  // Team & Audit Logs should ONLY be visible to the main recruiter (Primary Owner), NOT sub-recruiters
  if (!isPrimary) {
    return null;
  }

  // Load team members
  useEffect(() => {
    if (!primaryUid) return;

    setLoadingMembers(true);
    const membersQuery = query(
      collection(db, 'users'),
      where('teamId', '==', primaryUid)
    );

    const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
      const members: UserProfile[] = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserProfile));

      // Also ensure primary recruiter is in the list if missing
      if (userProfile && !members.some(m => m.uid === primaryUid)) {
        members.unshift({
          ...userProfile,
          uid: primaryUid,
          designation: userProfile.designation || 'Primary Recruiter / Account Owner'
        });
      }

      setTeamMembers(members);
      setLoadingMembers(false);
    }, (err) => {
      console.warn('[Team Panel] Error loading team members:', err);
      setLoadingMembers(false);
    });

    return unsubscribe;
  }, [primaryUid, userProfile]);

  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Lazy load Audit Logs ONLY when activeTab === 'audit'
  useEffect(() => {
    if (!primaryUid || activeTab !== 'audit') return;

    setLoadingAuditLogs(true);
    const unsub = subscribeTeamAuditLogs(primaryUid, (logs) => {
      setAuditLogs(logs);
      setLoadingAuditLogs(false);
    });
    return unsub;
  }, [primaryUid, activeTab]);

  const handleAddSubRecruiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setCreating(true);
    setError(null);

    let secondaryApp;
    try {
      // 1. Initialize temporary secondary Firebase App to create user account
      const appName = `SecondaryApp_${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
      const subUid = userCred.user.uid;

      // 2. Write Secondary Recruiter doc to main Firestore database
      const subData = {
        uid: subUid,
        email: email.trim(),
        name: fullName.trim(),
        displayName: fullName.trim(),
        role: 'recruiter',
        isSecondary: true,
        parentRecruiterId: primaryUid,
        teamId: primaryUid,
        designation: designation.trim() || 'Secondary Recruiter',
        whatsappSessionId: subWaSessionId.trim(),
        whatsappSessionPasscode: subWaPasscode.trim(),
        adminVerified: true,
        createdAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(doc(db, 'users', subUid), subData, { merge: true }),
        setDoc(doc(db, 'profiles', subUid), subData, { merge: true })
      ]);

      // 3. Log Audit Event
      await logTeamActivity(
        primaryUid,
        'secondary_recruiter_added',
        `Added secondary recruiter "${fullName.trim()}" (${designation.trim()})`,
        {
          uid: user?.uid || '',
          name: userProfile?.name || user?.email || 'Primary Recruiter',
          email: user?.email || '',
          role: 'recruiter',
          designation: 'Primary Recruiter'
        }
      );

      // Clean up secondary auth app instance
      await secondarySignOut(secondaryAuth);
      await deleteApp(secondaryApp);

      messageBox.showSuccess(`Secondary Recruiter "${fullName.trim()}" created successfully! They can now log in using ${email.trim()}.`);
      setShowAddModal(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setDesignation('Sub-Recruiter');
    } catch (err: any) {
      console.error('[Add Sub-Recruiter Error]', err);
      setError(err.message || 'Failed to create secondary recruiter account.');
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (_) {}
      }
    } finally {
      setCreating(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  // Filtered lists
  const filteredMembers = teamMembers.filter((m) => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return true;
    return (
      (m.name || '').toLowerCase().includes(queryStr) ||
      (m.email || '').toLowerCase().includes(queryStr) ||
      (m.designation || '').toLowerCase().includes(queryStr) ||
      (m.role || '').toLowerCase().includes(queryStr)
    );
  });

  const filteredLogs = auditLogs.filter((log) => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return true;
    return (
      (log.details || '').toLowerCase().includes(queryStr) ||
      (log.action || '').toLowerCase().includes(queryStr) ||
      (log.performedBy?.name || '').toLowerCase().includes(queryStr) ||
      (log.performedBy?.email || '').toLowerCase().includes(queryStr) ||
      (log.performedBy?.designation || '').toLowerCase().includes(queryStr) ||
      (log.createdAt ? new Date(log.createdAt).toLocaleString().toLowerCase().includes(queryStr) : false)
    );
  });

  const getLogIcon = (action: string) => {
    if (action.includes('whatsapp') || action.includes('invited') || action.includes('reminder')) {
      return <Mail size={16} className="text-[#9ca3af]" />;
    }
    if (action.includes('job') || action.includes('interview')) {
      return <Briefcase size={16} className="text-[#9ca3af]" />;
    }
    if (action.includes('resume')) {
      return <Sparkles size={16} className="text-[#9ca3af]" />;
    }
    return <Clock size={16} className="text-[#9ca3af]" />;
  };

  return (
    <div className="bg-white p-5 sm:p-6 space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E4E7DC] pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#111215] text-[#D4F82C]">
              <Users size={16} />
            </div>
            <h2 className="text-base font-bold tracking-tight text-[#111215]">
              Team & Audit Logs
            </h2>
            <span className="inline-flex items-center rounded-full bg-[#D4F82C] px-2.5 py-0.5 text-[11px] font-bold text-[#111215]">
              {teamMembers.length} {teamMembers.length === 1 ? 'Member' : 'Members'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#575A51]">
            Manage secondary recruiters, coordinate candidate responses, and inspect real-time audit trails of all team activities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* SEARCH BAR */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'audit' ? 'Search audit logs...' : 'Search members...'}
              className="h-9 w-[190px] rounded-full border border-[#E4E7DC] bg-[#F8F9F5] pl-8 pr-7 text-xs text-[#111215] placeholder-[#73766C] outline-none transition-colors focus:border-[#111215] focus:bg-white"
            />
            <Activity className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#73766C]" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#73766C] hover:text-[#111215] transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* SEGMENTED CONTROL */}
          <div className="flex h-9 rounded-full border border-[#E4E7DC] bg-[#F8F9F5] p-1">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-1.5 px-3 h-full rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'members' ? 'bg-[#111215] text-white shadow-xs' : 'text-[#575A51] hover:text-[#111215]'
              }`}
            >
              <Users size={13} className="shrink-0" /> Team ({filteredMembers.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3 h-full rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'audit' ? 'bg-[#111215] text-white shadow-xs' : 'text-[#575A51] hover:text-[#111215]'
              }`}
            >
              <Activity size={13} className="shrink-0" /> Audit Trail
            </button>
          </div>

          {/* ADD BUTTON */}
          {isPrimary && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 h-9 whitespace-nowrap rounded-full bg-[#111215] text-white hover:bg-[#202227] px-4 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <UserPlus size={13} className="shrink-0 text-[#D4F82C]" />
              <span>Add Sub-Recruiter</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: TEAM MEMBERS LIST */}
      {activeTab === 'members' && (
        <div className="overflow-x-auto rounded-2xl border border-[#E4E7DC]">
          <table className="w-full divide-y divide-[#E4E7DC]">
            <thead className="bg-[#F8F9F5]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Member Name</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Email Address</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Designation / Role</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Account Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7DC] bg-white">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-xs text-[#73766C]">
                    No team members found matching "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isOwner = !member.parentRecruiterId;
                  return (
                    <tr key={member.uid} className="group hover:bg-[#F8F9F5]/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isOwner ? 'bg-[#111215] text-[#D4F82C]' : 'bg-[#F8F9F5] border border-[#E4E7DC] text-[#111215]'
                          }`}>
                            {member.name ? member.name.charAt(0).toUpperCase() : 'R'}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-[#111215] flex items-center gap-1.5">
                              {member.name || 'Recruiter'}
                              {isOwner && <Shield size={12} className="text-[#8FB305]" />}
                            </div>
                            <div className="text-[10px] text-[#73766C]">UID: {member.uid.slice(0, 10)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#575A51]">
                        {member.email}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isOwner 
                            ? 'bg-[#111215] text-white'
                            : 'bg-[#F8F9F5] border border-[#E4E7DC] text-[#575A51]'
                        }`}>
                          <Briefcase size={11} className={isOwner ? 'text-[#D4F82C]' : 'text-[#73766C]'} />
                          {member.designation || (isOwner ? 'Primary Owner' : 'Sub-Recruiter')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#575A51]">
                          <CheckCircle2 size={13} className="text-[#8FB305]" /> Shared Pipeline Access
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: REAL-TIME AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          {loadingAuditLogs ? (
            <div className="text-center py-10 flex items-center justify-center gap-3">
              <Activity className="animate-spin h-5 w-5 text-[#8FB305]" />
              <span className="text-xs text-[#575A51]">Loading real-time audit logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-dashed border-[#E4E7DC] bg-[#F8F9F5]">
              <Activity className="mx-auto h-8 w-8 text-[#73766C] mb-2" />
              <p className="text-xs text-[#73766C]">
                {searchQuery ? `No audit events found matching "${searchQuery}".` : 'No audit events recorded yet. Activity like inviting candidates or creating jobs will appear here live.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5]/50 p-4 transition-all hover:bg-white hover:border-[#111215]/30 hover:shadow-xs">
                  {/* Account Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-[#111215] text-[#D4F82C] flex items-center justify-center text-xs font-bold shrink-0">
                        {(log.performedBy?.name || log.performedBy?.email || 'R').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#111215] flex items-center gap-1.5">
                          <span>{log.performedBy?.name || 'Recruiter Account'}</span>
                          {log.performedBy?.email && (
                            <span className="text-[11px] text-[#73766C]">({log.performedBy.email})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#73766C]">
                          {log.performedBy?.designation || 'Recruiter'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#111215] bg-[#D4F82C]">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-[#73766C]">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Just now'}
                      </span>
                    </div>
                  </div>

                  {/* Activity Details */}
                  <div className="flex items-start gap-2.5 mt-2">
                    <div className="p-1.5 rounded-lg bg-white border border-[#E4E7DC] text-[#111215] shrink-0 mt-0.5">
                      {getLogIcon(log.action || '')}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-xs text-[#575A51] leading-relaxed">
                        {log.details}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E4E7DC] text-[11px] font-medium text-[#575A51]">
                          <Mail size={11} className="text-[#73766C]" />
                          <span>By: <strong className="text-[#111215]">{log.performedBy?.name || 'Recruiter'} ({log.performedBy?.email || 'N/A'})</strong></span>
                        </span>

                        {(() => {
                          const text = log.details || '';
                          const emailMatches = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || [];
                          const phoneMatches = text.match(/(\b[6-9]\d{9}\b|\(\d{10}\))/g) || [];
                          
                          const candEmails = Array.from(new Set(emailMatches.filter(
                            (e) => e.toLowerCase() !== log.performedBy?.email?.toLowerCase() && e.toLowerCase() !== 'invites@snab.co.in'
                          )));
                          const candPhones = Array.from(new Set(phoneMatches));

                          return (
                            <>
                              {candEmails.map((candEmail, idx) => (
                                <span key={`email-${idx}`} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E4E7DC] text-[11px] font-medium text-[#575A51]">
                                  <Mail size={11} className="text-[#73766C]" />
                                  <span>To: <strong className="text-[#111215]">{candEmail}</strong></span>
                                </span>
                              ))}
                              {candPhones.map((phone, idx) => (
                                <span key={`phone-${idx}`} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E4E7DC] text-[11px] font-medium text-[#575A51]">
                                  <Phone size={11} className="text-[#73766C]" />
                                  <span>Mobile: <strong className="text-[#111215]">{phone}</strong></span>
                                </span>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD SECONDARY RECRUITER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-3xl border border-[#E4E7DC] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E7DC] pb-4">
              <h3 className="text-base font-bold text-[#111215] flex items-center gap-2">
                <UserPlus className="text-[#8FB305]" size={18} /> Add Secondary Recruiter
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-[#73766C] hover:text-[#111215] transition-colors p-1 rounded-full hover:bg-[#F8F9F5]"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddSubRecruiter} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#111215] mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3.5 py-2.5 text-xs text-[#111215] placeholder-[#73766C] focus:border-[#111215] focus:bg-white focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111215] mb-1">Designation / Role Title</label>
                <input
                  type="text"
                  placeholder="e.g. Technical Hiring Lead, Sub-Recruiter"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3.5 py-2.5 text-xs text-[#111215] placeholder-[#73766C] focus:border-[#111215] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111215] mb-1">Login Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#73766C]" />
                  <input
                    type="email"
                    placeholder="sarah@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] pl-10 pr-3.5 py-2.5 text-xs text-[#111215] placeholder-[#73766C] focus:border-[#111215] focus:bg-white focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111215] mb-1">Password</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3 h-4 w-4 text-[#73766C]" />
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] pl-10 pr-3.5 py-2.5 text-xs text-[#111215] placeholder-[#73766C] focus:border-[#111215] focus:bg-white focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-[#E4E7DC] pt-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#111215] flex items-center gap-1.5">
                    <Phone size={14} className="text-[#8FB305]" /> WhatsApp Credentials (Optional)
                  </div>
                  <a
                    href="https://whatsapp-serverless.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#575A51] hover:text-[#111215] underline font-medium transition-colors"
                  >
                    Open API Site ↗
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-[#F8F9F5] border border-[#E4E7DC] text-xs text-[#575A51] space-y-1">
                  <div className="font-semibold text-[#111215]">
                    Steps to connect WhatsApp:
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[#73766C]">
                    <li>Open WhatsApp integration in your profile or layout modal</li>
                    <li>Scan the QR code with WhatsApp on your phone (Linked Devices)</li>
                  </ol>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#73766C] mb-1">WhatsApp Session ID</label>
                    <input
                      type="text"
                      placeholder="e.g. aa"
                      value={subWaSessionId}
                      onChange={(e) => setSubWaSessionId(e.target.value)}
                      className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3 py-2 text-xs text-[#111215] placeholder-[#73766C] focus:border-[#111215] focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#73766C] mb-1">Passcode</label>
                    <input
                      type="password"
                      placeholder="e.g. ."
                      value={subWaPasscode}
                      onChange={(e) => setSubWaPasscode(e.target.value)}
                      className="w-full rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] px-3 py-2 text-xs text-[#111215] placeholder-[#73766C] focus:border-[#111215] focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 rounded-full border border-[#E4E7DC] px-4 text-xs font-semibold text-[#575A51] hover:bg-[#F8F9F5] hover:text-[#111215] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="h-9 rounded-full bg-[#111215] text-white hover:bg-[#202227] px-5 text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creating ? 'Creating Account...' : 'Create Sub-Recruiter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
