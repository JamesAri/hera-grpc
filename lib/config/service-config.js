// Service Config IDL: https://github.com/grpc/grpc-proto/blob/master/grpc/service_config/service_config.proto
module.exports = {
	// TODO: We can create custom loadbalancer with respect to load:
	// https://grpc.io/docs/guides/custom-backend-metrics/
	loadBalancingConfig: [{ round_robin: {} }],
}
