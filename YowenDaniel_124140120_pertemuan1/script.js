/**
 * Mini POS - Aplikasi Kasir & Keranjang Belanja
 * Yowen Daniel | 124140120 | PAW RA
 *
 * Isi file ini:
 * 1. Validasi form tambah barang (JavaScript, bukan hanya atribut HTML)
 * 2. Kalkulator otomatis: subtotal, total belanja, diskon, pembayaran, kembalian
 * 3. Manajemen keranjang belanja dengan localStorage (JSON.stringify & JSON.parse)
 */

/* ================= KONSTANTA & STATE ================= */

const STORAGE_KEY = "miniPOSCart"; // key localStorage untuk menyimpan keranjang
const DISCOUNT_PERCENT = 10;       // diskon 10 persen
const MIN_DISCOUNT = 50000;        // minimal total belanja agar dapat diskon
const MIN_PRICE = 500;             // minimal harga satuan

// Array berisi isi keranjang (data utama di memori)
let cart = [];

/* ================= ELEMEN DOM ================= */

// Form tambah barang
const itemForm = document.getElementById("itemForm");
const nameInput = document.getElementById("itemName");
const priceInput = document.getElementById("itemPrice");
const qtyInput = document.getElementById("itemQty");

// Pesan error di bawah setiap input
const nameError = document.getElementById("nameError");
const priceError = document.getElementById("priceError");
const qtyError = document.getElementById("qtyError");

// Tabel keranjang
const cartBody = document.getElementById("cartBody");

// Ringkasan transaksi & pembayaran
const totalBelanjaEl = document.getElementById("totalBelanja");
const diskonEl = document.getElementById("diskonTotal");
const totalAkhirEl = document.getElementById("totalAkhir");
const payInput = document.getElementById("uangBayar");
const kembalianEl = document.getElementById("kembalian");
const paymentNote = document.getElementById("paymentNote");
const newTransactionBtn = document.getElementById("newTransactionBtn");

/* ================= FORMAT RUPIAH ================= */

/**
 * Mengubah angka menjadi format Rupiah Indonesia.
 * Contoh: 5000 -> "Rp5.000", 100000 -> "Rp100.000"
 */
function formatRupiah(angka) {
  const bulat = Math.round(Number(angka) || 0);
  const bertitik = String(bulat).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return "Rp" + bertitik;
}

/* ================= VALIDASI FORM ================= */

// Menampilkan pesan error pada elemen tertentu
function showError(element, message) {
  element.textContent = message;
}

// Menghapus seluruh pesan error
function clearErrors() {
  nameError.textContent = "";
  priceError.textContent = "";
  qtyError.textContent = "";
}

/**
 * Memvalidasi seluruh input form tambah barang.
 * Mengembalikan true jika semua input valid, selain itu false.
 * Pesan error ditampilkan tepat di bawah input yang bermasalah.
 */
function validateForm() {
  // Bersihkan pesan error lama sebelum validasi baru
  clearErrors();

  const nama = nameInput.value.trim();
  const hargaRaw = priceInput.value.trim();
  const qtyRaw = qtyInput.value.trim();
  let isValid = true;

  // --- Validasi Nama Barang ---
  if (nama === "") {
    showError(nameError, "Nama barang wajib diisi.");
    isValid = false;
  } else if (nama.length < 3) {
    showError(nameError, "Nama barang minimal 3 karakter.");
    isValid = false;
  }

  // --- Validasi Harga Satuan ---
  if (hargaRaw === "") {
    showError(priceError, "Harga satuan wajib diisi.");
    isValid = false;
  } else if (Number.isNaN(Number(hargaRaw))) {
    showError(priceError, "Harga satuan harus berupa angka.");
    isValid = false;
  } else {
    const harga = Number(hargaRaw);
    if (harga < 0) {
      showError(priceError, "Harga satuan tidak boleh negatif.");
      isValid = false;
    } else if (harga === 0) {
      showError(priceError, "Harga satuan tidak boleh 0.");
      isValid = false;
    } else if (harga < MIN_PRICE) {
      showError(priceError, "Harga satuan minimal Rp500.");
      isValid = false;
    }
  }

  // --- Validasi Qty ---
  if (qtyRaw === "") {
    showError(qtyError, "Qty wajib diisi.");
    isValid = false;
  } else if (Number.isNaN(Number(qtyRaw))) {
    showError(qtyError, "Qty harus berupa angka.");
    isValid = false;
  } else {
    const qty = Number(qtyRaw);
    if (!Number.isInteger(qty)) {
      showError(qtyError, "Qty harus berupa angka bulat.");
      isValid = false;
    } else if (qty < 1) {
      showError(qtyError, "Qty minimal 1.");
      isValid = false;
    }
  }

  return isValid;
}

