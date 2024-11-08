const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('ready', () => {
    console.log('Cliente está pronto!');
    
    // Enviar mensagem ao número e texto fornecidos
    const number = process.argv[2];
    const message = process.argv[3];
    const chatId = number + "@c.us"; // Formato padrão do WhatsApp

    client.sendMessage(chatId, message).then(response => {
        console.log("Mensagem enviada com sucesso:", response);
        process.exit(0);  // Encerra o script após enviar
    }).catch(error => {
        console.error("Erro ao enviar mensagem:", error);
        process.exit(1);
    });
});

client.initialize();
