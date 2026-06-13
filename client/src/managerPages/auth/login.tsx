import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useManagerAssets } from "@/contexts/ManagerAssetContext";
import { getFullUrl, resetManagerRefreshCooldown } from "@/lib/managerQueryClient";
import { Capacitor } from "@capacitor/core";
import { setManagerAccessToken, saveManagerRefreshToken } from "@/lib/managerTokenManager";

export default function ManagerLoginPage() {
  const [, setLocation] = useLocation();
  const { assets } = useManagerAssets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    general: "",
  });

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
      const response = await fetch(getFullUrl("/api/manager/login"), {
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
        resetManagerRefreshCooldown();
        if (Capacitor.isNativePlatform() && data.accessToken && data.refreshToken) {
          setManagerAccessToken(data.accessToken);
          await saveManagerRefreshToken(data.refreshToken);
        }
        setLocation("/manager/home", { replace: true });
      } else {
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

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-y-auto overscroll-none admin-autofill-dark w-full" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)', WebkitOverflowScrolling: 'touch' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full flex flex-col h-full flex-1">
          {/* 로고 */}
          <div
            className="flex justify-center mb-16"
            data-testid="logo-container"
          >
            <div className="w-[120px] h-[120px] flex items-center justify-center">
              <img
                src={assets.loginLogo}
                alt="로그인 로고"
                className="w-full h-full object-contain"
                data-testid="img-login-logo"
              />
            </div>
          </div>

          {/* 로그인 폼 */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 flex-1 flex flex-col justify-between"
          >
            {/* 아이디 */}
            <div className="flex flex-col gap-8">
              {" "}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 text-sm">
                  아이디
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.iconEmail}
                      alt=""
                      className="w-5 h-5 object-contain"
                      data-testid="icon-email"
                    />
                  </div>
                  <Input
                    id="email"
                    type="text"
                    data-testid="input-manager-email"
                    placeholder="이메일 또는 아이디를 입력하세요"
                    value={email}
                    onChange={handleEmailChange}
                    className={`h-12 bg-white border-0 border-b text-black placeholder:text-gray-400 rounded-none pl-8 focus:outline-none focus:ring-0 focus-visible:ring-0
                 ${
                   errors.email || errors.general
                     ? "border-b-red-500 focus-visible:border-b-red-500"
                     : "border-b-gray-300 focus-visible:border-b-gray-600"
                 }
               `}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs" data-testid="error-email">
                    {errors.email}
                  </p>
                )}
              </div>
              {/* 비밀번호 */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 text-sm">
                  비밀번호
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.iconPassword}
                      alt=""
                      className="w-5 h-5 object-contain"
                      data-testid="icon-password"
                    />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    data-testid="input-manager-password"
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={handlePasswordChange}
                    className={`h-12 bg-white border-0 border-b text-black placeholder:text-gray-400 rounded-none pl-8 pr-12 focus:outline-none focus:ring-0 focus-visible:ring-0
                 ${
                   errors.password || errors.general
                     ? "border-b-red-500 focus-visible:border-b-red-500"
                     : "border-b-gray-300 focus-visible:border-b-gray-600"
                 }
               `}
                  />
                  <button
                    type="button"
                    data-testid="button-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p
                    className="text-red-500 text-xs"
                    data-testid="error-password"
                  >
                    {errors.password}
                  </p>
                )}
                {errors.general && (
                  <p
                    className="text-red-500 text-xs"
                    data-testid="error-general"
                  >
                    {errors.general}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="mt-6 text-center">
                <span className="text-gray-600 text-sm">
                  계정이 없으신가요?
                </span>
                <Link
                  href="/manager/signup"
                  className="text-[#E11936] text-sm font-medium hover:underline"
                >
                  회원가입
                </Link>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-manager-login"
                className="w-full h-12 bg-[#CDFF00] border-none text-black font-semibold text-base rounded-lg mt-8"
              >
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
