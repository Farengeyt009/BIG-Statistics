import React, { useState, useEffect } from 'react';
import { Avatar } from './ui/Avatar';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ApprovalsSectionProps {
  taskId: number;
  currentUserId: number;
  projectId: number;
  statusId: number;
  onAutoTransition?: () => void;
}

const API_BASE = '';

export const ApprovalsSection: React.FC<ApprovalsSectionProps> = ({ taskId, currentUserId, projectId, statusId, onAutoTransition }) => {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [allowedToApprove, setAllowedToApprove] = useState(false);
  const [requiredCount, setRequiredCount] = useState(0);

  const getToken = () => localStorage.getItem('authToken');

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setApprovals(data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки согласований:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ comment }),
      });

      const data = await response.json();
      if (data.success) {
        setComment('');
        await fetchApprovals();
        
        // Небольшая задержка для автоперевода на сервере
        setTimeout(() => {
          if (onAutoTransition) {
            onAutoTransition();
          }
        }, 500);
      } else {
        alert(data.error || 'Ошибка согласования');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Ошибка согласования');
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Отозвать согласование?')) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchApprovals();
      }
    } catch (err) {
      console.error('Ошибка:', err);
    }
  };

  const checkApprovalPermissions = async () => {
    try {
      const token = getToken();
      // Получаем переходы из текущего статуса
      const response = await fetch(`${API_BASE}/api/task-manager/workflow/projects/${projectId}/transitions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success) {
        // Ищем переходы из текущего статуса с требованием согласований
        const transitionsFromCurrent = data.data.filter(
          (t: any) => t.from_status_id === statusId && t.requires_approvals
        );
        
        if (transitionsFromCurrent.length > 0) {
          // Берем первый переход с согласованиями
          const trans = transitionsFromCurrent[0];
          setRequiredCount(trans.required_approvals_count || 0);
          
          if (trans.required_approvers) {
            const approvers = JSON.parse(trans.required_approvers);
            setAllowedToApprove(approvers.includes(currentUserId));
          } else {
            // Если список пуст - все могут
            setAllowedToApprove(true);
          }
        } else {
          // Нет требований - все могут
          setAllowedToApprove(true);
        }
      }
    } catch (err) {
      console.error('Ошибка проверки прав:', err);
    }
  };

  useEffect(() => {
    fetchApprovals();
    checkApprovalPermissions();
  }, [taskId, statusId]);

  const hasUserApproved = approvals.some(a => a.user_id === currentUserId);

  return (
    <div className="space-y-4">
      {/* Кнопка согласовать */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        {hasUserApproved ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Вы согласовали эту задачу</span>
              {requiredCount > 0 && (
                <span className="text-sm">({approvals.length}/{requiredCount})</span>
              )}
            </div>
            <button
              onClick={handleRevoke}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Отозвать
            </button>
          </div>
        ) : allowedToApprove ? (
          <div>
            <button
              onClick={handleApprove}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium mb-2"
            >
              ✓ Согласовать
              {requiredCount > 0 && ` (${approvals.length}/${requiredCount})`}
            </button>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm"
            />
          </div>
        ) : (
          <div className="text-center text-gray-600 py-2">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm font-medium">У вас нет прав на согласование</p>
            <p className="text-xs text-gray-500 mt-1">Согласовывать могут только указанные пользователи</p>
            {requiredCount > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Согласовано: {approvals.length}/{requiredCount}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Список согласований */}
      {approvals.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Согласовали ({approvals.length}):</h4>
          <div className="space-y-2">
            {approvals.map((approval) => (
              <div key={approval.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Avatar
                  name={approval.full_name || approval.username}
                  imageUrl={`/avatar_${approval.user_id}.png`}
                  size="sm"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    {approval.full_name || approval.username}
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(approval.approved_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                  </div>
                  {approval.comment && (
                    <div className="text-sm text-gray-700 mt-1">{approval.comment}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

