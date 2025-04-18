import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('lamene-developer-help.listFiles', async () => {
        // 1. Obtener la ruta de la carpeta del proyecto
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showInformationMessage('No hay una carpeta de proyecto abierta.');
            return;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;

        // 2. Leer los archivos del proyecto (de forma recursiva)
        const files = await vscode.workspace.findFiles('**/*'); // '**/*' busca todos los archivos y carpetas

        // 3. Mostrar la lista de archivos al usuario
        const filePaths = files.map(uri => uri.fsPath.replace(workspacePath + '\\', '').replace(workspacePath + '/', ''));
        const selectedFile = await vscode.window.showQuickPick(filePaths, {
            placeHolder: 'Selecciona un archivo'
        });

        if (selectedFile) {
            // 4. Mostrar un prompt para que el usuario escriba algo
            const userInput = await vscode.window.showInputBox({
                prompt: `Escribe algo para el archivo: ${selectedFile}`,
                placeHolder: 'Tu texto aquí'
            });

            if (userInput !== undefined) {
                // 5. Aquí puedes implementar la lógica para enviar el texto
                vscode.window.showInformationMessage(`Texto "${userInput}" enviado para el archivo: ${selectedFile}`);
                // TODO: Implementar la acción de "enviar" (guardar, mostrar en otro lugar, etc.)
            }
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};