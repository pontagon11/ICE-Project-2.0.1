document.addEventListener("DOMContentLoaded", async () => {

    /* ================= INITIALIZATION ================= */
    // โหลดข้อมูล User และ Sidebar (ถ้ามีฟังก์ชันกลาง)
    if (typeof loadUser === "function") await loadUser();
    if (typeof renderSidebar === "function") renderSidebar();

    // เช็กสิทธิ์การแก้ไข (ดึงจาก localStorage ที่เก็บไว้ตอน Login)
    const perms = JSON.parse(localStorage.getItem("permissions")) || [];
    const canEdit = perms.some(p => p.perm_name === "edit_materials");

    if (!canEdit) {
        alert("❌ คุณไม่มีสิทธิ์แก้ไขข้อมูลวัตถุดิบ");
        window.location.href = "materials.html";
        return;
    }

    /* ================= ดึง ID จาก URL ================= */
    const params = new URLSearchParams(window.location.search);
    const matId = params.get("id");

    if (!matId) {
        alert("ไม่พบรหัสวัตถุดิบที่ต้องการแก้ไข");
        window.location.href = "materials.html";
        return;
    }

    // ===== HTML ELEMENTS =====
    const nameEl = document.getElementById("edit_mat_name");
    const weightEl = document.getElementById("edit_mat_weight");
    const priceEl = document.getElementById("edit_mat_price");
    const sizeEl = document.getElementById("edit_mat_size");
    const qtyEl = document.getElementById("edit_mat_qty");
    const statusEl = document.getElementById("edit_mat_status");

    const imageInput = document.getElementById("edit_mat_img");
    const previewImg = document.getElementById("edit_previewImg");
    const chooseImgBtn = document.getElementById("chooseEditImageBtn");

    const saveBtn = document.getElementById("editSaveBtn");
    const cancelBtn = document.getElementById("editCancelBtn");

    /* ================= LOAD OLD DATA ================= */
    try {
        const res = await fetch(`/materials/${matId}`, { credentials: "include" });
        const m = await res.json();

        if (!res.ok) {
            alert(m.message || "โหลดข้อมูลวัตถุดิบไม่สำเร็จ");
            window.location.href = "materials.html";
            return;
        }

        // ใส่ข้อมูลเดิมลงในฟอร์ม
        nameEl.value = m.mat_name || "";
        weightEl.value = m.mat_weight ?? "";
        priceEl.value = m.mat_price ?? "";
        sizeEl.value = m.mat_size ?? "";
        qtyEl.value = m.mat_qty ?? "";
        statusEl.value = m.mat_status || "";

        // แสดงรูปภาพเดิม (ถ้ามี)
        if (m.mat_img) {
            // ปรับ Path ให้ตรงกับโฟลเดอร์ที่เก็บรูปใน Server
            previewImg.src = m.mat_img.startsWith('http') ? m.mat_img : `/uploads/materials/${m.mat_img}`;
            previewImg.style.display = "block";
        }

    } catch (err) {
        console.error("Load material error:", err);
        alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    }

    /* ================= IMAGE PREVIEW ================= */
    let currentPreviewUrl = null;

    chooseImgBtn?.addEventListener("click", () => imageInput.click());

    imageInput?.addEventListener("change", () => {
        const file = imageInput.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
            imageInput.value = "";
            return;
        }

        // ล้างหน่วยความจำของ URL เก่า (ถ้ามี)
        if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);

        currentPreviewUrl = URL.createObjectURL(file);
        previewImg.src = currentPreviewUrl;
        previewImg.style.display = "block";
    });

    /* ================= SAVE CHANGES ================= */
    saveBtn.addEventListener("click", async () => {
        const matName = nameEl.value.trim();
        const matPrice = parseFloat(priceEl.value);
        const matStatus = statusEl.value;

        if (!matName || isNaN(matPrice) || !matStatus) {
            alert("⚠️ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
            return;
        }

        const formData = new FormData();
        formData.append("mat_name", matName);
        formData.append("mat_weight", parseFloat(weightEl.value) || 0);
        formData.append("mat_price", matPrice);
        formData.append("mat_size", sizeEl.value || "");
        formData.append("mat_qty", parseInt(qtyEl.value) || 0);
        formData.append("mat_status", matStatus);

        if (imageInput.files.length > 0) {
            formData.append("mat_img", imageInput.files[0]);
        }

        try {
            saveBtn.disabled = true;
            const originalBtnText = saveBtn.textContent;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Updating...`;

            const res = await fetch(`/materials/${matId}`, {
                method: "PUT",
                body: formData,
                credentials: "include"
            });

            const result = await res.json();

            if (res.ok) {
                alert("แก้ไขข้อมูลวัตถุดิบสำเร็จ ✅");
                window.location.href = "materials.html";
            } else {
                alert(result.message || "แก้ไขไม่สำเร็จ");
                saveBtn.disabled = false;
                saveBtn.textContent = originalBtnText;
            }

        } catch (err) {
            console.error("Update error:", err);
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            saveBtn.disabled = false;
            saveBtn.textContent = "SAVE CHANGES";
        }
    });

    /* ================= CANCEL ================= */
    cancelBtn.addEventListener("click", () => {
        if (confirm("คุณต้องการยกเลิกการแก้ไขใช่หรือไม่? ข้อมูลที่กรอกไว้จะไม่ถูกบันทึก")) {
            window.location.href = "materials.html";
        }
    });
});