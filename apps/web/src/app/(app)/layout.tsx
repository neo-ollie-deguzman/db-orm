import { Sidebar } from "@/components/sidebar";
import { getTenantContext } from "@/lib/tenant";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { name } = await getTenantContext();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar tenantName={name} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
