import { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-utils";
import { AdminShell } from "./_components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
