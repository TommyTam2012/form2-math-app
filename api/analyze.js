import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { examId, page, officialAnswer } = req.body;

    if (!examId || !page || !officialAnswer) {
      return res.status(400).json({ error: "Missing examId, page, or officialAnswer." });
    }

    const imageUrl = `${process.env.BASE_URL}/exam/math/${examId}page${page}.png`;
    const answerUrl = `${process.env.BASE_URL}/exam/math/${examId}answers.png`;

    // ✅ Optional: Check if image exists before sending to GPT
    const testImage = await fetch(imageUrl, { method: "HEAD" });
    if (!testImage.ok) {
      return res.status(404).json({ error: `Missing question image: ${imageUrl}` });
    }

    const systemPrompt = `
You are a Form 2 Mathematics tutor in Hong Kong.

You will be given:
1. An image of a student's math question (from a scanned worksheet)
2. The official answer for that question

Your job:
1. Read and understand the math question in the image.
2. Solve it on your own.
3. Compare your answer with the official answer provided.
4. If they match, explain why the official answer is correct using simple, step-by-step logic.
5. If they differ, explain the correct method and identify the error in the official answer (if any).
6. Use simple English suitable for a 13–14 year old student.
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `This is page ${page} of exam ${examId}. Please analyze the question shown.`
      },
      {
        role: "user",
        content: { type: "image_url", image_url: { url: imageUrl } }
      },
      {
        role: "user",
        content: `Official Answer: ${officialAnswer}`
      },
      {
        role: "user",
        content: { type: "image_url", image_url: { url: answerUrl } }
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages
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
