#!/bin/bash

# OlaClick Analytics - Production Startup Script
# This script sets the VAPID environment variables and starts the server

echo "🚀 Starting OlaClick Analytics in Production Mode..."

# Set production environment variables
export NODE_ENV="production"
export PORT="3001"

# Set VAPID keys for push notifications
export VAPID_PUBLIC_KEY="BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM"
export VAPID_PRIVATE_KEY="dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ"
export VAPID_CONTACT_EMAIL="admin@olaclick.com"

echo "✅ Environment variables set"
echo "🔑 VAPID Public Key: ${VAPID_PUBLIC_KEY:0:8}...${VAPID_PUBLIC_KEY: -8}"
echo "🌐 Contact Email: $VAPID_CONTACT_EMAIL"
echo "🎯 Environment: $NODE_ENV"
echo "📡 Port: $PORT"
echo ""

# Start the server
echo "🔄 Starting server..."
node server.js 