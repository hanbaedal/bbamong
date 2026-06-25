const adminLoginClass =
  "text-[#CDFF00] text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded border border-[#CDFF00]/40 hover:bg-[#CDFF00]/10 focus:outline-none";

/** 공개 홈 소개(/) — 관리자 로그인만 */
export default function StaffAuthLinks() {
  return (
    <a
      href="/admin/login"
      data-testid="link-admin-login"
      className={adminLoginClass}
    >
      로그인
    </a>
  );
}
