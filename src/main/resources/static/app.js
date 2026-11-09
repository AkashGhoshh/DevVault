// DevVault — Main Application Controller & Orchestrator
// Linear & Raycast Tech-Noir Architecture with Command Palette (⌘K) & Dark/Light Theming
// Impeccable Craft & UI-UX Pro Max Design System

import { setupEditor, setEditorContent, getEditorContent, focusEditor, updateEditorTheme, applyFormatting } from './editor.js?v=2.9';
import { renderPreview, copyToClipboard, toggleBlockView } from './markdown.js?v=3.4';
import { initSidebar, renderSidebar, clearSearch, getSelectedTag, setSelectedTag } from './sidebar.js?v=2.9';
import { showDialog, initDiagramModal, closeDiagramModal } from './modals.js?v=2.9';

// State Management
let notes = [];
let currentNoteId = null;
let saveTimeout = null;
let renderTimeout = null;
let hasUnsavedChanges = false;
let customFolders = ['General'];
let currentLayoutMode = 'split';

function generateId() {
    return 'note_' + Math.random().toString(36).substr(2, 9);
}

// -----------------------------------------------------
// Theme Management (Dark / Light)
// -----------------------------------------------------
export function getSavedTheme() {
    return localStorage.getItem('devvault_theme') || 'dark';
}

export function setTheme(theme) {
    const isDark = theme === 'dark';
    const themeIcon = document.getElementById('themeIcon');

    if (isDark) {
        document.documentElement.classList.add('dark');
        if (themeIcon) {
            themeIcon.className = 'fa-solid fa-moon text-indigo-400';
        }
    } else {
        document.documentElement.classList.remove('dark');
        if (themeIcon) {
            themeIcon.className = 'fa-solid fa-sun text-amber-500';
        }
    }

    localStorage.setItem('devvault_theme', isDark ? 'dark' : 'light');

    updateEditorTheme(isDark);

    if (window.mermaid) {
        try {
            mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
            const activeNote = notes.find(n => n.id === currentNoteId);
            if (activeNote) {
                const previewContainer = document.getElementById('preview-container');
                renderPreview(activeNote.content, previewContainer);
            }
        } catch (e) {
            // ignore if mermaid not ready
        }
    }
}

export function toggleTheme() {
    const currentTheme = getSavedTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}
window.toggleTheme = toggleTheme;

// -----------------------------------------------------
// Gamma Color Grading (Cosmos, Emerald, Ember, Nordic, Editorial)
// -----------------------------------------------------
const COLOR_GRADES = {
    cosmos: { name: 'Cosmos', dot: '#6366f1' },
    emerald: { name: 'Emerald', dot: '#10b981' },
    ember: { name: 'Ember', dot: '#f97316' },
    nordic: { name: 'Nordic', dot: '#06b6d4' },
    editorial: { name: 'Editorial', dot: '#e4e4e7' }
};

export function getSavedColorGrade() {
    return localStorage.getItem('devvault_color_grade') || 'cosmos';
}

export function setColorGrade(grade) {
    if (!COLOR_GRADES[grade]) grade = 'cosmos';

    document.documentElement.setAttribute('data-color-grade', grade);
    localStorage.setItem('devvault_color_grade', grade);

    const activeDot = document.getElementById('activePaletteDot');
    const activeName = document.getElementById('activePaletteName');
    if (activeDot) activeDot.style.backgroundColor = COLOR_GRADES[grade].dot;
    if (activeName) activeName.textContent = COLOR_GRADES[grade].name;

    // Update checkmark indicators in the popover
    document.querySelectorAll('#paletteOptionList [data-grade]').forEach(btn => {
        const isCurrent = btn.getAttribute('data-grade') === grade;
        const check = btn.querySelector('.grade-check');
        if (check) {
            if (isCurrent) check.classList.remove('hidden');
            else check.classList.add('hidden');
        }
    });

    // Close the popover
    const popover = document.getElementById('themePalettePopover');
    if (popover) popover.classList.add('hidden');

    // Re-render Mermaid diagrams if preview is mounted
    if (window.mermaid) {
        try {
            const isDark = document.documentElement.classList.contains('dark');
            mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
            const activeNote = notes.find(n => n.id === currentNoteId);
            if (activeNote) {
                const previewContainer = document.getElementById('preview-container');
                renderPreview(activeNote.content, previewContainer);
            }
        } catch(e) {}
    }
}
window.setColorGrade = setColorGrade;

// -----------------------------------------------------
// Storage & API Sync
// -----------------------------------------------------
function loadCustomFolders() {
    try {
        const stored = localStorage.getItem('devvault_folders');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                customFolders = Array.from(new Set(['General', ...parsed]));
                return;
            }
        }
    } catch (e) {
        console.warn("Could not load custom folders from localStorage", e);
    }
    customFolders = ['General'];
}

function saveCustomFolders() {
    try {
        localStorage.setItem('devvault_folders', JSON.stringify(customFolders));
    } catch (e) {
        console.warn("Could not save custom folders", e);
    }
}

export function getAllFolders() {
    const set = new Set(customFolders);
    notes.forEach(n => {
        if (n.folder && n.folder.trim() && n.folder.trim() !== 'Standalone') {
            set.add(n.folder.trim());
        }
    });
    set.add('General');

    return Array.from(set).sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        return a.localeCompare(b);
    });
}

async function loadNotes() {
    loadCustomFolders();

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const currentPasteId = urlParams.get('id') || null;

        // 1. Fetch server pastes from backend database (production readiness)
        let serverPastes = [];
        try {
            const res = await fetch('/api/pastes');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    serverPastes = data.map(p => ({
                        id: String(p.id),
                        cloudId: p.id,
                        parentId: null,
                        title: p.title || 'Untitled Note',
                        content: p.content || '',
                        tags: p.tags || '',
                        isPinned: Boolean(p.isPinned),
                        folder: p.folder || 'General',
                        updatedAt: p.updatedAt ? new Date(p.updatedAt).getTime() : (p.createdAt ? new Date(p.createdAt).getTime() : Date.now()),
                        isExpanded: true
                    }));
                }
            }
        } catch (err) {
            console.warn("Server API not reachable, falling back to local storage cache", err);
        }

        // 2. Load locally cached notes from storageManager
        let localNotes = [];
        try {
            const storedNotes = await window.storageManager.loadNotes();
            if (Array.isArray(storedNotes)) {
                localNotes = storedNotes.map(n => ({
                    ...n,
                    id: String(n.id),
                    cloudId: n.cloudId || (typeof n.id === 'number' || !isNaN(Number(n.id)) ? Number(n.id) : null),
                    folder: n.folder || 'General',
                    tags: n.tags || '',
                    isPinned: Boolean(n.isPinned)
                }));
            }
        } catch (err) {
            console.warn("Could not load local notes cache", err);
        }

        // 3. Seamlessly merge server notes and local notes
        const mergedNotesMap = new Map();

        // Server database is source of truth for persistent notes
        serverPastes.forEach(sp => {
            mergedNotesMap.set(String(sp.cloudId), sp);
        });

        // Overlay local drafts or add local-only notes
        localNotes.forEach(ln => {
            const key = ln.cloudId ? String(ln.cloudId) : String(ln.id);
            if (mergedNotesMap.has(key)) {
                const existing = mergedNotesMap.get(key);
                if ((ln.updatedAt || 0) > (existing.updatedAt || 0)) {
                    mergedNotesMap.set(key, { ...existing, ...ln });
                }
            } else {
                mergedNotesMap.set(key, ln);
            }
        });

        notes = Array.from(mergedNotesMap.values());

        // 4. Handle direct note navigation (?id=...)
        if (currentPasteId) {
            let directNote = notes.find(n => String(n.id) === String(currentPasteId) || String(n.cloudId) === String(currentPasteId));
            if (!directNote) {
                try {
                    const res = await fetch(`/api/pastes/${currentPasteId}`);
                    if (res.ok) {
                        const data = await res.json();
                        directNote = {
                            id: String(data.id),
                            cloudId: data.id,
                            parentId: null,
                            title: data.title || 'Untitled Note',
                            content: data.content || '',
                            tags: data.tags || '',
                            isPinned: Boolean(data.isPinned),
                            folder: data.folder || 'General',
                            updatedAt: Date.now(),
                            isExpanded: true
                        };
                        notes.unshift(directNote);
                    }
                } catch(e) {}
            }
            if (directNote) {
                currentNoteId = String(directNote.id);
            }
        }

        // 5. If no notes exist anywhere (first run on fresh DB), create starter note
        if (notes.length === 0) {
            const starterNote = {
                id: generateId(),
                parentId: null,
                title: 'Welcome to DevVault',
                content: `# Welcome to DevVault 🚀\n\nYour production-grade developer notebook with **Antigravity Slash Commands (/)**, **Dual Synchronized Scrolling**, and **Obsidian + Notion aesthetics**.\n\n> [!TIP] Slash Commands Ready\n> Press **/** anywhere in the editor to open the interactive Skills & Blocks menu (Mermaid diagrams, interactive HTML, JSON, XML, KaTeX Math, Code snippets, Tables, and Callouts)!\n\n### Interactive Render Blocks Demo\n\n\`\`\`mermaid\nflowchart TD\n    A[Type / in Editor] --> B{Select Block}\n    B -->|Mermaid| C[Live Flowchart]\n    B -->|KaTeX| D[Math Formula]\n    B -->|Interactive HTML| E[Live Component]\n\`\`\`\n\n### Mathematics Example\n$$\nf(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n\n\`\`\`javascript\nconsole.log("DevVault is production ready!");\n\`\`\``,
                tags: 'welcome,skills,features',
                isPinned: true,
                folder: 'General',
                updatedAt: Date.now(),
                isExpanded: true
            };
            notes.push(starterNote);
            await window.storageManager.saveNote(starterNote);

            try {
                const res = await fetch('/api/pastes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: starterNote.title,
                        content: starterNote.content,
                        tags: starterNote.tags,
                        isPinned: starterNote.isPinned,
                        folder: starterNote.folder
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    starterNote.cloudId = data.id;
                    starterNote.id = String(data.id);
                    await window.storageManager.saveNote(starterNote);
                }
            } catch (e) {}
        }

        // Cache all notes locally
        for (const n of notes) {
            await window.storageManager.saveNote(n);
        }

        if (!currentNoteId && notes.length > 0) {
            currentNoteId = String(notes[0].id);
        }
    } catch (e) {
        console.error("Failed to load notes", e);
    }
}

