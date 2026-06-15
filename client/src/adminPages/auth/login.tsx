import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { getFullUrl } from "@/lib/adminQueryClient";
import { useUser } from "@/contexts/UserContext";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const { refetchUser } = useUser();
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
        await refetchUser();
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

  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-white flex flex-col admin-autofill-dark">
      <div className="flex-1 flex flex-col items-center px-5 py-8">
        <div className="w-full max-w-[375px] my-auto">
          {/* 로고 */}
          <div
            className="flex justify-center mb-12"
            data-testid="admin-logo-container"
          >
            <div className="w-[100px] h-[100px] flex items-center justify-center">
              <img
                src={assets.loginLogo}
                alt="관리자 로고"
                className="w-full h-full object-contain"
                data-testid="img-admin-logo"
              />
            </div>
          </div>

          {/* 제목 */}
          <h1 className="text-start text-[#201E22] text-xl font-semibold mb-8">
            관리자페이지 로그인
          </h1>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#414141] text-sm">
                아이디
              </Label>
              <div className="relative flex items-center">
                <User
                  className="absolute left-2 w-5 h-5 text-[#BFBFBF]"
                  data-testid="icon-email"
                />
                <Input
                  id="email"
                  type="text"
                  autoComplete="username"
                  data-testid="input-email"
                  placeholder="아이디를 입력해주세요"
                  value={email}
                  onChange={handleEmailChange}
                  className={`h-12 bg-transparent border-0 border-b text-black placeholder:text-[#BFBFBF] rounded-none pl-9 focus:outline-none focus:ring-0 focus-visible:ring-0 ${
                    errors.email || errors.general
                      ? "border-b-red-500 focus-visible:border-b-red-500"
                      : "border-b-[E9E9E9] focus-visible:border-b-[#373539]"
                  }`}
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
              <Label htmlFor="password" className="text-[#414141] text-sm">
                비밀번호
              </Label>
              <div className="relative flex items-center">
                <Lock
                  className="absolute left-2 w-5 h-5 text-[#BFBFBF]"
                  data-testid="icon-password"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  data-testid="input-password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={handlePasswordChange}
                  className={`h-12 bg-transparent border-0 border-b text-black placeholder:text-[#BFBFBF] rounded-none pl-9 pr-12 focus:outline-none focus:ring-0 focus-visible:ring-0 ${
                    errors.password || errors.general
                      ? "border-b-red-500 focus-visible:border-b-red-500"
                      : "border-b-[E9E9E9] focus-visible:border-b-[#373539]"
                  }`}
                />
                <button
                  type="button"
                  data-testid="button-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#D5D5D5] transition-colors"
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
                <p className="text-red-500 text-xs" data-testid="error-general">
                  {errors.general}
                </p>
              )}
            </div>

            <p className="mt-6 text-start text-[#666666] text-sm">
              관리자 계정은 슈퍼바이저가 등록합니다.
            </p>

            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-admin-login"
              className="w-full h-12 bg-[#E11936] hover:bg-[#B71C1C] text-white font-semibold text-base rounded-md mt-8"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
