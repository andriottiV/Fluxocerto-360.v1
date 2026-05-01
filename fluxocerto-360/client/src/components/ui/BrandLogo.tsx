import { useState } from "react";

type BrandLogoVariant = "full" | "icon";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
};

const LOGO_SOURCES: Record<BrandLogoVariant, string> = {
  full: "/logo-full-new.png?v=1",
  icon: "/icon-new.png?v=1",
};

export function BrandLogo({
  variant = "full",
  className,
  fallbackClassName,
  alt = "FluxoCerto 360",
}: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <span className={fallbackClassName ?? className} aria-label={alt}>
        FluxoCerto
      </span>
    );
  }

  return (
    <img
      src={LOGO_SOURCES[variant]}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

export default BrandLogo;
