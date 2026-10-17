'use strict';

/* =========================================================================
   KelasKu — Jadwal Kuliah & Cuaca Kampus ITERA
   Praktikum Pemrograman Web ITERA · Yowen Daniel (124140120) · PAW RA

   script.js — seluruh logika aplikasi (OOP, ES6+, localStorage, fetch API)
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. KONFIGURASI GLOBAL  (Object.freeze + nested template literal)
   ------------------------------------------------------------------------- */
const CONFIG = Object.freeze({
  storageKey: 'kelasKu.schedule.v1',
  metaKey: 'kelasKu.meta.v1',
  quoteCacheMs: 60 * 60 * 1000,
  weatherCacheMs: 30 * 60 * 1000,
  campus: Object.freeze({
    name: 'Kampus ITERA, Lampung Selatan',
    latitude: -5.36,
    longitude: 105.31,
    timezone: 'Asia/Jakarta',
  }),
  endpoints: Object.freeze({
    weather: 'https://api.open-meteo.com/v1/forecast',
    quote: 'https://dummyjson.com/quotes/random',
  }),
  currentParams: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
  dailyParams: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
});

/** Urutan hari yang dipakai di grid mingguan. */
const DAY_ORDER = Object.freeze(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']);

/** Terjemahan kode cuaca WMO (Open-Meteo) ke Bahasa Indonesia + ikon. */
const WEATHER_CODES = new Map([
  [0, { label: 'Cerah', icon: '☀️' }],
  [1, { label: 'Cerah Berawan', icon: '🌤️' }],
  [2, { label: 'Berawan', icon: '⛅' }],
  [3, { label: 'Mendung', icon: '☁️' }],
  [45, { label: 'Berkabut', icon: '🌫️' }],
  [48, { label: 'Kabut Beku', icon: '🌫️' }],
  [51, { label: 'Gerimis Ringan', icon: '🌦️' }],
  [53, { label: 'Gerimis', icon: '🌦️' }],
  [55, { label: 'Gerimis Lebat', icon: '🌧️' }],
  [61, { label: 'Hujan Ringan', icon: '🌧️' }],
  [63, { label: 'Hujan Sedang', icon: '🌧️' }],
  [65, { label: 'Hujan Lebat', icon: '⛈️' }],
  [80, { label: 'Hujan Lokal', icon: '🌦️' }],
  [81, { label: 'Hujan Lokal Sedang', icon: '🌧️' }],
  [82, { label: 'Hujan Lokal Lebat', icon: '⛈️' }],
  [95, { label: 'Badai Petir', icon: '⛈️' }],
  [96, { label: 'Badai Petir + Es', icon: '⛈️' }],
  [99, { label: 'Badai Petir Hebat', icon: '⛈️' }],
]);

/* -------------------------------------------------------------------------
   2. FUNGSI BANTU (helper) — arrow function, default parameter, destructuring
   ------------------------------------------------------------------------- */
const $ = (selector, scope = document) => scope.querySelector(selector);

/** Ubah "08:40" menjadi menit sejak tengah malam (500). */
const toMinutes = (time = '00:00') => {
  const [jam, menit] = time.split(':').map(Number);
  return (Number.isFinite(jam) ? jam : 0) * 60 + (Number.isFinite(menit) ? menit : 0);
};

/** Ubah menit menjadi "1j 40m". */
const toDurationLabel = (minutes) => {
  const jam = Math.floor(minutes / 60);
  const menit = minutes % 60;
  return `${jam > 0 ? `${jam}j ` : ''}${menit}m`;
};

/** Amankan teks sebelum dimasukkan ke innerHTML. */
const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

/** Waktu sekarang menurut zona Asia/Jakarta (tanpa perlu server). */
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.campus.timezone, weekday: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CONFIG.campus.timezone,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const WEEKDAY_TO_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const WEEKDAY_LABEL = { Mon: 'Senin', Tue: 'Selasa', Wed: 'Rabu', Thu: 'Kamis', Fri: 'Jumat', Sat: 'Sabtu', Sun: 'Minggu' };

const jakartaNow = (date = new Date()) => {
  const [jam, menit, detik] = timeFormatter.format(date).split(':').map(Number);
  const weekdayShort = weekdayFormatter.format(date);
  return {
    dayIndex: WEEKDAY_TO_INDEX[weekdayShort] ?? 0,
    dayName: WEEKDAY_LABEL[weekdayShort] ?? 'Senin',
    hour: jam,
    minute: menit,
    second: detik,
    minutes: jam * 60 + menit + detik / 60,
  };
};

/* -------------------------------------------------------------------------
   3. MODEL DATA (OOP)
   AgendaItem  = model dasar
     ├── CourseItem  = mata kuliah (punya dosen & SKS)
     └── ExamItem    = ujian/kuis (punya jenis & materi)
   ------------------------------------------------------------------------- */
class AgendaItem {
  constructor({
    id = AgendaItem.createId(),
    title = 'Tanpa Judul',
    day = 'Senin',
    start = '08:00',
    end = '09:40',
    room = '-',
    type = 'kuliah',
    attended = false,
    createdAt = Date.now(),
  } = {}) {
    this.id = id;
    this.title = title;
    this.day = day;
    this.start = start;
    this.end = end;
    this.room = room;
    this.type = type;
    this.attended = attended;
    this.createdAt = createdAt;
  }

  /* static method — pembuat id unik tanpa library */
  static createId() {
    return `agenda-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /* static factory — memilih subclass yang tepat dari data localStorage */
  static fromJSON(data = {}) {
    const Ctor = data.type === 'ujian' ? ExamItem : CourseItem;
    return new Ctor(data);
  }

  /* getters — nilai turunan yang selalu sinkron */
  get startMinutes() {
    return toMinutes(this.start);
  }

  get endMinutes() {
    return toMinutes(this.end);
  }

  get durationMinutes() {
    return Math.max(0, this.endMinutes - this.startMinutes);
  }

  get durationLabel() {
    return toDurationLabel(this.durationMinutes);
  }

  get timeRange() {
    return `${this.start}–${this.end}`;
  }

  get dayIndex() {
    return DAY_ORDER.indexOf(this.day);
  }

  get isExam() {
    return this.type === 'ujian';
  }

  get badgeLabel() {
    return this.timeRange;
  }

  get accentEmoji() {
    return this.isExam ? '📝' : '📘';
  }

  /* dipakai JSON.stringify() saat menyimpan ke localStorage */
  toJSON() {
    return { ...this };
  }
}

class CourseItem extends AgendaItem {
  constructor({ lecturer = 'Belum diisi', sks = 2, ...rest } = {}) {
    super({ ...rest, type: 'kuliah' });
    this.lecturer = lecturer;
    this.sks = sks;
  }

  get badgeLabel() {
    return `${this.timeRange} · ${this.sks} SKS`;
  }
}

class ExamItem extends AgendaItem {
  constructor({ kind = 'UTS', material = '-', ...rest } = {}) {
    super({ ...rest, type: 'ujian' });
    this.kind = kind;
    this.material = material;
  }

  get badgeLabel() {
    return `${this.kind} · ${this.timeRange}`;
  }

  get displayTitle() {
    return `${this.title} (${this.kind})`;
  }
}

/* -------------------------------------------------------------------------
   4. KELAS UTAMA APLIKASI — state, localStorage, dan pemanggilan fetch()
   ------------------------------------------------------------------------- */
class DashboardApp {
  #courses = [];          // state utama (array of AgendaItem)
  #editingId = null;      // id yang sedang diedit, null = mode tambah
  #activeDay = 'semua';   // filter hari aktif
  #toastTimer = null;     // timer toast

  constructor({ storageKey = CONFIG.storageKey } = {}) {
    this.els = this.#collectElements();
    this.loadFromStorage();
  }

  /* ---------- 4a. Ambil semua elemen DOM sekali saja ---------- */
  #collectElements() {
    return {
      clockTime: $('#clockTime'),
      clockDate: $('#clockDate'),
      quoteText: $('#quoteText'),
      quoteAuthor: $('#quoteAuthor'),
      quoteRefresh: $('#quoteRefresh'),

      nextContent: $('#nextContent'),
      nextBadge: $('#nextBadge'),
      countdown: $('#countdown'),
      cdDays: $('#cdDays'),
      cdHours: $('#cdHours'),
      cdMinutes: $('#cdMinutes'),
      cdSeconds: $('#cdSeconds'),

      weatherNow: $('#weatherNow'),
      weatherAdvice: $('#weatherAdvice'),
      weatherUpdated: $('#weatherUpdated'),
      forecast: $('#forecast'),

      stats: $('#stats'),
      progressBar: $('#progressBar'),
      progressText: $('#progressText'),

      form: $('#courseForm'),
      formTitle: $('#formTitle'),
      editingHint: $('#editingHint'),
      submitBtn: $('#submitBtn'),
      cancelEditBtn: $('#cancelEditBtn'),
      demoBtn: $('#demoBtn'),
      clearBtn: $('#clearBtn'),
      materialField: $('#materialField'),

      scheduleGrid: $('#scheduleGrid'),
      emptyState: $('#emptyState'),
      searchInput: $('#searchInput'),
      dayFilter: $('#dayFilter'),
      template: $('#courseCardTemplate'),
      toast: $('#toast'),
    };
  }

  /* ---------- 4b. localStorage ---------- */
  loadFromStorage() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) {
        // Pertama kali halaman dibuka → isi dengan jadwal contoh.
        this.#courses = DashboardApp.demoSchedule();
        this.save();
      } else {
        const parsed = JSON.parse(raw);
        this.#courses = Array.isArray(parsed) ? parsed.map(AgendaItem.fromJSON) : [];
      }
    } catch (error) {
      console.error('[KelasKu] Gagal membaca localStorage:', error);
      this.#courses = DashboardApp.demoSchedule();
    }
  }

  save() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.#courses.map((course) => course.toJSON())));
  }

  /* ---------- 4c. Data contoh (dipakai saat pertama kali & tombol demo) ---------- */
  static demoSchedule() {
    const demo = [
      { title: 'Pemrograman Web', lecturer: 'Tim Dosen PAW', day: 'Senin', start: '08:00', end: '09:40', room: 'Lab IF-2', sks: 3 },
      { title: 'Struktur Data', lecturer: 'Bpk. Rizal', day: 'Senin', start: '13:00', end: '14:40', room: 'Ruang B.204', sks: 3 },
      { title: 'Basis Data', lecturer: 'Ibu Sari', day: 'Selasa', start: '10:00', end: '11:40', room: 'Ruang A.105', sks: 3 },
      { title: 'Pemrograman Web', lecturer: 'Tim Dosen PAW', day: 'Rabu', start: '08:00', end: '09:40', room: 'Lab IF-2', sks: 3 },
      { title: 'Basis Data', kind: 'UTS', material: 'SQL, normalisasi, ERD', day: 'Rabu', start: '10:00', end: '11:40', room: 'Ruang A.105', type: 'ujian' },
      { title: 'Jaringan Komputer', lecturer: 'Bpk. Hendra', day: 'Kamis', start: '14:00', end: '16:30', room: 'Lab Jaringan', sks: 3 },
      { title: 'Bahasa Inggris Teknis', lecturer: 'Ibu Maya', day: 'Jumat', start: '09:00', end: '10:40', room: 'Ruang C.301', sks: 2 },
    ];
    return demo.map((item) => AgendaItem.fromJSON(item));
  }

  /* ---------- 4d. Query & perhitungan state ---------- */
  get courses() {
    return this.#courses;
  }

  /** Salinan array yang sudah diurutkan (dayIndex → jam mulai) tanpa mengubah state. */
  getSortedCourses(list = this.#courses) {
    return [...list].sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes);
  }

  /** Array baru berisi kelas yang lolos filter hari + kata kunci (immutable). */
  getFilteredCourses() {
    const keyword = this.els.searchInput.value.trim().toLowerCase();

    return this.courses.filter((course) => {
      const matchesDay = this.#activeDay === 'semua' || course.day === this.#activeDay;
      const matchesKeyword =
        keyword === '' ||
        [course.title, course.lecturer, course.room].some((field) => String(field ?? '').toLowerCase().includes(keyword));
      return matchesDay && matchesKeyword;
    });
  }

  /** Cari point terdekat: kelas yang belum berakhir hari ini, atau kelas di hari berikutnya. */
  findNextAgenda() {
    const list = this.courses;
    if (list.length === 0) return null;

    const now = jakartaNow();
    const isSunday = now.dayIndex === 6;

    return this.#courses.reduce((best, course) => {
      if (course.dayIndex === -1) return best;

      let dayOffset = course.dayIndex - now.dayIndex;
      if (isSunday) dayOffset = course.dayIndex + 1;
      else if (dayOffset < 0) dayOffset += 7;

      const ongoing = dayOffset === 0 && course.startMinutes <= now.minutes && course.endMinutes > now.minutes;
      if (dayOffset === 0 && !ongoing && course.endMinutes <= now.minutes) dayOffset = 7;

      const targetMinutes = ongoing ? course.endMinutes : course.startMinutes;
      const diffMs = (dayOffset * 1440 + targetMinutes - now.minutes) * 60_000;
      const candidate = { item: course, dayOffset, diffMs, ongoing };

      return !best || candidate.diffMs < best.diffMs ? candidate : best;
    }, null);
  }

  /** Statistik ringkas untuk kartu "Ringkasan Minggu Ini". */
  getSummary() {
    const { total, sks, exams, attended } = this.courses.reduce(
      (acc, course) => ({
        total: acc.total + 1,
        sks: acc.sks + (course.isExam ? 0 : Number(course.sks) || 0),
        exams: acc.exams + (course.isExam ? 1 : 0),
        attended: acc.attended + (course.attended ? 1 : 0),
      }),
      { total: 0, sks: 0, exams: 0, attended: 0 },
    );

    const today = jakartaNow().dayName;
    const todayCount = this.courses.filter((course) => course.day === today).length;
    const progress = total === 0 ? 0 : Math.round((attended / total) * 100);

    return { total, sks, exams, attended, today, todayCount, progress };
  }

  /* ---------- 4e. Operasi CRUD ---------- */
  addCourse(formValues) {
    const { type, ...rest } = formValues; // destructuring: pisahkan field "type"
    const course = AgendaItem.fromJSON({ ...rest, type });
    this.#courses = [...this.#courses, course]; // spread → state baru, immutable
    this.save();
    return course;
  }

  updateCourse(id, formValues) {
    const { type, ...rest } = formValues;
    this.#courses = this.#courses.map((course) =>
      course.id === id ? AgendaItem.fromJSON({ ...course.toJSON(), ...rest, type, id }) : course,
    );
    this.save();
  }

  deleteCourse(id) {
    this.#courses = this.#courses.filter((course) => course.id !== id);
    this.save();
  }

  toggleAttendance(id, attended) {
    const course = this.findCourse(id);
    if (!course) return;

    // spread + factory → menghasilkan instance baru, bukan mengubah objek lama
    const updated = AgendaItem.fromJSON({ ...course.toJSON(), attended: Boolean(attended) });
    this.#courses = this.#courses.map((item) => (item.id === id ? updated : item));
    this.save();
  }

  replaceAll(courses) {
    this.#courses = courses;
    this.save();
  }

  findCourse(id) {
    return this.courses.find((course) => course.id === id) ?? null;
  }

  /* ---------- 4f. Validasi form ---------- */
  validateForm(values) {
    const errors = {};
    const { title, day, start, end, type, sks } = values;

    if (!title || title.trim().length < 3) errors.title = 'Nama mata kuliah minimal 3 karakter.';
    if (title && title.trim().length > 60) errors.title = 'Nama mata kuliah maksimal 60 karakter.';
    if (!DAY_ORDER.includes(day)) errors.day = 'Pilih hari yang valid (Senin–Sabtu).';

    if (toMinutes(end) <= toMinutes(start)) {
      errors.end = 'Jam selesai harus lebih besar dari jam mulai.';
    } else if (toMinutes(end) - toMinutes(start) < 40) {
      errors.end = 'Durasi minimal 40 menit.';
    }

    if (type === 'kuliah' && (Number(sks) < 1 || Number(sks) > 6)) {
      errors.sks = 'SKS harus antara 1 sampai 6.';
    }

    // Deteksi jadwal bentrok pada hari & jam yang sama.
    const clash = this.courses.find(
      (course) =>
        course.id !== this.#editingId &&
        course.day === day &&
        toMinutes(start) < course.endMinutes &&
        course.startMinutes < toMinutes(end),
    );
    if (clash && !errors.end) errors.end = `Bentrok dengan ${clash.title} (${clash.timeRange}).`;

    return errors;
  }

  /* ---------- 4g. Render: jam & tanggal ---------- */
  renderClock() {
    const now = new Date();
    this.els.clockTime.textContent = timeFormatter.format(now);
    this.els.clockDate.textContent = new Intl.DateTimeFormat('id-ID', {
      timeZone: CONFIG.campus.timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  }

  /* ---------- 4h. Render: kelas berikutnya + countdown ---------- */
  renderNextAgenda() {
    const next = this.findNextAgenda();

    if (!next) {
      this.els.nextBadge.textContent = 'kosong';
      this.els.nextContent.innerHTML = '<p class="muted">Belum ada jadwal. Tambahkan mata kuliah Anda di bawah.</p>';
      this.els.countdown.hidden = true;
      return;
    }

    const { item, dayOffset, ongoing, diffMs } = next;
    const dayLabel = ongoing ? 'Hari ini' : dayOffset === 0 ? 'Hari ini' : dayOffset === 1 ? 'Besok' : item.day;

    this.els.nextBadge.textContent = ongoing ? 'sedang berlangsung' : dayLabel;
    this.els.nextBadge.className = ongoing ? 'pill status-live' : 'pill';

    const detailRows = [
      `<span>🕒 <b>${item.timeRange}</b> (${item.durationLabel})</span>`,
      `<span>📍 <b>${escapeHtml(item.room)}</b></span>`,
      item.isExam
        ? `<span>🧪 <b>${escapeHtml(item.kind)}</b> · materi: ${escapeHtml(item.material)}</span>`
        : `<span>👤 <b>${escapeHtml(item.lecturer)}</b></span>`,
      `<span>🎓 <b>${item.isExam ? 'Ujian' : `${item.sks} SKS`}</b></span>`,
    ].join('');

    this.els.nextContent.innerHTML = `
      <h3>${item.accentEmoji} ${escapeHtml(item.title)}</h3>
      <div class="next-row">${detailRows}</div>
    `;

    this.renderCountdown(diffMs, ongoing);
  }

  renderCountdown(diffMs = 0, ongoing = false) {
    const els = this.els;
    els.countdown.hidden = false;

    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    els.cdDays.textContent = days;
    els.cdHours.textContent = String(hours).padStart(2, '0');
    els.cdMinutes.textContent = String(minutes).padStart(2, '0');
    els.cdSeconds.textContent = String(seconds).padStart(2, '0');
    els.countdown.lastElementChild.querySelector('small').textContent = ongoing ? 'detik (sisa)' : 'detik';
  }

  /* ---------- 4i. Render: cuaca (Open-Meteo) ---------- */
  renderWeather(data) {
    const current = data?.current ?? {};
    const code = WEATHER_CODES.get(current.weather_code) ?? { label: 'Tidak diketahui', icon: '🌡️' };

    this.els.weatherNow.innerHTML = `
      <span class="weather-icon" aria-hidden="true">${code.icon}</span>
      <div>
        <p class="weather-temp">${Math.round(current.temperature_2m)}°C</p>
        <p class="weather-desc">${code.label} · terasa ${Math.round(current.apparent_temperature)}°C</p>
        <p class="weather-detail">
          <span>💧 ${current.relative_humidity_2m}%</span>
          <span>🌬️ ${current.wind_speed_10m} km/j</span>
          <span>🌧️ ${current.precipitation} mm</span>
        </p>
      </div>
    `;

    const rainChance = data?.daily?.precipitation_probability_max?.[0] ?? 0;
    const advice = $('#weatherAdvice');
    const needUmbrella = rainChance >= 50 || current.precipitation > 0 || current.weather_code >= 51;
    advice.textContent = needUmbrella
      ? `☔ Kemungkinan hujan ${rainChance}% — siapkan payung/jas hujan sebelum ke kampus.`
      : `✅ Peluang hujan hanya ${rainChance}% — cuaca relatif aman untuk ke kampus.`;
    advice.classList.toggle('is-alert', needUmbrella);

    this.renderForecast(data?.daily);
    this.els.weatherUpdated.textContent = `diperbarui ${timeFormatter.format(new Date()).slice(0, 5)} WIB`;
  }

  renderForecast(daily = {}) {
    const { time = [], weather_code: codes = [], temperature_2m_max: maxs = [], temperature_2m_min: mins = [], precipitation_probability_max: rains = [] } = daily;

    if (time.length === 0) {
      this.els.forecast.innerHTML = '<li class="muted">Prakiraan tidak tersedia.</li>';
      return;
    }

    const dayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short' });
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.campus.timezone }).format(new Date());

    this.els.forecast.innerHTML = time
      .map((isoDate, index) => {
        const info = WEATHER_CODES.get(codes[index]) ?? { icon: '🌡️', label: '-' };
        const label = isoDate === todayKey ? 'Hari ini' : dayFormat.format(new Date(`${isoDate}T00:00:00`));
        return `
          <li title="${info.label}">
            <span class="fc-day">${label}</span>
            <span class="fc-icon">${info.icon}</span>
            <span class="fc-temp">${Math.round(maxs[index])}° / ${Math.round(mins[index])}°</span>
            <span class="fc-rain">💧${rains[index] ?? 0}%</span>
          </li>
        `;
      })
      .join('');
  }

  renderWeatherError(error) {
    console.error('[KelasKu] Gagal memuat cuaca:', error);
    this.els.weatherNow.innerHTML = '<p class="muted">⚠️ Data cuaca gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.</p>';
    this.els.forecast.innerHTML = '<li class="muted">Prakiraan tidak tersedia.</li>';
    $('#weatherAdvice').textContent = 'Cuaca tidak tersedia saat ini.';
  }

  /* ---------- 4j. Render: ringkasan, grid jadwal, filter ---------- */
  renderSummary() {
    const { total, sks, exams, today, todayCount, progress } = this.getSummary();

    this.els.stats.innerHTML = `
      <li><span>Total agenda</span><b>${total}</b></li>
      <li><span>Total SKS</span><b>${sks}</b></li>
      <li><span>Kelas hari ${today}</span><b>${todayCount}</b></li>
      <li><span>Agenda ujian</span><b>${exams}</b></li>
    `;
    this.els.progressBar.style.width = `${progress}%`;
    this.els.progressText.textContent = `${progress}%`;
  }

  renderFilters() {
    const options = ['semua', ...DAY_ORDER];
    this.els.dayFilter.innerHTML = options
      .map(
        (day) =>
          `<button type="button" data-day="${day}" aria-pressed="${day === this.#activeDay}">${
            day === 'semua' ? 'Semua' : day
          }</button>`,
      )
      .join('');
  }

  #buildCourseCard(course, isToday) {
    const node = this.els.template.content.firstElementChild.cloneNode(true);
    const { item: nextItem } = this.findNextAgenda() ?? {};

    node.dataset.id = course.id;
    node.classList.toggle('is-exam', course.isExam);
    node.classList.toggle('is-attended', course.attended);
    node.classList.toggle('is-past', isToday && course.endMinutes < jakartaNow().minutes);
    node.classList.toggle('is-next', nextItem?.id === course.id);

    $('.course-title', node).textContent = course.isExam ? course.displayTitle : course.title;
    $('.course-badge', node).textContent = course.badgeLabel;
    $('.course-lecturer', node).textContent = course.isExam ? `🧪 Materi: ${course.material}` : `👤 ${course.lecturer}`;
    $('.course-room', node).textContent = `📍 ${course.room} · ${course.durationLabel}`;
    $('.course-extra', node).textContent = course.isExam ? `🎓 ${course.kind} · hadir: ${course.attended ? 'ya' : 'belum'}` : `🎓 ${course.sks} SKS · hadir: ${course.attended ? 'ya' : 'belum'}`;

    const checkbox = $('.attend-box', node);
    checkbox.checked = Boolean(course.attended);
    checkbox.setAttribute('aria-label', `Tandai kehadiran ${course.title}`);

    return node;
  }

  renderSchedule() {
    const filtered = this.getSortedCourses(this.getFilteredCourses());
    const today = jakartaNow().dayName;
    const fragment = document.createDocumentFragment();

    const daysToShow = this.#activeDay === 'semua' ? DAY_ORDER : [this.#activeDay];
    let visibleCount = 0;

    daysToShow.forEach((day) => {
      const coursesOfDay = filtered.filter((course) => course.day === day);
      const column = document.createElement('section');
      column.className = `day-column day--${day.toLowerCase()}${day === today ? ' is-today' : ''}`;

      const heading = document.createElement('header');
      heading.className = 'day-column-head';
      const totalMinutes = coursesOfDay.reduce((sum, course) => sum + course.durationMinutes, 0);
      heading.innerHTML = `
        <h3>${day}${day === today ? ' · hari ini' : ''}</h3>
        <span>${coursesOfDay.length} agenda${totalMinutes > 0 ? ` · ${toDurationLabel(totalMinutes)}` : ''}</span>
      `;
      column.append(heading);

      if (coursesOfDay.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'muted small';
        empty.textContent = 'Libur / belum ada agenda.';
        column.append(empty);
      } else {
        coursesOfDay.forEach((course) => {
          column.append(this.#buildCourseCard(course, day === today));
          visibleCount += 1;
        });
      }

      fragment.append(column);
    });

    this.els.scheduleGrid.replaceChildren(fragment);
    this.els.emptyState.hidden = visibleCount > 0;
  }

  /** Render ulang seluruh antarmuka. */
  renderAll() {
    this.renderClock();
    this.renderNextAgenda();
    this.renderSummary();
    this.renderSchedule();
  }

  /* ---------- 4k. Form handling ---------- */
  #readForm() {
    const form = this.els.form;
    const data = new FormData(form);
    return Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value).trim()]));
  }

  #setErrors(errors = {}) {
    this.els.form.querySelectorAll('[data-error-for]').forEach((element) => {
      const fieldName = element.dataset.errorFor;
      element.textContent = errors[fieldName] ?? '';
    });

    this.els.form.querySelectorAll('input, select').forEach((element) => {
      const invalid = Boolean(errors[element.id]);
      element.setAttribute('aria-invalid', String(invalid));
    });
  }

  #resetForm() {
    this.els.form.reset();
    this.els.form.elements.start.value = '08:00';
    this.els.form.elements.end.value = '09:40';
    this.els.form.elements.sks.value = 2;
    this.#editingId = null;
    this.els.formTitle.textContent = '➕ Tambah Jadwal Kuliah';
    this.els.submitBtn.textContent = 'Simpan Jadwal';
    this.els.editingHint.hidden = true;
    this.els.cancelEditBtn.hidden = true;
    this.#setErrors({});
    this.#toggleTypeFields();
  }

  #toggleTypeFields() {
    const isExam = this.els.form.elements.type.value === 'ujian';
    this.els.materialField.hidden = !isExam;
    this.els.form.elements.sks.closest('.field').hidden = isExam;
  }

  handleSubmit(event) {
    event.preventDefault();
    const values = this.#readForm();
    const errors = this.validateForm(values);

    if (Object.keys(errors).length > 0) {
      this.#setErrors(errors);
      this.showToast('Periksa kembali form: masih ada data yang belum valid.', 'error');
      return;
    }

    if (this.#editingId) {
      this.updateCourse(this.#editingId, values);
      this.showToast(`Jadwal "${values.title}" berhasil diperbarui.`);
    } else {
      const course = this.addCourse(values);
      this.showToast(`Mata kuliah "${course.title}" ditambahkan ke jadwal ${course.day}.`);
    }

    this.#resetForm();
    this.renderAll();
  }

  startEdit(id) {
    const course = this.findCourse(id);
    if (!course) return;

    const form = this.els.form.elements;
    form.title.value = course.title;
    form.lecturer.value = course.lecturer ?? '';
    form.day.value = course.day;
    form.start.value = course.start;
    form.end.value = course.end;
    form.room.value = course.room;
    form.sks.value = course.sks ?? 2;
    form.type.value = course.type;
    form.kind.value = course.kind ?? 'UTS';
    form.material.value = course.material ?? '';

    this.#editingId = id;
    this.els.formTitle.textContent = `✎ Edit Jadwal: ${course.title}`;
    this.els.submitBtn.textContent = 'Simpan Perubahan';
    this.els.editingHint.hidden = false;
    this.els.cancelEditBtn.hidden = false;
    this.#toggleTypeFields();
    this.#setErrors({});

    form.title.focus();
    form.title.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- 4l. Toast ---------- */
  showToast(message, variant = 'success') {
    const toast = this.els.toast;
    toast.textContent = message;
    toast.className = `toast${variant === 'success' ? '' : ` is-${variant}`}`;
    toast.hidden = false;

    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }

  /* ---------- 4m. Fetch API (async/await) ---------- */
  #readCache(key) {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.metaKey) ?? '{}')[key] ?? null;
    } catch {
      return null;
    }
  }

  #writeCache(key, payload) {
    try {
      const meta = JSON.parse(localStorage.getItem(CONFIG.metaKey) ?? '{}');
      localStorage.setItem(CONFIG.metaKey, JSON.stringify({ ...meta, [key]: payload }));
    } catch (error) {
      console.warn('[KelasKu] Cache tidak dapat disimpan:', error);
    }
  }

  async loadWeather({ force = false } = {}) {
    const cached = this.#readCache('weather');
    const isFresh = cached && Date.now() - cached.savedAt < CONFIG.weatherCacheMs;

    if (isFresh && !force) {
      this.renderWeather(cached.data);
      this.els.weatherUpdated.textContent = 'dari cache lokal';
      return;
    }

    try {
      const url = new URL(CONFIG.endpoints.weather);
      const query = {
        latitude: CONFIG.campus.latitude,
        longitude: CONFIG.campus.longitude,
        current: CONFIG.currentParams,
        daily: CONFIG.dailyParams,
        timezone: CONFIG.campus.timezone,
        forecast_days: 7,
      };
      Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Open-Meteo merespons HTTP ${response.status}`);

      const data = await response.json();
      this.renderWeather(data);
      this.#writeCache('weather', { savedAt: Date.now(), data });
    } catch (error) {
      if (cached?.data) {
        this.renderWeather(cached.data);
        this.els.weatherUpdated.textContent = 'cache lama (offline)';
      } else {
        this.renderWeatherError(error);
      }
    }
  }

  async loadQuote({ force = false } = {}) {
    const cached = this.#readCache('quote');
    const isFresh = cached && Date.now() - cached.savedAt < CONFIG.quoteCacheMs;

    if (isFresh && !force) {
      this.renderQuote(cached.data);
      return;
    }

    try {
      const response = await fetch(CONFIG.endpoints.quote);
      if (!response.ok) throw new Error(`DummyJSON merespons HTTP ${response.status}`);

      const { quote, author } = await response.json(); // destructuring hasil fetch
      const payload = { quote, author };
      this.renderQuote(payload);
      this.#writeCache('quote', { savedAt: Date.now(), data: payload });
    } catch (error) {
      console.error('[KelasKu] Gagal memuat kutipan:', error);
      this.els.quoteText.textContent = cached?.data?.quote ?? 'Belajar hari ini, tenang besok.';
      this.els.quoteAuthor.textContent = cached?.data?.author ?? 'KelasKu';
    }
  }

  renderQuote({ quote = '', author = 'Anonim' } = {}) {
    this.els.quoteText.textContent = `"${quote}"`;
    this.els.quoteAuthor.textContent = `— ${author}`;
  }

  /* ---------- 4n. Event & inisialisasi ---------- */
  #bindEvents() {
    const els = this.els;

    els.form.addEventListener('submit', (event) => this.handleSubmit(event));

    els.form.elements.type.addEventListener('change', () => this.#toggleTypeFields());

    els.cancelEditBtn.addEventListener('click', () => {
      this.#resetForm();
      this.showToast('Edit dibatalkan.', 'warning');
    });

    els.demoBtn.addEventListener('click', () => {
      this.replaceAll(DashboardApp.demoSchedule());
      this.renderAll();
      this.showToast('Jadwal contoh berhasil dimuat.');
    });

    els.clearBtn.addEventListener('click', () => {
      const yakin = window.confirm('Hapus seluruh jadwal dari localStorage?');
      if (!yakin) return;
      this.replaceAll([]);
      this.renderAll();
      this.showToast('Semua jadwal dihapus.', 'warning');
    });

    els.quoteRefresh.addEventListener('click', () => this.loadQuote({ force: true }));

    els.searchInput.addEventListener('input', () => this.renderSchedule());

    els.dayFilter.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-day]');
      if (!button) return;
      this.#activeDay = button.dataset.day;
      els.dayFilter.querySelectorAll('button').forEach((item) => {
        item.setAttribute('aria-pressed', String(item.dataset.day === this.#activeDay));
      });
      this.renderSchedule();
    });

    /* Event delegation: satu listener untuk semua kartu jadwal. */
    els.scheduleGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.course-card');
      if (!card) return;

      if (event.target.closest('.delete-btn')) {
        const course = this.findCourse(card.dataset.id);
        if (course && window.confirm(`Hapus "${course.title}" dari jadwal?`)) {
          this.deleteCourse(course.id);
          this.renderAll();
          this.showToast(`"${course.title}" dihapus dari jadwal.`, 'warning');
        }
        return;
      }

      if (event.target.closest('.edit-btn')) this.startEdit(card.dataset.id);
    });

    els.scheduleGrid.addEventListener('change', (event) => {
      const box = event.target.closest('.attend-box');
      if (!box) return;
      const card = event.target.closest('.course-card');
      this.toggleAttendance(card.dataset.id, box.checked);
      this.renderSummary();
      this.renderSchedule();
    });
  }

  async init() {
    this.#bindEvents();
    this.renderFilters();
    this.#toggleTypeFields();
    this.renderAll();

    // Jalankan 3 proses asinkron bersamaan.
    await Promise.allSettled([this.loadWeather(), this.loadQuote()]);

    // Jam & countdown diperbarui setiap detik.
    setInterval(() => {
      this.renderClock();
      this.renderNextAgenda();
    }, 1000);

    console.info('%cKelasKu siap ✅', 'color:#6ee7b7;font-weight:bold');
    console.info(`Total agenda tersimpan: ${this.courses.length}`);
  }
}

/* -------------------------------------------------------------------------
   5. JALANKAN APLIKASI
   ------------------------------------------------------------------------- */
const app = new DashboardApp();
document.addEventListener('DOMContentLoaded', () => app.init());
window.kelasKu = app; // memudahkan pengecekan lewat console saat demo
