import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import * as DOCX from "docx";
import mammoth from "mammoth";

export interface DocumentEditorHandle {
  undo: () => void;
  redo: () => void;
  getContent: () => string;
  getHtmlContent: () => string;
  getDocxBuffer: () => Promise<Uint8Array>;
  loadDocx: (buffer: Uint8Array) => Promise<void>;
}

interface DocumentEditorProps {
  content?: any;
  onChange: (content: any) => void;
  fileName?: string;
}

export default forwardRef<DocumentEditorHandle, DocumentEditorProps>(function DocumentEditor(
  { content, onChange, fileName },
  ref
) {
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState("微软雅黑");
  const editorRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  // 初始化编辑器内容
  const initEditor = () => {
    if (!editorRef.current) return;
    // 确保编辑器是空的或只有占位符
    const currentHtml = editorRef.current.innerHTML || "";
    if (!currentHtml || currentHtml === "<br>" || currentHtml === "&nbsp;" || currentHtml === "<p><br></p>") {
      editorRef.current.innerHTML = "";
    }
    // 自动聚焦到编辑器
    editorRef.current.focus();
  };

  // 监听编辑器挂载和内容变化
  useEffect(() => {
    // 延迟初始化以确保DOM已挂载
    const timer = setTimeout(() => {
      initEditor();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 监听外部内容变化（如新建文件）
    if (content === undefined) {
      // 清空编辑器
      setHtmlContent("");
      historyRef.current = [""];
      historyIndexRef.current = 0;
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
          editorRef.current.focus();
        }
      }, 50);
    }
  }, [content]);

  const loadDocxFromBuffer = async (buffer: Uint8Array) => {
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer.buffer as ArrayBuffer });
      setHtmlContent(result.value);
      // 延迟更新DOM以确保编辑器已挂载
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = result.value;
        }
      }, 50);
      historyRef.current = [result.value];
      historyIndexRef.current = 0;
    } catch (err) {
      console.error("[DocumentEditor] mammoth parse failed:", err);
      const text = new TextDecoder().decode(buffer);
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      setHtmlContent(escaped);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = escaped;
        }
      }, 50);
      historyRef.current = [escaped];
      historyIndexRef.current = 0;
    }
  };

  useEffect(() => {
    if (content) {
      if (content instanceof Uint8Array) {
        loadDocxFromBuffer(content);
      } else if (typeof content === "string") {
        const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
        setHtmlContent(escaped);
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = escaped;
          }
        }, 50);
        historyRef.current = [escaped];
        historyIndexRef.current = 0;
      }
    }
  }, [content]);

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        const prev = historyRef.current[historyIndexRef.current];
        setHtmlContent(prev);
        if (editorRef.current) editorRef.current.innerHTML = prev;
      }
    },
    redo: () => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        const next = historyRef.current[historyIndexRef.current];
        setHtmlContent(next);
        if (editorRef.current) editorRef.current.innerHTML = next;
      }
    },
    getContent: () => editorRef.current?.innerText || "",
    getHtmlContent: () => editorRef.current?.innerHTML || "",
    getDocxBuffer: async () => generateDocx(),
    loadDocx: async (buffer: Uint8Array) => loadDocxFromBuffer(buffer),
  }));

  const pushHistory = (html: string) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(html);
    historyIndexRef.current = historyRef.current.length - 1;
    if (historyRef.current.length > 100) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML || "";
    const text = editorRef.current.innerText || "";
    setHtmlContent(html);
    pushHistory(html);
    // 通知父组件内容已修改
    onChange(text);
  };

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleFontSize = (size: number) => {
    setFontSize(size);
    execFormat("fontSize", "7");
    if (editorRef.current) {
      const fonts = editorRef.current.querySelectorAll('font[size="7"]');
      fonts.forEach((font) => {
        const span = document.createElement("span");
        span.style.fontSize = `${size}px`;
        span.innerHTML = font.innerHTML;
        font.parentNode?.replaceChild(span, font);
      });
    }
  };

  const generateDocx = async (): Promise<Uint8Array> => {
    // 确保获取最新内容
    const html = editorRef.current?.innerHTML || "";
    const plainText = editorRef.current?.innerText || "";
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const paragraphs: DOCX.Paragraph[] = [];
    const blockTags = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br"]);

    const getParagraphs = (container: HTMLElement): { text: string; align: string; isEmpty: boolean }[] => {
      const result: { text: string; align: string; isEmpty: boolean }[] = [];
      let currentParagraph = { text: "", align: "", isEmpty: true };
      
      const walkNodes = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          currentParagraph.text += text;
          if (text.trim()) currentParagraph.isEmpty = false;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          
          if (tag === "br") {
            // 换行符结束当前段落
            if (currentParagraph.text || !currentParagraph.isEmpty) {
              result.push({ ...currentParagraph });
              currentParagraph = { text: "", align: el.style.textAlign || "", isEmpty: true };
            } else {
              result.push({ text: "", align: "", isEmpty: true });
            }
          } else if (blockTags.has(tag)) {
            // 块级元素结束当前段落，开始新段落
            if (currentParagraph.text || !currentParagraph.isEmpty) {
              result.push({ ...currentParagraph });
            }
            const align = (el.style.textAlign as "left" | "center" | "right") || "";
            const text = el.innerText || "";
            result.push({ text, align, isEmpty: !text.trim() });
            currentParagraph = { text: "", align: "", isEmpty: true };
          } else {
            // 内联元素继续当前段落
            el.childNodes.forEach(walkNodes);
          }
        }
      };
      
      container.childNodes.forEach(walkNodes);
      
      // 添加最后一个段落
      if (currentParagraph.text || !currentParagraph.isEmpty) {
        result.push(currentParagraph);
      }
      
      return result.filter((p) => !p.isEmpty || result.every(r => r.isEmpty));
    };

    const blocks = getParagraphs(tempDiv);
    
    // 确保至少有一个段落
    if (blocks.length === 0 || (!blocks[0].text && blocks.every(b => !b.text))) {
      // 空文档，添加一个空段落
      paragraphs.push(new DOCX.Paragraph({ children: [new DOCX.TextRun({ text: "", font: fontFamily, size: fontSize * 2 })] }));
    } else {
      blocks.forEach((block) => {
        paragraphs.push(
          new DOCX.Paragraph({
            alignment:
              block.align === "center"
                ? DOCX.AlignmentType.CENTER
                : block.align === "right"
                ? DOCX.AlignmentType.RIGHT
                : DOCX.AlignmentType.LEFT,
            children: [
              new DOCX.TextRun({
                text: block.text || "",
                font: fontFamily,
                size: fontSize * 2,
              }),
            ],
          })
        );
      });
    }

    const doc = new DOCX.Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
            },
          },
          children: paragraphs,
        },
      ],
    });

    const blob = await DOCX.Packer.toBlob(doc);
    return new Uint8Array(await blob.arrayBuffer());
  };

  return (
    <div className="document-editor">
      <div className="format-toolbar">
        <div className="format-group">
          <select className="format-select" value={fontFamily} onChange={(e) => { setFontFamily(e.target.value); execFormat("fontName", e.target.value); }}>
            <option value="微软雅黑">微软雅黑</option>
            <option value="宋体">宋体</option>
            <option value="黑体">黑体</option>
            <option value="楷体">楷体</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          <select className="format-select" value={fontSize} onChange={(e) => handleFontSize(Number(e.target.value))}>
            {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((size) => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </div>
        <div className="format-group">
          <button className="format-btn" onClick={() => execFormat("bold")} title="粗体 (Ctrl+B)"><strong>B</strong></button>
          <button className="format-btn" onClick={() => execFormat("italic")} title="斜体 (Ctrl+I)"><em>I</em></button>
          <button className="format-btn" onClick={() => execFormat("underline")} title="下划线 (Ctrl+U)"><u>U</u></button>
          <button className="format-btn" onClick={() => execFormat("strikeThrough")} title="删除线"><s>S</s></button>
        </div>
        <div className="format-group">
          <button className="format-btn" onClick={() => execFormat("justifyLeft")} title="左对齐">&#9776;</button>
          <button className="format-btn" onClick={() => execFormat("justifyCenter")} title="居中">&#9784;</button>
          <button className="format-btn" onClick={() => execFormat("justifyRight")} title="右对齐">&#9777;</button>
          <button className="format-btn" onClick={() => execFormat("justifyFull")} title="两端对齐">&#9632;</button>
        </div>
        <div className="format-group">
          <button className="format-btn" onClick={() => execFormat("insertUnorderedList")} title="项目符号">•</button>
          <button className="format-btn" onClick={() => execFormat("insertOrderedList")} title="编号">1.</button>
        </div>
        <div className="format-group">
          <button className="format-btn" onClick={() => execFormat("removeFormat")} title="清除格式">Format</button>
        </div>
      </div>
      <div className="editor-content">
        <div
          ref={editorRef}
          className="editor-textarea"
          contentEditable
          style={{ fontSize: `${fontSize}px`, fontFamily }}
          onInput={handleInput}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          data-placeholder="在此输入文档内容..."
        />
      </div>
    </div>
  );
});
