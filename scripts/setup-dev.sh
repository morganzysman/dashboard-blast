#!/bin/bash

echo "🚀 Setting up OlaClick Analytics Development Environment with Docker"
echo "=================================================================="

# Create scripts directory if it doesn't exist
mkdir -p scripts

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create .env.development file
echo "📝 Creating .env.development file..."
cat > .env.development << EOF
# Development Environment Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=olaclick_analytics
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# VAPID Keys for Push Notifications (Development)
VAPID_PUBLIC_KEY=BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM
VAPID_PRIVATE_KEY=dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ
VAPID_CONTACT_EMAIL=admin@olaclick.com

# Debug Settings
DEBUG=true
LOG_LEVEL=debug
EOF

echo "✅ .env.development file created"

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker-compose -f deployment/dev/docker-compose.dev.yml down

# Build and start the development environment
echo "🏗️  Building Docker images..."
docker-compose -f deployment/dev/docker-compose.dev.yml build

echo "🚀 Starting development environment..."
docker-compose -f deployment/dev/docker-compose.dev.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose -f deployment/dev/docker-compose.dev.yml ps | grep -q "Up"; then
    echo "✅ Development environment is ready!"
    echo ""
    echo "🌐 Services available at:"
    echo "   📊 Dashboard: http://localhost:3001"
    echo "   🔧 API: http://localhost:3001/health"
    echo "   💻 Frontend Dev: http://localhost:5173 (if running separately)"
    echo "   🗄️  PostgreSQL: localhost:5432"
    echo ""
    echo "📖 Useful commands:"
    echo "   🔍 View logs: docker-compose -f deployment/dev/docker-compose.dev.yml logs -f"
    echo "   🛑 Stop: docker-compose -f deployment/dev/docker-compose.dev.yml down"
    echo "   🔄 Restart: docker-compose -f deployment/dev/docker-compose.dev.yml restart"
    echo "   🐛 Debug app: docker-compose -f deployment/dev/docker-compose.dev.yml exec app sh"
    echo "   🗄️  Database: docker-compose -f deployment/dev/docker-compose.dev.yml exec postgres psql -U postgres -d olaclick_analytics"
    echo ""
    echo "💡 The application will automatically run database migrations on startup."
else
    echo "❌ Some services failed to start. Check the logs:"
    docker-compose -f deployment/dev/docker-compose.dev.yml logs
fi 