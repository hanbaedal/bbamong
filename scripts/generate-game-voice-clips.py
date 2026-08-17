#!/usr/bin/env python3
"""Regenerate Korean game-voice MP3 clips (gTTS)."""
from pathlib import Path

from gtts import gTTS

ROOT = Path(__file__).resolve().parents[1] / "client" / "public" / "audio"

CLIPS = {
    # 사용자 — 타석
    "voice-user-prediction-open-first.mp3": (
        "경기가 시작되었습니다. 타자의 진루 예측을 눌러주세요"
    ),
    "voice-user-prediction-open.mp3": "타자의 진루 예측을 눌러주세요",
    "voice-user-prediction-close.mp3": (
        "타자가 타석에 들어 섰습니다. 타자의 진루 예측을 멈춥니다"
    ),
    "voice-user-prediction-success.mp3": "타자의 진루 예측 성공을 축하합니다",
    "voice-user-prediction-fail.mp3": "아쉽습니다. 다음 타자를 기다려 주세요",
    "voice-user-switch-half.mp3": "공수교대를 합니다",
    "voice-user-pitcher-change.mp3": "투수 교체를 합니다",
    "voice-user-pinch-hitter.mp3": "대타자가 나왔습니다",
    "voice-user-prediction-cancelled-pitcher.mp3": (
        "투수 교체로 예측이 취소되었습니다"
    ),
    # 사용자 — 당일 상태
    "voice-user-no-match.mp3": "오늘은 경기가 없습니다",
    "voice-user-postponed.mp3": "오늘의 경기가 연기되었습니다",
    "voice-user-cancelled.mp3": "오늘의 경기가 취소되었습니다",
    "voice-user-pregame.mp3": "오늘의 경기 시간이 안되었습니다",
    "voice-user-live.mp3": "오늘의 경기가 진행 중입니다",
    "voice-user-match-ended.mp3": "오늘의 경기가 종료되었습니다",
    # 운영자
    "voice-operator-three-outs.mp3": "쓰리 아웃. 공수 교대를 눌러 주세요",
    "voice-operator-confirm-result.mp3": "예측 결과를 확정하세요",
    "voice-operator-start-prediction.mp3": "예측 시작을 눌러주세요",
    "voice-operator-match-ended.mp3": "경기가 종료되었습니다",
    # 인트로
    "intro-tagline.mp3": "실시간으로 즐기는 야구 예측게임. 빠던나인!",
}


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, text in CLIPS.items():
        path = ROOT / name
        gTTS(text=text, lang="ko", slow=False).save(str(path))
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
