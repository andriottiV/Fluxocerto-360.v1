export type ClientStatus = "ativo" | "inativo";
export type AppointmentStatus = "confirmado" | "pendente" | "cancelado" | "vazio";
export type PaymentFlowType = "same" | "cashOut" | "withdraw";

export interface MockClient {
  id: string;
  name: string;
  lastVisit: string;
  cutFrequencyDays: number;
  status: ClientStatus;
}

export interface MockService {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface MockAppointment {
  id: string;
  time: string;
  clientName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  price: number;
  status: AppointmentStatus;
  paymentMethod: "pix" | "dinheiro" | "cartao" | null;
}

export interface RevenuePoint {
  label: string;
  value: number;
}

export interface RevenueSummary {
  daily: number;
  weekly: number;
  monthly: number;
  trend: RevenuePoint[];
  hourly: RevenuePoint[];
}

export interface DashboardKpis {
  totalToday: number;
  appointmentsToday: number;
  averageTicket: number;
  returnRate: number;
}

export interface MockNotification {
  id: string;
  message: string;
  type: "info" | "warning" | "success";
  timeAgo: string;
}

export interface MockOrderRow {
  invoice: string;
  customer: string;
  from: string;
  price: string;
  status: "Process" | "Open";
}

export interface TrafficDistribution {
  same: number;
  cashOut: number;
  withdraw: number;
}

export interface DashboardMockData {
  generatedAt: string;
  clients: MockClient[];
  appointments: MockAppointment[];
  services: MockService[];
  revenue: RevenueSummary;
  kpis: DashboardKpis;
  notifications: MockNotification[];
  orders: MockOrderRow[];
  traffic: TrafficDistribution;
}

const clientNames = [
  "Joao Mendes",
  "Caio Oliveira",
  "Lucas Rocha",
  "Pedro Alves",
  "Matheus Silva",
  "Gabriel Costa",
  "Vitor Ramos",
  "Rafael Nascimento",
  "Diego Ferreira",
  "Thiago Pires",
  "Renato Barros",
  "Bruno Cardoso",
  "Leandro Souza",
  "Eduardo Teixeira",
  "Felipe Martins",
  "Anderson Gomes",
  "Marcos Vinicius",
  "Henrique Moura",
  "Alan Batista",
  "Samuel Duarte",
  "Igor Araujo",
  "Ruan Carvalho",
  "Vinicius Prado",
  "Leonardo Campos",
  "Roberto Sena",
  "Paulo Roberto",
  "Ricardo Nunes",
  "Fabricio Vieira",
];

const regions = [
  "Centro",
  "Vila Mariana",
  "Mooca",
  "Ipiranga",
  "Santo Amaro",
  "Lapa",
  "Tatuape",
  "Pinheiros",
];

const services: MockService[] = [
  { id: "svc-01", name: "Corte", price: 35, durationMinutes: 35 },
  { id: "svc-02", name: "Barba", price: 25, durationMinutes: 25 },
  { id: "svc-03", name: "Corte + Barba", price: 55, durationMinutes: 55 },
  { id: "svc-04", name: "Sobrancelha", price: 18, durationMinutes: 15 },
  { id: "svc-05", name: "Pigmentacao", price: 45, durationMinutes: 40 },
  { id: "svc-06", name: "Hidratacao Capilar", price: 60, durationMinutes: 45 },
];

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

function randomBetween(min: number, max: number, random: () => number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function formatDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function generateClients(random: () => number, count: number): MockClient[] {
  const frequencyOptions = [15, 20, 30, 45];
  const now = new Date();

  return clientNames.slice(0, count).map((name, index) => {
    const daysAgo = randomBetween(2, 90, random);
    const lastVisit = new Date(now);
    lastVisit.setDate(now.getDate() - daysAgo);

    return {
      id: `cl-${index + 1}`,
      name,
      lastVisit: formatDateIso(lastVisit),
      cutFrequencyDays: sample(frequencyOptions, random),
      status: random() > 0.22 ? "ativo" : "inativo",
    };
  });
}

function generateAppointments(random: () => number, clients: MockClient[]): MockAppointment[] {
  const slots = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ];

  return slots.map((time, index) => {
    const occupationRoll = random();
    if (occupationRoll < 0.22) {
      return {
        id: `ap-${index + 1}`,
        time,
        clientName: null,
        serviceId: null,
        serviceName: null,
        price: 0,
        status: "vazio",
        paymentMethod: null,
      };
    }

    const service = sample(services, random);
    const statusRoll = random();
    const status: AppointmentStatus =
      statusRoll < 0.68 ? "confirmado" : statusRoll < 0.88 ? "pendente" : "cancelado";

    const paymentMethod = sample(["pix", "dinheiro", "cartao"] as const, random);
    const variablePrice = service.price + randomBetween(0, 18, random);

    return {
      id: `ap-${index + 1}`,
      time,
      clientName: sample(clients, random).name,
      serviceId: service.id,
      serviceName: service.name,
      price: variablePrice,
      status,
      paymentMethod,
    };
  });
}

function generateRevenue(random: () => number, appointments: MockAppointment[]): RevenueSummary {
  const confirmed = appointments.filter((item) => item.status === "confirmado");
  const daily = confirmed.reduce((sum, item) => sum + item.price, 0);

  const trend = Array.from({ length: 7 }).map((_, index) => {
    const factor = 0.85 + random() * 0.35;
    return {
      label: `D${index + 1}`,
      value: Math.round(daily * factor),
    };
  });

  const weekly = trend.reduce((sum, point) => sum + point.value, 0);
  const monthly = Math.round(weekly * 4.1);

  const hourlyLabels = ["10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm"];
  const hourly = hourlyLabels.map((label) => {
    const val = Math.round(700 + random() * 1200 + (label.includes("6 pm") || label.includes("7 pm") ? 900 : 0));
    return { label, value: val };
  });

  return { daily, weekly, monthly, trend, hourly };
}

function generateNotifications(
  random: () => number,
  appointments: MockAppointment[],
  dailyRevenue: number
): MockNotification[] {
  const booked = appointments.find((item) => item.status === "confirmado" && item.clientName);
  const missed = appointments.find((item) => item.status === "cancelado" && item.clientName);

  const base: MockNotification[] = [];
  if (booked?.clientName) {
    base.push({
      id: "n-1",
      message: `${booked.clientName} agendou um horario para ${booked.time}`,
      type: "info",
      timeAgo: `${randomBetween(2, 15, random)} mins ago`,
    });
  }

  if (missed?.clientName) {
    base.push({
      id: "n-2",
      message: `Cliente faltou: ${missed.clientName}`,
      type: "warning",
      timeAgo: `${randomBetween(16, 40, random)} mins ago`,
    });
  }

  if (dailyRevenue >= 1000) {
    base.push({
      id: "n-3",
      message: "Meta diaria atingida",
      type: "success",
      timeAgo: `${randomBetween(45, 75, random)} mins ago`,
    });
  }

  base.push({
    id: "n-4",
    message: "Reposicao de produtos sugerida para amanha",
    type: "info",
    timeAgo: `${randomBetween(80, 150, random)} mins ago`,
  });

  return base.slice(0, 6);
}

function generateOrders(random: () => number, appointments: MockAppointment[]): MockOrderRow[] {
  const usable = appointments.filter((item) => item.status !== "vazio" && item.clientName).slice(0, 8);

  return usable.map((appointment, index) => ({
    invoice: `#INV-${randomBetween(7000, 9999, random)}`,
    customer: appointment.clientName || "Cliente",
    from: sample(regions, random),
    price: `R$ ${appointment.price.toFixed(2).replace(".", ",")}`,
    status: appointment.status === "confirmado" ? "Process" : "Open",
  }));
}

function generateTraffic(appointments: MockAppointment[]): TrafficDistribution {
  const confirmed = appointments.filter((item) => item.status === "confirmado");
  const pix = confirmed.filter((item) => item.paymentMethod === "pix").length;
  const cash = confirmed.filter((item) => item.paymentMethod === "dinheiro").length;
  const card = confirmed.filter((item) => item.paymentMethod === "cartao").length;
  const total = Math.max(1, pix + cash + card);

  const same = percent(card, total);
  const cashOut = percent(cash, total);
  let withdraw = 100 - same - cashOut;
  if (withdraw < 0) withdraw = 0;

  return { same, cashOut, withdraw };
}

function generateKpis(
  revenue: RevenueSummary,
  appointments: MockAppointment[],
  clients: MockClient[]
): DashboardKpis {
  const confirmed = appointments.filter((item) => item.status === "confirmado");
  const appointmentsToday = confirmed.length;
  const averageTicket = appointmentsToday > 0 ? revenue.daily / appointmentsToday : 0;

  const activeClients = clients.filter((client) => client.status === "ativo");
  const returningClients = activeClients.filter((client) => {
    const daysSinceLastVisit = Math.ceil(
      (Date.now() - new Date(client.lastVisit).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLastVisit <= client.cutFrequencyDays + 10;
  });

  return {
    totalToday: revenue.daily,
    appointmentsToday,
    averageTicket: Math.round(averageTicket * 100) / 100,
    returnRate: percent(returningClients.length, Math.max(1, activeClients.length)),
  };
}

export function buildBarbershopMockData(referenceDate = new Date()): DashboardMockData {
  const seed = Number(referenceDate.toISOString().slice(0, 10).replace(/-/g, ""));
  const random = createSeededRandom(seed);

  const clients = generateClients(random, randomBetween(19, 26, random));
  const appointments = generateAppointments(random, clients);
  const revenue = generateRevenue(random, appointments);
  const kpis = generateKpis(revenue, appointments, clients);
  const notifications = generateNotifications(random, appointments, revenue.daily);
  const orders = generateOrders(random, appointments);
  const traffic = generateTraffic(appointments);

  return {
    generatedAt: referenceDate.toISOString(),
    clients,
    appointments,
    services,
    revenue,
    kpis,
    notifications,
    orders,
    traffic,
  };
}

export async function loadBarbershopMockData(referenceDate = new Date()): Promise<DashboardMockData> {
  const random = createSeededRandom(Number(referenceDate.toISOString().slice(0, 10).replace(/-/g, "")) + 77);
  const delayMs = randomBetween(500, 1000, random);

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return buildBarbershopMockData(referenceDate);
}
