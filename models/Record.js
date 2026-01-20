import mongoose from "mongoose";

const RecordSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  companyName: { type: String, default: "" },
  jobDescription: { type: String, default: "" },
  promptUsed: { type: String, default: "" },
  jdLink: { type: String, default: "" },
  resumeLink: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Record", RecordSchema);
