import { describe, expect, it } from "vitest";

import {
  calculateIncomeProfitBreakdown,
  calculateRealAvailableByPot,
  calculatePotAvailability,
  calculateTotals,
  getUpcomingCommitments,
  validatePotExpense,
} from "@/lib/finance";
import { PotType, TransactionType, type AdjustmentAccount, type Pot, type Transaction } from "@/lib/types";

function pot(id: string, type: PotType, balance: number): Pot {
  return {
    id,
    type,
    name: type,
    balance,
    percentage: 0,
    goalValue: 0,
    icon: "",
    color: "",
  };
}

describe("finance rules", () => {
  it("keeps gross income visible and discounts credit fee from net profit", () => {
    const breakdown = calculateIncomeProfitBreakdown({
      grossIncome: 100,
      fees: 3.5,
      supplies: 0,
    });

    expect(breakdown.grossIncome).toBe(100);
    expect(breakdown.fees).toBe(3.5);
    expect(breakdown.netProfit).toBe(96.5);
  });

  it("discounts supplies from net profit without using expenses", () => {
    const breakdown = calculateIncomeProfitBreakdown({
      grossIncome: 100,
      fees: 3.5,
      supplies: 10,
    });

    expect(breakdown.grossIncome).toBe(100);
    expect(breakdown.fees).toBe(3.5);
    expect(breakdown.netProfit).toBe(86.5);
  });

  it("expenses only reduce period balance, not net income", () => {
    const transactions: Transaction[] = [
      {
        id: "income",
        type: TransactionType.INCOME,
        amount: 100,
        grossAmount: 100,
        feeAmount: 3.5,
        netAmount: 96.5,
        description: "Entrada",
        category: "servico",
        date: "2026-05-05",
        account: "Conta",
      },
      {
        id: "expense",
        type: TransactionType.EXPENSE,
        amount: 50,
        description: "Saida PF",
        category: "pessoal",
        date: "2026-05-05",
        account: "Conta",
        potId: "pf",
      },
    ];

    const totals = calculateTotals(transactions);

    expect(totals.income).toBe(100);
    expect(totals.netIncome).toBe(96.5);
    expect(totals.expense).toBe(50);
    expect(totals.periodBalance).toBe(46.5);
  });

  it("validates insufficient pot balance before saving an expense", () => {
    const pots = [
      pot("pf", PotType.PERSONAL, 100),
      pot("pj", PotType.BUSINESS, 500),
      pot("reserve", PotType.RESERVE, 0),
    ];

    const validation = validatePotExpense(150, "pf", pots);

    expect(validation.ok).toBe(false);
    expect(validation.missingAmount).toBe(50);
    expect(validation.suggestedPot?.id).toBe("pj");
  });

  it("calculates real availability by pot without mixing PF, PJ and reserve", () => {
    const pots = [
      pot("pj", PotType.BUSINESS, 500),
      pot("pf", PotType.PERSONAL, 800),
      pot("reserve", PotType.RESERVE, 0),
    ];
    const commitments: AdjustmentAccount[] = [
      {
        id: "pj-bill",
        name: "Conta PJ",
        amount: 200,
        category: "fornecedores",
        type: "fixa",
        dueDate: "2026-05-10",
        pot: "pj",
        status: "pendente",
        cycleMonthKey: "2026-05",
      },
      {
        id: "pf-bill",
        name: "Conta PF",
        amount: 1150,
        category: "moradia",
        type: "fixa",
        dueDate: "2026-05-10",
        pot: "pf",
        status: "pendente",
        cycleMonthKey: "2026-05",
      },
    ];

    const availability = calculatePotAvailability(pots, commitments);

    expect(availability.find((item) => item.potType === PotType.BUSINESS)?.availableReal).toBe(300);
    expect(availability.find((item) => item.potType === PotType.PERSONAL)?.availableReal).toBe(-350);
    expect(availability.find((item) => item.potType === PotType.PERSONAL)?.deficit).toBe(350);
  });

  it("gets upcoming commitments from accounts and active unconfirmed recurrences", () => {
    const commitments = getUpcomingCommitments({
      today: new Date("2026-05-06T10:00:00"),
      daysWindow: 10,
      accounts: [
        {
          id: "legacy-internet",
          name: "Internet",
          amount: 149.9,
          category: "internet",
          type: "fixa",
          dueDate: "2026-05-10",
          pot: "pj",
          status: "pendente",
          cycleMonthKey: "2026-05",
        },
      ],
      recurrences: [
        {
          id: "rent",
          name: "Aluguel",
          type: TransactionType.EXPENSE,
          amount: 1150,
          frequency: "monthly",
          dayOfMonth: 8,
          potType: PotType.PERSONAL,
          category: "moradia",
          status: "active",
          createdAt: "2026-05-01",
          ignoredPeriods: [],
        },
        {
          id: "confirmed",
          name: "Confirmada",
          type: TransactionType.EXPENSE,
          amount: 100,
          frequency: "monthly",
          dayOfMonth: 9,
          potType: PotType.PERSONAL,
          category: "outros",
          status: "active",
          createdAt: "2026-05-01",
          lastConfirmedPeriod: "2026-05",
        },
      ],
    });

    expect(commitments.map((item) => item.name)).toEqual(["Aluguel", "Internet"]);
  });

  it("clamps real available to zero and exposes deficit separately", () => {
    const pots = [
      pot("pf", PotType.PERSONAL, 800),
      pot("pj", PotType.BUSINESS, 500),
      pot("reserve", PotType.RESERVE, 100),
    ];

    const availability = calculateRealAvailableByPot(pots, [
      {
        id: "rent",
        source: "recurrence",
        sourceId: "rent",
        name: "Aluguel",
        amount: 1150,
        dueDate: "2026-05-08",
        potType: PotType.PERSONAL,
      },
      {
        id: "internet",
        source: "recurrence",
        sourceId: "internet",
        name: "Internet",
        amount: 149.9,
        dueDate: "2026-05-10",
        potType: PotType.BUSINESS,
      },
    ]);

    expect(availability.find((item) => item.potType === PotType.PERSONAL)?.availableReal).toBe(0);
    expect(availability.find((item) => item.potType === PotType.PERSONAL)?.deficit).toBe(350);
    expect(availability.find((item) => item.potType === PotType.BUSINESS)?.availableReal).toBe(350.1);
    expect(availability.find((item) => item.potType === PotType.RESERVE)?.availableReal).toBe(100);
  });
});
