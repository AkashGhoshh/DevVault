// Import Core Editor and Markdown Parsing via ESM
async function setupCodeMirror(isVimMode) {
    // Load required modules
    const { EditorState } = await import('https://esm.sh/@codemirror/state');
    const { EditorView, keymap } = await import('https://esm.sh/@codemirror/view');
    const { defaultKeymap } = await import('https://esm.sh/@codemirror/commands');
    const { basicSetup } = await import('https://esm.sh/codemirror');
    const { markdown } = await import('https://esm.sh/@codemirror/lang-markdown');
    const { oneDark } = await import('https://esm.sh/@codemirror/theme-one-dark');
    
    let vimExtension = [];
    if (isVimMode) {
        const { vim } = await import('https://esm.sh/@replit/codemirror-vim');
        vimExtension = [vim()];
    }

    const activeNote = notes.find(n => n.id === currentNoteId);
    const savedContent = activeNote ? activeNote.content : '';

    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            handleEditorChange(update.state.doc.toString());
        }
    });

    window.editor = new EditorView({
        state: EditorState.create({
            doc: savedContent,
            extensions: [
                basicSetup,
                markdown(),
                oneDark,
                ...vimExtension,
                keymap.of(defaultKeymap),
                updateListener,
                EditorView.theme({
                    "&": { height: "100%", backgroundColor: "#1e1e1e" },
                    ".cm-scroller": { overflow: "auto" }
                })
            ]
        }),
        parent: document.getElementById('editor-container')
    });

    // Initial render
    handleEditorChange(savedContent);
}
import MarkdownIt from 'https://esm.sh/markdown-it';
import mermaid from 'https://esm.sh/mermaid';

// State Management for Multi-Tab Notes
let notes = []; // Array of { id, title, content, updatedAt }
let currentNoteId = null;

function generateId() {
    return 'note_' + Math.random().toString(36).substr(2, 9);
}

async function loadNotes() {
    try {
        const storedNotes = await window.storageManager.loadNotes();
        if (storedNotes && storedNotes.length > 0) {
            notes = storedNotes;
            // Ensure schema backward compatibility for existing notes
            notes.forEach(n => {
                if (n.parentId === undefined) n.parentId = null;
                if (n.isExpanded === undefined) n.isExpanded = false;
            });
        } else {
            // First time or empty
            notes.push({
                id: generateId(),
                parentId: null,
                title: 'Untitled Note',
                content: '',
                updatedAt: Date.now(),
                isExpanded: true
            });
        }
    } catch (e) {
        console.error("Failed to load notes", e);
        notes = [];
    }
    
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    if (notes.length > 0 && !currentNoteId) {
        currentNoteId = notes[0].id;
    }
    
    // Initial UI Setup
    renderSidebar();
}

async function saveNoteContent(id, content) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    
    note.content = content;
    note.updatedAt = Date.now();
    
    // Generate title from first line
    const firstLine = content.split('\n')[0].trim();
    if (firstLine) {
        note.title = firstLine.replace(/^#+\s*/, '').substring(0, 30);
    } else {
        note.title = 'Untitled Note';
    }
    
    await window.storageManager.saveNote(note);
    renderSidebar(); // Update title in sidebar if changed
}

async function saveNoteState(note) {
    note.updatedAt = Date.now();
    await window.storageManager.saveNote(note);
    renderSidebar();
}

// Global exposure for storage manager to reload
window.reloadAllNotes = async function() {
    currentNoteId = null;
    await loadNotes();
    if (notes.length > 0) {
        switchNote(notes[0].id);
    }
}

