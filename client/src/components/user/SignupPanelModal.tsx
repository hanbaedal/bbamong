import type { ReactNode } from "react";
import AuthPanelModal from "@/components/user/AuthPanelModal";

interface SignupPanelModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}

export default function SignupPanelModal(props: SignupPanelModalProps) {
  return <AuthPanelModal anchor="right" {...props} />;
}
