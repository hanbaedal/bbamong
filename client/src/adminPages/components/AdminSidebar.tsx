import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  onNavigate?: () => void;
  className?: string;
}

interface MenuItem {
  id: string;
  label: string;
  iconKey?: string;
  path?: string;
  children?: MenuItem[];
  superAdminOnly?: boolean;
}

function buildMenuItems(isSuperAdmin: boolean): MenuItem[] {
  const items: MenuItem[] = [
    {
      id: "home",
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
  ];

  if (isSuperAdmin) {
    items.push({
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
    });
    items.push({
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
    });
  }

  items.push(
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
          id: "operator-list",
          label: "운영자 리스트",
          path: "/admin/managers",
          iconKey: "adMangerListIcon",
        },
        {
          id: "operator-match",
          label: "운영자 경기 할당 관리",
          path: "/admin/match-assignment",
          iconKey: "adManagerMatchIcon",
        },
        {
          id: "operator-monitoring",
          label: "운영자 상태 모니터링",
          path: "/admin/monitoring",
          iconKey: "adManagerMonitoringIcon",
        },
      ],
    },
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
  );

  return items;
}

export default function AdminSidebar({ onNavigate, className }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const { assets } = useAdminAssets();

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  const menuItems = useMemo(() => buildMenuItems(isSuperAdmin), [isSuperAdmin]);

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const getIconSrc = (iconKey: string, active: boolean) => {
    const activeKey = `${iconKey}_active` as keyof typeof assets;
    if (active && assets[activeKey]) {
      return assets[activeKey];
    }
    return assets[iconKey as keyof typeof assets];
  };

  useEffect(() => {
    const openParent = menuItems.find(
      (item) =>
        item.path === location ||
        item.children?.some((child) => child.path === location),
    );

    if (!openParent?.children) {
      setExpandedItems([]);
      return;
    }

    setExpandedItems((prev) => {
      if (prev.includes(openParent.id)) return prev;
      return [...prev, openParent.id];
    });
  }, [location, menuItems]);

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleMenuClick = (childPath?: string) => {
    if (childPath) setLocation(childPath);
    onNavigate?.();
  };

  const handleTopLevelClick = (path?: string) => {
    if (path) setLocation(path);
    onNavigate?.();
  };

  const isActive = (path?: string) => path === location;
  const isParentActive = (item: MenuItem) =>
    isActive(item.path) || item.children?.some((child) => isActive(child.path));

  return (
    <div
      className={cn(
        "w-[180px] md:w-[220px] lg:w-[240px] h-full min-h-0 bg-[#FFF9FA] flex flex-col border-r border-[#E9E9E9] overflow-y-auto flex-shrink-0",
        className,
      )}
      data-testid="admin-sidebar"
    >
      <div className="p-2 md:p-4 flex flex-col gap-1">
        {menuItems.map((item) => (
          <div key={item.id}>
            {item.children ? (
              <div className="rounded transition-all duration-200">
                <button
                  onClick={() => toggleExpanded(item.id)}
                  className="w-full flex items-center justify-between px-2 md:px-[14px] py-2 md:py-[10px] rounded hover:bg-[#FDF2F3] transition"
                  data-testid={`menu-${item.id}`}
                >
                  <div className="flex items-center gap-1 md:gap-2 relative">
                    {item.iconKey && (
                      <img
                        src={getIconSrc(item.iconKey, isParentActive(item))}
                        alt=""
                        className="w-4 h-4 md:w-5 md:h-5 object-contain flex-shrink-0"
                      />
                    )}
                    <span
                      className={`text-xs md:text-base font-medium ${
                        isParentActive(item) ? "text-[#E11936]" : "text-[#4D4B4E]"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`transform transition-transform flex-shrink-0 ${
                      expandedItems.includes(item.id) ? "rotate-90" : ""
                    }`}
                  >
                    <path
                      d="M7.5 5L12.5 10L7.5 15"
                      stroke={isParentActive(item) ? "#E11936" : "#4D4B4E"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div
                  className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                  style={{
                    maxHeight: expandedItems.includes(item.id)
                      ? `${item.children.length * 60}px`
                      : "0px",
                  }}
                >
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => handleMenuClick(child.path)}
                      className={`w-full flex items-center gap-1 md:gap-2 pl-4 md:pl-8 py-2 md:py-[9px] rounded transition ${
                        isActive(child.path)
                          ? "bg-[rgba(225,25,54,0.15)] text-[#E11936]"
                          : "hover:bg-[#FDF2F3] text-[#4D4B4E]"
                      }`}
                      data-testid={`menu-${child.id}`}
                    >
                      <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center flex-shrink-0">
                        {child.iconKey && (
                          <img
                            src={getIconSrc(child.iconKey, !!isActive(child.path))}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                      <span className="text-xs md:text-sm font-medium text-left">
                        {child.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={() => item.path && handleTopLevelClick(item.path)}
                className={`w-full flex items-center gap-1 md:gap-2 px-2 md:px-[14px] py-2 md:py-[10px] rounded transition ${
                  isActive(item.path)
                    ? "bg-[rgba(225,25,54,0.15)] text-[#E11936]"
                    : "hover:bg-[#FDF2F3] text-[#4D4B4E]"
                }`}
                data-testid={`menu-${item.id}`}
              >
                <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center flex-shrink-0">
                  {item.iconKey && (
                    <img
                      src={getIconSrc(item.iconKey, !!isActive(item.path))}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <span className="text-xs md:text-base font-medium text-left">
                  {item.label}
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
