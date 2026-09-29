import mongoose from "mongoose";

// One help page. `path` is unique within a space ("ecmrs", "ecmrs/fields/item",
// "procedures/qa-300-037"); the page URL is /<space>/<path>. `parent` + `group` place it in the
// navigation tree (a parent lists its `groups` in order). `blocks` is the page body (see
// content/README.md for the block types). `aliases` are the form component names whose
// right-click -> Help opens this page (/go/<space>/<form>/<component>).
const topicSchema = new mongoose.Schema(
  {
    space: { type: String, required: true },
    path: { type: String, required: true },
    type: { type: String, required: true },
    icon: { type: String, default: "form" },
    title: { type: String, required: true },
    eyebrow: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    summary: { type: String, default: "" },
    parent: { type: String, default: null },
    group: { type: String, default: "" },
    groups: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    number: { type: String, default: "" },
    blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    related: { type: [String], default: [] },
    aliases: { type: [String], default: [] },
    searchText: { type: String, default: "" },
  },
  { timestamps: true },
);

topicSchema.index({ space: 1, path: 1 }, { unique: true });
topicSchema.index({ space: 1, aliases: 1 });
topicSchema.index(
  { title: "text", number: "text", summary: "text", searchText: "text" },
  { weights: { title: 10, number: 10, summary: 4, searchText: 1 }, name: "topic_text" },
);

export const Topic = mongoose.model("Topic", topicSchema);
