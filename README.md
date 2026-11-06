# Exam Retake Prep — CHEM 3A (private link for Dr. Dan's students)

Practice for the CHEM 3A exam retake, in the same format as the real exams: free response, show-your-work, fill-in tables and interactive drawings.

- **Mock Exam**: Exam 1 mirrors the 2026 paper exam question-for-question (26 questions, 100 pts); Exam 2 follows the Exam 2 study guide (28 questions, 100 pts). Every question regenerates with new numbers, elements and compounds, so nothing is a copy of a real exam.
- **Train**: pick one or more topics (chips) and practice one question at a time with hints, step-by-step solutions and mistake catchers. Mixes in questions from the shared [question bank](https://itsdrdan.github.io/questionbank/) (a snapshot is built in; more load live when online).
- **Weak Spots**: what the student keeps missing, with a button to train it.

Not listed on the study hub or in the FCC-Chem/tools catalog on purpose (no `meta.json`, `noindex`). Share the link through Canvas.

Single file: `index.html` (no build step). Art made in ChatGPT goes in `assets/` (see `ASSETS.md`); until a file exists the built-in icon shows. Loads the shared brand kit from `itsdrdan.github.io/games/brand/` and logs anonymous practice stats through `track.js` as game `retakeprep`.

Game design and chemistry by ItsDrDan. AI (Claude by Anthropic) helped write the code.

## Retake sign-up

`signup.html` is the retake sign-up form (name, email, lab section, Exam 1 or 2, a day from Mon/Wed/Fri office hours Nov 16 – Dec 4, or a finals-week request). Sign-ups save to a Google Sheet through the Apps Script in `signup-apps-script.gs`; paste its web app URL into `CONFIG.scriptUrl` at the top of `signup.html`.
