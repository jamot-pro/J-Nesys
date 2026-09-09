#!/bin/bash
# Automated debugging flow using Chrome DevTools MCP

cd "/Users/macos/Downloads/J-01"

# Kill old instances
pkill -f "chrome-devtools-mcp" 2>/dev/null || true
sleep 2

echo "=== Running Debug Flow ==="
echo ""

# Start MCP
npx -y chrome-devtools-mcp@latest --slim --headless --no-sandbox &
MCP_PID=$!
sleep 5

# Test navigation and capture logs
curl -X POST http://localhost:3000/messages \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "navigate_page",
      "arguments": {"url": "https://api.jamot.pro"}
    }
  }' 2>/dev/null | head -c 2000

echo ""
echo ""
echo "Waiting for page load..."
sleep 3

# Get console errors
curl -X POST http://localhost:3000/messages \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_console_messages",
      "arguments": {"type": "error"}
    }
  }' 2>/dev/null | head -c 2000

echo ""
echo ""
echo "Network requests:"
curl -X POST http://localhost:3000/messages \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_network_requests",
      "arguments": {}
    }
  }' 2>/dev/null | head -c 2000

echo ""
echo "Debug complete!"
pkill -f "chrome-devtools-mcp" 2>/dev/null || true
