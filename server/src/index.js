import { createApp } from "./app.js";
import { config } from "./config.js";
import { connect } from "./db.js";

await connect();
const app = createApp({ contentDir: config.contentDir, clientDist: config.clientDist });
app.listen(config.port, () => {
  console.log(`Enflite help on http://localhost:${config.port} (MongoDB ${config.mongoUri.replace(/\/\/[^@]*@/, "//***@")})`);
});
