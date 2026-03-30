require("dotenv").config();

const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const PORT = process.env.PORT || 3000;
const app = express();

/* ===================== DATABASE ===================== */
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: false
});

/* ===================== MIDDLEWARE ===================== */
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://your-app.up.railway.app"
];

app.use(cors({
  origin: function (origin, callback) {

    // อนุญาต request ที่ไม่มี origin (เช่น Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }

  },
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const qcController = async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // check PO
    const po = await client.query(
      `SELECT status FROM purchase WHERE po_id=$1`,
      [id]
    );

    if (!po.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "PO not found" });
    }

    if (po.rows[0].status !== "RECEIVED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "ต้อง RECEIVE ก่อน QC"
      });
    }

    // ดึงรายการสินค้า
    const details = await client.query(`
      SELECT * FROM purchase_detail WHERE po_id=$1
    `, [id]);

    for (const item of details.rows) {

      // update stock
      await client.query(`
        UPDATE materials
        SET mat_qty = mat_qty + $1
        WHERE mat_id = $2
      `, [item.qty, item.mat_id]);

      // log transaction
      await client.query(`
        INSERT INTO transactions
        (tra_type, tra_item_type, tra_item_id, tra_qty, tra_note)
        VALUES ('IN','material',$1,$2,'QC PASS')
      `, [item.mat_id, item.qty]);
    }

    // update status
    await client.query(`
      UPDATE purchase
      SET status='QC_PASS'
      WHERE po_id=$1
    `, [id]);

    await client.query("COMMIT");

    res.json({ message: "QC pass + stock updated" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "QC error" });

  } finally {
    client.release();
  }
};

app.use(session({
  secret: "wms_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
  }
}));

app.use((req, res, next) => {
  if (req.session.user) {
    req.user = req.session.user;
  }
  next();
});

/* = FUNCTIONS = */
function checkRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

function checkPermission(permName) {
  return async (req, res, next) => {

    if (!req.session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roleId = req.session.user.role_id;

    const result = await pool.query(`
      SELECT 1
      FROM role_permissions rp
      JOIN permissions p ON rp.perm_id = p.perm_id
      WHERE rp.role_id = $1 AND p.perm_name = $2
    `, [roleId, permName]);

    if (result.rows.length === 0) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function createPurchase(req, res, next) {
  const { emp_id, items } = req.body;

  // เช็ค emp_id
  if (!emp_id) {
    return res.status(400).json({
      message: "emp_id is required"
    });
  }

  // เช็ค items
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "items must be a non-empty array"
    });
  }

  // เช็คแต่ละ item
  for (const item of items) {
    if (!item.mat_id || !item.qty || item.qty <= 0) {
      return res.status(400).json({
        message: "Each item must have mat_id and qty > 0"
      });
    }
  }

  next();
}

/* ===================== SERVER ===================== */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/* ===================== FILE UPLOAD ===================== */
const materialStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/img/materials"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/img/products"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const employeeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/img/emp"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const uploadEmployee = multer({ storage: employeeStorage });
const uploadMaterial = multer({ storage: materialStorage });
const uploadProduct = multer({ storage: productStorage });

