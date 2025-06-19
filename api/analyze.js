const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, messages } = req.body;

    if (!prompt || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid prompt/messages." });
    }

    const systemPrompt = 
You are a Form 2 Mathematics tutor in Hong Kong.

You will be given:
1. A student's math question (text or image)
2. Your job is to solve it and explain your steps clearly.

Use simple English suitable for 13–14 year old students.
Respond with friendly, clear explanations step by step.
.trim();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: messages }
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
