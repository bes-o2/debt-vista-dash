import { useMemo, useState } from "react";
import { AlertCircle, Loader2, PieChart as PieChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import { parseLocalDate } from "@/lib/debtUtils";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  firstDueDate: string;
  dueDate: string;
  calculationTable: "SAC" | "PRICE";
  indexer?: string;
  interestRate: number;
  interestType: "monthly" | "annual";
  bank: string;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
}

interface DebtProfileChartProps {
  debts: Debt[];
}

interface ChartRow {
  bank: string;
  shortTerm: number;
  longTerm: number;
  shortTermAmount: number;
  longTermAmount: number;
  totalAmount: number;
}


const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const DebtProfileChart = ({ debts }: DebtProfileChartProps) => {
  const [dateType, setDateType] = useState<"today" | "custom">("today");
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const { installmentsData, loading, error } = useDebtInstallments(debts);

  const chartData = useMemo<ChartRow[]>(() => {
    const baseDate = dateType === "today" ? new Date() : new Date(customDate);
    baseDate.setHours(0, 0, 0, 0);

    const twelveMonthsFromBase = new Date(baseDate);
    twelveMonthsFromBase.setMonth(twelveMonthsFromBase.getMonth() + 12);

    const bankGroups = debts.reduce<Record<string, Debt[]>>((acc, debt) => {
      const key = debt.bank || "Sem Nome";
      if (!acc[key]) acc[key] = [];
      acc[key].push(debt);
      return acc;
    }, {});

    return Object.entries(bankGroups)
      .map(([bankName, bankDebts]) => {
        let shortTermAmortization = 0;
        let longTermAmortization = 0;

        bankDebts.forEach((debt) => {
          const debtInstallments = installmentsData[debt.id] || [];

          debtInstallments.forEach((installment) => {
            const dueDate = parseLocalDate(installment.due_date);
            const principalAmount = Number(installment.principal_amount);

            if (!dueDate || !Number.isFinite(principalAmount) || principalAmount <= 0) {
              return;
            }

            if (dueDate < baseDate) return;

            if (dueDate < twelveMonthsFromBase) {
              shortTermAmortization += principalAmount;
              return;
            }

            longTermAmortization += principalAmount;
          });
        });

        const totalAmortization = shortTermAmortization + longTermAmortization;

        return {
          bank: bankName,
          shortTerm: totalAmortization > 0 ? (shortTermAmortization / totalAmortization) * 100 : 0,
          longTerm: totalAmortization > 0 ? (longTermAmortization / totalAmortization) * 100 : 0,
          shortTermAmount: shortTermAmortization,
          longTermAmount: longTermAmortization,
          totalAmount: totalAmortization,
        };
      })
      .filter((item) => item.totalAmount > 0);
  }, [customDate, dateType, debts, installmentsData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0]?.payload as ChartRow | undefined;
    if (!data) return null;

    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="mb-2 font-semibold text-foreground">{label}</p>
        <div className="space-y-1">
          <p className="text-sm">
            <span className="mr-2 inline-block h-3 w-3 rounded bg-muted-foreground" />
            Curto Prazo (ate 12 meses): {data.shortTerm.toFixed(0)}% ({formatCurrency(data.shortTermAmount)})
          </p>
          <p className="text-sm">
            <span className="mr-2 inline-block h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--primary))" }} />
            Longo Prazo ({">"}12 meses): {data.longTerm.toFixed(0)}% ({formatCurrency(data.longTermAmount)})
          </p>
          <p className="mt-2 text-sm font-medium text-muted-foreground">Total: {formatCurrency(data.totalAmount)}</p>
        </div>
      </div>
    );
  };

  const renderLabel = (props: any, dataKey: "shortTerm" | "longTerm") => {
    const { x, y, width, height, index } = props;

    if (typeof index !== "number" || height < 25) return null;

    const data = chartData[index];
    if (!data) return null;

    const pct = dataKey === "shortTerm" ? data.shortTerm : data.longTerm;
    const amount = dataKey === "shortTerm" ? data.shortTermAmount : data.longTermAmount;
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const formattedAmount =
      amount >= 1_000_000
        ? `R$ ${(amount / 1_000_000).toFixed(1)}M`
        : amount >= 1_000
          ? `R$ ${(amount / 1_000).toFixed(0)}K`
          : formatCurrency(amount);

    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight="bold"
        style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
      >
        <tspan x={x + width / 2} dy="-0.6em">
          {pct.toFixed(0)}%
        </tspan>
        <tspan x={x + width / 2} dy="1.4em">
          {formattedAmount}
        </tspan>
      </text>
    );
  };

  return (
    <Card className="border border-border bg-card transition-shadow duration-300 hover:shadow-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <div className="rounded-lg bg-primary/10 p-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
            </div>
            Perfil da Dívida
          </CardTitle>

          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Data Base</Label>
              <Select value={dateType} onValueChange={(value: "today" | "custom") => setDateType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateType === "custom" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data</Label>
                <DateInput value={customDate} onChange={(date) => date && setCustomDate(date)} className="w-40" />
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading || (!error && debts.length > 0 && Object.keys(installmentsData).length < debts.length) ? (
          <div className="flex h-[350px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando parcelas...</span>
          </div>
        ) : error ? (
          <div className="flex h-[350px] flex-col items-center justify-center gap-2 text-center">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-foreground">Não foi possível montar o perfil da dívida.</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center text-center text-sm text-muted-foreground">
            Nenhuma amortização futura encontrada para o período selecionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bank" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />

              <Bar dataKey="shortTerm" stackId="debt" fill="hsl(var(--muted-foreground))" name="Curto Prazo">
                <LabelList content={(props) => renderLabel(props, "shortTerm")} />
              </Bar>
              <Bar dataKey="longTerm" stackId="debt" fill="hsl(var(--primary))" name="Longo Prazo">
                <LabelList content={(props) => renderLabel(props, "longTerm")} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-muted-foreground" />
            <span>Curto Prazo (até 12 meses)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--primary))" }} />
            <span>Longo Prazo ({">"}12 meses)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
