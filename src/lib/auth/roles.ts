import type { Role } from "@/lib/db/schema";

export const ROLES: Role[] = ["owner", "admin", "member"];

export const ROLE_TH: Record<Role, string> = { owner: "แอดมินใหญ่", admin: "แอดมินเล็ก", member: "สมาชิก" };

export function parseRole(v: string | null | undefined): Role {
  return v === "owner" || v === "admin" ? v : "member";
}

/** Both admin tiers may open the admin pages. */
export function isAdmin(role: Role): boolean {
  return role === "owner" || role === "admin";
}

/** แอดมินใหญ่ manages every account; แอดมินเล็ก manages members only. */
export function canManage(actor: Role, target: Role): boolean {
  return actor === "owner" || (actor === "admin" && target === "member");
}

/** Roles an actor may give to an account they create or edit. */
export function assignableRoles(actor: Role): Role[] {
  return actor === "owner" ? ROLES : actor === "admin" ? ["member"] : [];
}
