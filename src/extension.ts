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
        
        const localResourceRoots = [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons')
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
    <script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit@latest/dist/toolkit.js"></script>
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
            margin-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
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

    
    <div class="grid" id="codicon-grid">
        ${codicons.map(codicon => `
            <div class="codicon-item" data-name="${codicon}">
                <div class="codicon-display">
                    <div class="size-row">
                        <div class="size-sample">
                            <div class="size-icon size-11">
                                <i class="codicon codicon-${codicon}"></i>
                            </div>
                            <span class="size-label">11px</span>
                        </div>
                        <div class="size-sample">
                            <div class="size-icon size-14">
                                <i class="codicon codicon-${codicon}"></i>
                            </div>
                            <span class="size-label">14px</span>
                        </div>
                        <div class="size-sample">
                            <div class="size-icon size-16">
                                <i class="codicon codicon-${codicon}"></i>
                            </div>
                            <span class="size-label">16px</span>
                        </div>
                        <div class="size-sample">
                            <div class="size-icon size-24">
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
        const totalCount = document.getElementById('total-count');
        const allItems = Array.from(document.querySelectorAll('.codicon-item'));
        
        let filteredCount = allItems.length;
        
        function updateStats() {
            totalCount.textContent = filteredCount;
            
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
        
        // Copy codicon name to clipboard when clicked
        allItems.forEach(item => {
            item.addEventListener('click', () => {
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
        
        // Focus search input on load - use setTimeout to ensure webview is fully loaded
        setTimeout(() => {
            searchInput.focus();
        }, 100);
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