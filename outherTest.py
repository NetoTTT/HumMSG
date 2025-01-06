import pyaudio
import wave

# Abrindo o arquivo WAV
file = wave.open('C:/Users/foque/Documents/GitHub/HumMSG/tempAudio.wav', 'rb')

# Inicializando PyAudio
p = pyaudio.PyAudio()

# Obtendo o número de canais e taxa de amostragem do arquivo de áudio
channels = file.getnchannels()
rate = file.getframerate()

# Verificando se o número de canais é válido (1 ou 2)
if channels not in [1, 2]:
    print("Erro: o arquivo de áudio deve ser mono (1 canal) ou estéreo (2 canais).")
    file.close()
    p.terminate()
else:
    # Selecione o dispositivo de saída (exemplo: "hummsg (Virtual Audio Cable)")
    device_index = None
    for i in range(p.get_device_count()):
        device_info = p.get_device_info_by_index(i)
        if "hummsg (Virtual Audio Cable)" in device_info['name']:
            device_index = i
            break

    # Verificando se o dispositivo foi encontrado
    if device_index is None:
        print("Erro: Dispositivo não encontrado!")
    else:
        # Abrindo o stream para reprodução
        stream = p.open(format=p.get_format_from_width(file.getsampwidth()),
                        channels=channels,  # Usando o número de canais do arquivo
                        rate=rate,
                        output=True,
                        output_device_index=device_index)  # Especificando o dispositivo de saída

        # Reproduzindo o áudio
        data = file.readframes(1024)
        while data:
            stream.write(data)
            data = file.readframes(1024)

        # Fechando o stream e o arquivo
        stream.stop_stream()
        stream.close()
        p.terminate()
        file.close()
