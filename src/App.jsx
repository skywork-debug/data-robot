import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Instagram,
  Youtube,
  MessageCircle,
  Clapperboard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";

/* ============================================================
   DATA LAYER — 這一區之後直接替換成你的真實資料

   brand.platforms    → 每日累積粉絲/好友數（用來畫成長趨勢＋平台卡片）
   brand.postRecords  → 每一則貼文的紀錄（平台／類型／標題／成效數據／
                         狀態／發布日期），用來畫「每日貼文紀錄」的
                         長條圖與一覽表。

   ⚠️ 「更新」按鈕：
   目前 handleRefresh() 只是模擬每天拉一次最新數字（示意用途）。
   等你把 Apps Script Web App 網址接好之後，把 handleRefresh 內的
   模擬邏輯換成 fetch(DATA_SOURCE_URL) 抓真實資料、更新 brandsData
   即可，按鈕、loading 狀態、最後更新時間都不用改。
   ============================================================ */

const DATA_SOURCE_URL = "https://script.google.com/macros/s/AKfycbwxQ8qqRmLH2EAmUWyoLZW3YHas4gn3NGs7Ss0fGzi_Pltjd-zdP-9ASWFAjSjU6zxS/exec";

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOTAL_DAYS = 120;

function generateSeries({ seed, start, dailyGrowth, amplitude, spikeChance, days = TOTAL_DAYS }) {
  const rand = mulberry32(seed);
  const out = [];
  let value = start;
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const weekday = date.getDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.6 : 1;
    let delta = dailyGrowth * weekendDip + Math.sin(i / 7) * amplitude + (rand() - 0.45) * amplitude;
    if (rand() < spikeChance) delta += dailyGrowth * (6 + rand() * 10);
    value = Math.max(0, value + delta);
    out.push({ date: date.toISOString().slice(0, 10), value: Math.round(value) });
  }
  return out;
}

const PLATFORM_META = {
  instagram: { label: "Instagram", icon: Instagram, color: null }, // null = 用品牌色
  youtube: { label: "YouTube", icon: Youtube, color: "#C79A2E" },
  line: { label: "LINE 官方帳號", icon: MessageCircle, color: "#5A8AA6" },
};

const CONTENT_TYPES = {
  post: { label: "IG 貼文", platform: "Instagram", icon: Instagram, color: "#C1552E" },
  reels: { label: "IG Reels", platform: "Instagram", icon: Clapperboard, color: "#E39A67" },
  shorts: { label: "YouTube Shorts", platform: "YouTube", icon: Youtube, color: "#C79A2E" },
  line: { label: "LINE 推播", platform: "LINE", icon: MessageCircle, color: "#5A8AA6" },
};

const TITLE_POOL = {
  eli: {
    post: ["這樣設停損,你永遠設不對", "破框前的訊號,你看懂了嗎", "對帳單公開:這週的三筆交易", "新手最常犯的三個進場錯誤", "倉位控制,比你想的更重要"],
    reels: ["穿框強攻的瞬間,我在想什麼", "回撤發生時,我做了這件事", "30 秒看懂今天的盤勢", "滾倉這樣做,風險反而更低", "破框系統,現場拆解一次"],
    shorts: ["三分鐘搞懂空間式交易", "破框策略入門,一次講完", "我為什麼不追高", "止盈點怎麼設才合理"],
    line: ["【重要通知】課程開放報名", "本週盤勢速報,先看再進場", "限時名額釋出中", "伊萊親自回覆你的問題"],
  },
  sky: {
    post: ["三破策略是什麼?一次搞懂", "課程學員的真實回饋", "投資新手的第一堂課", "財商教育,從這裡開始", "破型出現時該怎麼判斷"],
    reels: ["60 秒學會三破系統", "破浪出現的那一刻", "老師親自示範一次操作", "學員問答:破均怎麼看"],
    shorts: ["新手必看:三破策略入門", "破型破浪破均,差在哪"],
    line: ["【課程開放】限額招生中", "本週財經重點整理", "講座報名倒數中", "老師的每週一句話"],
  },
  eric: {
    post: ["這堂課學員最想知道的事", "交易心理學,你懂多少", "市場波動時該怎麼做", "新手常見的五個誤區"],
    reels: ["Eric 現場講解一次", "30 秒建立正確心態", "這個觀念,很多人搞錯"],
    shorts: ["交易心理速成班", "三分鐘建立正確心態"],
    line: ["【開課通知】名額有限", "本週學習重點整理", "Eric 的每週提醒"],
  },
};

function metricsForType(type, rand, lineBaseReach) {
  const r = (min, max) => min + rand() * (max - min);
  switch (type) {
    case "post": {
      const views = r(800, 4000);
      const likes = views * r(0.04, 0.09);
      return {
        views: Math.round(views),
        likes: Math.round(likes),
        comments: Math.round(likes * r(0.05, 0.15)),
        shares: Math.round(likes * r(0.03, 0.11)),
        saves: Math.round(likes * r(0.08, 0.23)),
        reach: Math.round(views * r(1.05, 1.3)),
      };
    }
    case "reels": {
      const views = r(3000, 40000);
      const likes = views * r(0.03, 0.08);
      return {
        views: Math.round(views),
        likes: Math.round(likes),
        comments: Math.round(likes * r(0.03, 0.11)),
        shares: Math.round(likes * r(0.05, 0.2)),
        saves: Math.round(likes * r(0.06, 0.18)),
        reach: Math.round(views * r(1.0, 1.15)),
      };
    }
    case "shorts": {
      const views = r(2000, 30000);
      const likes = views * r(0.02, 0.06);
      return {
        views: Math.round(views),
        likes: Math.round(likes),
        comments: Math.round(likes * r(0.04, 0.14)),
        shares: Math.round(likes * r(0.02, 0.08)),
        saves: Math.round(views * r(0.005, 0.015)),
        reach: Math.round(views * r(1.0, 1.1)),
      };
    }
    case "line":
    default: {
      const reach = Math.round(lineBaseReach * r(0.92, 1.02));
      const views = Math.round(reach * r(0.35, 0.7));
      return { views, likes: null, comments: null, shares: null, saves: null, reach };
    }
  }
}

function generatePostRecords({ seed, brandId, typeProbabilities, lineBaseReach, days = TOTAL_DAYS }) {
  const rand = mulberry32(seed);
  const today = new Date();
  const records = [];
  const pool = TITLE_POOL[brandId];
  let idCounter = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);

    Object.keys(CONTENT_TYPES).forEach((type) => {
      if (rand() < typeProbabilities[type]) {
        const titles = pool[type];
        const title = titles[Math.floor(rand() * titles.length)];
        const metrics = metricsForType(type, rand, lineBaseReach);
        const takenDown = type !== "line" && rand() < 0.06;
        idCounter += 1;
        records.push({
          id: `${brandId}-${type}-${idCounter}`,
          date: iso,
          platform: CONTENT_TYPES[type].platform,
          type,
          title,
          status: type === "line" ? "已發送" : takenDown ? "已下架" : "已發佈",
          ...metrics,
        });
      }
    });
  }
  return records;
}