async function saveNoteContent(id, content) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    note.content = content;
    note.updatedAt = Date.now();

    // Auto-update title if it's untitled
    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim();
    let titleChanged = false;
    if (firstLine && (note.title === 'Untitled Note' || note.title === 'Welcome to DevVault')) {
        const newTitle = firstLine.substring(0, 40);
        if (note.title !== newTitle) {
            note.title = newTitle;
            titleChanged = true;
            const titleInput = document.getElementById('noteTitleInput');
            if (titleInput && note.id === currentNoteId) {
                titleInput.value = note.title;
            }
        }
    }

    await window.storageManager.saveNote(note);

    // Sync to backend if cloud-linked or newly saved
    try {
        const payload = {
            title: note.title,
            content,
            tags: note.tags || '',
            isPinned: !!note.isPinned,
            folder: note.folder || 'General'
        };

        if (!note.cloudId) {
            const res = await fetch('/api/pastes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                note.cloudId = data.id;
                await window.storageManager.saveNote(note);
                window.history.pushState({}, '', `?id=${data.id}`);
                titleChanged = true;
            }
        } else {
            await fetch(`/api/pastes/${note.cloudId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    } catch (e) {
        console.warn("Backend sync failed; local copy saved.", e);
    }

    // Only re-render sidebar when title or new cloud note changes, preventing typing DOM jitter
    if (titleChanged) {
        renderSidebar(notes, currentNoteId, '', customFolders);
    }
}

async function saveNoteState(note) {
    note.updatedAt = Date.now();
    await window.storageManager.saveNote(note);

    if (note.cloudId) {
        try {
            await fetch(`/api/pastes/${note.cloudId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: note.title,
                    content: note.content,
                    tags: note.tags || '',
                    isPinned: Boolean(note.isPinned),
                    folder: note.folder || 'General'
                })
            });
        } catch (e) {
            console.warn("Could not sync note state to cloud", e);
        }
    }

    renderSidebar(notes, currentNoteId, '', customFolders);
}

// -----------------------------------------------------
// Folder Management & Create Item Modal Controller
// -----------------------------------------------------
export function openCreateItemModal(defaultTab = 'note', preselectedFolder = 'Standalone') {
    const overlay = document.getElementById('createItemOverlay');
    const modal = document.getElementById('createItemModal');
    const noteForm = document.getElementById('createNoteForm');
    const folderForm = document.getElementById('createFolderForm');
    const tabNoteBtn = document.getElementById('tabCreateNoteBtn');
    const tabFolderBtn = document.getElementById('tabCreateFolderBtn');
    const folderSelect = document.getElementById('createNoteFolderSelect');
    const inlineFolderWrap = document.getElementById('inlineFolderInputWrap');
    const inlineFolderInput = document.getElementById('inlineFolderNameInput');
    const noteTitleInput = document.getElementById('createNoteTitleInput');
    const folderNameInput = document.getElementById('createFolderNameInput');

    if (!overlay || !modal) return;

    // Populate folderSelect with all current folders + Standalone (Default to Standalone)
    if (folderSelect) {
        folderSelect.innerHTML = '';

        const optStandalone = document.createElement('option');
        optStandalone.value = 'Standalone';
        optStandalone.textContent = '📄 Standalone File (No Folder)';
        if (!preselectedFolder || preselectedFolder === 'Standalone') {
            optStandalone.selected = true;
        }
        folderSelect.appendChild(optStandalone);

        const folders = getAllFolders();
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = `📁 ${f}`;
            if (f === preselectedFolder) opt.selected = true;
            folderSelect.appendChild(opt);
        });

        const optNew = document.createElement('option');
        optNew.value = '__new__';
        optNew.textContent = '+ Create New Folder...';
        folderSelect.appendChild(optNew);
    }

    if (inlineFolderWrap) inlineFolderWrap.classList.add('hidden');
    if (inlineFolderInput) inlineFolderInput.value = '';
    if (noteTitleInput) noteTitleInput.value = '';
    if (folderNameInput) folderNameInput.value = '';

    function switchTab(tab) {
        if (tab === 'note') {
            tabNoteBtn.className = 'flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 text-white font-semibold transition-all shadow-sm cursor-pointer';
            tabFolderBtn.className = 'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-content-secondary hover:text-content-primary transition-all cursor-pointer';
            noteForm.classList.remove('hidden');
            folderForm.classList.add('hidden');
            setTimeout(() => noteTitleInput && noteTitleInput.focus(), 60);
        } else {
            tabFolderBtn.className = 'flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 text-white font-semibold transition-all shadow-sm cursor-pointer';
            tabNoteBtn.className = 'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-content-secondary hover:text-content-primary transition-all cursor-pointer';
            folderForm.classList.remove('hidden');
            noteForm.classList.add('hidden');
            setTimeout(() => folderNameInput && folderNameInput.focus(), 60);
        }
    }

    tabNoteBtn.onclick = () => switchTab('note');
    tabFolderBtn.onclick = () => switchTab('folder');

    if (folderSelect) {
        folderSelect.onchange = () => {
            if (folderSelect.value === '__new__') {
                inlineFolderWrap.classList.remove('hidden');
                inlineFolderInput.focus();
            } else {
                inlineFolderWrap.classList.add('hidden');
            }
        };
    }

    switchTab(defaultTab);

    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        modal.classList.remove('scale-95');
    }, 10);
}
window.openCreateItemModal = openCreateItemModal;

export function closeCreateItemModal() {
    const overlay = document.getElementById('createItemOverlay');
    const modal = document.getElementById('createItemModal');
    if (!overlay || !modal) return;
    overlay.classList.add('opacity-0');
    modal.classList.add('scale-95');
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 200);
}
window.closeCreateItemModal = closeCreateItemModal;

