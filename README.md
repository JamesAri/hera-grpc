## Introduction

GRPC based library for efficient data transfer between microservices in a distributed system **without the need of a centralized repository for protocol buffer files (gRPC IDL)**.

Current solutions for sharing proto files are mostly centralized repositories (e.g. [google](https://github.com/googleapis/googleapis/tree/master/google)) that do not support dynamic development - by that I mean spawning a grpc service and being able to call it immediately without any more work.

This library leverages the ability of Node.js gRPC support for [dynamically generating the code at runtime](https://grpc.io/docs/languages/node/basics/#example-code-and-setup). When a new service wants to register its services, it provides a proto definition along with a `route` for which the service will be registered. The proto file is then registered to a zookeeper and ready to be served to clients who call the service for the specific registered `route`.

---

This library should not restrict the users on how to define the services via the protocol buffers. To access the [@grpc/grpc-js](https://www.npmjs.com/package/@grpc/grpc-js) utilities like `grpc.Metadata` or `grpc.status` you should import the reexported `grpc` package:

```js
const { grpc } = require('todo-package')
```

## Usage

For example, lets try to register and call the [demo application provided from gRPC Node.js docs](https://grpc.io/docs/languages/node/basics/):

Callee (server):
```js
const sc = new ServiceClient({ config /** TODO: doc */ })

// Definition of the poi service as from the demo
const poiService = {
	route: '/slechtaj-1.0.0/dev~service_route/poi',
	handlers: require('./poi/handlers'), // handlers from the demo
	serviceName: 'RouteGuide',
	filename: './poi.proto', // path to the proto file
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true
    },
}

sc.once('registered', (host, port) => {
	console.log(`Services registered to zookeeper, gRPC server listening on ${host}:${port}`)
	sc.connect()
})

sc.once('connected', () => {
	console.log('Connected to the service network and ready to handle/send requests')
})

sc.once('error', (error) => {
	console.error(error)
})

sc.registerService(
	poiService.route,
	poiService.filename,
	poiService.serviceName,
	poiService.handlers,
	poiService.loadOptions,
)

sc.listen()
```

Caller (client):

```js
const sc = new ServiceClient({config /** TODO: doc */ })

sc.once('connected', async () => {
	console.log('Connected to the service network')

	await sc.callService('/slechtaj-1.0.0/dev~service_route/poi', async (client /** TODO: doc */) => {
		await poiClient(client) // run all types of rpcs
	})
})

sc.once('error', (error) => {
	console.error(error)
})

sc.connect()
```

## Development

### References

Before developing (for this project) I highly encourage to read these:

---

#### General understanding of gRPC:

- [Introduction](https://grpc.io/docs/what-is-grpc/introduction/)

- [Core concepts, architecture and lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/)

- [FAQ](https://grpc.io/docs/what-is-grpc/faq/)

- [Guides](https://grpc.io/docs/guides/) - probably the most important one

---

#### Advanced understanding of gRPC:

- [Docs](https://github.com/grpc/grpc/tree/master/doc)

More specifically:

- [Docs - Service Config](https://github.com/grpc/grpc/blob/master/doc/service_config.md) - e.g. setting LB strategy, retry/hedging polices, ...
	- [Service Config IDL](https://github.com/grpc/grpc-proto/blob/master/grpc/service_config/service_config.proto)
- [Docs - Name Resolution](https://github.com/grpc/grpc/blob/master/doc/naming.md)
- [Docs - Load Balancing](https://github.com/grpc/grpc/blob/master/doc/load-balancing.md)

---

#### Repository [@grpc-js](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js)

- [gRPC Node.js Tests](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js/test) - advanced use cases and undocumented functionality

	*For example the API reference tells us that [`parent` call option](https://grpc.github.io/grpc/node/grpc.Client.html#:~:text=construct%20the%20client.-,parent,-grpc.Client~Call) should be a `grpc.Client~Call`, but it is in fact a [server call](https://github.com/grpc/grpc-node/blob/613c832aad5bc76005b809f45413e2c1c0222c20/packages/grpc-js/test/test-call-propagation.ts#L99C11-L99C50).*

---

#### Node.js gRPC API Reference:

- [Node gRPC API reference](https://grpc.github.io/grpc/node/grpc.html)

---

#### Node.js gRPC Examples:

- [Examples](https://github.com/grpc/grpc-node/tree/master/examples)

---

#### Node.js gRPC Interceptors:

*Interceptors are used for various tasks, such as authentication, tracing, caching or logging.*

- [L5 gRFC proposal on NodeJS Client Interceptors](https://github.com/grpc/proposal/blob/master/L5-node-client-interceptors.md)

- [L112 gRFC proposal on NodeJS Server Interceptors](https://github.com/grpc/proposal/blob/master/L112-node-server-interceptors.md)

---

#### Node.js gRPC List of Supported Channel Options

- [Supported Channel Options](https://github.com/grpc/grpc-node/blob/master/packages/grpc-js/README.md#supported-channel-options)
- [Document with channel argument keys definition](https://grpc.github.io/grpc/core/group__grpc__arg__keys.html)

---

#### Node.js gRPC Environment Variables

- [Environment Variables](https://github.com/grpc/grpc-node/blob/master/doc/environment_variables.md)

---

### Debugging

`GRPC_TRACE=all GRPC_VERBOSITY=DEBUG DEBUG=* node ...`

- [Environment Variables](https://github.com/grpc/grpc-node/blob/master/doc/environment_variables.md)

## Current zk structure

*Zookeeper is used here as a service discovery. The current watch fetches all services to the distributed nodes on each change - if it turns out that the zookeeper service is overwhelmed, we will need to come with a different solution.*

`get /hera-test/services/<znode>`: (service definition)
```json
{
	"host": "127.0.0.1",
	"port": 53362,
	"routes": {
		"/slechtaj-1.0.0/dev~service_route/chat": {
			"serviceName": "ChatRoom",
			"protoZnode": "/proto/buffer0000001575",
			"loadOptions": { "keepCase": true, "longs": "String", "enums": "String", "defaults": true, "oneofs": true }
		},
		"/slechtaj-1.0.0/dev~service_route/poi": {
			"serviceName": "RouteGuide",
			"protoZnode": "/proto/buffer0000001576",
			"loadOptions": { "keepCase": true, "longs": "String", "enums": "String", "defaults": true, "oneofs": true }
		},
		"/slechtaj-1.0.0/dev~service_route/file_share": {
			"serviceName": "FileShare",
			"protoZnode": "/proto/buffer0000001577",
			"loadOptions": { "keepCase": true, "longs": "String", "enums": "String", "defaults": true, "oneofs": true }
		}
	}
}
```

`get /hera-test/proto/<znode>`: (json descriptor, see [protobufjs](https://www.npmjs.com/package/protobufjs))

*note: corresponds to the `ChatRoom` service above.*

```json
{
  "options": { "syntax": "proto3" },
  "nested": {
    "ChatRoom": {
      "methods": {
        "ConnectChat": {
          "requestType": "Message",
          "requestStream": true,
          "responseType": "Message",
          "responseStream": true
        }
      }
    },
    "Message": {
      "oneofs": {
        "_content": { "oneof": ["content"] },
        "_userName": { "oneof": ["userName"] }
      },
      "fields": {
        "type": { "type": "MessageType", "id": 1 },
        "content": {
          "type": "string",
          "id": 2,
          "options": { "proto3_optional": true }
        },
        "userName": {
          "type": "string",
          "id": 3,
          "options": { "proto3_optional": true }
        }
      }
    },
    "MessageType": { "values": { "AUTH": 0, "CHAT": 1 } }
  }
}
```
