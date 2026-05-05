import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { CalculationRuleKeys, CALCULATION_RULES } from "@/lib/calculationRules";

const FEATURE_FLAG_EMAIL = "matheus.besnos@o2inc.com.br";

interface CalculationInfoPopoverProps {
  ruleKey: CalculationRuleKeys;
}

export function CalculationInfoPopover({ ruleKey }: CalculationInfoPopoverProps) {
  const { user } = useAuth();
  if (user?.email !== FEATURE_FLAG_EMAIL) return null;

  const rule = CALCULATION_RULES[ruleKey];
  if (!rule) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground/60 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Regra de cálculo: ${rule.title}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" side="top" align="start">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{rule.title}</p>
          <p className="text-xs text-muted-foreground">{rule.description}</p>
        </div>
        <div className="rounded-md bg-muted p-2.5">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
            {rule.pseudocode}
          </pre>
        </div>
      </PopoverContent>
    </Popover>
  );
}
