        // ==========================================
        // 2. DATOS POR DEFECTO Y PLANTILLAS (SEMILLAS)
        // ==========================================
        const initialData = {
          personal: {
            name: "ALEJANDRO MARTÍNEZ", title: "Senior Product Manager", category: "Product Management", company: "TechSolutions S.A.",
            email: "alejandro.m@ejemplo.com", phone: "+34 600 123 456", location: "Madrid, España",
            linkedin: "linkedin.com/in/alemartinez", website: "alemartinez.dev", languages: "Español: Nativo\nInglés: C1 Avanzado",
            age: "34", gender: "Masculino"
          },
          photo: "https://randomuser.me/api/portraits/men/32.jpg",
          profile: "Especialista en desarrollo de producto con más de 8 años de experiencia liderando equipos ágiles. Apasionado por la intersección entre tecnología, diseño y estrategia de negocio. Capacidad comprobada para llevar ideas desde la concepción hasta el lanzamiento, alineando objetivos comerciales con la mejor experiencia de usuario. Orientado a métricas (Data-Driven) y a la mejora continua de KPIs.",
          skills: [
            { id: 1, title: "Gestión de Producto", text: "Roadmapping, Agile (Scrum/Kanban), OKRs, Priorización." },
            { id: 2, title: "Herramientas", text: "Jira, Confluence, Figma, Miro, Notion." },
            { id: 3, title: "Analítica de Datos", text: "Google Analytics, Mixpanel, SQL básico, Tableau." },
            { id: 4, title: "Soft Skills", text: "Liderazgo empático, Comunicación transversal, Resolución de conflictos." }
          ],
          experience: [
            { id: 1, company: "TechSolutions S.L.", role: "Lead Product Manager", date: "2020 – Presente", tasks: "Liderazgo de un equipo multidisciplinar de 12 personas (Diseño, Ingeniería y QA) para el producto principal.\nIncremento del 40% en retención de usuarios mediante el rediseño del onboarding." },
            { id: 2, company: "StartUp Innova", role: "Product Owner", date: "2016 – 2020", tasks: "Lanzamiento de 3 aplicaciones móviles (iOS y Android) desde cero, alcanzando +100k descargas.\nImplementación de metodologías ágiles que redujeron el time-to-market en un 25%." }
          ],
          education: [
            { id: 1, text: "Máster en Innovación Digital | Universidad Tecnológica (2016)" },
            { id: 2, text: "Grado en Ingeniería Informática | Universidad Nacional (2014)" }
          ],
          certifications: [
            { id: 1, text: "Agile: Certified Scrum Master (CSM) - Scrum Alliance" }
          ]
        };

        const templateData2 = {
          personal: {
            name: "ELENA VALDEZ", title: "Directora Financiera (CFO)", category: "Finanzas", company: "Global Corp", email: "elena.valdez@ejemplo.com", phone: "+52 55 1234 5678", location: "CDMX, México", linkedin: "linkedin.com/in/elenavaldez", website: "", languages: "Español: Nativo\nInglés: Bilingüe",
            age: "42", gender: "Femenino"
          },
          photo: "https://randomuser.me/api/portraits/women/44.jpg",
          profile: "Ejecutiva financiera con 15 años de trayectoria optimizando el rendimiento corporativo y liderando estrategias de crecimiento en empresas multinacionales. Experta en fusiones y adquisiciones (M&A), gestión de riesgos y optimización de capital.",
          skills: [{ id: 1, title: "Finanzas Corporativas", text: "M&A, Presupuestos, Control de Gestión, Auditoría." }],
          experience: [{ id: 1, company: "Global Corp Bancorp", role: "CFO", date: "2018 – Presente", tasks: "Reducción de costos operativos en un 15% mediante reestructuración de deuda." }],
          education: [{ id: 1, text: "MBA Ejecutivo | Harvard Business School (2015)" }],
          certifications: []
        };

        const templateData3 = {
          personal: {
            name: "LUCAS HERRERA", title: "Ingeniero Civil Senior", category: "Ingeniería / Obras", company: "Constructora Nacional", email: "l.herrera@ejemplo.com", phone: "+54 9 11 1234 5678", location: "Buenos Aires, Argentina", linkedin: "", website: "", languages: "Español: Nativo",
            age: "39", gender: "Masculino"
          },
          photo: null,
          profile: "Ingeniero Civil especializado en gestión de megaobras de infraestructura pública y privada. Historial probado de entrega de proyectos complejos a tiempo y dentro del presupuesto, manteniendo estrictos estándares de seguridad.",
          skills: [{ id: 1, title: "Software", text: "AutoCAD Civil 3D, MS Project, Revit, SAP2000." }],
          experience: [{ id: 1, company: "Constructora Nacional", role: "Jefe de Proyecto", date: "2015 – Presente", tasks: "Supervisión de la construcción de la Autopista Norte (Tramo 3)." }],
          education: [ { id: 1, text: "Ingeniería Civil | Universidad de Buenos Aires (2012)" } ],
          certifications: [ { id: 1, text: "Gestión: Project Management Professional (PMP)" } ]
        };

        const emptyData = {
          personal: { name: "", title: "", category: "Sin Asignar", company: "Independiente", email: "", phone: "", location: "", linkedin: "", website: "", languages: "", age: "", gender: "" },
          photo: null, profile: "", skills: [], experience: [], education: [], certifications: []
        };

