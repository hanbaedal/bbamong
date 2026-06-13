# Mobile Authentication Application

## Overview
This project is a mobile-first authentication application designed for user registration, login, and password recovery. Optimized for a 375px mobile viewport with a dark theme, it serves as a foundational component for a broader ecosystem. Its purpose is to enable features such as live match prediction, administration, user attendance tracking, content creation, and a fair point distribution system within the larger platform.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The application features a mobile-first design (375px max-width) with a dark theme and a custom color palette. The frontend is built using React 18, TypeScript, Vite, Wouter for routing, and styled with shadcn/ui and Tailwind CSS. State management is handled by TanStack Query for server state and React Hook Form with Zod for form validation. Admin and Manager interfaces have distinct light/dark themes and UI elements. Asset preloading is optimized by domain separation (user, admin, manager). Mobile layouts incorporate safe area handling for iOS and Android using `viewport-fit=cover` and platform-specific padding.

### Technical Implementations
The backend is developed with Express.js on Node.js and TypeScript, utilizing RESTful API design with Zod schemas for validation. Data is stored in PostgreSQL, managed by Drizzle ORM, with support for dual storage environments. Authentication is JWT-based with Refresh Token Rotation, secured using httpOnly, secure, sameSite=strict cookies, and supports social logins (Kakao, Google, Apple OAuth) via deep-link based one-time code exchange. Session management is Redis-based, preventing duplicate logins and enabling WebSocket disconnection upon session deletion.

Guest login creates a guest user in the DB with provider="guest", username is an internal unique ID (e.g. guest_abc123def456), and display name is "guest". Guest users are restricted from accessing profile, customer center, board posting, etc. via GuestRestrictionPopup. The default post-login landing page is `/home` (홈 화면). The User App has an Android hardware back button handler (`App.addListener('backButton')`) — only `/home` and `/login` trigger `minimizeApp()`; all other pages call `window.history.go(-1)` (simple browser-style back navigation). The `prediction.tsx` popstate handler is simplified: any popstate event calls `clearMatchSelection()` with no `pushState` re-traps; the 뒤로가기 확인 팝업(ConfirmBackPopup) has been removed. Google OAuth uses `prompt: 'select_account'` without `access_type: 'offline'`. The prediction stopped InfoPopup has been removed; when prediction is stopped, the UI silently transitions to the waiting state. After donation completion, `flushPendingEvents()` is called instead of `checkAndShowWaitingScreen()` to properly process queued WS events.

Key features include a live match system with real-time updates via WebSockets for round-based prediction, atomic point transactions, and admin-controlled match lifecycles, incorporating a pool-based reward and donation system. A ranking system tracks victory counts and earned points. Admin authorization employs a two-tier middleware system for role-based access control. Security measures include bcrypt hashing, httpOnly cookies, JWT payload validation, avoidance of client-side token storage, and automatic token refresh on 401 errors (with network failure tolerance: tokens retained for up to 3 consecutive network failures before clearing). Social login users are created with null password; they can skip identity verification for profile access until they set a password via the profile page. The `/api/users/me` response includes `hasPassword` (boolean) and `provider` fields to support this flow. **Duplicate login handling**: Users (all login methods: ID/PW, Kakao, Google, Apple) use force-replace semantics — logging in on a new device automatically terminates the old session and WS connections. Admins and managers use first-login-priority blocking (409). WS close code 4005 (Session terminated) triggers automatic reconnection with fresh token instead of permanent disconnect.

The inactive user batch job (`server/inactiveLogoutBatch.ts`) excludes users with active WebSocket connections OR recently disconnected users (5-minute grace period) from auto-logout, preventing disconnection during live matches and page transitions. The match auto-close batch (`server/matchAutoCloseBatch.ts`) runs on server start and hourly, auto-completing matches with `matchDate < KST today` or expired `endTime`. The suspended user cleanup batch (`server/suspendedUserCleanupBatch.ts`) runs hourly and permanently deletes users who have been in "삭제된 회원" (suspended) state for more than 7 days. User account deletion (`DELETE /api/users/me`) performs a soft delete (sets `isSuspended=1` + `suspendedAt` timestamp) instead of immediate hard delete; admin soft-delete also sets `suspendedAt`. Ad overlays in `prediction.tsx` only display when the user is in the prediction flow (waiting/submitting/result screens), not on the match selection screen, controlled by the `isInPredictionFlow` ref. The `round_next` WS event is handled in `useMatchWebSocket.ts` and resets all prediction state in `prediction.tsx` for smooth round transitions. Z-index hierarchy: popup content z-[75] > popup overlay z-[70] > BottomNavigation/PageHeader z-[65] > LoadingOverlay z-[55]. Match status DB values: `scheduled`, `ongoing`, `completed`, `cancelled`.

## External Dependencies

-   **Database**: Neon Database (serverless PostgreSQL).
-   **Session Store**: Redis (ioredis client).
-   **UI Libraries**: shadcn/ui (built on Radix UI), Lucide React, Recharts, date-fns, class-variance-authority, cmdk, embla-carousel-react.
-   **Validation**: Zod, zod-validation-error, React Hook Form.
-   **Social Login**: Kakao, Google, Apple OAuth.
-   **Mobile Platform**: Capacitor (iOS/Android native app support).
-   **File Uploads**: Replit Object Storage via Uppy library.
-   **Native Share**: @capacitor/share.