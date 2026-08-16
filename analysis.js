const counters = document.querySelectorAll("[data-count]");

const animateCount = (el) => {
  const target = Number(el.dataset.count);
  const started = performance.now();
  const duration = 900;

  const tick = (now) => {
    const t = Math.min(1, (now - started) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.4 }
  );
  counters.forEach((el) => io.observe(el));
} else {
  counters.forEach(animateCount);
}

function drawCurve() {
  const canvas = document.getElementById("curveChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = { l: 54, r: 24, t: 24, b: 42 };

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#14212c";
  ctx.fillRect(0, 0, w, h);

  const floors = 100;
  const points = [];
  for (let floor = 1; floor <= floors; floor += 1) {
    const speed = 78 + floor * 2.45;
    const gap = Math.max(64, Math.min(96, 96 - floor * 0.3));
    const width = Math.max(62, Math.min(134, 122 - floor * 0.45));
    points.push({ floor, speed, gap, width });
  }

  const xAt = (floor) => pad.l + ((floor - 1) / (floors - 1)) * (w - pad.l - pad.r);
  const yAt = (value, min, max) => {
    const t = (value - min) / (max - min);
    return pad.t + (1 - t) * (h - pad.t - pad.b);
  };

  ctx.strokeStyle = "rgba(247, 234, 210, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + ((h - pad.t - pad.b) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
  }

  const series = [
    { key: "speed", min: 70, max: 340, color: "#f0b43f" },
    { key: "gap", min: 50, max: 110, color: "#7de0d2" },
    { key: "width", min: 50, max: 150, color: "#f7ead2" },
  ];

  for (const s of series) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    points.forEach((p, i) => {
      const x = xAt(p.floor);
      const y = yAt(p[s.key], s.min, s.max);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.fillStyle = "#d8452d";
  const crackX = xAt(36);
  ctx.fillRect(crackX, pad.t, 2, h - pad.t - pad.b);
  ctx.font = "700 13px Trebuchet MS";
  ctx.fillText("36 层出现碎裂台", crackX + 8, pad.t + 16);

  ctx.fillStyle = "#f7ead2";
  ctx.font = "700 12px Trebuchet MS";
  ctx.fillText("1 层", pad.l, h - 16);
  ctx.textAlign = "right";
  ctx.fillText("100 层", w - pad.r, h - 16);
}

drawCurve();
window.addEventListener("resize", drawCurve);
