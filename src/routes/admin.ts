import { Hono } from "hono";
import type { Env } from "../env";
import { adminDashboard } from "../templates/admin-dashboard";

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.get("/admin", (c) => {
  return c.html(adminDashboard());
});
