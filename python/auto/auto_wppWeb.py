import tkinter as tk
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import threading

# Variável global para o driver
driver = None

# Função para abrir o navegador
def abrir_navegador():
    global driver  # Usar a variável global driver

    options = Options()
    options.add_argument("--start-maximized")  # Maximizar a janela

    # Configurar o Service com o ChromeDriver
    service = Service(ChromeDriverManager().install())

    # Iniciar o WebDriver
    driver = webdriver.Chrome(service=service, options=options)

    # Abrir WhatsApp Web
    driver.get("https://web.whatsapp.com")
    print("WhatsApp Web foi aberto no Chrome.")

    # Manter o navegador aberto até que o botão de fechar seja clicado
    return driver

# Função para fechar o navegador e a interface
def fechar_navegador(root):
    global driver  # Usar a variável global driver
    if driver:
        driver.quit()
        print("Navegador fechado.")
    else:
        print("Nenhum navegador aberto.")
    
    # Fechar a interface gráfica
    root.quit()
    root.destroy()

# Função para criar a interface gráfica
def criar_interface():
    # Criar a janela principal
    root = tk.Tk()
    root.title("Controle de Navegador")

    # Texto informativo
    label = tk.Label(root, text="O navegador foi aberto. Clique no botão abaixo para fechar.")
    label.pack(pady=10)

    # Botão para fechar o navegador e a interface
    close_button = tk.Button(root, text="Fechar Navegador", command=lambda: fechar_navegador(root))
    close_button.pack(pady=20)

    # Iniciar o loop da interface gráfica
    root.mainloop()

# Função para rodar o navegador em um thread separado
def iniciar_programa():
    global driver

    # Abrir o navegador em um thread separado
    driver = abrir_navegador()
    
    # Criar e iniciar a interface gráfica
    criar_interface()

# Iniciar o programa em uma thread para abrir o navegador e a GUI simultaneamente
if __name__ == "__main__":
    threading.Thread(target=iniciar_programa).start()
