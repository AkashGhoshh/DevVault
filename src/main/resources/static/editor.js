// DevVault — CodeMirror 6 Editor Module
// Dynamic cursor tracking, Obsidian dock synchronization, & seamless theming

let editorView = null;
let themeCompartment = null;
let oneDarkTheme = null;

// =====================================================
// Antigravity & Notion Slash Commands Catalog (/...)
// =====================================================
const SLASH_COMMANDS = [
    {
        id: 'mermaid',
        title: 'Mermaid Diagram',
        subtitle: 'Flowcharts, sequence, class & state charts',
        category: 'DIAGRAM',
        icon: 'fa-solid fa-diagram-project',
        iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        keywords: ['mermaid', 'diagram', 'flowchart', 'sequence', 'graph'],
        template: '```mermaid\nflowchart TD\n    A[Start] --> B{Process}\n    B -->|Success| C[Done]\n    B -->|Error| D[Retry]\n```\n'
    },
    {
        id: 'html',
        title: 'Interactive HTML',
        subtitle: 'Live-rendered HTML/SVG interactive component',
        category: 'COMPONENT',
        icon: 'fa-brands fa-html5',
        iconColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        keywords: ['html', 'svg', 'component', 'web', 'ui'],
        template: '```html\n<div class="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">\n    <h3 class="font-bold text-indigo-400 text-sm">Interactive HTML Component</h3>\n    <p class="text-xs text-content-secondary mt-1">Live rendered with full styling & interactions.</p>\n</div>\n```\n'
    },
    {
        id: 'json',
        title: 'JSON Data Block',
        subtitle: 'Formatted JSON object with syntax colors',
        category: 'DATA',
        icon: 'fa-solid fa-code',
        iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['json', 'data', 'object', 'api'],
        template: '```json\n{\n    "name": "DevVault",\n    "version": "1.0.0",\n    "status": "production-ready",\n    "features": ["markdown", "mermaid", "latex", "folders"]\n}\n```\n'
    },
    {
        id: 'xml',
        title: 'XML Document',
        subtitle: 'Structured XML layout with tag formatting',
        category: 'MARKUP',
        icon: 'fa-solid fa-file-code',
        iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        keywords: ['xml', 'config', 'rss', 'markup'],
        template: '```xml\n<?xml version="1.0" encoding="UTF-8"?>\n<vault name="DevVault">\n    <note id="1" type="standalone">\n        <title>Production Config</title>\n    </note>\n</vault>\n```\n'
    },
    {
        id: 'markdown',
        title: 'Markdown Sub-block',
        subtitle: 'Embedded Markdown section with live view toggle',
        category: 'DOCS',
        icon: 'fa-brands fa-markdown',
        iconColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        keywords: ['markdown', 'md', 'doc', 'text'],
        template: '```markdown\n### Section Overview\n- Key feature 1\n- Key feature 2\n\n> Note: Interactive sub-markdown block.\n```\n'
    },
    {
        id: 'code',
        title: 'Code Snippet',
        subtitle: 'Syntax-highlighted JavaScript / Python code block',
        category: 'DEV',
        icon: 'fa-solid fa-terminal',
        iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        keywords: ['code', 'javascript', 'js', 'python', 'snippet'],
        template: '```javascript\n// Function implementation\nfunction main() {\n    console.log("Hello from DevVault!");\n}\n```\n'
    },
    {
        id: 'table',
        title: 'Markdown Table',
        subtitle: 'Responsive data grid with striped rows',
        category: 'LAYOUT',
        icon: 'fa-solid fa-table',
        iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        keywords: ['table', 'grid', 'data', 'columns'],
        template: '| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| Row 1 | Data A | Value 1 |\n| Row 2 | Data B | Value 2 |\n'
    },
    {
        id: 'callout',
        title: 'Callout Note / Tip',
        subtitle: 'Obsidian & Notion style highlighted alert card',
        category: 'NOTE',
        icon: 'fa-solid fa-lightbulb',
        iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['callout', 'tip', 'note', 'warning', 'info'],
        template: '> [!TIP]\n> Write an important tip, insight, or architecture reminder here.\n'
    },
    {
        id: 'task',
        title: 'Task Checklist',
        subtitle: 'Interactive task checklist with checkboxes',
        category: 'TODO',
        icon: 'fa-regular fa-square-check',
        iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        keywords: ['task', 'todo', 'check', 'list'],
        template: '- [ ] Priority item 1\n- [ ] Priority item 2\n- [x] Completed milestone\n'
    },
    {
        id: 'math',
        title: 'KaTeX LaTeX Math',
        subtitle: 'Centered mathematical equation block',
        category: 'MATH',
        icon: 'fa-solid fa-square-root-variable',
        iconColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        keywords: ['math', 'latex', 'katex', 'formula', 'equation'],
        template: '$$\nf(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n'
    },
    {
        id: 'h1',
        title: 'Heading 1',
        subtitle: 'Large primary document section title',
        category: 'TEXT',
        icon: 'fa-solid fa-heading',
        iconColor: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
        keywords: ['h1', 'heading', 'title'],
        template: '# Document Section Title\n'
    },
    {
        id: 'h2',
        title: 'Heading 2',
        subtitle: 'Medium subsection header',
        category: 'TEXT',
        icon: 'fa-solid fa-heading',
        iconColor: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
        keywords: ['h2', 'heading', 'subtitle'],
        template: '## Subsection Header\n'
    },
    {
        id: 'divider',
        title: 'Horizontal Divider',
        subtitle: 'Subtle section break line',
        category: 'LAYOUT',
        icon: 'fa-solid fa-minus',
        iconColor: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
        keywords: ['divider', 'hr', 'line', 'break'],
        template: '---\n'
    }
];

