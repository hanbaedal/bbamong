import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, Check } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import SimpleInfoPopup from "@/components/customUi/simpleInfoPopup";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import { navigateEmbed } from "@/lib/gameEmbed";

interface VideoReward {
  id: number;
  order: number;
  points: number;
  title: string;
  videoUrl: string | null;
  isWatched: boolean;
  isLocked?: boolean;
}

/** 게임 split 우측 — 추가 참여(영상 리워드) 한 화면 컴팩트 */
export default function PointCompact() {
  const { user, refetchUser, isGuest } = useUser();
  const { assets } = useUserAssets();
  const [, setLocation] = useLocation();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: rewardsData, refetch: refetchRewards } = useQuery<{
    success: boolean;
    rewards: VideoReward[];
  }>({
    queryKey: ["/api/users/video-rewards"],
  });

  const rewards = rewardsData?.rewards || [];

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
  }, []);

  const formatPoints = (points: number) => points.toLocaleString("ko-KR");

  const handleAdClick = async (reward: VideoReward) => {
    if (checkGuest()) return;
    if (reward.isWatched) {
      setPopupMessage("이미 시청한 영상입니다.");
      setShowInfoPopup(true);
      return;
    }
    if (reward.isLocked || !reward.videoUrl) {
      setPopupMessage("아직 준비 중인 영상입니다.");
      setShowInfoPopup(true);
      return;
    }

    try {
      const response = await apiRequest("GET", `/api/users/ad-view/check/${reward.id}`);
      const data = await response.json();
      if (!data.canWatch) {
        setPopupMessage(data.message);
        setShowInfoPopup(true);
      } else {
        setPlayingVideoId(reward.id);
        setPlayingVideoUrl(reward.videoUrl);
        setIsVideoCompleted(false);
      }
    } catch {
      setPopupMessage("오류가 발생했습니다.\n잠시 후 다시 시도해주세요.");
      setShowInfoPopup(true);
    }
  };

  const handleVideoEnded = async () => {
    if (!playingVideoId) return;
    setIsVideoCompleted(true);
    try {
      const response = await apiRequest(
        "POST",
        `/api/users/video-rewards/${playingVideoId}/complete`,
      );
      const data = await response.json();
      if (data.success) {
        setPopupMessage(data.message);
        refetchRewards();
        refetchUser();
      } else {
        setPopupMessage(data.error || "포인트 지급에 실패했습니다.");
      }
    } catch {
      setPopupMessage("오류가 발생했습니다.");
    }
    setTimeout(() => {
      setPlayingVideoId(null);
      setPlayingVideoUrl(null);
      setShowInfoPopup(true);
    }, 500);
  };

  const handleCloseVideo = () => {
    if (!isVideoCompleted) {
      setPopupMessage("영상을 끝까지 시청해야\n참여기회를 받을 수 있습니다.");
      setShowInfoPopup(true);
    }
    setPlayingVideoId(null);
    setPlayingVideoUrl(null);
  };

  return (
    <div className="point-compact" data-testid="page-point-compact">
      <div className="point-compact__head">
        <p className="point-compact__label">내 보유 참여기회</p>
        <button
          type="button"
          onClick={() => navigateEmbed("/point/history", setLocation)}
          data-testid="button-view-points"
          className="point-compact__balance"
        >
          <span data-testid="text-my-points">{formatPoints(user?.points || 0)}</span>
          <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
        </button>
        <p className="point-compact__hint" data-testid="text-benefits-title">
          {user?.name || "회원"}님을 위한 참여기회 혜택
        </p>
      </div>

      <div className="point-compact__list">
        {rewards.map((reward) => (
          <div key={reward.id} className="point-compact__card" data-testid={`reward-card-${reward.id}`}>
            <div className="point-compact__card-top">
              <img src={assets.coinImg} className="w-7 h-7 object-contain relative z-[1]" alt="" />
              {reward.isWatched ? (
                <div
                  data-testid={`status-watched-${reward.id}`}
                  className="point-compact__status point-compact__status--done"
                >
                  <Check className="w-3 h-3" />
                  시청완료
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAdClick(reward)}
                  data-testid={`button-use-reward-${reward.id}`}
                  className={`point-compact__status ${
                    reward.isLocked ? "point-compact__status--locked" : "point-compact__status--action"
                  }`}
                  disabled={reward.isLocked}
                >
                  <img
                    src={assets.videoImg}
                    className={`w-3.5 h-3.5 object-contain ${reward.isLocked ? "opacity-50" : ""}`}
                    alt=""
                  />
                  {reward.isLocked ? "준비중" : "시청하기"}
                </button>
              )}
            </div>
            <p className="point-compact__pts">+ {reward.points}</p>
            <p className="point-compact__title">{reward.title}</p>
          </div>
        ))}
        {rewards.length === 0 ? (
          <p className="point-compact__empty">준비된 혜택이 없습니다.</p>
        ) : null}
      </div>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {showInfoPopup && (
        <SimpleInfoPopup message={popupMessage} onClose={() => setShowInfoPopup(false)} />
      )}

      {playingVideoId && playingVideoUrl ? (
        <div className="point-compact__video-overlay">
          <div className="point-compact__video-bar">
            <h2 className="point-compact__video-heading">영상 시청</h2>
            <button
              type="button"
              onClick={handleCloseVideo}
              data-testid="button-close-video"
              className="text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="point-compact__video-stage">
            <video
              ref={videoRef}
              src={playingVideoUrl}
              className="max-w-full max-h-full"
              controls
              autoPlay
              playsInline
              controlsList="nofullscreen nodownload noplaybackrate noremoteplayback"
              disablePictureInPicture
              onEnded={handleVideoEnded}
              onLoadedMetadata={(e) => {
                const video = e.currentTarget as HTMLVideoElement & {
                  _maxWatchedTime?: number;
                  _lastTime?: number;
                };
                video._maxWatchedTime = 0;
                video._lastTime = 0;
              }}
              onSeeking={(e) => {
                const video = e.currentTarget as HTMLVideoElement & {
                  _maxWatchedTime?: number;
                  _lastTime?: number;
                };
                const maxWatched = video._maxWatchedTime || 0;
                if (Math.abs(video.currentTime - (video._lastTime || 0)) > 0.5) {
                  video.currentTime = maxWatched;
                }
              }}
              onTimeUpdate={(e) => {
                const video = e.currentTarget as HTMLVideoElement & {
                  _maxWatchedTime?: number;
                  _lastTime?: number;
                };
                const currentTime = video.currentTime;
                const maxWatched = video._maxWatchedTime || 0;
                if (currentTime > maxWatched) video._maxWatchedTime = currentTime;
                video._lastTime = currentTime;
              }}
              data-testid="video-player"
            />
          </div>
          <p className="point-compact__video-note">영상을 끝까지 시청하면 참여기회가 지급됩니다</p>
        </div>
      ) : null}
    </div>
  );
}
