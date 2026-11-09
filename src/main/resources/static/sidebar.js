// DevVault — Sidebar, Note Navigation, Smart Tags, Real Folders & Pinned Favorites
// Impeccable Craft & UI-UX Pro Max Polish

let callbacks = {};
let searchQuery = '';
let selectedTag = '';
const collapsedFolders = new Set();

export function initSidebar(cbs = {}) {
    callbacks = cbs;

    // 1. New Note Button
    const newBtn = document.getElementById('newNoteBtn');
    if (newBtn && callbacks.onNewNote) {
        newBtn.addEventListener('click', () => callbacks.onNewNote(null));
    }

    // 2. New Folder Button
    const newFolderBtn = document.getElementById('newFolderBtn');
    if (newFolderBtn && callbacks.onNewFolder) {
        newFolderBtn.addEventListener('click', () => callbacks.onNewFolder());
    }

    // 3. Search Input & Clear Button
    const searchInput = document.getElementById('noteSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            if (clearBtn) {
                if (searchQuery.length > 0) {
                    clearBtn.classList.remove('hidden');
                } else {
                    clearBtn.classList.add('hidden');
                }
            }
            if (callbacks.onSearchChange) {
                callbacks.onSearchChange(searchQuery);
            }
        });
    }

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearBtn.classList.add('hidden');
            if (callbacks.onSearchChange) {
                callbacks.onSearchChange('');
            }
            searchInput.focus();
        });
    }

    // 4. Sidebar Toggle Open/Close
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    let isSidebarOpen = true;

    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            isSidebarOpen = !isSidebarOpen;
            if (isSidebarOpen) {
                sidebar.classList.remove('w-0', '-translate-x-full');
                sidebar.classList.add('w-64', 'translate-x-0');
                sidebar.removeAttribute('inert');
            } else {
                sidebar.classList.remove('w-64', 'translate-x-0');
                sidebar.classList.add('w-0', '-translate-x-full');
                sidebar.setAttribute('inert', '');
            }
        });
    }
}

export function clearSearch() {
    const searchInput = document.getElementById('noteSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    searchQuery = '';
}

export function getSelectedTag() {
    return selectedTag;
}

export function setSelectedTag(tag) {
    selectedTag = tag || '';
}

function renderTagChips(notes, currentNoteId) {
    const chipsBar = document.getElementById('tagChipsBar');
    if (!chipsBar) return;

    // Collect distinct tags
    const tagSet = new Set();
    notes.forEach(note => {
        if (note.tags && typeof note.tags === 'string') {
            note.tags.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).forEach(t => {
                if (t.length > 0) tagSet.add(t);
            });
        }
    });

    const tags = Array.from(tagSet).sort();
    chipsBar.innerHTML = '';

    if (tags.length === 0) {
        chipsBar.classList.add('hidden');
        return;
    }
    chipsBar.classList.remove('hidden');

    // '#all' Chip
    const allChip = document.createElement('button');
    const isAllActive = selectedTag === '';
    allChip.className = `px-2 py-0.5 rounded-full font-mono text-[10px] shrink-0 transition-all ${
        isAllActive 
            ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30' 
            : 'bg-card border border-border-subtle text-content-secondary hover:text-content-primary hover:border-border-strong'
    }`;
    allChip.textContent = '#all';
    allChip.onclick = () => {
        selectedTag = '';
        renderSidebar(notes, currentNoteId, searchQuery);
    };
    chipsBar.appendChild(allChip);

    // Individual Tag Chips (with click-to-filter & hover delete button)
    tags.forEach(tag => {
        const isTagActive = selectedTag === tag;
        const chip = document.createElement('div');
        chip.className = `group/chip flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] shrink-0 transition-all cursor-pointer ${
            isTagActive 
                ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30' 
                : 'bg-card border border-border-subtle text-content-secondary hover:text-content-primary hover:border-border-strong'
        }`;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = `#${tag}`;
        labelSpan.onclick = () => {
            selectedTag = (selectedTag === tag) ? '' : tag;
            renderSidebar(notes, currentNoteId, searchQuery);
        };
        chip.appendChild(labelSpan);

        // Delete tag button (cross icon)
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = `w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] transition-all ${
            isTagActive 
                ? 'text-white/70 hover:text-white hover:bg-black/20' 
                : 'text-content-muted hover:text-rose-400 hover:bg-rose-500/10'
        }`;
        delBtn.title = `Delete #${tag} from all notes`;
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (callbacks.onDeleteTag) {
                callbacks.onDeleteTag(tag);
            }
        };
        chip.appendChild(delBtn);

        chipsBar.appendChild(chip);
    });
}

