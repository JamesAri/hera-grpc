import { EventEmitter } from 'events'
import grpc from '@grpc/grpc-js'

declare namespace ServiceClient {
	export interface ServiceClientOptions {
		host: string
		port: number
		zk: string
		serverOptions: grpc.ServerOptions
		logLevel: keyof typeof logLevels
	}
}

declare class ServiceClient extends EventEmitter {
	public constructor(props: ServiceClient.ServiceClientOptions)
}

type ServiceDefinition = {
	[serviceName: string]: {
		filename: string
	}
}
export declare const internal: ServiceDefinition

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
	const ALL: numbre
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
