#!/bin/bash

echo "🗑️  Resetting Docker development environment..."
echo "==============================================="

# Warning message
echo "⚠️  WARNING: This will delete all database data!"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled"
    exit 1
fi

# Stop all services
echo "🛑 Stopping services..."
docker-compose -f deployment/dev/docker-compose.dev.yml down

# Remove volumes (this will delete database data)
echo "🗑️  Removing volumes..."
docker-compose -f deployment/dev/docker-compose.dev.yml down -v

# Remove images
echo "🗑️  Removing images..."
docker-compose -f deployment/dev/docker-compose.dev.yml down --rmi all

# Clean up any orphaned containers
echo "🧹 Cleaning up..."
docker system prune -f

echo "✅ Development environment reset complete!"
echo ""
echo "💡 To start fresh, run: ./scripts/setup-dev.sh" 