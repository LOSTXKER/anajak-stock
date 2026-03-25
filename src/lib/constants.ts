export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export const KNOWN_COLUMNS = new Set([
  'sku', 'variant sku', 'variantsku', 'รหัส variant',
  'barcode',
  'ประเภทสต๊อค', 'ประเภท', 'stocktype', 'stock type',
  'ราคาขาย', 'sellingprice', 'selling price',
  'ราคาทุน', 'costprice', 'cost price',
  'reorder point', 'reorderpoint', 'reorder',
  'min qty', 'minqty', 'min',
  'max qty', 'maxqty', 'max',
  'แจ้งเตือน', 'alert', 'lowstockalert',
  // Non-editable columns (ignored)
  'รหัสสินค้า', 'ชื่อสินค้า', 'สต๊อค', 'stock',
])

export const CHART_COLORS = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#fb7185', // rose
  '#38bdf8', // sky
  '#4ade80', // green
  '#f97316', // orange
  '#c084fc', // purple
]

export const CHART_COLORS_SEMANTIC = [
  'var(--accent-primary)',
  'var(--status-success)',
  'var(--status-warning)',
  'var(--status-danger)',
  'var(--status-info)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]
