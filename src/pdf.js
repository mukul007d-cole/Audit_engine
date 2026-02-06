import PDFDocument from "pdfkit";
import fs from "fs";

function yesNo(v) {
  return v ? "Yes" : "No";
}

function fmtConfidence(c) {
  if (typeof c !== "number") return "0.00";
  return Math.max(0, Math.min(1, c)).toFixed(2);
}

function ensureSpace(doc, height = 80) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) doc.addPage();
}

function hr(doc) {
  const x1 = doc.page.margins.left;
  const x2 = doc.page.width - doc.page.margins.right;
  doc.moveDown(0.4);
  doc.opacity(0.4);
  doc.moveTo(x1, doc.y).lineTo(x2, doc.y).stroke();
  doc.opacity(1);
  doc.moveDown(0.8);
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 40);
  doc.fontSize(13).text(title);
  doc.moveDown(0.4);
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(9)
      .opacity(0.6)
      .text(
        `Page ${i + 1}`,
        doc.page.margins.left,
        doc.page.height - 40,
        { align: "right", width: doc.page.width - 100 }
      );
  }
  doc.opacity(1);
}

function drawChecklistTable(doc, rows) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const col1 = 30;
  const col2 = width * 0.55;
  const col3 = 90;
  const col4 = width - col1 - col2 - col3;

  ensureSpace(doc, 60);

  doc.fontSize(10);
  doc.text("#", left, doc.y, { width: col1 });
  doc.text("Topic", left + col1, doc.y, { width: col2 });
  doc.text("Discussed", left + col1 + col2, doc.y, { width: col3 });
  doc.text("Confidence", left + col1 + col2 + col3, doc.y, { width: col4 });

  hr(doc);

  rows.forEach((q) => {
    ensureSpace(doc, 40);

    const discussed = q.discussed ?? q.mentioned ?? false;

    doc.text(String(q.id), left, doc.y, { width: col1 });
    doc.text(q.title, left + col1, doc.y, { width: col2 });
    doc.text(yesNo(discussed), left + col1 + col2, doc.y, { width: col3 });
    doc.text(fmtConfidence(q.confidence), left + col1 + col2 + col3, doc.y, {
      width: col4
    });

    doc.moveDown(1);
  });
}

export function generatePdfReport(reportJson, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true
    });

    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    // ---------- HEADER ----------
    doc.fontSize(18).text("Call Audit Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10)
      .opacity(0.8)
      .text(
        "Audit purpose: Verify whether mandatory onboarding topics were discussed with the seller.",
        { align: "center" }
      );
    doc.opacity(1);
    hr(doc);

    // ---------- SUMMARY ----------
    sectionTitle(doc, "Call Summary");
    doc.fontSize(11).text(reportJson.call_summary || "N/A");
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Language Notes: ${reportJson.language_notes || "N/A"}`);
    hr(doc);

    // ---------- CHECKLIST OVERVIEW ----------
    sectionTitle(doc, "Checklist Overview");
    drawChecklistTable(doc, reportJson.questions || []);
    hr(doc);

    // ---------- DETAILED FINDINGS ----------
    sectionTitle(doc, "Detailed Findings");

    (reportJson.questions || []).forEach((q) => {
      ensureSpace(doc, 140);

      const discussed = q.discussed ?? q.mentioned ?? false;

      doc.fontSize(12).text(`${q.id}. ${q.title}`);
      doc.fontSize(10)
        .opacity(0.9)
        .text(
          `Discussed: ${yesNo(discussed)} | Confidence: ${fmtConfidence(q.confidence)}`
        );
      doc.opacity(1);
      doc.moveDown(0.3);

      doc.fontSize(10).text(
        `Formal Response: ${q.formal_response ?? q.answer ?? "Not discussed."}`
      );

      if (Array.isArray(q.evidence) && q.evidence.length) {
        doc.moveDown(0.3);
        doc.fontSize(10).text("Evidence:");
        q.evidence.slice(0, 3).forEach((e, i) => {
          const ts =
            e.start_sec != null && e.end_sec != null
              ? ` [${e.start_sec}s–${e.end_sec}s]`
              : "";
          doc.text(`  ${i + 1})${ts} "${e.quote}"`);
        });
      }

      if (q.notes) {
        doc.moveDown(0.3);
        doc.fontSize(10).text(`Notes: ${q.notes}`);
      }

      hr(doc);
    });

    // ---------- MISSING TOPICS ----------
    const missing = reportJson.missing_topics ?? reportJson.missing_items ?? [];
    if (missing.length) {
      sectionTitle(doc, "Missing / Not Discussed Topics");
      missing.forEach((m) => doc.fontSize(10).text(`• ${m}`));
      hr(doc);
    }

    // ---------- FINAL AUDIT SUMMARY ----------
    if (reportJson.final_audit_summary) {
      sectionTitle(doc, "Final Audit Summary");
      doc.fontSize(11).text(reportJson.final_audit_summary);
    }

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
