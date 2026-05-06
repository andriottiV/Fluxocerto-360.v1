import { PaymentMethod, Pot, PotType, Transaction, TransactionType } from "@/lib/types";

export type StatementConfidence = "high" | "medium" | "low";

export type ParsedStatementRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  paymentMethod?: PaymentMethod;
  category: string;
  potId?: string;
  confidence: StatementConfidence;
  confidenceReason: string;
  raw: string;
};

export type RawStatementRow = {
  date: string;
  description: string;
  amount: number;
  raw: string;
};

export type StatementParseDiagnostics = {
  detectedType: "csv" | "ofx" | "unknown";
  lineCount: number;
  headers: string[];
  delimiter?: string;
  rawRows: number;
  validRows: number;
  reason?: string;
  previewRows: Array<Record<string, string> | RawStatementRow>;
};

export type StatementParseResult = {
  rows: ParsedStatementRow[];
  diagnostics: StatementParseDiagnostics;
};

type CsvHeaderMap = {
  dateIndex: number;
  descriptionIndex: number;
  amountIndex: number;
  incomeIndex: number;
  expenseIndex: number;
};

const EMPTY_CSV_MAP: CsvHeaderMap = {
  dateIndex: -1,
  descriptionIndex: -1,
  amountIndex: -1,
  incomeIndex: -1,
  expenseIndex: -1,
};

