#!/usr/bin/env python3
"""Regenerate Korean game-voice MP3 clips (gTTS)."""
from pathlib import Path

from gtts import gTTS

ROOT = Path(__file__).resolve().parents[1] / "client" / "public" / "audio"
CLIPS = {
    "voice-prediction-started.mp3": "경기가 시작되었습니다. 예측 시작을 눌러주세요.",
    "voice-prediction-stopped.mp3": "타자가 타석에 들어섰습니다. 다음 타자 예측을 기다리세요.",
    "voice-three-outs.mp3": "쓰리 아웃. 공수 교대를 눌러 주세요.",
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
