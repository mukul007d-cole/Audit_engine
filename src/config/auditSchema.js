export const questions = [
  {
    id: 1,
    title: "Email ID confirmation",
    intent: "Check whether the seller's email ID was discussed or confirmed during the call."
  },
  {
    id: 2,
    title: "Contact number confirmation",
    intent: "Check whether the seller's contact number was discussed or confirmed."
  },
  {
    id: 3,
    title: "Address and PIN code confirmation",
    intent: "Check whether the seller's business address along with PIN code was discussed or confirmed."
  },
  {
    id: 4,
    title: "Bank account verification",
    intent: "Check whether the last three digits of the seller’s bank account were discussed or confirmed."
  },
  {
    id: 5,
    title: "Product listing process",
    intent: "Check whether the process of adding products on the platform was explained or discussed."
  },
  {
    id: 6,
    title: "Handling time discussion",
    intent: "Check whether order handling time was discussed or confirmed."
  },
  {
    id: 7,
    title: "Holiday and vacation settings",
    intent: "Check whether holiday or vacation mode and how to make the account inactive were discussed."
  },
  {
    id: 8,
    title: "Charges and fees discussion",
    intent: "Check whether commissions, referral fees, fixed closing fees, bank charges, shipping or delivery charges, and cancellation charges were discussed."
  },
  {
    id: 9,
    title: "Product and pricing confirmation",
    intent: "Check whether at least five products along with their prices were discussed."
  },
  {
    id: 10,
    title: "Stock availability confirmation",
    intent: "Check whether availability of stock for all discussed products was confirmed."
  },
  {
    id: 11,
    title: "Introduction to FBA",
    intent: "Check whether Fulfilled by Amazon (FBA) was introduced or explained."
  },
  {
    id: 12,
    title: "Payment policy discussion",
    intent: "Check whether the payment policy and settlement process were discussed or explained."
  },
  {
    id: 13,
    title: "Ready-to-ship confirmation",
    intent: "Check whether the seller confirmed readiness to ship orders/start selling."
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


// phone number discussed or not


// bank acc's last 3 digits discussed / confirmed


// Account training 