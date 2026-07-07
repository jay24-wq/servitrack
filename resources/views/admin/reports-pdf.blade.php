<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan ServiTrack</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: sans-serif;
            font-size: 10px;
            color: #1a1a1a;
            background: #fff;
            padding: 24px;
        }

        /* ── Header ── */
        .header {
            border-bottom: 2px solid #1d4ed8;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .company-name {
            font-size: 20px;
            font-weight: 700;
            color: #1d4ed8;
            letter-spacing: -0.5px;
        }

        .report-title {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin-top: 2px;
        }

        .report-meta {
            text-align: right;
            font-size: 9px;
            color: #6b7280;
            line-height: 1.6;
        }

        .period-badge {
            display: inline-block;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
            font-size: 9px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            margin-top: 4px;
        }

        /* ── Summary Cards ── */
        .summary-grid {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }

        .summary-card {
            flex: 1;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px 12px;
            background: #f9fafb;
        }

        .summary-card.blue {
            border-color: #bfdbfe;
            background: #eff6ff;
        }

        .summary-card.green {
            border-color: #bbf7d0;
            background: #f0fdf4;
        }

        .summary-card.amber {
            border-color: #fde68a;
            background: #fffbeb;
        }

        .summary-card.purple {
            border-color: #e9d5ff;
            background: #faf5ff;
        }

        .summary-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            margin-bottom: 4px;
        }

        .summary-value {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            line-height: 1;
        }

        .summary-value.blue  { color: #1d4ed8; }
        .summary-value.green { color: #15803d; }
        .summary-value.amber { color: #b45309; }

        .summary-sub {
            font-size: 8px;
            color: #9ca3af;
            margin-top: 3px;
        }

        /* ── Section Title ── */
        .section-title {
            font-size: 11px;
            font-weight: 700;
            color: #111827;
            border-left: 3px solid #1d4ed8;
            padding-left: 8px;
            margin-bottom: 8px;
            margin-top: 16px;
        }

        /* ── Tables ── */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }

        thead tr {
            background: #1e3a5f;
            color: #fff;
        }

        thead th {
            padding: 7px 8px;
            text-align: left;
            font-weight: 700;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        thead th.right { text-align: right; }
        thead th.center { text-align: center; }

        tbody tr:nth-child(even) {
            background: #f8fafc;
        }

        tbody tr:nth-child(odd) {
            background: #ffffff;
        }

        tbody td {
            padding: 6px 8px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
        }

        tbody td.right  { text-align: right; }
        tbody td.center { text-align: center; }

        .mono {
            font-family: monospace;
            font-size: 8px;
            color: #1d4ed8;
            font-weight: 700;
        }

        .bold { font-weight: 700; }

        .text-gray { color: #6b7280; }

        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 8px;
            font-weight: 700;
        }

        .badge-selesai {
            background: #dcfce7;
            color: #15803d;
        }

        /* ── Two Column Layout ── */
        .two-col {
            display: flex;
            gap: 12px;
        }

        .two-col .col {
            flex: 1;
        }

        /* ── Footer ── */
        .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #9ca3af;
        }

        .page-break {
            page-break-after: always;
        }
    </style>
</head>
<body>

    {{-- ── HEADER ── --}}
    <div class="header">
        <div class="header-top">
            <div>
                <div class="company-name">ServiTrack</div>
                <div class="report-title">Laporan Operasional Bengkel Servis</div>
                <div class="period-badge">
                    {{ $dari->translatedFormat('d F Y') }} — {{ $sampai->translatedFormat('d F Y') }}
                </div>
            </div>
            <div class="report-meta">
                <div>Digenerate pada:</div>
                <div><strong>{{ $generated_at->translatedFormat('d F Y, H:i') }} WIB</strong></div>
                <div style="margin-top: 4px;">Total Tiket Selesai: <strong>{{ $jumlahTiketSelesai }}</strong></div>
                <div>Total Pelanggan Unik: <strong>{{ $jumlahPelanggan }}</strong></div>
            </div>
        </div>
    </div>

    {{-- ── SUMMARY CARDS ── --}}
    <div class="summary-grid">
        <div class="summary-card blue">
            <div class="summary-label">Tiket Selesai</div>
            <div class="summary-value blue">{{ $jumlahTiketSelesai }}</div>
            <div class="summary-sub">Dalam rentang tanggal</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Pelanggan Dilayani</div>
            <div class="summary-value">{{ $jumlahPelanggan }}</div>
            <div class="summary-sub">Pelanggan unik</div>
        </div>
        <div class="summary-card green">
            <div class="summary-label">Total Pendapatan</div>
            <div class="summary-value green" style="font-size:13px;">
                Rp {{ number_format($totalPendapatan, 0, ',', '.') }}
            </div>
            <div class="summary-sub">Sudah termasuk jasa + sparepart</div>
        </div>
        <div class="summary-card amber">
            <div class="summary-label">Biaya Sparepart</div>
            <div class="summary-value amber" style="font-size:13px;">
                Rp {{ number_format($totalBiayaPart, 0, ',', '.') }}
            </div>
            <div class="summary-sub">Total komponen terpakai</div>
        </div>
        <div class="summary-card purple">
            <div class="summary-label">Biaya Jasa</div>
            <div class="summary-value" style="font-size:13px; color:#7c3aed;">
                Rp {{ number_format($totalBiayaJasa, 0, ',', '.') }}
            </div>
            <div class="summary-sub">{{ $jumlahTiketSelesai }} × Rp 50.000</div>
        </div>
    </div>

    {{-- ── TABEL DETAIL PER TIKET ── --}}
    <div class="section-title">Detail Transaksi Per Tiket</div>
    <table>
        <thead>
            <tr>
                <th>No</th>
                <th>Kode Tiket</th>
                <th>Pelanggan</th>
                <th>Perangkat</th>
                <th>Teknisi</th>
                <th>Tgl Masuk</th>
                <th>Tgl Selesai</th>
                <th>Sparepart Digunakan</th>
                <th class="right">Biaya Part</th>
                <th class="right">Biaya Jasa</th>
                <th class="right">Total</th>
                <th>Metode</th>
            </tr>
        </thead>
        <tbody>
            @forelse($tickets as $i => $ticket)
            <tr>
                <td class="center text-gray">{{ $i + 1 }}</td>
                <td><span class="mono">#{{ $ticket->kode_servis }}</span></td>
                <td>
                    <div class="bold">{{ $ticket->nama_pelanggan }}</div>
                    <div class="text-gray">{{ $ticket->nomor_hp }}</div>
                </td>
                <td>
                    <div class="bold">{{ $ticket->device_name }}</div>
                    <div class="text-gray">{{ $ticket->device_brand }}</div>
                </td>
                <td>{{ $ticket->user?->name ?? '-' }}</td>
                <td>{{ \Carbon\Carbon::parse($ticket->checkin_date)->format('d/m/Y') }}</td>
                <td>{{ $ticket->updated_at->format('d/m/Y') }}</td>
                <td>
                    @if($ticket->sparepartUsages->count() > 0)
                        @foreach($ticket->sparepartUsages as $usage)
                        <div>{{ $usage->sparepart->nama }} (×{{ $usage->jumlah_digunakan }})</div>
                        @endforeach
                    @else
                        <span class="text-gray">Tanpa sparepart</span>
                    @endif
                </td>
                <td class="right">
                    Rp {{ number_format($ticket->payment?->biaya_sparepart ?? 0, 0, ',', '.') }}
                </td>
                <td class="right">
                    Rp {{ number_format($ticket->payment?->biaya_jasa ?? 0, 0, ',', '.') }}
                </td>
                <td class="right bold">
                    Rp {{ number_format(($ticket->payment?->biaya_sparepart ?? 0) + ($ticket->payment?->biaya_jasa ?? 0), 0, ',', '.') }}
                </td>
                <td class="center">
                    <span class="badge badge-selesai">
                        {{ strtoupper($ticket->payment?->metode ?? '-') }}
                        @if($ticket->payment?->bank)
                            ({{ $ticket->payment->bank }})
                        @endif
                    </span>
                </td>
            </tr>
            @empty
            <tr>
                <td colspan="12" class="center text-gray" style="padding: 20px;">
                    Tidak ada tiket selesai dalam rentang tanggal ini.
                </td>
            </tr>
            @endforelse
        </tbody>
    </table>

    {{-- ── HALAMAN 2: RINGKASAN ── --}}
    <div class="page-break"></div>

    <div class="header">
        <div class="header-top">
            <div>
                <div class="company-name">ServiTrack</div>
                <div class="report-title">Ringkasan Operasional</div>
                <div class="period-badge">
                    {{ $dari->translatedFormat('d F Y') }} — {{ $sampai->translatedFormat('d F Y') }}
                </div>
            </div>
        </div>
    </div>

    <div class="two-col">

        {{-- Performa Teknisi --}}
        <div class="col">
            <div class="section-title">Performa Teknisi</div>
            <table>
                <thead>
                    <tr>
                        <th>Teknisi</th>
                        <th class="center">Tiket Selesai</th>
                        <th class="right">Total Pendapatan</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($teknisiSummary as $tek)
                    <tr>
                        <td class="bold">{{ $tek['nama'] }}</td>
                        <td class="center">{{ $tek['jumlah_tiket'] }}</td>
                        <td class="right">Rp {{ number_format($tek['total_pendapatan'], 0, ',', '.') }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td colspan="3" class="center text-gray">Tidak ada data</td>
                    </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{-- Ringkasan Sparepart --}}
        <div class="col">
            <div class="section-title">Sparepart Paling Banyak Digunakan</div>
            <table>
                <thead>
                    <tr>
                        <th>Nama Komponen</th>
                        <th class="center">Qty</th>
                        <th class="right">Total Nilai</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($sparepartSummary->sortByDesc('total_digunakan')->take(10) as $part)
                    <tr>
                        <td>{{ $part['nama'] }}</td>
                        <td class="center bold">{{ $part['total_digunakan'] }}</td>
                        <td class="right">Rp {{ number_format($part['total_harga'], 0, ',', '.') }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td colspan="3" class="center text-gray">Tidak ada data</td>
                    </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

    </div>

    {{-- ── FOOTER ── --}}
    <div class="footer">
        <div>ServiTrack — Sistem Manajemen Bengkel Servis</div>
        <div>Laporan ini digenerate otomatis oleh sistem pada {{ $generated_at->translatedFormat('d F Y, H:i') }} WIB</div>
    </div>

</body>
</html>