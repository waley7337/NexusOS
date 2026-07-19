#!/usr/bin/env python3
"""Generate Linear attachment exports (MD + PDF). Does not modify source reports."""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
)

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "docs" / "reports"
OUT = ROOT / "exports" / "linear-attachments"
OUT.mkdir(parents=True, exist_ok=True)

GEN_DATE = date(2026, 7, 19).isoformat()

MAPPING: list[tuple[int, str, str, str, list[Path]]] = [
    (7, "Part 03.0", "Part-03.0-Database-Schema-&-Enterprise-Data-Model",
     "Database Schema & Enterprise Data Model",
     [REPORTS / "Part-03.0" / "Part-03.0-Master-Engineering-Summary.md"]),
    (8, "Part 03.0", "Part-03.0-Requirements-Analysis",
     "Requirements Analysis",
     [REPORTS / "Part-03.0" / "Part-03.0-Requirements-Analysis.md"]),
    (9, "Part 03.0", "Part-03.0-Architecture-Design",
     "Architecture Design",
     [REPORTS / "Part-03.0" / "Part-03.0-Architecture-Design.md"]),
    (10, "Part 03.0", "Part-03.0-Database-Modeling",
     "Database Modeling",
     [REPORTS / "Part-03.0" / "Part-03.0-Database-Modeling.md"]),
    (11, "Part 03.0", "Part-03.0-Schema-Implementation",
     "Schema Implementation",
     [REPORTS / "Part-03.0" / "Part-03.0-Schema-Implementation.md"]),
    (12, "Part 03.0", "Part-03.0-Migration-Development",
     "Migration Development",
     [REPORTS / "Part-03.0" / "Part-03.0-Migration-Development.md"]),
    (13, "Part 03.0", "Part-03.0-Validation-and-Testing",
     "Validation & Testing",
     [REPORTS / "Part-03.0" / "Part-03.0-Validation-and-Testing.md"]),
    (14, "Part 03.0", "Part-03.0-Engineering-Review-Reconstruction",
     "Engineering Review Reconstruction",
     [REPORTS / "Part-03.0" / "Part-03.0-Engineering-Review-Reconstruction.md"]),
    (15, "Part 03.0", "Part-03.0-Remediation-Reconstruction",
     "Remediation Reconstruction",
     [REPORTS / "Part-03.0" / "Part-03.0-Remediation-Reconstruction.md"]),
    (16, "Part 03.0", "Part-03.0-Documentation",
     "Documentation",
     [REPORTS / "Part-03.0" / "Part-03.0-Documentation.md"]),
    (17, "Part 03.0", "Part-03.0-Final-Verification",
     "Final Verification",
     [REPORTS / "Part-03.0" / "Part-03.0-Final-Verification.md"]),
    (18, "Part 03.1", "Part-03.1-Backend-Security-Hardening",
     "Backend Security Hardening",
     [REPORTS / "Part-03.1" / "Part-03.1-Backend-Hardening-Completion-Report.md"]),
    (19, "Part 03.1", "Part-03.1-Security-Requirements-and-Threat-Review",
     "Security Requirements & Threat Review",
     [REPORTS / "Part-03.1" / "Part-03.1-Backend-Hardening-Completion-Report.md"]),
    (20, "Part 03.1", "Part-03.1-Request-Context-and-Request-ID-Hardening",
     "Request Context & Request-ID Hardening",
     [REPORTS / "Part-03.1" / "Part-03.1-Backend-Hardening-Completion-Report.md"]),
    (21, "Part 03.1", "Part-03.1-Trusted-Proxy-and-Client-IP-Boundary",
     "Trusted Proxy & Client IP Boundary",
     [REPORTS / "Part-03.1" / "Part-03.1-Required-Remediation-Report.md"]),
    (22, "Part 03.1", "Part-03.1-Redis-Rate-Limiting",
     "Redis Rate Limiting",
     [REPORTS / "Part-03.1" / "Part-03.1-Backend-Hardening-Completion-Report.md"]),
    (23, "Part 03.1", "Part-03.1-Security-Headers-and-CORS-Boundary",
     "Security Headers & CORS Boundary",
     [REPORTS / "Part-03.1" / "Part-03.1-Backend-Hardening-Completion-Report.md"]),
    (24, "Part 03.1", "Part-03.1-Audit-Logging-and-Exception-Observability",
     "Audit Logging & Exception Observability",
     [REPORTS / "Part-03.1" / "Part-03.1-Backend-Hardening-Completion-Report.md"]),
    (25, "Part 03.1", "Part-03.1-Security-Regression-Testing",
     "Security Regression Testing",
     [REPORTS / "Part-03.1" / "Part-03.1-Backend-Hardening-Completion-Report.md"]),
    (26, "Part 03.1", "Part-03.1-Independent-Engineering-Review",
     "Independent Engineering Review",
     [REPORTS / "Part-03.1" / "Part-03.1-Independent-Engineering-Review.md"]),
    (27, "Part 03.1", "Part-03.1-Remediation-and-Re-verification",
     "Remediation & Re-verification",
     [
         REPORTS / "Part-03.1" / "Part-03.1-Required-Remediation-Report.md",
         REPORTS / "Part-03.1" / "Part-03.1-Remediation-Re-Review.md",
         REPORTS / "Part-03.1" / "Part-03.1-Minor-Security-Migration-Follow-Up.md",
     ]),
    (28, "Part 03.1", "Part-03.1-Final-Verification",
     "Final Verification",
     [REPORTS / "Part-03.1" / "Part-03.1-Final-Follow-Up-Verification.md"]),
]

