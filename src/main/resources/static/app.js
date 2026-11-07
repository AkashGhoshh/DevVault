// Import Core Editor and Markdown Parsing via ESM
async function setupCodeMirror() {
    // Load required modules
    const { EditorState } = await import('https://esm.sh/@codemirror/state');
    const { EditorView, keymap } = await import('https://esm.sh/@codemirror/view');
    const { defaultKeymap } = await import('https://esm.sh/@codemirror/commands');
    const { basicSetup } = await import('https://esm.sh/codemirror');
    const { markdown } = await import('https://esm.sh/@codemirror/lang-markdown');
    const { oneDark } = await import('https://esm.sh/@codemirror/theme-one-dark');

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

// State Management for Multi-Tab Notes
let notes = []; // Array of { id, title, content, updatedAt }
let currentNoteId = null;

function generateId() {
    return 'note_' + Math.random().toString(36).substr(2, 9);
}

async function loadNotes() {
    try {
        if (window.currentPasteId) {
            const res = await fetch(`/api/pastes/${window.currentPasteId}`);
            if (res.ok) {
                const data = await res.json();
                notes = [{
                    id: data.id,
                    cloudId: data.id,
                    parentId: null,
                    title: data.title || 'Untitled Note',
                    content: data.content || '',
                    updatedAt: Date.now(),
                    isExpanded: true
                }];
            } else {
                alert("Could not load note. It may have been deleted.");
                notes = [{
                    id: generateId(),
                    parentId: null,
                    title: 'Untitled Note',
                    content: '',
                    updatedAt: Date.now(),
                    isExpanded: true
                }];
                window.history.pushState({}, '', window.location.pathname);
                window.currentPasteId = null;
            }
        } else {
            const storedNotes = await window.storageManager.loadNotes();
            if (storedNotes && storedNotes.length > 0) {
                notes = storedNotes;
            } else {
                notes = [{
                    id: generateId(),
                    parentId: null,
                    title: 'Untitled Note',
                    content: '',
                    updatedAt: Date.now(),
                    isExpanded: true
                }];
            }
        }
    } catch (e) {
        console.error("Failed to load notes", e);
        notes = [{
            id: generateId(),
            parentId: null,
            title: 'Untitled Note',
            content: '',
            updatedAt: Date.now(),
            isExpanded: true
        }];
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

    // Cloud Sync Logic
    try {
        if (!note.cloudId) {
            const res = await fetch('/api/pastes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: note.title, content })
            });
            if (res.ok) {
                const data = await res.json();
                note.cloudId = data.id;
                window.currentPasteId = data.id;
                await window.storageManager.saveNote(note);
                window.history.pushState({}, '', `?id=${data.id}`);
            }
        } else {
            await fetch(`/api/pastes/${note.cloudId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: note.title, content })
            });
        }
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.innerHTML = '<i class="fa-solid fa-cloud-check mr-1 text-sky-400"></i>Synced to cloud';
        }
    } catch (e) {
        console.error("Cloud sync failed:", e);
    }
}

async function saveNoteState(note) {
    note.updatedAt = Date.now();
    await window.storageManager.saveNote(note);
    renderSidebar();
}

let noteSearchQuery = '';

function renderSidebar() {
    const listEl = document.getElementById('notesList');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    // If a search query is entered, render filtered flat list
    if (noteSearchQuery.trim()) {
        const q = noteSearchQuery.trim().toLowerCase();
        const matches = notes.filter(n => 
            (n.title && n.title.toLowerCase().includes(q)) || 
            (n.content && n.content.toLowerCase().includes(q))
        );
        
        if (matches.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'p-4 text-center text-xs text-slate-500';
            emptyEl.innerHTML = '<i class="fa-solid fa-magnifying-glass mb-2 block text-sm opacity-40"></i>No matching notes';
            listEl.appendChild(emptyEl);
            return;
        }
        
        matches.forEach(note => {
            const isActive = note.id === currentNoteId;
            const itemContainer = document.createElement('div');
            itemContainer.className = 'flex flex-col';
            
            const item = document.createElement('div');
            item.className = `group flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer transition-colors text-sm ${isActive ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`;
            
            const leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-2 overflow-hidden flex-1';
            
            const icon = document.createElement('i');
            icon.className = 'fa-regular fa-file-lines text-xs text-slate-500';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate max-w-[140px] flex-1';
            titleSpan.textContent = note.title;
            
            leftDiv.appendChild(icon);
            leftDiv.appendChild(titleSpan);
            item.onclick = () => switchNote(note.id);
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = `flex gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity items-center`;
            
            const delBtn = document.createElement('i');
            delBtn.className = 'fa-solid fa-trash text-[10px] text-slate-500 hover:text-red-400 p-1';
            delBtn.title = "Delete";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteNote(note.id);
            };
            actionsDiv.appendChild(delBtn);
            
            item.appendChild(leftDiv);
            item.appendChild(actionsDiv);
            itemContainer.appendChild(item);
            listEl.appendChild(itemContainer);
        });
        return;
    }
    
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
        await window.showDialog('You must have at least one tab.');
        return;
    }
    
    const isConfirmed = await window.showDialog('Are you sure you want to delete this tab and all its sub-tabs?', 'confirm', 'Delete Tab');
    if (isConfirmed) {
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



// Copy helper for rendered code blocks
window.copyToClipboard = function(btnElement, text) {
    if (!btnElement || typeof text !== 'string') return;
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
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btnElement.classList.add('text-green-400', 'border-green-400');
        setTimeout(() => {
            btnElement.innerHTML = originalHtml;
            btnElement.classList.remove('text-green-400', 'border-green-400');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
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
if (window.mermaid) {
    window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose'
    });
}

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
            previewHtml = `<div class="mermaid-container p-4 flex justify-center"><pre class="mermaid">${md.utils.escapeHtml(cleanMermaid)}</pre></div>`;
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
                <button class="toggle-view-btn prev-btn px-3 py-1 text-[11px] font-bold uppercase transition-colors ${isRaw ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'bg-slate-700 text-white'}" data-raw-id="${rawId}" data-prev-id="${prevId}" data-mode="preview">Preview</button>
                <button class="toggle-view-btn raw-btn px-3 py-1 text-[11px] font-bold uppercase transition-colors ${!isRaw ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'bg-slate-700 text-white'}" data-raw-id="${rawId}" data-prev-id="${prevId}" data-mode="raw">Raw</button>
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
                    <button class="copy-code-btn hover:text-white transition-all duration-200 bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 opacity-0 group-hover:opacity-100 flex items-center gap-1" title="Copy Code" data-code="${encodedStandardCode}">
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

    // 3. Render HTML with DOMPurify XSS Sanitization
    const rawHtml = md.render(processed);
    if (window.DOMPurify) {
        previewContainer.innerHTML = DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['use'],
            ADD_ATTR: ['target', 'data-raw-id', 'data-prev-id', 'data-mode', 'data-code']
        });
    } else {
        previewContainer.innerHTML = rawHtml;
    }

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
        if (window.mermaid) {
            await window.mermaid.run({
                querySelector: '.mermaid'
            });
        }
        
        // 6. Setup Zoom/Pan for rendered Mermaid SVGs
        const renderedMermaids = previewContainer.querySelectorAll('.mermaid svg');
        renderedMermaids.forEach(svg => {
            svg.classList.add('cursor-zoom-in', 'hover:opacity-90', 'transition-opacity');
            svg.addEventListener('click', () => {
                const modal = document.getElementById('diagramModal');
                const content = document.getElementById('diagramModalContent');
                if (!modal || !content) return;
                
                // Inject cloned SVG
                content.innerHTML = '';
                const clonedSvg = svg.cloneNode(true);
                clonedSvg.classList.remove('cursor-zoom-in', 'hover:opacity-90');
                // Make it responsive but allow scale
                clonedSvg.style.maxWidth = '90vw';
                clonedSvg.style.maxHeight = '80vh';
                clonedSvg.style.transformOrigin = 'center center';
                clonedSvg.style.transition = 'transform 0.1s ease-out';
                content.appendChild(clonedSvg);
                
                // Show modal
                modal.classList.remove('hidden');
                setTimeout(() => modal.classList.remove('opacity-0'), 10);
                
                // Initialize Zoom & Pan state
                let scale = 1;
                let panX = 0;
                let panY = 0;
                let isDragging = false;
                let startX, startY;
                
                const updateTransform = () => {
                    clonedSvg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
                };
                
                // Wheel Zoom
                content.onwheel = (e) => {
                    e.preventDefault();
                    const zoomSensitivity = 0.05;
                    if (e.deltaY < 0) {
                        scale += zoomSensitivity; // zoom in
                    } else {
                        scale = Math.max(0.2, scale - zoomSensitivity); // zoom out (min 0.2)
                    }
                    updateTransform();
                };
                
                // Mouse Drag to Pan
                content.onmousedown = (e) => {
                    isDragging = true;
                    startX = e.clientX - panX;
                    startY = e.clientY - panY;
                    content.classList.replace('cursor-grab', 'cursor-grabbing');
                };
                
                content.onmousemove = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    panX = e.clientX - startX;
                    panY = e.clientY - startY;
                    updateTransform();
                };
                
                content.onmouseup = () => {
                    isDragging = false;
                    content.classList.replace('cursor-grabbing', 'cursor-grab');
                };
                content.onmouseleave = content.onmouseup;
            });
        });

    } catch (e) {
        console.error("Mermaid error:", e);
    }
}

// --- Custom Dialog System ---
window.showDialog = function(message, type = 'alert', title = 'Notice') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customDialogOverlay');
        const box = document.getElementById('customDialogBox');
        document.getElementById('customDialogTitle').innerText = title;
        document.getElementById('customDialogMessage').innerText = message;
        
        const cancelBtn = document.getElementById('customDialogCancel');
        const confirmBtn = document.getElementById('customDialogConfirm');
        
        if (type === 'confirm') {
            cancelBtn.classList.remove('hidden');
        } else {
            cancelBtn.classList.add('hidden');
        }
        
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            box.classList.remove('scale-95');
        }, 10);
        
        const closeDialog = (result) => {
            overlay.classList.add('opacity-0');
            box.classList.add('scale-95');
            setTimeout(() => {
                overlay.classList.add('hidden');
                resolve(result);
            }, 300);
        };
        
        confirmBtn.onclick = () => closeDialog(true);
        cancelBtn.onclick = () => closeDialog(false);
    });
};

// --- Core Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadNotes();
    await setupCodeMirror();

    // New Note Button event
    const newBtn = document.getElementById('newNoteBtn');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            window.createNewNote();
        });
    }

    // Note Search Input event
    const searchInput = document.getElementById('noteSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            noteSearchQuery = e.target.value;
            if (clearSearchBtn) {
                if (noteSearchQuery.length > 0) {
                    clearSearchBtn.classList.remove('hidden');
                } else {
                    clearSearchBtn.classList.add('hidden');
                }
            }
            renderSidebar();
        });
    }

    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            noteSearchQuery = '';
            clearSearchBtn.classList.add('hidden');
            renderSidebar();
            searchInput.focus();
        });
    }

    // Setup Diagram Modal Close Button
    const closeDiagramBtn = document.getElementById('closeDiagramBtn');
    if (closeDiagramBtn) {
        closeDiagramBtn.addEventListener('click', () => {
            const modal = document.getElementById('diagramModal');
            if (modal) {
                modal.classList.add('opacity-0');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    document.getElementById('diagramModalContent').innerHTML = '';
                    // Clean up event listeners by removing them (they are on the container, but we just reset it)
                    const content = document.getElementById('diagramModalContent');
                    content.onwheel = null;
                    content.onmousedown = null;
                    content.onmousemove = null;
                    content.onmouseup = null;
                    content.onmouseleave = null;
                }, 300);
            }
        });
    }
    
    // --- UI Enhancements ---

    // 1. Sidebar Toggle Logic
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    let isSidebarOpen = true;
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            isSidebarOpen = !isSidebarOpen;
            if (isSidebarOpen) {
                sidebar.classList.remove('w-0', '-translate-x-full');
                sidebar.classList.add('w-64', 'translate-x-0');
            } else {
                sidebar.classList.remove('w-64', 'translate-x-0');
                sidebar.classList.add('w-0', '-translate-x-full');
            }
        });
    }

    // 2. Resizable Panels Logic
    const resizer = document.getElementById('resizer');
    const editorSection = document.getElementById('editor-section');
    const previewSection = document.getElementById('preview-section');
    let isResizing = false;

    if (resizer && editorSection && previewSection) {
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            // Disable transitions during resize for smooth dragging
            editorSection.classList.remove('transition-all', 'duration-300');
            previewSection.classList.remove('transition-all', 'duration-300');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            // Calculate new width for editor based on mouse X (considering sidebar width if open)
            const sidebarWidth = isSidebarOpen ? sidebar.offsetWidth : 0;
            let newWidth = e.clientX - sidebarWidth;
            // Constrain min/max widths
            if (newWidth < 100) newWidth = 100;
            const maxWidth = window.innerWidth - sidebarWidth - 100;
            if (newWidth > maxWidth) newWidth = maxWidth;
            
            // Remove w-1/2 tailwind class if present to allow custom width
            editorSection.classList.remove('w-1/2');
            editorSection.style.width = `${newWidth}px`;
            editorSection.style.flex = 'none';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                // Re-enable transitions
                editorSection.classList.add('transition-all', 'duration-300');
                previewSection.classList.add('transition-all', 'duration-300');
            }
        });
    }


});

let saveTimeout;
let renderTimeout;
let hasUnsavedChanges = false;

window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
});

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', async (e) => {
    // Ctrl+S / Cmd+S: Save current note immediately
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (currentNoteId && window.editor) {
            clearTimeout(saveTimeout);
            const content = window.editor.state.doc.toString();
            await saveNoteContent(currentNoteId, content);
            hasUnsavedChanges = false;
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fa-solid fa-check text-green-400 mr-1.5"></i>Saved!';
                setTimeout(() => {
                    saveStatus.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i> Local Save';
                }, 1500);
            }
        }
    }

    // Alt+N / Ctrl+Alt+N: Create new note
    if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        window.createNewNote();
    }

    // Escape: Close modal or clear search
    if (e.key === 'Escape') {
        const diagramModal = document.getElementById('diagramModal');
        if (diagramModal && !diagramModal.classList.contains('hidden')) {
            diagramModal.classList.add('opacity-0');
            setTimeout(() => diagramModal.classList.add('hidden'), 300);
        }
        const searchInput = document.getElementById('noteSearchInput');
        if (searchInput && document.activeElement === searchInput) {
            searchInput.value = '';
            noteSearchQuery = '';
            document.getElementById('clearSearchBtn')?.classList.add('hidden');
            renderSidebar();
            searchInput.blur();
        }
    }
});

async function handleEditorChange(content) {
    hasUnsavedChanges = true;
    // Wait for user to stop typing to prevent lag and excessive API calls
    clearTimeout(saveTimeout);
    
    // Save to active note
    if (currentNoteId) {
        saveTimeout = setTimeout(async () => {
            await saveNoteContent(currentNoteId, content);
            hasUnsavedChanges = false;
            
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Saved to Storage';
                saveStatus.classList.remove('opacity-0');
                setTimeout(() => saveStatus.classList.add('opacity-0'), 2000);
            }
        }, 800);
    }
    
    // Debounce processing markdown preview for high performance (300ms)
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        const cleanedText = preprocessText(content);
        renderPreview(cleanedText);
    }, 300);
}

// -----------------------------------------------------
// URL Initialization
// -----------------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
window.currentPasteId = urlParams.get('id') || null;

// Event Delegation for Read Side (Preview) Interactive Elements
// This replaces inline onclick handlers which are stripped by DOMPurify
document.addEventListener('DOMContentLoaded', () => {
    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer) return;

    previewContainer.addEventListener('click', (e) => {
        // 1. JSON Toggle Buttons
        if (e.target.matches('.json-toggle-btn')) {
            const btn = e.target;
            const targetDiv = btn.nextElementSibling;
            if (targetDiv) {
                targetDiv.classList.toggle('hidden');
                btn.textContent = btn.textContent.startsWith('[+]') 
                    ? btn.textContent.replace('[+]', '[-]') 
                    : btn.textContent.replace('[-]', '[+]');
            }
            return;
        }

        // 2. Code Block View Toggles (Raw / Preview)
        if (e.target.matches('.toggle-view-btn')) {
            const btn = e.target;
            const rawId = btn.getAttribute('data-raw-id');
            const prevId = btn.getAttribute('data-prev-id');
            const mode = btn.getAttribute('data-mode');
            if (rawId && prevId && mode) {
                window.toggleBlockView(btn, rawId, prevId, mode);
            }
            return;
        }

        // 3. Copy Code Buttons
        const copyBtn = e.target.closest('.copy-code-btn');
        if (copyBtn) {
            const code = copyBtn.getAttribute('data-code');
            if (code) {
                window.copyToClipboard(copyBtn, code);
            }
            return;
        }

        // 4. Think Block Accordions
        const thinkHeader = e.target.closest('.think-header');
        if (thinkHeader && thinkHeader.parentElement) {
            thinkHeader.parentElement.classList.toggle('expanded');
            return;
        }
    });
});
