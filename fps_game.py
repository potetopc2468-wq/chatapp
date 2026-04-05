from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController
import random
import socket
import json
import threading

app = Ursina()

# --- マルチプレイ通信の基本設定 ---
my_id = str(random.randint(10000, 99999))
# 【重要】Hamachiの電源ボタンの横に表示されている「IPv4アドレス」(例: 25.x.x.x) をここに入力します。
# 友達に渡す時も、あなたのHamachiのIPアドレスを入れたまま渡してください。
SERVER_IP = '125.3.111.38' 
SERVER_PORT = 50000

# UDPソケットの準備
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
# 初回だけサーバーに挨拶してポートを開く
sock.sendto(b'ping', (SERVER_IP, SERVER_PORT))

# 他プレイヤーの情報を保存する辞書
shared_state = {}
other_player_entities = {}
shoots_to_process = []

def receive_data():
    while True:
        try:
            data, addr = sock.recvfrom(1024)
            msg = json.loads(data.decode('utf-8'))
            if 'id' in msg and msg['id'] != my_id:
                if msg.get('type') == 'shoot':
                    shoots_to_process.append(msg['id'])
                elif msg.get('type') == 'pos':
                    shared_state[msg['id']] = msg
        except Exception:
            pass

# サーバーからのデータ受信は裏で常に動かしておく
threading.Thread(target=receive_data, daemon=True).start()

# 空と地面の作成
window.color = color.light_gray
ground = Entity(model='plane', scale=(100, 1, 100), color=color.lime, texture='white_cube', texture_scale=(100, 100), collider='box')

# ターゲット（箱）をランダムに配置
targets = []
for i in range(50):
    target = Entity(
        model='cube',
        color=color.random_color(),
        position=(random.randint(-20, 20), random.randint(1, 5), random.randint(-20, 20)),
        scale=(random.randint(1, 3), random.randint(1, 3), random.randint(1, 3)),
        collider='box'
    )
    targets.append(target)

# 見える弾のクラスを定義
class Bullet(Entity):
    def __init__(self, position, direction, **kwargs):
        super().__init__(
            model='sphere',
            color=color.yellow,
            scale=0.2,
            position=position,
            collider='sphere',
            **kwargs
        )
        self.direction = direction
        self.speed = 50
        self.lifetime = 2.0
        
    def update(self):
        # 弾を前方に移動させる
        self.position += self.direction * self.speed * time.dt
        self.lifetime -= time.dt
        if self.lifetime < 0:
            destroy(self)
            return
        
        # 弾の当たり判定（移動先に何かないかチェック。自分自身とプレイヤーは無視する）
        hit_info = raycast(self.position, self.direction, distance=self.speed * time.dt, ignore=(player, self))
        if hit_info.hit:
            if hit_info.entity in targets:
                destroy(hit_info.entity)  # 当たった箱を壊す
                targets.remove(hit_info.entity)
            destroy(self)  # 箱や地面に当たったら弾も消える

# プレイヤー（FPSコントローラー）
player = FirstPersonController()
# 慣性を有効にするためにプレイヤーの挙動を少し調整します
player.speed = 10
player.jump_height = 2

# 武器の作成
gun = Entity(
    model='cube',
    parent=camera,
    position=(0.5, -0.25, 0.25),
    scale=(0.1, 0.1, 0.4),
    origin_z=-0.5,
    color=color.black,
    on_cooldown=False
)

# 銃の元の位置と反動時の位置を固定値で定義
gun_original_pos = Vec3(0.5, -0.25, 0.25)
gun_recoil_pos = Vec3(0.5, -0.25, 0.15)

# 射撃フラグ
is_shooting = False

def shoot():
    if not gun.on_cooldown:
        gun.on_cooldown = True
        
        # 見える弾（実体）を発射。自分に当たらないように少し前から出す
        Bullet(position=camera.world_position + camera.forward * 1.5, direction=camera.forward)
        
        # 発砲したことをサーバー（他のプレイヤー）に知らせる
        try:
            msg = {'id': my_id, 'type': 'shoot'}
            sock.sendto(json.dumps(msg).encode('utf-8'), (SERVER_IP, SERVER_PORT))
        except:
            pass
        
        # 銃の反動（アニメーションの重複でズレるのを防ぐため、直接位置を指定して戻す）
        gun.position = gun_recoil_pos
        invoke(setattr, gun, 'position', gun_original_pos, delay=0.1)
                
        # 連射速度
        invoke(setattr, gun, 'on_cooldown', False, delay=0.15)

# 入力処理
def input(key):
    global is_shooting
    if key == 'left mouse down':
        is_shooting = True
    if key == 'left mouse up':
        is_shooting = False
    
    # Escキーでゲーム終了用にカーソルを表示
    if key == 'escape':
        application.quit()

# 毎フレーム呼ばれる処理
def update():
    if is_shooting:
        shoot()
        
    # --- マルチプレイ：自分の位置を毎フレーム送る ---
    try:
        msg = {
            'id': my_id,
            'type': 'pos',
            'x': player.x, 'y': player.y, 'z': player.z,
            'ry': player.rotation_y
        }
        sock.sendto(json.dumps(msg).encode('utf-8'), (SERVER_IP, SERVER_PORT))
    except:
        pass
        
    # --- マルチプレイ：受け取った情報をもとに相手プレイヤーを動かす ---
    for pid, state in list(shared_state.items()):
        if pid not in other_player_entities:
            # 他のプレイヤーが初めて見つかったら、赤い四角のキャラクターを作成
            enemy = Entity(model='cube', color=color.red, scale=(1, 2, 1), origin_y=-0.5, collider='box')
            enemy.position = (state['x'], state['y'], state['z'])
            other_player_entities[pid] = enemy
        else:
            # 既存のプレイヤーなら位置を更新
            enemy = other_player_entities[pid]
            enemy.x = state['x']
            enemy.y = state['y']
            enemy.z = state['z']
            enemy.rotation_y = state['ry']
            
    # --- マルチプレイ：相手が撃った弾を生成 ---
    for pid in shoots_to_process:
        if pid in other_player_entities:
            enemy = other_player_entities[pid]
            # 相手の顔（高さ1.5）の前方から弾を飛ばす
            Bullet(position=enemy.position + enemy.up * 1.5 + enemy.forward * 1.5, direction=enemy.forward)
    shoots_to_process.clear()

app.run()