BRAND = colors.HexColor("#0B1F33")
ACCENT = colors.HexColor("#1F6B5A")
MUTED = colors.HexColor("#5A6570")
RULE = colors.HexColor("#D0D5DA")


def escape_xml(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline_md_fixed(text: str) -> str:
    codes: list[str] = []

    def save_code(m: re.Match[str]) -> str:
        codes.append(m.group(1))
        return f"@@CODE{len(codes) - 1}@@"

    t = re.sub(r"`([^`]+)`", save_code, text)
    t = escape_xml(t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    # Asterisk italics only — never underscore (paths like file_name.py)
    t = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<i>\1</i>", t)
    for i, c in enumerate(codes):
        t = t.replace(f"@@CODE{i}@@", f'<font face="Courier" size="9">{escape_xml(c)}</font>')
    return t


def load_body(sources: list[Path]) -> str:
    parts: list[str] = []
    for i, src in enumerate(sources):
        text = src.read_text()
        if len(sources) > 1:
            parts.append(
                f"\n\n---\n\n# Source document {i + 1} of {len(sources)}\n\n"
                f"`{src.relative_to(ROOT)}`\n\n---\n\n"
            )
        parts.append(text.rstrip() + "\n")
    return "".join(parts)


def build_export_markdown(wal: int, part: str, title: str, sources: list[Path], body: str) -> str:
    src_lines = "\n".join(f"- `{p.relative_to(ROOT)}`" for p in sources)
    cover = f"""---
document_type: Linear attachment export
project: NexusOS
part: {part}
linear_issue: WAL-{wal}
title: {title}
generated: {GEN_DATE}
---

# NexusOS Engineering Report

| Field | Value |
|---|---|
| **Project** | NexusOS — AI Business Operating System |
| **Part** | {part} |
| **Linear issue** | WAL-{wal} |
| **Report title** | {title} |
| **Generated** | {GEN_DATE} |
| **Export purpose** | Standalone attachment for manual Linear upload |

## Source reports (unchanged content below)

{src_lines}

> Presentation-only export. Repository source reports were not modified.

---

"""
    return cover + body


def extract_toc(md: str) -> list[tuple[int, str]]:
    toc = []
    for line in md.splitlines():
        m = re.match(r"^(#{1,3})\s+(.+)$", line)
        if m:
            toc.append((len(m.group(1)), m.group(2).strip()))
    return toc[:40]


def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_brand": ParagraphStyle(
            "cover_brand", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=28, textColor=BRAND, alignment=TA_CENTER, spaceAfter=6,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", parent=base["Normal"], fontName="Helvetica",
            fontSize=11, textColor=MUTED, alignment=TA_CENTER, spaceAfter=4,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=18, textColor=BRAND, alignment=TA_CENTER, spaceBefore=18,
            spaceAfter=12, leading=22,
        ),
        "meta": ParagraphStyle(
            "meta", parent=base["Normal"], fontName="Helvetica",
            fontSize=10, textColor=BRAND, alignment=TA_LEFT, leading=14, spaceAfter=3,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=16, textColor=BRAND, spaceBefore=16, spaceAfter=8, leading=20,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=13, textColor=ACCENT, spaceBefore=12, spaceAfter=6, leading=16,
        ),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontName="Helvetica-Bold",
            fontSize=11, textColor=BRAND, spaceBefore=10, spaceAfter=4, leading=14,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontName="Helvetica",
            fontSize=9.5, textColor=colors.HexColor("#1A1F24"),
            alignment=TA_JUSTIFY, leading=13, spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["Normal"], fontName="Helvetica",
            fontSize=9.5, textColor=colors.HexColor("#1A1F24"),
            leftIndent=14, bulletIndent=4, leading=13, spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "code", parent=base["Code"], fontName="Courier",
            fontSize=8, textColor=colors.HexColor("#1A1F24"),
            backColor=colors.HexColor("#F4F6F8"), leading=10,
            leftIndent=4, rightIndent=4, spaceBefore=4, spaceAfter=8,
        ),
        "toc": ParagraphStyle(
            "toc", parent=base["Normal"], fontName="Helvetica",
            fontSize=9.5, textColor=BRAND, leading=14, spaceAfter=2,
        ),
        "evidence": ParagraphStyle(
            "evidence", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=9, textColor=MUTED, leading=12, spaceAfter=4,
        ),
    }


