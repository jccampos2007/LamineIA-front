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
    let disposable = vscode.commands.registerCommand('lamene-developer-help.listFiles', async () => {
        const sessionToken = context.globalState.get<string>('authToken');

        if (!sessionToken) {
            // Mostrar la página de inicio de sesión si no hay token
            const panelLogin = vscode.window.createWebviewPanel(
                'loginWebview',
                'Ingreso',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panelLogin.webview.html = getLoginWebviewContent(panelLogin.webview, context);

            panelLogin.webview.onDidReceiveMessage(async message => {
                vscode.window.showErrorMessage(`message: ${message}`);
                switch (message.command) {
                    case 'login':
                        const email = message.email;
                        const authResult = await authenticateUser(email);
                        if (authResult.code === 200) {
                            await context.globalState.update('authToken', authResult.token);
                            vscode.window.showInformationMessage('Ingreso exitoso.');
                            panelLogin.dispose();
                            showMainPanel(context);
                        } else if (authResult.error) {
                            vscode.window.showErrorMessage(`Error de ingreso: ${authResult.error}`);
                        } else {
                            vscode.window.showErrorMessage('Error desconocido durante el ingreso.');
                        }
                        break;
                }
            }, undefined, context.subscriptions);
        } else {
            showMainPanel(context);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }

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
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'login.css'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ingreso</title>
        <link rel="stylesheet" href="${styleUri}">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource};">
    </head>
    <body>
        <h1>Ingresar</h1>
        <div class="login-container">
            <label for="email">Correo Electrónico:</label>
            <input type="email" id="email" name="email" placeholder="tu@correo.com">
            <button id="login-button">Ingresar</button>
        </div>

        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const loginButton = document.getElementById('login-button');
            const emailInput = document.getElementById('email');

            loginButton.addEventListener('click', () => {
                const email = emailInput.value;
                if (email) {
                    vscode.postMessage({
                        command: 'login',
                        email: email
                    });
                } else {
                    alert('Por favor, ingresa tu correo electrónico.');
                }
            });
        </script>
    </body>
    </html>`;
}

function getMainPanelContent(webview: vscode.Webview, filePaths: string[], context: vscode.ExtensionContext): string {
    const nonce = getNonce();
    const darkThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'dark.css'));
    const lightThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'light.css'));
    const mainPanelHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'mainPanel.html').fsPath; // Ruta al archivo HTML
    let mainPanelHtml = fs.readFileSync(mainPanelHtmlPath, 'utf8'); // Leer el contenido del archivo

    // Reemplazar marcadores de posición
    mainPanelHtml = mainPanelHtml.replace('${darkThemeUri}', darkThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace('${lightThemeUri}', lightThemeUri.toString());
    mainPanelHtml = mainPanelHtml.replace('${nonce}', nonce);
    mainPanelHtml = mainPanelHtml.replace('${webview.cspSource}', webview.cspSource);
    // Aquí deberías insertar la lista de archivos, como vimos antes
    const fileListHtml = filePaths.map(file => `<li><input type="checkbox" class="file-checkbox" value="${file}"> ${file}</li>`).join('');
    mainPanelHtml = mainPanelHtml.replace('', fileListHtml);

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