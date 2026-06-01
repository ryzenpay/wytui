#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Docker-based test suite for wytui...${NC}\n"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    docker-compose down
}
trap cleanup EXIT

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Build and start services
echo -e "${GREEN}Step 1/6: Building Docker images...${NC}"
docker-compose build --no-cache

echo -e "${GREEN}Step 2/6: Starting services...${NC}"
docker-compose up -d

# Wait for PostgreSQL to be ready
echo -e "${GREEN}Step 3/6: Waiting for PostgreSQL...${NC}"
max_attempts=30
attempt=0
until docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}Error: PostgreSQL failed to start within ${max_attempts} seconds${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Wait for app to be healthy
echo -e "${GREEN}Step 4/6: Waiting for app to be healthy...${NC}"
max_attempts=60
attempt=0
until curl -f http://localhost:3000/api/health > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}Error: App failed to start within ${max_attempts} seconds${NC}"
        echo -e "${YELLOW}App logs:${NC}"
        docker-compose logs app | tail -50
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Seed test data
echo -e "${GREEN}Step 5/6: Seeding test database...${NC}"
docker-compose exec -T app npm run db:seed || {
    echo -e "${YELLOW}Warning: Failed to seed database (may not exist). Continuing...${NC}"
}

# Run tests
echo -e "${GREEN}Step 6/6: Running tests...${NC}\n"

# Unit tests
echo -e "${YELLOW}Running unit tests...${NC}"
npm test
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Unit tests passed${NC}\n"
else
    echo -e "${RED}✗ Unit tests failed${NC}\n"
    exit 1
fi

# Install Playwright browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo -e "${YELLOW}Installing Playwright browsers (first time only)...${NC}"
    npx playwright install --with-deps
fi

# Integration tests
echo -e "${YELLOW}Running integration tests...${NC}"
export APP_URL=http://localhost:3000
npm run test:integration
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Integration tests passed${NC}\n"
else
    echo -e "${RED}✗ Integration tests failed${NC}\n"
    echo -e "${YELLOW}App logs:${NC}"
    docker-compose logs app | tail -100
    exit 1
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}All tests passed successfully! 🎉${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Optionally keep services running
if [ "$KEEP_RUNNING" = "1" ]; then
    echo -e "${YELLOW}Services are still running. Use 'docker-compose down' to stop them.${NC}"
    trap - EXIT  # Disable cleanup
else
    echo -e "${YELLOW}Stopping services...${NC}"
fi
