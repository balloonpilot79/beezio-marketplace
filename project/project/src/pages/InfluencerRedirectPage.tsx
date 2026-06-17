import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const InfluencerRedirectPage: React.FC = () => {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    const trimmed = String(code || '').trim();
    if (!trimmed) {
      navigate('/signup', { replace: true });
      return;
    }

    navigate(`/signup?recruit=${encodeURIComponent(trimmed)}`, { replace: true });
  }, [code, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
        <div className="text-lg font-semibold text-gray-900">Redirecting…</div>
        <div className="mt-2 text-sm text-gray-600">Taking you to signup.</div>
      </div>
    </div>
  );
};

export default InfluencerRedirectPage;
