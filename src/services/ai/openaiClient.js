import OpenAI from "openai";
import 'dotenv/config'
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI
});

export default openai;
