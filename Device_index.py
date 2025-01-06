import pyaudio
import wave

# Inicializar PyAudio
p = pyaudio.PyAudio()

# Abrir o arquivo de áudio
file_path = "tempAudio.wav"
wf = wave.open(file_path, 'rb')

# Configurar o dispositivo hummsg como entrada
input_device_index = 1  # Índice do hummsg no seu sistema

# Configurar stream de saída para reproduzir o áudio
output_stream = p.open(format=pyaudio.paInt16,
                       channels=wf.getnchannels(),
                       rate=wf.getframerate(),
                       output=True)

# Configurar stream de entrada para capturar do hummsg
input_stream = p.open(format=pyaudio.paInt16,
                      channels=wf.getnchannels(),
                      rate=wf.getframerate(),
                      input=True,
                      input_device_index=input_device_index)

# Reproduzir e gravar o áudio
print("Reproduzindo e capturando áudio...")
frames = []  # Para armazenar os dados capturados
data = wf.readframes(1024)

while data:
    # Reproduzir o áudio
    output_stream.write(data)

    # Capturar do dispositivo hummsg
    captured_data = input_stream.read(1024)
    frames.append(captured_data)

    # Ler o próximo bloco de áudio
    data = wf.readframes(1024)

# Salvar o áudio capturado em um novo arquivo
output_file = "captured_audio.wav"
wf_output = wave.open(output_file, 'wb')
wf_output.setnchannels(wf.getnchannels())
wf_output.setsampwidth(p.get_sample_size(pyaudio.paInt16))
wf_output.setframerate(wf.getframerate())
wf_output.writeframes(b''.join(frames))
wf_output.close()

print("Áudio capturado salvo em 'captured_audio.wav'.")

# Fechar streams
output_stream.stop_stream()
output_stream.close()
input_stream.stop_stream()
input_stream.close()

# Finalizar PyAudio
p.terminate()
