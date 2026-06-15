import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../adminLayout";
import { adminFetch } from "@/lib/adminQueryClient";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface BackupTableInfo {
  pgTable: string;
  label: string;
  mongoCount: number;
  postgresAvailable: boolean;
  postgresCount: number | null;
}

interface DbTablesResponse {
  tables: BackupTableInfo[];
  primarySource: string;
  postgresConfigured: boolean;
}

export default function DbBackupPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<"mongodb" | "postgresql">("mongodb");
  const [downloading, setDownloading] = useState(false);

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) {
      setLocation("/admin/members/list");
    }
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  const { data, isLoading } = useQuery<DbTablesResponse>({
    queryKey: ["/api/admin/ops/db-tables"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/ops/db-tables");
      if (!res.ok) throw new Error("테이블 목록 조회 실패");
      return res.json();
    },
    enabled: isUserLoaded && isSuperAdmin,
  });

  const toggleTable = (pgTable: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(pgTable);
      else next.delete(pgTable);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (!data?.tables) return;
    setSelected(checked ? new Set(data.tables.map((t) => t.pgTable)) : new Set());
  };

  const downloadTable = async (pgTable: string) => {
    const res = await adminFetch(
      `/api/admin/ops/db-backup/${pgTable}?source=${source}`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "백업 실패");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pgTable}_${source}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSelected = async () => {
    if (selected.size === 0) {
      toast({ variant: "destructive", description: "백업할 테이블을 선택해주세요." });
      return;
    }
    setDownloading(true);
    try {
      for (const pgTable of Array.from(selected)) {
        await downloadTable(pgTable);
      }
      toast({ description: `${selected.size}개 테이블 백업을 다운로드했습니다.` });
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message || "백업에 실패했습니다." });
    } finally {
      setDownloading(false);
    }
  };

  if (!isUserLoaded || !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full text-gray-500">로딩 중...</div>
      </AdminLayout>
    );
  }

  const tables = data?.tables ?? [];
  const allSelected = tables.length > 0 && selected.size === tables.length;

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 md:mb-4 shrink-0">
          <span className="text-xs md:text-sm text-[#BFBFBF]">업무관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">디비 백업하기</span>
        </div>

        <h1 className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-4 flex items-center gap-2">
          <img src={assets.adTermIcon} className="w-8 h-8" alt="" />
          디비 백업하기
        </h1>

        <p className="text-sm text-[#666] mb-4">
          PostgreSQL 테이블명 기준으로 데이터를 JSON 파일로 백업합니다.
          현재 운영 DB는 MongoDB이며, <strong>운영 DB(MongoDB)</strong> 또는{" "}
          {data?.postgresConfigured ? (
            <strong>레거시 PostgreSQL(DATABASE_URL)</strong>
          ) : (
            <span className="text-[#E11936]">레거시 PostgreSQL(미설정)</span>
          )}
          에서 선택해 내려받을 수 있습니다.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <Button
            type="button"
            variant={source === "mongodb" ? "default" : "outline"}
            className={source === "mongodb" ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
            onClick={() => setSource("mongodb")}
          >
            운영 DB (MongoDB)
          </Button>
          <Button
            type="button"
            variant={source === "postgresql" ? "default" : "outline"}
            className={source === "postgresql" ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
            onClick={() => setSource("postgresql")}
            disabled={!data?.postgresConfigured}
          >
            레거시 PostgreSQL
          </Button>
          <Button
            onClick={handleDownloadSelected}
            disabled={downloading || selected.size === 0}
            className="bg-[#4285F4] hover:bg-[#357AE8] ml-auto"
          >
            {downloading ? "다운로드 중..." : `선택 항목 백업 (${selected.size})`}
          </Button>
        </div>

        <div className="overflow-x-auto flex-1 min-h-0">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[40px_1fr_120px_120px_100px] px-4 py-3 bg-[#F9F9F9] text-sm font-medium text-[#4D4B4E] border-b">
              <div>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => toggleAll(!!v)}
                  aria-label="전체 선택"
                />
              </div>
              <div>테이블 (PostgreSQL 명)</div>
              <div>MongoDB 건수</div>
              <div>PostgreSQL 건수</div>
              <div>개별</div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-[#BFBFBF]">불러오는 중...</div>
            ) : (
              tables.map((table) => (
                <div
                  key={table.pgTable}
                  className="grid grid-cols-[40px_1fr_120px_120px_100px] px-4 py-3 border-b items-center text-sm"
                >
                  <Checkbox
                    checked={selected.has(table.pgTable)}
                    onCheckedChange={(v) => toggleTable(table.pgTable, !!v)}
                  />
                  <div>
                    <div className="font-medium text-[#201E22]">{table.pgTable}</div>
                    <div className="text-xs text-[#888]">{table.label}</div>
                  </div>
                  <div>{table.mongoCount.toLocaleString()}</div>
                  <div>
                    {table.postgresCount !== null
                      ? table.postgresCount.toLocaleString()
                      : "—"}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setDownloading(true);
                      try {
                        await downloadTable(table.pgTable);
                        toast({ description: `${table.pgTable} 백업 완료` });
                      } catch (err: any) {
                        toast({ variant: "destructive", description: err?.message });
                      } finally {
                        setDownloading(false);
                      }
                    }}
                  >
                    받기
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
