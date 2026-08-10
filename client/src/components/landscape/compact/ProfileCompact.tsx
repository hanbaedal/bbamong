import ProfilePage from "@/pages/setting/profile";

/**
 * 게임 split 우측 — 회원정보 수정
 * 기존 ProfilePage를 감싸 컴팩트 CSS만 적용 (본인확인 후)
 */
export default function ProfileCompact() {
  return (
    <div className="profile-edit-compact" data-testid="profile-edit-compact">
      <ProfilePage />
    </div>
  );
}
