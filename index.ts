import opentelemetry from 'npm:@opentelemetry/api';
import { Resource } from 'npm:@opentelemetry/resources';
import { SemanticResourceAttributes } from 'npm:@opentelemetry/semantic-conventions';
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from 'npm:@opentelemetry/sdk-trace-base';
// const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
import { FetchInstrumentation } from 'npm:@opentelemetry/instrumentation-fetch';
import { registerInstrumentations } from 'npm:@opentelemetry/instrumentation';

import { serve } from "https://deno.land/std@0.180.0/http/server.ts";

// Monkeypatching to get past FetchInstrumentation's dependence on sdk-trace-web, which depends on some browser-only constructs
globalThis.location = {}; //For this line - https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-web/src/utils.ts#L310

const provider = new BasicTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'basic-service',
  }),
});

// Configure span processor to send spans to the exporter
// const exporter = new JaegerExporter({
//   endpoint: 'http://localhost:14268/api/traces',
// });
// provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

/**
 * Initialize the OpenTelemetry APIs to use the BasicTracerProvider bindings.
 *
 * This registers the tracer provider with the OpenTelemetry API as the global
 * tracer provider. This means when you call API methods like
 * `opentelemetry.trace.getTracer`, they will use this tracer provider. If you
 * do not register a global tracer provider, instrumentation which calls these
 * methods will receive no-op implementations.
 */
provider.register();

registerInstrumentations({
  instrumentations: [new FetchInstrumentation()],
});

const tracer = opentelemetry.trace.getTracer('example-basic-tracer-node');

// // Create a span. A span must be closed.
// const parentSpan = tracer.startSpan('main');
// for (let i = 0; i < 3; i += 1) {
//   await doWork(parentSpan);
// }
// // Be sure to end the span.
// parentSpan.end();

// // flush and close the connection.
// // exporter.shutdown();

// async function doWork(parent) {
//   // Start another span. In this example, the main method already started a
//   // span, so that'll be the parent span, and this will be a child span.
//   const ctx = opentelemetry.trace.setSpan(opentelemetry.context.active(), parent);
//   const span = tracer.startSpan('doWork', undefined, ctx);

//     // Use native async/await
//     await fetch("http://www.example.com");

// //   // simulate some random work.
// //   for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
// //     // empty
// //   }

//   // Set attributes to the span.
//   span.setAttribute('key', 'value');

//   // Annotate our span to capture metadata about our operation
//   span.addEvent('invoking doWork');

//   span.end();
// }

const port = 8080;

const handler = (request: Request): Response => {
  const parentSpan = tracer.startSpan('handler');

  const body = `Your user-agent is:\n\n${
    request.headers.get("user-agent") ?? "Unknown"
  }`;

  const res = new Response(body, { status: 200 });

  parentSpan.end();

  return res;
};

await serve(handler, { port });