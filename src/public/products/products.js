// ==========================
// STATUS MAP
// ==========================
const STATUS_MAP = {
  1: { text: "In Stock",     class: "badge-success" },
  2: { text: "Low Stock",    class: "badge-warning" },
  3: { text: "Out of Stock", class: "badge-danger"  },
  4: { text: "Reserved",     class: "badge-info"    },
  5: { text: "Inactive",     class: "badge-secondary"}
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
    const status = STATUS_MAP[p.pro_status] || { text: "Unknown", class: "badge-secondary" };

    const imgTag = p.pro_img
      ? `<img src="${p.pro_img}" class="prod-thumb" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=prod-thumb-placeholder><i class=fa fa-image></i></div>'">`
      : `<div class="prod-thumb-placeholder"><i class="fa fa-image"></i></div>`;

    html += `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td class="text-center">${imgTag}</td>
        <td><strong>${p.pro_name || "-"}</strong><br><span class="prod-code">${p.pro_no || ""}</span></td>
        <td class="text-right">${Number(p.pro_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="text-right">${(p.pro_qty || 0).toLocaleString()}</td>
        <td>${p.pro_weight != null ? p.pro_weight + " kg" : "-"}</td>
        <td><span class="badge ${status.class}">${status.text}</span></td>
        <td class="text-center">
          ${canEdit ? `<button class="edit-btn" onclick="goEdit(${p.pro_id})" title="Edit"><i class="fa fa-pen"></i></button>` : ""}
          ${canDelete ? `<button class="delete-btn" onclick="deleteProduct(${p.pro_id})" title="Delete" style="margin-left:6px"><i class="fa fa-trash"></i></button>` : ""}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html || '<tr><td colspan="8" class="text-center">ไม่พบข้อมูลสินค้า</td></tr>';
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