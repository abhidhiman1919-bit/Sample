/* ---------- helpers & storage ---------- */
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } };
const store = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const db = () => load('bp_cust', {});
const setDb = d => store('bp_cust', d);
const rs = n => '₹' + n;

const DEF_SET = { name: 'Glow Beauty Parlour', tag: 'Where beauty meets elegance', logo: '', phone: '', address: '', upi: '', cc: '91', pin: '1234', days: 30, pct: 0, offer: false, gst: '', terms: 'Services once availed cannot be refunded or exchanged.\nReturn coupon is valid only till the date shown and cannot be combined with other offers.\nPlease keep this invoice for future reference.' };
const mk = (n, p) => ({ n, price: p });
const DEF_SERV = [
  { name: 'Facial', items: [mk('Fruit Facial', 800), mk('Gold Facial', 1200), mk('Diamond Facial', 1500)] },
  { name: 'Clean Up', items: [mk('Basic Clean Up', 500), mk('De-Tan Clean Up', 800)] },
  { name: 'Hair', items: [mk('Hair Cut', 300), mk('Hair Wash', 250), mk('Hair Spa', 900), mk('Hair Colour', 1500)] },
  { name: 'Waxing', items: [mk('Full Arms', 400), mk('Full Legs', 700), mk('Underarms', 100)] },
  { name: 'Hands & Feet', items: [mk('Manicure', 500), mk('Pedicure', 700)] },
  { name: 'Others', items: [mk('Threading', 50), mk('Bridal Makeup', 8000)] }
];

let S = { ...DEF_SET, ...load('bp_set', {}) };
S.offer = +S.pct > 0 && +S.days >= 1;
let services = (load('bp_serv', null) || DEF_SERV).map(c => ({ ...c, items: c.items.map(s => ({ n: s.n, price: +(s.price !== undefined ? s.price : s.basic) || 0 })) }));
let cart = [], manualLess = 0, cur = null, pickedPhone = null, pendingLogo = null;

/* ---------- services & cart ---------- */
const priceOf = s => +s.price || 0;
const subtotal = () => cart.reduce((a, c) => a + c.price, 0);

function applyShop() {
  $('shop-name').innerText = S.name; $('shop-tag').innerText = S.tag || '';
  document.title = S.name + ' – Billing';
  fitName();
  $('logo').innerHTML = S.logo ? `<img src="${S.logo}" alt="logo">` : esc(S.name.trim().charAt(0).toUpperCase());
}


function fitName() {
  const h1 = $('shop-name'), box = h1.closest('.brand');
  h1.style.fontSize = '';
  let fs = parseFloat(getComputedStyle(h1).fontSize);
  while (h1.scrollWidth > box.clientWidth && fs > 14) { fs -= 1; h1.style.fontSize = fs + 'px'; }
}
window.addEventListener('resize', fitName);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);

function renderServices() {
  $('services').innerHTML = services.map((c, ci) =>
    `<section class="catbox"><div class="cathead"><span class="catname">${esc(c.name)}</span><span class="catcount">${c.items.length} service${c.items.length === 1 ? '' : 's'}</span></div><div class="grid">` +
    c.items.map((s, si) => `<button class="svc${cart.some(x => x.name === s.n) ? ' sel' : ''}" onclick="toggleService(${ci},${si})"><i class="tick">✓</i><span class="sname">${esc(s.n)}</span><span class="sprice">${rs(priceOf(s))}</span></button>`).join('') +
    `</div></section>`).join('') || '<p>Add services from Admin.</p>';
}

function showSaved(title, name, sub) {
  $('sv-title').innerText = title; $('sv-name').innerText = name; $('sv-sub').innerText = sub || '';
  openModal('m-saved');
}

function toggleService(ci, si) {
  const s = services[ci].items[si], i = cart.findIndex(c => c.name === s.n);
  if (i >= 0) cart.splice(i, 1); else cart.push({ name: s.n, price: priceOf(s), cat: services[ci].name });
  renderServices(); updateCart();
}

function rmCart(i) { cart.splice(i, 1); renderServices(); updateCart(); }

function setLess(v) { manualLess = Math.max(0, Math.round(Number(v)) || 0); updateCart(); }

function updateCart() {
  const sub = subtotal();
  if (manualLess > sub) { manualLess = sub; $('less').value = sub || ''; }
  $('cnt').innerText = cart.length;
  $('total').innerText = rs(sub - manualLess);
  $('chips').innerHTML = cart.map((c, i) => `<span class="chip">${esc(c.name)} <b>${rs(c.price)}</b><button aria-label="Remove ${esc(c.name)}" onclick="rmCart(${i})">✕</button></span>`).join('');
  $('cartbar').classList.toggle('hide', cart.length === 0);
  if (!cart.length) { manualLess = 0; $('less').value = ''; }
}

/* ---------- alert / confirm popups ---------- */
const IC = {
  phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 3.5 2.8 19.5h18.4L12 3.5z"/><path d="M12 10v4.2M12 17v.01"/></svg>'
};
let alertCb = null, alertFocus = null;
function showAlert(title, msg, focusId) {
  alertCb = null; alertFocus = focusId || null;
  if (focusId && $(focusId)) $(focusId).classList.add('err');
  $('al-icon').className = 'aicon'; $('al-icon').innerHTML = IC.warn;
  $('al-title').innerText = title; $('al-msg').innerText = msg;
  $('al-btns').innerHTML = '<button class="pri" style="flex:1;padding:13px" onclick="closeAlert()">OK, got it</button>';
  openModal('m-alert');
}
function askConfirm(title, msg, okLabel, cb) {
  alertCb = cb; alertFocus = null;
  $('al-icon').className = 'aicon danger'; $('al-icon').innerHTML = IC.trash;
  $('al-title').innerText = title; $('al-msg').innerText = msg;
  $('al-btns').innerHTML = `<button class="gray" style="flex:1;padding:13px" onclick="closeAlert()">Cancel</button><button class="danbtn" style="flex:1;padding:13px" onclick="closeAlert(true)">${esc(okLabel)}</button>`;
  openModal('m-alert');
}
function closeAlert(ok) {
  closeModal('m-alert');
  const cb = alertCb, f = alertFocus; alertCb = alertFocus = null;
  if (ok && cb) cb(); else if (f && $(f)) $(f).focus();
}
document.addEventListener('input', e => e.target.classList && e.target.classList.remove('err'));