function initCreateItemModalWiring() {
    const overlay = document.getElementById('createItemOverlay');
    const closeBtn = document.getElementById('closeCreateItemBtn');
    const cancelNoteBtn = document.getElementById('cancelCreateNoteBtn');
    const cancelFolderBtn = document.getElementById('cancelCreateFolderBtn');
    const noteForm = document.getElementById('createNoteForm');
    const folderForm = document.getElementById('createFolderForm');
    const noteTitleInput = document.getElementById('createNoteTitleInput');
    const folderSelect = document.getElementById('createNoteFolderSelect');
    const inlineFolderInput = document.getElementById('inlineFolderNameInput');
    const folderNameInput = document.getElementById('createFolderNameInput');

    if (closeBtn) closeBtn.onclick = closeCreateItemModal;
    if (cancelNoteBtn) cancelNoteBtn.onclick = closeCreateItemModal;
    if (cancelFolderBtn) cancelFolderBtn.onclick = closeCreateItemModal;

    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target === overlay) closeCreateItemModal();
        };
    }

    if (noteForm) {
        noteForm.onsubmit = async (e) => {
            e.preventDefault();
            const title = (noteTitleInput.value || '').trim() || 'Untitled Note';
            let folder = folderSelect ? folderSelect.value : 'Standalone';

            if (folder === '__new__') {
                const newFolderName = (inlineFolderInput.value || '').trim();
                if (newFolderName) {
                    if (!customFolders.includes(newFolderName)) {
                        customFolders.push(newFolderName);
                        saveCustomFolders();
                    }
                    folder = newFolderName;
                } else {
                    folder = 'Standalone';
                }
            }

            closeCreateItemModal();
            await createNewNote(folder, title);
        };
    }

    if (folderForm) {
        folderForm.onsubmit = async (e) => {
            e.preventDefault();
            const newFolderName = (folderNameInput.value || '').trim();
            if (!newFolderName) return;

            if (!customFolders.includes(newFolderName)) {
                customFolders.push(newFolderName);
                saveCustomFolders();
            }

            closeCreateItemModal();
            await createNewNote(newFolderName, 'Untitled Note');
        };
    }
}

export async function createNewFolder(folderName = null) {
    if (!folderName) {
        openCreateItemModal('folder');
        return;
    }
    const trimmed = folderName.trim();
    if (!trimmed) return;
    if (!customFolders.includes(trimmed)) {
        customFolders.push(trimmed);
        saveCustomFolders();
    }
    await createNewNote(trimmed, 'Untitled Note');
}
window.createNewFolder = createNewFolder;

export async function deleteFolder(folderName) {
    if (folderName === 'General' || folderName === 'Standalone') return;
    const hasNotes = notes.some(n => n.folder === folderName);
    if (hasNotes) {
        await showDialog(`Folder "${folderName}" contains notes. Please delete or move those notes first.`, 'alert', 'Folder Not Empty');
        return;
    }

    const confirmed = await showDialog(`Delete empty folder "${folderName}"?`, 'confirm', 'Delete Folder');
    if (!confirmed) return;

    customFolders = customFolders.filter(f => f !== folderName);
    saveCustomFolders();

    const activeNote = notes.find(n => n.id === currentNoteId);
    updateFolderSelectOptions(activeNote);
    renderSidebar(notes, currentNoteId, '', customFolders);
}
window.deleteFolder = deleteFolder;

export async function moveNoteToFolder(noteId, targetFolder) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const normalizedFolder = (targetFolder === 'Standalone' || !targetFolder) ? 'Standalone' : targetFolder.trim();
    if (note.folder === normalizedFolder) return;

    note.folder = normalizedFolder;
    note.updatedAt = Date.now();
    await window.storageManager.saveNote(note);

    if (note.cloudId) {
        try {
            await fetch(`/api/pastes/${note.cloudId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: note.title,
                    content: note.content,
                    tags: note.tags || '',
                    isPinned: !!note.isPinned,
                    folder: note.folder
                })
            });
        } catch (err) {
            console.warn("Failed to sync folder move to server", err);
        }
    }

    if (noteId === currentNoteId) {
        updateFolderSelectOptions(note);
    }

    renderSidebar(notes, currentNoteId, '', customFolders);
}
window.moveNoteToFolder = moveNoteToFolder;

export function updateFolderSelectOptions(activeNote) {
    const select = document.getElementById('noteFolderSelect');
    if (!select) return;

    const folders = getAllFolders();
    const currentFolder = activeNote ? (activeNote.folder || 'Standalone') : 'Standalone';

    select.innerHTML = '';

    // Standalone File option
    const optStandalone = document.createElement('option');
    optStandalone.value = 'Standalone';
    optStandalone.textContent = '📄 Standalone File';
    if (currentFolder === 'Standalone' || !activeNote || !activeNote.folder) {
        optStandalone.selected = true;
    }
    select.appendChild(optStandalone);

    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = `📁 ${folder}`;
        if (folder === currentFolder) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    const createOption = document.createElement('option');
    createOption.value = '__new__';
    createOption.textContent = '+ New Folder...';
    select.appendChild(createOption);
}

// -----------------------------------------------------
// Note Actions & State Management
// -----------------------------------------------------
let isCreatingNote = false;

export async function flushPendingSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    if (hasUnsavedChanges && currentNoteId) {
        const activeNote = notes.find(n => n.id === currentNoteId);
        if (activeNote) {
            const currentContent = getEditorContent();
            await saveNoteContent(currentNoteId, currentContent);
        }
        hasUnsavedChanges = false;
        const syncBadge = document.getElementById('syncStatusBadge');
        if (syncBadge) {
            syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span><span>Synced</span>`;
        }
    }
}

export async function createNewNote(targetFolder = null, initialTitle = null) {
    if (isCreatingNote) return;
    isCreatingNote = true;

    try {
        await flushPendingSave();

        const activeNote = notes.find(n => n.id === currentNoteId);
        let assignedFolder = 'Standalone';
        if (targetFolder !== null && targetFolder !== undefined) {
            assignedFolder = targetFolder;
        } else if (activeNote && activeNote.folder) {
            assignedFolder = activeNote.folder;
        }

        const newNote = {
            id: generateId(),
            parentId: null,
            title: (initialTitle || '').trim() || 'Untitled Note',
            content: '',
            tags: '',
            isPinned: false,
            folder: assignedFolder,
            updatedAt: Date.now(),
            isExpanded: true
        };

        try {
            const res = await fetch('/api/pastes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newNote.title,
                    content: newNote.content,
                    tags: newNote.tags,
                    isPinned: newNote.isPinned,
                    folder: newNote.folder
                })
            });
            if (res.ok) {
                const data = await res.json();
                newNote.cloudId = data.id;
                window.history.pushState({}, '', `?id=${data.id}`);
            }
        } catch (e) {
            console.warn("Offline mode: note created locally", e);
        }

        notes.unshift(newNote);
        await window.storageManager.saveNote(newNote);
        await switchNote(newNote.id);
        renderSidebar(notes, currentNoteId, '', customFolders);
        focusEditor();
    } finally {
        isCreatingNote = false;
    }
}
window.createNewNote = createNewNote;
window.createNewNote = createNewNote;

export function updateActiveNoteHeader(note) {
    const titleInput = document.getElementById('noteTitleInput');
    const pinBtn = document.getElementById('pinNoteBtn');
    const pinIcon = document.getElementById('pinIcon');
    const pinText = document.getElementById('pinText');
    const tagsInput = document.getElementById('noteTagsInput');
    const tagsPills = document.getElementById('noteTagsPills');

    if (titleInput) {
        titleInput.value = note ? (note.title || '') : '';
    }
    if (tagsInput) {
        tagsInput.value = '';
    }
    if (tagsPills) {
        tagsPills.innerHTML = '';
        if (note && note.tags) {
            const tagList = note.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
            tagList.forEach(tag => {
                const pill = document.createElement('span');
                pill.className = 'flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--code-inline-bg)] text-[var(--code-inline-text)] border border-[var(--code-inline-border)] shrink-0';
                pill.innerHTML = `<span>#${tag}</span><button type="button" class="hover:text-rose-400 opacity-60 hover:opacity-100 transition-opacity" title="Remove #${tag} from this note"><i class="fa-solid fa-xmark text-[8px]"></i></button>`;
                pill.querySelector('button').onclick = (e) => {
                    e.stopPropagation();
                    removeTagFromActiveNote(tag);
                };
                tagsPills.appendChild(pill);
            });
        }
    }
    if (pinBtn && pinIcon && pinText) {
        const isPinned = note ? !!note.isPinned : false;
        if (isPinned) {
            pinIcon.className = 'fa-solid fa-thumbtack text-[9px] text-amber-400';
            pinText.textContent = 'Pinned';
            pinBtn.classList.add('border-amber-500/30', 'text-amber-400');
            pinBtn.classList.remove('text-content-secondary');
        } else {
            pinIcon.className = 'fa-solid fa-thumbtack text-[9px] text-content-muted';
            pinText.textContent = 'Pin';
            pinBtn.classList.remove('border-amber-500/30', 'text-amber-400');
            pinBtn.classList.add('text-content-secondary');
        }
    }

    updateFolderSelectOptions(note);
}

