const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');


// Inicializar Firebase Admin SDK
const serviceAccount = require('./cred/callbossdiscordbot-firebase-adminsdk-g4z86-1cdafa0f83.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount), // Usando o arquivo de credenciais para autenticação
});

// Acessar a instância do Firestore
const db = admin.firestore();

let browser;
let page;

// Inicializar o navegador
async function abrirNavegador() {
    browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
    });

    page = await browser.newPage();
    await page.goto('https://web.whatsapp.com');
    console.log('WhatsApp Web foi aberto.');
}

// Função para enviar mensagens
async function enviarMensagem(mensagem, quantidade) {
    try {
        const result = await page.evaluate(async (mensagem, quantidade) => {
            const main = document.querySelector("#main");
            if (!main) throw new Error("WhatsApp Web não está carregado.");

            const textarea = main.querySelector(`div[contenteditable="true"]`);
            if (!textarea) throw new Error("Não há uma conversa aberta.");

            for (let i = 0; i < quantidade; i++) {
                textarea.focus();
                document.execCommand('insertText', false, mensagem);
                textarea.dispatchEvent(new Event('change', { bubbles: true }));

                // Simula o clique no botão de enviar
                const sendButton = main.querySelector(`[data-testid="send"]`) || main.querySelector(`[data-icon="send"]`);
                if (sendButton) sendButton.click();

                await new Promise(resolve => setTimeout(resolve, 250)); // Pausa entre mensagens
            }
            return quantidade;
        }, mensagem, quantidade);

        console.log(`Mensagens enviadas: ${result}`);
    } catch (error) {
        console.error('Erro ao enviar mensagens:', error.message);
    }
}

// Inicializar servidor local
const app = express();
app.use(bodyParser.json());


app.post('/enviarFirestore', async (req, res) => {
    // Alterar para pegar os parâmetros da query string, não do corpo
    const { id, quantidade } = req.query;
    console.log("ID: ", id);
    console.log("Quantidade: ", quantidade);
  

    if (!id || quantidade <= 0) {
        return res.status(400).send('ID inválido ou quantidade inválida.');
    }

    if (!quantidade) {
        quantidade = 1;  // Se a quantidade não for fornecida, define como 1
    }

    try {
        // Pesquisar no Firestore pela coleção `MSGTEXT`
        const snapshot = await db.collection('MSGTEXT').where('ID', '==', id).get();
        if (snapshot.empty) {
            return res.status(404).send('Documento não encontrado.');
        }

        let mensagem = '';
        let delay = 0; // Em segundos
        snapshot.forEach(doc => {
            mensagem = doc.data().msg; // Pega o campo `msg` do documento
            delay = doc.data().delay || 0; // Pega o delay em segundos, se disponível
        });
        console.log("Mensagem: ", mensagem);
        console.log("Delay: ", delay);

        if (!mensagem) {
            return res.status(404).send('Mensagem não encontrada no documento.');
        }
        let mensagemSimulada = "dkhakdkahdkahdkaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

        // Simular a digitação
        await simularDigitacao(page, mensagemSimulada, delay);

        // Enviar a mensagem pelo WhatsApp
        await enviarMensagem(mensagem, quantidade);
        res.status(200).send('Mensagens enviadas com sucesso.');


    } catch (error) {
        console.error('Erro ao acessar o Firestore:', error.message);
        res.status(500).send('Erro ao acessar o Firestore.');
    }
});

// Função para simular a digitação
async function simularDigitacao(page, mensagem, delay) {
    try {
        const newLocal = 'selectAll';
        await page.evaluate(async (mensagem, delay) => {
            const main = document.querySelector("#main");
            if (!main) throw new Error("WhatsApp Web não está carregado.");

            const textarea = main.querySelector(`div[contenteditable="true"]`);
            if (!textarea) throw new Error("Não há uma conversa aberta.");

            const tempoPorCaractere = (delay * 1000) / mensagem.length; // Tempo por caractere durante a digitação

            // Simula digitar a mensagem com caracteres aleatórios
            let textoParcial = '';
            for (let i = 0; i < mensagem.length; i++) {
                // Gera um caractere aleatório para simulação
                textoParcial += String.fromCharCode(Math.floor(Math.random() * (126 - 33) + 33)); // Caracteres ASCII legíveis
                textarea.focus();

                // Insere o texto parcial no campo
                document.execCommand('selectAll', false, null); // Seleciona todo o texto existente
                document.execCommand('insertText', false, textoParcial);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Aguardar antes de digitar o próximo caractere
                await new Promise(resolve => setTimeout(resolve, tempoPorCaractere));
            }

            // Aguarda o restante do delay
            await new Promise(resolve => setTimeout(resolve, delay * 1000));

            // Limpa o campo antes de enviar a mensagem original
            textarea.focus();
            document.execCommand(newLocal, false, null); // Seleciona todo o texto existente
            document.execCommand('insertText', false, ''); // Insere um texto vazio para apagar tudo
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }, mensagem, delay);
    } catch (error) {
        console.error('Erro na simulação de digitação:', error.message);
        throw error; // Lançar erro novamente para capturar na rota
    }
}





// Iniciar o servidor e o navegador
app.listen(3000, async () => {
    console.log('Servidor rodando em http://localhost:3000');
    await abrirNavegador();
});
