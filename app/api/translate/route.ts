import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, target } = await req.json();

    if (!text || !target) {
      return NextResponse.json(
        { error: "Missing text or target" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing GOOGLE_TRANSLATE_API_KEY" },
        { status: 500 }
      );
    }

    const googleRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          q: text,
          target,
        }),
        cache: "no-store",
      }
    );

    const data = await googleRes.json();

    if (!googleRes.ok) {
      return NextResponse.json(
        { error: data },
        { status: googleRes.status }
      );
    }

    const translatedText = data?.data?.translations?.[0]?.translatedText;

    return NextResponse.json({ translatedText });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}