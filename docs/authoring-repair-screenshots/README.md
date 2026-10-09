# Repair screenshots for independent review

Unmodified PNG captures from the passing Chromium authoring regression at application head `7f2a9232fb2c37214dab643b81e0aa9b3ff943b6`. Both contain only the fictional meetup sample.

- [Desktop keyboard repair](desktop-keyboard.png): editor panel at the default desktop viewport, missing booking-code prerequisite checked and focused.
- [320px choice repair](narrow-320px-choice.png): editor panel within a 320px viewport after deleting the booking-code action and kit decision; the missing condition is explicitly displayed, focused and still requires No.

Captured by `tests/authoring.spec.ts` using real browser interactions and element screenshots. No image alterations or synthetic application states. This directory is review evidence only and is not shipped in the Vite build. The draft PR requires independent review before merge.
