# -*- coding: utf-8 -*-
"""시스템 매뉴얼 DOCX 일괄 생성 (관리자·쇼핑몰·운영자·DB). 사용자용은 generate-user-guide-docx.py"""
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def set_run_font(run, *, size: int | None = None, bold: bool = False) -> None:
    run.font.name = "맑은 고딕"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "맑은 고딕")
    if size is not None:
        run.font.size = Pt(size)
    run.bold = bold


def new_doc(title: str, subtitle: str) -> Document:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "맑은 고딕"
    style.font.size = Pt(11)
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "맑은 고딕")

    h = doc.add_heading(title, level=0)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in h.runs:
        set_run_font(run, size=20, bold=True)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run(subtitle)
    set_run_font(r, size=11)
    r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    doc.add_paragraph()
    return doc


def add_section(doc: Document, title: str, bullets: list[str]) -> None:
    h = doc.add_heading(title, level=1)
    for run in h.runs:
        set_run_font(run, size=14, bold=True)
    for item in bullets:
        p = doc.add_paragraph(style="List Bullet")
        set_run_font(p.add_run(item), size=11)


def add_table(doc: Document, headers: list[str], rows: list[list[str]]) -> None:
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        for p in cell.paragraphs:
            for run in p.runs:
                set_run_font(run, size=11, bold=True)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = table.rows[ri + 1].cells[ci]
            cell.text = val
            for p in cell.paragraphs:
                for run in p.runs:
                    set_run_font(run, size=11)
    doc.add_paragraph()


def footer_note(doc: Document) -> None:
    p = doc.add_paragraph()
    r = p.add_run(
        "※ 본 문서는 GitHub docs/ 원본을 기준으로 생성됩니다. "
        "최신본은 관리자 「시스템 매뉴얼」에서 다운로드하세요."
    )
    set_run_font(r, size=9)
    r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)


def write_admin() -> Path:
    doc = new_doc("빠몽이 사용 설명서 — 관리자", "PPAMONG Admin (/admin) · 슈퍼바이저·스태프")
    add_section(
        doc,
        "1. 개요",
        [
            "관리자 웹은 회원·경기·운영자·수익·고객지원·몰을 총괄합니다.",
            "슈퍼바이저(superAdmin)만 관리자 등록·시스템 운영·시스템 매뉴얼에 접근합니다.",
            "로그인: /admin/login — 승인된 관리자만 사용 가능합니다.",
        ],
    )
    add_section(
        doc,
        "2. 주요 메뉴",
        [
            "회원 관리: 목록·랭킹·초대 관리",
            "슈퍼바이저: 관리자 등록/리스트, 시스템 운영(DB 백업·로그인 현황·앱 릴리즈·시스템 매뉴얼)",
            "운영자: 등록·리스트·경기 배정·모니터링",
            "경기 관리·실시간 경기 모니터링",
            "수익: 배너·영상·대기화면·광고",
            "고객 지원: 공지·문의·게시판·약관",
            "쇼핑몰: 미리보기·상품·주문·매출·재고·매입",
        ],
    )
    add_section(
        doc,
        "3. 경기·예측 운영 포인트",
        [
            "KBO 일정·실황·상대전적·로고는 다음 스포츠(+네이버 문자중계)를 사용합니다. API-SPORTS 키는 필요 없습니다.",
            "경기 관리에서 오늘 경기를 등록·저장하고, 운영자 리스트의 「실황 ON/OFF」로 다음·네이버 실황 + 회원 게임 연동을 켭니다(기본 1경기).",
            "실시간 모니터링에서 배팅 분포·사이드벳·수동 스코어를 확인할 수 있습니다.",
            "스코어 수동 보정(PATCH) 시 controlMode=manual이 됩니다. 관리자 「수동」을 끄면 auto로 돌아가며 종료 시 실황 최종 보드가 다시 적용될 수 있습니다.",
            "「예측 시작」은 predictionEnabled만 켭니다. matchStatus=ongoing은 실황(다음) 근거로만 올립니다.",
        ],
    )
    footer_note(doc)
    out = DOCS / "빠몽이_사용설명서_관리자.docx"
    doc.save(out)
    return out


