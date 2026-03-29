import React from 'react';
import LQCLogTable from './LQCLogTable';

interface LQCLogProps {
  data: any[];
  loading: boolean;
  error: string | null;
}

const LQCLog: React.FC<LQCLogProps> = ({ data, loading, error }) => {
  return (
    <LQCLogTable
      data={data}
      loading={loading}
      error={error}
      suppressLocalLoaders={loading}
    />
  );
};

export default LQCLog;
