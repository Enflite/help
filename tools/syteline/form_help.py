#!/usr/bin/env python3
"""Right-click -> Help for any SyteLine form: open the Enflite help page for the field.

Two commands, for a FormSync form export (the .xml you import through FormSync):

  add         Add the Help handlers and their variable to the form, so right-click -> Help
              (StdFormHelp) and F1 (StdFormComponentHelp) open
              <site>/go/<space>/<form>/<component> for the field that has the cursor.
              The help site then opens our page for that component, or Infor's help
              (see docs/syteline-right-click-help.md).

  components  List the form's components and print help-page stubs for content/, with each
              field's components already in "aliases".

Examples:

  python3 tools/syteline/form_help.py add Original.xml --form service-orders --out Form.xml
  python3 tools/syteline/form_help.py add Form.xml --form ecmrs --replace --var EcmrsHelpUrl
  python3 tools/syteline/form_help.py components Form.xml --form incidents --only Uf
  python3 tools/syteline/form_help.py components Form.xml --form incidents --json

The script is the same pattern as the eCMRs, Service Orders and Incidents build scripts, confirmed
working on TRN 2026-09-30 (Enflite/eCMRs#21). What it takes to work in SyteLine's web client:
- call ThisForm directly (calls through an Object variable are refused);
- ThisForm.GetCurrentComponentName() gives the field with the cursor (Help events don't name it);
- no apostrophes in a script, not even a comment (SyteLine reads ' as a quote: "SCRIPTTEXT keyword
  required");
- scripts over 500 characters are stored as <Response> (500) + <Response2>, as Infor's exports do.

The file is edited as text, so it keeps its UTF-8 BOM and CRLF line endings and everything else
byte for byte. Never re-save a form export through an XML library.

Python 3.8+, standard library only. Copy this file into a form repo's tools/ (or import
add_help_handlers from it in the form's build script) so the form XML stays reproducible.
"""
import argparse
import html
import json
import re
import sys

SITE = "https://help-seven-xi.vercel.app"  # the help's production domain
SPACE = "syteline"
VAR = "ENF_HelpUrl"
HELP_EVENTS = ("StdFormComponentHelp", "StdFormHelp")


def fail(msg):
    sys.exit(f"form_help: {msg}")


def read(path):
    with open(path, "rb") as f:
        raw = f.read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    if "\r\n" not in text:
        fail(f"{path} has no CRLF line endings. Use the file exactly as FormSync exported it "
             "(in git: .gitattributes with *.xml -text).")
    return text, bom


def write(path, text, bom):
    with open(path, "wb") as f:
        f.write((b"\xef\xbb\xbf" if bom else b"") + text.encode("utf-8"))


def help_script(event, ev, form_url, var):
    """The inline script (ResponseType 33): find the field with the cursor, put its /go link in
    the variable. via= says how (focus, focusempty, focuserr) and e= carries any error text, so
    the help site's log shows what happened."""
    return (
        "SCRIPTTEXT(Option Explicit On\r\nOption Strict Off\r\nImports System\r\nImports Mongoose.Scripting\r\n"
        f"Namespace SyteLine.GlobalScripts\r\nPublic Class EvHandler_{event}_0\r\nInherits GlobalScript\r\nSub Main()\r\n"
        'Dim c As String = "", v As String = "focusempty", e As String = ""\r\n'
        'Try\r\nc = ThisForm.GetCurrentComponentName()\r\nIf c <> "" Then v = "focus"\r\n'
        'Catch x As Exception\r\nv = "focuserr"\r\ne = x.Message\r\nEnd Try\r\n'
        f'ThisForm.Variables("{var}").Value = "{form_url}" & If(c = "", "", "/" & c) & "?via=" & v'
        f' & "&ev={ev}&e=" & Uri.EscapeDataString(If(e.Length > 200, e.Substring(0, 200), e))\r\n'
        'ReturnValue = "0"\r\nEnd Sub\r\nEnd Class\r\nEnd Namespace\r\n)')


def response_xml(resp):
    if resp.startswith("SCRIPTTEXT(") and "'" in resp:
        fail("the inline script contains an apostrophe: SyteLine reads it as a quote")
    if len(resp) > 1500:
        fail(f"the script is {len(resp)} characters; SyteLine allows 1,500")
    first, rest = resp[:500], resp[500:]
    if first.endswith("\r"):
        first, rest = first[:-1], "\r" + rest
    if len(rest) > 1000:
        fail(f"response too long for <Response> + <Response2>: {len(resp)} characters")
    out = f"               <Response>{html.escape(first, quote=False)}</Response>\r\n"
    if rest:
        out += f"               <Response2>{html.escape(rest, quote=False)}</Response2>\r\n"
    return out


