import React from 'react';

interface MessageTicksProps {
  status?: 'sent' | 'delivered' | 'read';
  className?: string;
}

export const MessageTicks: React.FC<MessageTicksProps> = ({ status = 'delivered', className = '' }) => {
  const isRead = status === 'read';
  const isSingle = status === 'sent';

  if (isSingle) {
    return (
      <svg
        className={`w-3.5 h-3.5 inline-block text-gray-400 ${className}`}
        viewBox="0 0 16 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13.5 3.5L5.5 11.5L2 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // WhatsApp-style Crisp Double Checkmarks
  return (
    <svg
      className={`w-4 h-3.5 inline-block ${isRead ? 'text-[#38bdf8]' : 'text-gray-400'} ${className}`}
      viewBox="0 0 20 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* First check */}
      <path
        d="M13 3.5L6 11L3 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Second check (offset for crisp WhatsApp double-tick) */}
      <path
        d="M17 3.5L10 11L8.5 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
