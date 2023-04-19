// import { BatchSpanProcessor, ConsoleSpanExporter } from "npm:@opentelemetry/sdk-trace-base";
// import { Resource } from "npm:@opentelemetry/resources";
// import { SemanticResourceAttributes } from "npm:@opentelemetry/semantic-conventions";
// import { NodeTracerProvider } from "npm:@opentelemetry/sdk-trace-node";
// import { registerInstrumentations } from "npm:@opentelemetry/instrumentation";
import opentelemetry from "npm:@opentelemetry/api";

import { OTLPTraceExporter } from "npm:@opentelemetry/exporter-trace-otlp-proto";

import { NodeSDK } from 'npm:@opentelemetry/sdk-node';


import { FetchInstrumentation } from 'npm:@opentelemetry/instrumentation-fetch';

import { serve } from "https://deno.land/std@0.180.0/http/server.ts";

const start = performance.now();

// const resource =
//   Resource.default().merge(
//     new Resource({
//       [SemanticResourceAttributes.SERVICE_NAME]: "service-name-here",
//       [SemanticResourceAttributes.SERVICE_VERSION]: "0.1.0",
//     })
//   );

// const provider = new NodeTracerProvider({
//     resource: resource,
// });
// const consoleExporter = new ConsoleSpanExporter();
// provider.addSpanProcessor(new BatchSpanProcessor(consoleExporter));

const traceExporter = new OTLPTraceExporter();
// provider.addSpanProcessor(new BatchSpanProcessor(traceExporter));

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [new FetchInstrumentation()]
});

sdk.start()

// Optionally register instrumentation libraries
// registerInstrumentations({
//   instrumentations: [new FetchInstrumentation()],
// });

const tracer = opentelemetry.trace.getTracer(
  'my-service-tracer'
);

console.log(`SOS duration: ${performance.now()-start}`);

// Monkeypatching to get past FetchInstrumentation's dependence on sdk-trace-web, which depends on some browser-only constructs
globalThis.location = {}; //For this line - https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-web/src/utils.ts#L310

// Making the ergonomics fit better into std/http

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

// App code

const port = 8080;

const handler = async (request: Request): Promise<Response> => {
  // Will be autoinstrumented
  const res = await fetch("http://www.example.com");
  await res.text();

  // An example of manual instrumentation
  const span = tracer.startSpan(`constructBody`);

  const body = `Your user-agent is:\n\n${
    request.headers.get("user-agent") ?? "Unknown"
  }`;

  span.end();

  return new Response(body, { status: 200 });
};

await serve(instrument(handler), { port });