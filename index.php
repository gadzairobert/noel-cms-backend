<?php
session_start();

// ============================================================
// DATABASE CONFIGURATION — edit these 4 lines
// ============================================================
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'cms_db');

// Physical path to uploads folder on server (no trailing slash)
define('UPLOADS_PATH', __DIR__ . '/uploads');

// Auto-detect the URL path to the uploads folder relative to the web root.
// Works on XAMPP, WAMP, Linux Apache etc. without manual config.
// e.g. if this file is at /cms/admin-backend/index.php  →  UPLOADS_URL = /cms/admin-backend/uploads
$_scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
$_scriptDir = rtrim($_scriptDir, '/');
define('UPLOADS_URL', $_scriptDir . '/uploads');
unset($_scriptDir);

// ============================================================
// DB
// ============================================================
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4",
                DB_USER, DB_PASS,
                [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]
            );
        } catch (PDOException $e) {
            die(json_encode(['error'=>'DB connection failed: '.$e->getMessage()]));
        }
    }
    return $pdo;
}

// ============================================================
// IMAGE UPLOAD CONFIG
// Maps each table to its upload subfolder and image field names
// Matches exactly the folder structure from the Express JS routes
// ============================================================
function getUploadConfig() {
    return [
        'about_us'               => ['subdir'=>'about',           'fields'=>['hero_image']],
        'admin_quotation_items'  => ['subdir'=>'quotation_items', 'fields'=>['image_filename']],
        'faq'                    => ['subdir'=>'faq',             'fields'=>['image_filename']],
        'gallery_images'         => ['subdir'=>'gallery',         'fields'=>['image_filename']],
        'logos'                  => ['subdir'=>'logos',           'fields'=>['image_filename']],
        'products'               => ['subdir'=>'products',        'fields'=>['image_filename']],
        'services'               => ['subdir'=>'services',        'fields'=>['image1','image2','image3','image4','image5']],
        'slideshow'              => ['subdir'=>'slideshow',       'fields'=>['image_filename']],
        'team_members'           => ['subdir'=>'company',         'fields'=>['photo_url']],
        'testimonials'           => ['subdir'=>'testimonials',    'fields'=>['photo_filename']],
        'users'                  => ['subdir'=>'users',           'fields'=>['photo']],
        'videos'                 => ['subdir'=>'thumbnails',      'fields'=>['thumbnail_filename']],
    ];
}

function handleFileUpload($fieldName, $subdir) {
    if (!isset($_FILES[$fieldName]) || $_FILES[$fieldName]['error'] !== UPLOAD_ERR_OK) return null;
    $file = $_FILES[$fieldName];
    $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg','jpeg','png','gif','webp','svg'];
    if (!in_array($ext, $allowed)) return null;
    if ($file['size'] > 10 * 1024 * 1024) return null;
    $dir = UPLOADS_PATH . '/' . $subdir;
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $filename = time() . '-' . mt_rand(100000,999999) . '.' . $ext;
    if (move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) return $filename;
    return null;
}

// ============================================================
// AUTH
// ============================================================
function isLoggedIn() { return isset($_SESSION['admin_user']); }

function requireLogin() {
    if (!isLoggedIn()) { header('Location: ?page=login'); exit; }
}

function handleLogin() {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action']??'') === 'login') {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        try {
            $pdo  = getDB();
            $stmt = $pdo->prepare("SELECT * FROM users WHERE (username=? OR email=?) AND active=1 LIMIT 1");
            $stmt->execute([$username, $username]);
            $user = $stmt->fetch();
            if ($user && password_verify($password, $user['password'])) {
                $_SESSION['admin_user'] = [
                    'id'       => $user['id'],
                    'username' => $user['username'],
                    'role'     => $user['role'],
                    'photo'    => $user['photo']
                ];
                $pdo->prepare("UPDATE users SET last_login=NOW() WHERE id=?")->execute([$user['id']]);
                header('Location: ?page=dashboard'); exit;
            }
            return 'Invalid credentials. Please try again.';
        } catch (Exception $e) { return 'Login error: '.$e->getMessage(); }
    }
    return null;
}

function handleLogout() { session_destroy(); header('Location: ?page=login'); exit; }

