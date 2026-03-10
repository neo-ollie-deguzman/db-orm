# Observability & Feature Flags Research

Replacing AWS-native observability with an OTEL-first stack, and selecting a feature flag solution. Scope: this pnpm monorepo (Next.js 16, Drizzle, Neon Postgres).

---

## 1. Frontend / Reporting — OTEL Backend Comparison

All options accept OTLP natively and can be self-hosted.

|                  | **SigNoz**                                              | **Grafana LGTM Stack**                                                     | **Highlight.io**                                                      |
| ---------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Architecture     | Single binary + ClickHouse for traces, metrics, logs    | Composable: Tempo (traces) + Mimir (metrics) + Loki (logs) + Grafana (viz) | Full-stack: session replay + errors + logs + traces                   |
| OTEL support     | Built on OTEL — first-class, zero-adapter               | OTLP ingestion via Tempo/Mimir/Loki collectors                             | Browser OTEL SDK; server-side OTLP export                             |
| Setup complexity | Low — one Docker Compose                                | High — multiple backends to configure and maintain                         | Low — single deploy, but session replay adds client-side weight       |
| Indexing         | Indexes all OTEL attributes regardless of cardinality   | Loki indexes only low-cardinality labels by default (limit ~15)            | ClickHouse-backed, similar to SigNoz                                  |
| Session replay   | No                                                      | No (requires separate tool)                                                | Yes — pixel-perfect replay with privacy controls                      |
| Self-hosted cost | Free community edition; cloud starts $49/mo             | Free OSS; cloud starts $19/mo but scales steeply ($6.50/1k series)         | Free OSS; acquired by LaunchDarkly — long-term OSS commitment unclear |
| GitHub stars     | ~23k                                                    | ~70k (Grafana alone)                                                       | ~7k                                                                   |
| Best for         | Teams wanting unified OTEL-native o11y with minimal ops | Teams already invested in Grafana ecosystem or needing max flexibility     | Frontend-heavy apps needing session replay alongside backend traces   |

### Pros / Cons

**SigNoz**

| Pros                                                                           | Cons                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| OTEL-native from the ground up — no adapters or shims                          | Smaller community than Grafana (~23k vs ~70k stars)                  |
| Single ClickHouse datastore for traces, metrics, logs — low ops burden         | No session replay — need a separate tool if required                 |
| Indexes all attributes regardless of cardinality — fast ad-hoc queries         | Fewer third-party plugins and dashboard templates than Grafana       |
| ~40–50% cheaper than Grafana Cloud at comparable scale                         | ClickHouse tuning required at very high ingest volumes               |
| Unified UI for all three signals — no context-switching between tools          | Smaller talent pool for hiring/support compared to Grafana ecosystem |
| Full-stack: accepts browser OTEL traces and server OTEL traces in one instance |                                                                      |

**Grafana LGTM Stack**

| Pros                                                             | Cons                                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Largest ecosystem — 70k+ stars, massive plugin/dashboard library | High operational complexity — four separate backends to deploy and maintain                                    |
| Maximum flexibility — swap any component independently           | Loki indexes only low-cardinality labels by default — high-cardinality queries are slow or require workarounds |
| Mature alerting (Grafana Alerting, OnCall)                       | Cloud pricing scales steeply ($6.50/1k active metric series, per-user fees)                                    |
| Huge hiring pool — widely known across the industry              | Steeper learning curve — configuring Tempo + Mimir + Loki + Grafana together                                   |
| Strong enterprise support and Grafana Cloud managed option       | Correlating across signals requires manual dashboard wiring                                                    |

**Highlight.io**

| Pros                                                          | Cons                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| Session replay built-in — pixel-perfect with privacy controls | Acquired by LaunchDarkly — long-term OSS commitment uncertain |
| Full-stack: errors, logs, traces, and replay in one product   | Smaller community (~7k stars) and less battle-tested at scale |
| Low setup complexity for frontend-heavy apps                  | Replay SDK adds client-side bundle weight                     |
| ClickHouse-backed — good query performance                    | Weaker server-side OTEL story compared to SigNoz or Grafana   |
| Good Next.js / React integration out of the box               | Less flexible for infrastructure/backend-heavy monitoring     |

### Recommendation

**SigNoz** for full-stack observability (traces, metrics, logs) — simplest OTEL-native setup, single datastore, ~40–50% cheaper than Grafana Cloud at scale. Covers both browser and server telemetry in one platform. If session replay is needed later, Highlight.io can supplement it, though its LaunchDarkly acquisition introduces uncertainty for the self-hosted edition.

---

## 2. OTEL Instrumentation — Next.js Setup

### 2a. Server-side (backend)

#### Packages

```bash
pnpm add @vercel/otel @opentelemetry/api
```

#### Instrumentation hook

Create `apps/web/instrumentation.ts`:

```typescript
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "web",
    instrumentationConfig: {
      fetch: {
        propagateContextUrls: ["*"],
      },
    },
  });
}
```

`@vercel/otel` auto-detects the environment (Vercel or self-hosted), configures OTLP exporters, and enables auto-instrumentation for `fetch`, `http`, `dns`, etc.

