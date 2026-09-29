import mongoose from "mongoose";

// Maps one anonymous browser session (a uuid kept in the browser's localStorage) to one
// upstream conversation, so employees never see each other's threads. No user identity is stored.
const aiSessionSchema = new mongoose.Schema(
  {
    sessionKey: { type: String, required: true, unique: true, index: true },
    conversationId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export const AiSession = mongoose.model("AiSession", aiSessionSchema);
