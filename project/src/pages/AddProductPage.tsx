import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Upload, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import ProductForm from '../components/ProductForm';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

type UploadMode = 'single' | 'bulk';

const AddProductPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<UploadMode | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const handleBulkUpload = async () => {
  if (!bulkFile || !user) return;

  const sellerProfileId = profile?.id;
  if (!sellerProfileId) {
    setUploadResults({ success: 0, failed: 0, errors: ['We could not find your seller profile. Please complete your profile and try again.'] });
    return;
  }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults(null);

    Papa.parse(bulkFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const products = results.data as any[];
        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          try {
            // Validate required fields
            if (!product.title || !product.price) {
              throw new Error(`Row ${i + 1}: Missing required fields (title, price)`);
            }

            // Prepare product data
            const productData = {
              title: product.title,
              description: product.description || '',
              price: parseFloat(product.price),
              category_id: product.category_id || null,
              category_name: product.category || 'Uncategorized',
              images: product.images ? product.images.split('|').filter(Boolean) : [],
              seller_id: sellerProfileId,
              commission_rate: parseFloat(product.commission_rate) || 20,
              commission_type: product.commission_type || 'percentage',
              stock_quantity: parseInt(product.stock_quantity) || 0,
              sku: product.sku || null,
              weight: parseFloat(product.weight) || null,
              dimensions: product.dimensions || null,
              shipping_options: product.shipping_options ? JSON.parse(product.shipping_options) : [],
              requires_shipping: product.requires_shipping === 'true' || product.requires_shipping === '1',
              is_dropshipped: product.is_dropshipped === 'true' || product.is_dropshipped === '1',
              supplier_name: product.supplier_name || null,
              supplier_product_id: product.supplier_product_id || null,
              supplier_url: product.supplier_url || null,
              status: 'active',
              is_active: true
            };

            // Insert product
            const { error } = await supabase
              .from('products')
              .insert([productData]);

            if (error) throw error;
            successCount++;
          } catch (error: any) {
            failedCount++;
            errors.push(`Row ${i + 1}: ${error.message}`);
          }

          // Update progress
          setUploadProgress(Math.round(((i + 1) / products.length) * 100));
        }

        setUploadResults({ success: successCount, failed: failedCount, errors });
        setUploading(false);
      },
      error: (error) => {
        setUploadResults({ success: 0, failed: 0, errors: [error.message] });
        setUploading(false);
      }
    });
  };

  const downloadTemplate = () => {
    const template = [
      {
        title: 'Example Product',
        description: 'This is an example product description',
        price: '29.99',
        category: 'Electronics',
        commission_rate: '20',
        commission_type: 'percentage',
        stock_quantity: '100',
        sku: 'PROD-001',
        weight: '1.5',
        dimensions: '10x8x6',
        images: 'https://example.com/image1.jpg|https://example.com/image2.jpg',
        shipping_options: '[{"name":"Standard","price":8.99,"days":"5-7"}]',
        requires_shipping: 'true',
        is_dropshipped: 'false',
        supplier_name: '',
        supplier_product_id: '',
        supplier_url: ''
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beezio-product-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (mode === 'single') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setMode(null)}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to upload options
          </button>
          <ProductForm
            onSuccess={() => navigate('/dashboard')}
            onCancel={() => setMode(null)}
          />
        </div>
      </div>
    );
  }

  if (mode === 'bulk') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setMode(null)}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to upload options
          </button>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Bulk Upload Products</h2>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">How to use bulk upload:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li>
                <li>Open it in Excel or Google Sheets</li>
                <li>Fill in your product information</li>
                <li>Save as CSV and upload here</li>
              </ol>
            </div>

            {/* Download Template */}
            <button
              onClick={downloadTemplate}
              className="mb-6 w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>Download CSV Template</span>
            </button>

            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              {bulkFile && (
                <p className="text-sm text-green-600 mt-2">
                  Selected: {bulkFile.name}
                </p>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleBulkUpload}
              disabled={!bulkFile || uploading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Upload className="w-5 h-5" />
              <span>{uploading ? 'Uploading...' : 'Upload Products'}</span>
            </button>

            {/* Progress Bar */}
            {uploading && (
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-600 mt-2">{uploadProgress}% Complete</p>
              </div>
            )}

            {/* Results */}
            {uploadResults && (
              <div className="mt-6 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-semibold">
                    ✅ Successfully uploaded: {uploadResults.success} products
                  </p>
                </div>
                {uploadResults.failed > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-semibold mb-2">
                      ❌ Failed: {uploadResults.failed} products
                    </p>
                    <div className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                      {uploadResults.errors.map((error, index) => (
                        <p key={index}>• {error}</p>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Mode selection screen
  return (
    <div className="min-h-screen bg-bzo-gradient py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <img src="/bee-mascot.png" alt="BZO Bee" className="w-12 h-12 bzo-mascot" />
          </div>
          <h1 className="text-5xl font-bold text-bzo-black mb-4">Add Products</h1>
          <p className="text-xl text-gray-600">Choose how you want to buzz your products into the hive</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Single Product */}
          <div
            onClick={() => setMode('single')}
            className="card-bzo p-8 cursor-pointer group"
          >
            <div className="bg-gradient-to-br from-bzo-yellow-primary to-bzo-yellow-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
              <Package className="w-10 h-10 text-bzo-black" />
            </div>
            <h2 className="text-2xl font-bold text-bzo-black text-center mb-4">
              Add Single Product
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Perfect for adding one product at a time with full control over all details, images, and pricing.
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Upload multiple product images
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Set detailed pricing and commissions
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Configure shipping options
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Full product customization
              </li>
            </ul>
            <button className="mt-6 w-full bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium">
              Start Adding Product
            </button>
          </div>

          {/* Bulk Upload */}
          <div
            onClick={() => setMode('bulk')}
            className="bg-white rounded-xl shadow-lg p-8 cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-2 border-transparent hover:border-blue-500"
          >
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileSpreadsheet className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
              Bulk Upload (CSV)
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Upload hundreds of products at once using CSV files from Excel or Google Sheets.
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Upload 100s of products instantly
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Use Excel or Google Sheets
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Download CSV template included
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Perfect for large catalogs
              </li>
            </ul>
            <button className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium">
              Start Bulk Upload
            </button>
          </div>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900 flex items-center justify-center mx-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductPage;
