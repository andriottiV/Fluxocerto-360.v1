import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  LockKeyhole,
  WalletCards,
} from "lucide-react";

import MoneyValue from "@/components/ui/MoneyValue";
import type { RealPotAvailability } from "@/lib/finance";
import { PotType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type DashboardMoneyExplanationCardsProps = {
  grossIncome: number;
  fees: number;
  netProfit: number;
  supplies: number;
  potAvailability: RealPotAvailability[];
};

const potOrder: Record<PotType, number> = {
  [PotType.PERSONAL]: 1,
  [PotType.BUSINESS]: 2,
  [PotType.RESERVE]: 3,
};

function potLabel(type: PotType) {
  if (type === PotType.PERSONAL) return "PF";
  if (type === PotType.BUSINESS) return "PJ";
  return "Reserva";
}

export default function DashboardMoneyExplanationCards({
  grossIncome,
  fees,
  netProfit,
  supplies,
  potAvailability,
}: DashboardMoneyExplanationCardsProps) {
  const committed = potAvailability.reduce((sum, pot) => sum + pot.committed, 0);
  const totalOrganized = potAvailability.reduce((sum, pot) => sum + pot.balance, 0);
  const orderedPots = [...potAvailability].sort((a, b) => potOrder[a.potType] - potOrder[b.potType]);

  const cards = [
    {
      title: "Entrada bruta",
      value: formatCurrency(grossIncome),
      helper: "Total que entrou antes de taxas e custos.",
      detail: "Entrada = valor bruto recebido.",
      icon: Banknote,
      tone: "success",
    },
    {
      title: "Taxas",
      value: formatCurrency(fees),
      helper: "Descontos pela forma de pagamento.",
      detail: "Credito, debito, Pix, voucher e outros meios podem ter taxas.",
      icon: CreditCard,
      tone: "warning",
    },
    {
      title: "Lucro liquido",
      value: formatCurrency(netProfit),
      helper: "Entrada bruta - taxas - insumos.",
      detail:
        supplies > 0
          ? `${formatCurrency(supplies)} em insumos/custos considerados. Saidas dos potes nao reduzem este lucro.`
          : "Saidas e despesas nao entram neste calculo.",
      icon: CircleDollarSign,
      tone: netProfit < 0 ? "danger" : "success",
    },
    {
      title: "Comprometido",
      value: formatCurrency(committed),
      helper: "Compromissos dos proximos 10 dias.",
      detail: "Compromisso futuro nao muda seu saldo. Ele so reduz o disponivel real.",
      icon: LockKeyhole,
      tone: committed > 0 ? "warning" : "info",
    },
    {
      title: "Dinheiro total organizado",
      value: formatCurrency(totalOrganized),
      helper: "Total distribuido entre PF, PJ e Reserva.",
      detail: "Mostra como seu dinheiro esta dividido por direcao antes dos compromissos futuros.",
      icon: WalletCards,
      tone: "info",
    },
  ];

  return (
    <section className="fd-money-education" aria-label="Explicacao do dinheiro no dashboard">
      <div className="fd-home-panel-head">
        <h3>Entenda seu dinheiro</h3>
        <span>Regras simples</span>
      </div>

      <div className="fd-money-education-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className={`fd-money-education-card ${card.tone}`}>
              <div className="fd-money-education-card-head">
                <span>
                  <Icon className="h-4 w-4" />
                </span>
                <p>{card.title}</p>
              </div>
              <MoneyValue value={card.value} size="sm" />
              <small>{card.helper}</small>
              <em title={card.detail}>{card.detail}</em>
            </article>
          );
        })}
      </div>

      <div className="fd-pot-availability-list">
        {orderedPots.map((pot) => (
          <article key={pot.potId} className={pot.deficit > 0 ? "deficit" : ""}>
            <div>
              <span>{potLabel(pot.potType)}</span>
              <strong>{pot.potName}</strong>
            </div>
            <p>
              Saldo: <MoneyValue value={formatCurrency(pot.balance)} size="sm" />
            </p>
            <p>Comprometido: <MoneyValue value={formatCurrency(pot.committed)} size="sm" /></p>
            <b>Disponivel real: <MoneyValue value={formatCurrency(pot.availableReal)} size="sm" /></b>
            {pot.deficit > 0 ? <em>Faltam <MoneyValue value={formatCurrency(pot.deficit)} size="sm" /> nos proximos 10 dias.</em> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
