import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';

interface AuthResponse {
    token?: string;
    error?: string;
}

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('lamene-developer-help.listFiles', async () => {
        const sessionToken = context.globalState.get<string>('authToken');

        if (!sessionToken) {
            // Mostrar la página de inicio de sesión si no hay token
            const panel = vscode.window.createWebviewPanel(
                'loginWebview',
                'Ingreso',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = getLoginWebviewContent(panel.webview, context);

            panel.webview.onDidReceiveMessage(async message => {
                switch (message.command) {
                    case 'login':
                        const email = message.email;
                        const authResult = await authenticateUser(email);

                        if (authResult.token) {
                            await context.globalState.update('authToken', authResult.token);
                            vscode.window.showInformationMessage('Ingreso exitoso.');
                            panel.dispose();
                            // Mostrar la página principal después del login
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
            // Mostrar directamente la página principal si ya hay token
            showMainPanel(context);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

async function authenticateUser(email: string): Promise<AuthResponse> {
    const authEndpoint = 'https://wslamineia.academys.io:4800/ws/auth/login';

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
        return { token: data.token };
    } catch (error: any) {
        return { error: `Error de red: ${error.message}` };
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
        switch (message.command) {
            case 'enviarPregunta':
                const pregunta = message.pregunta;
                const archivoSeleccionado = message.archivo;
                vscode.window.showInformationMessage(`Pregunta "${pregunta}" enviada para el archivo: ${archivoSeleccionado}`);
                // TODO: Implementar la lógica para procesar la pregunta y el archivo
                break;
            case 'seleccionarArchivo':
                const archivo = message.archivo;
                vscode.window.showInformationMessage(`Archivo seleccionado: ${archivo}`);
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
    const fileListHtml = `
        <ul>
            ${filePaths.map(file => `<li><button class="file-item" data-file="${file}">${file}</button></li>`).join('')}
        </ul>
    `;

    const nonce = getNonce();
    const darkThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'dark.css'));
    const lightThemeUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'light.css'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consultar Archivos</title>
        <link rel="stylesheet" href="${darkThemeUri}" media="(prefers-color-scheme: dark)">
        <link rel="stylesheet" href="${lightThemeUri}" media="(prefers-color-scheme: light)">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource};">
    </head>
    <body>
        <h2>Lista de Archivos del Proyecto</h2>
        ${fileListHtml}
        <hr>
        <h3>Escribe tu Consulta</h3>
        <textarea id="pregunta" rows="5" placeholder="Escribe tu consulta aquí"></textarea>
        <br>
        <button id="enviar">Enviar Consulta</button>

        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const enviarButton = document.getElementById('enviar');
            const preguntaInput = document.getElementById('pregunta');
            const fileItems = document.querySelectorAll('.file-item');
            let selectedFile = '';

            fileItems.forEach(item => {
                item.addEventListener('click', () => {
                    selectedFile = item.getAttribute('data-file');
                    vscode.postMessage({
                        command: 'seleccionarArchivo',
                        archivo: selectedFile
                    });
                });
            });

            enviarButton.addEventListener('click', () => {
                const pregunta = preguntaInput.value;
                if (selectedFile && pregunta) {
                    vscode.postMessage({
                        command: 'enviarPregunta',
                        archivo: selectedFile,
                        pregunta: pregunta
                    });
                    preguntaInput.value = '';
                } else {
                    alert('Por favor, selecciona un archivo y escribe tu consulta.');
                }
            });
        </script>
    </body>
    </html>`;
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}