function parseNoteTags(tagsStr) {
    if (!tagsStr || typeof tagsStr !== 'string') return [];
    return tagsStr.split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(t => t.length > 0);
}

function createNoteItemElement(note, currentNoteId, isPinnedSection = false) {
    const isActive = String(note.id) === String(currentNoteId);
    const isPinned = !!note.isPinned;

    const itemContainer = document.createElement('div');
    itemContainer.className = 'flex flex-col mb-0.5';

    const item = document.createElement('div');
    item.className = `group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-xs ${
        isActive 
            ? 'active-note-item font-medium pl-2 shadow-sm' 
            : 'text-content-secondary hover:bg-white/5 hover:text-content-primary'
    }`;

    // Left info
    const leftDiv = document.createElement('div');
    leftDiv.className = 'flex items-center gap-2 overflow-hidden flex-1 min-w-0';

    const icon = document.createElement('i');
    if (isPinned) {
        icon.className = 'fa-solid fa-thumbtack text-[10px] text-amber-400 shrink-0';
    } else {
        icon.className = 'fa-regular fa-file-lines text-[10px] text-content-muted shrink-0';
    }

    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex flex-col truncate min-w-0';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'truncate text-xs leading-tight';
    titleSpan.textContent = note.title || 'Untitled Note';
    titleContainer.appendChild(titleSpan);

    // Tags subtext
    const noteTags = parseNoteTags(note.tags);
    if (noteTags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'flex items-center gap-1 mt-0.5 overflow-hidden';
        noteTags.slice(0, 2).forEach(t => {
            const tagBadge = document.createElement('span');
            tagBadge.className = 'text-[9px] font-mono px-1 py-0 rounded bg-[var(--code-inline-bg)] text-[var(--code-inline-text)] border border-[var(--code-inline-border)] shrink-0';
            tagBadge.textContent = `#${t}`;
            tagsContainer.appendChild(tagBadge);
        });
        if (noteTags.length > 2) {
            const moreBadge = document.createElement('span');
            moreBadge.className = 'text-[8px] text-content-muted font-mono';
            moreBadge.textContent = `+${noteTags.length - 2}`;
            tagsContainer.appendChild(moreBadge);
        }
        titleContainer.appendChild(tagsContainer);
    }

    leftDiv.appendChild(icon);
    leftDiv.appendChild(titleContainer);

    // Drag and Drop support
    item.setAttribute('draggable', 'true');
    item.dataset.noteId = note.id;
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', note.id);
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('opacity-40', 'scale-[0.98]');
        document.body.classList.add('is-dragging-note');
    });
    item.addEventListener('dragend', () => {
        item.classList.remove('opacity-40', 'scale-[0.98]');
        document.body.classList.remove('is-dragging-note');
        document.querySelectorAll('.drop-target-active').forEach(el => el.classList.remove('drop-target-active'));
    });

    item.onclick = () => callbacks.onSwitchNote && callbacks.onSwitchNote(note.id);

    // Action buttons on right
    const actionsDiv = document.createElement('div');
    actionsDiv.className = `flex items-center gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity shrink-0 ml-1`;

    // Pin Toggle Button
    const pinBtn = document.createElement('button');
    pinBtn.className = `p-1 hover:text-amber-300 transition-colors ${isPinned ? 'text-amber-400' : 'text-content-muted hover:text-amber-400'}`;
    pinBtn.title = isPinned ? 'Unpin note' : 'Pin note to top';
    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack text-[10px]"></i>';
    pinBtn.onclick = (e) => {
        e.stopPropagation();
        callbacks.onTogglePin && callbacks.onTogglePin(note.id);
    };

    // Rename Button
    const editBtn = document.createElement('button');
    editBtn.className = 'p-1 text-content-muted hover:text-accent-light transition-colors';
    editBtn.title = 'Rename';
    editBtn.innerHTML = '<i class="fa-solid fa-pen text-[9px]"></i>';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        callbacks.onRenameNote && callbacks.onRenameNote(note.id);
    };

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'p-1 text-content-muted hover:text-rose-400 transition-colors';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '<i class="fa-solid fa-trash text-[9px]"></i>';
    delBtn.onclick = (e) => {
        e.stopPropagation();
        callbacks.onDeleteNote && callbacks.onDeleteNote(note.id);
    };

    actionsDiv.appendChild(pinBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);

    item.appendChild(leftDiv);
    item.appendChild(actionsDiv);
    itemContainer.appendChild(item);

    return itemContainer;
}

