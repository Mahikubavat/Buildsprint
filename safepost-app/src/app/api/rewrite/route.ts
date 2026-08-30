import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    let requestBody: {
      body?: string;
      region?: string;
      platform?: string;
      role?: string;
      audience?: string;
    } = {};

    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const { body, region, platform, role, audience } = requestBody;

    if (!body || !body.trim()) {
      return NextResponse.json({ error: "A post body is required." }, { status: 400 });
    }

    const userApiKey = request.headers.get("x-gemini-api-key");
    const key = userApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: "Gemini API key is required. Please set your Gemini API key in Profile settings." },
        { status: 400 }
      );
    }

    const promptText = `You are SafePost AI, an expert content safety and risk mitigation engine.
Analyze the provided draft text for target region "${region || "Global"}" and target platform "${platform || "social media"}".

Your task:
1. Evaluate riskScore between 0 (completely safe) and 100 (extreme risk).
2. Identify specific offensive, hostile, risky, or non-compliant phrases, words, or sentences in "flaggedPhrases".
3. Provide "suggestedRewrite" where ONLY non-compliant/risky parts are softened/rewritten and all safe, compliant sentences are kept COMPLETELY UNCHANGED.

User Context:
Role: ${role || "Creator"}
Audience: ${audience || "General"}

Draft text:
${body}

CRITICAL: Return ONLY a valid JSON object matching this exact structure:
{
  "riskScore": 35,
  "flaggedPhrases": ["exact risky phrase 1", "exact risky phrase 2"],
  "suggestedRewrite": "Full draft with only non-compliant parts softened and safe parts untouched"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(key)}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      let errDetail = "";
      try {
        const errorJson = await response.json();
        errDetail = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errDetail = await response.text();
      }
      return NextResponse.json(
        { error: `Gemini API Error (${response.status}): ${errDetail}` },
        { status: response.status >= 500 ? 502 : 400 }
      );
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    let parsed: { riskScore?: number; flaggedPhrases?: string[]; suggestedRewrite?: string } = {};

    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleanText = rawText.replace(/```json|```/g, "").trim();
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        parsed = { riskScore: 15, flaggedPhrases: [], suggestedRewrite: rawText || body };
      }
    }

    return NextResponse.json({
      source: "gemini",
      riskScore: parsed.riskScore ?? 15,
      flaggedPhrases: parsed.flaggedPhrases || [],
      suggestedRewrite: parsed.suggestedRewrite || body,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
