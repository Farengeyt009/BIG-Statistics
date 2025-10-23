import React, { useState } from 'react';
import { useComments } from '../hooks/useComments';
import { Avatar } from './ui/Avatar';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CommentsSectionProps {
  taskId: number;
  currentUserId: number;
  onCountChange?: (count: number) => void;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ taskId, currentUserId, onCountChange }) => {
  const { comments, loading, createComment, updateComment, deleteComment } = useComments(taskId);

  // Обновляем счетчик только после первой загрузки данных
  React.useEffect(() => {
    if (onCountChange && !loading && comments.length >= 0) {
      onCountChange(comments.length);
    }
  }, [comments.length, loading]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    const success = await createComment(newComment);
    if (success) {
      setNewComment('');
    }
    setIsSubmitting(false);
  };

  const handleEdit = async (commentId: number) => {
    if (!editText.trim()) return;

    setIsSubmitting(true);
    const success = await updateComment(commentId, editText);
    if (success) {
      setEditingCommentId(null);
      setEditText('');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (commentId: number) => {
    if (confirm('Удалить комментарий?')) {
      await deleteComment(commentId);
    }
  };

  const startEdit = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditText(comment.comment);
  };

  if (loading && comments.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 text-sm">Загрузка комментариев...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Список комментариев */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">Пока нет комментариев</p>
            <p className="text-xs mt-1">Будьте первым!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {/* Аватар */}
              <Avatar 
                name={comment.full_name || comment.username} 
                imageUrl={`/avatar_${comment.user_id}.png`}
                size="sm" 
              />

              {/* Контент комментария */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-gray-900">
                    {comment.full_name || comment.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(comment.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                  </span>
                  {comment.updated_at !== comment.created_at && (
                    <span className="text-xs text-gray-400">(изменено)</span>
                  )}
                </div>

                {editingCommentId === comment.id ? (
                  // Режим редактирования
                  <div>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(comment.id)}
                        disabled={isSubmitting}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditText('');
                        }}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  // Режим просмотра
                  <div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>

                    {/* Действия (только для своих комментариев) */}
                    {comment.user_id === currentUserId && (
                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => startEdit(comment)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="text-xs text-gray-500 hover:text-red-600"
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Форма добавления комментария */}
      <div className="border-t pt-4">
        <div className="flex gap-3">
          <Avatar 
            name="Вы" 
            imageUrl={`/avatar_${currentUserId}.png`}
            size="sm" 
          />
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              rows={3}
              placeholder="Добавить комментарий..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">
                Ctrl+Enter для отправки
              </span>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !newComment.trim()}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Отправка...' : 'Комментировать'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

