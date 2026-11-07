// DevVault — CodeMirror 6 Editor Module

let editorView = null;

export async function setupEditor(container, initialContent, onChange) {
    if (!container) return null;

    const { EditorState } = await import('https://esm.sh/@codemirror/state');
    const { EditorView, keymap } = await import('https://esm.sh/@codemirror/view');
    const { defaultKeymap } = await import('https://esm.sh/@codemirror/commands');
    const { basicSetup } = await import('https://esm.sh/codemirror');
    const { markdown } = await import('https://esm.sh/@codemirror/lang-markdown');
    const { oneDark } = await import('https://esm.sh/@codemirror/theme-one-dark');

    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && typeof onChange === 'function') {
            onChange(update.state.doc.toString());
        }
    });

    editorView = new EditorView({
        state: EditorState.create({
            doc: initialContent || '',
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
        parent: container
    });

    window.editor = editorView; // Maintain backwards compatibility if needed
    return editorView;
}

export function setEditorContent(content) {
    if (!editorView) return;
    editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content || '' }
    });
}

export function getEditorContent() {
    if (!editorView) return '';
    return editorView.state.doc.toString();
}

export function focusEditor() {
    if (editorView) editorView.focus();
}
