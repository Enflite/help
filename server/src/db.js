import mongoose from "mongoose";
import { config } from "./config.js";

export async function connect(uri = config.mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

export function disconnect() {
  return mongoose.disconnect();
}
