type PotLike = {
  id?: string;
  key?: string;
  type?: string;
  name?: string;
  balance?: number | string | null;
  amount?: number | string | null;
  value?: number | string | null;
};

type CommitmentLike = {
  pot?: string | null;
  status?: string | null;
  amount?: number | string | null;
  value?: number | string | null;
};

export type PersonalFreeMoneyDetails = {
  personalBalance: number;
  personalCommitted: number;
  personalFreeMoney: number;
  deficit: number;
};

function normalize(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toMoney(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function isPersonalPot(pot: PotLike) {
  const candidates = [pot.id, pot.key, pot.type, pot.name].map(normalize);
  return candidates.some((candidate) => candidate === "pessoal" || candidate === "personal" || candidate === "pf" || candidate.includes("pessoal"));
}

function isPersonalCommitment(commitment: CommitmentLike) {
  const pot = normalize(commitment.pot);
  const status = normalize(commitment.status);
  const isOpen = status !== "pago" && status !== "cancelado";
  return isOpen && (pot === "pessoal" || pot === "personal" || pot === "pf");
}

export function getPersonalFreeMoneyDetails(
  pots: PotLike[] = [],
  commitments: CommitmentLike[] = []
): PersonalFreeMoneyDetails {
  const personalPot = pots.find(isPersonalPot);
  const personalBalance = roundMoney(toMoney(personalPot?.balance ?? personalPot?.amount ?? personalPot?.value));
  const personalCommitted = roundMoney(
    commitments.filter(isPersonalCommitment).reduce((sum, commitment) => sum + toMoney(commitment.amount ?? commitment.value), 0)
  );
  const rawFreeMoney = personalBalance - personalCommitted;

  return {
    personalBalance,
    personalCommitted,
    personalFreeMoney: roundMoney(Math.max(0, rawFreeMoney)),
    deficit: roundMoney(Math.max(0, -rawFreeMoney)),
  };
}

export function getPersonalFreeMoney(pots: PotLike[] = [], commitments: CommitmentLike[] = []) {
  return getPersonalFreeMoneyDetails(pots, commitments).personalFreeMoney;
}
