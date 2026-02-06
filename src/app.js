import express from "express";
import path from "path";
import fs from "fs";
import jobRoutes from "./routes/jobRoutes.js";
import { AUDIO_DIR, AUDIT_DIR } from "./config/constants.js";

const app = express();

fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(AUDIT_DIR, { recursive: true });

app.use(express.json());
app.use(jobRoutes);
app.use("/audits", express.static(AUDIT_DIR));
app.get("/", (_req, res) => res.sendFile(path.resolve("test.html")));

export default app;
