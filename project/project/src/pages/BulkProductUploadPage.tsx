import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface ProductRow {
  title: string;
  description: string;
  price: number;
  category: string;
  sku?: string;
  stock_quantity?: number;
  supplier_name?: string;
  supplier_product_id?: string;
  supplier_url?: string;
  is_dropshipped: boolean;
  shipping_cost?: number;
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
  image_url_4?: string;
  image_url_5?: string;
  affiliate_commission_rate: number;
}

const BulkProductUploadPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [previewData, setPreviewData] = useState<ProductRow[]>([]);

  const downloadTemplate = () => {
    const template = [
      {
        title: 'Example Product Name',
        description: 'Detailed product description here',
        price: 29.99,
        category: 'Electronics',
        sku: 'PROD-001',
        stock_quantity: 100,
        supplier_name: 'Supplier Inc',
        supplier_product_id: 'SUP-12345',
        supplier_url: 'https://supplier.com/product/12345',
        is_dropshipped: 'TRUE',
        shipping_cost: 5.99,
        image_url_1: 'https://example.com/image1.jpg',
        image_url_2: 'https://example.com/image2.jpg',
        image_url_3: '',
        image_url_4: '',
        image_url_5: '',
        affiliate_commission_rate: 20
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'beezio_product_template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      const products: ProductRow[] = jsonData.map(row => ({
        title: row.title || '',
        description: row.description || '',
        price: parseFloat(row.price) || 0,
        category: row.category || '',
        sku: row.sku || '',
        stock_quantity: parseInt(row.stock_quantity) || 0,
        supplier_name: row.supplier_name || '',
        supplier_product_id: row.supplier_product_id || '',
        supplier_url: row.supplier_url || '',
        is_dropshipped: row.is_dropshipped === 'TRUE' || row.is_dropshipped === true,
        shipping_cost: parseFloat(row.shipping_cost) || 0,
        image_url_1: row.image_url_1 || '',
        image_url_2: row.image_url_2 || '',
        image_url_3: row.image_url_3 || '',
        image_url_4: row.image_url_4 || '',
        image_url_5: row.image_url_5 || '',
        affiliate_commission_rate: parseFloat(row.affiliate_commission_rate) || 20
      }));

      setPreviewData(products);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file. Please ensure it\'s a valid Excel/CSV file.');
    }
  };

  const uploadProducts = async () => {
    if (!profile || previewData.length === 0) return;

    setUploading(true);
    setProgress(0);
    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < previewData.length; i++) {
      const product = previewData[i];
      setProgress(Math.round(((i + 1) / previewData.length) * 100));

      try {
        // Collect image URLs
        const images = [
          product.image_url_1,
          product.image_url_2,
          product.image_url_3,
          product.image_url_4,
          product.image_url_5
        ].filter(url => url && url.trim() !== '');

        // Get category ID
        const { data: categoryData } = await supabase
          .from('categories')
          .select('id')
          .ilike('name', product.category)
          .single();

        const productData = {
          seller_id: profile.id,
          title: product.title,
          description: product.description,
          price: product.price,
          category_id: categoryData?.id || null,
          sku: product.sku || null,
          stock_quantity: product.stock_quantity || 0,
          images: images,
          affiliate_commission_rate: product.affiliate_commission_rate,
          affiliate_commission_type: 'percentage',
          shipping_cost: product.shipping_cost || 0,
          is_active: true,
          sales_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Dropshipping fields
          supplier_info: product.is_dropshipped ? {
            supplier_name: product.supplier_name,
            supplier_product_id: product.supplier_product_id,
            supplier_url: product.supplier_url,
            is_dropshipped: true
          } : null
        };

        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        successCount++;
      } catch (error: any) {
        errors.push(`Row ${i + 1} (${product.title}): ${error.message}`);
      }
    }

    setResults({
      success: successCount,
      failed: errors.length,
      errors: errors
    });
    setUploading(false);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/seller/products')}
            className="text-orange-600 hover:text-orange-700 mb-4 flex items-center"
          >
            ← Back to Products
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Product Upload</h1>
          <p className="text-gray-600 mt-2">Upload hundreds of products at once using Excel or Google Sheets</p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">📋 How to Use Bulk Upload</h2>
          <ol className="space-y-2 text-sm text-blue-800">
            <li><strong>Step 1:</strong> Download the template Excel file</li>
            <li><strong>Step 2:</strong> Fill in your product data (or link Google Sheets export)</li>
            <li><strong>Step 3:</strong> Upload the completed file</li>
            <li><strong>Step 4:</strong> Review preview and confirm upload</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>💡 Tip:</strong> For dropshipped products, set <code>is_dropshipped</code> to TRUE and fill in supplier details. 
              Orders will show supplier info for fulfillment.
            </p>
          </div>
        </div>

        {/* Download Template */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Download Template</h3>
                <p className="text-sm text-gray-600">Get the Excel template with all required columns</p>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Download Template</span>
            </button>
          </div>
        </div>

        {/* Upload File */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Product File</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              Upload your Excel (.xlsx, .xls) or CSV file
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors cursor-pointer inline-block"
            >
              Choose File
            </label>
          </div>
        </div>

        {/* Preview */}
        {previewData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Preview: {previewData.length} products found
              </h3>
              <button
                onClick={uploadProducts}
                disabled={uploading}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 flex items-center space-x-2"
              >
                <Package className="w-5 h-5" />
                <span>{uploading ? `Uploading ${progress}%...` : 'Upload All Products'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Price</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">SKU</th>
                    <th className="px-4 py-2 text-left">Dropship</th>
                    <th className="px-4 py-2 text-left">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewData.slice(0, 10).map((product, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{product.title}</td>
                      <td className="px-4 py-2">${product.price.toFixed(2)}</td>
                      <td className="px-4 py-2">{product.category}</td>
                      <td className="px-4 py-2">{product.sku || '-'}</td>
                      <td className="px-4 py-2">
                        {product.is_dropshipped ? (
                          <span className="text-green-600">✓ Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2">{product.supplier_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  ...and {previewData.length - 10} more products
                </p>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center space-x-3 mb-4">
              {results.failed === 0 ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upload Complete</h3>
                <p className="text-sm text-gray-600">
                  {results.success} products uploaded successfully
                  {results.failed > 0 && `, ${results.failed} failed`}
                </p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-red-900 mb-2">Errors:</h4>
                <ul className="space-y-1 text-sm text-red-700">
                  {results.errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => navigate('/seller/products')}
              className="mt-6 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
            >
              View All Products
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkProductUploadPage;
