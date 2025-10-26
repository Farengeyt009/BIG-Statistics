import React, { createContext, useContext } from 'react';

interface ProductionContextType {
  fetchProductionData: (date: Date | null, silent?: boolean) => Promise<void>;
  setHoveredWorkShop: (data: { workShop: string; workCenter: string } | null) => void;
  workShopRows: any[];
  selectedDate: Date | null;
  productionData: any;
  pinnedWorkShop: {workShop: string, workCenter: string} | null;
  setPinnedWorkShop: (data: { workShop: string; workCenter: string } | null) => void;
}

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

export const useProductionContext = () => {
  const context = useContext(ProductionContext);
  if (!context) {
    throw new Error('useProductionContext must be used within ProductionProvider');
  }
  return context;
};

export const ProductionProvider: React.FC<{
  children: React.ReactNode;
  value: ProductionContextType;
}> = ({ children, value }) => {
  return (
    <ProductionContext.Provider value={value}>
      {children}
    </ProductionContext.Provider>
  );
}; 