export function renderSidebar(notes = [], currentNoteId = null, query = searchQuery, knownFolders = []) {
    const listEl = document.getElementById('notesList');
    if (!listEl) return;
    listEl.innerHTML = '';

    // Render tag chips bar
    renderTagChips(notes, currentNoteId);

    const cleanQuery = (query || '').trim().toLowerCase();
    const isSearching = cleanQuery.length > 0 || selectedTag.length > 0;

    // 1. Filter by Search Query
    let filtered = notes;
    if (cleanQuery) {
        filtered = filtered.filter(n =>
            (n.title && n.title.toLowerCase().includes(cleanQuery)) ||
            (n.content && n.content.toLowerCase().includes(cleanQuery)) ||
            (n.tags && n.tags.toLowerCase().includes(cleanQuery)) ||
            (n.folder && n.folder.toLowerCase().includes(cleanQuery))
        );
    }

    // 2. Filter by Selected Tag
    if (selectedTag) {
        filtered = filtered.filter(n => {
            const tags = parseNoteTags(n.tags).map(t => t.toLowerCase());
            return tags.includes(selectedTag.toLowerCase());
        });
    }

    if (filtered.length === 0 && (!knownFolders || knownFolders.length === 0)) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'p-6 text-center text-xs text-content-muted';
        emptyEl.innerHTML = `
            <i class="fa-solid fa-magnifying-glass mb-2 block text-base opacity-40"></i>
            <span>No matching notes found</span>
        `;
        listEl.appendChild(emptyEl);
        return;
    }

    // Pinned notes
    const pinnedNotes = filtered.filter(n => !!n.isPinned);
    pinnedNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // A. Render Pinned Section (if any pinned notes exist)
    if (pinnedNotes.length > 0) {
        const pinnedSection = document.createElement('div');
        pinnedSection.className = 'mb-2';

        const pinnedHeader = document.createElement('div');
        pinnedHeader.className = 'px-2 pt-1 pb-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 select-none';
        pinnedHeader.innerHTML = '<i class="fa-solid fa-thumbtack text-[9px]"></i><span>Pinned Favorites</span>';
        pinnedSection.appendChild(pinnedHeader);

        pinnedNotes.forEach(note => {
            pinnedSection.appendChild(createNoteItemElement(note, currentNoteId, true));
        });

        listEl.appendChild(pinnedSection);

        // Separator between pinned and folders
        const separator = document.createElement('div');
        separator.className = 'my-2 border-t border-border-subtle';
        listEl.appendChild(separator);
    }

    // 1. Separate Standalone Notes from Folder Notes
    const standaloneNotes = filtered.filter(n => !n.folder || n.folder.trim() === '' || n.folder.trim() === 'Standalone');
    standaloneNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const folderNotes = filtered.filter(n => n.folder && n.folder.trim() !== '' && n.folder.trim() !== 'Standalone');

    // Group Folder Notes by Folder
    const folderMap = new Map();
    folderMap.set('General', []);

    if (Array.isArray(knownFolders)) {
        knownFolders.forEach(f => {
            if (f && f.trim() && f.trim() !== 'Standalone') {
                folderMap.set(f.trim(), []);
            }
        });
    }

    folderNotes.forEach(note => {
        const folderName = note.folder.trim();
        if (!folderMap.has(folderName)) {
            folderMap.set(folderName, []);
        }
        folderMap.get(folderName).push(note);
    });

    // -----------------------------------------------------
    // B. Render Folders Section
    // -----------------------------------------------------
    const foldersSection = document.createElement('div');
    foldersSection.className = 'mb-2';

    const foldersHeader = document.createElement('div');
    foldersHeader.className = 'px-2 pt-1 pb-1 text-[10px] font-bold text-content-muted uppercase tracking-wider flex items-center justify-between select-none';
    foldersHeader.innerHTML = `
        <span class="flex items-center gap-1.5">
            <i class="fa-regular fa-folder text-[9px] text-accent-light"></i>
            <span>Folders</span>
        </span>
        <button class="add-folder-quick-btn p-1 hover:text-accent-light transition-colors text-content-muted text-[10px]" title="Create New Folder">
            <i class="fa-solid fa-folder-plus"></i>
        </button>
    `;
    const addFolderQuickBtn = foldersHeader.querySelector('.add-folder-quick-btn');
    if (addFolderQuickBtn) {
        addFolderQuickBtn.onclick = (e) => {
            e.stopPropagation();
            if (callbacks.onNewFolder) callbacks.onNewFolder();
        };
    }
    foldersSection.appendChild(foldersHeader);

    // Sort folders: 'General' first, then alphabetical
    const sortedFolders = Array.from(folderMap.keys()).sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        return a.localeCompare(b);
    });

    sortedFolders.forEach(folderName => {
        const currentFolderNotes = folderMap.get(folderName) || [];
        currentFolderNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        // When actively searching, always auto-expand folders that contain matching notes
        const isCollapsed = isSearching ? false : collapsedFolders.has(folderName);

        const folderContainer = document.createElement('div');
        folderContainer.className = 'flex flex-col mb-1';

        // Folder Header
        const folderHeader = document.createElement('div');
        folderHeader.className = 'group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors text-xs select-none';

        const leftFolder = document.createElement('div');
        leftFolder.className = 'flex items-center gap-2 overflow-hidden flex-1 min-w-0';

        // Chevron
        const chevronIcon = document.createElement('i');
        chevronIcon.className = `fa-solid fa-chevron-right text-[9px] w-3 text-center transition-transform duration-150 ${
            isCollapsed ? 'text-content-muted' : 'rotate-90 text-accent-light'
        }`;

        // Folder Icon
        const folderIcon = document.createElement('i');
        folderIcon.className = `${
            isCollapsed ? 'fa-solid fa-folder text-content-muted' : 'fa-solid fa-folder-open text-accent-light'
        } text-xs transition-colors`;

        // Folder Title
        const titleSpan = document.createElement('span');
        titleSpan.className = 'font-medium text-content-primary text-xs truncate';
        titleSpan.textContent = folderName;

        // Note Count Badge
        const countBadge = document.createElement('span');
        countBadge.className = 'text-[10px] text-content-muted font-mono px-1.5 py-0.2 rounded-full bg-card border border-border-subtle ml-0.5';
        countBadge.textContent = `${currentFolderNotes.length}`;

        leftFolder.appendChild(chevronIcon);
        leftFolder.appendChild(folderIcon);
        leftFolder.appendChild(titleSpan);
        leftFolder.appendChild(countBadge);

        // Right folder actions: + Note in this folder & Delete empty folder
        const rightFolder = document.createElement('div');
        rightFolder.className = 'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity';

        const addNoteBtn = document.createElement('button');
        addNoteBtn.className = 'p-1 text-content-muted hover:text-accent-light transition-colors';
        addNoteBtn.title = `Add note in "${folderName}"`;
        addNoteBtn.innerHTML = '<i class="fa-solid fa-plus text-[10px]"></i>';
        addNoteBtn.onclick = (e) => {
            e.stopPropagation();
            if (callbacks.onNewNote) {
                callbacks.onNewNote(folderName);
            }
        };
        rightFolder.appendChild(addNoteBtn);

        // Delete button for empty non-General custom folders
        if (currentFolderNotes.length === 0 && folderName !== 'General') {
            const delFolderBtn = document.createElement('button');
            delFolderBtn.className = 'p-1 text-content-muted hover:text-rose-400 transition-colors';
            delFolderBtn.title = `Delete empty folder "${folderName}"`;
            delFolderBtn.innerHTML = '<i class="fa-solid fa-trash text-[9px]"></i>';
            delFolderBtn.onclick = (e) => {
                e.stopPropagation();
                if (callbacks.onDeleteFolder) {
                    callbacks.onDeleteFolder(folderName);
                }
            };
            rightFolder.appendChild(delFolderBtn);
        }

        folderHeader.appendChild(leftFolder);
        folderHeader.appendChild(rightFolder);

        // Drag & Drop target on folder header
        folderHeader.dataset.dropFolder = folderName;
        folderHeader.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            folderHeader.classList.add('drop-target-active');
        });
        folderHeader.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            folderHeader.classList.add('drop-target-active');
        });
        folderHeader.addEventListener('dragleave', (e) => {
            if (!folderHeader.contains(e.relatedTarget)) {
                folderHeader.classList.remove('drop-target-active');
            }
        });
        folderHeader.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            folderHeader.classList.remove('drop-target-active');
            const noteId = e.dataTransfer.getData('text/plain');
            if (noteId && callbacks.onMoveNoteToFolder) {
                callbacks.onMoveNoteToFolder(noteId, folderName);
            }
        });

        // Toggle collapse on header click
        folderHeader.onclick = () => {
            if (collapsedFolders.has(folderName)) {
                collapsedFolders.delete(folderName);
            } else {
                collapsedFolders.add(folderName);
            }
            renderSidebar(notes, currentNoteId, query, knownFolders);
        };

        folderContainer.appendChild(folderHeader);

        // Notes list within folder (when not collapsed)
        if (!isCollapsed) {
            const folderNotesContainer = document.createElement('div');
            folderNotesContainer.className = 'pl-3 mt-0.5 border-l border-border-subtle ml-2.5 flex flex-col gap-0.5';

            if (currentFolderNotes.length === 0) {
                const emptyFolderEl = document.createElement('div');
                emptyFolderEl.className = 'py-1 px-2 text-[11px] text-content-muted italic';
                emptyFolderEl.textContent = 'Empty folder (click + to add note)';
                folderNotesContainer.appendChild(emptyFolderEl);
            } else {
                currentFolderNotes.forEach(note => {
                    folderNotesContainer.appendChild(createNoteItemElement(note, currentNoteId, false));
                });
            }

            folderContainer.appendChild(folderNotesContainer);
        }

        foldersSection.appendChild(folderContainer);
    });

    listEl.appendChild(foldersSection);

    // -----------------------------------------------------
    // C. Render Standalone Files Section
    // -----------------------------------------------------
    const standaloneSection = document.createElement('div');
    standaloneSection.className = 'mt-2 border-t border-border-subtle pt-2 rounded-lg transition-colors';

    // Drag & Drop target on Standalone Files Section
    standaloneSection.dataset.dropFolder = 'Standalone';
    standaloneSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        standaloneSection.classList.add('drop-target-active');
    });
    standaloneSection.addEventListener('dragenter', (e) => {
        e.preventDefault();
        standaloneSection.classList.add('drop-target-active');
    });
    standaloneSection.addEventListener('dragleave', (e) => {
        if (!standaloneSection.contains(e.relatedTarget)) {
            standaloneSection.classList.remove('drop-target-active');
        }
    });
    standaloneSection.addEventListener('drop', (e) => {
        e.preventDefault();
        standaloneSection.classList.remove('drop-target-active');
        const noteId = e.dataTransfer.getData('text/plain');
        if (noteId && callbacks.onMoveNoteToFolder) {
            callbacks.onMoveNoteToFolder(noteId, 'Standalone');
        }
    });

    const standaloneHeader = document.createElement('div');
    standaloneHeader.className = 'px-2 pt-1 pb-1.5 text-[10px] font-bold text-content-muted uppercase tracking-wider flex items-center justify-between select-none';
    standaloneHeader.innerHTML = `
        <span class="flex items-center gap-1.5">
            <i class="fa-regular fa-file-lines text-[9px] text-content-muted"></i>
            <span>Standalone Files</span>
            <span class="text-[9px] font-mono text-content-muted px-1.5 py-0.2 rounded-full bg-card border border-border-subtle font-normal ml-0.5">${standaloneNotes.length}</span>
        </span>
        <button class="add-standalone-quick-btn p-1 hover:text-accent-light transition-colors text-content-muted text-[10px]" title="Create Standalone Note">
            <i class="fa-solid fa-plus"></i>
        </button>
    `;
    const addStandaloneQuickBtn = standaloneHeader.querySelector('.add-standalone-quick-btn');
    if (addStandaloneQuickBtn) {
        addStandaloneQuickBtn.onclick = (e) => {
            e.stopPropagation();
            if (callbacks.onNewNote) callbacks.onNewNote('Standalone');
        };
    }
    standaloneSection.appendChild(standaloneHeader);

    if (standaloneNotes.length === 0) {
        const emptyStandaloneEl = document.createElement('div');
        emptyStandaloneEl.className = 'py-1 px-2 text-[11px] text-content-muted italic';
        emptyStandaloneEl.textContent = 'No standalone files';
        standaloneSection.appendChild(emptyStandaloneEl);
    } else {
        const standaloneContainer = document.createElement('div');
        standaloneContainer.className = 'flex flex-col gap-0.5';
        standaloneNotes.forEach(note => {
            standaloneContainer.appendChild(createNoteItemElement(note, currentNoteId, false));
        });
        standaloneSection.appendChild(standaloneContainer);
    }

    listEl.appendChild(standaloneSection);
}