#### Custom spans

```typescript
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("reminders");

export async function createReminder(
  tenantId: string,
  data: CreateReminderInput,
) {
  return tracer.startActiveSpan("createReminder", async (span) => {
    span.setAttribute("tenant.id", tenantId);
    try {
      const result = await db.insert(reminders).values(data).returning();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

#### Exporting to SigNoz

Set environment variables — no code changes needed because `@vercel/otel` reads standard OTEL env vars:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

### 2b. Client-side (browser)

SigNoz accepts browser telemetry via the same OTEL Collector — no separate frontend product needed.

#### Packages

```bash
pnpm add @opentelemetry/sdk-trace-web \
         @opentelemetry/exporter-trace-otlp-http \
         @opentelemetry/instrumentation-fetch \
         @opentelemetry/instrumentation-xml-http-request \
         @opentelemetry/instrumentation-user-interaction \
         @opentelemetry/context-zone \
         @opentelemetry/resources \
         @opentelemetry/semantic-conventions
```

#### Browser tracer setup

Create a client-side init file (e.g. `apps/web/src/lib/otel-browser.ts`):

```typescript
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const resource = new Resource({
  [ATTR_SERVICE_NAME]: "web-browser",
});

const provider = new WebTracerProvider({ resource });

provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: "https://<signoz-collector>/v1/traces",
    }),
  ),
);

provider.register({ contextManager: new ZoneContextManager() });

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [/your-api-domain/],
    }),
    new UserInteractionInstrumentation(),
  ],
});
```

Import this file early in the app (e.g. root layout client component) so it captures all network requests and interactions from page load.

#### What the browser SDK captures

| Signal             | Details                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| Distributed traces | Browser fetch/XHR → backend spans, connected via W3C `traceparent` header               |
| Network timing     | DNS, TLS handshake, TTFB, content download per request                                  |
| User interactions  | Clicks, navigation events as spans                                                      |
| Core Web Vitals    | LCP, INP, CLS (via `web-vitals` library feeding OTEL metrics)                           |
| Custom spans       | Manual spans for client-side operations (e.g. form validation, local state transitions) |

#### Collector CORS config

The SigNoz OTEL Collector must allow browser origins. Add to the collector's `config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      http:
        cors:
          allowed_origins: ["https://your-app-domain.com"]
          allowed_headers: ["*"]
```

#### End-to-end trace flow

A single trace connects browser → server → database:

```
Browser (web-browser)          Server (web)              Database
─────────────────────          ────────────              ────────
[click "Create"]
  └─ [fetch POST /api/reminders]
       └─── traceparent header ───→ [POST handler]
                                      └─ [createReminder]
                                           └─ [db.insert]
```

SigNoz displays this as one trace with spans from both services, making it straightforward to identify whether latency originates in the browser, server, or database.

---

## 3. Feature Flags — Comparison

|                 | **Unleash**                                          | **GrowthBook**                                | **Flagsmith**                                   |
| --------------- | ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Focus           | Feature flags + gradual rollout                      | Feature flags + A/B testing + experimentation | Feature flags + remote config                   |
| License         | Apache-2.0                                           | MIT (recently clarified)                      | BSD-3-Clause                                    |
| Self-hosted     | Yes — Docker, Postgres-backed                        | Yes — Docker, MongoDB-backed                  | Yes — Docker, Postgres-backed                   |
| OpenFeature SDK | Yes                                                  | Yes                                           | Yes                                             |
| GitHub stars    | ~13k                                                 | ~7k                                           | ~6k                                             |
| RBAC            | Yes (enterprise tier)                                | Yes                                           | Yes                                             |
| Maturity        | 11 years                                             | 5 years                                       | 8 years                                         |
| Experimentation | Limited (primarily flags)                            | Strong — built-in Bayesian stats engine       | Basic A/B                                       |
| Best for        | Teams wanting battle-tested flag management at scale | Teams wanting flags + product experimentation | Teams wanting flags + remote config in one tool |

### OpenFeature integration

All three support [OpenFeature](https://openfeature.dev/) (CNCF incubating), which provides a vendor-agnostic SDK. Using OpenFeature means the app code is decoupled from the flag backend:

```typescript
import { OpenFeature } from "@openfeature/server-sdk";

const client = OpenFeature.getClient();