function renderSidebar() {
    const listEl = document.getElementById('notesList');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    function renderTree(parentId, containerEl, level) {
        const children = notes.filter(n => n.parentId === parentId);
        // Keep order by creation/update conceptually, or just by updatedAt
        // To maintain stability, we can sort children by updatedAt descending
        children.sort((a, b) => b.updatedAt - a.updatedAt);
        
        children.forEach(note => {
            const isActive = note.id === currentNoteId;
            const hasChildren = notes.some(n => n.parentId === note.id);
            
            const itemContainer = document.createElement('div');
            itemContainer.className = 'flex flex-col';
            
            const item = document.createElement('div');
            item.className = `group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${isActive ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`;
            item.style.paddingLeft = `${level * 16 + 8}px`; // Indentation
            
            // Left side: Expand icon + Title
            const leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-2 overflow-hidden';
            
            const expandIcon = document.createElement('i');
            expandIcon.className = `fa-solid fa-chevron-right text-[10px] w-4 text-center transition-transform ${note.isExpanded ? 'rotate-90' : ''} ${hasChildren ? 'text-slate-500 hover:text-white' : 'opacity-0'}`;
            if (hasChildren) {
                expandIcon.onclick = (e) => {
                    e.stopPropagation();
                    toggleExpand(note.id);
                };
            }
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate max-w-[120px] flex-1';
            titleSpan.textContent = note.title;
            
            leftDiv.appendChild(expandIcon);
            leftDiv.appendChild(titleSpan);
            
            item.onclick = () => switchNote(note.id);
            
            // Right side: Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = `flex gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity items-center`;
            
            const addBtn = document.createElement('i');
            addBtn.className = 'fa-solid fa-plus text-[10px] text-slate-500 hover:text-accent p-1';
            addBtn.title = "Add Sub-Tab";
            addBtn.onclick = (e) => {
                e.stopPropagation();
                window.createNewNote(note.id);
            };
            
            const editBtn = document.createElement('i');
            editBtn.className = 'fa-solid fa-pen text-[10px] text-slate-500 hover:text-accent p-1';
            editBtn.title = "Rename";
            editBtn.onclick = (e) => {
                e.stopPropagation();
                renameNote(note.id);
            };
            
            const delBtn = document.createElement('i');
            delBtn.className = 'fa-solid fa-trash text-[10px] text-slate-500 hover:text-red-400 p-1';
            delBtn.title = "Delete";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteNote(note.id);
            };
            
            actionsDiv.appendChild(addBtn);
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(delBtn);
            
            item.appendChild(leftDiv);
            item.appendChild(actionsDiv);
            itemContainer.appendChild(item);
            
            if (hasChildren && note.isExpanded) {
                const childContainer = document.createElement('div');
                childContainer.className = 'flex flex-col gap-0.5 border-l border-slate-700/50 ml-3';
                renderTree(note.id, childContainer, level + 1);
                itemContainer.appendChild(childContainer);
            }
            
            containerEl.appendChild(itemContainer);
        });
    }
    
    renderTree(null, listEl, 0);
}

async function toggleExpand(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.isExpanded = !note.isExpanded;
        await saveNoteState(note);
        renderSidebar();
    }
}

window.createNewNote = async function(parentId = null) {
    const newNote = {
        id: generateId(),
        parentId: parentId,
        title: parentId ? 'New Sub-Note' : 'New Note',
        content: '',
        updatedAt: Date.now(),
        isExpanded: true
    };
    notes.unshift(newNote); // Add to top

    // Auto-expand parent
    if (parentId) {
        const parent = notes.find(n => n.id === parentId);
        if (parent) {
            parent.isExpanded = true;
            await saveNoteState(parent);
        }
    }
    
    currentNoteId = newNote.id;
    await saveNoteState(newNote);
    renderSidebar();
    
    // Update editor
    if (window.editor) {
        window.editor.dispatch({
            changes: { from: 0, to: window.editor.state.doc.length, insert: '' }
        });
    }
};

function switchNote(id) {
    if (currentNoteId === id) return;
    currentNoteId = id;
    renderSidebar();
    
    const note = notes.find(n => n.id === id);
    if (window.editor && note) {
        window.editor.dispatch({
            changes: { from: 0, to: window.editor.state.doc.length, insert: note.content }
        });
    }
}

