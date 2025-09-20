import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipKeys, TOOLTIP_REGISTRY } from "@/lib/tooltips";

/**
 * Hook that provides tooltip functionality with mandatory registration
 * Forces developers to document components before implementation
 */
export const useTooltip = (key: TooltipKeys) => {
  const tooltipText = TOOLTIP_REGISTRY[key];
  
  if (!tooltipText) {
    console.error(`Tooltip não registrado para a chave: ${key}`);
    return {
      TooltipWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
      tooltipText: "Tooltip não documentado"
    };
  }

  const TooltipWrapper = ({ 
    children, 
    side = "top" as "top" | "bottom" | "left" | "right",
    className = "max-w-xs"
  }: { 
    children: ReactNode;
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        <p className="text-sm">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );

  return {
    TooltipWrapper,
    tooltipText
  };
};

/**
 * Type for props that require tooltip documentation
 */
export interface TooltipRequired {
  tooltipKey: TooltipKeys;
}

/**
 * HOC that enforces tooltip documentation for components
 */
export const withTooltip = <P extends object>(
  Component: React.ComponentType<P>,
  tooltipKey: TooltipKeys
) => {
  return (props: P) => {
    const { TooltipWrapper } = useTooltip(tooltipKey);
    
    return (
      <TooltipWrapper>
        <Component {...props} />
      </TooltipWrapper>
    );
  };
};