import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIApiKey } from "@/lib/openai";

// Keep under Vercel serverless request body limit (4.5 MB)
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB
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

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: OpenAI API key not configured." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid multipart body.";
    return NextResponse.json(
      { error: msg },
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

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 4 MB limit. (Vercel allows ~4.5 MB total.)` },
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
  if (totalBytes > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Total upload size exceeds 4 MB. Upload fewer or smaller files." },
      { status: 413 }
    );
  }

  const openai = new OpenAI({ apiKey });
  const results: { file_id: string; filename: string }[] = [];

  for (const file of files) {
    try {
      // In Vercel serverless, FormData File may not work with the SDK; use Buffer + File
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileForApi = new File([buffer], file.name, { type: file.type || "application/octet-stream" });
      const uploaded = await openai.files.create({
        file: fileForApi,
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