// ============================================================
// TABLE CONFIG  (type='image' triggers file upload widget)
// ============================================================
function getTableConfig() {
    return [
        'about_us' => [
            'label'=>'About Us','icon'=>'bi-info-circle','group'=>'Content',
            'fields' => [
                'title'             => ['type'=>'text',     'label'=>'Title',             'required'=>true],
                'content'           => ['type'=>'textarea', 'label'=>'Content',           'required'=>false],
                'mission_statement' => ['type'=>'textarea', 'label'=>'Mission Statement', 'required'=>false],
                'vision'            => ['type'=>'textarea', 'label'=>'Vision',            'required'=>false],
                'objectives'        => ['type'=>'textarea', 'label'=>'Objectives',        'required'=>false],
                'core_values'       => ['type'=>'textarea', 'label'=>'Core Values',       'required'=>false],
                'hero_image'        => ['type'=>'image',    'label'=>'Hero Image',        'required'=>false, 'upload_dir'=>'about'],
                'meta_description'  => ['type'=>'textarea', 'label'=>'Meta Description',  'required'=>false],
                'active'            => ['type'=>'toggle',   'label'=>'Active',            'required'=>false],
            ],
            'list_cols'=>['id','title','active','updated_at'],
        ],
        'admin_quotation_items' => [
            'label'=>'Quotation Items','icon'=>'bi-cart','group'=>'Quotations',
            'fields' => [
                'item_name'      => ['type'=>'text',   'label'=>'Item Name',  'required'=>true],
                'price'          => ['type'=>'number', 'label'=>'Price',      'required'=>true],
                'car_name'       => ['type'=>'text',   'label'=>'Car Name',   'required'=>false],
                'car_model'      => ['type'=>'text',   'label'=>'Car Model',  'required'=>false],
                'car_year'       => ['type'=>'number', 'label'=>'Car Year',   'required'=>false],
                'image_filename' => ['type'=>'image',  'label'=>'Item Image', 'required'=>false, 'upload_dir'=>'quotation_items'],
                'active'         => ['type'=>'toggle', 'label'=>'Active',     'required'=>false],
                'order'          => ['type'=>'number', 'label'=>'Order',      'required'=>false],
            ],
            'list_cols'=>['id','item_name','price','car_name','active','created_at'],
        ],
        'company_contact' => [
            'label'=>'Company Contact','icon'=>'bi-building','group'=>'Settings',
            'fields' => [
                'phone_number'          => ['type'=>'text',    'label'=>'Phone',        'required'=>false],
                'email_address'         => ['type'=>'email',   'label'=>'Email',        'required'=>false],
                'physical_address'      => ['type'=>'textarea','label'=>'Address',      'required'=>false],
                'physical_address_link' => ['type'=>'text',    'label'=>'Address Link', 'required'=>false],
                'address_iframe_link'   => ['type'=>'textarea','label'=>'Map iFrame',   'required'=>false],
            ],
            'list_cols'=>['id','phone_number','email_address','updated_at'],
        ],
        'contact_us' => [
            'label'=>'Contact Messages','icon'=>'bi-envelope','group'=>'Communications','readonly'=>true,
            'fields' => [
                'name'    => ['type'=>'text',    'label'=>'Name',    'required'=>false],
                'email'   => ['type'=>'email',   'label'=>'Email',   'required'=>false],
                'subject' => ['type'=>'text',    'label'=>'Subject', 'required'=>false],
                'message' => ['type'=>'textarea','label'=>'Message', 'required'=>false],
            ],
            'list_cols'=>['id','name','email','subject','created_at'],
        ],
        'faq' => [
            'label'=>'FAQ','icon'=>'bi-question-circle','group'=>'Content',
            'fields' => [
                'title'          => ['type'=>'text',    'label'=>'Title',  'required'=>true],
                'description'    => ['type'=>'textarea','label'=>'Answer', 'required'=>false],
                'image_filename' => ['type'=>'image',   'label'=>'Image',  'required'=>false, 'upload_dir'=>'faq'],
                'order'          => ['type'=>'number',  'label'=>'Order',  'required'=>false],
                'active'         => ['type'=>'toggle',  'label'=>'Active', 'required'=>false],
            ],
            'list_cols'=>['id','title','order','active','created_at'],
        ],
        'gallery_images' => [
            'label'=>'Gallery','icon'=>'bi-images','group'=>'Media',
            'fields' => [
                'title'          => ['type'=>'text',    'label'=>'Title',       'required'=>false],
                'description'    => ['type'=>'textarea','label'=>'Description', 'required'=>false],
                'image_filename' => ['type'=>'image',   'label'=>'Image',       'required'=>true, 'upload_dir'=>'gallery'],
                'order'          => ['type'=>'number',  'label'=>'Order',       'required'=>false],
                'active'         => ['type'=>'toggle',  'label'=>'Active',      'required'=>false],
            ],
            'list_cols'=>['id','title','order','active','created_at'],
        ],
        'logos' => [
            'label'=>'Logos','icon'=>'bi-badge','group'=>'Media',
            'fields' => [
                'title'          => ['type'=>'text',   'label'=>'Title',     'required'=>true],
                'alt_text'       => ['type'=>'text',   'label'=>'Alt Text',  'required'=>false],
                'image_filename' => ['type'=>'image',  'label'=>'Logo Image','required'=>true, 'upload_dir'=>'logos'],
                'placement'      => ['type'=>'select', 'label'=>'Placement', 'required'=>false,
                    'options'=>['both'=>'Both','header'=>'Header','footer'=>'Footer']],
                'active'         => ['type'=>'toggle', 'label'=>'Active',    'required'=>false],
                'order'          => ['type'=>'number', 'label'=>'Order',     'required'=>false],
            ],
            'list_cols'=>['id','title','placement','active','order'],
        ],
        'navbar' => [
            'label'=>'Navigation','icon'=>'bi-list','group'=>'Settings',
            'fields' => [
                'label'     => ['type'=>'text',         'label'=>'Label',      'required'=>true],
                'link'      => ['type'=>'text',         'label'=>'Link',       'required'=>false],
                'parent_id' => ['type'=>'navbar_parent','label'=>'Parent Item', 'required'=>false],
                'order'     => ['type'=>'number',       'label'=>'Order',      'required'=>false],
                'active'    => ['type'=>'toggle',       'label'=>'Active',     'required'=>false],
            ],
            'list_cols'=>['id','label','link','parent_id','order','active'],
        ],
        'newsletter_subscribers' => [
            'label'=>'Newsletter','icon'=>'bi-newspaper','group'=>'Communications',
            'fields' => [
                'email'  => ['type'=>'email',  'label'=>'Email',  'required'=>true],
                'status' => ['type'=>'select', 'label'=>'Status', 'required'=>false,
                    'options'=>['subscribed'=>'Subscribed','unsubscribed'=>'Unsubscribed']],
            ],
            'list_cols'=>['id','email','status','subscribed_at'],
        ],
        'products' => [
            'label'=>'Products','icon'=>'bi-box','group'=>'Shop',
            'fields' => [
                'title'          => ['type'=>'text',    'label'=>'Title',        'required'=>true],
                'slug'           => ['type'=>'text',    'label'=>'Slug',         'required'=>false],
                'description'    => ['type'=>'textarea','label'=>'Description',  'required'=>false],
                'price'          => ['type'=>'number',  'label'=>'Price',        'required'=>false],
                'image_filename' => ['type'=>'image',   'label'=>'Product Image','required'=>false, 'upload_dir'=>'products'],
                'category'       => ['type'=>'text',    'label'=>'Category',     'required'=>false],
                'stock'          => ['type'=>'number',  'label'=>'Stock',        'required'=>false],
                'active'         => ['type'=>'toggle',  'label'=>'Active',       'required'=>false],
                'order'          => ['type'=>'number',  'label'=>'Order',        'required'=>false],
            ],
            'list_cols'=>['id','title','price','category','stock','active'],
        ],
        'quotations' => [
            'label'=>'Quotations','icon'=>'bi-file-text','group'=>'Quotations',
            'fields' => [
                'quote_number'       => ['type'=>'text',    'label'=>'Quote #',        'required'=>false],
                'customer_name'      => ['type'=>'text',    'label'=>'Customer Name',  'required'=>true],
                'email'              => ['type'=>'email',   'label'=>'Email',          'required'=>false],
                'phone'              => ['type'=>'text',    'label'=>'Phone',          'required'=>false],
                'address'            => ['type'=>'textarea','label'=>'Address',        'required'=>false],
                'vehicle_make'       => ['type'=>'text',    'label'=>'Vehicle Make',   'required'=>false],
                'vehicle_model'      => ['type'=>'text',    'label'=>'Vehicle Model',  'required'=>false],
                'vehicle_year'       => ['type'=>'number',  'label'=>'Vehicle Year',   'required'=>false],
                'vehicle_vin'        => ['type'=>'text',    'label'=>'VIN',            'required'=>false],
                'mileage'            => ['type'=>'text',    'label'=>'Mileage',        'required'=>false],
                'license_plate'      => ['type'=>'text',    'label'=>'License Plate',  'required'=>false],
                'color'              => ['type'=>'text',    'label'=>'Color',          'required'=>false],
                'issues_description' => ['type'=>'textarea','label'=>'Issues',         'required'=>false],
                'subtotal'           => ['type'=>'number',  'label'=>'Subtotal',       'required'=>false],
                'tax_rate'           => ['type'=>'number',  'label'=>'Tax Rate',       'required'=>false],
                'tax_amount'         => ['type'=>'number',  'label'=>'Tax Amount',     'required'=>false],
                'total'              => ['type'=>'number',  'label'=>'Total',          'required'=>false],
                'notes'              => ['type'=>'textarea','label'=>'Notes',          'required'=>false],
                'status'             => ['type'=>'select',  'label'=>'Status',         'required'=>false,
                    'options'=>['pending'=>'Pending','approved'=>'Approved','rejected'=>'Rejected','completed'=>'Completed']],
            ],
            'list_cols'=>['id','quote_number','customer_name','total','status','created_at'],
        ],
        'quotations_items' => [
            'label'=>'Quote Line Items','icon'=>'bi-list-ol','group'=>'Quotations',
            'fields' => [
                'quotation_id' => ['type'=>'number',  'label'=>'Quotation ID','required'=>true],
                'item_type'    => ['type'=>'text',    'label'=>'Item Type',   'required'=>false],
                'service_name' => ['type'=>'text',    'label'=>'Service',     'required'=>false],
                'description'  => ['type'=>'textarea','label'=>'Description', 'required'=>false],
                'quantity'     => ['type'=>'number',  'label'=>'Qty',         'required'=>false],
                'unit_price'   => ['type'=>'number',  'label'=>'Unit Price',  'required'=>false],
                'line_total'   => ['type'=>'number',  'label'=>'Line Total',  'required'=>false],
            ],
            'list_cols'=>['id','quotation_id','service_name','quantity','unit_price','line_total'],
        ],
        'services' => [
            'label'=>'Services','icon'=>'bi-tools','group'=>'Content',
            'fields' => [
                'title'       => ['type'=>'text',    'label'=>'Title',       'required'=>true],
                'slug'        => ['type'=>'text',    'label'=>'Slug',        'required'=>false],
                'description' => ['type'=>'textarea','label'=>'Description', 'required'=>false],
                'image1'      => ['type'=>'image',   'label'=>'Image 1',     'required'=>false, 'upload_dir'=>'services'],
                'image2'      => ['type'=>'image',   'label'=>'Image 2',     'required'=>false, 'upload_dir'=>'services'],
                'image3'      => ['type'=>'image',   'label'=>'Image 3',     'required'=>false, 'upload_dir'=>'services'],
                'image4'      => ['type'=>'image',   'label'=>'Image 4',     'required'=>false, 'upload_dir'=>'services'],
                'image5'      => ['type'=>'image',   'label'=>'Image 5',     'required'=>false, 'upload_dir'=>'services'],
                'active'      => ['type'=>'toggle',  'label'=>'Active',      'required'=>false],
            ],
            'list_cols'=>['id','title','active','created_at'],
        ],
        'slideshow' => [
            'label'=>'Slideshow','icon'=>'bi-display','group'=>'Media',
            'fields' => [
                'title'          => ['type'=>'text',   'label'=>'Title',       'required'=>false],
                'subtitle'       => ['type'=>'text',   'label'=>'Subtitle',    'required'=>false],
                'image_filename' => ['type'=>'image',  'label'=>'Slide Image', 'required'=>true, 'upload_dir'=>'slideshow'],
                'button_text'    => ['type'=>'text',   'label'=>'Button Text', 'required'=>false],
                'button_link'    => ['type'=>'text',   'label'=>'Button Link', 'required'=>false],
                'order'          => ['type'=>'number', 'label'=>'Order',       'required'=>false],
                'active'         => ['type'=>'toggle', 'label'=>'Active',      'required'=>false],
            ],
            'list_cols'=>['id','title','order','active'],
        ],
        'social_links' => [
            'label'=>'Social Links','icon'=>'bi-share','group'=>'Settings',
            'fields' => [
                'platform'        => ['type'=>'text',   'label'=>'Platform',        'required'=>true],
                'url'             => ['type'=>'text',   'label'=>'URL',             'required'=>true],
                'icon_class'      => ['type'=>'text',   'label'=>'Icon Class',      'required'=>false],
                'show_in_nav'     => ['type'=>'toggle', 'label'=>'Show in Nav',     'required'=>false],
                'show_in_footer'  => ['type'=>'toggle', 'label'=>'Show in Footer',  'required'=>false],
                'show_in_contact' => ['type'=>'toggle', 'label'=>'Show in Contact', 'required'=>false],
                'active'          => ['type'=>'toggle', 'label'=>'Active',          'required'=>false],
                'order'           => ['type'=>'number', 'label'=>'Order',           'required'=>false],
            ],
            'list_cols'=>['id','platform','url','active','order'],
        ],
        'team_members' => [
            'label'=>'Team','icon'=>'bi-people','group'=>'Content',
            'fields' => [
                'name'            => ['type'=>'text',   'label'=>'Name',           'required'=>true],
                'role'            => ['type'=>'text',   'label'=>'Role',           'required'=>false],
                'contact_number'  => ['type'=>'text',   'label'=>'Contact',        'required'=>false],
                'photo_url'       => ['type'=>'image',  'label'=>'Photo',          'required'=>false, 'upload_dir'=>'company'],
                'linkedin_url'    => ['type'=>'text',   'label'=>'LinkedIn URL',   'required'=>false],
                'twitter_url'     => ['type'=>'text',   'label'=>'Twitter URL',    'required'=>false],
                'instagram_url'   => ['type'=>'text',   'label'=>'Instagram URL',  'required'=>false],
                'facebook_url'    => ['type'=>'text',   'label'=>'Facebook URL',   'required'=>false],
                'whatsapp_number' => ['type'=>'text',   'label'=>'WhatsApp',       'required'=>false],
                'order'           => ['type'=>'number', 'label'=>'Order',          'required'=>false],
                'active'          => ['type'=>'toggle', 'label'=>'Active',         'required'=>false],
            ],
            'list_cols'=>['id','name','role','active','order'],
        ],
        'testimonials' => [
            'label'=>'Testimonials','icon'=>'bi-chat-quote','group'=>'Content',
            'fields' => [
                'name'           => ['type'=>'text',    'label'=>'Name',          'required'=>true],
                'position'       => ['type'=>'text',    'label'=>'Position',      'required'=>false],
                'company'        => ['type'=>'text',    'label'=>'Company',       'required'=>false],
                'photo_filename' => ['type'=>'image',   'label'=>'Photo',         'required'=>false, 'upload_dir'=>'testimonials'],
                'content'        => ['type'=>'textarea','label'=>'Content',       'required'=>false],
                'rating'         => ['type'=>'number',  'label'=>'Rating (1-5)',  'required'=>false],
                'show_on_pages'  => ['type'=>'text',    'label'=>'Show on Pages', 'required'=>false],
                'active'         => ['type'=>'toggle',  'label'=>'Active',        'required'=>false],
                'order'          => ['type'=>'number',  'label'=>'Order',         'required'=>false],
            ],
            'list_cols'=>['id','name','company','rating','active'],
        ],
        'text_slideshow' => [
            'label'=>'Text Slideshow','icon'=>'bi-type','group'=>'Media',
            'fields' => [
                'description' => ['type'=>'textarea','label'=>'Description','required'=>true],
                'order'       => ['type'=>'number',  'label'=>'Order',      'required'=>false],
                'active'      => ['type'=>'toggle',  'label'=>'Active',     'required'=>false],
            ],
            'list_cols'=>['id','description','order','active'],
        ],
        'users' => [
            'label'=>'Users','icon'=>'bi-person-badge','group'=>'System',
            'fields' => [
                'username' => ['type'=>'text',     'label'=>'Username',      'required'=>true],
                'password' => ['type'=>'password', 'label'=>'Password',      'required'=>false, 'hint'=>'Leave blank to keep current password'],
                'email'    => ['type'=>'email',    'label'=>'Email',         'required'=>true],
                'photo'    => ['type'=>'image',    'label'=>'Avatar Photo',  'required'=>false, 'upload_dir'=>'users'],
                'role'     => ['type'=>'select',   'label'=>'Role',          'required'=>false,
                    'options'=>['admin'=>'Admin','editor'=>'Editor','viewer'=>'Viewer']],
                'active'   => ['type'=>'toggle',   'label'=>'Active',        'required'=>false],
            ],
            'list_cols'=>['id','username','email','role','active','last_login'],
        ],
        'videos' => [
            'label'=>'Videos','icon'=>'bi-play-circle','group'=>'Media',
            'fields' => [
                'title'              => ['type'=>'text',    'label'=>'Title',         'required'=>true],
                'description'        => ['type'=>'textarea','label'=>'Description',   'required'=>false],
                'video_url'          => ['type'=>'text',    'label'=>'Video URL',     'required'=>true],
                'thumbnail_filename' => ['type'=>'image',   'label'=>'Thumbnail',     'required'=>false, 'upload_dir'=>'thumbnails'],
                'show_on_pages'      => ['type'=>'text',    'label'=>'Show on Pages', 'required'=>false],
                'order'              => ['type'=>'number',  'label'=>'Order',         'required'=>false],
                'active'             => ['type'=>'toggle',  'label'=>'Active',        'required'=>false],
            ],
            'list_cols'=>['id','title','order','active','created_at'],
        ],
    ];
}

