import AdminLayout from "../adminLayout";

export default function PointHistoryPage() {
  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#BFBFBF]">회원 관리</span>
        <span className="text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-sm text-[#201E22]">포인트 내역 관리</span>
      </div>

      <h1 className="text-2xl font-semibold text-[#201E22] mb-6" data-testid="text-page-title">
        📊 포인트 내역 관리
      </h1>

      <div className="flex flex-col items-center justify-center py-32">
        <p className="text-base text-[#BFBFBF]">포인트 내역 관리 페이지</p>
      </div>
    </AdminLayout>
  );
}
