import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/adminQueryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import type { WaitingScreen } from "@shared/schema";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

interface PaginatedResponse {
  data: WaitingScreen[];
  total: number;
}

export default function WaitingScreenManagement() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [showRegisterPopup, setShowRegisterPopup] = useState(false);
  const [videoName, setVideoName] = useState("");
  const [displayDuration, setDisplayDuration] = useState(4);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
  const { toast } = useToast();
  
  const itemsPerPage = useResponsivePageSize(50);
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const { assets } = useAdminAssets();

  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/admin/waiting-screens", currentPage, itemsPerPage],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/waiting-screens?page=${currentPage}&limit=${itemsPerPage}`
      );
      return res.json();
    },
  });

  const waitingScreens = data?.data || [];
  const totalPages = data?.total ? Math.ceil(data.total / itemsPerPage) : 1;

  const handleGetUploadParameters = async () => {
    const res = await apiRequest("POST", "/api/objects/upload");
    const { uploadURL } = await res.json();
    return {
      method: "PUT" as const,
      url: uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const gcsUrl = uploadedFile.uploadURL;
      
      // GCS URL을 /objects/ 형태로 변환
      if (gcsUrl && gcsUrl.startsWith("https://storage.googleapis.com/")) {
        const url = new URL(gcsUrl);
        const pathParts = url.pathname.split('/').filter(part => part);
        // pathParts[0]은 버킷 이름, pathParts[1]은 PRIVATE_OBJECT_DIR, 나머지는 파일 경로
        if (pathParts.length >= 2) {
          const filePath = pathParts.slice(2).join('/');
          const appUrl = `/objects/${filePath}`;
          setUploadedVideoUrl(appUrl);
          console.log('Converted GCS URL to app URL:', appUrl);
        } else {
          setUploadedVideoUrl(gcsUrl);
        }
      } else {
        setUploadedVideoUrl(gcsUrl || "");
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: { videoName: string; displayDuration: number; videoUrl: string }) => {
      return await apiRequest("POST", "/api/admin/waiting-screens", data);
    },
    onSuccess: () => {
      toast({ description: "대기화면이 등록되었습니다." });
      setShowRegisterPopup(false);
      setVideoName("");
      setDisplayDuration(4);
      setUploadedVideoUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waiting-screens"] });
    },
    onError: () => {
      toast({ variant: "destructive", description: "등록에 실패했습니다." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/admin/waiting-screens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waiting-screens"] });
    },
  });

  const handleRegister = () => {
    if (!videoName.trim()) {
      toast({ variant: "destructive", description: "파일 이름을 입력해주세요." });
      return;
    }
    if (!uploadedVideoUrl) {
      toast({ variant: "destructive", description: "파일을 업로드해주세요." });
      return;
    }

    createMutation.mutate({
      videoName: videoName.trim(),
      displayDuration,
      videoUrl: uploadedVideoUrl,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const SkeletonRow = () => (
    <div className="grid grid-cols-[20%_40%_25%_15%] px-2 md:px-4 py-2 md:py-5 h-16 bg-white border-b border-[#E9E9E9] items-center animate-pulse">
      <div className="h-3 md:h-4 bg-[#E9E9E9] rounded w-16 md:w-24"></div>
      <div className="h-3 md:h-4 bg-[#E9E9E9] rounded w-20 md:w-32"></div>
      <div className="h-3 md:h-4 bg-[#E9E9E9] rounded w-14 md:w-20"></div>
      <div className="h-6 md:h-8 bg-[#E9E9E9] rounded w-10 md:w-12"></div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#BFBFBF]">수익 관리</span>
        <span className="text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-sm text-[#201E22]">예측 대기화면 관리</span>
      </div>
      <h1
        className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-8 h-8" alt="icon" />{" "}
        대기 화면 관리
      </h1>

      <div className="bg-white rounded">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between py-4 border-b border-[#E9E9E9]">
          <div className="text-sm text-[#414141] pb-3 px-11 text-base font-medium border-b-2 border-[#E11936] text-[#E11936]">
            목록 
          </div>
          <button
            onClick={() => setShowRegisterPopup(true)}
            className="px-4 py-2 bg-[#E11936] text-white text-sm font-medium rounded hover:bg-[#C71530]"
            data-testid="button-register"
          >
            + 대기화면 추가
          </button>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[20%_40%_25%_15%] px-4 py-3 bg-[#F7F7F7] border-b border-[#E9E9E9] text-sm font-semibold text-[#414141]">
          <div>등록일</div>
          <div>파일 명</div>
          <div>재생 시간</div>
          <div>관리</div>
        </div>

        {/* 테이블 바디 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: itemsPerPage }).map((_, index) => (
                <SkeletonRow key={index} />
              ))}
            </div>
          ) : waitingScreens.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-[#BFBFBF]">등록된 대기화면이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {waitingScreens.map((screen) => (
                <div
                  key={screen.id}
                  className="grid grid-cols-[20%_40%_25%_15%] px-4 h-16 bg-white border-b border-[#E9E9E9] items-center text-sm text-[#201E22]"
                  data-testid={`row-screen-${screen.id}`}
                >
                  <div className="text-[#414141]">
                    {new Date(screen.createdAt).toLocaleDateString('ko-KR', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit' 
                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                  </div>
                  <div className="text-[#414141] truncate" title={screen.videoName}>
                    {screen.videoName}
                  </div>
                  <div className="text-[#414141]">
                    {screen.displayDuration}초
                  </div>
                  <div>
                    <button
                      onClick={() => handleDelete(screen.id)}
                      className="px-3 py-1 text-xs font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530]"
                      data-testid={`button-delete-${screen.id}`}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {showRegisterPopup && (
        <>
          {/* 어둡게 깔리는 배경 */}
          <div
            className={`fixed inset-0 bg-black/30 z-[60] transition-opacity duration-300 ${
              showRegisterPopup ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => {
              setShowRegisterPopup(false);
              setVideoName("");
              setDisplayDuration(4);
              setUploadedVideoUrl("");
            }}
          />

          {/* 오른쪽 사이드바 */}
          <div
            className={`fixed top-0 right-0 z-[70] h-full w-[490px] bg-white shadow-lg transform transition-transform duration-300 ${
              showRegisterPopup ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex flex-col h-full p-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between border-b border-[#E9E9E9] pb-4">
                <h2 className="text-lg font-bold text-[#1A1A1A]">
                  대기화면 등록하기
                </h2>
                <button
                  onClick={() => {
                    setShowRegisterPopup(false);
                    setVideoName("");
                    setDisplayDuration(4);
                    setUploadedVideoUrl("");
                  }}
                  className="text-[#4D4B4E] hover:text-[#1A1A1A]"
                  data-testid="button-close-popup"
                >
                  ✕
                </button>
              </div>

              {/* 본문 */}
              <div className="flex-1 overflow-y-auto space-y-4 mt-4">
                {/* 파일 명 */}
                <div>
                  <label className="block text-sm font-medium text-[#4D4B4E] mb-1">
                    파일 명
                  </label>
                  <input
                    type="text"
                    value={videoName}
                    onChange={(e) => setVideoName(e.target.value)}
                    placeholder="제목을 입력해 주세요"
                    className="w-full px-3 py-2 border border-[#E9E9E9] rounded"
                    data-testid="input-video-name"
                  />
                </div>

                {/* 표시 포인트 */}
                <div>
                  <label className="block text-sm font-medium text-[#4D4B4E] mb-1">
                    표시 포인트
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={displayDuration}
                      onChange={(e) =>
                        setDisplayDuration(parseInt(e.target.value) || 4)
                      }
                      className="w-20 px-3 py-2 border border-[#E9E9E9] rounded"
                      data-testid="input-display-duration"
                    />
                    <span className="text-sm text-[#4D4B4E]">초</span>
                  </div>
                </div>

                {/* 파일 업로드 */}
                <div>
                  <label className="block text-sm font-medium text-[#4D4B4E] mb-1">
                    파일 업로드 (이미지/GIF)
                  </label>
                  {uploadedVideoUrl ? (
                    <div className="flex items-center justify-between p-3 border border-[#E9E9E9] rounded bg-[#FAFAFA]">
                      <span className="text-sm text-[#1A1A1A] truncate flex-1">
                        {uploadedVideoUrl.split("/").pop()}
                      </span>
                      <button
                        onClick={() => setUploadedVideoUrl("")}
                        className="ml-2 text-[#E11936] hover:underline text-sm"
                        data-testid="button-remove-video"
                      >
                        제거
                      </button>
                    </div>
                  ) : (
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={104857600}
                      allowedFileTypes={['image/*']}
                      accept="image/*"
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="w-full border border-[#E9E9E9] bg-white hover:bg-[#FAFAFA] text-[#4D4B4E]"
                    >
                      파일 업로드
                    </ObjectUploader>
                  )}
                </div>
              </div>

              {/* 푸터 버튼 */}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowRegisterPopup(false);
                    setVideoName("");
                    setDisplayDuration(4);
                    setUploadedVideoUrl("");
                  }}
                  className="px-4 py-2 border border-[#E9E9E9] rounded hover:bg-[#FAFAFA]"
                  data-testid="button-cancel"
                >
                  취소
                </button>
                <button
                  onClick={handleRegister}
                  className="px-4 py-2 bg-[#1A1A1A] text-white rounded hover:bg-[#333333]"
                  data-testid="button-submit"
                >
                  등록하기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