// -----------------------------------------------------
// Tag Actions (Add, Remove Local, Delete Global)
// -----------------------------------------------------
export async function addTagToActiveNote(newTag) {
    const activeNote = notes.find(n => n.id === currentNoteId);
    if (!activeNote) return;

    const clean = (newTag || '').trim().replace(/^#/, '');
    if (!clean) return;

    const existing = activeNote.tags
        ? activeNote.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0)
        : [];

    if (!existing.some(t => t.toLowerCase() === clean.toLowerCase())) {
        existing.push(clean);
        activeNote.tags = existing.join(', ');
        activeNote.updatedAt = Date.now();
        await window.storageManager.saveNote(activeNote);

        if (activeNote.cloudId) {
            try {
                await fetch(`/api/pastes/${activeNote.cloudId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: activeNote.title,
                        content: activeNote.content,
                        tags: activeNote.tags,
                        isPinned: !!activeNote.isPinned,
                        folder: activeNote.folder || 'General'
                    })
                });
            } catch (err) {
                console.warn("Failed to sync new tag to server", err);
            }
        }
    }

    updateActiveNoteHeader(activeNote);
    renderSidebar(notes, currentNoteId, '', customFolders);
}
window.addTagToActiveNote = addTagToActiveNote;

export async function removeTagFromActiveNote(tagToRemove) {
    const activeNote = notes.find(n => n.id === currentNoteId);
    if (!activeNote || !activeNote.tags) return;

    const cleanTag = tagToRemove.trim().toLowerCase().replace(/^#/, '');
    const remaining = activeNote.tags
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(t => t.length > 0 && t.toLowerCase() !== cleanTag);

    activeNote.tags = remaining.join(', ');
    activeNote.updatedAt = Date.now();
    await window.storageManager.saveNote(activeNote);

    if (activeNote.cloudId) {
        try {
            await fetch(`/api/pastes/${activeNote.cloudId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: activeNote.title,
                    content: activeNote.content,
                    tags: activeNote.tags,
                    isPinned: !!activeNote.isPinned,
                    folder: activeNote.folder || 'General'
                })
            });
        } catch (err) {
            console.warn("Failed to sync tag removal to server", err);
        }
    }

    updateActiveNoteHeader(activeNote);
    renderSidebar(notes, currentNoteId, '', customFolders);
}
window.removeTagFromActiveNote = removeTagFromActiveNote;

export async function deleteTagGlobal(tagToDelete) {
    if (!tagToDelete) return;
    const cleanTag = tagToDelete.trim().toLowerCase().replace(/^#/, '');

    const affectedNotes = notes.filter(n => {
        if (!n.tags || typeof n.tags !== 'string') return false;
        return n.tags.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).includes(cleanTag);
    });

    if (affectedNotes.length === 0) return;

    const countText = affectedNotes.length === 1 ? '1 note' : `${affectedNotes.length} notes`;
    const confirmed = await showDialog(
        `Are you sure you want to delete tag "#${cleanTag}" from ${countText}?`,
        'confirm',
        'Delete Tag Everywhere'
    );
    if (!confirmed) return;

    for (const note of affectedNotes) {
        const remaining = note.tags
            .split(',')
            .map(t => t.trim().replace(/^#/, ''))
            .filter(t => t.length > 0 && t.toLowerCase() !== cleanTag);

        note.tags = remaining.join(', ');
        note.updatedAt = Date.now();
        await window.storageManager.saveNote(note);

        if (note.cloudId) {
            try {
                await fetch(`/api/pastes/${note.cloudId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: note.title,
                        content: note.content,
                        tags: note.tags,
                        isPinned: !!note.isPinned,
                        folder: note.folder || 'General'
                    })
                });
            } catch (err) {
                console.warn(`Failed to sync note ${note.cloudId} tag deletion to server`, err);
            }
        }
    }

    if (getSelectedTag().toLowerCase() === cleanTag) {
        setSelectedTag('');
    }

    const activeNote = notes.find(n => n.id === currentNoteId);
    updateActiveNoteHeader(activeNote);
    renderSidebar(notes, currentNoteId, '', customFolders);
}
window.deleteTagGlobal = deleteTagGlobal;

export async function togglePinNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    note.isPinned = !note.isPinned;
    note.updatedAt = Date.now();
    await window.storageManager.saveNote(note);

    if (note.cloudId) {
        try {
            await fetch(`/api/pastes/${note.cloudId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: note.title,
                    content: note.content,
                    tags: note.tags || '',
                    isPinned: note.isPinned,
                    folder: note.folder || 'General'
                })
            });
        } catch (e) {
            console.warn("Failed to sync pin state to server", e);
        }
    }

    if (note.id === currentNoteId) {
        updateActiveNoteHeader(note);
    }
    renderSidebar(notes, currentNoteId, '', customFolders);
}
window.togglePinNote = togglePinNote;

export async function switchNote(id) {
    if (currentNoteId === id) return;
    await flushPendingSave();

    currentNoteId = id;
    const note = notes.find(n => n.id === id);
    if (!note) return;

    setEditorContent(note.content);
    updateStatsDock(note.content);
    updateActiveNoteHeader(note);
    const previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
        renderPreview(note.content, previewContainer);
    }
    renderSidebar(notes, currentNoteId, '', customFolders);
}

export async function renameNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    const newTitle = prompt("Enter new title:", note.title);
    if (newTitle && newTitle.trim()) {
        note.title = newTitle.trim();
        await saveNoteState(note);
        if (note.id === currentNoteId) {
            const titleInput = document.getElementById('noteTitleInput');
            if (titleInput) titleInput.value = note.title;
        }
    }
}

export async function deleteNote(id) {
    if (notes.length <= 1) {
        await showDialog('You must have at least one note.', 'alert', 'Cannot Delete');
        return;
    }

    const isConfirmed = await showDialog('Are you sure you want to delete this note?', 'confirm', 'Delete Note');
    if (!isConfirmed) return;

    const strId = String(id);
    const noteToDelete = notes.find(n => String(n.id) === strId || (n.cloudId && String(n.cloudId) === strId));

    notes = notes.filter(n => String(n.id) !== strId && (!n.cloudId || String(n.cloudId) !== strId));
    await window.storageManager.deleteNote(id);

    if (noteToDelete && noteToDelete.cloudId) {
        try {
            await fetch(`/api/pastes/${noteToDelete.cloudId}`, { method: 'DELETE' });
        } catch (e) {
            console.warn("Could not delete note from server API", e);
        }
    }

    if (String(currentNoteId) === strId) {
        currentNoteId = notes.length > 0 ? String(notes[0].id) : null;
        if (currentNoteId) {
            switchNote(currentNoteId);
        }
    }

    renderSidebar(notes, currentNoteId, '', customFolders);
}

// -----------------------------------------------------
// Stats Dock & Editor Change Handler (Debounced)
// -----------------------------------------------------
export function updateStatsDock(content) {
    const rawText = content || '';
    const words = rawText.trim().length > 0 ? rawText.trim().split(/\s+/).length : 0;
    const chars = rawText.length;
    const readingMin = Math.max(1, Math.ceil(words / 200));

    const wordEl = document.getElementById('statWordCount');
    const charEl = document.getElementById('statCharCount');
    const timeEl = document.getElementById('statReadingTime');

    if (wordEl) wordEl.innerHTML = `<i class="fa-solid fa-font text-[10px] text-content-muted"></i><span>${words} words</span>`;
    if (charEl) charEl.textContent = `${chars} chars`;
    if (timeEl) timeEl.innerHTML = `<i class="fa-regular fa-clock text-[10px] text-content-muted"></i><span>${readingMin} min read</span>`;
}

function handleEditorChange(content) {
    hasUnsavedChanges = true;
    clearTimeout(saveTimeout);

    updateStatsDock(content);

    const syncBadge = document.getElementById('syncStatusBadge');
    if (syncBadge) {
        syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span><span>Saving...</span>`;
    }

    if (currentNoteId) {
        const targetNoteId = currentNoteId;
        saveTimeout = setTimeout(async () => {
            await saveNoteContent(targetNoteId, content);
            if (currentNoteId === targetNoteId) {
                hasUnsavedChanges = false;
            }

            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fa-solid fa-check text-emerald-400 mr-1.5"></i>Saved';
                setTimeout(() => {
                    saveStatus.innerHTML = '<i class="fa-solid fa-cloud text-indigo-400 mr-1.5 text-[10px]"></i> Auto-Save';
                }, 1500);
            }
            if (syncBadge) {
                syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span><span>Synced</span>`;
            }
        }, 1000);
    }

    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        const previewContainer = document.getElementById('preview-container');
        renderPreview(content, previewContainer);
    }, 350);
}

