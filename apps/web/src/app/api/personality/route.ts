import { NextResponse } from "next/server";
import { synthesizeProfile } from "@jamot/archetype-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { birthDate, birthHour = 12.0, timezone = 0, birthLocation = "" } = body;

    if (!birthDate) {
      return NextResponse.json(
        { error: "birthDate (YYYY-MM-DD) is required" },
        { status: 400 }
      );
    }

    const profile = synthesizeProfile({
      birthDate,
      birthHour: Number(birthHour),
      timezone: Number(timezone),
      birthLocation
    });

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("Personality calculation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to calculate profile" },
      { status: 500 }
    );
  }
}
