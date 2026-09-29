# Enflite Help

Enflite's help library: how-to, field definitions and procedures for the systems we use, in the
Enflite brand style. It starts with **SyteLine** (the **eCMRs** form, its 55 fields and the two
procedures updated for it); other systems are added as new *spaces*.

- **React** client (Vite) in `client/`: the SyteLine help-library layout (toolbar, navigation
  tree, topic pages, search).
- **Node.js / Express** API in `server/`, with **MongoDB** (Mongoose) holding the pages.
- **Content** in `content/` as JSON, in git; `npm run seed` loads it into MongoDB.
- **Right-click → Help** from a SyteLine form: `/go/<space>/<form>/<component>` opens that field's
  page (e.g. `/go/syteline/ecmrs/c_item` → `/syteline/ecmrs/fields/item`).

## Run it

Needs Node.js 20+ and a MongoDB (local, Docker, or a server: set `MONGODB_URI`).

```sh
npm install
docker run -d --name help-mongo -p 27017:27017 mongo:7   # if you have no MongoDB
npm run seed        # load content/ into MongoDB
npm run dev         # API on :3000, client on :5173 (proxies /api, /go, /files to :3000)
```

Production-style, one process: `npm run build && npm start` (Express serves `client/dist` on
`PORT`, default 3000).

Everything in Docker: `docker compose up --build` (MongoDB + the app on http://localhost:3000; the
app seeds the content on start).

| Variable | Default |
|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/enflite-help` |
| `PORT` | `3000` |
| `CONTENT_DIR`, `CLIENT_DIST` | `content/`, `client/dist/` |

## Check and test

```sh
npm run check       # content/ is valid (no database needed)
npm test            # content checks + API tests (API tests use MONGODB_URI_TEST, default
                    # mongodb://127.0.0.1:27017/enflite-help-test; skipped if no MongoDB)
npm run build       # client builds
```

## Add or change help

Edit the JSON in `content/` (format: [`content/README.md`](content/README.md)), run
`npm run check`, commit, and seed (or redeploy the Docker image).

## Hosting and SyteLine

SyteLine runs in the browser over `https`, and browsers won't open `file:` links from it (SyteLine
shows its `GetFile.aspx` "copy the file path" page instead). So the help has to be served from an
`https://` address on the company network, e.g. an internal server running
`docker compose up -d` behind the company's HTTPS (IIS / reverse proxy). The procedures are company
private: keep it internal (no public hosting). There is no login yet.

When it has an address, the SyteLine forms point their right-click Help at
`https://<address>/go/syteline/<form>/<component>` (for eCMRs: `HELP_BUTTON_URL` and the
`StdFormComponentHelp` script in `Enflite/eCMRs` `tools/apply_form_changes.py`).

## Layout

| Path | What |
|---|---|
| `client/` | React app: `src/components/` (Layout, Sidebar, Blocks, Rich text, Flowchart), `src/pages/`, `src/styles.css` (brand), `public/` (logo, icons) |
| `server/src/` | `app.js` (routes), `models/` (Space, Topic), `content.js` (load + check content), `seed.js`, `config.js`, `index.js` |
| `server/scripts/seed.js` | `npm run seed` / `npm run check` |
| `scripts/dev.mjs` | `npm run dev`: starts the API and the client together (works on Windows too) |
| `server/test/` | `node --test` tests |
| `content/` | Help content (JSON) and `files/` (PDFs) - see its README |
| `Dockerfile`, `docker-compose.yml` | Build and run with MongoDB |
| `AGENTS.md` / `CLAUDE.md` | Rules for working in this repo |

## API

| Route | Returns |
|---|---|
| `GET /api/health` | `{ ok, db }` |
| `GET /api/spaces` | All spaces |
| `GET /api/spaces/:space` | A space with its navigation (`nav`) |
| `GET /api/spaces/:space/topics/:path*` | A page, its `children` and `refs` (titles of linked pages) |
| `GET /api/search?q=&space=` | Up to 25 matching pages |
| `GET /go/:space/:form/:component?` | Redirect for right-click → Help |
| `GET /files/...` | Documents from `content/files/` |
