import { Box, Link, Stack, Typography } from '@mui/material';
import { Trans, useTranslation } from 'react-i18next';
import LegalLayout from '../../../components/LegalLayout/LegalLayout';

const ImprintPage = () => {
  const { t } = useTranslation();

  return (
    <LegalLayout documentTitle="Impressum — Merch Miner">
      <Typography variant="h4" component="h1" gutterBottom>
        {t('legal.imprint.title', 'Impressum')}
      </Typography>

      <Stack spacing={3}>
        <Box component="section">
          <Typography variant="h6" component="h2" gutterBottom>
            {t('legal.imprint.operator.heading', 'Angaben gemäß § 5 TMG')}
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
            {t(
              'legal.imprint.operator.body',
              'Mario Winter\nAußenliegend 4\n61209 Echzell\nDeutschland',
            )}
          </Typography>
        </Box>

        <Box component="section">
          <Typography variant="h6" component="h2" gutterBottom>
            {t('legal.imprint.contact.heading', 'Kontakt')}
          </Typography>
          <Typography variant="body1">
            <Trans
              i18nKey="legal.imprint.contact.phone_line"
              components={{ a: <Link href="tel:+491601546188" /> }}
            >
              {'Telefon: '}
              <a>+49 1601546188</a>
            </Trans>
          </Typography>
          <Typography variant="body1">
            <Trans
              i18nKey="legal.imprint.contact.email_line"
              components={{ a: <Link href="mailto:mariowinter.sg@gmail.com" /> }}
            >
              {'E-Mail: '}
              <a>mariowinter.sg@gmail.com</a>
            </Trans>
          </Typography>
        </Box>

        <Box component="section">
          <Typography variant="h6" component="h2" gutterBottom>
            {t('legal.imprint.languages.heading', 'Verfügbare Sprachen')}
          </Typography>
          <Typography variant="body1">
            {t(
              'legal.imprint.languages.body',
              'Diese Website ist in folgenden Sprachen verfügbar: Deutsch, Englisch, Französisch, Spanisch und Italienisch.',
            )}
          </Typography>
        </Box>

        <Box component="section">
          <Typography variant="h6" component="h2" gutterBottom>
            {t(
              'legal.imprint.vat.heading',
              'Umsatzsteuer-Identifikationsnummer',
            )}
          </Typography>
          <Typography variant="body1">
            {t(
              'legal.imprint.vat.body',
              'Umsatzsteuer-ID gemäß § 27 a Umsatzsteuergesetz: DE327848620',
            )}
          </Typography>
        </Box>

        <Box component="section">
          <Typography variant="h6" component="h2" gutterBottom>
            {t('legal.imprint.dsa.heading', 'Kontaktstelle gemäß Art. 12 DSA')}
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
            {t(
              'legal.imprint.dsa.body',
              'Kontaktstelle für Behörden und Nutzer gemäß Art. 11, 12 Digital Services Act (DSA):\n\nMario Winter\nAußenliegend 4\n61209 Echzell\nDeutschland\n\nTelefon: +49 1601546188\nE-Mail: mariowinter.sg@gmail.com\n\nDie Kommunikation kann auf Deutsch oder Englisch erfolgen.',
            )}
          </Typography>
        </Box>

        <Box component="section">
          <Typography variant="h6" component="h2" gutterBottom>
            {t('legal.imprint.disclaimer.heading', 'Haftungsausschluss')}
          </Typography>

          <Typography variant="subtitle1" component="h3" gutterBottom>
            {t(
              'legal.imprint.disclaimer.content_heading',
              'Haftung für Inhalte',
            )}
          </Typography>
          <Typography variant="body1" gutterBottom>
            {t(
              'legal.imprint.disclaimer.content_body',
              'Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.',
            )}
          </Typography>

          <Typography variant="subtitle1" component="h3" gutterBottom>
            {t('legal.imprint.disclaimer.links_heading', 'Haftung für Links')}
          </Typography>
          <Typography variant="body1" gutterBottom>
            {t(
              'legal.imprint.disclaimer.links_body',
              'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.',
            )}
          </Typography>

          <Typography variant="subtitle1" component="h3" gutterBottom>
            {t('legal.imprint.disclaimer.copyright_heading', 'Urheberrecht')}
          </Typography>
          <Typography variant="body1">
            {t(
              'legal.imprint.disclaimer.copyright_body',
              'Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.',
            )}
          </Typography>
        </Box>
      </Stack>
    </LegalLayout>
  );
};

export default ImprintPage;