// Popover State
let isSlashMenuOpen = false;
let slashSelectedIndex = 0;
let slashFilteredItems = [];
let slashTriggerPos = 0;
let slashMenuEl = null;

function ensureSlashMenuElement() {
    if (slashMenuEl) return slashMenuEl;
    slashMenuEl = document.getElementById('slashMenuPopover');
    if (!slashMenuEl) {
        slashMenuEl = document.createElement('div');
        slashMenuEl.id = 'slashMenuPopover';
        slashMenuEl.className = 'slash-menu-popover fixed z-[120] hidden w-80 max-h-80 overflow-y-auto custom-scrollbar rounded-xl border border-border bg-overlay/95 backdrop-blur-xl p-1.5 shadow-2xl transition-all duration-150 select-none';
        document.body.appendChild(slashMenuEl);
    }
    return slashMenuEl;
}

function openSlashMenu(query, pos) {
    const el = ensureSlashMenuElement();
    if (!el || !editorView) return;

    slashFilteredItems = SLASH_COMMANDS.filter(cmd => {
        if (!query) return true;
        const q = query.toLowerCase();
        return cmd.title.toLowerCase().includes(q) ||
               cmd.id.toLowerCase().includes(q) ||
               cmd.keywords.some(k => k.toLowerCase().includes(q));
    });

    if (slashFilteredItems.length === 0) {
        closeSlashMenu();
        return;
    }

    if (slashSelectedIndex >= slashFilteredItems.length) {
        slashSelectedIndex = 0;
    }

    renderSlashMenuItems();

    // Position popover right at the cursor coordinates
    const coords = editorView.coordsAtPos(pos);
    if (coords) {
        let top = coords.bottom + 6;
        let left = coords.left;
        const menuWidth = 320;
        const menuHeight = 320;

        // Viewport boundaries clamping
        if (left + menuWidth > window.innerWidth - 16) {
            left = window.innerWidth - menuWidth - 16;
        }
        if (left < 16) left = 16;
        if (top + menuHeight > window.innerHeight - 16) {
            top = Math.max(16, coords.top - menuHeight - 6);
        }

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
    }

    el.classList.remove('hidden');
    isSlashMenuOpen = true;
}

function closeSlashMenu() {
    if (!isSlashMenuOpen) return;
    isSlashMenuOpen = false;
    if (slashMenuEl) {
        slashMenuEl.classList.add('hidden');
    }
}

