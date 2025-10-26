from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class QRSession:
    """Модель сессии QR-кода"""
    id: Optional[int] = None
    session_id: str = None
    user_id: Optional[int] = None
    qr_code_data: Optional[str] = None
    status: str = 'pending'  # pending, scanned, confirmed, expired
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """Преобразование в словарь для API"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'user_id': self.user_id,
            'qr_code_data': self.qr_code_data,
            'status': self.status,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def is_expired(self) -> bool:
        """Проверка истечения сессии"""
        if not self.expires_at:
            return False
        return datetime.now() > self.expires_at
