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
    const userDataDir = './user_data'; // Diretório onde o perfil será salvo

    // Lançar o navegador com o diretório de dados de usuário
    browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        userDataDir: userDataDir, // Salvar os dados de sessão aqui
    });

    page = await browser.newPage();
    await page.goto('https://web.whatsapp.com');
    console.log('WhatsApp Web foi aberto.');

    // Verifique se já está logado
    const isLoggedIn = await page.evaluate(() => {
        return document.querySelector('._1MXhT') ? true : false; // Verifique o estado de login no WhatsApp Web
    });

    if (isLoggedIn) {
        console.log('Você já está logado no WhatsApp Web!');
    } else {
        console.log('Por favor, escaneie o QR code para entrar no WhatsApp Web.');
    }
}

// Inicializar servidor local
const app = express();
app.use(bodyParser.json());


// Função para simular a digitação e envio da mensagem
async function simularDigitacaoEEnvio(page, mensagem, delay) {
    try {
        // Aguardar o campo de texto da conversa estar disponível
        const textarea = await page.waitForSelector('p.selectable-text.copyable-text');
        if (!textarea) throw new Error("Não há uma conversa aberta.");

        // Foco no campo de texto
        await textarea.focus();

        // Simular digitação de caracteres aleatórios durante o tempo de delay
        const caracteresAleatorios = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        const tempoDeDelay = delay * 1000; // Convertendo o delay para milissegundos
        const tempoPorCaractere = tempoDeDelay / 24; // Digitar até 24 caracteres durante o delay total
        const tempoMaximoParaDigitar = Date.now() + tempoDeDelay; // Calculando o tempo limite para a digitação
        const tempoRestanteParaMensagemReal = tempoDeDelay - 3000; // O tempo para começar a digitar a mensagem real (3 segundos antes do fim)

        // Digitar caracteres aleatórios até o tempo se esgotar
        while (Date.now() < tempoMaximoParaDigitar) {
            const caractereAleatorio = caracteresAleatorios[Math.floor(Math.random() * caracteresAleatorios.length)];
            await page.keyboard.type(caractereAleatorio, { delay: tempoPorCaractere });

            // Verifica se chegou no tempo restante para digitar a mensagem real
            if (Date.now() >= tempoRestanteParaMensagemReal) {
                break; // Para de digitar caracteres aleatórios e começa a digitar a mensagem real
            }
        }

        // Depois de digitar caracteres aleatórios, aguarda o restante do tempo até os 3 segundos
        await new Promise(resolve => setTimeout(resolve, tempoRestanteParaMensagemReal - Date.now()));

        // Seleciona todo o texto com Ctrl+A
        await page.keyboard.down('Control'); // Pressiona o 'Control'
        await page.keyboard.press('A'); // Pressiona 'A' para selecionar tudo
        await page.keyboard.up('Control'); // Solta o 'Control'

        // Apaga o texto selecionado com a tecla Backspace
        await page.keyboard.press('Backspace'); // Apaga o conteúdo

        // Agora vamos digitar a mensagem real (em vez de colar)
        const tempoPorCaractereReal = 100; // Tempo entre os caracteres da mensagem real (em milissegundos)

        for (let i = 0; i < mensagem.length; i++) {
            const caractereReal = mensagem.charAt(i);
            await page.keyboard.type(caractereReal, { delay: tempoPorCaractereReal }); // Digita a mensagem real
        }

        // Enviar a mensagem
        const sendButton = await page.waitForSelector('[data-testid="send"], [data-icon="send"]');
        if (sendButton) await sendButton.click();

    } catch (error) {
        console.error('Erro ao enviar mensagem usando clipboard:', error.message);
        throw error;
    }
}


// Rota para enviar mensagem após buscar no Firestore
app.post('/enviarFirestore', async (req, res) => {
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
        // Pesquisar no Firestore pela coleção MSGTEXT
        const snapshot = await db.collection('MSGTEXT').where('ID', '==', id).get();
        if (snapshot.empty) {
            return res.status(404).send('Documento não encontrado.');
        }

        let mensagem = '';
        let delay = 0; // Em segundos
        snapshot.forEach(doc => {
            mensagem = doc.data().msg; // Pega o campo msg do documento
            delay = doc.data().delay || 0; // Pega o delay em segundos, se disponível
        });

        console.log("Mensagem: ", mensagem);
        console.log("Delay: ", delay);

        if (!mensagem) {
            return res.status(404).send('Mensagem não encontrada no documento.');
        }

        // Enviar a mensagem simulado e enviada diretamente na função de digitação
        await simularDigitacaoEEnvio(page, mensagem, delay);

        res.status(200).send('Mensagens enviadas com sucesso.');

    } catch (error) {
        console.error('Erro ao acessar o Firestore:', error.message);
        res.status(500).send('Erro ao acessar o Firestore.');
    }
});


// Iniciar o servidor e o navegador
app.listen(3000, async () => {
    console.log('Servidor rodando em http://localhost:3000');
    await abrirNavegador();
});