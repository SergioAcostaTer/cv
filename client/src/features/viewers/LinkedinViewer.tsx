import { AtSign, BriefcaseBusiness, Copy, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui';
import type { LinkedinJson, LinkedinLanguageProfile } from '../../types';

type LinkedinViewerProps = {
  data: LinkedinJson;
  onCopySection: (text: string, label: string) => void;
};

const availableLanguages = (value: LinkedinJson): string[] => {
  const profile = value.profile ?? {};
  return Object.keys(profile).filter((key) => profile[key]);
};

const getLanguageProfile = (value: LinkedinJson, lang: string): LinkedinLanguageProfile => {
  const profile = value.profile?.[lang];
  if (!profile) {
    return {};
  }

  return profile;
};

const safeText = (value: string | undefined, fallback = ''): string => {
  if (!value) {
    return fallback;
  }

  return value.trim();
};

const copyReady = (value: string | undefined, fallback = ''): string => {
  if (value == null || value.length === 0) {
    return fallback;
  }

  // Keep user/model spacing intact while using Windows-friendly line endings.
  return value.replace(/\r?\n/g, '\r\n');
};

const formatMonthYear = (value: string | undefined, locale: string): string => {
  if (!value) {
    return locale === 'es' ? 'Fecha no especificada' : 'Date not specified';
  }

  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return value;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return value;
  }

  const date = new Date(Date.UTC(year, month - 1, 1));
  const formatted = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date);
  return locale === 'es' ? formatted.replace(' ', '. ') : formatted;
};

const formatJobBlock = (
  entry: LinkedinLanguageProfile['experience'] extends Array<infer T> ? T : never,
  lang: string
): string => {
  const locale = lang.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US';
  const isSpanish = locale === 'es-ES';
  const start = formatMonthYear(entry.startDate, locale);
  const end = safeText(entry.endDate, isSpanish ? 'Actualidad' : 'Present');
  const period = `${start} - ${end}`;
  const location = safeText(entry.location, isSpanish ? 'Ubicacion no especificada' : 'Location not specified');
  const employment = safeText(entry.employmentType, isSpanish ? 'Jornada completa' : 'Full-time');
  const rawDescription = safeText(entry.description, isSpanish ? 'Sin descripcion generada.' : 'No description generated.');
  const achievements = (entry.achievements ?? []).filter((item) => item.trim().length > 0);
  const techContext = (entry.techContext ?? []).filter((item) => item.trim().length > 0);

  const paragraphs = rawDescription
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const first = paragraphs[0] ?? rawDescription;
  const second =
    paragraphs[1] ??
    (techContext.length
      ? isSpanish
        ? `Trabajo con ${techContext.slice(0, 6).join(', ')} para construir y mantener servicios robustos e integraciones escalables.`
        : `I work with ${techContext.slice(0, 6).join(', ')} to build and maintain robust services and scalable integrations.`
      : isSpanish
        ? 'Participo en el diseno e implementacion de soluciones backend mantenibles, seguras y orientadas al negocio.'
        : 'I contribute to designing and implementing maintainable, secure backend solutions aligned with business goals.');

  const third =
    paragraphs[2] ??
    (achievements[0]
      ? isSpanish
        ? `Impacto: ${achievements[0]}`
        : `Impact: ${achievements[0]}`
      : isSpanish
        ? 'He contribuido a mejorar la fiabilidad operativa y la calidad de entrega en entornos de produccion.'
        : 'I helped improve operational reliability and delivery quality in production environments.');

  const description = [first, second, third].join('\n\n');

  const lines: string[] = [
    safeText(entry.title, isSpanish ? 'Puesto' : 'Role'),
    '',
    `${safeText(entry.company, isSpanish ? 'Empresa' : 'Company')} · ${employment}`,
    '',
    period,
    '',
    location,
    '',
    description
  ];

  return lines.join('\n');
};

const Snippet = (props: { text: string }) => (
  <pre className="m-0 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-800 whitespace-pre-wrap">
    {props.text}
  </pre>
);

