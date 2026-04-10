import { useState, useEffect, FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

interface LoginProps {
  onLoginSuccess: (username: string) => void;
  onAccountCreated: (username: string) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function Login({ onLoginSuccess, onAccountCreated, showToast }: LoginProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkAccount();
  }, []);

  const checkAccount = async () => {
    try {
      const exists = await invoke<boolean>("is_account_exists");
      setIsLoginMode(exists);
    } catch (err) {
      console.error("[Login] 检查账户失败:", err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!username.trim()) {
      setError("请输入用户名");
      setIsLoading(false);
      return;
    }
    if (!password) {
      setError("请输入密码");
      setIsLoading(false);
      return;
    }
    if (!isLoginMode) {
      if (password !== confirmPassword) {
        setError("两次密码输入不一致");
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("密码长度至少6位");
        setIsLoading(false);
        return;
      }
    }

    try {
      if (isLoginMode) {
        const result = await invoke<boolean>("verify_account", { username, password });
        if (result) {
          onLoginSuccess(username);
        }
      } else {
        const result = await invoke<boolean>("create_account", { username, password });
        if (result) {
          onAccountCreated(username);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="login-container">
      <div className="login-card animate-slide-up">
        <div className="login-header">
          <div className="login-logo">📊</div>
          <h1 className="login-title">King办公套件</h1>
          <p className="login-subtitle">高效办公 · 安全可靠 · 绿色便携</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              type="text"
              className="input"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              type="password"
              className="input"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {!isLoginMode && (
            <div className="form-group">
              <label className="form-label">确认密码</label>
              <input
                type="password"
                className="input"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-accent btn-submit" disabled={isLoading}>
            {isLoading ? "处理中..." : isLoginMode ? "登 录" : "创建账户"}
          </button>
        </form>

        <div className="login-footer">
          {isLoginMode ? (
            <p>
              没有账户？
              <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }}>
                立即注册
              </a>
            </p>
          ) : (
            <p>
              已有账户？
              <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }}>
                立即登录
              </a>
            </p>
          )}
        </div>

        <div className="login-version">Version 1.0.0</div>
      </div>
    </div>
  );
}
