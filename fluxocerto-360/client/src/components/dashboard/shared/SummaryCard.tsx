type SummaryCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "success" | "danger";
};

export default function SummaryCard({ label, value, helper, tone = "default" }: SummaryCardProps) {
  return (
    <article className={`fd-summary-v2-card ${tone}`}>
      <p>{label}</p>
      <h3>{value}</h3>
      {helper ? <span>{helper}</span> : null}
    </article>
  );
}
