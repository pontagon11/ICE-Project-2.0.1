const API_QC = "/qc";
const API_PRODUCTS = "/products";
const API_MATERIALS = "/materials";
const API_EMP = "/employees";

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    // 1. โหลดข้อมูล User และวาด Sidebar (กันเมนูหาย)
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // 2. เช็กสิทธิ์การสร้าง QC
    if (typeof hasPermission === "function") {
        if (!hasPermission("create_qc")) {
            await swalError("คุณไม่มีสิทธิ์บันทึกการตรวจสอบคุณภาพ");
            window.location.href = "/qc/qc.html";
            return;
        }
    }

    // 3. โหลดข้อมูลเริ่มต้น
    await loadEmployees();
    await loadItems();

    // 4. ผูก Event Listeners
    document.getElementById("itemType")?.addEventListener("change", loadItems);
});

/* ====================== LOAD ITEMS (PROD / MAT) ====================== */
async function loadItems() {
    const select = document.getElementById("itemSelect");
    const type = document.getElementById("itemType")?.value;
    if (!select || !type) return;

    try {
        select.innerHTML = `<option value="">-- Loading Items... --</option>`;

        const url = type === "product" ? API_PRODUCTS : API_MATERIALS;
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json();

        let html = `<option value="">-- Select ${type === "product" ? "Product" : "Material"} --</option>`;
        
        data.forEach(item => {
            const id = type === "product" ? item.pro_id : item.mat_id;
            const name = type === "product" ? item.pro_name : item.mat_name;
            html += `<option value="${id}">${name}</option>`;
        });

        select.innerHTML = html;

    } catch (err) {
        console.error("Load items error:", err);
        select.innerHTML = `<option value="">Error loading data</option>`;
    }
}

/* ====================== LOAD EMPLOYEES ====================== */
async function loadEmployees() {
    const select = document.getElementById("empSelect");
    if (!select) return;

    try {
        const res = await fetch(API_EMP, { credentials: "include" });
        const data = await res.json();

        let html = `<option value="">-- Select Employee --</option>`;
        
        data.forEach(emp => {
            // เช็กว่าพนักงานคนนี้คือคนที่ล็อกอินอยู่หรือไม่ (ถ้าใช่ให้ตั้งเป็น default)
            const isMe = emp.emp_id === (currentUser?.emp_id || currentUser?.id);
            html += `<option value="${emp.emp_id}" ${isMe ? 'selected' : ''}>
                        ${emp.emp_fname} ${emp.emp_lname}
                    </option>`;
        });

        select.innerHTML = html;

    } catch (err) {
        console.error("Load employees error:", err);
    }
}

/* ====================== SUBMIT QC FORM ====================== */
document.getElementById("qcForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const item_id = document.getElementById("itemSelect").value;
    const item_type = document.getElementById("itemType").value;
    const emp_id = document.getElementById("empSelect").value;
    const qc_note = document.getElementById("qcNote")?.value || ""; // เพิ่มส่วนของ Note (ถ้ามี)

    if (!item_id || !item_type || !emp_id) {
        await swalError("กรุณาเลือกข้อมูลให้ครบถ้วน");
        return;
    }

    try {
        // ปิดปุ่มชั่วคราวขณะบันทึก
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";
        }

        const res = await fetch(API_QC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ item_id, item_type, emp_id, qc_note })
        });

        if (res.ok) {
            await swalSuccess("บันทึกผลการตรวจสอบ QC เรียบร้อยแล้ว");
            window.location.href = "/qc/qc.html";
        } else {
            const result = await res.json();
            await swalError(result.message || "สร้าง QC ไม่สำเร็จ");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "SAVE QC";
            }
        }

    } catch (err) {
        console.error("QC Submit Error:", err);
        await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "SAVE QC";
        }
    }
});

/* ====================== CANCEL ====================== */
document.getElementById("cancelBtn")?.addEventListener("click", () => {
    window.location.href = "/qc/qc.html";
});