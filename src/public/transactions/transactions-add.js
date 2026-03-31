/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {

    // 1. โหลดข้อมูล User และวาด Sidebar
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // 2. เช็กสิทธิ์การบันทึกรายการ
    if (typeof hasPermission === "function") {
        if (!hasPermission("create_transactions")) {
            await swalError("คุณไม่มีสิทธิ์บันทึกความเคลื่อนไหวสต็อค");
            window.location.href = "/transactions/transactions.html";
            return;
        }
    }

    const saveBtn = document.getElementById("saveBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const itemTypeEl = document.getElementById("tra_item_type");
    const itemSelect = document.getElementById("tra_item_id");

    // ================= LOAD ITEMS (Dynamic Dropdown) =================
    itemTypeEl?.addEventListener("change", async () => {
        const itemType = itemTypeEl.value;
        if (!itemType) {
            itemSelect.innerHTML = `<option value="">-- SELECT TYPE FIRST --</option>`;
            return;
        }

        itemSelect.innerHTML = `<option value="">⌛ Loading Items...</option>`;

        // เลือก URL ตามประเภทที่เลือก
        let url = itemType === "product" ? "/products" : "/materials";

        try {
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) throw new Error("Server error");

            const data = await res.json();
            
            let options = `<option value="">-- SELECT ITEM --</option>`;
            data.forEach(item => {
                const id = itemType === "product" ? item.pro_id : item.mat_id;
                const name = itemType === "product" ? item.pro_name : item.mat_name;
                options += `<option value="${id}">${name}</option>`;
            });

            itemSelect.innerHTML = options;

        } catch (err) {
            console.error("โหลดข้อมูลไม่สำเร็จ", err);
            itemSelect.innerHTML = `<option value="">❌ Error loading items</option>`;
        }
    });

    // ================= SAVE TRANSACTION =================
    saveBtn?.addEventListener("click", async () => {
        const type = document.getElementById("tra_type").value; // 'IN' หรือ 'OUT'
        const itemType = itemTypeEl.value;
        const itemId = itemSelect.value;
        const qty = parseFloat(document.getElementById("tra_qty").value);
        const note = document.getElementById("tra_note").value.trim();

        // Validate ข้อมูล
        if (!type || !itemType || !itemId || isNaN(qty) || qty <= 0) {
            await swalWarning("กรุณากรอกข้อมูลให้ครบถ้วน และระบุจำนวนที่ถูกต้อง");
            return;
        }

        try {
            // ปิดปุ่มเพื่อป้องกันการกดซ้ำ
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";

            const res = await fetch("/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    type,      // IN / OUT
                    itemType,  // product / material
                    itemId,
                    qty,
                    note
                })
            });

            const result = await res.json();

            if (res.ok) {
                await swalSuccess("บันทึกรายการสำเร็จ");
                window.location.href = "/transactions/transactions.html";
            } else {
                await swalError(result.message || "บันทึกไม่สำเร็จ");
                saveBtn.disabled = false;
                saveBtn.textContent = "SAVE";
            }

        } catch (err) {
            console.error("Transaction Error:", err);
            await swalError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
            saveBtn.disabled = false;
            saveBtn.textContent = "SAVE";
        }
    });

    // ================= CANCEL =================
    cancelBtn?.addEventListener("click", () => {
        window.location.href = "/transactions/transactions.html";
    });

});