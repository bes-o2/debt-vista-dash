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
    projections, 
    isLoading, 
    isUpdating, 
    updateRates, 
    saveProjection, 
    isSavingProjection 
  } = useEconomicIndices();

  const [newProjections, setNewProjections] = useState<{
    [key: string]: { [year: number]: string }
  }>({});

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const handleProjectionChange = (indexType: string, year: number, value: string) => {
    setNewProjections(prev => ({
      ...prev,
      [indexType]: {
        ...prev[indexType],
        [year]: value
      }
    }));
  };

  const handleSaveProjection = (indexType: string, year: number) => {
    const value = newProjections[indexType]?.[year];
    if (value && !isNaN(parseFloat(value))) {
      saveProjection({
        index_type: indexType as 'CDI' | 'SELIC' | 'IPCA',
        year,
        projected_value: parseFloat(value)
      });
      
      // Clear the input after saving
      setNewProjections(prev => ({
        ...prev,
        [indexType]: {
          ...prev[indexType],
          [year]: ''
        }
      }));
    }
  };

  const getProjectionValue = (indexType: string, year: number): string => {
    const existing = projections?.find(p => p.index_type === indexType && p.year === year);
    return existing ? existing.projected_value.toString() : '';
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
        <TabsTrigger value="projections" className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Projeções
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

      <TabsContent value="projections" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Projeções Manuais
            </CardTitle>
            <CardDescription>
              Configure projeções personalizadas para cálculos futuros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {['CDI', 'SELIC', 'IPCA'].map((indexType) => (
                <Card key={indexType} className="border-l-4 border-l-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{indexType}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[currentYear, nextYear].map((year) => (
                        <div key={year} className="space-y-2">
                          <Label htmlFor={`${indexType}-${year}`}>
                            Projeção para {year}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${indexType}-${year}`}
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder={getProjectionValue(indexType, year) || "Ex: 10.5"}
                              value={newProjections[indexType]?.[year] || ''}
                              onChange={(e) => handleProjectionChange(indexType, year, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveProjection(indexType, year)}
                              disabled={
                                isSavingProjection || 
                                !newProjections[indexType]?.[year] ||
                                isNaN(parseFloat(newProjections[indexType][year]))
                              }
                            >
                              Salvar
                            </Button>
                          </div>
                          {getProjectionValue(indexType, year) && (
                            <div className="text-sm text-muted-foreground">
                              Atual: {formatRate(parseFloat(getProjectionValue(indexType, year)))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}