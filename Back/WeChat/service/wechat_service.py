import uuid
import qrcode
import io
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from database.db_connector import get_connection
from WeChat.models.wechat_binding import WeChatBinding
from WeChat.models.qr_session import QRSession
from WeChat.wechat_config import WECHAT_CONFIG

class WeChatService:
    """Сервис для работы с WeChat интеграцией"""
    
    def __init__(self):
        self.app_id = WECHAT_CONFIG['APP_ID']
        self.app_secret = WECHAT_CONFIG['APP_SECRET']
        self.redirect_uri = WECHAT_CONFIG['REDIRECT_URI']
        self.qr_timeout = WECHAT_CONFIG['QR_SESSION_TIMEOUT']
    
    def generate_qr_session(self, user_id: int) -> Optional[QRSession]:
        """Генерация QR-сессии для привязки WeChat"""
        try:
            session_id = str(uuid.uuid4())
            expires_at = datetime.now() + timedelta(seconds=self.qr_timeout)  # Время из конфига
            
            # Генерируем QR-код данные
            qr_data = {
                'session_id': session_id,
                'user_id': user_id,
                'timestamp': datetime.now().isoformat()
            }
            
            # Создаем QR-код
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(str(qr_data))
            qr.make(fit=True)
            
            # Конвертируем в base64
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            qr_code_data = base64.b64encode(buffer.getvalue()).decode()
            
            # Сохраняем в БД
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO wechat.qr_sessions 
                    (session_id, user_id, qr_code_data, status, expires_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (session_id, user_id, qr_code_data, 'pending', expires_at, datetime.now()))
                
                conn.commit()
                
                return QRSession(
                    session_id=session_id,
                    user_id=user_id,
                    qr_code_data=qr_code_data,
                    status='pending',
                    expires_at=expires_at,
                    created_at=datetime.now()
                )
                
        except Exception as e:
            print(f"Error generating QR session: {str(e)}")
            return None
    
    def get_qr_session_status(self, session_id: str) -> Optional[QRSession]:
        """Получение статуса QR-сессии"""
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT session_id, user_id, qr_code_data, status, expires_at, created_at
                    FROM wechat.qr_sessions 
                    WHERE session_id = ?
                """, (session_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                # Проверяем истечение
                if row.expires_at and datetime.now() > row.expires_at:
                    # Обновляем статус на expired
                    cursor.execute("""
                        UPDATE wechat.qr_sessions 
                        SET status = 'expired' 
                        WHERE session_id = ?
                    """, (session_id,))
                    conn.commit()
                    return QRSession(
                        session_id=row.session_id,
                        user_id=row.user_id,
                        qr_code_data=row.qr_code_data,
                        status='expired',
                        expires_at=row.expires_at,
                        created_at=row.created_at
                    )
                
                return QRSession(
                    session_id=row.session_id,
                    user_id=row.user_id,
                    qr_code_data=row.qr_code_data,
                    status=row.status,
                    expires_at=row.expires_at,
                    created_at=row.created_at
                )
                
        except Exception as e:
            print(f"Error getting QR session status: {str(e)}")
            return None
    
    def bind_wechat_account(self, user_id: int, wechat_data: Dict[str, Any]) -> Optional[WeChatBinding]:
        """Привязка WeChat аккаунта к пользователю"""
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                
                # Проверяем, не привязан ли уже этот WeChat аккаунт
                cursor.execute("""
                    SELECT id FROM wechat.bindings 
                    WHERE wechat_openid = ? AND is_active = 1
                """, (wechat_data.get('openid'),))
                
                if cursor.fetchone():
                    raise ValueError("This WeChat account is already bound to another user")
                
                # Проверяем, не привязан ли уже WeChat к этому пользователю
                cursor.execute("""
                    SELECT id FROM wechat.bindings 
                    WHERE user_id = ? AND is_active = 1
                """, (user_id,))
                
                if cursor.fetchone():
                    raise ValueError("This user already has a WeChat account bound")
                
                # Создаем привязку
                cursor.execute("""
                    INSERT INTO wechat.bindings 
                    (user_id, wechat_openid, wechat_unionid, nickname, avatar_url, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 1, GETDATE(), GETDATE())
                """, (
                    user_id,
                    wechat_data.get('openid'),
                    wechat_data.get('unionid'),
                    wechat_data.get('nickname'),
                    wechat_data.get('headimgurl')
                ))
                
                conn.commit()
                
                # Получаем созданную запись
                cursor.execute("SELECT @@IDENTITY AS id")
                binding_id = cursor.fetchone().id
                
                return WeChatBinding(
                    id=binding_id,
                    user_id=user_id,
                    wechat_openid=wechat_data.get('openid'),
                    wechat_unionid=wechat_data.get('unionid'),
                    nickname=wechat_data.get('nickname'),
                    avatar_url=wechat_data.get('headimgurl'),
                    is_active=True,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
        except Exception as e:
            print(f"Error binding WeChat account: {str(e)}")
            raise e
    
    def get_user_wechat_binding(self, user_id: int) -> Optional[WeChatBinding]:
        """Получение привязки WeChat для пользователя"""
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, user_id, wechat_openid, wechat_unionid, nickname, avatar_url, is_active, created_at, updated_at
                    FROM wechat.bindings 
                    WHERE user_id = ? AND is_active = 1
                """, (user_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                return WeChatBinding(
                    id=row.id,
                    user_id=row.user_id,
                    wechat_openid=row.wechat_openid,
                    wechat_unionid=row.wechat_unionid,
                    nickname=row.nickname,
                    avatar_url=row.avatar_url,
                    is_active=row.is_active,
                    created_at=row.created_at,
                    updated_at=row.updated_at
                )
                
        except Exception as e:
            print(f"Error getting WeChat binding: {str(e)}")
            return None
    
    def unbind_wechat_account(self, user_id: int) -> bool:
        """Отвязка WeChat аккаунта от пользователя"""
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE wechat.bindings 
                    SET is_active = 0, updated_at = GETDATE()
                    WHERE user_id = ? AND is_active = 1
                """, (user_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            print(f"Error unbinding WeChat account: {str(e)}")
            return False
    
    def update_qr_session_status(self, session_id: str, status: str) -> bool:
        """Обновление статуса QR-сессии"""
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE wechat.qr_sessions 
                    SET status = ?
                    WHERE session_id = ?
                """, (status, session_id))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            print(f"Error updating QR session status: {str(e)}")
            return False
