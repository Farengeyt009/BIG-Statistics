import React from 'react';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export const Avatar: React.FC<AvatarProps> = ({ name, imageUrl, size = 'md', className = '' }) => {
  const [imageError, setImageError] = React.useState(false);
  const safeName = name || 'User';
  const initials = safeName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    'from-blue-500 to-purple-500',
    'from-green-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
  ];
  
  const colorIndex = safeName.charCodeAt(0) % colors.length;
  const gradientClass = colors[colorIndex];

  // Если есть URL и нет ошибки загрузки, показываем картинку
  if (imageUrl && !imageError) {
    return (
      <img
        src={imageUrl}
        alt={safeName}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  // Иначе показываем инициалы
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-medium ${className}`}
    >
      {initials}
    </div>
  );
};

interface AvatarGroupProps {
  users: Array<{ name: string; imageUrl?: string }>;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({ users, max = 3, size = 'sm' }) => {
  const displayUsers = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center -space-x-2">
      {displayUsers.map((user, index) => (
        <div
          key={index}
          className="ring-2 ring-white rounded-full"
          title={user.name}
        >
          <Avatar name={user.name} imageUrl={user.imageUrl} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-xs ring-2 ring-white`}>
          +{remaining}
        </div>
      )}
    </div>
  );
};

