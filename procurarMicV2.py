import sounddevice as sd

def find_hummsg_device():
    # Listar todos os dispositivos de áudio disponíveis
    devices = sd.query_devices()
    
    # Buscar por dispositivos com "hummsg" no nome
    hummsg_devices = []
    for idx, device in enumerate(devices):
        if 'hummsg' in device['name'].lower():
            hummsg_devices.append(idx)
    
    return hummsg_devices

if __name__ == "__main__":
    hummsg_devices = find_hummsg_device()
    print(f"Dispositivos 'hummsg' encontrados: {hummsg_devices}")
    if hummsg_devices:
        print(f"Escolhendo o primeiro dispositivo 'hummsg': {hummsg_devices[0]}")
    else:
        print("Nenhum dispositivo 'hummsg' encontrado.")
