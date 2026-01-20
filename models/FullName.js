import mongoose from "mongoose";

const FullNameSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // unique to avoid duplicates
  resumeContent: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("FullName", FullNameSchema);