/* ---------- modals ---------- */
const openModal = id => $(id).classList.remove('hide');
const closeModal = id => $(id).classList.add('hide');

/* ---------- customer details ---------- */
function openDetails() { if (!cart.length) return showAlert('No service selected', 'Please select at least one service before continuing.'); openModal('m-details'); lookup(); $('c-phone').focus(); }

function offerFor(phone) {
  if (!S.offer) return null; // return discount is off in Admin: never apply an old coupon
  const c = db()[phone], v = c && c.visits && c.visits[c.visits.length - 1];
  if (!v || !(v.offerPct > 0)) return null;
  return { pct: v.offerPct, until: v.offerUntil, active: Date.now() <= v.offerUntil };
}

function lookup() {
  const phone = $('c-phone').value.replace(/\D/g, '');
  $('c-phone').value = phone;
  if (pickedPhone && pickedPhone !== phone) { pickedPhone = null; $('c-name').value = ''; }
  $('c-name').readOnly = !!pickedPhone;
  const q = $('c-name').value.trim().toLowerCase(), all = Object.values(db());
  const exact = phone.length === 10 ? db()[phone] : null;
  let list = [];
  if (exact) list = [exact];
  else if (phone.length < 10 && (phone.length >= 3 || q.length >= 2))
    list = all.filter(c => (phone.length >= 3 && c.phone.includes(phone)) || (phone.length < 3 && c.name.toLowerCase().includes(q))).slice(0, 5);
  $('c-found').innerHTML = list.map(c => `<div class="found${exact ? ' exact' : ''}" ${pickedPhone === c.phone ? '' : `onclick="pickCustomer('${c.phone}')"`}><div class="av">${esc(c.name.charAt(0).toUpperCase())}</div>
    <div class="who"><b>${esc(c.name)}</b><small>${c.phone} • ${c.visits.length} visit(s)</small></div>
    ${pickedPhone === c.phone ? '<b class="ok">✓ Selected</b>' : '<span class="badge">Tap to select</span>'}</div>`).join('');
  const st = $('status-line') || $('c-status');
  if (pickedPhone) { st.className = 'status ok'; const o = offerFor(pickedPhone); st.innerText = 'Saved customer selected' + (o ? (o.active ? ` • ${o.pct}% return discount will apply (till ${new Date(o.until).toLocaleDateString('en-IN')})` : ' • return offer expired') : ''); }
  else if (exact) { st.className = 'status ok'; st.innerText = 'This number is already saved – tap Select'; }
  else { st.className = 'status'; st.innerText = phone.length === 10 ? 'New customer – will be saved after payment' : ''; }
}

function pickCustomer(phone) {
  const c = db()[phone]; if (!c) return;
  pickedPhone = phone; $('c-phone').value = phone; $('c-name').value = c.name;
  lookup();
}

/* ---------- bill ---------- */
function showBill() {
  const phone = $('c-phone').value.replace(/\D/g, ''), saved = db()[phone];
  const name = saved ? saved.name : $('c-name').value.trim();
  if (phone.length === 0) return showAlert('Mobile number missing', "Please enter the customer's 10-digit mobile number.", 'c-phone');
  if (phone.length !== 10) return showAlert('Invalid mobile number', `A mobile number must have exactly 10 digits. You have entered ${phone.length} digit${phone.length === 1 ? '' : 's'}.`, 'c-phone');
  if (!name) return showAlert('Customer name missing', "Please enter the customer's name to generate the bill.", 'c-name');
  const sub = subtotal(), less = Math.min(manualLess, sub);
  const off = offerFor(phone);
  const now = new Date(), seq = load('bp_inv', 0) + 1;
  const until = new Date(now); until.setDate(until.getDate() + (+S.days || 30)); until.setHours(23, 59, 59, 999);
  cur = {
    inv: 'INV-' + String(seq).padStart(4, '0'), seq, name, phone,
    date: now.toLocaleDateString('en-IN'), time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), ts: now.getTime(),
    items: cart.map(c => ({ ...c })), subtotal: sub, less, pay: 'Cash', visitNo: (saved ? saved.visits.length : 0) + 1, since: saved && saved.visits.length ? saved.visits[0].date : now.toLocaleDateString('en-IN'),
    availPct: off && off.active ? off.pct : 0, useDisc: true,
    newPct: S.offer && +S.pct > 0 ? +S.pct : 0, newUntil: until.getTime(), giveOffer: true
  };
  recalc(); updatePay();
  openModal('m-bill');
}

function recalc() {
  const c = cur, after = c.subtotal - c.less;
  c.dPct = c.useDisc && c.availPct ? c.availPct : 0;
  c.dAmt = Math.round(after * c.dPct / 100);
  c.total = after - c.dAmt;
  c.offerPct = c.giveOffer ? c.newPct : 0;
  c.offerUntil = c.giveOffer && c.newPct ? c.newUntil : 0;
}

function inWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : t[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  if (!n) return 'Zero';
  const cr = Math.floor(n / 1e7), lk = Math.floor(n / 1e5) % 100, th = Math.floor(n / 1e3) % 100, rest = n % 1000;
  return ((cr ? two(cr) + ' Crore ' : '') + (lk ? two(lk) + ' Lakh ' : '') + (th ? two(th) + ' Thousand ' : '') + (rest ? three(rest) : '')).trim();
}

