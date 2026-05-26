#!/bin/bash
set -e

# Docker Compose initialization script
# Generates secure credentials if they don't exist

ENV_FILE=".env"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 No .env file found. Generating secure credentials..."

    # Generate secure random secrets
    POSTGRES_PASSWORD=$(openssl rand -hex 32)
    AUTH_SECRET=$(openssl rand -hex 32)

    # Create .env file
    cat > "$ENV_FILE" << EOF
# Auto-generated secure credentials
# Generated: $(date)
# DO NOT commit this file to git

POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=wytui
AUTH_SECRET=$AUTH_SECRET

# Optional: Override these for custom configuration
# ORIGIN=http://localhost:3000
# ADMIN_USERNAME=admin@example.com
# ADMIN_PASSWORD=your-secure-password
EOF

    echo "✅ Created $ENV_FILE with secure random credentials"
    echo ""
    echo "⚠️  IMPORTANT: Save this file securely! You'll need it to access your data."
    echo "   Location: $(pwd)/$ENV_FILE"
    echo ""
else
    echo "✅ Using existing $ENV_FILE"
fi

# Check if credentials are set
if grep -q "POSTGRES_PASSWORD=$" "$ENV_FILE" 2>/dev/null || grep -q "AUTH_SECRET=$" "$ENV_FILE" 2>/dev/null; then
    echo "⚠️  WARNING: Empty credentials detected in $ENV_FILE"
    echo "   Please set POSTGRES_PASSWORD and AUTH_SECRET"
    exit 1
fi

echo "🚀 Starting Docker Compose..."
docker compose "$@"
