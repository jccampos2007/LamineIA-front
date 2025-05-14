const vscode = acquireVsCodeApi();
const sendButton = document.getElementById('send');
const questionInput = document.getElementById('question');
const responseContainer = document.getElementById('response-container');
const fileCheckBoxes = document.querySelectorAll('.file-checkbox');
const textarea = document.getElementById('question');

sendButton.addEventListener('click', async () => {
    const question = questionInput.value;

    const selectedFiles = Array.from(fileCheckBoxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => {
            const { name, type, path } = checkbox.dataset;
            if (!name || !type || !path) {
                responseContainer.innerHTML += 'Faltan datos en el checkbox:', checkbox;
                return null; // o lanzar error si prefieres
            }
            return { name, type, path };
        })
        .filter(file => file !== null);

    if (selectedFiles.length > 0 && question) {
        vscode.postMessage({
            command: 'enviarPregunta',
            archivosSeleccionados: selectedFiles,
            pregunta: question
        });
    } else {
        alert('Please select at least one file and enter your question.');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.folder-header').forEach(header => {
        header.addEventListener('click', () => {
            const folder = header.closest('.folder');
            const isOpen = folder.classList.toggle('open');

            const svg = header.querySelector('svg');
            if (svg) {
                svg.outerHTML = isOpen
                    ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/></svg>`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/></svg>`;
            }
        });
    });
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'mostrarRespuesta':
            const text = message.respuesta;
            const blocks = splitByCodeBlocks(text);

            responseContainer.innerHTML = blocks.map(block => {
                if (block.isCode) {
                    const escaped = escapeHtmlCode(block.content);
                    return `
                        <div class="code-toolbar">
                            <div class="code-header">${block.language}</div>
                            <pre><code id="${block.id}" data-file-path="${block.filePath}">${escaped}</code></pre>
                            <div class="code-buttons" data-code-id="${block.id}">
                                <button class="btn-copy">Copy</button>
                                <button class="btn-insert">Insert</button>
                                ${block.filePath ? '<button class="btn-apply">Apply</button>' : ''}
                            </div>
                            <p>${block.id + '' + block.filePath}</p>
                        </div>
                    `;
                } else {
                    const formatted = escapeHtmlText(block.content).trim();
                    return formatted ? `<p>${formatted}</p><br>` : '';
                }
            }).join('');
            break;
    }
});

responseContainer.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const container = button.closest('.code-buttons');
    if (!container) return;

    const codeId = container.dataset.codeId;
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;

    const code = codeElement.innerText;
    const filePath = codeElement.dataset.filePath || '';

    if (button.classList.contains('btn-insert')) {
        vscode.postMessage({ command: 'insertCode', content: code });
    }

    if (button.classList.contains('btn-copy')) {
        navigator.clipboard.writeText(code)
            .then(() => alert('Code copied to clipboard'))
            .catch(() => alert('Error copying code'));
    }

    if (button.classList.contains('btn-apply')) {
        vscode.postMessage({ command: 'applyCode', content: code, filePath: filePath });
    }
});

textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
});

function escapeHtmlCode(text) {
    return text.trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
}

function escapeHtmlText(text) {
    text = text.trimStart();
    text = text.replace(/`([^`]+)`/g, (_, content) => `<code>${escapeHtmlCode(content)}</code>`);
    text = text.replace(/\*\*([^*]+)\*\*/g, (_, content) => `<h3>${escapeHtmlCode(content)}</h3>`);
    text = text.replace(/\n/g, (match, offset) => offset === 0 || offset >= text.length - 1 ? '' : '<br>');
    text = text.replace(/(<br>\s*){2,}/g, '<br>');
    text = text.replace(/^(<br>\s*)+/, '');
    return text;
}

function splitByCodeBlocks(text) {
    const blocks = [];
    let index = 0;
    let blockId = 0;

    const processPlainText = (plain) => {
        const lines = plain.split('\n');
        const parts = [];
        let buffer = [];
        let inList = false;

        const flush = () => {
            if (buffer.length > 0) {
                if (inList) {
                    const items = buffer.map(line => {
                        const item = line.replace(/^\s*([*-])\s+/, '');
                        return `<li>${item}</li>`;
                    });
                    parts.push(`<ul>${items.join('')}</ul>`);
                } else {
                    parts.push(buffer.join('\n'));
                }
                buffer = [];
            }
        };

        for (const line of lines) {
            const isListItem = /^\s*([*-])\s+/.test(line);
            if (isListItem) {
                if (!inList) flush();
                inList = true;
                buffer.push(line);
            } else {
                if (inList) flush();
                inList = false;
                buffer.push(line);
            }
        }
        flush();
        return parts.join('\n');
    };

    const fileRegex = /^(?:\*\*)?(?:\[\s*)?(?:Archivo:\s*)?([^\s\[\]-]+)\s*- file -\s*([^\s\]]*)(?:\s*\])?(?:\*\*)?$/;

    while (index < text.length) {
        const codeStart = text.indexOf('```', index);
        if (codeStart === -1) {
            blocks.push({
                id: `block-${blockId++}`,
                content: processPlainText(text.slice(index)),
                isCode: false,
                filePath: '',
                language: ''
            });
            break;
        }

        // Busca línea anterior al bloque de código
        const preText = text.slice(index, codeStart);
        const preLines = preText.trimEnd().split('\n');
        let filePath = '';
        let newPreText = preText;

        if (preLines.length > 0) {
            const lastLine = preLines[preLines.length - 1];
            const match = lastLine.match(fileRegex);
            if (match) {
                const filename = match[1];
                const path = match[2];
                const pathCandidate = path || filename;
                if (!/\s/.test(pathCandidate)) {
                    filePath = pathCandidate.trim().replace(/\*+$/, '');
                    preLines.pop();
                    newPreText = preLines.join('\n') + '\n';
                }
            }
        }

        if (newPreText.trim()) {
            blocks.push({
                id: `block-${blockId++}`,
                content: processPlainText(newPreText),
                isCode: false,
                filePath: '',
                language: ''
            });
        }

        const codeEnd = text.indexOf('```', codeStart + 3);
        if (codeEnd === -1) break;

        const langLineBreak = text.indexOf('\n', codeStart + 3);
        const langSegment = langLineBreak !== -1 ? text.slice(codeStart + 3, langLineBreak) : '';
        const langMatch = langSegment.match(/^([a-zA-Z0-9]+)/);
        const language = langMatch ? langMatch[1] : '';
        const codeBlockRaw = text.slice(codeStart + 3, codeEnd);
        const lines = codeBlockRaw.split('\n');

        const internalFileLineIndex = lines.findIndex(line => fileRegex.test(line));
        if (internalFileLineIndex !== -1) {
            const match = lines[internalFileLineIndex].match(fileRegex);
            if (match) {
                const filename = match[1];
                const path = match[2];
                const pathCandidate = path || filename;
                if (!/\s/.test(pathCandidate)) {
                    filePath = pathCandidate;
                    lines.splice(internalFileLineIndex, 1);
                }
            }
        }

        // Elimina la línea con el lenguaje si está repetida como primera línea
        if (language && lines[0]?.trim() === language) lines.shift();

        const result = lines.join('\n');
        if (result.trim()) {
            blocks.push({
                id: `block-${blockId++}`,
                content: result,
                isCode: true,
                filePath: filePath,
                language: language
            });
        }

        index = codeEnd + 3;
    }

    return blocks;
}
