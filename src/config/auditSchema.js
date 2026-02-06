export const questions = [
  {
    id: 1,
    title: "Email ID discussion",
    intent: "Check whether the seller's email ID was discussed or confirmed during the call."
  },
  {
    id: 2,
    title: "Address discussion",
    intent: "Check whether the seller's business or residential address was discussed or confirmed."
  },
  {
    id: 3,
    title: "Product discussion",
    intent: "Check whether the products the seller plans to sell were discussed."
  },
  {
    id: 4,
    title: "Pricing discussion",
    intent: "Check whether product pricing, fees, and cost-related topics were discussed."
  },
  {
    id: 5,
    title: "Amazon Commercial discussion",
    intent: "Check whether Amazon Commercial or B2B selling was discussed."
  },
  {
    id: 6,
    title: "Cancellation penalties discussion",
    intent: "Check whether cancellation charges, penalties, or consequences were discussed."
  },
  {
    id: 7,
    title: "Introduction of FBA",
    intent: "Check whether Fulfilled by Amazon (FBA) was introduced or explained."
  },
  {
    id: 8,
    title: "Permission to go live and launch readiness",
    intent: "Check whether permission to make the account live and seller readiness for launch were discussed."
  }
];

export const extractionSchema = {
  name: "CallAuditReport",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      call_summary: { type: "string" },
      language_notes: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "integer" },
            title: { type: "string" },
            discussed: { type: "boolean" },
            formal_response: { type: "string" },
            confidence: { type: "number" },
            evidence: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  quote: { type: "string" },
                  start_sec: { type: ["number", "null"] },
                  end_sec: { type: ["number", "null"] }
                },
                required: ["quote", "start_sec", "end_sec"]
              }
            },
            notes: { type: "string" }
          },
          required: [
            "id",
            "title",
            "discussed",
            "formal_response",
            "confidence",
            "evidence",
            "notes"
          ]
        }
      },
      missing_topics: { type: "array", items: { type: "string" } },
      final_audit_summary: { type: "string" }
    },
    required: ["call_summary", "language_notes", "questions", "missing_topics", "final_audit_summary"]
  }
};
