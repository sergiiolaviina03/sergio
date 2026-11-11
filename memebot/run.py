import os
import socket

import uvicorn

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    print(f"\n  MemeBot v4 listo -> http://127.0.0.1:{port}")
    if host in ("0.0.0.0", "::"):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
                sk.connect(("10.255.255.255", 1))
                print(f"  Desde el movil (misma wifi) -> http://{sk.getsockname()[0]}:{port}")
        except OSError:
            pass
    print()
    uvicorn.run("memebot.app:app", host=host, port=port, log_level="warning")
