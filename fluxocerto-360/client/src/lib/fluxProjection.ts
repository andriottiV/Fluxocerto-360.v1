export type ProjectionFrequency = "daily" | "weekly" | "monthly";

export type SavingProjection = {
  dailyAmount: number;
  weeklyAmount: number;
  monthlyApproxAmount: number;
  months3: number;
  months6: number;
  months12: number;
  months36: number;
  selectedMonths: number;
  selectedMonthsAmount: number;
};

function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

export function calculateSavingProjection(amount: number, frequency: ProjectionFrequency, months = 12): SavingProjection {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const safeMonths = Number.isFinite(months) && months > 0 ? Math.max(1, Math.round(months)) : 12;

  let weeklyAmount = 0;
  if (frequency === "weekly") weeklyAmount = safeAmount;
  if (frequency === "daily") weeklyAmount = safeAmount * 7;
  if (frequency === "monthly") weeklyAmount = safeAmount / 4.33;

  const dailyAmount = weeklyAmount / 7;
  const monthlyApproxAmount = weeklyAmount * 4.33;
  const yearly = weeklyAmount * 52;
  const selectedMonthsAmount = yearly * (safeMonths / 12);

  return {
    dailyAmount: roundCurrency(dailyAmount),
    weeklyAmount: roundCurrency(weeklyAmount),
    monthlyApproxAmount: roundCurrency(monthlyApproxAmount),
    months3: roundCurrency(yearly * (3 / 12)),
    months6: roundCurrency(yearly * (6 / 12)),
    months12: roundCurrency(yearly),
    months36: roundCurrency(yearly * 3),
    selectedMonths: safeMonths,
    selectedMonthsAmount: roundCurrency(selectedMonthsAmount),
  };
}

