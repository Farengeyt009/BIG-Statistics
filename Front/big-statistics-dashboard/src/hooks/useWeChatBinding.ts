import { useState, useEffect, useCallback } from 'react';

interface WeChatBinding {
  id: number;
  user_id: number;
  wechat_openid: string;
  wechat_unionid?: string;
  nickname?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useWeChatBinding = () => {
  const [binding, setBinding] = useState<WeChatBinding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Получение информации о привязке
  const getBinding = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/wechat/binding', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setBinding(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to get WeChat binding');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Привязка WeChat аккаунта
  const bindWeChat = useCallback(async (wechatData: {
    openid: string;
    unionid?: string;
    nickname?: string;
    headimgurl?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/wechat/bind', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wechatData),
      });

      const data = await response.json();
      
      if (data.success) {
        setBinding(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to bind WeChat account');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Отвязка WeChat аккаунта
  const unbindWeChat = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/wechat/unbind', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setBinding(null);
        return true;
      } else {
        throw new Error(data.message || 'Failed to unbind WeChat account');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем привязку при инициализации
  useEffect(() => {
    getBinding();
  }, [getBinding]);

  return {
    binding,
    loading,
    error,
    getBinding,
    bindWeChat,
    unbindWeChat,
  };
};
