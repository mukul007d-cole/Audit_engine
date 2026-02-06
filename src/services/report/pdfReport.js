import PDFDocument from "pdfkit";
import fs from "fs";

function yesNo(v) {
  return v ? "Yes" : "No";
}

function clamp01(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function ensureSpace(doc, height = 60) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) doc.addPage();
}

function hr(doc) {
  const x1 = doc.page.margins.left;
  const x2 = doc.page.width - doc.page.margins.right;
  doc.moveDown(0.4);
  doc.opacity(0.25);
  doc.moveTo(x1, doc.y).lineTo(x2, doc.y).stroke();
  doc.opacity(1);
  doc.moveDown(0.6);
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 30);
  doc.fontSize(12).text(title);
  doc.moveDown(0.25);
}

function truncate(str, max = 110) {
  if (!str) return "";
  const s = String(str).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function fmtTs(start_sec, end_sec) {
  const s = typeof start_sec === "number" ? Math.round(start_sec) : null;
  const e = typeof end_sec === "number" ? Math.round(end_sec) : null;
  if (s == null && e == null) return "";
  if (s != null && e != null) return `[${s}s–${e}s]`;
  if (s != null) return `[${s}s]`;
  return `[–${e}s]`;
}

function pickEvidence(q) {
  const ev = Array.isArray(q?.evidence) ? q.evidence : [];
  if (!ev.length) return "—";
  const best = ev[0] || {};
  const ts = fmtTs(best.start_sec, best.end_sec);
  const quote = truncate(best.quote || "", 120);
  if (!quote) return "—";
  return `${ts ? ts + " " : ""}"${quote}"`;
}

function computeFinalYesNo(questions) {
  const qs = Array.isArray(questions) ? questions : [];
  const total = qs.length || 0;
  if (!total) return { final: "No", yesCount: 0, total: 0, ratio: 0 };

  const yesCount = qs.reduce((acc, q) => {
    const discussed = (q?.discussed ?? q?.mentioned) === true;
    return acc + (discussed ? 1 : 0);
  }, 0);

  const ratio = yesCount / total;
  const final = ratio >= 0.7 ? "Yes" : "No";
  return { final, yesCount, total, ratio };
}

function drawOverviewTable(doc, rows) {
  const left = doc.page.margins.left;
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const colTopic = Math.floor(pageW * 0.32);
  const colYN = 55;
  const colEv = pageW - colTopic - colYN;

  // ---------- Header (aligned) ----------
  doc.fontSize(10).opacity(0.85);
  const hy = doc.y;

  doc.text("Topic", left, hy, { width: colTopic });
  doc.text("Yes/No", left + colTopic, hy, { width: colYN, align: "left" });
  doc.text("Evidence", left + colTopic + colYN, hy, { width: colEv });

  // move down by one header line (instead of letting text calls drift y)
  doc.y = hy + doc.currentLineHeight() + 4;
  doc.opacity(1);
  hr(doc);

  // ---------- Rows (aligned) ----------
  rows.forEach((q) => {
    const discussed = (q?.discussed ?? q?.mentioned) === true;
    const topic = truncate(q?.title || `Q${q?.id ?? ""}`, 60);
    const evidence = pickEvidence(q);

    // measure heights BEFORE drawing
    doc.fontSize(10);
    const y = doc.y;

    const hTopic = doc.heightOfString(topic, { width: colTopic });
    const hYN = doc.heightOfString(yesNo(discussed), { width: colYN });
    const hEv = doc.heightOfString(evidence, { width: colEv });

    const rowH = Math.max(hTopic, hYN, hEv);
    ensureSpace(doc, rowH + 12);

    // draw all columns at the SAME y
    doc.text(topic, left, y, { width: colTopic });
    doc.text(yesNo(discussed), left + colTopic, y, { width: colYN });
    doc.text(evidence, left + colTopic + colYN, y, { width: colEv });

    // manually advance to next row
    doc.y = y + rowH + 8;
  });
}


export function generatePdfReport(reportJson, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 46,
      bufferPages: true
    });

    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const questions = Array.isArray(reportJson?.questions) ? reportJson.questions : [];
    const { final, yesCount, total } = computeFinalYesNo(questions);

    // -------- Header (small) --------
    doc.fontSize(16).text("Call Audit Report", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(9).opacity(0.8).text("Summary + Checklist Overview", { align: "center" });
    doc.opacity(1);
    hr(doc);

    // -------- Summary --------
    sectionTitle(doc, "Summary");
    doc.fontSize(10).text(reportJson?.call_summary || "N/A", {
      lineGap: 2
    });
    hr(doc);

    // -------- Overview Table --------
    sectionTitle(doc, "Checklist Overview");
    drawOverviewTable(doc, questions);
    hr(doc);

    // -------- Final Answer (YES/NO only) --------
    sectionTitle(doc, "Final Answer");
    // Must be yes/no only (no explanation text)
    doc.fontSize(18).text(final, { align: "left" });

    // Optional tiny footer line (doesn't add tokens in LLM output; just PDF text)
    doc.moveDown(0.3);
    doc.fontSize(8).opacity(0.65).text(`Score: ${yesCount}/${total} topics discussed`, {
      align: "left"
    });
    doc.opacity(1);

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
