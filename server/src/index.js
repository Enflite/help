import { createApp } from "./app.js";
import { config } from "./config.js";
import { connect } from "./db.js";

await connect();
const app = createApp({ contentDir: config.contentDir, clientDist: config.clientDist, clientUrl: config.clientUrl });

// On Vercel the "server" service runs this app as a function (vercel.json): export it, no listen.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Enflite help on http://localhost:${config.port} (MongoDB ${config.mongoUri.replace(/\/\/[^@]*@/, "//***@")})`);
  });
}

export default app;
