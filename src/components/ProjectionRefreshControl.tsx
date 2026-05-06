import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage, getEdgeFunctionResponseError } from "@/lib/edgeFunctionErrors";

type FetchBCBRatesResponse = {
  success?: boolean;
  errors?: string[] | null;
  recordsProcessed?: number;
  dateRange?: {
    end?: string;
  };
};

const INDEX_TYPES = ["CDI", "SELIC", "IPCA"];

const formatReferenceDate = (dateString?: string | null) => {
  if (!dateString) return "n/d";

  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

export function ProjectionRefreshControl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: latestReferenceDate, isLoading: isLoadingReferenceDate } = useQuery({
    queryKey: ["economic-indices", "latest-reference-date"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_indices")
        .select("reference_date")
        .in("index_type", INDEX_TYPES)
        .order("reference_date", { ascending: false })
        .limit(1);

      if (error) throw error;

      return data?.[0]?.reference_date ?? null;
    },
    staleTime: 1000 * 60 * 10,
  });

  const updateProjectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-bcb-rates", {
        body: {
          forceUpdate: true,
          daysBack: 30,
        },
      });

      if (error) {
        throw new Error(await getEdgeFunctionErrorMessage(
          error,
          "Não foi possível atualizar as projeções."
        ));
      }

      const responseError = getEdgeFunctionResponseError(
        data,
        "Não foi possível atualizar as projeções."
      );

      if (responseError) {
        throw new Error(responseError);
      }

      const response = data as FetchBCBRatesResponse | undefined;
      if (response?.errors?.length) {
        throw new Error(response.errors.join("; "));
      }

      return response;
    },
    onMutate: () => {
      toast({
        title: "Atualizando projeções",
        description: "Buscando dados mais recentes do BCB.",
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["economic-indices"] });
      toast({
        title: "Projeções atualizadas",
        description: response?.dateRange?.end
          ? `Dados do BCB atualizados até ${formatReferenceDate(response.dateRange.end)}.`
          : "Dados do BCB atualizados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar projeções",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isUpdating = updateProjectionMutation.isPending;
  const referenceLabel = isLoadingReferenceDate
    ? "Verificando data-base..."
    : `Base BCB: ${formatReferenceDate(latestReferenceDate)}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <span className="text-xs text-muted-foreground tabular-nums">
        {referenceLabel}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => updateProjectionMutation.mutate()}
        disabled={isUpdating}
        className="h-9 gap-2 transition-transform active:scale-[0.96]"
      >
        {isUpdating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isUpdating ? "Atualizando..." : "Atualizar projeções"}
      </Button>
    </div>
  );
}