// ============================================================
// CRUD AJAX
// ============================================================
function handleAjax() {
    header('Content-Type: application/json');
    if (!isLoggedIn()) { echo json_encode(['error'=>'Unauthorized']); exit; }

    $action  = $_POST['action'] ?? $_GET['action'] ?? '';
    $table   = $_POST['table']  ?? $_GET['table']  ?? '';
    $tables  = getTableConfig();
    $uploads = getUploadConfig();

    if (!array_key_exists($table, $tables)) { echo json_encode(['error'=>'Invalid table']); exit; }
    $cfg = $tables[$table];

    try {
        $pdo = getDB();

        // ── LIST ──────────────────────────────────────────────
        if ($action === 'list') {
            $page   = max(1,(int)($_GET['p']??1));
            $limit  = 20;
            $offset = ($page-1)*$limit;
            $search = trim($_GET['q']??'');
            $where  = ''; $params = [];

            if ($search) {
                $cols  = $cfg['list_cols'];
                $parts = array_map(fn($c)=>"`$c` LIKE ?", $cols);
                $where = 'WHERE '.implode(' OR ',$parts);
                $params = array_fill(0, count($cols), "%$search%");
            }

            $count = (int)$pdo->prepare("SELECT COUNT(*) FROM `$table` $where")->execute($params) ?
                $pdo->prepare("SELECT COUNT(*) FROM `$table` $where") : null;
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM `$table` $where");
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT * FROM `$table` $where ORDER BY id DESC LIMIT $limit OFFSET $offset");
            $stmt->execute($params);
            $rows = $stmt->fetchAll();

            // Append image preview URLs
            if (isset($uploads[$table])) {
                $imgFields = $uploads[$table]['fields'];
                $subdir    = $uploads[$table]['subdir'];
                foreach ($rows as &$row) {
                    foreach ($imgFields as $f) {
                        if (!empty($row[$f])) {
                            $row[$f.'__url'] = UPLOADS_URL.'/'.$subdir.'/'.$row[$f];
                        }
                    }
                }
                unset($row);
            }

            echo json_encode(['rows'=>$rows,'total'=>$total,'page'=>$page,'pages'=>ceil($total/$limit)]);

        // ── GET ONE ───────────────────────────────────────────
        } elseif ($action === 'get') {
            $id   = (int)($_GET['id']??0);
            $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id=?");
            $stmt->execute([$id]);
            $row  = $stmt->fetch() ?: [];

            if ($row && isset($uploads[$table])) {
                foreach ($uploads[$table]['fields'] as $f) {
                    if (!empty($row[$f])) {
                        $row[$f.'__url'] = UPLOADS_URL.'/'.$uploads[$table]['subdir'].'/'.$row[$f];
                    }
                }
            }
            echo json_encode($row);

        // ── CREATE ────────────────────────────────────────────
        } elseif ($action === 'create') {
            $data = buildData($cfg['fields'], $_POST, true);

            // Handle image uploads
            if (isset($uploads[$table])) {
                foreach ($uploads[$table]['fields'] as $f) {
                    $uploaded = handleFileUpload($f, $uploads[$table]['subdir']);
                    if ($uploaded !== null) $data[$f] = $uploaded;
                }
            }

            // bcrypt for users
            if ($table === 'users' && !empty($data['password'])) {
                $data['password'] = password_hash($data['password'], PASSWORD_DEFAULT);
            }

            if (empty($data)) { echo json_encode(['error'=>'No data to insert']); exit; }
            $cols   = implode(',', array_map(fn($k)=>"`$k`", array_keys($data)));
            $places = implode(',', array_fill(0, count($data), '?'));
            $pdo->prepare("INSERT INTO `$table` ($cols) VALUES ($places)")->execute(array_values($data));
            echo json_encode(['success'=>true,'id'=>$pdo->lastInsertId()]);

        // ── UPDATE ────────────────────────────────────────────
        } elseif ($action === 'update') {
            $id   = (int)($_POST['id']??0);
            $data = buildData($cfg['fields'], $_POST, false);

            // Handle image uploads — only overwrite if a new file was sent
            if (isset($uploads[$table])) {
                foreach ($uploads[$table]['fields'] as $f) {
                    $uploaded = handleFileUpload($f, $uploads[$table]['subdir']);
                    if ($uploaded !== null) $data[$f] = $uploaded;
                    // If null → no new file → keep existing in DB (don't touch $data[$f])
                }
            }

            // Password: only update if provided
            if ($table === 'users') {
                if (!empty($data['password'])) {
                    $data['password'] = password_hash($data['password'], PASSWORD_DEFAULT);
                } else {
                    unset($data['password']);
                }
            }

            // Auto updated_at if column exists
            try {
                $cols = array_column($pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(), 'Field');
                if (in_array('updated_at', $cols)) $data['updated_at'] = date('Y-m-d H:i:s');
            } catch (Exception $e) {}

            if (empty($data)) { echo json_encode(['success'=>true]); exit; }
            $sets = implode(',', array_map(fn($k)=>"`$k`=?", array_keys($data)));
            $vals = array_values($data);
            $vals[] = $id;
            $pdo->prepare("UPDATE `$table` SET $sets WHERE id=?")->execute($vals);
            echo json_encode(['success'=>true]);

        // ── DELETE ────────────────────────────────────────────
        } elseif ($action === 'delete') {
            $id = (int)($_POST['id']??0);
            $pdo->prepare("DELETE FROM `$table` WHERE id=?")->execute([$id]);
            echo json_encode(['success'=>true]);

        } elseif ($action === 'navbar_parents') {
            $excludeId = (int)($_GET['exclude']??0);
            echo json_encode(getNavbarParents($excludeId));

        } else {
        }
    } catch (Exception $e) {
        echo json_encode(['error'=>$e->getMessage()]);
    }
    exit;
}

function buildData($fields, $post, $isCreate) {
    $data = [];
    foreach ($fields as $key => $cfg) {
        if ($cfg['type'] === 'image')    continue; // handled separately by handleFileUpload
        if ($cfg['type'] === 'password' && empty($post[$key])) continue;
        if ($cfg['type'] === 'toggle') {
            $data[$key] = isset($post[$key]) ? 1 : 0;
        } elseif ($cfg['type'] === 'navbar_parent') {
            // Store as null when empty (top-level), otherwise as integer
            $data[$key] = (!isset($post[$key]) || $post[$key] === '') ? null : (int)$post[$key];
        } elseif (isset($post[$key])) {
            $data[$key] = $post[$key];
        }
    }
    if ($isCreate) $data['created_at'] = date('Y-m-d H:i:s');
    return $data;
}

// ============================================================
// DASHBOARD STATS
// ============================================================
function getDashboardStats() {
    try {
        $pdo = getDB(); $s = [];
        foreach (['products','services','quotations','contact_us','newsletter_subscribers','users','gallery_images','team_members'] as $t) {
            try { $s[$t] = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn(); }
            catch (Exception $e) { $s[$t] = '—'; }
        }
        try { $s['recent_quotes']   = $pdo->query("SELECT quote_number,customer_name,total,status,created_at FROM quotations ORDER BY created_at DESC LIMIT 5")->fetchAll(); }
        catch (Exception $e) { $s['recent_quotes'] = []; }
        try { $s['recent_contacts'] = $pdo->query("SELECT name,email,subject,created_at FROM contact_us ORDER BY created_at DESC LIMIT 5")->fetchAll(); }
        catch (Exception $e) { $s['recent_contacts'] = []; }
        return $s;
    } catch (Exception $e) { return []; }
}

// ============================================================
// NAVBAR PARENTS (for the parent_id dropdown)
// ============================================================
function getNavbarParents($excludeId = 0) {
    try {
        $pdo  = getDB();
        $stmt = $pdo->prepare("SELECT id, label FROM navbar WHERE parent_id IS NULL AND id != ? ORDER BY `order` ASC, label ASC");
        $stmt->execute([$excludeId]);
        return $stmt->fetchAll();
    } catch (Exception $e) { return []; }
}


$page = $_GET['page'] ?? 'dashboard';
if (isset($_GET['ajax']))                                     { handleAjax(); exit; }
if (isset($_POST['action']) && $_POST['action'] === 'login') { $loginError = handleLogin(); $page = 'login'; }
if (isset($_GET['logout']))                                   { handleLogout(); }
if ($page !== 'login') requireLogin();

$tables       = getTableConfig();
$currentTable = $_GET['table'] ?? null;
$groups       = [];
foreach ($tables as $key => $cfg) $groups[$cfg['group']][$key] = $cfg;

// Build upload-fields map for JS
$tableUploadFields = [];
foreach ($tables as $tKey => $tCfg) {
    foreach ($tCfg['fields'] as $fKey => $fCfg) {
        if ($fCfg['type'] === 'image') {
            $tableUploadFields[$tKey][] = $fKey;
        }
    }
}

// Navbar parent labels (for resolving parent_id → name in table view)
$navbarParentLabels = [];
try {
    $pdo = getDB();
    $navRows = $pdo->query("SELECT id, label, parent_id, `order`, active FROM navbar ORDER BY `order` ASC, label ASC")->fetchAll();
    foreach ($navRows as $nr) {
        $navbarParentLabels[$nr['id']] = $nr['label'];
    }
    // Build tree for sidebar display: roots + their children
    $navTree = [];
    $navById = [];
    foreach ($navRows as $nr) { $navById[$nr['id']] = array_merge($nr, ['children'=>[]]); }
    foreach ($navRows as $nr) {
        if ($nr['parent_id'] && isset($navById[$nr['parent_id']])) {
            $navById[$nr['parent_id']]['children'][] = &$navById[$nr['id']];
        } else {
            $navTree[] = &$navById[$nr['id']];
        }
    }
    unset($navById);
} catch (Exception $e) {
    $navbarParentLabels = [];
    $navTree = [];
}

// Fetch active logo for login page
$siteLogo = null;
try {
    $pdo = getDB();
    $logoRow = $pdo->query(
        "SELECT image_filename, title, alt_text FROM logos WHERE active=1 ORDER BY `order` ASC, id ASC LIMIT 1"
    )->fetch();
    if ($logoRow && !empty($logoRow['image_filename'])) {
        $siteLogo = $logoRow;
    }
} catch (Exception $e) { $siteLogo = null; }

