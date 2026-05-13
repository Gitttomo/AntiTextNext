import Link from "next/link";

export function AdminUserLink({
  id,
  name,
  className = "font-bold text-primary hover:underline",
}: {
  id?: string | null;
  name?: string | null;
  className?: string;
}) {
  if (!id) return <>-</>;

  const label = name?.trim() || id.slice(0, 8);

  return (
    <Link href={`/admin/users/${id}`} title={`管理ID: ${id}`} className={className}>
      {label}
    </Link>
  );
}
