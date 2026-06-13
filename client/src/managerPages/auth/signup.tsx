import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useManagerAssets } from "@/contexts/ManagerAssetContext";
import Popup from "@/components/customUi/infoPopup";
import { TermsModal } from "@/components/TermsModal";
import { Term } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { getFullUrl } from "@/lib/managerQueryClient";

export default function ManagerSignupPage() {
  const [, setLocation] = useLocation();
  const { assets } = useManagerAssets();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // 미리 로드된 약관
  const [operatorTerm, setOperatorTerm] = useState<Term | null>(null);

  const [errors, setErrors] = useState({
    username: "",
    name: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    terms: "",
  });
  const [touched, setTouched] = useState({
    username: false,
    name: false,
    password: false,
    confirmPassword: false,
    email: false,
    phone: false,
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 페이지 진입 시 operator 약관 미리 로드
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await fetch(getFullUrl("/api/terms/type/operator"));
        const data = await response.json();
        setOperatorTerm(data);
      } catch (error) {
        console.error("약관 로드 실패:", error);
      }
    };

    fetchTerms();
  }, []);

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, "");
    const limitedNumbers = numbers.slice(0, 11);

    if (limitedNumbers.length <= 3) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`;
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  const checkDuplicate = async () => {
    if (!username.trim()) {
      setErrors((prev) => ({ ...prev, username: "아이디를 입력해 주세요." }));
      return;
    }

    try {
      const response = await fetch(getFullUrl("/api/manager/check-username"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (data.available) {
        setDuplicateChecked(true);
        setErrors((prev) => ({ ...prev, username: "" }));
      } else {
        setErrors((prev) => ({ ...prev, username: data.message }));
      }
    } catch (error) {
      toast({
        variant: "destructive",
        description: "중복 확인 중 오류가 발생했습니다.",
      });
    }
  };

  const DEPARTMENTS = [
    "운영팀", "개발팀", "기술팀", "마케팅팀", "영업팀", "인사팀",
    "재무팀", "기획팀", "디자인팀", "고객지원팀", "총무팀", "법무팀",
    "품질관리팀", "연구개발팀", "구매팀", "물류팀", "보안팀", "홍보팀",
    "전략팀", "데이터팀",
  ];

  const POSITIONS = [
    "수습", "인턴", "사원", "주임", "대리", "과장", "차장", "부장",
    "팀장", "파트장", "실장", "본부장", "이사", "상무", "전무",
    "부사장", "사장", "대표이사", "수석", "선임", "책임",
  ];

  const validateForm = () => {
    const newErrors = {
      username: "",
      name: "",
      password: "",
      confirmPassword: "",
      email: "",
      phone: "",
      department: "",
      position: "",
      terms: "",
    };

    if (!username.trim()) {
      newErrors.username = "아이디를 입력해 주세요.";
    } else if (!duplicateChecked) {
      newErrors.username = "아이디 중복 확인을 해주세요.";
    }

    if (!name.trim()) {
      newErrors.name = "이름을 입력해 주세요.";
    }

    if (!password.trim()) {
      newErrors.password = "비밀번호를 입력해 주세요.";
    } else if (password.length < 8) {
      newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "비밀번호를 다시 입력해 주세요.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }

    if (!email.trim()) {
      newErrors.email = "이메일을 입력해 주세요.";
    } else if (!validateEmail(email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }

    if (!phone.trim()) {
      newErrors.phone = "전화번호를 입력해 주세요.";
    }

    if (!department) {
      newErrors.department = "부서를 선택해 주세요.";
    }

    if (!position) {
      newErrors.position = "직책을 선택해 주세요.";
    }

    if (!agreeToTerms) {
      newErrors.terms = "서비스 이용약관에 동의해주세요.";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      username: true,
      name: true,
      password: true,
      confirmPassword: true,
      email: true,
      phone: true,
    });

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(getFullUrl("/api/manager/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          name,
          password,
          email,
          phone: phone.replace(/-/g, ""),
          department,
          position,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        // 승인 상태 확인
        if (data.manager && data.manager.approvalStatus !== "승인") {
          // 승인 대기 페이지로 이동
          setLocation("/manager/pending-approval");
        } else {
          // 승인된 경우 성공 팝업
          setShowSuccessPopup(true);
        }
      } else {
        toast({
          variant: "destructive",
          description: data.error || "회원가입에 실패했습니다.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        description: "회원가입 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden admin-autofill-dark w-full" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}>
      {/* 헤더 */}
      <div className="h-[60px] flex-shrink-0 flex items-center px-3 relative z-50">
        <button
          onClick={() => setLocation("/manager/login")}
          data-testid="button-back"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 flex flex-col px-5 py-8 overflow-y-auto overscroll-none min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="w-full">
          <h1 className="text-black text-2xl font-semibold mb-8">
            회원가입을 진행해 주세요
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 아이디 */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700 text-sm">
                아이디
              </Label>
              <div
                className={`relative flex items-center border-0 border-b ${
                  errors.username
                    ? "border-b-red-500 focus-within:border-b-red-500"
                    : "border-b-gray-300 focus-within:border-b-gray-600"
                }`}
              >
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img
                    src={assets.iconUsername}
                    alt=""
                    className="w-5 h-5 object-contain"
                    data-testid="icon-username"
                  />
                </div>
                <Input
                  id="username"
                  type="text"
                  data-testid="input-manager-username"
                  placeholder="아이디를 입력해 주세요"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setDuplicateChecked(false);
                    if (touched.username) {
                      setErrors((prev) => ({ ...prev, username: "" }));
                    }
                  }}
                  className="h-12 bg-white border-0 text-black placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-8"
                />
                <Button
                  type="button"
                  onClick={checkDuplicate}
                  data-testid="button-check-duplicate"
                  className="absolute right-0 bottom-1 h-auto p-[10px] py-[5px] bg-gray-600 text-white hover:bg-gray-700 whitespace-nowrap rounded-sm text-sm border-none"
                >
                  중복 확인
                </Button>
              </div>

              {duplicateChecked ? (
                <p className="text-[#1567FF] text-xs">
                  사용 가능한 아이디 입니다.
                </p>
              ) : errors.username ? (
                <p
                  className="text-red-500 text-xs"
                  data-testid="error-username"
                >
                  {errors.username}
                </p>
              ) : null}
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700 text-sm">
                이름
              </Label>
              <div className="relative flex items-center">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img
                    src={assets.iconName}
                    alt=""
                    className="w-5 h-5 object-contain"
                    data-testid="icon-name"
                  />
                </div>
                <Input
                  id="name"
                  type="text"
                  data-testid="input-manager-name"
                  placeholder="이름을 입력해 주세요"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (touched.name) {
                      setErrors((prev) => ({ ...prev, name: "" }));
                    }
                  }}
                  className={`h-12 bg-white border-0 border-b text-black placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 ${
                    errors.name
                      ? "border-b-red-500 focus-visible:border-b-red-500"
                      : "border-b-gray-300 focus-visible:border-b-gray-600"
                  }`}
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-xs" data-testid="error-name">
                  {errors.name}
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
                  placeholder="8자리 이상"
                  value={password}
                  onChange={(e) => {
                    const filtered = e.target.value.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, "");
                    setPassword(filtered);
                    if (touched.password) {
                      setErrors((prev) => ({ ...prev, password: "" }));
                    }
                  }}
                  className={`h-12 bg-white border-0 border-b text-black placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-12 ${
                    errors.password
                      ? "border-b-red-500 focus-visible:border-b-red-500"
                      : "border-b-gray-300 focus-visible:border-b-gray-600"
                  }`}
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
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-gray-700 text-sm"
              >
                비밀번호 확인
              </Label>
              <div className="relative flex items-center">
                <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                  <img
                    src={assets.iconPassword}
                    alt=""
                    className="w-5 h-5 object-contain"
                    data-testid="icon-confirm-password"
                  />
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  data-testid="input-manager-confirm-password"
                  placeholder="비밀번호를 한번더 입력해 주세요"
                  value={confirmPassword}
                  onChange={(e) => {
                    const filtered = e.target.value.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, "");
                    setConfirmPassword(filtered);
                    if (touched.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }
                  }}
                  className={`h-12 bg-white border-0 border-b text-black placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-12 ${
                    errors.confirmPassword
                      ? "border-b-red-500 focus-visible:border-b-red-500"
                      : "border-b-gray-300 focus-visible:border-b-gray-600"
                  }`}
                />
                <button
                  type="button"
                  data-testid="button-toggle-confirm-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p
                  className="text-red-500 text-xs"
                  data-testid="error-confirm-password"
                >
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 text-sm">
                이메일
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
                  type="email"
                  data-testid="input-manager-email"
                  placeholder="이메일을 입력해 주세요"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (touched.email) {
                      setErrors((prev) => ({ ...prev, email: "" }));
                    }
                  }}
                  className={`h-12 bg-white border-0 border-b text-black placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 ${
                    errors.email
                      ? "border-b-red-500 focus-visible:border-b-red-500"
                      : "border-b-gray-300 focus-visible:border-b-gray-600"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs" data-testid="error-email">
                  {errors.email}
                </p>
              )}
            </div>

            {/* 전화번호 */}
            <div className="space-y-2">
              <Label className="text-gray-700 text-sm">전화번호</Label>
              <div className="flex gap-2">
                <div className="relative flex-1 flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.iconPhone}
                      alt=""
                      className="w-5 h-5 object-contain"
                      data-testid="icon-phone"
                    />
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    data-testid="input-manager-phone"
                    placeholder="휴대폰 11자리"
                    value={phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setPhone(formatted);
                      if (touched.phone) {
                        setErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }}
                    className={`h-12 bg-white border-0 border-b text-black placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 ${
                      errors.phone
                        ? "border-b-red-500 focus-visible:border-b-red-500"
                        : "border-b-gray-300 focus-visible:border-b-gray-600"
                    }`}
                  />
                </div>
              </div>

              {errors.phone && (
                <p className="text-red-500 text-xs" data-testid="error-phone">
                  {errors.phone}
                </p>
              )}
            </div>

            {/* 부서 */}
            <div className="space-y-2">
              <Label className="text-gray-700 text-sm">부서</Label>
              <div className={`border-0 border-b ${errors.department ? "border-b-red-500" : "border-b-gray-300"}`}>
                <Select value={department} onValueChange={(val) => { setDepartment(val); setErrors((prev) => ({ ...prev, department: "" })); }}>
                  <SelectTrigger
                    data-testid="select-department"
                    className="h-12 bg-white border-0 text-black focus:ring-0 focus:outline-none rounded-none px-0 shadow-none"
                  >
                    <SelectValue placeholder="부서를 선택해 주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errors.department && (
                <p className="text-red-500 text-xs" data-testid="error-department">{errors.department}</p>
              )}
            </div>

            {/* 직책 */}
            <div className="space-y-2">
              <Label className="text-gray-700 text-sm">직책</Label>
              <div className={`border-0 border-b ${errors.position ? "border-b-red-500" : "border-b-gray-300"}`}>
                <Select value={position} onValueChange={(val) => { setPosition(val); setErrors((prev) => ({ ...prev, position: "" })); }}>
                  <SelectTrigger
                    data-testid="select-position"
                    className="h-12 bg-white border-0 text-black focus:ring-0 focus:outline-none rounded-none px-0 shadow-none"
                  >
                    <SelectValue placeholder="직책을 선택해 주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errors.position && (
                <p className="text-red-500 text-xs" data-testid="error-position">{errors.position}</p>
              )}
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2 pt-4">
              <label
                htmlFor="terms"
                className="flex items-center justify-between bg-gray-100 rounded-[6px] p-[20px] cursor-pointer"
              >
                <div className="flex items-center space-x-2 h-full">
                  <Checkbox
                    id="terms"
                    data-testid="checkbox-terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => {
                      setAgreeToTerms(checked as boolean);
                      setErrors({ ...errors, terms: "" });
                    }}
                    className="border-gray-400 data-[state=checked]:bg-[#CDFF00] data-[state=checked]:text-black"
                  />
                  <span className="text-[16px] text-gray-700">
                    [필수] 서비스 이용약관 동의
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  data-testid="button-terms"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTermsModal(true);
                  }}
                  className="text-[#717680] text-[14px] h-auto min-h-0 p-0"
                >
                  전문보기
                </Button>
              </label>
              {errors.terms && (
                <p className="text-red-500 text-xs" data-testid="error-terms">
                  {errors.terms}
                </p>
              )}
            </div>

            {/* 회원가입 버튼 */}
            <Button
              type="submit"
              data-testid="button-manager-signup"
              disabled={isLoading}
              className="w-full h-12 bg-[#CDFF00] hover:bg-[#B8E600] text-black font-semibold text-base rounded-lg mt-8"
            >
              {isLoading ? "가입 중..." : "회원가입"}
            </Button>
          </form>
        </div>
      </div>
      {/* 회원가입 완료 팝업 */}
      {showSuccessPopup && (
        <Popup
          message="회원가입이 완료되었습니다."
          buttonText="확인"
          onConfirm={() => setLocation("/manager/login")}
        />
      )}

      {/* 약관 전문보기 모달 */}
      {showTermsModal && (
        <TermsModal
          open={showTermsModal}
          onOpenChange={setShowTermsModal}
          term={operatorTerm}
        />
      )}
    </div>
  );
}
