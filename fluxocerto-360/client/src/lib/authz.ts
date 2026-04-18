import { User } from "@/lib/types";

export function isAdmin(user: User | null | undefined) {
  return !!user && user.role === "admin" && user.status === "active";
}

export function isActive(user: User | null | undefined) {
  return !!user && user.status === "active";
}

export function canAccessAdmin(user: User | null | undefined) {
  return isAdmin(user);
}
