import { useState } from "react";

function createInitialForm(editingProduct) {
  if (!editingProduct) {
    return {
      productName: "",
      brand: "",
      partNumber: "",
      description: "",
      category: "ทั่วไป",
    };
  }

  return {
    productName: editingProduct.product_name ?? "",
    brand: editingProduct.brand ?? "",
    partNumber: editingProduct.part_number ?? "",
    description: editingProduct.description ?? "",
    category: editingProduct.category ?? "ทั่วไป",
  };
}

function ProductForm({ editingProduct = null, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() =>
    createInitialForm(editingProduct),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const isEditing = Boolean(editingProduct);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      productName: formData.productName.trim(),
      brand: formData.brand.trim(),
      partNumber: formData.partNumber.trim(),
      description: formData.description.trim(),
      category: formData.category.trim() || "ทั่วไป",
    };

    if (!payload.productName || !payload.brand || !payload.partNumber) {
      setValidationError("กรุณากรอกชื่อสินค้า ยี่ห้อ และ Part Number ให้ครบ");
      return;
    }

    setValidationError("");
    setIsSubmitting(true);

    try {
      const success = await onSubmit(payload);

      if (success && !isEditing) {
        setFormData(createInitialForm(null));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    onCancel?.();
  }

  return (
    <section>
      <h2>{isEditing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="productName">ชื่อสินค้า</label>

          <input
            id="productName"
            name="productName"
            type="text"
            value={formData.productName}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label htmlFor="brand">ยี่ห้อ</label>

          <input
            id="brand"
            name="brand"
            type="text"
            value={formData.brand}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label htmlFor="partNumber">Part Number</label>

          <input
            id="partNumber"
            name="partNumber"
            type="text"
            value={formData.partNumber}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label htmlFor="category">หมวดหมู่</label>

          <input
            id="category"
            name="category"
            type="text"
            value={formData.category}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="description">รายละเอียด</label>

          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            disabled={isSubmitting}
            rows="4"
          />
        </div>

        {validationError && <p role="alert">{validationError}</p>}

        <div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "กำลังบันทึก..."
              : isEditing
                ? "บันทึกการแก้ไข"
                : "เพิ่มสินค้า"}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default ProductForm;
