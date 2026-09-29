# AGENTS.md - Enflite Help

The Enflite help library: React client (`client/`), Node.js / Express API with MongoDB
(`server/`), content as JSON (`content/`). See `README.md` for running it and
`content/README.md` for the content format.

## Rules

1. **Content lives in `content/`, in git.** MongoDB is loaded from it (`npm run seed`) and is not
   edited by hand. Change the JSON, run `npm run check`, commit.
2. **Write what the system actually does**, as confirmed by the team, not plans. For SyteLine forms
   the form repo (e.g. `Enflite/eCMRs`) says what is live; keep the help in step with it.
3. **One component opens one page**: every form component a field uses (field, label, grid column)
   goes in that page's `aliases`, so right-click → Help lands on it.
4. **Company private**: procedures and documents stay internal. No public hosting.
5. **Brand**: Enflite style guide (`Enflite/Form-Project-Templates` `branding/enflite-style-guide.md`):
   Enflite Red `#CF0C2C`, Ink `#1A1A1A`; black/white with red used sparingly; no cards, no shadows;
   light display type; square bullets; thin rules. Styles are in `client/src/styles.css`.
6. **Before every commit**: `npm run check`, `npm test` (with a MongoDB running), `npm run build`.
7. **Git**: work on the branch you were given, never push to `main`; changes reach `main` through a
   pull request reviewed by a person. One logical change per commit, imperative subject.

## Writing style

Plain, short sentences for the people using the system. **Bold** screen names, buttons and field
labels. Steps numbered when order matters. Tables over prose for lists of fields or checks.
