import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandscapeMasterDetailShell, { LandscapeEmptyPane } from "@/components/landscape/LandscapeMasterDetailShell";
import LandscapeCompactPane from "@/components/landscape/LandscapeCompactPane";
import BoardCompactList from "@/components/landscape/compact/BoardCompactList";
import BoardCompactDetail from "@/components/landscape/compact/BoardCompactDetail";

export default function HomeBoardSplitPage() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/home/board/:id");
  const id = params?.id;

  const { data: posts = [] } = useQuery<Array<{ id: number }>>({
    queryKey: ["/api/posts"],
  });

  useEffect(() => {
    if (id || location !== "/home/board") return;
    if (posts.length > 0) {
      setLocation(`/home/board/${posts[0].id}`);
    }
  }, [id, location, posts, setLocation]);

  const right =
    id != null ? (
      <LandscapeCompactPane theme="board">
        <BoardCompactDetail />
      </LandscapeCompactPane>
    ) : (
      <LandscapeEmptyPane message="게시글을 선택하세요" hint="왼쪽 목록에서 항목을 눌러주세요" />
    );

  return (
    <LandscapeMasterDetailShell
      title="게시판"
      theme="board"
      backTo="/home"
      testId="home-board-split"
      left={
        <BoardCompactList
          selectedId={id}
          onSelect={(postId) => setLocation(`/home/board/${postId}`)}
        />
      }
      right={right}
    />
  );
}
