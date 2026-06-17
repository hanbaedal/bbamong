import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "../adminLayout";
import { adminFetch, apiRequest } from "@/lib/adminQueryClient";
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
  syncMode?: "replace" | "merge";
  syncScheduleKst?: string | null;
  syncIntervalMinutes: number | null;
  lastSync: SyncRunResult | null;
  syncRunning: boolean;
  syncableTables: string[];
}

interface SyncTableResult {
  pgTable: string;
  label: string;
  read: number;
  upserted: number;
  modified: number;
  deleted?: number;
  skipped?: boolean;
  error?: string;
  mode?: "replace" | "merge";
}

interface SyncRunResult {
  startedAt: string;
  finishedAt: string;
  success: boolean;
  syncMode?: "replace" | "merge";
  tables: SyncTableResult[];
  message?: string;
  pgDatabase?: string | null;
  totalRead?: number;
  totalWritten?: number;
}

function formatSyncSummary(result: SyncRunResult, pgTable?: string): string {
  const row = pgTable
    ? result.tables.find((t) => t.pgTable === pgTable)
    : result.tables[0];
  if (!row) return result.message ?? "저장 완료";
  if (row.error && !row.skipped) return `${row.label}: ${row.error}`;
  if (row.mode === "replace" || result.syncMode === "replace") {
    return `${row.label}: PostgreSQL ${row.read}건 → MongoDB 교체 (삭제 ${row.deleted ?? 0}, 삽입 ${row.upserted})`;
  }
  return `${row.label}: PostgreSQL ${row.read}건 → MongoDB 저장 (신규 ${row.upserted}, 갱신 ${row.modified})`;
}

function summarizeLastSync(lastSync: SyncRunResult): {
  totalRead: number;
  totalUpserted: number;
  totalModified: number;
  totalDeleted: number;
  skippedTables: string[];
  failedTables: string[];
} {
  let totalRead = 0;
  let totalUpserted = 0;
  let totalModified = 0;
  let totalDeleted = 0;
  const skippedTables: string[] = [];
  const failedTables: string[] = [];

  for (const row of lastSync.tables) {
    totalRead += row.read;
    totalUpserted += row.upserted;
    totalModified += row.modified;
    totalDeleted += row.deleted ?? 0;
    if (row.skipped) skippedTables.push(row.pgTable);
    else if (row.error) failedTables.push(row.pgTable);
  }

  return { totalRead, totalUpserted, totalModified, totalDeleted, skippedTables, failedTables };
}

