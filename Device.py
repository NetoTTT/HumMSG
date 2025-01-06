import pyaudio

# Inicializando PyAudio
p = pyaudio.PyAudio()

# Listando os dispositivos disponíveis
for i in range(p.get_device_count()):
    device_info = p.get_device_info_by_index(i)
    print(f"Device {i}: {device_info['name']}")

# Fechando PyAudio
p.terminate()
