import { getAuthenticatedUser, getReacherAccount, hasReacherAccess } from "@/lib/auth";

// The training plan remains in this server-only module; it is never shipped in a public JS bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const program = require("../../../../program-data.js");

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (!hasReacherAccess(await getReacherAccount(user.id))) return Response.json({ error: "Account access required" }, { status: 403 });

  return Response.json(program, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