?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
<style>
:root {
    --bg:#0d0f14;--bg2:#13161d;--bg3:#1a1e28;--bg4:#1f2436;
    --border:#2a2f42;--border2:#353b52;
    --accent:#4f8ef7;--accent2:#6ea3ff;--accent-glow:rgba(79,142,247,0.2);
    --success:#2dd4bf;--warning:#f59e0b;--danger:#f87171;
    --text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;
    --sidebar-w:260px;--radius:10px;--radius-sm:6px;
    --shadow:0 4px 24px rgba(0,0,0,0.4);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;line-height:1.6}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:99px}

/* LOGIN */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e8f0fe 0%,#f0f4ff 40%,#e2eafc 100%)}
.login-card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:48px 44px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.35),0 0 0 1px rgba(79,142,247,0.12)}
.login-site-logo{text-align:center;margin-bottom:24px}
.login-site-logo img{max-height:64px;max-width:200px;object-fit:contain;display:inline-block}
.login-logo{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:var(--accent);letter-spacing:-0.5px;margin-bottom:8px}
.login-sub{color:var(--text2);font-size:14px;margin-bottom:32px}
.login-card .form-label{color:var(--text2)}
.login-card .form-control{background:var(--bg3);border-color:var(--border);color:var(--text)}

/* LAYOUT */
.layout{display:flex;min-height:100vh}

/* SIDEBAR NAV GROUPS (collapsible) */
.nav-group{overflow:hidden}
.nav-group-header{display:flex;align-items:center;justify-content:space-between;padding:9px 20px;cursor:pointer;user-select:none;transition:background 0.15s;border:none;background:none;width:100%;color:var(--text3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.nav-group-header:hover{background:var(--bg3);color:var(--text2)}
.nav-group-header .chevron{font-size:11px;transition:transform 0.2s;color:var(--text3)}
.nav-group-items{overflow:hidden;transition:max-height 0.25s ease,opacity 0.2s ease;max-height:600px;opacity:1}
.nav-group-items.collapsed{max-height:0;opacity:0}

/* SIDEBAR */
.sidebar{width:var(--sidebar-w);background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:100;transition:transform 0.3s ease}
.sidebar-brand{padding:22px 20px 16px;font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--accent);letter-spacing:-0.3px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.sidebar-brand i{font-size:20px}
.sidebar-nav{flex:1;padding:12px 0}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 20px;color:var(--text2);text-decoration:none;transition:all 0.15s ease;font-size:13.5px;position:relative}
.nav-item:hover{color:var(--text);background:var(--bg3)}
.nav-item.active{color:var(--accent2);background:rgba(79,142,247,0.1)}
.nav-item.active::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent);border-radius:0 3px 3px 0}
.nav-item i{font-size:15px;width:18px;text-align:center}
.sidebar-footer{padding:16px 20px;border-top:1px solid var(--border)}
.sidebar-user{display:flex;align-items:center;gap:10px}
.user-avatar{width:34px;height:34px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden}
.user-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.user-info{flex:1;min-width:0}
.user-name{font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-role{font-size:11px;color:var(--text3)}
.profile-btn{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 5px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);cursor:pointer;transition:all 0.15s;min-width:0}
.profile-btn:hover{border-color:var(--border2);background:var(--bg4)}
.profile-btn .tb-avatar{width:28px;height:28px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden}
.profile-btn .tb-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.profile-btn .tb-name{font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px}
.profile-btn .tb-caret{font-size:11px;color:var(--text3);transition:transform 0.2s;flex-shrink:0}
.profile-dropdown-wrap{position:relative}
.profile-dropdown{
    position:absolute;top:calc(100% + 8px);right:0;
    background:var(--bg2);border:1px solid var(--border);border-radius:10px;
    width:200px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    opacity:0;pointer-events:none;transform:translateY(-6px);
    transition:opacity 0.15s,transform 0.15s;
    z-index:200;overflow:hidden;
}
.profile-dropdown.open{opacity:1;pointer-events:all;transform:translateY(0)}
.profile-dropdown-header{padding:14px 16px;border-bottom:1px solid var(--border);background:var(--bg3)}
.profile-dropdown-header .pd-name{font-weight:600;font-size:14px;color:var(--text)}
.profile-dropdown-header .pd-role{font-size:11px;color:var(--text3);margin-top:2px}
.profile-dropdown a,.profile-dropdown button{
    display:flex;align-items:center;gap:10px;
    padding:10px 16px;width:100%;text-align:left;
    font-family:inherit;font-size:13.5px;color:var(--text2);
    background:none;border:none;cursor:pointer;text-decoration:none;
    transition:background 0.12s,color 0.12s;
}
.profile-dropdown a:hover,.profile-dropdown button:hover{background:var(--bg3);color:var(--text)}
.profile-dropdown .pd-danger{color:var(--danger)!important}
.profile-dropdown .pd-danger:hover{background:rgba(248,113,113,0.1)!important}
.profile-dropdown i{font-size:15px;width:16px;text-align:center}
.profile-dropdown-divider{border:none;border-top:1px solid var(--border);margin:0}

/* LOGOUT CONFIRM (reuse confirm overlay styles but specific id) */

/* MAIN */
.main{margin-left:var(--sidebar-w);flex:1;display:flex;flex-direction:column;min-height:100vh}
/* Topbar: sticky at top, never clips children (no overflow:hidden) */
.topbar{
    background:var(--bg2);
    border-bottom:1px solid var(--border);
    padding:0 28px;
    height:58px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    position:sticky;
    top:0;
    z-index:300;   /* above sidebar backdrop(99), sidebar(200), modals(900) — but dropdown is a child so it just needs position:absolute */
    flex-shrink:0;
    width:100%;
    box-sizing:border-box;
}
.topbar-left{display:flex;align-items:center;gap:12px;min-width:0;flex:1;overflow:hidden}
.topbar h1{font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.content{padding:28px;flex:1}

/* CARDS */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.card-header{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.card-title{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:600}
.card-body{padding:22px}

/* STAT CARDS */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:28px}
.stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;position:relative;overflow:hidden}
.stat-card::after{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:var(--accent-glow)}
.stat-label{font-size:12px;color:var(--text2);margin-bottom:6px;font-weight:500}
.stat-val{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:var(--text)}
.stat-icon{font-size:18px;color:var(--accent);margin-bottom:10px}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--radius-sm);border:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:500;transition:all 0.15s ease;text-decoration:none;white-space:nowrap;line-height:1}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent2)}
.btn-danger{background:rgba(248,113,113,0.15);color:var(--danger);border:1px solid rgba(248,113,113,0.25)}.btn-danger:hover{background:rgba(248,113,113,0.25)}
.btn-secondary{background:var(--bg3);color:var(--text2);border:1px solid var(--border)}.btn-secondary:hover{color:var(--text);border-color:var(--border2)}
.btn-success{background:rgba(45,212,191,0.15);color:var(--success);border:1px solid rgba(45,212,191,0.25)}
.btn-sm{padding:5px 10px;font-size:12px}.btn-icon{padding:6px 8px}

/* FORMS */
.form-group{margin-bottom:18px}
.form-label{display:block;font-size:13px;font-weight:500;color:var(--text2);margin-bottom:6px}
.form-label .req{color:var(--danger)}
.form-hint{font-size:11px;color:var(--text3);margin-top:4px}
.form-control{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;color:var(--text);font-family:inherit;font-size:13.5px;outline:none;transition:border-color 0.15s,box-shadow 0.15s}
.form-control:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,142,247,0.12)}
textarea.form-control{resize:vertical;min-height:90px}
select.form-control option{background:var(--bg3)}

/* ── IMAGE UPLOAD WIDGET ────────────────────────────────── */
.img-upload-wrap{
    border:2px dashed var(--border);
    border-radius:var(--radius-sm);
    overflow:hidden;
    background:var(--bg3);
    transition:border-color 0.2s;
}
.img-upload-wrap:hover,.img-upload-wrap.drag-over{border-color:var(--accent);border-style:solid}
.img-preview-area{
    min-height:130px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;
    padding:4px;
    position:relative;
}
.img-preview-area:hover{background:rgba(79,142,247,0.04)}
.img-preview-area img{
    max-width:100%;max-height:220px;
    object-fit:contain;
    border-radius:calc(var(--radius-sm) - 2px);
    display:block;
}
.img-placeholder{
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:8px;padding:28px 20px;color:var(--text3);text-align:center;width:100%;
}
.img-placeholder i{font-size:32px;color:var(--border2)}
.img-placeholder strong{font-size:13px;color:var(--text2);display:block;margin-bottom:2px}
.img-placeholder span{font-size:11px}
.img-bar{
    display:flex;align-items:center;justify-content:space-between;gap:8px;
    padding:8px 12px;
    border-top:1px solid var(--border);
    background:var(--bg4);
}
.img-filename{font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.img-bar-actions{display:flex;gap:6px;flex-shrink:0}
.img-btn{
    display:inline-flex;align-items:center;gap:4px;
    padding:4px 10px;font-size:11px;font-family:inherit;
    border-radius:4px;cursor:pointer;transition:background 0.15s;border:1px solid transparent;
}
.img-btn-choose{background:rgba(79,142,247,0.15);color:var(--accent2);border-color:rgba(79,142,247,0.2)}
.img-btn-choose:hover{background:rgba(79,142,247,0.28)}
.img-btn-clear{background:rgba(248,113,113,0.12);color:var(--danger);border-color:rgba(248,113,113,0.18)}
.img-btn-clear:hover{background:rgba(248,113,113,0.25)}
.img-file-input{display:none}

/* Thumbnail in table rows */
.tbl-thumb{width:38px;height:38px;border-radius:6px;object-fit:cover;border:1px solid var(--border);vertical-align:middle}

/* TOGGLE */
.toggle-wrap{display:flex;align-items:center;gap:10px}
.toggle{position:relative;width:40px;height:22px;cursor:pointer}
.toggle input{opacity:0;width:0;height:0}
.toggle-track{position:absolute;inset:0;background:var(--bg4);border-radius:99px;border:1px solid var(--border2);transition:all 0.2s}
.toggle input:checked+.toggle-track{background:var(--accent);border-color:var(--accent)}
.toggle-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform 0.2s}
.toggle input:checked~.toggle-thumb{transform:translateX(18px)}

/* SEARCH */
.search-wrap{position:relative}
.search-wrap i{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:14px}
.search-input{padding-left:34px!important;max-width:260px}

