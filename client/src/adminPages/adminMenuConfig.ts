export interface AdminMenuItem {
  id: string;
  label: string;
  iconKey?: string;
  path?: string;
  children?: AdminMenuItem[];
}

export interface AdminMenuSection {
  id: string;
  title?: string;
  items: AdminMenuItem[];
  superAdminOnly?: boolean;
}

export function buildAdminMenuSections(isSuperAdmin: boolean): AdminMenuSection[] {
  const sections: AdminMenuSection[] = [
    {
      id: "main",
      title: "기본",
      items: [
        {
          id: "admin-home",
          label: "홈 페이지",
          path: "/admin/home",
          iconKey: "adListIcon",
        },
        {
          id: "homepage-management",
          label: "홈페이지 관리",
          path: "/admin/homepage-management",
          iconKey: "adMatchCharaterIcon",
        },
      ],
    },
    {
      id: "staff-ops",
      title: "슈퍼바이저",
      superAdminOnly: true,
      items: [
        {
          id: "staff-management",
          label: "관리자 관리",
          iconKey: "adEmployeeIcon",
          children: [
            {
              id: "staff-register",
              label: "관리자 등록",
              path: "/admin/staff/register",
              iconKey: "adEmployeeIcon",
            },
            {
              id: "staff-list",
              label: "관리자 리스트",
              path: "/admin/staff/list",
              iconKey: "adUserListIcon",
            },
          ],
        },
        {
          id: "ops-management",
          label: "업무 관리",
          iconKey: "adTermIcon",
          children: [
            {
              id: "db-backup",
              label: "디비 백업하기",
              path: "/admin/ops/db-backup",
              iconKey: "adTermIcon",
            },
            {
              id: "admin-login-status",
              label: "관리자 로그인 현황",
              path: "/admin/ops/admin-login-status",
              iconKey: "adEmployeeIcon",
            },
            {
              id: "manager-login-status",
              label: "운영자 로그인 현황",
              path: "/admin/ops/manager-login-status",
              iconKey: "adMangerListIcon",
            },
          ],
        },
      ],
    },
    {
      id: "revenue-operator",
      title: "수익 · 운영자",
      items: [
        {
          id: "revenue-management",
          label: "수익 관리",
          iconKey: "adProfitIcon",
          children: [
            {
              id: "video-revenue",
              label: "동영상 광고 수익 현황",
              path: "/admin/revenue/video",
              iconKey: "adVideoProfitIcon",
            },
          ],
        },
        {
          id: "operator-management",
          label: "운영자 관리",
          iconKey: "adMangerListIcon",
          children: [
            {
              id: "operator-register",
              label: "운영자 등록",
              path: "/admin/operators/register",
              iconKey: "adMangerListIcon",
            },
            {
              id: "operator-list",
              label: "운영자 리스트",
              path: "/admin/operators/list",
              iconKey: "adUserListIcon",
            },
            {
              id: "operator-monitoring",
              label: "운영자 상태 모니터링",
              path: "/admin/monitoring",
              iconKey: "adManagerMonitoringIcon",
            },
          ],
        },
      ],
    },
    {
      id: "match-members",
      title: "경기 · 회원",
      items: [
        {
          id: "match-management",
          label: "경기 관리",
          path: "/admin/match-management",
          iconKey: "adMatchIcon",
        },
        {
          id: "members",
          label: "회원 관리",
          iconKey: "adMemberIcon",
          children: [
            {
              id: "member-list",
              label: "회원 리스트",
              path: "/admin/members/list",
              iconKey: "adUserListIcon",
            },
            {
              id: "donation-rankings",
              label: "사회공헌참여기록 관리",
              path: "/admin/members/donation-rankings",
              iconKey: "adDonationPointIcon",
            },
          ],
        },
      ],
    },
    {
      id: "notice-support",
      title: "공지 · 지원",
      items: [
        {
          id: "notice-management",
          label: "공지 사항",
          path: "/admin/notices",
          iconKey: "adNoticeIcon",
        },
        {
          id: "customer-support",
          label: "고객 지원 관리",
          iconKey: "adCustomerIcon",
          children: [
            {
              id: "support-center",
              label: "고객 지원 센터",
              path: "/admin/support",
              iconKey: "adCustomerIcon",
            },
            {
              id: "terms-management",
              label: "약관 관리",
              path: "/admin/terms",
              iconKey: "adTermIcon",
            },
          ],
        },
      ],
    },
  ];

  return sections.filter((section) => !section.superAdminOnly || isSuperAdmin);
}

/** 홈 대시보드용 — 홈 페이지 자체는 제외 */
export function flattenHomeLinks(sections: AdminMenuSection[]): { label: string; path: string }[] {
  const links: { label: string; path: string }[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.path && item.path !== "/admin/home") {
        links.push({ label: item.label, path: item.path });
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.path) {
            links.push({ label: child.label, path: child.path });
          }
        }
      }
    }
  }
  return links;
}

export function flattenSectionLinks(section: AdminMenuSection): { label: string; path: string }[] {
  const links: { label: string; path: string }[] = [];
  for (const item of section.items) {
    if (item.path && item.path !== "/admin/home") {
      links.push({ label: item.label, path: item.path });
    }
    if (item.children) {
      for (const child of item.children) {
        if (child.path) {
          links.push({ label: child.label, path: child.path });
        }
      }
    }
  }
  return links;
}
