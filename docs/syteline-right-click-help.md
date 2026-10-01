# Right-click → Help on a SyteLine form

How to make **right-click → Help** (and **F1**) on any SyteLine form open the Enflite help page for
the field the user is in, the way eCMRs does. It works on our own forms (eCMRs) and on Infor forms
we customize with UET fields (Service Orders, Incidents). On those, our fields open our pages and
Infor's fields still open Infor's help.

> **Status:** confirmed on TRN 2026-09-30 for right-click → Help on eCMRs
> ([Enflite/eCMRs#21](https://github.com/Enflite/eCMRs/pull/21)). **F1** and the Service Orders and
> Incidents imports use the same handlers and are not confirmed yet.

**Contents**

1. [How it works](#1-how-it-works)
2. [The events](#2-the-events)
3. [The handlers, step by step](#3-the-handlers-step-by-step)
4. [Add it to a form](#4-add-it-to-a-form)
5. [Write the help pages](#5-write-the-help-pages)
6. [Import and test on TRN](#6-import-and-test-on-trn)
7. [Production, and changing the help address](#7-production-and-changing-the-help-address)
8. [Troubleshooting](#8-troubleshooting)
9. [What we tried, and why it is built this way](#9-what-we-tried-and-why-it-is-built-this-way)
10. [Frequently asked questions](#10-frequently-asked-questions)

---

## 1. How it works

```
 User clicks into a field, then right-clicks it → Help   (or presses F1)
        │
        ▼
 SyteLine raises a Help event on the form ── StdFormHelp (right-click → Help)
        │                                     StdFormComponentHelp (F1)
        ▼
 Handler step 0 (inline script)   asks SyteLine which component has the cursor
        │                         and writes the help link into a form variable:
        │                         https://help-seven-xi.vercel.app/go/syteline/<form>/<component>?via=…&ev=…
        ▼
 Handler step 1 (go to URL)       opens the link in a new browser tab
        │
        ▼
 Help site /go                    picks the page:
                                    · a page lists the component in its aliases → that page
                                    · Infor form we customize, Infor component  → Infor's help
                                    · our own form, no page                      → the form's page
```

The form only ever sends **which form** and **which component**. Everything else (which page, or
Infor's help) is decided by the help site, from the pages in `content/`. So adding or fixing a help
page never needs a SyteLine import, only a help-site deploy.

What lives where:

| Piece | Where | Changed by |
|---|---|---|
| The two Help event handlers and the link variable | The form XML, in the form's repo | [`tools/syteline/form_help.py`](../tools/syteline/form_help.py) `add`, called from the form's build script |
| Which page each component opens | `content/syteline/<form>.json` in this repo: each page's `aliases` | Editing the JSON, then `npm run seed` |
| Infor's help for Infor fields | The form page's `infor` block in `content/` | Editing the JSON, then `npm run seed` |
| The redirect | `server/src/app.js` (`helpTarget`), at `/go` | Code in this repo |

---

## 2. The events

A SyteLine form reacts through **event handlers**. SyteLine raises an **event**, and every handler
with that event's name runs, in **Sequence** order (0, 1, 2…). Each handler has a **Response Type**
that says what kind of thing its **Response** is. In the form XML:

```xml
<EventHandler Name="StdFormHelp" Sequence="1">
   <ResponseType>39</ResponseType>
   <Response>URL(V(ENF_HelpUrl)) ( )</Response>
</EventHandler>
```

### The two Help events

These are **standard events**: SyteLine raises them itself. A form that handles them replaces
SyteLine's built-in help (Infor's help page) with whatever its handlers do.

| Event | SyteLine raises it for | What the handler gets |
|---|---|---|
| **`StdFormHelp`** | Right-click a field → **Help** (seen on TRN 2026-09-30: the help log showed `ev=form` for a right-click). Also **Help → Current Form**, and **What's This?** then clicking outside a component | No parameter naming the field |
| **`StdFormComponentHelp`** | **F1**, **Help → Current Field**, **What's This?** then clicking a component. *Not* the right-click menu, despite its name | No parameter naming the field |

Infor's descriptions:
[StdFormHelp](https://docs.infor.com/csi/9.01.x/en-us/csbiolh/lsm1454148062494.html),
[StdFormComponentHelp](https://docs.infor.com/csi/9.01.x/en-us/csbiolh/lsm1454148059452.html).

We handle **both**, with the same script, so it works however the user asks for help. The link
says which event sent it: `ev=form` (StdFormHelp) or `ev=field` (StdFormComponentHelp).

### How the script knows the field

Neither event tells the handler which component was right-clicked. The script asks SyteLine
which component **has the cursor**:
[`ThisForm.GetCurrentComponentName()`](https://docs.infor.com/csi/9.01.x/en-us/csbiolh/lsm1454148086019.html).
Right-clicking a field doesn't move the cursor into it, so **the user must click into the field
first**. If no field has the cursor, the link carries no component and the help site opens the
form's page (or Infor's form topic).

### The response types used

| Type | Name | Response | Used for |
|---|---|---|---|
| **33** | Inline script | `SCRIPTTEXT( …VB.NET… )` | Step 0: find the field, build the link |
| **39** | Go to URL | `URL(<address>) ( )`. `V(name)` reads a form variable | Step 1: open the link in a new tab. The same response Infor's Customer Order Lines uses for its tracking link |

### The form variable

The link is passed from step 0 to step 1 through a **form variable**, `ENF_HelpUrl` by default
(eCMRs uses its older name `EcmrsHelpUrl`). Step 0 writes it with
`ThisForm.Variables("ENF_HelpUrl").Value = …`; step 1 reads it with `V(ENF_HelpUrl)`. Its
starting value is the form's link with no component (`…/go/syteline/<form>`), so it always holds
a working address.

---

## 3. The handlers, step by step

`form_help.py add` puts these four handlers and the variable in the form XML:

| Event | Sequence | Type | Response |
|---|---|---|---|
| `StdFormComponentHelp` | 0 | 33 | The script below, with `ev=field` |
| `StdFormComponentHelp` | 1 | 39 | `URL(V(ENF_HelpUrl)) ( )` |
| `StdFormHelp` | 0 | 33 | The script below, with `ev=form` |
| `StdFormHelp` | 1 | 39 | `URL(V(ENF_HelpUrl)) ( )` |

| Variable | Starting value |
|---|---|
| `ENF_HelpUrl` | `https://help-seven-xi.vercel.app/go/syteline/<form>` |

### The script (step 0)

This is the `StdFormHelp` script for Service Orders, as it is in the XML (before `&` is written
as `&amp;`):

```vb
SCRIPTTEXT(Option Explicit On
Option Strict Off
Imports System
Imports Mongoose.Scripting
Namespace SyteLine.GlobalScripts
Public Class EvHandler_StdFormHelp_0
Inherits GlobalScript
Sub Main()
Dim c As String = "", v As String = "focusempty", e As String = ""
Try
c = ThisForm.GetCurrentComponentName()
If c <> "" Then v = "focus"
Catch x As Exception
v = "focuserr"
e = x.Message
End Try
ThisForm.Variables("ENF_HelpUrl").Value = "https://help-seven-xi.vercel.app/go/syteline/service-orders" & If(c = "", "", "/" & c) & "?via=" & v & "&ev=form&e=" & Uri.EscapeDataString(If(e.Length > 200, e.Substring(0, 200), e))
ReturnValue = "0"
End Sub
End Class
End Namespace
)
```

Line by line:

| Lines | What they do |
|---|---|
| `SCRIPTTEXT(` … `)` | Marks the response as an inline script. SyteLine compiles it the first time the event runs |
| `Option Strict Off`, `Imports …`, `Namespace SyteLine.GlobalScripts`, `Class EvHandler_<Event>_<Sequence>`, `Inherits GlobalScript` | The wrapper every SyteLine inline script needs. The class name must be `EvHandler_` + event + `_` + sequence |
| `Dim c …, v …, e …` | `c` = the component, `v` = how it was found, `e` = any error text |
| `c = ThisForm.GetCurrentComponentName()` | The component with the cursor, e.g. `UfEvalDateEdit` |
| `v = "focus"` / `"focusempty"` / `"focuserr"` | Found it / no component had the cursor / the call failed |
| `ThisForm.Variables("ENF_HelpUrl").Value = …` | Builds `<site>/go/syteline/<form>/<component>?via=…&ev=…&e=…` |
| `Uri.EscapeDataString(…)` | Makes the error text safe in a link, cut to 200 characters |
| `ReturnValue = "0"` | Tells SyteLine the step succeeded, so step 1 runs |

The `via`, `ev` and `e` values don't change where the link goes. They are written to the help
site's log, so a problem report can say exactly what the form saw (see [Troubleshooting](#8-troubleshooting)).

### Rules the script follows (SyteLine's web client)

Each of these was learned on TRN (details in [section 9](#9-what-we-tried-and-why-it-is-built-this-way)):

- **No apostrophes**, not even in a comment (a VB comment starts with `'`). SyteLine reads `'` in a
  response as a quote, and shows *SCRIPTTEXT keyword required for InlineScript event handlers*.
  `form_help.py` refuses a script that has one.
- **Call `ThisForm` directly.** Calls through a variable (`Dim f As Object = ThisForm`, then
  `f.Variables(…)`) are refused: *Attempt by method …InvokeMethod… to access method
  …ScriptForm.Variables(System.String) failed*.
- **Don't read the event's parameters** (`CountParameter`, `GetParameter`, `ParameterCount`):
  the script then didn't compile (*Error compiling script EvHandler_StdFormHelp_0*).
- **Long scripts are split** into `<Response>` (the first 500 characters) and `<Response2>` (the
  rest), the way Infor's own exports store them. The whole script must stay under 1,500 characters.
- **One script per event.** Don't make one Help event raise another to share the script: when
  `StdFormComponentHelp` did that, the right-click menu stopped opening.

---

## 4. Add it to a form

Do this in the **form's repo** (e.g. `Enflite/ServiceOrders`), on its build script, never in
Design Mode. The form XML is always rebuilt by the script from the unchanged export in `original/`.

### Before you start

1. The form's repo has its unchanged export committed in `original/` (the rollback copy).
2. The form has a build script in `tools/` that writes the form XML to import.
3. Pick the form's **key** on the help site: lower case, dashes, e.g. `service-orders`. It is the
   form page's `path` in `content/syteline/<key>.json` (section 5).
4. Check the form doesn't already handle `StdFormHelp` or `StdFormComponentHelp` (search the XML
   for `<EventHandler Name="StdFormHelp"`). Infor's forms normally don't. If it does, look at what
   the existing handlers do before replacing them (`--replace`).

### Option A: call it from the build script (recommended)

Copy [`tools/syteline/form_help.py`](../tools/syteline/form_help.py) into the form repo's `tools/`
and call it as the build script's last step, so the form XML stays reproducible with `--check`:

```python
from form_help import add_help_handlers

HELP_FORM = "service-orders"  # the form's key on the help site

def main():
    text = open(SRC, "rb").read().decode("utf-8-sig")
    # ... the form's own changes ...
    text = add_help_handlers(text, HELP_FORM)
    open(OUT, "wb").write(b"\xef\xbb\xbf" + text.encode("utf-8"))
```

`add_help_handlers(text, form, site=…, space="syteline", var="ENF_HelpUrl", replace=False)` returns
the new text. It stops with a message if the form already has Help handlers or the variable.

### Option B: run it on an export

```sh
python3 tools/syteline/form_help.py add original/MyForm.trn.original.xml --form my-form --out MyForm.xml
python3 tools/syteline/form_help.py add original/MyForm.trn.original.xml --form my-form --out MyForm.xml --check
```

The second line checks that `MyForm.xml` is what the first line produces (use it before every commit).

| Option | Default | Use |
|---|---|---|
| `--form` | (required) | The form's key on the help site |
| `--out` | the input file | Where to write |
| `--site` | `https://help-seven-xi.vercel.app` | The help site's address |
| `--space` | `syteline` | The help space |
| `--var` | `ENF_HelpUrl` | The form variable (eCMRs: `EcmrsHelpUrl`) |
| `--replace` | off | Remove existing `StdFormHelp` / `StdFormComponentHelp` handlers and the variable first |
| `--check` | off | Don't write; fail if the output file is out of date |

### What the script keeps

The file is edited as text: its UTF-8 BOM, CRLF line endings and everything else stay byte for
byte. Never open and re-save a form export with an XML library. In git, the repo's
`.gitattributes` must have `*.xml -text` and `*.XML -text`.

---

## 5. Write the help pages

Do this in **this repo** (`Enflite/help`).

1. List the form's components and their bindings:

   ```sh
   python3 tools/syteline/form_help.py components MyForm.xml
   python3 tools/syteline/form_help.py components MyForm.xml --only Uf      # just our UET fields
   ```

2. Print page stubs, one per bound field, with every component of the field (the field, its
   grid column and its label) already in `aliases`:

   ```sh
   python3 tools/syteline/form_help.py components MyForm.xml --form my-form --only Uf --json
   ```

3. Put them in `content/syteline/<key>.json`, under a form page with `path` = the form's key
   (copy `service-orders.json` for an Infor form we customize, `ecmrs.json` for our own form).
   Fill in the `TODO`s (section, summary, text), and delete each stub's `_property` line.
4. **Infor form we customize?** Give the form page an `infor` block, so Infor's fields still open
   Infor's help:

   ```json
   "infor": {
     "url": "https://docs.infor.com/csi/latest/en-us/csbiolh/default.html?helpcontent=<form topic>",
     "components": { "<Infor component>": "https://docs.infor.com/…<field topic>" }
   }
   ```

   Find the topics in Infor's `sitemap.html` for the help library. Only list components that have
   their own Infor topic; all others open the form topic.
5. `npm run check` fails if two pages claim the same component, or a link points nowhere.
6. Open a pull request. After it is merged and deployed, run `npm run seed`.

Check a component's page without SyteLine: open
`https://help-seven-xi.vercel.app/go/syteline/<key>/<component>`. That is exactly the link the form opens.

### Where /go sends a component

| Case | Opens |
|---|---|
| A page in the form lists the component in `aliases` (any letter case) | That page |
| No page, and the form page has `infor` | `infor.components[<component>]`, else `infor.url` |
| No page, our own form | The form's page, with a note naming the component |
| No component (no field had the cursor) | Infor's form topic, or the form's page |

---

## 6. Import and test on TRN

1. In the form repo: rebuild, run `--check`, commit the script and the XML together.
2. **FormSync** → import the XML on **TRN** at **Site** scope (never over the Vendor form).
3. Open the form. **Click into** one of our fields, then right-click it → **Help**. Its help page
   opens in a new tab.
4. Click into one of Infor's fields → right-click → **Help**: Infor's help opens (customized forms)
   or the form's page (our own forms).
5. Press **F1** in a field: the same page opens. (Not confirmed on TRN yet: write down what happens.)
6. Open the help site's log (**Vercel** → the project → **Logs**). Each click writes one line:

   ```
   help link syteline/service-orders component=UfEvalDateEdit via=focus ev=form -> /syteline/service-orders/fields/eval_date
   ```

| In the log | Means |
|---|---|
| `via=focus` | The form found the field. Working |
| `via=focusempty` | No field had the cursor: click into the field before right-clicking |
| `via=focuserr` | `GetCurrentComponentName()` failed: the error text is in `e=` (Vercel shows it under the request's search params) |
| `ev=form` / `ev=field` | `StdFormHelp` / `StdFormComponentHelp` sent it |
| No line at all | The form didn't open the link: see Troubleshooting |

---

## 7. Production, and changing the help address

- **Production**: import the same XML through FormSync, after TRN sign-off. Nothing else changes.
- **A new help address** (a custom domain): rebuild every form with `--site <new address>
  --replace`, and import each one. Until then the old address must keep working. The production
  domain `help-seven-xi.vercel.app` always serves the latest deploy, so normal help-site changes
  never need this.

---

## 8. Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| Dialog *SCRIPTTEXT keyword required for InlineScript event handlers* | An apostrophe in a script (often a comment) | Remove it from the build script, rebuild, re-import |
| *Error compiling script EvHandler_StdFormHelp_0* | The script uses a call the web client doesn't have (event parameters, `ThisForm.UserName`) | Use the script as generated by `form_help.py` |
| *Attempt by method …InvokeMethod… to access method …ScriptForm.Variables… failed* | A late-bound call (`Dim f As Object = ThisForm`) | Call `ThisForm` directly |
| *Your pop-up Blocker may be enabled* with **Click to open** | The tab opens after the script, not straight from the click, so the browser treats it as a pop-up | Click **Click to open**; allow pop-ups for the SyteLine address (Chrome: the icon at the right of the address bar → **Always allow**; for everyone, IT policy `PopupsAllowedForUrls`) |
| The right-click menu doesn't open | A Help handler raising another event (eCMRs#17) | Use one script per event, as generated |
| The form's page opens, not the field's | No field had the cursor (`via=focusempty`), or no page lists the component | Click into the field first; add the component to the page's `aliases` |
| The page says *Page not found* | The page isn't in the database yet | `npm run seed` after the deploy |
| Infor's help opens for one of our fields | The component isn't in any page's `aliases` (customized forms send unknown components to Infor) | Add it to the field's page, check, seed |
| Infor's help opens for every field, or *Invalid URL string, or no help is defined for this form or field* | The form has no Help handlers: the import didn't take, or the wrong file was imported | Search the imported XML for `<EventHandler Name="StdFormHelp"`; re-import through FormSync |

When a fix needs a form change, make it in the build script and re-import. FormSync keeps settings
that are missing from the file, so removing a line doesn't remove the setting: rename the event or
component to make FormSync create it fresh.

---

## 9. What we tried, and why it is built this way

On eCMRs, TRN, 2026-09-29 and 30. Full detail:
[eCMRs troubleshooting](https://github.com/Enflite/eCMRs/blob/main/docs/troubleshooting.md).

| Try | Result | Lesson |
|---|---|---|
| `HelpFileName` on each field pointing at our pages | Opened `https://docs.infor.com/…/file:///S:/…` | SyteLine puts Infor's help address in front of `HelpFileName`: it can only open Infor pages |
| A **Help** button: ResponseType 39 to a `file:///S:/…` page | SyteLine showed its `GetFile.aspx` page with a path to copy | Browsers never let a web page open `file:` links. The help must be on `https://` |
| `StdFormComponentHelp` script, help site on Vercel | Right-click opened the form's page, `ev=form` | Right-click → Help raises **`StdFormHelp`**, not `StdFormComponentHelp`. Handle both |
| Scripts with VB comments | *SCRIPTTEXT keyword required* | No apostrophes in a response |
| `StdFormComponentHelp` raising `ENF_FindHelpField` (#17) | The right-click menu stopped opening | Don't raise another event from a Help handler |
| Late-bound calls (`f.Variables(…)`) (#19) | *…ScriptForm.Variables failed* | Call `ThisForm` directly |
| Reading the event's parameters (#20) | *Error compiling script* | Help events carry no parameter naming the field anyway |
| `ThisForm.GetCurrentComponentName()` only (#21) | **Works**: the field's page opens | The design in this guide |
| Help site: Service Orders, Incidents (Enflite/help#13) | Our fields → our pages, Infor's → Infor's help | The routing lives on the help site, not in the form |

---

## 10. Frequently asked questions

**Why does the user have to click into the field first?**
The Help events don't say which field was right-clicked; the script can only ask which one has the
cursor, and right-clicking doesn't move it.

**Do I have to re-import the form when I add or change a help page?**
No. The form always sends the same link; the help site decides the page. Only a new help address
or a change to the handlers needs a re-import.

**Why not put the page addresses in the form?**
Then every new page or fix would need a SyteLine import, in TRN and production. The component
names in `aliases` are the only link between the two, and `npm run check` keeps them unique.

**Does this change Infor's form?**
No. The handlers are added to our Site-scope copy of the form through FormSync, the same as every
other change we make. Infor's Vendor form is untouched, and importing the backup from `original/`
removes them.

**What about Infor fields on our customized forms?**
They open Infor's own help, as before (section 5, step 4).

**Can I use this on a form with its own help handlers?**
Only after reading what they do. `--replace` removes them.

**What about grids?**
Each grid column is a component (e.g. `UfEvalDateGridCol`). Put it in the field page's `aliases`
(the `components --json` stubs already do).

---

Reference: [`tools/syteline/form_help.py`](../tools/syteline/form_help.py) ·
[`content/README.md`](../content/README.md) (page format, `aliases`, `infor`) ·
[`server/src/app.js`](../server/src/app.js) (`/go`) · on the help site: **Developer reference →
Add right-click Help to a form**, **Help events**, **Help link API**.
