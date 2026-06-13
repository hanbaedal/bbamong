import { useState } from "react";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Mock 데이터
const dailyRevenueData = [
  { day: "1월", revenue: 800 },
  { day: "2월", revenue: 1200 },
  { day: "3월", revenue: 950 },
  { day: "4월", revenue: 1100 },
  { day: "5월", revenue: 1300 },
  { day: "6월", revenue: 1500 },
  { day: "7월", revenue: 1100 },
];

const exposureClickData = [
  { name: "노출", value: 68.3, color: "#E11936" },
  { name: "클릭", value: 31.7, color: "#FFD4DC" },
];

const detailData = [
  {
    date: "2024.01.15",
    views: 1234,
    manager: "김매니저",
    advertiser: "ABC광고주",
    status: "완료",
  },
  {
    date: "2024.01.14",
    views: 987,
    manager: "이매니저",
    advertiser: "XYZ광고주",
    status: "완료",
  },
  {
    date: "2024.01.13",
    views: 1456,
    manager: "박매니저",
    advertiser: "DEF광고주",
    status: "진행중",
  },
  {
    date: "2024.01.12",
    views: 823,
    manager: "최매니저",
    advertiser: "GHI광고주",
    status: "완료",
  },
  {
    date: "2024.01.11",
    views: 1122,
    manager: "정매니저",
    advertiser: "JKL광고주",
    status: "완료",
  },
];