/* TABLE */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px}
thead th{padding:12px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.7px;color:var(--text3);border-bottom:1px solid var(--border);white-space:nowrap;background:var(--bg3)}
tbody tr{border-bottom:1px solid var(--border);transition:background 0.1s}
tbody tr:hover{background:var(--bg3)}
tbody tr:last-child{border-bottom:none}
tbody td{padding:11px 16px;color:var(--text2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}
tbody td:first-child{color:var(--text3);font-size:12px}
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.badge-success{background:rgba(45,212,191,0.15);color:var(--success)}
.badge-danger{background:rgba(248,113,113,0.12);color:var(--danger)}
.badge-warning{background:rgba(245,158,11,0.15);color:var(--warning)}
.badge-info{background:rgba(79,142,247,0.15);color:var(--accent2)}

/* PAGINATION */
.pagination{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.page-btn{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:13px;transition:all 0.15s}
.page-btn:hover{border-color:var(--accent);color:var(--accent)}
.page-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.page-btn:disabled{opacity:0.4;cursor:default}

/* MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity 0.2s}
.modal-overlay.open{opacity:1;pointer-events:all}
.modal{background:var(--bg2);border:1px solid var(--border);border-radius:14px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,0.6);transform:translateY(16px) scale(0.97);transition:transform 0.25s}
.modal-overlay.open .modal{transform:translateY(0) scale(1)}
.modal-lg{max-width:860px}
.modal-header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.modal-title{font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:600}
.modal-close{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all 0.15s}
.modal-close:hover{color:var(--text);border-color:var(--border2)}
.modal-body{padding:24px;overflow-y:auto;flex:1}
.modal-footer{padding:16px 24px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:flex-end;gap:10px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
.form-grid .form-group-full{grid-column:1/-1}

/* VIEW MODAL */
.view-grid{display:grid;gap:0}
.view-row{display:grid;grid-template-columns:160px 1fr;padding:10px 0;border-bottom:1px solid var(--border);gap:16px;align-items:start}
.view-row:last-child{border-bottom:none}
.view-key{font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;padding-top:2px}
.view-val{color:var(--text);font-size:13.5px;word-break:break-word}
.view-img{max-width:180px;max-height:130px;object-fit:contain;border-radius:6px;border:1px solid var(--border);display:block;margin-bottom:4px}

/* DELETE CONFIRM */
.confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity 0.2s}
.confirm-overlay.open{opacity:1;pointer-events:all}
.confirm-box{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:32px 32px 24px;max-width:400px;width:100%;text-align:center;transform:scale(0.93) translateY(12px);transition:transform 0.25s;box-shadow:0 24px 80px rgba(0,0,0,0.6)}
.confirm-overlay.open .confirm-box{transform:scale(1) translateY(0)}
.confirm-icon{width:60px;height:60px;border-radius:50%;background:rgba(248,113,113,0.1);border:2px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:26px;color:var(--danger)}
.confirm-title{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;margin-bottom:8px}
.confirm-text{color:var(--text2);font-size:14px;margin-bottom:28px;line-height:1.5}
.confirm-btns{display:flex;gap:12px;justify-content:center}
.confirm-btns .btn{min-width:120px;justify-content:center}

/* TOAST */
#toast-container{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px}
.toast{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 18px;display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:500;color:var(--text);box-shadow:var(--shadow);animation:slideUp 0.25s ease;max-width:320px}
.toast.toast-success{border-left:3px solid var(--success)}
.toast.toast-error{border-left:3px solid var(--danger)}
.toast i.bi-check-circle-fill{color:var(--success)}
.toast i.bi-x-circle-fill{color:var(--danger)}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

.empty-state{text-align:center;padding:48px 24px;color:var(--text3)}
.empty-state i{font-size:36px;margin-bottom:12px;display:block}
.loading{display:flex;align-items:center;gap:10px;padding:24px;color:var(--text3);justify-content:center}
.spinner{width:18px;height:18px;border:2px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.dash-table-wrap{overflow-x:auto}
.dash-table{font-size:13px}
.dash-table th{font-size:10px}
.dash-table td{padding:9px 14px}
.alert{padding:12px 16px;border-radius:var(--radius-sm);font-size:13.5px;margin-bottom:20px;border:1px solid transparent}
.alert-danger{background:rgba(248,113,113,0.1);border-color:rgba(248,113,113,0.25);color:var(--danger)}
.breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);margin-bottom:20px}
.breadcrumb a{color:var(--accent);text-decoration:none}
.breadcrumb a:hover{text-decoration:underline}
.actions-cell{white-space:nowrap;display:flex;gap:4px}

/* ── CORE LAYOUT: prevent horizontal scroll without breaking sticky ── */
html { overflow-x: hidden; }
body { overflow-x: hidden; max-width: 100%; }
/* Do NOT put overflow on .main — it breaks position:sticky on topbar */
.main { min-width: 0; }
.content { min-width: 0; box-sizing: border-box; }
.card-header { flex-wrap: wrap; }

/* Only the table wrapper scrolls horizontally */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* Sidebar overlay backdrop on mobile */
.sidebar-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99;
}
.sidebar-backdrop.show { display: block; }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
    :root { --sidebar-w: 0px; }

    /* Sidebar slides in over content */
    .sidebar { transform: translateX(-260px); width: 260px; z-index: 200; }
    .sidebar.open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.5); }

    /* Main fills full width */
    .main { margin-left: 0; width: 100%; }

    /* Topbar stays sticky and never overflows */
    .topbar { padding: 0 12px; gap: 8px; }
    .topbar h1 { font-size: 15px; }

    /* Profile button: hide name on small screens */
    .profile-btn .tb-name { display: none; }

    /* Profile dropdown anchors to right edge */
    .profile-dropdown { right: 0; left: auto; width: 190px; }

    /* Content padding */
    .content { padding: 14px; }

    /* Stats: 2 columns */
    .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }

    /* Dashboard 2-col → 1-col */
    div[style*="grid-template-columns:1fr 1fr"] { display: block !important; }
    div[style*="grid-template-columns:1fr 1fr"] > * + * { margin-top: 16px; }

    /* Form grid: single column */
    .form-grid { grid-template-columns: 1fr !important; }
    .form-grid .form-group-full { grid-column: 1; }

    /* Search input: full width */
    .search-input { max-width: 100% !important; width: 100%; }
    .card-header .search-wrap { flex: 1; min-width: 0; }

    /* Modals: bottom sheet on mobile */
    .modal-overlay { padding: 0; align-items: flex-end; }
    .modal, .modal.modal-lg {
        max-width: 100%;
        border-radius: 16px 16px 0 0;
        max-height: 92vh;
    }

    /* Confirm popups */
    .confirm-box { padding: 24px 20px 18px; }
}

@media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .stat-card { padding: 14px 16px; }
    .stat-val { font-size: 22px; }
    .topbar { height: 52px; }
    .content { padding: 10px; }
}
</style>
</head>
<body>

<?php if ($page === 'login'): ?>
<!-- ======================================================= LOGIN -->
<div class="login-wrap">
  <div class="login-card">

    <?php if ($siteLogo): ?>
    <!-- Logo from logos table: uploads/logos/<?= htmlspecialchars($siteLogo['image_filename']) ?> -->
    <div class="login-site-logo">
      <img src="<?= htmlspecialchars(UPLOADS_URL.'/logos/'.$siteLogo['image_filename']) ?>"
           alt="<?= htmlspecialchars($siteLogo['alt_text'] ?: ($siteLogo['title'] ?: 'Logo')) ?>"
           onerror="this.style.display='none'">
    </div>
    <?php endif; ?>

    <div class="login-logo"><i class="bi bi-shield-check"></i> AdminPanel</div>
    <p class="login-sub">Sign in to your account</p>
    <?php if (!empty($loginError)): ?>
      <div class="alert alert-danger"><i class="bi bi-exclamation-circle"></i> <?= htmlspecialchars($loginError) ?></div>
    <?php endif; ?>
    <form method="post" autocomplete="on">
      <input type="hidden" name="action" value="login">
      <div class="form-group">
        <label class="form-label">Username or Email</label>
        <input type="text" name="username" class="form-control" placeholder="Enter username or email" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" name="password" class="form-control" placeholder="Enter password" required>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:11px">
        <i class="bi bi-box-arrow-in-right"></i> Sign In
      </button>
    </form>
  </div>
</div>