/* ===================== AUTH LOGIN ===================== */

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT emp_id, emp_username, emp_password,
              emp_fname, emp_lname, role_id, 
              emp_img
       FROM employees
       WHERE emp_username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = result.rows[0];

    if (password !== user.emp_password) {
      return res.status(401).json({ message: "Wrong password" });
    }

    // session
    req.session.user = {
      emp_id: user.emp_id,
      username: user.emp_username,
      role_id: user.role_id,
      emp_fname: user.emp_fname,
      emp_lname: user.emp_lname,
      emp_img: user.emp_img
    };

    // ดึง role name เพิ่ม (สำคัญ)
    const roleRes = await pool.query(
      `SELECT role_name FROM roles WHERE role_id = $1`,
      [user.role_id]
    );

    const role = roleRes.rows[0]?.role_name || "unknown";

    // ส่งให้ frontend
    res.json({
      role: role,
      role_id: user.role_id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// CHECK LOGIN
app.get("/me", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }

  try {
    const user = req.session.user;

    // ดึงทั้ง Role Name และ Permissions
    const roleResult = await pool.query(`SELECT role_name FROM roles WHERE role_id = $1`, [user.role_id]);
    const perms = await pool.query(`
      SELECT p.perm_name FROM role_permissions rp
      JOIN permissions p ON rp.perm_id = p.perm_id
      WHERE rp.role_id = $1
    `, [user.role_id]);

    res.json({
      ...user,
      role: roleResult.rows[0]?.role_name || "", // ส่งชื่อ role กลับไปด้วย
      permissions: perms.rows.map(p => p.perm_name) // ส่งเป็น array ของชื่อสิทธิ์
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGOUT
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

/* ===================== HOME ===================== */
app.get("/dashboard/summary", async (req, res) => {
  try {

    const productCount = await pool.query(
      "SELECT COUNT(*) FROM products"
    );

    const materialCount = await pool.query(
      "SELECT COUNT(*) FROM materials"
    );

    const bomCount = await pool.query(
      "SELECT COUNT(*) FROM bom_header"
    );

    res.json({
      totalProducts: parseInt(productCount.rows[0].count),
      totalMaterials: parseInt(materialCount.rows[0].count),
      totalBoms: parseInt(bomCount.rows[0].count)
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ========================================== */
app.get("/dashboard/monthly", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM tra_created_at) AS month,
        SUM(CASE WHEN tra_type = 'IN' THEN tra_qty ELSE 0 END) AS total_in,
        SUM(CASE WHEN tra_type = 'OUT' THEN tra_qty ELSE 0 END) AS total_out
      FROM transactions
      GROUP BY month
      ORDER BY month
    `);

    const labels = [];
    const totalIn = [];
    const totalOut = [];

    result.rows.forEach(row => {
      labels.push("Month " + row.month);
      totalIn.push(parseInt(row.total_in));
      totalOut.push(parseInt(row.total_out));
    });

    res.json({ labels, totalIn, totalOut });

  } catch (err) {
    console.error("Monthly error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ========================================== */
app.get("/dashboard/low-stock", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT 
        t.tra_item_id,
        COALESCE(p.pro_name, m.mat_name) AS item_name,
        SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END) -
        SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END) AS balance
      FROM transactions t
      LEFT JOIN products p
        ON t.tra_item_id = p.pro_id
        AND t.tra_item_type = 'product'
      LEFT JOIN materials m
        ON t.tra_item_id = m.mat_id
        AND t.tra_item_type = 'material'
      GROUP BY t.tra_item_id, p.pro_name, m.mat_name
      HAVING 
        SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END) -
        SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END) < 10
      ORDER BY balance ASC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Low stock error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== Employees ===================== */
app.get("/employees", checkPermission("view_employee"), async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        e.emp_id,
        e.emp_no,
        e.emp_img,
        e.emp_fname,
        e.emp_lname,
        e.emp_email,
        e.emp_tel,
        e.emp_username,
        e.status,
        d.dept_name,
        r.role_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.dept_id
      LEFT JOIN roles r ON e.role_id = r.role_id
      ORDER BY e.emp_no
    `);

    const employees = result.rows.map(emp => ({
      ...emp,
      emp_img: emp.emp_img
        ? `/img/emp/${emp.emp_img}`
        : null
    }));

    res.json(employees);

  } catch (err) {
    console.error("Employees error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== GET Employee by ID ===================== */
app.get("/employees/:id", checkPermission("view_employee"), async (req, res) => {
  try {

    const id = req.params.id;

    const result = await pool.query(`
      SELECT *
      FROM employees
      WHERE emp_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Get employee error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== ADD Employee ===================== */
app.post("/employees",
  checkPermission("create_employee"),
  uploadEmployee.single("emp_img"),
  async (req, res) => {

    try {

      const {
        emp_fname,
        emp_lname,
        emp_email,
        emp_tel,
        dept_id,
        emp_username,
        emp_password,
        role_id
      } = req.body;

      if (!emp_password) {
        return res.status(400).json({ message: "Password required" });
      }

      // hash password (สำคัญมาก)
      const bcrypt = require("bcrypt");
      const hashed = await bcrypt.hash(emp_password, 10);

      const emp_img = req.file ? req.file.filename : null;

      await pool.query(`
        INSERT INTO employees
        (emp_img, emp_fname, emp_lname, emp_email, emp_tel,
         dept_id, emp_username, emp_password, role_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
        [
          emp_img,
          emp_fname,
          emp_lname,
          emp_email,
          emp_tel,
          dept_id,
          emp_username,
          emp_password,
          role_id
        ]
      );

      res.json({ message: "Employee added" });

    } catch (err) {
      console.error("Add employee error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

/* ===================== UPDATE Employee ===================== */
app.put("/employees/:id",
  checkPermission("edit_employee"),
  uploadEmployee.single("emp_img"),
  async (req, res) => {

    try {

      const id = req.params.id;

      const {
        emp_fname,
        emp_lname,
        emp_email,
        emp_tel,
        dept_id,
        role_id,
        status,
        emp_password
      } = req.body;

      let passwordQuery = "";
      let passwordValue = [];

      if (emp_password) {
        passwordQuery = ", emp_password=$8";
        passwordValue.push(emp_password);
      }

      const emp_img = req.file ? req.file.filename : null;

      if (emp_img) {

        await pool.query(`
          UPDATE employees
          SET
            emp_img=$1,
            emp_fname=$2,
            emp_lname=$3,
            emp_email=$4,
            emp_tel=$5,
            dept_id=$6,
            role_id=$7,
            status=$8
            ${passwordQuery}
          WHERE emp_id=$9
        `,
          [
            emp_img,
            emp_fname,
            emp_lname,
            emp_email,
            emp_tel,
            dept_id,
            role_id,
            status,
            ...passwordValue,
            id
          ]
        );

      } else {

        await pool.query(`
          UPDATE employees
          SET
            emp_fname=$1,
            emp_lname=$2,
            emp_email=$3,
            emp_tel=$4,
            dept_id=$5,
            role_id=$6,
            status=$7
            ${passwordQuery}
          WHERE emp_id=$8
        `,
          [
            emp_fname,
            emp_lname,
            emp_email,
            emp_tel,
            dept_id,
            role_id,
            status,
            ...passwordValue,
            id
          ]
        );
      }

      res.json({ message: "Employee updated" });

    } catch (err) {
      console.error("Update employee error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

/* ===================== DELETE Employee ===================== */
app.delete("/employees/:id",
  checkPermission("edit_employee"),
  async (req, res) => {

    try {

      const id = req.params.id;

      await pool.query(
        "DELETE FROM employees WHERE emp_id=$1",
        [id]
      );

      res.json({ message: "Employee deleted" });

    } catch (err) {
      console.error("Delete employee error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

/* ================= ROLES ================= */
app.get("/roles", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT role_id, role_name
      FROM roles
      ORDER BY role_name
    `);

    res.json(result.rows);

  } catch (err) {

    console.error(err);
    res.status(500).json({ message: "Server error" });

  }

});


/* ================= GET DEPARTMENTS ================= */
app.get("/departments", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT dept_id, dept_name
      FROM departments
      ORDER BY dept_name
    `);

    res.json(result.rows);

  } catch (err) {

    console.error(err);
    res.status(500).json({ message: "Server error" });

  }

});

/* ===================== STOCK ===================== */
app.get("/stock", async (req, res) => {

  try {

    const result = await pool.query(`

    SELECT
      p.pro_id as id,
      p.pro_name as name,
      'product' as type,
      p.pro_qty as stock,
      CASE
        WHEN q.qc_status='pass' THEN true
        ELSE false
      END as qc_status
    FROM products p
    LEFT JOIN qc q
      ON p.pro_id = q.item_id
      AND q.item_type='product'
    UNION
    SELECT
      m.mat_id as id,
      m.mat_name as name,
      'material' as type,
      m.mat_qty as stock,
      CASE
        WHEN q.qc_status='pass' THEN true
        ELSE false
      END as qc_status
    FROM materials m
    LEFT JOIN qc q
      ON m.mat_id = q.item_id
      AND q.item_type='material'
    ORDER BY id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
  }
});

// 
app.put("/purchase/receive/:id", async (req, res) => {

  const id = req.params.id;

  // update stock
  await pool.query(`
    UPDATE materials m
    SET mat_qty = m.mat_qty + pd.qty
    FROM purchase_detail pd
    WHERE pd.mat_id = m.mat_id
    AND pd.po_id = $1
  `, [id]);

  // update status
  await pool.query(`
    UPDATE purchase
    SET status = 'received'
    WHERE po_id = $1
  `, [id]);

  res.json({ message: "received" });

});

/* ===================== MATERIALS ===================== */

// CREATE MATERIAL
app.post("/materials", uploadMaterial.single("mat_img"), async (req, res) => {
  const {
    mat_name,
    mat_weight,
    mat_price,
    mat_size,
    mat_qty,
    mat_status
  } = req.body;

  if (!mat_name || !mat_price || !mat_status) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const last = await pool.query(`
      SELECT MAX(CAST(SUBSTRING(mat_no FROM 2) AS INTEGER)) AS max_no
      FROM materials
    `);

    const nextNo = (last.rows[0].max_no || 0) + 1;
    const mat_no = "M" + String(nextNo).padStart(3, "0");
    const mat_img = req.file ? `/img/materials/${req.file.filename}` : null;

    await pool.query(
      `INSERT INTO materials
       (mat_no, mat_name, mat_weight, mat_price, mat_size, mat_qty, mat_status, mat_img)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        mat_no,
        mat_name,
        mat_weight || 0,
        mat_price,
        mat_size || null,
        mat_qty || 0,
        mat_status,
        mat_img
      ]
    );

    res.json({ message: "success", mat_no });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// GET ALL MATERIALS
app.get("/materials", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT mat_id, mat_no, mat_img, mat_name,
             mat_qty, mat_price, mat_size, mat_weight, mat_status
      FROM materials
      ORDER BY mat_id
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// GET MATERIAL BY ID
app.get("/materials/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    "SELECT * FROM materials WHERE mat_id = $1",
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Not found" });
  }

  const m = result.rows[0];
  res.json(result.rows[0]);
});

// UPDATE MATERIAL
app.put("/materials/:id", uploadMaterial.single("mat_img"), async (req, res) => {
  const { id } = req.params;
  const {
    mat_name,
    mat_weight,
    mat_price,
    mat_size,
    mat_qty,
    mat_status
  } = req.body;

  try {

    const check = await pool.query(
      "SELECT * FROM materials WHERE mat_id = $1",
      [id]
    );

    if (!check.rows.length) {
      return res.status(404).json({ message: "Material not found" });
    }

    let mat_img = check.rows[0].mat_img;

    if (req.file) {
      mat_img = `/img/materials/${req.file.filename}`;
    }

    await pool.query(
      `UPDATE materials
       SET mat_name=$1,
           mat_weight=$2,
           mat_price=$3,
           mat_size=$4,
           mat_qty=$5,
           mat_status=$6,
           mat_img=$7
       WHERE mat_id=$8`,
      [
        mat_name,
        Number(mat_weight) || 0,
        Number(mat_price) || 0,
        mat_size || null,
        Number(mat_qty) || 0,
        mat_status,
        mat_img,
        id
      ]
    );

    res.json({ message: "updated" });

  } catch (err) {
    console.error("UPDATE MATERIAL ERROR:", err);
    res.status(500).json({ message: "DB error" });
  }
});

// ===== DELETE MATERIAL ===== 
app.delete("/materials/:id", async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    "DELETE FROM materials WHERE mat_id = $1",
    [id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Not found" });
  }

  res.json({ message: "deleted" });
});

/* ===================== BOM ===================== */

// ===== NEXT BOM NUMBER =====
// app.get("/bom/next-number", checkPermission("view_bom"), async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT MAX(CAST(SUBSTRING(bom_no FROM 5) AS INTEGER)) AS max_no
//       FROM bom_header
//       WHERE bom_no IS NOT NULL
//     `);

//     const nextNo = (result.rows[0].max_no || 0) + 1;
//     const nextBomNo = "BOM-" + String(nextNo).padStart(4, "0");

//     res.json({ nextBomNo });

//   } catch (err) {
//     console.error("NEXT BOM NO ERROR:", err);
//     res.status(500).json({ message: "DB error" });
//   }
// });


/* ===================== CREATE BOM ===================== */
app.post("/bom", checkPermission("create_bom"), async (req, res) => {

  const { pro_id, details } = req.body;

  if (!pro_id || !Array.isArray(details) || details.length === 0) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔥 ใช้ sequence (กันชน 100%)
    const seq = await client.query(`SELECT nextval('bom_seq') AS seq`);
    const bomNo = "BOM-" + String(seq.rows[0].seq).padStart(4, "0");

    // 🔥 insert header
    const header = await client.query(
      `INSERT INTO bom_header (bom_no, pro_id)
       VALUES ($1, $2)
       RETURNING bom_id`,
      [bomNo, pro_id]
    );

    const bomId = header.rows[0].bom_id;

    // 🔥 insert details
    for (const d of details) {

      if (!d.mat_id || isNaN(d.usage_qty)) {
        throw new Error("Invalid BOM detail");
      }

      await client.query(
        `INSERT INTO bom_details (bom_id, mat_id, usage_qty)
         VALUES ($1,$2,$3)`,
        [bomId, d.mat_id, d.usage_qty]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: "created",
      bom_no: bomNo
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE BOM ERROR:", err);
    res.status(500).json({ message: "DB error" });
  } finally {
    client.release();
  }
});

/* ===================== UPDATE BOM ===================== */
app.put("/bom/:id", checkPermission("edit_bom"), async (req, res) => {

  const bomId = req.params.id;
  const { details } = req.body;

  if (!Array.isArray(details)) {
    return res.status(400).json({ message: "Invalid details" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM bom_details WHERE bom_id = $1",
      [bomId]
    );

    for (const d of details) {

      if (!d.mat_id || isNaN(d.usage_qty)) {
        throw new Error("Invalid BOM detail");
      }

      await client.query(
        `INSERT INTO bom_details (bom_id, mat_id, usage_qty)
         VALUES ($1,$2,$3)`,
        [bomId, d.mat_id, d.usage_qty]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "updated" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT BOM ERROR:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

/* ===================== DELETE BOM ===================== */
app.delete("/bom/:id", checkPermission("edit_bom"), async (req, res) => {

  const bomId = req.params.id;

  try {
    await pool.query("DELETE FROM bom_details WHERE bom_id = $1", [bomId]);
    await pool.query("DELETE FROM bom_header WHERE bom_id = $1", [bomId]);

    res.json({ message: "deleted" });

  } catch (err) {
    console.error("DELETE BOM ERROR:", err);
    res.status(500).json({ message: "DB error" });
  }
});


// ===== GET ALL BOM =====
app.get("/bom", checkPermission("view_bom"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        bh.bom_id,
        bh.bom_no,
        p.pro_no,
        p.pro_name,
        m.mat_no,
        m.mat_name,
        bd.usage_qty
      FROM bom_header bh
      JOIN products p ON bh.pro_id = p.pro_id
      JOIN bom_details bd ON bh.bom_id = bd.bom_id
      JOIN materials m ON bd.mat_id = m.mat_id
      ORDER BY bh.bom_id, m.mat_no
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("GET BOM ERROR:", err);
    res.status(500).json({ message: "DB error" });
  }
});


// ===== GET BOM BY ID =====
app.get("/bom/:id", checkPermission("view_bom"), async (req, res) => {
  const bomId = req.params.id;

  try {
    const result = await pool.query(`
      SELECT
        bh.bom_id,
        bh.bom_no,
        p.pro_id,
        p.pro_no,
        p.pro_name,
        bd.mat_id,
        m.mat_no,
        m.mat_name,
        bd.usage_qty
      FROM bom_header bh
      JOIN products p ON bh.pro_id = p.pro_id
      LEFT JOIN bom_details bd ON bh.bom_id = bd.bom_id
      LEFT JOIN materials m ON bd.mat_id = m.mat_id
      WHERE bh.bom_id = $1
    `, [bomId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "BOM not found" });
    }

    const rows = result.rows;

    res.json({
      bom_id: rows[0].bom_id,
      bom_no: rows[0].bom_no,
      pro_id: rows[0].pro_id,
      pro_no: rows[0].pro_no,
      pro_name: rows[0].pro_name,
      details: rows
        .filter(r => r.mat_id !== null)
        .map(r => ({
          mat_id: r.mat_id,
          mat_no: r.mat_no,
          mat_name: r.mat_name,
          usage_qty: r.usage_qty
        }))
    });

  } catch (err) {
    console.error("GET BOM BY ID ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== products ===================== */
// CREATE PRODUCT
app.post("/products", uploadProduct.single("pro_img"), async (req, res) => {
  const {
    pro_name,
    pro_qty,
    pro_price,
    pro_weight,
    pro_status
  } = req.body;

  if (!pro_name || !pro_status) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
  }

  try {
    // generate pro_no
    const last = await pool.query(`
      SELECT MAX(CAST(SUBSTRING(pro_no FROM 2) AS INTEGER)) AS max_no
      FROM products
      WHERE pro_no IS NOT NULL
    `);

    const nextNo = (last.rows[0].max_no || 0) + 1;
    const pro_no = "P" + String(nextNo).padStart(3, "0");

    const pro_img = req.file
      ? `/img/products/${req.file.filename}`
      : null;

    await pool.query(
      `INSERT INTO products
       (pro_no, pro_img, pro_name, pro_qty,
        pro_price, pro_weight, pro_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        pro_no,
        pro_img,
        pro_name,
        pro_qty || 0,
        pro_price || 0,
        pro_weight || 0,
        pro_status
      ]
    );

    res.json({ message: "success", pro_no });

  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err);
    res.status(500).json({ message: "DB error" });
  }
});

// ===== GET PRODUCT BY ID ======
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE pro_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    const p = result.rows[0];
    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// ===== UPDATE PRODUCT =====
app.put("/products/:id", uploadProduct.single("pro_img"), async (req, res) => {
  const { id } = req.params;
  const {
    pro_name,
    pro_qty,
    pro_price,
    pro_weight,
    pro_status
  } = req.body;

  try {

    // ===== เช็คว่ามีสินค้าไหม =====
    const check = await pool.query(
      "SELECT * FROM products WHERE pro_id = $1",
      [id]
    );

    if (!check.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    let pro_img = check.rows[0].pro_img;

    // ===== ถ้ามีไฟล์ใหม่ =====
    if (req.file) {
      pro_img = `/img/products/${req.file.filename}`;
    }

    await pool.query(
      `UPDATE products
       SET pro_name=$1,
           pro_qty=$2,
           pro_price=$3,
           pro_weight=$4,
           pro_status=$5,
           pro_img=$6
       WHERE pro_id=$7`,
      [
        pro_name,
        Number(pro_qty) || 0,
        Number(pro_price) || 0,
        Number(pro_weight) || 0,
        pro_status,
        pro_img,
        id
      ]
    );

    res.json({ message: "updated" });

  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err);
    res.status(500).json({ message: "DB error" });
  }
});

// ===== DELETE PRODUCT =====
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM products WHERE pro_id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "deleted" });

  } catch (err) {
    console.error("DELETE PRODUCT ERROR:", err);
    res.status(500).json({ message: "DB error" });
  }
});

// =====================================================
app.get("/products", checkPermission("view_products"), async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// ================ POST transaction ===============
app.post("/transactions", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { type, itemType, itemId, qty, note } = req.body;

    const table = itemType === "product" ? "products" : "materials";
    const qtyField = itemType === "product" ? "pro_qty" : "mat_qty";
    const idField = itemType === "product" ? "pro_id" : "mat_id";

    // ดึง stock
    const itemResult = await client.query(
      `SELECT ${qtyField} FROM ${table} WHERE ${idField} = $1`,
      [itemId]
    );

    if (!itemResult.rows.length) {
      throw new Error("Item not found");
    }

    let currentQty = itemResult.rows[0][qtyField];
    let newQty;

    if (type === "IN") {
      newQty = currentQty + Number(qty);
    } else {
      if (currentQty < qty) {
        throw new Error("Stock ไม่พอ");
      }
      newQty = currentQty - Number(qty);
    }

    // update stock
    await client.query(
      `UPDATE ${table} SET ${qtyField} = $1 WHERE ${idField} = $2`,
      [newQty, itemId]
    );

    // insert transaction
    await client.query(
      `INSERT INTO transactions
       (tra_type, tra_item_type, tra_item_id, tra_qty, tra_note)
       VALUES ($1,$2,$3,$4,$5)`,
      [type, itemType, itemId, qty, note]
    );

    await client.query("COMMIT");

    res.json({ message: "Success" });

  } catch (err) {
    await client.query("ROLLBACK");

    res.status(400).json({ message: err.message });

  } finally {
    client.release();
  }
});

//=====================Put transactions id==============================
app.put("/transactions/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { type, itemType, itemId, qty, note } = req.body;

    const old = await client.query(
      "SELECT * FROM transactions WHERE tra_id = $1",
      [id]
    );

    if (!old.rows.length) {
      throw new Error("Transaction not found");
    }

    const oldTransaction = old.rows[0];

    const table = itemType === "product" ? "products" : "materials";
    const qtyField = itemType === "product" ? "pro_qty" : "mat_qty";
    const idField = itemType === "product" ? "pro_id" : "mat_id";

    const stock = await client.query(
      `SELECT ${qtyField} FROM ${table} WHERE ${idField} = $1`,
      [itemId]
    );

    let currentQty = stock.rows[0][qtyField];

    // คืน stock เดิม
    if (oldTransaction.tra_type === "IN") {
      currentQty -= oldTransaction.tra_qty;
    } else {
      currentQty += oldTransaction.tra_qty;
    }

    // คำนวณใหม่
    let newQty;

    if (type === "IN") {
      newQty = currentQty + Number(qty);
    } else {
      if (currentQty < qty) {
        throw new Error("Stock ไม่พอ");
      }
      newQty = currentQty - Number(qty);
    }

    // update stock
    await client.query(
      `UPDATE ${table} SET ${qtyField} = $1 WHERE ${idField} = $2`,
      [newQty, itemId]
    );

    // update transaction
    await client.query(
      `UPDATE transactions
       SET tra_type=$1,
           tra_item_type=$2,
           tra_item_id=$3,
           tra_qty=$4,
           tra_note=$5
       WHERE tra_id=$6`,
      [type, itemType, itemId, qty, note, id]
    );

    await client.query("COMMIT");

    res.json({ message: "Updated" });

  } catch (err) {
    await client.query("ROLLBACK");

    res.status(400).json({ message: err.message });

  } finally {
    client.release();
  }
});

// ===== GET transaction history =====
app.get("/transactions", async (req, res) => {
  try {
    const { search, type, itemType } = req.query;

    let query = `
      SELECT 
        t.tra_id,
        t.tra_no,
        t.tra_type,
        t.tra_item_type,
        t.tra_item_id,
        t.tra_qty,
        t.tra_note,
        t.tra_created_at,
        COALESCE(p.pro_name, m.mat_name) AS item_name
      FROM transactions t
      LEFT JOIN products p
        ON t.tra_item_id = p.pro_id
        AND t.tra_item_type = 'product'
      LEFT JOIN materials m
        ON t.tra_item_id = m.mat_id
        AND t.tra_item_type = 'material'
      WHERE 1=1
    `;

    let values = [];
    let count = 1;

    // ค้นหา tra_no
    if (search) {
      query += ` AND CAST(t.tra_no AS TEXT) ILIKE $${count}`;
      values.push(`%${search}%`);
      count++;
    }

    // กรอง IN / OUT
    if (type) {
      query += ` AND t.tra_type = $${count}`;
      values.push(type);
      count++;
    }

    // กรอง product / material
    if (itemType) {
      query += ` AND t.tra_item_type = $${count}`;
      values.push(itemType);
      count++;
    }

    query += ` ORDER BY t.tra_id DESC`;

    const result = await pool.query(query, values);

    res.json({
      message: "Success",
      total: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    console.error("GET /transactions error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//==================transactions id========================
app.get("/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ป้องกัน id ไม่ใช่ตัวเลข
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }

    const result = await pool.query(
      `
      SELECT 
        t.tra_id,
        t.tra_no,
        t.tra_type,
        t.tra_item_type,
        t.tra_item_id,
        t.tra_qty,
        t.tra_note,
        t.tra_created_at,
        COALESCE(p.pro_name, m.mat_name) AS item_name
      FROM transactions t
      LEFT JOIN products p
        ON t.tra_item_id = p.pro_id
        AND t.tra_item_type = 'product'
      LEFT JOIN materials m
        ON t.tra_item_id = m.mat_id
        AND t.tra_item_type = 'material'
      WHERE t.tra_id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("GET transaction by id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== DELETE transactions =====
app.delete("/transactions/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    // ดึง transaction
    const result = await client.query(
      "SELECT * FROM transactions WHERE tra_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Transaction not found" });
    }

    const t = result.rows[0];

    // หาตาราง + field
    const table =
      t.tra_item_type === "product" ? "products" : "materials";

    const qtyField =
      t.tra_item_type === "product" ? "pro_qty" : "mat_qty";

    const idField =
      t.tra_item_type === "product" ? "pro_id" : "mat_id";

    // ดึง stock ปัจจุบัน
    const stockResult = await client.query(
      `SELECT ${qtyField} FROM ${table} WHERE ${idField} = $1`,
      [t.tra_item_id]
    );

    if (stockResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Item not found" });
    }

    let currentQty = stockResult.rows[0][qtyField];
    let newQty;

    // คืน stock
    if (t.tra_type === "IN") {
      // เคยเพิ่ม → ต้องลบออก
      if (currentQty < t.tra_qty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Stock ไม่พอสำหรับ rollback"
        });
      }
      newQty = currentQty - t.tra_qty;
    } else {
      // เคยเอาออก → คืนเข้า
      newQty = currentQty + t.tra_qty;
    }

    // update stock
    await client.query(
      `UPDATE ${table} SET ${qtyField} = $1 WHERE ${idField} = $2`,
      [newQty, t.tra_item_id]
    );

    // ลบ transaction
    await client.query(
      "DELETE FROM transactions WHERE tra_id = $1",
      [id]
    );

    await client.query("COMMIT");

    res.json({ message: "Deleted and stock updated" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Server error" });

  } finally {
    client.release();
  }
});

//====================================================
function goEdit(id) {
  window.location.href = `edit-transaction.html?id=${id}`;
}

async function deleteTransaction(id) {
  if (!confirm("Are you sure you want to delete this transaction?")) return;

  try {
    const res = await fetch(`/transactions/${id}`, {
      method: "DELETE"
    });

    if (res.ok) {
      alert("Deleted successfully");
      loadTransactions();
    }
  } catch (err) {
    console.error("Delete error:", err);
  }
}

// =================== stock-summary =======================================
app.get("/stock-summary", async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT 
    t.tra_item_type,
    t.tra_item_id,
    COALESCE(p.pro_name, m.mat_name, 'Unknown (' || t.tra_item_type || ' ID:' || t.tra_item_id || ')') AS item_name,
    SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END) AS total_in,
    SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END) AS total_out
  FROM public.transactions t
  LEFT JOIN public.products p
    ON t.tra_item_id = p.pro_id
    AND LOWER(TRIM(t.tra_item_type)) = 'product'
  LEFT JOIN public.materials m
    ON CAST(t.tra_item_id AS INTEGER) = m.mat_id
    AND LOWER(TRIM(t.tra_item_type)) = 'materials'
  GROUP BY t.tra_item_type, t.tra_item_id, p.pro_name, m.mat_name
  ORDER BY item_name ASC
`);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "โหลด stock summary ไม่สำเร็จ" });
  }
});

/* ===================== QC ===================== */

// CREATE QC
app.post("/qc", async (req, res) => {
  const { item_id, item_type, emp_id } = req.body;

  try {
    // validate
    if (!item_id || !item_type || !emp_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["product", "material"].includes(item_type)) {
      return res.status(400).json({ message: "Invalid item_type" });
    }

    const qc = await pool.query(`
      INSERT INTO qc
      (qc_no, item_id, item_type, emp_id, qc_status)
      VALUES (
        'QC' || LPAD(nextval('qc_qc_id_seq')::text,4,'0'),
        $1,$2,$3,'wait'
      )
      RETURNING *
    `, [item_id, item_type, emp_id]);

    res.json(qc.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "create qc error" });
  }
});


// ===================== GET QC =====================
app.get("/qc", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        q.qc_id,
        q.qc_no,
        q.item_type,
        q.qc_status,
        q.qc_date,
        e.emp_fname || ' ' || e.emp_lname AS emp_name,
        CASE
          WHEN q.item_type='product' THEN p.pro_name
          WHEN q.item_type='material' THEN m.mat_name
        END as name
      FROM qc q
      LEFT JOIN employees e ON q.emp_id = e.emp_id
      LEFT JOIN products p 
        ON q.item_id = p.pro_id AND q.item_type='product'
      LEFT JOIN materials m 
        ON q.item_id = m.mat_id AND q.item_type='material'
      ORDER BY q.qc_id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "load qc error" });
  }
});


// ===================== PASS QC =====================
app.put("/qc/pass/:id", async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ดึง QC
    const qcResult = await client.query(`
      SELECT item_id, item_type, qc_status
      FROM qc
      WHERE qc_id = $1
    `, [id]);

    if (!qcResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "QC not found" });
    }

    const { item_id, item_type, qc_status } = qcResult.rows[0];

    // กันกดซ้ำ
    if (qc_status === "pass") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "QC already passed" });
    }

    // update qc
    await client.query(`
      UPDATE qc
      SET qc_status = 'pass'
      WHERE qc_id = $1
    `, [id]);

    // update stock / status
    if (item_type === "product") {
      await client.query(`
        UPDATE products
        SET qc_status = true
        WHERE pro_id = $1
      `, [item_id]);
    } else {
      await client.query(`
        UPDATE materials
        SET qc_status = true
        WHERE mat_id = $1
      `, [item_id]);
    }

    // log transaction
    await client.query(`
      INSERT INTO transactions
      (tra_type, tra_item_type, tra_item_id, tra_qty, tra_note)
      VALUES ('IN', $1, $2, 1, 'QC PASS')
    `, [item_type, item_id]);

    await client.query("COMMIT");

    res.json({ message: "QC PASS success" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("QC PASS ERROR:", err);
    res.status(500).json({ error: err.message });

  } finally {
    client.release();
  }
});


// ===================== FAIL QC =====================
app.put("/qc/fail/:id", async (req, res) => {
  const id = req.params.id;

  try {
    // กันกดมั่ว
    const qc = await pool.query(`
      SELECT qc_status FROM qc WHERE qc_id=$1
    `, [id]);

    if (!qc.rows.length) {
      return res.status(404).json({ message: "QC not found" });
    }

    if (qc.rows[0].qc_status === "fail") {
      return res.status(400).json({ message: "Already failed" });
    }

    await pool.query(`
      UPDATE qc
      SET qc_status='fail'
      WHERE qc_id=$1
    `, [id]);

    res.json({ message: "QC FAIL" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "QC fail error" });
  }
});

/* ===================== PURCHASE ===================== */
// ดูรายการสั่งซื้อ

// next-po
app.get("/purchase/next-po", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 'PO' || LPAD(
        nextval('purchase_po_id_seq')::text, 4, '0'
      ) AS po_no
    `);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "po number error" });
  }
});

// เพิ่ม PO
app.post("/purchase",
  checkRole(["Admin", "Planner"]),
  createPurchase,
  async (req, res) => {

    const client = await pool.connect();

    try {
      const { emp_id, items } = req.body;

      await client.query("BEGIN");

      // สร้าง PO
      const po = await client.query(`
        INSERT INTO purchase (po_no, emp_id, status)
        VALUES (
          'PO' || LPAD(nextval('purchase_po_id_seq')::text,4,'0'),
          $1,
          'PENDING'
        )
        RETURNING *
      `, [emp_id]);

      const po_id = po.rows[0].po_id;

      // insert detail
      for (const item of items) {
        await client.query(`
          INSERT INTO purchase_detail (po_id, mat_id, qty)
          VALUES ($1,$2,$3)
        `, [po_id, item.mat_id, Number(item.qty)]);
      }

      await client.query("COMMIT");

      res.json({
        message: "PO created",
        po_id
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);

      res.status(500).json({
        error: "create purchase error"
      });

    } finally {
      client.release();
    }
  }
);

// Receive ของเข้า
app.put("/purchase/receive/:id",
  checkRole(["Admin", "Warehouse Staff"]),
  async (req, res) => {

    const id = req.params.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // lock row กันกดซ้ำ
      const po = await client.query(
        `SELECT status FROM purchase WHERE po_id=$1 FOR UPDATE`,
        [id]
      );

      if (!po.rows.length) {
        throw new Error("PO not found");
      }

      if (po.rows[0].status === "RECEIVED") {
        throw new Error("Already received");
      }

      if (po.rows[0].status !== "APPROVED") {
        throw new Error("PO must be APPROVED first");
      }

      // ดึงรายการ
      const details = await client.query(
        `SELECT * FROM purchase_detail WHERE po_id=$1`,
        [id]
      );

      if (!details.rows.length) {
        throw new Error("No items in PO");
      }

      for (const item of details.rows) {

        // update stock
        await client.query(`
          UPDATE materials
          SET mat_qty = mat_qty + $1
          WHERE mat_id = $2
        `, [item.qty, item.mat_id]);

        // log transaction
        await client.query(`
          INSERT INTO transactions
          (tra_type, tra_item_type, tra_item_id, tra_qty, tra_note)
          VALUES ('IN','material',$1,$2,'Receive from PO')
        `, [item.mat_id, item.qty]);
      }

      // update status
      await client.query(`
        UPDATE purchase
        SET status='RECEIVED'
        WHERE po_id=$1
      `, [id]);

      await client.query("COMMIT");

      res.json({ message: "Received success" });

    } catch (err) {

      await client.query("ROLLBACK");

      console.error("RECEIVE ERROR:", err);
      res.status(400).json({ message: err.message });

    } finally {
      client.release();
    }
  });

// qc mat
app.put("/materials/qc/:id",
  checkRole(["QC Staff", "Admin"]),
  qcController
);

// =================== approve ====================
// api filter
app.get("/purchase", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.po_id,
        p.po_no,
        p.status,
        p.po_date,
        m.mat_name,
        pd.qty,
        e.emp_fname || ' ' || e.emp_lname AS emp_name
      FROM purchase p
      LEFT JOIN purchase_detail pd ON p.po_id = pd.po_id
      LEFT JOIN materials m ON pd.mat_id = m.mat_id
      LEFT JOIN employees e ON p.emp_id = e.emp_id
      ORDER BY p.po_id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "purchase load error" });
  }
});

/* ===================== Permissions ===================== */

// สิทธิ์ทั้งหมด
app.get("/permissions", async (req, res) => {
  try {
    const perms = await pool.query("SELECT * FROM permissions");
    res.json(perms.rows);
  } catch (err) {
    console.error("GET permissions error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// สิทธิ์ของ role
app.get("/roles/:id/permissions", async (req, res) => {
  try {
    const roleId = req.params.id;

    const result = await pool.query(`
      SELECT p.perm_id, p.perm_name
      FROM role_permissions rp
      JOIN permissions p ON rp.perm_id = p.perm_id
      WHERE rp.role_id = $1
    `, [roleId]);

    res.json(result.rows);

  } catch (err) {
    console.error("GET role permissions error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE สิทธิ์
app.put("/roles/:id/permissions", async (req, res) => {
  const client = await pool.connect();

  try {
    const roleId = req.params.id;
    const { permissions } = req.body;

    await client.query("BEGIN");

    await client.query(
      "DELETE FROM role_permissions WHERE role_id = $1",
      [roleId]
    );

    for (let perm of permissions) {
      await client.query(
        "INSERT INTO role_permissions (role_id, perm_id) VALUES ($1, $2)",
        [roleId, perm]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "Updated" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPDATE permissions error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

/* ===================== MY PERMISSIONS ===================== */
app.get("/my-permissions", async (req, res) => {
  try {

    // ต้องมี session/login ก่อน
    if (!req.session || !req.session.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roleId = req.session.user.role_id;

    const result = await pool.query(`
      SELECT p.perm_id, p.perm_name
      FROM role_permissions rp
      JOIN permissions p ON rp.perm_id = p.perm_id
      WHERE rp.role_id = $1
    `, [roleId]);

    res.json(result.rows);

  } catch (err) {
    console.error("MY PERMISSIONS error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// cd "E:\6511130008\ICE Project2.0\friend-manager-backend"
// node server.js