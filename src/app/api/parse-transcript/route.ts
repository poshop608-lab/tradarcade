import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const schema = z.object({
  terms: z
    .array(
      z.object({
        term: z.string().describe("Single trading vocabulary word, ALL CAPS"),
        definition: z.string().describe("Clear, concise definition"),
        category: z.string().optional().describe("e.g. Technical Analysis, Risk Management"),
      })
    )
    .describe("6–15 key single-word trading terms"),

  concepts: z
    .array(
      z.object({
        label: z.string().describe("3–6 word phrase describing a trading behavior or setup"),
        isValid: z.boolean().describe("true = good practice, false = bad/risky behavior"),
        explanation: z.string().optional().describe("Why it is valid or invalid"),
      })
    )
    .describe("8–16 trading concepts — mix of valid and invalid"),

  rules: z
    .array(
      z.object({
        rule: z.string().describe("A complete declarative statement about trading"),
        description: z.string().describe("Elaboration or context for the rule"),
        isTrue: z.boolean().describe("Whether the statement is true"),
      })
    )
    .describe("4–10 true/false trading rules"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.transcript || typeof body.transcript !== "string") {
    return NextResponse.json({ error: "transcript string required" }, { status: 400 });
  }

  const transcript = body.transcript.slice(0, 500_000);

  try {
    const { output } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      output: Output.object({ schema }),
      prompt: `Extract structured trading education content from this mentor transcript or course notes.

Guidelines:
- terms: SINGLE words only (used in Wordle/Hangman). ALL CAPS. Key trading vocabulary.
- concepts: Short phrases (3–6 words). isValid=true for good practice, isValid=false for bad/risky behavior. Keep labels punchy.
- rules: Full declarative sentences that test trading knowledge. Include both true and false statements.

Transcript:
${transcript}`,
    });

    return NextResponse.json(output);
  } catch (err: unknown) {
    console.error("[parse-transcript]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
