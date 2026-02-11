# Cinema Ticketing System — Avaliação do Teste Técnico

## Visão Geral

Este repositório contém uma implementação do desafio de venda de ingressos concorrentes usando Node.js + NestJS. A solução foca nos pontos centrais: proteção contra concorrência (locks Redis), processamento assíncrono com mensageria (RabbitMQ), expiração automática de reservas e persistência em PostgreSQL via Prisma.

Resumo rápido:
- API REST em NestJS
- Banco relacional: PostgreSQL (Prisma)
- Cache / locks: Redis (ioredis)
- Mensageria: RabbitMQ (amqplib)
- Logging: Winston (JSON estruturado)

## Clone e configuração rápida

1. Clone o repositório e entre na pasta:

```bash
git clone https://github.com/andreas-yuji-fujiki-dev/cinema-ticketing-system.git
cd cinema-ticketing-system
```

2. Copie o arquivo de exemplo de variáveis de ambiente e ajuste se necessário:

```bash
cp .env.example .env
# no Windows PowerShell:
Copy-Item .env.example .env
```

3. Subir o ambiente (Docker Compose):

```bash
docker compose up --build
```

Observação: o container `api` aplica migrations e executa o seed automaticamente durante o boot (veja `cinema-api/docker/entrypoint.sh`).

## Tecnologias escolhidas

- Node.js + NestJS — estrutura do serviço HTTP
- PostgreSQL — persistência relacional (Prisma como ORM)
- Redis (ioredis) — locks distribuídos para coordenação entre instâncias
- RabbitMQ (amqplib) — eventos assíncronos entre componentes
- Prisma — modelagem de dados e migrations
- Winston — logging estruturado

Motivações: Redis fornece operações atômicas (SET NX EX) para locks; RabbitMQ traz durabilidade e roteamento simples (exchange `events`), e Prisma facilita trabalhar com migrations e tipos.

## Como executar (local com Docker)

Pré-requisitos:
- Docker & Docker Compose

Subir todo o ambiente:

```bash
docker compose up --build
```

O compose já orquestra os serviços necessários: `api` (NestJS), `worker`, `postgres`, `redis`, `rabbitmq`.

Populando dados iniciais (seed)

Ao usar `docker compose up --build` o container `api` aplica automaticamente as migrations e executa o seed durante o boot (veja `cinema-api/docker/entrypoint.sh`).

Se preferir executar manualmente (por exemplo para desenvolvimento local), rode na pasta `cinema-api`:

```bash
# dentro da pasta cinema-api (local)
npx prisma migrate deploy
npx prisma db seed
```

## Endpoints principais

- Reservar assentos

  POST /reservations

  Payload exemplo:
  ```json
  {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "sessionId": "session-1",
    "seatIds": ["seat-1", "seat-2"]
  }
  ```

  Retorno: objeto `Reservation` contendo `id` e `expiresAt` (válido por 30s).

  Exemplo curl:

  ```bash
  curl -X POST http://localhost:3000/reservations \
    -H 'Content-Type: application/json' \
    -d '{"userId":"f47ac10b-58cc-4372-a567-0e02b2c3d479","sessionId":"session-1","seatIds":["seat-1","seat-2"]}'
  ```

- Confirmar pagamento

  POST /payments/confirm

  Payload exemplo:
  ```json
  { "reservationId": "<reservation-id>" }
  ```

  Comportamento: valida se a reserva existe, se está ativa e não expirou; converte em `Sale`, remove locks Redis e publica eventos (`PAYMENT_CONFIRMED`, `SEAT_RELEASED`).

  Exemplo curl:

  ```bash
  curl -X POST http://localhost:3000/payments/confirm \
    -H 'Content-Type: application/json' \
    -d '{"reservationId":"<reservation-id>"}'
  ```

- Consultar disponibilidade de assentos

  GET /sessions/:id/seats

  Retorna uma lista com status por assento: `AVAILABLE`, `RESERVED`, `SOLD`.

  Exemplo curl:

  ```bash
  curl http://localhost:3000/sessions/session-1/seats
  ```

- Histórico de vendas do usuário

  GET /users/:id/sales

  Retorna vendas do usuário com detalhes de sessão e assentos.

  Exemplo curl:

  ```bash
  curl http://localhost:3000/users/f47ac10b-58cc-4372-a567-0e02b2c3d479/sales
  ```
## Estratégias de concorrência e coordenação (decisões técnicas)

## Fluxo de Reserva (Passo a Passo)

- 1. Cliente solicita uma reserva: `POST /reservations` com `userId`, `sessionId` e `seatIds`.
- 2. O serviço verifica se os assentos já foram vendidos (tabela `SaleSeat`) e se existem reservas ativas para esses assentos.
- 3. Para evitar deadlocks, os `seatIds` são ordenados; o serviço tenta adquirir locks por assento no Redis com `SET <key> <value> EX 30 NX`.
- 4. Se todos os locks forem obtidos, a aplicação cria a `Reservation` e os `ReservationSeat(s)` dentro de uma transação, definindo `expiresAt = now + 30s`.
- 5. O serviço publica o evento `RESERVATION_CREATED` (exchange `events`) e retorna ao cliente o `reservationId` e o `expiresAt`.
- 6. O cliente confirma o pagamento chamando `POST /payments/confirm` com o `reservationId`.
- 7. O serviço valida que a reserva existe, está no estado `ACTIVE`, não expirou e que os locks Redis ainda existem para os assentos reservados.
- 8. Em uma transação atômica, a aplicação cria a `Sale` (com `SaleSeat(s)`), atualiza a `Reservation` para `CONFIRMED` e remove os locks no Redis.
- 9. O serviço publica os eventos `PAYMENT_CONFIRMED` e `SEAT_RELEASED` (por assento). A venda é então definitiva.

