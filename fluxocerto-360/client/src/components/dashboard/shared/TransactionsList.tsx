import { Transaction, TransactionType } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type TransactionsListProps = {
  title: string;
  subtitle?: string;
  transactions: Transaction[];
  emptyLabel?: string;
};

export default function TransactionsList({
  title,
  subtitle,
  transactions,
  emptyLabel = "Sem movimentacoes no periodo",
}: TransactionsListProps) {
  return (
    <article className="fd-panel fd-glass">
      <div className="fd-panel-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="fd-list">
        {transactions.length === 0 ? (
          <p className="fd-empty">{emptyLabel}</p>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="fd-list-row">
              <div>
                <p>{tx.description}</p>
                <small>
                  {formatDate(tx.date)} • {tx.category}
                </small>
              </div>
              <strong className={tx.type === TransactionType.INCOME ? "fd-positive" : "fd-negative"}>
                {tx.type === TransactionType.INCOME ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </strong>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
