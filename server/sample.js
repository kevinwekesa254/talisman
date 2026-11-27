/* Made-up bookings and guests so the dashboard can be tried on this
   computer. Never used on the live site. */

const FIRST = ['Wanjiku', 'Achieng', 'Kamau', 'Otieno', 'Njeri', 'Mwangi', 'Akinyi', 'Kiprop', 'Fatuma', 'Hassan', 'Amina', 'Brian', 'Grace', 'Daniel', 'Priya', 'Rohan', 'Sophie', 'James', 'Wairimu', 'Chebet', 'Moses', 'Halima', 'Lena', 'Tomás', 'Aisha', 'Kevin', 'Zawadi', 'Baraka', 'Nadia', 'Oliver', 'Muthoni', 'Juma', 'Esther', 'Felix', 'Imani', 'Samir'];
const LAST = ['Kamau', 'Odhiambo', 'Wanjiru', 'Mutua', 'Kiplagat', 'Ali', 'Patel', 'Shah', 'Njoroge', 'Wekesa', 'Muriuki', 'Chege', 'Owino', 'Abdi', 'Mwangi', 'Hughes', 'Okello', 'Kariuki', 'Langat', 'Mohamed', 'Gitau', 'Barasa', 'Fischer', 'Nduta'];
const NOTES = ['Birthday dinner, could we have a candle on dessert?', 'A table near the fire please', 'High chair for a toddler', 'Anniversary', 'One guest is vegan', 'Business lunch, somewhere quiet', '', '', '', '', 'Celebrating a graduation', 'Window table if possible', 'Nut allergy at the table', ''];
const TAGS = ['Regular', 'Birthday club', 'Corporate', 'Wine lover', 'Art events'];

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

async function fill(store) {
  const r = rnd(20261127);
  const pick = a => a[Math.floor(r() * a.length)];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = new Date(); today.setHours(12, 0, 0, 0);

  const people = [];
  for (let i = 0; i < 150; i++) {
    const name = pick(FIRST) + ' ' + pick(LAST);
    const phone = '+2547' + String(Math.floor(r() * 9e7) + 1e7).slice(0, 8);
    const email = r() < 0.75 ? name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/á/g, 'a') + (Math.floor(r() * 90) + 10) + '@example.com' : '';
    people.push({ name, phone, email, weight: r() < 0.15 ? 6 : r() < 0.4 ? 2 : 1, consent: r() < 0.62 });
  }
  const weighted = [];
  people.forEach(p => { for (let i = 0; i < p.weight; i++) weighted.push(p); });

  const customers = {};
  const bookings = [];
  for (let day = -240; day <= 16; day++) {
    const d = new Date(today); d.setDate(d.getDate() + day);
    if (d.getDay() === 1) continue; // closed Mondays
    const weekend = d.getDay() === 0 || d.getDay() === 6 || d.getDay() === 5;
    const season = 1 + 0.5 * Math.sin((day + 240) / 40) + (day > -40 ? 0.35 : 0);
    let n = Math.round((weekend ? 3.2 : 1.1) * season * (0.5 + r()));
    if (day > 0) n = Math.round(n * (1 - day / 22));
    for (let k = 0; k < n; k++) {
      const p = pick(weighted);
      const created = new Date(d); created.setDate(created.getDate() - Math.floor(r() * 9) - (day > 0 ? 0 : 1)); created.setHours(8 + Math.floor(r() * 13), Math.floor(r() * 60));
      if (created > new Date()) created.setTime(Date.now() - Math.floor(r() * 36e5 * 30));
      const hour = weekend && r() < 0.35 ? 9 + Math.floor(r() * 3) : 12 + Math.floor(r() * 9);
      const past = day < 0;
      const status = past ? (r() < 0.86 ? 'completed' : r() < 0.6 ? 'cancelled' : 'no_show') : day === 0 ? (r() < 0.5 ? 'seated' : 'confirmed') : (r() < 0.55 ? 'confirmed' : 'new');
      const guests = r() < 0.45 ? 2 : r() < 0.5 ? Math.ceil(r() * 4) + 2 : r() < 0.8 ? Math.ceil(r() * 4) + 4 : Math.ceil(r() * 10) + 8;
      const b = {
        id: 'b' + created.getTime().toString(36) + k, created: created.toISOString(), source: r() < 0.78 ? 'website' : 'phone',
        name: p.name, phone: p.phone, email: p.email, date: iso(d), time: pad(hour) + ':' + (r() < 0.5 ? '00' : '30'), guests,
        notes: pick(NOTES), status, marketing: p.consent, customer: p.phone.replace(/\D/g, ''), history: [{ at: created.toISOString(), by: 'Website', status: 'new' }]
      };
      bookings.push(b);
      const key = b.customer;
      const c = customers[key] || (customers[key] = { key, name: p.name, phone: p.phone, email: p.email, first_seen: b.created, last_seen: b.created, bookings: 0, guests: 0, tags: [],
        consent: { email: p.consent && !!p.email, whatsapp: p.consent, at: b.created, source: 'Booking form' } });
      c.bookings++; c.guests += guests;
      if (b.created < c.first_seen) c.first_seen = b.created;
      if (b.created > c.last_seen) c.last_seen = b.created;
    }
  }
  Object.values(customers).forEach(c => {
    if (c.bookings >= 4) c.tags.push('Regular');
    if (r() < 0.2) c.tags.push(pick(TAGS.slice(1)));
    c.tags = [...new Set(c.tags)];
  });
  for (const b of bookings) await store.set('bookings', b.id, b);
  for (const c of Object.values(customers)) await store.set('customers', c.key, c);

  const recent = bookings.filter(b => b.created < new Date().toISOString()).sort((a, b) => (a.created < b.created ? 1 : -1)).slice(0, 8);
  for (const b of recent) await store.set('activity', 'a' + b.id, { at: b.created, by: 'Website', type: 'booking', text: 'New table request from ' + b.name, ref: b.id });
  await store.set('activity', 'a-x1', { at: new Date(Date.now() - 26 * 36e5).toISOString(), by: 'Wanjiru (Manager)', type: 'website', text: 'Published the Art & Events page' });
}

module.exports = { fill };
