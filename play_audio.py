import sys
import wave
import numpy as np
import time
import pyaudio  # Certifique-se de importar corretamente

def play_audio_with_pyaudio(audio_file, delay, device_name):
    try:
        # Abrir o arquivo WAV
        wf = wave.open(audio_file, 'rb')

        # Obter parâmetros do arquivo WAV
        num_channels = wf.getnchannels()  # Número de canais
        sample_rate = wf.getframerate()   # Taxa de amostragem
        num_frames = wf.getnframes()      # Número de frames (dados de áudio)

        # Se o número de canais for inválido, usar 2 (estéreo) como padrão
        if num_channels not in [1, 2]:
            print(f"Erro: o número de canais ({num_channels}) não é suportado, usando 2 canais (estéreo) como padrão.")
            num_channels = 2  # Definir como estéreo se o número de canais for inválido

        # Ler os dados do arquivo WAV
        audio_data = wf.readframes(num_frames)

        # Converter os dados para o formato numpy
        audio_array = np.frombuffer(audio_data, dtype=np.int16)

        # Iniciar PyAudio
        p = pyaudio.PyAudio()  # A referência correta é pyaudio.PyAudio()

        # Encontrar o dispositivo de saída
        device_index = find_device_index(device_name, p)

        if device_index is None:
            print(f"Dispositivo '{device_name}' não encontrado.")
            return

        # Abrir fluxo de saída com o dispositivo correto
        stream = p.open(format=pyaudio.paInt16,  # Use paInt16 corretamente
                        channels=num_channels,
                        rate=sample_rate,
                        output=True,
                        output_device_index=device_index)

        # Reproduzir o áudio
        print(f"Reproduzindo áudio no dispositivo '{device_name}'...")
        stream.write(audio_array.tobytes())  # Reproduz os dados no fluxo de áudio

        time.sleep(delay)  # Aguardar o tempo de delay antes de encerrar

        stream.stop_stream()
        stream.close()
        p.terminate()
        print("Reprodução do áudio concluída.")
    except Exception as e:
        print(f"Erro ao reproduzir áudio: {e}")


def find_device_index(device_name, p):
    # Obter os dispositivos de áudio disponíveis
    devices = p.get_device_count()
    for i in range(devices):
        info = p.get_device_info_by_index(i)
        if device_name.lower() in info['name'].lower():
            return i
    return None


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python play_audio.py <caminho_do_audio> <delay_em_segundos>")
        sys.exit(1)

    audio_path = sys.argv[1]  # Recebe o caminho do arquivo de áudio
    delay = float(sys.argv[2])  # Recebe o tempo de delay em segundos
    device_name = "hummsg"  # Nome do dispositivo (pode ser o nome exato)

    play_audio_with_pyaudio(audio_path, delay, device_name)
