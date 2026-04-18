import { Ban, Clock3, ShieldAlert } from "lucide-react";

type AuthStatusKind = "pending" | "blocked" | "denied";

type AuthStatusScreenProps = {
  kind: AuthStatusKind;
  onLogout: () => void;
};

const COPY: Record<AuthStatusKind, { title: string; description: string; icon: typeof Clock3 }> = {
  pending: {
    title: "Aguardando aprovação",
    description:
      "Seu cadastro foi recebido com sucesso. Assim que sua conta for aprovada, você terá acesso completo ao FluxoCerto360.",
    icon: Clock3,
  },
  blocked: {
    title: "Acesso bloqueado",
    description:
      "Seu acesso está bloqueado no momento. Entre em contato com o administrador para solicitar reativação.",
    icon: Ban,
  },
  denied: {
    title: "Acesso negado",
    description: "Você não possui permissão para acessar esta área.",
    icon: ShieldAlert,
  },
};

export default function AuthStatusScreen({ kind, onLogout }: AuthStatusScreenProps) {
  const content = COPY[kind];
  const Icon = content.icon;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030706] p-4 text-[#f6fffb]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(25,245,193,0.16),transparent_32%),linear-gradient(160deg,rgba(7,20,17,0.82),rgba(3,7,6,0.98))]" />
      <article className="relative z-10 w-full max-w-xl rounded-[30px] border border-[rgba(92,255,196,0.22)] bg-[rgba(7,20,17,0.78)] p-8 text-center shadow-[0_22px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(92,255,196,0.24)] bg-[rgba(12,35,29,0.86)] text-[#8df7d8]">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black tracking-[0.01em] text-[#f6fffb]">{content.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[rgba(230,255,247,0.78)]">{content.description}</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-7 h-11 rounded-2xl border border-[rgba(92,255,196,0.24)] bg-[rgba(8,23,20,0.68)] px-6 text-sm font-semibold text-[#f6fffb] transition hover:bg-[rgba(11,37,31,0.92)]"
        >
          Voltar para login
        </button>
      </article>
    </div>
  );
}
