import { useState, useEffect } from "react";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

// 샘플 데이터
const sampleInvites = [
  { id: 1, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 6400 },
  { id: 2, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 6300 },
  { id: 3, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 6000 },
  { id: 4, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 6100 },
  { id: 5, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 6000 },
  { id: 6, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5900 },
  { id: 7, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5800 },
  { id: 8, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5700 },
  { id: 9, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5600 },
  { id: 10, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5500 },
  { id: 11, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5400 },
  { id: 12, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5300 },
  { id: 13, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5200 },
  { id: 14, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5100 },
  { id: 15, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 5000 },
  { id: 16, userId: "nobukber", name: "노벅비", email: "nobukber@email.com", inviteCount: 4900 },
];

export default function InviteManagementPage() {
  const { assets } = useAdminAssets();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(sampleInvites.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvites = sampleInvites.slice(startIndex, endIndex);

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#BFBFBF]">회원 관리</span>
        <span className="text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-sm text-[#201E22]">친구 초대 관리</span>
      </div>

      {/* Page Title */}
      <h1
        className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-8 h-8" alt="icon" /> 팀 친구 초대 관리
      </h1>

      <div className="bg-white rounded-lg shadow-sm">
        {/* 탭 */}
        <div className="flex border-b border-[#E9E9E9] mb-6">
          <button
            className="pb-3 px-1 text-base font-medium border-b-2 border-[#E11936] text-[#E11936]"
            data-testid="tab-invite-management"
          >
            친구 초대 관리
          </button>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[15%_20%_20%_25%_20%] px-4 py-3 bg-[#F5F5F5] border-y border-[#E9E9E9] items-center">
          <div className="text-sm font-semibold text-[#201E22]">초대 순번</div>
          <div className="text-sm font-semibold text-[#201E22]">ID</div>
          <div className="text-sm font-semibold text-[#201E22]">이름</div>
          <div className="text-sm font-semibold text-[#201E22]">이메일</div>
          <div className="text-sm font-semibold text-[#201E22]">초대된 횟수</div>
        </div>

        {/* 테이블 바디 */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0">
            {currentInvites.map((invite, index) => (
              <div
                key={invite.id}
                className="grid grid-cols-[15%_20%_20%_25%_20%] px-4 h-16 bg-white border-b border-[#E9E9E9] items-center text-sm text-[#201E22]"
                data-testid={`invite-row-${index}`}
              >
                <div className="text-[#414141]">{invite.id}</div>
                <div className="truncate text-[#414141]" title={invite.userId}>
                  {invite.userId}
                </div>
                <div className="truncate text-[#414141]" title={invite.name}>
                  {invite.name}
                </div>
                <div className="truncate text-[#414141]" title={invite.email}>
                  {invite.email}
                </div>
                <div className="text-[#414141]">{invite.inviteCount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </AdminLayout>
  );
}
