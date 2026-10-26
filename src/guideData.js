/**
 * Data Panduan Penggunaan Corel Tools Suite
 * Disusun secara terstruktur, akurat, dan sesuai implementasi tools nyata di aplikasi.
 * Aturan Rule R-02: Zero Em Dash (Gunakan tanda hubung - atau titik dua :).
 */
var GUIDE_DATA = [
  {
    id: 'downsaver',
    name: 'Penurun Versi CDR (CDR Version Converter)',
    viewId: 'downsaver',
    category: 'konversi',
    categoryLabel: 'File & Konversi',
    badge: 'X4 / X7 / 2020',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    shortDesc: 'Menurunkan versi file CDR (misal 2024 ke X4 atau X7) tanpa merusak teks, font, atau format aslinya.',
    fungsi: 'Menyimpan ulang berkas desain CorelDRAW format versi tinggi (seperti CorelDRAW 2024, 2023, 2022, 2021) menjadi berkas berformat versi lebih rendah (seperti CorelDRAW X4 / v14.0 atau CorelDRAW X7 / v17.0) secara otomatis dan cepat.',
    kapanDigunakan: 'Digunakan saat Anda menerima file desain dari pelanggan yang dibuat di CorelDRAW versi baru, namun komputer percetakan, mesin sablon/DTF, atau mesin laser/cutting Anda hanya memiliki CorelDRAW X4 atau X7.',
    persiapan: [
      'Siapkan berkas .cdr yang versinya ingin diturunkan.',
      'Pastikan komputer memiliki CorelDRAW yang terpasang untuk menulis format berkas target.'
    ],
    langkah: [
      'Buka menu Penurun Versi CDR di menu sebelah kiri atau klik kartu di Beranda.',
      'Tarik dan lepaskan (drag and drop) berkas .cdr ke area tabel, atau klik tombol "+ Tambah File CDR" / "+ Tambah Folder".',
      'Pilih versi target yang diinginkan pada menu pilihan (tersedia To X4, To X5, To X6, To X7, To X8, To 2017, To 2018, To 2019, To 2020) atau langsung klik tombol cepat "⚡ Ke X4 (v14.0)" / "⚡ Ke X7 (v17.0)".',
      'Pilih lokasi penyimpanan: simpan di folder yang sama dengan akhiran nama (contoh: _X4) atau tentukan folder khusus.',
      'Klik tombol "Mulai Konversi". Sistem akan memproses berkas secara senyap di latar belakang.'
    ],
    pengaturan: [
      { opsi: 'Target Versi CDR Output', arti: 'Pilihan versi CorelDRAW tujuan penyimpanan (X4 sampai 2020).' },
      { opsi: 'Akhiran Nama File (Suffix)', arti: 'Teks tambahan pada nama file baru agar tidak menimpa file master asli (default: _X4 atau _X7).' },
      { opsi: 'CurveTo (Opsional)', arti: 'Jika dicentang, semua font akan diubah jadi kurva. Secara default dibiarkan tidak dicentang agar teks tetap asli dan dapat diedit.' },
      { opsi: 'Cleanup (Opsional)', arti: 'Membersihkan sampah ColorStyles dan Views agar ukuran file berkurang drastis dan ringan dibuka.' }
    ],
    hasil: 'Dihasilkan berkas .cdr baru dengan format versi yang dipilih, siap dibuka di komputer percetakan lama tanpa kendala "Version Not Supported".',
    catatan: 'File hasil konversi tetap mempertahankan teks dan bentuk asli asalkan opsi CurveTo tidak diaktifkan.'
  },
  {
    id: 'enumerator',
    name: 'Enumerator (Penomoran Otomatis)',
    viewId: 'enumerator',
    category: 'penomoran',
    categoryLabel: 'Penomoran & Data',
    badge: 'Tiket & Nota',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>`,
    shortDesc: 'Membuat nomor urut otomatis pada tiket, kupon undian, invoice, nota, dan kartu secara instan.',
    fungsi: 'Menghasilkan ratusan hingga ribuan nomor seri berurutan secara otomatis ke dalam dokumen CorelDRAW sesuai pola format dan tata letak yang ditentukan.',
    kapanDigunakan: 'Saat mengerjakan pesanan cetak tiket konser, kupon doorprize, karcis parkir, voucher belanja, nota rangkap, atau nomor antrean.',
    persiapan: [
      'Buka CorelDRAW dan buka lembar desain tiket atau kupon Anda.',
      'Ketik satu buah objek teks placeholder nomor pada posisi yang diinginkan (contoh: NO. 0001).'
    ],
    langkah: [
      'Buka menu Enumerator di aplikasi Corel Tools Suite.',
      'Isi kolom "Mulai Dari" (nomor awal) dan "Sampai Dengan" (nomor akhir).',
      'Atur "Jumlah Digit" (misal 4 digit untuk menghasilkan 0001, 0002).',
      'Tambahkan Awalan (Prefix) seperti "TCK-" atau Akhiran (Suffix) jika diinginkan.',
      'Pilih metode cetak: Standar (berurutan lembar per lembar) atau Cut and Stack (hemat potong sortir).',
      'Klik tombol "Jalankan Enumerator". Dokumen di CorelDRAW akan langsung terisi nomor urut secara otomatis.'
    ],
    pengaturan: [
      { opsi: 'Mulai Dari & Sampai Dengan', arti: 'Rentang nomor tiket yang ingin dibuat.' },
      { opsi: 'Jumlah Digit', arti: 'Jumlah karakter angka dengan angka nol di depan (contoh digit 3: 001, 002).' },
      { opsi: 'Metode Cut and Stack', arti: 'Nomor diurutkan vertikal menembus tumpukan kertas. Setelah lembaran plano dipotong mesin potong, tumpukan tiket langsung berurutan rapi tanpa perlu sortir manual.' },
      { opsi: 'Ubah ke Kurva Otomatis', arti: 'Mengubah angka menjadi kurva vektor setelah penomoran selesai agar bentuk font tidak berubah saat dipindah ke komputer lain.' }
    ],
    hasil: 'Halaman dokumen CorelDRAW bertambah otomatis dan setiap lembar tiket telah tercetak nomor urut yang rapi.',
    catatan: 'Pastikan CorelDRAW terhubung (indikator hijau) sebelum menekan tombol Jalankan.'
  },
  {
    id: 'merger',
    name: 'Merger Sertifikat (Data Excel ke Desain)',
    viewId: 'merger',
    category: 'penomoran',
    categoryLabel: 'Penomoran & Data',
    badge: 'Mail Merge Excel',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    shortDesc: 'Menggabungkan data nama, nomor, dan instansi dari Excel ke template sertifikat atau kartu nama massal.',
    fungsi: 'Menghubungkan kolom file Excel (.xlsx / .csv) ke bidang teks penanda di CorelDRAW (Variable Data Printing), menghasilkan dokumen sertifikat untuk semua peserta sekaligus.',
    kapanDigunakan: 'Saat mencetak sertifikat seminar, piagam penghargaan, kartu peserta ujian, kartu anggota, atau ID card kepanitiaan dalam jumlah puluhan hingga ribuan nama.',
    persiapan: [
      'Siapkan template desain di CorelDRAW dengan teks penanda unik (contoh: [NAMA], [INSTANSI], [PREDIKAT]).',
      'Siapkan berkas Excel yang memiliki kolom judul yang sama (misal kolom Nama, Instansi, Predikat).'
    ],
    langkah: [
      'Buka menu Merger Sertifikat.',
      'Klik tombol "Pilih File Excel" dan pilih berkas data peserta Anda.',
      'Cocokkan penanda teks di dokumen CorelDRAW dengan nama kolom Excel pada panel pemetaan.',
      'Tentukan opsi cetak: cetak ke halaman baru di dokumen CorelDRAW atau langsung ekspor menjadi berkas PDF terpisah per peserta.',
      'Klik tombol "Mulai Proses Merger".'
    ],
    pengaturan: [
      { opsi: 'Pemetaan Kolom', arti: 'Menghubungkan teks penanda di CorelDRAW dengan kolom data Excel yang sesuai.' },
      { opsi: 'Mode Output', arti: 'Pilihan apakah hasil digabung dalam 1 file CorelDRAW multi-halaman atau diekspor ke folder sebagai file PDF.' }
    ],
    hasil: 'Seluruh nama peserta dari Excel tertata presisi pada template sertifikat secara otomatis tanpa ada yang terlewat.',
    catatan: 'Pastikan baris pertama pada file Excel adalah judul kolom, bukan data peserta.'
  },
  {
    id: 'jersey',
    name: 'Auto-Layout Jersey (Pola & Nomor Punggung)',
    viewId: 'jersey',
    category: 'jersey',
    categoryLabel: 'Industri Garmen & Jersey',
    badge: 'Konveksi Jersey',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>`,
    shortDesc: 'Menata pola jersey olahraga, nama pemain, nomor punggung, dan ukuran baju otomatis siap cetak sublim/DTF.',
    fungsi: 'Menyusun teks nama punggung, nomor dada, nomor punggung, dan penanda ukuran secara presisi ke dalam pola baju jersey untuk setiap pemain dalam tim.',
    kapanDigunakan: 'Saat konveksi memproduksi pesanan jersey futsal, sepak bola, bola voli, esport, atau seragam olahraga instansi.',
    persiapan: [
      'Buka pola jersey di CorelDRAW dengan teks placeholder NAMA, NOMOR, dan SIZE.',
      'Siapkan daftar anggota tim (nama, nomor, size).'
    ],
    langkah: [
      'Buka menu Auto-Layout Jersey.',
      'Impor data pemain dari Excel atau masukkan secara manual melalui tabel input pemain.',
      'Pilih bentuk pola dan posisi penempatan nama dan nomor.',
      'Klik tombol "Tata Pola Otomatis". Aplikasi akan mengisi dan menduplikasi pola sesuai jumlah pemain.'
    ],
    pengaturan: [
      { opsi: 'Target Size', arti: 'Memfilter penataan untuk ukuran baju tertentu (misal khusus size L dahulu).' },
      { opsi: 'Ketinggian Font', arti: 'Mengatur ukuran proporsional teks nama punggung agar tidak melewati batas bahu pola.' }
    ],
    hasil: 'Lembar pola cetak jersey lengkap untuk semua anggota tim siap dikirim ke mesin cetak sublimasi atau DTF.',
    catatan: 'Gunakan font bernuansa sporty dan tebal untuk memudahkan proses cutting/sablon.'
  },
  {
    id: 'pesanan',
    name: 'Perapih List Pesanan (WhatsApp & OCR Foto)',
    viewId: 'pesanan',
    category: 'jersey',
    categoryLabel: 'Industri Garmen & Jersey',
    badge: 'Sortir Ukuran',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="m9 14 2 2 4-4"/></svg>`,
    shortDesc: 'Merapihkan catatan pesanan jersey dari chat WhatsApp atau foto nota tangan menjadi tabel rapi terurut size.',
    fungsi: 'Membersihkan format teks acak dari pesan WhatsApp pelanggan atau membaca foto nota tulisan tangan, mengekstrak nama, nomor punggung, ukuran, dan keterangan (celana/lengan panjang) ke tabel rapi 100% akurat.',
    kapanDigunakan: 'Ketika Anda menerima list pesanan yang berantakan dari grup WhatsApp atau foto kertas catatan dan ingin menyalinnya ke Excel atau ke tool Auto-Layout Jersey.',
    persiapan: [
      'Salin (copy) teks chat pesanan dari WhatsApp atau foto nota kertas pesanan.'
    ],
    langkah: [
      'Buka menu Perapih List Pesanan.',
      'Tempelkan teks di kotak teks sebelah kiri (atau klik area foto untuk mengunggah gambar nota).',
      'Klik tombol "Rapihkan Otomatis".',
      'Periksa hasil pada tabel di sebelah kanan yang sudah terkelompok dan terurut dari size terkecil (S) hingga terbesar (XXXL).',
      'Gunakan tombol "Salin Teks Rapih", "Ekspor ke Excel", atau "Kirim ke Auto-Layout Jersey".'
    ],
    pengaturan: [
      { opsi: 'Mode Penanganan Angka 0 di Depan', arti: 'Memastikan nomor seperti 07 atau 008 tidak hilang angka nolnya saat diekspor ke Excel.' },
      { opsi: 'Deteksi Keterangan Tambahan', arti: 'Memisahkan otomatis catatan seperti (Lengan Panjang), (Kiper), atau (Size Celana beda).' }
    ],
    hasil: 'Tabel daftar pesanan bersih, bebas typo tanda baca, terurut berdasarkan ukuran standar konveksi.',
    catatan: 'Jika list sangat sulit atau menggunakan format singkatan yang tidak umum, sistem pemulihan AI akan otomatis membantu merapihkan.'
  },
  {
    id: 'tracer',
    name: 'AI Jersey Tracer (Mockup 3D ke Pola Datar)',
    viewId: 'tracer',
    category: 'jersey',
    categoryLabel: 'Industri Garmen & Jersey',
    badge: 'AI Gemini',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    shortDesc: 'Mengekstrak motif desain dari gambar mockup jersey 3D menjadi pola datar siap potong di CorelDRAW.',
    fungsi: 'Memanfaatkan AI Vision Google Gemini untuk menganalisis motif jersey dari gambar foto/mockup dan memposisikannya secara tepat ke dalam bentuk pola vektor di CorelDRAW.',
    kapanDigunakan: 'Saat pelanggan hanya mengirimkan gambar preview mockup 3D dari depan/belakang tanpa memberikan file vector mentahan motif kainnya.',
    persiapan: [
      'Masukkan API Key Google Gemini pada menu Pengaturan aplikasi.',
      'Buka pola jersey di CorelDRAW dan pilih objek pola badan yang ingin diisi motif.'
    ],
    langkah: [
      'Buka menu AI Jersey Tracer.',
      'Unggah gambar mockup jersey.',
      'Pilih bagian motif yang ingin diekstrak (Badan Depan, Badan Belakang, atau Lengan).',
      'Klik tombol "Proses AI Tracer & Auto-PowerClip". Gambar motif akan otomatis diimpor dan dimasukkan ke dalam bentuk pola terpilih di CorelDRAW.'
    ],
    pengaturan: [
      { opsi: 'Bleed Motif (cm)', arti: 'Lebihan gambar motif di luar garis pola agar tidak ada area putih saat kain dipotong dan dijahit (standar: 1.5 cm).' }
    ],
    hasil: 'Objek pola di CorelDRAW terisi gambar motif yang proporsional dan siap cetak.',
    catatan: 'Pastikan objek pola di CorelDRAW sudah Anda pilih (klik) sebelum menekan tombol proses.'
  },
  {
    id: 'konversi',
    name: 'Konversi Format File (CDR, PDF, AI, PNG, JPG)',
    viewId: 'konversi',
    category: 'konversi',
    categoryLabel: 'File & Konversi',
    badge: 'Multi-Format',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    shortDesc: 'Mengubah format file desain CorelDRAW ke PDF, PNG transparan, JPG hi-res, AI, EPS, dan SVG secara massal.',
    fungsi: 'Mengekspor puluhan hingga ratusan berkas CDR menjadi format gambar atau dokumen siap cetak sekaligus tanpa perlu membuka dan mengekspor file satu per satu.',
    kapanDigunakan: 'Saat ingin membuat berkas pratinjau JPG untuk kirim ke pelanggan di WhatsApp, atau membuat berkas PDF/EPS resolusi tinggi untuk dikirim ke mesin cetak outdoor/indoor.',
    persiapan: [
      'Kumpulkan berkas-berkas CDR yang ingin dikonversi dalam satu folder.'
    ],
    langkah: [
      'Buka menu Konversi di sidebar.',
      'Klik "+ Tambah File" atau "+ Tambah Folder" untuk memasukkan daftar berkas.',
      'Pilih Format Output (PDF, PNG, JPG, EPS, AI, atau SVG).',
      'Pilih Resolusi (DPI) jika memilih format gambar (300 DPI untuk cetak tajam, 72 DPI untuk preview HP).',
      'Tentukan Folder Tujuan Output simpan berkas.',
      'Klik tombol "Mulai Konversi".'
    ],
    pengaturan: [
      { opsi: 'Format Output', arti: 'Format berkas hasil akhir yang diinginkan.' },
      { opsi: 'Resolusi (DPI)', arti: 'Tingkat ketajaman gambar piksel per inci (300 DPI adalah standar cetak tajam).' },
      { opsi: 'Timpa file jika sudah ada', arti: 'Mengganti file lama dengan nama yang sama jika sebelumnya sudah pernah diekspor.' }
    ],
    hasil: 'Berkas baru dengan format yang dipilih tersimpan rapi di folder output yang Anda tentukan.',
    catatan: 'Untuk kebutuhan sablon dan cetak tajam, pilih format PDF atau PNG 300 DPI.'
  },
  {
    id: 'split',
    name: 'Split Objek & Halaman',
    viewId: 'split',
    category: 'konversi',
    categoryLabel: 'File & Konversi',
    badge: 'Pisah Berkas',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" x2="8.12" y1="4" y2="15.88"/><line x1="14.47" x2="20" y1="14.48" y2="20"/><line x1="8.12" x2="12" y1="8.12" y2="12"/></svg>`,
    shortDesc: 'Memisahkan dokumen multi-halaman menjadi file terpisah untuk setiap halaman atau objek desain.',
    fungsi: 'Memotong dokumen CorelDRAW yang memiliki banyak halaman menjadi berkas-berkas individu (contoh: 1 berkas 50 halaman dipecah jadi 50 file CDR 1 halaman).',
    kapanDigunakan: 'Saat mesin cetak digital memerlukan 1 file per halaman cetak, atau memisahkan desain tiap stiker/kartu ke berkasnya sendiri.',
    persiapan: [
      'Buka dokumen multi-halaman di CorelDRAW yang ingin dipisahkan.'
    ],
    langkah: [
      'Buka menu Split di aplikasi.',
      'Pilih mode: "Pisahkan per Halaman" atau "Pisahkan per Objek Terpilih".',
      'Tentukan folder penyimpanan berkas pecahan.',
      'Klik tombol "Mulai Split Halaman".'
    ],
    pengaturan: [
      { opsi: 'Format Berkas Pecahan', arti: 'Bisa disimpan dalam format CDR, PDF, atau gambar.' }
    ],
    hasil: 'Setiap halaman atau objek tersimpan rapi sebagai file terpisah dengan penomoran berurutan.',
    catatan: 'Pastikan nama file master tidak mengandung karakter khusus yang dilarang Windows.'
  },
  {
    id: 'warna',
    name: 'Kelola & Ganti Warna (Replace Color)',
    viewId: 'warna',
    category: 'desain',
    categoryLabel: 'Desain & Tata Letak',
    badge: 'Replace Color',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    shortDesc: 'Mencari dan mengganti warna tertentu di seluruh lembar kerja CorelDRAW secara instan.',
    fungsi: 'Mengganti semua objek yang memiliki warna lama (misal merah) menjadi warna baru (misal biru) di seluruh dokumen atau seleksi tanpa harus mengklik objek satu per satu.',
    kapanDigunakan: 'Saat klien meminta revisi warna tema logo/desain, atau saat proses pemisahan warna sablon manual (color separation).',
    persiapan: [
      'Buka dokumen desain di CorelDRAW.'
    ],
    langkah: [
      'Buka menu Warna di aplikasi.',
      'Pilih warna asal yang ingin diganti (bisa klik Pipet / Eyedropper).',
      'Pilih warna pengganti baru pada palet warna.',
      'Pilih cakupan: "Seluruh Dokumen" atau "Hanya Objek yang Dipilih".',
      'Klik tombol "Terapkan Ganti Warna".'
    ],
    pengaturan: [
      { opsi: 'Target Ganti', arti: 'Pilihan mengganti warna isian (Fill), warna garis tepi (Outline), atau keduanya.' }
    ],
    hasil: 'Semua warna target di dokumen CorelDRAW berubah instan ke warna baru.',
    catatan: 'Mendukung warna standar CMYK percetakan dan RGB monitor.'
  },
  {
    id: 'multicorel',
    name: 'Multi-Corel & Registrasi Otomatis (X4 - 2026 / Portable)',
    viewId: 'utilitas',
    category: 'sistem',
    categoryLabel: 'Sistem & Konfigurasi',
    badge: 'X7 / 2021 / Portable',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    shortDesc: 'Mendaftarkan CorelDRAW (termasuk versi Portable) dan memilih versi CorelDRAW yang dihubungkan secara otomatis.',
    fungsi: 'Mendaftarkan antarmuka otomasi COM CorelDRAW (mulai dari X4 sampai 2026 dan versi Portable) ke sistem Windows secara otomatis tanpa membuka CMD, serta menentukan instance Corel mana yang dihubungkan.',
    kapanDigunakan: 'Saat Anda menggunakan CorelDRAW X7 Portable yang sebelumnya tidak terdeteksi, atau saat Anda membuka CorelDRAW 2021 dan Corel X7 sekaligus di komputer Anda.',
    persiapan: [
      'Buka CorelDRAW Anda, atau siapkan folder tempat file CorelDRW.exe berada.'
    ],
    langkah: [
      'Jika menggunakan CorelDRAW versi Portable yang belum terhubung, buka menu Utilitas di sebelah kiri.',
      'Klik tombol "⚡ Pindai & Daftarkan Semua Versi Otomatis", atau klik "📁 Pilih File CorelDRW.exe Manual" untuk memilih file CorelDRW.exe versi portable Anda.',
      'Sistem akan langsung mendaftarkan CorelDRAW tersebut ke Windows secara senyap.',
      'Jika Anda membuka dua Corel sekaligus (misal Corel 2021 dan X7), tombol pilihan akan muncul di bar atas: [Corel 2021] [Corel X7]. Klik tombol versi yang ingin Anda gunakan.',
      'Aplikasi akan langsung terhubung ke jendela CorelDRAW yang Anda pilih.'
    ],
    pengaturan: [
      { opsi: 'Pindai & Daftarkan Otomatis', arti: 'Memindai seluruh drive komputer dan mendaftarkan semua versi CorelDRAW yang ditemukan.' },
      { opsi: 'Pilih File CorelDRW.exe Manual', arti: 'Memilih file CorelDRW.exe spesifik (misal dari flashdisk atau folder download) untuk didaftarkan langsung.' },
      { opsi: 'Target Corel di Bar Atas & Bawah', arti: 'Memilih dan mengunci versi mana yang diprioritaskan saat bekerja.' }
    ],
    hasil: 'Seluruh tools otomasi langsung terhubung dan siap digunakan di CorelDRAW yang Anda inginkan.',
    catatan: 'Pendaftaran dilakukan langsung di akun pengguna Windows Anda (HKCU) sehingga tidak membutuhkan akses administrator atau repot dengan CMD.'
  },
  {
    id: 'layoutPola',
    name: 'Auto-Nesting Lembar Cetak Pola (Layout Pola)',
    viewId: 'layout-pola',
    category: 'produksi',
    categoryLabel: 'Produksi & Cetak',
    badge: 'Nesting Roll Sublim / DTF',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>`,
    shortDesc: 'Menata posisi puluhan pola potong secara rapat dan otomatis untuk menghemat bahan kain atau media cetak.',
    fungsi: 'Algoritma nesting otomatis yang menyusun objek-objek pola jersey, tas, atau pakaian ke dalam lebar bahan kain tertentu dengan jarak (gap) presisi agar bahan tidak terbuang percuma.',
    kapanDigunakan: 'Saat ingin mencetak banyak potongan pola pakaian pada printer sublimasi gulungan (roll-to-roll) atau lembaran DTF/kain meteran.',
    persiapan: [
      'Buka dokumen CorelDRAW yang berisi pola-pola yang sudah siap dipotong/dicetak.',
      'Seleksi (blok) semua objek pola di CorelDRAW yang ingin ditata.'
    ],
    langkah: [
      'Buka menu Layout Pola di aplikasi Corel Tools Suite.',
      'Klik tombol "Baca Seleksi dari CorelDRAW". Sistem akan mendeteksi seluruh ukuran pola yang dipilih.',
      'Tentukan "Lebar Bahan" (misalnya 150 cm atau 180 cm) dan "Jarak Antar Pola" (misal 1 cm).',
      'Pilih orientasi rotasi (Bebas, 90 derajat, atau Tetap Tegak).',
      'Lihat simulasi tata letak pada layar pratinjau (Interactive Preview).',
      'Klik tombol "Terapkan ke CorelDRAW". Seluruh objek pola di CorelDRAW akan langsung berpindah tertata rapi sesuai hasil nesting.'
    ],
    pengaturan: [
      { opsi: 'Lebar Bahan (cm)', arti: 'Lebar efektif media gulungan kain atau kertas sublim.' },
      { opsi: 'Jarak / Gap (cm)', arti: 'Jarak sela aman antar pola potong agar tidak saling menimpa saat gunting/laser.' },
      { opsi: 'Rotasi Objek', arti: 'Izin memutar pola untuk mencari celah paling hemat bahan.' }
    ],
    hasil: 'Pola tersusun padat dan efisien, menghemat penggunaan bahan baku percetakan hingga 20-30%.',
    catatan: 'Objek pola yang telah digrup akan diperlakukan sebagai satu kesatuan utuh saat penataan.'
  },
  {
    id: 'ukuran',
    name: 'Resize & Pengubah Ukuran Objek Presisi',
    viewId: 'ukuran',
    category: 'desain',
    categoryLabel: 'Desain & Vektor',
    badge: 'Presisi Sentimeter',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`,
    shortDesc: 'Mengubah dimensi panjang dan lebar objek terpilih di CorelDRAW secara instan dengan presisi tinggi.',
    fungsi: 'Menyesuaikan ukuran objek atau grup desain ke dalam ukuran sentimeter (cm) yang pasti, serta opsi langsung memposisikan objek tepat di tengah halaman kerja.',
    kapanDigunakan: 'Saat menyiapkan ukuran standar stiker, kartu nama, spanduk, atau plakat sesuai permintaan cetak.',
    persiapan: [
      'Pilih (seleksi) objek atau grup desain di CorelDRAW.'
    ],
    langkah: [
      'Buka menu Ukuran & Layout di Corel Tools Suite.',
      'Masukkan angka Lebar (cm) dan Tinggi (cm) yang diinginkan.',
      'Centang opsi "Rata Tengah Halaman" jika ingin objek langsung diletakkan di tengah lembar kerja.',
      'Klik tombol "Ubah Ukuran". Objek di CorelDRAW akan langsung berubah sesuai dimensi yang dimasukkan.'
    ],
    pengaturan: [
      { opsi: 'Lebar (cm)', arti: 'Ukuran lebar baru objek dalam satuan sentimeter.' },
      { opsi: 'Tinggi (cm)', arti: 'Ukuran tinggi baru objek dalam satuan sentimeter.' },
      { opsi: 'Rata Tengah Halaman', arti: 'Memposisikan titik pusat objek tepat di tengah halaman (Center to Page).' }
    ],
    hasil: 'Dimensi objek CorelDRAW berubah akurat tanpa perlu mengubahnya manual lewat toolbar.',
    catatan: 'Pastikan objek terpilih di CorelDRAW sebelum menekan tombol eksekusi.'
  },
  {
    id: 'batch',
    name: 'Batch Processing & Pipeline Otomatis',
    viewId: 'batch',
    category: 'otomasi',
    categoryLabel: 'Otomasi Massal',
    badge: 'Multi-Task',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><rect width="8" height="8" x="2" y="2" rx="1"/><rect width="8" height="8" x="14" y="2" rx="1"/><rect width="8" height="8" x="14" y="14" rx="1"/><rect width="8" height="8" x="2" y="14" rx="1"/></svg>`,
    shortDesc: 'Menjalankan rangkaian tugas berulang (convert text, clean layers, cleanup) dalam sekali klik.',
    fungsi: 'Menggabungkan beberapa tugas pembersihan dan standarisasi file pra-cetak menjadi satu rantai eksekusi otomatis.',
    kapanDigunakan: 'Saat ingin memfinalisasi file desain sebelum dikirim ke mesin cetak agar bebas dari font hilang dan sampah layer.',
    persiapan: [
      'Buka file desain di CorelDRAW.'
    ],
    langkah: [
      'Buka menu Batch di Corel Tools Suite.',
      'Pilih tugas-tugas yang ingin dijalankan (misal: Convert All Text to Curves + Bersihkan Guidelines).',
      'Klik tombol "Jalankan Batch Pipeline".'
    ],
    pengaturan: [
      { opsi: 'Daftar Tugas Pipeline', arti: 'Rangkaian tindakan pra-cetak yang akan dieksekusi berurutan.' }
    ],
    hasil: 'Dokumen CorelDRAW bersih, rapi, dan siap cetak tanpa risiko teks berantakan.',
    catatan: 'Disarankan menyimpan salinan file cadangan sebelum menjalankan pipeline massal.'
  }
];

if (typeof window !== 'undefined') {
  window.GUIDE_DATA = GUIDE_DATA;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GUIDE_DATA = GUIDE_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GUIDE_DATA };
}
