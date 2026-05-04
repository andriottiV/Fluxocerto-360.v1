# FluxoCerto360 - Documento Técnico do Produto

**Versão do documento:** 1.0  
**Base de análise:** código atual do projeto FluxoCerto360  
**Objetivo:** documentar produto, arquitetura, modelo de dados, regras financeiras, fluxos, limitações e evolução futura.

---

## 1. Visão Geral do Produto

### Nome

**FluxoCerto360**

### Proposta de valor

O FluxoCerto360 é um SaaS financeiro para pequenos empreendedores, MEIs, autônomos e prestadores de serviço que precisam separar dinheiro pessoal, dinheiro do negócio e reserva sem depender de planilhas complexas ou aplicativos financeiros genéricos.

A proposta central é transformar cada entrada real de dinheiro em uma distribuição organizada entre:

- **Pessoal:** dinheiro da vida pessoal do usuário.
- **Negócio:** dinheiro para manter e melhorar a operação.
- **Reserva:** dinheiro protegido para segurança e objetivos futuros.

### Problema que resolve

O produto ataca um problema recorrente em negócios pequenos: a mistura entre PF e PJ. Muitos autônomos recebem dinheiro, gastam direto da mesma conta, não sabem se houve lucro real e descobrem tarde que usaram dinheiro que deveria pagar custos, taxas, impostos, materiais ou compromissos.

Problemas tratados:

- Mistura de dinheiro pessoal e dinheiro do negócio.
- Falta de clareza sobre lucro líquido.
- Confusão entre faturamento bruto e dinheiro disponível.
- Ausência de reserva.
- Falta de disciplina para separar dinheiro assim que ele entra.
- Dificuldade de registrar movimentações de forma rápida no mobile.

### Público-alvo

O público principal é o “empreendedor de si mesmo”:

- MEIs.
- Autônomos.
- Barbeiros.
- Manicures.
- Prestadores de serviço.
- Pequenos comércios.
- Profissionais liberais.
- Negócios locais em fase inicial.

O produto é especialmente útil para quem recebe pagamentos frequentes e precisa entender rapidamente “o que entrou”, “o que sobrou”, “o que pode usar” e “o que precisa proteger”.

---

## 1.1. Diferencial Competitivo

O FluxoCerto360 não deve ser posicionado apenas como um aplicativo de controle financeiro. A diferença central é que ele atua no momento da decisão: quando o dinheiro entra, o sistema já orienta para onde ele deve ir antes que o usuário gaste sem clareza.

Apps financeiros tradicionais costumam focar em registro, categorização e histórico. O FluxoCerto360 foca em separação, proteção e decisão.

Principais diferenciais:

- **Separação PF/PJ automática:** o dinheiro pessoal, o dinheiro do negócio e a reserva são tratados como áreas diferentes.
- **Proteção de margem antes do gasto:** taxas e distribuição são consideradas antes de mostrar o que pode ser usado.
- **Organização por potes no momento da entrada:** a separação acontece quando a entrada é registrada, não apenas em relatórios posteriores.
- **Tomada de decisão financeira:** o app responde perguntas como “posso gastar?”, “quanto tenho livre?” e “quanto preciso fazer?”.
- **Linguagem simples para autônomos:** o produto evita jargões contábeis e traduz a gestão financeira para decisões práticas.

O valor percebido não está apenas em guardar dados. Está em reduzir confusão financeira e ajudar o usuário a enxergar o dinheiro certo no lugar certo.

---

## 2. Arquitetura do Sistema

### Frontend

O frontend é uma aplicação **React + Vite + TypeScript**.

Principais tecnologias identificadas no projeto:

- **React 19**
- **TypeScript**
- **Vite**
- **Wouter** para navegação interna
- **Radix UI** para componentes acessíveis
- **Lucide React** para ícones
- **Framer Motion** para interações/animações
- **Sonner** para toasts
- **Recharts** disponível para gráficos
- **Playwright** para QA automatizado
- **Supabase JS** como camada preparada para autenticação e persistência remota

### Backend

O projeto possui uma estrutura backend em **Express**, principalmente para:

- Servir arquivos estáticos em produção.
- Expor endpoints do Flux IA:
  - `/api/flux-ai`
  - `/api/flux-agent`
- Montar o mock `/api/v1` apenas em desenvolvimento.

Arquivo principal:

```txt
server/index.ts
```

