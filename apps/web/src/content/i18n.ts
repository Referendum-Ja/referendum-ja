// Trilingual content. The Catalan version is the canonical source.
// French and Spanish translations follow the validated Catalan text.
//
// The petition body itself lives in petition.ca|fr|es.md (TBD: Paul to paste
// the verbatim Catalan text from Artur Homs's change.org page).

export const LOCALES = ["ca", "fr", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LABELS = {
  ca: {
    nav: { home: "Petició", how: "Com funciona", transparency: "Transparència", verification: "Verificació", legal: "Avís legal", github: "Codi font" },
    sign: {
      title: "Signa la petició",
      eligibility: "Reservat als ciutadans andorrans amb passaport andorrà vigent.",
      niaLabel: "NIA (6 xifres + 1 lletra)",
      niaHelp: "El NIA és imprès al teu passaport andorrà i al DNI. És persistent: no canvia mai, fins i tot quan renoves el passaport.",
      niaPrivacy: "Aquest número no surt mai del teu navegador.",
      initialsLabel: "Inicials (opcional, màxim 4)",
      commentLabel: "Comentari públic (opcional, màxim 280 caràcters)",
      rgpdConsent: "He llegit la política de privacitat i accepto que el meu compromís criptogràfic sigui publicat.",
      cta: "Calcular la meva empremta i signar",
      computingNote: "Aquest càlcul es fa al teu dispositiu i triga uns 3-5 segons. És normal.",
      successTitle: "Gràcies. La teva signatura ha estat registrada.",
      duplicateTitle: "Aquest document ja ha signat.",
      duplicateBody: "Cada ciutadà només pot signar una vegada. Si creus que es tracta d'un error, contacta amb l'equip a través del formulari de mencions legals.",
    },
    counter: { label: "signatures verificades" },
  },
  fr: {
    nav: { home: "Pétition", how: "Comment ça marche", transparency: "Transparence", verification: "Vérification", legal: "Mentions légales", github: "Code source" },
    sign: {
      title: "Signer la pétition",
      eligibility: "Réservé aux citoyens andorrans titulaires d'un passeport andorran en cours de validité.",
      niaLabel: "NIA (6 chiffres + 1 lettre)",
      niaHelp: "Le NIA est imprimé sur votre passeport andorran et sur le DNI. Il est persistant : il ne change jamais, même lors du renouvellement du passeport.",
      niaPrivacy: "Ce numéro ne quitte jamais votre navigateur.",
      initialsLabel: "Initiales (optionnel, 4 caractères maximum)",
      commentLabel: "Commentaire public (optionnel, 280 caractères maximum)",
      rgpdConsent: "J'ai lu la politique de confidentialité et j'accepte que mon engagement cryptographique soit publié.",
      cta: "Calculer mon empreinte et signer",
      computingNote: "Ce calcul se fait sur votre appareil et prend environ 3-5 secondes. C'est normal.",
      successTitle: "Merci. Votre signature a été enregistrée.",
      duplicateTitle: "Ce document a déjà signé.",
      duplicateBody: "Chaque citoyen ne peut signer qu'une seule fois. Si vous pensez qu'il s'agit d'une erreur, contactez l'équipe via le formulaire en mentions légales.",
    },
    counter: { label: "signatures vérifiées" },
  },
  es: {
    nav: { home: "Petición", how: "Cómo funciona", transparency: "Transparencia", verification: "Verificación", legal: "Aviso legal", github: "Código fuente" },
    sign: {
      title: "Firmar la petición",
      eligibility: "Reservado a los ciudadanos andorranos con pasaporte andorrano vigente.",
      niaLabel: "NIA (6 cifras + 1 letra)",
      niaHelp: "El NIA está impreso en su pasaporte andorrano y en el DNI. Es persistente: no cambia nunca, ni siquiera al renovar el pasaporte.",
      niaPrivacy: "Este número nunca sale de su navegador.",
      initialsLabel: "Iniciales (opcional, máximo 4)",
      commentLabel: "Comentario público (opcional, máximo 280 caracteres)",
      rgpdConsent: "He leído la política de privacidad y acepto que mi compromiso criptográfico sea publicado.",
      cta: "Calcular mi huella y firmar",
      computingNote: "Este cálculo se hace en su dispositivo y tarda unos 3-5 segundos. Es normal.",
      successTitle: "Gracias. Su firma ha sido registrada.",
      duplicateTitle: "Este documento ya ha firmado.",
      duplicateBody: "Cada ciudadano solo puede firmar una vez. Si cree que se trata de un error, contacte con el equipo a través del formulario de avisos legales.",
    },
    counter: { label: "firmas verificadas" },
  },
} as const;

export function getLabels(locale: Locale) {
  return LABELS[locale];
}
