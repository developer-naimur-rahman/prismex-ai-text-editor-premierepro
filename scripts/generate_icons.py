import struct
import zlib
from pathlib import Path

def create_png(width, height, color):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    raw_data = b''
    r, g, b = color
    for y in range(height):
        raw_data += b'\x00' + bytes([r, g, b] * width)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw_data)) + chunk(b'IEND', b'')
    return png

out_dir = Path("plugin/assets/icons")
out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / "icon-light.png").write_bytes(create_png(32, 32, (59, 130, 246))) # Blue
(out_dir / "icon-dark.png").write_bytes(create_png(32, 32, (139, 92, 246)))  # Purple
print("Icons created")