def write_operator() -> Path:
    doc = new_doc("빠몽이 사용 설명서 — 운영자", "PPAMONG Manager App · 실황 자동 + 예외 대응")
    add_section(
        doc,
        "1. 로그인·세션",
        [
            "카카오톡 로그인 링크로만 접속합니다 (앱/웹).",
            "같은 운영자 계정은 한 기기만 사용 가능합니다.",
            "경기 종료 시 약 10초 「경기종료」 안내 후 로그아웃됩니다(「세션 만료」가 아님).",
        ],
    )
    add_section(
        doc,
        "2. 실황 자동(기본 ON)",
        [
            "상단 「실황 자동 ON/OFF」로 타석 자동 진행을 켜고 끌 수 있습니다. OFF면 표시 동기화만 하고 액션은 수동입니다.",
            "타석 상태머신: 대기 → 예측열림 → 예측닫힘 → 결과확정 → 다음타자/공수교대.",
            "가드: 타자명·투수명 안정화 후 진행. 결과 확정 전에는 다음타자·공수교대·광고·투수교체를 막습니다.",
            "자동 결과: 아웃(아웃수↑)·홈런·1루(1루타·포볼·데드볼, 아웃 유지+타자 교체). 그 외는 「실황 추정」으로 제안만 합니다.",
            "1루 선택 의미: 1루타·포볼·데드볼(야수선택 등은 수동/제안 확인).",
            "수동 버튼은 같은 단계로 덮어씁니다(비상·애매한 타석용).",
        ],
    )
    add_section(
        doc,
        "3. 수동 컨트롤 (예외·보정)",
        [
            "경기전(scheduled)에는 예측시작·중지·결과·다음타자·투수교체·공수교대·대타가 비활성입니다.",
            "경기중(ongoing)에만 위 버튼을 사용합니다.",
            "수동 정상 흐름: 예측시작 → 예측중지 → 결과 전송 → 「다음 타자」(3아웃이면 「공수교대」).",
            "결과 전송 후 다음 타자/공수교대를 눌러야 다음 타석으로 넘어갑니다(자동 OFF이거나 가드에 걸린 경우).",
            "투수교체·공수교대 = 광고 시작 / 「예측 시작」(또는 광고 종료) = 광고 중지. 별도 「광고 시작」 버튼 없음.",
            "투수교체는 같은 타석이므로 대타(pinch)를 지우지 않습니다. 예측 중 투수교체 시 배팅은 환불·결과 생략될 수 있습니다.",
            "대타: 실황 타자명이 선발과 다르면 「대타가 나옵니다」 표시·자동 pinch. 수동 입력도 가능.",
            "팀명 클릭: 주전 1~9 타순·시즌 전적 입력(라인업 피커).",
            "점수 보정은 수동 모드로 잠급니다. 이닝 표시·팀 점수는 실황 스코어보드를 우선합니다.",
        ],
    )
    add_section(
        doc,
        "4. 상태 표시",
        [
            "구장명 · 경기전 / N회 초·말 / 경기종료 / 연기됨 · 타석 단계 배지",
            "네트워크 끊김 시 「실시간 연결 재시도 중」 — 예측 시작·중지는 HTTP로 계속 사용 가능합니다.",
        ],
    )
    footer_note(doc)
    out = DOCS / "빠몽이_사용설명서_운영자.docx"
    doc.save(out)
    return out