const showNewDashboard = await client.getBooleanValue("new-dashboard", false, {
  targetingKey: tenantId,
});
```

Switching providers later requires changing only the provider registration, not call sites.

### Pros / Cons

**Unleash**

| Pros                                                                    | Cons                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Most mature — 11 years, battle-tested at scale                          | RBAC and advanced targeting locked behind enterprise tier            |
| Apache-2.0 — permissive license, no surprises                           | Limited experimentation — primarily a flag tool, not an A/B platform |
| Postgres-backed — matches our existing Neon stack, no new datastore     | UI is functional but not as polished as newer competitors            |
| Strongest OpenFeature provider with full SDK coverage                   | Enterprise pricing can be steep for small teams                      |
| Gradual rollout, kill switches, and strategy constraints out of the box |                                                                      |

**GrowthBook**

| Pros                                                               | Cons                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Built-in Bayesian experimentation engine — flags + A/B in one tool | MongoDB-backed by default — adds a new datastore to our stack    |
| Visual editor for no-code feature changes                          | Younger project (5 years) — less proven at large scale           |
| MIT license — very permissive                                      | Complexity increases when experimentation features aren't needed |
| Good analytics integration (warehouse-native stats)                | OpenFeature provider less mature than Unleash's                  |

**Flagsmith**

| Pros                                                            | Cons                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| BSD-3-Clause — most permissive license for commercial use       | Smallest community (~6k stars)                                                    |
| Remote config + flags in one tool — useful for runtime settings | A/B testing capabilities are basic compared to GrowthBook                         |
| Postgres-backed — same as our stack                             | Enterprise features (audit logs, SAML) require paid tier                          |
| Good SDK breadth across languages and platforms                 | Less focused — tries to cover flags, config, and A/B without excelling at any one |

### Recommendation

**Unleash** — most mature, Apache-2.0 licensed, Postgres-backed (matches our existing Neon stack), and the strongest OpenFeature provider. GrowthBook is the better pick only if built-in A/B experimentation is a priority.

---

## 4. Integration Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js App                               │
│                                                                  │
│  Client (browser)                Server (Node.js)                │
│  ─────────────────               ────────────────                │
│  OTEL Browser SDK                @vercel/otel                    │
│  (fetch, interactions,           (fetch, http, dns               │
│   Web Vitals)                     auto-instrumentation)          │
│       │                                │                         │
│       │    ┌───────────────────────┐    │                        │
│       │    │   OpenFeature SDK     │    │                        │
│       │    │   (feature flags)     │    │                        │
│       │    └──────────┬────────────┘    │                        │
│       │               │                 │                        │
│       ▼               ▼                 ▼                        │
│  OTLP/HTTP       Unleash provider  OTLP exporter                │
└──────┬───────────────┬──────────────────┬────────────────────────┘
       │               │                  │
       ▼               ▼                  ▼
  ┌──────────┐   ┌───────────┐   ┌──────────┐
  │  SigNoz  │   │  Unleash  │   │  SigNoz  │
  │ (browser │   │  (flags)  │   │ (server  │
  │  traces) │   └───────────┘   │  traces) │
  └────┬─────┘                   └────┬─────┘
       └──────── same instance ───────┘
```

### Day-one checklist

**Server-side:**

1. Add `@vercel/otel` + `@opentelemetry/api` to `apps/web`.
2. Create `apps/web/instrumentation.ts` with `registerOTel()`.
3. Point `OTEL_EXPORTER_OTLP_ENDPOINT` at SigNoz collector.
4. Add custom spans to `@repo/core` functions (start with high-value paths: auth, reminders CRUD).

**Client-side:**

5. Add `@opentelemetry/sdk-trace-web` + related browser packages to `apps/web`.
6. Create `apps/web/src/lib/otel-browser.ts` with `WebTracerProvider` + fetch/interaction instrumentations.
7. Import the browser tracer early in the root layout.
8. Configure CORS on the SigNoz OTEL Collector to allow the app origin.

**Infrastructure:**

9. Deploy SigNoz via Docker Compose (or use SigNoz Cloud for eval).
10. Deploy Unleash via Docker Compose with Neon Postgres.

**Feature flags:**

11. Install `@openfeature/server-sdk` + `@openfeature/unleash-provider` in `apps/web`.
12. Register the Unleash provider at app startup alongside OTEL.
13. Wrap new features in `client.getBooleanValue()` calls behind OpenFeature.

---

## 5. Summary

| Category                    | Recommended          | Why this over the alternatives                                                                                                                                                                                                                                                                                                             |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Observability backend**   | **SigNoz**           | OTEL-native with zero adapters, single ClickHouse datastore keeps ops simple, indexes all attributes for fast ad-hoc queries, ~40–50% cheaper than Grafana Cloud at scale. Grafana LGTM is more flexible but operationally heavy (four backends); Highlight.io has session replay but uncertain OSS future after LaunchDarkly acquisition. |
| **Server instrumentation**  | **@vercel/otel**     | One-line setup for Next.js, auto-instruments fetch/http/dns, reads standard OTEL env vars so the app is not coupled to any specific backend.                                                                                                                                                                                               |
| **Browser instrumentation** | **OTEL Browser SDK** | Same protocol (OTLP) and same backend (SigNoz) as the server — end-to-end traces from click to database with no additional vendor.                                                                                                                                                                                                         |
| **Feature flags**           | **Unleash**          | Most mature (11 years), Apache-2.0 licensed, Postgres-backed (matches Neon), strongest OpenFeature provider. GrowthBook is better only if built-in A/B experimentation is a hard requirement; Flagsmith is more permissively licensed but less focused.                                                                                    |
| **Flag SDK**                | **OpenFeature**      | CNCF incubating vendor-agnostic standard. Decouples all call sites from the flag backend — switching from Unleash to any other provider later is a one-line registration change, not a codebase-wide refactor.                                                                                                                             |
