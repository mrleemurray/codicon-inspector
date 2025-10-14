# Local Codicons Setup Guide

## Overview
The Codicon Inspector extension now supports loading codicons from your local codicons repository, allowing you to test your design updates in real-time.

## Configuration

### 1. Settings
Open VS Code settings and configure:

```json
{
  "codicon-inspector.localCodiconsPath": "/path/to/your/codicons/dist",
  "codicon-inspector.enableAutoRefresh": false
}
```

### 2. Setting the Local Path
You can set the local codicons path in several ways:

**Via Settings UI:**
1. Open Settings (`Cmd/Ctrl + ,`)
2. Search for "codicon inspector"
3. Set "Local Codicons Path" to your local codicons folder

**Via Settings JSON:**
1. Open Settings JSON (`Cmd/Ctrl + Shift + P` → "Preferences: Open Settings (JSON)")
2. Add the configuration above

**Example Paths (Folder):**
- macOS: `/Users/username/codicons/dist`
- Windows: `C:\\Users\\username\\codicons\\dist`
- Linux: `/home/username/codicons/dist`

**Example Paths (CSS File - also supported):**
- macOS: `/Users/username/codicons/dist/codicon.css`
- Windows: `C:\\Users\\username\\codicons\\dist\\codicon.css`
- Linux: `/home/username/codicons/dist/codicon.css`

## Usage

### 1. Open Inspector
- Command Palette: "Show Codicons Inspector"
- Keyboard: `Ctrl/Cmd + Alt + I`

### 2. Verify Source
The inspector header will show:
- "Bundled" - Using npm package codicons
- "Local: codicon.css" - Using your local file

### 3. Refresh Changes
When you update your local codicons:
- Click the "Refresh" button in the inspector
- Or run "Refresh Codicons" from Command Palette
- Or close/reopen the inspector

## Development Workflow

### 1. Setup Your Codicons Repo
```bash
cd /path/to/your/codicons
npm install
npm run build  # Generates dist/codicon.css
```

### 2. Configure Inspector
Set the path to your built codicons folder:
```
/path/to/your/codicons/dist
```

### 3. Test Changes
1. Make changes to your codicon designs
2. Build your codicons repo (`npm run build`)
3. Click "Refresh" in the inspector
4. See your changes immediately

## Benefits

### Real-time Testing
- See your design changes instantly
- No need to publish packages
- Test before committing changes

### Visual Comparison
- Compare old vs new designs
- Spot inconsistencies across icons
- Verify SVG rendering quality

### Design Validation
- Ensure icons work in VS Code themes
- Test icon scaling and spacing
- Validate accessibility and contrast

## Troubleshooting

### Path Issues
- Use absolute paths (not relative)
- Ensure the CSS file exists
- Check file permissions

### Icons Not Loading
- Verify the CSS file is valid
- Check browser dev tools for errors
- Try the refresh button
- Fallback to bundled version automatically

### File Watching (Future)
Currently manual refresh is required. Future versions may include:
- Automatic file watching
- Hot reload capability
- Build integration

## Commands Available

- `codicon-inspector.showCodicons` - Open the inspector
- `codicon-inspector.refreshCodicons` - Refresh current panel

## Settings Reference

```json
{
  "codicon-inspector.localCodiconsPath": {
    "type": "string",
    "default": "",
    "description": "Path to local codicons CSS file"
  },
  "codicon-inspector.enableAutoRefresh": {
    "type": "boolean", 
    "default": false,
    "description": "Auto-refresh when local file changes"
  }
}
```