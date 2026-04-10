// 账户系统模块
// 处理用户账户的创建、验证和加密存储

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::{Rng, rngs::OsRng};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tracing::{info, warn};

/// 账户数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub username: String,
    pub password_hash: String,
    pub salt: String,
    pub created_at: String,
    pub last_login: Option<String>,
}

/// 加密的账户文件结构
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedAccount {
    salt: String,
    nonce: String,
    ciphertext: String,
}

/// 获取配置目录
fn get_config_dir() -> Result<PathBuf, String> {
    let base_dir = dirs::data_local_dir()
        .ok_or_else(|| "无法获取本地数据目录".to_string())?;
    
    let config_dir = base_dir.join("KingOffice").join("config");
    
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("创建配置目录失败: {}", e))?;
    
    Ok(config_dir)
}

/// 获取账户文件路径
fn get_account_file() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("account.enc"))
}

/// 初始化账户系统
pub fn init_account_system() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    info!("[账户] 配置目录: {:?}", config_dir);
    
    let account_file = get_account_file()?;
    if account_file.exists() {
        info!("[账户] 发现已存在的账户文件");
    } else {
        info!("[账户] 未找到账户文件，将引导创建新账户");
    }
    
    Ok(())
}

/// 生成密码哈希
fn hash_password(password: &str, salt: &str) -> Result<String, String> {
    let salt = SaltString::from_b64(salt)
        .map_err(|e| format!("盐值格式错误: {}", e))?;
    
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("密码哈希失败: {}", e))?;
    
    Ok(hash.to_string())
}

/// 验证密码
fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    use argon2::{PasswordHash, PasswordVerifier};
    
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| format!("无效的密码哈希: {}", e))?;
    
    let argon2 = Argon2::default();
    Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}

/// 派生加密密钥
fn derive_key(password: &str, salt: &str) -> Result<[u8; 32], String> {
    use argon2::Argon2;
    
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt.as_bytes(), &mut key)
        .map_err(|e| format!("密钥派生失败: {}", e))?;
    
    Ok(key)
}

/// 加密数据
fn encrypt_data(data: &str, password: &str) -> Result<EncryptedAccount, String> {
    // 生成盐值
    let salt = SaltString::generate(&mut OsRng);
    let salt_str = salt.as_str();
    
    // 使用盐值派生密钥
    let key = derive_key(password, salt_str)?;
    
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("创建加密器失败: {}", e))?;
    
    // 生成随机nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // 加密数据
    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| format!("加密失败: {}", e))?;
    
    Ok(EncryptedAccount {
        salt: salt_str.to_string(),
        nonce: BASE64.encode(nonce_bytes),
        ciphertext: BASE64.encode(ciphertext),
    })
}

/// 解密数据
fn decrypt_data(encrypted: &EncryptedAccount, password: &str) -> Result<String, String> {
    let nonce_bytes = BASE64.decode(&encrypted.nonce)
        .map_err(|e| format!("解码nonce失败: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // 使用存储的盐值派生密钥
    let key = derive_key(password, &encrypted.salt)?;
    
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("创建加密器失败: {}", e))?;
    
    let ciphertext = BASE64.decode(&encrypted.ciphertext)
        .map_err(|e| format!("解码密文失败: {}", e))?;
    
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("解密失败（密码可能错误）: {}", e))?;
    
    String::from_utf8(plaintext)
        .map_err(|e| format!("转换文本失败: {}", e))
}

/// 创建新账户
#[tauri::command]
pub fn create_account(username: String, password: String) -> Result<bool, String> {
    info!("[账户] 尝试创建账户: {}", username);
    
    let account_file = get_account_file()?;
    
    if account_file.exists() {
        warn!("[账户] 账户文件已存在，拒绝覆盖");
        return Err("账户已存在，请直接登录".to_string());
    }
    
    // 生成盐值
    let salt = SaltString::generate(&mut OsRng).to_string();
    
    // 哈希密码
    let password_hash = hash_password(&password, &salt)?;
    
    // 创建账户
    let account = Account {
        username: username.clone(),
        password_hash,
        salt,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        last_login: None,
    };
    
    let account_json = serde_json::to_string(&account)
        .map_err(|e| format!("序列化账户失败: {}", e))?;
    
    // 加密账户数据
    let encrypted = encrypt_data(&account_json, &password)?;
    
    // 写入文件
    let encrypted_json = serde_json::to_string_pretty(&encrypted)
        .map_err(|e| format!("序列化加密数据失败: {}", e))?;
    
    fs::write(&account_file, encrypted_json)
        .map_err(|e| format!("写入账户文件失败: {}", e))?;
    
    info!("[账户] 账户创建成功: {}", username);
    Ok(true)
}

/// 验证账户登录
#[tauri::command]
pub fn verify_account(username: String, password: String) -> Result<bool, String> {
    info!("[账户] 验证账户登录: {}", username);
    
    let account_file = get_account_file()?;
    
    if !account_file.exists() {
        warn!("[账户] 账户文件不存在");
        return Err("账户不存在".to_string());
    }
    
    // 读取加密数据
    let encrypted_json = fs::read_to_string(&account_file)
        .map_err(|e| format!("读取账户文件失败: {}", e))?;
    
    let encrypted: EncryptedAccount = serde_json::from_str(&encrypted_json)
        .map_err(|e| format!("解析加密数据失败: {}", e))?;
    
    // 解密账户数据
    let account_json = decrypt_data(&encrypted, &password)?;
    
    let account: Account = serde_json::from_str(&account_json)
        .map_err(|e| format!("解析账户数据失败: {}", e))?;
    
    // 验证用户名
    if account.username != username {
        warn!("[账户] 用户名不匹配");
        return Err("用户名或密码错误".to_string());
    }
    
    // 验证密码
    let password_valid = verify_password(&password, &account.password_hash)?;
    
    if !password_valid {
        warn!("[账户] 密码验证失败");
        return Err("用户名或密码错误".to_string());
    }
    
    info!("[账户] 登录验证成功: {}", username);
    Ok(true)
}

/// 检查账户是否存在
#[tauri::command]
pub fn is_account_exists() -> Result<bool, String> {
    let account_file = get_account_file()?;
    Ok(account_file.exists())
}

/// 获取当前登录用户信息
#[tauri::command]
pub fn get_current_user() -> Result<Option<String>, String> {
    let account_file = get_account_file()?;
    
    if !account_file.exists() {
        return Ok(None);
    }
    
    Ok(Some("已登录用户".to_string()))
}
