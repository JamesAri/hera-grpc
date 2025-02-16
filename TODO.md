### TODOs

- [ ] Better loadbalancing (?)
- [ ] zk register as transaction (?)
- [ ] create default proto for JSON like objects
- [ ] handle if `sc.callService` called multiple times without await
- [ ] Dependency Injection
- [ ] zk connect/disconnect event
- [ ] determine the connection protocol dynamically (hardcoded to ipv4 now)
- [ ] check registering service if it matches other services in zk under the same path
- [x] Make (debug) logs better
- [x] metadata sharing - we need to maintain consistent grpc version
- [x] test errors - callee off, run caller; caller on->off, run caller
- [x] includeDirs with protobufjs json descriptor buffers


