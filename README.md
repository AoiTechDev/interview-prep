# Interview Drills

`drills.html` — one file. Double-click it. No install, no server, no build.

Add questions, write your own answers, mark what you can already explain, and
quiz yourself with a flashcard drill.

## Where your data lives

Two layers:

1. **This browser** — every change is saved to `localStorage` automatically.
   Survives closing the tab and restarting the computer. Nothing to click.
2. **A real JSON file** — click **"Save to a JSON file…"** in the bar near the
   top, pick a location (e.g. `drills-db.json` next to the HTML), and from then
   on every change is also written straight into that file. Move it, back it up,
   commit it, edit it by hand.

The bar always tells you which of these is active. Layer 2 uses the File System
Access API, which Chrome and Edge support and Firefox and Safari do not — if
your browser can't do it, the bar says so and **Download JSON** / **Import JSON**
do the same job manually.

Chrome forgets file permission when you close it, so on the first visit of a
session the bar shows **"Reconnect file"** — one click and it's live again.

## What you can do

| Action | How |
| --- | --- |
| Mark a question reviewed | Click its checkbox |
| Write / edit an answer | Click the question, type — it saves as you go |
| Edit the question wording | Same panel, top field |
| Star a question | Star icon on the row |
| Add a question | "+ Add a question to …" at the bottom of any category |
| Add a category | "+ Category" in the toolbar |
| Rename a category | Double-click its title |
| Move a question | Category dropdown in the answer panel |
| Delete | Trash icon on the row or the category header |
| Quiz yourself | "Drill me" — shuffles whatever is currently filtered |
| Filter | All / To review / Reviewed / Starred / No answer |
| Search | Searches question text *and* your answers |
| Light / dark | "Theme" cycles system → light → dark |

Keyboard: `/` focuses search, `d` starts a drill. In a drill, `Space` reveals the
answer then marks it reviewed and moves on, `→` skips, `Esc` closes.

## The data shape

```jsonc
{
  "version": 1,
  "categories": [
    { "id": "c_ab12…", "code": "JS", "title": "JavaScript & ES6+", "order": 0 }
  ],
  "questions": [
    {
      "id": "q_cd34…",
      "categoryId": "c_ab12…",   // must match a category id
      "text": "What is the event loop?",
      "answer": "",               // your notes, free text
      "status": "todo",           // "todo" | "reviewed"
      "starred": false,
      "order": 2,
      "createdAt": "…", "updatedAt": "…", "reviewedAt": null
    }
  ]
}
```

Anything malformed is dropped on load rather than crashing the page, so a
hand-edited file is safe to try.
"# interview-prep" 
