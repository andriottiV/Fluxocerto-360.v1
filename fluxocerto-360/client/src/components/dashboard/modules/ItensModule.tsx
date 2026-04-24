import { useMemo, useState } from "react";
import { BarChart3, Link2, Plus, ShoppingBag, Truck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/contexts/AppContext";
import { TransactionType, type PaymentMethod } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type SupplyItem = {
  id: string;
  name: string;
  totalValue: number;
  quantity: number;
  unitValue: number;
  date: string;
};

type ProductType = "pago" | "consignado";

type ProductItem = {
  id: string;
  name: string;
  costPrice: number;
  salePrice: number;
  type: ProductType;
  date: string;
  soldCount: number;
};

type ServiceSupplyLink = {
  id: string;
  serviceId: string;
  supplyId: string;
  unitsPerService: number;
};

type PricingPaymentMode = "pix" | "debito" | "credito";

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

export default function ItensModule() {
  const { services, addCost, costs, addTransaction } = useApp();

  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [serviceSupplyLinks, setServiceSupplyLinks] = useState<ServiceSupplyLink[]>([]);

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
      toast.error("Nome do insumo e obrigatorio");
      return;
    }
    if (totalValue <= 0) {
      toast.error("Valor total do insumo deve ser maior que zero");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    if (!supplyForm.date) {
      toast.error("Data do insumo e obrigatoria");
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
    toast.success("Insumo cadastrado com valor unitario calculado");
  };

  const linkSupplyToService = () => {
    const unitsPerService = toNumber(linkForm.unitsPerService);
    if (!linkForm.serviceId || !linkForm.supplyId) {
      toast.error("Selecione servico e insumo");
      return;
    }
    if (unitsPerService <= 0) {
      toast.error("Unidades por servico deve ser maior que zero");
      return;
    }

    const exists = serviceSupplyLinks.some(
      (item) => item.serviceId === linkForm.serviceId && item.supplyId === linkForm.supplyId
    );

    if (exists) {
      toast.error("Esse insumo ja esta vinculado ao servico");
      return;
    }

    setServiceSupplyLinks((prev) => [
      { id: createId("link"), serviceId: linkForm.serviceId, supplyId: linkForm.supplyId, unitsPerService },
      ...prev,
    ]);
    setLinkForm((prev) => ({ ...prev, unitsPerService: "1" }));
    toast.success("Insumo vinculado ao servico");
  };

  const addProduct = () => {
    const costPrice = toNumber(productForm.costPrice);
    const salePrice = toNumber(productForm.salePrice);
    if (!productForm.name.trim()) {
      toast.error("Nome do produto e obrigatorio");
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
      toast.error(result.error ?? "Nao foi possivel quitar o consignado");
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
      toast.error("Nome do custo e obrigatorio");
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
    toast.success("Preço aplicado no formulário.");
  };

  return (
    <section className="fd-items-section">
      <article className="fd-panel fd-glass">
        <div className="fd-panel-head">
          <h2>Itens de Uso (Insumos)</h2>
          <p>Custo unitario automatico e vinculacao por servico</p>
        </div>

        <div className="fd-items-form-grid">
          <input
            className="fd-pot-input"
            placeholder="Nome do insumo"
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

        <div className="fd-items-kpi-strip">
          <div>
            <span>Total de insumos</span>
            <strong>{supplies.length}</strong>
          </div>
          <div>
            <span>Valor total em estoque</span>
            <strong>{formatCurrency(totalSuppliesValue)}</strong>
          </div>
        </div>

        <div className="fd-list">
          {supplies.length === 0 ? (
            <p className="fd-empty">Nenhum insumo cadastrado</p>
          ) : (
            supplies.map((item) => (
              <div key={item.id} className="fd-list-row">
                <div>
                  <p>{item.name}</p>
                  <small>
                    {item.quantity} un • {item.date}
                  </small>
                </div>
                <strong>{formatCurrency(item.unitValue)}/un</strong>
              </div>
            ))
          )}
        </div>

        <div className="fd-subsection">
          <h3>
            <Link2 className="h-4 w-4" /> Vincular insumo ao servico
          </h3>
          <div className="fd-items-link-grid">
            <select
              className="fd-pot-input"
              value={linkForm.serviceId}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, serviceId: event.target.value }))}
            >
              <option value="">Selecionar servico</option>
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
              <option value="">Selecionar insumo</option>
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
              placeholder="Qtd por servico"
            />
            <button className="fd-mini-btn fd-items-add-btn" type="button" onClick={linkSupplyToService}>
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="fd-list">
            {linkedServiceCosts.map((service) => (
              <div key={service.id} className="fd-list-row">
                <div>
                  <p>{service.name}</p>
                  <small>{service.linksCount} insumo(s) vinculado(s)</small>
                </div>
                <strong>{formatCurrency(service.costPerService)}/servico</strong>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="fd-panel fd-glass">
        <div className="fd-panel-head">
          <h2>Itens para Venda</h2>
          <p>Lucro por produto e controle de consignado</p>
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
              <option value="debito">Débito (1,65%)</option>
              <option value="credito">Crédito (3,55%)</option>
            </select>
          </div>

          {pricingSimulation.valid ? (
            <div className="fd-items-kpi-strip">
              <div>
                <span>Você deveria cobrar:</span>
                <strong style={{ fontSize: "1.25rem" }}>💰 {formatCurrency(pricingSimulation.finalPrice)}</strong>
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
              Digite quanto custa e quanto você quer ganhar para ver o valor ideal de cobrança.
            </div>
          )}

          <button type="button" className="fd-primary-btn" onClick={applySuggestedPrice}>
            Usar esse preço
          </button>
        </div>

        <div className="fd-items-form-grid">
          <input
            className="fd-pot-input"
            placeholder="Nome do produto"
            value={productForm.name}
            onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="fd-pot-input"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Preco de custo"
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

        <div className="fd-list">
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
                    <span>Custo: {formatCurrency(item.costPrice)}</span>
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
            <BarChart3 className="h-4 w-4" /> Graficos de venda
          </h3>
          <div className="fd-items-charts-grid">
            <div className="fd-items-chart-card">
              <p>Lucro (%) por produto</p>
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

      <article className="fd-panel fd-glass">
        <div className="fd-panel-head">
          <h2>Custos (trabalho na rua)</h2>
          <p>Desconto direto do PJ, com categoria e data obrigatoria</p>
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

        <div className="fd-list">
          {costs.length === 0 ? (
            <p className="fd-empty">Sem custos cadastrados</p>
          ) : (
            costs.slice(0, 12).map((cost) => (
              <div key={cost.id} className="fd-list-row">
                <div>
                  <p>{cost.name}</p>
                  <small>
                    <Truck className="h-3.5 w-3.5" /> {cost.category} • {cost.date}
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
