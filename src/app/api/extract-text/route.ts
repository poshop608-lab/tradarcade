import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  try {
    let text = "";

    if (name.endsWith(".docx")) {
      // mammoth extracts raw text from .docx
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

    } else if (name.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse(buffer);
      const result = await parser.getText();
      text = result.text;

    } else {
      // Plain text variants — .txt, .md, .rtf, .csv, .text, etc.
      text = buffer.toString("utf-8");
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "No readable text found in this file." }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (err: unknown) {
    console.error("[extract-text]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Extraction failed: ${msg}` }, { status: 500 });
  }
}