def section(text, tag):
    """Start and end of the form's <tag>s> ... </tag>s> list (EventHandlers, Variables)."""
    start = text.find(f"         <{tag}s>\r\n")
    if start < 0:
        fail(f"the form has no <{tag}s> section. Export a form that has one (every form with "
             f"event handlers or variables does), or add an empty one by hand in the build script.")
    return start, text.index(f"         </{tag}s>", start)


def insert(text, tag, name, block):
    """Put block before the first <tag Name=...> that sorts after name, the order FormSync exports."""
    start, stop = section(text, tag)
    for m in re.finditer(rf'^ {{12}}<{tag} Name="([^"]+)"', text[start:stop], re.M):
        if m.group(1).lower() > name.lower():
            pos = start + m.start()
            return text[:pos] + block + text[pos:]
    return text[:stop] + block + text[stop:]


def remove(text, tag, name):
    """Remove every <tag Name="name" ...> ... </tag> entry (with its line)."""
    pat = re.compile(rf'^ {{12}}<{tag} Name="{re.escape(name)}"[^>]*>\r\n.*?^ {{12}}</{tag}>\r\n', re.M | re.S)
    return pat.sub("", text)


def add_help_handlers(text, form, site=SITE, space=SPACE, var=VAR, replace=False):
    """Return the form text with the two Help events handled and the link variable added.

    form   the form's key on the help site (its page path: ecmrs, service-orders, incidents)
    var    the form variable the script writes the link into
    replace  first remove existing StdFormHelp / StdFormComponentHelp handlers and the variable
             (to update the site address, or to replace an older version of these handlers)
    """
    form_url = f"{site.rstrip('/')}/go/{space}/{form}"
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", var):
        fail(f"variable name {var!r}: letters, digits and _ only")
    if replace:
        for name in HELP_EVENTS:
            text = remove(text, "EventHandler", name)
        text = remove(text, "Variable", var)
    for name in HELP_EVENTS:
        if f'<EventHandler Name="{name}"' in text:
            fail(f"the form already handles {name}. Re-run with --replace to swap in these handlers "
                 "(check first that the existing ones aren't doing something else you need).")
    if f'<Variable Name="{var}">' in text:
        fail(f"the form already has a variable {var}. Use --replace, or another --var.")
    handlers = [
        ("StdFormComponentHelp", 0, 33, help_script("StdFormComponentHelp", "field", form_url, var)),
        ("StdFormComponentHelp", 1, 39, f"URL(V({var})) ( )"),
        ("StdFormHelp", 0, 33, help_script("StdFormHelp", "form", form_url, var)),
        ("StdFormHelp", 1, 39, f"URL(V({var})) ( )"),
    ]
    for name, seq, rt, resp in handlers:
        text = insert(text, "EventHandler", name,
                      f'            <EventHandler Name="{name}" Sequence="{seq}">\r\n'
                      f"               <ResponseType>{rt}</ResponseType>\r\n"
                      + response_xml(resp)
                      + "            </EventHandler>\r\n")
    return insert(text, "Variable", var,
                  f'            <Variable Name="{var}">\r\n'
                  f"               <Value>{html.escape(form_url, quote=False)}</Value>\r\n"
                  "               <Value2 />\r\n               <Value3 />\r\n               <Description />\r\n"
                  "            </Variable>\r\n")


# ---------------------------------------------------------------------------------- components
# Component <Type> codes seen in the eCMRs and Service Orders exports.
TYPES = {"0": "static", "1": "edit", "5": "check box", "6": "group box", "8": "button", "12": "tabs",
         "13": "tab", "14": "grid", "15": "grid column", "18": "multi-line edit", "19": "tree",
         "26": "date", "27": "drop-down", "38": "link", "50": "flex layout"}


