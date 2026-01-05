import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Tax1099Report {
  id: string
  tax_year: number
  total_payments: number
  document_url: string
  status: string
  created_at: string
}

interface TaxAgreement {
  id: string
  agreement_type: string
  signed_at: string
  status: string
}

export const TaxComplianceDashboard: React.FC = () => {
  const [reports, setReports] = useState<Tax1099Report[]>([])
  const [agreements, setAgreements] = useState<TaxAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTaxData()
  }, [])

  const loadTaxData = async () => {
    try {
      setLoading(true)

      // Load 1099 reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('tax_1099_reports')
        .select('*')
        .order('tax_year', { ascending: false })

      if (reportsError) throw reportsError

      // Load tax agreements
      const { data: agreementsData, error: agreementsError } = await supabase
        .from('tax_agreements')
        .select('*')
        .order('signed_at', { ascending: false })

      if (agreementsError) throw agreementsError

      setReports(reportsData || [])
      setAgreements(agreementsData || [])
    } catch (err) {
      console.error('Error loading tax data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tax data')
    } finally {
      setLoading(false)
    }
  }

  const download1099 = (report: Tax1099Report) => {
    window.open(report.document_url, '_blank')
  }

  if (loading) {
    return <div className="p-6">Loading tax compliance information...</div>
  }

  if (error) {
    return <div className="p-6 text-red-600">Error: {error}</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Tax Compliance Dashboard</h2>

      {/* Tax Agreements Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Tax Agreements</h3>
        {agreements.length === 0 ? (
          <p className="text-gray-500">No tax agreements found. Complete Stripe onboarding to sign required agreements.</p>
        ) : (
          <div className="space-y-3">
            {agreements.map((agreement) => (
              <div key={agreement.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-medium capitalize">{agreement.agreement_type.replace('_', ' ')}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    Signed: {new Date(agreement.signed_at).toLocaleDateString()}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded text-sm ${
                  agreement.status === 'signed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {agreement.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 1099 Reports Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">1099-NEC Forms</h3>
        {reports.length === 0 ? (
          <p className="text-gray-500">No 1099 forms issued yet. Forms are automatically generated for payments over $600 annually.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">Tax Year {report.tax_year}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    Total Payments: ${report.total_payments.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    Issued: {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded text-sm ${
                    report.status === 'issued' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {report.status}
                  </span>
                  {report.document_url && (
                    <button
                      onClick={() => download1099(report)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax Information */}
      <div className="bg-blue-50 rounded-lg p-4 mt-6">
        <h4 className="font-semibold text-blue-900 mb-2">Tax Compliance Information</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 1099-NEC forms are automatically generated for payments exceeding $600 in a tax year</li>
          <li>• Forms are issued by January 31st of the following year</li>
          <li>• All tax agreements are digitally signed and stored securely</li>
          <li>• Contact support if you need assistance with tax-related questions</li>
        </ul>
      </div>
    </div>
  )
}