Observação importante: o endpoint mock financeiro (`finance-api.mock.ts`) não deve ser considerado backend real de produção. Ele é montado apenas quando `NODE_ENV !== "production"`.

### Persistência de dados

O app opera hoje em modelo híbrido:

1. **Fallback local com localStorage**, usando chave por usuário.
2. **Camada Supabase preparada**, ativada quando existem:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Quando Supabase está configurado, o app busca dados remotos e mantém localStorage como fallback temporário. Quando Supabase não está configurado, o fluxo local continua funcionando.

Chaves relevantes:

```txt
fc360:auth:users:v2
fc360:auth:session:v1
fc360:data:{userId}
fc360:onboarding:{userId}
fc360:onboarding:data:{userId}
fc360:supabase:migrated:{userId}
```

### Estrutura de pastas

Estrutura resumida:

```txt
fluxocerto-360/
  client/
    public/
      icons/
      manifest.json
      logo-full-new.png
      icon-new.png
      mascoteprincipal.png
      mascoterosto.png
    src/
      components/
        dashboard/
          modules/
          shared/
        onboarding/
        screens/
        ui/
      contexts/
        AppContext.tsx
        ThemeContext.tsx
      lib/
        auth.ts
        authz.ts
        finance.ts
        personalFreeMoney.ts
        supabaseClient.ts
        supabaseRepositories.ts
        voice/
      pages/
      App.tsx
      main.tsx
  server/
    index.ts
    flux-ai-api.ts
    flux-agent-api.ts
    finance-api.mock.ts
  shared/
    finance-schema.sql
  tests/
    qa/
      fluxocerto360.audit.spec.ts
  test-results/
```

### Fluxo de dados geral

Fluxo simplificado:

1. Usuário autentica.
2. `AppContext` carrega dados por usuário.
3. Se Supabase estiver configurado, dados remotos são buscados e sincronizados.
4. Se Supabase não estiver configurado ou falhar, localStorage mantém o app funcional.
5. Telas internas consomem `useApp()`.
6. Entradas e saídas são criadas via `addTransaction`.
7. `addTransaction` atualiza:
   - lista oficial de transações;
   - potes;
   - persistência local;
   - Supabase, quando configurado.
8. Dashboard recalcula KPIs a partir das transações oficiais e dos saldos reais dos potes.

---

## 3. Modelo de Dados

### Usuário

Estrutura real definida em `client/src/lib/types.ts`:

```json
{
  "id": "user-...",
  "name": "Nome do usuário",
  "email": "usuario@email.com",
  "role": "tester",
  "status": "active",
  "phone": "",
  "avatar": "",
  "businessName": "",
  "businessType": "",
  "cnpj": "",
  "createdAt": "2026-05-01T12:00:00.000Z",
  "lastLoginAt": "2026-05-01T12:00:00.000Z",
  "approvedAt": "",
  "approvedBy": ""
}
```

Campos críticos:

- `id`: usado para isolar dados.
- `role`: atualmente pode ser `admin` ou `tester`.
- `status`: controla acesso (`pending`, `active`, `blocked`).

### Transações

Transações são a fonte oficial para entradas, saídas e gráfico financeiro.

Estrutura real:

```json
{
  "id": "tx-...",
  "ownerId": "user-...",
  "type": "entrada",
  "description": "Corte João",
  "amount": 100,
  "date": "2026-05-01",
  "createdAt": "2026-05-01T12:00:00.000Z",
  "category": "servicos",
  "account": "Conta principal",
  "origin": "Comando por voz",
  "source": "voice",
  "sourceId": "",
  "notes": "",
  "pot": "pessoal",
  "potId": "pot-...",
  "accountTypeLink": "pf",
  "paymentMethod": "credito",
  "grossAmount": 100,
  "feePercent": 3.49,
  "feeAmount": 3.49,
  "netAmount": 96.51,
  "potDistribution": {
    "personal": 70,
    "business": 20,
    "reserve": 10
  },
  "clientId": "client-...",
  "clientName": "João",
  "serviceName": "Corte",
  "paymentStatus": "pago",
  "paidAt": "2026-05-01T12:00:00.000Z",
  "dueDate": "2026-05-10"
}
```

Tipos aceitos:

```txt
entrada
saida
transferencia
```

Métodos de pagamento:

```txt
dinheiro
pix
debito
credito
voucher
alimentacao
transferencia
```

Campos financeiros principais:

