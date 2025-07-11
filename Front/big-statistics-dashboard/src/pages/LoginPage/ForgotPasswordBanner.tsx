import React from "react";

interface Props {
  message: string;
  onClose: () => void;
}

const ForgotPasswordBanner: React.FC<Props> = ({ message, onClose }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
    <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] text-center">
      <p className="mb-4">{message}</p>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={onClose}
      >
        OK
      </button>
    </div>
  </div>
);

export default ForgotPasswordBanner; 