function renderSlashMenuItems() {
    const el = ensureSlashMenuElement();
    if (!el) return;
    el.innerHTML = '';

    // Header info
    const header = document.createElement('div');
    header.className = 'px-2.5 py-1 text-[10px] font-mono uppercase font-bold text-content-muted tracking-wider flex items-center justify-between border-b border-border-subtle mb-1';
    header.innerHTML = '<span>Skills & Blocks</span><span class="text-[9px] text-accent-light">DevVault</span>';
    el.appendChild(header);

    slashFilteredItems.forEach((item, index) => {
        const isSelected = index === slashSelectedIndex;
        const row = document.createElement('div');
        row.className = `flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
            isSelected
                ? 'bg-accent-subtle border border-accent/40 text-content-primary shadow-sm'
                : 'text-content-secondary hover:bg-white/5 hover:text-content-primary border border-transparent'
        }`;

        const left = document.createElement('div');
        left.className = 'flex items-center gap-2.5 overflow-hidden flex-1 min-w-0';

        const iconBox = document.createElement('div');
        iconBox.className = `w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 text-xs ${item.iconColor}`;
        iconBox.innerHTML = `<i class="${item.icon}"></i>`;

        const textDiv = document.createElement('div');
        textDiv.className = 'flex flex-col truncate min-w-0';

        const titleSpan = document.createElement('span');
        titleSpan.className = `truncate font-medium text-xs ${isSelected ? 'text-content-primary font-semibold' : 'text-content-secondary'}`;
        titleSpan.textContent = item.title;

        const subtitleSpan = document.createElement('span');
        subtitleSpan.className = 'truncate text-[10px] text-content-muted font-sans';
        subtitleSpan.textContent = item.subtitle;

        textDiv.appendChild(titleSpan);
        textDiv.appendChild(subtitleSpan);
        left.appendChild(iconBox);
        left.appendChild(textDiv);

        const badge = document.createElement('span');
        badge.className = 'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-card border border-border-subtle text-content-muted shrink-0 ml-2';
        badge.textContent = item.category;

        row.appendChild(left);
        row.appendChild(badge);

        row.onmousedown = (e) => {
            e.preventDefault(); // Prevents blur
            executeSlashCommand(item);
        };

        row.onmouseenter = () => {
            slashSelectedIndex = index;
            updateSlashMenuSelection();
        };

        el.appendChild(row);
    });
}

function updateSlashMenuSelection() {
    const el = ensureSlashMenuElement();
    if (!el) return;
    const rows = el.querySelectorAll('.cursor-pointer');
    rows.forEach((r, idx) => {
        const isSelected = idx === slashSelectedIndex;
        if (isSelected) {
            r.className = 'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors bg-accent-subtle border border-accent/40 text-content-primary shadow-sm';
            r.scrollIntoView({ block: 'nearest' });
        } else {
            r.className = 'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors text-content-secondary hover:bg-white/5 hover:text-content-primary border border-transparent';
        }
    });
}

function executeSlashCommand(item) {
    if (!item || !editorView) return;
    const currentPos = editorView.state.selection.main.head;
    const line = editorView.state.doc.lineAt(slashTriggerPos);
    
    // Check if line before slash has other non-whitespace text
    const textBeforeSlashOnLine = line.text.slice(0, slashTriggerPos - line.from).trim();
    const prefix = textBeforeSlashOnLine.length > 0 ? '\n' : '';
    const insertText = prefix + item.template;

    closeSlashMenu();

    editorView.dispatch({
        changes: { from: slashTriggerPos, to: currentPos, insert: insertText },
        selection: { anchor: slashTriggerPos + insertText.length }
    });
    editorView.focus();
}

// Parallel module preloader: fetch all CodeMirror 6 modules concurrently on script load
const cmModulesPromise = Promise.all([
    import('https://esm.sh/@codemirror/state'),
    import('https://esm.sh/@codemirror/view'),
    import('https://esm.sh/@codemirror/commands'),
    import('https://esm.sh/codemirror'),
    import('https://esm.sh/@codemirror/lang-markdown'),
    import('https://esm.sh/@codemirror/theme-one-dark')
]);

