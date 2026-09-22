import { z } from "zod";
import { REACHER_PRODUCT_CODE } from "@/lib/config";
import { getAuthenticatedUser, getReacherAccount, hasReacherAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

// A buyer only ever reads and writes their own thread. An admin (the coach) must name which
// buyer's thread they mean, and Supabase RLS (private.is_reacher_admin()) is what actually
// grants that cross-account access — this just decides which user_id the request is about and
// which role's authorship to stamp on new messages. Access itself is enforced in Postgres.
type AuthResult =
  | { error: Response; threadUserId?: undefined; isAdmin?: undefined }
  | { error?: undefined; threadUserId: string; isAdmin: boolean };

async function authorize(requestedUserId: string | null): Promise<AuthResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { error: Response.json({ error: "Authentication required" }, { status: 401 }) };
  const account = await getReacherAccount(user.id);
  if (!hasReacherAccess(account)) return { error: Response.json({ error: "Account access required" }, { status: 403 }) };

  const isAdmin = account.role === "admin";
  if (isAdmin) {
    if (!requestedUserId) return { error: Response.json({ error: "A userId is required for coach requests" }, { status: 400 }) };
    const parsedId = uuidSchema.safeParse(requestedUserId);
    if (!parsedId.success) return { error: Response.json({ error: "Invalid userId" }, { status: 400 }) };
    return { threadUserId: parsedId.data, isAdmin: true };
  }
  return { threadUserId: user.id, isAdmin: false };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auth = await authorize(searchParams.get("userId"));
  if (auth.error) return auth.error;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reacher_messages")
    .select("id, author, message, read, created_at")
    .eq("user_id", auth.threadUserId)
    .eq("product_code", REACHER_PRODUCT_CODE)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Message list failed", { code: error.code, message: error.message });
    return Response.json({ error: "Could not load messages" }, { status: 500 });
  }
  return Response.json({ messages: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

const sendSchema = z.object({
  userId: uuidSchema.optional(),
  message: z.string().trim().min(1, "Enter a message").max(2000, "Keep messages under 2000 characters"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid message" }, { status: 400 });

  const auth = await authorize(parsed.data.userId ?? null);
  if (auth.error) return auth.error;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("reacher_messages").insert({
    user_id: auth.threadUserId,
    product_code: REACHER_PRODUCT_CODE,
    author: auth.isAdmin ? "admin" : "buyer",
    message: parsed.data.message,
  });

  if (error) {
    console.error("Message send failed", { code: error.code, message: error.message });
    return Response.json({ error: "Could not send message" }, { status: 500 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}

const readSchema = z.object({ userId: uuidSchema.optional() });

// Marks the OTHER party's messages read — a buyer opening the thread clears unread admin
// messages, a coach opening a buyer's thread clears that buyer's unread messages. Nobody can
// mark their own messages read/unread; that has no meaning and is not exposed here.
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = readSchema.safeParse(body);
  const auth = await authorize(parsed.success ? parsed.data.userId ?? null : null);
  if (auth.error) return auth.error;

  const supabase = await createSupabaseServerClient();
  const otherAuthor = auth.isAdmin ? "buyer" : "admin";
  const { error } = await supabase
    .from("reacher_messages")
    .update({ read: true })
    .eq("user_id", auth.threadUserId)
    .eq("product_code", REACHER_PRODUCT_CODE)
    .eq("author", otherAuthor)
    .eq("read", false);

  if (error) {
    console.error("Message mark-read failed", { code: error.code, message: error.message });
    return Response.json({ error: "Could not update messages" }, { status: 500 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
