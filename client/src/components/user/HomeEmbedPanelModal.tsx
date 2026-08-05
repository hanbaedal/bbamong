import { useLocation } from "wouter";
import AuthPanelModal from "@/components/user/AuthPanelModal";
import EmbedPanelRoutes from "@/components/user/EmbedPanelRoutes";

interface HomeEmbedPanelModalProps {
  open: boolean;
  title: string;
  href: string | null;
  onClose: () => void;
  testId?: string;
}

/** 홈 왼쪽 패널 — 인라인 embed (공지·문의·게시판·게임 소개) */
export default function HomeEmbedPanelModal({
  open,
  title,
  href,
  onClose,
  testId = "home-embed-modal",
}: HomeEmbedPanelModalProps) {
  const [, setLocation] = useLocation();

  return (
    <AuthPanelModal anchor="left" open={open} title={title} onClose={onClose} testId={testId}>
      {href && open ? (
        <EmbedPanelRoutes
          key={href}
          initialPath={href}
          onClose={onClose}
          onAppNavigate={setLocation}
          className="user-home-embed-panel"
          testId={`${testId}-routes`}
        />
      ) : null}
    </AuthPanelModal>
  );
}
