import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Download, Copy, X } from 'lucide-react';

interface QRCodeShareProps {
  url: string;
  title?: string;
  onClose?: () => void;
}

const QRCodeShare: React.FC<QRCodeShareProps> = ({
  url,
  title = "Share Link",
  onClose
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    generateQRCode();
  }, [url]);

  const generateQRCode = async () => {
    try {
      setLoading(true);

      // Using a free QR code API (you might want to use a paid service for production)
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&format=png`;

      // For better quality, we'll create the QR code using a library approach
      // Since we don't have qrcode library installed, we'll use the API for now
      setQrCodeUrl(qrApiUrl);

      // Alternative: Generate QR code using canvas (basic implementation)
      // generateQRCodeCanvas();

    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCodeCanvas = () => {
    // Basic QR code generation using canvas (simplified)
    // In production, you'd want to use a proper QR code library
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Simple QR code pattern (this is just a placeholder)
    // In reality, you'd use a proper QR code algorithm
    const size = 200;
    const cellSize = size / 21; // QR codes are typically 21x21 modules

    ctx.fillStyle = '#000000';

    // Draw a simple pattern (not a real QR code)
    for (let i = 0; i < 21; i++) {
      for (let j = 0; j < 21; j++) {
        if ((i + j) % 2 === 0 && Math.random() > 0.3) {
          ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
        }
      }
    }

    // Add finder patterns (corners)
    ctx.fillRect(0, 0, cellSize * 7, cellSize * 7);
    ctx.fillRect(size - cellSize * 7, 0, cellSize * 7, cellSize * 7);
    ctx.fillRect(0, size - cellSize * 7, cellSize * 7, cellSize * 7);

    // Clear centers of finder patterns
    ctx.clearRect(cellSize * 2, cellSize * 2, cellSize * 3, cellSize * 3);
    ctx.clearRect(size - cellSize * 5, cellSize * 2, cellSize * 3, cellSize * 3);
    ctx.clearRect(cellSize * 2, size - cellSize * 5, cellSize * 3, cellSize * 3);
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qr-code-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center space-x-3">
          <QrCode className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">QR Code</h2>
            <p className="text-sm text-gray-600">{title}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* QR Code Display */}
      <div className="p-6">
        <div className="flex justify-center mb-6">
          {loading ? (
            <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="QR Code"
              className="w-48 h-48 rounded-lg shadow-sm"
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={200}
              height={200}
              className="w-48 h-48 border border-gray-200 rounded-lg"
            />
          )}
        </div>

        {/* URL Display */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Share URL
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={url}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
            />
            <button
              onClick={copyUrl}
              className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center space-x-1 ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {copied ? (
                <>
                  <Copy className="w-4 h-4 text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={downloadQRCode}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download QR</span>
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Pro tip:</strong> Print this QR code or share it digitally. Anyone who scans it will be directed to your affiliate link!
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeShare;