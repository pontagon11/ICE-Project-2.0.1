/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    // โหลดข้อมูล User และวาด Sidebar
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // เช็กสิทธิ์การแก้ไข (ถ้าไม่มีสิทธิ์ให้เด้งออก)
    if (typeof hasPermission === "function") {
        if (!hasPermission("create_transactions")) { // ใช้สิทธิ์เดียวกับตัวสร้าง หรือสิทธิ์เฉพาะ edit_transactions
            alert("❌ คุณไม่มีสิทธิ์แก้ไขรายการความเคลื่อนไหว");
            window.location.href = "transactions.html";
            return;
        }
    }

    const saveBtn = document.getElementById("saveBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const typeEl = document.getElementById("tra_type");
    const itemTypeEl = document.getElementById("tra_item_type");
    const itemSelect = document.getElementById("tra_item_id");
    const qtyEl = document.getElementById("tra_qty");
    const noteEl = document.getElementById("tra_note");

    // ดึง ID จาก URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        alert("ไม่พบรหัสรายการที่ต้องการแก้ไข");
        window.location.href = "transactions.html";
        return;
    }

    // ================= LOAD ITEM DROPDOWN =================
    async function loadItems(itemType, selectedId = null) {
        if (!itemType) return;
        
        itemSelect.innerHTML = `<option value="">⌛ Loading Items...</option>`;
        const url = itemType === "product" ? "/products" : "/materials";

        try {
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
            const data = await res.json();

            let options = `<option value="">-- SELECT ITEM --</option>`;
            data.forEach(item => {
                const val = itemType === "product" ? item.pro_id : item.mat_id;
                const name = itemType === "product" ? item.pro_name : item.mat_name;
                const selected = (selectedId && String(selectedId) === String(val)) ? "selected" : "";
                options += `<option value="${val}" ${selected}>${name}</option>`;
            });

            itemSelect.innerHTML = options;
        } catch (err) {
            console.error(err);
            itemSelect.innerHTML = `<option value="">❌ Error loading items</option>`;
        }
    }

    // ================= LOAD EXISTING DATA =================
    try {
        const res = await fetch(`/transactions/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("ไม่พบข้อมูลรายการนี้");

        const data = await res.json();

        // เติมข้อมูลลงฟอร์ม
        typeEl.value = data.tra_type;
        itemTypeEl.value = data.tra_item_type;
        qtyEl.value = data.tra_qty;
        noteEl.value = data.tra_note || "";

        // โหลดรายการสินค้า/วัสดุ แล้วเลือกตัวที่ถูกเก็บไว้ใน DB
        await loadItems(data.tra_item_type, data.tra_item_id);

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการโหลดข้อมูลเดิม");
        window.location.href = "transactions.html";
    }

    // เมื่อเปลี่ยนประเภท (Product/Material) ให้โหลดรายการใหม่
    itemTypeEl.addEventListener("change", async () => {
        await loadItems(itemTypeEl.value);
    });

    // ================= UPDATE TRANSACTION =================
    saveBtn.addEventListener("click", async () => {
        const type = typeEl.value;
        const itemType = itemTypeEl.value;
        const itemId = itemSelect.value;
        const qty = parseFloat(qtyEl.value);
        const note = noteEl.value.trim();

        if (!type || !itemType || !itemId || isNaN(qty)) {
            alert("กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = "Updating...";

            const res = await fetch(`/transactions/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ type, itemType, itemId, qty, note })
            });

            if (res.ok) {
                alert("แก้ไขรายการสำเร็จ ✅");
                window.location.href = "transactions.html";
            } else {
                const result = await res.json();
                alert(result.message || "แก้ไขไม่สำเร็จ");
                saveBtn.disabled = false;
                saveBtn.textContent = "UPDATE";
            }
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            saveBtn.disabled = false;
            saveBtn.textContent = "UPDATE";
        }
    });

    // ================= CANCEL =================
    cancelBtn.addEventListener("click", () => {
        window.location.href = "transactions.html";
    });
});