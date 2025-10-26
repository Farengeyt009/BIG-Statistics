from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class WeChatBinding:
    """Модель привязки WeChat аккаунта"""
    id: Optional[int] = None
    user_id: int = None
    wechat_openid: str = None
    wechat_unionid: Optional[str] = None
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """Преобразование в словарь для API"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'wechat_openid': self.wechat_openid,
            'wechat_unionid': self.wechat_unionid,
            'nickname': self.nickname,
            'avatar_url': self.avatar_url,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
