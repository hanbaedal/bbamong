import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { getFullUrl, getOrRefreshAccessToken } from "@/lib/queryClient";
import { setCurrentFriendRoom } from "@/lib/friendRoomSession";
import { USER_LOGIN_PATH } from "@/lib/loginSession";
import {
  FRIEND_ROOM_AGE_OPTIONS,
  FRIEND_ROOM_CAPACITY_DEFAULT,
  FRIEND_ROOM_CAPACITY_MAX,
  FRIEND_ROOM_CAPACITY_MIN,
  FRIEND_ROOM_DISCLAIMER_BODY,
  FRIEND_ROOM_DISCLAIMER_CHECK_LABEL,
  FRIEND_ROOM_DISCLAIMER_TITLE,
  FRIEND_ROOM_REGION_OPTIONS,
  FRIEND_ROOM_TEAM_OPTIONS,
} from "@shared/friendRooms";
import "@/styles/friend-rooms.css";

type RoomListItem = {
  id: string;
  name: string;
  description: string;
  supportTeam: string;
  memberCount: number;
  capacity: number;
  isHost: boolean;
  role: string;
};

type RoomDetail = {
  id: string;
  name: string;
  description: string;
  supportTeam: string;
  ageGroup: string;
  region: string;
  capacity: number;
  hostUserId: string;
  inviteToken: string;
  invitePath: string;
  memberCount: number;
  isHost: boolean;
  members: { userId: string; role: string; name: string }[];
};

type RankRow = { userId: string; name: string; hits: number; bets: number; net: number };

async function roomFetch(path: string, init?: RequestInit) {
  const token = await getOrRefreshAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  const res = await fetch(getFullUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "요청에 실패했습니다.");
  return data;
}

function shareInvite(room: { name: string; description: string; invitePath: string }) {
  const url = `${window.location.origin}${room.invitePath}`;
  const text = `[빠몽이] ${room.name}${room.description ? ` — ${room.description}` : ""}\n${url}`;
  if (navigator.share) {
    void navigator.share({ title: room.name, text, url }).catch(() => {
      void navigator.clipboard?.writeText(text);
      alert("초대 문구를 클립보드에 복사했습니다. 카카오톡에 붙여넣어 공유하세요.");
    });
    return;
  }
  void navigator.clipboard?.writeText(text);
  alert("초대 문구를 클립보드에 복사했습니다. 카카오톡에 붙여넣어 공유하세요.");
}

