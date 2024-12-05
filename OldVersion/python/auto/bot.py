from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Função para enviar mensagem para o bot (deve ser configurada no bot.js)
@app.route('/send_message', methods=['POST'])
def send_message():
    data = request.get_json()
    chat = data.get('chat')
    message = data.get('message')
    
    # Enviar a mensagem para o WhatsApp Web (via WebSocket ou HTTP)
    # Por exemplo, usando uma requisição HTTP ou WebSocket para o Node.js
    try:
        # Substitua pelo código real de interação com o bot.js
        response = requests.post("http://localhost:3000/send_message", json={"chat": chat, "message": message})
        if response.status_code == 200:
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": "Erro ao enviar a mensagem!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == "__main__":
    app.run(port=5000)
