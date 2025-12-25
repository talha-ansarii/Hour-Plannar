import "server-only";

import { env } from "@/env";
import { GoogleGenerativeAI } from "@google/generative-ai";

type GeminiRewriteResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

export async function rewriteSummaryWithGemini(input: {
  date: string;
  deterministicSummary: string;
}): Promise<GeminiRewriteResult> {
  // 1. Validate API Key
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      ok: false,
      error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured.",
    };
  }

  try {
    // 2. Initialize Client
    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured." };
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use gemini-1.5-flash as the equivalent to gpt-4o-mini (fast/cheap)
    // or gemini-1.5-pro for higher reasoning capabilities.
    const modelName = "gemini-2.5-flash";

    const model = genAI.getGenerativeModel({
      model: modelName,
      // 3. Move rules to system instructions for better adherence
      systemInstruction: [
        "You are an assistant that rewrites a user's daily planning log into a crisp, structured summary.",
        "Rules:",
        "- Do NOT invent tasks or facts.",
        "- Keep it concise and actionable.",
        "- Include: top plan themes, completed highlights, reflections/insights, and what was deferred if mentioned.",
        "- Output plain text only (no markdown fences).",
      ].join("\n"),
    });

    // 4. Construct the user prompt
    const userPrompt = `Date: ${input.date}\n\nSource summary:\n${input.deterministicSummary}`;

    // 5. Generate content with a timeout (12s)
    const result = await model.generateContent(
      {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      },
      {
        timeout: 12_000,
      },
    );

    const response = result.response;
    const out = response.text().trim();

    if (!out) return { ok: false, error: "Gemini returned empty output." };

    return { ok: true, text: out, model: modelName };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    // Check for specific GoogleGenerativeAIError types if needed in the future
    return { ok: false, error: msg };
  }
}

// Backwards-compatible alias (older call sites).
export const rewriteSummaryWithOpenAI = rewriteSummaryWithGemini;
