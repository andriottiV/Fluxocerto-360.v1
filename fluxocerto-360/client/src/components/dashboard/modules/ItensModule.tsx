import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Box,
  Clock3,
  Link2,
  PackageSearch,
  Package,
  Plus,
  ShoppingBag,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/contexts/AppContext";
import {
  TransactionType,
  type PaymentMethod,
  type ProductItem,
  type ProductType,
  type ServiceSupplyLink,
  type SupplyItem,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type PricingPaymentMode = "pix" | "debito" | "credito";
type ItemFilter = "todos" | "insumos" | "estoque";

const COST_CATEGORIES = ["transporte", "alimentacao", "outros"] as const;
const PRICING_RATES: Record<PricingPaymentMode, number> = {
  pix: 0.0049,
  debito: 0.0165,
  credito: 0.0355,
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function levelColor(type: ProductType) {
  return type === "consignado" ? "fd-stock-badge consignado" : "fd-stock-badge pago";
}

function isCurrentMonth(dateIso: string) {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
}

function daysSince(dateIso: string) {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
}

function reorderPoint(quantity: number) {
  return Math.max(2, Math.ceil(quantity * 0.2));
}

function productMargin(product: ProductItem) {
  if (product.salePrice <= 0) {
    return {
      valid: false,
      feeValue: 0,
      profit: 0,
      margin: 0,
    };
  }

  const feeValue = Number((product.salePrice * PRICING_RATES.pix).toFixed(2));
  const profit = Number((product.salePrice - product.costPrice - feeValue).toFixed(2));
  const margin = Number(((profit / product.salePrice) * 100).toFixed(1));
  return {
    valid: true,
    feeValue,
    profit,
    margin,
  };
}

export default function ItensModule() {
  const {
    services,
    addCost,
    costs,
    addTransaction,
    supplies,
    setSupplies,
    products,
    setProducts,
    serviceSupplyLinks,
    setServiceSupplyLinks,
  } = useApp();

  const [supplyForm, setSupplyForm] = useState({
    name: "",
    totalValue: "",
    quantity: "",
    date: todayIso(),
  });

  const [linkForm, setLinkForm] = useState({
    serviceId: "",
    supplyId: "",
    unitsPerService: "1",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    costPrice: "",
    salePrice: "",
    type: "pago" as ProductType,
    date: todayIso(),
  });

  const [costForm, setCostForm] = useState({
    name: "",
    category: "transporte" as (typeof COST_CATEGORIES)[number],
    amount: "",
    date: todayIso(),
  });

  const [pricingForm, setPricingForm] = useState({
    cost: "",
    desiredProfit: "",
    paymentMethod: "pix" as PricingPaymentMode,
  });
  const [itemFilter, setItemFilter] = useState<ItemFilter>("todos");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const totalSuppliesValue = useMemo(
    () => supplies.reduce((sum, item) => sum + item.totalValue, 0),
    [supplies]
  );

  const linkedServiceCosts = useMemo(() => {
    return services.map((service) => {
      const links = serviceSupplyLinks.filter((link) => link.serviceId === service.id);
      const costPerService = links.reduce((sum, link) => {
        const supply = supplies.find((item) => item.id === link.supplyId);
        if (!supply) return sum;
        return sum + supply.unitValue * link.unitsPerService;
      }, 0);

      return {
        id: service.id,
        name: service.name,
        costPerService,
        linksCount: links.length,
      };
    });
  }, [services, serviceSupplyLinks, supplies]);

  const totalProductProfit = useMemo(
    () => products.reduce((sum, item) => sum + (item.salePrice - item.costPrice) * item.soldCount, 0),
    [products]
  );

  const consignadoDebt = useMemo(
    () =>
      products
        .filter((item) => item.type === "consignado")
        .reduce((sum, item) => sum + item.costPrice * item.soldCount, 0),
    [products]
  );

  const salesSummary = useMemo(() => {
    const totalSales = products.reduce((sum, item) => sum + item.salePrice * item.soldCount, 0);
    const totalCost = products.reduce((sum, item) => sum + item.costPrice * item.soldCount, 0);
    return {
      totalSales,
      totalCost,
      totalUnits: products.reduce((sum, item) => sum + item.soldCount, 0),
    };
  }, [products]);

  const monthCostTotal = useMemo(
    () => costs.filter((cost) => isCurrentMonth(cost.date)).reduce((sum, cost) => sum + cost.amount, 0),
    [costs]
  );

  const averageServiceCost = useMemo(() => {
    const linked = linkedServiceCosts.filter((service) => service.costPerService > 0);
    if (linked.length === 0) return 0;
    return linked.reduce((sum, service) => sum + service.costPerService, 0) / linked.length;
  }, [linkedServiceCosts]);

  const criticalSupplies = useMemo(
    () => supplies.filter((item) => item.quantity <= reorderPoint(item.quantity)),
    [supplies]
  );

  const idleItems = useMemo(
    () => products.filter((item) => item.soldCount === 0 || daysSince(item.date) >= 45),
    [products]
  );

  const averageServiceTime = useMemo(() => {
    if (services.length === 0) return 0;
    const total = services.reduce((sum, service) => sum + Math.max(0, service.duration), 0);
    return total / services.length;
  }, [services]);

  const bestMarginProduct = useMemo(() => {
    return products
      .filter((product) => product.salePrice > 0)
      .map((product) => ({ product, metrics: productMargin(product) }))
      .filter((item) => item.metrics.valid)
      .sort((a, b) => b.metrics.margin - a.metrics.margin)[0] ?? null;
  }, [products]);

  const visibleItems = useMemo(() => {
    const supplyRows = supplies.map((item) => ({ kind: "insumo" as const, id: `insumo-${item.id}`, item }));
    const productRows = products.map((item) => ({ kind: "estoque" as const, id: `estoque-${item.id}`, item }));
    if (itemFilter === "insumos") return supplyRows;
    if (itemFilter === "estoque") return productRows;
    return [...supplyRows, ...productRows];
  }, [itemFilter, products, supplies]);

  const pricingSimulation = useMemo(() => {
    const cost = toNumber(pricingForm.cost);
    const desiredProfit = toNumber(pricingForm.desiredProfit);
    const feeRate = PRICING_RATES[pricingForm.paymentMethod];
    const denominator = 1 - feeRate;

    if (cost <= 0 || desiredProfit < 0 || denominator <= 0) {
      return {
        valid: false,
        finalPrice: 0,
        feeValue: 0,
        netProfit: 0,
        feeRate,
        denominator,
      };
    }

    const finalPrice = Number(((cost + desiredProfit) / denominator).toFixed(2));
    const feeValue = Number((finalPrice * feeRate).toFixed(2));
    const netProfit = Number((finalPrice - cost - feeValue).toFixed(2));

    return {
      valid: true,
      finalPrice,
      feeValue,
      netProfit,
      feeRate,
      denominator,
    };
  }, [pricingForm.cost, pricingForm.desiredProfit, pricingForm.paymentMethod]);

  const addSupply = () => {
    const totalValue = toNumber(supplyForm.totalValue);
    const quantity = toNumber(supplyForm.quantity);

    if (!supplyForm.name.trim()) {
      toast.error("Nome do item é obrigatório");
      return;
    }
    if (totalValue <= 0) {
      toast.error("Valor total do item deve ser maior que zero");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    if (!supplyForm.date) {
      toast.error("Data do item e obrigatoria");
      return;
    }

    const unitValue = totalValue / quantity;
    setSupplies((prev) => [
      {
        id: createId("supply"),
        name: supplyForm.name.trim(),
        totalValue,
        quantity,
        unitValue,
        date: supplyForm.date,
      },
      ...prev,
    ]);

    setSupplyForm({ name: "", totalValue: "", quantity: "", date: todayIso() });
    toast.success("Item cadastrado com custo por item calculado");
  };

  const linkSupplyToService = () => {
    const unitsPerService = toNumber(linkForm.unitsPerService);
    if (!linkForm.serviceId || !linkForm.supplyId) {
      toast.error("Selecione serviço e item");
      return;
    }
    if (unitsPerService <= 0) {
      toast.error("Unidades por serviço deve ser maior que zero");
      return;
    }

    const exists = serviceSupplyLinks.some(
      (item) => item.serviceId === linkForm.serviceId && item.supplyId === linkForm.supplyId
    );

    if (exists) {
      toast.error("Esse item já está vinculado ao serviço");
      return;
    }

    setServiceSupplyLinks((prev) => [
      { id: createId("link"), serviceId: linkForm.serviceId, supplyId: linkForm.supplyId, unitsPerService },
      ...prev,
    ]);
    setLinkForm((prev) => ({ ...prev, unitsPerService: "1" }));
    toast.success("Item vinculado ao serviço");
  };

  const addProduct = () => {
    const costPrice = toNumber(productForm.costPrice);
    const salePrice = toNumber(productForm.salePrice);
    if (!productForm.name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }
    if (costPrice <= 0 || salePrice <= 0) {
      toast.error("Preco de custo e venda devem ser maiores que zero");
      return;
    }
    if (!productForm.date) {
      toast.error("Data do produto e obrigatoria");
      return;
    }

    setProducts((prev) => [
      {
        id: createId("product"),
        name: productForm.name.trim(),
        costPrice,
        salePrice,
        type: productForm.type,
        date: productForm.date,
        soldCount: 0,
      },
      ...prev,
    ]);
    setProductForm({ name: "", costPrice: "", salePrice: "", type: "pago", date: todayIso() });
    toast.success("Item para venda cadastrado");
  };

  const registerSale = (product: ProductItem) => {
    const saleResult = addTransaction({
      type: TransactionType.INCOME,
      amount: product.salePrice,
      description: `Venda produto: ${product.name}`,
      category: "produto",
      date: todayIso(),
      account: "Conta Corrente",
      paymentMethod: "pix" as PaymentMethod,
      potId: "pot-002",
      origin: "Itens/Custos",
    });

    if (!saleResult.ok) {
      toast.error(saleResult.error ?? "Falha ao registrar venda");
      return;
    }

    setProducts((prev) =>
      prev.map((item) => (item.id === product.id ? { ...item, soldCount: item.soldCount + 1 } : item))
    );

    if (product.type === "pago") {
      addTransaction({
        type: TransactionType.EXPENSE,
        amount: product.costPrice,
        description: `CMV: ${product.name}`,
        category: "produto",
        date: todayIso(),
        account: "Conta Corrente",
        potId: "pot-002",
        origin: "Itens/Custos",
      });
    }

    toast.success("Venda registrada com atualizacao de lucro");
  };

  const settleConsignadoDebt = (product: ProductItem) => {
    if (product.type !== "consignado" || product.soldCount <= 0) return;

    const pending = product.costPrice * product.soldCount;
    const result = addTransaction({
      type: TransactionType.EXPENSE,
      amount: pending,
      description: `Pagamento consignado: ${product.name}`,
      category: "fornecedor",
      date: todayIso(),
      account: "Conta Corrente",
      potId: "pot-002",
      origin: "Itens/Custos",
    });

    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível quitar o consignado");
      return;
    }

    setProducts((prev) =>
      prev.map((item) => (item.id === product.id ? { ...item, soldCount: 0 } : item))
    );
    toast.success("Divida consignada quitada no PJ");
  };

  const addExternalCost = () => {
    const amount = toNumber(costForm.amount);
    if (!costForm.name.trim()) {
      toast.error("Nome do custo é obrigatório");
      return;
    }
    if (amount <= 0) {
      toast.error("Valor do custo deve ser maior que zero");
      return;
    }
    if (!costForm.date) {
      toast.error("Data do custo e obrigatoria");
      return;
    }

    const result = addCost({
      name: costForm.name.trim(),
      amount,
      category: costForm.category,
      date: costForm.date,
      status: "pago",
    });

    if (!result.ok) {
      toast.error(result.error ?? "Erro ao salvar custo");
      return;
    }

    setCostForm({ name: "", category: "transporte", amount: "", date: todayIso() });
    toast.success("Custo externo registrado e descontado do PJ");
  };

  const applySuggestedPrice = () => {
    if (!pricingSimulation.valid) {
      toast.error("Preencha os valores para simular.");
      return;
    }

    setProductForm((prev) => ({
      ...prev,
      costPrice: pricingForm.cost,
      salePrice: pricingSimulation.finalPrice.toFixed(2),
    }));
    toast.success("Preco aplicado no formulario.");
  };

  return (
    <section className="fd-items-section fd-items-premium">
      <header className="fd-items-hero">
        <div>
          <span>Insumo vs estoque</span>
          <h2>Seus custos hoje</h2>
          <p>Veja rapido o que ta saindo, o que ta acabando e onde seu lucro pode melhorar.</p>
        </div>
      </header>

      <section className="fd-items-quick-grid">
        <article className="fd-items-quick-card">
          <span>Você gastou</span>
          <strong>{formatCurrency(monthCostTotal)}</strong>
          <small>{costs.length === 0 ? "Adicione seus primeiros itens para enxergar seus custos." : "Total de custos do mês"}</small>
        </article>
        <article className="fd-items-quick-card warning">
          <span>Tá acabando</span>
          <strong>{criticalSupplies.length}</strong>
          <small>{criticalSupplies.length > 0 ? "Tem coisa acabando" : "Nada critico agora"}</small>
        </article>
        <article className="fd-items-quick-card">
          <span>Melhor margem</span>
          <strong>{bestMarginProduct ? `${bestMarginProduct.metrics.margin.toFixed(0)}%` : "-"}</strong>
          <small>{bestMarginProduct ? bestMarginProduct.product.name : "Adicione estoque para calcular"}</small>
        </article>
      </section>

      <section className="fd-items-main-panel fd-items-premium-panel">
        <div className="fd-items-filter-pills">
          {[
            { id: "todos" as const, label: "Todos" },
            { id: "insumos" as const, label: "Insumos" },
            { id: "estoque" as const, label: "Estoque" },
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={itemFilter === filter.id ? "active" : ""}
              onClick={() => setItemFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="fd-items-master-list">
          {visibleItems.length === 0 ? (
            <div className="fd-items-empty-wide">
              <PackageSearch className="h-7 w-7" />
              <p>Adicione seus primeiros itens para enxergar seus custos.</p>
            </div>
          ) : (
            visibleItems.map((row) => {
              const expanded = expandedItemId === row.id;

              if (row.kind === "insumo") {
                const item = row.item;
                const low = item.quantity <= reorderPoint(item.quantity);
                return (
                  <article key={row.id} className={`fd-items-master-card ${expanded ? "active" : ""}`}>
                    <button type="button" onClick={() => setExpandedItemId(expanded ? null : row.id)}>
                      <div className="fd-items-master-name">
                        <span className="fd-items-kind insumo"><Wrench className="h-3.5 w-3.5" /> INSUMO</span>
                        <strong>{item.name}</strong>
                      </div>
                      <div>
                        <small>Custo</small>
                        <strong>{formatCurrency(item.unitValue)}</strong>
                      </div>
                      <div>
                        <small>Saldo</small>
                        <strong>{item.quantity}</strong>
                      </div>
                      {low ? <em>Baixo</em> : null}
                    </button>
                    {expanded ? (
                      <div className="fd-items-progressive">
                        <p>Você usa isso no seu trabalho</p>
                        <div className="fd-items-progressive-grid">
                          <span>Custo: <strong>{formatCurrency(item.unitValue)}</strong></span>
                          <span>Saldo atual: <strong>{item.quantity}</strong></span>
                          <span>Comprar com: <strong>{reorderPoint(item.quantity)} unidades</strong></span>
                          <span>Último uso: <strong>{item.date}</strong></span>
                        </div>
                        <div className="fd-items-progressive-actions">
                          <button type="button" onClick={() => setSupplyForm((prev) => ({ ...prev, name: item.name }))}>+ Entrada</button>
                          <button type="button" onClick={() => toast.info("Uso manual ainda não altera saldo. Registre um custo quando consumir.")}>- Uso</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              }

              const item = row.item;
              const metrics = productMargin(item);
              return (
                <article key={row.id} className={`fd-items-master-card ${expanded ? "active" : ""}`}>
                  <button type="button" onClick={() => setExpandedItemId(expanded ? null : row.id)}>
                    <div className="fd-items-master-name">
                      <span className="fd-items-kind estoque"><Package className="h-3.5 w-3.5" /> ESTOQUE</span>
                      <strong>{item.name}</strong>
                    </div>
                    <div>
                      <small>Custo</small>
                      <strong>{formatCurrency(item.costPrice)}</strong>
                    </div>
                    <div>
                      <small>Saldo</small>
                      <strong>-</strong>
                    </div>
                    {metrics.valid && metrics.margin < 20 ? <em>Margem baixa</em> : null}
                  </button>
                  {expanded ? (
                    <div className="fd-items-progressive">
                      <p>Você vende isso</p>
                      <div className="fd-items-progressive-grid">
                        <span>Custo do produto: <strong>{formatCurrency(item.costPrice)}</strong></span>
                        <span>Preco de venda: <strong>{item.salePrice > 0 ? formatCurrency(item.salePrice) : "Não informado"}</strong></span>
                        <span>Lucro por unidade: <strong>{metrics.valid ? formatCurrency(metrics.profit) : "-"}</strong></span>
                        <span>Margem: <strong>{metrics.valid ? `${metrics.margin.toFixed(1)}%` : "-"}</strong></span>
                        <span>Saldo atual: <strong>Sem saldo cadastrado</strong></span>
                        <span>Comprar com: <strong>Defina no cadastro</strong></span>
                      </div>
                      <div className={`fd-items-margin-note ${metrics.valid && metrics.margin < 20 ? "warning" : ""}`}>
                        {!metrics.valid
                          ? "Informe o preço de venda para calcular o lucro."
                          : metrics.margin < 20
                            ? "Margem apertada. Talvez seu preço esteja baixo."
                            : "Boa margem nesse produto."}
                      </div>
                      <div className="fd-items-progressive-actions">
                        <button type="button" onClick={() => setProductForm((prev) => ({ ...prev, name: item.name, costPrice: String(item.costPrice), salePrice: String(item.salePrice) }))}>+ Entrada</button>
                        <button type="button" onClick={() => registerSale(item)}>- Venda</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      <article className="fd-panel fd-glass fd-items-premium-panel">
        <div className="fd-panel-head">
          <h2>O que você usa</h2>
          <p>Custo por item calculado automaticamente e ligação com serviços</p>
        </div>

        <div className="fd-items-form-grid">
          <input
            className="fd-pot-input"
            placeholder="Nome do que você usa"
            value={supplyForm.name}
            onChange={(event) => setSupplyForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="fd-pot-input"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Valor total"
            value={supplyForm.totalValue}
            onChange={(event) => setSupplyForm((prev) => ({ ...prev, totalValue: event.target.value }))}
          />
          <input
            className="fd-pot-input"
            type="number"
            min={1}
            step={1}
            placeholder="Quantidade"
            value={supplyForm.quantity}
            onChange={(event) => setSupplyForm((prev) => ({ ...prev, quantity: event.target.value }))}
          />
          <input
            className="fd-pot-input"
            type="date"
            value={supplyForm.date}
            onChange={(event) => setSupplyForm((prev) => ({ ...prev, date: event.target.value }))}
          />
          <button className="fd-mini-btn fd-items-add-btn" type="button" onClick={addSupply}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="fd-items-supply-grid">
          {supplies.length === 0 ? (
            <div className="fd-items-empty-wide">
              <PackageSearch className="h-7 w-7" />
              <p>Adicione seus primeiros custos para ver aqui</p>
            </div>
          ) : (
            supplies.map((item) => (
              <article key={item.id} className={`fd-items-supply-card ${item.quantity <= reorderPoint(item.quantity) ? "critical" : ""}`}>
                <div>
                  <Box className="h-5 w-5" />
                  {item.quantity <= reorderPoint(item.quantity) ? <span>Tá acabando ⚠️</span> : null}
                </div>
                <h3>{item.name}</h3>
                <strong>{formatCurrency(item.unitValue)}</strong>
                <small>Custo por item</small>
                <p>Saldo: {item.quantity} unidades</p>
                <p>Comprar quando chegar em {reorderPoint(item.quantity)}</p>
              </article>
            ))
          )}
        </div>

        <div className="fd-items-kpi-strip">
          <div>
            <span>Total do que você usa</span>
            <strong>{supplies.length}</strong>
          </div>
          <div>
            <span>Dinheiro em saldo</span>
            <strong>{formatCurrency(totalSuppliesValue)}</strong>
          </div>
        </div>

        <div className="fd-subsection">
          <h3>
            <Link2 className="h-4 w-4" /> Custo por serviço
          </h3>
          <p className="fd-items-help-copy">O que você gasta pra entregar 1 unidade.</p>
          <div className="fd-items-link-grid">
            <select
              className="fd-pot-input"
              value={linkForm.serviceId}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, serviceId: event.target.value }))}
            >
              <option value="">Selecionar serviço</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <select
              className="fd-pot-input"
              value={linkForm.supplyId}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, supplyId: event.target.value }))}
            >
              <option value="">Selecionar o que você usa</option>
              {supplies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              className="fd-pot-input"
              type="number"
              min={1}
              step={1}
              value={linkForm.unitsPerService}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, unitsPerService: event.target.value }))}
              placeholder="Qtd por serviço"
            />
            <button className="fd-mini-btn fd-items-add-btn" type="button" onClick={linkSupplyToService}>
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="fd-list fd-items-clean-list">
            {linkedServiceCosts.map((service) => (
              <div key={service.id} className="fd-list-row">
                <div>
                  <p>{service.name}</p>
                  <small>{service.linksCount} item(ns) vinculado(s)</small>
                </div>
                <strong>{formatCurrency(service.costPerService)}/serviço</strong>
              </div>
            ))}
          </div>
        </div>

        {averageServiceTime > 0 ? (
          <div className="fd-items-time-card">
            <Clock3 className="h-5 w-5" />
            <div>
              <strong>Tempo médio por serviço</strong>
              <p>Seu insumo mais caro e seu tempo.</p>
            </div>
            <span>{Math.round(averageServiceTime)} min</span>
          </div>
        ) : null}
      </article>

      <article className="fd-panel fd-glass fd-items-premium-panel">
        <div className="fd-panel-head">
          <h2>Itens para vender</h2>
          <p>Veja o que dá lucro, o que esta parado e o que ainda precisa pagar</p>
        </div>

        <div className="fd-subsection">
          <h3>
            <Wallet className="h-4 w-4" /> Simulador de preço
          </h3>
          <div className="fd-items-form-grid">
            <input
              className="fd-pot-input"
              type="number"
              min={0.01}
              step={0.01}
              placeholder="Quanto você gasta nesse serviço/produto?"
              value={pricingForm.cost}
              onChange={(event) => setPricingForm((prev) => ({ ...prev, cost: event.target.value }))}
            />
            <input
              className="fd-pot-input"
              type="number"
              min={0}
              step={0.01}
              placeholder="Quanto você quer ganhar nesse serviço/produto?"
              value={pricingForm.desiredProfit}
              onChange={(event) => setPricingForm((prev) => ({ ...prev, desiredProfit: event.target.value }))}
            />
            <select
              className="fd-pot-input"
              value={pricingForm.paymentMethod}
              onChange={(event) =>
                setPricingForm((prev) => ({ ...prev, paymentMethod: event.target.value as PricingPaymentMode }))
              }
            >
              <option value="pix">PIX (0,49%)</option>
              <option value="debito">Debito (1,65%)</option>
              <option value="credito">Credito (3,55%)</option>
            </select>
          </div>

          {pricingSimulation.valid ? (
            <div className="fd-items-kpi-strip">
              <div>
                <span>Você deveria cobrar:</span>
                <strong style={{ fontSize: "1.25rem" }}>{formatCurrency(pricingSimulation.finalPrice)}</strong>
              </div>
              <div>
                <span>Você vai ganhar:</span>
                <strong>{formatCurrency(pricingSimulation.netProfit)}</strong>
              </div>
              <div>
                <span>Taxas cobradas:</span>
                <strong>{formatCurrency(pricingSimulation.feeValue)}</strong>
              </div>
            </div>
          ) : (
            <div className="fd-settings-form-placeholder">
              Digite quanto custa e quanto você quer ganhar para ver o valor ideal de cobranca.
            </div>
          )}

          <button type="button" className="fd-primary-btn" onClick={applySuggestedPrice}>
            Usar esse preço
          </button>
        </div>

        <div className="fd-items-form-grid">
          <input
            className="fd-pot-input"
            placeholder="Nome do item"
            value={productForm.name}
            onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="fd-pot-input"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Custo por item"
            value={productForm.costPrice}
            onChange={(event) => setProductForm((prev) => ({ ...prev, costPrice: event.target.value }))}
          />
          <input
            className="fd-pot-input"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Preco de venda"
            value={productForm.salePrice}
            onChange={(event) => setProductForm((prev) => ({ ...prev, salePrice: event.target.value }))}
          />
          <select
            className="fd-pot-input"
            value={productForm.type}
            onChange={(event) => setProductForm((prev) => ({ ...prev, type: event.target.value as ProductType }))}
          >
            <option value="pago">Pago</option>
            <option value="consignado">Consignado</option>
          </select>
          <input
            className="fd-pot-input"
            type="date"
            value={productForm.date}
            onChange={(event) => setProductForm((prev) => ({ ...prev, date: event.target.value }))}
          />
          <button className="fd-mini-btn fd-items-add-btn" type="button" onClick={addProduct}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="fd-items-kpi-strip">
          <div>
            <span>Lucro total</span>
            <strong>{formatCurrency(totalProductProfit)}</strong>
          </div>
          <div>
            <span>Divida consignado (PJ)</span>
            <strong>{formatCurrency(consignadoDebt)}</strong>
          </div>
        </div>

        <div className="fd-list fd-items-clean-list">
          {products.length === 0 ? (
            <p className="fd-empty">Nenhum item para venda cadastrado</p>
          ) : (
            products.map((item) => {
              const unitProfit = item.salePrice - item.costPrice;
              const profitPercent = item.salePrice > 0 ? Math.max(0, Math.round((unitProfit / item.salePrice) * 100)) : 0;

              return (
                <div key={item.id} className="fd-stock-item">
                  <div className="fd-stock-main">
                    <div>
                      <p>{item.name}</p>
                      <small>{item.date}</small>
                    </div>
                    <span className={levelColor(item.type)}>{item.type}</span>
                  </div>

                  <div className="fd-stock-meta">
                    <span>Custo por item: {formatCurrency(item.costPrice)}</span>
                    <span>Venda: {formatCurrency(item.salePrice)}</span>
                    <span>Lucro: {formatCurrency(unitProfit)} ({profitPercent}%)</span>
                    <span>Vendas: {item.soldCount}</span>
                  </div>

                  <div className="fd-stock-actions">
                    <button type="button" className="fd-mini-btn" onClick={() => registerSale(item)}>
                      <ShoppingBag className="h-4 w-4" />
                    </button>
                    {item.type === "consignado" ? (
                      <button type="button" className="fd-mini-btn" onClick={() => settleConsignadoDebt(item)}>
                        <Wallet className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="fd-subsection">
          <h3>
            <BarChart3 className="h-4 w-4" /> Lista de itens
          </h3>
          <div className="fd-items-charts-grid">
            <div className="fd-items-chart-card">
              <p>Lucro (%) por item</p>
              <div className="fd-items-bars">
                {products.length === 0 ? (
                  <small className="fd-empty">Sem dados</small>
                ) : (
                  products.map((item) => {
                    const percent =
                      item.salePrice > 0
                        ? Math.max(0, Math.min(100, Math.round(((item.salePrice - item.costPrice) / item.salePrice) * 100)))
                        : 0;

                    return (
                      <div key={item.id} className="fd-items-bar-row">
                        <span>{item.name}</span>
                        <div className="fd-items-bar-track">
                          <div style={{ width: `${percent}%` }} />
                        </div>
                        <strong>{percent}%</strong>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="fd-items-chart-card">
              <p>Vendas: custo x venda</p>
              <div className="fd-items-comparison">
                <div>
                  <span>Total vendas</span>
                  <strong>{formatCurrency(salesSummary.totalSales)}</strong>
                </div>
                <div>
                  <span>Total custo</span>
                  <strong>{formatCurrency(salesSummary.totalCost)}</strong>
                </div>
                <div>
                  <span>Total unidades vendidas</span>
                  <strong>{salesSummary.totalUnits}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="fd-items-side-grid">
        <article className="fd-panel fd-glass fd-items-premium-panel">
          <div className="fd-panel-head">
            <h2>Itens esquecidos</h2>
            <p>Isso aqui e dinheiro parado.</p>
          </div>
          <div className="fd-list fd-items-clean-list">
            {idleItems.length === 0 ? (
              <p className="fd-empty">Nenhum item parado agora</p>
            ) : (
              idleItems.slice(0, 8).map((item) => (
                <div key={item.id} className="fd-list-row">
                  <div>
                    <p>{item.name}</p>
                    <small>{item.soldCount === 0 ? "Sem venda registrada" : `${daysSince(item.date)} dias parado`}</small>
                  </div>
                  <strong>{formatCurrency(item.costPrice)}</strong>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="fd-panel fd-glass fd-items-premium-panel">
          <div className="fd-panel-head">
            <h2>Antes de comprar</h2>
            <p>Compra so o que você vai usar rapido.</p>
          </div>
          <div className="fd-items-buy-card">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <strong>Olha o saldo antes</strong>
              <p>Se não vai vender ou usar logo, esse dinheiro fica parado e aperta seu caixa.</p>
            </div>
          </div>
        </article>
      </section>

      <article className="fd-panel fd-glass fd-items-premium-panel">
        <div className="fd-panel-head">
          <h2>Custos do trabalho</h2>
          <p>Gastos que tiram dinheiro do lucro</p>
        </div>

        <div className="fd-items-form-grid">
          <input
            className="fd-pot-input"
            placeholder="Nome do custo"
            value={costForm.name}
            onChange={(event) => setCostForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <select
            className="fd-pot-input"
            value={costForm.category}
            onChange={(event) =>
              setCostForm((prev) => ({
                ...prev,
                category: event.target.value as (typeof COST_CATEGORIES)[number],
              }))
            }
          >
            {COST_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            className="fd-pot-input"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Valor"
            value={costForm.amount}
            onChange={(event) => setCostForm((prev) => ({ ...prev, amount: event.target.value }))}
          />
          <input
            className="fd-pot-input"
            type="date"
            value={costForm.date}
            onChange={(event) => setCostForm((prev) => ({ ...prev, date: event.target.value }))}
          />
          <button className="fd-mini-btn fd-items-add-btn" type="button" onClick={addExternalCost}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="fd-list fd-items-clean-list">
          {costs.length === 0 ? (
            <p className="fd-empty">Sem custos cadastrados</p>
          ) : (
            costs.slice(0, 12).map((cost) => (
              <div key={cost.id} className="fd-list-row">
                <div>
                  <p>{cost.name}</p>
                  <small>
                    <Truck className="h-3.5 w-3.5" /> {cost.category} - {cost.date}
                  </small>
                </div>
                <strong className="fd-negative">-{formatCurrency(cost.amount)}</strong>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