- `amount`: valor principal da transação.
- `grossAmount`: valor bruto da entrada.
- `feeAmount`: taxa aplicada sobre entrada.
- `netAmount`: valor líquido depois da taxa.
- `potDistribution`: distribuição usada no momento da entrada.
- `source`: origem da transação (`manual`, `voice`, `cost`, etc.).

### Potes

Potes representam a separação financeira do usuário.

Estrutura real:

```json
{
  "id": "pot-...",
  "ownerId": "user-...",
  "type": "pessoal",
  "name": "Pessoal",
  "balance": 403.65,
  "percentage": 70,
  "goalValue": 0,
  "limit": 0,
  "icon": "wallet",
  "color": "#22c55e"
}
```

Tipos oficiais:

```txt
pessoal
negocio
reserva
```

### Compromissos

Compromissos e contas de ajustes são modelados como `AdjustmentAccount`.

Estrutura real:

```json
{
  "id": "account-...",
  "ownerId": "user-...",
  "name": "Aluguel",
  "amount": 1150,
  "category": "moradia",
  "type": "fixa",
  "dueDate": "2026-05-08",
  "pot": "pf",
  "installmentsTotal": 1,
  "installmentsRemaining": 1,
  "totalDebt": 1150,
  "status": "pendente",
  "cycleMonthKey": "2026-05"
}
```

Tipos de pote em compromissos:

```txt
pf
pj
```

Status:

```txt
pendente
pago
atrasado
```

### Distribuição de valores

Estrutura real:

```json
{
  "personal": 70,
  "business": 20,
  "reserve": 10
}
```

Regra: a distribuição é aplicada sobre o valor líquido da entrada, não sobre o bruto.

---

## 4. Regras de Negócio

Esta seção é crítica. As regras abaixo são base do produto e não devem ser alteradas sem decisão explícita.

### Entrada = valor bruto

Quando o usuário registra uma entrada de R$ 100, o valor bruto é R$ 100.

```txt
Entradas = soma de grossAmount/amount de transações type === "entrada"
```

### Taxa aplicada antes da distribuição

Taxas de pagamento são descontadas antes de distribuir dinheiro nos potes.

Exemplo:

```txt
Entrada bruta: R$ 100,00
Taxa crédito: R$ 3,49
Entrada líquida: R$ 96,51
```

Distribuição dos potes usa R$ 96,51.

### Lucro líquido = entrada - taxa

No dashboard, lucro líquido não é “saldo depois das saídas pessoais”.

Regra:

```txt
Lucro líquido = entradas brutas reais - taxas
```

Custos operacionais podem ser analisados em relatórios, precificação e insights separados. Eles não devem ser misturados com saídas pessoais nem usados para reduzir o indicador principal de lucro líquido do dashboard sem uma regra explícita de custo operacional.

### Saídas não impactam lucro líquido

Saídas reduzem o pote escolhido, mas não alteram o lucro líquido da entrada.

Exemplo:

```txt
Entrada: R$ 100,00 no crédito
Taxa: R$ 3,49
Lucro líquido: R$ 96,51
Saída pessoal: R$ 10,00
Lucro líquido continua: R$ 96,51
```

### Custos operacionais como análise separada

Custos do negócio são importantes para entender margem, precificação e saúde operacional. Porém, dentro da leitura principal do dashboard, o indicador “Lucro líquido” deve permanecer consistente:

```txt
Lucro líquido = entrada bruta - taxas
```

Custos operacionais podem aparecer como análise própria:

```txt
Resultado após custos = entrada bruta - taxas - custos operacionais únicos
```

Essa separação evita que o usuário confunda:

- saída pessoal com custo do negócio;
- compromisso pessoal com custo operacional;
- saldo de pote com lucro;
- meta mensal com dinheiro real.

### Cada saída afeta apenas um pote

Saída deve reduzir somente o pote selecionado ou resolvido pela regra da transação.

Não pode reduzir todos os potes.

### PF, PJ e Reserva são isolados

Os potes têm papéis diferentes:

- **Pessoal/PF:** dinheiro da vida pessoal.
- **Negócio/PJ:** dinheiro do trabalho, operação, ferramentas, insumos, impostos, marketing.
- **Reserva:** dinheiro protegido.

Dinheiro do negócio e reserva não devem ser tratados como dinheiro pessoal disponível.

### Dinheiro livre = apenas pote pessoal - compromissos pessoais

