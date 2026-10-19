import type { NextRequest } from "next/server";
export function validOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const host = req.headers.get("host");
    if (!host) return false;
    const expected = new URL(`${req.nextUrl.protocol}//${host}`);
    return origin.origin === expected.origin;
  } catch {
    return false;
  }
}
