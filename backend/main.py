import os
import base64
import hashlib
import hmac
import mimetypes
import shutil
import sqlite3
import tempfile
import threading
import time
import urllib.request
import json
import random
import re
import secrets
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from pdf_parser import parse_flashcards_from_pdf

load_dotenv(override=True)

BACKEND_URL_FILE = Path(__file__).parent.parent / "mobile" / "backend_url.txt"
AUTH_DB_PATH = Path(__file__).parent / "flashcard_api.db"
PASSWORD_HASH_ITERATIONS = 210_000


def _get_auth_db():
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s','now'))
        )
        """
    )
    conn.commit()
    return conn


def _hash_password(password: str, salt_hex: Optional[str] = None) -> tuple[str, str]:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return salt.hex(), digest.hex()


def _verify_password(password: str, salt_hex: str, expected_hash: str) -> bool:
    _, password_hash = _hash_password(password, salt_hex)
    return hmac.compare_digest(password_hash, expected_hash)


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    return normalized


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")


def _with_retries(fn, retries: int = 2, base_delay: float = 1.2):
    last_error = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            last_error = e
            if attempt >= retries:
                break
            time.sleep(base_delay * (attempt + 1) + random.uniform(0, 0.4))
    raise last_error


def _bool_label(value: bool) -> str:
    return "enabled" if value else "disabled"


def _open_ngrok_tunnel():
    """Wait for Expo's ngrok agent on port 4040, then add a tunnel for port 8000."""
    for _ in range(60):  # retry for ~120 seconds
        try:
            # Check existing tunnels
            with urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=2) as r:
                data = json.loads(r.read())
            for t in data.get("tunnels", []):
                if "8000" in t.get("config", {}).get("addr", ""):
                    url = t["public_url"].replace("http://", "https://")
                    BACKEND_URL_FILE.write_text(url)
                    print(f"\n[Backend tunnel] {url}\n")
                    return
            # Open new tunnel
            payload = json.dumps({"addr": 8000, "proto": "http", "name": "flashcard-backend"}).encode()
            req = urllib.request.Request(
                "http://localhost:4040/api/tunnels",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as r:
                result = json.loads(r.read())
            url = result["public_url"].replace("http://", "https://")
            BACKEND_URL_FILE.write_text(url)
            print(f"\n[Backend tunnel] {url}\n")
            return
        except Exception:
            time.sleep(2)
    print("[Backend tunnel] Could not connect to ngrok agent")


threading.Thread(target=_open_ngrok_tunnel, daemon=True).start()

app = FastAPI(title="Flashcard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

PRIVACY_POLICY_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Tutor Privacy Policy</title>
  <style>
    body {
      margin: 0;
      background: #f1f7f2;
      color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 20px 64px;
    }
    h1, h2 {
      color: #355343;
      line-height: 1.25;
    }
    h1 {
      font-size: 34px;
      margin-bottom: 8px;
    }
    h2 {
      font-size: 22px;
      margin-top: 34px;
    }
    .updated {
      color: #637083;
      font-weight: 600;
      margin-bottom: 28px;
    }
    a {
      color: #2f855a;
    }
    section {
      background: #ffffff;
      border: 1px solid #d8e2dc;
      border-radius: 12px;
      padding: 18px 20px;
      margin: 18px 0;
    }
    ul {
      padding-left: 22px;
    }
  </style>
</head>
<body>
  <main>
    <h1>AI Tutor Privacy Policy</h1>
    <p class="updated">Last updated: April 20, 2026</p>

    <section>
      <h2>Overview</h2>
      <p>
        This Privacy Policy explains how AI Tutor ("the App", "we", "us", or "our")
        accesses, collects, uses, shares, protects, retains, and deletes information
        when you use the App on Android or iOS.
      </p>
      <p>
        AI Tutor helps users create flashcards, study language material, ask an AI tutor
        questions, import notes, process PDFs, recognize text from images, and transcribe
        audio.
      </p>
    </section>

    <section>
      <h2>Information We Collect or Process</h2>
      <p>Depending on which features you use, the App may collect or process:</p>
      <ul>
        <li>Account information, such as email address, display name, and password credentials.</li>
        <li>Learning content, such as flashcards, deck names, notes, chat prompts, and AI responses.</li>
        <li>Uploaded files or media, such as PDFs, images, and audio recordings that you choose to import.</li>
        <li>Image text and audio transcription results generated from files you provide.</li>
        <li>Technical data, such as server logs, request metadata, device/network information, and error information needed to operate and secure the service.</li>
      </ul>
      <p>
        The App requests access to the camera, photo library, microphone, and files only
        when needed for features you choose to use.
      </p>
    </section>

    <section>
      <h2>How We Use Information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Provide AI tutoring, flashcard generation, text recognition, PDF parsing, and audio transcription features.</li>
        <li>Create and manage your local or service-backed study content.</li>
        <li>Authenticate accounts and protect access to user data.</li>
        <li>Maintain, debug, secure, and improve the App and backend service.</li>
      </ul>
    </section>

    <section>
      <h2>Sharing and Third-Party Service Providers</h2>
      <p>
        We do not sell personal information. We may share or process information with
        service providers only as needed to operate the App, including:
      </p>
      <ul>
        <li>OpenAI, for AI responses, text recognition, flashcard generation, and transcription features.</li>
        <li>Render, for hosting the backend API.</li>
        <li>Apple, Google, or Expo services as required for app distribution, device features, and platform operation.</li>
      </ul>
      <p>
        Content you send to AI-powered features may be transmitted to OpenAI to generate
        responses or outputs. Please avoid submitting information you do not want processed
        by these services.
      </p>
    </section>

    <section>
      <h2>Data Security</h2>
      <p>
        We use HTTPS for communication with the backend service. Passwords are stored using
        salted password hashing. We limit access to operational secrets, such as API keys,
        through server-side environment variables.
      </p>
      <p>
        No method of transmission or storage is perfectly secure, but we take reasonable
        steps to protect the information processed by the App.
      </p>
    </section>

    <section>
      <h2>Data Retention and Deletion</h2>
      <p>
        We retain account and study data for as long as needed to provide the App's features,
        comply with legal obligations, resolve disputes, and maintain security. Temporary
        uploaded files may be processed only for the requested feature and then discarded.
      </p>
      <p>
        You may request deletion of your account or data by using the contact method listed
        below or the support contact listed in the App Store or Google Play listing. We will
        process deletion requests within a reasonable period, unless retention is required
        for legal, security, or fraud-prevention reasons.
      </p>
    </section>

    <section>
      <h2>Children's Privacy</h2>
      <p>
        The App is not intended for children under 13. If you believe a child has provided
        personal information through the App, please contact us so we can take appropriate
        action.
      </p>
    </section>

    <section>
      <h2>Your Choices</h2>
      <p>
        You can choose not to use features that require camera, photo library, microphone,
        or file access. You can also manage device permissions in your operating system
        settings.
      </p>
    </section>

    <section>
      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will update the
        "Last updated" date above. Continued use of the App after changes means the updated
        policy applies.
      </p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Developer: AI Tutor / flashcardApp</p>
      <p>
        For privacy questions, data access, or deletion requests, please contact us through
        the support email listed in the App Store or Google Play listing for AI Tutor.
      </p>
    </section>
  </main>
</body>
</html>
""".strip()

TUTOR_SYSTEM_PROMPT = """
You are a helpful tutor for learning French vocabulary, phrases, and sentences.

When the user asks about a French word, phrase, or sentence:
- follow the user's selected reply format exactly
- include only the sections enabled by the user's settings
- if translation is enabled and the input is a sentence or paragraph, provide a complete translation of the original text instead of a summary
- if a section is disabled, do not include that section heading or equivalent content unless the user explicitly asks for it
- keep the answer concise and practical

When the user explicitly asks to generate or save flashcards:
- still answer normally first
- then append a flashcard JSON block in exactly this format:

[FLASHCARDS]
[{"front": "French word or phrase", "back": "Meaning\\nMemory tip"}]
[/FLASHCARDS]

Rules for flashcard JSON:
- `front` must stay in French
- `back` must follow the currently requested answer language
- keep the wording concise and practical
""".strip()

SYSTEM_PROMPT = """你是一位专业的法语家教，帮助用户学习法语词汇和句子。
用中文回答，解释清晰，举例自然。

当用户询问词汇或句子含义时：
- 给出准确的中文翻译
- 说明用法要点和常见搭配
- 可以举1-2个例句

当用户明确要求"生成闪卡"、"加入卡片库"、"保存为闪卡"等时：
- 正常回复解释内容
- 在回复末尾附加以下格式的JSON块（不要省略，不要修改格式）：

[FLASHCARDS]
[{"front": "法语词/短语", "back": "中文翻译 + 记忆点"}, ...]
[/FLASHCARDS]

JSON中每张卡的 back 字段要包含翻译和简短记忆点，用换行分隔。"""


# ---------- Models ----------

class Card(BaseModel):
    id: Optional[int] = None
    front: str
    back: str
    front_lang: str = "fr"
    back_lang: str = "zh"


class ParseResult(BaseModel):
    deck_name: str
    cards: List[Card]
    count: int


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class TutorSettings(BaseModel):
    reply_translation: bool = True
    reply_explanation: bool = True
    reply_usage_notes: bool = True
    reply_vocabulary: bool = True
    vocabulary_level: str = "Beginner"
    key_points_mode: str = "Balanced"
    key_points_max_cards: int = 3
    ai_decide_detail: str = "Balanced"
    ai_decide_sentence_handling: str = "Let AI choose"
    ai_decide_skip_obvious: bool = True


class ChatRequest(BaseModel):
    messages: List[Message]
    answer_language: Optional[str] = "Chinese"
    tutor_settings: Optional[TutorSettings] = None


class ChatResponse(BaseModel):
    reply: str
    flashcards: Optional[List[Card]] = None


class GenerateFlashcardsRequest(BaseModel):
    user_text: str
    assistant_reply: str
    mode: str  # "sentence" | "keywords" | "auto"
    answer_language: Optional[str] = "Chinese"
    tutor_settings: Optional[TutorSettings] = None


class GenerateDeckFromNotesRequest(BaseModel):
    notes: str
    source: Optional[str] = "notes"
    answer_language: Optional[str] = "Chinese"


class GenerateFlashcardsResponse(BaseModel):
    flashcards: List[Card]


class ImageTextResponse(BaseModel):
    text: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    email: str
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: Optional[str] = None
    created_at: int


def _build_reply_settings_instruction(settings: Optional[TutorSettings]) -> str:
    settings = settings or TutorSettings()
    sections = []
    disabled_sections = []
    if settings.reply_translation:
        sections.append("Translation: include a complete translation first for sentences or paragraphs.")
    else:
        disabled_sections.append("Translation")
        sections.append("Translation: do not include a dedicated translation section unless the user explicitly asks.")

    if settings.reply_explanation:
        sections.append("Explanation: include meaning and context.")
    else:
        disabled_sections.append("Explanation")
        sections.append("Explanation: do not include an Explanation section or a meaning/context explanation unless the user explicitly asks.")

    if settings.reply_usage_notes:
        sections.append("Usage Notes: include usage, collocations, tone, or natural phrasing when helpful.")
    else:
        disabled_sections.append("Usage Notes")
        sections.append("Usage Notes: omit a dedicated usage notes section.")

    if settings.reply_vocabulary:
        sections.append(
            f"Vocabulary: include useful words or phrases appropriate for {settings.vocabulary_level} level. "
            "For French, Beginner roughly means A1-A2, Intermediate B1-B2, Advanced C1-C2."
        )
    else:
        disabled_sections.append("Vocabulary")
        sections.append("Vocabulary: omit a dedicated vocabulary list.")

    disabled_note = ""
    if disabled_sections:
        disabled_note = (
            "\nDisabled sections: "
            + ", ".join(disabled_sections)
            + ". Do not use these headings or recreate these sections under another name."
        )

    return "User-selected reply format:\n- " + "\n- ".join(sections) + disabled_note


def _build_flashcard_settings_instruction(mode: str, settings: Optional[TutorSettings]) -> str:
    settings = settings or TutorSettings()
    if mode == "keywords":
        return f"""
User-selected Key Points Extraction settings:
- Extraction mode: {settings.key_points_mode}
- Maximum cards: create no more than {settings.key_points_max_cards} card(s).
- Balanced means choose the most useful mix of vocabulary, phrases, collocations, and grammar.
- Vocabulary means prioritize new words and short phrases.
- Practical Expressions means prioritize natural phrases, collocations, and idiomatic usage.
- Grammar means prioritize reusable grammar patterns.
- Follow the selected extraction mode more strongly than the general explanation content.
""".strip()

    detail_rules = {
        "Minimal": "Create only 1 card unless there are clearly multiple essential learning points.",
        "Balanced": "Create 1 to 3 practical cards.",
        "Detailed": "Create more cards only when the input has several valuable learning points, but keep them concise.",
    }
    sentence_rules = {
        "Let AI choose": "Choose whole-sentence or key-point cards based on what best helps learning.",
        "Prefer whole sentence": "Prefer one card that keeps the full sentence or phrase intact.",
        "Prefer key points": "Prefer separate cards for useful vocabulary, phrases, or grammar patterns.",
    }
    obvious_rule = (
        "Skip cards for very obvious or already-basic items."
        if settings.ai_decide_skip_obvious
        else "It is allowed to include basic cards if they are useful for the learner."
    )

    if mode == "auto":
        return f"""
User-selected AI Decide settings:
- Detail level: {settings.ai_decide_detail}
- Sentence handling: {settings.ai_decide_sentence_handling}
- Skip obvious items: {_bool_label(settings.ai_decide_skip_obvious)}
- Detail rule: {detail_rules.get(settings.ai_decide_detail, detail_rules["Balanced"])}
- Sentence rule: {sentence_rules.get(settings.ai_decide_sentence_handling, sentence_rules["Let AI choose"])}
- Obvious-item rule: {obvious_rule}
""".strip()

    return "User selected Save Whole Sentence: create one practical whole-sentence flashcard."


# ---------- Routes ----------

@app.get("/", include_in_schema=False)
def root():
    return {
        "name": "AI Tutor API",
        "status": "ok",
        "docs": "/docs",
        "privacy_policy": "/privacy",
    }


@app.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy():
    return PRIVACY_POLICY_HTML


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=UserResponse)
def register(req: RegisterRequest):
    email = _normalize_email(req.email)
    password = req.password.strip()
    _validate_password(password)
    display_name = (req.display_name or "").strip() or None
    salt_hex, password_hash = _hash_password(password)

    conn = _get_auth_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO users (email, display_name, password_salt, password_hash)
            VALUES (?, ?, ?, ?)
            """,
            (email, display_name, salt_hex, password_hash),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, email, display_name, created_at FROM users WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    finally:
        conn.close()

    return UserResponse(**dict(row))


@app.post("/auth/login", response_model=UserResponse)
def login(req: LoginRequest):
    email = _normalize_email(req.email)
    password = req.password.strip()
    if not password:
        raise HTTPException(status_code=400, detail="Please enter your password.")

    conn = _get_auth_db()
    try:
        row = conn.execute(
            """
            SELECT id, email, display_name, password_salt, password_hash, created_at
            FROM users
            WHERE lower(email) = lower(?)
            """,
            (email,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Account does not exist.")
        if not _verify_password(password, row["password_salt"], row["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect password.")

        display_name = (req.display_name or "").strip()
        if display_name and display_name != (row["display_name"] or ""):
            conn.execute("UPDATE users SET display_name = ? WHERE id = ?", (display_name, row["id"]))
            conn.commit()
            row = conn.execute(
                "SELECT id, email, display_name, created_at FROM users WHERE id = ?",
                (row["id"],),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, email, display_name, created_at FROM users WHERE id = ?",
                (row["id"],),
            ).fetchone()
    finally:
        conn.close()

    return UserResponse(**dict(row))


@app.post("/auth/change-password")
def change_password(req: ChangePasswordRequest):
    email = _normalize_email(req.email)
    current_password = req.current_password.strip()
    new_password = req.new_password.strip()
    if not current_password:
        raise HTTPException(status_code=400, detail="Please enter your current password.")
    _validate_password(new_password)

    conn = _get_auth_db()
    try:
        row = conn.execute(
            """
            SELECT id, password_salt, password_hash
            FROM users
            WHERE lower(email) = lower(?)
            """,
            (email,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Account does not exist.")
        if not _verify_password(current_password, row["password_salt"], row["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect.")

        salt_hex, password_hash = _hash_password(new_password)
        conn.execute(
            "UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?",
            (salt_hex, password_hash, row["id"]),
        )
        conn.commit()
    finally:
        conn.close()

    return {"status": "ok"}


@app.post("/parse-pdf", response_model=ParseResult)
async def parse_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        cards_data = parse_flashcards_from_pdf(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    if not cards_data:
        raise HTTPException(
            status_code=422,
            detail="No flashcards detected. Make sure the PDF follows the expected format."
        )

    deck_name = os.path.splitext(file.filename)[0]
    return ParseResult(deck_name=deck_name, cards=[Card(**c) for c in cards_data], count=len(cards_data))


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not openai_client.api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")

    answer_language = req.answer_language or "Chinese"
    language_instruction_map = {
        "Chinese": "Use Chinese for the full translation, all section headings, explanations, examples, and notes.",
        "English": "Use English for the full translation, all section headings, explanations, examples, and notes.",
        "Spanish": "Use Spanish for the full translation, all section headings, explanations, examples, and notes.",
        "French": "Use French for the full translation, all section headings, explanations, examples, and notes.",
        "German": "Use German for the full translation, all section headings, explanations, examples, and notes.",
        "Portuguese": "Use Portuguese for the full translation, all section headings, explanations, examples, and notes.",
        "Japanese": "Use Japanese for the full translation, all section headings, explanations, examples, and notes.",
        "Korean": "Use Korean for the full translation, all section headings, explanations, examples, and notes.",
        "Arabic": "Use Arabic for the full translation, all section headings, explanations, examples, and notes.",
        "Russian": "Use Russian for the full translation, all section headings, explanations, examples, and notes.",
        "Hindi": "Use Hindi for the full translation, all section headings, explanations, examples, and notes.",
        "Italian": "Use Italian for the full translation, all section headings, explanations, examples, and notes.",
        "Bilingual": "Use Chinese and English throughout. Give the full translation in both Chinese and English, and keep all headings, explanations, examples, and notes bilingual too.",
    }
    language_instruction = language_instruction_map.get(answer_language, "Use Chinese for the full translation, all section headings, explanations, examples, and notes.")

    reply_settings_instruction = _build_reply_settings_instruction(req.tutor_settings)
    messages = [{"role": "system", "content": f"{TUTOR_SYSTEM_PROMPT}\n\n{language_instruction}\n\n{reply_settings_instruction}"}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        response = _with_retries(
            lambda: openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    full_reply = response.choices[0].message.content

    # Extract flashcards if present
    flashcards = None
    if "[FLASHCARDS]" in full_reply and "[/FLASHCARDS]" in full_reply:
        import json, re
        match = re.search(r'\[FLASHCARDS\](.*?)\[/FLASHCARDS\]', full_reply, re.DOTALL)
        if match:
            try:
                cards_data = json.loads(match.group(1).strip())
                flashcards = [Card(front=c["front"], back=c["back"]) for c in cards_data]
            except Exception:
                pass
        # Remove the JSON block from the visible reply
        full_reply = re.sub(r'\n?\[FLASHCARDS\].*?\[/FLASHCARDS\]', '', full_reply, flags=re.DOTALL).strip()

    return ChatResponse(reply=full_reply, flashcards=flashcards)


@app.post("/generate-flashcards", response_model=GenerateFlashcardsResponse)
async def generate_flashcards(req: GenerateFlashcardsRequest):
    if not openai_client.api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")

    settings = req.tutor_settings or TutorSettings()
    mode_instructions = {
        "sentence": "Create exactly 1 flashcard based on the whole French word, phrase, or sentence.",
        "keywords": f"Extract important learning points and create up to {settings.key_points_max_cards} flashcards. Follow the user's Key Points settings.",
        "auto": "Choose the most useful output for learning. Follow the user's AI Decide settings.",
    }

    instruction = mode_instructions.get(req.mode)
    if not instruction:
        raise HTTPException(status_code=400, detail="Unsupported flashcard mode.")

    answer_language = req.answer_language or "Chinese"
    back_language_rules = {
        "Chinese": "Back must be in Chinese only.",
        "English": "Back must be in English only.",
        "Spanish": "Back must be in Spanish only.",
        "French": "Back must be in French only.",
        "German": "Back must be in German only.",
        "Portuguese": "Back must be in Portuguese only.",
        "Japanese": "Back must be in Japanese only.",
        "Korean": "Back must be in Korean only.",
        "Arabic": "Back must be in Arabic only.",
        "Russian": "Back must be in Russian only.",
        "Hindi": "Back must be in Hindi only.",
        "Italian": "Back must be in Italian only.",
        "Bilingual": "Back must include both Chinese and English.",
    }
    back_language_rule = back_language_rules.get(answer_language, "Back must be in Chinese only.")
    flashcard_settings_instruction = _build_flashcard_settings_instruction(req.mode, settings)

    prompt = f"""
You are helping create French learning flashcards for a Chinese-speaking learner.

User asked about:
{req.user_text}

Tutor explanation:
{req.assistant_reply}

Task:
{instruction}

{flashcard_settings_instruction}

Return JSON only.
Format:
[
  {{
    "front": "French word, phrase, or sentence",
    "back": "Chinese meaning\\nMemory tip or usage note"
  }}
]

Rules:
- Front must stay in French.
- {back_language_rule}
- Back should contain a translation on the first line and a short memory tip or usage note on the second line.
- Keep cards concise and practical.
- Do not return markdown or extra explanation.
""".strip()

    try:
        response = _with_retries(
            lambda: openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
        )
        content = (response.choices[0].message.content or "").strip()
        cards_data = json.loads(content)
        flashcards = [Card(front=c["front"], back=c["back"]) for c in cards_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcard generation failed: {str(e)}")

    if not flashcards:
        raise HTTPException(status_code=422, detail="No flashcards were generated.")

    return GenerateFlashcardsResponse(flashcards=flashcards)


@app.post("/generate-deck-from-notes", response_model=ParseResult)
async def generate_deck_from_notes(req: GenerateDeckFromNotesRequest):
    if not openai_client.api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")

    notes = req.notes.strip()
    if len(notes) < 10:
        raise HTTPException(status_code=400, detail="Please provide more notes before generating a deck.")

    source = (req.source or "notes").strip()
    answer_language = (req.answer_language or "Chinese").strip()
    prompt = f"""
Create a flashcard deck from these learning notes.

Source type: {source}
Flashcard back language: {answer_language}

Notes:
{notes}

Return JSON only in this exact shape:
{{
  "deck_name": "short useful deck name",
  "cards": [
    {{"front": "question, term, phrase, or prompt", "back": "answer, explanation, or memory note"}}
  ]
}}

Rules:
- Cover the important ideas from the notes.
- Prefer 8 to 20 cards, but use fewer if the notes are short.
- Keep each card concise and practical.
- If the notes include French vocabulary, keep the front in French.
- Write the card back in {answer_language}. If the language is Bilingual, include both Chinese and English.
- Do not return markdown or extra explanation.
""".strip()

    try:
        response = _with_retries(
            lambda: openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.25,
            )
        )
        content = (response.choices[0].message.content or "").strip()
        data = json.loads(content)
        cards = [Card(front=c["front"], back=c["back"]) for c in data.get("cards", [])]
        deck_name = str(data.get("deck_name") or f"Imported {source.title()}").strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deck generation failed: {str(e)}")

    if not cards:
        raise HTTPException(status_code=422, detail="No flashcards were generated.")

    return ParseResult(deck_name=deck_name[:80], cards=cards, count=len(cards))


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not openai_client.api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")

    ext = os.path.splitext(file.filename or "audio.m4a")[1] or ".m4a"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = _with_retries(lambda: openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                # No language specified — Whisper auto-detects Chinese/French
            ))
        return {"text": transcript.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


@app.post("/recognize-image-text", response_model=ImageTextResponse)
async def recognize_image_text(file: UploadFile = File(...)):
    if not openai_client.api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    suffix = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as image_file:
            encoded = base64.b64encode(image_file.read()).decode("utf-8")

        mime_type = content_type or mimetypes.guess_type(tmp_path)[0] or "image/jpeg"
        data_url = f"data:{mime_type};base64,{encoded}"

        response = _with_retries(
            lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract the main readable text from this image for a language-learning chat input. "
                                "Return plain text only. Preserve line breaks when helpful. "
                                "Do not explain the image. If there is almost no readable text, return a short best-effort transcription."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url, "detail": "low"},
                        },
                    ],
                }
            ],
            temperature=0,
            )
        )

        text = (response.choices[0].message.content or "").strip()
        if not text:
            raise HTTPException(status_code=422, detail="No readable text detected in the image.")

        return ImageTextResponse(text=text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image recognition failed: {str(e)}")
    finally:
        os.unlink(tmp_path)
