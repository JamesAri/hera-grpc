'use strict'

const process = require('process')

const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc')
const { Resource } = require('@opentelemetry/resources')
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics')
const { NodeSDK } = require('@opentelemetry/sdk-node')
const conventions = require('@opentelemetry/semantic-conventions')
const debug = require('debug')('experimental:instrumentation')

// metrics status: https://github.com/open-telemetry/opentelemetry-js/issues/5250

const sdk = new NodeSDK({
	resource: Resource.default().merge(
		new Resource({
			[conventions.ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME,
			[conventions.ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION,
		}),
	),
	traceExporter: new OTLPTraceExporter(),
	metricReader: new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter(),
		exportIntervalMillis: 5000,
	}),
	instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()

process.on('SIGTERM', () => {
	sdk
		.shutdown()
		.then(() => debug('Tracing terminated'))
		.catch((error) => debug('Error terminating tracing', error))
		.finally(() => process.exit(0))
})

debug('Instrumentation enabled')
