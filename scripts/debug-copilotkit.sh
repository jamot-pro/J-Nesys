#!/bin/bash
# Debug CopilotKit 404 using Chrome DevTools MCP

set -e
cd "/Users/macos/Downloads/J-01"

echo "=== CopilotKit Debug Session ==="
echo "This will launch Chrome with DevTools and MCP server for debugging."
echo ""

# Kill existing instances
pkill -f "chrome-devtools-mcp" 2>/dev/null || true
sleep 2

echo "Starting Chrome DevTools MCP Server (port 3000)..."

# Start MCP server in background
npx -y chrome-devtools-mcp@latest --slim --headless --disable-gpu &
MCP_PID=$!
echo "MCP PID: $MCP_PID"
echo "Server available at http://localhost:3000"
echo ""
echo "To debug, connect to the MCP endpoint:"
echo "  curl http://localhost:3000/tools          # List tools"
echo "  curl http://localhost:3000/messages       # Send messages"
echo ""
echo "Or use our integrated workflow:"
echo "  ./scripts/debug-flow.sh                  # Automated debugging"
echo ""

wait $MCP_PID 2>/dev/null || echo "MCP server exited"
