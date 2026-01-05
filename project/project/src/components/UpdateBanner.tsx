import React, { useEffect, useState } from 'react';
import { skipWaiting } from '../services/swRegister';

const UpdateBanner: React.FC = () => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onUpdate = (e: any) => {
      setRegistration(e.detail?.registration || null);
      setVisible(true);
    };

    window.addEventListener('swUpdated', onUpdate as EventListener);
    window.addEventListener('swControllerChange', () => {
      // when the new controller takes over, reload to ensure the new content is used
      window.location.reload();
    });

    return () => {
      window.removeEventListener('swUpdated', onUpdate as EventListener);
    };
  }, []);

  if (!visible) return null;

  const handleRefresh = () => {
    // Ask SW to skipWaiting and activate
    skipWaiting(registration);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 right-6 bg-amber-600 text-white px-4 py-3 rounded shadow-lg z-50">
      <div className="flex items-center space-x-3">
        <div className="font-semibold">New version available</div>
        <button onClick={handleRefresh} className="ml-2 bg-white text-amber-600 px-3 py-1 rounded font-medium">Refresh</button>
      </div>
    </div>
  );
};

export default UpdateBanner;
