import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import AuthPanelModal from "@/components/user/AuthPanelModal";
import {
  buildGameEmbedUrl,
  GAME_EMBED_MESSAGE,
  isGameEmbedMessage,
  isHomeEmbedNavigateMessage,
  pushEmbedAccessTokenToFrame,
  withEmbedQuery,
} from "@/lib/gameEmbed";

interface HomeEmbedPanelModalProps {
  open: boolean;
  title: string;
  href: string | null;
  onClose: () => void;
  testId?: string;
}

function isNestedEmbedPath(rootHref: string, currentPath: string): boolean {
  const root = rootHref.split("?")[0];
  if (currentPath === root) return false;
  if (currentPath.startsWith(`${root}/`)) return true;
  if (root === "/customer-center" && currentPath.startsWith("/inquiry")) return true;
  return false;
}

/** 홈 왼쪽 패널 — iframe embed (공지·문의·게시판·게임 소개) */
export default function HomeEmbedPanelModal({
  open,
  title,
  href,
  onClose,
  testId = "home-embed-modal",
}: HomeEmbedPanelModalProps) {
  const [, setLocation] = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const rootHrefRef = useRef<string | null>(null);

  useEffect(() => {
    if (href) rootHrefRef.current = href;
  }, [href]);

  useEffect(() => {
    if (!open || !href) return;
    const frame = iframeRef.current;
    if (!frame) return;

    const onLoad = () => {
      void pushEmbedAccessTokenToFrame(frame);
    };

    frame.addEventListener("load", onLoad);
    return () => frame.removeEventListener("load", onLoad);
  }, [open, href]);

  useEffect(() => {
    if (!open) return;

    const onMessage = (event: MessageEvent) => {
      if (isHomeEmbedNavigateMessage(event.data)) {
        onClose();
        setLocation(event.data.path);
        return;
      }

      if (!isGameEmbedMessage(event.data)) return;

      if (event.data.type === GAME_EMBED_MESSAGE.CLOSE) {
        onClose();
        return;
      }

      if (event.data.type === GAME_EMBED_MESSAGE.BACK) {
        const rootHref = rootHrefRef.current;
        const frame = iframeRef.current?.contentWindow;
        if (rootHref && frame) {
          try {
            const currentPath = frame.location.pathname;
            if (isNestedEmbedPath(rootHref, currentPath)) {
              frame.location.assign(withEmbedQuery(rootHref));
              return;
            }
          } catch {
            // cross-origin fallback
          }
        }
        onClose();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, onClose, setLocation]);

  return (
    <AuthPanelModal anchor="left" open={open} title={title} onClose={onClose} testId={testId}>
      {href ? (
        <iframe
          ref={iframeRef}
          key={href}
          src={buildGameEmbedUrl(href)}
          title={title}
          className="user-home-embed-frame"
          data-testid={`${testId}-frame`}
        />
      ) : null}
    </AuthPanelModal>
  );
}
