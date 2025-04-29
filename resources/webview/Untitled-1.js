refactoriza y ajusta el codigo ts:
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

    async loadMainPanelHtml() {
        if (this.webviewView) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showInformationMessage('No hay una carpeta de proyecto abierta.');
                return;
            }
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const files = await vscode.workspace.findFiles('**/*');
            const filePaths = files.map(uri => uri.fsPath.replace(workspacePath + path.sep, ''));

            this.webviewView.webview.html = getMainPanelContent(this.webviewView.webview, filePaths, this.context);


        }
    }
}

para que dentro de la funcion loadMainPanelHtml se pueda onDidReceiveMessage con el siguiente codigo:
const sessionToken = context.globalState.get < string > ('authToken');
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