const INITIAL_BRANDS = [
  {
    id: "eli",
    name: "ELI",
    accent: "#C1552E",
    accentSoft: "rgba(193,85,46,0.12)",
    platforms: {
      instagram: generateSeries({ seed: 11, start: 8200, dailyGrowth: 14, amplitude: 10, spikeChance: 0.05 }),
      youtube: generateSeries({ seed: 23, start: 3100, dailyGrowth: 9, amplitude: 8, spikeChance: 0.04 }),
      line: generateSeries({ seed: 37, start: 2600, dailyGrowth: 11, amplitude: 6, spikeChance: 0.06 }),
    },
    postRecords: generatePostRecords({
      seed: 411,
      brandId: "eli",
      typeProbabilities: { post: 0.28, reels: 0.5, shorts: 0.22, line: 0.4 },
      lineBaseReach: 2600,
    }),
  },
  {
    id: "sky",
    name: "SKY",
    accent: "#1B8F82",
    accentSoft: "rgba(27,143,130,0.12)",
    platforms: {
      instagram: generateSeries({ seed: 51, start: 5400, dailyGrowth: 10, amplitude: 9, spikeChance: 0.05 }),
      youtube: generateSeries({ seed: 62, start: 1800, dailyGrowth: 5, amplitude: 5, spikeChance: 0.03 }),
      line: generateSeries({ seed: 73, start: 4100, dailyGrowth: 13, amplitude: 7, spikeChance: 0.07 }),
    },
    postRecords: generatePostRecords({
      seed: 511,
      brandId: "sky",
      typeProbabilities: { post: 0.32, reels: 0.4, shorts: 0.18, line: 0.35 },
      lineBaseReach: 4100,
    }),
  },
  {
    id: "eric",
    name: "Eric",
    accent: "#4A4E9C",
    accentSoft: "rgba(74,78,156,0.12)",
    platforms: {
      instagram: generateSeries({ seed: 91, start: 2100, dailyGrowth: 6, amplitude: 6, spikeChance: 0.04 }),
      youtube: generateSeries({ seed: 82, start: 2600, dailyGrowth: 8, amplitude: 6, spikeChance: 0.05 }),
      line: generateSeries({ seed: 77, start: 900, dailyGrowth: 4, amplitude: 3, spikeChance: 0.03 }),
    },
    postRecords: generatePostRecords({
      seed: 611,
      brandId: "eric",
      typeProbabilities: { post: 0.2, reels: 0.3, shorts: 0.28, line: 0.22 },
      lineBaseReach: 900,
    }),
  },
];

// 總覽頁分頁順序：總覽在最前面，接著 SKY 放在品牌分頁最左邊
const TAB_ORDER = ["overview", "sky", "eli", "eric"];

/* ============================================================
   日期 / 聚合工具
   ============================================================ */

const RANGES = [
  { id: "day", label: "日" },
  { id: "week", label: "週" },
  { id: "month", label: "月" },
];

const TODAY = new Date();
const DATA_MIN_DATE = new Date(TODAY);
DATA_MIN_DATE.setDate(TODAY.getDate() - (TOTAL_DAYS - 1));
const DATA_MIN_STR = DATA_MIN_DATE.toISOString().slice(0, 10);
const DATA_MAX_STR = TODAY.toISOString().slice(0, 10);

function isoDaysAgo(n) {
  const d = new Date(TODAY);
  d.setDate(TODAY.getDate() - (n - 1));
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { id: "today", label: "今天", start: DATA_MAX_STR },
  { id: "7", label: "近 7 天", start: isoDaysAgo(7) },
  { id: "30", label: "近 30 天", start: isoDaysAgo(30) },
  { id: "90", label: "近 90 天", start: isoDaysAgo(90) },
  { id: "all", label: "全部", start: DATA_MIN_STR },
];

function filterByDateRange(series, start, end) {
  return series.filter((d) => d.date >= start && d.date <= end);
}

function aggregateSnapshot(series, range) {
  if (range === "day") return series;
  const bucketSize = range === "week" ? 7 : 30;
  const buckets = [];
  for (let i = series.length; i > 0; i -= bucketSize) {
    const chunk = series.slice(Math.max(0, i - bucketSize), i);
    if (chunk.length === 0) continue;
    buckets.unshift({ date: chunk[chunk.length - 1].date, value: chunk[chunk.length - 1].value });
  }
  return buckets;
}

