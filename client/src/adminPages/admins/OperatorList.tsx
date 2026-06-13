import AdminLayout from "../adminLayout";

export default function OperatorListPage() {
  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#BFBFBF]">운영자 관리</span>
        <span className="text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-sm text-[#201E22]">운영자 리스트</span>
      </div>

      <h1 className="text-2xl font-semibold text-[#201E22] mb-6" data-testid="text-page-title">
        🎯 운영자 리스트
      </h1>

      <div className="flex flex-col items-center justify-center py-32">
        <p className="text-base text-[#BFBFBF]">운영자 리스트 페이지</p>
      </div>
    </AdminLayout>
  );
}
