import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../src/config.js";
import { loadContent, plain, validate } from "../src/content.js";

test("content/ is valid", () => {
  const { topics, errors } = loadContent(config.contentDir);
  assert.deepEqual(errors, []);
  assert.ok(topics.length > 0);
});

test("plain() drops bold markers and keeps link labels", () => {
  assert.equal(plain("Pick **Item** or [the PDF](/files/x.pdf)."), "Pick Item or the PDF.");
});

test("validate() reports broken references and duplicate aliases", () => {
  const spaces = [{ key: "s" }];
  const t = (path, extra = {}) => ({ space: "s", path, type: "field", title: path, _file: "s/x.json", ...extra });
  const errors = validate(spaces, [
    t("form", { groups: ["A"] }),
    t("form/a", { parent: "form", group: "B", aliases: ["c_x"], related: ["form/missing"] }),
    t("form/b", { parent: "nope", aliases: ["c_x"], blocks: [{ t: "bogus" }, { t: "p", text: "[x](/s/gone)" }] }),
    t("form/b"),
  ], config.contentDir);
  const has = (s) => assert.ok(errors.some((e) => e.includes(s)), `expected an error with "${s}" in ${errors.join(" | ")}`);
  has('group "B"');
  has('related "form/missing"');
  has('parent "nope"');
  has('alias "c_x"');
  has('unknown block type "bogus"');
  has("link /s/gone");
  has("duplicate path");
});
