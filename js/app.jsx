        function App() {
          // --- ESTADO MULTI-PERFIL ---
          const [view, setView] = useState('dashboard'); // 'dashboard' | 'editor' | 'analytics'
          const [profiles, setProfiles] = useState(() => {
            try { 
              const p = localStorage.getItem('cvEliteProfiles'); 
              const parsed = p ? JSON.parse(p) : []; 
              if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(x => sanitizeProfile(x));
              
              const seedConfig1 = normalizeConfig({ theme: { id: 'slate' }, layout: { id: 'modern' } });
              const seedConfig2 = normalizeConfig({ theme: { id: 'burgundy' }, layout: { id: 'executive' }, photo: { shape: 'rounded' } });
              const seedConfig3 = normalizeConfig({ theme: { id: 'minimal' }, layout: { id: 'harvard' } });
              
              const seeds = [
                { id: 'seed_1', data: initialData, config: seedConfig1, updatedAt: Date.now() },
                { id: 'seed_2', data: templateData2, config: seedConfig2, updatedAt: Date.now() - 1000 },
                { id: 'seed_3', data: templateData3, config: seedConfig3, updatedAt: Date.now() - 2000 }
              ];
              return seeds;
            }
            catch { return []; }
          });
          const [currentProfileId, setCurrentProfileId] = useState(null);
          
          // --- ESTADO LOCAL WORKSPACE ---
          const [dirHandle, setDirHandle] = useState(null);
          const [dirName, setDirName] = useState('');
          const [workspaceState, setWorkspaceState] = useState('disconnected'); // disconnected, pending, connected
          const [isSaving, setIsSaving] = useState(false);
          const saveTimeoutRef = useRef(null);
          const [isSyncing, setIsSyncing] = useState(false);
          const [saveError, setSaveError] = useState(false);
          const profilesRef = useRef(profiles); profilesRef.current = profiles;
          const dirHandleRef = useRef(null); dirHandleRef.current = dirHandle;
          const workspaceStateRef = useRef('disconnected'); workspaceStateRef.current = workspaceState;
          const loadedRef = useRef({ data: null, config: null });

          // --- ESTADO DEL DASHBOARD & CARPETAS ---
          const [searchTerm, setSearchTerm] = useState('');
          const [activeFolder, setActiveFolder] = useState('Todas');
          const [activeCompany, setActiveCompany] = useState('Todas'); // Nivel Empresa
          const [customFolders, setCustomFolders] = useState(() => {
            try { const v = JSON.parse(localStorage.getItem('cvEliteFolders')); return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : []; } 
            catch { return []; }
          });
          const [customCompanies, setCustomCompanies] = useState(() => {
            try { const v = JSON.parse(localStorage.getItem('cvEliteCompanies')); return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : []; } 
            catch { return []; }
          });
          const [showSortModal, setShowSortModal] = useState(false);
          const [showAiModal, setShowAiModal] = useState(false);
          const [aiJsonInput, setAiJsonInput] = useState('');
          const aiFilesRef = useRef(null);
          const aiParse = React.useMemo(() => (showAiModal ? parseAiInput(aiJsonInput) : { items: [], errors: [] }), [aiJsonInput, showAiModal]);
          const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('cvEliteWelcomed'));
          
          // Trash Mode
          const [isTrashMode, setIsTrashMode] = useState(false);

          // --- NUEVOS ESTADOS (CRM Avanzado) ---
          const [selectedIds, setSelectedIds] = useState([]);
          const [contextMenu, setContextMenu] = useState(null);
          const [showMoveModal, setShowMoveModal] = useState(null); // ID del CV a mover
          const [showAdvSearch, setShowAdvSearch] = useState(false);
          const [advFilters, setAdvFilters] = useState({ role: '', minAge: '', maxAge: '', location: '', minExp: '' });
          const [dialog, setDialog] = useState(null); // { type: 'alert'|'confirm', title, msg, onConfirm }
          const [nodeMenu, setNodeMenu] = useState(null); // { x, y, kind: 'company'|'folder', name }
          const [nameModal, setNameModal] = useState(null); // { title, label, value, okText, validate, onSubmit }
          const [nameError, setNameError] = useState('');
          const [pickModal, setPickModal] = useState(null); // { title, hint, options, onPick }
          const [toast, setToast] = useState(null);
          const [moveSel, setMoveSel] = useState({ comp: 'Independiente', cat: 'Sin Asignar' });
          const [dropTarget, setDropTarget] = useState(null);
          const toastTimer = useRef(null);
          const showToast = (msg, kind = 'ok') => { setToast({ msg, kind }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3400); };

          // --- ESTADO DEL EDITOR ---
          const [data, setData] = useState(initialData);
          const [config, setConfig] = useState(() => loadConfig());

          const [activeTab, setActiveTab] = useState('personal');
          const [slideDir, setSlideDir] = useState(1);
          const [isMobilePreview, setIsMobilePreview] = useState(false);
          const [paneW, setPaneW] = useState(0);
          const [docH, setDocH] = useState(1123);

          const fileInputRef = useRef(null);
          const importFileRef = useRef(null);
          const formScrollRef = useRef(null);
          const tabsRef = useRef(null);
          const tabBtnRefs = useRef({});
          const previewRef = useRef(null);
          const docRef = useRef(null);
          const touchRef = useRef(null);
          const nameRef = useRef('');
          nameRef.current = data.personal.name;

          const currentTabIndex = TABS_ORDER.indexOf(activeTab);

          useEffect(() => {
            const closeCtx = () => { setContextMenu(null); setNodeMenu(null); };
            const onKey = (e) => { if (e.key === 'Escape') { closeCtx(); setNameModal(null); setPickModal(null); setShowMoveModal(null); setDialog(null); } };
            window.addEventListener('click', closeCtx); window.addEventListener('keydown', onKey); window.addEventListener('resize', closeCtx);
            return () => { window.removeEventListener('click', closeCtx); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', closeCtx); };
          }, []);

          const showDialog = (type, title, msg, onConfirm = null) => {
            setDialog({ type, title, msg, onConfirm });
          };

          useEffect(() => {
            if (typeof idbKeyval === 'undefined') return;
            let cancelled = false;
            idbKeyval.get('cv_workspace_handle').then(async handle => {
              if (!handle || cancelled) return;
              setDirHandle(handle);
              setDirName(handle.name);
              setWorkspaceState('pending');
              if (await ensurePermission(handle, false) && !cancelled) await connectToHandle(handle, { silent: true });
            }).catch(e => console.warn(e));
            return () => { cancelled = true; };
          }, []);

          useEffect(() => {
            try { localStorage.setItem('cvEliteProfiles', JSON.stringify(profiles)); }
            catch (e) {}
          }, [profiles]);

          useEffect(() => {
            try { localStorage.setItem('cvEliteFolders', JSON.stringify(customFolders)); } 
            catch (e) {}
          }, [customFolders]);

          useEffect(() => {
            try { localStorage.setItem('cvEliteCompanies', JSON.stringify(customCompanies)); } 
            catch (e) {}
          }, [customCompanies]);

          // ==========================================
          const handleSelectWorkspace = async () => {
            if (!window.showDirectoryPicker) {
              showDialog('alert', 'Navegador no compatible', 'Por políticas de privacidad extremas, navegadores como Brave o Firefox bloquean el acceso directo al disco duro. Te recomendamos usar Google Chrome o Microsoft Edge. Mientras tanto, tu trabajo se guardará automáticamente en la memoria temporal del navegador.');
              return;
            }
            try {
              const handle = await window.showDirectoryPicker({ id: 'cv-workspace', mode: 'readwrite' });
              await connectToHandle(handle);
            } catch (err) {
              console.warn("Workspace no seleccionado o permiso denegado.", err);
              if (err && err.name !== 'AbortError') showDialog('alert', 'No se pudo usar esa carpeta', 'El navegador no permite guardar en carpetas del sistema como Escritorio, Documentos o Descargas completas. Crea una carpeta nueva (por ejemplo «Mis Candidatos») y elígela.');
            }
          };

          const ensurePermission = async (handle, interactive) => {
            const opts = { mode: 'readwrite' };
            try {
              if (handle.queryPermission && (await handle.queryPermission(opts)) === 'granted') return true;
              if (interactive && handle.requestPermission) return (await handle.requestPermission(opts)) === 'granted';
            } catch (err) { console.warn('Permiso de carpeta:', err); }
            return false;
          };

          const handleReconnectWorkspace = async () => {
            if (!dirHandle) return;
            const ok = await ensurePermission(dirHandle, true);
            if (ok) await connectToHandle(dirHandle);
            else showDialog('alert', 'Permiso necesario', 'Para sincronizar tus CVs el navegador necesita acceso a la carpeta. Pulsa "Reconectar" otra vez y elige "Permitir", o usa "Elegir otra carpeta".');
          };

          const connectToHandle = async (handle, { silent = false } = {}) => {
            setIsSyncing(true);
            try {
              if (typeof idbKeyval !== 'undefined') idbKeyval.set('cv_workspace_handle', handle).catch(() => {});

              const fromDisk = [];
              let skipped = 0;
              for await (const entry of handle.values()) {
                if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.json')) continue;
                try {
                  const file = await entry.getFile();
                  const parsed = JSON.parse(await file.text());
                  const looksLikeCV = parsed && typeof parsed === 'object' && ((parsed.data && typeof parsed.data === 'object') || parsed.personal);
                  if (!looksLikeCV) { skipped++; continue; }
                  fromDisk.push(sanitizeProfile(parsed, { fileName: entry.name, updatedAt: Number(parsed.updatedAt) || file.lastModified }));
                } catch (e) { skipped++; console.warn(`Ignorado: ${entry.name}`, e); }
              }
              const seen = new Set();
              fromDisk.forEach(p => { if (seen.has(p.id)) p.id = uid(); seen.add(p.id); });

              const diskIds = new Set(fromDisk.map(p => p.id));
              const diskNames = new Set(fromDisk.map(p => p.fileName));
              const localOnly = profilesRef.current.filter(p => !diskIds.has(p.id) && (fromDisk.length === 0 || !String(p.id).startsWith('seed_')));
              const pushed = [];
              for (const p of localOnly) {
                const fileName = (p.fileName && !diskNames.has(p.fileName)) ? p.fileName : makeFileName(p.data.personal.name, p.id);
                try { await writeJsonFile(handle, fileName, { ...p, fileName }); diskNames.add(fileName); pushed.push({ ...p, fileName }); }
                catch (e) { console.warn('No se pudo guardar', fileName, e); pushed.push(p); }
              }

              setProfiles([...fromDisk, ...pushed].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
              setDirHandle(handle);
              setDirName(handle.name);
              setWorkspaceState('connected');
              if (!silent) showDialog('alert', 'Carpeta conectada ✔', `Tus CVs ahora se guardan en «${handle.name}». Desde este momento todo es automático: cada CV nuevo y cada cambio se escriben solos en esa carpeta, sin pulsar Guardar. Se cargaron ${fromDisk.length} currículum(s)${pushed.length ? ` y se copiaron ${pushed.length} más a la carpeta` : ''}.${skipped ? ` Se ignoraron ${skipped} archivo(s) .json que no son currículums.` : ''}`);
            } catch (err) {
              console.error('Error al conectar la carpeta', err);
              setWorkspaceState('pending');
              if (!silent) showDialog('alert', 'No se pudo leer la carpeta', 'Ocurrió un error al leer los archivos. Pulsa "Reconectar" para intentarlo de nuevo.');
            } finally {
              setIsSyncing(false);
            }
          };

          const handleSyncNow = async () => { if (dirHandle) await connectToHandle(dirHandle, { silent: true }); };

          const handleDisconnectWorkspace = () => {
            showDialog('confirm', 'Desconectar carpeta', 'Tus CVs seguirán en la carpeta y en este navegador, pero dejarán de sincronizarse. ¿Desconectar?', async () => {
              try { if (typeof idbKeyval !== 'undefined') await idbKeyval.del('cv_workspace_handle'); } catch (e) {}
              setDirHandle(null); setDirName(''); setWorkspaceState('disconnected');
            });
          };

          const autoSaveToDisk = async (cvData, cvConfig, cvId) => {
            const handle = dirHandleRef.current;
            if (workspaceStateRef.current !== 'connected' || !handle) return;
            setIsSaving(true);
            try {
              const profile = profilesRef.current.find(p => p.id === cvId) || {};
              const fileName = profile.fileName || makeFileName(cvData.personal.name, cvId);
              const updatedCV = { id: cvId, data: cvData, config: cvConfig, updatedAt: Date.now(), fileName };
              await writeJsonFile(handle, fileName, updatedCV);
              setProfiles(prev => prev.some(p => p.id === cvId)
                ? prev.map(p => p.id === cvId ? { ...p, fileName, updatedAt: updatedCV.updatedAt } : p)
                : [updatedCV, ...prev]);
              setSaveError(false);
            } catch (err) {
              console.error('Fallo al guardar en disco', err);
              setSaveError(true);
            } finally {
              setTimeout(() => setIsSaving(false), 800);
            }
          };

          useEffect(() => {
            if (view === 'editor' && currentProfileId) {
              if (loadedRef.current.data === data && loadedRef.current.config === config) return;
              setProfiles(prev => prev.map(p => p.id === currentProfileId ? { ...p, data, config, updatedAt: Date.now() } : p));
              if (workspaceState === 'connected') {
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => autoSaveToDisk(data, config, currentProfileId), 1200);
              }
            }
          }, [data, config, currentProfileId, view, workspaceState, dirHandle]);

          // Funciones del Dashboard
          const handleCreateNew = (company, category) => {
            const newId = Date.now().toString();
            const cfg = loadConfig();
            const base = (typeof company === 'string' && company) ? { ...emptyData, personal: { ...emptyData.personal, company, category: (typeof category === 'string' && category) ? category : 'Sin Asignar' } } : emptyData;
            const newProfile = { id: newId, data: base, config: cfg, updatedAt: Date.now() };
            setProfiles(prev => [newProfile, ...prev]);
            loadedRef.current = { data: null, config: null };
            setData(base); setConfig(cfg); setCurrentProfileId(newId); setActiveTab('personal'); setView('editor'); setContextMenu(null); setNodeMenu(null);
          };
          
          const handleEditProfile = (id) => {
            const found = profiles.find(x => x.id === id);
            if (!found) return;
            const p = sanitizeProfile(found);
            loadedRef.current = { data: p.data, config: p.config };
            setData(p.data); setConfig(p.config); setCurrentProfileId(id); setActiveTab('personal'); setView('editor');
            setContextMenu(null);
          };
          
          const handleDuplicate = async (id) => {
            const p = profiles.find(x => x.id === id);
            if(p) {
              const newId = Date.now().toString();
              const newData = { ...p.data, personal: { ...p.data.personal, name: p.data.personal.name + " (Copia)" } };
              const newProfile = { ...p, id: newId, data: newData, updatedAt: Date.now(), fileName: undefined, isDeleted: false };
              setProfiles(prev => [newProfile, ...prev]);
              
              if(workspaceState === 'connected' && dirHandle) {
                  const newFileName = makeFileName(newData.personal.name, newId);
                  try {
                      const fh = await dirHandle.getFileHandle(newFileName, { create: true });
                      const wr = await fh.createWritable();
                      await wr.write(JSON.stringify({...newProfile, fileName: newFileName}));
                      await wr.close();
                      setProfiles(prev => prev.map(x => x.id === newId ? {...x, fileName: newFileName} : x));
                  } catch (err) {}
              }
            }
            setContextMenu(null);
          };

          // --- PROTECCIÓN DE BORRADO: Enviar a Papelera ---
          const handleDeleteProfile = (id) => {
            showDialog('confirm', 'Mover a Papelera', '¿Mover este candidato a la papelera de reciclaje? Podrás recuperarlo luego.', async () => {
               setProfiles(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true } : p));
               // Actualizar el archivo físico para que refleje el borrado lógico
               const p = profiles.find(x => x.id === id);
               if(p && workspaceState === 'connected' && dirHandle && p.fileName) {
                   try {
                       const updated = { ...p, isDeleted: true };
                       const fh = await dirHandle.getFileHandle(p.fileName, { create: true });
                       const wr = await fh.createWritable();
                       await wr.write(JSON.stringify(updated));
                       await wr.close();
                   } catch(e){}
               }
            });
          };

          // --- RESTAURAR DE PAPELERA ---
          const handleRestoreProfile = (id) => {
            setProfiles(prev => prev.map(p => p.id === id ? { ...p, isDeleted: false } : p));
            const p = profiles.find(x => x.id === id);
            if(p && workspaceState === 'connected' && dirHandle && p.fileName) {
                const updated = { ...p, isDeleted: false };
                dirHandle.getFileHandle(p.fileName, { create: true })
                    .then(fh => fh.createWritable())
                    .then(async wr => { await wr.write(JSON.stringify(updated)); await wr.close(); })
                    .catch(()=>{});
            }
            setContextMenu(null);
          };

          // --- ELIMINAR PERMANENTEMENTE (DENTRO DE PAPELERA) ---
          const handlePermanentDelete = (id) => {
            showDialog('confirm', 'Eliminar Definitivamente', '¿Estás seguro de que quieres eliminar este candidato PARA SIEMPRE? Esta acción no se puede deshacer.', async () => {
               const p = profiles.find(x => x.id === id);
               if(p && workspaceState === 'connected' && dirHandle && p.fileName) {
                   try { await dirHandle.removeEntry(p.fileName); } catch(e){}
               }
               setProfiles(prev => prev.filter(x => x.id !== id));
               setContextMenu(null);
            });
          };

          // --- GESTIÓN DE CARPETAS ---
          const SEP = ' - ';
          const shortOf = (f) => f.includes(SEP) ? f.slice(f.indexOf(SEP) + SEP.length) : f;
          const folderCompany = (f) => f.includes(SEP) ? f.slice(0, f.indexOf(SEP)) : null;
          const companiesNow = () => [...new Set([...customCompanies, ...profilesRef.current.map(p => (p.data.personal.company || '').trim()).filter(Boolean), 'Independiente'])];
          const foldersNow = () => [...new Set([...customFolders, ...profilesRef.current.map(p => (p.data.personal.category || '').trim()).filter(Boolean)])];
          const liveCount = (fn) => profiles.filter(p => !p.isDeleted && fn(p.data.personal)).length;
          const openNodeMenu = (x, y, kind, name) => { setContextMenu(null); setNodeMenu({ x, y, kind, name }); };

          // Guarda en disco solo los CVs modificados (si hay carpeta conectada)
          const persistMany = async (list) => {
            const h = dirHandleRef.current;
            if (workspaceStateRef.current !== 'connected' || !h) return true;
            let ok = true;
            for (const p of list) {
              if (!p.fileName) continue;
              try { await writeJsonFile(h, p.fileName, { ...p, updatedAt: Date.now() }); } catch (e) { ok = false; console.warn('No se pudo guardar', p.fileName, e); }
            }
            setSaveError(!ok);
            return ok;
          };
          const applyChanges = (fn) => {
            const changed = [];
            const next = profilesRef.current.map(p => { const q = fn(p); if (q) { changed.push(q); return q; } return p; });
            setProfiles(next);
            persistMany(changed);
            return changed.length;
          };
          const setPers = (p, patch) => ({ ...p, data: { ...p.data, personal: { ...p.data.personal, ...patch } } });

          const checkName = (v, taken = [], own = '') => {
            const t = v.trim();
            if (!t) return 'Escribe un nombre.';
            if (t.includes(SEP)) return 'No uses " - " dentro del nombre: se usa para separar empresa y carpeta.';
            if (t.length > 60) return 'Máximo 60 caracteres.';
            if (taken.some(x => x.toLowerCase() === t.toLowerCase() && x !== own)) return 'Ya existe uno con ese nombre.';
            return '';
          };
          const askName = (cfg) => { setNameError(''); setNameModal(cfg); };
          const submitName = () => {
            const m = nameModal; if (!m) return;
            const err = m.validate(m.value);
            if (err) { setNameError(err); return; }
            setNameModal(null); m.onSubmit(m.value.trim());
          };

          const handleAddCompany = () => askName({ title: 'Nueva empresa o sucursal', label: 'Nombre', value: '', okText: 'Crear empresa',
            validate: v => checkName(v, companiesNow()),
            onSubmit: nv => { setCustomCompanies(prev => [...new Set([...prev, nv])]); setActiveCompany(nv); setActiveFolder('Todas'); showToast(`Empresa «${nv}» creada`); } });

          const handleAddFolder = (company) => askName({ title: `Nueva carpeta en «${company}»`, label: 'Nombre de la carpeta', value: '', okText: 'Crear carpeta',
            validate: v => checkName(v, foldersNow().filter(f => f.startsWith(company + SEP)).map(shortOf)),
            onSubmit: nv => { const full = company + SEP + nv; setCustomFolders(prev => [...new Set([...prev, full])]); setActiveCompany(company); setActiveFolder(full); showToast(`Carpeta «${nv}» creada`); } });

          const handleRenameCompany = (old) => askName({ title: 'Renombrar empresa', label: 'Nuevo nombre', value: old, okText: 'Renombrar',
            validate: v => checkName(v, companiesNow(), old),
            onSubmit: nv => {
              const cut = old.length + SEP.length;
              setCustomCompanies(prev => [...new Set(prev.map(c => c === old ? nv : c))]);
              setCustomFolders(prev => prev.map(f => f.startsWith(old + SEP) ? nv + SEP + f.slice(cut) : f));
              const n = applyChanges(p => {
                const pr = p.data.personal, cat = pr.category || '';
                const isC = (pr.company || 'Independiente') === old, isF = cat.startsWith(old + SEP);
                if (!isC && !isF) return null;
                return setPers(p, { company: isC ? nv : pr.company, category: isF ? nv + SEP + cat.slice(cut) : cat });
              });
              if (activeCompany === old) setActiveCompany(nv);
              if (activeFolder.startsWith(old + SEP)) setActiveFolder(nv + SEP + activeFolder.slice(cut));
              showToast(`Empresa renombrada a «${nv}» (${n} CV actualizados)`);
            } });

          const handleRenameFolder = (cat) => {
            const comp = folderCompany(cat), short = shortOf(cat);
            askName({ title: 'Renombrar carpeta', label: 'Nuevo nombre', value: short, okText: 'Renombrar',
              validate: v => checkName(v, foldersNow().filter(f => comp ? f.startsWith(comp + SEP) : !f.includes(SEP)).map(shortOf), short),
              onSubmit: nv => {
                const full = comp ? comp + SEP + nv : nv;
                setCustomFolders(prev => [...new Set(prev.map(f => f === cat ? full : f))]);
                const n = applyChanges(p => (p.data.personal.category || '') === cat ? setPers(p, { category: full }) : null);
                if (activeFolder === cat) setActiveFolder(full);
                showToast(`Carpeta renombrada a «${nv}» (${n} CV)`);
              } });
          };

          const handleRenameProfile = (id) => {
            const p = profilesRef.current.find(x => x.id === id); if (!p) return;
            setContextMenu(null);
            askName({ title: 'Renombrar candidato', label: 'Nombre completo', value: p.data.personal.name, okText: 'Guardar nombre',
              validate: v => v.trim() ? '' : 'Escribe un nombre.',
              onSubmit: nv => { applyChanges(x => x.id === id ? setPers(x, { name: nv }) : null); showToast('Nombre actualizado'); } });
          };

          const handleMergeCompany = (old, target) => {
            const cut = old.length + SEP.length;
            setCustomCompanies(prev => prev.filter(c => c !== old));
            setCustomFolders(prev => [...new Set(prev.map(f => f.startsWith(old + SEP) ? target + SEP + f.slice(cut) : f))]);
            const n = applyChanges(p => {
              const pr = p.data.personal, cat = pr.category || '';
              const isC = (pr.company || 'Independiente') === old, isF = cat.startsWith(old + SEP);
              if (!isC && !isF) return null;
              return setPers(p, { company: isC ? target : pr.company, category: isF ? target + SEP + cat.slice(cut) : cat });
            });
            setActiveCompany(target); setActiveFolder('Todas');
            showToast(`«${old}» fusionada con «${target}» (${n} CV movidos)`);
          };

          const handleMoveFolder = (cat, target) => {
            const full = target + SEP + shortOf(cat);
            setCustomFolders(prev => [...new Set([...prev.map(f => f === cat ? full : f), full])]);
            const n = applyChanges(p => (p.data.personal.category || '') === cat ? setPers(p, { company: target, category: full }) : null);
            setActiveCompany(target); setActiveFolder(full);
            showToast(`Carpeta movida a «${target}» (${n} CV)`);
          };

          const handleDeleteCompany = (name) => showDialog('confirm', 'Eliminar empresa', `¿Eliminar «${name}»? Sus CVs pasarán a «Independiente / Sin Asignar» y sus carpetas se quitarán. Ningún CV se borra.`, () => {
            setCustomCompanies(prev => prev.filter(c => c !== name));
            setCustomFolders(prev => prev.filter(f => !f.startsWith(name + SEP)));
            applyChanges(p => {
              const pr = p.data.personal;
              const isC = (pr.company || 'Independiente') === name, isF = (pr.category || '').startsWith(name + SEP);
              return (isC || isF) ? setPers(p, { company: isC ? 'Independiente' : pr.company, category: 'Sin Asignar' }) : null;
            });
            if (activeCompany === name) setActiveCompany('Todas');
            setActiveFolder('Todas');
            showToast(`Empresa «${name}» eliminada`);
          });

          const handleDeleteFolder = (cat) => showDialog('confirm', 'Eliminar carpeta', `¿Eliminar «${shortOf(cat)}»? Los CVs no se borran: pasan a «Sin Asignar».`, () => {
            setCustomFolders(prev => prev.filter(f => f !== cat));
            applyChanges(p => (p.data.personal.category || 'Sin Asignar') === cat ? setPers(p, { category: 'Sin Asignar' }) : null);
            if (activeFolder === cat) setActiveFolder('Todas');
            showToast('Carpeta eliminada');
          });

          const exportNode = (kind, name, asZip) => {
            const list = profilesRef.current.filter(p => !p.isDeleted && (kind === 'company' ? (p.data.personal.company || 'Independiente') === name : (p.data.personal.category || 'Sin Asignar') === name));
            if (!list.length) return showToast('No hay CVs para exportar aquí', 'warn');
            if (asZip) handleDownloadZip(list.map(p => p.id));
            else handleExportExcel(list, `${kind === 'company' ? 'Empresa' : 'Carpeta'}_${shortOf(name)}.xlsx`);
            showToast(`${asZip ? 'ZIP' : 'Excel'} con ${list.length} CV generado`);
          };

          const openMove = (id) => {
            const p = profilesRef.current.find(x => x.id === id); if (!p) return;
            setMoveSel({ comp: p.data.personal.company || 'Independiente', cat: p.data.personal.category || 'Sin Asignar' });
            setShowMoveModal(id); setContextMenu(null);
          };

          const dnd = (key, comp, cat) => ({
            onDragOver: e => { if (isTrashMode) return; e.preventDefault(); setDropTarget(key); },
            onDragLeave: () => setDropTarget(t => t === key ? null : t),
            onDrop: e => {
              e.preventDefault(); setDropTarget(null);
              const id = e.dataTransfer.getData('cv_id'); const p = profilesRef.current.find(x => x.id === id); if (!p) return;
              const c = comp || p.data.personal.company || 'Independiente';
              handleMoveToFolder(id, c, cat);
              showToast(`«${p.data.personal.name || 'CV'}» movido a ${cat === 'Sin Asignar' ? c : shortOf(cat)}`);
            }
          });

          // --- EXPORTAR / IMPORTAR ---
          const handleExportExcel = (dataToExport = profiles, fileName = "Inventario_Candidatos_CVElite.xlsx") => {
            if (typeof XLSX === 'undefined') {
              showDialog('alert', 'Error', 'La librería Excel aún no ha cargado. Intenta de nuevo en unos segundos.');
              return;
            }
            const excelData = dataToExport.filter(p => !p.isDeleted).map(p => {
              const d = p.data.personal;
              return {
                "Nombre Completo": d.name,
                "Cargo / Titulo": d.title,
                "Empresa / Sucursal": d.company || 'Independiente',
                "Categoría (Carpeta)": d.category || 'Sin Asignar',
                "Email": d.email,
                "Teléfono": d.phone,
                "Ubicación": d.location,
                "Edad": d.age || 'N/A',
                "Género": d.gender || 'N/A',
                "LinkedIn": d.linkedin || '-',
                "Última Actualización": new Date(p.updatedAt).toLocaleDateString()
              };
            });
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Candidatos");
            const wscols = [{wch: 25}, {wch: 25}, {wch: 20}, {wch: 20}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 8}, {wch: 10}, {wch: 30}, {wch: 15}];
            worksheet['!cols'] = wscols;
            XLSX.writeFile(workbook, String(fileName).replace(/[\\/:*?"<>|]/g, '_'));
          };

          const handleImportMany = (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            let loaded = 0;
            files.forEach(file => {
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const imported = JSON.parse(event.target.result);
                  if (imported.data) {
                    const newProfile = { id: Date.now().toString() + Math.random(), data: normalizeData(imported.data), config: normalizeConfig(imported.config), updatedAt: Date.now() };
                    setProfiles(prev => [newProfile, ...prev]);
                    loaded++;
                    if(loaded === files.length) showDialog('alert', 'Importación Exitosa', `Se importaron ${loaded} perfiles correctamente.`);
                  }
                } catch (err) { console.error(err); }
              };
              reader.readAsText(file);
            });
            e.target.value = '';
          };

          // --- CRM MASIVO ---
          const handleMoveToFolder = async (id, companyName, folderName) => {
            const p = profiles.find(x => x.id === id);
            if (!p) return;
            const updatedProfile = {...p, data: {...p.data, personal: {...p.data.personal, company: companyName, category: folderName}}};
            setProfiles(prev => prev.map(x => x.id === p.id ? updatedProfile : x));
            if(workspaceState === 'connected' && dirHandle && p.fileName) {
              try {
                  const fh = await dirHandle.getFileHandle(p.fileName, { create: true });
                  const wr = await fh.createWritable();
                  await wr.write(JSON.stringify({...updatedProfile, updatedAt: Date.now()}));
                  await wr.close();
              } catch(e) {}
            }
          };

          const handleBatchMove = (companyName, folderName) => {
            selectedIds.forEach(id => handleMoveToFolder(id, companyName, folderName));
            setSelectedIds([]);
            showDialog('alert', 'Archivos Movidos', `Se movieron los CVs a: ${companyName} > ${folderName}`);
          };

          const handleBatchDelete = () => {
            showDialog('confirm', 'Mover a Papelera', `¿Mover ${selectedIds.length} perfiles a la papelera?`, () => {
              setProfiles(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, isDeleted: true } : p));
              // Sync disk
              selectedIds.forEach(id => {
                 const p = profiles.find(x => x.id === id);
                 if (p && workspaceState === 'connected' && dirHandle && p.fileName) {
                     const updated = { ...p, isDeleted: true };
                     dirHandle.getFileHandle(p.fileName, { create: true })
                        .then(fh => fh.createWritable())
                        .then(async wr => { await wr.write(JSON.stringify(updated)); await wr.close(); })
                        .catch(()=>{});
                 }
              });
              setSelectedIds([]);
            });
          };

          const handleDownloadZip = async (ids = selectedIds) => {
            if (typeof JSZip === 'undefined') return showDialog('alert', 'Error', 'La librería ZIP no cargó.');
            const zip = new JSZip();
            const toExport = profiles.filter(p => ids.includes(p.id));
            toExport.forEach(p => {
               zip.file(makeFileName(p.data.personal.name, p.id), JSON.stringify(p));
            });
            const content = await zip.generateAsync({type:"blob"});
            const url = URL.createObjectURL(content);
            const link = document.createElement("a");
            link.href = url; link.download = "CVs_Exportados.zip"; link.click();
            URL.revokeObjectURL(url);
            setSelectedIds([]);
            setContextMenu(null);
          };

          const handleAutoOrganize = (criterio) => {
            setShowSortModal(false);
            showDialog('confirm', 'Organización Automática', `Se crearán carpetas y se moverán todos los CVs según: ${criterio === 'profession' ? 'Profesión' : criterio === 'gender' ? 'Género' : 'Rango de Edad'}. ¿Proceder?`, async () => {
              let updatedProfiles = [...profiles];
              let newCatsFound = new Set();
              
              updatedProfiles = updatedProfiles.map(p => {
                 let newCat = 'Sin Asignar';
                 if (criterio === 'gender') newCat = p.data.personal.gender || 'No especificado';
                 if (criterio === 'age') {
                    const a = Number(p.data.personal.age);
                    if (!a) newCat = 'Edad Desconocida';
                    else if (a < 25) newCat = 'Menor de 25';
                    else if (a <= 45) newCat = '25 a 45 años';
                    else newCat = 'Mayor de 45';
                 }
                 if (criterio === 'profession') {
                    newCat = p.data.personal.title ? p.data.personal.title.split(' ')[0] : 'Sin Profesión';
                 }
                 
                 const compName = p.data.personal.company || 'Independiente';
                 const fullCat = `${compName} - ${newCat}`;
                 newCatsFound.add(fullCat);
                 
                 return {...p, data: {...p.data, personal: {...p.data.personal, category: fullCat}}};
              });
              
              setProfiles(updatedProfiles);
              setCustomFolders(prev => [...new Set([...prev, ...Array.from(newCatsFound)])]);

              if(workspaceState === 'connected' && dirHandle) {
                 for (const up of updatedProfiles) {
                     if(up.fileName) {
                         try {
                           const fh = await dirHandle.getFileHandle(up.fileName, { create: true });
                           const wr = await fh.createWritable();
                           await wr.write(JSON.stringify({...up, updatedAt: Date.now()}));
                           await wr.close();
                         } catch(e){}
                     }
                 }
              }
              showDialog('alert', 'Organización Completa', 'Los perfiles han sido distribuidos en sus nuevas carpetas.');
            });
          };

          const promptText = `Actúa como un experto en reclutamiento y extracción de datos. Te voy a entregar un currículum (texto o PDF). Conviértelo a UN SOLO JSON válido, sin perder ningún dato y sin inventar nada.

REGLAS DE ORO
1. NO INVENTES: si un dato no aparece en el CV, deja "" (o [] en las listas). Nunca completes con suposiciones, porcentajes, niveles, cargos ni fechas que no estén escritos.
2. NO PIERDAS NADA: cada dato del CV debe quedar en algún campo. Lo que no encaje en un campo específico va en "profile" (regla 3).
3. "profile" es el Perfil Profesional. Primero copia tal cual el perfil, objetivo o resumen que traiga el CV (sin resumirlo ni mejorarlo). Después, si hay datos que no caben en los demás campos, agrégalos al final, cada uno en una línea nueva con el formato "Etiqueta: dato" (separa las líneas con \\n). Etiquetas posibles: Fecha de nacimiento, Nacionalidad, Estado civil, Documento, Disponibilidad, Pretensión salarial, Carnet de conducir, Vehículo propio, Referencias, Voluntariado, Logros y premios, Publicaciones, Proyectos, Intereses y pasatiempos, Redes sociales, Otros datos. Usa las palabras del CV, sin interpretarlas.
4. Respeta el idioma y la redacción original: no traduzcas ni "mejores" textos. Solo ordena saltos de línea y viñetas.
5. Responde ÚNICAMENTE con el JSON dentro de un bloque de código, sin explicaciones antes ni después.

ESTRUCTURA EXACTA
{
  "personal": { "name": "", "title": "", "category": "", "company": "Independiente", "email": "", "phone": "", "location": "", "linkedin": "", "website": "", "languages": "", "age": "", "gender": "" },
  "profile": "",
  "skills": [ { "title": "", "text": "" } ],
  "experience": [ { "company": "", "role": "", "date": "", "tasks": "" } ],
  "education": [ { "text": "" } ],
  "certifications": [ { "text": "" } ]
}

CÓMO LLENAR CADA CAMPO
- name: nombre completo tal cual. title: el cargo o profesión que declara el CV; si no lo declara, usa el puesto más reciente tal como aparece.
- category: profesión general en 1 a 3 palabras (ej.: "Atención al Cliente"). Sirve para ordenar en carpetas. company: déjalo en "Independiente".
- email, phone, location, linkedin, website: tal cual. Si hay varios teléfonos o correos, sepáralos con " / ". Cualquier otra red o enlace va en "profile".
- languages: un idioma por línea con el formato "Idioma: Nivel" (separa con \\n), usando el nivel que diga el CV.
- age: solo el número y solo si el CV dice la edad. Si únicamente trae fecha de nacimiento, deja "" y escríbela en "profile". gender: "Femenino", "Masculino" u "Otro" solo si el CV lo indica explícitamente; si no, "".
- skills: agrupa las habilidades por tema. "title" es el nombre del grupo (por ejemplo "Herramientas" o "Habilidades blandas") y "text" el detalle completo. No agregues niveles ni porcentajes.
- experience: respeta el orden del CV. "date" tal como aparece (ej.: "2020 – Presente"). "tasks": TODAS las tareas y logros, una por línea, separadas con \\n y sin viñetas. Si no hay tareas, "". Incluye aquí pasantías y trabajos voluntarios que tengan empresa o institución y fechas.
- education: una entrada por estudio con el formato "Título o carrera | Institución (año)". Incluye secundaria y estudios en curso.
- certifications: cursos, seminarios y certificados, uno por entrada, con el formato "Curso: Nombre - Institución (año)".

ANTES DE RESPONDER: repasa el CV línea por línea y confirma que ningún dato quedó fuera ni fue inventado.

Aquí está el currículum:`;
          const handleCopyPrompt = () => {
            navigator.clipboard.writeText(promptText);
            showDialog('alert', 'Prompt Copiado', '¡Copiado al portapapeles! Ve a ChatGPT/Gemini, pega este texto y luego el CV de tu candidato.');
          };

          const handleProcessAiJson = async () => {
            const { items, errors } = parseAiInput(aiJsonInput);
            if (items.length === 0) {
              showDialog('alert', 'No se pudo importar', `${errors.length ? errors[0].msg : 'No se encontró ningún currículum en el texto.'} Revisa que hayas copiado la respuesta completa de la IA.`);
              return;
            }
            const now = Date.now();
            const newProfiles = items.map((it, i) => ({ id: uid(), data: it.data, config: normalizeConfig(null), updatedAt: now - i }));
            if (workspaceState === 'connected' && dirHandle) {
              for (const p of newProfiles) {
                try { const fileName = makeFileName(p.data.personal.name, p.id); await writeJsonFile(dirHandle, fileName, { ...p, fileName }); p.fileName = fileName; }
                catch (e) { console.warn('No se pudo guardar en la carpeta', e); }
              }
            }
            setProfiles(prev => [...newProfiles, ...prev]);
            const failed = errors.map(e => e.chunk).filter(Boolean);
            if (failed.length) setAiJsonInput(failed.join('\n\n'));
            else { setAiJsonInput(''); setShowAiModal(false); }
            showDialog('alert', 'Importación completada', `Se crearon ${items.length} currículum(s).${failed.length ? ` ${failed.length} bloque(s) no se pudieron leer y quedaron en la caja para que los revises.` : ''}`);
          };

          const handleAiFiles = async (e) => {
            const files = Array.from(e.target.files || []); e.target.value = '';
            if (!files.length) return;
            const texts = await Promise.all(files.map(f => f.text().catch(() => '')));
            setAiJsonInput(prev => [prev.trim(), ...texts.map(t => t.trim())].filter(Boolean).join('\n\n'));
          };

          const handleCloseWelcome = () => {
            localStorage.setItem('cvEliteWelcomed', 'true');
            setShowWelcome(false);
          };

          const handleBackupWorkspace = () => {
            const blob = new Blob([JSON.stringify({profiles, customFolders})], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url; link.download = "Backup_Workspace_CVCreator.json"; link.click();
            URL.revokeObjectURL(url);
          };

          // --- Efectos Generales ---
          useEffect(() => {
            if (view !== 'editor') return;
            let prev = document.title;
            const before = () => { prev = document.title; const n = (nameRef.current || '').trim(); document.title = n ? `CV - ${n}` : 'CV'; };
            const after = () => { document.title = prev; };
            window.addEventListener('beforeprint', before);
            window.addEventListener('afterprint', after);
            return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
          }, [view]);

          useEffect(() => {
            if (view !== 'editor') return;
            const el = previewRef.current; if (!el) return;
            const ro = new ResizeObserver(() => setPaneW(el.clientWidth));
            ro.observe(el); setPaneW(el.clientWidth);
            return () => ro.disconnect();
          }, [view]);

          useEffect(() => {
            if (view !== 'editor') return;
            const el = docRef.current; if (!el) return;
            const ro = new ResizeObserver(() => setDocH(el.offsetHeight));
            ro.observe(el); setDocH(el.offsetHeight);
            return () => ro.disconnect();
          }, [view]);

          useEffect(() => {
            if (view !== 'editor') return;
            if (formScrollRef.current) formScrollRef.current.scrollTo({ top: 0 });
            const btn = tabBtnRefs.current[activeTab];
            if (btn && btn.scrollIntoView) btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
          }, [activeTab, view]);

          useEffect(() => {
            const styleId = 'cv-dynamic-styles';
            let styleEl = document.getElementById(styleId);
            if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
            if (view !== 'editor') { styleEl.innerHTML = ''; return; }
            styleEl.innerHTML = `
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&family=Merriweather:wght@300;400;700&family=Montserrat:wght@300;400;600;700;800&family=Lora:wght@400;600;700&display=swap');
              :root { --cv-primary: ${config.theme.primary}; --cv-bgLeft: ${config.theme.bgLeft}; --cv-accent: ${config.theme.accent}; --cv-text: ${config.theme.text}; --cv-font: ${config.font.family}; }
              .cv-document { font-family: var(--cv-font); color: var(--cv-text); }
              .cv-title { color: var(--cv-primary); }
              .cv-border { border-color: var(--cv-primary); }
              .cv-border-accent { border-color: var(--cv-accent); }
              .cv-bg-primary { background-color: var(--cv-primary); }
              .cv-bg-left { background-color: var(--cv-bgLeft); }
              .cv-link { color: inherit; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: var(--cv-primary); }
              .cv-link-plain { color: inherit; text-decoration: none; }
              .page-break-avoid { break-inside: avoid; page-break-inside: avoid; }
              .page-break-after-avoid { break-after: avoid; page-break-after: avoid; }
              .layout-split .cv-bg-left { background-color: transparent !important; }
              @media print {
                @page { size: A4; margin: 14mm 0; }
                @page :first { margin-top: 0; }
                .cv-document li, .cv-document h4, .cv-document h3 { break-inside: avoid; page-break-inside: avoid; }
                .cv-document h3 { break-after: avoid; page-break-after: avoid; }
                .cv-document p { orphans: 3; widows: 3; }
                html:has(.layout-modern) { background: linear-gradient(to right, var(--cv-bgLeft) 35%, #ffffff 35%) !important; }
                html:has(.layout-right-sidebar) { background: linear-gradient(to left, var(--cv-bgLeft) 35%, #ffffff 35%) !important; }
                .print-hide { display: none !important; }
                .print-root { height: auto !important; min-height: 0 !important; overflow: visible !important; display: block !important; background: transparent !important; }
                .print-body { display: block !important; overflow: visible !important; }
                html, body, #root { height: auto !important; overflow: visible !important; }
                html { background: white; }
                body, #root { background: transparent !important; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .cv-document, .cv-document * { font-synthesis: none; }
                .cv-document { width: 100% !important; min-height: auto !important; box-shadow: none !important; }
                .preview-pane { display: block !important; height: auto !important; overflow: visible !important; background: transparent !important; padding: 0 !important; }
                .cv-scale-wrap { width: auto !important; height: auto !important; }
                .cv-scale-inner { transform: none !important; width: 100% !important; }
                .layout-modern, .layout-right-sidebar { background: linear-gradient(to right, var(--cv-bgLeft) 35%, white 35%) !important; }
                .layout-right-sidebar { background: linear-gradient(to left, var(--cv-bgLeft) 35%, white 35%) !important; }
                .layout-modern .cv-bg-left, .layout-right-sidebar .cv-bg-left { background-color: transparent !important; }
                .layout-split { background: white !important; }
                .layout-split > div:first-child { background-color: var(--cv-primary) !important; -webkit-print-color-adjust: exact; }
                .layout-timeline > div:first-child { -webkit-print-color-adjust: exact; }
              }
            `;
          }, [config, view]);

          // ---- Wizard Navigation ----
          const goToIndex = (i) => {
            const idx = Math.max(0, Math.min(TABS_ORDER.length - 1, i));
            if (idx === currentTabIndex) return;
            setSlideDir(idx > currentTabIndex ? 1 : -1);
            setActiveTab(TABS_ORDER[idx]);
          };
          const goNext = () => goToIndex(currentTabIndex + 1);
          const goPrev = () => goToIndex(currentTabIndex - 1);
          const goToTab = (tab) => goToIndex(TABS_ORDER.indexOf(tab));
          const onTouchStart = (e) => { const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY }; };
          const onTouchEnd = (e) => {
            const s = touchRef.current; touchRef.current = null;
            if (!s) return; const t = e.changedTouches[0];
            const dx = t.clientX - s.x, dy = t.clientY - s.y;
            const tag = (e.target.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) { dx < 0 ? goNext() : goPrev(); }
          };
          const onTabsWheel = (e) => { const el = tabsRef.current; if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY; };

          // ---- Importar / Exportar individual ----
          const handleExportProfile = () => {
            const fileData = JSON.stringify({ data, config });
            const blob = new Blob([fileData], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `CV_${(data.personal.name || 'Candidato').trim().replace(/\s+/g, '_')}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          };
          const handleImportProfile = (e) => {
            const file = e.target.files[0]; e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const imported = JSON.parse(event.target.result);
                if (imported.data) setData(normalizeData(imported.data));
                if (imported.config) setConfig(normalizeConfig(imported.config));
                showDialog('alert', 'Éxito', '¡Perfil importado exitosamente!');
              } catch (error) { showDialog('alert', 'Error', 'Error al leer el archivo. Asegúrate de que sea un .json válido.'); }
            };
            reader.readAsText(file);
          };

          // ---- Actualizadores de estado ----
          const updateData = (cat, field, val) => {
            if (cat === 'personal') setData(p => ({ ...p, personal: { ...p.personal, [field]: val } }));
            else setData(p => ({ ...p, [cat]: val }));
          };
          const updateItem = (cat, id, field, val) => setData(p => ({ ...p, [cat]: p[cat].map(i => i.id === id ? { ...i, [field]: val } : i) }));
          const addItem = (cat, newItem) => setData(p => ({ ...p, [cat]: [...p[cat], { id: Date.now(), ...newItem }] }));
          const removeItem = (cat, id) => setData(p => ({ ...p, [cat]: p[cat].filter(i => i.id !== id) }));
          const moveItem = (cat, idx, dir) => setData(p => {
            const arr = [...p[cat]];
            if (dir === 'up' && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            else if (dir === 'down' && idx < arr.length - 1) [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
            return { ...p, [cat]: arr };
          });

          const handlePhotoUpload = async (e) => {
            const file = e.target.files[0]; e.target.value = '';
            if (!file) return;
            try { const photo = await compressImage(file); setData(p => ({ ...p, photo })); } 
            catch (err) { showDialog('alert', 'Error', 'No se pudo cargar la imagen. Probá con otro archivo.'); }
          };
          const handleRemovePhoto = () => setData(p => ({ ...p, photo: null }));
          const setPhotoCfg = (patch) => setConfig(c => ({ ...c, photo: { ...c.photo, ...patch } }));

          const scale = paneW ? Math.min(1, Math.max(0.3, (paneW - 32) / DOC_W)) : 1;

          // ==========================================
          // RENDERIZADO DEL CV (MÚLTIPLES LAYOUTS)
          // ==========================================
          const renderCVLayout = () => {
            const spc = config.spacing;
            const p = data.personal;
            const ph = config.photo;
            const photoShape = PHOTO_SHAPES.find(s => s.id === ph.shape) || PHOTO_SHAPES[0];
            const photoOn = photoShape.id !== 'none';

            const ContactInfo = ({ horizontal = false }) => (
              <div className={`leading-relaxed ${spc.text} opacity-90 ${horizontal ? 'flex flex-wrap gap-x-4 gap-y-1 justify-center' : 'space-y-2'}`}>
                {p.email && <div><strong className="cv-title">Email:</strong> <a className="cv-link-plain" href={`mailto:${p.email}`}>{p.email}</a></div>}
                {p.phone && <div><strong className="cv-title">Tel:</strong> {p.phone}</div>}
                {p.location && <div><strong className="cv-title">Ubicación:</strong> {p.location}</div>}
                {p.linkedin && <div className="break-all"><strong className="cv-title">LinkedIn:</strong> <a className="cv-link" href={hrefOf(p.linkedin)} target="_blank" rel="noopener noreferrer">{prettyUrl(p.linkedin)}</a></div>}
                {p.website && <div className="break-all"><strong className="cv-title">Web:</strong> <a className="cv-link" href={hrefOf(p.website)} target="_blank" rel="noopener noreferrer">{prettyUrl(p.website)}</a></div>}
              </div>
            );
            const SkillsInfo = () => (
              <div className={`space-y-3 ${spc.text}`}>
                {data.skills.map(s => (
                  <div key={s.id} className="page-break-avoid"><strong className="block cv-title">{s.title}</strong><p className="leading-snug opacity-90">{s.text}</p></div>
                ))}
              </div>
            );
            const ExperienceInfo = () => (
              <div className={spc.gap === 'gap-2' ? 'space-y-4' : 'space-y-6'}>
                {data.experience.map(exp => (
                  <div key={exp.id} className="page-break-avoid">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold cv-title text-[110%]">{exp.company} <span className="font-normal opacity-80">| {exp.role}</span></h4>
                      <span className="text-xs font-bold opacity-70 whitespace-nowrap ml-2">{exp.date}</span>
                    </div>
                    <ul className={`list-disc pl-5 ${spc.text} leading-relaxed opacity-90 marker:text-[color:var(--cv-primary)] space-y-1`}>
                      {(exp.tasks || '').split('\n').filter(t => t.trim() !== '').map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            );
            const EducationInfo = () => (
              <div className={`space-y-4 ${spc.text} leading-relaxed opacity-90`}>
                <div className="page-break-avoid">
                  {data.education.map(e => {
                    const [head, ...rest] = (e.text || '').split('|');
                    return <p key={e.id}><strong>{head}</strong>{rest.length > 0 ? ` | ${rest.join('|').trim()}` : ''}</p>;
                  })}
                </div>
                <div className="page-break-avoid mt-4">
                  {data.certifications.map(c => {
                    const txt = c.text || '';
                    const idx = txt.indexOf(':');
                    return idx === -1
                      ? <p key={c.id}>{txt}</p>
                      : <p key={c.id}><strong>{txt.slice(0, idx)}:</strong> {txt.slice(idx + 1).trim()}</p>;
                  })}
                </div>
              </div>
            );
            const ProfileInfo = () => <p className={`whitespace-pre-line ${spc.text} text-justify opacity-90`}>{data.profile}</p>;
            const SectionTitle = ({ title, center = false }) => (
              <h3 className={`text-lg font-bold uppercase tracking-wide border-b-2 cv-border-accent cv-title pb-1 page-break-after-avoid ${spc.mb} ${center ? 'text-center' : ''}`}>{title}</h3>
            );

            const PhotoSection = ({ context = 'sidebar' }) => {
              if (!photoOn) return null;
              const w = PHOTO_WIDTHS[context][ph.size] || PHOTO_WIDTHS[context].md;
              const h = Math.round(w * photoShape.ratio);
              const border = ph.border === 'white' ? '4px solid #ffffff' : ph.border === 'theme' ? '3px solid var(--cv-primary)' : 'none';
              return (
                <div className={`relative group shrink-0 mx-auto ${data.photo ? '' : 'print:hidden'}`} style={{ width: w, height: h }}>
                  <div
                    className="w-full h-full overflow-hidden cursor-pointer flex items-center justify-center transition hover:opacity-90"
                    style={{ borderRadius: photoShape.radius, border, backgroundColor: 'var(--cv-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    title={data.photo ? 'Cambiar foto' : 'Subir foto'}
                  >
                    {data.photo ? (
                      <img src={data.photo} alt="" draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${ph.x}% ${ph.y}%`, transform: `scale(${ph.zoom / 100})`, transformOrigin: `${ph.x}% ${ph.y}%`, filter: ph.gray ? 'grayscale(1)' : 'none' }}
                      />
                    ) : (
                      <div className="text-center print:hidden flex flex-col items-center opacity-70"><IconUpload /><span className="text-[10px] font-bold mt-1">FOTO</span></div>
                    )}
                  </div>
                  {data.photo && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleRemovePhoto(); }} className="print:hidden absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition" title="Quitar foto"><IconClose /></button>
                  )}
                </div>
              );
            };

            if (config.layout.id === 'modern') return (
              <div className="flex min-h-full w-full layout-modern">
                <div className="w-[35%] px-8 py-10 flex flex-col cv-bg-left">
                  {photoOn && <div className="mb-8">{PhotoSection({ context: 'sidebar' })}</div>}
                  <SectionTitle title="Contacto" /><div className="mb-8">{ContactInfo({})}</div>
                  <SectionTitle title="Competencias" /><div className="mb-8">{SkillsInfo()}</div>
                  <SectionTitle title="Idiomas" /><div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div>
                </div>
                <div className="w-[65%] px-10 py-12 bg-white">
                  <div className="mb-8"><h1 className="text-4xl font-extrabold mb-1 tracking-tight cv-title">{p.name}</h1><h2 className="text-lg font-medium opacity-80">{p.title}</h2></div>
                  <SectionTitle title="Perfil Profesional" /><div className="mb-8">{ProfileInfo()}</div>
                  <SectionTitle title="Experiencia Laboral" /><div className="mb-8">{ExperienceInfo()}</div>
                  <SectionTitle title="Educación" /><div>{EducationInfo()}</div>
                </div>
              </div>
            );

            if (config.layout.id === 'right-sidebar') return (
              <div className="flex min-h-full w-full layout-right-sidebar">
                <div className="w-[65%] px-10 py-12 bg-white">
                  <div className="mb-8"><h1 className="text-4xl font-extrabold mb-1 tracking-tight cv-title">{p.name}</h1><h2 className="text-lg font-medium opacity-80">{p.title}</h2></div>
                  <SectionTitle title="Perfil Profesional" /><div className="mb-8">{ProfileInfo()}</div>
                  <SectionTitle title="Experiencia Laboral" /><div className="mb-8">{ExperienceInfo()}</div>
                  <SectionTitle title="Educación" /><div>{EducationInfo()}</div>
                </div>
                <div className="w-[35%] px-8 py-10 flex flex-col cv-bg-left">
                  {photoOn && <div className="mb-8">{PhotoSection({ context: 'sidebar' })}</div>}
                  <SectionTitle title="Contacto" /><div className="mb-8">{ContactInfo({})}</div>
                  <SectionTitle title="Competencias" /><div className="mb-8">{SkillsInfo()}</div>
                  <SectionTitle title="Idiomas" /><div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div>
                </div>
              </div>
            );
            
            if (config.layout.id === 'executive') return (
              <div className="flex flex-col min-h-full w-full bg-white layout-executive">
                <div className="cv-bg-left px-12 py-10 flex items-center justify-between gap-8 border-b-4 cv-border">
                  <div className="flex-1">
                    <h1 className="text-4xl font-extrabold mb-2 tracking-tight cv-title">{p.name}</h1>
                    <h2 className="text-xl font-medium opacity-80 mb-4">{p.title}</h2>
                    {ContactInfo({ horizontal: true })}
                  </div>
                  <PhotoSection context="header" />
                </div>
                <div className="flex flex-1 px-12 py-10 gap-10">
                  <div className="w-[60%] border-r cv-border-accent pr-10">
                    <SectionTitle title="Experiencia Laboral" /><div className="mb-8">{ExperienceInfo()}</div>
                    <SectionTitle title="Educación" /><div>{EducationInfo()}</div>
                  </div>
                  <div className="w-[40%]">
                    <SectionTitle title="Perfil Profesional" /><div className="mb-8">{ProfileInfo()}</div>
                    <SectionTitle title="Competencias" /><div className="mb-8">{SkillsInfo()}</div>
                    <SectionTitle title="Idiomas" /><div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div>
                  </div>
                </div>
              </div>
            );

            if (config.layout.id === 'classic') return (
              <div className="flex flex-col min-h-full w-full bg-white px-16 py-12 layout-classic">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-extrabold mb-2 tracking-tight cv-title">{p.name}</h1>
                  <h2 className="text-xl font-medium opacity-80 mb-4">{p.title}</h2>
                  <div className="flex justify-center">{ContactInfo({ horizontal: true })}</div>
                </div>
                <div className="space-y-6">
                  <div><SectionTitle title="Perfil Profesional" />{ProfileInfo()}</div>
                  <div><SectionTitle title="Experiencia Laboral" />{ExperienceInfo()}</div>
                  <div className="grid grid-cols-2 gap-8">
                    <div><SectionTitle title="Competencias" />{SkillsInfo()}</div>
                    <div><SectionTitle title="Educación" />{EducationInfo()}<br/><SectionTitle title="Idiomas" /><div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div></div>
                  </div>
                </div>
              </div>
            );

            if (config.layout.id === 'harvard') return (
              <div className="flex flex-col min-h-full w-full bg-white px-16 py-12 layout-harvard" style={{ fontFamily: "'Merriweather', serif" }}>
                <div className="text-center mb-6 border-b-2 cv-border pb-4">
                  <h1 className="text-3xl font-bold mb-1 cv-title uppercase">{p.name}</h1>
                  {ContactInfo({ horizontal: true })}
                </div>
                <div className="space-y-6">
                  <div><SectionTitle title="Perfil Profesional" center={true} />{ProfileInfo()}</div>
                  <div><SectionTitle title="Experiencia Laboral" center={true} />{ExperienceInfo()}</div>
                  <div><SectionTitle title="Educación y Certificaciones" center={true} />{EducationInfo()}</div>
                  <div className="grid grid-cols-2 gap-8 pt-4">
                    <div><SectionTitle title="Competencias Técnicas" center={true} />{SkillsInfo()}</div>
                    <div><SectionTitle title="Idiomas" center={true} /><div className={`whitespace-pre-line opacity-90 ${spc.text} text-center`}>{p.languages}</div></div>
                  </div>
                </div>
              </div>
            );

            // 6. CREATIVO (Cabecera Color Full Width)
            if (config.layout.id === 'creative') return (
              <div className="flex flex-col min-h-full w-full bg-white layout-creative">
                <div className="cv-bg-primary text-white px-12 py-12 flex flex-col items-center text-center">
                  {photoOn && <div className="mb-6">{PhotoSection({ context: 'header' })}</div>}
                  <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-white">{p.name}</h1>
                  <h2 className="text-xl font-medium opacity-90 mb-6">{p.title}</h2>
                  <div className="text-white opacity-80">{ContactInfo({ horizontal: true })}</div>
                </div>
                <div className="flex flex-1 px-12 py-10 gap-10">
                  <div className="w-[60%] pr-6">
                    <SectionTitle title="Experiencia Laboral" /><div className="mb-8">{ExperienceInfo()}</div>
                    <SectionTitle title="Educación" /><div>{EducationInfo()}</div>
                  </div>
                  <div className="w-[40%] bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <SectionTitle title="Perfil Profesional" /><div className="mb-8">{ProfileInfo()}</div>
                    <SectionTitle title="Competencias" /><div className="mb-8">{SkillsInfo()}</div>
                    <SectionTitle title="Idiomas" /><div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div>
                  </div>
                </div>
              </div>
            );

            // 7. TIMELINE PRO
            if (config.layout.id === 'timeline') {
              return (
                <div className="flex flex-col min-h-full w-full bg-white layout-timeline">
                  <div className="relative px-12 pt-12 pb-10 overflow-hidden" style={{ background: `linear-gradient(135deg, var(--cv-primary) 0%, var(--cv-bgLeft) 100%)` }}>
                    <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />
                    <div className="absolute -left-8 bottom-0 w-32 h-32 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />
                    <div className="relative flex items-center gap-8">
                      {photoOn && <div className="shrink-0"><PhotoSection context="header" /></div>}
                      <div className="flex-1">
                        <h1 className="text-5xl font-extrabold mb-2 tracking-tight" style={{ color: 'white' }}>{p.name}</h1>
                        <h2 className="text-xl font-medium mb-4" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.title}</h2>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {p.email && <span>✉ {p.email}</span>}
                          {p.phone && <span>📱 {p.phone}</span>}
                          {p.location && <span>📍 {p.location}</span>}
                          {p.website && <span>🌐 {prettyUrl(p.website)}</span>}
                          {p.linkedin && <a href={hrefOf(p.linkedin)} className="underline" target="_blank" rel="noopener noreferrer">in {prettyUrl(p.linkedin)}</a>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 px-12 py-10 gap-10">
                    <div className="w-[35%]">
                      <SectionTitle title="Perfil" />
                      <p className={`whitespace-pre-line ${spc.text} text-justify opacity-90 mb-8`}>{data.profile}</p>

                      <SectionTitle title="Habilidades" />
                      <div className={`space-y-3 mb-8 ${spc.text}`}>{data.skills.map(s => (<div key={s.id} className="page-break-avoid"><strong className="block cv-title">{s.title}</strong><p className="leading-snug opacity-90">{s.text}</p></div>))}</div>

                      <SectionTitle title="Idiomas" />
                      <div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div>
                      {data.certifications.length > 0 && (
                        <>
                          <div className="mt-8"><SectionTitle title="Certificaciones" /></div>
                          <div className={`space-y-1 ${spc.text} opacity-90`}>{data.certifications.map(c => <p key={c.id} className="page-break-avoid">{c.text}</p>)}</div>
                        </>
                      )}
                    </div>

                    <div className="w-[65%]">
                      <SectionTitle title="Experiencia" />
                      <div className="relative pl-8 mb-8">
                        <div className="absolute left-2 top-2 bottom-2 w-0.5" style={{ backgroundColor: 'var(--cv-accent)' }} />
                        {data.experience.map(exp => (
                          <div key={exp.id} className="relative mb-6 page-break-avoid">
                            <div className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow" style={{ backgroundColor: 'var(--cv-primary)' }} />
                            <div className="text-xs font-bold opacity-70 mb-1">{exp.date}</div>
                            <h4 className="font-bold cv-title text-[105%] mb-0.5">{exp.role}</h4>
                            <div className="text-sm font-medium opacity-80 mb-2">{exp.company}</div>
                            <ul className={`list-disc pl-4 ${spc.text} leading-relaxed opacity-90 space-y-0.5`}>
                              {(exp.tasks || '').split('\n').filter(t => t.trim() !== '').map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>

                      <SectionTitle title="Educación" />
                      <div className="relative pl-8">
                        <div className="absolute left-2 top-2 bottom-2 w-0.5" style={{ backgroundColor: 'var(--cv-accent)' }} />
                        {data.education.map(e => {
                          const [head, ...rest] = (e.text || '').split('|');
                          return (
                            <div key={e.id} className="relative mb-3 page-break-avoid">
                              <div className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow" style={{ backgroundColor: 'var(--cv-primary)' }} />
                              <p className={spc.text}><strong className="cv-title">{head}</strong>{rest.length > 0 ? ` | ${rest.join('|').trim()}` : ''}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // 8. SPLIT COLOR
            if (config.layout.id === 'split') {
              return (
                <div className="flex min-h-full w-full layout-split">
                  <div className="w-[38%] flex flex-col" style={{ backgroundColor: 'var(--cv-primary)' }}>
                    <div className="p-8 flex flex-col items-center text-center" style={{ color: 'white' }}>
                      {photoOn && <div className="mb-6"><PhotoSection context="sidebar" /></div>}
                      <h1 className="text-2xl font-extrabold leading-tight mb-1">{p.name}</h1>
                      <h2 className="text-sm font-medium opacity-90">{p.title}</h2>
                    </div>
                    <div className="flex-1 px-8 pb-8 space-y-6" style={{ color: 'rgba(255,255,255,0.92)' }}>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-3 pb-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>Contacto</h3>
                        <div className={`space-y-1.5 ${spc.text}`}>
                          {p.email && <div className="break-all">✉ {p.email}</div>}
                          {p.phone && <div>📱 {p.phone}</div>}
                          {p.location && <div>📍 {p.location}</div>}
                          {p.linkedin && <div className="break-all">in {prettyUrl(p.linkedin)}</div>}
                          {p.website && <div className="break-all">🌐 {prettyUrl(p.website)}</div>}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-3 pb-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>Habilidades</h3>
                        <div className={`space-y-2 ${spc.text}`}>
                          {data.skills.map(s => (
                            <div key={s.id}>
                              <div className="font-bold text-xs">{s.title}</div>
                              <div className="opacity-80 text-[11px] leading-snug">{s.text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-3 pb-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>Idiomas</h3>
                        <div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div>
                      </div>
                    </div>
                  </div>

                  <div className="w-[62%] bg-white px-10 py-10">
                    <div className="mb-6">
                      <SectionTitle title="Perfil Profesional" />
                      <p className={`whitespace-pre-line ${spc.text} text-justify opacity-90`}>{data.profile}</p>
                    </div>
                    <SectionTitle title="Experiencia" />
                    <div className="mb-6">
                      {data.experience.map(exp => (
                        <div key={exp.id} className="mb-5 page-break-avoid">
                          <div className="flex justify-between items-baseline">
                            <h4 className="font-bold cv-title text-[105%]">{exp.role}</h4>
                            <span className="text-xs font-bold opacity-70">{exp.date}</span>
                          </div>
                          <div className="text-sm font-medium opacity-80 mb-1.5">{exp.company}</div>
                          <ul className={`list-disc pl-5 ${spc.text} leading-relaxed opacity-90 space-y-0.5`}>
                            {(exp.tasks || '').split('\n').filter(t => t.trim() !== '').map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <SectionTitle title="Educación" />
                    <div className={`space-y-2 ${spc.text} mb-6`}>
                      {data.education.map(e => {
                        const [head, ...rest] = (e.text || '').split('|');
                        return <p key={e.id}><strong className="cv-title">{head}</strong>{rest.length > 0 ? ` | ${rest.join('|').trim()}` : ''}</p>;
                      })}
                    </div>
                    {data.certifications.length > 0 && (
                      <>
                        <SectionTitle title="Certificaciones" />
                        <div className={`space-y-1 ${spc.text}`}>
                          {data.certifications.map(c => <p key={c.id}>{c.text}</p>)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            // 9. MINIMAL CHIC
            if (config.layout.id === 'minimalchic') {
              return (
                <div className="flex flex-col min-h-full w-full bg-white px-16 py-14 layout-minimalchic">
                  <div className="text-center mb-10 pb-8 border-b" style={{ borderColor: 'var(--cv-accent)' }}>
                    {photoOn && <div className="mb-6 flex justify-center">{PhotoSection({ context: 'header' })}</div>}
                    <h1 className="text-5xl font-light tracking-[0.15em] mb-3 cv-title uppercase">{p.name}</h1>
                    <div className="w-16 h-px mx-auto mb-4" style={{ backgroundColor: 'var(--cv-primary)' }} />
                    <h2 className="text-base font-medium tracking-[0.25em] uppercase opacity-70">{p.title}</h2>
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-5 text-xs opacity-70">
                      {p.email && <span>{p.email}</span>}
                      {p.phone && <span>· {p.phone}</span>}
                      {p.location && <span>· {p.location}</span>}
                      {p.linkedin && <span>· {prettyUrl(p.linkedin)}</span>}
                    </div>
                  </div>

                  <div className="mb-10">
                    <p className={`whitespace-pre-line ${spc.text} text-center leading-relaxed opacity-80 max-w-2xl mx-auto italic`}>{data.profile}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-10">
                    <div className="col-span-2 space-y-8">
                      <div>
                        <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4 cv-title">Experiencia</h3>
                        {data.experience.map(exp => (
                          <div key={exp.id} className="mb-5 page-break-avoid">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <h4 className="font-bold text-[105%]">{exp.role}</h4>
                              <span className="text-xs opacity-60">{exp.date}</span>
                            </div>
                            <div className="text-xs uppercase tracking-wider opacity-60 mb-2">{exp.company}</div>
                            <ul className={`list-disc pl-4 ${spc.text} leading-relaxed opacity-85 space-y-0.5`}>
                              {(exp.tasks || '').split('\n').filter(t => t.trim() !== '').map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4 cv-title">Educación</h3>
                        <div className={`space-y-2 ${spc.text}`}>
                          {data.education.map(e => {
                            const [head, ...rest] = (e.text || '').split('|');
                            return <p key={e.id}><strong>{head}</strong>{rest.length > 0 ? ` — ${rest.join('|').trim()}` : ''}</p>;
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-1 space-y-8">
                      <div>
                        <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4 cv-title">Habilidades</h3>
                        <div className={`space-y-3 ${spc.text}`}>
                          {data.skills.map(s => (
                            <div key={s.id}>
                              <div className="font-bold text-xs mb-0.5">{s.title}</div>
                              <div className="opacity-70 text-[11px] leading-snug">{s.text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4 cv-title">Idiomas</h3>
                        <div className={`whitespace-pre-line opacity-80 ${spc.text}`}>{p.languages}</div>
                      </div>
                      {data.certifications.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4 cv-title">Certificaciones</h3>
                          <div className={`space-y-1 opacity-80 ${spc.text}`}>
                            {data.certifications.map(c => <p key={c.id}>{c.text}</p>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // 10. BOLD HEADER
            if (config.layout.id === 'boldheader') {
              return (
                <div className="flex flex-col min-h-full w-full bg-white layout-boldheader">
                  <div className="relative px-12 pt-14 pb-12 overflow-hidden" style={{ backgroundColor: 'var(--cv-bgLeft)' }}>
                    <div className="absolute right-0 top-0 w-1/3 h-full opacity-20" style={{ background: 'linear-gradient(135deg, transparent 0%, var(--cv-primary) 100%)' }} />
                    <div className="relative">
                      <div className="flex items-center gap-8 mb-6">
                        {photoOn && <div className="shrink-0"><PhotoSection context="header" /></div>}
                        <div className="flex-1">
                          <h1 className="text-6xl font-black tracking-tighter leading-none mb-2 cv-title">{p.name}</h1>
                          <h2 className="text-2xl font-light opacity-80">{p.title}</h2>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {p.email && <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--cv-primary)', color: 'white' }}>✉ {p.email}</span>}
                        {p.phone && <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--cv-primary)', color: 'white' }}>📱 {p.phone}</span>}
                        {p.location && <span className="px-3 py-1.5 rounded-full text-xs font-medium border" style={{ borderColor: 'var(--cv-primary)', color: 'var(--cv-primary)' }}>📍 {p.location}</span>}
                        {p.linkedin && <span className="px-3 py-1.5 rounded-full text-xs font-medium border" style={{ borderColor: 'var(--cv-primary)', color: 'var(--cv-primary)' }}>in {prettyUrl(p.linkedin)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="px-12 py-6 border-b" style={{ borderColor: 'var(--cv-accent)' }}>
                    <div className="flex flex-wrap gap-2">
                      {data.skills.map(s => (
                        <span key={s.id} className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--cv-accent)', color: 'var(--cv-primary)' }}>
                          {s.title}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-1 px-12 py-10 gap-10">
                    <div className="w-[62%]">
                      <SectionTitle title="Perfil Profesional" />
                      <p className={`whitespace-pre-line ${spc.text} text-justify opacity-90 mb-8`}>{data.profile}</p>

                      <SectionTitle title="Experiencia" />
                      {data.experience.map(exp => (
                        <div key={exp.id} className="mb-5 page-break-avoid">
                          <div className="flex justify-between items-baseline mb-1">
                            <h4 className="font-bold cv-title text-[110%]">{exp.role}</h4>
                            <span className="text-xs font-bold opacity-70 whitespace-nowrap ml-2">{exp.date}</span>
                          </div>
                          <div className="text-sm font-medium opacity-80 mb-2">{exp.company}</div>
                          <ul className={`list-disc pl-5 ${spc.text} leading-relaxed opacity-90 space-y-0.5`}>
                            {(exp.tasks || '').split('\n').filter(t => t.trim() !== '').map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="w-[38%] pl-6 border-l" style={{ borderColor: 'var(--cv-accent)' }}>
                      <SectionTitle title="Educación" />
                      <div className={`space-y-2 ${spc.text} mb-8`}>
                        {data.education.map(e => {
                          const [head, ...rest] = (e.text || '').split('|');
                          return <p key={e.id}><strong className="cv-title">{head}</strong>{rest.length > 0 ? <><br/><span className="opacity-70 text-[90%]">{rest.join('|').trim()}</span></> : null}</p>;
                        })}
                      </div>
                      {data.certifications.length > 0 && (
                        <>
                          <SectionTitle title="Certificaciones" />
                          <div className={`space-y-1 ${spc.text} mb-8`}>
                            {data.certifications.map(c => <p key={c.id}>{c.text}</p>)}
                          </div>
                        </>
                      )}
                      <SectionTitle title="Idiomas" />
                      <div className={`whitespace-pre-line opacity-90 ${spc.text}`}>{p.languages}</div>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          };

          // ==========================================
          // VISTAS DEL DASHBOARD (Directorio y Analíticas)
          // ==========================================
          const dialogLayer = dialog ? (
            <div className="fixed inset-0 bg-slate-900/50 z-[250] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                <h3 className="font-bold text-lg mb-2 text-slate-800">{dialog.title}</h3>
                <p className="text-sm text-slate-600 mb-6">{dialog.msg}</p>
                <div className="flex justify-end gap-3">
                  {dialog.type === 'confirm' && (
                    <button onClick={() => setDialog(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded">Cancelar</button>
                  )}
                  <button onClick={() => { const cb = dialog.onConfirm; setDialog(null); if (cb) cb(); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded shadow-sm">
                    {dialog.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
                  </button>
                </div>
              </div>
            </div>
          ) : null;

          if (view === 'dashboard' || view === 'analytics') {
            const dynamicCategories = profiles.map(p => (p.data.personal.category || '').trim()).filter(c => c !== '');
            const allCategories = [...new Set([...customFolders, ...dynamicCategories])].filter(x => typeof x === 'string' && x);
            
            const dynamicCompanies = profiles.map(p => (p.data.personal.company || '').trim()).filter(c => c !== '');
            const allCompanies = [...new Set([...customCompanies, ...dynamicCompanies])].filter(x => typeof x === 'string' && x);

            const filtered = profiles.filter(p => {
              if (isTrashMode) {
                 if (!p.isDeleted) return false;
              } else {
                 if (p.isDeleted) return false;
              }

              const d = p.data.personal;
              const matchText = (d.name + ' ' + d.title).toLowerCase().includes(searchTerm.toLowerCase());
              const matchCat = activeFolder === 'Todas' || (d.category || 'Sin Asignar') === activeFolder;
              const matchComp = activeCompany === 'Todas' || (d.company || 'Independiente') === activeCompany;
              
              const advRole = advFilters.role ? (d.title || '').toLowerCase().includes(advFilters.role.toLowerCase()) : true;
              const advLoc = advFilters.location ? (d.location || '').toLowerCase().includes(advFilters.location.toLowerCase()) : true;
              
              let advAge = true;
              if (advFilters.minAge || advFilters.maxAge) {
                  const age = Number(d.age);
                  if (!age) advAge = false;
                  else {
                      if (advFilters.minAge && age < Number(advFilters.minAge)) advAge = false;
                      if (advFilters.maxAge && age > Number(advFilters.maxAge)) advAge = false;
                  }
              }

              return matchText && matchCat && matchComp && advRole && advLoc && advAge;
            });

            return (
              <div className="app-shell min-h-screen bg-slate-100 flex flex-col overflow-auto relative">
                
                {dialogLayer}
                
                {/* Menú contextual de empresas y carpetas */}
                {nodeMenu && (() => {
                  const { kind, name, x, y } = nodeMenu;
                  const isCo = kind === 'company';
                  const locked = name === 'Independiente' || name === 'Sin Asignar';
                  const n = liveCount(pr => isCo ? (pr.company || 'Independiente') === name : (pr.category || 'Sin Asignar') === name);
                  const comp = isCo ? name : (folderCompany(name) || (activeCompany !== 'Todas' ? activeCompany : 'Independiente'));
                  const go = (fn) => () => { setNodeMenu(null); fn(); };
                  return (
                    <div className="cv-menu cv-pop fixed bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 w-64 z-[240]" style={{ top: Math.max(8, Math.min(y, window.innerHeight - 400)), left: Math.max(8, Math.min(x, window.innerWidth - 270)) }} onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
                      <div className="px-3 pt-1.5 pb-2 mb-1 text-xs text-slate-500 border-b border-slate-100 truncate">{isCo ? '🏢' : '📁'} <b className="text-slate-800">{isCo ? name : shortOf(name)}</b> ({n} CV)</div>
                      <MenuBtn icon="👁️" label="Ver sus CVs" onClick={go(() => { if (isCo) { setActiveCompany(name); setActiveFolder('Todas'); } else setActiveFolder(name); })} />
                      <MenuBtn icon="➕" label="Nuevo CV aquí" onClick={go(() => handleCreateNew(comp, isCo ? 'Sin Asignar' : name))} />
                      {isCo && <MenuBtn icon="📁" label="Nueva carpeta" onClick={go(() => handleAddFolder(name))} />}
                      {!locked && <div className="border-t border-slate-100 my-1"></div>}
                      {!locked && <MenuBtn icon="✏️" label="Renombrar" onClick={go(() => isCo ? handleRenameCompany(name) : handleRenameFolder(name))} />}
                      {!locked && isCo && <MenuBtn icon="🔀" label="Fusionar con otra empresa…" onClick={go(() => setPickModal({ title: `Fusionar «${name}» con…`, hint: 'Todos sus CVs y carpetas pasarán a la empresa que elijas.', options: companiesNow().filter(c => c !== name).map(c => ({ value: c, label: c })), onPick: v => handleMergeCompany(name, v) }))} />}
                      {!locked && !isCo && <MenuBtn icon="📦" label="Mover a otra empresa…" onClick={go(() => setPickModal({ title: `Mover «${shortOf(name)}» a…`, hint: 'La carpeta y sus CVs pasarán a la empresa elegida.', options: companiesNow().filter(c => c !== folderCompany(name)).map(c => ({ value: c, label: c })), onPick: v => handleMoveFolder(name, v) }))} />}
                      <div className="border-t border-slate-100 my-1"></div>
                      <MenuBtn icon="📊" label="Exportar a Excel" onClick={go(() => exportNode(kind, name, false))} />
                      <MenuBtn icon="🗜️" label="Descargar ZIP (JSON)" onClick={go(() => exportNode(kind, name, true))} />
                      {!locked && <div className="border-t border-slate-100 my-1"></div>}
                      {!locked && <MenuBtn danger icon="🗑️" label={isCo ? 'Eliminar empresa' : 'Eliminar carpeta'} onClick={go(() => isCo ? handleDeleteCompany(name) : handleDeleteFolder(name))} />}
                    </div>
                  );
                })()}

                {/* Modal de nombre (reemplaza a window.prompt) */}
                {nameModal && (
                  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[260] flex items-center justify-center p-4" onClick={() => setNameModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 cv-pop" onClick={e => e.stopPropagation()}>
                      <h3 className="font-bold text-lg text-slate-800 mb-4">{nameModal.title}</h3>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{nameModal.label}</label>
                      <input autoFocus value={nameModal.value} onFocus={e => e.target.select()} onChange={e => { setNameError(''); setNameModal(m => ({ ...m, value: e.target.value })); }} onKeyDown={e => { if (e.key === 'Enter') submitName(); }} className={`w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 ${nameError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-300'}`} />
                      {nameError && <p className="text-xs text-red-600 mt-1.5">{nameError}</p>}
                      <div className="flex justify-end gap-2 mt-5">
                        <button onClick={() => setNameModal(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg">Cancelar</button>
                        <button onClick={submitName} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm">{nameModal.okText}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selector de destino (fusionar / mover carpeta) */}
                {pickModal && (
                  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[260] flex items-center justify-center p-4" onClick={() => setPickModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 cv-pop" onClick={e => e.stopPropagation()}>
                      <h3 className="font-bold text-lg text-slate-800">{pickModal.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-4">{pickModal.hint}</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {pickModal.options.length === 0 && <p className="text-sm text-slate-500 py-3">No hay otras empresas. Crea una con «+ Nueva» en la barra lateral.</p>}
                        {pickModal.options.map(o => (
                          <button key={o.value} onClick={() => { const cb = pickModal.onPick; setPickModal(null); cb(o.value); }} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200">🏢 {o.label}</button>
                        ))}
                      </div>
                      <div className="flex justify-end mt-4"><button onClick={() => setPickModal(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg">Cancelar</button></div>
                    </div>
                  </div>
                )}

                {toast && (
                  <div className="fixed bottom-6 inset-x-0 flex justify-center pointer-events-none z-[300]">
                    <div role="status" className={`cv-toast px-4 py-2.5 rounded-xl shadow-2xl text-sm font-semibold max-w-[90vw] ${toast.kind === 'warn' ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{toast.kind === 'warn' ? '⚠ ' : '✓ '}{toast.msg}</div>
                  </div>
                )}

                {/* Modal Mover CV */}
                {showMoveModal && (() => {
                  const opts = ['Sin Asignar', ...allCategories.filter(c => c !== 'Sin Asignar' && c.startsWith(moveSel.comp + ' - '))];
                  return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[250] flex items-center justify-center p-4" onClick={() => setShowMoveModal(null)}>
                      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 cv-pop" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4 text-slate-800">Mover currículum</h3>
                        <div className="space-y-4 mb-6">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa / Sucursal</label>
                            <select value={moveSel.comp} onChange={e => setMoveSel({ comp: e.target.value, cat: 'Sin Asignar' })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm">
                              {[...allCompanies.filter(c => c !== 'Independiente'), 'Independiente'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Carpeta</label>
                            <select value={opts.includes(moveSel.cat) ? moveSel.cat : 'Sin Asignar'} onChange={e => setMoveSel(m => ({ ...m, cat: e.target.value }))} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm">
                              {opts.map(c => <option key={c} value={c}>{shortOf(c)}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowMoveModal(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg">Cancelar</button>
                          <button onClick={() => { const id = showMoveModal; handleMoveToFolder(id, moveSel.comp, opts.includes(moveSel.cat) ? moveSel.cat : 'Sin Asignar'); setShowMoveModal(null); showToast('Currículum movido'); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm">Mover</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* MODAL DE BIENVENIDA / ONBOARDING */}
                {showWelcome && (
                  <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl relative">
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Bienvenido a CV Creator Elite! 🚀</h2>
                      <p className="text-gray-600 mb-6 text-sm">Tu nuevo CRM de Reclutamiento Local.</p>
                      
                      <div className="space-y-4 mb-8">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><IconFolder /></div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-800">Tus datos están seguros en tu navegador</h4>
                            <p className="text-xs text-gray-500">No necesitas conectarte a una base de datos externa. Toda la información de tus CVs se guarda automáticamente aquí en tu navegador (LocalStorage). <strong>No perderás nada al actualizar la página.</strong></p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><IconDownload /></div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-800">Elige dónde guardar tus CVs</h4>
                            <p className="text-xs text-gray-500">Pulsa «Elegir carpeta de guardado» arriba y selecciona una carpeta de tu computadora (ej: «Mis Candidatos CV»). Desde ahí, cada CV se guarda automáticamente como archivo.</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end border-t pt-4">
                        <button onClick={handleCloseWelcome} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow transition">
                          Comenzar a usar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL DE IMPORTACIÓN CON IA */}
                {showAiModal && (
                  <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-6 flex flex-col max-h-[90vh]">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">🤖 Importar CV con Inteligencia Artificial</h2>
                        <button onClick={() => setShowAiModal(false)} className="text-gray-400 hover:text-gray-600"><IconClose /></button>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 shrink-0">
                        <p className="text-sm text-blue-900 font-bold mb-2">Pasos para importar (100% Gratis):</p>
                        <ol className="list-decimal pl-5 text-xs text-blue-800 space-y-1">
                          <li>Haz clic en "Copiar Prompt" para llevarte las instrucciones en memoria.</li>
                          <li>Abre <strong>ChatGPT, Gemini o Claude</strong> en otra pestaña.</li>
                          <li>Pega el prompt y justo abajo pega todo el texto o el PDF del currículum que te enviaron.</li>
                          <li>Copia el bloque de código (JSON) que te devuelva la IA y pégalo en la caja de abajo.</li>
                          <li><strong>¿Varios currículums?</strong> Pega todas las respuestas una debajo de otra (o súbelas como archivos): la app detecta y separa cada candidato.</li>
                        </ol>
                        <button onClick={handleCopyPrompt} className="mt-3 bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 font-bold py-1.5 px-4 rounded text-xs shadow-sm transition">
                          📋 1. Copiar Prompt a Portapapeles
                        </button>
                      </div>

                      <div className="flex-1 flex flex-col min-h-[150px]">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <label className="font-bold text-xs text-gray-700">2. Pega aquí la respuesta (JSON) de la IA — puedes pegar varias:</label>
                          <div className="flex gap-2">
                            <button onClick={() => aiFilesRef.current && aiFilesRef.current.click()} className="text-[11px] font-bold px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">📎 Subir archivos (.json / .txt)</button>
                            <button onClick={() => setAiJsonInput('')} disabled={!aiJsonInput} className="text-[11px] font-bold px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40">🗑️ Borrar texto</button>
                          </div>
                          <input type="file" ref={aiFilesRef} multiple accept=".json,.txt,application/json,text/plain" className="hidden" onChange={handleAiFiles} />
                        </div>
                        <textarea 
                          className="w-full flex-1 min-h-[140px] p-3 border border-gray-300 rounded bg-slate-50 text-xs font-mono resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder='{ "data": { ... } }  — o varios bloques, o un arreglo [ {...}, {...} ]'
                          value={aiJsonInput}
                          onChange={e => setAiJsonInput(e.target.value)}
                        ></textarea>

                        {aiJsonInput.trim() && (
                          <div className="mt-2 text-xs space-y-1 max-h-28 overflow-y-auto">
                            {aiParse.items.length > 0 && (
                              <p className="text-emerald-700 font-bold">✅ {aiParse.items.length} currículum(s) detectado(s): <span className="font-normal">{aiParse.items.slice(0, 6).map(it => it.data.personal.name || 'Sin nombre').join(', ')}{aiParse.items.length > 6 ? '…' : ''}</span></p>
                            )}
                            {aiParse.items.some(it => it.note) && (
                              <p className="text-amber-700">⚠ Alguno estaba incompleto (la IA cortó la respuesta): se recuperó lo disponible. Revísalo después.</p>
                            )}
                            {aiParse.errors.map((er, i) => <p key={i} className="text-red-600">❌ {er.msg}</p>)}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 mt-4 pt-4 border-t shrink-0">
                        <button onClick={() => setShowAiModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                        <button onClick={handleProcessAiJson} disabled={aiParse.items.length === 0} className="px-4 py-2 font-bold text-sm bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition">
                          {aiParse.items.length > 1 ? `Importar ${aiParse.items.length} currículums` : 'Procesar e Importar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cabecera */}
                <header className="bg-slate-950 text-white px-6 md:px-8 py-4 flex flex-col lg:flex-row justify-between items-center gap-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-slate-950 font-extrabold text-lg shadow-lg">CV</div>
                    <div>
                      <h1 className="text-xl font-extrabold tracking-tight leading-tight">CV Creator Elite</h1>
                      <p className="text-xs text-slate-400">Gestión de Reclutamiento ATSSSSS</p>
                    </div>
                  </div>
                  <nav className="flex bg-white/5 p-1 rounded-xl">
                    <button onClick={()=>{setView('dashboard'); setIsTrashMode(false);}} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${view === 'dashboard' && !isTrashMode ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                      <span className="flex items-center gap-2"><IconFolder /> Directorio</span>
                    </button>
                    <button onClick={()=>{setView('analytics'); setIsTrashMode(false);}} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${view === 'analytics' && !isTrashMode ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                      <span className="flex items-center gap-2"><IconBarChart /> Analíticas</span>
                    </button>
                    <button onClick={()=>{setView('dashboard'); setIsTrashMode(true);}} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${isTrashMode ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-red-400'}`}>
                      <span className="flex items-center gap-2"><IconTrash /> Papelera</span>
                    </button>
                  </nav>
                </header>

                {/* Estado de la carpeta de guardado */}
                {workspaceState === 'connected' ? (
                  <div className="bg-emerald-950 text-emerald-50 px-6 md:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-emerald-900">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${saveError ? 'bg-red-400' : 'bg-emerald-400 cv-dot'}`}></span>
                    <p className="text-sm flex-1 min-w-[240px]"><b>{saveError ? 'No se pudo guardar en la carpeta.' : isSaving ? 'Guardando…' : 'Guardado automático activo'}</b>{' '}{saveError ? 'Comprueba que la carpeta siga disponible y pulsa Sincronizar.' : `en «${dirName}». Cada CV nuevo y cada cambio se guardan solos, sin pulsar Guardar.`}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={handleSyncNow} disabled={isSyncing} className="bg-white/10 hover:bg-white/20 disabled:opacity-60 text-xs font-bold px-3 py-1.5 rounded-lg transition">{isSyncing ? 'Sincronizando…' : '↻ Sincronizar'}</button>
                      <button onClick={handleSelectWorkspace} className="bg-white/10 hover:bg-white/20 text-xs font-bold px-3 py-1.5 rounded-lg transition">Cambiar carpeta</button>
                      <button onClick={handleDisconnectWorkspace} className="text-emerald-200 hover:text-white text-xs underline px-1">Desconectar</button>
                    </div>
                  </div>
                ) : workspaceState === 'pending' ? (
                  <div className="bg-amber-100 text-amber-950 px-6 md:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-300">
                    <p className="text-sm flex-1 min-w-[240px]"><b>Falta tu permiso para «{dirName}».</b> El navegador lo pide cada vez que reabres la app. Pulsa Reconectar y elige «Permitir» para seguir guardando automáticamente.</p>
                    <div className="flex items-center gap-3">
                      <button onClick={handleReconnectWorkspace} disabled={isSyncing} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-lg shadow transition">{isSyncing ? 'Conectando…' : 'Reconectar'}</button>
                      <button onClick={handleSelectWorkspace} className="text-amber-900 hover:underline text-xs font-semibold">Elegir otra carpeta</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 md:px-8 py-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0 text-xl">📁</div>
                    <div className="flex-1">
                      <p className="font-bold">Elige dónde guardar tus CVs</p>
                      <p className="text-sm text-blue-100 max-w-2xl">Selecciona una carpeta de tu computadora (por ejemplo «Mis Candidatos»). Cada CV que crees se guardará allí solo, como archivo. Hasta entonces se guardan únicamente en este navegador. Funciona en Chrome y Edge.</p>
                    </div>
                    <button onClick={handleSelectWorkspace} className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-5 py-2.5 rounded-lg shadow whitespace-nowrap transition">Elegir carpeta de guardado</button>
                  </div>
                )}

                {view === 'analytics' ? (
                  // --- VISTA DE ANALÍTICAS (KPIs) ---
                  <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full animate-fade-in space-y-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-slate-800">Métricas del Inventario</h2>
                      <button onClick={() => handleExportExcel(profiles)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition">
                        <IconExcel /> Exportar Toda la Base (CSV/Excel)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between">
                        <div><p className="text-sm text-gray-500 font-bold mb-1">Total de Candidatos</p><p className="text-4xl font-extrabold text-blue-600">{profiles.filter(p=>!p.isDeleted).length}</p></div>
                        <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex justify-center items-center"><IconUsers /></div>
                      </div>
                      <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between">
                        <div><p className="text-sm text-gray-500 font-bold mb-1">Promedio de Edad</p><p className="text-4xl font-extrabold text-purple-600">
                          {profiles.filter(p => p.data.personal.age && !p.isDeleted).length > 0 
                            ? Math.round(profiles.filter(p => p.data.personal.age && !p.isDeleted).reduce((acc, p) => acc + Number(p.data.personal.age), 0) / profiles.filter(p => p.data.personal.age && !p.isDeleted).length) 
                            : '--'}
                        </p></div>
                        <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-full flex justify-center items-center text-xl font-bold">A</div>
                      </div>
                      <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between">
                        <div><p className="text-sm text-gray-500 font-bold mb-1">Carpetas Activas</p><p className="text-4xl font-extrabold text-emerald-600">{allCategories.length}</p></div>
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex justify-center items-center"><IconFolder /></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-bold text-gray-700 mb-4">Distribución por Profesión / Carpeta</h3>
                        <div className="space-y-4">
                          {allCategories.map(cat => {
                            const count = profiles.filter(p => (p.data.personal.category || 'Sin Asignar') === cat && !p.isDeleted).length;
                            const pct = profiles.filter(p=>!p.isDeleted).length ? Math.round((count / profiles.filter(p=>!p.isDeleted).length) * 100) : 0;
                            if (count === 0) return null;
                            return (
                              <div key={cat}>
                                <div className="flex justify-between text-sm mb-1"><span className="font-semibold text-gray-700">{cat}</span><span className="text-gray-500">{count} perfiles ({pct}%)</span></div>
                                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{width: `${pct}%`}}></div></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-bold text-gray-700 mb-4">Distribución de Género</h3>
                        <div className="flex h-32 items-end justify-center gap-6 border-b pb-2">
                          {['Masculino', 'Femenino', 'Otro'].map(gen => {
                             const total = profiles.filter(p=>!p.isDeleted).length;
                             const count = profiles.filter(p => (p.data.personal.gender || 'No especificado').toLowerCase().includes(gen.toLowerCase()) && !p.isDeleted).length;
                             const h = total ? (count / total) * 100 : 0;
                             const color = gen === 'Masculino' ? 'bg-blue-500' : gen === 'Femenino' ? 'bg-pink-500' : 'bg-purple-500';
                             return (
                               <div key={gen} className="flex flex-col items-center gap-2 w-16">
                                 <span className="text-xs font-bold text-gray-500">{count}</span>
                                 <div className={`w-full rounded-t-md ${color} transition-all`} style={{ height: `${Math.max(h, 2)}%` }}></div>
                                 <span className="text-[10px] font-bold text-gray-600">{gen.substring(0,4)}</span>
                               </div>
                             );
                          })}
                        </div>
                      </div>
                    </div>
                  </main>
                ) : (
                  // --- VISTA DE DIRECTORIO (Grilla) ---
                  <div className="flex-1 flex overflow-hidden">
                    {/* BARRA LATERAL (Carpetas y Empresas) */}
                    <aside className="w-72 bg-white border-r border-slate-200 hidden md:flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-slate-800">Empresas</p>
                          {!isTrashMode && <button onClick={handleAddCompany} className="text-xs font-bold text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md">+ Nueva</button>}
                        </div>
                        <div className="space-y-0.5 max-h-56 overflow-y-auto">
                          <NavRow active={activeCompany === 'Todas'} label="Todas las empresas" icon="🗂️" count={liveCount(() => true)} onClick={() => { setActiveCompany('Todas'); setActiveFolder('Todas'); }} />
                          {[...allCompanies.filter(c => c !== 'Independiente'), 'Independiente'].map(c => (
                            <NavRow key={c} active={activeCompany === c} label={c} icon="🏢" count={liveCount(pr => (pr.company || 'Independiente') === c)} onClick={() => { setActiveCompany(c); setActiveFolder('Todas'); }} hot={dropTarget === 'c:' + c} dnd={isTrashMode ? undefined : dnd('c:' + c, c, 'Sin Asignar')} onMenu={isTrashMode ? null : (x, y) => openNodeMenu(x, y, 'company', c)} />
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-slate-800">Carpetas</p>
                          {!isTrashMode && activeCompany !== 'Todas' && <button onClick={() => handleAddFolder(activeCompany)} className="text-xs font-bold text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md">+ Nueva</button>}
                        </div>
                        <div className="space-y-0.5">
                          <NavRow active={activeFolder === 'Todas'} label="Ver todo" icon={<IconFolder />} count={liveCount(pr => activeCompany === 'Todas' || (pr.company || 'Independiente') === activeCompany)} onClick={() => setActiveFolder('Todas')} />
                          {allCategories.filter(f => f.startsWith('Sin Asignar') || (activeCompany !== 'Todas' ? f.startsWith(`${activeCompany} - `) : true)).map(cat => {
                            const count = liveCount(pr => (activeCompany === 'Todas' || (pr.company || 'Independiente') === activeCompany) && (pr.category || 'Sin Asignar') === cat);
                            if (count === 0 && !customFolders.includes(cat) && cat !== 'Sin Asignar') return null;
                            return <NavRow key={cat} active={activeFolder === cat} label={activeCompany !== 'Todas' ? cat.replace(`${activeCompany} - `, '') : cat} icon={<IconFolder />} count={count} onClick={() => setActiveFolder(cat)} hot={dropTarget === 'f:' + cat} dnd={isTrashMode ? undefined : dnd('f:' + cat, folderCompany(cat), cat)} onMenu={isTrashMode ? null : (x, y) => openNodeMenu(x, y, 'folder', cat)} />;
                          })}
                        </div>
                        {!isTrashMode && <p className="text-[11px] text-slate-400 mt-4 leading-snug">Truco: haz clic derecho sobre una empresa, carpeta o candidato para ver más opciones, o arrastra un CV hasta una carpeta para moverlo.</p>}
                      </div>
                    </aside>

                    {/* CONTENIDO PRINCIPAL DIRECTORIO */}
                    <main className="flex-1 p-6 overflow-y-auto relative">
                      {/* Context Menu Flotante */}
                      {contextMenu && (
                        <div className="fixed bg-white border border-gray-200 rounded-lg shadow-2xl py-2 w-52 z-[200] cv-pop cv-menu" style={{ top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 330)), left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 215)) }}>
                          {isTrashMode ? (
                             <>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 text-green-700 font-bold" onClick={() => handleRestoreProfile(contextMenu.id)}>♻️ Restaurar</button>
                               <div className="border-t my-1"></div>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 font-bold" onClick={() => handlePermanentDelete(contextMenu.id)}>🗑️ Eliminar Definitivamente</button>
                             </>
                          ) : (
                             <>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium" onClick={() => handleEditProfile(contextMenu.id)}>✏️ Editar / Ver</button>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium" onClick={() => handleDuplicate(contextMenu.id)}>📄 Duplicar</button>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium" onClick={() => handleRenameProfile(contextMenu.id)}>🏷️ Renombrar</button>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium" onClick={() => { const p = profiles.find(x => x.id === contextMenu.id); if (p) handleExportExcel([p], `CV_${(p.data.personal.name || 'Candidato').trim()}.xlsx`); setContextMenu(null); }}>📊 Exportar a Excel</button>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium" onClick={() => openMove(contextMenu.id)}>📁 Mover a...</button>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium" onClick={() => handleDownloadZip([contextMenu.id])}>💾 Descargar (JSON)</button>
                               <div className="border-t my-1"></div>
                               <button className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 font-bold" onClick={() => { handleDeleteProfile(contextMenu.id); setContextMenu(null); }}>🗑️ Mover a Papelera</button>
                             </>
                          )}
                        </div>
                      )}

                      {/* Barra de Acciones por Lote (Aparece al seleccionar) */}
                      {selectedIds.length > 0 && (
                        <div className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg mb-6 flex justify-between items-center animate-fade-in sticky top-0 z-40">
                          <span className="font-bold text-sm">{selectedIds.length} perfil(es) seleccionado(s)</span>
                          <div className="flex gap-2 items-center">
                            {isTrashMode ? (
                                <button onClick={() => {
                                    showDialog('confirm', 'Restaurar CVs', `¿Restaurar ${selectedIds.length} perfiles?`, () => {
                                        selectedIds.forEach(id => handleRestoreProfile(id));
                                        setSelectedIds([]);
                                    });
                                }} className="bg-green-500 hover:bg-green-400 px-3 py-1.5 rounded text-xs font-bold shadow transition">♻️ Restaurar</button>
                            ) : (
                                <select onChange={(e) => { if(e.target.value) handleBatchMove(e.target.value.split('|||')[0], e.target.value.split('|||')[1]); e.target.value=''; }} className="bg-blue-700 border-none text-white text-xs rounded px-2 py-1.5 outline-none font-bold">
                                  <option value="">Mover a carpeta...</option>
                                  {allCategories.filter(f => f.startsWith('Sin Asignar') || f.startsWith(`${activeCompany === 'Todas' ? 'Independiente' : activeCompany} - `)).map(c => {
                                      const parts = c.split(' - ');
                                      return <option key={c} value={`${parts[0]}|||${c}`}>{c}</option>
                                  })}
                                </select>
                            )}
                            
                            {!isTrashMode && <button onClick={() => handleDownloadZip()} className="bg-blue-500 hover:bg-blue-400 px-3 py-1.5 rounded text-xs font-bold shadow transition">ZIP (Descargar)</button>}
                            <button onClick={handleBatchDelete} className="bg-red-500 hover:bg-red-400 px-3 py-1.5 rounded text-xs font-bold shadow transition">{isTrashMode ? 'Eliminar Def.' : 'Papelera'}</button>
                            <button onClick={() => setSelectedIds([])} className="bg-blue-800 hover:bg-blue-900 px-3 py-1.5 rounded text-xs font-bold transition ml-2">Cancelar</button>
                          </div>
                        </div>
                      )}

                      {/* Barra Superior */}
                      <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full lg:w-1/2 flex gap-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-3 flex items-center text-gray-400"><IconSearch /></div>
                            <input type="text" placeholder="Buscar por nombre o cargo..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm shadow-sm" />
                          </div>
                          <button onClick={() => setShowAdvSearch(!showAdvSearch)} className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition border whitespace-nowrap ${showAdvSearch ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                            Filtros Avanzados
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                          <button onClick={() => handleExportExcel(filtered)} className="flex-1 lg:flex-none justify-center items-center gap-2 text-sm font-bold bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm flex">
                            <IconExcel /> Exportar Excel
                          </button>
                          {!isTrashMode && (
                             <>
                               <button onClick={() => setShowSortModal(true)} className="flex-1 lg:flex-none justify-center items-center gap-2 text-sm font-bold bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm flex">
                                 <IconFilter /> Auto-Organizar
                               </button>
                               <button onClick={() => setShowAiModal(true)} className="flex-1 lg:flex-none justify-center items-center gap-2 text-sm font-bold bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition shadow-sm flex">
                                 🤖 Importar (IA)
                               </button>
                               <button onClick={() => handleCreateNew(activeCompany !== 'Todas' ? activeCompany : undefined, activeFolder !== 'Todas' ? activeFolder : undefined)} className="flex-1 lg:flex-none justify-center items-center gap-2 text-sm font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm flex">
                                 <IconPlus /> Crear Manual
                               </button>
                             </>
                          )}
                        </div>
                      </div>

                      {/* Panel de Búsqueda Avanzada */}
                      {showAdvSearch && (
                        <div className="mb-6 bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-fade-in grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Profesión / Cargo</label>
                            <input type="text" placeholder="Ej: Arquitecto" value={advFilters.role} onChange={e=>setAdvFilters({...advFilters, role: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Ubicación</label>
                            <input type="text" placeholder="Ej: Asunción" value={advFilters.location} onChange={e=>setAdvFilters({...advFilters, location: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-1/2">
                              <label className="block text-xs font-bold text-gray-600 mb-1">Edad Mín.</label>
                              <input type="number" placeholder="25" value={advFilters.minAge} onChange={e=>setAdvFilters({...advFilters, minAge: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                            </div>
                            <div className="w-1/2">
                              <label className="block text-xs font-bold text-gray-600 mb-1">Edad Máx.</label>
                              <input type="number" placeholder="45" value={advFilters.maxAge} onChange={e=>setAdvFilters({...advFilters, maxAge: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                            </div>
                          </div>
                          <div className="flex items-end">
                            <button onClick={() => setAdvFilters({ role: '', minAge: '', maxAge: '', location: '', minExp: '' })} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded text-sm transition">
                              Limpiar Filtros
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Modal de Organización Automática */}
                      {showSortModal && (
                        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-200 animate-fade-in flex flex-col md:flex-row items-center justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-blue-900">Organización Inteligente</h3>
                            <p className="text-xs text-blue-700">El sistema creará carpetas y distribuirá todos tus perfiles automáticamente.</p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={()=>handleAutoOrganize('profession')} className="bg-white border border-blue-300 text-sm font-bold px-3 py-1.5 rounded hover:bg-blue-100 text-blue-900 shadow-sm">Por Profesión</button>
                            <button onClick={()=>handleAutoOrganize('gender')} className="bg-white border border-blue-300 text-sm font-bold px-3 py-1.5 rounded hover:bg-blue-100 text-blue-900 shadow-sm">Por Género</button>
                            <button onClick={()=>handleAutoOrganize('age')} className="bg-white border border-blue-300 text-sm font-bold px-3 py-1.5 rounded hover:bg-blue-100 text-blue-900 shadow-sm">Por Rango de Edad</button>
                            <button onClick={()=>setShowSortModal(false)} className="text-gray-500 hover:text-gray-700 ml-2"><IconClose/></button>
                          </div>
                        </div>
                      )}

                      {filtered.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                          <IconUsers className="w-16 h-16 mx-auto mb-4 opacity-30" />
                          <h2 className="text-xl font-bold mb-2 text-gray-700">{isTrashMode ? 'Papelera Vacía' : 'Base de datos vacía o sin coincidencias'}</h2>
                          <p className="text-sm">{isTrashMode ? 'No hay currículums en la papelera.' : 'Importa currículums o crea uno nuevo para poblar esta carpeta.'}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {filtered.map(p => {
                            const isSelected = selectedIds.includes(p.id);
                            return (
                            <div key={p.id} 
                                 draggable={!isTrashMode}
                                 onDragStart={(e) => { if(!isTrashMode) { e.dataTransfer.setData('cv_id', p.id); e.dataTransfer.effectAllowed = 'move'; } }}
                                 onContextMenu={(e) => { e.preventDefault(); setNodeMenu(null); setContextMenu({ x: e.clientX, y: e.clientY, id: p.id }); }}
                                 className={`bg-white rounded-xl shadow-sm border ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'} hover:shadow-lg hover:border-blue-300 transition overflow-hidden flex flex-col group relative`}>
                              
                              {/* Checkbox de selección */}
                              <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={isSelected} onChange={(e) => {
                                   if(e.target.checked) setSelectedIds(prev => [...prev, p.id]);
                                   else setSelectedIds(prev => prev.filter(id => id !== p.id));
                                }} className="w-5 h-5 accent-blue-600 cursor-pointer shadow-sm" />
                              </div>

                              <button aria-label="Más opciones" title="Más opciones (o clic derecho)" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setNodeMenu(null); setContextMenu({ x: r.left - 150, y: r.bottom + 4, id: p.id }); }} className="absolute bottom-2 right-2 z-10 w-7 h-7 rounded-lg text-lg leading-none font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100">⋯</button>
                              <div className="p-5 pt-8 flex-1 cursor-pointer" onClick={() => !isTrashMode && handleEditProfile(p.id)}>
                                <div className="flex items-start justify-between mb-4">
                                  <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-gray-400">
                                    {p.data.photo ? <img src={p.data.photo} className="w-full h-full object-cover" /> : <span className="text-base font-bold text-slate-500">{(p.data.personal.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>}
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded font-bold uppercase tracking-wider max-w-[120px] truncate mb-1" title={p.data.personal.category}>
                                      {p.data.personal.category || 'Sin Asignar'}
                                    </span>
                                    {p.data.personal.company && (
                                      <span className="text-[9px] text-gray-400 font-bold max-w-[120px] truncate">
                                        🏢 {p.data.personal.company}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 group-hover:text-blue-600 transition truncate">{p.data.personal.name || 'Sin Nombre'}</h3>
                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.data.personal.title || 'Sin Cargo especificado'}</p>
                                <div className="flex gap-2">
                                  {p.data.personal.age && <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-600">{p.data.personal.age} años</span>}
                                  {p.data.personal.location && <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-600 truncate max-w-[100px]">{p.data.personal.location}</span>}
                                  <span className="text-[10px] text-slate-400 ml-auto self-center">{new Date(p.updatedAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      )}
                    </main>
                  </div>
                )}
              </div>
            );
          }

          // ==========================================
          // VISTA DEL EDITOR
          // ==========================================
          return (
            <div className="print-root h-screen flex flex-col bg-gray-100 overflow-hidden font-sans">
              {dialogLayer}

              {/* Header del editor */}
              <header className="print-hide print:hidden bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-20 shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => { setView('dashboard'); setCurrentProfileId(null); setIsTrashMode(false); }} className="btn-volver">
                    <IconHome /> Volver al Directorio
                  </button>
                  {/* cambio en el estilo del boton */}
                  {/* <button onClick={() => { setView('dashboard'); setCurrentProfileId(null); setIsTrashMode(false); }} className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-bold text-sm transition">
                    <IconHome /> Volver al Directorio
                  </button> */}
                  <div className="h-6 w-px bg-gray-300"></div>
                  <div>
                    <h1 className="font-bold text-gray-800 text-sm">{data.personal.name || 'Nuevo Currículum'}</h1>
                    <p className="text-xs text-gray-500">{isSaving ? 'Guardando...' : saveError ? '⚠ Error al guardar' : (workspaceState === 'connected' ? '✓ Guardado automático activo' : 'Solo en el navegador (elige una carpeta en el Directorio)')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportProfile} className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition">
                    <IconDownload /> Exportar JSON
                  </button>
                  <button onClick={() => importFileRef.current && importFileRef.current.click()} className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition">
                    <IconUpload /> Importar
                  </button>
                  <input type="file" ref={importFileRef} accept=".json" className="hidden" onChange={handleImportProfile} />
                  <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition">
                    <IconPrint /> Imprimir / PDF
                  </button>
                </div>
              </header>

              {/* Contenido principal: Editor + Preview */}
              <div className="print-body flex-1 flex overflow-hidden">
                
                {/* PANEL IZQUIERDO: FORMULARIO */}
                <div className="w-full lg:w-[45%] xl:w-[40%] bg-gray-50 border-r flex flex-col overflow-hidden print-hide print:hidden">
                  {/* Tabs de navegación */}
                  <div ref={tabsRef} onWheel={onTabsWheel} className="bg-white border-b px-2 py-2 flex gap-1 overflow-x-auto shrink-0 scrollbar-hide">
                    {TABS_ORDER.map(tab => (
                      <button
                        key={tab}
                        ref={el => tabBtnRefs.current[tab] = el}
                        onClick={() => goToTab(tab)}
                        className={`px-3 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition ${activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        {TAB_NAMES[tab]}
                      </button>
                    ))}
                  </div>

                  {/* Contenido del formulario */}
                  <div ref={formScrollRef} className="flex-1 overflow-y-auto p-5">
                    
                    {/* TAB: Datos Personales */}
                    {activeTab === 'personal' && (
                      <div className="space-y-4 animate-fade-in">
                        <h2 className="font-bold text-lg text-gray-800 mb-4">Datos Personales</h2>
                        
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Nombre Completo</label>
                          <input type="text" value={data.personal.name} onChange={e => updateData('personal', 'name', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Cargo / Título Profesional</label>
                          <input type="text" value={data.personal.title} onChange={e => updateData('personal', 'title', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Email</label>
                            <input type="email" value={data.personal.email} onChange={e => updateData('personal', 'email', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Teléfono</label>
                            <input type="text" value={data.personal.phone} onChange={e => updateData('personal', 'phone', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Ubicación</label>
                          <input type="text" value={data.personal.location} onChange={e => updateData('personal', 'location', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Edad</label>
                            <input type="text" value={data.personal.age} onChange={e => updateData('personal', 'age', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Género</label>
                            <select value={data.personal.gender} onChange={e => updateData('personal', 'gender', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                              <option value="">Seleccionar</option>
                              <option value="Femenino">Femenino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">LinkedIn</label>
                          <input type="text" value={data.personal.linkedin} onChange={e => updateData('personal', 'linkedin', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Sitio Web</label>
                          <input type="text" value={data.personal.website} onChange={e => updateData('personal', 'website', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Idiomas (uno por línea)</label>
                          <textarea value={data.personal.languages} onChange={e => updateData('personal', 'languages', e.target.value)} rows="3" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Español: Nativo&#10;Inglés: C1"></textarea>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Categoría / Carpeta</label>
                          <input type="text" value={data.personal.category} onChange={e => updateData('personal', 'category', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Empresa / Sucursal</label>
                          <input type="text" value={data.personal.company} onChange={e => updateData('personal', 'company', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Perfil Profesional</label>
                          <textarea value={data.profile} onChange={e => updateData('profile', 'profile', e.target.value)} rows="5" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
                        </div>
                      </div>
                    )}

                    {/* TAB: Experiencia */}
                    {activeTab === 'experience' && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="font-bold text-lg text-gray-800">Experiencia Laboral</h2>
                          <button onClick={() => addItem('experience', { company: '', role: '', date: '', tasks: '' })} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition">
                            <IconPlus /> Añadir
                          </button>
                        </div>
                        {data.experience.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-8 bg-white rounded-lg border border-dashed">No hay experiencia registrada. Haz clic en "Añadir".</p>
                        )}
                        {data.experience.map((exp, idx) => (
                          <div key={exp.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                              <div className="flex gap-1">
                                <button onClick={() => moveItem('experience', idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><IconUp /></button>
                                <button onClick={() => moveItem('experience', idx, 'down')} disabled={idx === data.experience.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><IconDown /></button>
                                <button onClick={() => removeItem('experience', exp.id)} className="p-1 text-red-400 hover:text-red-600"><IconTrash /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" value={exp.company} onChange={e => updateItem('experience', exp.id, 'company', e.target.value)} placeholder="Empresa" className="p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                              <input type="text" value={exp.role} onChange={e => updateItem('experience', exp.id, 'role', e.target.value)} placeholder="Cargo" className="p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <input type="text" value={exp.date} onChange={e => updateItem('experience', exp.id, 'date', e.target.value)} placeholder="Fecha (ej: 2020 - Presente)" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            <textarea value={exp.tasks} onChange={e => updateItem('experience', exp.id, 'tasks', e.target.value)} rows="3" placeholder="Tareas (una por línea)" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TAB: Educación */}
                    {activeTab === 'education' && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="font-bold text-lg text-gray-800">Educación</h2>
                          <button onClick={() => addItem('education', { text: '' })} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition">
                            <IconPlus /> Añadir
                          </button>
                        </div>
                        {data.education.map((e, idx) => (
                          <div key={e.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex gap-2">
                            <input type="text" value={e.text} onChange={ev => updateItem('education', e.id, 'text', ev.target.value)} placeholder="Título | Institución (Año)" className="flex-1 p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            <button onClick={() => removeItem('education', e.id)} className="p-1 text-red-400 hover:text-red-600"><IconTrash /></button>
                          </div>
                        ))}
                        
                        <div className="flex justify-between items-center mb-4 mt-6">
                          <h2 className="font-bold text-lg text-gray-800">Certificaciones</h2>
                          <button onClick={() => addItem('certifications', { text: '' })} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition">
                            <IconPlus /> Añadir
                          </button>
                        </div>
                        {data.certifications.map((c, idx) => (
                          <div key={c.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex gap-2">
                            <input type="text" value={c.text} onChange={ev => updateItem('certifications', c.id, 'text', ev.target.value)} placeholder="Nombre de la certificación" className="flex-1 p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            <button onClick={() => removeItem('certifications', c.id)} className="p-1 text-red-400 hover:text-red-600"><IconTrash /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TAB: Habilidades */}
                    {activeTab === 'skills' && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="font-bold text-lg text-gray-800">Habilidades / Competencias</h2>
                          <button onClick={() => addItem('skills', { title: '', text: '' })} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition">
                            <IconPlus /> Añadir
                          </button>
                        </div>
                        {data.skills.map((s, idx) => (
                          <div key={s.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                              <button onClick={() => removeItem('skills', s.id)} className="p-1 text-red-400 hover:text-red-600"><IconTrash /></button>
                            </div>
                            <input type="text" value={s.title} onChange={e => updateItem('skills', s.id, 'title', e.target.value)} placeholder="Título (ej: Herramientas)" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            <textarea value={s.text} onChange={e => updateItem('skills', s.id, 'text', e.target.value)} rows="2" placeholder="Descripción" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TAB: Diseño */}
                    {activeTab === 'design' && (
                      <div className="space-y-5 animate-fade-in">
                        <h2 className="font-bold text-lg text-gray-800 mb-4">Diseño y Estilo</h2>
                        
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-2">Layout (Plantilla)</label>
                          <div className="grid grid-cols-2 gap-2">
                            {LAYOUTS.map(l => (
                              <button key={l.id} onClick={() => setConfig(c => ({ ...c, layout: l }))} className={`p-3 rounded-lg border-2 text-left transition ${config.layout.id === l.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                <div className="font-bold text-xs text-gray-800">{l.name}</div>
                                <div className="text-[10px] text-gray-500 mt-1 leading-tight">{l.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-2">Tema de Color</label>
                          <div className="grid grid-cols-5 gap-2">
                            {THEMES.map(t => (
                              <button key={t.id} onClick={() => setConfig(c => ({ ...c, theme: t }))} className={`h-10 rounded-lg border-2 transition ${config.theme.id === t.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`} style={{ backgroundColor: t.primary }} title={t.name} />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-2">Tipografía</label>
                          <select value={config.font.id} onChange={e => setConfig(c => ({ ...c, font: FONTS.find(f => f.id === e.target.value) }))} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                            {FONTS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-2">Espaciado</label>
                          <Segmented options={SPACING} value={config.spacing.id} onChange={v => setConfig(c => ({ ...c, spacing: SPACING.find(x => x.id === v) }))} />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-2">Forma de la Foto</label>
                          <div className="grid grid-cols-3 gap-2">
                            {PHOTO_SHAPES.map(s => (
                              <button key={s.id} onClick={() => setPhotoCfg({ shape: s.id })} className={`p-2 rounded border text-xs font-bold transition ${config.photo.shape === s.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                                {s.name}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-2 leading-snug">{PHOTO_TIPS[PHOTO_SHAPES.find(s => s.id === config.photo.shape)?.kind || 'face']}</p>
                        </div>

                        {config.photo.shape !== 'none' && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-2">Tamaño de Foto</label>
                              <Segmented options={PHOTO_SIZES} value={config.photo.size} onChange={v => setPhotoCfg({ size: v })} />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-2">Borde de Foto</label>
                              <Segmented options={PHOTO_BORDERS} value={config.photo.border} onChange={v => setPhotoCfg({ border: v })} />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={config.photo.gray} onChange={e => setPhotoCfg({ gray: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                              <span className="text-xs font-bold text-gray-600">Foto en blanco y negro</span>
                            </label>
                            {data.photo && (
                              <>
                                <Slider label="Posición X" value={config.photo.x} min={0} max={100} onChange={v => setPhotoCfg({ x: v })} suffix="%" />
                                <Slider label="Posición Y" value={config.photo.y} min={0} max={100} onChange={v => setPhotoCfg({ y: v })} suffix="%" />
                                <Slider label="Zoom" value={config.photo.zoom} min={100} max={250} onChange={v => setPhotoCfg({ zoom: v })} suffix="%" />
                                <div className="flex gap-2">
                                  <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition">Cambiar Foto</button>
                                  <button onClick={handleRemovePhoto} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold py-2 rounded-lg transition">Quitar Foto</button>
                                </div>
                              </>
                            )}
                            {!data.photo && (
                              <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition">Subir Foto</button>
                            )}
                            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                          </>
                        )}
                      </div>
                    )}

                    {/* TAB: Archivos */}
                    {activeTab === 'manage' && (
                      <div className="space-y-4 animate-fade-in">
                        <h2 className="font-bold text-lg text-gray-800 mb-4">Gestión de Archivos</h2>
                        <button onClick={handleExportProfile} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-lg shadow transition">
                          <IconDownload /> Exportar este CV (JSON)
                        </button>
                        <button onClick={() => importFileRef.current && importFileRef.current.click()} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-sm py-3 rounded-lg shadow-sm transition">
                          <IconUpload /> Importar CV desde JSON
                        </button>
                        <button onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-lg shadow transition">
                          <IconPrint /> Imprimir / Guardar como PDF
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Navegación inferior */}
                  <div className="border-t bg-white px-4 py-3 flex justify-between shrink-0">
                    <button onClick={goPrev} disabled={currentTabIndex === 0} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition">← Anterior</button>
                    <button onClick={goNext} disabled={currentTabIndex === TABS_ORDER.length - 1} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 transition">Siguiente →</button>
                  </div>
                </div>

                {/* PANEL DERECHO: PREVIEW */}
                <div ref={previewRef} className="hidden lg:flex flex-1 overflow-auto bg-gray-200 p-4 preview-pane justify-center">
                  <div className="cv-scale-wrap" style={{ width: DOC_W * scale, height: docH * scale }}>
                    <div ref={docRef} className="cv-scale-inner bg-white shadow-2xl cv-document" style={{ width: DOC_W, minHeight: 1123, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                      {renderCVLayout()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

