// DevVault — Markdown Parsing, Syntax Highlighting & Visuals Module

// Initialize Markdown-it: Prefer instant UMD window.markdownit, fallback to ESM
const MarkdownItConstructor = window.markdownit || (await import('https://esm.sh/markdown-it')).default;

// Initialize Markdown-it
const md = new MarkdownItConstructor({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        if (lang && window.hljs && window.hljs.getLanguage(lang)) {
            try {
                return window.hljs.highlight(str, { language: lang }).value;
            } catch (__) {}
        }
        return '';
    }
});

// Global copy helper for code blocks
export function copyToClipboard(btnElement, text) {
    if (!btnElement || typeof text !== 'string') return;
    if (!btnElement.dataset.defaultHtml) {
        btnElement.dataset.defaultHtml = btnElement.innerHTML;
    }
    const defaultHtml = btnElement.dataset.defaultHtml;
    if (btnElement._resetTimer) {
        clearTimeout(btnElement._resetTimer);
        btnElement._resetTimer = null;
    }

    const textToCopy = decodeURIComponent(text);
    const copyAction = (navigator.clipboard && navigator.clipboard.writeText)
        ? navigator.clipboard.writeText(textToCopy)
        : new Promise((resolve, reject) => {
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                resolve();
            } catch (err) {
                reject(err);
            }
            document.body.removeChild(textarea);
          });

    copyAction.then(() => {
        btnElement.innerHTML = '<i class="fa-solid fa-check text-green-400"></i> Copied!';
        btnElement.classList.add('text-green-400', 'border-green-400');
        btnElement._resetTimer = setTimeout(() => {
            btnElement.innerHTML = defaultHtml;
            btnElement.classList.remove('text-green-400', 'border-green-400');
            delete btnElement.dataset.defaultHtml;
            btnElement._resetTimer = null;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}
window.copyToClipboard = copyToClipboard;

// Global toggle helper for Dual-View code blocks (Raw vs Preview)
export function toggleBlockView(btn, rawId, prevId, mode) {
    const rawEl = document.getElementById(rawId);
    const prevEl = document.getElementById(prevId);
    if (!rawEl || !prevEl) return;

    const header = btn.closest('.border-b');
    const prevBtn = header.querySelector('.prev-btn');
    const rawBtn = header.querySelector('.raw-btn');

    if (mode === 'raw') {
        rawEl.classList.remove('hidden');
        prevEl.classList.add('hidden');
        rawBtn.classList.add('bg-slate-700', 'text-white');
        rawBtn.classList.remove('text-slate-400');
        prevBtn.classList.remove('bg-slate-700', 'text-white');
        prevBtn.classList.add('text-slate-400');
    } else {
        rawEl.classList.add('hidden');
        prevEl.classList.remove('hidden');
        prevBtn.classList.add('bg-slate-700', 'text-white');
        prevBtn.classList.remove('text-slate-400');
        rawBtn.classList.remove('bg-slate-700', 'text-white');
        rawBtn.classList.add('text-slate-400');
    }
}
window.toggleBlockView = toggleBlockView;

// Smart JSON Extractor: Finds raw JSON mixed with text and wraps it
export function extractAndWrapRawJSON(text) {
    const blocks = [];
    let maskedText = text.replace(/```[\s\S]*?```/g, (match) => {
        blocks.push(match);
        return `__CODE_BLOCK_${blocks.length - 1}__`;
    });

    let out = "";
    let i = 0;
    while (i < maskedText.length) {
        let char = maskedText[i];
        if ((char === '{' || char === '[') && (i === 0 || maskedText[i-1] === '\n' || maskedText[i-1] === ' ')) {
            let start = i;
            let end = -1;
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escape = false;

            for (let j = i; j < maskedText.length; j++) {
                let c = maskedText[j];
                if (!escape && c === '"') inString = !inString;
                escape = (c === '\\' && !escape);

                if (!inString) {
                    if (c === '{') braceCount++;
                    if (c === '}') braceCount--;
                    if (c === '[') bracketCount++;
                    if (c === ']') bracketCount--;
                }

                if (braceCount === 0 && bracketCount === 0) {
                    end = j;
                    break;
                }
            }

            if (end !== -1) {
                let potentialJson = maskedText.substring(start, end + 1);
                try {
                    let parsed = JSON.parse(potentialJson);
                    if (typeof parsed === 'object' && parsed !== null) {
                        let isMeaningful = false;
                        if (potentialJson.includes('\n')) {
                            if (Object.keys(parsed).length > 0 || (Array.isArray(parsed) && parsed.length > 0)) {
                                isMeaningful = true;
                            }
                        } else if (potentialJson.length > 25) {
                            isMeaningful = true;
                        }

                        if (isMeaningful) {
                            out += '\n```json\n' + potentialJson + '\n```\n';
                            i = end + 1;
                            continue;
                        }
                    }
                } catch (e) {}
            }
        }
        out += maskedText[i];
        i++;
    }

    for (let j = 0; j < blocks.length; j++) {
        out = out.replace(`__CODE_BLOCK_${j}__`, blocks[j]);
    }
    return out;
}

// Smart Code Extractor: Finds naked code blocks and wraps them
export function extractAndWrapRawCode(text) {
    const blocks = [];
    let maskedText = text.replace(/```[\s\S]*?```/g, (match) => {
        blocks.push(match);
        return `__CODE_BLOCK_${blocks.length - 1}__`;
    });

    const codeStartRegex = /^(?:public\s+class|class|interface|function|def|import\s+|export\s+|package\s+)/;
    let lines = maskedText.split('\n');
    let outLines = [];
    let inCodeBlock = false;
    let braceCount = 0;
    let codeBuffer = [];
    let hasSeenBrace = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (!inCodeBlock) {
            if (codeStartRegex.test(line.trim())) {
                inCodeBlock = true;
                braceCount = 0;
                codeBuffer = [];
                hasSeenBrace = false;
            } else {
                outLines.push(line);
                continue;
            }
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            let inString = false;
            let escape = false;
            for (let j = 0; j < line.length; j++) {
                let c = line[j];
                if (!escape && c === '"') inString = !inString;
                if (!escape && c === "'") inString = !inString;
                escape = (c === '\\' && !escape);

                if (!inString) {
                    if (c === '{') { braceCount++; hasSeenBrace = true; }
                    if (c === '}') braceCount--;
                }
            }

            let shouldEnd = false;
            if (hasSeenBrace && braceCount === 0 && line.trim().endsWith('}')) {
                shouldEnd = true;
            } else if (!hasSeenBrace && line.trim() === '' && i > 0 && lines[i-1].trim() === '') {
                shouldEnd = true;
            }

            if (shouldEnd || i === lines.length - 1) {
                outLines.push('```\n' + codeBuffer.join('\n') + '\n```');
                inCodeBlock = false;
            }
        }
    }

    let out = outLines.join('\n');
    for (let j = 0; j < blocks.length; j++) {
        out = out.replace(`__CODE_BLOCK_${j}__`, blocks[j]);
    }
    return out;
}

// Regex Cleanup and <think> tag parsing
export function preprocessText(text) {
    let cleaned = (text || '').trim();

    // 1. ChatGPT UI "Copy code" markers cleanup
    const smartCodeBlockRegex = /(?:[a-zA-Z]+\s*)?Copy code\s*([\s\S]*?)\s*Copy code/gi;
    cleaned = cleaned.replace(smartCodeBlockRegex, '\n```\n$1\n```\n');
    cleaned = cleaned.replace(/Copy code/gi, '');

    // 2. Extract raw JSON
    cleaned = extractAndWrapRawJSON(cleaned);

    // 3. Extract naked code
    cleaned = extractAndWrapRawCode(cleaned);

    // 4. Parse <think> tags into collapsible accordions
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    cleaned = cleaned.replace(thinkRegex, (match, p1) => {
        return `<div class="think-block">
<div class="think-header">
<i class="fa-solid fa-chevron-right"></i> Reasoning Process
</div>
<div class="think-content">
${md.render(p1)}
</div>
</div>`;
    });

    // 5. Parse Obsidian & Notion Callouts (> [!TYPE] Title)
    const calloutRegex = /(?:^|\n)>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]([^\n]*)\n((?:>[ \t]*[^\n]*(?:\n|$))*)/gi;
    cleaned = cleaned.replace(calloutRegex, (match, type, title, body) => {
        const cleanType = (type || 'NOTE').toUpperCase();
        const cleanTitle = (title || '').trim() || cleanType;
        const cleanBody = (body || '').replace(/^>[ \t]?/gm, '').trim();

        let icon = '<i class="fa-solid fa-circle-info"></i>';
        if (cleanType === 'TIP') icon = '<i class="fa-solid fa-lightbulb"></i>';
        else if (cleanType === 'WARNING') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
        else if (cleanType === 'IMPORTANT' || cleanType === 'CAUTION') icon = '<i class="fa-solid fa-circle-exclamation"></i>';

        return `\n<div class="callout-card callout-${cleanType.toLowerCase()}">
<div class="callout-header">
<span class="callout-icon">${icon}</span>
<span class="callout-title">${cleanTitle}</span>
</div>
<div class="callout-body">
${md.render(cleanBody)}
</div>
</div>\n`;
    });

    // 6. Parse Task Checkboxes (- [ ] and - [x]) with unique index
    let taskIdx = 0;
    cleaned = cleaned.replace(/^[ \t]*-\s*\[([ xX])\]\s*(.*)$/gm, (match, check, itemContent) => {
        const isChecked = check.toLowerCase() === 'x';
        const currentTask = taskIdx++;
        return `- <input type="checkbox" class="task-checkbox mr-2 accent-indigo-500 rounded align-middle cursor-pointer" data-task-index="${currentTask}" ${isChecked ? 'checked' : ''}> ${itemContent}`;
    });

    return cleaned;
}

// Configure custom fenced code block renderer
md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
    const token = tokens[idx];
    let info = token.info ? String(token.info).trim() : '';
    const code = token.content;
    let trimmedCode = code.trim();

    // Detect Mermaid
    if (info !== 'json' && info !== 'markdown' && info !== 'md') {
        if (/^(sequenceDiagram|flowchart|graph|pie|gantt|classDiagram|stateDiagram|erDiagram|journey|mindmap|timeline)/i.test(trimmedCode)) {
            info = 'mermaid';
        } else if (trimmedCode.includes('```mermaid')) {
            info = 'mermaid';
        }
    }

    // Detect JSON
    if (info !== 'mermaid' && info !== 'markdown' && info !== 'md') {
        if (trimmedCode.startsWith('{') || trimmedCode.startsWith('[')) {
            try {
                JSON.parse(trimmedCode);
                info = 'json';
            } catch(e) {}
        }
    }

    const blockId = 'block_' + Math.random().toString(36).substr(2, 9);
    const rawId = blockId + '_raw';
    const prevId = blockId + '_prev';

    let hasPreview = false;
    let previewHtml = '';
    let defaultMode = 'raw';

    // Highlight code
    let highlightedCode = code;
    if (info && window.hljs && window.hljs.getLanguage(info)) {
        highlightedCode = window.hljs.highlight(code, { language: info }).value;
    } else if (!info && window.hljs) {
        const result = window.hljs.highlightAuto(code);
        highlightedCode = result.value;
        info = result.language || 'code';
    } else {
        highlightedCode = md.utils.escapeHtml(code);
    }
    const encodedStandardCode = encodeURIComponent(code);
    const rawHtml = `<pre class="hljs code-block-pre custom-scrollbar"><code class="language-${info}">${highlightedCode}</code></pre>`;

    // Preview View
    if (info === 'mermaid') {
        hasPreview = true;
        defaultMode = 'preview';
        let cleanMermaid = code.replace(/```mermaid\s*/ig, '').replace(/```\s*$/g, '').trim();
        previewHtml = `<div class="mermaid-container p-4 flex justify-center"><pre class="mermaid">${md.utils.escapeHtml(cleanMermaid)}</pre></div>`;
    } else if (info === 'markdown' || info === 'md') {
        hasPreview = true;
        defaultMode = 'raw';
        previewHtml = `<div class="p-6 markdown-body bg-[var(--surface-canvas)] border-t border-[var(--border-subtle)]">${md.render(code)}</div>`;
    } else if (info === 'html' || info === 'htm' || info === 'svg') {
        hasPreview = true;
        defaultMode = 'raw';
        previewHtml = `<div class="p-6 bg-[var(--surface-canvas)] border-t border-[var(--border-subtle)] overflow-x-auto custom-scrollbar">${code}</div>`;
    }

    // Toggle UI
    let toggleHtml = '';
    if (hasPreview) {
        const isRaw = defaultMode === 'raw';
        toggleHtml = `
        <div class="flex bg-card rounded border border-border-subtle overflow-hidden opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button class="toggle-view-btn prev-btn px-3 py-1 text-[11px] font-bold uppercase transition-colors ${isRaw ? 'text-content-muted hover:text-content-primary hover:bg-white/5' : 'bg-indigo-600 text-white'}" data-raw-id="${rawId}" data-prev-id="${prevId}" data-mode="preview">Preview</button>
            <button class="toggle-view-btn raw-btn px-3 py-1 text-[11px] font-bold uppercase transition-colors ${!isRaw ? 'text-content-muted hover:text-content-primary hover:bg-white/5' : 'bg-indigo-600 text-white'}" data-raw-id="${rawId}" data-prev-id="${prevId}" data-mode="raw">Raw</button>
        </div>
        `;
    }

    return `
    <div class="code-block-card relative group my-6 rounded-xl overflow-hidden border border-[var(--code-block-border)] shadow-md transition-shadow">
        <div class="bg-[var(--surface-panel)] text-xs text-content-secondary px-4 py-2 flex justify-between items-center border-b border-[var(--code-block-border)] select-none">
            <span class="font-medium tracking-wider uppercase flex items-center text-content-secondary text-[11px]"><i class="fa-solid fa-code mr-2 text-accent-light text-[10px]"></i> ${info || 'CODE'}</span>
            <div class="flex items-center gap-3">
                ${toggleHtml}
                <button class="copy-code-btn hover:text-content-primary transition-all duration-200 bg-card hover:bg-white/5 px-2 py-1 rounded border border-border-subtle opacity-0 group-hover:opacity-100 flex items-center gap-1 text-content-secondary" title="Copy Code" data-code="${encodedStandardCode}">
                    <i class="fa-solid fa-copy text-[10px]"></i> Copy
                </button>
            </div>
        </div>
        <div class="bg-[var(--code-block-bg)] w-full overflow-x-auto custom-scrollbar">
            <div id="${rawId}" class="${defaultMode === 'raw' ? '' : 'hidden'}">
                ${rawHtml}
            </div>
            ${hasPreview ? `<div id="${prevId}" class="${defaultMode === 'preview' ? '' : 'hidden'}">${previewHtml}</div>` : ''}
        </div>
    </div>`;
};