function buildDailyCounts(records, start, end) {
  const map = {};
  records.forEach((r) => {
    if (!map[r.date]) map[r.date] = { post: 0, reels: 0, shorts: 0, line: 0 };
    map[r.date][r.type] += 1;
  });
  const out = [];
  const cursor = new Date(start);
  const endD = new Date(end);
  while (cursor <= endD) {
    const iso = cursor.toISOString().slice(0, 10);
    const counts = map[iso] || { post: 0, reels: 0, shorts: 0, line: 0 };
    out.push({ date: iso, ...counts });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function aggregateSumMulti(rows, range, keys) {
  if (range === "day") return rows;
  const bucketSize = range === "week" ? 7 : 30;
  const buckets = [];
  for (let i = rows.length; i > 0; i -= bucketSize) {
    const chunk = rows.slice(Math.max(0, i - bucketSize), i);
    if (chunk.length === 0) continue;
    const sums = {};
    keys.forEach((k) => (sums[k] = chunk.reduce((a, r) => a + r[k], 0)));
    buckets.unshift({ date: chunk[chunk.length - 1].date, ...sums });
  }
  return buckets;
}

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("zh-TW");
}

function fmtDateShort(iso) {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

function fmtTime(date) {
  return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function formatK(n) {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return fmt(n);
}

// 把一條逐日快照數列轉成「每日新增數」(逐日 delta),用來畫新增人數變化的折線圖
function dailyDeltaSeries(fullSeries, start, end) {
  const deltas = [];
  for (let i = 1; i < fullSeries.length; i++) {
    deltas.push({ date: fullSeries[i].date, value: fullSeries[i].value - fullSeries[i - 1].value });
  }
  return deltas.filter((d) => d.date >= start && d.date <= end);
}

// 產生「間距 5」的 Y 軸刻度(資料範圍變大時自動放寬到 10 / 20 / 50 一階,避免刻度太密)
function niceStepTicks(maxValue) {
  let step = 5;
  if (maxValue > 60) step = 10;
  if (maxValue > 150) step = 20;
  if (maxValue > 400) step = 50;
  const top = Math.max(step, Math.ceil((maxValue || 1) / step) * step);
  const ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return ticks;
}

// 貼文狀態顏色判斷：
// - 相容示意資料的「已發佈」「已發送」
// - 也相容真實 Apps Script 回傳的「OK」開頭(成功)、「錯誤」開頭(失敗)
function getStatusClass(status) {
  var s = status || "";
  if (s === "已發佈") return "live";
  if (s === "已發送") return "sent";
  if (s.indexOf("OK") === 0) return "live";
  if (s.indexOf("錯誤") === 0) return "down";
  return "down";
}

function pctDelta(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function formatPct(p) {
  if (p >= 10) return `${p.toFixed(0)}%`;
  if (p >= 0.1) return `${p.toFixed(1)}%`;
  return `${p.toFixed(2)}%`;
}

// 取得「往前推算」的同長度區間，用來當總覽頁 KPI 的比較基準（較前期）
function shiftRangeBack(start, end) {
  const startD = new Date(start);
  const endD = new Date(end);
  const days = Math.round((endD - startD) / 86400000) + 1;
  const prevEnd = new Date(startD);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  const clampStr = (d) => {
    const s = d.toISOString().slice(0, 10);
    return s < DATA_MIN_STR ? DATA_MIN_STR : s;
  };
  return { start: clampStr(prevStart), end: prevEnd.toISOString().slice(0, 10) };
}

// 漏斗形狀寬度改用固定遞減值,做出倒金字塔的視覺感,不跟真實數字比例綁定
// (四個階段的數字量級差異太大,照比例畫寬度反而會看不清楚)
const FUNNEL_SHAPE_WIDTHS = [100, 76, 54, 34];

// 轉換漏斗視覺用色階(由深到淺,呈現由上到下收斂的感覺)
const FUNNEL_COLORS = ["#2E4456", "#3F5D74", "#547B92", "#79A0B4"];

// 計算單一漏斗梯形區塊的 clip-path(上寬 top%、下寬 bottom%,置中收斂)
function funnelClipPath(top, bottom) {
  const topLeft = (100 - top) / 2;
  const topRight = 100 - topLeft;
  const bottomLeft = (100 - bottom) / 2;
  const bottomRight = 100 - bottomLeft;
  return `polygon(${topLeft}% 0%, ${topRight}% 0%, ${bottomRight}% 100%, ${bottomLeft}% 100%)`;
}
function computeRangeTotals(brandsList, start, end) {
  let totalReach = 0;
  let totalLineAdd = 0;
  let totalFollowerAdd = 0;
  const perBrandLineAdd = {};
  brandsList.forEach((b) => {
    const igSeries = filterByDateRange(b.platforms.instagram, start, end);
    const ytSeries = filterByDateRange(b.platforms.youtube, start, end);
    const lineSeries = filterByDateRange(b.platforms.line, start, end);
    const igAdd = (igSeries[igSeries.length - 1]?.value ?? 0) - (igSeries[0]?.value ?? 0);
    const ytAdd = (ytSeries[ytSeries.length - 1]?.value ?? 0) - (ytSeries[0]?.value ?? 0);
    const lineAdd = (lineSeries[lineSeries.length - 1]?.value ?? 0) - (lineSeries[0]?.value ?? 0);
    totalFollowerAdd += igAdd + ytAdd;
    totalLineAdd += lineAdd;
    perBrandLineAdd[b.id] = lineAdd;

    const recordsInR = b.postRecords.filter((r) => r.date >= start && r.date <= end);
    totalReach += recordsInR.reduce((a, r) => a + (r.reach || 0), 0);
  });
  return { totalReach, totalLineAdd, totalFollowerAdd, perBrandLineAdd };
}

/* ============================================================
   UI
   ============================================================ */

export default function GrowthLedgerDashboard() {
  const [brandsData, setBrandsData] = useState(INITIAL_BRANDS);
  const [activeTab, setActiveTab] = useState("overview");
  const [range, setRange] = useState("day");
  const [preset, setPreset] = useState("30");
  const [dateRange, setDateRange] = useState({ start: isoDaysAgo(30), end: DATA_MAX_STR });
  const [activeTypes, setActiveTypes] = useState(new Set(Object.keys(CONTENT_TYPES)));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  // 品牌分頁內容（總覽頁不用單一品牌，但底下 hooks 需要一個有效的 brand 物件）
  const brand = brandsData.find((b) => b.id === activeTab) || brandsData[0];
  const isOverview = activeTab === "overview";

  const applyPreset = (p) => {
    setPreset(p.id);
    setDateRange({ start: p.start, end: DATA_MAX_STR });
  };

  const handleCustomDate = (field, value) => {
    setPreset("custom");
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const toggleType = (key) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 每天按一次，拉最新的一天數字進來。
  // 目前是示意版：模擬今天的粉絲數有小幅變動。
  // 等 DATA_SOURCE_URL 接好之後，把下面 setTimeout 整段換成：
  //   const res = await fetch(DATA_SOURCE_URL);
  //   const json = await res.json();
  //   setBrandsData(prev => prev.map(b => ({ ...b, platforms: json[b.id]?.platforms ?? b.platforms, postRecords: json[b.id]?.postRecords ?? b.postRecords })));
  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    setTimeout(() => {
      if (DATA_SOURCE_URL) {
        fetch(DATA_SOURCE_URL)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then((json) => {
            setBrandsData((prev) =>
              prev.map((b) => {
                const incoming = json[b.id];
                if (!incoming) return b;
                const mergedPlatforms = {};
                Object.keys(b.platforms).forEach((key) => {
                  mergedPlatforms[key] = (incoming.platforms && incoming.platforms[key]) || [];
                });
                return {
                  ...b,
                  platforms: mergedPlatforms,
                  postRecords: (incoming.postRecords || []).map((r, i) => ({
                    id: r.id || `${b.id}-${r.date}-${r.platform}-${r.type}-${i}`,
                    ...r,
                  })),
                };
              })
            );
            setFetchError(null);
            setLastUpdated(new Date());
          })
          .catch((err) => {
            // 串接失敗時不要假裝成功：不更新「最後更新」時間，並在畫面上顯示錯誤
            console.error("拉取 DATA_SOURCE_URL 失敗:", err);
            setFetchError(err.message || "資料拉取失敗");
          })
          .finally(() => {
            setIsRefreshing(false);
          });
        return;
      }

      // 示意版：讓今天的粉絲數小幅往上跳動,模擬「拉到新資料」
      setBrandsData((prev) =>
        prev.map((b) => {
          const platforms = {};
          Object.entries(b.platforms).forEach(([key, series]) => {
            const nextSeries = [...series];
            const last = nextSeries[nextSeries.length - 1];
            nextSeries[nextSeries.length - 1] = { ...last, value: last.value + Math.round(4 + Math.random() * 30) };
            platforms[key] = nextSeries;
          });
          return { ...b, platforms };
        })
      );
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 700);
  };

  // 網站一打開就自動抓一次最新資料（僅在 DATA_SOURCE_URL 已設定時執行）
  useEffect(() => {
    if (DATA_SOURCE_URL) handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const platformSeries = useMemo(() => {
    const entries = Object.entries(brand.platforms).map(([key, series]) => [
      key,
      aggregateSnapshot(filterByDateRange(series, dateRange.start, dateRange.end), range),
    ]);
    return Object.fromEntries(entries);
  }, [brand, range, dateRange]);

  const combinedChart = useMemo(() => {
    const dates = platformSeries.instagram.map((d) => d.date);
    return dates.map((date, i) => ({
      date: fmtDateShort(date),
      instagram: platformSeries.instagram[i]?.value ?? null,
      youtube: platformSeries.youtube[i]?.value ?? null,
      line: platformSeries.line[i]?.value ?? null,
    }));
  }, [platformSeries]);

  const totals = useMemo(() => {
    const keys = Object.keys(brand.platforms);
    let current = 0;
    let previous = 0;
    let best = { key: keys[0], delta: -Infinity };
    keys.forEach((key) => {
      const s = platformSeries[key];
      const cur = s[s.length - 1]?.value ?? 0;
      const prev = s[0]?.value ?? cur;
      current += cur;
      previous += prev;
      const delta = cur - prev;
      if (delta > best.delta) best = { key, delta };
    });
    return { current, previous, growth: current - previous, best };
  }, [brand, platformSeries]);

  const growthPct = totals.previous > 0 ? (totals.growth / totals.previous) * 100 : 0;
  const isUp = totals.growth >= 0;

  const recordsInRange = useMemo(
    () => brand.postRecords.filter((r) => r.date >= dateRange.start && r.date <= dateRange.end),
    [brand, dateRange]
  );

  // 區間內：觀看數/讚數/留言數最高的貼文各一則（LINE 推播沒有讚/留言，自然不會被選中）
  const topPosts = useMemo(() => {
    const pickTop = (key) => {
      const candidates = recordsInRange.filter((r) => r[key] != null);
      if (candidates.length === 0) return null;
      return candidates.reduce((best, r) => (r[key] > best[key] ? r : best), candidates[0]);
    };
    return {
      views: pickTop("views"),
      likes: pickTop("likes"),
      comments: pickTop("comments"),
    };
  }, [recordsInRange]);

  const typeTotals = useMemo(() => {
    const acc = { post: 0, reels: 0, shorts: 0, line: 0 };
    recordsInRange.forEach((r) => (acc[r.type] += 1));
    return acc;
  }, [recordsInRange]);

  const dailyCounts = useMemo(
    () => buildDailyCounts(recordsInRange, dateRange.start, dateRange.end),
    [recordsInRange, dateRange]
  );

  const typeKeys = Object.keys(CONTENT_TYPES);
  const activeTypeKeys = typeKeys.filter((k) => activeTypes.has(k));

  const postsChart = useMemo(() => {
    return aggregateSumMulti(dailyCounts, range, typeKeys).map((row) => ({
      ...row,
      dateRaw: row.date,
      date: fmtDateShort(row.date),
      total: typeKeys.reduce((a, k) => a + (activeTypes.has(k) ? row[k] : 0), 0),
    }));
  }, [dailyCounts, range, activeTypes]);

  const filteredRecords = useMemo(
    () =>
      [...recordsInRange]
        .filter((r) => activeTypes.has(r.type))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [recordsInRange, activeTypes]
  );

  // 每天 LINE 好友數比前一天增加多少，只登記在「當天最新一篇貼文」上
  // （同一天有多篇時，其餘顯示「—」；沒有真實發布時間欄位，
  //   以資料原始順序中「當天最後出現的那筆」視為最新）
  const lineDeltaByDate = useMemo(() => {
    const series = brand.platforms.line || [];
    const deltaByDate = {};
    for (let i = 1; i < series.length; i++) {
      deltaByDate[series[i].date] = series[i].value - series[i - 1].value;
    }
    return deltaByDate;
  }, [brand]);

  const latestRecordIdByDate = useMemo(() => {
    const map = {};
    recordsInRange.forEach((r) => {
      map[r.date] = r.id; // 同一天內，後出現的會覆蓋前面的，留下「當天最後一筆」
    });
    return map;
  }, [recordsInRange]);

  // 總覽頁：跨三品牌彙總 KPI／疊圖趨勢／轉換漏斗／貢獻佔比／本月熱門貼文
  const orderedBrands = useMemo(
    () => TAB_ORDER.filter((id) => id !== "overview").map((id) => brandsData.find((b) => b.id === id)).filter(Boolean),
    [brandsData]
  );

  const overviewData = useMemo(() => {
    if (!isOverview) return null;

    const cur = computeRangeTotals(brandsData, dateRange.start, dateRange.end);
    const prevRange = shiftRangeBack(dateRange.start, dateRange.end);
    const prev = computeRangeTotals(brandsData, prevRange.start, prevRange.end);

    const conversionRate = cur.totalReach > 0 ? (cur.totalLineAdd / cur.totalReach) * 100 : 0;
    const prevConversionRate = prev.totalReach > 0 ? (prev.totalLineAdd / prev.totalReach) * 100 : 0;

    const kpis = [
      { label: "三品牌總觸及", value: formatK(cur.totalReach), deltaKind: "pct", delta: pctDelta(cur.totalReach, prev.totalReach) },
      {
        label: "追蹤數成長",
        value: `${cur.totalFollowerAdd >= 0 ? "+" : ""}${fmt(cur.totalFollowerAdd)}`,
        deltaKind: "num",
        delta: cur.totalFollowerAdd - prev.totalFollowerAdd,
      },
      {
        label: "LINE@ 新增好友",
        value: fmt(cur.totalLineAdd),
        deltaKind: "num",
        delta: cur.totalLineAdd - prev.totalLineAdd,
      },
      { label: "整體導流轉換率", value: `${conversionRate.toFixed(1)}%`, deltaKind: "pct", delta: pctDelta(conversionRate, prevConversionRate) },
    ];

    // LINE@ 新增好友趨勢：改成每個品牌一根長條，用目前選取的日期區間彙總,方便一眼比較誰比較高
    const trendChart = orderedBrands.map((b) => ({
      id: b.id,
      name: b.name,
      accent: b.accent,
      value: cur.perBrandLineAdd[b.id] || 0,
    }));

    // LINE@ 新增好友趨勢：依選取的日期區間,用「每天」的新增數畫成折線圖
    const dailyByBrand = orderedBrands.map((b) => ({
      brand: b,
      series: dailyDeltaSeries(b.platforms.line, dateRange.start, dateRange.end),
    }));
    const dayDates = dailyByBrand[0]?.series.map((row) => row.date) || [];
    const lineTrendChart = dayDates.map((date, i) => {
      const row = { date: fmtDateShort(date) };
      dailyByBrand.forEach(({ brand, series }) => {
        row[brand.id] = series[i]?.value ?? 0;
      });
      return row;
    });
    const lineTrendMax = Math.max(
      0,
      ...lineTrendChart.flatMap((row) => orderedBrands.map((b) => row[b.id] ?? 0))
    );
    const lineTrendTicks = niceStepTicks(lineTrendMax);

    return { kpis, trendChart, lineTrendChart, lineTrendTicks };
  }, [isOverview, brandsData, dateRange, range, orderedBrands]);

  // 成長轉換漏斗：貼文觸及 → 追蹤數新增 → 留言數新增 → LINE 好友新增
  // 跟上面 KPI 用同一組日期區間(dateRange),不再獨立篩選
  const funnelData = useMemo(() => {
    if (!isOverview) return null;
    const start = dateRange.start;
    const end = dateRange.end;

    let reach = 0;
    let followerAdd = 0;
    let commentAdd = 0;
    let lineAdd = 0;

    brandsData.forEach((b) => {
      b.postRecords
        .filter((r) => r.date >= start && r.date <= end && r.type !== "line")
        .forEach((r) => {
          reach += r.reach || 0;
          commentAdd += r.comments || 0;
        });

      const igSeries = filterByDateRange(b.platforms.instagram, start, end);
      const ytSeries = filterByDateRange(b.platforms.youtube, start, end);
      const lineSeries = filterByDateRange(b.platforms.line, start, end);
      followerAdd +=
        (igSeries[igSeries.length - 1]?.value ?? 0) - (igSeries[0]?.value ?? 0) +
        (ytSeries[ytSeries.length - 1]?.value ?? 0) - (ytSeries[0]?.value ?? 0);
      lineAdd += (lineSeries[lineSeries.length - 1]?.value ?? 0) - (lineSeries[0]?.value ?? 0);
    });

    const stages = [
      { label: "貼文觸及", value: reach },
      { label: "追蹤數新增", value: followerAdd },
      { label: "留言數新增", value: commentAdd },
      { label: "LINE 好友新增", value: lineAdd },
    ];
    const base = stages[0].value || 1;
    return stages.map((s) => ({
      ...s,
      pct: (s.value / base) * 100,
      width: Math.max(10, Math.min(100, Math.round((s.value / base) * 100))),
    }));
  }, [isOverview, brandsData, dateRange]);

  return (
    <div className="ledger-root" style={{ "--accent": brand.accent, "--accent-soft": brand.accentSoft }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&family=Noto+Sans+TC:wght@500;600;700&display=swap');

        .ledger-root {
          --ink: #1E2024;
          --ink-soft: #6B7178;
          --rule: rgba(20,22,26,0.10);
          --paper: linear-gradient(165deg, #FFFFFF, #F0F1F3);
          --up: #2F9E5D;
          --down: #C24A42;

          position: relative;
          background:
            radial-gradient(ellipse 100% 60% at 10% -10%, rgba(255,255,255,0.9), transparent 55%),
            radial-gradient(ellipse 80% 50% at 100% 110%, rgba(255,255,255,0.6), transparent 55%),
            linear-gradient(155deg, #E9EAEC 0%, #DBDDE1 45%, #ECEDEF 100%);
          font-family: 'Inter', 'Noto Sans TC', sans-serif;
          color: var(--ink);
          padding: 28px 20px 40px;
          min-height: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .ledger-root * { box-sizing: border-box; }

        .ledger-root::before {
          content: "";
          position: absolute;
          top: 0; left: -30%;
          width: 55%; height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.55) 48%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.55) 52%, transparent);
          animation: sweep 10s ease-in-out infinite;
          pointer-events: none;
          mix-blend-mode: soft-light;
        }
        @keyframes sweep {
          0% { transform: translateX(-10%); }
          55% { transform: translateX(220%); }
          100% { transform: translateX(220%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ledger-root::before { animation: none; display: none; }
        }

        .lg-header { margin-bottom: 20px; position: relative; z-index: 1; }
        .lg-eyebrow {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.18em;
          text-transform: uppercase; color: var(--ink-soft); margin: 0 0 8px;
        }
        .lg-title-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .lg-title {
          font-family: 'Space Grotesk', 'Noto Sans TC', sans-serif; font-weight: 700; font-size: 32px; margin: 0;
          letter-spacing: -0.01em; color: var(--ink);
        }

        .refresh-btn {
          display: flex; align-items: center; gap: 7px;
          font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 600;
          background: var(--ink); color: #F4F5F6; border: none;
          padding: 9px 18px; border-radius: 10px; cursor: pointer;
          box-shadow: 0 6px 16px -8px rgba(20,22,26,0.5);
          transition: opacity 0.2s ease;
        }
        .refresh-btn:disabled { opacity: 0.65; cursor: default; }
        .refresh-btn .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .last-updated {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft);
          margin-top: 6px; text-align: right;
        }

        .tab-row { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
        .tab-btn {
          font-family: 'Space Grotesk', 'Noto Sans TC', sans-serif; font-size: 14px; font-weight: 600;
          background: linear-gradient(180deg, #FFFFFF, #EFF0F2); color: var(--ink-soft);
          border: 1px solid var(--rule); padding: 10px 22px; border-radius: 10px; cursor: pointer;
          transition: all 0.2s ease; box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset;
        }
        .tab-btn.active { color: var(--accent); border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset, 0 4px 14px -6px var(--accent); }
        .tab-btn:hover:not(.active) { border-color: rgba(20,22,26,0.22); }

        .date-filter-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; position: relative; z-index: 1; }
        .date-presets { display: flex; gap: 6px; }
        .preset-btn {
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; border: 1px solid var(--rule);
          background: #FFFFFF; color: var(--ink-soft); padding: 6px 13px; border-radius: 999px; cursor: pointer;
        }
        .preset-btn.active { background: var(--ink); color: #F4F5F6; border-color: var(--ink); }
        .date-inputs { display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-soft); }
        .date-inputs input[type="date"] {
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; border: 1px solid var(--rule);
          background: #FFFFFF; color: var(--ink); padding: 6px 8px; border-radius: 7px;
        }

        .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 20px; position: relative; z-index: 1; }
        .kpi-row-4 { grid-template-columns: repeat(4, 1fr); }
        .delta-sub { color: var(--ink-soft); font-weight: 400; margin-left: 2px; }
        .kpi-card, .chart-card, .platform-card, .posts-card {
          background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; position: relative; overflow: hidden;
          box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 20px -14px rgba(20,22,26,0.35);
        }
        .kpi-card::after, .chart-card::after, .platform-card::after, .posts-card::after {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
        }
        .kpi-card { padding: 18px 20px; }
        .kpi-label { font-size: 11.5px; color: var(--ink-soft); letter-spacing: 0.03em; margin: 0 0 10px; }
        .kpi-value {
          font-family: 'IBM Plex Mono', monospace; font-size: 27px; font-weight: 600; font-variant-numeric: tabular-nums;
          margin: 0; display: flex; align-items: baseline; gap: 8px; color: var(--ink);
        }
        .kpi-delta { font-family: 'IBM Plex Mono', monospace; font-size: 13px; display: inline-flex; align-items: center; gap: 3px; font-weight: 500; }
        .kpi-delta.up { color: var(--up); }
        .kpi-delta.down { color: var(--down); }
        .kpi-best { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
        .kpi-best-icon {
          width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
          background: var(--accent-soft); color: var(--accent);
        }

        .controls-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 30px; margin-bottom: 10px; position: relative; z-index: 1; flex-wrap: wrap; gap: 10px;
        }
        .chart-heading { font-family: 'Space Grotesk', 'Noto Sans TC', sans-serif; font-size: 17px; font-weight: 600; margin: 0; color: var(--ink); }
        .range-toggle { display: flex; background: #FFFFFF; border: 1px solid var(--rule); border-radius: 999px; padding: 3px; gap: 2px; }
        .range-btn {
          font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; border: none; background: transparent;
          color: var(--ink-soft); padding: 6px 16px; border-radius: 999px; cursor: pointer; transition: all 0.2s ease;
        }
        .range-btn.active { background: var(--ink); color: #F4F5F6; }

        .chart-card { padding: 18px 18px 6px; position: relative; z-index: 1; }
        .legend-row { display: flex; gap: 18px; margin-bottom: 4px; font-size: 12px; color: var(--ink-soft); flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; }

        .platform-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; position: relative; z-index: 1; }
        .platform-card { padding: 16px 18px; }
        .platform-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .platform-icon {
          width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center;
          background: var(--accent-soft); color: var(--accent);
        }
        .platform-name { font-size: 13px; font-weight: 500; color: var(--ink); }
        .platform-value { font-family: 'IBM Plex Mono', monospace; font-size: 21px; font-weight: 600; margin: 0 0 2px; color: var(--ink); }

        .top-posts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 10px; position: relative; z-index: 1; }

        /* 總覽頁：轉換漏斗 + 貢獻佔比 兩欄並排 */
        .row-2col { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 14px; align-items: stretch; position: relative; z-index: 1; }
        .row-2col .chart-card { display: flex; flex-direction: column; height: 100%; }
        .row-2col .chart-card .chart-fill { flex: 1; min-height: 240px; }
        .split-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 14px; position: relative; z-index: 1; }
        .split-card { padding: 18px 20px; }

        .funnel-card-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
        .funnel-range-btns { display: flex; gap: 6px; }
        .funnel-connector {
          text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 12px;
          color: var(--ink-soft); padding: 2px 0 4px;
        }
        .funnel-visual { margin-top: 10px; }
        .funnel-segment { width: 100%; }
        .funnel-shape { width: 100%; height: 52px; }
        .funnel-text-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 8px 6px 16px; white-space: nowrap;
        }
        .funnel-label { font-size: 13px; color: var(--ink-soft); white-space: nowrap; }
        .funnel-value {
          font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 600;
          color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums;
        }

        .contrib-row { margin-bottom: 16px; }
        .contrib-row:last-child { margin-bottom: 0; }
        .contrib-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
        .contrib-name { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: var(--ink); }
        .contrib-pct { font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 600; color: var(--ink); }
        .contrib-track { height: 8px; border-radius: 999px; background: rgba(20,22,26,0.06); overflow: hidden; }
        .contrib-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }

        /* 本月熱門貼文 縮圖卡 */
        .thumb-card {
          background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden;
          box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 20px -14px rgba(20,22,26,0.35);
        }
        .thumb-placeholder {
          aspect-ratio: 4 / 5; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(165deg, #F7F6F3, #EFEEEA); color: rgba(20,22,26,0.35);
        }
        .thumb-caption { font-size: 13px; color: var(--ink); padding: 12px 14px 14px; margin: 0; }
        .top-post-card {
          background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 18px 20px;
          position: relative; overflow: hidden;
          box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 20px -14px rgba(20,22,26,0.35);
        }
        .top-post-card::after {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
        }
        .top-post-value { font-family: 'IBM Plex Mono', monospace; font-size: 27px; font-weight: 600; margin: 0 0 8px; color: var(--ink); }
        .top-post-title {
          font-size: 13.5px; color: var(--ink); margin: 0 0 10px; line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .top-post-meta {
          display: flex; gap: 10px; flex-wrap: wrap;
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft);
        }

        .posts-card { padding: 18px 18px 14px; margin-top: 14px; position: relative; z-index: 1; }
        .type-filter-row { display: flex; gap: 8px; margin: 4px 0 16px; flex-wrap: wrap; }
        .type-chip {
          display: flex; align-items: center; gap: 6px;
          font-family: 'IBM Plex Mono', monospace; font-size: 12px;
          border: 1px solid var(--rule); background: #FFFFFF; color: var(--ink-soft);
          padding: 6px 12px 6px 8px; border-radius: 999px; cursor: pointer; transition: all 0.15s ease;
        }
        .type-chip.active { color: #fff; border-color: transparent; }
        .type-chip .dot { width: 8px; height: 8px; border-radius: 50%; }
        .type-chip strong { font-weight: 600; }

        .posts-table-wrap { margin-top: 14px; max-height: 320px; overflow: auto; border-top: 1px solid var(--rule); }
        .posts-table-wrap::-webkit-scrollbar { width: 6px; height: 6px; }
        .posts-table-wrap::-webkit-scrollbar-thumb { background: rgba(20,22,26,0.18); border-radius: 4px; }
        .posts-table { width: 100%; border-collapse: collapse; font-family: 'IBM Plex Mono', monospace; font-size: 12px; min-width: 920px; }
        .posts-table th {
          text-align: right; font-weight: 500; color: var(--ink-soft); font-size: 10.5px;
          letter-spacing: 0.03em; padding: 10px 8px 8px; position: sticky; top: 0; background: #F6F7F8; white-space: nowrap;
        }
        .posts-table th:nth-child(1), .posts-table th:nth-child(2), .posts-table th:nth-child(3), .posts-table th:nth-child(4),
        .posts-table td:nth-child(1), .posts-table td:nth-child(2), .posts-table td:nth-child(3), .posts-table td:nth-child(4) { text-align: left; }
        .posts-table td { text-align: right; padding: 9px 8px; color: var(--ink); border-top: 1px solid rgba(20,22,26,0.06); white-space: nowrap; }
        .posts-table td.title-cell { white-space: normal; max-width: 220px; font-family: 'Inter', sans-serif; font-size: 12.5px; }
        .posts-table tr:hover td { background: rgba(20,22,26,0.03); }
        .status-pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; }
        .status-pill.live { background: rgba(47,158,93,0.12); color: var(--up); }
        .status-pill.sent { background: rgba(90,138,166,0.14); color: #3E6E88; }
        .status-pill.down { background: rgba(194,74,66,0.12); color: var(--down); }
        .empty-note { font-size: 12.5px; color: var(--ink-soft); padding: 20px 4px; text-align: center; }

        .footnote {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft);
          margin-top: 20px; border-top: 1px solid var(--rule); padding-top: 10px; position: relative; z-index: 1;
        }

        @media (max-width: 720px) {
          .kpi-row, .kpi-row-4, .platform-grid, .top-posts-grid, .split-row, .row-2col { grid-template-columns: 1fr; }
          .row-2col .chart-card { height: auto; }
          .row-2col .chart-card .chart-fill { min-height: 220px; }
          .lg-title { font-size: 24px; }
          .controls-row { flex-direction: column; align-items: flex-start; }
          .lg-title-row { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="lg-header">
        <p className="lg-eyebrow">Growth Ledger · 成長帳本</p>

        <div className="lg-title-row">
          <h1 className="lg-title">社群數據監測</h1>
          <div>
            <button className="refresh-btn" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw size={15} className={isRefreshing ? "spin" : ""} />
              {isRefreshing ? "更新中…" : "更新數據"}
            </button>
            <p className="last-updated">{lastUpdated ? `最後更新:${fmtTime(lastUpdated)}` : "尚未更新"}</p>
            {fetchError && <p className="last-updated" style={{ color: "var(--down)" }}>資料拉取失敗:{fetchError}</p>}
          </div>
        </div>

        <div className="tab-row">
          {TAB_ORDER.map((id) => {
            const b = brandsData.find((x) => x.id === id);
            const label = id === "overview" ? "總覽" : b.name;
            const accent = id === "overview" ? "#1E2024" : b.accent;
            const active = id === activeTab;
            return (
              <button
                key={id}
                className={`tab-btn ${active ? "active" : ""}`}
                onClick={() => setActiveTab(id)}
                style={active ? { "--accent": accent } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="date-filter-row">
          <div className="date-presets">
            {PRESETS.map((p) => (
              <button key={p.id} className={`preset-btn ${preset === p.id ? "active" : ""}`} onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="date-inputs">
            <input type="date" value={dateRange.start} min={DATA_MIN_STR} max={dateRange.end} onChange={(e) => handleCustomDate("start", e.target.value)} />
            <span>至</span>
            <input type="date" value={dateRange.end} min={dateRange.start} max={DATA_MAX_STR} onChange={(e) => handleCustomDate("end", e.target.value)} />
          </div>
        </div>
      </div>

      {isOverview && overviewData && (
        <>
          <div className="kpi-row kpi-row-4">
            {overviewData.kpis.map((k) => {
              const up = k.delta === null || k.delta >= 0;
              return (
                <div className="kpi-card" key={k.label}>
                  <p className="kpi-label">{k.label}</p>
                  <p className="kpi-value">{k.value}</p>
                  {k.delta !== null && (
                    <span className={`kpi-delta ${up ? "up" : "down"}`}>
                      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {k.deltaKind === "num"
                        ? `${up ? "+" : ""}${fmt(k.delta)}`
                        : `${up ? "+" : ""}${k.delta.toFixed(1)}%`}{" "}
                      <span className="delta-sub">較前期</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="row-2col" style={{ marginTop: 14 }}>
            <div className="chart-card">
              <h2 className="chart-heading" style={{ marginBottom: 12 }}>LINE@ 新增好友數</h2>
              <div className="chart-fill">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overviewData.trendChart} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(20,22,26,0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, fill: "#1E2024" }} tickLine={false} axisLine={{ stroke: "rgba(20,22,26,0.12)" }} />
                    <YAxis tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#6B7178" }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid rgba(20,22,26,0.12)", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12, color: "#1E2024" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {overviewData.trendChart.map((b) => (
                        <Cell key={b.id} fill={b.accent} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v) => `${v >= 0 ? "+" : ""}${fmt(v)}`}
                        style={{ fontFamily: "IBM Plex Mono", fontSize: 12, fontWeight: 600, fill: "#1E2024" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="posts-card">
              <div className="funnel-card-head">
                <h2 className="chart-heading" style={{ marginBottom: 0 }}>成長轉換漏斗</h2>
              </div>
              <div className="funnel-visual">
                {funnelData.map((f, i) => {
                  const shapeWidth = FUNNEL_SHAPE_WIDTHS[i] ?? 30;
                  const nextShapeWidth = FUNNEL_SHAPE_WIDTHS[i + 1] ?? Math.max(shapeWidth - 22, 16);
                  return (
                    <div key={f.label}>
                      {i > 0 && <div className="funnel-connector">↓ {formatPct(f.pct)}</div>}
                      <div className="funnel-segment">
                        <div
                          className="funnel-shape"
                          style={{
                            clipPath: funnelClipPath(shapeWidth, nextShapeWidth),
                            background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                          }}
                        />
                        <div className="funnel-text-row">
                          <span className="funnel-label">{f.label}</span>
                          <span className="funnel-value">{fmt(f.value)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="chart-card" style={{ marginTop: 14 }}>
            <h2 className="chart-heading" style={{ marginBottom: 12 }}>LINE@ 新增好友趨勢</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={overviewData.lineTrendChart} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(20,22,26,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#6B7178" }} tickLine={false} axisLine={{ stroke: "rgba(20,22,26,0.12)" }} minTickGap={24} />
                <YAxis
                  ticks={overviewData.lineTrendTicks}
                  domain={[0, overviewData.lineTrendTicks[overviewData.lineTrendTicks.length - 1]]}
                  tickFormatter={(v) => `+${v}`}
                  tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#6B7178" }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <Tooltip
                  formatter={(v) => `+${fmt(v)}`}
                  contentStyle={{ background: "#FFFFFF", border: "1px solid rgba(20,22,26,0.12)", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12, color: "#1E2024" }}
                />
                {orderedBrands.map((b) => (
                  <Line key={b.id} type="monotone" dataKey={b.id} stroke={b.accent} strokeWidth={2.25} dot={{ r: 3 }} name={b.name} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="legend-row" style={{ marginTop: 10 }}>
              {orderedBrands.map((b) => (
                <span className="legend-item" key={b.id} style={{ color: b.accent, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
                  <span className="legend-dot" style={{ background: b.accent }} />
                  {b.name}
                </span>
              ))}
            </div>
          </div>

          <p className="footnote">
            * 總覽頁 KPI、成長轉換漏斗、LINE@ 新增好友趨勢皆以上方選取的日期區間為準;KPI 對比基準為所選日期區間前的等長區間(較前期);成長轉換漏斗的百分比為「該階段數值 ÷ 貼文觸及」。
          </p>
        </>
      )}

      {!isOverview && (
      <>
      <div className="platform-grid">
        {Object.entries(PLATFORM_META).map(([key, meta]) => {
          const s = platformSeries[key];
          const cur = s[s.length - 1]?.value ?? 0;
          const prev = s[0]?.value ?? cur;
          const delta = cur - prev;
          const up = delta >= 0;
          const Icon = meta.icon;
          return (
            <div className="platform-card" key={key}>
              <div className="platform-head">
                <div className="platform-icon"><Icon size={14} /></div>
                <span className="platform-name">{meta.label}</span>
              </div>
              <p className="platform-value">{fmt(cur)}</p>
              <span className={`kpi-delta ${up ? "up" : "down"}`}>
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {up ? "+" : ""}{fmt(delta)}
              </span>
              <ResponsiveContainer width="100%" height={44}>
                <LineChart data={s}>
                  <Line type="monotone" dataKey="value" stroke={brand.accent} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      <div className="controls-row">
        <h2 className="chart-heading">熱門貼文</h2>
      </div>

      <div className="top-posts-grid">
        {[
          { key: "views", label: "觀看數最多的貼文" },
          { key: "likes", label: "讚數最多的貼文" },
          { key: "comments", label: "留言數最多的貼文" },
        ].map(({ key, label }) => {
          const post = topPosts[key];
          return (
            <div className="top-post-card" key={key}>
              <p className="kpi-label">{label}</p>
              {!post ? (
                <p className="empty-note" style={{ padding: "12px 0" }}>此區間內沒有符合條件的貼文</p>
              ) : (
                <>
                  <p className="top-post-value">{fmt(post[key])}</p>
                  <p className="top-post-title">{post.title}</p>
                  <div className="top-post-meta">
                    <span>{post.platform}</span>
                    <span>{CONTENT_TYPES[post.type]?.label}</span>
                    <span>{post.date}</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 每日貼文紀錄 */}
      <div className="controls-row" style={{ marginTop: 30 }}>
        <h2 className="chart-heading">每日貼文紀錄</h2>
        <div className="range-toggle">
          {RANGES.map((r) => (
            <button key={r.id} className={`range-btn ${range === r.id ? "active" : ""}`} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="posts-card">
        <div className="type-filter-row">
          {typeKeys.map((key) => {
            const meta = CONTENT_TYPES[key];
            const Icon = meta.icon;
            const active = activeTypes.has(key);
            return (
              <button key={key} className={`type-chip ${active ? "active" : ""}`} style={active ? { background: meta.color } : undefined} onClick={() => toggleType(key)}>
                <span className="dot" style={{ background: active ? "#fff" : meta.color }} />
                <Icon size={12} />
                {meta.label} <strong>{typeTotals[key] || 0}</strong>
              </button>
            );
          })}
        </div>

        {activeTypeKeys.length === 0 ? (
          <p className="empty-note">請至少選擇一個分類以顯示資料</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={postsChart} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(20,22,26,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#6B7178" }} tickLine={false} axisLine={{ stroke: "rgba(20,22,26,0.12)" }} minTickGap={24} />
                <YAxis tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#6B7178" }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid rgba(20,22,26,0.12)", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12, color: "#1E2024" }} />
                {activeTypeKeys.map((key, i) => (
                  <Bar key={key} dataKey={key} stackId="posts" fill={CONTENT_TYPES[key].color} radius={i === activeTypeKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} name={CONTENT_TYPES[key].label} />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="posts-table-wrap">
              <table className="posts-table">
                <thead>
                  <tr>
                    <th>發布日期</th>
                    <th>平台</th>
                    <th>類型</th>
                    <th>標題</th>
                    <th>觀看數</th>
                    <th>讚數</th>
                    <th>留言數</th>
                    <th>分享數</th>
                    <th>收藏數</th>
                    <th>觸及數</th>
                    <th>LINE 粉絲增加數</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr><td colSpan={12} className="empty-note">此區間內沒有符合條件的貼文</td></tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const meta = CONTENT_TYPES[r.type];
                      const statusClass = getStatusClass(r.status);
                      const isLatestOfDay = latestRecordIdByDate[r.date] === r.id;
                      const lineDelta = isLatestOfDay ? lineDeltaByDate[r.date] : undefined;
                      return (
                        <tr key={r.id}>
                          <td>{r.date}</td>
                          <td>{r.platform}</td>
                          <td>{meta.label}</td>
                          <td className="title-cell">{r.title}</td>
                          <td>{fmt(r.views)}</td>
                          <td>{fmt(r.likes)}</td>
                          <td>{fmt(r.comments)}</td>
                          <td>{fmt(r.shares)}</td>
                          <td>{fmt(r.saves)}</td>
                          <td>{fmt(r.reach)}</td>
                          <td>{lineDelta != null ? `${lineDelta >= 0 ? "+" : ""}${fmt(lineDelta)}` : "—"}</td>
                          <td><span className={`status-pill ${statusClass}`}>{r.status}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="footnote">
        * LINE 推播沒有「讚 / 留言 / 分享 / 收藏」機制,以「—」表示;觸及數為送達則數,觀看數為估計開啟數。「更新數據」目前為示意模擬,待你把 DATA_SOURCE_URL 換成 Apps Script Web App 網址後即可拉真實資料。
      </p>
      </>
      )}
    </div>
  );
}