// -----------------------------------------------------
// 3-Way Layout Mode Switcher (Edit | Split | Preview)
// -----------------------------------------------------
export function toggleAppMode(mode) {
    currentLayoutMode = mode;
    const editBtn = document.getElementById('modeEditBtn');
    const splitBtn = document.getElementById('modeSplitBtn');
    const readBtn = document.getElementById('modeReadBtn');
    const editorSection = document.getElementById('editor-section');
    const previewSection = document.getElementById('preview-section');
    const resizer = document.getElementById('resizer');

    // Reset button base classes
    [editBtn, splitBtn, readBtn].forEach(btn => {
        if (btn) {
            btn.className = 'px-3 py-1 text-xs font-medium transition-all text-content-muted hover:text-content-primary rounded-md';
        }
    });

    if (mode === 'edit') {
        if (editBtn) editBtn.className = 'px-3 py-1 text-xs font-semibold transition-all bg-indigo-600 text-white rounded-md shadow-sm';
        if (editorSection) {
            editorSection.classList.remove('hidden', 'w-1/2');
            editorSection.classList.add('w-full');
            editorSection.style.width = '100%';
        }
        if (previewSection) {
            previewSection.classList.add('hidden');
        }
        if (resizer) resizer.classList.add('hidden');
    } else if (mode === 'read' || mode === 'preview') {
        if (readBtn) readBtn.className = 'px-3 py-1 text-xs font-semibold transition-all bg-indigo-600 text-white rounded-md shadow-sm';
        if (editorSection) {
            editorSection.classList.add('hidden');
        }
        if (previewSection) {
            previewSection.classList.remove('hidden', 'w-1/2');
            previewSection.classList.add('w-full');
            previewSection.style.width = '100%';
        }
        if (resizer) resizer.classList.add('hidden');
    } else {
        // 'split' (default)
        if (splitBtn) splitBtn.className = 'px-3 py-1 text-xs font-semibold transition-all bg-indigo-600 text-white rounded-md shadow-sm';
        if (editorSection) {
            editorSection.classList.remove('hidden', 'w-full');
            editorSection.classList.add('w-1/2');
            editorSection.style.width = '50%';
        }
        if (previewSection) {
            previewSection.classList.remove('hidden', 'w-full');
            previewSection.classList.add('w-1/2');
            previewSection.style.width = '50%';
        }
        if (resizer) resizer.classList.remove('hidden');
    }
}
window.toggleAppMode = toggleAppMode;

// -----------------------------------------------------
// Dual Synchronized Scrolling Controller ("Two Scroll")
// -----------------------------------------------------
let isSyncingScroll = false;
let syncScrollEnabled = true;

export function setupDualSyncScroll(attempt = 0) {
    const editorContainer = document.getElementById('editor-container');
    const previewViewport = document.getElementById('preview-viewport');
    if (!editorContainer || !previewViewport) return;

    const cmScroller = editorContainer.querySelector('.cm-scroller');
    if (!cmScroller) {
        if (attempt < 10) {
            setTimeout(() => setupDualSyncScroll(attempt + 1), 100);
        }
        return;
    }

    // Guard against attaching duplicate listeners
    if (cmScroller._hasSyncListener) return;
    cmScroller._hasSyncListener = true;

    // 1. Editor -> Preview proportional sync scroll
    cmScroller.addEventListener('scroll', () => {
        if (!syncScrollEnabled || isSyncingScroll) return;
        isSyncingScroll = true;
        const maxEditor = cmScroller.scrollHeight - cmScroller.clientHeight;
        const ratio = maxEditor > 0 ? cmScroller.scrollTop / maxEditor : 0;
        const maxPreview = previewViewport.scrollHeight - previewViewport.clientHeight;
        previewViewport.scrollTop = ratio * maxPreview;
        requestAnimationFrame(() => { isSyncingScroll = false; });
    }, { passive: true });

    // 2. Preview -> Editor proportional sync scroll
    previewViewport.addEventListener('scroll', () => {
        if (!syncScrollEnabled || isSyncingScroll) return;
        isSyncingScroll = true;
        const maxPreview = previewViewport.scrollHeight - previewViewport.clientHeight;
        const ratio = maxPreview > 0 ? previewViewport.scrollTop / maxPreview : 0;
        const maxEditor = cmScroller.scrollHeight - cmScroller.clientHeight;
        cmScroller.scrollTop = ratio * maxEditor;
        requestAnimationFrame(() => { isSyncingScroll = false; });
    }, { passive: true });
}
window.setupDualSyncScroll = setupDualSyncScroll;

export function toggleSyncScroll() {
    syncScrollEnabled = !syncScrollEnabled;
    const btn = document.getElementById('syncScrollBtn');
    const icon = document.getElementById('syncScrollIcon');
    const text = document.getElementById('syncScrollText');
    if (btn) {
        if (syncScrollEnabled) {
            btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded bg-card border border-accent/40 text-accent-light text-[11px] transition-all cursor-pointer shadow-sm';
            if (icon) icon.className = 'fa-solid fa-arrows-up-down text-[10px] text-accent-light';
            if (text) text.textContent = 'Sync Scroll';
        } else {
            btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded bg-card border border-border-subtle text-content-muted hover:text-content-primary text-[11px] transition-all cursor-pointer';
            if (icon) icon.className = 'fa-solid fa-arrows-up-down text-[10px] text-content-muted opacity-50';
            if (text) text.textContent = 'Independent';
        }
    }
}
window.toggleSyncScroll = toggleSyncScroll;

// -----------------------------------------------------
// Notion-Style Document Page Width Controller (Standard 840px / Full 100%)
// -----------------------------------------------------
export const DEFAULT_PAGE_WIDTH = 840;

export function getSavedPageWidth() {
    const saved = localStorage.getItem('devvault_page_width');
    if (saved === 'full') return 'full';
    return String(DEFAULT_PAGE_WIDTH);
}

export function setPageWidth(width) {
    const pageWrapper = document.getElementById('preview-page-wrapper');
    const toggleBtn = document.getElementById('pageWidthToggleBtn');
    const isFull = width === 'full';

    if (pageWrapper) {
        if (isFull) {
            pageWrapper.classList.add('preview-full-width');
            pageWrapper.style.maxWidth = '100%';
        } else {
            pageWrapper.classList.remove('preview-full-width');
            pageWrapper.style.maxWidth = `${DEFAULT_PAGE_WIDTH}px`;
        }
    }

    if (toggleBtn) {
        toggleBtn.innerHTML = isFull 
            ? '<i class="fa-solid fa-compress text-[10px] text-accent-light mr-1"></i><span class="font-mono text-[10px]">Standard</span>'
            : '<i class="fa-solid fa-expand text-[10px] text-accent-light mr-1"></i><span class="font-mono text-[10px]">Full Width</span>';
    }

    localStorage.setItem('devvault_page_width', isFull ? 'full' : String(DEFAULT_PAGE_WIDTH));
    localStorage.setItem('devvault_preview_width', isFull ? 'full' : 'page');
}
window.setPageWidth = setPageWidth;

export function togglePageWidth() {
    const cur = getSavedPageWidth();
    setPageWidth(cur === 'full' ? String(DEFAULT_PAGE_WIDTH) : 'full');
}
window.togglePageWidth = togglePageWidth;

export function resetPageDefaultWidth() {
    setPageWidth(String(DEFAULT_PAGE_WIDTH));
}
window.resetPageDefaultWidth = resetPageDefaultWidth;

export function getSavedPreviewWidth() {
    return getSavedPageWidth() === 'full' ? 'full' : 'page';
}
export function setPreviewWidth(mode) {
    setPageWidth(mode === 'full' ? 'full' : String(DEFAULT_PAGE_WIDTH));
}
export function togglePreviewWidth() {
    togglePageWidth();
}
window.togglePreviewWidth = togglePreviewWidth;

// -----------------------------------------------------
// Linear & Raycast ⌘K Command Palette Controller
// -----------------------------------------------------
let isCmdPaletteOpen = false;
let cmdPaletteSelectedIndex = 0;
let cmdPaletteItems = [];