async function renameNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const newTitle = prompt('Enter new name for tab:', note.title);
    if (newTitle && newTitle.trim() !== '') {
        note.title = newTitle.trim();
        await saveNoteState(note);
    }
}

async function deleteNote(id) {
    if (notes.length <= 1) {
        alert('You must have at least one tab.');
        return;
    }
    if (confirm('Are you sure you want to delete this tab and all its sub-tabs?')) {
        // Recursive deletion helper
        function getAllChildrenIds(parentId) {
            let ids = [parentId];
            const children = notes.filter(n => n.parentId === parentId);
            for (let child of children) {
                ids = ids.concat(getAllChildrenIds(child.id));
            }
            return ids;
        }
        
        const idsToDelete = getAllChildrenIds(id);
        
        // Remove from memory and storage
        for (let deleteId of idsToDelete) {
            notes = notes.filter(n => n.id !== deleteId);
            await window.storageManager.deleteNote(deleteId);
        }
        
        // If we deleted the active note (or its parent), switch to the first available tab
        if (currentNoteId === id || idsToDelete.includes(currentNoteId)) {
            currentNoteId = notes.length > 0 ? notes[0].id : null;
            if (currentNoteId) {
                switchNote(currentNoteId);
            }
        }
        
        renderSidebar();
    }
}

// Global toggle helper for Dual-View code blocks
window.toggleBlockView = function(btn, rawId, prevId, mode) {
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

// Global toggle helper for App Mode (Edit vs Read)
window.toggleAppMode = function(mode) {
    const editBtn = document.getElementById('modeEditBtn');
    const readBtn = document.getElementById('modeReadBtn');
    const editorSection = document.getElementById('editor-section');
    const previewSection = document.getElementById('preview-section');
    
    if (mode === 'read') {
        // Activate Read Button
        readBtn.classList.add('bg-slate-700', 'text-white', 'shadow-sm');
        readBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');
        
        // Deactivate Edit Button
        editBtn.classList.remove('bg-slate-700', 'text-white', 'shadow-sm');
        editBtn.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');
        
        // Hide Editor, Expand Preview
        editorSection.classList.add('hidden');
        editorSection.classList.remove('w-1/2');
        previewSection.classList.remove('w-1/2');
        previewSection.classList.add('w-full');
    } else {
        // Activate Edit Button
        editBtn.classList.add('bg-slate-700', 'text-white', 'shadow-sm');
        editBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');
        
        // Deactivate Read Button
        readBtn.classList.remove('bg-slate-700', 'text-white', 'shadow-sm');
        readBtn.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');
        
        // Show Editor, Split Preview
        editorSection.classList.remove('hidden');
        editorSection.classList.add('w-1/2');
        previewSection.classList.remove('w-full');
        previewSection.classList.add('w-1/2');
    }
}

// Global copy helper for UI feedback
window.copyToClipboard = function(btn, text) {
    navigator.clipboard.writeText(decodeURIComponent(text)).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btn.classList.add('text-green-400', 'border-green-400');
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('text-green-400', 'border-green-400');
        }, 2000);
    });
};

// Initialize Markdown-it
const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        if (lang && window.hljs && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(str, { language: lang }).value;
            } catch (__) {}
        }
        return ''; // use external default escaping
    }
});

// Setup Mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose'
});

