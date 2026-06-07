#!/bin/bash
set -e

# Docker Compose initialization script
# Generates secure credentials if they don't exist

ENV_FILE=".env"

# Ensure KEY exists with a non-empty value in $ENV_FILE.
# Appends the key if missing, fills it in if present but empty.
#   $1 = key name, $2 = value to use when the key is missing/empty
ensure_var() {
    local key="$1"
    local value="$2"

    # Already set with a non-empty value -> leave it alone
    if grep -qE "^${key}=.+" "$ENV_FILE" 2>/dev/null; then
        return
    fi

    if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
        # Present but empty -> fill in the value
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
        echo "   • Set empty ${key}"
    else
        # Missing entirely -> append it
        printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
        echo "   • Added missing ${key}"
    fi
}

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

    # An existing .env may predate Docker support (e.g. a dev file with only
    # DATABASE_URL). Ensure the variables docker-compose.yml requires are present.
    echo "🔧 Ensuring Docker Compose credentials are set..."
    ensure_var POSTGRES_USER postgres
    ensure_var POSTGRES_PASSWORD "$(openssl rand -hex 32)"
    ensure_var POSTGRES_DB wytui
    ensure_var AUTH_SECRET "$(openssl rand -hex 32)"
fi

# Final safety net: refuse to start with empty required credentials
if grep -qE "^POSTGRES_PASSWORD=$" "$ENV_FILE" 2>/dev/null || grep -qE "^AUTH_SECRET=$" "$ENV_FILE" 2>/dev/null; then
    echo "⚠️  WARNING: Empty credentials detected in $ENV_FILE"
    echo "   Please set POSTGRES_PASSWORD and AUTH_SECRET"
    exit 1
fi

echo "🚀 Starting Docker Compose..."
if [ $# -eq 0 ]; then
    docker compose up --build
else
    docker compose "$@"
fi
