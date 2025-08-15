# NestJS Observability

This project is a demonstration of how to implement observability in a NestJS application using OpenTelemetry, Prometheus, Jaeger, and Grafana. It showcases how to collect and visualize the three pillars of observability: **traces**, **metrics**, and **logs**.

## 🏗️ Architecture and Technologies

The project uses a standard set of tools to build a robust observability stack.

- **[NestJS](https://nestjs.com/)**: A progressive Node.js framework for building efficient and scalable server-side applications.
- **OpenTelemetry (OTEL)**: An open-source observability framework used to generate, collect, and export telemetry data (traces, metrics, logs).
- **[Prometheus](https://prometheus.io/)**: A time-series database and monitoring system. It scrapes a `/metrics` endpoint exposed by our NestJS application to collect metrics.
- **[Jaeger](https://www.jaegertracing.io/)**: A distributed tracing system. It receives traces from the application via the OTLP exporter and provides a UI for visualizing request flows.
- **[Grafana](https://grafana.com/)**: A multi-platform analytics and visualization tool. It connects to Prometheus and Jaeger as data sources to create dashboards for monitoring metrics and analyzing traces.
- **[Pino](https://github.com/pinojs/pino)**: A very low-overhead logger for Node.js, integrated with OpenTelemetry to automatically inject `traceId` and `spanId` into logs.
- **[Docker](https://www.docker.com/) & Docker Compose**: Used to easily run and manage the observability stack (Prometheus, Jaeger, Grafana) locally.

## 📂 Folder Structure

The project is structured to separate infrastructure concerns from business logic.

```
src
├── infra
│   ├── app.module.ts                  # Root application module
│   ├── env                            # Environment variable handling (Zod schema, service)
│   ├── http                           # HTTP layer (controllers, module)
│   ├── observability                  # All observability-related setup
│   │   ├── decorators                 # Custom decorators like @Span
│   │   ├── observability.module.ts    # Configures logging (Pino) and metrics (Prometheus)
│   │   └── tracing.ts                 # OpenTelemetry SDK initialization and configuration
│   └── main.ts                        # Application entry point
└── modules
    └── user                           # Example business module
        ├── aplication                 # Use cases (application logic)
        └── domain                     # Domain entities
```

## 👀 Observability Flow

### 1. Tracing

1.  An incoming HTTP request hits a controller (e.g., `POST /users`).
2.  The `@opentelemetry/instrumentation-http` library automatically creates a root span for the request.
3.  Our custom `@Span()` decorator, applied to methods like `CreateUserUseCase.execute()`, creates child spans. This allows us to trace the execution flow through our business logic.
4.  The `OTLPTraceExporter` sends all collected spans to the Jaeger collector, which is configured via the `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` environment variable.

### 2. Metrics

1.  The `@willsoto/nestjs-prometheus` module automatically exposes a `/metrics` endpoint in the NestJS application.
2.  This endpoint provides default metrics, such as `http_requests_total` and `nodejs_heap_size_bytes`.
3.  A Prometheus instance, running via Docker Compose, is configured to periodically "scrape" (fetch data from) this `/metrics` endpoint.
4.  Prometheus stores this data in its time-series database.

### 3. Logging

1.  `nestjs-pino` is configured as the application logger.
2.  The OpenTelemetry `PinoInstrumentation` automatically injects the current `traceId` and `spanId` into every log record.
3.  This correlation allows you to find all logs related to a specific trace, making debugging distributed systems much easier.

### 4. Visualization

1.  **Grafana** is configured with two data sources: Prometheus and Jaeger.
2.  You can create dashboards in Grafana to visualize metrics from Prometheus (e.g., request latency, error rates).
3.  You can use Grafana's "Explore" view to query and visualize traces from Jaeger, and even jump from a trace to its corresponding logs if a log aggregator like Loki were integrated.

## ⚙️ Local Installation & Running

Follow these steps to get the project and its observability stack running on your local machine.

### Prerequisites

- Node.js (v20 or higher)
- pnpm
- Docker and Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/ErickKS/nestjs-observability
cd nest-observability
```

### 2. Install Application Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root of the project by copying the example file.

```bash
cp .env.example .env
```

The default values in `.env` are configured to work with the provided `docker-compose.yml` file.

```dotenv
# .env
PORT=3333
OTEL_SERVICE_NAME=nestjs-observability-demo
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
```

### 4. Run the Observability Stack

Start Prometheus, Jaeger, and Grafana using Docker Compose.

```bash
docker-compose up -d
```

This will start the following services:
- **Prometheus**: `http://localhost:9090`
- **Jaeger UI**: `http://localhost:16686`
- **Grafana**: `http://localhost:3000` (login with `admin`/`admin`)

### 5. Run the NestJS Application

```bash
npm run start:dev
```

The application will be available at `http://localhost:3333`.

## Prometheus, Jaeger & Grafana Configuration

### Prometheus

- **Access**: `http://localhost:9090`
- **Configuration**: The `prometheus/prometheus.yml` file configures Prometheus to scrape the NestJS application's `/metrics` endpoint.
- **Targets**: You can check the scrape status at `http://localhost:9090/targets`. The `nestjs-app` job should be `UP`.

### Jaeger

- **Access**: `http://localhost:16686`
- **Configuration**: Jaeger is running with the `all-in-one` image, which includes the agent, collector, and UI. It's configured to receive OTLP traces on port `4318`.
- **Service**: After sending some requests to the app, you should see the `nestjs-observability-demo` service in the Jaeger UI.

### Grafana

- **Access**: `http://localhost:3000`
- **Login**: `admin` / `admin`
- **Configuration**: The `grafana/provisioning` directory automatically configures the Prometheus and Jaeger data sources.
  - **Explore View**: Go to `Explore` in the Grafana sidebar. You can switch between the `Prometheus` and `Jaeger` data sources to query metrics and traces directly.

## Test Endpoints

Use these endpoints to generate telemetry data.

### Health Check

A simple health check endpoint. This route is ignored by the tracing instrumentation.

```bash
curl http://localhost:3333/health
# Expected output: OK
```

### Create User

This endpoint creates a user and generates a complete trace with custom spans from the `@Span` decorator. It also affects the HTTP request metrics in Prometheus.

```bash
curl -X POST http://localhost:3333/users \
-H "Content-Type: application/json" \
-d '{"name": "John Doe"}'
```

After calling this, go to the Jaeger UI (`http://localhost:16686`) to see the generated trace.

### Metrics Endpoint

This endpoint is scraped by Prometheus to collect metrics.

```bash
curl http://localhost:3333/metrics
```
