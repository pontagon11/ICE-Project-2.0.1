// ==========================
// STATUS MAP
// ==========================
const STATUS_MAP = {
  1: { text: "In Stock", class: "status-in-stock" },
  2: { text: "Low Stock", class: "status-low" },
  3: { text: "Out of Stock", class: "status-out" },
  4: { text: "Reserved", class: "status-reserved" },
  5: { text: "Inactive", class: "status-inactive" }
};

let allProducts = [];

// ==========================
// INITIALIZATION
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. ตรวจสอบ Login และดึง Permissions ลง localStorage ก่อน
    const loggedIn = await checkLogin();
    if (!loggedIn) return; // ถ้าไม่ได้ login จะโดนเด้งไปหน้า login เองจาก auth.js

    // 2. สั่งวาดเมนู Header (Home, Employees, Logout)
    if (typeof updateHeaderMenu === "function") {
      updateHeaderMenu();
    }

    // 3. วาด Bevbar (แถบสีฟ้า 25 รายการ)
    if (typeof renderSidebar === "function") {
      renderSidebar();
    }

    // 4. แสดงชื่อ-นามสกุล บน Header
    const profileName = document.getElementById("navUsername");
    if (profileName) {
      const fname = localStorage.getItem("fname") || "";
      const lname = localStorage.getItem("lname") || "";
      profileName.innerText = `${fname} ${lname}`.trim();
    }

    // 5. GUARD PAGE: เช็กสิทธิ์เข้าหน้า Product
    // ใช้ hasPermission("view_products") ที่คุณเขียนไว้
    if (!hasPermission("view_products")) {
      await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      window.location.href = "/home/home.html";
      return;
    }

    // ... ส่วนที่เหลือ (loadProducts, etc.) ...
    await loadProducts();
    setupStatusDropdown();
    setupSearch();

  } catch (err) {
    console.error("Initialization Error:", err);
  }
});

// ==========================
// FETCH DATA
// ==========================
async function loadProducts() {
  try {
    const res = await fetch("/products", { credentials: "include" });
    const data = await res.json();
    allProducts = data;
    renderTable(allProducts);
  } catch (err) {
    console.error("Load products error:", err);
  }
}

// ==========================
// RENDER TABLE
// ==========================
function renderTable(products) {
  const tbody = document.getElementById("products-body");
  if (!tbody) return;

  let html = "";
  const canEdit = hasPermission("edit_products");
  const canDelete = hasPermission("delete_products");

  products.forEach((p, index) => {
    const status = STATUS_MAP[p.pro_status] || { text: "Unknown", class: "status-unknown" };

    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${p.pro_no || "-"}</td>
        <td>
          ${p.pro_img ? `<img src="${p.pro_img}" width="40" style="border-radius:4px;">` : "-"}
        </td>
        <td>${p.pro_name || "-"}</td>
        <td>${p.pro_qty || 0}</td>
        <td>${Number(p.pro_price).toLocaleString()}</td>
        <td>${p.pro_weight ?? "-"}</td>
        <td>
          <span class="badge ${status.class}">
            ${status.text}
          </span>
        </td>
        <td>
          ${canEdit ? `<button class="edit-btn" onclick="goEdit(${p.pro_id})">✏️</button>` : "-"}
        </td>
        <td>
          ${canDelete ? `<button class="delete-btn" onclick="deleteProduct(${p.pro_id})">🗑️</button>` : "-"}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html || '<tr><td colspan="10">ไม่พบข้อมูลสินค้า</td></tr>';
}

// ==========================
// STATUS DROPDOWN
// ==========================
function setupStatusDropdown() {
  const select = document.getElementById("statusFilter");
  if (!select) return;

  let options = `<option value="">-- All Status --</option>`;
  Object.entries(STATUS_MAP).forEach(([key, value]) => {
    options += `<option value="${key}">${value.text}</option>`;
  });
  select.innerHTML = options;
  select.addEventListener("change", applyFilters);
}

// ==========================
// SEARCH & FILTER
// ==========================
function setupSearch() {
  const btn = document.getElementById("searchBtn");
  const input = document.getElementById("searchInput");

  if (btn) btn.addEventListener("click", applyFilters);
  if (input) {
    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") applyFilters();
      if (input.value === "") renderTable(allProducts);
    });
  }
}

function applyFilters() {
  const keyword = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const selectedStatus = document.getElementById("statusFilter")?.value || "";

  const filtered = allProducts.filter(p => {
    const statusObj = STATUS_MAP[p.pro_status] || { text: "" };
    const matchKeyword =
      (p.pro_no || "").toLowerCase().includes(keyword) ||
      (p.pro_name || "").toLowerCase().includes(keyword);

    const matchStatus = !selectedStatus || String(p.pro_status) === selectedStatus;
    return matchKeyword && matchStatus;
  });

  renderTable(filtered);
}

// ==========================
// ACTIONS (NAV & DELETE)
// ==========================
function goEdit(proId) {
  window.location.href = `/products/products-edit.html?id=${proId}`;
}

document.getElementById("addProductBtn")?.addEventListener("click", () => {
  window.location.href = "/products/products-add.html";
});

async function deleteProduct(proId) {
  const { isConfirmed } = await swalConfirm("ต้องการลบสินค้านี้ใช่หรือไม่?", "ยืนยันการลบ");
  if (!isConfirmed) return;

  try {
    const res = await fetch(`/products/${proId}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (res.ok) {
      await swalSuccess("ลบข้อมูลเรียบร้อยแล้ว");
      loadProducts();
    } else {
      const result = await res.json();
      await swalError(result.message || "ลบไม่สำเร็จ");
    }
  } catch (err) {
    console.error("Delete error:", err);
    await swalError("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
  }
}