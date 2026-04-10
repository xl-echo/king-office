import { useState, useRef, useEffect } from "react";

interface DocumentEditorProps {
  content?: any;
  onChange: (content: string) => void;
}

export default function DocumentEditor({ content, onChange }: DocumentEditorProps) {
  const [text, setText] = useState<string>("");
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState("微软雅黑");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [align, setAlign] = useState<"left" | "center" | "right">("left");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (content) {
      const contentStr = typeof content === "string" ? content : new TextDecoder().decode(content);
      setText(contentStr);
    }
  }, [content]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onChange(newText);
  };

  const handleBold = () => {
    setIsBold(!isBold);
  };

  const handleItalic = () => {
    setIsItalic(!isItalic);
  };

  const handleUnderline = () => {
    setIsUnderline(!isUnderline);
  };

  return (
    <div className="document-editor">
      <div className="format-toolbar">
        <div className="format-group">
          <select
            className="format-select"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            <option value="微软雅黑">微软雅黑</option>
            <option value="宋体">宋体</option>
            <option value="黑体">黑体</option>
            <option value="楷体">楷体</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          
          <select
            className="format-select"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          >
            {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(size => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </div>

        <div className="format-group">
          <button
            className={`format-btn ${isBold ? "active" : ""}`}
            onClick={handleBold}
            title="粗体 (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            className={`format-btn ${isItalic ? "active" : ""}`}
            onClick={handleItalic}
            title="斜体 (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            className={`format-btn ${isUnderline ? "active" : ""}`}
            onClick={handleUnderline}
            title="下划线 (Ctrl+U)"
          >
            <u>U</u>
          </button>
        </div>

        <div className="format-group">
          <button
            className={`format-btn ${align === "left" ? "active" : ""}`}
            onClick={() => setAlign("left")}
            title="左对齐"
          >
            ⬅
          </button>
          <button
            className={`format-btn ${align === "center" ? "active" : ""}`}
            onClick={() => setAlign("center")}
            title="居中"
          >
            ⬜
          </button>
          <button
            className={`format-btn ${align === "right" ? "active" : ""}`}
            onClick={() => setAlign("right")}
            title="右对齐"
          >
            ➡
          </button>
        </div>
      </div>

      <div className="editor-content">
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily,
            fontWeight: isBold ? "bold" : "normal",
            fontStyle: isItalic ? "italic" : "normal",
            textDecoration: isUnderline ? "underline" : "none",
            textAlign: align,
          }}
          value={text}
          onChange={handleTextChange}
          placeholder="在此输入文档内容..."
          spellCheck
        />
      </div>
    </div>
  );
}
