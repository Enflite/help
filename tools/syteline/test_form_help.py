"""Tests for form_help.py: python3 -m unittest discover -s tools/syteline (npm run test:tools)."""
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import form_help  # noqa: E402

# A small form export in FormSync's layout: 9-space sections, 12-space entries, CRLF.
FORM = "\r\n".join([
    '<?xml version="1.0" encoding="utf-8"?>',
    "<ExportDoc>",
    '      <Form Name="Demo">',
    "         <EventHandlers>",
    '            <EventHandler Name="StdFormPredisplay" Sequence="0">',
    "               <ResponseType>22</ResponseType>",
    "               <Response>SETVARVALUES(X=1)</Response>",
    "            </EventHandler>",
    '            <EventHandler Name="StdObjectNew" Sequence="0">',
    "               <ResponseType>22</ResponseType>",
    "               <Response>SETVARVALUES(Y=1)</Response>",
    "            </EventHandler>",
    "         </EventHandlers>",
    "         <Variables>",
    '            <Variable Name="Aaa">',
    "               <Value />",
    "            </Variable>",
    '            <Variable Name="Zzz">',
    "               <Value />",
    "            </Variable>",
    "         </Variables>",
    "         <Components>",
    '            <Component Name="l_item">',
    "               <Type>0</Type>",
    "               <EffectiveCaption>Item:</EffectiveCaption>",
    "            </Component>",
    '            <Component Name="c_item">',
    "               <Type>27</Type>",
    "               <Caption>C(l_item)</Caption>",
    "               <DataSource>object.Item</DataSource>",
    "               <EffectiveCaption>C(l_item)</EffectiveCaption>",
    "            </Component>",
    '            <Component Name="grid_item">',
    "               <Type>15</Type>",
    "               <DataSource>object.Item</DataSource>",
    "               <EffectiveCaption>Item</EffectiveCaption>",
    "            </Component>",
    "         </Components>",
    "      </Form>",
    "</ExportDoc>",
    ""])


class AddHelpHandlers(unittest.TestCase):
    def setUp(self):
        self.out = form_help.add_help_handlers(FORM, "demo")

    def test_handlers_and_variable_in_export_order(self):
        names = [line.strip() for line in self.out.split("\r\n") if line.startswith('            <EventHandler ')]
        self.assertEqual(names, [
            '<EventHandler Name="StdFormComponentHelp" Sequence="0">',
            '<EventHandler Name="StdFormComponentHelp" Sequence="1">',
            '<EventHandler Name="StdFormHelp" Sequence="0">',
            '<EventHandler Name="StdFormHelp" Sequence="1">',
            '<EventHandler Name="StdFormPredisplay" Sequence="0">',
            '<EventHandler Name="StdObjectNew" Sequence="0">',
        ])
        var = self.out.index('<Variable Name="ENF_HelpUrl">')
        self.assertLess(self.out.index('<Variable Name="Aaa">'), var)
        self.assertLess(var, self.out.index('<Variable Name="Zzz">'))
        self.assertIn("<Value>https://help-seven-xi.vercel.app/go/syteline/demo</Value>", self.out)
        self.assertIn("<Response>URL(V(ENF_HelpUrl)) ( )</Response>", self.out)

    def test_script_is_safe_for_syteline(self):
        handlers = self.out.split("<EventHandlers>")[1].split("</EventHandlers>")[0]
        self.assertNotIn("'", handlers)
        self.assertIn("ThisForm.GetCurrentComponentName()", self.out)
        self.assertIn("&amp;ev=form&amp;e=", self.out)
        self.assertIn("&amp;ev=field&amp;e=", self.out)
        self.assertIn("<Response2>", self.out)  # long scripts are split as Infor stores them
        self.assertNotIn("\n", self.out.replace("\r\n", ""))  # CRLF only

    def test_existing_handlers_need_replace(self):
        with self.assertRaises(SystemExit):
            form_help.add_help_handlers(self.out, "demo")
        again = form_help.add_help_handlers(self.out, "demo", replace=True)
        self.assertEqual(again, self.out)
        moved = form_help.add_help_handlers(self.out, "demo", site="https://example.test/", replace=True)
        self.assertIn("https://example.test/go/syteline/demo", moved)
        self.assertNotIn("help-seven-xi", moved)

    def test_file_keeps_bom_and_check(self):
        with tempfile.TemporaryDirectory() as d:
            src, dst = os.path.join(d, "in.xml"), os.path.join(d, "out.xml")
            with open(src, "wb") as f:
                f.write(b"\xef\xbb\xbf" + FORM.encode())
            run = lambda *a: subprocess.run([sys.executable, form_help.__file__, *a], capture_output=True, text=True)
            self.assertEqual(run("add", src, "--form", "demo", "--out", dst).returncode, 0)
            with open(dst, "rb") as f:
                self.assertTrue(f.read().startswith(b"\xef\xbb\xbf<?xml"))
            self.assertEqual(run("add", src, "--form", "demo", "--out", dst, "--check").returncode, 0)
            self.assertNotEqual(run("add", src, "--form", "other", "--out", dst, "--check").returncode, 0)


class Components(unittest.TestCase):
    def test_field_page_stub_has_every_component(self):
        pages = form_help.field_pages(form_help.components(FORM), "demo")
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["path"], "demo/fields/item")
        self.assertEqual(pages[0]["title"], "Item")
        self.assertEqual(pages[0]["aliases"], ["c_item", "l_item", "grid_item"])


if __name__ == "__main__":
    unittest.main()