def safe_para(text: str, style) -> Paragraph:
    try:
        return Paragraph(text, style)
    except Exception:
        return Paragraph(escape_xml(re.sub(r"<[^>]+>", "", text)), style)


def parse_md_to_flowables(md: str, styles) -> list:
    flow: list = []
    lines = md.splitlines()
    i = 0
    in_code = False
    code_buf: list[str] = []
    table_buf: list[str] = []

    def flush_table():
        nonlocal table_buf
        if not table_buf:
            return
        rows = []
        for row in table_buf:
            if re.match(r"^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$", row):
                continue
            cells = [c.strip() for c in row.strip().strip("|").split("|")]
            rows.append([safe_para(inline_md_fixed(c), styles["body"]) for c in cells])
        if rows:
            t = Table(rows, hAlign="LEFT")
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF2")),
                ("TEXTCOLOR", (0, 0), (-1, -1), BRAND),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            flow.append(t)
            flow.append(Spacer(1, 6))
        table_buf = []

    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            if in_code:
                flow.append(Preformatted("\n".join(code_buf) or " ", styles["code"]))
                code_buf = []
                in_code = False
            else:
                flush_table()
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue
        if line.strip().startswith("|") and "|" in line.strip()[1:]:
            table_buf.append(line)
            i += 1
            continue
        flush_table()

        if not line.strip():
            i += 1
            continue
        if line.strip() == "---":
            flow.append(HRFlowable(width="100%", thickness=0.6, color=RULE, spaceBefore=8, spaceAfter=8))
            i += 1
            continue
        m = re.match(r"^(#{1,3})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            key = {1: "h1", 2: "h2", 3: "h3"}[level]
            flow.append(safe_para(inline_md_fixed(m.group(2).strip()), styles[key]))
            i += 1
            continue
        if re.match(r"^[-*]\s+", line) or re.match(r"^\d+\.\s+", line):
            text = re.sub(r"^[-*]\s+", "", line)
            text = re.sub(r"^\d+\.\s+", "", text)
            flow.append(safe_para("• " + inline_md_fixed(text), styles["bullet"]))
            i += 1
            continue
        if line.startswith("> "):
            flow.append(safe_para(inline_md_fixed(line[2:]), styles["evidence"]))
            i += 1
            continue
        para = [line]
        i += 1
        while (
            i < len(lines)
            and lines[i].strip()
            and not lines[i].startswith("#")
            and not lines[i].strip().startswith("|")
            and not lines[i].strip().startswith("```")
            and not re.match(r"^[-*]\s+", lines[i])
            and not re.match(r"^\d+\.\s+", lines[i])
            and lines[i].strip() != "---"
            and not lines[i].startswith("> ")
        ):
            para.append(lines[i])
            i += 1
        flow.append(safe_para(inline_md_fixed(" ".join(p.strip() for p in para)), styles["body"]))
    flush_table()
    if in_code and code_buf:
        flow.append(Preformatted("\n".join(code_buf), styles["code"]))
    return flow


def build_pdf(path: Path, wal: int, part: str, title: str, sources: list[Path], body: str) -> None:
    styles = make_styles()
    page_w, page_h = A4

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, 14 * mm, page_w - 18 * mm, 14 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 9 * mm, f"NexusOS · {part} · WAL-{wal}")
        canvas.drawRightString(page_w - 18 * mm, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"WAL-{wal} {title}",
        author="NexusOS",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=footer)])

    story: list = []
    story.append(Spacer(1, 28 * mm))
    story.append(Paragraph("NexusOS", styles["cover_brand"]))
    story.append(Paragraph("AI Business Operating System", styles["cover_sub"]))
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="60%", thickness=1.2, color=ACCENT, spaceBefore=4, spaceAfter=12, hAlign="CENTER"))
    story.append(Paragraph(escape_xml(part), styles["cover_sub"]))
    story.append(Paragraph(f"Linear Issue WAL-{wal}", styles["cover_sub"]))
    story.append(Paragraph(escape_xml(title), styles["cover_title"]))
    story.append(Spacer(1, 8 * mm))

    meta = [
        ["Project", "NexusOS — AI Business Operating System"],
        ["Part", part],
        ["Linear issue", f"WAL-{wal}"],
        ["Report title", title],
        ["Generated", GEN_DATE],
        ["Purpose", "Standalone Linear attachment (manual upload)"],
        ["Source report(s)", "; ".join(str(p.relative_to(ROOT)) for p in sources)],
    ]
    meta_table = Table(
        [
            [
                Paragraph(f"<b>{escape_xml(a)}</b>", styles["meta"]),
                Paragraph(escape_xml(b), styles["meta"]),
            ]
            for a, b in meta
        ],
        colWidths=[35 * mm, 135 * mm],
    )
    meta_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, RULE),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F6F8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "This PDF is a presentation export of repository engineering report content. "
        "Source report files in the repository were not modified.",
        styles["evidence"],
    ))

    if "Evidence Statement" in body or "retrospective engineering reconstruction" in body:
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph("Evidence Statement", styles["h2"]))
        story.append(Paragraph(
            "This report is a retrospective engineering reconstruction produced after implementation. "
            "Its contents are derived exclusively from repository evidence. "
            "It is not a contemporaneous engineering document. "
            "No engineering events are fabricated. "
            "Where repository evidence is unavailable, that limitation is explicitly documented.",
            styles["evidence"],
        ))

    toc = extract_toc(body)
    if len(toc) >= 4:
        story.append(PageBreak())
        story.append(Paragraph("Table of Contents", styles["h1"]))
        story.append(HRFlowable(width="100%", thickness=0.6, color=ACCENT, spaceBefore=2, spaceAfter=10))
        for level, heading in toc:
            indent = "&nbsp;" * (4 * max(0, level - 1))
            story.append(safe_para(f"{indent}{inline_md_fixed(heading)}", styles["toc"]))

    story.append(PageBreak())
    story.append(Paragraph("Report Content", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.6, color=ACCENT, spaceBefore=2, spaceAfter=10))
    story.append(Paragraph(
        "<i>Content below is copied from the source repository report(s) without alteration.</i>",
        styles["evidence"],
    ))
    story.extend(parse_md_to_flowables(body, styles))
    doc.build(story)


