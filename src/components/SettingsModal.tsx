import { useState } from "react";
import { RefreshCw, TrendingUp, Calendar, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function SettingsModal() {
  const { 
    latestRates, 
    isLoading, 
    isUpdating, 
    updateRates
  } = useEconomicIndices();

  // Projection functionality temporarily disabled

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
      <TabsList className="grid w-full grid-cols-1">
        <TabsTrigger value="rates" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Taxas e Indexadores
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rates" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Taxas Econômicas Atuais
                </CardTitle>
                <CardDescription>
                  Taxas obtidas do Banco Central do Brasil (BCB)
                </CardDescription>
              </div>
              <Button 
                onClick={() => updateRates(true)} 
                disabled={isUpdating}
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Atualizando...' : 'Atualizar Taxas'}
              </Button>
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

    </Tabs>
  );
}