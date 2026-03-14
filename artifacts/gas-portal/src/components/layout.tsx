import * as React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  PlusCircle,
  Search,
  Settings,
  LogOut,
  Droplet,
  Users,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isAdmin, isDeliveryLocked } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, locked: false },
    { href: "/add", label: "Add Delivery", icon: PlusCircle, locked: isDeliveryLocked },
    { href: "/search", label: "Search", icon: Search, locked: false },
    ...(isAdmin
      ? [
          { href: "/admin", label: "Admin Panel", icon: Users, locked: false },
          { href: "/settings", label: "Settings", icon: Settings, locked: false },
        ]
      : []),
  ];

  const closeMobile = () => setMobileOpen(false);

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <div className="p-6 lg:p-8 flex items-center gap-3">
        <div className="bg-primary/20 p-2 rounded-xl text-primary">
          <Droplet className="w-7 h-7 lg:w-8 lg:h-8" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-white tracking-tight leading-tight">
            GasPortal
          </h1>
          <p className="text-xs text-sidebar-foreground/60">Delivery Management</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 relative overflow-hidden group",
                isActive
                  ? "text-white bg-white/10"
                  : "text-sidebar-foreground/70 hover:text-white hover:bg-white/5",
                item.locked && "opacity-60"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute inset-0 bg-primary/20 border-l-4 border-primary rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon
                className={cn("w-5 h-5 relative z-10", isActive && "text-primary")}
              />
              <span className="relative z-10 flex-1">{item.label}</span>
              {item.locked && (
                <Lock className="w-3.5 h-3.5 relative z-10 text-rose-400" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-white/5 rounded-2xl p-4 mb-4 border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize truncate">
              {user?.role}
            </p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-medium text-sidebar-foreground/70 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-72 bg-sidebar text-sidebar-foreground flex-col shadow-2xl relative z-20">
        <SidebarContent />
      </aside>

      {/* ── Mobile: top header ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-sidebar text-sidebar-foreground flex items-center px-4 shadow-lg">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-sidebar-foreground/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
            <Droplet className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-white">GasPortal</span>
        </div>
        <div className="ml-auto w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
          {user?.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* ── Mobile: drawer overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60"
              onClick={closeMobile}
            />
            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 35 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl"
            >
              <button
                onClick={closeMobile}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-sidebar-foreground/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent onNav={closeMobile} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative pt-14 lg:pt-0">
        <div className="absolute top-0 left-0 w-full h-64 bg-primary/5 -z-10 blur-3xl rounded-b-full pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="min-h-full p-4 sm:p-6 lg:p-12 max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
