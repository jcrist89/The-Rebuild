import { z } from "zod";
import { REACHER_PRODUCT_CODE } from "@/lib/config";
import { getAuthenticatedUser, getReacherAccount, hasReacherAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const trackerStateSchema = z.object({
  version: z.literal(1),
  onboarded: z.boolean(),
  profile: z.record(z.string(), z.unknown()),
  program: z.record(z.string(), z.unknown()),
  timers: z.record(z.string(), z.unknown()).optional(),
  substitutions: z.record(z.string(), z.unknown()),
  logs: z.array(z.unknown()).max(5000),
  weights: z.array(z.unknown()).max(1000),
  waists: z.array(z.unknown()).max(1000),
  measurements: z.array(z.unknown()).max(250),
  daily: z.record(z.string(), z.unknown()),
  food: z.record(z.string(), z.unknown()),
}).strict();

async function authorize() {
  const user = await getAuthenticatedUser();
  if (!user) return { error: Response.json({ error: "Authentication required" }, { status: 401 }) };
  if (!hasReacherAccess(await getReacherAccount(user.id))) return { error: Response.json({ error: "Account access required" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reacher_tracker_states")
    .select("state, updated_at")
    .eq("user_id", auth.user.id)
    .eq("product_code", REACHER_PRODUCT_CODE)
    .maybeSingle();

  if (error) {
    console.error("Tracker state read failed", { code: error.code, message: error.message });
    return Response.json({ error: "Could not load progress" }, { status: 500 });
  }
  return Response.json({ state: data?.state ?? null, updatedAt: data?.updated_at ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 1_000_000) return Response.json({ error: "Progress data is too large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = trackerStateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid tracker data" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("reacher_tracker_states").upsert({
    user_id: auth.user.id,
    product_code: REACHER_PRODUCT_CODE,
    state: parsed.data,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,product_code" });

  if (error) {
    console.error("Tracker state write failed", { code: error.code, message: error.message });
    return Response.json({ error: "Could not save progress" }, { status: 500 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
