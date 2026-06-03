import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type NavItem = {
  to: string;
  icon: string;
  label: string;
  adminOnly?: boolean;
  match?: (path: string) => boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard",     icon: "🏢", label: "Отделы" },
  { to: "/crm",          icon: "📋", label: "CRM",          match: (p) => p.startsWith("/crm") && !p.startsWith("/crm/integrations") },
  { to: "/crm/integrations", icon: "🔌", label: "Интеграции", match: (p) => p.startsWith("/crm/integrations") },
  { to: "/team",         icon: "👥", label: "Команда",       adminOnly: true },
  { to: "/help",         icon: "📖", label: "Справочник" },
  { to: "/settings",     icon: "⚙️", label: "Настройки",    adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(item: NavItem) {
    if (item.match) return item.match(location.pathname);
    return location.pathname === item.to || location.pathname.startsWith(item.to + "/");
  }

  const visibleNav = NAV.filter((n) => !n.adminOnly || user?.role === "admin");

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 border-b border-[#E2E8F0] ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <Link to="/dashboard" className="font-bold text-[#2563EB] text-lg leading-none">
            AI Офис
          </Link>
        )}
        <button
          onClick={() => setCollapsed((p) => !p)}
          className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#1E293B] hover:bg-[#F1F5F9] transition-colors cursor-pointer text-sm"
          title={collapsed ? "Развернуть" : "Свернуть"}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Company */}
      {!collapsed && user && (
        <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
          <p className="text-[11px] text-[#94A3B8] uppercase tracking-wide font-medium mb-0.5">Компания</p>
          <p className="text-sm font-medium text-[#1E293B] truncate">{user.companyName}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {visibleNav.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors text-sm font-medium ${
                active
                  ? "bg-[#EFF6FF] text-[#2563EB]"
                  : "text-[#64748B] hover:bg-[#F8F9FA] hover:text-[#1E293B]"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className={`border-t border-[#E2E8F0] p-3 flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-sm font-semibold text-[#2563EB] shrink-0">
          {(user?.name ?? "?")[0].toUpperCase()}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#1E293B] truncate">{user?.name}</p>
            <p className="text-[11px] text-[#94A3B8] truncate">{user?.email}</p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="text-[#94A3B8] hover:text-red-500 cursor-pointer transition-colors p-1 rounded"
            title="Выйти"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-[#E2E8F0] flex-shrink-0 transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 bg-white h-full shadow-xl z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 h-12 bg-white border-b border-[#E2E8F0] flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-[#64748B] cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-[#2563EB]">AI Офис</span>
          <div className="w-5" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
