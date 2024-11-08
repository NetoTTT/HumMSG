from flask import Flask, request, jsonify
import subprocess

app = Flask(__name__)

@app.route('/send-message', methods=['POST'])
def send_message():
    data = request.get_json()
    number = data.get('number')
    message = data.get('message')

    # Chama o script Node.js com o número e a mensagem como argumentos
    subprocess.run(["node", "sendMessage.js", number, message])

    return jsonify({"status": "Message sent!"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
