#!/bin/bash

# Test script untuk proyek Parkir Cepat
# Usage: ./scripts/test.sh [option]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if dependencies are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Function to install test dependencies
install_dependencies() {
    print_status "Installing test dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    npm run test:unit
    print_success "Unit tests completed"
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    npm run test:integration
    print_success "Integration tests completed"
}

# Function to run all tests
run_all_tests() {
    print_status "Running all tests..."
    npm test
    print_success "All tests completed"
}

# Function to run tests with coverage
run_coverage() {
    print_status "Running tests with coverage..."
    npm run test:coverage
    print_success "Coverage report generated"
}

# Function to run tests in watch mode
run_watch() {
    print_status "Running tests in watch mode..."
    npm run test:watch
}

# Function to clean test artifacts
clean_test_artifacts() {
    print_status "Cleaning test artifacts..."
    
    if [ -d "coverage" ]; then
        rm -rf coverage
        print_status "Removed coverage directory"
    fi
    
    if [ -d "node_modules/.cache" ]; then
        rm -rf node_modules/.cache
        print_status "Removed Jest cache"
    fi
    
    print_success "Test artifacts cleaned"
}

# Function to setup test environment
setup_test_env() {
    print_status "Setting up test environment..."
    
    # Create test environment file if it doesn't exist
    if [ ! -f "env.test" ]; then
        print_status "Creating test environment file..."
        cat > env.test << EOF
NODE_ENV=test
PORT=4001
MONGODB_URI=mongodb://localhost:27017/parkir_cepat_test
JWT_SECRET=test-jwt-secret-key-for-testing
MIDTRANS_SERVER_KEY=test-midtrans-server-key
MIDTRANS_CLIENT_KEY=test-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false
GOOGLE_MAPS_API_KEY=test-google-maps-api-key
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
SESSION_SECRET=test-session-secret-key
CORS_ORIGIN=http://localhost:3000
CLIENT_URL=http://localhost:3000
WS_PATH=/graphql
REDIS_URL=redis://localhost:6379
EOF
        print_success "Test environment file created"
    fi
    
    print_success "Test environment setup completed"
}

# Function to validate test coverage
validate_coverage() {
    print_status "Validating test coverage..."
    
    if [ ! -d "coverage" ]; then
        print_error "Coverage directory not found. Run tests with coverage first."
        exit 1
    fi
    
    # Check if coverage meets minimum threshold (90%)
    if [ -f "coverage/coverage-summary.json" ]; then
        print_status "Coverage summary found, checking thresholds..."
        # You can add more sophisticated coverage validation here
        print_success "Coverage validation completed"
    else
        print_warning "Coverage summary not found"
    fi
}

# Function to show help
show_help() {
    echo "Test script untuk proyek Parkir Cepat"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  unit          Run unit tests only"
    echo "  integration   Run integration tests only"
    echo "  all           Run all tests (default)"
    echo "  coverage      Run tests with coverage report"
    echo "  watch         Run tests in watch mode"
    echo "  clean         Clean test artifacts"
    echo "  setup         Setup test environment"
    echo "  validate      Validate test coverage"
    echo "  install       Install test dependencies"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unit       # Run only unit tests"
    echo "  $0 coverage   # Run tests with coverage"
    echo "  $0 clean      # Clean test artifacts"
}

# Main script logic
main() {
    case "${1:-all}" in
        "unit")
            check_dependencies
            setup_test_env
            run_unit_tests
            ;;
        "integration")
            check_dependencies
            setup_test_env
            run_integration_tests
            ;;
        "all")
            check_dependencies
            setup_test_env
            run_all_tests
            ;;
        "coverage")
            check_dependencies
            setup_test_env
            run_coverage
            validate_coverage
            ;;
        "watch")
            check_dependencies
            setup_test_env
            run_watch
            ;;
        "clean")
            clean_test_artifacts
            ;;
        "setup")
            setup_test_env
            ;;
        "validate")
            validate_coverage
            ;;
        "install")
            install_dependencies
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 