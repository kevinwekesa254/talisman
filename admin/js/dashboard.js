/* Dashboard: numbers at a glance, bookings over time, party sizes, activity and the next tables. */
import { html, useState, useEffect, useMemo, api, useApp, setState, load, can, go, toast, I, Avatar, StatusPill, Empty, Skeleton, fmtDay, fmtTime, ago, num, isoDay, parseDay, MONTH_NAMES, today } from './core.js';

function useBookingStats(bookings) {
  return useMemo(() => {
    if (!bookings) return null;
    const live = bookings.filter(b => b.status !== 'cancelled');
    // A guest's first booking counts as "new", later ones as "returning".
    const first = {};
    live.slice().sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1)).forEach(b => { if (!(b.customer in first)) first[b.customer] = b.id; });
    return { live, first };
  }, [bookings]);
}

function Kpi({ icon, tone, label, value, delta, sub, onClick }) {
  return html`<button class="card kpi" style="text-align:left;cursor:pointer" onClick=${onClick}>
    <span class=${'kpi__icon' + (tone ? ' kpi__icon--' + tone : '')}><${I} n=${icon} /></span>
    <span><span class="kpi__label">${label}</span><div class="kpi__value">${value}</div>
      ${delta != null ? html`<div class=${'kpi__delta ' + (delta >= 0 ? 'up' : 'down')}><${I} n=${delta >= 0 ? 'trend-up' : 'trend-down'} />${Math.abs(delta)}% vs. last month</div>` : sub && html`<div class="kpi__delta muted">${sub}</div>`}</span>
  </button>`;
}

function niceMax(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function BookingsChart({ stats }) {
  const [range, setRange] = useState('monthly');
  const [hot, setHot] = useState(null);
  const data = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const buckets = [];
    if (range === 'monthly') {
      for (let i = 7; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.push({ label: MONTH_NAMES[d.getMonth()], from: isoDay(d), to: isoDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }); }
    } else if (range === 'weekly') {
      const mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
      for (let i = 7; i >= 0; i--) { const a = new Date(mon); a.setDate(a.getDate() - i * 7); const b = new Date(a); b.setDate(b.getDate() + 6); buckets.push({ label: a.getDate() + ' ' + MONTH_NAMES[a.getMonth()], from: isoDay(a), to: isoDay(b) }); }
    } else {
      for (let i = 0; i < 14; i++) { const d = new Date(now); d.setDate(d.getDate() + i); buckets.push({ label: i === 0 ? 'Today' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate(), from: isoDay(d), to: isoDay(d) }); }
    }
    buckets.forEach(k => { k.fresh = 0; k.back = 0; k.guests = 0; });
    stats.live.forEach(b => {
      const k = buckets.find(x => b.date >= x.from && b.date <= x.to);
      if (!k) return;
      if (stats.first[b.customer] === b.id) k.fresh++; else k.back++;
      k.guests += b.guests || 0;
    });
    const max = niceMax(Math.max(1, ...buckets.map(k => k.fresh + k.back)));
    return { buckets, max };
  }, [stats, range]);
  const ticks = [0, .2, .4, .6, .8, 1].map(t => Math.round(data.max * t));
  const sel = hot != null ? data.buckets[hot] : null;
  return html`<div class="card">
    <div class="card__head"><h3><${I} n="chart-bar" /> Bookings</h3>
      <div class="seg">${[['monthly', 'Monthly'], ['weekly', 'Weekly'], ['next', 'Next 14 days']].map(([k, l]) => html`<button class=${range === k ? 'is-on' : ''} onClick=${() => { setRange(k); setHot(null); }}>${l}</button>`)}</div></div>
    <div class="legend"><span><i class="dot" style="background:var(--chart-a)"></i>First visit</span><span><i class="dot" style="background:var(--chart-b)"></i>Returning guests</span></div>
    <div class="chart" onMouseLeave=${() => setHot(null)}>
      <div class="chart__y">${ticks.map(t => html`<span>${t}</span>`)}</div>
      <div class="chart__plot">
        <div class="chart__grid">${ticks.map(() => html`<i></i>`)}</div>
        ${data.buckets.map((k, i) => html`<div class=${'bar' + (hot === i ? ' is-hot' : '')} onMouseEnter=${() => setHot(i)} onClick=${() => setHot(i)}>
          <div class="bar__track">
            <div class="bar__a" style=${'height:' + (k.fresh / data.max * 100) + '%'}></div>
            <div class="bar__b" style=${'height:' + (k.back / data.max * 100) + '%'}></div>
          </div><span class="bar__x">${k.label}</span></div>`)}
        ${sel && html`<div class="tip" style=${'left:calc(' + ((hot + 1) / data.buckets.length * 100) + '% ' + (hot > data.buckets.length * .6 ? '- 230px' : '- 10px') + ');top:30%'}>
          <div class="tip__row"><span><i class="dot" style="background:var(--chart-a)"></i>First visit</span><b>${sel.fresh} booking${sel.fresh === 1 ? '' : 's'}</b></div>
          <div class="tip__row"><span><i class="dot" style="background:var(--chart-b)"></i>Returning guests</span><b>${sel.back} booking${sel.back === 1 ? '' : 's'}</b></div>
          <div class="tip__row"><span><${I} n="users" /> Guests</span><b>${num(sel.guests)}</b></div>
        </div>`}
      </div>
    </div>
  </div>`;
}