Regra atual centralizada em `client/src/lib/personalFreeMoney.ts`:

```txt
Dinheiro livre = max(0, saldo do pote Pessoal - compromissos pessoais pendentes)
```

Não entra no cálculo:

- saldo total dos potes;
- pote Negócio/PJ;
- pote Reserva;
- lucro líquido;
- meta mensal;
- entrada bruta;
- availableBalance global.

Se compromissos pessoais ainda não existirem para o usuário:

```txt
Dinheiro livre = saldo do pote Pessoal
```

### Meta mensal não é dinheiro real

O valor do onboarding em “Quanto quer tirar livre por mês?” é objetivo. Ele não é:

- entrada;
- saldo;
- lucro;
- caixa;
- valor disponível;
- valor a distribuir nos potes.

---

## 5. Fluxos do Sistema

### Cadastro/Login

Fluxo atual:

1. Usuário acessa Login.
2. Se Supabase estiver configurado, `AuthService` usa Supabase Auth.
3. Se Supabase não estiver configurado, usa auth local MVP.
4. Sessão é restaurada via `AuthService.restoreSession`.
5. Usuário é enviado para onboarding ou dashboard conforme status.

Observação: o auth local MVP não deve ser considerado provedor final de produção. Ele foi isolado em `client/src/lib/auth.ts` para permitir migração sem alterar telas.

### Onboarding

O onboarding coleta dados iniciais como:

- modo de uso;
- diagnóstico;
- distribuição sugerida dos potes;
- meta mensal;
- dívidas/compromissos;
- despesas fixas.

O onboarding configura percentuais e preferências. Ele não deve criar saldo real, entrada automática ou dinheiro nos potes.

### Registro de entrada manual

Fluxo:

1. Usuário abre modal de entrada.
2. Informa valor bruto, categoria, forma de pagamento e demais campos.
3. `TransactionModal` chama `addTransaction`.
4. `addTransaction` normaliza valores.
5. Taxa é aplicada conforme `paymentFeeSettings`.
6. Transação é adicionada à lista oficial.
7. Valor líquido é distribuído nos potes.
8. Dados são persistidos localmente e, se configurado, no Supabase.
9. Dashboard recalcula KPIs.

### Registro de entrada por voz

Fluxo:

1. Usuário aciona o microfone.
2. Web Speech API captura o texto.
3. `parseFinancialVoiceCommand` interpreta tipo, valor, categoria, pagamento, cliente e área.
4. Tela mostra prévia para confirmação.
5. Ao confirmar, `VoiceTransactionModal` chama o mesmo `addTransaction`.
6. A entrada por voz usa o mesmo motor da entrada manual.

Exemplo:

```txt
"entrada 100 no crédito corte João"
```

Resultado esperado:

```json
{
  "type": "entrada",
  "amount": 100,
  "grossAmount": 100,
  "feeAmount": 3.49,
  "netAmount": 96.51,
  "paymentMethod": "credito",
  "category": "servicos",
  "clientName": "João",
  "source": "voice"
}
```

### Registro de saída

Fluxo:

1. Usuário registra saída manualmente ou por voz.
2. Sistema identifica valor, categoria e pote.
3. `addTransaction` cria transação `type: "saida"`.
4. Saída reduz somente o pote correspondente.
5. Saída aparece no histórico e gráfico.
6. Lucro líquido não muda por causa da saída.

### Atualização dos potes

Entradas:

```txt
valor líquido = bruto - taxa
pessoal = líquido * personal%
negócio = líquido * business%
reserva = restante líquido
```

Saídas:

```txt
pote selecionado = saldo atual - valor da saída
```

### Atualização do dashboard

O dashboard lê:

- transações oficiais;
- potes reais;
- custos;
- compromissos pessoais;
- dados de onboarding como meta.

Indicadores principais:

- Entradas: transações oficiais de entrada.
- Saídas: transações oficiais de saída.
- Lucro líquido: entrada bruta menos taxas.
- Dinheiro livre: pote pessoal menos compromissos pessoais.
- Gráfico: transações oficiais por data.
- Potes: saldos reais dos potes.

---

## 6. Sistema de Comando de Voz (Flux)

### Como funciona

O comando de voz usa a Web Speech API disponível no navegador. O reconhecimento transforma fala em texto e o parser local interpreta o comando.

Arquivos relevantes:

