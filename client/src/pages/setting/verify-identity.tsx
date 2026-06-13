import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BottomNavigation from "@/components/BottomNavigation";
import PageHeader from "@/components/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { apiRequest } from "@/lib/queryClient";

export default function VerifyIdentityPage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { assets } = useUserAssets();

  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("POST", "/api/verify-identity", {
        username: username.trim(),
        password,
      });

      const data = await response.json();

      if (data.verified) {
        sessionStorage.setItem("profileVerified", Date.now().toString());
        setLocation("/profile");
      } else {
        setError(data.error || "아이디 또는 비밀번호가 일치하지 않습니다.");
      }
    } catch (err: any) {
      setError(err.message || "본인 확인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-app-screen bg-[#111111]">
      <PageHeader
        leftAction={
          <button onClick={() => setLocation("/settings")} data-testid="button-back" className="p-1">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
        borderBottom
      />

      <div className="flex-1 flex flex-col px-5 pt-[10px] overflow-y-scroll-touch pb-bottom-nav-with-bar">
        <div className="w-full max-w-[375px] mx-auto">
          <h1 className="text-white text-[20px] font-bold text-center pt-4 pb-3" data-testid="text-page-title">본인 확인</h1>
          <p className="text-[#6B6B6B] text-sm mb-8 text-center" data-testid="text-page-description">회원정보 수정을 위해 본인 확인이 필요합니다.</p>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="verify-username" className="text-[#D5D5D5] text-sm">아이디</Label>
              <div className="relative flex items-center border-0 border-b border-b-[#373539] focus-within:border-b-[#E9E9E9]">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconUsername} alt="" className="w-5 h-5 object-contain" data-testid="icon-username" />
                </div>
                <Input
                  id="verify-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  placeholder="아이디를 입력해 주세요"
                  data-testid="input-verify-username"
                  className="h-12 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify-password" className="text-[#D5D5D5] text-sm">비밀번호</Label>
              <div className="relative flex items-center border-0 border-b border-b-[#373539] focus-within:border-b-[#E9E9E9]">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconPassword} alt="" className="w-5 h-5 object-contain" data-testid="icon-password" />
                </div>
                <Input
                  id="verify-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="비밀번호를 입력해 주세요"
                  data-testid="input-verify-password"
                  className="h-12 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#D5D5D5] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm" data-testid="text-verify-error">{error}</p>
            )}

            <div className="pt-4">
              <button
                onClick={handleVerify}
                disabled={isLoading}
                data-testid="button-verify"
                className={`w-full h-12 rounded-lg font-bold flex items-center justify-center transition-colors ${
                  !isLoading
                    ? "bg-[#CCF501] text-black hover:bg-[#CCF501]/90"
                    : "bg-[#414141] text-[#D5D5D5] cursor-not-allowed"
                }`}
              >
                {isLoading ? "확인 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}