function PartySizes({ stats }) {
  const since = new Date(); since.setDate(since.getDate() - 90);
  const list = stats.live.filter(b => b.date >= isoDay(since) && b.date <= today());
  const groups = [
    { label: 'Couples and solo (1–2)', test: g => g <= 2, color: 'var(--gold)' },
    { label: 'Small groups (3–4)', test: g => g >= 3 && g <= 4, color: '#8A2E37' },
    { label: 'Families (5–8)', test: g => g >= 5 && g <= 8, color: '#6E7B4E' },
    { label: 'Large parties (9+)', test: g => g >= 9, color: '#3E6E8E' }
  ].map(g => Object.assign(g, { n: list.filter(b => g.test(b.guests || 0)).length }));
  const total = list.length || 1;
  const R = 84, C = 2 * Math.PI * R, gap = list.length ? 10 : 0;
  let off = 0;
  return html`<div class="card">
    <div class="card__head"><h3><${I} n="users-four" /> Party sizes</h3><span class="pill pill--outline">Last 90 days</span></div>
    <div class="donut">
      <svg viewBox="0 0 210 210">
        <circle cx="105" cy="105" r=${R} fill="none" stroke="var(--sunken)" stroke-width="18" />
        ${groups.map(g => { const len = Math.max(0, g.n / total * C - gap); const el = g.n ? html`<circle cx="105" cy="105" r=${R} fill="none" stroke=${g.color} stroke-width="18" stroke-linecap="round" stroke-dasharray=${len + ' ' + C} stroke-dashoffset=${-off - gap / 2} />` : null; off += g.n / total * C; return el; })}
      </svg>
      <div class="donut__c"><small>Bookings</small><b>${num(list.length)}</b></div>
    </div>
    <div class="donut-list">${groups.map(g => html`<div><span><i class="dot" style=${'background:' + g.color}></i>${g.label}</span><em>${num(g.n)}</em><b>${Math.round(g.n / total * 100)}%</b></div>`)}</div>
  </div>`;
}

const ACT = { booking: ['user-circle', '', 'New request', 'pill--accent'], website: ['globe', 'green', 'Website', 'pill--green'], team: ['user-gear', 'grey', 'Team', ''], customer: ['user-minus', 'red', 'Customer', 'pill--red'], media: ['image', 'grey', 'Pictures', ''] };
function Activity() {
  const [items, setItems] = useState(null);
  useEffect(() => { api('activity').then(d => setItems(d.activity)).catch(() => setItems([])); }, []);
  return html`<div class="card">
    <div class="card__head"><h3><${I} n="clock-counter-clockwise" /> Recent activity</h3></div>
    ${!items ? html`<${Skeleton} rows=${4} />` : !items.length ? html`<${Empty} icon="clock" title="Nothing yet" text="New bookings and published pages will show here." />` :
    html`<div class="acts">${items.slice(0, 4).map(a => {
      const [icon, tone, tag, cls] = ACT[a.type] || ACT.team;
      const isNew = a.type === 'booking' && /^New/.test(a.text);
      return html`<button class="act" onClick=${() => a.ref ? setState({ openBooking: a.ref }) : a.type === 'website' ? go('/pages') : null}>
        <span class=${'act__icon' + (tone ? ' act__icon--' + tone : '')}><${I} n=${icon} /></span>
        <span class="grow"><div class="act__t ellipsis">${a.text}</div><div class="act__m"><span>${a.by}</span><i></i><span>${ago(a.at)}</span></div></span>
        <span class=${'pill ' + (isNew ? 'pill--accent' : a.type === 'booking' ? '' : cls)}>${isNew ? 'New request' : a.type === 'booking' ? 'Booking' : tag}</span></button>`;
    })}</div>`}
  </div>`;
}

