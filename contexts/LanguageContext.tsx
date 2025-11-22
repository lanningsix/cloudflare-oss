
import React, { createContext, useState, useContext, ReactNode } from 'react';

export type Language = 'en' | 'zh' | 'ja';

const translations = {
  en: {
    app_title: "WorkerBox",
    subtitle_demo: "DEMO MODE",
    new_folder: "New Folder",
    refresh: "Refresh List",
    home: "Home",
    upload_uploading: "Uploading...",
    upload_complete_title: "Uploads Completed",
    upload_idle: "Click or drag files/folders to upload",
    upload_drop_now: "Drop files or folders here!",
    upload_subtitle: "Support for images, documents, archives, and folder structures.",
    upload_btn_file: "Select Files",
    upload_btn_folder: "Select Folder",
    all_files: "All Files",
    connection_error: "Connection Error",
    switch_demo: "Switch to Demo Mode",
    folder_empty: "This folder is empty",
    root_empty: "No files yet",
    empty_hint: "Upload a file or create a folder.",
    create_folder_title: "Create New Folder",
    create_folder_desc: "Enter a name for the new folder.",
    folder_name_placeholder: "Folder Name",
    cancel: "Cancel",
    create: "Create",
    delete_title: "Delete Item?",
    delete_confirm: "Are you sure you want to delete",
    delete_warning: "Warning: This will permanently delete the folder and all files inside it.",
    delete: "Delete",
    toast_upload_success: "Successfully uploaded {count} file(s)",
    toast_upload_fail: "Uploaded {success}, Failed {fail}",
    toast_folder_created: "Folder created",
    toast_folder_failed: "Failed to create folder",
    toast_folder_exists: "A folder with this name already exists",
    toast_invalid_name: "Folder names cannot contain '/'",
    toast_deleted: "Item deleted",
    toast_delete_failed: "Failed to delete item",
    toast_demo_mode: "Switched to Demo Mode",
    powered_by: "Powered by Cloudflare Workers, D1, and R2",
    type_folder: "FOLDER",
    type_file: "FILE",
    copy_link: "Copy Link",
    download: "Download / View",
    delete_btn: "Delete",
    fetch_error_default: "Failed to fetch files from Cloudflare Worker.",
    // Auth & Limits
    login: "Login",
    register: "Register",
    logout: "Logout",
    login_title: "Login to WorkerBox",
    login_desc: "Sign in to access your private files.",
    register_title: "Create Account",
    register_desc: "Sign up to start managing your files.",
    username_placeholder: "Username",
    password_placeholder: "Password",
    confirm_password: "Confirm Password",
    guest_mode: "Guest Mode",
    guest_limit_info: "{count} / 10 free uploads used",
    upload_limit_reached: "Upload limit reached",
    login_to_unlimit: "Please login to upload more files.",
    user_profile: "User: {name}",
    password_mismatch: "Passwords do not match",
    register_success: "Account created! You are now logged in.",
    register_failed: "Registration failed: {error}",
    login_failed: "Login failed: {error}",
    username_taken: "Username is already taken",
    switch_to_register: "Need an account? Register",
    switch_to_login: "Already have an account? Login",
  },
  zh: {
    app_title: "WorkerBox",
    subtitle_demo: "演示模式",
    new_folder: "新建文件夹",
    refresh: "刷新",
    home: "首页",
    upload_uploading: "正在上传...",
    upload_complete_title: "上传完成",
    upload_idle: "点击或拖拽文件/文件夹上传",
    upload_drop_now: "松开鼠标开始上传！",
    upload_subtitle: "支持图片、文档、压缩包以及文件夹结构。",
    upload_btn_file: "选择文件",
    upload_btn_folder: "选择文件夹",
    all_files: "所有文件",
    connection_error: "连接错误",
    switch_demo: "切换到演示模式",
    folder_empty: "此文件夹为空",
    root_empty: "暂无文件",
    empty_hint: "上传文件或新建文件夹。",
    create_folder_title: "新建文件夹",
    create_folder_desc: "请输入新文件夹的名称。",
    folder_name_placeholder: "文件夹名称",
    cancel: "取消",
    create: "创建",
    delete_title: "删除项目？",
    delete_confirm: "您确定要删除",
    delete_warning: "警告：这将永久删除该文件夹及其内部的所有文件。",
    delete: "删除",
    toast_upload_success: "成功上传 {count} 个文件",
    toast_upload_fail: "上传成功 {success} 个，失败 {fail} 个",
    toast_folder_created: "文件夹已创建",
    toast_folder_failed: "创建文件夹失败",
    toast_folder_exists: "同名文件夹已存在",
    toast_invalid_name: "文件夹名称不能包含 '/'",
    toast_deleted: "项目已删除",
    toast_delete_failed: "删除项目失败",
    toast_demo_mode: "已切换到演示模式",
    powered_by: "由 Cloudflare Workers, D1, 和 R2 强力驱动",
    type_folder: "文件夹",
    type_file: "文件",
    copy_link: "复制链接",
    download: "下载 / 查看",
    delete_btn: "删除",
    fetch_error_default: "从 Cloudflare Worker 获取文件失败。",
    // Auth & Limits
    login: "登录",
    register: "注册",
    logout: "退出登录",
    login_title: "登录 WorkerBox",
    login_desc: "登录以访问您的私人文件。",
    register_title: "创建账户",
    register_desc: "注册以开始管理您的文件。",
    username_placeholder: "用户名",
    password_placeholder: "密码",
    confirm_password: "确认密码",
    guest_mode: "访客模式",
    guest_limit_info: "已使用 {count} / 10 次免费上传",
    upload_limit_reached: "上传次数已达上限",
    login_to_unlimit: "请登录以解锁无限制上传。",
    user_profile: "用户: {name}",
    password_mismatch: "两次输入的密码不一致",
    register_success: "账户创建成功！您已自动登录。",
    register_failed: "注册失败: {error}",
    login_failed: "登录失败: {error}",
    username_taken: "用户名已被使用",
    switch_to_register: "还没有账户？立即注册",
    switch_to_login: "已有账户？立即登录",
  },
  ja: {
    app_title: "WorkerBox",
    subtitle_demo: "デモモード",
    new_folder: "フォルダ作成",
    refresh: "更新",
    home: "ホーム",
    upload_uploading: "アップロード中...",
    upload_complete_title: "アップロード完了",
    upload_idle: "ファイルまたはフォルダをドラッグ＆ドロップ",
    upload_drop_now: "ドロップしてアップロード開始！",
    upload_subtitle: "画像、ドキュメント、フォルダ構造に対応しています。",
    upload_btn_file: "ファイルを選択",
    upload_btn_folder: "フォルダを選択",
    all_files: "すべてのファイル",
    connection_error: "接続エラー",
    switch_demo: "デモモードへ",
    folder_empty: "このフォルダは空です",
    root_empty: "ファイルはまだありません",
    empty_hint: "ファイルをアップロードするか、フォルダを作成してください。",
    create_folder_title: "新しいフォルダを作成",
    create_folder_desc: "新しいフォルダの名前を入力してください。",
    folder_name_placeholder: "フォルダ名",
    cancel: "キャンセル",
    create: "作成",
    delete_title: "削除しますか？",
    delete_confirm: "本当に削除しますか：",
    delete_warning: "警告：これにより、フォルダとその中のすべてのファイルが永久に削除されます。",
    delete: "削除",
    toast_upload_success: "{count} 個のファイルをアップロードしました",
    toast_upload_fail: "成功: {success}、失敗: {fail}",
    toast_folder_created: "フォルダを作成しました",
    toast_folder_failed: "フォルダの作成に失敗しました",
    toast_folder_exists: "この名前のフォルダは既に存在します",
    toast_invalid_name: "フォルダ名に '/' を含めることはできません",
    toast_deleted: "削除しました",
    toast_delete_failed: "削除に失敗しました",
    toast_demo_mode: "デモモードに切り替えました",
    powered_by: "Cloudflare Workers, D1, R2 で動作",
    type_folder: "フォルダ",
    type_file: "ファイル",
    copy_link: "リンクをコピー",
    download: "ダウンロード",
    delete_btn: "削除",
    fetch_error_default: "Cloudflare Worker からのファイル取得に失敗しました。",
    // Auth & Limits
    login: "ログイン",
    register: "登録",
    logout: "ログアウト",
    login_title: "WorkerBoxにログイン",
    login_desc: "サインインしてプライベートファイルにアクセスします。",
    register_title: "アカウント作成",
    register_desc: "登録してファイル管理を開始しましょう。",
    username_placeholder: "ユーザー名",
    password_placeholder: "パスワード",
    confirm_password: "パスワード確認",
    guest_mode: "ゲストモード",
    guest_limit_info: "無料アップロード {count} / 10 回使用済み",
    upload_limit_reached: "アップロード制限に達しました",
    login_to_unlimit: "制限なしでアップロードするにはログインしてください。",
    user_profile: "ユーザー: {name}",
    password_mismatch: "パスワードが一致しません",
    register_success: "アカウントが作成されました！ログイン済みです。",
    register_failed: "登録に失敗しました: {error}",
    login_failed: "ログインに失敗しました: {error}",
    username_taken: "ユーザー名は既に使用されています",
    switch_to_register: "アカウントをお持ちでないですか？登録",
    switch_to_login: "既にアカウントをお持ちですか？ログイン",
  }
};

type TranslationKey = keyof typeof translations['en'];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'en' || saved === 'zh' || saved === 'ja') ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
