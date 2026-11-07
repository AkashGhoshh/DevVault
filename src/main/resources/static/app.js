// DevVault — Main Application Controller & Orchestrator

import { setupEditor, setEditorContent, getEditorContent, focusEditor } from './editor.js';
import { renderPreview, copyToClipboard, toggleBlockView } from './markdown.js';
import { initSidebar, renderSidebar, clearSearch } from './sidebar.js';
import { showDialog, initDiagramModal, closeDiagramModal } from './modals.js';

// State Management
let notes = [];
let currentNoteId = null;
let saveTimeout = null;
let renderTimeout = null;
let hasUnsavedChanges = false;

function generateId() {
    return 'note_' + Math.random().toString(36).substr(2, 9);
}

// -----------------------------------------------------
// Storage & API Sync
// -----------------------------------------------------
async function loadNotes() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const currentPasteId = urlParams.get('id') || null;

        if (currentPasteId) {
            const res = await fetch(`/api/pastes/${currentPasteId}`);
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
            }
        } else {
            const storedNotes = await window.storageManager.loadNotes();
            if (storedNotes && storedNotes.length > 0) {
                notes = storedNotes;
            } else {
                notes = [{
                    id: generateId(),
                    parentId: null,
                    title: 'Welcome Note',
                    content: `# Welcome to Dev Vault 🚀\n\nYour lightweight developer notebook.\n\n- Instant Local-first persistence\n- Fast Markdown & Mermaid rendering\n- Clean REST CRUD backend\n\n\`\`\`javascript\nconsole.log("Happy Coding!");\n\`\`\``,
                    updatedAt: Date.now(),
                    isExpanded: true
                }];
                await window.storageManager.saveNote(notes[0]);
            }
        }

        if (notes.length > 0) {
            currentNoteId = notes[0].id;
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
    if (firstLine && (note.title === 'Untitled Note' || note.title === 'Welcome Note')) {
        note.title = firstLine.substring(0, 30);
    }

    await window.storageManager.saveNote(note);

    // Sync to backend if cloud-linked or newly saved
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
    } catch (e) {
        console.warn("Backend sync failed; local copy saved.", e);
    }

    renderSidebar(notes, currentNoteId);
}

async function saveNoteState(note) {
    note.updatedAt = Date.now();
    await window.storageManager.saveNote(note);
    renderSidebar(notes, currentNoteId);
}

// -----------------------------------------------------
// Note Actions
// -----------------------------------------------------
export async function createNewNote(parentId = null) {
    const newNote = {
        id: generateId(),
        parentId: parentId,
        title: 'Untitled Note',
        content: '',
        updatedAt: Date.now(),
        isExpanded: true
    };

    if (parentId) {
        const parentNote = notes.find(n => n.id === parentId);
        if (parentNote) {
            parentNote.isExpanded = true;
            await saveNoteState(parentNote);
        }
    }

    notes.push(newNote);
    await window.storageManager.saveNote(newNote);
    switchNote(newNote.id);
    renderSidebar(notes, currentNoteId);
}
window.createNewNote = createNewNote;

export function switchNote(id) {
    currentNoteId = id;
    const note = notes.find(n => n.id === id);
    if (!note) return;

    setEditorContent(note.content);
    handleEditorChange(note.content);
    renderSidebar(notes, currentNoteId);
}

export async function renameNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    const newTitle = prompt("Enter new title:", note.title);
    if (newTitle && newTitle.trim()) {
        note.title = newTitle.trim();
        await saveNoteState(note);
    }
}

export async function deleteNote(id) {
    if (notes.length <= 1) {
        await showDialog('You must have at least one note.', 'alert', 'Cannot Delete');
        return;
    }

    const isConfirmed = await showDialog('Are you sure you want to delete this note and any sub-notes?', 'confirm', 'Delete Note');
    if (!isConfirmed) return;

    function getAllChildrenIds(parentId) {
        let ids = [parentId];
        const children = notes.filter(n => n.parentId === parentId);
        for (let child of children) {
            ids = ids.concat(getAllChildrenIds(child.id));
        }
        return ids;
    }

    const idsToDelete = getAllChildrenIds(id);
    for (let deleteId of idsToDelete) {
        notes = notes.filter(n => n.id !== deleteId);
        await window.storageManager.deleteNote(deleteId);
    }

    if (currentNoteId === id || idsToDelete.includes(currentNoteId)) {
        currentNoteId = notes.length > 0 ? notes[0].id : null;
        if (currentNoteId) {
            switchNote(currentNoteId);
        }
    }

    renderSidebar(notes, currentNoteId);
}

export async function toggleExpand(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.isExpanded = !note.isExpanded;
        await saveNoteState(note);
    }
}

