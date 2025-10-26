import { useState, useEffect, useCallback } from 'react';

interface QRSession {
  session_id: string;
  qr_code_data: string;
  expires_at: string;
}

interface QRStatus {
  session_id: string;
  user_id: number;
  qr_code_data: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
  expires_at: string;
  created_at: string;
}

export const useWeChatQR = () => {
  const [qrSession, setQrSession] = useState<QRSession | null>(null);
  const [qrStatus, setQrStatus] = useState<QRStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Генерация QR-кода
  const generateQR = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/wechat/generate-qr', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setQrSession(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to generate QR code');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Проверка статуса QR-сессии
  const checkQRStatus = useCallback(async (sessionId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:5000/api/wechat/status/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setQrStatus(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to check QR status');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Автоматическая проверка статуса каждые 2 секунды
  useEffect(() => {
    if (!qrSession?.session_id) return;

    const interval = setInterval(async () => {
      try {
        await checkQRStatus(qrSession.session_id);
      } catch (err) {
        console.error('Error checking QR status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [qrSession?.session_id, checkQRStatus]);

  return {
    qrSession,
    qrStatus,
    loading,
    error,
    generateQR,
    checkQRStatus,
  };
};
