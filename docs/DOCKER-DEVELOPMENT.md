# Docker Development Environment

This guide helps you set up a complete Docker development environment for the OlaClick Analytics Dashboard with PostgreSQL database.

## Prerequisites

- Docker Desktop installed
- Docker Compose installed
- Git

## Quick Start

### 1. Initial Setup

Run the automated setup script:

```bash
npm run docker:setup
```

This will:
- ✅ Check for Docker installation
- 🗄️ Create and start PostgreSQL database
- 📦 Build and start the application
- 🔧 Run database migrations automatically
- 🚀 Start both backend and frontend services

### 2. Access Your Application

Once setup is complete, you can access:

- **Dashboard**: http://localhost:3001
- **API Health Check**: http://localhost:3001/health
- **Frontend Dev Server**: http://localhost:5173 (if running separately)
- **Database**: localhost:5432

## Available npm Scripts

### Setup & Control
```bash
npm run docker:setup    # Initial setup and start all services
npm run docker:start    # Start all services
npm run docker:stop     # Stop all services
npm run docker:restart  # Restart all services
npm run docker:reset    # Reset environment (deletes all data!)
```

### Development
```bash
npm run docker:build    # Rebuild Docker images
npm run docker:logs     # View live logs
npm run docker:shell    # Access application shell
npm run docker:db       # Access PostgreSQL shell
```

## Services

### PostgreSQL Database
- **Container**: `olaclick-postgres`
- **Port**: 5432
- **Database**: `olaclick_analytics`
- **User**: `postgres`
- **Password**: `postgres`
- **Volume**: `postgres_data` (persists data)

### Application
- **Container**: `olaclick-app`
- **Ports**: 
  - 3001 (Backend API)
  - 5173 (Frontend Dev Server)
- **Hot Reload**: ✅ Source code changes reload automatically
- **Environment**: Development with debug logging

## Development Workflow

### 1. Making Code Changes

The Docker environment supports hot reloading:

- **Backend**: Changes in `server/` directory restart the server automatically
- **Frontend**: Changes in `client/` directory reload the browser automatically
- **Database**: Changes in `database/migrations/` require manual migration

### 2. Database Operations

```bash
# Run database migrations
npm run docker:shell
npm run db:migrate

# Check database status
npm run db:status

# Access database directly
npm run docker:db
```

### 3. Viewing Logs

```bash
# Follow all service logs
npm run docker:logs

# View specific service logs
docker-compose -f deployment/dev/docker-compose.dev.yml logs -f postgres
docker-compose -f deployment/dev/docker-compose.dev.yml logs -f app
```

### 4. Debugging

```bash
# Access application shell
npm run docker:shell

# Check running containers
docker-compose -f deployment/dev/docker-compose.dev.yml ps

# Check service health
docker-compose -f deployment/dev/docker-compose.dev.yml exec app curl http://localhost:3001/health
```

## Environment Variables

The Docker environment uses these variables:

```bash
# Application
NODE_ENV=development
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=olaclick_analytics
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# Push Notifications
VAPID_PUBLIC_KEY=BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM
VAPID_PRIVATE_KEY=dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ
VAPID_CONTACT_EMAIL=admin@olaclick.com
```

## Troubleshooting

### Common Issues

#### "Port already in use"
```bash
# Stop all services and try again
npm run docker:stop
npm run docker:start
```

#### "Database connection failed"
```bash
# Check if PostgreSQL is running
docker-compose -f deployment/dev/docker-compose.dev.yml ps

# Check database logs
docker-compose -f deployment/dev/docker-compose.dev.yml logs postgres
```

#### "Application won't start"
```bash
# Check application logs
docker-compose -f deployment/dev/docker-compose.dev.yml logs app

# Rebuild from scratch
npm run docker:reset
npm run docker:setup
```

### Complete Reset

If you encounter persistent issues:

```bash
# ⚠️ WARNING: This deletes all data!
npm run docker:reset

# Start fresh
npm run docker:setup
```

## File Structure

```
├── deployment/
│   ├── dev/                        # Development environment
│   │   ├── docker-compose.dev.yml  # Development services
│   │   ├── Dockerfile.dev          # Development image
│   │   └── .dockerignore           # Build exclusions
│   └── prod/                       # Production environment
│       ├── docker-compose.yml      # Production services
│       ├── Dockerfile              # Production image
│       ├── .dockerignore           # Build exclusions
│       ├── railway.json            # Railway config
│       └── start-production.sh     # Production startup
├── scripts/
│   ├── setup-dev.sh               # Setup script
│   ├── dev-logs.sh                # View logs
│   ├── dev-stop.sh                # Stop services
│   └── dev-reset.sh               # Reset environment
└── docs/
    └── DOCKER-DEVELOPMENT.md       # This file
```

## Production Deployment

For production deployment, see:
- [Production Setup](setup/PRODUCTION-SETUP.md)
- [Railway Deployment](deployment/RAILWAY-DEPLOYMENT.md)
- [General Deployment](deployment/DEPLOYMENT.md)

## Support

If you encounter issues:
1. Check the logs: `npm run docker:logs`
2. Verify services are running: `docker-compose -f deployment/dev/docker-compose.dev.yml ps`
3. Try a complete reset: `npm run docker:reset && npm run docker:setup`
4. Check Docker Desktop is running and has sufficient resources

---

**🚀 Happy coding!** 