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

  const systemPrompt = `You are an expert Indian mutual fund analyst. Analyse CAMS consolidated account statements.
Always respond with ONLY a valid JSON object — no markdown, no explanation, no extra text.
If the text doesn't look like a CAMS statement, still return your best guess JSON based on whatever fund data you can find, with placeholder values where data is missing.`;

  const userPrompt = `Analyse this CAMS mutual fund statement and return a JSON object with EXACTLY these fields:
- totalValue: number (total portfolio value in rupees, e.g. 2847350)
- xirr: number (annualised XIRR return as a percentage, e.g. 14.2)
- numberOfFunds: number (count of distinct fund schemes)
- expenseDrag: number (weighted average expense ratio as percentage, e.g. 0.84)
- funds: array of objects, each with { name: string, percentage: number } — top 9 funds by value, percentages must sum to 100
- overlapWarning: string (2-4 sentences describing stock/sector overlaps between funds, naming specific funds and overlapping stocks)
- rebalancingAdvice: string (5-6 bullet-point numbered recommendations in plain English for rebalancing, each on a new line starting with number and period)

Statement text:
${text.slice(0, 12000)}`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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
