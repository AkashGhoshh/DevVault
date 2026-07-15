// Global Storage UI Controls
window.openStorageSettings = function () {
    const modal = document.getElementById('storageModal');
    const content = document.getElementById('storageModalContent');
    modal.classList.remove('hidden');

    // Trigger animation
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);

    // Check if migration is possible
    const currentMode = localStorage.getItem('dumpyard_storage_mode') || 'localstorage';
    const migrationSection = document.getElementById('migrationSection');
    if (currentMode === 'localfolder') {
        migrationSection.classList.remove('hidden');
    } else {
        migrationSection.classList.add('hidden');
    }
}

window.closeStorageSettings = function () {
    const modal = document.getElementById('storageModal');
    const content = document.getElementById('storageModalContent');

    // Trigger animation
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// Ensure closing when clicking outside
document.getElementById('storageModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'storageModal') {
        window.closeStorageSettings();
    }
});

// Helper utilities for Markdown storage with Frontmatter
function noteToMarkdown(noteObj) {
    const frontmatter = [
        '---',
        `id: ${noteObj.id}`,
        `parentId: ${noteObj.parentId || 'null'}`,
        `title: ${noteObj.title || 'Untitled Note'}`,
        `updatedAt: ${noteObj.updatedAt}`,
        `isExpanded: ${noteObj.isExpanded}`,
        '---'
    ].join('\n');
    return `${frontmatter}\n${noteObj.content || ''}`;
}

function markdownToNote(markdownStr) {
    const note = {
        id: null,
        parentId: null,
        title: 'Untitled Note',
        content: '',
        updatedAt: Date.now(),
        isExpanded: false
    };

    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = markdownStr.match(frontmatterRegex);

    if (match) {
        const yamlStr = match[1];
        note.content = match[2];
        const lines = yamlStr.split('\n');
        lines.forEach(line => {
            const splitIdx = line.indexOf(':');
            if (splitIdx > -1) {
                const key = line.substring(0, splitIdx).trim();
                let val = line.substring(splitIdx + 1).trim();
                if (key === 'id') note.id = val;
                else if (key === 'parentId') note.parentId = val === 'null' ? null : val;
                else if (key === 'title') note.title = val;
                else if (key === 'updatedAt') note.updatedAt = parseInt(val, 10) || Date.now();
                else if (key === 'isExpanded') note.isExpanded = val === 'true';
            }
        });
    } else {
        note.content = markdownStr;
    }
    return note;
}

class StorageManager {
    constructor() {
        this.mode = localStorage.getItem('dumpyard_storage_mode') || 'localstorage';
        this.localDirHandle = null;
        this.gapiInited = false;
        this.gisInited = false;

        // TODO: The user will need to configure this Client ID.
        this.CLIENT_ID = '460895836761-fj5i13udjp5bh7ucq1q2ltd2jhpuf4cu.apps.googleusercontent.com';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.tokenClient = null;

        this.updateIndicator();
    }

    updateIndicator() {
        const indicator = document.getElementById('activeStorageIndicator');
        if (!indicator) return;

        if (this.mode === 'localstorage') {
            indicator.innerText = 'Storage: Local Browser';
            indicator.previousElementSibling.className = 'fa-solid fa-browser text-slate-400';
        } else if (this.mode === 'localfolder') {
            indicator.innerText = 'Storage: Local Folder';
            indicator.previousElementSibling.className = 'fa-solid fa-folder-open text-amber-500';
        } else if (this.mode === 'gdrive') {
            indicator.innerText = 'Storage: Google Drive';
            indicator.previousElementSibling.className = 'fa-brands fa-google-drive text-green-500';
        }
    }

    async setMode(newMode) {
        if (newMode === 'localfolder') {
            try {
                this.localDirHandle = await window.showDirectoryPicker();
                // Request persistent permission
                await this.verifyPermission(this.localDirHandle, true);
            } catch (e) {
                console.error('User cancelled folder selection', e);
                return; // Abort changing mode
            }
        } else if (newMode === 'gdrive') {
            if (this.CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID_HERE')) {
                if (window.showDialog) {
                    await window.showDialog('Google Drive Sync requires you to configure the CLIENT_ID in storage.js first.', 'alert', 'Configuration Required');
                } else {
                    alert('Google Drive Sync requires you to configure the CLIENT_ID in storage.js first.');
                }
                return;
            }
            try {
                await this.initGoogleAPI();
            } catch (e) {
                console.error('Drive setup failed', e);
                if (window.showDialog) {
                    await window.showDialog('Failed to connect to Google Drive.', 'alert', 'Connection Error');
                } else {
                    alert('Failed to connect to Google Drive.');
                }
                return;
            }
        }

        this.mode = newMode;
        localStorage.setItem('dumpyard_storage_mode', newMode);
        this.updateIndicator();
        window.closeStorageSettings();

        // Reload notes using the new mode
        if (window.reloadAllNotes) {
            window.reloadAllNotes();
        }
    }

