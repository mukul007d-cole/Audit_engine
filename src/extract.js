import fs from "fs";
import { toFile } from "openai/uploads";
import openai from "./openai.js";
import { extractionSchema, questions } from "./schema.js";

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
      (typeof result === "string" && result) ||
      result?.text ||
      result?.transcript ||
      result?.data?.text;
  
    if (!text) {
      throw new Error(
        "Transcription returned no text. Check audio file integrity and transcription response shape."
      );
    }
  
    return text;
  }
  

export async function extractChecklist(transcriptText) {
    const rubric = `
You are an audit analyst performing a compliance review of a seller onboarding call.

Your task is to determine whether each mandatory onboarding topic was EXPLICITLY discussed.

STRICT RULES:
- Set discussed = true ONLY if the transcript contains a direct reference to the topic.
- If the topic is implied, partially mentioned, or unclear, set discussed = false.
- Do NOT assume intent or fill gaps.

OUTPUT REQUIREMENTS:
- formal_response must be professional, audit-ready, and 1–3 concise sentences.
- notes must explain ambiguity, partial coverage, or why a topic is marked not discussed.
- confidence must be a number between 0 and 1, reflecting clarity of discussion.

EVIDENCE REQUIREMENTS (VERY IMPORTANT):
- Evidence quotes MUST be readable using Latin characters only.
- If the transcript is in Hindi or Devanagari, convert the quote to ROMANIZED Hindi (Hinglish).
- DO NOT output Devanagari or any non-Latin script in evidence.
- Preserve meaning and key terms (email, price, commission, COD, FBA, launch, etc.).
- Evidence should be short, clear, and audit-readable (1–2 lines).
- Provide 1–3 evidence quotes per topic ONLY if discussed or partially discussed.
- If no timestamps are available, set start_sec and end_sec to null.

GENERAL GUIDELINES:
- Be conservative. When in doubt, mark discussed = false.
- Do not repeat the question text in responses.
- Base all decisions strictly on the provided transcript.
`;


  const input = [
    { role: "system", content: rubric },
    {
      role: "user",
      content: `Checklist questions:\n${JSON.stringify(
        questions,
        null,
        2
      )}\n\nTranscript:\n${transcriptText}`,
    },
  ];

  const resp = await openai.responses.create({
    model: "gpt-5.2",
    input,
    text: {
      format: {
        type: "json_schema",
        name: extractionSchema.name || "CallAuditReport",
        strict: true,
        schema: extractionSchema.schema,
      },
    },
  });

  if (resp.output_parsed) return resp.output_parsed;

  const text = resp.output_text;
  if (!text) throw new Error("No output_text returned by the model.");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Model did not return valid JSON. output_text:\n${text.slice(0, 2000)}`
    );
  }
}
