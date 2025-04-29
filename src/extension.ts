import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AuthResponse, ChatResponse, ChatRequestBody, ChatFileToSend, fileProyect } from './interfaces';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, './../.env') });

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'lamine-developer-help.listFiles',
            new LoginViewProvider(context)
        )
    );
}

export function deactivate() { }

export class LoginViewProvider implements vscode.WebviewViewProvider {
    private webviewView?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) { }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {

        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webview')
            ]
        };

        this.loadLoginHtml();

        this.setupMessageListener();

    }

    private loadLoginHtml() {
        if (this.webviewView) {
            this.webviewView.webview.html = getLoginWebviewContent(this.webviewView.webview, this.context);
        }
    }

    private setupMessageListener() {
        if (!this.webviewView) return;

        this.webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'login': {
                    const authResult = await authenticateUser(message.email);
                    if (authResult.code === 200) {
                        await this.context.globalState.update('authToken', authResult.token);
                        vscode.window.showInformationMessage('Ingreso exitoso.');
                        this.loadMainPanelHtml();
                    } else {
                        vscode.window.showErrorMessage('Error en el ingreso.');
                    }
                    break;
                }

                case 'enviarPregunta': {
                    const sessionToken = this.context.globalState.get<string>('authToken');
                    const pregunta = message.pregunta;
                    const archivosSeleccionados: fileProyect[] = message.archivosSeleccionados;

                    vscode.window.showInformationMessage(
                        `Pregunta "${pregunta}" enviada para los archivos: ${archivosSeleccionados.join(', ')}`
                    );

                    const chatResult = await sendChatRequest(sessionToken, pregunta, archivosSeleccionados);

                    if (chatResult.code === 200 && chatResult.data) {
                        this.webviewView?.webview.postMessage({
                            command: 'mostrarRespuesta',
                            respuesta: chatResult.data
                        });
                    } else if (chatResult.error) {
                        vscode.window.showErrorMessage(`Error al enviar la pregunta: ${chatResult.error}`);
                    } else {
                        vscode.window.showErrorMessage('Error desconocido al enviar la pregunta.');
                    }
                    break;
                }
            }
        });
    }

    private async loadMainPanelHtml() {
        if (!this.webviewView) return;

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

async function authenticateUser(email: string): Promise<AuthResponse> {
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
                return { error: (errorData as { message: string }).message || `Error de autenticación: ${response.status}` };
            }
            return { error: `Error de autenticación: ${response.status}` };
        }

        const data = await response.json() as { token?: string };
        return { token: data.token, code: 200 };
    } catch (error: any) {
        return { error: `Error de red: ${error.message}` };
    }
}

async function sendChatRequest(token: string | undefined, pregunta: string, archivos: fileProyect[]): Promise<ChatResponse> {
    const chatEndpoint = `${process.env.API_BASE_URL}/chat`;
    if (!token) {
        return { error: 'No se ha iniciado sesión.' };
    }

    const filesToSend: ChatFileToSend[] = [];
    vscode.window.showInformationMessage(`Leyendo archivo: ${archivos.length} archivos seleccionados ${archivos.map(file => file.path).join(', ')}`);
    for (const file of archivos) {
        if (file.type === 'file') { // Solo enviamos archivos, no carpetas
            try {
                const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
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
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error al leer el archivo ${file.path}: ${error.message}`);
                return { error: `Error al leer el archivo ${file.path}: ${error.message}` };
            }
        }
    }

    const requestBody: ChatRequestBody = {
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
                return { error: (errorData as { message: string }).message || `Error al enviar la pregunta: ${response.status}` };
            }
            return { error: `Error al enviar la pregunta: ${response.status} - ${chatEndpoint}` };
        }

        const data = await response.json() as ChatResponse;
        return data;

    } catch (error: any) {
        return { error: `Error de red al enviar la pregunta: ${error.message}` };
    }
}

function getLoginWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {

    const nonce = getNonce();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'login.css'));
    const loginHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'login.html').fsPath; // Ruta al archivo HTML
    let loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');

    loginHtml = loginHtml.replace(/\$\{styleUri\}/g, styleUri.toString());
    loginHtml = loginHtml.replace(/\$\{nonce\}/g, nonce);
    loginHtml = loginHtml.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);

    return loginHtml;
}

function getMainPanelContent(webview: vscode.Webview, fileStructure: { name: string, type: 'file' | 'folder', path: string, children?: any[] }[], context: vscode.ExtensionContext): string {
    const nonce = getNonce();
    const darkThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'dark.css'));
    const lightThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'light.css'));
    const mainPanelHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'mainPanel.html').fsPath;
    let mainPanelHtml = fs.readFileSync(mainPanelHtmlPath, 'utf8');
    mainPanelHtml = mainPanelHtml.replace(/\$\{darkThemeUri\}/g, darkThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace(/\$\{lightThemeUri\}/g, lightThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace(/\$\{nonce\}/g, nonce);
    mainPanelHtml = mainPanelHtml.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);

    const fileListHtml = generateFileListHtml(fileStructure);
    mainPanelHtml = mainPanelHtml.replace('${fileList}', fileListHtml);

    return mainPanelHtml;
}

function generateFileListHtml(fileStructure: { name: string, type: 'file' | 'folder', path: string, children?: any[] }[]): string {
    return fileStructure.map(item => {
        if (item.type === 'folder') {
            const folderId = item.path.replace(/[^\w\-]/g, '-').toLowerCase(); // Mejor usar path para ID
            return `
                <li class="folder">
                    <input type="checkbox" class="folder-checkbox" id="${folderId}" data-name="${item.name}" data-type="folder" data-path="${item.path}">
                    <label for="${folderId}">${item.name}</label>
                    <ul>${generateFileListHtml(item.children || [])}</ul>
                </li>`;
        } else {
            return `
                <li>
                    <input type="checkbox" class="file-checkbox" 
                        data-name="${item.name}" 
                        data-type="file" 
                        data-path="${item.path}">
                    ${item.name}
                </li>`;
        }
    }).join('');
}

function buildFileStructure(files: vscode.Uri[], workspacePath: string): { name: string, type: 'file' | 'folder', path: string, children?: any[] }[] {
    const fileStructure: { name: string, type: 'file' | 'folder', path: string, children?: any[] }[] = [];
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
                currentLevel = existingItem.children!;
            }
        });
    });
    return fileStructure;
}


function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}