    async verifyPermission(fileHandle, readWrite) {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    async saveNote(noteObj) {
        if (this.mode === 'localstorage') {
            return this.saveToLocalStorage(noteObj);
        } else if (this.mode === 'localfolder') {
            return this.saveToLocalFolder(noteObj);
        } else if (this.mode === 'gdrive') {
            return this.saveToGDrive(noteObj);
        }
    }

    async loadNotes() {
        if (this.mode === 'localstorage') {
            return this.loadFromLocalStorage();
        } else if (this.mode === 'localfolder') {
            return this.loadFromLocalFolder();
        } else if (this.mode === 'gdrive') {
            return this.loadFromGDrive();
        }
    }

    async deleteNote(id) {
        if (this.mode === 'localstorage') {
            let notes = this.loadFromLocalStorage();
            notes = notes.filter(n => n.id !== id);
            localStorage.setItem('dumpyard_notes', JSON.stringify(notes));
        } else if (this.mode === 'localfolder') {
            await this.deleteFromLocalFolder(id);
        } else if (this.mode === 'gdrive') {
            await this.deleteFromGDrive(id);
        }
    }

    // --- LocalStorage Implementation ---
    saveToLocalStorage(noteObj) {
        let notes = this.loadFromLocalStorage();
        const index = notes.findIndex(n => n.id === noteObj.id);
        if (index > -1) {
            notes[index] = noteObj;
        } else {
            notes.push(noteObj);
        }
        localStorage.setItem('dumpyard_notes', JSON.stringify(notes));
    }

    loadFromLocalStorage() {
        const data = localStorage.getItem('dumpyard_notes');
        return data ? JSON.parse(data) : [];
    }

    // --- Local Folder Implementation (File System Access API) ---
    async getDirHandle() {
        if (this.localDirHandle) return this.localDirHandle;
        await window.showDialog("Please re-select your local folder to grant permission.", "alert", "Permission Required");
        this.localDirHandle = await window.showDirectoryPicker();
        return this.localDirHandle;
    }

    async saveToLocalFolder(noteObj) {
        try {
            const dirHandle = await this.getDirHandle();
            // We save it as a .md file containing the note with YAML frontmatter
            const filename = `note_${noteObj.id}.md`;
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(noteToMarkdown(noteObj));
            await writable.close();
            
            // Delete the old .json file if it exists to avoid duplicates after migration
            try {
                await dirHandle.removeEntry(`note_${noteObj.id}.json`);
            } catch (e) {
                // Ignore if it doesn't exist
            }
        } catch (e) {
            console.error("Local folder write failed", e);
        }
    }

    async loadFromLocalFolder() {
        try {
            const dirHandle = await this.getDirHandle();
            const notes = [];
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.startsWith('note_')) {
                    const fileHandle = await dirHandle.getFileHandle(entry.name);
                    const file = await fileHandle.getFile();
                    const text = await file.text();
                    try {
                        if (entry.name.endsWith('.json')) {
                            notes.push(JSON.parse(text));
                        } else if (entry.name.endsWith('.md')) {
                            notes.push(markdownToNote(text));
                        }
                    } catch (e) {
                        console.error("Failed to parse local file", entry.name);
                    }
                }
            }
            return notes;
        } catch (e) {
            console.error("Local folder read failed", e);
            return [];
        }
    }

    async deleteFromLocalFolder(id) {
        try {
            const dirHandle = await this.getDirHandle();
            try {
                await dirHandle.removeEntry(`note_${id}.md`);
            } catch (e) {}
            try {
                await dirHandle.removeEntry(`note_${id}.json`);
            } catch (e) {}
        } catch (e) {
            console.error("Failed to delete file", id);
        }
    }

    // --- Google Drive Implementation ---
    async initGoogleAPI() {
        if (this.gapiInited && this.gisInited && this.folderId) return;

        return new Promise((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
                    });
                    this.gapiInited = true;

                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: this.CLIENT_ID,
                        scope: this.SCOPES,
                        callback: async (resp) => {
                            if (resp.error !== undefined) {
                                reject(resp);
                            }
                            this.gisInited = true;
                            await this.initDriveFolder();
                            resolve();
                        },
                    });

                    if (gapi.client.getToken() === null) {
                        this.tokenClient.requestAccessToken({ prompt: 'consent' });
                    } else {
                        await this.initDriveFolder();
                        resolve();
                    }
                } catch (e) {
                    console.error("GAPI Init error", e);
                    reject(e);
                }
            });
        });
    }

    async initDriveFolder() {
        // Find existing DumpYard folder
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and name='DevVault' and trashed=false",
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files && response.result.files.length > 0) {
            this.folderId = response.result.files[0].id;
        } else {
            // Create folder
            const folderMetadata = {
                name: 'DevVault',
                mimeType: 'application/vnd.google-apps.folder'
            };
            const folder = await gapi.client.drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });
            this.folderId = folder.result.id;
        }
    }
    
    async saveToGDrive(noteObj) {
        if (!this.folderId) return;
        const jsonFilename = `note_${noteObj.id}.json`;
        const mdFilename = `note_${noteObj.id}.md`;
        const content = noteToMarkdown(noteObj);
        
        // Check if file exists (either .json or .md)
        const res = await gapi.client.drive.files.list({
            q: `'${this.folderId}' in parents and (name='${jsonFilename}' or name='${mdFilename}') and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const file = new Blob([content], { type: 'text/markdown' });
        const metadata = {
            name: mdFilename,
            mimeType: 'text/markdown'
        };

        const accessToken = gapi.client.getToken().access_token;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        if (res.result.files && res.result.files.length > 0) {
            // Update existing (will update the first matched file)
            const fileId = res.result.files[0].id;
            
            // If the existing file was a .json, we should ideally rename it to .md
            // The upload API with PATCH metadata handles this.
            
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + accessToken },
                body: form
            });
            
            // If there were duplicates (both .json and .md somehow), we could delete the others, 
            // but for simplicity, we just update one and assume it becomes .md.
        } else {
            // Create new
            metadata.parents = [this.folderId];
            const createForm = new FormData();
            createForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            createForm.append('file', file);
            
            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + accessToken },
                body: createForm
            });
        }
    }

    async loadFromGDrive() {
        if (!this.folderId) return [];
        const notes = [];
        try {
            const res = await gapi.client.drive.files.list({
                q: `'${this.folderId}' in parents and trashed=false`,
                fields: 'files(id, name)'
            });

            const accessToken = gapi.client.getToken().access_token;
            for (let file of res.result.files) {
                if ((file.name.endsWith('.json') || file.name.endsWith('.md')) && file.name.startsWith('note_')) {
                    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                        headers: { 'Authorization': 'Bearer ' + accessToken }
                    });
                    const text = await fileRes.text();
                    try {
                        if (file.name.endsWith('.json')) {
                            notes.push(JSON.parse(text));
                        } else if (file.name.endsWith('.md')) {
                            notes.push(markdownToNote(text));
                        }
                    } catch (e) { console.error("Failed to parse GDrive file", file.name); }
                }
            }
            return notes;
        } catch (e) {
            console.error("GDrive load error", e);
            return [];
        }
    }

    async deleteFromGDrive(id) {
        if (!this.folderId) return;
        
        // Find existing file (both extensions) to delete
        const res = await gapi.client.drive.files.list({
            q: `'${this.folderId}' in parents and (name='note_${id}.json' or name='note_${id}.md') and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive'
        });
        
        if (res.result.files && res.result.files.length > 0) {
            for (let file of res.result.files) {
                await gapi.client.drive.files.delete({
                    fileId: file.id
                });
            }
        }
    }

    async migrateLocalToDrive() {
        if (this.CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID_HERE')) {
            await window.showDialog('Migration to Google Drive will be available once Client ID is configured in storage.js!', 'alert', 'Setup Required');
            return;
        }

        try {
            await this.initGoogleAPI();
            // Read from local folder
            const localNotes = await this.loadFromLocalFolder();
            if (localNotes.length === 0) {
                await window.showDialog('No notes found in local folder to migrate.', 'alert', 'Migration Empty');
                return;
            }

            document.getElementById('migrationSection').innerHTML = `<p class="text-xs text-green-400">Migrating ${localNotes.length} notes...</p>`;

            for (let note of localNotes) {
                await this.saveToGDrive(note);
            }

            await window.showDialog('Migration successful! Switching to Google Drive mode.', 'alert', 'Success');
            await this.setMode('gdrive');
        } catch (e) {
            console.error('Migration failed:', e);
            await window.showDialog('Migration failed. Check console for details.', 'alert', 'Migration Error');
        }
    }
}

const storageManager = new StorageManager();

window.setStorageMode = function (mode) {
    storageManager.setMode(mode);
}

window.migrateLocalToDrive = function () {
    storageManager.migrateLocalToDrive();
}

// Expose globally for app.js
window.storageManager = storageManager;
