// DevVault — Sidebar & Note Tree Navigation Module

let callbacks = {};
let searchQuery = '';

export function initSidebar(cbs = {}) {
    callbacks = cbs;

    // 1. New Note Button
    const newBtn = document.getElementById('newNoteBtn');
    if (newBtn && callbacks.onNewNote) {
        newBtn.addEventListener('click', () => callbacks.onNewNote(null));
    }

    // 2. Search Input & Clear Button
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

    // 3. Sidebar Toggle Open/Close
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
}

export function clearSearch() {
    const searchInput = document.getElementById('noteSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    searchQuery = '';
}

export function renderSidebar(notes = [], currentNoteId = null, query = searchQuery) {
    const listEl = document.getElementById('notesList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const cleanQuery = (query || '').trim().toLowerCase();

    // Flat list if searching
    if (cleanQuery) {
        const matches = notes.filter(n =>
            (n.title && n.title.toLowerCase().includes(cleanQuery)) ||
            (n.content && n.content.toLowerCase().includes(cleanQuery))
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
            item.onclick = () => callbacks.onSwitchNote && callbacks.onSwitchNote(note.id);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = `flex gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity items-center`;

            const delBtn = document.createElement('i');
            delBtn.className = 'fa-solid fa-trash text-[10px] text-slate-500 hover:text-red-400 p-1';
            delBtn.title = 'Delete';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onDeleteNote && callbacks.onDeleteNote(note.id);
            };
            actionsDiv.appendChild(delBtn);

            item.appendChild(leftDiv);
            item.appendChild(actionsDiv);
            itemContainer.appendChild(item);
            listEl.appendChild(itemContainer);
        });
        return;
    }

    // Tree view if not searching
    function renderTree(parentId, containerEl, level) {
        const children = notes.filter(n => n.parentId === parentId);
        children.sort((a, b) => b.updatedAt - a.updatedAt);

        children.forEach(note => {
            const isActive = note.id === currentNoteId;
            const hasChildren = notes.some(n => n.parentId === note.id);

            const itemContainer = document.createElement('div');
            itemContainer.className = 'flex flex-col';

            const item = document.createElement('div');
            item.className = `group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${isActive ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`;
            item.style.paddingLeft = `${level * 16 + 8}px`;

            const leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-2 overflow-hidden';

            const expandIcon = document.createElement('i');
            expandIcon.className = `fa-solid fa-chevron-right text-[10px] w-4 text-center transition-transform ${note.isExpanded ? 'rotate-90' : ''} ${hasChildren ? 'text-slate-500 hover:text-white' : 'opacity-0'}`;
            if (hasChildren) {
                expandIcon.onclick = (e) => {
                    e.stopPropagation();
                    callbacks.onToggleExpand && callbacks.onToggleExpand(note.id);
                };
            }

            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate max-w-[120px] flex-1';
            titleSpan.textContent = note.title;

            leftDiv.appendChild(expandIcon);
            leftDiv.appendChild(titleSpan);
            item.onclick = () => callbacks.onSwitchNote && callbacks.onSwitchNote(note.id);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = `flex gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity items-center`;

            const addBtn = document.createElement('i');
            addBtn.className = 'fa-solid fa-plus text-[10px] text-slate-500 hover:text-accent p-1';
            addBtn.title = 'Add Sub-Tab';
            addBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onCreateSubNote && callbacks.onCreateSubNote(note.id);
            };

            const editBtn = document.createElement('i');
            editBtn.className = 'fa-solid fa-pen text-[10px] text-slate-500 hover:text-accent p-1';
            editBtn.title = 'Rename';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onRenameNote && callbacks.onRenameNote(note.id);
            };

            const delBtn = document.createElement('i');
            delBtn.className = 'fa-solid fa-trash text-[10px] text-slate-500 hover:text-red-400 p-1';
            delBtn.title = 'Delete';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onDeleteNote && callbacks.onDeleteNote(note.id);
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
