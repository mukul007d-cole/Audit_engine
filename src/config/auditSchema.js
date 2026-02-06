export const questions = [
  { id: 1, title: "Email ID", intent: "email_verified" },
  { id: 2, title: "Contact Number", intent: "phone_verified" },
  { id: 3, title: "Address + PIN", intent: "address_and_pincode_confirmed" },
  { id: 4, title: "Bank Last 3 Digits", intent: "bank_last3digit_verified" },
  { id: 5, title: "Add Product Process", intent: "product_listing_explained" },
  { id: 6, title: "Handling Time", intent: "handling_time_discussed" },
  { id: 7, title: "Holiday Mode", intent: "amazon_vacation_mode_explained" },
  { id: 8, title: "Charges", intent: "fees_discussed" },
  { id: 9, title: "Products + Prices", intent: "products_and_prices_discussed" },
  { id: 10, title: "Stock Availability", intent: "stock_confirmed" },
  { id: 11, title: "FBA Intro", intent: "fba_introduced" },
  { id: 12, title: "Payment Policy", intent: "payment_policy_explained/discussed" },
  { id: 13, title: "Ready to Ship", intent: "ready_to_ship_confirmed" }
];



export const extractionSchema = {
  name: "CallAuditReport",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      call_summary: { type: "string" },

      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "integer" },
            title: { type: "string" },
            discussed: { type: "boolean" },
            evidence: {
              type: "array",
              maxItems: 1,
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
            }
          },
          required: ["id", "title", "discussed", "evidence"]
        }
      },
      final_answer: { type: "string", enum: ["Yes", "No"] }
    },
    required: ["call_summary", "questions", "final_answer"]
  }
};
