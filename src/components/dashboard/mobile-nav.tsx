"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Globe, Plus, Rocket, Settings } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/websites", label: "Websites", icon: Globe },
  { href: "/dashboard/projects/new", label: "Create", icon: Plus, primary: true },
  { href: "/dashboard/deployments", label: "Deploys", icon: Rocket },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur border-t border-neutral-800/80 flex items-center justify-around px-2 py-2 safe-b">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] ${
              item.primary
                ? "bg-neutral-100 text-neutral-950"
                : active
                ? "text-neutral-100"
                : "text-neutral-500"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