export async function setupEditor(container, initialContent, onChange) {
    if (!container) return null;

    const [
        { EditorState, Compartment },
        { EditorView, keymap },
        { defaultKeymap },
        { basicSetup },
        { markdown },
        { oneDark }
    ] = await cmModulesPromise;

    themeCompartment = new Compartment();
    oneDarkTheme = oneDark;

    const isDark = document.documentElement.classList.contains('dark');

    // CodeMirror Slash Command Keyboard Interceptor
    const slashKeymap = [
        {
            key: 'ArrowDown',
            run: () => {
                if (!isSlashMenuOpen || slashFilteredItems.length === 0) return false;
                slashSelectedIndex = (slashSelectedIndex + 1) % slashFilteredItems.length;
                updateSlashMenuSelection();
                return true;
            }
        },
        {
            key: 'ArrowUp',
            run: () => {
                if (!isSlashMenuOpen || slashFilteredItems.length === 0) return false;
                slashSelectedIndex = (slashSelectedIndex - 1 + slashFilteredItems.length) % slashFilteredItems.length;
                updateSlashMenuSelection();
                return true;
            }
        },
        {
            key: 'Enter',
            run: () => {
                if (!isSlashMenuOpen || slashFilteredItems.length === 0) return false;
                executeSlashCommand(slashFilteredItems[slashSelectedIndex]);
                return true;
            }
        },
        {
            key: 'Tab',
            run: () => {
                if (!isSlashMenuOpen || slashFilteredItems.length === 0) return false;
                executeSlashCommand(slashFilteredItems[slashSelectedIndex]);
                return true;
            }
        },
        {
            key: 'Escape',
            run: () => {
                if (!isSlashMenuOpen) return false;
                closeSlashMenu();
                return true;
            }
        }
    ];

    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && typeof onChange === 'function') {
            onChange(update.state.doc.toString());
        }

        // Live Obsidian-style cursor tracking (Ln X, Col Y) & Slash Command Detection
        if (update.selectionSet || update.docChanged) {
            try {
                const pos = update.state.selection.main.head;
                const line = update.state.doc.lineAt(pos);
                const col = pos - line.from + 1;
                const cursorPosEl = document.getElementById('statCursorPos');
                if (cursorPosEl) {
                    cursorPosEl.textContent = `Ln ${line.number}, Col ${col}`;
                }

                // Check for Slash Command trigger (/...)
                const textBefore = line.text.slice(0, pos - line.from);
                const slashMatch = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
                if (slashMatch) {
                    const query = slashMatch[1];
                    slashTriggerPos = pos - query.length - 1;
                    openSlashMenu(query, pos);
                } else if (isSlashMenuOpen) {
                    closeSlashMenu();
                }
            } catch (e) {
                // Ignore transient selection error during initialization
            }
        }
    });

    editorView = new EditorView({
        state: EditorState.create({
            doc: initialContent || '',
            extensions: [
                basicSetup,
                markdown(),
                themeCompartment.of(isDark ? oneDarkTheme : []),
                keymap.of([...slashKeymap, ...defaultKeymap]),
                updateListener,
                EditorView.theme({
                    "&": { height: "100%", backgroundColor: "transparent" },
                    ".cm-scroller": { 
                        overflow: "auto",
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace !important",
                        fontSize: "14.5px",
                        lineHeight: "1.7"
                    },
                    ".cm-content": {
                        padding: "18px 24px"
                    },
                    ".cm-gutters": {
                        border: "none",
                        backgroundColor: "transparent"
                    },
                    ".cm-line, .cm-line *": {
                        textDecoration: "none !important"
                    }
                })
            ]
        }),
        parent: container
    });

    // Close slash menu on blur or outer click
    document.addEventListener('click', (e) => {
        if (slashMenuEl && !slashMenuEl.contains(e.target)) {
            closeSlashMenu();
        }
    });

    window.editor = editorView; // Maintain backwards compatibility
    return editorView;
}

