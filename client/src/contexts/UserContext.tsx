import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { useLocation } from "wouter";
import { App } from "@capacitor/app";
import { getFullUrl, getOrRefreshAccessToken, queryClient } from "@/lib/queryClient";
import { getAccessToken, setAccessToken, getRefreshToken, saveRefreshToken, clearTokens } from "@/lib/tokenManager";
import { isNativePlatform } from "@/lib/logoutPlugin";
import { markPostLogout, USER_LOGIN_PATH } from "@/lib/loginSession";

export interface AttendanceRecord {
  id: number;
  userId: string;
  attendanceDate: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  lastAttendanceDate: string | null;
  attendanceRecords?: AttendanceRecord[];
  userType?: string;
  approvalStatus?: string;
  provider?: string;
  hasPassword?: boolean;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<{ nativeHandled: boolean }>;
  isUserLoaded: boolean;
  refetchUser: () => Promise<void>;
  hasCheckedInToday: boolean;
  isGuest: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/social-onboarding",
  "/forgot-password",
  "/admin/login",
  "/admin/signup",
  "/admin/waiting",
  "/manager/login",
  "/manager/signup",
  "/manager/pending-approval",
];

export function mapSessionUserFromAdmin(admin: Record<string, unknown>): User {
  return {
    id: String(admin.id ?? ""),
    username: String(admin.username ?? admin.email ?? ""),
    name: String(admin.name ?? ""),
    email: String(admin.email ?? ""),
    phone: String(admin.phone ?? ""),
    points: Number(admin.points ?? 0),
    userType: typeof admin.userType === "string" ? admin.userType : undefined,
    approvalStatus: typeof admin.approvalStatus === "string" ? admin.approvalStatus : undefined,
    attendanceRecords: [],
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const isLoggedOutRef = useRef(false);
  const userRef = useRef(user);

  // 오늘 출석 여부 미리 계산 (출석 페이지 진입 전에 준비)
  const hasCheckedInToday = useMemo(() => {
    if (!user?.attendanceRecords?.length) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return user.attendanceRecords.some(record => {
      const recordDate = new Date(record.attendanceDate);
      const recordStr = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
      return recordStr === todayStr;
    });
  }, [user?.attendanceRecords]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // 현재 경로에 따라 올바른 API 엔드포인트 반환
  const getAuthEndpoints = () => {
    const currentPath = window.location.pathname;
    
    if (currentPath.startsWith("/admin")) {
      return {
        me: "/api/admin/me",
        refresh: "/api/admin/refresh",
        logout: "/api/admin/logout",
        loginPath: "/admin/login"
      };
    } else if (currentPath.startsWith("/manager")) {
      return {
        me: "/api/manager/me",
        refresh: "/api/manager/refresh",
        logout: "/api/manager/logout",
        loginPath: "/manager/login"
      };
    } else {
      return {
        me: "/api/users/me",
        refresh: "/api/users/refresh",
        logout: "/api/users/logout",
        loginPath: USER_LOGIN_PATH
      };
    }
  };

  const fetchUser = useCallback(async () => {
    if (isLoggedOutRef.current) {
      setIsUserLoaded(true);
      return;
    }

    const endpoints = getAuthEndpoints();
    const currentPath = window.location.pathname;
    const isUserApp = !currentPath.startsWith("/admin") && !currentPath.startsWith("/manager");

    if (isUserApp) {
      const token = getAccessToken();
      const refreshToken = await getRefreshToken();
      if (!token && !refreshToken) {
        setUser(null);
        setIsUserLoaded(true);
        return;
      }
    }
    
    // User App: Bearer Token, Admin/Manager: Cookie
    const getHeaders = (): Record<string, string> => {
      if (isUserApp) {
        const token = getAccessToken();
        if (token) {
          return {
            'Authorization': `Bearer ${token}`,
          };
        }
      }
      return {};
    };

    const makeRequest = async () => {
      return fetch(getFullUrl(endpoints.me), {
        headers: getHeaders(),
        credentials: isUserApp ? "omit" : "include", // User App: 토큰, Admin/Manager: 쿠키
      });
    };

    try {
      let response = await makeRequest();

      if (response.status === 401) {
        if (isUserApp) {
          const token = await getOrRefreshAccessToken();
          if (!token) {
            console.log("[UserContext] Token refresh failed");
            if (!userRef.current) {
              setUser(null);
            } else {
              console.log("[UserContext] Keeping existing user state despite refresh failure");
            }
            setIsUserLoaded(true);
            return;
          }
          response = await makeRequest();
        } else {
          const refreshResponse = await fetch(getFullUrl(endpoints.refresh), {
            method: "POST",
            credentials: "include",
          });

          if (refreshResponse.ok) {
            response = await makeRequest();
          } else {
            console.log("Refresh token expired or missing, redirecting to login");
            setUser(null);
            setIsUserLoaded(true);
            if (!PUBLIC_PATHS.includes(currentPath)) {
              window.location.href = endpoints.loginPath;
            }
            return;
          }
        }
      }

      if (response.ok) {
        const data = await response.json();
        isLoggedOutRef.current = false;
        // 일반 유저는 success: true, user: {...}, attendanceRecords: [...]
        // 매니저/관리자는 {...} 직접 반환
        if (data.user) {
          // 일반 유저 응답
          setUser({
            ...data.user,
            attendanceRecords: data.attendanceRecords || [],
          });
        } else {
          // 매니저/관리자 응답
          setUser({
            ...data,
            attendanceRecords: [],
          });
        }
      } else if (response.status === 403) {
        setUser(null);
      } else if (!userRef.current) {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      if (!userRef.current) {
        setUser(null);
      }
    } finally {
      setIsUserLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(location)) {
      setIsUserLoaded(true);
      return;
    }

    if (isLoggedOutRef.current) {
      setIsUserLoaded(true);
      return;
    }

    if (!userRef.current) {
      // 보호 경로 진입 시 가드가 세션 확인 전에 로그인으로 튕기지 않도록 로딩 표시
      setIsUserLoaded(false);
      void fetchUser();
      return;
    }

    setIsUserLoaded(true);
  }, [location, fetchUser]);

  const handleSetUser = useCallback((newUser: User | null) => {
    if (newUser) {
      isLoggedOutRef.current = false;
    }
    // location 변경 effect가 같은 틱에서 userRef를 읽으므로 동기 반영
    userRef.current = newUser;
    setUser(newUser);
  }, []);

  const logout = async (): Promise<{ nativeHandled: boolean }> => {
    isLoggedOutRef.current = true;

    const endpoints = getAuthEndpoints();
    const currentPath = window.location.pathname;
    const isUserApp = !currentPath.startsWith("/admin") && !currentPath.startsWith("/manager");

    if (isUserApp) {
      markPostLogout();
    }

    // 웹/네이티브 공통: 세션·토큰 정리
    try {
      if (isUserApp) {
        const token = getAccessToken();
        if (token) {
          await fetch(getFullUrl(endpoints.logout), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } else {
        await fetch(getFullUrl(endpoints.logout), {
          method: "POST",
          credentials: "include",
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      if (isUserApp) {
        await clearTokens();
      }
      queryClient.clear();
    }

    // 스마트폰 사용자 앱: 로그인 화면으로 보내지 않고 앱을 닫음(접속 해제)
    if (isUserApp && isNativePlatform()) {
      try {
        await App.minimizeApp();
      } catch (error) {
        console.warn("[Logout] minimizeApp failed:", error);
      }
      setUser(null);
      return { nativeHandled: true };
    }

    setUser(null);
    return { nativeHandled: false };
  };

  const isGuest = useMemo(() => user?.provider === "guest", [user?.provider]);

  return (
    <UserContext.Provider value={{ user, setUser: handleSetUser, logout, isUserLoaded, refetchUser: fetchUser, hasCheckedInToday, isGuest }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
