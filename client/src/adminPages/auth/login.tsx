import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { adminQueryClient, getFullUrl } from "@/lib/adminQueryClient";
import { useUser, mapSessionUserFromAdmin } from "@/contexts/UserContext";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const { refetchUser, setUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    general: "",
  });

  useEffect(() => {
    adminQueryClient.clear();
    setUser(null);
    void fetch(getFullUrl("/api/admin/logout"), {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      /* stale cookie 정리 — 실패해도 로그인 진행 */
    });
  }, [setUser]);

  const validate = () => {
    const newErrors = { email: "", password: "", general: "" };

    if (!email.trim()) newErrors.email = "아이디를 입력해 주세요.";
    if (!password.trim()) newErrors.password = "비밀번호를 입력해 주세요.";

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setErrors({ email: "", password: "", general: "" });

    try {
      const response = await fetch(getFullUrl("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // setUser가 커밋되기 전에 setLocation이 먼저 반영되면
        // AdminProtectedLayout이 user=null로 보고 /admin/login으로 되돌림
        if (data.admin) {
          flushSync(() => {
            setUser(mapSessionUserFromAdmin(data.admin as Record<string, unknown>));
          });
        } else {
          await refetchUser();
        }
        setLocation("/admin/home");
      } else {
        // 승인 대기 중인 경우 waiting 페이지로 이동
        if (response.status === 403 && data.error?.includes("승인 대기")) {
          setLocation("/admin/waiting");
          return;
        }

        setErrors({
          email: "",
          password: "",
          general: data.error || "로그인에 실패했습니다.",
        });
      }
    } catch (error) {
      setErrors({
        email: "",
        password: "",
        general: "로그인 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email || errors.general) {
      setErrors((prev) => ({ ...prev, email: "", general: "" }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password || errors.general) {
      setErrors((prev) => ({ ...prev, password: "", general: "" }));
    }
  };

  const inputBaseClass =
    "h-11 sm:h-12 text-sm text-[#201E22] placeholder:text-[#BFBFBF] bg-white rounded-md border focus-visible:ring-1 focus-visible:ring-offset-0";

  const fieldErrorClass = (hasError: boolean) =>
    hasError
      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
      : "border-[#E9E9E9] focus-visible:border-[#373539] focus-visible:ring-[#373539]/10";

  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-white flex flex-col admin-autofill-dark pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 flex flex-col items-center px-4 py-6 sm:px-5 sm:py-8">
        <div className="w-full max-w-[360px] my-auto">
          {/* 로고 */}
          <div
            className="flex justify-center mb-6 sm:mb-8"
            data-testid="admin-logo-container"
          >
            <div className="w-[100px] h-[160px] sm:w-[120px] sm:h-[190px] flex items-center justify-center">
              <img
                src={assets.adminLogo}
                alt="관리자 로고"
                className="w-full h-full object-contain"
                data-testid="img-admin-logo"
              />
            </div>
          </div>

          {/* 제목 */}
          <h1 className="text-start text-[#201E22] text-lg sm:text-xl font-semibold mb-4 sm:mb-6">
            관리자페이지 로그인
          </h1>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit}>
            <div className="rounded-xl border border-[#E9E9E9] bg-white p-4 sm:p-5 shadow-sm space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#414141] text-sm font-medium">
                  아이디
                </Label>
                <Input
                  id="email"
                  type="text"
                  autoComplete="username"
                  data-testid="input-email"
                  placeholder="아이디를 입력해주세요"
                  value={email}
                  onChange={handleEmailChange}
                  className={`${inputBaseClass} ${fieldErrorClass(Boolean(errors.email || errors.general))}`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs" data-testid="error-email">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#414141] text-sm font-medium">
                  비밀번호
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    data-testid="input-password"
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={handlePasswordChange}
                    className={`${inputBaseClass} pr-10 ${fieldErrorClass(Boolean(errors.password || errors.general))}`}
                  />
                  <button
                    type="button"
                    data-testid="button-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#414141] p-1 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs" data-testid="error-password">
                    {errors.password}
                  </p>
                )}
              </div>
            </div>

            {errors.general && (
              <p className="text-red-500 text-xs mt-3" data-testid="error-general">
                {errors.general}
              </p>
            )}

            <p className="mt-4 sm:mt-5 text-start text-[#666666] text-xs sm:text-sm">
              관리자 계정은 슈퍼바이저가 등록합니다.
            </p>

            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-admin-login"
              className="w-full h-11 sm:h-12 bg-[#E11936] hover:bg-[#B71C1C] text-white font-semibold text-sm sm:text-base rounded-md mt-5 sm:mt-6"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
