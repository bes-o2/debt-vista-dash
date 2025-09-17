import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestRateType: 'monthly' | 'annual';
  iofAmount?: number;
  tacAmount?: number;
}

interface DebtChartProps {
  debts: Debt[];
}

const COLORS = [
  'hsl(214 84% 56%)', // Primary
  'hsl(142 76% 36%)', // Success  
  'hsl(45 93% 47%)',  // Warning
  'hsl(0 84% 60%)',   // Destructive
  'hsl(251 91% 66%)', // Primary variant
  'hsl(158 64% 52%)', // Success variant
  'hsl(35 91% 62%)',  // Warning variant
];

export const DebtChart = ({ debts }: DebtChartProps) => {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);

  // Dados por sistema de amortização para o gráfico de pizza
  const systemData = debts.reduce((acc, debt) => {
    const existing = acc.find(item => item.name === debt.calculationTable);
    if (existing) {
      existing.value += debt.financedAmount;
      existing.count += 1;
    } else {
      acc.push({ 
        name: debt.calculationTable, 
        value: debt.financedAmount,
        count: 1
      });
    }
    return acc;
  }, [] as { name: string; value: number; count: number }[]);

  // Dados individuais para o gráfico de barras (top 6 maiores financiamentos)
  const individualData = debts
    .sort((a, b) => b.financedAmount - a.financedAmount)
    .slice(0, 6)
    .map((debt, index) => {
      const totalCost = debt.financedAmount + (debt.iofAmount || 0) + (debt.tacAmount || 0);
      return {
        name: `Contrato ${debt.id.slice(-4)}`,
        financedAmount: debt.financedAmount,
        totalCost: totalCost,
        fees: totalCost - debt.financedAmount,
        system: debt.calculationTable
      };
    });

  // Dados de indexadores
  const indexerData = debts
    .filter(debt => debt.indexer)
    .reduce((acc, debt) => {
      const existing = acc.find(item => item.name === debt.indexer);
      if (existing) {
        existing.value += debt.financedAmount;
        existing.count += 1;
      } else {
        acc.push({ 
          name: debt.indexer!, 
          value: debt.financedAmount,
          count: 1
        });
      }
      return acc;
    }, [] as { name: string; value: number; count: number }[]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'financedAmount' && 'Valor Financiado: '}
              {entry.dataKey === 'totalCost' && 'Custo Total: '}
              {entry.dataKey === 'fees' && 'Taxas: '}
              {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.payload.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.payload.count} contrato{data.payload.count !== 1 ? 's' : ''}
          </p>
          <p className="text-sm font-medium" style={{ color: data.color }}>
            {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (debts.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Sistema de Amortização</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">Nenhum contrato cadastrado</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Maiores Financiamentos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">Nenhum contrato cadastrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Gráfico de Pizza - Distribuição por Sistema */}
      <Card className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Sistema de Amortização</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={systemData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {systemData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Maiores Financiamentos */}
      <Card className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Maiores Financiamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={individualData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                fontSize={12}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="financedAmount" 
                fill="hsl(214 84% 56%)" 
                name="Valor Financiado"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="fees" 
                fill="hsl(45 93% 47%)" 
                name="Taxas (IOF + TAC)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Indexadores (se houver) */}
      {indexerData.length > 0 && (
        <Card className="md:col-span-2 bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Distribuição por Indexador</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={indexerData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
                layout="horizontal"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number"
                  tickFormatter={(value) => formatCurrency(value)}
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip content={<CustomPieTooltip />} />
                <Bar 
                  dataKey="value" 
                  fill="hsl(142 76% 36%)" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};