```txt
client/src/components/dashboard/shared/VoiceTransactionModal.tsx
client/src/components/dashboard/shared/TransactionModal.tsx
client/src/lib/voice/financialVoiceParser.ts
```

### Captura de voz

O usuário clica no botão de microfone. Quando o navegador suporta reconhecimento de voz:

1. sistema entra em estado “ouvindo”;
2. transcrição é capturada;
3. comando é interpretado;
4. usuário confirma a movimentação.

Se o navegador não suporta Web Speech API, o app mostra fallback visual e não trava a tela.

### Interpretação

O parser detecta:

- tipo: entrada ou saída;
- valor;
- forma de pagamento;
- categoria;
- cliente;
- área/pote sugerido;
- campos faltantes.

Palavras-chave de entrada:

```txt
entrou, recebi, recebeu, recebido, ganhei, entrada, caiu
```

Palavras-chave de saída:

```txt
saiu, saída, gastei, paguei, despesa, gasto, comprei, separei
```

### Exemplos de comandos

```txt
entrada 100 no crédito corte João
recebi 50 no pix da Maria
gastei 20 mercado
paguei 115 aluguel pessoal
comprei 30 de gasolina
```

### Estrutura gerada

Para entrada:

```json
{
  "type": "entrada",
  "amount": 100,
  "paymentMethod": "credito",
  "category": "servicos",
  "clientName": "João",
  "source": "voice"
}
```

Para saída:

```json
{
  "type": "saida",
  "amount": 20,
  "category": "alimentacao",
  "potId": "pot-pessoal",
  "source": "voice"
}
```

### Limitações atuais

- Depende de suporte do navegador.
- Web Speech API funciona melhor no Android Chrome do que no iOS Safari.
- Interpretação ainda é baseada em parser local, não em IA semântica completa.
- Comandos ambíguos precisam de confirmação do usuário.

### Evolução futura

- Interpretação híbrida: parser local + IA.
- Detecção de intenção mais avançada.
- Criação de compromissos futuros por voz.
- Conversa com confirmação: “Você quer lançar isso como entrada ou saída?”
- Treinamento de vocabulário por segmento: barbearia, estética, delivery, oficina, consultoria.

---

## 6.1. Flux como Produto

O Flux é o assistente financeiro inteligente do FluxoCerto360. Ele é estratégico porque transforma dados financeiros em orientação prática. Enquanto o dashboard mostra o estado do dinheiro, o Flux ajuda o usuário a decidir o próximo passo.

### Papel do Flux no sistema

O Flux atua como um consultor simples, direto e confiável. Seu papel é responder perguntas financeiras com base nos dados reais registrados no app.

Perguntas que o Flux deve apoiar:

- “Posso gastar hoje?”
- “Quanto tenho em caixa?”
- “Quanto faturei hoje?”
- “Quanto falta para minha meta?”
- “Tenho aluguel para pagar, quanto preciso fazer?”
- “Onde estou perdendo dinheiro?”
- “Como melhorar meu lucro?”

### Como funciona hoje

Hoje o Flux combina:

- contexto financeiro real do app;
- helpers locais de análise;
- fallback local quando a IA externa não está disponível;
- endpoint backend para IA quando configurado;
- regras de segurança para não inventar saldo, lucro ou dinheiro disponível.

O Flux não deve tratar meta mensal como saldo e não deve liberar dinheiro protegido como se fosse dinheiro livre.

### Evolução esperada

A evolução natural do Flux é virar o principal motor de retenção do produto:

- alertas proativos;
- previsões de caixa;
- diagnóstico de margem;
- simulações de gasto;
- recomendações de reserva;
- análise de compromissos futuros;
- sugestões de preço;
- orientação por segmento de negócio;
- conversa natural com confirmação de ações.

### Valor comercial do Flux

O Flux aumenta a percepção de valor do SaaS porque desloca o produto de “controle financeiro” para “consultor financeiro de bolso”. Esse posicionamento permite planos pagos mais fortes, maior retenção e diferenciação contra planilhas e apps genéricos.

---

## 7. Dashboard e Métricas

### Entradas

Mostra apenas dinheiro real registrado como transação `entrada`.

Regra:

```txt
Entradas = soma de grossAmount/amount das entradas oficiais
```

Meta mensal nunca entra aqui.

### Saídas

Mostra transações `saida`.

Regra:

```txt
Saídas = soma de amount das saídas oficiais
```

Cada saída deve estar vinculada a um pote/área.

### Lucro líquido