export default function FriendRoomsPage() {
  const [, setLocation] = useLocation();
  const { user, isGuest, isUserLoaded } = useUser();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "detail">("list");
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [ranking, setRanking] = useState<RankRow[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [supportTeam, setSupportTeam] = useState<string>(FRIEND_ROOM_TEAM_OPTIONS[0]);
  const [ageGroup, setAgeGroup] = useState<string>(FRIEND_ROOM_AGE_OPTIONS[0]);
  const [region, setRegion] = useState<string>(FRIEND_ROOM_REGION_OPTIONS[0]);
  const [capacity, setCapacity] = useState(FRIEND_ROOM_CAPACITY_DEFAULT);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadMine = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roomFetch("/api/rooms/mine");
      setRooms(data.rooms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isUserLoaded) return;
    if (!user) {
      setLocation(`${USER_LOGIN_PATH}?return=/home/rooms`);
      return;
    }
    if (isGuest) {
      setError("친구·동호회 방은 정회원만 이용할 수 있습니다.");
      setLoading(false);
      return;
    }
    void (async () => {
      await loadMine();
      const openId = new URLSearchParams(window.location.search).get("open");
      if (openId) {
        await openDetail(openId);
        window.history.replaceState({}, "", "/home/rooms");
      }
    })();
  }, [isUserLoaded, user, isGuest, setLocation]);

  const openDetail = async (roomId: string) => {
    setError(null);
    try {
      const data = await roomFetch(`/api/rooms/${roomId}`);
      setDetail(data.room);
      setCurrentFriendRoom({ id: data.room.id, name: data.room.name });
      const rank = await roomFetch(`/api/rooms/${roomId}/ranking`);
      setRanking(rank.ranking ?? []);
      setMode("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 조회 실패");
    }
  };

  const createRoom = async () => {
    if (!disclaimerAccepted) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await roomFetch("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          supportTeam,
          ageGroup,
          region,
          capacity,
          disclaimerAccepted: true,
        }),
      });
      setCurrentFriendRoom({ id: data.room.id, name: data.room.name });
      setDetail(data.room);
      setMode("detail");
      setRanking([]);
      await loadMine();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const closeRoom = async () => {
    if (!detail?.isHost) return;
    if (
      !confirm(
        "방을 종료하면 멤버·초대·방 순위가 삭제되며 복구되지 않습니다. 종료할까요?",
      )
    ) {
      return;
    }
    try {
      await roomFetch(`/api/rooms/${detail.id}/close`, { method: "POST", body: "{}" });
      setCurrentFriendRoom(null);
      setDetail(null);
      setMode("list");
      await loadMine();
    } catch (e) {
      setError(e instanceof Error ? e.message : "종료 실패");
    }
  };

  const leaveRoom = async () => {
    if (!detail || detail.isHost) return;
    try {
      await roomFetch(`/api/rooms/${detail.id}/leave`, { method: "POST", body: "{}" });
      setCurrentFriendRoom(null);
      setDetail(null);
      setMode("list");
      await loadMine();
    } catch (e) {
      setError(e instanceof Error ? e.message : "나가기 실패");
    }
  };

  const kick = async (userId: string) => {
    if (!detail?.isHost) return;
    try {
      await roomFetch(`/api/rooms/${detail.id}/kick`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await openDetail(detail.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내기 실패");
    }
  };

  const title = useMemo(() => {
    if (mode === "create") return "방 만들기";
    if (mode === "detail") return detail?.name ?? "방";
    return "친구·동호회 방";
  }, [mode, detail]);

  return (
    <div className="friend-rooms-page" data-testid="friend-rooms-page">
      <header className="friend-rooms-header">
        <button
          type="button"
          className="friend-rooms-back"
          aria-label="뒤로"
          onClick={() => {
            if (mode === "list") setLocation("/home");
            else {
              setMode("list");
              setDetail(null);
              void loadMine();
            }
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1>{title}</h1>
      </header>

      {error ? <p className="friend-rooms-error">{error}</p> : null}

      {isGuest ? (
        <div className="friend-rooms-panel">
          <p>게스트는 방을 만들거나 입장할 수 없습니다. 회원가입·로그인 후 이용해주세요.</p>
          <button type="button" className="friend-rooms-btn" onClick={() => setLocation(USER_LOGIN_PATH)}>
            로그인
          </button>
        </div>
      ) : null}

      {!isGuest && mode === "list" ? (
        <div className="friend-rooms-panel">
          <p className="friend-rooms-note">
            초대받은 정회원만 입장할 수 있습니다. 관리자는 방 운영에 관여하지 않으며, 방장 종료 시 방
            기록은 삭제됩니다.
          </p>
          <button
            type="button"
            className="friend-rooms-btn friend-rooms-btn--primary"
            onClick={() => {
              setDisclaimerAccepted(false);
              setMode("create");
            }}
          >
            방 만들기
          </button>
          {loading ? <p className="friend-rooms-muted">불러오는 중…</p> : null}
          <ul className="friend-rooms-list">
            {rooms.map((r) => (
              <li key={r.id}>
                <button type="button" className="friend-rooms-list-item" onClick={() => void openDetail(r.id)}>
                  <span className="friend-rooms-list-name">{r.name}</span>
                  <span className="friend-rooms-list-meta">
                    {r.isHost ? "방장" : "멤버"} · {r.memberCount}/{r.capacity} · {r.supportTeam}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!loading && rooms.length === 0 ? (
            <p className="friend-rooms-muted">참여 중인 방이 없습니다. 방을 만들거나 초대를 받아보세요.</p>
          ) : null}
        </div>
      ) : null}

      {!isGuest && mode === "create" ? (
        <div className="friend-rooms-panel friend-rooms-form">
          <label>
            방 이름
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <label>
            한 줄 소개
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </label>
          <label>
            응원 팀
            <select value={supportTeam} onChange={(e) => setSupportTeam(e.target.value)}>
              {FRIEND_ROOM_TEAM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            나이대
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              {FRIEND_ROOM_AGE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            지역
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {FRIEND_ROOM_REGION_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            정원 ({FRIEND_ROOM_CAPACITY_MIN}~{FRIEND_ROOM_CAPACITY_MAX})
            <input
              type="number"
              min={FRIEND_ROOM_CAPACITY_MIN}
              max={FRIEND_ROOM_CAPACITY_MAX}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>

          <div className="friend-rooms-disclaimer">
            <h2>{FRIEND_ROOM_DISCLAIMER_TITLE}</h2>
            <pre>{FRIEND_ROOM_DISCLAIMER_BODY}</pre>
            <label className="friend-rooms-check">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
              />
              {FRIEND_ROOM_DISCLAIMER_CHECK_LABEL}
            </label>
          </div>

          <button
            type="button"
            className="friend-rooms-btn friend-rooms-btn--primary"
            disabled={!disclaimerAccepted || submitting || name.trim().length < 2}
            onClick={() => void createRoom()}
          >
            {submitting ? "만드는 중…" : "방 만들기"}
          </button>
        </div>
      ) : null}

      {!isGuest && mode === "detail" && detail ? (
        <div className="friend-rooms-panel">
          <p className="friend-rooms-desc">{detail.description || "소개 없음"}</p>
          <p className="friend-rooms-list-meta">
            {detail.supportTeam} · {detail.ageGroup} · {detail.region} · {detail.memberCount}/
            {detail.capacity}
          </p>
          <div className="friend-rooms-actions">
            <button
              type="button"
              className="friend-rooms-btn friend-rooms-btn--primary"
              onClick={() => {
                setCurrentFriendRoom({ id: detail.id, name: detail.name });
                setLocation("/prediction");
              }}
            >
              예측 참여
            </button>
            <button
              type="button"
              className="friend-rooms-btn"
              onClick={() => shareInvite(detail)}
            >
              카카오/링크로 초대
            </button>
            {detail.isHost ? (
              <button type="button" className="friend-rooms-btn friend-rooms-btn--danger" onClick={() => void closeRoom()}>
                방 종료 (삭제)
              </button>
            ) : (
              <button type="button" className="friend-rooms-btn" onClick={() => void leaveRoom()}>
                나가기
              </button>
            )}
          </div>

          <h3 className="friend-rooms-sub">멤버</h3>
          <ul className="friend-rooms-members">
            {detail.members.map((m) => (
              <li key={m.userId}>
                <span>
                  {m.name} {m.role === "host" ? "(방장)" : ""}
                </span>
                {detail.isHost && m.role !== "host" ? (
                  <button type="button" onClick={() => void kick(m.userId)}>
                    내보내기
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          <h3 className="friend-rooms-sub">오늘 방 순위 (참고용)</h3>
          <ol className="friend-rooms-rank">
            {ranking.map((r, i) => (
              <li key={r.userId}>
                {i + 1}. {r.name} — 적중 {r.hits}/{r.bets} · 순이익 {r.net}P
              </li>
            ))}
          </ol>
          {ranking.length === 0 ? <p className="friend-rooms-muted">오늘 정산된 예측이 없습니다.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function FriendRoomJoinPage() {
  const params = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, isGuest, isUserLoaded } = useUser();
  const [message, setMessage] = useState("초대 확인 중…");
  const [preview, setPreview] = useState<{
    name: string;
    description: string;
    roomId: string;
    alreadyMember: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isUserLoaded) return;
    if (!user) {
      setLocation(`${USER_LOGIN_PATH}?return=/rooms/join/${params.token}`);
      return;
    }
    if (isGuest) {
      setMessage("게스트는 방에 입장할 수 없습니다. 정회원으로 로그인해 주세요.");
      return;
    }
    void (async () => {
      try {
        const p = await roomFetch(`/api/rooms/join/${params.token}/preview`);
        setPreview(p);
        setMessage("");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "초대 오류");
      }
    })();
  }, [isUserLoaded, user, isGuest, params.token, setLocation]);

  const join = async () => {
    try {
      const data = await roomFetch(`/api/rooms/join/${params.token}`, {
        method: "POST",
        body: "{}",
      });
      setCurrentFriendRoom({ id: data.room.id, name: data.room.name });
      setLocation(`/home/rooms?open=${encodeURIComponent(data.room.id)}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "입장 실패");
    }
  };

  return (
    <div className="friend-rooms-page" data-testid="friend-room-join-page">
      <header className="friend-rooms-header">
        <button type="button" className="friend-rooms-back" onClick={() => setLocation("/home")}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1>방 초대</h1>
      </header>
      <div className="friend-rooms-panel">
        {message ? <p>{message}</p> : null}
        {preview ? (
          <>
            <h2>{preview.name}</h2>
            <p>{preview.description || "소개 없음"}</p>
            <p className="friend-rooms-note">
              입장 시 친목방 면책·이용 조건에 동의한 것으로 봅니다. 관리자는 방 운영에 관여하지 않습니다.
            </p>
            <button type="button" className="friend-rooms-btn friend-rooms-btn--primary" onClick={() => void join()}>
              {preview.alreadyMember ? "방으로 이동" : "입장하기"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
