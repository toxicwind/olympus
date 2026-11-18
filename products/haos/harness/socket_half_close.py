#!/usr/bin/env python3
"""Half-close (FIN) race harness.

Tests deterministic half-close behavior: both sides shutdown(SHUT_WR)
while still reading, barrier-synchronized so FIN ordering is reproducible.
"""
import socket
import threading
import sys
import time


def server(barrier, port_holder):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("127.0.0.1", 0))
    s.listen(5)
    actual_port = s.getsockname()[1]
    port_holder.append(actual_port)
    print(f"LISTEN {actual_port}", flush=True)
    barrier.wait()
    conn, _ = s.accept()
    conn.settimeout(2.0)
    # half-close edge: shutdown write, keep reading
    time.sleep(0.1)
    try:
        conn.shutdown(socket.SHUT_WR)
    except OSError as e:
        print(f"SERVER SHUT_WR ERR {e}", file=sys.stderr)
    try:
        data = conn.recv(8192)
        print(f"SERVER RECV len={len(data)}", flush=True)
    except Exception as e:
        print(f"SERVER RECV ERR {e}", file=sys.stderr)
    conn.close()
    s.close()


def client(port, barrier, payload=b"X" * 1024):
    barrier.wait()
    c = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    c.settimeout(2.0)
    c.connect(("127.0.0.1", port))
    c.sendall(payload)
    # client half-close after send
    try:
        c.shutdown(socket.SHUT_WR)
    except OSError as e:
        print(f"CLIENT SHUT_WR ERR {e}", file=sys.stderr)
    time.sleep(0.2)
    try:
        remainder = c.recv(4096)
        print(f"CLIENT RECV len={len(remainder)}", flush=True)
    except Exception as e:
        print(f"CLIENT RECV ERR {e}", file=sys.stderr)
    c.close()


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    iterations = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    for i in range(iterations):
        barrier = threading.Barrier(2)
        ports = []
        t = threading.Thread(target=server, args=(barrier, ports), daemon=True)
        t.start()
        # wait for the server to publish its port
        deadline = time.time() + 5.0
        while not ports and time.time() < deadline:
            time.sleep(0.01)
        actual_port = ports[0] if ports else port
        client(actual_port, barrier)
        t.join(timeout=5)
        print(f"ITER {i + 1}/{iterations} done", flush=True)


if __name__ == "__main__":
    main()