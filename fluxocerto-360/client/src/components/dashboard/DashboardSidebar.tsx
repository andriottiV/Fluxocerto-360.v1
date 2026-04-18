import { LogOut } from "lucide-react";

import { SIDEBAR_ITEMS, type DashboardRoutePath } from "./sidebarConfig";

type DashboardSidebarProps = {
  activePath: DashboardRoutePath;
  isAdmin: boolean;
  onNavigate: (path: DashboardRoutePath) => void;
  onLogout: () => void;
};

export default function DashboardSidebar({
  activePath,
  isAdmin,
  onNavigate,
  onLogout,
}: DashboardSidebarProps) {
  const visibleItems = SIDEBAR_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="fd-sidebar">
      <div className="fd-sidebar-brand" aria-label="FluxoCerto 360">
        <img
          src="/icon.png"
          alt="FluxoCerto"
          className="fd-sidebar-logo-full"
          style={
            {
              width: "36px",
              height: "36px",
              display: "block",
              objectFit: "contain",
            }
          }
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </div>

      <nav className="fd-nav">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.path;

          return (
            <button
              key={item.id}
              title={item.label}
              aria-label={item.label}
              onClick={() => onNavigate(item.path)}
              className={`fd-nav-item ${isActive ? "active" : ""}`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="fd-sidebar-footer">
        <button
          type="button"
          title="Logout"
          aria-label="Logout"
          className="fd-nav-item"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
