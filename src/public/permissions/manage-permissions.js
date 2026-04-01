/* ==========================================
 CONFIG & API ENDPOINTS
========================================== */
const API_ROLES = "/permissions/roles";
const API_PERMS = "/permissions";

let allPermissions = []; // เก็บสิทธิ์ทั้งหมดที่โหลดจาก DB
/* ======================== 🗂️ GROUP CONFIG ======================== */
// โครงสร้างกลุ่มสิทธิ์สำหรับจัดหน้าจอ (UI Mapping)
const GROUPS = {
  "📊 Dashboard": ["view_dashboard"],
  "📦 Stock": ["view_stock", "view_stock_summary", "view_materials"],
  "🛒 Purchase": ["create_purchase", "view_purchase", "edit_purchase", "approve_po"],
  "📦 Products": ["create_products", "view_products", "edit_products"],
  "🧪 QC": ["create_qc", "view_qc"],
  "🧾 Transactions": ["view_transactions", "create_transactions", "edit_transactions"],
  "👥 Employees": ["create_employee", "view_employee", "edit_employee"],
  "📐 BOM": ["create_bom", "view_bom", "edit_bom"],
  "⚙️ Admin": ["manage_permissions"]
};

/* ==========================================
 INITIALIZATION (LOAD PAGE)
========================================== */
document.addEventListener("DOMContentLoaded", async () => {
    // 1. เช็กสิทธิ์การเข้าถึงหน้าจัดการ (Guard)
    if (!hasPermission("manage_permissions")) {
        await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        window.location.href = "/home/home.html";
        return;
    }

    // 2. โหลดข้อมูล (เรียงลำดับความสำคัญ)
    await loadAllPermissions(); // ต้องมีข้อมูลสิทธิ์ทั้งหมดก่อนถึงจะวาดกลุ่มได้
    await loadRoles();         // โหลดบทบาทและวาดหน้าจอ

    // 3. ผูกปุ่มบันทึก
    document.getElementById("saveBtn")?.addEventListener("click", savePermissions);
});

/* ==========================================
 DATA FETCHING
========================================== */
async function loadAllPermissions() {
    try {
        const res = await fetch(API_PERMS, { credentials: "include" });
        allPermissions = await res.json();
    } catch (err) {
        console.error("Load all perms error:", err);
    }
}

async function loadRoles() {
    try {
        const res = await fetch(API_ROLES, { credentials: "include" });
        const roles = await res.json();
        const select = document.getElementById("roleSelect");
        if (!select) return;

        select.innerHTML = "";
        roles.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r.role_id;
            opt.textContent = r.role_name;
            select.appendChild(opt);
        });

        // โหลดสิทธิ์ของ Role แรกที่เลือกไว้
        loadRolePermissions(select.value);

        select.addEventListener("change", (e) => loadRolePermissions(e.target.value));
    } catch (err) {
        console.error("Load roles error:", err);
    }
}

async function loadRolePermissions(roleId) {
    try {
        const res = await fetch(`/roles/${roleId}/permissions`, { credentials: "include" });
        const rolePerms = await res.json();
        const selectedPermNames = Array.isArray(rolePerms) ? rolePerms : [];

        renderPermissions(selectedPermNames);
    } catch (err) {
        console.error("Load role perms error:", err);
    }
}

/* ==========================================
 RENDERING (UI GENERATION)
========================================== */
function renderPermissions(selectedPermNames = []) {
    const container = document.getElementById("permList");
    if (!container) return;
    container.innerHTML = "";

    for (let groupName in GROUPS) {
        // สร้าง Card สำหรับแต่ละกลุ่ม
        const groupBox = document.createElement("div");
        groupBox.className = "permission-card mb-4 p-3 border rounded shadow-sm bg-white";

        // ส่วนหัวกลุ่ม (พร้อม Master Checkbox)
        const header = document.createElement("div");
        header.className = "group-header border-bottom pb-2 mb-3";
        header.innerHTML = `
            <label class="d-flex align-items-center mb-0" style="cursor:pointer;">
                <input type="checkbox" class="mr-2" style="transform: scale(1.2);" 
                       onchange="toggleGroup('${groupName}', this)">
                <h5 class="m-0 text-primary">${groupName}</h5>
            </label>
        `;
        groupBox.appendChild(header);

        // ส่วนรายการ Checkbox ย่อยในกลุ่ม
        const itemsRow = document.createElement("div");
        itemsRow.className = "row";

        GROUPS[groupName].forEach(pName => {
            const perm = allPermissions.find(p => p.perm_name === pName);
            if (!perm) return;

            const isChecked = selectedPermNames.includes(perm.perm_name);
            const col = document.createElement("div");
            col.className = "col-md-4 col-sm-6 mb-2"; // แบ่ง 3 คอลัมน์บนจอใหญ่
            col.innerHTML = `
                <label class="d-flex align-items-center p-1" style="font-weight:normal; cursor:pointer; font-size: 0.95rem;">
                    <input type="checkbox" name="perm_id" value="${perm.perm_id}" 
                           data-group="${groupName}" ${isChecked ? "checked" : ""}>
                    <span class="ml-2">${formatName(pName)}</span>
                </label>
            `;
            itemsRow.appendChild(col);
        });

        groupBox.appendChild(itemsRow);
        container.appendChild(groupBox);
    }
}

/* ==========================================
 INTERACTION & LOGIC
========================================== */
function toggleGroup(groupName, masterCheckbox) {
    const checkboxes = document.querySelectorAll(`input[data-group="${groupName}"]`);
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
    });
}

async function savePermissions() {
    const saveBtn = document.getElementById("saveBtn");
    const roleId = document.getElementById("roleSelect").value;

    // เลือกเฉพาะ Checkbox ที่ติ๊กเลือกสิทธิ์จริงๆ
    const checkedIds = [...document.querySelectorAll('input[name="perm_id"]:checked')]
        .map(cb => Number(cb.value));

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        const res = await fetch(`/roles/${roleId}/permissions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ permissions: checkedIds })
        });

        if (res.ok) {
            await swalSuccess("บันทึกสิทธิ์สำเร็จ");
            
            // ถ้าแก้สิทธิ์ของ Role ตัวเอง ให้เตือน Refresh
            const myUser = JSON.parse(localStorage.getItem("user"));
            if (myUser && myUser.role_id == roleId) {
                await swalInfo("สิทธิ์ของคุณเปลี่ยนแปลงแล้ว ระบบจะรีโหลดข้อมูลใหม่");
                window.location.reload();
            }
        } else {
            await swalError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
        }
    } catch (err) {
        console.error("Save error:", err);
        await swalError("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "SAVE PERMISSIONS";
    }
}

/* ==========================================
 HELPERS
========================================== */
function hasPermission(name) {
    const roleId = Number(localStorage.getItem("role") || 0);
    if (roleId === 1) return true;

    const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
    return perms.some(p => (typeof p === "string" ? p === name : p.perm_name === name));
}

function formatName(name) {
    // view_stock_summary -> View Stock Summary
    return name.split('_')
               .map(word => word.charAt(0).toUpperCase() + word.slice(1))
               .join(' ');
}