Representa o que sobrou da entrada depois das taxas de pagamento.

Regra principal:

```txt
Lucro líquido = entradas brutas - taxas
```

Saída pessoal não reduz lucro líquido.

Custos operacionais devem ser exibidos como análise própria de margem, precificação ou resultado operacional, sem misturar o conceito de dinheiro livre, saldo pessoal ou lucro líquido principal.

### Dinheiro livre

Representa apenas dinheiro pessoal seguro para uso.

Regra atual:

```txt
Dinheiro livre = max(0, saldo do pote Pessoal - compromissos pessoais pendentes)
```

Não usa:

- Pote Negócio.
- Pote Reserva.
- Saldo total dos potes.
- Lucro líquido.
- Meta mensal.

### Distribuição dos potes

Mostra os saldos reais de:

- Pessoal.
- Negócio.
- Reserva.

Os saldos vêm da consequência das entradas líquidas distribuídas e saídas registradas.

### Gráfico financeiro

O gráfico usa a lista oficial de transações e suas datas (`date`/`createdAt`) para montar a evolução financeira. Quando existem entradas ou saídas, o estado vazio deve desaparecer.

---

## 8. Responsividade e UX

O app foi construído com foco em experiência mobile e visual premium fintech:

- dark mode profundo;
- cards glassmorphism;
- verde como ação principal;
- vermelho para saída/perda;
- amarelo para alerta;
- tipografia consistente com fallback `"Gotan", "Inter", "Montserrat", "Arial", sans-serif`;
- botões grandes o suficiente para toque;
- grids convertidos para listas/cards em telas menores;
- FAB global para ações rápidas;
- comando de voz acessível no mobile.

Telas cobertas na auditoria:

- Landing.
- Login.
- Onboarding.
- Dashboard.
- Fluxo de Caixa.
- Consultor.
- Clientes.
- Itens/Custos.
- Ajustes.

Responsividade testada no QA em:

- desktop 1440px;
- notebook 1366px;
- tablet 768px;
- mobile 390px;
- mobile 360px.

---

## 9. Sincronização de Dados

### Comportamento atual

O app mantém uma camada de persistência local por usuário via localStorage e uma camada Supabase opcional.

Quando Supabase está configurado:

1. App busca transações, potes, clientes e custos do Supabase.
2. Se o banco remoto estiver vazio e existirem dados locais, faz seed inicial.
3. Escritas locais sincronizam com Supabase.
4. App faz reconsulta ao focar a janela e por polling leve.

Quando Supabase não está configurado:

1. App usa localStorage.
2. Dados ficam restritos ao navegador/dispositivo.

### Entre dispositivos

Com Supabase ativo, a intenção é permitir que o mesmo login veja os dados em diferentes dispositivos. O mecanismo atual usa:

- re-fetch ao focar a tela;
- listener de visibilidade;
- polling leve a cada 30 segundos;
- merge por ID.

### Limitações atuais

- Sem Supabase, não há sincronização real entre dispositivos.
- A sincronização atual é gradual e não substitui uma arquitetura backend completa.
- Conflitos simultâneos ainda dependem de merge simples por ID.
- Algumas entidades locais ainda podem precisar de evolução de schema para produção.

### Visão futura

- Realtime Supabase ou backend dedicado.
- Regras RLS completas.
- Histórico de alterações.
- Resolução de conflito por `updated_at`.
- Auditoria financeira por usuário.

---

## 10. Testes e Qualidade

### Playwright QA

O projeto possui auditoria automatizada em:

```txt
tests/qa/fluxocerto360.audit.spec.ts
```

Comando:

```bash
npm run qa
```

Relatório:

```txt
test-results/RELATORIO_QA.md
test-results/playwright-report/index.html
test-results/screenshots/
```

### O que é testado

O robô QA cobre:

- abertura da landing;
- login/cadastro;
- onboarding;
- dashboard zerado para novo usuário;
- entrada manual;
- taxa de cartão;
- distribuição de valor líquido nos potes;
- saída em pote específico;
- lucro líquido não sendo reduzido por saída;
- entrada por voz;
- atualização de KPIs no dashboard;
- gráfico deixando de mostrar estado vazio;
- navegação por telas internas;
- validação de formulários;
- logout;
- responsividade em vários viewports;
- regra de dinheiro livre usando apenas pote Pessoal.

### Cobertura atual

