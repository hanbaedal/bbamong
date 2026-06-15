import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ManagerSignupPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/manager/login");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <p className="text-[#201E22] text-center">
        운영자 계정은 관리자가 발급합니다. 로그인 화면으로 이동합니다.
      </p>
    </div>
  );
}
