interface IntroBrandBallProps {
  className?: string;
  labelClassName?: string;
  testId?: string;
}

/** 야구공 + 「빠던나인」 — 타구·브랜드 클로즈업 공용 */
export default function IntroBrandBall({
  className = "",
  labelClassName = "",
  testId = "intro-brand-ball",
}: IntroBrandBallProps) {
  return (
    <div className={`intro-brand-ball ${className}`.trim()} data-testid={testId}>
      <svg viewBox="0 0 120 120" aria-hidden className="intro-brand-ball-svg">
        <circle cx="60" cy="60" r="54" fill="#f7f7f2" />
        <path
          d="M34 18C26 22 19 30 15 40C24 43 34 38 40 28C44 20 42 22 34 18Z"
          fill="#e11936"
          opacity="0.82"
        />
        <path
          d="M86 102C94 98 101 90 105 80C96 77 86 82 80 92C76 100 78 98 86 102Z"
          fill="#e11936"
          opacity="0.82"
        />
        <path
          d="M70 62C78 48 88 42 98 44C96 34 90 26 82 20C74 14 64 12 56 14C62 28 64 42 58 54C52 66 42 72 32 70C34 80 40 88 48 94C56 100 66 102 74 100C68 86 66 72 70 62Z"
          fill="#e11936"
          opacity="0.35"
        />
      </svg>
      <span className={`intro-brand-ball-label ${labelClassName}`.trim()}>빠던나인</span>
    </div>
  );
}
