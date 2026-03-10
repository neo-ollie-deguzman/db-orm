"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Users, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";

const navItems = [
  { label: "Reminders", href: "/dashboard", icon: Bell },
  { label: "Users", href: "/users", icon: Users },
];

export function Sidebar({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-white">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
          {tenantName.charAt(0).toUpperCase()}
        </div>
        <span className="truncate text-lg font-semibold tracking-tight">
          {tenantName}
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-gray-400 hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <item.icon size={20} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-sidebar-hover hover:text-white disabled:opacity-50"
        >
          <LogOut size={18} className="shrink-0" />
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
