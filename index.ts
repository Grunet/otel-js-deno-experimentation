import { registerInstrumentations } from "npm:@opentelemetry/instrumentation";
import { FetchInstrumentation } from 'npm:@opentelemetry/instrumentation-fetch';

import { NodeTracerProvider } from "npm:@opentelemetry/sdk-trace-node";
import { Resource } from "npm:@opentelemetry/resources";
import { SemanticResourceAttributes } from "npm:@opentelemetry/semantic-conventions";
import { BatchSpanProcessor, ConsoleSpanExporter } from "npm:@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "npm:@opentelemetry/exporter-trace-otlp-proto";

import opentelemetry from "npm:@opentelemetry/api";
import { serve } from "https://deno.land/std@0.180.0/http/server.ts";

// autoinstrumentation.ts

registerInstrumentations({
  instrumentations: [new FetchInstrumentation()],
});

// Monkeypatching to get past FetchInstrumentation's dependence on sdk-trace-web, which has runtime dependencies on some browser-only constructs. See https://github.com/open-telemetry/opentelemetry-js/issues/3413#issuecomment-1496834689 for more details
// Specifically for this line - https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-web/src/utils.ts#L310
globalThis.location = {}; 

// tracing.ts

const resource =
  Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "service-name-here",
      [SemanticResourceAttributes.SERVICE_VERSION]: "0.1.0",
    })
  );

const provider = new NodeTracerProvider({
    resource: resource,
});

const consoleExporter = new ConsoleSpanExporter();
provider.addSpanProcessor(new BatchSpanProcessor(consoleExporter));

const traceExporter = new OTLPTraceExporter();
provider.addSpanProcessor(new BatchSpanProcessor(traceExporter));

provider.register();

// Application code

const tracer = opentelemetry.trace.getTracer(
  'my-service-tracer'
);

const port = 8080;

const handler = async (request: Request): Promise<Response> => {
  // Will be autoinstrumented
  await fetch("http://www.example.com");

  const span = tracer.startSpan(`constructBody`);
  const body = `Your user-agent is:\n\n${
    request.headers.get("user-agent") ?? "Unknown"
  }`;
  span.end();

  return new Response(body, { status: 200 });
};

await serve(instrument(handler), { port });

// Helper code

function instrument(handler) {

  async function instrumentedHandler(request) {
    let response;
    await tracer.startActiveSpan('handler', async (span) => {

      response = await handler(request);

      span.end();
    });

    return response;
  }

  return instrumentedHandler;
}