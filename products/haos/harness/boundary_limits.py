#!/usr/bin/env python3
"""Boundary limits harness — the two limits that actually bite.

1. select() FD_SETSIZE (1024, compile-time constant): opening >1024 fds and
   passing them to select() raises OSError/ValueError. This is the real
   FD boundary — RLIMIT_NOFILE does NOT bound select().
2. RLIMIT_NOFILE: lowered to 1024 in a child process, opening fds until
   EMFILE (errno 24 "Too many open files").
3. Non-blocking backlog overflow -> EAGAIN (errno 11).
4. port 0 ephemeral binding, and listen() beyond the kernel backlog max.
"""
import errno
import os
import resource
import select
import socket
import sys
import time


def probe_fd_setsize():
    """select() rejects fds >= FD_SETSIZE regardless of RLIMIT_NOFILE."""
    # CPython does not expose select.FD_SETSIZE; glibc's is a compile-time 1024.
    FD_SETSIZE = 1024
    socks = []
    try:
        for _ in range(FD_SETSIZE + 64):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setblocking(False)
            socks.append(s)
        print(f"FD_SETSIZE opened {len(socks)} fds (limit {FD_SETSIZE})", flush=True)
        try:
            select.select(socks, [], [], 0.01)
            print("SELECT OK (unexpected — fd below FD_SETSIZE?)", flush=True)
        except (ValueError, OSError) as e:
            print(f"SELECT FDSETSIZE_HIT {type(e).__name__}: {e}", flush=True)
    finally:
        for s in socks:
            s.close()


def probe_rlimit_nofile():
    """Lower RLIMIT_NOFILE then exhaust fds -> EMFILE."""
    target = 1024
    soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    new_hard = hard if hard != resource.RLIM_INFINITY and hard < target else target
    try:
        resource.setrlimit(resource.RLIMIT_NOFILE, (target, new_hard))
    except (ValueError, OSError) as e:
        print(f"RLIMIT_SET_FAILED {type(e).__name__}:{e}", file=sys.stderr)
        return
    socks = []
    try:
        while True:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            socks.append(s)
    except OSError as e:
        if e.errno == errno.EMFILE:
            print(f"EMFILE HIT at {len(socks)} fds (RLIMIT_NOFILE={target})", flush=True)
        else:
            print(f"RLIMIT_ERR {errno.errorcode.get(e.errno, e.errno)}:{e}", file=sys.stderr)
    finally:
        for s in socks:
            s.close()
        resource.setrlimit(resource.RLIMIT_NOFILE, (soft, hard))


def probe_eagain():
    """Fill the accept backlog, then connect non-blocking -> EAGAIN."""
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]
    held = []
    try:
        for _ in range(64):
            c = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            c.setblocking(False)
            try:
                c.connect_ex(("127.0.0.1", port))
                held.append(c)
            except OSError:
                c.close()
        time.sleep(0.2)
        c = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        c.setblocking(False)
        try:
            c.connect(("127.0.0.1", port))
            print("CONNECT OK (no EAGAIN — backlog absorbed it)", flush=True)
        except BlockingIOError as e:
            print(f"EAGAIN HIT backlog_full errno={errno.errorcode.get(e.errno, e.errno)}", flush=True)
        except OSError as e:
            print(f"CONNECT ERR {errno.errorcode.get(e.errno, e.errno)}:{e}", flush=True)
        c.close()
    finally:
        for c in held:
            c.close()
        srv.close()


def probe_port_zero():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", 0))
        p = s.getsockname()[1]
        s.listen(5)
        print(f"PORT0 OK ephemeral={p}", flush=True)
    except OSError as e:
        print(f"PORT0 ERR {errno.errorcode.get(e.errno, e.errno)}:{e}", file=sys.stderr)
    finally:
        s.close()


def probe_backlog():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", 0))
        s.listen(65535)
        print("BACKLOG OK listen(65535)", flush=True)
    except OSError as e:
        print(f"BACKLOG ERR {errno.errorcode.get(e.errno, e.errno)}:{e}", file=sys.stderr)
    finally:
        s.close()


def main():
    import time
    globals()["time"] = time
    globals()["time"] = time
    probe_port_zero()
    probe_backlog()
    probe_eagain()
    probe_fd_setsize()
    probe_rlimit_nofile()


if __name__ == "__main__":
    main()
