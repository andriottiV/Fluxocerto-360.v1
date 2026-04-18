// ============================================================================
// UTÍLITÁRIOS - FluxoCerto 360
// Design: Funções auxiliares para formatação, cálculos e validação
// ============================================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ============================================================================
// UTÍLITÁRIOS TAILWIND
// ============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// FORMATAÇÃO
// ============================================================================

/**
 * Formata um número como moeda brasileira
 * @param value - Valor numérico
 * @returns String formatada (ex: "R$ 1.234,56")
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata um percentual
 * @param current - Valor atual
 * @param total - Valor total
 * @returns Percentual formatado (ex: "73%")
 */
export function formatPercent(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * Obtém as iniciais de um nome
 * @param name - Nome completo
 * @returns Iniciais (ex: "João Silva" -> "JS")
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Formata uma data
 * @param date - Data em string ou Date
 * @param format - Formato desejado (pt-BR por padrão)
 * @returns Data formatada
 */
export function formatDate(date: string | Date, format: "short" | "long" = "short"): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (format === "short") {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dateObj);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

/**
 * Formata um telefone
 * @param phone - Telefone sem formatação
 * @returns Telefone formatado (ex: "(11) 99999-9999")
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length !== 11) return phone;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

/**
 * Formata um CNPJ
 * @param cnpj - CNPJ sem formatação
 * @returns CNPJ formatado (ex: "12.345.678/0001-90")
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
}

/**
 * Trunca um texto com reticências
 * @param text - Texto a truncar
 * @param maxLength - Comprimento máximo
 * @returns Texto truncado
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ============================================================================
// CÁLCULOS FINANCEIROS
// ============================================================================

/**
 * Calcula a taxa de uma transação
 * @param amount - Valor da transação
 * @param type - Tipo de transação
 * @param rates - Objeto com as taxas
 * @returns Taxa calculada
 */
export function calcTaxa(
  amount: number,
  type: "credito" | "debito" | "pix",
  rates: Record<string, number>
): number {
  const rate = rates[type] || 0;
  return (amount * rate) / 100;
}

/**
 * Calcula o saldo disponível
 * @param totalBalance - Saldo total
 * @param blockedAmount - Valor bloqueado
 * @returns Saldo disponível
 */
export function calcSaldoDisponivel(totalBalance: number, blockedAmount: number): number {
  return Math.max(0, totalBalance - blockedAmount);
}

/**
 * Calcula o total de todos os potes
 * @param pots - Array de potes
 * @returns Total dos potes
 */
export function calcTotalPotes(pots: Array<{ balance: number }>): number {
  return pots.reduce((total, pot) => total + pot.balance, 0);
}

/**
 * Calcula o percentual de utilização de um pote
 * @param current - Saldo atual
 * @param limit - Limite do pote
 * @returns Percentual (0-100)
 */
export function calcPotUsage(current: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, (current / limit) * 100);
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Valida um email
 * @param email - Email a validar
 * @returns true se válido
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida uma senha
 * @param password - Senha a validar
 * @returns true se válido (mínimo 6 caracteres)
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Valida um telefone
 * @param phone - Telefone a validar
 * @returns true se válido
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length === 11;
}

/**
 * Valida um CNPJ
 * @param cnpj - CNPJ a validar
 * @returns true se válido
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/(\d)\1{13}/.test(cleaned)) return false;
  return true;
}

// ============================================================================
// MANIPULAÇÃO DE ARRAYS
// ============================================================================

/**
 * Ordena um array por um campo específico
 * @param array - Array a ordenar
 * @param field - Campo para ordenar
 * @param order - Ordem (asc ou desc)
 * @returns Array ordenado
 */
export function sortBy<T extends Record<string, any>>(
  array: T[],
  field: keyof T,
  order: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

/**
 * Agrupa um array por um campo específico
 * @param array - Array a agrupar
 * @param field - Campo para agrupar
 * @returns Objeto com grupos
 */
export function groupBy<T extends Record<string, any>>(
  array: T[],
  field: keyof T
): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = String(item[field]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

// ============================================================================
// MANIPULAÇÃO DE DATAS
// ============================================================================

/**
 * Obtém o início do dia
 * @param date - Data (padrão: hoje)
 * @returns Data no início do dia
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obtém o fim do dia
 * @param date - Data (padrão: hoje)
 * @returns Data no fim do dia
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Calcula a diferença entre duas datas em dias
 * @param date1 - Primeira data
 * @param date2 - Segunda data
 * @returns Diferença em dias
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * Obtém o tempo relativo (ex: "há 2 horas")
 * @param date - Data
 * @returns Tempo relativo
 */
export function getRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (seconds < 60) return "agora";
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} minuto(s)`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} hora(s)`;
  if (seconds < 604800) return `há ${Math.floor(seconds / 86400)} dia(s)`;

  return formatDate(dateObj, "short");
}

// ============================================================================
// GERAÇÃO DE IDS
// ============================================================================

/**
 * Gera um ID único
 * @returns ID único
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// CONVERSÃO DE TIPOS
// ============================================================================

/**
 * Converte um objeto para JSON
 * @param obj - Objeto a converter
 * @returns String JSON
 */
export function toJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * Converte JSON para objeto
 * @param json - String JSON
 * @returns Objeto convertido
 */
export function fromJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ============================================================================
// UTÍLITÁRIOS DIVERSOS
// ============================================================================

/**
 * Cria um delay
 * @param ms - Milissegundos
 * @returns Promise que resolve após o delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Copia um texto para a área de transferência
 * @param text - Texto a copiar
 * @returns Promise
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Erro ao copiar:", err);
  }
}

/**
 * Obtém um valor aleatório de um array
 * @param array - Array
 * @returns Elemento aleatório
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Embaralha um array
 * @param array - Array a embaralhar
 * @returns Array embaralhado
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Verifica se um objeto está vazio
 * @param obj - Objeto a verificar
 * @returns true se vazio
 */
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === "string") return obj.trim().length === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === "object") return Object.keys(obj).length === 0;
  return false;
}
