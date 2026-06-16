import type { Express } from "express";
import { attendanceRoutes } from "./UserRoutes/attendanceRoutes";
import { stadiumRoutes } from "./UserRoutes/stadiumsRoutes";
import { baMatchRoutes } from "./UserRoutes/baMatchRoutes";
import { postRoutes } from "./UserRoutes/postRoutes";
import { userRoutes } from "./UserRoutes/userRoutes";
import { pointRoutes } from "./UserRoutes/pointRoutes";
import { inquiryRoutes } from "./UserRoutes/inquiryRoutes";
import { noticeRoutes } from "./UserRoutes/noticeRoutes";
import { termRoutes } from "./UserRoutes/termRoutes";
import { homePageRoutes } from "./UserRoutes/homePageRoutes";
import { faqRoutes } from "./UserRoutes/faqRoutes";
import { ebookRoutes } from "./UserRoutes/ebookRoutes";
import { registerSocialAuthRoutes } from "./UserRoutes/socialAuthRoutes";
import { phoneVerificationRoutes } from "./UserRoutes/phoneVerificationRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import {adminUserRoutes} from "./routes/adminUserRoutes"
import {adminDonationRoutes} from "./routes/adminDonationRoutes"
import {adminRankingRoutes} from "./routes/adminRankingRoutes"
import {adminManagerRoutes} from "./routes/adminManagerRoutes"
import { operatorAdminRoutes } from "./routes/operatorAdminRoutes"

import {adminStadiumRoutes} from "./routes/adminStadiumRoutes"
import {adminMatchRoutes} from "./routes/adminMatchRoutes"
import {managerMatchAssignmentRoutes} from "./routes/managerMatchAssignmentRoutes"
import {operatorMonitoringRoutes} from "./routes/operatorMonitoringRoutes"
import { superAdminOpsRoutes } from "./routes/superAdminOpsRoutes"
import {adminWaitingScreenRoutes} from "./routes/adminWaitingScreenRoutes"
import {adminAdvertisementRoutes} from "./routes/adminAdvertisementRoutes"
import {adminAdmobRoutes} from "./routes/adminAdmobRoutes"
import { managerRoutes } from "./routes/managerRoutes"
import predictionRoutes from "./liveMatch/predictionRoutes"
import matchControlRoutes from "./liveMatch/matchControlRoutes"
import { healthRoutes } from "./routes/healthRoutes"

export async function registerRoutes(app: Express): Promise<void> {

  await healthRoutes(app)
  await userRoutes(app)
  await pointRoutes(app)
  await stadiumRoutes(app)
  await baMatchRoutes(app)
  await postRoutes(app)
  await attendanceRoutes(app)
  await inquiryRoutes(app)
  await noticeRoutes(app)
  await termRoutes(app)
  await homePageRoutes(app)
  await faqRoutes(app)
  await ebookRoutes(app)
  
  // 전화번호 인증 라우터 등록
  await phoneVerificationRoutes(app)
  
  // 소셜 로그인 라우터 등록
  registerSocialAuthRoutes(app)
  
  // 관리자 페이지 라우터 등록
  await adminRoutes(app)
  await adminUserRoutes(app)
  await adminDonationRoutes(app)
  await adminRankingRoutes(app)
  await adminManagerRoutes(app)
  await operatorAdminRoutes(app)
  await adminStadiumRoutes(app)
  await adminMatchRoutes(app)
  await managerMatchAssignmentRoutes(app)
  await operatorMonitoringRoutes(app)
  await superAdminOpsRoutes(app)
  await adminWaitingScreenRoutes(app)
  await adminAdvertisementRoutes(app)
  await adminAdmobRoutes(app)
  
  // 매니저 라우터 등록
  await managerRoutes(app)
  
  // 실시간 경기 베팅 라우터 등록
  app.use("/api/live-match", predictionRoutes)
  app.use("/api/live-match", matchControlRoutes)
  
}
