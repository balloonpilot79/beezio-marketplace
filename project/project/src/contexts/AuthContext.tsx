// Compatibility shim: re-export the multi-role auth provider/hooks
// to keep older imports working while standardizing on AuthContextMultiRole.
export { AuthProvider, useAuth } from './AuthContextMultiRole';