def write_mall() -> Path:
    doc = new_doc("빠몽이 사용 설명서 — 쇼핑몰", "빠몽이 쇼핑센터 · 몰 관리")
    add_section(
        doc,
        "1. 사용자 화면",
        [
            "홈 메뉴 「빠몽이 쇼핑센터」 또는 예측 화면 「쇼핑센터」로 이동합니다.",
            "상품 목록·상세·문의·구매 흐름을 제공합니다.",
            "회원 전용 기능은 로그인 후 이용합니다.",
        ],
    )
    add_section(
        doc,
        "2. 관리자 몰 메뉴",
        [
            "몰 미리보기·홈/상품 관리",
            "주문 관리·매출·재고·매입",
            "앱 홈 설정(쇼핑 노출 문구 등)",
        ],
    )
    add_section(
        doc,
        "3. 정책 요약",
        [
            "판매 유형·포인트/결제 정책은 docs/PPAMONG_몰_정책.md, PPAMONG_몰_판매유형.md를 참고합니다.",
            "상품 이미지는 R2 등 오브젝트 스토리지를 사용할 수 있습니다.",
        ],
    )
    footer_note(doc)
    out = DOCS / "빠몽이_사용설명서_쇼핑몰.docx"
    doc.save(out)
    return out


def write_db() -> Path:
    doc = new_doc("빠몽이 DB 구조 설명서", "MongoDB 중심 · PostgreSQL 레거시 동기화")
    add_section(
        doc,
        "1. 개요",
        [
            "운영 기본 저장소는 MongoDB입니다.",
            "일부 레거시 데이터는 PostgreSQL에 있으며, 슈퍼바이저 「디비 백업하기」에서 PG→Mongo 동기화·내보내기를 할 수 있습니다.",
            "상세 ERD는 docs/db-erd.md를 참고합니다.",
        ],
    )
    add_table(
        doc,
        ["영역", "주요 컬렉션/모델", "설명"],
        [
            ["회원", "users", "계정·포인트·출석·소셜/게스트"],
            ["경기", "matches, stadiums", "일정·상태·스코어보드·타순·대타"],
            ["예측", "predictions, roundStatistics", "타석 예측·라운드 통계"],
            ["사이드벳", "matchSideBets", "우승팀·최종스코어 배팅"],
            ["공지", "notices, noticeReads", "공지·게임 배너 dismiss"],
            ["관리자", "adminUsers", "스태프·슈퍼바이저·운영자"],
            ["몰", "goods*, mall*", "상품·주문·재고 등"],
        ],
    )
    add_section(
        doc,
        "2. Match 운영 필드 (요약)",
        [
            "matchStatus: scheduled | ongoing | completed | cancelled",
            "gameInning / inningHalf / batterIndexInHalf / outsInHalf — 운영자 진행 기준",
            "matchLineup / matchPlayerStats — 주전 타순·시즌 스탯",
            "pinchHitter — 현재 타석 대타 (다음 타자·공수교대 시 해제, 투수교체 시 유지)",
            "sideBetsLocked / predictionEnabled — 사이드벳 마감·타석 예측 오픈",
            "liveScoreboard / controlMode — 다음 스포츠 실황·수동 스코어 (auto|manual)",
            "liveAutoEnabled — 타석 실황 자동(기본 true). OFF면 표시만 동기화",
            "atBatPhase — 타석 상태머신 단계(WS at_bat_phase)",
        ],
    )
    add_section(
        doc,
        "3. 백업·동기화",
        [
            "슈퍼바이저 → 시스템 운영 → 디비 백업하기",
            "테이블별 Mongo 내보내기, PostgreSQL→Mongo 동기화 지원",
        ],
    )
    footer_note(doc)
    out = DOCS / "빠몽이_DB구조_설명서.docx"
    doc.save(out)
    return out


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    paths = [write_admin(), write_operator(), write_mall(), write_db()]
    # 사용자용은 별도 스크립트 유지
    user_script = ROOT / "scripts" / "generate-user-guide-docx.py"
    if user_script.exists():
        import runpy

        runpy.run_path(str(user_script), run_name="__main__")
        paths.append(DOCS / "빠몽이_사용설명서.docx")
    for p in paths:
        print(f"Wrote {p}")


if __name__ == "__main__":
    main()
