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
exports.activate = activate;
const vscode = __importStar(require("vscode"));
function activate(context) {
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
function deactivate() { }
module.exports = {
    activate,
    deactivate
};
//# sourceMappingURL=extension.js.map