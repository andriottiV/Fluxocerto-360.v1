import { supabase, assertSupabaseConfigured } from "@/lib/supabaseClient";
import type { Client, Cost, Pot, Transaction, User } from "@/lib/types";

type RepositoryResult<T> = {
  data: T | null;
  error: string | null;
};

type SupabaseProfile = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: User["role"] | null;
  status?: User["status"] | null;
  onboarding_completed?: boolean | null;
  phone?: string | null;
  avatar?: string | null;
  business_name?: string | null;
  business_type?: string | null;
  cnpj?: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
  last_seen_at?: string | null;
  updated_at?: string | null;
};

type AppRecord = {
  id: string;
  ownerId?: string;
};

function localFallback<T>(data: T | null): RepositoryResult<T> {
  return {
    data,
    error: "Supabase não configurado. Fluxo local permanece ativo.",
  };
}

function mapProfileToUser(profile: SupabaseProfile): User {
  const createdAt = profile.created_at ?? new Date().toISOString();

  return {
    id: profile.id,
    name: profile.name ?? "Usuário",
    email: profile.email ?? "",
    role: profile.role === "admin" ? "admin" : profile.role === "tester" ? "tester" : "user",
    status:
      profile.status === "active" || profile.status === "pending" || profile.status === "blocked"
        ? profile.status
        : "active",
    phone: profile.phone ?? undefined,
    avatar: profile.avatar ?? undefined,
    businessName: profile.business_name ?? undefined,
    businessType: profile.business_type ?? undefined,
    cnpj: profile.cnpj ?? undefined,
    createdAt,
    lastLoginAt: profile.last_login_at ?? createdAt,
    lastSeenAt: profile.last_seen_at ?? profile.last_login_at ?? createdAt,
    onboardingCompleted: profile.onboarding_completed ?? undefined,
  };
}

function mapUserToProfile(user: User): SupabaseProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    onboarding_completed: user.onboardingCompleted ?? false,
    phone: user.phone ?? null,
    avatar: user.avatar ?? null,
    business_name: user.businessName ?? null,
    business_type: user.businessType ?? null,
    cnpj: user.cnpj ?? null,
    created_at: user.createdAt,
    last_login_at: user.lastLoginAt,
    last_seen_at: user.lastSeenAt ?? user.lastLoginAt,
    updated_at: new Date().toISOString(),
  };
}

function toSupabaseRecord<T extends AppRecord>(record: T, userId?: string) {
  const { ownerId, ...payload } = record;
  return {
    ...payload,
    user_id: userId ?? ownerId,
  };
}

function fromSupabaseRecord<T extends AppRecord>(record: Record<string, unknown>): T {
  const { user_id, ...payload } = record;
  return {
    ...payload,
    ownerId: typeof user_id === "string" ? user_id : typeof payload.ownerId === "string" ? payload.ownerId : undefined,
  } as T;
}

async function resolveRequiredUserId(explicitUserId?: string) {
  return explicitUserId ?? (await getCurrentUserId());
}

async function getCurrentUserId() {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return null;

  const { data, error } = await configured.supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function getCurrentSupabaseUser() {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback(null);

  const { data, error } = await configured.supabase.auth.getUser();
  return {
    data: data.user ?? null,
    error: error?.message ?? null,
  };
}

export async function signUpWithEmail(email: string, password: string, name?: string) {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return configured;

  const { data, error } = await configured.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name?.trim() || undefined,
      },
    },
  });

  return {
    data,
    error: error?.message ?? null,
  };
}

export async function signInWithEmail(email: string, password: string) {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return configured;

  const { data, error } = await configured.supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    data,
    error: error?.message ?? null,
  };
}

export async function signOutSupabase() {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return configured;

  const { error } = await configured.supabase.auth.signOut();
  return {
    data: !error,
    error: error?.message ?? null,
  };
}

export async function getProfile(userId?: string): Promise<RepositoryResult<User>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback<User>(null);

  const resolvedUserId = userId ?? (await getCurrentUserId());
  if (!resolvedUserId) return { data: null, error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("profiles")
    .select("*")
    .eq("id", resolvedUserId)
    .maybeSingle();

  return {
    data: data ? mapProfileToUser(data as SupabaseProfile) : null,
    error: error?.message ?? null,
  };
}

export async function upsertProfile(user: User): Promise<RepositoryResult<User>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback<User>(null);

  const { data, error } = await configured.supabase
    .from("profiles")
    .upsert(mapUserToProfile(user), { onConflict: "id" })
    .select("*")
    .single();

  return {
    data: data ? mapProfileToUser(data as SupabaseProfile) : null,
    error: error?.message ?? null,
  };
}

export async function getProfiles(): Promise<RepositoryResult<User[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback<User[]>([]);

  const { data, error } = await configured.supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return {
    data: (data ?? []).map((item) => mapProfileToUser(item as SupabaseProfile)),
    error: error?.message ?? null,
  };
}

