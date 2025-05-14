"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginViewProvider = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: path.resolve(__dirname, './../.env') });
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('lamine-developer-help.listFiles', new LoginViewProvider(context)));
}
function deactivate() { }
class LoginViewProvider {
    context;
    webviewView;
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this.webviewView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webview')
            ]
        };
        const sessionToken = this.context.globalState.get('authToken');
        if (sessionToken) {
            this.loadMainPanelHtml();
        }
        else {
            this.loadLoginHtml();
        }
        this.setupMessageListener();
    }
    loadLoginHtml() {
        if (this.webviewView) {
            this.webviewView.webview.html = getLoginWebviewContent(this.webviewView.webview, this.context);
        }
    }
    setupMessageListener() {
        if (!this.webviewView)
            return;
        this.webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'login': {
                    const authResult = await authenticateUser(message.email);
                    if (authResult.code === 200) {
                        await this.context.globalState.update('authToken', authResult.token);
                        vscode.window.showInformationMessage('Ingreso exitoso.');
                        this.loadMainPanelHtml();
                    }
                    else {
                        vscode.window.showErrorMessage('Error en el ingreso.');
                    }
                    break;
                }
                case 'enviarPregunta': {
                    const sessionToken = this.context.globalState.get('authToken');
                    const pregunta = message.pregunta;
                    const archivosSeleccionados = message.archivosSeleccionados;
                    const chatResult = await sendChatRequest(sessionToken, pregunta, archivosSeleccionados);
                    vscode.window.showInformationMessage(`Pregunta "${pregunta}" enviada para los archivos: ${archivosSeleccionados.join(', ')}`);
                    if (chatResult.code === 200 && chatResult.data) {
                        this.webviewView?.webview.postMessage({
                            command: 'mostrarRespuesta',
                            respuesta: chatResult.data
                        });
                    }
                    else if (chatResult.error) {
                        vscode.window.showErrorMessage(`Error al enviar la pregunta: ${chatResult.error}`);
                    }
                    else {
                        vscode.window.showErrorMessage('Error desconocido al enviar la pregunta.');
                    }
                    break;
                }
                case 'insertCode': {
                    vscode.window.showInformationMessage(`Pegar: ${message.content}`);
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showErrorMessage('No hay un editor activo para insertar código.');
                        return;
                    }
                    const content = message.content || '';
                    editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, content);
                    });
                    break;
                }
                case 'applyCode': {
                    const content = message.content || '';
                    const filePath = message.filePath;
                    vscode.window.showInformationMessage(`Archivo: ${filePath}`);
                    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    const absolutePath = path.join(workspacePath, filePath);
                    const fileUri = vscode.Uri.file(absolutePath);
                    const dirPath = path.dirname(absolutePath);
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                    }
                    if (!fs.existsSync(absolutePath)) {
                        fs.writeFileSync(absolutePath, content, 'utf8');
                        vscode.window.showInformationMessage(`Archivo creado: ${filePath}`);
                        return;
                    }
                    try {
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        const editor = await vscode.window.showTextDocument(document, { preview: false });
                        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
                        await editor.edit(editBuilder => {
                            editBuilder.replace(fullRange, content);
                        });
                        vscode.window.showInformationMessage(`Código reemplazado en: ${filePath}`);
                    }
                    catch (error) {
                        vscode.window.showErrorMessage(`Error al abrir o editar el archivo ${filePath}: ${error}`);
                    }
                    break;
                }
            }
        });
    }
    async loadMainPanelHtml() {
        if (!this.webviewView)
            return;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showInformationMessage('No hay una carpeta de proyecto abierta.');
            return;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const files = await vscode.workspace.findFiles('**/*');
        const fileStructure = buildFileStructure(files, workspacePath);
        this.webviewView.webview.html = getMainPanelContent(this.webviewView.webview, fileStructure, this.context);
    }
}
exports.LoginViewProvider = LoginViewProvider;
async function authenticateUser(email) {
    const authEndpoint = `${process.env.API_BASE_URL}/auth/login`;
    try {
        const response = await fetch(authEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
                return { error: errorData.message || `Error de autenticación: ${response.status}` };
            }
            return { error: `Error de autenticación: ${response.status}` };
        }
        const data = await response.json();
        return { token: data.token, code: 200 };
    }
    catch (error) {
        return { error: `Error de red: ${error.message}` };
    }
}
async function sendChatRequest(token, pregunta, archivos) {
    const chatEndpoint = `${process.env.API_BASE_URL}/chat`;
    if (!token) {
        return { error: 'No se ha iniciado sesión.' };
    }
    const filesToSend = [];
    vscode.window.showInformationMessage(`Leyendo archivo: ${archivos.length} archivos seleccionados ${archivos.map(file => file.path).join(', ')}`);
    for (const file of archivos) {
        if (file.type === 'file') {
            try {
                const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const absolutePath = path.join(workspacePath, file.path);
                const uri = vscode.Uri.file(absolutePath);
                vscode.window.showInformationMessage(`Leyendo archivo: ${file.path} ${absolutePath}`);
                const document = await vscode.workspace.openTextDocument(uri);
                filesToSend.push({
                    filename: file.name,
                    content: document.getText(),
                    type: file.type,
                    path: file.path
                });
            }
            catch (error) {
                vscode.window.showErrorMessage(`Error al leer el archivo ${file.path}: ${error.message}`);
                return { error: `Error al leer el archivo ${file.path}: ${error.message}` };
            }
        }
    }
    const requestBody = {
        intelligence: 'groq',
        message: pregunta,
        files: filesToSend
    };
    try {
        const response = await fetch(chatEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorData = await response.json();
            if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
                return { error: errorData.message || `Error al enviar la pregunta: ${response.status}` };
            }
            return { error: `Error al enviar la pregunta: ${response.status} - ${chatEndpoint}` };
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        return { error: `Error de red al enviar la pregunta: ${error.message}` };
    }
}
function getLoginWebviewContent(webview, context) {
    const nonce = getNonce();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview/css', 'login.css'));
    const loginHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'login.html').fsPath;
    const webviewUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview/js', 'login.js'));
    let loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');
    loginHtml = loginHtml.replace(/\$\{styleUri\}/g, styleUri.toString());
    loginHtml = loginHtml.replace(/\$\{webviewUri\}/g, webviewUri.toString());
    loginHtml = loginHtml.replace(/\$\{nonce\}/g, nonce);
    loginHtml = loginHtml.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);
    return loginHtml;
}
function getMainPanelContent(webview, fileStructure, context) {
    const nonce = getNonce();
    const darkThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview/css', 'dark.css'));
    const lightThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview/css', 'light.css'));
    const webviewUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview/js', 'main.js'));
    const mainPanelHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'mainPanel.html').fsPath;
    let mainPanelHtml = fs.readFileSync(mainPanelHtmlPath, 'utf8');
    mainPanelHtml = mainPanelHtml.replace(/\$\{darkThemeUri\}/g, darkThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace(/\$\{lightThemeUri\}/g, lightThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace(/\$\{webviewUri\}/g, webviewUri.toString());
    mainPanelHtml = mainPanelHtml.replace(/\$\{nonce\}/g, nonce);
    mainPanelHtml = mainPanelHtml.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);
    const fileListHtml = generateFileListHtml(fileStructure);
    mainPanelHtml = mainPanelHtml.replace('${fileList}', fileListHtml);
    return mainPanelHtml;
}
function generateFileListHtml(fileStructure) {
    return fileStructure.map(item => {
        const idSafe = item.path.replace(/[^\w\-]/g, '-').toLowerCase();
        if (item.type === 'folder') {
            return `
                <div class="folder">
                    <div class="folder-header" data-folder="${item.path}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
                        </svg>
                        <strong>${item.name}</strong>
                    </div>
                    <div class="folder-content">
                        ${generateFileListHtml(item.children || [])}
                    </div>
                </div>
            `;
        }
        else {
            return `
                <div class="file">
                    <label>
                        <input type="checkbox"
                            class="file-checkbox"
                            data-name="${item.name}"
                            data-type="file"
                            data-path="${item.path}">
                        ${item.name}
                    </label>
                </div>
            `;
        }
    }).join('');
}
function buildFileStructure(files, workspacePath) {
    const fileStructure = [];
    files.forEach(uri => {
        const relativePath = uri.fsPath.replace(workspacePath + path.sep, '');
        const parts = relativePath.split(path.sep);
        let currentLevel = fileStructure;
        let currentPath = '';
        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            currentPath = currentPath ? path.join(currentPath, part) : part;
            let existingItem = currentLevel.find(item => item.name === part);
            if (!existingItem) {
                existingItem = { name: part, type: isFile ? 'file' : 'folder', path: currentPath, children: [] };
                currentLevel.push(existingItem);
            }
            if (!isFile) {
                currentLevel = existingItem.children;
            }
        });
    });
    return fileStructure;
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map