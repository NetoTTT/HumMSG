const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Configuração do cliente com autenticação local para manter a sessão ativa
const client = new Client({
    authStrategy: new LocalAuth()
});

// Gera o QR Code para login inicial
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Confirmação de login
client.on('ready', () => {
    console.log('Cliente está pronto!');
});

// Envio de mensagem (exemplo simples)
client.on('message', message => {
    if (message.body === '!ping') {
        message.reply('pong');
    }
});

client.initialize();
