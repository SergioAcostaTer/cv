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

const Snippet = (props: { text: string }) => (
  <pre className="m-0 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-['IBM_Plex_Mono'] text-xs leading-6 text-slate-800 whitespace-pre-wrap">
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
                <Button type="button" size="sm" variant="outline" className="font-['IBM_Plex_Mono']" onClick={() => onCopySection(headline, `LinkedIn headline (${lang})`)}>
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
                <Button type="button" size="sm" variant="outline" className="font-['IBM_Plex_Mono']" onClick={() => onCopySection(aboutPaste, `LinkedIn about (${lang})`)}>
                  <Copy size={14} /> Copy About
                </Button>
                {valueProp ? (
                  <Button type="button" size="sm" variant="outline" className="font-['IBM_Plex_Mono']" onClick={() => onCopySection(valueProp, `LinkedIn value proposition (${lang})`)}>
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
                    <Snippet text={safeText(entry.description, 'No job description generated yet.')} />
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="font-['IBM_Plex_Mono']"
                        onClick={() => onCopySection(safeText(entry.description), `${entry.title ?? 'Job'} description (${lang})`)}
                      >
                        <Copy size={14} /> Copy Job Description
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
                  <Button type="button" size="sm" variant="outline" className="font-['IBM_Plex_Mono']" onClick={() => onCopySection(aboutData.callToAction ?? '', `LinkedIn CTA (${lang})`)}>
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