function billHtml() {
  const b = cur, saved = (b.less || 0) + (b.dAmt || 0), cnt = b.items.length;
  const ini = esc(S.name.trim().charAt(0).toUpperCase());
  const logo = S.logo ? `<img src="${S.logo}" alt="">` : ini;
  const contact = [S.address, S.phone].filter(Boolean).map(esc).join('&nbsp;&nbsp;|&nbsp;&nbsp;') || esc(S.name);
  const orn = '<div class="iv-orn"><i></i><em></em><i></i></div>';
  const since = b.visitNo > 1 ? 'Customer since ' + esc(b.since) : 'New customer';
  const terms = (S.terms || '').split('\n').map(t => t.trim()).filter(Boolean);
  return `<div class="iv">
    <div class="iv-wm">${S.logo ? `<img src="${S.logo}" alt="">` : ini}</div>
    <div class="iv-head"><div class="iv-logo">${logo}</div><div class="iv-brand"><h2>${esc(S.name)}</h2>${S.tag ? `<p>${esc(S.tag)}</p>` : ''}${orn}</div></div>
    <div class="iv-title">
      <div><h3>INVOICE</h3>${b.paid ? '<span class="iv-paid">PAID</span>' : ''}</div>
      <div class="iv-no"><small>INVOICE NO.</small><b>${b.inv}</b>${b.date} &nbsp; ${b.time}</div>
    </div>
    <div class="iv-parties">
      <div class="iv-box"><small>FROM</small><b>${esc(S.name)}</b>${S.address ? esc(S.address) + '<br>' : ''}${S.phone ? 'Phone: ' + esc(S.phone) + '<br>' : ''}${S.gst ? 'GSTIN: ' + esc(S.gst) : ''}</div>
      <div class="iv-box"><small>BILLED TO</small><b>${esc(b.name)}</b>Phone: ${esc(b.phone)}<br>Visit #${b.visitNo || 1}<br>${since}</div>
    </div>
    <div class="iv-tbl">
      <div class="iv-th"><span>#</span><span>SERVICE DESCRIPTION</span><span>QTY</span><span>RATE</span><span>AMOUNT</span></div>
      ${b.items.map((i, n) => `<div class="iv-tr"><span>${n + 1}</span><span class="nm">${esc(i.name)}${i.cat ? `<small>${esc(i.cat)}</small>` : ''}</span><span class="q">1</span><span class="r">${rs(i.price)}</span><span>${rs(i.price)}</span></div>`).join('')}
    </div>
    <div class="iv-bot">
      <div>
        <div class="iv-lbl">AMOUNT IN WORDS</div>
        <div class="iv-words">Rupees ${inWords(Math.round(b.total))} Only</div>
        <div class="iv-box iv-pay" style="margin-top:14px">
          <div><small>Payment mode</small><b>${b.pay === 'UPI' ? 'UPI' : 'Cash'}</b></div>
          <div><small>Status</small><b class="st${b.paid ? '' : ' pend'}">${b.paid ? 'Paid' : 'Pending'}</b></div>
          <div><small>Amount received</small><b>${rs(b.paid ? b.total : 0)}</b></div>
          <div><small>Balance due</small><b>${rs(b.paid ? 0 : b.total)}</b></div>
          <div class="full">${b.paid ? 'Received on ' + b.date + ', ' + b.time : 'Payment will be marked received on confirm'}</div>
          ${b.pay === 'UPI' && S.upi ? `<div class="full">UPI ID: ${esc(S.upi)}</div>` : ''}
        </div>
        ${b.offerPct ? `<div class="iv-coupon"><b>RETURN COUPON</b><span>${b.offerPct}% OFF on your next visit</span><small>Valid till ${new Date(b.offerUntil).toLocaleDateString('en-IN')}</small></div>` : ''}
      </div>
      <div class="iv-tots">
        <div class="iv-l"><span>Subtotal (${cnt} service${cnt === 1 ? '' : 's'})</span><span>${rs(b.subtotal)}</span></div>
        ${b.less ? `<div class="iv-l g"><span>Discount (Less)</span><span>- ${rs(b.less)}</span></div>` : ''}
        ${b.dAmt ? `<div class="iv-l g"><span>Return discount (${b.dPct}%)</span><span>- ${rs(b.dAmt)}</span></div>` : ''}
        ${saved ? `<div class="iv-l g bd"><span>Total discount given</span><span>- ${rs(saved)}</span></div>` : ''}
        <div class="iv-grand"><span>Total Payable</span><span>${rs(b.total)}</span></div>
        ${saved ? `<div class="iv-saved">You saved ${rs(saved)} on this bill</div>` : ''}
      </div>
    </div>
    ${terms.length ? `<div class="iv-terms"><small>TERMS &amp; CONDITIONS</small><ul>${terms.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="iv-thanks">${orn}<b>Thank you for visiting ${esc(S.name)}!</b><p>We look forward to seeing you again.</p></div>
    <div class="iv-sign"><div class="iv-sign-wrap"><span style="min-height:58px"></span>Customer Signature</div><div class="iv-sign-wrap"><span class="sg">${esc(S.name)}</span>Authorised Signatory</div></div>
    <div class="iv-foot">${contact}<small>This is a computer-generated invoice.</small></div>
  </div>`;
}

function setPay(m) { cur.pay = m; updatePay(); }

function updatePay() {
  ['Cash', 'UPI'].forEach(x => $('p-' + x).classList.toggle('on', x === cur.pay));
  $('bill-box').innerHTML = billHtml();
  const upi = cur.pay === 'UPI', w = $('qr-wrap');
  w.classList.toggle('hide', !upi);
  if (!upi) return;
  w.innerHTML = `<div class="qr-head"><b>${esc(S.name)}</b><small>Scan &amp; Pay</small></div><div class="qr-body"><div class="qr-lbl">Amount to pay</div><div class="qr-amt">${rs(cur.total)}</div>` +
    (S.upi
      ? `<div class="qr-frame"><div id="qrcode"></div></div><div class="qr-upi">UPI ID: <b>${esc(S.upi)}</b></div>
         <div class="qr-apps"><span>Google Pay</span><span>PhonePe</span><span>Paytm</span><span>BHIM</span></div>
         <div class="status" style="margin-top:8px">Scan with any UPI app, then tap Confirm below</div>`
      : `<div class="status" style="margin:16px 0">Set your UPI ID in Admin to show the QR.</div>`) + `</div>`;
  const qs = Math.max(220, Math.min(300, window.innerWidth - 110));
  if (S.upi) new QRCode($('qrcode'), { text: `upi://pay?pa=${encodeURIComponent(S.upi)}&pn=${encodeURIComponent(S.name)}&am=${cur.total}&cu=INR&tn=${encodeURIComponent(cur.inv)}`, width: qs, height: qs, colorDark: '#2a0f1e', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
}

function confirmPay() {
  cur.paid = true;
  const d = db(), c = d[cur.phone] || { name: cur.name, phone: cur.phone, visits: [] };
  c.visits.push({ inv: cur.inv, date: cur.date, time: cur.time, ts: cur.ts, items: cur.items, subtotal: cur.subtotal, less: cur.less, dPct: cur.dPct, dAmt: cur.dAmt, total: cur.total, pay: cur.pay, offerPct: cur.offerPct, offerUntil: cur.offerUntil });
  d[cur.phone] = c; setDb(d); store('bp_inv', cur.seq);
  $('done-msg').innerText = `${rs(cur.total)} received from ${cur.name}`;
  $('done-bill').innerHTML = billHtml();
  closeModal('m-bill'); closeModal('m-details'); openModal('m-done');
  sendWhatsApp();
}

function goHome() { ['m-bill', 'm-details'].forEach(closeModal); }

function resetBilling() {
  cart = []; manualLess = 0; cur = null; pickedPhone = null; $('c-found').innerHTML = '';
  $('c-phone').value = ''; $('c-name').value = ''; $('c-name').readOnly = false;
  ['m-done', 'm-bill', 'm-details'].forEach(closeModal);
  renderServices(); updateCart();
}

/* ---------- WhatsApp & PDF ---------- */
function sendWhatsApp() {
  const b = cur, saved = (b.less || 0) + (b.dAmt || 0);
  const t = `*${S.name}*` + (S.tag ? `\n_${S.tag}_` : '') + `\n\nDear ${b.name},\nThank you for visiting *${S.name}*! 🌸 We hope you loved your experience.\n\n` +
    `Invoice: ${b.inv}\nDate: ${b.date} ${b.time}\n\n*Services*\n` +
    b.items.map(i => `• ${i.name} – ${rs(i.price)}`).join('\n') +
    `\n\nSubtotal: ${rs(b.subtotal)}` + (b.less ? `\nDiscount: -${rs(b.less)}` : '') + (b.dAmt ? `\nReturn discount (${b.dPct}%): -${rs(b.dAmt)}` : '') +
    (saved ? `\nTotal discount given: -${rs(saved)}` : '') +
    `\n*Total Paid: ${rs(b.total)}*\nPayment mode: ${b.pay}` +
    (b.offerPct ? `\n\n🎁 Visit again by ${new Date(b.offerUntil).toLocaleDateString('en-IN')} and get ${b.offerPct}% off!` : '') +
    `\n\nThank you for choosing ${S.name}. We look forward to seeing you again! 💖` + (S.phone ? `\n📞 ${S.phone}` : '');
  window.open(`https://wa.me/${S.cc || '91'}${b.phone}?text=${encodeURIComponent(t)}`, '_blank');
}

function circleLogo(cb) {
  if (!S.logo) return cb(null);
  const im = new Image();
  im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 240; const x = c.getContext('2d'); x.beginPath(); x.arc(120, 120, 120, 0, Math.PI * 2); x.clip(); x.drawImage(im, 0, 0, 240, 240); cb(c.toDataURL('image/png')); };
  im.onerror = () => cb(null);
  im.src = S.logo;
}

