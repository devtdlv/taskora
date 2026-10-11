import { NextResponse } from "next/server";

// JSON cannot encode undefined, so undefined always means the body failed to parse.
export async function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined);
}

export function invalidJsonResponse() {
  return NextResponse.json(
    {
      error: "INVALID_JSON",
      message: "The request body must be valid JSON.",
    },
    { status: 400 },
  );
}
