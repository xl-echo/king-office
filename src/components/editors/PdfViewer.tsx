import { useState, useEffect } from "react";
import { readFile } from "@tauri-apps/plugin-fs";

interface PdfViewerProps {
  file?: any;
  path?: string;
}

export default function PdfViewer({ file, path }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    loadPdf();
  }, [file, path]);

  const loadPdf = async () => {
    setLoading(true);
    setError("");

    try {
      if (file) {
        if (typeof file === "string") {
          setPdfUrl(file);
        } else {
          const blob = new Blob([file], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl(url);
        }
      } else if (path) {
        const fileData = await readFile(path);
        const blob = new Blob([fileData], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(url);
      } else {
        setError("未提供 PDF 文件");
      }
    } catch (err) {
      setError("加载 PDF 失败: " + err);
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 25, 300));
  const handleZoomOut = () => setZoom(z => Math.max(z - 25, 50));

  if (pdfUrl && !pdfUrl.startsWith("http")) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-toolbar">
          <button className="pdf-btn" onClick={handleZoomOut} title="缩小">🔍-</button>
          <span className="pdf-zoom">{zoom}%</span>
          <button className="pdf-btn" onClick={handleZoomIn} title="放大">🔍+</button>
        </div>
        <div className="pdf-container">
          <object
            data={pdfUrl}
            type="application/pdf"
            className="pdf-object"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            <div className="pdf-fallback">
              <p>您的浏览器不支持直接显示 PDF</p>
              <p>请使用外部 PDF 阅读器打开此文件</p>
              {path && <p className="pdf-path">文件路径: {path}</p>}
            </div>
          </object>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <button className="pdf-btn" onClick={handleZoomOut} title="缩小">🔍-</button>
        <span className="pdf-zoom">{zoom}%</span>
        <button className="pdf-btn" onClick={handleZoomIn} title="放大">🔍+</button>
      </div>
      <div className="pdf-container">
        {loading && (
          <div className="pdf-loading">
            <div className="loading-spinner">⏳</div>
            <p>正在加载 PDF...</p>
          </div>
        )}
        {error && (
          <div className="pdf-error">
            <p>❌ {error}</p>
          </div>
        )}
        {!loading && !error && pdfUrl && (
          <iframe
            src={pdfUrl}
            className="pdf-iframe"
            title="PDF Viewer"
          />
        )}
        {!loading && !error && !pdfUrl && (
          <div className="pdf-empty">
            <p>📄 请打开 PDF 文件</p>
          </div>
        )}
      </div>
    </div>
  );
}
