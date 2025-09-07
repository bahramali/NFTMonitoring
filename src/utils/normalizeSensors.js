const nmToBand = {
  '415': 'F1',
  '445': 'F2',
  '480': 'F3',
  '515': 'F4',
  '555': 'F5',
  '590': 'F6',
  '630': 'F7',
  '680': 'F8',
};

const fixSubs = (s) => String(s).replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => '0123456789'["₀₁₂₃₄₅₆₇₈₉".indexOf(d)]);

function canonKey(raw) {
  const t = fixSubs(String(raw || '')).toLowerCase().replace(/[\s_]/g, '');
  if (!t) return null;
  if (['temperature','temp','airtemp','airtemperature'].includes(t)) return 'temperature';
  if (['humidity','rh','relativehumidity'].includes(t)) return 'humidity';
  if (['light','lux','illumination'].includes(t)) return 'lux';
  if (['tds','tdsppm','dissolvedtds'].includes(t)) return 'tds';
  if (['ec','electricalconductivity','dissolvedec'].includes(t)) return 'ec';
  if (t === 'ph') return 'ph';
  if (['do'].includes(t)) return 'DO';
  if (['co2','co₂','co2ppm'].includes(t)) return 'co2';
  if (['watertemp','watertemperature','water_temp','dissolvedtemp'].includes(t)) return 'waterTemp';
  if (['vis1','vis_1'].includes(t)) return 'vis1';
  if (['vis2','vis_2'].includes(t)) return 'vis2';
  if (['nir855','nir','nir_855'].includes(t)) return 'nir855';
  if (t === 'colorspectrum') return 'colorSpectrum';
  return t;
}

function toNum(v) {
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function normalizeSensors(src = []) {
  const sensors = Array.isArray(src) ? src : [];
  const out = {};
  for (const s of sensors) {
    const typeRaw = s?.sensorType ?? s?.valueType ?? s?.type ?? s?.name;
    const key = canonKey(typeRaw);
    const val = toNum(s?.value);
    if (key == null || val == null) continue;
    const unit = s?.unit || s?.units || s?.u || '';
    switch (key) {
      case 'temperature':
      case 'humidity':
      case 'co2':
      case 'tds':
      case 'ec':
      case 'ph':
      case 'DO':
      case 'waterTemp':
      case 'lux':
        out[key] = { value: val, unit };
        break;
      case 'colorSpectrum': {
        const bands = ['F1','F2','F3','F4','F5','F6','F7','F8','clear','nir'];
        let i = 0;
        for (const k in s.value || {}) {
          const v = toNum(s.value[k]);
          if (v != null) out[bands[i++]] = v;
        }
        break;
      }
      default: {
        if (/^\d{3}nm$/.test(key)) {
          const nm = key.slice(0,3);
          const band = nmToBand[nm];
          if (band) out[band] = val; else out[`${nm}nm`] = val;
        } else if (['clear','nir','vis1','vis2','nir855'].includes(key)) {
          out[key] = val;
        } else {
          out[key] = { value: val, unit };
        }
        break;
      }
    }
  }
  return out;
}

export function deriveFromSensors(arr = []) {
  const normalized = normalizeSensors(arr);
  const map = {};
  const spectrum = {};
  const otherLight = {};
  const water = {};

  for (const [k, v] of Object.entries(normalized)) {
    if (/^F\d$/.test(k) || /^\d{3}nm$/.test(k) || k === 'clear' || k === 'nir') {
      spectrum[k] = v.value ?? v;
      continue;
    }
    if (k === 'lux' || k === 'vis1' || k === 'vis2' || k === 'nir855') {
      otherLight[k] = v.value ?? v;
      continue;
    }
    if (k === 'tds') { water.tds_ppm = v.value ?? v; continue; }
    if (k === 'ec') { water.ec_mScm = v.value ?? v; continue; }
    if (k === 'DO') { water.do_mgL = v.value ?? v; continue; }
    if (k === 'waterTemp') { water.tempC = v.value ?? v; continue; }
    if (k === 'temperature') { map.temp = v.value ?? v; continue; }
    if (k === 'humidity') { map.humidity = v.value ?? v; continue; }
    if (k === 'co2') { map.co2 = v.value ?? v; continue; }
    map[k] = v.value ?? v;
  }

  return {
    map,
    spectrum: Object.keys(spectrum).length ? spectrum : null,
    otherLight: Object.keys(otherLight).length ? otherLight : null,
    water: Object.keys(water).length ? water : null,
  };
}

export default normalizeSensors;
