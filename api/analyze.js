import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, officialAnswer } = req.body;

    if (!question || !officialAnswer) {
      return res.status(400).json({ error: "Missing question or official answer." });
    }

    // Step 1: GPT explains the answer
    const explanationResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
You are a Form 2 Mathematics tutor in Hong Kong.

Your job:
1. Read the student's math question.
2. Try to calculate your own answer.
3. Compare your answer with the official answer provided.
4. If they match, explain why the official answer is correct.
5. If they differ, explain the mistake and teach the correct method.
6. Use simple English, suitable for 13–14 year old students.
          `.trim()
        },
        {
          role: "user",
          content: `Question: ${question}\nOfficial Answer: ${officialAnswer}`
        }
      ]
    });

    const english = explanationResponse.choices[0]?.message?.content?.trim() || "";

    // Step 2: Translate to Simplified Chinese
    const chineseResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "你是一名翻譯員。請將下列英文內容完整翻譯為簡體中文，不要添加或省略。"
        },
        {
          role: "user",
          content: english
        }
      ]
    });

    const translated = chineseResponse.choices[0]?.message?.content?.trim() || "";

    return res.status(200).json({ response: english, translated });

  } catch (error) {
    console.error("GPT error:", error);
    return res.status(500).json({
      error: "Internal server error",
      detail: error.message || "Unknown GPT error"
    });
  }
}
