# Known issues

## Not closing Service Client properly

When the process terminates without properly closing the client, zookeeper will try to wait for a few seconds (around 30s) before deleting
its entry. Meanwhile other clients may retrieve this entry and try to connect to the service resulting in `14 UNAVAILABLE: No connection established. Last error: connect ECONNREFUSED`.

## User defines custom client interceptors

As from doc: *If any interceptors are passed at invocation, all interceptors attached to the call during construction are ignored.*

This will result in a broken cache interceptor, metadata interceptor, deadline interceptor, tracing interceptor, ...
