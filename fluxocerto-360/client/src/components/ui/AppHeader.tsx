import type { ReactNode } from "react";

import BrandLogo from "@/components/ui/BrandLogo";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  rightActions?: ReactNode;
};

export function AppHeader({ title, subtitle, rightActions }: AppHeaderProps) {
  return (
    <header className="fd-app-header">
      <div className="fd-app-header-brand">
        <div className="fd-app-header-icon" aria-hidden="true">
          <BrandLogo variant="icon" className="h-12 w-12 object-contain" fallbackClassName="fd-app-header-icon-fallback" />
        </div>

        <div className="fd-app-header-copy">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      {rightActions ? <div className="fd-app-header-actions">{rightActions}</div> : null}
    </header>
  );
}

export default AppHeader;
