document.addEventListener("DOMContentLoaded", async () => {

  /* ================= INITIALIZATION ================= */
  // โหลดข้อมูล User และสิทธิ์ล่าสุดจาก Server
  if (typeof loadUser === "function") {
    await loadUser();
  }

  // สั่งวาด Sidebar และ Navbar ทันที
  if (typeof renderSidebar === "function") {
    renderSidebar();
  }

  // เช็กสิทธิ์การแก้ไขสินค้า
  if (typeof hasPermission === "function") {
    if (!hasPermission("edit_products")) {
      alert("No permission (คุณไม่มีสิทธิ์แก้ไขสินค้านี้)");
      window.location.href = "products.html";
      return;
    }
  }

  /* ================= GET PRODUCT ID ================= */
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  if (!productId) {
    alert("ไม่พบรหัสสินค้า (Product ID)");
    window.location.href = "products.html";
    return;
  }

  // เริ่มโหลดข้อมูลสินค้า และตั้งค่าปุ่มต่างๆ
  loadProduct(productId);
  setupImageUpload();
  setupButtons(productId);
});

/* ================= LOAD DATA ================= */
async function loadProduct(id) {
  try {
    const res = await fetch(`/products/${id}`, { credentials: "include" });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "ไม่พบข้อมูลสินค้า");
      window.location.href = "products.html";
      return;
    }

    // นำข้อมูลไปใส่ใน Input แต่ละช่อง
    document.getElementById("pro_name").value = data.pro_name || "";
    document.getElementById("pro_qty").value = data.pro_qty || 0;
    document.getElementById("pro_price").value = data.pro_price || 0;
    document.getElementById("pro_weight").value = data.pro_weight || 0;
    document.getElementById("pro_status").value = data.pro_status || "";

    // แสดงรูปภาพเดิม (ถ้ามี)
    if (data.pro_img) {
      const previewImg = document.getElementById("previewImg");
      previewImg.src = data.pro_img;
      previewImg.style.display = "block";
    }

  } catch (err) {
    console.error("Load product error:", err);
    alert("โหลดข้อมูลล้มเหลว");
  }
}

/* ================= IMAGE PREVIEW ================= */
function setupImageUpload() {
  const chooseBtn = document.getElementById("chooseImageBtn");
  const fileInput = document.getElementById("pro_img");
  const previewImg = document.getElementById("previewImg");

  chooseBtn?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      fileInput.value = "";
      return;
    }

    // ใช้ URL.createObjectURL เพื่อความรวดเร็ว
    previewImg.src = URL.createObjectURL(file);
    previewImg.style.display = "block";
  });
}

/* ================= BUTTONS ACTION ================= */
function setupButtons(id) {
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  cancelBtn?.addEventListener("click", () => {
    window.location.href = "products.html";
  });

  saveBtn?.addEventListener("click", async () => {
    const name = document.getElementById("pro_name").value.trim();
    const qty = parseInt(document.getElementById("pro_qty").value) || 0;
    const price = parseFloat(document.getElementById("pro_price").value);
    const weight = parseFloat(document.getElementById("pro_weight").value) || 0;
    const status = document.getElementById("pro_status").value;
    const fileInput = document.getElementById("pro_img");

    if (!name || isNaN(price) || !status) {
      alert("กรุณากรอกข้อมูลให้ครบและถูกต้อง");
      return;
    }

    // เปลี่ยนสถานะปุ่มกันกดซ้ำ
    saveBtn.disabled = true;
    saveBtn.textContent = "Updating...";

    const formData = new FormData();
    formData.append("pro_name", name);
    formData.append("pro_qty", qty);
    formData.append("pro_price", price);
    formData.append("pro_weight", weight);
    formData.append("pro_status", status);

    if (fileInput.files[0]) {
      formData.append("pro_img", fileInput.files[0]);
    }

    try {
      const res = await fetch(`/products/${id}`, {
        method: "PUT",
        body: formData,
        credentials: "include"
      });

      if (res.ok) {
        alert("แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว ✅");
        window.location.href = "products.html";
      } else {
        const result = await res.json();
        alert(result.message || "แก้ไขไม่สำเร็จ");
        saveBtn.disabled = false;
        saveBtn.textContent = "SAVE";
      }
    } catch (err) {
      console.error("Update product error:", err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
      saveBtn.disabled = false;
      saveBtn.textContent = "SAVE";
    }
  });
}