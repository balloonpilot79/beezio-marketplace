import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { getRecruitSignupPath } from '../utils/referralSharing';

export default function InfluencerRedirectPage() {
  const { code } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  return <Navigate to={getRecruitSignupPath(code, params.get('intent'))} replace />;
}
