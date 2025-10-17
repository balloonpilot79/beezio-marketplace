import React, { useState, useEffect } from 'react';
import { 
  Flag, 
  AlertTriangle, 
  ShieldAlert, 
  UserX, 
  CheckCircle, 
  XCircle,
  Ban,
  FileText,
  Search
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface ReportedContent {
  id: string;
  content_type: string;
  content_id: string;
  reason: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  reporter_id: string;
}

interface Dispute {
  id: string;
  order_id: string;
  dispute_type: string;
  description: string;
  status: string;
  filed_by: string;
  filed_against: string;
  created_at: string;
}

interface UserModeration {
  id: string;
  user_id: string;
  action_type: string;
  reason: string;
  duration_days: number;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

interface SellerVerification {
  id: string;
  seller_id: string;
  verification_status: string;
  business_name: string;
  business_type: string;
  identity_verified: boolean;
  business_verified: boolean;
  created_at: string;
}

interface ModerationStats {
  pending_reports: number;
  active_disputes: number;
  pending_verifications: number;
  active_bans: number;
}

const ContentModerationDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'reports' | 'disputes' | 'users' | 'verification'>('reports');
  const [reports, setReports] = useState<ReportedContent[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [moderations, setModerations] = useState<UserModeration[]>([]);
  const [verifications, setVerifications] = useState<SellerVerification[]>([]);
  const [stats, setStats] = useState<ModerationStats>({
    pending_reports: 0,
    active_disputes: 0,
    pending_verifications: 0,
    active_bans: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user is admin
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchModerationData();
    }
  }, [isAdmin, activeTab, filterStatus]);

  const fetchModerationData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsData = await fetchStats();
      setStats(statsData);

      // Fetch data based on active tab
      if (activeTab === 'reports') {
        await fetchReports();
      } else if (activeTab === 'disputes') {
        await fetchDisputes();
      } else if (activeTab === 'users') {
        await fetchModerations();
      } else if (activeTab === 'verification') {
        await fetchVerifications();
      }
    } catch (error) {
      console.error('Error fetching moderation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (): Promise<ModerationStats> => {
    const [reports, disputes, verifications, bans] = await Promise.all([
      supabase.from('reported_content').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('disputes').select('id', { count: 'exact' }).eq('status', 'open'),
      supabase.from('seller_verification').select('id', { count: 'exact' }).eq('verification_status', 'pending'),
      supabase.from('user_moderation').select('id', { count: 'exact' }).eq('is_active', true).eq('action_type', 'ban')
    ]);

    return {
      pending_reports: reports.count || 0,
      active_disputes: disputes.count || 0,
      pending_verifications: verifications.count || 0,
      active_bans: bans.count || 0
    };
  };

  const fetchReports = async () => {
    let query = supabase
      .from('reported_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query.limit(50);
    if (!error && data) {
      setReports(data);
    }
  };

  const fetchDisputes = async () => {
    let query = supabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query.limit(50);
    if (!error && data) {
      setDisputes(data);
    }
  };

  const fetchModerations = async () => {
    const { data, error } = await supabase
      .from('user_moderation')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setModerations(data);
    }
  };

  const fetchVerifications = async () => {
    let query = supabase
      .from('seller_verification')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('verification_status', filterStatus);
    }

    const { data, error } = await query.limit(50);
    if (!error && data) {
      setVerifications(data);
    }
  };

  const handleReportAction = async (reportId: string, action: 'resolve' | 'dismiss', notes?: string) => {
    const { error } = await supabase
      .from('reported_content')
      .update({
        status: action === 'resolve' ? 'resolved' : 'dismissed',
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id
      })
      .eq('id', reportId);

    if (!error) {
      // Log the action
      await supabase.from('moderation_log').insert({
        action_type: `report_${action}`,
        target_type: 'report',
        target_id: reportId,
        moderator_id: user?.id,
        reason: notes
      });

      fetchReports();
    }
  };

  const handleDisputeResolution = async (
    disputeId: string, 
    resolution_type: string, 
    resolution: string,
    refund_amount?: number
  ) => {
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolution_type,
        resolution,
        refund_amount,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id
      })
      .eq('id', disputeId);

    if (!error) {
      await supabase.from('moderation_log').insert({
        action_type: 'dispute_resolved',
        target_type: 'dispute',
        target_id: disputeId,
        moderator_id: user?.id,
        action_details: { resolution_type, refund_amount },
        reason: resolution
      });

      fetchDisputes();
    }
  };

  const handleVerificationAction = async (
    verificationId: string,
    sellerId: string,
    action: 'approve' | 'reject',
    notes?: string
  ) => {
    const { error } = await supabase
      .from('seller_verification')
      .update({
        verification_status: action === 'approve' ? 'approved' : 'rejected',
        verified_at: action === 'approve' ? new Date().toISOString() : null,
        verified_by: action === 'approve' ? user?.id : null,
        rejection_reason: action === 'reject' ? notes : null,
        verification_notes: notes
      })
      .eq('id', verificationId);

    if (!error) {
      await supabase.from('moderation_log').insert({
        action_type: `seller_verification_${action}`,
        target_type: 'seller',
        target_id: sellerId,
        moderator_id: user?.id,
        reason: notes
      });

      fetchVerifications();
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'open': return 'bg-yellow-100 text-yellow-800';
      case 'under_review':
      case 'investigating': return 'bg-blue-100 text-blue-800';
      case 'resolved':
      case 'approved': return 'bg-green-100 text-green-800';
      case 'dismissed':
      case 'rejected': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
              <p className="text-gray-600 mt-1">Manage reports, disputes, and user safety</p>
            </div>
            <ShieldAlert className="w-12 h-12 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Reports</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pending_reports}</p>
              </div>
              <Flag className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Disputes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.active_disputes}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Verifications</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pending_verifications}</p>
              </div>
              <FileText className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Bans</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.active_bans}</p>
              </div>
              <Ban className="w-12 h-12 text-red-500" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b">
            <nav className="flex gap-8 px-6">
              {[
                { id: 'reports', label: 'Reported Content', icon: Flag },
                { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
                { id: 'users', label: 'User Moderation', icon: UserX },
                { id: 'verification', label: 'Seller Verification', icon: CheckCircle }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 border-b-2 font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Filters */}
          <div className="p-6 border-b bg-gray-50">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading...</p>
              </div>
            ) : (
              <>
                {/* Reports Tab */}
                {activeTab === 'reports' && (
                  <div className="space-y-4">
                    {reports.length === 0 ? (
                      <div className="text-center py-12">
                        <Flag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No reports found</p>
                      </div>
                    ) : (
                      reports.map(report => (
                        <div key={report.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                                  {report.priority}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                                  {report.status}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {report.content_type}
                                </span>
                              </div>
                              <h4 className="font-semibold text-gray-900 mb-1">
                                Reason: {report.reason.replace(/_/g, ' ')}
                              </h4>
                              <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                              <p className="text-xs text-gray-500">
                                Reported: {new Date(report.created_at).toLocaleString()}
                              </p>
                            </div>
                            {report.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReportAction(report.id, 'resolve', 'Content removed')}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                >
                                  <CheckCircle className="w-4 h-4 inline mr-1" />
                                  Resolve
                                </button>
                                <button
                                  onClick={() => handleReportAction(report.id, 'dismiss', 'No violation found')}
                                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                                >
                                  <XCircle className="w-4 h-4 inline mr-1" />
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Disputes Tab */}
                {activeTab === 'disputes' && (
                  <div className="space-y-4">
                    {disputes.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No disputes found</p>
                      </div>
                    ) : (
                      disputes.map(dispute => (
                        <div key={dispute.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dispute.status)}`}>
                                  {dispute.status}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {dispute.dispute_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <h4 className="font-semibold text-gray-900 mb-1">
                                Order: {dispute.order_id?.slice(0, 8)}...
                              </h4>
                              <p className="text-sm text-gray-600 mb-2">{dispute.description}</p>
                              <p className="text-xs text-gray-500">
                                Filed: {new Date(dispute.created_at).toLocaleString()}
                              </p>
                            </div>
                            {dispute.status === 'open' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDisputeResolution(dispute.id, 'buyer_favor', 'Refund issued to buyer')}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                  Buyer Favor
                                </button>
                                <button
                                  onClick={() => handleDisputeResolution(dispute.id, 'seller_favor', 'Seller was correct')}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                                >
                                  Seller Favor
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* User Moderation Tab */}
                {activeTab === 'users' && (
                  <div className="space-y-4">
                    {moderations.length === 0 ? (
                      <div className="text-center py-12">
                        <UserX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No moderation actions found</p>
                      </div>
                    ) : (
                      moderations.map(mod => (
                        <div key={mod.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  mod.action_type === 'ban' ? 'bg-red-100 text-red-800' :
                                  mod.action_type === 'suspension' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {mod.action_type}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  mod.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {mod.is_active ? 'Active' : 'Expired'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-900 mb-1">Reason: {mod.reason}</p>
                              <p className="text-xs text-gray-500">
                                Applied: {new Date(mod.created_at).toLocaleString()}
                                {mod.expires_at && ` • Expires: ${new Date(mod.expires_at).toLocaleString()}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Seller Verification Tab */}
                {activeTab === 'verification' && (
                  <div className="space-y-4">
                    {verifications.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No verification requests found</p>
                      </div>
                    ) : (
                      verifications.map(verification => (
                        <div key={verification.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(verification.verification_status)}`}>
                                  {verification.verification_status}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {verification.business_type || 'Individual'}
                                </span>
                              </div>
                              <h4 className="font-semibold text-gray-900 mb-1">
                                {verification.business_name || 'Unnamed Business'}
                              </h4>
                              <div className="flex gap-4 text-sm text-gray-600 mb-2">
                                <span>Identity: {verification.identity_verified ? '✅' : '❌'}</span>
                                <span>Business: {verification.business_verified ? '✅' : '❌'}</span>
                              </div>
                              <p className="text-xs text-gray-500">
                                Submitted: {new Date(verification.created_at).toLocaleString()}
                              </p>
                            </div>
                            {verification.verification_status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleVerificationAction(verification.id, verification.seller_id, 'approve', 'All documents verified')}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                >
                                  <CheckCircle className="w-4 h-4 inline mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleVerificationAction(verification.id, verification.seller_id, 'reject', 'Insufficient documentation')}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                >
                                  <XCircle className="w-4 h-4 inline mr-1" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentModerationDashboard;
