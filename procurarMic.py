import sounddevice as sd

# Listar todos os dispositivos de áudio disponíveis
devices = sd.query_devices()
print(devices)