A cobertura atual é voltada a fluxo crítico de produto, regras financeiras e regressões visuais básicas. Ela não substitui:

- testes unitários de todos os helpers;
- testes de integração Supabase;
- testes de segurança;
- testes cross-browser completos.

---

## 10.1. Indicadores de Sucesso do Produto

Para avaliar se o FluxoCerto360 está entregando valor real, os indicadores devem medir mudança de comportamento financeiro, não apenas visitas.

### Métricas principais

- **Retenção D1, D7 e D30:** mede se o usuário volta depois do primeiro uso.
- **Frequência de registro:** quantidade de entradas e saídas registradas por semana.
- **Uso do comando de voz:** percentual de movimentações criadas por voz.
- **Separação PF/PJ correta:** percentual de entradas distribuídas entre Pessoal, Negócio e Reserva sem ajuste manual posterior.
- **Crescimento de reserva:** evolução do saldo do pote Reserva ao longo do tempo.
- **Uso do Flux:** quantidade de perguntas feitas ao assistente por usuário ativo.
- **Tempo até primeira entrada:** quanto tempo o usuário leva para registrar a primeira movimentação real.
- **Conclusão do onboarding:** percentual de usuários que concluem o fluxo inicial.
- **Ativação financeira:** usuário que conclui onboarding e registra pelo menos uma entrada real.

### Métrica de valor central

A métrica mais importante para o produto é:

```txt
Usuários ativos que registram entradas reais e mantêm separação Pessoal/Negócio/Reserva
```

Essa métrica mostra se o app está mudando o comportamento financeiro do público-alvo.

---

## 11. Deploy e Infra

### Vercel

O projeto possui `vercel.json`, indicando preparo para deploy em Vercel.

Fluxo esperado:

```txt
git push -> build Vercel -> deploy automático
```

### Build

Comando:

```bash
npm run build
```

O build usa Vite com `root` em:

```txt
client/
```

Arquivos públicos são servidos de:

```txt
client/public
```

Saída de build:

```txt
dist/public
```

### Ambiente de produção

