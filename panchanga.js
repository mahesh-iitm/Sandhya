// Pañcāṅga (dṛk, Lahiri ayanāṁśa): tithi, vāra, nakṣatra, yoga, karaṇa with end times.
// Sun and Moon from Astronomy Engine (apparent, true equinox of date); Lahiri fitted to Swiss Ephemeris SIDM_LAHIRI.
const PANCH = (() => {
  const A = (typeof Astronomy !== 'undefined') ? Astronomy : require('astronomy-engine');
  const mod = (x, m) => ((x % m) + m) % m;
  const HOUR = 36e5;

  // Lahiri (mean) ayanāṁśa, degrees; T in Julian centuries of UT from J2000. Max error vs Swiss Ephemeris < 0.001".
  const lahiri = T => 23.857092351756236 + T * (1.3968879589304126 + T * (0.00030709121433739826 + T * 7.780471649608811e-10));

  function sidereal(date) {
    const t = A.MakeTime(date);
    const ay = lahiri(t.ut / 36525) + A.e_tilt(t).dpsi / 3600; // true ayanāṁśa (tropical longitudes include nutation)
    return { sun: mod(A.SunPosition(t).elon - ay, 360), moon: mod(A.EclipticGeoMoon(t).lon - ay, 360) };
  }

  // continuous "anga value" functions; floor() gives the index
  const KIND = {
    tithi:     { n: 30, f: s => mod(s.moon - s.sun, 360) / 12 },
    nakshatra: { n: 27, f: s => s.moon / (360 / 27) },
    yoga:      { n: 27, f: s => mod(s.sun + s.moon, 360) / (360 / 27) },
    karana:    { n: 60, f: s => mod(s.moon - s.sun, 360) / 6 },
  };
  const idx = (kind, ms) => Math.floor(KIND[kind].f(sidereal(new Date(ms)))) % KIND[kind].n;

  // time (ms) when anga `kind` changes from index i, searching forward from ms0 (max ~3 days)
  function endOf(kind, i, ms0) {
    let a = ms0, b = ms0 + HOUR;
    while (idx(kind, b) === i) { a = b; b += HOUR; if (b - ms0 > 80 * HOUR) return null; }
    while (b - a > 1000) { const m = (a + b) / 2; if (idx(kind, m) === i) a = m; else b = m; }
    return Math.round(b / 1000) * 1000;
  }

  // all angas of a kind from `from` (sunrise) until `to` (next sunrise): [{i, end}], last may end after `to`
  function spans(kind, from, to) {
    const out = []; let t = from, i = idx(kind, from);
    for (let k = 0; k < 6; k++) {
      const end = endOf(kind, i, t); out.push({ i, end });
      if (!end || end >= to) break;
      t = end + 1000; i = idx(kind, t);
    }
    return out;
  }

  // ---- māsa ----
  const DAY = 864e5;
  const elong = ms => { const x = sidereal(new Date(ms)); return mod(x.moon - x.sun, 360); };
  const rasi = ms => Math.floor(sidereal(new Date(ms)).sun / 30);
  function newMoon(ms, dir) { // dir -1: last new moon before ms; +1: next after
    let a = ms, b = ms;
    if (dir < 0) { b = ms; a = ms - DAY; while (!(elong(a) > elong(b))) { b = a; a -= DAY; } }
    else { a = ms; b = ms + DAY; while (!(elong(b) < elong(a))) { a = b; b += DAY; } }
    while (b - a > 1000) { const m = (a + b) / 2; if (elong(m) > 180) a = m; else b = m; }
    return b;
  }
  const LUNAR = ['Caitra','Vaiśākha','Jyeṣṭha','Āṣāḍha','Śrāvaṇa','Bhādrapada','Āśvayuja','Kārttika','Mārgaśīrṣa','Pauṣya','Māgha','Phālguna'];
  const RASI = ['Meṣa','Vṛṣabha','Mithuna','Karkaṭaka','Siṃha','Kanyā','Tulā','Vṛścika','Dhanus','Makara','Kumbha','Mīna'];
  // amānta lunar month containing ms; adhika if no saṅkrānti between the bounding new moons
  function lunarMonth(ms) {
    const p = newMoon(ms, -1), n = newMoon(ms, +1), r1 = rasi(p), r2 = rasi(n);
    const i = (r1 + 1) % 12;
    return { i, adhika: r1 === r2, kshaya: (r2 - r1 + 12) % 12 > 1, start: p, end: n, name: LUNAR[i] };
  }
  // saura month: rāśi of the Sun at the given moment (app passes sunset, Tamil convention)
  function solarMonth(ms) { const i = rasi(ms); return { i, name: RASI[i] }; }

  const TITHI = ['Pratipadā','Dvitīyā','Tṛtīyā','Caturthī','Pañcamī','Ṣaṣṭhī','Saptamī','Aṣṭamī','Navamī','Daśamī','Ekādaśī','Dvādaśī','Trayodaśī','Caturdaśī'];
  const TITHI_D = ['प्रतिपत्','द्वितीया','तृतीया','चतुर्थी','पञ्चमी','षष्ठी','सप्तमी','अष्टमी','नवमी','दशमी','एकादशी','द्वादशी','त्रयोदशी','चतुर्दशी'];
  const NAK = ['Aśvinī','Bharaṇī','Kṛttikā','Rohiṇī','Mṛgaśirā','Ārdrā','Punarvasu','Puṣya','Āśleṣā','Maghā','Pūrva Phalgunī','Uttara Phalgunī','Hasta','Citrā','Svātī','Viśākhā','Anurādhā','Jyeṣṭhā','Mūla','Pūrvāṣāḍhā','Uttarāṣāḍhā','Śravaṇa','Dhaniṣṭhā','Śatabhiṣak','Pūrva Bhādrapadā','Uttara Bhādrapadā','Revatī'];
  const NAK_D = ['अश्विनी','भरणी','कृत्तिका','रोहिणी','मृगशिरा','आर्द्रा','पुनर्वसु','पुष्य','आश्लेषा','मघा','पूर्वफल्गुनी','उत्तरफल्गुनी','हस्त','चित्रा','स्वाती','विशाखा','अनुराधा','ज्येष्ठा','मूल','पूर्वाषाढा','उत्तराषाढा','श्रवण','धनिष्ठा','शतभिषक्','पूर्वभाद्रपदा','उत्तरभाद्रपदा','रेवती'];
  const YOGA = ['Viṣkambha','Prīti','Āyuṣmān','Saubhāgya','Śobhana','Atigaṇḍa','Sukarmā','Dhṛti','Śūla','Gaṇḍa','Vṛddhi','Dhruva','Vyāghāta','Harṣaṇa','Vajra','Siddhi','Vyatīpāta','Varīyān','Parigha','Śiva','Siddha','Sādhya','Śubha','Śukla','Brahma','Indra','Vaidhṛti'];
  const YOGA_D = ['विष्कम्भ','प्रीति','आयुष्मान्','सौभाग्य','शोभन','अतिगण्ड','सुकर्मा','धृति','शूल','गण्ड','वृद्धि','ध्रुव','व्याघात','हर्षण','वज्र','सिद्धि','व्यतीपात','वरीयान्','परिघ','शिव','सिद्ध','साध्य','शुभ','शुक्ल','ब्रह्म','इन्द्र','वैधृति'];
  const KAR = ['Kiṃstughna','Bava','Bālava','Kaulava','Taitila','Garaja','Vaṇija','Viṣṭi','Śakuni','Catuṣpāda','Nāga'];
  const KAR_D = ['किंस्तुघ्न','बव','बालव','कौलव','तैतिल','गरज','वणिज','विष्टि','शकुनि','चतुष्पाद','नाग'];
  const VARA = ['Ravivāra','Somavāra','Maṅgalavāra','Budhavāra','Guruvāra','Śukravāra','Śanivāra'];
  const VARA_D = ['रविवार','सोमवार','मङ्गलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'];

  function name(kind, i) {
    if (kind === 'tithi') {
      const paksha = i < 15 ? 'Śukla' : 'Kṛṣṇa', pd = i < 15 ? 'शुक्ल' : 'कृष्ण', j = i % 15;
      if (i === 14) return ['Pūrṇimā', 'पूर्णिमा'];
      if (i === 29) return ['Amāvāsyā', 'अमावास्या'];
      return [`${paksha} ${TITHI[j]}`, `${pd} ${TITHI_D[j]}`];
    }
    if (kind === 'nakshatra') return [NAK[i], NAK_D[i]];
    if (kind === 'yoga') return [YOGA[i], YOGA_D[i]];
    const k = i === 0 ? 0 : i >= 57 ? i - 49 : ((i - 1) % 7) + 1; // karaṇa
    return [KAR[k], KAR_D[k]];
  }

  // sunrise, nextSunrise: ms timestamps; localWeekday: 0=Sunday for the civil date of `sunrise`
  function forDay(sunrise, nextSunrise, localWeekday) {
    const out = { vara: { i: localWeekday, name: [VARA[localWeekday], VARA_D[localWeekday]] } };
    for (const kind of Object.keys(KIND))
      out[kind] = spans(kind, sunrise, nextSunrise).map(s => ({ ...s, name: name(kind, s.i) }));
    return out;
  }
  function tithiName(i) { const j = i % 15; if (i === 14) return 'Pūrṇimā'; if (i === 29) return 'Amāvāsyā'; return TITHI[j]; }
  return { forDay, sidereal, lahiri, name, lunarMonth, solarMonth, newMoon, tithiName, LUNAR, RASI };
})();
if (typeof module !== 'undefined') module.exports = PANCH;
