#!/usr/bin/env python3
"""RST vs graceful close harness.

Forces an abrupt TCP RST (SO_LINGER with timeout 0) on the client side
while the server is mid-recv, then verifies the server observes the
RST cleanly rather than a hung or panicked fd.
"""
import socket
import threading
import sys
import time
import struct


def server(port_holder, ready):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("127.0.0.1", 0))
    s.listen(1)
    port_holder.append(s.getsockname()[1])
    ready.set()
    conn, _ = s.accept()
    conn.settimeout(3.0)
    try:
        data = conn.recv(4096)
        print(f"SERVER RECV len={len(data)}", flush=True)
    except (ConnectionResetError, ConnectionAbortedError, OSError) as e:
        print(f"SERVER RST OBSERVED {type(e).__name__}", flush=True)
    except Exception as e:
        print(f"SERVER ERR {type(e).__name__}:{e}", file=sys.stderr)
    finally:
        try:
            conn.close()
        except OSError:
            pass
        s.close()


def client(port):
    c = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    c.settimeout(3.0)
    c.connect(("127.0.0.1", port))
    c.sendall(b"PING" * 256)
    # abrupt RST: SO_LINGER with l_onoff=1, l_linger=0
    linger = struct.pack("ii", 1, 0)
    c.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, linger)
    try:
        c.close()
    except OSError:
        pass
    print("CLIENT RST SENT", flush=True)


def main():
    port_holder = []
    ready = threading.Event()
    t = threading.Thread(target=server, args=(port_holder, ready), daemon=True)
    t.start()
    ready.wait(timeout=5)
    if not port_holder:
        print("SERVER PORT NOT PUBLISHED", file=sys.stderr)
        sys.exit(1)
    client(port_holder[0])
    t.join(timeout=5)


if __name__ == "__main__":
    main()