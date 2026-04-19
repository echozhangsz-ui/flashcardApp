import fitz  # PyMuPDF
import re
from typing import List, Dict


def parse_flashcards_from_pdf(pdf_path: str) -> List[Dict[str, str]]:
    """
    Parse French-Chinese flashcard PDFs.
    PDF layout per card (two-column header extracted as one block):
        法语
        中文 / 记忆点
        <French word/phrase (may be multi-line)>
        <Chinese translation + notes>
    """
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    doc.close()

    return _extract_cards(full_text)


def _has_chinese(line: str) -> bool:
    return bool(re.search(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]', line))


def _extract_cards(text: str) -> List[Dict[str, str]]:
    cards = []

    # Each card block starts with "法语\n中文 / 记忆点\n"
    separator = re.compile(r'法语\s*\n中文\s*/\s*记忆点\s*\n')
    blocks = separator.split(text)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Remove trailing page marker
        block = re.sub(r'\n?继续\s*$', '', block).strip()

        lines = block.splitlines()
        if not lines:
            continue

        # French lines come first (no Chinese chars), then Chinese lines follow
        french_lines = []
        chinese_lines = []
        in_chinese = False

        for line in lines:
            if not in_chinese and _has_chinese(line):
                in_chinese = True
            if in_chinese:
                chinese_lines.append(line)
            else:
                french_lines.append(line)

        front = " ".join(french_lines).strip()
        back = "\n".join(chinese_lines).strip()

        if front and back:
            cards.append({
                "front": front,
                "back": back,
                "front_lang": "fr",
                "back_lang": "zh",
            })

    return cards
