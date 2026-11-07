// DevVault — Lightweight LocalStorage Persistence
class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'dumpyard_notes';
    }

    async loadNotes() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load notes from localStorage', e);
            return [];
        }
    }

    async saveNote(noteObj) {
        try {
            const notes = await this.loadNotes();
            const index = notes.findIndex(n => n.id === noteObj.id);
            if (index > -1) {
                notes[index] = noteObj;
            } else {
                notes.push(noteObj);
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
        } catch (e) {
            console.error('Failed to save note to localStorage', e);
        }
    }

    async deleteNote(id) {
        try {
            let notes = await this.loadNotes();
            notes = notes.filter(n => n.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
        } catch (e) {
            console.error('Failed to delete note from localStorage', e);
        }
    }
}

const storageManager = new StorageManager();
window.storageManager = storageManager;
