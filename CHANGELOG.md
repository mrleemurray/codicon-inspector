# Changelog

All notable changes to the Codicon Inspector extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-10-14

### Added

#### Core Features
- **Multi-Size Display**: View each codicon at 11px, 14px, 16px, and 24px sizes for comprehensive visualization
- **Complete Icon Library**: Display all ~500 available VS Code codicons in a responsive grid layout
- **Intelligent Search**: Flexible search functionality with space/dash interchangeability (`chat sparkle` finds `chat-sparkle`)
- **One-Click Copy**: Click any icon to copy HTML code snippet format (`<i class="codicon codicon-icon-name"></i>`)

#### Development Support
- **Local Codicons Integration**: Configure path to local codicons repository for development workflow
- **TTF Font Optimization**: Prioritized TTF font loading with automatic CSS conversion
- **Real-Time Refresh**: Manual refresh capability to see latest codicon changes during development
- **Dynamic Icon Extraction**: Smart CSS parsing to discover and display all available icons

#### User Experience
- **VS Code Theme Integration**: Full compatibility with all VS Code themes and color schemes
- **Responsive Grid Layout**: Adaptive layout that works across different panel sizes
- **Search Statistics**: Real-time display of total and filtered codicon counts
- **Keyboard Shortcuts**: Quick access via `Ctrl+Alt+I` / `Cmd+Alt+I`

#### Technical Implementation
- **WebView Panel**: Custom HTML/CSS/JS interface with VS Code integration
- **Font Resolution**: Intelligent font loading with local/bundled fallback system
- **CSS Embedding**: Security-compliant CSS embedding for webview compatibility
- **Error Handling**: Comprehensive error handling and fallback mechanisms

### Technical Details
- Built with TypeScript and VS Code Extension API
- Supports VS Code 1.80.0 and higher
- Optimized for performance with 500+ icon rendering
- Cross-platform compatibility (Windows, macOS, Linux)

### Configuration Options
- `codicon-inspector.localCodiconsPath`: Path to local codicons development folder
- `codicon-inspector.enableAutoRefresh`: Automatic refresh on file changes (future feature)

### Commands
- `codicon-inspector.showCodicons`: Opens the Codicon Inspector panel
- `codicon-inspector.refreshCodicons`: Refreshes the codicon display

### Initial Release Notes
This is the initial release of Codicon Inspector, developed as a comprehensive tool for VS Code extension developers, theme creators, and anyone working with the VS Code codicons library. The extension provides a complete visual reference with practical development features.