<?php else: ?>
<!-- ======================================================= MAIN LAYOUT -->
<div class="layout">

  <!-- Mobile sidebar backdrop -->
  <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="closeSidebar()"></div>

  <!-- SIDEBAR -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand"><i class="bi bi-shield-check"></i> AdminPanel</div>
    <nav class="sidebar-nav">
      <a href="?page=dashboard" class="nav-item <?= $page==='dashboard'&&!$currentTable?'active':'' ?>">
        <i class="bi bi-speedometer2"></i> Dashboard
      </a>
      <?php foreach ($groups as $groupName => $groupTables):
        $groupActive = false;
        foreach ($groupTables as $gKey => $gCfg) { if ($currentTable===$gKey) { $groupActive=true; break; } }
      ?>
        <div class="nav-group">
          <button class="nav-group-header" onclick="toggleNavGroup(this)">
            <?= htmlspecialchars($groupName) ?>
            <i class="bi bi-chevron-down chevron"></i>
          </button>
          <div class="nav-group-items <?= $groupActive?'':'collapsed' ?>">
            <?php foreach ($groupTables as $key => $cfg): ?>
              <a href="?page=table&table=<?= $key ?>" class="nav-item <?= $currentTable===$key?'active':'' ?>" style="padding-left:28px">
                <i class="bi <?= $cfg['icon'] ?>"></i> <?= htmlspecialchars($cfg['label']) ?>
              </a>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar">
          <?php if (!empty($_SESSION['admin_user']['photo'])): ?>
            <img src="<?= htmlspecialchars(UPLOADS_URL.'/users/'.$_SESSION['admin_user']['photo']) ?>" alt="avatar">
          <?php else: ?>
            <?= strtoupper(substr($_SESSION['admin_user']['username']??'A',0,1)) ?>
          <?php endif; ?>
        </div>
        <div class="user-info">
          <div class="user-name"><?= htmlspecialchars($_SESSION['admin_user']['username']??'') ?></div>
          <div class="user-role"><?= htmlspecialchars($_SESSION['admin_user']['role']??'') ?></div>
        </div>
      </div>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="main">
    <header class="topbar">
      <div class="topbar-left">
        <button class="btn btn-icon btn-secondary" id="sidebarToggle"><i class="bi bi-list"></i></button>
        <?php if ($page==='dashboard'): ?><h1>Dashboard</h1>
        <?php elseif ($currentTable && isset($tables[$currentTable])): ?><h1><?= htmlspecialchars($tables[$currentTable]['label']) ?></h1>
        <?php endif; ?>
      </div>
      <div class="topbar-right">
        <span style="font-size:12px;color:var(--text3)"><?= date('D, d M Y') ?></span>

        <!-- Profile dropdown -->
        <div class="profile-dropdown-wrap" id="profileWrap">
          <button class="profile-btn" onclick="toggleProfileDropdown()">
            <div class="tb-avatar">
              <?php if (!empty($_SESSION['admin_user']['photo'])): ?>
                <img src="<?= htmlspecialchars(UPLOADS_URL.'/users/'.$_SESSION['admin_user']['photo']) ?>" alt="">
              <?php else: ?>
                <?= strtoupper(substr($_SESSION['admin_user']['username']??'A',0,1)) ?>
              <?php endif; ?>
            </div>
            <span class="tb-name"><?= htmlspecialchars($_SESSION['admin_user']['username']??'') ?></span>
            <i class="bi bi-chevron-down tb-caret" id="profileCaret"></i>
          </button>
          <div class="profile-dropdown" id="profileDropdown">
            <div class="profile-dropdown-header">
              <div class="pd-name"><?= htmlspecialchars($_SESSION['admin_user']['username']??'') ?></div>
              <div class="pd-role"><?= htmlspecialchars(ucfirst($_SESSION['admin_user']['role']??'')) ?></div>
            </div>
            <?php
              // Find this user's record in users table
              $myUserId = $_SESSION['admin_user']['id'] ?? 0;
            ?>
            <a href="?page=table&table=users" onclick="closeProfileDropdown()">
              <i class="bi bi-people"></i> Manage Users
            </a>
            <hr class="profile-dropdown-divider">
            <button class="pd-danger" onclick="closeProfileDropdown();openLogoutConfirm()">
              <i class="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="content">

      <?php if ($page==='dashboard'): ?>
      <!-- ================================================== DASHBOARD -->
      <?php $stats = getDashboardStats(); ?>
      <div class="stats-grid">
        <?php foreach ([
          ['products','bi-box','Products'],['services','bi-tools','Services'],
          ['quotations','bi-file-text','Quotations'],['contact_us','bi-envelope','Messages'],
          ['newsletter_subscribers','bi-newspaper','Subscribers'],['users','bi-people','Users'],
          ['gallery_images','bi-images','Gallery'],['team_members','bi-person-badge','Team'],
        ] as [$k,$ic,$lb]): ?>
        <div class="stat-card">
          <div class="stat-icon"><i class="bi <?= $ic ?>"></i></div>
          <div class="stat-label"><?= $lb ?></div>
          <div class="stat-val"><?= $stats[$k]??'—' ?></div>
        </div>
        <?php endforeach; ?>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="bi bi-file-text" style="color:var(--accent);margin-right:6px"></i>Recent Quotations</span>
            <a href="?page=table&table=quotations" class="btn btn-secondary btn-sm">View All</a>
          </div>
          <div class="table-wrap dash-table-wrap"><table class="dash-table">
            <thead><tr><th>Quote #</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              <?php if (empty($stats['recent_quotes'])): ?>
                <tr><td colspan="5"><div class="empty-state" style="padding:20px"><i class="bi bi-inbox"></i>No quotations</div></td></tr>
              <?php else: foreach ($stats['recent_quotes'] as $q): ?>
                <tr>
                  <td><?= htmlspecialchars($q['quote_number']??'') ?></td>
                  <td><?= htmlspecialchars($q['customer_name']??'') ?></td>
                  <td><?= number_format((float)($q['total']??0),2) ?></td>
                  <td><?php $sc=match($q['status']??''){'approved'=>'badge-success','rejected'=>'badge-danger','completed'=>'badge-info',default=>'badge-warning'}; echo "<span class='badge $sc'>".htmlspecialchars($q['status'])."</span>"; ?></td>
                  <td><?= $q['created_at']?date('d M Y',strtotime($q['created_at'])):'—' ?></td>
                </tr>
              <?php endforeach; endif; ?>
            </tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="bi bi-envelope" style="color:var(--accent);margin-right:6px"></i>Recent Messages</span>
            <a href="?page=table&table=contact_us" class="btn btn-secondary btn-sm">View All</a>
          </div>
          <div class="table-wrap dash-table-wrap"><table class="dash-table">
            <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Date</th></tr></thead>
            <tbody>
              <?php if (empty($stats['recent_contacts'])): ?>
                <tr><td colspan="4"><div class="empty-state" style="padding:20px"><i class="bi bi-inbox"></i>No messages</div></td></tr>
              <?php else: foreach ($stats['recent_contacts'] as $c): ?>
                <tr>
                  <td><?= htmlspecialchars($c['name']??'') ?></td>
                  <td><?= htmlspecialchars($c['email']??'') ?></td>
                  <td><?= htmlspecialchars(substr($c['subject']??'',0,30)).(strlen($c['subject']??'')>30?'…':'') ?></td>
                  <td><?= $c['created_at']?date('d M Y',strtotime($c['created_at'])):'—' ?></td>
                </tr>
              <?php endforeach; endif; ?>
            </tbody>
          </table></div>
        </div>
      </div>

      <?php elseif ($page==='table' && $currentTable && isset($tables[$currentTable])): ?>
      <!-- ================================================== TABLE VIEW -->
      <?php $tblCfg=$tables[$currentTable]; $readonly=!empty($tblCfg['readonly']); ?>
      <div class="breadcrumb">
        <a href="?page=dashboard">Dashboard</a>
        <i class="bi bi-chevron-right" style="font-size:10px"></i>
        <span><?= htmlspecialchars($tblCfg['label']) ?></span>
      </div>

      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap">
            <span class="card-title"><i class="bi <?= $tblCfg['icon'] ?>" style="color:var(--accent);margin-right:6px"></i><?= htmlspecialchars($tblCfg['label']) ?></span>
            <div class="search-wrap">
              <i class="bi bi-search"></i>
              <input type="text" id="searchInput" class="form-control search-input" placeholder="Search…">
            </div>
          </div>
          <?php if (!$readonly): ?>
          <button class="btn btn-primary" onclick="openCreate()"><i class="bi bi-plus-lg"></i> Add New</button>
          <?php endif; ?>
        </div>
        <div id="tableContainer"><div class="loading"><div class="spinner"></div> Loading…</div></div>
        <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <span id="tableInfo" style="font-size:12px;color:var(--text3)"></span>
          <div class="pagination" id="pagination"></div>
        </div>
      </div>

      <!-- ADD/EDIT MODAL -->
      <div class="modal-overlay" id="formModal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title" id="modalTitle">Add Record</span>
            <button class="modal-close" onclick="closeModal('formModal')"><i class="bi bi-x"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-grid" id="modalFormGrid"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
            <button class="btn btn-primary" id="modalSaveBtn" onclick="saveRecord()"><i class="bi bi-check-lg"></i> Save</button>
          </div>
        </div>
      </div>

      <!-- VIEW MODAL -->
      <div class="modal-overlay" id="viewModal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">View Record</span>
            <button class="modal-close" onclick="closeModal('viewModal')"><i class="bi bi-x"></i></button>
          </div>
          <div class="modal-body" id="viewModalBody"></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('viewModal')">Close</button>
            <?php if (!$readonly): ?>
            <button class="btn btn-primary" id="viewEditBtn"><i class="bi bi-pencil"></i> Edit</button>
            <?php endif; ?>
          </div>
        </div>
      </div>

      <?php endif; ?>
    </div><!-- /content -->
  </main>
</div><!-- /layout -->

<!-- DELETE CONFIRM -->
<div class="confirm-overlay" id="confirmDelete">
  <div class="confirm-box">
    <div class="confirm-icon"><i class="bi bi-trash3"></i></div>
    <div class="confirm-title">Delete Record</div>
    <div class="confirm-text">Are you sure you want to delete this record?<br>This action <strong>cannot be undone</strong>.</div>
    <div class="confirm-btns">
      <button class="btn btn-secondary" onclick="closeConfirm()">Cancel</button>
      <button class="btn btn-danger" id="confirmDeleteBtn"><i class="bi bi-trash3"></i> Delete</button>
    </div>
  </div>
</div>

<!-- LOGOUT CONFIRM -->
<div class="confirm-overlay" id="logoutConfirm">
  <div class="confirm-box">
    <div class="confirm-icon" style="background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.25);color:var(--warning)"><i class="bi bi-box-arrow-right"></i></div>
    <div class="confirm-title">Sign Out</div>
    <div class="confirm-text">Are you sure you want to log out of the admin panel?</div>
    <div class="confirm-btns">
      <button class="btn btn-secondary" onclick="closeLogoutConfirm()">Cancel</button>
      <a href="?logout=1" class="btn btn-danger"><i class="bi bi-box-arrow-right"></i> Yes, Log Out</a>
    </div>
  </div>
</div>

<div id="toast-container"></div>

<script>
// ── GLOBALS ──────────────────────────────────────────────────────────
const TABLE       = <?= json_encode($currentTable) ?>;
const TABLE_CFG   = <?= json_encode($tables[$currentTable] ?? null) ?>;
const READONLY    = <?= json_encode(!empty($tables[$currentTable]['readonly'] ?? false)) ?>;
const UPLOADS_URL = <?= json_encode(UPLOADS_URL) ?>;
const IMG_FIELDS  = <?= json_encode($tableUploadFields) ?>;
// Map of navbar id → label for resolving parent_id display
const NAVBAR_LABELS = <?= json_encode($navbarParentLabels) ?>;

let currentPage   = 1;
let currentSearch = '';
let editingId     = null;
let deleteId      = null;
// Cache of navbar parents fetched for the form dropdown
let navbarParentsCache = null;

// ── SIDEBAR TOGGLE ────────────────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    const sidebar   = document.getElementById('sidebar');
    const backdrop  = document.getElementById('sidebarBackdrop');
    const isOpen    = sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('show', isOpen);
});

function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarBackdrop')?.classList.remove('show');
}

function toggleNavGroup(header) {
    const items   = header.nextElementSibling;
    const chevron = header.querySelector('.chevron');
    const collapsed = items.classList.toggle('collapsed');
    chevron.style.transform = collapsed ? '' : 'rotate(180deg)';
}

// Initialise chevron states on load
document.querySelectorAll('.nav-group-header').forEach(header => {
    const items = header.nextElementSibling;
    const chevron = header.querySelector('.chevron');
    if (!items.classList.contains('collapsed')) {
        chevron.style.transform = 'rotate(180deg)';
    }
});

// Close sidebar when a nav link is tapped on mobile
document.querySelectorAll('.sidebar .nav-item').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 768) closeSidebar();
    });
});

// ── PROFILE DROPDOWN ─────────────────────────────────────────────────
function toggleProfileDropdown() {
    const dd    = document.getElementById('profileDropdown');
    const caret = document.getElementById('profileCaret');
    const open  = dd.classList.toggle('open');
    caret.style.transform = open ? 'rotate(180deg)' : '';
}
function closeProfileDropdown() {
    document.getElementById('profileDropdown').classList.remove('open');
    document.getElementById('profileCaret').style.transform = '';
}
document.addEventListener('click', e => {
    const wrap = document.getElementById('profileWrap');
    if (wrap && !wrap.contains(e.target)) closeProfileDropdown();
});

// ── LOGOUT CONFIRM ────────────────────────────────────────────────────
function openLogoutConfirm()  { document.getElementById('logoutConfirm').classList.add('open'); }
function closeLogoutConfirm() { document.getElementById('logoutConfirm').classList.remove('open'); }
document.getElementById('logoutConfirm')?.addEventListener('click', e => {
    if (e.target === document.getElementById('logoutConfirm')) closeLogoutConfirm();
});

