import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import DocumentEditor from "./editors/DocumentEditor";
import SpreadsheetEditor from "./editors/SpreadsheetEditor";
import PresentationEditor from "./editors/PresentationEditor";
import PdfViewer from "./editors/PdfViewer";

interface FileTab {
  id: string;
  name: string;
  path?: string;
  type: "doc" | "xls" | "ppt" | "pdf";
  content?: any;
  modified?: boolean;
}

interface MainInterfaceProps {
  username: string;
  onLogout: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

// 菜单配置 - 带实际功能
const MENUS = [
  {
    label: "文件",
    items: [
      { label: "新建", action: "new", shortcut: "Ctrl+N" },
      { label: "打开...", action: "open", shortcut: "Ctrl+O" },
      { label: "保存", action: "save", shortcut: "Ctrl+S" },
      { label: "另存为...", action: "saveas" },
      { divider: true },
      { label: "关闭", action: "close", shortcut: "Ctrl+W" },
      { divider: true },
      { label: "退出", action: "exit" },
    ],
  },
  {
    label: "编辑",
    items: [
      { label: "撤销", action: "undo", shortcut: "Ctrl+Z" },
      { label: "重做", action: "redo", shortcut: "Ctrl+Y" },
      { divider: true },
      { label: "剪切", action: "cut", shortcut: "Ctrl+X" },
      { label: "复制", action: "copy", shortcut: "Ctrl+C" },
      { label: "粘贴", action: "paste", shortcut: "Ctrl+V" },
      { divider: true },
      { label: "全选", action: "selectall", shortcut: "Ctrl+A" },
    ],
  },
  {
    label: "插入",
    items: [
      { label: "图片...", action: "insert-image" },
      { label: "表格", action: "insert-table" },
      { label: "链接", action: "insert-link" },
      { divider: true },
      { label: "页眉", action: "insert-header" },
      { label: "页脚", action: "insert-footer" },
    ],
  },
  {
    label: "格式",
    items: [
      { label: "字体...", action: "format-font" },
      { label: "段落", action: "format-paragraph" },
      { divider: true },
      { label: "粗体", action: "bold", shortcut: "Ctrl+B" },
      { label: "斜体", action: "italic", shortcut: "Ctrl+I" },
      { label: "下划线", action: "underline", shortcut: "Ctrl+U" },
      { divider: true },
      { label: "项目符号", action: "bullet" },
      { label: "编号", action: "numbering" },
    ],
  },
  {
    label: "视图",
    items: [
      { label: "全屏", action: "fullscreen", shortcut: "F11" },
      { label: "缩放", action: "zoom" },
      { divider: true },
      { label: "工具栏", action: "toggle-toolbar", checkable: true },
      { label: "侧边栏", action: "toggle-sidebar", checkable: true },
      { label: "状态栏", action: "toggle-statusbar", checkable: true },
    ],
  },
  {
    label: "帮助",
    items: [
      { label: "使用帮助", action: "help" },
      { divider: true },
      { label: "关于", action: "about" },
    ],
  },
];

// 工具栏配置
const TOOLBAR_ITEMS: Record<string, Array<{ icon: string; label: string; action: string; bold?: boolean }>> = {
  doc: [
    { icon: "📄", label: "新建", action: "new" },
    { icon: "📂", label: "打开", action: "open" },
    { icon: "💾", label: "保存", action: "save" },
    { icon: "⬇", label: "另存", action: "saveas" },
    { icon: "|", label: "" },
    { icon: "↩", label: "撤销", action: "undo" },
    { icon: "↪", label: "重做", action: "redo" },
    { icon: "|", label: "" },
    { icon: "B", label: "粗体", action: "bold", bold: true },
    { icon: "I", label: "斜体", action: "italic" },
    { icon: "U", label: "下划线", action: "underline" },
    { icon: "|", label: "" },
    { icon: "☰", label: "左对齐", action: "align-left" },
    { icon: "≡", label: "居中", action: "align-center" },
    { icon: "☰", label: "右对齐", action: "align-right" },
  ],
  xls: [
    { icon: "📄", label: "新建", action: "new" },
    { icon: "📂", label: "打开", action: "open" },
    { icon: "💾", label: "保存", action: "save" },
    { icon: "|", label: "" },
    { icon: "↩", label: "撤销", action: "undo" },
    { icon: "↪", label: "重做", action: "redo" },
    { icon: "|", label: "" },
    { icon: "➕", label: "添加行", action: "insert-row" },
    { icon: "➖", label: "添加列", action: "insert-col" },
    { icon: "🔢", label: "求和", action: "sum" },
  ],
  ppt: [
    { icon: "📄", label: "新建", action: "new" },
    { icon: "📂", label: "打开", action: "open" },
    { icon: "💾", label: "保存", action: "save" },
    { icon: "|", label: "" },
    { icon: "➕", label: "新幻灯片", action: "add-slide" },
    { icon: "🗑️", label: "删除", action: "delete-slide" },
    { icon: "|", label: "" },
    { icon: "▶", label: "放映", action: "present" },
    { icon: "◀", label: "上一张", action: "prev-slide" },
    { icon: "▶", label: "下一张", action: "next-slide" },
  ],
  pdf: [
    { icon: "📂", label: "打开", action: "open" },
    { icon: "|", label: "" },
    { icon: "◀", label: "上一页", action: "prev-page" },
    { icon: "▶", label: "下一页", action: "next-page" },
    { icon: "|", label: "" },
    { icon: "🔍+", label: "放大", action: "zoom-in" },
    { icon: "🔍-", label: "缩小", action: "zoom-out" },
    { icon: "⛶", label: "适应", action: "fit-page" },
  ],
};

// 快速访问模板
const TEMPLATES = [
  { icon: "📝", label: "新建文档", type: "doc", name: "新建文档", ext: "docx" },
  { icon: "📊", label: "新建表格", type: "xls", name: "新建表格", ext: "xlsx" },
  { icon: "📽️", label: "新建演示", type: "ppt", name: "新建演示", ext: "pptx" },
  { icon: "📄", label: "打开PDF", type: "pdf", name: "打开PDF", ext: "pdf" },
];

// 根据文件扩展名判断文件类型
const getFileType = (filename: string): "doc" | "xls" | "ppt" | "pdf" => {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (["doc", "docx", "wps", "txt", "rtf"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv", "et"].includes(ext)) return "xls";
  if (["ppt", "pptx", "dps"].includes(ext)) return "ppt";
  if (ext === "pdf") return "pdf";
  return "doc";
};

export default function MainInterface({ username, onLogout, showToast }: MainInterfaceProps) {
  const [activeTab, setActiveTab] = useState<"doc" | "xls" | "ppt" | "pdf">("doc");
  const [openFiles, setOpenFiles] = useState<FileTab[]>([]);
  const [activeFile, setActiveFile] = useState<FileTab | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showStatusbar, setShowStatusbar] = useState(true);
  const [recentFiles, setRecentFiles] = useState<{ name: string; path: string; time: string }[]>([]);

  // 编辑器引用
  const editorRef = useRef<{ undo?: () => void; redo?: () => void; zoomIn?: () => void; zoomOut?: () => void; prevPage?: () => void; nextPage?: () => void; fitPage?: () => void; addSlide?: () => void; deleteSlide?: () => void; present?: () => void }>({});

  // 创建新文件
  const handleNewFile = useCallback(() => {
    const typeNames = { doc: "文档", xls: "表格", ppt: "演示", pdf: "PDF" };
    const newFile: FileTab = {
      id: `file-${Date.now()}`,
      name: `新建${typeNames[activeTab]}`,
      type: activeTab,
      modified: false,
    };
    setOpenFiles(prev => [...prev, newFile]);
    setActiveFile(newFile);
    showToast(`已创建新建${typeNames[activeTab]}`, "success");
  }, [activeTab, showToast]);

  // 打开文件
  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await open({ multiple: false });
      if (selected && typeof selected === "string") {
        await openFileByPath(selected);
      }
    } catch (err) {
      showToast("打开文件失败", "error");
    }
  }, [showToast]);

  // 根据路径打开文件
  const openFileByPath = async (filePath: string) => {
    try {
      // 检查是否已在标签页中
      const existing = openFiles.find(f => f.path === filePath);
      if (existing) {
        setActiveFile(existing);
        showToast("文件已在标签页中打开", "info");
        return;
      }

      const fileContent = await readFile(filePath);
      const fileName = filePath.split(/[/\\]/).pop() || "未命名";
      const fileType = getFileType(fileName);

      // 自动切换到对应类型
      setActiveTab(fileType);

      const newFile: FileTab = {
        id: `file-${Date.now()}`,
        name: fileName,
        path: filePath,
        type: fileType,
        content: fileContent,
        modified: false,
      };

      setOpenFiles(prev => [...prev, newFile]);
      setActiveFile(newFile);

      // 更新最近文件
      const newRecent = [{ name: fileName, path: filePath, time: new Date().toLocaleString() }, ...recentFiles.filter(f => f.path !== filePath)].slice(0, 10);
      setRecentFiles(newRecent);

      showToast(`已打开: ${fileName}`, "success");
    } catch (err) {
      showToast("打开文件失败: " + err, "error");
    }
  };

  // 保存文件
  const handleSaveFile = useCallback(async (forceSaveAs = false) => {
    if (!activeFile) return;

    try {
      let savePath = activeFile.path;

      if (!savePath || forceSaveAs) {
        const extMap = { doc: "docx", xls: "xlsx", ppt: "pptx", pdf: "pdf" };
        const nameMap = { doc: "Word文档", xls: "Excel表格", ppt: "PowerPoint", pdf: "PDF文件" };

        const selected = await save({
          filters: [{ name: nameMap[activeFile.type], extensions: [extMap[activeFile.type]] }],
          defaultPath: activeFile.name.endsWith(`.${extMap[activeFile.type]}`) ? undefined : `${activeFile.name}.${extMap[activeFile.type]}`,
        });

        if (!selected) return;
        savePath = selected as string;
      }

      // 根据编辑器类型序列化内容
      let contentToSave: Uint8Array;
      if (activeFile.type === "doc") {
        // 文档类型：从编辑器获取文本内容
        const editorEl = document.querySelector(".editor-textarea") as HTMLTextAreaElement;
        contentToSave = new TextEncoder().encode(editorEl?.value || "");
      } else if (activeFile.type === "xls") {
        // 表格类型：序列化为CSV格式
        const rows = activeFile.content as Cell[][];
        const csvContent = rows.map(row => 
          row.map(cell => {
            // CSV需要转义引号和换行
            let value = cell?.value || "";
            if (typeof value !== "string") value = String(value);
            if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(",")
        ).join("\n");
        contentToSave = new TextEncoder().encode(csvContent);
      } else if (activeFile.type === "ppt") {
        // 演示类型：序列化为JSON格式
        const pptContent = typeof activeFile.content === "string" 
          ? activeFile.content 
          : JSON.stringify(activeFile.content, null, 2);
        contentToSave = new TextEncoder().encode(pptContent);
      } else if (typeof activeFile.content === "string") {
        // PDF或其他字符串内容
        contentToSave = new TextEncoder().encode(activeFile.content);
      } else if (activeFile.content instanceof Uint8Array) {
        // 二进制内容（如PDF文件）
        contentToSave = activeFile.content;
      } else {
        // 其他类型尝试JSON序列化
        contentToSave = new TextEncoder().encode(JSON.stringify(activeFile.content));
      }

      await writeFile(savePath, contentToSave);

      const fileName = savePath.split(/[/\\]/).pop() || activeFile.name;
      const updatedFile = { ...activeFile, path: savePath, name: fileName, modified: false };

      setOpenFiles(prev => prev.map(f => f.id === activeFile.id ? updatedFile : f));
      setActiveFile(updatedFile);

      showToast("文件保存成功", "success");
    } catch (err) {
      showToast("保存文件失败: " + err, "error");
    }
  }, [activeFile, showToast]);

  // 关闭文件
  const handleCloseFile = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newFiles = openFiles.filter(f => f.id !== id);
    setOpenFiles(newFiles);
    if (activeFile?.id === id) {
      setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1] : null);
    }
  }, [openFiles, activeFile]);

  // 更新文件内容
  const handleFileContentChange = useCallback((content: any) => {
    if (!activeFile) return;
    const updatedFile = { ...activeFile, content, modified: true };
    setOpenFiles(prev => prev.map(f => f.id === activeFile.id ? updatedFile : f));
    setActiveFile(updatedFile);
  }, [activeFile]);

  // 处理菜单操作
  const handleMenuAction = useCallback((action: string) => {
    setActiveMenu(null);

    switch (action) {
      case "new":
        handleNewFile();
        break;
      case "open":
        handleOpenFile();
        break;
      case "save":
        handleSaveFile();
        break;
      case "saveas":
        handleSaveFile(true);
        break;
      case "close":
        if (activeFile) handleCloseFile(activeFile.id);
        break;
      case "exit":
        if (confirm("确定退出吗？")) onLogout();
        break;
      case "undo":
        editorRef.current?.undo?.();
        break;
      case "redo":
        editorRef.current?.redo?.();
        break;
      case "cut":
        document.execCommand("cut");
        break;
      case "copy":
        document.execCommand("copy");
        break;
      case "paste":
        document.execCommand("paste");
        break;
      case "selectall":
        document.execCommand("selectAll");
        break;
      case "bold":
      case "italic":
      case "underline":
      case "align-left":
      case "align-center":
      case "align-right":
        // 这些由文档编辑器处理
        break;
      case "fullscreen":
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
        break;
      case "toggle-toolbar":
        setShowToolbar(prev => !prev);
        break;
      case "toggle-sidebar":
        setShowSidebar(prev => !prev);
        break;
      case "toggle-statusbar":
        setShowStatusbar(prev => !prev);
        break;
      case "zoom-in":
        editorRef.current?.zoomIn?.();
        break;
      case "zoom-out":
        editorRef.current?.zoomOut?.();
        break;
      case "prev-page":
        editorRef.current?.prevPage?.();
        break;
      case "next-page":
        editorRef.current?.nextPage?.();
        break;
      case "fit-page":
        editorRef.current?.fitPage?.();
        break;
      case "add-slide":
        editorRef.current?.addSlide?.();
        break;
      case "delete-slide":
        editorRef.current?.deleteSlide?.();
        break;
      case "present":
        editorRef.current?.present?.();
        break;
      case "about":
        alert("King办公套件 v1.0.0\n\n轻量高效 · 简约美观 · 绿色便携\n\n© 2026 KingOffice");
        break;
      case "help":
        showToast("使用帮助: 按 Ctrl+N 新建, Ctrl+O 打开, Ctrl+S 保存", "info");
        break;
      default:
        showToast(`功能: ${action}`, "info");
    }
  }, [activeFile, handleNewFile, handleOpenFile, handleSaveFile, handleCloseFile, onLogout, showToast]);

  // 工具栏操作
  const handleToolbarAction = useCallback((action: string) => {
    handleMenuAction(action);
  }, [handleMenuAction]);

  // 模板快速创建
  const handleTemplateClick = useCallback((type: "doc" | "xls" | "ppt" | "pdf", name: string) => {
    setActiveTab(type);
    setTimeout(() => {
      handleNewFile();
    }, 50);
  }, [handleNewFile]);

  // 点击最近文件
  const handleRecentFileClick = useCallback((file: { name: string; path: string }) => {
    openFileByPath(file.path);
  }, [openFileByPath]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "n":
            e.preventDefault();
            handleNewFile();
            break;
          case "o":
            e.preventDefault();
            handleOpenFile();
            break;
          case "s":
            e.preventDefault();
            handleSaveFile(e.shiftKey);
            break;
          case "w":
            e.preventDefault();
            if (activeFile) handleCloseFile(activeFile.id);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewFile, handleOpenFile, handleSaveFile, handleCloseFile, activeFile]);

  return (
    <div className="wps-main">
      {/* ===== 顶部标题栏 ===== */}
      <header className="wps-header">
        <div className="header-left">
          <div className="app-logo">📊</div>
          <span className="app-title">King办公套件</span>
        </div>

        <div className="header-tabs">
          {openFiles.map(file => (
            <div
              key={file.id}
              className={`file-tab ${activeFile?.id === file.id ? "active" : ""}`}
              onClick={() => setActiveFile(file)}
            >
              <span className="tab-icon">
                {file.type === "doc" && "📝"}
                {file.type === "xls" && "📊"}
                {file.type === "ppt" && "📽️"}
                {file.type === "pdf" && "📄"}
              </span>
              <span className="tab-name">
                {file.modified && <span className="modified">●</span>}
                {file.name}
              </span>
              <button className="tab-close" onClick={(e) => handleCloseFile(file.id, e)}>×</button>
            </div>
          ))}
          {openFiles.length === 0 && (
            <div className="no-tab">未打开文件</div>
          )}
        </div>

        <div className="header-right">
          <span className="user-name">👤 {username}</span>
          <button className="btn-logout" onClick={onLogout}>退出</button>
        </div>
      </header>

      {/* ===== 菜单栏 ===== */}
      <nav className="wps-menu">
        {MENUS.map(menu => (
          <div
            key={menu.label}
            className={`menu-item ${activeMenu === menu.label ? "active" : ""}`}
            onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
          >
            <span>{menu.label}</span>
            {activeMenu === menu.label && (
              <div className="menu-dropdown">
                {menu.items.map((item, i) =>
                  "divider" in item && item.divider ? (
                    <div key={i} className="menu-sep" />
                  ) : (
                    <div
                      key={i}
                      className="menu-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuAction(item.action);
                      }}
                    >
                      <span>{item.label}</span>
                      {"shortcut" in item && item.shortcut && (
                        <span className="menu-shortcut">{item.shortcut}</span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
        <div className="menu-toggle" onClick={() => setShowSidebar(!showSidebar)}>
          {showSidebar ? "◀" : "▶"}
        </div>
      </nav>

      {/* ===== 工具栏 ===== */}
      {showToolbar && (
        <div className="wps-toolbar">
          {TOOLBAR_ITEMS[activeTab]?.map((item, i) =>
            item.icon === "|" ? (
              <div key={i} className="toolbar-sep" />
            ) : (
              <button
                key={i}
                className="toolbar-btn"
                onClick={() => handleToolbarAction(item.action)}
                title={item.label}
              >
                <span className={`btn-icon ${item.bold ? "strong" : ""}`}>{item.icon}</span>
                <span className="btn-label">{item.label}</span>
              </button>
            )
          )}
        </div>
      )}

      {/* ===== 主内容区 ===== */}
      <div className="wps-content">
        {showSidebar && (
          <aside className="wps-sidebar">
            <div className="sidebar-section">
              <div className="section-title">📝 快捷创建</div>
              <div className="template-grid">
                {TEMPLATES.map((t, i) => (
                  <div
                    key={i}
                    className="template-item"
                    onClick={() => handleTemplateClick(t.type as any, t.name)}
                  >
                    <span className="template-icon">{t.icon}</span>
                    <span className="template-label">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="section-title">📂 最近文件</div>
              {recentFiles.length === 0 ? (
                <div className="empty-recent">暂无最近文件</div>
              ) : (
                <div className="recent-list">
                  {recentFiles.map((f, i) => (
                    <div
                      key={i}
                      className="recent-item"
                      onClick={() => handleRecentFileClick(f)}
                      title={f.path}
                    >
                      <span className="recent-name">{f.name}</span>
                      <span className="recent-time">{f.time.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="wps-editor">
          {activeFile ? (
            <div className="editor-wrapper">
              {activeFile.type === "doc" && (
                <DocumentEditor
                  key={activeFile.id}
                  content={activeFile.content}
                  onChange={handleFileContentChange}
                />
              )}
              {activeFile.type === "xls" && (
                <SpreadsheetEditor
                  key={activeFile.id}
                  content={activeFile.content}
                  onChange={handleFileContentChange}
                />
              )}
              {activeFile.type === "ppt" && (
                <PresentationEditor
                  key={activeFile.id}
                  content={activeFile.content}
                  onChange={handleFileContentChange}
                />
              )}
              {activeFile.type === "pdf" && (
                <PdfViewer
                  key={activeFile.id}
                  file={activeFile.content}
                  path={activeFile.path}
                />
              )}
            </div>
          ) : (
            <div className="empty-workspace">
              <div className="empty-icon">📋</div>
              <h2>欢迎使用 King办公套件</h2>
              <p>选择左侧模板开始创建文档，或点击工具栏按钮</p>
              <div className="quick-actions">
                {TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    className="quick-btn"
                    onClick={() => handleTemplateClick(t.type as any, t.name)}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===== 状态栏 ===== */}
      {showStatusbar && (
        <footer className="wps-status">
          <span className="status-item">📍 {activeFile?.type === "doc" ? "文档" : activeFile?.type === "xls" ? "表格" : activeFile?.type === "ppt" ? "演示" : "PDF"}</span>
          <span className="status-item">📐 {activeTab === "doc" ? "A4" : activeTab === "xls" ? "Sheet1" : "幻灯片 1/1"}</span>
          <span className="status-item">🔤 100%</span>
          <span className="status-item">✅ UTF-8</span>
          <span className="status-item status-right">
            {activeFile?.modified ? "⚠️ 已修改" : "✓ 已保存"}
          </span>
        </footer>
      )}
    </div>
  );
}
