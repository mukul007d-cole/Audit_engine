import express from "express";
import path from "path";
import fs from "fs";
import jobRoutes from "./routes/jobRoutes.js";
import { AUDIO_DIR, AUDIT_DIR, FRONTEND_DIR } from "./config/constants.js";

const app = express();

fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(AUDIT_DIR, { recursive: true });

app.use(express.json());
app.use(jobRoutes);
app.use("/audits", express.static(path.resolve(AUDIT_DIR)));
app.use("/frontend", express.static(path.resolve(FRONTEND_DIR)));

app.get("/", (_req, res) => res.redirect("/user"));
app.get("/user", (_req, res) => res.sendFile(path.resolve(FRONTEND_DIR, "user.html")));
app.get("/admin", (_req, res) => res.sendFile(path.resolve(FRONTEND_DIR, "admin.html")));

export default app;
