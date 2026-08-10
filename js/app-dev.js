// ─── FAVICON HELPER ───────────────────────────────────────────────────────────
function setFavicon(emoji) {
  const existing = document.getElementById('favicon');
  if (existing) existing.remove();
  const link = document.createElement('link');
  link.rel = 'icon';
  link.id = 'favicon';
  link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`;
  document.head.appendChild(link);
}

// ─── TIMEZONE LABEL ───────────────────────────────────────────────────────────
(function() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMap = {
    'Asia/Kolkata':'IST','Asia/Calcutta':'IST','Asia/Dubai':'GST','Asia/Muscat':'GST',
    'Asia/Singapore':'SGT','Asia/Kuala_Lumpur':'MYT','America/New_York':'EST',
    'America/Chicago':'CST','America/Denver':'MST','America/Los_Angeles':'PST',
    'Europe/London':'GMT','Europe/Paris':'CET','Europe/Berlin':'CET','Asia/Tokyo':'JST',
    'Asia/Shanghai':'CST','Asia/Hong_Kong':'HKT','Australia/Sydney':'AEDT',
    'Australia/Melbourne':'AEDT','Pacific/Auckland':'NZST','Asia/Karachi':'PKT',
    'Asia/Dhaka':'BST','Asia/Bangkok':'ICT','Africa/Nairobi':'EAT',
    'America/Toronto':'EST','America/Vancouver':'PST','Asia/Riyadh':'AST',
    'Asia/Kuwait':'AST','Asia/Qatar':'AST','Asia/Bahrain':'AST','Asia/Baghdad':'AST',
  };
  const abbr = tzMap[tz] || new Date().toLocaleTimeString('en-US', {timeZoneName:'short'}).split(' ').pop();
  document.getElementById('tzLabel').textContent = abbr;
})();

// ─── PORTAL NAVIGATION ───────────────────────────────────────────────────────
function showSectionSelector() {
  document.title = 'Class Schedule';
  setFavicon('📅');
  document.getElementById('portal-page').style.display = 'none';
  document.getElementById('welcome-page').style.display = 'flex';
}

function showPortal() {
  document.title = 'Academic Hub';
  setFavicon('🎓');
  document.getElementById('welcome-page').style.display = 'none';
  document.getElementById('calendar-app').style.display = 'none';
  document.getElementById('portal-page').style.display = 'flex';
}

// ─── SECTION CONFIG ───────────────────────────────────────────────────────────
// Add iCal URLs for each section here
const SECTION_URLS = {
  'A':   'https://outlook.live.com/owa/calendar/00000000-0000-0000-0000-000000000000/88a096a5-1f3f-4f7c-b8d9-f5f6b059006c/cid-68D162D0749195B1/calendar.ics',
  'B':   'https://outlook.live.com/owa/calendar/00000000-0000-0000-0000-000000000000/88a096a5-1f3f-4f7c-b8d9-f5f6b059006c/cid-68D162D0749195B1/calendar.ics',
  'C':   'https://outlook.live.com/owa/calendar/00000000-0000-0000-0000-000000000000/88a096a5-1f3f-4f7c-b8d9-f5f6b059006c/cid-68D162D0749195B1/calendar.ics',
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let events = [];
let currentDate = new Date();
let currentView = 'monthly';
let currentFilter = 'all';
let icalUrl = '';
let currentSection = '';


// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 60;
const DAY_START = 5;
const DAY_END = 23;

// ─── SECTION FUNCTIONS ────────────────────────────────────────────────────────
function selectSection(section) {
  const dd = document.getElementById('sectionDropdown');
  if (dd) dd.style.display = 'none';
  localStorage.setItem('selectedSection', section);
  localStorage.setItem('sectionTimestamp', Date.now().toString());
  icalUrl = SECTION_URLS[section];
  currentSection = section;
  document.title = 'Class Schedule';
  setFavicon('📅');
  document.getElementById('sectionBadgeText').textContent = 'Section ' + section;
  document.getElementById('headerSub').textContent = 'Section ' + section + ' · Academic Calendar';
  document.getElementById('welcome-page').style.display = 'none';
  document.getElementById('portal-page').style.display = 'none';
  document.getElementById('calendar-app').style.display = 'block';
  events = [];
  autoSync();
  render();
}

function toggleSectionDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('sectionDropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', () => {
  const dd = document.getElementById('sectionDropdown');
  if (dd) dd.style.display = 'none';
});

// ─── RRULE EXPANDER ───────────────────────────────────────────────────────────
function parseUntil(str) {
  const y=+str.slice(0,4),mo=+str.slice(4,6)-1,d=+str.slice(6,8);
  if (str.includes('T')) {
    const h=+str.slice(9,11),mi=+str.slice(11,13);
    return new Date(Date.UTC(y,mo,d,h,mi));
  }
  return new Date(y,mo,d);
}

function expandRRule(start, end, rrule, exdates) {
  const occurrences = [];
  const duration = end - start;
  const parts = {};
  rrule.split(';').forEach(p => {
    const [k,v] = p.split('=');
    parts[k] = v;
  });
  const freq = parts['FREQ'];
  const interval = parseInt(parts['INTERVAL'] || '1');
  const count = parts['COUNT'] ? parseInt(parts['COUNT']) : null;
  const until = parts['UNTIL'] ? parseUntil(parts['UNTIL']) : null;
  const byDay = parts['BYDAY'] ? parts['BYDAY'].split(',') : null;
  const dayMap = {SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
  let current = new Date(start);
  let num = 0;
  const maxOccurrences = 500;
  while (num < maxOccurrences) {
    if (count !== null && occurrences.length >= count) break;
    if (until !== null && current > until) break;
    let matches = true;
    if (byDay && freq === 'WEEKLY') {
      matches = byDay.some(d => {
        const dayStr = d.replace(/[0-9+-]/g,'');
        return current.getDay() === dayMap[dayStr];
      });
    }
    const isExcluded = exdates.some(ex => ex &&
      ex.getFullYear()===current.getFullYear() &&
      ex.getMonth()===current.getMonth() &&
      ex.getDate()===current.getDate()
    );
    if (matches && !isExcluded) {
      occurrences.push({start:new Date(current), end:new Date(current.getTime()+duration)});
    }
    if (freq==='DAILY') {
      current = new Date(current.getTime() + interval*86400000);
    } else if (freq==='WEEKLY') {
      if (byDay && byDay.length > 1) {
        current = new Date(current.getTime() + 86400000);
      } else {
        current = new Date(current.getTime() + interval*7*86400000);
      }
    } else if (freq==='MONTHLY') {
      current = new Date(current.getFullYear(), current.getMonth()+interval, current.getDate(), current.getHours(), current.getMinutes());
    } else {
      break;
    }
    num++;
  }
  return occurrences;
}


// ─── iCAL PARSER ─────────────────────────────────────────────────────────────
function parseICS(text) {
  text = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const lines = text.split('\n');
  const evs = []; let cur = null;
  const tzOffsets = {
    'Asia/Dubai':240,'Asia/Muscat':240,'Asia/Kolkata':330,'Asia/Calcutta':330,
    'Asia/Singapore':480,'Asia/Kuala_Lumpur':480,'America/New_York':-300,
    'America/Chicago':-360,'America/Denver':-420,'America/Los_Angeles':-480,
    'America/Toronto':-300,'America/Vancouver':-480,'Europe/London':0,
    'Europe/Paris':60,'Europe/Berlin':60,'Asia/Tokyo':540,'Asia/Shanghai':480,
    'Asia/Hong_Kong':480,'Asia/Karachi':300,'Asia/Dhaka':360,'Asia/Bangkok':420,
    'Asia/Riyadh':180,'Asia/Kuwait':180,'Asia/Qatar':180,'Asia/Bahrain':180,
    'Asia/Baghdad':180,'Africa/Nairobi':180,'Pacific/Auckland':720,
    'Australia/Sydney':600,'Australia/Melbourne':600,
  };
  const parseDate = s => {
    if (!s) return null;
    const tzid = (s.match(/TZID=([^:;]+)/) || [])[1];
    s = s.replace(/^[^:]+:/, '');
    const y=+s.slice(0,4),mo=+s.slice(4,6)-1,d=+s.slice(6,8);
    if (s.includes('T')) {
      const h=+s.slice(9,11),mi=+s.slice(11,13);
      if (s.endsWith('Z')) return new Date(Date.UTC(y,mo,d,h,mi));
      if (tzid && tzOffsets[tzid] !== undefined) return new Date(Date.UTC(y,mo,d,h,mi) - tzOffsets[tzid]*60000);
      return new Date(y,mo,d,h,mi);
    }
    return new Date(y,mo,d);
  };
  for (const raw of lines) {
    const colon = raw.indexOf(':');
    if (colon < 0) continue;
    const key = raw.slice(0, colon).toUpperCase().split(';')[0];
    const val = raw.slice(colon+1).trim();
    if (key==='BEGIN' && val==='VEVENT') cur={};
    else if (key==='END' && val==='VEVENT' && cur) {
      if (cur.start) {
        const {category,cleanDesc,extractedUrl,sectionTag} = parseSpecialization(cur.description||'');
        const baseEvent = {
          title:cur.title||'Event',
          location:cur.location||'',
          url:cur.url?(cur.url.startsWith('http')?cur.url:'https://'+cur.url):extractedUrl||'',
          description:cleanDesc,
          category,
          sectionTag
        };
        if (cur.rrule) {
          const occurrences = expandRRule(cur.start, cur.end, cur.rrule, cur.exdates||[]);
          occurrences.forEach(({start,end}) => {
            evs.push({...baseEvent, id:Math.random().toString(36).slice(2), start, end, uid:cur.uid||null});
          });
        } else if (cur.recurrenceId) {
          // This is a modified occurrence — store it separately
          evs.push({...baseEvent, id:Math.random().toString(36).slice(2), start:cur.start, end:cur.end||cur.start, uid:cur.uid||null, recurrenceId:cur.recurrenceId});
        } else {
          evs.push({...baseEvent, id:Math.random().toString(36).slice(2), start:cur.start, end:cur.end||cur.start, uid:cur.uid||null});
      }
      }
      cur=null;
    } else if (cur) {
        if (key==='SUMMARY') cur.title=val;
        else if (key==='DTSTART') cur.start=parseDate(raw);
        else if (key==='DTEND') cur.end=parseDate(raw);
        else if (key==='LOCATION') cur.location=val;
        else if (key==='URL') cur.url=val;
        else if (key==='DESCRIPTION') cur.description=val.replace(/\\n/g,'\n').replace(/\\,/g,',');
        else if (key==='RRULE') cur.rrule=val;
        else if (key==='EXDATE') cur.exdates=(cur.exdates||[]).concat(val.split(',').map(v=>parseDate(v.includes(':')?v:'EXDATE:'+v)));
        else if (key==='RECURRENCE-ID') cur.recurrenceId=parseDate(raw);
        else if (key==='UID') cur.uid=val;
      }
  }
  // Remove recurring occurrences that have been overridden by RECURRENCE-ID events
  const overrides = evs.filter(e => e.recurrenceId);
  overrides.forEach(override => {
    const overrideDate = override.recurrenceId;
    // Remove the original occurrence from the recurring series that matches this date
    const idx = evs.findIndex(e => 
      !e.recurrenceId &&
      e.uid === override.uid &&
      e.start.getFullYear() === overrideDate.getFullYear() &&
      e.start.getMonth() === overrideDate.getMonth() &&
      e.start.getDate() === overrideDate.getDate()
    );
    if (idx !== -1) evs.splice(idx, 1);
  });

  return evs;
}

// ─── PARSE SPECIALIZATION ─────────────────────────────────────────────────────
function parseSpecialization(desc) {
  const map = {'finance':'finance','marketing':'marketing','supply chain':'supplychain','core':'common'};
  let category='common', cleanDesc=desc, extractedUrl='';
  const urlMatch = desc.match(/https?:\/\/[^\s\n\\]+/i);
  if (urlMatch) { extractedUrl=urlMatch[0].replace(/\\$/,'').trim(); cleanDesc=cleanDesc.replace(urlMatch[0],''); }
  const match = desc.match(/specialization\s*:\s*([^\n\r\\]+)/i);
  if (match) {
    const val = match[1].trim().toLowerCase();
    for (const [k,v] of Object.entries(map)) { if (val.includes(k)) { category=v; break; } }
    cleanDesc = cleanDesc.replace(/specialization\s*:[^\n]*/i,'');
  }
  cleanDesc = cleanDesc.replace(/----\(.*?\)----/g,'').replace(/---[=\-]+---/g,'').replace(/--[=\-]+=*--*/g,'').replace(/\n{2,}/g,'\n').trim();
  let sectionTag = ['all'];
const sectionMatch = cleanDesc.match(/section\s*:\s*([^\n\r\\]+)/i);
if (sectionMatch) {
  const sv = sectionMatch[1].trim().toLowerCase();
  if (sv === 'all') {
    sectionTag = ['all'];
  } else {
    const parts = sv.split(',').map(p => p.trim().toUpperCase()).filter(p => ['A','B','C'].includes(p));
    sectionTag = parts.length ? parts : ['all'];
  }
  cleanDesc = cleanDesc.replace(/section\s*:[^\n]*/i, '').trim();
}
  return {category,cleanDesc,extractedUrl, sectionTag};
  }

// ─── SYNC ─────────────────────────────────────────────────────────────────────
async function autoSync() {
  if (!icalUrl || icalUrl.includes('PASTE')) return;
  setSyncing(true);
  try {
    const proxyUrl = 'https://academichub.arnav-jain12.workers.dev/?url=' + encodeURIComponent(icalUrl) + '&_=' + Date.now();
    const res = await fetch(proxyUrl);
    const text = await res.text();
    if (!text.includes('VCALENDAR')) { setSyncing(false,'Sync failed'); return; }
    events = parseICS(text);
    render();
    setSyncing(false,'Synced · iCloud');
  } catch(e) { setSyncing(false,'Sync failed'); }
}
async function manualSync() { await autoSync(); }
function setSyncing(on,msg) {
  const badge=document.getElementById('syncBadge'), txt=document.getElementById('syncText');
  if (on) { badge.classList.add('syncing'); txt.textContent='Syncing…'; }
  else { badge.classList.remove('syncing'); txt.textContent=msg||'Live from iCloud'; }
}

// ─── FILTER & VIEW ────────────────────────────────────────────────────────────
function setFilter(f) {
  currentFilter=f;
  ['all','finance','marketing','supplychain'].forEach(k => {
    const p=document.getElementById('pill-'+k); p.className='pill';
    if (k===f) p.classList.add(f==='all'?'active-all':f==='finance'?'active-finance':f==='marketing'?'active-marketing':'active-supplychain');
  });
  render();
}
function eventVisible(ev) {
  // Section filter — applies to A, B, and C
  if (currentSection === 'A' || currentSection === 'B' || currentSection === 'C') {
    const tags = ev.sectionTag || ['all'];
    if (!tags.includes('all') && !tags.includes(currentSection)) return false;
  }
  // Specialization filter
  if (currentFilter==='all') return true;
  if (currentFilter==='finance') return ev.category==='common'||ev.category==='finance';
  if (currentFilter==='marketing') return ev.category==='common'||ev.category==='marketing';
  if (currentFilter==='supplychain') return ev.category==='common'||ev.category==='supplychain';
  return true;
}
function setView(v) {
  currentView=v;
  document.getElementById('monthly-view').style.display=v==='monthly'?'block':'none';
  document.getElementById('weekly-view').style.display=v==='weekly'?'block':'none';
  document.getElementById('btn-monthly').classList.toggle('active',v==='monthly');
  document.getElementById('btn-weekly').classList.toggle('active',v==='weekly');
  render();
}
function navigate(dir) {
  if (currentView==='monthly') currentDate=new Date(currentDate.getFullYear(),currentDate.getMonth()+dir,1);
  else currentDate=new Date(currentDate.getTime()+dir*7*86400000);
  render();
}
function goToday() { currentDate=new Date(); render(); }
function render() { if (currentView==='monthly') renderMonthly(); else renderWeekly(); }

// ─── MONTHLY ──────────────────────────────────────────────────────────────────
function renderMonthly() {
  const y=currentDate.getFullYear(), m=currentDate.getMonth(), today=new Date();
  document.getElementById('periodLabel').textContent=new Date(y,m,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const firstDay=new Date(y,m,1).getDay(), daysInMonth=new Date(y,m+1,0).getDate(), daysInPrev=new Date(y,m,0).getDate();
  const grid=document.getElementById('monthGrid'); grid.innerHTML='';
  const totalCells=Math.ceil((firstDay+daysInMonth)/7)*7;
  for (let i=0;i<totalCells;i++) {
    let day,month=m,year=y,otherMonth=false;
    if (i<firstDay) { day=daysInPrev-firstDay+i+1; month=m-1; otherMonth=true; if(month<0){month=11;year--;} }
    else if (i>=firstDay+daysInMonth) { day=i-firstDay-daysInMonth+1; month=m+1; otherMonth=true; if(month>11){month=0;year++;} }
    else { day=i-firstDay+1; }
    const isToday=new Date(year,month,day).toDateString()===today.toDateString();
    const cell=document.createElement('div');
    cell.className='grid-cell'+(otherMonth?' other-month':'')+(isToday?' today':'');
    const dateEl=document.createElement('div'); dateEl.className='cell-date';
    if (day===1) { dateEl.textContent=new Date(year,month,1).toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
    else if (isToday) { dateEl.textContent=new Date(year,month,day).toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
    else { dateEl.textContent=day; }
    cell.appendChild(dateEl);
    const dayEvs=events.filter(e=>{ const d=new Date(e.start); return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day; }).filter(ev=>eventVisible(ev)).sort((a,b)=>a.start-b.start);
    dayEvs.slice(0,3).forEach(ev=>{
      const chip=document.createElement('div'); chip.className='event-chip chip-'+ev.category;
      if (!eventVisible(ev)) chip.classList.add('chip-hidden');
      chip.textContent=ev.title; chip.title=ev.title; chip.onclick=()=>openModal(ev);
      cell.appendChild(chip);
    });
    if (dayEvs.length>3) {
      const more=document.createElement('div');
      more.className='more-events';
      more.textContent='+'+(dayEvs.length-3)+' more';
      more.onclick=()=>openDayPopup(dayEvs.filter(ev=>eventVisible(ev)), new Date(year,month,day));
      cell.appendChild(more);
    }
    grid.appendChild(cell);
  }
}

// ─── WEEKLY ───────────────────────────────────────────────────────────────────
function renderWeekly() {
  const today = new Date();
  const dow = currentDate.getDay();
  const weekStart = new Date(currentDate); weekStart.setDate(currentDate.getDate()-dow); weekStart.setHours(0,0,0,0);
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); return d; });
  document.getElementById('periodLabel').textContent =
    days[0].toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' – ' +
    days[6].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const hdr = document.getElementById('weekHeaders');
  hdr.innerHTML = '<div class="week-header-time-gutter"></div>';
  days.forEach(d => {
    const isToday = d.toDateString()===today.toDateString();
    hdr.innerHTML += `<div class="week-header-day${isToday?' today-col':''}">
      ${d.toLocaleDateString('en-US',{weekday:'short'})}
      <span class="week-header-date">${d.getDate()}</span>
      <span style="font-size:9px;opacity:0.65;display:block;">${d.toLocaleDateString('en-US',{month:'short'})}</span>
    </div>`;
  });
  const grid = document.getElementById('weekBodyGrid');
  grid.innerHTML = '';
  const totalHours = DAY_END - DAY_START;
  const totalHeight = totalHours * HOUR_HEIGHT;
  const timeCol = document.createElement('div');
  timeCol.className = 'week-time-col';
  for (let h=DAY_START; h<DAY_END; h++) {
    const slot = document.createElement('div');
    slot.className = 'week-time-slot';
    slot.textContent = h<12 ? h+':00 AM' : h===12 ? '12:00 PM' : (h-12)+':00 PM';
    timeCol.appendChild(slot);
  }
  grid.appendChild(timeCol);
  days.forEach(d => {
    const isToday = d.toDateString()===today.toDateString();
    const col = document.createElement('div');
    col.className = 'week-day-col-wrap' + (isToday?' today-day':'');
    col.style.height = totalHeight + 'px';
    col.style.position = 'relative';
    for (let h=0; h<totalHours; h++) {
      const line = document.createElement('div'); line.className='week-hour-line'; line.style.top=(h*HOUR_HEIGHT)+'px'; col.appendChild(line);
      const half = document.createElement('div'); half.className='week-half-line'; half.style.top=(h*HOUR_HEIGHT+HOUR_HEIGHT/2)+'px'; col.appendChild(half);
    }
    const dayEvs = events.filter(ev => {
      if (!eventVisible(ev)) return false;
      const s = new Date(ev.start);
      return s.getFullYear()===d.getFullYear() && s.getMonth()===d.getMonth() && s.getDate()===d.getDate();
    }).sort((a,b)=>a.start-b.start);
    // Group overlapping events and position side by side
    const evGroups = [];
    dayEvs.forEach(ev => {
      const st=new Date(ev.start), en=new Date(ev.end);
      const startMins=st.getHours()*60+st.getMinutes();
      const endMins=en.getHours()*60+en.getMinutes();
      // Find a group this event overlaps with
      let placed = false;
      for (const group of evGroups) {
        const overlaps = group.some(g => {
          const gst=new Date(g.start).getHours()*60+new Date(g.start).getMinutes();
          const gen=new Date(g.end).getHours()*60+new Date(g.end).getMinutes();
          return startMins < gen && endMins > gst;
        });
        if (overlaps) { group.push(ev); placed=true; break; }
      }
      if (!placed) evGroups.push([ev]);
    });
    
    evGroups.forEach(group => {
      const total = group.length;
      group.forEach((ev, idx) => {
        const st=new Date(ev.start), en=new Date(ev.end);
        const startMins=st.getHours()*60+st.getMinutes();
        const endMins=en.getHours()*60+en.getMinutes();
        const topPx=(startMins-DAY_START*60)/60*HOUR_HEIGHT;
        const heightPx=Math.max((endMins-startMins)/60*HOUR_HEIGHT,24);
        if (topPx<0||topPx>totalHeight) return;
        const width = 100/total;
        const left = width*idx;
        const el=document.createElement('div'); el.className='week-ev ev-'+ev.category;
        el.style.top=topPx+'px';
        el.style.height=heightPx+'px';
        el.style.left=`calc(${left}% + 3px)`;
        el.style.right='auto';
        el.style.width=`calc(${width}% - 6px)`;
        const title=document.createElement('div'); title.className='week-ev-title'; title.innerHTML=`<strong>${ev.title}</strong>`;
        const time=document.createElement('div'); time.className='week-ev-time'; time.textContent=fmtTime(st)+'–'+fmtTime(en);
        el.appendChild(title); if(heightPx>30) el.appendChild(time);
        el.onclick=()=>openModal(ev); col.appendChild(el);
      });
    });
    grid.appendChild(col);
  });
}

function fmtTime(d) {
  let h=d.getHours(), mi=d.getMinutes(), ampm=h>=12?'pm':'am';
  h=h%12||12;
  return h+(mi?':'+String(mi).padStart(2,'0'):'')+ampm;
}

// ─── DAY POPUP ────────────────────────────────────────────────────────────────
function openDayPopup(dayEvs, date) {
  const overlay=document.getElementById('modalOverlay');
  const cat=document.getElementById('modalCategory'), title=document.getElementById('modalTitle');
  const body=document.querySelector('.modal-body'), footer=document.getElementById('modalLinkArea');
  cat.textContent=date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  cat.style.background='var(--accent-light)'; cat.style.color='var(--accent)';
  title.textContent='All Classes'; footer.innerHTML=''; body.innerHTML='';
  window._dayEvs=dayEvs; window._dayDate=date;
  dayEvs.forEach(ev => {
    const row=document.createElement('div');
    row.style.cssText='padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px;';
    row.innerHTML=`<span style="width:8px;height:8px;border-radius:2px;flex-shrink:0;background:var(--${ev.category==='common'?'common':ev.category==='finance'?'finance':ev.category==='marketing'?'marketing':'supplychain'})"></span>
      <div><div style="font-weight:500;font-size:14px;">${ev.title}</div>
      <div style="font-size:12px;color:var(--text-muted)">${fmtTime(new Date(ev.start))} – ${fmtTime(new Date(ev.end))}</div></div>`;
    row.onclick=()=>openModal(ev,true,dayEvs,date);
    body.appendChild(row);
  });
  overlay.classList.add('open');
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(ev, fromDayPopup, dayEvs, date) {
  const catColors = {
    common:{bg:'var(--common-bg)',color:'var(--common)',label:'Core – All Students'},
    finance:{bg:'var(--finance-bg)',color:'var(--finance)',label:'Finance'},
    marketing:{bg:'var(--marketing-bg)',color:'var(--marketing)',label:'Marketing'},
    supplychain:{bg:'var(--supplychain-bg)',color:'var(--supplychain)',label:'Supply Chain'}
  };
  const specLabels={common:'Core (all students)',finance:'Finance',marketing:'Marketing',supplychain:'Supply Chain'};
  const cc=catColors[ev.category]||catColors.common;
  const cat=document.getElementById('modalCategory');
  cat.textContent=cc.label; cat.style.background=cc.bg; cat.style.color=cc.color;
  document.getElementById('modalTitle').textContent=ev.title;
  document.querySelector('.modal-body').innerHTML=`
    <div class="modal-row"><span class="modal-icon">📅</span><div><div class="modal-row-label" id="modalDate"></div></div></div>
    <div class="modal-row"><span class="modal-icon">🕐</span><div><div class="modal-row-label" id="modalTime"></div></div></div>
    <div class="modal-row"><span class="modal-icon">🎓</span><div><div class="modal-row-label">Specialization</div><div class="modal-row-sub" id="modalSpecialization"></div></div></div>
    <div class="modal-row" id="modalLocationRow" style="display:none"><span class="modal-icon">📍</span><div><div class="modal-row-label" id="modalLocation"></div></div></div>
    <div class="modal-row" id="modalDescRow" style="display:none"><span class="modal-icon">📝</span><div><div class="modal-row-label" id="modalDesc"></div></div></div>`;
  const d=new Date(ev.start);
  document.getElementById('modalDate').textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('modalTime').textContent=fmtTime(new Date(ev.start))+' – '+fmtTime(new Date(ev.end));
  document.getElementById('modalSpecialization').textContent=specLabels[ev.category]||'Core (all students)';
  const locRow=document.getElementById('modalLocationRow');
  if(ev.location){document.getElementById('modalLocation').textContent=ev.location;locRow.style.display='flex';}else{locRow.style.display='none';}
  const descRow=document.getElementById('modalDescRow');
  if(ev.description){document.getElementById('modalDesc').textContent=ev.description;descRow.style.display='flex';}else{descRow.style.display='none';}
  const linkArea=document.getElementById('modalLinkArea');
  let footer=ev.url?`<a class="modal-link" href="${ev.url}" target="_blank">&#x1F517; Join Online Class</a>`:'';
  if(fromDayPopup) footer+=`<button onclick="openDayPopup(window._dayEvs,window._dayDate)" style="margin-left:10px;padding:8px 16px;background:none;border:1.5px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;cursor:pointer;color:var(--text-secondary);">← Back</button>`;
  linkArea.innerHTML=footer;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e) {
  if (!e||e.target===document.getElementById('modalOverlay')||!e.target)
    document.getElementById('modalOverlay').classList.remove('open');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
const SESSION_DAYS = 2 / 1440; // 2 minutes for testing — change to e.g. 30 for production

const savedSection = localStorage.getItem('selectedSection');
const savedTime = localStorage.getItem('sectionTimestamp');
const sessionExpiry = SESSION_DAYS * 24 * 60 * 60 * 1000;
const sessionValid = savedTime && (Date.now() - parseInt(savedTime)) < sessionExpiry;

if (savedSection && sessionValid) {
  selectSection(savedSection);
} else {
  localStorage.removeItem('selectedSection');
  localStorage.removeItem('sectionTimestamp');
  document.title = 'Academic Hub';
  setFavicon('🎓');
  document.getElementById('portal-page').style.display = 'flex';
  document.getElementById('welcome-page').style.display = 'none';
  document.getElementById('calendar-app').style.display = 'none';
}

setInterval(autoSync, 5*60*1000);

// Session expiry checker — runs every 10 seconds
setInterval(() => {
  const t = localStorage.getItem('sectionTimestamp');
  const expiry = SESSION_DAYS * 24 * 60 * 60 * 1000;
  if (t && (Date.now() - parseInt(t)) >= expiry) {
    localStorage.removeItem('selectedSection');
    localStorage.removeItem('sectionTimestamp');
    document.title = 'Academic Hub';
    setFavicon('🎓');
    document.getElementById('calendar-app').style.display = 'none';
    document.getElementById('welcome-page').style.display = 'none';
    document.getElementById('portal-page').style.display = 'flex';
  }
}, 10 * 1000);

render();