def main() -> None:
    # Clean previous partial exports
    for p in OUT.glob("WAL-*"):
        p.unlink()
    if (OUT / "INDEX.md").exists():
        (OUT / "INDEX.md").unlink()

    index_rows = []
    pdf_count = md_count = 0

    for wal, part, slug, title, sources in MAPPING:
        for s in sources:
            if not s.exists():
                raise FileNotFoundError(s)
        body = load_body(sources)
        base = f"WAL-{wal:02d}-{slug}"
        md_path = OUT / f"{base}.md"
        pdf_path = OUT / f"{base}.pdf"

        md_path.write_text(build_export_markdown(wal, part, title, sources, body))
        md_count += 1
        build_pdf(pdf_path, wal, part, title, sources, body)
        pdf_count += 1
        index_rows.append(
            (
                wal,
                part,
                title,
                base + ".pdf",
                base + ".md",
                "; ".join(str(p.relative_to(ROOT)) for p in sources),
            )
        )
        print(f"OK WAL-{wal:02d} -> {base}.pdf ({pdf_path.stat().st_size // 1024} KB)")

    idx = [
        "# Linear Attachment Export Index",
        "",
        f"Generated: {GEN_DATE}",
        "",
        "Directory: `exports/linear-attachments/`",
        "",
        "| WAL | Part | Title | PDF | Markdown | Source report(s) |",
        "|---|---|---|---|---|---|",
    ]
    for wal, part, title, pdf, md, src in index_rows:
        idx.append(f"| WAL-{wal} | {part} | {title} | `{pdf}` | `{md}` | `{src}` |")
    idx += ["", "## Mapping (WAL → PDF filename)", ""]
    for wal, part, title, pdf, md, src in index_rows:
        idx.append(f"WAL-{wal}")
        idx.append(f"→ `{pdf}`")
        idx.append("")
    (OUT / "INDEX.md").write_text("\n".join(idx) + "\n")

    print("---")
    print("PDFs", pdf_count)
    print("Markdown", md_count)
    print("OUT", OUT)


if __name__ == "__main__":
    main()
