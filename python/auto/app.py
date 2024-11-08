import tkinter as tk
from tkinter import messagebox
import requests
import json

# Mensagens predefinidas
def carregar_mensagens():
    return [
        "Mensagem de Olá",
        "Mensagem de Despedida",
        "Mensagem de Agradecimento",
        "Mensagem de Informações"
    ]

# Função para enviar uma mensagem para o WhatsApp
def enviar_mensagem(chat, mensagem):
    # Aqui, você chamaria a função do bot.js para enviar a mensagem
    # Supondo que você esteja usando um servidor de WebSocket ou HTTP entre Python e Node.js
    try:
        response = requests.post("http://localhost:5000/send_message", json={"chat": chat, "message": mensagem})
        if response.status_code == 200:
            messagebox.showinfo("Sucesso", "Mensagem enviada com sucesso!")
        else:
            messagebox.showerror("Erro", "Erro ao enviar mensagem!")
    except Exception as e:
        messagebox.showerror("Erro", str(e))

# Função para abrir a lista de chats
def abrir_chats():
    # Aqui você faria uma chamada ao backend para buscar os chats disponíveis
    chats = ["Chat 1", "Chat 2", "Chat 3"]  # Exemplo de chats
    return chats

# Função para abrir a interface gráfica
def criar_interface():
    root = tk.Tk()
    root.title("Automação WhatsApp")

    # Lista de chats
    chats = abrir_chats()

    # Caixa de seleção para escolher o chat
    chat_label = tk.Label(root, text="Escolha o chat:")
    chat_label.pack(pady=5)
    chat_var = tk.StringVar()
    chat_var.set(chats[0])  # Definir o primeiro chat como padrão
    chat_menu = tk.OptionMenu(root, chat_var, *chats)
    chat_menu.pack(pady=10)

    # Carregar mensagens predefinidas
    mensagens = carregar_mensagens()
    
    # Caixa de seleção para escolher a mensagem
    msg_label = tk.Label(root, text="Escolha a mensagem:")
    msg_label.pack(pady=5)
    msg_var = tk.StringVar()
    msg_var.set(mensagens[0])  # Definir a primeira mensagem como padrão
    msg_menu = tk.OptionMenu(root, msg_var, *mensagens)
    msg_menu.pack(pady=10)

    # Botão para enviar a mensagem
    enviar_button = tk.Button(root, text="Enviar Mensagem", command=lambda: enviar_mensagem(chat_var.get(), msg_var.get()))
    enviar_button.pack(pady=20)

    # Iniciar o loop da interface gráfica
    root.mainloop()

if __name__ == "__main__":
    criar_interface()
