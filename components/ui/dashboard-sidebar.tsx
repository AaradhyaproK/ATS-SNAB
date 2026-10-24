import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  BriefcaseBusiness,
  LayoutDashboard,
  Archive,
  PlusCircle,
  Users,
  Video,
  MessageSquare,
  Flame,
  UserPlus,
  Kanban,
  FileCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  href: string;
  badge?: number | string;
  shortcut?: string;
  match?: (path: string) => boolean;
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

const recruiterNavGroups: NavGroupData[] = [
  {
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        icon: LayoutDashboard,
        href: '/recruiter/jobs',
        match: (path) => path === '/recruiter/jobs',
      },
      {
        id: 'post-job',
        title: 'Post Job',
        icon: PlusCircle,
        href: '/recruiter/interview/create',
        match: (path) => path === '/recruiter/interview/create',
      },
      {
        id: 'add-candidate',
        title: 'Add Candidate',
        icon: UserPlus,
        href: '/recruiter/add-candidate',
        match: (path) => path === '/recruiter/add-candidate',
      },
      {
        id: 'all-jobs',
        title: 'All Jobs',
        icon: BriefcaseBusiness,
        href: '/recruiter/all-jobs',
        match: (path) =>
          path === '/recruiter/all-jobs' ||
          path === '/recruiter/interviews' ||
          path.startsWith('/recruiter/interview/responses') ||
          (path.startsWith('/recruiter/interview/') && !path.startsWith('/recruiter/interview/create')),
      },
      {
        id: 'assessments',
        title: 'Assessments',
        icon: FileCheck,
        href: '/recruiter/tests',
        match: (path) => path.startsWith('/recruiter/tests'),
      },
      {
        id: 'hot-leads',
        title: 'Candidate Responses',
        icon: Flame,
        href: '/recruiter/hot-leads',
        match: (path) => path === '/recruiter/hot-leads',
      },
      {
        id: 'pipeline-kanban',
        title: 'Pipeline Kanban',
        icon: Kanban,
        href: '/recruiter/pipeline',
        match: (path) => path === '/recruiter/pipeline' || path === '/recruiter/kanban',
      },
      {
        id: 'resume-dump',
        title: 'Resume Dump',
        icon: Archive,
        href: '/recruiter/resume-dump',
        match: (path) => path === '/recruiter/resume-dump',
      },
    ],
  },
];

function NavItem({
  item,
  activePath,
  onNavigate,
}: {
  item: NavItemData;
  activePath: string;
  onNavigate: (href: string) => void;
}) {
  const isActive = item.match ? item.match(activePath) : activePath === item.href;

  return (
    <Link
      to={item.href}
      onClick={() => onNavigate(item.href)}
      className={cn(
        'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] select-none cursor-pointer',
        isActive
          ? 'bg-[#111215] text-white font-bold shadow-xs active-nav-item'
          : 'text-[#575A51] hover:bg-[#F8F9F5] hover:text-[#111215] font-medium'
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <item.icon
          className={cn(
            'size-4 shrink-0 transition-colors',
            isActive ? 'text-[#D4F82C]' : 'text-[#73766C] group-hover:text-[#111215]'
          )}
          strokeWidth={1.8}
        />
        <span className="text-xs truncate">{item.title}</span>
      </span>

      <span className="flex items-center gap-2">
        {item.shortcut && (
          <kbd className="hidden h-5 items-center justify-center rounded-[4px] border border-[#E4E7DC] bg-[#F8F9F5] px-1.5 font-mono text-[10px] font-medium text-[#73766C] shadow-2xs group-hover:inline-flex">
            {item.shortcut}
          </kbd>
        )}
        {item.badge && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-[#E4E7DC] bg-[#F8F9F5] px-1.5 text-[10px] font-bold text-[#111215]">
            {item.badge}
          </span>
        )}
      </span>
    </Link>
  );
}

export function DashboardSidebar({
  className,
  activePath,
  onNavigate,
}: {
  className?: string;
  activePath: string;
  onNavigate: (href: string) => void;
}) {
  const handleNavigate = (href: string) => {
    onNavigate(href);
  };

  const manageMatch = activePath.match(/^\/recruiter\/interview\/([^/]+)(?:\/(overview|responses|candidates))?$/);
  const legacyResponsesMatch = activePath.match(/^\/recruiter\/interview\/responses\/([^/]+)$/);
  const managedInterviewId = legacyResponsesMatch?.[1] || (manageMatch && !['create', 'responses'].includes(manageMatch[1]) ? manageMatch[1] : null);
  const activeManageSection = legacyResponsesMatch ? 'responses' : manageMatch?.[2] || (managedInterviewId ? 'overview' : '');
  const manageSubItems = managedInterviewId
    ? [
        { id: 'overview', title: 'Overview', href: `/recruiter/interview/${managedInterviewId}/overview` },
        { id: 'responses', title: 'Responses', href: `/recruiter/interview/${managedInterviewId}/responses` },
        { id: 'candidates', title: 'Candidates', href: `/recruiter/interview/${managedInterviewId}/candidates` },
      ]
    : [];

  return (
      <aside className={cn('recruiter-sidebar flex h-full w-[205px] flex-col border-r border-[#E4E7DC] bg-white p-2.5 pt-3.5 font-sans text-[#111215]', className)}>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {recruiterNavGroups.map((group, index) => (
            <div key={group.heading || index} className="flex flex-col gap-1">
              {group.heading && (
                <span className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#73766C]">
                  {group.heading}
                </span>
              )}
              {group.items.map((item) => (
                <div key={item.id}>
                  <NavItem item={item} activePath={activePath} onNavigate={handleNavigate} />
                  {item.id === 'all-jobs' && manageSubItems.length > 0 && (
                    <div className="ml-[18px] mt-1 border-l border-[#E4E7DC] pl-3">
                      <div className="flex flex-col gap-1">
                        {manageSubItems.map((subItem) => {
                          const isActive = activeManageSection === subItem.id;
                          return (
                            <Link
                              key={subItem.id}
                              to={subItem.href}
                              onClick={() => handleNavigate(subItem.href)}
                              className={cn(
                                'group flex w-full items-center rounded-xl px-2.5 py-1.5 text-left transition-colors duration-150 active:scale-[0.98] select-none cursor-pointer text-xs',
                                isActive
                                  ? 'bg-[#111215] text-white font-bold'
                                  : 'text-[#575A51] hover:bg-[#F8F9F5] hover:text-[#111215]'
                              )}
                            >
                              <span className="truncate">{subItem.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
  );
}

export default DashboardSidebar;
