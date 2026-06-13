import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, Check, ChevronLeft } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import PageHeader from "@/components/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import SimpleInfoPopup from "@/components/customUi/simpleInfoPopup";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

interface VideoReward {
  id: number;
  order: number;
  points: number;
  title: string;
  videoUrl: string | null;
  isWatched: boolean;
  isLocked?: boolean;
}

export default function PointPage() {
  const { user, refetchUser, isGuest } = useUser();
  const { assets } = useUserAssets();
  const [, setLocation] = useLocation();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const [showTooltip, setShowTooltip] = useState(() => {
    return sessionStorage.getItem("pointTooltipDismissed") !== "true";
  });
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

  const formatPoints = (points: number) => {
    return points.toLocaleString("ko-KR");
  };

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
      const response = await apiRequest(
        "GET",
        `/api/users/ad-view/check/${reward.id}`,
      );
      const data = await response.json();

      if (!data.canWatch) {
        setPopupMessage(data.message);
        setShowInfoPopup(true);
      } else {
        setPlayingVideoId(reward.id);
        setPlayingVideoUrl(reward.videoUrl);
        setIsVideoCompleted(false);
      }
    } catch (error) {
      console.error("광고 시청 확인 오류:", error);
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
    } catch (error) {
      console.error("영상 완료 처리 오류:", error);
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
    <div className="h-app-screen bg-[#111111]">
      <PageHeader
        leftAction={
          <button
            data-testid="button-back"
            onClick={() => setLocation("/home")}
            className="p-1 focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 px-5 pt-[10px] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">추가참여</h1>

        <div className="mb-4">
          <p className="text-[#6B6B6B] text-sm mb-2">내 보유 참여기회</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/point/history")}
              data-testid="button-view-points"
              className="text-white text-4xl font-bold hover:text-[#CDFF00] transition-colors flex items-center gap-2"
            >
              {formatPoints(user?.points || 0)}
              <ChevronRight className="w-6 h-6" />
            </button>
            {showTooltip && (
              <button
                onClick={() => {
                  sessionStorage.setItem("pointTooltipDismissed", "true");
                  setShowTooltip(false);
                }}
                data-testid="button-point-history"
                className="relative bg-[#CDFF00] text-black text-[10px] font-medium px-2 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0"
                style={{ userSelect: "none" }}
              >
                참여기회 내역을 확인하세요
                <X className="w-3 h-3" />
                <span
                  style={{
                    content: '""',
                    position: "absolute",
                    top: "50%",
                    left: "-6px",
                    transform: "translateY(-50%)",
                    width: 0,
                    height: 0,
                    borderTop: "6px solid transparent",
                    borderBottom: "6px solid transparent",
                    borderRight: "6px solid #CDFF00",
                  }}
                />
              </button>
            )}
          </div>
        </div>
        <h3
          className="text-[#D5D5D5] text-sm mb-4"
          data-testid="text-benefits-title"
        >
          {user?.name || "회원"}님을 위한 참여기회 혜택
        </h3>

        <div className="space-y-3 pb-4">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="relative w-full bg-[#1C1F20] rounded-xl flex flex-col justify-between overflow-hidden px-4 py-3"
            >
              <div
                className="absolute"
                style={{
                  width: 223,
                  height: 223,
                  left: -134,
                  top: -183,
                  background: "rgba(225, 25, 54, 0.5)",
                  filter: "blur(50px)",
                  borderRadius: "50%",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              ></div>

              <div className="flex justify-between items-center relative z-10">
                <img
                  src={assets.coinImg}
                  className="w-8 h-8 object-contain"
                  alt="coin"
                />
                {reward.isWatched ? (
                  <div
                    data-testid={`status-watched-${reward.id}`}
                    className="flex items-center justify-center gap-1 min-w-[100px] h-[28px] px-3 rounded-[50px] bg-[#2D2D2D] text-[#888888] text-[12px] font-medium tracking-[-0.025em] leading-[140%] font-Pretendard select-none whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    시청완료
                  </div>
                ) : (
                  <button
                    onClick={() => handleAdClick(reward)}
                    data-testid={`button-use-reward-${reward.id}`}
                    className={`flex items-center justify-center gap-1 min-w-[100px] h-[28px] px-3 rounded-[50px] text-[12px] font-medium tracking-[-0.025em] leading-[140%] font-Pretendard select-none whitespace-nowrap ${
                      reward.isLocked
                        ? "bg-[#2D2D2D] text-[#666666] cursor-not-allowed"
                        : "bg-[#111111] text-[#E9E9E9] hover:bg-[#2a2a2a]"
                    }`}
                    style={{ userSelect: "none" }}
                    disabled={reward.isLocked}
                  >
                    <img
                      src={assets.videoImg}
                      className={`w-[18px] h-[18px] object-contain ${reward.isLocked ? "opacity-50" : ""}`}
                      alt="video"
                    />
                    {reward.isLocked ? "준비중" : "눌러서 시청하기"}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 relative z-10 mt-2">
                <p
                  className="font-semibold text-[15px] leading-[140%] tracking-[-0.025em]"
                  style={{ color: "#FDE047", fontFamily: "Pretendard" }}
                >
                  + {reward.points}
                </p>
                <p
                  className="font-bold text-[15px] leading-[140%] tracking-[-0.025em]"
                  style={{ color: "#E9E9E9", fontFamily: "Pretendard" }}
                >
                  {reward.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNavigation />

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {showInfoPopup && (
        <SimpleInfoPopup
          message={popupMessage}
          onClose={() => setShowInfoPopup(false)}
        />
      )}

      {playingVideoId && playingVideoUrl && (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col">
          <div className="h-[60px] flex items-center justify-between px-4">
            <h2 className="text-white text-lg font-bold">영상 시청</h2>
            <button
              onClick={handleCloseVideo}
              data-testid="button-close-video"
              className="text-white p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
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
                const video = e.currentTarget;
                (video as any)._maxWatchedTime = 0;
                (video as any)._lastTime = 0;
              }}
              onSeeking={(e) => {
                const video = e.currentTarget;
                const maxWatched = (video as any)._maxWatchedTime || 0;
                if (Math.abs(video.currentTime - ((video as any)._lastTime || 0)) > 0.5) {
                  video.currentTime = maxWatched;
                }
              }}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                const currentTime = video.currentTime;
                const maxWatched = (video as any)._maxWatchedTime || 0;
                if (currentTime > maxWatched) {
                  (video as any)._maxWatchedTime = currentTime;
                }
                (video as any)._lastTime = currentTime;
              }}
              data-testid="video-player"
            />
          </div>
          <div className="p-4 text-center">
            <p className="text-[#888888] text-sm">
              영상을 끝까지 시청하면 참여기회가 지급됩니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
