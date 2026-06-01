<?php
/**
 * ADMIN PANEL — SETUP HELPER
 * Run this file once to:
 *  1. Test your database connection
 *  2. Generate a bcrypt password hash for your admin user
 *  3. Insert a default admin user if needed
 *
 * DELETE this file after setup is complete!
 */

// ── CONFIG (match index.php) ─────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'cms_db');

$message = '';
$hashResult = '';

// ── GENERATE HASH ────────────────────────────────────────────
if (isset($_POST['gen_hash']) && !empty($_POST['plain_pass'])) {
    $hashResult = password_hash($_POST['plain_pass'], PASSWORD_DEFAULT);
}

// ── INSERT ADMIN USER ────────────────────────────────────────
if (isset($_POST['insert_user'])) {
    $username = trim($_POST['username'] ?? 'admin');
    $email    = trim($_POST['email'] ?? 'admin@example.com');
    $password = trim($_POST['password'] ?? '');
    if ($password) {
        try {
            $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $pdo->prepare("INSERT INTO users (username, email, password, role, active, created_at) VALUES (?,?,?,?,1,NOW())")
                ->execute([$username, $email, $hash, 'admin']);
            $message = "✅ Admin user '$username' created successfully!";
        } catch (Exception $e) {
            $message = "❌ Error: " . $e->getMessage();
        }
    } else {
        $message = "❌ Password cannot be empty.";
    }
}

// ── TEST DB ──────────────────────────────────────────────────
$dbStatus = '';
try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $dbStatus = "✅ Connected! Found " . count($tables) . " tables: " . implode(', ', $tables);
} catch (Exception $e) {
    $dbStatus = "❌ " . $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Admin Setup Helper</title>
<style>
body { font-family: system-ui,sans-serif; background:#0d0f14; color:#e2e8f0; max-width:700px; margin:40px auto; padding:20px; }
h1 { color:#4f8ef7; } h2 { color:#94a3b8; font-size:15px; margin-top:30px; }
.box { background:#13161d; border:1px solid #2a2f42; border-radius:10px; padding:20px; margin:16px 0; }
input { background:#1a1e28; border:1px solid #2a2f42; border-radius:6px; padding:8px 12px; color:#e2e8f0; font-size:14px; width:100%; margin:6px 0 12px; box-sizing:border-box; outline:none; }
input:focus { border-color:#4f8ef7; }
button { background:#4f8ef7; color:#fff; border:none; border-radius:6px; padding:9px 20px; cursor:pointer; font-size:14px; }
button:hover { background:#6ea3ff; }
.status { padding:12px 16px; border-radius:6px; background:#1a1e28; border-left:3px solid #4f8ef7; font-size:13px; margin-top:12px; word-break:break-all; }
.warn { background:#f59e0b22; border-color:#f59e0b; color:#f59e0b; text-align:center; font-weight:600; padding:16px; border-radius:10px; margin-bottom:20px; }
label { font-size:13px; color:#94a3b8; }
</style>
</head>
<body>
<div class="warn">⚠️ DELETE THIS FILE after setup is complete!</div>
<h1>Admin Panel — Setup Helper</h1>

<div class="box">
  <h2>1. Database Connection</h2>
  <div class="status"><?= htmlspecialchars($dbStatus) ?></div>
</div>

<div class="box">
  <h2>2. Generate Password Hash</h2>
  <form method="post">
    <label>Plain Text Password</label>
    <input type="text" name="plain_pass" placeholder="Enter a password to hash" required>
    <button type="submit" name="gen_hash">Generate Hash</button>
  </form>
  <?php if ($hashResult): ?>
  <div class="status">Hash: <strong><?= htmlspecialchars($hashResult) ?></strong></div>
  <?php endif; ?>
</div>

<div class="box">
  <h2>3. Insert Admin User</h2>
  <?php if ($message): ?><div class="status"><?= htmlspecialchars($message) ?></div><?php endif; ?>
  <form method="post">
    <label>Username</label>
    <input type="text" name="username" value="admin" required>
    <label>Email</label>
    <input type="email" name="email" value="admin@example.com" required>
    <label>Password</label>
    <input type="password" name="password" required placeholder="Choose a strong password">
    <button type="submit" name="insert_user">Create Admin User</button>
  </form>
</div>

<div class="box">
  <h2>4. Configuration Checklist</h2>
  <ul style="color:#94a3b8;font-size:13px;line-height:2">
    <li>Edit <code>index.php</code> lines 8–11: set DB_HOST, DB_USER, DB_PASS, DB_NAME</li>
    <li>Ensure your <code>users</code> table stores passwords as bcrypt hashes</li>
    <li>Set proper file permissions on your uploads folder</li>
    <li><strong>Delete <code>setup.php</code> after completing setup</strong></li>
  </ul>
</div>
</body>
</html>