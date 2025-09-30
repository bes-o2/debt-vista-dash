import { useState, useEffect } from "react";
import { Database, TrendingUp, CheckCircle, AlertCircle, Clock, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SensitivityAnalysis } from "@/components/SensitivityAnalysis";

export function SettingsModal() {
  const { 
    latestRates, 
    isLoading, 
    error
  } = useEconomicIndices();

  // Status do serviço de importação
  const getServiceStatus = () => {
    if (isLoading) return { status: 'loading', label: 'Verificando...', color: 'bg-yellow-500' };
    if (error) return { status: 'error', label: 'Erro no serviço', color: 'bg-red-500' };
    
    // Verificar se temos dados recentes (últimas 48 horas)
    const hasRecentData = Object.values(latestRates).some(rate => {
      if (!rate?.date) return false;
      const rateDate = parseISO(rate.date);
      const hoursAgo = differenceInHours(new Date(), rateDate);
      return hoursAgo <= 48; // Dados de até 48 horas são considerados recentes
    });

    if (hasRecentData) {
      return { status: 'ok', label: 'Serviço ativo', color: 'bg-green-500' };
    } else {
      return { status: 'warning', label: 'Dados desatualizados', color: 'bg-orange-500' };
    }
  };

  const serviceStatus = getServiceStatus();

  const getStatusIcon = () => {
    switch (serviceStatus.status) {
      case 'ok': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'loading': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatRate = (value: number): string => {
    return `${value.toFixed(4)}%`;
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Tabs defaultValue="rates" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="rates" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Taxas e Indexadores
        </TabsTrigger>
        <TabsTrigger value="sensitivity" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Análise de Sensibilidade
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rates" className="space-y-4">
        {/* Status do Serviço */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${serviceStatus.color} animate-pulse`}></div>
                <CardTitle className="text-lg">Status do Serviço de Importação</CardTitle>
                {getStatusIcon()}
              </div>
            </div>
            <CardDescription>
              {serviceStatus.label} - Importação automática de dados do BCB
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Taxas Atuais */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Taxas Econômicas Atuais
                </CardTitle>
                <CardDescription>
                  Dados importados automaticamente do Banco Central do Brasil (BCB)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando taxas...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['CDI', 'SELIC', 'IPCA'].map((indexType) => {
                  const rate = latestRates?.[indexType as keyof typeof latestRates];
                  return (
                    <Card key={indexType} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{indexType}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {rate ? (
                          <div className="space-y-2">
                            <div className="text-2xl font-bold text-primary">
                              {formatRate(rate.value)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Atualizado em: {formatDate(rate.date)}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {indexType === 'IPCA' ? 'Mensal' : 'Anual'}
                            </Badge>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Dados não disponíveis
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-sm text-muted-foreground">
                  <strong>Fontes dos dados:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• <strong>CDI:</strong> Série 12 - Taxa de juros - CDI</li>
                    <li>• <strong>SELIC:</strong> Série 11 - Taxa de juros - Selic</li>
                    <li>• <strong>IPCA:</strong> Série 433 - IPCA - Índice nacional de preços ao consumidor amplo</li>
                  </ul>
                  <p className="mt-2">
                    Dados atualizados automaticamente do Sistema Gerenciador de Séries Temporais (SGS) do BCB.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sensitivity" className="space-y-4">
        <SensitivityAnalysis />
      </TabsContent>

    </Tabs>
  );
}