const CATEGORY_RULES = [
  { category: "moradia", terms: ["aluguel", "condominio", "imobiliaria"] },
  { category: "internet", terms: ["internet", "vivo", "claro", "tim", "oi", "fibra"] },
  { category: "alimentacao", terms: ["mercado", "supermercado", "restaurante", "ifood", "padaria"] },
  { category: "transporte", terms: ["uber", "99", "combustivel", "posto", "metro", "onibus"] },
  { category: "fornecedores", terms: ["fornecedor", "atacado", "distribuidora"] },
  { category: "taxas", terms: ["tarifa", "taxa", "iof", "juros"] },
  { category: "impostos", terms: ["das", "mei", "imposto", "receita federal"] },
  { category: "assinatura/app", terms: ["netflix", "spotify", "google", "apple", "software", "assinatura"] },
  { category: "servico", terms: ["pix recebido", "transferencia recebida", "recebimento", "credito recebido"] },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseMoney(value: string) {
  const raw = String(value ?? "").trim();
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  const isNegative = raw.includes("-") || /\(.+\)/.test(raw);
  const numeric = cleaned.replace(/-/g, "");
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  let normalized = numeric;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? numeric.replace(/\./g, "").replace(",", ".") : numeric.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = numeric.replace(/\./g, "").replace(",", ".");
  } else if ((numeric.match(/\./g) ?? []).length > 1) {
    normalized = numeric.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  const amount = Number(parsed.toFixed(2));
  return isNegative ? -Math.abs(amount) : amount;
}

function parseDate(value: string) {
  const text = String(value ?? "").trim();
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    return `${year}-${String(Number(br[2])).padStart(2, "0")}-${String(Number(br[1])).padStart(2, "0")}`;
  }
  const iso = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}-${String(Number(iso[3])).padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && next === "\"" && quoted) {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(firstLine: string) {
  const candidates = [";", ",", "\t"];
  return candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
}

function findHeader(headers: string[], names: string[]) {
  const normalizedNames = names.map(normalizeText);
  return headers.findIndex((header) => {
    const normalizedHeader = normalizeText(header);
    return normalizedNames.some((name) => normalizedHeader === name || normalizedHeader.includes(name));
  });
}

function mapCsvHeaders(headers: string[]): CsvHeaderMap {
  return {
    dateIndex: findHeader(headers, ["data", "date", "dt", "lancamento", "lançamento", "movimento"]),
    descriptionIndex: findHeader(headers, [
      "descricao",
      "descrição",
      "historico",
      "histórico",
      "memo",
      "favorecido",
      "beneficiario",
      "nome",
      "description",
      "detalhe",
    ]),
    amountIndex: findHeader(headers, ["valor", "amount", "montante", "valor lancamento", "valor lançamento", "valor transacao", "valor transação"]),
    incomeIndex: findHeader(headers, ["entrada", "credito", "crédito", "credit", "receita", "recebido", "entradas"]),
    expenseIndex: findHeader(headers, ["saida", "saída", "debito", "débito", "debit", "despesa", "pago", "saidas", "saídas"]),
  };
}

function scoreCsvHeaders(map: CsvHeaderMap) {
  let score = 0;
  if (map.dateIndex >= 0) score += 3;
  if (map.descriptionIndex >= 0) score += 1;
  if (map.amountIndex >= 0) score += 3;
  if (map.incomeIndex >= 0) score += 2;
  if (map.expenseIndex >= 0) score += 2;
  return score;
}

function findCsvHeaderLine(lines: string[]) {
  let best = { index: -1, delimiter: detectDelimiter(lines[0] ?? ""), headers: [] as string[], map: EMPTY_CSV_MAP, score: 0 };
  lines.slice(0, 8).forEach((line, index) => {
    [";", ",", "\t"].forEach((delimiter) => {
      const headers = splitCsvLine(line, delimiter);
      const map = mapCsvHeaders(headers);
      const score = scoreCsvHeaders(map);
      if (score > best.score || (score === best.score && headers.length > best.headers.length)) {
        best = { index, delimiter, headers, map, score };
      }
    });
  });
  return best;
}

function buildDescription(cells: string[], map: CsvHeaderMap) {
  if (map.descriptionIndex >= 0 && cells[map.descriptionIndex]) return cells[map.descriptionIndex];
  const ignored = new Set([map.dateIndex, map.amountIndex, map.incomeIndex, map.expenseIndex]);
  return cells.filter((cell, index) => cell && !ignored.has(index) && parseMoney(cell) === 0).join(" ").trim() || "Movimento importado";
}

function inferCsvRow(line: string, delimiter: string, map: CsvHeaderMap): RawStatementRow {
  const cells = splitCsvLine(line, delimiter);
  const credit = map.incomeIndex >= 0 ? parseMoney(cells[map.incomeIndex]) : 0;
  const debit = map.expenseIndex >= 0 ? parseMoney(cells[map.expenseIndex]) : 0;
  const directAmount = map.amountIndex >= 0 ? parseMoney(cells[map.amountIndex]) : 0;
  const amount = directAmount !== 0 ? directAmount : credit > 0 ? credit : debit > 0 ? -Math.abs(debit) : debit < 0 ? debit : 0;
  return {
    date: parseDate(cells[map.dateIndex] ?? ""),
    description: buildDescription(cells, map),
    amount,
    raw: line,
  };
}

function inferCsvRowWithoutHeader(line: string, delimiter: string): RawStatementRow {
  const cells = splitCsvLine(line, delimiter);
  const dateCell = cells.find((cell) => parseDate(cell));
  const amountCell = [...cells].reverse().find((cell) => parseMoney(cell) !== 0);
  const amountIndex = amountCell ? cells.lastIndexOf(amountCell) : -1;
  const dateIndex = dateCell ? cells.indexOf(dateCell) : -1;
  const description = cells.filter((cell, index) => index !== dateIndex && index !== amountIndex && parseMoney(cell) === 0).join(" ").trim();
  return {
    date: parseDate(dateCell ?? ""),
    description: description || "Movimento importado",
    amount: parseMoney(amountCell ?? ""),
    raw: line,
  };
}

export function parseCsvStatementWithDiagnostics(content: string): { rows: RawStatementRow[]; diagnostics: StatementParseDiagnostics } {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const baseDiagnostics: StatementParseDiagnostics = {
    detectedType: "csv",
    lineCount: lines.length,
    headers: [],
    rawRows: 0,
    validRows: 0,
    previewRows: [],
  };
  if (lines.length < 1) return { rows: [], diagnostics: { ...baseDiagnostics, reason: "Arquivo vazio." } };

  const headerCandidate = findCsvHeaderLine(lines);
  const mappedValueIndexes = [headerCandidate.map.amountIndex, headerCandidate.map.incomeIndex, headerCandidate.map.expenseIndex].filter((index) => index >= 0);
  const hasMappedColumns = headerCandidate.map.dateIndex >= 0 && mappedValueIndexes.some((index) => index !== headerCandidate.map.dateIndex);
  const delimiter = headerCandidate.delimiter || detectDelimiter(lines[0]);
  const dataLines = hasMappedColumns ? lines.slice(headerCandidate.index + 1) : lines;
  const rows = dataLines.map((line) =>
    hasMappedColumns ? inferCsvRow(line, delimiter, headerCandidate.map) : inferCsvRowWithoutHeader(line, delimiter)
  );
  const validRows = rows.filter((row) => row.date && row.amount !== 0);
  let reason = "";
  if (!hasMappedColumns) reason = "Nao identificamos colunas de data e valor no cabecalho.";
  else if (headerCandidate.map.dateIndex < 0) reason = "Nao identificamos coluna de data.";
  else if (headerCandidate.map.amountIndex < 0 && headerCandidate.map.incomeIndex < 0 && headerCandidate.map.expenseIndex < 0) reason = "Nao identificamos coluna de valor, entrada ou saida.";
  else if (validRows.length === 0) reason = "As colunas foram encontradas, mas nenhuma linha tinha data e valor validos.";

  return {
    rows: validRows,
    diagnostics: {
      ...baseDiagnostics,
      headers: hasMappedColumns ? headerCandidate.headers : headerCandidate.headers,
      delimiter,
      rawRows: dataLines.length,
      validRows: validRows.length,
      reason,
      previewRows: rows.slice(0, 3),
    },
  };
}

export function parseCsvStatement(content: string): RawStatementRow[] {
  return parseCsvStatementWithDiagnostics(content).rows;
}

function getOfxTag(block: string, tag: string) {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)(?=<[A-Z][A-Z0-9]*>|$)`, "i"))?.[1]?.trim() ?? "";
}

function classifyOfxAmount(rawAmount: string, trnType: string, description: string) {
  const signedAmount = parseMoney(rawAmount);
  if (signedAmount < 0) return signedAmount;
  if (signedAmount > 0) {
    const type = normalizeText(trnType);
    const text = normalizeText(description);
    if (["debit", "withdrawal", "fee", "srvchg", "check", "pos"].includes(type)) return -Math.abs(signedAmount);
    if (type === "payment" && /(pago|pagamento|debito|pix enviado|pix pago)/.test(text)) return -Math.abs(signedAmount);
    return signedAmount;
  }
  return 0;
}

export function parseOfxStatementWithDiagnostics(content: string): { rows: RawStatementRow[]; diagnostics: StatementParseDiagnostics } {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const blocks = content.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTTRN>|$)/gi) ?? [];
  const rows = blocks.map((block) => {
    const rawDate = getOfxTag(block, "DTPOSTED").slice(0, 8);
    const date = rawDate ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : "";
    const memo = getOfxTag(block, "MEMO") || getOfxTag(block, "NAME") || "Movimento importado";
    return {
      date,
      description: memo,
      amount: classifyOfxAmount(getOfxTag(block, "TRNAMT"), getOfxTag(block, "TRNTYPE"), memo),
      raw: block,
    };
  });
  const validRows = rows.filter((row) => row.date && row.amount !== 0);
  return {
    rows: validRows,
    diagnostics: {
      detectedType: "ofx",
      lineCount: lines.length,
      headers: ["STMTTRN", "TRNTYPE", "DTPOSTED", "TRNAMT", "MEMO", "NAME"].filter((tag) => new RegExp(`<${tag}>`, "i").test(content)),
      rawRows: blocks.length,
      validRows: validRows.length,
      reason: validRows.length ? "" : blocks.length ? "Encontramos movimentos OFX, mas sem data ou valor validos." : "Nao encontramos blocos STMTTRN no OFX.",
      previewRows: rows.slice(0, 3),
    },
  };
}

export function parseOfxStatement(content: string): RawStatementRow[] {
  return parseOfxStatementWithDiagnostics(content).rows;
}

function inferPaymentMethod(description: string): PaymentMethod | undefined {
  const text = normalizeText(description);
  if (text.includes("pix")) return "pix";
  if (text.includes("debito") || text.includes("debit")) return "debito";
  if (text.includes("credito") || text.includes("credit")) return "credito";
  if (text.includes("dinheiro") || text.includes("cash")) return "dinheiro";
  if (text.includes("transfer")) return "transferencia";
  return undefined;
}

function inferCategory(description: string, type: TransactionType) {
  const text = normalizeText(description);
  const match = CATEGORY_RULES.find((rule) => rule.terms.some((term) => text.includes(normalizeText(term))));
  if (match) return match.category;
  return type === TransactionType.INCOME ? "extra" : "outros";
}

function inferPotId(category: string, type: TransactionType, pots: Pot[]) {
  const personal = pots.find((pot) => pot.type === PotType.PERSONAL) ?? pots[0];
  const business = pots.find((pot) => pot.type === PotType.BUSINESS) ?? pots[0];
  const reserve = pots.find((pot) => pot.type === PotType.RESERVE) ?? pots[0];
  if (category.includes("reserva")) return reserve?.id;
  if (type === TransactionType.INCOME) return business?.id;
  if (["fornecedores", "taxas", "impostos", "assinatura/app"].includes(category)) return business?.id;
  return personal?.id;
}

function confidenceFor(description: string, category: string, paymentMethod?: PaymentMethod): { level: StatementConfidence; reason: string } {
  const text = normalizeText(description);
  if (paymentMethod === "pix" && description.length > 8 && category !== "outros") {
    return { level: "high", reason: "Pix e categoria reconhecidos" };
  }
  if (category !== "outros" && category !== "extra") return { level: "medium", reason: "Categoria provavel" };
  if (text.length < 6 || /compra|pagamento|transferencia|lancamento/.test(text)) {
    return { level: "low", reason: "Descricao generica" };
  }
  return { level: "medium", reason: "Tipo e valor reconhecidos" };
}

export function interpretStatementRows(rows: RawStatementRow[], pots: Pot[]): ParsedStatementRow[] {
  return rows.map((row) => {
    const type = row.amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
    const amount = Math.abs(row.amount);
    const paymentMethod = inferPaymentMethod(row.description);
    const category = inferCategory(row.description, type);
    const confidence = confidenceFor(row.description, category, paymentMethod);
    return {
      id: createId("stmt"),
      date: row.date,
      description: row.description.trim() || "Movimento importado",
      amount,
      type,
      paymentMethod,
      category,
      potId: inferPotId(category, type, pots),
      confidence: confidence.level,
      confidenceReason: confidence.reason,
      raw: row.raw,
    };
  });
}

export function parseStatementFileWithDiagnostics(content: string, filename: string, pots: Pot[]): StatementParseResult {
  const extension = filename.split(".").pop()?.toLowerCase();
  const detectedType = extension === "ofx" ? "ofx" : extension === "csv" ? "csv" : content.includes("<OFX") || content.includes("<STMTTRN>") ? "ofx" : "csv";
  const parsed = detectedType === "ofx" ? parseOfxStatementWithDiagnostics(content) : parseCsvStatementWithDiagnostics(content);
  return {
    rows: interpretStatementRows(parsed.rows, pots),
    diagnostics: { ...parsed.diagnostics, detectedType },
  };
}

export function parseStatementFile(content: string, filename: string, pots: Pot[]) {
  return parseStatementFileWithDiagnostics(content, filename, pots).rows;
}

export function formatStatementParseError(diagnostics: StatementParseDiagnostics) {
  const type = diagnostics.detectedType.toUpperCase();
  const headers = diagnostics.headers.length ? diagnostics.headers.join(", ") : "nenhum cabecalho claro";
  const reason = diagnostics.reason || "Nao conseguimos identificar as colunas principais.";
  return `Nao conseguimos identificar as colunas principais. Verifique se o arquivo tem data, descricao e valor. ${reason} Tipo detectado: ${type}. Lemos ${diagnostics.lineCount} linha(s), ${diagnostics.rawRows} movimento(s) bruto(s), cabecalhos: ${headers}.`;
}

export function isPossibleDuplicate(row: Pick<ParsedStatementRow, "date" | "amount" | "description">, transactions: Transaction[]) {
  const rowDescription = normalizeText(row.description);
  return transactions.some((tx) => {
    const sameDate = tx.date === row.date;
    const sameAmount = Math.abs(Number(tx.amount) - row.amount) < 0.01 || Math.abs(Number(tx.grossAmount ?? tx.amount) - row.amount) < 0.01;
    const txDescription = normalizeText(tx.description);
    const similarDescription =
      rowDescription.includes(txDescription.slice(0, 10)) ||
      txDescription.includes(rowDescription.slice(0, 10));
    return sameDate && sameAmount && similarDescription;
  });
}
