import { useState } from "react";
import Popup from "@/components/customUi/infoPopup";

interface GuestRestrictionPopupProps {
  show: boolean;
  onClose: () => void;
}

export default function GuestRestrictionPopup({ show, onClose }: GuestRestrictionPopupProps) {
  if (!show) return null;

  return (
    <Popup
      message="로그인 후 이용해주세요."
      buttonText="확인"
      onConfirm={onClose}
    />
  );
}

export function useGuestRestriction(isGuest: boolean) {
  const [showGuestPopup, setShowGuestPopup] = useState(false);

  const checkGuest = (): boolean => {
    if (isGuest) {
      setShowGuestPopup(true);
      return true;
    }
    return false;
  };

  return {
    showGuestPopup,
    setShowGuestPopup,
    checkGuest,
  };
}