export async function updateProfileStatus(userId: string, status: User["status"]): Promise<RepositoryResult<boolean>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback<boolean>(false);

  const { error } = await configured.supabase
    .from("profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return {
    data: !error,
    error: error?.message ?? null,
  };
}

export async function getTransactions(userId?: string): Promise<RepositoryResult<Transaction[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("transactions")
    .select("*")
    .eq("user_id", resolvedUserId)
    .order("date", { ascending: false });

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Transaction>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function insertTransaction(transaction: Transaction): Promise<RepositoryResult<Transaction>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback<Transaction>(null);
  const resolvedUserId = await resolveRequiredUserId(transaction.ownerId);
  if (!resolvedUserId) return { data: null, error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("transactions")
    .upsert(toSupabaseRecord(transaction, resolvedUserId), { onConflict: "id" })
    .select("*")
    .single();

  return {
    data: data ? fromSupabaseRecord<Transaction>(data as Record<string, unknown>) : null,
    error: error?.message ?? null,
  };
}

export async function upsertTransactions(
  transactions: Transaction[],
  userId?: string
): Promise<RepositoryResult<Transaction[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);
  if (transactions.length === 0) return { data: [], error: null };

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("transactions")
    .upsert(transactions.map((item) => toSupabaseRecord(item, resolvedUserId)), { onConflict: "id" })
    .select("*");

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Transaction>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function getPots(userId?: string): Promise<RepositoryResult<Pot[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("pots")
    .select("*")
    .eq("user_id", resolvedUserId);

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Pot>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function upsertPots(pots: Pot[], userId?: string): Promise<RepositoryResult<Pot[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);
  if (pots.length === 0) return { data: [], error: null };

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("pots")
    .upsert(pots.map((item) => toSupabaseRecord(item, resolvedUserId)), { onConflict: "id" })
    .select("*");

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Pot>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function getClients(userId?: string): Promise<RepositoryResult<Client[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("clients")
    .select("*")
    .eq("user_id", resolvedUserId);

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Client>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function insertClient(client: Client): Promise<RepositoryResult<Client>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback<Client>(null);
  const resolvedUserId = await resolveRequiredUserId(client.ownerId);
  if (!resolvedUserId) return { data: null, error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("clients")
    .upsert(toSupabaseRecord(client, resolvedUserId), { onConflict: "id" })
    .select("*")
    .single();

  return {
    data: data ? fromSupabaseRecord<Client>(data as Record<string, unknown>) : null,
    error: error?.message ?? null,
  };
}

export async function upsertClients(clients: Client[], userId?: string): Promise<RepositoryResult<Client[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);
  if (clients.length === 0) return { data: [], error: null };

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("clients")
    .upsert(clients.map((item) => toSupabaseRecord(item, resolvedUserId)), { onConflict: "id" })
    .select("*");

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Client>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function deleteClient(clientId: string, userId?: string): Promise<RepositoryResult<boolean>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback(false);

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: false, error: "Usuário Supabase não autenticado." };

  const { error } = await configured.supabase.from("clients").delete().eq("id", clientId).eq("user_id", resolvedUserId);

  return {
    data: !error,
    error: error?.message ?? null,
  };
}

export async function getCosts(userId?: string): Promise<RepositoryResult<Cost[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("costs")
    .select("*")
    .eq("user_id", resolvedUserId)
    .order("date", { ascending: false });

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Cost>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function insertCost(cost: Cost): Promise<RepositoryResult<Cost>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback<Cost>(null);
  const resolvedUserId = await resolveRequiredUserId(cost.ownerId);
  if (!resolvedUserId) return { data: null, error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("costs")
    .upsert(toSupabaseRecord(cost, resolvedUserId), { onConflict: "id" })
    .select("*")
    .single();

  return {
    data: data ? fromSupabaseRecord<Cost>(data as Record<string, unknown>) : null,
    error: error?.message ?? null,
  };
}

export async function upsertCosts(costs: Cost[], userId?: string): Promise<RepositoryResult<Cost[]>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback([]);
  if (costs.length === 0) return { data: [], error: null };

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: [], error: "Usuário Supabase não autenticado." };

  const { data, error } = await configured.supabase
    .from("costs")
    .upsert(costs.map((item) => toSupabaseRecord(item, resolvedUserId)), { onConflict: "id" })
    .select("*");

  return {
    data: (data ?? []).map((item) => fromSupabaseRecord<Cost>(item as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function deleteCost(costId: string, userId?: string): Promise<RepositoryResult<boolean>> {
  const configured = assertSupabaseConfigured();
  if (!configured.ok) return localFallback(false);

  const resolvedUserId = await resolveRequiredUserId(userId);
  if (!resolvedUserId) return { data: false, error: "Usuário Supabase não autenticado." };

  const { error } = await configured.supabase.from("costs").delete().eq("id", costId).eq("user_id", resolvedUserId);

  return {
    data: !error,
    error: error?.message ?? null,
  };
}

export { supabase };