// ── LOAD TABLE ───────────────────────────────────────────────────────
function loadTable(page=1, search='') {
    currentPage=page; currentSearch=search;
    const container=document.getElementById('tableContainer');
    if(!container) return;
    container.innerHTML='<div class="loading"><div class="spinner"></div> Loading…</div>';
    fetch(`?ajax=1&action=list&table=${TABLE}&p=${page}&q=${encodeURIComponent(search)}`)
        .then(r=>r.json())
        .then(data=>{
            if(data.error){container.innerHTML=`<div class="empty-state"><i class="bi bi-exclamation-circle"></i>${data.error}</div>`;return;}
            renderTable(data);
        })
        .catch(()=>{container.innerHTML='<div class="empty-state"><i class="bi bi-wifi-off"></i>Failed to load</div>';});
}

// ── RENDER TABLE ─────────────────────────────────────────────────────
function renderTable(data) {
    const container  = document.getElementById('tableContainer');
    const cols       = TABLE_CFG.list_cols;
    const imgFields  = IMG_FIELDS[TABLE] || [];

    if (!data.rows || data.rows.length===0) {
        container.innerHTML='<div class="empty-state"><i class="bi bi-inbox"></i><p>No records found</p></div>';
        document.getElementById('tableInfo').textContent='0 records';
        document.getElementById('pagination').innerHTML='';
        return;
    }

    // For navbar: build an indented display (parents first, children indented)
    let rows = data.rows;
    if (TABLE === 'navbar') {
        // Sort: parents first, then children under their parent
        const parents  = rows.filter(r=>!r.parent_id);
        const children = rows.filter(r=> r.parent_id);
        const sorted   = [];
        parents.forEach(p=>{
            sorted.push(p);
            children.filter(c=>c.parent_id==p.id).forEach(c=>sorted.push(c));
        });
        // Children without a matched parent at end
        children.filter(c=>!parents.find(p=>p.id==c.parent_id)).forEach(c=>sorted.push(c));
        rows = sorted;
    }

    let html='<div class="table-wrap"><table><thead><tr>';
    cols.forEach(c=>{html+=`<th>${c.replace(/_/g,' ').toUpperCase()}</th>`;});
    html+='<th>ACTIONS</th></tr></thead><tbody>';

    rows.forEach(row=>{
        const isChild = TABLE==='navbar' && row.parent_id;
        html+=`<tr${isChild?' style="background:rgba(79,142,247,0.03)"':''}>`;
        cols.forEach(col=>{
            const val  = row[col] ?? '';
            const sval = String(val);

            if (imgFields.includes(col)) {
                const src = row[col+'__url'] || '';
                if (src) {
                    html += `<td><img src="${htmlE(src)}" class="tbl-thumb" alt="img" loading="lazy"></td>`;
                } else if (val) {
                    html += `<td><span style="font-size:11px;color:var(--text3)">${htmlE(sval.substring(0,30))}</span></td>`;
                } else {
                    html += `<td><span style="color:var(--text3)">—</span></td>`;
                }
            } else if (col==='parent_id' && TABLE==='navbar') {
                if (val && NAVBAR_LABELS[val]) {
                    html+=`<td><span style="font-size:11px"><i class="bi bi-arrow-return-right" style="color:var(--accent);margin-right:4px"></i>${htmlE(NAVBAR_LABELS[val])}</span></td>`;
                } else {
                    html+=`<td><span style="color:var(--text3);font-size:11px">—</span></td>`;
                }
            } else if (col==='label' && TABLE==='navbar' && isChild) {
                html+=`<td><span style="padding-left:18px;display:inline-flex;align-items:center;gap:6px"><i class="bi bi-dash" style="color:var(--text3)"></i>${htmlE(sval)}</span></td>`;
            } else if (['active','show_in_nav','show_in_footer','show_in_contact'].includes(col)) {
                html += `<td>${parseInt(val)===1
                    ?'<span class="badge badge-success"><i class="bi bi-check-lg"></i> Active</span>'
                    :'<span class="badge badge-danger"><i class="bi bi-x-lg"></i> Inactive</span>'}</td>`;
            } else if (col==='status') {
                const cls={pending:'badge-warning',approved:'badge-success',rejected:'badge-danger',completed:'badge-info',subscribed:'badge-success',unsubscribed:'badge-danger'}[val]||'badge-info';
                html+=`<td><span class="badge ${cls}">${htmlE(sval)}</span></td>`;
            } else if (col==='rating') {
                html+=`<td>${'★'.repeat(Math.max(0,Math.min(5,parseInt(val)||0)))}</td>`;
            } else {
                html+=`<td>${sval.length>45?htmlE(sval.substring(0,45))+'…':htmlE(sval)}</td>`;
            }
        });
        html+=`<td><div class="actions-cell">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="viewRecord(${row.id})" title="View"><i class="bi bi-eye"></i></button>
            ${!READONLY?`
            <button class="btn btn-primary btn-sm btn-icon" onclick="editRecord(${row.id})" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="confirmDelete(${row.id})" title="Delete"><i class="bi bi-trash3"></i></button>`:''}
        </div></td></tr>`;
    });
    html+='</tbody></table></div>';
    container.innerHTML=html;
    document.getElementById('tableInfo').textContent=
        `Showing ${((currentPage-1)*20)+1}–${Math.min(currentPage*20,data.total)} of ${data.total} records`;
    renderPagination(data.page,data.pages);
}

function renderPagination(page,pages) {
    const el=document.getElementById('pagination');
    if(pages<=1){el.innerHTML='';return;}
    let h='';
    h+=`<button class="page-btn" onclick="loadTable(${page-1},'${currentSearch}')" ${page<=1?'disabled':''}>‹</button>`;
    const s=Math.max(1,page-2),e=Math.min(pages,page+2);
    if(s>1) h+=`<button class="page-btn" onclick="loadTable(1,'${currentSearch}')">1</button>${s>2?'<span style="color:var(--text3);padding:0 4px">…</span>':''}`;
    for(let i=s;i<=e;i++) h+=`<button class="page-btn ${i===page?'active':''}" onclick="loadTable(${i},'${currentSearch}')">${i}</button>`;
    if(e<pages) h+=`${e<pages-1?'<span style="color:var(--text3);padding:0 4px">…</span>':''}<button class="page-btn" onclick="loadTable(${pages},'${currentSearch}')">${pages}</button>`;
    h+=`<button class="page-btn" onclick="loadTable(${page+1},'${currentSearch}')" ${page>=pages?'disabled':''}>›</button>`;
    el.innerHTML=h;
}

// ── SEARCH ───────────────────────────────────────────────────────────
let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', function(){
    clearTimeout(searchTimeout);
    searchTimeout=setTimeout(()=>loadTable(1,this.value),350);
});

// ── MODAL HELPERS ────────────────────────────────────────────────────
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(el=>{
    el.addEventListener('click',e=>{if(e.target===el)closeModal(el.id);});
});

// ── IMAGE UPLOAD WIDGET ──────────────────────────────────────────────
// Creates a rich upload widget with drag-drop, preview and clear button.
// On edit, shows the existing image with option to replace.
function buildImageWidget(fieldKey, existingFilename, existingUrl) {
    const wId  = 'imgw_'  + fieldKey;   // wrapper
    const pId  = 'imgp_'  + fieldKey;   // preview area
    const fId  = 'imgfi_' + fieldKey;   // file input
    const nId  = 'imgn_'  + fieldKey;   // filename label

    const hasImg = existingFilename && existingFilename !== '' && existingFilename !== 'null';
    const src    = hasImg && existingUrl ? htmlE(existingUrl) : '';

    return `
<div class="img-upload-wrap" id="${wId}"
     ondragover="imgDragOver(event,'${wId}')"
     ondragleave="imgDragLeave('${wId}')"
     ondrop="imgDrop(event,'${wId}','${fieldKey}','${fId}','${pId}','${nId}')">

    <div class="img-preview-area" id="${pId}" onclick="document.getElementById('${fId}').click()">
        ${src
            ? `<img src="${src}" alt="preview">`
            : `<div class="img-placeholder">
                   <i class="bi bi-cloud-upload"></i>
                   <strong>Click or drag &amp; drop to upload</strong>
                   <span>JPG · PNG · WebP · GIF · SVG &nbsp;·&nbsp; max 10 MB</span>
               </div>`
        }
    </div>

    <div class="img-bar">
        <span class="img-filename" id="${nId}">${hasImg ? htmlE(existingFilename) : 'No file chosen'}</span>
        <div class="img-bar-actions">
            <button type="button" class="img-btn img-btn-choose" onclick="document.getElementById('${fId}').click()">
                <i class="bi bi-folder2-open"></i> Browse
            </button>
            <button type="button" class="img-btn img-btn-clear"
                    onclick="imgClear('${wId}','${fId}','${pId}','${nId}')">
                <i class="bi bi-x"></i> Remove
            </button>
        </div>
    </div>

    <input type="file" id="${fId}" name="${fieldKey}" class="img-file-input"
           accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
           onchange="imgChosen(this,'${pId}','${nId}')">
</div>`;
}

function imgChosen(input, pId, nId) {
    const file = input.files[0];
    if (!file) return;
    const url  = URL.createObjectURL(file);
    document.getElementById(pId).innerHTML = `<img src="${url}" alt="preview">`;
    document.getElementById(nId).textContent = file.name;
}

function imgClear(wId, fId, pId, nId) {
    document.getElementById(fId).value = '';
    document.getElementById(pId).innerHTML = `<div class="img-placeholder">
        <i class="bi bi-cloud-upload"></i>
        <strong>Click or drag &amp; drop to upload</strong>
        <span>JPG · PNG · WebP · GIF · SVG &nbsp;·&nbsp; max 10 MB</span>
    </div>`;
    document.getElementById(nId).textContent = 'No file chosen';
}

function imgDragOver(e, wId) {
    e.preventDefault();
    document.getElementById(wId).classList.add('drag-over');
}
function imgDragLeave(wId) {
    document.getElementById(wId).classList.remove('drag-over');
}
function imgDrop(e, wId, fieldKey, fId, pId, nId) {
    e.preventDefault();
    document.getElementById(wId).classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) { toast('Please drop an image file','error'); return; }
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById(fId);
    input.files  = dt.files;
    imgChosen(input, pId, nId);
}

