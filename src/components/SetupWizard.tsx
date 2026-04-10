import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [installPath, setInstallPath] = useState("");
  const [dataPath, setDataPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelectInstallPath = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "选择安装目录"
      });
      if (selected) {
        setInstallPath(selected as string);
      }
    } catch (err) {
      setError("选择目录失败");
    }
  };

  const handleSelectDataPath = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "选择数据存储目录"
      });
      if (selected) {
        setDataPath(selected as string);
      }
    } catch (err) {
      setError("选择目录失败");
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // 直接保存到本地存储
      localStorage.setItem("kingoffice_setup_complete", "true");
      localStorage.setItem("kingoffice_install_path", installPath || "");
      localStorage.setItem("kingoffice_data_path", dataPath || "");
      
      onComplete();
    } catch (err) {
      setError("保存配置失败: " + String(err));
      setIsLoading(false);
    }
  };

  // 立即运行
  const handleLaunch = async () => {
    try {
      await invoke("launch_application");
      onComplete();
    } catch (err) {
      setError("启动失败: " + String(err));
    }
  };

  // 创建桌面快捷方式
  const handleCreateShortcut = async () => {
    try {
      await invoke("create_desktop_shortcut");
      alert("快捷方式已创建到桌面！");
    } catch (err) {
      alert("创建快捷方式失败: " + String(err));
    }
  };

  const handleSkip = () => {
    localStorage.setItem("kingoffice_setup_complete", "true");
    onComplete();
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-header">
          <div className="setup-logo">✨</div>
          <h1 className="setup-title">欢迎使用 King办公套件</h1>
          <p className="setup-subtitle">只需简单几步，即可完成设置</p>
        </div>

        {/* 步骤指示器 */}
        <div className="setup-steps">
          <div className={`step ${step >= 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}>
            <span className="step-number">1</span>
            <span className="step-label">安装目录</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step >= 2 ? "active" : ""} ${step > 2 ? "completed" : ""}`}>
            <span className="step-number">2</span>
            <span className="step-label">数据目录</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span>
            <span className="step-label">完成</span>
          </div>
        </div>

        {/* 步骤内容 */}
        <div className="setup-content">
          {step === 1 && (
            <div className="step-content">
              <h2>选择安装目录</h2>
              <p>软件主程序将安装到此目录</p>
              
              <div className="path-input-group">
                <input
                  type="text"
                  className="input"
                  value={installPath}
                  placeholder="默认: 应用所在目录"
                  onChange={(e) => setInstallPath(e.target.value)}
                />
                <button className="btn btn-ghost" onClick={handleSelectInstallPath}>
                  📁 浏览
                </button>
              </div>
              
              {error && <div className="form-error">{error}</div>}
            </div>
          )}

          {step === 2 && (
            <div className="step-content">
              <h2>选择数据存储目录</h2>
              <p>缓存、日志、临时文件等都将存放在此目录</p>
              
              <div className="path-input-group">
                <input
                  type="text"
                  className="input"
                  value={dataPath}
                  placeholder="默认: %APPDATA%\KingOffice"
                  onChange={(e) => setDataPath(e.target.value)}
                />
                <button className="btn btn-ghost" onClick={handleSelectDataPath}>
                  📁 浏览
                </button>
              </div>
              
              <div className="path-hint">
                <span className="hint-icon">💡</span>
                <span>建议选择一个容量充足的磁盘分区</span>
              </div>
              
              {error && <div className="form-error">{error}</div>}
            </div>
          )}

          {step === 3 && (
            <div className="step-content step-complete">
              <div className="complete-icon">🎉</div>
              <h2>设置完成!</h2>
              <p>一切准备就绪，开始使用 King办公套件吧</p>
              
              <div className="summary">
                <div className="summary-item">
                  <span className="summary-label">安装目录</span>
                  <span className="summary-value">{installPath || "默认位置"}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">数据目录</span>
                  <span className="summary-value">{dataPath || "默认位置"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 按钮 */}
        <div className="setup-footer">
          {step > 1 && (
            <button 
              className="btn btn-ghost" 
              onClick={() => { setStep(step - 1); setError(""); }}
            >
              上一步
            </button>
          )}
          
          {step < 3 ? (
            <button 
              className="btn btn-primary" 
              onClick={() => setStep(step + 1)}
            >
              下一步
            </button>
          ) : (
            <div className="finish-buttons">
              <button 
                className="btn btn-outline" 
                onClick={handleCreateShortcut}
                disabled={isLoading}
              >
                🏠 创建桌面快捷方式
              </button>
              <button 
                className="btn btn-accent" 
                onClick={handleLaunch}
                disabled={isLoading}
              >
                🚀 {isLoading ? "处理中..." : "立即运行"}
              </button>
            </div>
          )}
        </div>

        {step < 3 && (
          <div className="setup-skip">
            <button className="btn-link" onClick={handleSkip}>
              跳过设置，使用默认配置
            </button>
          </div>
        )}
      </div>

      <style>{`
        .setup-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
          padding: 20px;
        }

        .setup-card {
          background: white;
          border-radius: 20px;
          padding: 48px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 20px 60px rgba(79, 134, 247, 0.15);
        }

        .setup-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .setup-logo {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .setup-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: 6px;
        }

        .setup-subtitle {
          font-size: 14px;
          color: var(--color-text-light);
        }

        .setup-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 32px;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .step-number {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-bg-dark);
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s;
        }

        .step.active .step-number {
          background: var(--color-primary);
          color: white;
        }

        .step.completed .step-number {
          background: var(--color-success);
          color: white;
        }

        .step-label {
          font-size: 12px;
          color: var(--color-text-muted);
        }

        .step.active .step-label,
        .step.completed .step-label {
          color: var(--color-primary);
          font-weight: 500;
        }

        .step-line {
          width: 60px;
          height: 2px;
          background: var(--color-border);
          margin: 0 12px 20px;
        }

        .setup-content {
          min-height: 200px;
          margin-bottom: 24px;
        }

        .step-content h2 {
          font-size: 18px;
          color: var(--color-text);
          margin-bottom: 8px;
          text-align: center;
        }

        .step-content p {
          font-size: 14px;
          color: var(--color-text-light);
          text-align: center;
          margin-bottom: 20px;
        }

        .path-input-group {
          display: flex;
          gap: 10px;
        }

        .path-input-group .input {
          flex: 1;
        }

        .path-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px;
          background: var(--color-bg-light);
          border-radius: 8px;
          font-size: 13px;
          color: var(--color-text-light);
        }

        .hint-icon {
          font-size: 16px;
        }

        .step-complete {
          text-align: center;
        }

        .complete-icon {
          font-size: 64px;
          margin-bottom: 16px;
          animation: bounce 0.6s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        .summary {
          background: var(--color-bg-light);
          border-radius: 10px;
          padding: 16px;
          margin-top: 20px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--color-border-light);
        }

        .summary-item:last-child {
          border-bottom: none;
        }

        .summary-label {
          color: var(--color-text-light);
          font-size: 13px;
        }

        .summary-value {
          color: var(--color-text);
          font-size: 13px;
          font-weight: 500;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .setup-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .finish-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-outline {
          background: transparent;
          color: var(--color-primary);
          border: 1.5px solid var(--color-primary);
        }

        .btn-outline:hover:not(:disabled) {
          background: var(--color-bg-light);
          transform: translateY(-1px);
        }

        .setup-skip {
          text-align: center;
          margin-top: 16px;
        }

        .btn-link {
          background: none;
          border: none;
          color: var(--color-text-muted);
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
        }

        .btn-link:hover {
          color: var(--color-primary);
        }
      `}</style>
    </div>
  );
}
