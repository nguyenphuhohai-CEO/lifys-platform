import React, { useEffect } from 'react';
import SiteFooter from '../components/SiteFooter';

const VERSION = '18 octobre 2026';
const CONTACT = '[À COMPLÉTER : e-mail de contact]';

const PAGES = {
  cgu: {
    title: 'Conditions générales d’utilisation',
    sections: [
      ['1. Objet', 'Les présentes conditions régissent l’utilisation de Lifys, service de mise en relation permettant de faire des rencontres dans cinq catégories : amicales, amoureuses, sans lendemain, mariage et professionnelles.'],
      ['2. Accès au service', 'Le service est réservé aux personnes majeures (18 ans révolus). En créant un compte, vous confirmez avoir au moins 18 ans, que les informations fournies sont exactes et que vous n’utiliserez qu’un seul compte.'],
      ['3. Compte et sécurité', 'Vous êtes responsable de la confidentialité de votre mot de passe. Une adresse e-mail valide doit être confirmée pour accéder aux fonctionnalités de rencontre. Prévenez-nous immédiatement en cas d’utilisation frauduleuse de votre compte.'],
      ['4. Règles de conduite', 'Il est interdit de : usurper une identité, publier des contenus illicites, haineux, violents, pornographiques ou discriminatoires, harceler d’autres membres, démarcher à des fins commerciales ou frauduleuses (arnaques, escroqueries sentimentales), ou contourner les mesures de sécurité du service. Les rencontres « sans lendemain » doivent toujours reposer sur le consentement explicite de toutes les personnes concernées.'],
      ['5. Modération', 'Chaque membre peut signaler ou bloquer un profil. Lifys peut examiner les signalements, supprimer des contenus et suspendre ou supprimer tout compte contrevenant aux présentes conditions, sans préavis en cas de manquement grave.'],
      ['6. Contenus', 'Vous conservez vos droits sur les contenus que vous publiez et accordez à Lifys une licence limitée, non exclusive, pour les afficher aux autres membres dans le cadre du service.'],
      ['7. Rencontres en personne', 'Lifys ne vérifie pas l’identité des membres. Soyez prudent : retrouvez-vous dans un lieu public, informez un proche et ne communiquez jamais d’argent ni d’informations bancaires.'],
      ['8. Responsabilité', 'Lifys est un intermédiaire technique et n’est pas responsable du comportement des membres ni des rencontres. Le service est fourni « en l’état », sans garantie de disponibilité continue, dans les limites autorisées par la loi.'],
      ['9. Suppression du compte', 'Vous pouvez supprimer votre compte à tout moment depuis la page Profil. Vos données sont alors effacées, sous réserve des obligations légales de conservation.'],
      ['10. Modification, droit applicable', 'Lifys peut modifier ces conditions ; les membres en seront informés. Les présentes sont soumises au droit français. En cas de litige, vous pouvez recourir à un médiateur de la consommation : [À COMPLÉTER : médiateur].'],
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    sections: [
      ['1. Responsable du traitement', `[À COMPLÉTER : raison sociale et adresse]. Contact : ${CONTACT}.`],
      ['2. Données collectées', 'Adresse e-mail, mot de passe (stocké uniquement sous forme hachée), prénom, âge, ville, biographie, centres d’intérêt, photo (URL), catégories de rencontre, likes, matchs, messages, signalements et blocages, date d’acceptation des CGU.'],
      ['3. Finalités et bases légales', 'Fournir le service de rencontre (exécution du contrat) ; assurer la sécurité, lutter contre la fraude et modérer (intérêt légitime) ; respecter nos obligations légales. Les e-mails que nous envoyons sont strictement transactionnels (confirmation d’adresse).'],
      ['4. Données sensibles', 'Votre catégorie de rencontre et vos messages peuvent révéler des informations relevant de votre vie intime. Ne publiez que ce que vous souhaitez partager ; ces données ne sont jamais utilisées à des fins publicitaires.'],
      ['5. Destinataires', 'Les autres membres voient votre profil public (prénom, âge, ville, bio, centres d’intérêt, photo, catégorie), jamais votre e-mail. Nos prestataires techniques (hébergement, envoi d’e-mails) traitent les données uniquement pour notre compte. Aucune donnée n’est vendue.'],
      ['6. Durée de conservation', 'Les données sont conservées tant que le compte est actif et supprimées à sa suppression. Les comptes inactifs pendant plus de 3 ans peuvent être supprimés.'],
      ['7. Vos droits', `Accès, rectification, effacement, portabilité, limitation et opposition. Depuis la page Profil, vous pouvez télécharger vos données et supprimer votre compte. Pour toute autre demande : ${CONTACT}. Vous pouvez saisir la CNIL (www.cnil.fr).`],
      ['8. Cookies et stockage local', 'Lifys n’utilise aucun cookie publicitaire ni traceur. Un jeton de session est conservé dans le stockage local de votre navigateur pour vous maintenir connecté.'],
      ['9. Sécurité', 'Connexion chiffrée (HTTPS), mots de passe hachés, limitation des tentatives de connexion et accès restreint aux données.'],
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    sections: [
      ['Éditeur', '[À COMPLÉTER : raison sociale, forme juridique, capital, adresse, SIREN/RCS, numéro de TVA]'],
      ['Directeur de la publication', '[À COMPLÉTER]'],
      ['Contact', CONTACT],
      ['Hébergeur', '[À COMPLÉTER : nom, adresse et téléphone de l’hébergeur]'],
    ],
  },
};

export default function LegalPage({ page }) {
  const content = PAGES[page];

  useEffect(() => {
    document.title = `${content.title} · Lifys`;
  }, [content.title]);

  return (
    <div className="app-shell">
      <main className="page-shell legal-page">
        <a className="legal-back" href="/">← Retour à Lifys</a>
        <h1>{content.title}</h1>
        <p className="legal-meta">Version du {VERSION}</p>
        <p className="legal-draft">
          Document type en cours de finalisation : les mentions entre crochets doivent être complétées et l’ensemble validé par un professionnel du droit avant l’ouverture au public.
        </p>
        {content.sections.map(([heading, text]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{text}</p>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
