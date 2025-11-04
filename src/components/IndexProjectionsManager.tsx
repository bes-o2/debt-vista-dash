import { useState } from "react";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Download, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";

export function IndexProjectionsManager() {
  const { latestRates, projections, isLoading, saveProjection, isSavingProjection, fetchHistoricalData, isFetchingHistorical } = useEconomicIndices();
  
  const [indexType, setIndexType] = useState<'CDI' | 'IPCA' | 'SELIC'>('CDI');
  const [projectionDate, setProjectionDate] = useState<Date>(new Date());
  const [horizonMonths, setHorizonMonths] = useState<number>(12);
  const [rateValue, setRateValue] = useState("");
  const [rateType, setRateType] = useState<'monthly' | 'annual'>('annual');
  const [isHistoricalDialogOpen, setIsHistoricalDialogOpen] = useState(false);
  const [historicalStartDate, setHistoricalStartDate] = useState<Date>(new Date(2020, 0, 1));
  const [historicalEndDate, setHistoricalEndDate] = useState<Date>(new Date());

  const handleSaveProjection = () => {
    if (!rateValue || parseFloat(rateValue) <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe uma taxa válida maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const rate = parseFloat(rateValue);
    
    // Convert to both monthly and annual
    let monthlyRate: number;
    let annualRate: number;
    
    if (rateType === 'monthly') {
      monthlyRate = rate;
      annualRate = (Math.pow(1 + rate / 100, 12) - 1) * 100;
    } else {
      annualRate = rate;
      monthlyRate = (Math.pow(1 + rate / 100, 1 / 12) - 1) * 100;
    }

    saveProjection({
      index_type: indexType,
      projection_date: projectionDate.toISOString().split('T')[0],
      horizon_months: horizonMonths,
      projected_rate: rateType === 'monthly' ? monthlyRate : annualRate,
    });

    // Reset form
    setRateValue("");
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Latest Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taxas Históricas Mais Recentes
          </CardTitle>
          <CardDescription>
            Últimas taxas capturadas da API do Banco Central
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">CDI</Label>
              <p className="text-2xl font-bold">{formatRate(latestRates.CDI?.value)}</p>
              <p className="text-xs text-muted-foreground">
                {latestRates.CDI?.date ? formatDate(latestRates.CDI.date) : 'Não disponível'}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">IPCA</Label>
              <p className="text-2xl font-bold">{formatRate(latestRates.IPCA?.value)}</p>
              <p className="text-xs text-muted-foreground">
                {latestRates.IPCA?.date ? formatDate(latestRates.IPCA.date) : 'Não disponível'}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">SELIC</Label>
              <p className="text-2xl font-bold">{formatRate(latestRates.SELIC?.value)}</p>
              <p className="text-xs text-muted-foreground">
                {latestRates.SELIC?.date ? formatDate(latestRates.SELIC.date) : 'Não disponível'}
              </p>
            </div>
          </div>
          
          <div className="mt-4">
            <Dialog open={isHistoricalDialogOpen} onOpenChange={setIsHistoricalDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
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

      {/* Create Projection */}
      <Card>
        <CardHeader>
          <CardTitle>Nova Projeção de Índice</CardTitle>
          <CardDescription>
            Defina projeções futuras para cálculo de contratos pós-fixados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Índice</Label>
              <Select value={indexType} onValueChange={(value: 'CDI' | 'IPCA' | 'SELIC') => setIndexType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CDI">CDI</SelectItem>
                  <SelectItem value="IPCA">IPCA</SelectItem>
                  <SelectItem value="SELIC">SELIC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Início da Projeção</Label>
              <DateInput
                value={projectionDate}
                onChange={(date) => date && setProjectionDate(date)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Horizonte (meses)</Label>
            <Input
              type="number"
              min="1"
              max="360"
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(parseInt(e.target.value) || 12)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Taxa</Label>
              <Select value={rateType} onValueChange={(value: 'monthly' | 'annual') => setRateType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal (% a.m.)</SelectItem>
                  <SelectItem value="annual">Anual (% a.a.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Taxa Projetada (%)</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                placeholder="Ex: 12.5000"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleSaveProjection} 
            disabled={isSavingProjection || !rateValue}
            className="w-full"
          >
            {isSavingProjection ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Projeção"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Projeções Cadastradas</CardTitle>
          <CardDescription>
            Projeções ativas que serão usadas no cálculo de contratos futuros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma projeção cadastrada. Crie projeções para melhorar a precisão dos cálculos pós-fixados.
            </p>
          ) : (
            <div className="space-y-2">
              {projections.map((projection) => (
                <div key={projection.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{projection.index_type}</Badge>
                      <span className="text-sm font-medium">
                        {projection.projected_rate.toFixed(4)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({projection.horizon_months} meses)
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {formatDate(projection.projection_date)}
                      </span>
                      <span>{projection.horizon_months} meses</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

