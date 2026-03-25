import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/analyse", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || text.trim().length < 50) {
    res.status(400).json({ error: "PDF text too short or missing. Please upload a valid CAMS statement." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    return;
  }

  const prompt = `You are an expert SEBI-registered Indian mutual fund analyst. Analyse this CAMS mutual fund statement carefully and return ONLY a raw JSON object with zero extra text, no markdown, no explanation. JSON fields required: totalValue (number, current portfolio value in rupees), amountInvested (number, total invested), totalGain (number, profit or loss), xirr (number, annualised return %), numberOfFunds (number), expenseDrag (number, avg expense ratio %), funds (array of objects with name and percentage), overlapWarning (string, mention specific fund names if overlap found), rebalancingAdvice (string, 3 specific sentences mentioning actual fund names), portfolioScore (number 0-100), scoreReason (string, one sentence). Statement text: ${text.slice(0, 12000)}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Groq API error");
      res.status(502).json({ error: "Groq API returned an error. Please try again." });
      return;
    }

    const groqData = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = groqData.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: "Empty response from Groq API." });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      req.log.error({ content }, "Failed to parse Groq JSON response");
      res.status(502).json({ error: "AI returned an invalid response. Please try again." });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Failed to call Groq API");
    res.status(500).json({ error: "Failed to reach Groq API. Check your network and API key." });
  }
});

export default router;
