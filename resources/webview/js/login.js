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