import { useTheme } from "next-themes";
import logoGreen from "@/assets/o2-logo-green.png";
import logoDark from "@/assets/o2-logo-dark.png";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Logo({ className = "", size = "md" }: LogoProps) {
  const { theme } = useTheme();
  
  const sizeClasses = {
    sm: "h-8",
    md: "h-12",
    lg: "h-16",
    xl: "h-24"
  };

  const logo = theme === "dark" ? logoGreen : logoDark;

  return (
    <img 
      src={logo} 
      alt="O2 Logo" 
      className={`${sizeClasses[size]} w-auto object-contain ${className}`}
    />
  );
}
