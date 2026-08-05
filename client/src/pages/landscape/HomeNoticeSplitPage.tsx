import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandscapeMasterDetailShell, { LandscapeEmptyPane } from "@/components/landscape/LandscapeMasterDetailShell";
import LandscapeCompactPane from "@/components/landscape/LandscapeCompactPane";
import NoticeCompactList from "@/components/landscape/compact/NoticeCompactList";
import NoticeCompactDetail from "@/components/landscape/compact/NoticeCompactDetail";

export default function HomeNoticeSplitPage() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/home/notice/:id");
  const id = params?.id;

  const { data: notices = [] } = useQuery<Array<{ id: number }>>({
    queryKey: ["/api/notices"],
  });

  useEffect(() => {
    if (id || location !== "/home/notice") return;
    if (notices.length > 0) {
      setLocation(`/home/notice/${notices[0].id}`);
    }
  }, [id, location, notices, setLocation]);

  const right =
    id != null ? (
      <LandscapeCompactPane theme="notice">
        <NoticeCompactDetail />
      </LandscapeCompactPane>
    ) : (
      <LandscapeEmptyPane message="공지를 선택하세요" hint="왼쪽 목록에서 항목을 눌러주세요" />
    );

  return (
    <LandscapeMasterDetailShell
      title="공지사항"
      theme="notice"
      backTo="/home"
      testId="home-notice-split"
      left={
        <NoticeCompactList
          selectedId={id}
          onSelect={(noticeId) => setLocation(`/home/notice/${noticeId}`)}
        />
      }
      right={right}
    />
  );
}
