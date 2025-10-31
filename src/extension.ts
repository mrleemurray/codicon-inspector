import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const showCommand = vscode.commands.registerCommand('codicon-inspector.showCodicons', () => {
        CodiconInspectorPanel.createOrShow(context.extensionUri);
    });

    const refreshCommand = vscode.commands.registerCommand('codicon-inspector.refreshCodicons', () => {
        if (CodiconInspectorPanel.currentPanel) {
            CodiconInspectorPanel.currentPanel.refresh();
        } else {
            vscode.window.showInformationMessage('No Codicon Inspector panel is currently open.');
        }
    });

    context.subscriptions.push(showCommand, refreshCommand);
}

export function deactivate() {}

class CodiconInspectorPanel {
    public static currentPanel: CodiconInspectorPanel | undefined;
    public static readonly viewType = 'codiconInspector';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CodiconInspectorPanel.currentPanel) {
            CodiconInspectorPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Get local codicons path from settings
        const config = vscode.workspace.getConfiguration('codicon-inspector');
        const localCodiconsPath = config.get<string>('localCodiconsPath', '');

        const localResourceRoots: vscode.Uri[] = [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons'),
            vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/webview-ui-toolkit')
        ];
        
        // Add local codicons directory to resource roots if specified
        if (localCodiconsPath && fs.existsSync(localCodiconsPath)) {
            // Check if it's a directory or file
            const stats = fs.statSync(localCodiconsPath);
            if (stats.isDirectory()) {
                // It's a directory, add it and parent for font access
                localResourceRoots.push(vscode.Uri.file(localCodiconsPath));
                const parentDir = path.dirname(localCodiconsPath);
                if (parentDir !== localCodiconsPath) {
                    localResourceRoots.push(vscode.Uri.file(parentDir));
                }
            } else {
                // It's a file, add its directory
                const localDir = path.dirname(localCodiconsPath);
                localResourceRoots.push(vscode.Uri.file(localDir));
                const parentDir = path.dirname(localDir);
                if (parentDir !== localDir) {
                    localResourceRoots.push(vscode.Uri.file(parentDir));
                }
            }
        }

        const panel = vscode.window.createWebviewPanel(
            CodiconInspectorPanel.viewType,
            'Codicon Inspector',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: localResourceRoots
            }
        );

        CodiconInspectorPanel.currentPanel = new CodiconInspectorPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this.refresh();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public refresh() {
        this._update();
    }

    public dispose() {
        CodiconInspectorPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getBundledCodiconCSS(): string {
        try {
            const bundledCssPath = path.join(this._extensionUri.fsPath, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css');
            return fs.readFileSync(bundledCssPath, 'utf8');
        } catch (error) {
            console.error('Failed to read bundled codicons CSS:', error);
            // Return minimal fallback CSS
            return `
                .codicon {
                    font-family: "codicon";
                    font-size: inherit;
                    font-style: normal;
                    font-variant: normal;
                    font-weight: normal;
                    line-height: 1;
                    text-decoration: none;
                    text-rendering: auto;
                    text-transform: none;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    user-select: none;
                    -webkit-user-select: none;
                    -ms-user-select: none;
                }
            `;
        }
    }

    private _fixCssResourcePaths(cssContent: string, cssFilePath: string): string {
        const cssDir = path.dirname(cssFilePath);
        
        // Replace relative font paths with webview URIs
        return cssContent.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (match, relativePath) => {
            if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
                // Already absolute or data URL, keep as is
                return match;
            }
            
            try {
                let absolutePath = path.resolve(cssDir, relativePath);
                
                // If the file doesn't exist, try looking in common font directories
                if (!fs.existsSync(absolutePath)) {
                    const fontDirs = [
                        cssDir, // Same directory as CSS
                        path.join(cssDir, 'fonts'), // fonts subdirectory
                        path.join(cssDir, '..', 'fonts'), // fonts in parent
                        path.join(cssDir, 'assets'), // assets subdirectory
                    ];
                    
                    const filename = path.basename(relativePath);
                    const nameWithoutExt = path.parse(filename).name;
                    
                    // Try to find the file, preferring TTF format
                    for (const fontDir of fontDirs) {
                        // First try exact filename
                        let testPath = path.join(fontDir, filename);
                        if (fs.existsSync(testPath)) {
                            absolutePath = testPath;
                            break;
                        }
                        
                        // If not found and original isn't TTF, try TTF version
                        if (!filename.endsWith('.ttf')) {
                            testPath = path.join(fontDir, nameWithoutExt + '.ttf');
                            if (fs.existsSync(testPath)) {
                                absolutePath = testPath;
                                console.log(`Using TTF instead: ${filename} -> ${nameWithoutExt}.ttf`);
                                break;
                            }
                        }
                        
                        // Try common TTF filenames for codicons
                        const commonTtfNames = [
                            'codicon.ttf',
                            'codicons.ttf', 
                            'vscode-codicons.ttf',
                            `${nameWithoutExt}.ttf`
                        ];
                        
                        for (const ttfName of commonTtfNames) {
                            testPath = path.join(fontDir, ttfName);
                            if (fs.existsSync(testPath)) {
                                absolutePath = testPath;
                                console.log(`Found TTF font: ${ttfName}`);
                                break;
                            }
                        }
                        
                        if (fs.existsSync(absolutePath)) break;
                    }
                }
                
                if (fs.existsSync(absolutePath)) {
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(absolutePath));
                    console.log(`Font resolved: ${relativePath} -> ${absolutePath}`);
                    return `url('${webviewUri}')`;
                } else {
                    console.warn(`Font file not found: ${relativePath} (resolved to ${absolutePath})`);
                }
            } catch (error) {
                console.warn('Failed to resolve CSS resource path:', relativePath, error);
            }
            
            // Return original if resolution fails
            return match;
        });
    }

    private _getHtmlForWebview(): string {
        
        // Get local codicons path from settings
        const config = vscode.workspace.getConfiguration('codicon-inspector');
        const localCodiconsPath = config.get<string>('localCodiconsPath', '');
        
        let cssContent = '';
        let cssSource = 'bundled';
        
        // Use local codicons if path is specified and exists
        if (localCodiconsPath && fs.existsSync(localCodiconsPath)) {
            try {
                const cssFilePath = this._findCssFile(localCodiconsPath);
                if (cssFilePath) {
                    let rawCssContent = fs.readFileSync(cssFilePath, 'utf8');
                    // Convert CSS to use TTF files specifically
                    rawCssContent = this._convertToTtfFonts(rawCssContent, path.dirname(cssFilePath));
                    // Fix relative paths in CSS to work with webview
                    cssContent = this._fixCssResourcePaths(rawCssContent, cssFilePath);
                    cssSource = 'local';
                } else {
                    console.error('No CSS file found in:', localCodiconsPath);
                    cssContent = this._getBundledCodiconCSS();
                }
            } catch (error) {
                console.error('Failed to read local codicons:', error);
                // Fall back to bundled
                cssContent = this._getBundledCodiconCSS();
            }
        } else {
            cssContent = this._getBundledCodiconCSS();
        }

        // Extract codicons from CSS content
        const codicons = this._extractCodiconsFromCSS(cssContent);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Codicon Inspector</title>
    <script type="module" src="${this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/webview-ui-toolkit', 'dist', 'toolkit.js'))}"></script>
    <style>
        /* Embedded Codicon CSS */
        ${cssContent}
        
        /* Extension-specific styles */
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 0 20px 20px 20px;
            margin: 0;
        }
        
        .header {
            position: sticky;
            top: 0;
            z-index: 100;
            background-color: var(--vscode-editor-background);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            gap: 16px;
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            color: var(--vscode-titleBar-activeForeground);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .info {
            flex-grow: 1;
            display: flex;
            justify-content: flex-end;
        }
        
        .stats {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }

        .search-container {
            flex-grow: 1;
        }
        
        /* Comparison Panel Styles */
        .comparison-panel {
            position: sticky;
            top: 60px;
            z-index: 99;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 16px;
            overflow: hidden;
        }
        
        .comparison-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            user-select: none;
        }
        
        .comparison-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .comparison-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }
        
        .comparison-count {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 11px;
            min-width: 16px;
            text-align: center;
        }
        
        .comparison-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .chevron {
            transition: transform 0.2s ease;
        }
        
        .comparison-panel.collapsed .chevron {
            transform: rotate(-90deg);
        }
        
        .comparison-content {
            padding: 12px;
            max-height: 200px;
            overflow: hidden;
            transition: max-height 0.3s ease, padding 0.3s ease;
        }
        
        .comparison-panel.collapsed .comparison-content {
            max-height: 0;
            padding: 0 12px;
        }
        
        .comparison-area {
            min-height: 40px;
            border: 2px dashed var(--vscode-editorWidget-border);
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 12px;
            flex-wrap: wrap;
            position: relative;
            transition: border-color 0.2s ease, background-color 0.2s ease;
        }
        
        .comparison-area.drag-over {
            border-color: var(--vscode-focusBorder);
            background-color: var(--vscode-list-dropBackground);
        }
        
        .comparison-area.empty::before {
            content: "Drag icons here to compare (max 30 icons)";
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
        
        .comparison-icon {
            position: relative;
            cursor: grab;
            color: var(--vscode-icon-foreground);
            font-size: 16px;
            line-height: 1;
            transition: opacity 0.2s ease, transform 0.1s ease, font-size 0.1s ease;
            user-select: none;
        }
        
        .comparison-icon:hover {
            opacity: 0.7;
            transform: translateY(-1px);
        }
        
        .comparison-icon:active {
            cursor: grabbing;
        }
        
        .comparison-icon.dragging {
            opacity: 0.5;
            transform: rotate(5deg);
        }
        
        .comparison-icon.drag-over {
            transform: translateX(8px);
        }
        
        .comparison-icon-remove {
            position: absolute;
            top: -8px;
            right: -8px;
            background-color: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
            border: none;
            border-radius: 50%;
            width: 14px;
            height: 14px;
            font-size: 9px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
            line-height: 1;
        }
        
        .comparison-icon:hover .comparison-icon-remove {
            opacity: 1;
        }
        
        /* Make all size icons draggable */
        .size-icon {
            cursor: grab;
            transition: transform 0.1s ease, background-color 0.1s ease;
            border-radius: 2px;
            padding: 2px;
        }
        
        .size-icon:hover {
            background-color: var(--vscode-list-hoverBackground);
            transform: scale(1.1);
        }
        
        .size-icon:active {
            cursor: grabbing;
        }
        
        .size-icon.dragging {
            opacity: 0.5;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 12px;
        }
        
        .codicon-item {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 2px;
            padding: 12px;
            text-align: center;
            cursor: pointer;
            min-height: 90px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .codicon-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        
        .codicon-display {
            margin-bottom: 10px;
            color: var(--vscode-icon-foreground);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 10px 5px;
        }
        
        .size-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .size-sample {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        
        .size-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            min-height: 24px;
        }
        
        .size-icon.size-11 .codicon {
            font-size: 11px !important;
        }
        
        .size-icon.size-14 .codicon {
            font-size: 14px !important;
        }
        
        .size-icon.size-16 .codicon {
            font-size: 16px !important;
        }
        
        .size-icon.size-24 .codicon {
            font-size: 24px !important;
        }
        
        .size-label {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-font-family);
        }
        
        .codicon-name {
            color: var(--vscode-foreground);
            word-break: break-all;
        }
        

        
        .no-results {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            grid-column: 1 / -1;
            padding: 40px;
        }
        
        .loading {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 40px;
        }
        

        
        /* Bounding box styles */
        .show-bounding-boxes .size-icon .codicon {
            outline: 1px solid var(--vscode-editorError-foreground);
            outline-offset: 0px;
        }
        
        .show-bounding-boxes .comparison-icon {
            outline: 1px solid var(--vscode-editorError-foreground);
            outline-offset: 0px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="search-container">
            <vscode-text-field 
                placeholder="Search codicons... (e.g., 'file', 'folder', 'git')"
                id="search-input"
                style="width: 400px;">
            </vscode-text-field>
        </div>
        <div class="info">
            <div class="controls" style="display: inline-flex; align-items: center; gap: 15px;">
                <div class="info-container" style="display: flex; align-items: center; gap: 8px;">
                    <i class="codicon codicon-info" 
                       id="stats-info" 
                       style="cursor: help; color: var(--vscode-foreground);"
                       title="Displaying ${codicons.length} available codicons (${cssSource === 'local' ? 'Local: ' + path.basename(localCodiconsPath) + ' (TTF fonts)' : 'Bundled'})">
                    </i>
                </div>
                <vscode-checkbox id="bounding-box-toggle">
                    Show Bounding Boxes
                </vscode-checkbox>
                <vscode-button id="refresh-button">
                    Refresh
                </vscode-button>
            </div>
        </div>
    </div>

    <!-- Comparison Panel -->
    <div class="comparison-panel" id="comparison-panel">
        <div class="comparison-header" id="comparison-header">
            <div class="comparison-title">
                <i class="codicon codicon-compare"></i>
                Icon comparison
                <span class="comparison-count" id="comparison-count">0</span>
            </div>
            <div class="comparison-controls">
                <vscode-button appearance="icon" id="size-cycle" title="Cycle font size (16px)">
                    <i class="codicon codicon-text-size"></i>
                </vscode-button>
                <vscode-button appearance="icon" id="clear-comparison" title="Clear all icons">
                    <i class="codicon codicon-clear-all"></i>
                </vscode-button>
                <i class="codicon codicon-chevron-down chevron" id="comparison-chevron"></i>
            </div>
        </div>
        <div class="comparison-content" id="comparison-content">
            <div class="comparison-area empty" id="comparison-area">
                <!-- Comparison icons will be added here -->
            </div>
        </div>
    </div>
    
    <div class="grid" id="codicon-grid">
        ${codicons.map(codicon => `
            <div class="codicon-item" data-name="${codicon}">
                <div class="codicon-display">
                    <div class="size-row">
                        <div class="size-sample">
                            <div class="size-icon size-11" draggable="true" data-codicon="${codicon}">
                                <i class="codicon codicon-${codicon}"></i>
                            </div>
                            <span class="size-label">11px</span>
                        </div>
                        <div class="size-sample">
                            <div class="size-icon size-14" draggable="true" data-codicon="${codicon}">
                                <i class="codicon codicon-${codicon}"></i>
                            </div>
                            <span class="size-label">14px</span>
                        </div>
                        <div class="size-sample">
                            <div class="size-icon size-16" draggable="true" data-codicon="${codicon}">
                                <i class="codicon codicon-${codicon}"></i>
                            </div>
                            <span class="size-label">16px</span>
                        </div>
                        <div class="size-sample">
                            <div class="size-icon size-24" draggable="true" data-codicon="${codicon}">
                                <i class="codicon codicon-${codicon}"></i>
                            </div>
                            <span class="size-label">24px</span>
                        </div>
                    </div>
                </div>
                <div class="codicon-name">${codicon}</div>
            </div>
        `).join('')}
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const searchInput = document.getElementById('search-input');
        const codiconGrid = document.getElementById('codicon-grid');
        const allItems = Array.from(document.querySelectorAll('.codicon-item'));
        
        // Comparison functionality
        const comparisonPanel = document.getElementById('comparison-panel');
        const comparisonHeader = document.getElementById('comparison-header');
        const comparisonContent = document.getElementById('comparison-content');
        const comparisonArea = document.getElementById('comparison-area');
        const comparisonCount = document.getElementById('comparison-count');
        const comparisonChevron = document.getElementById('comparison-chevron');
        const clearButton = document.getElementById('clear-comparison');
        const sizeCycleButton = document.getElementById('size-cycle');
        
        let comparisonIcons = [];
        const MAX_COMPARISON_ICONS = 30;
        
        // Font size cycling
        const fontSizes = [11, 14, 16, 24];
        let currentSizeIndex = 2; // Start with 16px
        
        let filteredCount = allItems.length;
        
        function updateStats() {
            // Update the tooltip with current filter info
            const statsInfo = document.getElementById('stats-info');
            const totalIcons = allItems.length;
            const sourceText = '${cssSource === 'local' ? 'Local: ' + path.basename(localCodiconsPath) + ' (TTF fonts)' : 'Bundled'}';
            
            if (filteredCount === totalIcons) {
                statsInfo.title = \`Displaying \${totalIcons} available codicons (\${sourceText})\`;
            } else {
                statsInfo.title = \`Showing \${filteredCount} of \${totalIcons} codicons (filtered) - Source: \${sourceText}\`;
            }
        }
        
        function updateComparisonCount() {
            comparisonCount.textContent = comparisonIcons.length;
            
            if (comparisonIcons.length === 0) {
                comparisonArea.classList.add('empty');
            } else {
                comparisonArea.classList.remove('empty');
            }
        }
        
        function addToComparison(iconName) {
            if (comparisonIcons.length >= MAX_COMPARISON_ICONS) {
                console.warn('Maximum comparison icons reached');
                return false;
            }
            
            if (comparisonIcons.includes(iconName)) {
                console.warn('Icon already in comparison');
                return false;
            }
            
            comparisonIcons.push(iconName);
            renderComparisonArea();
            updateComparisonCount();
            return true;
        }
        
        function removeFromComparison(iconName) {
            const index = comparisonIcons.indexOf(iconName);
            if (index > -1) {
                comparisonIcons.splice(index, 1);
                renderComparisonArea();
                updateComparisonCount();
            }
        }
        
        function clearComparison() {
            comparisonIcons = [];
            renderComparisonArea();
            updateComparisonCount();
        }
        
        function renderComparisonArea() {
            comparisonArea.innerHTML = comparisonIcons.map((iconName, index) => \`
                <i class="codicon codicon-\${iconName} comparison-icon" 
                   data-icon="\${iconName}" 
                   data-index="\${index}"
                   title="\${iconName}" 
                   draggable="true">
                    <button class="comparison-icon-remove" onclick="removeFromComparison('\${iconName}')" title="Remove \${iconName}">
                        ×
                    </button>
                </i>
            \`).join('');
            
            // Add drag event listeners to comparison icons
            addComparisonDragListeners();
            
            // Apply current font size to new icons
            const currentSize = fontSizes[currentSizeIndex];
            document.querySelectorAll('.comparison-icon').forEach(icon => {
                icon.style.fontSize = currentSize + 'px';
            });
        }
        
        function cycleFontSize() {
            // Cycle to next font size
            currentSizeIndex = (currentSizeIndex + 1) % fontSizes.length;
            const newSize = fontSizes[currentSizeIndex];
            
            // No need to manage CSS classes anymore
            
            // Add new size class
            // Directly apply font size to all comparison icons\n            document.querySelectorAll('.comparison-icon').forEach(icon => {\n                icon.style.fontSize = newSize + 'px';\n            });
            
            // Update button tooltip
            sizeCycleButton.title = 'Cycle font size (' + newSize + 'px)';
        }
        

        
        function filterCodicons(searchTerm) {
            const term = searchTerm.toLowerCase().trim().replace(' ', '-');
            filteredCount = 0;
            
            console.log('Search term:', term);
            
            if (!term) {
                // Show all items if search is empty
                allItems.forEach(item => {
                    item.style.display = 'block';
                    filteredCount++;
                });
                updateStats();
                return;
            }
            
            // Filter items based on search term
            allItems.forEach(item => {
                const name = item.dataset.name.toLowerCase();
                let matches = false;
                
                // Try different variations of the search term
                const searchVariations = [
                    term,                           // original: "chat sparkle"
                    term.replace(/\s+/g, '-'),     // space to dash: "chat-sparkle"  
                    term.replace(/\s+/g, ''),      // no separators: "chatsparkle"
                ];
                
                // Check if any variation matches
                matches = searchVariations.some(variation => name.includes(variation));
                
                // Also check if all words in the search term appear in the name (in any order)
                if (!matches && term.includes(' ')) {
                    const searchWords = term.split(/\s+/);
                    matches = searchWords.every(word => name.includes(word));
                }
                
                if (matches) {
                    item.style.display = 'block';
                    filteredCount++;
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Show "no results" message if needed
            let noResultsMsg = document.querySelector('.no-results');
            if (filteredCount === 0 && !noResultsMsg) {
                noResultsMsg = document.createElement('div');
                noResultsMsg.className = 'no-results';
                noResultsMsg.textContent = 'No codicons found matching your search.';
                codiconGrid.appendChild(noResultsMsg);
            } else if (filteredCount > 0 && noResultsMsg) {
                noResultsMsg.remove();
            }
            
            updateStats();
        }
        
        searchInput.addEventListener('input', (e) => {
            filterCodicons(e.target.value);
        });
        
        // Collapsible panel functionality
        comparisonHeader.addEventListener('click', (e) => {
            // Don't toggle if clicking on controls
            if (e.target.closest('.comparison-controls') && !e.target.closest('.chevron')) {
                return;
            }
            comparisonPanel.classList.toggle('collapsed');
        });
        
        // Clear comparison button
        clearButton.addEventListener('click', clearComparison);
        
        // Size cycle button
        sizeCycleButton.addEventListener('click', cycleFontSize);
        
        // Drag and drop functionality
        function handleDragStart(e) {
            const iconName = e.target.closest('.size-icon').dataset.codicon;
            e.dataTransfer.setData('text/plain', iconName);
            e.target.closest('.size-icon').classList.add('dragging');
        }
        
        function handleDragEnd(e) {
            e.target.closest('.size-icon').classList.remove('dragging');
            // Also clean up comparison area drag state
            comparisonArea.classList.remove('drag-over');
            document.querySelectorAll('.comparison-icon').forEach(icon => {
                icon.classList.remove('drag-over');
            });
        }
        
        function handleDragOver(e) {
            e.preventDefault();
            comparisonArea.classList.add('drag-over');
        }
        
        function handleDragEnter(e) {
            e.preventDefault();
            comparisonArea.classList.add('drag-over');
        }
        
        function handleDragLeave(e) {
            if (!comparisonArea.contains(e.relatedTarget)) {
                comparisonArea.classList.remove('drag-over');
            }
        }
        
        function handleDrop(e) {
            e.preventDefault();
            comparisonArea.classList.remove('drag-over');
            
            // Check if this is a reordering operation
            const reorderData = e.dataTransfer.getData('text/comparison-reorder');
            if (reorderData) {
                // This is handled by handleComparisonDrop
                return;
            }
            
            // This is a new icon being added
            const iconName = e.dataTransfer.getData('text/plain');
            if (iconName) {
                addToComparison(iconName);
            }
        }
        
        // Add drag event listeners to all size icons
        document.querySelectorAll('.size-icon').forEach(icon => {
            icon.addEventListener('dragstart', handleDragStart);
            icon.addEventListener('dragend', handleDragEnd);
        });
        
        // Add drop event listeners to comparison area
        comparisonArea.addEventListener('dragover', handleDragOver);
        comparisonArea.addEventListener('dragenter', handleDragEnter);
        comparisonArea.addEventListener('dragleave', handleDragLeave);
        comparisonArea.addEventListener('drop', handleDrop);
        
        // Add mouse leave cleanup to comparison area
        comparisonArea.addEventListener('mouseleave', function(e) {
            // Clean up any stuck drag-over states when mouse leaves the comparison area
            setTimeout(() => {
                comparisonArea.classList.remove('drag-over');
                document.querySelectorAll('.comparison-icon').forEach(icon => {
                    icon.classList.remove('drag-over');
                });
            }, 50);
        });
        
        // Also add reordering drop support to the comparison area itself
        comparisonArea.addEventListener('drop', function(e) {
            // Handle reordering drops that miss individual icons
            const draggedIndexStr = e.dataTransfer.getData('text/comparison-reorder');
            if (draggedIndexStr) {
                e.preventDefault();
                e.stopPropagation();
                
                const draggedIndex = parseInt(draggedIndexStr);
                const dropX = e.clientX;
                const icons = Array.from(document.querySelectorAll('.comparison-icon'));
                
                if (icons.length > 0) {
                    // Find the insertion point based on horizontal position
                    let targetIndex = icons.length; // Default to end
                    
                    for (let i = 0; i < icons.length; i++) {
                        const rect = icons[i].getBoundingClientRect();
                        if (dropX < rect.left + rect.width / 2) {
                            targetIndex = i;
                            break;
                        }
                    }
                    
                    // Adjust target index if dragging from before the target
                    if (draggedIndex < targetIndex) {
                        targetIndex--;
                    }
                    
                    if (draggedIndex !== targetIndex && draggedIndex >= 0 && targetIndex >= 0) {
                        const draggedIcon = comparisonIcons[draggedIndex];
                        comparisonIcons.splice(draggedIndex, 1);
                        comparisonIcons.splice(targetIndex, 0, draggedIcon);
                        renderComparisonArea();
                    }
                }
                
                // Clean up
                document.querySelectorAll('.comparison-icon').forEach(icon => {
                    icon.classList.remove('drag-over', 'dragging');
                });
            }
        }, true); // Use capture phase to handle before individual icon handlers
        
        // Comparison icon reordering functions
        function addComparisonDragListeners() {
            document.querySelectorAll('.comparison-icon').forEach(icon => {
                icon.addEventListener('dragstart', handleComparisonDragStart);
                icon.addEventListener('dragend', handleComparisonDragEnd);
                icon.addEventListener('dragover', handleComparisonDragOver);
                icon.addEventListener('dragenter', handleComparisonDragEnter);
                icon.addEventListener('dragleave', handleComparisonDragLeave);
                icon.addEventListener('drop', handleComparisonDrop);
            });
        }
        
        function handleComparisonDragStart(e) {
            const draggedIcon = e.target;
            const draggedIndex = parseInt(draggedIcon.dataset.index);
            
            e.dataTransfer.setData('text/comparison-reorder', draggedIndex.toString());
            e.dataTransfer.effectAllowed = 'move';
            draggedIcon.classList.add('dragging');
            
            // Prevent event bubbling to avoid triggering main drop area
            e.stopPropagation();
        }
        
        function handleComparisonDragEnd(e) {
            e.target.classList.remove('dragging');
            // Remove drag-over class from all comparison icons and comparison area
            document.querySelectorAll('.comparison-icon').forEach(icon => {
                icon.classList.remove('drag-over');
            });
            comparisonArea.classList.remove('drag-over');
        }
        
        function handleComparisonDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            e.stopPropagation(); // Prevent triggering main comparison area dragover
        }
        
        function handleComparisonDragEnter(e) {
            e.preventDefault();
            const draggedData = e.dataTransfer.types.includes('text/comparison-reorder');
            if (draggedData) {
                // Find the closest comparison icon element
                const targetIcon = e.target.closest('.comparison-icon');
                if (targetIcon && !targetIcon.classList.contains('dragging')) {
                    // Remove drag-over from all other icons first
                    document.querySelectorAll('.comparison-icon').forEach(icon => {
                        if (icon !== targetIcon) {
                            icon.classList.remove('drag-over');
                        }
                    });
                    targetIcon.classList.add('drag-over');
                }
            }
            e.stopPropagation();
        }
        
        function handleComparisonDragLeave(e) {
            // More forgiving drag leave - use a small timeout to avoid flickering
            setTimeout(() => {
                const targetIcon = e.target.closest('.comparison-icon');
                if (targetIcon) {
                    // Only remove if we're not hovering over this icon or its children
                    const rect = targetIcon.getBoundingClientRect();
                    const isStillHovering = e.clientX >= rect.left && e.clientX <= rect.right && 
                                          e.clientY >= rect.top && e.clientY <= rect.bottom;
                    if (!isStillHovering) {
                        targetIcon.classList.remove('drag-over');
                    }
                }
            }, 10);
        }
        
        function handleComparisonDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const draggedIndexStr = e.dataTransfer.getData('text/comparison-reorder');
            if (!draggedIndexStr) return; // Not a comparison reorder operation
            
            const draggedIndex = parseInt(draggedIndexStr);
            
            // Find the target icon more reliably
            let targetIcon = e.target.closest('.comparison-icon');
            let targetIndex = targetIcon ? parseInt(targetIcon.dataset.index) : -1;
            
            // If we couldn't find a target icon, try to determine position from coordinates
            if (targetIndex === -1 || isNaN(targetIndex)) {
                const comparisonIcons = Array.from(document.querySelectorAll('.comparison-icon'));
                const dropX = e.clientX;
                
                // Find the closest icon based on horizontal position
                let closestIcon = null;
                let closestDistance = Infinity;
                
                comparisonIcons.forEach((icon, index) => {
                    const rect = icon.getBoundingClientRect();
                    const iconCenterX = rect.left + rect.width / 2;
                    const distance = Math.abs(dropX - iconCenterX);
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestIcon = icon;
                        targetIndex = index;
                    }
                });
            }
            
            if (draggedIndex !== targetIndex && !isNaN(draggedIndex) && !isNaN(targetIndex) && 
                draggedIndex >= 0 && targetIndex >= 0 && 
                draggedIndex < comparisonIcons.length && targetIndex < comparisonIcons.length) {
                
                // Reorder the icons array
                const draggedIcon = comparisonIcons[draggedIndex];
                comparisonIcons.splice(draggedIndex, 1);
                comparisonIcons.splice(targetIndex, 0, draggedIcon);
                
                // Re-render the comparison area
                renderComparisonArea();
            }
            
            // Clean up drag states
            document.querySelectorAll('.comparison-icon').forEach(icon => {
                icon.classList.remove('drag-over', 'dragging');
            });
        }
        
        // Copy codicon name to clipboard when clicked (existing functionality)
        allItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger click if dragging any size icon
                if (e.target.closest('.size-icon')) return;
                
                const codiconName = item.dataset.name;
                const codiconCode = \`<i class="codicon codicon-\${codiconName}"></i>\`;
                
                navigator.clipboard.writeText(codiconCode).then(() => {
                    // Clipboard copy successful - no visual feedback
                }).catch(err => {
                    console.error('Failed to copy to clipboard:', err);
                });
            });
        });
        
        // Check if codicons loaded properly, show fallback if not
        setTimeout(() => {
            const firstCodeicon = document.querySelector('.codicon');
            if (firstCodeicon) {
                const computedStyle = getComputedStyle(firstCodeicon);
                const fontFamily = computedStyle.fontFamily;
                console.log('Codicon font family:', fontFamily);
                
                if (fontFamily.indexOf('codicon') === -1) {
                    console.warn('Codicons font not loaded, showing fallback');
                    // Codicons didn't load, show fallback
                    document.querySelectorAll('.codicon-display').forEach(display => {
                        const iconName = display.parentElement.dataset.name;
                        display.innerHTML = \`<span style="font-family: monospace; opacity: 0.7;">[\${iconName}]</span>\`;
                    });
                } else {
                    console.log('Codicons loaded successfully');
                }
            }
        }, 1000);
        
        // Refresh button functionality
        const refreshButton = document.getElementById('refresh-button');
        refreshButton.addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
        });
        
        // Bounding box toggle functionality
        const boundingBoxToggle = document.getElementById('bounding-box-toggle');
        
        boundingBoxToggle.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const body = document.body;
            
            if (isChecked) {
                body.classList.add('show-bounding-boxes');
            } else {
                body.classList.remove('show-bounding-boxes');
            }
            
            console.log('Bounding boxes:', isChecked ? 'enabled' : 'disabled');
        });
        
        // Initialize
        updateComparisonCount();
        // Apply initial font size to any existing icons
        document.querySelectorAll('.comparison-icon').forEach(icon => {
            icon.style.fontSize = '16px';
        });
        
        // Focus search input on load - use setTimeout to ensure webview is fully loaded
        setTimeout(() => {
            searchInput.focus();
        }, 100);
        
        // Add global drag end cleanup as fallback
        document.addEventListener('dragend', function(e) {
            // Final cleanup for any stuck states
            setTimeout(() => {
                comparisonArea.classList.remove('drag-over');
                document.querySelectorAll('.comparison-icon').forEach(icon => {
                    icon.classList.remove('drag-over', 'dragging');
                });
                document.querySelectorAll('.size-icon').forEach(icon => {
                    icon.classList.remove('dragging');
                });
            }, 100);
        });
        
        // Make removeFromComparison available globally
        window.removeFromComparison = removeFromComparison;
    </script>
</body>
</html>`;
    }

    private _extractCodiconsFromCSS(cssContent: string): string[] {
        const codiconSet = new Set<string>();
        
        // Pattern 1: Match CSS class selectors like .codicon-icon-name::before or .codicon-icon-name:before
        const classRegex = /\.codicon-([a-zA-Z0-9-_]+)::?before/g;
        let match;
        
        while ((match = classRegex.exec(cssContent)) !== null) {
            const iconName = match[1];
            this._addValidIconName(codiconSet, iconName);
        }
        
        // Pattern 2: Match icon definitions in CSS variables or content properties
        const contentRegex = /\.codicon-([a-zA-Z0-9-_]+)::?before\s*\{[^}]*content:\s*["']([^"'\\]+)["']/gs;
        while ((match = contentRegex.exec(cssContent)) !== null) {
            const iconName = match[1];
            this._addValidIconName(codiconSet, iconName);
        }
        
        // Pattern 3: Match newer CSS format with data attributes
        const dataRegex = /\[data-codicon="([a-zA-Z0-9-_]+)"\]/g;
        while ((match = dataRegex.exec(cssContent)) !== null) {
            const iconName = match[1];
            this._addValidIconName(codiconSet, iconName);
        }
        
        // Pattern 4: Match CSS custom properties (CSS variables) that might define icons
        const variableRegex = /--codicon-([a-zA-Z0-9-_]+):/g;
        while ((match = variableRegex.exec(cssContent)) !== null) {
            const iconName = match[1];
            this._addValidIconName(codiconSet, iconName);
        }
        
        // Convert to sorted array
        const codicons = Array.from(codiconSet).sort();
        
        console.log(`Extracted ${codicons.length} codicons from CSS`);
        console.log('Sample codicons found:', codicons.slice(0, 10));
        
        if (codicons.length === 0) {
            console.warn('No codicons found in CSS, falling back to hardcoded list');
            return this._getFallbackCodicons();
        }
        
        return codicons;
    }

    private _addValidIconName(codiconSet: Set<string>, iconName: string): void {
        // Skip generic codicon class, utility classes, and CSS-specific terms
        const skipPatterns = [
            'codicon',
            'modifier-',
            'animation-',
            'spin',
            'pulse',
            'loading',
            'rotate',
            'flip'
        ];
        
        const shouldSkip = skipPatterns.some(pattern => 
            iconName === pattern || iconName.startsWith(pattern)
        );
        
        if (!shouldSkip && iconName.length > 0) {
            codiconSet.add(iconName);
        }
    }

    private _findCssFile(inputPath: string): string | null {
        try {
            const stats = fs.statSync(inputPath);
            
            if (stats.isFile()) {
                // If it's already a file, check if it's a CSS file
                return inputPath.endsWith('.css') ? inputPath : null;
            }
            
            if (stats.isDirectory()) {
                // Look for common CSS file names in the directory
                const commonNames = ['codicon.css', 'index.css', 'styles.css', 'main.css'];
                
                for (const name of commonNames) {
                    const cssPath = path.join(inputPath, name);
                    if (fs.existsSync(cssPath)) {
                        return cssPath;
                    }
                }
                
                // If no common names found, look for any CSS file
                const files = fs.readdirSync(inputPath);
                const cssFile = files.find(file => file.endsWith('.css'));
                
                if (cssFile) {
                    return path.join(inputPath, cssFile);
                }
            }
        } catch (error) {
            console.error('Error finding CSS file:', error);
        }
        
        return null;
    }

    private _convertToTtfFonts(cssContent: string, fontDir: string): string {
        // Find available TTF files in the directory
        const ttfFiles = this._findTtfFiles(fontDir);
        
        if (ttfFiles.length === 0) {
            console.warn('No TTF files found in', fontDir);
            return cssContent;
        }
        
        console.log('Found TTF files:', ttfFiles);
        
        // Replace font references in @font-face rules to use TTF files
        return cssContent.replace(/@font-face\s*\{[^}]*\}/gs, (fontFaceRule) => {
            // Extract font-family name from the rule
            const familyMatch = fontFaceRule.match(/font-family:\s*["']?([^"';]+)["']?/i);
            if (!familyMatch) return fontFaceRule;
            
            const fontFamily = familyMatch[1];
            
            // Find matching TTF file (prefer exact match, then partial match)
            let ttfFile = ttfFiles.find(f => f.toLowerCase().includes(fontFamily.toLowerCase())) || ttfFiles[0];
            
            // Create new @font-face rule with TTF file
            return `@font-face {
    font-family: "${fontFamily}";
    src: url("./${ttfFile}") format("truetype");
    font-weight: normal;
    font-style: normal;
}`;
        });
    }

    private _findTtfFiles(dir: string): string[] {
        try {
            const files = fs.readdirSync(dir);
            return files.filter(file => file.toLowerCase().endsWith('.ttf'));
        } catch (error) {
            console.error('Error reading directory for TTF files:', error);
            return [];
        }
    }

    private _getFallbackCodicons(): string[] {
        // This is a comprehensive list of VS Code codicons as of 2024
        // These are the icon names used with the $(icon-name) syntax
        return [
            'account', 'activate-breakpoints', 'add', 'alert', 'archive', 'array', 'arrow-both',
            'arrow-down', 'arrow-left', 'arrow-right', 'arrow-small-down', 'arrow-small-left',
            'arrow-small-right', 'arrow-small-up', 'arrow-up', 'azure', 'azure-devops',
            'beaker', 'bell', 'bell-dot', 'bell-slash', 'bell-slash-dot', 'blank', 'bold',
            'book', 'bookmark', 'bracket-dot', 'bracket-error', 'brackets', 'briefcase',
            'broadcast', 'browser', 'bug', 'calendar', 'call-incoming', 'call-outgoing',
            'case-sensitive', 'check', 'check-all', 'checklist', 'chevron-down', 'chevron-left',
            'chevron-right', 'chevron-up', 'chrome-close', 'chrome-maximize', 'chrome-minimize',
            'chrome-restore', 'circle', 'circle-filled', 'circle-large', 'circle-large-filled',
            'circle-outline', 'circle-slash', 'circuit-board', 'clear-all', 'clippy', 'close',
            'close-all', 'cloud', 'cloud-download', 'cloud-upload', 'code', 'collapse-all',
            'color-mode', 'combine', 'comment', 'comment-discussion', 'compass', 'compass-active',
            'compass-dot', 'copy', 'credit-card', 'dash', 'dashboard', 'database', 'debug',
            'debug-all', 'debug-alt', 'debug-alt-small', 'debug-breakpoint', 'debug-breakpoint-conditional',
            'debug-breakpoint-conditional-unverified', 'debug-breakpoint-data', 'debug-breakpoint-data-unverified',
            'debug-breakpoint-function', 'debug-breakpoint-function-unverified', 'debug-breakpoint-log',
            'debug-breakpoint-log-unverified', 'debug-breakpoint-unsupported', 'debug-breakpoint-unverified',
            'debug-console', 'debug-continue', 'debug-coverage', 'debug-disconnect', 'debug-line-by-line',
            'debug-pause', 'debug-rerun', 'debug-restart', 'debug-restart-frame', 'debug-reverse-continue',
            'debug-stackframe', 'debug-stackframe-active', 'debug-start', 'debug-step-back',
            'debug-step-into', 'debug-step-out', 'debug-step-over', 'debug-stop', 'desktop-download',
            'device-camera', 'device-camera-video', 'device-desktop', 'device-mobile', 'diff',
            'diff-added', 'diff-ignored', 'diff-modified', 'diff-removed', 'diff-renamed',
            'discard', 'edit', 'editor-layout', 'ellipsis', 'empty-window', 'error', 'error-small',
            'exclude', 'expand-all', 'export', 'extensions', 'eye', 'eye-closed', 'feedback',
            'file', 'file-add', 'file-binary', 'file-code', 'file-directory', 'file-directory-create',
            'file-media', 'file-pdf', 'file-submodule', 'file-symlink-directory', 'file-symlink-file',
            'file-zip', 'files', 'filter', 'filter-filled', 'flame', 'fold', 'fold-down',
            'fold-up', 'folder', 'folder-active', 'folder-library', 'folder-opened', 'gear',
            'gift', 'gist-secret', 'git-branch', 'git-branch-create', 'git-branch-delete',
            'git-commit', 'git-compare', 'git-merge', 'git-pull-request', 'git-pull-request-closed',
            'git-pull-request-create', 'git-pull-request-draft', 'github', 'github-action',
            'github-alt', 'github-inverted', 'globe', 'go-to-file', 'grabber', 'graph',
            'graph-left', 'graph-line', 'graph-scatter', 'gripper', 'group-by-ref-type',
            'heart', 'heart-filled', 'history', 'home', 'horizontal-rule', 'hubot', 'inbox',
            'indent', 'info', 'insert', 'inspect', 'italic', 'jersey', 'json', 'kebab-vertical',
            'key', 'law', 'lightbulb', 'lightbulb-autofix', 'link', 'link-external', 'list-filter',
            'list-flat', 'list-ordered', 'list-selection', 'list-tree', 'list-unordered',
            'live-share', 'loading', 'location', 'lock', 'lock-small', 'magnet', 'mail',
            'mail-read', 'markdown', 'megaphone', 'mention', 'menu', 'merge', 'milestone',
            'mirror', 'mortar-board', 'move', 'multiple-windows', 'mute', 'new-file', 'new-folder',
            'newline', 'no-newline', 'note', 'notebook', 'notebook-template', 'octoface',
            'open-preview', 'organization', 'output', 'package', 'paintcan', 'pass', 'pass-filled',
            'person', 'person-add', 'pie-chart', 'pin', 'pinned', 'pinned-dirty', 'play',
            'play-circle', 'plug', 'preserve-case', 'preview', 'primitive-dot', 'primitive-square',
            'project', 'pulse', 'question', 'quote', 'radio-tower', 'reactions', 'record',
            'record-keys', 'record-small', 'redo', 'references', 'refresh', 'regex', 'remote',
            'remote-explorer', 'remove', 'replace', 'replace-all', 'reply', 'repo', 'repo-clone',
            'repo-create', 'repo-delete', 'repo-force-push', 'repo-forked', 'repo-pull',
            'repo-push', 'report', 'request-changes', 'rocket', 'root-folder', 'root-folder-opened',
            'rss', 'ruby', 'run-above', 'run-all', 'run-below', 'run-errors', 'save', 'save-all',
            'save-as', 'screen-full', 'screen-normal', 'search', 'search-stop', 'server',
            'server-environment', 'server-process', 'settings', 'settings-gear', 'shield',
            'sign-in', 'sign-out', 'smiley', 'sort-precedence', 'source-control', 'split-horizontal',
            'split-vertical', 'squirrel', 'star', 'star-empty', 'star-full', 'star-half',
            'stop-circle', 'symbol-array', 'symbol-boolean', 'symbol-class', 'symbol-color',
            'symbol-constant', 'symbol-constructor', 'symbol-enum', 'symbol-enum-member',
            'symbol-event', 'symbol-field', 'symbol-file', 'symbol-function', 'symbol-interface',
            'symbol-key', 'symbol-keyword', 'symbol-method', 'symbol-misc', 'symbol-module',
            'symbol-namespace', 'symbol-null', 'symbol-number', 'symbol-numeric', 'symbol-object',
            'symbol-operator', 'symbol-package', 'symbol-parameter', 'symbol-property',
            'symbol-reference', 'symbol-ruler', 'symbol-snippet', 'symbol-string', 'symbol-structure',
            'symbol-text', 'symbol-type-parameter', 'symbol-unit', 'symbol-variable', 'sync',
            'sync-ignored', 'table', 'tag', 'target', 'tasklist', 'telescope', 'terminal',
            'terminal-bash', 'terminal-cmd', 'terminal-debian', 'terminal-linux', 'terminal-powershell',
            'terminal-tmux', 'terminal-ubuntu', 'text-size', 'three-bars', 'thumbsdown',
            'thumbsup', 'tools', 'trash', 'triangle-down', 'triangle-left', 'triangle-right',
            'triangle-up', 'twitter', 'type-hierarchy', 'type-hierarchy-sub', 'type-hierarchy-super',
            'unfold', 'ungroup-by-ref-type', 'unlock', 'unmute', 'unverified', 'variable-group',
            'verified', 'versions', 'vm', 'vm-active', 'vm-connect', 'vm-outline', 'vm-running',
            'wand', 'warning', 'watch', 'whitespace', 'whole-word', 'window', 'word-wrap',
            'workspace-trusted', 'workspace-unknown', 'workspace-untrusted', 'zoom-in', 'zoom-out'
        ].sort();
    }
}