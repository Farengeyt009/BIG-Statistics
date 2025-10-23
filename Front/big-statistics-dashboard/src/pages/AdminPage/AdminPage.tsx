import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePageView } from '../../hooks/usePageView';

interface User {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

interface Page {
  page_key: string;
  page_name: string;
  description: string;
  requires_view_permission: boolean;
  requires_edit_permission: boolean;
}

interface Permission {
  page_key: string;
  can_view: boolean;
  can_edit: boolean;
}

const AdminPage: React.FC = () => {
  const { token } = useAuth();
  
  // Логируем посещение страницы Admin
  usePageView('admin');
  
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // State для модального окна смены пароля
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // State для управления аккордеонами групп прав
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['production', 'orders', 'kpi']));
  
  // State для статистики системы
  const [systemStats, setSystemStats] = useState<any>(null);
  const [selectedUserStats, setSelectedUserStats] = useState<any>(null);
  
  // State для вкладок
  const [activeTab, setActiveTab] = useState<'users' | 'statistics'>('users');
  
  // State для модального окна удаления
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Загрузка пользователей, страниц и статистики
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        // Загружаем пользователей
        const usersResponse = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const usersData = await usersResponse.json();
        
        if (usersData.success) {
          setUsers(usersData.users);
        }

        // Загружаем страницы
        const pagesResponse = await fetch('/api/admin/pages', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const pagesData = await pagesResponse.json();
        
        if (pagesData.success) {
          setPages(pagesData.pages);
        }

        // Загружаем статистику
        const statsResponse = await fetch('/api/admin/statistics', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const statsData = await statsResponse.json();
        
        if (statsData.success) {
          setSystemStats(statsData.statistics);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, [token]);

  // Загрузка прав пользователя при выборе
  const handleSelectUser = async (user: User) => {
    setSelectedUser(user);
    setMessage(null);
    
    try {
      // Загружаем права
      const permissionsResponse = await fetch(`/api/admin/users/${user.user_id}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const permissionsData = await permissionsResponse.json();
      
      if (permissionsData.success) {
        setUserPermissions(permissionsData.permissions);
      }

      // Загружаем статистику пользователя
      const statsResponse = await fetch(`/api/admin/users/${user.user_id}/statistics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setSelectedUserStats(statsData.statistics);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  // Проверка есть ли право у пользователя
  const hasPermission = (pageKey: string, type: 'view' | 'edit'): boolean => {
    const perm = userPermissions.find(p => p.page_key === pageKey);
    if (!perm) return false;
    return type === 'view' ? perm.can_view : perm.can_edit;
  };

  // Обновление права
  const handleTogglePermission = async (pageKey: string, type: 'view' | 'edit', value: boolean) => {
    if (!selectedUser) return;

    setLoading(true);
    setMessage(null);

    try {
      const currentPerm = userPermissions.find(p => p.page_key === pageKey);
      
      const response = await fetch(`/api/admin/users/${selectedUser.user_id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          page_key: pageKey,
          can_view: type === 'view' ? value : (currentPerm?.can_view || false),
          can_edit: type === 'edit' ? value : (currentPerm?.can_edit || false),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Permission updated successfully!' });
        // Перезагружаем права
        handleSelectUser(selectedUser);
      } else {
        setMessage({ type: 'error', text: data.error || 'Error updating permission' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация пользователей по поисковому запросу
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Группировка страниц по категориям
  const groupedPages = pages.reduce((acc, page) => {
    // Определяем группу по page_key (префикс до первого _)
    let groupKey = 'other';
    let groupName = 'Other';
    
    if (page.page_key.startsWith('production_')) {
      groupKey = 'production';
      groupName = 'Production';
    } else if (page.page_key.startsWith('orders_')) {
      groupKey = 'orders';
      groupName = 'Orders';
    } else if (page.page_key === 'kpi') {
      groupKey = 'kpi';
      groupName = 'KPI';
    }
    
    if (!acc[groupKey]) {
      acc[groupKey] = {
        name: groupName,
        pages: []
      };
    }
    
    acc[groupKey].pages.push(page);
    return acc;
  }, {} as Record<string, { name: string; pages: Page[] }>);

  // Функция переключения группы
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  // Открытие модального окна удаления
  const handleOpenDeleteModal = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  // Удаление пользователя
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userToDelete.user_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `User ${userToDelete.username} deleted successfully!` });
        
        // Удаляем из локального списка
        setUsers(prevUsers => prevUsers.filter(u => u.user_id !== userToDelete.user_id));
        
        // Если удаленный пользователь был выбран, сбрасываем выбор
        if (selectedUser?.user_id === userToDelete.user_id) {
          setSelectedUser(null);
          setUserPermissions([]);
        }
        
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Error deleting user' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  // Обновление статуса администратора
  const handleToggleAdmin = async (value: boolean) => {
    if (!selectedUser) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.user_id}/admin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_admin: value,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: value ? 'User granted admin privileges!' : 'Admin privileges revoked!' });
        
        // Обновляем локальный список пользователей
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.user_id === selectedUser.user_id ? { ...u, is_admin: value } : u
          )
        );
        
        // Обновляем выбранного пользователя
        setSelectedUser(prev => prev ? { ...prev, is_admin: value } : null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Error updating admin status' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  // Открытие модального окна смены пароля
  const handleOpenPasswordModal = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setIsPasswordModalOpen(true);
  };

  // Смена пароля пользователя
  const handleChangePassword = async () => {
    if (!selectedUser) return;

    // Валидация
    if (!newPassword) {
      setPasswordError('Password is required');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setLoading(true);
    setPasswordError('');

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.user_id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Password updated successfully for ${selectedUser.username}!` });
        setIsPasswordModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'Error updating password');
      }
    } catch (err) {
      setPasswordError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-[#142143] mb-6">User Administration</h1>

      {/* Вкладки */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-[#142143] text-[#142143]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Users & Permissions</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'statistics'
                ? 'border-[#142143] text-[#142143]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Statistics</span>
            </div>
          </button>
        </div>
      </div>

      {/* Сообщение */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-100 border border-green-400 text-green-700'
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Вкладка Users & Permissions */}
      {activeTab === 'users' && (
        <div className="flex gap-6">
        {/* ЛЕВАЯ ПАНЕЛЬ: Список пользователей */}
        <div className="w-80 bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Users</h2>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <div
                  key={user.user_id}
                  onClick={() => handleSelectUser(user)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedUser?.user_id === user.user_id
                      ? 'bg-blue-100 border-blue-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="font-medium text-gray-800">{user.username}</div>
                  <div className="text-sm text-gray-500">{user.full_name}</div>
                  {user.is_admin && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                      Admin
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No users found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">Try a different search</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ: Права пользователя */}
        <div className="flex-1 bg-white rounded-lg shadow p-6">
          {selectedUser ? (
            <>
              {/* Компактный заголовок */}
              <div className="mb-3 pb-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedUser.full_name || selectedUser.username}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-xs text-gray-500">@{selectedUser.username}</p>
                  {selectedUserStats && selectedUserStats.last_login && (
                    <>
                      <span className="text-gray-300">•</span>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Last login: {new Date(selectedUserStats.last_login).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </>
                  )}
                  {selectedUserStats && selectedUserStats.total_logins > 0 && (
                    <>
                      <span className="text-gray-300">•</span>
                      <p className="text-xs text-gray-500">{selectedUserStats.total_logins} logins</p>
                    </>
                  )}
                </div>
              </div>

              {/* Компактная панель управления */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                {/* Administrator Toggle - компактный */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Administrator</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.is_admin}
                      onChange={(e) => handleToggleAdmin(e.target.checked)}
                      disabled={loading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    <span className="ml-2 text-xs font-medium text-gray-700">
                      {selectedUser.is_admin ? 'Yes' : 'No'}
                    </span>
                  </label>
                </div>

                {/* Кнопки действий */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Change Password */}
                  <button
                    onClick={handleOpenPasswordModal}
                    disabled={loading}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>Password</span>
                  </button>

                  {/* Delete User */}
                  <button
                    onClick={() => handleOpenDeleteModal(selectedUser)}
                    disabled={loading}
                    className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Компактное предупреждение для админов */}
              {selectedUser.is_admin && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-800">
                    ⚡ Has all permissions automatically
                  </p>
                </div>
              )}

              {/* Заголовок секции прав - компактный */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Page Permissions</h3>
                <span className="text-xs text-gray-500">{Object.keys(groupedPages).length} categories, {pages.length} permissions</span>
              </div>

              {/* Сгруппированные права с аккордеонами */}
              <div className="space-y-2">
                {Object.entries(groupedPages).map(([groupKey, group]) => (
                  <div key={groupKey} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Заголовок группы */}
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="w-full px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <svg 
                          className={`w-4 h-4 text-gray-500 transition-transform ${expandedGroups.has(groupKey) ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">{group.name}</span>
                        <span className="text-xs text-gray-500">({group.pages.length})</span>
                      </div>
                    </button>

                    {/* Содержимое группы */}
                    {expandedGroups.has(groupKey) && (
                      <div className="p-2 space-y-1.5 bg-white">
                        {group.pages.map(page => (
                          <div key={page.page_key} className="border border-gray-200 rounded-md p-2.5 hover:border-gray-300 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              {/* Левая часть - название и описание */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-medium text-gray-800 leading-tight">
                                  {page.page_name.replace(/^(Production|Orders|KPI)\s*-\s*/i, '')}
                                </h4>
                                {page.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{page.description}</p>
                                )}
                              </div>

                              {/* Правая часть - чекбоксы */}
                              <div className="flex gap-3 flex-shrink-0">
                                {/* CanView */}
                                {page.requires_view_permission && (
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={hasPermission(page.page_key, 'view')}
                                      onChange={(e) => handleTogglePermission(page.page_key, 'view', e.target.checked)}
                                      disabled={selectedUser.is_admin || loading}
                                      className="w-3.5 h-3.5 text-blue-600 rounded"
                                    />
                                    <span className="text-xs text-gray-600">View</span>
                                  </label>
                                )}

                                {/* CanEdit */}
                                {page.requires_edit_permission && (
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={hasPermission(page.page_key, 'edit')}
                                      onChange={(e) => handleTogglePermission(page.page_key, 'edit', e.target.checked)}
                                      disabled={selectedUser.is_admin || loading}
                                      className="w-3.5 h-3.5 text-green-600 rounded"
                                    />
                                    <span className="text-xs text-gray-600">Edit</span>
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Пустое состояние */
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-lg font-medium">Select a user</p>
                <p className="text-sm mt-1">to manage their permissions</p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Вкладка Statistics */}
      {activeTab === 'statistics' && systemStats && (
        <div className="space-y-6">
          {/* Панель общей статистики */}
          <div className="grid grid-cols-6 gap-4">
            {/* Total Users */}
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Total Users</p>
                  <p className="text-2xl font-bold text-gray-800">{systemStats.total_users}</p>
                </div>
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>

            {/* Admins */}
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Administrators</p>
                  <p className="text-2xl font-bold text-gray-800">{systemStats.total_admins}</p>
                </div>
                <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>

            {/* Active */}
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Active</p>
                  <p className="text-2xl font-bold text-gray-800">{systemStats.active_users}</p>
                </div>
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Inactive */}
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Inactive</p>
                  <p className="text-2xl font-bold text-gray-800">{systemStats.inactive_users}</p>
                </div>
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>

            {/* New (7 days) */}
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">New (7d)</p>
                  <p className="text-2xl font-bold text-gray-800">{systemStats.new_users_7days}</p>
                </div>
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>

            {/* Logged in today */}
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-cyan-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Online Today</p>
                  <p className="text-2xl font-bold text-gray-800">{systemStats.logged_in_today}</p>
                </div>
                <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Таблица активности пользователей */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Most Active Users (Last 7 Days)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Logins</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {systemStats.top_active_users && systemStats.top_active_users.length > 0 ? (
                    systemStats.top_active_users.map((user: any, index: number) => (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {user.login_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, (user.login_count / Math.max(...systemStats.top_active_users.map((u: any) => u.login_count))) * 100)}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No activity data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Популярные страницы */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Most Popular Pages (Last 30 Days)</h2>
            </div>
            <div className="p-6">
              {systemStats.popular_pages && systemStats.popular_pages.length > 0 ? (
                <div className="space-y-3">
                  {systemStats.popular_pages.map((page: any) => {
                    const maxVisits = Math.max(...systemStats.popular_pages.map((p: any) => p.visit_count));
                    const percentage = (page.visit_count / maxVisits) * 100;
                    
                    return (
                      <div key={page.page_key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{page.page_key}</span>
                          <span className="text-sm text-gray-500">{page.visit_count} visits</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No page visit data available
                </div>
              )}
            </div>
          </div>

          {/* Детальная таблица всех пользователей */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">All Users Activity</h2>
              <p className="text-xs text-gray-500 mt-1">Detailed login statistics for all users</p>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Logins</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => {
                    const lastLogin = user.last_login 
                      ? new Date(user.last_login).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Never';
                    
                    // Проверяем был ли пользователь активен сегодня
                    const isActiveToday = user.last_login && 
                      new Date(user.last_login).toDateString() === new Date().toDateString();
                    
                    return (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.full_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {user.is_admin ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                              Admin
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">User</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {isActiveToday && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                            )}
                            <span className="text-sm text-gray-500">{lastLogin}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          -
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно смены пароля */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  Changing password for: <span className="font-semibold text-gray-800">{selectedUser.username}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{selectedUser.full_name}</p>
              </div>

              {/* Ошибка */}
              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-800 text-sm">{passwordError}</span>
                  </div>
                </div>
              )}

              {/* Поле нового пароля */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter new password"
                  autoFocus
                />
              </div>

              {/* Поле подтверждения пароля */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm new password"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleChangePassword();
                    }
                  }}
                />
              </div>

              {/* Кнопки */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={loading || !newPassword || !confirmPassword}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-red-600">Confirm Delete</h2>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-red-900 mb-1">Danger Zone!</h3>
                    <p className="text-sm text-red-800">
                      Are you sure you want to delete this user? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">User to delete:</p>
                <p className="text-base font-bold text-gray-900">{userToDelete.username}</p>
                <p className="text-sm text-gray-600">{userToDelete.full_name}</p>
                {userToDelete.is_admin && (
                  <p className="text-xs text-purple-600 mt-1">⚠ This user is an Administrator</p>
                )}
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>This will also delete:</p>
                <ul className="list-disc list-inside pl-2">
                  <li>All user permissions</li>
                  <li>All activity logs</li>
                  <li>User reports (if any)</li>
                </ul>
              </div>

              {/* Кнопки */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setUserToDelete(null);
                  }}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete User</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