export default function DbBackupPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importingTable, setImportingTable] = useState<string | null>(null);

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) {
      setLocation("/admin/members/list");
    }
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  const { data, isLoading, refetch } = useQuery<DbTablesResponse>({
    queryKey: ["/api/admin/ops/db-tables"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/ops/db-tables");
      if (!res.ok) throw new Error("테이블 목록 조회 실패");
      return res.json();
    },
    enabled: isUserLoaded && isSuperAdmin,
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/ops/sync-postgres-to-mongo", {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "동기화에 실패했습니다.");
      }
      return (await res.json()) as SyncRunResult;
    },
    onSuccess: (result) => {
      void refetch();
      const summary = summarizeLastSync(result);
      const detail =
        summary.totalRead > 0
          ? `PostgreSQL ${summary.totalRead}건 → 신규 ${summary.totalUpserted}, 갱신 ${summary.totalModified}`
          : result.pgDatabase
            ? `DB「${result.pgDatabase}」에서 읽은 데이터 0건 — DATABASE_URL DB 이름 확인`
            : "PostgreSQL에서 읽은 데이터가 0건입니다. DATABASE_URL의 DB 이름을 확인하세요.";
      toast({
        variant: result.success ? "default" : "destructive",
        description: `${result.message ?? "전체 동기화 완료"} (${detail})`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "동기화에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const syncableSet = new Set(data?.syncableTables ?? []);

  const importTable = async (pgTable: string) => {
    const res = await apiRequest("POST", `/api/admin/ops/sync-postgres-to-mongo/${pgTable}`, {});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "저장에 실패했습니다.");
    }
    return (await res.json()) as SyncRunResult;
  };

  const importSelectedTables = async (pgTables: string[]) => {
    const res = await apiRequest("POST", "/api/admin/ops/sync-postgres-to-mongo", {
      tables: pgTables,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "저장에 실패했습니다.");
    }
    return (await res.json()) as SyncRunResult;
  };

  const toggleTable = (pgTable: string, checked: boolean) => {
    if (!syncableSet.has(pgTable)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(pgTable);
      else next.delete(pgTable);
      return next;
    });
  };

  const syncableTables = (data?.tables ?? []).filter((t) => syncableSet.has(t.pgTable));
  const allSelected =
    syncableTables.length > 0 && selected.size === syncableTables.length;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(syncableTables.map((t) => t.pgTable)) : new Set());
  };

  const handleImportSelected = async () => {
    if (!data?.postgresConfigured) {
      toast({ variant: "destructive", description: "DATABASE_URL을 먼저 설정해주세요." });
      return;
    }
    if (selected.size === 0) {
      toast({ variant: "destructive", description: "저장할 테이블을 선택해주세요." });
      return;
    }
    setImporting(true);
    try {
      const result = await importSelectedTables(Array.from(selected));
      void refetch();
      toast({ description: result.message ?? `${selected.size}개 테이블을 MongoDB에 저장했습니다.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "저장에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    } finally {
      setImporting(false);
    }
  };

  const downloadMongoJson = async (pgTable: string) => {
    const res = await adminFetch(`/api/admin/ops/db-backup/${pgTable}?source=mongodb`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "백업 실패");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pgTable}_mongodb_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isUserLoaded || !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full text-gray-500">로딩 중...</div>
      </AdminLayout>
    );
  }

  const tables = data?.tables ?? [];

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
          공통 DB → MongoDB 가져오기
        </h1>

        <p className="text-sm text-[#666] mb-4 leading-relaxed">
          다른 프로그램과 공유하는 <strong>PostgreSQL</strong>은 <strong>읽기만</strong> 합니다 (선택 기능).
          PPAMONG은 빠던9와 별도 서비스이며, 자동 가져오기는 기본 꺼짐(
          <code>PG_MONGO_SYNC_ENABLED=true</code> 시에만 백그라운드 동기화).
          「받기」를 누르면 해당 테이블 데이터를 PPAMONG 운영 DB인 <strong>MongoDB</strong>에
          저장합니다. 모드는 Secret <code>PG_MONGO_SYNC_MODE</code>로 결정됩니다 (
          <code>replace</code>=기존 삭제 후 재저장, <code>merge</code>=upsert). PostgreSQL에는 쓰지 않습니다.
          {!data?.postgresConfigured && (
            <span className="block mt-3 p-3 rounded-lg border border-[#F5C6CB] bg-[#FFF5F5] text-[#201E22]">
              <strong className="text-[#E11936]">DATABASE_URL(공통 PostgreSQL)이 설정되지 않았습니다.</strong>
              <span className="block mt-2 text-xs leading-relaxed text-[#555]">
                Replit <strong>Tools → Secrets</strong>에 아래처럼 등록해야 「받기」가 동작합니다.
                <br />
                · 방법 A (빠던9와 동일):{" "}
                <code className="bg-white px-1">PGHOST</code>,{" "}
                <code className="bg-white px-1">PGUSER</code>,{" "}
                <code className="bg-white px-1">PGPASSWORD</code>,{" "}
                <code className="bg-white px-1">PGDATABASE=ppadun9</code>
                <br />
                · 방법 B: Secret 이름 <code className="bg-white px-1">DATABASE_URL</code> (전체 URI)
                <br />
                · 값 형식:{" "}
                <code className="bg-white px-1 break-all">
                  postgresql://사용자:비밀번호@호스트:5432/DB이름?sslmode=require
                </code>
                <br />
                · Neon 등 콘솔의 <strong>Connection string</strong> 전체를 복사해 넣으세요.
                <br />
                · URI가 <code className="bg-white px-1">/neondb</code> 인데 데이터는{" "}
                <code className="bg-white px-1">ppadun9</code>에 있으면 Secret{" "}
                <code className="bg-white px-1">PG_DATABASE_NAME=ppadun9</code> 추가.
                <br />
                · 저장 후 <strong>Repl 재시작</strong> 또는 <strong>Deploy 다시 실행</strong> 후 이 페이지를 새로고침하세요.
                <br />
                · <code className="bg-white px-1">MONGODB_URI</code>와는 별개입니다 (MongoDB는 이미 운영 중일 수 있음).
              </span>
            </span>
          )}
        </p>

        {data?.postgresConfigured && (
          <div className="mb-4 p-4 rounded-lg border border-[#E9E9E9] bg-[#FFF9FA]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#201E22]">전체 테이블 자동 가져오기</p>
                <p className="text-xs text-[#666] mt-1">
                  모드:{" "}
                  <code className="bg-white px-1">
                    {data.syncMode === "replace" ? "replace (전체 교체)" : "merge (upsert)"}
                  </code>
                  {data.syncScheduleKst
                    ? ` · 백그라운드: 매일 KST ${data.syncScheduleKst} PostgreSQL → MongoDB`
                    : " · 백그라운드 자동 동기화 꺼짐"}
                </p>
                {data.lastSync && (() => {
                  const summary = summarizeLastSync(data.lastSync);
                  const pgTotal =
                    tables.reduce((sum, t) => sum + (t.postgresCount ?? 0), 0) ?? 0;
                  return (
                    <div className="text-xs text-[#888] mt-1 space-y-1">
                      <p>
                        마지막 실행:{" "}
                        {new Date(data.lastSync.finishedAt).toLocaleString("ko-KR")}
                        {data.lastSync.success ? " (성공)" : " (실패)"}
                        {data.lastSync.pgDatabase ? ` · PG DB: ${data.lastSync.pgDatabase}` : ""}
                        {data.lastSync.syncMode ? ` · 모드: ${data.lastSync.syncMode}` : ""}
                        {" · "}
                        {data.lastSync.syncMode === "replace" ? (
                          <>
                            PostgreSQL {summary.totalRead.toLocaleString()}건 읽음 → 삭제{" "}
                            {summary.totalDeleted.toLocaleString()}, 삽입{" "}
                            {summary.totalUpserted.toLocaleString()}
                          </>
                        ) : (
                          <>
                            PostgreSQL {summary.totalRead.toLocaleString()}건 읽음 → 신규{" "}
                            {summary.totalUpserted.toLocaleString()}, 갱신{" "}
                            {summary.totalModified.toLocaleString()}
                          </>
                        )}
                      </p>
                      {!data.lastSync.success && data.lastSync.message && (
                        <p className="text-red-600 leading-relaxed">{data.lastSync.message}</p>
                      )}
                      {!data.lastSync.success && summary.totalRead === 0 && (
                        <p className="text-amber-700 leading-relaxed">
                          연결은 됐지만 PostgreSQL에서 읽은 행이 0건입니다. 아래 표의
                          PostgreSQL 열이 모두 0이면{" "}
                          <code className="bg-white px-1">DATABASE_URL</code>의 DB 이름이
                          비어 있거나 다른 DB를 가리키는 경우가 많습니다 (예:{" "}
                          <code className="bg-white px-1">/neondb</code> 대신 실제 데이터가
                          있는 <code className="bg-white px-1">/ppadun9</code>). Neon 콘솔에서
                          올바른 Connection string을 다시 넣고 Repl을 재시작하세요.
                        </p>
                      )}
                      {summary.skippedTables.length > 0 && (
                        <p className="text-[#999]">
                          PG 테이블 없음(건너뜀): {summary.skippedTables.join(", ")}
                        </p>
                      )}
                      {summary.failedTables.length > 0 && (
                        <p className="text-red-600">
                          실패: {summary.failedTables.join(", ")}
                        </p>
                      )}
                      {pgTotal > 0 && summary.totalRead === 0 && data.lastSync.success && (
                        <p className="text-amber-700">
                          표에는 PostgreSQL 데이터가 보이는데 마지막 동기화는 0건입니다. 「전체
                          받기」를 한 번 눌러 보세요.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <Button
                className="bg-[#E11936] hover:bg-[#B71C1C] shrink-0"
                disabled={syncAllMutation.isPending || data.syncRunning}
                onClick={() => syncAllMutation.mutate()}
              >
                {syncAllMutation.isPending || data.syncRunning ? "가져오는 중..." : "전체 받기"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          <Button
            onClick={handleImportSelected}
            disabled={importing || !data?.postgresConfigured || selected.size === 0}
            className="bg-[#E11936] hover:bg-[#B71C1C]"
          >
            {importing ? "저장 중..." : `선택 항목 받기 (${selected.size})`}
          </Button>
        </div>

        <div className="overflow-x-auto flex-1 min-h-0">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[40px_1fr_100px_100px_140px_80px] px-4 py-3 bg-[#F9F9F9] text-sm font-medium text-[#4D4B4E] border-b">
              <div>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => toggleAll(!!v)}
                  aria-label="전체 선택"
                  disabled={!data?.postgresConfigured}
                />
              </div>
              <div>테이블</div>
              <div>MongoDB</div>
              <div>PostgreSQL</div>
              <div>받기 → MongoDB</div>
              <div>JSON</div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-[#BFBFBF]">불러오는 중...</div>
            ) : (
              tables.map((table) => {
                const canImport = syncableSet.has(table.pgTable);
                return (
                  <div
                    key={table.pgTable}
                    className="grid grid-cols-[40px_1fr_100px_100px_140px_80px] px-4 py-3 border-b items-center text-sm"
                  >
                    <Checkbox
                      checked={selected.has(table.pgTable)}
                      onCheckedChange={(v) => toggleTable(table.pgTable, !!v)}
                      disabled={!canImport || !data?.postgresConfigured}
                    />
                    <div>
                      <div className="font-medium text-[#201E22]">{table.pgTable}</div>
                      <div className="text-xs text-[#888]">{table.label}</div>
                      {!canImport && (
                        <div className="text-[10px] text-[#999]">MongoDB 전용 · 받기 없음</div>
                      )}
                    </div>
                    <div>{table.mongoCount.toLocaleString()}</div>
                    <div>
                      {table.postgresCount !== null
                        ? table.postgresCount.toLocaleString()
                        : "—"}
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#E11936] hover:bg-[#B71C1C] text-white"
                      disabled={
                        !canImport ||
                        !data?.postgresConfigured ||
                        importing ||
                        importingTable === table.pgTable
                      }
                      onClick={async () => {
                        setImportingTable(table.pgTable);
                        try {
                          const result = await importTable(table.pgTable);
                          void refetch();
                          toast({ description: formatSyncSummary(result, table.pgTable) });
                        } catch (err: unknown) {
                          const message =
                            err instanceof Error ? err.message : "저장에 실패했습니다.";
                          toast({ variant: "destructive", description: message });
                        } finally {
                          setImportingTable(null);
                        }
                      }}
                    >
                      {importingTable === table.pgTable ? "저장 중" : "받기"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await downloadMongoJson(table.pgTable);
                          toast({ description: `${table.pgTable} MongoDB JSON 다운로드` });
                        } catch (err: unknown) {
                          const message =
                            err instanceof Error ? err.message : "다운로드 실패";
                          toast({ variant: "destructive", description: message });
                        }
                      }}
                    >
                      JSON
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="text-[10px] text-[#999] mt-3 shrink-0">
          MongoDB 전용(홈페이지·굿즈·운영자 비밀번호 등)은 PostgreSQL 가져오기 시 덮어쓰지 않습니다.
        </p>
      </div>
    </AdminLayout>
  );
}
