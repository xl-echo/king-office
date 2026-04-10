import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import DocumentEditor, { DocumentEditorHandle } from "./editors/DocumentEditor";
import SpreadsheetEditor, { SpreadsheetEditorHandle } from "./editors/SpreadsheetEditor";
import PresentationEditor, { PresentationEditorHandle } from "./editors/PresentationEditor";
import PdfViewer from "./editors/PdfViewer";

interface FileTab {
  id: string;
  name: string;
  path?: string;
  type: "doc" | "xls" | "ppt" | "pdf";
  rawContent?: Uint8Array;
  modified?: boolean;
}

interface MainInterfaceProps {
  username: string;
  onLogout: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

interface MenuItemDef {
  label?: string;
  action?: string;
  shortcut?: string;
  divider?: boolean;
}

interface ToolbarItemDef {
  icon: string;
  label: string;
  action: string;
  bold?: boolean;
}

const MENUS: { label: string; items: MenuItemDef[] }[] = [
  { label: "文件", items: [
    { label: "新建", action: "new", shortcut: "Ctrl+N" },
    { label: "打开...", action: "open", shortcut: "Ctrl+O" },
    { label: "保存", action: "save", shortcut: "Ctrl+S" },
    { label: "另存为...", action: "saveas" },
    { divider: true, label: "", action: "" },
    { label: "关闭", action: "close", shortcut: "Ctrl+W" },
    { divider: true, label: "", action: "" },
    { label: "退出", action: "exit" },
  ]},
  { label: "编辑", items: [
    { label: "撤销", action: "undo", shortcut: "Ctrl+Z" },
    { label: "重做", action: "redo", shortcut: "Ctrl+Y" },
    { divider: true, label: "", action: "" },
    { label: "剪切", action: "cut", shortcut: "Ctrl+X" },
    { label: "复制", action: "copy", shortcut: "Ctrl+C" },
    { label: "粘贴", action: "paste", shortcut: "Ctrl+V" },
    { divider: true, label: "", action: "" },
    { label: "全选", action: "selectall", shortcut: "Ctrl+A" },
  ]},
  { label: "插入", items: [
    { label: "图片...", action: "insert-image" },
    { label: "表格", action: "insert-table" },
    { label: "链接", action: "insert-link" },
  ]},
  { label: "格式", items: [
    { label: "粗体", action: "bold", shortcut: "Ctrl+B" },
    { label: "斜体", action: "italic", shortcut: "Ctrl+I" },
    { label: "下划线", action: "underline", shortcut: "Ctrl+U" },
    { divider: true, label: "", action: "" },
    { label: "项目符号", action: "bullet" },
    { label: "编号", action: "numbering" },
  ]},
  { label: "视图", items: [
    { label: "全屏", action: "fullscreen", shortcut: "F11" },
    { divider: true, label: "", action: "" },
    { label: "工具栏", action: "toggle-toolbar" },
    { label: "侧边栏", action: "toggle-sidebar" },
    { label: "状态栏", action: "toggle-statusbar" },
  ]},
  { label: "帮助", items: [
    { label: "使用帮助", action: "help" },
    { divider: true, label: "", action: "" },
    { label: "关于", action: "about" },
  ]},
];

const TOOLBAR_ITEMS: Record<string, ToolbarItemDef[]> = {
  doc: [
    { icon: "📄", label: "新建", action: "new" },
    { icon: "📂", label: "打开", action: "open" },
    { icon: "💾", label: "保存", action: "save" },
    { icon: "│", label: "", action: "sep" },
    { icon: "✂️", label: "剪切", action: "cut" },
    { icon: "📋", label: "复制", action: "copy" },
    { icon: "📝", label: "粘贴", action: "paste" },
    { icon: "│", label: "", action: "sep" },
    { icon: "↩", label: "撤销", action: "undo" },
    { icon: "↪", label: "重做", action: "redo" },
    { icon: "│", label: "", action: "sep" },
    { icon: "B", label: "粗体", action: "bold", bold: true },
    { icon: "I", label: "斜体", action: "italic" },
    { icon: "U", label: "下划线", action: "underline" },
  ],
  xls: [
    { icon: "📄", label: "新建", action: "new" },
    { icon: "📂", label: "打开", action: "open" },
    { icon: "💾", label: "保存", action: "save" },
    { icon: "│", label: "", action: "sep" },
    { icon: "✂️", label: "剪切", action: "cut" },
    { icon: "📋", label: "复制", action: "copy" },
    { icon: "📝", label: "粘贴", action: "paste" },
    { icon: "│", label: "", action: "sep" },
    { icon: "➕", label: "添加行", action: "insert-row" },
    { icon: "➕", label: "添加列", action: "insert-col" },
  ],
  ppt: [
    { icon: "📄", label: "新建", action: "new" },
    { icon: "📂", label: "打开", action: "open" },
    { icon: "💾", label: "保存", action: "save" },
    { icon: "│", label: "", action: "sep" },
    { icon: "➕", label: "新幻灯片", action: "add-slide" },
    { icon: "🗑", label: "删除", action: "delete-slide" },
    { icon: "│", label: "", action: "sep" },
    { icon: "▶", label: "放映", action: "present" },
  ],
  pdf: [
    { icon: "📂", label: "打开", action: "open" },
    { icon: "│", label: "", action: "sep" },
    { icon: "🔍+", label: "放大", action: "zoom-in" },
    { icon: "🔍-", label: "缩小", action: "zoom-out" },
  ],
};

const TEMPLATES = [
  { icon: "📝", label: "新建文档", type: "doc" as const },
  { icon: "📊", label: "新建表格", type: "xls" as const },
  { icon: "📽", label: "新建演示", type: "ppt" as const },
  { icon: "📄", label: "打开PDF", type: "pdf" as const },
];

const TYPE_NAMES: Record<string, string> = { doc: "文档", xls: "表格", ppt: "演示", pdf: "PDF" };
const EXT_MAP: Record<string, string> = { doc: "docx", xls: "xlsx", ppt: "pptx", pdf: "pdf" };
const FILTER_NAMES: Record<string, string> = { doc: "Word文档", xls: "Excel表格", ppt: "PowerPoint", pdf: "PDF文件" };

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
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newMenuPosition, setNewMenuPosition] = useState({ x: 0, y: 0 });

  const docEditorRef = useRef<DocumentEditorHandle>(null);
  const xlsEditorRef = useRef<SpreadsheetEditorHandle>(null);
  const pptEditorRef = useRef<PresentationEditorHandle>(null);

  const handleNewFile = useCallback((type?: "doc" | "xls" | "ppt" | "pdf") => {
    const fileType = type || activeTab;
    const newFile: FileTab = {
      id: `file-${Date.now()}`,
      name: `新建${TYPE_NAMES[fileType]}.${EXT_MAP[fileType]}`,
      type: fileType,
      modified: false,
    };
    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFile(newFile);
    setActiveTab(fileType);
    setShowNewMenu(false);
    showToast(`已创建新${TYPE_NAMES[fileType]}`, "success");
  }, [activeTab, showToast]);

  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "所有支持的文件", extensions: ["docx", "doc", "xlsx", "xls", "csv", "pptx", "ppt", "pdf", "txt"] },
          { name: "Word文档", extensions: ["docx", "doc"] },
          { name: "Excel表格", extensions: ["xlsx", "xls", "csv"] },
          { name: "PowerPoint演示", extensions: ["pptx", "ppt"] },
          { name: "PDF文档", extensions: ["pdf"] },
          { name: "文本文件", extensions: ["txt"] },
        ],
      });
      if (selected && typeof selected === "string") await openFileByPath(selected);
    } catch { showToast("打开文件失败", "error"); }
  }, [showToast]);

  const openFileByPath = useCallback(async (filePath: string) => {
    try {
      // 检查文件是否已打开
      const existing = openFiles.find((f) => f.path === filePath);
      if (existing) { 
        setActiveFile(existing);
        setActiveTab(existing.type);
        return; 
      }

      const fileData = await readFile(filePath);
      const fileName = filePath.split(/[/\\]/).pop() || "未命名";
      const fileType = getFileType(fileName);
      
      // 切换到对应的标签
      setActiveTab(fileType);

      const newFile: FileTab = {
        id: `file-${Date.now()}`,
        name: fileName,
        path: filePath,
        type: fileType,
        rawContent: fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData),
        modified: false,
      };
      
      // 延迟添加文件以确保标签切换完成
      setTimeout(() => {
        setOpenFiles((prev) => {
          // 再次检查是否已添加
          if (prev.find((f) => f.path === filePath)) return prev;
          return [...prev, newFile];
        });
        setActiveFile(newFile);
      }, 50);

      setRecentFiles((prev) => [
        { name: fileName, path: filePath, time: new Date().toLocaleString() },
        ...prev.filter((f) => f.path !== filePath),
      ].slice(0, 10));

      showToast(`已打开: ${fileName}`, "success");
    } catch (err) { showToast("打开文件失败: " + err, "error"); }
  }, [openFiles, showToast]);

  const handleSaveFile = useCallback(async (forceSaveAs = false) => {
    if (!activeFile) {
      showToast("请先创建或打开文件", "info");
      return;
    }
    if (activeFile.type === "pdf") { showToast("PDF不支持保存", "info"); return; }

    try {
      let savePath = activeFile.path;
      if (!savePath || forceSaveAs) {
        let extensions: string[] = [EXT_MAP[activeFile.type]];
        let filterName = FILTER_NAMES[activeFile.type];
        
        // 为每种类型添加多种导出格式
        if (activeFile.type === "doc") {
          extensions = ["docx", "doc"];
          filterName = "Word文档";
        } else if (activeFile.type === "xls") {
          extensions = ["xlsx", "xls", "csv"];
          filterName = "Excel表格";
        } else if (activeFile.type === "ppt") {
          extensions = ["pptx", "ppt"];
          filterName = "PowerPoint演示";
        }
        
        const selected = await save({
          filters: [{ name: filterName, extensions }],
          defaultPath: activeFile.name,
        });
        if (!selected) return;
        savePath = selected as string;
      }

      let buffer: Uint8Array;
      let savedSuccessfully = false;
      const fileExt = savePath.split(".").pop()?.toLowerCase() || "";

      if (activeFile.type === "doc") {
        if (!docEditorRef.current) { showToast("编辑器未就绪", "error"); return; }
        // 确保编辑器内容已同步
        await new Promise(resolve => setTimeout(resolve, 100));
        buffer = await docEditorRef.current.getDocxBuffer();
        savedSuccessfully = true;
      } else if (activeFile.type === "xls") {
        if (!xlsEditorRef.current) { showToast("编辑器未就绪", "error"); return; }
        // 根据扩展名决定格式
        if (fileExt === "csv") {
          buffer = xlsEditorRef.current.getCsvBuffer();
        } else {
          buffer = xlsEditorRef.current.getXlsxBuffer();
        }
        savedSuccessfully = true;
      } else if (activeFile.type === "ppt") {
        if (!pptEditorRef.current) { showToast("编辑器未就绪", "error"); return; }
        buffer = await pptEditorRef.current.getPptxBuffer();
        savedSuccessfully = true;
      } else {
        showToast("不支持的文件类型", "error"); return;
      }

      if (savedSuccessfully) {
        await writeFile(savePath, buffer);
        const fileName = savePath.split(/[/\\]/).pop() || activeFile.name;
        const updatedFile: FileTab = { ...activeFile, path: savePath, name: fileName, modified: false, rawContent: buffer };
        setOpenFiles((prev) => prev.map((f) => (f.id === activeFile.id ? updatedFile : f)));
        setActiveFile(updatedFile);
        showToast(`已保存: ${fileName}`, "success");
      }
    } catch (err) { showToast("保存失败: " + err, "error"); }
  }, [activeFile, showToast]);

  const handleCloseFile = useCallback(async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const file = openFiles.find((f) => f.id === id);
    if (file?.modified) {
      const shouldSave = confirm(`"${file.name}" 已修改，是否保存？`);
      if (shouldSave) {
        // 设置当前活动文件为要保存的文件
        setActiveFile(file);
        await new Promise(resolve => setTimeout(resolve, 100));
        await handleSaveFile();
      }
    }
    const newFiles = openFiles.filter((f) => f.id !== id);
    setOpenFiles(newFiles);
    if (activeFile?.id === id) {
      const newActive = newFiles.length > 0 ? newFiles[newFiles.length - 1] : null;
      setActiveFile(newActive);
      if (newActive) {
        setActiveTab(newActive.type);
      }
    }
  }, [openFiles, activeFile, handleSaveFile]);

  const handleContentChange = useCallback((content?: any) => {
    if (!activeFile) return;
    // 如果内容为空且文件未修改，则标记为已修改
    const shouldMarkModified = content !== undefined || activeFile.modified;
    const updatedFile = { ...activeFile, modified: shouldMarkModified };
    setOpenFiles((prev) => prev.map((f) => (f.id === activeFile.id ? updatedFile : f)));
    setActiveFile(updatedFile);
  }, [activeFile]);

  const handleMenuAction = useCallback((action: string) => {
    setActiveMenu(null);
    switch (action) {
      case "new": handleNewFile(); break;
      case "open": handleOpenFile(); break;
      case "save": handleSaveFile(); break;
      case "saveas": handleSaveFile(true); break;
      case "close": if (activeFile) handleCloseFile(activeFile.id); break;
      case "exit": if (confirm("确定退出吗？未保存的更改将丢失。")) onLogout(); break;
      case "undo": 
        if (activeFile?.type === "doc") docEditorRef.current?.undo?.();
        break;
      case "redo": 
        if (activeFile?.type === "doc") docEditorRef.current?.redo?.();
        break;
      case "cut": 
        if (activeFile?.type === "doc") document.execCommand("cut");
        break;
      case "copy": 
        if (activeFile?.type === "doc") document.execCommand("copy");
        break;
      case "paste": 
        if (activeFile?.type === "doc") document.execCommand("paste");
        break;
      case "selectall": 
        if (activeFile?.type === "doc") document.execCommand("selectAll");
        break;
      case "bold": 
        if (activeFile?.type === "doc") document.execCommand("bold");
        break;
      case "italic": 
        if (activeFile?.type === "doc") document.execCommand("italic");
        break;
      case "underline": 
        if (activeFile?.type === "doc") document.execCommand("underline");
        break;
      case "insert-image":
        if (activeFile?.type === "doc") {
          showToast("图片插入功能开发中", "info");
        } else {
          showToast("此功能仅支持文档编辑器", "info");
        }
        break;
      case "insert-table":
        if (activeFile?.type === "doc") {
          showToast("表格插入功能开发中", "info");
        } else {
          showToast("此功能仅支持文档编辑器", "info");
        }
        break;
      case "insert-link":
        if (activeFile?.type === "doc") {
          showToast("链接插入功能开发中", "info");
        } else {
          showToast("此功能仅支持文档编辑器", "info");
        }
        break;
      case "fullscreen":
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
        break;
      case "toggle-toolbar": setShowToolbar((p) => !p); break;
      case "toggle-sidebar": setShowSidebar((p) => !p); break;
      case "toggle-statusbar": setShowStatusbar((p) => !p); break;
      case "insert-row": 
        if (activeFile?.type === "xls") xlsEditorRef.current?.addRow?.();
        else showToast("此功能仅支持表格编辑器", "info");
        break;
      case "insert-col": 
        if (activeFile?.type === "xls") xlsEditorRef.current?.addColumn?.();
        else showToast("此功能仅支持表格编辑器", "info");
        break;
      case "add-slide": 
        if (activeFile?.type === "ppt") pptEditorRef.current?.addSlide?.();
        else showToast("此功能仅支持演示编辑器", "info");
        break;
      case "delete-slide": 
        if (activeFile?.type === "ppt") pptEditorRef.current?.deleteSlide?.();
        else showToast("此功能仅支持演示编辑器", "info");
        break;
      case "present": 
        if (activeFile?.type === "ppt") pptEditorRef.current?.present?.();
        else showToast("此功能仅支持演示编辑器", "info");
        break;
      case "about": 
        alert("📊 King办公套件 v2.0.0\n\n" +
              "轻量高效 · 简约美观 · 绿色便携\n\n" +
              "支持文档、表格、演示文稿编辑\n\n" +
              "© 2026 KingOffice"); 
        break;
      case "help": showToast("快捷键: Ctrl+N 新建 | Ctrl+O 打开 | Ctrl+S 保存 | Ctrl+W 关闭", "info"); break;
      default: break;
    }
  }, [activeFile, handleNewFile, handleOpenFile, handleSaveFile, handleCloseFile, onLogout, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "n": e.preventDefault(); handleNewFile(); break;
          case "o": e.preventDefault(); handleOpenFile(); break;
          case "s": e.preventDefault(); handleSaveFile(e.shiftKey); break;
          case "w": e.preventDefault(); if (activeFile) handleCloseFile(activeFile.id); break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewFile, handleOpenFile, handleSaveFile, handleCloseFile, activeFile]);

  const handleTemplateClick = useCallback((type: "doc" | "xls" | "ppt" | "pdf") => {
    setActiveTab(type);
    setTimeout(() => handleNewFile(), 50);
  }, [handleNewFile]);

  const TAB_ICONS: Record<string, string> = { doc: "📝", xls: "📊", ppt: "📽", pdf: "📄" };

  return (
    <div className="wps-main">
      <header className="wps-header">
        <div className="header-left">
          <div className="app-logo">📊</div>
          <span className="app-title">King办公套件</span>
        </div>
        <div className="header-tabs">
          {openFiles.map((file) => (
            <div key={file.id} className={`file-tab ${activeFile?.id === file.id ? "active" : ""}`} onClick={() => setActiveFile(file)}>
              <span className="tab-icon">{TAB_ICONS[file.type]}</span>
              <span className="tab-name">{file.modified && <span className="modified">●</span>}{file.name}</span>
              <button className="tab-close" onClick={(e) => handleCloseFile(file.id, e)}>×</button>
            </div>
          ))}
          {openFiles.length === 0 && <div className="no-tab">未打开文件</div>}
        </div>
        <div className="header-right">
          <span className="user-name">👤 {username}</span>
          <button className="btn-logout" onClick={onLogout}>退出</button>
        </div>
      </header>

      <nav className="wps-menu">
        {MENUS.map((menu) => (
          <div key={menu.label} className={`menu-item ${activeMenu === menu.label ? "active" : ""}`}
            onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}>
            <span>{menu.label}</span>
            {activeMenu === menu.label && (
              <div className="menu-dropdown">
                {menu.items.map((item, i) =>
                  item.divider ? <div key={i} className="menu-sep" /> : (
                    <div key={i} className="menu-dropdown-item" onClick={(e) => { e.stopPropagation(); handleMenuAction(item.action || ""); }}>
                      <span>{item.label}</span>
                      {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
        <div className="menu-toggle" onClick={() => setShowSidebar(!showSidebar)}>{showSidebar ? "◀" : "▶"}</div>
      </nav>

      {showToolbar && (
        <div className="wps-toolbar">
          {/* 新建按钮 - 带下拉菜单 */}
          <div className="toolbar-new-wrapper">
            <button 
              className="toolbar-btn toolbar-new-btn" 
              onClick={(e) => {
                const rect = (e.target as HTMLElement).closest('button')?.getBoundingClientRect();
                if (rect) {
                  setNewMenuPosition({ x: rect.left, y: rect.bottom + 4 });
                }
                setShowNewMenu(!showNewMenu);
              }} 
              title="新建文件"
            >
              <span className="btn-icon">📄</span>
              <span className="btn-label">新建</span>
              <span className="btn-arrow">▼</span>
            </button>
            {showNewMenu && (
              <div className="toolbar-new-menu" style={{ left: newMenuPosition.x, top: newMenuPosition.y }}>
                <div className="new-menu-item" onClick={() => handleNewFile("doc")}>
                  <span>📝</span> <span>新建文档</span>
                </div>
                <div className="new-menu-item" onClick={() => handleNewFile("xls")}>
                  <span>📊</span> <span>新建表格</span>
                </div>
                <div className="new-menu-item" onClick={() => handleNewFile("ppt")}>
                  <span>📽</span> <span>新建演示</span>
                </div>
              </div>
            )}
          </div>
          
          {TOOLBAR_ITEMS[activeTab]?.filter(item => item.action !== "new").map((item, i) =>
            item.action === "sep" ? <div key={i} className="toolbar-sep" /> : (
              <button key={i} className="toolbar-btn" onClick={() => handleMenuAction(item.action)} title={item.label}>
                <span className={`btn-icon ${item.bold ? "strong" : ""}`}>{item.icon}</span>
                <span className="btn-label">{item.label}</span>
              </button>
            )
          )}
        </div>
      )}
      
      {/* 点击其他区域关闭新建菜单 */}
      {showNewMenu && <div className="menu-overlay" onClick={() => setShowNewMenu(false)} />}

      <div className="wps-content">
        {showSidebar && (
          <aside className="wps-sidebar">
            <div className="sidebar-section">
              <div className="section-title">📝 快捷创建</div>
              <div className="template-grid">
                {TEMPLATES.map((t, i) => (
                  <div key={i} className="template-item" onClick={() => handleTemplateClick(t.type)}>
                    <span className="template-icon">{t.icon}</span>
                    <span className="template-label">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="sidebar-section">
              <div className="section-title">📂 最近文件</div>
              {recentFiles.length === 0 ? <div className="empty-recent">暂无最近文件</div> : (
                <div className="recent-list">
                  {recentFiles.map((f, i) => (
                    <div key={i} className="recent-item" onClick={() => openFileByPath(f.path)} title={f.path}>
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
              {activeFile.type === "doc" && <DocumentEditor key={activeFile.id} ref={docEditorRef} content={activeFile.rawContent} onChange={handleContentChange} fileName={activeFile.name} />}
              {activeFile.type === "xls" && <SpreadsheetEditor key={activeFile.id} ref={xlsEditorRef} content={activeFile.rawContent} onChange={handleContentChange} />}
              {activeFile.type === "ppt" && <PresentationEditor key={activeFile.id} ref={pptEditorRef} content={activeFile.rawContent} onChange={handleContentChange} />}
              {activeFile.type === "pdf" && <PdfViewer key={activeFile.id} file={activeFile.rawContent} path={activeFile.path} />}
            </div>
          ) : (
            <div className="empty-workspace">
              <div className="empty-icon">📋</div>
              <h2>欢迎使用 King办公套件</h2>
              <p>选择左侧模板开始创建，或点击工具栏按钮</p>
              <div className="quick-actions">
                {TEMPLATES.map((t, i) => (
                  <button key={i} className="quick-btn" onClick={() => handleTemplateClick(t.type)}>
                    <span>{t.icon}</span><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {showStatusbar && (
        <footer className="wps-status">
          <span className="status-item">📍 {TYPE_NAMES[activeFile?.type || "doc"]}</span>
          <span className="status-item">📄 {activeFile?.name || "未命名"}</span>
          <span className="status-item">📐 {activeFile?.type === "doc" ? "A4" : activeFile?.type === "xls" ? "Sheet1" : activeFile?.type === "ppt" ? `幻灯片 ${activeFile ? openFiles.indexOf(activeFile) + 1 : 1}/${openFiles.length}` : "-"}</span>
          <span className="status-item">🔤 100%</span>
          <span className="status-item">📝 UTF-8</span>
          <span className="status-item status-right">{activeFile?.modified ? "⚠️ 已修改" : activeFile?.path ? "✅ 已保存" : "📋 新建"}</span>
        </footer>
      )}
    </div>
  );
}
