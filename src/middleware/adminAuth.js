import { ADMIN_TOKEN } from "../config/constants.js";

export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized admin access" });
  }

  return next();
}
