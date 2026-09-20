import React from "react";

interface PublicLayoutProps {
  children: React.ReactNode;
  onOpenAuthModal?: (config: {
    isOpen: boolean;
    mode: "login" | "register";
  }) => void;
  className?: string;
  contentClassName?: string;
}

// The application provides the single main landmark and shared footer.
const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  className,
  contentClassName,
}) => (
  <div className={`min-h-screen ${className || "bz-public"}`}>
    <div
      className={["mx-auto max-w-6xl px-4 py-10", contentClassName]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  </div>
);

export default PublicLayout;