// ── NAVBAR PARENT LOADER ─────────────────────────────────────────────
async function loadNavbarParentOptions(selectId, currentVal, excludeId) {
    try {
        if (!navbarParentsCache) {
            const r = await fetch(`?ajax=1&action=navbar_parents&table=navbar&exclude=${excludeId}`);
            navbarParentsCache = await r.json();
        }
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = '<option value="">— None (Top-level item) —</option>';
        (navbarParentsCache || []).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.label;
            if (String(p.id) === String(currentVal)) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch(e) {
        console.warn('Could not load navbar parents', e);
    }
}

// ── BUILD FORM ───────────────────────────────────────────────────────
function buildForm(record={}) {
    const grid  = document.getElementById('modalFormGrid');
    grid.innerHTML = '';
    const fields = TABLE_CFG.fields;

    Object.entries(fields).forEach(([key, cfg])=>{
        const val = record[key] ?? '';

        // Full-width conditions
        const wideFieldTypes = ['textarea'];
        const wideFieldKeys  = ['description','content','issues_description','address_iframe_link',
                                'core_values','objectives','mission_statement','vision',
                                'meta_description','notes','message'];
        const isFull = cfg.type==='image'
                    || wideFieldTypes.includes(cfg.type)
                    || wideFieldKeys.includes(key);
        const gc = isFull ? 'form-group form-group-full' : 'form-group';

        let input='';

        if (cfg.type==='image') {
            const existingUrl = record[key+'__url'] || '';
            input = buildImageWidget(key, String(val), existingUrl);

        } else if (cfg.type==='navbar_parent') {
            // Build select from cached/fetched navbar parents
            input = `<select name="${key}" id="f_${key}" class="form-control">
                <option value="">— None (Top-level item) —</option>
                <option value="__loading__" disabled>Loading…</option>
            </select>`;
            // Load parents asynchronously after DOM insert
            setTimeout(()=>loadNavbarParentOptions('f_'+key, val, editingId||0), 50);

        } else if (cfg.type==='textarea') {
            input=`<textarea name="${key}" id="f_${key}" class="form-control" ${cfg.required?'required':''}>${htmlE(String(val))}</textarea>`;

        } else if (cfg.type==='toggle') {
            const chk = parseInt(val)===1 || val===true || val==='1' ? 'checked':'';
            input=`<div class="toggle-wrap">
                <label class="toggle">
                    <input type="checkbox" name="${key}" id="f_${key}" value="1" ${chk}>
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                </label>
                <span style="font-size:13px;color:var(--text2)">${htmlE(cfg.label)}</span>
            </div>`;

        } else if (cfg.type==='select') {
            const opts = Object.entries(cfg.options||{}).map(([v,l])=>
                `<option value="${htmlE(v)}" ${String(val)===v?'selected':''}>${htmlE(l)}</option>`).join('');
            input=`<select name="${key}" id="f_${key}" class="form-control" ${cfg.required?'required':''}>
                <option value="">— Select —</option>${opts}</select>`;

        } else {
            input=`<input type="${cfg.type}" name="${key}" id="f_${key}" class="form-control"
                       value="${htmlE(String(val))}"
                       ${cfg.required?'required':''}
                       placeholder="${htmlE(cfg.label)}">`;
        }

        grid.innerHTML+=`<div class="${gc}">
            ${cfg.type!=='toggle'?`<label class="form-label" for="f_${key}">${htmlE(cfg.label)}${cfg.required?'<span class="req"> *</span>':''}</label>`:''}
            ${input}
            ${cfg.hint?`<div class="form-hint">${htmlE(cfg.hint)}</div>`:''}
        </div>`;
    });
}

// ── OPEN CREATE ──────────────────────────────────────────────────────
function openCreate() {
    editingId=null;
    navbarParentsCache=null; // refresh parent list
    document.getElementById('modalTitle').textContent='Add New Record';
    buildForm({});
    openModal('formModal');
}

// ── EDIT ─────────────────────────────────────────────────────────────
function editRecord(id) {
    editingId=id;
    document.getElementById('modalTitle').textContent='Edit Record';
    document.getElementById('modalFormGrid').innerHTML='<div class="loading"><div class="spinner"></div></div>';
    openModal('formModal');
    fetch(`?ajax=1&action=get&table=${TABLE}&id=${id}`)
        .then(r=>r.json())
        .then(data=>buildForm(data))
        .catch(()=>toast('Failed to load record','error'));
}

// ── VIEW ─────────────────────────────────────────────────────────────
function viewRecord(id) {
    const body=document.getElementById('viewModalBody');
    body.innerHTML='<div class="loading"><div class="spinner"></div></div>';
    openModal('viewModal');
    const imgFields=IMG_FIELDS[TABLE]||[];

    fetch(`?ajax=1&action=get&table=${TABLE}&id=${id}`)
        .then(r=>r.json())
        .then(data=>{
            let html='<div class="view-grid">';
            Object.entries(data).forEach(([k,v])=>{
                if(k.endsWith('__url')) return; // skip helper keys
                const urlKey = k+'__url';
                const sv     = String(v??'');

                if (imgFields.includes(k)) {
                    // Always show image if a URL helper exists, otherwise construct from filename
                    const src = data[urlKey] || (sv ? (UPLOADS_URL+'/'+getUploadSubdir(k)+'/'+sv) : '');
                    html+=`<div class="view-row">
                        <div class="view-key">${htmlE(k)}</div>
                        <div class="view-val">
                            ${src ? `<img src="${htmlE(src)}" class="view-img" alt="${htmlE(k)}" loading="lazy" onerror="this.style.display='none'">` : ''}
                            ${sv ? `<span style="font-size:11px;color:var(--text3);display:block;margin-top:4px">${htmlE(sv)}</span>` : '<span style="color:var(--text3)">—</span>'}
                        </div>
                    </div>`;
                } else if (k==='parent_id' && TABLE==='navbar') {
                    const parentName = v && NAVBAR_LABELS[v] ? NAVBAR_LABELS[v] : null;
                    html+=`<div class="view-row">
                        <div class="view-key">${htmlE(k)}</div>
                        <div class="view-val">${parentName ? htmlE(parentName)+' <span style="color:var(--text3);font-size:11px">(id:'+htmlE(sv)+')</span>' : (sv||'<span style="color:var(--text3)">—</span>')}</div>
                    </div>`;
                } else {
                    const dv=sv.length>400?htmlE(sv.substring(0,400))+'…':htmlE(sv);
                    html+=`<div class="view-row">
                        <div class="view-key">${htmlE(k)}</div>
                        <div class="view-val">${dv||'<span style="color:var(--text3)">—</span>'}</div>
                    </div>`;
                }
            });
            html+='</div>';
            body.innerHTML=html;
            const editBtn=document.getElementById('viewEditBtn');
            if(editBtn) editBtn.onclick=()=>{closeModal('viewModal');editRecord(id);};
        })
        .catch(()=>{body.innerHTML='<div class="empty-state"><i class="bi bi-x-circle"></i>Failed to load</div>';});
}

// Helper: get upload subdir per table+field (used as fallback in view modal)
function getUploadSubdir(fieldKey) {
    // Use table-specific mapping first
    const tableMap = {
        about_us:              {hero_image:'about'},
        admin_quotation_items: {image_filename:'quotation_items'},
        faq:                   {image_filename:'faq'},
        gallery_images:        {image_filename:'gallery'},
        logos:                 {image_filename:'logos'},
        products:              {image_filename:'products'},
        services:              {image1:'services',image2:'services',image3:'services',image4:'services',image5:'services'},
        slideshow:             {image_filename:'slideshow'},
        team_members:          {photo_url:'company'},
        testimonials:          {photo_filename:'testimonials'},
        users:                 {photo:'users'},
        videos:                {thumbnail_filename:'thumbnails'},
    };
    if (TABLE && tableMap[TABLE] && tableMap[TABLE][fieldKey]) return tableMap[TABLE][fieldKey];
    // Generic fallback
    const generic={hero_image:'about',photo_url:'company',photo_filename:'testimonials',
        photo:'users',thumbnail_filename:'thumbnails',
        image1:'services',image2:'services',image3:'services',image4:'services',image5:'services'};
    return generic[fieldKey]||'gallery';
}

// ── SAVE  (multipart/form-data so files are included) ────────────────
function saveRecord() {
    const btn    = document.getElementById('modalSaveBtn');
    const fields = TABLE_CFG.fields;

    // Validate required text/select fields
    for(const [key,cfg] of Object.entries(fields)){
        if(cfg.required && cfg.type!=='toggle' && cfg.type!=='image'){
            const el=document.getElementById('f_'+key);
            if(el && !el.value.trim()){toast(`"${cfg.label}" is required`,'error');el.focus();return;}
        }
    }

    const fd=new FormData();
    fd.append('action', editingId?'update':'create');
    fd.append('table', TABLE);
    if(editingId) fd.append('id', editingId);

    Object.entries(fields).forEach(([key,cfg])=>{
        if(cfg.type==='image'){
            // The file input carries the field name already; just attach if a file was chosen
            const fi=document.getElementById('imgfi_'+key);
            if(fi && fi.files.length>0) fd.append(key, fi.files[0]);
            // No else — server keeps existing filename when no upload present
        } else if(cfg.type==='toggle'){
            const el=document.getElementById('f_'+key);
            if(el) fd.append(key, el.checked?'1':'0');
        } else {
            const el=document.getElementById('f_'+key);
            if(el) fd.append(key, el.value);
        }
    });

    btn.disabled=true;
    btn.innerHTML='<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Saving…';

    fetch('?ajax=1',{method:'POST',body:fd})
        .then(r=>r.json())
        .then(data=>{
            if(data.error){toast(data.error,'error');}
            else{toast(editingId?'Record updated!':'Record created!','success');closeModal('formModal');loadTable(currentPage,currentSearch);}
        })
        .catch(()=>toast('Save failed','error'))
        .finally(()=>{btn.disabled=false;btn.innerHTML='<i class="bi bi-check-lg"></i> Save';});
}

// ── DELETE ───────────────────────────────────────────────────────────
function confirmDelete(id){deleteId=id;document.getElementById('confirmDelete').classList.add('open');}
function closeConfirm(){deleteId=null;document.getElementById('confirmDelete').classList.remove('open');}
document.getElementById('confirmDeleteBtn').addEventListener('click',()=>{
    if(!deleteId)return;
    const btn=document.getElementById('confirmDeleteBtn');
    btn.disabled=true;
    btn.innerHTML='<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>';
    const fd=new FormData();
    fd.append('action','delete');fd.append('table',TABLE);fd.append('id',deleteId);
    fetch('?ajax=1',{method:'POST',body:fd})
        .then(r=>r.json())
        .then(data=>{
            if(data.error)toast(data.error,'error');
            else{toast('Record deleted','success');closeConfirm();loadTable(currentPage,currentSearch);}
        })
        .catch(()=>toast('Delete failed','error'))
        .finally(()=>{btn.disabled=false;btn.innerHTML='<i class="bi bi-trash3"></i> Delete';});
});
document.getElementById('confirmDelete').addEventListener('click',e=>{
    if(e.target===document.getElementById('confirmDelete'))closeConfirm();
});

// ── TOAST ────────────────────────────────────────────────────────────
function toast(msg,type='success'){
    const c=document.getElementById('toast-container');
    const el=document.createElement('div');
    el.className=`toast toast-${type}`;
    el.innerHTML=`<i class="bi ${type==='success'?'bi-check-circle-fill':'bi-x-circle-fill'}"></i> ${htmlE(msg)}`;
    c.appendChild(el);
    setTimeout(()=>el.remove(),3500);
}

// ── HTML ESCAPE ──────────────────────────────────────────────────────
function htmlE(str){
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ── KEYBOARD ─────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
        closeModal('formModal');
        closeModal('viewModal');
        closeConfirm();
        closeLogoutConfirm();
        closeProfileDropdown();
    }
});

// ── INIT ─────────────────────────────────────────────────────────────
if(TABLE) loadTable();
</script>

<?php endif; ?>
</body>
</html>