const puppeteer = require('puppeteer');
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const cheerio = require('cheerio');
const { exec, spawn } = require('child_process');



// Inicializar Firebase Admin SDK
const serviceAccount = require('./cred/callbossdiscordbot-firebase-adminsdk-g4z86-1cdafa0f83.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'callbossdiscordbot.appspot.com' // Usando o arquivo de credenciais para autenticação
});

// Acessar a instância do Firestore
const db = admin.firestore();
const bucket = admin.storage().bucket();

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
app.use(express.json());

app.use(cors());

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
    const { title, quantidade } = req.query;
    console.log("ID: ", title);
    console.log("Quantidade: ", quantidade);

    if (!title || quantidade <= 0) {
        return res.status(400).send('ID inválido ou quantidade inválida.');
    }

    if (!quantidade) {
        quantidade = 1;  // Se a quantidade não for fornecida, define como 1
    }

    try {
        // Pesquisar no Firestore pela coleção MSGTEXT
        const snapshot = await db.collection('MSGTEXT').where('Title', '==', title).get();
        if (snapshot.empty) {
            return res.status(404).send('Documento não encontrado.');
        }

        let mensagem = '';
        let delay = 0; // Em segundos 
        snapshot.forEach(doc => {
            mensagem = doc.data().Description; // Pega o campo msg do documento
            delay = doc.data().Delay || 0; // Pega o delay em segundos, se disponível
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

// Função para obter a URL da imagem do Firebase Storage
async function obterImagemFirebase(idImagem) {
    try {
        // Listando arquivos no diretório 'IMAGENS/' para depuração
        const [files] = await bucket.getFiles({ prefix: 'IMAGES/' });
        const fileNames = files.map(file => file.name);

        console.log('Arquivos encontrados no diretório IMAGES:', fileNames); // Exibe os arquivos encontrados

        // Adiciona a extensão do arquivo (.png) ao ID da imagem se necessário
        const filePath = `IMAGES/${idImagem}.png`; // Ajuste o formato conforme necessário
        if (!fileNames.includes(filePath)) {
            throw new Error('Imagem não encontrada no Firebase Storage');
        }

        // Acessa o arquivo diretamente no diretório 'IMAGENS'
        const file = bucket.file(filePath);

        const [exists] = await file.exists(); // Verifica se o arquivo existe

        if (!exists) {
            throw new Error('Imagem não encontrada no Firebase Storage');
        }

        // Obtém a URL de download assinada para a imagem
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491', // A URL expira em uma data muito distante
        });

        return url;
    } catch (error) {
        console.error('Erro ao obter imagem do Firebase Storage:', error.message);
        throw error;
    }
}


// Função para baixar a imagem
async function baixarImagem(urlImagem) {
    try {
        // Extrai o nome do arquivo da URL sem os parâmetros adicionais
        const nomeArquivo = path.basename(urlImagem.split('?')[0]);  // Remove a parte da query string
        const caminhoArquivo = path.join(__dirname, 'imagens', nomeArquivo); // Caminho correto para salvar a imagem

        // Verifica se o diretório 'imagens' existe, se não, cria-o
        const dir = path.join(__dirname, 'imagens');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);  // Cria o diretório se ele não existir
        }

        const response = await axios({
            url: urlImagem,
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(caminhoArquivo);

        response.data.pipe(writer); // Faz o download da imagem

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(caminhoArquivo)); // Retorna o caminho do arquivo após a conclusão
            writer.on('error', reject); // Lida com erros durante a escrita
        });
    } catch (error) {
        console.error('Erro ao baixar imagem:', error.message);
        throw error;
    }
}

// Função para enviar a imagem via WhatsApp Web usando Puppeteer
async function enviarImagemNoWhatsApp(imagemPath, mensagem, delay) {
    try {
        // Espera a caixa de mensagem aparecer
        const textarea = await page.waitForSelector('p.selectable-text.copyable-text');
        if (!textarea) throw new Error("Não há uma conversa aberta.");

        // Foco no campo de texto
        await textarea.focus();

        // Simula a digitação de caracteres aleatórios durante o tempo de delay (como na função anterior)
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


        // Enviar a mensagem (aqui você pode alterar o texto da mensagem ou deixar em branco)
        const tempoPorCaractereReal = 100; // Tempo entre os caracteres da mensagem real (em milissegundos)
        // Verifique se a mensagem é válida
        mensagem = mensagem || '';  // Se mensagem for undefined, usa uma string vazia

        for (let i = 0; i < mensagem.length; i++) {
            const caractereReal = mensagem.charAt(i);
            await page.keyboard.type(caractereReal, { delay: tempoPorCaractereReal });
        }


        // Clicar no botão de enviar
        const sendButton = await page.waitForSelector('[data-testid="send"], [data-icon="send"]');
        if (sendButton) await sendButton.click();

        console.log('Mensagem enviada com a imagem!');

    } catch (error) {
        console.error('Erro ao enviar imagem com a mensagem:', error.message);
        throw error;
    }
}

app.post('/enviarIMG', async (req, res) => {
    const { id } = req.query;  // Só pegando o id, já que 'quantidade' não é necessário

    // Verifica se o id foi passado
    if (!id) {
        return res.status(400).send('ID inválido.');
    }

    try {
        // Passo 1: Obter URL da imagem do Firestore
        const imagemUrl = await obterImagemFirebase(id);

        // Passo 2: Baixar a imagem
        const imagemPath = await baixarImagem(imagemUrl);

        // Passo 3: Enviar a imagem via WhatsApp Web
        await enviarImagemNoWhatsApp(imagemPath, "", 1);

        res.status(200).send('Imagem enviada com sucesso.');
    } catch (error) {
        console.error('Erro ao processar a requisição:', error.message);
        res.status(500).send('Erro ao enviar imagem.');
    }
});

