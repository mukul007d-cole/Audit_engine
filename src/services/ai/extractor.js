import fs from "fs";
import path from "path";
import { toFile } from "openai/uploads";
import openai from "./openaiClient.js";
import { extractionSchema, questions } from "../../config/auditSchema.js";

const FORMAT_HINTS = [".mp3", ".m4a", ".wav", ".mpeg", ".mp4", ".webm", ".ogg", ".aac"];
const MIME_EXTENSION_MAP = new Map([
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"],
  ["audio/mp4", ".m4a"],
  ["audio/x-m4a", ".m4a"],
  ["audio/aac", ".aac"],
  ["audio/x-aac", ".aac"],
  ["audio/aacp", ".aac"],
  ["audio/vnd.dlna.adts", ".aac"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/webm", ".webm"],
  ["audio/ogg", ".ogg"],
  ["video/mp4", ".mp4"],
  ["video/mpeg", ".mpeg"]
]);

function getTranscriptText(result) {
  return (typeof result === "string" && result) || result?.text || result?.transcript || result?.data?.text;
}

function buildFilenameCandidates(originalname, mimetype) {
  const original = String(originalname || "audio").trim() || "audio";
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9_-]/g, "_") || "audio";
  const mime = String(mimetype || "").toLowerCase();

  const candidates = new Set([original]);
  const knownExt = MIME_EXTENSION_MAP.get(mime);
  if (knownExt) candidates.add(`${base}${knownExt}`);

  for (const hint of FORMAT_HINTS) {
    candidates.add(`${base}${hint}`);
  }

  return Array.from(candidates);
}

export async function transcribeAudio(filePath, originalname, mimetype) {
  const audioBuffer = await fs.promises.readFile(filePath);
  const candidates = buildFilenameCandidates(originalname, mimetype);
  let lastError = null;

  for (const candidateName of candidates) {
    try {
      const file = await toFile(audioBuffer, candidateName);
      const result = await openai.audio.transcriptions.create({
        file,
        model: "gpt-4o-transcribe",
        response_format: "json",
        prompt:
          "This is a business onboarding call in Hindi+English (Hinglish) about Amazon seller setup, pricing, FBA, verification, and launch readiness. Transcribe spoken Hindi using Roman script (Hinglish), not Devanagari."
      });

      const text = getTranscriptText(result);
      if (!text) {
        throw new Error("Transcription returned no text. Check audio file integrity and response shape.");
      }

      return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "Unable to transcribe this audio file.");
}

function normalizeHinglishText(value) {
  if (typeof value !== "string") return value;

  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n\t]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function normalizeReportStrings(value) {
  if (typeof value === "string") return normalizeHinglishText(value);
  if (Array.isArray(value)) return value.map(normalizeReportStrings);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, normalizeReportStrings(nestedValue)])
  );
}

export async function extractChecklist(transcriptText) {
  const input = [
    {
      role: "system",
      content:
        "You are an audit analyst.\n" +
        "Each checklist item has a short intent code.\n" +
        "Interpret intents as follows:\n" +
        "- *_verified: seller confirms the detail\n" +
        "- *_discussed: topic is talked about\n" +
        "- *_explained: process or policy is explained\n\n" +
        "Rules:\n" +
        "- discussed=true ONLY if present.\n" +
        "- evidence: max 1 short quote (<=120 chars).\n" +
        "- ASCII Roman-script Hinglish only no devnagri.\n" +
        "- final_answer = 'Yes' if >=70% discussed=true, else 'No'."
    },
    {
      role: "user",
      content: `Checklist questions:\n${JSON.stringify(questions, null, 2)}\n\nTranscript:\n${transcriptText}`
    }
  ];

  const resp = await openai.responses.create({
    model: "gpt-5.2",
    input,
    text: {
      format: {
        type: "json_schema",
        name: extractionSchema.name || "CallAuditReport",
        strict: true,
        schema: extractionSchema.schema
      }
    }
  });

  if (resp.output_parsed) return normalizeReportStrings(resp.output_parsed);
  if (!resp.output_text) throw new Error("No output_text returned by the model.");

  try {
    return normalizeReportStrings(JSON.parse(resp.output_text));
  } catch {
    throw new Error(`Model did not return valid JSON. output_text:\n${resp.output_text.slice(0, 2000)}`);
  }
}
