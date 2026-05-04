import { Link, Stack, Typography } from '@mui/material';
import { Trans, useTranslation } from 'react-i18next';
import LegalLayout from '../../../components/LegalLayout/LegalLayout';
import PrivacySection from './partials/PrivacySection';

const PrivacyPage = () => {
  const { t } = useTranslation();

  return (
    <LegalLayout documentTitle="Datenschutzerklärung — Merch Miner">
      <Typography variant="h4" component="h1" gutterBottom>
        {t('legal.privacy.title', 'Datenschutzerklärung')}
      </Typography>

      <Stack spacing={3}>
        <PrivacySection
          headingKey="legal.privacy.section_overview.heading"
          headingFallback="1. Datenschutz auf einen Blick"
        >
          <Typography variant="subtitle1" component="h3" gutterBottom>
            {t(
              'legal.privacy.section_overview.subheading',
              'Allgemeine Hinweise',
            )}
          </Typography>
          <Typography variant="body1">
            {t(
              'legal.privacy.section_overview.body',
              'Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können. Ausführliche Informationen zum Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgeführten Datenschutzerklärung.',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.responsible_party.heading"
          headingFallback="Hinweis zur verantwortlichen Stelle"
        >
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }} gutterBottom>
            {t(
              'legal.privacy.responsible_party.body',
              'Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:\n\nMario Winter\nAußenliegend 4\n61209 Echzell\nDeutschland',
            )}
          </Typography>
          <Typography variant="body1">
            <Trans
              i18nKey="legal.privacy.responsible_party.contact_phone"
              components={{ a: <Link href="tel:+491601546188" /> }}
            >
              Telefon: <a href="tel:+491601546188">+49 1601546188</a>
            </Trans>
            {' · '}
            <Trans
              i18nKey="legal.privacy.responsible_party.contact_email"
              components={{ a: <Link href="mailto:mariowinter.sg@gmail.com" /> }}
            >
              E-Mail: <a href="mailto:mariowinter.sg@gmail.com">mariowinter.sg@gmail.com</a>
            </Trans>
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.hosting.heading"
          headingFallback="2. Hosting (Strato)"
        >
          <Typography variant="body1" gutterBottom>
            {t(
              'legal.privacy.hosting.body',
              'Wir hosten die Inhalte unserer Website bei der Strato AG, Otto-Ostrowski-Straße 7, 10249 Berlin („Strato"). Wenn Sie unsere Website besuchen, erfasst Strato verschiedene Logfiles einschließlich Ihrer IP-Adressen. Die Verwendung von Strato erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Wir haben ein berechtigtes Interesse an einer möglichst zuverlässigen Darstellung unserer Website. Wir haben mit Strato einen Vertrag über Auftragsverarbeitung (AVV) geschlossen.',
            )}
          </Typography>
          <Typography variant="body2">
            <Trans
              i18nKey="legal.privacy.hosting.link"
              components={{
                a: (
                  <Link
                    href="https://www.strato.de/datenschutz/"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            >
              {'Weitere Informationen: '}
              <a>https://www.strato.de/datenschutz/</a>
            </Trans>
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.supabase.heading"
          headingFallback="Datenbank & Storage (Supabase / PostgreSQL)"
        >
          <Typography variant="body1">
            {t(
              'legal.privacy.supabase.body',
              'Anwendungsdaten (Workspaces, Niches, Designs, Listings) speichern wir in einer selbst gehosteten PostgreSQL-Datenbank auf Basis der Supabase-Plattform. Die Datenbank läuft auf unserer eigenen Infrastruktur in Deutschland (Strato), es findet keine Datenübertragung an Supabase Inc. statt. Die Speicherung erfolgt zur Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO sowie auf Grundlage unseres berechtigten Interesses an einer technisch zuverlässigen Bereitstellung der Anwendung (Art. 6 Abs. 1 lit. f DSGVO).',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.jwt_auth.heading"
          headingFallback="Authentifizierung (JWT-Cookie)"
        >
          <Typography variant="body1">
            {t(
              'legal.privacy.jwt_auth.body',
              'Zur Authentifizierung registrierter Nutzer verwenden wir ein HttpOnly-Cookie mit einem signierten JWT-Token. Das Cookie ist technisch notwendig für den Login-Status und wird auf Grundlage von § 25 Abs. 2 Nr. 2 TDDDG sowie Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) gesetzt. Es enthält keine Tracking-Informationen und wird ausschließlich zur Sitzungs- und Zugriffskontrolle verwendet. Das Cookie wird mit dem Logout gelöscht.',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.langfuse.heading"
          headingFallback="LLM-Observability (Langfuse, selbst gehostet)"
        >
          <Typography variant="body1">
            {t(
              'legal.privacy.langfuse.body',
              'Zur Qualitätssicherung und Fehleranalyse unserer KI-gestützten Funktionen setzen wir Langfuse ein. Langfuse läuft auf unserer eigenen Infrastruktur (Strato, Deutschland) und protokolliert Eingaben und Antworten der KI-Modelle einschließlich Metadaten (Latenz, Token-Verbrauch, Modellname). Eine Übermittlung an Dritte findet nicht statt. Rechtsgrundlage ist unser berechtigtes Interesse an einer fehlerfreien und sicheren Bereitstellung der KI-Funktionen (Art. 6 Abs. 1 lit. f DSGVO).',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.openrouter.heading"
          headingFallback="LLM-API (OpenRouter)"
        >
          <Typography variant="body1">
            {t(
              'legal.privacy.openrouter.body',
              'Für KI-gestützte Funktionen (z.B. Niche-Recherche, Slogan- und Design-Generierung) übermitteln wir die zur Bearbeitung Ihrer Anfrage notwendigen Eingaben an OpenRouter, Inc. (1111B S Governors Ave #6589, Dover, DE 19904, USA). OpenRouter leitet diese Anfragen an die jeweiligen Modellanbieter weiter. Eine Übermittlung in die USA findet statt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung). Die Datenübertragung in die USA wird auf die Standardvertragsklauseln der EU-Kommission gestützt. Es werden keine Inhalte über die zur Beantwortung der jeweiligen Anfrage notwendigen Daten hinaus an OpenRouter übermittelt.',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.n8n.heading"
          headingFallback="Workflow-Automation (n8n, selbst gehostet)"
        >
          <Typography variant="body1">
            {t(
              'legal.privacy.n8n.body',
              'Für interne Automatisierungen (Datenerfassung, KI-Pipelines) betreiben wir eine eigene Instanz der Open-Source-Software n8n auf unserer Infrastruktur (Strato, Deutschland). Es findet keine Datenübertragung an n8n GmbH oder andere Dritte statt. Rechtsgrundlage für die Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) bzw. Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer effizienten Bereitstellung der Anwendung).',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.onedrive.heading"
          headingFallback="Cloud-Storage-Import: OneDrive"
        >
          <Typography variant="body1">
            {t(
              'legal.privacy.onedrive.body',
              'Optional bieten wir Ihnen die Möglichkeit, Inhalte aus Ihrem persönlichen Microsoft OneDrive in Merch Miner zu importieren. Anbieter ist die Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Irland. Die Verbindung zu OneDrive wird ausschließlich nach Ihrer ausdrücklichen Einwilligung (OAuth-Autorisierung) hergestellt. Microsoft kann hierbei Verbindungsdaten einschließlich Ihrer IP-Adresse erfassen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO; die Einwilligung ist jederzeit widerrufbar. Microsoft ist nach dem EU-US Data Privacy Framework zertifiziert.',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.google_drive.heading"
          headingFallback="Cloud-Storage-Import: Google Drive"
        >
          <Typography variant="body1">
            {t(
              'legal.privacy.google_drive.body',
              'Optional bieten wir Ihnen die Möglichkeit, Inhalte aus Ihrem persönlichen Google Drive in Merch Miner zu importieren. Anbieter ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Die Verbindung zu Google Drive wird ausschließlich nach Ihrer ausdrücklichen Einwilligung (OAuth-Autorisierung) hergestellt. Google kann hierbei Verbindungsdaten einschließlich Ihrer IP-Adresse erfassen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO; die Einwilligung ist jederzeit widerrufbar. Google ist nach dem EU-US Data Privacy Framework zertifiziert.',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.user_rights.heading"
          headingFallback="Ihre Rechte als betroffene Person"
        >
          <Typography variant="body1" gutterBottom>
            {t(
              'legal.privacy.user_rights.body',
              'Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten, deren Herkunft und Empfänger sowie den Zweck der Datenverarbeitung. Sie haben außerdem das Recht auf Berichtigung, Löschung oder Einschränkung der Verarbeitung dieser Daten. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberührt. Darüber hinaus haben Sie das Recht auf Datenübertragbarkeit gemäß Art. 20 DSGVO.',
            )}
          </Typography>
          <Typography variant="body1">
            {t(
              'legal.privacy.user_rights.complaint',
              'Im Falle datenschutzrechtlicher Verstöße steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat ihres gewöhnlichen Aufenthalts, ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.',
            )}
          </Typography>
        </PrivacySection>

        <PrivacySection
          headingKey="legal.privacy.contact.heading"
          headingFallback="Kontakt"
        >
          <Typography variant="body1">
            <Trans
              i18nKey="legal.privacy.contact.body"
              components={{ a: <Link href="mailto:mariowinter.sg@gmail.com" /> }}
            >
              Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte erreichen
              Sie uns unter{' '}
              <a href="mailto:mariowinter.sg@gmail.com">mariowinter.sg@gmail.com</a>.
            </Trans>
          </Typography>
        </PrivacySection>
      </Stack>
    </LegalLayout>
  );
};

export default PrivacyPage;