export function openCommandPalette() {
    const overlay = document.getElementById('cmdPaletteOverlay');
    const modal = document.getElementById('cmdPaletteModal');
    const input = document.getElementById('cmdPaletteInput');

    if (!overlay || !modal || !input) return;

    isCmdPaletteOpen = true;
    overlay.classList.remove('hidden');
    // Trigger transition
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        modal.classList.remove('scale-95');
        modal.classList.add('scale-100');
    });

    input.value = '';
    cmdPaletteSelectedIndex = 0;
    renderCommandPaletteResults('');
    input.focus();
}

export function closeCommandPalette() {
    const overlay = document.getElementById('cmdPaletteOverlay');
    const modal = document.getElementById('cmdPaletteModal');

    if (!overlay || !modal) return;

    isCmdPaletteOpen = false;
    overlay.classList.add('opacity-0');
    modal.classList.remove('scale-100');
    modal.classList.add('scale-95');

    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 200);
}

function getAvailableActions() {
    const activeNote = notes.find(n => n.id === currentNoteId);
    const isPinned = activeNote ? !!activeNote.isPinned : false;

    return [
        {
            type: 'action',
            id: 'action_new_note',
            title: 'Create New Note / File',
            subtitle: 'Create standalone note instantly',
            icon: 'fa-solid fa-file-circle-plus text-indigo-400',
            shortcut: 'Alt+N',
            run: () => createNewNote('Standalone')
        },
        {
            type: 'action',
            id: 'action_new_folder',
            title: 'Create New Folder',
            subtitle: 'Create a categorized folder directory',
            icon: 'fa-solid fa-folder-plus text-purple-400',
            shortcut: '',
            run: () => openCreateItemModal('folder')
        },
        {
            type: 'action',
            id: 'action_mode_split',
            title: 'Switch to Split View',
            subtitle: 'Side-by-side Markdown editor & live preview',
            icon: 'fa-solid fa-columns text-indigo-400',
            shortcut: '',
            run: () => toggleAppMode('split')
        },
        {
            type: 'action',
            id: 'action_mode_edit',
            title: 'Switch to Editor Only',
            subtitle: 'Distraction-free Markdown writing mode',
            icon: 'fa-solid fa-pen text-indigo-400',
            shortcut: '',
            run: () => toggleAppMode('edit')
        },
        {
            type: 'action',
            id: 'action_mode_preview',
            title: 'Switch to Preview Only',
            subtitle: 'Full-screen formatted document reading mode',
            icon: 'fa-regular fa-eye text-emerald-400',
            shortcut: '',
            run: () => toggleAppMode('preview')
        },
        {
            type: 'action',
            id: 'action_toggle_theme',
            title: 'Toggle Dark / Light Theme',
            subtitle: `Switch to ${getSavedTheme() === 'dark' ? 'Light' : 'Dark'} mode`,
            icon: 'fa-solid fa-circle-half-stroke text-amber-400',
            shortcut: '',
            run: () => toggleTheme()
        },
        {
            type: 'action',
            id: 'action_toggle_pin',
            title: isPinned ? 'Unpin Active Note' : 'Pin Active Note to Top',
            subtitle: isPinned ? 'Remove from pinned favorites' : 'Keep pinned at top of sidebar',
            icon: 'fa-solid fa-thumbtack text-amber-400',
            shortcut: '',
            run: () => {
                if (currentNoteId) togglePinNote(currentNoteId);
            }
        },
        {
            type: 'action',
            id: 'action_theme_cosmos',
            title: 'Color Grade: Cosmos (Midnight)',
            subtitle: 'Gamma Midnight — Deep space obsidian & electric indigo',
            icon: 'fa-solid fa-palette text-indigo-400',
            shortcut: 'Theme',
            run: () => setColorGrade('cosmos')
        },
        {
            type: 'action',
            id: 'action_theme_emerald',
            title: 'Color Grade: Emerald Oasis',
            subtitle: 'Gamma Oasis — Evergreen moss, mint & dark forest',
            icon: 'fa-solid fa-palette text-emerald-400',
            shortcut: 'Theme',
            run: () => setColorGrade('emerald')
        },
        {
            type: 'action',
            id: 'action_theme_ember',
            title: 'Color Grade: Ember Sunset',
            subtitle: 'Gamma Ember — Volcanic smoke charcoal & molten amber flame',
            icon: 'fa-solid fa-palette text-orange-400',
            shortcut: 'Theme',
            run: () => setColorGrade('ember')
        },
        {
            type: 'action',
            id: 'action_theme_nordic',
            title: 'Color Grade: Nordic Glacier',
            subtitle: 'Gamma Ocean — Deep arctic abyss & electric glacier cyan',
            icon: 'fa-solid fa-palette text-cyan-400',
            shortcut: 'Theme',
            run: () => setColorGrade('nordic')
        },
        {
            type: 'action',
            id: 'action_theme_editorial',
            title: 'Color Grade: Editorial Paper',
            subtitle: 'Gamma Minimalist — Archival vintage ivory & bespoke newsprint',
            icon: 'fa-solid fa-palette text-zinc-300',
            shortcut: 'Theme',
            run: () => setColorGrade('editorial')
        },
        {
            type: 'action',
            id: 'action_page_default',
            title: 'Page View: Reset to Default (840px)',
            subtitle: 'Standard centered document reading view',
            icon: 'fa-solid fa-file-lines text-accent-light',
            shortcut: 'Page',
            run: () => resetPageDefaultWidth()
        },
        {
            type: 'action',
            id: 'action_page_compact',
            title: 'Page View: Compact (680px)',
            subtitle: 'Narrow focused reading & distraction-free writing',
            icon: 'fa-solid fa-compress text-accent-light',
            shortcut: 'Page',
            run: () => setPageWidth(680)
        },
        {
            type: 'action',
            id: 'action_page_wide',
            title: 'Page View: Wide (1080px)',
            subtitle: 'Wide canvas for large tables, side-by-side math & diagrams',
            icon: 'fa-solid fa-expand text-accent-light',
            shortcut: 'Page',
            run: () => setPageWidth(1080)
        },
        {
            type: 'action',
            id: 'action_page_full',
            title: 'Page View: Full Bleed (100%)',
            subtitle: 'Edge-to-edge unrestricted markdown view',
            icon: 'fa-solid fa-arrows-left-right text-accent-light',
            shortcut: 'Page',
            run: () => setPageWidth('full')
        }
    ];
}