export default function BannerRevenuePage() {
  const { assets } = useAdminAssets();
  const [period, setPeriod] = useState("전체");
  const [date, setDate] = useState("일자");
  const [method, setMethod] = useState("방법");
  const [advertiser, setAdvertiser] = useState("광고주");

  function StatCard({
    title,
    subtitle,
    value,
    unit,
  }: {
    title: string;
    subtitle: string;
    value: string | number;
    unit?: string;
  }) {
    return (
      <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
        <div className="mb-2">
          <p className="text-sm text-[#4D4B4E] mb-1">{title}</p>
          <p className="text-xs text-[#BFBFBF]">{subtitle}</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-[#201E22]">{value}</span>
          {unit && <span className="text-lg text-[#E11936]">{unit}</span>}
        </div>
      </div>
    );
  }

  function SkeletonRow() {
    return (
      <div className="grid grid-cols-5 px-2 md:px-4 py-2 md:py-5 bg-white border-b border-[#E9E9E9] items-center h-16">
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-16 md:w-24 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-12 md:w-16 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-14 md:w-20 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-16 md:w-24 animate-pulse" />
        <div className="h-5 md:h-6 bg-[#E9E9E9] rounded w-12 md:w-16 animate-pulse" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-screen">
        <div className="flex-shrink-0">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 mb-6"
            data-testid="breadcrumb"
          >
            <span className="text-sm text-[#BFBFBF]">수익 관리</span>
            <span className="text-sm text-[#BFBFBF]">&gt;</span>
            <span className="text-sm text-[#201E22]">
              동영상 광고 수익 현황
            </span>
          </div>

          {/* Page Title */}
          <h1
            className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
            data-testid="text-page-title"
          >
            <img src={assets.adListIcon} className="w-8 h-8" alt="icon" />{" "}
            동영상 광고 수익 현황
          </h1>

          {/* Filter Section */}
          <div className="mb-6 flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger
                data-testid="select-period"
                className="w-[150px] px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] bg-white"
              >
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체</SelectItem>
                <SelectItem value="오늘">오늘</SelectItem>
                <SelectItem value="이번주">이번주</SelectItem>
                <SelectItem value="이번달">이번달</SelectItem>
              </SelectContent>
            </Select>

            <Select value={date} onValueChange={setDate}>
              <SelectTrigger
                data-testid="select-date"
                className="w-[150px] px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] bg-white"
              >
                <SelectValue placeholder="일자" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="일자">일자</SelectItem>
                <SelectItem value="주간">주간</SelectItem>
                <SelectItem value="월간">월간</SelectItem>
              </SelectContent>
            </Select>

            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger
                data-testid="select-method"
                className="w-[150px] px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] bg-white"
              >
                <SelectValue placeholder="방법" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="방법">방법</SelectItem>
                <SelectItem value="방법1">방법1</SelectItem>
                <SelectItem value="방법2">방법2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={advertiser} onValueChange={setAdvertiser}>
              <SelectTrigger
                data-testid="select-advertiser"
                className="w-[150px] px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] bg-white"
              >
                <SelectValue placeholder="광고주" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="광고주">광고주</SelectItem>
                <SelectItem value="ABC광고주">ABC광고주</SelectItem>
                <SelectItem value="XYZ광고주">XYZ광고주</SelectItem>
              </SelectContent>
            </Select>

            <button
              className="px-6 py-2 bg-[#4285F4] text-white text-sm font-medium rounded hover:bg-[#357AE8]"
              data-testid="button-search"
            >
              검색하기
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-10">
            <StatCard
              title="총 시청 횟수"
              subtitle="광고가 재생된 총 시청 (1)"
              value="100"
            />
            <StatCard
              title="총 수익 (표시환율)"
              subtitle="광고를 통해 벌어들인 총 수익금액 (1)"
              value="100"
            />
            <StatCard
              title="평균 시청시간 (초)"
              subtitle="광고당 평균 시청시간 (1)"
              value="100"
            />
            <StatCard
              title="완료율"
              subtitle="광고가 끝까지 재생된 비율 (%)"
              value="0.00"
              unit="%"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-2 gap-6 mb-10">
            {/* Daily Revenue Chart */}
            <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
              <h3 className="text-base font-semibold text-[#201E22] mb-4">
                일별 광고 수익
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9E9E9" />
                  <XAxis dataKey="day" tick={{ fill: "#4D4B4E", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#4D4B4E", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#201E22",
                      border: "1px solid #FFFFFF", // border 흰색
                      borderRadius: "4px",
                      color: "#FFFFFF",
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#E11936"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>

              </ResponsiveContainer>
            </div>

            {/* Exposure and Click Distribution */}
            <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
              <h3 className="text-base font-semibold text-[#201E22] mb-4">
                노출 및 클릭 분포
              </h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={exposureClickData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={0}
                      dataKey="value"
                    >
                      {exposureClickData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${value}`}
                      contentStyle={{
                        backgroundColor: "#201E22", // 툴팁 배경
                        border: "1px solid #FFFFFF", // 흰색 테두리
                        borderRadius: "4px",
                        padding: "8px",
                      }}
                      itemStyle={{
                        color: "#FFFFFF", // 값 텍스트 흰색
                        fontSize: 12,
                      }}
                      labelStyle={{
                        color: "#FFFFFF", // 레이블 흰색
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                {exposureClickData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-[#4D4B4E]">{item.name}</span>
                    <span className="text-sm font-semibold text-[#201E22]">
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detail Table */}
          <div className="mb-6">
            <div className="flex items-center gap-2 border-b border-[#E9E9E9] pb-3 mb-2">
              <button
                className="text-base font-medium text-[#E11936] border-b-2 border-[#E11936] pb-3"
                data-testid="tab-detail"
              >
                상세 내역
              </button>
            </div>

            <div className="grid grid-cols-5 px-4 py-3 bg-[#F9F9F9] text-sm font-medium text-[#4D4B4E] mb-2">
              <div>날짜</div>
              <div>시청수</div>
              <div>매니저명</div>
              <div>광고주명</div>
              <div>상태</div>
            </div>

            <div className="h-[320px]">
              {detailData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="mb-4">
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                      <path
                        d="M30 10V50M10 30H50"
                        stroke="#E9E9E9"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <p className="text-base text-[#BFBFBF]">
                    데이터가 존재하지 않습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {detailData.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-5 px-4 py-5 bg-white border-b border-[#E9E9E9] text-sm text-[#201E22] items-center h-16"
                      data-testid={`detail-row-${index}`}
                    >
                      <div>{item.date}</div>
                      <div>{item.views.toLocaleString()}</div>
                      <div>{item.manager}</div>
                      <div>{item.advertiser}</div>
                      <div>
                        <span
                          className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                            item.status === "완료"
                              ? "bg-[#E8F5E9] text-[#4CAF50]"
                              : "bg-[#FFF3E0] text-[#FF9800]"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex justify-center items-center gap-2 mt-5">
              <button
                disabled
                className="w-8 h-8 flex items-center justify-center text-[#E9E9E9] cursor-not-allowed"
                data-testid="button-prev-page"
              >
                ‹
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center text-[#E11936] font-semibold"
                data-testid="button-page-1"
              >
                1
              </button>
              <button
                disabled
                className="w-8 h-8 flex items-center justify-center text-[#E9E9E9] cursor-not-allowed"
                data-testid="button-next-page"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