Variáveis relevantes:

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```

Observação: `OPENAI_API_KEY` deve existir apenas no backend/servidor, nunca no frontend.

---

## 12. Segurança

### Autenticação

O app possui dois modos:

1. **Supabase Auth**, quando configurado.
2. **Auth local MVP**, quando Supabase não está configurado.

O auth local é isolado e evita senha em texto claro, mas não deve ser tratado como solução final de produção.

### Isolamento de dados por usuário

No localStorage, dados são salvos por chave com `userId`.

No Supabase, repositories usam `user_id`/`ownerId` para buscar e salvar dados associados ao usuário.

### Riscos atuais

- localStorage não é ideal para dados financeiros sensíveis.
- Auth local MVP não substitui autenticação robusta.
- Regras admin/tester ainda precisam migrar para controle server-side.
- É necessário garantir RLS no Supabase antes de produção real.
- Dados sensíveis não devem ser enviados para IA sem sanitização.

### Boas práticas já encaminhadas

- `service_role` não é usado no frontend.
- Supabase usa `anon key` no client.
- Flux IA recebe contexto resumido.
- Mock financeiro `/api/v1` não é montado em produção.

---

## 13. Limitações Atuais

Lista honesta das limitações principais:

1. **Backend financeiro ainda não é robusto o suficiente para produção plena.**  
   Supabase está preparado, mas o app ainda mantém fallback local e sincronização gradual.

2. **localStorage ainda participa da continuidade de dados.**  
   Isso é útil para MVP, mas não é ideal para dados financeiros reais.

3. **Comando de voz depende do navegador.**  
   Android Chrome tende a funcionar melhor; iOS Safari tem limitações.

4. **Parser de voz ainda é local.**  
   Funciona para comandos comuns, mas pode falhar em frases muito abertas ou ambíguas.

5. **IA ainda depende de fallback local quando API não está configurada.**  
   O Flux pode orientar, mas a camada de IA avançada ainda precisa evoluir.

6. **Controle admin/tester precisa migrar para backend.**  
   O frontend não deve ser a fonte final de autorização.

7. **RLS e schema final precisam ser consolidados.**  
   Antes de usuários reais em escala, o Supabase precisa ter políticas, constraints e migrações revisadas.

---

## 14. Roadmap Futuro

### IA Flux mais avançada

- Consultor com entendimento de perguntas abertas.
- Planejamento financeiro por semana/mês.
- Diagnóstico automático de gargalos.
- Sugestões de preço e margem.
- Detecção de risco de caixa.

### Previsões financeiras

- Projeção de caixa.
- Projeção de meta mensal.
- Simulação “se eu gastar X hoje”.
- Previsão de vencimentos e compromissos.

### Open Finance

- Leitura bancária autorizada.
- Conciliação automática.
- Separação automática entre PF/PJ.
- Alertas de movimentação.

### App nativo/PWA avançado

- Experiência mobile instalada.
- Notificações push.
- Captura de voz mais fluida.
- Atalhos para lançamento rápido.

### Multiusuário/empresa

- Equipe.
- Permissões.
- Múltiplas unidades.
- Contador/consultor com acesso controlado.

### Monetização

- Plano básico para controle pessoal/negócio.
- Plano Pro com Flux IA, voz e relatórios.
- Plano Premium com multiusuário, integrações e consultoria financeira guiada.

---

## 14.1. Modelo de Monetização

O FluxoCerto360 tem potencial de monetização em modelo SaaS recorrente, com entrada gratuita para reduzir fricção e planos pagos baseados em automação, inteligência e profundidade de análise.

### Plano Free

Objetivo: ativar o usuário e provar valor rapidamente.

Recursos sugeridos:

- cadastro e onboarding;
- registro manual de entradas e saídas;
- potes Pessoal, Negócio e Reserva;
- dashboard básico;
- limite mensal de movimentações;
- acesso limitado ao comando de voz;
- Flux em modo básico/local;
- histórico reduzido.

Uso comercial: gerar aquisição, demonstração de valor e base para conversão.

### Plano Pro

Objetivo: ser o plano principal para autônomos e MEIs ativos.

Recursos sugeridos:

- movimentações ilimitadas;
- comando de voz completo;
- taxas de pagamento configuráveis;
- Consultor Flux com respostas mais completas;
- compromissos e contas;
- alertas financeiros;
- dashboard completo;
- relatórios de fluxo de caixa;
- controle de clientes;
- Itens/Custos com margem por produto.

Uso comercial: plano recomendado para quem usa o app como ferramenta diária de gestão.

### Plano Premium

Objetivo: atender usuários mais maduros, pequenos negócios e parceiros.

Recursos sugeridos:

- tudo do Pro;
- IA Flux avançada;
- previsões financeiras;
- análise de margem e precificação;
- múltiplos usuários ou perfis;
- exportação de relatórios;
- integração futura com Open Finance;
- suporte prioritário;
- recursos para contador, consultor ou parceiro.

Uso comercial: aumentar ticket médio e abrir espaço para parcerias com instituições, consultorias e programas de apoio a pequenos negócios.

### Receita SaaS

O modelo mais saudável é assinatura mensal ou anual. A lógica de valor é recorrente porque o problema financeiro do usuário também é recorrente: todo dia entra dinheiro, sai dinheiro e decisões precisam ser tomadas.

O produto pode gerar receita com:

- assinatura individual;
- planos anuais com desconto;
- plano parceiro para grupos de MEIs;
- licenças para consultorias, escolas de negócios ou programas de capacitação;
- serviços adicionais de implantação e educação financeira.

---

## 15. Conclusão

O FluxoCerto360 tem uma proposta clara: ajudar pequenos empreendedores a parar de misturar dinheiro pessoal, dinheiro do negócio e reserva. O diferencial do produto não é apenas registrar entradas e saídas, mas transformar cada entrada real em uma decisão organizada.

O produto já possui bases importantes:

- fluxo de entrada e saída;
- separação em potes;
- dashboard com métricas centrais;
- comando de voz;
- onboarding;
- Consultor Flux;
- QA automatizado;
- camada Supabase preparada;
- visual premium orientado a SaaS fintech.

O ponto mais importante do sistema é a confiança nas regras financeiras. O app precisa preservar sempre:

```txt
Entrada = bruto
Taxa antes da distribuição
Lucro líquido = entrada - taxas
Saída reduz somente um pote
Dinheiro livre = somente Pessoal - compromissos pessoais
Meta mensal nunca é saldo
```

Com a consolidação da persistência remota, RLS no Supabase, IA mais madura e refinamento dos fluxos mobile, o FluxoCerto360 tem potencial para se tornar uma ferramenta SaaS relevante para MEIs, autônomos e pequenos negócios que precisam de clareza financeira sem complexidade de ERP.
