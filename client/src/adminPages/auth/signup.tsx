import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminSignupPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/admin/login");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <p className="text-[#201E22] text-center mb-6">
        관리자 계정은 슈퍼바이저만 등록할 수 있습니다.
        <br />
        슈퍼바이저에게 문의하세요.
      </p>
      <Button
        onClick={() => setLocation("/admin/login")}
        className="bg-[#E11936] hover:bg-[#B71C1C] text-white"
      >
        로그인으로 돌아가기
      </Button>
    </div>
  );
}
