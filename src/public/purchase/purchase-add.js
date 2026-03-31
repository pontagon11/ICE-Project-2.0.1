const API_PURCHASE = "/purchase";
const API_MATERIAL = "/materials";

let materials = [];
let items = [];

/* ======================
  INITIALIZATION
====================== */
document.addEventListener("DOMContentLoaded", async () => {
    // 1. ดึงข้อมูล User (จะไปเรียก /me ใน server.js)
    const user = await checkLogin();
    console.log("🔍 ตรวจสอบข้อมูล User:", user);
    if (!user) {
        window.location.href = "/";
        return;
    }

    const profileImg = document.getElementById("navProfileImg");
    if (profileImg) {

        const imgSrc = user.emp_img || localStorage.getItem("emp_img");

        profileImg.src = imgSrc ? `/img/emp/${imgSrc}?t=${new Date().getTime()}` : "/img/Haro.webp";

        profileImg.onerror = function () {
            this.src = "/img/Haro.webp";
        };
    }
    // เก็บ User ไว้ใน window เพื่อให้ savePO ดึงไปใช้ได้
    window.currentUser = user;

    // 2. เช็คสิทธิ์
    let userPermissions = user.permissions || [];
    if (typeof userPermissions === 'string') {
        try { userPermissions = JSON.parse(userPermissions); } catch (e) { }
    }

    if (!userPermissions.includes("create_purchase")) {
        await swalError("คุณไม่มีสิทธิ์สร้างใบสั่งซื้อ");
        window.location.href = "/purchase/purchase.html";
        return;
    }

    // 3. โหลดข้อมูล
    await loadMaterials();
    await loadPONumber();

    // 4. ผูก Event
    document.getElementById("addItemBtn")?.addEventListener("click", addItem);
    document.getElementById("saveBtn")?.addEventListener("click", savePO);
    document.getElementById("cancelBtn")?.addEventListener("click", () => {
        window.location.href = "/purchase/purchase.html";
    });
    document.getElementById("materialSelect")?.addEventListener("change", updateStockPreview);

    // 5. ระบบ Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const { isConfirmed } = await swalConfirm("คุณต้องการออกจากระบบใช่หรือไม่?", "ออกจากระบบ");
            if (!isConfirmed) return;

            try {
                const res = await fetch("/logout", { method: "POST" });
                if (res.ok) {
                    window.location.href = "/";
                } else {
                    await swalError("Logout failed");
                }
                }
            } catch (err) {
                console.error("Logout error:", err);
            }
        });
    }
});

/* ======================
  LOAD MATERIAL
====================== */
async function loadMaterials() {
    try {
        const res = await fetch(API_MATERIAL); // ไม่ต้องใส่ credentials: "include" เพราะพอร์ตเดียวกัน
        const data = await res.json();

        if (!Array.isArray(data)) return;
        materials = data;

        const select = document.getElementById("materialSelect");
        let options = `<option value="">-- Select Material --</option>`;

        materials.forEach(m => {
            options += `<option value="${m.mat_id}" data-stock="${m.mat_qty || 0}">
                            ${m.mat_name} (${m.mat_no || 'N/A'})
                        </option>`;
        });
        select.innerHTML = options;
    } catch (err) {
        console.error("Load materials error:", err);
    }
}

/* ======================
  SHOW STOCK
====================== */
function updateStockPreview() {
    const select = document.getElementById("materialSelect");
    const stockDisplay = document.getElementById("currentStockDisplay");

    if (!select || !stockDisplay) return;

    const selectedOption = select.options[select.selectedIndex];
    const currentStock = parseFloat(selectedOption.getAttribute("data-stock")) || 0;

    stockDisplay.innerText = currentStock.toLocaleString();
    stockDisplay.style.color = currentStock <= 0 ? "red" : "black";
}

/* ======================
  LOAD PO NUMBER
====================== */
async function loadPONumber() {
    try {
        const res = await fetch("/purchase/next-po");
        const data = await res.json();
        const poInput = document.getElementById("poNo");
        if (poInput) poInput.value = data.po_no || "AUTO";
    } catch {
        const poInput = document.getElementById("poNo");
        if (poInput) poInput.value = "AUTO";
    }
}

/* ======================
  ➕ ADD ITEM
====================== */
function addItem() {
    const matSelect = document.getElementById("materialSelect");
    const qtyInput = document.getElementById("qtyInput");

    const mat_id = parseInt(matSelect.value);
    const mat_name = matSelect.options[matSelect.selectedIndex]?.text;
    const qty = parseInt(qtyInput.value);

    if (!mat_id || !qty || qty <= 0) {
        swalError("กรุณาเลือกวัตถุดิบและระบุจำนวน");
        return;
    }

    const exist = items.find(i => i.mat_id == mat_id);
    if (exist) {
        exist.qty += qty;
    } else {
        items.push({ mat_id, mat_name, qty });
    }

    renderTable();
    qtyInput.value = "";
    matSelect.focus();
}

/* ======================
  RENDER TABLE
====================== */
function renderTable() {
    const tbody = document.getElementById("itemTable");
    if (!tbody) return;

    let html = "";
    items.forEach((item, index) => {
        html += `
            <tr>
                <td>${item.mat_name}</td>
                <td class="text-center">${item.qty.toLocaleString()}</td>
                <td class="text-center">
                    <button type="button" class="btn-remove" onclick="removeItem(${index})">❌</button>
                </td>
            </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="3" class="text-center">ยังไม่มีรายการ</td></tr>';
}

function removeItem(index) {
    items.splice(index, 1);
    renderTable();
}

/* ======================
  SAVE PO (UPDATE ตาราง materials)
====================== */
async function savePO() {
    if (items.length === 0) {
        await swalError("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
        return;
    }

    const saveBtn = document.getElementById("saveBtn");
    try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        const note = document.getElementById("note")?.value || "";

        const res = await fetch(API_PURCHASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emp_id: window.currentUser?.emp_id, // ดึงจาก Session ที่โหลดมาตอนแรก
                items: items,
                note: note
            })
        });

        if (res.ok) {
            await swalSuccess("บันทึกการเพิ่มสต็อกสำเร็จ");
            window.location.href = "/purchase/purchase.html";
        } else {
            const result = await res.json();
            await swalError(result.message || "บันทึกไม่สำเร็จ");
            saveBtn.disabled = false;
            saveBtn.textContent = "SAVE PO";
        }
    } catch (err) {
        await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        saveBtn.disabled = false;
        saveBtn.textContent = "SAVE PO";
    }
}