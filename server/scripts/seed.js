// Loads content/ into MongoDB: upserts every space and topic, and removes topics of those spaces
// that are no longer in content/ (content/ is the source of truth).
//   npm run seed           (MONGODB_URI, default mongodb://127.0.0.1:27017/enflite-help)
//   npm run check          (checks content/ only, no database)
import { config } from "../src/config.js";
import { loadContent } from "../src/content.js";
import { connect, disconnect } from "../src/db.js";
import { seed } from "../src/seed.js";

const { spaces, topics, errors } = loadContent(config.contentDir);
if (errors.length) {
  console.error(`content/ has ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log(`OK: content/ is valid (${spaces.length} space(s), ${topics.length} topics)`);
  process.exit(0);
}
await connect();
try {
  const r = await seed(spaces, topics);
  console.log(`Seeded ${r.spaces} space(s), ${r.topics} topics; removed ${r.removed} old topic(s)`);
} finally {
  await disconnect();
}
