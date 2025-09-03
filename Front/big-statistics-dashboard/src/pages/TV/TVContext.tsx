import React, { createContext, useContext } from 'react';

interface TVContextType {
  fetchTVData: (date: Date | null) => Promise<void>;
  setHoveredWorkShop: (workShop: { workShop: string; workCenter: string } | null) => void;
  workShopRows: any[];
  selectedDate: Date | null;
  tvData: any;
}

const TVContext = createContext<TVContextType | undefined>(undefined);

export const useTVContext = () => {
  const context = useContext(TVContext);
  if (context === undefined) {
    throw new Error('useTVContext must be used within a TVProvider');
  }
  return context;
};

interface TVProviderProps {
  value: TVContextType;
  children: React.ReactNode;
}

export const TVProvider: React.FC<TVProviderProps> = ({ value, children }) => {
  return (
    <TVContext.Provider value={value}>
      {children}
    </TVContext.Provider>
  );
};
