// 블로그 공통 스크립트: 코드 강조와 복사, 목차 표시, 글 종류 탭, 실시간 사무실.
if (window.hljs) window.hljs.highlightAll();

// 코드 블록 복사 버튼
document.querySelectorAll(".post-body pre").forEach((pre) => {
  const btn = document.createElement("button");
  btn.className = "copy-btn";
  btn.type = "button";
  btn.textContent = "복사";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
      btn.textContent = "복사됨";
    } catch {
      btn.textContent = "실패";
    }
    setTimeout(() => (btn.textContent = "복사"), 1500);
  });
  pre.appendChild(btn);
});

// 지금 읽는 부분의 목차 항목 표시
const tocLinks = new Map([...document.querySelectorAll(".toc-side a")].map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
if (tocLinks.size > 0 && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        tocLinks.forEach((a) => a.classList.remove("active"));
        tocLinks.get(entry.target.id)?.classList.add("active");
      }
    },
    { rootMargin: "0px 0px -70% 0px" },
  );
  document.querySelectorAll(".post-body h2[id], .post-body h3[id]").forEach((h) => observer.observe(h));
}

// 글 종류 탭
document.querySelectorAll(".tabs[aria-label='글 종류']").forEach((tabs) => {
  const list = tabs.nextElementSibling;
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    list?.querySelectorAll("li[data-type]").forEach((li) => {
      li.hidden = Boolean(btn.dataset.filter) && li.dataset.type !== btn.dataset.filter;
    });
  });
});

// ------------------------------------------------------------ 실시간 현황
// status.json: { updatedAt, agents: [{ id, state: "working"|"failed", room, since }], events: [{ at, text }] }
// 목록에 없는 에이전트는 휴게실에서 쉬는 중이다.
const STALE_MS = 15 * 60 * 1000;
const statusUrl = document.querySelector('meta[name="office-status"]')?.content;

const hhmm = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

