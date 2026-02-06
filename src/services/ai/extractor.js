import fs from "fs";
import { toFile } from "openai/uploads";
import openai from "./openaiClient.js";
import { extractionSchema, questions } from "../../config/auditSchema.js";

export async function transcribeAudio(filePath, originalname) {
  const file = await toFile(fs.createReadStream(filePath), originalname);
  const result = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-transcribe",
    response_format: "json",
    prompt:
      "This is a business onboarding call in Hindi+English (Hinglish) about Amazon seller setup, pricing, FBA, verification, and launch readiness."
  });

  const text =
    (typeof result === "string" && result) || result?.text || result?.transcript || result?.data?.text;

  if (!text) {
    throw new Error("Transcription returned no text. Check audio file integrity and response shape.");
  }

  return text;
}

export async function extractChecklist(transcriptText) {
  const input = [
    {
      role: "system",
      content:
        "You are an audit analyst. Mark discussed=true only when explicitly present. Output JSON matching schema."
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

  if (resp.output_parsed) return resp.output_parsed;
  if (!resp.output_text) throw new Error("No output_text returned by the model.");

  try {
    return JSON.parse(resp.output_text);
  } catch {
    throw new Error(`Model did not return valid JSON. output_text:\n${resp.output_text.slice(0, 2000)}`);
  }
}
