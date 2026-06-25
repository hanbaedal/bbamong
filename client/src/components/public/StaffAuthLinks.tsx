const staffLinkClass =
  "text-[#888] text-[10px] font-medium whitespace-nowrap px-2 py-1 rounded border border-[#444] hover:border-[#666] hover:text-[#bbb] focus:outline-none";

export default function StaffAuthLinks() {
  return (
    <nav className="flex items-center gap-1.5" aria-label="운영진 로그인">
      <a
        href="/admin/login"
        data-testid="link-admin-login"
        className={staffLinkClass}
      >
        관리자
      </a>
      <a
        href="/manager/login"
        data-testid="link-manager-login"
        className={staffLinkClass}
      >
        운영자
      </a>
    </nav>
  );
}
