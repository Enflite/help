# Enflite Help

Enflite's help library: how-to, field definitions and procedures for the systems we use, in the
Enflite brand style. It starts with **SyteLine**: the **eCMRs** form (55 fields), the Enflite
fields on **Service Orders** and **Incidents**, and the two procedures updated for eCMRs. Other
systems are added as new *spaces*.

- **React** client (Vite) in `client/`: the SyteLine help-library layout (toolbar, navigation
  tree, topic pages, search).
- **Node.js / Express** API in `server/`, with **MongoDB** (Mongoose) holding the pages.
- **Content** in `content/` as JSON, in git; `npm run seed` loads it into MongoDB.
- **Right-click → Help** from a SyteLine form: `/go/<space>/<form>/<component>` opens that field's
  page (e.g. `/go/syteline/ecmrs/c_item` → `/syteline/ecmrs/fields/item`).

## Run it

Needs Node.js 20.12+ and a MongoDB (local, Docker, or a server such as Atlas: set `MONGODB_URI`).
Put your settings in `.env` in the repo root (copy [`.env.example`](.env.example)); `npm run dev`,
`npm start` and `npm run seed` read it. A variable already set in the shell wins over the file.

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
| `AI_API_URL` | (unset: AI chat disabled) |
| `AI_SERVICE_EMAIL`, `AI_SERVICE_PASSWORD` | (unset: AI chat disabled) |

## AI assistant

Every page has an **Ask Enflite AI** button (bottom right) that opens a chat with the Enflite AI.
The help server proxies to the company's backend-ai API (`server/src/aiClient.js`,
`server/src/aiRoutes.js`): the browser never sees the backend-ai credentials, all AI traffic stays
server-side. When the three `AI_*` variables are not all set, the button is hidden entirely.

- **Anonymous sessions.** Each browser gets a random session key (in localStorage) that the server
  maps to one upstream conversation (`AiSession` collection), so employees never see each other's
  threads. There is no login on the help site itself. **New chat** starts a fresh thread.
- **Streaming.** Answers stream over SSE; status notices (e.g. when content is kept on the local
  model for privacy) appear as small status lines in the chat.
- **Privacy.** backend-ai's own privacy routing applies automatically: customer, finance and
  proprietary content is forced to the local model regardless of this integration, and source code
  may be routed to Claude for coding help per the tenant's setting.

Setup:

1. In backend-ai, an admin creates a service user (email + password) with chat permission. That
   account's conversations belong to the help site.
2. Set the environment on the help server:

```sh
AI_API_URL=http://<backend-ai-host>:<port>   # the API root, without /api/v1
AI_SERVICE_EMAIL=help-site@enflite.com
AI_SERVICE_PASSWORD=<the service account's password>
```

3. Docker (`docker-compose.yml`): add the three variables to the `help` service's `environment`.
   Restart and check `GET /api/ai/status` returns `{ "enabled": true }`.

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

## Vercel

`vercel.json` deploys two services as one project:

| Service | Folder | Public paths |
|---|---|---|
| `client` | `client/` (Vite) | `/assets/`, `/icons/`, `/files/` (the build copies `content/files/` in), `/enflite-logo.png` |
| `server` | `server/` (Express, `src/index.js`) | `/api/...`, `/go/...`, and every page address (`/`, `/syteline/...`, `/search`) |

Page addresses go to the server because Vercel serves the client as plain files, so opening or
refreshing `/syteline/ecmrs/fields/item` there gave Vercel's 404. The server answers them with the
client's `index.html`, fetched from the client service through a **binding** (`CLIENT_URL`, the
client's internal address, set by Vercel); the app then shows the page.

Set `MONGODB_URI` in the Vercel project, and allow Vercel in Atlas **Network Access**.
Vercel doesn't seed: run `npm run seed` against the same database after content changes.
`vercel dev` runs both services locally.

**Keep it private** (rule 4 in `AGENTS.md`): a Vercel address is on the public internet and the
app has no login. Before sharing a Vercel link, turn on **Settings → Deployment Protection**
(Vercel Authentication, or a password) for all deployments. Use Vercel for review and testing; the
address SyteLine's right-click Help points at stays the internal HTTPS server below, since
SyteLine users can't get past Vercel's protection.

First deploy, check: a page opened directly (e.g. `/syteline/ecmrs/fields/item`) loads rather
than 404; `/api/health` shows `"db": true`; `/go/syteline/ecmrs/c_item` redirects to the Item page;
a procedure PDF under `/files/` opens.

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
| `vercel.json` | Vercel project: `client` and `server` services and their public paths |
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
| `GET /api/ai/status` | `{ enabled }`: whether the AI chat is configured |
| `POST /api/ai/chat` | `{ sessionKey, content }` → SSE stream proxied from the Enflite AI |
