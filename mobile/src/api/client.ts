import Constants from 'expo-constants';
import { TutorSettings } from '../db/database';

// API_BASE is injected at Expo startup via app.config.js reading backend_url.txt
export const API_BASE =
  (Constants.expoConfig?.extra?.apiBase as string | null) ?? 'http://localhost:8000';

console.log('[API] Base URL:', API_BASE);

export interface CardData {
  front: string;
  back: string;
  front_lang: string;
  back_lang: string;
}

export interface ParseResult {
  deck_name: string;
  cards: CardData[];
  count: number;
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
  front_lang?: string;
  back_lang?: string;
}

export interface RegisteredUser {
  id: number;
  email: string;
  display_name?: string | null;
  created_at: number;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type AnswerLanguage =
  | "Chinese"
  | "English"
  | "Spanish"
  | "French"
  | "German"
  | "Portuguese"
  | "Japanese"
  | "Korean"
  | "Arabic"
  | "Russian"
  | "Hindi"
  | "Italian"
  | "Bilingual";

export async function parsePdf(fileUri: string, fileName: string): Promise<ParseResult> {
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: fileName, type: 'application/pdf' } as any);

  const response = await fetch(`${API_BASE}/parse-pdf`, { method: 'POST', body: formData });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(err.detail ?? `Server error ${response.status}`, response.status);
  }

  return response.json();
}

export async function transcribeAudio(fileUri: string, fileName: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: fileName, type: mimeType } as any);

  const response = await fetch(`${API_BASE}/transcribe`, { method: 'POST', body: formData });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Server error ${response.status}`);
  }

  const data = await response.json();
  return data.text ?? "";
}

export async function generateDeckFromNotes(notes: string, source: string, answerLanguage = "Chinese"): Promise<ParseResult> {
  const response = await fetch(`${API_BASE}/generate-deck-from-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes, source, answer_language: answerLanguage }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Server error ${response.status}`);
  }

  return response.json();
}

export async function generateFlashcards(
  userText: string,
  assistantReply: string,
  mode: "sentence" | "keywords" | "auto",
  answerLanguage: AnswerLanguage,
  tutorSettings?: TutorSettings
): Promise<GeneratedFlashcard[]> {
  const response = await fetch(`${API_BASE}/generate-flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_text: userText,
      assistant_reply: assistantReply,
      mode,
      answer_language: answerLanguage,
      tutor_settings: tutorSettings,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Server error ${response.status}`);
  }

  const data = await response.json();
  return data.flashcards ?? [];
}

export async function recognizeImageText(imageUri: string, fileName: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", { uri: imageUri, name: fileName, type: mimeType } as any);

  const response = await fetch(`${API_BASE}/recognize-image-text`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Server error ${response.status}`);
  }

  const data = await response.json();
  return data.text ?? "";
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<RegisteredUser> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      display_name: displayName?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Server error ${response.status}`);
  }

  return response.json();
}

export async function loginWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<RegisteredUser> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      display_name: displayName?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(err.detail ?? `Server error ${response.status}`, response.status);
  }

  return response.json();
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(err.detail ?? `Server error ${response.status}`, response.status);
  }
}

// Keep for backwards compatibility (no-op now)
export async function initApiBase(): Promise<void> {}
