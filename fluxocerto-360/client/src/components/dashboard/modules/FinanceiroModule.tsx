import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Landmark,
  PiggyBank,
  Upload,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import MoneyValue from "@/components/ui/MoneyValue";
import StatementImportModal from "@/components/dashboard/shared/StatementImportModal";
import {
  buildDailyTotals,
  calculateTotals,
  getTransactionGrossAmount,
  isInCurrentMonth,
  parseDateSafe,
  sortTransactionsByDateDesc,
} from "@/lib/finance";
import { PotType, TransactionType, type Cost, type Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type Tone = "success" | "danger" | "warning" | "info";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function isOnboardingSeed(transaction: Transaction) {
  return (
    transaction.notes === "onboarding-seed-income" ||
    (transaction.origin === "Onboarding" &&
      transaction.category === "onboarding" &&
      transaction.description === "Saldo inicial configurado no onboarding")
  );
}

function isCurrentMonthDate(date: string) {
  const parsed = parseDateSafe(date);
  return parsed ? isInCurrentMonth(parsed) : false;
}

function monthLabel(now = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(now)
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function matchesCategory(value: string, terms: string[]) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function sumCostsByTerms(costs: Cost[], terms: string[]) {
  return costs
    .filter((cost) => matchesCategory(`${cost.name} ${cost.category}`, terms))
    .reduce((sum, cost) => sum + Math.max(0, cost.amount), 0);
}

function FlowBarsChart({ data }: { data: Array<{ date: string; value: number }> }) {
  if (data.length === 0) return null;
  const maxAbs = Math.max(...data.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="fd-cash-chart">
      {data.map((item) => {
        const height = Math.max(12, Math.round((Math.abs(item.value) / maxAbs) * 100));
        const parsed = parseDateSafe(item.date);
        return (
          <div key={item.date} className="fd-cash-chart-col">
            <span className={item.value >= 0 ? "positive" : "negative"}>
              {item.value >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(item.value))}
            </span>
            <div className="fd-cash-chart-track">
              <div className={item.value >= 0 ? "positive" : "negative"} style={{ height: `${height}%` }} />
            </div>
            <small>{parsed ? DAY_LABELS[parsed.getDay()] : item.date.slice(8, 10)}</small>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
  icon: typeof ArrowDownCircle;
}) {
  return (
    <article className={`fd-cash-metric ${tone}`}>
      <div className="fd-cash-metric-head">
        <span>
          <Icon className="h-5 w-5" />
        </span>
        <p>{label}</p>
      </div>
      <MoneyValue value={value} size="md" />
      <small>{helper}</small>
    </article>
  );
}

export default function FinanceiroModule() {
  const { transactions, costs, potDistribution, pots } = useApp();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const realTransactions = useMemo(() => transactions.filter((tx) => !isOnboardingSeed(tx)), [transactions]);
  const monthTransactions = useMemo(
    () => realTransactions.filter((tx) => isCurrentMonthDate(tx.date)),
    [realTransactions]
  );
  const monthCosts = useMemo(() => costs.filter((cost) => isCurrentMonthDate(cost.date)), [costs]);
  const monthTotals = useMemo(() => calculateTotals(monthTransactions), [monthTransactions]);
  const dailySeries = useMemo(() => buildDailyTotals(monthTransactions).slice(-7), [monthTransactions]);
  const recent = useMemo(() => sortTransactionsByDateDesc(monthTransactions).slice(0, 12), [monthTransactions]);

  const hasRealIncome = monthTransactions.some((tx) => tx.type === TransactionType.INCOME);
  const totalCosts = monthCosts.reduce((sum, cost) => sum + Math.max(0, cost.amount), 0);
  const lucroLiquido = hasRealIncome ? Number((monthTotals.income - monthTotals.fees - totalCosts).toFixed(2)) : 0;
  const reservedForPlan = hasRealIncome
    ? Number(((monthTotals.netIncome * (potDistribution.business + potDistribution.reserve)) / 100).toFixed(2))
    : 0;
  const podeUsar = hasRealIncome ? Number(Math.max(0, lucroLiquido - reservedForPlan).toFixed(2)) : 0;

  const businessPot = pots.find((pot) => pot.type === PotType.BUSINESS);
  const personalPot = pots.find((pot) => pot.type === PotType.PERSONAL);
  const reservePot = pots.find((pot) => pot.type === PotType.RESERVE);
  const taxProvision = sumCostsByTerms(monthCosts, ["imposto", "taxa", "mei", "das"]);
  const vacationProvision = sumCostsByTerms(monthCosts, ["ferias", "descanso"]);
  const investmentProvision = sumCostsByTerms(monthCosts, ["investimento", "equipamento", "crescimento"]);

  const alerts = useMemo(() => {
    const list: string[] = [];
    if (!hasRealIncome) {
      list.push("Nada registrado ainda. Começa colocando sua primeira entrada.");
      return list;
    }
    if (lucroLiquido <= 0) list.push("Seu lucro líquido ainda não ficou positivo este mês.");
    if ((reservePot?.balance ?? 0) <= monthTotals.netIncome * 0.1) list.push("Sua reserva ainda está fraca.");
    if (monthTotals.expense > monthTotals.netIncome * 0.5) list.push("Você gastou mais que o normal aqui.");
    if (list.length === 0) list.push("Seu caixa está organizado. Continua registrando tudo.");
    return list;
  }, [hasRealIncome, lucroLiquido, monthTotals.expense, monthTotals.netIncome, reservePot?.balance]);

  const checkup = [
    "Alguém ainda não te pagou?",
    "Você gastou mais do que queria?",
    "Semana que vem tá controlada?",
  ];

  return (
    <section className="fd-cash-page">
      <header className="fd-cash-header">
        <div>
          <span>Fluxo de caixa</span>
          <h2>Dinheiro real</h2>
          <p>Isso aqui é só o que já entrou de verdade.</p>
        </div>
        <div className="fd-cash-header-actions">
          <button type="button" className="fd-ghost-btn" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importar extrato
          </button>
          <div className="fd-cash-month">
            <CalendarDays className="h-4 w-4" />
            {monthLabel()}
          </div>
        </div>
      </header>

      <section className="fd-cash-hero-grid">
        <article className="fd-cash-control-card">
          <div>
            <span className="fd-cash-kicker">
              <ShieldCheck className="h-4 w-4" />
              Seu controle hoje
            </span>
            {hasRealIncome ? (
              <>
                <h3>Você está no caminho certo</h3>
                <p>Seu caixa está sendo calculado com entradas reais, taxas e custos cadastrados.</p>
              </>
            ) : (
              <>
                <h3>Ainda não da pra analisar</h3>
                <p>Coloca sua primeira entrada e eu te mostro tudo.</p>
              </>
            )}
          </div>
          <div className="fd-cash-control-number">
            <small>Lucro líquido</small>
            <MoneyValue value={formatCurrency(lucroLiquido)} size="lg" />
          </div>
        </article>

        <article className="fd-cash-note-card">
          <strong>Regra de ouro</strong>
          <p>Meta mensal não e dinheiro real. Ela não entra em saldo, lucro, caixa ou potes.</p>
        </article>
      </section>

      <section className="fd-cash-metrics">
        <MetricCard
          label="Entrou"
          value={formatCurrency(monthTotals.income)}
          helper={hasRealIncome ? "Dinheiro recebido de verdade" : "Nada entrou ainda"}
          tone="success"
          icon={ArrowDownCircle}
        />
        <MetricCard
          label="Saiu"
          value={formatCurrency(monthTotals.expense)}
          helper="Saídas registradas no caixa"
          tone="danger"
          icon={ArrowUpCircle}
        />
        <MetricCard
          label="Lucro líquido"
          value={formatCurrency(lucroLiquido)}
          helper="O que realmenté sóbrou depois das taxas e custos"
          tone={lucroLiquido < 0 ? "danger" : "success"}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Pode usar"
          value={formatCurrency(podeUsar)}
          helper={hasRealIncome ? "Esse valor você pode usar sem bagunçar seu plano" : "Registre entradas pra liberar dinheiro aqui"}
          tone="info"
          icon={HandCoins}
        />
      </section>

      <section className="fd-cash-grid-main">
        <article className="fd-cash-panel fd-cash-chart-panel">
          <div className="fd-cash-panel-head">
            <div>
              <h3>Seu dinheiro nos ultimos dias</h3>
              <p>So aparece aqui o que entrou ou saiu de verdade.</p>
            </div>
          </div>
          {dailySeries.length === 0 ? (
            <div className="fd-cash-empty">
              <TrendingUp className="h-8 w-8" />
              <strong>Nada registrado ainda</strong>
              <p>Começa colocando sua primeira entrada.</p>
            </div>
          ) : (
            <FlowBarsChart data={dailySeries} />
          )}
        </article>

        <article className="fd-cash-panel">
          <div className="fd-cash-panel-head">
            <div>
              <h3>Não mistura seu dinheiro</h3>
              <p>O dinheiro do trabalho não e todo seu ainda.</p>
            </div>
          </div>
          <div className="fd-cash-split">
            <div>
              <BriefcaseBusiness className="h-5 w-5" />
              <span>Negocio</span>
              <strong>{formatCurrency(businessPot?.balance ?? 0)}</strong>
              <small>De onde vem o dinheiro</small>
            </div>
            <div>
              <WalletCards className="h-5 w-5" />
              <span>Pessoal</span>
              <strong>{formatCurrency(personalPot?.balance ?? 0)}</strong>
              <small>De onde sai sua vida</small>
            </div>
          </div>
        </article>
      </section>

      <section className="fd-cash-panel">
        <div className="fd-cash-panel-head">
          <div>
            <h3>Separe isso antes de gastar</h3>
            <p>Valores reais ou zero quando ainda não existe registro.</p>
          </div>
        </div>
        <div className="fd-cash-provisions">
          <div>
            <PiggyBank className="h-5 w-5" />
            <span>Reserva</span>
            <strong>{formatCurrency(reservePot?.balance ?? 0)}</strong>
            <small>Dinheiro que te protege</small>
          </div>
          <div>
            <Landmark className="h-5 w-5" />
            <span>Imposto</span>
            <strong>{formatCurrency(taxProvision)}</strong>
            <small>Imposto (não esquece disso)</small>
          </div>
          <div>
            <CalendarDays className="h-5 w-5" />
            <span>Ferias</span>
            <strong>{formatCurrency(vacationProvision)}</strong>
            <small>Pra parar sem preocupacao</small>
          </div>
          <div>
            <TrendingUp className="h-5 w-5" />
            <span>Investimento</span>
            <strong>{formatCurrency(investmentProvision)}</strong>
            <small>Pra crescer mais</small>
          </div>
        </div>
      </section>

      <section className="fd-cash-grid-main">
        <article className="fd-cash-panel">
          <div className="fd-cash-panel-head">
            <div>
              <h3>Organize simples</h3>
              <p>Quatro grupos para entender seu caixa sem complicar.</p>
            </div>
          </div>
          <div className="fd-cash-categories">
            <div>
              <ArrowDownCircle className="h-5 w-5" />
              <span>Entrou</span>
              <strong>{formatCurrency(monthTotals.income)}</strong>
              <small>Servico ou venda</small>
            </div>
            <div>
              <BriefcaseBusiness className="h-5 w-5" />
              <span>Custos</span>
              <strong>{formatCurrency(totalCosts)}</strong>
              <small>Pra trabalhar</small>
            </div>
            <div>
              <TrendingUp className="h-5 w-5" />
              <span>Investimento</span>
              <strong>{formatCurrency(investmentProvision)}</strong>
              <small>Crescimento</small>
            </div>
            <div>
              <HandCoins className="h-5 w-5" />
              <span>Seu salario</span>
              <strong>{formatCurrency(podeUsar)}</strong>
              <small>Retirada segura</small>
            </div>
          </div>
        </article>

        <article className="fd-cash-panel">
          <div className="fd-cash-panel-head">
            <div>
              <h3>Fica de olho</h3>
              <p>Alertas simples para não perder o controle.</p>
            </div>
          </div>
          <div className="fd-cash-alerts">
            {alerts.map((alert) => (
              <div key={alert}>
                {alert.includes("organizado") ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <p>{alert}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="fd-cash-grid-main">
        <article className="fd-cash-panel">
          <div className="fd-cash-panel-head">
            <div>
              <h3>Confere isso aqui rapidinho</h3>
              <p>Um check-up curto antes de tomar decisão.</p>
            </div>
          </div>
          <div className="fd-cash-checkup">
            {checkup.map((item) => (
              <div key={item}>
                <CheckCircle2 className="h-5 w-5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="fd-cash-panel">
          <div className="fd-cash-panel-head">
            <div>
              <h3>Movimentos recentes</h3>
              <p>Nome, valor, data real e categoria.</p>
            </div>
          </div>
          <div className="fd-cash-movements">
            {recent.length === 0 ? (
              <div className="fd-cash-empty compact">
                <strong>Nada registrado ainda</strong>
                <p>Suas entradas e saidas vao aparecer aqui.</p>
              </div>
            ) : (
              recent.map((row) => {
                const isIncome = row.type === TransactionType.INCOME;
                return (
                  <div key={row.id} className="fd-cash-movement-row">
                    <span className={isIncome ? "income" : "expense"}>
                      {isIncome ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                    </span>
                    <div>
                      <p>{row.description}</p>
                      <small>
                        {formatDate(row.date)} - {row.category}
                      </small>
                    </div>
                    <strong className={isIncome ? "income" : "expense"}>
                      {isIncome ? "+" : "-"}
                      {formatCurrency(isIncome ? getTransactionGrossAmount(row) : row.amount)}
                    </strong>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
      <StatementImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </section>
  );
}
