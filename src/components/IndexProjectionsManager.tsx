import { useState } from "react";
import { useCompanyIndexProjections } from "@/hooks/useCompanyIndexProjections";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Download, RefreshCw } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";

export function IndexProjectionsManager() {
  const {
    latestBCBRates,
    companyProjections,
    projectionsMap,
    isLoading,
    isSyncing,
    syncProjections
  } = useCompanyIndexProjections();

  const { fetchHistoricalData, isFetchingHistorical } = useEconomicIndices();

  const [isHistoricalDialogOpen, setIsHistoricalDialogOpen] = useState(false);
  const [historicalStartDate, setHistoricalStartDate] = useState<Date>(new Date(2020, 0, 1));
  const [historicalEndDate, setHistoricalEndDate] = useState<Date>(new Date());

  const handleFetchHistorical = () => {
    const startDateStr = historicalStartDate.toISOString().split('T')[0];
    const endDateStr = historicalEndDate.toISOString().split('T')[0];

    fetchHistoricalData({
      startDate: startDateStr,
      endDate: endDateStr,
    });

    setIsHistoricalDialogOpen(false);
  };

  const formatRate = (value?: number) => {
    if (value === undefined || value === null) return "N/A";
    return `${value.toFixed(4)}%`;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getProjectedRateDisplay = (indexType: string) => {
    const proj = projectionsMap.get(indexType);
    if (!proj) return { value: null, date: null, sourceDate: null };
    return {
      value: proj.projected_rate,
      date: proj.reference_date,
      sourceDate: proj.source_reference_date
    };
  };

  const getLatestBCBDisplay = (indexType: string) => {
    const rate = latestBCBRates.find(r => r.index_type === indexType);
    if (!rate) return { value: null, date: null };
    return { value: rate.rate, date: rate.reference_date };
  };

  return (
    <div className="space-y-6">
      {/* Latest BCB Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taxas Reais do BCB (Últimos Valores)
          </CardTitle>
          <CardDescription>
            Dados mais recentes capturados da API do Banco Central
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['CDI', 'SELIC', 'IPCA'].map((indexType) => {
              const bcb = getLatestBCBDisplay(indexType);
              return (
                <div key={indexType} className="space-y-1 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{indexType}</Label>
                    <Badge variant="outline" className="text-xs">BCB</Badge>
                  </div>
                  <p className="text-2xl font-bold">{formatRate(bcb.value)}</p>
                  <p className="text-xs text-muted-foreground">
                    {bcb.date ? formatDate(bcb.date) : 'Não disponível'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <Dialog open={isHistoricalDialogOpen} onOpenChange={setIsHistoricalDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Atualizar Dados Históricos do BCB
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buscar Dados Históricos</DialogTitle>
                  <DialogDescription>
                    Defina o período para importar dados históricos de CDI, IPCA e SELIC do Banco Central.
                    Útil para contratos antigos que precisam de histórico completo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Data Inicial</Label>
                    <DateInput
                      value={historicalStartDate}
                      onChange={(date) => date && setHistoricalStartDate(date)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Final</Label>
                    <DateInput
                      value={historicalEndDate}
                      onChange={(date) => date && setHistoricalEndDate(date)}
                      maxDate={new Date()}
                    />
                  </div>
                  <Button
                    onClick={handleFetchHistorical}
                    disabled={isFetchingHistorical}
                    className="w-full"
                  >
                    {isFetchingHistorical ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Importar Dados
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Company Base Projections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Projeção Base por Empresa
              </CardTitle>
              <CardDescription>
                Projeção fixa usada para parcelas futuras, baseada no último valor real do BCB
              </CardDescription>
            </div>
            <Button
              onClick={syncProjections}
              disabled={isSyncing || isLoading}
              size="sm"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar projeção base
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando projeções...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['CDI', 'SELIC', 'IPCA'].map((indexType) => {
                const proj = getProjectedRateDisplay(indexType);
                const bcb = getLatestBCBDisplay(indexType);
                return (
                  <div key={indexType} className="space-y-1 p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">{indexType}</Label>
                      <Badge variant={proj.value ? "default" : "secondary"} className="text-xs">
                        {proj.value ? 'Ativo' : 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">
                      {proj.value ? formatRate(proj.value) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Base BCB: {bcb.date ? formatDate(bcb.date) : 'N/A'}
                    </p>
                    {proj.sourceDate && (
                      <p className="text-xs text-muted-foreground">
                        Origem: {formatDate(proj.sourceDate)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {companyProjections.length === 0 && !isLoading && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
              Nenhuma projeção base configurada. Clique em "Atualizar projeção base" para sincronizar com os dados mais recentes do BCB.
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
