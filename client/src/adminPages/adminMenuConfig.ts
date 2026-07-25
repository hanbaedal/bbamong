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
          id: "app-home-settings",
          label: "앱 홈 설정",
          path: "/admin/app-home-settings",
          iconKey: "adNoticeIcon",
        },
      ],
    },
    {
      id: "mall",
      title: "쇼핑몰 · 판매",
      items: [
        {
          id: "mall-group",
          label: "쇼핑몰",
          iconKey: "adMatchCharaterIcon",
          children: [
            {
              id: "mall-preview",
              label: "쇼핑몰 확인 (작업용)",
              path: "/admin/mall-preview",
            },
            {
              id: "mall-management",
              label: "쇼핑몰 관리",
              path: "/admin/mall-management",
            },
          ],
        },
        {
          id: "mall-sales-group",
          label: "판매관리",
          iconKey: "adProfitIcon",
          children: [
            {
              id: "mall-orders",
              label: "주문 관리",
              path: "/admin/mall-orders",
            },
            {
              id: "mall-sales",
              label: "판매 관리",
              path: "/admin/mall-sales",
            },
            {
              id: "mall-inventory",
              label: "재고 관리",
              path: "/admin/mall-inventory",
            },
            {
              id: "mall-purchase",
              label: "구매 관리",
              path: "/admin/mall-purchase",
            },
          ],
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
          label: "경기 관리 (달력)",
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

const EXCLUDED_SITEMAP_PATHS = new Set(["/admin/home", "/admin/monitoring"]);

function stripExcludedSitemapItems(items: AdminMenuItem[]): AdminMenuItem[] {
  return items
    .map((item) => {
      if (item.path && EXCLUDED_SITEMAP_PATHS.has(item.path)) return null;
      if (item.children) {
        const children = item.children.filter(
          (child) => !child.path || !EXCLUDED_SITEMAP_PATHS.has(child.path),
        );
        if (children.length === 0 && !item.path) return null;
        return { ...item, children };
      }
      return item;
    })
    .filter((item): item is AdminMenuItem => item !== null);
}

export interface AdminSitemapColumn {
  id: string;
  label: string;
  items: AdminMenuItem[];
}

/** 사이트맵 5열 — 모니터링·사이트맵 페이지 제외 */
export function buildAdminSitemapColumns(isSuperAdmin: boolean): AdminSitemapColumn[] {
  const sections = buildAdminMenuSections(isSuperAdmin);
  const sectionById = Object.fromEntries(sections.map((section) => [section.id, section]));

  const basicItems = stripExcludedSitemapItems(
    (sectionById.main?.items ?? []).filter((item) => item.id !== "admin-home"),
  );
  const supervisorItems = isSuperAdmin ? (sectionById["staff-ops"]?.items ?? []) : [];

  const mallItems = sectionById.mall?.items ?? [];
  const mallShopGroup = mallItems.find((item) => item.id === "mall-group");
  const mallSalesGroup = mallItems.find((item) => item.id === "mall-sales-group");

  return [
    {
      id: "basic",
      label: "기본",
      items: stripExcludedSitemapItems([...basicItems, ...supervisorItems]),
    },
    {
      id: "mall-shop",
      label: "쇼핑몰",
      items: stripExcludedSitemapItems(mallShopGroup?.children ?? []),
    },
    {
      id: "mall-sales",
      label: "판매관리",
      items: stripExcludedSitemapItems(mallSalesGroup?.children ?? []),
    },
    {
      id: "match-members",
      label: "경기·회원",
      items: stripExcludedSitemapItems(sectionById["match-members"]?.items ?? []),
    },
    {
      id: "ops-support",
      label: "운영·지원",
      items: stripExcludedSitemapItems([
        ...(sectionById["revenue-operator"]?.items ?? []),
        ...(sectionById["notice-support"]?.items ?? []),
      ]),
    },
  ].filter((column) => column.items.length > 0);
}

/** 사이트맵용 — 사이트맵 페이지 자체는 제외 */
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
