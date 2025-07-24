# OlaClick Analytics Dashboard

A real-time analytics dashboard for OlaClick restaurant accounts with PostgreSQL backend and Vue.js frontend.

## Project Structure

```
├── client/                    # Frontend (Vue.js)
│   ├── src/                  # Vue source code
│   │   ├── components/       # Vue components
│   │   ├── views/           # Vue pages/views
│   │   ├── stores/          # Pinia stores
│   │   ├── App.vue          # Root component
│   │   ├── main.js          # Entry point
│   │   └── style.css        # Global styles
│   ├── public/              # Static assets
│   │   ├── icons/           # PWA icons
│   │   ├── manifest.json    # PWA manifest
│   │   └── sw.js           # Service worker
│   └── index.html           # HTML template
├── server/                   # Backend (Node.js)
│   ├── server.js            # Main server file
│   ├── database.js          # Database connection & queries
│   └── setup.js             # Database setup & migrations
├── database/                 # Database files
│   ├── migrations/          # SQL migration files
│   ├── schema.sql           # Database schema
│   ├── push-subscriptions.sql # Push notification setup
│   └── seed-data.json       # Demo/test data
├── config/                   # Configuration files
│   ├── vite.config.js       # Vite configuration
│   ├── tailwind.config.js   # Tailwind CSS configuration
│   └── postcss.config.js    # PostCSS configuration
├── docs/                     # Documentation
│   ├── deployment/          # Deployment guides
│   ├── setup/               # Setup guides
│   ├── screenshots/         # Documentation images
│   └── DOCKER-DEVELOPMENT.md # Docker development guide
├── deployment/               # Deployment files
│   ├── dev/                 # Development environment
│   │   ├── docker-compose.dev.yml # Docker development setup
│   │   ├── Dockerfile.dev   # Development Docker image
│   │   └── .dockerignore    # Build exclusions
│   └── prod/                # Production environment
│       ├── docker-compose.yml # Production Docker setup
│       ├── Dockerfile       # Production Docker image
│       ├── .dockerignore    # Build exclusions
│       ├── railway.json     # Railway deployment config
│       └── start-production.sh # Production startup script
├── scripts/                  # Development scripts
│   ├── setup-dev.sh         # Docker setup script
│   ├── dev-logs.sh          # View logs
│   ├── dev-stop.sh          # Stop services
│   └── dev-reset.sh         # Reset environment
└── legacy/                   # Legacy/debug files
    ├── server-legacy.js     # Old server implementation
    ├── index-legacy.html    # Legacy HTML file
    └── notifications-debug.html # Debug page
```

## Tech Stack

- **Frontend**: Vue.js 3, Vite, Tailwind CSS, Pinia
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **PWA**: Service Worker, Web Push Notifications
- **Development**: Docker, Docker Compose
- **Deployment**: Railway, Docker

## Getting Started

### Option 1: Docker Development Environment (Recommended)

**Quick Start:**
```bash
# Clone the repository
git clone <repository-url>
cd dashboard

# Start complete development environment with database
npm run docker:setup
```

This provides:
- ✅ PostgreSQL database with automatic migrations
- 🔥 Hot reloading for both frontend and backend
- 🐳 Isolated environment with Docker
- 📊 Dashboard at http://localhost:3001

See [Docker Development Guide](docs/DOCKER-DEVELOPMENT.md) for details.

### Option 2: Local Development

**Prerequisites:**
- Node.js >= 16.0.0
- PostgreSQL database running locally
- npm or yarn

**Installation:**
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.development .env.local
# Edit .env.local with your database credentials

# Set up the database
npm run db:migrate

# Start development servers
npm run dev
```

## Available Scripts

### Development
- `npm run dev` - Start development (both client and server)
- `npm run server` - Start server only (development)
- `npm run client` - Start client only (development)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Database
- `npm run db:migrate` - Run database migrations
- `npm run db:status` - Check migration status
- `npm run db:test` - Test database connection

### Docker Development
- `npm run docker:setup` - Setup and start Docker environment
- `npm run docker:start` - Start Docker services
- `npm run docker:stop` - Stop Docker services
- `npm run docker:logs` - View Docker logs
- `npm run docker:shell` - Access application shell
- `npm run docker:db` - Access PostgreSQL shell
- `npm run docker:reset` - Reset environment (deletes all data!)

### Production
- `npm start` - Start production server

## Development

The project uses a clean separation between frontend and backend:

- **Client**: Vue.js SPA with Vite for fast development
- **Server**: Express.js API with PostgreSQL integration
- **Database**: Migration-based schema management

### Docker Development

The Docker environment provides:
- **PostgreSQL 15** with automatic schema setup
- **Hot reloading** for both frontend and backend
- **Automatic migrations** on startup
- **Isolated environment** with proper networking

### Local Development

For local development without Docker:
1. Install PostgreSQL and create database
2. Set up environment variables
3. Run migrations
4. Start development servers

## Documentation

- [Docker Development Guide](docs/DOCKER-DEVELOPMENT.md)
- [PostgreSQL Setup](docs/README-POSTGRES.md)
- [Production Setup](docs/setup/PRODUCTION-SETUP.md)
- [PWA Setup](docs/setup/PWA-SETUP.md)
- [Railway Deployment](docs/deployment/RAILWAY-DEPLOYMENT.md)
- [General Deployment](docs/deployment/DEPLOYMENT.md)

## Features

- Real-time analytics dashboard
- User authentication and authorization
- Push notifications
- PWA support
- Responsive design
- PostgreSQL backend with migrations
- Docker support

## License

MIT License# Trigger redeploy
