# Texte de sollicitation des cinq dépositaires

> À envoyer aux cinq personnes pressenties pour porter une part du sel scellé (Shamir 3-sur-5). Le protocole complet est dans [sealed-salt-ceremony.md](sealed-salt-ceremony.md).

---

**Objet : Demande de participation à un dispositif citoyen de vérification cryptographique**

Madame, Monsieur,

Une plateforme de pétition vérifiable, **ReferendumJa**, a été développée pour permettre aux citoyens andorrans de demander la tenue d'un référendum consultatif avant la signature de l'accord d'association avec l'Union Européenne. Le code est intégralement open source (AGPL-3.0). Le dispositif a été conçu pour répondre à la critique de non-vérifiabilité formulée par le porte-parole du Govern à propos de change.org.

Le système repose sur une garantie d'anonymat dont la solidité dépend d'un **sel cryptographique secret** de 32 octets, partagé en cinq fragments selon le schéma de Shamir (3 fragments sur 5 reconstituent le secret). Nous vous sollicitons pour conserver l'un de ces cinq fragments.

**Votre engagement, si vous l'acceptez, consisterait en deux points :**

1. Conserver de manière sûre un fichier numérique de quelques kilo-octets pendant la durée de la collecte (durée estimée : 4 à 8 semaines).
2. Vous engager publiquement, par déclaration signée, à ne reconstituer le secret avec d'autres dépositaires **qu'à la fin de la collecte**, et **uniquement** pour le remettre au Govern d'Andorra dans le cadre de la procédure de vérification officielle.

**Ce que ce dispositif protège :** tant que trois dépositaires sur cinq n'ont pas reconstitué le sel, personne — pas même un acteur disposant illégalement de la liste complète des NIA andorrans — ne peut identifier les signataires de la pétition. Votre rôle est une garantie civique : vous êtes l'un des cinq gardiens de l'anonymat des signataires, et donc l'un des cinq remparts contre toute pression politique.

**Ce qui ne vous engage pas :** vous n'avez aucun rôle technique au-delà de la conservation du fichier. Vous n'avez aucune responsabilité juridique sur le contenu de la pétition ni sur les choix politiques de ses signataires. Votre nom apparaîtra publiquement comme dépositaire — c'est précisément la garantie offerte aux signataires.

Si vous acceptez, nous vous proposerons une **cérémonie publique filmée** pour la génération du sel et la remise des fragments. La cérémonie sera publiée pour transparence intégrale.

Nous restons à votre disposition pour toute question technique, et pouvons vous mettre en relation avec un expert cryptographique indépendant si vous souhaitez auditer le dispositif avant engagement.

Cordialement,

*Artur Homs, président de Claror*
*Pour l'équipe ReferendumJa*

---

## Versions courtes

**Catalan** (si nécessaire — à valider par Artur)

> Sol·licitem la teva participació com a dipositari d'un dels cinc fragments del «sel segellat» del sistema criptogràfic de ReferendumJa. Aquesta missió garanteix que ningú — ni el Govern, ni un periodista, ni un partit, ni un adversari — pugui identificar els signants mentre la petició estigui oberta. Cap habilitat tècnica no és necessària. Adjuntem la versió completa de la sol·licitud.

**English** (for international cryptographic reviewers if any)

> We are inviting you to act as one of five public custodians of a 32-byte secret salt, split using Shamir 3-of-5. Your role is to preserve a small encrypted file and to publicly commit not to reconstitute the secret until the end of the petition. This guarantees that no single actor — including the Govern — can deanonymise signatories during collection. Full protocol attached.