function sigImage(name) {
  try {
    const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 140, f = `${fs}px "Great Vibes", "Brush Script MT", cursive`;
    x.font = f; const w = Math.ceil(x.measureText(name).width) + 40, h = Math.round(fs * 1.5);
    c.width = w; c.height = h; x.font = f; x.fillStyle = '#1d2a5c'; x.textBaseline = 'alphabetic'; x.fillText(name, 20, Math.round(fs * 1.05));
    return { data: c.toDataURL('image/png'), w, h };
  } catch (e) { return null; }
}

function downloadPdf() {
  const go = () => circleLogo(buildPdf);
  if (document.fonts && document.fonts.load) document.fonts.load('140px "Great Vibes"', S.name).then(go, go); else go();
}

function buildPdf(logoImg) {
  const b = cur, { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), H = 297;
  const W = 210, L = 14, R = 196, gold = [217, 180, 106], plum = [122, 33, 80], dark = [26, 10, 20], mut = [122, 102, 112], ink = [43, 26, 35], green = [30, 132, 73], soft = [253, 246, 249], pink = [185, 72, 127];
  const tc = c => doc.setTextColor(c[0], c[1], c[2]), fc = c => doc.setFillColor(c[0], c[1], c[2]), dc = c => doc.setDrawColor(c[0], c[1], c[2]);
  const txt = (t, x, y, o) => doc.text(t, x, y, o), font = (st, sz, col) => { doc.setFont('helvetica', st); doc.setFontSize(sz); tc(col); };
  const money = n => 'Rs.' + Number(n).toLocaleString('en-IN');
  const faint = (op, fn) => { doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: op })); fn(); doc.restoreGraphicsState(); };
  const initial = S.name.trim().charAt(0).toUpperCase();

  /* header band */
  fc(dark); doc.rect(0, 0, W, 42, 'F');
  faint(0.09, () => { fc(gold); doc.circle(194, 2, 30, 'F'); doc.circle(2, 4, 20, 'F'); });
  fc(gold); doc.rect(0, 42, W, 1.4, 'F'); doc.rect(0, 44.6, W, 0.4, 'F');
  if (logoImg) doc.addImage(logoImg, 'PNG', L + 2, 7, 28, 28);
  dc(gold); doc.setLineWidth(0.8); doc.circle(L + 16, 21, 14, 'S');
  if (!logoImg) { font('bold', 24, gold); txt(initial, L + 16, 29, { align: 'center' }); }
  let fs = 21; font('bold', fs, [243, 217, 160]);
  const nm = S.name.toUpperCase();
  while (doc.getTextWidth(nm) > 135 && fs > 11) { fs -= 1; doc.setFontSize(fs); }
  txt(nm, 114, S.tag ? 19 : 24, { align: 'center', charSpace: 0.6 });
  if (S.tag) { font('italic', 11, [240, 219, 228]); txt(S.tag, 114, 27, { align: 'center', maxWidth: 135 }); }
  dc(gold); doc.setLineWidth(0.4); doc.line(92, 33.5, 136, 33.5); fc(gold); doc.triangle(112, 33.5, 114, 32, 116, 33.5, 'F'); doc.triangle(112, 33.5, 114, 35, 116, 33.5, 'F');

  /* title row */
  let y = 59;
  font('bold', 22, plum); txt('INVOICE', L, y, { charSpace: 1.2 });
  const iw = doc.getTextWidth('INVOICE') + 7 * 1.2;
  fc([230, 246, 236]); doc.roundedRect(L + iw + 4, y - 6.5, 17, 8, 1.5, 1.5, 'F'); font('bold', 9, green); txt('PAID', L + iw + 12.5, y - 1, { align: 'center' });
  font('normal', 8, mut); txt('INVOICE NO.', R, y - 12, { align: 'right' });
  font('bold', 13, ink); txt(b.inv, R, y - 6.5, { align: 'right' });
  font('normal', 10, mut); txt(b.date + '   ' + b.time, R, y, { align: 'right' });
  y += 5; dc(gold); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 8;

  /* from / billed to */
  const bw = (R - L - 8) / 2, tw = bw - 10, xR = L + bw + 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  const nL = doc.splitTextToSize(S.name, tw), nR = doc.splitTextToSize(b.name, tw);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const aL = S.address ? doc.splitTextToSize(S.address, tw) : [];
  const bh = Math.max(11 + nL.length * 5.5 + aL.length * 5 + (S.phone ? 5 : 0) + (S.gst ? 5 : 0), 11 + nR.length * 5.5 + 15, 30);
  fc(soft); doc.roundedRect(L, y, bw, bh, 2, 2, 'F'); doc.roundedRect(xR, y, bw, bh, 2, 2, 'F');
  fc(gold); doc.rect(L, y + 2, 1.2, bh - 4, 'F'); doc.rect(xR, y + 2, 1.2, bh - 4, 'F');
  let ty = y + 7; font('bold', 8, pink); txt('FROM', L + 6, ty); ty += 5.5;
  font('bold', 12, ink); nL.forEach(l => { txt(l, L + 6, ty); ty += 5.5; });
  font('normal', 10, mut); aL.forEach(l => { txt(l, L + 6, ty); ty += 5; }); if (S.phone) { txt('Phone: ' + S.phone, L + 6, ty); ty += 5; } if (S.gst) txt('GSTIN: ' + S.gst, L + 6, ty);
  ty = y + 7; font('bold', 8, pink); txt('BILLED TO', xR + 6, ty); ty += 5.5;
  font('bold', 12, ink); nR.forEach(l => { txt(l, xR + 6, ty); ty += 5.5; });
  font('normal', 10, mut); txt('Phone: ' + b.phone, xR + 6, ty); ty += 5; txt('Visit #' + (b.visitNo || 1), xR + 6, ty); ty += 5; txt(b.visitNo > 1 ? 'Customer since ' + b.since : 'New customer', xR + 6, ty);
  y += bh + 7;

  /* services table */
  fc(plum); doc.roundedRect(L, y, R - L, 9, 1.5, 1.5, 'F'); font('bold', 9.5, [255, 255, 255]);
  txt('#', L + 4, y + 6); txt('SERVICE DESCRIPTION', L + 14, y + 6, { charSpace: 0.4 }); txt('QTY', 134, y + 6, { align: 'center', charSpace: 0.4 }); txt('RATE', 170, y + 6, { align: 'right', charSpace: 0.4 }); txt('AMOUNT', R - 4, y + 6, { align: 'right', charSpace: 0.4 }); y += 9;
  b.items.forEach((i, n) => {
    if (y > 245) { doc.addPage(); y = 20; }
    const rh = i.cat ? 10.5 : 9, ty = y + (i.cat ? 4.9 : 6);
    if (n % 2 === 0) { fc(soft); doc.rect(L, y, R - L, rh, 'F'); }
    font('normal', 11, ink); txt(String(n + 1), L + 4, ty); txt(i.name, L + 14, ty, { maxWidth: 100 });
    if (i.cat) { font('normal', 8, mut); txt(i.cat, L + 14, y + 8.5, { maxWidth: 100 }); }
    font('normal', 11, ink); txt('1', 134, ty, { align: 'center' }); txt(money(i.price), 170, ty, { align: 'right' }); txt(money(i.price), R - 4, ty, { align: 'right' });
    y += rh;
  });
  dc(gold); doc.setLineWidth(0.6); doc.line(L, y, R, y); y += 6;

  /* words + payment (left) | totals (right) */
  if (y > 200) { doc.addPage(); y = 20; }
  const saved = (b.less || 0) + (b.dAmt || 0), TX = 118, cnt = b.items.length;
  font('bold', 8, pink); txt('AMOUNT IN WORDS', L, y + 3);
  font('italic', 10.5, ink); const words = doc.splitTextToSize('Rupees ' + inWords(Math.round(b.total)) + ' Only', 92); txt(words, L, y + 9.5);
  let yl = y + 9.5 + words.length * 5 + 5;
  const upiLine = b.pay === 'UPI' && S.upi, ph = upiLine ? 27 : 21.5;
  fc(soft); doc.roundedRect(L, yl, 92, ph, 2, 2, 'F'); fc(gold); doc.rect(L, yl + 2, 1.2, ph - 4, 'F');
  const pc = [L + 6, L + 29, L + 52, L + 72];
  font('normal', 7.5, mut); ['Payment mode', 'Status', 'Received', 'Balance due'].forEach((t, k) => txt(t, pc[k], yl + 5.5));
  font('bold', 11, plum); txt(b.pay === 'UPI' ? 'UPI' : 'Cash', pc[0], yl + 11.5); font('bold', 11, green); txt('Paid', pc[1], yl + 11.5);
  font('bold', 10, ink); txt(money(b.total), pc[2], yl + 11.5); txt(money(0), pc[3], yl + 11.5);
  font('normal', 9, mut); txt('Received on ' + b.date + ', ' + b.time, L + 6, yl + 16.5, { maxWidth: 82 });
  if (upiLine) txt('UPI ID: ' + S.upi, L + 6, yl + 21.5, { maxWidth: 82 });
  yl += ph;
  if (b.offerPct) {
    yl += 3.5; const cx = L + 46;
    fc([255, 250, 240]); dc(gold); doc.setLineWidth(0.7); doc.setLineDashPattern([2, 1.5], 0); doc.roundedRect(L, yl, 92, 17, 3, 3, 'FD'); doc.setLineDashPattern([], 0);
    font('bold', 7.5, [122, 90, 18]); txt('RETURN COUPON', cx, yl + 4.8, { align: 'center', charSpace: 1 });
    font('bold', 12, plum); txt(`${b.offerPct}% OFF on your next visit`, cx, yl + 10.3, { align: 'center', maxWidth: 86 });
    font('normal', 8.5, mut); txt('Valid till ' + new Date(b.offerUntil).toLocaleDateString('en-IN'), cx, yl + 14.5, { align: 'center' });
    yl += 17;
  }
  const row = (l, v, col, bold) => { font(bold ? 'bold' : 'normal', 11, col || ink); txt(l, TX, y + 3); txt(v, R - 2, y + 3, { align: 'right' }); y += 7.5; };
  row(`Subtotal (${cnt} service${cnt === 1 ? '' : 's'})`, money(b.subtotal));
  if (b.less) row('Discount (Less)', '- ' + money(b.less), green);
  if (b.dAmt) row(`Return discount (${b.dPct}%)`, '- ' + money(b.dAmt), green);
  if (saved) row('Total discount given', '- ' + money(saved), green, true);
  y += 1; fc(plum); doc.roundedRect(TX - 2, y, R - TX + 2, 12.5, 2, 2, 'F');
  font('bold', 12, [255, 255, 255]); txt('Total Payable', TX + 2, y + 8.3); txt(money(b.total), R - 4, y + 8.3, { align: 'right' }); y += 12.5 + 4;
  if (saved) { fc([230, 246, 236]); doc.roundedRect(TX - 2, y, R - TX + 2, 8, 2, 2, 'F'); font('bold', 9.5, green); txt(`You saved ${money(saved)} on this bill`, (TX - 2 + R) / 2, y + 5.4, { align: 'center' }); y += 12; }
  y = Math.max(y, yl) + 4;

  /* coupon, thanks, signatures */
  font('normal', 7.5, mut);
  const tl = S.terms ? doc.splitTextToSize(S.terms.split('\n').map(s => s.trim()).filter(Boolean).map(s => '\u2022 ' + s).join('    '), 182) : [], fh = 16 + (tl.length ? tl.length * 3.4 + 1.5 : 0);
  const need = 29;
  if (y + need > H - fh - 4) { doc.addPage(); y = 24; }
  dc(gold); doc.setLineWidth(0.4); doc.line(55, y, W / 2 - 6, y); doc.line(W / 2 + 6, y, 155, y);
  fc(gold); doc.triangle(W / 2 - 3, y, W / 2, y - 2.5, W / 2 + 3, y, 'F'); doc.triangle(W / 2 - 3, y, W / 2, y + 2.5, W / 2 + 3, y, 'F');
  font('bolditalic', 14, plum); txt('Thank you for visiting ' + S.name + '!', W / 2, y + 7, { align: 'center', maxWidth: 170 });
  font('normal', 10, mut); txt('We look forward to seeing you again.', W / 2, y + 12.5, { align: 'center' });
  y += 25; dc([170, 150, 160]); doc.setLineWidth(0.3); doc.line(L, y, L + 52, y); doc.line(R - 52, y, R, y);
  const sg = sigImage(S.name);
  if (sg) { let sw = Math.min(52, sg.w / sg.h * 12), sh = sw * sg.h / sg.w; if (sh > 12) { sh = 12; sw = sh * sg.w / sg.h; } doc.addImage(sg.data, 'PNG', R - sw, y - sh + 1.5, sw, sh); }
  else { font('bolditalic', 15, [29, 42, 92]); txt(S.name, R, y - 3, { align: 'right', maxWidth: 52 }); }
  font('normal', 8.5, mut); txt('Customer Signature', L, y + 4.5); txt('Authorised Signatory', R, y + 4.5, { align: 'right' });

  /* every page: watermark + footer */
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    faint(0.05, () => { if (logoImg) doc.addImage(logoImg, 'PNG', W / 2 - 45, H / 2 - 35, 90, 90); else { font('bold', 200, plum); txt(initial, W / 2, H / 2 + 50, { align: 'center' }); } });
    fc(gold); doc.rect(0, H - fh - 1, W, 1, 'F'); fc(dark); doc.rect(0, H - fh, W, fh, 'F');
    font('normal', 7.5, [200, 175, 188]); tl.forEach((l, k) => txt(l, W / 2, H - fh + 5.5 + k * 3.4, { align: 'center' }));
    font('normal', 9, [240, 219, 228]); txt([S.address, S.phone].filter(Boolean).join('   |   ') || S.name, W / 2, H - 9.5, { align: 'center', maxWidth: 180 });
    font('normal', 7.5, [190, 160, 175]); txt('This is a computer-generated invoice.', W / 2, H - 4.5, { align: 'center' });
  }
  doc.save(b.inv + '.pdf');
}

