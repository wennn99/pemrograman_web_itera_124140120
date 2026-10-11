# Folder Modul

Folder `modul/` disediakan sebagai tempat dokumen pendukung tugas praktikum Pemrograman Web (misalnya catatan modul, lembar kerja, atau materi pertemuan).

Untuk tugas **Mini POS – Aplikasi Kasir & Keranjang Belanja**, seluruh kode aplikasi berada di folder induk (`index.html`, `style.css`, `script.js`), sehingga folder ini cukup berisi keterangan ini.

## Identitas

- Nama: Yowen Daniel
- NIM: 124140120
- Kelas: PAW RA

## Pemetaan Kompetensi ke Aplikasi

| Kompetensi | Implementasi | Lokasi |
|---|---|---|
| Validasi input form | Fungsi `validateForm()` mengecek nama, harga, dan qty, lalu menampilkan pesan error merah di bawah input | `script.js` |
| Kalkulator / hitung otomatis | Fungsi `calculateTotal()`, `calculateDiscount()`, `calculatePayment()`, dan `formatRupiah()` | `script.js` |
| Manajemen keranjang (array) | Array `cart` beserta fungsi `addItem()`, `deleteItem()`, dan `renderCart()` | `script.js` |
| localStorage | Fungsi `saveCart()` (`JSON.stringify()`) dan `loadCart()` (`JSON.parse()`) dengan key `miniPOSCart` | `script.js` |
| Desain responsif | Grid layout, card, dan media query untuk desktop & mobile | `style.css` |