def components(text):
    out = []
    for m in re.finditer(r'^ {12}<Component Name="([^"]+)">\r\n(.*?)^ {12}</Component>', text, re.M | re.S):
        body = m.group(2)
        g = lambda t: html.unescape((re.search(rf"<{t}>([^<]*)</{t}>", body) or [None, ""])[1])
        out.append({"name": m.group(1), "type": TYPES.get(g("Type"), g("Type")), "source": g("DataSource"),
                    "caption": g("Caption"), "label": g("EffectiveCaption"), "hidden": g("Hidden") == "True"})
    by_name = {c["name"]: c for c in out}
    for c in out:  # a field's caption C(<label>) points at its label component: show that text
        ref = re.fullmatch(r"C\((\w+)\)", c["label"]) or re.fullmatch(r"C\((\w+)\)", c["caption"])
        if ref and ref.group(1) in by_name:
            c["label"] = by_name[ref.group(1)]["label"]
    return out


def field_pages(comps, form):
    """One stub page per bound property: its components (field, grid column, the label its Caption
    names) in aliases. Fill in the title and the text before adding it to content/."""
    by_name = {c["name"]: c for c in comps}
    pages, labels = {}, set()
    for c in comps:
        src = c["source"]
        if not src.startswith("object."):
            continue
        prop = src[len("object."):]
        page = pages.setdefault(prop, {"aliases": [], "label": ""})
        page["aliases"].append(c["name"])
        cap = re.fullmatch(r"C\((\w+)\)", c["caption"])  # the label component this field names
        if cap and cap.group(1) in by_name and cap.group(1) not in labels:
            labels.add(cap.group(1))  # a label shared by two fields goes on the first page only
            page["aliases"].append(cap.group(1))
        page["label"] = page["label"] or (c["label"] or "").strip().rstrip(":")
    topics = []
    for prop, page in pages.items():
        slug = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", re.sub(r"^\w{2,4}Uf_ENF_|^Uf_ENF_", "", prop)).lower()
        title = page["label"] or prop
        topics.append({
            "path": f"{form}/fields/{slug}", "type": "field", "icon": "field", "title": title,
            "eyebrow": "TODO section", "subtitle": f"Field on the {form} form",
            "summary": "TODO: one sentence, what the field holds.",
            "parent": form, "group": "TODO section", "order": len(topics) + 1,
            "blocks": [{"t": "p", "text": "TODO: what it means, how to fill it in."}],
            "related": [], "aliases": page["aliases"], "_property": prop})
    return topics


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add", help="add the Help handlers to a form export")
    a.add_argument("xml", help="the form export to read")
    a.add_argument("--form", required=True, help="the form's key on the help site (e.g. service-orders)")
    a.add_argument("--out", help="where to write (default: overwrite the input)")
    a.add_argument("--site", default=SITE, help=f"help site address (default {SITE})")
    a.add_argument("--space", default=SPACE, help=f"help space (default {SPACE})")
    a.add_argument("--var", default=VAR, help=f"form variable for the link (default {VAR})")
    a.add_argument("--replace", action="store_true", help="replace existing Help handlers and the variable")
    a.add_argument("--check", action="store_true", help="don't write: fail if --out (or the input) differs")
    c = sub.add_parser("components", help="list a form's components / print help-page stubs")
    c.add_argument("xml")
    c.add_argument("--form", default="<form>", help="the form's key on the help site, for --json")
    c.add_argument("--only", default="", help="only components whose name or binding contains this, case-sensitive (e.g. Uf)")
    c.add_argument("--json", action="store_true", help="print help-page stubs for content/")
    args = ap.parse_args()

    text, bom = read(args.xml)
    if args.cmd == "add":
        out = add_help_handlers(text, args.form, args.site, args.space, args.var, args.replace)
        target = args.out or args.xml
        if args.check:
            current, _ = read(target)
            if current != out:
                fail(f"{target} is out of date: run without --check")
            print(f"{target}: up to date")
            return
        write(target, out, bom)
        print(f"{target}: Help handlers added ({args.site.rstrip('/')}/go/{args.space}/{args.form}/<component>, "
              f"variable {args.var}). Import it through FormSync at Site scope.")
    else:
        comps = [x for x in components(text)
                 if args.only in x["name"] + " " + x["source"]]
        if args.json:
            print(json.dumps(field_pages(comps, args.form), indent=2, ensure_ascii=False))
            return
        print("Component\tType\tBinding\tLabel")
        for x in comps:
            print(f"{x['name']}\t{x['type']}\t{x['source']}\t{x['label']}{'  (hidden)' if x['hidden'] else ''}")


if __name__ == "__main__":
    main()