/* ---------- customers ---------- */
function openCustomers() { renderCustomers(); openModal('m-cust'); }

function openAddCustomer() { $('n-name').value = ''; $('n-phone').value = ''; openModal('m-add'); $('n-name').focus(); }

function addCustomer() {
  const name = $('n-name').value.trim(), phone = $('n-phone').value.replace(/\D/g, ''), d = db();
  if (!name) return showAlert('Customer name missing', "Please enter the customer's name.", 'n-name');
  if (phone.length === 0) return showAlert('Mobile number missing', "Please enter the customer's 10-digit mobile number.", 'n-phone');
  if (phone.length !== 10) return showAlert('Invalid mobile number', `A mobile number must have exactly 10 digits. You have entered ${phone.length} digit${phone.length === 1 ? '' : 's'}.`, 'n-phone');
  if (d[phone]) return showAlert('Number already saved', `This number already belongs to ${d[phone].name}. You can pick them from Saved Customers.`, 'n-phone');
  d[phone] = { name, phone, visits: [] }; setDb(d);
  closeModal('m-add'); renderCustomers();
  showSaved('Customer Saved', name, '📞 ' + phone);
}

function renderCustomers() {
  const q = $('c-search').value.trim().toLowerCase(), lastTs = c => c.visits.length ? (c.visits[c.visits.length - 1].ts || 0) : 0;
  const list = Object.values(db()).filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)).sort((a, b) => lastTs(b) - lastTs(a));
  $('c-count').innerText = `${list.length} customer${list.length === 1 ? '' : 's'} ${q ? 'found' : 'saved'}`;
  const chev = '<svg class="cchev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';
  $('cust-list').innerHTML = list.map(c => {
    const last = c.visits[c.visits.length - 1], spent = c.visits.reduce((t, v) => t + v.total, 0);
    return `<div class="ccard" onclick="openCustomerDetail('${c.phone}')"><div class="av">${esc(c.name.charAt(0).toUpperCase())}</div>
      <div class="ci"><div class="cn">${esc(c.name)}</div><div class="cp"><span class="ic">${IC.phone}</span> ${c.phone}</div></div>
      <div class="cstatrow"><div><small>Visits</small><b>${c.visits.length}</b></div><div><small>Last visit</small><b>${last ? last.date : '—'}</b></div><div><small>Total billed</small><b class="pl">${rs(spent)}</b></div></div>
      <div class="cact"><button class="cdel" aria-label="Delete customer" onclick="event.stopPropagation();delCustomer('${c.phone}')">${IC.trash}</button>${chev}</div></div>`;
  }).join('') || `<div class="cempty"><b>${q ? 'No matching customers' : 'No customers saved yet'}</b><div style="margin-top:6px;font-size:13px">${q ? 'Try a different name or number.' : 'Customers are saved automatically after their first payment, or add one from the dashboard.'}</div></div>`;
}

