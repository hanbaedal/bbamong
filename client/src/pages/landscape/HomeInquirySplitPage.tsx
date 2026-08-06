import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandscapeMasterDetailShell, { LandscapeEmptyPane } from "@/components/landscape/LandscapeMasterDetailShell";
import LandscapeCompactPane from "@/components/landscape/LandscapeCompactPane";
import InquiryCompactList from "@/components/landscape/compact/InquiryCompactList";
import InquiryCompactDetail from "@/components/landscape/compact/InquiryCompactDetail";

export default function HomeInquirySplitPage() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/home/inquiry/:id");
  const id = params?.id;

  const { data: inquiries = [] } = useQuery<Array<{ id: number }>>({
    queryKey: ["/api/inquiries"],
  });

  useEffect(() => {
    if (id || location !== "/home/inquiry") return;
    if (inquiries.length > 0) {
      setLocation(`/home/inquiry/${inquiries[0].id}`);
    }
  }, [id, location, inquiries, setLocation]);

  const right =
    id != null ? (
      <LandscapeCompactPane theme="inquiry">
        <InquiryCompactDetail />
      </LandscapeCompactPane>
    ) : (
      <LandscapeEmptyPane message="문의를 선택하세요" hint="왼쪽 목록에서 항목을 눌러주세요" />
    );

  return (
    <LandscapeMasterDetailShell
      title="문의하기"
      theme="inquiry"
      backTo="/home"
      testId="home-inquiry-split"
      left={
        <InquiryCompactList
          selectedId={id}
          onSelect={(inquiryId) => setLocation(`/home/inquiry/${inquiryId}`)}
        />
      }
      right={right}
    />
  );
}
