import { Copy, GraduationCap, Languages, Lightbulb, Mail, Phone, UserRound, Wrench } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Separator } from '../../components/ui';
import type { ResumeJson } from '../../types';

type ResumeViewerProps = {
  data: ResumeJson;
  onCopySection: (text: string, label: string) => void;
};

const asList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const pickLabel = (value: string | undefined, fallback: string): string => (value && value.trim().length ? value : fallback);

export const ResumeViewer = ({ data, onCopySection }: ResumeViewerProps) => {
  const work = data.work ?? [];
  const education = data.education ?? [];
  const skills = data.skills ?? [];
  const languages = data.languages ?? [];
  const projects = data.projects ?? [];

  const basics = data.basics ?? {};

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound size={16} /> {pickLabel(basics.name, 'Unnamed candidate')}
          </CardTitle>
          <Badge variant="brand">Resume JSON</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p className="m-0 font-semibold text-foreground">{pickLabel(basics.label, 'No professional headline')}</p>
          {basics.summary ? <p className="m-0 leading-6">{basics.summary}</p> : null}
          <div className="grid gap-1 text-xs">
            {basics.email ? (
              <p className="m-0 flex items-center gap-1.5">
                <Mail size={13} /> {basics.email}
              </p>
            ) : null}
            {basics.phone ? (
              <p className="m-0 flex items-center gap-1.5">
                <Phone size={13} /> {basics.phone}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="button" size="sm" variant="outline" onClick={() => onCopySection(JSON.stringify(basics, null, 2), 'Resume basics')}>
            <Copy size={14} /> Copy Basics
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench size={15} /> {pickLabel(data.sectionLabels?.experience, 'Experience')}
          </CardTitle>
          <Badge variant="muted">{work.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {work.map((entry, index) => (
            <div className="grid gap-1 text-sm text-muted-foreground" key={`${entry.name ?? 'company'}-${index}`}>
              <p className="m-0 font-semibold text-foreground">
                {pickLabel(entry.position, 'Role')} at {pickLabel(entry.name, 'Company')}
              </p>
              <p className="m-0 text-xs text-muted-foreground">
                {pickLabel(entry.startDate, 'Unknown start')} - {pickLabel(entry.endDate, data.labels?.present ?? 'Present')}
              </p>
              {entry.summary ? <p className="m-0 leading-6">{entry.summary}</p> : null}
              {asList(entry.highlights).length ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {asList(entry.highlights).map((item) => (
                    <Badge key={item} variant="success">
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button type="button" size="sm" variant="outline" onClick={() => onCopySection(JSON.stringify(work, null, 2), 'Resume experience')}>
            <Copy size={14} /> Copy Experience
          </Button>
        </CardFooter>
      </Card>

      <Separator />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap size={15} /> {pickLabel(data.sectionLabels?.education, 'Education')}
            </CardTitle>
            <Badge variant="muted">{education.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {education.map((item, index) => (
              <div key={`${item.institution ?? 'school'}-${index}`}>
                <p className="m-0 font-semibold text-foreground">{pickLabel(item.institution, 'Institution')}</p>
                <p className="m-0 text-xs text-muted-foreground">
                  {pickLabel(item.studyType, 'Program')} · {pickLabel(item.area, 'Area')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages size={15} /> {pickLabel(data.sectionLabels?.languages, 'Languages')}
            </CardTitle>
            <Badge variant="muted">{languages.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {languages.map((item, index) => (
              <div key={`${item.language ?? 'language'}-${index}`}>
                <p className="m-0 font-semibold text-foreground">{pickLabel(item.language, 'Language')}</p>
                <p className="m-0 text-xs text-muted-foreground">{pickLabel(item.fluency, 'Not specified')}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb size={15} /> {pickLabel(data.sectionLabels?.skills, 'Skills')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {skills.map((skill, index) => (
            <div className="grid gap-1" key={`${skill.name ?? 'skills'}-${index}`}>
              <p className="m-0 text-sm font-semibold text-foreground">{pickLabel(skill.name, 'Category')}</p>
              <div className="flex flex-wrap gap-1">
                {asList(skill.keywords).map((keyword) => (
                  <Badge key={keyword} variant="brand">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {projects.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <Badge variant="muted">{projects.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {projects.map((project, index) => (
              <div className="grid gap-0.5" key={`${project.name ?? 'project'}-${index}`}>
                <p className="m-0 font-semibold text-foreground">{pickLabel(project.name, 'Project')}</p>
                {project.description ? <p className="m-0 leading-6">{project.description}</p> : null}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button type="button" size="sm" variant="outline" onClick={() => onCopySection(JSON.stringify(projects, null, 2), 'Resume projects')}>
              <Copy size={14} /> Copy Projects
            </Button>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
};