export function updateEditorTheme(isDark) {
    if (!editorView || !themeCompartment || !oneDarkTheme) return;
    editorView.dispatch({
        effects: themeCompartment.reconfigure(isDark ? oneDarkTheme : [])
    });
}
window.updateEditorTheme = updateEditorTheme;

export function setEditorContent(content) {
    if (!editorView) return;
    editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content || '' }
    });
}

export function getEditorContent() {
    if (!editorView) return '';
    return editorView.state.doc.toString();
}

export function focusEditor() {
    if (editorView) editorView.focus();
}

export function applyFormatting(formatType) {
    if (!editorView) return;

    const { state } = editorView;
    const { from, to } = state.selection.main;
    const selected = state.sliceDoc(from, to);

    // Helpers for line-level formatting (H1, H2, H3, Quote, Task)
    const isLineLevel = ['h1', 'h2', 'h3', 'quote', 'task'].includes(formatType);

    if (isLineLevel) {
        const line = state.doc.lineAt(from);
        let prefix = '';
        switch (formatType) {
            case 'h1': prefix = '# '; break;
            case 'h2': prefix = '## '; break;
            case 'h3': prefix = '### '; break;
            case 'quote': prefix = '> '; break;
            case 'task': prefix = '- [ ] '; break;
        }

        const currentText = line.text;
        let changes;
        if (currentText.startsWith(prefix)) {
            // Toggle off: remove prefix
            changes = { from: line.from, to: line.from + prefix.length, insert: '' };
        } else {
            // Strip any conflicting heading/quote/task prefix before applying new one
            const cleanedText = currentText.replace(/^(#{1,6}\s+|>\s+|- \[[ x]\]\s+)/, '');
            changes = { from: line.from, to: line.to, insert: prefix + cleanedText };
        }

        editorView.dispatch({
            changes,
            selection: { anchor: Math.min(line.from + prefix.length + (from - line.from), state.doc.length + prefix.length) }
        });
        editorView.focus();
        return;
    }

    // Helper: Bi-directional smart inline toggle (Bold, Strike, Code)
    function toggleInline(wrapper, placeholder) {
        const wLen = wrapper.length;
        // Check surrounding: text is directly between wrapper tokens (e.g. **|word|**)
        const hasSurrounding = from >= wLen &&
            state.sliceDoc(from - wLen, from) === wrapper &&
            state.sliceDoc(to, to + wLen) === wrapper;

        if (hasSurrounding) {
            editorView.dispatch({
                changes: [
                    { from: from - wLen, to: from, insert: '' },
                    { from: to, to: to + wLen, insert: '' }
                ],
                selection: { anchor: from - wLen, head: to - wLen }
            });
            editorView.focus();
            return;
        }

        if (selected) {
            // Check if selected itself starts and ends with wrapper (e.g. |**word**|)
            if (selected.length >= wLen * 2 && selected.startsWith(wrapper) && selected.endsWith(wrapper)) {
                const unwrapped = selected.slice(wLen, -wLen);
                editorView.dispatch({
                    changes: { from, to, insert: unwrapped },
                    selection: { anchor: from, head: from + unwrapped.length }
                });
                editorView.focus();
                return;
            }

            // Otherwise, wrap selection and keep inner text selected
            const wrapped = `${wrapper}${selected}${wrapper}`;
            editorView.dispatch({
                changes: { from, to, insert: wrapped },
                selection: { anchor: from + wLen, head: to + wLen }
            });
            editorView.focus();
            return;
        }

        // Empty selection: insert with placeholder selected
        const inserted = `${wrapper}${placeholder}${wrapper}`;
        editorView.dispatch({
            changes: { from, to, insert: inserted },
            selection: { anchor: from + wLen, head: from + wLen + placeholder.length }
        });
        editorView.focus();
    }

    // Helper: Bi-directional smart italic toggle (distinguishes * from **)
    function toggleItalic(placeholder) {
        const hasSurrounding = from >= 1 &&
            state.sliceDoc(from - 1, from) === '*' &&
            state.sliceDoc(to, to + 1) === '*' &&
            (from < 2 || state.sliceDoc(from - 2, from - 1) !== '*') &&
            state.sliceDoc(to + 1, to + 2) !== '*';

        if (hasSurrounding) {
            editorView.dispatch({
                changes: [
                    { from: from - 1, to: from, insert: '' },
                    { from: to, to: to + 1, insert: '' }
                ],
                selection: { anchor: from - 1, head: to - 1 }
            });
            editorView.focus();
            return;
        }

        if (selected) {
            if (selected.length >= 2 && selected.startsWith('*') && selected.endsWith('*') &&
                !selected.startsWith('**') && !selected.endsWith('**')) {
                const unwrapped = selected.slice(1, -1);
                editorView.dispatch({
                    changes: { from, to, insert: unwrapped },
                    selection: { anchor: from, head: from + unwrapped.length }
                });
                editorView.focus();
                return;
            }

            const wrapped = `*${selected}*`;
            editorView.dispatch({
                changes: { from, to, insert: wrapped },
                selection: { anchor: from + 1, head: to + 1 }
            });
            editorView.focus();
            return;
        }

        const inserted = `*${placeholder}*`;
        editorView.dispatch({
            changes: { from, to, insert: inserted },
            selection: { anchor: from + 1, head: from + 1 + placeholder.length }
        });
        editorView.focus();
    }

    switch (formatType) {
        case 'bold':
            toggleInline('**', 'bold text');
            return;
        case 'italic':
            toggleItalic('italic text');
            return;
        case 'strike':
            toggleInline('~~', 'strikethrough');
            return;
        case 'code':
            toggleInline('`', 'code');
            return;
        case 'link': {
            const linkRegex = /^\[(.*?)\]\((.*?)\)$/;
            if (selected) {
                const match = selected.match(linkRegex);
                if (match) {
                    const plainText = match[1];
                    editorView.dispatch({
                        changes: { from, to, insert: plainText },
                        selection: { anchor: from, head: from + plainText.length }
                    });
                    editorView.focus();
                    return;
                }
                const wrapped = `[${selected}](https://)`;
                editorView.dispatch({
                    changes: { from, to, insert: wrapped },
                    selection: { anchor: from + selected.length + 3, head: from + wrapped.length - 1 }
                });
                editorView.focus();
                return;
            }
            const inserted = '[Link Title](https://example.com)';
            editorView.dispatch({
                changes: { from, to, insert: inserted },
                selection: { anchor: from + 1, head: from + 11 }
            });
            editorView.focus();
            return;
        }
        case 'codeblock': {
            const cbRegex = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/;
            if (selected) {
                const trimmed = selected.trim();
                const match = trimmed.match(cbRegex);
                if (match) {
                    const inner = match[1];
                    editorView.dispatch({
                        changes: { from, to, insert: inner },
                        selection: { anchor: from, head: from + inner.length }
                    });
                    editorView.focus();
                    return;
                }
                const wrapped = `\n\`\`\`javascript\n${selected}\n\`\`\`\n`;
                editorView.dispatch({
                    changes: { from, to, insert: wrapped },
                    selection: { anchor: from + 15, head: from + 15 + selected.length }
                });
                editorView.focus();
                return;
            }
            const inserted = '\n```javascript\n// Write your code here\n```\n';
            editorView.dispatch({
                changes: { from, to, insert: inserted },
                selection: { anchor: from + 15, head: from + 38 }
            });
            editorView.focus();
            return;
        }
        case 'table': {
            const insertText = '\n| Column 1 | Column 2 |\n|---|---|\n| Item 1 | Item 2 |\n';
            editorView.dispatch({
                changes: { from, to, insert: insertText },
                selection: { anchor: from + 3, head: from + 11 }
            });
            editorView.focus();
            return;
        }
        case 'callout': {
            const insertText = selected ? `\n> [!TIP]\n> ${selected}\n` : '\n> [!TIP]\n> Write a helpful note or tip here\n';
            const selStart = from + 11;
            const selEnd = from + insertText.length - 1;
            editorView.dispatch({
                changes: { from, to, insert: insertText },
                selection: { anchor: selStart, head: selEnd }
            });
            editorView.focus();
            return;
        }
        default:
            return;
    }
}
window.applyFormatting = applyFormatting;
