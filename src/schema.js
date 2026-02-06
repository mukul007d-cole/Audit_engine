export const questions = [
    {
      id: 1,
      title: "Email ID discussion",
      intent:
        "Check whether the seller's email ID was discussed or confirmed during the call."
    },
    {
      id: 2,
      title: "Address discussion",
      intent:
        "Check whether the seller's business or residential address was discussed or confirmed."
    },
    {
      id: 3,
      title: "Product discussion",
      intent:
        "Check whether the products the seller plans to sell were discussed."
    },
    {
      id: 4,
      title: "Pricing discussion",
      intent:
        "Check whether product pricing, fees, and cost-related topics were discussed."
    },
    {
      id: 5,
      title: "Amazon Commercial discussion",
      intent:
        "Check whether Amazon Commercial or B2B selling was discussed."
    },
    {
      id: 6,
      title: "Cancellation penalties discussion",
      intent:
        "Check whether cancellation charges, penalties, or consequences were discussed."
    },
    {
      id: 7,
      title: "Introduction of FBA",
      intent:
        "Check whether Fulfilled by Amazon (FBA) was introduced or explained."
    },
    {
      id: 8,
      title: "Permission to go live and launch readiness",
      intent:
        "Check whether permission to make the account live and seller readiness for launch were discussed."
    }
  ];
  
  export const extractionSchema = {
    name: "CallAuditReport",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        call_summary: {
          type: "string",
          description:
            "A concise 3–4 line professional summary of the call, written in formal audit language."
        },
  
        language_notes: {
          type: "string",
          description:
            "Notes about language usage such as Hindi, English, or Hinglish."
        },
  
        questions: {
          type: "array",
          description:
            "Audit checklist determining whether each required topic was discussed.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "integer" },
  
              title: { type: "string" },
  
              discussed: {
                type: "boolean",
                description:
                  "True only if the topic was explicitly discussed during the call."
              },
  
              formal_response: {
                type: "string",
                description:
                  "A formal, audit-ready description of what the seller or agent stated. If not discussed, clearly state that."
              },
  
              confidence: {
                type: "number",
                description:
                  "Confidence score between 0 and 1 based on clarity of discussion."
              },
  
              evidence: {
                type: "array",
                description:
                  "Direct quotes copied verbatim from the transcript that prove the discussion.",
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
  
              notes: {
                type: "string",
                description:
                  "Any ambiguity, partial discussion, or auditor remarks."
              }
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
  
        missing_topics: {
          type: "array",
          description:
            "List of mandatory topics that were not discussed during the call.",
          items: { type: "string" }
        },
  
        final_audit_summary: {
          type: "string",
          description:
            "Overall audit conclusion summarizing compliance, gaps, and readiness for seller onboarding."
        }
      },
      required: [
        "call_summary",
        "language_notes",
        "questions",
        "missing_topics",
        "final_audit_summary"
      ]
    }
  };
  