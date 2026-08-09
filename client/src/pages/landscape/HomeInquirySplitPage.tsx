import { useLocation, useRoute } from "wouter";
import LandscapeMasterDetailShell, { LandscapeEmptyPane } from "@/components/landscape/LandscapeMasterDetailShell";
import LandscapeCompactPane from "@/components/landscape/LandscapeCompactPane";
import InquiryCompactList from "@/components/landscape/compact/InquiryCompactList";
import InquiryCompactDetail from "@/components/landscape/compact/InquiryCompactDetail";
import InquiryCompactCreate from "@/components/landscape/compact/InquiryCompactCreate";

export default function HomeInquirySplitPage() {
  const [location, setLocation] = useLocation();
  const isNew = location === "/home/inquiry/new";
  const [, params] = useRoute("/home/inquiry/:id");
  const id = isNew ? null : params?.id;

  let right;
  if (isNew) {
    right = (
      <LandscapeCompactPane theme="inquiry">
        <InquiryCompactCreate />
      </LandscapeCompactPane>
    );
  } else if (id) {
    right = (
      <LandscapeCompactPane theme="inquiry">
        <InquiryCompactDetail />
      </LandscapeCompactPane>
    );
  } else {
    right = (
      <LandscapeEmptyPane message="문의를 선택하세요" hint="왼쪽에서 문의를 선택하거나 새로 작성하세요" />
    );
  }

  return (
    <LandscapeMasterDetailShell
      title="문의하기"
      theme="inquiry"
      backTo="/home"
      testId="home-inquiry-split"
      left={
        <InquiryCompactList
          selectedId={isNew ? "new" : id}
          onSelect={(inquiryId) => setLocation(`/home/inquiry/${inquiryId}`)}
          onCreate={() => setLocation("/home/inquiry/new")}
        />
      }
      right={right}
    />
  );
}