// Render full preview pipeline
export async function renderPreview(rawContent, previewContainer) {
    if (!previewContainer) return;

    const processed = preprocessText(rawContent);
    const rawHtml = md.render(processed);

    if (window.DOMPurify) {
        previewContainer.innerHTML = window.DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['use', 'input'],
            ADD_ATTR: ['target', 'data-raw-id', 'data-prev-id', 'data-mode', 'data-code', 'data-task-index', 'checked', 'type', 'class']
        });
    } else {
        previewContainer.innerHTML = rawHtml;
    }

    // Render KaTeX Math (only if math tokens exist in text)
    const hasMath = Boolean(rawContent && (rawContent.includes('$') || rawContent.includes('\\(') || rawContent.includes('\\[')));
    if (window.renderMathInElement && hasMath) {
        try {
            window.renderMathInElement(previewContainer, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
        } catch (e) {
            console.warn("Math rendering error", e);
        }
    }

    // Render Mermaid Diagrams on-demand (only if .mermaid blocks exist in DOM)
    if (previewContainer.querySelector('.mermaid')) {
        try {
            if (!window.mermaid) {
                const mermaidModule = await import('https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.esm.min.mjs');
                window.mermaid = mermaidModule.default || mermaidModule;
                const isDark = document.documentElement.classList.contains('dark');
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: isDark ? 'dark' : 'default',
                    securityLevel: 'loose'
                });
            }
            await window.mermaid.run({
                querySelector: '.mermaid'
            });

            // Make rendered Mermaid SVGs zoomable on click
            const renderedMermaids = previewContainer.querySelectorAll('.mermaid svg');
            renderedMermaids.forEach(svg => {
                svg.classList.add('cursor-zoom-in', 'hover:opacity-90', 'transition-opacity');
                svg.addEventListener('click', () => {
                    import('./modals.js?v=3.5').then(m => m.openDiagramModal(svg));
                });
            });
        } catch (e) {
            console.warn("Mermaid error:", e);
        }
    }
}