/* ================= LOCALSTORAGE ================= */

// Menyimpan keranjang ke localStorage (array -> string)
function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

// Mengambil keranjang dari localStorage (string -> array)
function loadCart() {
  const data = localStorage.getItem(STORAGE_KEY);

  if (data === null) {
    cart = [];
    return;
  }

  try {
    const hasil = JSON.parse(data);
    cart = Array.isArray(hasil) ? hasil : [];
  } catch (error) {
    // Data tidak valid -> mulai dengan keranjang kosong (tanpa error di console)
    cart = [];
  }
}

/* ================= KERANJANG BELANJA ================= */

/**
 * Menambahkan barang ke keranjang (submit form).
 * Jika validasi gagal: barang TIDAK masuk keranjang dan form TIDAK di-reset.
 * Jika valid: barang masuk keranjang, form di-reset, pesan error dihapus.
 */
function addItem(event) {
  event.preventDefault();

  if (!validateForm()) {
    return; // masih ada error -> hentikan proses
  }

  const item = {
    nama: nameInput.value.trim(),
    harga: Number(priceInput.value.trim()),
    qty: Number(qtyInput.value.trim())
  };

  cart.push(item);
  saveCart();   // simpan ke localStorage
  renderCart(); // tampilkan tabel + hitung ulang total

  itemForm.reset(); // form otomatis di-reset
  clearErrors();    // pesan error dihapus
}

// Menghapus satu barang berdasarkan nomor urutan (index)
function deleteItem(index) {
  if (index < 0 || index >= cart.length) {
    return;
  }

  cart.splice(index, 1); // hapus dari array keranjang
  saveCart();            // perbarui localStorage
  renderCart();          // render ulang tabel + hitung ulang total/diskon/kembalian
}

// Mengubah teks & warna keterangan pembayaran
function setPaymentNote(text, statusClass) {
  paymentNote.textContent = text;
  paymentNote.className = "payment-note" + (statusClass ? " " + statusClass : "");
}

/**
 * Menampilkan seluruh isi keranjang ke dalam tabel,
 * lalu memperbarui ringkasan transaksi.
 */
function renderCart() {
  cartBody.innerHTML = "";

  if (cart.length === 0) {
    cartBody.innerHTML =
      '<tr><td class="empty-row" colspan="6">Keranjang kosong &mdash; silakan tambah barang.</td></tr>';
  } else {
    cart.forEach(function (item, index) {
      const subtotal = item.harga * item.qty; // Subtotal = Harga x Qty
      const row = document.createElement("tr");

      row.innerHTML =
        "<td>" + (index + 1) + "</td>" +
        "<td>" + escapeHtml(item.nama) + "</td>" +
        "<td>" + formatRupiah(item.harga) + "</td>" +
        "<td>" + item.qty + "</td>" +
        "<td>" + formatRupiah(subtotal) + "</td>" +
        '<td><button type="button" class="btn-delete" data-index="' + index + '">Hapus</button></td>';

      cartBody.appendChild(row);
    });
  }

  updateSummary();
}

