import React, { useEffect } from 'react';
import SiteFooter from '../components/SiteFooter';
import { useI18n } from '../i18n';

const CONTACT = '[À COMPLÉTER : e-mail de contact]';

const PAGES = {
  'a-propos': {
    title: 'À propos de Lifys',
    sections: [
      ['Notre mission', 'Lifys réunit cinq sites de rencontres distincts — Amis, Love, Éphémère, Mariage et Pro — pour que chacun trouve exactement le type de relation qu’il cherche, sans mélange des genres.'],
      ['Un compte, cinq univers', 'Un seul compte permet d’accéder aux cinq sites, chacun avec ses propres profils, ses champs et son score de compatibilité adaptés à son objectif.'],
      ['Nos engagements', 'Modération active, vérification par selfie, aucun profil fictif présenté comme réel, données protégées conformément au RGPD, et pas de revente de vos données personnelles.'],
    ],
  },
  aide: {
    title: 'Aide et questions fréquentes',
    sections: [
      ['Comment créer un compte ?', 'Choisissez un site, renseignez votre prénom, votre e-mail et un mot de passe, acceptez les CGU (18 ans minimum) puis confirmez votre adresse e-mail grâce au lien reçu.'],
      ['Je n’ai pas reçu l’e-mail de confirmation', 'Vérifiez vos courriers indésirables, puis demandez un nouvel envoi depuis votre profil. Si le problème persiste, contactez-nous.'],
      ['Comment fonctionne un match ?', 'Un match se crée quand deux personnes s’apprécient mutuellement. Il expire au bout de 24 h si personne n’écrit : lancez la conversation !'],
      ['Comment passer à Premium ?', 'Depuis la page Offres, le paiement est sécurisé par Stripe. Vous pouvez gérer ou résilier votre abonnement à tout moment depuis le portail de facturation.'],
      ['Comment supprimer mon compte ?', 'Depuis votre profil, la suppression du compte efface vos données, photos et conversations.'],
    ],
  },
  securite: {
    title: 'Sécurité et modération',
    sections: [
      ['Profils vérifiés', 'Le badge « vérifié » indique qu’un selfie a été contrôlé par notre équipe. Il ne constitue pas une vérification d’identité officielle.'],
      ['Signaler et bloquer', 'Vous pouvez signaler ou bloquer un profil à tout moment. Notre équipe examine chaque signalement et peut suspendre un compte.'],
      ['Nos conseils', 'Ne communiquez jamais d’argent, de coordonnées bancaires ou de pièces d’identité. Pour une première rencontre, choisissez un lieu public et prévenez un proche. Méfiez-vous des demandes d’argent : c’est le signe d’une arnaque.'],
      ['Vos données', 'Les données sont hébergées de manière sécurisée, la connexion est chiffrée (HTTPS) et vos mots de passe sont stockés sous forme hachée.'],
    ],
  },
  contact: {
    title: 'Nous contacter',
    sections: [
      ['Support', 'Pour toute question, un signalement ou une demande relative à vos données (accès, rectification, suppression), écrivez-nous : {contact}'],
      ['Délai de réponse', 'Nous répondons sous 48 heures ouvrées.'],
    ],
  },
};

export default function InfoPage({ page }) {
  const { t } = useI18n();
  const content = PAGES[page];

  useEffect(() => {
    document.title = `${content.title} · Lifys`;
  }, [content.title]);

  return (
    <div className="app-shell">
      <main className="page-shell legal-page">
        <a className="legal-back" href="/">← {t('Retour à Lifys')}</a>
        <h1>{t(content.title)}</h1>
        {content.sections.map(([heading, text]) => (
          <section key={heading}>
            <h2>{t(heading)}</h2>
            <p>{t(text, { contact: CONTACT })}</p>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