export const LinkedinViewer = ({ data, onCopySection }: LinkedinViewerProps) => {
  const langs = useMemo(() => {
    const values = availableLanguages(data);
    return values.length ? values : ['en'];
  }, [data]);

  const [currentLang, setCurrentLang] = useState(langs[0]);

  return (
    <Tabs value={currentLang} onValueChange={setCurrentLang}>
      <TabsList>
        {langs.map((lang) => (
          <TabsTrigger key={lang} value={lang}>
            {lang.toUpperCase()}
          </TabsTrigger>
        ))}
      </TabsList>

      {langs.map((lang) => {
        const langProfile = getLanguageProfile(data, lang);
        const profile = langProfile.profile ?? {};
        const aboutData = langProfile.about ?? {};
        const about = langProfile.about ?? {};
        const experience = langProfile.experience ?? [];
        const headline = safeText(profile.headline, 'No headline generated yet');
        const aboutPaste = safeText(about.descriptionToPaste, about.long ?? about.short ?? 'No About section generated yet.');
        const valueProp = safeText(about.valueProposition);

        return (
          <TabsContent key={lang} value={lang}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AtSign size={16} /> {profile.fullName ?? 'LinkedIn Profile'}
                </CardTitle>
                <Badge variant="brand">{lang.toUpperCase()}</Badge>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-slate-700">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Headline (copy-ready)</p>
                <Snippet text={headline} />
              </CardContent>
              <CardFooter>
                <Button type="button" size="sm" variant="outline" onClick={() => onCopySection(copyReady(profile.headline, headline), `LinkedIn headline (${lang})`)}>
                  <Copy size={14} /> Copy Headline
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles size={15} /> About (paste-ready)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-slate-700">
                <Snippet text={aboutPaste} />
                {valueProp ? <Snippet text={valueProp} /> : null}
              </CardContent>
              <CardFooter>
                <Button type="button" size="sm" variant="outline" onClick={() => onCopySection(copyReady(about.descriptionToPaste ?? about.long ?? about.short, aboutPaste), `LinkedIn about (${lang})`)}>
                  <Copy size={14} /> Copy About
                </Button>
                {valueProp ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => onCopySection(copyReady(about.valueProposition, valueProp), `LinkedIn value proposition (${lang})`)}>
                    <Copy size={14} /> Copy Value Prop
                  </Button>
                ) : null}
              </CardFooter>
            </Card>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BriefcaseBusiness size={15} /> Job descriptions (copy-ready)
                </CardTitle>
                <Badge variant="muted">{experience.length}</Badge>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-slate-700">
                {experience.map((entry, index) => (
                  <div className="grid gap-2 border border-slate-200 p-3" key={`${entry.company ?? 'company'}-${index}`}>
                    <p className="m-0 text-sm font-semibold text-slate-900">{entry.title ?? 'Role'} · {entry.company ?? 'Company'}</p>
                    <p className="m-0 text-xs text-slate-500">{entry.startDate ?? 'Start'} - {entry.endDate ?? 'Present'}</p>
                    <Snippet text={formatJobBlock(entry, lang)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onCopySection(copyReady(formatJobBlock(entry, lang)), `${entry.title ?? 'Job'} LinkedIn block (${lang})`)}
                      >
                        <Copy size={14} /> Copy Full Entry
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onCopySection(copyReady(entry.description, safeText(entry.description)), `${entry.title ?? 'Job'} description (${lang})`)}
                      >
                        <Copy size={14} /> Copy Description Only
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {aboutData.callToAction ? (
              <Card>
                <CardHeader>
                  <CardTitle>Call to action</CardTitle>
                </CardHeader>
                <CardContent>
                  <Snippet text={aboutData.callToAction} />
                </CardContent>
                <CardFooter>
                  <Button type="button" size="sm" variant="outline" onClick={() => onCopySection(copyReady(aboutData.callToAction ?? ''), `LinkedIn CTA (${lang})`)}>
                    <Copy size={14} /> Copy CTA
                  </Button>
                </CardFooter>
              </Card>
            ) : null}
          </TabsContent>
        );
      })}
    </Tabs>
  );
};
