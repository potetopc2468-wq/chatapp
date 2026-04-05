import socket
import time

# 外部のPCからも接続できるように '0.0.0.0' に変更します
HOST = '0.0.0.0'
PORT = 50000

print(f"UDPサーバーを起動しました (すべてのIPで受付中:{PORT})")
print("プレイヤーの接続を待機しています...")

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((HOST, PORT))
sock.setblocking(False)

clients = set()
last_seen = {}

while True:
    try:
        data, addr = sock.recvfrom(1024)
        if addr not in clients:
            print(f"新しいプレイヤーが接続しました: {addr}")
            clients.add(addr)
        
        last_seen[addr] = time.time()
        
        # 受け取ったデータを、送ってきた人以外の全員（他プレイヤー）にばらまく
        for c in list(clients):
            if c != addr:
                try:
                    sock.sendto(data, c)
                except:
                    clients.remove(c)
    except BlockingIOError:
        pass
    except Exception as e:
        pass
        
    # 10秒間通信がなかったプレイヤーを切断扱いにする
    current_time = time.time()
    for c in list(clients):
        if current_time - last_seen.get(c, 0) > 10:
            print(f"プレイヤーが切断されました: {c}")
            clients.remove(c)
            del last_seen[c]
            
    time.sleep(0.01)
