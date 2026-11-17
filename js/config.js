        const { useState, useRef, useEffect } = React;

        // ==========================================
        // 1. CONFIGURACIONES AVANZADAS DEL PRODUCTO
        // ==========================================
        const THEMES = [
          { id: 'pastel', group: 'classic', name: 'Azul Pastel', primary: '#1e3a5f', bgLeft: '#e3effa', accent: '#cddff0', text: '#333333' },
          { id: 'slate', group: 'classic', name: 'Acero / Pizarra', primary: '#1e293b', bgLeft: '#f1f5f9', accent: '#cbd5e1', text: '#334155' },
          { id: 'emerald', group: 'classic', name: 'Esmeralda', primary: '#064e3b', bgLeft: '#ecfdf5', accent: '#a7f3d0', text: '#065f46' },
          { id: 'burgundy', group: 'classic', name: 'Bordó Ejecutivo', primary: '#7f1d1d', bgLeft: '#fef2f2', accent: '#fecaca', text: '#450a0a' },
          { id: 'midnight', group: 'classic', name: 'Medianoche', primary: '#172554', bgLeft: '#eff6ff', accent: '#bfdbfe', text: '#1e3a8a' },
          { id: 'minimal', group: 'classic', name: 'Minimalista (B/N)', primary: '#000000', bgLeft: '#f9fafb', accent: '#e5e5e5', text: '#171717' },
          { id: 'rose', group: 'soft', name: 'Rosa Elegante', primary: '#9f1d4f', bgLeft: '#fdf2f6', accent: '#f9c9da', text: '#4a1d2f' },
          { id: 'plum', group: 'soft', name: 'Ciruela', primary: '#6b1f4f', bgLeft: '#fbf1f7', accent: '#ecc4dc', text: '#431433' },
          { id: 'mauve', group: 'soft', name: 'Malva Rosado', primary: '#7a4a6b', bgLeft: '#f9f1f6', accent: '#e6cddd', text: '#4a2c41' },
          { id: 'lavender', group: 'soft', name: 'Lavanda', primary: '#5b3f8c', bgLeft: '#f5f0fb', accent: '#dccdf0', text: '#3b2a55' },
          { id: 'rosegold', group: 'soft', name: 'Oro Rosado', primary: '#a8605a', bgLeft: '#fcf3f1', accent: '#f1d3cf', text: '#4a2b28' },
          { id: 'coral', group: 'soft', name: 'Coral Suave', primary: '#b9472f', bgLeft: '#fff4ef', accent: '#fcd3c3', text: '#4a2a21' },
          { id: 'peach', group: 'soft', name: 'Durazno', primary: '#b0612a', bgLeft: '#fff7ef', accent: '#fbd9b8', text: '#4a3220' },
          { id: 'teal', group: 'soft', name: 'Verde Agua', primary: '#0f6b6b', bgLeft: '#eefafa', accent: '#b6e6e3', text: '#134e4a' },
          { id: 'sage', group: 'soft', name: 'Salvia', primary: '#4d6b4a', bgLeft: '#f3f7f1', accent: '#cfe0ca', text: '#2f3f2d' }
        ];

        const FONTS = [
          { id: 'inter', name: 'Inter (Moderna)', family: "'Inter', sans-serif" },
          { id: 'merriweather', name: 'Merriweather (Clásica)', family: "'Merriweather', serif" },
          { id: 'montserrat', name: 'Montserrat (Dinámica)', family: "'Montserrat', sans-serif" },
          { id: 'lora', name: 'Lora (Elegante)', family: "'Lora', serif" }
        ];

        const LAYOUTS = [
          { id: 'modern', name: 'Moderno (Barra Izquierda)', desc: 'Ideal para perfiles tecnológicos y de datos.' },
          { id: 'right-sidebar', name: 'Dinámico (Barra Derecha)', desc: 'Prioriza la lectura de la experiencia laboral.' },
          { id: 'executive', name: 'Ejecutivo (Cabecera)', desc: 'Transmite autoridad gerencial y experiencia.' },
          { id: 'classic', name: 'Clásico ATS', desc: 'Formato seguro y legible para bancos tradicionales.' },
          { id: 'harvard', name: 'Académico (Harvard)', desc: 'Extremadamente formal, sobrio y estructurado.' },
          { id: 'creative', name: 'Creativo (Bloque Color)', desc: 'Cabecera a todo color, muy llamativo y moderno.' },
          { id: 'timeline', name: 'Timeline Pro', desc: 'Línea de tiempo vertical con puntos de color. Muy visual y moderno.' },
          { id: 'split', name: 'Split Color', desc: 'Dos bloques de color enfrentados con foto central. Impactante.' },
          { id: 'minimalchic', name: 'Minimal Chic', desc: 'Mucho espacio en blanco, tipografía grande. Elegante y limpio.' },
          { id: 'boldheader', name: 'Bold Header', desc: 'Cabecera gigante con nombre enorme y skills en pills.' }
        ];

        const SPACING = [
          { id: 'compact', name: 'Compacto', gap: 'gap-2', mb: 'mb-3', text: 'text-[12px]' },
          { id: 'normal', name: 'Normal', gap: 'gap-4', mb: 'mb-5', text: 'text-[13.5px]' },
          { id: 'spacious', name: 'Espacioso', gap: 'gap-6', mb: 'mb-7', text: 'text-[15px]' }
        ];

        const PHOTO_SHAPES = [
          { id: 'circle',   name: 'Circular',              ratio: 1,    radius: '50%',  kind: 'face' },
          { id: 'rounded',  name: 'Cuadrada redondeada',   ratio: 1,    radius: '18%',  kind: 'face' },
          { id: 'square',   name: 'Cuadrada clásica',      ratio: 1,    radius: '3px',  kind: 'face' },
          { id: 'portrait', name: 'Retrato (busto)',       ratio: 1.25, radius: '6px',  kind: 'bust' },
          { id: 'oval',     name: 'Óvalo vertical',        ratio: 1.25, radius: '50%',  kind: 'bust' },
          { id: 'fullbody', name: 'Cuerpo entero',         ratio: 1.5,  radius: '8px',  kind: 'full' },
          { id: 'none',     name: 'Sin foto',              ratio: 1,    radius: '0',    kind: 'none' }
        ];
        const PHOTO_SIZES = [
          { id: 'sm', name: 'Pequeña' },
          { id: 'md', name: 'Mediana' },
          { id: 'lg', name: 'Grande' }
        ];
        const PHOTO_WIDTHS = {
          sidebar: { sm: 120, md: 160, lg: 208 },
          header:  { sm: 84,  md: 108, lg: 132 }
        };
        const PHOTO_BORDERS = [
          { id: 'white', name: 'Blanco' },
          { id: 'theme', name: 'Color del tema' },
          { id: 'none', name: 'Sin borde' }
        ];
        const PHOTO_TIPS = {
          face: 'Rostro y hombros, fondo neutro y buena luz: es el formato más seguro y aceptado por RR. HH.',
          bust: 'Busto o medio cuerpo: útil en perfiles comerciales, atención al cliente o liderazgo. Cuidá el encuadre y la vestimenta.',
          full: 'Cuerpo entero: solo recomendable donde la imagen forma parte del puesto (recepción, ventas presenciales, eventos, modelaje). En banca, IT o finanzas conviene un retrato de busto.',
          none: 'Sin foto: lo más recomendable cuando el CV pasa por sistemas ATS o en procesos que evitan la foto por criterios de no discriminación.'
        };
        const DEFAULT_PHOTO = { shape: 'circle', size: 'md', border: 'white', gray: false, x: 50, y: 50, zoom: 100 };

        const TABS_ORDER = ['personal', 'experience', 'education', 'skills', 'design', 'manage'];
        const TAB_NAMES = { personal: 'Datos', experience: 'Experiencia', education: 'Educación', skills: 'Habilidades', design: 'Diseño', manage: 'Archivos' };

        const DOC_W = 793.7; // 210 mm en px CSS

