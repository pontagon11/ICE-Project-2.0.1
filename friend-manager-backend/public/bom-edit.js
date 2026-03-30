/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    //  โหลดข้อมูล User และวาด Sidebar
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // GUARD PAGE: เช็กสิทธิ์การแก้ไข BOM
    if (typeof hasPermission === "function") {
        if (!hasPermission("edit_bom")) {
            alert("❌ คุณไม่มีสิทธิ์แก้ไขสูตรการผลิต");
            window.location.href = "bom.html";
            return;
        }
    }

    // ดึง ID จาก URL
    const params = new URLSearchParams(window.location.search);
    const bomId = params.get("id");

    if (!bomId) {
        alert("ไม่พบรหัสสูตรการผลิต (BOM ID)");
        window.location.href = "bom.html";
        return;
    }

    const bomNoInput = document.getElementById("bomNo");
    const productSelect = document.getElementById("productSelect");
    const materialSelect = document.getElementById("materialSelect");
    const usageQtyInput = document.getElementById("usageQty");
    const materialTableBody = document.getElementById("materialTableBody");
    const addMaterialBtn = document.getElementById("addMaterialBtn");
    const saveBomBtn = document.getElementById("saveBomBtn");

    let bomDetails = []; // เก็บรายการวัตถุดิบในสูตร

    /* ================= LOAD EXISTING BOM DATA ================= */
    async function loadBom() {
        try {
            const res = await fetch(`/bom/${bomId}`, { credentials: "include" });
            const data = await res.json();

            if (!res.ok) {
                alert(data.message || "โหลดข้อมูล BOM ไม่สำเร็จ");
                window.location.href = "bom.html";
                return;
            }

            // แสดงข้อมูลหลัก (สินค้าแก้ไขไม่ได้ในหน้า Edit ปกติจะ Lock ไว้)
            bomNoInput.value = data.bom_no || "";
            productSelect.innerHTML = `
                <option value="${data.pro_id}" selected>
                    ${data.pro_no || ''} - ${data.pro_name || 'Unknown Product'}
                </option>
            `;
            productSelect.disabled = true; // ล็อคไม่ให้เปลี่ยนสินค้า

            // โหลดรายการวัตถุดิบเดิม
            bomDetails = data.details || [];
            renderTable();

        } catch (err) {
            console.error("Load BOM error:", err);
            alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        }
    }

    /* ================= LOAD AVAILABLE MATERIALS ================= */
    async function loadMaterials() {
        try {
            const res = await fetch("/materials", { credentials: "include" });
            const data = await res.json();
            if (!res.ok) return;

            materialSelect.innerHTML = `<option value="">-- เพิ่มวัตถุดิบใหม่ --</option>`;
            data.forEach(m => {
                const option = document.createElement("option");
                option.value = m.mat_id;
                option.dataset.no = m.mat_no;
                option.dataset.name = m.mat_name;
                option.textContent = `${m.mat_no || ''} - ${m.mat_name}`;
                materialSelect.appendChild(option);
            });
        } catch (err) {
            console.error("Load materials error:", err);
        }
    }

    /* ================= ADD MATERIAL TO LIST ================= */
    addMaterialBtn.addEventListener("click", () => {
        const matId = materialSelect.value;
        const usageQty = parseFloat(usageQtyInput.value);

        if (!matId || isNaN(usageQty) || usageQty <= 0) {
            alert("กรุณาเลือกวัตถุดิบและระบุจำนวนการใช้");
            return;
        }

        // ตรวจสอบรายการซ้ำ (เช็กจาก ID)
        if (bomDetails.some(d => String(d.mat_id) === String(matId))) {
            alert("วัตถุดิบนี้มีอยู่ในสูตรแล้ว หากต้องการเปลี่ยนจำนวนให้ลบแล้วเพิ่มใหม่");
            return;
        }

        const selected = materialSelect.options[materialSelect.selectedIndex];

        bomDetails.push({
            mat_id: matId,
            mat_no: selected.dataset.no,
            mat_name: selected.dataset.name,
            usage_qty: usageQty
        });

        renderTable();
        usageQtyInput.value = "";
        materialSelect.value = "";
    });

    /* ================= RENDER TABLE ================= */
    function renderTable() {
        materialTableBody.innerHTML = "";

        bomDetails.forEach((d, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${d.mat_no || '-'}</td>
                <td><strong>${d.mat_name || '-'}</strong></td>
                <td class="text-right">${Number(d.usage_qty).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-center">
                    <button class="btn-delete-small" data-index="${index}">🗑️</button>
                </td>
            `;
            materialTableBody.appendChild(row);
        });

        // ผูก Event ให้ปุ่มลบ
        document.querySelectorAll(".btn-delete-small").forEach(btn => {
            btn.onclick = () => {
                const idx = btn.dataset.index;
                bomDetails.splice(idx, 1);
                renderTable();
            };
        });
    }

    /* ================= SAVE CHANGES (PUT) ================= */
    saveBomBtn.addEventListener("click", async () => {
        if (bomDetails.length === 0) {
            alert("สูตรการผลิตต้องมีวัตถุดิบอย่างน้อย 1 รายการ");
            return;
        }

        if (!confirm("ยืนยันการแก้ไขสูตรการผลิตนี้?")) return;

        saveBomBtn.disabled = true;
        saveBomBtn.textContent = "Updating...";

        const payload = {
            details: bomDetails.map(d => ({
                mat_id: Number(d.mat_id),
                usage_qty: Number(d.usage_qty)
            }))
        };

        try {
            const res = await fetch(`/bom/${bomId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("แก้ไข BOM เรียบร้อยแล้ว ✅");
                window.location.href = "bom.html";
            } else {
                const result = await res.json();
                alert(result.message || "แก้ไขไม่สำเร็จ");
                saveBomBtn.disabled = false;
                saveBomBtn.textContent = "UPDATE BOM";
            }
        } catch (err) {
            console.error("PUT error:", err);
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            saveBomBtn.disabled = false;
        }
    });

    /* ================= 🏁 INIT ================= */
    loadBom();
    loadMaterials();
});