function renderCommandPaletteResults(filterQuery = '') {
    const resultsContainer = document.getElementById('cmdPaletteResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';
    const q = (filterQuery || '').trim().toLowerCase();

    // 1. Actions matching query
    const actions = getAvailableActions().filter(a =>
        a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );

    // 2. Notes matching query
    const matchedNotes = notes.filter(n =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (n.tags && n.tags.toLowerCase().includes(q)) ||
        (n.folder && n.folder.toLowerCase().includes(q))
    ).map(n => ({
        type: 'note',
        id: n.id,
        title: n.title || 'Untitled Note',
        subtitle: `Folder: ${n.folder || 'General'}${n.tags ? ` • #${n.tags}` : ''}`,
        icon: n.isPinned ? 'fa-solid fa-thumbtack text-amber-400' : 'fa-regular fa-file-lines text-content-muted',
        shortcut: n.folder || 'General',
        run: () => switchNote(n.id)
    }));

    cmdPaletteItems = [...actions, ...matchedNotes];

    if (cmdPaletteItems.length === 0) {
        resultsContainer.innerHTML = `
            <div class="py-8 text-center text-xs text-content-muted font-sans">
                <i class="fa-solid fa-magnifying-glass mb-2 block text-lg opacity-40"></i>
                No commands or notes found matching "${filterQuery}"
            </div>
        `;
        return;
    }

    // Keep selectedIndex within bounds
    if (cmdPaletteSelectedIndex >= cmdPaletteItems.length) {
        cmdPaletteSelectedIndex = 0;
    }

    // Render Actions Group
    if (actions.length > 0) {
        const actionHeader = document.createElement('div');
        actionHeader.className = 'px-3 pt-2 pb-1 text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono';
        actionHeader.textContent = 'Commands & Actions';
        resultsContainer.appendChild(actionHeader);

        actions.forEach((item) => {
            const index = cmdPaletteItems.indexOf(item);
            resultsContainer.appendChild(createPaletteRow(item, index));
        });
    }

    // Render Notes Group
    if (matchedNotes.length > 0) {
        const notesHeader = document.createElement('div');
        notesHeader.className = 'px-3 pt-3 pb-1 text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono';
        notesHeader.textContent = 'Jump to Note';
        resultsContainer.appendChild(notesHeader);

        matchedNotes.forEach((item) => {
            const index = cmdPaletteItems.indexOf(item);
            resultsContainer.appendChild(createPaletteRow(item, index));
        });
    }
}

function createPaletteRow(item, index) {
    const isSelected = index === cmdPaletteSelectedIndex;

    const row = document.createElement('div');
    row.className = `flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors select-none ${
        isSelected 
            ? 'bg-accent-subtle border border-accent/40 text-content-primary shadow-sm' 
            : 'text-content-secondary hover:bg-white/5 hover:text-content-primary border border-transparent'
    }`;

    const left = document.createElement('div');
    left.className = 'flex items-center gap-3 overflow-hidden flex-1 min-w-0';

    const icon = document.createElement('i');
    icon.className = `${item.icon} text-xs shrink-0 w-4 text-center text-accent-light`;

    const info = document.createElement('div');
    info.className = 'flex flex-col truncate min-w-0';

    const title = document.createElement('span');
    title.className = `truncate font-medium text-xs ${isSelected ? 'text-content-primary' : 'text-content-secondary'}`;
    title.textContent = item.title;

    const subtitle = document.createElement('span');
    subtitle.className = 'truncate text-[11px] text-content-muted font-sans';
    subtitle.textContent = item.subtitle;

    info.appendChild(title);
    info.appendChild(subtitle);
    left.appendChild(icon);
    left.appendChild(info);

    row.appendChild(left);

    if (item.shortcut) {
        const badge = document.createElement('span');
        badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-card border border-border-subtle text-content-muted shrink-0 ml-2';
        badge.textContent = item.shortcut;
        row.appendChild(badge);
    }

    row.onclick = () => {
        closeCommandPalette();
        item.run();
    };

    return row;
}

function updatePaletteSelection() {
    const resultsContainer = document.getElementById('cmdPaletteResults');
    if (!resultsContainer) return;

    const rows = resultsContainer.querySelectorAll('.cursor-pointer');
    rows.forEach((r, idx) => {
        if (idx === cmdPaletteSelectedIndex) {
            r.className = 'flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors select-none bg-accent-subtle border border-accent/40 text-content-primary shadow-sm';
            r.scrollIntoView({ block: 'nearest' });
        } else {
            r.className = 'flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors select-none text-content-secondary hover:bg-white/5 hover:text-content-primary border border-transparent';
        }
    });
}

function executePaletteSelection() {
    if (cmdPaletteItems.length > 0 && cmdPaletteItems[cmdPaletteSelectedIndex]) {
        const item = cmdPaletteItems[cmdPaletteSelectedIndex];
        closeCommandPalette();
        item.run();
    }
}

// -----------------------------------------------------
// Interactive Page Resize Drag Handles
// -----------------------------------------------------
function initPageResizeHandles() {
    // Deprecated in favor of clean 1-click #pageWidthToggleBtn
}

// -----------------------------------------------------
// Initialization & Event Wiring
// -----------------------------------------------------
async function initApp() {
    // 0. Initialize Dark/Light Theme & Page Width from localStorage
    setTheme(getSavedTheme());
    setColorGrade(getSavedColorGrade());
    setPageWidth(getSavedPageWidth());

    // Clean Page Width Toggle Button
    const pageWidthToggleBtn = document.getElementById('pageWidthToggleBtn');
    if (pageWidthToggleBtn) {
        pageWidthToggleBtn.addEventListener('click', togglePageWidth);
    }

    // Dual Sync Scroll Toggle Button
    const syncScrollBtn = document.getElementById('syncScrollBtn');
    if (syncScrollBtn) {
        syncScrollBtn.addEventListener('click', toggleSyncScroll);
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // 1. Load Notes
    await loadNotes();

    // 2. Initialize CodeMirror 6 Editor
    const editorContainer = document.getElementById('editor-container');
    const activeNote = notes.find(n => n.id === currentNoteId);
    await setupEditor(editorContainer, activeNote ? activeNote.content : '', handleEditorChange);

    // 3. Initialize Dual Synchronized Scrolling ("Two Scroll")
    setupDualSyncScroll();

    // Initial Preview Render
    if (activeNote) {
        const previewContainer = document.getElementById('preview-container');
        renderPreview(activeNote.content, previewContainer);
    }

    // 4. Initialize Sidebar Navigation & Folder Hooks
    initCreateItemModalWiring();

    initSidebar({
        onNewNote: (folder) => openCreateItemModal('note', folder || 'Standalone'),
        onNewFolder: () => openCreateItemModal('folder'),
        onDeleteFolder: (folder) => deleteFolder(folder),
        onMoveNoteToFolder: (noteId, folder) => moveNoteToFolder(noteId, folder),
        onSwitchNote: (id) => switchNote(id),
        onTogglePin: (id) => togglePinNote(id),
        onRenameNote: (id) => renameNote(id),
        onDeleteNote: (id) => deleteNote(id),
        onDeleteTag: (tag) => deleteTagGlobal(tag),
        onSearchChange: (q) => renderSidebar(notes, currentNoteId, q, customFolders)
    });
    renderSidebar(notes, currentNoteId, '', customFolders);

    // 4. Initialize Active Note Header & Inputs
    updateActiveNoteHeader(activeNote);

    // Note Title Input (Instant 2-way sync)
    const titleInput = document.getElementById('noteTitleInput');
    if (titleInput) {
        titleInput.addEventListener('input', (e) => {
            const note = notes.find(n => n.id === currentNoteId);
            if (!note) return;
            note.title = e.target.value.trim() || 'Untitled Note';
            renderSidebar(notes, currentNoteId, '', customFolders);
        });

        titleInput.addEventListener('change', async (e) => {
            const note = notes.find(n => n.id === currentNoteId);
            if (!note) return;
            note.title = e.target.value.trim() || 'Untitled Note';
            note.updatedAt = Date.now();
            await window.storageManager.saveNote(note);
            if (note.cloudId) {
                try {
                    await fetch(`/api/pastes/${note.cloudId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: note.title,
                            content: note.content,
                            tags: note.tags || '',
                            isPinned: !!note.isPinned,
                            folder: note.folder || 'General'
                        })
                    });
                } catch (err) {
                    console.warn("Failed to sync title to server", err);
                }
            }
            renderSidebar(notes, currentNoteId, '', customFolders);
        });
    }

    // Formatting Toolbar Handlers (Obsidian + Notion Hybrid)
    const formatToolbar = document.getElementById('formatToolbar');
    if (formatToolbar) {
        formatToolbar.querySelectorAll('.format-btn').forEach(btn => {
            // Prevent CodeMirror from losing focus/selection on mouse click
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const format = btn.getAttribute('data-format');
                if (format) {
                    applyFormatting(format);
                    const content = getEditorContent();
                    const activeNote = notes.find(n => n.id === currentNoteId);
                    if (activeNote) {
                        activeNote.content = content;
                        saveNoteState(activeNote);
                        const previewContainer = document.getElementById('preview-container');
                        if (previewContainer) renderPreview(content, previewContainer);
                    }
                }
            });
        });
    }

    // Interactive Task Checkboxes in Preview (Obsidian Style with Index Matching)
    const previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
        previewContainer.addEventListener('change', (e) => {
            if (e.target && e.target.type === 'checkbox') {
                const checkbox = e.target;
                const isChecked = checkbox.checked;
                const activeNote = notes.find(n => n.id === currentNoteId);
                if (!activeNote) return;

                const lines = activeNote.content.split('\n');

                if (checkbox.dataset.taskIndex !== undefined) {
                    const targetTaskIdx = parseInt(checkbox.dataset.taskIndex, 10);
                    let currentTaskIdx = 0;
                    for (let i = 0; i < lines.length; i++) {
                        if (/^[ \t]*-\s*\[([ xX])\]/.test(lines[i])) {
                            if (currentTaskIdx === targetTaskIdx) {
                                if (isChecked) {
                                    lines[i] = lines[i].replace(/-\s*\[[ ]\]/, '- [x]');
                                } else {
                                    lines[i] = lines[i].replace(/-\s*\[[xX]\]/, '- [ ]');
                                }
                                break;
                            }
                            currentTaskIdx++;
                        }
                    }
                } else {
                    const listItem = checkbox.closest('li');
                    if (!listItem) return;
                    const itemText = listItem.textContent.trim();
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.includes(itemText)) {
                            if (isChecked && line.includes('- [ ]')) {
                                lines[i] = line.replace('- [ ]', '- [x]');
                                break;
                            } else if (!isChecked && line.includes('- [x]')) {
                                lines[i] = line.replace('- [x]', '- [ ]');
                                break;
                            }
                        }
                    }
                }

                const updated = lines.join('\n');
                activeNote.content = updated;
                setEditorContent(updated);
                saveNoteState(activeNote);
            }
        });
    }

    const pinBtn = document.getElementById('pinNoteBtn');
    if (pinBtn) {
        pinBtn.addEventListener('click', () => {
            if (currentNoteId) {
                togglePinNote(currentNoteId);
            }
        });
    }

    const folderSelect = document.getElementById('noteFolderSelect');
    if (folderSelect) {
        folderSelect.addEventListener('change', async (e) => {
            const selectedVal = e.target.value;
            if (selectedVal === '__new__') {
                openCreateItemModal('folder');
                updateFolderSelectOptions(notes.find(n => n.id === currentNoteId));
                return;
            }

            const note = notes.find(n => n.id === currentNoteId);
            if (!note) return;

            note.folder = selectedVal;
            note.updatedAt = Date.now();
            await window.storageManager.saveNote(note);

            if (note.cloudId) {
                try {
                    await fetch(`/api/pastes/${note.cloudId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: note.title,
                            content: note.content,
                            tags: note.tags || '',
                            isPinned: !!note.isPinned,
                            folder: note.folder
                        })
                    });
                } catch (err) {
                    console.warn("Failed to sync folder to server", err);
                }
            }

            renderSidebar(notes, currentNoteId, '', customFolders);
        });
    }

    const tagsInput = document.getElementById('noteTagsInput');
    if (tagsInput) {
        tagsInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = tagsInput.value.trim().replace(/^#/, '').replace(/,/g, '');
                if (val) {
                    await addTagToActiveNote(val);
                    tagsInput.value = '';
                }
            }
        });
        tagsInput.addEventListener('blur', async () => {
            const val = tagsInput.value.trim().replace(/^#/, '').replace(/,/g, '');
            if (val) {
                await addTagToActiveNote(val);
                tagsInput.value = '';
            }
        });
    }

    // 5. Command Palette Wiring
    const cmdPaletteBtn = document.getElementById('cmdPaletteTriggerBtn');
    if (cmdPaletteBtn) {
        cmdPaletteBtn.addEventListener('click', openCommandPalette);
    }

    const cmdPaletteOverlay = document.getElementById('cmdPaletteOverlay');
    if (cmdPaletteOverlay) {
        cmdPaletteOverlay.addEventListener('click', (e) => {
            if (e.target === cmdPaletteOverlay) {
                closeCommandPalette();
            }
        });
    }

    const cmdPaletteInput = document.getElementById('cmdPaletteInput');
    if (cmdPaletteInput) {
        cmdPaletteInput.addEventListener('input', (e) => {
            cmdPaletteSelectedIndex = 0;
            renderCommandPaletteResults(e.target.value);
        });

        cmdPaletteInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (cmdPaletteItems.length > 0) {
                    cmdPaletteSelectedIndex = (cmdPaletteSelectedIndex + 1) % cmdPaletteItems.length;
                    updatePaletteSelection();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (cmdPaletteItems.length > 0) {
                    cmdPaletteSelectedIndex = (cmdPaletteSelectedIndex - 1 + cmdPaletteItems.length) % cmdPaletteItems.length;
                    updatePaletteSelection();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executePaletteSelection();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeCommandPalette();
            }
        });
    }

    // 6. Initialize Modals
    initDiagramModal();

    // 7. Split-Screen Resizer
    const resizer = document.getElementById('resizer');
    const editorSection = document.getElementById('editor-section');
    const previewSection = document.getElementById('preview-section');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    if (resizer && editorSection && previewSection) {
        resizer.addEventListener('mousedown', () => {
            if (currentLayoutMode !== 'split') return;
            isResizing = true;
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing || currentLayoutMode !== 'split') return;
            const sidebarWidth = (sidebar && !sidebar.classList.contains('-translate-x-full')) ? sidebar.offsetWidth : 0;
            let newWidth = e.clientX - sidebarWidth;
            if (newWidth < 120) newWidth = 120;
            const maxWidth = window.innerWidth - sidebarWidth - 120;
            if (newWidth > maxWidth) newWidth = maxWidth;

            editorSection.classList.remove('w-1/2');
            editorSection.style.width = `${newWidth}px`;
            editorSection.style.flex = 'none';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
            }
        });
    }

    // 8. Preview Interactive Element Delegation
    if (previewContainer) {
        previewContainer.addEventListener('click', (e) => {
            if (e.target.matches('.toggle-view-btn')) {
                const btn = e.target;
                const rawId = btn.getAttribute('data-raw-id');
                const prevId = btn.getAttribute('data-prev-id');
                const mode = btn.getAttribute('data-mode');
                if (rawId && prevId && mode) {
                    toggleBlockView(btn, rawId, prevId, mode);
                }
                return;
            }

            const copyBtn = e.target.closest('.copy-code-btn');
            if (copyBtn) {
                const code = copyBtn.getAttribute('data-code');
                if (code) {
                    copyToClipboard(copyBtn, code);
                }
                return;
            }

            const thinkHeader = e.target.closest('.think-header');
            if (thinkHeader && thinkHeader.parentElement) {
                thinkHeader.parentElement.classList.toggle('expanded');
                return;
            }
        });
    }
}

