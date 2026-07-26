/**
 * GitHub Actions Build APKs 워크플로 아티팩트를 data/app-releases 에 저장합니다.
 *
 * 사용:
 *   GITHUB_TOKEN=ghp_xxxx npm run app-releases:import-github
 *   GITHUB_TOKEN=ghp_xxxx npm run app-releases:import-github -- 28147934591
 */
import "dotenv/config";
import { importAppReleasesFromGithubRun } from "../server/utils/githubActionsArtifacts";

const runId = process.argv[2]?.trim() || "28147934591";

async function main() {
  console.log(`GitHub Actions run ${runId} 에서 APK 가져오는 중...`);
  const result = await importAppReleasesFromGithubRun({ runId });
  console.log("");
  console.log("가져오기 완료:");
  console.log("  runId:", result.runId);
  for (const meta of result.imported) {
    console.log(`  - ${meta.appKind}: ${meta.fileName} (${meta.versionLabel}, ${meta.sizeBytes} bytes)`);
  }
  if (result.skipped.length > 0) {
    console.log("  skipped:", result.skipped.join(", "));
  }
  console.log("");
  console.log("관리자 → 슈퍼바이저 → 앱 파일 등록/다운로드 에서 다운로드할 수 있습니다.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
