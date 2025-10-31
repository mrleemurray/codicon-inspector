# Codicon Inspector 

A comprehensive VS Code extension for inspecting and visualizing all available codicons with multi-size rendering and flexible search capabilities.

## ✨ Features

- **Complete Codicon Library**: Display all ~500 available VS Code codicons
- **Multi-Size Visualization**: View each icon at 11px, 14px, 16px, and 24px sizes
- **Intelligent Search**: Flexible search with space/dash interchangeability (`chat sparkle` finds `chat-sparkle`)
- **One-Click Copy**: Click any icon to copy its HTML code snippet (`<i class="codicon codicon-icon-name"></i>`)
- **Local Development Support**: Configure path to local codicons repository for development
- **TTF Font Optimization**: Optimized for TTF font loading and rendering
- **Real-Time Updates**: Refresh capability to see latest codicon changes

## 🚀 Usage

### Quick Start
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **"Show Codicons Inspector"**
3. Browse, search, and click to copy codicons!

### Keyboard Shortcut
- **Windows/Linux**: `Ctrl+Alt+I`
- **macOS**: `Cmd+Alt+I`

### Search Examples
- `home` → finds home icon
- `chat sparkle` → finds chat-sparkle icon
- `file text` → finds file-text icon
- `search` → finds all search-related icons

## ⚙️ Configuration

### Local Codicons Development

Perfect for codicons developers and contributors:

1. **Open Settings**: `File > Preferences > Settings`
2. **Search**: "Codicon Inspector"
3. **Set Path**: Point "Local Codicons Path" to your codicons repository
   ```
   Example: /Users/yourname/codicons/dist
   ```

This enables:
- Testing unreleased codicons
- Development workflow integration
- Real-time icon updates during development

## 🛠️ Development

### Prerequisites
- Node.js 16+
- VS Code 1.80+
- Git

### Setup
```bash
# Clone and setup
git clone https://github.com/mrleemurray/codicon-inspector.git
cd codicon-inspector
npm install

# Compile
npm run compile
```

### Development Workflow
```bash
# Watch mode (recommended during development)
npm run watch

# Test the extension
# Press F5 in VS Code to launch Extension Development Host

# Package for distribution
npm run package
```

### Project Structure
```
├── src/
│   ├── extension.ts          # Main extension logic
│   └── test/                 # Test files
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## 🔧 Technical Details

### Font Loading Strategy
1. **Primary**: Local codicons repository (TTF fonts)
2. **Fallback**: Bundled `@vscode/codicons` package
3. **Smart Conversion**: Automatic CSS processing for TTF optimization

### Architecture
- **WebView Panel**: Custom HTML/CSS/JS interface
- **Dynamic Extraction**: Real-time CSS parsing for icon discovery
- **Theme Integration**: Full VS Code theme compatibility
- **Performance Optimized**: Efficient rendering for 500+ icons

### Icon Extraction Process
1. Locate codicons CSS file (local or bundled)
2. Parse CSS for `.codicon-*:before` rules
3. Extract icon names and Unicode characters
4. Generate multi-size display grid
5. Enable search and copy functionality

## 📋 Commands

| Command | Description | Keybinding |
|---------|-------------|------------|
| `codicon-inspector.showCodicons` | Show Codicons Inspector | `Ctrl+Alt+I` / `Cmd+Alt+I` |
| `codicon-inspector.refreshCodicons` | Refresh Codicons | - |

## 🎯 Use Cases

- **Web Development**: Find perfect icons for web interfaces
- **VS Code Extension Development**: Browse available icons for extensions
- **Design System Work**: Analyze icon consistency and coverage
- **Codicons Development**: Test and preview new icons
- **Documentation**: Reference icon names and usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **VS Code Team**: For the comprehensive codicons library
- **Microsoft**: For the excellent VS Code extension API
- **Community**: For feedback and contributions

---

**Made with ❤️ for VS Code developers**