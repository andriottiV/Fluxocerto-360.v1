type MoneyValueProps = {
  value: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
};

export default function MoneyValue({
  value,
  className = "",
  size = "md",
  title,
}: MoneyValueProps) {
  return (
    <span className={`fd-money-value ${size} ${className}`.trim()} title={title ?? value}>
      {value}
    </span>
  );
}
