#!/bin/bash

echo "📋 Viewing Docker development logs..."
echo "===================================="

# Follow logs for all services
docker-compose -f deployment/dev/docker-compose.dev.yml logs -f 