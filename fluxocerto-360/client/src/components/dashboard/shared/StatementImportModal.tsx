import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, X } from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/contexts/AppContext";
import {
  formatStatementParseError,
  isPossibleDuplicate,
  parseStatementFileWithDiagnostics,
  type ParsedStatementRow,
  type StatementParseDiagnostics,
  type StatementConfidence,
} from "@/lib/statementImport";
import { TransactionType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type StatementImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type PreviewRow = ParsedStatementRow & {
  ignored: boolean;
  duplicate: boolean;
  allowDuplicate: boolean;
};

const CATEGORY_OPTIONS = [
  "servico",
  "extra",
  "moradia",
  "internet",
  "alimentacao",
  "transporte",
  "fornecedores",
  "taxas",
  "impostos",
  "assinatura/app",
  "outros",
];

function confidenceLabel(confidence: StatementConfidence) {
  if (confidence === "high") return "Alta";
  if (confidence === "medium") return "Media";
  return "Baixa";
}

function delimiterLabel(delimiter?: string) {
  if (delimiter === "\t") return "tab";
  if (delimiter) return delimiter;
  return "nao identificado";
}

export default function StatementImportModal({ isOpen, onClose }: StatementImportModalProps) {
  const { accounts, pots, transactions, addTransaction } = useApp();
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<StatementParseDiagnostics | null>(null);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkPotId, setBulkPotId] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const importableRows = useMemo(
    () => rows.filter((row) => !row.ignored && (!row.duplicate || row.allowDuplicate)),
    [rows]
  );
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds[row.id]), [rows, selectedIds]);
  const defaultAccount = accounts[0]?.name ?? "Conta Corrente";

  if (!isOpen) return null;

  const resetAndClose = () => {
    setRows([]);
    setSelectedIds({});
    setError(null);
    setDiagnostics(null);
    setIsConfirming(false);
    onClose();
  };

  const updateRow = (rowId: string, changes: Partial<PreviewRow>) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...changes } : row)));
  };

  const applyToSelected = (changes: Partial<PreviewRow>) => {
    setRows((prev) => prev.map((row) => (selectedIds[row.id] ? { ...row, ...changes } : row)));
  };

  const handleFile = async (file?: File) => {
    setError(null);
    setDiagnostics(null);
    setRows([]);
    setIsConfirming(false);
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "ofx") {
      setError("Envie um arquivo CSV ou OFX.");
      return;
    }
    const content = await file.text();
    const parsed = parseStatementFileWithDiagnostics(content, file.name, pots);
    setDiagnostics(parsed.diagnostics);
    if (import.meta.env.DEV) {
      console.warn("[FluxoCerto importacao extrato]", {
        headers: parsed.diagnostics.headers,
        primeirasLinhas: parsed.diagnostics.previewRows.slice(0, 3),
        transacoesValidas: parsed.rows.length,
      });
    }
    if (parsed.rows.length > 300) {
      setError("Para manter precisao, importe ate 300 transacoes por vez.");
      return;
    }
    if (parsed.rows.length === 0) {
      setError(formatStatementParseError(parsed.diagnostics));
      return;
    }
    setRows(
      parsed.rows.map((row) => ({
        ...row,
        ignored: false,
        duplicate: isPossibleDuplicate(row, transactions),
        allowDuplicate: false,
      }))
    );
  };

  const confirmImport = () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    let saved = 0;
    for (const row of importableRows) {
      const result = addTransaction({
        type: row.type,
        amount: row.amount,
        grossAmount: row.amount,
        description: row.description,
        category: row.category,
        date: row.date,
        account: defaultAccount,
        potId: row.potId,
        paymentMethod: row.paymentMethod,
        origin: "Importacao de extrato",
        source: "statement-import",
        notes: row.duplicate ? "Importado mesmo com possivel duplicidade" : "Importado de extrato revisado",
      });
      if (result.ok) saved += 1;
    }
    toast.success(`${saved} transacao(oes) importada(s).`);
    resetAndClose();
  };

  return (
    <div className="fd-modal-backdrop" role="dialog" aria-modal="true">
      <article className="fd-modal-card fd-statement-modal">
        <header className="fd-modal-head">
          <div>
            <h3>Importar extrato</h3>
            <p>Revise antes de salvar. O app sugere. Voce decide.</p>
          </div>
          <button type="button" className="fd-icon-btn" onClick={resetAndClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>

        <section className="fd-statement-upload">
          <FileUp className="h-5 w-5" />
          <div>
            <strong>CSV ou OFX</strong>
            <span>Limite inicial: 300 transacoes por importacao.</span>
          </div>
          <input
            type="file"
            accept=".csv,.ofx,text/csv,application/x-ofx"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </section>

        {error ? (
          <div className="fd-statement-error-box">
            <p className="fd-statement-error">{error}</p>
            {diagnostics ? (
              <dl className="fd-statement-diagnostics">
                <div>
                  <dt>Tipo</dt>
                  <dd>{diagnostics.detectedType.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>Linhas</dt>
                  <dd>{diagnostics.lineCount}</dd>
                </div>
                <div>
                  <dt>Separador</dt>
                  <dd>{delimiterLabel(diagnostics.delimiter)}</dd>
                </div>
                <div>
                  <dt>Cabecalhos</dt>
                  <dd>{diagnostics.headers.length ? diagnostics.headers.join(", ") : "nao identificados"}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <section className="fd-statement-toolbar">
              <button type="button" className="fd-mini-btn" onClick={() => applyToSelected({ ignored: false })}>
                Editar selecionadas
              </button>
              <button type="button" className="fd-mini-btn" onClick={() => applyToSelected({ ignored: true })}>
                Ignorar selecionadas
              </button>
              <button
                type="button"
                className="fd-ghost-btn"
                onClick={() => setRows((prev) => prev.map((row) => (row.confidence === "high" ? { ...row, ignored: false } : row)))}
              >
                Confirmar todas confiaveis
              </button>
              <select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}>
                <option value="">Categoria em lote</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button type="button" className="fd-mini-btn" disabled={!bulkCategory} onClick={() => applyToSelected({ category: bulkCategory })}>
                Aplicar
              </button>
              <select value={bulkPotId} onChange={(event) => setBulkPotId(event.target.value)}>
                <option value="">Pote em lote</option>
                {pots.map((pot) => (
                  <option key={pot.id} value={pot.id}>{pot.name}</option>
                ))}
              </select>
              <button type="button" className="fd-mini-btn" disabled={!bulkPotId} onClick={() => applyToSelected({ potId: bulkPotId })}>
                Aplicar
              </button>
            </section>

            <div className="fd-statement-table-wrap">
              <table className="fd-statement-table">
                <thead>
                  <tr>
                    <th />
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Data</th>
                    <th>Descricao</th>
                    <th>Categoria</th>
                    <th>Pote</th>
                    <th>Confianca</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={`${row.ignored ? "ignored" : ""} ${row.duplicate ? "duplicate" : ""}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selectedIds[row.id]}
                          onChange={(event) => setSelectedIds((prev) => ({ ...prev, [row.id]: event.target.checked }))}
                        />
                      </td>
                      <td>
                        <select value={row.type} onChange={(event) => updateRow(row.id, { type: event.target.value as TransactionType.INCOME | TransactionType.EXPENSE })}>
                          <option value={TransactionType.INCOME}>Entrada</option>
                          <option value={TransactionType.EXPENSE}>Saida</option>
                        </select>
                      </td>
                      <td>{formatCurrency(row.amount)}</td>
                      <td>
                        <input type="date" value={row.date} onChange={(event) => updateRow(row.id, { date: event.target.value })} />
                      </td>
                      <td>
                        <input value={row.description} onChange={(event) => updateRow(row.id, { description: event.target.value })} />
                        {row.duplicate ? <small>Possivel duplicado</small> : null}
                      </td>
                      <td>
                        <select value={row.category} onChange={(event) => updateRow(row.id, { category: event.target.value })}>
                          {CATEGORY_OPTIONS.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={row.potId ?? ""} onChange={(event) => updateRow(row.id, { potId: event.target.value })}>
                          {pots.map((pot) => (
                            <option key={pot.id} value={pot.id}>{pot.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`fd-confidence ${row.confidence}`}>{confidenceLabel(row.confidence)}</span>
                      </td>
                      <td>
                        <button type="button" className="fd-mini-btn" onClick={() => updateRow(row.id, { ignored: !row.ignored })}>
                          {row.ignored ? "Reativar" : "Ignorar"}
                        </button>
                        {row.duplicate ? (
                          <button type="button" className="fd-mini-btn" onClick={() => updateRow(row.id, { allowDuplicate: !row.allowDuplicate })}>
                            {row.allowDuplicate ? "Nao importar dup." : "Importar mesmo assim"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="fd-statement-footer">
              <div>
                <strong>{importableRows.length} prontas para importar</strong>
                <span>Itens em vermelho precisam de atencao.</span>
                {selectedRows.length > 0 ? <small>{selectedRows.length} selecionada(s)</small> : null}
              </div>
              {isConfirming ? (
                <p><AlertTriangle className="h-4 w-4" /> Confirme antes de importar para seu financeiro.</p>
              ) : null}
              <button type="button" className="fd-mini-btn" onClick={() => setIsConfirming(false)}>
                Revisar mais
              </button>
              <button type="button" className="fd-mini-btn" onClick={resetAndClose}>
                Cancelar
              </button>
              <button type="button" className="fd-primary-btn" disabled={importableRows.length === 0} onClick={confirmImport}>
                <CheckCircle2 className="h-4 w-4" />
                {isConfirming ? "Confirmar importacao" : "Importar revisadas"}
              </button>
            </footer>
          </>
        ) : null}
      </article>
    </div>
  );
}
