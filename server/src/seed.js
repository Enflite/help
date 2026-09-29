import { searchText } from "./content.js";
import { Space } from "./models/Space.js";
import { Topic } from "./models/Topic.js";

export async function seed(spaces, topics) {
  await Promise.all([Space.init(), Topic.init()]); // build indexes (text search) before use
  await Space.bulkWrite(spaces.map((s) => ({
    updateOne: { filter: { key: s.key }, update: { $set: s }, upsert: true },
  })));
  await Topic.bulkWrite(topics.map(({ _file, ...t }) => ({
    updateOne: {
      filter: { space: t.space, path: t.path },
      update: { $set: { ...t, searchText: searchText(t) } },
      upsert: true,
    },
  })));
  let removed = 0;
  for (const s of spaces) {
    const keep = topics.filter((t) => t.space === s.key).map((t) => t.path);
    removed += (await Topic.deleteMany({ space: s.key, path: { $nin: keep } })).deletedCount;
  }
  return { spaces: spaces.length, topics: topics.length, removed };
}
