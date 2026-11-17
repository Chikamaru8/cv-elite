        // ==========================================
        // 3. UTILIDADES
        // ==========================================
        const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
        const mixHex = (hex, other, t) => {
          const a = hex.replace('#', ''), b = other.replace('#', '');
          const ch = (i) => {
            const x = parseInt(a.substr(i, 2), 16), y = parseInt(b.substr(i, 2), 16);
            return Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
          };
          return '#' + ch(0) + ch(2) + ch(4);
        };

        const buildCustomTheme = (primary) => ({
          id: 'custom', group: 'custom', name: 'Personalizado', primary,
          bgLeft: mixHex(primary, '#ffffff', 0.93),
          accent: mixHex(primary, '#ffffff', 0.72),
          text: mixHex(primary, '#111827', 0.72)
        });

        const hrefOf = (v) => /^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, '');
        const prettyUrl = (v) => v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');

        const str = (v) => (v === null || v === undefined) ? '' : String(v);
        let _uidCounter = 0;
        const uid = () => `${Date.now().toString(36)}${(_uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const idOf = (v) => (v && typeof v === 'object') ? v.id : v;

        // Nombre de archivo seguro para el disco (sin caracteres inválidos)
        const makeFileName = (name, id) => {
          const clean = str(name || 'Candidato').trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, '_') || 'Candidato';
          return `CV_${clean}_${id}.json`;
        };

        // Escritura segura: si falla, se aborta y el archivo original queda intacto
        const writeJsonFile = async (dir, fileName, obj) => {
          const fh = await dir.getFileHandle(fileName, { create: true });
          const wr = await fh.createWritable();
          try { await wr.write(JSON.stringify(obj)); await wr.close(); }
          catch (e) { try { await wr.abort(); } catch (_) {} throw e; }
        };

        const normList = (arr, fields) => (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object').map((x, i) => {
          const o = { id: (x.id !== undefined && x.id !== null && x.id !== '') ? x.id : Date.now() + i };
          fields.forEach(f => { o[f] = str(x[f]); });
          return o;
        });

        // Garantiza que un CV, venga de donde venga (disco, versiones viejas, IA), tenga SIEMPRE la estructura completa
        const normalizeData = (p) => {
          const src = (p && typeof p === 'object') ? p : {};
          const personal = { ...emptyData.personal, ...((src.personal && typeof src.personal === 'object') ? src.personal : {}) };
          Object.keys(personal).forEach(k => { personal[k] = str(personal[k]); });
          return {
            personal,
            photo: (typeof src.photo === 'string' && src.photo) ? src.photo : null,
            profile: str(src.profile),
            skills: normList(src.skills, ['title', 'text']),
            experience: normList(src.experience, ['company', 'role', 'date', 'tasks']),
            education: normList(src.education, ['text']),
            certifications: normList(src.certifications, ['text'])
          };
        };

        const normalizeConfig = (p) => {
          const src = (p && typeof p === 'object') ? p : {};
          let theme = THEMES[0];
          const st = src.theme;
          if (st && typeof st === 'object') {
            if (st.id === 'custom' && isHex(st.primary)) theme = buildCustomTheme(st.primary);
            else {
              const found = THEMES.find(t => t.id === st.id);
              if (found) theme = found;
              else if (isHex(st.primary) && isHex(st.bgLeft) && isHex(st.accent) && isHex(st.text)) theme = { id: 'custom', group: 'custom', name: st.name || 'Personalizado', primary: st.primary, bgLeft: st.bgLeft, accent: st.accent, text: st.text };
            }
          } else if (typeof st === 'string') theme = THEMES.find(t => t.id === st) || THEMES[0];

          const rawPhoto = (src.photo && typeof src.photo === 'object') ? src.photo : {};
          const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
          const photo = {
            shape: PHOTO_SHAPES.find(x => x.id === rawPhoto.shape) ? rawPhoto.shape : DEFAULT_PHOTO.shape,
            size: PHOTO_SIZES.find(x => x.id === rawPhoto.size) ? rawPhoto.size : DEFAULT_PHOTO.size,
            border: PHOTO_BORDERS.find(x => x.id === rawPhoto.border) ? rawPhoto.border : DEFAULT_PHOTO.border,
            gray: !!rawPhoto.gray,
            x: num(rawPhoto.x, 50, 0, 100), y: num(rawPhoto.y, 50, 0, 100), zoom: num(rawPhoto.zoom, 100, 100, 250)
          };
          return {
            theme,
            font: FONTS.find(f => f.id === idOf(src.font)) || FONTS[0],
            layout: LAYOUTS.find(l => l.id === idOf(src.layout)) || LAYOUTS[0],
            spacing: SPACING.find(x => x.id === idOf(src.spacing)) || SPACING[1],
            photo
          };
        };

        // Convierte cualquier registro (archivo del disco, caché, importación) en un perfil válido
        const sanitizeProfile = (p, extra = {}) => {
          const src = (p && typeof p === 'object') ? p : {};
          const rawData = (src.data && typeof src.data === 'object') ? src.data : (src.personal ? src : {});
          return {
            id: (src.id !== undefined && src.id !== null && src.id !== '') ? String(src.id) : uid(),
            data: normalizeData(rawData),
            config: normalizeConfig(src.config),
            updatedAt: Number(src.updatedAt) || Date.now(),
            isDeleted: !!src.isDeleted, // Propiedad para la papelera
            ...(src.fileName ? { fileName: String(src.fileName) } : {}),
            ...extra
          };
        };

        // ==========================================
        // IMPORTACIÓN CON IA: lectura tolerante de respuestas (ChatGPT, Gemini, Claude…)
        // ==========================================
        const stripAiNoise = (raw) => {
          let t = String(raw || '')
            .replace(/\uFEFF/g, '')
            .replace(/\[\s*(?:cite|source|fuente)(?:_start|_end)?\s*:?[^\]]*\]/gi, '')
            .replace(/:contentReference\[[^\]]*\]\{[^}]*\}/g, '')
            .replace(/【[^】]*】/g, '')
            .replace(/```[a-zA-Z]*[ \t]*/g, '');
          if (!/"/.test(t) && /[“”]/.test(t)) t = t.replace(/[“”]/g, '"'); 
          return t;
        };

        const extractJsonBlocks = (text) => {
          const blocks = []; let depth = 0, start = -1, inStr = false, esc = false;
          for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
            if (c === '"') { if (depth > 0) inStr = true; continue; }
            if (c === '{') { if (depth === 0) start = i; depth++; }
            else if (c === '}' && depth > 0) { depth--; if (depth === 0) { blocks.push(text.slice(start, i + 1)); start = -1; } }
          }
          if (depth > 0 && start >= 0) blocks.push(text.slice(start)); 
          return blocks;
        };

        const repairJson = (src) => {
          let out = '', inStr = false, esc = false, closedAuto = false;
          const stack = [];
          for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (inStr) {
              if (esc) { esc = false; if ('"\\/bfnrtu'.indexOf(c) === -1) out = out.slice(0, -1); out += c; continue; }
              if (c === '\\') { out += c; esc = true; continue; }
              if (c === '"') { inStr = false; out += c; continue; }
              if (c === '\n') { out += '\\n'; continue; }
              if (c === '\r') continue;
              if (c === '\t') { out += '\\t'; continue; }
              if (c === '[') { const m = /^\[\d+(?:\s*[,\-–]\s*\d+)*\]/.exec(src.slice(i, i + 24)); if (m) { i += m[0].length - 1; continue; } }
              out += c; continue;
            }
            if (c === '"') { inStr = true; out += c; continue; }
            if (c === '{' || c === '[') { stack.push(c === '{' ? '}' : ']'); out += c; continue; }
            if (c === '}' || c === ']') { if (stack.length) stack.pop(); out += c; continue; }
            if (c === ',') { let j = i + 1; while (j < src.length && /\s/.test(src[j])) j++; if (j >= src.length || src[j] === '}' || src[j] === ']') continue; }
            out += c;
          }
          if (inStr) { out += '"'; closedAuto = true; }
          while (stack.length) { out = out.replace(/[,\s]+$/, ''); out += stack.pop(); closedAuto = true; }
          return { text: out, closedAuto };
        };

        const EMPTY_WORDS = /^(n\/?a|na|null|none|undefined|ninguno|ninguna|no disponible|no especificado|no indicado|sin datos?|-+|—+)$/i;
        const cleanText = (v, objSep = ': ') => {
          if (v === null || v === undefined) return '';
          if (Array.isArray(v)) return v.map(x => cleanText(x, objSep)).filter(Boolean).join('\n');
          if (typeof v === 'object') return Object.values(v).map(x => cleanText(x, objSep)).filter(Boolean).join(objSep);
          const t = String(v).replace(/\[\s*cite[^\]]*\]/gi, '').replace(/【[^】]*】/g, '').trim();
          if (/^\[[^\]]{2,}\]$/.test(t)) return '';
          if (EMPTY_WORDS.test(t)) return '';
          return t;
        };

        const cleanAiCandidate = (src) => {
          const p = (src.personal && typeof src.personal === 'object') ? src.personal : {};
          const personal = {};
          ['name', 'title', 'category', 'company', 'email', 'phone', 'location', 'linkedin', 'website', 'languages'].forEach(k => { personal[k] = cleanText(p[k]); });
          const ageM = cleanText(p.age).match(/\d{1,3}/); personal.age = ageM ? ageM[0] : '';
          const g = cleanText(p.gender).toLowerCase();
          personal.gender = !g ? '' : /^(f|mujer)/.test(g) ? 'Femenino' : /^(m|h|var)/.test(g) ? 'Masculino' : 'Otro';
          if (!personal.category) personal.category = 'Sin Asignar';
          if (!personal.company) personal.company = 'Independiente';

          const arr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
          const skills = arr(src.skills).map(x => typeof x === 'string' ? { title: '', text: cleanText(x) } : { title: cleanText(x && x.title), text: cleanText(x && (x.text || x.skills || x.items || x.detail)) }).filter(x => x.title || x.text);
          const experience = arr(src.experience).map(x => ({ company: cleanText(x && x.company), role: cleanText(x && x.role), date: cleanText(x && x.date), tasks: cleanText(x && (x.tasks || x.description || x.responsibilities)) })).filter(x => x.company || x.role || x.tasks);
          const textItems = (v) => arr(v).map(x => (typeof x === 'string') ? cleanText(x) : (cleanText(x && x.text) || cleanText(x, ' | '))).filter(Boolean).map(text => ({ text }));

          const out = normalizeData({
            personal, photo: null, profile: cleanText(src.profile || src.summary),
            skills, experience, education: textItems(src.education), certifications: textItems(src.certifications)
          });
          const base = Date.now();
          ['skills', 'experience', 'education', 'certifications'].forEach((k, ki) => { out[k] = out[k].map((x, i) => ({ ...x, id: base + ki * 1000 + i })); });
          return out;
        };

        const isCvLike = (o) => o && typeof o === 'object' && !Array.isArray(o) && ((o.personal && typeof o.personal === 'object') || (o.data && typeof o.data === 'object' && o.data.personal));
        const isFlatCv = (o) => o && typeof o === 'object' && !Array.isArray(o) && typeof o.name === 'string' && (Array.isArray(o.experience) || Array.isArray(o.skills) || typeof o.profile === 'string');
        const findCvObjects = (o, depth = 0) => {
          if (!o || typeof o !== 'object' || depth > 4) return [];
          if (isCvLike(o)) return [(o.data && o.data.personal) ? o.data : o];
          if (isFlatCv(o)) return [{ ...o, personal: { name: o.name, title: o.title, email: o.email, phone: o.phone, location: o.location, linkedin: o.linkedin, website: o.website, languages: o.languages, age: o.age, gender: o.gender, category: o.category, company: o.company } }];
          return (Array.isArray(o) ? o : Object.values(o)).flatMap(k => findCvObjects(k, depth + 1));
        };

        const parseAiInput = (raw) => {
          const result = { items: [], errors: [] };
          const text = stripAiNoise(raw);
          if (!text.trim()) return result;
          const blocks = extractJsonBlocks(text);
          if (blocks.length === 0) { result.errors.push({ msg: 'No se encontró ningún bloque JSON { }.', chunk: String(raw).trim() }); return result; }
          blocks.forEach((chunk, idx) => {
            let obj = null, note = '';
            try { obj = JSON.parse(chunk); }
            catch (e1) {
              try { const r = repairJson(chunk); obj = JSON.parse(r.text); if (r.closedAuto) note = 'estaba incompleto: se recuperó lo disponible'; }
              catch (e2) { result.errors.push({ msg: `Bloque ${idx + 1}: JSON inválido (${e2.message})`, chunk }); return; }
            }
            const found = findCvObjects(obj);
            if (!found.length) { result.errors.push({ msg: `Bloque ${idx + 1}: no contiene datos de un currículum.`, chunk }); return; }
            found.forEach(f => result.items.push({ data: cleanAiCandidate(f), note }));
          });
          return result;
        };

        const loadConfig = () => {
          try { const s = localStorage.getItem('cvCreatorConfig'); return normalizeConfig(s ? JSON.parse(s) : null); }
          catch (e) { return normalizeConfig(null); }
        };

        const compressImage = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = (ev) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
              const max = 1000;
              const k = Math.min(1, max / Math.max(img.width, img.height));
              const w = Math.round(img.width * k), h = Math.round(img.height * k);
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.88));
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });

