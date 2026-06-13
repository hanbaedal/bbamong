import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import BottomNavigation from "@/components/BottomNavigation";
import PageHeader from "@/components/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, getFullUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserAssets } from "@/contexts/UserAssetContext";
import debounce from "lodash.debounce";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

type NicknameStatus = "idle" | "checking" | "available" | "unavailable";
type UsernameStatus = "idle" | "checking" | "available" | "unavailable";

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, setUser, isGuest } = useUser();
  const { toast } = useToast();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  useEffect(() => {
    const verified = sessionStorage.getItem("profileVerified");
    if (!verified) {
      setLocation("/verify-identity");
      return;
    }
    const elapsed = Date.now() - parseInt(verified, 10);
    if (elapsed > 10 * 60 * 1000) {
      sessionStorage.removeItem("profileVerified");
      setLocation("/verify-identity");
    }
  }, [setLocation]);
  const { assets } = useUserAssets();
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>("idle");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  const [formData, setFormData] = useState({
    username: user?.username || "",
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    confirmPassword: "",
  });

  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [originalPhone, setOriginalPhone] = useState("");

  const [errors, setErrors] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
  });

  const checkNickname = useCallback(
    debounce(async (name: string) => {
      if (!name.trim() || name.trim() === user?.name) {
        setNicknameStatus("idle");
        return;
      }

      setNicknameStatus("checking");

      try {
        const response = await apiRequest("POST", "/api/check-nickname", {
          name: name.trim(),
          userId: user?.id,
        });
        const data = await response.json();

        if (data.available) {
          setNicknameStatus("available");
        } else {
          setNicknameStatus("unavailable");
        }
      } catch (error) {
        setNicknameStatus("idle");
      }
    }, 500),
    [user?.id, user?.name]
  );

  const checkUsername = useCallback(
    debounce(async (username: string) => {
      if (!username.trim() || username.trim() === user?.username) {
        setUsernameStatus("idle");
        return;
      }

      setUsernameStatus("checking");

      try {
        const response = await apiRequest("POST", "/api/check-username", {
          username: username.trim(),
        });
        const data = await response.json();

        if (data.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("unavailable");
        }
      } catch (error) {
        setUsernameStatus("idle");
      }
    }, 500),
    [user?.username]
  );

  useEffect(() => {
    if (user) {
      const formatted = formatPhoneNumber(user.phone || "");
      setFormData({
        username: user.username,
        name: user.name,
        email: user.email || "",
        phone: formatted,
        password: "",
        confirmPassword: "",
      });
      setOriginalPhone(user.phone || "");
      setPhoneChanged(false);
      setIsPhoneVerified(false);
      setShowVerificationInput(false);
    }
  }, [user]);

  useEffect(() => {
    if (formData.name !== user?.name && formData.name.trim()) {
      checkNickname(formData.name);
    } else {
      setNicknameStatus("idle");
    }
  }, [formData.name, user?.name, checkNickname]);

  useEffect(() => {
    if (formData.username !== user?.username && formData.username.trim()) {
      checkUsername(formData.username);
    } else {
      setUsernameStatus("idle");
    }
  }, [formData.username, user?.username, checkUsername]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (verificationTimer > 0) {
      interval = setInterval(() => {
        setVerificationTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [verificationTimer]);

  useEffect(() => {
    if (!user?.id) return;
    const token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
    if (!token) return;
    fetch(getFullUrl("/api/users/me"), {
      headers: { "Authorization": `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.user?.referralCode) setReferralCode(data.user.referralCode);
      })
      .catch(() => {});
  }, [user?.id]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, "");
    const limitedNumbers = numbers.slice(0, 11);
    if (limitedNumbers.length <= 3) return limitedNumbers;
    if (limitedNumbers.length <= 7) return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`;
    return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
    const cleanNew = formatted.replace(/-/g, "");
    const changed = cleanNew !== originalPhone;
    setPhoneChanged(changed);
    if (changed) {
      setIsPhoneVerified(false);
      setShowVerificationInput(false);
      setVerificationTimer(0);
      setVerificationCode("");
    }
    setErrors((prev) => ({ ...prev, phone: "" }));
  };

  const sendVerificationCode = async () => {
    const cleanPhone = formData.phone.replace(/-/g, "");
    if (!cleanPhone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "전화번호를 입력해 주세요." }));
      return;
    }
    if (!/^01[0-9]{8,9}$/.test(cleanPhone)) {
      setErrors((prev) => ({ ...prev, phone: "올바른 전화번호 형식이 아닙니다." }));
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await fetch(getFullUrl("/api/phone/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await response.json();

      if (response.ok) {
        setShowVerificationInput(true);
        setVerificationTimer(data.expiresIn || 180);
        setVerificationCode("");
        setIsPhoneVerified(false);
        setErrors((prev) => ({ ...prev, phone: "" }));
      } else {
        setErrors((prev) => ({ ...prev, phone: data.error || "인증번호 전송에 실패했습니다." }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, phone: "인증번호 전송 중 오류가 발생했습니다." }));
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode.trim()) {
      setErrors((prev) => ({ ...prev, phone: "인증번호를 입력해 주세요." }));
      return;
    }
    const cleanPhone = formData.phone.replace(/-/g, "");
    setIsVerifying(true);

    try {
      const response = await fetch(getFullUrl("/api/phone/verify-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, code: verificationCode }),
      });
      const data = await response.json();

      if (response.ok && data.verified) {
        setIsPhoneVerified(true);
        setVerificationTimer(0);
        setErrors((prev) => ({ ...prev, phone: "" }));
      } else {
        setErrors((prev) => ({ ...prev, phone: data.error || "인증번호가 일치하지 않습니다." }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, phone: "인증 확인 중 오류가 발생했습니다." }));
    } finally {
      setIsVerifying(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("사용자 정보가 없습니다.");

      const body: any = {};
      if (formData.username && formData.username !== user.username) {
        if (usernameStatus === "unavailable") throw new Error("이미 사용 중인 아이디입니다.");
        if (usernameStatus === "checking") throw new Error("아이디 중복 확인 중입니다.");
        body.username = formData.username.trim();
      }
      if (formData.name && formData.name !== user.name) body.name = formData.name;

      if (formData.email && formData.email !== (user.email || "")) {
        if (!validateEmail(formData.email)) throw new Error("올바른 이메일 형식이 아닙니다.");
        body.email = formData.email;
      }

      if (phoneChanged) {
        const cleanPhone = formData.phone.replace(/-/g, "");
        if (!isPhoneVerified) throw new Error("전화번호 인증을 완료해 주세요.");
        body.phone = cleanPhone;
      }

      if (formData.password) {
        if (formData.password.length < 8) throw new Error("비밀번호는 최소 8자 이상이어야 합니다.");
        if (formData.password !== formData.confirmPassword) throw new Error("비밀번호가 일치하지 않습니다.");
        body.password = formData.password;
        body.confirmPassword = formData.confirmPassword;
      }

      if (Object.keys(body).length === 0) throw new Error("변경된 정보가 없습니다.");

      const response = await apiRequest("PATCH", `/api/users/${user.id}`, body);
      return response.json() as Promise<{ success: boolean; message: string; user: any }>;
    },
    onSuccess: (data) => {
      if (data.success && user) {
        setUser({
          ...user,
          username: data.user.username,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          hasPassword: data.user.hasPassword ?? user.hasPassword,
        });
        setOriginalPhone(data.user.phone);
        setPhoneChanged(false);
        setIsPhoneVerified(false);
        setShowVerificationInput(false);
        setFormData(prev => ({ ...prev, password: "", confirmPassword: "" }));
        toast({ title: "성공", description: data.message });
      }
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "정보 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="h-app-screen bg-[#111111]">
      <PageHeader title="" />

      <div className="flex-1 flex flex-col px-5 pt-[10px] overflow-y-scroll-touch pb-bottom-nav-with-bar">
        <div className="w-full max-w-[375px] mx-auto">
          <h1 className="text-white text-[20px] font-bold text-center pt-4 pb-3" data-testid="text-page-title">회원정보</h1>

          <div className="space-y-6">
            {/* 아이디 */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#D5D5D5] text-sm">아이디</Label>
              <div className="relative flex items-center">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconUsername} alt="" className="w-5 h-5 object-contain" data-testid="icon-username" />
                </div>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => {
                    setFormData({ ...formData, username: e.target.value });
                  }}
                  placeholder="아이디를 입력해 주세요"
                  data-testid="input-username"
                  className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 ${
                    usernameStatus === "unavailable" ? "border-b-red-500 focus-visible:border-b-red-500" : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                  }`}
                />
              </div>
              {usernameStatus === "unavailable" && (
                <p className="text-sm" style={{ color: "#FF6B6B" }} data-testid="text-username-error">이미 사용 중인 아이디입니다.</p>
              )}
              {usernameStatus === "available" && (
                <p className="text-sm" style={{ color: "#90EE90" }} data-testid="text-username-success">사용 가능한 아이디입니다.</p>
              )}
              {usernameStatus === "checking" && (
                <p className="text-sm text-[#6B6B6B]" data-testid="text-username-checking">확인 중...</p>
              )}
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#D5D5D5] text-sm">이름</Label>
              <div className="relative flex items-center">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconName} alt="" className="w-5 h-5 object-contain" data-testid="icon-name" />
                </div>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  maxLength={15}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="이름을 입력해 주세요 (최대 15자)"
                  data-testid="input-name"
                  className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 ${
                    errors.name ? "border-b-red-500 focus-visible:border-b-red-500" : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                  }`}
                />
              </div>
              {nicknameStatus === "unavailable" && (
                <p className="text-sm" style={{ color: "#FF6B6B" }} data-testid="text-nickname-error">이미 사용중인 닉네임입니다.</p>
              )}
              {nicknameStatus === "available" && (
                <p className="text-sm" style={{ color: "#90EE90" }} data-testid="text-nickname-success">사용 가능한 닉네임입니다.</p>
              )}
              {nicknameStatus === "checking" && (
                <p className="text-sm text-[#6B6B6B]" data-testid="text-nickname-checking">확인 중...</p>
              )}
              {errors.name && <p className="text-red-500 text-xs" data-testid="error-name">{errors.name}</p>}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#D5D5D5] text-sm">
                {user?.provider && user.provider !== 'local' && !user.hasPassword ? '보안용 비밀번호 설정' : '보안용 비밀번호 변경'}
              </Label>
              <div className="relative flex items-center">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconPassword} alt="" className="w-5 h-5 object-contain" data-testid="icon-password" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  placeholder="8자리 이상"
                  data-testid="input-password"
                  className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-12 ${
                    errors.password ? "border-b-red-500 focus-visible:border-b-red-500" : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                  }`}
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
              {errors.password && <p className="text-red-500 text-xs" data-testid="error-password">{errors.password}</p>}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#D5D5D5] text-sm">보안용 비밀번호 확인</Label>
              <div className="relative flex items-center">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconPassword} alt="" className="w-5 h-5 object-contain" data-testid="icon-confirm-password" />
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, confirmPassword: e.target.value });
                    setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                  placeholder="비밀번호를 한번더 입력해 주세요"
                  data-testid="input-confirm-password"
                  className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-12 ${
                    errors.confirmPassword ? "border-b-red-500 focus-visible:border-b-red-500" : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  data-testid="button-toggle-confirm-password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#D5D5D5] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs" data-testid="error-confirm-password">{errors.confirmPassword}</p>}
            </div>

            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#D5D5D5] text-sm">이메일</Label>
              <div className={`relative flex items-center border-0 border-b ${
                errors.email ? "border-b-red-500 focus-within:border-b-red-500" : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
              }`}>
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconEmail} alt="" className="w-5 h-5 object-contain" data-testid="icon-email" />
                </div>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="이메일을 입력해 주세요"
                  data-testid="input-email"
                  className="h-12 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs" data-testid="error-email">{errors.email}</p>}
            </div>

            {/* 전화번호 */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[#D5D5D5] text-sm">전화번호</Label>
              <div className={`relative flex items-center border-0 border-b ${
                errors.phone ? "border-b-red-500 focus-within:border-b-red-500" : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
              }`}>
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconPhone} alt="" className="w-5 h-5 object-contain" data-testid="icon-phone" />
                </div>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  disabled={isPhoneVerified && phoneChanged}
                  onChange={handlePhoneChange}
                  placeholder="010-0000-0000"
                  data-testid="input-phone"
                  className="h-12 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-24"
                />
                {phoneChanged && !isPhoneVerified && (
                  <Button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={isSendingCode}
                    data-testid="button-send-verification"
                    className="absolute right-0 bottom-1 h-auto p-[10px] py-[5px] bg-[#201E22] text-white whitespace-nowrap rounded-sm text-sm border-none disabled:opacity-50"
                  >
                    {isSendingCode ? "전송 중..." : showVerificationInput ? "재요청" : "인증요청"}
                  </Button>
                )}
              </div>

              {errors.phone && (
                <p className="text-red-500 text-xs" data-testid="error-phone">{errors.phone}</p>
              )}

              {isPhoneVerified && phoneChanged && (
                <p className="text-[#CCF501] text-xs" data-testid="text-phone-verified">인증 완료</p>
              )}

              {showVerificationInput && phoneChanged && !isPhoneVerified && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="인증번호 6자리"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                        data-testid="input-verification-code"
                        className="h-12 bg-transparent border-0 border-b border-b-[#373539] text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none focus-visible:border-b-[#E9E9E9] rounded-none px-4 pr-16"
                      />
                      {verificationTimer > 0 && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E11936] text-sm font-medium" data-testid="text-verification-timer">
                          {formatTimer(verificationTimer)}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={verifyCode}
                      disabled={isVerifying || verificationTimer === 0}
                      data-testid="button-verify-code"
                      className="h-auto p-[10px] py-[5px] bg-[#201E22] text-white rounded-sm text-sm border-none disabled:opacity-50"
                    >
                      {isVerifying ? "확인 중..." : "인증하기"}
                    </Button>
                  </div>
                  {verificationTimer === 0 && showVerificationInput && (
                    <p className="text-[#FF6B6B] text-xs">인증시간이 만료되었습니다. 재요청 버튼을 눌러주세요.</p>
                  )}
                </div>
              )}
            </div>

            {/* 추천인 코드 (읽기 전용) */}
            <div className="space-y-2">
              <Label className="text-[#6B6B6B] text-sm">추천인 코드</Label>
              <div className="relative flex items-center border-0 border-b border-b-[#373539]">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconReferral} alt="" className="w-5 h-5 object-contain" data-testid="icon-referral" />
                </div>
                <Input
                  type="text"
                  value={referralCode || ""}
                  readOnly
                  disabled
                  placeholder="추천인 코드 없음"
                  data-testid="input-referral-code"
                  className="h-12 bg-transparent border-0 text-[#6B6B6B] placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8"
                />
              </div>
            </div>

            {/* 저장 버튼 */}
            <div className="pt-4 pb-8">
              <button
                onClick={() => {
                  const newErrors = { name: "", password: "", confirmPassword: "", email: "", phone: "" };

                  if (!formData.name.trim()) newErrors.name = "이름을 입력해주세요.";
                  else if (formData.name.length > 15) newErrors.name = "이름은 최대 15자까지 입력 가능합니다.";
                  else if (nicknameStatus === "unavailable") newErrors.name = "이미 사용중인 닉네임입니다.";

                  if (formData.password) {
                    if (formData.password.length < 8) newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
                    if (!formData.confirmPassword) newErrors.confirmPassword = "비밀번호를 다시 입력해 주세요.";
                    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
                  }

                  if (formData.email && !validateEmail(formData.email)) newErrors.email = "올바른 이메일 형식이 아닙니다.";

                  if (phoneChanged && !isPhoneVerified) newErrors.phone = "전화번호 인증을 완료해 주세요.";

                  setErrors(newErrors);
                  if (Object.values(newErrors).some((e) => e !== "")) return;

                  if (nicknameStatus === "checking") {
                    toast({ title: "알림", description: "닉네임 확인 중입니다. 잠시 후 다시 시도해주세요." });
                    return;
                  }

                  if (checkGuest()) return;
                  updateMutation.mutate();
                }}
                disabled={updateMutation.isPending || nicknameStatus === "unavailable"}
                data-testid="button-save"
                className={`w-full h-12 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                  !(updateMutation.isPending || nicknameStatus === "unavailable")
                    ? "bg-[#CCF501] text-black hover:bg-[#CCF501]/90"
                    : "bg-[#414141] text-[#D5D5D5] cursor-not-allowed"
                }`}
              >
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
      <BottomNavigation />
    </div>
  );
}