// Smart JSON Extractor: Finds raw JSON mixed with text and wraps it
function extractAndWrapRawJSON(text) {
    // 1. Mask existing markdown code blocks to prevent double-wrapping
    const blocks = [];
    let maskedText = text.replace(/```[\s\S]*?```/g, (match) => {
        blocks.push(match);
        return `__CODE_BLOCK_${blocks.length - 1}__`;
    });

    let out = "";
    let i = 0;
    while (i < maskedText.length) {
        let char = maskedText[i];
        // Look for potential JSON start '{' or '[' at the beginning of a line or text
        if ((char === '{' || char === '[') && (i === 0 || maskedText[i-1] === '\n' || maskedText[i-1] === ' ')) {
            let start = i;
            let end = -1;
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escape = false;
            
            // Brace matching state machine
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
                
                // If all braces/brackets are closed, we found a potential block
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
                        // Heuristics to prevent false positives like inline "{}" or "[3]"
                        let isMeaningful = false;
                        
                        if (potentialJson.includes('\n')) {
                            // Formatted JSON spanning multiple lines is almost certainly a real dump
                            if (Object.keys(parsed).length > 0 || (Array.isArray(parsed) && parsed.length > 0)) {
                                isMeaningful = true;
                            }
                        } else {
                            // Single line JSON must be sufficiently long to not be a false positive
                            if (potentialJson.length > 25) {
                                isMeaningful = true;
                            }
                        }

                        if (isMeaningful) {
                            out += '\n```json\n' + potentialJson + '\n```\n';
                            i = end + 1;
                            continue;
                        }
                    }
                } catch (e) {
                    // Not valid JSON, just continue normally
                }
            }
        }
        out += maskedText[i];
        i++;
    }

    // 2. Unmask code blocks
    for (let j = 0; j < blocks.length; j++) {
        out = out.replace(`__CODE_BLOCK_${j}__`, blocks[j]);
    }
    return out;
}

