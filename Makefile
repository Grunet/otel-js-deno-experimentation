start:
	export OTEL_EXPORTER_OTLP_ENDPOINT="https://api.honeycomb.io"
	export OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=your-api-key"
	export OTEL_SERVICE_NAME="deno-demo"

	deno run -A index.ts
