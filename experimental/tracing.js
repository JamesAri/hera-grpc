'use strict'

const process = require('process')

const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const { Resource } = require('@opentelemetry/resources')
const { NodeSDK } = require('@opentelemetry/sdk-node')
const {
	BatchSpanProcessor,
	SimpleSpanProcessor,
	ConsoleSpanExporter,
	BasicTracerProvider,
} = require('@opentelemetry/sdk-trace-base')
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node')
const conventions = require('@opentelemetry/semantic-conventions')

// EXPORTERS

const collectorOptions = {
	// url is optional and can be omitted - default is http://localhost:4317
	// Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
	url: 'http://localhost:4317',
}

// OTLPTraceExporter(collectorOptions) | ConsoleSpanExporter
const exporter = new OTLPTraceExporter(collectorOptions)

// RESOURCES

const resource = Resource.default().merge(
	new Resource({
		[conventions.ATTR_SERVICE_NAME]: process.env.SERVICE_NAME,
		[conventions.ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION,
	}),
)

// SPAN PROCESSORS

// SimpleSpanProcessor | BatchSpanProcessor
const spanProcessors = [
	new BatchSpanProcessor(exporter),
	new SimpleSpanProcessor(new ConsoleSpanExporter()),
]

// PROVIDERS
// BasicTracerProvider | NodeTracerProvider
const provider = new NodeTracerProvider({
	spanProcessors,
	resource,
})

provider.register()

// INSTRUMENTATIONS

const instrumentations = [getNodeAutoInstrumentations()]

registerInstrumentations({
	instrumentations,
})

// ========================================

// SDK version

// const sdk = new NodeSDK({
// 	resource,
// 	traceExporter,
// 	instrumentations,
// })

// // initialize the SDK and register with the OpenTelemetry API
// // this enables the API to record telemetry
// sdk.start()

// // gracefully shut down the SDK on process exit
// process.on('SIGTERM', () => {
// 	sdk
// 		.shutdown()
// 		.then(() => console.log('Tracing terminated'))
// 		.catch((error) => console.log('Error terminating tracing', error))
// 		.finally(() => process.exit(0))
// })
