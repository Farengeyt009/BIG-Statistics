from sqlalchemy.ext.asyncio import AsyncSession

class BaseRepository:
    """Общий предок для всех репозиториев."""
    def __init__(self, session: AsyncSession):
        self.session = session
