# Folder Modul

Folder `modul/` disediakan sebagai tempat dokumen pendukung tugas praktikum Pemrograman Web (misalnya catatan modul, lembar kerja, atau materi pertemuan).

Untuk tugas **KelasKu — Dashboard Jadwal Kuliah & Cuaca Kampus ITERA**, seluruh kode aplikasi berada di folder induk (`index.html`, `style.css`, `script.js`), sehingga folder ini cukup berisi keterangan ini.

## Identitas

- Nama: Yowen Daniel
- NIM: 124140120
- Kelas: PAW RA
- Pertemuan: 2
- Tema: Tantangan Kreatif — aplikasi pendukung produktivitas mahasiswa

## Pemetaan Kompetensi ke Aplikasi

| Kompetensi | Implementasi | Lokasi |
|---|---|---|
| Class & Object-Oriented Programming | `class AgendaItem` (dasar), `class CourseItem` dan `class ExamItem` (`extends` + `super()`), serta `class DashboardApp` sebagai pengelola state | `script.js` baris 116, 193, 205, 224 |
| Getter & static method | Getter `durationLabel`, `timeRange`, `badgeLabel`; static `createId()`, `fromJSON()`, `demoSchedule()` | `script.js` baris 140, 145, 151–186, 200, 212, 302 |
| Destructuring & spread operator | `const { type, ...rest } = formValues`, `[...this.#courses, course]`, `{ ...course.toJSON(), ...rest }` | `script.js` baris 385–411 |
| Operasi asinkron (Async/Await + Promise) | `async loadWeather()` dan `async loadQuote()` memanggil `fetch()`, dijalankan paralel dengan `Promise.allSettled()` | `script.js` baris 803, 841, 946 |
| Pengelolaan data & localStorage | `save()` / `loadFromStorage()` dengan `JSON.stringify()` + `JSON.parse()`, key `kelasKu.schedule.v1`; cache API dengan key `kelasKu.meta.v1` | `script.js` baris 280, 297, 786, 794 |
| Validasi input form | `validateForm()` mengecek nama, hari, jam mulai/selesai, durasi, dan SKS, lalu menampilkan pesan error merah di bawah field | `script.js` baris 425–454 |
| Manipulasi DOM modern | `<template>` + `cloneNode()`, `DocumentFragment`, `replaceChildren()`, event delegation `closest()` | `index.html` (template kartu) dan `script.js` baris 610, 633–671, 912–936 |
| Desain responsif | Grid `auto-fit` + dua media query (900px & 640px) + dukungan `prefers-reduced-motion` | `style.css` baris 243, 772, 996, 1007, 1036 |

Dokumentasi lengkap (deskripsi fitur, screenshot, daftar 28 fitur ES6+ beserta baris kodenya, dan hasil pengujian) ada di `README.md` pada folder induk pertemuan ini.
