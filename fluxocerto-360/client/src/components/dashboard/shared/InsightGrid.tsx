type InsightItem = {
  label: string;
  value: string;
};

type InsightGridProps = {
  title: string;
  subtitle?: string;
  items: InsightItem[];
};

export default function InsightGrid({ title, subtitle, items }: InsightGridProps) {
  return (
    <article className="fd-panel fd-glass">
      <div className="fd-panel-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="fd-insights-grid">
        {items.map((item) => (
          <div key={item.label} className="fd-insight-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