// Ensure initApp runs whether DOMContentLoaded has already fired or not
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// -----------------------------------------------------
// Keyboard Shortcuts & Unsaved Changes Guard
// -----------------------------------------------------
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
});

document.addEventListener('keydown', async (e) => {
    // ⌘K or Ctrl+K: Open Command Palette
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (isCmdPaletteOpen) {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
        return;
    }

    // Ctrl+S / Cmd+S: Save current note immediately
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (currentNoteId) {
            clearTimeout(saveTimeout);
            const content = getEditorContent();
            await saveNoteContent(currentNoteId, content);
            hasUnsavedChanges = false;
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fa-solid fa-check text-emerald-400 mr-1.5"></i>Saved!';
                setTimeout(() => {
                    saveStatus.innerHTML = '<i class="fa-solid fa-cloud mr-1.5 text-indigo-400"></i> Auto-Save';
                }, 1500);
            }
        }
        return;
    }

    // Editor Formatting Shortcuts (Ctrl+B, Ctrl+I, Ctrl+E, Ctrl+Shift+X)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !isCmdPaletteOpen) {
        const key = e.key.toLowerCase();
        if (key === 'b') {
            e.preventDefault();
            applyFormatting('bold');
            const content = getEditorContent();
            const previewContainer = document.getElementById('preview-container');
            if (previewContainer) renderPreview(content, previewContainer);
            return;
        }
        if (key === 'i') {
            e.preventDefault();
            applyFormatting('italic');
            const content = getEditorContent();
            const previewContainer = document.getElementById('preview-container');
            if (previewContainer) renderPreview(content, previewContainer);
            return;
        }
        if (key === 'e') {
            e.preventDefault();
            applyFormatting('code');
            const content = getEditorContent();
            const previewContainer = document.getElementById('preview-container');
            if (previewContainer) renderPreview(content, previewContainer);
            return;
        }
        if (e.shiftKey && key === 'x') {
            e.preventDefault();
            applyFormatting('strike');
            const content = getEditorContent();
            const previewContainer = document.getElementById('preview-container');
            if (previewContainer) renderPreview(content, previewContainer);
            return;
        }
    }

    // Alt+N / Option+N: Create new item modal
    if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        openCreateItemModal('note', 'Standalone');
        return;
    }

    // Escape: Close Command Palette or Create Item modal or diagram modal or palette popover or clear search
    if (e.key === 'Escape') {
        const createItemOverlay = document.getElementById('createItemOverlay');
        if (createItemOverlay && !createItemOverlay.classList.contains('hidden')) {
            closeCreateItemModal();
            return;
        }
        const themePalettePopover = document.getElementById('themePalettePopover');
        if (themePalettePopover && !themePalettePopover.classList.contains('hidden')) {
            themePalettePopover.classList.add('hidden');
            return;
        }
        if (isCmdPaletteOpen) {
            closeCommandPalette();
            return;
        }
        closeDiagramModal();
        const searchInput = document.getElementById('noteSearchInput');
        if (searchInput && document.activeElement === searchInput) {
            clearSearch();
            renderSidebar(notes, currentNoteId, '', customFolders);
            searchInput.blur();
        }
    }
});