function openCustomerDetail(phone) {
  const c = db()[phone]; if (!c) return;
  const vs = [...c.visits].reverse(), online = v => v.pay === 'UPI', first = c.visits[0], last = vs[0];
  const tot = f => vs.filter(f).reduce((t, v) => t + v.total, 0);
  $('cd-title').innerText = 'Customer Profile';
  $('cd-body').innerHTML = `<div class="cprof"><div class="pav">${esc(c.name.charAt(0).toUpperCase())}</div>
      <div class="pinfo"><h3>${esc(c.name)}</h3><div><span class="ic">${IC.phone}</span> ${c.phone}</div></div>
      <div class="pside"><small>Customer since</small><b>${first ? first.date : '—'}</b>${last ? `<small style="margin-top:8px">Last visit</small><b>${last.date}</b>` : ''}</div></div>
    <div class="cstats"><div class="cstat"><small>Total visits</small><b>${vs.length}</b></div><div class="cstat"><small>Total billed</small><b>${rs(tot(() => true))}</b></div><div class="cstat"><small>Paid in cash</small><b>${rs(tot(v => !online(v)))}</b></div><div class="cstat"><small>Paid via UPI</small><b>${rs(tot(online))}</b></div></div>
    <div class="hhead">Visit history <span>${vs.length}</span></div>` +
    (vs.map(v => `<div class="vcard"><div class="vtop"><div><b>${v.inv}</b><small>${v.date} • ${v.time}</small></div><span class="pmode ${online(v) ? 'upi' : 'cash'}">${online(v) ? 'UPI' : 'Cash'}</span></div>
      ${v.items.map(i => `<div class="vrow"><span>${esc(i.name)}</span><span>${rs(i.price)}</span></div>`).join('')}
      ${v.less ? `<div class="vrow save"><span>Discount (Less)</span><span>- ${rs(v.less)}</span></div>` : ''}
      ${v.dAmt ? `<div class="vrow save"><span>Return discount (${v.dPct}%)</span><span>- ${rs(v.dAmt)}</span></div>` : ''}
      <div class="vrow vtot"><span>Total</span><span>${rs(v.total)}</span></div></div>`).join('') || '<div class="cempty">No bills yet for this customer.</div>');
  openModal('m-cdetail');
}

