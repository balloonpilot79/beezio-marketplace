import { Navigate, useParams } from 'react-router-dom';
import { withRecruitCode } from '../utils/referralSharing';

export default function InfluencerRedirectPage() {
  const { code } = useParams<{ code: string }>();
  return <Navigate to={withRecruitCode('/join', code)} replace />;
}
