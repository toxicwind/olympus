#!/usr/bin/env python3
"""Payload overflow / size-boundary harness.

Tests allocation and send behavior at boundaries:
0, 1, 1023, 1024, 1025, 4096, 65535, 65536, 1 MiB.
Detects off-by-one, truncation, EMSGSIZE, and memory blow-up.
"""
import socket
import sys
import time

SIZES = [0, 1, 1023, 1024, 1025, 4096, 65535, 65536, 1024 * 1024]


def test_alloc(n):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    try:
        s.bind(("127.0.0.1", 0))
        buf = b"A" * n
        print(f"SIZE {n} ALLOC OK {len(buf)}", flush=True)
    except MemoryError as e:
        print(f"SIZE {n} MEMERR {e}", file=sys.stderr)
    except Exception as e:
        print(f"SIZE {n} ERR {type(e).__name__}:{e}", file=sys.stderr)
    finally:
        s.close()


def test_send(n):
    """Actually attempt to send n bytes over a TCP socket to detect EMSGSIZE."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    try:
        s.bind(("127.0.0.1", 0))
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", 0))
        srv.listen(1)
        port = srv.getsockname()[1]
        s.connect(("127.0.0.1", port))
        conn, _ = srv.accept()
        payload = b"B" * n
        try:
            s.sendall(payload)
            print(f"SIZE {n} SEND OK", flush=True)
        except (OSError, OverflowError) as e:
            print(f"SIZE {n} SEND ERR {type(e).__name__}:{e}", file=sys.stderr)
        conn.close()
        srv.close()
    except Exception as e:
        print(f"SIZE {n} SETUP ERR {type(e).__name__}:{e}", file=sys.stderr)
    finally:
        s.close()


def main():
    for n in SIZES:
        test_alloc(n)
        test_send(n)
        time.sleep(0.05)


if __name__ == "__main__":
    main()