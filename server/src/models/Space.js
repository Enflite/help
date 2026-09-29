import mongoose from "mongoose";

// A system the help covers (SyteLine first; others later). `home` is the topic path its landing
// page links to first.
const spaceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    home: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Space = mongoose.model("Space", spaceSchema);
