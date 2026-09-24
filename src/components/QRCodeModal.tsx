import React, { useEffect, useState } from 'react';
import { QrCode, Copy, Check, X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { generateQRCodeDataUrl } from '../utils/qr';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  sessionTitle: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
  sessionTitle,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Compute join URL
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?role=participant&code=${sessionCode}`
    : '';

  useEffect(() => {
    if (joinUrl) {
      generateQRCodeDataUrl(joinUrl).then(setQrDataUrl);
    }
  }, [joinUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      id="qr-modal-overlay"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto ${
        isFullScreen ? 'p-0' : 'p-4'
      }`}
    >
      <div
        id="qr-modal-card"
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 transition-all w-full ${
          isFullScreen
            ? 'h-screen w-screen rounded-none flex flex-col justify-between p-8'
            : 'max-w-md p-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Join Live Session</h3>
              <p className="text-xs text-slate-500">Scan to participate anonymously</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              id="qr-modal-fullscreen-toggle"
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Exit Full Screen' : 'Presenter View (Full Screen)'}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              id="qr-modal-close"
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`flex flex-col items-center justify-center my-auto py-4 ${isFullScreen ? 'scale-110' : ''}`}>
          <div className="text-center mb-4">
            <h4 className="text-sm font-medium text-slate-600 mb-1">{sessionTitle}</h4>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono font-semibold text-slate-800">
              <span>Code:</span>
              <span className="text-blue-600 tracking-wider">{sessionCode}</span>
            </div>
          </div>

          {/* QR Container */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${joinUrl}`}
                className={`${isFullScreen ? 'w-80 h-80' : 'w-56 h-56'} rounded-lg`}
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
                Generating QR code...
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center max-w-xs">
            Open camera on any smartphone or tablet to scan and join instantly. No app installation or sign-up needed.
          </p>
        </div>

        {/* Link sharing */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 border border-slate-200 text-xs">
            <span className="text-slate-500 truncate flex-1 font-mono">{joinUrl}</span>
            <button
              id="qr-modal-copy-btn"
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 shadow-xs transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 px-1">
            <span>🔒 Anonymous participant connection</span>
            <a
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 inline-flex items-center gap-1 transition-colors"
            >
              Open in new tab <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
