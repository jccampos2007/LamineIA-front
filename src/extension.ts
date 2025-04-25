import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AuthResponse, ChatResponse, ChatRequestBody, ChatFileToSend } from './interfaces';
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

        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.command === 'login') {
                const authResult = await authenticateUser(message.email);
                if (authResult.code === 200) {
                    await this.context.globalState.update('authToken', authResult.token);
                    vscode.window.showInformationMessage('Ingreso exitoso.');

                    // 🔁 Cargar nuevo contenido
                    this.loadMainPanelHtml();
                } else {
                    vscode.window.showErrorMessage('Error en el ingreso.');
                }
            }
        });
    }

    private loadLoginHtml() {
        if (this.webviewView) {
            this.webviewView.webview.html = getLoginWebviewContent(this.webviewView.webview, this.context);
        }
    }

    private loadMainPanelHtml() {
        if (this.webviewView) {
            this.webviewView.webview.html = getMainPanelContent(this.webviewView.webview, [], this.context);
        }
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

async function sendChatRequest(token: string | undefined, pregunta: string, archivos: string[]): Promise<ChatResponse> {
    const chatEndpoint = `${process.env.API_BASE_URL}/chat`;

    if (!token) {
        return { error: 'No se ha iniciado sesión.' };
    }

    const filesToSend: ChatFileToSend[] = [];
    for (const file of archivos) {
        try {
            const uri = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, file));
            const document = await vscode.workspace.openTextDocument(uri);
            filesToSend.push({
                filename: path.basename(file),
                content: document.getText()
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error al leer el archivo ${file}: ${error.message}`);
            return { error: `Error al leer el archivo ${file}: ${error.message}` };
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

async function showMainPanel(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showInformationMessage('No hay una carpeta de proyecto abierta.');
        return;
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const files = await vscode.workspace.findFiles('**/*');
    const filePaths = files.map(uri => uri.fsPath.replace(workspacePath + path.sep, ''));

    const panel = vscode.window.createWebviewPanel(
        'mainPanel',
        'Consultar Archivos',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getMainPanelContent(panel.webview, filePaths, context);

    panel.webview.onDidReceiveMessage(async message => {
        vscode.window.showErrorMessage(`message: ${message}`);
        const sessionToken = context.globalState.get<string>('authToken');
        switch (message.command) {
            case 'enviarPregunta':
                const pregunta = message.pregunta;
                const archivosSeleccionados = message.archivosSeleccionados; // Ahora recibimos un array
                vscode.window.showInformationMessage(`Pregunta "${pregunta}" enviada para los archivos: ${archivosSeleccionados.join(', ')}`);
                const chatResult = await sendChatRequest(sessionToken, pregunta, archivosSeleccionados);
                console.log('Resultado de sendChatRequest:', chatResult);
                if (chatResult.code === 200 && chatResult.data) {
                    panel.webview.postMessage({ command: 'mostrarRespuesta', respuesta: chatResult.data });
                } else if (chatResult.error) {
                    vscode.window.showErrorMessage(`Error al enviar la pregunta: ${chatResult.error}`);
                } else {
                    vscode.window.showErrorMessage('Error desconocido al enviar la pregunta.');
                }
                break;
            case 'seleccionarArchivo':
                // No es necesario este caso individualmente ahora
                break;
        }
    }, undefined, context.subscriptions);
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

function getMainPanelContent(webview: vscode.Webview, filePaths: string[], context: vscode.ExtensionContext): string {
    const nonce = getNonce();
    const darkThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'dark.css'));
    const lightThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'light.css'));
    const mainPanelHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'resources/webview', 'mainPanel.html').fsPath; // Ruta al archivo HTML
    let mainPanelHtml = fs.readFileSync(mainPanelHtmlPath, 'utf8');

    mainPanelHtml = mainPanelHtml.replace(/\$\{darkThemeUri\}/g, darkThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace(/\$\{lightThemeUri\}/g, lightThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace(/\$\{nonce\}/g, nonce);
    mainPanelHtml = mainPanelHtml.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);
    const fileListHtml = filePaths.map(file => `<li><input type="checkbox" class="file-checkbox" value="${file}"> ${file}</li>`).join('');
    mainPanelHtml = mainPanelHtml.replace('${fileList}', fileListHtml);

    return mainPanelHtml;
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}