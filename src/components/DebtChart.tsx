import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface Debt {
  id: string;
  name: string;
  amount: number;
  interestRate: number;
  dueDate: string;
  minimumPayment: number;
  category: string;
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

  // Dados por categoria para o gráfico de pizza
  const categoryData = debts.reduce((acc, debt) => {
    const existing = acc.find(item => item.name === debt.category);
    if (existing) {
      existing.value += debt.amount;
      existing.count += 1;
    } else {
      acc.push({ 
        name: debt.category, 
        value: debt.amount,
        count: 1
      });
    }
    return acc;
  }, [] as { name: string; value: number; count: number }[]);

  // Dados individuais para o gráfico de barras (top 6 maiores dívidas)
  const individualData = debts
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
    .map(debt => ({
      name: debt.name.length > 15 ? debt.name.substring(0, 15) + '...' : debt.name,
      amount: debt.amount,
      minimumPayment: debt.minimumPayment,
      fullName: debt.name
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'amount' ? 'Valor Total' : 'Pagamento Mínimo'}: {formatCurrency(entry.value)}
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
            {data.payload.count} dívida{data.payload.count !== 1 ? 's' : ''}
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
            <CardTitle className="text-lg text-foreground">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">Nenhuma dívida cadastrada</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Maiores Dívidas</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">Nenhuma dívida cadastrada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Gráfico de Pizza - Distribuição por Categoria */}
      <Card className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Distribuição por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Maiores Dívidas */}
      <Card className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Maiores Dívidas</CardTitle>
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
                dataKey="amount" 
                fill="hsl(214 84% 56%)" 
                name="Valor Total"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="minimumPayment" 
                fill="hsl(45 93% 47%)" 
                name="Pagamento Mínimo"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};