// Mencegah karakter khusus HTML merusak tampilan tabel
function escapeHtml(teks) {
  return String(teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ================= KALKULATOR TOTAL ================= */

// Total Belanja = jumlah seluruh subtotal barang
function calculateTotal() {
  let total = 0;
  for (let i = 0; i < cart.length; i++) {
    total += cart[i].harga * cart[i].qty;
  }
  return total;
}

/**
 * Diskon = Total Belanja x 10% jika total >= Rp50.000, selain itu Rp0
 */
function calculateDiscount(total) {
  if (total >= MIN_DISCOUNT) {
    return total * (DISCOUNT_PERCENT / 100);
  }
  return 0;
}

// Memperbarui seluruh ringkasan: total, diskon, total akhir, kembalian
function updateSummary() {
  const total = calculateTotal();
  const diskon = calculateDiscount(total);
  const totalAkhir = total - diskon;

  totalBelanjaEl.textContent = formatRupiah(total);
  diskonEl.textContent = formatRupiah(diskon);
  totalAkhirEl.textContent = formatRupiah(totalAkhir);

  calculatePayment(); // kembalian ikut dihitung ulang
}

/* ================= KALKULATOR PEMBAYARAN ================= */

/**
 * Kembalian = Uang Bayar - Total Akhir.
 * - Uang Bayar < Total Akhir -> tampilkan "Uang belum mencukupi" (kembalian tidak negatif)
 * - Keranjang kosong -> pembayaran belum dianggap valid
 */
function calculatePayment() {
  const total = calculateTotal();
  const totalAkhir = total - calculateDiscount(total);
  const bayarRaw = payInput.value.trim();

  // Keranjang kosong -> pembayaran tidak valid
  if (cart.length === 0) {
    kembalianEl.textContent = formatRupiah(0);
    setPaymentNote("Belum ada barang di keranjang.", "");
    return;
  }

  // Uang bayar belum diisi / bukan angka
  if (bayarRaw === "" || Number.isNaN(Number(bayarRaw))) {
    kembalianEl.textContent = formatRupiah(0);
    setPaymentNote("Masukkan nominal uang bayar.", "");
    return;
  }

  const bayar = Number(bayarRaw);

  if (bayar < totalAkhir) {
    // Kembalian negatif tidak ditampilkan
    kembalianEl.textContent = formatRupiah(0);
    setPaymentNote("Uang belum mencukupi", "is-error");
  } else {
    kembalianEl.textContent = formatRupiah(bayar - totalAkhir);
    setPaymentNote("Pembayaran mencukupi.", "is-ok");
  }
}

/* ================= TRANSAKSI BARU ================= */

// Mengosongkan keranjang, localStorage, form, dan seluruh perhitungan
function resetTransaction() {
  const konfirmasi = confirm("Apakah Anda yakin ingin memulai transaksi baru?");
  if (!konfirmasi) {
    return;
  }

  cart = [];
  localStorage.removeItem(STORAGE_KEY); // hapus data keranjang di localStorage
  itemForm.reset();
  payInput.value = "";
  clearErrors();
  renderCart(); // render ulang -> total, diskon, total akhir, kembalian kembali Rp0
}

/* ================= EVENT LISTENER ================= */

// Tombol "Tambah ke Keranjang"
itemForm.addEventListener("submit", addItem);

// Hitung kembalian setiap kali kasir mengetik nominal uang bayar
payInput.addEventListener("input", calculatePayment);

// Tombol "Transaksi Baru"
newTransactionBtn.addEventListener("click", resetTransaction);

// Tombol "Hapus" di tabel (event delegation: satu listener untuk seluruh tabel)
cartBody.addEventListener("click", function (event) {
  const tombol = event.target;
  if (tombol.classList.contains("btn-delete")) {
    deleteItem(Number(tombol.dataset.index));
  }
});

/* ================= INISIALISASI ================= */

// Ambil keranjang dari localStorage (JSON.parse) lalu tampilkan
loadCart();
renderCart();