function delCustomer(p) {
  const c = db()[p]; if (!c) return;
  askConfirm('Delete customer?', `${c.name} and all their bills will be permanently removed. This cannot be undone.`, 'Delete', () => { const d = db(); delete d[p]; setDb(d); renderCustomers(); });
}

/* ---------- admin ---------- */
function openAdminLogin() { $('admin-pin').value = ''; $('pin-err').innerText = ''; openModal('m-login'); $('admin-pin').focus(); }

function checkPin() {
  if ($('admin-pin').value !== String(S.pin)) { $('pin-err').innerText = 'Wrong PIN, try again'; $('admin-pin').select(); return; }
  closeModal('m-login'); fillAdmin(); renderAdmin(); openModal('m-admin');
}

function fillAdmin() {
  $('a-name').value = S.name; $('a-tag').value = S.tag || ''; $('a-phone').value = S.phone; $('a-addr').value = S.address; $('a-gst').value = S.gst || ''; $('a-terms').value = S.terms || ''; $('a-upi').value = S.upi;
  $('a-cc').value = S.cc; $('a-days').value = S.offer ? S.days : ''; $('a-pct').value = S.offer ? S.pct : ''; $('a-pin').value = S.pin;
  pendingLogo = S.logo || null;
  $('a-logo-prev').innerHTML = pendingLogo ? `<img src="${pendingLogo}">` : '';
}

