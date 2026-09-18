#!/usr/bin/env python3
"""Convert the drafted markdown guide into a pdf_create.py JSON spec."""
import json
import re

MD_PATH = "guide_content.md"
SPEC_PATH = "guide_spec.json"


def md_inline_to_reportlab(text):
    # bold **x** -> <b>x</b>, italic *x* -> <i>x</i>
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<i>\1</i>", text)
    text = text.replace("&", "&amp;").replace("<b>", "\x01B\x01").replace("</b>", "\x02B\x02")
    text = text.replace("<i>", "\x01I\x01").replace("</i>", "\x02I\x02")
    text = text.replace("<", "&lt;").replace(">", "&gt;")
    text = text.replace("\x01B\x01", "<b>").replace("\x02B\x02", "</b>")
    text = text.replace("\x01I\x01", "<i>").replace("\x02I\x02", "</i>")
    return text


def parse(md_text):
    elements = []
    lines = md_text.split("\n")
    i = 0
    in_code = False
    code_buf = []
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_buf = []
            else:
                in_code = False
                code_text = "\n".join(code_buf)
                elements.append({"type": "paragraph", "text": "<font face='Courier' size=9>" + md_inline_to_reportlab(code_text).replace("\n", "<br/>") + "</font>"})
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if stripped == "" or stripped == "---":
            i += 1
            continue

        m = re.match(r"^(#{1,3})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = md_inline_to_reportlab(m.group(2))
            elements.append({"type": "heading", "level": level, "text": text})
            i += 1
            continue

        if stripped.startswith("- ") or stripped.startswith("* "):
            item = md_inline_to_reportlab(stripped[2:].strip())
            elements.append({"type": "paragraph", "text": "&bull;&nbsp;&nbsp;" + item})
            i += 1
            continue

        if re.match(r"^\d+\.\s", stripped):
            item = md_inline_to_reportlab(re.sub(r"^\d+\.\s", "", stripped))
            elements.append({"type": "paragraph", "text": item})
            i += 1
            continue

        if stripped.startswith("*") and stripped.endswith("*") and not stripped.startswith("**"):
            text = md_inline_to_reportlab(stripped)
            elements.append({"type": "paragraph", "text": "<i>" + text.replace("<i>", "").replace("</i>", "") + "</i>"})
            i += 1
            continue

        # plain paragraph (collect until blank line)
        para_lines = [stripped]
        j = i + 1
        while j < len(lines) and lines[j].strip() != "" and not lines[j].strip().startswith("#") and lines[j].strip() != "---" and not lines[j].strip().startswith("- ") and not lines[j].strip().startswith("```"):
            para_lines.append(lines[j].strip())
            j += 1
        text = md_inline_to_reportlab(" ".join(para_lines))
        elements.append({"type": "paragraph", "text": text})
        i = j

    return elements


def main():
    with open(MD_PATH, "r", encoding="utf-8") as f:
        md_text = f.read()
    elements = parse(md_text)
    spec = {
        "title": "The Complete Home Network Starter Stack",
        "author": "Woodley Brothers Networks",
        "page_size": "letter",
        "elements": elements,
    }
    with open(SPEC_PATH, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2)
    print(f"wrote {SPEC_PATH} with {len(elements)} elements")


if __name__ == "__main__":
    main()