// Configurar o servidor Express para servir o arquivo de áudio
// Servir o arquivo de áudio via HTTP
app.use('/audio', (req, res, next) => {
    const audioFilePath = path.join(__dirname, 'tempAudio.mp3');
    res.sendFile(audioFilePath, (err) => {
        if (err) {
            console.error('Erro ao servir o arquivo:', err);
            next(err);
        }
    });
});

// Iniciar o servidor Express
app.listen(3001, () => {
    console.log('Servidor de áudio em execução na porta 3001');
});

app.post('/send-audio', async (req, res) => {
    const title = req.query.title || req.body.title;

    if (!title) {
        return res.status(400).send('O título é obrigatório.');
    }

    try {
        const msgAudioRef = db.collection('MSGAUDIO');
        const snapshot = await msgAudioRef.where('Title', '==', title).get();

        if (snapshot.empty) {
            return res.status(404).send('Nenhum documento encontrado com o título especificado.');
        }

        let delay = 5;
        snapshot.forEach(doc => {
            delay = doc.data().Delay || delay;
        });
        delay = delay + 1;

        console.log(`Delay obtido: ${delay}s`);

        const audioPath = `AUDIOS/${title}.wav`;
        const tempFilePath = path.join(__dirname, 'tempAudio.wav'); // Convertido para WAV
        const file = bucket.file(audioPath);

        await file.download({ destination: tempFilePath });
        console.log(`Arquivo baixado para: ${tempFilePath}`);

        const textAreaSelector = 'p.selectable-text.copyable-text';
        await page.waitForSelector(textAreaSelector, { visible: true });
        const textArea = await page.$(textAreaSelector);

        const randomCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const endTime = Date.now() + 1000;

        while (Date.now() < endTime - 100) {
            const char = randomCharacters.charAt(Math.floor(Math.random() * randomCharacters.length));
            await textArea.type(char);
        }

        const sendButtonSelector = '[data-testid="send"], [data-icon="send"]';
        const sendButton = await page.waitForSelector(sendButtonSelector, { visible: true });
        const sendButtonPosition = await sendButton.boundingBox();

        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');

        if (!sendButtonPosition) {
            throw new Error('Não foi possível obter a posição do botão de enviar.');
        }

        console.log('Posição do botão de enviar salva:', sendButtonPosition);

        const { x, y } = sendButtonPosition;

        console.log('Simulando o início da gravação de áudio...');
        await page.mouse.click(x + 5, y + 5);

        console.log('Iniciando reprodução de áudio com FFmpeg...');
        const ffmpegProcess = spawn('ffmpeg', [
            '-f', 'wav',                     // Formato de entrada
            '-i', tempFilePath,              // Caminho do arquivo WAV
            '-f', 'dshow',                   // Use dshow para captura de áudio no Windows
            '-i', 'audio="Microfone (DroidCam Virtual Audio)"', // Nome correto do dispositivo de áudio
            'default'                        // Enviar para o dispositivo padrão de áudio
        ]);

        ffmpegProcess.stdout.on('data', (data) => {
            console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.error(`FFmpeg stderr: ${data}`);
        });

        ffmpegProcess.on('close', async (code) => {
            console.log(`Processo FFmpeg encerrado com código: ${code}`);

            // Simular o clique para parar a gravação de áudio
            console.log('Simulando o término da gravação de áudio...');
            await page.mouse.click(x + 5, y + 5);

            // Apagar o arquivo temporário
            fs.unlinkSync(tempFilePath);
            res.send('Áudio enviado com sucesso!');
        });

    } catch (error) {
        console.error('Erro ao enviar o áudio:', error);
        res.status(500).send('Erro ao enviar o áudio.');
    }
});


// Função para listar dispositivos de áudio com SoX
async function getSoXAudioDevices() {
    return new Promise((resolve, reject) => {
        const soxDevices = spawn('sox', ['--devices']);
        let devicesOutput = '';
        
        soxDevices.stdout.on('data', (data) => {
            devicesOutput += data.toString();
        });

        soxDevices.stderr.on('data', (data) => {
            console.error(`SoX devices stderr: ${data}`);
        });

        soxDevices.on('close', () => {
            const devices = parseSoXDevices(devicesOutput);
            resolve(devices);
        });

        soxDevices.on('error', (err) => {
            reject(err);
        });
    });
}

// Função para processar a saída de dispositivos SoX
function parseSoXDevices(devicesOutput) {
    const devices = [];
    const lines = devicesOutput.split('\n');
    let isDeviceSection = false;

    lines.forEach(line => {
        if (line.includes('Available devices')) {
            isDeviceSection = true;
            return;
        }

        if (isDeviceSection) {
            if (line.trim() === '') return;
            const parts = line.trim().split(/\s+/);
            const name = parts.slice(1).join(' ');
            devices.push({ index: parseInt(parts[0]), name });
        }
    });

    return devices;
}

// Iniciar o servidor e o navegador
app.listen(3000, async () => {
    console.log('Servidor rodando em http://localhost:3000');
    await abrirNavegador();
});