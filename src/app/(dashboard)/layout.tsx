import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { ToastProvider } from "@/components/dashboard/toast";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar userName={session.name ?? session.email} />
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
    </ToastProvider>
  );
}