async function fetchStatus() {
  if (!statusUrl) return null;
  try {
    const res = await fetch(`${statusUrl}${statusUrl.includes("?") ? "&" : "?"}t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data && Array.isArray(data.agents) ? data : null;
  } catch {
    return null;
  }
}

const listeners = [];
async function pollStatus() {
  const status = await fetchStatus();
  const stale = !status || Date.now() - new Date(status.updatedAt).getTime() > STALE_MS;
  for (const fn of listeners) fn(status, stale);
}

// 프로젝트 목록·상세: 불 켜진 방 표시
listeners.push((status, stale) => {
  const busy = new Set(stale || !status ? [] : status.agents.filter((a) => a.state === "working" && a.room).map((a) => a.room));
  document.querySelectorAll("[data-room]").forEach((el) => {
    const on = busy.has(el.dataset.room);
    el.classList.toggle("lit", on);
    el.querySelectorAll(".now-tag").forEach((t) => (t.hidden = !on));
  });
  document.querySelectorAll(".now-live").forEach((t) => (t.hidden = !busy.has(document.querySelector(".big-room")?.dataset.room)));
});

// 에이전트 팀: 지금 있는 곳
listeners.push((status, stale) => {
  const byId = new Map(stale || !status ? [] : status.agents.map((a) => [a.id, a]));
  const names = JSON.parse(document.getElementById("room-names")?.textContent ?? "{}");
  document.querySelectorAll("[data-agent]").forEach((card) => {
    const a = byId.get(card.dataset.agent);
    const st = card.querySelector(".st");
    if (!st) return;
    st.classList.toggle("on", a?.state === "working");
    st.classList.toggle("fail", a?.state === "failed");
    st.textContent = !a ? "휴게실" : a.state === "failed" ? "실패, 다시 시도 예정" : names[a.room] ?? "작업 중";
  });
});

// 홈: 픽셀 사무실
const officeData = document.getElementById("office-data");
if (officeData) {
  const data = JSON.parse(officeData.textContent);
  const svg = document.getElementById("office");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mk = (p, n, a = {}, t) => {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    if (t != null) e.textContent = t;
    p.appendChild(e);
    return e;
  };
  const SPR = [[2,0,"h"],[3,0,"h"],[4,0,"h"],[1,1,"h"],[2,1,"h"],[3,1,"h"],[4,1,"h"],[5,1,"h"],[1,2,"s"],[2,2,"e"],[3,2,"s"],[4,2,"e"],[5,2,"s"],[1,3,"s"],[2,3,"s"],[3,3,"s"],[4,3,"s"],[5,3,"s"],
    [0,4,"b"],[1,4,"b"],[2,4,"b"],[3,4,"b"],[4,4,"b"],[5,4,"b"],[6,4,"b"],[1,5,"b"],[2,5,"b"],[3,5,"b"],[4,5,"b"],[5,5,"b"],[1,6,"d"],[2,6,"d"],[4,6,"d"],[5,6,"d"]];

  const all = [...data.rooms, data.lounge];
  const roomById = Object.fromEntries(all.map((r) => [r.id, r]));
  mk(svg, "rect", { width: 380, height: data.height, fill: "#3b3950" });
  const els = {};
  for (const r of all) {
    const g = mk(svg, "g");
    mk(g, "rect", { x: r.x, y: r.y, width: r.w, height: r.h, fill: "#2b2a3a" });
    const fl = mk(g, "rect", { x: r.x + 4, y: r.y + 4, width: r.w - 8, height: r.h - 8, fill: "url(#tile-off)" });
    mk(g, "rect", { x: r.x + 4, y: r.y + 4, width: r.w - 8, height: 30, fill: "#cfc3a6" });
    mk(g, "rect", { x: r.x + 4, y: r.y + 4, width: 6, height: 30, fill: r.color });
    mk(g, "text", { x: r.x + 16, y: r.y + 20, style: "font:700 12px Galmuri11,sans-serif;fill:#2b2a3a" }, r.name);
    mk(g, "text", { x: r.x + 16, y: r.y + 31, style: "font:9px Galmuri11,sans-serif;fill:#5a5670" }, r.sub);
    const lamp = mk(g, "rect", { x: r.x + r.w - 20, y: r.y + 12, width: 9, height: 9, fill: "#7a7590" });
    if (r.id === "lounge") {
      mk(g, "rect", { x: r.x + 30, y: r.y + r.h - 30, width: 72, height: 15, fill: "#a5505a" });
      mk(g, "rect", { x: r.x + r.w - 102, y: r.y + r.h - 30, width: 72, height: 15, fill: "#a5505a" });
      mk(g, "rect", { x: r.x + r.w / 2 - 9, y: r.y + r.h - 36, width: 18, height: 24, fill: "#5c8a4a" });
    } else {
      const n = Math.max(1, Math.floor((r.w - 20) / 52));
      for (let i = 0; i < n; i++) {
        mk(g, "rect", { x: r.x + 18 + i * 52, y: r.y + r.h - 22, width: 30, height: 9, fill: "#8a6a4a" });
        mk(g, "rect", { x: r.x + 22 + i * 52, y: r.y + r.h - 30, width: 12, height: 8, fill: "#4a4760" });
      }
    }
    if (r.masked) mk(g, "rect", { x: r.x + 4, y: r.y + 34, width: r.w - 8, height: r.h - 38, fill: "#5a5670", opacity: 0.55 });
    if (r.href) {
      const a = mk(svg, "a", { href: r.href, "aria-label": `${r.name} 방 보기` });
      a.appendChild(g);
    }
    els[r.id] = { fl, lamp };
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const spot = (id) => {
    const r = roomById[id] ?? data.lounge;
    return [rnd(r.x + 20, r.x + r.w - 20), rnd(r.y + 56, r.y + r.h - 12)];
  };
  const bots = data.team.map((m) => {
    const wrap = mk(svg, "g"); // "일해!" 버튼으로 점프할 때 쓰는 바깥 그룹 (걷기 위치와 따로 움직임)
    const g = mk(wrap, "g");
    const f = { h: m.color, s: "#f6d5b5", e: "#2b2a3a", b: m.color, d: "#2b2a3a" };
    for (const [cx, cy, t] of SPR) mk(g, "rect", { x: cx * 3 - 10.5, y: cy * 3 - 21, width: 3, height: 3, fill: f[t] });
    const z = mk(g, "text", { x: 8, y: -18, style: "font:10px Galmuri11,monospace;fill:#fff" }, "z");
    const nm = mk(g, "text", { x: 0, y: 10, "text-anchor": "middle", style: "font:9px Galmuri11,monospace;fill:#fff;paint-order:stroke;stroke:#2b2a3a;stroke-width:2.5px" }, m.label ?? m.id);
    const [x, y] = spot("lounge");
    return { id: m.id, wrap, g, z, nm, room: "lounge", x, y, tx: x, ty: y, wait: rnd(0, 200) };
  });
  const byId = Object.fromEntries(bots.map((b) => [b.id, b]));

  let off = false;
  let connected = false;
  function place(b) {
    const rest = b.room === "lounge";
    b.g.setAttribute("transform", `translate(${Math.round(b.x / 3) * 3} ${Math.round(b.y / 3) * 3})`);
    b.z.style.display = rest ? "" : "none";
    b.nm.style.display = rest ? "none" : "";
  }
  listeners.push((status, stale) => {
    off = Boolean(status) && stale;
    connected = Boolean(status);
    const working = new Map((status && !stale ? status.agents : []).map((a) => [a.id, a]));
    for (const b of bots) {
      const a = working.get(b.id);
      const room = a && a.state === "working" && roomById[a.room] ? a.room : "lounge";
      if (room !== b.room) {
        b.room = room;
        [b.tx, b.ty] = spot(room);
        b.wait = 60;
      }
    }
    const busyRooms = new Set(bots.filter((b) => b.room !== "lounge").map((b) => b.room));
    for (const r of data.rooms) {
      els[r.id].fl.setAttribute("fill", !off && busyRooms.has(r.id) ? "url(#tile-lit)" : "url(#tile-off)");
      els[r.id].lamp.setAttribute("fill", !off && busyRooms.has(r.id) ? "#ffd866" : "#7a7590");
    }
    svg.style.filter = off ? "brightness(.5) saturate(.5)" : "";
    const head = document.getElementById("office-head");
    const clock = document.getElementById("office-clock");
    const say = document.getElementById("office-say");
    const n = bots.filter((b) => b.room !== "lounge").length;
    if (!status) {
      head.innerHTML = "<b>실시간 연결 준비 중</b>";
      clock.textContent = "";
    } else if (off) {
      head.innerHTML = "<b>노트북 꺼짐</b> 모두 퇴근했어요"; // 고정 문구
      clock.textContent = `마지막 신호 ${hhmm(status.updatedAt)}`;
    } else {
      const names = [...new Set(bots.filter((b) => b.room !== "lounge").map((b) => roomById[b.room].name))];
      head.replaceChildren();
      const b = document.createElement("b");
      b.textContent = n ? `${n}명` : "모두 쉬는 중";
      head.append(b, document.createTextNode(n ? ` 일하는 중 · ${names.join(", ")}` : ""));
      clock.textContent = `실시간 ${hhmm(status.updatedAt)}`;
    }
    const ev = status?.events?.[0];
    if (ev && say) {
      say.innerHTML = "";
      const small = document.createElement("small");
      small.textContent = hhmm(ev.at);
      say.append(small, document.createTextNode(ev.text));
    }
    if (reduce) bots.forEach((b) => ((b.x = b.tx), (b.y = b.ty), place(b)));
    renderWork();
  });

  // "일해!" 버튼: 쉬는 에이전트 몇 명이 차례로 핑계를 대고, 일하는 에이전트는 응원을 받는다.
  // 화면 효과일 뿐 진짜 에이전트에는 아무 영향이 없다.
  const EXCUSES = ["토큰 충전 중…", "컨텍스트 정리 중", "/compact 중이에요", "커피 한 잔만요", "리뷰 기다리는 중", "5분만요…", "어제 야근했어요", "테스트 돌리는 척", "회의 중(휴게실)", "plan 짜는 중이에요", "에러 원인 고민 중", "README 읽는 중"];
  const bubbles = new Set();
  const workRow = document.getElementById("work-row");
  let lastExcuses = [];
  let pending = []; // 지난 클릭이 예약한 핑계들: 다시 누르면 지우고 새로 시작
  function placeBubble(x) {
    const cx = Math.min(380 - x.w / 2 - 2, Math.max(x.w / 2 + 2, x.b.x));
    x.g.setAttribute("transform", `translate(${Math.round(cx)} ${Math.round(x.b.y - 30)})`);
  }
  function bubble(b, text, ms, fill = "#fff") {
    const g = mk(svg, "g");
    const w = Math.max(28, [...text].length * 9 + 12);
    mk(g, "rect", { x: -w / 2, y: -15, width: w, height: 17, fill, stroke: "#2b2a3a", "stroke-width": 2 });
    mk(g, "rect", { x: -3, y: 2, width: 6, height: 4, fill });
    mk(g, "text", { x: 0, y: -3, "text-anchor": "middle", style: "font:10px Galmuri11,sans-serif;fill:#2b2a3a" }, text);
    for (const old of bubbles) if (old.b === b) { old.g.remove(); bubbles.delete(old); } // 한 명당 말풍선 하나
    const x = { g, b, w };
    bubbles.add(x);
    placeBubble(x);
    setTimeout(() => { g.remove(); bubbles.delete(x); }, ms);
  }
  let shoutBox = null;
  function shout(text) {
    shoutBox?.remove();
    const L = data.lounge;
    const g = mk(svg, "g", { transform: `translate(${L.x + L.w / 2} ${L.y + 50})` });
    shoutBox = g;
    const w = [...text].length * 15 + 24;
    mk(g, "rect", { x: -w / 2, y: -20, width: w, height: 28, fill: "#ffd866", stroke: "#2b2a3a", "stroke-width": 3 });
    mk(g, "text", { x: 0, y: 0, "text-anchor": "middle", style: "font:700 16px Galmuri11,sans-serif;fill:#2b2a3a" }, text);
    setTimeout(() => g.remove(), 900);
  }
  function hop(b) {
    if (reduce || !b.wrap.animate) return;
    b.wrap.animate([{ transform: "translateY(0)" }, { transform: "translateY(-7px)" }, { transform: "translateY(0)" }], { duration: 450, iterations: 2, easing: "steps(3)" });
  }
  function renderWork() {
    if (!workRow) return;
    // 버튼은 늘 "일해!": 휴게실에서 쉬는 에이전트들에게 외치는 버튼이다.
    const working = bots.some((b) => b.room !== "lounge");
    workRow.hidden = false;
    document.getElementById("work-hint").textContent = !connected
      ? "다들 휴게실에 있어요. 한마디 해 주세요"
      : off ? "노트북이 꺼져 있어도 외쳐 볼 수는 있어요"
      : working ? "휴게실에 아직 쉬는 애들이 있네요. 한마디 해 주세요"
      : "불이 다 꺼져 있네요. 한마디 해 주세요";
  }
  document.getElementById("work-btn")?.addEventListener("click", () => {
    shout("일해!!");
    const resting = bots.filter((b) => b.room === "lounge").sort(() => Math.random() - 0.5).slice(0, 5);
    const pool = EXCUSES.filter((e) => !lastExcuses.includes(e)).sort(() => Math.random() - 0.5);
    pending.forEach(clearTimeout);
    lastExcuses = resting.map((_, i) => pool[i % pool.length]);
    pending = resting.map((b, i) => setTimeout(() => {
      bubble(b, lastExcuses[i], 1300);
      hop(b);
    }, 300 + i * 650));
  });
  renderWork();

  bots.forEach(place);
  if (!reduce) {
    const step = () => {
      for (const b of bots) {
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          const s = Math.min(d, b.room === "lounge" ? 0.5 : 1.1);
          b.x += (dx / d) * s;
          b.y += (dy / d) * s;
        } else if (--b.wait <= 0 && !off) {
          [b.tx, b.ty] = spot(b.room);
          b.wait = b.room === "lounge" ? rnd(200, 500) : rnd(60, 160);
        }
        place(b);
      }
      bubbles.forEach(placeBubble);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

if (listeners.length) {
  pollStatus();
  setInterval(pollStatus, 60 * 1000);
}

// 고치기 링크: 블로그 주소에 ?edit=on(또는 ?edit=<포트>)을 붙여 한 번 열면 이 브라우저에만 기억하고,
// 글마다 내 노트북의 관리 화면(maxpolio site admin)으로 가는 링크를 붙인다. ?edit=off로 끈다.
// 방문자 브라우저에는 아무것도 붙지 않고, 공개 사이트에는 쓰기 기능이 없다.
(() => {
  const KEY = "maxpolio-edit-port";
  if (document.querySelector('meta[name="admin-token"]')) return; // 관리 화면 자체에서는 필요 없음
  let port = null;
  try {
    const url = new URL(location.href);
    const flag = url.searchParams.get("edit");
    if (flag !== null) {
      if (flag === "off") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, /^\d{2,5}$/.test(flag) ? flag : "4174");
      url.searchParams.delete("edit");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    port = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!port || !/^\d{2,5}$/.test(port)) return;
  const brand = document.querySelector(".brand");
  if (!brand) return;
  const base = new URL(brand.href).pathname;
  const adminUrl = (pathname, hash) => `http://127.0.0.1:${port}/${pathname.startsWith(base) ? pathname.slice(base.length) : ""}#${hash}`;
  const link = (pathname, hash = "edit") => {
    const a = document.createElement("a");
    a.className = "edit-link";
    a.href = adminUrl(pathname, hash);
    a.textContent = "고치기";
    a.title = "내 노트북의 관리 화면에서 고치기 (maxpolio site admin을 먼저 켜 두세요)";
    return a;
  };
  document.querySelectorAll(".post-cards li").forEach((li) => {
    const a = li.querySelector(".post-link");
    if (a) li.append(link(new URL(a.href).pathname));
  });
  const title = document.querySelector(".post-header .h1");
  if (title) title.append(link(location.pathname));
  const intro = document.querySelector(".intro h1");
  if (intro) intro.append(link(location.pathname, "edit-intro"));
})();
