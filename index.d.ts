import { EventEmitter } from 'events'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'

declare namespace ServiceClient {
	export interface ServiceClientOptions {
		zk: string
		port: number
		serverOptions: grpc.ServerOptions
		logLevel: keyof typeof logLevels
		retryMaxAttempts: number
		retryDelay: number
	}

	export type ServiceDefinition = {
		routes: string | string[]
		serviceName: grpc.ServiceDefinition
		handlers: grpc.UntypedServiceImplementation
		filename?: string
		loadOptions?: protoLoader.Options
	}
}

declare class ServiceClient extends EventEmitter {
	public constructor(options: ServiceClient.ServiceClientOptions)

	public connect(): Promise<void>
	public close(): Promise<void>
	public getStub(route: string, clientOptions?: grpc.ClientOptions): Promise<grpc.Client>

	public on(event: 'close', listener: () => void): this
	public on(event: 'connected', listener: () => void): this
	public on(event: 'registered', listener: (boundPort: Number) => void): this
	public once(event: 'close', listener: () => void): this
	public once(event: 'connected', listener: () => void): this
	public once(event: 'registered', listener: (boundPort: Number) => void): this

	public registerService(serviceDefinition: ServiceClient.ServiceDefinition): void
}

type ServiceDefinition = {
	[serviceName: string]: {
		filename: string
		loadOptions?: protoLoader.Options
	}
}
declare const internal: ServiceDefinition

declare namespace compression {
	namespace ALGORITHMS {
		const NO_COMPRESSION: number
		const DEFLATE: number
		const GZIP: number
	}
	namespace LEVELS {
		const NONE: number
		const LOW: number
		const MEDIUM: number
		const HIGH: number
	}
}

declare namespace logLevels {
	const ALL: number
	const DEBUG: number
	const INFO: number
	const WARN: number
	const ERROR: number
	const NONE: number
}

declare const rpcNoAuth: string[]

declare const HeraGrpc: {
	ServiceClient: typeof ServiceClient
	internal: typeof internal
	grpc: typeof grpc
	compression: typeof compression
	logLevels: typeof logLevels
	rpcNoAuth: typeof rpcNoAuth
}

export = HeraGrpc
export as namespace HeraGrpc
