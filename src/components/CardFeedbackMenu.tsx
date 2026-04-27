import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type FeedbackCategory =
  | "problema"
  | "melhoria"
  | "duvida"
  | "dados"
  | "elogio";

export interface FeedbackTarget {
  id: string;
  title: string;
  area: string;
  description?: string;
  metadata?: Record<string, Json | undefined>;
}

interface CardFeedbackMenuProps {
  activeTab: string;
  companyId?: string;
  companyName?: string;
  targets: FeedbackTarget[];
  userId?: string;
}

const feedbackCategories: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "problema", label: "Problema" },
  { value: "melhoria", label: "Melhoria" },
  { value: "duvida", label: "Dúvida" },
  { value: "dados", label: "Dados" },
  { value: "elogio", label: "Elogio" },
];

const buildTaskTitle = (
  targetTitle: string,
  category: FeedbackCategory,
  message: string,
) => {
  const categoryLabel =
    feedbackCategories.find((item) => item.value === category)?.label ??
    "Feedback";
  const summary = message.replace(/\s+/g, " ").trim();

  return `[${categoryLabel}] ${targetTitle}: ${summary}`.slice(0, 180);
};

export function CardFeedbackMenu({
  activeTab,
  companyId,
  companyName,
  targets,
  userId,
}: CardFeedbackMenuProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("melhoria");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTarget = useMemo(
    () =>
      targets.find((target) => target.id === selectedTargetId) ?? targets[0],
    [selectedTargetId, targets],
  );

  useEffect(() => {
    if (!targets.length) {
      setSelectedTargetId("");
      return;
    }

    if (!targets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(targets[0].id);
    }
  }, [selectedTargetId, targets]);

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();

    if (!companyId) {
      toast({
        title: "Selecione uma empresa",
        description: "Escolha a empresa ativa antes de enviar feedback.",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Sessão expirada",
        description: "Entre novamente para enviar feedback.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTarget) {
      toast({
        title: "Selecione um card",
        description: "Escolha o card ou análise relacionado ao feedback.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedMessage.length < 3) {
      toast({
        title: "Feedback muito curto",
        description: "Escreva pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const metadata: Json = {
      active_tab: activeTab,
      company_name: companyName ?? null,
      page_path: window.location.pathname,
      target_description: selectedTarget.description ?? null,
      target_metadata: selectedTarget.metadata ?? {},
    };

    const { error } = await supabase.from("card_feedback").insert({
      company_id: companyId,
      created_by: userId,
      card_id: selectedTarget.id,
      card_title: selectedTarget.title,
      analysis_area: selectedTarget.area,
      category,
      message: trimmedMessage,
      task_title: buildTaskTitle(selectedTarget.title, category, trimmedMessage),
      metadata,
    });

    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Erro ao enviar feedback",
        description: "Não foi possível salvar o feedback agora.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Feedback enviado",
      description: "Obrigado. O retorno ficou salvo para triagem.",
    });
    setMessage("");
    setCategory("melhoria");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          className="fixed bottom-5 right-5 z-40 h-12 border border-primary/20 px-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition-[color,background-color,border-color,box-shadow,transform] hover:shadow-[0_20px_46px_rgba(0,0,0,0.28)]"
          aria-label="Enviar feedback sobre um card"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Feedback
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={12}
        className="z-50 w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-[0_24px_64px_rgba(0,0,0,0.28)] sm:w-[420px]"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-foreground">
                Feedback do card
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedTarget?.area ?? "Dashboard"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-target" className="text-xs">
              Card ou análise
            </Label>
            <Select
              value={selectedTarget?.id ?? ""}
              onValueChange={setSelectedTargetId}
            >
              <SelectTrigger id="feedback-target">
                <SelectValue placeholder="Selecione um card" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-category" className="text-xs">
              Tipo
            </Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as FeedbackCategory)}
            >
              <SelectTrigger id="feedback-category">
                <SelectValue placeholder="Tipo de feedback" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {feedbackCategories.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message" className="text-xs">
              Feedback
            </Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              placeholder="Escreva o que deveria mudar, o que parece errado ou o que ficou confuso."
              className="min-h-28 resize-none"
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {message.length}/2000
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar feedback
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
