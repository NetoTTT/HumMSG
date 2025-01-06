import pyaudio

p = pyaudio.PyAudio()
for i in range(p.get_device_count()):
    device_info = p.get_device_info_by_index(i)
    print(f"Device {i}: {device_info['name']}")
    print(f"  Max Input Channels: {device_info['maxInputChannels']}")
    print(f"  Max Output Channels: {device_info['maxOutputChannels']}")
    print(f"  Default Sample Rate: {device_info['defaultSampleRate']}\n")
p.terminate()
