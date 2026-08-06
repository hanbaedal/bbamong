import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";
import {
  buildAdminMenuSections,
  type AdminMenuItem,
} from "../adminMenuConfig";

interface AdminSidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export default function AdminSidebar({ onNavigate, className }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const { assets } = useAdminAssets();

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  const menuSections = useMemo(() => buildAdminMenuSections(isSuperAdmin), [isSuperAdmin]);
  const menuItems = useMemo(
    () => menuSections.flatMap((section) => section.items),
    [menuSections],
  );

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const getIconSrc = (iconKey: string, active: boolean) => {
    const activeKey = `${iconKey}_active` as keyof typeof assets;
    if (active && assets[activeKey]) {
      return assets[activeKey];
    }
    return assets[iconKey as keyof typeof assets];
  };

  useEffect(() => {
    const openParents = menuItems.filter(
      (item) =>
        item.path === location ||
        item.children?.some((child) => child.path === location),
    );

    if (openParents.length === 0) {
      return;
    }

    setExpandedItems((prev) => {
      const next = new Set(prev);
      for (const parent of openParents) {
        if (parent.children) next.add(parent.id);
      }
      return [...next];
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

  const isActive = (path?: string) => {
    if (!path) return false;
    if (location === path) return true;
    if (path === "/admin/match-monitoring" && location.startsWith("/admin/match-monitoring/")) {
      return true;
    }
    return false;
  };
  const isParentActive = (item: AdminMenuItem) =>
    isActive(item.path) || !!item.children?.some((child) => isActive(child.path));

  const renderMenuItem = (item: AdminMenuItem) => {
    if (item.children) {
      return (
        <div key={item.id} className="rounded transition-all duration-200">
          <button
            onClick={() => toggleExpanded(item.id)}
            className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[#FDF2F3] transition"
            data-testid={`menu-${item.id}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {item.iconKey && (
                <img
                  src={getIconSrc(item.iconKey, isParentActive(item))}
                  alt=""
                  className="w-3.5 h-3.5 object-contain flex-shrink-0"
                />
              )}
              <span
                className={`text-[11px] font-semibold truncate leading-tight ${
                  isParentActive(item) ? "text-[#E11936]" : "text-[#4D4B4E]"
                }`}
              >
                {item.label}
              </span>
            </div>

            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transform transition-transform flex-shrink-0 ml-0.5 ${
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
            className={cn(
              "overflow-hidden transition-[max-height] duration-200 ease-in-out",
              expandedItems.includes(item.id) ? "max-h-80" : "max-h-0",
            )}
          >
            <div className="mt-0 mb-0.5 border-l border-[#E8D4D8] ml-3.5">
              {item.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => handleMenuClick(child.path)}
                  className={`w-full flex items-center pl-2.5 pr-1.5 py-0.5 rounded-r transition text-left ${
                    isActive(child.path)
                      ? "bg-[rgba(225,25,54,0.12)] text-[#E11936] font-semibold"
                      : "hover:bg-[#FDF2F3] text-[#5C5A5E]"
                  }`}
                  data-testid={`menu-${child.id}`}
                >
                  <span className="text-[10px] leading-tight">{child.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => item.path && handleTopLevelClick(item.path)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded transition ${
          isActive(item.path)
            ? "bg-[rgba(225,25,54,0.12)] text-[#E11936]"
            : "hover:bg-[#FDF2F3] text-[#4D4B4E]"
        }`}
        data-testid={`menu-${item.id}`}
      >
        <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
          {item.iconKey && (
            <img
              src={getIconSrc(item.iconKey, !!isActive(item.path))}
              alt=""
              className="w-full h-full object-contain"
            />
          )}
        </div>
        <span className="text-[11px] font-semibold text-left leading-tight">{item.label}</span>
      </button>
    );
  };

  return (
    <div
      className={cn(
        "w-[180px] md:w-[220px] lg:w-[240px] h-full min-h-0 bg-[#FFF9FA] flex flex-col border-r border-[#E0E0E0] overflow-y-auto flex-shrink-0",
        className,
      )}
      data-testid="admin-sidebar"
    >
      <div className="p-1.5 md:p-2 flex flex-col gap-0">
        {menuSections.map((section, sectionIndex) => (
          <div
            key={section.id}
            className={cn(sectionIndex > 0 && "mt-3 pt-2 border-t border-[#EDE4E6]")}
          >
            {section.title && (
              <p className="px-2 pb-1 text-[10px] font-semibold tracking-wide text-[#9CA3AF] leading-none">
                {section.title}
              </p>
            )}
            <div className="flex flex-col gap-0">
              {section.items.map((item) => renderMenuItem(item))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
