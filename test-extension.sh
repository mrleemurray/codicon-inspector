#!/bin/bash

# Test script for Codicon Inspector Extension

echo "🔍 Codicon Inspector Extension"
echo "============================="
echo ""

# Check if compiled files exist
if [ -f "out/extension.js" ]; then
    echo "✅ Extension compiled successfully"
    echo "   - Main file: out/extension.js"
else
    echo "❌ Extension not compiled. Run 'npm run compile' first."
    exit 1
fi

# Check package.json structure
if [ -f "package.json" ]; then
    echo "✅ Package.json found"
    
    # Check for required fields
    if grep -q '"contributes"' package.json; then
        echo "   - Commands and contributions defined"
    fi
    
    if grep -q '"codicon-inspector.showCodicons"' package.json; then
        echo "   - Main command registered"
    fi
else
    echo "❌ Package.json missing"
    exit 1
fi

echo ""
echo "🚀 Extension ready for testing!"
echo ""
echo "To test the extension:"
echo "1. Open VS Code"
echo "2. Go to Extensions view (Ctrl+Shift+X)"
echo "3. Click '...' menu → 'Install from VSIX...'"
echo "4. Or press F5 in this project to launch Extension Development Host"
echo ""
echo "Commands available:"
echo "- 'Show Codicons Inspector' (Ctrl+Alt+I / Cmd+Alt+I)"
echo ""
echo "The extension will display all available codicons in a searchable grid."
echo "Click any codicon to copy its syntax to clipboard."