function pickLogo(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const m = Math.min(im.width, im.height), c = document.createElement('canvas');
      c.width = c.height = 240;
      c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 240, 240);
      pendingLogo = c.toDataURL('image/jpeg', 0.85);
      $('a-logo-prev').innerHTML = `<img src="${pendingLogo}">`;
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
}

function saveSettings() {
  const dRaw = $('a-days').value.trim(), pRaw = $('a-pct').value.trim(), pin = $('a-pin').value.trim();
  let days = parseInt(dRaw, 10), pct = parseFloat(pRaw), offer = false;
  if (dRaw || pRaw) {
    if (!(days >= 1 && days <= 365)) return showAlert('Coupon validity needed', 'Enter how many days (1 to 365) the coupon stays valid, or clear both coupon fields to keep it off.', 'a-days');
    if (!(pct > 0 && pct <= 100)) return showAlert('Coupon discount needed', 'Enter the discount % (above 0, up to 100), or clear both coupon fields to keep it off.', 'a-pct');
    offer = true;
  } else { days = 30; pct = 0; }
  if (!pin) return showAlert('PIN required', 'The admin PIN cannot be empty.', 'a-pin');
  S = { name: $('a-name').value.trim() || DEF_SET.name, tag: $('a-tag').value.trim(), logo: pendingLogo || '', phone: $('a-phone').value.trim(), address: $('a-addr').value.trim(), gst: $('a-gst').value.trim(), terms: $('a-terms').value.trim(),
        upi: $('a-upi').value.trim(), cc: $('a-cc').value.trim() || '91', pin, days, pct, offer };
  store('bp_set', S); applyShop(); showSaved('Settings Saved', 'Your changes are applied', '');
}

const saveServ = () => store('bp_serv', services);

function renderAdmin() {
  $('admin-list').innerHTML = services.map((c, ci) => `<div class="acat">
    <div class="row"><input value="${esc(c.name)}" onchange="editCat(${ci},this.value)"><button class="x" onclick="delCat(${ci})">🗑</button></div>` +
    c.items.map((s, si) => `<div class="row"><input value="${esc(s.n)}" onchange="editSvc(${ci},${si},'n',this.value)"><input type="number" value="${s.price}" title="Price" onchange="editSvc(${ci},${si},'price',this.value)"><button class="x" onclick="delSvc(${ci},${si})">✕</button></div>`).join('') +
    `<div class="row"><input id="ns-n-${ci}" placeholder="Service"><input id="ns-b-${ci}" type="number" placeholder="Price ₹"><button class="add" onclick="addSvc(${ci})">＋</button></div></div>`).join('');
}

function addCat() { const n = $('new-cat').value.trim(); if (!n) return; services.unshift({ name: n, items: [] }); $('new-cat').value = ''; saveServ(); renderAdmin(); }
function editCat(ci, v) { if (v.trim()) { services[ci].name = v.trim(); saveServ(); } renderAdmin(); }
function delCat(ci) { askConfirm('Delete category?', `"${services[ci].name}" and all its services will be removed.`, 'Delete', () => { services.splice(ci, 1); saveServ(); renderAdmin(); }); }

function addSvc(ci) {
  const n = $('ns-n-' + ci).value.trim(), b = +$('ns-b-' + ci).value;
  if (!n || !(b >= 0) || $('ns-b-' + ci).value === '') return showAlert('Service details missing', 'Please enter both the service name and its price.', 'ns-n-' + ci);
  services[ci].items.push({ n, price: b }); saveServ(); renderAdmin();
}

function editSvc(ci, si, k, v) {
  if (k === 'n') { if (!v.trim()) return renderAdmin(); services[ci].items[si].n = v.trim(); }
  else services[ci].items[si][k] = Math.max(0, +v || 0);
  saveServ();
}

function delSvc(ci, si) { services[ci].items.splice(si, 1); saveServ(); renderAdmin(); }
function closeAdmin() { closeModal('m-admin'); cart = []; manualLess = 0; renderServices(); updateCart(); }

/* ---------- start ---------- */
applyShop(); renderServices(); updateCart();