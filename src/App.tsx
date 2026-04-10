import { useState, useEffect } from "react";
import Login from "./components/Login";
import MainInterface from "./components/MainInterface";
import Toast from "./components/Toast";
import SetupWizard from "./components/SetupWizard";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // 检查是否已完成首次设置
  useEffect(() => {
    // 开发模式: 检查 URL 参数 ?reset-setup 可重置设置
    const urlParams = new URLSearchParams(window.location.search);
    const resetSetup = urlParams.get("reset-setup");
    
    if (resetSetup === "true") {
      localStorage.removeItem("kingoffice_setup_complete");
      setShowSetup(true);
      return;
    }
    
    const setupComplete = localStorage.getItem("kingoffice_setup_complete");
    if (!setupComplete) {
      setShowSetup(true);
    }
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLoginSuccess = (user: string) => {
    setUsername(user);
    setIsLoggedIn(true);
  };

  const handleAccountCreated = (user: string) => {
    showToast("账户创建成功！", "success");
    setUsername(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
  };

  if (showSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  return (
    <>
      {isLoggedIn ? (
        <MainInterface username={username} onLogout={handleLogout} showToast={showToast} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} onAccountCreated={handleAccountCreated} showToast={showToast} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