// Smart Code Extractor: Finds naked code blocks (like public class, def, function) and wraps them
function extractAndWrapRawCode(text) {
    const blocks = [];
    let maskedText = text.replace(/```[\s\S]*?```/g, (match) => {
        blocks.push(match);
        return `__CODE_BLOCK_${blocks.length - 1}__`;
    });

    // Detect common code keywords at the start of a line
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
            
            // Count braces to find the end of block-level code
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
            // End condition 1: Code uses braces and all opened braces are closed.
            if (hasSeenBrace && braceCount === 0 && line.trim().endsWith('}')) {
                shouldEnd = true;
            } 
            // End condition 2: Braceless code (like python/imports) followed by 2 blank lines.
            else if (!hasSeenBrace && line.trim() === '' && i > 0 && lines[i-1].trim() === '') {
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
function preprocessText(text) {
    let cleaned = text.trim();

    // 1. Smart Cleanup for ChatGPT UI Artifacts
    // If the user copied text that contains code between two "Copy code" markers, wrap it in a markdown code block.
    const smartCodeBlockRegex = /(?:[a-zA-Z]+\s*)?Copy code\s*([\s\S]*?)\s*Copy code/gi;
    cleaned = cleaned.replace(smartCodeBlockRegex, '\n```\n$1\n```\n');

    // Fallback: If there are any stray "Copy code" texts left, strip them out.
    cleaned = cleaned.replace(/Copy code/gi, '');

    // 2. Extract raw JSON mixed anywhere inside text
    cleaned = extractAndWrapRawJSON(cleaned);
    
    // 3. Extract naked code blocks mixed anywhere inside text
    cleaned = extractAndWrapRawCode(cleaned);
    
    // 4. Parse <think> tags into collapsible accordions
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    
    cleaned = cleaned.replace(thinkRegex, (match, p1) => {
        // We inject raw HTML. Markdown-it allows HTML if html:true.
        // We'll escape markdown in the think block for now, or just let markdown-it parse it.
        // Markdown-it ignores markdown inside block HTML tags unless carefully configured. 
        // We will render it directly as HTML structural blocks.
        return `<div class="think-block">
<div class="think-header" onclick="this.parentElement.classList.toggle('expanded')">
<i class="fa-solid fa-chevron-right"></i> Reasoning Process
</div>
<div class="think-content">
${md.render(p1)}
</div>
</div>`;
    });

    return cleaned;
}

function jsonToGrid(obj, keyName = '') {
    if (obj === null) return '<span class="text-slate-500 italic">null</span>';
    if (typeof obj === 'boolean') return `<span class="text-purple-400 font-mono">${obj}</span>`;
    if (typeof obj === 'number') return `<span class="text-orange-400 font-mono">${obj}</span>`;
    if (typeof obj === 'string') {
        const isUrl = obj.startsWith('http://') || obj.startsWith('https://');
        const escaped = md.utils.escapeHtml(obj);
        if (isUrl) return `<a href="${escaped}" target="_blank" class="text-accent underline hover:text-sky-300">"${escaped}"</a>`;
        return `<span class="text-green-400 break-words">"${escaped}"</span>`;
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '<span class="text-slate-500 font-mono">[]</span>';
        
        let tableHtml = '';
        const isArrayOfObjects = obj.every(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        
        if (isArrayOfObjects) {
            const keys = new Set();
            obj.forEach(item => Object.keys(item).forEach(k => keys.add(k)));
            const keyArray = Array.from(keys);
            
            tableHtml += '<table class="w-full text-left border-collapse border border-slate-700 min-w-max">';
            tableHtml += '<thead><tr>' + keyArray.map(k => `<th class="border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 uppercase tracking-wider">${k}</th>`).join('') + '</tr></thead>';
            tableHtml += '<tbody>';
            obj.forEach(item => {
                tableHtml += '<tr class="hover:bg-slate-800/50 transition-colors">' + keyArray.map(k => `<td class="border border-slate-700 px-3 py-2 bg-slate-900/50 align-top">${item[k] !== undefined ? jsonToGrid(item[k], k) : ''}</td>`).join('') + '</tr>';
            });
            tableHtml += '</tbody></table>';
            tableHtml = `<div class="rounded overflow-hidden shadow-md my-1">${tableHtml}</div>`;
        } else {
            tableHtml = `<div class="flex flex-col gap-1 pl-3 border-l-2 border-slate-700">` + 
                   obj.map(item => `<div>${jsonToGrid(item, '')}</div>`).join('') + 
                   `</div>`;
        }

        if (keyName === '') return tableHtml;
        const label = `[+] ${keyName} [${obj.length}]`;
        return `<div>
            <button class="text-accent font-mono text-sm hover:underline font-bold" onclick="this.nextElementSibling.classList.toggle('hidden'); this.textContent = this.textContent.startsWith('[+]') ? this.textContent.replace('[+]', '[-]') : this.textContent.replace('[-]', '[+]')">${label}</button>
            <div class="hidden mt-2">${tableHtml}</div>
        </div>`;
    }

    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) return '<span class="text-slate-500 font-mono">{}</span>';
        
        let table = '<table class="w-full text-left border-collapse border border-slate-700">';
        table += '<tbody>';
        keys.forEach(k => {
            table += `<tr class="hover:bg-slate-800/30 transition-colors">
                <td class="border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 w-1/4 align-top whitespace-nowrap">${k}</td>
                <td class="border border-slate-700 px-3 py-2 bg-slate-900/50 align-top break-all">${jsonToGrid(obj[k], k)}</td>
            </tr>`;
        });
        table += '</tbody></table>';
        const tableHtml = `<div class="rounded overflow-hidden shadow-md my-1">${table}</div>`;

        if (keyName === '') return tableHtml;
        const label = `[+] ${keyName} {}`;
        return `<div>
            <button class="text-accent font-mono text-sm hover:underline font-bold" onclick="this.nextElementSibling.classList.toggle('hidden'); this.textContent = this.textContent.startsWith('[+]') ? this.textContent.replace('[+]', '[-]') : this.textContent.replace('[-]', '[+]')">${label}</button>
            <div class="hidden mt-2">${tableHtml}</div>
        </div>`;
    }

    return String(obj);
}

async function renderPreview(rawContent) {
    const previewContainer = document.getElementById('preview-container');
    
    // 1. Preprocess (Regex + Think tags)
    const processed = preprocessText(rawContent);

    // Custom render rule for fence (code blocks)
    md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
        const token = tokens[idx];
        let info = token.info ? String(token.info).trim() : '';
        const code = token.content;
        let trimmedCode = code.trim();
        
        // --- GENERIC SMART DETECTION ---
        // 1. Detect Mermaid (even if unlabeled or has nested backticks)
        if (info !== 'json' && info !== 'markdown' && info !== 'md') {
            if (/^(sequenceDiagram|flowchart|graph|pie|gantt|classDiagram|stateDiagram|erDiagram|journey|mindmap|timeline)/i.test(trimmedCode)) {
                info = 'mermaid';
            } else if (trimmedCode.includes('```mermaid')) {
                info = 'mermaid';
            }
        }
        
        // 2. Detect JSON
        if (info !== 'mermaid' && info !== 'markdown' && info !== 'md') {
            if (trimmedCode.startsWith('{') || trimmedCode.startsWith('[')) {
                try {
                    JSON.parse(trimmedCode);
                    info = 'json'; // Valid JSON found
                } catch(e) {}
            }
        }
        // -------------------------------
        
        const blockId = 'block_' + Math.random().toString(36).substr(2, 9);
        const rawId = blockId + '_raw';
        const prevId = blockId + '_prev';
        
        let hasPreview = false;
        let previewHtml = '';
        let defaultMode = 'raw';
        
        // 1. Prepare Raw View (Syntax Highlighted)
        let highlightedCode = code;
        if (info && window.hljs && hljs.getLanguage(info)) {
            highlightedCode = hljs.highlight(code, { language: info }).value;
        } else if (!info && window.hljs) {
            // Only auto-detect if we haven't already identified the language
            const result = hljs.highlightAuto(code);
            highlightedCode = result.value;
            info = result.language || 'code';
        } else {
            // Language is known but not supported by hljs (e.g. mermaid), or hljs is missing
            highlightedCode = md.utils.escapeHtml(code);
        }
        const encodedStandardCode = encodeURIComponent(code);
        const rawHtml = `<pre class="hljs m-0 p-4 text-sm" style="margin: 0 !important; background: transparent !important;"><code class="language-${info}">${highlightedCode}</code></pre>`;

        // 2. Prepare Preview View based on language
        if (info === 'mermaid') {
            hasPreview = true;
            defaultMode = 'preview';
            // Clean up nested backticks if ChatGPT double-wrapped it
            let cleanMermaid = code.replace(/```mermaid\s*/ig, '').replace(/```\s*$/g, '').trim();
            previewHtml = `<div class="mermaid-container p-4 flex justify-center"><pre class="mermaid">${cleanMermaid}</pre></div>`;
        } else if (info === 'json') {
            try {
                const parsedJson = JSON.parse(code);
                hasPreview = true;
                defaultMode = 'preview';
                previewHtml = `<div class="p-4">${jsonToGrid(parsedJson)}</div>`;
            } catch (e) { hasPreview = false; }
        } else if (info === 'markdown' || info === 'md') {
            hasPreview = true;
            defaultMode = 'raw';
            // Recursively render inner markdown safely
            previewHtml = `<div class="p-6 markdown-body bg-[#1e293b] border-t border-slate-700/50">${md.render(code)}</div>`;
        }

        // 3. Build Toggle UI
        let toggleHtml = '';
        if (hasPreview) {
            const isRaw = defaultMode === 'raw';
            toggleHtml = `
            <div class="flex bg-slate-900 rounded border border-slate-700 overflow-hidden opacity-0 group-hover:opacity-100 transition-all duration-200">
                <button class="prev-btn px-3 py-1 text-[11px] font-bold uppercase transition-colors ${isRaw ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'bg-slate-700 text-white'}" onclick="window.toggleBlockView(this, '${rawId}', '${prevId}', 'preview')">Preview</button>
                <button class="raw-btn px-3 py-1 text-[11px] font-bold uppercase transition-colors ${!isRaw ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'bg-slate-700 text-white'}" onclick="window.toggleBlockView(this, '${rawId}', '${prevId}', 'raw')">Raw</button>
            </div>
            `;
        }

        // 4. Return Combined HTML
        return `
        <div class="relative group my-5 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
            <div class="bg-gradient-to-r from-slate-800 to-slate-900 text-xs text-slate-300 px-4 py-2.5 flex justify-between items-center border-b border-slate-700">
                <span class="font-bold tracking-widest uppercase flex items-center text-accent"><i class="fa-solid fa-code mr-2"></i> ${info || 'CODE'}</span>
                <div class="flex items-center gap-3">
                    ${toggleHtml}
                    <button class="hover:text-white transition-all duration-200 bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 opacity-0 group-hover:opacity-100 flex items-center gap-1" title="Copy Code" onclick="window.copyToClipboard(this, '${encodedStandardCode}')">
                        <i class="fa-solid fa-copy text-[10px]"></i> Copy
                    </button>
                </div>
            </div>
            <div class="bg-[#0b1120] w-full overflow-x-auto">
                <div id="${rawId}" class="${defaultMode === 'raw' ? '' : 'hidden'}">
                    ${rawHtml}
                </div>
                ${hasPreview ? `<div id="${prevId}" class="${defaultMode === 'preview' ? '' : 'hidden'}">${previewHtml}</div>` : ''}
            </div>
        </div>`;
    };

    // 3. Render HTML
    previewContainer.innerHTML = md.render(processed);

    // 4. Render Math Equations (KaTeX)
    if (window.renderMathInElement) {
        try {
            renderMathInElement(previewContainer, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
        } catch (e) {
            console.error("Math rendering error", e);
        }
    }

    // 5. Trigger Mermaid rendering
    try {
        await mermaid.run({
            querySelector: '.mermaid'
        });
    } catch (e) {
        console.error("Mermaid error:", e);
    }
}

// Main Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Check global toggle
    const isVim = localStorage.getItem('vimMode') === 'true';
    document.getElementById('vimStatus').textContent = isVim ? 'ON' : 'OFF';
    document.getElementById('vimStatus').className = isVim ? 'text-green-400 font-bold' : 'text-slate-400';

    await loadNotes();
    await setupCodeMirror(isVim);

    // Toggle button event
    document.getElementById('toggleVim').addEventListener('click', () => {
        const currentlyVim = localStorage.getItem('vimMode') === 'true';
        const newVim = !currentlyVim;
        localStorage.setItem('vimMode', newVim);
        location.reload(); // Quickest way to re-init extensions
    });

    // New Note Button event
    const newBtn = document.getElementById('newNoteBtn');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            window.createNewNote();
        });
    }

    // Export PDF Button event
    const exportBtn = document.getElementById('exportPdfBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const previewContainer = document.getElementById('preview-container');
            const opt = {
                margin:       10,
                filename:     'devvault_export.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            // Add a temporary white-text class for better pdf reading if needed, 
            // but we'll stick to the dark theme for now.
            html2pdf().set(opt).from(previewContainer).save();
        });
    }
});

let saveTimeout;
async function handleEditorChange(content) {
    // Wait for user to stop typing to prevent lag and excessive API calls
    clearTimeout(saveTimeout);
    
    // Save to active note
    if (currentNoteId) {
        saveTimeout = setTimeout(async () => {
            await saveNoteContent(currentNoteId, content);
            
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Saved to Storage';
                saveStatus.classList.remove('opacity-0');
                setTimeout(() => saveStatus.classList.add('opacity-0'), 2000);
            }
        }, 800);
    }
    
    // Continue processing markdown preview
    const cleanedText = preprocessText(content);
    renderPreview(cleanedText);
}
