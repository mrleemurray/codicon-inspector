# Contributing to Codicon Inspector

Thank you for your interest in contributing to the Codicon Inspector extension! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

1. **Search Existing Issues**: Before creating a new issue, please search existing issues to avoid duplicates
2. **Use Issue Templates**: Use the provided templates for bug reports and feature requests
3. **Provide Details**: Include as much relevant information as possible:
   - VS Code version
   - Extension version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### Suggesting Features

We welcome feature suggestions! Please:

1. Check if the feature already exists or is planned
2. Explain the use case and why it would be valuable
3. Consider backward compatibility
4. Be open to discussion and iteration

### Development Setup

#### Prerequisites

- **Node.js** 16 or higher
- **VS Code** 1.80.0 or higher
- **Git**

#### Setup Process

```bash
# Fork and clone the repository
git clone https://github.com/your-username/codicon-inspector.git
cd codicon-inspector

# Install dependencies
npm install

# Build the extension
npm run compile

# Start development
npm run watch
```

#### Testing Your Changes

1. **Open in VS Code**: Open the project in VS Code
2. **Launch Extension**: Press `F5` to open Extension Development Host
3. **Test Features**: Run "Show Codicons Inspector" command in the new window
4. **Verify Changes**: Test your modifications thoroughly

### Code Style and Standards

#### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

#### Code Formatting

- Use 4 spaces for indentation
- Follow existing code style
- Run `npm run lint` before committing

#### Git Workflow

1. **Create Feature Branch**: `git checkout -b feature/your-feature-name`
2. **Make Changes**: Implement your changes with clear commits
3. **Test Thoroughly**: Ensure all functionality works
4. **Update Documentation**: Update README/CHANGELOG as needed
5. **Submit PR**: Create a pull request with detailed description

### Pull Request Guidelines

#### Before Submitting

- [ ] Code compiles without errors (`npm run compile`)
- [ ] All existing functionality still works
- [ ] New features are tested
- [ ] Documentation is updated
- [ ] Commit messages are clear and descriptive

#### PR Description Should Include

- **What**: Brief description of changes
- **Why**: Motivation for the changes
- **How**: Technical approach used
- **Testing**: How you tested the changes
- **Screenshots**: If UI changes are involved

### Architecture Overview

#### Key Components

```
src/
├── extension.ts          # Main extension entry point
│   ├── activate()        # Extension activation
│   ├── createWebviewPanel() # Webview management
│   ├── extractCodicons() # Icon discovery logic
│   └── CSS/HTML generation
└── test/                 # Test files
```

#### Important Functions

- **`_extractCodiconsFromCSS()`**: Parses CSS to find codicon definitions
- **`_convertToTtfFonts()`**: Optimizes CSS for TTF font loading
- **`_fixCssResourcePaths()`**: Resolves font file paths
- **WebView HTML Generation**: Creates the interactive interface

#### Extension Points

- **Commands**: Defined in `package.json` contributes section
- **Configuration**: Settings for local codicons path
- **Keybindings**: Keyboard shortcuts for quick access

### Development Tips

#### Debugging

1. **Use Console**: Add `console.log()` statements in webview code
2. **VS Code Debugger**: Use built-in debugger for extension code
3. **Developer Tools**: Right-click in webview → "Inspect" for browser devtools

#### Testing Local Codicons

1. Set up a local codicons repository
2. Configure the extension to use your local path
3. Test refresh functionality with changes

#### Performance Considerations

- The extension loads ~500 icons, so optimize rendering
- Use efficient CSS selectors
- Minimize DOM manipulation
- Consider lazy loading for large datasets

### Release Process

#### Version Management

- Follow [Semantic Versioning](https://semver.org/)
- Update `package.json` version
- Update `CHANGELOG.md` with changes
- Create git tag for releases

#### Publishing

1. **Test thoroughly** in clean environment
2. **Update documentation** as needed
3. **Package extension**: `npm run package`
4. **Create release** with detailed notes

### Getting Help

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Report bugs via GitHub Issues
- **Documentation**: Refer to VS Code Extension API docs

### Recognition

Contributors will be recognized in:

- `CHANGELOG.md` for significant contributions  
- GitHub contributors list
- Release notes for major features

Thank you for helping make Codicon Inspector better for the VS Code community! 🎉