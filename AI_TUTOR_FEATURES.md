# AI Tutor Feature Notes

## Purpose

AI Tutor helps users turn words, sentences, voice, and images into learning explanations and flashcards.

## Core Flow

- Users can type text, speak, or import text from an image.
- Voice input is transcribed and then sent as user input.
- Image input is recognized as text and filled into the input box for user review before sending.
- AI replies follow the selected answer language.
- For sentences or paragraphs, AI should first provide a complete translation, then explain and analyze.

## Answer Language

- The welcome message asks users which language the tutor should answer in.
- The selected answer language controls AI explanations.
- The selected answer language also controls the back side of generated flashcards.
- Current options: Chinese, English, Spanish, French, German, Portuguese, Japanese, Korean, Arabic, Russian, Hindi, Italian, Bilingual.

## Flashcards

- AI replies can be converted into flashcards.
- Users choose how to generate cards:
  - Save Whole Sentence
  - Extract Key Points
  - AI Decide
- Users choose an existing deck or create a new deck before saving.
- Flashcard front should stay in French.
- Flashcard back should follow the selected answer language.

## AI Tutor Settings

- Settings are opened from the AI Tutor header setting button.
- AI Reply Format controls whether replies include Translation, Explanation, Usage Notes, and Vocabulary.
- Vocabulary Level options are Beginner, Intermediate, Advanced, and All Levels.
- Key Points Extraction controls Extraction Mode and Max Cards.
- Extraction Mode options are Balanced, Vocabulary, Practical Expressions, and Grammar.
- AI Decide controls Detail Level, Sentence Handling, and Skip obvious items.
- These settings should affect both chat replies and flashcard generation prompts.

## Image Input

- Camera and photo library are available from the input bar.
- Recognized text should be inserted directly into the input box.
- Do not auto-send recognized text.
- Do not show a success popup after recognition.

## Voice Input

- Tap once to start recording.
- Tap again to stop.
- Transcribed text is sent into the normal chat flow.

## UX Principles

- Keep the chat flow fast and low-friction.
- Avoid unnecessary popups.
- Let users review generated or recognized content before final actions.
- Prefer clear, practical explanations over long summaries.
