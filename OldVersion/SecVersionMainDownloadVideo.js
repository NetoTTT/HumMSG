const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');


// Inicializar Firebase Admin SDK
const serviceAccount = require('../cred/callbossdiscordbot-firebase-adminsdk-g4z86-1cdafa0f83.json');
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
        const tempoPorCaractereReal = 140; // Tempo entre os caracteres da mensagem real (em milissegundos)

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

        // Enviar a mensagem simulado e enviada diretamente na função de digitação
        await simularDigitacaoEEnvio(page, mensagem, delay);

        res.status(200).send('Mensagens enviadas com sucesso.');

    } catch (error) {
        console.error('Erro ao acessar o Firestore:', error.message);
        res.status(500).send('Erro ao acessar o Firestore.');
    }
});

async function copiarCaminhoParaAreaTransferencia(caminhoArquivo) {
    try {
        // Usando a função import() dinamicamente para carregar o clipboardy
        const clipboardy = await import('clipboardy');
        
        // Copiar o caminho do arquivo para a área de transferência
        clipboardy.write(caminhoArquivo);
        
        console.log('Caminho do arquivo copiado para a área de transferência!');
        
        // Comando CMD para copiar o arquivo
        const cmdComando = `echo ${caminhoArquivo} | clip`;

        // Executando o comando no CMD para copiar o caminho do arquivo
        exec(cmdComando, (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro ao executar o comando: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Erro no CMD: ${stderr}`);
                return;
            }

            console.log('Comando CMD executado com sucesso!');
        });

    } catch (error) {
        console.error('Erro ao copiar para a área de transferência:', error.message);
    }
}


// Função para colar o caminho do arquivo no WhatsApp Web
async function colarNoWhatsApp() {
    try {
        // Espera o campo de texto estar disponível
        const textarea = await page.waitForSelector('p.selectable-text.copyable-text', { visible: true });

        // Foca no campo de mensagem
        await textarea.focus();

        // Simula a ação de Ctrl+V para colar o caminho do arquivo
        await page.keyboard.down('Control');   // Pressiona 'Ctrl'
        await page.keyboard.press('V');        // Pressiona 'V' para colar
        await page.keyboard.up('Control');     // Solta 'Ctrl'

        console.log('Caminho colado no WhatsApp!');
    } catch (error) {
        console.error('Erro ao colar no WhatsApp:', error.message);
    }
}


// Função para enviar o vídeo após colar
async function enviarVideoWhatsApp() {
    try {
        // Aguarda o campo de envio de mensagem
        const sendButton = await page.waitForSelector('[data-testid="send"], [data-icon="send"]', { visible: true });

        // Clica no botão de enviar
        if (sendButton) {
            await sendButton.click();
            console.log('Vídeo enviado com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao enviar o vídeo:', error.message);
    }
}



// Função para baixar o vídeo
function baixarVideo(url, caminhoDestino) {
    ffmpeg(url)
        .output(caminhoDestino)
        .on('end', () => {
            console.log('Vídeo baixado com sucesso!');
        })
        .on('error', (err) => {
            console.error('Erro ao baixar o vídeo:', err.message);
        })
        .run();
}


// Função completa de envio de vídeo no WhatsApp
async function enviarVideo(url, caminhoDestino) {
    try {
        // Baixar o vídeo
        await baixarVideo(url, caminhoDestino);

        // Copiar o caminho do arquivo para a área de transferência
        await copiarCaminhoParaAreaTransferencia(caminhoDestino);

        // Colar o caminho no WhatsApp Web
        await colarNoWhatsApp();

        // Enviar o vídeo
        await enviarVideoWhatsApp();

        console.log('Processo de envio concluído!');
    } catch (error) {
        console.error('Erro no processo de envio de vídeo:', error.message);
    }
}

/*
// Função para enviar o vídeo no WhatsApp
async function enviarVideoWhatsApp(videoPath) {
    try {
        // Espera o WhatsApp Web carregar
        await page.waitForSelector('p.selectable-text.copyable-text', { visible: true });

        // Copiar o vídeo para a área de transferência
        const videoBuffer = fs.readFileSync(videoPath);
        await page.evaluate((videoBuffer) => {
            const clipboard = require('clipboardy');
            clipboard.writeSync(videoBuffer);
        }, videoBuffer);

        // Cola o vídeo no campo de mensagem com Ctrl+V
        await page.keyboard.down('Control');
        await page.keyboard.press('V');
        await page.keyboard.up('Control');

        // Enviar o vídeo
        const sendButton = await page.waitForSelector('[data-testid="send"], [data-icon="send"]');
        if (sendButton) await sendButton.click();

        console.log('Vídeo enviado com sucesso!');
    } catch (error) {
        console.error('Erro ao enviar o vídeo:', error.message);
    }
}
*/

// Função para verificar a coleção no Firestore
async function verificarColecao() {
    try {
        const snapshot = await db.collection('youtubeVideos').get();
        if (snapshot.empty) {
            console.log('Coleção "youtubeVideos" está vazia ou não foi encontrada');
            return false;
        }
        console.log('Coleção "youtubeVideos" encontrada com documentos');
        return true;
    } catch (error) {
        console.error('Erro ao acessar a coleção "youtubeVideos":', error.message);
        return false;
    }
}

app.post('/enviarVideo', async (req, res) => {
    const { id } = req.query;
    console.log("ID do vídeo: ", id);

    if (!id) {
        return res.status(400).send('ID inválido.');
    }

    try {
        // Verificar a coleção
        const colecaoExiste = await verificarColecao();
        if (!colecaoExiste) {
            return res.status(500).send('Erro ao acessar a coleção do Firestore.');
        }

        // Acessar diretamente o documento com o nome do ID fornecido
        const docRef = db.collection('youtubeVideos').doc(id);
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
            return res.status(404).send('Documento não encontrado.');
        }

        const videoData = docSnapshot.data();
        const videoUrl = videoData.link; // Pega o campo `link` do documento

        console.log("Link do vídeo: ", videoUrl);

        if (!videoUrl) {
            return res.status(404).send('Link do vídeo não encontrado no documento.');
        }

        // Baixar o vídeo
        const videoPath = path.resolve(__dirname, 'video.mp4');
        await enviarVideo(videoUrl, videoPath);

        // Enviar o vídeo no WhatsApp
       // await enviarVideoWhatsApp(videoPath);

        res.status(200).send('Vídeo enviado com sucesso.');
    } catch (error) {
        console.error('Erro ao acessar o Firestore ou ao enviar o vídeo:', error.message);
        res.status(500).send('Erro ao acessar o Firestore ou ao enviar o vídeo.');
    }
});


// Iniciar o servidor e o navegador
app.listen(3000, async () => {
    console.log('Servidor rodando em http://localhost:3000');
    await abrirNavegador();
});
