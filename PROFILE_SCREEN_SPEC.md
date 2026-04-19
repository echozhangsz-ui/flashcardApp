# Profile Screen

This document records the current Profile screen structure and keeps a simple base for future account-system expansion.

## Purpose

Profile is the user's personal/settings hub. It shows local learning status, account sign-in state, study preferences, system language, and account security actions.

## Current Layout

### Header

- Avatar icon.
- Display name if signed in.
- Email if signed in.
- Guest learner text if signed out.
- Sign in prompt if signed out.

### Primary Account Action

- When signed out, show a primary `Sign in` button.
- When signed in, this button is hidden.

### Learning Stats

Shows three local counters:

- Decks
- Cards
- Today

These are read from local learning data.

### Learning Preferences

Current rows:

- Daily study goal
  - Opens a modal.
  - Accepts a number from 1 to 200.
  - Saves locally.
  - Study flow uses this value to limit daily study cards.

- System language
  - Opens a language list.
  - Supports the same language set as AI Tutor.
  - Changes app UI language only.
  - Does not change generated text or AI Tutor answer language.

### Security

Current rows:

- Sign in / Sign out
  - Signed-out users go to the sign-in flow.
  - Signed-in users see a confirmation modal before signing out.
  - Signing out clears local current-user state and shows the Sign in button again.

- Change password
  - Signed-in users go to Change password.
  - Signed-out users go to Sign in.

- Delete account
  - Currently shows a protected placeholder dialog.
  - Real deletion still needs a clear confirmation flow after account sync is fully connected.

## Removed Or Hidden For Now

- Account section was removed.
- Data section is hidden for now.
- AI Tutor Settings is not shown here because it has its own AI Tutor settings screen.
- Answer language is not shown here because it belongs to AI Tutor, not Profile.

## Expansion Notes

Future Profile work should keep these boundaries:

- Profile controls app/account settings.
- AI Tutor settings stay inside AI Tutor.
- System language controls UI text only.
- Answer language controls AI-generated explanations and flashcard output.
- Account deletion should not be enabled until backend deletion and sync behavior are clearly defined.

