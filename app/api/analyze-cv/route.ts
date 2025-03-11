// app/api/analyze-cv/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/analyze-cv
 * Enhanced CV analysis API endpoint with proper ATS scoring
 */
export async function GET(request: NextRequest) {
  try {
    // Get fileName from URL params (required)
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("fileName");
    const cvId = searchParams.get("cvId");

    // Early validations with helpful error messages
  if (!fileName) {
      console.error("Missing fileName parameter in analyze-cv request");
      return new Response(JSON.stringify({ 
        error: "Missing fileName parameter",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cvId) {
      console.error("Missing cvId parameter in analyze-cv request");
      return new Response(JSON.stringify({ 
        error: "Missing cvId parameter",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Starting CV analysis for ${fileName} (ID: ${cvId})`);

    // Parse cvId to integer safely
    let cvIdNumber: number;
    try {
      cvIdNumber = parseInt(cvId);
      if (isNaN(cvIdNumber)) {
        throw new Error(`Invalid cvId: ${cvId} is not a number`);
      }
    } catch (parseError) {
      console.error(`Error parsing cvId: ${cvId}`, parseError);
      return new Response(JSON.stringify({ 
        error: `Invalid cvId: ${cvId} is not a valid number`,
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch CV record with safety checks
    let cv;
    try {
      cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, cvIdNumber)
      });
    } catch (dbError) {
      console.error(`Database error fetching CV ${cvId}:`, dbError);
      return new Response(JSON.stringify({ 
        error: "Database error while fetching CV",
        details: dbError instanceof Error ? dbError.message : "Unknown database error",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cv) {
      console.error(`CV not found: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV not found",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get CV content with null check
    const cvContent = cv.rawText || "";
    if (!cvContent || cvContent.trim() === "") {
      console.error(`CV content is empty for ID: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "Only PDF files are supported. Other file types are for applying to jobs.",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Perform CV analysis to determine industry, language, and calculate ATS score
    const analysis = analyzeCV(cvContent);
    console.log(`Analysis completed for CV ${cvId} with ATS score: ${analysis.atsScore}`);

    // Merge with existing metadata (if any)
    let metadata = {};
    if (cv.metadata) {
      try {
        metadata = JSON.parse(cv.metadata);
      } catch (parseError) {
        console.error(`Error parsing existing metadata for CV ${cvId}:`, parseError);
        // Continue with empty metadata instead of failing
        metadata = {};
      }
    }

    // Create updated metadata with analysis results
    const updatedMetadata = {
      ...metadata,
      atsScore: analysis.atsScore,
      language: analysis.language,
      industry: analysis.industry,
      keywordAnalysis: analysis.keywordAnalysis,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      formattingStrengths: analysis.formattingStrengths,
      formattingWeaknesses: analysis.formattingWeaknesses,
      formattingRecommendations: analysis.formattingRecommendations,
      analyzedAt: new Date().toISOString(),
      ready_for_optimization: true,
      analysis_status: 'complete'
    };

    // Update CV record with metadata safely
    try {
      await db.update(cvs)
        .set({ metadata: JSON.stringify(updatedMetadata) })
        .where(eq(cvs.id, cvIdNumber));
      
      console.log(`Successfully updated metadata for CV ${cvId}`);
    } catch (updateError) {
      console.error(`Error updating metadata for CV ${cvId}:`, updateError);
      return new Response(JSON.stringify({ 
        error: "Failed to update CV metadata",
        details: updateError instanceof Error ? updateError.message : "Unknown database error",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return analysis results
    return new Response(JSON.stringify({ 
      success: true, 
      analysis,
      message: "CV analyzed successfully"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log the detailed error
    console.error(`Unexpected error analyzing CV:`, error);
    
    // Provide a user-friendly response
    return new Response(JSON.stringify({ 
      error: "Failed to analyze CV", 
      details: error instanceof Error ? error.message : "Unknown error occurred",
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Analyze CV content to determine industry, language, and calculate ATS score
 * @param cvContent The CV content to analyze
 * @returns Analysis results including ATS score, industry, and recommendations
 */
function analyzeCV(cvContent: string) {
  // Normalize text for analysis
  const normalizedText = cvContent.toLowerCase();
  
  // Detect language
  const language = detectLanguage(cvContent);
  console.log(`Detected language: ${language}`);
  
  // Define industry keywords for detection (multiple languages)
  const INDUSTRY_KEYWORDS: Record<string, Record<string, string[]>> = {
    "en": {
      "Technology": ["software", "development", "programming", "api", "cloud", "infrastructure", "data", "analytics", "frontend", "backend", "fullstack", "devops", "agile", "scrum", "jira", "git", "aws", "azure", "javascript", "python", "java", "c#", "react", "angular", "vue", "node"],
      "Finance": ["investment", "portfolio", "financial", "trading", "assets", "banking", "analysis", "compliance", "risk", "audit", "accounting", "budget", "forecast", "revenue", "profit", "loss", "balance sheet", "income statement", "cash flow", "equity", "debt", "credit", "loan", "mortgage"],
      "Healthcare": ["patient", "clinical", "medical", "health", "care", "treatment", "diagnostic", "therapy", "hospital", "doctor", "nurse", "physician", "surgeon", "pharmacy", "medication", "prescription", "diagnosis", "prognosis", "symptoms", "disease", "illness", "wellness", "recovery"],
      "Marketing": ["campaign", "brand", "market", "strategy", "audience", "content", "social", "media", "advertising", "promotion", "seo", "sem", "ppc", "conversion", "funnel", "engagement", "retention", "acquisition", "customer", "client", "demographic", "psychographic", "segmentation"],
      "Sales": ["sales", "revenue", "quota", "pipeline", "prospect", "lead", "opportunity", "close", "deal", "customer", "client", "account", "territory", "region", "market", "upsell", "cross-sell", "negotiation", "presentation", "proposal", "contract", "commission", "bonus"],
      "Human Resources": ["hr", "recruit", "talent", "acquisition", "onboarding", "training", "development", "performance", "review", "compensation", "benefits", "payroll", "employee", "retention", "engagement", "culture", "diversity", "inclusion", "compliance", "policy", "procedure"],
      "General": ["project", "management", "team", "business", "client", "service", "process", "solution", "communication", "collaboration", "leadership", "organization", "planning", "execution", "monitoring", "evaluation", "reporting", "presentation", "documentation"]
    },
    "es": {
      "Tecnología": ["software", "desarrollo", "programación", "api", "nube", "infraestructura", "datos", "analítica", "frontend", "backend", "fullstack", "devops", "ágil", "scrum", "jira", "git", "aws", "azure", "javascript", "python", "java", "c#", "react", "angular", "vue", "node"],
      "Finanzas": ["inversión", "cartera", "financiero", "comercio", "activos", "banca", "análisis", "cumplimiento", "riesgo", "auditoría", "contabilidad", "presupuesto", "pronóstico", "ingresos", "beneficio", "pérdida", "balance", "cuenta de resultados", "flujo de caja", "capital", "deuda", "crédito", "préstamo", "hipoteca"],
      "Salud": ["paciente", "clínico", "médico", "salud", "cuidado", "tratamiento", "diagnóstico", "therapia", "hospital", "doctor", "enfermera", "médico", "cirujano", "farmacia", "medicamento", "receta", "diagnóstico", "pronóstico", "síntomas", "enfermedad", "malestar", "bienestar", "recuperación"],
      "Marketing": ["campaña", "marca", "mercado", "estrategia", "audiencia", "contenido", "social", "medios", "publicidad", "promoción", "seo", "sem", "ppc", "conversión", "embudo", "compromiso", "retención", "adquisición", "cliente", "cliente", "demográfico", "psicográfico", "segmentación"],
      "Ventas": ["ventas", "ingresos", "cuota", "tubería", "prospecto", "cliente potencial", "oportunidad", "cerrar", "acuerdo", "cliente", "cliente", "cuenta", "territorio", "región", "mercado", "up-sell", "cross-sell", "negociación", "présentation", "proposition", "contrat", "comisión", "bono"],
      "Recursos Humanos": ["rrhh", "reclutar", "talento", "adquisición", "incorporación", "formación", "desarrollo", "desempeño", "revisión", "compensación", "beneficios", "nómina", "empleado", "retención", "compromiso", "cultura", "diversidad", "inclusión", "cumplimiento", "política", "procedimiento"],
      "General": ["proyecto", "gestión", "equipo", "negocio", "cliente", "servicio", "proceso", "solución", "comunicación", "colaboración", "liderazgo", "organización", "planificación", "ejecución", "monitoreo", "evaluación", "informes", "presentación", "documentación"]
    },
    "fr": {
      "Technologie": ["logiciel", "développement", "programmation", "api", "cloud", "infrastructure", "données", "analytique", "frontend", "backend", "fullstack", "devops", "agile", "scrum", "jira", "git", "aws", "azure", "javascript", "python", "java", "c#", "react", "angular", "vue", "node"],
      "Finance": ["investissement", "portefeuille", "financier", "trading", "actifs", "banque", "analyse", "conformité", "risque", "audit", "comptabilité", "budget", "prévision", "revenu", "profit", "perte", "bilan", "compte de résultat", "flux de trésorerie", "capitaux propres", "dette", "crédit", "prêt", "hypothèque"],
      "Santé": ["patient", "clinique", "médical", "santé", "soins", "traitement", "diagnostic", "thérapie", "hôpital", "médecin", "infirmière", "médecin", "chirurgien", "pharmacie", "médicament", "prescription", "diagnostic", "pronostic", "symptômes", "maladie", "maladie", "bien-être", "récupération"],
      "Marketing": ["campagne", "marque", "marché", "stratégie", "audience", "contenu", "social", "médias", "publicité", "promotion", "seo", "sem", "ppc", "conversion", "entonnoir", "engagement", "rétention", "acquisition", "client", "client", "démographique", "psychographique", "segmentation"],
      "Ventes": ["ventes", "revenu", "quota", "pipeline", "prospect", "lead", "opportunité", "clôture", "affaire", "client", "client", "compte", "territoire", "région", "marché", "up-sell", "cross-sell", "négociation", "présentation", "proposition", "contrat", "commission", "bonus"],
      "Ressources Humaines": ["rh", "recruter", "talent", "acquisition", "intégration", "formation", "développement", "performance", "révision", "rémunération", "avantages", "paie", "employé", "rétention", "engagement", "culture", "diversité", "inclusion", "conformité", "politique", "procédure"],
      "Général": ["projet", "gestion", "équipe", "entreprise", "client", "service", "processus", "solution", "communication", "collaboration", "leadership", "organisation", "planification", "exécution", "surveillance", "évaluation", "rapports", "présentation", "documentation"]
    },
    "de": {
      "Technologie": ["software", "entwicklung", "programmierung", "api", "cloud", "infrastruktur", "daten", "analytik", "frontend", "backend", "fullstack", "devops", "agil", "scrum", "jira", "git", "aws", "azure", "javascript", "python", "java", "c#", "react", "angular", "vue", "node"],
      "Finanzen": ["investition", "portfolio", "finanziell", "handel", "vermögenswerte", "bankwesen", "analyse", "compliance", "risiko", "prüfung", "buchhaltung", "budget", "prognose", "umsatz", "gewinn", "verlust", "bilanz", "gewinn- und verlustrechnung", "cashflow", "eigenkapital", "schulden", "kredit", "darlehen", "hypothek"],
      "Gesundheitswesen": ["patient", "klinisch", "medizinisch", "gesundheit", "pflege", "behandlung", "diagnostik", "therapie", "krankenhaus", "arzt", "krankenschwester", "arzt", "chirurg", "apotheke", "medikament", "verschreibung", "diagnose", "prognose", "symptome", "krankheit", "erkrankung", "wellness", "genesung"],
      "Marketing": ["kampagne", "marke", "markt", "strategie", "zielgruppe", "inhalt", "sozial", "medien", "werbung", "förderung", "seo", "sem", "ppc", "konversion", "trichter", "engagement", "bindung", "akquisition", "kunde", "klient", "demografisch", "psychografisch", "segmentierung"],
      "Vertrieb": ["vertrieb", "umsatz", "quote", "pipeline", "prospect", "lead", "chance", "abschluss", "deal", "kunde", "klient", "konto", "territorium", "region", "markt", "up-selling", "cross-selling", "verhandlung", "präsentation", "vorschlag", "vertrag", "provision", "bonus"],
      "Personal": ["hr", "rekrutieren", "talent", "akquisition", "onboarding", "training", "entwicklung", "leistung", "überprüfung", "vergütung", "benefits", "gehalt", "mitarbeiter", "bindung", "engagement", "kultur", "diversität", "inklusion", "compliance", "richtlinie", "verfahren"],
      "Allgemein": ["projekt", "management", "team", "geschäft", "kunde", "service", "prozess", "lösung", "kommunikation", "zusammenarbeit", "führung", "organisation", "planung", "ausführung", "überwachung", "bewertung", "berichterstattung", "präsentation", "dokumentation"]
    }
  };
  
  // Define action verbs for achievement detection (multiple languages)
  const ACTION_VERBS: Record<string, string[]> = {
    "en": [
      "achieved", "improved", "trained", "managed", "created", "increased", "reduced", "negotiated",
      "developed", "led", "organized", "provided", "delivered", "generated", "implemented", "produced"
    ],
    "es": [
      "logrado", "mejorado", "capacitado", "gestionado", "creado", "aumentado", "reducido", "negociado",
      "desarrollado", "liderado", "organizado", "proporcionado", "entregado", "generado", "implementado", "producido"
    ],
    "fr": [
      "réalisé", "amélioré", "formé", "géré", "créé", "augmenté", "réduit", "négocié",
      "développé", "dirigé", "organisé", "fourni", "livré", "généré", "mis en œuvre", "produit"
    ],
    "de": [
      "erreicht", "verbessert", "trainiert", "verwaltet", "erstellt", "erhöht", "reduziert", "verhandelt",
      "entwickelt", "geleitet", "organisiert", "bereitgestellt", "geliefert", "generiert", "implementiert", "produziert"
    ]
  };
  
  // Define section names in multiple languages
  const SECTION_NAMES: Record<string, Record<string, string[]>> = {
    "en": {
      "contact": ["contact", "email", "phone", "address", "linkedin"],
      "education": ["education", "degree", "university", "college", "bachelor", "master", "phd"],
      "experience": ["experience", "work", "employment", "job", "position", "role"],
      "skills": ["skills", "proficient", "proficiency", "familiar", "expertise", "expert"],
      "summary": ["summary", "profile", "objective", "about"]
    },
    "es": {
      "contact": ["contacto", "email", "correo", "teléfono", "dirección", "linkedin"],
      "education": ["educación", "formación", "título", "universidad", "licenciatura", "máster", "doctorado"],
      "experience": ["experiencia", "trabajo", "empleo", "puesto", "posición", "rol"],
      "skills": ["habilidades", "competencias", "capacidades", "destrezas", "conocimientos"],
      "summary": ["resumen", "perfil", "objetivo", "sobre mí"]
    },
    "fr": {
      "contact": ["contact", "email", "courriel", "téléphone", "adresse", "linkedin"],
      "education": ["éducation", "formation", "diplôme", "université", "licence", "master", "doctorat"],
      "experience": ["expérience", "travail", "emploi", "poste", "position", "rôle"],
      "skills": ["compétences", "aptitudes", "connaissances", "expertise", "maîtrise"],
      "summary": ["résumé", "profil", "objectif", "à propos"]
    },
    "de": {
      "contact": ["kontakt", "email", "telefon", "adresse", "linkedin"],
      "education": ["bildung", "ausbildung", "studium", "universität", "bachelor", "master", "promotion"],
      "experience": ["erfahrung", "arbeit", "beschäftigung", "beruf", "position", "rolle"],
      "skills": ["fähigkeiten", "kenntnisse", "kompetenzen", "fertigkeiten", "expertise"],
      "summary": ["zusammenfassung", "profil", "ziel", "über mich"]
    }
  };
  
  // Get keywords for the detected language (fallback to English)
  const industryKeywords = INDUSTRY_KEYWORDS[language] || INDUSTRY_KEYWORDS["en"];
  const actionVerbs = ACTION_VERBS[language] || ACTION_VERBS["en"];
  const sectionNames = SECTION_NAMES[language] || SECTION_NAMES["en"];
  
  // Check for key elements based on language
  const hasContact = new RegExp(sectionNames.contact.join("|"), "i").test(normalizedText);
  const hasEducation = new RegExp(sectionNames.education.join("|"), "i").test(normalizedText);
  const hasExperience = new RegExp(sectionNames.experience.join("|"), "i").test(normalizedText);
  const hasSkills = new RegExp(sectionNames.skills.join("|"), "i").test(normalizedText);
  const hasSummary = new RegExp(sectionNames.summary.join("|"), "i").test(normalizedText);
  
  // Count action verbs
  let actionVerbCount = 0;
  const actionVerbMatches: Record<string, number> = {};
  
  actionVerbs.forEach(verb => {
    const regex = new RegExp(`\\b${verb}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      actionVerbCount += matches.length;
      actionVerbMatches[verb] = matches.length;
    }
  });
  
  // Count metrics (numbers followed by % or other indicators)
  const metricsMatches = normalizedText.match(/\b\d+\s*(?:%|percent|million|billion|k|thousand|users|clients|customers|increase|decrease|growth)\b/gi);
  const metricsCount = metricsMatches ? metricsMatches.length : 0;
  
  // Assess keyword relevance by industry
  const keywordsByIndustry: Record<string, number> = {};
  const keywordMatches: Record<string, number> = {};
  
  Object.entries(industryKeywords).forEach(([industry, keywords]) => {
    let count = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        count += matches.length;
        keywordMatches[keyword] = (keywordMatches[keyword] || 0) + matches.length;
      }
    });
    keywordsByIndustry[industry] = count;
  });
  
  // Determine most likely industry
  let topIndustry = Object.keys(industryKeywords)[0]; // Default to first industry in current language
  let topCount = 0;
  Object.entries(keywordsByIndustry).forEach(([industry, count]) => {
    if (count > topCount) {
      topIndustry = industry;
      topCount = count;
    }
  });
  
  // Calculate ATS score based on multiple factors
  let atsScore = 50; // Start at 50
  
  // Add points for having essential sections (up to 20 points)
  if (hasContact) atsScore += 5;
  if (hasEducation) atsScore += 5;
  if (hasExperience) atsScore += 5;
  if (hasSkills) atsScore += 5;
  if (hasSummary) atsScore += 5;
  
  // Add points for action verbs (up to 15 points)
  atsScore += Math.min(15, Math.floor(actionVerbCount / 2));
  
  // Add points for metrics (up to 15 points)
  atsScore += Math.min(15, metricsCount * 3);
  
  // Add points for industry relevance (up to 15 points)
  atsScore += Math.min(15, topCount);
  
  // Ensure score is between 0-100
  atsScore = Math.max(0, Math.min(100, atsScore));
  
  // Sort keywords by frequency
  const sortedKeywords = Object.entries(keywordMatches)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as Record<string, number>);
  
  // Define strengths and weaknesses messages for each language
  const MESSAGES: Record<string, {
    strengths: Record<string, string>;
    weaknesses: Record<string, string>;
    recommendations: Record<string, string>;
  }> = {
    "en": {
      strengths: {
        contact: "Contact information is present",
        education: "Education section is included",
        experience: "Work experience is detailed",
        skills: "Skills section is present",
        actionVerbs: "Good use of action verbs",
        metrics: "Metrics are included to quantify achievements"
      },
      weaknesses: {
        contact: "Contact information could be clearer",
        education: "Education section could be enhanced",
        experience: "Work experience section needs more detail",
        skills: "Skills section is missing or incomplete",
        actionVerbs: "Could use more action verbs",
        metrics: "No metrics used to quantify achievements"
      },
      recommendations: {
        sections: "Ensure all key sections are included: contact, summary, experience, education, and skills",
        actionVerbs: "Add more action verbs to describe achievements (e.g., achieved, implemented, led)",
        metrics: "Quantify achievements with specific metrics and percentages where possible"
      }
    },
    "es": {
      strengths: {
        contact: "La información de contacto está presente",
        education: "Se incluye sección de educación",
        experience: "La experiencia laboral está detallada",
        skills: "La sección de habilidades está presente",
        actionVerbs: "Buen uso de verbos de acción",
        metrics: "Se incluyen métricas para cuantificar logros"
      },
      weaknesses: {
        contact: "La información de contacto podría ser más clara",
        education: "La sección de educación podría mejorarse",
        experience: "La sección de experiencia laboral necesita más detalle",
        skills: "La sección de habilidades está ausente o incompleta",
        actionVerbs: "Podría usar más verbos de acción",
        metrics: "No se utilizan métricas para cuantificar logros"
      },
      recommendations: {
        sections: "Asegúrate de incluir todas las secciones clave: contacto, resumen, experiencia, educación y habilidades",
        actionVerbs: "Añade más verbos de acción para describir logros (por ejemplo, logrado, implementado, liderado)",
        metrics: "Cuantifica logros con métricas específicas y porcentajes donde sea posible"
      }
    },
    "fr": {
      strengths: {
        contact: "Les informations de contact sont présentes",
        education: "La section formation est incluse",
        experience: "L'expérience professionnelle est détaillée",
        skills: "La section compétences est présente",
        actionVerbs: "Bonne utilisation des verbes d'action",
        metrics: "Des métriques sont incluses pour quantifier les réalisations"
      },
      weaknesses: {
        contact: "Les informations de contact pourraient être plus claires",
        education: "La section formation pourrait être améliorée",
        experience: "La section expérience professionnelle nécessite plus de détails",
        skills: "La section compétences est manquante ou incomplète",
        actionVerbs: "Pourrait utiliser plus de verbes d'action",
        metrics: "Aucune métrique utilisée pour quantifier les réalisations"
      },
      recommendations: {
        sections: "Assurez-vous d'inclure toutes les sections clés : contact, résumé, expérience, formation et compétences",
        actionVerbs: "Ajoutez plus de verbes d'action pour décrire vos réalisations (par exemple, réalisé, mis en œuvre, dirigé)",
        metrics: "Quantifiez les réalisations avec des métriques spécifiques et des pourcentages lorsque c'est possible"
      }
    },
    "de": {
      strengths: {
        contact: "Kontaktinformationen sind vorhanden",
        education: "Bildungsabschnitt ist enthalten",
        experience: "Berufserfahrung ist detailliert",
        skills: "Fähigkeiten-Abschnitt ist vorhanden",
        actionVerbs: "Gute Verwendung von Aktionsverben",
        metrics: "Metriken zur Quantifizierung von Leistungen sind enthalten"
      },
      weaknesses: {
        contact: "Kontaktinformationen könnten klarer sein",
        education: "Bildungsabschnitt könnte verbessert werden",
        experience: "Abschnitt zur Berufserfahrung benötigt mehr Details",
        skills: "Fähigkeiten-Abschnitt fehlt oder ist unvollständig",
        actionVerbs: "Könnte mehr Aktionsverben verwenden",
        metrics: "Keine Metriken zur Quantifizierung von Leistungen"
      },
      recommendations: {
        sections: "Stellen Sie sicher, dass alle wichtigen Abschnitte enthalten sind: Kontakt, Zusammenfassung, Erfahrung, Bildung und Fähigkeiten",
        actionVerbs: "Fügen Sie mehr Aktionsverben hinzu, um Leistungen zu beschreiben (z.B. erreicht, implementiert, geleitet)",
        metrics: "Quantifizieren Sie Leistungen mit spezifischen Metriken und Prozentsätzen, wo möglich"
      }
    }
  } as const;
  
  // Use language specific messages or default to English
  const messages = MESSAGES[language] || MESSAGES["en"];
  
  // Generate strengths
  const strengths = [];
  if (hasContact) strengths.push(messages.strengths.contact);
  if (hasEducation) strengths.push(messages.strengths.education);
  if (hasExperience) strengths.push(messages.strengths.experience);
  if (hasSkills) strengths.push(messages.strengths.skills);
  if (actionVerbCount > 5) strengths.push(messages.strengths.actionVerbs);
  if (metricsCount > 0) strengths.push(messages.strengths.metrics);
  
  // Generate weaknesses
  const weaknesses = [];
  if (!hasContact) weaknesses.push(messages.weaknesses.contact);
  if (!hasEducation) weaknesses.push(messages.weaknesses.education);
  if (!hasExperience) weaknesses.push(messages.weaknesses.experience);
  if (!hasSkills) weaknesses.push(messages.weaknesses.skills);
  if (actionVerbCount < 5) weaknesses.push(messages.weaknesses.actionVerbs);
  if (metricsCount === 0) weaknesses.push(messages.weaknesses.metrics);
  
  // Generate recommendations
  const recommendations = [];
  if (!hasContact || !hasEducation || !hasExperience || !hasSkills) {
    recommendations.push(messages.recommendations.sections);
  }
  if (actionVerbCount < 5) {
    recommendations.push(messages.recommendations.actionVerbs);
  }
  if (metricsCount === 0) {
    recommendations.push(messages.recommendations.metrics);
  }
  
  // Return analysis results with language information
  return {
    atsScore,
    language,
    industry: topIndustry,
    keywordAnalysis: sortedKeywords,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    formattingStrengths: [
      messages.strengths.contact,
      "Section headers are clear",
      "Content length is appropriate"
    ],
    formattingWeaknesses: [
      "Format could be more consistent",
      messages.weaknesses.actionVerbs,
      "Content could be more focused"
    ],
    formattingRecommendations: [
      messages.recommendations.sections,
      messages.recommendations.actionVerbs,
      "Use consistent formatting throughout the document"
    ]
  };
}

/**
 * Detect the language of the CV content
 * Uses a simplified approach based on language-specific patterns
 * @param text The CV content
 * @returns ISO language code (en, es, fr, de)
 */
function detectLanguage(text: string): string {
  // Normalize and clean the text
  const normalizedText = text.toLowerCase();
  
  // Language-specific words with their frequencies
  const langPatterns: Record<string, string[]> = {
    "en": ["experience", "education", "skills", "summary", "profile", "job", "work", "about", "contact", "university", "college", "degree"],
    "es": ["experiencia", "educación", "habilidades", "resumen", "perfil", "trabajo", "empleo", "sobre", "contacto", "universidad", "licenciatura", "título"],
    "fr": ["expérience", "éducation", "compétences", "résumé", "profil", "travail", "emploi", "propos", "contact", "université", "diplôme", "formation"],
    "de": ["erfahrung", "bildung", "fähigkeiten", "zusammenfassung", "profil", "arbeit", "beschäftigung", "über", "kontakt", "universität", "studium", "abschluss"]
  };
  
  // Count occurrences of language-specific words
  const langScores: Record<string, number> = {
    "en": 0,
    "es": 0,
    "fr": 0,
    "de": 0
  };
  
  // Get word counts for each language
  Object.entries(langPatterns).forEach(([lang, patterns]) => {
    patterns.forEach(pattern => {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        langScores[lang] += matches.length;
      }
    });
  });
  
  // Determine the language with the highest score
  let detectedLang = "en"; // Default to English
  let highestScore = 0;
  
  Object.entries(langScores).forEach(([lang, score]) => {
    if (score > highestScore) {
      highestScore = score;
      detectedLang = lang;
    }
  });
  
  return detectedLang;
}
