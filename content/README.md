# Help content

The help pages live here as JSON, in git. `npm run seed` loads them into MongoDB (and removes pages
that are no longer here); `npm run check` checks them without a database. Edit the JSON, run
`npm run check`, commit, then seed (the Docker image seeds itself on start).

## Files

| Path | What |
|---|---|
| `spaces.json` | The systems the help covers: `key` (URL), `name`, `description`, `home`, `order` |
| `<space>/*.json` | That space's pages: `{ "space": "<key>", "topics": [ ... ] }`, any number of files |
| `files/<space>/` | Documents linked from pages (served at `/files/<space>/...`), e.g. released procedure PDFs |

A page's URL is `/<space>/<path>`, e.g. `/syteline/ecmrs/fields/item`.

## A topic (page)

| Key | Required | What |
|---|---|---|
| `path` | yes | Unique in the space: `ecmrs`, `ecmrs/fields/item`, `procedures/qa-300-037` |
| `type` | yes | `form`, `field`, `procedure`, `index` (free text; used for display only) |
| `title` | yes | Page title (for a field: the label as on the form) |
| `icon` | | `form`, `field` or `procedure` (`client/public/icons/`) |
| `eyebrow`, `subtitle` | | Small red line above the title; line under it |
| `summary` | | One sentence, shown in lists and search results |
| `parent`, `group` | | Where it sits in the navigation: under `parent`, in its section `group` |
| `groups` | | On a parent: its sections, in order (every child's `group` must be one of them) |
| `order` | | Sort order among siblings |
| `number` | | Document number shown before the title (procedures) |
| `blocks` | | The page body, below |
| `related` | | Paths listed under **Related topics** (the parent is added automatically) |
| `aliases` | | Form component names whose right-click → Help opens this page (see below) |

## Blocks

Text may use `**bold**` and links `[label](/syteline/ecmrs)` or `[PDF](/files/syteline/x.pdf)`.

| `t` | Keys | Shows |
|---|---|---|
| `p` | `text` | Paragraph |
| `h2`, `h3` | `text` | Section heading (light, with a rule); small uppercase label |
| `list` | `items` | Square-bullet list |
| `steps` | `items` | Numbered steps (red outlined circles) |
| `table` | `head` (optional), `rows`, `align: "left"` (optional) | Table with an ink header |
| `children` | | This page's child pages under its `groups` |
| `links` | `title`, `items` (paths) | A titled list of pages with their summaries |
| `meta` | `items` (`[label, value]` pairs) | Document block (number, revision...) |
| `notice` | `text` | Text between thin rules |
| `legend` | `text` | Explains the red rule on changed steps |
| `pstep` | `num`, `text`, `kind` (`""`, `changed`, `removed`, `added`), `was`, `why` | A numbered procedure step or definition; changed ones show the released wording and why |
| `flowchart` | `name` | A drawn flowchart (`client/src/components/Flowchart.jsx`) |

## Right-click → Help from a form

`/go/<space>/<form>/<component>` redirects to the page whose `aliases` include `<component>` among
`<form>` and its pages, else to the form's page. Put every component of a field on its page: the
field (`c_item`), its label (`l_item`) and its grid column (`grid_item`). `npm run check` fails if
two pages claim the same component.

## Where the SyteLine content came from

`syteline/ecmrs.json` and `syteline/procedures.json` were imported on 2026-09-29 from the
[Enflite/eCMRs](https://github.com/Enflite/eCMRs) help (`scripts/help_content.py`,
`scripts/procedures_content.py`, component names from `exports/eCMRs_v2.XML`). From now on they
are edited here.
