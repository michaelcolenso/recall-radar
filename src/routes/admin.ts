import { Hono } from "hono";
import type { Context } from "hono";
import { adminDashboard } from "../templates/admin-dashboard";

export const adminRoutes = new Hono<{ Bindings: Env }>();

function requireAdminAuth(c: Context): Response | null {
  const auth = c.req.header("Authorization");
  const token = c.env.ADMIN_TOKEN;
  if (!auth || !token) {
    return c.text("Unauthorized", 401);
  }
  const expected = `Bearer ${token}`;
  if (auth.length !== expected.length) {
    return c.text("Unauthorized", 401);
  }
  // Constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(auth);
  const b = encoder.encode(expected);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  if (mismatch !== 0) {
    return c.text("Unauthorized", 401);
  }
  return null;
}

adminRoutes.get("/admin", async (c) => {
  const denied = requireAdminAuth(c);
  if (denied) return denied;
  return c.html(adminDashboard());
});
