import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI
});

export default openai;
