const puppeteer = require('puppeteer');
const { app, BrowserWindow, ipcMain } = require('electron');

let browser; // Variável global para o navegador Puppeteer
let page; // Página aberta no Puppeteer
let mainWindow; // Janela principal do Electron

// Função para abrir o navegador
async function abrirNavegador() {
    browser = await puppeteer.launch({
        headless: false, // Para abrir o navegador com GUI
        defaultViewport: null, // Maximizar a janela
        args: ['--start-maximized'],
    });

    page = await browser.newPage();
    await page.goto('https://web.whatsapp.com');

    console.log('WhatsApp Web foi aberto no navegador.');

    // Injetar código para capturar o nome do contato ou grupo ao mudar de conversa
    await page.exposeFunction('notificarElectron', (nome) => {
        mainWindow.webContents.send('atualizar-contato', nome);
    });

    await page.evaluate(() => {
        const observer = new MutationObserver(() => {
            const elementoNome = document.querySelector('header span[title]');
            if (elementoNome) {
                window.notificarElectron(elementoNome.textContent);
            }
        });

        const header = document.querySelector('header');
        if (header) {
            observer.observe(header, { childList: true, subtree: true });
        }
    });
}

// Função para enviar mensagens repetidamente
async function enviarScript(scriptText, quantidade) {
    const result = await page.evaluate(async (scriptText, quantidade) => {
        const main = document.querySelector("#main");
        if (!main) throw new Error("WhatsApp Web não está carregado.");

        const textarea = main.querySelector(`div[contenteditable="true"]`);
        if (!textarea) throw new Error("Não há uma conversa aberta.");

        for (let i = 0; i < quantidade; i++) {
            textarea.focus();
            document.execCommand('insertText', false, scriptText);
            textarea.dispatchEvent(new Event('change', { bubbles: true }));

            // Simula o clique no botão de enviar
            await new Promise((resolve) => setTimeout(resolve, 100));
            const sendButton = main.querySelector(`[data-testid="send"]`) || main.querySelector(`[data-icon="send"]`);
            if (sendButton) sendButton.click();

            // Pausa entre envios
            if (i !== quantidade - 1) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }

        return quantidade;
    }, scriptText, quantidade);

    console.log(`Mensagens enviadas: ${result}`);
}

// Função para criar a interface gráfica com Electron
function criarInterface() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadURL(
        'data:text/html;charset=utf-8,' +
            encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Automação</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                input, button, textarea { margin: 10px; padding: 10px; font-size: 16px; width: 80%; }
                textarea { height: 100px; resize: none; }
            </style>
        </head>
        <body>
            <h1>Automação do WhatsApp</h1>
            <p>Conversa atual: <span id="contato">Nenhuma</span></p>
            <textarea id="mensagem" placeholder="Digite a mensagem"></textarea><br/>
            <input id="quantidade" type="number" placeholder="Quantidade de vezes" min="1" /><br/>
            <button id="enviar">Enviar Mensagens</button>

            <script>
                const { ipcRenderer } = require('electron');

                // Atualizar o nome do contato ou grupo na interface
                ipcRenderer.on('atualizar-contato', (event, nome) => {
                    document.getElementById('contato').textContent = nome;
                });

                // Enviar mensagens ao clicar no botão
                document.getElementById('enviar').addEventListener('click', () => {
                    const scriptText = document.getElementById('mensagem').value;
                    const quantidade = parseInt(document.getElementById('quantidade').value, 10);

                    if (scriptText.trim() && quantidade > 0) {
                        ipcRenderer.send('enviar-mensagem', { scriptText, quantidade });
                    } else {
                        alert('Por favor, insira a mensagem e a quantidade corretamente.');
                    }
                });
            </script>
        </body>
        </html>
    `)
    );

    // Ouvir o evento de envio de mensagens
    ipcMain.on('enviar-mensagem', async (event, { scriptText, quantidade }) => {
        if (page) {
            await enviarScript(scriptText, quantidade);
        } else {
            console.error('Navegador ainda não está pronto.');
        }
    });
}

// Inicializar o aplicativo
app.whenReady().then(async () => {
    await abrirNavegador(); // Abrir o navegador Puppeteer
    criarInterface(); // Criar a interface gráfica
});

app.on('window-all-closed', () => {
    if (browser) browser.close(); // Fechar o navegador Puppeteer
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
