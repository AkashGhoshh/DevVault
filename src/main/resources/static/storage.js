// Global Storage UI Controls
window.openStorageSettings = function() {
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

window.closeStorageSettings = function() {
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

class StorageManager {
    constructor() {
        this.mode = localStorage.getItem('dumpyard_storage_mode') || 'localstorage';
        this.localDirHandle = null;
        this.gapiInited = false;
        this.gisInited = false;
        
        // TODO: The user will need to configure this Client ID.
        this.CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';
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
                alert('Google Drive Sync requires you to configure the CLIENT_ID in storage.js first.');
                return;
            }
            try {
                await this.initGoogleAPI();
            } catch (e) {
                console.error('Drive setup failed', e);
                alert('Failed to connect to Google Drive.');
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
        alert("Please re-select your local folder to grant permission.");
        this.localDirHandle = await window.showDirectoryPicker();
        return this.localDirHandle;
    }
    
    async saveToLocalFolder(noteObj) {
        try {
            const dirHandle = await this.getDirHandle();
            // We save it as a .json file containing the full note object (so we keep the id, title, and children metadata)
            const filename = `note_${noteObj.id}.json`;
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(noteObj, null, 2));
            await writable.close();
        } catch(e) {
            console.error("Local folder write failed", e);
        }
    }
    
    async loadFromLocalFolder() {
        try {
            const dirHandle = await this.getDirHandle();
            const notes = [];
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.json') && entry.name.startsWith('note_')) {
                    const file = await entry.getFile();
                    const text = await file.text();
                    try {
                        notes.push(JSON.parse(text));
                    } catch(e) {
                        console.error("Failed to parse local file", entry.name);
                    }
                }
            }
            return notes;
        } catch(e) {
            console.error("Local folder read failed", e);
            return [];
        }
    }
    
    async deleteFromLocalFolder(id) {
        try {
            const dirHandle = await this.getDirHandle();
            const filename = `note_${id}.json`;
            await dirHandle.removeEntry(filename);
        } catch(e) {
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
                        this.tokenClient.requestAccessToken({prompt: 'consent'});
                    } else {
                        await this.initDriveFolder();
                        resolve();
                    }
                } catch(e) {
                    console.error("GAPI Init error", e);
                    reject(e);
                }
            });
        });
    }

    async initDriveFolder() {
        // Find existing DumpYard folder
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and name='DumpYard' and trashed=false",
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            this.folderId = response.result.files[0].id;
        } else {
            // Create folder
            const folderMetadata = {
                name: 'DumpYard',
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
        const filename = `note_${noteObj.id}.json`;
        const content = JSON.stringify(noteObj, null, 2);
        
        // Check if file exists
        const res = await gapi.client.drive.files.list({
            q: `'${this.folderId}' in parents and name='${filename}' and trashed=false`,
            fields: 'files(id)'
        });
        
        const file = new Blob([content], {type: 'application/json'});
        const metadata = {
            name: filename,
            mimeType: 'application/json'
        };
        
        const accessToken = gapi.client.getToken().access_token;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', file);
        
        if (res.result.files && res.result.files.length > 0) {
            // Update existing
            const fileId = res.result.files[0].id;
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + accessToken },
                body: form
            });
        } else {
            // Create new
            metadata.parents = [this.folderId];
            const createForm = new FormData();
            createForm.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
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
                if (file.name.endsWith('.json') && file.name.startsWith('note_')) {
                    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                        headers: { 'Authorization': 'Bearer ' + accessToken }
                    });
                    const text = await fileRes.text();
                    notes.push(JSON.parse(text));
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
        const filename = `note_${id}.json`;
        const res = await gapi.client.drive.files.list({
            q: `'${this.folderId}' in parents and name='${filename}' and trashed=false`,
            fields: 'files(id)'
        });
        if (res.result.files && res.result.files.length > 0) {
            await gapi.client.drive.files.delete({
                fileId: res.result.files[0].id
            });
        }
    }
    
    async migrateLocalToDrive() {
        if (this.CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID_HERE')) {
            alert('Migration to Google Drive will be available once Client ID is configured in storage.js!');
            return;
        }
        
        try {
            await this.initGoogleAPI();
            // Read from local folder
            const localNotes = await this.loadFromLocalFolder();
            if (localNotes.length === 0) {
                alert('No notes found in local folder to migrate.');
                return;
            }
            
            document.getElementById('migrationSection').innerHTML = `<p class="text-xs text-green-400">Migrating ${localNotes.length} notes...</p>`;
            
            for (let note of localNotes) {
                await this.saveToGDrive(note);
            }
            
            alert('Migration successful! Switching to Google Drive mode.');
            this.setMode('gdrive');
        } catch (e) {
            console.error('Migration failed', e);
            alert('Migration failed. Check console.');
        }
    }
}

const storageManager = new StorageManager();

window.setStorageMode = function(mode) {
    storageManager.setMode(mode);
}

window.migrateLocalToDrive = function() {
    storageManager.migrateLocalToDrive();
}

// Expose globally for app.js
window.storageManager = storageManager;