Observação: se o pagamento não for confirmado antes de `expiresAt`, o `ReservationExpirationWorker` seleciona reservas expiradas (`FOR UPDATE SKIP LOCKED`), marca como `EXPIRED`, remove `ReservationSeat`s e publica `RESERVATION_EXPIRED`. Consumidores (ex.: `SeatConsumer`) reagem liberando locks e publicando `SEAT_RELEASED`.

Notas sobre tolerância a condições de corrida:
- Uso de locks Redis com `NX` + TTL evita dupla reserva entre instâncias concorrentes.
- Ordenação dos `seatIds` reduz riscos de deadlock ao adquirir múltiplos locks.
- Operações críticas (criar reserva, confirmar pagamento, expirar reserva) são executadas em transações no DB para manter consistência.

## Detalhes de Implementação de Concorrência

- Locks Redis (SET key value EX <ttl> NX):
  - Ao criar uma reserva, o serviço tenta adquirir locks por assento com `NX` e TTL de 30s. Se qualquer lock falhar, a requisição falha com `409 Conflict`.

- Ordenação de IDs de assento para evitar deadlocks:
  - Antes de adquirir locks, os `seatIds` são ordenados para garantir uma ordem estável entre requisições concorrentes que reservam múltiplos assentos.

- Transações no banco:
  - Criação de `Reservation` e `ReservationSeat` é feita dentro de uma transação Prisma.
  - Expiração de reservas usa `SELECT ... FOR UPDATE SKIP LOCKED` via `$queryRaw` para evitar múltiplos workers processando a mesma reserva.

- Mensageria confiável:
  - Eventos são publicados em exchange `events` (tipo `topic`) no RabbitMQ.
  - Consumidores duráveis (`logging.queue`, `seat.queue`) são registrados para processar `RESERVATION_EXPIRED`, entre outros.

## O que está implementado (detalhado)

- Redis-based locking para coordenação entre instâncias (arquivo: `src/infra/cache/redis.service.ts`).
- Endpoint de criação de reserva com checagens de vendas e reservas ativas (`src/modules/reservations`).
- Worker de expiração que marca reservas como `EXPIRED` e publica `RESERVATION_EXPIRED` (`src/modules/reservations/reservation-expiration.worker.ts`).
- Endpoint de confirmação de pagamento que cria `Sale`, atualiza `Reservation` e publica eventos (`src/modules/payments`).
- Consumidores para logs e para liberar locks quando reserva expira (`src/infra/messaging/*consumer.ts`).

## Limitações conhecidas

- Endpoints para CRUD administrativo de `Session` e `Seat` não foram implementados — atualmente a seed cria uma sessão e 16 assentos.
- Testes automatizados e cobertura ausentes.
- Idempotência de endpoints (ex: token para reenvio seguro de reserva) não foi implementada.
- Não há Swagger/OpenAPI configurado.
- Estratégias avançadas de retry/DLQ não foram adicionadas.

## Melhorias futuras (se tivesse mais tempo)

1. Implementar endpoints administrativos para criar/atualizar sessões e assentos e aumentar a seed para 16+ assentos.
2. Adicionar testes de integração que simulem alta concorrência (múltiplas instâncias/processos tentando reservar o mesmo assento).
3. Adicionar Swagger (`/api-docs`) para documentação interativa.
4. Implementar idempotency keys para operações sensíveis e retries com backoff para consumidores; adicionar DLQ para mensagens que falharem repetidamente.
5. Cobertura mínima de testes unitários (60%+) e integração em CI.

## Onde olhar no código

- Lógica de reservas: [cinema-api/src/modules/reservations](cinema-api/src/modules/reservations)
- Confirmação de pagamento: [cinema-api/src/modules/payments](cinema-api/src/modules/payments)
- Disponibilidade de assentos: [cinema-api/src/modules/sessions](cinema-api/src/modules/sessions)
- Worker de expiração: [cinema-api/src/modules/reservations/reservation-expiration.worker.ts](cinema-api/src/modules/reservations/reservation-expiration.worker.ts)
- Lock Redis: [cinema-api/src/infra/cache/redis.service.ts](cinema-api/src/infra/cache/redis.service.ts)
- Mensageria (publish/consume): [cinema-api/src/infra/messaging](cinema-api/src/infra/messaging)

---

## Teste de concorrência (10 usuários)

Um teste de exemplo foi adicionado em `cinema-api/test/concurrency.e2e-spec.ts`. Ele dispara 10 requisições concorrentes tentando reservar os mesmos dois assentos (`seat-1` e `seat-2`) para `session-1`.

Como executar o teste (recomendado com `docker compose up` rodando a API em `http://localhost:3000`):

- Linux / macOS:

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e -- test/concurrency.e2e-spec.ts
```

- Windows PowerShell:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3000'
npm run test:e2e -- test/concurrency.e2e-spec.ts
```

O teste fará uma checagem rápida de disponibilidade do endpoint antes de tentar as requisições e imprimirá um resumo com quantas requisições tiveram sucesso e quantas retornaram `409 Conflict`.

Observação: o teste é um teste de integração e requer que os serviços (Postgres, Redis, RabbitMQ) estejam acessíveis conforme configurado no `.env`/`.env.example`.
