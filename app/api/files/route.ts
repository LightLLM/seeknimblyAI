import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "Server configuration error: OpenAI API key not configured." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body." },
      { status: 400 }
    );
  }

  const entries = Array.from(formData.entries()).filter(
    (entry): entry is [string, File] => entry[1] instanceof File
  );
  const files = entries.map(([, file]) => file).filter((f) => f.size > 0);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files provided." },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 8 MB limit.` },
        { status: 413 }
      );
    }
    const type = file.type?.toLowerCase() || "";
    const allowed = ALLOWED_TYPES.has(type) || type.startsWith("text/");
    if (!allowed) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.name}. Use PDF, text, images, or CSV.` },
        { status: 400 }
      );
    }
  }

  const openai = new OpenAI({ apiKey });
  const results: { file_id: string; filename: string }[] = [];

  for (const file of files) {
    try {
      const uploaded = await openai.files.create({
        file: file as unknown as File,
        purpose: "user_data",
      });
      results.push({ file_id: uploaded.id, filename: file.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      console.error("[api/files]", message, err);
      return NextResponse.json(
        { error: `Failed to upload "${file.name}": ${message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ files: results });
}