function Upcoming({ bookings }) {
  const [sort, setSort] = useState('date');
  const [filter, setFilter] = useState('all');
  const t = today();
  let list = bookings.filter(b => b.date >= t && !['cancelled', 'completed', 'no_show'].includes(b.status));
  if (filter !== 'all') list = list.filter(b => b.status === filter);
  list.sort(sort === 'size' ? (a, b) => (b.guests || 0) - (a.guests || 0) : (a, b) => (a.date + (a.time || '99') < b.date + (b.time || '99') ? -1 : 1));
  return html`<div class="card">
    <div class="card__head"><h3><${I} n="calendar-check" /> Upcoming tables</h3>
      <button class="btn" onClick=${() => setSort(sort === 'date' ? 'size' : 'date')}><${I} n="sort-ascending" />${sort === 'date' ? 'By date' : 'By party size'}</button>
      <button class="btn" onClick=${() => setFilter(filter === 'all' ? 'new' : filter === 'new' ? 'confirmed' : 'all')}><${I} n="funnel-simple" />${filter === 'all' ? 'All' : filter === 'new' ? 'New requests' : 'Confirmed'}</button></div>
    ${list.length ? html`<div class="table-wrap"><table class="t">
      <thead><tr><th>Guest</th><th>Date</th><th>Time</th><th class="num">Guests</th><th>Status</th></tr></thead>
      <tbody>${list.slice(0, 6).map(b => html`<tr onClick=${() => setState({ openBooking: b.id })}>
        <td><div class="who"><${Avatar} name=${b.name} size="sm" /><span><b>${b.name}</b></span></div></td>
        <td>${fmtDay(b.date)}</td><td>${fmtTime(b.time)}</td><td class="num">${b.guests || '–'}</td><td><${StatusPill} s=${b.status} /></td></tr>`)}</tbody>
    </table></div>` : html`<${Empty} icon="calendar-blank" title="No upcoming tables" text="New requests from the website appear here." />`}
    ${list.length > 6 && html`<div style="padding:0 20px 16px"><a href="#/bookings">See all ${list.length} upcoming bookings →</a></div>`}
  </div>`;
}

function SampleNote({ empty }) {
  const s = useApp();
  if (!s.me.setup.local || !can('team')) return null;
  async function run(action) {
    await api('sample', { body: { action } });
    await Promise.all([load('bookings', true), can('customers') && load('customers', true)]);
    toast(action === 'clear' ? 'Sample data cleared' : 'Sample data loaded');
    setState({ activityKey: Date.now() });
  }
  return empty
    ? html`<div class="card"><${Empty} icon="flask" title="No bookings yet" text="On the live site, table requests from the booking form land here. Load sample bookings to see how the dashboard works.">
        <button class="btn btn--primary" onClick=${() => run('fill')}><${I} n="sparkle" />Load sample data</button></${Empty}></div>`
    : html`<div class="note note--amber"><${I} n="flask" /><span class="grow">You are looking at <b>sample data</b> on your computer. None of these people are real.</span><button class="btn btn--sm" onClick=${() => run('clear')}>Clear sample data</button></div>`;
}

export function Dashboard() {
  const s = useApp();
  useEffect(() => { load('bookings'); if (can('customers')) load('customers'); }, []);
  const stats = useBookingStats(s.bookings);
  if (!s.bookings) return html`<div class="kpis">${[0, 1, 2, 3].map(() => html`<div class="card skel" style="height:104px"></div>`)}</div><div class="card skel" style="height:420px"></div>`;
  if (!s.bookings.length) return html`<${SampleNote} empty />`;
  const now = new Date();
  const mStart = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const lmStart = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lmSame = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), now.getHours());
  const thisMonth = s.bookings.filter(b => b.created.slice(0, 10) >= mStart).length;
  const lastMonth = s.bookings.filter(b => b.created.slice(0, 10) >= lmStart && b.created < lmSame.toISOString()).length;
  const delta = lastMonth ? Math.round((thisMonth - lastMonth) / lastMonth * 100) : null;
  const t = today(), wk = new Date(); wk.setDate(wk.getDate() + 6);
  const next7 = s.bookings.filter(b => b.date >= t && b.date <= isoDay(wk) && ['new', 'confirmed', 'seated'].includes(b.status));
  const waiting = s.bookings.filter(b => b.status === 'new' && b.date >= t);
  const customers = s.customers || [];
  const subscribed = customers.filter(c => c.consent && (c.consent.email || c.consent.whatsapp)).length;
  const local = s.me.setup.local && s.bookings.some(b => /@example\.com$/.test(b.email || ''));
  return html`
    ${local && html`<${SampleNote} />`}
    <div class="kpis">
      <${Kpi} icon="calendar-plus" label="Bookings this month" value=${num(thisMonth)} delta=${delta} onClick=${() => go('/bookings')} />
      <${Kpi} icon="users" tone="green" label="Guests in the next 7 days" value=${num(next7.reduce((n, b) => n + (b.guests || 0), 0))} sub=${next7.length + ' tables booked'} onClick=${() => go('/bookings')} />
      <${Kpi} icon="bell-ringing" tone="red" label="Waiting for a call back" value=${num(waiting.length)} sub=${waiting.length ? 'Oldest ' + ago(waiting.reduce((a, b) => (a.created < b.created ? a : b)).created) : 'All caught up'} onClick=${() => go('/bookings/new')} />
      <${Kpi} icon="address-book" tone="amber" label="Customers" value=${num(customers.length)} sub=${num(subscribed) + ' happy to hear from you'} onClick=${() => go('/customers')} />
    </div>
    <div class="dash-2"><${BookingsChart} stats=${stats} /><${PartySizes} stats=${stats} /></div>
    <div class="dash-3"><${Activity} key=${s.activityKey} /><${Upcoming} bookings=${s.bookings} /></div>`;
}
