#!/bin/bash

set -euo pipefail

log() {
	local type="$1"
	local message="$2"
	echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] [$type] $message"
}

error_handler() {
	log "ERROR" "An error occurred. Exiting."
	exit 1
}

trap error_handler ERR

log "INFO" "Starting Docker container with image $DOCKER_IMAGE"

docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -ti grafana/otel-lgtm

log "INFO" "Docker container stopped"

