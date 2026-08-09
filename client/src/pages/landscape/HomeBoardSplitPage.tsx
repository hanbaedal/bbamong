import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import LandscapeMasterDetailShell, { LandscapeEmptyPane } from "@/components/landscape/LandscapeMasterDetailShell";
import LandscapeCompactPane from "@/components/landscape/LandscapeCompactPane";
import BoardCompactList from "@/components/landscape/compact/BoardCompactList";
import BoardCompactDetail from "@/components/landscape/compact/BoardCompactDetail";
import BoardCompactCreate from "@/components/landscape/compact/BoardCompactCreate";

export default function HomeBoardSplitPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = location === "/home/board/new";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") !== "true") return;
    toast({ description: "게시글을 등록했습니다" });
    window.history.replaceState({}, "", "/home/board");
  }, [toast]);
  const [, params] = useRoute("/home/board/:id");
  const id = isNew ? null : params?.id;

  let right;
  if (isNew) {
    right = (
      <LandscapeCompactPane theme="board">
        <BoardCompactCreate />
      </LandscapeCompactPane>
    );
  } else if (id) {
    right = (
      <LandscapeCompactPane theme="board">
        <BoardCompactDetail />
      </LandscapeCompactPane>
    );
  } else {
    right = (
      <LandscapeEmptyPane message="게시글을 선택하세요" hint="왼쪽 목록에서 글을 선택하세요" />
    );
  }

  return (
    <LandscapeMasterDetailShell
      title="게시판"
      theme="board"
      backTo="/home"
      testId="home-board-split"
      left={
        <BoardCompactList
          selectedId={isNew ? "new" : id}
          onSelect={(postId) => setLocation(`/home/board/${postId}`)}
          onCreate={() => setLocation("/home/board/new")}
        />
      }
      right={right}
    />
  );
}
