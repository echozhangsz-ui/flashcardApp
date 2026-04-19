# Deck And Card Rules

Simple reference for the current deck creation and card creation behavior.

## Deck Library

- The Card Library shows all decks, newest first.
- Each deck displays its name and card count.
- Tap a deck to enter the deck page.
- Long press a deck to delete it.
- Deleting a deck also deletes all cards inside it.
- Tap `+ Deck` to start creating a new deck.

## Create A Blank Deck

- User enters a deck name.
- Empty deck names are not allowed.
- After creation, the user can immediately add cards to that deck.
- A new blank deck starts with zero cards.

## Create Cards Manually

- Manual cards belong to one selected deck.
- A card has a front side and a back side.
- Front side cannot be empty.
- Back side cannot be empty.
- Text or image can make a side non-empty.
- User can add an image to either side.
- User can use bold or underline on either side.
- User can use voice input to fill the active side.
- After saving, the card form resets for the next card.

## Import A Deck

- User can generate a deck from PDF, recording, audio file, photos, or pasted notes.
- PDF import reads flashcards from the PDF and uses the PDF filename as the deck name.
- Recording and audio are transcribed first, then the user generates flashcards from the transcript.
- Photos are recognized into editable text first, then the user generates a deck.
- Pasted notes are used directly to generate a deck.
- Generated decks use an AI-created short deck name.
- Generated decks usually create 8 to 20 cards, fewer if the content is short.
- The card back uses the selected answer language.

## AI Tutor To Flashcards

- Flashcards can be generated from an AI Tutor reply.
- The original user text must exist; otherwise generation is blocked.
- User chooses one mode:
  - `Save Whole Sentence`: create one card from the full input.
  - `Extract Key Points`: create cards from important learning points.
  - `AI Decide`: let AI choose the most useful cards.
- User then chooses an existing deck or creates a new deck.
- Saved cards can be studied immediately or the user can keep chatting.

## Card Content Rules

- Card front is the learning prompt, word, phrase, sentence, or question.
- Card back is the answer, translation, explanation, or memory note.
- For French vocabulary, the front should stay in French.
- Card backs should be concise and practical.
- AI Tutor generated card backs should include a translation first, then a short memory tip or usage note.

## Study Rules

- Deck page shows all cards in that deck.
- `+ Card` adds a new card to the current deck.
- Study mode flips between front and back.
- User can mark bond level while studying.
- Empty decks show a direct `Create Card` action.

## Default Storage Rules

- Decks are stored locally in the app database.
- Cards are stored locally and linked to one deck.
- Default study count per deck is 20 cards per day.
- Default card language tags are front `fr` and back `zh`.
