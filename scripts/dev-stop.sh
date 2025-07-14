#!/bin/bash

echo "🛑 Stopping Docker development environment..."
echo "=============================================="

# Stop all services
docker-compose -f deployment/dev/docker-compose.dev.yml down

echo "✅ Development environment stopped"
echo ""
echo "💡 To start again, run: ./scripts/setup-dev.sh"
echo "🗑️  To remove all data, run: ./scripts/dev-reset.sh" 