// -----------------------------------------------------
// Editor Change Handler (Debounced)
// -----------------------------------------------------
function handleEditorChange(content) {
    hasUnsavedChanges = true;
    clearTimeout(saveTimeout);

    if (currentNoteId) {
        saveTimeout = setTimeout(async () => {
            await saveNoteContent(currentNoteId, content);
            hasUnsavedChanges = false;

            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fa-solid fa-check text-green-400 mr-1.5"></i>Saved';
                setTimeout(() => {
                    saveStatus.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i> Local Save';
                }, 1500);
            }
        }, 800);
    }

    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        const previewContainer = document.getElementById('preview-container');
        renderPreview(content, previewContainer);
    }, 300);
}

// -----------------------------------------------------
// App Mode (Edit vs Read)
// -----------------------------------------------------
export function toggleAppMode(mode) {
    const editBtn = document.getElementById('modeEditBtn');
    const readBtn = document.getElementById('modeReadBtn');
    const editorSection = document.getElementById('editor-section');
    const previewSection = document.getElementById('preview-section');

    if (mode === 'read') {
        readBtn.classList.add('bg-slate-700', 'text-white', 'shadow-sm');
        readBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');

        editBtn.classList.remove('bg-slate-700', 'text-white', 'shadow-sm');
        editBtn.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');

        editorSection.classList.add('hidden');
        editorSection.classList.remove('w-1/2');
        previewSection.classList.remove('w-1/2');
        previewSection.classList.add('w-full');
    } else {
        editBtn.classList.add('bg-slate-700', 'text-white', 'shadow-sm');
        editBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');

        readBtn.classList.remove('bg-slate-700', 'text-white', 'shadow-sm');
        readBtn.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');

        editorSection.classList.remove('hidden');
        editorSection.classList.add('w-1/2');
        previewSection.classList.remove('w-full');
        previewSection.classList.add('w-1/2');
    }
}
window.toggleAppMode = toggleAppMode;

// -----------------------------------------------------
// Initialization & Event Wiring
// -----------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await loadNotes();

    // 1. Initialize CodeMirror 6 Editor
    const editorContainer = document.getElementById('editor-container');
    const activeNote = notes.find(n => n.id === currentNoteId);
    await setupEditor(editorContainer, activeNote ? activeNote.content : '', handleEditorChange);

    // Initial Preview Render
    if (activeNote) {
        const previewContainer = document.getElementById('preview-container');
        renderPreview(activeNote.content, previewContainer);
    }

    // 2. Initialize Sidebar Navigation
    initSidebar({
        onNewNote: () => createNewNote(null),
        onSwitchNote: (id) => switchNote(id),
        onToggleExpand: (id) => toggleExpand(id),
        onCreateSubNote: (parentId) => createNewNote(parentId),
        onRenameNote: (id) => renameNote(id),
        onDeleteNote: (id) => deleteNote(id),
        onSearchChange: (q) => renderSidebar(notes, currentNoteId, q)
    });
    renderSidebar(notes, currentNoteId);

    // 3. Initialize Modals
    initDiagramModal();

    // 4. Split-Screen Resizer
    const resizer = document.getElementById('resizer');
    const editorSection = document.getElementById('editor-section');
    const previewSection = document.getElementById('preview-section');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    if (resizer && editorSection && previewSection) {
        resizer.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            editorSection.classList.remove('transition-all', 'duration-300');
            previewSection.classList.remove('transition-all', 'duration-300');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const sidebarWidth = (sidebar && !sidebar.classList.contains('-translate-x-full')) ? sidebar.offsetWidth : 0;
            let newWidth = e.clientX - sidebarWidth;
            if (newWidth < 100) newWidth = 100;
            const maxWidth = window.innerWidth - sidebarWidth - 100;
            if (newWidth > maxWidth) newWidth = maxWidth;

            editorSection.classList.remove('w-1/2');
            editorSection.style.width = `${newWidth}px`;
            editorSection.style.flex = 'none';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                editorSection.classList.add('transition-all', 'duration-300');
                previewSection.classList.add('transition-all', 'duration-300');
            }
        });
    }

    // 5. Preview Interactive Element Delegation
    const previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
        previewContainer.addEventListener('click', (e) => {
            // Code block view toggle (Raw vs Preview)
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

            // Copy code buttons
            const copyBtn = e.target.closest('.copy-code-btn');
            if (copyBtn) {
                const code = copyBtn.getAttribute('data-code');
                if (code) {
                    copyToClipboard(copyBtn, code);
                }
                return;
            }

            // Think tag accordions
            const thinkHeader = e.target.closest('.think-header');
            if (thinkHeader && thinkHeader.parentElement) {
                thinkHeader.parentElement.classList.toggle('expanded');
                return;
            }
        });
    }
});

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
        createNewNote(null);
    }

    // Escape: Close diagram modal or clear search
    if (e.key === 'Escape') {
        closeDiagramModal();
        const searchInput = document.getElementById('noteSearchInput');
        if (searchInput && document.activeElement === searchInput) {
            clearSearch();
            renderSidebar(notes, currentNoteId);
            searchInput.blur();
        }
    }
});
