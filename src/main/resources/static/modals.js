// DevVault — Modals & Dialogs Module

// --- Custom Dialog System (Alert & Confirm) ---
export function showDialog(message, type = 'alert', title = 'Notice') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customDialogOverlay');
        const box = document.getElementById('customDialogBox');
        if (!overlay || !box) {
            if (type === 'confirm') {
                resolve(window.confirm(message));
            } else {
                window.alert(message);
                resolve(true);
            }
            return;
        }

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
            overlay.style.pointerEvents = 'none';
            overlay.classList.add('opacity-0');
            box.classList.add('scale-95');
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.style.pointerEvents = '';
                resolve(result);
            }, 300);
        };

        confirmBtn.onclick = () => closeDialog(true);
        cancelBtn.onclick = () => closeDialog(false);
    });
}
window.showDialog = showDialog; // Backwards compatibility

// --- Mermaid Diagram Zoom & Pan Modal ---
export function initDiagramModal() {
    const closeBtn = document.getElementById('closeDiagramBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDiagramModal);
    }
}

export function closeDiagramModal() {
    const modal = document.getElementById('diagramModal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        const content = document.getElementById('diagramModalContent');
        if (content) {
            content.innerHTML = '';
            content.onwheel = null;
            content.onmousedown = null;
            content.onmousemove = null;
            content.onmouseup = null;
            content.onmouseleave = null;
        }
    }, 300);
}

export function openDiagramModal(svgElement) {
    const modal = document.getElementById('diagramModal');
    const content = document.getElementById('diagramModalContent');
    if (!modal || !content || !svgElement) return;

    content.innerHTML = '';
    const clonedSvg = svgElement.cloneNode(true);
    clonedSvg.style.maxWidth = 'none';
    clonedSvg.style.maxHeight = 'none';
    clonedSvg.style.transition = 'transform 0.05s ease-out';
    content.appendChild(clonedSvg);

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const updateTransform = () => {
        clonedSvg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    };

    content.onwheel = (e) => {
        e.preventDefault();
        const zoomSensitivity = 0.05;
        if (e.deltaY < 0) {
            scale += zoomSensitivity;
        } else {
            scale = Math.max(0.2, scale - zoomSensitivity);
        }
        updateTransform();
    };

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
}
