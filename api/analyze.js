import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, examId } = req.body;

    if (!prompt || !examId) {
      return res.status(400).json({ error: "Missing prompt or examId." });
    }

    const baseUrl = `${req.headers.origin}/exam/math/`;
    const imageMessages = [];

    // Auto-detect all question pages
    for (let i = 1; i <= 10; i++) {
      const url = `${baseUrl}${examId}page${i}.png`;
      try {
        const head = await fetch(url, { method: 'HEAD' });
        if (head.ok) {
          imageMessages.push({ type: "image_url", image_url: { url } });
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // Add answer key last
    imageMessages.push({
      type: "image_url",
      image_url: { url: `${baseUrl}${examId}answers.png` }
    });

    const fullPrompt = `
You are a Form 2 Mathematics tutor in Hong Kong.

You will be given:
1. A student's math question (text or image)
2. One or more exam pages containing math questions
3. A final image containing the answer key (e.g. ${examId}answers.png)

Your job is to:
- Solve the question.
- Use the final image only to check if your solution is correct.
- Explain your reasoning in clear, step-by-step English suitable for a 13–14 year old.
- If your answer differs from the key, explain why and what might have gone wrong.
`.trim();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: fullPrompt },
        { role: "user", content: [
          { type: "text", text: prompt },
          ...imageMessages
        ]}
      ]
    });

    const english = response.choices[0]?.message?.content?.trim() || "";

    const chineseResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "你是一名英語數學翻譯員。請將下列英文數學內容完整翻譯為簡體中文，不要添加或省略。"
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
    console.error("GPT Vision error:", error);
    return res.status(500).json({
      error: "Internal server error",
      detail: error.message || "Unknown GPT error"
    });
  }
}
